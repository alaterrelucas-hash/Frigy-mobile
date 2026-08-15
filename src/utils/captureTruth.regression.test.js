/**
 * N6-08 — Scan / Add Capture Truth (regression lock, source-based).
 *   node src/utils/captureTruth.regression.test.js
 *
 * Ce que N6-08 verrouille SANS changement de schéma (persistance = colonnes Supabase strictes ;
 * la provenance forward — captureMethod / autorité par assertion / Date Type explicite / quantité
 * KNOWN — exigerait une MIGRATION de la base de PRODUCTION, décision Produit/Data hors autonomie) :
 *   - le libellé statique « DATE LIMITE (DLC) » (fausse revendication de TYPE sur un champ date
 *     générique) est neutralisé → « DATE INDIQUÉE » (valeur de date ≠ type de date, CR-02) ;
 *   - aucun chemin de capture ne persiste un TYPE de date (aucune colonne date_type n'existe →
 *     dateType reste dérivé UNKNOWN par temporalAuthority) ;
 *   - une représentation manuelle de BASE (nom seul), GRATUITE, existe déjà (source 'Manuel') ;
 *   - le « Je l'ai » de Home n'invente pas de date (dlc '—').
 * Commentaires strippés avant scan (évite les faux positifs — cf. stockLabels/recipeWording).
 */
const fs = require('fs');
const path = require('path');

const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const scan = stripC(fs.readFileSync(path.join(__dirname, '../screens/ScanScreen.js'), 'utf8'));
const app = stripC(fs.readFileSync(path.join(__dirname, '../../App.js'), 'utf8'));
const notif = fs.readFileSync(path.join(__dirname, 'notificationGate.js'), 'utf8');
const fridge = stripC(fs.readFileSync(path.join(__dirname, '../screens/FridgeScreen.js'), 'utf8'));

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };
const absent = (label, hay, needle) => ok(label, !hay.includes(needle));
const present = (label, hay, needle) => ok(label, hay.includes(needle));

// ── SELF : le stripper n'a pas vidé le code actif ──
present('SELF stripper garde le code actif ScanScreen', scan, 'addProduct');

// ── DATE-TYPE : le libellé statique DLC (faux type) est retiré, remplacé par un libellé neutre ──
absent('TYPE-T05 aucun libellé statique « DATE LIMITE (DLC) »', scan, 'DATE LIMITE (DLC)');
absent('TYPE-T05b aucun « DATE LIMITE » résiduel', scan, 'DATE LIMITE');
present('DATE-T03 libellé date neutre « DATE INDIQUÉE »', scan, 'DATE INDIQUÉE');
absent('TYPE disclaimer ne type plus la date en « DLC »', scan, 'et DLC sont estimés');

// ── DATE TYPE non fabriqué : aucune écriture d'un type de date à la capture (colonne inexistante) ──
absent('TYPE aucun date_type écrit (ScanScreen)', scan, 'date_type');
absent('TYPE aucun dateType écrit (ScanScreen)', scan, 'dateType:');

// ── BASIC FREE REPRESENTABILITY (CR-19) : chemin manuel nom-seul, gratuit, déjà présent ──
present('MAN-T01 chemin manuel présent (source Manuel)', scan, "source === 'Manuel'");
present('MAN-T03 nom seul suffit (fallback nom)', scan, "manualName.trim() || 'Produit'");
present('MAN-T05 saisie manuelle du nom', scan, 'setManualName');
// L'entrée barcode n'impose pas de gate premium (photo/receipt oui) → base gratuite.
present('MAN-T02 photo garde son gate premium (base reste séparée)', scan, "if (!isPro) { onPaywall?.(); return; }");

// ── HOME « JE L'AI » : présence sans date inventée ──
ok('HAVE-T04 Home Je l\'ai n\'invente pas de date (dlc « — »)', app.includes("dlc: '—'"));

// ── N6-08 continuation : provenance forward câblée + saisie manuelle directe + type de date opt. ──
present('N6-08 provenance persistée dans l\'insert (assertion_provenance)', scan, 'assertion_provenance:');
present('N6-08 builder de provenance utilisé', scan, 'buildAssertionProvenance');
present('N6-08 quantité DIRECT seulement si compteur touché (packUnitsTouched)', scan, 'packUnitsTouched');
present('N6-08 MAN2 : carte « Saisir manuellement » de première classe', scan, "id: 'manual'");
present('N6-08 saisie manuelle directe (résultat Manuel préremplit, manualDirect)', scan, 'manualDirect: true');
present('N6-08 sélecteur de TYPE DE DATE optionnel', scan, 'TYPE DE DATE');
absent('N6-08 aucun score de confiance numérique', scan, 'confidence:');
absent('N6-08 aucune colonne date_type écrite (JSONB seulement)', scan, 'date_type');
// Downstream verrouillé ailleurs : notificationGate garde une allowlist push VIDE (type ≠ push).
present('N6-08 DOWN2 : allowlist push reste VIDE', notif, 'PUSH_AUTHORIZING_DATE_TYPES = new Set()');

// ── N6-08 write coverage : RECEIPT / PHOTO / STOCK EDIT écrivent la provenance des VRAIES assertions ──
present('RW receipt : provenance RECEIPT dans l\'insert', scan, 'CAPTURE_METHOD.RECEIPT');
present('RW receipt : quantité DIRECT si compteur touché', scan, '_qtyTouched');
present('RW receipt : date DIRECT si saisie', scan, '_dateTouched');
present('PW photo : provenance PHOTO dans l\'insert', scan, 'CAPTURE_METHOD.PHOTO');
present('PW photo : date IA non touchée = MACHINE (dateFromMachine)', scan, 'dateFromMachine: !p._dateTouched');
present('SW stock edit : correction date → provenance (withDateValueCorrection)', fridge, 'withDateValueCorrection');
present('SW stock edit : correction détectée par changement de date', fridge, 'dateChanged');
absent('SW stock edit : la correction ne crée PAS de causalité consumed/wasted', fridge, 'dateChanged) updates.consumed');

console.log(`\ncaptureTruth.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
