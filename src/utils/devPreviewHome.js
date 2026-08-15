/**
 * DEV-ONLY — scénarios QA pour valider Home sur device sans toucher le compte réel.
 * Jamais actif en production (gardé par __DEV__ dans HomeScreen). Réutilise les
 * primitives Food Language existantes (noms résolus par resolveFoodImage) ; la fixture
 * recette sert uniquement à tester l'architecture — jamais affichée en prod.
 *
 * Modes : 'off'|'A'|'B'|'C'|'empty'|'first'|'emptyReturning'|'lowA'|'lowB'|'lowC'.
 */
export const DEV_HOME_MODE = 'lowA'; // 'off'|'A'|'B'|'C'|'empty'|'first'|'emptyReturning'|'lowA'|'lowB'|'lowC'

function frDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const mk = (over) => ({
  id: `home-qa-${over.name}`,
  family_id: '__dev_home__',
  emoji: '🍽️',
  category: '',
  location: 'Frigo',
  quantity: 1,
  total_units: 1,
  img_url: null,
  ...over,
  dlc: frDate(over.days),
  days_left: over.days,
});

const CAPRESE = {
  name: 'Caprese',
  time: '10 min',
  diff: 'Très facile',
  desc: 'Fraîche, simple et parfaite avec ce que tu as.',
  ingredients: ['Tomates cerises', 'Mozzarella', 'Basilic frais', 'Huile d’olive'],
  saves: '4,50',
  imageQuery: 'caprese salad', // requête EN (utilisée seulement si resultCutout absent)
  // PHOTO VALIDÉE (détourage parfait) — fiable, court-circuite Replicate. La génération auto
  // reste dispo pour les AUTRES recettes ; pour repasser la Caprese en auto, recommenter :
  resultCutout: require('../../assets/home-results/caprese.png'),
};

// Retourne { items, recipes } — `recipes` = override direct pour le hook (pas de réseau).
export function getHomeQAScenario(mode) {
  switch (mode) {
    case 'A': // priorité + gathering + idée réalisable
      return {
        items: [
          mk({ name: 'Tomates cerises', days: 0, price: 3.20 }), // QA Rescue Value → « 3,20€ à sauver »
          mk({ name: 'Mozzarella', days: 6 }),
          mk({ name: 'Basilic frais', days: 3 }),
          mk({ name: 'Huile d’olive', days: 120 }),
          mk({ name: 'Saumon', days: 1 }),
          mk({ name: 'Avocat', days: 3 }),
        ],
        recipes: [CAPRESE],
      };
    case 'B': // priorité présente mais aucune idée fiable
      return {
        items: [
          mk({ name: 'Poulet rôti', days: 0 }),
          mk({ name: 'Saumon', days: 1 }),
          mk({ name: 'Salade verte', days: 2 }),
        ],
        recipes: [], // force l'état B (pas de recette qualifiée)
      };
    case 'C': // rien ne presse
      return {
        items: [
          mk({ name: 'Riz', days: 40 }),
          mk({ name: 'Pâtes', days: 60 }),
          mk({ name: 'Miel', days: 200 }),
        ],
        recipes: [],
      };
    case 'empty':
      return { items: [], recipes: [] };
    case 'first': // FIRST RUN : aucun produit + jamais initialisé (distinct de 'empty')
      return { items: [], recipes: [], firstRun: true };
    case 'emptyReturning': // EMPTY_STOCK : déjà initialisé, stock redevenu vide (≠ First Run)
      return { items: [], recipes: [], firstRun: false };
    case 'lowA': // LOW : 1 produit, aucun signal (ni urgence ni recette). Location QA = Placard
      // (cohérent pour du riz) — override de fixture uniquement, AUCUNE règle métier riz→placard :
      // en production HomeLowStock affiche item.location réel.
      return { items: [mk({ name: 'Riz', days: 40, location: 'Placard' })], recipes: [] };
    case 'lowB': // LOW : 2 produits, 1 urgent (priorité réelle), aucune recette
      return { items: [mk({ name: 'Saumon', days: 1 }), mk({ name: 'Yaourt nature', days: 12 })], recipes: [] };
    case 'lowC': // LOW : 3 produits → priorité + gathering + recette réels (Caprese)
      return {
        items: [
          mk({ name: 'Tomates cerises', days: 1, price: 3.20 }),
          mk({ name: 'Mozzarella', days: 6 }),
          mk({ name: 'Basilic frais', days: 3 }),
        ],
        recipes: [CAPRESE],
      };
    default:
      return null;
  }
}
