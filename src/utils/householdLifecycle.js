/**
 * N6-14 (CR-08) — Household lifecycle → Home mode. PUR, sans React ni SDK.
 *
 * Autorité SERVEUR uniquement (public.household_lifecycle) : jamais AsyncStorage, jamais un champ
 * technique. « priorité absente » n'a rien à voir ici ; c'est la LISIBILITÉ du cycle de vie du foyer.
 *
 * Doctrine : UNKNOWN ≠ NEVER. `legacy_unknown` et l'absence de ligne / erreur → NEUTRE (jamais First
 * Run, jamais Empty Returning). First Run exige la PREUVE serveur `never_initialized`. Un stock actif
 * (activeCount>0) prouve à lui seul l'initialisation → ACTIVE, sans attendre le cycle de vie ; une
 * réponse de cycle de vie périmée ne peut donc JAMAIS fabriquer First Run/Empty (ils exigent 0 actif).
 */
export const LIFECYCLE_STATE = {
  NEVER: 'never_initialized',
  LEGACY_UNKNOWN: 'legacy_unknown',
  INITIALIZED: 'initialized',
};

export const HOME_MODE = {
  NEUTRAL: 'neutral',     // autorité indisponible / legacy-unknown → coquille non-assertive
  FIRST_RUN: 'first-run', // foyer prouvé jamais initialisé + 0 actif
  EMPTY: 'empty',         // foyer prouvé initialisé + 0 actif
  ACTIVE: 'active',       // stock actif présent
};

/**
 * Précédence VERROUILLÉE :
 *   1. compte non prêt → NEUTRE (on ne connaît pas encore le stock).
 *   2. stock actif > 0 → ACTIVE (preuve positive d'initialisation ; le cycle de vie n'est pas requis).
 *   3. 0 actif mais cycle de vie non prêt / inconnu → NEUTRE.
 *   4. 0 actif + never_initialized → FIRST RUN.
 *   5. 0 actif + initialized → EMPTY RETURNING.
 *   6. 0 actif + legacy_unknown (ou valeur inattendue) → NEUTRE.
 */
export function resolveHomeMode({ itemsReady = false, lifecycleReady = false, activeCount = 0, lifecycleState = null } = {}) {
  if (!itemsReady) return HOME_MODE.NEUTRAL;
  if (!Number.isFinite(activeCount)) return HOME_MODE.NEUTRAL; // compte non fiable → neutre (jamais 0 fabriqué)
  if (activeCount > 0) return HOME_MODE.ACTIVE;
  if (!lifecycleReady) return HOME_MODE.NEUTRAL;
  if (lifecycleState === LIFECYCLE_STATE.NEVER) return HOME_MODE.FIRST_RUN;
  if (lifecycleState === LIFECYCLE_STATE.INITIALIZED) return HOME_MODE.EMPTY;
  return HOME_MODE.NEUTRAL; // legacy_unknown, null (ligne absente), ou inattendu → jamais NEVER fabriqué
}
