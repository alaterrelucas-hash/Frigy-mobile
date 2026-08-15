/**
 * useHomeSuggestion — orchestre les données de Home (aucun JSX).
 *
 * Local-first : priorité / watch sont immédiats (données locales). L'« idée du soir »
 * vient du cache recettes existant ; si le cache est vide, un refresh background
 * (non bloquant) est déclenché. Aucun spinner global, la Home s'affiche tout de suite.
 * Garde anti-stale : une réponse calculée sur un ancien `items` est ignorée.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadHomeRecipeCache, refreshHomeRecipes, selectBestHomeRecipe, deriveGatheringItems, resolveRecipeImage } from '../utils/homeRecipes';
import { selectHomePriority, selectWatchItems, deriveHomeState, deriveVoice, deriveRichnessLevel, HOME_STATE, HOME_LEVEL } from '../utils/homeLogic';
import { resolveFoodImage } from '../utils/foodLanguage';
import { computeRescueValue } from '../utils/rescueValue';

function itemsSignature(items = []) {
  return items.map((i) => `${i.id}:${i.days}`).join('|');
}

/**
 * @param {Array} items — stock courant (déjà mappé, avec `days`).
 * @param {object} [opts] — { recipesOverride } : recettes fournies directement (QA/DEV) → pas de cache/réseau.
 */
export default function useHomeSuggestion(items = [], opts = {}) {
  const { recipesOverride, isDark } = opts;
  const [recipes, setRecipes] = useState(recipesOverride || null); // null = pas encore chargé
  const sig = itemsSignature(items);
  const sigRef = useRef(sig);
  sigRef.current = sig;

  useEffect(() => {
    if (recipesOverride) { setRecipes(recipesOverride); return; }
    let cancelled = false;
    const mySig = sig;
    setRecipes(null);
    (async () => {
      const cache = await loadHomeRecipeCache();
      if (cancelled || sigRef.current !== mySig) return;
      if (cache.length) { setRecipes(cache); return; }
      // Cache vide → refresh background non bloquant ; Home reste en état B en attendant.
      setRecipes([]);
      const fresh = await refreshHomeRecipes(items);
      if (cancelled || sigRef.current !== mySig) return;
      setRecipes(fresh);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, recipesOverride]);

  const derived = useMemo(() => {
    const priorityRaw = selectHomePriority(items);
    // Enrichit la priorité avec la copie contextuelle Food Language (displayShort/determiner)
    // → transformationOverline(priority) reste une fonction pure lisant priority.*.
    const pMeta = priorityRaw ? resolveFoodImage(priorityRaw) : null;
    // rescueValue = valeur POTENTIELLE à sauver (jamais « sauvée ») — calculée sur l'item
    // brut, portée par le bloc priorité (Hero). null si aucune estimation fiable.
    const priority = priorityRaw
      ? { ...priorityRaw, determiner: pMeta?.determiner, displayShort: pMeta?.displayShort, rescueValue: computeRescueValue(priorityRaw) }
      : null;
    const best = recipes && recipes.length ? selectBestHomeRecipe(recipes, items, priority) : null;
    const gatheringItems = deriveGatheringItems(best, priority);
    const watchItems = selectWatchItems(items, priority, gatheringItems);
    const state = deriveHomeState(items, priority, best);
    const voice = deriveVoice(state, priority, items);
    // Modèle adaptatif : LEVEL (cadre) + SIGNALS (contenu réel, jamais inventé).
    const level = deriveRichnessLevel(items);
    const signals = {
      priorityAvailable: !!priority,
      watchAvailable: watchItems.length > 0,
      recipeAvailable: !!best,
      gatheringAvailable: gatheringItems.length >= 2,
      rescueAvailable: !!(priority && priority.rescueValue != null),
    };
    return {
      state,
      level,
      signals,
      priority,
      watchItems,
      selectedRecipe: best?.recipe || null,
      gatheringItems,
      // N6-05 : un ingrédient non résolu (UNRESOLVED) n'est PAS « manquant » (no-match technique
      // ≠ absence). On NE dérive plus de liste « il te manque X » depuis un no-match d'identité :
      // suppression sûre (missingItems vide). La verbalisation des états MATCH/UNRESOLVED côté
      // Home relève de N6-06 (Recipe Wording Truth). `best.unresolved` reste interne (non exposé).
      missingItems: [],
      voice,
      recipeLoading: recipes === null, // le hero s'affiche quand même ; concerne l'idée du soir
      HOME_STATE,
      HOME_LEVEL,
    };
  }, [items, recipes]);

  // Image de résultat (assiette) — pipeline recette branché, non bloquant, stale-guardé.
  // La Home s'affiche immédiatement ; l'image remplit le bloc recette quand elle arrive.
  const [resultImg, setResultImg] = useState(null);
  const recName = derived.selectedRecipe?.name || null;
  useEffect(() => {
    let cancelled = false;
    setResultImg(null);
    const rec = derived.selectedRecipe;
    if (!rec || rec.imgUrl) return;
    // warm = thème clair (White) → variante réchauffée (gravée à la génération, cache dédié).
    resolveRecipeImage(rec, { warm: !isDark }).then((url) => { if (!cancelled && url) setResultImg(url); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recName, isDark]);

  return useMemo(() => ({
    ...derived,
    selectedRecipe: derived.selectedRecipe
      ? { ...derived.selectedRecipe, imgUrl: derived.selectedRecipe.imgUrl || resultImg || null }
      : null,
  }), [derived, resultImg]);
}
