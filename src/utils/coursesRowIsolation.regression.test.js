/**
 * N6-15 — Isolation d'interaction des lignes Courses. Régression SOURCE :
 *   node src/utils/coursesRowIsolation.regression.test.js
 * Contrat : SEULE la case à cocher explicite bascule `done`. La LIGNE entière n'est plus un toggle
 * (aucun parent tappable) → un tap quantité/handoff/delete ne peut JAMAIS basculer « dans le panier ».
 * Contrat STATIQUE — le hit-testing natif réel est prouvé par le test device (ISO-E1).
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const shopRaw = read('../screens/ShoppingListScreen.js');

// Blocs de ligne (active / dans le panier).
const uBlock = shopRaw.slice(shopRaw.indexOf('{unchecked.map(item'), shopRaw.indexOf('{checked.length'));
const cBlock = shopRaw.slice(shopRaw.indexOf('{checked.map(item'), shopRaw.indexOf('onPress={clearChecked}'));

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── ISO-T01/T02 : la LIGNE (active + panier) n'est PAS un toggle (conteneur <View>, pas de row onPress) ──
ok('ISO-T01 ligne active = <View> (pas de TouchableOpacity de ligne)', /\{unchecked\.map\(item => \(\s*<View key=\{item\.id\}/.test(shopRaw) && !/\{unchecked\.map\(item => \(\s*<TouchableOpacity[^>]*onPress=\{\(\) => toggleItem/.test(shopRaw));
ok('ISO-T02 ligne panier = <View> (pas de TouchableOpacity de ligne)', /\{checked\.map\(item => \(\s*<View key=\{item\.id\}/.test(shopRaw) && !/\{checked\.map\(item => \(\s*<TouchableOpacity[^>]*onPress=\{\(\) => toggleItem/.test(shopRaw));

// ── ISO-T03/T04 : la case explicite (et elle seule) appelle toggleItem ──
ok('ISO-T03 case active : TouchableOpacity onPress toggleItem enveloppe <Circle>', /<TouchableOpacity onPress=\{\(\) => toggleItem\(item\)\}[\s\S]*?<Circle /.test(uBlock));
ok('ISO-T04 case panier : TouchableOpacity onPress toggleItem enveloppe <CheckCircle2>', /<TouchableOpacity onPress=\{\(\) => toggleItem\(item\)\}[\s\S]*?<CheckCircle2 /.test(cBlock));
ok('ISO exactement 2 appels toggleItem (les 2 cases uniquement)', (shopRaw.match(/toggleItem\(item\)/g) || []).length === 2);

// ── ISO-T05/T06/T07 : accessibilité case ──
ok('ISO-T06 accessibilityRole="checkbox" (2 cases)', (shopRaw.match(/accessibilityRole="checkbox"/g) || []).length === 2);
ok('ISO-T05/T07 accessibilityState dérive de item.done', (shopRaw.match(/accessibilityState=\{\{ checked: item\.done === true \}\}/g) || []).length === 2);

// ── ISO-T08/T09 : quantité ± n'appelle JAMAIS toggleItem ──
ok('ISO-T08 minus → updateQty (jamais toggleItem)', /onPress=\{\(\) => updateQty\(item, decShoppingQty/.test(uBlock));
ok('ISO-T09 plus → updateQty (jamais toggleItem)', /onPress=\{\(\) => updateQty\(item, incShoppingQty/.test(uBlock));
ok('ISO ± ne référencent pas toggleItem', (() => { const step = (uBlock.match(/<View style=\{\{ flexDirection: 'row'[\s\S]*?<\/View>/) || [''])[0]; return !/toggleItem/.test(step); })());

// ── ISO-T10/T11 : handoff / delete n'appellent JAMAIS toggleItem ──
ok('ISO-T10 handoff → handleSendToStock (jamais toggleItem)', /onPress=\{\(\) => handleSendToStock\(item\)\}/.test(uBlock) && /onPress=\{\(\) => handleSendToStock\(item\)\}/.test(cBlock));
ok('ISO-T11 delete → deleteItem (jamais toggleItem)', /onPress=\{\(\) => deleteItem\(item\.id\)\}/.test(uBlock) && /onPress=\{\(\) => deleteItem\(item\.id\)\}/.test(cBlock));

// ── ISO-T12 : logique quantité INCHANGÉE (pessimiste, verrou, payload quantity) ──
const upd = shopRaw.slice(shopRaw.indexOf('const updateQty'), shopRaw.indexOf('const handleSendToStock'));
ok('ISO-T12 updateQty inchangé (pendingQtyRef + update({quantity}) + UI après succès)',
  /pendingQtyRef\.current\.has\(item\.id\)/.test(upd) && /update\(\{ quantity: stored \}\)/.test(upd) && /if \(!error\) setItems/.test(upd));

// ── ISO-T13 : toggle `done` DB-first INCHANGÉ ──
const tog = shopRaw.slice(shopRaw.indexOf('const toggleItem'), shopRaw.indexOf('const deleteItem'));
ok('ISO-T13 toggleItem DB-first (update({done}) + if(!error) + pendingDoneRef)',
  /update\(\{ done: nextDone \}\)/.test(tog) && /if \(!error\) setItems/.test(tog) && /pendingDoneRef\.current\.has\(item\.id\)/.test(tog));

// ── ISO-T14 : aucune dépendance PERSISTÉE `checked` (le `checked:` d'accessibilityState = prop RN a11y,
//    autorisé — il lit item.done). Interdits : lecture .checked / item.checked / clé payload insert/update.
ok('ISO-T14 aucun `checked` persisté (.checked / item.checked / clé payload)',
  !/\.checked\b/.test(shopRaw) && !/item\.checked/.test(shopRaw) && !/(insert|update)\(\{[^}]*\bchecked\b/.test(shopRaw));

// ── ISO-T15 : handoff INCHANGÉ (id/name/quantity) ──
ok('ISO-T15 onSendToStock = shoppingItemId+name+quantity (aucun done)', /onSendToStock\(\{ shoppingItemId: item\.id, name: item\.name, quantity: readShoppingQty\(item\.quantity\) \}\)/.test(shopRaw) && !/onSendToStock\([^)]*done/.test(shopRaw));

console.log(`\ncoursesRowIsolation.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
