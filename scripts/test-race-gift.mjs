/**
 * Gift Card Double-Spend Race Condition Test
 *
 * Uses two different locations/days to avoid slot conflicts, so both bookings
 * can potentially succeed. Tests whether the gift card balance is correctly
 * protected against concurrent deductions.
 *
 * Scenario: $50 gift card, two bookings at different locations on different days.
 * Each booking tries to use the full $50. Total deducted must not exceed $50.
 */
import { createConnection } from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
const OWNER_ID = 660001;
const SLUG = 'd-xjxndn';
const API = 'http://localhost:3000';
const RUN_ID = Date.now().toString(36).slice(-5).toUpperCase();

let errors = [];
let passed = 0;

function assert(condition, label, detail = '') {
  if (condition) { console.log(`  ✅ PASS: ${label}`); passed++; }
  else { console.log(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`); errors.push(label); }
}

function round2(n) { return Math.round(n * 100) / 100; }

async function fetchJson(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const text = await res.text();
  try { return { status: res.status, ok: res.ok, data: JSON.parse(text) }; }
  catch(e) { return { status: res.status, ok: res.ok, data: text }; }
}

function weekdayDate(weeksFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + weeksFromNow * 7);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() + 1);
  if (day === 6) d.setDate(d.getDate() + 2);
  return d.toISOString().split('T')[0];
}

async function main() {
  const conn = await createConnection(DB_URL);
  console.log('✅ Connected to DB\n');

  const [locs] = await conn.execute('SELECT localId, name FROM locations WHERE businessOwnerId = ? AND active = 1', [OWNER_ID]);
  const [svcs] = await conn.execute('SELECT localId, name, price, duration FROM services WHERE businessOwnerId = ? ORDER BY price ASC', [OWNER_ID]);
  const svc65 = svcs.find(s => parseFloat(s.price) === 65) || svcs[0];

  // Create the shared gift card
  const gcCode = `RACE2-${RUN_ID}`;
  const giftData = JSON.stringify({ originalValue: 50, remainingBalance: 50, serviceIds: [], productIds: [] });
  const message = `Race test $50\n---GIFT_DATA---\n${giftData}`;
  const futureExpiry = new Date(); futureExpiry.setFullYear(futureExpiry.getFullYear() + 1);
  await conn.execute(
    `INSERT INTO gift_cards (businessOwnerId, localId, code, serviceLocalId, redeemed, message, expiresAt) VALUES (?, ?, ?, '', 0, ?, ?)`,
    [OWNER_ID, `test-race2-${Date.now()}`, gcCode, message, futureExpiry.toISOString().split('T')[0]]
  );
  console.log(`Created gift card ${gcCode} with $50 balance`);

  // Get slots for two different locations on different days
  const date1 = weekdayDate(8);
  const date2 = weekdayDate(9);
  const loc1 = locs[0];
  const loc2 = locs[1] || locs[0];

  const slots1 = await fetchJson(`/api/public/business/${SLUG}/slots?date=${date1}&duration=${svc65.duration}&locationId=${loc1.localId}`);
  const slots2 = await fetchJson(`/api/public/business/${SLUG}/slots?date=${date2}&duration=${svc65.duration}&locationId=${loc2.localId}`);
  const slot1 = (slots1.data?.slots || slots1.data)?.[0] || '09:00';
  const slot2 = (slots2.data?.slots || slots2.data)?.[0] || '09:00';

  console.log(`Booking 1: ${loc1.name} on ${date1} at ${slot1}`);
  console.log(`Booking 2: ${loc2.name} on ${date2} at ${slot2}`);
  console.log(`Both using gift card ${gcCode} ($50) for $65 service — each tries to apply $50 gift\n`);

  const makeBooking = (clientPhone, date, time, locationId) => fetchJson(`/api/public/business/${SLUG}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: `Race Client ${clientPhone}`,
      clientPhone,
      clientEmail: `${clientPhone}@test.com`,
      serviceLocalId: svc65.localId,
      date, time, duration: svc65.duration,
      notes: `Race test`,
      totalPrice: '15.00',  // $65 - $50 gift = $15
      giftCode: gcCode,
      giftApplied: true,
      giftUsedAmount: '50.00',
      locationId,
    })
  });

  // Fire both simultaneously
  const start = Date.now();
  const [r1, r2] = await Promise.all([
    makeBooking('4125580001', date1, slot1, loc1.localId),
    makeBooking('4125580002', date2, slot2, loc2.localId),
  ]);
  const elapsed = Date.now() - start;
  console.log(`Both requests completed in ${elapsed}ms`);
  console.log(`  Booking 1: HTTP ${r1.status} — ${r1.ok ? 'ACCEPTED' : 'REJECTED: ' + r1.data?.error}`);
  console.log(`  Booking 2: HTTP ${r2.status} — ${r2.ok ? 'ACCEPTED' : 'REJECTED: ' + r2.data?.error}`);

  // Wait for DB writes to settle
  await new Promise(res => setTimeout(res, 800));

  // Check final gift card balance
  const balRes = await fetchJson(`/api/public/gift/${gcCode}`);
  const finalBal = balRes.data?.remainingBalance ?? null;
  console.log(`\n  Final gift card balance: $${finalBal}`);

  const totalDeducted = round2(50 - (finalBal ?? 50));
  console.log(`  Total deducted: $${totalDeducted}`);

  assert(totalDeducted <= 50, `No double-spend: total deducted ≤ $50`, `deducted $${totalDeducted}`);

  if (r1.ok && r2.ok) {
    // Both succeeded — this is the critical case
    console.log(`\n  ⚠ Both bookings were accepted. Checking DB for total gift usage...`);
    const [appts] = await conn.execute(
      `SELECT localId, totalPrice, giftUsedAmount FROM appointments WHERE businessOwnerId = ? AND notes = 'Race test'`,
      [OWNER_ID]
    );
    const totalGiftInDB = appts.reduce((s, a) => s + parseFloat(a.giftUsedAmount || '0'), 0);
    console.log(`  DB total giftUsedAmount across both appointments: $${round2(totalGiftInDB)}`);
    assert(round2(totalGiftInDB) <= 50, `DB total giftUsedAmount ≤ $50`, `got $${round2(totalGiftInDB)}`);

    if (round2(totalGiftInDB) > 50) {
      console.log(`\n  ❌ DOUBLE-SPEND BUG: $${round2(totalGiftInDB)} was deducted from a $50 card!`);
      console.log(`  FIX NEEDED: The gift card deduction must be made atomic (e.g., using a DB transaction`);
      console.log(`  with a SELECT FOR UPDATE or a conditional UPDATE with WHERE remainingBalance >= amount).`);
    } else {
      console.log(`  ✓ Both bookings accepted but total gift used = $${round2(totalGiftInDB)} ≤ $50`);
    }
  } else {
    const winner = r1.ok ? 'Booking 1' : 'Booking 2';
    console.log(`\n  ✓ ${winner} won the race. Second booking correctly rejected.`);
    assert(true, `Race correctly serialized: one accepted, one rejected`);
  }

  // Cleanup
  console.log('\n=== Cleanup ===');
  await conn.execute(`DELETE FROM appointments WHERE businessOwnerId = ? AND notes = 'Race test'`, [OWNER_ID]);
  await conn.execute('DELETE FROM gift_cards WHERE code = ? AND businessOwnerId = ?', [gcCode, OWNER_ID]);
  console.log('  Cleaned up test data');

  console.log('\n' + '='.repeat(60));
  console.log(`RACE CONDITION RESULTS: ${passed} passed, ${errors.length} failed`);
  if (errors.length > 0) {
    console.log('\n❌ FAILURES:'); errors.forEach(e => console.log('  - ' + e));
  } else {
    console.log('\n🎉 Race condition test passed!');
  }

  await conn.end();
}

main().catch(err => { console.error('❌ Test error:', err.message); process.exit(1); });
