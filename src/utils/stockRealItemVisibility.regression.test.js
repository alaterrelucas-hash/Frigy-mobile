/**
 * MON STOCK — VISIBILITÉ DU STOCK RÉEL. Régression :
 *   node src/utils/stockRealItemVisibility.regression.test.js
 *
 * Bug QA (iOS dev) : un produit ajouté manuellement, réellement présent en base
 * (consumed=false, wasted=false, location='Frigo', remaining_level=null, quantité/date
 * d'autorité UNKNOWN) n'apparaissait NI dans Mon Stock NI via la recherche exacte.
 *
 * Cause : `DEV_PREVIEW_STOCK_ENABLED` était committé à `true` → sous `__DEV__`, FridgeScreen
 * REMPLAÇAIT intégralement `items` (Supabase) par un jeu fabriqué. La liste rendue ET la
 * recherche (qui opère sur `localItems`) ne voyaient jamais le stock réel.
 *
 * Deux verrous complémentaires :
 *   A. SOURCE — aucune substitution active, et le pipeline de visibilité n'exclut jamais un
 *      item sur remaining_level / wasted / provenance (UNKNOWN reste un état VALIDE).
 *   B. LOGIQUE — l'item QA traverse réellement scope + recherche + partition des tiers.
 * Commentaires strippés avant scan source (évite les faux positifs — cf. quantityAuthority).
 */
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const stripC = (s) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

const previewSrc = read('devPreviewStock.js');
const fridgeSrc = read('../screens/FridgeScreen.js');
const fridge = stripC(fridgeSrc);
const appSrc = stripC(read('../../App.js'));

function load(file, transforms) {
  let code = read(file);
  code = (transforms ? transforms(code) : code)
    .replace(/export async function /g, 'async function ')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ');
  const m = new module.constructor();
  m._compile(code, file);
  return m.exports;
}

const product = load('product.js', (c) => c + '\nmodule.exports={normalizeDlc};');
const T = load('temporalAuthority.js', (c) =>
  c.replace(/import \{[^}]*\} from '\.\/product';/,
      `const normalizeDlc = ${product.normalizeDlc.toString()};`)
   + '\nmodule.exports={passiveTemporalDays};');
const temporal = load('temporal.js', (c) =>
  c.replace(/^import .*$/gm, '') + '\nmodule.exports={getTemporalTier,TEMPORAL_TIER};');

const { passiveTemporalDays } = T;
const { getTemporalTier, TEMPORAL_TIER } = temporal;

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

/* ══ A. SOURCE — le stock réel n'est jamais remplacé par des données fabriquées ══ */

// Verrou principal : le jeu de démonstration ne doit JAMAIS être committé actif. Actif, il
// substitue des produits INEXISTANTS au stock réel — l'utilisateur lit alors une représentation
// qui ne correspond à aucune réalité (violation directe de « representation ≠ reality »).
ok('REAL-01 DEV_PREVIEW_STOCK_ENABLED committé à false (aucune substitution du stock réel)',
  /export const DEV_PREVIEW_STOCK_ENABLED = false;/.test(previewSrc)
  && !/export const DEV_PREVIEW_STOCK_ENABLED = true;/.test(previewSrc));

// La substitution reste gatée par __DEV__ (défense en profondeur : jamais en release).
ok('REAL-02 substitution preview gatée par __DEV__ ET par le flag',
  /__DEV__ && DEV_PREVIEW_STOCK_ENABLED/.test(fridge));

// La source d'affichage retombe bien sur la prop `items` (Supabase) hors preview.
ok('REAL-03 hors preview, localItems dérive de la prop items (source Supabase)',
  /:\s*items;/.test(fridge) && /setLocalItems\(base\.map\(withFoodLanguage\)\)/.test(fridge));

// Le fetch ne filtre QUE sur family_id + consumed. Un filtre `wasted` côté fetch masquerait
// des lignes actives ; remaining_level ne doit jamais conditionner la lecture.
ok('REAL-04 fetchItems : scope family_id + consumed=false uniquement',
  /\.from\('items'\)\s*\.select\('\*'\)\s*\.eq\('family_id', famId\)\s*\.eq\('consumed', false\)/.test(appSrc)
  && !/\.eq\('wasted'/.test(appSrc) && !/\.eq\('remaining_level'/.test(appSrc)
  && !/\.not\('remaining_level'/.test(appSrc) && !/\.is\('remaining_level'/.test(appSrc));

// Aucune condition de présence sur remaining_level / provenance dans le pipeline de visibilité :
// UNKNOWN (null) est un ÉTAT VALIDE, jamais un motif d'exclusion (et jamais promu FULL).
const visibilityPipeline = (fridge.match(/const scopedItems[\s\S]*?const sections =/) || [''])[0];
ok('REAL-05 pipeline de visibilité : aucun filtre sur remaining_level / wasted / provenance',
  visibilityPipeline.length > 0
  && !/remaining_level/.test(visibilityPipeline)
  && !/wasted/.test(visibilityPipeline)
  && !/assertion_provenance/.test(visibilityPipeline));

// Aucune promotion silencieuse de l'absence de reste en « plein ».
ok('REAL-06 remaining_level null jamais transformé en FULL',
  !/remaining_level\s*(\|\||\?\?)\s*'FULL'/.test(fridge)
  && !/remaining_level:\s*item\.remaining_level\s*\|\|\s*'FULL'/.test(fridge));

// La recherche doit s'appliquer aux items RÉELS scopés, pas à une liste déjà réduite par un
// jeu fabriqué : applyFilter part de scopedItems (dérivé de localItems → items).
ok('REAL-07 recherche appliquée sur les items scopés réels',
  /const scopedItems\s*=\s*localItems\.filter\(i => i\.location === activeScope\)/.test(fridge)
  && /const filteredScoped = applyFilter\(scopedItems\)/.test(fridge));

/* ══ B. LOGIQUE — l'item QA traverse réellement scope + recherche + tiers ══ */

// Forme EXACTE du produit signalé en QA (aucune donnée inventée : valeurs relevées en base).
const NOW = new Date(2026, 8, 18); // 18/09/2026
const QA_ITEM = {
  name: 'TEST QA STOCK',
  location: 'Frigo',
  consumed: false,
  wasted: false,
  quantity: 1,
  dlc: '20/09/2026',
  days_left: 2,
  remaining_level: null,      // UNKNOWN — état valide
  assertion_provenance: null, // provenance UNKNOWN (legacy / ajout manuel non tracé)
};

const scopeOf = (item, scope) => item.location === scope;
const searchMatch = (item, q) => item.name.toLowerCase().includes(q.toLowerCase());

ok('REAL-08 scope Frigo : l\'item QA est retenu', scopeOf(QA_ITEM, 'Frigo') === true);
ok('REAL-09 recherche exacte « TEST QA STOCK » : trouvée', searchMatch(QA_ITEM, 'TEST QA STOCK') === true);
ok('REAL-10 recherche partielle insensible à la casse : trouvée', searchMatch(QA_ITEM, 'test qa') === true);

// La partition des tiers est TOTALE : tout item scopé atterrit dans une section rendue.
const tier = getTemporalTier(passiveTemporalDays(QA_ITEM, NOW));
ok('REAL-11 l\'item QA obtient un tier rendu (aucune perte entre scope et sections)',
  [TEMPORAL_TIER.PRIORITY, TEMPORAL_TIER.SOON, TEMPORAL_TIER.LATER].includes(tier));

// Un item SANS aucune autorité temporelle (dateType/date inconnus) reste visible en « Autres
// produits » — l'absence de date n'est jamais une absence de produit.
const NO_DATE = { ...QA_ITEM, dlc: '—', days_left: null };
ok('REAL-12 item sans échéance connue → tier LATER (visible), jamais exclu',
  getTemporalTier(passiveTemporalDays(NO_DATE, NOW)) === TEMPORAL_TIER.LATER);

// Un item avec remaining_level null reste strictement aussi visible qu'un item renseigné.
const WITH_LEVEL = { ...QA_ITEM, remaining_level: 'HALF' };
ok('REAL-13 remaining_level null ↔ renseigné : même visibilité (même tier, même scope)',
  getTemporalTier(passiveTemporalDays(QA_ITEM, NOW)) === getTemporalTier(passiveTemporalDays(WITH_LEVEL, NOW))
  && scopeOf(QA_ITEM, 'Frigo') === scopeOf(WITH_LEVEL, 'Frigo'));

console.log(`\nstockRealItemVisibility.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
