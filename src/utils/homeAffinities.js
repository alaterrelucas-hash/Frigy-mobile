/**
 * Home LOW A — « Confirmation Intelligente » : base de connaissance PRODUIT déterministe.
 * PAS une IA, PAS un moteur prédictif : un corpus CURÉ, petit, explicable, offline, testable.
 *
 * Rôle unique : « à partir de ce que Frigy connaît déjà, quels produits COURANTS est-il
 * pertinent de demander rapidement à l'utilisateur s'il possède aussi ? ». Ce n'est ni une
 * liste de courses, ni une reco d'achat — uniquement des staples fréquemment co-possédés.
 *
 * IDENTITÉS = slugs canoniques Food Language (mêmes clés que PRIMITIVES). Clés ET candidats
 * sont des slugs FL → tout candidat a par construction un asset Food Language (règle
 * « exclure produits sans FL » satisfaite d'office), et la normalisation nom→slug (canon +
 * synonymes) est déléguée à resolveFoodImage (aucun nouveau système d'ID/alias).
 *
 * Listes ORDONNÉES = poids implicite par rang (pas de nombres à maintenir). Le score d'un
 * candidat = somme sur les produits connus de (longueur_liste − index) → un candidat bien
 * classé ET partagé par plusieurs produits connus remonte. V1 pilote : ~26 produits connus.
 */
import { resolveFoodImage, getPrimitive } from './foodLanguage';

// clé connue (slug FL) → candidats (slugs FL), du plus au moins pertinent. Tous les candidats
// sont des primitives FL réelles (vérifié). Condiments/ultra-spécifiques volontairement exclus.
export const AFFINITIES = {
  'riz': ['oeufs', 'oignon', 'tomates-cerises', 'poulet-cru', 'petits-pois'],
  'pates': ['tomate', 'ail', 'oignon', 'parmesan', 'champignons'],
  'oeufs': ['lait-entier', 'farine', 'beurre', 'jambon', 'fromage-rape-emmental'],
  'tomate': ['mozzarella', 'basilic-frais', 'oignon', 'concombre', 'salade-verte'],
  'tomates-cerises': ['mozzarella', 'basilic-frais', 'avocat', 'roquette', 'oignon'],
  'poulet-cru': ['riz', 'oignon', 'ail', 'courgette', 'citron'],
  'poulet-roti': ['pommes-de-terre', 'salade-verte', 'riz', 'carottes', 'oignon'],
  'saumon': ['citron', 'riz', 'epinards', 'pommes-de-terre', 'creme-fraiche'],
  'lait-entier': ['oeufs', 'farine', 'sucre', 'beurre', 'cereales'],
  'oignon': ['tomate', 'ail', 'carottes', 'pommes-de-terre', 'poivron-rouge'],
  'ail': ['tomate', 'oignon', 'persil-frise', 'huile-d-olive', 'champignons'],
  'pommes-de-terre': ['oignon', 'beurre', 'creme-fraiche', 'lardons', 'carottes'],
  'carottes': ['oignon', 'pommes-de-terre', 'petits-pois', 'poireau', 'courgette'],
  'courgette': ['tomate', 'oignon', 'ail', 'aubergine', 'poivron-rouge'],
  'salade-verte': ['tomate', 'concombre', 'avocat', 'oeufs', 'oignon'],
  'mozzarella': ['tomate', 'tomates-cerises', 'basilic-frais', 'jambon-cru', 'roquette'],
  'basilic-frais': ['tomate', 'mozzarella', 'ail', 'parmesan', 'pates'],
  'jambon': ['oeufs', 'fromage-rape-emmental', 'pain-de-mie', 'beurre', 'salade-verte'],
  'beurre': ['farine', 'oeufs', 'sucre', 'pain-de-mie', 'confiture-de-fraise'],
  'farine': ['oeufs', 'lait-entier', 'sucre', 'beurre', 'chocolat-noir'],
  'yaourt-nature': ['muesli', 'miel', 'myrtilles', 'pomme', 'graines-de-chia'],
  'pomme': ['yaourt-nature', 'cannelle', 'farine', 'beurre', 'poire'],
  'champignons': ['creme-fraiche', 'ail', 'oignon', 'persil-frise', 'lardons'],
  'lardons': ['oignon', 'creme-fraiche', 'oeufs', 'pates', 'champignons'],
  'fromage-rape-emmental': ['oeufs', 'jambon', 'pates', 'pommes-de-terre', 'lardons'],
  'steak-hache': ['oignon', 'pommes-de-terre', 'salade-verte', 'tomate', 'oeufs'],
};

// Libellé d'affichage d'un candidat : displayShort curé (FL) si dispo, sinon slug → mots.
// Première lettre en capitale (gère œ → Œ). Déterministe, aucune devinette.
export function candidateLabel(key) {
  const p = getPrimitive(key);
  const base = (p && p.displayShort) || (key || '').replace(/-/g, ' ');
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
}

/**
 * Sélectionne jusqu'à 3 candidats à confirmer à partir du stock connu.
 * @param {Array} items — stock réel (objets item ou noms).
 * @param {{excludeKeys?: string[]}} opts — slugs à exclure (confirmés / rejetés en session).
 * @returns {Array<{key,name,image}>} — 0 à 3 candidats. [] → module masqué (jamais d'aléatoire).
 */
export function selectAffinityCandidates(items = [], { excludeKeys = [] } = {}) {
  const known = new Set();
  for (const it of items) {
    const r = resolveFoodImage(it);
    if (r && r.key) known.add(r.key);
  }
  if (!known.size) return [];

  const exclude = new Set([...known, ...excludeKeys]);
  const scores = new Map();
  const order = []; // premier-vu → tie-break déterministe
  for (const k of known) {
    const list = AFFINITIES[k];
    if (!list) continue;
    const L = list.length;
    list.forEach((c, i) => {
      if (exclude.has(c)) return;
      if (!getPrimitive(c)) return; // garde-fou : candidat sans asset FL exclu
      if (!scores.has(c)) { scores.set(c, 0); order.push(c); }
      scores.set(c, scores.get(c) + (L - i));
    });
  }
  const ranked = order.slice().sort((a, b) => (scores.get(b) - scores.get(a)) || (order.indexOf(a) - order.indexOf(b)));
  return ranked.slice(0, 3).map((key) => {
    const p = getPrimitive(key);
    return { key, name: candidateLabel(key), image: p.image, ratio: p.ratio };
  });
}
