import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image, TextInput, Modal } from 'react-native';
import { UtensilsCrossed, RefreshCw, Clock, ChevronLeft, Search, SlidersHorizontal, Heart, Leaf } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RECIPES_FN_URL } from '../config/urls';
import { SUPABASE_KEY, supabase } from '../config/supabase';
import { posthog } from '../config/posthog';
import { C } from '../config/constants';
import { generateRecipeImage } from '../api/replicate';
import { getCachedImage, saveCachedImage } from '../api/recipeImages';

const RECIPES_CACHE_KEY = 'fridgy_recipes_cache';
const RECIPES_LAST_REFRESH_KEY = 'fridgy_recipes_last_refresh';

/* ── Module-level constants ── */

const SCREEN = {
  title: 'Mes Recettes',
  searchPlaceholder: 'Rechercher une recette, un ingrédient…',
  refreshLabel: 'Rafraîchir',
  empty: {
    title: 'Pas assez de produits',
    subtitle: 'Scanne des courses pour obtenir des suggestions',
  },
};

const PRIORITY = {
  critique: { label: 'Critique', color: '#FF3B30', bg: '#FFF0F0' },
  moyenne:  { label: 'Moyenne',  color: '#F5B700', bg: '#FFFBEB' },
  faible:   { label: 'Faible',   color: C.green,   bg: `${C.green}18` },
};

/* ── Helpers ── */

function derivePriority(urgentCount) {
  if (urgentCount >= 3) return PRIORITY.critique;
  if (urgentCount >= 2) return PRIORITY.moyenne;
  return PRIORITY.faible;
}

function splitIngredients(ingredients = [], expiringItems = []) {
  const names = new Set(expiringItems.map(i => i.name.toLowerCase()));
  return {
    urgent:        ingredients.filter(ing => names.has(ing.toLowerCase())),
    complementary: ingredients.filter(ing => !names.has(ing.toLowerCase())),
  };
}

/* ── RecipeModal ── */

function RecipeModal({ recipe, onClose, expiringItems }) {
  if (!recipe) return null;
  const { urgent, complementary } = splitIngredients(recipe.ingredients, expiringItems);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#F7F9F8' }}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Hero */}
          <View style={{ height: 280, backgroundColor: '#EAF8EE', alignItems: 'center', justifyContent: 'center' }}>
            {recipe.imgUrl
              ? <Image source={{ uri: recipe.imgUrl }} style={{ width: '100%', height: 280 }} resizeMode="cover" />
              : <Leaf size={64} color={C.green} strokeWidth={1.2} />}
            <TouchableOpacity onPress={onClose}
              style={{ position: 'absolute', top: 52, left: 16, width: 42, height: 42, borderRadius: 21,
                backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: C.t1, marginBottom: 10, letterSpacing: -0.5 }}>
              {recipe.name}
            </Text>

            {/* Badges */}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 12, paddingVertical: 6, backgroundColor: `${C.green}18`, borderRadius: 100 }}>
                <Clock size={13} color={C.green} strokeWidth={2.5} />
                <Text style={{ fontSize: 13, color: C.green, fontWeight: '600' }}>{recipe.time}</Text>
              </View>
              <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F5F5F7', borderRadius: 100 }}>
                <Text style={{ fontSize: 13, color: C.t2, fontWeight: '600' }}>{recipe.diff}</Text>
              </View>
              {recipe.saves && (
                <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFFBEB', borderRadius: 100 }}>
                  <Text style={{ fontSize: 13, color: '#92661A', fontWeight: '600' }}>−{recipe.saves}€ économisés</Text>
                </View>
              )}
            </View>

            {recipe.desc && (
              <Text style={{ fontSize: 15, color: '#6B7280', lineHeight: 23, marginBottom: 20 }}>{recipe.desc}</Text>
            )}

            {/* Ingredients */}
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 14,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.t1, letterSpacing: 0.6, marginBottom: 14 }}>
                INGRÉDIENTS
              </Text>

              {urgent.length > 0 && (
                <>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#FF3B30', letterSpacing: 0.5, marginBottom: 8 }}>
                    À CONSOMMER EN PRIORITÉ
                  </Text>
                  {urgent.map((ing, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                      paddingVertical: 8, borderBottomWidth: i < urgent.length - 1 ? 1 : 0, borderBottomColor: '#F5F5F5' }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' }} />
                      <Text style={{ fontSize: 14, color: C.t1, fontWeight: '500' }}>{ing}</Text>
                    </View>
                  ))}
                  {complementary.length > 0 && <View style={{ height: 16 }} />}
                </>
              )}

              {complementary.length > 0 && (
                <>
                  {urgent.length > 0 && (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.t3, letterSpacing: 0.5, marginBottom: 8 }}>
                      INGRÉDIENTS COMPLÉMENTAIRES
                    </Text>
                  )}
                  {complementary.map((ing, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                      paddingVertical: 8, borderBottomWidth: i < complementary.length - 1 ? 1 : 0, borderBottomColor: '#F5F5F5' }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
                      <Text style={{ fontSize: 14, color: C.t1, fontWeight: '500' }}>{ing}</Text>
                    </View>
                  ))}
                </>
              )}

              {!urgent.length && !complementary.length && (recipe.ingredients || []).map((ing, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 8, borderBottomWidth: i < recipe.ingredients.length - 1 ? 1 : 0, borderBottomColor: '#F5F5F5' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
                  <Text style={{ fontSize: 14, color: C.t1, fontWeight: '500' }}>{ing}</Text>
                </View>
              ))}
            </View>

            {/* Steps */}
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 40,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.t1, letterSpacing: 0.6, marginBottom: 14 }}>
                PRÉPARATION
              </Text>
              {recipe.steps?.length > 0
                ? recipe.steps.map((s, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', gap: 14, marginBottom: 16 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.green,
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{idx + 1}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 14, color: C.t1, lineHeight: 22 }}>{s}</Text>
                    </View>
                  ))
                : (
                  <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                    <UtensilsCrossed size={34} color={C.t4} strokeWidth={1.2} style={{ marginBottom: 10 }} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.t2, marginBottom: 4 }}>
                      Prépare selon tes habitudes
                    </Text>
                    <Text style={{ fontSize: 13, color: C.t3, textAlign: 'center', lineHeight: 19 }}>
                      Les ingrédients ci-dessus suffisent à réaliser cette recette.
                    </Text>
                  </View>
                )}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ── Main screen ── */

export default function RecipesScreen({ items, user }) {
  const [recipes,        setRecipes]        = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [loaded,         setLoaded]         = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [favorites,      setFavorites]      = useState(new Set());
  const [canRefresh,     setCanRefresh]     = useState(false);

  const expiring = items.filter(i => i.days <= 7).sort((a, b) => a.days - b.days);
  const forRecipes = expiring.length >= 2
    ? [...expiring, ...items.filter(i => i.days > 7)].slice(0, 15)
    : items.slice(0, 15);

  const loadRecipes = async (forceRefresh = false) => {
    if (!forRecipes.length) return;
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(RECIPES_CACHE_KEY);
      if (cached) {
        const cachedRecipes = JSON.parse(cached);
        setRecipes(cachedRecipes);
        setLoaded(true);
        await checkCanRefresh();
        for (const [i, r] of cachedRecipes.entries()) {
          let imgUrl = await getCachedImage(r.name, r.desc);
          if (!imgUrl) {
            imgUrl = await generateRecipeImage(r.name, r.desc);
            if (imgUrl) saveCachedImage(r.name, r.desc, imgUrl);
          }
          if (imgUrl) setRecipes(prev => prev.map((recipe, idx) => idx === i ? { ...recipe, imgUrl } : recipe));
        }
        return;
      }
    }
    setLoading(true);
    setCanRefresh(false);
    try {
      const res = await fetch(RECIPES_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          products: forRecipes.map(p => ({
            name: p.name, emoji: p.emoji,
            days_left: p.days_left ?? p.days,
            category: p.category, location: p.location,
          })),
        }),
      });
      const data = await res.json();
      const rawRecipes = data.recipes || [];

      setRecipes(rawRecipes);
      setLoading(false);
      setLoaded(true);
      await AsyncStorage.setItem(RECIPES_CACHE_KEY, JSON.stringify(rawRecipes));
      await AsyncStorage.setItem(RECIPES_LAST_REFRESH_KEY, Date.now().toString());
      setCanRefresh(false);
      if (forceRefresh) posthog.capture('recipes_refreshed', { count: rawRecipes.length, ingredients_count: forRecipes.length });
      else posthog.capture('recipes_generated', { count: rawRecipes.length, ingredients_count: forRecipes.length });

      for (const [i, r] of rawRecipes.entries()) {
        let imgUrl = await getCachedImage(r.name, r.desc);
        if (!imgUrl) {
          imgUrl = await generateRecipeImage(r.name, r.desc);
          if (imgUrl) saveCachedImage(r.name, r.desc, imgUrl);
        }
        if (imgUrl) {
          setRecipes(prev => prev.map((recipe, idx) =>
            idx === i ? { ...recipe, imgUrl } : recipe
          ));
        }
      }
      return;
    } catch { /* keep empty */ }
    setLoading(false);
    setLoaded(true);
  };

  const checkCanRefresh = async () => {
    const last = await AsyncStorage.getItem(RECIPES_LAST_REFRESH_KEY);
    if (!last) { setCanRefresh(true); return; }
    const elapsed = Date.now() - parseInt(last);
    setCanRefresh(elapsed > 24 * 60 * 60 * 1000);
  };

  useEffect(() => { loadRecipes(); }, []);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('saved_recipes').select('name').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setFavorites(new Set(data.map(r => r.name)));
      });
  }, [user?.id]);

  const filteredRecipes = recipes.filter(r =>
    !searchQuery ||
    r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.ingredients?.some(ing => ing.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleFavorite = async (name) => {
    if (!user?.id) return;
    const isFav = favorites.has(name);
    setFavorites(prev => {
      const next = new Set(prev);
      isFav ? next.delete(name) : next.add(name);
      return next;
    });
    posthog.capture(isFav ? 'recipe_unfavorited' : 'recipe_favorited', { name });
    if (isFav) {
      await supabase.from('saved_recipes').delete().eq('user_id', user.id).eq('name', name);
    } else {
      await supabase.from('saved_recipes').insert({ user_id: user.id, name });
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F7F9F8' }} showsVerticalScrollIndicator={false}>
      <RecipeModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} expiringItems={expiring} />

      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}>

        {/* Header */}
        <View style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 30, fontWeight: '900', color: C.t1, letterSpacing: -1, flex: 1 }}>
              {SCREEN.title}
            </Text>
            {canRefresh && (
              <TouchableOpacity onPress={() => loadRecipes(true)} disabled={loading}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 9,
                  backgroundColor: `${C.green}18`, borderRadius: 999,
                  opacity: loading ? 0.5 : 1, marginTop: 6 }}>
                <RefreshCw size={13} color={C.green} strokeWidth={2.5} />
                <Text style={{ fontSize: 13, color: C.green, fontWeight: '700' }}>{SCREEN.refreshLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 6, marginBottom: 16, lineHeight: 22 }}>
            Recettes adaptées à ce que tu as dans ton stock.
          </Text>
        </View>

        {/* Expiring chips */}
        {expiring.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
            {expiring.slice(0, 6).map(p => {
              const critical = p.days <= 1;
              return (
                <View key={p.id} style={{
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                  backgroundColor: critical ? '#FFF0F0' : '#FFFBEB',
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: critical ? '#FF3B30' : '#F5B700' }}>
                    J-{Math.abs(p.days)}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '500', color: critical ? '#FF3B30' : '#92661A', maxWidth: 110 }}
                    numberOfLines={1}>{p.name}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
          borderRadius: 20, paddingHorizontal: 16, height: 56, marginBottom: 20, gap: 12,
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 }}>
          <Search size={18} color={C.t3} strokeWidth={2} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={SCREEN.searchPlaceholder}
            placeholderTextColor={C.t3}
            style={{ flex: 1, fontSize: 15, color: C.t1 }}
          />
          <SlidersHorizontal size={18} color={C.t3} strokeWidth={2} />
        </View>

        {/* Loading */}
        {loading && (
          <View style={{ alignItems: 'center', paddingVertical: 52 }}>
            <ActivityIndicator color={C.green} size="large" />
            <Text style={{ marginTop: 16, fontSize: 15, fontWeight: '600', color: C.t2 }}>
              Fridgy génère tes recettes…
            </Text>
          </View>
        )}

        {/* Empty */}
        {!loading && recipes.length === 0 && loaded && (
          <View style={{ alignItems: 'center', paddingVertical: 52 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: `${C.green}15`,
              alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <UtensilsCrossed size={36} color={C.t4} strokeWidth={1.2} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: C.t2, marginBottom: 6 }}>
              {SCREEN.empty.title}
            </Text>
            <Text style={{ fontSize: 14, color: C.t3, textAlign: 'center', lineHeight: 20 }}>
              {SCREEN.empty.subtitle}
            </Text>
          </View>
        )}

        {/* Recipe cards */}
        {!loading && filteredRecipes.map((r, i) => {
          const { urgent, complementary } = splitIngredients(r.ingredients, expiring);
          const priority = derivePriority(urgent.length);
          const isFav = favorites.has(r.name);

          return (
            <View key={i} style={{ backgroundColor: '#fff', borderRadius: 28, marginBottom: 18,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 14,
              flexDirection: 'row', overflow: 'hidden', height: 210 }}>

              {/* Image */}
              <View style={{ width: '38%', height: 210, backgroundColor: '#EAF8EE',
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {r.imgUrl
                  ? <Image source={{ uri: r.imgUrl }} style={{ width: '100%', height: 210 }} resizeMode="cover" />
                  : <Leaf size={40} color={C.green} strokeWidth={1.2} />}
                <TouchableOpacity onPress={() => toggleFavorite(r.name)}
                  style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16,
                    backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center' }}>
                  <Heart size={15} color={isFav ? C.green : '#9CA3AF'} strokeWidth={2}
                    fill={isFav ? C.green : 'none'} />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <View style={{ flex: 1, padding: 12 }}>

                {/* Top badges */}
                <View style={{ flexDirection: 'row', gap: 5, marginBottom: 6 }}>
                  <View style={{ paddingHorizontal: 7, paddingVertical: 3,
                    backgroundColor: priority.bg, borderRadius: 8 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: priority.color }}>{priority.label}</Text>
                  </View>
                  {r.saves && (
                    <View style={{ paddingHorizontal: 7, paddingVertical: 3,
                      backgroundColor: '#FFFBEB', borderRadius: 8 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#92661A' }}>−{r.saves}€</Text>
                    </View>
                  )}
                </View>

                <Text style={{ fontSize: 14, fontWeight: '800', color: C.t1, lineHeight: 19, marginBottom: 4 }}
                  numberOfLines={2}>{r.name}</Text>

                {r.desc && (
                  <Text style={{ fontSize: 11, color: '#6B7280', lineHeight: 15, marginBottom: 6 }}
                    numberOfLines={2}>{r.desc}</Text>
                )}

                {/* Urgent ingredient tags */}
                {urgent.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {urgent.slice(0, 2).map((ing, j) => (
                      <View key={j} style={{ paddingHorizontal: 6, paddingVertical: 2,
                        backgroundColor: '#FFF0F0', borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, color: '#FF3B30', fontWeight: '600' }} numberOfLines={1}>
                          {ing.length > 14 ? ing.slice(0, 13) + '…' : ing}
                        </Text>
                      </View>
                    ))}
                    {urgent.length > 2 && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2,
                        backgroundColor: '#FFF0F0', borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, color: '#FF3B30', fontWeight: '600' }}>+{urgent.length - 2}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Time + difficulty badges */}
                <View style={{ flexDirection: 'row', gap: 5, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 7, paddingVertical: 3, backgroundColor: `${C.green}15`, borderRadius: 7 }}>
                    <Clock size={11} color={C.green} strokeWidth={2.5} />
                    <Text style={{ fontSize: 11, color: C.green, fontWeight: '600' }}>{r.time}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 7, paddingVertical: 3,
                    backgroundColor: '#F5F5F7', borderRadius: 7 }}>
                    <Text style={{ fontSize: 11, color: C.t3, fontWeight: '600' }}>{r.diff}</Text>
                  </View>
                </View>

                {/* CTA */}
                <TouchableOpacity onPress={() => setSelectedRecipe(r)}
                  style={{ backgroundColor: `${C.green}15`, borderRadius: 12, paddingVertical: 9,
                    alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: C.green, fontWeight: '700' }}>Voir la recette →</Text>
                </TouchableOpacity>

              </View>
            </View>
          );
        })}

      </View>
    </ScrollView>
  );
}
