# Frigy Mobile — Guide Claude

## Stack

- **Framework** : React Native 0.81.5 + Expo SDK ~54
- **Auth + DB** : Supabase (tables: `items`, `profiles`, `families`, `product_cache`, `saved_recipes`, `scan_history`, `shopping_items`, `activity`)
- **Paiements** : RevenueCat `react-native-purchases` v10 — entitlement `pro`, produits `frigy_pro_monthly` / `frigy_pro_annual`
- **Analytics** : PostHog (`src/config/posthog.js`)
- **Crashs** : Sentry (`src/config/sentry.js`) — actif uniquement en production (`enabled: !__DEV__`)
- **IA recettes** : Spoonacular + Claude Haiku via Edge Functions Supabase
- **IA images** : Replicate flux-schnell
- **Scan produits** : OpenFoodFacts + Spoonacular
- **OTA** : expo-updates via EAS Update

## Architecture

```
src/
  config/     supabase.js  constants.js  purchases.js  posthog.js  sentry.js  urls.js
  api/        openfoodfacts.js  spoonacular.js  productCache.js  replicate.js
  utils/      product.js   (estimateDays, estimateOpeningDays, parseDlc, suggestLocation…)
  styles/     index.js
  hooks/      useSubscription.js
  screens/    LoginScreen  OnboardingScreen  HomeScreen  FridgeScreen
              ScanScreen   RecipesScreen     ProfileScreen  ShoppingListScreen  PaywallScreen
App.js        (navigation tabs, auth state, ErrorBoundary, initSentry)
```

## Règles importantes

### Git — TOUJOURS avant un build
```bash
git add <fichiers>
git commit -m "..."
git push origin main
# ENSUITE seulement :
eas build ...
```
EAS build depuis le dernier commit git, PAS depuis les fichiers locaux.

### Design system
- Titres de page : `fontSize: 30, fontWeight: '900', letterSpacing: -1, color: C.t1`
- Section labels : `fontSize: 11, fontWeight: '800', color: C.t3, letterSpacing: 0.8` (MAJUSCULES)
- Accent : `C.green` (#3DB33F) — jamais de vert hardcodé
- Fond : `C.bg` (#F7F7F0) | Cards : `C.card` (#FFFFFF) | Texte : `C.t1` (#1C1C1E)
- Vérifier avant chaque écran qu'aucun `#XXXXXX` hardcodé ne remplace `C.t1` ou `C.green`

### New Architecture
`newArchEnabled: false` — Ne pas repasser à `true`. Crash confirmé avec react-native-purchases + expo-notifications sur Expo 54.

## Commandes clés

```bash
# Développement
npx expo start --clear

# Build TestFlight (commit+push d'abord !)
eas build --platform ios --profile production --non-interactive --auto-submit

# OTA update (JS uniquement, sans rebuild)
eas update --channel production --message "fix: description"

# Vérifier builds
eas build:list --platform ios --limit 5
```

## Workflow build / déploiement

### Changement JS/écrans → OTA (pas de build)
```bash
git add . && git commit -m "..." && git push origin main
eas update --channel production --message "description"
```
L'app se met à jour silencieusement au prochain lancement.

### Changement natif (nouveau package, plugin, app.json) → build obligatoire
```bash
git add . && git commit -m "..." && git push origin main
eas build --platform ios --profile production --non-interactive --auto-submit
```

### Ce qui nécessite un build (≠ OTA)
- Ajout/suppression d'un package avec code natif
- Modification de `app.json` (plugins, permissions, icône, splash)
- Mise à jour Expo SDK
- Changement `newArchEnabled`

## Sentry

- **DSN** : `https://d042b564c1a28386ab3a1cba9cebec3f@o4511664813047809.ingest.de.sentry.io/4511664821108816`
- **Org** : `alm-group` | **Project** : `react-native`
- **Dashboard** : https://alm-group.sentry.io/
- **Source maps** : désactivés (`SENTRY_DISABLE_AUTO_UPLOAD=true` dans eas.json). Pour les activer : créer un auth token sur https://alm-group.sentry.io/settings/auth-tokens/ (scope `project:write`) et l'ajouter dans `sentry.properties` + `eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value TOKEN`

## EAS — Channels

| Profil | Channel | Usage |
|--------|---------|-------|
| `production` | `production` | App Store + TestFlight |
| `preview` | `preview` | Tests internes AdHoc |
| `development` | `development` | Dev client local |

## Supabase

- **URL** : `https://mswmridpidhqqlxnxhlt.supabase.co`
- **Edge Functions** : `analyze-photo`, `suggest-recipes`, `scan-receipt`
- **Storage** : bucket `avatars` (public) — contournement bug uuid: `remove()` avant `upload()` sans upsert
- **Colonnes items** : `opened bool DEFAULT false`, `opened_at date` (feature produits ouverts)

## RevenueCat

- **Clé iOS** : `test_fNfbiURnfChBjvRXhhGHpHviopv` (seule clé disponible)
- **Entitlement** : `pro`
- **Limites free** : 20 produits max, 3 recettes IA/mois, 1 scan ticket gratuit

## App Store

- **Bundle ID** : `com.frigy.app`
- **ASC App ID** : `6768930083`
- **Dernier build soumis** : 1.1.0 (19) — 2026-07-02
- `autoIncrement: true` dans eas.json production — ne pas mettre `buildNumber` dans app.json
