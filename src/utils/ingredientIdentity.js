/**
 * N6-05 — Résolution d'IDENTITÉ : ingrédient recette ↔ inventaire représenté (CR-05).
 *
 * Contrat épistémique (N5.4, verrouillé) :
 *   - MATCH = Frigy a une évidence d'identité SUFFISANTE pour traiter ≥1 cohorte représentée
 *     comme la même identité alimentaire, POUR CET USAGE recette limité. Rien de plus :
 *     MATCH ≠ quantité suffisante, ≠ temporellement adapté, ≠ bonne forme, ≠ substituable,
 *     ≠ recette faisable, ≠ « dans ton frigo » (localisation), ≠ possession physique.
 *   - UNRESOLVED = Frigy ne peut PAS établir une relation d'identité assez fiable. Ce n'est
 *     PAS : absent / indisponible / manquant / non possédé / à acheter / recette impossible.
 *   - **NO-MATCH TECHNIQUE ≠ ÉVIDENCE ÉPISTÉMIQUE NÉGATIVE.** Échec/faiblesse → UNRESOLVED,
 *     JAMAIS « missing ». Un no-match ne prouve pas l'absence du foyer (représentation ≠ réalité).
 *
 * Politique de MATCH — PRÉCISION AVANT RAPPEL :
 *   MATCH uniquement sur **équivalence lexicale NORMALISÉE STRICTE** (surface-form) avec ≥1
 *   cohorte. Normalisation MÉCANIQUE seulement (casse, accents, ponctuation, espaces) — jamais
 *   sémantique (pas de singularisation, stemming, retrait de qualificatifs, synonymes, catégorie,
 *   localisation). Substring, chevauchement de token, catégorie, localisation → **UNRESOLVED**.
 *   Pas de score de confiance numérique, pas d'ontologie, pas d'IA.
 *
 * Déterminisme : le statut ne dépend JAMAIS de l'ordre du tableau d'inventaire (filtre pur).
 * Plusieurs cohortes de MÊME identité normalisée → MATCH (cohortes dupliquées, N5.3), pas une
 * ambiguïté ; les quantités ne sont JAMAIS sommées ici (N6-07 séparé). Data malformée → UNRESOLVED.
 */

export const IDENTITY = { MATCH: 'MATCH', UNRESOLVED: 'UNRESOLVED' };

// Normalisation MÉCANIQUE (surface-form) uniquement. NFD + retrait des diacritiques, minuscules,
// ponctuation/séparateurs → espace, espaces compressés, trim. Ne modifie PAS le sens (pas de
// pluriel→singulier, pas de retrait d'adjectif). Renvoie '' pour toute entrée non-chaîne/vide.
export function normalizeIdentity(s) {
  if (typeof s !== 'string') return '';
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Résout l'identité d'un ingrédient recette contre l'inventaire représenté.
 * @param {string} ingredient  nom d'ingrédient recette (texte libre).
 * @param {Array<{name?:string}>} items  cohortes représentées actives.
 * @returns {{status:'MATCH'|'UNRESOLVED', matches: Array}} matches = toutes les cohortes à
 *          identité normalisée STRICTEMENT égale (jamais missing ; jamais négatif).
 */
export function resolveIngredientIdentity(ingredient, items = []) {
  const ing = normalizeIdentity(ingredient);
  if (!ing) return { status: IDENTITY.UNRESOLVED, matches: [] };
  const list = Array.isArray(items) ? items : [];
  const matches = list.filter((it) => it && normalizeIdentity(it.name) === ing);
  return matches.length > 0
    ? { status: IDENTITY.MATCH, matches }
    : { status: IDENTITY.UNRESOLVED, matches: [] };
}
