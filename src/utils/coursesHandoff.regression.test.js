/**
 * N6-15 — COURSES EXECUTION TRUTH (design canonique). Régression de TEXTE statique sur
 * ShoppingListScreen.js + App.js + ScanScreen.js.
 *   node src/utils/coursesHandoff.regression.test.js
 * Contrat : Courses INITIE → formulaire MANUEL CANONIQUE (ScanScreen) → writer canonique unique ;
 * id Stock déterministe (idempotence dure) ; lignée = origine (jamais autorité) ; cleanup après commit ;
 * pas de fuite de contexte ; quantité pessimiste ; cap/provenance/lifecycle préservés. (Contrat statique —
 * la vérité runtime des chemins 23505/pré-vol exige le test device.)
 */
const fs = require('fs');
const path = require('path');

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const slice = (src, header) => { const i = src.indexOf(header); if (i < 0) return ''; const e = src.indexOf('\n  };', i); return src.slice(i, e < 0 ? undefined : e + 5); };

const shopRaw = read('../screens/ShoppingListScreen.js');
const appRaw  = read('../../App.js');
const scanRaw = read('../screens/ScanScreen.js');
const shop = stripComments(shopRaw);

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── HANDOFF ROUTING ──
ok('H-T02/H-T03 ShoppingList n\'écrit JAMAIS dans items (aucun from("items"))', !/\.from\(['"]items['"]\)/.test(shop));
ok('H-T02 ShoppingList délègue via onSendToStock(shoppingItemId+name+quantity contexte)', /onSendToStock\(\{ shoppingItemId: item\.id, name: item\.name, quantity: readShoppingQty\(item\.quantity\) \}\)/.test(shopRaw));
ok('H-T01/R in-cart : toggleItem n\'écrit QUE done (canonique), jamais checked/purchased', (() => { const t = stripComments(slice(shopRaw, 'const toggleItem')); return /update\(\{ done:/.test(t) && !/update\(\{[^}]*\b(checked|purchased|quantity|name)\b/.test(t); })());
ok('NC aucun purchased/completed/added_to_stock dans Courses', !/\b(purchased|completed|added_to_stock)\b/.test(shop));
ok('H-T08 ShoppingList : seul insert autorisé = shopping_items (addItem) — jamais items', (() => {
  const inserts = shopRaw.match(/from\('([a-z_]+)'\)\s*\n?\s*\.insert/g) || [];
  return inserts.length >= 1 && inserts.every(s => /shopping_items/.test(s));
})());

// ── PRÉREMPLISSAGE (ScanScreen) — nom seul, zéro mutation ──
ok('H-T04 prefill NOM depuis captureContext.sourceName (contrat canonique)', /setManualName\(captureContext\.sourceName\)/.test(scanRaw));
ok('H-T05 quantité Courses NON transférée (prefill packUnits=1, touched=false)', /setPackUnits\(1\); setPackUnitsTouched\(false\)/.test(scanRaw));
ok('H-T03 ouverture = ZÉRO mutation (l\'effet prefill ne contient aucun insert)', (() => {
  const eff = (scanRaw.match(/if \(!isCoursesContext\(captureContext\)\) return;[\s\S]*?setMode\('scanner'\);/) || [''])[0];
  return eff.length > 0 && !/insert/.test(eff);
})());
ok('H-T06 emplacement toujours visible/éditable (sélecteur LOC_ITEMS présent)', /LOC_ITEMS\.map/.test(scanRaw));

// ── IDEMPOTENCE — App pré-vol + Scan insert déterministe ──
const send = stripComments(slice(appRaw, 'const handleSendToStock'));
ok('IDEM App calcule un id déterministe (family+shopping)', /courseStockItemId\(\{ familyId, shoppingItemId \}\)/.test(send));
ok('IDEM App pré-vol SELECT par id déterministe', /from\('items'\)[\s\S]*?\.eq\('id', deterministicItemId\)/.test(send));
ok('IDEM App reconnaît lignée (COURSES + shoppingItemId + family) → cleanup only', /lin\.kind === 'COURSES' && lin\.shoppingItemId === shoppingItemId/.test(send) && /cleanupShoppingRow\(shoppingItemId\)/.test(send));
ok('IDEM App mismatch → échec neutre (Réessaie plus tard), pas de cleanup', /Réessaie plus tard/.test(send) && /Déjà dans ton stock/.test(send));
const addp = stripComments(slice(scanRaw, 'const addProduct'));
ok('IDEM Scan insert id déterministe SEULEMENT si ctx', /if \(ctx\?\.deterministicItemId\)/.test(addp) && /newItem\.id = ctx\.deterministicItemId/.test(addp));
ok('IDEM Scan lignée dans provenance (origine)', /newItem\.assertion_provenance\.lineage = ctx\.lineage/.test(addp));
ok('IDEM Scan 23505 → vérifie lignée AVANT succès', /error\.code === '23505'/.test(addp) && /lin\.kind === 'COURSES' && lin\.shoppingItemId === ctx\.shoppingItemId/.test(addp));
ok('IDEM Scan 23505 mismatch → pas de faux succès (Réessaie plus tard + return)', /Réessaie plus tard/.test(addp));
ok('CR-07 non réintroduit : addProduct ne fait AUCUN update items', !/from\('items'\)[\s\S]*?\.update\(/.test(addp));

// ── CLEANUP contract (App) ──
const cleanup = stripComments(slice(appRaw, 'const cleanupShoppingRow'));
ok('CLEANUP supprime shopping_items + signale removedShoppingId (succès)', /from\('shopping_items'\)\.delete\(\)/.test(cleanup) && /setRemovedShoppingId\(shoppingItemId\)/.test(cleanup));
ok('CLEANUP échec → return false (ligne conservée, Stock conservé)', /return false/.test(cleanup));
ok('CLEANUP onStockCommitted = cleanupShoppingRow (cleanup APRÈS commit)', /onStockCommitted=\{cleanupShoppingRow\}/.test(appRaw));

// ── CONTEXT LIFECYCLE (anti-fuite) ──
ok('CTX consumeCourseCtx sur mode switch (handleMethodPress)', (() => { const h = stripComments(slice(scanRaw, 'const handleMethodPress')); return /consumeCourseCtx\(\)/.test(h); })());
ok('CTX consumeCourseCtx sur reset/cancel', /consumeCourseCtx\(\); setResult\(null\)/.test(scanRaw));
ok('CTX consumeCourseCtx sur succès ET reconnu (>=2 fois dans addProduct)', (addp.match(/consumeCourseCtx\(\)/g) || []).length >= 2);
ok('CTX App vide captureContext à la fermeture Scan', /onClose=\{\(\) => \{ setScanOpen\(false\); setCaptureContext\(null\); \}\}/.test(appRaw));
ok('CTX ordinary add sans ctx → aucun id/lignée (garde if ctx)', /if \(ctx\?\.deterministicItemId\)/.test(addp));

// ── N6-08 provenance / N6-09 cap : inchangés dans le writer canonique ──
ok('N6-08 quantityTouched = packUnitsTouched (lignée ne change PAS l\'autorité)', /quantityTouched: packUnitsTouched/.test(addp));
ok('N6-09 addProduct garde capBlocked(1) (handoff ne bypass pas le cap)', /if \(capBlocked\(1\)\) return;/.test(addp));

// ── QUANTITÉ pessimiste (Q8 dur) ──
const upd = stripComments(slice(shopRaw, 'const updateQty'));
ok('Q pessimiste : write DB AVANT tout setItems', (() => { const iUpd = upd.indexOf("update({ quantity: stored })"); const iSet = upd.indexOf('setItems'); return iUpd > 0 && iSet > iUpd; })());
ok('Q verrou par item (pendingQtyRef) + désactivation pendant le write', /pendingQtyRef\.current\.has\(item\.id\)/.test(upd) && /pendingQtyRef\.current\.add\(item\.id\)/.test(upd));
ok('Q échec → aucun setItems (UI reste sur la valeur confirmée)', /if \(!error\) setItems/.test(upd));
ok('Q stepper désactivé quand pending (UI)', /disabled=\{pendingQtyRef\.current\.has\(item\.id\)\}/.test(shopRaw));

// ── REGRESSION / NEGATIVE CONTROLS ──
ok('NC-09 Courses reste une Modal (pas d\'onglet nav)', /<Modal visible=\{shoppingOpen\}/.test(appRaw));
ok('R addItem/deleteItem/clearChecked intacts', /const addItem/.test(shopRaw) && /const deleteItem/.test(shopRaw) && /const clearChecked/.test(shopRaw));
ok('R addItem persiste quantity "1" (bare, legacy-compatible)', /insert\(\{ family_id: fid, name, quantity: '1' \}\)/.test(shopRaw));
ok('R uuid déclaré en dépendance directe exacte 7.0.3', require('../../package.json').dependencies.uuid === '7.0.3');
ok('R canonical items.insert count inchangé (Scan 3 + App 1 = 4)', ((scanRaw.match(/from\('items'\)\.insert/g) || []).length + (appRaw.match(/from\('items'\)\.insert/g) || []).length) === 4);
ok('NC aucun auto-add recette/gaspi/IA/suggestion dans Courses', !/\b(recipe|recette|spoonacular|suggest|repurchase|rachat|gaspi)\b/i.test(shop));
ok('NC Courses ne touche pas household_lifecycle', !/household_lifecycle/.test(shop));

// ── QUANTITÉ EN CONTEXTE (micro-fix) : portée d'affichage uniquement, jamais quantité/autorité Stock ──
const prefill = (scanRaw.match(/if \(!isCoursesContext\(captureContext\)\) return;[\s\S]*?setMode\('scanner'\);/) || [''])[0];
ok('QC-T01..03 ShoppingList normalise la qty Courses via readShoppingQty (tolère 1/×1/x3)', /quantity: readShoppingQty\(item\.quantity\)/.test(shopRaw));
ok('QC App transporte sourceQuantity (contexte) dans captureContext', /sourceQuantity: quantity/.test(appRaw));
ok('QC-T04 Scan AFFICHE la quantité source (×N sous « DEPUIS TA LISTE »)', /DEPUIS TA LISTE/.test(scanRaw) && /×\$\{captureContext\.sourceQuantity\}/.test(scanRaw));
ok('QC-T05 la qty contexte ne prérègle PAS packUnits (prefill garde setPackUnits(1), aucun sourceQuantity→packUnits)',
  /setPackUnits\(1\)/.test(prefill) && !/setPackUnits\([^)]*sourceQuantity/.test(scanRaw) && !/setPackUnits\([^1)][^)]*\)/.test(prefill));
ok('QC-T06 la qty contexte ne met PAS quantityTouched (prefill garde false, jamais true via ctx)',
  /setPackUnitsTouched\(false\)/.test(prefill) && !/setPackUnitsTouched\(true\)[^;]*captureContext/.test(scanRaw));
ok('QC-T07 la qty contexte n\'entre PAS dans l\'identité déterministe (courseStockItemId = family+shopping only)',
  /courseStockItemId\(\{ familyId, shoppingItemId \}\)/.test(appRaw) && !/courseStockItemId\([^)]*quantity/.test(appRaw));
ok('QC-T08 autorité Stock inchangée (addProduct: quantityTouched = packUnitsTouched)', /quantityTouched: packUnitsTouched/.test(addp));

// ── INTENT SOURCE (micro-fix) : nom original immuable, conséquence visible, cleanup id-based ──
ok('SI-T01 nom Courses ORIGINAL figé dans captureContext (sourceName)', /sourceName: name/.test(appRaw));
ok('SI-T02 nom Stock reste éditable (manualName)', /value=\{manualName\}/.test(scanRaw) && /onChangeText=\{setManualName\}/.test(scanRaw));
ok('SI-T03 cleanup toujours par shoppingItemId (jamais par nom)', /delete\(\)\.eq\('id', shoppingItemId\)/.test(appRaw));
ok('SI-T04 conséquence de résolution VISIBLE avant CTA (retrait de la liste annoncé)', /retirée de ta liste de courses après l'ajout au stock/.test(scanRaw));
ok('SI-T05 aucune égalité de nom exigée (pas de comparaison sourceName===/manualName=== pour le cleanup)',
  !/sourceName\s*===|manualName\s*===\s*.*sourceName/.test(appRaw + scanRaw));

// ── AUTH / HOUSEHOLD (micro-fix P0) : contexte + FORMULAIRE DÉRIVÉ ne franchissent jamais une frontière ──
ok('AUTH captureContext fige userOwner + familyOwner', /userOwner: user\?\.id, familyOwner: familyId/.test(appRaw));
const bEff = (appRaw.match(/const ctx = captureContextRef\.current;[\s\S]*?\}, \[user\?\.id, familyId\]\);/) || [''])[0];
ok('AUTH-B01 App détient scanSessionKey (useState(0))', /const \[scanSessionKey, setScanSessionKey\] = useState\(0\)/.test(appRaw));
ok('AUTH-B02 <ScanScreen key={scanSessionKey}> (bump = remount → état de form dérivé détruit)', /<ScanScreen key=\{scanSessionKey\}/.test(appRaw));
ok('AUTH-B03 frontière → bump de la clé (remount Scan)', /setScanSessionKey\(k => k \+ 1\)/.test(bEff));
ok('AUTH-B04 frontière → ferme Scan', /setScanOpen\(false\)/.test(bEff));
ok('AUTH-B05 frontière → purge captureContext', /setCaptureContext\(null\)/.test(bEff));
ok('AUTH-B06 frontière détectée par owner mismatch (sign-out / user / family)', /!user \|\| ctx\.userOwner !== user\?\.id \|\| ctx\.familyOwner !== familyId/.test(bEff));
ok('AUTH-B07 effet-frontière ne dépend QUE de [user?.id, familyId] (anti-course §8)',
  /\}, \[user\?\.id, familyId\]\);/.test(bEff) && /const ctx = captureContextRef\.current;/.test(bEff) && !/\}, \[[^\]]*captureContext[^\]]*\]\);/.test(bEff));
ok('AUTH-B08 miroir ref synchronisé sur [captureContext] (lecture courante sans dépendance)',
  /captureContextRef\.current = captureContext;/.test(appRaw) && /captureContextRef\.current = captureContext; \}, \[captureContext\]\)/.test(appRaw));
ok('AUTH-B09 un SEUL bump de clé dans App, et il est dans l\'effet-frontière',
  (appRaw.match(/setScanSessionKey\(k => k \+ 1\)/g) || []).length === 1 && /setScanSessionKey\(k => k \+ 1\)/.test(bEff));
ok('AUTH-B10 AUCUN bump lors d\'une consommation normale (création handoff / consume / close)', (() => {
  const send = stripComments(slice(appRaw, 'const handleSendToStock'));
  const consumeProp = (appRaw.match(/onCaptureContextConsumed=\{[^}]*\}/) || [''])[0];
  const closeProp = (appRaw.match(/onClose=\{\(\) => \{ setScanOpen\(false\); setCaptureContext\(null\); \}\}/) || [''])[0];
  return !/setScanSessionKey/.test(send) && !/setScanSessionKey/.test(consumeProp) && !/setScanSessionKey/.test(closeProp) && closeProp.length > 0;
})());
ok('AUTH-T04 Scan ne peut préremplir un contexte invalide/périmé (prefill gardé par isCoursesContext : lineage COURSES + identifiants requis)',
  /if \(!isCoursesContext\(captureContext\)\) return;/.test(scanRaw)
  && /kind === 'COURSES'[\s\S]*?deterministicItemId[\s\S]*?shoppingItemId[\s\S]*?sourceName/.test(scanRaw));

console.log(`\ncoursesHandoff.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
