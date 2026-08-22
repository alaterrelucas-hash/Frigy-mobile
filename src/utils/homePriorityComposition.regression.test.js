/**
 * Home PRIORITÉ — composition PRODUCTION + fermeture technique. Régression SOURCE :
 *   node src/utils/homePriorityComposition.regression.test.js
 * Contrat : HomePriorityValue est câblé EN PRODUCTION dans la composition priorité (états A/B),
 * ENTRE HomePriorityFocus et HomeWatchList ; il consomme le vrai `priority` (jamais une fixture) ;
 * UNKNOWN → null sans footprint (marges internes) ; jamais rendu hors priorité réelle. Les gardes de
 * vérité (monétaire/temporelle) sont intactes. Aucun scaffold `priorityVisual` ne subsiste.
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const home  = read('../screens/HomeScreen.js');
const hpv   = read('../components/home/HomePriorityValue.js');
const rescue = read('./rescueValue.js');
const logic = read('./homeLogic.js');
const dev   = read('./devPreviewHome.js');
const lowStock = read('../components/home/HomeLowStock.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── PRIO-P01 : ordre PRODUCTION Focus → Value → WatchList (états A/B) ──
const iFocus = home.indexOf('<HomePriorityFocus item={priority}');
const iValue = home.indexOf('<HomePriorityValue item={priority}');
const iWatch = home.indexOf('<HomeWatchList items={watchItems}', iValue > 0 ? iValue : 0);
ok('PRIO-P01 HomePriorityFocus → HomePriorityValue → HomeWatchList (A/B)',
  iFocus > 0 && iValue > iFocus && iWatch > iValue);

// ── PRIO-P02 : la valeur consomme le VRAI priority (jamais une fixture DEV) ──
ok('PRIO-P02 HomePriorityValue reçoit item={priority} (réel, pas de fixture)',
  /<HomePriorityValue item=\{priority\}/.test(home) && !/pv\.priority|getHomePriorityVisualFixture/.test(home));
ok('PRIO-P02 aucun calcul monétaire dans HomeScreen (pas de formatEuro/computeRescueValue local)',
  !/formatEuro|computeRescueValue|rescueValue\s*=/.test(home));

// ── PRIO-P03 : UNKNOWN → null ──
ok('PRIO-P03 HomePriorityValue self-gate (amount = formatEuro(item.rescueValue) ; if (!amount) return null)',
  /const amount = formatEuro\(item\.rescueValue\)/.test(hpv) && /if \(!amount\) return null/.test(hpv));

// ── PRIO-P04 : le bloc POSSÈDE ses marges (haut+bas) ; aucun spacer externe height:28 ──
ok('PRIO-P04 marges internes (marginTop + marginBottom) sur le bloc valeur',
  /marginTop: 20, marginBottom: 28/.test(hpv));
ok('PRIO-P04 aucun spacer externe fantôme (<View style height:28) autour de la valeur dans HomeScreen',
  !/<View style=\{\{ height: 28 \}\} \/>/.test(home));

// ── PRIO-P05 : câblé UNIQUEMENT dans la priorité réelle (A/B), jamais ailleurs ──
ok('PRIO-P05 HomePriorityValue rendu EXACTEMENT une fois (bloc priorité A/B)',
  (home.match(/<HomePriorityValue /g) || []).length === 1);
ok('PRIO-P05 HomePriorityValue absent de LOW/First Run/Empty (non importé/rendu par HomeLowStock)',
  !/HomePriorityValue/.test(lowStock));

// ── PRIO-P06/P07 : gardes de vérité intactes ──
ok('PRIO-P06 autorité MONÉTAIRE inchangée (hasMonetaryAuthority → false)',
  /function hasMonetaryAuthority\([^)]*\)\s*\{\s*return false;/.test(rescue));
ok('PRIO-P07 autorité TEMPORELLE inchangée (selectHomePriority gaté : allowlist amplifiée vide → null)',
  /Allowlist des types amplifiés VIDE aujourd'hui → renvoie TOUJOURS null/.test(logic)
  && /export function selectHomePriority\(/.test(logic));

// ── PRIO-P08 : aucun scaffold priorityVisual résiduel (runtime) ──
ok('PRIO-P08 HomeScreen : aucune référence priorityVisual / fixture',
  !/priorityVisual|getHomePriorityVisualFixture/.test(home));
// (DEV_HOME_MODE est un COMMUTATEUR de preview __DEV__ qui varie légitimement pendant les revues ;
//  PRIO-P08 verrouille UNIQUEMENT le retrait du scaffold priorityVisual, pas la valeur du commutateur.)
ok('PRIO-P08 devPreviewHome : aucune référence priorityVisual / getHomePriorityVisualFixture',
  !/priorityVisual|getHomePriorityVisualFixture/.test(dev));

// ── CTA préservé (pas de régression vers « Voir les recettes ») ──
ok('CTA A/B câblé : hasRecipe={signals.recipeAvailable} + onSeeRecipe/onSeeProduct (jamais « Voir les recettes »)',
  /hasRecipe=\{signals\.recipeAvailable\}/.test(home) && !/Voir les recettes/.test(home));

console.log(`\nhomePriorityComposition.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
