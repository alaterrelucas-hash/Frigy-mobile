/**
 * Tests LOW A — dataset d'affinités (déterministe, offline). Aucun runner : script Node.
 *   node src/utils/homeAffinities.test.js
 * Charge foodLanguage.js + homeAffinities.js en neutralisant les require() de PNG et en
 * transformant les export ESM en CommonJS (même technique que foodLanguage.test.js).
 */
const fs = require('fs');
const path = require('path');

function strip(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8')
    .replace(/require\('[^']*\/([^\/']+)\.png'\)/g, "'IMG:$1'")
    .replace(/^import[^;]*;$/gm, '')          // retire les imports ESM
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ');
}

const code = strip('foodLanguage.js') + '\n' + strip('homeAffinities.js')
  + '\nmodule.exports = { AFFINITIES, PRIMITIVES, selectAffinityCandidates, candidateLabel };';
const m = new module.constructor();
m._compile(code, path.join(__dirname, 'homeAffinities.js'));
const { AFFINITIES, PRIMITIVES, selectAffinityCandidates, candidateLabel } = m.exports;

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };
const keys = (r) => r.map((c) => c.key);

// ── Intégrité du dataset ──
ok('corpus non vide', Object.keys(AFFINITIES).length >= 20);
ok('toutes les clés sont des primitives FL', Object.keys(AFFINITIES).every((k) => !!PRIMITIVES[k]));
ok('tous les candidats sont des primitives FL', Object.values(AFFINITIES).every((list) => list.every((c) => !!PRIMITIVES[c])));
ok('aucun candidat = sa propre clé', Object.entries(AFFINITIES).every(([k, list]) => !list.includes(k)));
ok('aucun doublon dans une liste', Object.values(AFFINITIES).every((list) => new Set(list).size === list.length));

// ── Sélection (scénario QA Riz → Œufs / Oignon / Tomates, ÉMERGENT du moteur) ──
const riz = selectAffinityCandidates([{ name: 'Riz' }]);
ok('Riz → 3 candidats', riz.length === 3);
ok('Riz → oeufs/oignon/tomates-cerises', JSON.stringify(keys(riz)) === JSON.stringify(['oeufs', 'oignon', 'tomates-cerises']));
ok('labels Œufs/Oignon/Tomates', JSON.stringify(riz.map((c) => c.name)) === JSON.stringify(['Œufs', 'Oignon', 'Tomates']));
ok('chaque candidat a une image FL', riz.every((c) => !!c.image));

// ── Exclusions ──
ok('exclut un produit déjà en stock', !keys(selectAffinityCandidates([{ name: 'Riz' }, { name: 'Œufs' }])).includes('oeufs'));
ok('exclut via excludeKeys (rejeté/confirmé)', !keys(selectAffinityCandidates([{ name: 'Riz' }], { excludeKeys: ['oignon'] })).includes('oignon'));
ok('synonyme du stock exclu (yaourt=yaourt-nature)', !keys(selectAffinityCandidates([{ name: 'Pomme' }, { name: 'yaourt' }])).includes('yaourt-nature'));

// ── Fallback (jamais d'aléatoire) ──
ok('stock vide → []', selectAffinityCandidates([]).length === 0);
ok('produit sans affinité connue → []', selectAffinityCandidates([{ name: 'Sel' }]).length === 0);
ok('produit hors FL → []', selectAffinityCandidates([{ name: 'Zorglub' }]).length === 0);

// ── Scoring multi-produits (fusion + rang) ──
const multi = selectAffinityCandidates([{ name: 'Tomate' }, { name: 'Basilic frais' }]);
ok('Tomate+Basilic → mozzarella en tête (partagé + bien classé)', keys(multi)[0] === 'mozzarella');
ok('max 3 même avec plusieurs produits', multi.length <= 3);

// ── candidateLabel ──
ok('label œ → Œ', candidateLabel('oeufs') === 'Œufs');
ok('label slug multi-mots', candidateLabel('tomates-cerises') === 'Tomates');

console.log(`\nHome affinities — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
