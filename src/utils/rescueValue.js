/**
 * Rescue Value — valeur économique POTENTIELLE d'un produit actuellement à risque
 * (« X€ À SAUVER »). C'est un montant À SAUVER, jamais un montant « sauvé » : aucune
 * économie n'est comptabilisée ici (voir architecture future « à sauver » → confirmation
 * → « sauvés », NON développée dans cette passe).
 *
 * Données réellement disponibles sur un item (table `items`) :
 *   - price       : prix UNITAIRE réel (extrait du ticket via ScanScreen), souvent null ;
 *   - quantity    : nombre d'unités RESTANTES (défaut 1) ;
 *   - total_units : taille initiale du lot (non requise ici) ;
 *   - category    : mappe sur CATEGORY_PRICE (estimation) quand price est absent.
 *
 * Formule : rescueValue = valeurUnitaire × quantité — UNIQUEMENT si la quantité est KNOWN.
 *   valeurUnitaire = price (fiable) sinon CATEGORY_PRICE[category] (approximation
 *   explicitement documentée). Si aucune valeur fiable → null (ne JAMAIS afficher un faux montant).
 *
 * N6-07 (CR-04, clôture terminale) : `valeurUnitaire` est PER-UNIT — `price` = prix UNITAIRE réel
 *   du ticket (`unit_price`, ScanScreen), sinon CATEGORY_PRICE = estimation PAR UNITÉ. Un TOTAL de
 *   cohorte dépend donc du nombre d'unités → il exige une quantité KNOWN. Autorité UNKNOWN
 *   (toujours aujourd'hui, aucune provenance persistée) → AUCUN montant : ni `unit` seul (= quantité
 *   IMPLICITE de 1 ; une cohorte représentée n'est PAS un exemplaire), ni 0, ni ~. UNKNOWN ≠ 1.
 *   Le montant revient dès que N6-08 fournit une quantité KNOWN (units). L'ACTION Rescue reste
 *   portée par la priorité TEMPORELLE (indépendante de l'argent) ; « X€ à sauver » est un affichage
 *   OPTIONNEL déjà gaté (HomePriorityFocus : `{!!formatEuro(rescueValue) && …}`). CR-11/CR-24
 *   (sens de « à sauver », provenance/precision de price, qualité de CATEGORY_PRICE) restent séparés.
 */
import { CATEGORY_PRICE } from '../config/constants';
import { deriveQuantityState, QUANTITY_AUTHORITY } from './quantity';

function unitValue(item) {
  if (item && typeof item.price === 'number' && item.price > 0) return item.price; // prix réel
  const cat = item ? CATEGORY_PRICE[item.category] : null;                          // sinon estimation catégorie
  if (typeof cat === 'number' && cat > 0) return cat;
  return null;
}

// Renvoie un nombre (arrondi 2 décimales, > 0) ou null si aucune estimation fiable.
// N6-08 (§41, garde de compatibilité) : l'autorité de QUANTITÉ (KNOWN) est NÉCESSAIRE mais NON
// SUFFISANTE pour un montant. Un « X€ à sauver » exige une autorité MONÉTAIRE INDÉPENDANTE
// (provenance/précision du prix — CR-11/CR-24), qui n'est PAS implémentée. Donc, même quand N6-08
// rend une quantité KNOWN, AUCUN montant n'est autorisé. On ne réactive JAMAIS l'argent par la seule
// autorité de quantité. (Le calcul unit×units est conservé pour le jour où l'autorité monétaire
// existera ; il reste inatteignable tant que hasMonetaryAuthority renvoie false.)
function hasMonetaryAuthority(/* item */) {
  return false; // CR-11/CR-24 non implémenté → aucune autorité monétaire indépendante
}

export function computeRescueValue(item) {
  if (!item) return null;
  if (!hasMonetaryAuthority(item)) return null; // KNOWN quantité ≠ argent autorisé (N6-08)
  const unit = unitValue(item);
  if (unit == null) return null;
  const q = deriveQuantityState(item);
  if (q.authority !== QUANTITY_AUTHORITY.KNOWN || !(typeof q.units === 'number' && q.units > 0)) return null;
  const raw = unit * q.units;
  if (!isFinite(raw) || raw <= 0) return null;
  return Math.round(raw * 100) / 100; // arrondi monétaire (quantité KNOWN + autorité monétaire)
}

// Format FR — RÈGLE ABSOLUE : AUCUNE espace avant € (2€, 0,80€, 3,20€, 12,50€, 127€).
// Entier → sans décimales ; sinon 2 décimales, virgule. null si valeur inexploitable.
export function formatEuro(value) {
  if (typeof value !== 'number' || !isFinite(value) || value <= 0) return null;
  const r = Math.round(value * 100) / 100;
  return Number.isInteger(r) ? `${r}€` : `${r.toFixed(2).replace('.', ',')}€`;
}

// Libellé VoiceOver, indépendant du glyphe compact : « Valeur à sauver : 3 euros et 20 centimes ».
export function rescueValueSpokenLabel(value) {
  if (typeof value !== 'number' || !isFinite(value) || value <= 0) return null;
  const r = Math.round(value * 100) / 100;
  const euros = Math.floor(r);
  const cents = Math.round((r - euros) * 100);
  let money;
  if (euros > 0 && cents > 0) money = `${euros} euro${euros > 1 ? 's' : ''} et ${cents} centime${cents > 1 ? 's' : ''}`;
  else if (euros > 0) money = `${euros} euro${euros > 1 ? 's' : ''}`;
  else money = `${cents} centime${cents > 1 ? 's' : ''}`;
  return `Valeur à sauver : ${money}`;
}
