/**
 * STOCK UPDATE — contrat PUR V2. Test :
 *   node src/utils/stockUpdate.test.js
 * Couvre la part PURE de §33 (validation, monotonicité, clôture, déclarations qualitatives) + la règle de
 * PROJECTION cumulative (OR) appliquée côté serveur. Les scénarios d'idempotence/authz sont SQL (assertions
 * migration + roundtrip de déploiement).
 */
const { classifyStockUpdate, projectDeclarations, EVENT_KIND } = require('./stockUpdate');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };
const eff = (r) => (r && r.valid ? r.effect : null);

// A. UNKNOWN → HALF, aucune cause → actif, HALF, (f,f)
let e = eff(classifyStockUpdate({ beforeLevel: null, afterLevel: 'HALF' }));
ok('A UNKNOWN→HALF actif (f,f)', e && e.closesRow === false && e.newRemainingLevel === 'HALF' && e.usedDeclared === false && e.wasteDeclared === false);

// B. FULL → HALF, aucune cause → actif
e = eff(classifyStockUpdate({ beforeLevel: 'FULL', afterLevel: 'HALF' }));
ok('B FULL→HALF actif (f,f)', e && e.closesRow === false && e.newRemainingLevel === 'HALF');

// C. FULL → EMPTY, aucune cause → clôture, (f,f)
e = eff(classifyStockUpdate({ beforeLevel: 'FULL', afterLevel: 'EMPTY' }));
ok('C FULL→EMPTY no cause : clôture, (f,f) — jamais USED/WASTED/CORRECTED implicite',
  e && e.closesRow === true && e.setConsumed === true && e.usedDeclared === false && e.wasteDeclared === false && e.eventKind === EVENT_KIND.UPDATE);

// D. FULL → EMPTY, used only
e = eff(classifyStockUpdate({ beforeLevel: 'FULL', afterLevel: 'EMPTY', usedDeclared: true }));
ok('D FULL→EMPTY used : clôture, (t,f)', e && e.closesRow === true && e.usedDeclared === true && e.wasteDeclared === false);

// E. FULL → EMPTY, waste only
e = eff(classifyStockUpdate({ beforeLevel: 'FULL', afterLevel: 'EMPTY', wasteDeclared: true }));
ok('E FULL→EMPTY waste : clôture, (f,t)', e && e.closesRow === true && e.usedDeclared === false && e.wasteDeclared === true);

// F. FULL → EMPTY, both
e = eff(classifyStockUpdate({ beforeLevel: 'FULL', afterLevel: 'EMPTY', usedDeclared: true, wasteDeclared: true }));
ok('F FULL→EMPTY used+waste : clôture, (t,t) — le cas mixte est REPRÉSENTABLE', e && e.closesRow === true && e.usedDeclared === true && e.wasteDeclared === true);

// SA-04 : aucun % ni allocation dans l'effet
ok('SA-04 aucun %/allocation dans l\'effet', !/%/.test(JSON.stringify(e)) && e.usedDeclared === true && e.wasteDeclared === true);

// Same-band autorisé au niveau CONTRAT (compat old-client) — l'UX quick-update, elle, l'interdit.
ok('same-band HALF→HALF valide au contrat (compat)', classifyStockUpdate({ beforeLevel: 'HALF', afterLevel: 'HALF' }).valid === true);

// Monotonicité : augmentation → invalide, route CORRECTION
let r = classifyStockUpdate({ beforeLevel: 'HALF', afterLevel: 'FULL', usedDeclared: true });
ok('§8 augmentation HALF→FULL rejetée → route CORRECTION', r.valid === false && r.reason === 'INCREASE_NOT_ALLOWED' && r.route === 'CORRECTION');

// Rejet du NULL causal (pas de 3e état accidentel)
ok('INVALID_DECLARATION si used non-booléen', classifyStockUpdate({ afterLevel: 'HALF', usedDeclared: null }).valid === false && classifyStockUpdate({ afterLevel: 'HALF', usedDeclared: null }).reason === 'INVALID_DECLARATION');
ok('INVALID_AFTER_LEVEL si niveau inconnu', classifyStockUpdate({ afterLevel: 'HALFISH' }).valid === false);

// PROJECTION cumulative (OR) — jamais d'effacement (SA-05)
// G. prev waste + update used → both
ok('G projection : prev {waste} + update used → (used=t, waste=t) [SA-05 pas de perte]',
  JSON.stringify(projectDeclarations({ used: false, waste: true }, { usedDeclared: true, wasteDeclared: false })) === JSON.stringify({ used: true, waste: true }));
// H. prev used + update no cause → used only (unchanged)
ok('H projection : prev {used} + update (f,f) → (used=t, waste=f) inchangé',
  JSON.stringify(projectDeclarations({ used: true, waste: false }, { usedDeclared: false, wasteDeclared: false })) === JSON.stringify({ used: true, waste: false }));
ok('projection : (f,f)+(f,f) → (f,f) — no cause ne fabrique rien',
  JSON.stringify(projectDeclarations({}, {})) === JSON.stringify({ used: false, waste: false }));

console.log(`\nstockUpdate: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
