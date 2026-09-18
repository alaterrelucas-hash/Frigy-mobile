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

// ── V2 : comptage LIGNES par DÉCLARATION canonique, avec CHEVAUCHEMENT possible (un mixte compte 2×) ──
// used only (t,f) ; waste only (f,t) ; both (t,t) → compte dans les DEUX ; no cause (f,f) → aucun.
const rows = [
  { used_declared: true,  waste_declared: false }, // used
  { used_declared: true,  waste_declared: false }, // used
  { used_declared: false, waste_declared: true },  // waste
  { used_declared: true,  waste_declared: true },  // MIXTE → used ET waste
  { used_declared: false, waste_declared: false }, // aucune cause → ni l'un ni l'autre
];
const r = F(rows);
ok('used_declared → utilisations déclarées (x3 : 2 used + 1 mixte)', r.usedDeclaredCount === 3);
ok('waste_declared → gaspillages déclarés (x2 : 1 waste + 1 mixte)', r.wasteDeclaredCount === 2);
ok('§35 CHEVAUCHEMENT : les comptes NE somment PAS au total (3+2=5 ≠ 4 lignes causales / 5 lignes)', r.usedDeclaredCount + r.wasteDeclaredCount !== rows.length - 1);
ok('§35 (f,f) ne compte dans AUCUN', r.usedDeclaredCount === 3 && r.wasteDeclaredCount === 2); // la 5e ligne n'ajoute rien

// ── Aucune fabrication : entrées vides/absentes → 0, jamais NaN, jamais argent/CO₂ ──
const z = F([]);
ok('vide → tout à 0', z.usedDeclaredCount === 0 && z.wasteDeclaredCount === 0);
ok('args par défaut (aucun argument) → 0', (() => { const d = F(); return d.usedDeclaredCount === 0 && d.wasteDeclaredCount === 0; })());
ok('entrées non-tableau → 0 (fail-safe, jamais crash)', (() => { const n = F(null); return n.usedDeclaredCount === 0 && n.wasteDeclaredCount === 0; })());
ok('lignes nulles ignorées (pas de crash)', (() => { const n = F([null, { used_declared: true }, undefined]); return n.usedDeclaredCount === 1 && n.wasteDeclaredCount === 0; })());

// ── waste_declared=false ne prouve PAS l'absence de gaspillage — on ne lit QUE les déclarations true ──
ok('used non-déclaré (absent) → non compté (jamais inféré depuis wasted)', F([{ waste_declared: false }]).usedDeclaredCount === 0);

// ── quantité ne devient PAS une vérité d'unités : deux lignes = 2 lignes ──
ok('deux lignes = deux cohortes (jamais sommées en unités)', F([{ used_declared: true, quantity: 5 }, { used_declared: true, quantity: 3 }]).usedDeclaredCount === 2);

// ── CONTRAT DE SORTIE : exactement 2 clés GLOBALES ; AUCUNE clé hebdo/argent/CO₂/score/comparaison ──
const keys = Object.keys(F(rows)).sort();
ok('sortie = exactement 2 clés globales', JSON.stringify(keys) === JSON.stringify(['usedDeclaredCount', 'wasteDeclaredCount']));
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
