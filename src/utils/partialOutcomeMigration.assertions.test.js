/**
 * PARTIAL OUTCOME V1 — assertions SUR LA SOURCE de la migration. Test PUR :
 *   node src/utils/partialOutcomeMigration.assertions.test.js
 * Garde les invariants de sécurité/consistance PRÉ-APPLY dans le fichier SQL versionné (ne remplace PAS
 * le DB roundtrip, mais fige les deux défauts corrigés + les invariants PM-1 déjà validés).
 */
const fs = require('fs');
const path = require('path');
const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260818_partial_outcome_remaining.sql'), 'utf8');
// SQL sans commentaires (les invariants doivent vivre dans le CODE, pas dans la doc).
const code = sql.replace(/--.*$/gm, '');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };
const count = (re) => (code.match(re) || []).length;

// ── DÉFAUT 1 : la clôture EMPTY rafraîchit remaining (merge non-clobbant), comme la branche partielle ──
// Il doit y avoir 3 merges `|| jsonb_build_object('remaining',...)` : EMPTY-close + partiel(apply) + correction.
ok('DÉFAUT1 EMPTY close fusionne remaining (3 merges jsonb au total : empty+partiel+correction)',
  count(/\|\|\s*jsonb_build_object\('remaining'/g) === 3);
// La branche EMPTY (consumed = true …) contient BIEN le merge assertion_provenance sur le même UPDATE.
ok('DÉFAUT1 la branche consumed=true écrit AUSSI assertion_provenance remaining',
  /consumed = true[\s\S]{0,220}remaining_level = 'EMPTY',[\s\S]{0,220}assertion_provenance =[\s\S]{0,160}jsonb_build_object\('remaining'/.test(code));
ok('DÉFAUT1 assertedAt=now() présent dans les merges remaining', /'authority','DIRECT','assertedAt', now\(\)/.test(code));

// ── DÉFAUT 2 : helpers internes NON exécutables par AUCUN rôle applicatif (service_role inclus) ──
ok('DÉFAUT2 REVOKE _remaining_ord FROM PUBLIC, anon, authenticated, service_role',
  /REVOKE ALL ON FUNCTION public\._remaining_ord\(text\) FROM PUBLIC, anon, authenticated, service_role;/.test(code));
ok('DÉFAUT2 REVOKE _assert_item_member FROM PUBLIC, anon, authenticated, service_role',
  /REVOKE ALL ON FUNCTION public\._assert_item_member\(uuid\) FROM PUBLIC, anon, authenticated, service_role;/.test(code));

// ── Surface RPC cliente INCHANGÉE : uniquement les 2 canoniques, pour authenticated ──
ok('surface : GRANT EXECUTE apply_partial_outcome TO authenticated',
  /GRANT EXECUTE ON FUNCTION public\.apply_partial_outcome\(uuid,text,text,text\) TO authenticated;/.test(code));
ok('surface : GRANT EXECUTE set_approximate_remaining_level TO authenticated',
  /GRANT EXECUTE ON FUNCTION public\.set_approximate_remaining_level\(uuid,text,text\) TO authenticated;/.test(code));
ok('surface : AUCUN GRANT EXECUTE sur un helper interne', !/GRANT EXECUTE ON FUNCTION public\._/.test(code));
ok('surface : les 2 RPC révoquées de PUBLIC, anon', count(/REVOKE ALL ON FUNCTION public\.(apply_partial_outcome|set_approximate_remaining_level)[^\n]*FROM PUBLIC, anon;/g) === 2);

// ── §1 ACTOR LIFECYCLE : nullable AU REPOS + FK → profiles(id) ON DELETE SET NULL (mirroir added_by) ──
ok('§1 actor FK → profiles(id) ON DELETE SET NULL',
  /actor\s+uuid REFERENCES public\.profiles\(id\) ON DELETE SET NULL,/.test(code));
ok('§1 actor NULLABLE au repos (pas de NOT NULL sur actor)', !/actor\s+uuid NOT NULL/.test(code));
ok('§1 actor inséré depuis auth.uid() à la création (jamais client) — v_item.family_id, auth.uid()',
  (code.match(/v_item\.family_id, auth\.uid\(\)/g) || []).length === 2);
ok('§1 création exige auth.uid() != NULL (NOT_AUTHENTICATED via _assert_item_member)',
  /IF auth\.uid\(\) IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'/.test(code));
ok('§1 aucun actor/family fourni par le client (pas de paramètre p_actor/p_family_id hors garde)',
  !/p_actor/.test(code) && !/p_family_id uuid,/.test(code));

// ── §3/§4 family_id NOT NULL conservé ──
ok('family_id uuid NOT NULL conservé', /family_id\s+uuid NOT NULL/.test(code));

// ── Invariants PM-1 déjà validés (non-régression) ──
ok('PM-1 les 2 RPC = SECURITY DEFINER SET search_path = public', count(/SECURITY DEFINER SET search_path = public/g) === 2);
ok('PM-1 helpers ont search_path figé', /_remaining_ord[\s\S]{0,80}SET search_path = public/.test(code) && /_assert_item_member[\s\S]{0,80}SET search_path = public/.test(code));
ok('PM-1 ledger RLS activée + REVOKE direct client (service_role inclus)', /ENABLE ROW LEVEL SECURITY/.test(code) && /REVOKE ALL PRIVILEGES ON TABLE public\.stock_outcome_events FROM anon, authenticated, service_role;/.test(code));
ok('PM-1 idempotency mismatch + close guard + EMPTY correction interdite', count(/IDEMPOTENCY_MISMATCH/g) === 2 && count(/ITEM_ALREADY_CLOSED/g) === 2 && /INVALID_LEVEL/.test(code));
ok('PM-1 additif + nullable + atomique + pas de USER_ASSERTED',
  /ADD COLUMN IF NOT EXISTS remaining_level/.test(code) && /remaining_level IS NULL OR/.test(code)
  && /^BEGIN;/m.test(code) && /^COMMIT;/m.test(code) && !/USER_ASSERTED/.test(code));
ok('PM-1 family_id/actor dérivés serveur (v_item.family_id, auth.uid()) — jamais de p_family_id/p_actor',
  count(/v_item\.family_id, auth\.uid\(\)/g) === 2 && !/p_family_id uuid,|p_actor/.test(code.replace(/_assert_item_member\(p_family_id uuid\)/, '')));

console.log(`\npartialOutcomeMigration.assertions: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
