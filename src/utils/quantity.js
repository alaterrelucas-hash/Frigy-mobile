// N6-07 — Autorité de QUANTITÉ (CR-04). Un NUMÉRO TECHNIQUE n'est PAS une assertion de quantité.
//
// Réalité du modèle actuel : `quantity` et `total_units` proviennent soit d'un défaut `|| 1`
// (capture receipt / photo / ajout manuel), soit d'un `packUnits` code-barres AUTOMATISÉ
// (OpenFoodFacts). AUCUN champ de provenance persistée ne distingue une quantité RÉELLEMENT
// affirmée par l'utilisateur d'un défaut ou d'un automatisme (`unit` existe en base mais n'est
// jamais renseigné). Donc, pour toute ligne actuelle, l'autorité de quantité exacte est UNKNOWN.
//
// UNKNOWN ≠ zéro, ≠ un, ≠ absence : la LIGNE elle-même atteste la présence d'une COHORTE
// REPRÉSENTÉE (représentation ≠ total foyer). Deux lignes de même identité = deux cohortes, jamais
// sommées. La restauration d'une autorité KNOWN (provenance de capture / quantité affirmée durable)
// relève de N6-08 — jamais devinée ici, jamais reconstruite depuis un nombre non prouvé.
export const QUANTITY_AUTHORITY = { KNOWN: 'KNOWN', UNKNOWN: 'UNKNOWN' };

// deriveQuantityState(item) → { subject, authority, units }
//   subject   : 'REPRESENTED_COHORT' (jamais un total foyer)
//   authority : 'KNOWN' | 'UNKNOWN' — aujourd'hui toujours UNKNOWN (aucune provenance persistée)
//   units     : number | null       — jamais un défaut/zéro/un inventé ; null tant qu'UNKNOWN
// Pas de score de confiance numérique, pas d'ontologie d'unités, pas de conversion.
export function deriveQuantityState(item) {
  // N6-08 : autorité KNOWN UNIQUEMENT si une provenance persistée (assertion_provenance.quantity)
  // atteste une assertion EXPLICITE (DIRECT/CONFIRMED) ET que `quantity` est un nombre positif.
  // Sinon UNKNOWN : legacy (pas de provenance), défaut technique, ou valeur machine non confirmée.
  // La méthode de capture n'est PAS une autorité ; un défaut reste UNKNOWN. Cohorte représentée —
  // jamais total foyer, jamais sommée entre lignes.
  const a = item && item.assertion_provenance && item.assertion_provenance.quantity;
  const asserted = !!(a && (a.authority === 'DIRECT' || a.authority === 'CONFIRMED'));
  const units = item && typeof item.quantity === 'number' ? item.quantity : null;
  if (asserted && typeof units === 'number' && units > 0) {
    return { subject: 'REPRESENTED_COHORT', authority: QUANTITY_AUTHORITY.KNOWN, units };
  }
  return { subject: 'REPRESENTED_COHORT', authority: QUANTITY_AUTHORITY.UNKNOWN, units: null };
}

// Libellé quantité affiché — UNIQUEMENT si l'autorité est KNOWN (jamais aujourd'hui). Sinon `null` :
// la présence de la ligne suffit à communiquer la cohorte représentée. On n'affiche donc JAMAIS un
// faux « 1 unité » (défaut technique) ni un « N/M » bâti sur un dénominateur non prouvé. Les
// consommateurs sont déjà gardés (`{qtyLabel && …}`), donc `null` = simple silence, pas de crash.
export function formatQuantityLabel(item) {
  const q = deriveQuantityState(item);
  if (q.authority !== QUANTITY_AUTHORITY.KNOWN || q.units == null) return null;
  const unit = (item?.unit || '').trim();
  return unit ? `${q.units} ${unit}` : `${q.units} unité${q.units > 1 ? 's' : ''}`;
}
