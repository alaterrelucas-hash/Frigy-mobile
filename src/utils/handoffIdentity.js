/**
 * N6-15 — IDENTITÉ DÉTERMINISTE DU HANDOFF COURSES → STOCK. PUR (uuid v5 uniquement).
 *
 * Donne à un handoff « Ranger dans mon stock » un `items.id` DÉTERMINISTE dérivé de
 * (familyId + shoppingItemId). Deux effets :
 *   1. Idempotence DURE via la PRIMARY KEY `items.id` : un second handoff de la MÊME ligne de
 *      courses produit le MÊME id → l'INSERT est rejeté (23505) → aucun doublon Stock.
 *   2. Reconnaissance de reprise : après un delete Courses raté puis reload, le même id est
 *      recalculable → on reconnaît la représentation Stock déjà créée sans en fabriquer une autre.
 *
 * Dérivation VOLONTAIREMENT indépendante de : nom, quantité, emplacement, date, timestamp, device,
 * user seul. Seuls familyId + shoppingItemId comptent (le foyer possède la ligne de courses).
 */
import { v5 as uuidv5 } from 'uuid';

/**
 * Namespace VERROUILLÉ & VERSIONNÉ — CONTRAT DE PERSISTANCE IMMUABLE. Ne JAMAIS le changer sans une
 * migration explicite de reconnaissance : tout changement casserait l'idempotence des handoffs déjà
 * exécutés (les ids recalculés ne matcheraient plus les lignes Stock existantes).
 * Dérivé (documentation) : uuidv5('app.frigy.courses-to-stock.v1', RFC-4122 URL namespace). Figé en
 * littéral pour qu'aucune évolution de dépendance ne puisse le faire dériver silencieusement.
 */
export const COURSES_TO_STOCK_NAMESPACE_V1 = '5a0af8f0-b4b3-5d13-9f9e-382d5d5dd028';

// Kind de lignée persistée dans assertion_provenance (origine, PAS autorité).
export const HANDOFF_LINEAGE_KIND = 'COURSES';

/**
 * @returns {string|null} UUID v5 déterministe, ou null si une entrée requise manque (jamais d'id partiel).
 */
export function courseStockItemId({ familyId, shoppingItemId } = {}) {
  if (!familyId || !shoppingItemId) return null;
  // Chaîne canonique stable et non ambiguë (préfixe versionné + séparateurs fixes).
  const canonical = `courses-v1:${String(familyId)}:${String(shoppingItemId)}`;
  return uuidv5(canonical, COURSES_TO_STOCK_NAMESPACE_V1);
}

/**
 * Métadonnée de LIGNÉE (origine) à fusionner dans assertion_provenance. N'affecte AUCUNE autorité
 * (quantité/date restent régies par N6-08). SOURCE ≠ AUTHORITY.
 */
export function courseLineage({ shoppingItemId } = {}) {
  if (!shoppingItemId) return null;
  return { kind: HANDOFF_LINEAGE_KIND, shoppingItemId: String(shoppingItemId) };
}
