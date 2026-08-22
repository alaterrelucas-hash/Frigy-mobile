import { View, Text, TouchableOpacity, Image } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { resolveFoodImage } from '../../utils/foodLanguage';

// Énoncé temporel CONTEXTUEL (headline) — DÉRIVÉ du jour AUTORITAIRE amplifié (`attentionDays`),
// jamais un label système figé (« PRIORITÉ DU MOMENT »). UNKNOWN/absent est géré en amont : le héros
// n'existe que si l'autorité amplifiée existe. Aucune urgence inventée.
function priorityTemporalHeadline(days) {
  if (typeof days !== 'number') return 'À UTILISER EN PRIORITÉ';
  if (days < 0) return 'À VÉRIFIER EN PRIORITÉ';
  if (days === 0) return "À UTILISER AUJOURD'HUI";
  if (days === 1) return 'À UTILISER DEMAIN';
  return `À UTILISER DANS ${days} JOURS`;
}

// Priorité du moment — composition Home (jamais InventoryProductRow). Un seul foyer Natural Focus,
// derrière la primitive. Réutilise le token canonique focusGlowPriority (lecture seule).
// Doctrine CTA : HOME décide d'agir → RECIPES résout. Solution culinaire fiable → « Voir quoi en
// faire » (contexte item vers Recipes) ; sinon repli TRUTHFUL « Voir le produit » (détail produit).
export default function HomePriorityFocus({ item, theme, fonts, onPress, hasRecipe = false, onSeeRecipe, onSeeProduct }) {
  if (!item) return null;
  // N6-13 : le héros consomme le jour AUTORITAIRE amplifié porté par l'objet (`attentionDays`).
  const days = item.attentionDays;
  const headline = priorityTemporalHeadline(days);
  const prim = resolveFoodImage(item);

  // CTA UNIQUE : solution culinaire fiable → « Voir quoi en faire » ; sinon repli « Voir le produit ».
  const culinary = !!(hasRecipe && onSeeRecipe);
  const ctaLabel = culinary ? 'Voir quoi en faire' : 'Voir le produit';
  const onCta = culinary ? onSeeRecipe : (onSeeProduct || onPress);

  // Food-first : la primitive prioritaire domine ; le Natural Focus (GLOW) déborde (overflow visible).
  const HERO = 200;
  const GLOW = HERO + 70;
  const glowOffset = (HERO - GLOW) / 2;
  const glowColor = theme.focusGlowPriority || theme.accent;

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
      <View style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
        {/* Overline temporel CONTEXTUEL (remplace « PRIORITÉ DU MOMENT ») — 600 + tracking. */}
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, fontWeight: '600', letterSpacing: 0.9, color: theme.text2, marginBottom: 8 }}>
          {headline}
        </Text>
        {/* Hero title — Source Sans 3 (typo Frigy verrouillée ; plus de serif Georgia). */}
        <Text style={{ fontFamily: fonts.semibold, fontSize: 28, fontWeight: '700', letterSpacing: -0.4, lineHeight: 34, color: theme.text1, marginBottom: 6 }} numberOfLines={2}>
          {item.name}
        </Text>
        {/* CTA primaire UNIQUE, explicitement actionnable (le héros reste tappable). Une seule action.
            La valeur économique n'est PLUS dans le héros : elle vit en contexte SECONDAIRE sous la Watch
            (composant HomePriorityValue), pour ne pas concurrencer priorité / aliment / action. */}
        <TouchableOpacity onPress={onCta} activeOpacity={0.85}
          accessibilityRole="button" accessibilityLabel={ctaLabel}
          style={{ marginTop: 14, alignSelf: 'flex-start', backgroundColor: theme.accent,
            borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>{ctaLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* translateX négatif : décale le centre optique de l'aliment vers la gauche sans réserver de
          largeur. Le Natural Focus déborde librement derrière. */}
      <View style={{ width: HERO, height: HERO, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: -22 }] }}>
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
