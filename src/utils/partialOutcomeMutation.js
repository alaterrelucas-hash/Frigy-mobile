/**
 * PARTIAL OUTCOME — wrappers de MUTATION canonique. Valident via le contrat PUR (partialOutcome) puis
 * délèguent aux RPC atomiques (event insert + item update dans la même transaction serveur). `supabase` est
 * INJECTÉ (pas d'import direct → testable ; pas de faux succès). NON câblé à l'UI dans cette tranche : la
 * migration doit d'abord être appliquée (revue humaine). Aucune écriture simulée.
 */
import { classifyPartialOutcome, classifyCorrection } from './partialOutcome';
import { classifyStockUpdate } from './stockUpdate';

// V2 CANONIQUE — remaining-first + déclarations causales QUALITATIVES optionnelles. Route vers l'UNIQUE
// autorité serveur apply_stock_update. `usedDeclared`/`wasteDeclared` = déclarations explicites (false =
// « non déclaré », jamais « prouvé faux »). EMPTY → clôture totale ; non-EMPTY → ligne active.
export async function applyStockUpdate(supabase, { itemId, remainingLevel, usedDeclared = false, wasteDeclared = false, beforeLevel = null, clientEventId = null } = {}) {
  const decision = classifyStockUpdate({ beforeLevel, afterLevel: remainingLevel, usedDeclared, wasteDeclared });
  if (!decision.valid) return { ok: false, reason: decision.reason, route: decision.route || null };
  const { data, error } = await supabase.rpc('apply_stock_update', {
    p_item_id: itemId, p_after_level: remainingLevel,
    p_used_declared: usedDeclared, p_waste_declared: wasteDeclared, p_client_event_id: clientEventId,
  });
  if (error) return { ok: false, reason: (error.message || 'MUTATION_FAILED'), error };
  return { ok: true, item: data, effect: decision.effect };
}

// LEGACY (compatibilité/tests) — USED/WASTED + niveau restant. Route via l'ancien RPC apply_partial_outcome,
// qui est désormais un mince wrapper serveur vers apply_stock_update (autorité unique). La NOUVELLE UI V2
// n'utilise PLUS cette fonction ; elle appelle applyStockUpdate.
export async function applyPartialOutcome(supabase, { itemId, outcomeType, remainingLevel, beforeLevel = null, clientEventId = null } = {}) {
  const decision = classifyPartialOutcome({ beforeLevel, afterLevel: remainingLevel, outcomeType });
  if (!decision.valid) return { ok: false, reason: decision.reason, route: decision.route || null };
  const { data, error } = await supabase.rpc('apply_partial_outcome', {
    p_item_id: itemId, p_outcome_type: outcomeType, p_after_level: remainingLevel, p_client_event_id: clientEventId,
  });
  // Le SERVEUR est l'autorité finale (authz foyer, close-guard, idempotency-mismatch, monotonicité concurrente) :
  // on remonte l'identifiant d'erreur RPC tel quel — jamais de faux succès.
  if (error) return { ok: false, reason: (error.message || 'MUTATION_FAILED'), error };
  return { ok: true, item: data, effect: decision.effect };
}

// CORRECTION directe (fiche produit) : assertion d'état courant, jamais USED/WASTED.
export async function setApproximateRemainingLevel(supabase, { itemId, level, clientEventId = null } = {}) {
  const decision = classifyCorrection(level);
  if (!decision.valid) return { ok: false, reason: decision.reason };
  const { data, error } = await supabase.rpc('set_approximate_remaining_level', {
    p_item_id: itemId, p_level: level, p_client_event_id: clientEventId,
  });
  if (error) return { ok: false, reason: (error.message || 'MUTATION_FAILED'), error };
  return { ok: true, item: data, effect: decision.effect };
}
