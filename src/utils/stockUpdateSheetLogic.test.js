/**
 * STOCK UPDATE SHEET — logique PURE V2. Test :
 *   node src/utils/stockUpdateSheetLogic.test.js
 * §8 (strictement inférieur), §9 (baseline ≠ sélection), §5/§6 (cause visible seulement à EMPTY, reset),
 * §UX canSubmit (cause jamais requise). Cohérence avec le contrat DB (stockUpdate.js).
 *
 * MIGRATION §38 :
 *   OLD : canSubmit(outcomeType requis) ; isLevelSelectable autorisait l'égalité (same-band).
 *   NEW : remaining-first ; cause optionnelle et seulement à EMPTY ; quick-update = strictement inférieur.
 */
const L = require('./stockUpdateSheetLogic');
const { classifyStockUpdate, REMAINING_LEVELS } = require('./stockUpdate');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── Niveaux ──
ok('5 crans EMPTY→FULL, identiques au contrat DB', L.REMAINING_STOPS.map(s => s.level).join(',') === REMAINING_LEVELS.join(','));
ok('correction = 4 niveaux, EMPTY exclu', L.CORRECTION_STOPS.map(s => s.level).join(',') === 'QUARTER,HALF,THREE_QUARTERS,FULL');
ok('labels humains, jamais un %', L.REMAINING_STOPS.map(s => s.label).join(',') === 'Vide,¼,Moitié,¾,Plein' && !/%/.test(JSON.stringify(L.REMAINING_STOPS)));
ok('voix accessibilité (jamais « 25 % »)', L.remainingVoice('QUARTER') === 'Un quart' && L.remainingVoice(null) === 'Non renseigné');
ok('remainingLabel(null) = Non renseigné (jamais FULL/1)', L.remainingLabel(null) === 'Non renseigné' && L.remainingLabel('HALF') === 'Moitié');

// ── §8 transitions STRICTEMENT inférieures (quick-update) ──
ok('§8 FULL → ¾/½/¼/EMPTY sélectionnables, FULL non',
  ['THREE_QUARTERS','HALF','QUARTER','EMPTY'].every(l => L.isLevelSelectable(l,'FULL')) && !L.isLevelSelectable('FULL','FULL'));
ok('§8 HALF → ¼/EMPTY seulement (pas HALF, pas ¾/Plein)',
  L.isLevelSelectable('QUARTER','HALF') && L.isLevelSelectable('EMPTY','HALF') && !L.isLevelSelectable('HALF','HALF') && !L.isLevelSelectable('THREE_QUARTERS','HALF') && !L.isLevelSelectable('FULL','HALF'));
ok('§8 QUARTER → EMPTY seulement', L.isLevelSelectable('EMPTY','QUARTER') && !L.isLevelSelectable('QUARTER','QUARTER'));
ok('§8 même niveau JAMAIS sélectionnable (→ « Rien n\'a changé »)', !L.isLevelSelectable('HALF','HALF') && !L.isLevelSelectable('FULL','FULL'));
ok('§8 UNKNOWN → les 5 crans sélectionnables', ['EMPTY','QUARTER','HALF','THREE_QUARTERS','FULL'].every(l => L.isLevelSelectable(l, null)));

// ── §5/§6 cause visible SEULEMENT à EMPTY + reset hors EMPTY ──
ok('§6 causeVisible seulement pour EMPTY', L.causeVisible('EMPTY') === true && ['QUARTER','HALF','THREE_QUARTERS','FULL'].every(l => L.causeVisible(l) === false));
ok('§5/§9 sanitizeCauses hors EMPTY force (false,false)', JSON.stringify(L.sanitizeCauses('HALF', true, true)) === JSON.stringify({ usedDeclared: false, wasteDeclared: false }));
ok('§6 sanitizeCauses à EMPTY préserve les bascules', JSON.stringify(L.sanitizeCauses('EMPTY', true, false)) === JSON.stringify({ usedDeclared: true, wasteDeclared: false }));

// ── canSubmit : niveau explicite requis, cause JAMAIS requise ──
ok('CTA inactif sans sélection (baseline seul ne suffit pas)', !L.canSubmit({ selectedLevel: null, beforeLevel: 'FULL' }));
ok('CTA inactif si niveau = baseline (pas strictement inférieur)', !L.canSubmit({ selectedLevel: 'HALF', beforeLevel: 'HALF' }));
ok('CTA inactif si augmentation', !L.canSubmit({ selectedLevel: 'FULL', beforeLevel: 'HALF' }));
ok('CTA actif niveau inférieur (cause non requise)', L.canSubmit({ selectedLevel: 'QUARTER', beforeLevel: 'HALF' }));
ok('CTA actif UNKNOWN + niveau choisi', L.canSubmit({ selectedLevel: 'HALF', beforeLevel: null }));
ok('CTA actif EMPTY sans cause (cause optionnelle)', L.canSubmit({ selectedLevel: 'EMPTY', beforeLevel: 'HALF' }));

// ── closesRow ──
ok('EMPTY clôt, autres non', L.closesRow('EMPTY') === true && ['QUARTER','HALF','THREE_QUARTERS','FULL'].every(l => L.closesRow(l) === false));

// ── §15 clientEventId ──
ok('clientEventId déterministe (mêmes now/rand)', L.makeClientEventId('it1', 1000, 0.5) === L.makeClientEventId('it1', 1000, 0.5));
ok('clientEventId varie si intention (rand) change', L.makeClientEventId('it1', 1000, 0.5) !== L.makeClientEventId('it1', 1000, 0.9));

// ── Cohérence UI ↔ contrat DB (stockUpdate.classifyStockUpdate) ──
// L'UI n'offre que du strictement inférieur ; le contrat DB accepte aussi l'égalité (compat) — donc
// tout ce que l'UI autorise, le contrat DB le valide.
[['HALF',null],['QUARTER','HALF'],['EMPTY','HALF'],['THREE_QUARTERS','FULL']].forEach(([after, before]) => {
  if (L.canSubmit({ selectedLevel: after, beforeLevel: before })) {
    const db = classifyStockUpdate({ beforeLevel: before, afterLevel: after, usedDeclared: false, wasteDeclared: false }).valid;
    ok(`cohérence UI→DB ${before}→${after}`, db === true);
  }
});

console.log(`\nstockUpdateSheetLogic: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
