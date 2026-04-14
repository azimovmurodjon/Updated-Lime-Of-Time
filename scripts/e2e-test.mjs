/**
 * Comprehensive End-to-End Test Suite
 * Tests all features of the Manus Scheduler app
 * Uses phone: 4124827733 (business owner)
 */

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

const BASE = "http://127.0.0.1:3000";
const API = `${BASE}/api/trpc`;
const OWNER_PHONE = "4124827733";

let passed = 0;
let failed = 0;
const failures = [];
const warnings = [];

function pass(name) {
  passed++;
  console.log(`  ✅ PASS  ${name}`);
}
function fail(name, detail = "") {
  failed++;
  failures.push(`${name}${detail ? ": " + detail : ""}`);
  console.log(`  ❌ FAIL  ${name}${detail ? " — " + detail : ""}`);
}
function warn(name, detail = "") {
  warnings.push(`${name}${detail ? ": " + detail : ""}`);
  console.log(`  ⚠️  WARN  ${name}${detail ? " — " + detail : ""}`);
}
function section(title) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("═".repeat(60));
}

// tRPC client
const trpc = createTRPCClient({
  links: [httpBatchLink({ url: API, transformer: superjson })],
});

// REST helper
async function rest(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  let json;
  try { json = await r.json(); } catch { json = null; }
  return { status: r.status, body: json };
}

// ─── Wipe DB ──────────────────────────────────────────────────────────────────
section("PHASE 0: Wipe DB");
try {
  const { default: mysql2 } = await import("mysql2/promise");
  // load-env.js is a side-effect module (no named exports) — just import it
  await import("../scripts/load-env.js");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const conn = await mysql2.createConnection(url);
  const [tables] = await conn.execute("SHOW TABLES");
  const tableNames = tables.map(r => Object.values(r)[0]);
  await conn.execute("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of tableNames) await conn.execute(`DELETE FROM \`${t}\``);
  await conn.execute("SET FOREIGN_KEY_CHECKS = 1");
  await conn.end();
  pass(`Wiped ${tableNames.length} tables`);
} catch (e) {
  fail("DB wipe", e.message);
}

// ─── Phase 1: Business Owner Registration ────────────────────────────────────
section("PHASE 1: Business Owner Registration");
let ownerId, ownerSlug;

try {
  const owner = await trpc.business.create.mutate({
    phone: OWNER_PHONE,
    businessName: "Lime Of Time Test",
    ownerName: "Alex Test",
    email: "alex@limeoftest.com",
    address: "134 Locust Ct",
    workingHours: {
      Mon: { enabled: true, start: "09:00", end: "18:00" },
      Tue: { enabled: true, start: "09:00", end: "18:00" },
      Wed: { enabled: true, start: "09:00", end: "18:00" },
      Thu: { enabled: true, start: "09:00", end: "18:00" },
      Fri: { enabled: true, start: "09:00", end: "17:00" },
      Sat: { enabled: false },
      Sun: { enabled: false },
    },
  });
  ownerId = owner.id;
  // Slug is auto-generated from businessName (no slug field in DB row)
  ownerSlug = (owner.customSlug || owner.businessName)
    .toLowerCase().replace(/\s+/g, "-");
  pass(`business.create → id=${ownerId}, slug=${ownerSlug}`);
} catch (e) {
  fail("business.create", e.message);
}

// ─── Phase 2: Get Full Business Data ─────────────────────────────────────────
section("PHASE 2: Get Full Business Data");
try {
  const data = await trpc.business.getFullData.query({ id: ownerId });
  if (data && data.owner) pass(`business.getFullData → owner=${data.owner.businessName}`);
  else fail("business.getFullData", "no owner in response: " + JSON.stringify(data).slice(0, 100));
} catch (e) {
  fail("business.getFullData", e.message);
}

// ─── Phase 3: Business Profile Update ────────────────────────────────────────
section("PHASE 3: Business Profile Update");
try {
  await trpc.business.update.mutate({
    id: ownerId,
    businessName: "Lime Of Time Test",
    ownerName: "Alex Test",
    email: "alex@limeoftest.com",
    address: "134 Locust Ct",
    website: "https://limeoftest.com",
    description: "Premium hair salon",
  });
  pass("business.update");
} catch (e) {
  fail("business.update", e.message);
}

// ─── Phase 4: Services ────────────────────────────────────────────────────────
section("PHASE 4: Services CRUD");
const svcId1 = `svc-${Date.now()}-1`;
const svcId2 = `svc-${Date.now()}-2`;
let svcListOk = false;

try {
  await trpc.services.create.mutate({
    businessOwnerId: ownerId,
    localId: svcId1,
    name: "Haircut",
    duration: 60,
    price: "45.00",
    color: "#22c55e",
    category: "Hair",
  });
  pass("services.create (Haircut)");
} catch (e) { fail("services.create (Haircut)", e.message); }

try {
  await trpc.services.create.mutate({
    businessOwnerId: ownerId,
    localId: svcId2,
    name: "Color Treatment",
    duration: 120,
    price: "120.00",
    color: "#a855f7",
    category: "Color",
  });
  pass("services.create (Color Treatment)");
} catch (e) { fail("services.create (Color Treatment)", e.message); }

try {
  const list = await trpc.services.list.query({ businessOwnerId: ownerId });
  if (list.length >= 2) { pass(`services.list → ${list.length} services`); svcListOk = true; }
  else fail("services.list", `expected ≥2, got ${list.length}`);
} catch (e) { fail("services.list", e.message); }

try {
  await trpc.services.update.mutate({
    localId: svcId1,
    businessOwnerId: ownerId,
    price: "50.00",
  });
  pass("services.update (price change)");
} catch (e) { fail("services.update", e.message); }

// ─── Phase 5: Locations ───────────────────────────────────────────────────────
section("PHASE 5: Locations CRUD");
const locId1 = `loc-${Date.now()}-1`;
const locId2 = `loc-${Date.now()}-2`;

try {
  await trpc.locations.create.mutate({
    businessOwnerId: ownerId,
    localId: locId1,
    name: "Main Studio",
    address: "134 Locust Ct",
    city: "Pittsburgh",
    state: "PA",
    zipCode: "15237",
    phone: "4124827733",
    isDefault: true,
    active: true,
    workingHours: {
      Mon: { enabled: true, start: "09:00", end: "18:00" },
      Tue: { enabled: true, start: "09:00", end: "18:00" },
      Wed: { enabled: true, start: "09:00", end: "18:00" },
      Thu: { enabled: true, start: "09:00", end: "18:00" },
      Fri: { enabled: true, start: "09:00", end: "17:00" },
      Sat: { enabled: false },
      Sun: { enabled: false },
    },
  });
  pass("locations.create (Main Studio)");
} catch (e) { fail("locations.create", e.message); }

try {
  await trpc.locations.create.mutate({
    businessOwnerId: ownerId,
    localId: locId2,
    name: "Downtown Branch",
    address: "500 Penn Ave",
    city: "Pittsburgh",
    state: "PA",
    zipCode: "15222",
    isDefault: false,
    active: true,
  });
  pass("locations.create (Downtown Branch)");
} catch (e) { fail("locations.create (Downtown)", e.message); }

try {
  const list = await trpc.locations.list.query({ businessOwnerId: ownerId });
  if (list.length >= 2) pass(`locations.list → ${list.length} locations`);
  else fail("locations.list", `expected ≥2, got ${list.length}`);
} catch (e) { fail("locations.list", e.message); }

try {
  await trpc.locations.update.mutate({
    localId: locId2,
    businessOwnerId: ownerId,
    phone: "4125551234",
  });
  pass("locations.update");
} catch (e) { fail("locations.update", e.message); }

// ─── Phase 6: Staff ───────────────────────────────────────────────────────────
section("PHASE 6: Staff CRUD");
const staffId1 = `staff-${Date.now()}-1`;

try {
  await trpc.staff.create.mutate({
    businessOwnerId: ownerId,
    localId: staffId1,
    name: "Jordan Smith",
    role: "Senior Stylist",
    color: "#f59e0b",
    serviceIds: [svcId1, svcId2],
    locationIds: [locId1],
    active: true,
    workingHours: {
      Mon: { enabled: true, start: "10:00", end: "18:00" },
      Tue: { enabled: true, start: "10:00", end: "18:00" },
      Wed: { enabled: false },
      Thu: { enabled: true, start: "10:00", end: "18:00" },
      Fri: { enabled: true, start: "10:00", end: "17:00" },
      Sat: { enabled: true, start: "10:00", end: "15:00" },
      Sun: { enabled: false },
    },
  });
  pass("staff.create");
} catch (e) { fail("staff.create", e.message); }

try {
  const list = await trpc.staff.list.query({ businessOwnerId: ownerId });
  if (list.length >= 1) pass(`staff.list → ${list.length} staff`);
  else fail("staff.list", `expected ≥1, got ${list.length}`);
} catch (e) { fail("staff.list", e.message); }

// ─── Phase 7: Clients ─────────────────────────────────────────────────────────
section("PHASE 7: Clients CRUD");
const clientId1 = `client-${Date.now()}-1`;
const clientId2 = `client-${Date.now()}-2`;

try {
  await trpc.clients.create.mutate({
    businessOwnerId: ownerId,
    localId: clientId1,
    name: "Sarah Johnson",
    phone: "4125551001",
    email: "sarah@example.com",
    notes: "Prefers morning appointments",
  });
  pass("clients.create (Sarah)");
} catch (e) { fail("clients.create (Sarah)", e.message); }

try {
  await trpc.clients.create.mutate({
    businessOwnerId: ownerId,
    localId: clientId2,
    name: "Mike Williams",
    phone: "4125551002",
  });
  pass("clients.create (Mike)");
} catch (e) { fail("clients.create (Mike)", e.message); }

try {
  const list = await trpc.clients.list.query({ businessOwnerId: ownerId });
  if (list.length >= 2) pass(`clients.list → ${list.length} clients`);
  else fail("clients.list", `expected ≥2, got ${list.length}`);
} catch (e) { fail("clients.list", e.message); }

try {
  await trpc.clients.update.mutate({
    localId: clientId1,
    businessOwnerId: ownerId,
    notes: "Prefers morning appointments. Allergic to ammonia.",
  });
  pass("clients.update (notes)");
} catch (e) { fail("clients.update", e.message); }

// ─── Phase 8: Appointments ────────────────────────────────────────────────────
section("PHASE 8: Appointments CRUD");
const apptId1 = `appt-${Date.now()}-1`;
const apptId2 = `appt-${Date.now()}-2`;
const apptId3 = `appt-${Date.now()}-3`;

try {
  await trpc.appointments.create.mutate({
    businessOwnerId: ownerId,
    localId: apptId1,
    clientLocalId: clientId1,
    serviceLocalId: svcId1,
    locationId: locId1,
    staffId: staffId1,
    date: "2026-04-20",
    time: "10:00",
    duration: 60,
    status: "confirmed",
    totalPrice: 50,
    notes: "First visit",
  });
  pass("appointments.create (confirmed)");
} catch (e) { fail("appointments.create (confirmed)", e.message); }

try {
  await trpc.appointments.create.mutate({
    businessOwnerId: ownerId,
    localId: apptId2,
    clientLocalId: clientId2,
    serviceLocalId: svcId2,
    locationId: locId1,
    date: "2026-04-21",
    time: "14:00",
    duration: 120,
    status: "pending",
    totalPrice: 120,
  });
  pass("appointments.create (pending)");
} catch (e) { fail("appointments.create (pending)", e.message); }

try {
  await trpc.appointments.create.mutate({
    businessOwnerId: ownerId,
    localId: apptId3,
    clientLocalId: clientId1,
    serviceLocalId: svcId1,
    locationId: locId2,
    date: "2026-04-22",
    time: "11:00",
    duration: 60,
    status: "confirmed",
    totalPrice: 50,
  });
  pass("appointments.create (location 2)");
} catch (e) { fail("appointments.create (location 2)", e.message); }

try {
  const list = await trpc.appointments.list.query({ businessOwnerId: ownerId });
  if (list.length >= 3) pass(`appointments.list → ${list.length} appointments`);
  else fail("appointments.list", `expected ≥3, got ${list.length}`);
} catch (e) { fail("appointments.list", e.message); }

try {
  await trpc.appointments.update.mutate({
    localId: apptId2,
    businessOwnerId: ownerId,
    status: "confirmed",
  });
  pass("appointments.update (accept pending)");
} catch (e) { fail("appointments.update (accept)", e.message); }

try {
  await trpc.appointments.update.mutate({
    localId: apptId3,
    businessOwnerId: ownerId,
    status: "completed",
  });
  pass("appointments.update (mark completed)");
} catch (e) { fail("appointments.update (complete)", e.message); }

// ─── Phase 9: Reviews ─────────────────────────────────────────────────────────
section("PHASE 9: Reviews CRUD");
const reviewId1 = `review-${Date.now()}-1`;

try {
  await trpc.reviews.create.mutate({
    businessOwnerId: ownerId,
    localId: reviewId1,
    clientLocalId: clientId1,
    rating: 5,
    comment: "Amazing service! Will definitely come back.",
  });
  pass("reviews.create");
} catch (e) { fail("reviews.create", e.message); }

try {
  const list = await trpc.reviews.list.query({ businessOwnerId: ownerId });
  if (list.length >= 1) pass(`reviews.list → ${list.length} reviews`);
  else fail("reviews.list", `expected ≥1, got ${list.length}`);
} catch (e) { fail("reviews.list", e.message); }

// ─── Phase 10: Products ───────────────────────────────────────────────────────
section("PHASE 10: Products CRUD");
const productId1 = `prod-${Date.now()}-1`;

try {
  await trpc.products.create.mutate({
    businessOwnerId: ownerId,
    localId: productId1,
    name: "Argan Oil Shampoo",
    price: "28.00",
    description: "Moisturizing shampoo",
    category: "Hair Care",
    inStock: true,
  });
  pass("products.create");
} catch (e) { fail("products.create", e.message); }

try {
  const list = await trpc.products.list.query({ businessOwnerId: ownerId });
  if (list.length >= 1) pass(`products.list → ${list.length} products`);
  else fail("products.list", `expected ≥1, got ${list.length}`);
} catch (e) { fail("products.list", e.message); }

// ─── Phase 11: Discounts ──────────────────────────────────────────────────────
section("PHASE 11: Discounts CRUD");
const discountId1 = `disc-${Date.now()}-1`;

try {
  await trpc.discounts.create.mutate({
    businessOwnerId: ownerId,
    localId: discountId1,
    name: "Summer Sale",
    percentage: 15,
    startTime: "09:00",
    endTime: "17:00",
    active: true,
  });
  pass("discounts.create");
} catch (e) { fail("discounts.create", e.message); }

try {
  const list = await trpc.discounts.list.query({ businessOwnerId: ownerId });
  if (list.length >= 1) pass(`discounts.list → ${list.length} discounts`);
  else fail("discounts.list", `expected ≥1, got ${list.length}`);
} catch (e) { fail("discounts.list", e.message); }

// ─── Phase 12: Gift Cards ─────────────────────────────────────────────────────
section("PHASE 12: Gift Cards CRUD");
const gcId1 = `gc-${Date.now()}-1`;
const gcCode = `LIME${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

try {
  await trpc.giftCards.create.mutate({
    businessOwnerId: ownerId,
    localId: gcId1,
    code: gcCode,
    serviceLocalId: svcId1,
    recipientName: "Emma Wilson",
    recipientPhone: "4125558888",
    message: "Happy Birthday! Enjoy your haircut.",
    expiresAt: "2027-01-01",
  });
  pass(`giftCards.create (code=${gcCode})`);
} catch (e) { fail("giftCards.create", e.message); }

try {
  const list = await trpc.giftCards.list.query({ businessOwnerId: ownerId });
  if (list.length >= 1) pass(`giftCards.list → ${list.length} gift cards`);
  else fail("giftCards.list", `expected ≥1, got ${list.length}`);
} catch (e) { fail("giftCards.list", e.message); }

try {
  const card = await trpc.giftCards.findByCode.query({ code: gcCode, businessOwnerId: ownerId });
  if (card && card.code === gcCode) pass(`giftCards.findByCode → found`);
  else fail("giftCards.findByCode", `got: ${JSON.stringify(card)}`);
} catch (e) { fail("giftCards.findByCode", e.message); }

// ─── Phase 13: Custom Schedule ────────────────────────────────────────────────
section("PHASE 13: Custom Schedule (Day Off / Special Hours)");

try {
  await trpc.customSchedule.upsert.mutate({
    businessOwnerId: ownerId,
    date: "2026-05-25",
    isOpen: false,
  });
  pass("customSchedule.upsert (day off)");
} catch (e) { fail("customSchedule.upsert (day off)", e.message); }

try {
  await trpc.customSchedule.upsert.mutate({
    businessOwnerId: ownerId,
    date: "2026-05-30",
    isOpen: true,
    startTime: "10:00",
    endTime: "14:00",
    locationId: locId1,
  });
  pass("customSchedule.upsert (special hours)");
} catch (e) { fail("customSchedule.upsert (special hours)", e.message); }

try {
  const list = await trpc.customSchedule.list.query({ businessOwnerId: ownerId });
  if (list.length >= 2) pass(`customSchedule.list → ${list.length} entries`);
  else fail("customSchedule.list", `expected ≥2, got ${list.length}`);
} catch (e) { fail("customSchedule.list", e.message); }

// ─── Phase 14: Settings Update ────────────────────────────────────────────────
section("PHASE 14: Business Settings Update");

try {
  await trpc.business.update.mutate({
    id: ownerId,
    bufferTime: 15,
    autoCompleteEnabled: true,
    autoCompleteDelayMinutes: 60,
    cancellationPolicy: { enabled: false, fee: 25, hours: 24 },
    notificationPreferences: {
      pushEnabled: true,
      emailEnabled: false,
      smsEnabled: false,
      reminderHours: 24,
    },
  });
  pass("business.update (settings)");
} catch (e) { fail("business.updateSettings", e.message); }

// ─── Phase 15: Public REST API — Business Info ────────────────────────────────
section("PHASE 15: Public REST API — Business Info");

try {
  const r = await rest("GET", `/api/public/business/${ownerSlug}`);
  if (r.status === 200 && r.body.businessName) pass(`GET /api/public/business/:slug → ${r.body.businessName}`);
  else fail("GET /api/public/business/:slug", `status=${r.status}`);
} catch (e) { fail("GET /api/public/business/:slug", e.message); }

try {
  const r = await rest("GET", `/api/public/business/${ownerSlug}/services`);
  if (r.status === 200 && r.body.length >= 2) pass(`GET /api/public/business/:slug/services → ${r.body.length} services`);
  else fail("GET /api/public/business/:slug/services", `status=${r.status}, count=${r.body?.length}`);
} catch (e) { fail("GET /api/public/business/:slug/services", e.message); }

try {
  const r = await rest("GET", `/api/public/business/${ownerSlug}/locations`);
  if (r.status === 200 && r.body.length >= 2) pass(`GET /api/public/business/:slug/locations → ${r.body.length} locations`);
  else fail("GET /api/public/business/:slug/locations", `status=${r.status}, count=${r.body?.length}`);
} catch (e) { fail("GET /api/public/business/:slug/locations", e.message); }

try {
  const r = await rest("GET", `/api/public/business/${ownerSlug}/staff`);
  if (r.status === 200 && r.body.length >= 1) pass(`GET /api/public/business/:slug/staff → ${r.body.length} staff`);
  else fail("GET /api/public/business/:slug/staff", `status=${r.status}, count=${r.body?.length}`);
} catch (e) { fail("GET /api/public/business/:slug/staff", e.message); }

// ─── Phase 16: Public REST API — Working Days & Slots ────────────────────────
section("PHASE 16: Public REST API — Working Days & Slots");

try {
  const r = await rest("GET", `/api/public/business/${ownerSlug}/working-days`);
  if (r.status === 200 && r.body.weeklyDays) {
    const enabledDays = Object.values(r.body.weeklyDays).filter(Boolean).length;
    if (enabledDays >= 5) pass(`GET working-days → ${enabledDays} enabled days`);
    else fail("GET working-days", `only ${enabledDays} enabled days: ${JSON.stringify(r.body.weeklyDays)}`);
  } else fail("GET working-days", `status=${r.status} body=${JSON.stringify(r.body).slice(0, 100)}`);
} catch (e) { fail("GET working-days", e.message); }

try {
  const r = await rest("GET", `/api/public/business/${ownerSlug}/working-days?locationId=${locId1}`);
  if (r.status === 200 && r.body.weeklyDays) {
    const enabledDays = Object.values(r.body.weeklyDays).filter(Boolean).length;
    if (enabledDays >= 5) pass(`GET working-days?locationId → ${enabledDays} enabled days`);
    else fail("GET working-days?locationId", `only ${enabledDays} enabled days`);
  } else fail("GET working-days?locationId", `status=${r.status}`);
} catch (e) { fail("GET working-days?locationId", e.message); }

let slotsOk = false;
let firstAvailableSlot = "11:00"; // fallback
try {
  const r = await rest("GET", `/api/public/business/${ownerSlug}/slots?date=2026-04-20&duration=60&serviceLocalId=${svcId1}&locationId=${locId1}`);
  if (r.status === 200) {
    const slots = r.body.slots || r.body;
    if (Array.isArray(slots) && slots.length > 0) {
      firstAvailableSlot = slots[0];
      pass(`GET slots → ${slots.length} slots (first: ${slots[0]})`);
      slotsOk = true;
    } else fail("GET slots", `0 slots returned: ${JSON.stringify(r.body).slice(0, 100)}`);
  } else fail("GET slots", `status=${r.status}`);
} catch (e) { fail("GET slots", e.message); }

// ─── Phase 17: Public REST API — Online Booking ───────────────────────────────
section("PHASE 17: Public REST API — Online Booking");
let webApptId;

try {
  const r = await rest("POST", `/api/public/business/${ownerSlug}/book`, {
    serviceLocalId: svcId1,
    locationId: locId1,
    date: "2026-04-20",
    time: firstAvailableSlot,
    clientName: "Web Client",
    clientPhone: "4125559999",
    clientEmail: "webclient@example.com",
    notes: "Booked from web",
  });
  if (r.status === 200 || r.status === 201) {
    webApptId = r.body?.appointmentId || r.body?.id;
    pass(`POST /api/public/business/:slug/book → apptId=${webApptId}`);
  } else fail("POST book", `status=${r.status} body=${JSON.stringify(r.body)}`);
} catch (e) { fail("POST book", e.message); }

// ─── Phase 18: Appointment Management (web-booked) ────────────────────────────
section("PHASE 18: Appointment Management (web-booked)");

if (webApptId) {
  try {
    const r = await rest("GET", `/api/public/appointment/${webApptId}?slug=${ownerSlug}`);
    if (r.status === 200 && r.body) pass(`GET /api/public/appointment/:id → found`);
    else fail("GET /api/public/appointment/:id", `status=${r.status}`);
  } catch (e) { fail("GET /api/public/appointment/:id", e.message); }

  try {
    const r = await rest("POST", `/api/public/appointment/${webApptId}/cancel`, {
      slug: ownerSlug,
      clientPhone: "4125559999", // matches the phone used when booking
      reason: "Client requested cancellation",
    });
    if (r.status === 200) pass("POST /api/public/appointment/:id/cancel");
    else fail("POST cancel appointment", `status=${r.status} body=${JSON.stringify(r.body)}`);
  } catch (e) { fail("POST cancel appointment", e.message); }
} else {
  warn("Appointment management tests skipped", "no webApptId from booking");
}

// ─── Phase 19: Public REST API — Review Submission ────────────────────────────
section("PHASE 19: Public REST API — Client Review Submission");

try {
  const r = await rest("POST", `/api/public/business/${ownerSlug}/review`, {
    clientName: "Happy Client",
    clientPhone: "4125557777",
    rating: 5,
    comment: "Excellent service!",
  });
  if (r.status === 200 || r.status === 201) pass("POST /api/public/business/:slug/review");
  else fail("POST review", `status=${r.status} body=${JSON.stringify(r.body)}`);
} catch (e) { fail("POST review", e.message); }

// ─── Phase 20: Public REST API — Gift Card Lookup ────────────────────────────
section("PHASE 20: Public REST API — Gift Card Lookup");

try {
  const r = await rest("GET", `/api/public/gift/${gcCode}`);
  if (r.status === 200 && r.body) pass(`GET /api/public/gift/:code → found (code=${gcCode})`);
  else fail("GET /api/public/gift/:code", `status=${r.status} body=${JSON.stringify(r.body)}`);
} catch (e) { fail("GET /api/public/gift/:code", e.message); }

// ─── Phase 21: Public REST API — Waitlist ────────────────────────────────────
section("PHASE 21: Public REST API — Waitlist");

try {
  const r = await rest("POST", `/api/public/business/${ownerSlug}/waitlist`, {
    clientName: "Waitlist Person",
    clientPhone: "4125556666",
    serviceLocalId: svcId1,
    preferredDate: "2026-04-25",
  });
  if (r.status === 200 || r.status === 201) pass("POST /api/public/business/:slug/waitlist");
  else fail("POST waitlist", `status=${r.status} body=${JSON.stringify(r.body)}`);
} catch (e) { fail("POST waitlist", e.message); }

try {
  const r = await rest("GET", `/api/public/business/${ownerSlug}/waitlist`);
  if (r.status === 200 && r.body?.length >= 1) pass(`GET waitlist → ${r.body.length} entries`);
  else fail("GET waitlist", `status=${r.status} count=${r.body?.length}`);
} catch (e) { fail("GET waitlist", e.message); }

// ─── Phase 22: Public HTML Pages ─────────────────────────────────────────────
section("PHASE 22: Public HTML Pages");

try {
  const r = await fetch(`${BASE}/api/book/${ownerSlug}`);
  const html = await r.text();
  if (r.status === 200 && html.includes("<!DOCTYPE html")) pass(`GET /api/book/:slug → HTML page`);
  else fail("GET /api/book/:slug", `status=${r.status}`);
} catch (e) { fail("GET /api/book/:slug", e.message); }

try {
  const r = await fetch(`${BASE}/api/book/${ownerSlug}/${locId1}`);
  const html = await r.text();
  if (r.status === 200 && html.includes("<!DOCTYPE html")) pass(`GET /api/book/:slug/:locationId → HTML page`);
  else fail("GET /api/book/:slug/:locationId", `status=${r.status}`);
} catch (e) { fail("GET /api/book/:slug/:locationId", e.message); }

try {
  const r = await fetch(`${BASE}/api/review/${ownerSlug}`);
  const html = await r.text();
  if (r.status === 200 && html.includes("<!DOCTYPE html")) pass(`GET /api/review/:slug → HTML page`);
  else fail("GET /api/review/:slug", `status=${r.status}`);
} catch (e) { fail("GET /api/review/:slug", e.message); }

try {
  const r = await fetch(`${BASE}/api/gift/${gcCode}`);
  const html = await r.text();
  if (r.status === 200 && html.includes("<!DOCTYPE html")) pass(`GET /api/gift/:code → HTML page`);
  else fail("GET /api/gift/:code", `status=${r.status}`);
} catch (e) { fail("GET /api/gift/:code", e.message); }

// ─── Phase 23: Edge Cases ─────────────────────────────────────────────────────
section("PHASE 23: Edge Cases & Error Handling");

try {
  const r = await rest("GET", `/api/public/business/nonexistent-slug-xyz/slots?date=2026-04-20&duration=60`);
  if (r.status === 404) pass("Non-existent business → 404");
  else fail("Non-existent business", `expected 404, got ${r.status}`);
} catch (e) { fail("Non-existent business", e.message); }

try {
  const r = await rest("GET", `/api/public/gift/INVALIDCODE123`);
  if (r.status === 404) pass("Invalid gift card → 404");
  else fail("Invalid gift card", `expected 404, got ${r.status}`);
} catch (e) { fail("Invalid gift card", e.message); }

try {
  // Saturday is a non-working day
  const r = await rest("GET", `/api/public/business/${ownerSlug}/slots?date=2026-04-18&duration=60`);
  const slots = r.body?.slots || r.body;
  if (Array.isArray(slots) && slots.length === 0) pass("Non-working day → 0 slots");
  else fail("Non-working day", `expected 0 slots, got ${JSON.stringify(slots).slice(0, 60)}`);
} catch (e) { fail("Non-working day", e.message); }

// ─── Phase 24: Delete Operations ─────────────────────────────────────────────
section("PHASE 24: Delete Operations");

try { await trpc.reviews.delete.mutate({ localId: reviewId1, businessOwnerId: ownerId }); pass("reviews.delete"); }
catch (e) { fail("reviews.delete", e.message); }

try { await trpc.products.delete.mutate({ localId: productId1, businessOwnerId: ownerId }); pass("products.delete"); }
catch (e) { fail("products.delete", e.message); }

try { await trpc.giftCards.delete.mutate({ localId: gcId1, businessOwnerId: ownerId }); pass("giftCards.delete"); }
catch (e) { fail("giftCards.delete", e.message); }

try { await trpc.discounts.delete.mutate({ localId: discountId1, businessOwnerId: ownerId }); pass("discounts.delete"); }
catch (e) { fail("discounts.delete", e.message); }

try { await trpc.appointments.delete.mutate({ localId: apptId1, businessOwnerId: ownerId }); pass("appointments.delete (1)"); }
catch (e) { fail("appointments.delete (1)", e.message); }

try { await trpc.appointments.delete.mutate({ localId: apptId2, businessOwnerId: ownerId }); pass("appointments.delete (2)"); }
catch (e) { fail("appointments.delete (2)", e.message); }

try { await trpc.appointments.delete.mutate({ localId: apptId3, businessOwnerId: ownerId }); pass("appointments.delete (3)"); }
catch (e) { fail("appointments.delete (3)", e.message); }

try { await trpc.staff.delete.mutate({ localId: staffId1, businessOwnerId: ownerId }); pass("staff.delete"); }
catch (e) { fail("staff.delete", e.message); }

try { await trpc.clients.delete.mutate({ localId: clientId1, businessOwnerId: ownerId }); pass("clients.delete (1)"); }
catch (e) { fail("clients.delete (1)", e.message); }

try { await trpc.clients.delete.mutate({ localId: clientId2, businessOwnerId: ownerId }); pass("clients.delete (2)"); }
catch (e) { fail("clients.delete (2)", e.message); }

try { await trpc.services.delete.mutate({ localId: svcId1, businessOwnerId: ownerId }); pass("services.delete (1)"); }
catch (e) { fail("services.delete (1)", e.message); }

try { await trpc.services.delete.mutate({ localId: svcId2, businessOwnerId: ownerId }); pass("services.delete (2)"); }
catch (e) { fail("services.delete (2)", e.message); }

try { await trpc.locations.delete.mutate({ localId: locId1, businessOwnerId: ownerId }); pass("locations.delete (1)"); }
catch (e) { fail("locations.delete (1)", e.message); }

try { await trpc.locations.delete.mutate({ localId: locId2, businessOwnerId: ownerId }); pass("locations.delete (2)"); }
catch (e) { fail("locations.delete (2)", e.message); }

// ─── Phase 25: Data Integrity Checks ─────────────────────────────────────────
section("PHASE 25: Data Integrity After Deletes");

try {
  const list = await trpc.appointments.list.query({ businessOwnerId: ownerId });
  const found = list.some(a => a.localId === apptId1);
  if (!found) pass("Deleted appointment not in list");
  else fail("Deleted appointment still in list");
} catch (e) { fail("Data integrity: appointments", e.message); }

try {
  const list = await trpc.services.list.query({ businessOwnerId: ownerId });
  const found = list.some(s => s.localId === svcId1);
  if (!found) pass("Deleted service not in list");
  else fail("Deleted service still in list");
} catch (e) { fail("Data integrity: services", e.message); }

try {
  const list = await trpc.clients.list.query({ businessOwnerId: ownerId });
  const found = list.some(c => c.localId === clientId1);
  if (!found) pass("Deleted client not in list");
  else fail("Deleted client still in list");
} catch (e) { fail("Data integrity: clients", e.message); }

// ─── Final Report ─────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(60)}`);
console.log("  FINAL REPORT");
console.log("═".repeat(60));
console.log(`  Total tests : ${passed + failed}`);
console.log(`  ✅ Passed   : ${passed}`);
console.log(`  ❌ Failed   : ${failed}`);
if (warnings.length > 0) console.log(`  ⚠️  Warnings : ${warnings.length}`);
console.log(`  Pass rate   : ${Math.round((passed / (passed + failed)) * 100)}%`);
if (failures.length > 0) {
  console.log("  ── FAILED TESTS ──────────────────────────────────────");
  failures.forEach(f => console.log(`    ❌ ${f}`));
}
if (warnings.length > 0) {
  console.log("  ── WARNINGS ──────────────────────────────────────────");
  warnings.forEach(w => console.log(`    ⚠️  ${w}`));
}
console.log(`  Business Owner ID : ${ownerId}`);
console.log(`  Business Slug     : ${ownerSlug}`);
console.log(`  Booking URL       : ${BASE}/api/book/${ownerSlug}`);
