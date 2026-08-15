import { deriveTemporalState, TEMPORAL_AUTHORITY } from './temporalAuthority';

/**
 * N6-03 — NOTIFICATION TRUTH GATE (première migration d'un consommateur temporel).
 *
 * Une notification est l'intervention au COÛT DE FAUX POSITIF LE PLUS ÉLEVÉ. Son autorité
 * doit donc être STRICTEMENT plus forte que le ranking silencieux ou l'attention passive.
 *
 * Roots (composés, non fusionnés) :
 *   - CR-22 Attention-Signal Truth : une interruption doit rester fidèle à une évidence
 *     d'attention suffisamment justifiée.
 *   - CR-01 Temporal Authority : la relation temporelle doit avoir l'autorité requise.
 *   - CR-02 Date-Type Truth : la sémantique de date doit justifier le wording.
 *
 * Contrat verrouillé (N5.5 / N5.2 / N5.3 / N1) :
 *   - Interruption ⊃ évidence. UNKNOWN ne crée aucune autorité d'interruption.
 *   - La permission utilisateur ne crée pas d'autorité épistémique.
 *   - La pertinence recette n'upgrade pas l'évidence temporelle.
 *   - Présence représentée ≠ réalité physique (N1) ; Présence ≠ quantité (N5.3).
 *   - Date Type inconnu → sémantique NEUTRE (jamais « expire »/sécurité).
 *   - Le silence est un résultat valide (zéro push éligible n'est PAS un échec).
 *
 * La vérité temporelle vient EXCLUSIVEMENT de la couche canonique `deriveTemporalState`
 * (N6-01) — jamais de `i.days`, `days_left` brut, ni d'un calcul de date ad hoc.
 */

// Fenêtre courte d'interruption (coût élevé → seuil serré). Appliquée à la projection
// AUTORITAIRE, pas à un scalaire périmé.
export const PUSH_WINDOW_DAYS = 3;
export const PUSH_MAX = 5;

/**
 * Présence représentée : Frigy représente-t-il actuellement une cohorte active éligible à
 * l'attention ? On lit l'état EXPLICITE (`consumed`/`wasted`), jamais `quantity > 0`
 * (N5.3 : Présence ≠ quantité). Ce n'est PAS une preuve d'existence physique (N1).
 */
export function isActivePresence(item) {
  return !!item && item.consumed !== true && item.wasted !== true;
}

// Types de date qui AUTORISENT une interruption (R-01). Une date proche ne justifie un push
// que si Frigy sait ce que la date SIGNIFIE : CR-02, valeur ≠ type. Type inconnu → sémantique
// NEUTRE, jamais d'action « à utiliser bientôt » / waste-risk. Frigy ne capture aujourd'hui
// AUCUN type → ensemble VIDE → zéro push (silence valide, pas un échec). Peupler cet ensemble
// = décision Produit/Attention ultérieure (capture de type), PAS N6-03. On n'écrit JAMAIS
// « type !== UNKNOWN » (cela auto-autoriserait tout futur type sans décision).
export const PUSH_AUTHORIZING_DATE_TYPES = new Set();

export function pushAuthorizedByDateType(state) {
  return !!state && PUSH_AUTHORIZING_DATE_TYPES.has(state.dateType);
}

/**
 * Éligibilité TEMPORELLE (avant le gate de type de date) : préférences → Présence active →
 * autorité temporelle = DATE (date absolue réelle et courante) → fenêtre [0, PUSH_WINDOW_DAYS].
 * HEURISTIC (ouverture) et NONE (bare days_left / estimate non ancré / fallback / périmé)
 * n'autorisent JAMAIS une interruption — écartés par le gate d'autorité.
 * @returns {Array<{item, daysRemaining, state}>} trié par urgence, borné à PUSH_MAX.
 */
export function selectTemporallyEligible(items = [], prefs = {}, now = new Date()) {
  if (prefs.pushEnabled === false) return [];
  if (prefs.expirationAlerts === false) return [];

  const eligible = [];
  for (const item of items) {
    if (!isActivePresence(item)) continue;

    const state = deriveTemporalState(item, now);
    // SEULE l'autorité DATE justifie une interruption (évidence la plus forte).
    if (state.authority !== TEMPORAL_AUTHORITY.DATE) continue;

    const d = state.daysRemaining;
    if (typeof d !== 'number' || d < 0 || d > PUSH_WINDOW_DAYS) continue;

    // Préférence « rappel la veille » : si désactivée, on saute J-1.
    if (prefs.dayBeforeReminder === false && d === 1) continue;

    eligible.push({ item, daysRemaining: d, state });
  }

  eligible.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return eligible.slice(0, PUSH_MAX);
}

/**
 * Éligibilité PUSH finale. L'autorité DATE est NÉCESSAIRE mais NON SUFFISANTE : le TYPE de
 * date doit AUSSI autoriser l'interruption (R-01). Aujourd'hui aucun type n'autorise → [].
 * @returns {Array<{item, daysRemaining}>}
 */
export function selectExpiryPushes(items = [], prefs = {}, now = new Date()) {
  return selectTemporallyEligible(items, prefs, now)
    .filter((e) => pushAuthorizedByDateType(e.state))
    .map(({ item, daysRemaining }) => ({ item, daysRemaining }));
}

/**
 * Contenu NEUTRE d'une notification. Un push n'est émis que pour un TYPE de date autorisant
 * l'interruption (R-01) ; le wording peut alors être une proximité neutre. AUCUNE
 * sous-affirmation de recette (R-02) : la preuve du matcher (N5.4) n'est pas encore fiable
 * (à corriger en N6-05/N6-06) — une notification temporellement justifiée ne doit pas porter
 * une revendication recette non fondée. Aucune sémantique de type non plus (ni « expire »,
 * ni jour-butoir).
 */
export function buildNeutralPushContent(item) {
  const emoji = (item && item.emoji) || '🛒';
  const name = (item && item.name) || 'Un produit';
  return {
    title: `${emoji} ${name}`,
    body: 'À utiliser bientôt.',
  };
}
