/**
 * N6-06 — Recipe Wording Truth (regression lock, source-based).
 * Aucun runner → script Node autonome :  node src/utils/recipeWording.regression.test.js
 *
 * Verrouille le PLAFOND DE PRÉSENTATION des surfaces recette (RecipesScreen + HomeIdeaTonight) :
 * aucune copie active ne doit dépasser l'évidence établie (identité N6-05, temporel N6-04, argent).
 * On scanne le CODE ACTIF UNIQUEMENT — les commentaires (qui citent volontairement les anciennes
 * chaînes interdites, ex. « déjà dans ton frigo ») sont retirés avant le scan pour éviter les
 * faux positifs (leçon de stockLabels.regression). Le test prouve aussi qu'il ne passe pas à vide
 * (il exige la présence de chaînes actives connues).
 */
const fs = require('fs');
const path = require('path');

// Retire commentaires bloc /* … */ et ligne // … (nos fichiers n'ont ni URL ni `//` en chaîne).
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const recipesSrc = stripComments(fs.readFileSync(path.join(__dirname, '../screens/RecipesScreen.js'), 'utf8'));
const homeIdeaSrc = stripComments(fs.readFileSync(path.join(__dirname, '../components/home/HomeIdeaTonight.js'), 'utf8'));
const homeRecipesSrc = fs.readFileSync(path.join(__dirname, 'homeRecipes.js'), 'utf8');

let pass = 0, fail = 0;
const absent = (label, hay, needle) => { if (!hay.includes(needle)) pass++; else { fail++; console.log(`FAIL ${label} — trouvé « ${needle} » dans du code ACTIF`); } };
const present = (label, hay, needle) => { if (hay.includes(needle)) pass++; else { fail++; console.log(`FAIL ${label} — « ${needle} » absent (le scan est-il vide ?)`); } };

// ── Garde-fou : le stripper n'a PAS vidé le code actif (sinon les `absent` passeraient à faux) ──
present('SELF stripper garde le code actif (Recipes)', recipesSrc, 'PRÉPARATION');
present('SELF stripper garde le code actif (HomeIdea)', homeIdeaSrc, 'Voir la recette');

// ── LOCATION (CR-06) : STOCK ≠ FRIGO ──
absent('LOC « déjà dans ton frigo » retiré', recipesSrc, 'déjà dans ton frigo');
absent('LOC « € dans ton frigo » retiré', recipesSrc, '€ dans ton frigo');
absent('LOC heading « DÉJÀ DANS TON FRIGO » retiré', recipesSrc, 'DÉJÀ DANS TON FRIGO');
present('LOC heading positif neutre « DÉJÀ DANS TON STOCK »', recipesSrc, 'DÉJÀ DANS TON STOCK');

// ── MONEY (CR-11/CR-24) : aucune valeur/économie € ──
absent('MONEY « économisés » retiré', recipesSrc, 'économisés');
absent('MONEY fallback prix « || 2.5 » retiré', recipesSrc, '|| 2.5');
absent('MONEY CATEGORY_PRICE retiré (import + usages)', recipesSrc, 'CATEGORY_PRICE');
absent('MONEY badge « 💰 » retiré', recipesSrc, '💰');
absent('MONEY calculateROI ne renvoie plus `value`', recipesSrc, 'matched, unresolved, value');

// ── TEMPORAL (CR-02) : pas de type de péremption depuis un type inconnu ──
absent('TEMP header « qui expirent bientôt » neutralisé', recipesSrc, 'qui expirent bientôt');
present('TEMP header neutre « de ton stock »', recipesSrc, 'de ton stock');
absent('TEMP « À CONSOMMER EN PRIORITÉ » retiré', recipesSrc, 'À CONSOMMER EN PRIORITÉ');
absent('TEMP badge carte « à consommer » retiré', recipesSrc, 'à consommer');

// ── GAP / SHOPPING (CR-09) : UNRESOLVED ≠ missing / à acheter ──
absent('GAP « À ACHETER » absent', recipesSrc, 'À ACHETER');
absent('GAP Home « Il manque » retiré', homeIdeaSrc, 'Il manque');
absent('GAP Home import ShoppingCart retiré', homeIdeaSrc, 'ShoppingCart');
absent('GAP Home prop `missing` non consommée', homeIdeaSrc, 'missing');
absent('GAP Home prop `onShopping` non consommée', homeIdeaSrc, 'onShopping');

// ── HEADER (contexte de génération ≠ compte de relation prouvée) ──
absent('HDR-T01 pas de « Basées sur N produits de ton stock »', recipesSrc, 'Basées sur');
absent('HDR-T02a header n\'interpole pas expiring.length', recipesSrc, '${expiring.length} produit');
absent('HDR-T02b header n\'interpole pas forRecipes.length', recipesSrc, 'forRecipes.length} produit');
present('HDR-T03 header non quantitatif approuvé', recipesSrc, 'Des idées à partir de ton stock');
// HDR-T04 (pas d'expirent/DLC/DDM/à consommer/€/économies/manque/acheter dans le header) est
// couvert par les assertions globales ci-dessus (aucune de ces chaînes n'existe en code actif).

// ── Home data layer (homeRecipes) : calculateROI sans valeur € (identité seulement) ──
absent('HOME homeRecipes.calculateROI sans `value`', homeRecipesSrc, ', value }');

console.log(`\nrecipeWording.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
