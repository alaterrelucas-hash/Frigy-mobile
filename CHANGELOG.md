# Changelog — Frigy

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
