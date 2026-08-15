/**
 * Tests Home (logique pure). Aucun runner configuré → script Node autonome.
 *   node src/utils/homeLogic.test.js
 * Charge homeLogic.js + homeRecipes.js en neutralisant les imports natifs (temporal,
 * AsyncStorage, urls, supabase) — seules les fonctions pures sont testées.
 */
const fs = require('fs');
const path = require('path');

function load(file, transforms) {
  let code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  code = transforms(code)
    .replace(/export async function /g, 'async function ')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ');
  const m = new module.constructor();
  m._compile(code, file);
  return m.exports;
}

// homeLogic : stub des helpers d'autorité N6-04 SANS toucher l'allowlist réelle. Les items de test
// portent `__amp` (jour amplifié) et `__pass` (jour passif) → on contrôle chaque palier indépendamment.
// `days_left` seul (sans __amp/__pass) modélise le legacy brut d'autorité NONE (exclu partout).
const logic = load('homeLogic.js', (c) =>
  c.replace(/import \{[^}]*\} from '\.\/temporalAuthority';/,
      "const amplifiedTemporalDays=(i)=>(typeof i.__amp==='number'?i.__amp:null);const passiveTemporalDays=(i)=>(typeof i.__pass==='number'?i.__pass:null);")
   + '\nmodule.exports={HOME_STATE,HOME_LEVEL,selectHomePriority,selectWatchItems,deriveHomeState,deriveVoice,deriveRichnessLevel,priorityMicroCopy};');

// ingredientIdentity : résolveur canonique N6-05 (pur, aucun import) — injecté dans homeRecipes
// (dont les imports sont strippés) pour tester la VRAIE convergence identité, pas un stub.
const identity = load('ingredientIdentity.js', (c) => c + '\nmodule.exports={resolveIngredientIdentity,normalizeIdentity,IDENTITY};');

// homeRecipes : strip imports natifs + injecte le résolveur canonique réel.
const recipes = load('homeRecipes.js', (c) =>
  c.replace(/^import .*$/gm, '')
   + `\nconst normalizeIdentity=${identity.normalizeIdentity.toString()};`
   + `\nconst IDENTITY=${JSON.stringify(identity.IDENTITY)};`
   + `\nconst resolveIngredientIdentity=${identity.resolveIngredientIdentity.toString()};`
   + '\nmodule.exports={calculateROI,selectBestHomeRecipe,deriveGatheringItems};');

const { selectHomePriority, selectWatchItems, deriveHomeState, HOME_STATE, HOME_LEVEL, deriveRichnessLevel, priorityMicroCopy, deriveVoice } = logic;
const { selectBestHomeRecipe, calculateROI } = recipes;

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── N6-13 : HÉRO = palier AMPLIFIÉ uniquement (amplifiedTemporalDays). Legacy brut/UNKNOWN → jamais héros ──
// T1 legacy brut : days_left ≤ 4 mais aucune autorité amplifiée → PAS de héros.
ok('T1 legacy days_left≤4 (autorité NONE) → priority null', selectHomePriority([{ id: 'a', name: 'X', days_left: 2 }]) === null);
// T5 amplifié (synthétique, allowlist réelle NON modifiée) : le plus urgent dans ≤4.
ok('T5 amplifié = plus urgent', selectHomePriority([{ id: 'a', __amp: 2 }, { id: 'b', __amp: 0 }])?.id === 'b');
ok('T5 amplifié null si tout >4', selectHomePriority([{ id: 'a', __amp: 40 }]) === null);
ok('T5 amplifié inclut overdue', selectHomePriority([{ id: 'a', __amp: -1 }, { id: 'b', __amp: 3 }])?.id === 'a');
// T4 STRONG sans amplifié : un item passif/fort (pas __amp) ne devient JAMAIS héros.
ok('T4 passif/fort sans amplifié → priority null', selectHomePriority([{ id: 'a', __pass: 1 }]) === null);
ok('priority [] → null', selectHomePriority([]) === null);

// ── N6-13 : WATCH = palier PASSIF (passiveTemporalDays), 0–7 j ; legacy brut/UNKNOWN exclu ──
ok('WATCH passif dans 0–7 inclus', selectWatchItems([{ id: 'a', __pass: 5 }]).some((x) => x.id === 'a'));
ok('WATCH legacy brut (days_left seul) EXCLU', selectWatchItems([{ id: 'a', days_left: 3 }]).length === 0);
ok('WATCH >7 exclu', selectWatchItems([{ id: 'a', __pass: 9 }]).length === 0);
ok('WATCH exclut la priorité', selectWatchItems([{ id: 'a', __pass: 2 }], { id: 'a' }).length === 0);
ok('WATCH porte watchDays autoritaire', selectWatchItems([{ id: 'a', __pass: 4 }])[0].watchDays === 4);
ok('WATCH plafonné à 2', selectWatchItems([{ id: 'a', __pass: 1 }, { id: 'b', __pass: 2 }, { id: 'c', __pass: 3 }]).length === 2);

// ── priorityMicroCopy : lit le jour amplifié PORTÉ (attentionDays), jamais un champ brut ──
ok('MICRO attentionDays<0 → « À vérifier en priorité »', priorityMicroCopy({ attentionDays: -1 }) === 'À vérifier en priorité.');
ok('MICRO attentionDays 0 → « C’est le bon moment »', priorityMicroCopy({ attentionDays: 0 }) === 'C’est le bon moment.');
ok('MICRO sans attentionDays → vide (jamais dérivé d’un brut)', priorityMicroCopy({ days_left: 2 }) === '');

// ── N6-13 (2.6) : État C (aucun héros amplifié) = SILENCE, jamais de calme global fabriqué ──
ok('C4 deriveVoice(C) → silence (chaine vide)', deriveVoice(HOME_STATE.C, null, [{ id: 'a', __pass: 3 }]) === '');
ok('C4bis deriveVoice(C) ne dit jamais « Rien ne presse »', deriveVoice(HOME_STATE.C, null, []) !== 'Rien ne presse aujourd’hui.');
// EMPTY conserve son invite (état à autorité propre : foyer connu vide).
ok('EMPTY voice conservée (invite, autorité connue)', deriveVoice(HOME_STATE.EMPTY, null, []) !== '');

// deriveHomeState : EMPTY / C / B / A.
ok('state EMPTY', deriveHomeState([], null, null) === HOME_STATE.EMPTY);
ok('state C (pas de priorité)', deriveHomeState([{ id: 'a' }], null, null) === HOME_STATE.C);
ok('state B (priorité, pas de recette)', deriveHomeState([{ id: 'a' }], { id: 'a' }, null) === HOME_STATE.B);
ok('state A (priorité + recette)', deriveHomeState([{ id: 'a' }], { id: 'a' }, { recipe: {} }) === HOME_STATE.A);

// deriveRichnessLevel : EMPTY (0) / LOW (<ACTIVE_MIN=4) / SUFFICIENT (≥4).
ok('level EMPTY (0 item)', deriveRichnessLevel([]) === HOME_LEVEL.EMPTY);
ok('level LOW (1 item)', deriveRichnessLevel([{ id: 'a' }]) === HOME_LEVEL.LOW);
ok('level LOW (3 items)', deriveRichnessLevel([{}, {}, {}]) === HOME_LEVEL.LOW);
ok('level SUFFICIENT (4 items)', deriveRichnessLevel([{}, {}, {}, {}]) === HOME_LEVEL.SUFFICIENT);
ok('level SUFFICIENT (6 items)', deriveRichnessLevel([{}, {}, {}, {}, {}, {}]) === HOME_LEVEL.SUFFICIENT);

// selectBestHomeRecipe : qualification (usesPriority, identité STRICTE) + choix POSITIF (N6-05).
const items = [
  { id: 't', name: 'Tomates cerises', days_left: 0 },
  { id: 'm', name: 'Mozzarella', days_left: 6 },
  { id: 'b', name: 'Basilic frais', days_left: 3 },
];
const priority = items[0];
const caprese = { name: 'Caprese', time: '10 min', diff: 'Très facile', ingredients: ['Tomates cerises', 'Mozzarella', 'Basilic frais', 'Huile d’olive'] }; // 3 MATCH, 1 UNRESOLVED
const tropDeManques = { name: 'Autre', time: '15 min', ingredients: ['Tomates cerises', 'A', 'B', 'C', 'D'] }; // 1 MATCH, 4 UNRESOLVED
const sansPriorite = { name: 'Pâtes', time: '10 min', ingredients: ['Pâtes', 'Beurre'] }; // ne matche pas la priorité

const best = selectBestHomeRecipe([tropDeManques, sansPriorite, caprese], items, priority);
ok('best = Caprese (3 matches > 1)', best?.recipe?.name === 'Caprese');
ok('best.unresolved = 1 (huile) — jamais « missing »', best?.unresolved?.length === 1);
ok('best n’expose PAS de champ missing', best && !('missing' in best));
ok('null si seule recette non-prioritaire', selectBestHomeRecipe([sansPriorite], items, priority) === null);
// N6-05 : 4 ingrédients non résolus ne DISQUALIFIENT PLUS (no-match technique ≠ absence prouvée).
ok('N6-05 : 4 unresolved NON disqualifiés (qualifié par priorité + 1 match)',
  selectBestHomeRecipe([tropDeManques], items, priority)?.recipe?.name === 'Autre');
ok('null si pas de priorité', selectBestHomeRecipe([caprese], items, null) === null);

// ── HIR — convergence identité Home sur le résolveur canonique ──
ok('HIR substring → unresolved (« lait » vs « lait de coco »)',
  (() => { const r = calculateROI(['lait'], [{ name: 'lait de coco' }]); return r.matched.length === 0 && r.unresolved.length === 1; })());
ok('HIR exact normalisé → matched',
  (() => { const r = calculateROI(['Mozzarella'], [{ name: 'mozzarella' }]); return r.matched.length === 1 && r.unresolved.length === 0; })());
ok('HIR cohortes dupliquées → 1 ingrédient matché (pas 2, quantités non sommées)',
  (() => { const r = calculateROI(['tomate'], [{ name: 'Tomate', id: 1 }, { name: 'tomate', id: 2 }]); return r.matched.length === 1; })());
ok('HIR ordre inventaire sans effet sur best',
  selectBestHomeRecipe([caprese], items, priority)?.recipe?.name
    === selectBestHomeRecipe([caprese], [...items].reverse(), priority)?.recipe?.name);
ok('HIR inventaire vide → qualifié (priorité), 0 match, non null, pas de crash',
  selectBestHomeRecipe([caprese], [], priority) !== null
    && selectBestHomeRecipe([caprese], [], priority).matched.length === 0);
// RANK-03 : même nombre de matches (2), unresolved différent → MÊME score identité (unresolved neutre).
const recA = { name: 'A', time: '10 min', ingredients: ['Tomates cerises', 'Mozzarella'] };                 // 2 MATCH, 0 UNRESOLVED
const recB = { name: 'B', time: '10 min', ingredients: ['Tomates cerises', 'Mozzarella', 'X', 'Y', 'Z'] };   // 2 MATCH, 3 UNRESOLVED
ok('HIR même matches (2) → même score malgré unresolved différent (pas de pénalité)',
  (() => { const a = selectBestHomeRecipe([recA], items, priority); const b = selectBestHomeRecipe([recB], items, priority); return a && b && a.score === b.score; })());

console.log(`\nHome logic — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
