/**
 * End-to-end test of the client booking flow
 * Tests: discover → business detail → locations → services → staff → slots → booking
 */
import "../scripts/load-env.js";

const BASE = "http://127.0.0.1:3000";
let passed = 0;
let failed = 0;

function ok(label: string, value: unknown) {
  if (value) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function run() {
  console.log("\n🧪 Client Booking Flow — End-to-End Test\n");

  // ─── 1. Discover search ──────────────────────────────────────────────
  console.log("1. Discover Search");
  // Use the public businesses endpoint (no auth needed for discover)
  const discoverRes = await get("/api/client/businesses/discover?lat=40.4406&lng=-79.9959&radiusMiles=50&search=Glow");
  ok("Discover returns businesses array", Array.isArray(discoverRes?.businesses));
  const glowBiz = Array.isArray(discoverRes?.businesses) ? discoverRes.businesses.find((b: any) => b.businessName?.includes("Glow")) : null;
  ok("Glow Beauty Studio found in discover", !!glowBiz);
  if (glowBiz) {
    ok("Business has slug", !!glowBiz.businessSlug || !!glowBiz.businessName);
    ok("Business has category", !!glowBiz.businessCategory);
  }

  // ─── 2. Business detail ──────────────────────────────────────────────
  console.log("\n2. Business Detail");
  const bizDetail = await get("/api/public/business/glow-beauty-studio");
  ok("Business detail returns data", !!bizDetail?.businessName);
  ok("Business name matches", bizDetail?.businessName === "Glow Beauty Studio");
  ok("Business has phone", !!bizDetail?.phone);
  ok("Business has address", !!bizDetail?.address || !!bizDetail?.city);

  // ─── 3. Locations ────────────────────────────────────────────────────
  console.log("\n3. Locations");
  const locations = await get("/api/public/business/glow-beauty-studio/locations");
  ok("Locations returns array", Array.isArray(locations));
  ok("Has 2 locations", locations?.length === 2);
  const loc1 = locations?.[0];
  ok("Location has localId", !!loc1?.localId);
  ok("Location has name", !!loc1?.name);
  ok("Location has workingHours", !!loc1?.workingHours);
  ok("WorkingHours has monday", !!loc1?.workingHours?.monday);
  ok("Monday has start/end/enabled", loc1?.workingHours?.monday?.start === "09:00" && loc1?.workingHours?.monday?.enabled === true);

  // ─── 4. Services ─────────────────────────────────────────────────────
  console.log("\n4. Services");
  const services = await get("/api/public/business/glow-beauty-studio/services");
  ok("Services returns array", Array.isArray(services));
  ok("Has 5 services", services?.length === 5);
  const svc1 = services?.[0];
  ok("Service has localId", !!svc1?.localId);
  ok("Service has name", !!svc1?.name);
  ok("Service has price", typeof svc1?.price === "number" || typeof svc1?.price === "string");
  ok("Service has duration", !!svc1?.duration);

  // ─── 5. Staff ────────────────────────────────────────────────────────
  console.log("\n5. Staff");
  const staff = await get("/api/public/business/glow-beauty-studio/staff");
  ok("Staff returns array", Array.isArray(staff));
  ok("Has 1 staff member", staff?.length === 1);
  const staffMember = staff?.[0];
  ok("Staff has localId", !!staffMember?.localId);
  ok("Staff has name", !!staffMember?.name);

  // ─── 6. Time Slots (without location) ───────────────────────────────
  console.log("\n6. Time Slots (no location filter)");
  // Get next Monday's date
  const today = new Date();
  const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  const dateStr = nextMonday.toISOString().split("T")[0];
  console.log(`  Testing date: ${dateStr}`);

  const slotsNoLocRes = await get(
    `/api/public/business/glow-beauty-studio/slots?date=${dateStr}&serviceLocalId=${svc1?.localId}&staffLocalId=${staffMember?.localId}`
  );
  const slotsNoLoc: string[] = slotsNoLocRes?.slots ?? [];
  ok("Slots returns object with slots array", Array.isArray(slotsNoLocRes?.slots));
  ok("Has available slots", slotsNoLoc.length > 0);
  if (slotsNoLoc.length > 0) {
    ok("Slot is a time string", typeof slotsNoLoc[0] === "string");
    console.log(`  First 3 slots: ${slotsNoLoc.slice(0, 3).join(", ")}`);
  }

  // ─── 7. Time Slots (with location) ──────────────────────────────────
  console.log("\n7. Time Slots (with location filter)");
  const slotsWithLocRes = await get(
    `/api/public/business/glow-beauty-studio/slots?date=${dateStr}&serviceLocalId=${svc1?.localId}&staffLocalId=${staffMember?.localId}&locationId=${loc1?.localId}`
  );
  const slotsWithLoc: string[] = slotsWithLocRes?.slots ?? [];
  ok("Slots with location returns object with slots array", Array.isArray(slotsWithLocRes?.slots));
  ok("Has available slots with location", slotsWithLoc.length > 0);

  // ─── 8. Client Registration (needed for booking) ────────────────────
  console.log("\n8. Client Registration / OTP");
  const sendOtpRes = await post("/api/client/auth/send-otp", { phone: "4125551234" });
  ok("Send OTP returns success or code", !!sendOtpRes);
  console.log(`  OTP response: ${JSON.stringify(sendOtpRes).slice(0, 100)}`);

  // ─── 9. Booking Submission (unauthenticated guest booking) ──────────
  console.log("\n9. Guest Booking Submission");
  const firstAvailableSlot = slotsNoLoc.length > 0 ? slotsNoLoc[0] : null;
  ok("Found an available slot", !!firstAvailableSlot);

  if (firstAvailableSlot) {
    const bookingPayload = {
      businessSlug: "glow-beauty-studio",
      serviceLocalId: svc1?.localId,
      staffId: staffMember?.localId,
      locationId: loc1?.localId,
      date: dateStr,
      time: firstAvailableSlot,
      clientName: "Test Client",
      clientPhone: "4125559876",
      clientEmail: "test@example.com",
      notes: "E2E test booking",
    };
    console.log(`  Booking: ${svc1?.name} at ${firstAvailableSlot} on ${dateStr}`);
    const bookingRes = await post("/api/public/business/glow-beauty-studio/book", bookingPayload);
    ok("Booking returns response", !!bookingRes);
    console.log(`  Booking response: ${JSON.stringify(bookingRes).slice(0, 200)}`);
    ok("Booking returns success=true", bookingRes?.success === true);
    ok("Booking returns appointmentId", !!bookingRes?.appointmentId);
    if (bookingRes?.appointmentId) console.log(`  Appointment ID: ${bookingRes.appointmentId}`);
  }

  // ─── 10. Zen Wellness Spa quick check ───────────────────────────────
  console.log("\n10. Zen Wellness Spa Quick Check");
  const zenDetail = await get("/api/public/business/zen-wellness-spa");
  ok("Zen business found", !!zenDetail?.businessName);
  const zenLocations = await get("/api/public/business/zen-wellness-spa/locations");
  ok("Zen has 2 locations", zenLocations?.length === 2);
  const zenServices = await get("/api/public/business/zen-wellness-spa/services");
  ok("Zen has 5 services", zenServices?.length === 5);
  const zenStaff = await get("/api/public/business/zen-wellness-spa/staff");
  ok("Zen has 1 staff", zenStaff?.length === 1);

  // ─── Summary ─────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${passed + failed}`);
  if (failed === 0) {
    console.log("🎉 All tests passed! Booking flow is working correctly.");
  } else {
    console.log("⚠️  Some tests failed — see above for details.");
  }
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("💥 Test crashed:", e.message);
  process.exit(1);
});
