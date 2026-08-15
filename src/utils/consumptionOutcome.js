/**
 * N6-12 — Consume/Waste Write Authority (CR-10 + Waste Write Authority). PUR, sans React ni SDK.
 *
 * Doctrine : un résultat consommé/gaspillé n'EXISTE dans Frigy qu'APRÈS persistance canonique PROUVÉE.
 * Preuve exacte = erreur nulle ET exactement UNE ligne retournée dont l'id correspond. Zéro ligne ou
 * plusieurs lignes = ÉCHEC (jamais de succès fabriqué). Le client Supabase (v2, sans throwOnError)
 * renvoie {data,error} sans lever ; `.select('id')` sur l'update prouve la/les ligne(s) affectée(s).
 */
export function classifyConsumeResult({ error, data, expectedId } = {}) {
  if (error) return false;
  if (!Array.isArray(data) || data.length !== 1) return false; // zéro OU plusieurs → échec
  return !!data[0] && data[0].id === expectedId;
}

/**
 * Coordinateur consume/waste PUR : garde synchrone « une seule opération en vol » + classification du
 * résultat. `mutate(item, wasted)` renvoie une promesse {data,error} (l'update Supabase avec .select).
 * Un 2e appel avant résolution du 1er → {skipped:true} SANS déclencher de 2e mutation. Toute sortie
 * (succès/échec/exception) libère le verrou (finally). Aucun effet UI ici : l'appelant applique le
 * retrait/fermeture/analytics UNIQUEMENT si {ok:true}.
 */
export function createConsumeCoordinator({ mutate } = {}) {
  let busy = false;
  return {
    isBusy: () => busy,
    run: async (item, wasted = false) => {
      if (busy) return { skipped: true };
      busy = true;
      try {
        const { data, error } = await mutate(item, wasted);
        return { skipped: false, ok: classifyConsumeResult({ error, data, expectedId: item && item.id }) };
      } catch {
        return { skipped: false, ok: false }; // exception réseau/SDK → échec, jamais succès
      } finally {
        busy = false;
      }
    },
  };
}
