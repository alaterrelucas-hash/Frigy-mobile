# Changelog — Frigy

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
