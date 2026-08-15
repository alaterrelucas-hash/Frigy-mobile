/**
 * N6-11 (2.6) — Entitlement authority COORDINATOR : tests de CONCURRENCE réels (promesses différées).
 *   node src/utils/entitlementCoordinator.test.js
 * Le coordinateur est pur/injectable → on contrôle finement la résolution des opérations RevenueCat
 * simulées pour prouver : une seule op d'autorité à la fois, aucun écrasement par un résultat plus
 * ancien, échec préserve l'autorité établie, démontage sûr.
 */
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'entitlement.js'), 'utf8')
  .replace(/export const /g, 'const ').replace(/export function /g, 'function ')
  + '\nmodule.exports={ENTITLEMENT,createEntitlementCoordinator};';
const m = new module.constructor(); m._compile(code, 'entitlement.js');
const { ENTITLEMENT: E, createEntitlementCoordinator: create } = m.exports;

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };
const tick = () => new Promise((r) => setImmediate(r)); // laisse les microtâches se vider

const CI = (pro) => ({ entitlements: { active: pro ? { pro: {} } : {} } });
const defer = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

// Fabrique de mock : chaque appel renvoie une promesse différée qu'on résout/rejette à la main.
function mock(kind) {
  const calls = [];
  const fn = (arg) => { const d = defer(); calls.push({ d, arg }); return kind === 'purchase' ? d.promise.then((ci) => ({ customerInfo: ci })) : d.promise; };
  return {
    fn,
    get count() { return calls.length; },
    resolve(i, pro) { calls[i].d.resolve(CI(pro)); },
    reject(i, e) { calls[i].d.reject(e || new Error('net')); },
  };
}

async function run() {
  // ── Q1 DOUBLE REFRESH : une seule requête, pas d'écrasement ──
  {
    const gci = mock();
    const c = create({ getCustomerInfo: gci.fn });
    const p1 = c.check();
    const r2 = await c.check(); // busy → skipped, aucune 2e requête
    ok('Q1 2e refresh skipped', r2.skipped === true);
    ok('Q1 une seule requête getCustomerInfo', gci.count === 1);
    gci.resolve(0, true); await p1; await tick();
    ok('Q1 statut final PRO', c.getStatus() === E.PRO);
  }

  // ── Q2 REFRESH + RESTORE : restore ne démarre pas pendant un refresh en vol ──
  {
    const gci = mock(); const rst = mock();
    const c = create({ getCustomerInfo: gci.fn, restorePurchases: rst.fn });
    const p1 = c.check();
    const r = await c.restore();
    ok('Q2 restore skipped pendant refresh', r.skipped === true);
    ok('Q2 restorePurchases jamais appelé', rst.count === 0);
    gci.resolve(0, false); await p1; await tick();
    ok('Q2 refresh résout FREE', c.getStatus() === E.FREE);
    const p2 = c.restore(); ok('Q2 restore ultérieur démarre (1 appel)', rst.count === 1);
    rst.resolve(0, true); await p2; await tick();
    ok('Q2 restore ultérieur → PRO', c.getStatus() === E.PRO);
  }

  // ── Q3 RESTORE + PURCHASE (et inverse) : pas d'appel concurrent ──
  {
    const rst = mock(); const pur = mock('purchase');
    const c = create({ restorePurchases: rst.fn, purchaseStoreProduct: pur.fn });
    const p1 = c.restore();
    const r = await c.purchase({ id: 'x' });
    ok('Q3 purchase skipped pendant restore', r.skipped === true);
    ok('Q3 purchaseStoreProduct jamais appelé', pur.count === 0);
    rst.resolve(0, false); await p1; await tick();
  }
  {
    const rst = mock(); const pur = mock('purchase');
    const c = create({ restorePurchases: rst.fn, purchaseStoreProduct: pur.fn });
    const p1 = c.purchase({ id: 'x' });
    const r = await c.restore();
    ok('Q3inv restore skipped pendant purchase', r.skipped === true);
    ok('Q3inv restorePurchases jamais appelé', rst.count === 0);
    pur.resolve(0, true); await p1; await tick();
    ok('Q3inv purchase → PRO', c.getStatus() === E.PRO);
  }

  // ── Q4 KNOWN PRO + refresh échec → reste PRO ──
  {
    const gci = mock();
    const c = create({ getCustomerInfo: gci.fn });
    let p = c.check(); gci.resolve(0, true); await p; await tick();
    ok('Q4 établi PRO', c.getStatus() === E.PRO);
    p = c.check(); gci.reject(1); await p; await tick();
    ok('Q4 PRO survit à un échec de refresh', c.getStatus() === E.PRO);
  }

  // ── Q5 KNOWN FREE + refresh échec → reste FREE ──
  {
    const gci = mock();
    const c = create({ getCustomerInfo: gci.fn });
    let p = c.check(); gci.resolve(0, false); await p; await tick();
    ok('Q5 établi FREE', c.getStatus() === E.FREE);
    p = c.check(); gci.reject(1); await p; await tick();
    ok('Q5 FREE survit à un échec de refresh', c.getStatus() === E.FREE);
  }

  // ── Q6 première vérif échoue → ERROR ──
  {
    const gci = mock();
    const c = create({ getCustomerInfo: gci.fn });
    const p = c.check(); gci.reject(0); await p; await tick();
    ok('Q6 1er échec → ERROR (jamais FREE)', c.getStatus() === E.ERROR);
  }

  // ── Q7 ERROR retry succès → PRO ──
  {
    const gci = mock();
    const c = create({ getCustomerInfo: gci.fn });
    let p = c.check(); gci.reject(0); await p; await tick();
    ok('Q7 pré-ERROR', c.getStatus() === E.ERROR);
    p = c.check(); gci.resolve(1, true); await p; await tick();
    ok('Q7 retry pro → PRO', c.getStatus() === E.PRO);
  }

  // ── Q8 restore succès pro → PRO ; Q9 restore sans pro → FREE ──
  {
    const rst = mock();
    const c = create({ restorePurchases: rst.fn });
    let p = c.restore(); rst.resolve(0, true); await p; await tick();
    ok('Q8 restore pro → PRO', c.getStatus() === E.PRO);
  }
  {
    const rst = mock();
    const c = create({ restorePurchases: rst.fn });
    const p = c.restore(); rst.resolve(0, false); await p; await tick();
    ok('Q9 restore sans pro → FREE (autoritatif)', c.getStatus() === E.FREE);
  }

  // ── Q10 purchase sans pro → ne devient pas PRO ; Q11 purchase pro → PRO ──
  {
    const pur = mock('purchase');
    const c = create({ purchaseStoreProduct: pur.fn });
    const p = c.purchase({ id: 'x' }); pur.resolve(0, false); const r = await p; await tick();
    ok('Q10 purchase sans pro ne fabrique pas PRO', c.getStatus() !== E.PRO);
    ok('Q10 purchase renvoie pro=false', r.pro === false);
  }
  {
    const pur = mock('purchase');
    const c = create({ purchaseStoreProduct: pur.fn });
    const p = c.purchase({ id: 'x' }); pur.resolve(0, true); const r = await p; await tick();
    ok('Q11 purchase pro → PRO', c.getStatus() === E.PRO && r.pro === true);
  }

  // ── Q12 erreur libère le verrou → retry possible ──
  {
    const gci = mock();
    const c = create({ getCustomerInfo: gci.fn });
    let p = c.check(); gci.reject(0); await p; await tick();
    ok('Q12 verrou libéré après erreur (isBusy false)', c.isBusy() === false);
    p = c.check(); ok('Q12 retry redémarre une requête', gci.count === 2);
    gci.resolve(1, true); await p; await tick();
    ok('Q12 retry aboutit', c.getStatus() === E.PRO);
  }

  // ── Q13 démontage : aucune écriture d'état après dispose ──
  {
    const gci = mock();
    let changes = 0; let lastStatus = null;
    const c = create({ getCustomerInfo: gci.fn, onChange: ({ status }) => { changes++; lastStatus = status; } });
    const p = c.check();      // busy=true → 1 notify
    const changesBefore = changes;
    c.dispose();              // démontage pendant l'op en vol
    gci.resolve(0, true);     // résout APRÈS dispose
    await p; await tick();
    ok('Q13 pas de notify après dispose', changes === changesBefore);
    ok('Q13 statut non écrit après dispose (reste UNKNOWN)', c.getStatus() === E.UNKNOWN);
  }

  // ── SDK indisponible : dep absente → ERROR (jamais FREE) ──
  {
    const c = create({}); // aucune dep
    const r = await c.check();
    ok('SDK absent → ERROR', r.status === E.ERROR && c.getStatus() === E.ERROR);
    const rp = await c.purchase({ id: 'x' });
    ok('SDK absent → purchase skipped', rp.skipped === true);
  }

  console.log(`\nentitlementCoordinator: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

run();
