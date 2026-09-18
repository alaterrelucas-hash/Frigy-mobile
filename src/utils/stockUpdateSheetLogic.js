/**
 * STOCK UPDATE SHEET — logique PURE de l'UX V2 (aucune I/O, aucun RN, testable en node).
 *
 * REMAINING-FIRST : l'utilisateur assertit d'abord le RESTE approximatif (5 crans → remaining_level). La
 * cause (utilisé / jeté) n'est SOLLICITÉE QUE si le reste = EMPTY (clôture) ; sinon elle reste false/false.
 * UNE TÂCHE / UNE SURFACE / UNE VALIDATION.
 *
 * Vérités d'UX :
 *   - baseline connu (remaining_level) = ÉTAT COURANT, jamais une assertion fraîche ; l'ouverture n'assertit rien ;
 *   - quick-update ne peut sélectionner qu'un niveau STRICTEMENT INFÉRIEUR (une augmentation = correction en fiche) ;
 *   - même niveau = « Rien n'a changé » (no-op), pas un événement ;
 *   - UNKNOWN (baseline null) → aucune valeur pré-sélectionnée, les 5 crans sont sélectionnables ;
 *   - EMPTY révèle deux bascules INDÉPENDANTES (utilisé / jeté) : (f,f)(t,f)(f,t)(t,t) toutes valides ;
 *   - quitter EMPTY réinitialise les causes (aucune fuite d'état causal caché sur une mise à jour non-EMPTY).
 * Les constantes de niveau sont identiques au contrat DB (stockUpdate.js) ; redéfinies ici pour rester sans dépendance.
 */

export const REMAINING_STOPS = [
  { level: 'EMPTY', label: 'Vide', voice: 'Vide' },
  { level: 'QUARTER', label: '¼', voice: 'Un quart' },
  { level: 'HALF', label: 'Moitié', voice: 'Moitié' },
  { level: 'THREE_QUARTERS', label: '¾', voice: 'Trois quarts' },
  { level: 'FULL', label: 'Plein', voice: 'Plein' },
];

const ORDER = REMAINING_STOPS.reduce((m, s, i) => { m[s.level] = i; return m; }, {});
export const isLevel = (l) => Object.prototype.hasOwnProperty.call(ORDER, l);
export const levelOrder = (l) => (isLevel(l) ? ORDER[l] : null);

// Correction directe (fiche) : EMPTY EXCLU — « vide » = clôture causale, pas une correction d'état.
export const CORRECTION_STOPS = REMAINING_STOPS.filter((s) => s.level !== 'EMPTY');

export function remainingLabel(level) {
  if (level == null) return 'Non renseigné';
  const s = REMAINING_STOPS.find((x) => x.level === level);
  return s ? s.label : 'Non renseigné';
}
export function remainingVoice(level) {
  if (level == null) return 'Non renseigné';
  const s = REMAINING_STOPS.find((x) => x.level === level);
  return s ? s.voice : 'Non renseigné';
}

/**
 * isLevelSelectable — quick-update : baseline connu → STRICTEMENT inférieur seulement (le baseline lui-même
 * et tout niveau supérieur sont indisponibles ; l'augmentation appartient à la correction en fiche).
 * baseline UNKNOWN → les 5 crans sont sélectionnables.
 */
export function isLevelSelectable(level, beforeLevel = null) {
  if (!isLevel(level)) return false;
  if (beforeLevel == null) return true;              // UNKNOWN → tout
  if (!isLevel(beforeLevel)) return true;            // baseline non exploitable → ne pas sur-contraindre
  return ORDER[level] < ORDER[beforeLevel];          // STRICTEMENT inférieur
}

/**
 * resolveInitialSelection — état UI INITIAL d'une ouverture INTENTIONNELLE : l'utilisateur a DÉJÀ affirmé le
 * reste sur une autre surface (« Il n'en reste plus » → EMPTY) et ne doit pas le réaffirmer. Ce n'est QU'UNE
 * pré-sélection d'interface : aucune mutation, aucune autorité métier, aucune cause impliquée (used/waste
 * restent false). Sans intention → null (l'ouverture normale n'assertit toujours rien). Une intention non
 * sélectionnable vis-à-vis du baseline retombe à null (jamais de sélection que le CTA refuserait).
 */
export function resolveInitialSelection(initialLevel = null, beforeLevel = null) {
  if (initialLevel == null) return null;
  return isLevelSelectable(initialLevel, beforeLevel) ? initialLevel : null;
}

// La section causale n'apparaît QUE lorsque le reste choisi est EMPTY (clôture).
export const causeVisible = (selectedLevel) => selectedLevel === 'EMPTY';

// Empêche toute fuite d'état causal : hors EMPTY, les déclarations sont forcées à false/false.
export function sanitizeCauses(selectedLevel, usedDeclared, wasteDeclared) {
  if (selectedLevel !== 'EMPTY') return { usedDeclared: false, wasteDeclared: false };
  return { usedDeclared: !!usedDeclared, wasteDeclared: !!wasteDeclared };
}

/**
 * canSubmit — le CTA n'est actif que si une mise à jour EXPLICITE valide existe : un niveau sélectionné,
 * strictement inférieur au baseline connu (ou n'importe lequel si UNKNOWN). La CAUSE n'est JAMAIS requise.
 * L'ouverture / le baseline seul ne suffisent pas (selectedLevel doit être un choix explicite non-null).
 */
export function canSubmit({ selectedLevel, beforeLevel = null } = {}) {
  if (!isLevel(selectedLevel)) return false;
  return isLevelSelectable(selectedLevel, beforeLevel);
}

// Seul EMPTY clôt la ligne.
export const closesRow = (selectedLevel) => selectedLevel === 'EMPTY';

// clientEventId : id STABLE par intention (réutilisé au retry ; nouveau à chaque nouveau submit).
export function makeClientEventId(itemId, nowMs, rand) {
  const r = (rand != null ? rand : Math.random()).toString(36).slice(2, 10);
  const t = nowMs != null ? nowMs : Date.now();
  return `${itemId}:${t}:${r}`;
}
