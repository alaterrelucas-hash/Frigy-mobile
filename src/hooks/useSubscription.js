import { useState, useEffect, useCallback, useRef } from 'react';
import { ENTITLEMENT_PRO } from '../config/purchases';
import { ENTITLEMENT, createEntitlementCoordinator } from '../utils/entitlement';

// ─── RevenueCat stub ──────────────────────────────────────────────────────────
// Remplace ce bloc par l'import réel une fois RevenueCat installé :
//   import Purchases from 'react-native-purchases';
let Purchases = null;
try { Purchases = require('react-native-purchases').default; } catch { /* not installed yet */ }

/**
 * N6-11 (CR-15/16/17 ; 2.6) — AUTORITÉ D'ENTITLEMENT à 4 états (UNKNOWN/FREE/PRO/ERROR), jamais un
 * booléen. La coordination (verrou : UNE seule opération d'autorité à la fois ; autorité établie
 * préservée sur échec ; garde de démontage) vit dans un coordinateur PUR (utils/entitlement) dont ce
 * hook est un mince adaptateur React. Aucun résultat plus ancien ne peut écraser une autorité plus
 * récente. `isPro` est un dérivé de confort. L'OFFRE (produits) est une autorité SÉPARÉE (useProOffer).
 */
export default function useSubscription() {
  const [state, setState] = useState({ status: ENTITLEMENT.UNKNOWN, busy: false });
  const coordRef = useRef(null);

  if (!coordRef.current) {
    coordRef.current = createEntitlementCoordinator({
      getCustomerInfo:      Purchases ? () => Purchases.getCustomerInfo() : null,
      purchaseStoreProduct: Purchases ? (p) => Purchases.purchaseStoreProduct(p) : null,
      restorePurchases:     Purchases ? () => Purchases.restorePurchases() : null,
      entitlementId: ENTITLEMENT_PRO,
      onChange: ({ status, busy }) => setState({ status, busy }),
    });
  }

  useEffect(() => {
    const c = coordRef.current;
    c.check();
    return () => c.dispose(); // garde de démontage : plus aucune écriture d'état après
  }, []);

  // Achète l'objet StoreProduct EXACTEMENT affiché (offre affichée === achetée). Le verrou empêche toute
  // op d'autorité concurrente ; le succès « Pro » n'est vrai que si le CustomerInfo contient l'actif.
  const purchase = useCallback(async (storeProduct) => {
    if (!Purchases) throw new Error('NOT_CONFIGURED');
    const r = await coordRef.current.purchase(storeProduct);
    return Boolean(r && r.pro);
  }, []);

  const restore = useCallback(async () => {
    if (!Purchases) throw new Error('NOT_CONFIGURED');
    await coordRef.current.restore();
    return coordRef.current.getStatus() === ENTITLEMENT.PRO;
  }, []);

  const refresh = useCallback(() => coordRef.current.check(), []);

  return {
    status: state.status,
    isPro: state.status === ENTITLEMENT.PRO,
    entitlementBusy: state.busy,
    purchase,
    restore,
    refresh,
  };
}
