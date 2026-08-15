/**
 * N6-12 — Consume/Waste Write Authority. Classification PURE + concurrence RÉELLE (promesses différées) :
 *   node src/utils/consumptionOutcome.test.js
 */
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'consumptionOutcome.js'), 'utf8')
  .replace(/export function /g, 'function ')
  + '\nmodule.exports={classifyConsumeResult,createConsumeCoordinator};';
const m = new module.constructor(); m._compile(code, 'consumptionOutcome.js');
const { classifyConsumeResult: C, createConsumeCoordinator: create } = m.exports;

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };
const tick = () => new Promise((r) => setImmediate(r));
const defer = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

// ── classifyConsumeResult : succès = erreur nulle + exactement 1 ligne + id correspondant ──
ok('CLS succès (1 ligne, id ok)', C({ error: null, data: [{ id: 'x' }], expectedId: 'x' }) === true);
ok('CLS erreur → échec', C({ error: { message: 'net' }, data: [{ id: 'x' }], expectedId: 'x' }) === false);
ok('CLS zéro ligne → échec', C({ error: null, data: [], expectedId: 'x' }) === false);
ok('CLS plusieurs lignes → échec', C({ error: null, data: [{ id: 'x' }, { id: 'y' }], expectedId: 'x' }) === false);
ok('CLS mauvais id → échec', C({ error: null, data: [{ id: 'y' }], expectedId: 'x' }) === false);
ok('CLS data non-tableau → échec', C({ error: null, data: null, expectedId: 'x' }) === false);
ok('CLS aucun argument → échec', C() === false);
ok('CLS erreur nulle SEULE insuffisante (data manquante)', C({ error: null, expectedId: 'x' }) === false);

// ── Mock mutate différé ──
function mock() {
  const calls = [];
  const fn = (item, wasted) => { const d = defer(); calls.push({ d, item, wasted }); return d.promise; };
  return { fn, get count() { return calls.length; }, resolve(i, v) { calls[i].d.resolve(v); }, reject(i, e) { calls[i].d.reject(e || new Error('net')); } };
}
const OKRES = (id) => ({ error: null, data: [{ id }] });

async function run() {
  // ── Single-flight : 2e action pendant la 1re → skipped, PAS de 2e mutation ──
  {
    const mk = mock(); const c = create({ mutate: mk.fn });
    const p1 = c.run({ id: 'a' }, true);
    const r2 = await c.run({ id: 'a' }, true);
    ok('SF 2e run skipped', r2.skipped === true);
    ok('SF une seule mutation', mk.count === 1);
    mk.resolve(0, OKRES('a')); const r1 = await p1; await tick();
    ok('SF 1re run ok', r1.ok === true && !r1.skipped);
    ok('SF verrou libéré (isBusy false)', c.isBusy() === false);
    const p3 = c.run({ id: 'a' }, true); ok('SF run ultérieur redémarre une mutation', mk.count === 2);
    mk.resolve(1, OKRES('a')); await p3;
  }

  // ── Classification via coordinateur ──
  {
    const mk = mock(); const c = create({ mutate: mk.fn });
    const p = c.run({ id: 'x' }, true); mk.resolve(0, { error: null, data: [{ id: 'x' }] }); const r = await p; await tick();
    ok('COORD succès → ok true', r.ok === true);
  }
  {
    const mk = mock(); const c = create({ mutate: mk.fn });
    const p = c.run({ id: 'x' }, false); mk.resolve(0, { error: { message: 'rls' }, data: null }); const r = await p; await tick();
    ok('COORD erreur → ok false', r.ok === false);
    ok('COORD verrou libéré après échec', c.isBusy() === false);
  }
  {
    const mk = mock(); const c = create({ mutate: mk.fn });
    const p = c.run({ id: 'x' }, true); mk.resolve(0, { error: null, data: [] }); const r = await p; await tick();
    ok('COORD zéro-ligne → ok false', r.ok === false);
  }
  {
    const mk = mock(); const c = create({ mutate: mk.fn });
    const p = c.run({ id: 'x' }, true); mk.reject(0); const r = await p; await tick();
    ok('COORD exception → ok false (jamais succès)', r.ok === false);
    ok('COORD verrou libéré après exception', c.isBusy() === false);
    const p2 = c.run({ id: 'x' }, true); ok('COORD retry possible après exception', mk.count === 2); mk.resolve(1, OKRES('x')); await p2;
  }

  // ── Double-tap ne peut jamais produire deux mutations (donc jamais deux analytics côté appelant) ──
  {
    const mk = mock(); const c = create({ mutate: mk.fn });
    const a = c.run({ id: 'z' }, true);
    const b = await c.run({ id: 'z' }, true);
    const d = await c.run({ id: 'z' }, true);
    ok('DT double/triple tap → 1 seule mutation', mk.count === 1 && b.skipped && d.skipped);
    mk.resolve(0, OKRES('z')); await a;
  }

  console.log(`\nconsumptionOutcome: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
run();
