/**
 * Tests Rescue Value (logique pure). Aucun runner configuré → script Node autonome.
 *   node src/utils/rescueValue.test.js
 * Neutralise l'import natif de CATEGORY_PRICE (constants importe lucide-react-native).
 */
const fs = require('fs');
const path = require('path');

function load(file, transforms) {
  let code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  code = transforms(code)
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ');
  const m = new module.constructor();
  m._compile(code, file);
  return m.exports;
}

// Stub CATEGORY_PRICE + autorité quantité N6-07 (deriveQuantityState renvoie toujours UNKNOWN
// aujourd'hui — aucune provenance persistée). On injecte le contrat canonique réel.
const rv = load('rescueValue.js', (c) =>
  c.replace(/import \{ CATEGORY_PRICE \} from '\.\.\/config\/constants';/,
      "const CATEGORY_PRICE={viande:6.5,poisson:5.5,laitage:2.2,surgelé:3.5,fruit:1.8,légume:1.5,pain:2.0,boisson:2.0,autre:2.5};")
   .replace(/import \{ deriveQuantityState, QUANTITY_AUTHORITY \} from '\.\/quantity';/,
      // Stub configurable : autorité UNKNOWN par défaut (réalité N6-07) ; KNOWN si l'item porte
      // le flag de test `__known` (units = item.quantity) → prouve le futur chemin N6-08 KNOWN.
      "const QUANTITY_AUTHORITY={KNOWN:'KNOWN',UNKNOWN:'UNKNOWN'};const deriveQuantityState=(it)=>({subject:'REPRESENTED_COHORT',authority:(it&&it.__known)?'KNOWN':'UNKNOWN',units:(it&&it.__known)?it.quantity:null});")
   + '\nmodule.exports={computeRescueValue,formatEuro,rescueValueSpokenLabel};');

const { computeRescueValue, formatEuro, rescueValueSpokenLabel } = rv;

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── computeRescueValue : prix null / invalide → null (inchangé) ────────────────
ok('prix ET catégorie absents → null', computeRescueValue({ quantity: 1 }) === null);
ok('catégorie inconnue → null', computeRescueValue({ category: 'inexistante' }) === null);
ok('item null → null', computeRescueValue(null) === null);

// ── N6-08 (§41) : autorité de QUANTITÉ NÉCESSAIRE mais NON SUFFISANTE pour un montant ──
// Un montant exige une autorité MONÉTAIRE indépendante (CR-11/CR-24) NON implémentée → AUCUN
// montant aujourd'hui, MÊME quand la quantité devient KNOWN. On ne réactive jamais l'argent par la
// seule quantité. (`__known` force deriveQuantityState=KNOWN dans le stub ; le résultat reste null.)
ok('RVF UNKNOWN + prix → null', computeRescueValue({ price: 3.2, quantity: 1 }) === null);
ok('RVF UNKNOWN + CATEGORY_PRICE → null', computeRescueValue({ category: 'laitage', quantity: 3 }) === null);
ok('RVF UNKNOWN → PAS €0 (null, et null !== 0)', computeRescueValue({ price: 3, quantity: 0 }) === null && computeRescueValue({ price: 3, quantity: 0 }) !== 0);
ok('DOWN2-T01 KNOWN quantité=3 + prix → TOUJOURS null (quantité ≠ argent autorisé)', computeRescueValue({ price: 1.5, quantity: 3, __known: true }) === null);
ok('DOWN2-T01b KNOWN quantité + CATEGORY_PRICE → null', computeRescueValue({ category: 'laitage', quantity: 3, __known: true }) === null);
ok('RVF prix absent → null (inchangé)', computeRescueValue({ quantity: 3, __known: true }) === null);
ok('RVF total_units ne substitue rien → null', computeRescueValue({ price: 2, quantity: 5, total_units: 5, __known: true }) === null);

// ── PRICE / RESCUE-SEPARATION : preuves source (P2 + action Rescue indépendante de l'argent) ──
const scan = fs.readFileSync(path.join(__dirname, '../screens/ScanScreen.js'), 'utf8');
const hpf = fs.readFileSync(path.join(__dirname, '../components/home/HomePriorityFocus.js'), 'utf8');
ok('PRICE-T01 item.price = unit_price (PER-UNIT, P2) côté writer ScanScreen', scan.includes('price: p.unit_price'));
ok('RES-T02/03 « X€ à sauver » (+ VoiceOver) gaté sur montant présent → null = héro sans argent', hpf.includes('!!rescueDisplay &&'));

// ── formatEuro : format FR sans espace avant € ────────────────────────────────
ok('format 3,20€', formatEuro(3.2) === '3,20€');
ok('format entier 2€', formatEuro(2) === '2€');
ok('format 0,80€', formatEuro(0.8) === '0,80€');
ok('format 12,50€', formatEuro(12.5) === '12,50€');
ok('format 127€', formatEuro(127) === '127€');
ok('AUCUNE espace avant €', !/\s€/.test(formatEuro(3.2)));
ok('format valeur nulle → null', formatEuro(0) === null);
ok('format valeur négative → null', formatEuro(-3) === null);
ok('format NaN → null', formatEuro(NaN) === null);

// ── rescueValueSpokenLabel : VoiceOver ────────────────────────────────────────
ok('spoken euros + centimes', rescueValueSpokenLabel(3.2) === 'Valeur à sauver : 3 euros et 20 centimes');
ok('spoken euros seuls', rescueValueSpokenLabel(2) === 'Valeur à sauver : 2 euros');
ok('spoken 1 euro (singulier)', rescueValueSpokenLabel(1) === 'Valeur à sauver : 1 euro');
ok('spoken centimes seuls', rescueValueSpokenLabel(0.8) === 'Valeur à sauver : 80 centimes');
ok('spoken null si invalide', rescueValueSpokenLabel(0) === null);

console.log(`\nRescue Value — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
