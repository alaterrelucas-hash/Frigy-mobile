/**
 * N6-11 — Entitlement authority (CR-15/16/17). Script Node autonome :
 *   node src/utils/entitlement.test.js
 * Pur, sans SDK → compilé tel quel.
 */
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'entitlement.js'), 'utf8')
  .replace(/export const /g, 'const ').replace(/export function /g, 'function ')
  + '\nmodule.exports={ENTITLEMENT,isProStatus,isKnownFree,isEntitlementKnown,deriveEntitlementStatus,FEATURE_ACCESS,decideFeatureAccess,applyEntitlementOutcome};';
const m = new module.constructor(); m._compile(code, 'entitlement.js');
const { ENTITLEMENT: E, isProStatus, isKnownFree, isEntitlementKnown, deriveEntitlementStatus: D, FEATURE_ACCESS: FA, decideFeatureAccess: DFA, applyEntitlementOutcome: APPLY } = m.exports;

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── 4 états distincts ──
ok('ENTITLEMENT a 4 états distincts', new Set([E.UNKNOWN, E.FREE, E.PRO, E.ERROR]).size === 4);

// ── deriveEntitlementStatus : doctrine UNKNOWN≠FREE, ERROR≠FREE ──
ok('initial (loading) → UNKNOWN', D({ loading: true }) === E.UNKNOWN);
ok('error → ERROR (jamais FREE)', D({ error: true }) === E.ERROR);
ok('résolu sans pro actif → FREE', D({ customerInfo: { entitlements: { active: {} } } }) === E.FREE);
ok('résolu avec pro actif → PRO', D({ customerInfo: { entitlements: { active: { pro: {} } } } }) === E.PRO);
ok('pas de customerInfo → UNKNOWN (jamais FREE)', D({}) === E.UNKNOWN);
ok('customerInfo null → UNKNOWN (jamais FREE)', D({ customerInfo: null }) === E.UNKNOWN);
ok('loading prime sur error', D({ loading: true, error: true }) === E.UNKNOWN);
ok('entitlementId custom respecté', D({ customerInfo: { entitlements: { active: { premium: {} } } }, entitlementId: 'premium' }) === E.PRO);
ok('mauvais entitlementId → FREE (pas de faux PRO)', D({ customerInfo: { entitlements: { active: { premium: {} } } }, entitlementId: 'pro' }) === E.FREE);

// ── prédicats ──
ok('isProStatus seulement PRO', isProStatus(E.PRO) && !isProStatus(E.FREE) && !isProStatus(E.UNKNOWN) && !isProStatus(E.ERROR));
ok('isKnownFree seulement FREE', isKnownFree(E.FREE) && !isKnownFree(E.UNKNOWN) && !isKnownFree(E.ERROR) && !isKnownFree(E.PRO));
ok('isEntitlementKnown = FREE|PRO', isEntitlementKnown(E.FREE) && isEntitlementKnown(E.PRO) && !isEntitlementKnown(E.UNKNOWN) && !isEntitlementKnown(E.ERROR));

// ── decideFeatureAccess : jamais déverrouiller sous incertitude, jamais UNKNOWN=Free ──
ok('PRO → ALLOW', DFA(E.PRO) === FA.ALLOW);
ok('FREE → PAYWALL', DFA(E.FREE) === FA.PAYWALL);
ok('UNKNOWN → VERIFY (ni allow, ni paywall)', DFA(E.UNKNOWN) === FA.VERIFY);
ok('ERROR → RETRY (ni allow, ni paywall)', DFA(E.ERROR) === FA.RETRY);
ok('valeur inattendue → VERIFY (fail-safe, jamais ALLOW)', DFA('???') === FA.VERIFY);
ok('UNKNOWN ne déverrouille jamais', DFA(E.UNKNOWN) !== FA.ALLOW);
ok('ERROR ne déverrouille jamais', DFA(E.ERROR) !== FA.ALLOW);
ok('UNKNOWN n\'est jamais traité comme paywall (Free)', DFA(E.UNKNOWN) !== FA.PAYWALL);

// ── applyEntitlementOutcome (2.6) : succès autoritatif gagne ; échec PRÉSERVE l'autorité établie ──
ok('APPLY succès pro → PRO', APPLY({ previousStatus: E.UNKNOWN, outcome: 'pro' }) === E.PRO);
ok('APPLY succès free → FREE', APPLY({ previousStatus: E.UNKNOWN, outcome: 'free' }) === E.FREE);
ok('APPLY UNKNOWN + error → ERROR (aucune autorité établie)', APPLY({ previousStatus: E.UNKNOWN, outcome: 'error' }) === E.ERROR);
ok('APPLY ERROR + error → ERROR', APPLY({ previousStatus: E.ERROR, outcome: 'error' }) === E.ERROR);
ok('APPLY PRO + error → PRO (payant préservé, jamais downgrade)', APPLY({ previousStatus: E.PRO, outcome: 'error' }) === E.PRO);
ok('APPLY FREE + error → FREE (autorité préservée)', APPLY({ previousStatus: E.FREE, outcome: 'error' }) === E.FREE);
ok('APPLY PRO + free (nouvelle autorité) → FREE (succès gagne)', APPLY({ previousStatus: E.PRO, outcome: 'free' }) === E.FREE);
ok('APPLY FREE + pro (nouvelle autorité) → PRO', APPLY({ previousStatus: E.FREE, outcome: 'pro' }) === E.PRO);
ok('APPLY jamais de FREE fabriqué sur error', APPLY({ previousStatus: E.UNKNOWN, outcome: 'error' }) !== E.FREE);

console.log(`\nentitlement: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
