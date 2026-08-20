/**
 * N6-15 — Vérité du cleanup Courses (succès partiel). Régression SOURCE :
 *   node src/utils/coursesCleanupTruth.regression.test.js
 *
 * TYPE DE TEST : STATIC SOURCE CONTRACTS. Aucun rendu RN ni DB réelle ici → on prouve par la structure de
 * la source que (A) le succès Stock reste véridique et n'est jamais annulé, (B) l'échec de cleanup Courses
 * est explicitement communiqué (succès PARTIEL), (C) le retry reconnu ne réinsère jamais de Stock. Le
 * comportement réel (DELETE fault → message) est prouvé par le test device T6, pas ici.
 *
 * Contrat : STOCK OK + cleanup OK = succès complet ; STOCK OK + cleanup KO = succès PARTIEL (produit EN
 * stock, ligne courses NON retirée) — jamais « ajout impossible », jamais de rollback Stock.
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const scan = read('../screens/ScanScreen.js');
const app  = read('../../App.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// Bloc de succès frais (après insert Stock OK, contexte Courses).
const fresh = (scan.match(/const locLabel =[\s\S]*?onClose\(\);/) || [''])[0];
// Bloc retry reconnu (App preflight, ligne Stock déterministe déjà présente).
const retry = (app.match(/const cleanupOk = await cleanupShoppingRow\(shoppingItemId\);[\s\S]*?return;/) || [''])[0];

// ── CLEAN-T01/T02 : commit frais AWAIT + inspecte le booléen ──
ok('CLEAN-T01 fresh AWAIT onStockCommitted', /await onStockCommitted\(ctx\.shoppingItemId\)/.test(fresh));
ok('CLEAN-T02 fresh inspecte le résultat (=== true → cleanupOk)', /const cleanupOk = onStockCommitted \? \(await onStockCommitted\(ctx\.shoppingItemId\)\) === true : false/.test(fresh));

// ── CLEAN-T03/T04 : messagerie complète vs partielle selon le booléen ──
ok('CLEAN-T03 cleanup=true → message succès complet (✅ Ajouté !)', /if \(cleanupOk\) Alert\.alert\('✅ Ajouté !', `\$\{finalName\} rangé dans \$\{locLabel\}\.`\)/.test(fresh));
ok('CLEAN-T04 cleanup=false → message succès PARTIEL', /else Alert\.alert\('Ajouté au stock', `\$\{finalName\} est bien dans ton stock, mais la ligne n'a pas pu être retirée[\s\S]*?doublon\.`\)/.test(fresh));

// ── CLEAN-T05 : le partiel PRÉSERVE le succès Stock (« bien dans ton stock ») ──
ok('CLEAN-T05 partiel affirme le produit EN stock', /est bien dans ton stock/.test(fresh));
// ── CLEAN-T06 : le partiel ne prétend PAS que la suppression Courses a réussi + jamais « impossible » ──
ok('CLEAN-T06 partiel ne revendique PAS la suppression courses (n\'a pas pu être retirée)', /n'a pas pu être retirée de ta liste de courses/.test(fresh) && !/Ajout impossible/.test(fresh));

// ── CLEAN-T07 : aucun rollback Stock sur échec cleanup (le bloc frais ne supprime/màj JAMAIS items) ──
ok('CLEAN-T07 aucun rollback Stock (pas de delete/update items dans le bloc succès)',
  !/from\('items'\)\.delete\(/.test(fresh) && !/from\('items'\)\.update\(/.test(fresh) && !/\.delete\(\)\.eq\('id', data\.id\)/.test(fresh));

// ── CLEAN-T08/T09 : retry App AWAIT + inspecte cleanupShoppingRow ──
ok('CLEAN-T08 retry AWAIT cleanupShoppingRow', /const cleanupOk = await cleanupShoppingRow\(shoppingItemId\)/.test(retry));
ok('CLEAN-T09 retry inspecte le booléen (message dépend de cleanupOk)', /Alert\.alert\('Déjà dans ton stock', cleanupOk/.test(retry));

// ── CLEAN-T10/T11 : messages retry véridiques ──
ok('CLEAN-T10 retry cleanup=true → ligne retirée', /\? `« \$\{name\} » est déjà dans ton stock\. La ligne a été retirée de ta liste de courses\.`/.test(retry));
ok('CLEAN-T11 retry cleanup=false → déjà en stock + ligne NON retirée', /: `« \$\{name\} » est déjà dans ton stock, mais la ligne n'a pas pu être retirée de ta liste de courses\.`/.test(retry));

// ── CLEAN-T12/T13 : le retry reconnu ne touche JAMAIS l'insert Stock ──
ok('CLEAN-T12 retry reconnu ne contient AUCUN items.insert', !/from\('items'\)\.insert/.test(retry) && !/\.insert\(/.test(retry));
ok('CLEAN-T13 retry se termine par return sans insert (pas de 2e ligne Stock)', /return;\s*$/.test(retry.trim()) && /await cleanupShoppingRow/.test(retry));

// ── CLEAN-T14 : add manuel NON-Courses inchangé (branche else = ✅ Ajouté ! sans cleanup requis) ──
ok('CLEAN-T14 non-Courses (ctx null) → ✅ Ajouté ! sans cleanup', /\} else \{\s*Alert\.alert\('✅ Ajouté !', `\$\{finalName\} rangé dans \$\{locLabel\}\.`\);\s*\}/.test(fresh));

// ── CLEAN-T15 : reprise 23505 = MÊME vérité de cleanup (parité — voir coursesRaceTruth). Reconnaissance
//    déterministe + lignée conservées ; cleanup awaité/inspecté ; message neutre "Déjà dans ton stock". ──
ok('CLEAN-T15 23505 recovery à parité de vérité (await + cleanupOk + message neutre "Déjà dans ton stock")',
  /if \(ctx\?\.deterministicItemId && error\.code === '23505'\)/.test(scan)
  && /const cleanupOk = onStockCommitted \? \(await onStockCommitted\(ctx\.shoppingItemId\)\) === true : false;\s*\n\s*consumeCourseCtx\(\);\s*\n\s*Alert\.alert\('Déjà dans ton stock', cleanupOk/.test(scan));

// ── CLEAN-T16 : identité/lignée/writer inchangés ──
ok('CLEAN-T16 deterministic id + lineage attach inchangés (1 site chacun)',
  (scan.match(/newItem\.id = ctx\.deterministicItemId/g) || []).length === 1
  && (scan.match(/newItem\.assertion_provenance\.lineage = ctx\.lineage/g) || []).length === 1);
ok('CLEAN-T16 cleanupShoppingRow reste DB-first booléen (delete → !error → true, sinon false)',
  /const \{ error \} = await supabase\.from\('shopping_items'\)\.delete\(\)\.eq\('id', shoppingItemId\);\s*\n\s*if \(!error\) \{ setRemovedShoppingId\(shoppingItemId\); return true; \}\s*\n\s*return false;/.test(app));

console.log(`\ncoursesCleanupTruth.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
