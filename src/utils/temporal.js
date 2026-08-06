import { parseDlc } from './product';

/**
 * Source de vérité temporelle unique pour l'écran Mon Stock.
 * Calcule les jours restants à la volée depuis `dlc` (date réelle) plutôt
 * que de faire confiance à `days_left`, qui n'est jamais recalculé côté
 * serveur et peut dériver silencieusement de la réalité.
 * `days_left` reste un fallback quand `dlc` est absent ou illisible.
 */
export function computeDaysRemaining(item) {
  if (item?.dlc && item.dlc !== '—') {
    const fromDlc = parseDlc(item.dlc);
    if (fromDlc !== null) return fromDlc;
  }
  if (typeof item?.days_left === 'number') return item.days_left;
  return null;
}

export const TEMPORAL_TIER = {
  PRIORITY: 'priority',
  SOON: 'soon',
  LATER: 'later',
};

export const TIER_LABELS = {
  [TEMPORAL_TIER.PRIORITY]: 'À utiliser en priorité',
  [TEMPORAL_TIER.SOON]: 'À utiliser prochainement',
  [TEMPORAL_TIER.LATER]: 'Plus tard',
};

export function isOverdue(days) {
  return typeof days === 'number' && days < 0;
}

// Priorité : aujourd'hui + dépassé. Prochainement : J+1 à J+4. Plus tard : J+5+ et sans échéance connue.
export function getTemporalTier(days) {
  if (typeof days !== 'number') return TEMPORAL_TIER.LATER;
  if (days <= 0) return TEMPORAL_TIER.PRIORITY;
  if (days <= 4) return TEMPORAL_TIER.SOON;
  return TEMPORAL_TIER.LATER;
}

// Un produit dépassé garde une sémantique dédiée — jamais présenté comme une priorité "normale".
export function getTemporalDescriptor(days) {
  if (typeof days !== 'number') return 'Sans échéance connue';
  if (days < 0) return 'Date dépassée — vérifier';
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Demain';
  return `Dans ${days} jours`;
}

// Rouge réservé au critique/dépassé, orange à l'attention temporelle (J0 à J+4), neutre au-delà.
export function getTemporalColorKey(days) {
  if (typeof days !== 'number') return 'neutral';
  if (days < 0) return 'critical';
  if (days <= 4) return 'attention';
  return 'neutral';
}
