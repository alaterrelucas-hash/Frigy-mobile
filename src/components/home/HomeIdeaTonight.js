import { View, Text, TouchableOpacity, Image } from 'react-native';
import { ChevronRight, Clock, Leaf } from 'lucide-react-native';

// « Une idée pour ce soir » — Transformation (Signature 02). UNE seule possibilité,
// liée à la priorité + réalisable avec ce qu'on a. Image = RÉSULTAT (pipeline recette,
// P1) — jamais une primitive Food Language. Fallback propre si pas d'image.
// N6-06 : le complément « Il manque X » a été retiré (voir plus bas) — un no-match d'identité
// (UNRESOLVED, N6-05) n'est PAS une preuve de manque, et un Recipe Gap n'est pas un Shopping Intent.
export default function HomeIdeaTonight({ recipe, overline, theme, fonts, onOpenRecipe }) {
  if (!recipe) return null;
  // Résultat = OBJET Food Transformation « posé » (Master) : zone large, transparent,
  // contain, sans card/cadre/fond, jamais masqué par borderRadius/crop.
  // Sélection PAR LA DONNÉE (aucune logique par aliment) :
  //   1) recipe.resultCutout — asset détouré transparent (projection Home) ;
  //   2) recipe.imgUrl       — photo du pipeline recette (fallback réel) ;
  //   3) Leaf                — fallback DS.
  // Objet détouré (PNG transparent), masse alimentaire généreuse mais SECONDAIRE aux tomates.
  // Hauteur calée sur l'assiette réelle (paysage) : une boîte trop haute créait du vide
  // transparent → le texte flottait au centre et « décollait » la recette de la question.
  // Largeur mesurée pour laisser la colonne texte afficher la description SANS ellipse.
  const IMG_W = 216;
  const IMG_H = 138;
  const cutout = recipe.resultCutout || null;
  const hasImg = !!recipe.imgUrl;

  // Rendu de l'image : léger pivot vers l'intérieur (mouvement). PAS de style `filter`
  // ici — sur iOS il aplatit la transparence du détourage sur un fond blanc (rectangle
  // parasite). Le réchauffement du thème clair est traité à la GÉNÉRATION (gravé dans les
  // pixels), pas au rendu.
  const imgStyle = {
    width: IMG_W,
    height: IMG_H,
    transform: [{ rotate: '-7deg' }], // léger pivot vers l'intérieur (mouvement)
  };

  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
      {/* Overline dynamique (data-driven depuis la priorité) : relie la recette à
          l'aliment prioritaire. Fallback universel si le déterminant grammatical manque. */}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, fontWeight: '600', letterSpacing: 0.9, color: theme.text2, marginBottom: 12 }}>
        {overline || 'UNE FAÇON SIMPLE DE L’UTILISER'}
      </Text>

      {/* Composition miroir du hero : texte à gauche, RÉSULTAT culinaire (assiette) à
          droite comme masse alimentaire généreuse — pas une thumbnail de liste, pas de card. */}
      <TouchableOpacity activeOpacity={0.85} onPress={onOpenRecipe}
        style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
          {/* Titre recette — serif éditorial système iOS (Georgia), projection Master. */}
          <Text style={{ fontFamily: 'Georgia', fontSize: 20, fontWeight: '600', letterSpacing: -0.2, color: theme.text1 }} numberOfLines={1}>
            {recipe.name}
          </Text>
          {!!recipe.time && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <Clock size={13} color={theme.text2} strokeWidth={2} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, fontWeight: '400', color: theme.text2 }}>
                {recipe.time}{recipe.diff ? ` · ${recipe.diff}` : ''}
              </Text>
            </View>
          )}
          {!!recipe.desc && (
            // État nominal = 2 lignes ; garde-fou 3 lignes sur petit écran pour NE JAMAIS
            // ellipser la description courte (défaut de finition). Contenu court par nature.
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, fontWeight: '400', color: theme.text2, marginTop: 5 }} numberOfLines={3}>
              {recipe.desc}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 8 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, fontWeight: '600', color: theme.accent }}>Voir la recette</Text>
            <ChevronRight size={15} color={theme.accent} strokeWidth={2.4} />
          </View>
        </View>

        {/* Objet « posé » : transparent, contain (assiette entière), AUCUN cadre/card,
            AUCUN borderRadius/crop (ne pas masquer un rectangle — le cutout est détouré). */}
        <View style={{ width: IMG_W, height: IMG_H, alignItems: 'center', justifyContent: 'center' }}>
          {cutout
            ? <Image source={cutout} style={imgStyle} resizeMode="contain" />
            : hasImg
            ? <Image source={{ uri: recipe.imgUrl }} style={imgStyle} resizeMode="contain" />
            : <Leaf size={40} color={theme.accent} strokeWidth={1.4} />}
        </View>
      </TouchableOpacity>

      {/* N6-06 : bloc « Il manque X → Ajouter aux courses » retiré. Il était alimenté par
          `missingItems`, dérivé d'un no-match d'identité (UNRESOLVED). Représentation ≠ réalité :
          l'absence d'un MATCH n'est pas une preuve d'absence physique, et un Recipe Gap ne crée
          pas de Shopping Intent (CR-09). Suppression structurelle : plus aucune prop `missing`/
          `onShopping` consommée ici → un UNRESOLVED ne peut plus produire « Il manque » depuis Home. */}
    </View>
  );
}
