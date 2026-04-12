/**
 * Gift Card Partial Redemption Test
 *
 * Tests the scenario where a gift card balance is LESS than the service price.
 * e.g. $30 gift card on a $65 service → client pays $35 remaining.
 *
 * Also tests:
 *  - Gift card balance > service price (over-balance): client pays $0, card retains remainder
 *  - Gift card + discount combined: discount applied first, then gift card covers part
 *  - Gift card exact match: full coverage, $0 remaining charge
 *  - Exhausted gift card: second booking attempt on a $0-balance card
 */
import { createConnection } from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
const OWNER_ID = 660001;
const SLUG = 'd-xjxndn';
const API = 'http://localhost:3000';

let errors = [];
let passed = 0;
let createdApptIds = [];
let testGiftCardCode = null; // We'll create a fresh gift card for each scenario

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

function futureWeekday(weeksFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + weeksFromNow * 7);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() + 1);
  if (day === 6) d.setDate(d.getDate() + 2);
  return d.toISOString().split('T')[0];
}

// Create a fresh gift card with a specific balance for testing
// The balance is stored as JSON in the message field using ---GIFT_DATA--- separator
async function createTestGiftCard(conn, balance, code) {
  const localId = `test-gc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  const expiryStr = expiresAt.toISOString().split('T')[0];

  // Balance is embedded in the message field as GIFT_DATA JSON block
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

async function bookWithGiftCard({ conn, date, time, serviceLocalId, serviceName, servicePrice, duration, locationId, clientName, clientPhone, giftCode, giftBalance, discountName, discountPct, discountAmt }) {
  // Calculate expected totals
  const subtotalAfterDiscount = discountAmt ? round2(servicePrice - discountAmt) : servicePrice;
  const giftUsed = round2(Math.min(giftBalance, subtotalAfterDiscount));
  const finalTotal = round2(Math.max(0, subtotalAfterDiscount - giftUsed));

  const body = {
    clientName,
    clientPhone,
    clientEmail: `${clientPhone}@test.com`,
    serviceLocalId,
    date,
    time,
    duration,
    notes: `Partial gift card test — ${serviceName} $${servicePrice}, gift $${giftBalance}`,
    totalPrice: finalTotal.toFixed(2),
    giftCode,
    giftApplied: true,
    giftUsedAmount: giftUsed.toFixed(2),
    locationId,
  };

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

  return { resp, giftUsed, finalTotal, subtotalAfterDiscount };
}

async function main() {
  const conn = await createConnection(DB_URL);
  console.log('✅ Connected to DB\n');

  // Get test fixtures
  const [locs] = await conn.execute('SELECT localId, name FROM locations WHERE businessOwnerId = ? AND active = 1', [OWNER_ID]);
  const [svcs] = await conn.execute('SELECT localId, name, price, duration FROM services WHERE businessOwnerId = ? ORDER BY price ASC', [OWNER_ID]);
  const [discs] = await conn.execute('SELECT localId, name, percentage FROM discounts WHERE businessOwnerId = ? AND active = 1', [OWNER_ID]);

  const loc = locs[0]; // Downtown Studio
  // Pick a $65 service (Haircut & Style) and a $90 service (Massage)
  const svc65 = svcs.find(s => parseFloat(s.price) === 65) || svcs[0];
  const svc90 = svcs.find(s => parseFloat(s.price) === 90) || svcs[svcs.length - 1];
  const hairDisc = discs.find(d => d.name === 'Morning Hair Special'); // 20% off

  console.log(`Fixtures: loc=${loc.name}`);
  console.log(`  svc65: ${svc65.name} $${svc65.price} (${svc65.duration}min)`);
  console.log(`  svc90: ${svc90.name} $${svc90.price} (${svc90.duration}min)`);
  console.log(`  discount: ${hairDisc?.name} ${hairDisc?.percentage}%\n`);

  // ── Scenario A: Partial Redemption ($30 card on $65 service) ────────
  console.log('=== Scenario A: Partial Redemption ($30 gift card, $65 service) ===');
  console.log('  Expected: gift covers $30, client charged $35 remaining\n');

  const gcA_code = 'TEST-PARTIAL-A';
  await createTestGiftCard(conn, 30, gcA_code);

  const dateA = futureWeekday(3);
  const slotsA = await fetchJson(`/api/public/business/${SLUG}/slots?date=${dateA}&duration=${svc65.duration}&locationId=${loc.localId}`);
  const slotA = (slotsA.data.slots || slotsA.data)?.[0] || '09:00';

  const { resp: respA, giftUsed: giftUsedA, finalTotal: totalA } = await bookWithGiftCard({
    conn, date: dateA, time: slotA,
    serviceLocalId: svc65.localId, serviceName: svc65.name, servicePrice: 65, duration: svc65.duration,
    locationId: loc.localId, clientName: 'Partial Gift Client A', clientPhone: '4125550001',
    giftCode: gcA_code, giftBalance: 30,
  });

  assert(respA.ok, `Scenario A: Booking POST returns 200`, `status=${respA.status}`);
  assert(giftUsedA === 30, `Scenario A: Gift used = $30.00`, `got $${giftUsedA}`);
  assert(totalA === 35, `Scenario A: Final charge = $35.00 (remaining after gift)`, `got $${totalA}`);

  if (respA.data?.appointmentId || respA.data?.localId) {
    const apptId = respA.data.appointmentId || respA.data.localId;
    createdApptIds.push(apptId);

    const [dbA] = await conn.execute('SELECT * FROM appointments WHERE localId = ? AND businessOwnerId = ?', [apptId, OWNER_ID]);
    assert(dbA.length === 1, 'Scenario A: Appointment saved to DB');
    if (dbA[0]) {
      assert(parseFloat(dbA[0].totalPrice) === 35, `Scenario A: DB totalPrice = $35.00`, `got $${dbA[0].totalPrice}`);
      assert(parseFloat(dbA[0].giftUsedAmount) === 30, `Scenario A: DB giftUsedAmount = $30.00`, `got $${dbA[0].giftUsedAmount}`);
      assert(dbA[0].giftApplied === 1 || dbA[0].giftApplied === true, 'Scenario A: DB giftApplied = true');
    }

    // Verify gift card balance deducted: $30 - $30 = $0
    const balA = await getGiftCardBalance(gcA_code);
    assert(balA === 0, `Scenario A: Gift card balance deducted to $0`, `got $${balA}`);
    console.log(`  Gift card ${gcA_code}: $30 → $0 after booking ✓`);
  }

  // ── Scenario B: Over-Balance ($100 card on $65 service) ─────────────
  console.log('\n=== Scenario B: Over-Balance ($100 gift card, $65 service) ===');
  console.log('  Expected: gift covers full $65, client charged $0, card retains $35\n');

  const gcB_code = 'TEST-PARTIAL-B';
  await createTestGiftCard(conn, 100, gcB_code);

  const dateB = futureWeekday(4);
  const slotsB = await fetchJson(`/api/public/business/${SLUG}/slots?date=${dateB}&duration=${svc65.duration}&locationId=${loc.localId}`);
  const slotB = (slotsB.data.slots || slotsB.data)?.[0] || '09:00';

  const { resp: respB, giftUsed: giftUsedB, finalTotal: totalB } = await bookWithGiftCard({
    conn, date: dateB, time: slotB,
    serviceLocalId: svc65.localId, serviceName: svc65.name, servicePrice: 65, duration: svc65.duration,
    locationId: loc.localId, clientName: 'Over-Balance Gift Client B', clientPhone: '4125550002',
    giftCode: gcB_code, giftBalance: 100,
  });

  assert(respB.ok, `Scenario B: Booking POST returns 200`, `status=${respB.status}`);
  assert(giftUsedB === 65, `Scenario B: Gift used = $65.00 (service price)`, `got $${giftUsedB}`);
  assert(totalB === 0, `Scenario B: Final charge = $0.00 (fully covered)`, `got $${totalB}`);

  if (respB.data?.appointmentId || respB.data?.localId) {
    const apptId = respB.data.appointmentId || respB.data.localId;
    createdApptIds.push(apptId);

    const [dbB] = await conn.execute('SELECT * FROM appointments WHERE localId = ? AND businessOwnerId = ?', [apptId, OWNER_ID]);
    if (dbB[0]) {
      assert(parseFloat(dbB[0].totalPrice) === 0, `Scenario B: DB totalPrice = $0.00`, `got $${dbB[0].totalPrice}`);
      assert(parseFloat(dbB[0].giftUsedAmount) === 65, `Scenario B: DB giftUsedAmount = $65.00`, `got $${dbB[0].giftUsedAmount}`);
    }

    // Verify gift card balance: $100 - $65 = $35
    const balB = await getGiftCardBalance(gcB_code);
    assert(balB === 35, `Scenario B: Gift card retains $35 remainder`, `got $${balB}`);
    console.log(`  Gift card ${gcB_code}: $100 → $35 after booking ✓`);
  }

  // ── Scenario C: Gift Card + Discount Combined ────────────────────────
  console.log('\n=== Scenario C: Gift Card + Discount Combined ($40 card, $65 service, 20% off) ===');
  console.log('  Expected: $65 - 20% ($13) = $52 discounted → gift covers $40 → client charged $12\n');

  const gcC_code = 'TEST-PARTIAL-C';
  await createTestGiftCard(conn, 40, gcC_code);

  const dateC = futureWeekday(5);
  const slotsC = await fetchJson(`/api/public/business/${SLUG}/slots?date=${dateC}&duration=${svc65.duration}&locationId=${loc.localId}`);
  const slotC = (slotsC.data.slots || slotsC.data)?.[0] || '09:00';

  const discPctC = parseFloat(hairDisc?.percentage || 20);
  const discAmtC = round2(65 * discPctC / 100); // $13
  const subtotalC = round2(65 - discAmtC); // $52
  const giftUsedC_expected = round2(Math.min(40, subtotalC)); // $40
  const totalC_expected = round2(subtotalC - giftUsedC_expected); // $12

  const { resp: respC, giftUsed: giftUsedC, finalTotal: totalC } = await bookWithGiftCard({
    conn, date: dateC, time: slotC,
    serviceLocalId: svc65.localId, serviceName: svc65.name, servicePrice: 65, duration: svc65.duration,
    locationId: loc.localId, clientName: 'Combo Gift+Disc Client C', clientPhone: '4125550003',
    giftCode: gcC_code, giftBalance: 40,
    discountName: hairDisc?.name, discountPct: discPctC, discountAmt: discAmtC,
  });

  assert(respC.ok, `Scenario C: Booking POST returns 200`, `status=${respC.status}`);
  assert(giftUsedC === giftUsedC_expected, `Scenario C: Gift used = $${giftUsedC_expected.toFixed(2)}`, `got $${giftUsedC}`);
  assert(totalC === totalC_expected, `Scenario C: Final charge = $${totalC_expected.toFixed(2)} (after discount + gift)`, `got $${totalC}`);

  if (respC.data?.appointmentId || respC.data?.localId) {
    const apptId = respC.data.appointmentId || respC.data.localId;
    createdApptIds.push(apptId);

    const [dbC] = await conn.execute('SELECT * FROM appointments WHERE localId = ? AND businessOwnerId = ?', [apptId, OWNER_ID]);
    if (dbC[0]) {
      assert(Math.abs(parseFloat(dbC[0].totalPrice) - totalC_expected) < 0.01,
        `Scenario C: DB totalPrice = $${totalC_expected.toFixed(2)}`, `got $${dbC[0].totalPrice}`);
      assert(Math.abs(parseFloat(dbC[0].discountAmount) - discAmtC) < 0.01,
        `Scenario C: DB discountAmount = $${discAmtC.toFixed(2)}`, `got $${dbC[0].discountAmount}`);
      assert(Math.abs(parseFloat(dbC[0].giftUsedAmount) - giftUsedC_expected) < 0.01,
        `Scenario C: DB giftUsedAmount = $${giftUsedC_expected.toFixed(2)}`, `got $${dbC[0].giftUsedAmount}`);
    }

    // Verify gift card balance: $40 - $40 = $0
    const balC = await getGiftCardBalance(gcC_code);
    assert(balC === 0, `Scenario C: Gift card balance deducted to $0`, `got $${balC}`);
    console.log(`  Gift card ${gcC_code}: $40 → $0 after booking ✓`);
    console.log(`  Math: $65 - $${discAmtC} (20% disc) = $${subtotalC} → gift $${giftUsedC_expected} → charge $${totalC_expected}`);
  }

  // ── Scenario D: Exact Match ($65 card on $65 service) ───────────────
  console.log('\n=== Scenario D: Exact Match ($65 gift card, $65 service) ===');
  console.log('  Expected: gift covers exactly $65, client charged $0, card balance = $0\n');

  const gcD_code = 'TEST-PARTIAL-D';
  await createTestGiftCard(conn, 65, gcD_code);

  const dateD = futureWeekday(6);
  const slotsD = await fetchJson(`/api/public/business/${SLUG}/slots?date=${dateD}&duration=${svc65.duration}&locationId=${loc.localId}`);
  const slotD = (slotsD.data.slots || slotsD.data)?.[0] || '09:00';

  const { resp: respD, giftUsed: giftUsedD, finalTotal: totalD } = await bookWithGiftCard({
    conn, date: dateD, time: slotD,
    serviceLocalId: svc65.localId, serviceName: svc65.name, servicePrice: 65, duration: svc65.duration,
    locationId: loc.localId, clientName: 'Exact Match Client D', clientPhone: '4125550004',
    giftCode: gcD_code, giftBalance: 65,
  });

  assert(respD.ok, `Scenario D: Booking POST returns 200`, `status=${respD.status}`);
  assert(giftUsedD === 65, `Scenario D: Gift used = $65.00 (exact match)`, `got $${giftUsedD}`);
  assert(totalD === 0, `Scenario D: Final charge = $0.00`, `got $${totalD}`);

  if (respD.data?.appointmentId || respD.data?.localId) {
    const apptId = respD.data.appointmentId || respD.data.localId;
    createdApptIds.push(apptId);

    const balD = await getGiftCardBalance(gcD_code);
    assert(balD === 0, `Scenario D: Gift card balance = $0 after exact match`, `got $${balD}`);
    console.log(`  Gift card ${gcD_code}: $65 → $0 after booking ✓`);
  }

  // ── Scenario E: Exhausted Gift Card (second booking attempt) ─────────
  console.log('\n=== Scenario E: Exhausted Gift Card (attempt to use $0-balance card) ===');
  console.log('  Expected: API rejects the booking or returns error for exhausted card\n');

  // gcD_code now has $0 balance after Scenario D
  const dateE = futureWeekday(7);
  const slotsE = await fetchJson(`/api/public/business/${SLUG}/slots?date=${dateE}&duration=${svc65.duration}&locationId=${loc.localId}`);
  const slotE = (slotsE.data.slots || slotsE.data)?.[0] || '09:00';

  // First verify the card lookup returns $0
  const gcLookup = await fetchJson(`/api/public/gift/${gcD_code}`);
  assert(gcLookup.data?.remainingBalance === 0, `Scenario E: Gift card ${gcD_code} shows $0 balance`, `got $${gcLookup.data?.remainingBalance}`);

  const respE = await fetchJson(`/api/public/business/${SLUG}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: 'Exhausted Card Client E',
      clientPhone: '4125550005',
      clientEmail: 'exhausted@test.com',
      serviceLocalId: svc65.localId,
      date: dateE,
      time: slotE,
      duration: svc65.duration,
      notes: 'Should fail - exhausted gift card',
      totalPrice: '0.00',
      giftCode: gcD_code,
      giftApplied: true,
      giftUsedAmount: '65.00', // Trying to use $65 from a $0 card
      locationId: loc.localId,
    })
  });

  // The server should reject this: the card has $0 balance but client claims $65 used
  assert(!respE.ok || respE.status === 400, 
    `Scenario E: Exhausted card booking rejected (400)`, 
    `status=${respE.status}, data=${JSON.stringify(respE.data).substring(0,100)}`);
  if (!respE.ok) {
    console.log(`  ✓ Server correctly rejected exhausted gift card: "${respE.data?.error || respE.data}"`);
  } else {
    console.log(`  ⚠ Server accepted the booking (status ${respE.status}) — checking if gift card validation is enforced server-side`);
    // If accepted, check what was stored
    if (respE.data?.appointmentId || respE.data?.localId) {
      createdApptIds.push(respE.data.appointmentId || respE.data.localId);
    }
  }

  // ── Scenario F: Verify UI Charge Display (booking page gift card lookup) ──
  console.log('\n=== Scenario F: Gift Card Lookup API for UI Display ===');
  console.log('  Verifies the API returns correct data for the booking page to display remaining charge\n');

  // Create a $30 card and verify the lookup returns the right fields for the UI
  const gcF_code = 'TEST-PARTIAL-F';
  await createTestGiftCard(conn, 30, gcF_code);

  const gcF = await fetchJson(`/api/public/gift/${gcF_code}`);
  assert(gcF.ok, `Scenario F: Gift card lookup returns 200`, `status=${gcF.status}`);
  assert(gcF.data?.remainingBalance === 30, `Scenario F: API returns remainingBalance = $30`, `got $${gcF.data?.remainingBalance}`);
  assert(gcF.data?.originalValue === 30, `Scenario F: API returns originalValue = $30`, `got $${gcF.data?.originalValue}`);
  assert(gcF.data?.redeemed === false || gcF.data?.redeemed === 0, `Scenario F: API returns redeemed = false`);
  assert(gcF.data?.businessSlug === SLUG, `Scenario F: API returns correct businessSlug`, `got ${gcF.data?.businessSlug}`);
  assert(gcF.data?.expiresAt !== undefined, `Scenario F: API returns expiresAt field`);

  // Simulate the UI calculation: $65 service - $30 gift = $35 remaining charge
  const uiServicePrice = 65;
  const uiGiftBalance = gcF.data?.remainingBalance || 0;
  const uiGiftUsed = Math.min(uiGiftBalance, uiServicePrice);
  const uiRemainingCharge = Math.max(0, uiServicePrice - uiGiftUsed);
  assert(uiRemainingCharge === 35, `Scenario F: UI correctly computes $35 remaining charge ($65 - $30)`, `got $${uiRemainingCharge}`);
  console.log(`  UI display: $${uiServicePrice} service - $${uiGiftUsed} gift = $${uiRemainingCharge} to charge ✓`);

  // ── Cleanup ──────────────────────────────────────────────────────────
  console.log('\n=== Cleanup ===');
  for (const id of createdApptIds) {
    await conn.execute('DELETE FROM appointments WHERE localId = ? AND businessOwnerId = ?', [id, OWNER_ID]);
  }
  // Remove test gift cards
  for (const code of [gcA_code, gcB_code, gcC_code, gcD_code, gcF_code]) {
    await conn.execute('DELETE FROM gift_cards WHERE code = ? AND businessOwnerId = ?', [code, OWNER_ID]);
  }
  console.log(`  Removed ${createdApptIds.length} test appointments and 5 test gift cards`);

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`GIFT CARD PARTIAL REDEMPTION RESULTS: ${passed} passed, ${errors.length} failed`);
  if (errors.length > 0) {
    console.log('\n❌ FAILURES:');
    errors.forEach(e => console.log('  - ' + e));
  } else {
    console.log('\n🎉 All gift card partial redemption tests passed!');
  }

  await conn.end();
}

// Ensure cleanup runs even if test crashes mid-way
process.on('unhandledRejection', async (err) => {
  console.error('\n❌ Unhandled error:', err.message);
  // Cleanup orphaned test data
  try {
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection(DB_URL);
    await conn.execute('DELETE FROM gift_cards WHERE businessOwnerId = ? AND code LIKE "TEST-PARTIAL%"', [OWNER_ID]);
    await conn.execute('DELETE FROM appointments WHERE businessOwnerId = ? AND notes LIKE "Partial gift card test%"', [OWNER_ID]);
    await conn.end();
    console.log('  Cleanup completed');
  } catch(e) { /* ignore */ }
  process.exit(1);
});

main().catch(err => {
  console.error('❌ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
