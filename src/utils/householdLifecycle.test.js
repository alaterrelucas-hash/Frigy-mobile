/**
 * N6-14 (CR-08) — Household lifecycle → Home mode. Script Node autonome :
 *   node src/utils/householdLifecycle.test.js
 * Pur → compilé tel quel. UNKNOWN ≠ NEVER ; stock actif prouve l'initialisation ; jamais de First Run/
 * Empty fabriqués sous autorité indisponible.
 */
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'householdLifecycle.js'), 'utf8')
  .replace(/export const /g, 'const ').replace(/export function /g, 'function ')
  + '\nmodule.exports={LIFECYCLE_STATE,HOME_MODE,resolveHomeMode};';
const m = new module.constructor(); m._compile(code, 'householdLifecycle.js');
const { LIFECYCLE_STATE: S, HOME_MODE: M, resolveHomeMode: R } = m.exports;

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── Précédence : compte non prêt → NEUTRE ──
ok('items non prêt → NEUTRE', R({ itemsReady: false, lifecycleReady: true, activeCount: 0, lifecycleState: S.NEVER }) === M.NEUTRAL);

// ── Stock actif prouve l'initialisation → ACTIVE (cycle de vie non requis, jamais First Run/Empty) ──
ok('L4 actif>0 → ACTIVE', R({ itemsReady: true, lifecycleReady: true, activeCount: 3, lifecycleState: S.INITIALIZED }) === M.ACTIVE);
ok('actif>0 même cycle de vie non prêt → ACTIVE', R({ itemsReady: true, lifecycleReady: false, activeCount: 3, lifecycleState: null }) === M.ACTIVE);
ok('never_initialized + actif>0 → ACTIVE (jamais First Run)', R({ itemsReady: true, lifecycleReady: true, activeCount: 1, lifecycleState: S.NEVER }) === M.ACTIVE);

// ── 0 actif : exige lifecycleReady + état prouvé ──
ok('0 actif + cycle de vie non prêt → NEUTRE', R({ itemsReady: true, lifecycleReady: false, activeCount: 0, lifecycleState: null }) === M.NEUTRAL);
ok('L17 ligne absente (state null) → NEUTRE (jamais NEVER)', R({ itemsReady: true, lifecycleReady: true, activeCount: 0, lifecycleState: null }) === M.NEUTRAL);
ok('L10 legacy_unknown + 0 → NEUTRE (UNKNOWN ≠ NEVER)', R({ itemsReady: true, lifecycleReady: true, activeCount: 0, lifecycleState: S.LEGACY_UNKNOWN }) === M.NEUTRAL);
ok('L1 never_initialized + 0 → FIRST RUN', R({ itemsReady: true, lifecycleReady: true, activeCount: 0, lifecycleState: S.NEVER }) === M.FIRST_RUN);
ok('L5 initialized + 0 → EMPTY RETURNING', R({ itemsReady: true, lifecycleReady: true, activeCount: 0, lifecycleState: S.INITIALIZED }) === M.EMPTY);
ok('valeur d\'état inattendue + 0 → NEUTRE (fail-safe)', R({ itemsReady: true, lifecycleReady: true, activeCount: 0, lifecycleState: 'garbage' }) === M.NEUTRAL);

// ── UNKNOWN ≠ NEVER (doctrine) : aucun chemin ne fabrique First Run sans preuve never_initialized ──
ok('DOCTRINE aucun First Run sans never_initialized', [null, S.LEGACY_UNKNOWN, S.INITIALIZED, undefined].every(
  (st) => R({ itemsReady: true, lifecycleReady: true, activeCount: 0, lifecycleState: st }) !== M.FIRST_RUN));
// ── Réponse périmée ne peut jamais créer First Run/Empty (ils exigent 0 actif ET état prouvé) ──
ok('stale-safe : actif>0 domine toujours (jamais First Run/Empty)', R({ itemsReady: true, lifecycleReady: true, activeCount: 5, lifecycleState: S.LEGACY_UNKNOWN }) === M.ACTIVE);

// ── args par défaut → NEUTRE (fail-safe) ──
ok('aucun argument → NEUTRE', R() === M.NEUTRAL);
ok('activeCount NaN → NEUTRE (compte non fiable ≠ 0 prouvé)', R({ itemsReady: true, lifecycleReady: true, activeCount: NaN, lifecycleState: S.NEVER }) === M.NEUTRAL);

console.log(`\nhouseholdLifecycle: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
