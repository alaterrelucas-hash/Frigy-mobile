/**
 * N6-15 — Routage Courses → formulaire Stock manuel DIRECT + sûreté inter-méthode. Régression :
 *   node src/utils/coursesScanRouting.regression.test.js
 *
 * TYPES DE TEST :
 *  - ROUTE-T04 & le discriminateur : BEHAVIORAL — la fonction source `isCoursesContext` est EXTRAITE de
 *    ScanScreen.js puis évaluée en isolation (aucune dépendance React Native) et vérifiée par table de
 *    vérité. C'est la logique RÉELLE de la source, pas une copie.
 *  - Tous les autres (routage/bannière/fail-closed/inter-méthode) : STATIC SOURCE CONTRACTS. Les tests de
 *    composant comportementaux (rendu RN) ne sont pas disponibles ici → on prouve les garanties par la
 *    structure de la source (dérivation d'état initial, garde fail-closed, unicité du writer canonique).
 *
 * Contrat : producteur (App) = `sourceName` ; consommateur (Scan) = `sourceName` (jamais `.name`). Un
 * contexte Courses VALIDE (lineage COURSES + identifiants) route DIRECTEMENT vers la fiche manuelle
 * canonique dès le 1er rendu ; le sélecteur générique n'est jamais actionnable sous une identité Courses
 * vivante (fail-closed). La quantité source ×N est un CONTEXTE d'affichage, jamais la quantité Stock.
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const scan = read('../screens/ScanScreen.js');
const app  = read('../../App.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── Extraction BEHAVIORAL du discriminateur réel ─────────────────────────────────────────────
const m = scan.match(/export const isCoursesContext = ([\s\S]*?);\n/);
let isCoursesContext = null;
try { isCoursesContext = eval('(' + m[1] + ')'); } catch (e) { /* laissé null → tests échoueront */ }
const VALID = { lineage: { kind: 'COURSES' }, deterministicItemId: 'det', shoppingItemId: 'sid', sourceName: 'TEST N6-15 LAIT', sourceQuantity: 5 };

// ── CONTRAT DE CHAMP ──────────────────────────────────────────────────────────────────────
const capObj = (app.match(/setCaptureContext\(\{([\s\S]*?)\}\)/) || ['',''])[1];
ok('ROUTE-T01 App producteur écrit sourceName (aucune clé `name:`)', /sourceName: name/.test(capObj) && !/\bname:/.test(capObj));
ok('ROUTE-T02 Scan consomme captureContext.sourceName', /captureContext\.sourceName/.test(scan));
ok('ROUTE-T03 Scan ne dépend plus de captureContext.name', !/captureContext\.name\b/.test(scan));

// ── DISCRIMINATEUR (BEHAVIORAL — §3 : contexte VALIDE, pas un objet arbitraire) ───────────────
ok('DISC fn extraite', typeof isCoursesContext === 'function');
ok('DISC null → false', isCoursesContext && isCoursesContext(null) === false);
ok('DISC objet vide → false', isCoursesContext && isCoursesContext({}) === false);
ok('DISC contexte COURSES complet → true', isCoursesContext && isCoursesContext(VALID) === true);
ok('DISC lineage non-COURSES → false', isCoursesContext && isCoursesContext({ ...VALID, lineage: { kind: 'HOME' } }) === false);
ok('DISC sans deterministicItemId → false', isCoursesContext && isCoursesContext({ ...VALID, deterministicItemId: undefined }) === false);
ok('DISC sans shoppingItemId → false', isCoursesContext && isCoursesContext({ ...VALID, shoppingItemId: undefined }) === false);
ok('DISC sans sourceName → false', isCoursesContext && isCoursesContext({ ...VALID, sourceName: undefined }) === false);

// ── ROUTAGE (STATIC) ─────────────────────────────────────────────────────────────────────
ok('ROUTE-T04 mode initial dérivé : COURSES → scanner, sinon choice',
  /useState\(\(\) => isCoursesContext\(captureContext\) \? 'scanner' : 'choice'\)/.test(scan));
ok('ROUTE-T05 manualName dérive de sourceName (init paresseux + effet)',
  /useState\(\(\) => isCoursesContext\(captureContext\) \? captureContext\.sourceName : ''\)/.test(scan)
  && /setManualName\(captureContext\.sourceName\)/.test(scan));
ok('ROUTE-T10 hors contexte : fallback \'choice\' (BEHAVIORAL : non-courses → chooser)',
  isCoursesContext && isCoursesContext(null) === false && /: 'choice'\)/.test(scan));

// ── SÉPARATION QUANTITÉ (STATIC) : ×N = contexte, jamais quantité Stock ───────────────────────
const eff = (scan.match(/if \(!isCoursesContext\(captureContext\)\) return;[\s\S]*?setMode\('scanner'\);/) || [''])[0];
ok('ROUTE-T06 sourceQuantity ne fixe JAMAIS packUnits (effet: setPackUnits(1) ; aucun setPackUnits(sourceQuantity))',
  /setPackUnits\(1\)/.test(eff) && !/setPackUnits\([^)]*sourceQuantity/.test(scan) && !/packUnits[^\n]*=[^\n]*sourceQuantity/.test(scan));
ok('ROUTE-T07 sourceQuantity ne fixe JAMAIS packUnitsTouched (effet courses: false, jamais true ; aucun setPackUnitsTouched(sourceQuantity))',
  /setPackUnitsTouched\(false\)/.test(eff) && !/setPackUnitsTouched\(true\)/.test(eff) && !/setPackUnitsTouched\([^)]*sourceQuantity/.test(scan));

// ── BANNIÈRE SOURCE (STATIC) ──────────────────────────────────────────────────────────────
const banner = (scan.match(/DEPUIS TA LISTE[\s\S]*?Cette ligne sera retirée/) || [''])[0];
ok('ROUTE-T08 bannière utilise sourceName', /captureContext\.sourceName/.test(banner));
ok('ROUTE-T09 bannière utilise sourceQuantity (×N, contexte)', /captureContext\.sourceQuantity/.test(banner) && /×\$\{captureContext\.sourceQuantity\}/.test(banner));

// ── SÛRETÉ INTER-MÉTHODE (STATIC STRUCTURAL) ──────────────────────────────────────────────
// Le sélecteur générique et ses cartes (handleMethodPress → barcode/ticket/photo) ne vivent QUE dans le
// rendu `mode === 'choice'`. Sous un contexte Courses valide, ce rendu est INATTEIGNABLE : (a) mode
// démarre 'scanner', (b) garde fail-closed `isCoursesContext && mode !== 'scanner'` AVANT le rendu choice.
const failClosedIdx = scan.indexOf("if (isCoursesContext(captureContext) && mode !== 'scanner') return");
const chooserIdx = scan.indexOf("if (mode === 'choice') return");
const methodPressIdx = scan.indexOf('onPress={() => handleMethodPress(');
const choiceBlock = (scan.match(/if \(mode === 'choice'\) return \(([\s\S]*?)\n  \);/) || ['',''])[1];

ok('SAFE-T01 garde fail-closed présente ET placée AVANT le rendu du sélecteur',
  failClosedIdx > 0 && chooserIdx > 0 && failClosedIdx < chooserIdx);
ok('SAFE-T01 fail-closed ne vide PAS le contexte (pas d\'appel onCaptureContextConsumed/setCaptureContext dans la garde)',
  /mode !== 'scanner'\) return \([\s\S]*?Ouverture de la fiche produit[\s\S]*?<\/SafeAreaView>\s*\);/.test(scan)
  && !/mode !== 'scanner'\) return \([\s\S]*?onCaptureContextConsumed[\s\S]*?<\/SafeAreaView>/.test(scan));
ok('SAFE-T02/03/04 cartes d\'acquisition (handleMethodPress) UNIQUEMENT dans le rendu choice, après la garde',
  (scan.match(/onPress=\{\(\) => handleMethodPress\(/g) || []).length === 1
  && methodPressIdx > chooserIdx && /handleMethodPress/.test(choiceBlock));
ok('SAFE-T02 barcode inatteignable sous Courses (setMode(\'scanner\') barcode via handleMethodPress dans le chooser)',
  /id === 'barcode'/.test(scan) && failClosedIdx < chooserIdx);
ok('SAFE-T03 ticket/receipt inatteignable sous Courses', /setMode\('receipt'\)/.test(scan) && failClosedIdx < chooserIdx);
ok('SAFE-T04 photo inatteignable sous Courses', /setMode\('photo'\)/.test(scan) && failClosedIdx < chooserIdx);

// L'id déterministe / lineage Courses ne sont attachés QUE par l'unique writer canonique (handleConfirm,
// mode scanner). Aucun chemin d'acquisition non-manuel n'y accède sous contexte Courses (chooser fermé).
ok('SAFE-T05 deterministicItemId attaché en 1 seul site (writer canonique)',
  (scan.match(/newItem\.id = ctx\.deterministicItemId/g) || []).length === 1
  && (scan.match(/const ctx = captureContext/g) || []).length === 1);
ok('SAFE-T06 lineage Courses attaché en 1 seul site (writer canonique)',
  (scan.match(/assertion_provenance\.lineage = ctx\.lineage/g) || []).length === 1);

console.log(`\ncoursesScanRouting.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
