/**
 * N6-14 (CR-08) — Contrat SQL STATIQUE de la migration household_lifecycle (NON appliquée).
 *   node src/utils/householdLifecycleMigration.regression.test.js
 * Ceci N'EXÉCUTE PAS Postgres : c'est une régression de TEXTE SQL. Le comportement réel (policies,
 * DELETE PostgREST côté client, atomicité, stamping, cascade auth) exige une vérification post-migration
 * en base contrôlée AVANT release (voir rapport §13).
 */
const fs = require('fs');
const path = require('path');

const stripSql = (s) => s.replace(/--[^\n]*/g, ''); // retire les commentaires (mots-clés explicatifs)
const sqlPath = path.join(__dirname, '../../supabase/migrations/20260816_household_lifecycle.sql');
const sql = stripSql(fs.readFileSync(sqlPath, 'utf8'));
const reconcilePath = path.join(__dirname, '../../supabase/migrations/20260817_household_lifecycle_reconcile.sql');
const recon = stripSql(fs.readFileSync(reconcilePath, 'utf8'));

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── Transaction encadrée : exactement 1 BEGIN;/COMMIT; de transaction (les BEGIN plpgsql sont internes) ──
ok('SQL transaction encadrée (BEGIN;/COMMIT; uniques)', (sql.match(/\bBEGIN;/g) || []).length === 1 && (sql.match(/\bCOMMIT;/g) || []).length === 1);

// ── Table + états + cohérence ──
ok('TABLE household_lifecycle', /CREATE TABLE IF NOT EXISTS public\.household_lifecycle/.test(sql));
ok('FK family_id → families ON DELETE CASCADE', /family_id\s+uuid PRIMARY KEY REFERENCES public\.families\(id\) ON DELETE CASCADE/.test(sql));
ok('3 états exacts (CHECK)', sql.includes("state IN ('never_initialized','legacy_unknown','initialized')"));
ok('cohérence initialized ⇔ initialized_at NOT NULL', sql.includes('household_lifecycle_state_consistency'));

// ── RLS : SELECT membre seulement, aucun write client ──
ok('RLS activée', /ALTER TABLE public\.household_lifecycle ENABLE ROW LEVEL SECURITY/.test(sql));
ok('SELECT membre via profiles.family_id', /CREATE POLICY household_lifecycle_member_select[\s\S]*?FOR SELECT/.test(sql) && sql.includes('p.family_id FROM public.profiles p WHERE p.id = auth.uid()'));
ok('AUCUNE policy write client sur household_lifecycle (1 policy, FOR SELECT)', (() => {
  const pols = sql.match(/CREATE POLICY[^;]*ON public\.household_lifecycle[^;]*;/g) || [];
  return pols.length === 1 && /FOR SELECT/.test(pols[0]) && !/FOR (INSERT|UPDATE|DELETE)/.test(pols[0]);
})());

// ── Privilèges de TABLE explicites (moindre privilège ; ne pas dépendre des grants ambiants) ──
// [CONTRAT SQL STATIQUE — pas une preuve de privilèges live]
ok('GRANT REVOKE ALL FROM anon, authenticated', /REVOKE ALL PRIVILEGES\s+ON TABLE public\.household_lifecycle\s+FROM anon, authenticated/.test(sql));
ok('GRANT SELECT à authenticated (row-authority via RLS)', /GRANT SELECT\s+ON TABLE public\.household_lifecycle\s+TO authenticated/.test(sql));
ok('GRANT aucun write (INSERT/UPDATE/DELETE) à authenticated/anon sur lifecycle',
  !/GRANT[\s\S]*?(INSERT|UPDATE|DELETE)[\s\S]*?ON TABLE public\.household_lifecycle[\s\S]*?TO (authenticated|anon)/.test(sql));
ok('anon n\'obtient AUCUN privilège lifecycle (pas de GRANT ... TO anon)', !/GRANT[\s\S]*?ON TABLE public\.household_lifecycle[\s\S]*?TO anon/.test(sql));

// ── Backfill : toute famille ; 0 item → legacy_unknown (jamais never) ; item → initialized ──
ok('BACKFILL insère pour chaque famille', /INSERT INTO public\.household_lifecycle[\s\S]*?FROM public\.families f/.test(sql));
// Backfill LINEAGE-AWARE (2A.8) : item→initialized ; 0-item + Auth post-cutoff→never ; sinon legacy_unknown.
// On isole le 1er INSERT ... SELECT ... FROM public.families (le backfill) pour scoper les assertions.
const backfill = (sql.match(/INSERT INTO public\.household_lifecycle[\s\S]*?FROM public\.families f[\s\S]*?ON CONFLICT \(family_id\) DO NOTHING;/) || [''])[0];
ok('BACKFILL item présent → initialized', /EXISTS \(SELECT 1 FROM public\.items[\s\S]*?THEN 'initialized'/.test(backfill));
ok('BACKFILL 0-item + Auth post-cutoff → never_initialized (via cutoff canonique)',
  backfill.includes('household_lifecycle_tracking_cutoff()') && backfill.includes("THEN 'never_initialized'"));
ok('BACKFILL 0-item + Auth pre-cutoff/NULL/absent → legacy_unknown (JAMAIS never sans preuve)', backfill.includes("ELSE 'legacy_unknown'"));
ok('BACKFILL autorité = auth.users.created_at via created_by (PAS families.created_at)',
  backfill.includes('FROM auth.users u WHERE u.id = f.created_by') && !backfill.includes('f.created_at') && !backfill.includes('families.created_at'));

// ── Stamp création famille : couvre les 2 autorités (trigger AFTER INSERT on families) ──
ok('STAMP trigger AFTER INSERT ON families', /CREATE TRIGGER trg_stamp_family_lifecycle[\s\S]*?AFTER INSERT ON public\.families/.test(sql));
ok('STAMP SECURITY DEFINER (lit auth.users.created_at)', /stamp_family_lifecycle[\s\S]*?SECURITY DEFINER/.test(sql) && sql.includes('FROM auth.users u WHERE u.id = NEW.created_by'));
ok('STAMP cutoff : pre-cutoff Auth → legacy_unknown, post-cutoff → never', sql.includes('household_lifecycle_tracking_cutoff()') && sql.includes("THEN 'never_initialized' ELSE 'legacy_unknown'"));

// ── Item INSERT → initialized (UPSERT, write-once, définer, même transaction) ──
ok('ITEM trigger AFTER INSERT ON items', /CREATE TRIGGER trg_mark_household_initialized[\s\S]*?AFTER INSERT ON public\.items/.test(sql));
ok('ITEM UPSERT (ON CONFLICT DO UPDATE)', sql.includes('ON CONFLICT (family_id) DO UPDATE'));
ok('ITEM write-once initialized_at (COALESCE préserve l\'original)', sql.includes('COALESCE(public.household_lifecycle.initialized_at, EXCLUDED.initialized_at)'));
ok('ITEM ne réécrit pas un déjà-initialized (WHERE state <> initialized)', sql.includes("WHERE public.household_lifecycle.state <> 'initialized'"));

// ── profiles : retrait du DELETE client, FK cascade intacte ──
ok('PROFILES policy ALL supprimée', sql.includes('DROP POLICY IF EXISTS profiles_own ON public.profiles'));
ok('PROFILES SELECT/INSERT/UPDATE recréées', sql.includes('profiles_own_select') && sql.includes('profiles_own_insert') && sql.includes('profiles_own_update'));
ok('PROFILES aucune policy FOR DELETE (client ne peut plus supprimer)', (() => {
  const pols = sql.match(/CREATE POLICY[^;]*ON public\.profiles[^;]*;/g) || [];
  return pols.length >= 3 && !pols.some((p) => /FOR DELETE/.test(p));
})());
ok('PROFILES FK auth cascade NON modifiée (aucun ALTER de la FK)', !/ALTER TABLE public\.profiles[\s\S]*?(DROP CONSTRAINT|ON DELETE)/.test(sql));

// ── N6-14 (2A.7) : 2e migration de RÉCONCILIATION (transaction SÉPARÉE, après COMMIT du primaire) ──
// [CONTRAT SQL STATIQUE — pas une preuve d'exécution live]
ok('RECON transaction propre (BEGIN;/COMMIT;)', (recon.match(/\bBEGIN;/g) || []).length === 1 && (recon.match(/\bCOMMIT;/g) || []).length === 1);
// ── A. INSERT des lignes manquantes (lineage-aware) ──
const reconInsert = (recon.match(/INSERT INTO public\.household_lifecycle[\s\S]*?ON CONFLICT \(family_id\) DO NOTHING;/) || [''])[0];
ok('RECON.A cible les familles SANS ligne de cycle de vie', /WHERE NOT EXISTS\s*\(SELECT 1 FROM public\.household_lifecycle hl WHERE hl\.family_id = f\.id\)/.test(reconInsert));
ok('RECON.A idempotent (ON CONFLICT DO NOTHING, ne réécrit rien)', reconInsert.includes('ON CONFLICT (family_id) DO NOTHING'));
ok('RECON.A item présent → initialized', /EXISTS \(SELECT 1 FROM public\.items[\s\S]*?THEN 'initialized'/.test(reconInsert));
ok('RECON.A 0 item + Auth post-cutoff → never_initialized', reconInsert.includes("THEN 'never_initialized'") && reconInsert.includes('household_lifecycle_tracking_cutoff()'));
ok('RECON.A 0 item + Auth pre-cutoff/NULL/absente → legacy_unknown (JAMAIS never)', reconInsert.includes("ELSE 'legacy_unknown'"));
// ── B. PROMOTION : preuve item courante → initialized, même si une ligne existe déjà (course post-backfill/pre-COMMIT) ──
const reconUpdate = (recon.match(/UPDATE public\.household_lifecycle hl[\s\S]*?;\s*(?:\n|$)/) || [''])[0];
ok('RECON.B existe : UPDATE de promotion sur household_lifecycle', /\bUPDATE public\.household_lifecycle hl\b/.test(recon) && reconUpdate.length > 0);
ok('RECON.B promeut vers initialized (SET state = initialized)', /SET state = 'initialized'/.test(reconUpdate));
ok('RECON.B UNIQUEMENT si preuve item courante (EXISTS items dans le WHERE)', /EXISTS \(SELECT 1 FROM public\.items i WHERE i\.family_id = hl\.family_id\)/.test(reconUpdate));
ok('RECON.B NO-DOWNGRADE : ne touche jamais une ligne déjà initialized (WHERE state <> initialized)', /WHERE hl\.state <> 'initialized'/.test(reconUpdate));
ok('RECON.B write-once initialized_at (COALESCE préserve l\'existant, fallback min(items)/now)',
  /initialized_at = COALESCE\(\s*hl\.initialized_at/.test(reconUpdate)
  && reconUpdate.includes('min(i.created_at)') && reconUpdate.includes('now()'));
ok('RECON.B ne rétrograde JAMAIS vers never/legacy (aucun SET state vers un état non-initialized)',
  !/SET[\s\S]*?state = '(never_initialized|legacy_unknown)'/.test(reconUpdate));
ok('RECON idempotent global : réexécution neutre (INSERT DO NOTHING + UPDATE borné par state<>initialized)',
  reconInsert.includes('ON CONFLICT (family_id) DO NOTHING') && /WHERE hl\.state <> 'initialized'/.test(reconUpdate));
// ── invariants partagés ──
ok('RECON utilise la MÊME fonction cutoff canonique (pas de 2e littéral)', recon.includes('public.household_lifecycle_tracking_cutoff()') && !/\d{4}-\d{2}-\d{2}T/.test(recon));
ok('RECON n\'utilise PAS families.created_at comme autorité', !recon.includes('f.created_at') && !recon.includes('families.created_at'));

// ── CONVERGENCE (2A.8) : les 3 chemins classent identiquement (cutoff canonique, mêmes états) ──
ok('CONVERGENCE cutoff canonique unique référencé par backfill + stamp + reconcile', (() => {
  const stamp = (sql.match(/stamp_family_lifecycle\(\)[\s\S]*?\$\$;/) || [''])[0];
  return backfill.includes('household_lifecycle_tracking_cutoff()')
      && stamp.includes('household_lifecycle_tracking_cutoff()')
      && recon.includes('household_lifecycle_tracking_cutoff()');
})());
ok('CONVERGENCE never uniquement au-delà du cutoff dans les 3 chemins (jamais sur autorité manquante)',
  [backfill, (sql.match(/stamp_family_lifecycle\(\)[\s\S]*?\$\$;/) || [''])[0], recon].every(
    (blk) => blk.includes("THEN 'never_initialized'") && blk.includes("ELSE 'legacy_unknown'")));

console.log(`\nhouseholdLifecycleMigration.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
