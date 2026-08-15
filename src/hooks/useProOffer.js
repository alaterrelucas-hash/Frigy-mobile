import { useState, useEffect, useCallback } from 'react';
import { PRODUCT_MONTHLY, PRODUCT_ANNUAL } from '../config/purchases';
import { buildPlans } from '../utils/offerFormat';

let Purchases = null;
try { Purchases = require('react-native-purchases').default; } catch { /* not installed yet */ }

export const OFFER_STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };

/**
 * N6-11 (CR-16) — AUTORITÉ D'OFFRE, SÉPARÉE de l'entitlement. Sa seule question : quels StoreProduct
 * sont réellement achetables maintenant ? Résout les IDs produits EXISTANTS via getProducts (aucune
 * dépendance Offering/dashboard). Un échec ici NE MODIFIE JAMAIS l'entitlement (autre hook), et un échec
 * d'entitlement ne modifie jamais cet état. Résolution partielle (0/1/2 produits) → on n'expose que les
 * plans réels ; aucun prix codé en dur, aucun plan fabriqué.
 */
export default function useProOffer() {
  const [offerStatus, setOfferStatus] = useState(OFFER_STATUS.LOADING);
  const [plans, setPlans] = useState([]);

  const load = useCallback(async () => {
    if (!Purchases) { setPlans([]); setOfferStatus(OFFER_STATUS.ERROR); return; }
    setOfferStatus(OFFER_STATUS.LOADING);
    try {
      const products = await Purchases.getProducts([PRODUCT_MONTHLY, PRODUCT_ANNUAL]);
      const built = buildPlans(products, [PRODUCT_MONTHLY, PRODUCT_ANNUAL]);
      setPlans(built);
      // Aucun produit résolu = offre indisponible (jamais de prix inventé). Sinon prête (partielle OK).
      setOfferStatus(built.length > 0 ? OFFER_STATUS.READY : OFFER_STATUS.ERROR);
    } catch {
      setPlans([]);
      setOfferStatus(OFFER_STATUS.ERROR);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { offerStatus, plans, reload: load };
}
