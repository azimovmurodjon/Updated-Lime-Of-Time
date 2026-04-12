/**
 * Regression Validation Script
 * Validates discount math, gift card totals, and appointment data integrity
 */
import { createConnection } from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
const OWNER_ID = 660001;
const SLUG = 'd-xjxndn';
const API = 'http://localhost:3000';

let errors = [];
let warnings = [];
let passed = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    errors.push(`${label}${detail ? ': ' + detail : ''}`);
  }
}

function warn(label, detail = '') {
  console.log(`  ⚠️  WARN: ${label}${detail ? ' — ' + detail : ''}`);
  warnings.push(`${label}${detail ? ': ' + detail : ''}`);
}

async function fetchJson(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

// Handle MySQL2 JSON columns which are auto-parsed to objects
function parseJsonField(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') return val; // Already parsed by MySQL2 JSON column
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch(e) { return null; }
  }
  return null;
}

async function main() {
  const conn = await createConnection(DB_URL);
  console.log('✅ Connected to DB\n');

  // ── 1. DB Record Counts ──────────────────────────────────────────────
  console.log('=== 1. DB Record Counts ===');
  const [[locCount]] = await conn.execute('SELECT COUNT(*) as cnt FROM locations WHERE businessOwnerId = ? AND active = 1', [OWNER_ID]);
  assert(locCount.cnt === 3, 'DB has 3 active locations', `got ${locCount.cnt}`);

  const [[svcCount]] = await conn.execute('SELECT COUNT(*) as cnt FROM services WHERE businessOwnerId = ?', [OWNER_ID]);
  assert(svcCount.cnt === 10, 'DB has 10 services', `got ${svcCount.cnt}`);

  const [[prodCount]] = await conn.execute('SELECT COUNT(*) as cnt FROM products WHERE businessOwnerId = ?', [OWNER_ID]);
  assert(prodCount.cnt === 10, 'DB has 10 products', `got ${prodCount.cnt}`);

  const [[staffCount]] = await conn.execute('SELECT COUNT(*) as cnt FROM staff_members WHERE businessOwnerId = ? AND active = 1', [OWNER_ID]);
  assert(staffCount.cnt === 9, 'DB has 9 active staff', `got ${staffCount.cnt}`);

  const [[clientCount]] = await conn.execute('SELECT COUNT(*) as cnt FROM clients WHERE businessOwnerId = ?', [OWNER_ID]);
  assert(clientCount.cnt === 9, 'DB has 9 clients', `got ${clientCount.cnt}`);

  const [[discCount]] = await conn.execute('SELECT COUNT(*) as cnt FROM discounts WHERE businessOwnerId = ? AND active = 1', [OWNER_ID]);
  assert(discCount.cnt === 3, 'DB has 3 active discounts', `got ${discCount.cnt}`);

  const [[gcCount]] = await conn.execute('SELECT COUNT(*) as cnt FROM gift_cards WHERE businessOwnerId = ?', [OWNER_ID]);
  assert(gcCount.cnt === 3, 'DB has 3 gift cards', `got ${gcCount.cnt}`);

  const [[apptCount]] = await conn.execute('SELECT COUNT(*) as cnt FROM appointments WHERE businessOwnerId = ?', [OWNER_ID]);
  assert(apptCount.cnt === 10, 'DB has 10 appointments', `got ${apptCount.cnt}`);

  // ── 2. Service Categories ────────────────────────────────────────────
  console.log('\n=== 2. Service Categories ===');
  const [services] = await conn.execute('SELECT category FROM services WHERE businessOwnerId = ?', [OWNER_ID]);
  const cats = [...new Set(services.map(s => s.category))];
  assert(cats.length >= 5, 'Services have 5+ distinct categories', `got ${cats.length}: ${cats.join(', ')}`);

  // ── 3. Product Brands ────────────────────────────────────────────────
  console.log('\n=== 3. Product Brands ===');
  const [products] = await conn.execute('SELECT brand FROM products WHERE businessOwnerId = ?', [OWNER_ID]);
  const brands = [...new Set(products.map(p => p.brand))];
  assert(brands.length >= 4, 'Products have 4+ distinct brands', `got ${brands.length}: ${brands.join(', ')}`);

  // ── 4. Staff Distribution ────────────────────────────────────────────
  console.log('\n=== 4. Staff Distribution per Location ===');
  const [locs] = await conn.execute('SELECT localId, name FROM locations WHERE businessOwnerId = ? AND active = 1', [OWNER_ID]);
  for (const loc of locs) {
    const [staffRows] = await conn.execute(
      "SELECT COUNT(*) as cnt FROM staff_members WHERE businessOwnerId = ? AND active = 1 AND JSON_CONTAINS(locationIds, ?)",
      [OWNER_ID, JSON.stringify(loc.localId)]
    );
    assert(staffRows[0].cnt === 3, `Location "${loc.name}" has 3 staff`, `got ${staffRows[0].cnt}`);
  }

  // ── 5. Appointment Status Distribution ──────────────────────────────
  console.log('\n=== 5. Appointment Status Distribution ===');
  const [appts] = await conn.execute(
    'SELECT status, COUNT(*) as cnt FROM appointments WHERE businessOwnerId = ? GROUP BY status',
    [OWNER_ID]
  );
  const statusMap = Object.fromEntries(appts.map(a => [a.status, a.cnt]));
  assert((statusMap.confirmed || 0) >= 5, 'At least 5 confirmed appointments', `got ${statusMap.confirmed || 0}`);
  assert((statusMap.pending || 0) >= 2, 'At least 2 pending appointments', `got ${statusMap.pending || 0}`);
  assert((statusMap.completed || 0) >= 1, 'At least 1 completed appointment', `got ${statusMap.completed || 0}`);
  assert((statusMap.cancelled || 0) >= 1, 'At least 1 cancelled appointment', `got ${statusMap.cancelled || 0}`);

  // ── 6. Discount Math Validation ─────────────────────────────────────
  console.log('\n=== 6. Discount Math Validation ===');
  const [discAppts] = await conn.execute(
    'SELECT totalPrice, discountPercent, discountAmount, discountName FROM appointments WHERE businessOwnerId = ? AND discountPercent IS NOT NULL',
    [OWNER_ID]
  );
  for (const a of discAppts) {
    const total = parseFloat(a.totalPrice);
    const pct = parseFloat(a.discountPercent);
    const discAmt = parseFloat(a.discountAmount);
    // total = originalPrice - discountAmount
    const originalPrice = total + discAmt;
    const expectedDisc = Math.round(originalPrice * pct) / 100;
    const diff = Math.abs(expectedDisc - discAmt);
    assert(diff < 0.02, `Discount math correct for "${a.discountName}" (${pct}%)`, 
      `expected $${expectedDisc.toFixed(2)} off, got $${discAmt.toFixed(2)} off, total=$${total.toFixed(2)}`);
  }
  console.log(`  Found ${discAppts.length} appointments with discounts`);

  // ── 7. Gift Card Validation ──────────────────────────────────────────
  console.log('\n=== 7. Gift Card Validation ===');
  const [giftAppts] = await conn.execute(
    'SELECT totalPrice, giftApplied, giftUsedAmount FROM appointments WHERE businessOwnerId = ? AND giftApplied = 1',
    [OWNER_ID]
  );
  for (const a of giftAppts) {
    const total = parseFloat(a.totalPrice);
    const giftAmt = parseFloat(a.giftUsedAmount);
    assert(total >= 0, `Gift card appointment total is non-negative ($${total.toFixed(2)})`);
    assert(giftAmt > 0, `Gift card used amount is positive ($${giftAmt.toFixed(2)})`);
  }
  console.log(`  Found ${giftAppts.length} appointments with gift cards applied`);

  // Gift cards in DB
  const [giftCards] = await conn.execute('SELECT code, redeemed, expiresAt FROM gift_cards WHERE businessOwnerId = ?', [OWNER_ID]);
  for (const gc of giftCards) {
    const expiry = new Date(gc.expiresAt);
    const now = new Date();
    assert(expiry > now, `Gift card ${gc.code} is not expired`, `expires ${gc.expiresAt}`);
  }

  // ── 8. Public API Validation ─────────────────────────────────────────
  console.log('\n=== 8. Public API Validation ===');
  
  // Locations API
  const apiLocs = await fetchJson(`/api/public/business/${SLUG}/locations`);
  assert(apiLocs.length === 3, 'Public locations API returns 3 locations', `got ${apiLocs.length}`);
  assert(apiLocs.every(l => l.active === true), 'All API locations are active');
  assert(apiLocs.every(l => l.address && l.address.includes(',')), 'All API locations have full addresses');

  // Services API
  const apiSvcs = await fetchJson(`/api/public/business/${SLUG}/services`);
  assert(apiSvcs.length === 10, 'Public services API returns 10 services', `got ${apiSvcs.length}`);
  const apiCats = [...new Set(apiSvcs.map(s => s.category).filter(Boolean))];
  assert(apiCats.length >= 5, 'Public services API has 5+ categories', `got ${apiCats.length}: ${apiCats.join(', ')}`);
  assert(apiSvcs.every(s => s.category), 'All services have a category field in API response');

  // Staff API
  const apiStaff = await fetchJson(`/api/public/business/${SLUG}/staff`);
  assert(apiStaff.length === 9, 'Public staff API returns 9 staff members', `got ${apiStaff.length}`);
  assert(apiStaff.every(s => s.locationIds && s.locationIds.length > 0), 'All staff have location assignments');

  // Discounts API
  const apiDiscs = await fetchJson(`/api/public/business/${SLUG}/discounts`);
  assert(apiDiscs.length === 3, 'Public discounts API returns 3 discounts', `got ${apiDiscs.length}`);
  
  // Validate discount service scoping
  const hairDisc = apiDiscs.find(d => d.name === 'Morning Hair Special');
  assert(hairDisc !== undefined, 'Morning Hair Special discount exists in API');
  assert(hairDisc?.serviceIds?.length === 2, 'Morning Hair Special scoped to 2 services', `got ${hairDisc?.serviceIds?.length}`);
  
  const massageDisc = apiDiscs.find(d => d.name === 'Saturday Massage Deal');
  assert(massageDisc !== undefined, 'Saturday Massage Deal discount exists in API');
  assert(massageDisc?.serviceIds?.length === 2, 'Saturday Massage Deal scoped to 2 services');
  
  const allDisc = apiDiscs.find(d => d.name === 'Grand Opening Day');
  assert(allDisc !== undefined, 'Grand Opening Day discount exists in API');
  assert(allDisc?.serviceIds === null, 'Grand Opening Day applies to ALL services (serviceIds=null)');
  assert(allDisc?.dates?.length === 1, 'Grand Opening Day has 1 specific date');

  // Gift card lookup (correct endpoint: /api/public/gift/:code)
  const gcRes = await fetchJson(`/api/public/gift/LIME-GIFT-001`);
  assert(gcRes && !gcRes.error, 'Gift card LIME-GIFT-001 found via API');
  assert(gcRes?.redeemed === false || gcRes?.redeemed === 0, 'Gift card LIME-GIFT-001 is not redeemed');
  assert(gcRes?.remainingBalance === 65, `Gift card LIME-GIFT-001 has correct balance ($65)`, `got $${gcRes?.remainingBalance}`);
  assert(gcRes?.businessSlug === SLUG, 'Gift card LIME-GIFT-001 belongs to correct business');

  // Gift card 2 (LIME-GIFT-002) - seeded as $90
  const gcRes2 = await fetchJson(`/api/public/gift/LIME-GIFT-002`);
  assert(gcRes2 && !gcRes2.error, 'Gift card LIME-GIFT-002 found via API');
  assert(gcRes2?.remainingBalance === 90, `Gift card LIME-GIFT-002 has correct balance ($90)`, `got $${gcRes2?.remainingBalance}`);

  // Gift card 3 (LIME-GIFT-003)
  const gcRes3 = await fetchJson(`/api/public/gift/LIME-GIFT-003`);
  assert(gcRes3 && !gcRes3.error, 'Gift card LIME-GIFT-003 found via API');
  assert(gcRes3?.remainingBalance > 0, `Gift card LIME-GIFT-003 has positive balance`, `got $${gcRes3?.remainingBalance}`);

  // ── 9. Booking Page HTML Validation ─────────────────────────────────
  console.log('\n=== 9. Booking Page HTML Validation ===');
  const bookingHtml = await fetch(`${API}/api/book/${SLUG}`).then(r => r.text());
  assert(bookingHtml.includes('serviceList'), 'Booking page has service list element');
  assert(bookingHtml.includes('giftCode'), 'Booking page has gift code input');
  assert(bookingHtml.includes('discountInfo'), 'Booking page has discount info element');
  assert(bookingHtml.includes('biz-address-row'), 'Booking page has address row element');
  // Multi-location: server renders owner address as placeholder; JS updates to selected location
  assert(bookingHtml.includes('maps.google.com'), 'Booking page has Google Maps link for address');
  assert(bookingHtml.includes('d-xjxndn'), 'Booking page includes business slug for API calls');
  assert(bookingHtml.includes('lime-of-time.com'), 'Booking page uses lime-of-time.com canonical URL');
  
  // Test single-location booking page shows location address
  const firstLoc = apiLocs[0];
  const bookingHtmlWithLoc = await fetch(`${API}/api/book/${SLUG}?location=${firstLoc.localId}`).then(r => r.text());
  assert(bookingHtmlWithLoc.includes('100 Main St') || bookingHtmlWithLoc.includes('Pittsburgh'), 
    `Booking page with ?location= shows Downtown Studio address`);

  // ── 10. Extra Items (Products in Appointments) ───────────────────────
  console.log('\n=== 10. Extra Items (Products/Services in Appointments) ===');
  const [extraAppts] = await conn.execute(
    'SELECT totalPrice, extraItems FROM appointments WHERE businessOwnerId = ? AND extraItems IS NOT NULL',
    [OWNER_ID]
  );
  for (const a of extraAppts) {
    // MySQL2 auto-parses JSON columns, so extraItems may already be an object
    const items = parseJsonField(a.extraItems);
    assert(items !== null && Array.isArray(items), 'Extra items is valid JSON array (MySQL JSON column auto-parsed)');
    if (items && Array.isArray(items)) {
      const total = parseFloat(a.totalPrice);
      const extraTotal = items.reduce((sum, i) => sum + parseFloat(i.price || 0), 0);
      assert(total >= extraTotal, `Total ($${total.toFixed(2)}) >= extra items ($${extraTotal.toFixed(2)})`,
        `extra items: ${items.map(i => i.name + ' $' + i.price).join(', ')}`);
    }
  }
  console.log(`  Found ${extraAppts.length} appointments with extra items`);

  // ── 11. Location-Filtered Services API ──────────────────────────────
  console.log('\n=== 11. Location-Filtered Services API ===');
  const firstLocApi = apiLocs[0];
  const locFilteredSvcs = await fetchJson(`/api/public/business/${SLUG}/services?locationId=${firstLocApi.localId}`);
  // All services have null locationIds (available everywhere) so all 10 should return
  assert(locFilteredSvcs.length === 10, `Location-filtered services returns 10 (all available at ${firstLocApi.name})`, `got ${locFilteredSvcs.length}`);

  // ── 12. Time Slots API ───────────────────────────────────────────────
  console.log('\n=== 12. Time Slots API ===');
  // Get slots for next Monday
  const now = new Date();
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  const mondayStr = nextMonday.toISOString().split('T')[0];
  
  const slotsResp = await fetchJson(`/api/public/business/${SLUG}/slots?date=${mondayStr}&duration=60&locationId=${firstLocApi.localId}`);
  const slotsArr = slotsResp.slots || slotsResp;
  assert(Array.isArray(slotsArr), 'Time slots API returns array');
  assert(slotsArr.length > 0, `Time slots available for next Monday (${mondayStr})`, `got ${slotsArr.length} slots`);
  console.log(`  ${slotsArr.length} slots available for ${mondayStr} at ${firstLocApi.name}`);

  // ── 13. Appointment Location Coverage ───────────────────────────────
  console.log('\n=== 13. Appointment Location Coverage ===');
  const [apptsByLoc] = await conn.execute(
    'SELECT locationId, COUNT(*) as cnt FROM appointments WHERE businessOwnerId = ? GROUP BY locationId',
    [OWNER_ID]
  );
  assert(apptsByLoc.length === 3, 'Appointments span all 3 locations', `got ${apptsByLoc.length} locations`);
  apptsByLoc.forEach(row => {
    const locName = locs.find(l => l.localId === row.locationId)?.name || row.locationId;
    assert(row.cnt >= 2, `Location "${locName}" has 2+ appointments`, `got ${row.cnt}`);
  });

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log(`REGRESSION RESULTS: ${passed} passed, ${errors.length} failed, ${warnings.length} warnings`);
  if (errors.length > 0) {
    console.log('\n❌ FAILURES:');
    errors.forEach(e => console.log('  - ' + e));
  }
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(w => console.log('  - ' + w));
  }
  if (errors.length === 0) {
    console.log('\n🎉 All regression checks passed!');
  }

  await conn.end();
}

main().catch(err => {
  console.error('❌ Validation failed:', err.message);
  process.exit(1);
});
