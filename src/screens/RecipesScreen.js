import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UtensilsCrossed, RefreshCw, Clock, ChevronLeft, Search, Heart, Leaf } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RECIPES_FN_URL, SPOONACULAR_KEY } from '../config/urls';
import { SUPABASE_KEY, supabase } from '../config/supabase';
import { posthog } from '../config/posthog';
import { C } from '../config/constants';
import { getCachedImage, saveCachedImage } from '../api/recipeImages';

async function spoonacularSearch(query) {
  try {
    const res = await fetch(
      `https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(query)}&apiKey=${SPOONACULAR_KEY}&number=1`
    );
    const data = await res.json();
    return data.results?.[0]?.image ?? null;
  } catch { return null; }
}

async function fetchRecipeImage(r) {
  const queries = [
    r.imageQuery,
    r.imageQuery?.split(' ').slice(0, 2).join(' '),
    r.ingredients?.[0],
    r.ingredients?.[1],
    r.name.split(' ').slice(0, 2).join(' '),
  ].filter(Boolean);
  for (const q of queries) {
    const url = await spoonacularSearch(q);
    if (url) return url;
  }
  return null;
}

const RECIPES_CACHE_KEY       = 'fridgy_recipes_cache_v2';
const RECIPES_LAST_REFRESH_KEY = 'fridgy_recipes_last_refresh_v2';

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
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView showsVerticalScrollIndicator={false} bounces>

          {/* Hero */}
          <View style={{ height: 300, backgroundColor: '#EAF8EE', alignItems: 'center', justifyContent: 'center' }}>
            {recipe.imgUrl
              ? <Image source={{ uri: recipe.imgUrl }} style={{ width: '100%', height: 300 }} resizeMode="cover" />
              : <Leaf size={64} color={C.green} strokeWidth={1.2} />}
            {/* Gradient overlay — implémenté en RN sans LinearGradient */}
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
              backgroundColor: 'rgba(0,0,0,0.28)' }} />
          </View>

          {/* Back button */}
          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <TouchableOpacity onPress={onClose}
              style={{ margin: 16, width: 40, height: 40, borderRadius: 20,
                backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={{ padding: 20 }}>

            {/* Titre + badges */}
            <Text style={{ fontSize: 26, fontWeight: '900', color: C.t1, letterSpacing: -1, marginBottom: 12 }}>
              {recipe.name}
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: 12, paddingVertical: 7, backgroundColor: `${C.green}15`, borderRadius: 100 }}>
                <Clock size={13} color={C.green} strokeWidth={2.5} />
                <Text style={{ fontSize: 13, color: C.green, fontWeight: '700' }}>{recipe.time}</Text>
              </View>
              <View style={{ paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.card, borderRadius: 100,
                borderWidth: 1, borderColor: C.border }}>
                <Text style={{ fontSize: 13, color: C.t2, fontWeight: '600' }}>{recipe.diff}</Text>
              </View>
              {recipe.saves && (
                <View style={{ paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FFFBEB', borderRadius: 100 }}>
                  <Text style={{ fontSize: 13, color: '#92661A', fontWeight: '700' }}>−{recipe.saves}€ économisés</Text>
                </View>
              )}
            </View>

            {recipe.desc && (
              <Text style={{ fontSize: 15, color: C.t3, lineHeight: 22, marginBottom: 20 }}>{recipe.desc}</Text>
            )}

            {/* Ingrédients */}
            <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 18, marginBottom: 12,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: C.t3, letterSpacing: 1, marginBottom: 14 }}>
                INGRÉDIENTS
              </Text>

              {urgent.length > 0 && (
                <>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#FF3B30', letterSpacing: 0.5, marginBottom: 8 }}>
                    À CONSOMMER EN PRIORITÉ
                  </Text>
                  {urgent.map((ing, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
                      paddingVertical: 10, borderBottomWidth: i < urgent.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' }} />
                      <Text style={{ fontSize: 14, color: C.t1, fontWeight: '500' }}>{ing}</Text>
                    </View>
                  ))}
                  {complementary.length > 0 && <View style={{ height: 12 }} />}
                </>
              )}

              {complementary.length > 0 && (
                <>
                  {urgent.length > 0 && (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.t3, letterSpacing: 0.5, marginBottom: 8 }}>
                      AUTRES INGRÉDIENTS
                    </Text>
                  )}
                  {complementary.map((ing, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
                      paddingVertical: 10, borderBottomWidth: i < complementary.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
                      <Text style={{ fontSize: 14, color: C.t1, fontWeight: '500' }}>{ing}</Text>
                    </View>
                  ))}
                </>
              )}

              {!urgent.length && !complementary.length && (recipe.ingredients || []).map((ing, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingVertical: 10, borderBottomWidth: i < recipe.ingredients.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
                  <Text style={{ fontSize: 14, color: C.t1, fontWeight: '500' }}>{ing}</Text>
                </View>
              ))}
            </View>

            {/* Étapes */}
            <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 18, marginBottom: 40,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: C.t3, letterSpacing: 1, marginBottom: 16 }}>
                PRÉPARATION
              </Text>
              {recipe.steps?.length > 0
                ? recipe.steps.map((s, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', gap: 14, marginBottom: 18 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.green,
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{idx + 1}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 15, color: C.t1, lineHeight: 23, paddingTop: 3 }}>{s}</Text>
                    </View>
                  ))
                : (
                  <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <UtensilsCrossed size={32} color={C.t4} strokeWidth={1.2} style={{ marginBottom: 10 }} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.t2 }}>Prépare selon tes habitudes</Text>
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

  const expiring  = items.filter(i => i.days <= 7).sort((a, b) => a.days - b.days);
  const forRecipes = expiring.length >= 2
    ? [...expiring, ...items.filter(i => i.days > 7)].slice(0, 15)
    : items.slice(0, 15);

  const loadImages = (recipeList) => {
    recipeList.forEach(async (r) => {
      if (r.imgUrl) return;
      try {
        let imgUrl = await getCachedImage(r.name, r.desc);
        if (!imgUrl) {
          imgUrl = await fetchRecipeImage(r);
          if (imgUrl) saveCachedImage(r.name, r.desc, imgUrl);
        }
        if (imgUrl) {
          setRecipes(prev => {
            const updated = prev.map(recipe => recipe.name === r.name ? { ...recipe, imgUrl } : recipe);
            AsyncStorage.setItem(RECIPES_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
            return updated;
          });
        }
      } catch { /* image non critique */ }
    });
  };

  const loadRecipes = async (forceRefresh = false) => {
    if (!forRecipes.length) { setLoaded(true); return; }
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(RECIPES_CACHE_KEY);
      if (cached) {
        const cachedRecipes = JSON.parse(cached);
        setRecipes(cachedRecipes);
        setLoaded(true);
        await checkCanRefresh();
        loadImages(cachedRecipes);
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
      loadImages(rawRecipes);
    } catch { /* keep empty */ }
    setLoading(false);
    setLoaded(true);
  };

  const checkCanRefresh = async () => {
    const last = await AsyncStorage.getItem(RECIPES_LAST_REFRESH_KEY);
    if (!last) { setCanRefresh(true); return; }
    setCanRefresh(Date.now() - parseInt(last) > 24 * 60 * 60 * 1000);
  };

  useEffect(() => { loadRecipes(); }, [items.length]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('saved_recipes').select('name').eq('user_id', user.id)
      .then(({ data }) => { if (data) setFavorites(new Set(data.map(r => r.name))); });
  }, [user?.id]);

  const filteredRecipes = recipes.filter(r =>
    !searchQuery ||
    r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.ingredients?.some(ing => ing.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleFavorite = async (name) => {
    if (!user?.id) return;
    const isFav = favorites.has(name);
    setFavorites(prev => { const n = new Set(prev); isFav ? n.delete(name) : n.add(name); return n; });
    posthog.capture(isFav ? 'recipe_unfavorited' : 'recipe_favorited', { name });
    if (isFav) await supabase.from('saved_recipes').delete().eq('user_id', user.id).eq('name', name);
    else await supabase.from('saved_recipes').insert({ user_id: user.id, name });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} showsVerticalScrollIndicator={false}>
      <RecipeModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} expiringItems={expiring} />

      {/* ─── HEADER ─── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={{ fontSize: 40, fontWeight: '900', color: C.t1, letterSpacing: -1.5 }}>Recettes</Text>
            <Text style={{ fontSize: 14, color: C.t3, marginTop: 4 }}>
              {expiring.length > 0
                ? `Basées sur ${expiring.length} produit${expiring.length > 1 ? 's' : ''} qui expirent bientôt`
                : 'Basées sur ton stock du moment'}
            </Text>
          </View>
          {canRefresh && (
            <TouchableOpacity onPress={() => loadRecipes(true)} disabled={loading}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 9,
                backgroundColor: `${C.green}15`, borderRadius: 999,
                opacity: loading ? 0.5 : 1, marginTop: 10 }}>
              <RefreshCw size={13} color={C.green} strokeWidth={2.5} />
              <Text style={{ fontSize: 13, color: C.green, fontWeight: '700' }}>Rafraîchir</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─── EXPIRING CHIPS ─── */}
      {expiring.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 16 }}>
          {expiring.slice(0, 6).map(p => {
            const critical = p.days <= 1;
            return (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14,
                backgroundColor: critical ? '#FFF0F0' : C.card,
                borderWidth: 1, borderColor: critical ? '#FFD0CC' : C.border }}>
                <View style={{ width: 6, height: 6, borderRadius: 3,
                  backgroundColor: critical ? '#FF3B30' : '#FF9500' }} />
                <Text style={{ fontSize: 12, fontWeight: '700',
                  color: critical ? '#FF3B30' : C.t2 }} numberOfLines={1}>
                  {p.emoji} {p.name}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '800',
                  color: critical ? '#FF3B30' : '#FF9500' }}>J-{p.days}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ─── SEARCH ─── */}
      <View style={{ marginHorizontal: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center',
        backgroundColor: C.card, borderRadius: 18, paddingHorizontal: 16, height: 52, gap: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6,
        borderWidth: 1, borderColor: C.border }}>
        <Search size={16} color={C.t3} strokeWidth={2} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Recette, ingrédient…"
          placeholderTextColor={C.t3}
          style={{ flex: 1, fontSize: 15, color: C.t1 }}
        />
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>

        {/* ─── LOADING ─── */}
        {loading && (
          <View style={{ alignItems: 'center', paddingVertical: 48, gap: 14 }}>
            <ActivityIndicator color={C.green} size="large" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.t2 }}>Génération des recettes…</Text>
            <Text style={{ fontSize: 13, color: C.t3, textAlign: 'center' }}>
              L'IA analyse ton stock pour te proposer{'\n'}les meilleures idées
            </Text>
          </View>
        )}

        {/* ─── EMPTY ─── */}
        {!loading && recipes.length === 0 && loaded && (
          <View style={{ alignItems: 'center', paddingVertical: 56, paddingHorizontal: 24 }}>
            <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: `${C.green}12`,
              alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <UtensilsCrossed size={36} color={C.green} strokeWidth={1.5} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '900', color: C.t1, letterSpacing: -0.5, marginBottom: 8 }}>
              Pas encore de recettes
            </Text>
            <Text style={{ fontSize: 14, color: C.t3, textAlign: 'center', lineHeight: 21 }}>
              Scanne au moins 2 produits dans ton frigo pour que Frigy te génère des idées de recettes.
            </Text>
          </View>
        )}

        {/* ─── RECIPE CARDS ─── */}
        {!loading && filteredRecipes.map((r, i) => {
          const { urgent } = splitIngredients(r.ingredients, expiring);
          const isFav = favorites.has(r.name);

          return (
            <TouchableOpacity key={i} activeOpacity={0.93} onPress={() => setSelectedRecipe(r)}
              style={{ backgroundColor: C.card, borderRadius: 24, marginBottom: 16, overflow: 'hidden',
                shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.08, shadowRadius: 14 }}>

              {/* Image */}
              <View style={{ height: 220, backgroundColor: '#EAF8EE',
                alignItems: 'center', justifyContent: 'center' }}>
                {r.imgUrl
                  ? <Image source={{ uri: r.imgUrl }} style={{ width: '100%', height: 220 }} resizeMode="cover" />
                  : (
                    <View style={{ alignItems: 'center', gap: 10 }}>
                      <Leaf size={44} color={C.green} strokeWidth={1.2} />
                      <Text style={{ fontSize: 13, color: C.green, fontWeight: '600' }}>Photo à venir</Text>
                    </View>
                  )}

                {/* Overlay bas */}
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
                  backgroundColor: 'rgba(0,0,0,0.25)' }} />

                {/* Favori */}
                <TouchableOpacity onPress={() => toggleFavorite(r.name)}
                  style={{ position: 'absolute', top: 12, right: 12, width: 38, height: 38, borderRadius: 19,
                    backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
                    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4 }}>
                  <Heart size={17} color={isFav ? '#FF3B30' : C.t3} strokeWidth={2}
                    fill={isFav ? '#FF3B30' : 'none'} />
                </TouchableOpacity>

                {/* Badge urgents sur image */}
                {urgent.length > 0 && (
                  <View style={{ position: 'absolute', top: 12, left: 12,
                    paddingHorizontal: 10, paddingVertical: 5,
                    backgroundColor: 'rgba(255,59,48,0.88)', borderRadius: 100 }}>
                    <Text style={{ fontSize: 11, color: '#fff', fontWeight: '800' }}>
                      🔴 {urgent.length} à consommer
                    </Text>
                  </View>
                )}

                {/* Badge économies */}
                {r.saves && (
                  <View style={{ position: 'absolute', bottom: 12, left: 12,
                    paddingHorizontal: 10, paddingVertical: 5,
                    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 100 }}>
                    <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>−{r.saves}€ économisés</Text>
                  </View>
                )}
              </View>

              {/* Content */}
              <View style={{ padding: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: C.t1,
                  letterSpacing: -0.5, marginBottom: 5, lineHeight: 24 }}
                  numberOfLines={2}>{r.name}</Text>

                {r.desc && (
                  <Text style={{ fontSize: 13, color: C.t3, lineHeight: 19, marginBottom: 12 }}
                    numberOfLines={2}>{r.desc}</Text>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 11, paddingVertical: 6, backgroundColor: `${C.green}12`, borderRadius: 100 }}>
                    <Clock size={12} color={C.green} strokeWidth={2.5} />
                    <Text style={{ fontSize: 12, color: C.green, fontWeight: '700' }}>{r.time}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 11, paddingVertical: 6,
                    backgroundColor: C.bg, borderRadius: 100, borderWidth: 1, borderColor: C.border }}>
                    <Text style={{ fontSize: 12, color: C.t2, fontWeight: '600' }}>{r.diff}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

      </View>
    </ScrollView>
  );
}
