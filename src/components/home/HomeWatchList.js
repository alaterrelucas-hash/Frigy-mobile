import { View, Text, TouchableOpacity, Image } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { resolveFoodImage } from '../../utils/foodLanguage';
import { getTemporalDescriptor } from '../../utils/temporal';

// « À garder à l'œil » — zone SECONDAIRE (≤2). Compact, sans Natural Focus, sans card
// dominante, jamais InventoryProductRow. Prépare mentalement la suite.
export default function HomeWatchList({ items = [], theme, fonts, onItemPress }) {
  if (!items.length) return null;
  const SIZE = 40;

  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, fontWeight: '600', letterSpacing: 0.9, color: theme.text2, marginBottom: 10 }}>
        À GARDER À L’ŒIL
      </Text>
      {items.map((it, idx) => {
        // N6-13 : plafond PASSIF. Jour AUTORITAIRE passif porté par l'item (`watchDays`, DATE/HEURISTIC ;
        // NONE/brut déjà exclu par selectWatchItems). Descripteur neutre (plage 0–7 → jamais « dépassé »).
        // Puce NEUTRE (theme.text4) — AUCUNE couleur d'alerte (critical/attention) sur une évidence passive.
        const days = it.watchDays;
        const descriptor = getTemporalDescriptor(days);
        const dot = theme.text4;
        const prim = resolveFoodImage(it);
        return (
          <TouchableOpacity key={it.id || it.name} activeOpacity={0.7} onPress={() => onItemPress?.(it)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
              borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: theme.separatorSubtle }}>
            <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              {prim
                ? <Image source={prim.image} style={{ width: SIZE, height: SIZE }} resizeMode="contain" />
                : <Text style={{ fontSize: 24 }}>{it.emoji || '🛒'}</Text>}
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, fontWeight: '600', color: theme.text1 }} numberOfLines={1}>
              {it.name}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, fontWeight: '400', color: theme.text2, marginRight: 8 }} numberOfLines={1}>
              {descriptor}
            </Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot, marginRight: 8 }} />
            <ChevronRight size={14} color={theme.text4} strokeWidth={2} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
