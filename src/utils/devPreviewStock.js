/**
 * DEV-ONLY — dataset de démonstration pour comparer visuellement Mon Stock
 * au Master Screen. N'existe qu'en local :
 *  - jamais écrit dans Supabase (ids factices, aucun insert/update réel)
 *  - jamais actif en production (gardé par `__DEV__`, toujours false en build release)
 *  - jamais de migration, jamais de modification du compte réel
 *
 * Base 7 items (2/3/2) volontairement identique au Master pour neutraliser le
 * biais de volume — Priority/Soon restent strictement inchangés. Les lots de
 * primitives Food Language (LOT 01, LOT 02, LOTS 03-11) sont ajoutés
 * exclusivement en "Plus tard" pour audit visuel, sans perturber la
 * calibration Priority/Soon déjà validée. Raison de test explicite : revue
 * perceptuelle par lot vs Golden Set.
 *
 * Pour désactiver : mettre DEV_PREVIEW_STOCK_ENABLED à false, ou supprimer ce
 * fichier + son usage dans FridgeScreen.js.
 *
 * Les représentations viennent désormais du registry central Food Language via
 * `primitive: '<slug>'` (getPrimitive) — plus aucun require() d'asset ici, plus
 * aucun ratio saisi à la main. Le rendu du Golden Set reste strictement identique :
 * chaque item désigne EXPLICITEMENT sa primitive, la résolution floue par nom
 * (resolveFoodImage) ne concerne que les produits réels.
 */

import { getPrimitive } from './foodLanguage';

export const DEV_PREVIEW_STOCK_ENABLED = true;

// Deux jeux de démonstration distincts, sans duplication d'assets (les deux passent
// par le registry Food Language) :
//   'stress' — ~192 produits (tous en Frigo) : stress test de scroll/rendu.
//   'qa'     — ~55 produits crédibles répartis Frigo / Congélateur / Placard :
//              QA visuelle des 3 espaces et du Priority-first dans chacun.
// Basculer ici pour la revue voulue.
export const DEV_PREVIEW_MODE = 'qa'; // 'stress' | 'qa'

function frDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Fabrique d'item preview partagée par les deux jeux (aucune duplication).
// `primitive` = clé canonique dans le registry Food Language → asset + ratio réel
// (largeur/hauteur intrinsèque), métadonnée morphologique générique, jamais un nom/id.
function mk(over) {
  const prim = over.primitive ? getPrimitive(over.primitive) : null;
  return {
    family_id: '__dev_preview__',
    consumed: false,
    wasted: false,
    opened: false,
    location: 'Frigo',
    quantity: 1,
    total_units: 1,
    unit: '',
    category: '',
    brand: '',
    img_url: null,
    nutri_grade: null,
    price: null,
    ...over,
    // `days` : même forme que les items réels (App.js mappe `days: i.days_left`).
    // La liste utilise computeDaysRemaining, mais la fiche détail lit `item.days`
    // directement — sans ce champ, la fiche d'un item preview affichait « J-undefined ».
    days: over.days_left,
    localImage: prim ? prim.image : null,
    localImageRatio: prim ? prim.ratio : null,
    // id explicite possible (over.id) pour garantir l'unicité quand une même primitive
    // apparaît dans plusieurs espaces (QA) ; sinon dérivé du nom.
    id: over.id || `preview-${over.name}`,
  };
}

export function getDevPreviewItems() {
  return [
    // À utiliser en priorité — 2
    mk({ name: 'Tomates cerises', emoji: '🍅', dlc: frDate(0), days_left: 0, primitive: 'tomates-cerises' }),
    mk({ name: 'Poulet rôti',     emoji: '🍗', dlc: frDate(0), days_left: 0, primitive: 'poulet-roti' }),
    // À utiliser prochainement — 3
    mk({ name: 'Yaourt nature',   emoji: '🥛', dlc: frDate(1), days_left: 1, primitive: 'yaourt-nature' }),
    mk({ name: 'Avocat',          emoji: '🥑', dlc: frDate(3), days_left: 3, primitive: 'avocat' }),
    mk({ name: 'Courgette',       emoji: '🥒', dlc: frDate(4), days_left: 4, primitive: 'courgette' }),
    // Plus tard — 2 (Master) + LOT 01 (11 primitives, audit visuel uniquement)
    mk({ name: 'Lait entier',     emoji: '🥛', dlc: frDate(7),  days_left: 7,  primitive: 'lait-entier' }),
    mk({ name: 'Fromage râpé',    emoji: '🧀', dlc: frDate(9),  days_left: 9, primitive: 'fromage-rape-emmental' }),
    mk({ name: 'Crème fraîche',   emoji: '🥣', dlc: frDate(10), days_left: 10, primitive: 'creme-fraiche' }),
    mk({ name: 'Mozzarella',      emoji: '🧀', dlc: frDate(11), days_left: 11, primitive: 'mozzarella' }),
    mk({ name: 'Jambon',          emoji: '🍖', dlc: frDate(12), days_left: 12, primitive: 'jambon' }),
    mk({ name: 'Lardons',         emoji: '🥓', dlc: frDate(13), days_left: 13, primitive: 'lardons' }),
    mk({ name: 'Saucisses',       emoji: '🌭', dlc: frDate(14), days_left: 14, primitive: 'saucisses' }),
    mk({ name: 'Steak haché',     emoji: '🥩', dlc: frDate(15), days_left: 15, primitive: 'steak-hache' }),
    mk({ name: 'Poulet cru',      emoji: '🍗', dlc: frDate(16), days_left: 16, primitive: 'poulet-cru' }),
    mk({ name: 'Saumon',          emoji: '🐟', dlc: frDate(17), days_left: 17, primitive: 'saumon' }),
    mk({ name: 'Poisson blanc',   emoji: '🐟', dlc: frDate(18), days_left: 18, primitive: 'poisson-blanc' }),
    mk({ name: 'Champignons',     emoji: '🍄', dlc: frDate(19), days_left: 19, primitive: 'champignons' }),
    mk({ name: 'Salade',          emoji: '🥬', dlc: frDate(20), days_left: 20, primitive: 'salade' }),
    // LOT 02 (12 primitives, audit visuel uniquement)
    mk({ name: 'Œufs',            emoji: '🥚', dlc: frDate(21), days_left: 21, primitive: 'oeufs' }),
    mk({ name: 'Beurre',          emoji: '🧈', dlc: frDate(22), days_left: 22, primitive: 'beurre' }),
    mk({ name: 'Emmental',        emoji: '🧀', dlc: frDate(23), days_left: 23, primitive: 'emmental' }),
    mk({ name: 'Camembert',       emoji: '🧀', dlc: frDate(24), days_left: 24, primitive: 'camembert' }),
    mk({ name: 'Chèvre',          emoji: '🧀', dlc: frDate(25), days_left: 25, primitive: 'chevre' }),
    mk({ name: 'Bacon',           emoji: '🥓', dlc: frDate(26), days_left: 26, primitive: 'bacon' }),
    mk({ name: 'Dinde',           emoji: '🍖', dlc: frDate(27), days_left: 27, primitive: 'dinde' }),
    mk({ name: 'Viande hachée',   emoji: '🥩', dlc: frDate(28), days_left: 28, primitive: 'viande-hachee' }),
    mk({ name: 'Crevettes',       emoji: '🦐', dlc: frDate(29), days_left: 29, primitive: 'crevettes' }),
    mk({ name: 'Carottes',        emoji: '🥕', dlc: frDate(30), days_left: 30, primitive: 'carottes' }),
    mk({ name: 'Poivron rouge',   emoji: '🫑', dlc: frDate(31), days_left: 31, primitive: 'poivron-rouge' }),
    mk({ name: 'Brocoli',         emoji: '🥦', dlc: frDate(32), days_left: 32, primitive: 'brocoli' }),
    // LOTS 03-11 (95 primitives, audit visuel uniquement)
    mk({ name: 'Citron',          emoji: '🍋', dlc: frDate(33), days_left: 33, primitive: 'citron' }),
    mk({ name: 'Citron vert',     emoji: '🍈', dlc: frDate(34), days_left: 34, primitive: 'citron-vert' }),
    mk({ name: 'Orange',          emoji: '🍊', dlc: frDate(35), days_left: 35, primitive: 'orange' }),
    mk({ name: 'Pomme',           emoji: '🍎', dlc: frDate(36), days_left: 36, primitive: 'pomme' }),
    mk({ name: 'Poire',           emoji: '🍐', dlc: frDate(37), days_left: 37, primitive: 'poire' }),
    mk({ name: 'Raisins',         emoji: '🍇', dlc: frDate(38), days_left: 38, primitive: 'raisins' }),
    mk({ name: 'Myrtilles',       emoji: '🫐', dlc: frDate(39), days_left: 39, primitive: 'myrtilles' }),
    mk({ name: 'Pâtes',           emoji: '🍝', dlc: frDate(40), days_left: 40, primitive: 'pates' }),
    mk({ name: 'Riz',             emoji: '🍚', dlc: frDate(41), days_left: 41, primitive: 'riz' }),
    mk({ name: 'Pommes de terre', emoji: '🥔', dlc: frDate(42), days_left: 42, primitive: 'pommes-de-terre' }),
    mk({ name: 'Oignon',          emoji: '🧅', dlc: frDate(43), days_left: 43, primitive: 'oignon' }),
    mk({ name: 'Ail',             emoji: '🧄', dlc: frDate(44), days_left: 44, primitive: 'ail' }),
    mk({ name: 'Farine',          emoji: '🌾', dlc: frDate(45), days_left: 45, primitive: 'farine' }),
    mk({ name: 'Sucre',           emoji: '🍬', dlc: frDate(46), days_left: 46, primitive: 'sucre' }),
    mk({ name: 'Lentilles',       emoji: '🫘', dlc: frDate(47), days_left: 47, primitive: 'lentilles' }),
    mk({ name: 'Pois chiches',    emoji: '🫘', dlc: frDate(48), days_left: 48, primitive: 'pois-chiches' }),
    mk({ name: 'Haricots rouges', emoji: '🫘', dlc: frDate(49), days_left: 49, primitive: 'haricots-rouges' }),
    mk({ name: 'Thon en conserve',emoji: '🥫', dlc: frDate(50), days_left: 50, primitive: 'thon-en-conserve' }),
    mk({ name: 'Concentré de tomates', emoji: '🥫', dlc: frDate(51), days_left: 51, primitive: 'concentre-de-tomates' }),
    mk({ name: "Huile d'olive",   emoji: '🫒', dlc: frDate(52), days_left: 52, primitive: 'huile-d-olive' }),
    mk({ name: 'Miel',            emoji: '🍯', dlc: frDate(53), days_left: 53, primitive: 'miel' }),
    mk({ name: 'Cornichons',      emoji: '🥒', dlc: frDate(54), days_left: 54, primitive: 'cornichons' }),
    mk({ name: 'Échalote',        emoji: '🧅', dlc: frDate(55), days_left: 55, primitive: 'echalote' }),
    mk({ name: 'Gingembre',       emoji: '🫚', dlc: frDate(56), days_left: 56, primitive: 'gingembre' }),
    mk({ name: 'Patate douce',    emoji: '🍠', dlc: frDate(57), days_left: 57, primitive: 'patate-douce' }),
    mk({ name: 'Courge butternut',emoji: '🎃', dlc: frDate(58), days_left: 58, primitive: 'courge-butternut' }),
    mk({ name: 'Concombre',       emoji: '🥒', dlc: frDate(60), days_left: 60, primitive: 'concombre' }),
    mk({ name: 'Aubergine',       emoji: '🍆', dlc: frDate(61), days_left: 61, primitive: 'aubergine' }),
    mk({ name: 'Tomate',          emoji: '🍅', dlc: frDate(62), days_left: 62, primitive: 'tomate' }),
    mk({ name: 'Mayonnaise',      emoji: '🥫', dlc: frDate(63), days_left: 63, primitive: 'mayonnaise' }),
    mk({ name: 'Ketchup',         emoji: '🍅', dlc: frDate(64), days_left: 64, primitive: 'ketchup' }),
    mk({ name: 'Moutarde',        emoji: '🌭', dlc: frDate(65), days_left: 65, primitive: 'moutarde' }),
    mk({ name: 'Sauce blanche',   emoji: '🥣', dlc: frDate(66), days_left: 66, primitive: 'sauce-blanche' }),
    mk({ name: 'Yaourt aromatisé',emoji: '🥛', dlc: frDate(67), days_left: 67, primitive: 'yaourt-aromatise' }),
    mk({ name: 'Fromage blanc',   emoji: '🥣', dlc: frDate(68), days_left: 68, primitive: 'fromage-blanc' }),
    mk({ name: 'Fromage frais',   emoji: '🧀', dlc: frDate(69), days_left: 69, primitive: 'fromage-frais' }),
    mk({ name: 'Pesto',           emoji: '🌿', dlc: frDate(70), days_left: 70, primitive: 'pesto' }),
    mk({ name: 'Jus de citron',   emoji: '🍋', dlc: frDate(71), days_left: 71, primitive: 'jus-de-citron' }),
    mk({ name: 'Herbes fraîches', emoji: '🌿', dlc: frDate(72), days_left: 72, primitive: 'herbes-fraiches' }),
    mk({ name: 'Olives vertes',   emoji: '🫒', dlc: frDate(73), days_left: 73, primitive: 'olives-vertes' }),
    mk({ name: 'Jambon cru',      emoji: '🍖', dlc: frDate(74), days_left: 74, primitive: 'jambon-cru' }),
    mk({ name: 'Salami',          emoji: '🍖', dlc: frDate(75), days_left: 75, primitive: 'salami' }),
    mk({ name: 'Chorizo',         emoji: '🌭', dlc: frDate(76), days_left: 76, primitive: 'chorizo' }),
    mk({ name: 'Pâté',            emoji: '🥫', dlc: frDate(77), days_left: 77, primitive: 'pate' }),
    mk({ name: 'Rillettes',       emoji: '🥫', dlc: frDate(78), days_left: 78, primitive: 'rillettes' }),
    mk({ name: 'Saumon fumé',     emoji: '🐟', dlc: frDate(79), days_left: 79, primitive: 'saumon-fume' }),
    mk({ name: 'Truite fumée',    emoji: '🐟', dlc: frDate(80), days_left: 80, primitive: 'truite-fumee' }),
    mk({ name: 'Surimi',          emoji: '🦀', dlc: frDate(81), days_left: 81, primitive: 'surimi' }),
    mk({ name: 'Tofu nature',     emoji: '🧊', dlc: frDate(82), days_left: 82, primitive: 'tofu-nature' }),
    mk({ name: 'Feta',            emoji: '🧀', dlc: frDate(83), days_left: 83, primitive: 'feta' }),
    mk({ name: 'Amandes',         emoji: '🌰', dlc: frDate(84), days_left: 84, primitive: 'amandes' }),
    mk({ name: 'Noix',            emoji: '🌰', dlc: frDate(85), days_left: 85, primitive: 'noix' }),
    mk({ name: 'Noisettes',       emoji: '🌰', dlc: frDate(86), days_left: 86, primitive: 'noisettes' }),
    mk({ name: 'Noix de cajou',   emoji: '🌰', dlc: frDate(87), days_left: 87, primitive: 'noix-de-cajou' }),
    mk({ name: 'Raisins secs',    emoji: '🍇', dlc: frDate(88), days_left: 88, primitive: 'raisins-secs' }),
    mk({ name: 'Dattes',          emoji: '🌴', dlc: frDate(89), days_left: 89, primitive: 'dattes' }),
    mk({ name: 'Cranberries séchées', emoji: '🍒', dlc: frDate(90), days_left: 90, primitive: 'cranberries-sechees' }),
    mk({ name: 'Graines de chia', emoji: '🌱', dlc: frDate(91), days_left: 91, primitive: 'graines-de-chia' }),
    mk({ name: 'Graines de lin',  emoji: '🌱', dlc: frDate(92), days_left: 92, primitive: 'graines-de-lin' }),
    mk({ name: 'Graines de tournesol', emoji: '🌻', dlc: frDate(93), days_left: 93, primitive: 'graines-de-tournesol' }),
    mk({ name: "Flocons d'avoine",emoji: '🌾', dlc: frDate(94), days_left: 94, primitive: 'flocons-d-avoine' }),
    mk({ name: 'Muesli',          emoji: '🥣', dlc: frDate(95), days_left: 95, primitive: 'muesli' }),
    mk({ name: 'Sel',             emoji: '🧂', dlc: frDate(96), days_left: 96, primitive: 'sel' }),
    mk({ name: 'Poivre noir',     emoji: '⚫️', dlc: frDate(97), days_left: 97, primitive: 'poivre-noir' }),
    mk({ name: 'Paprika',         emoji: '🌶️', dlc: frDate(98), days_left: 98, primitive: 'paprika' }),
    mk({ name: 'Cumin moulu',     emoji: '🌿', dlc: frDate(99), days_left: 99, primitive: 'cumin-moulu' }),
    mk({ name: 'Origan séché',    emoji: '🌿', dlc: frDate(100), days_left: 100, primitive: 'origan-seche' }),
    mk({ name: 'Basilic séché',   emoji: '🌿', dlc: frDate(101), days_left: 101, primitive: 'basilic-seche' }),
    mk({ name: 'Cannelle',        emoji: '🟤', dlc: frDate(102), days_left: 102, primitive: 'cannelle' }),
    mk({ name: 'Curcuma',         emoji: '🟡', dlc: frDate(103), days_left: 103, primitive: 'curcuma' }),
    mk({ name: 'Piment de Cayenne', emoji: '🌶️', dlc: frDate(104), days_left: 104, primitive: 'piment-de-cayenne' }),
    mk({ name: 'Laurier',         emoji: '🌿', dlc: frDate(105), days_left: 105, primitive: 'laurier' }),
    mk({ name: 'Thym séché',      emoji: '🌿', dlc: frDate(106), days_left: 106, primitive: 'thym-seche' }),
    mk({ name: 'Romarin séché',   emoji: '🌿', dlc: frDate(107), days_left: 107, primitive: 'romarin-seche' }),
    mk({ name: 'Yaourt grec',     emoji: '🥣', dlc: frDate(108), days_left: 108, primitive: 'yaourt-grec' }),
    mk({ name: 'Yaourt aux fruits', emoji: '🍓', dlc: frDate(109), days_left: 109, primitive: 'yaourt-aux-fruits' }),
    mk({ name: 'Fromage à tartiner', emoji: '🧀', dlc: frDate(110), days_left: 110, primitive: 'fromage-a-tartiner' }),
    mk({ name: 'Crème liquide',   emoji: '🥛', dlc: frDate(111), days_left: 111, primitive: 'creme-liquide' }),
    mk({ name: 'Rillettes de thon', emoji: '🐟', dlc: frDate(112), days_left: 112, primitive: 'rillettes-de-thon' }),
    mk({ name: 'Œufs durs',       emoji: '🥚', dlc: frDate(113), days_left: 113, primitive: 'oeufs-durs' }),
    mk({ name: 'Pâtes fraîches',  emoji: '🍝', dlc: frDate(114), days_left: 114, primitive: 'pates-fraiches' }),
    mk({ name: 'Tofu soyeux',     emoji: '🧊', dlc: frDate(115), days_left: 115, primitive: 'tofu-soyeux' }),
    mk({ name: 'Houmous',         emoji: '🥣', dlc: frDate(116), days_left: 116, primitive: 'houmous' }),
    mk({ name: 'Soupe fraîche',   emoji: '🍲', dlc: frDate(117), days_left: 117, primitive: 'soupe-fraiche' }),
    mk({ name: 'Beurre demi-sel', emoji: '🧈', dlc: frDate(118), days_left: 118, primitive: 'beurre-demi-sel' }),
    mk({ name: 'Fromage frais ail et fines herbes', emoji: '🧀', dlc: frDate(119), days_left: 119, primitive: 'fromage-frais-ail-fines-herbes' }),
    mk({ name: 'Chocolat noir',   emoji: '🍫', dlc: frDate(120), days_left: 120, primitive: 'chocolat-noir' }),
    mk({ name: 'Dessert chocolat', emoji: '🍫', dlc: frDate(121), days_left: 121, primitive: 'dessert-chocolat' }),
    mk({ name: 'Crème dessert vanille', emoji: '🍮', dlc: frDate(122), days_left: 122, primitive: 'creme-dessert-vanille' }),
    mk({ name: 'Flan vanille',    emoji: '🍮', dlc: frDate(123), days_left: 123, primitive: 'flan-vanille' }),
    mk({ name: 'Yaourt à boire',  emoji: '🥤', dlc: frDate(124), days_left: 124, primitive: 'yaourt-a-boire' }),
    mk({ name: "Jus d'orange frais", emoji: '🍊', dlc: frDate(125), days_left: 125, primitive: 'jus-d-orange-frais' }),
    mk({ name: 'Salade verte',    emoji: '🥬', dlc: frDate(126), days_left: 126, primitive: 'salade-verte' }),
    mk({ name: 'Radis',           emoji: '🌱', dlc: frDate(127), days_left: 127, primitive: 'radis' }),
    // LOTS 12-13 (22 primitives réellement nouvelles, audit visuel uniquement)
    mk({ name: 'Gruyère',         emoji: '🧀', dlc: frDate(128), days_left: 128, primitive: 'gruyere' }),
    mk({ name: 'Parmesan',        emoji: '🧀', dlc: frDate(129), days_left: 129, primitive: 'parmesan' }),
    mk({ name: 'Fromage râpé parmesan', emoji: '🧀', dlc: frDate(130), days_left: 130, primitive: 'fromage-rape-parmesan' }),
    mk({ name: 'Mozzarella râpée',emoji: '🧀', dlc: frDate(131), days_left: 131, primitive: 'mozzarella-rapee' }),
    mk({ name: 'Comté',           emoji: '🧀', dlc: frDate(132), days_left: 132, primitive: 'comte' }),
    mk({ name: 'Mimolette',       emoji: '🧀', dlc: frDate(133), days_left: 133, primitive: 'mimolette' }),
    mk({ name: 'Bleu',            emoji: '🧀', dlc: frDate(134), days_left: 134, primitive: 'bleu' }),
    mk({ name: 'Chèvre frais',    emoji: '🧀', dlc: frDate(135), days_left: 135, primitive: 'chevre-frais' }),
    mk({ name: 'Ricotta',         emoji: '🧀', dlc: frDate(136), days_left: 136, primitive: 'ricotta' }),
    mk({ name: 'Guacamole',       emoji: '🥑', dlc: frDate(137), days_left: 137, primitive: 'guacamole' }),
    mk({ name: 'Tzatziki',        emoji: '🥒', dlc: frDate(138), days_left: 138, primitive: 'tzatziki' }),
    mk({ name: 'Taboulé',         emoji: '🌾', dlc: frDate(139), days_left: 139, primitive: 'taboule' }),
    mk({ name: 'Carottes râpées', emoji: '🥕', dlc: frDate(140), days_left: 140, primitive: 'carottes-rapees' }),
    mk({ name: 'Betteraves râpées', emoji: '🟣', dlc: frDate(141), days_left: 141, primitive: 'betteraves-rapees' }),
    mk({ name: 'Concombre en rondelles', emoji: '🥒', dlc: frDate(142), days_left: 142, primitive: 'concombre-en-rondelles' }),
    mk({ name: 'Œufs brouillés',  emoji: '🍳', dlc: frDate(143), days_left: 143, primitive: 'oeufs-brouilles' }),
    mk({ name: 'Omelette nature', emoji: '🍳', dlc: frDate(144), days_left: 144, primitive: 'omelette-nature' }),
    mk({ name: 'Riz cuit',        emoji: '🍚', dlc: frDate(145), days_left: 145, primitive: 'riz-cuit' }),
    mk({ name: 'Quinoa cuit',     emoji: '🌾', dlc: frDate(146), days_left: 146, primitive: 'quinoa-cuit' }),
    mk({ name: 'Lentilles cuites', emoji: '🫘', dlc: frDate(147), days_left: 147, primitive: 'lentilles-cuites' }),
    mk({ name: 'Pâtes cuites',    emoji: '🍝', dlc: frDate(148), days_left: 148, primitive: 'pates-cuites' }),
    mk({ name: 'Purée de pommes de terre', emoji: '🥔', dlc: frDate(149), days_left: 149, primitive: 'puree-pommes-de-terre' }),
    // LOTS 14-16 (46 primitives réellement nouvelles ou variantes utiles validées, audit visuel uniquement)
    mk({ name: 'Haricots verts',  emoji: '🫛', dlc: frDate(150), days_left: 150, primitive: 'haricots-verts' }),
    mk({ name: 'Chou-fleur',      emoji: '🥦', dlc: frDate(151), days_left: 151, primitive: 'chou-fleur' }),
    mk({ name: 'Asperges vertes', emoji: '🌱', dlc: frDate(152), days_left: 152, primitive: 'asperges-vertes' }),
    mk({ name: 'Épinards',        emoji: '🥬', dlc: frDate(153), days_left: 153, primitive: 'epinards' }),
    mk({ name: 'Roquette',        emoji: '🥬', dlc: frDate(154), days_left: 154, primitive: 'roquette' }),
    mk({ name: 'Endives',         emoji: '🥬', dlc: frDate(155), days_left: 155, primitive: 'endives' }),
    mk({ name: 'Fenouil',         emoji: '🌿', dlc: frDate(156), days_left: 156, primitive: 'fenouil' }),
    mk({ name: 'Oeufs de caille', emoji: '🥚', dlc: frDate(157), days_left: 157, primitive: 'oeufs-de-caille' }),
    mk({ name: 'Basilic frais',   emoji: '🌿', dlc: frDate(158), days_left: 158, primitive: 'basilic-frais' }),
    mk({ name: 'Persil frisé',    emoji: '🌿', dlc: frDate(159), days_left: 159, primitive: 'persil-frise' }),
    mk({ name: 'Ciboulette',      emoji: '🌿', dlc: frDate(160), days_left: 160, primitive: 'ciboulette' }),
    mk({ name: 'Oignons nouveaux', emoji: '🧅', dlc: frDate(161), days_left: 161, primitive: 'oignons-nouveaux' }),
    mk({ name: 'Pois gourmands',  emoji: '🌱', dlc: frDate(162), days_left: 162, primitive: 'pois-gourmands' }),
    mk({ name: 'Petits pois',     emoji: '🟢', dlc: frDate(163), days_left: 163, primitive: 'petits-pois' }),
    mk({ name: 'Pain de mie',     emoji: '🍞', dlc: frDate(164), days_left: 164, primitive: 'pain-de-mie' }),
    mk({ name: 'Baguette',        emoji: '🥖', dlc: frDate(165), days_left: 165, primitive: 'baguette' }),
    mk({ name: 'Croissant',       emoji: '🥐', dlc: frDate(166), days_left: 166, primitive: 'croissant' }),
    mk({ name: 'Pain au chocolat', emoji: '🥐', dlc: frDate(167), days_left: 167, primitive: 'pain-au-chocolat' }),
    mk({ name: 'Bagel',           emoji: '🥯', dlc: frDate(168), days_left: 168, primitive: 'bagel' }),
    mk({ name: 'Confiture de fraise', emoji: '🍓', dlc: frDate(169), days_left: 169, primitive: 'confiture-de-fraise' }),
    mk({ name: 'Beurre de cacahuète', emoji: '🥜', dlc: frDate(170), days_left: 170, primitive: 'beurre-de-cacahuete' }),
    mk({ name: 'Jus de pomme',    emoji: '🍎', dlc: frDate(171), days_left: 171, primitive: 'jus-de-pomme' }),
    mk({ name: "Jus d'ananas",    emoji: '🍍', dlc: frDate(172), days_left: 172, primitive: 'jus-d-ananas' }),
    mk({ name: 'Céréales',        emoji: '🥣', dlc: frDate(173), days_left: 173, primitive: 'cereales' }),
    mk({ name: 'Lasagnes',        emoji: '🍝', dlc: frDate(174), days_left: 174, primitive: 'lasagnes' }),
    mk({ name: 'Pizza',           emoji: '🍕', dlc: frDate(175), days_left: 175, primitive: 'pizza' }),
    mk({ name: 'Quiche lorraine', emoji: '🥧', dlc: frDate(176), days_left: 176, primitive: 'quiche-lorraine' }),
    mk({ name: 'Sandwich jambon fromage', emoji: '🥪', dlc: frDate(177), days_left: 177, primitive: 'sandwich-jambon-fromage' }),
    mk({ name: 'Salade de pâtes', emoji: '🍝', dlc: frDate(178), days_left: 178, primitive: 'salade-de-pates' }),
    mk({ name: 'Riz au lait',     emoji: '🍮', dlc: frDate(179), days_left: 179, primitive: 'riz-au-lait' }),
    mk({ name: 'Potiron',         emoji: '🎃', dlc: frDate(180), days_left: 180, primitive: 'potiron' }),
    mk({ name: 'Poireau',         emoji: '🌱', dlc: frDate(181), days_left: 181, primitive: 'poireau' }),
    mk({ name: 'Betterave crue',  emoji: '🔴', dlc: frDate(182), days_left: 182, primitive: 'betterave-crue' }),
    mk({ name: 'Navet',           emoji: '🥔', dlc: frDate(183), days_left: 183, primitive: 'navet' }),
    mk({ name: 'Radis noir',      emoji: '⚫️', dlc: frDate(184), days_left: 184, primitive: 'radis-noir' }),
    mk({ name: 'Panais',          emoji: '🥕', dlc: frDate(185), days_left: 185, primitive: 'panais' }),
    mk({ name: 'Topinambour',     emoji: '🥔', dlc: frDate(186), days_left: 186, primitive: 'topinambour' }),
    mk({ name: 'Chou rouge',      emoji: '🟣', dlc: frDate(187), days_left: 187, primitive: 'chou-rouge' }),
    mk({ name: 'Chou blanc',      emoji: '🥬', dlc: frDate(188), days_left: 188, primitive: 'chou-blanc' }),
    mk({ name: 'Chou frisé (kale)', emoji: '🥬', dlc: frDate(189), days_left: 189, primitive: 'chou-frise-kale' }),
    mk({ name: 'Pak choï',        emoji: '🥬', dlc: frDate(190), days_left: 190, primitive: 'pak-choi' }),
    mk({ name: 'Tempeh',          emoji: '🟫', dlc: frDate(191), days_left: 191, primitive: 'tempeh' }),
    mk({ name: 'Lentilles corail', emoji: '🟠', dlc: frDate(192), days_left: 192, primitive: 'lentilles-corail' }),
    mk({ name: 'Pois cassés',     emoji: '🟢', dlc: frDate(193), days_left: 193, primitive: 'pois-casses' }),
    mk({ name: 'Haricots blancs', emoji: '🫘', dlc: frDate(194), days_left: 194, primitive: 'haricots-blancs' }),
    mk({ name: 'Pois chiches cuits', emoji: '🫘', dlc: frDate(195), days_left: 195, primitive: 'pois-chiches-cuits' }),
  ];
}

// Jeu QA visuelle — ~55 produits crédibles répartis sur les 3 espaces, avec un mix de
// priorités par espace pour vérifier Priority-first, Natural Focus et les sections
// dans chaque contexte. Réutilise les MÊMES primitives (aucun asset dupliqué). Les
// espaces surgelé/placard sont naturellement « Plus tard » (dates longues) : c'est un
// état réel valide, pas un manque.
export function getVisualQAItems() {
  const qa = (loc, over) => mk({ ...over, location: loc, dlc: frDate(over.days_left), id: `qa-${loc}-${over.name}` });
  return [
    // ── FRIGO — les 3 sections représentées ──
    qa('Frigo', { name: 'Poulet rôti',      emoji: '🍗', days_left: 0,  primitive: 'poulet-roti' }),
    qa('Frigo', { name: 'Tomates cerises',  emoji: '🍅', days_left: 0,  primitive: 'tomates-cerises' }),
    qa('Frigo', { name: 'Crème fraîche',    emoji: '🥣', days_left: -1, primitive: 'creme-fraiche' }),
    qa('Frigo', { name: 'Saumon',           emoji: '🐟', days_left: 1,  primitive: 'saumon' }),
    qa('Frigo', { name: 'Salade verte',     emoji: '🥬', days_left: 2,  primitive: 'salade-verte' }),
    qa('Frigo', { name: 'Avocat',           emoji: '🥑', days_left: 3,  primitive: 'avocat' }),
    qa('Frigo', { name: 'Jambon',           emoji: '🍖', days_left: 3,  primitive: 'jambon' }),
    qa('Frigo', { name: 'Courgette',        emoji: '🥒', days_left: 4,  primitive: 'courgette' }),
    qa('Frigo', { name: 'Champignons',      emoji: '🍄', days_left: 5,  primitive: 'champignons' }),
    qa('Frigo', { name: 'Mozzarella',       emoji: '🧀', days_left: 6,  primitive: 'mozzarella' }),
    qa('Frigo', { name: 'Lait entier',      emoji: '🥛', days_left: 7,  primitive: 'lait-entier' }),
    qa('Frigo', { name: 'Brocoli',          emoji: '🥦', days_left: 7,  primitive: 'brocoli' }),
    qa('Frigo', { name: 'Concombre',        emoji: '🥒', days_left: 8,  primitive: 'concombre' }),
    qa('Frigo', { name: 'Fromage râpé',     emoji: '🧀', days_left: 9,  primitive: 'fromage-rape-emmental' }),
    qa('Frigo', { name: 'Poivron rouge',    emoji: '🫑', days_left: 9,  primitive: 'poivron-rouge' }),
    qa('Frigo', { name: 'Camembert',        emoji: '🧀', days_left: 10, primitive: 'camembert' }),
    qa('Frigo', { name: 'Œufs',             emoji: '🥚', days_left: 14, primitive: 'oeufs' }),
    qa('Frigo', { name: 'Carottes',         emoji: '🥕', days_left: 18, primitive: 'carottes' }),
    qa('Frigo', { name: 'Beurre',           emoji: '🧈', days_left: 25, primitive: 'beurre' }),
    qa('Frigo', { name: 'Cornichons',       emoji: '🥒', days_left: 60, primitive: 'cornichons' }),
    // ── CONGÉLATEUR — dates longues (Plus tard), état réel ──
    qa('Congélateur', { name: 'Petits pois',    emoji: '🟢', days_left: 120, primitive: 'petits-pois' }),
    qa('Congélateur', { name: 'Haricots verts', emoji: '🫛', days_left: 110, primitive: 'haricots-verts' }),
    qa('Congélateur', { name: 'Épinards',       emoji: '🥬', days_left: 100, primitive: 'epinards' }),
    qa('Congélateur', { name: 'Saumon surgelé', emoji: '🐟', days_left: 150, primitive: 'saumon' }),
    qa('Congélateur', { name: 'Poisson blanc',  emoji: '🐟', days_left: 150, primitive: 'poisson-blanc' }),
    qa('Congélateur', { name: 'Crevettes',      emoji: '🦐', days_left: 90,  primitive: 'crevettes' }),
    qa('Congélateur', { name: 'Steak haché surgelé', emoji: '🥩', days_left: 120, primitive: 'steak-hache' }),
    qa('Congélateur', { name: 'Poulet cru',     emoji: '🍗', days_left: 120, primitive: 'poulet-cru' }),
    qa('Congélateur', { name: 'Pizza',          emoji: '🍕', days_left: 90,  primitive: 'pizza' }),
    qa('Congélateur', { name: 'Lasagnes',       emoji: '🍝', days_left: 100, primitive: 'lasagnes' }),
    qa('Congélateur', { name: 'Pain de mie',    emoji: '🍞', days_left: 30,  primitive: 'pain-de-mie' }),
    qa('Congélateur', { name: 'Viande hachée',  emoji: '🥩', days_left: 100, primitive: 'viande-hachee' }),
    // ── PLACARD — épicerie sèche (Plus tard) ──
    qa('Placard', { name: 'Pâtes',              emoji: '🍝', days_left: 300, primitive: 'pates' }),
    qa('Placard', { name: 'Riz',                emoji: '🍚', days_left: 400, primitive: 'riz' }),
    qa('Placard', { name: 'Farine',             emoji: '🌾', days_left: 200, primitive: 'farine' }),
    qa('Placard', { name: 'Sucre',              emoji: '🍬', days_left: 500, primitive: 'sucre' }),
    qa('Placard', { name: 'Lentilles',          emoji: '🫘', days_left: 300, primitive: 'lentilles' }),
    qa('Placard', { name: 'Pois chiches',       emoji: '🫘', days_left: 300, primitive: 'pois-chiches' }),
    qa('Placard', { name: 'Thon en conserve',   emoji: '🥫', days_left: 600, primitive: 'thon-en-conserve' }),
    qa('Placard', { name: "Huile d'olive",      emoji: '🫒', days_left: 250, primitive: 'huile-d-olive' }),
    qa('Placard', { name: 'Miel',               emoji: '🍯', days_left: 700, primitive: 'miel' }),
    qa('Placard', { name: 'Céréales',           emoji: '🥣', days_left: 120, primitive: 'cereales' }),
    qa('Placard', { name: 'Muesli',             emoji: '🥣', days_left: 150, primitive: 'muesli' }),
    qa('Placard', { name: 'Chocolat noir',      emoji: '🍫', days_left: 180, primitive: 'chocolat-noir' }),
    qa('Placard', { name: 'Confiture de fraise', emoji: '🍓', days_left: 200, primitive: 'confiture-de-fraise' }),
    qa('Placard', { name: 'Sel',                emoji: '🧂', days_left: 900, primitive: 'sel' }),
    qa('Placard', { name: 'Poivre noir',        emoji: '⚫️', days_left: 700, primitive: 'poivre-noir' }),
    qa('Placard', { name: 'Cannelle',           emoji: '🟤', days_left: 400, primitive: 'cannelle' }),
  ];
}
