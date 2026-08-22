import { View, Text, Image, TouchableOpacity, useWindowDimensions } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { getTemporalDescriptor } from '../../utils/temporal';

// HOME CALM — WATCH SUMMARY HERO (aperçu visuel). Utilisateur ÉTABLI, aucune priorité forte : au lieu de
// reproduire la liste Stock (rejeté), la Home SYNTHÉTISE le signal d'attention restreint. HOME = synthèse
// / orientation ; PRODUITS = inventaire détaillé. UN seul hero intégré : à GAUCHE la synthèse Watch
// (« Je garde un œil sur N produits » + plus proche + action légère), à DROITE la mascotte Frigy VALIDÉE
// (assets/frigy-first-run.png — frigo blanc, même personnage reconnaissable ; AUCUN nouvel asset, aucune
// IA, aucune emoji, aucune cerise, aucun nouveau frigo, asset First Run/Empty NON modifiés). Le texte et
// la mascotte appartiennent à la MÊME composition (halo ambiant partagé, pas de card).
//
// PRÉSENTATIONNEL — jamais câblé prod ici. HomeCalm ne re-sélectionne/re-trie/re-compte RIEN : total et
// « plus proche » dérivent des props Watch déjà produites par la couche de vérité (watchItems ordonnés +
// watchOverflow). Aucune revendication de calme global (« tout va bien »/« rien à signaler »…). Aucune
// vignette produit ici : la mascotte est l'ancre visuelle ; le détail vit dans Produits.
//
// VARIANTES (même FAMILLE visuelle : même asset, même géométrie mascotte, même halo) :
//   variant="watch" (défaut) — synthèse Watch (titre + plus proche + CTA), gatée sur ≥1 item Watch réel.
//   variant="silence"        — ZÉRO signal autorisé : copie bornée « pas de suggestion utile pour l'instant »
//                              + phrase de comportement Home. AUCUN CTA, AUCUN produit, AUCUN total (jamais
//                              « 0 produits »), AUCUNE revendication de calme global. Décrit la SORTIE de
//                              Frigy, pas l'état réel du foyer. N'évalue PAS watchItems[0].
const MASCOT = require('../../../assets/frigy-first-run.png');

export default function HomeCalm({ variant = 'watch', watchItems = [], watchOverflow = 0, theme, fonts, onSeeMore }) {
  const { width: W } = useWindowDimensions();
  const isSilence = variant === 'silence';

  // TOTAL Watch = items visibles + débordement (déjà calculés en amont). AUCUN recomptage temporel local.
  const totalWatch = watchItems.length + (typeof watchOverflow === 'number' ? watchOverflow : 0);
  // PLUS PROCHE = premier item déjà ORDONNÉ par la sélection Watch (jamais re-trié ici).
  const nearest = watchItems[0] || null;

  // Watch-backed uniquement : jamais en silence (on n'évalue ni total ni nearest côté rendu silence).
  const hasWatch = !isSilence && totalWatch > 0 && !!nearest;

  // Grammaire FR : 1 → « produit » ; 2+ → « produits ». Copie DÉRIVÉE du vrai total (jamais codée en dur).
  const countLabel = `${totalWatch} produit${totalWatch > 1 ? 's' : ''}`;
  const ctaLabel = totalWatch === 1 ? 'Voir le produit' : `Voir les ${totalWatch} produits`;

  // Descripteur temporel AUTORITAIRE (même source que HomeWatchList : getTemporalDescriptor(watchDays)).
  // Minuscule initiale = simple mise en forme inline (« · demain »), aucune re-dérivation de sens.
  const rawTemporal = nearest ? getTemporalDescriptor(nearest.watchDays) : '';
  const temporalInline = rawTemporal ? rawTemporal.charAt(0).toLowerCase() + rawTemporal.slice(1) : '';

  // Scène Frigy SUR-DIMENSIONNÉE (§6/§8) : ~102 % largeur, plafond 410px, plancher 320. L'asset est une
  // large SCÈNE domestique (frigo + panier + plante). Assez grande pour que, ANCRÉE EN BAS (~28px de la
  // nav), son HAUT reste dans la zone du CTA → scale + descente ENSEMBLE (§5/§6), sans rouvrir de vide.
  // Responsive — target visuel (les marges transparentes de l'asset réduisent la taille VISIBLE).
  const M = Math.max(320, Math.min(Math.round(W * 1.02), 410));

  return (
    // flex:1 → HomeCalm reçoit la vraie hauteur disponible (jusqu'à la tabBar) via le flexGrow parent.
    // Texte ancré HAUT-gauche ; scène ANCRÉE EN BAS (bottom ≈ 28) → occupe le bas-milieu, ~28px au-dessus
    // de la nav. minHeight = garde-fou. Diagonale INFO ↘ FRIGY conservée par la grande échelle.
    <View style={{ flex: 1, minHeight: M + 70, position: 'relative', paddingHorizontal: 20 }}>
      {/* HALO atmosphérique (§11) — SUIT la scène : champ LARGE, très DIFFUS, elliptique/stade (jamais un
          disque fermé). Bleed hors bords → aucun côté visible. Presque effacé : opacité 0.20. accentSoft.
          Concentré vers le BAS derrière la scène. Aucun bord/ombre/stroke. Non interactif. */}
      <View pointerEvents="none" style={{
        position: 'absolute', left: -26, right: -26, top: '22%', bottom: '3%',
        backgroundColor: theme.accentSoft, opacity: 0.20, borderRadius: 9999,
      }} />

      {/* SCÈNE Frigy — ancre visuelle ANCRÉE EN BAS (bottom 28, RELATIF à la nav via le parent flex) →
          occupe le bas-milieu et descend près de la nav ; sa grande taille garde le HAUT près du CTA
          (§5/§6). Bleed droit maîtrisé (−14, panier vers le centre §9). Contain → frigo + panier + plante
          entiers, jamais croppés. zIndex par défaut (< texte). */}
      <Image source={MASCOT} resizeMode="contain" accessibilityLabel="Frigy"
        style={{ position: 'absolute', right: -14, bottom: 28, width: M, height: M }} />

      {/* SYNTHÈSE (haut-gauche) — zIndex AU-DESSUS du halo ET de la scène (texte toujours lisible).
          Largeur 82 % : assez large pour que « Le plus proche : … · … » tienne sur UNE ligne (la scène
          est ancrée plus bas → aucun chevauchement dans la bande info). Ancrée en haut → « Bonjour Lucas ». */}
      <View style={{ paddingTop: 6, width: '82%', zIndex: 2 }}>
        {isSilence ? (
          <>
            {/* SILENCE — énoncé PRIMAIRE : décrit le RÔLE de Frigy et le comportement Home (présence, pas
                revendication d'état foyer). Même niveau visuel que le titre Watch (Source Sans 3, 29/700,
                accent vert profond), retour deux lignes « Je garde un œil / sur tes produits » (sans point
                final). NE revendique NI connaissance complète, NI absence d'urgence. AUCUN compteur (jamais
                « 0 produits ») : pas de total dérivé, pas de nearest. */}
            <Text style={{ fontFamily: fonts.semibold, fontSize: 29, fontWeight: '700', letterSpacing: -0.4,
              lineHeight: 34, color: theme.accent }}>
              Je garde un œil{'\n'}sur tes produits
            </Text>

            {/* SILENCE — secondaire : décrit ce que la Home fera APPARAÎTRE (comportement), jamais une
                prédiction d'événement foyer ni « rien à signaler ». Même hiérarchie que « Le plus proche »,
                sans emphase produit. AUCUN CTA. */}
            <Text style={{ fontFamily: fonts.regular, fontSize: 16.5, fontWeight: '400', color: theme.text2,
              marginTop: 12, lineHeight: 22 }}>
              Je te montrerai ici ce qui mérite ton attention.
            </Text>
          </>
        ) : hasWatch ? (
          <>
            {/* Énoncé PRIMAIRE du calme. Vert fonctionnel profond (accent #166B4D), pas le vert d'action vif,
                pas noir. Poids fort mais < « Bonjour Lucas » (30). Retour naturel « Je garde un œil / sur N ». */}
            <Text style={{ fontFamily: fonts.semibold, fontSize: 29, fontWeight: '700', letterSpacing: -0.4,
              lineHeight: 34, color: theme.accent }}>
              Je garde un œil{'\n'}sur {countLabel}
            </Text>

            {/* PLUS PROCHE — secondaire, neutre. Nom = emphase modeste (semibold), échéance = descripteur
                autoritaire. Pas de vignette (la mascotte est l'ancre). Cluster cohérent (§8 : ~12px). */}
            <Text style={{ fontFamily: fonts.regular, fontSize: 16.5, fontWeight: '400', color: theme.text2,
              marginTop: 12, lineHeight: 22 }}>
              Le plus proche : <Text style={{ fontFamily: fonts.semibold, fontWeight: '600', color: theme.text1 }}>{nearest.name}</Text>
              {temporalInline ? ` · ${temporalInline}` : ''}
            </Text>

            {/* ACTION tertiaire — pill tonale légère (accentSoft), texte accent + chevron. Clairement
                tappable mais JAMAIS le gros CTA vert plein de PRIORITÉ. Pas d'ombre, pas de pleine largeur.
                Destination provisoire = Produits (onSeeMore) ; l'affinage vers le sous-ensemble Watch est
                un GAP connu, non résolu dans cette passe visuelle. */}
            <TouchableOpacity onPress={onSeeMore} activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button" accessibilityLabel={ctaLabel}
              style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', marginTop: 18,
                paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999, backgroundColor: theme.accentSoft }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, fontWeight: '600', color: theme.accent, marginRight: 4 }}>
                {ctaLabel}
              </Text>
              <ChevronRight size={17} color={theme.accent} strokeWidth={2.2} />
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );
}
