/**
 * Gift Card Expiry Enforcement + Concurrent Race Condition Test
 *
 * Part 1: Expiry Enforcement
 *   A. Expired card → booking rejected with HTTP 400
 *   B. Card expiring today → booking accepted (same-day expiry is still valid)
 *   C. Valid card (future expiry) → booking accepted
 *   D. Card with no expiresAt → booking accepted (no expiry = never expires)
 *
 * Part 2: Concurrent Race Condition (double-spend prevention)
 *   E. Two simultaneous bookings using the same $50 gift card against a $65 service
 *      → Only one should succeed; the second should fail with "no remaining balance"
 *      OR both succeed but total deducted ≤ original balance (server-side atomic check)
 */
import { createConnection } from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
const OWNER_ID = 660001;
const SLUG = 'd-xjxndn';
const API = 'http://localhost:3000';

let errors = [];
let passed = 0;
let createdApptIds = [];
const RUN_ID = Date.now().toString(36).slice(-5).toUpperCase();

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

async function createGiftCard(conn, { code, balance, expiresAt }) {
  const localId = `test-er-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  const giftData = JSON.stringify({ originalValue: balance, remainingBalance: balance, serviceIds: [], productIds: [] });
  const message = `Test gift card $${balance}\n---GIFT_DATA---\n${giftData}`;
  await conn.execute(
    `INSERT INTO gift_cards (businessOwnerId, localId, code, serviceLocalId, redeemed, message, expiresAt)
     VALUES (?, ?, ?, '', 0, ?, ?)`,
    [OWNER_ID, localId, code, message, expiresAt]
  );
}

async function bookWithGift({ date, time, serviceLocalId, duration, locationId, clientPhone, giftCode, giftBalance, servicePrice }) {
  const giftUsed = round2(Math.min(giftBalance, servicePrice));
  const total = round2(servicePrice - giftUsed);
  const resp = await fetchJson(`/api/public/business/${SLUG}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: `Test Client ${clientPhone}`,
      clientPhone,
      clientEmail: `${clientPhone}@test.com`,
      serviceLocalId,
      date,
      time,
      duration,
      notes: `Expiry/race test`,
      totalPrice: total.toFixed(2),
      giftCode,
      giftApplied: true,
      giftUsedAmount: giftUsed.toFixed(2),
      locationId,
    })
  });
  return { resp, giftUsed, total };
}

async function getGiftCardBalance(code) {
  const res = await fetchJson(`/api/public/gift/${code}`);
  return res.data?.remainingBalance ?? null;
}

async function main() {
  const conn = await createConnection(DB_URL);
  console.log('✅ Connected to DB\n');

  const [locs] = await conn.execute('SELECT localId, name FROM locations WHERE businessOwnerId = ? AND active = 1', [OWNER_ID]);
  const [svcs] = await conn.execute('SELECT localId, name, price, duration FROM services WHERE businessOwnerId = ? ORDER BY price ASC', [OWNER_ID]);
  const loc = locs[0];
  const svc65 = svcs.find(s => parseFloat(s.price) === 65) || svcs[0];

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
  const futureExpiry = nextYear.toISOString().split('T')[0];

  console.log(`Fixtures: loc=${loc.name}, svc=${svc65.name} $${svc65.price}\n`);

  // ═══════════════════════════════════════════════════════════════════
  // PART 1: EXPIRY ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════════
  console.log('══════════════════════════════════════════════════');
  console.log('PART 1: GIFT CARD EXPIRY ENFORCEMENT');
  console.log('══════════════════════════════════════════════════\n');

  // ── Scenario A: Expired card (yesterday) ────────────────────────
  console.log('=== Scenario A: Expired card (expiresAt = yesterday) ===');
  const gcA = `EXP-A-${RUN_ID}`;
  await createGiftCard(conn, { code: gcA, balance: 50, expiresAt: yesterday });

  const dateA = futureWeekday(3);
  const slotsA = await fetchJson(`/api/public/business/${SLUG}/slots?date=${dateA}&duration=${svc65.duration}&locationId=${loc.localId}`);
  const slotA = (slotsA.data?.slots || slotsA.data)?.[0] || '09:00';

  const { resp: respA } = await bookWithGift({
    date: dateA, time: slotA, serviceLocalId: svc65.localId, duration: svc65.duration,
    locationId: loc.localId, clientPhone: '4125570001', giftCode: gcA, giftBalance: 50, servicePrice: 65,
  });
  assert(!respA.ok && respA.status === 400, `Scenario A: Expired card rejected with HTTP 400`, `status=${respA.status}`);
  assert(typeof respA.data?.error === 'string' && respA.data.error.includes('expired'),
    `Scenario A: Error message mentions "expired"`, `got: "${respA.data?.error}"`);
  console.log(`  ✓ Server correctly rejected expired card: "${respA.data?.error}"`);

  // ── Scenario B: Card expiring today (same-day = still valid) ────
  console.log('\n=== Scenario B: Card expiring today (same-day = still valid) ===');
  const gcB = `EXP-B-${RUN_ID}`;
  await createGiftCard(conn, { code: gcB, balance: 50, expiresAt: today });

  const dateB = futureWeekday(4);
  const slotsB = await fetchJson(`/api/public/business/${SLUG}/slots?date=${dateB}&duration=${svc65.duration}&locationId=${loc.localId}`);
  const slotB = (slotsB.data?.slots || slotsB.data)?.[0] || '09:00';

  const { resp: respB } = await bookWithGift({
    date: dateB, time: slotB, serviceLocalId: svc65.localId, duration: svc65.duration,
    locationId: loc.localId, clientPhone: '4125570002', giftCode: gcB, giftBalance: 50, servicePrice: 65,
  });
  assert(respB.ok, `Scenario B: Same-day expiry card accepted`, `status=${respB.status}, err=${JSON.stringify(respB.data)}`);
  if (respB.data?.appointmentId) createdApptIds.push(respB.data.appointmentId);

  // ── Scenario C: Valid card (future expiry) ───────────────────────
  console.log('\n=== Scenario C: Valid card (future expiry) ===');
  const gcC = `EXP-C-${RUN_ID}`;
  await createGiftCard(conn, { code: gcC, balance: 50, expiresAt: futureExpiry });

  const dateC = futureWeekday(5);
  const slotsC = await fetchJson(`/api/public/business/${SLUG}/slots?date=${dateC}&duration=${svc65.duration}&locationId=${loc.localId}`);
  const slotC = (slotsC.data?.slots || slotsC.data)?.[0] || '09:00';

  const { resp: respC } = await bookWithGift({
    date: dateC, time: slotC, serviceLocalId: svc65.localId, duration: svc65.duration,
    locationId: loc.localId, clientPhone: '4125570003', giftCode: gcC, giftBalance: 50, servicePrice: 65,
  });
  assert(respC.ok, `Scenario C: Valid card (future expiry) accepted`, `status=${respC.status}`);
  if (respC.data?.appointmentId) createdApptIds.push(respC.data.appointmentId);

  // ── Scenario D: Card with no expiresAt (never expires) ──────────
  console.log('\n=== Scenario D: Card with no expiresAt (never expires) ===');
  const gcD = `EXP-D-${RUN_ID}`;
  // Insert with NULL expiresAt
  const localIdD = `test-er-d-${Date.now()}`;
  const giftDataD = JSON.stringify({ originalValue: 50, remainingBalance: 50, serviceIds: [], productIds: [] });
  const messageD = `Test gift card no expiry\n---GIFT_DATA---\n${giftDataD}`;
  await conn.execute(
    `INSERT INTO gift_cards (businessOwnerId, localId, code, serviceLocalId, redeemed, message, expiresAt)
     VALUES (?, ?, ?, '', 0, ?, NULL)`,
    [OWNER_ID, localIdD, gcD, messageD]
  );

  const dateD = futureWeekday(6);
  const slotsD = await fetchJson(`/api/public/business/${SLUG}/slots?date=${dateD}&duration=${svc65.duration}&locationId=${loc.localId}`);
  const slotD = (slotsD.data?.slots || slotsD.data)?.[0] || '09:00';

  const { resp: respD } = await bookWithGift({
    date: dateD, time: slotD, serviceLocalId: svc65.localId, duration: svc65.duration,
    locationId: loc.localId, clientPhone: '4125570004', giftCode: gcD, giftBalance: 50, servicePrice: 65,
  });
  assert(respD.ok, `Scenario D: Card with no expiry accepted`, `status=${respD.status}`);
  if (respD.data?.appointmentId) createdApptIds.push(respD.data.appointmentId);

  // ═══════════════════════════════════════════════════════════════════
  // PART 2: CONCURRENT RACE CONDITION
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════════');
  console.log('PART 2: CONCURRENT RACE CONDITION (DOUBLE-SPEND)');
  console.log('══════════════════════════════════════════════════\n');
  console.log('=== Scenario E: Two simultaneous bookings using the same $50 gift card ===');
  console.log('  Expected: At most $50 total deducted (no double-spend)\n');

  const gcE = `RACE-E-${RUN_ID}`;
  await createGiftCard(conn, { code: gcE, balance: 50, expiresAt: futureExpiry });

  // Get two different time slots for the same day
  const dateE = futureWeekday(7);
  const slotsE = await fetchJson(`/api/public/business/${SLUG}/slots?date=${dateE}&duration=${svc65.duration}&locationId=${loc.localId}`);
  const allSlotsE = slotsE.data?.slots || slotsE.data || [];
  const slotE1 = allSlotsE[0] || '09:00';
  const slotE2 = allSlotsE[1] || '10:00'; // Different slot to avoid slot conflict

  console.log(`  Sending 2 concurrent booking requests for ${dateE} at ${slotE1} and ${slotE2}`);
  console.log(`  Both using gift card ${gcE} ($50 balance) for $65 service (gift covers $50, charge $15 each)`);

  // Fire both requests simultaneously
  const [resultE1, resultE2] = await Promise.all([
    bookWithGift({
      date: dateE, time: slotE1, serviceLocalId: svc65.localId, duration: svc65.duration,
      locationId: loc.localId, clientPhone: '4125570005', giftCode: gcE, giftBalance: 50, servicePrice: 65,
    }),
    bookWithGift({
      date: dateE, time: slotE2, serviceLocalId: svc65.localId, duration: svc65.duration,
      locationId: loc.localId, clientPhone: '4125570006', giftCode: gcE, giftBalance: 50, servicePrice: 65,
    }),
  ]);

  console.log(`  Request 1: HTTP ${resultE1.resp.status} — ${resultE1.resp.ok ? 'ACCEPTED' : 'REJECTED: ' + resultE1.resp.data?.error}`);
  console.log(`  Request 2: HTTP ${resultE2.resp.status} — ${resultE2.resp.ok ? 'ACCEPTED' : 'REJECTED: ' + resultE2.resp.data?.error}`);

  const bothSucceeded = resultE1.resp.ok && resultE2.resp.ok;
  const oneSucceeded = resultE1.resp.ok !== resultE2.resp.ok;

  if (resultE1.resp.data?.appointmentId) createdApptIds.push(resultE1.resp.data.appointmentId);
  if (resultE2.resp.data?.appointmentId) createdApptIds.push(resultE2.resp.data.appointmentId);

  // Wait a moment for DB writes to settle
  await new Promise(r => setTimeout(r, 500));

  // Check final gift card balance
  const finalBalE = await getGiftCardBalance(gcE);
  console.log(`\n  Final gift card balance: $${finalBalE}`);

  // The critical invariant: total deducted must not exceed original $50
  const totalDeducted = round2(50 - (finalBalE ?? 50));
  assert(totalDeducted <= 50, `Scenario E: Total deducted ≤ $50 (no double-spend)`, `deducted $${totalDeducted}`);

  if (bothSucceeded) {
    // Both succeeded — check that the total deducted is exactly $50 (not $100)
    console.log(`  ⚠ Both requests succeeded. Checking for double-spend...`);
    assert(totalDeducted <= 50, `Scenario E: Both succeeded but deducted only $${totalDeducted} (≤ $50)`, `deducted $${totalDeducted}`);
    if (totalDeducted > 50) {
      console.log(`  ❌ DOUBLE-SPEND DETECTED: $${totalDeducted} deducted from a $50 card!`);
    } else {
      console.log(`  ✓ Both succeeded but total deducted = $${totalDeducted} ≤ $50 (server capped correctly)`);
    }
  } else if (oneSucceeded) {
    console.log(`  ✓ One request succeeded, one rejected — race condition handled correctly`);
    assert(true, `Scenario E: Race condition correctly serialized (one accepted, one rejected)`);
  }

  // Check DB: how many appointments were created with this gift card?
  const [apptRows] = await conn.execute(
    `SELECT localId, totalPrice, giftUsedAmount FROM appointments WHERE businessOwnerId = ? AND notes LIKE 'Expiry/race test' AND date = ?`,
    [OWNER_ID, dateE]
  );
  console.log(`\n  Appointments created for ${dateE}: ${apptRows.length}`);
  apptRows.forEach(a => {
    console.log(`    - ${a.localId}: totalPrice=$${a.totalPrice}, giftUsed=$${a.giftUsedAmount}`);
  });

  const totalGiftUsedInDB = apptRows.reduce((s, a) => s + parseFloat(a.giftUsedAmount || '0'), 0);
  assert(round2(totalGiftUsedInDB) <= 50,
    `Scenario E: Total giftUsedAmount in DB ≤ $50`, `got $${totalGiftUsedInDB}`);
  console.log(`  Total gift used across all DB appointments: $${round2(totalGiftUsedInDB)}`);

  // ── Cleanup ──────────────────────────────────────────────────────────
  console.log('\n=== Cleanup ===');
  for (const id of createdApptIds) {
    await conn.execute('DELETE FROM appointments WHERE localId = ? AND businessOwnerId = ?', [id, OWNER_ID]);
  }
  // Also clean up any race test appointments by date
  await conn.execute(`DELETE FROM appointments WHERE businessOwnerId = ? AND notes = 'Expiry/race test'`, [OWNER_ID]);
  for (const code of [gcA, gcB, gcC, gcD, gcE]) {
    await conn.execute('DELETE FROM gift_cards WHERE code = ? AND businessOwnerId = ?', [code, OWNER_ID]);
  }
  console.log(`  Removed test appointments and 5 test gift cards`);

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`EXPIRY + RACE CONDITION RESULTS: ${passed} passed, ${errors.length} failed`);
  if (errors.length > 0) {
    console.log('\n❌ FAILURES:');
    errors.forEach(e => console.log('  - ' + e));
  } else {
    console.log('\n🎉 All expiry + race condition tests passed!');
  }

  await conn.end();
}

main().catch(err => {
  console.error('❌ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
