/**
 * N6-08 — Provenance d'assertion FORWARD (CR-03). Distingue une ASSERTION EXPLICITE de
 * l'utilisateur d'un DÉFAUT technique ou d'une valeur MACHINE, de façon PERSISTABLE (colonne JSONB
 * `assertion_provenance`, migration 20260815). Autorité PAR ASSERTION — jamais une autorité
 * d'item globale, jamais un score de confiance numérique, jamais un total foyer, jamais une
 * inférence de champ manquant.
 *
 * DOCTRINE : la MÉTHODE de capture est une LIGNÉE, PAS une autorité. Un défaut reste UNKNOWN même
 * si sa provenance (« c'est un défaut ») est connue. Absence de provenance (legacy) = aucune preuve
 * nouvelle = comportement N6-01/N6-07 inchangé.
 */

export const CAPTURE_METHOD = {
  BARCODE: 'BARCODE',
  RECEIPT: 'RECEIPT',
  PHOTO: 'PHOTO',
  HOME_HAVE: 'HOME_HAVE',
  MANUAL: 'MANUAL',
};

export const PROV_AUTHORITY = {
  DIRECT: 'DIRECT',       // l'action de l'utilisateur EST l'assertion
  CONFIRMED: 'CONFIRMED', // candidat machine présenté, revu, explicitement accepté
  DERIVED: 'DERIVED',     // machine / heuristique non confirmée
  UNKNOWN: 'UNKNOWN',     // aucune assertion suffisante
};

export const PROV_DATE_TYPE = { DLC: 'DLC', DDM: 'DDM', UNKNOWN: 'UNKNOWN' };

const KNOWNISH = new Set([PROV_AUTHORITY.DIRECT, PROV_AUTHORITY.CONFIRMED]);

/**
 * Construit l'objet de provenance à PERSISTER, à partir de l'ÉTAT D'INTERACTION réel au moment du
 * save. Ne persiste JAMAIS une autorité qu'une interaction explicite n'a pas établie.
 * @param {object} p
 *  - captureMethod        : CAPTURE_METHOD
 *  - quantityTouched      : true si l'utilisateur a explicitement fixé/édité la quantité
 *  - dateEnteredByUser    : true si la valeur de date vient d'une saisie/édition utilisateur
 *  - dateFromMachine      : true si une date a été proposée par une machine (OCR/AI) non éditée
 *  - dateTypeChoice       : 'DLC' | 'DDM' | undefined — choix EXPLICITE du type (sinon UNKNOWN)
 */
export function buildAssertionProvenance(p = {}) {
  const {
    captureMethod = null,
    quantityTouched = false,
    dateEnteredByUser = false,
    dateFromMachine = false,
    dateTypeChoice,
  } = p;

  const quantity = quantityTouched
    ? { authority: PROV_AUTHORITY.DIRECT, source: 'USER_EDIT' }
    : { authority: PROV_AUTHORITY.UNKNOWN, source: 'DEFAULT' };

  let dateValueAuthority = PROV_AUTHORITY.UNKNOWN;
  if (dateEnteredByUser) dateValueAuthority = PROV_AUTHORITY.DIRECT;
  else if (dateFromMachine) dateValueAuthority = PROV_AUTHORITY.DERIVED; // machine non confirmée

  const dateType = (dateTypeChoice === PROV_DATE_TYPE.DLC || dateTypeChoice === PROV_DATE_TYPE.DDM)
    ? { value: dateTypeChoice, authority: PROV_AUTHORITY.DIRECT }
    : { value: PROV_DATE_TYPE.UNKNOWN, authority: PROV_AUTHORITY.UNKNOWN };

  return {
    version: 1,
    captureMethod,
    quantity,
    dateValue: { authority: dateValueAuthority },
    dateType,
  };
}

// Fusion LOSSLESS et IMMUABLE d'une provenance existante avec un patch d'assertion (correction
// Stock edit). PATCHE UNIQUEMENT le sous-arbre changé (ex. dateValue) ; PRÉSERVE les autres
// (quantity, dateType, captureMethod) ET toute clé future inconnue (spread top-level). N'invente
// aucune autorité pour les assertions non corrigées : « corrige seulement ce que l'utilisateur a
// corrigé ». `existing` null/legacy → base minimale {version:1} (les autres assertions restent
// absentes → UNKNOWN via les readers).
export function mergeAssertionProvenance(existing, patch = {}) {
  const base = (existing && typeof existing === 'object') ? existing : { version: 1 };
  return { ...base, version: base.version || 1, ...patch };
}

// Patch de correction de VALEUR de date (utilisateur édite la date en Stock edit) → DIRECT.
export function withDateValueCorrection(existing) {
  return mergeAssertionProvenance(existing, { dateValue: { authority: PROV_AUTHORITY.DIRECT } });
}

// ── READERS (consommés par les helpers d'autorité ; tolérants au null/legacy) ──

// Quantité : autorité explicite (DIRECT/CONFIRMED) présente ? (sinon null → UNKNOWN legacy)
export function quantityAssertedKnown(item) {
  const a = item && item.assertion_provenance && item.assertion_provenance.quantity;
  return !!(a && KNOWNISH.has(a.authority));
}

// Valeur de date : provenance présente ET NON autoritaire (machine/inconnue) → true (à ne pas
// promouvoir en DATE). Legacy (pas de provenance) → false (comportement N6-01 inchangé).
export function dateValueIsNonAuthoritative(item) {
  const prov = item && item.assertion_provenance;
  if (!prov || !prov.dateValue) return false; // legacy → autorité N6-01 telle quelle
  return !KNOWNISH.has(prov.dateValue.authority);
}

// Type de date EXPLICITE (DLC/DDM avec autorité DIRECT/CONFIRMED) ; sinon null → UNKNOWN.
export function explicitDateType(item) {
  const dt = item && item.assertion_provenance && item.assertion_provenance.dateType;
  if (dt && KNOWNISH.has(dt.authority) && (dt.value === PROV_DATE_TYPE.DLC || dt.value === PROV_DATE_TYPE.DDM)) {
    return dt.value;
  }
  return null;
}
