import { REPLICATE_API_KEY } from '../config/replicate';

const FLUX_URL = 'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions';
const PREDICTIONS_URL = 'https://api.replicate.com/v1/predictions';
// Détourage : modèle rembg (u2net) → isole le sujet (l'assiette) sur fond TRANSPARENT.
// Modèle communautaire → pas d'endpoint model-scoped : on récupère d'abord sa version.
const REMOVE_BG_MODEL = 'lucataco/remove-bg';
const POLL_INTERVAL   = 2000;
const MAX_POLLS       = 40;
const CREATE_ATTEMPTS = 3;
const RETRY_DELAY     = 1500;

function hasKey() {
  return REPLICATE_API_KEY && REPLICATE_API_KEY !== 'YOUR_REPLICATE_API_KEY';
}
function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${REPLICATE_API_KEY}`, ...extra };
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function transient(status) { return status >= 500 || status === 429; } // 503/502/500/429 → retenter

function buildFoodPrompt(name, desc = '', warm = false) {
  // Style VERROUILLÉ (réf. validée par le design) : ASSIETTE FONCÉE mate → silhouette forte
  // + aliments qui ressortent une fois détourée sur le fond crème (une assiette claire se
  // fondrait dans le fond). Angle légèrement plongeant (~35°), fond neutre clair pour un
  // détourage propre. La desc FR est ignorée (bruit pour un modèle EN).
  // Température de LUMIÈRE selon le thème (gravée dans les pixels — fiable, contrairement au
  // style `filter` de RN qui casse la transparence sur iOS) : warm = thème clair (White),
  // neutre = thème sombre (Dark).
  const lighting = warm
    ? 'warm golden natural lighting, warm inviting color temperature, cozy glow'
    : 'bright soft even studio lighting, neutral color temperature';
  return `professional editorial food photography of ${name}, served on ONE single dark matte ceramic plate, exactly one plate centered in frame, ingredients arranged neatly and appetizing, fresh vibrant colors, shot from a slightly elevated 35-degree angle with natural depth, the whole single plate visible with margin around it, ${lighting}, plain seamless off-white background, high-end restaurant presentation, realistic, only one plate, no second plate, no bowl, no cutlery, no fork, no knife, no spoon, no props, no table clutter, no hands, no text`;
}

// POST avec retry sur erreur transitoire (5xx/429) ou coupure réseau. Renvoie la Response
// (ok) ou null. Un 4xx définitif (401 clé / 402 billing / 422 input) → log + null, pas de retry.
async function postJson(url, body, tag) {
  for (let a = 0; a < CREATE_ATTEMPTS; a++) {
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
    } catch (e) {
      console.log(`[Replicate] ${tag} create network error (retry):`, e.message);
      await sleep(RETRY_DELAY); continue;
    }
    if (res.ok) return res;
    if (transient(res.status)) { console.log(`[Replicate] ${tag} create transient:`, res.status, '(retry)'); await sleep(RETRY_DELAY); continue; }
    console.log(`[Replicate] ${tag} create failed:`, res.status, await res.text());
    return null;
  }
  console.log(`[Replicate] ${tag} create: giving up after retries`);
  return null;
}

// Poll d'une prédiction → renvoie `output` ou null. Un poll transitoire (5xx/429) ou une
// coupure réseau ne tue PAS la prédiction : on saute ce tick et on retente au suivant.
async function pollPrediction(pollUrl, tag) {
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL);
    let res;
    try { res = await fetch(pollUrl, { headers: authHeaders() }); }
    catch (e) { console.log(`[Replicate] ${tag} poll network error (retry):`, e.message); continue; }
    if (!res.ok) { console.log(`[Replicate] ${tag} poll transient:`, res.status, '(retry)'); continue; }
    const data = await res.json();
    console.log(`[Replicate] ${tag} poll`, i + 1, 'status:', data.status);
    if (data.status === 'succeeded') return data.output;
    if (data.status === 'failed')    { console.log(`[Replicate] ${tag} failed:`, data.error); return null; }
  }
  console.log(`[Replicate] ${tag} poll: timed out`);
  return null;
}

function firstOutput(output) {
  return Array.isArray(output) ? output[0] ?? null : output ?? null;
}

// Récupère l'output d'une prédiction (immédiat si déjà succeeded, sinon poll).
async function resolvePrediction(createRes, tag) {
  const prediction = await createRes.json();
  console.log(`[Replicate] ${tag} created:`, prediction.id, 'status:', prediction.status);
  if (prediction.status === 'succeeded') return firstOutput(prediction.output);
  if (prediction.status === 'failed')    return null;
  if (!prediction.urls?.get)             { console.log(`[Replicate] ${tag}: no poll URL`); return null; }
  return firstOutput(await pollPrediction(prediction.urls.get, tag));
}

// Génère la photo du plat (flux-schnell, 1:1). Renvoie une URL ou null.
async function generateFluxImage(name, desc = '', warm = false) {
  const createRes = await postJson(FLUX_URL, {
    input: {
      prompt: buildFoodPrompt(name, desc, warm),
      num_outputs: 1,
      aspect_ratio: '1:1',
      output_format: 'webp',
      output_quality: 80,
      go_fast: true,
    },
  }, 'flux');
  if (!createRes) return null;
  return resolvePrediction(createRes, 'flux');
}

// GET avec retry (récupère la version courante d'un modèle communautaire).
async function getModelVersion(model) {
  for (let a = 0; a < CREATE_ATTEMPTS; a++) {
    let res;
    try { res = await fetch(`https://api.replicate.com/v1/models/${model}`, { headers: authHeaders() }); }
    catch (e) { console.log('[Replicate] bg model network error (retry):', e.message); await sleep(RETRY_DELAY); continue; }
    if (res.ok) { const j = await res.json(); return j.latest_version?.id ?? null; }
    if (transient(res.status)) { console.log('[Replicate] bg model transient:', res.status, '(retry)'); await sleep(RETRY_DELAY); continue; }
    console.log('[Replicate] bg model fetch failed:', res.status);
    return null;
  }
  return null;
}

// Détoure une image (URL) → PNG transparent. Renvoie null si indisponible (fallback gracieux).
export async function removeBackground(imageUrl) {
  if (!hasKey() || !imageUrl) return null;
  try {
    const version = await getModelVersion(REMOVE_BG_MODEL);
    if (!version) return null;
    const createRes = await postJson(PREDICTIONS_URL, { version, input: { image: imageUrl } }, 'bg');
    if (!createRes) return null;
    return resolvePrediction(createRes, 'bg');
  } catch (e) {
    console.log('[Replicate] bg exception:', e.message);
    return null;
  }
}

// Image de résultat pour Home : plat généré PUIS détouré (objet « posé », fond transparent).
// Si le détourage échoue, on renvoie quand même la photo brute (dégradation gracieuse).
// Garde interne : renvoie null sans clé configurée.
export async function generateRecipeImage(name, desc = '', { warm = false } = {}) {
  if (!hasKey()) return null;
  try {
    const flux = await generateFluxImage(name, desc, warm);
    if (!flux) return null;
    const detoured = await removeBackground(flux);
    return detoured || flux;
  } catch (e) {
    console.log('[Replicate] exception:', e.message);
    return null;
  }
}
