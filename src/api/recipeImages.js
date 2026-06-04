import { supabase } from '../config/supabase';

function toKey(name, desc = '') {
  return `${name}|${desc}`.toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function getCachedImage(name, desc = '') {
  const { data } = await supabase
    .from('recipe_images')
    .select('image_url')
    .eq('recipe_key', toKey(name, desc))
    .single();
  return data?.image_url ?? null;
}

export async function saveCachedImage(name, desc = '', imageUrl) {
  await supabase
    .from('recipe_images')
    .upsert(
      { recipe_key: toKey(name, desc), image_url: imageUrl },
      { onConflict: 'recipe_key', ignoreDuplicates: true }
    );
}
