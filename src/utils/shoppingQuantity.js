/**
 * N6-15 (CR-04) — AUTORITÉ DE QUANTITÉ COURSES. PUR, sans React ni SDK.
 *
 * `shopping_items.quantity` signifie EXCLUSIVEMENT : nombre/compte DÉSIRÉ dans la liste d'achat.
 * Ce n'est PAS : quantité au foyer, quantité achetée, grammes, litres, unités d'un pack, ni
 * suffisance pour une recette. Entier >= 1. AUCUNE unité physique inventée.
 *
 * La colonne DB est historiquement une STRING ('1'). On lit/écrit en string, SANS migration
 * (normalisation bornée). Les anciennes lignes '1' restent lisibles. Cette quantité n'active
 * AUCUN low-stock, AUCUNE sufficiency recette, AUCUNE économie, AUCUN score, AUCUNE quantité Stock.
 */

// Fait DB vérifié : `shopping_items.quantity` est TEXT, default '×1' ; le runtime écrit aussi '1'.
// On retire un préfixe ×/x + espaces bornés AVANT lecture, pour tolérer '1' | '×1' | 'x3' | ' ×2 '.
function stripQtyPrefix(raw) {
  return String(raw ?? '').trim().replace(/^[×x]\s*/i, '').trim();
}

// Lecture tolérante (legacy '1', default '×1', number, illisible) → entier d'AFFICHAGE >= 1.
// Une ligne de liste implique « au moins 1 désiré » → jamais < 1, jamais NaN.
export function readShoppingQty(raw) {
  const s = typeof raw === 'number' ? String(raw) : stripQtyPrefix(raw);
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

// Validation d'une valeur EXPLICITE avant persistance → entier >= 1, sinon `null` (= NE PAS persister).
// vide / non-numérique / signe / décimal / notation scientifique / 0 / négatif / NaN → null.
// Tolère le préfixe ×/x (formes DB) mais JAMAIS un nombre malformé. Aucune coercition silencieuse.
export function parseShoppingQty(raw) {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw >= 1 ? raw : null; // 2.5, NaN, 0, -3 → null
  const s = stripQtyPrefix(raw);
  if (!/^\d+$/.test(s)) return null; // rejette '', '-1', '2.5', '1e3', 'abc', ' '
  const i = parseInt(s, 10);
  return i >= 1 ? i : null; // '0' → null
}

export function incShoppingQty(n) { return readShoppingQty(n) + 1; }
export function decShoppingQty(n) { return Math.max(1, readShoppingQty(n) - 1); }

// Persistance : la colonne est une string → on écrit une STRING. Jamais de changement de type DB.
export function toStoredShoppingQty(n) { return String(readShoppingQty(n)); }

// Présentation NEUTRE : « ×N ». Jamais d'unité physique (kg / L / g / pièces / unités).
export function formatShoppingQty(n) { return `×${readShoppingQty(n)}`; }
