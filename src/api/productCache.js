import { supabase } from '../config/supabase';

export async function searchProductCache(barcode) {
  try {
    const { data } = await supabase.from('product_cache').select('*').eq('barcode', barcode).single();
    return data || null;
  } catch { return null; }
}

export async function saveProductCache(barcode, product) {
  try {
    await supabase.from('product_cache').upsert({
      barcode,
      name: product.name,
      brand: product.brand || null,
      category: product.category || null,
      img_url: product.imgUrl || null,
      nutri_grade: product.nutri || null,
      kcal: product.kcal || null,
      source: product.source || 'Unknown',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'barcode' });
  } catch { /* non-blocking */ }
}
