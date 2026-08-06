import { useColorScheme } from 'react-native';
import { C } from '../config/constants';

/**
 * Palette scopée à l'écran Mon Stock et à ses composants dédiés.
 * Migrée vers les tokens normatifs du Color System Frigy (CS01-FINAL.1),
 * localement — ne touche pas à `C` (palette globale de l'app, partagée par
 * les autres écrans), pas de migration Dark Mode globale.
 *
 * GAP DOCUMENTÉ — Dark Mode : la Specification ne donne de valeurs hex
 * explicites que pour Foundations et Text System en Dark Mode. Critical,
 * Notice/Attention, et le fond "subtle" de Brand/Action n'ont pas de valeur
 * Dark confirmée sur le board fourni (section 10 montre des pastilles sans
 * hex lisible). Conformément à la consigne "ne pas déduire", ces tokens
 * restent sur leurs valeurs précédentes (déjà calibrées pour la lisibilité
 * en sombre) en attendant une Specification Dark Mode normative complète.
 * Brand/Action et le halo Natural Focus sont volontairement identiques dans
 * les deux thèmes : ce sont des couleurs de marque/lumière, pas des surfaces
 * nécessitant une inversion — pas une déduction, juste la seule valeur donnée
 * par la Spec, appliquée telle quelle aux deux modes.
 */
const LIGHT = {
  isDark: false,
  bg: '#FAFBF2',            // Canvas
  surface: '#FFFFFF',       // Surface
  text1: '#111317',         // Primary Text
  text2: '#52565A',         // Secondary Text
  text3: '#75797A',         // Tertiary Text
  text4: '#A1A5AA',         // Disabled Text
  separator: '#E5E3DD',     // Border / Divider
  // CONTRADICTION DOCUMENTÉE : la Spec donne Critical #C02828 / Notice #B16800,
  // mais appliquées telles quelles elles rendent plus ternes/brunes que le rouge
  // et l'orange vifs du Master (comparaison directe du 05/08, capture 18:00 vs
  // Master). Le Master prime : on revient aux tons vifs déjà utilisés dans le
  // reste de l'app (C.red/C.orange), qui correspondent visuellement au Master.
  critical: '#FF4B4B',
  attention: '#FF9500',
  neutral: '#A1A5AA',       // Disabled Text (réutilisé — pas de statut "neutre" dédié dans la Spec)
  accent: '#166B4D',        // Brand/Action — Default
  accentSoft: '#E6F0EB',    // Brand/Action — Subtle
  // Natural Focus — Focus Light (D7.2, contact). Couleur de base (sans alpha) :
  // l'intensité/le dégradé sont gérés par le rendu (RadialGradient), pas ici.
  focusGlow: '#FFF2D6',
  scopeContainerBg: '#F6F6F3', // Elevated Surface
  scopeActiveBg: '#FFFFFF',    // Surface
  scopeActiveText: '#111317',  // Primary Text
  scopeActiveIcon: '#166B4D',  // Brand/Action — Default
  scopeInactiveText: '#75797A', // Tertiary Text
};

const DARK = {
  isDark: true,
  bg: '#0E0F10',             // Canvas (Dark)
  surface: '#151617',        // Surface (Dark)
  text1: '#F5F6F7',          // Primary Text (Dark)
  text2: '#C7C9CC',          // Secondary Text (Dark)
  text3: '#9EA2A6',          // Tertiary Text (Dark)
  text4: '#6B6F73',          // Disabled Text (Dark)
  separator: '#2A2C2F',      // Border / Divider (Dark)
  critical: '#FF6259',       // GAP — pas de valeur Dark normative fournie, conservé
  attention: '#FFA53D',      // GAP — pas de valeur Dark normative fournie, conservé
  neutral: '#6B6F73',        // Disabled Text (Dark)
  accent: '#166B4D',         // Brand/Action — identique aux deux thèmes (voir note)
  accentSoft: `${C.green}22`, // GAP — pas de variante "Subtle" Dark normative fournie, conservé
  focusGlow: '#FFF2D6',      // Focus Light — même teinte lumière que Light, intensité gérée au rendu
  scopeContainerBg: 'rgba(255,255,255,0.06)', // GAP — pas de valeur Dark normative fournie, conservé
  scopeActiveBg: '#166B4D',  // Brand/Action — identique aux deux thèmes
  scopeActiveText: '#FFFFFF', // On Action (Text) — Spec
  scopeActiveIcon: '#FFFFFF', // On Action (Text) — Spec
  scopeInactiveText: '#9EA2A6', // Tertiary Text (Dark)
};

export function useStockTheme() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DARK : LIGHT;
}
