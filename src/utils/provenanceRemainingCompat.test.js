/**
 * PM-1 §19 — FORWARD-COMPAT de assertion_provenance.remaining. Test PUR :
 *   node src/utils/provenanceRemainingCompat.test.js
 * Prouve que l'introduction de la dimension `remaining` COEXISTE avec quantity/dateValue/dateType :
 * une correction ultérieure d'UNE dimension (merge top-level lossless) n'EFFACE JAMAIS `remaining`,
 * et réciproquement. Reproduit le pattern d'écriture réel (mergeAssertionProvenance / jsonb `||`).
 */
const { buildAssertionProvenance, mergeAssertionProvenance, withDateValueCorrection } = require('./captureProvenance');
const { remainingProvenancePatch, REMAINING_AUTHORITY } = require('./partialOutcome');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// Provenance de départ typique d'un item (Scan) : quantity/dateValue/dateType/captureMethod présents.
const base = buildAssertionProvenance({ captureMethod: 'BARCODE', quantityTouched: true, dateEnteredByUser: true, dateTypeChoice: 'DLC' });
ok('base contient quantity/dateValue/dateType/captureMethod',
  base.quantity && base.dateValue && base.dateType && base.captureMethod === 'BARCODE');

// 1) On écrit remaining (comme le fait le RPC via `||`, ici via le merge JS équivalent).
const afterRemaining = mergeAssertionProvenance(base, remainingProvenancePatch());
ok('remaining écrit = DIRECT', afterRemaining.remaining && afterRemaining.remaining.authority === REMAINING_AUTHORITY && REMAINING_AUTHORITY === 'DIRECT');
ok('écrire remaining PRÉSERVE quantity/dateValue/dateType',
  afterRemaining.quantity === base.quantity && afterRemaining.dateValue === base.dateValue && afterRemaining.dateType === base.dateType);

// 2) Puis l'utilisateur corrige la VALEUR de date (Stock edit) → remaining doit SURVIVRE.
const afterDateEdit = withDateValueCorrection(afterRemaining);
ok('corriger dateValue NE CLOBBE PAS remaining', afterDateEdit.remaining && afterDateEdit.remaining.authority === 'DIRECT');
ok('corriger dateValue met bien dateValue=DIRECT et garde quantity/dateType',
  afterDateEdit.dateValue.authority === 'DIRECT' && afterDateEdit.quantity === base.quantity && afterDateEdit.dateType === base.dateType);

// 3) Ordre inverse : dateValue corrigé d'abord, remaining ensuite → dateValue corrigé survit.
const dvFirst = withDateValueCorrection(base);
const thenRemaining = mergeAssertionProvenance(dvFirst, remainingProvenancePatch());
ok('remaining après correction dateValue : dateValue corrigé PRÉSERVÉ', thenRemaining.dateValue.authority === 'DIRECT' && thenRemaining.remaining.authority === 'DIRECT');

// 4) Legacy (provenance nulle) : écrire remaining ne fabrique aucune autre autorité.
const fromNull = mergeAssertionProvenance(null, remainingProvenancePatch());
ok('legacy null + remaining : version:1, remaining=DIRECT, aucune quantity/dateValue inventée',
  fromNull.version === 1 && fromNull.remaining.authority === 'DIRECT' && !fromNull.quantity && !fromNull.dateValue);

// 5) Clé future inconnue préservée (spread top-level) — forward-compat au-delà de remaining.
const withFuture = mergeAssertionProvenance({ version: 1, futureThing: { x: 1 } }, remainingProvenancePatch());
ok('clé inconnue (futureThing) préservée à côté de remaining', withFuture.futureThing && withFuture.futureThing.x === 1 && withFuture.remaining);

// 6) DÉFAUT §1 — clôture EMPTY doit RAFRAÎCHIR remaining.assertedAt (mirroir JS du merge jsonb `||` de la
//    branche EMPTY). Départ : item HALF asserté à un ANCIEN timestamp + quantity/dateValue/dateType présents.
const halfOld = mergeAssertionProvenance(base, { remaining: { authority: 'DIRECT', assertedAt: '2000-01-01T00:00:00.000Z' } });
ok('setup : remaining HALF avec ancien assertedAt', halfOld.remaining.assertedAt === '2000-01-01T00:00:00.000Z');
// USED + EMPTY : le RPC écrit remaining_level=EMPTY ET fusionne remaining{authority:DIRECT, assertedAt:now}.
const NOW = '2026-08-23T09:00:00.000Z';
const afterEmptyClose = mergeAssertionProvenance(halfOld, { remaining: { authority: 'DIRECT', assertedAt: NOW } });
ok('§1 EMPTY close : assertedAt RAFRAÎCHI (plus l’ancien HALF)', afterEmptyClose.remaining.assertedAt === NOW && afterEmptyClose.remaining.authority === 'DIRECT');
ok('§1 EMPTY close : quantity/dateValue/dateType/captureMethod PRÉSERVÉS',
  afterEmptyClose.quantity === base.quantity && afterEmptyClose.dateValue === base.dateValue
  && afterEmptyClose.dateType === base.dateType && afterEmptyClose.captureMethod === 'BARCODE');

console.log(`\nprovenanceRemainingCompat: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
