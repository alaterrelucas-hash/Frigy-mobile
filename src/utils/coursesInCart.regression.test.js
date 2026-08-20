/**
 * N6-15 — « Dans le panier » canonique (champ DB `shopping_items.done`). Régression SOURCE :
 *   node src/utils/coursesInCart.regression.test.js
 * Contrat : le client lit/écrit `done` (jamais la colonne fantôme `checked`), bascule PESSIMISTE
 * (DB avant UI, erreur inspectée, verrou par ligne), `done` = « dans le panier » seulement (jamais
 * acheté/stock), handoff indépendant de done. Contrat STATIQUE — la persistance réelle est prouvée par
 * le test device (E-D1..E-D4).
 */
const fs = require('fs');
const path = require('path');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const slice = (src, header) => { const i = src.indexOf(header); if (i < 0) return ''; const e = src.indexOf('\n  };', i); return src.slice(i, e < 0 ? undefined : e + 5); };

const shopRaw = read('../screens/ShoppingListScreen.js');
const shop = stripComments(shopRaw);
const appRaw = read('../../App.js');
const toggle = stripComments(slice(shopRaw, 'const toggleItem'));
const clear  = stripComments(slice(shopRaw, 'const clearChecked'));
const add    = stripComments(slice(shopRaw, 'const addItem'));

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── DONE-T01 : lit `done`, jamais la colonne persistée fantôme `checked` ──
ok('DONE-T01 lit item.done (état panier canonique)', /\bi\.done\b/.test(shop) && /item\.done/.test(shop));
// Le `checked:` d'accessibilityState est la prop RN a11y (lit item.done) → autorisé. On interdit le
// `checked` PERSISTÉ : lecture .checked / item.checked / clé de payload insert/update.
ok('DONE-T01 aucun `checked` persisté (.checked / item.checked / clé payload)',
  !/\.checked\b/.test(shop) && !/item\.checked/.test(shop) && !/(insert|update)\(\{[^}]*\bchecked\b/.test(shop));

// ── DONE-T02 : nouvelle ligne → done=false ; jamais checked dans le payload ──
ok('DONE-T02 addItem : done:false (temp) + insert sans checked', /done: false/.test(add) && !/checked/.test(add.replace(/done: false/g, '')));
ok('DONE-T02 insert shopping_items ne pousse pas `checked`', !/insert\(\{[^}]*checked/.test(add));

// ── DONE-T03/T04 : toggle écrit { done: nextDone }, jamais checked ──
ok('DONE-T03 toggle UPDATE { done: nextDone }', /update\(\{ done: nextDone \}\)/.test(toggle));
ok('DONE-T04 toggle n\'écrit pas `checked`', !/checked/.test(toggle));

// ── DONE-T05/T06 : erreur inspectée ; UI seulement APRÈS succès DB ──
ok('DONE-T05 erreur DB inspectée (const { error })', /const \{ error \} = await supabase\.from\('shopping_items'\)\.update\(\{ done:/.test(toggle));
ok('DONE-T06 setItems local UNIQUEMENT si !error (pas d\'optimiste)', /if \(!error\) setItems/.test(toggle) && !/setItems\([\s\S]*?\n[\s\S]*?await supabase/.test(toggle));
ok('DONE-T06 échec → feedback neutre, aucune fausse affirmation', /else Alert\.alert\('Panier non enregistré'/.test(toggle));

// ── DONE-T07 : verrou par ligne anti-course ──
ok('DONE-T07 verrou par ligne (pendingDoneRef has/add/delete)', /pendingDoneRef\.current\.has\(item\.id\)/.test(toggle) && /pendingDoneRef\.current\.add\(item\.id\)/.test(toggle) && /pendingDoneRef\.current\.delete\(item\.id\)/.test(toggle));

// ── DONE-T08/T09 : partition depuis done ──
ok('DONE-T08 filtre « à acheter » = done !== true', /items\.filter\(i => i\.done !== true\)/.test(shop));
ok('DONE-T09 filtre « DANS LE PANIER » = done === true', /items\.filter\(i => i\.done === true\)/.test(shop));

// ── DONE-T10/T11/T12 : clear pessimiste sur done ──
ok('DONE-T10 clear sélectionne UNIQUEMENT done===true', /items\.filter\(i => i\.done === true\)\.map\(i => i\.id\)/.test(clear));
ok('DONE-T11 retrait local UNIQUEMENT après delete DB confirmé', /const \{ error \} = await supabase\.from\('shopping_items'\)\.delete\(\)\.in\('id', ids\)/.test(clear) && /if \(!error\) setItems\(prev => prev\.filter\(i => !\(i\.done === true\)\)\)/.test(clear));
ok('DONE-T12 échec delete → lignes conservées (else Alert, pas de setItems)', /else Alert\.alert\('Suppression non effectuée'/.test(clear));

// ── DONE-T13/T14/T15 : done ≠ acheté/stock ; toggle ne mute pas Stock ni handoff ──
ok('DONE-T13 done jamais interprété « acheté » (aucun purchased ; aucun done→items.insert)', !/purchased/.test(shop) && !/i\.done[\s\S]{0,40}from\('items'\)/.test(shop));
ok('DONE-T14 toggle n\'insère JAMAIS dans items (Stock)', !/from\('items'\)/.test(toggle) && !/\.insert\(/.test(toggle));
ok('DONE-T15 toggle n\'invoque JAMAIS le handoff', !/onSendToStock/.test(toggle));

// ── DONE-T16 : handoff id/name/quantity based, indépendant de done ──
ok('DONE-T16 onSendToStock = shoppingItemId + name + quantity (aucun done)', /onSendToStock\(\{ shoppingItemId: item\.id, name: item\.name, quantity: readShoppingQty\(item\.quantity\) \}\)/.test(shopRaw) && !/onSendToStock\([^)]*done/.test(shopRaw));
ok('DONE-T16 App handleSendToStock ne dépend pas de done', (() => { const s = stripComments(slice(appRaw, 'const handleSendToStock')); return !/\bdone\b/.test(s); })());

console.log(`\ncoursesInCart.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
