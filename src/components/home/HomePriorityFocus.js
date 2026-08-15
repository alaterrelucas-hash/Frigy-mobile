import { View, Text, TouchableOpacity, Image } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { resolveFoodImage } from '../../utils/foodLanguage';
import { getTemporalDescriptor, getTemporalColorKey } from '../../utils/temporal';
import { priorityMicroCopy } from '../../utils/homeLogic';
import { formatEuro, rescueValueSpokenLabel } from '../../utils/rescueValue';

// Priorité du moment — composition Home (jamais InventoryProductRow). Un seul foyer
// Natural Focus, derrière la primitive. Réutilise la SÉMANTIQUE + le token canonique
// focusGlowPriority (lecture seule) ; ne modifie pas le Natural Focus de Mon Stock.
export default function HomePriorityFocus({ item, theme, fonts, onPress }) {
  if (!item) return null;
  // N6-13 : le héros est AMPLIFIÉ-gaté par la couche de sélection ; il consomme le jour AUTORITAIRE
  // amplifié porté par l'objet (`attentionDays`), jamais `computeDaysRemaining`/champ brut. La couleur
  // d'alerte + le halo sont donc légitimes (évidence amplifiée présente à ce point).
  const days = item.attentionDays;
  const descriptor = getTemporalDescriptor(days);
  const colorKey = getTemporalColorKey(days);
  const accent = theme[colorKey] || theme.text2;
  const prim = resolveFoodImage(item);
  // Rescue Value — valeur POTENTIELLE à sauver, information utile SECONDAIRE à l'aliment.
  // Montant affirmé (text1), suffixe « à sauver » discret (text3). Pas de vert (réservé
  // action/résultat) ni d'orange (réservé temporalité) → on ne brouille pas la sémantique.
  const rescueDisplay = formatEuro(item.rescueValue);
  const rescueA11y = rescueValueSpokenLabel(item.rescueValue);

  // Food-first : la primitive prioritaire domine l'écran. Le layout ne réserve que
  // HERO en largeur ; le Natural Focus (GLOW) DÉBORDE (overflow visible) → il accompagne
  // l'aliment sans comprimer la colonne texte (même sur petit iPhone).
  const HERO = 200;                 // primitive héro — centre de gravité, impossible à rater
  const GLOW = HERO + 70;           // empreinte Natural Focus, en débordement
  const glowOffset = (HERO - GLOW) / 2;
  const glowColor = theme.focusGlowPriority || theme.accent;

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
      <View style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
        {/* Overline (TS02) : 600 + tracking 0.08em. UPPERCASE conservé pour cohérence
            avec Mon Stock LOCKED + Home Master (écart assumé vs règle ≤2 mots). */}
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, fontWeight: '600', letterSpacing: 0.9, color: theme.text2, marginBottom: 8 }}>
          PRIORITÉ DU MOMENT
        </Text>
        {/* Hero title — serif éditorial système iOS (Georgia), projection Master. */}
        <Text style={{ fontFamily: 'Georgia', fontSize: 28, fontWeight: '700', letterSpacing: -0.28, lineHeight: 34, color: theme.text1, marginBottom: 6 }} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, fontWeight: '600', color: accent, marginBottom: 2 }}>
          {priorityMicroCopy(item)}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, fontWeight: '400', color: theme.text2 }}>
          {descriptor}
        </Text>
        {/* Rescue Value — « X€ à sauver ». Reste dans le bloc priorité (pas de card/bannière),
            sous la temporalité. Tient dans la hauteur du Hero (colonne texte < primitive) →
            ne comprime ni la tomate ni le Gathering. accessibilityLabel = forme parlée. */}
        {!!rescueDisplay && (
          <Text accessibilityLabel={rescueA11y}
            style={{ marginTop: 6, fontSize: 14, lineHeight: 18 }}>
            <Text style={{ fontFamily: fonts.semibold, fontWeight: '600', color: theme.text1 }}>{rescueDisplay}</Text>
            <Text style={{ fontFamily: fonts.regular, fontWeight: '400', color: theme.text2 }}> à sauver</Text>
          </Text>
        )}
      </View>

      {/* translateX négatif : décale le centre optique de l'aliment vers la gauche (plus
          central, moins « collé au bord droit ») sans réserver de largeur supplémentaire
          ni comprimer la colonne texte. Le Natural Focus déborde librement derrière. */}
      <View style={{ width: HERO, height: HERO, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: -22 }] }}>
        {/* Natural Focus — NAPPE (ellipse horizontale via transform de vue), foyer unique,
            derrière/sous la primitive, débordant. Même token/couleur/stops (pas de
            recalibration). FUTURE VISUAL CALIBRATION : réglages fins post-macro. */}
        <Svg width={GLOW} height={GLOW} pointerEvents="none"
          style={{ position: 'absolute', top: glowOffset, left: glowOffset, transform: [{ scaleX: 1.25 }, { scaleY: 0.85 }] }}>
          <Defs>
            <RadialGradient id={`home-focus-${item.id}`} cx="50%" cy="54%" r="58%">
              <Stop offset="0%" stopColor={glowColor} stopOpacity={0.40} />
              <Stop offset="40%" stopColor={glowColor} stopOpacity={0.30} />
              <Stop offset="65%" stopColor={glowColor} stopOpacity={0.15} />
              <Stop offset="85%" stopColor={glowColor} stopOpacity={0.05} />
              <Stop offset="100%" stopColor={glowColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="50%" cy="50%" r="50%" fill={`url(#home-focus-${item.id})`} />
        </Svg>
        {prim
          ? <Image source={prim.image} style={{ width: HERO, height: HERO }} resizeMode="contain" />
          : item.img_url
          ? <Image source={{ uri: item.img_url }} style={{ width: HERO, height: HERO, borderRadius: 20 }} resizeMode="cover" />
          : <Text style={{ fontSize: 64 }}>{item.emoji || '🛒'}</Text>}
      </View>
    </TouchableOpacity>
  );
}
