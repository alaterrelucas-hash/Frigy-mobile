/**
 * STOCK — STK-02 : SUPPRESSION-CORRECTION ≠ CONSOMMATION/GASPILLAGE. Régression SOURCE :
 *   node src/utils/stockDeleteCorrection.regression.test.js
 * Contrat : Mon Stock permet de RETIRER une entrée erronée (deleteItem) SANS écrire `consumed`/`wasted` ni
 * émettre d'event de consommation/gaspillage. Confirmation destructive obligatoire. La correction est
 * distincte des chemins consumeItem (consumed:true / wasted). Aucune économie/impact déduit.
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const src = read('../screens/FridgeScreen.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// Corps de deleteItem (du def jusqu'au prochain « const DetailModal »).
const dStart = src.indexOf('const deleteItem = (item) => {');
const dEnd = src.indexOf('const DetailModal', dStart);
const del = dStart >= 0 && dEnd > dStart ? src.slice(dStart, dEnd) : '';

// ── STK02-01 : deleteItem existe et supprime la LIGNE (items.delete), pas un consume/waste ──
ok('STK02-01 deleteItem supprime la ligne (supabase items.delete .eq id)',
  del.length > 0 && /supabase\.from\('items'\)\.delete\(\)\.eq\('id', item\.id\)/.test(del));

// ── STK02-02 : n'écrit NI consumed NI wasted ──
ok('STK02-02 deleteItem n\'écrit ni consumed ni wasted',
  del.length > 0 && !/consumed/.test(del) && !/wasted/.test(del));

// ── STK02-03 : aucun event de consommation/gaspillage (event neutre uniquement) ──
ok('STK02-03 aucun event product_consumed/product_wasted ; event neutre product_removed',
  del.length > 0 && !/product_consumed|product_wasted/.test(del) && /product_removed/.test(del));

// ── STK02-04 : confirmation destructive obligatoire ──
ok('STK02-04 confirmation destructive (Alert « Supprimer cette entrée ? » + style destructive)',
  /Alert\.alert\(\s*'Supprimer cette entrée \?'/.test(del) && /style: 'destructive'/.test(del));

// ── STK02-05 : copie explicite « ni consommé ni gaspillé » ──
ok('STK02-05 copie « ni consommé ni gaspillé »', /Ce n’est ni consommé ni gaspillé\./.test(del));

// ── STK02-06 : suppression prouvée d'abord (erreur → entrée conservée) ──
ok('STK02-06 erreur → entrée conservée (Alert « Impossible de supprimer » + return avant retrait UI)',
  /if \(error\) \{ Alert\.alert\('Impossible de supprimer'[\s\S]{0,40}return; \}[\s\S]{0,120}updateItems\(p => p\.filter/.test(del));

// ── STK02-07 : suppression DISTINCTE du chemin d'issue. La clôture consommé/gaspillé passe désormais par
//    la mutation canonique (applyPartialOutcome → EMPTY) ; deleteItem, lui, n'écrit NI consumed NI wasted. ──
ok('STK02-07 delete distinct de l\'issue (ni consumed ni wasted ; issue via applyStockUpdate)',
  /supabase\.from\('items'\)\.delete\(\)/.test(del) && !/consumed|wasted/.test(del) && /applyStockUpdate\(supabase/.test(src));

// ── STK02-08 : affordance UI = lien tertiaire « Supprimer cette entrée » (pas un gros panneau) ──
ok('STK02-08 affordance « Supprimer cette entrée » (TouchableOpacity → deleteItem, role button)',
  /onPress=\{\(\) => deleteItem\(item\)\}[\s\S]{0,160}Supprimer cette entrée/.test(src)
  && /accessibilityLabel="Supprimer cette entrée"/.test(src));

// ── STK02-09 : aucune économie / impact déduit de la suppression ──
ok('STK02-09 aucune économie/impact dans deleteItem (pas de €/économ/impact/saved)',
  del.length > 0 && !/€|économ|impact|saved|rescueValue/i.test(del));

console.log(`\nstockDeleteCorrection.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
