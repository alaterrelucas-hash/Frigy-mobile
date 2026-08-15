import { View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Plus, Leaf } from 'lucide-react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

// FIRST RUN HOME — scène d'accueil Frigy (stock jamais initialisé). PAS un onboarding SaaS :
// même Top Bar / nav / typo / tokens que la Home Active. Lecture : ACCUEIL → PROMESSE →
// PREMIÈRE ACTION → CTA, en continuité (pas de rupture verticale). Composition : hero
// asymétrique (texte gauche + grande mascotte droite), bloc action CENTRÉ « Pour commencer »,
// CTA, micro-réassurance. Mascotte = frigy-first-run.png (frigo blanc — AUCUN bras/main/jambe).
const MASCOT = require('../../../assets/frigy-first-run.png');

export default function HomeFirstRun({ firstName, theme, fonts, onAddProducts }) {
  const glow = theme.focusGlowPriority || theme.accent;
  // Mascotte présente ; débordement optique à droite (bleed) pour préserver la colonne
  // texte (TEXT_MIN → « Bonjour » 36px ENTIER, jamais coupé). Halo ∝ mascotte.
  const SCREEN_W = Dimensions.get('window').width;
  const BASE = Math.min(SCREEN_W - 185, Math.round(SCREEN_W * 0.55), 248);
  const TEXT_MIN = 195; // colonne texte élargie (~+25px) → paragraphe en ~4 lignes équilibrées (« Bonjour » toujours entier)
  const M = Math.round(Math.min(Math.round(BASE * 1.5), SCREEN_W - 125) * 1.1); // +10 % taille frigo
  const BLEED = Math.max(6, M - SCREEN_W + 40 + TEXT_MIN);
  const HALO = Math.round(M * 1.5);
  const SHIFT_X = Math.round(M * 0.20); // décalage mascotte vers le centre (gauche) — 15 %+5 %
  const SHIFT_Y = Math.round(M * 0.10); // descente mascotte vers le bas
  const TEXT_UP = Math.round(M * 0.20); // remontée du bloc texte hero vers le haut

  return (
    // flex:1 + space-around : les 3 groupes (hero / action / CTA) se répartissent sur toute
    // la hauteur → respirations modérées, pas de vide mort en bas. (contentContainer flexGrow:1
    // côté HomeScreen ; scroll de sécurité si petit écran.)
    <View style={{ flex: 1, justifyContent: 'space-around', paddingVertical: 6 }}>
      {/* ── HERO — texte à GAUCHE + grande mascotte à DROITE (une seule composition) ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 }}>
        <View style={{ flex: 1, paddingRight: 8, transform: [{ translateY: -TEXT_UP }] }}>
          {/* « Bonjour » ENTIER (ligne 1) puis prénom (ligne 2) — jamais coupé (colonne large). */}
          <Text style={{ fontFamily: 'Georgia', fontSize: 36, fontWeight: '600', letterSpacing: -0.34, lineHeight: 42, color: theme.text1 }}>
            {firstName ? `Bonjour\n${firstName}` : 'Bonjour'}
          </Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 19, fontWeight: '600', color: theme.text1, lineHeight: 25, marginTop: 10 }}>
            On commence avec ce que tu as <Text style={{ color: theme.accent }}>chez toi.</Text>
          </Text>
          {/* Économie citée 1 fois. */}
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, fontWeight: '400', color: theme.text2, lineHeight: 23, marginTop: 12 }}>
            Frigy t’aide à utiliser ce que tu as, éviter le gaspillage et économiser chaque jour.
          </Text>
        </View>
        {/* Mascotte — personnage de marque. Halo Natural Focus derrière (débordement libre). */}
        <View style={{ width: M, height: M, alignItems: 'center', justifyContent: 'center', marginRight: -BLEED, transform: [{ translateX: -SHIFT_X }, { translateY: SHIFT_Y }] }}>
          <Svg width={HALO} height={HALO} pointerEvents="none"
            style={{ position: 'absolute', top: (M - HALO) / 2, left: (M - HALO) / 2, transform: [{ scaleX: 1.1 }, { scaleY: 0.85 }] }}>
            <Defs>
              <RadialGradient id="firstrun-focus" cx="50%" cy="52%" r="55%">
                <Stop offset="0%" stopColor={glow} stopOpacity={0.42} />
                <Stop offset="45%" stopColor={glow} stopOpacity={0.24} />
                <Stop offset="70%" stopColor={glow} stopOpacity={0.10} />
                <Stop offset="88%" stopColor={glow} stopOpacity={0.03} />
                <Stop offset="100%" stopColor={glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx="50%" cy="50%" r="50%" fill="url(#firstrun-focus)" />
          </Svg>
          <Image source={MASCOT} style={{ width: M, height: M }} resizeMode="contain" accessibilityLabel="Frigy" />
        </View>
      </View>

      {/* ── PREMIÈRE ACTION — bloc CENTRÉ (2ᵉ temps fort). Espacement géré par space-around. ── */}
      <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
        {/* Eyebrow « POUR COMMENCER » : feuille discrète + filets latéraux (ornement végétal
            léger, langage existant). Remplace « Ton frigo est vide » (Frigy ne sait pas encore
            ce que possède l'utilisateur, et il gère frigo/congélateur/placard). */}
        <Leaf size={15} color={theme.accent} strokeWidth={2} style={{ marginBottom: 6 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <View style={{ width: 26, height: 1, backgroundColor: theme.separator }} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, fontWeight: '600', letterSpacing: 1.2, color: theme.accent }}>
            POUR COMMENCER
          </Text>
          <View style={{ width: 26, height: 1, backgroundColor: theme.separator }} />
        </View>
        <Text style={{ fontFamily: 'Georgia', fontSize: 26, fontWeight: '600', letterSpacing: -0.2, lineHeight: 31, color: theme.text1, textAlign: 'center' }}>
          Ajoute quelques produits.
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, fontWeight: '400', color: theme.text2, lineHeight: 22, marginTop: 4, textAlign: 'center' }}>
          Frigy s’occupe du reste.
        </Text>
      </View>

      {/* ── BAS : CTA + micro-réassurance (un seul groupe, proche du bas) ── */}
      <View>
        <View style={{ paddingHorizontal: 20 }}>
          <TouchableOpacity activeOpacity={0.85} onPress={onAddProducts}
            accessibilityRole="button" accessibilityLabel="Ajouter mes premiers produits"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.accent, borderRadius: 16, paddingVertical: 17, paddingHorizontal: 24 }}>
            <Plus size={20} color="#fff" strokeWidth={2.5} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 17, fontWeight: '600', color: '#fff' }}>Ajouter mes premiers produits</Text>
          </TouchableOpacity>
        </View>
        {/* Micro-réassurance — secondaire, jamais un 2ᵉ CTA. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 20, marginTop: 14 }}>
          <Leaf size={13} color={theme.text2} strokeWidth={2} importantForAccessibility="no" />
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, fontWeight: '400', color: theme.text2 }}>
            3 ou 4 produits suffisent pour commencer.
          </Text>
        </View>
      </View>
    </View>
  );
}
