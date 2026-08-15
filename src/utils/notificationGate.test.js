/**
 * Tests N6-03 — Notification Truth Gate (logique pure), incluant le patch terminal
 * DATE-TYPE (R-01) / RECIPE-HINT (R-02).
 * Script Node autonome :  node src/utils/notificationGate.test.js
 * `deriveTemporalState` est STUBBÉ (chaque item porte `_state`) → on teste le GATE.
 *
 * Deux étages :
 *   selectTemporallyEligible = Présence + autorité DATE + fenêtre  (logique temporelle)
 *   selectExpiryPushes       = temporellement éligible ∩ TYPE de date autorisant l'interruption
 * Aujourd'hui aucun type n'autorise (PUSH_AUTHORIZING_DATE_TYPES vide) → selectExpiryPushes = [].
 */
const fs = require('fs');
const path = require('path');

function load(file, transforms) {
  let code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  code = (transforms ? transforms(code) : code)
    .replace(/export async function /g, 'async function ')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ');
  const m = new module.constructor();
  m._compile(code, file);
  return m.exports;
}

const gate = load('notificationGate.js', (c) =>
  c.replace(/import \{[^}]*\} from '\.\/temporalAuthority';/,
      "const TEMPORAL_AUTHORITY={DATE:'date',HEURISTIC:'heuristic',NONE:'none'};"
    + "const deriveTemporalState=(item)=>item._state||{authority:'none',daysRemaining:null,dateType:'unknown'};")
   + '\nmodule.exports={selectTemporallyEligible,selectExpiryPushes,buildNeutralPushContent,'
   + 'isActivePresence,pushAuthorizedByDateType,PUSH_AUTHORIZING_DATE_TYPES,PUSH_WINDOW_DAYS,PUSH_MAX};');

const {
  selectTemporallyEligible, selectExpiryPushes, buildNeutralPushContent,
  isActivePresence, pushAuthorizedByDateType, PUSH_AUTHORIZING_DATE_TYPES, PUSH_MAX,
} = gate;

// États stub (dateType 'unknown' = seul type produit aujourd'hui).
const DATE = (d) => ({ authority: 'date', daysRemaining: d, dateType: 'unknown' });
const HEUR = (d) => ({ authority: 'heuristic', daysRemaining: d, dateType: 'unknown' });
const NONE = { authority: 'none', daysRemaining: null, dateType: 'unknown' };

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };
const ids = (list) => list.map(x => x.item.id).join(',');

// ═══ ÉTAGE TEMPOREL — selectTemporallyEligible ═══

// ── 1. Autorité : SEULE DATE ──
ok('DATE dans fenêtre → temporellement éligible',
  ids(selectTemporallyEligible([{ id: 'a', name: 'X', _state: DATE(2) }])) === 'a');
ok('HEURISTIC (ouverture) → jamais',
  selectTemporallyEligible([{ id: 'a', _state: HEUR(1) }]).length === 0);
ok('NONE → jamais',
  selectTemporallyEligible([{ id: 'a', _state: NONE }]).length === 0);

// ── 2. Fenêtre [0,3] ──
ok('d=0 → éligible', ids(selectTemporallyEligible([{ id: 'a', _state: DATE(0) }])) === 'a');
ok('d=3 (borne) → éligible', ids(selectTemporallyEligible([{ id: 'a', _state: DATE(3) }])) === 'a');
ok('d=4 → exclu', selectTemporallyEligible([{ id: 'a', _state: DATE(4) }]).length === 0);
ok('d=-1 (dépassé) → exclu', selectTemporallyEligible([{ id: 'a', _state: DATE(-1) }]).length === 0);

// ── 3. Présence (consumed/wasted), jamais quantity ──
ok('consumed → exclu', selectTemporallyEligible([{ id: 'a', consumed: true, _state: DATE(1) }]).length === 0);
ok('wasted → exclu', selectTemporallyEligible([{ id: 'a', wasted: true, _state: DATE(1) }]).length === 0);
ok('quantity=0 actif + DATE → éligible (Présence ≠ quantité)',
  ids(selectTemporallyEligible([{ id: 'a', quantity: 0, _state: DATE(1) }])) === 'a');
ok('isActivePresence(consumed) false', isActivePresence({ consumed: true }) === false);
ok('isActivePresence(actif) true', isActivePresence({ name: 'X' }) === true);

// ── 4. Préférences ──
ok('pushEnabled=false → []', selectTemporallyEligible([{ id: 'a', _state: DATE(1) }], { pushEnabled: false }).length === 0);
ok('expirationAlerts=false → []', selectTemporallyEligible([{ id: 'a', _state: DATE(1) }], { expirationAlerts: false }).length === 0);
ok('dayBeforeReminder=false → J-1 sauté', selectTemporallyEligible([{ id: 'a', _state: DATE(1) }], { dayBeforeReminder: false }).length === 0);
ok('dayBeforeReminder=false → J-2 conservé', ids(selectTemporallyEligible([{ id: 'a', _state: DATE(2) }], { dayBeforeReminder: false })) === 'a');

// ── 5. Recette ne crée pas d'éligibilité (DA-07) ──
ok('NONE + « recette parfaite » → exclu', selectTemporallyEligible([{ id: 'a', recipeMatch: 'perfect', _state: NONE }]).length === 0);

// ── 6. Tri + limite ──
const many = [
  { id: 'a', _state: DATE(3) }, { id: 'b', _state: DATE(0) }, { id: 'c', _state: DATE(2) },
  { id: 'd', _state: DATE(1) }, { id: 'e', _state: DATE(3) }, { id: 'f', _state: DATE(2) },
  { id: 'g', _state: DATE(0) },
];
const elig = selectTemporallyEligible(many);
ok('trié croissant', ids(elig) === 'b,g,d,c,f,a'.split(',').slice(0, PUSH_MAX).join(','));
ok('borné à PUSH_MAX', elig.length === PUSH_MAX);

// ═══ ÉTAGE TYPE DE DATE — R-01 : selectExpiryPushes ═══

ok('PUSH_AUTHORIZING_DATE_TYPES est VIDE (aucun type n\'autorise aujourd\'hui)', PUSH_AUTHORIZING_DATE_TYPES.size === 0);
ok('pushAuthorizedByDateType(unknown) === false', pushAuthorizedByDateType({ dateType: 'unknown' }) === false);
ok('pushAuthorizedByDateType(null) === false', pushAuthorizedByDateType(null) === false);

// Item PARFAIT temporellement (actif, DATE, d=1) mais type inconnu → AUCUN push (silence valide).
ok('DATE+unknown parfait → 0 push (R-01)', selectExpiryPushes([{ id: 'a', _state: DATE(1) }]).length === 0);
// Le gate de type est le bloqueur courant : temporellement éligible ≠ vide, mais push = vide.
ok('temporellement éligible non vide…', selectTemporallyEligible(many).length > 0);
ok('…mais selectExpiryPushes vide (type gate)', selectExpiryPushes(many).length === 0);
// Aucun assemblage de conditions ne produit un push tant que le type n'est pas autorisé.
ok('DATE d=0 actif → 0 push', selectExpiryPushes([{ id: 'a', _state: DATE(0) }]).length === 0);

// ═══ WORDING — R-01 (pas « expire »/butoir) + R-02 (pas de revendication recette) ═══
const content = buildNeutralPushContent({ emoji: '🥛', name: 'Lait' });
ok('titre = emoji + nom', content.title === '🥛 Lait');
ok('titre sans « expire »', !/expire/i.test(content.title));
ok('corps sans « expire »', !/expire/i.test(content.body));
ok('corps = « À utiliser bientôt. » exact', content.body === 'À utiliser bientôt.');
ok('corps SANS revendication recette (R-02)', !/recette/i.test(content.body));
ok('corps sans emoji chef', !/👨‍🍳/.test(content.body));

console.log(`\nnotificationGate: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
