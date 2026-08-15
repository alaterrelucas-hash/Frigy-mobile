import { View, Text, Image } from 'react-native';
import { resolveFoodImage } from '../../utils/foodLanguage';

// « Tu as aussi… » — Gathering (Signature 02). Rapprochement sémantique de 2–3
// ingrédients disponibles liés à l'idée du soir. Pas d'inventaire, pas de carrousel,
// pas de card, pas de Natural Focus. Composition : primitive + primitive (+ …).
export default function HomeGathering({ items = [], theme, fonts }) {
  if (!items.length) return null;

  // OPTICAL SIZING générique (aucune logique par aliment) : deux primitives de même box
  // n'ont pas la même masse visuelle. On normalise par l'AIRE via le `ratio` (w/h) déjà
  // stocké au registry Food Language : w = A·√r, h = A/√r → aire ≈ A² pour toutes.
  // Cellule de hauteur fixe → centres optiques alignés (donc « + » parfaitement centrés).
  const AREA = 66;      // côté cible (aire optique ≈ AREA²) — +10 % de matière
  const CELL_H = 82;    // hauteur de cellule (centre optique commun)
  const MAXW = 98;      // garde-fou pour aspects très larges

  const opticalSize = (r) => {
    let w = AREA * Math.sqrt(r), h = AREA / Math.sqrt(r);
    if (h > CELL_H) { const k = CELL_H / h; w *= k; h *= k; }
    if (w > MAXW) { const k = MAXW / w; w *= k; h *= k; }
    return { w: Math.round(w), h: Math.round(h) };
  };

  const Plus = () => (
    <View style={{ height: CELL_H, justifyContent: 'center', marginHorizontal: 4 }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 22, fontWeight: '400', color: theme.text4 }}>+</Text>
    </View>
  );

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 4, marginBottom: 16 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, fontWeight: '600', letterSpacing: 0.9, color: theme.text2, marginBottom: 12 }}>
        TU AS AUSSI…
      </Text>
      {/* Groupe (aliments + « + ») centré optiquement dans la largeur utile (Master). */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap' }}>
        {items.map((it, idx) => {
          const prim = resolveFoodImage(it);
          const { w, h } = opticalSize((prim && prim.ratio) || 1);
          return (
            <View key={it.id || it.name} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              {idx > 0 && <Plus />}
              <View style={{ alignItems: 'center', paddingHorizontal: 4 }}>
                <View style={{ height: CELL_H, justifyContent: 'center', alignItems: 'center' }}>
                  {prim
                    ? <Image source={prim.image} style={{ width: w, height: h }} resizeMode="contain" />
                    : <Text style={{ fontSize: 34 }}>{it.emoji || '🛒'}</Text>}
                </View>
                <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, fontWeight: '400', color: theme.text2, marginTop: 5, maxWidth: MAXW + 8, textAlign: 'center' }}>
                  {it.name}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
