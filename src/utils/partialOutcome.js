/**
 * PARTIAL OUTCOME + REMAINING STATE — contrat CANONIQUE PUR (V1). Aucune I/O, aucun SDK.
 *
 * Sémantique persistée = DISCRÈTE et explicite (jamais un %/poids/nb d'unités/mesure physique) :
 *   remainingLevel ∈ { EMPTY, QUARTER, HALF, THREE_QUARTERS, FULL } | null(=UNKNOWN)
 *   = APPROXIMATE REMAINING STATE de la cohorte représentée (jamais un stock physique exact).
 *
 * AUTORITÉ (§ gate PM-1) : une SÉLECTION EXPLICITE de niveau par l'utilisateur est une assertion
 * DIRECT — même vocabulaire canonique que le reste de la provenance (DIRECT/CONFIRMED/DERIVED/
 * UNKNOWN). L'APPROXIMATION appartient à la sémantique de `remaining_level`, PAS à une autorité
 * faible. On ne crée AUCUN second vocabulaire (« USER_ASSERTED » est proscrit).
 *
 * Deux faits DISTINCTS (jamais fusionnés) :
 *   A. ÉTAT courant restant (snapshot)         → items.remaining_level (valeur) + assertion_provenance.remaining.authority(=DIRECT)
 *   B. FAIT CAUSAL explicite (USED|WASTED)      → événement stock_outcome_events (before/after/occurred_at)
 *
 * Ce module NE crée AUCUNE autorité de quantité EXACTE / économie / recette / low-stock : l'assertion
 * approximative ne rend jamais `quantityAuthority` KNOWN, ne fabrique jamais 0.5 unité économique, etc.
 */
// Enum fermé, ordonné. UNKNOWN = null (jamais fabriqué en FULL/1/HALF par défaut).
export const REMAINING_LEVELS = ['EMPTY', 'QUARTER', 'HALF', 'THREE_QUARTERS', 'FULL'];
// Niveaux ACTIFS (correction) : EMPTY est EXCLU — « vide » = clôture, atteignable UNIQUEMENT via
// un fait causal USED/WASTED, jamais via une simple correction d'état (sinon actif+EMPTY = §7 contradiction).
export const ACTIVE_REMAINING_LEVELS = ['QUARTER', 'HALF', 'THREE_QUARTERS', 'FULL'];
export const OUTCOME_TYPES = { USED: 'USED', WASTED: 'WASTED', CORRECTED: 'CORRECTED' };
// Autorité de l'assertion de restant = vocabulaire canonique DIRECT (= PROV_AUTHORITY.DIRECT de
// captureProvenance.js). Littéral pour garder ce module SANS dépendance ; l'égalité est vérifiée en test.
export const REMAINING_AUTHORITY = 'DIRECT';

const ORDER = REMAINING_LEVELS.reduce((m, l, i) => { m[l] = i; return m; }, {});
export const isRemainingLevel = (l) => typeof l === 'string' && Object.prototype.hasOwnProperty.call(ORDER, l);
// UNKNOWN accepté seulement comme null/undefined (jamais une chaîne magique).
export const isBeforeLevel = (l) => l == null || isRemainingLevel(l);

/**
 * classifyPartialOutcome — adjuge une déclaration causale USED/WASTED + niveau restant APRÈS.
 * @param {object} p
 *   - beforeLevel  : niveau AVANT connu côté serveur (null = UNKNOWN) — jamais fourni par le client comme vérité
 *   - afterLevel   : niveau APRÈS déclaré
 *   - outcomeType  : USED | WASTED
 *   - closed       : true si la row est DÉJÀ close (consumed) — côté serveur uniquement
 * @returns { valid, reason?, route?, effect? }
 *   effect (si valid) = {
 *     eventType,            // 'USED' | 'WASTED'
 *     closesRow,            // true UNIQUEMENT si afterLevel === EMPTY → converge vers consume/waste TOTAL
 *     setConsumed,          // true seulement à la clôture EMPTY (jamais pour un partiel actif)
 *     setWasted,            // true seulement si WASTED + EMPTY
 *     newRemainingLevel,    // niveau restant à persister (snapshot)
 *     beforeLevel, afterLevel,
 *   }
 * Règles :
 *   - ROW CLOSE (§6) : une row déjà consommée/gaspillée n'accepte plus d'issue → ITEM_ALREADY_CLOSED
 *     (la réouverture d'une cohorte close est une autre opération, HORS SCOPE).
 *   - MONOTONICITÉ (§12/§13) : si beforeLevel connu et afterLevel > beforeLevel → INVALIDE (contradiction :
 *     « utilisé/jeté » mais il en resterait PLUS) → route CORRECTION. after == before est AUTORISÉ (§13 :
 *     petite conso/perte réelle qui ne franchit pas un cran approximatif → l'événement causal reste vrai).
 *   - afterLevel === EMPTY (§5) : converge vers la sémantique canonique TOTALE (consumed=true ; wasted si WASTED).
 *   - afterLevel non-EMPTY (§6) : la row RESTE ACTIVE (consumed=false, wasted=false) ; snapshot = afterLevel.
 *   - beforeLevel UNKNOWN : n'importe quel afterLevel est une assertion légitime (USED+FULL = « j'en ai pris
 *     un peu, c'est encore ~plein » — §11 policy A : événement autorisé même si l'état ne change pas de cran).
 */
export function classifyPartialOutcome({ beforeLevel = null, afterLevel, outcomeType, closed = false } = {}) {
  if (outcomeType !== OUTCOME_TYPES.USED && outcomeType !== OUTCOME_TYPES.WASTED) {
    return { valid: false, reason: 'INVALID_OUTCOME_TYPE' };
  }
  if (!isRemainingLevel(afterLevel)) return { valid: false, reason: 'INVALID_AFTER_LEVEL' };
  if (!isBeforeLevel(beforeLevel)) return { valid: false, reason: 'INVALID_BEFORE_LEVEL' };
  if (closed) return { valid: false, reason: 'ITEM_ALREADY_CLOSED' }; // §6 pas de réouverture ici

  // §12 : augmentation STRICTE interdite pour une déclaration USED/WASTED (correction déguisée). Égal = OK (§13).
  if (beforeLevel != null && ORDER[afterLevel] > ORDER[beforeLevel]) {
    return { valid: false, reason: 'INCREASE_NOT_ALLOWED', route: 'CORRECTION' };
  }

  const empty = afterLevel === 'EMPTY';
  return {
    valid: true,
    effect: {
      eventType: outcomeType,
      closesRow: empty,
      setConsumed: empty,                                   // clôture TOTALE uniquement
      setWasted: empty && outcomeType === OUTCOME_TYPES.WASTED,
      newRemainingLevel: afterLevel,
      beforeLevel: beforeLevel ?? null,
      afterLevel,
    },
  };
}

/**
 * classifyCorrection — modification DIRECTE de l'état restant depuis la fiche produit (§11/§13).
 * ASSERTION D'ÉTAT COURANT, jamais un USED/WASTED : ne clôt jamais la row, n'écrit jamais consumed/wasted.
 * Peut aller dans n'importe quel sens (pas de monotonicité). Événement distinct CORRECTED.
 *   - CLOSED (§6) : rejet — on ne corrige pas l'état restant d'une cohorte close (contradiction consumed+level).
 *   - EMPTY (§7)  : rejet — « vide » n'est pas un état actif corrigeable ; pour vider, déclarer USED/WASTED → EMPTY.
 * @param {string} level  QUARTER|HALF|THREE_QUARTERS|FULL
 * @param {object} opts   { closed?: boolean }
 */
export function classifyCorrection(level, { closed = false } = {}) {
  if (!isRemainingLevel(level)) return { valid: false, reason: 'INVALID_LEVEL' };
  if (closed) return { valid: false, reason: 'ITEM_ALREADY_CLOSED' };            // §6
  if (level === 'EMPTY') return { valid: false, reason: 'EMPTY_REQUIRES_OUTCOME', route: 'OUTCOME' }; // §7
  return {
    valid: true,
    effect: {
      eventType: OUTCOME_TYPES.CORRECTED,
      closesRow: false,
      setConsumed: false,
      setWasted: false,
      newRemainingLevel: level,
      afterLevel: level,
    },
  };
}

// Provenance additive de l'assertion de restant (réutilise le sac assertion_provenance, mirroir de
// quantity/dateValue). Autorité = DIRECT (vocabulaire canonique unique). Fusion top-level lossless côté
// écrivains (mergeAssertionProvenance en JS ; jsonb `||` côté SQL) → ne clobbe jamais quantity/dateValue/dateType.
export function remainingProvenancePatch(assertedAtISO = null) {
  const remaining = { authority: REMAINING_AUTHORITY };
  if (assertedAtISO) remaining.assertedAt = assertedAtISO;
  return { remaining };
}
