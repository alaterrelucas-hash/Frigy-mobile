/**
 * Home — DÉBORDEMENT « À GARDER À L'ŒIL ». Régression SOURCE :
 *   node src/utils/homeWatchOverflow.regression.test.js
 * Contrat produit : Home affiche AU PLUS 2 items Watch ; 3+ → 2 lignes + UNE action tertiaire
 * « Voir l'autre » / « Voir les X autres » → Produits (jamais dropdown/accordion/carousel/« Voir tout »,
 * jamais une liste d'inventaire sur Home). Comptage RÉEL depuis la collection éligible complète.
 * Aucune règle temporelle nouvelle : selectWatchItems reste = selectWatchEligible(...).slice(0,2).
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const logic = read('./homeLogic.js');
const hook  = read('../hooks/useHomeSuggestion.js');
const watch = read('../components/home/HomeWatchList.js');
const home  = read('../screens/HomeScreen.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── SÉLECTEUR : compte réel via collection éligible complète, cap à 2 inchangé ──
ok('WO-L01 selectWatchEligible exporté (collection complète, MÊME prédicat, PAS de slice)',
  /export function selectWatchEligible\(/.test(logic)
  && /days >= 0 && x\.days <= 7 && !excl\.has\(x\.item\.id\)/.test(logic));
ok('WO-L02 selectWatchItems = selectWatchEligible(...).slice(0, 2) (sortie ≤2 IDENTIQUE à l\'historique)',
  /export function selectWatchItems\([\s\S]*?return selectWatchEligible\(items, priority, gathering, now\)\.slice\(0, 2\);/.test(logic));
ok('WO-L03 selectWatchEligible ne plafonne PAS lui-même (aucun .slice dans sa définition)',
  (() => { const m = logic.match(/export function selectWatchEligible\([\s\S]*?\n\}/); return !!m && !/\.slice\(/.test(m[0]); })());

// ── HOOK : expose watchOverflow = max(0, éligibles - 2) ; watchItems = 2 premiers ──
ok('WO-H01 watchEligible complet + watchItems = slice(0,2)',
  /const watchEligible = selectWatchEligible\(items, priority, gatheringItems\)/.test(hook)
  && /const watchItems = watchEligible\.slice\(0, 2\)/.test(hook));
ok('WO-H02 watchOverflow = Math.max(0, watchEligible.length - 2) exposé',
  /const watchOverflow = Math\.max\(0, watchEligible\.length - 2\)/.test(hook) && /\n\s*watchOverflow,/.test(hook));

// ── COMPOSANT : cap 2 + action de débordement ──
ok('WATCH-0 section absente si aucun item (if (!items.length) return null)', /if \(!items\.length\) return null;/.test(watch));
ok('WATCH cap 2 : shown = items.slice(0, 2) et la MAP itère `shown` (jamais tous)',
  /const shown = items\.slice\(0, 2\)/.test(watch) && /\{shown\.map\(\(it, idx\) =>/.test(watch));
ok('WO cap : extra = overflow (sinon dérivé items.length - 2)',
  /const extra = typeof overflow === 'number' \? overflow : Math\.max\(0, items\.length - 2\)/.test(watch));
ok('WATCH-1/2 : aucune action si extra === 0 (gate `extra > 0 && onSeeMore`)',
  /\{extra > 0 && onSeeMore && \(/.test(watch));
ok('WATCH-3 : extra === 1 → « Voir l\'autre »', /extra === 1 \? "Voir l'autre" : /.test(watch));
ok('WATCH-5 : extra > 1 → « Voir les ${extra} autres » (comptage réel)', /`Voir les \$\{extra\} autres`/.test(watch));
ok('WO action = navigation (onSeeMore) + chevron, PAS un gros CTA vert plein',
  /onPress=\{onSeeMore\}/.test(watch) && /<ChevronRight /.test(watch) && !/backgroundColor: theme\.accent/.test(watch));
ok('WO a11y : label avec le compte réel (autre / X autres)',
  /accessibilityLabel=\{extra === 1 \? "Voir l'autre produit à garder à l'œil" : `Voir les \$\{extra\} autres produits à garder à l'œil`\}/.test(watch));
// (commentaires retirés : la doctrine « jamais dropdown/accordion… » est citée en commentaire.)
const watchCode = watch.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
ok('WO INTERDIT : ni dropdown, ni accordion, ni carousel, ni « Voir tout » (dans le CODE)',
  !/dropdown|accordion|carousel|Voir tout/i.test(watchCode));

// ── HOMESCREEN : câblage prod (overflow réel + destination Produits) ──
ok('WO-S01 Watch prod reçoit overflow={watchOverflow} + onSeeMore → Produits (onNav(\'fridge\'))',
  (watch => (home.match(/overflow=\{watchOverflow\} onSeeMore=\{\(\) => onNav\?\.\('fridge'\)\}/g) || []).length >= 1)());
ok('WO-S02 destination = Produits/Stock (jamais Courses/Recipes/Impact pour ce lien)',
  !/onSeeMore=\{\(\) => onNav\?\.\('(recipes|profile)'\)\}/.test(home) && /onSeeMore=\{\(\) => onNav\?\.\('fridge'\)\}/.test(home));

console.log(`\nhomeWatchOverflow.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
