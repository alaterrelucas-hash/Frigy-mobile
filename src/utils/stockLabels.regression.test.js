/**
 * Tests de RÉGRESSION N6-04 — plafond sémantique des LIBELLÉS Stock (FridgeScreen).
 * Script Node autonome :  node src/utils/stockLabels.regression.test.js
 *
 * Verrouille : les sections/filtres Stock décrivent une RELATION temporelle (« quand »), jamais
 * une CONSIGNE de consommation (« À utiliser en priorité », « À consommer ») ni un TYPE de date
 * (« DLC proche ») tant que Frigy ne connaît pas le type. Le descripteur partagé conserve
 * « Sans échéance connue » (Frigy ne connaît pas d'échéance ≠ le produit n'en a pas).
 * NB : « DATE LIMITE (DLC) » (champ d'édition/capture) reste hors scope → N6-08.
 */
const fs = require('fs');
const path = require('path');

const fridge = fs.readFileSync(path.join(__dirname, '..', 'screens', 'FridgeScreen.js'), 'utf8');
const temporal = fs.readFileSync(path.join(__dirname, 'temporal.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── Consignes de consommation BANNIES des libellés Stock ──
ok('pas de libellé « À utiliser en priorité »', !fridge.includes("'À utiliser en priorité'"));
ok('pas de libellé « À utiliser prochainement »', !fridge.includes("'À utiliser prochainement'"));
ok('pas de filtre « À consommer »', !fridge.includes("'À consommer'"));

// ── Type de date BANNI des libellés de filtre (le champ `dlc` ≠ vérité affichable) ──
ok('pas de filtre « DLC proche »', !fridge.includes("'DLC proche'"));
// Aucun libellé de section ne prétend une expiration/péremption typée.
ok('pas de libellé de section « Expire… »', !fridge.includes("label: 'Expire"));

// ── Libellés neutres présents (relation « quand », non prescriptifs) ──
ok('section « Date atteinte »', fridge.includes("label: 'Date atteinte'"));
ok('section « Prochains jours »', fridge.includes("label: 'Prochains jours'"));
ok('section « Autres produits »', fridge.includes("label: 'Autres produits'"));
ok('filtres neutres [Tous, Date proche, Sous 7 jours]', fridge.includes("const FILTERS = ['Tous', 'Date proche', 'Sous 7 jours']"));

// ── Prédicats de filtre inchangés (≤4 / ≤7) : politique temporelle non modifiée ──
ok('prédicat Date proche ≤ 4 (inchangé)', fridge.includes("activeFilter === 'Date proche') out = out.filter(i => (passiveTemporalDays(i) ?? 99) <= 4)"));
ok('prédicat Sous 7 jours ≤ 7 (inchangé)', fridge.includes("activeFilter === 'Sous 7 jours') out = out.filter(i => (passiveTemporalDays(i) ?? 99) <= 7)"));

// ── Couleur de section neutralisée (pas de rouge/orange = claim fort sur type inconnu) ──
ok('section PRIORITY couleur neutre (theme.text1, pas theme.critical)',
  fridge.includes("label: 'Date atteinte',   items: priorityItems, labelColor: theme.text1"));
ok('section SOON couleur neutre (pas theme.attention)',
  fridge.includes("label: 'Prochains jours', items: soonItems,     labelColor: theme.text1"));

// ── Descripteur partagé (temporal.js) : « Sans échéance connue » (épistémique), pas « Sans échéance » ──
ok('descripteur « Sans échéance connue » (Frigy ne sait pas ≠ pas de deadline)',
  temporal.includes("'Sans échéance connue'"));

// ── Champ de capture « DATE LIMITE (DLC) » : hors scope (N6-08), non exigé de changer ici ──
ok('champ capture DLC reste (routé N6-08, non traité ici)', fridge.includes('DATE LIMITE (DLC)'));

console.log(`\nstockLabels.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
