import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

// Closing de la Home — point d'entrée « prochaines courses » (préparation Smart Shopping,
// NON développé ici). Conclut la boucle Frigy : Prioriser → Valoriser → Relier → Transformer
// → Surveiller → PRÉPARER. Tertiaire : ne concurrence ni la priorité ni la recette.
// PAS une card — même langage que « À GARDER À L'ŒIL » / « Voir la recette » : overline +
// action + chevron, sans fond/contour/ombre/halo. Aucune logique métier, aucune donnée
// fictive. `onPress` = destination Courses existante (ShoppingListScreen via onShopping).
export default function HomeSmartShoppingEntry({ theme, fonts, onPress }) {
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, fontWeight: '600', letterSpacing: 0.9, color: theme.text2, marginBottom: 10 }}>
        POUR LES PROCHAINES COURSES
      </Text>
      {/* Toute la ligne est tappable ; cible ≥44 via paddingVertical + hitSlop (le chevron
          n'est pas le seul élément interactif). Action = phrase principale, immédiatement claire. */}
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}
        accessibilityRole="button" accessibilityLabel="Acheter seulement ce qu’il faut"
        hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 17, fontWeight: '600', color: theme.text1 }}>
          Acheter seulement ce qu’il faut
        </Text>
        <ChevronRight size={18} color={theme.text3} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );
}
