/**
 * Home — logique produit pure (déterministe, testable, sans JSX).
 * Réutilise la sémantique temporelle canonique de Mon Stock (temporal.js) — aucune
 * palette ni grammaire temporelle parallèle.
 */
import { computeDaysRemaining, getTemporalDescriptor } from './temporal';

// États de Home (Home Master) : A priorité+possibilité · B priorité seule ·
// C rien ne presse · EMPTY stock inexploitable.
export const HOME_STATE = { A: 'A', B: 'B', C: 'C', EMPTY: 'EMPTY' };

// Niveau de RICHESSE du stock (cadre de composition), distinct des SIGNALS (contenu réel).
// CONCEPTUEL — SUFFICIENT = assez de produits DISTINCTS + de signaux réels pour composer la
// Home Active sans cannibalisation artificielle des zones (priorité / gathering / recette /
// watch). LOW = de la matière mais insuffisante pour cette boucle complète. EMPTY = rien.
export const HOME_LEVEL = { EMPTY: 'EMPTY', LOW: 'LOW', SUFFICIENT: 'SUFFICIENT' };
// SEUIL OPÉRATIONNEL V1 (garde-fou + QA) — PAS la définition conceptuelle de SUFFICIENT.
// À terme, remplaçable par un test de composabilité réelle (produits distincts par zone).
export const ACTIVE_MIN = 4;
export function deriveRichnessLevel(items = [], activeMin = ACTIVE_MIN) {
  const n = items.length;
  if (n === 0) return HOME_LEVEL.EMPTY;
  if (n < activeMin) return HOME_LEVEL.LOW;
  return HOME_LEVEL.SUFFICIENT;
}

// Un item est « exploitable » temporellement s'il a des jours connus.
function withDays(items = []) {
  return items
    .map((i) => ({ item: i, days: computeDaysRemaining(i) }))
    .filter((x) => typeof x.days === 'number');
}

/**
 * Priorité du moment : UN seul item dominant. Le plus urgent (dépassé puis J0 puis
 * proche) tant qu'il reste dans la fenêtre d'attention (≤ 4 jours). Sinon null (état C).
 * Déterministe, aucune logique par aliment.
 */
export function selectHomePriority(items = []) {
  const cand = withDays(items).sort((a, b) => a.days - b.days);
  if (!cand.length) return null;
  const top = cand[0];
  return top.days <= 4 ? top.item : null;
}

/**
 * À garder à l'œil : jusqu'à 2 items proches (0–7 j), hors priorité et hors gathering,
 * secondaires. Ne rivalise jamais avec la priorité.
 */
export function selectWatchItems(items = [], priority = null, gathering = []) {
  const excl = new Set([priority?.id, ...gathering.map((g) => g?.id)].filter(Boolean));
  return withDays(items)
    .filter((x) => x.days >= 0 && x.days <= 7 && !excl.has(x.item.id))
    .sort((a, b) => a.days - b.days)
    .slice(0, 2)
    .map((x) => x.item);
}

export function deriveHomeState(items = [], priority = null, best = null) {
  if (!items || items.length === 0) return HOME_STATE.EMPTY;
  if (!priority) return HOME_STATE.C;
  return best ? HOME_STATE.A : HOME_STATE.B;
}

/**
 * Contextual Voice — UNE ligne, factuelle, calme, dérivée du contexte (jamais une
 * phrase codée par aliment, jamais de marketing). Retourne '' quand le silence convient.
 */
// Constructions volontairement sans accord de verbe/pronom sur le nom du produit
// (le nom vient en fin) → robustes au singulier comme au pluriel, sans moteur grammatical.
export function deriveVoice(state, priority, items = []) {
  if (state === HOME_STATE.EMPTY) return 'Ajoute quelques produits pour que Frigy puisse t’aider.';
  if (state === HOME_STATE.C) return 'Rien ne presse aujourd’hui.';
  if (!priority) return '';
  const days = computeDaysRemaining(priority);
  // Master : la voix cadre le MOMENT sans nommer le produit ni répéter le hero (qui,
  // lui, donne nom + « c'est le bon moment » + « Aujourd'hui »). Accord porté par
  // « produit(s) », jamais par le nom de l'aliment → aucune grammaire par aliment.
  if (typeof days === 'number' && days < 0) return 'Un produit est à vérifier en priorité aujourd’hui.';
  const bonMoment = items.filter((i) => {
    const d = computeDaysRemaining(i);
    return typeof d === 'number' && d >= 0 && d <= 1;
  }).length;
  if (typeof days === 'number' && days <= 1) {
    return bonMoment > 1
      ? 'Quelques produits arrivent au bon moment aujourd’hui.'
      : 'Un produit arrive au bon moment aujourd’hui.';
  }
  return 'Un produit sera bientôt à utiliser.';
}

// Overline du bloc Transformation. Cible : « ET SI ON UTILISAIT {déterminant} {nom} ? »
// (Frigy propose la recette comme solution concrète à la priorité affichée au-dessus).
// Le déterminant FR (ce/cette/ces) dépend du GENRE et du NOMBRE — non disponibles de
// façon fiable dans Food Language. On n'invente PAS d'heuristique fragile : dès que la
// donnée grammaticale existera (priority.determiner + priority.displayShort), la phrase
// dynamique s'active ici ; sinon, formulation universelle (aucun terme culpabilisant).
export function transformationOverline(priority) {
  const det = priority?.determiner;     // 'ce' | 'cette' | 'ces' — non fourni aujourd'hui
  const short = priority?.displayShort; // nom court d'affichage — non fourni aujourd'hui
  if (det && short) return `ET SI ON UTILISAIT ${det} ${short} ?`.toUpperCase();
  return 'UNE FAÇON SIMPLE DE L’UTILISER'; // fallback universel — voir BESOIN GRAMMATICAL
}

// Micro-copie sous le nom du hero (Home Master) — agreement-free (ni verbe accordé ni pronom).
export function priorityMicroCopy(priority) {
  const days = computeDaysRemaining(priority);
  if (typeof days !== 'number') return '';
  if (days < 0) return 'À vérifier en priorité.';
  if (days === 0) return 'C’est le bon moment.';
  return 'Bientôt à utiliser.';
}

export { getTemporalDescriptor };
