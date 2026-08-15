/**
 * N6-07 — Quantity / Cohort Truth. Script Node autonome :
 *   node src/utils/quantityAuthority.test.js
 *
 * Contrat pur (deriveQuantityState / formatQuantityLabel) + verrous source :
 *   - un numéro technique n'est pas une quantité → autorité UNKNOWN, label null ;
 *   - UNKNOWN ≠ zéro ≠ un ≠ absence (la cohorte reste représentée) ;
 *   - pas d'agrégation cross-lignes (deux cohortes jamais sommées) ;
 *   - display Stock ne rend plus « 1 unité » / « N/M restants » non prouvés ;
 *   - causalité (consumed/wasted) UNIQUEMENT via actions explicites (CR-07).
 * Commentaires strippés avant scan source (évite les faux positifs — cf. stockLabels/recipeWording).
 */
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'quantity.js'), 'utf8')
  .replace(/export const /g, 'const ').replace(/export function /g, 'function ')
  + '\nmodule.exports={QUANTITY_AUTHORITY,deriveQuantityState,formatQuantityLabel};';
const m = new module.constructor(); m._compile(code, 'quantity.js');
const { QUANTITY_AUTHORITY: QA, deriveQuantityState: D, formatQuantityLabel: F } = m.exports;

const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const fridge = stripC(fs.readFileSync(path.join(__dirname, '../screens/FridgeScreen.js'), 'utf8'));
const qtySrc = fs.readFileSync(path.join(__dirname, 'quantity.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── QUANTITY AUTHORITY (numéro technique ≠ assertion) ──
ok('QTY-T01 quantity=1 → UNKNOWN + label null', D({ quantity: 1 }).authority === QA.UNKNOWN && F({ quantity: 1 }) === null);
ok('QTY-T02 total_units=3 → UNKNOWN + label null', D({ quantity: 2, total_units: 3 }).authority === QA.UNKNOWN && F({ quantity: 2, total_units: 3 }) === null);
ok('QTY-T03 défaut-un (aucun champ) → UNKNOWN', D({}).authority === QA.UNKNOWN && F({}) === null);
ok('QTY-T04 UNKNOWN → cohorte représentée (subject)', D({ quantity: 1 }).subject === 'REPRESENTED_COHORT');
ok('QTY-T05 UNKNOWN → aucun x1 / compte exact affiché', F({ quantity: 1 }) === null && F({ quantity: 5, total_units: 5 }) === null);
ok('QTY-T06 UNKNOWN jamais coerce à 0', D({ quantity: 0 }).units === null && F({ quantity: 0 }) === null);
ok('QTY-T06b UNKNOWN jamais un « 1 » inventé (units null)', D({ total_units: 1 }).units === null);
ok('QTY-T07 aucune autorité KNOWN fabriquée (toutes entrées → UNKNOWN)',
  [{}, { quantity: 1 }, { quantity: 3, total_units: 3 }, { unit: 'g', quantity: 200 }, { total_units: 6, quantity: 6 }].every((it) => D(it).authority === QA.UNKNOWN));
ok('QTY malformé → pas de crash, UNKNOWN/null', D(null).authority === QA.UNKNOWN && F(null) === null && F(undefined) === null);

// ── COHORT : pas d'agrégation cross-lignes ──
ok('COH-T01 deux cohortes même identité indépendantes (jamais sommées)',
  F({ name: 'oeuf', quantity: 1 }) === null && F({ name: 'oeuf', quantity: 1 }) === null);
ok('COH source : quantity.js sans reduce/sum/groupBy', !/reduce\(|\.sum|groupBy/.test(qtySrc));

// ── DISPLAY SUPPRESSION (source Stock) ──
ok('DISP FridgeScreen : plus de « 1 unité » littéral actif', !fridge.includes('1 unité'));
ok('DISP FridgeScreen : plus de « N/M restants » (total_units interpolé)', !fridge.includes('total_units'));
ok('DISP FridgeScreen : quantité gatée par formatQuantityLabel + garde', fridge.includes('formatQuantityLabel(item)') && fridge.includes('quantityLabel &&'));

// ── CAUSALITÉ (CR-07) : consumed/wasted UNIQUEMENT via action explicite ──
ok('CAUSE-T01 action explicite consommation présente (« J\'ai mangé ça »)', fridge.includes("J'ai mangé ça"));
ok('CAUSE-T02 action explicite gaspillage présente (« Gaspillé »)', fridge.includes('Gaspillé'));
ok('CAUSE-T03 écriture consumed/wasted groupée (consumeItem explicite)', fridge.includes('consumed: true, wasted'));
ok('CAUSE-T04 transition zéro exige confirmation explicite (« Consommé ✅ »)', fridge.includes('Consommé ✅'));
ok('TOTAL-T01 aucune arithmétique causale total_units - quantity', !/total_units\s*-/.test(fridge));

// ── N6-08 : provenance forward → une quantité EXPLICITE devient KNOWN (survit au roundtrip JSON) ──
const rt = (it) => JSON.parse(JSON.stringify(it)); // sérialisation ≈ persistance JSONB
const asserted = { quantity: 3, assertion_provenance: { quantity: { authority: 'DIRECT' } } };
ok('N6-08 FQ-T04 quantité explicite (DIRECT) → KNOWN 3', D(rt(asserted)).authority === QA.KNOWN && D(rt(asserted)).units === 3);
ok('N6-08 label KNOWN → « 3 unités »', F(rt(asserted)) === '3 unités');
ok('N6-08 CONFIRMED aussi → KNOWN', D({ quantity: 2, assertion_provenance: { quantity: { authority: 'CONFIRMED' } } }).authority === QA.KNOWN);
ok('N6-08 FQ-T01 défaut (provenance UNKNOWN) → UNKNOWN', D({ quantity: 1, assertion_provenance: { quantity: { authority: 'UNKNOWN' } } }).authority === QA.UNKNOWN);
ok('N6-08 LEG-T01 legacy (aucune provenance) → UNKNOWN', D({ quantity: 3 }).authority === QA.UNKNOWN);
ok('N6-08 KNOWN exige quantité positive valide', D({ quantity: 0, assertion_provenance: { quantity: { authority: 'DIRECT' } } }).authority === QA.UNKNOWN);
// NC : ignorer la provenance après une assertion explicite ferait échouer KNOWN (contrôle négatif)
ok('N6-08 NC : sans provenance la même ligne retombe UNKNOWN', D({ quantity: 3 }).authority === QA.UNKNOWN && D(rt(asserted)).authority === QA.KNOWN);

console.log(`\nquantityAuthority: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
