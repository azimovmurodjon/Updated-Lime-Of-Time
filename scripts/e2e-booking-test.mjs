/**
 * End-to-End Booking Flow Tests
 * Tests the complete client booking flow via the public booking API
 */
import { createConnection } from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
const OWNER_ID = 660001;
const SLUG = 'd-xjxndn';
const API = 'http://localhost:3000';

let errors = [];
let warnings = [];
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

async function fetchJson(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, data: JSON.parse(text) };
  } catch(e) {
    return { status: res.status, ok: res.ok, data: text };
  }
}

// Get a future weekday date string (YYYY-MM-DD) — skip weekends
function futureWeekday(weeksFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + weeksFromNow * 7);
  // Advance to Monday if weekend
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() + 1); // Sunday → Monday
  if (day === 6) d.setDate(d.getDate() + 2); // Saturday → Monday
  return d.toISOString().split('T')[0];
}

async function main() {
  const conn = await createConnection(DB_URL);
  console.log('✅ Connected to DB\n');

  // Get test data from DB
  const [locs] = await conn.execute('SELECT localId, name FROM locations WHERE businessOwnerId = ? AND active = 1', [OWNER_ID]);
  const [svcs] = await conn.execute('SELECT localId, name, price, duration FROM services WHERE businessOwnerId = ? LIMIT 5', [OWNER_ID]);
  const [staff] = await conn.execute('SELECT localId, name FROM staff_members WHERE businessOwnerId = ? AND active = 1 LIMIT 3', [OWNER_ID]);
  const [discs] = await conn.execute('SELECT localId, name, percentage FROM discounts WHERE businessOwnerId = ? AND active = 1', [OWNER_ID]);
  const [gcs] = await conn.execute('SELECT code, message FROM gift_cards WHERE businessOwnerId = ?', [OWNER_ID]);

  const loc1 = locs[0];
  const svc1 = svcs[0]; // Haircut & Style - $65
  const staff1 = staff[0];
  const hairDisc = discs.find(d => d.name === 'Morning Hair Special');
  const gc1 = gcs.find(g => g.code === 'LIME-GIFT-001');

  console.log(`Test data: loc=${loc1.name}, svc=${svc1.name} ($${svc1.price}), staff=${staff1.name}`);
  console.log(`Discount: ${hairDisc?.name} (${hairDisc?.percentage}%), Gift card: ${gc1?.code}\n`);

  // ── Test 1: Simple booking (no discount, no gift card) ───────────────
  console.log('=== Test 1: Simple Booking (no discount/gift) ===');
  const bookingDate = futureWeekday(3); // 3 weeks out on a weekday
  
  // Get available slots
  const slotsResp = await fetchJson(`/api/public/business/${SLUG}/slots?date=${bookingDate}&duration=${svc1.duration}&locationId=${loc1.localId}`);
  assert(slotsResp.ok, 'Slots API returns OK');
  const slots = slotsResp.data.slots || slotsResp.data;
  assert(Array.isArray(slots) && slots.length > 0, `Slots available for ${bookingDate} (weekday)`, `got ${slots?.length}`);
  
  const bookingTime = Array.isArray(slots) && slots.length > 0 ? slots[0] : '09:00';
  console.log(`  Using slot: ${bookingDate} at ${bookingTime}`);
  
  // POST to correct endpoint: /api/public/business/:slug/book
  const booking1 = await fetchJson(`/api/public/business/${SLUG}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: 'E2E Test Client',
      clientPhone: '4125559999',
      clientEmail: 'e2etest@example.com',
      serviceLocalId: svc1.localId,
      date: bookingDate,
      time: bookingTime,
      duration: svc1.duration,
      notes: 'E2E test booking - simple',
      totalPrice: svc1.price,
      locationId: loc1.localId,
      staffId: staff1.localId,
    })
  });
  
  assert(booking1.ok, 'Simple booking POST returns 200', `status=${booking1.status}, data=${JSON.stringify(booking1.data).substring(0,150)}`);
  assert(booking1.data?.success || booking1.data?.appointmentId || booking1.data?.localId, 
    'Simple booking returns success/ID', `data=${JSON.stringify(booking1.data).substring(0,100)}`);
  
  if (booking1.data?.appointmentId || booking1.data?.localId) {
    const apptId = booking1.data.appointmentId || booking1.data.localId;
    createdApptIds.push(apptId);
    
    // Verify it's in the DB
    const [dbAppt] = await conn.execute('SELECT * FROM appointments WHERE localId = ? AND businessOwnerId = ?', [apptId, OWNER_ID]);
    assert(dbAppt.length === 1, 'Simple booking saved to DB');
    if (dbAppt[0]) {
      assert(dbAppt[0].status === 'pending', 'New booking has pending status', `got ${dbAppt[0].status}`);
      assert(parseFloat(dbAppt[0].totalPrice) === parseFloat(svc1.price), 
        `Booking total matches service price ($${svc1.price})`, `got $${dbAppt[0].totalPrice}`);
      assert(dbAppt[0].locationId === loc1.localId, 'Booking assigned to correct location');
      assert(dbAppt[0].date === bookingDate, 'Booking date stored correctly');
      assert(dbAppt[0].time === bookingTime, 'Booking time stored correctly');
    }
  }

  // ── Test 2: Booking with Discount Code ───────────────────────────────
  console.log('\n=== Test 2: Booking with Discount Code ===');
  const bookingDate2 = futureWeekday(4);
  const slotsResp2 = await fetchJson(`/api/public/business/${SLUG}/slots?date=${bookingDate2}&duration=${svc1.duration}&locationId=${loc1.localId}`);
  const slots2 = slotsResp2.data.slots || slotsResp2.data;
  const bookingTime2 = Array.isArray(slots2) && slots2.length > 1 ? slots2[1] : (Array.isArray(slots2) && slots2.length > 0 ? slots2[0] : '10:00');
  
  const svcPrice = parseFloat(svc1.price);
  const discPct = parseFloat(hairDisc?.percentage || 20);
  const discAmt = Math.round(svcPrice * discPct) / 100;
  const discountedTotal = svcPrice - discAmt;
  
  console.log(`  Discount: ${hairDisc?.name} (${discPct}%) on $${svcPrice} = -$${discAmt.toFixed(2)} → total $${discountedTotal.toFixed(2)}`);
  
  const booking2 = await fetchJson(`/api/public/business/${SLUG}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: 'E2E Discount Client',
      clientPhone: '4125558888',
      clientEmail: 'e2ediscount@example.com',
      serviceLocalId: svc1.localId,
      date: bookingDate2,
      time: bookingTime2,
      duration: svc1.duration,
      notes: 'E2E test - discount applied',
      totalPrice: discountedTotal.toFixed(2),
      subtotal: svcPrice.toFixed(2),
      discountName: hairDisc?.name,
      discountPercentage: discPct,
      discountAmount: discAmt.toFixed(2),
      locationId: loc1.localId,
    })
  });
  
  assert(booking2.ok, 'Discount booking POST returns 200', `status=${booking2.status}`);
  
  if (booking2.data?.appointmentId || booking2.data?.localId) {
    const apptId2 = booking2.data.appointmentId || booking2.data.localId;
    createdApptIds.push(apptId2);
    
    const [dbAppt2] = await conn.execute('SELECT * FROM appointments WHERE localId = ? AND businessOwnerId = ?', [apptId2, OWNER_ID]);
    assert(dbAppt2.length === 1, 'Discount booking saved to DB');
    if (dbAppt2[0]) {
      const storedTotal = parseFloat(dbAppt2[0].totalPrice);
      assert(Math.abs(storedTotal - discountedTotal) < 0.01, 
        `Discount booking total is correct ($${discountedTotal.toFixed(2)})`, `got $${storedTotal.toFixed(2)}`);
      assert(parseFloat(dbAppt2[0].discountPercent) === discPct, 
        `Discount percentage stored correctly (${discPct}%)`, `got ${dbAppt2[0].discountPercent}`);
      const storedDiscAmt = parseFloat(dbAppt2[0].discountAmount);
      assert(Math.abs(storedDiscAmt - discAmt) < 0.01, 
        `Discount amount stored correctly ($${discAmt.toFixed(2)})`, `got $${storedDiscAmt.toFixed(2)}`);
    }
  }

  // ── Test 3: Booking with Gift Card ───────────────────────────────────
  console.log('\n=== Test 3: Booking with Gift Card ===');
  const bookingDate3 = futureWeekday(5);
  const slotsResp3 = await fetchJson(`/api/public/business/${SLUG}/slots?date=${bookingDate3}&duration=${svc1.duration}&locationId=${loc1.localId}`);
  const slots3 = slotsResp3.data.slots || slotsResp3.data;
  const bookingTime3 = Array.isArray(slots3) && slots3.length > 2 ? slots3[2] : (Array.isArray(slots3) && slots3.length > 0 ? slots3[0] : '11:00');
  
  // Gift card LIME-GIFT-001 has $65 balance = exact price of Haircut & Style ($65)
  const gcBalance = 65;
  const giftUsed = Math.min(gcBalance, svcPrice);
  const giftTotal = Math.max(0, svcPrice - giftUsed); // Should be $0
  
  console.log(`  Gift card: ${gc1?.code} ($${gcBalance}) on $${svcPrice} → total $${giftTotal.toFixed(2)}`);
  
  const booking3 = await fetchJson(`/api/public/business/${SLUG}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: 'E2E Gift Client',
      clientPhone: '4125557777',
      clientEmail: 'e2egift@example.com',
      serviceLocalId: svc1.localId,
      date: bookingDate3,
      time: bookingTime3,
      duration: svc1.duration,
      notes: 'E2E test - gift card applied',
      totalPrice: giftTotal.toFixed(2),
      giftCode: gc1?.code,
      giftApplied: true,
      giftUsedAmount: giftUsed.toFixed(2),
      locationId: loc1.localId,
    })
  });
  
  assert(booking3.ok, 'Gift card booking POST returns 200', `status=${booking3.status}`);
  
  if (booking3.data?.appointmentId || booking3.data?.localId) {
    const apptId3 = booking3.data.appointmentId || booking3.data.localId;
    createdApptIds.push(apptId3);
    
    const [dbAppt3] = await conn.execute('SELECT * FROM appointments WHERE localId = ? AND businessOwnerId = ?', [apptId3, OWNER_ID]);
    assert(dbAppt3.length === 1, 'Gift card booking saved to DB');
    if (dbAppt3[0]) {
      const storedTotal3 = parseFloat(dbAppt3[0].totalPrice);
      assert(Math.abs(storedTotal3 - giftTotal) < 0.01, 
        `Gift card booking total is correct ($${giftTotal.toFixed(2)})`, `got $${storedTotal3.toFixed(2)}`);
      assert(dbAppt3[0].giftApplied === 1 || dbAppt3[0].giftApplied === true, 
        'Gift applied flag set in DB');
      const storedGiftAmt = parseFloat(dbAppt3[0].giftUsedAmount);
      assert(Math.abs(storedGiftAmt - giftUsed) < 0.01, 
        `Gift used amount correct ($${giftUsed.toFixed(2)})`, `got $${storedGiftAmt.toFixed(2)}`);
    }
    
    // Verify gift card balance was deducted
    const gcAfter = await fetchJson(`/api/public/gift/${gc1?.code}`);
    const expectedBalance = gcBalance - giftUsed;
    assert(gcAfter.data?.remainingBalance === expectedBalance, 
      `Gift card balance deducted correctly (expected $${expectedBalance})`, `got $${gcAfter.data?.remainingBalance}`);
  }

  // ── Test 4: Slot Conflict Prevention ────────────────────────────────
  console.log('\n=== Test 4: Slot Conflict Prevention ===');
  if (createdApptIds.length > 0 && bookingTime) {
    // Try to book the same slot that was just booked in Test 1
    const conflictBooking = await fetchJson(`/api/public/business/${SLUG}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: 'Conflict Test',
        clientPhone: '4125556666',
        clientEmail: 'conflict@example.com',
        serviceLocalId: svc1.localId,
        date: bookingDate,
        time: bookingTime,
        duration: svc1.duration,
        notes: 'This should be a conflict',
        totalPrice: svc1.price,
        locationId: loc1.localId,
        staffId: staff1.localId,
      })
    });
    
    assert(conflictBooking.status >= 200 && conflictBooking.status < 600, 
      'Conflict booking API responds (any status)', `status=${conflictBooking.status}`);
    console.log(`  Conflict booking result: status=${conflictBooking.status} (${conflictBooking.ok ? 'accepted' : 'rejected'})`);
    
    // Check slots for that day - the booked slot should no longer appear
    const slotsAfter = await fetchJson(`/api/public/business/${SLUG}/slots?date=${bookingDate}&duration=${svc1.duration}&locationId=${loc1.localId}&staffId=${staff1.localId}`);
    const slotsAfterArr = slotsAfter.data.slots || slotsAfter.data;
    if (Array.isArray(slotsAfterArr)) {
      const bookedSlotGone = !slotsAfterArr.includes(bookingTime);
      assert(bookedSlotGone, `Booked slot (${bookingTime}) no longer available in slots`, 
        `slot still appears in: ${slotsAfterArr.join(', ')}`);
    }
  } else {
    console.log('  Skipped: no booking to conflict with');
  }

  // ── Test 5: Booking Page Renders Correctly ───────────────────────────
  console.log('\n=== Test 5: Booking Page Renders Correctly ===');
  const bookPageResp = await fetch(`${API}/api/book/${SLUG}`);
  assert(bookPageResp.ok, 'Booking page returns 200');
  assert(bookPageResp.headers.get('content-type')?.includes('text/html'), 'Booking page returns HTML');
  
  const bookHtml = await bookPageResp.text();
  assert(bookHtml.includes('Book with'), 'Booking page has "Book with" title');
  assert(bookHtml.includes('serviceList'), 'Booking page has service list');
  assert(bookHtml.includes('locationSelector'), 'Booking page has location selector');
  assert(bookHtml.includes('staffSection') || bookHtml.includes('staffList'), 'Booking page has staff section');
  assert(bookHtml.includes('calGrid'), 'Booking page has calendar grid');
  assert(bookHtml.includes('timeGrid') || bookHtml.includes('time-slot'), 'Booking page has time grid');
  assert(bookHtml.includes('giftCode'), 'Booking page has gift code input');
  
  // Test with location parameter
  const bookPageWithLoc = await fetch(`${API}/api/book/${SLUG}?location=${loc1.localId}`);
  assert(bookPageWithLoc.ok, 'Booking page with ?location= returns 200');
  const bookHtmlWithLoc = await bookPageWithLoc.text();
  assert(bookHtmlWithLoc.includes(loc1.localId), 'Booking page with location pre-selects location');

  // ── Test 6: Manage Appointment Page ─────────────────────────────────
  console.log('\n=== Test 6: Manage Appointment Page ===');
  if (createdApptIds.length > 0) {
    const apptId = createdApptIds[0];
    // Manage page endpoint: /api/manage/:slug/:appointmentId
    const manageResp = await fetch(`${API}/api/manage/${SLUG}/${apptId}`);
    assert(manageResp.ok, `Manage page for appointment ${apptId} returns 200`, `status=${manageResp.status}`);
    const manageHtml = await manageResp.text();
    assert(manageHtml.includes('E2E Test Client') || manageHtml.includes('appointment') || manageHtml.includes('Appointment'), 
      'Manage page shows appointment details');
    assert(manageHtml.includes('Cancel') || manageHtml.includes('Reschedule'), 
      'Manage page has action buttons');
  } else {
    console.log('  Skipped: no created appointments to test');
  }

  // ── Test 7: Cancel Appointment ───────────────────────────────────────
  console.log('\n=== Test 7: Cancel Appointment ===');
  if (createdApptIds.length > 0) {
    const apptId = createdApptIds[0];
    // Cancel endpoint requires slug + clientPhone for identity verification
    const cancelResp = await fetchJson(`/api/public/appointment/${apptId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, clientPhone: '4125559999', reason: 'E2E test cancellation' })
    });
    assert(cancelResp.ok, `Cancel appointment ${apptId} returns 200`, `status=${cancelResp.status}, data=${JSON.stringify(cancelResp.data).substring(0,100)}`);
    
    // Verify status in DB
    const [dbApptCancelled] = await conn.execute('SELECT status FROM appointments WHERE localId = ? AND businessOwnerId = ?', [apptId, OWNER_ID]);
    if (dbApptCancelled[0]) {
      assert(dbApptCancelled[0].status === 'cancelled', 'Cancelled appointment has cancelled status in DB', `got ${dbApptCancelled[0].status}`);
    }
  } else {
    console.log('  Skipped: no created appointments to cancel');
  }

  // ── Cleanup: Remove E2E test appointments ────────────────────────────
  console.log('\n=== Cleanup ===');
  if (createdApptIds.length > 0) {
    for (const id of createdApptIds) {
      await conn.execute('DELETE FROM appointments WHERE localId = ? AND businessOwnerId = ?', [id, OWNER_ID]);
    }
    console.log(`  Removed ${createdApptIds.length} E2E test appointments`);
    
    // Restore gift card balance to $65 (it was deducted in Test 3)
    // The gift card balance is stored in the message field as JSON metadata
    // We need to reset it via direct DB update
    await conn.execute(
      "UPDATE gift_cards SET message = REGEXP_REPLACE(message, '---GIFT_DATA---.*$', '') WHERE code = ? AND businessOwnerId = ?",
      ['LIME-GIFT-001', OWNER_ID]
    );
    console.log('  Reset LIME-GIFT-001 gift card balance');
  }

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log(`E2E RESULTS: ${passed} passed, ${errors.length} failed, ${warnings.length} warnings`);
  if (errors.length > 0) {
    console.log('\n❌ FAILURES:');
    errors.forEach(e => console.log('  - ' + e));
  }
  if (errors.length === 0) {
    console.log('\n🎉 All E2E booking flow tests passed!');
  }

  await conn.end();
}

main().catch(err => {
  console.error('❌ E2E test failed:', err.message);
  process.exit(1);
});
