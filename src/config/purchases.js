import { Platform } from 'react-native';

// Remplace par tes clés RevenueCat (app.revenuecat.com > Projet > API Keys)
export const RC_API_KEY = Platform.select({
  ios:     'appl_hbGGqXzTrHtAPjdPIPfkPZHdVFQ',
  android: 'test_fNfbiURnfChBjvRXhhGHpHviopv',
});

export const ENTITLEMENT_PRO = 'pro';

// Ces identifiants doivent correspondre exactement à ce que tu crées dans App Store Connect
export const PRODUCT_MONTHLY = 'frigy_pro_monthly';   // 2,99€/mois
export const PRODUCT_ANNUAL  = 'frigy_pro_annual';    // 24,99€/an

export const FREE_RECIPE_LIMIT = 3;   // recettes IA gratuites par mois
export const FREE_ITEMS_LIMIT  = 20;  // produits max en version gratuite
