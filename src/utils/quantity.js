// Formulation honnête de la quantité — n'affiche jamais une unité (g, L...) non
// réellement connue. Le modèle actuel ne stocke que quantity/total_units (comptage
// d'unités) ; `unit` existe en base mais n'est aujourd'hui jamais renseigné.
export function formatQuantityLabel(item) {
  const total = item?.total_units || 1;
  const qty = item?.quantity ?? total;
  const unit = (item?.unit || '').trim();

  if (unit) return total > 1 ? `${qty}/${total} ${unit}` : `${qty} ${unit}`;
  if (total > 1) return `${qty}/${total} unités`;
  return '1 unité';
}
