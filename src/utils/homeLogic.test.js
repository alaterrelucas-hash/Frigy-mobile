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

// homeLogic : stub temporal (computeDaysRemaining lit days_left).
const logic = load('homeLogic.js', (c) =>
  c.replace(/import \{[^}]*\} from '\.\/temporal';/,
      "const computeDaysRemaining=(i)=>(typeof i.days_left==='number'?i.days_left:null);const getTemporalDescriptor=(d)=>String(d);")
   .replace(/export \{ getTemporalDescriptor \};/, '')
   + '\nmodule.exports={HOME_STATE,HOME_LEVEL,selectHomePriority,selectWatchItems,deriveHomeState,deriveVoice,deriveRichnessLevel};');

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

const { selectHomePriority, deriveHomeState, HOME_STATE, HOME_LEVEL, deriveRichnessLevel } = logic;
const { selectBestHomeRecipe, calculateROI } = recipes;

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// selectHomePriority : le plus urgent dans la fenêtre ≤4 ; null si tout est loin.
ok('priority = plus urgent', selectHomePriority([{ id: 'a', name: 'X', days_left: 2 }, { id: 'b', name: 'Y', days_left: 0 }])?.id === 'b');
ok('priority null si tout >4', selectHomePriority([{ id: 'a', name: 'X', days_left: 40 }]) === null);
ok('priority inclut overdue', selectHomePriority([{ id: 'a', name: 'X', days_left: -1 }, { id: 'b', name: 'Y', days_left: 3 }])?.id === 'a');
ok('priority [] → null', selectHomePriority([]) === null);

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
