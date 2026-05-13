# Roadmap — Frigy

## 🚀 Lancement v1.0 (en cours)
- [x] Build EAS soumis sur App Store Connect
- [ ] Finaliser la fiche App Store Connect → cliquer "Ajouter pour vérification"
- [ ] Validation Apple

---

## 🔧 Correctifs prioritaires (v1.0.x)
- [ ] Migrer les clés Supabase vers `expo-constants` / variables d'env (actuellement hardcodées dans App.js)
- [ ] FridgeScreen : delete Supabase marque `consumed: true` plutôt que suppression physique (pour stats futures)
- [ ] Gérer le cas `user` null dans ScanScreen si session expirée

---

## ✨ Prochaines fonctionnalités (v1.1)

### Frigo
- [ ] Édition d'un produit (emoji, DLC manuelle, quantité)
- [ ] Sélecteur de localisation lors du scan (Frigo / Congélateur / Placard)
- [ ] Notifications push pour les produits qui expirent dans 48h

### Scan
- [ ] Mode photo : reconnaissance multi-produits par IA (photo des courses)
- [ ] Ajout manuel si produit inconnu (formulaire simplifié)
- [ ] Historique des scans récents

### Recettes
- [ ] Recettes générées dynamiquement à partir des produits urgents (IA / API)
- [ ] Lien vers recette complète (instructions, ingrédients)
- [ ] Bouton "J'ai cuisiné ça" → marque les ingrédients comme consommés

### Profil & Stats
- [ ] Prénom personnalisé (récupéré depuis Supabase profiles)
- [ ] Statistiques réelles : économies, repas sauvés, CO₂ évités (calculés depuis l'historique)
- [ ] Score anti-gaspillage dynamique (points par produit consommé avant expiration)
- [ ] Badges débloqués automatiquement

### HomeScreen
- [ ] Salutation avec le vrai prénom de l'utilisateur
- [ ] Statistiques mensuelles réelles (pas hardcodées)

---

## 💡 Idées à explorer (v1.2+)
- Liste de courses intelligente (basée sur les habitudes)
- Partage de frigo en famille / coloc (multi-users sur un même foyer)
- Mode sombre
- Widget iOS (produits urgents)
- Intégration avec les grandes surfaces (scan ticket de caisse)
- Android / Google Play

---

## ⚙️ Tech debt
- [ ] Séparer App.js en fichiers par screen (quand le fichier > 1000 lignes)
- [ ] Ajouter des tests (au moins sur `estimateDays` et les helpers API)
- [ ] Gérer les erreurs réseau avec retry
