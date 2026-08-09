/**
 * Tests du resolver Food Language. Aucun runner (jest) n'est configuré sur le projet :
 * ce fichier est un script Node autonome.  Lancer :  node src/utils/foodLanguage.test.js
 *
 * Il charge foodLanguage.js en neutralisant les require() de PNG (Node ne charge pas
 * d'images) et en transformant les `export` ESM en CommonJS — le reste est du JS
 * standard. Couvre : identités canoniques, spécificité (nom > jeton court), alias,
 * singulier/pluriel + accents, paire minimale pâté/pâtes, et fallback (null).
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'foodLanguage.js');
let code = fs.readFileSync(SRC, 'utf8')
  .replace(/require\('[^']*\/([^\/']+)\.png'\)/g, "'IMG:$1'")
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')
  + '\nmodule.exports = { PRIMITIVES, getPrimitive, resolveFoodImage };';
const m = new module.constructor();
m._compile(code, SRC);
const { resolveFoodImage, getPrimitive, PRIMITIVES } = m.exports;

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const g = got == null ? null : got.key;
  if (g === want) pass++;
  else { fail++; console.log(`FAIL  ${label}\n        got=${g}  want=${want}`); }
};

// Registre complet + ratio dérivé des dimensions réelles.
console.assert(Object.keys(PRIMITIVES).length === 192, 'attendu 192 primitives');
console.assert(getPrimitive('avocat') && Math.abs(getPrimitive('avocat').ratio - 0.6932) < 0.001, 'ratio avocat');
console.assert(getPrimitive('inconnu') === null, 'clé inconnue → null');

// Identités canoniques (nom ≈ slug).
[['Avocat', 'avocat'], ['Steak haché', 'steak-hache'], ['Tomates cerises', 'tomates-cerises'],
 ['Poulet rôti', 'poulet-roti'], ['Lait entier', 'lait-entier'], ['Œufs', 'oeufs'],
 ['Pâtes', 'pates'], ['Pâté', 'pate'], ['Riz', 'riz'], ['Riz cuit', 'riz-cuit'],
 ['Citron', 'citron'], ['Citron vert', 'citron-vert'], ['Jambon', 'jambon'], ['Jambon cru', 'jambon-cru'],
 ['Yaourt nature', 'yaourt-nature'], ['Yaourt grec', 'yaourt-grec'], ['Salade', 'salade'], ['Salade verte', 'salade-verte'],
 ['Carottes', 'carottes'], ['Carottes râpées', 'carottes-rapees'], ['Pommes de terre', 'pommes-de-terre'],
 ['Fromage râpé parmesan', 'fromage-rape-parmesan'], ['Mozzarella', 'mozzarella'], ['Mozzarella râpée', 'mozzarella-rapee'],
 ['Œufs durs', 'oeufs-durs'], ['Chou frisé (kale)', 'chou-frise-kale'],
].forEach(([n, k]) => eq(`canon "${n}"`, resolveFoodImage(n), k));

// Spécificité : un nom descriptif réel résout au jeton le plus précis présent.
[['Yaourt grec 0% Danone 4x125g', 'yaourt-grec'], ['Poulet rôti fermier Label Rouge', 'poulet-roti'],
 ['Citron vert bio', 'citron-vert'], ['Pâtes complètes Barilla', 'pates'], ['Pâtes fraîches aux œufs', 'pates-fraiches'],
 ['Pâté de campagne supérieur', 'pate'], ['Steaks hachés 5% MG x2', 'steak-hache'],
 ['Jambon blanc découenné', 'jambon'], ['Riz basmati', 'riz'], ['Sauce tomate basilic', 'tomate'],
 ['Lait 1/2 écrémé', 'lait-entier'], ['Filet de saumon', 'saumon'], ['Escalope de dinde', 'dinde'],
].forEach(([n, k]) => eq(`spec  "${n}"`, resolveFoodImage(n), k));

// Alias / synonymes déterministes.
[['Yaourt', 'yaourt-nature'], ['Yogourt à la grecque', 'yaourt-nature'], ['Blanc de poulet', 'poulet-cru'],
 ['Poulet', 'poulet-cru'], ['Bœuf haché 15%', 'viande-hachee'], ['Fromage râpé', 'fromage-rape-emmental'],
 ['Hummus', 'houmous'], ['Kale', 'chou-frise-kale'], ['Patate', 'pommes-de-terre'],
 ['Crème', 'creme-fraiche'], ['Crème fraîche épaisse', 'creme-fraiche'], ['Crème liquide entière', 'creme-liquide'],
].forEach(([n, k]) => eq(`alias "${n}"`, resolveFoodImage(n), k));

// Fallback : aucune primitive fiable → null (l'UI retombe sur img_url puis emoji).
[['Produit mystère XYZ', null], ['', null], ['   ', null], ['Boisson énergisante', null],
].forEach(([n, k]) => eq(`null  "${n}"`, resolveFoodImage(n), k));

// `opened` ne fabrique aucun état : aucune primitive d'état n'existe.
eq("opened n'altère pas la résolution", resolveFoodImage({ name: 'Lait entier', opened: true }), 'lait-entier');

console.log(`\nFood Language resolver — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
