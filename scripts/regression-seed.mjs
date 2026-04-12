/**
 * Full Regression Seed Script
 * Creates: 3 locations, 3 staff per location, 3 clients per location,
 * 10 services (5 categories), 10 products (4 brands),
 * 3 gift cards, 3 discounts (service-specific, product-specific, all),
 * 10 appointments (various scheduling methods)
 */
import { createConnection } from 'mysql2/promise';
const DB_URL = process.env.DATABASE_URL;
const OWNER_ID = 660001;

function uid() {
  return Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 8);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function futureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

const WORKING_HOURS = JSON.stringify({
  monday: { enabled: true, start: '09:00', end: '18:00' },
  tuesday: { enabled: true, start: '09:00', end: '18:00' },
  wednesday: { enabled: true, start: '09:00', end: '18:00' },
  thursday: { enabled: true, start: '09:00', end: '18:00' },
  friday: { enabled: true, start: '09:00', end: '17:00' },
  saturday: { enabled: true, start: '10:00', end: '15:00' },
  sunday: { enabled: false, start: '09:00', end: '17:00' },
});

async function main() {
  const conn = await createConnection(DB_URL);
  console.log('✅ Connected to DB');

  // ── Clean up previous regression test data ──────────────────────────
  console.log('\n🧹 Cleaning previous regression data...');
  await conn.execute('DELETE FROM appointments WHERE businessOwnerId = ?', [OWNER_ID]);
  await conn.execute('DELETE FROM gift_cards WHERE businessOwnerId = ?', [OWNER_ID]);
  await conn.execute('DELETE FROM discounts WHERE businessOwnerId = ?', [OWNER_ID]);
  await conn.execute('DELETE FROM clients WHERE businessOwnerId = ?', [OWNER_ID]);
  await conn.execute('DELETE FROM staff_members WHERE businessOwnerId = ?', [OWNER_ID]);
  await conn.execute('DELETE FROM services WHERE businessOwnerId = ?', [OWNER_ID]);
  await conn.execute('DELETE FROM products WHERE businessOwnerId = ?', [OWNER_ID]);
  await conn.execute('DELETE FROM locations WHERE businessOwnerId = ?', [OWNER_ID]);
  console.log('✅ Cleaned');

  // ── 1. Create 3 Locations ────────────────────────────────────────────
  console.log('\n📍 Creating 3 locations...');
  const locationLocalIds = [];
  const locationData = [
    { name: 'Downtown Studio', address: '100 Main St', city: 'Pittsburgh', state: 'PA', zipCode: '15201', phone: '4125550001', email: 'downtown@limetest.com', isDefault: true },
    { name: 'East Side Branch', address: '200 Penn Ave', city: 'Pittsburgh', state: 'PA', zipCode: '15224', phone: '4125550002', email: 'eastside@limetest.com', isDefault: false },
    { name: 'Northside Salon', address: '300 Federal St', city: 'Pittsburgh', state: 'PA', zipCode: '15212', phone: '4125550003', email: 'northside@limetest.com', isDefault: false },
  ];
  for (const loc of locationData) {
    const localId = uid();
    locationLocalIds.push(localId);
    await conn.execute(
      `INSERT INTO locations (businessOwnerId, localId, name, address, city, state, zipCode, phone, email, isDefault, active, temporarilyClosed, workingHours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
      [OWNER_ID, localId, loc.name, loc.address, loc.city, loc.state, loc.zipCode, loc.phone, loc.email, loc.isDefault ? 1 : 0, WORKING_HOURS]
    );
    console.log(`  ✅ Location: ${loc.name} (${localId})`);
  }

  // ── 2. Create 10 Services (5 categories) ────────────────────────────
  console.log('\n💅 Creating 10 services...');
  const serviceLocalIds = [];
  const serviceData = [
    // Hair
    { name: 'Haircut & Style', duration: 60, price: '65.00', color: '#E91E63', category: 'Hair' },
    { name: 'Color Treatment', duration: 120, price: '120.00', color: '#9C27B0', category: 'Hair' },
    // Nails
    { name: 'Manicure', duration: 45, price: '35.00', color: '#FF5722', category: 'Nails' },
    { name: 'Pedicure', duration: 60, price: '45.00', color: '#FF9800', category: 'Nails' },
    // Skin
    { name: 'Facial Treatment', duration: 75, price: '85.00', color: '#4CAF50', category: 'Skin' },
    { name: 'Deep Cleanse', duration: 60, price: '70.00', color: '#8BC34A', category: 'Skin' },
    // Massage
    { name: 'Swedish Massage', duration: 60, price: '90.00', color: '#2196F3', category: 'Massage' },
    { name: 'Hot Stone Massage', duration: 90, price: '130.00', color: '#03A9F4', category: 'Massage' },
    // Waxing
    { name: 'Eyebrow Wax', duration: 20, price: '18.00', color: '#795548', category: 'Waxing' },
    { name: 'Full Leg Wax', duration: 45, price: '55.00', color: '#9E9E9E', category: 'Waxing' },
  ];
  for (const svc of serviceData) {
    const localId = uid();
    serviceLocalIds.push(localId);
    await conn.execute(
      `INSERT INTO services (businessOwnerId, localId, name, duration, price, color, category, locationIds)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      [OWNER_ID, localId, svc.name, svc.duration, svc.price, svc.color, svc.category]
    );
    console.log(`  ✅ Service: ${svc.name} ($${svc.price})`);
  }

  // ── 3. Create 10 Products (4 brands) ────────────────────────────────
  console.log('\n📦 Creating 10 products...');
  const productLocalIds = [];
  const productData = [
    // Kerastase
    { name: 'Kerastase Shampoo', price: '32.00', brand: 'Kerastase', description: 'Luxury hydrating shampoo' },
    { name: 'Kerastase Conditioner', price: '35.00', brand: 'Kerastase', description: 'Deep conditioning treatment' },
    { name: 'Kerastase Hair Mask', price: '48.00', brand: 'Kerastase', description: 'Intensive repair mask' },
    // OPI
    { name: 'OPI Nail Polish - Red', price: '12.00', brand: 'OPI', description: 'Classic red nail polish' },
    { name: 'OPI Nail Polish - Nude', price: '12.00', brand: 'OPI', description: 'Natural nude finish' },
    // Dermalogica
    { name: 'Dermalogica Cleanser', price: '42.00', brand: 'Dermalogica', description: 'Daily microfoliant cleanser' },
    { name: 'Dermalogica Moisturizer', price: '58.00', brand: 'Dermalogica', description: 'Active moist SPF30' },
    { name: 'Dermalogica Eye Cream', price: '65.00', brand: 'Dermalogica', description: 'Multivitamin power eye cream' },
    // Moroccanoil
    { name: 'Moroccanoil Treatment', price: '44.00', brand: 'Moroccanoil', description: 'Argan oil hair treatment' },
    { name: 'Moroccanoil Dry Shampoo', price: '26.00', brand: 'Moroccanoil', description: 'Light dry shampoo' },
  ];
  for (const prod of productData) {
    const localId = uid();
    productLocalIds.push(localId);
    await conn.execute(
      `INSERT INTO products (businessOwnerId, localId, name, price, description, brand, available)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [OWNER_ID, localId, prod.name, prod.price, prod.description, prod.brand]
    );
    console.log(`  ✅ Product: ${prod.name} ($${prod.price}) [${prod.brand}]`);
  }

  // ── 4. Create 3 Staff per Location ──────────────────────────────────
  console.log('\n👥 Creating 3 staff per location (9 total)...');
  const staffLocalIds = { loc0: [], loc1: [], loc2: [] };
  const staffData = [
    { name: 'Sophie Turner', role: 'Senior Stylist', color: '#E91E63', phone: '4125551001', email: 'sophie@limetest.com' },
    { name: 'Marcus Chen', role: 'Nail Technician', color: '#2196F3', phone: '4125551002', email: 'marcus@limetest.com' },
    { name: 'Aisha Johnson', role: 'Esthetician', color: '#4CAF50', phone: '4125551003', email: 'aisha@limetest.com' },
    { name: 'Diego Rivera', role: 'Massage Therapist', color: '#FF9800', phone: '4125551004', email: 'diego@limetest.com' },
    { name: 'Emma Wilson', role: 'Wax Specialist', color: '#9C27B0', phone: '4125551005', email: 'emma@limetest.com' },
    { name: 'James Park', role: 'Hair Colorist', color: '#795548', phone: '4125551006', email: 'james@limetest.com' },
    { name: 'Priya Patel', role: 'Skin Therapist', color: '#00BCD4', phone: '4125551007', email: 'priya@limetest.com' },
    { name: 'Carlos Mendez', role: 'Stylist', color: '#FF5722', phone: '4125551008', email: 'carlos@limetest.com' },
    { name: 'Lily Zhang', role: 'Beauty Consultant', color: '#8BC34A', phone: '4125551009', email: 'lily@limetest.com' },
  ];
  for (let i = 0; i < 9; i++) {
    const staff = staffData[i];
    const locIdx = Math.floor(i / 3);
    const locLocalId = locationLocalIds[locIdx];
    const localId = uid();
    staffLocalIds[`loc${locIdx}`].push(localId);
    await conn.execute(
      `INSERT INTO staff_members (businessOwnerId, localId, name, phone, email, role, color, serviceIds, locationIds, workingHours, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [OWNER_ID, localId, staff.name, staff.phone, staff.email, staff.role, staff.color,
       JSON.stringify(serviceLocalIds), JSON.stringify([locLocalId]), WORKING_HOURS]
    );
    console.log(`  ✅ Staff: ${staff.name} @ Location ${locIdx + 1} (${locLocalId})`);
  }

  // ── 5. Create 3 Clients per Location ────────────────────────────────
  console.log('\n👤 Creating 3 clients per location (9 total)...');
  const clientLocalIds = [];
  const clientData = [
    { name: 'Alice Morgan', phone: '4125552001', email: 'alice@test.com', notes: 'Prefers morning appointments' },
    { name: 'Bob Stevens', phone: '4125552002', email: 'bob@test.com', notes: 'Allergic to certain dyes' },
    { name: 'Carol White', phone: '4125552003', email: 'carol@test.com', notes: 'VIP client' },
    { name: 'David Brown', phone: '4125552004', email: 'david@test.com', notes: 'Regular weekly visits' },
    { name: 'Eva Martinez', phone: '4125552005', email: 'eva@test.com', notes: 'Prefers female staff' },
    { name: 'Frank Lee', phone: '4125552006', email: 'frank@test.com', notes: 'First-time client' },
    { name: 'Grace Kim', phone: '4125552007', email: 'grace@test.com', notes: 'Birthday in June' },
    { name: 'Henry Davis', phone: '4125552008', email: 'henry@test.com', notes: 'Sensitive skin' },
    { name: 'Iris Thompson', phone: '4125552009', email: 'iris@test.com', notes: 'Referred by Carol' },
  ];
  for (const client of clientData) {
    const localId = uid();
    clientLocalIds.push(localId);
    await conn.execute(
      `INSERT INTO clients (businessOwnerId, localId, name, phone, email, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [OWNER_ID, localId, client.name, client.phone, client.email, client.notes]
    );
    console.log(`  ✅ Client: ${client.name}`);
  }

  // ── 6. Create 3 Discounts ────────────────────────────────────────────
  console.log('\n🏷️ Creating 3 discounts...');
  const discountLocalIds = [];

  // Discount 1: 20% off Hair services only (Mon-Fri 9-11am)
  const d1Id = uid();
  discountLocalIds.push(d1Id);
  await conn.execute(
    `INSERT INTO discounts (businessOwnerId, localId, name, percentage, startTime, endTime, daysOfWeek, dates, serviceIds, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 1)`,
    [OWNER_ID, d1Id, 'Morning Hair Special', 20, '09:00', '11:00',
     JSON.stringify(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
     JSON.stringify([serviceLocalIds[0], serviceLocalIds[1]])]
  );
  console.log('  ✅ Discount 1: Morning Hair Special (20% off Hair services 9-11am Mon-Fri)');

  // Discount 2: 15% off Massage services only (all day Saturday)
  const d2Id = uid();
  discountLocalIds.push(d2Id);
  await conn.execute(
    `INSERT INTO discounts (businessOwnerId, localId, name, percentage, startTime, endTime, daysOfWeek, dates, serviceIds, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 1)`,
    [OWNER_ID, d2Id, 'Saturday Massage Deal', 15, '10:00', '15:00',
     JSON.stringify(['saturday']),
     JSON.stringify([serviceLocalIds[6], serviceLocalIds[7]])]
  );
  console.log('  ✅ Discount 2: Saturday Massage Deal (15% off Massage services on Saturday)');

  // Discount 3: 10% off ALL services (specific future date)
  const d3Id = uid();
  discountLocalIds.push(d3Id);
  await conn.execute(
    `INSERT INTO discounts (businessOwnerId, localId, name, percentage, startTime, endTime, daysOfWeek, dates, serviceIds, active)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, 1)`,
    [OWNER_ID, d3Id, 'Grand Opening Day', 10, '09:00', '18:00',
     JSON.stringify([futureDate(7)])]
  );
  console.log(`  ✅ Discount 3: Grand Opening Day (10% off ALL services on ${futureDate(7)})`);

  // ── 7. Create 3 Gift Cards ───────────────────────────────────────────
  console.log('\n🎁 Creating 3 gift cards...');
  const giftCardCodes = ['LIME-GIFT-001', 'LIME-GIFT-002', 'LIME-GIFT-003'];
  const giftCardData = [
    { code: giftCardCodes[0], serviceLocalId: serviceLocalIds[0], recipientName: 'Alice Morgan', recipientPhone: '4125552001', message: 'Enjoy your haircut!', expiresAt: futureDate(365) },
    { code: giftCardCodes[1], serviceLocalId: serviceLocalIds[6], recipientName: 'Grace Kim', recipientPhone: '4125552007', message: 'Happy Birthday! Relax and enjoy.', expiresAt: futureDate(180) },
    { code: giftCardCodes[2], serviceLocalId: serviceLocalIds[4], recipientName: 'Carol White', recipientPhone: '4125552003', message: 'Thank you for being a VIP client!', expiresAt: futureDate(90) },
  ];
  for (const gc of giftCardData) {
    const localId = uid();
    await conn.execute(
      `INSERT INTO gift_cards (businessOwnerId, localId, code, serviceLocalId, recipientName, recipientPhone, message, redeemed, expiresAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [OWNER_ID, localId, gc.code, gc.serviceLocalId, gc.recipientName, gc.recipientPhone, gc.message, gc.expiresAt]
    );
    console.log(`  ✅ Gift Card: ${gc.code} → ${gc.recipientName} (service: ${gc.serviceLocalId})`);
  }

  // ── 8. Create 10 Appointments ────────────────────────────────────────
  console.log('\n📅 Creating 10 appointments...');
  const appointmentData = [
    // Standard confirmed appointment
    { clientLocalId: clientLocalIds[0], serviceLocalId: serviceLocalIds[0], date: futureDate(1), time: '10:00', duration: 60, status: 'confirmed', notes: 'Regular haircut', totalPrice: '65.00', discountPercent: null, discountAmount: null, discountName: null, giftApplied: false, giftUsedAmount: null, staffId: staffLocalIds.loc0[0], locationId: locationLocalIds[0], extraItems: null },
    // With 20% morning hair discount applied
    { clientLocalId: clientLocalIds[1], serviceLocalId: serviceLocalIds[0], date: futureDate(2), time: '09:30', duration: 60, status: 'confirmed', notes: 'Morning discount applied', totalPrice: '52.00', discountPercent: 20, discountAmount: '13.00', discountName: 'Morning Hair Special', giftApplied: false, giftUsedAmount: null, staffId: staffLocalIds.loc0[1], locationId: locationLocalIds[0], extraItems: null },
    // With gift card applied (haircut fully covered)
    { clientLocalId: clientLocalIds[2], serviceLocalId: serviceLocalIds[0], date: futureDate(3), time: '11:00', duration: 60, status: 'pending', notes: 'Gift card LIME-GIFT-001 applied', totalPrice: '0.00', discountPercent: null, discountAmount: null, discountName: null, giftApplied: true, giftUsedAmount: '65.00', staffId: staffLocalIds.loc0[2], locationId: locationLocalIds[0], extraItems: null },
    // Color treatment with product add-on
    { clientLocalId: clientLocalIds[3], serviceLocalId: serviceLocalIds[1], date: futureDate(4), time: '13:00', duration: 120, status: 'confirmed', notes: 'Color + Kerastase mask', totalPrice: '168.00', discountPercent: null, discountAmount: null, discountName: null, giftApplied: false, giftUsedAmount: null, staffId: staffLocalIds.loc1[0], locationId: locationLocalIds[1], extraItems: JSON.stringify([{ type: 'product', id: productLocalIds[2], name: 'Kerastase Hair Mask', price: 48.00 }]) },
    // Massage with Saturday discount
    { clientLocalId: clientLocalIds[4], serviceLocalId: serviceLocalIds[6], date: futureDate(5), time: '11:00', duration: 60, status: 'confirmed', notes: 'Saturday massage deal', totalPrice: '76.50', discountPercent: 15, discountAmount: '13.50', discountName: 'Saturday Massage Deal', giftApplied: false, giftUsedAmount: null, staffId: staffLocalIds.loc1[1], locationId: locationLocalIds[1], extraItems: null },
    // Facial with product add-on + gift card partial
    { clientLocalId: clientLocalIds[5], serviceLocalId: serviceLocalIds[4], date: futureDate(6), time: '14:00', duration: 75, status: 'confirmed', notes: 'Facial + Dermalogica cleanser, partial gift card', totalPrice: '42.00', discountPercent: null, discountAmount: null, discountName: null, giftApplied: true, giftUsedAmount: '85.00', staffId: staffLocalIds.loc1[2], locationId: locationLocalIds[1], extraItems: JSON.stringify([{ type: 'product', id: productLocalIds[5], name: 'Dermalogica Cleanser', price: 42.00 }]) },
    // Hot stone massage at location 3
    { clientLocalId: clientLocalIds[6], serviceLocalId: serviceLocalIds[7], date: futureDate(7), time: '10:00', duration: 90, status: 'pending', notes: 'Grand opening day discount', totalPrice: '117.00', discountPercent: 10, discountAmount: '13.00', discountName: 'Grand Opening Day', giftApplied: false, giftUsedAmount: null, staffId: staffLocalIds.loc2[0], locationId: locationLocalIds[2], extraItems: null },
    // Manicure + pedicure combo
    { clientLocalId: clientLocalIds[7], serviceLocalId: serviceLocalIds[2], date: futureDate(8), time: '15:00', duration: 45, status: 'confirmed', notes: 'Mani + pedi + OPI polish', totalPrice: '92.00', discountPercent: null, discountAmount: null, discountName: null, giftApplied: false, giftUsedAmount: null, staffId: staffLocalIds.loc2[1], locationId: locationLocalIds[2], extraItems: JSON.stringify([{ type: 'service', id: serviceLocalIds[3], name: 'Pedicure', price: 45.00, duration: 60 }, { type: 'product', id: productLocalIds[3], name: 'OPI Nail Polish - Red', price: 12.00 }]) },
    // Completed appointment
    { clientLocalId: clientLocalIds[8], serviceLocalId: serviceLocalIds[8], date: futureDate(-3), time: '10:00', duration: 20, status: 'completed', notes: 'Eyebrow wax - completed', totalPrice: '18.00', discountPercent: null, discountAmount: null, discountName: null, giftApplied: false, giftUsedAmount: null, staffId: staffLocalIds.loc2[2], locationId: locationLocalIds[2], extraItems: null },
    // Cancelled appointment
    { clientLocalId: clientLocalIds[0], serviceLocalId: serviceLocalIds[9], date: futureDate(-1), time: '14:00', duration: 45, status: 'cancelled', notes: 'Cancelled by client', totalPrice: '55.00', discountPercent: null, discountAmount: null, discountName: null, giftApplied: false, giftUsedAmount: null, staffId: staffLocalIds.loc0[0], locationId: locationLocalIds[0], extraItems: null },
  ];

  for (let i = 0; i < appointmentData.length; i++) {
    const appt = appointmentData[i];
    const localId = uid();
    await conn.execute(
      `INSERT INTO appointments (businessOwnerId, localId, serviceLocalId, clientLocalId, date, time, duration, status, notes, totalPrice, extraItems, discountPercent, discountAmount, discountName, giftApplied, giftUsedAmount, staffId, locationId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [OWNER_ID, localId, appt.serviceLocalId, appt.clientLocalId, appt.date, appt.time, appt.duration,
       appt.status, appt.notes, appt.totalPrice, appt.extraItems,
       appt.discountPercent, appt.discountAmount, appt.discountName,
       appt.giftApplied ? 1 : 0, appt.giftUsedAmount, appt.staffId, appt.locationId]
    );
    console.log(`  ✅ Appointment ${i + 1}: ${appt.status} | $${appt.totalPrice} | ${appt.date} ${appt.time}`);
  }

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n📊 Regression Seed Summary:');
  console.log(`  Locations: ${locationLocalIds.length}`);
  console.log(`  Services: ${serviceLocalIds.length}`);
  console.log(`  Products: ${productLocalIds.length}`);
  console.log(`  Staff: 9 (3 per location)`);
  console.log(`  Clients: ${clientLocalIds.length}`);
  console.log(`  Discounts: ${discountLocalIds.length}`);
  console.log(`  Gift Cards: 3 (codes: ${giftCardCodes.join(', ')})`);
  console.log(`  Appointments: ${appointmentData.length}`);
  console.log('\n🎉 Regression seed complete!');
  console.log('\nKey IDs for validation:');
  console.log('  Location IDs:', locationLocalIds);
  console.log('  Service IDs (first 3):', serviceLocalIds.slice(0, 3));
  console.log('  Product IDs (first 3):', productLocalIds.slice(0, 3));
  console.log('  Client IDs (first 3):', clientLocalIds.slice(0, 3));
  console.log('  Discount IDs:', discountLocalIds);
  console.log('  Gift Card Codes:', giftCardCodes);

  await conn.end();
}

main().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
