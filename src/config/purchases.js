import { Platform } from 'react-native';

// Remplace par tes clés RevenueCat (app.revenuecat.com > Projet > API Keys)
export const RC_API_KEY = Platform.select({
  ios:     'appl_hbGGqXzTrHtAPjdPIPfkPZHdVFQ',
  android: 'test_fNfbiURnfChBjvRXhhGHpHviopv',
});

export const ENTITLEMENT_PRO = 'pro';

// Ces identifiants doivent correspondre exactement à ce que tu crées dans App Store Connect.
// N6-11 : prix/période/essai NE SONT PAS codés ici — ils viennent des métadonnées StoreProduct réelles
// (getProducts). Aucun montant en dur (voir useProOffer / offerFormat).
export const PRODUCT_MONTHLY = 'frigy_pro_monthly';
export const PRODUCT_ANNUAL  = 'frigy_pro_annual';

// N6-11 : FREE_RECIPE_LIMIT supprimé — aucune limite de recettes n'a jamais été appliquée (revendication
// paywall mensongère retirée ; on n'implémente PAS de quota). FREE_ITEMS_LIMIT reste la source unique du
// nombre affiché du cap Free (ne valide pas CAP-01).
export const FREE_ITEMS_LIMIT  = 20;  // produits max en version gratuite (cap N6-09 ; CAP-01 ouvert)
