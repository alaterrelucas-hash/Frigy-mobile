import { View, Text, TouchableOpacity, Image } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { resolveFoodImage } from '../../utils/foodLanguage';
import { getTemporalDescriptor } from '../../utils/temporal';

// « À garder à l'œil » — zone SECONDAIRE (≤2). Compact, sans Natural Focus, sans card
// dominante, jamais InventoryProductRow. Prépare mentalement la suite.
export default function HomeWatchList({ items = [], theme, fonts, onItemPress, overflow, onSeeMore }) {
  if (!items.length) return null;
  const SIZE = 60; // présence secondaire un peu plus affirmée (jamais échelle héros : Poulet rôti reste dominant)
  const shown = items.slice(0, 2); // Home affiche AU PLUS 2 items (décision produit) — le reste → Produits
  const extra = typeof overflow === 'number' ? overflow : Math.max(0, items.length - 2);

  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, fontWeight: '600', letterSpacing: 0.9, color: theme.text2, marginBottom: 10 }}>
        À GARDER À L’ŒIL
      </Text>
      {shown.map((it, idx) => {
        // N6-13 : plafond PASSIF. Jour AUTORITAIRE passif porté par l'item (`watchDays`, DATE/HEURISTIC ;
        // NONE/brut déjà exclu par selectWatchItems). Descripteur neutre (plage 0–7 → jamais « dépassé »).
        // Puce NEUTRE (theme.text4) — AUCUNE couleur d'alerte (critical/attention) sur une évidence passive.
        const days = it.watchDays;
        const descriptor = getTemporalDescriptor(days);
        const prim = resolveFoodImage(it);
        return (
          <TouchableOpacity key={it.id || it.name} activeOpacity={0.7} onPress={() => onItemPress?.(it)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
              borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: theme.separatorSubtle }}>
            <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              {prim
                ? <Image source={prim.image} style={{ width: SIZE, height: SIZE }} resizeMode="contain" />
                : <Text style={{ fontSize: 34 }}>{it.emoji || '🛒'}</Text>}
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, fontWeight: '600', color: theme.text1 }} numberOfLines={1}>
              {it.name}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, fontWeight: '400', color: theme.text2, marginRight: 8 }} numberOfLines={1}>
              {descriptor}
            </Text>
            <ChevronRight size={14} color={theme.text4} strokeWidth={2} />
          </TouchableOpacity>
        );
      })}
      {/* DÉBORDEMENT (§ Watch overflow) : 3+ éligibles → 2 lignes + UNE action tertiaire vers Produits.
          Jamais de dropdown/accordion/carousel/« Voir tout ». Comptage RÉEL (extra). Traitement discret
          (lien accent + chevron, langage de navigation des lignes), plus léger que « Voir quoi en faire ». */}
      {extra > 0 && onSeeMore && (
        <TouchableOpacity onPress={onSeeMore} activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={extra === 1 ? "Voir l'autre produit à garder à l'œil" : `Voir les ${extra} autres produits à garder à l'œil`}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10,
            borderTopWidth: 1, borderTopColor: theme.separatorSubtle }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, fontWeight: '600', color: theme.accent, marginRight: 4 }}>
            {extra === 1 ? "Voir l'autre" : `Voir les ${extra} autres`}
          </Text>
          <ChevronRight size={14} color={theme.text4} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </View>
  );
}
