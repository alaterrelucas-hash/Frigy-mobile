import { normalizeDlc } from './product';

/**
 * N6-01 + N6-02 — TEMPORAL AUTHORITY FOUNDATION (première tranche d'implémentation N6).
 *
 * Couche canonique UNIQUE qui répond à : « quelle base temporelle peut-on PROUVER
 * pour cet item, et une projection courante peut-elle en être légitimement dérivée ? »
 *
 * Contrat N5.2 / N5.5 (verrouillé — ne pas réinterpréter) :
 *   - VALEUR de date ≠ TYPE de date. Frigy ne capture aujourd'hui AUCUN type → dateType
 *     reste UNKNOWN → sémantique temporelle NEUTRE (jamais « expire »/DLC/sécurité ici).
 *   - Le temps restant courant exige une BASE temporelle valide.
 *   - Estimation NON ancrée (estimateDays sans date/ouverture), fallback 30, `days_left`
 *     périmé → autorité temporelle courante = NONE (pas de countdown, pas de seuil ≤3/≤4/≤7,
 *     pas de ranking temporel, pas de push).
 *   - Une heuristique ANCRÉE (ouverture : opened_at) peut porter une projection BORNÉE ;
 *     l'arithmétique déterministe ne relève pas l'autorité heuristique.
 *   - `computeDaysRemaining` (recomputation technique) ≠ base fraîche autoritaire.
 *
 * Contrat N6-02 (legacy → UNKNOWN, verrouillé) :
 *   - On ne BACKFILLE JAMAIS une provenance/un type/une ancre que Frigy n'a pas observés.
 *   - Origine non prouvable ⇒ on RETIENT l'autorité (UNKNOWN), on ne DÉTRUIT PAS la valeur
 *     technique stockée (`dlc`/`days_left` restent en base pour compat/debug).
 *
 * IMPORTANT — cette tranche N6-01/N6-02 n'MIGRE AUCUN consommateur. `computeDaysRemaining`
 * (temporal.js) et tous les écrans restent inchangés ; cette couche est ajoutée à côté,
 * prête à être consommée par les tranches N6 suivantes (notifications, priorité, etc.).
 *
 * Pas de score de confiance numérique universel : la sortie est structurée en énumérations
 * discrètes (basis / authority / dateType), jamais `{ days, confidence }`.
 */

// De quoi la projection courante peut légitimement être reconstruite.
export const TEMPORAL_BASIS = {
  ABSOLUTE_DATE: 'absolute-date',       // une date calendaire réelle a été capturée (auto-ancrée)
  ANCHORED_OPENING: 'anchored-opening', // projection d'ouverture ancrée sur opened_at (heuristique)
  NONE: 'none',                          // aucune base prouvable
};

// Autorité de décision temporelle de la projection (décision-spécifique côté consommateur).
export const TEMPORAL_AUTHORITY = {
  DATE: 'date',           // recomputable depuis une date réelle stockée (type inconnu → neutre)
  HEURISTIC: 'heuristic', // projection bornée (ouverture) — jamais urgence/push
  NONE: 'none',           // UNKNOWN : aucune projection courante autorisée
};

// Frigy ne capture aujourd'hui aucun type de date (DLC/DDM/…) → toujours inconnu → neutre.
// N6-08 : DLC/DDM ne sont produits QUE lorsqu'une provenance persistée atteste un choix EXPLICITE
// de l'utilisateur (jamais déduits du nom de colonne `dlc`, jamais d'une lecture machine seule).
// Les allowlists downstream (push N6-03, amplifié N6-04) restent VIDES → un type connu n'active
// rien automatiquement (capture ≠ autorisation d'interruption / d'attention).
export const DATE_TYPE = { UNKNOWN: 'unknown', DLC: 'DLC', DDM: 'DDM' };

// ── N6-08 : lecture de la provenance persistée (assertion_provenance), tolérante au legacy ──
// Valeur de date NON autoritaire (machine/OCR non confirmée) → ne pas promouvoir en DATE.
// Legacy (aucune provenance) → false → autorité N6-01 strictement inchangée.
function provDateValueNonAuthoritative(item) {
  const dv = item && item.assertion_provenance && item.assertion_provenance.dateValue;
  if (!dv) return false;
  return !(dv.authority === 'DIRECT' || dv.authority === 'CONFIRMED');
}
// Type de date EXPLICITE prouvé (DLC/DDM + autorité DIRECT/CONFIRMED) → sinon UNKNOWN.
function provExplicitDateType(item) {
  const dt = item && item.assertion_provenance && item.assertion_provenance.dateType;
  if (dt && (dt.authority === 'DIRECT' || dt.authority === 'CONFIRMED')
      && (dt.value === 'DLC' || dt.value === 'DDM')) return dt.value;
  return DATE_TYPE.UNKNOWN;
}

const DAY_MS = 86400000;

// Parse une chaîne de date normalisée en Date (ou null). N'utilise PAS `now` : une date
// absolue est sa propre ancre. Réutilise normalizeDlc (source unique de normalisation de
// format) sans toucher `parseDlc` (consommé ailleurs, laissé intact).
function parseToDate(str) {
  if (!str || str === '—') return null;
  const clean = normalizeDlc(str).replace(/[^0-9/]/g, '');
  const parts = clean.split('/');
  let date = null;
  if (parts.length === 3 && parts[2].length >= 4) {
    date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  } else if (parts.length === 2 && parts[1].length >= 4) {
    date = new Date(parseInt(parts[1], 10), parseInt(parts[0], 10) - 1, 28);
  }
  if (!date || isNaN(date)) return null;
  return date;
}

function daysBetween(date, now) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((date - midnight) / DAY_MS);
}

function unknownState() {
  return {
    basis: TEMPORAL_BASIS.NONE,
    authority: TEMPORAL_AUTHORITY.NONE,
    dateType: DATE_TYPE.UNKNOWN,
    daysRemaining: null,
    anchor: null,
    hasCurrentProjection: false,
  };
}

/**
 * Dérive l'état temporel canonique d'un item, sans jamais inventer de provenance.
 *
 * Ordre de décision (déterministe, ne lit que ce qui est structurellement présent) :
 *   1. Item ouvert AVEC ancre opened_at → ANCHORED_OPENING (heuristique bornée).
 *      Le `dlc` d'un item ouvert est une projection d'ouverture calculée, PAS une date
 *      imprimée : on la traite comme heuristique, jamais comme autorité de date.
 *   2. Item non ouvert AVEC un `dlc` réel parseable (≠ '—') → ABSOLUTE_DATE (auto-ancrée),
 *      type UNKNOWN → neutre. C'est le seul cas d'autorité de date.
 *   3. Tout le reste (bare days_left, dlc='—'/absent/illisible, fallback 30, valeur périmée,
 *      ouvert sans opened_at) → UNKNOWN. Origine non prouvable ⇒ autorité retenue.
 *
 * @param {object} item  ligne stock (dlc, days_left, opened, opened_at, …). Valeurs techniques
 *                       conservées telles quelles ; jamais mutées ici.
 * @param {Date}   now   instant de référence (injectable pour tests déterministes).
 * @returns {{basis,authority,dateType,daysRemaining,anchor,hasCurrentProjection}}
 */
export function deriveTemporalState(item, now = new Date()) {
  if (!item || typeof item !== 'object') return unknownState();

  // 1. Ouvert : projection d'ouverture ancrée sur opened_at (heuristique).
  if (item.opened) {
    if (!item.opened_at) return unknownState(); // ouvert sans ancre prouvable → UNKNOWN
    const projected = parseToDate(item.dlc);
    if (projected) {
      return {
        basis: TEMPORAL_BASIS.ANCHORED_OPENING,
        authority: TEMPORAL_AUTHORITY.HEURISTIC,
        dateType: DATE_TYPE.UNKNOWN,
        daysRemaining: daysBetween(projected, now),
        anchor: 'opened_at',
        hasCurrentProjection: true,
      };
    }
    return unknownState();
  }

  // 2. Non ouvert : une date calendaire réelle a-t-elle été capturée ?
  // N6-08 : une provenance persistée peut marquer la date comme NON autoritaire (machine/OCR non
  // confirmée) → on ne la promeut PAS en DATE (§22). Legacy (aucune provenance) → inchangé.
  const captured = parseToDate(item.dlc);
  if (captured && !provDateValueNonAuthoritative(item)) {
    return {
      basis: TEMPORAL_BASIS.ABSOLUTE_DATE,
      authority: TEMPORAL_AUTHORITY.DATE,
      dateType: provExplicitDateType(item), // DLC/DDM explicite prouvé, sinon UNKNOWN
      daysRemaining: daysBetween(captured, now),
      anchor: 'stored-date',
      hasCurrentProjection: true,
    };
  }

  // 3. Bare days_left / fallback / stale / illisible → aucune autorité courante. UNKNOWN.
  //    (On ne devine PAS que days_left venait d'une vraie date ou d'un estimate.)
  return unknownState();
}

/**
 * Une décision temporelle « forte » (countdown précis, seuil court, urgence, push) exige
 * une base à autorité DATE. Les projections HEURISTIC (ouverture) et NONE ne la portent pas.
 * Fournie pour les tranches consommateur ultérieures ; non branchée ici.
 */
export function hasStrongTemporalAuthority(state) {
  return !!state && state.authority === TEMPORAL_AUTHORITY.DATE;
}

/**
 * Une projection courante utilisable (rank doux / attention neutre) existe pour DATE ou
 * HEURISTIC ancrée, jamais pour NONE. Le TYPE reste inconnu → wording neutre côté consommateur.
 */
export function hasCurrentProjection(state) {
  return !!state && state.authority !== TEMPORAL_AUTHORITY.NONE;
}

/**
 * N6-04 — jours restants pour un consommateur PASSIF (ranking / attention / badge / puce),
 * autorité-aware. Coût de décision plus faible que le push : DATE (date réelle, type inconnu
 * → usage NEUTRE autorisé) ET HEURISTIC ancrée (ouverture, soft) fournissent une position
 * temporelle. NONE (bare days_left / estimate NON ancré / fallback 30 / scalaire périmé) →
 * `null` = AUCUNE position temporelle : l'item n'entre dans aucun compte/ranking/attention
 * temporel (jamais rang 0, jamais 999, jamais « urgent »). Le TYPE restant inconnu, le
 * wording côté consommateur doit demeurer neutre (pas de « expire »/sécurité).
 * @returns {number|null}
 */
export function passiveTemporalDays(item, now = new Date()) {
  const s = deriveTemporalState(item, now);
  return s.authority === TEMPORAL_AUTHORITY.NONE ? null : s.daysRemaining;
}

/**
 * N6-04 — jours restants pour un signal FORT / amplifié / extrait hors contexte (compteur de
 * badge de navigation, liste « urgent » dédiée, puce critique rouge). Le coût d'un tel signal
 * est plus élevé qu'un simple classement in-app → il exige la meilleure évidence passive :
 * l'autorité DATE (date calendaire réelle). L'HEURISTIC ancrée (ouverture) reste SOFT et rend
 * `null` ici : elle continue d'exister dans le classement/tiers in-app (`passiveTemporalDays`),
 * mais n'ALIMENTE PAS les signaux forts. NONE → `null`.
 *
 * Distinction clé (R-01) : `passiveTemporalDays` (DATE+HEURISTIC, classement doux) et
 * `strongTemporalDays` (DATE seul, signal fort) ne COLLAPSENT PLUS l'autorité — chaque
 * consommateur choisit sa politique selon le coût de sa décision. Même évidence canonique,
 * sorties décision-spécifiques, autorité JAMAIS effacée avant la décision.
 * @returns {number|null}
 */
export function strongTemporalDays(item, now = new Date()) {
  const s = deriveTemporalState(item, now);
  return s.authority === TEMPORAL_AUTHORITY.DATE ? s.daysRemaining : null;
}

/**
 * N6-04 (plafond sémantique amplifié) — types de date qui AUTORISENT un signal PASSIF
 * AMPLIFIÉ : rouge/orange par item, « critical », halo Natural Focus, urgence de consommation
 * Stock (« à utiliser en priorité »). DEUX dimensions d'autorité :
 *   1. VALEUR temporelle : DATE (répond « quand »).
 *   2. SÉMANTIQUE de date : sait-on ce que la date SIGNIFIE (DLC/DDM…) ? (répond « pourquoi »).
 * Une date fiable (DATE) est NÉCESSAIRE mais NON SUFFISANTE : sans type sémantique supporté,
 * pas de signal amplifié (CR-02 / N5.2 : valeur ≠ type). Frigy ne capture AUCUN type
 * aujourd'hui → ensemble VIDE → zéro signal amplifié (état truthful valide, PAS un échec).
 * Peupler cet ensemble = décision Produit/Attention ultérieure APRÈS acquisition de type
 * (N6-08), jamais « type !== UNKNOWN » (cela auto-autoriserait tout futur type sans décision).
 */
export const AMPLIFIED_PASSIVE_DATE_TYPES = new Set();

export function amplifiedTemporalDays(item, now = new Date()) {
  const s = deriveTemporalState(item, now);
  if (s.authority !== TEMPORAL_AUTHORITY.DATE) return null;        // valeur : DATE nécessaire
  if (!AMPLIFIED_PASSIVE_DATE_TYPES.has(s.dateType)) return null;  // sémantique : type supporté requis
  return s.daysRemaining;
}
