/**
 * PARTIAL OUTCOME — contrat canonique (V1). Test PUR :
 *   node src/utils/partialOutcome.test.js
 * Couvre §27 (sémantique des transitions), §28 (frontières d'autorité), §33 (self-audit).
 */
const { classifyPartialOutcome, classifyCorrection, REMAINING_LEVELS, OUTCOME_TYPES, REMAINING_AUTHORITY,
  isRemainingLevel, isBeforeLevel, remainingProvenancePatch } = require('./partialOutcome');
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, 'partialOutcome.js'), 'utf8');
// Code sans commentaires : le §28 interdit ces notions dans le CONTRAT, pas dans la doc qui explique la frontière.
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };
const eff = (r) => (r && r.valid ? r.effect : null);

// ── §27 SÉMANTIQUE ──
let r = classifyPartialOutcome({ beforeLevel: null, afterLevel: 'HALF', outcomeType: 'USED' });
ok('UNKNOWN→HALF+USED valide, actif (consumed=false), niveau=HALF, event USED',
  eff(r) && eff(r).setConsumed === false && eff(r).closesRow === false && eff(r).newRemainingLevel === 'HALF' && eff(r).eventType === 'USED');
r = classifyPartialOutcome({ beforeLevel: null, afterLevel: 'HALF', outcomeType: 'WASTED' });
ok('UNKNOWN→HALF+WASTED valide, actif, wasted NON déclaré sur row active',
  eff(r) && eff(r).setConsumed === false && eff(r).setWasted === false && eff(r).newRemainingLevel === 'HALF');
r = classifyPartialOutcome({ beforeLevel: 'FULL', afterLevel: 'THREE_QUARTERS', outcomeType: 'USED' });
ok('FULL→¾+USED valide actif', eff(r) && eff(r).closesRow === false && eff(r).newRemainingLevel === 'THREE_QUARTERS');
r = classifyPartialOutcome({ beforeLevel: 'FULL', afterLevel: 'HALF', outcomeType: 'USED' });
ok('FULL→HALF+USED valide actif', eff(r) && eff(r).setConsumed === false);
r = classifyPartialOutcome({ beforeLevel: 'FULL', afterLevel: 'QUARTER', outcomeType: 'WASTED' });
ok('FULL→¼+WASTED valide, row RESTE active (pas de wasted=true)', eff(r) && eff(r).setConsumed === false && eff(r).setWasted === false);
r = classifyPartialOutcome({ beforeLevel: 'HALF', afterLevel: 'QUARTER', outcomeType: 'USED' });
ok('HALF→¼+USED valide actif', eff(r) && eff(r).newRemainingLevel === 'QUARTER');
r = classifyPartialOutcome({ beforeLevel: 'HALF', afterLevel: 'EMPTY', outcomeType: 'USED' });
ok('HALF→EMPTY+USED = clôture TOTALE (consumed=true, wasted=false)',
  eff(r) && eff(r).closesRow === true && eff(r).setConsumed === true && eff(r).setWasted === false);
r = classifyPartialOutcome({ beforeLevel: 'HALF', afterLevel: 'EMPTY', outcomeType: 'WASTED' });
ok('HALF→EMPTY+WASTED = clôture TOTALE gaspillée (consumed=true, wasted=true)',
  eff(r) && eff(r).closesRow === true && eff(r).setConsumed === true && eff(r).setWasted === true);
r = classifyPartialOutcome({ beforeLevel: 'HALF', afterLevel: 'FULL', outcomeType: 'USED' });
ok('HALF→FULL+USED REJETÉ (augmentation) → route CORRECTION',
  r && r.valid === false && r.reason === 'INCREASE_NOT_ALLOWED' && r.route === 'CORRECTION');
r = classifyPartialOutcome({ beforeLevel: null, afterLevel: 'FULL', outcomeType: 'USED' });
ok('UNKNOWN→FULL+USED valide (§11 policy A : « pris un peu, encore ~plein »)', eff(r) && eff(r).newRemainingLevel === 'FULL');

// §13 même niveau autorisé (petite conso/perte réelle sans franchir un cran approximatif)
r = classifyPartialOutcome({ beforeLevel: 'HALF', afterLevel: 'HALF', outcomeType: 'USED' });
ok('§13 HALF→HALF+USED AUTORISÉ (événement causal vrai, bande inchangée)', eff(r) && eff(r).newRemainingLevel === 'HALF' && eff(r).closesRow === false);
r = classifyPartialOutcome({ beforeLevel: 'FULL', afterLevel: 'FULL', outcomeType: 'WASTED' });
ok('§13 FULL→FULL+WASTED AUTORISÉ (row active)', eff(r) && eff(r).setConsumed === false && eff(r).setWasted === false);

// §6 row DÉJÀ close → toute nouvelle issue partielle rejetée (pas de réouverture ici)
r = classifyPartialOutcome({ beforeLevel: 'HALF', afterLevel: 'QUARTER', outcomeType: 'USED', closed: true });
ok('§6 partiel sur row close → ITEM_ALREADY_CLOSED', r && r.valid === false && r.reason === 'ITEM_ALREADY_CLOSED');
r = classifyPartialOutcome({ beforeLevel: 'HALF', afterLevel: 'EMPTY', outcomeType: 'WASTED', closed: true });
ok('§6 clôture EMPTY sur row DÉJÀ close → ITEM_ALREADY_CLOSED', r && r.valid === false && r.reason === 'ITEM_ALREADY_CLOSED');

// partial USED/WASTED n'écrivent jamais consumed/wasted sur row active
['QUARTER', 'HALF', 'THREE_QUARTERS', 'FULL'].forEach((lvl) => {
  const u = eff(classifyPartialOutcome({ beforeLevel: null, afterLevel: lvl, outcomeType: 'USED' }));
  const w = eff(classifyPartialOutcome({ beforeLevel: null, afterLevel: lvl, outcomeType: 'WASTED' }));
  ok(`partiel ${lvl} USED ne clôt pas la row`, u && u.setConsumed === false && u.closesRow === false);
  ok(`partiel ${lvl} WASTED ne clôt pas la row`, w && w.setConsumed === false && w.setWasted === false);
});

// ── CORRECTION (§11/§13) : jamais consommation/gaspillage, tout sens autorisé sur niveaux ACTIFS ──
['QUARTER', 'HALF', 'THREE_QUARTERS', 'FULL'].forEach((lvl) => {
  const c = eff(classifyCorrection(lvl));
  ok(`CORRECTION ${lvl} : CORRECTED, jamais consumed/wasted, ne clôt pas`,
    c && c.eventType === 'CORRECTED' && c.setConsumed === false && c.setWasted === false && c.closesRow === false && c.newRemainingLevel === lvl);
});
ok('CORRECTION HALF→FULL autorisée (pas de monotonicité)', classifyCorrection('FULL').valid === true);
// §7 : EMPTY n'est pas un état actif corrigeable — pour vider, déclarer USED/WASTED (route OUTCOME).
ok('§7 CORRECTION EMPTY REJETÉE → route OUTCOME (jamais actif+EMPTY)',
  classifyCorrection('EMPTY').valid === false && classifyCorrection('EMPTY').reason === 'EMPTY_REQUIRES_OUTCOME' && classifyCorrection('EMPTY').route === 'OUTCOME');
// §6 : correction sur row close rejetée (jamais consumed=true + niveau actif).
ok('§6 CORRECTION sur row close → ITEM_ALREADY_CLOSED',
  classifyCorrection('FULL', { closed: true }).valid === false && classifyCorrection('FULL', { closed: true }).reason === 'ITEM_ALREADY_CLOSED');
ok('§6 close prime sur EMPTY (row close corrigée en EMPTY → toujours rejet)',
  classifyCorrection('EMPTY', { closed: true }).valid === false);

// ── Validation d'entrée ──
ok('outcomeType invalide rejeté', classifyPartialOutcome({ afterLevel: 'HALF', outcomeType: 'CORRECTED' }).valid === false);
ok('afterLevel invalide rejeté', classifyPartialOutcome({ afterLevel: 'HALFISH', outcomeType: 'USED' }).valid === false);
ok('beforeLevel invalide (string magique) rejeté', classifyPartialOutcome({ beforeLevel: 'UNKNOWN', afterLevel: 'HALF', outcomeType: 'USED' }).valid === false);
ok('UNKNOWN = null accepté comme before', isBeforeLevel(null) && !isBeforeLevel('UNKNOWN'));

// ── §28 FRONTIÈRES D'AUTORITÉ (le module ne propage rien vers quantité/éco/recette/courses) ──
ok('enum fermé 5 niveaux', REMAINING_LEVELS.length === 5 && REMAINING_LEVELS[0] === 'EMPTY' && REMAINING_LEVELS[4] === 'FULL');
// §2 : autorité = DIRECT (vocabulaire canonique existant), PAS un second vocabulaire « USER_ASSERTED ».
ok('§2 autorité = DIRECT (vocabulaire canonique, pas de parallèle)', REMAINING_AUTHORITY === 'DIRECT');
ok('§2 aucun vocabulaire d’autorité parallèle (USER_ASSERTED proscrit dans le code)', !/USER_ASSERTED/.test(code));
ok('aucun % / poids / unité / €/économie / recette / courses dans le contrat pur',
  !/%|gram|gramme|litre|\beuro\b|€|économ|rescue|recipe|recette|sufficien|courses|shopping|quantityAuthority|KNOWN exact/i.test(code));
ok('provenance additive = { remaining: { authority: DIRECT } } (mirroir quantity, aucune quantité exacte)',
  JSON.stringify(remainingProvenancePatch()) === JSON.stringify({ remaining: { authority: 'DIRECT' } }));
ok('UNKNOWN jamais fabriqué en défaut (pas de fallback FULL/1/HALF dans le module)',
  !/\|\|\s*'FULL'|default.*FULL|beforeLevel = 'FULL'|afterLevel = 'FULL'/.test(src));

console.log(`\npartialOutcome: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
