export async function searchImageByName(name) {
  try {
    const headers = { 'User-Agent': 'Frigy/1.1 (lucas@greenowl.fr)' };
    const url = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(name)}&fields=image_front_display_url,image_front_url,image_url&page_size=3`;
    const r = await fetch(url, { headers });
    const text = await r.text();
    if (!text.startsWith('{')) return null; // HTML = rate-limited, skip
    const d = JSON.parse(text);
    const products = d.products || [];
    for (const p of products) {
      const img = p.image_front_display_url || p.image_front_url || p.image_url;
      if (img) return img;
    }
    return null;
  } catch { return null; }
}

export async function searchOpenFoodFacts(barcode) {
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const d = await r.json();
    if (d.status !== 1 || !d.product) return null;
    const p = d.product;
    return {
      name: p.product_name_fr || p.product_name || '',
      brand: p.brands || '',
      nutri: ['A', 'B', 'C', 'D', 'E'].includes((p.nutriscore_grade || '').toUpperCase())
        ? (p.nutriscore_grade || '').toUpperCase() : null,
      kcal: p.nutriments?.['energy-kcal_100g'] ? Math.round(p.nutriments['energy-kcal_100g']) : null,
      category: p.categories_tags?.[0]?.replace('en:', '').replace(/-/g, ' ') || '',
      imgUrl: p.image_front_display_url || p.image_front_url || p.image_front_small_url || p.image_url || null,
    };
  } catch { return null; }
}
