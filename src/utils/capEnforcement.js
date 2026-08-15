/**
 * N6-09 — CAP ENFORCEMENT TRUTH (CR-18). Décision de cap DÉTERMINISTE et PURE : une seule source
 * de vérité pour TOUS les writers de création (barcode/manuel, receipt, photo, Home « Je l'ai »).
 * Aucune dépendance Supabase ni UI ; jamais de fixture dev — le `activeCount` provient toujours de
 * l'état réel `items` (lignes actives = `consumed=false`).
 *
 * Politique (règle opérationnelle actuelle — N6-09 ne juge PAS sa légitimité ; CAP-01 reste ouvert) :
 *   - Pro : illimité.
 *   - Free : autoriser SEULEMENT si activeCount + addCount <= limit.
 *   - LOT (receipt/photo) : ATOMIC — un lot qui dépasse est refusé EN ENTIER. JAMAIS de clamp /
 *     troncature silencieuse : choisir quels produits sauver appartient à l'utilisateur, pas au cap.
 *   - addCount <= 0 (ou invalide) → refus : ne crée jamais de bypass (ex. addCount négatif).
 *   - activeCount > limit (Free historique) → tout ajout positif refusé (mais l'édition/consommation
 *     des lignes existantes n'est JAMAIS gatée par ce helper — voir writers).
 *
 * N6-09 ne ferme PAS la robustesse race/multi-device (D2) — enforcement client-only assumé,
 * dette P1 non bloquante ; aucune enforcement serveur/DB n'est ajoutée (couplée à CAP-01).
 */
import { FREE_ITEMS_LIMIT } from '../config/purchases';

// N6-09 (Phase 2.6, CR-18) : trois issues distinctes. « limite atteinte » (paywall) ≠ « compte pas
// encore connu » (attendre). UNKNOWN ≠ ZERO : un compte n'autorise une création QUE s'il provient
// d'un fetch réussi pour la MÊME famille (countReady). Sinon on refuse SANS ouvrir le paywall.
export const CAP_DECISION = {
  ALLOW: 'allowed',
  DENY_CAP: 'limit',                 // limite Free réellement atteinte → paywall
  DENY_COUNT_UNAVAILABLE: 'count-unavailable', // compte non hydraté/échec → attendre, PAS de paywall
};

/**
 * Décision de création CENTRALE (pure). Pro : count-readiness NON requise (illimité). addCount<=0/
 * invalide → refus (jamais de bypass). Free + compte non prêt → DENY_COUNT_UNAVAILABLE. Free + compte
 * connu : lot ATOMIC sous la limite → ALLOW, sinon DENY_CAP.
 */
export function decideAddItems({ isPro = false, countReady = false, activeCount, addCount = 1, limit = FREE_ITEMS_LIMIT } = {}) {
  const add = Number.isFinite(addCount) ? Math.floor(addCount) : 0;
  if (add <= 0) return { allowed: false, reason: CAP_DECISION.DENY_CAP };
  if (isPro) return { allowed: true, reason: CAP_DECISION.ALLOW };
  if (!countReady) return { allowed: false, reason: CAP_DECISION.DENY_COUNT_UNAVAILABLE };
  // countReady=true mais compte INVALIDE (NaN / négatif / non-nombre / undefined) → PAS un foyer vide
  // connu : fail-closed (UNKNOWN ≠ ZERO). On ne fabrique JAMAIS un zéro. Un vrai 0 reste valide.
  if (!(Number.isFinite(activeCount) && activeCount >= 0)) return { allowed: false, reason: CAP_DECISION.DENY_COUNT_UNAVAILABLE };
  const active = Math.floor(activeCount);
  const max = Number.isFinite(limit) ? limit : FREE_ITEMS_LIMIT;
  return (active + add <= max)
    ? { allowed: true, reason: CAP_DECISION.ALLOW }
    : { allowed: false, reason: CAP_DECISION.DENY_CAP };
}

// Rétro-compat : décision booléenne sur un compte CONNU (countReady implicite). Conservé pour les
// tests existants et tout appel où la disponibilité du compte est déjà garantie.
export function canAddItems(activeCount, addCount = 1, isPro = false, limit = FREE_ITEMS_LIMIT) {
  return decideAddItems({ isPro, countReady: true, activeCount, addCount, limit }).allowed;
}
