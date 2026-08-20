import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Search, SlidersHorizontal, ShoppingCart } from 'lucide-react-native';

// Titre + recherche/filtres révélés à la demande (icônes), au lieu d'une barre
// de recherche et de pills toujours visibles. Réutilise intégralement l'état
// et la logique de recherche/filtre existants — pas de nouvelle fonctionnalité,
// seulement un mode de révélation différent.
export default function InventoryHeader({ theme, fonts, query, onQueryChange, activeFilter, onFilterChange, filters, onShopping }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // paddingHorizontal 16 = marge de contenu (scope control, sections, rows) : le titre
  // s'aligne sur tout le reste (Spatial §01 « aligner ce qui se ressemble »).
  // paddingTop 16 = pas de base de l'échelle spatiale.
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Titre mis en avant — toujours Source Sans 3 SemiBold (le serif du Master
            reste une dépendance non résolue, voir échange précédent) : on gagne en
            présence par la taille et le tracking plutôt qu'un poids inventé. */}
        <Text style={{ fontFamily: fonts.semibold, fontSize: 32, fontWeight: '600', lineHeight: 37, letterSpacing: -0.4, color: theme.text1 }}>Mon stock</Text>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {/* PA-01 : accès CAPACITÉ à la liste de courses — toujours présent dans Mon Stock, indépendant
              du stock/temporel/filtre/recherche/lifecycle. Simple navigation (onShopping), aucune donnée,
              aucune reco d'achat, aucune inférence « manquant/à acheter ». Même langage circulaire compact
              que Search/Filters, non dominant. */}
          <TouchableOpacity
            onPress={() => onShopping?.()}
            accessibilityRole="button"
            accessibilityLabel="Courses"
            accessibilityHint="Ouvrir la liste de courses"
            style={{
              width: 33, height: 33, borderRadius: 16.5, backgroundColor: theme.surface,
              alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.separator,
            }}>
            <ShoppingCart size={14} color={theme.text2} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSearchOpen(o => !o)}
            accessibilityRole="button"
            accessibilityLabel="Rechercher un produit"
            accessibilityState={{ expanded: searchOpen }}
            style={{
              width: 33, height: 33, borderRadius: 16.5, backgroundColor: theme.surface,
              alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.separator,
            }}>
            <Search size={14} color={searchOpen ? theme.accent : theme.text2} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFiltersOpen(o => !o)}
            accessibilityRole="button"
            accessibilityLabel="Filtrer le stock"
            accessibilityState={{ expanded: filtersOpen }}
            style={{
              width: 33, height: 33, borderRadius: 16.5, backgroundColor: theme.surface,
              alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.separator,
            }}>
            <SlidersHorizontal size={14} color={filtersOpen ? theme.accent : theme.text2} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {searchOpen && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
          borderRadius: 12, borderWidth: 1, borderColor: theme.separator,
          paddingHorizontal: 12, height: 42, marginTop: 14,
        }}>
          <Search size={15} color={theme.text3} strokeWidth={2} style={{ marginRight: 8 }} />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Rechercher un produit…"
            placeholderTextColor={theme.text4}
            autoFocus
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, fontWeight: '400', color: theme.text1 }}
          />
        </View>
      )}

      {filtersOpen && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {filters.map(f => {
            const isActive = activeFilter === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => onFilterChange(f)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
                  backgroundColor: isActive ? theme.accent : theme.surface,
                  borderWidth: 1, borderColor: isActive ? theme.accent : theme.separator,
                }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, fontWeight: '600', color: isActive ? '#fff' : theme.text2 }}>
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
