/**
 * N6-12 — Gaspi → Repurchase truth (CR-10 + Waste Write Authority). Régression SOURCE :
 *   node src/utils/gaspiTruth.regression.test.js
 * Écrans non compilables (react-native) → scan SOURCE (commentaires retirés). Verrouille : panneau gaspi
 * supprimé, aucun waste→shopping, et l'ordre d'autorité d'écriture (persistance prouvée AVANT
 * représentation + analytics).
 */
const fs = require('fs');
const path = require('path');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const read = (rel) => strip(fs.readFileSync(path.join(__dirname, rel), 'utf8'));

const shop   = read('../screens/ShoppingListScreen.js');
const fridge = read('../screens/FridgeScreen.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── CR-10 : panneau gaspi entièrement supprimé de Courses ──
ok('PANEL no « TU GASPILLES SOUVENT »', !shop.includes('TU GASPILLES SOUVENT'));
ok('PANEL no « reviennent souvent »', !shop.includes('reviennent souvent'));
ok('PANEL no « 2 derniers mois »', !shop.includes('2 derniers mois'));
ok('PANEL no « + Liste »', !shop.includes('+ Liste'));
ok('PANEL no état wastedInsights', !shop.includes('wastedInsights'));
ok('PANEL no requête waste-history (eq wasted true)', !shop.includes(".eq('wasted', true)") && !shop.includes('.eq("wasted", true)'));
ok('PANEL no fenêtre updated_at', !shop.includes(".gte('updated_at'") && !shop.includes('.gte("updated_at"'));
ok('PANEL no prefill gaspi→input (setInput(p.name))', !shop.includes('setInput(p.name)'));
ok('PANEL no logique de fréquence (count >= 2)', !shop.includes('count >= 2') && !shop.includes('.count >= 2'));

// ── Intention d'achat : addItem reste le SEUL écrivain explicite ; aucun waste→shopping ──
ok('SHOP addItem conservé (insert shopping_items explicite)', shop.includes('addItem') && shop.includes("from('shopping_items')") && shop.includes('.insert('));
ok('FRIDGE aucun écrivain shopping_items (waste ne touche pas Courses)', !fridge.includes('shopping_items'));
// PA-01 : un accès GÉNÉRIQUE aux Courses (navigation explicite depuis l'en-tête Mon Stock) est AUTORISÉ.
// L'invariant N6-12 protégé n'est PAS « FridgeScreen ignore onShopping » mais « le flux conso/gaspi ne
// déclenche JAMAIS d'intention d'achat » : consumeItem ne référence pas onShopping (WASTED ≠ TO-BUY).
// Mise à jour de stock canonique (single-sheet) : le flux conso/gaspi ne déclenche JAMAIS d'intention d'achat.
const su = (fridge.match(/const submitStockUpdate = async[\s\S]*?\n  \};/) || [''])[0];
ok('FRIDGE conso/gaspi ne navigue PAS vers Courses (submitStockUpdate sans onShopping)', su.length > 0 && !su.includes('onShopping'));

// ── Autorité d'écriture canonique (apply_partial_outcome) : preuve AVANT représentation ──
ok('WRITE submitStockUpdate isolé trouvé', su.length > 0);
ok('WRITE mutation canonique V2 (applyStockUpdate) — plus d\'items.update({consumed,wasted})',
  su.includes('applyStockUpdate(supabase') && !fridge.includes('update({ consumed: true, wasted'));
ok('WRITE convergence : plus de consumeItem/coordinateur', !fridge.includes('consumeItem') && !fridge.includes('createConsumeCoordinator'));
ok('WRITE garde synchrone anti double-action (submitBusy)', su.includes('if (submitBusy) return'));
// Ordre : la classification (r.ok) précède le retrait / la fermeture / l'analytics.
const iGuard   = su.indexOf('if (!r.ok)');
const iRemove  = su.indexOf('updateItems(p => p.filter(x => x.id !== item.id))');
const iClose   = su.indexOf('setUpdateItem(null)');
const iCapture = su.indexOf('posthog.capture(');
ok('WRITE preuve (!r.ok) AVANT retrait de l\'item', iGuard > 0 && iRemove > 0 && iGuard < iRemove);
ok('WRITE preuve AVANT fermeture de la sheet', iGuard > 0 && iClose > 0 && iGuard < iClose);
ok('WRITE analytics APRÈS la preuve (jamais sur échec)', iGuard > 0 && iCapture > 0 && iGuard < iCapture);
// Pas de retrait optimiste : aucun updateItems(filter) AVANT l'await applyPartialOutcome.
const iAwait = su.indexOf('await applyStockUpdate(');
ok('WRITE aucun retrait optimiste avant la mutation', iAwait > 0 && (iRemove === -1 || iAwait < iRemove));
// Échec : feedback neutre réessayable (jamais de faux succès), l'item reste (return avant retrait).
ok('WRITE échec → feedback neutre réessayable', su.includes('onOutcomeFailure') && fridge.includes('Réessaie'));
// CTA non-actionnable pendant la mutation (submitting=submitBusy propagé à la sheet).
ok('WRITE CTA désactivé pendant la mutation (submitting=submitBusy)', fridge.includes('submitting={submitBusy}'));

// ── Aucune conséquence commerciale / repurchase depuis le gaspillage ──
ok('NO repurchase copy (racheter/à racheter/il en faut/manquant)', !fridge.includes('acheter') && !shop.includes('Racheter') && !shop.includes('à racheter'));

console.log(`\ngaspiTruth.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
