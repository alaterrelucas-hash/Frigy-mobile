/**
 * N6-13 — Home Attention Basis Gate (CR-22). Régression SOURCE :
 *   node src/utils/homeAttentionTruth.regression.test.js
 * Verrouille : Home consomme l'autorité canonique N6-04 (amplifié=héros, passif=watch neutre), jamais
 * `computeDaysRemaining`/brut ; lisibilité du foyer (UNKNOWN ≠ vide) ; allowlist amplifié INCHANGÉE.
 * (La logique de palier/comptage est prouvée comportementalement dans homeLogic.test.js.)
 */
const fs = require('fs');
const path = require('path');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const read = (rel) => strip(fs.readFileSync(path.join(__dirname, rel), 'utf8'));

const logic  = read('homeLogic.js');
const hook   = read('../hooks/useHomeSuggestion.js');
const hero   = read('../components/home/HomePriorityFocus.js');
const watch  = read('../components/home/HomeWatchList.js');
const screen = read('../screens/HomeScreen.js');
const app    = read('../../App.js');
const auth   = read('temporalAuthority.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── Consommateur canonique : plus AUCUN computeDaysRemaining dans l'attention Home ──
ok('LOGIC no computeDaysRemaining', !logic.includes('computeDaysRemaining'));
ok('HERO no computeDaysRemaining', !hero.includes('computeDaysRemaining'));
ok('WATCH no computeDaysRemaining', !watch.includes('computeDaysRemaining'));
ok('LOGIC importe l\'autorité canonique (temporalAuthority)', logic.includes("from './temporalAuthority'"));

// ── HÉRO = palier AMPLIFIÉ ──
ok('LOGIC selectHomePriority via amplifiedTemporalDays', logic.includes('amplifiedTemporalDays') && /selectHomePriority[\s\S]*?amplifiedTemporalDays/.test(logic));
ok('HOOK priorité porte attentionDays = amplifiedTemporalDays', hook.includes('attentionDays: amplifiedTemporalDays('));
ok('HERO consomme item.attentionDays (jour autoritaire porté)', hero.includes('item.attentionDays'));
ok('LOGIC deriveVoice via amplifiedTemporalDays (pas de brut)', /deriveVoice[\s\S]*?amplifiedTemporalDays/.test(logic));
ok('LOGIC priorityMicroCopy lit attentionDays porté', /priorityMicroCopy[\s\S]*?attentionDays/.test(logic));

// ── WATCH = palier PASSIF neutre ──
ok('LOGIC watch via passiveTemporalDays (selectWatchEligible) + selectWatchItems délègue (cap 2)',
  /selectWatchEligible[\s\S]*?passiveTemporalDays/.test(logic)
  && /selectWatchItems[\s\S]*?return selectWatchEligible\([^)]*\)\.slice\(0, 2\)/.test(logic));
ok('LOGIC watch porte watchDays autoritaire', logic.includes('watchDays: x.days'));
ok('WATCH consomme it.watchDays', watch.includes('it.watchDays'));
ok('WATCH no getTemporalColorKey (aucune couleur d\'alerte passive)', !watch.includes('getTemporalColorKey'));
ok('WATCH aucune puce d\'alerte (§19 : puce retirée ; date + chevron neutre suffisent, jamais de couleur passive)',
  !watch.includes('const dot =') && !/backgroundColor: dot/.test(watch) && watch.includes('ChevronRight'));

// ── Lisibilité du foyer (N6-14) : autorité de mode serveur ; UNKNOWN ≠ vide/First Run ──
ok('SCREEN reçoit itemsReady', screen.includes('itemsReady'));
ok('SCREEN mode via resolveHomeMode (autorité serveur)', screen.includes('resolveHomeMode({'));
ok('SCREEN branche NEUTRE (mode NEUTRAL) présente', screen.includes('mode === HOME_MODE.NEUTRAL ?'));
ok('SCREEN ordre : First Run → NEUTRAL → EMPTY', (() => {
  const iFirst = screen.indexOf('mode === HOME_MODE.FIRST_RUN ?');
  const iNeutral = screen.indexOf('mode === HOME_MODE.NEUTRAL ?');
  const iEmpty = screen.indexOf('mode === HOME_MODE.EMPTY ?');
  return iFirst > 0 && iNeutral > iFirst && iEmpty > iNeutral;
})());
ok('SCREEN NEUTRAL précède le rendu EmptyStock (jamais interprété comme vide)',
  screen.indexOf('mode === HOME_MODE.NEUTRAL ?') > 0 && screen.indexOf('mode === HOME_MODE.NEUTRAL ?') < screen.indexOf('<HomeEmptyStock'));
ok('SCREEN NEUTRAL précède l\'état C actif (jamais interprété comme foyer connu)',
  screen.indexOf('mode === HOME_MODE.NEUTRAL ?') > 0 && screen.indexOf('mode === HOME_MODE.NEUTRAL ?') < screen.indexOf('state === HOME_STATE.C && ('));
ok('SCREEN First Run exige never_initialized prouvé (jamais un flag device)', !screen.includes('stockInitialized') && !screen.includes('frigy_stock_initialized'));
ok('SCREEN QA dev conserve les previews (scénario → mode)', screen.includes('qa.firstRun ? HOME_MODE.FIRST_RUN'));
ok('APP passe itemsReady = hydratedFamilyId === familyId', app.includes('itemsReady={familyId != null && hydratedFamilyId === familyId}'));
ok('APP passe l\'autorité de cycle de vie serveur (lifecycleState + lifecycleReady)', app.includes('lifecycleState={') && app.includes('lifecycleReady={lifecycleReady}'));
ok('APP n\'utilise plus le flag device frigy_stock_initialized comme autorité First Run', !app.includes("AsyncStorage.getItem('frigy_stock_initialized')"));

// ── N6-13 (2.6, CR-22) : « priorité absente » ne devient JAMAIS un calme global explicite ──
ok('CALM no « Rien ne demande ton attention » (HomeScreen)', !screen.includes('Rien ne demande ton attention'));
ok('CALM no « Rien ne presse » (HomeScreen)', !screen.includes('Rien ne presse'));
ok('CALM no « Rien ne presse » (homeLogic deriveVoice)', !logic.includes('Rien ne presse'));
ok('CALM no reassurance de substitution (Tout va bien / Rien d\'urgent / Pas de priorité)',
  !screen.includes('Tout va bien') && !screen.includes("Rien d'urgent") && !screen.includes('Pas de priorité') && !logic.includes('Tout va bien'));
// État C = FAMILLE CALM (même scène HomeCalm) : AVEC Watch réel → variante WATCH ; ZÉRO Watch → variante
// SILENCE (présence + rôle Frigy). Jamais un calme global fabriqué, jamais « 0 produits », jamais un Home vide.
ok('CALM État C : variante WATCH (watchItems>0) + variante SILENCE (repli), même HomeCalm',
  screen.includes('state === HOME_STATE.C &&')
  && /HOME_STATE\.C && \(\s*<>[\s\S]{0,400}watchItems\.length > 0 \?[\s\S]{0,300}<HomeCalm watchItems=\{watchItems\}[\s\S]{0,200}<HomeCalm variant="silence"/.test(screen));
ok('CALM État C : variante WATCH gatée sur watchItems.length > 0 (jamais « 0 produits »)',
  /watchItems\.length > 0 \?/.test(screen) && !/0 produit/.test(screen.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')));

// ── Allowlist amplifié INCHANGÉE (production : héros temporel silencieux par design) ──
ok('AUTH AMPLIFIED_PASSIVE_DATE_TYPES = new Set() (VIDE, non peuplé)', /AMPLIFIED_PASSIVE_DATE_TYPES\s*=\s*new Set\(\)\s*;/.test(auth));
ok('AUTH amplifiedTemporalDays exige DATE + type ∈ allowlist (inchangé)',
  auth.includes('AMPLIFIED_PASSIVE_DATE_TYPES.has(s.dateType)') && auth.includes('TEMPORAL_AUTHORITY.DATE'));

console.log(`\nhomeAttentionTruth.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
