import { SPOONACULAR_KEY } from '../config/urls';

export async function searchSpoonacular(barcode) {
  try {
    const r = await fetch(`https://api.spoonacular.com/food/products/upc/${barcode}?apiKey=${SPOONACULAR_KEY}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.id) return null;
    const imgUrl = d.images?.[0] ||
      (d.imageType ? `https://img.spoonacular.com/products/${d.id}-312x231.${d.imageType}` : null);
    return { imgUrl, name: d.title || null };
  } catch { return null; }
}

export async function searchSpoonacularRecipeImage(name) {
  try {
    const r = await fetch(
      `https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(name)}&number=1&apiKey=${SPOONACULAR_KEY}`
    );
    if (!r.ok) {
      console.warn('Spoonacular error', r.status, await r.text().catch(() => ''));
      return { imgUrl: null, spoonId: null };
    }
    const d = await r.json();
    console.log('Spoonacular result for', name, '->', JSON.stringify(d.results?.[0]));
    const result = d.results?.[0];
    if (!result?.id) return { imgUrl: null, spoonId: null };
    // Use img.spoonacular.com with ID — most reliable URL format
    const imgUrl = `https://img.spoonacular.com/recipes/${result.id}-312x231.jpg`;
    return { imgUrl, spoonId: result.id };
  } catch (e) {
    console.warn('Spoonacular fetch failed', e);
    return { imgUrl: null, spoonId: null };
  }
}

export async function fetchRecipeSteps(spoonId) {
  try {
    const r = await fetch(
      `https://api.spoonacular.com/recipes/${spoonId}/analyzedInstructions?apiKey=${SPOONACULAR_KEY}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d[0]?.steps ?? null;
  } catch { return null; }
}
