/**
 * Tests N6-05 — Identity Matcher Guards + UNRESOLVED (logique pure).
 * Script Node autonome :  node src/utils/ingredientIdentity.test.js
 * MATCH = équivalence normalisée STRICTE ; sinon UNRESOLVED (jamais missing/négatif).
 */
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'ingredientIdentity.js'), 'utf8')
  .replace(/export const /g, 'const ').replace(/export function /g, 'function ')
  + '\nmodule.exports={normalizeIdentity,resolveIngredientIdentity,IDENTITY};';
const m = new module.constructor(); m._compile(code, 'ingredientIdentity.js');
const { resolveIngredientIdentity: R, IDENTITY } = m.exports;

const status = (ing, items) => R(ing, items).status;
const M = IDENTITY.MATCH, U = IDENTITY.UNRESOLVED;

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

const inv = [{ name: 'Mozzarella', id: 1 }, { name: 'Tomate cerise', id: 2 }, { name: 'ail', id: 3 }];

// ── IDENTITY (positifs stricts) ──
ok('ID-T02 nom exact → MATCH', status('Mozzarella', inv) === M);
ok('ID-T03 casse seule → MATCH', status('mozzarella', inv) === M);
ok('ID-T04 espaces/ponctuation → MATCH', status('  Tomate,  cerise ', inv) === M);
ok('ID-T05 accent seul → MATCH', status('mozzarëlla'.normalize(), [{ name: 'mozzarella' }]) === M
  && status('Crème', [{ name: 'creme' }]) === M);

// ── FALSE-POSITIVE GUARDS (le cœur de N6-05) ──
ok('FP-T01 spécifique ≠ générique (Tomate cerise vs recette « tomate ») → UNRESOLVED', status('tomate', inv) === U);
ok('FP-T02 token générique ne matche pas tout (« ail » vs « volaille ») → UNRESOLVED', status('volaille', [{ name: 'ail' }]) === U);
ok('FP-T03 substring interdit (« lait » vs « lait de coco ») → UNRESOLVED', status('lait', [{ name: 'lait de coco' }]) === U);
ok('FP substring inverse (« riz » dans « chorizo ») → UNRESOLVED', status('chorizo', [{ name: 'riz' }]) === U);
ok('FP catégorie/localisation ne créent pas MATCH (« fromage » vs « mozzarella ») → UNRESOLVED', status('fromage', inv) === U);
ok('FP pluriel non deviné (« tomates » vs « tomate ») → UNRESOLVED', status('tomates', [{ name: 'tomate' }]) === U);

// ── NO-MATCH → UNRESOLVED (jamais missing) ──
ok('NEG-T01 aucun match lexical → UNRESOLVED', status('safran', inv) === U);
ok('ID-T09 ingrédient vide → UNRESOLVED', status('', inv) === U);
ok('ID-T10 inventaire vide → UNRESOLVED (pas MISSING)', status('mozzarella', []) === U);
ok('data malformée → pas de crash, UNRESOLVED/MATCH safe',
  status('mozzarella', [null, undefined, {}, { name: 'mozzarella' }]) === M
  && status('safran', [null, {}]) === U);

// ── AMBIGUÏTÉ / DÉTERMINISME ──
ok('AMB-T02 ne prend pas le premier candidat faible (aucun exact) → UNRESOLVED',
  status('tomate', [{ name: 'Tomate cerise' }, { name: 'Tomate séchée' }]) === U);
ok('AMB-T03 ordre du tableau sans effet',
  status('x', [{ name: 'a' }, { name: 'x' }]) === status('x', [{ name: 'x' }, { name: 'a' }]));

// ── COHORTES DUPLIQUÉES : même identité = MATCH (pas ambiguïté), N cohortes retournées ──
const dup = R('tomate', [{ name: 'Tomate', id: 1 }, { name: 'tomate', id: 2 }, { name: 'Riz', id: 3 }]);
ok('DUP MATCH (2 cohortes même identité)', dup.status === M && dup.matches.length === 2);
ok('DUP ne somme pas / ne collapse pas (2 items retournés)', dup.matches.map(x => x.id).sort().join() === '1,2');

// ── POSITIF = identité seulement (pas de quantité/temporel/localisation/faisabilité) ──
// (structurel : resolveIngredientIdentity ne renvoie QUE {status, matches} — aucune de ces clés)
const pos = R('mozzarella', [{ name: 'mozzarella', quantity: 1, dlc: '2026-01-20', location: 'Frigo' }]);
ok('POS-T01 MATCH n\'expose pas quantité/temporel/localisation/faisabilité',
  pos.status === M && Object.keys(pos).sort().join() === 'matches,status');

console.log(`\ningredientIdentity: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
