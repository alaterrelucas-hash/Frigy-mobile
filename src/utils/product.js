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
  // Épicerie sèche/conserve — ne pas appliquer les durées fraîcheur
  if (c === 'épicerie') {
    if (n.includes('sauce') || n.includes('soupe') || n.includes('purée')) return 180;
    return 365;
  }
  if (n.includes('poulet') || n.includes('volaille') || c.includes('poultry')) return 3;
  if (n.includes('viande') || n.includes('bœuf') || n.includes('boeuf') || n.includes('porc') || c.includes('meat')) return 3;
  if (n.includes('charcuterie') || n.includes('jambon') || n.includes('saucisse')) return 5;
  if (n.includes('poisson') || n.includes('saumon') || n.includes('thon') || c.includes('fish')) return 2;
  if (n.includes('crevette') || n.includes('fruits de mer')) return 2;
  if (n.includes('lait') || c.includes('milk')) return 5;
  if (n.includes('yaourt') || n.includes('yogurt')) return 21;
  if (n.includes('crème') || n.includes('creme')) return 7;
  if (n.includes('beurre')) return 30;
  if (n.includes('fromage') || c.includes('cheese')) return 14;
  if (n.includes('œuf') || n.includes('oeuf') || c.includes('egg')) return 28;
  if (n.includes('fraise') || n.includes('framboise') || n.includes('myrtille')) return 4;
  if (n.includes('salade') || n.includes('épinard') || n.includes('roquette')) return 4;
  if (n.includes('avocat')) return 3;
  if (n.includes('tomate') || n.includes('concombre')) return 7;
  if (n.includes('pomme') || n.includes('poire') || n.includes('orange')) return 14;
  if (c.includes('fruit') || c.includes('vegetable')) return 7;
  if (n.includes('pain') || n.includes('baguette') || n.includes('croissant')) return 3;
  if (n.includes('brioche') || n.includes('viennoiserie')) return 5;
  if (c.includes('prepared') || c.includes('traiteur') || c.includes('ready meal')) return 3;
  if (n.includes('jus') || c.includes('juice')) return 7;
  if (c.includes('beverage') || c.includes('boisson')) return 90;
  if (n.includes('surgelé') || c.includes('frozen')) return 180;
  if (c.includes('pasta') || c.includes('rice') || c.includes('cereal')) return 365;
  if (c.includes('canned') || c.includes('conserve')) return 730;
  return 90;
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
