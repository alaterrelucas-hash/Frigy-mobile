/**
 * Tests de RÉGRESSION N6-03 — cycle de vie du scheduler de notifications (App.js).
 * Script Node autonome :  node src/utils/notificationScheduler.regression.test.js
 *
 * `scheduleAllNotifications` est une closure de App.js liée à Expo/supabase → non testable
 * en comportement sans monter le composant (dépendance interdite) ni l'extraire (refactor
 * interdit). On verrouille donc les DEUX invariants de cycle de vie par ANALYSE AST de
 * App.js (parsing, pas regex : le commentaire du garde contient volontairement la sous-chaîne
 * « items.length » — seul l'AST distingue le code du commentaire) :
 *
 *   P-01 — le garde du useEffect déclencheur NE gate PAS sur `items.length`
 *          (sinon un stock vidé — transition N→0 — sauterait cancelAll → pushes stale).
 *   P-02 — TOUT `scheduleNotificationAsync` est lexicalement DANS `scheduleAllNotifications`,
 *          et `cancelAllScheduledNotificationsAsync` s'y exécute AVANT tout scheduling
 *          (cancel-puis-rebuild complet → aucune catégorie annulée sans être reconstruite).
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const APP = path.join(__dirname, '..', '..', 'App.js');
const code = fs.readFileSync(APP, 'utf8');
const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const n of node) walk(n, visit); return; }
  if (node.type) visit(node);
  for (const k in node) {
    if (k === 'loc' || k === 'range' || k === 'leadingComments'
        || k === 'trailingComments' || k === 'innerComments') continue;
    walk(node[k], visit);
  }
}

function subtreeHas(node, pred) {
  let found = false;
  walk(node, (n) => { if (!found && pred(n)) found = true; });
  return found;
}

const isMemberCall = (n, prop) =>
  n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression'
  && n.callee.property && n.callee.property.name === prop;

const isItemsLength = (n) =>
  n.type === 'MemberExpression' && n.object && n.object.type === 'Identifier'
  && n.object.name === 'items' && n.property && n.property.name === 'length';

// ── Localiser la définition `const scheduleAllNotifications = async (...) => {...}` ──
let schedFn = null;
walk(ast, (n) => {
  if (n.type === 'VariableDeclarator' && n.id && n.id.name === 'scheduleAllNotifications' && n.init) {
    schedFn = n.init;
  }
});

// ── Collecter les appels natifs ──
const scheduleCalls = [];
let cancelCall = null;
walk(ast, (n) => {
  if (isMemberCall(n, 'scheduleNotificationAsync')) scheduleCalls.push(n);
  if (isMemberCall(n, 'cancelAllScheduledNotificationsAsync')) cancelCall = n;
});

// ── Localiser le useEffect qui appelle scheduleAllNotifications + son garde ──
let effectFound = false, effectCallsSched = false, guardGatesItemsLength = false;
walk(ast, (n) => {
  if (n.type !== 'CallExpression' || !n.callee || n.callee.name !== 'useEffect') return;
  const cb = n.arguments && n.arguments[0];
  if (!cb || (cb.type !== 'ArrowFunctionExpression' && cb.type !== 'FunctionExpression')) return;
  const callsSched = subtreeHas(cb, (x) =>
    x.type === 'CallExpression' && x.callee && x.callee.name === 'scheduleAllNotifications');
  if (!callsSched) return;
  effectFound = true; effectCallsSched = true;
  const body = cb.body && cb.body.type === 'BlockStatement' ? cb.body.body : [];
  for (const stmt of body) {
    if (stmt.type === 'IfStatement' && subtreeHas(stmt.consequent, (x) => x.type === 'ReturnStatement')) {
      if (subtreeHas(stmt.test, isItemsLength)) guardGatesItemsLength = true;
    }
  }
});

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── Sanity ──
ok('scheduleAllNotifications défini', !!schedFn);
ok('useEffect déclencheur trouvé', effectFound);
ok('l\'effet appelle scheduleAllNotifications', effectCallsSched);

// ── P-01 : le garde ne doit PAS gater sur items.length (verrou du bug stock-vide) ──
ok('P-01 : aucun garde early-return ne gate sur items.length', guardGatesItemsLength === false);

// ── P-02 : cancel-puis-rebuild complet, rien ne schedule hors de l'orchestrateur ──
ok('cancelAll présent', !!cancelCall);
ok('P-02 : au moins un scheduleNotificationAsync', scheduleCalls.length > 0);
ok('P-02 : TOUT scheduleNotificationAsync est dans scheduleAllNotifications',
  !!schedFn && scheduleCalls.every((c) => c.start >= schedFn.start && c.end <= schedFn.end));
ok('P-02 : cancelAll est dans scheduleAllNotifications',
  !!schedFn && !!cancelCall && cancelCall.start >= schedFn.start && cancelCall.end <= schedFn.end);
ok('P-02 : cancelAll s\'exécute AVANT tout scheduling (cancel-first)',
  !!cancelCall && scheduleCalls.length > 0 && scheduleCalls.every((c) => cancelCall.start < c.start));

console.log(`\nnotificationScheduler.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
