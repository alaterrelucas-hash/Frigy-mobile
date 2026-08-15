/**
 * N6-09 — Cap Enforcement Truth (CR-18). Script Node autonome :
 *   node src/utils/capEnforcement.test.js
 * Décision de cap PURE (matrice) + verrous SOURCE (les 4 writers de création passent par la même
 * décision, refus receipt ATOMIC avant `.insert`, aucun état ticket effacé par le refus).
 */
const fs = require('fs');
const path = require('path');

// capEnforcement importe FREE_ITEMS_LIMIT de config/purchases (qui importe react-native) → on
// neutralise l'import et on injecte la vraie valeur 20 pour tester la décision pure.
const code = fs.readFileSync(path.join(__dirname, 'capEnforcement.js'), 'utf8')
  .replace(/import \{ FREE_ITEMS_LIMIT \} from '\.\.\/config\/purchases';/, 'const FREE_ITEMS_LIMIT = 20;')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')
  + '\nmodule.exports={canAddItems,decideAddItems,CAP_DECISION};';
const m = new module.constructor(); m._compile(code, 'capEnforcement.js');
const { canAddItems: C, decideAddItems: D, CAP_DECISION: R } = m.exports;

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── FREE (limite 20) ──
ok('Free 0 + 1 → allow', C(0, 1, false) === true);
ok('Free 18 + 2 → allow (=20)', C(18, 2, false) === true);
ok('Free 19 + 1 → allow (=20)', C(19, 1, false) === true);
ok('Free 19 + 2 → deny (21)', C(19, 2, false) === false);
ok('Free 19 + 5 → deny (batch atomique)', C(19, 5, false) === false);
ok('Free 20 + 1 → deny', C(20, 1, false) === false);
ok('Free 20 + 10 → deny', C(20, 10, false) === false);
ok('Free 25 + 1 → deny (historique > cap)', C(25, 1, false) === false);
ok('Free 20 + 0 → deny (rien à ajouter)', C(20, 0, false) === false);

// ── PRO (illimité) ──
ok('Pro 20 + 1 → allow', C(20, 1, true) === true);
ok('Pro 25 + 10 → allow', C(25, 10, true) === true);
ok('Pro 0 + 5 → allow', C(0, 5, true) === true);

// ── BORNES / ENTRÉES INVALIDES (jamais de bypass) ──
ok('Free addCount 0 → deny', C(10, 0, false) === false);
ok('Free addCount négatif → deny (pas de bypass)', C(25, -10, false) === false);
ok('Free addCount négatif même sous cap → deny', C(10, -1, false) === false);
ok('Free activeCount NaN → deny (compte invalide, UNKNOWN ≠ ZERO)', C(NaN, 1, false) === false);
ok('Free addCount NaN → deny', C(10, NaN, false) === false);
ok('Free activeCount négatif → deny (jamais clampé à 0)', C(-5, 1, false) === false);
ok('Free activeCount undefined → deny', C(undefined, 1, false) === false);
ok('Free frontière exacte 20 (19+1 allow, 20+1 deny)', C(19, 1, false) === true && C(20, 1, false) === false);
ok('limite explicite override (limit=5 : 5+1 deny)', C(5, 1, false, 5) === false && C(4, 1, false, 5) === true);
ok('défaut addCount=1 (Free 19) → allow', C(19, undefined, false) === true);

// ── SOURCE : couverture des 4 writers via la décision centrale + receipt atomic-reject AVANT insert ──
const scan = fs.readFileSync(path.join(__dirname, '../screens/ScanScreen.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../../App.js'), 'utf8');
ok('WRITER addProduct passe par capBlocked', scan.includes('if (capBlocked(1)) return;'));
ok('WRITER receipt + photo passent par capBlocked(toSave.length) (2 writers)', (scan.match(/if \(capBlocked\(toSave\.length\)\) return;/g) || []).length >= 2);
ok('WRITER Home « Je l\'ai » (App.js) passe par decideAddItems', app.includes('decideAddItems({ isPro, countReady'));
ok('COVER aucune logique cap indépendante (>= FREE_ITEMS_LIMIT) ne survit', !scan.includes('>= FREE_ITEMS_LIMIT') && !app.includes('>= FREE_ITEMS_LIMIT'));

// Receipt : la décision (capBlocked) est AVANT `.insert(rows)` ET avant `setReceiptSaving(true)` →
// refus atomique sans écriture ni état saving à réinitialiser.
const rIdxGuard = scan.indexOf('if (capBlocked(toSave.length)) return;'); // 1re occurrence = receipt
const rIdxInsert = scan.indexOf("from('items').insert(rows)");           // 1er insert batch = receipt
const rIdxSaving = scan.indexOf('setReceiptSaving(true)');
ok('RECEIPT-T guard AVANT le 1er insert(rows)', rIdxGuard > 0 && rIdxInsert > 0 && rIdxGuard < rIdxInsert);
ok('RECEIPT-T guard AVANT setReceiptSaving(true)', rIdxGuard > 0 && rIdxSaving > 0 && rIdxGuard < rIdxSaving);
// Le helper central capBlocked n'efface JAMAIS l'état ticket (ni receiptData, ni sélection, ni saving)
// → un refus (limite OU compte inconnu) préserve le parsing/sélection ; aucun re-scan requis.
const capHelper = (scan.match(/const capBlocked = \(addCount\) => \{[\s\S]*?\n  \};/) || [''])[0];
ok('RECEIPT-T refus préserve l\'état ticket (capBlocked ne touche pas receiptData/sélection/saving)',
  !!capHelper && !capHelper.includes('setReceiptData') && !capHelper.includes('setReceiptSelectedIds') && !capHelper.includes('setReceiptSaving'));

// ── N6-09 Phase 2.6 : decideAddItems — 3 issues (ALLOW / DENY_CAP / DENY_COUNT_UNAVAILABLE) ──
const dec = (o) => D(o);
ok('DEC Free compte inconnu + add1 → count-unavailable', dec({ isPro: false, countReady: false, activeCount: 0, addCount: 1 }).reason === R.DENY_COUNT_UNAVAILABLE);
ok('DEC Free compte inconnu = PAS un refus limite (pas de paywall)', dec({ isPro: false, countReady: false, activeCount: 0, addCount: 1 }).reason !== R.DENY_CAP);
ok('DEC Free known 0 + add1 → allow', dec({ isPro: false, countReady: true, activeCount: 0, addCount: 1 }).allowed === true);
ok('DEC Free known 19 + add1 → allow', dec({ isPro: false, countReady: true, activeCount: 19, addCount: 1 }).allowed === true);
ok('DEC Free known 20 + add1 → DENY_CAP', dec({ isPro: false, countReady: true, activeCount: 20, addCount: 1 }).reason === R.DENY_CAP);
ok('DEC Free unknown + receipt5 → count-unavailable', dec({ isPro: false, countReady: false, activeCount: 0, addCount: 5 }).reason === R.DENY_COUNT_UNAVAILABLE);
ok('DEC Free known 19 + receipt5 → DENY_CAP (lot atomique)', dec({ isPro: false, countReady: true, activeCount: 19, addCount: 5 }).reason === R.DENY_CAP);
// Pro : jamais bloqué par la lisibilité du compte
ok('DEC Pro compte inconnu + add1 → ALLOW', dec({ isPro: true, countReady: false, activeCount: 0, addCount: 1 }).allowed === true);
ok('DEC Pro compte inconnu + receipt5 → ALLOW', dec({ isPro: true, countReady: false, activeCount: 999, addCount: 5 }).allowed === true);
ok('DEC add<=0 → refus (jamais de bypass) même Pro connu', dec({ isPro: false, countReady: true, activeCount: 10, addCount: 0 }).allowed === false);
// N6-09 2.7 : compte INVALIDE malgré countReady → fail-closed count-unavailable (jamais zéro fabriqué)
ok('DEC Free countReady + NaN activeCount → count-unavailable', dec({ isPro: false, countReady: true, activeCount: NaN, addCount: 1 }).reason === R.DENY_COUNT_UNAVAILABLE);
ok('DEC Free countReady + négatif → count-unavailable', dec({ isPro: false, countReady: true, activeCount: -3, addCount: 1 }).reason === R.DENY_COUNT_UNAVAILABLE);
ok('DEC Free countReady + undefined → count-unavailable', dec({ isPro: false, countReady: true, activeCount: undefined, addCount: 1 }).reason === R.DENY_COUNT_UNAVAILABLE);
ok('DEC Free countReady + vrai 0 → allow (0 légitime préservé)', dec({ isPro: false, countReady: true, activeCount: 0, addCount: 1 }).allowed === true);
ok('DEC Pro + compte invalide (NaN) + add1 → ALLOW (Pro jamais dépendant du compte)', dec({ isPro: true, countReady: true, activeCount: NaN, addCount: 1 }).allowed === true);

// ── SOURCE : hydratation SCOPÉE FAMILLE (App.js) — UNKNOWN ≠ ZERO, garde anti-périmé, échec ≠ zéro ──
ok('HYDR App.js état hydratedFamilyId présent', app.includes('hydratedFamilyId'));
ok('HYDR readiness = hydratedFamilyId === familyId (scopé famille)', app.includes('hydratedFamilyId === familyId'));
ok('HYDR fetch marque prêt UNIQUEMENT après succès (setHydratedFamilyId(famId))', app.includes('setHydratedFamilyId(famId)'));
ok('HYDR échec fetch → PAS prêt (garde error/!data avant setHydratedFamilyId)',
  app.indexOf('if (error || !data) return;') > 0 && app.indexOf('if (error || !data) return;') < app.indexOf('setHydratedFamilyId(famId)'));
ok('HYDR garde anti-réponse-périmée (jeton dernière requête)', app.includes('fetchReqRef.current !== reqId'));
ok('HYDR sign-out invalide la lisibilité (setHydratedFamilyId(null))', app.includes('setHydratedFamilyId(null)'));
ok('HYDR countReady passé à ScanScreen', app.includes('countReady={familyId != null && hydratedFamilyId === familyId}'));

// ── SOURCE : compte inconnu → feedback NEUTRE, jamais paywall ; les 4 writers passent par la décision ──
ok('FEEDBACK count-unavailable → Alert neutre chargement (ScanScreen)', scan.includes('Stock en cours de chargement'));
ok('FEEDBACK count-unavailable → Alert neutre chargement (App/Home Have)', app.includes('Stock en cours de chargement'));
ok('FEEDBACK count-unavailable NE mène PAS au paywall (mapping raison distinct)',
  scan.includes('CAP_DECISION.DENY_COUNT_UNAVAILABLE') && scan.includes('else onPaywall?.();'));
ok('WRITER-2.6 receipt via capBlocked(toSave.length)', scan.includes('if (capBlocked(toSave.length)) return;'));
ok('WRITER-2.6 addProduct via capBlocked(1)', scan.includes('if (capBlocked(1)) return;'));
ok('WRITER-2.6 handleConfirmHave via decideAddItems + countReady', app.includes('decideAddItems({ isPro, countReady, activeCount: items?.length ?? 0, addCount: 1 })'));

console.log(`\ncapEnforcement: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
