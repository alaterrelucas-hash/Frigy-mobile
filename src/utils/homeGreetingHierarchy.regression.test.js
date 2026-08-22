/**
 * Home — HIÉRARCHIE du GREETING returning. Régression SOURCE :
 *   node src/utils/homeGreetingHierarchy.regression.test.js
 * Contrat : « Bonjour {prénom} » est un CONTEXTE personnel persistant, pas le message principal de la Home.
 * Le greeting partagé des états returning (composition ACTIVE + coquille NEUTRE) est en hiérarchie RÉDUITE
 * (Source Sans 3, 26 / 600) pour laisser le TITRE d'état (~29–30 / 700) porter le sujet courant. Les titres
 * d'état ne changent pas. First Run / Empty gardent leur greeting propre (composition indépendante).
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const home = read('../screens/HomeScreen.js');
const calm = read('../components/home/HomeCalm.js');
const first = read('../components/home/HomeFirstRun.js');
const empty = read('../components/home/HomeEmptyStock.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// Style Text qui PRÉCÈDE chaque « {firstName ? `Bonjour ${firstName}` } » dans HomeScreen (greeting partagé).
const lines = home.split('\n');
const greetStyleLines = [];
lines.forEach((l, i) => { if (/\{firstName \? `Bonjour \$\{firstName\}`/.test(l) && i > 0) greetStyleLines.push(lines[i - 1]); });

// ── HOME-GREET-01 : greeting partagé returning = Source Sans 3, 26 / 600 ──
ok('HOME-GREET-01 ≥1 greeting partagé détecté dans HomeScreen', greetStyleLines.length >= 1);
ok('HOME-GREET-01 tous les greetings partagés = fonts.semibold, 26, 600',
  greetStyleLines.length > 0 && greetStyleLines.every((s) =>
    /fontFamily: fonts\.semibold/.test(s) && /fontSize: 26/.test(s) && /fontWeight: '600'/.test(s)));

// ── HOME-GREET-02 : aucun greeting partagé résiduel en 30 / 700 ; titres d'état inchangés ──
ok('HOME-GREET-02 aucun greeting partagé en 30 / 700 (dé-emphase appliquée)',
  greetStyleLines.every((s) => !/fontSize: 30/.test(s) && !/fontWeight: '700'/.test(s)));
ok('HOME-GREET-02 titre d\'état HomeCalm inchangé (29 / 700, accent)',
  /fontSize: 29, fontWeight: '700'[\s\S]{0,60}color: theme\.accent/.test(calm));

// ── HOME-GREET-03 : First Run / Empty gardent leur greeting propre (non converti au greeting partagé) ──
ok('HOME-GREET-03 First Run garde son greeting propre (« Bonjour\\n{firstName} », composition indépendante)',
  /Bonjour\\n\$\{firstName\}/.test(first) && !/fontSize: 26, fontWeight: '600'[\s\S]{0,80}Bonjour/.test(first));
ok('HOME-GREET-03 Empty garde son greeting propre (non converti au 26/600 partagé de HomeScreen)',
  /Bonjour/.test(empty));

console.log(`\nhomeGreetingHierarchy.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
