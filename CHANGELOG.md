# Changelog — Frigy

## LOT 02 — Mon Stock — LOCKED V1 — 2026-08-09

Écran Mon Stock convergé et verrouillé pour V1 (validé sur iPhone / Expo Go).

### Architecture validée
- **Priority-first** : sections « À utiliser en priorité » / « À utiliser prochainement » / « Plus tard » (tri temporel).
- **Storage Scope** : Frigo / Congélateur / Placard (segmented control, un espace à la fois).
- **États vides distincts** : espace vide / recherche sans résultat / filtre sans résultat.

### Food Language
- Registry central `src/utils/foodLanguage.js` : **192 primitives** (ratios dérivés des dimensions réelles) + `getPrimitive(key)` + `resolveFoodImage()` (résolution déterministe nom→identité→asset, aliases, fallback → null → img_url → emoji ; **aucune dépendance GS1**).
- Branché dans Mon Stock (produits réels + datasets DEV) ; aucun hardcode d'image ni logique par aliment dans `InventoryProductRow`.
- Tests : `node src/utils/foodLanguage.test.js` → 56/56.

### Natural Focus (statique V1)
- Tokens `focusGlowPriority` #FFD39A · `focusGlowUpcoming` #FFE6C2 · `focusGlowCritical` #FF4B4B (overdue, présence discrète).
- Intensités (paliers DS) : Aujourd'hui 0.40 · Demain 0.25 · J+2–4 0.15 · overdue 0.10 · Plus tard 0.
- Nappe de contact horizontale (glowSize haloSize+24, cx50/cy55/r55, ellipse scaleX 1.20/scaleY 0.65, falloff longue-queue) — bornée à la ligne (ne touche pas les séparateurs). Sélection de teinte par statut.

### Datasets DEV (jamais en production — gardés par `__DEV__`)
- `DEV_PREVIEW_MODE` : `'qa'` (~48 produits crédibles Frigo/Congélateur/Placard, pour la QA visuelle) · `'stress'` (~192, stress test scroll/rendu).

### RevenueCat / Expo Go
- `Purchases.configure` sauté dans Expo Go (`Constants.appOwnership === 'expo'`) — inchangé en dev build / TestFlight / prod.

### Qualité
- Parse OK · resolver 56/56 · bundle iOS OK · aucun code diagnostic résiduel.

### Limites connues — FUTURE QA (non bloquant, pas des bugs)
1. Validation Dark Mode du Natural Focus (teintes Light conservées en Dark pour V1).
2. Prototype éventuel « breathing motion » très subtil sur les items J0 (A/B séparé).
3. Calibrations futures uniquement si un problème est observé en usage réel.

## [1.0.4] — 2026-05-16

### Ajouté
- **DLC manuelle au scan code-barres** : carte de saisie avec TextInput auto-formaté (JJ/MM/AAAA) + badge J-X en couleur d'urgence (rouge/orange/jaune)
- **DLC manuelle en mode photo** : champ DLC par produit dans l'écran de confirmation — écrase la DLC auto détectée par l'IA si saisie
- Helpers `parseDlc()` et `formatDlcInput()` pour gestion robuste des dates en français
- Remise à zéro de la DLC lors du "Scanner un autre"

## [1.0.3] — 2026-05-13

### Ajouté
- **Photo des courses** : reconnaissance automatique multi-produits via Claude Vision (Haiku)
  - Photo depuis caméra ou galerie
  - Détection des produits, marques, catégories et DLC visibles
  - Écran de confirmation avec checkboxes + sélecteur Frigo/Congélateur/Placard
  - Sauvegarde en batch dans Supabase
  - Clé Anthropic stockée en secret Supabase Edge Function (jamais dans l'app)
- **Session persistante** : AsyncStorage — plus besoin de se reconnecter à chaque lancement

### Corrigé
- `nutri_grade` enfin affiché dans le frigo (était `nutri` dans le code)
- `kcal` arrondi en integer pour respecter la contrainte DB
- Prénom saisi au signup maintenant sauvegardé dans `profiles.name`
- Mode "Photo des courses" ne créait plus de dead end blanc

## [1.0.2] — 2026-05-13

### Corrigé
- **Architecture Supabase** : la RLS policy `items_family` exige un `family_id` lié à un profil. Les inserts et lectures ne fonctionnaient pas du tout sans ça.
- **setupProfile** : au premier login, création automatique d'une famille + profil dans Supabase. Les logins suivants récupèrent le `family_id` existant.
- **fetchItems** : filtre maintenant par `family_id` (au lieu de `added_by`) — conforme à la RLS policy.
- **addProduct** : `family_id` ajouté à l'insert. Champs corrigés : `nutri_grade` (était `nutri`), `img_url`, `kcal` maintenant envoyés.
- **Props** : `familyId` transmis à `ScanScreen` et `FridgeScreen`.

## [1.0.1] — 2026-05-13

### Corrigé
- **ScanScreen** : `addProduct` n'insèrait pas en Supabase (seulement état local). Les produits scannés disparaissaient au redémarrage. Fix : insert Supabase avec tous les champs (`added_by`, `days_left`, `barcode`, `consumed`) + récupération de l'ID réel retourné par la base.
- **FridgeScreen** : le long press "Supprimer" ne supprimait pas en base. Fix : appel `supabase.from('items').delete()` ajouté.
- **Props** : `user` manquait dans `ScanScreen` et `FridgeScreen`, rendant la liaison user/items impossible.

---

## [1.0.0] — 2026-05-12

### Ajouté
- App complète : LoginScreen, HomeScreen, FridgeScreen, ScanScreen, RecipesScreen, ProfileScreen
- Auth Supabase (email/password)
- Scan code-barres via OpenFoodFacts (EAN-13, EAN-8, QR, Code128)
- Estimation automatique de la DLC par catégorie de produit
- Affichage Nutri-Score et kcal
- Build EAS soumis sur App Store Connect (bundle `com.frigy.app`, build 1)
