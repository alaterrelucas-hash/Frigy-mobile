import { View, Text, TouchableOpacity, Image } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { ChevronRight, PackageOpen } from 'lucide-react-native';
import { computeDaysRemaining, getTemporalDescriptor, getTemporalColorKey, TEMPORAL_TIER } from '../utils/temporal';
import { formatQuantityLabel } from '../utils/quantity';

// Ligne continue — pas de card individuelle, pas de FreshnessBar, pas de badge J-x,
// pas de Nutri-Score, pas de brand/category. Ordre de lecture : aliment → nom →
// quantité/état → temporalité → action.
export default function InventoryProductRow({ item, theme, fonts, tier, isFocused, isLast, onPress }) {
  const days = computeDaysRemaining(item);
  const descriptor = getTemporalDescriptor(days);
  const colorKey = getTemporalColorKey(days);
  const dotColor = theme[colorKey];
  const qtyLabel = formatQuantityLabel(item);
  // Temporel neutre (Plus tard) → 400 ; temporel en emphase (aujourd'hui/dépassé/
  // prochainement, déjà porté par colorKey) → 600. Rôle Label, Typography System.
  const descriptorEmphasis = colorKey !== 'neutral';
  const isPriority = tier === TEMPORAL_TIER.PRIORITY;
  // Priorité = l'œil doit y aller en premier : la vignette grossit, pas le texte.
  const imageSize = isPriority ? 78 : 60;
  const haloSize = isPriority ? 84 : 66; // halo circulaire (haloSize/2) — lumière organique, pas un rectangle
  const imageRadius = isPriority ? 18 : 16;
  const emojiSize = isPriority ? 36 : 30;
  // Catégorie morphologique générique "vertical étroit" — déclenchée par le ratio
  // largeur/hauteur intrinsèque de l'asset (jamais par nom/id). Le halo occupe déjà
  // haloSize (6px de plus que imageSize, marge jusque-là inutilisée) : une primitive
  // étroite peut donc utiliser toute cette hauteur sans faire grandir la row, qui
  // reste pilotée par haloSize, inchangé. Largeur inchangée (jamais le facteur
  // limitant pour ce type de morphologie).
  const isNarrowVertical = item.localImageRatio != null && item.localImageRatio < 0.5;
  const foodHeight = isNarrowVertical ? haloSize : imageSize;
  // Catégorie morphologique générique "compact/rond" — dans une zone carrée,
  // `contain` fait qu'un sujet au ratio proche de 1:1 remplit presque toute la
  // zone alors qu'un sujet étiré (bacon, dinde...) n'en utilise qu'une partie :
  // c'est structurel, pas spécifique à un aliment. On tempère uniformément
  // largeur ET hauteur (donc sans déformation, sans grandir la row).
  const isCompactRound = item.localImageRatio != null && item.localImageRatio >= 0.8 && item.localImageRatio <= 1.25;
  const compactScale = isCompactRound ? 0.88 : 1;
  const foodWidth = imageSize * compactScale;
  const scaledFoodHeight = foodHeight * compactScale;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 7, paddingHorizontal: 12,
        borderBottomWidth: isLast ? 0 : 1, borderBottomColor: theme.separator,
      }}>
      {/* L'aliment est le personnage principal : la vignette garde sa taille,
          mais l'enveloppe autour d'elle se resserre — l'interface s'efface.
          Fond transparent pour les vraies photos détourées (pas de carré
          coloré systématique) ; fallback discret réservé aux emoji DEV, pas
          représentatif du rendu final. Natural Focus éclaire l'aliment lui-même
          (halo resserré au plus près), jamais un rectangle qui l'entoure. */}
      <View style={{
        width: haloSize, height: haloSize,
        alignItems: 'center', justifyContent: 'flex-end', marginRight: isPriority ? 12 : 10,
      }}>
        {isFocused && (
          // Lumière diffuse, pas une forme : dégradé radial très doux qui s'éteint
          // avant d'atteindre un bord — jamais un disque identifiable. Ne change
          // pas la taille de la zone alimentaire, purement décoratif en arrière-plan.
          <Svg
            width={haloSize} height={haloSize}
            style={{ position: 'absolute', top: 0, left: 0 }}
            pointerEvents="none">
            <Defs>
              <RadialGradient id={`focus-${item.id}`} cx="50%" cy="55%" r="55%">
                <Stop offset="0%" stopColor={theme.focusGlow} stopOpacity={0.4} />
                <Stop offset="40%" stopColor={theme.focusGlow} stopOpacity={0.22} />
                <Stop offset="70%" stopColor={theme.focusGlow} stopOpacity={0.1} />
                <Stop offset="100%" stopColor={theme.focusGlow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx="50%" cy="50%" r="50%" fill={`url(#focus-${item.id})`} />
          </Svg>
        )}
        <View style={{
          width: foodWidth, height: scaledFoodHeight, borderRadius: imageRadius,
          backgroundColor: (item.localImage || item.img_url) ? 'transparent' : theme.accentSoft,
          alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden',
        }}>
          {item.localImage
            // Primitive canonique Food Language : silhouette détourée entière préservée,
            // jamais recadrée en carré (le carré vient parfois plus large ou plus haut).
            ? <Image source={item.localImage} style={{ width: foodWidth, height: scaledFoodHeight }} resizeMode="contain" />
            : item.img_url
            ? <Image source={{ uri: item.img_url }} style={{ width: imageSize, height: imageSize }} resizeMode="cover" />
            : <Text style={{ fontSize: emojiSize }}>{item.emoji || '🛒'}</Text>}
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Nom produit — échelle recalibrée sur le Master (15pt, Spec donnait 16pt) */}
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, fontWeight: '600', color: theme.text1 }} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1, opacity: 0.85 }}>
          {/* Label Small — Typography System Frigy (12/400) */}
          {qtyLabel && <Text style={{ fontFamily: fonts.regular, fontSize: 12, fontWeight: '400', color: theme.text2 }}>{qtyLabel}</Text>}
          {qtyLabel && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: theme.text4 }}>·</Text>}
          {/* TemporalDescriptor — échelle recalibrée sur le Master (13pt max, Spec
              donnait 14pt). Couleur alignée sur le Master : le texte porte le statut
              au même titre que le point. */}
          <Text
            style={{
              fontFamily: descriptorEmphasis ? fonts.semibold : fonts.regular,
              fontSize: 13, fontWeight: descriptorEmphasis ? '600' : '400', color: dotColor,
            }}
            numberOfLines={1}>
            {descriptor}
          </Text>
          {item.opened && <PackageOpen size={10} color={theme.text4} strokeWidth={2} style={{ marginLeft: 1 }} />}
        </View>
      </View>

      {/* Ancrage visuel à droite, aligné sur le Master : reprend la même donnée
          honnête que le sous-titre (aucune valeur inventée), juste isolée pour
          une lecture rapide en un coup d'œil. Échelle recalibrée sur le Master
          (14pt, Spec donnait 16pt), sans troncature. */}
      {qtyLabel && (
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, fontWeight: '600', color: theme.text1, marginRight: 10 }}>
          {qtyLabel}
        </Text>
      )}
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor, marginRight: 9 }} />
      <ChevronRight size={13} color={theme.text4} strokeWidth={2} />
    </TouchableOpacity>
  );
}
