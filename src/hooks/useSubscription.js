import { useState, useEffect, useCallback } from 'react';
import { ENTITLEMENT_PRO } from '../config/purchases';

// ─── RevenueCat stub ──────────────────────────────────────────────────────────
// Remplace ce bloc par l'import réel une fois RevenueCat installé :
//   import Purchases from 'react-native-purchases';
let Purchases = null;
try { Purchases = require('react-native-purchases').default; } catch { /* not installed yet */ }

export default function useSubscription() {
  const [isPro,   setIsPro]   = useState(false);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    if (!Purchases) { setLoading(false); return; }
    try {
      const ci = await Purchases.getCustomerInfo();
      setIsPro(Boolean(ci.entitlements.active[ENTITLEMENT_PRO]));
    } catch {
      setIsPro(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  const purchase = useCallback(async (productId) => {
    if (!Purchases) throw new Error('NOT_CONFIGURED');
    const { customerInfo } = await Purchases.purchaseProduct(productId);
    const pro = Boolean(customerInfo.entitlements.active[ENTITLEMENT_PRO]);
    setIsPro(pro);
    return pro;
  }, []);

  const restore = useCallback(async () => {
    if (!Purchases) throw new Error('NOT_CONFIGURED');
    const ci = await Purchases.restorePurchases();
    const pro = Boolean(ci.entitlements.active[ENTITLEMENT_PRO]);
    setIsPro(pro);
    return pro;
  }, []);

  return { isPro, loading, purchase, restore, refresh: checkStatus };
}
