/**
 * N6-15 (CR-04) — Autorité de quantité COURSES. Script Node autonome :
 *   node src/utils/shoppingQuantity.test.js
 * Intention d'achat (>=1) uniquement ; jamais quantité foyer ; aucune unité physique ; string DB.
 */
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'shoppingQuantity.js'), 'utf8')
  .replace(/export function /g, 'function ')
  + '\nmodule.exports={readShoppingQty,parseShoppingQty,incShoppingQty,decShoppingQty,toStoredShoppingQty,formatShoppingQty};';
const m = new module.constructor(); m._compile(code, 'shoppingQuantity.js');
const { readShoppingQty, parseShoppingQty, incShoppingQty, decShoppingQty, toStoredShoppingQty, formatShoppingQty } = m.exports;

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── Q-T01 : ligne legacy '1' lisible ──
ok('Q-T01 legacy string "1" → 1', readShoppingQty('1') === 1);
ok('Q-T01 legacy number 1 → 1', readShoppingQty(1) === 1);
ok('Q-T01 absent/null → 1 (une ligne = au moins 1)', readShoppingQty(null) === 1 && readShoppingQty(undefined) === 1);

// ── Q-T02 : nouvel item qty=1 par défaut, persistée en string ──
ok('Q-T02 défaut 1 stocké en string "1"', toStoredShoppingQty(1) === '1' && typeof toStoredShoppingQty(1) === 'string');

// ── Q-T03 : 1 → 3 explicite → 3 (et string "3") ──
ok('Q-T03 parse "3" → 3', parseShoppingQty('3') === 3);
ok('Q-T03 inc 1→2→3', incShoppingQty(incShoppingQty(1)) === 3);
ok('Q-T03 stored 3 → "3"', toStoredShoppingQty(3) === '3');

// ── Q-T04 : 3 → 1 → 1 (dec plancher 1) ──
ok('Q-T04 dec 3→2→1', decShoppingQty(decShoppingQty(3)) === 1);
ok('Q-T04 dec plancher : 1→1 (jamais 0)', decShoppingQty(1) === 1);
ok('Q-T04 parse "1" → 1', parseShoppingQty('1') === 1);

// ── Q-T05 : 0 / négatif / NaN / vide / décimal → JAMAIS une quantité valide persistable ──
ok('Q-T05 parse "0" → null', parseShoppingQty('0') === null);
ok('Q-T05 parse "-2" → null', parseShoppingQty('-2') === null);
ok('Q-T05 parse "" → null', parseShoppingQty('') === null);
ok('Q-T05 parse "  " → null', parseShoppingQty('   ') === null);
ok('Q-T05 parse "abc" → null', parseShoppingQty('abc') === null);
ok('Q-T05 parse "2.5" → null', parseShoppingQty('2.5') === null);
ok('Q-T05 parse NaN → null', parseShoppingQty(NaN) === null);
ok('Q-T05 parse 0 (number) → null', parseShoppingQty(0) === null);
ok('Q-T05 parse -3 (number) → null', parseShoppingQty(-3) === null);
// readShoppingQty ne fabrique jamais < 1 même sur entrée corrompue (affichage sûr)
ok('Q-T05 read "0" → 1 (affichage borné, jamais 0)', readShoppingQty('0') === 1);
ok('Q-T05 read "-5" → 1', readShoppingQty('-5') === 1);
ok('Q-T05 read "xyz" → 1', readShoppingQty('xyz') === 1);

// ── §13 : formes DB vérifiées — default '×1' + bare '1' + variantes ×/x + espaces ──
ok('DB "×1" (default) → read 1', readShoppingQty('×1') === 1);
ok('DB "×1" → parse 1', parseShoppingQty('×1') === 1);
ok('"×3" → read 3', readShoppingQty('×3') === 3);
ok('"×3" → parse 3', parseShoppingQty('×3') === 3);
ok('"x2" (x minuscule) → read 2 / parse 2', readShoppingQty('x2') === 2 && parseShoppingQty('x2') === 2);
ok('" ×2 " (espaces bornés) → read 2 / parse 2', readShoppingQty(' ×2 ') === 2 && parseShoppingQty(' ×2 ') === 2);
ok('"×0" → read 1 (borné) / parse null (rejeté)', readShoppingQty('×0') === 1 && parseShoppingQty('×0') === null);
ok('"1e3" (scientifique) → parse null', parseShoppingQty('1e3') === null);
ok('2.5 (number décimal) → parse null', parseShoppingQty(2.5) === null);
ok('"×-3" → parse null', parseShoppingQty('×-3') === null);

// ── Q-T06 : présentation NEUTRE, aucune unité physique inventée ──
ok('Q-T06 format 2 → "×2"', formatShoppingQty(2) === '×2');
ok('Q-T06 format 1 → "×1"', formatShoppingQty(1) === '×1');
ok('Q-T06 aucune unité physique dans le format', (() => {
  const outs = [formatShoppingQty(1), formatShoppingQty(2), formatShoppingQty(10)].join(' ').toLowerCase();
  return !/\b(kg|g|l|ml|cl|pi[eè]ce|pieces|unit[eé]|units|litre|gramme|pack)\b/.test(outs);
})());

// ── Q-T07 (contrat) : module PUR — ne peut écrire dans AUCUNE table (ni items, ni shopping_items) ──
ok('Q-T07 module pur : aucune écriture DB possible (pas de supabase/from/insert/update)', (() => {
  const src = fs.readFileSync(path.join(__dirname, 'shoppingQuantity.js'), 'utf8');
  return !/\bsupabase\b/.test(src) && !/\.from\(/.test(src)
      && !/\.insert\(/.test(src) && !/\.update\(/.test(src) && !/\.delete\(/.test(src);
})());

console.log(`\nshoppingQuantity: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
