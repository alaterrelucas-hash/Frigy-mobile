/**
 * N6-11 — Commercial / Premium Truth (CR-15/16/17). Régression SOURCE (scan) :
 *   node src/utils/commercialTruth.test.js
 * Écrans commerciaux non compilables (react-native) → scan SOURCE (commentaires retirés) pour verrouiller
 * l'absence de claims mensongers et la présence des garde-fous.
 */
const fs = require('fs');
const path = require('path');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const read = (rel) => strip(fs.readFileSync(path.join(__dirname, rel), 'utf8'));

const paywall = read('../screens/PaywallScreen.js');
const profile = read('../screens/ProfileScreen.js');
const scan    = read('../screens/ScanScreen.js');
const app     = read('../../App.js');
const sub     = read('../hooks/useSubscription.js');
const sub_coord = read('../utils/entitlement.js');
const offer   = read('../hooks/useProOffer.js');
const config  = read('../config/purchases.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── CR-15/17 : deltas premium FAUX retirés du Paywall ──
ok('PAYWALL no « Recettes IA illimitées »', !paywall.includes('Recettes IA illimitées'));
ok('PAYWALL no « 3 recettes/mois »', !paywall.includes('3 recettes'));
ok('PAYWALL no « Stats & analyses avancées »', !paywall.includes('Stats & analyses'));
ok('PAYWALL no « Historique complet de tes économies »', !paywall.includes('économies'));
// Vrais deltas conservés
ok('PAYWALL garde « Scan ticket de caisse illimité »', paywall.includes('Scan ticket de caisse illimité'));
ok('PAYWALL garde « Analyse photo IA »', paywall.includes('Analyse photo IA'));
ok('PAYWALL garde « Produits illimités »', paywall.includes('Produits illimités'));

// ── CR-16 : aucun prix / essai / réduction en dur ──
ok('PAYWALL no prix en dur (2,99 / 24,99 / 2,08)', !paywall.includes('2,99') && !paywall.includes('24,99') && !paywall.includes('2,08'));
ok('PAYWALL no essai « 7 jours »', !paywall.includes('7 jours') && !paywall.includes('essai gratuit'));
ok('PAYWALL no « Aucun débit pendant l\'essai »', !paywall.includes('Aucun débit'));
ok('PAYWALL no réduction « -30% »', !paywall.includes('-30%') && !paywall.includes('30%'));
ok('PAYWALL prix vient de localizedPrice (métadonnée réelle)', paywall.includes('localizedPrice'));
ok('PAYWALL cap Free vient de FREE_ITEMS_LIMIT (pas « 20 » dupliqué)', paywall.includes('FREE_ITEMS_LIMIT') && !/Limité à 20/.test(paywall));

// ── Purchase continuity + gating ──
ok('PAYWALL achète l\'objet StoreProduct affiché (storeProduct)', paywall.includes('selectedPlan.storeProduct'));
ok('PAYWALL achat autorisé UNIQUEMENT KNOWN FREE + OFFER READY + plan réel', paywall.includes('isKnownFree(entitlement)') && paywall.includes('OFFER_STATUS.READY') && paywall.includes('canPurchase'));
ok('PAYWALL succès requiert entitlement Pro (sinon pas fermé Pro)', paywall.includes('Abonnement non détecté'));
ok('PAYWALL ne vend pas si PRO', paywall.includes('isProStatus(entitlement)'));
ok('PAYWALL UNKNOWN → vérification neutre', paywall.includes('Vérification de ton abonnement'));
ok('PAYWALL ERROR → réessayer entitlement', paywall.includes('onRetryEntitlement'));
ok('PAYWALL offre indisponible → réessayer + Restaurer', paywall.includes('Offre momentanément indisponible') && paywall.includes('onReloadOffer'));

// ── D8 / D10 : copie dev + claim d'issue retirés ──
ok('PAYWALL no message dev (RevenueCat/README/NOT_CONFIGURED côté user)', !paywall.includes('RevenueCat à configurer') && !paywall.includes('README') && !paywall.includes('NOT_CONFIGURED'));
ok('PAYWALL erreur user neutre', paywall.includes('momentanément indisponibles'));
ok('PAYWALL hero SANS claim d\'issue absolue', !paywall.includes('Arrêtez de gaspiller') && !paywall.includes('pour de bon'));
ok('PAYWALL Restaurer conservé', paywall.includes('handleRestore'));

// ── N6-10 regression : aucun claim retiré ne réapparaît en argument Pro ──
ok('PAYWALL no CO₂ vendu', !paywall.includes('CO₂') && !paywall.includes('co2'));
ok('PAYWALL no score/comparaison vendu', !paywall.includes('score') && !paywall.includes('comparaison'));

// ── PROFILE : pas de duplication commerciale ; upsell KNOWN FREE only ──
ok('PROFILE no prix en dur', !profile.includes('2,99') && !profile.includes('24,99'));
ok('PROFILE no essai « 7 jours »', !profile.includes('7 jours') && !profile.includes('Essai gratuit'));
ok('PROFILE upsell « Découvrir Frigy Pro »', profile.includes('Découvrir Frigy Pro'));
ok('PROFILE upsell gardé par isKnownFree', profile.includes('isKnownFree(entitlement)'));
ok('PROFILE badge Pro gardé par isProStatus', profile.includes('isProStatus(entitlement)'));
ok('PROFILE no ancien « Passer à Frigy Pro » (bannière)', !profile.includes('Passer à Frigy Pro'));

// ── SUBSCRIPTION (2.6) : coordinateur d'autorité sérialisé, achat par StoreProduct, busy exposé ──
// La sémantique 4 états + erreur≠FREE + sérialisation + préservation d'autorité est PROUVÉE
// comportementalement par entitlementCoordinator.test.js (promesses différées) ; ici on verrouille le
// CÂBLAGE : le hook délègue au coordinateur pur et n'écrit plus d'état d'autorité ad hoc.
ok('SUB délègue au coordinateur pur', sub.includes('createEntitlementCoordinator'));
ok('SUB câble purchaseStoreProduct dans le coordinateur', sub.includes('purchaseStoreProduct'));
ok('SUB n\'utilise plus purchaseProduct(id)', !sub.includes('purchaseProduct(') );
ok('SUB n\'écrit plus d\'autorité ad hoc (aucun setStatus direct → pas de course)', !sub.includes('setStatus('));
ok('SUB expose status + refresh + entitlementBusy', sub.includes('status') && sub.includes('refresh') && sub.includes('entitlementBusy'));
ok('SUB garde de démontage (dispose)', sub.includes('dispose'));
// Le coordinateur (entitlement.js) porte la sérialisation + la préservation d'autorité.
ok('COORD verrou synchrone (busy) présent', sub_coord.includes('busy') && sub_coord.includes('createEntitlementCoordinator'));
ok('COORD préserve l\'autorité établie sur échec (applyEntitlementOutcome)', sub_coord.includes('applyEntitlementOutcome'));

// ── OFFER : séparé, getProducts, jamais Offering ──
ok('OFFER via getProducts (pas d\'Offering)', offer.includes('getProducts') && !offer.includes('getOfferings'));
ok('OFFER états LOADING/READY/ERROR', offer.includes('OFFER_STATUS'));

// ── CONFIG : FREE_RECIPE_LIMIT supprimé ; FREE_ITEMS_LIMIT conservé ──
ok('CONFIG FREE_RECIPE_LIMIT supprimé', !config.includes('FREE_RECIPE_LIMIT'));
ok('CONFIG FREE_ITEMS_LIMIT conservé', config.includes('FREE_ITEMS_LIMIT'));
ok('CONFIG no prix en dur', !config.includes('2,99') && !config.includes('24,99'));

// ── APP : offre + entitlement câblés, mapping neutre entitlement-unavailable ──
ok('APP utilise useProOffer', app.includes('useProOffer'));
ok('APP passe entitlement au Paywall/Scan/Profile', app.includes('entitlement={entitlement}'));
ok('APP mappe DENY_ENTITLEMENT_UNAVAILABLE → neutre (pas paywall)', app.includes('DENY_ENTITLEMENT_UNAVAILABLE') && app.includes('Vérification de ton abonnement'));

// ── SCAN : photo/receipt via decideFeatureAccess ; 1er offert accessible tous paliers ──
ok('SCAN photo/receipt via decideFeatureAccess', scan.includes('decideFeatureAccess(entitlement)'));
ok('SCAN 1er reçu offert accessible sans palier (receiptAllowanceLeft)', scan.includes('receiptAllowanceLeft'));
ok('SCAN feedback neutre entitlement (entitlementWait)', scan.includes('entitlementWait'));
ok('SCAN upsell reçu post-save seulement KNOWN FREE', scan.includes('isKnownFree(entitlement) && !receiptFreeUsed'));

console.log(`\ncommercialTruth: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
