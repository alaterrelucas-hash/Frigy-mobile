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
ok('LOGIC selectWatchItems via passiveTemporalDays', /selectWatchItems[\s\S]*?passiveTemporalDays/.test(logic));
ok('LOGIC watch porte watchDays autoritaire', logic.includes('watchDays: x.days'));
ok('WATCH consomme it.watchDays', watch.includes('it.watchDays'));
ok('WATCH no getTemporalColorKey (aucune couleur d\'alerte passive)', !watch.includes('getTemporalColorKey'));
ok('WATCH puce NEUTRE (theme.text4)', watch.includes('const dot = theme.text4'));

// ── Lisibilité du foyer : UNKNOWN ≠ vide/calme ──
ok('SCREEN reçoit itemsReady', screen.includes('itemsReady'));
ok('SCREEN branche not-ready NEUTRE avant EMPTY', screen.includes('!ready ?'));
ok('SCREEN ordre : First Run → not-ready → EMPTY', (() => {
  const iFirst = screen.indexOf('isFirstRun ?');
  const iReady = screen.indexOf('!ready ?');
  const iEmpty = screen.indexOf('HOME_LEVEL.EMPTY ?');
  return iFirst > 0 && iReady > iFirst && iEmpty > iReady;
})());
ok('SCREEN not-ready précède le rendu EmptyStock (jamais interprété comme vide)',
  screen.indexOf('!ready ?') > 0 && screen.indexOf('!ready ?') < screen.indexOf('<HomeEmptyStock'));
ok('SCREEN not-ready précède l\'état C (jamais interprété comme foyer connu)',
  screen.indexOf('!ready ?') > 0 && screen.indexOf('!ready ?') < screen.indexOf('state === HOME_STATE.C'));
ok('SCREEN QA dev reste « prêt » (préserve les previews)', screen.includes('ready = qa ? true : itemsReady'));
ok('APP passe itemsReady = hydratedFamilyId === familyId', app.includes('itemsReady={familyId != null && hydratedFamilyId === familyId}'));

// ── N6-13 (2.6, CR-22) : « priorité absente » ne devient JAMAIS un calme global explicite ──
ok('CALM no « Rien ne demande ton attention » (HomeScreen)', !screen.includes('Rien ne demande ton attention'));
ok('CALM no « Rien ne presse » (HomeScreen)', !screen.includes('Rien ne presse'));
ok('CALM no « Rien ne presse » (homeLogic deriveVoice)', !logic.includes('Rien ne presse'));
ok('CALM no reassurance de substitution (Tout va bien / Rien d\'urgent / Pas de priorité)',
  !screen.includes('Tout va bien') && !screen.includes("Rien d'urgent") && !screen.includes('Pas de priorité') && !logic.includes('Tout va bien'));
// État C conserve la WatchList NEUTRE (silence ≠ suppression de la surface passive acceptée).
ok('CALM État C garde la WatchList (silence, pas suppression)',
  screen.includes('state === HOME_STATE.C &&') && /HOME_STATE\.C &&[\s\S]{0,200}HomeWatchList/.test(screen));

// ── Allowlist amplifié INCHANGÉE (production : héros temporel silencieux par design) ──
ok('AUTH AMPLIFIED_PASSIVE_DATE_TYPES = new Set() (VIDE, non peuplé)', /AMPLIFIED_PASSIVE_DATE_TYPES\s*=\s*new Set\(\)\s*;/.test(auth));
ok('AUTH amplifiedTemporalDays exige DATE + type ∈ allowlist (inchangé)',
  auth.includes('AMPLIFIED_PASSIVE_DATE_TYPES.has(s.dateType)') && auth.includes('TEMPORAL_AUTHORITY.DATE'));

console.log(`\nhomeAttentionTruth.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
