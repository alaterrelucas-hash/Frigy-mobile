/**
 * N6-10 — Profile Impact Truth (CR-11/12/13/14). Script Node autonome :
 *   node src/utils/profileStats.test.js
 * computeProfileStats est PURE et sans import → on la compile telle quelle.
 * N6-10 (2.6) : plus AUCUNE API hebdomadaire (updated_at ≠ instant d'événement) — comptes GLOBAUX only.
 */
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'profileStats.js'), 'utf8')
  .replace(/export function /g, 'function ')
  + '\nmodule.exports={computeProfileStats};';
const m = new module.constructor(); m._compile(code, 'profileStats.js');
const { computeProfileStats: F } = m.exports;

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── Comptage LIGNES : consommé & non gaspillé = enregistré ; consommé & gaspillé = gaspillage déclaré ──
const rows = [
  { wasted: false }, { wasted: false }, { wasted: true }, { wasted: false }, { wasted: true },
];
const r = F(rows);
ok('consommé & !wasted → une consommation enregistrée (x3)', r.recordedConsumptions === 3);
ok('wasted → un gaspillage déclaré (x2)', r.declaredWaste === 2);

// ── Aucune fabrication : entrées vides/absentes → 0, jamais NaN, jamais négatif, jamais argent/CO₂ ──
const z = F([]);
ok('vide → tout à 0', z.recordedConsumptions === 0 && z.declaredWaste === 0);
ok('args par défaut (aucun argument) → 0', (() => { const d = F(); return d.recordedConsumptions === 0 && d.declaredWaste === 0; })());
ok('entrées non-tableau → 0 (fail-safe, jamais crash)', (() => { const n = F(null); return n.recordedConsumptions === 0 && n.declaredWaste === 0; })());
ok('lignes nulles ignorées (pas de crash)', (() => { const n = F([null, { wasted: false }, undefined]); return n.recordedConsumptions === 1 && n.declaredWaste === 0; })());

// ── quantité ne devient PAS une vérité de comptage d'unités : deux lignes même identité = 2 lignes ──
ok('deux lignes = deux cohortes (jamais sommées en unités)', F([{ wasted: false, quantity: 5 }, { wasted: false, quantity: 3 }]).recordedConsumptions === 2);

// ── CONTRAT DE SORTIE : exactement 2 clés GLOBALES ; AUCUNE clé hebdo/argent/CO₂/score/comparaison ──
const keys = Object.keys(F(rows)).sort();
ok('sortie = exactement 2 clés globales', JSON.stringify(keys) === JSON.stringify(['declaredWaste', 'recordedConsumptions']));
const forbidden = ['week', 'savings', 'saved', 'money', 'euro', 'price', 'co2', 'score', 'grade', 'comparison', 'rate'];
ok('AUCUNE clé hebdo/monétaire/CO₂/score/comparaison dans la sortie',
  !keys.some(k => forbidden.some(f => k.toLowerCase().includes(f))));

// ── SOURCE : le module lui-même n'invente rien (ni prix, ni ×constante, ni moyenne, ni sémantique hebdo) ──
const raw = fs.readFileSync(path.join(__dirname, 'profileStats.js'), 'utf8');
const rawNoComments = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok('SRC profileStats ne lit jamais price', !/\bprice\b/.test(rawNoComments));
ok('SRC profileStats sans constante monétaire (2.5) ni CO₂ (0.75) ni moyenne (0.20)',
  !/2\.5/.test(rawNoComments) && !/0\.75/.test(rawNoComments) && !/0\.20|0\.2\b/.test(rawNoComments));
ok('SRC profileStats sans sémantique hebdo (week/updated_at)',
  !/week/i.test(rawNoComments) && !/updated_at/.test(rawNoComments));

console.log(`\nprofileStats: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
