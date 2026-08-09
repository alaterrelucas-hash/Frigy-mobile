import { View, Text, TouchableOpacity, Image } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { ChevronRight, PackageOpen } from 'lucide-react-native';
import { computeDaysRemaining, getTemporalDescriptor, getTemporalColorKey, TEMPORAL_TIER } from '../utils/temporal';
import { formatQuantityLabel } from '../utils/quantity';

// Ligne continue — pas de card individuelle, pas de FreshnessBar, pas de badge J-x,
// pas de Nutri-Score, pas de brand/category. Ordre de lecture : aliment → nom →
// quantité/état → temporalité → action.
export default function InventoryProductRow({ item, theme, fonts, tier, focusIntensity = 0, isLast, onPress }) {
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

  // Natural Focus — Focus de contact (D7.2) : NAPPE horizontale douce, pas un disque.
  // La ligne est courte (~8 px seulement jusqu'aux séparateurs) : un halo rond assez
  // grand pour être visible les toucherait. On l'aplatit donc fortement (ellipse
  // scaleX 1.20 / scaleY 0.65) → large derrière le produit, bas → dégagé des traits de
  // séparation (~8 px), near-zéro dans les marges (pas de blob à gauche). Pic ≤ 40 % (DS).
  const glowSize = haloSize + 24;
  const glowOffset = (haloSize - glowSize) / 2;
  // Trois teintes lumineuses sémantiques, choisies par STATUT (jamais par aliment) :
  //   overdue (colorKey critical) → famille Critical (présence dédiée à l'item dépassé) ;
  //   Aujourd'hui / priorité      → chaud Priority ;
  //   proche                      → chaud Upcoming, plus silencieux.
  const glowColor = colorKey === 'critical'
    ? theme.focusGlowCritical
    : isPriority ? theme.focusGlowPriority : theme.focusGlowUpcoming;
  // Gradation dans la fenêtre proche : présence décroissante par l'OPACITÉ (mécanisme
  // contraste/opacity du système, aucune couleur de plus). Demain plein → J+4 plus faible.
  const attentionFade = colorKey === 'attention' ? (days <= 1 ? 1 : days <= 3 ? 0.85 : 0.72) : 1;
  // « Plus tard » : Tertiary Text — plus lisible que Disabled (#A1A5AA paraissait
  // désactivé), tout en restant nettement secondaire vs attention/critical.
  const descriptorColor = colorKey === 'neutral' ? theme.text3 : dotColor;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      // La priorité/temporalité est portée par le TEXTE (descriptor), jamais par la
      // seule couleur : VoiceOver lit une phrase complète, pas des fragments + « · ».
      accessible
      accessibilityRole="button"
      accessibilityLabel={[item.name, qtyLabel, descriptor, item.opened ? 'ouvert' : null].filter(Boolean).join(', ')}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 8, paddingHorizontal: 12,
        borderBottomWidth: isLast ? 0 : 1, borderBottomColor: theme.separatorSubtle,
      }}>
      {/* L'aliment est le personnage principal : la vignette garde sa taille,
          mais l'enveloppe autour d'elle se resserre — l'interface s'efface.
          Fond transparent pour les vraies photos détourées (pas de carré
          coloré systématique) ; fallback discret réservé aux emoji DEV, pas
          représentatif du rendu final. Natural Focus éclaire l'aliment lui-même
          (halo resserré au plus près), jamais un rectangle qui l'entoure. */}
      <View style={{
        width: haloSize, height: haloSize,
        alignItems: 'center', justifyContent: 'flex-end', marginRight: 12,
      }}>
        {focusIntensity > 0 && (
          // Dégradé radial doux, jamais une forme : plateau au centre, épaule large sur
          // la zone visible autour de l'aliment, puis longue queue de feathering qui se
          // fond dans le canvas bien avant 100 % (dès ~88 % la lumière est quasi morte →
          // pas de contour identifiable). Aplati en NAPPE horizontale (scaleX 1.20 /
          // scaleY 0.65) via transform de vue : présence large derrière le produit tout
          // en dégageant les traits de séparation. Générique (aucune règle par aliment).
          <Svg
            width={glowSize} height={glowSize}
            style={{ position: 'absolute', top: glowOffset, left: glowOffset, transform: [{ scaleX: 1.20 }, { scaleY: 0.65 }] }}
            pointerEvents="none">
            <Defs>
              <RadialGradient id={`focus-${item.id}`} cx="50%" cy="55%" r="55%">
                <Stop offset="0%" stopColor={glowColor} stopOpacity={focusIntensity} />
                <Stop offset="40%" stopColor={glowColor} stopOpacity={focusIntensity * 0.85} />
                <Stop offset="60%" stopColor={glowColor} stopOpacity={focusIntensity * 0.63} />
                <Stop offset="76%" stopColor={glowColor} stopOpacity={focusIntensity * 0.37} />
                <Stop offset="88%" stopColor={glowColor} stopOpacity={focusIntensity * 0.13} />
                <Stop offset="94%" stopColor={glowColor} stopOpacity={focusIntensity * 0.03} />
                <Stop offset="98%" stopColor={glowColor} stopOpacity={focusIntensity * 0.006} />
                <Stop offset="100%" stopColor={glowColor} stopOpacity={0} />
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
              fontSize: 13, fontWeight: descriptorEmphasis ? '600' : '400',
              color: descriptorColor, opacity: attentionFade,
            }}
            numberOfLines={1}>
            {descriptor}
          </Text>
          {item.opened && <PackageOpen size={10} color={theme.text4} strokeWidth={2} style={{ marginLeft: 1 }} />}
        </View>
      </View>

      {/* Ancrage visuel à droite : reprend la donnée honnête du sous-titre, isolée
          pour un scan rapide. Text System — rôle Secondary (text2) : le NOM reste la
          seule information Primary, l'ancre quantité ne rivalise plus avec lui sur une
          longue liste (répétition de « 1 unité » atténuée). */}
      {qtyLabel && (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, fontWeight: '400', color: theme.text2, marginRight: 10 }}>
          {qtyLabel}
        </Text>
      )}
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor, opacity: attentionFade, marginRight: 9 }} />
      <ChevronRight size={13} color={theme.text4} strokeWidth={2} />
    </TouchableOpacity>
  );
}
