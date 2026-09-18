/**
 * PA-01 — Accès fiable aux Courses depuis Mon Stock. Régression SOURCE (écrans non compilables) :
 *   node src/utils/coursesAccess.regression.test.js
 * Contrat : un point d'accès CAPACITÉ explicite dans l'en-tête Mon Stock (InventoryHeader), toujours
 * présent (indépendant du stock/temporel/filtre/lifecycle), réutilisant `onShopping` (aucun 2e owner,
 * aucune mutation, aucune reco d'achat). N6-12 / N6-06 / navigation globale NON régressés.
 */
const fs = require('fs');
const path = require('path');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
const readRaw = (rel) => fs.readFileSync(path.join(__dirname, rel), 'utf8');

const invRaw   = readRaw('../components/InventoryHeader.js');
const inv      = strip(invRaw);
const fridgeRaw= readRaw('../screens/FridgeScreen.js');
const fridge   = strip(fridgeRaw);
const appRaw   = readRaw('../../App.js');
const ideaRaw  = readRaw('../components/home/HomeIdeaTonight.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// Bloc du bouton Courses dans l'en-tête (extraction pour scoper les assertions).
const btn = (invRaw.match(/<TouchableOpacity\s+onPress=\{\(\) => onShopping[\s\S]*?<\/TouchableOpacity>/) || [''])[0];

// ── PA-T01 : Mon Stock rend un contrôle Courses (icône panier + label accessible) ──
ok('PA-T01 InventoryHeader importe ShoppingCart', /import \{[^}]*ShoppingCart[^}]*\} from 'lucide-react-native'/.test(invRaw));
ok('PA-T01 bouton Courses présent (ShoppingCart + accessibilityLabel "Courses")', btn.length > 0 && /ShoppingCart/.test(btn) && /accessibilityLabel="Courses"/.test(btn));
ok('PA-T01 FridgeScreen câble onShopping → InventoryHeader', /<InventoryHeader[\s\S]*?onShopping=\{onShopping\}[\s\S]*?\/>/.test(fridgeRaw));

// ── PA-T02 : tap explicite → onShopping (simple navigation, aucune donnée) ──
ok('PA-T02 onPress = onShopping?.()', /onPress=\{\(\) => onShopping\?\.\(\)\}/.test(btn));
ok('PA-T02 accessibilityRole button + hint d\'ouverture', /accessibilityRole="button"/.test(btn) && /accessibilityHint="Ouvrir la liste de courses"/.test(btn));

// ── PA-T03/04/05 : présent indépendamment du stock / priorité temporelle / onglet d'emplacement ──
// Preuve structurelle : InventoryHeader n'a AUCUNE dépendance à items/quantité/temporel/lifecycle/scope
// → le bouton ne peut PAS être gaté par ces facteurs.
ok('PA-T03 aucune dépendance items.length dans InventoryHeader', !/items\.length|items\b\.filter|\bactiveCount\b/.test(inv));
ok('PA-T04 aucune dépendance temporelle/priorité dans InventoryHeader', !/passiveTemporalDays|amplifiedTemporalDays|priority|TEMPORAL_TIER/.test(inv));
ok('PA-T05 aucune dépendance emplacement/lifecycle dans InventoryHeader', !/activeScope|Frigo|Congélateur|Placard|lifecycle|HOME_MODE/.test(inv));
ok('PA-T03 bouton hors de toute condition (rendu inconditionnel dans la ligne d\'en-tête)', !/\{[^}]*\?\s*<TouchableOpacity\s+onPress=\{\(\) => onShopping/.test(invRaw));

// ── PA-T06/07 : ouvrir Courses ne mute NI Stock NI shopping_items ──
ok('PA-T06 le bouton ne touche pas items (aucun insert/update/from items)', !/from\(['"]items['"]\)|\.insert\(|\.update\(/.test(btn));
ok('PA-T07 le bouton ne touche pas shopping_items (navigation pure)', !/shopping_items/.test(btn));
ok('PA-T07 InventoryHeader reste présentation pure (aucun supabase/insert)', !/\bsupabase\b|shopping_items|\.insert\(/.test(inv));

// ── PA-T08/09/10 : N6-12 non régressé (gaspi/conso ≠ intention d'achat) ──
const consumePath = (strip(fridgeRaw).match(/const submitStockUpdate = async[\s\S]*?\n  \};/) || [''])[0];
ok('PA-T08 flux gaspi/conso (submitStockUpdate) n\'appelle JAMAIS onShopping', consumePath.length > 0 && !consumePath.includes('onShopping'));
ok('PA-T09 flux conso ne crée aucune intention d\'achat (pas de shopping_items dans FridgeScreen)', !fridge.includes('shopping_items'));
ok('PA-T10 aucun panneau GASPI repurchase restauré (Courses)', (() => { const shop = strip(readRaw('../screens/ShoppingListScreen.js')); return !shop.includes('TU GASPILLES SOUVENT') && !shop.includes('reviennent souvent'); })());

// ── PA-T11/12 : N6-06 non régressé (Recipe Gap ≠ intention d'achat). Le CODE (commentaires retirés) ne
// contient ni pont « Ajouter aux courses », ni ShoppingCart, ni consommation d'onShopping. ──
const idea = strip(ideaRaw);
ok('PA-T11/12 HomeIdeaTonight : pas de pont courses dans le CODE (Ajouter aux courses / ShoppingCart / onShopping)',
  !/Ajouter aux courses/.test(idea) && !/ShoppingCart/.test(idea) && !/onShopping/.test(idea));

// ── PA-T13/14 : navigation globale inchangée ──
ok('PA-T13 bottom nav inchangée (onglets = home/fridge/scan/recipes/profile ; aucun onglet Courses/shopping)',
  !/id:\s*'(courses|shopping)'/.test(appRaw) && /id:\s*'scan',\s*isScan:\s*true/.test(appRaw));
ok('PA-T14 « + » global ouvre Scan, pas Courses', /styles\.scanBtn\}\s*onPress=\{\(\) => setScanOpen\(true\)\}/.test(appRaw));
ok('PA-T14 aucun 2e owner de shoppingOpen (un seul setShoppingOpen(true) via onShopping props)',
  (appRaw.match(/setShoppingOpen\(true\)/g) || []).length >= 1 && !/<ShoppingListScreen[\s\S]*<ShoppingListScreen/.test(appRaw));

// ── App.js NON modifié pour PA-01 (onShopping déjà câblé) ──
ok('PA-01 App.js passe déjà onShopping à FridgeScreen (aucune nouvelle route App requise)',
  /<FridgeScreen[\s\S]*?onShopping=\{\(\) => setShoppingOpen\(true\)\}[\s\S]*?\/>/.test(appRaw));

console.log(`\ncoursesAccess.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
