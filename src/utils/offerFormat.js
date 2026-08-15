/**
 * N6-11 — Offer Truth (CR-16). Formatage PUR de l'offre commerciale à partir des objets RevenueCat
 * AUTHENTIQUES (PurchasesStoreProduct). AUCUN prix/période/essai/réduction codé en dur : tout dérive
 * de l'objet exactement achetable. Sans SDK, sans réseau.
 *
 * N6-11 Phase 2 : PAS d'essai (trial) ni de réduction (discount) rendus dans cette tranche — même si
 * `introPrice`/`discounts` existent. Merchandising trial/discount = enhancement futur.
 */

// Période d'abonnement ISO 8601 (P1W/P1M/P3M/P6M/P1Y) → libellé FR neutre. Null/inconnu → null (silence).
export function formatSubscriptionPeriod(iso) {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/^P(\d+)([DWMY])$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  if (unit === 'Y') return n === 1 ? '/an' : `/${n} ans`;
  if (unit === 'M') return n === 1 ? '/mois' : `/${n} mois`;
  if (unit === 'W') return n === 1 ? '/semaine' : `/${n} semaines`;
  if (unit === 'D') return n === 1 ? '/jour' : `/${n} jours`;
  return null;
}

/**
 * Transforme un PurchasesStoreProduct résolu en plan d'affichage canonique. RETOURNE null si l'objet
 * n'a pas de prix localisé authentique (jamais de plan sans prix réel). `storeProduct` est CONSERVÉ tel
 * quel : c'est l'objet EXACT passé à purchaseStoreProduct (offre affichée === offre achetée).
 */
export function toPlan(storeProduct) {
  if (!storeProduct || typeof storeProduct.priceString !== 'string' || !storeProduct.priceString) return null;
  const perMonth = (typeof storeProduct.pricePerMonthString === 'string' && storeProduct.pricePerMonthString)
    ? storeProduct.pricePerMonthString
    : null;
  return {
    id: storeProduct.identifier,
    storeProduct,
    localizedPrice: storeProduct.priceString,
    periodLabel: formatSubscriptionPeriod(storeProduct.subscriptionPeriod),
    perMonthLabel: perMonth,
  };
}

/**
 * Construit la liste de plans à partir des produits réellement résolus par getProducts, dans l'ordre
 * des IDs demandés. Résolution PARTIELLE gérée : on n'affiche QUE les plans réels (0 → aucun, mensuel
 * seul, annuel seul, les deux). On ne FABRIQUE jamais un plan manquant.
 */
export function buildPlans(resolvedProducts = [], orderedIds = []) {
  const products = Array.isArray(resolvedProducts) ? resolvedProducts : [];
  const byId = new Map(products.filter((p) => p && p.identifier).map((p) => [p.identifier, p]));
  const ordered = Array.isArray(orderedIds) && orderedIds.length
    ? orderedIds.map((id) => byId.get(id)).filter(Boolean)
    : products;
  return ordered.map(toPlan).filter(Boolean);
}
