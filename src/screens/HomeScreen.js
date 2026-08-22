import { useMemo } from 'react';
import { View, Text, ScrollView, Image, StyleSheet } from 'react-native';
import { useStockTheme } from '../utils/stockTheme';
import useHomeSuggestion from '../hooks/useHomeSuggestion';
import { HOME_STATE, HOME_LEVEL, transformationOverline } from '../utils/homeLogic';
import { resolveHomeMode, HOME_MODE } from '../utils/householdLifecycle';
import { DEV_HOME_MODE, getHomeQAScenario } from '../utils/devPreviewHome';
import HomePriorityFocus from '../components/home/HomePriorityFocus';
import HomePriorityValue from '../components/home/HomePriorityValue';
import HomeCalm from '../components/home/HomeCalm';
import HomeGathering from '../components/home/HomeGathering';
import HomeIdeaTonight from '../components/home/HomeIdeaTonight';
import HomeWatchList from '../components/home/HomeWatchList';
import OrganicArrow from '../components/home/OrganicArrow';
import HomeSmartShoppingEntry from '../components/home/HomeSmartShoppingEntry';
import HomeFirstRun from '../components/home/HomeFirstRun';
import HomeEmptyStock from '../components/home/HomeEmptyStock';
import HomeLowStock from '../components/home/HomeLowStock';

// Home — point de décision domestique (Home Master V1.2). Cycle : Prioriser → Relier →
// Transformer → Compléter. Pas de dashboard, pas de stats, pas de cards empilées :
// composition, espace, Food Language, Natural Focus (un seul foyer), Contextual Voice.
export default function HomeScreen({ items = [], profileName, onNav, onItemPress, onShopping, onScan, onConfirmHave, stockFontsLoaded, itemsReady = false, lifecycleState = null, lifecycleReady = false }) {
  const theme = useStockTheme();
  const fonts = {
    regular: stockFontsLoaded ? 'SourceSans3-Regular' : undefined,
    semibold: stockFontsLoaded ? 'SourceSans3-SemiBold' : undefined,
  };
  const firstName = profileName ? profileName.split(' ')[0] : '';

  // DEV-ONLY : scénarios QA (jamais en production — __DEV__ est false en release).
  // Mémoïsé sur la constante DEV_HOME_MODE → références stables (items/recipes) : sans
  // ça, un nouveau qa.recipes à chaque render relançait l'effet du hook (boucle infinie).
  const qa = useMemo(
    () => (__DEV__ && DEV_HOME_MODE !== 'off' ? getHomeQAScenario(DEV_HOME_MODE) : null),
    [],
  );
  const data = qa ? qa.items : items;
  // N6-14 (CR-08) : MODE Home autoritaire (serveur). First Run / Empty Returning / Active / Neutre sont
  // décidés par la lisibilité du foyer (household_lifecycle), household-scopée. UNKNOWN/legacy/erreur →
  // NEUTRE (jamais First Run/Empty fabriqués). Stock actif prouve l'initialisation → ACTIVE. QA (dev)
  // dérive un mode depuis le scénario (jamais de fetch réel).
  const mode = qa
    ? (qa.firstRun ? HOME_MODE.FIRST_RUN : (data.length === 0 ? HOME_MODE.EMPTY : HOME_MODE.ACTIVE))
    : resolveHomeMode({ itemsReady, lifecycleReady, activeCount: items.length, lifecycleState });
  // isDark → thème clair (White) réchauffe l'image de résultat (variante warm en cache) ;
  // Dark reste neutre. Voir useHomeSuggestion → resolveRecipeImage.
  const overrideOpts = useMemo(
    () => ({ ...(qa ? { recipesOverride: qa.recipes } : {}), isDark: theme.isDark }),
    [qa, theme.isDark],
  );
  const {
    state, level, signals, priority, watchItems, watchOverflow, selectedRecipe, gatheringItems, missingItems, voice,
  } = useHomeSuggestion(data, overrideOpts);

  // CALM (production) — famille de l'état SUFFISANT sans priorité forte (état C). HOME = synthèse /
  // orientation ; PRODUITS = détail. DEUX variantes présentationnelles de la MÊME scène HomeCalm (même
  // asset + géométrie mascotte + halo) :
  //   watchItems.length > 0  → variante WATCH   (« Je garde un œil sur N produits » + plus proche + CTA) ;
  //   watchItems.length === 0 → variante SILENCE (présence + « Je garde un œil sur tes produits », AUCUN
  //                             CTA, AUCUN produit, jamais « 0 produits »).
  // `watchItems` vient de la couche de vérité (selectWatchEligible → slice) — jamais recomputé ici.
  // isCalmFamily = l'état C SUFFISANT : les DEUX variantes remplissent la hauteur (flexGrow), jamais un
  // Home vide/greeting-only. Aucune machine d'état modifiée (bifurcation présentationnelle intra-état C).
  const isCalmFamily = mode === HOME_MODE.ACTIVE && level === HOME_LEVEL.SUFFICIENT
    && state === HOME_STATE.C;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* ─── TOP BAR Frigy : marque SEULE (aucun contrôle décoratif). Retirés : la cloche
          (aucun centre de notifications n'existe → affordance morte) et le raccourci Profil
          (redondant avec la Bottom Nav). HORS ScrollView (ancrage stable). Fond = bg Home,
          hairline subtile, pas de header massif/coloré. Inset haut géré par le SafeAreaView d'App. ─── */}
      <View style={{ flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separatorSubtle }}>
        {/* Wordmark officiel (assets/logo-text.png, variante fond clair) — jamais coupé. */}
        <Image source={require('../../assets/logo-text.png')} style={{ width: 75, height: 24 }}
          resizeMode="contain" accessible accessibilityRole="image" accessibilityLabel="Frigy" />
      </View>

      {/* First Run / Empty / Calm : flexGrow 1 → le contenu remplit la hauteur réelle (jusqu'à la tabBar).
          En CALM, HomeCalm (flex:1) reçoit ainsi la hauteur restante et ancre sa scène ~28px au-dessus de
          la nav (géométrie validée). Autres états : paddingBottom = respiration finale avant la Bottom Nav. */}
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={(mode === HOME_MODE.FIRST_RUN || mode === HOME_MODE.EMPTY)
          ? { flexGrow: 1, paddingBottom: 16 }
          : isCalmFamily ? { flexGrow: 1, paddingBottom: 20 } : { paddingBottom: 64 }}>

        {mode === HOME_MODE.FIRST_RUN ? (
          /* FIRST RUN HOME — foyer PROUVÉ jamais initialisé (autorité serveur) + 0 actif. */
          <HomeFirstRun firstName={firstName} theme={theme} fonts={fonts} onAddProducts={onScan} />
        ) : mode === HOME_MODE.NEUTRAL ? (
          /* NEUTRE — autorité indisponible (compte/cycle de vie non prêt, erreur) OU legacy_unknown.
             Aucune revendication d'état foyer (ni First Run, ni « vide », ni « rien ne presse »). Greeting seul. */
          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
            {/* GREETING partagé (hiérarchie réduite 26/600) — même identité « Bonjour Lucas » que la
                composition returning ; contexte personnel, pas le message principal. */}
            <Text style={{ fontFamily: fonts.semibold, fontSize: 26, fontWeight: '600', letterSpacing: -0.4, lineHeight: 32, color: theme.text1 }}>
              {firstName ? `Bonjour ${firstName}` : 'Bonjour'}
            </Text>
          </View>
        ) : mode === HOME_MODE.EMPTY ? (
          /* EMPTY RETURNING — foyer PROUVÉ initialisé + 0 actif (≠ First Run). Sans mascotte. */
          <HomeEmptyStock firstName={firstName} theme={theme} fonts={fonts} />
        ) : (
        <>
        {/* ─── GREETING éditorial. Voix contextuelle : uniquement en SUFFICIENT (Active) ; en
            LOW, c'est HomeLowStock qui porte le message adaptatif. ─── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
          {/* GREETING = contexte personnel persistant, PAS le message principal de la Home → hiérarchie
              réduite (26/600) pour laisser le titre d'état (HomeCalm / LowStock / priorité, ~29–30/700)
              porter le sujet courant. Wording/couleur/position inchangés. */}
          <Text style={{ fontFamily: fonts.semibold, fontSize: 26, fontWeight: '600', letterSpacing: -0.4, lineHeight: 32, color: theme.text1 }}>
            {firstName ? `Bonjour ${firstName}` : 'Bonjour'}
          </Text>
          {!!voice && level === HOME_LEVEL.SUFFICIENT && (
            <Text style={{ fontFamily: fonts.regular, fontSize: 16, fontWeight: '400', color: theme.text2, marginTop: 6, lineHeight: 22 }}>
              {voice}
            </Text>
          )}
        </View>

        {level === HOME_LEVEL.LOW ? (
          /* LOW_STOCK — composition adaptative à partir des SIGNALS réels (réutilise Active). */
          <HomeLowStock
            items={data} priority={priority} gatheringItems={gatheringItems}
            selectedRecipe={selectedRecipe} missingItems={missingItems}
            overline={transformationOverline(priority)} signals={signals}
            theme={theme} fonts={fonts} onItemPress={onItemPress}
            onOpenRecipe={() => onNav?.('recipes')} onShopping={onShopping}
            onConfirmHave={qa ? undefined : onConfirmHave} />
        ) : (
        <>
        {/* ─── SUFFICIENT = HOME ACTIVE ─── */}
        {/* ─── ÉTAT C : aucun héros amplifié autorisé. N6-13 (2.6, CR-22) : « priorité absente » ≠
            « rien ne demande d'attention ». Frigy ne modélise pas la complétude temporelle du foyer → il
            ne PEUT PAS prouver un calme global. Aucune revendication de calme global. Le greeting reste.
            Famille CALM (même scène HomeCalm) : ≥1 Watch réel → variante WATCH (synthèse + scène mascotte,
            HOME ≠ PRODUITS, AUCUNE liste) ; ZÉRO Watch → variante SILENCE (présence + rôle Frigy, aucun CTA,
            aucun produit, jamais « 0 produits »). Remplace l'ancien repli greeting-only/HomeWatchList([]) →
            jamais un Home vide. ── */}
        {state === HOME_STATE.C && (
          <>
            {/* Respiration greeting → Calm ~16px (paddingBottom 8 + 2 + paddingTop 6), géométrie validée. */}
            <View style={{ height: 2 }} />
            {watchItems.length > 0 ? (
              <HomeCalm watchItems={watchItems} watchOverflow={watchOverflow} theme={theme} fonts={fonts}
                onSeeMore={() => onNav?.('fridge')} />
            ) : (
              <HomeCalm variant="silence" theme={theme} fonts={fonts} />
            )}
          </>
        )}

        {/* ─── ÉTATS A / B : priorité du moment ─── */}
        {(state === HOME_STATE.A || state === HOME_STATE.B) && (
          <>
            <HomePriorityFocus item={priority} theme={theme} fonts={fonts}
              hasRecipe={signals.recipeAvailable}
              onSeeRecipe={() => onNav?.('recipes')}   /* Recettes (générique) — handoff contextuel PRIORITÉ→Recipes = Recipes V2 (gap connu) */
              onSeeProduct={() => onItemPress?.(priority)}
              onPress={() => onItemPress?.(priority)} />

            {/* VALEUR (§2) : câblée EN PRODUCTION directement après le héros (avant Watch). Consomme le
                `priority` déjà autorisé (priority.rescueValue via la couche de vérité) — aucun calcul ici.
                UNKNOWN (défaut prod : autorité monétaire fermée) → HomePriorityValue renvoie null → footprint
                nul (le bloc possède ses marges haut+bas). Câblé UNIQUEMENT ici (priorité réelle), jamais en
                First Run / Empty / LOW / Watch-seul (état C) / culinary-only. */}
            <HomePriorityValue item={priority} theme={theme} fonts={fonts} />

            {/* Possibilité (état A uniquement) : relier → transformer → compléter */}
            {state === HOME_STATE.A && (
              <>
                <HomeGathering items={gatheringItems} theme={theme} fonts={fonts} />
                <View pointerEvents="none" style={{ alignItems: 'flex-end', paddingRight: 90, marginTop: -2, marginBottom: 0 }}>
                  <OrganicArrow />
                </View>
                <HomeIdeaTonight
                  recipe={selectedRecipe} missing={missingItems}
                  overline={transformationOverline(priority)}
                  theme={theme} fonts={fonts}
                  onOpenRecipe={() => onNav?.('recipes')}   /* FUTURE DEEP LINK SELECTED RECIPE */
                  onShopping={onShopping}
                />
              </>
            )}

            <HomeWatchList items={watchItems} theme={theme} fonts={fonts} onItemPress={onItemPress} overflow={watchOverflow} onSeeMore={() => onNav?.('fridge')} />
            <HomeSmartShoppingEntry theme={theme} fonts={fonts} onPress={onShopping} />
          </>
        )}
        </>
        )}
        </>
        )}

      </ScrollView>
    </View>
  );
}
