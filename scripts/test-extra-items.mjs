/**
 * Multi-Service Booking with Extra Items + Partial Gift Card Test
 *
 * Tests:
 *  A. Service ($65) + product add-on ($25) with $50 gift card → total $40
 *  B. Service ($65) + two products ($25 + $15) with $80 gift card → total $25
 *  C. Service ($65) + product ($25) with discount (20%) + $50 gift card
 *     → $65 + $25 = $90 subtotal, 20% off service = $90 - $13 = $77, gift $50 → charge $27
 *  D. Extra items with no gift card, discount only
 *  E. Verify extra items are stored as valid JSON in DB and totals match
 */
import { createConnection } from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
const OWNER_ID = 660001;
const SLUG = 'd-xjxndn';
const API = 'http://localhost:3000';

let errors = [];
let passed = 0;
let createdApptIds = [];

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    errors.push(`${label}${detail ? ': ' + detail : ''}`);
  }
}

function round2(n) { return Math.round(n * 100) / 100; }

async function fetchJson(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const text = await res.text();
  try { return { status: res.status, ok: res.ok, data: JSON.parse(text) }; }
  catch(e) { return { status: res.status, ok: res.ok, data: text }; }
}

function futureWeekday(weeksFromNow, dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + weeksFromNow * 7 + dayOffset);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() + 1);
  if (day === 6) d.setDate(d.getDate() + 2);
  return d.toISOString().split('T')[0];
}

async function createTestGiftCard(conn, balance, code) {
  const localId = `test-ei-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  const expiryStr = expiresAt.toISOString().split('T')[0];
  const giftData = JSON.stringify({ originalValue: balance, remainingBalance: balance, serviceIds: [], productIds: [] });
  const message = `Test gift card $${balance}\n---GIFT_DATA---\n${giftData}`;
  await conn.execute(
    `INSERT INTO gift_cards (businessOwnerId, localId, code, serviceLocalId, redeemed, message, expiresAt)
     VALUES (?, ?, ?, '', 0, ?, ?)`,
    [OWNER_ID, localId, code, message, expiryStr]
  );
  return localId;
}

async function getGiftCardBalance(code) {
  const res = await fetchJson(`/api/public/gift/${code}`);
  return res.data?.remainingBalance ?? null;
}

async function bookWithExtras({ date, time, serviceLocalId, servicePrice, duration, locationId,
  clientName, clientPhone, extraItems, giftCode, giftBalance, discountName, discountPct, discountAmt }) {

  const extrasTotal = extraItems.reduce((s, e) => s + e.price, 0);
  const subtotal = round2(servicePrice + extrasTotal);
  const afterDiscount = discountAmt ? round2(subtotal - discountAmt) : subtotal;
  const giftUsed = giftBalance != null ? round2(Math.min(giftBalance, afterDiscount)) : 0;
  const finalTotal = round2(afterDiscount - giftUsed);

  const body = {
    clientName,
    clientPhone,
    clientEmail: `${clientPhone}@test.com`,
    serviceLocalId,
    date,
    time,
    duration,
    notes: `Extra items test — service $${servicePrice} + extras $${extrasTotal}`,
    totalPrice: finalTotal.toFixed(2),
    extraItems,
    locationId,
  };

  if (giftCode) {
    body.giftCode = giftCode;
    body.giftApplied = true;
    body.giftUsedAmount = giftUsed.toFixed(2);
  }

  if (discountName) {
    body.discountName = discountName;
    body.discountPercentage = discountPct;
    body.discountAmount = discountAmt.toFixed(2);
    body.subtotal = servicePrice.toFixed(2);
  }

  const resp = await fetchJson(`/api/public/business/${SLUG}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return { resp, subtotal, afterDiscount, giftUsed, finalTotal, extrasTotal };
}

async function main() {
  const conn = await createConnection(DB_URL);
  console.log('✅ Connected to DB\n');

  const [locs] = await conn.execute('SELECT localId, name FROM locations WHERE businessOwnerId = ? AND active = 1', [OWNER_ID]);
  const [svcs] = await conn.execute('SELECT localId, name, price, duration FROM services WHERE businessOwnerId = ? ORDER BY price ASC', [OWNER_ID]);
  const [prods] = await conn.execute('SELECT localId, name, price FROM products WHERE businessOwnerId = ? ORDER BY price ASC', [OWNER_ID]);
  const [discs] = await conn.execute('SELECT localId, name, percentage FROM discounts WHERE businessOwnerId = ? AND active = 1', [OWNER_ID]);

  const loc = locs[0];
  const svc65 = svcs.find(s => parseFloat(s.price) === 65) || svcs[0];
  const prod25 = prods.find(p => parseFloat(p.price) >= 20 && parseFloat(p.price) <= 30) || prods[0];
  const prod15 = prods.find(p => parseFloat(p.price) >= 10 && parseFloat(p.price) <= 20) || prods[1] || prods[0];
  const hairDisc = discs.find(d => d.name === 'Morning Hair Special');

  console.log(`Fixtures: loc=${loc.name}`);
  console.log(`  svc65: ${svc65.name} $${svc65.price} (${svc65.duration}min)`);
  console.log(`  prod25: ${prod25.name} $${prod25.price}`);
  console.log(`  prod15: ${prod15.name} $${prod15.price}`);
  console.log(`  discount: ${hairDisc?.name} ${hairDisc?.percentage}%\n`);

  const prod25Price = parseFloat(prod25.price);
  const prod15Price = parseFloat(prod15.price);

  // ── Scenario A: Service + 1 Product + Partial Gift Card ─────────────
  console.log('=== Scenario A: Service ($65) + Product add-on + $50 gift card ===');
  const prod25Actual = prod25Price; // e.g. $25
  const expectedSubtotalA = round2(65 + prod25Actual);
  const expectedGiftUsedA = round2(Math.min(50, expectedSubtotalA));
  const expectedTotalA = round2(expectedSubtotalA - expectedGiftUsedA);
  console.log(`  Math: $65 + $${prod25Actual} = $${expectedSubtotalA} subtotal → gift $${expectedGiftUsedA} → charge $${expectedTotalA}\n`);

  const RUN_ID = Date.now().toString(36).slice(-4).toUpperCase();
  const gcA = `EI-A-${RUN_ID}`;
  await createTestGiftCard(conn, 50, gcA);

  const dateA = futureWeekday(3);
  const slotsA = await fetchJson(`/api/public/business/${SLUG}/slots?date=${dateA}&duration=${svc65.duration}&locationId=${loc.localId}`);
  const slotA = (slotsA.data?.slots || slotsA.data)?.[0] || '09:00';

  const extraItemsA = [{ localId: prod25.localId, name: prod25.name, price: prod25Actual, type: 'product' }];
  const { resp: respA, finalTotal: totalA, giftUsed: giftUsedA, extrasTotal: extrasTotalA } = await bookWithExtras({
    date: dateA, time: slotA,
    serviceLocalId: svc65.localId, servicePrice: 65, duration: svc65.duration,
    locationId: loc.localId, clientName: 'Extra Items Client A', clientPhone: '4125560001',
    extraItems: extraItemsA, giftCode: gcA, giftBalance: 50,
  });

  assert(respA.ok, `Scenario A: Booking POST returns 200`, `status=${respA.status} ${JSON.stringify(respA.data).slice(0,100)}`);
  assert(Math.abs(totalA - expectedTotalA) < 0.01, `Scenario A: Final charge = $${expectedTotalA.toFixed(2)}`, `got $${totalA}`);
  assert(Math.abs(giftUsedA - expectedGiftUsedA) < 0.01, `Scenario A: Gift used = $${expectedGiftUsedA.toFixed(2)}`, `got $${giftUsedA}`);

  if (respA.data?.appointmentId || respA.data?.localId) {
    const apptId = respA.data.appointmentId || respA.data.localId;
    createdApptIds.push(apptId);

    const [dbA] = await conn.execute('SELECT * FROM appointments WHERE localId = ? AND businessOwnerId = ?', [apptId, OWNER_ID]);
    if (dbA[0]) {
      assert(Math.abs(parseFloat(dbA[0].totalPrice) - expectedTotalA) < 0.01,
        `Scenario A: DB totalPrice = $${expectedTotalA.toFixed(2)}`, `got $${dbA[0].totalPrice}`);
      assert(Math.abs(parseFloat(dbA[0].giftUsedAmount) - expectedGiftUsedA) < 0.01,
        `Scenario A: DB giftUsedAmount = $${expectedGiftUsedA.toFixed(2)}`, `got $${dbA[0].giftUsedAmount}`);

      // Verify extraItems is valid JSON in DB
      const rawExtra = dbA[0].extraItems;
      let parsedExtra;
      try {
        parsedExtra = typeof rawExtra === 'string' ? JSON.parse(rawExtra) : rawExtra;
      } catch(e) { parsedExtra = null; }
      assert(Array.isArray(parsedExtra) && parsedExtra.length === 1,
        `Scenario A: DB extraItems is valid JSON array with 1 item`, `got ${JSON.stringify(rawExtra).slice(0,80)}`);
      if (parsedExtra?.[0]) {
        assert(parsedExtra[0].name === prod25.name, `Scenario A: extraItems[0].name = "${prod25.name}"`, `got "${parsedExtra[0].name}"`);
        assert(Math.abs(parsedExtra[0].price - prod25Actual) < 0.01, `Scenario A: extraItems[0].price = $${prod25Actual}`, `got $${parsedExtra[0].price}`);
        assert(parsedExtra[0].type === 'product', `Scenario A: extraItems[0].type = "product"`, `got "${parsedExtra[0].type}"`);
      }
    }

    // Gift card balance: $50 - $giftUsedA = $50 - min(50, subtotal)
    const expectedBalA = round2(50 - expectedGiftUsedA);
    const balA = await getGiftCardBalance(gcA);
    assert(Math.abs(balA - expectedBalA) < 0.01, `Scenario A: Gift card balance = $${expectedBalA.toFixed(2)} after booking`, `got $${balA}`);
    console.log(`  Gift card ${gcA}: $50 → $${balA} after booking ✓`);
  }

  // ── Scenario B: Service + 2 Products + Over-balance Gift Card ────────
  console.log('\n=== Scenario B: Service ($65) + 2 Products + $80 gift card ===');
  const expectedSubtotalB = round2(65 + prod25Actual + prod15Price);
  const expectedGiftUsedB = round2(Math.min(80, expectedSubtotalB));
  const expectedTotalB = round2(expectedSubtotalB - expectedGiftUsedB);
  const expectedCardRemB = round2(80 - expectedGiftUsedB);
  console.log(`  Math: $65 + $${prod25Actual} + $${prod15Price} = $${expectedSubtotalB} → gift $${expectedGiftUsedB} → charge $${expectedTotalB}, card retains $${expectedCardRemB}\n`);

  const gcB = `EI-B-${RUN_ID}`;
  await createTestGiftCard(conn, 80, gcB);

  const dateB = futureWeekday(4);
  const slotsB = await fetchJson(`/api/public/business/${SLUG}/slots?date=${dateB}&duration=${svc65.duration}&locationId=${loc.localId}`);
  const slotB = (slotsB.data?.slots || slotsB.data)?.[0] || '09:00';

  const extraItemsB = [
    { localId: prod25.localId, name: prod25.name, price: prod25Actual, type: 'product' },
    { localId: prod15.localId, name: prod15.name, price: prod15Price, type: 'product' },
  ];
  const { resp: respB, finalTotal: totalB, giftUsed: giftUsedB } = await bookWithExtras({
    date: dateB, time: slotB,
    serviceLocalId: svc65.localId, servicePrice: 65, duration: svc65.duration,
    locationId: loc.localId, clientName: 'Extra Items Client B', clientPhone: '4125560002',
    extraItems: extraItemsB, giftCode: gcB, giftBalance: 80,
  });

  assert(respB.ok, `Scenario B: Booking POST returns 200`, `status=${respB.status}`);
  assert(Math.abs(totalB - expectedTotalB) < 0.01, `Scenario B: Final charge = $${expectedTotalB.toFixed(2)}`, `got $${totalB}`);
  assert(Math.abs(giftUsedB - expectedGiftUsedB) < 0.01, `Scenario B: Gift used = $${expectedGiftUsedB.toFixed(2)}`, `got $${giftUsedB}`);

  if (respB.data?.appointmentId || respB.data?.localId) {
    const apptId = respB.data.appointmentId || respB.data.localId;
    createdApptIds.push(apptId);

    const [dbB] = await conn.execute('SELECT * FROM appointments WHERE localId = ? AND businessOwnerId = ?', [apptId, OWNER_ID]);
    if (dbB[0]) {
      const rawExtra = dbB[0].extraItems;
      let parsedExtra;
      try { parsedExtra = typeof rawExtra === 'string' ? JSON.parse(rawExtra) : rawExtra; } catch(e) { parsedExtra = null; }
      assert(Array.isArray(parsedExtra) && parsedExtra.length === 2,
        `Scenario B: DB extraItems is valid JSON array with 2 items`, `got ${JSON.stringify(rawExtra).slice(0,80)}`);
      assert(Math.abs(parseFloat(dbB[0].totalPrice) - expectedTotalB) < 0.01,
        `Scenario B: DB totalPrice = $${expectedTotalB.toFixed(2)}`, `got $${dbB[0].totalPrice}`);
    }

    const balB = await getGiftCardBalance(gcB);
    assert(Math.abs(balB - expectedCardRemB) < 0.01, `Scenario B: Gift card retains $${expectedCardRemB.toFixed(2)}`, `got $${balB}`);
    console.log(`  Gift card ${gcB}: $80 → $${balB} after booking ✓`);
  }

  // ── Scenario C: Service + Product + Discount + Partial Gift Card ─────
  console.log('\n=== Scenario C: Service ($65) + Product + 20% discount + $50 gift card ===');
  // Discount applies to service only (per the discount's scope)
  const discPct = parseFloat(hairDisc?.percentage || 20);
  const discAmtC = round2(65 * discPct / 100); // $13 off service
  // Total = service + product - discount on service
  const expectedSubtotalC = round2(65 + prod25Actual - discAmtC);
  const expectedGiftUsedC = round2(Math.min(50, expectedSubtotalC));
  const expectedTotalC = round2(expectedSubtotalC - expectedGiftUsedC);
  console.log(`  Math: ($65 - $${discAmtC} disc) + $${prod25Actual} = $${expectedSubtotalC} → gift $${expectedGiftUsedC} → charge $${expectedTotalC}\n`);

  const gcC = `EI-C-${RUN_ID}`;
  await createTestGiftCard(conn, 50, gcC);

  const dateC = futureWeekday(5);
  const slotsC = await fetchJson(`/api/public/business/${SLUG}/slots?date=${dateC}&duration=${svc65.duration}&locationId=${loc.localId}`);
  const slotC = (slotsC.data?.slots || slotsC.data)?.[0] || '09:00';

  const extraItemsC = [{ localId: prod25.localId, name: prod25.name, price: prod25Actual, type: 'product' }];
  const { resp: respC, finalTotal: totalC, giftUsed: giftUsedC } = await bookWithExtras({
    date: dateC, time: slotC,
    serviceLocalId: svc65.localId, servicePrice: 65, duration: svc65.duration,
    locationId: loc.localId, clientName: 'Extra Items Client C', clientPhone: '4125560003',
    extraItems: extraItemsC, giftCode: gcC, giftBalance: 50,
    discountName: hairDisc?.name, discountPct: discPct, discountAmt: discAmtC,
  });

  assert(respC.ok, `Scenario C: Booking POST returns 200`, `status=${respC.status} ${JSON.stringify(respC.data).slice(0,100)}`);
  assert(Math.abs(totalC - expectedTotalC) < 0.01, `Scenario C: Final charge = $${expectedTotalC.toFixed(2)}`, `got $${totalC}`);
  assert(Math.abs(giftUsedC - expectedGiftUsedC) < 0.01, `Scenario C: Gift used = $${expectedGiftUsedC.toFixed(2)}`, `got $${giftUsedC}`);

  if (respC.data?.appointmentId || respC.data?.localId) {
    const apptId = respC.data.appointmentId || respC.data.localId;
    createdApptIds.push(apptId);

    const [dbC] = await conn.execute('SELECT * FROM appointments WHERE localId = ? AND businessOwnerId = ?', [apptId, OWNER_ID]);
    if (dbC[0]) {
      assert(Math.abs(parseFloat(dbC[0].totalPrice) - expectedTotalC) < 0.01,
        `Scenario C: DB totalPrice = $${expectedTotalC.toFixed(2)}`, `got $${dbC[0].totalPrice}`);
      assert(Math.abs(parseFloat(dbC[0].discountAmount) - discAmtC) < 0.01,
        `Scenario C: DB discountAmount = $${discAmtC.toFixed(2)}`, `got $${dbC[0].discountAmount}`);
      assert(Math.abs(parseFloat(dbC[0].giftUsedAmount) - expectedGiftUsedC) < 0.01,
        `Scenario C: DB giftUsedAmount = $${expectedGiftUsedC.toFixed(2)}`, `got $${dbC[0].giftUsedAmount}`);
      const rawExtra = dbC[0].extraItems;
      let parsedExtra;
      try { parsedExtra = typeof rawExtra === 'string' ? JSON.parse(rawExtra) : rawExtra; } catch(e) { parsedExtra = null; }
      assert(Array.isArray(parsedExtra) && parsedExtra.length === 1,
        `Scenario C: DB extraItems has 1 product item`, `got ${JSON.stringify(rawExtra).slice(0,80)}`);
    }
    console.log(`  Math verified: $65 - $${discAmtC} + $${prod25Actual} = $${expectedSubtotalC} → gift $${expectedGiftUsedC} → charge $${expectedTotalC}`);
  }

  // ── Scenario D: Service + Product + Discount Only (no gift card) ─────
  console.log('\n=== Scenario D: Service ($65) + Product + 20% discount, no gift card ===');
  const discAmtD = round2(65 * discPct / 100); // $13
  const expectedTotalD = round2(65 + prod25Actual - discAmtD);
  console.log(`  Math: ($65 - $${discAmtD} disc) + $${prod25Actual} = $${expectedTotalD}\n`);

  const dateD = futureWeekday(6);
  const slotsD = await fetchJson(`/api/public/business/${SLUG}/slots?date=${dateD}&duration=${svc65.duration}&locationId=${loc.localId}`);
  const slotD = (slotsD.data?.slots || slotsD.data)?.[0] || '09:00';

  const extraItemsD = [{ localId: prod25.localId, name: prod25.name, price: prod25Actual, type: 'product' }];
  const { resp: respD, finalTotal: totalD } = await bookWithExtras({
    date: dateD, time: slotD,
    serviceLocalId: svc65.localId, servicePrice: 65, duration: svc65.duration,
    locationId: loc.localId, clientName: 'Extra Items Client D', clientPhone: '4125560004',
    extraItems: extraItemsD,
    discountName: hairDisc?.name, discountPct: discPct, discountAmt: discAmtD,
  });

  assert(respD.ok, `Scenario D: Booking POST returns 200`, `status=${respD.status}`);
  assert(Math.abs(totalD - expectedTotalD) < 0.01, `Scenario D: Final charge = $${expectedTotalD.toFixed(2)}`, `got $${totalD}`);

  if (respD.data?.appointmentId || respD.data?.localId) {
    const apptId = respD.data.appointmentId || respD.data.localId;
    createdApptIds.push(apptId);

    const [dbD] = await conn.execute('SELECT * FROM appointments WHERE localId = ? AND businessOwnerId = ?', [apptId, OWNER_ID]);
    if (dbD[0]) {
      assert(Math.abs(parseFloat(dbD[0].totalPrice) - expectedTotalD) < 0.01,
        `Scenario D: DB totalPrice = $${expectedTotalD.toFixed(2)}`, `got $${dbD[0].totalPrice}`);
      assert(dbD[0].giftApplied === 0 || dbD[0].giftApplied === false || dbD[0].giftApplied === null,
        `Scenario D: DB giftApplied = false (no gift card)`, `got ${dbD[0].giftApplied}`);
      const rawExtra = dbD[0].extraItems;
      let parsedExtra;
      try { parsedExtra = typeof rawExtra === 'string' ? JSON.parse(rawExtra) : rawExtra; } catch(e) { parsedExtra = null; }
      assert(Array.isArray(parsedExtra) && parsedExtra.length === 1,
        `Scenario D: DB extraItems has 1 product item`, `got ${JSON.stringify(rawExtra).slice(0,80)}`);
    }
  }

  // ── Scenario E: Verify pricing breakdown in appointment notes ─────────
  console.log('\n=== Scenario E: Verify pricing breakdown in appointment notes ===');
  // Check the last created appointment (Scenario D) for the pricing breakdown in notes
  if (createdApptIds.length > 0) {
    const lastId = createdApptIds[createdApptIds.length - 1];
    const [dbE] = await conn.execute('SELECT notes FROM appointments WHERE localId = ? AND businessOwnerId = ?', [lastId, OWNER_ID]);
    if (dbE[0]) {
      const notes = dbE[0].notes || '';
      assert(notes.includes('--- Pricing ---'), `Scenario E: Notes contain "--- Pricing ---" section`);
      assert(notes.includes('Service:'), `Scenario E: Notes contain "Service:" line`);
      assert(notes.includes('Product:') || notes.includes('Extra:'), `Scenario E: Notes contain "Product:" or "Extra:" line`);
      assert(notes.includes('Discount:'), `Scenario E: Notes contain "Discount:" line`);
      assert(notes.includes('Total Charged:'), `Scenario E: Notes contain "Total Charged:" line`);
      console.log(`  Notes preview:\n${notes.split('\n').map(l => '    ' + l).join('\n')}`);
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────
  console.log('\n=== Cleanup ===');
  for (const id of createdApptIds) {
    await conn.execute('DELETE FROM appointments WHERE localId = ? AND businessOwnerId = ?', [id, OWNER_ID]);
  }
  for (const code of [gcA, gcB, gcC]) {
    await conn.execute('DELETE FROM gift_cards WHERE code = ? AND businessOwnerId = ?', [code, OWNER_ID]);
  }
  console.log(`  Removed ${createdApptIds.length} test appointments and 3 test gift cards`);

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`EXTRA ITEMS TEST RESULTS: ${passed} passed, ${errors.length} failed`);
  if (errors.length > 0) {
    console.log('\n❌ FAILURES:');
    errors.forEach(e => console.log('  - ' + e));
  } else {
    console.log('\n🎉 All extra items tests passed!');
  }

  await conn.end();
}

main().catch(err => {
  console.error('❌ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
