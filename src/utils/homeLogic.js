/**
 * Home — logique produit pure (déterministe, testable, sans JSX).
 *
 * N6-13 (CR-22) : l'attention temporelle de Home consomme UNIQUEMENT l'autorité canonique N6-04
 * (temporalAuthority), jamais `computeDaysRemaining`/`days_left` brut. Chaque surface est plafonnée à
 * son NIVEAU d'évidence :
 *   - HERO (HomePriorityFocus = intervention AMPLIFIÉE : halo + couleur + urgence) → `amplifiedTemporalDays`
 *     (DATE + type sémantique ∈ allowlist). Allowlist VIDE aujourd'hui → aucun héros temporel réel (silence).
 *   - WATCH (secondaire, neutre) → `passiveTemporalDays` (DATE ou HEURISTIC ancrée) ; NONE/days_left brut exclu.
 * On ne dérive JAMAIS l'attention d'un champ technique ni d'une base UNKNOWN.
 */
import { amplifiedTemporalDays, passiveTemporalDays } from './temporalAuthority';

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

/**
 * Priorité du moment : UN seul item dominant, HERO AMPLIFIÉ. Éligible UNIQUEMENT si l'autorité
 * AMPLIFIÉE existe (`amplifiedTemporalDays != null` : DATE + type sémantique supporté) ET ≤ 4 jours.
 * Allowlist des types amplifiés VIDE aujourd'hui → renvoie TOUJOURS null (aucun héros temporel réel).
 * Déterministe. On ne DOWNGRADE jamais vers strong/passive : le héros est une intervention amplifiée.
 */
export function selectHomePriority(items = [], now = new Date()) {
  const cand = items
    .map((i) => ({ item: i, days: amplifiedTemporalDays(i, now) }))
    .filter((x) => typeof x.days === 'number')
    .sort((a, b) => a.days - b.days);
  if (!cand.length) return null;
  const top = cand[0];
  return top.days <= 4 ? top.item : null;
}

/**
 * À garder à l'œil : jusqu'à 2 items proches (0–7 j), hors priorité et hors gathering, SECONDAIRES et
 * NEUTRES. Éligibilité via `passiveTemporalDays` (DATE ou HEURISTIC ancrée) — jamais `days_left` brut /
 * autorité NONE. Chaque item porte `watchDays` (jour passif autoritaire) pour un affichage neutre côté
 * composant, sans recalcul d'autorité. Ne rivalise jamais avec la priorité (aucune couleur d'alerte).
 */
// Collection Watch ÉLIGIBLE COMPLÈTE (ordre autoritaire, sans plafond) — même prédicat que la Watch :
// passiveTemporalDays ∈ [0,7], hors priorité/gathering, trié par jours croissants. Sert au COMPTE réel
// de débordement (« Voir les X autres »). Ne CHANGE aucun seuil/tri ni la sortie de selectWatchItems.
export function selectWatchEligible(items = [], priority = null, gathering = [], now = new Date()) {
  const excl = new Set([priority?.id, ...gathering.map((g) => g?.id)].filter(Boolean));
  return items
    .map((i) => ({ item: i, days: passiveTemporalDays(i, now) }))
    .filter((x) => typeof x.days === 'number' && x.days >= 0 && x.days <= 7 && !excl.has(x.item.id))
    .sort((a, b) => a.days - b.days)
    .map((x) => ({ ...x.item, watchDays: x.days }));
}
// Home affiche AU PLUS 2 items Watch (décision produit) — les 2 premiers de la collection éligible.
// Le reste vit dans Produits (« Voir les X autres »). Sortie IDENTIQUE à l'historique (≤2, même ordre).
export function selectWatchItems(items = [], priority = null, gathering = [], now = new Date()) {
  return selectWatchEligible(items, priority, gathering, now).slice(0, 2);
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
export function deriveVoice(state, priority, items = [], now = new Date()) {
  if (state === HOME_STATE.EMPTY) return 'Ajoute quelques produits pour que Frigy puisse t’aider.';
  // N6-13 (2.6, CR-22) : État C = aucun héros amplifié. Ce n'est PAS une preuve de calme global
  // (la complétude temporelle du foyer n'est pas modélisée) → SILENCE, jamais « Rien ne presse ».
  if (state === HOME_STATE.C) return '';
  if (!priority) return '';
  // N6-13 : la voix temporelle est une revendication d'attention → elle exige l'autorité AMPLIFIÉE
  // (même palier que le héros). Source = `amplifiedTemporalDays`, jamais `computeDaysRemaining`. La
  // voix n'apparaît qu'avec une priorité (elle-même amplifiée) → cohérence garantie.
  const days = amplifiedTemporalDays(priority, now);
  if (typeof days === 'number' && days < 0) return 'Un produit est à vérifier en priorité aujourd’hui.';
  const bonMoment = items.filter((i) => {
    const d = amplifiedTemporalDays(i, now);
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
// N6-13 : lit le jour AUTORITAIRE amplifié porté par l'objet priorité (`attentionDays`, attaché par la
// couche de sélection). Ne recalcule PAS l'autorité, ne lit AUCUN champ technique brut. N'est consommée
// que pour un héros amplifié-autorisé (garanti par le contrat d'appel).
export function priorityMicroCopy(priority) {
  const days = priority?.attentionDays;
  if (typeof days !== 'number') return '';
  if (days < 0) return 'À vérifier en priorité.';
  if (days === 0) return 'C’est le bon moment.';
  return 'Bientôt à utiliser.';
}
