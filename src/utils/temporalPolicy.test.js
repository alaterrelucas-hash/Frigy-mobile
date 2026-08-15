/**
 * Tests N6-04 — politiques de décision passives (mêmes compositions que les consommateurs),
 * incluant le PLAFOND SÉMANTIQUE AMPLIFIÉ.
 * Script Node autonome :  node src/utils/temporalPolicy.test.js
 *
 * TROIS niveaux de décision sur la MÊME évidence canonique (autorité jamais effacée) :
 *   - QUIET      (tri/tiers Stock, filtres, Recipes ≤7)      → passiveTemporalDays  (DATE + heuristique)
 *   - ATTENTION  (badge onglet, neutre)                       → strongTemporalDays   (DATE seul)
 *   - AMPLIFIÉ   (urgentMode, halo, couleur forte, critical)  → amplifiedTemporalDays (DATE + type supporté)
 * Aujourd'hui aucun type n'est supporté (AMPLIFIED_PASSIVE_DATE_TYPES vide) → amplifié = 0 partout.
 */
const fs = require('fs');
const path = require('path');

function load(file, transforms) {
  let code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  code = (transforms ? transforms(code) : code)
    .replace(/export async function /g, 'async function ')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ');
  const m = new module.constructor();
  m._compile(code, file);
  return m.exports;
}

const product = load('product.js', (c) => c + '\nmodule.exports={normalizeDlc};');
const T = load('temporalAuthority.js', (c) =>
  c.replace(/import \{[^}]*\} from '\.\/product';/,
      `const normalizeDlc = ${product.normalizeDlc.toString()};`)
   + '\nmodule.exports={passiveTemporalDays,strongTemporalDays,amplifiedTemporalDays,AMPLIFIED_PASSIVE_DATE_TYPES};');
const temporal = load('temporal.js', (c) =>
  c.replace(/import \{[^}]*\} from '\.\/product';/, '')
   + '\nmodule.exports={getTemporalTier,getTemporalColorKey,TEMPORAL_TIER};');

const { passiveTemporalDays, strongTemporalDays, amplifiedTemporalDays, AMPLIFIED_PASSIVE_DATE_TYPES } = T;
const { getTemporalTier, getTemporalColorKey, TEMPORAL_TIER } = temporal;
const NOW = new Date(2026, 0, 15);

// Politiques = compositions exactes des écrans :
const stockTier   = (i) => getTemporalTier(passiveTemporalDays(i, NOW));                          // QUIET tiers
const rowColorKey = (i) => getTemporalColorKey(amplifiedTemporalDays(i, NOW));                    // couleur forte (amplifié)
const rowDescDays = (i) => passiveTemporalDays(i, NOW);                                           // descripteur neutre
const badge       = (i) => { const d = strongTemporalDays(i, NOW); return d !== null && d <= 4; };    // ATTENTION (DATE)
const urgentMode  = (i) => { const d = amplifiedTemporalDays(i, NOW); return d !== null && d <= 4; }; // AMPLIFIÉ
const halo        = (i) => amplifiedTemporalDays(i, NOW) !== null;                                // AMPLIFIÉ (halo)
const recipeQuiet = (i) => { const d = passiveTemporalDays(i, NOW); return d !== null && d <= 7; };   // QUIET ≤7
const recipeCrit  = (i) => { const d = amplifiedTemporalDays(i, NOW); return d !== null && d <= 1; };  // AMPLIFIÉ rouge

const estimate = { dlc: '—', days_left: 2 };
const bare     = { days_left: 2 };
const fallback = { days_left: 30 };
const dateJ2   = { dlc: '17/01/2026' };                                          // DATE J2 / type UNKNOWN
const dateJ0   = { dlc: '15/01/2026' };
const dateJ6   = { dlc: '21/01/2026' };
const heurJ2   = { opened: true, opened_at: '2026-01-15', dlc: '17/01/2026' };   // HEURISTIC J2

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── Set amplifié vide ──
ok('AMPLIFIED_PASSIVE_DATE_TYPES vide', AMPLIFIED_PASSIVE_DATE_TYPES.size === 0);

// ── QUIET : tiers Stock (estimate/bare/fallback → LATER ; DATE/HEURISTIC → tier réel) ──
ok('STK-N01 estimate → LATER', stockTier(estimate) === TEMPORAL_TIER.LATER);
ok('STK-N02 bare → LATER', stockTier(bare) === TEMPORAL_TIER.LATER);
ok('STK-N03 fallback → LATER', stockTier(fallback) === TEMPORAL_TIER.LATER);
ok('STK-N04 DATE J2 → SOON', stockTier(dateJ2) === TEMPORAL_TIER.SOON);
ok('STK-N05 HEURISTIC J2 → SOON (quiet)', stockTier(heurJ2) === TEMPORAL_TIER.SOON);

// ── ATTENTION : badge = DATE seul, heuristique/estimate exclus (inchangé §22) ──
ok('BAD DATE J2 → compté', badge(dateJ2) === true);
ok('BAD HEURISTIC J2 → non', badge(heurJ2) === false);
ok('BAD estimate → non', badge(estimate) === false);
ok('BAD DATE J6 (>4) → non', badge(dateJ6) === false);

// ── AMPLIFIÉ : DATE+UNKNOWN NE SUFFIT PAS (type manquant) → zéro partout ──
ok('AMP-01a DATE J2/UNKNOWN → urgentMode NON', urgentMode(dateJ2) === false);
ok('AMP-01b DATE J2/UNKNOWN → halo NON', halo(dateJ2) === false);
ok('AMP-01c DATE J0/UNKNOWN → couleur = neutral (pas rouge/orange)', rowColorKey(dateJ0) === 'neutral');
ok('AMP-01d DATE J1/UNKNOWN → recipe critical NON', recipeCrit(dateJ0) === false);
ok('AMP-02 HEURISTIC J2 → urgentMode/halo/critical NON',
  urgentMode(heurJ2) === false && halo(heurJ2) === false && recipeCrit(heurJ2) === false);
ok('AMP-03 NONE → aucun signal amplifié', urgentMode(estimate) === false && halo(estimate) === false && rowColorKey(estimate) === 'neutral');
ok('AMP-04 estimate → aucun signal amplifié + PAS de tier fort', urgentMode(estimate) === false && stockTier(estimate) === TEMPORAL_TIER.LATER);

// ── Séparation des canaux : descripteur NEUTRE survit alors que la couleur forte disparaît ──
ok('ROW-T01 DATE J2 : descripteur = 2 (neutre) MAIS couleur = neutral', rowDescDays(dateJ2) === 2 && rowColorKey(dateJ2) === 'neutral');
ok('ROW-T02 HEURISTIC J2 : descripteur = 2 MAIS couleur neutral', rowDescDays(heurJ2) === 2 && rowColorKey(heurJ2) === 'neutral');
ok('ROW-T03 NONE : descripteur null (Sans échéance) + couleur neutral', rowDescDays(estimate) === null && rowColorKey(estimate) === 'neutral');

// ── QUIET Recipes préservé (DATE + heuristique ≤7) ; NONE exclu ──
ok('RCP-P01 DATE ≤7 → relevance quiet', recipeQuiet(dateJ6) === true);
ok('RCP-P02 HEURISTIC ≤7 → relevance quiet', recipeQuiet(heurJ2) === true);
ok('RCP-P03 NONE → pas de boost', recipeQuiet(estimate) === false);

// ── §20/§21/§22 CROSS-CONSUMER : même évidence → sorties par niveau ──
// HEURISTIC J2 : Recipes quiet OUI, Stock ordering OUI, badge NON, amplifié NON.
ok('X-HEUR quiet OUI', recipeQuiet(heurJ2) === true && stockTier(heurJ2) === TEMPORAL_TIER.SOON);
ok('X-HEUR badge NON + amplifié NON', badge(heurJ2) === false && urgentMode(heurJ2) === false);
// DATE J2/UNKNOWN : quiet OUI, badge OUI (attention neutre), amplifié NON (type manquant).
ok('X-DATE quiet OUI', recipeQuiet(dateJ2) === true && stockTier(dateJ2) === TEMPORAL_TIER.SOON);
ok('X-DATE badge OUI', badge(dateJ2) === true);
ok('X-DATE amplifié NON (urgentMode/halo/critical/couleur)',
  urgentMode(dateJ2) === false && halo(dateJ2) === false && recipeCrit(dateJ2) === false && rowColorKey(dateJ2) === 'neutral');
// NONE : rien partout, mais item reste rangé/visible (LATER).
ok('X-NONE rien + visible', recipeQuiet(estimate) === false && badge(estimate) === false && urgentMode(estimate) === false && stockTier(estimate) === TEMPORAL_TIER.LATER);

console.log(`\ntemporalPolicy: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
