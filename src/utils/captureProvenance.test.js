/**
 * N6-08 — Forward provenance (captureProvenance). Script Node autonome :
 *   node src/utils/captureProvenance.test.js
 * Teste le BUILDER (état d'interaction → provenance persistable) + les READERS, et prouve que la
 * provenance survit une sérialisation JSON (niveau UNIT SERIALIZATION — pas de DB locale ici).
 */
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, 'captureProvenance.js'), 'utf8')
  .replace(/export const /g, 'const ').replace(/export function /g, 'function ')
  + '\nmodule.exports={CAPTURE_METHOD,PROV_AUTHORITY,PROV_DATE_TYPE,buildAssertionProvenance,mergeAssertionProvenance,withDateValueCorrection,quantityAssertedKnown,dateValueIsNonAuthoritative,explicitDateType};';
const m = new module.constructor(); m._compile(code, 'captureProvenance.js');
const { buildAssertionProvenance: B, mergeAssertionProvenance: MERGE, withDateValueCorrection: WDC, quantityAssertedKnown: Q, dateValueIsNonAuthoritative: DNA, explicitDateType: EDT } = m.exports;

let pass = 0, fail = 0;
const ok = (l, c) => { if (c) pass++; else { fail++; console.log('FAIL ' + l); } };
const roundtrip = (item) => JSON.parse(JSON.stringify(item)); // sérialisation ≈ persistance JSONB

// ── BUILDER ──
ok('quantité touchée → DIRECT', B({ quantityTouched: true }).quantity.authority === 'DIRECT');
ok('quantité non touchée → UNKNOWN', B({ quantityTouched: false }).quantity.authority === 'UNKNOWN');
ok('date saisie utilisateur → DIRECT', B({ dateEnteredByUser: true }).dateValue.authority === 'DIRECT');
ok('date machine non confirmée → DERIVED', B({ dateFromMachine: true }).dateValue.authority === 'DERIVED');
ok('pas de date → UNKNOWN', B({}).dateValue.authority === 'UNKNOWN');
ok('type DLC explicite → value DLC + DIRECT', B({ dateTypeChoice: 'DLC' }).dateType.value === 'DLC' && B({ dateTypeChoice: 'DLC' }).dateType.authority === 'DIRECT');
ok('type DDM explicite → value DDM', B({ dateTypeChoice: 'DDM' }).dateType.value === 'DDM');
ok('type non choisi → UNKNOWN', B({}).dateType.value === 'UNKNOWN' && B({}).dateType.authority === 'UNKNOWN');
ok('type bidon ignoré → UNKNOWN', B({ dateTypeChoice: 'PEREMPTION' }).dateType.value === 'UNKNOWN');
ok('lignée capture conservée', B({ captureMethod: 'BARCODE' }).captureMethod === 'BARCODE');
ok('aucun score de confiance numérique', !('confidence' in B({ quantityTouched: true }).quantity));

// ── READERS (sur item persisté, après roundtrip) ──
const knownItem = roundtrip({ quantity: 3, assertion_provenance: B({ captureMethod: 'BARCODE', quantityTouched: true, dateEnteredByUser: true, dateTypeChoice: 'DLC' }) });
ok('quantityAssertedKnown = true (touchée) après roundtrip', Q(knownItem) === true);
ok('explicitDateType = DLC après roundtrip', EDT(knownItem) === 'DLC');
ok('dateValue autoritaire (saisie) → non-authoritative false', DNA(knownItem) === false);

const defItem = roundtrip({ quantity: 1, assertion_provenance: B({ captureMethod: 'RECEIPT', quantityTouched: false, dateFromMachine: true }) });
ok('quantityAssertedKnown = false (défaut)', Q(defItem) === false);
ok('explicitDateType = null (type non choisi)', EDT(defItem) === null);
ok('dateValue machine → non-authoritative true', DNA(defItem) === true);

// ── LEGACY (aucune provenance) ──
ok('legacy : quantityAssertedKnown false', Q({ quantity: 1 }) === false);
ok('legacy : explicitDateType null', EDT({ dlc: '20/01/2026' }) === null);
ok('legacy : dateValueIsNonAuthoritative false (N6-01 inchangé)', DNA({ dlc: '20/01/2026' }) === false);

// ── NÉGATIF : provenance présente mais quantité non touchée ne devient jamais KNOWN ──
ok('NC : défaut + provenance ≠ KNOWN', Q(roundtrip({ quantity: 1, assertion_provenance: B({ quantityTouched: false }) })) === false);

// ── MERGE (correction Stock edit — lossless, immuable, patch de l'assertion changée seulement) ──
const existing = { version: 1, captureMethod: 'BARCODE', quantity: { authority: 'DIRECT' }, dateType: { value: 'DLC', authority: 'DIRECT' }, futureField: { foo: 'bar' } };
const merged = MERGE(existing, { dateValue: { authority: 'DIRECT' } });
ok('MERGE-T01 clé future inconnue préservée', merged.futureField && merged.futureField.foo === 'bar');
ok('MERGE-T02 correction date n\'efface pas quantity', merged.quantity.authority === 'DIRECT');
ok('MERGE-T03 correction date n\'efface pas dateType', merged.dateType.value === 'DLC');
ok('MERGE captureMethod préservé', merged.captureMethod === 'BARCODE');
ok('MERGE dateValue patché à DIRECT', merged.dateValue.authority === 'DIRECT');
ok('MERGE-T04 objet original NON muté (immuable)', !('dateValue' in existing));
ok('MERGE legacy null → base {version:1} + patch', (() => { const r = MERGE(null, { dateValue: { authority: 'DIRECT' } }); return r.version === 1 && r.dateValue.authority === 'DIRECT' && !('quantity' in r); })());
// SW : correction Stock date sur une ligne legacy → SEULE dateValue devient DIRECT (quantité reste UNKNOWN)
const legacyCorrected = WDC(null);
ok('SW-T12 legacy corrigé : dateValue DIRECT, quantité toujours absente/UNKNOWN', DNA({ assertion_provenance: legacyCorrected }) === false && Q({ assertion_provenance: legacyCorrected }) === false);

console.log(`\ncaptureProvenance: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
