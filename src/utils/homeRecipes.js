/**
 * Home — logique « idée du soir » (V1 macro).
 *
 * TECH DEBT — FACTOR RECIPES LOGIC AFTER HOME V1 VALIDATION :
 * ce module DUPLIQUE volontairement une logique minimale de RecipesScreen
 * (calculateROI + accès au cache recettes) pour respecter la contrainte « zero-touch
 * sur RecipesScreen » de cette passe. Après validation device de Home, extraire une
 * seule source partagée et faire pointer RecipesScreen + Home dessus.
 *
 * Réutilise le MÊME cache AsyncStorage que RecipesScreen (pas de second cache).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RECIPES_FN_URL } from '../config/urls';
import { SUPABASE_KEY } from '../config/supabase';
import { CATEGORY_PRICE } from '../config/constants';
import { getCachedImage, saveCachedImage } from '../api/recipeImages';
import { generateRecipeImage } from '../api/replicate';
import { resolveIngredientIdentity, IDENTITY } from './ingredientIdentity';

const RECIPES_CACHE_KEY = 'fridgy_recipes_cache_v2';        // identique à RecipesScreen
const RECIPES_LAST_REFRESH_KEY = 'fridgy_recipes_last_refresh_v2';
// Version de l'IMAGE de résultat : bump → nouvelle clé de cache → régénère l'image sans
// purger le cache recette (ni celui de RecipesScreen). v8 : température de lumière par
// thème (warm sur White, neutre sur Dark) gravée à la génération → variantes distinctes.
const IMG_CACHE_VERSION = 'v8';

// N6-05 : identité gatée via le résolveur CANONIQUE (partagé avec RecipesScreen — plus de
// matcher local faible substring/token). MATCH = équivalence normalisée STRICTE ; sinon
// UNRESOLVED. Un no-match technique n'est PAS « missing » (représentation ≠ réalité).
// `matched` = UNE entrée par ingrédient à identité confirmée (cohortes dupliquées comptées une
// seule fois, quantités jamais sommées). `unresolved` reste NEUTRE (jamais missing/à-acheter).
export function calculateROI(ingredients = [], allItems = []) {
  const matched = [];
  const unresolved = [];
  ingredients.forEach((ing) => {
    const res = resolveIngredientIdentity(ing, allItems);
    if (res.status === IDENTITY.MATCH) matched.push({ ingredient: ing, item: res.matches[0] });
    else unresolved.push(ing);
  });
  return { matched, unresolved };
}

function pickForRecipes(items = []) {
  const expiring = items.filter((i) => typeof i.days === 'number' && i.days <= 7).sort((a, b) => a.days - b.days);
  const base = expiring.length >= 2 ? [...expiring, ...items.filter((i) => !(typeof i.days === 'number' && i.days <= 7))] : items;
  return base.slice(0, 15);
}

// Lecture non bloquante du cache recettes (local-first). Renvoie [] si vide/illisible.
export async function loadHomeRecipeCache() {
  try {
    const raw = await AsyncStorage.getItem(RECIPES_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Rafraîchit en arrière-plan si le cache est vide (réutilise l'edge fn + le cache existant).
// Non bloquant pour Home : à appeler seulement quand le cache est vide.
export async function refreshHomeRecipes(items = []) {
  const forRecipes = pickForRecipes(items);
  if (!forRecipes.length) return [];
  try {
    const res = await fetch(RECIPES_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({
        products: forRecipes.map((p) => ({
          name: p.name, emoji: p.emoji, days_left: p.days_left ?? p.days, category: p.category, location: p.location,
        })),
      }),
    });
    const data = await res.json();
    const recipes = data.recipes || [];
    await AsyncStorage.setItem(RECIPES_CACHE_KEY, JSON.stringify(recipes));
    await AsyncStorage.setItem(RECIPES_LAST_REFRESH_KEY, Date.now().toString());
    return recipes;
  } catch {
    return [];
  }
}

function parseMinutes(time) {
  const m = /(\d+)/.exec(time || '');
  return m ? parseInt(m[1], 10) : 20;
}

/**
 * Sélectionne la meilleure « idée du soir » (déterministe, indépendant de l'ordre).
 * Qualification : la recette utilise le produit prioritaire (identité stricte). PAS de
 * disqualification par ingrédients non résolus (N6-05 : no-match ≠ absence).
 * Score = confirmedMatches*100 − complexityPenalty(>30min:15, Moyen:10) — évidence d'identité
 * POSITIVE seulement ; UNRESOLVED neutre. Tie-break : plus de matches → temps le plus court.
 */
export function selectBestHomeRecipe(recipes, items, priority) {
  if (!priority || !Array.isArray(recipes) || !recipes.length) return null;
  let best = null;

  for (const r of recipes) {
    const ings = r.ingredients || [];
    if (!ings.length) continue;

    // Qualification identité : la recette utilise-t-elle le produit prioritaire ? (identité STRICTE)
    const usesPriority = ings.some((ing) => resolveIngredientIdentity(ing, [priority]).status === IDENTITY.MATCH);
    if (!usesPriority) continue;

    const { matched, unresolved } = calculateROI(ings, items);

    // N6-05 : AUCUNE disqualification par unresolved (no-match technique ≠ absence prouvée), et
    // AUCUN dénominateur matched/total ni pénalité « missing » (transformeraient l'incertitude
    // d'identité en preuve négative). Évidence d'identité POSITIVE seulement : nombre d'ingrédients
    // à identité confirmée (UNRESOLVED = neutre, n'ajoute ni ne retire). La complexité
    // (temps/difficulté) reste un facteur non-identité, inchangé.
    const confirmedMatches = matched.length;
    const complexityPenalty = (parseMinutes(r.time) > 30 ? 15 : 0) + (r.diff === 'Moyen' ? 10 : 0);
    const minutes = parseMinutes(r.time);
    const score = confirmedMatches * 100 - complexityPenalty;

    const cand = { recipe: r, score, confirmedMatches, minutes, matched, unresolved };
    if (!best) { best = cand; continue; }
    if (
      cand.score > best.score ||
      (cand.score === best.score && cand.confirmedMatches > best.confirmedMatches) ||
      (cand.score === best.score && cand.confirmedMatches === best.confirmedMatches && cand.minutes < best.minutes)
    ) best = cand;
  }
  return best; // { recipe, matched, unresolved, ... } ou null
}

// Gathering = ingrédients de la recette retenue présents en stock, hors priorité, 2–3 max.
export function deriveGatheringItems(best, priority) {
  if (!best) return [];
  const priId = priority?.id;
  const seen = new Set();
  const out = [];
  for (const m of best.matched) {
    const it = m.item;
    if (!it || it.id === priId) continue;
    const key = (it.name || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length >= 3) break;
  }
  return out;
}

// Prix indicatif (pour un éventuel usage futur des manques). Non affiché en V1.
export function estimateItemValue(item) {
  return item?.price || CATEGORY_PRICE[item?.category] || 2.5;
}

// ── Image de RÉSULTAT (assiette générée + détourée via Replicate) ──────────────────
// Réutilise le MÊME cache image (recipeImages) que RecipesScreen — pas de second cache.
//
// Résout l'image de plat pour la recette retenue : imgUrl direct → cache image partagé →
// génération Replicate (plat 45° détouré). On ne met en cache QUE le succès Replicate :
// un échec transitoire (ex. 503) ne fige rien → le prochain reload retente une vraie
// génération, plutôt que de figer une fausse photo. Non bloquant ; renvoie null si rien de
// fiable (l'UI garde alors son état propre). Ne télécharge/génère aucun asset local.
export async function resolveRecipeImage(recipe, { warm = false } = {}) {
  if (!recipe) return null;
  if (recipe.imgUrl) return recipe.imgUrl;
  // Clé de cache = imageQuery (requête EN spécifique) quand elle existe, sinon le nom, +
  // le mode de température (warm/neutral) → chaque thème a sa propre variante en cache.
  const key = `${recipe.imageQuery || recipe.name} ${IMG_CACHE_VERSION} ${warm ? 'warm' : 'neutral'}`;
  try {
    const cached = await getCachedImage(key, recipe.desc);
    if (cached) return cached;
    // Génération appétissante + détourage (Replicate). Garde interne → null sans clé.
    const generated = await generateRecipeImage(recipe.name, recipe.desc, { warm });
    if (generated) { saveCachedImage(key, recipe.desc, generated); return generated; }
    // Échec (pas de clé / erreur non récupérable) : PAS de fallback photo trompeuse et
    // PAS de mise en cache → l'UI garde son état propre et le prochain reload retentera.
  } catch { /* image non critique */ }
  return null;
}
