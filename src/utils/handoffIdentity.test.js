/**
 * N6-15 — Identité déterministe du handoff Courses→Stock. Script Node autonome :
 *   node src/utils/handoffIdentity.test.js
 * handoffIdentity.js utilise `import { v5 } from 'uuid'` → on transpile en CJS via Babel (le même
 * `uuid` que le bundle app), puis on vérifie déterminisme + VECTEUR GOLDEN (contrat de namespace figé).
 */
const path = require('path');
const babel = require('@babel/core');

function load(rel) {
  const file = path.join(__dirname, rel);
  const { code } = babel.transformFileSync(file, {
    babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const m = new module.constructor(file, module);
  m.filename = file; m.paths = require('module')._nodeModulePaths(path.dirname(file));
  m._compile(code, file);
  return m.exports;
}

const { courseStockItemId, courseLineage, COURSES_TO_STOCK_NAMESPACE_V1, HANDOFF_LINEAGE_KIND } = load('handoffIdentity.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

const FAM  = '11111111-1111-4111-8111-111111111111';
const FAM2 = '99999999-9999-4999-8999-999999999999';
const SHOP = '22222222-2222-4222-8222-222222222222';
const SHOP2= '33333333-3333-4333-8333-333333333333';

// ── VECTEUR GOLDEN — protège le contrat namespace/mapping contre toute dérive future ──
ok('GOLDEN namespace figé', COURSES_TO_STOCK_NAMESPACE_V1 === '5a0af8f0-b4b3-5d13-9f9e-382d5d5dd028');
ok('GOLDEN courseStockItemId(FAM,SHOP) exact',
  courseStockItemId({ familyId: FAM, shoppingItemId: SHOP }) === 'cd7aa125-0265-5194-bafa-2d1d120af6a8');

// ── ID-T01 : même famille + même shopping id → même UUID (stable) ──
ok('ID-T01 déterministe', courseStockItemId({ familyId: FAM, shoppingItemId: SHOP }) === courseStockItemId({ familyId: FAM, shoppingItemId: SHOP }));
// ── ID-T02 : shopping id différent → UUID différent ──
ok('ID-T02 shopping id distinct', courseStockItemId({ familyId: FAM, shoppingItemId: SHOP }) !== courseStockItemId({ familyId: FAM, shoppingItemId: SHOP2 }));
// ── ID-T03 : famille différente → UUID différent ──
ok('ID-T03 famille distincte', courseStockItemId({ familyId: FAM, shoppingItemId: SHOP }) !== courseStockItemId({ familyId: FAM2, shoppingItemId: SHOP }));
// ── ID-T04 : résultat = UUID v5 valide ──
ok('ID-T04 forme UUID v5', (() => {
  const id = courseStockItemId({ familyId: FAM, shoppingItemId: SHOP });
  return /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
})());
// ── ID-T05/06/07 : nom / quantité / emplacement n'entrent PAS dans la dérivation ──
ok('ID-T05/06/07 seuls family+shopping comptent (aucun autre champ accepté)', (() => {
  const a = courseStockItemId({ familyId: FAM, shoppingItemId: SHOP, name: 'Lait', quantity: 3, location: 'Frigo' });
  const b = courseStockItemId({ familyId: FAM, shoppingItemId: SHOP, name: 'Beurre', quantity: 1, location: 'Placard' });
  return a === b && a === 'cd7aa125-0265-5194-bafa-2d1d120af6a8';
})());
// ── entrées manquantes → null (jamais d'id partiel) ──
ok('entrée manquante → null', courseStockItemId({ familyId: FAM }) === null && courseStockItemId({ shoppingItemId: SHOP }) === null && courseStockItemId() === null);

// ── LIGNÉE : origine, pas autorité ──
ok('lineage kind = COURSES + shoppingItemId', (() => {
  const l = courseLineage({ shoppingItemId: SHOP });
  return l && l.kind === 'COURSES' && l.shoppingItemId === SHOP;
})());
ok('HANDOFF_LINEAGE_KIND = COURSES', HANDOFF_LINEAGE_KIND === 'COURSES');
ok('lineage sans shoppingItemId → null', courseLineage({}) === null);
ok('lineage ne contient AUCUN champ d\'autorité (quantity/date/location)', (() => {
  const l = courseLineage({ shoppingItemId: SHOP });
  return !('quantity' in l) && !('dateValue' in l) && !('location' in l) && !('authority' in l);
})());

console.log(`\nhandoffIdentity: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
