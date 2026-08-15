/**
 * N6-11 — Commercial / Premium Truth (CR-15/16/17). AUTORITÉ D'ENTITLEMENT, pure et sans SDK.
 *
 * Doctrine verrouillée : l'entitlement est une AUTORITÉ à quatre états, JAMAIS un booléen.
 *   UNKNOWN ≠ FREE.  ERROR ≠ FREE.  UNKNOWN ≠ PRO.  ERROR ≠ PRO.
 * Seul un `getCustomerInfo` résolu SANS entitlement actif → FREE ; avec entitlement actif → PRO.
 * Une erreur/indisponibilité ne fabrique JAMAIS FREE (ni PRO). L'état OFFRE (produits achetables) est
 * une autorité SÉPARÉE (voir useProOffer) : « offre prête » ≠ « l'utilisateur doit acheter ».
 *
 * Ces chaînes sont le contrat partagé avec capEnforcement (qui les compare en littéral pour rester
 * sans dépendance) — ne pas les renommer sans mettre à jour capEnforcement.
 */
export const ENTITLEMENT = {
  UNKNOWN: 'unknown', // pas encore résolu / SDK indisponible en cours
  FREE: 'free',       // résolu : aucun entitlement actif
  PRO: 'pro',         // résolu : entitlement actif
  ERROR: 'error',     // la vérification a échoué → NE PAS traiter comme FREE
};

export const isProStatus = (s) => s === ENTITLEMENT.PRO;
export const isKnownFree = (s) => s === ENTITLEMENT.FREE;
// Vrai uniquement quand l'autorité est ÉTABLIE (FREE ou PRO). UNKNOWN/ERROR → non établi.
export const isEntitlementKnown = (s) => s === ENTITLEMENT.FREE || s === ENTITLEMENT.PRO;

/**
 * Dérive le statut depuis un CustomerInfo résolu ou un drapeau loading/error. Pure : ne touche pas le
 * SDK. `loading` prime (UNKNOWN) ; `error` → ERROR ; absence de customerInfo → UNKNOWN (pas FREE).
 */
export function deriveEntitlementStatus({ loading = false, error = false, customerInfo = undefined, entitlementId = 'pro' } = {}) {
  if (loading) return ENTITLEMENT.UNKNOWN;
  if (error) return ENTITLEMENT.ERROR;
  if (!customerInfo) return ENTITLEMENT.UNKNOWN;
  const active = (customerInfo && customerInfo.entitlements && customerInfo.entitlements.active) || {};
  return active[entitlementId] ? ENTITLEMENT.PRO : ENTITLEMENT.FREE;
}

/**
 * Décision d'accès à une capacité à vraie différence de palier (Photo ; Receipt après l'offert).
 * PRO → allow. FREE → paywall. UNKNOWN → verify (attendre l'autorité). ERROR → retry.
 * On ne déverrouille JAMAIS sous incertitude, et on n'appelle JAMAIS UNKNOWN « Free ».
 */
export const FEATURE_ACCESS = { ALLOW: 'allow', PAYWALL: 'paywall', VERIFY: 'verify', RETRY: 'retry' };

export function decideFeatureAccess(entitlement) {
  if (entitlement === ENTITLEMENT.PRO) return FEATURE_ACCESS.ALLOW;
  if (entitlement === ENTITLEMENT.FREE) return FEATURE_ACCESS.PAYWALL;
  if (entitlement === ENTITLEMENT.ERROR) return FEATURE_ACCESS.RETRY;
  return FEATURE_ACCESS.VERIFY; // UNKNOWN / valeur inattendue → attendre l'autorité
}

/**
 * N6-11 (2.6) — Transition d'autorité PURE. `outcome` ∈ {'pro','free','error'}.
 * Un succès (pro/free) est autoritatif → il gagne. Un ÉCHEC ne PROUVE PAS la disparition de
 * l'entitlement : on PRÉSERVE la dernière autorité établie (FREE/PRO). ERROR seulement si aucune
 * autorité n'a jamais été établie (précédent UNKNOWN/ERROR). Jamais de FREE fabriqué, jamais de
 * downgrade d'un payant sur un simple échec réseau. Session-only, aucune persistance.
 */
export function applyEntitlementOutcome({ previousStatus, outcome } = {}) {
  if (outcome === ENTITLEMENT.PRO || outcome === 'pro') return ENTITLEMENT.PRO;
  if (outcome === ENTITLEMENT.FREE || outcome === 'free') return ENTITLEMENT.FREE;
  // outcome === 'error' (ou inattendu) : préserver l'autorité établie.
  if (previousStatus === ENTITLEMENT.PRO) return ENTITLEMENT.PRO;
  if (previousStatus === ENTITLEMENT.FREE) return ENTITLEMENT.FREE;
  return ENTITLEMENT.ERROR;
}

/**
 * N6-11 (2.6) — COORDINATEUR D'AUTORITÉ d'entitlement, PUR et injectable (aucun React, aucun SDK
 * direct). Garantie primaire : UNE SEULE opération d'autorité active à la fois (verrou synchrone) —
 * les opérations getCustomerInfo / purchase / restore ne peuvent JAMAIS s'exécuter concurremment, donc
 * aucun résultat plus ancien ne peut écraser une autorité plus récente. Un jeton de génération +
 * `alive` servent de garde défensive contre un callback après démontage (jamais d'arbitrage entre
 * opérations concurrentes — elles n'existent pas). `onChange({status, busy})` notifie l'hôte React.
 *
 * deps : getCustomerInfo() / purchaseStoreProduct(product) / restorePurchases() renvoient un CustomerInfo
 * (purchase renvoie {customerInfo}). Une dep absente (SDK indisponible) → ERROR si aucune autorité.
 */
export function createEntitlementCoordinator({ getCustomerInfo, purchaseStoreProduct, restorePurchases, entitlementId = ENTITLEMENT.PRO, onChange } = {}) {
  let status = ENTITLEMENT.UNKNOWN;
  let busy = false;   // verrou synchrone : au plus une op d'autorité en vol
  let gen = 0;        // jeton défensif (démontage / invalidation)
  let alive = true;

  const notify = () => { if (typeof onChange === 'function') onChange({ status, busy }); };
  const proFrom = (ci) => Boolean(ci && ci.entitlements && ci.entitlements.active && ci.entitlements.active[entitlementId]);

  // Exécute UNE opération d'autorité sérialisée. `provider` renvoie un CustomerInfo (ou lève).
  async function run(provider) {
    if (busy) return { skipped: true, status };
    busy = true; const myGen = ++gen; notify(); // busy=true visible immédiatement
    let outcome;
    try {
      const ci = await provider();
      outcome = proFrom(ci) ? 'pro' : 'free';
    } catch { outcome = 'error'; }
    // Garde stale/démontage : n'applique le résultat que si toujours vivant ET dernière génération.
    if (!alive || myGen !== gen) return { stale: true, status };
    status = applyEntitlementOutcome({ previousStatus: status, outcome });
    busy = false; notify();
    return { status, outcome };
  }

  return {
    getStatus: () => status,
    isBusy: () => busy,
    check: () => {
      if (busy) return Promise.resolve({ skipped: true, status });
      if (!getCustomerInfo) { // SDK indisponible : ERROR seulement si aucune autorité établie
        status = applyEntitlementOutcome({ previousStatus: status, outcome: 'error' }); notify();
        return Promise.resolve({ status });
      }
      return run(getCustomerInfo);
    },
    purchase: async (product) => {
      if (busy) return { skipped: true, status };
      if (!purchaseStoreProduct) return { skipped: true, status };
      const r = await run(() => purchaseStoreProduct(product).then((res) => res && res.customerInfo));
      return { ...r, pro: status === ENTITLEMENT.PRO };
    },
    restore: () => {
      if (busy) return Promise.resolve({ skipped: true, status });
      if (!restorePurchases) return Promise.resolve({ skipped: true, status });
      return run(restorePurchases);
    },
    dispose: () => { alive = false; gen++; },
  };
}
