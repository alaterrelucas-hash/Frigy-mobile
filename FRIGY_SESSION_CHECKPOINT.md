# FRIGY — SESSION CHECKPOINT
_Généré en fin de session pour une reprise propre. CODE ACTUEL = source de vérité (prime sur toute mémoire de conversation)._

## 1. CURRENT PRODUCT STATE
- Repo : `~/Desktop/FRIGY 🍒/CLAUDE CODE/Frigy-mobile` — React Native / Expo SDK 54.
- Branche : **`feat/stock-master-v1`** (contient le lock **Mon Stock** au commit `d482027`). **Tout le travail Home est NON commité** (working tree), posé sur cette branche.
- Aucun commit / push effectué de la journée. Rien n'est déployé.
- Deux streams : **Mon Stock = LOCKÉ** (ne pas toucher) ; **Home = en cours** (Home Active quasi finie + First Run en calibration).

## 2. CURRENT SCREEN UNDER WORK
**First Run Home** — `src/components/home/HomeFirstRun.js`.
- **Objectif** : écran d'accueil quand le stock n'a jamais été initialisé. Composition asymétrique (texte gauche + grande mascotte droite), message central, CTA unique. Pas un onboarding SaaS.
- **État actuel** : hero = titre `Bonjour\n{prénom}` (Georgia 36, « Bonjour » ENTIER ligne 1 / prénom ligne 2) + sous-titre 19 (« chez toi. » vert) + paragraphe 16 ; **bloc texte centré verticalement** contre la mascotte. Mascotte `frigy-first-run.png` (frigo blanc, **aucun bras/jambe**) taille `M = min(BASE*1.35, SCREEN_W-140)` (~+23 %) débordant à droite ~50px, halo Natural Focus (`focusGlowPriority`). Flèche organique `firstrun-arrow.png` (56px, connecteur). Message central **aligné à gauche** : `TON FRIGO EST ENCORE VIDE` / `Ajoute quelques produits.` (vert Georgia 26) / `Je m'occupe du reste.` CTA pleine largeur `Ajouter mes premiers produits` → `onScan` (ScanScreen existant).
- **Déjà validé** : mascotte blanche sans bras ; « Bonjour » jamais coupé (colonne texte garantie 170px) ; suppression de la démo 3 étapes ; suppression microcopy « sécurisé/seulement pour toi » ; alignement homogène gauche + padding 20.
- **Reste à vérifier device / à faire (NON commencé)** : cf. §9 — mascotte **plus grande** + **tout l'écran sans scroll**.

## 3. CURRENT VISUAL DIRECTION (appliqué/validé uniquement)
- Éditorial Frigy : titres Georgia (système iOS), corps Source Sans 3, accent vert `theme.accent` (#166B4D), canvas `#FAFBF2`.
- First Run : composition asymétrique, mascotte = personnage de marque (débordement droite autorisé), Natural Focus doux (halo `focusGlowPriority` #FFD39A, jamais de cercle/disque/spotlight), 0 card, alignement gauche homogène, CTA unique.
- Accessibilité (déjà calibrée sur Home Active + First Run) : textes secondaires en `text2` (#52565A ≈ 7:1), ≥14px, touch targets ≥44 (hitSlop Bell/Profil, CTA paddingVertical 17).

## 4. CURRENT ASSETS (écran en cours)
- `assets/frigy-first-run.png` — mascotte frigo blanc validée (900×900, transparent, sans bras/jambe).
- `assets/home-results/firstrun-arrow.png` — flèche organique **propre au First Run** (pointillée, 300×300).
- `assets/home-results/arrow-organic.png` — flèche organique **Home Active** (NE PAS confondre / ne pas écraser).
- `assets/home-results/caprese.png` — assiette Caprese détourée (Home Active + fallback First Run, si réutilisée).

## 5. CURRENT DEV / QA STATE
- **`DEV_HOME_MODE = 'first'`** dans `src/utils/devPreviewHome.js` → au prochain lancement, la **First Run Home s'affiche directement**.
- Pour revoir la **Home Active** : mettre `DEV_HOME_MODE = 'A'`. Autres modes : `'B' | 'C' | 'empty' | 'off'`.
- First Run en prod est piloté par une prop `firstRun` (défaut false) sur `HomeScreen` — **non câblée** (voir §8). En QA, `getHomeQAScenario('first')` renvoie `{ items: [], recipes: [], firstRun: true }`.
- Clé Replicate : dans `.env` (`EXPO_PUBLIC_REPLICATE_API_KEY`, gitignored) ; lue via `src/config/replicate.js` (gitignored).

## 6. FILES MODIFIED / CREATED TODAY (présents dans le working tree)
**Modifiés (M) :**
- `App.js` — passe `stockFontsLoaded` à HomeScreen ; guard `Purchases.configure` en Expo Go.
- `src/api/replicate.js` — génération image recette (flux-schnell) + détourage (rembg) + retry ; température par thème (Home Active). **Uniquement utilisé par Home Active** (Caprese QA utilise un asset curé, pas la génération).
- `src/screens/HomeScreen.js` — orchestration Home ; Top Bar ; rendu conditionnel First Run vs états A/B/C/EMPTY ; Smart Shopping Entry ; `paddingBottom 64`.
- `src/utils/foodLanguage.js` — `PRIMITIVE_COPY` (displayShort/determiner) pour la copy contextuelle.

**Nouveaux (non suivis) :**
- `src/components/home/HomeFirstRun.js` — **écran en cours**.
- `src/components/home/HomePriorityFocus.js` — hero priorité (tomates + Natural Focus + Rescue Value).
- `src/components/home/HomeGathering.js` — « TU AS AUSSI… ».
- `src/components/home/HomeIdeaTonight.js` — « idée du soir » (Caprese, image détourée).
- `src/components/home/HomeWatchList.js` — « À GARDER À L'ŒIL ».
- `src/components/home/HomeSmartShoppingEntry.js` — closing « Pour les prochaines courses ».
- `src/components/home/OrganicArrow.js` — flèche organique Home Active.
- `src/hooks/useHomeSuggestion.js` — orchestration données Home.
- `src/utils/homeLogic.js` (+ `homeLogic.test.js`) — états A/B/C/EMPTY, priorité, voix.
- `src/utils/homeRecipes.js` — sélection recette + pipeline image.
- `src/utils/rescueValue.js` (+ `rescueValue.test.js`) — « X€ à sauver » (format FR sans espace).
- `src/utils/devPreviewHome.js` — scénarios QA (`DEV_HOME_MODE`).
- `assets/frigy-first-run.png`, `assets/home-results/*.png` — assets ci-dessus.

**Gitignored mais ESSENTIELS (sur disque, à inclure dans tout futur commit/clone) :**
- `src/config/replicate.js` (lit `process.env.EXPO_PUBLIC_REPLICATE_API_KEY`, pas de clé en dur).
- `.env` (contient la vraie clé — NE JAMAIS committer).

## 7. VALIDATED — DO NOT REGRESS
- **Mon Stock** entier (lock `d482027`) — ne pas toucher.
- **Home Active** : Top Bar (logo + Bell/Profil), Rescue Value `3,20€ à sauver` (**aucune espace avant €**, montant text1 > « à sauver » text2), Gathering, flèche `arrow-organic.png`, Caprese = **photo curée** `resultCutout` (pas de génération), Watch, Smart Shopping Entry, calibration contrastes (text3→text2) + overlines 13px + hitSlop.
- **First Run** : « **Bonjour** » ENTIER sur une ligne (jamais coupé) / prénom ligne 2 ; mascotte **sans bras/main/jambe** ; message central **aligné à gauche** (homogène) ; **pas** de démo 3 étapes ; **pas** de microcopy « sécurisé/seulement pour toi ».
- Flèches distinctes : `firstrun-arrow.png` (First Run) ≠ `arrow-organic.png` (Home Active).

## 8. OPEN QUESTIONS (réellement ouvertes)
- **Trigger production First Run non câblé** : proposé (non fait) = flag `AsyncStorage 'frigy_stock_initialized'` posé au 1ᵉʳ stock non-vide (dans App.js) → `firstRun = !initialized && items.length===0` (distinct d'EMPTY_STOCK). À décider/câbler.
- **Dark mode** non validé (mascotte/flèche/logo potentiellement peu contrastés).
- Arbitrage à trancher pour la prochaine passe (voir §9) : mascotte plus grande **vs** « Bonjour » entier (colonne ≥170px) **vs** tout l'écran sans scroll.

## 9. NEXT PASS (NE PAS COMMENCER MAINTENANT)
Demande utilisateur en fin de session, **non implémentée** :
> « Mascotte plus grande, et que l'espace soit parfaitement utilisé sur cette Home, **sans avoir à slider** (sans scroll). »

Point d'arrêt exact : la First Run est fonctionnelle et calibrée (bloc centré, « Bonjour » entier, mascotte ~+23 %). **Prochaine action logique** : agrandir la mascotte ET compacter/redistribuer le rythme vertical pour que **tout tienne dans un seul écran sans scroll** sur le device de review — en préservant les points §7 (« Bonjour » entier, sans bras, homogénéité). Tension à résoudre : mascotte plus grande réduit la colonne texte (risque coupe « Bonjour ») ; « sans scroll » impose de réduire des espaces/tailles → arbitrer finement (peut nécessiter de repositionner la mascotte plutôt que juste l'agrandir, ex. mascotte qui déborde davantage / hero et central plus compacts).

## 10. RESTART PROCEDURE
```bash
# 1. Ouvrir le projet
cd "/Users/lucasalaterre/Desktop/FRIGY 🍒/CLAUDE CODE/Frigy-mobile"

# 2. Vérifier que les fichiers gitignored essentiels sont bien là (sinon la génération image casse)
ls -la .env src/config/replicate.js

# 3. Lancer Metro (offline requis pour la connexion device ; --clear conseillé)
npx expo start --clear --offline

# 4. Sur l'iPhone (Expo Go) : se connecter à exp://<IP-affichée>:8081, puis Reload (shake).
#    DEV_HOME_MODE='first' → la First Run Home s'affiche directement.

# 5. Pour revoir la Home Active : éditer src/utils/devPreviewHome.js → DEV_HOME_MODE = 'A'
```
Reprendre le travail sur `src/components/home/HomeFirstRun.js` (§9). **Ne pas** régresser §7. **Ne pas** committer/pusher sans demande explicite (et si commit un jour : inclure `src/config/replicate.js`, jamais `.env`).

---
_Aucun commit, aucun push, aucun reset/clean/stash effectués. Working tree conservé tel quel._
