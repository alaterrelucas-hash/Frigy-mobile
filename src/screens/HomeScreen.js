import { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { Bell, User } from 'lucide-react-native';
import { useStockTheme } from '../utils/stockTheme';
import useHomeSuggestion from '../hooks/useHomeSuggestion';
import { HOME_STATE, HOME_LEVEL, transformationOverline } from '../utils/homeLogic';
import { DEV_HOME_MODE, getHomeQAScenario } from '../utils/devPreviewHome';
import HomePriorityFocus from '../components/home/HomePriorityFocus';
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
export default function HomeScreen({ items = [], profileName, onNav, onItemPress, onShopping, onScan, onConfirmHave, stockFontsLoaded, firstRun = false }) {
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
  // FIRST RUN (stock jamais initialisé) : piloté par le scénario QA 'first', ou en prod par
  // la prop `firstRun` (à câbler côté App — voir gap documenté). Distinct de EMPTY_STOCK.
  const isFirstRun = qa ? !!qa.firstRun : !!firstRun;
  // isDark → thème clair (White) réchauffe l'image de résultat (variante warm en cache) ;
  // Dark reste neutre. Voir useHomeSuggestion → resolveRecipeImage.
  const overrideOpts = useMemo(
    () => ({ ...(qa ? { recipesOverride: qa.recipes } : {}), isDark: theme.isDark }),
    [qa, theme.isDark],
  );
  const {
    state, level, signals, priority, watchItems, selectedRecipe, gatheringItems, missingItems, voice,
  } = useHomeSuggestion(data, overrideOpts);

  // Cible tactile ≥44×44 (hitSlop) sans grossir le visuel (36×36 conservé).
  const IconBtn = ({ Icon, onPress }) => (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surface,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.separator }}>
      <Icon size={17} color={theme.text2} strokeWidth={1.9} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* ─── TOP BAR Frigy : marque à gauche, Bell + Profil à droite. Ancrage stable, HORS
          ScrollView (accès constant). Fond = bg Home (pas de header coloré/massif, pas de
          card), hairline très subtile. Bell/Profil DÉPLACÉS depuis le greeting (jamais
          dupliqués). Inset haut géré par le SafeAreaView d'App. ─── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separatorSubtle }}>
        {/* Wordmark officiel (assets/logo-text.png, variante fond clair) — jamais coupé. */}
        <Image source={require('../../assets/logo-text.png')} style={{ width: 75, height: 24 }}
          resizeMode="contain" accessible accessibilityRole="image" accessibilityLabel="Frigy" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconBtn Icon={Bell} onPress={() => {}} />
          <IconBtn Icon={User} onPress={() => onNav?.('profile')} />
        </View>
      </View>

      {/* First Run : flexGrow 1 → le contenu remplit la hauteur (répartition space-between,
          pas de scroll sur écran standard ; scroll de sécurité si trop petit). Autres états :
          paddingBottom = respiration finale avant la Bottom Nav. */}
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={(isFirstRun || level === HOME_LEVEL.EMPTY) ? { flexGrow: 1, paddingBottom: 16 } : { paddingBottom: 64 }}>

        {isFirstRun ? (
          /* FIRST RUN HOME — hero + mascotte + histoire + action. Top Bar/Nav inchangés. */
          <HomeFirstRun firstName={firstName} theme={theme} fonts={fonts} onAddProducts={onScan} />
        ) : level === HOME_LEVEL.EMPTY ? (
          /* EMPTY_STOCK — utilisateur DÉJÀ initialisé, stock redevenu vide (≠ First Run). Sans mascotte. */
          <HomeEmptyStock firstName={firstName} theme={theme} fonts={fonts} />
        ) : (
        <>
        {/* ─── GREETING éditorial. Voix contextuelle : uniquement en SUFFICIENT (Active) ; en
            LOW, c'est HomeLowStock qui porte le message adaptatif. ─── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
          <Text style={{ fontFamily: 'Georgia', fontSize: 34, fontWeight: '600', letterSpacing: -0.34, lineHeight: 40, color: theme.text1 }}>
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
        {/* ─── SUFFICIENT = HOME ACTIVE (inchangée) ─── */}
        {/* ─── ÉTAT C : rien ne presse (calme) ─── */}
        {state === HOME_STATE.C && (
          <>
            <View style={{ alignItems: 'center', paddingTop: 40, paddingHorizontal: 32, marginBottom: 8 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, fontWeight: '400', color: theme.text3, textAlign: 'center', lineHeight: 20 }}>
                Rien ne demande ton attention pour le moment. Profites-en.
              </Text>
            </View>
            <HomeWatchList items={watchItems} theme={theme} fonts={fonts} onItemPress={onItemPress} />
          </>
        )}

        {/* ─── ÉTATS A / B : priorité du moment ─── */}
        {(state === HOME_STATE.A || state === HOME_STATE.B) && (
          <>
            <HomePriorityFocus item={priority} theme={theme} fonts={fonts} onPress={() => onItemPress?.(priority)} />

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

            <HomeWatchList items={watchItems} theme={theme} fonts={fonts} onItemPress={onItemPress} />
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
