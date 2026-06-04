import { REPLICATE_API_KEY } from '../config/replicate';

const REPLICATE_URL = 'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions';
const POLL_INTERVAL = 2000;
const MAX_POLLS     = 30;

function buildFoodPrompt(name, desc = '') {
  const base = desc ? `${name}, ${desc}` : name;
  return `professional food photography of ${base}, overhead shot, soft natural lighting, appetizing plating, white ceramic plate, minimalist clean background, 4k, restaurant quality`;
}

export async function generateRecipeImage(name, desc = '') {
  if (!REPLICATE_API_KEY || REPLICATE_API_KEY === 'YOUR_REPLICATE_API_KEY') return null;

  try {
    // 1. Create prediction
    const createRes = await fetch(REPLICATE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt: buildFoodPrompt(name, desc),
          num_outputs: 1,
          aspect_ratio: '1:1',
          output_format: 'webp',
          output_quality: 80,
          go_fast: true,
        },
      }),
    });

    if (!createRes.ok) {
      console.log('[Replicate] create failed:', createRes.status, await createRes.text());
      return null;
    }
    const prediction = await createRes.json();
    console.log('[Replicate] prediction created:', prediction.id, 'status:', prediction.status);

    if (prediction.status === 'succeeded') return prediction.output?.[0] ?? null;
    if (prediction.status === 'failed')    return null;

    const pollUrl = prediction.urls?.get;
    if (!pollUrl) { console.log('[Replicate] no poll URL'); return null; }

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));

      const pollRes = await fetch(pollUrl, {
        headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
      });
      if (!pollRes.ok) { console.log('[Replicate] poll failed:', pollRes.status); return null; }

      const data = await pollRes.json();
      console.log('[Replicate] poll', i + 1, 'status:', data.status);
      if (data.status === 'succeeded') return data.output?.[0] ?? null;
      if (data.status === 'failed')    { console.log('[Replicate] failed:', data.error); return null; }
    }

    return null;
  } catch (e) {
    console.log('[Replicate] exception:', e.message);
    return null;
  }
}
