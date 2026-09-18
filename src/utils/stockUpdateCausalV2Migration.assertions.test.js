/**
 * STOCK UPDATE CAUSAL V2 — assertions SUR LA SOURCE de la migration. Test PUR :
 *   node src/utils/stockUpdateCausalV2Migration.assertions.test.js
 * Fige le contrat V2 (§32) : projections item, ledger unique évolué, RPC canonique unique + wrapper de
 * compatibilité, correction séparée, sécurité — SANS appliquer quoi que ce soit.
 */
const fs = require('fs');
const path = require('path');
const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260819_stock_update_causal_v2.sql'), 'utf8');
const code = sql.replace(/--.*$/gm, ''); // sans commentaires (les invariants vivent dans le CODE)

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };
const count = (re) => (code.match(re) || []).length;

// ── ITEMS : projections de cycle de vie ──
ok('items.used_declared boolean NOT NULL DEFAULT false', /ADD COLUMN IF NOT EXISTS used_declared\s+boolean NOT NULL DEFAULT false/.test(code));
ok('items.waste_declared boolean NOT NULL DEFAULT false', /ADD COLUMN IF NOT EXISTS waste_declared\s+boolean NOT NULL DEFAULT false/.test(code));

// ── LEDGER : UN SEUL ledger, évolué additivement ──
ok('aucun 2e ledger (pas de stock_update_events)', !/stock_update_events/.test(code));
ok('event_kind ajouté + CHECK UPDATE/CORRECTED + NOT NULL', /ADD COLUMN IF NOT EXISTS event_kind/.test(code) && /event_kind IN \('UPDATE','CORRECTED'\)/.test(code) && /ALTER COLUMN event_kind SET NOT NULL/.test(code));
ok('event.used_declared / waste_declared ajoutés + NOT NULL DEFAULT false', /ADD COLUMN IF NOT EXISTS used_declared\s+boolean;/.test(code) && /ADD COLUMN IF NOT EXISTS waste_declared\s+boolean;/.test(code) && /ALTER COLUMN used_declared\s+SET DEFAULT false, ALTER COLUMN used_declared\s+SET NOT NULL/.test(code));
ok('outcome_type devient nullable (compatibilité)', /ALTER COLUMN outcome_type DROP NOT NULL/.test(code));
ok('AUCUN vocabulaire MIXED/NONE/OBSERVED/USED_AND_WASTED', !/MIXED|USED_AND_WASTED|'NONE'|OBSERVED/.test(code));

// ── BACKFILL sûr (ne dépend pas de 0 ligne) ──
ok('backfill event depuis outcome_type (USED/WASTED/CORRECTED)', /event_kind\s*=\s*CASE WHEN outcome_type = 'CORRECTED'/.test(code) && /outcome_type = 'USED'/.test(code) && /outcome_type = 'WASTED'/.test(code));
ok('backfill projections item depuis événements + clôture legacy (pas de fabrication sur ligne active)',
  /consumed IS TRUE AND i\.wasted IS NOT TRUE/.test(code) && /i\.wasted IS TRUE/.test(code) && /e\.used_declared IS TRUE/.test(code) && /e\.waste_declared IS TRUE/.test(code));

// ── RPC CANONIQUE apply_stock_update ──
const asu = (code.match(/CREATE OR REPLACE FUNCTION public\.apply_stock_update[\s\S]*?END; \$\$;/) || [''])[0];
ok('apply_stock_update existe', asu.length > 0);
ok('apply_stock_update SECURITY DEFINER + search_path public', /SECURITY DEFINER SET search_path = public/.test(asu));
ok('apply_stock_update signature (item, after, used bool DEFAULT false, waste bool DEFAULT false, token)',
  /apply_stock_update\(\s*p_item_id uuid, p_after_level text,\s*p_used_declared boolean DEFAULT false, p_waste_declared boolean DEFAULT false,\s*p_client_event_id text DEFAULT NULL/.test(asu));
ok('rejette NULL causal (pas de 3e état)', /p_used_declared IS NULL OR p_waste_declared IS NULL.*INVALID_DECLARATION/s.test(asu));
ok('FOR UPDATE + authz foyer explicite', /FOR UPDATE/.test(asu) && /_assert_item_member\(v_item\.family_id\)/.test(asu));
// idempotency AVANT le garde de clôture
const iIdem = asu.indexOf('client_event_id = p_client_event_id');
const iClosed = asu.indexOf("v_item.consumed IS TRUE THEN RAISE EXCEPTION 'ITEM_ALREADY_CLOSED'");
ok('idempotency AVANT close-guard', iIdem > 0 && iClosed > 0 && iIdem < iClosed);
ok('idempotency canonique = item+UPDATE+after+used+waste', /event_kind = 'UPDATE'[\s\S]*used_declared,false\)\s*= p_used_declared[\s\S]*waste_declared,false\)\s*= p_waste_declared/.test(asu));
ok('IDEMPOTENCY_MISMATCH sur payload différent', /IDEMPOTENCY_MISMATCH/.test(asu));
ok('monotonicité préservée (INCREASE_NOT_ALLOWED)', /_remaining_ord\(p_after_level\) > public\._remaining_ord\(v_before\)[\s\S]*INCREASE_NOT_ALLOWED/.test(asu));
ok('OR cumulatif des déclarations (jamais d\'effacement)', /v_used\s*:=\s*COALESCE\(v_item\.used_declared,false\)\s*OR p_used_declared/.test(asu) && /v_waste\s*:=\s*COALESCE\(v_item\.waste_declared,false\)\s*OR p_waste_declared/.test(asu));
ok('EMPTY clôt (consumed=true, remaining=EMPTY)', /p_after_level = 'EMPTY'/.test(asu) && /consumed = true[\s\S]*remaining_level = 'EMPTY'/.test(asu));
ok('legacy wasted = waste_declared CUMULÉ (miroir)', /wasted = v_waste/.test(asu));
ok('provenance remaining rafraîchie (merge non-clobbant) sur close ET partiel', (asu.match(/jsonb_build_object\('remaining'/g) || []).length === 2);
ok('UN seul événement, outcome_type NULL (pas de MIXED)', (asu.match(/INSERT INTO public\.stock_outcome_events/g) || []).length === 1 && /'UPDATE', NULL,/.test(asu));

// ── COMPATIBILITÉ : apply_partial_outcome = wrapper (UNE autorité) ──
const apo = (code.match(/CREATE OR REPLACE FUNCTION public\.apply_partial_outcome[\s\S]*?END; \$\$;/) || [''])[0];
ok('apply_partial_outcome existe encore', apo.length > 0);
ok('apply_partial_outcome route vers apply_stock_update', /RETURN public\.apply_stock_update\(/.test(apo));
ok('map USED→(true,false) / WASTED→(false,true)', /\(p_outcome_type = 'USED'\), \(p_outcome_type = 'WASTED'\)/.test(apo));
ok('wrapper NE duplique PAS l\'algorithme (aucun UPDATE items / INSERT event dans le wrapper)', !/UPDATE public\.items/.test(apo) && !/INSERT INTO public\.stock_outcome_events/.test(apo));

// ── CORRECTION séparée, n'efface pas les projections ──
const corr = (code.match(/CREATE OR REPLACE FUNCTION public\.set_approximate_remaining_level[\s\S]*?END; \$\$;/) || [''])[0];
ok('set_approximate_remaining_level → event_kind CORRECTED', /'CORRECTED', NULL, false, false/.test(corr));
ok('correction N\'ÉCRIT PAS used_declared/waste_declared sur l\'item (préserve les projections)', !/used_declared = /.test(corr.replace(/[\s\S]*?UPDATE public\.items SET remaining_level = p_level/,'')));
ok('correction ne touche pas consumed/wasted', !/consumed = |wasted = /.test(corr));

// ── SÉCURITÉ ──
ok('apply_stock_update REVOKE PUBLIC/anon + GRANT authenticated,service_role', /REVOKE ALL ON FUNCTION public\.apply_stock_update\(uuid,text,boolean,boolean,text\) FROM PUBLIC, anon;/.test(code) && /GRANT EXECUTE ON FUNCTION public\.apply_stock_update\(uuid,text,boolean,boolean,text\) TO authenticated, service_role;/.test(code));
ok('transactionnel (BEGIN/COMMIT)', /^BEGIN;/m.test(code) && /^COMMIT;/m.test(code));

console.log(`\nstockUpdateCausalV2Migration.assertions: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
