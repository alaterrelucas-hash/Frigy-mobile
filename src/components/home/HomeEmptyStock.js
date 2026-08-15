import { View, Text, Image, Dimensions } from 'react-native';

// EMPTY_STOCK — état de REPOS de Frigy (utilisateur connu, stock actuellement vide). « Frigy
// est là, tout est calme, tu reprends quand tu veux. » Scène de marque `frigy-empty-returning`
// (frigo fermé + visage + panier + plante) = présence émotionnelle, échelle COMPAGNON. Aucun
// CTA (le « + » global est l'action), aucune flèche/halo/card.
//
// ASSET — variante RECADRÉE `-tight` : même contenu (frigo + panier + plante + ombres), sans
// régénération ni retouche ; seul le halo périphérique transparent a été rogné (cadre 1536→1280,
// hauteur inchangée). À rendu égal, chaque élément — dont le frigo — gagne ~20 % de présence.
// Le recadrage RE-CENTRE le contenu (centre 639 vs 640) → plus aucun décalage optique nécessaire.
//
// CALIBRATION SPATIALE — deux ENSEMBLES + une respiration principale (pas trois zones égales) :
//   A [greeting + voix] (haut-gauche, groupe fort)
//   — respiration éditoriale GÉNÉREUSE (ressort 3.5, volontaire = calme de EMPTY) —
//   B [scène + micro-copy] (centrée, groupe fort, DESCENDU vers le bas)
//   — respiration basse plus COURTE (ressort 2) → Frigy se rapproche du « + » global.
const SCENE = require('../../../assets/frigy-empty-returning-tight.png');
const IMG_W = 1280, IMG_H = 1024; // asset recadré (contenu re-centré, pas de translateX)

export default function HomeEmptyStock({ firstName, theme, fonts }) {
  const SCREEN_W = Dimensions.get('window').width;
  const SW = Math.min(SCREEN_W - 16, 400);          // max sûr (contenu ne doit jamais sortir de l'écran)
  const SH = Math.round((SW * IMG_H) / IMG_W);

  return (
    <View style={{ flex: 1 }}>
      {/* ENSEMBLE A — identité / voix (groupe fort, aligné gauche) */}
      <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        <Text style={{ fontFamily: 'Georgia', fontSize: 36, fontWeight: '600', letterSpacing: -0.34, lineHeight: 42, color: theme.text1 }}>
          {firstName ? `Bonjour ${firstName}` : 'Bonjour'}
        </Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 20, fontWeight: '600', color: theme.text1, lineHeight: 27, marginTop: 10 }}>
          On repart quand tu veux.
        </Text>
      </View>

      {/* ENSEMBLE B — présence / continuité. Ressorts flex asymétriques (3.5 haut / 2 bas) →
          respiration haute dominante (calme volontaire au-dessus de Frigy), respiration basse
          plus courte : la masse Frigy descend et se rapproche du « + » global. Composition
          optique, pas un space-between mécanique. Le groupe [scène + micro-copy] reste UNE unité. */}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ flex: 3.5 }} />
        <Image source={SCENE} style={{ width: SW, height: SH }}
          resizeMode="contain" accessibilityLabel="Frigy" />
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, fontWeight: '400', color: theme.text2, lineHeight: 23, marginTop: 12, textAlign: 'center', maxWidth: 300 }}>
          Ajoute ce que tu as, Frigy reprend le fil.
        </Text>
        <View style={{ flex: 2 }} />
      </View>
    </View>
  );
}
