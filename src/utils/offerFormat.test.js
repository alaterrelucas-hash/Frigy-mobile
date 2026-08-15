/**
 * N6-11 — Offer truth (CR-16). Script Node autonome :
 *   node src/utils/offerFormat.test.js
 * Pur → compilé tel quel. Prouve : prix/période dérivent UNIQUEMENT de l'objet StoreProduct réel,
 * jamais de valeur en dur ; résolution partielle sûre ; aucun essai/réduction.
 */
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'offerFormat.js'), 'utf8')
  .replace(/export function /g, 'function ')
  + '\nmodule.exports={formatSubscriptionPeriod,toPlan,buildPlans};';
const m = new module.constructor(); m._compile(code, 'offerFormat.js');
const { formatSubscriptionPeriod: F, toPlan, buildPlans } = m.exports;

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── Période ISO 8601 → FR ──
ok('P1M → /mois', F('P1M') === '/mois');
ok('P1Y → /an', F('P1Y') === '/an');
ok('P3M → /3 mois', F('P3M') === '/3 mois');
ok('P1W → /semaine', F('P1W') === '/semaine');
ok('null → null (silence)', F(null) === null);
ok('vide/inconnu → null', F('') === null && F('XYZ') === null && F(undefined) === null);

// ── toPlan : conserve l'objet EXACT, dérive du priceString réel ; null si pas de prix authentique ──
const annual = { identifier: 'frigy_pro_annual', priceString: '24,99 €', subscriptionPeriod: 'P1Y', pricePerMonthString: '2,08 €' };
const p = toPlan(annual);
ok('toPlan conserve storeProduct EXACT', p.storeProduct === annual);
ok('toPlan localizedPrice = priceString réel', p.localizedPrice === '24,99 €');
ok('toPlan periodLabel dérivé', p.periodLabel === '/an');
ok('toPlan perMonthLabel = pricePerMonthString réel', p.perMonthLabel === '2,08 €');
ok('toPlan id = identifier produit', p.id === 'frigy_pro_annual');
ok('toPlan sans priceString → null (jamais de plan sans prix réel)', toPlan({ identifier: 'x', subscriptionPeriod: 'P1M' }) === null);
ok('toPlan priceString vide → null', toPlan({ identifier: 'x', priceString: '' }) === null);
ok('toPlan null/undefined → null', toPlan(null) === null && toPlan(undefined) === null);
ok('toPlan sans pricePerMonthString → perMonthLabel null (pas inventé)', toPlan({ identifier: 'm', priceString: '2,99 €', subscriptionPeriod: 'P1M' }).perMonthLabel === null);

// ── buildPlans : résolution partielle (0/1/2), ordre demandé, jamais fabriquer ──
const monthly = { identifier: 'frigy_pro_monthly', priceString: '2,99 €', subscriptionPeriod: 'P1M' };
const IDS = ['frigy_pro_monthly', 'frigy_pro_annual'];
ok('0 produit → aucun plan', buildPlans([], IDS).length === 0);
ok('mensuel seul → 1 plan mensuel', (() => { const r = buildPlans([monthly], IDS); return r.length === 1 && r[0].id === 'frigy_pro_monthly'; })());
ok('annuel seul → 1 plan annuel', (() => { const r = buildPlans([annual], IDS); return r.length === 1 && r[0].id === 'frigy_pro_annual'; })());
ok('les deux → 2 plans dans l\'ordre demandé', (() => { const r = buildPlans([annual, monthly], IDS); return r.length === 2 && r[0].id === 'frigy_pro_monthly' && r[1].id === 'frigy_pro_annual'; })());
ok('produit sans prix filtré (jamais de plan vide)', buildPlans([{ identifier: 'frigy_pro_monthly' }], IDS).length === 0);
ok('entrée non-tableau → aucun plan (fail-safe)', buildPlans(null, IDS).length === 0);
ok('jamais de plan fabriqué (uniquement les IDs résolus)', buildPlans([monthly], IDS).every(pl => pl.storeProduct === monthly));

// ── SOURCE : aucun montant/essai/réduction en dur dans le module ──
const raw = fs.readFileSync(path.join(__dirname, 'offerFormat.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok('SRC aucun montant € en dur', !/\d[.,]\d\d\s*€/.test(raw) && !/€/.test(raw.replace(/'\/[^']*'/g, '')));
ok('SRC aucun essai/trial/introPrice rendu', !/trial/i.test(raw) && !/introprice/i.test(raw) && !/essai/i.test(raw));
ok('SRC aucune réduction/discount', !/discount/i.test(raw) && !/-?\d+\s*%/.test(raw));

console.log(`\nofferFormat: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
