/**
 * N6-15 — Parité de vérité du cleanup dans la reprise idempotente 23505 (course concurrente). Régression :
 *   node src/utils/coursesRaceTruth.regression.test.js
 *
 * TYPE DE TEST : STATIC SOURCE CONTRACTS. Le comportement réel (insert → 23505 → re-SELECT → message) est
 * prouvé par le test device 23505 à venir. Ici on prouve par la structure que la branche 23505 reconnue
 * atteint EXACTEMENT la même vérité de cleanup que (fresh insert) et (App preflight retry) : un 23505 seul
 * n'est jamais un succès ; reconnaissance = re-SELECT + foyer + lignée COURSES + shoppingItemId ; collision
 * étrangère = FAIL CLOSED (aucun cleanup) ; la ligne existante fait autorité (aucun UPDATE, valeurs du 2e
 * formulaire jamais revendiquées) ; cleanup awaité + inspecté → message véridique ; contexte consommé.
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const scan = read('../screens/ScanScreen.js');
const app  = read('../../App.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// Branche 23505 complète (jusqu'à sa fermeture) + sous-branche reconnue + chemin étranger (fail-closed).
const branch = (scan.match(/if \(ctx\?\.deterministicItemId && error\.code === '23505'\) \{[\s\S]*?\n      \}/) || [''])[0];
const recognized = (branch.match(/if \(existing && existing\.family_id === familyId[\s\S]*?onClose\(\); return;\n        \}/) || [''])[0];
const foreign = branch.slice(branch.indexOf(recognized) + recognized.length); // après la reconnaissance
const fresh = (scan.match(/const locLabel =[\s\S]*?onClose\(\);/) || [''])[0];

// ── RACE-T01 : 23505 seul n'est PAS un succès (cleanup/message gardés derrière la reconnaissance) ──
ok('RACE-T01 23505 seul ≠ succès (cleanup UNIQUEMENT dans la branche reconnue, jamais dans le chemin étranger)',
  /onStockCommitted/.test(recognized) && !/onStockCommitted/.test(foreign));

// ── RACE-T02 : re-SELECT de la ligne déterministe ──
ok('RACE-T02 re-SELECT deterministic id (family_id, assertion_provenance)',
  /const \{ data: existing \} = await supabase\.from\('items'\)\s*\n?\s*\.select\('family_id, assertion_provenance'\)\.eq\('id', ctx\.deterministicItemId\)\.maybeSingle\(\)/.test(branch));

// ── RACE-T03/T04/T05 : reconnaissance exige foyer + lignée COURSES + shoppingItemId ──
ok('RACE-T03 foyer vérifié', /existing\.family_id === familyId/.test(recognized));
ok('RACE-T04 lignée COURSES vérifiée', /lin\.kind === 'COURSES'/.test(recognized));
ok('RACE-T05 shoppingItemId vérifié', /lin\.shoppingItemId === ctx\.shoppingItemId/.test(recognized));

// ── RACE-T06/T07 : cleanup awaité + inspecté (parité fresh/retry) ──
ok('RACE-T06 recognized AWAIT onStockCommitted', /await onStockCommitted\(ctx\.shoppingItemId\)/.test(recognized));
ok('RACE-T07 résultat inspecté (cleanupOk === true booléen)',
  /const cleanupOk = onStockCommitted \? \(await onStockCommitted\(ctx\.shoppingItemId\)\) === true : false/.test(recognized));

// ── RACE-T08/T09 : messages véridiques ──
ok('RACE-T08 succès → déjà en stock + ligne retirée',
  /Cet article est déjà dans ton stock\. La ligne a été retirée de ta liste de courses\./.test(recognized));
ok('RACE-T09 échec → déjà en stock + ligne NON retirée',
  /Cet article est déjà dans ton stock, mais la ligne n\\?'a pas pu être retirée de ta liste de courses\./.test(recognized));

// ── RACE-T10 : aucun UPDATE correctif de la ligne Stock existante ──
ok('RACE-T10 aucun items.update dans la branche 23505', !/\.update\(/.test(branch));

// ── RACE-T11 : les valeurs du 2e formulaire ne sont PAS revendiquées (message neutre, pas de finalName) ──
ok('RACE-T11 message neutre : ni finalName, ni « rangé dans » dans la branche reconnue',
  !/finalName/.test(recognized) && !/rangé dans/.test(recognized));

// ── RACE-T12 : contexte Courses consommé ──
ok('RACE-T12 consumeCourseCtx() dans la branche reconnue', /consumeCourseCtx\(\)/.test(recognized));

// ── RACE-T13 : jamais de 2e insertion Stock (branche reconnue se termine par return, aucun insert) ──
ok('RACE-T13 aucune 2e insertion (pas d\'items.insert ; return final)',
  !/\.insert\(/.test(branch) && /onClose\(\); return;/.test(recognized));

// ── RACE-T14 : collision ÉTRANGÈRE = fail closed (aucun cleanup/onStockCommitted) ──
ok('RACE-T14 chemin étranger : « Impossible d\'ajouter », aucun onStockCommitted/cleanup',
  /Impossible d\\?'ajouter/.test(foreign) && !/onStockCommitted/.test(foreign) && !/cleanupShoppingRow/.test(foreign));

// ── RACE-T15 : vérité du cleanup fresh insert INCHANGÉE ──
ok('RACE-T15 fresh insert cleanup truth inchangée',
  /const cleanupOk = onStockCommitted \? \(await onStockCommitted\(ctx\.shoppingItemId\)\) === true : false/.test(fresh)
  && /Ajouté au stock/.test(fresh));

// ── RACE-T16 : vérité du retry App preflight INCHANGÉE ──
ok('RACE-T16 App preflight retry truth inchangée',
  /const cleanupOk = await cleanupShoppingRow\(shoppingItemId\)/.test(app)
  && /Alert\.alert\('Déjà dans ton stock', cleanupOk/.test(app));

console.log(`\ncoursesRaceTruth.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
