/**
 * Food Language — bibliothèque centrale des primitives alimentaires (Signature 04).
 * SOURCE UNIQUE de résolution PRODUIT → REPRÉSENTATION. Remplace les require()
 * dispersés : plus aucun mapping sauvage aliment-par-aliment dans les composants UI.
 *
 * Deux usages, volontairement distincts :
 *   1. getPrimitive(key)      — lookup EXPLICITE par identité canonique (slug).
 *                               Utilisé quand l'app sait déjà quelle primitive elle
 *                               veut (dataset de calibration ; plus tard, mapping GS1
 *                               par GTIN → identité exacte).
 *   2. resolveFoodImage(item) — résolution DÉTERMINISTE nom → identité → confiance →
 *                               primitive, pour les produits réels dont on ne connaît
 *                               que le nom. Aucune dépendance réseau, aucune dépendance
 *                               GS1 : la bibliothèque générique reste autonome (S04 §11).
 *
 * Niveaux de confiance S04 : 1 = identité exacte connue · 2 = catégorie certaine
 * (primitive générique crédible). 3/4 (catégorie approximative / inconnu) ne
 * fabriquent PAS d'image : resolveFoodImage renvoie null et l'UI retombe sur img_url
 * puis emoji. « Frigy ne montre jamais ce qu'il ne sait pas. »
 *
 * ÉTATS (S04 §12) : le modèle de données ne connaît aujourd'hui que `opened` (bool),
 * et il n'existe aucune primitive d'état (pas de « lait ouvert », pas de « tomate
 * coupée »). On thread donc `opened` dans la signature pour l'avenir, mais il ne
 * modifie AUCUNE résolution tant qu'aucune primitive d'état fiable n'existe : jamais
 * de déduction d'un état non confirmé.
 *
 * ratio = largeur/hauteur INTRINSÈQUE, dérivé des dimensions RÉELLES du PNG (jamais
 * saisi à la main → aucune dérive). Métadonnée morphologique générique consommée par
 * InventoryProductRow (catégories « vertical étroit » / « compact rond »), jamais un
 * nom/id d'aliment.
 *
 * DETTE (non-bloquante) : les fichiers vivent encore sous assets/dev-preview-food/,
 * nom hérité de la phase d'audit visuel. Ce sont désormais les primitives de
 * production ; un `git mv` du dossier + une passe sur le bloc PRIMITIVES ci-dessous
 * suffiront à corriger le nom, sans autre impact (source unique).
 */

// ── Registre : 192 primitives (clé canonique → asset + ratio réel) ──
export const PRIMITIVES = {
  'ail': { image: require('../../assets/dev-preview-food/ail.png'), ratio: 1.6786 },
  'amandes': { image: require('../../assets/dev-preview-food/amandes.png'), ratio: 1.6616 },
  'asperges-vertes': { image: require('../../assets/dev-preview-food/asperges-vertes.png'), ratio: 1.7953 },
  'aubergine': { image: require('../../assets/dev-preview-food/aubergine.png'), ratio: 2.0178 },
  'avocat': { image: require('../../assets/dev-preview-food/avocat.png'), ratio: 0.6932 },
  'bacon': { image: require('../../assets/dev-preview-food/bacon.png'), ratio: 2.1006 },
  'bagel': { image: require('../../assets/dev-preview-food/bagel.png'), ratio: 1.3596 },
  'baguette': { image: require('../../assets/dev-preview-food/baguette.png'), ratio: 1.8225 },
  'basilic-frais': { image: require('../../assets/dev-preview-food/basilic-frais.png'), ratio: 1.4602 },
  'basilic-seche': { image: require('../../assets/dev-preview-food/basilic-seche.png'), ratio: 1.5427 },
  'betterave-crue': { image: require('../../assets/dev-preview-food/betterave-crue.png'), ratio: 1.3413 },
  'betteraves-rapees': { image: require('../../assets/dev-preview-food/betteraves-rapees.png'), ratio: 1.1245 },
  'beurre': { image: require('../../assets/dev-preview-food/beurre.png'), ratio: 1.5526 },
  'beurre-de-cacahuete': { image: require('../../assets/dev-preview-food/beurre-de-cacahuete.png'), ratio: 1.2526 },
  'beurre-demi-sel': { image: require('../../assets/dev-preview-food/beurre-demi-sel.png'), ratio: 1.3804 },
  'bleu': { image: require('../../assets/dev-preview-food/bleu.png'), ratio: 1.5261 },
  'brocoli': { image: require('../../assets/dev-preview-food/brocoli.png'), ratio: 1.5126 },
  'camembert': { image: require('../../assets/dev-preview-food/camembert.png'), ratio: 1.7256 },
  'cannelle': { image: require('../../assets/dev-preview-food/cannelle.png'), ratio: 1.3021 },
  'carottes': { image: require('../../assets/dev-preview-food/carottes.png'), ratio: 1.7796 },
  'carottes-rapees': { image: require('../../assets/dev-preview-food/carottes-rapees.png'), ratio: 1.0875 },
  'cereales': { image: require('../../assets/dev-preview-food/cereales.png'), ratio: 1.2667 },
  'champignons': { image: require('../../assets/dev-preview-food/champignons.png'), ratio: 1.3930 },
  'chevre': { image: require('../../assets/dev-preview-food/chevre.png'), ratio: 1.2971 },
  'chevre-frais': { image: require('../../assets/dev-preview-food/chevre-frais.png'), ratio: 1.2811 },
  'chocolat-noir': { image: require('../../assets/dev-preview-food/chocolat-noir.png'), ratio: 1.3598 },
  'chorizo': { image: require('../../assets/dev-preview-food/chorizo.png'), ratio: 1.6233 },
  'chou-blanc': { image: require('../../assets/dev-preview-food/chou-blanc.png'), ratio: 1.4573 },
  'chou-fleur': { image: require('../../assets/dev-preview-food/chou-fleur.png'), ratio: 1.2550 },
  'chou-frise-kale': { image: require('../../assets/dev-preview-food/chou-frise-kale.png'), ratio: 1.4663 },
  'chou-rouge': { image: require('../../assets/dev-preview-food/chou-rouge.png'), ratio: 1.5684 },
  'ciboulette': { image: require('../../assets/dev-preview-food/ciboulette.png'), ratio: 1.9226 },
  'citron': { image: require('../../assets/dev-preview-food/citron.png'), ratio: 1.4796 },
  'citron-vert': { image: require('../../assets/dev-preview-food/citron-vert.png'), ratio: 1.4844 },
  'comte': { image: require('../../assets/dev-preview-food/comte.png'), ratio: 1.5381 },
  'concentre-de-tomates': { image: require('../../assets/dev-preview-food/concentre-de-tomates.png'), ratio: 1.3427 },
  'concombre': { image: require('../../assets/dev-preview-food/concombre.png'), ratio: 1.4615 },
  'concombre-en-rondelles': { image: require('../../assets/dev-preview-food/concombre-en-rondelles.png'), ratio: 1.1446 },
  'confiture-de-fraise': { image: require('../../assets/dev-preview-food/confiture-de-fraise.png'), ratio: 1.1724 },
  'cornichons': { image: require('../../assets/dev-preview-food/cornichons.png'), ratio: 1.5852 },
  'courge-butternut': { image: require('../../assets/dev-preview-food/courge-butternut.png'), ratio: 1.2000 },
  'courgette': { image: require('../../assets/dev-preview-food/courgette.png'), ratio: 1.5000 },
  'cranberries-sechees': { image: require('../../assets/dev-preview-food/cranberries-sechees.png'), ratio: 1.5544 },
  'creme-dessert-vanille': { image: require('../../assets/dev-preview-food/creme-dessert-vanille.png'), ratio: 1.0276 },
  'creme-fraiche': { image: require('../../assets/dev-preview-food/creme-fraiche.png'), ratio: 1.3264 },
  'creme-liquide': { image: require('../../assets/dev-preview-food/creme-liquide.png'), ratio: 0.8057 },
  'crevettes': { image: require('../../assets/dev-preview-food/crevettes.png'), ratio: 1.8217 },
  'croissant': { image: require('../../assets/dev-preview-food/croissant.png'), ratio: 1.6550 },
  'cumin-moulu': { image: require('../../assets/dev-preview-food/cumin-moulu.png'), ratio: 1.5833 },
  'curcuma': { image: require('../../assets/dev-preview-food/curcuma.png'), ratio: 1.5459 },
  'dattes': { image: require('../../assets/dev-preview-food/dattes.png'), ratio: 1.5283 },
  'dessert-chocolat': { image: require('../../assets/dev-preview-food/dessert-chocolat.png'), ratio: 1.0150 },
  'dinde': { image: require('../../assets/dev-preview-food/dinde.png'), ratio: 1.9938 },
  'echalote': { image: require('../../assets/dev-preview-food/echalote.png'), ratio: 1.3518 },
  'emmental': { image: require('../../assets/dev-preview-food/emmental.png'), ratio: 1.5464 },
  'endives': { image: require('../../assets/dev-preview-food/endives.png'), ratio: 1.5085 },
  'epinards': { image: require('../../assets/dev-preview-food/epinards.png'), ratio: 1.7186 },
  'farine': { image: require('../../assets/dev-preview-food/farine.png'), ratio: 1.3317 },
  'fenouil': { image: require('../../assets/dev-preview-food/fenouil.png'), ratio: 1.0443 },
  'feta': { image: require('../../assets/dev-preview-food/feta.png'), ratio: 1.2049 },
  'flan-vanille': { image: require('../../assets/dev-preview-food/flan-vanille.png'), ratio: 1.5892 },
  'flocons-d-avoine': { image: require('../../assets/dev-preview-food/flocons-d-avoine.png'), ratio: 1.7249 },
  'fromage-a-tartiner': { image: require('../../assets/dev-preview-food/fromage-a-tartiner.png'), ratio: 1.3813 },
  'fromage-blanc': { image: require('../../assets/dev-preview-food/fromage-blanc.png'), ratio: 1.1746 },
  'fromage-frais': { image: require('../../assets/dev-preview-food/fromage-frais.png'), ratio: 1.4058 },
  'fromage-frais-ail-fines-herbes': { image: require('../../assets/dev-preview-food/fromage-frais-ail-fines-herbes.png'), ratio: 1.1638 },
  'fromage-rape-emmental': { image: require('../../assets/dev-preview-food/fromage-rape-emmental.png'), ratio: 1.7366 },
  'fromage-rape-parmesan': { image: require('../../assets/dev-preview-food/fromage-rape-parmesan.png'), ratio: 1.6616 },
  'gingembre': { image: require('../../assets/dev-preview-food/gingembre.png'), ratio: 1.3766 },
  'graines-de-chia': { image: require('../../assets/dev-preview-food/graines-de-chia.png'), ratio: 1.7978 },
  'graines-de-lin': { image: require('../../assets/dev-preview-food/graines-de-lin.png'), ratio: 1.7419 },
  'graines-de-tournesol': { image: require('../../assets/dev-preview-food/graines-de-tournesol.png'), ratio: 1.7368 },
  'gruyere': { image: require('../../assets/dev-preview-food/gruyere.png'), ratio: 1.4932 },
  'guacamole': { image: require('../../assets/dev-preview-food/guacamole.png'), ratio: 1.1240 },
  'haricots-blancs': { image: require('../../assets/dev-preview-food/haricots-blancs.png'), ratio: 1.7034 },
  'haricots-rouges': { image: require('../../assets/dev-preview-food/haricots-rouges.png'), ratio: 1.7692 },
  'haricots-verts': { image: require('../../assets/dev-preview-food/haricots-verts.png'), ratio: 1.8535 },
  'herbes-fraiches': { image: require('../../assets/dev-preview-food/herbes-fraiches.png'), ratio: 1.5695 },
  'houmous': { image: require('../../assets/dev-preview-food/houmous.png'), ratio: 1.2000 },
  'huile-d-olive': { image: require('../../assets/dev-preview-food/huile-d-olive.png'), ratio: 1.3065 },
  'jambon': { image: require('../../assets/dev-preview-food/jambon.png'), ratio: 1.6035 },
  'jambon-cru': { image: require('../../assets/dev-preview-food/jambon-cru.png'), ratio: 1.5612 },
  'jus-d-ananas': { image: require('../../assets/dev-preview-food/jus-d-ananas.png'), ratio: 0.9081 },
  'jus-d-orange-frais': { image: require('../../assets/dev-preview-food/jus-d-orange-frais.png'), ratio: 0.8797 },
  'jus-de-citron': { image: require('../../assets/dev-preview-food/jus-de-citron.png'), ratio: 0.6145 },
  'jus-de-pomme': { image: require('../../assets/dev-preview-food/jus-de-pomme.png'), ratio: 0.9064 },
  'ketchup': { image: require('../../assets/dev-preview-food/ketchup.png'), ratio: 1.2080 },
  'lait-entier': { image: require('../../assets/dev-preview-food/lait-entier.png'), ratio: 0.3686 },
  'lardons': { image: require('../../assets/dev-preview-food/lardons.png'), ratio: 1.4426 },
  'lasagnes': { image: require('../../assets/dev-preview-food/lasagnes.png'), ratio: 1.5612 },
  'laurier': { image: require('../../assets/dev-preview-food/laurier.png'), ratio: 1.7258 },
  'lentilles': { image: require('../../assets/dev-preview-food/lentilles.png'), ratio: 1.7802 },
  'lentilles-corail': { image: require('../../assets/dev-preview-food/lentilles-corail.png'), ratio: 1.7465 },
  'lentilles-cuites': { image: require('../../assets/dev-preview-food/lentilles-cuites.png'), ratio: 1.1067 },
  'mayonnaise': { image: require('../../assets/dev-preview-food/mayonnaise.png'), ratio: 1.1888 },
  'miel': { image: require('../../assets/dev-preview-food/miel.png'), ratio: 1.2015 },
  'mimolette': { image: require('../../assets/dev-preview-food/mimolette.png'), ratio: 1.4509 },
  'moutarde': { image: require('../../assets/dev-preview-food/moutarde.png'), ratio: 1.2008 },
  'mozzarella': { image: require('../../assets/dev-preview-food/mozzarella.png'), ratio: 1.1843 },
  'mozzarella-rapee': { image: require('../../assets/dev-preview-food/mozzarella-rapee.png'), ratio: 1.7192 },
  'muesli': { image: require('../../assets/dev-preview-food/muesli.png'), ratio: 1.6381 },
  'myrtilles': { image: require('../../assets/dev-preview-food/myrtilles.png'), ratio: 1.8295 },
  'navet': { image: require('../../assets/dev-preview-food/navet.png'), ratio: 1.3636 },
  'noisettes': { image: require('../../assets/dev-preview-food/noisettes.png'), ratio: 1.5604 },
  'noix': { image: require('../../assets/dev-preview-food/noix.png'), ratio: 1.5953 },
  'noix-de-cajou': { image: require('../../assets/dev-preview-food/noix-de-cajou.png'), ratio: 1.7817 },
  'oeufs': { image: require('../../assets/dev-preview-food/oeufs.png'), ratio: 1.7416 },
  'oeufs-brouilles': { image: require('../../assets/dev-preview-food/oeufs-brouilles.png'), ratio: 1.1673 },
  'oeufs-de-caille': { image: require('../../assets/dev-preview-food/oeufs-de-caille.png'), ratio: 1.5682 },
  'oeufs-durs': { image: require('../../assets/dev-preview-food/oeufs-durs.png'), ratio: 1.3347 },
  'oignon': { image: require('../../assets/dev-preview-food/oignon.png'), ratio: 1.6500 },
  'oignons-nouveaux': { image: require('../../assets/dev-preview-food/oignons-nouveaux.png'), ratio: 1.8247 },
  'olives-vertes': { image: require('../../assets/dev-preview-food/olives-vertes.png'), ratio: 1.1635 },
  'omelette-nature': { image: require('../../assets/dev-preview-food/omelette-nature.png'), ratio: 1.5245 },
  'orange': { image: require('../../assets/dev-preview-food/orange.png'), ratio: 1.3731 },
  'origan-seche': { image: require('../../assets/dev-preview-food/origan-seche.png'), ratio: 1.6615 },
  'pain-au-chocolat': { image: require('../../assets/dev-preview-food/pain-au-chocolat.png'), ratio: 1.4576 },
  'pain-de-mie': { image: require('../../assets/dev-preview-food/pain-de-mie.png'), ratio: 1.4057 },
  'pak-choi': { image: require('../../assets/dev-preview-food/pak-choi.png'), ratio: 1.3650 },
  'panais': { image: require('../../assets/dev-preview-food/panais.png'), ratio: 1.5304 },
  'paprika': { image: require('../../assets/dev-preview-food/paprika.png'), ratio: 1.5122 },
  'parmesan': { image: require('../../assets/dev-preview-food/parmesan.png'), ratio: 1.5922 },
  'patate-douce': { image: require('../../assets/dev-preview-food/patate-douce.png'), ratio: 1.4760 },
  'pate': { image: require('../../assets/dev-preview-food/pate.png'), ratio: 1.4682 },
  'pates': { image: require('../../assets/dev-preview-food/pates.png'), ratio: 1.7969 },
  'pates-cuites': { image: require('../../assets/dev-preview-food/pates-cuites.png'), ratio: 1.1310 },
  'pates-fraiches': { image: require('../../assets/dev-preview-food/pates-fraiches.png'), ratio: 1.3975 },
  'persil-frise': { image: require('../../assets/dev-preview-food/persil-frise.png'), ratio: 1.7485 },
  'pesto': { image: require('../../assets/dev-preview-food/pesto.png'), ratio: 1.1587 },
  'petits-pois': { image: require('../../assets/dev-preview-food/petits-pois.png'), ratio: 2.0161 },
  'piment-de-cayenne': { image: require('../../assets/dev-preview-food/piment-de-cayenne.png'), ratio: 1.5404 },
  'pizza': { image: require('../../assets/dev-preview-food/pizza.png'), ratio: 1.4536 },
  'poire': { image: require('../../assets/dev-preview-food/poire.png'), ratio: 1.1376 },
  'poireau': { image: require('../../assets/dev-preview-food/poireau.png'), ratio: 1.4135 },
  'pois-casses': { image: require('../../assets/dev-preview-food/pois-casses.png'), ratio: 1.8286 },
  'pois-chiches': { image: require('../../assets/dev-preview-food/pois-chiches.png'), ratio: 1.5234 },
  'pois-chiches-cuits': { image: require('../../assets/dev-preview-food/pois-chiches-cuits.png'), ratio: 1.7230 },
  'pois-gourmands': { image: require('../../assets/dev-preview-food/pois-gourmands.png'), ratio: 1.7877 },
  'poisson-blanc': { image: require('../../assets/dev-preview-food/poisson-blanc.png'), ratio: 1.6133 },
  'poivre-noir': { image: require('../../assets/dev-preview-food/poivre-noir.png'), ratio: 1.6492 },
  'poivron-rouge': { image: require('../../assets/dev-preview-food/poivron-rouge.png'), ratio: 0.9333 },
  'pomme': { image: require('../../assets/dev-preview-food/pomme.png'), ratio: 1.3586 },
  'pommes-de-terre': { image: require('../../assets/dev-preview-food/pommes-de-terre.png'), ratio: 1.6685 },
  'potiron': { image: require('../../assets/dev-preview-food/potiron.png'), ratio: 1.1866 },
  'poulet-cru': { image: require('../../assets/dev-preview-food/poulet-cru.png'), ratio: 1.3946 },
  'poulet-roti': { image: require('../../assets/dev-preview-food/poulet-roti.png'), ratio: 1.3141 },
  'puree-pommes-de-terre': { image: require('../../assets/dev-preview-food/puree-pommes-de-terre.png'), ratio: 1.1264 },
  'quiche-lorraine': { image: require('../../assets/dev-preview-food/quiche-lorraine.png'), ratio: 1.3598 },
  'quinoa-cuit': { image: require('../../assets/dev-preview-food/quinoa-cuit.png'), ratio: 1.1032 },
  'radis': { image: require('../../assets/dev-preview-food/radis.png'), ratio: 1.3819 },
  'radis-noir': { image: require('../../assets/dev-preview-food/radis-noir.png'), ratio: 1.4022 },
  'raisins': { image: require('../../assets/dev-preview-food/raisins.png'), ratio: 1.6758 },
  'raisins-secs': { image: require('../../assets/dev-preview-food/raisins-secs.png'), ratio: 1.7135 },
  'ricotta': { image: require('../../assets/dev-preview-food/ricotta.png'), ratio: 1.2530 },
  'rillettes': { image: require('../../assets/dev-preview-food/rillettes.png'), ratio: 1.1728 },
  'rillettes-de-thon': { image: require('../../assets/dev-preview-food/rillettes-de-thon.png'), ratio: 1.1835 },
  'riz': { image: require('../../assets/dev-preview-food/riz.png'), ratio: 2.5400 },
  'riz-au-lait': { image: require('../../assets/dev-preview-food/riz-au-lait.png'), ratio: 1.2280 },
  'riz-cuit': { image: require('../../assets/dev-preview-food/riz-cuit.png'), ratio: 1.1484 },
  'romarin-seche': { image: require('../../assets/dev-preview-food/romarin-seche.png'), ratio: 1.7539 },
  'roquette': { image: require('../../assets/dev-preview-food/roquette.png'), ratio: 1.6264 },
  'salade': { image: require('../../assets/dev-preview-food/salade.png'), ratio: 1.3946 },
  'salade-de-pates': { image: require('../../assets/dev-preview-food/salade-de-pates.png'), ratio: 1.2892 },
  'salade-verte': { image: require('../../assets/dev-preview-food/salade-verte.png'), ratio: 1.2250 },
  'salami': { image: require('../../assets/dev-preview-food/salami.png'), ratio: 1.5818 },
  'sandwich-jambon-fromage': { image: require('../../assets/dev-preview-food/sandwich-jambon-fromage.png'), ratio: 1.8782 },
  'sauce-blanche': { image: require('../../assets/dev-preview-food/sauce-blanche.png'), ratio: 1.1781 },
  'saucisses': { image: require('../../assets/dev-preview-food/saucisses.png'), ratio: 1.3409 },
  'saumon': { image: require('../../assets/dev-preview-food/saumon.png'), ratio: 1.4647 },
  'saumon-fume': { image: require('../../assets/dev-preview-food/saumon-fume.png'), ratio: 1.5150 },
  'sel': { image: require('../../assets/dev-preview-food/sel.png'), ratio: 1.5744 },
  'soupe-fraiche': { image: require('../../assets/dev-preview-food/soupe-fraiche.png'), ratio: 1.1040 },
  'steak-hache': { image: require('../../assets/dev-preview-food/steak-hache.png'), ratio: 1.3780 },
  'sucre': { image: require('../../assets/dev-preview-food/sucre.png'), ratio: 1.2864 },
  'surimi': { image: require('../../assets/dev-preview-food/surimi.png'), ratio: 1.3822 },
  'taboule': { image: require('../../assets/dev-preview-food/taboule.png'), ratio: 1.0924 },
  'tempeh': { image: require('../../assets/dev-preview-food/tempeh.png'), ratio: 1.7613 },
  'thon-en-conserve': { image: require('../../assets/dev-preview-food/thon-en-conserve.png'), ratio: 1.5089 },
  'thym-seche': { image: require('../../assets/dev-preview-food/thym-seche.png'), ratio: 1.6633 },
  'tofu-nature': { image: require('../../assets/dev-preview-food/tofu-nature.png'), ratio: 1.2176 },
  'tofu-soyeux': { image: require('../../assets/dev-preview-food/tofu-soyeux.png'), ratio: 1.3970 },
  'tomate': { image: require('../../assets/dev-preview-food/tomate.png'), ratio: 1.0759 },
  'tomates-cerises': { image: require('../../assets/dev-preview-food/tomates-cerises.png'), ratio: 1.4208 },
  'topinambour': { image: require('../../assets/dev-preview-food/topinambour.png'), ratio: 1.7288 },
  'truite-fumee': { image: require('../../assets/dev-preview-food/truite-fumee.png'), ratio: 1.5419 },
  'tzatziki': { image: require('../../assets/dev-preview-food/tzatziki.png'), ratio: 1.0723 },
  'viande-hachee': { image: require('../../assets/dev-preview-food/viande-hachee.png'), ratio: 1.9868 },
  'yaourt-a-boire': { image: require('../../assets/dev-preview-food/yaourt-a-boire.png'), ratio: 0.6130 },
  'yaourt-aromatise': { image: require('../../assets/dev-preview-food/yaourt-aromatise.png'), ratio: 1.1278 },
  'yaourt-aux-fruits': { image: require('../../assets/dev-preview-food/yaourt-aux-fruits.png'), ratio: 1.1288 },
  'yaourt-grec': { image: require('../../assets/dev-preview-food/yaourt-grec.png'), ratio: 1.1519 },
  'yaourt-nature': { image: require('../../assets/dev-preview-food/yaourt-nature.png'), ratio: 1.0887 },
};

// Lookup explicite par identité canonique. Renvoie null si la clé n'existe pas.
export function getPrimitive(key) {
  const p = key && PRIMITIVES[key];
  return p ? { key, image: p.image, ratio: p.ratio } : null;
}

// ── Résolution déterministe nom → primitive ──

// Normalisation : minuscules, ligatures FR, accents supprimés, ponctuation → espace.
function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Dé-pluralisation légère : retire un s/x final (mots > 3 lettres uniquement, pour
// épargner riz, jus, ail…). Appliquée identiquement au nom ET aux jetons, donc
// singulier/pluriel se rejoignent sans collision.
// Exception : « pates » (pâtes) n'est PAS dé-pluralisé, sinon il fusionnerait avec
// « pate » (pâté) une fois les accents retirés — l'unique paire minimale FR concernée
// par la bibliothèque. Les garder distincts préserve deux primitives légitimes.
const KEEP_PLURAL = new Set(['pates']);
function canon(s) {
  return norm(s).split(' ')
    .map((w) => (!KEEP_PLURAL.has(w) && w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w))
    .filter(Boolean)
    .join(' ');
}

// Synonymes réels non couverts par les slugs. Curaté et déterministe — PAS un moteur
// NLP. Clé = phrase canonique (post-canon) → clé de primitive. Résolus en confiance 2
// (catégorie certaine, primitive générique crédible).
const ALIASES = {
  'yaourt': 'yaourt-nature',
  'yogourt': 'yaourt-nature',
  'yogurt': 'yaourt-nature',
  'lait': 'lait-entier',
  'poulet': 'poulet-cru',
  'blanc de poulet': 'poulet-cru',
  'escalope de poulet': 'poulet-cru',
  'boeuf hache': 'viande-hachee',
  'steak hache de boeuf': 'steak-hache',
  'creme': 'creme-fraiche',
  'fromage rape': 'fromage-rape-emmental',
  'hummus': 'houmous',
  'kale': 'chou-frise-kale',
  'patate': 'pommes-de-terre',
  'pomme de terre': 'pommes-de-terre',
  'pdt': 'pommes-de-terre',
};

// Table de correspondance construite une fois : jeton canonique → clé, à partir des
// slugs (clé.replace('-', ' ')) + des alias. Triée par SPÉCIFICITÉ décroissante
// (nb de mots, puis longueur) pour que « yaourt grec » l'emporte sur « yaourt »,
// « poulet roti » sur « poulet », « pates cuites » sur « pates » sur « pate »…
const MATCH = [
  ...Object.keys(PRIMITIVES).map((key) => ({ token: canon(key.replace(/-/g, ' ')), key, conf: 1 })),
  ...Object.entries(ALIASES).map(([phrase, key]) => ({ token: canon(phrase), key, conf: 2 })),
].sort((a, b) => {
  const wa = a.token.split(' ').length, wb = b.token.split(' ').length;
  return wb - wa || b.token.length - a.token.length;
});

/**
 * Résout un produit vers sa primitive Food Language.
 * @param {object|string} item — item de stock (ou nom brut).
 * @returns {{key,image,ratio,confidence}|null} — null si aucune correspondance fiable.
 */
export function resolveFoodImage(item) {
  const name = typeof item === 'string' ? item : item?.name;
  const c = canon(name);
  if (!c) return null;

  // 1) Égalité exacte du nom entier avec un jeton → identité certaine (confiance 1).
  for (const e of MATCH) {
    if (c === e.token) {
      const p = getPrimitive(e.key);
      if (p) return { ...p, confidence: e.conf };
    }
  }
  // 2) Sinon, jeton présent comme séquence de mots entiers dans un nom plus descriptif.
  //    MATCH étant trié par spécificité, le premier match est le plus précis.
  const padded = ` ${c} `;
  for (const e of MATCH) {
    if (padded.includes(` ${e.token} `)) {
      const p = getPrimitive(e.key);
      if (p) return { ...p, confidence: e.conf === 1 ? 2 : e.conf };
    }
  }
  return null;
}
