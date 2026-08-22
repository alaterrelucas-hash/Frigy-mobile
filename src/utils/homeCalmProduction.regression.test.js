/**
 * Home CALM — CÂBLAGE PRODUCTION + fermeture technique. Régression SOURCE :
 *   node src/utils/homeCalmProduction.regression.test.js
 * Contrat : HomeCalm (WATCH SUMMARY) est câblé en PRODUCTION dans l'état C SUFFISANT, UNIQUEMENT quand une
 * population Watch RÉELLE existe (watchItems.length > 0) → jamais « 0 produits ». Zéro Watch → repli SILENCE
 * (HomeWatchList rend null). HOME ≠ PRODUITS : le Calm Watch-backed ne rend PAS HomeWatchList. La PRIORITÉ
 * (A/B) garde HomeWatchList. First Run / Empty / LOW ne rendent pas HomeCalm. Aucune vérité (Watch/temporel/
 * priorité/monétaire/richesse/machine d'état) modifiée. Aucun scaffold `calmVisual` résiduel.
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const home = read('../screens/HomeScreen.js');
const dev = read('./devPreviewHome.js');
const logic = read('./homeLogic.js');
const rescue = read('./rescueValue.js');
const lowStock = read('../components/home/HomeLowStock.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// Bloc de RENDU de l'état C (gate `state === HOME_STATE.C && (` — le flag isCalm utilise `&& watchItems`,
// non `&& (`, donc on cible bien le rendu). Jusqu'aux états A/B.
const cStart = home.indexOf('state === HOME_STATE.C && (');
// Source sans commentaires (bloc + ligne + JSX {/* */}) — évite les faux positifs sur la doc.
const strip = (s) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');
const homeCode = strip(home);
const abStart = home.indexOf('state === HOME_STATE.A || state === HOME_STATE.B', cStart);
const cBlock = cStart > 0 && abStart > cStart ? home.slice(cStart, abStart) : '';
const abBlock = abStart > 0 ? home.slice(abStart) : '';

// ── CALM-P01 : famille Calm = état C SUFFISANT (bifurcation présentationnelle intra-état C) ──
ok('CALM-P01 isCalmFamily = ACTIVE + SUFFICIENT + état C (sans condition Watch)',
  /const isCalmFamily = mode === HOME_MODE\.ACTIVE && level === HOME_LEVEL\.SUFFICIENT[\s\S]{0,80}state === HOME_STATE\.C/.test(home));
ok('CALM-P01 état C : watchItems.length > 0 ? <HomeCalm watchItems...> (Watch-backed)',
  cBlock.length > 0 && /watchItems\.length > 0 \?[\s\S]{0,200}<HomeCalm watchItems=\{watchItems\}/.test(cBlock));

// ── CALM-P02 : la branche WATCH (HomeCalm) ne rend PAS HomeWatchList ──
const calmArm = (() => {
  const i = cBlock.indexOf('watchItems.length > 0 ?');
  const j = cBlock.indexOf(') : (', i);
  return i >= 0 && j > i ? cBlock.slice(i, j) : '';
})();
ok('CALM-P02 la branche WATCH (HomeCalm) ne contient AUCUN HomeWatchList ni en-tête À GARDER',
  calmArm.length > 0 && /<HomeCalm /.test(calmArm) && !/HomeWatchList/.test(calmArm) && !/GARDER/.test(calmArm));

// ── CALM-P03 : HomeCalm reçoit la vraie sélection (watchItems/watchOverflow) ──
ok('CALM-P03 <HomeCalm watchItems={watchItems} watchOverflow={watchOverflow} ...>',
  /<HomeCalm watchItems=\{watchItems\} watchOverflow=\{watchOverflow\}/.test(home));
ok('CALM-P03 onSeeMore → Produits (onNav(\'fridge\'))',
  /<HomeCalm[\s\S]{0,160}onSeeMore=\{\(\) => onNav\?\.\('fridge'\)\}/.test(home));

// ── CALM-P04/P05 : total dynamique + nearest = watchItems[0] (délégués au composant, vérifiés côté présentation) ──
const calm = read('../components/home/HomeCalm.js');
ok('CALM-P04 HomeCalm dérive le total (watchItems.length + watchOverflow)',
  /watchItems\.length\s*\+\s*\(?\s*typeof watchOverflow/.test(calm));
ok('CALM-P05 HomeCalm : nearest = watchItems[0] (aucun re-tri)',
  /watchItems\[0\]/.test(calm) && !/\.sort\(/.test(calm.replace(/\/\*[\s\S]*?\*\//g, '')));

// ── CALM-P06 : WATCH gatée sur watchItems.length > 0 → jamais « 0 produits » (SILENCE sinon) ──
ok('CALM-P06 variante WATCH gatée sur watchItems.length > 0 ; SILENCE en repli',
  cBlock.length > 0 && /watchItems\.length > 0 \?[\s\S]{0,260}<HomeCalm variant="silence"/.test(cBlock));
ok('CALM-P06 aucun littéral « 0 produit » rendu (hors commentaires)',
  !/0 produit/.test(homeCode) && !/0 produit/.test(strip(calm)));

// ── CALM-P07 : zéro-Watch → variante SILENCE (plus de repli HomeWatchList/greeting-only en état C) ──
ok('CALM-P07 état C, zéro Watch → <HomeCalm variant="silence"> ; AUCUN HomeWatchList dans le bloc C',
  cBlock.length > 0 && /\) : \([\s\S]{0,200}<HomeCalm variant="silence"/.test(cBlock) && !/HomeWatchList/.test(cBlock));

// ── CALM-P08 : LOW ne rend pas HomeCalm ──
ok('CALM-P08 HomeLowStock n\'importe/rend pas HomeCalm', !/HomeCalm/.test(lowStock));

// ── CALM-P09/P10 : First Run / Empty ne rendent pas HomeCalm ──
const frBlock = (() => {
  const i = home.indexOf('mode === HOME_MODE.FIRST_RUN ?');
  const j = home.indexOf('mode === HOME_MODE.EMPTY ?', i);
  return i >= 0 && j > i ? home.slice(i, j) : '';
})();
const emptyBlock = (() => {
  const i = home.indexOf('mode === HOME_MODE.EMPTY ?');
  const j = home.indexOf('level === HOME_LEVEL.LOW ?', i);
  return i >= 0 && j > i ? home.slice(i, j) : '';
})();
// strip commentaires : le greeting partagé mentionne « HomeCalm » en COMMENTAIRE (doc hiérarchie).
ok('CALM-P09 branche First Run ne rend pas HomeCalm', frBlock.length > 0 && !/HomeCalm/.test(strip(frBlock)));
ok('CALM-P10 branche Empty Returning ne rend pas HomeCalm', emptyBlock.length > 0 && !/HomeCalm/.test(strip(emptyBlock)));

// ── CALM-P11 : la PRIORITÉ (A/B) garde HomeWatchList (jamais remplacée par HomeCalm) ──
ok('CALM-P11 A/B rend HomeWatchList et NON HomeCalm',
  abBlock.length > 0 && /<HomeWatchList items=\{watchItems\}/.test(abBlock) && !/HomeCalm/.test(abBlock));
// La variante SILENCE de HomeCalm peut apparaître dans un aperçu __DEV__ (calmSilenceVisual) ; on compte
// donc la forme PRODUCTION Watch-backed (`<HomeCalm watchItems={watchItems}`), qui doit rester unique.
ok('CALM-P11 HomeCalm Watch-backed rendu EXACTEMENT une fois en production (état C)',
  (home.match(/<HomeCalm watchItems=\{watchItems\}/g) || []).length === 1);

// ── CALM-P12 : aucun scaffold `calmVisual` résiduel (runtime) ; DEV_HOME_MODE canonique = 'lowA' ──
ok('CALM-P12 aucun `calmVisual` dans HomeScreen ni devPreviewHome',
  !/calmVisual/.test(home) && !/calmVisual/.test(dev));
// DEV_HOME_MODE est un COMMUTATEUR de preview __DEV__ qui peut varier légitimement pendant les revues.
// L'INVARIANT de cleanup = aucune preview temporaire résiduelle (calmVisual ci-dessus, culinaryVisual via
// CULINARY-QA01) ; la valeur PROPRE canonique reste 'lowA' (mode disponible), non épinglée en dur ici.
ok('CALM-P12 DEV_HOME_MODE = littéral string, jamais calmVisual (lowA = valeur propre canonique dispo)',
  /export const DEV_HOME_MODE = '[A-Za-z]+';/.test(dev)
  && !/DEV_HOME_MODE = 'calmVisual'/.test(dev) && /case 'lowA':/.test(dev));

// ── CULINARY-QA01 : aucun scaffold `culinaryVisual` résiduel (preview standalone culinaire supprimée) ──
ok('CULINARY-QA01 aucun `culinaryVisual` runtime dans HomeScreen ni devPreviewHome',
  !/culinaryVisual/.test(home) && !/culinaryVisual/.test(dev));
ok('CALM-P12 modes DEV légitimes préservés (A/B/C/empty/first/lowA/lowB/lowC)',
  /case 'A':/.test(dev) && /case 'lowA':/.test(dev) && /case 'lowB':/.test(dev) && /case 'lowC':/.test(dev)
  && /case 'first':/.test(dev) && /case 'emptyReturning':/.test(dev));

// ── CALM-P13 : vérité TEMPORELLE / PRIORITÉ / MONÉTAIRE inchangée ──
ok('CALM-P13 autorité MONÉTAIRE inchangée (hasMonetaryAuthority → false)',
  /function hasMonetaryAuthority\([^)]*\)\s*\{\s*return false;/.test(rescue));
ok('CALM-P13 sélection PRIORITÉ inchangée (allowlist amplifiée vide → null)',
  /Allowlist des types amplifiés VIDE aujourd'hui → renvoie TOUJOURS null/.test(logic)
  && /export function selectHomePriority\(/.test(logic));

// ── CALM-P14 : machine d'état production intacte (mode/level/state consommés, non redéfinis ici) ──
ok('CALM-P14 HomeScreen consomme resolveHomeMode + state/level/deriveHomeState (aucune redéfinition)',
  /resolveHomeMode\(/.test(home) && /level === HOME_LEVEL\.LOW/.test(home)
  && /state === HOME_STATE\.C/.test(home) && !/function deriveHomeState/.test(home));

// ── SILENCE-P01..P08 : câblage PRODUCTION de la variante SILENCE (état C, zéro Watch) ──
const silenceArm = (() => {
  const i = cBlock.indexOf(') : (');
  const j = cBlock.indexOf(')}', i);
  return i >= 0 && j > i ? cBlock.slice(i, j) : '';
})();
const calmSrc = strip(calm);
const silBranch = (() => {
  const i = calmSrc.indexOf('isSilence ? (');
  const j = calmSrc.indexOf(') : hasWatch ? (', i);
  return i >= 0 && j > i ? calmSrc.slice(i, j) : '';
})();
ok('SILENCE-P01 état C + zéro Watch → <HomeCalm variant="silence">',
  /<HomeCalm variant="silence"/.test(silenceArm));
ok('SILENCE-P02 zéro-Watch NE rend PAS un fallback greeting-only/blank (variante HomeCalm rendue)',
  /<HomeCalm variant="silence"/.test(cBlock));
ok('SILENCE-P03 zéro-Watch NE rend PAS HomeWatchList comme présentation (bloc C sans HomeWatchList)',
  cBlock.length > 0 && !/HomeWatchList/.test(cBlock));
ok('SILENCE-P04 variante silence : aucun compteur (chiffre + produit) ni total dérivé',
  silBranch.length > 0 && !/\d+\s*produit/.test(silBranch) && !/countLabel|totalWatch/.test(silBranch));
ok('SILENCE-P05 variante silence : aucun CTA (pas de TouchableOpacity / onSeeMore / « Voir »)',
  silBranch.length > 0 && !/TouchableOpacity/.test(silBranch) && !/onSeeMore/.test(silBranch) && !/Voir/.test(silBranch));
ok('SILENCE-P06 état C Watch-backed continue la variante WATCH (<HomeCalm watchItems={watchItems})',
  /watchItems\.length > 0 \?[\s\S]{0,200}<HomeCalm watchItems=\{watchItems\}/.test(cBlock));
ok('SILENCE-P07 PRIORITÉ inchangée (A/B rend HomeWatchList, jamais HomeCalm)',
  abBlock.length > 0 && /<HomeWatchList items=\{watchItems\}/.test(abBlock) && !/HomeCalm/.test(abBlock));
ok('SILENCE-P08 aucun scaffold `calmSilenceVisual` runtime (HomeScreen + devPreviewHome)',
  !/calmSilenceVisual/.test(home) && !/calmSilenceVisual/.test(dev));

console.log(`\nhomeCalmProduction.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
