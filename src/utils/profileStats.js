/**
 * N6-10 — Profile Impact Truth (CR-11/12/13/14). Statistiques Profile TRUTHFUL, pures.
 *
 * Ne renvoie QUE des faits ENREGISTRÉS au niveau FOYER, GLOBAUX (aucune fenêtre temporelle) :
 *   - consommations enregistrées = lignes marquées consommées ET non déclarées gaspillées ;
 *   - gaspillages déclarés = lignes marquées consommées ET déclarées gaspillées (assertion explicite).
 *
 * N'INVENTE JAMAIS : argent (consommé ≠ économie causale — CR-11), CO₂ (aucun modèle causal — CR-12),
 * score / grade / comparaison nationale (CR-13), « sauvé »/« avant expiration » (CR-14). Le compte est
 * un nombre de LIGNES (cohortes représentées), jamais des unités physiques (N6-07). Aucun prix lu.
 *
 * N6-10 (2.6) : PLUS AUCUNE API hebdomadaire. `items.updated_at` est un timestamp technique de dernière
 * modification (trigger prod trg_items_updated_at → now()), pas l'instant de l'événement consommation/
 * gaspillage → il ne peut fonder aucune classification « cette semaine ». Aucune sémantique temporelle
 * ne subsiste ici.
 */
export function computeProfileStats(consumedRows = []) {
  const rows = Array.isArray(consumedRows) ? consumedRows : [];
  return {
    recordedConsumptions: rows.filter((r) => r && !r.wasted).length,
    declaredWaste: rows.filter((r) => r && r.wasted).length,
  };
}
