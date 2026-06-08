export function scoreName(name) {
  if (!name || !name.trim()) return -1;
  let score = 10;
  const t = name.trim();
  const words = t.split(/\s+/).filter(w => w.length > 2);
  const capsWords = words.filter(w => w === w.toUpperCase() && /[A-Z]/.test(w)).length;
  score -= capsWords * 2;
  if (t.length > 60) score -= 3;
  else if (t.length > 40) score -= 1;
  if (/\b[0-9]{3,}\b/.test(t)) score -= 2;
  if (/^[A-ZÀ-Ú][a-zà-ú]/.test(t)) score += 2;
  if (t.length >= 4 && t.length <= 35) score += 1;
  return score;
}

export function mergeProductData(off, spoon) {
  const offName = off?.name?.trim() || null;
  const spoonName = spoon?.name?.trim() || null;
  let name;
  if (offName && spoonName) {
    name = scoreName(offName) >= scoreName(spoonName) ? offName : spoonName;
  } else {
    name = offName || spoonName || null;
  }
  const imgUrl = spoon?.imgUrl || off?.imgUrl || null;
  const brand = off?.brand || '';
  const nutri = off?.nutri || null;
  const kcal = off?.kcal || null;
  const category = off?.category || '';
  const source = offName && spoonName ? 'Merged' : offName ? 'OpenFoodFacts' : spoonName ? 'Spoonacular' : 'Manuel';
  return { name, brand, imgUrl, nutri, kcal, category, source };
}

export function normalizeDlc(str) {
  if (!str) return '';
  const s = str.trim();
  // ISO: 2026-05-22 → 22/05/2026
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  // Dots: 22.05.2026 or 22.05.26
  const dots = s.match(/^(\d{1,2})\.(\d{2})\.(\d{2,4})$/);
  if (dots) {
    const y = dots[3].length === 2 ? `20${dots[3]}` : dots[3];
    return `${dots[1].padStart(2,'0')}/${dots[2]}/${y}`;
  }
  // Short year slashes: 22/05/26
  const shortY = s.match(/^(\d{1,2})\/(\d{2})\/(\d{2})$/);
  if (shortY) return `${shortY[1].padStart(2,'0')}/${shortY[2]}/20${shortY[3]}`;
  // MM/YYYY or MM.YYYY (no day)
  const monthYear = s.match(/^(\d{2})[/.](\d{4})$/);
  if (monthYear) return `${monthYear[1]}/${monthYear[2]}`;
  return s;
}

export function parseDlc(str) {
  const normalized = normalizeDlc(str);
  const clean = normalized.replace(/[^0-9/]/g, '');
  const parts = clean.split('/');
  let date = null;
  if (parts.length === 3 && parts[2].length >= 4) {
    date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  } else if (parts.length === 2 && parts[1].length >= 4) {
    date = new Date(parseInt(parts[1]), parseInt(parts[0]) - 1, 28);
  }
  if (!date || isNaN(date)) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((date - today) / 86400000);
}

export function formatDlcInput(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
}

export function suggestLocation(category, name) {
  const c = (category || '').toLowerCase().trim();
  const n = (name || '').toLowerCase();

  // 1. Congélateur — priorité absolue
  if (c === 'surgelé' || n.includes('surgelé') || n.includes('congelé')) return 'Congélateur';

  // 2. Checks par NOM en priorité (avant les catégories larges qui peuvent être mal classées)

  // Frigo — laitages
  if (n.includes('lait') || n.includes('yaourt') || n.includes('yogurt') ||
      n.includes('fromage') || n.includes('crème') || n.includes('beurre') ||
      n.includes('margarine') || n.includes('kéfir') || n.includes('skyr') ||
      n.includes('ricotta') || n.includes('mozzarella') || n.includes('gruyère') ||
      n.includes('emmental') || n.includes('camembert') || n.includes('brie') ||
      n.includes('roquefort') || n.includes('comté') || n.includes('cheddar') ||
      n.includes('fromage blanc') || n.includes('petit-suisse')) return 'Frigo';

  // Frigo — viandes
  if (n.includes('viande') || n.includes('poulet') || n.includes('volaille') ||
      n.includes('bœuf') || n.includes('boeuf') || n.includes('veau') ||
      n.includes('porc') || n.includes('agneau') || n.includes('dinde') ||
      n.includes('canard') || n.includes('steak') || n.includes('escalope') ||
      n.includes('côtelette') || n.includes('filet de') || n.includes('haché')) return 'Frigo';

  // Frigo — charcuterie
  if (n.includes('jambon') || n.includes('lardons') || n.includes('bacon') ||
      n.includes('saucisse') || n.includes('saucisson') || n.includes('chorizo') ||
      n.includes('salami') || n.includes('pâté') || n.includes('rillettes') ||
      n.includes('knack') || n.includes('mortadelle') || n.includes('merguez') ||
      n.includes('chipolata') || n.includes('andouille')) return 'Frigo';

  // Frigo — poissons et fruits de mer
  if (n.includes('saumon') || n.includes('cabillaud') || n.includes('truite') ||
      n.includes('dorade') || n.includes('merlu') || n.includes('bar ') ||
      n.includes('crevette') || n.includes('moule') || n.includes('huître') ||
      n.includes('coquille') || n.includes('poulpe') || n.includes('calamars')) return 'Frigo';

  // Frigo — œufs
  if (n.includes('œuf') || n.includes('oeuf')) return 'Frigo';

  // Frigo — légumes frais
  if (n.includes('tomate') || n.includes('salade') || n.includes('épinard') ||
      n.includes('roquette') || n.includes('concombre') || n.includes('courgette') ||
      n.includes('poivron') || n.includes('brocoli') || n.includes('champignon') ||
      n.includes('poireau') || n.includes('céleri') || n.includes('asperge') ||
      n.includes('radis') || n.includes('betterave fraîche')) return 'Frigo';

  // Frigo — fruits frais
  if (n.includes('fraise') || n.includes('framboise') || n.includes('myrtille') ||
      n.includes('cerise') || n.includes('raisin') || n.includes('kiwi') ||
      n.includes('avocat') || n.includes('mangue') || n.includes('pêche') ||
      n.includes('abricot') || n.includes('nectarine') || n.includes('litchi')) return 'Frigo';

  // Frigo — traiteur / plats frais / dips
  if (n.includes('houmous') || n.includes('hummus') || n.includes('guacamole') ||
      n.includes('tzatziki') || n.includes('taboulé') || n.includes('quiche') ||
      n.includes('pizza fraîche') || n.includes('tapenade') || n.includes('caviar d') ||
      n.includes('brandade') || n.includes('rillette') || n.includes('terrine') ||
      n.includes('mousse') || n.includes('pâté') || n.includes('wrap') ||
      n.includes('sandwich') || n.includes('sushi') || n.includes('tartinade')) return 'Frigo';

  // Frigo — jus frais et smoothies
  if (n.includes('jus frais') || n.includes('smoothie') || n.includes('jus pressé')) return 'Frigo';

  // 3. Checks par catégorie (fallback — après les vérifs par nom)
  if (['laitage', 'viande', 'poisson'].includes(c)) return 'Frigo';

  if (c === 'fruit' || c === 'légume') {
    if (n.includes('pomme de terre') || n.includes('oignon') || n.includes('ail') ||
        n.includes('échalote') || n.includes('carotte') || n.includes('navet') ||
        n.includes('courge') || n.includes('potiron') || n.includes('banane') ||
        n.includes('citron') || n.includes('orange') || n.includes('mandarine') ||
        n.includes('clémentine') || n.includes('pomme') || n.includes('poire') ||
        n.includes('ananas')) return 'Placard';
    return 'Frigo';
  }

  if (['épicerie', 'café', 'autre'].includes(c)) return 'Placard';
  if (c === 'boisson' && !n.includes('jus frais') && !n.includes('smoothie')) return 'Placard';
  if (c === 'pain') return 'Placard';

  return 'Placard';
}

export function estimateDays(category, name) {
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();

  // ── SURGELÉS ──
  if (c === 'surgelé' || n.includes('surgelé') || n.includes('congelé')) return 180;

  // ── ÉPICERIE SÈCHE ──
  if (c === 'épicerie') {
    if (n.includes('sauce') || n.includes('soupe') || n.includes('purée')) return 180;
    if (n.includes('huile') || n.includes('vinaigre')) return 365;
    return 365;
  }

  // ── VIANDES ──
  if (n.includes('poulet') || n.includes('volaille') || n.includes('dinde')) return 3;
  if (n.includes('haché') || n.includes('steak haché')) return 2;
  if (n.includes('viande') || n.includes('bœuf') || n.includes('boeuf') ||
      n.includes('veau') || n.includes('agneau') || n.includes('steak') ||
      n.includes('côte') || n.includes('filet') || n.includes('escalope')) return 3;
  if (n.includes('porc') || n.includes('rôti') || n.includes('jarret')) return 3;

  // ── CHARCUTERIE ──
  if (n.includes('jambon cru') || n.includes('prosciutto') || n.includes('coppa')) return 14;
  if (n.includes('jambon') || n.includes('jambon blanc')) return 5;
  if (n.includes('lardons') || n.includes('bacon')) return 7;
  if (n.includes('saucisse') || n.includes('chipolata') || n.includes('merguez')) return 4;
  if (n.includes('chorizo') || n.includes('salami') || n.includes('saucisson')) return 14;
  if (n.includes('pâté') || n.includes('rillettes') || n.includes('terrine')) return 5;
  if (n.includes('andouille') || n.includes('andouillette')) return 5;
  if (n.includes('knack') || n.includes('mortadelle')) return 7;

  // ── POISSONS ──
  if (n.includes('poisson') || n.includes('cabillaud') || n.includes('merlu') ||
      n.includes('dorade') || n.includes('bar ') || n.includes('sole') ||
      n.includes('colin') || n.includes('limande')) return 2;
  if (n.includes('saumon') || n.includes('truite')) return 3;
  if (n.includes('thon') && !n.includes('conserve')) return 2;
  if (n.includes('crevette') || n.includes('moule') || n.includes('huître') ||
      n.includes('coquille') || n.includes('poulpe') || n.includes('calamars') ||
      n.includes('homard') || n.includes('langoustine')) return 2;

  // ── LAITAGES ──
  if (n.includes('lait')) return 10;
  if (n.includes('crème fraîche') || n.includes('crème épaisse')) return 10;
  if (n.includes('crème liquide') || n.includes('crème fleurette')) return 7;
  if (n.includes('yaourt') || n.includes('yogurt') || n.includes('skyr') || n.includes('kéfir')) return 21;
  if (n.includes('petit-suisse') || n.includes('fromage blanc') || n.includes('faisselle')) return 10;
  if (n.includes('ricotta') || n.includes('mascarpone')) return 7;
  if (n.includes('mozzarella')) return 5;
  if (n.includes('burrata')) return 3;
  if (n.includes('camembert') || n.includes('brie') || n.includes('coulommiers')) return 14;
  if (n.includes('roquefort') || n.includes('gorgonzola') || n.includes('bleu')) return 21;
  if (n.includes('comté') || n.includes('gruyère') || n.includes('emmental') ||
      n.includes('cheddar') || n.includes('parmesan') || n.includes('gouda') ||
      n.includes('mimolette') || n.includes('beaufort')) return 30;
  if (n.includes('fromage') || c === 'laitage') return 14;
  if (n.includes('beurre') || n.includes('margarine')) return 30;
  if (n.includes('crème') || n.includes('creme')) return 7;

  // ── ŒUFS ──
  if (n.includes('œuf') || n.includes('oeuf')) return 28;

  // ── TRAITEUR / PLATS FRAIS ──
  if (n.includes('houmous') || n.includes('hummus') || n.includes('guacamole') ||
      n.includes('tzatziki') || n.includes('tapenade') || n.includes('caviar d')) return 7;
  if (n.includes('taboulé') || n.includes('salade composée')) return 3;
  if (n.includes('quiche') || n.includes('pizza fraîche') || n.includes('wrap')) return 3;
  if (n.includes('sushi') || n.includes('maki') || n.includes('sashimi')) return 1;
  if (n.includes('sandwich') || n.includes('panini')) return 2;
  if (n.includes('plat cuisiné') || n.includes('plat préparé') || n.includes('lasagne')) return 3;
  if (n.includes('soupe fraîche') || n.includes('gaspacho')) return 5;

  // ── LÉGUMES FRAIS ──
  if (n.includes('salade') || n.includes('laitue') || n.includes('scarole') ||
      n.includes('frisée') || n.includes('mâche')) return 4;
  if (n.includes('épinard') || n.includes('roquette') || n.includes('mesclun')) return 4;
  if (n.includes('herbe') || n.includes('persil') || n.includes('coriandre') ||
      n.includes('ciboulette') || n.includes('basilic') || n.includes('menthe') ||
      n.includes('estragon') || n.includes('thym frais') || n.includes('romarin frais')) return 5;
  if (n.includes('champignon') || n.includes('girolles') || n.includes('cèpes') ||
      n.includes('morilles')) return 5;
  if (n.includes('asperge')) return 4;
  if (n.includes('petit pois') || n.includes('haricot vert') || n.includes('fève')) return 5;
  if (n.includes('maïs')) return 4;
  if (n.includes('brocoli') || n.includes('chou-fleur') || n.includes('romanesco')) return 7;
  if (n.includes('artichaut')) return 6;
  if (n.includes('poivron') || n.includes('piment')) return 10;
  if (n.includes('courgette') || n.includes('aubergine')) return 10;
  if (n.includes('concombre')) return 7;
  if (n.includes('tomate')) return 7;
  if (n.includes('radis')) return 7;
  if (n.includes('betterave fraîche')) return 14;
  if (n.includes('céleri') || n.includes('poireau')) return 14;
  if (n.includes('chou') && !n.includes('chou-fleur')) return 21;
  if (n.includes('fenouil')) return 10;
  if (n.includes('carotte') || n.includes('navet') || n.includes('panais')) return 21;
  if (n.includes('pomme de terre') || n.includes('patate douce')) return 30;
  if (n.includes('oignon') || n.includes('échalote') || n.includes('ail')) return 45;
  if (n.includes('courge') || n.includes('potiron') || n.includes('potimarron') ||
      n.includes('butternut')) return 60;

  // ── FRUITS FRAIS ──
  if (n.includes('fraise')) return 4;
  if (n.includes('framboise') || n.includes('mûre')) return 3;
  if (n.includes('myrtille') || n.includes('groseille') || n.includes('cassis')) return 5;
  if (n.includes('cerise') || n.includes('griotte')) return 5;
  if (n.includes('raisin')) return 7;
  if (n.includes('figue')) return 4;
  if (n.includes('abricot') || n.includes('prune') || n.includes('mirabelle')) return 5;
  if (n.includes('pêche') || n.includes('nectarine') || n.includes('brugnon')) return 5;
  if (n.includes('avocat')) return 4;
  if (n.includes('mangue') || n.includes('papaye') || n.includes('goyave')) return 5;
  if (n.includes('litchi') || n.includes('lychee')) return 7;
  if (n.includes('kiwi')) return 10;
  if (n.includes('melon') || n.includes('pastèque')) return 7;
  if (n.includes('ananas')) return 7;
  if (n.includes('banane')) return 5;
  if (n.includes('poire')) return 7;
  if (n.includes('pomme')) return 21;
  if (n.includes('orange') || n.includes('pamplemousse') || n.includes('clémentine') ||
      n.includes('mandarine') || n.includes('citron') || n.includes('kumquat')) return 21;
  if (n.includes('grenade')) return 14;

  // ── PAIN & VIENNOISERIE ──
  if (n.includes('baguette') || n.includes('pain tradition') || n.includes('flûte')) return 2;
  if (n.includes('pain de mie') || n.includes('pain de campagne') || n.includes('pain complet')) return 7;
  if (n.includes('croissant') || n.includes('pain au chocolat') || n.includes('chausson')) return 2;
  if (n.includes('brioche') || n.includes('pain brioché')) return 5;
  if (n.includes('pain') || c === 'pain') return 3;

  // ── BOISSONS ──
  if (n.includes('jus frais') || n.includes('jus pressé') || n.includes('smoothie')) return 5;
  if (n.includes('jus') || c === 'boisson') return 30;

  // ── CONSERVES & ÉPICERIE ──
  if (n.includes('conserve') || n.includes('boîte de')) return 730;
  if (c === 'épicerie' || c === 'café' || c === 'autre') return 365;

  // Fallback par catégorie
  if (c === 'fruit') return 7;
  if (c === 'légume') return 7;
  if (c === 'viande') return 3;
  if (c === 'poisson') return 2;
  if (c === 'laitage') return 10;

  return 30;
}

export function estimateOpeningDays(category, name) {
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();

  // ── LAITAGES ──
  if (n.includes('lait')) return 3;
  if (n.includes('crème fraîche') || n.includes('crème épaisse')) return 5;
  if (n.includes('crème liquide') || n.includes('crème fleurette')) return 4;
  if (n.includes('yaourt') || n.includes('yogurt') || n.includes('skyr') || n.includes('kéfir')) return 7;
  if (n.includes('fromage blanc') || n.includes('faisselle') || n.includes('petit-suisse')) return 5;
  if (n.includes('ricotta') || n.includes('mascarpone')) return 4;
  if (n.includes('mozzarella') || n.includes('burrata')) return 2;
  if (n.includes('camembert') || n.includes('brie') || n.includes('coulommiers')) return 7;
  if (n.includes('roquefort') || n.includes('gorgonzola') || n.includes('bleu')) return 14;
  if (n.includes('comté') || n.includes('gruyère') || n.includes('emmental') ||
      n.includes('cheddar') || n.includes('parmesan') || n.includes('gouda') ||
      n.includes('mimolette') || n.includes('beaufort')) return 21;
  if (n.includes('fromage') || c === 'laitage') return 5;
  if (n.includes('beurre') || n.includes('margarine')) return 30;
  if (n.includes('crème') || n.includes('creme')) return 4;

  // ── CHARCUTERIE ──
  if (n.includes('jambon cru') || n.includes('prosciutto') || n.includes('coppa')) return 7;
  if (n.includes('jambon')) return 3;
  if (n.includes('lardons') || n.includes('bacon')) return 5;
  if (n.includes('saucisse') || n.includes('chipolata') || n.includes('merguez')) return 3;
  if (n.includes('chorizo') || n.includes('salami') || n.includes('saucisson')) return 10;
  if (n.includes('pâté') || n.includes('rillettes') || n.includes('terrine')) return 3;
  if (n.includes('knack') || n.includes('mortadelle')) return 5;

  // ── POISSONS ──
  if (n.includes('saumon fumé') || n.includes('truite fumée')) return 3;
  if ((n.includes('thon') || n.includes('sardine') || n.includes('maquereau')) && n.includes('conserve')) return 2;

  // ── CONSERVES ──
  if (n.includes('conserve') || n.includes('boîte de')) return 3;

  // ── JUS & BOISSONS ──
  if ((n.includes('jus') && n.includes('frais')) || n.includes('jus pressé') || n.includes('smoothie')) return 3;
  if (n.includes('jus') || c === 'boisson') return 7;

  // ── PAIN ──
  if (n.includes('pain de mie')) return 5;

  // ── SAUCES & CONDIMENTS ──
  if (n.includes('ketchup') || n.includes('mayonnaise')) return 30;
  if (n.includes('sauce')) return 21;
  if (n.includes('moutarde')) return 60;
  if (n.includes('confiture') || n.includes('miel')) return 90;
  if (n.includes('huile') || n.includes('vinaigre')) return 90;

  // ── TRAITEUR FRAIS ──
  if (n.includes('sushi') || n.includes('maki') || n.includes('sashimi')) return 1;
  if (n.includes('houmous') || n.includes('hummus') || n.includes('guacamole') ||
      n.includes('tzatziki') || n.includes('tapenade')) return 4;
  if (n.includes('taboulé') || n.includes('salade composée')) return 2;
  if (n.includes('quiche') || n.includes('pizza fraîche') || n.includes('wrap')) return 2;
  if (n.includes('plat cuisiné') || n.includes('lasagne') || n.includes('plat préparé')) return 2;

  // ── FALLBACK PAR CATÉGORIE ──
  if (c === 'viande') return 2;
  if (c === 'poisson') return 1;
  if (c === 'laitage') return 5;
  if (c === 'fruit' || c === 'légume') return 3;

  return 5;
}

export function getStorageTip(category, name) {
  const c = (category || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (n.includes('poulet') || n.includes('viande') || n.includes('bœuf') || n.includes('boeuf') || c === 'viande')
    return "Conserver au réfrigérateur. À consommer dans les 2-3 jours ou congeler dès l'achat.";
  if (n.includes('poisson') || n.includes('saumon') || n.includes('thon') || c === 'poisson')
    return 'Très fragile — consommer le jour même ou congeler immédiatement.';
  if (n.includes('lait') || n.includes('crème') || c === 'laitage')
    return 'Conserver au frais. Bien refermer après ouverture et utiliser dans les 3-5 jours.';
  if (n.includes('yaourt') || n.includes('fromage') || n.includes('beurre'))
    return 'Conserver au réfrigérateur. Ne pas dépasser la date même si le produit semble intact.';
  if (c === 'fruit' || c === 'légume')
    return 'Bac à légumes du réfrigérateur. Laver juste avant consommation, pas avant stockage.';
  if (c === 'surgelé')
    return 'Ne jamais recongeler après décongélation. Décongeler au réfrigérateur, pas à température ambiante.';
  if (n.includes('pain') || n.includes('baguette'))
    return 'Se conserve 2-3 jours à température ambiante. Congeler en tranches pour une conservation longue durée.';
  if (c === 'boisson')
    return 'Conserver au frais après ouverture et consommer dans les 3 jours.';
  return "Conserver dans un endroit frais, sec et à l'abri de la lumière directe.";
}
