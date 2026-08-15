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

// N6-09 (Phase 2.6, CR-18) + N6-11 (Phase 2, CR-15/16/17) : issues distinctes.
//   ALLOW / DENY_CAP (limite Free atteinte → paywall) / DENY_COUNT_UNAVAILABLE (compte non hydraté →
//   attendre) / DENY_ENTITLEMENT_UNAVAILABLE (l'autorité d'abonnement n'est pas établie ALORS que le
//   palier ferait une différence → attendre, JAMAIS de paywall, JAMAIS d'insert).
export const CAP_DECISION = {
  ALLOW: 'allowed',
  DENY_CAP: 'limit',
  DENY_COUNT_UNAVAILABLE: 'count-unavailable',
  DENY_ENTITLEMENT_UNAVAILABLE: 'entitlement-unavailable',
};

// Statuts d'entitlement partagés avec entitlement.js (comparés en littéral pour rester sans dépendance).
const PRO = 'pro';
const FREE = 'free';

// Résout l'autorité d'entitlement : `entitlement` (statut à 4 états) prime ; sinon rétro-compat booléen
// (`isPro` true → PRO, false → FREE). Ni l'un ni l'autre → UNKNOWN.
function resolveEntitlement(entitlement, isPro) {
  if (typeof entitlement === 'string') return entitlement;
  if (isPro === true) return PRO;
  if (isPro === false) return FREE;
  return 'unknown';
}

/**
 * Décision de création CENTRALE (pure). N6-11 : l'autorité d'entitlement n'est requise QUE quand FREE et
 * PRO produiraient un résultat DIFFÉRENT (c.-à-d. au dépassement de la limite). Sous la limite, on
 * AUTORISE même si l'entitlement est UNKNOWN/ERROR (Free ET Pro autoriseraient) → Free Core préservé.
 * Ordre canonique (§12) :
 *   1. addCount invalide/≤0 → refus (jamais de bypass).
 *   2. PRO → ALLOW (illimité, même compte indisponible).
 *   3. compte non prêt → DENY_COUNT_UNAVAILABLE (N6-09, inchangé).
 *   4. compte invalide → DENY_COUNT_UNAVAILABLE (UNKNOWN ≠ ZERO, inchangé).
 *   5/6. ne dépasse PAS la limite → ALLOW (FREE, UNKNOWN, ERROR : le palier n'importe pas).
 *   7. dépasserait : FREE → DENY_CAP (paywall) ; UNKNOWN/ERROR → DENY_ENTITLEMENT_UNAVAILABLE (neutre).
 */
export function decideAddItems({ entitlement, isPro, countReady = false, activeCount, addCount = 1, limit = FREE_ITEMS_LIMIT } = {}) {
  const add = Number.isFinite(addCount) ? Math.floor(addCount) : 0;
  if (add <= 0) return { allowed: false, reason: CAP_DECISION.DENY_CAP };
  const status = resolveEntitlement(entitlement, isPro);
  if (status === PRO) return { allowed: true, reason: CAP_DECISION.ALLOW };
  if (!countReady) return { allowed: false, reason: CAP_DECISION.DENY_COUNT_UNAVAILABLE };
  // countReady=true mais compte INVALIDE (NaN / négatif / non-nombre / undefined) → fail-closed.
  if (!(Number.isFinite(activeCount) && activeCount >= 0)) return { allowed: false, reason: CAP_DECISION.DENY_COUNT_UNAVAILABLE };
  const active = Math.floor(activeCount);
  const max = Number.isFinite(limit) ? limit : FREE_ITEMS_LIMIT;
  if (active + add <= max) return { allowed: true, reason: CAP_DECISION.ALLOW };
  // Dépasserait la limite Free → le palier fait la différence : l'autorité d'entitlement est requise.
  if (status === FREE) return { allowed: false, reason: CAP_DECISION.DENY_CAP };
  return { allowed: false, reason: CAP_DECISION.DENY_ENTITLEMENT_UNAVAILABLE };
}

// Rétro-compat : décision booléenne sur un compte CONNU (countReady implicite). Conservé pour les
// tests existants et tout appel où la disponibilité du compte est déjà garantie.
export function canAddItems(activeCount, addCount = 1, isPro = false, limit = FREE_ITEMS_LIMIT) {
  return decideAddItems({ isPro, countReady: true, activeCount, addCount, limit }).allowed;
}
