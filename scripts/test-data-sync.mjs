/**
 * test-data-sync.mjs
 * Validates that the getFullData API returns all required fields
 * so the app can correctly populate discounts, giftCards, locations, products, staff.
 */
import mysql from "mysql2/promise";
import fetch from "node-fetch";

const DB_URL = process.env.DATABASE_URL || "mysql://root:password@localhost:3306/manus_scheduler";
const API = "http://localhost:3000";

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function getBusinessOwner(conn) {
  const [rows] = await conn.execute("SELECT * FROM business_owners LIMIT 1");
  return rows[0];
}

async function fetchFullData(ownerId) {
  const input = encodeURIComponent(JSON.stringify({ "0": { json: { id: ownerId } } }));
  const res = await fetch(`${API}/api/trpc/business.getFullData?batch=1&input=${input}`);
  const json = await res.json();
  return json[0]?.result?.data?.json;
}

async function run() {
  console.log("\n=== DB → App Data Sync Validation ===\n");

  const conn = await mysql.createConnection(DB_URL);

  try {
    // Get the business owner
    const owner = await getBusinessOwner(conn);
    if (!owner) {
      console.error("No business owner found in DB");
      process.exit(1);
    }
    console.log(`Business owner: ${owner.business_name} (id=${owner.id})\n`);

    // Fetch full data via tRPC
    const fullData = await fetchFullData(owner.id);
    if (!fullData) {
      console.error("getFullData returned null/undefined");
      process.exit(1);
    }

    // ─── Check top-level fields ───────────────────────────────────────────
    console.log("1. Top-level fields in getFullData response:");
    check("owner field present", !!fullData.owner);
    check("services field present", Array.isArray(fullData.services));
    check("clients field present", Array.isArray(fullData.clients));
    check("appointments field present", Array.isArray(fullData.appointments));
    check("reviews field present", Array.isArray(fullData.reviews));
    check("discounts field present", Array.isArray(fullData.discounts), `got: ${typeof fullData.discounts}`);
    check("giftCards field present", Array.isArray(fullData.giftCards), `got: ${typeof fullData.giftCards}`);
    check("locations field present", Array.isArray(fullData.locations), `got: ${typeof fullData.locations}`);
    check("products field present", Array.isArray(fullData.products), `got: ${typeof fullData.products}`);
    check("staff field present", Array.isArray(fullData.staff), `got: ${typeof fullData.staff}`);
    check("customSchedule field present", Array.isArray(fullData.customSchedule), `got: ${typeof fullData.customSchedule}`);

    // ─── Check counts match DB ────────────────────────────────────────────
    console.log("\n2. Counts match DB:");
    const [dbServices] = await conn.execute("SELECT COUNT(*) as n FROM services WHERE businessOwnerId = ?", [owner.id]);
    const [dbClients] = await conn.execute("SELECT COUNT(*) as n FROM clients WHERE businessOwnerId = ?", [owner.id]);
    const [dbDiscounts] = await conn.execute("SELECT COUNT(*) as n FROM discounts WHERE businessOwnerId = ?", [owner.id]);
    const [dbGiftCards] = await conn.execute("SELECT COUNT(*) as n FROM gift_cards WHERE businessOwnerId = ?", [owner.id]);
    const [dbLocations] = await conn.execute("SELECT COUNT(*) as n FROM locations WHERE businessOwnerId = ?", [owner.id]);
    const [dbProducts] = await conn.execute("SELECT COUNT(*) as n FROM products WHERE businessOwnerId = ?", [owner.id]);
    const [dbStaff] = await conn.execute("SELECT COUNT(*) as n FROM staff_members WHERE businessOwnerId = ?", [owner.id]);

    check(`services count: ${fullData.services.length} == DB ${dbServices[0].n}`, fullData.services.length === Number(dbServices[0].n));
    check(`clients count: ${fullData.clients.length} == DB ${dbClients[0].n}`, fullData.clients.length === Number(dbClients[0].n));
    check(`discounts count: ${fullData.discounts.length} == DB ${dbDiscounts[0].n}`, fullData.discounts.length === Number(dbDiscounts[0].n));
    check(`giftCards count: ${fullData.giftCards.length} == DB ${dbGiftCards[0].n}`, fullData.giftCards.length === Number(dbGiftCards[0].n));
    check(`locations count: ${fullData.locations.length} == DB ${dbLocations[0].n}`, fullData.locations.length === Number(dbLocations[0].n));
    check(`products count: ${fullData.products.length} == DB ${dbProducts[0].n}`, fullData.products.length === Number(dbProducts[0].n));
    check(`staff count: ${fullData.staff.length} == DB ${dbStaff[0].n}`, fullData.staff.length === Number(dbStaff[0].n));

    // ─── Check discount fields ────────────────────────────────────────────
    console.log("\n3. Discount field mapping:");
    if (fullData.discounts.length > 0) {
      const d = fullData.discounts[0];
      check("discount.localId present", !!d.localId);
      check("discount.name present", !!d.name);
      check("discount.percentage present", d.percentage != null);
      check("discount.active present", d.active != null);
      check("discount.serviceIds present", d.serviceIds !== undefined);
    } else {
      check("discounts exist in DB", false, "no discounts found");
    }

    // ─── Check gift card fields ───────────────────────────────────────────
    console.log("\n4. Gift card field mapping:");
    if (fullData.giftCards.length > 0) {
      const g = fullData.giftCards[0];
      check("giftCard.localId present", !!g.localId);
      check("giftCard.code present", !!g.code);
      check("giftCard.message present", g.message != null);
      check("giftCard.redeemed present", g.redeemed != null);
      // Check GIFT_DATA block is in message
      const hasGiftData = (g.message || "").includes("---GIFT_DATA---");
      check("giftCard.message contains GIFT_DATA block", hasGiftData, `message: ${(g.message || "").slice(0, 80)}`);
    } else {
      check("giftCards exist in DB", false, "no gift cards found");
    }

    // ─── Check location fields ────────────────────────────────────────────
    console.log("\n5. Location field mapping:");
    if (fullData.locations.length > 0) {
      const l = fullData.locations[0];
      check("location.localId present", !!l.localId);
      check("location.name present", !!l.name);
      check("location.active present", l.active != null);
      check("location.isDefault present", l.isDefault != null);
      const activeCount = fullData.locations.filter(loc => loc.active).length;
      check(`all locations active (${activeCount}/${fullData.locations.length})`, activeCount === fullData.locations.length, `${activeCount} active of ${fullData.locations.length}`);
    } else {
      check("locations exist in DB", false, "no locations found");
    }

    // ─── Check product fields ─────────────────────────────────────────────
    console.log("\n6. Product field mapping:");
    if (fullData.products.length > 0) {
      const p = fullData.products[0];
      check("product.localId present", !!p.localId);
      check("product.name present", !!p.name);
      check("product.price present", p.price != null);
      check("product.brand present", p.brand !== undefined);
    } else {
      check("products exist in DB", false, "no products found");
    }

    // ─── Check staff fields ───────────────────────────────────────────────
    console.log("\n7. Staff field mapping:");
    if (fullData.staff.length > 0) {
      const s = fullData.staff[0];
      check("staff.localId present", !!s.localId);
      check("staff.name present", !!s.name);
      check("staff.active present", s.active != null);
      check("staff.locationIds present", s.locationIds !== undefined);
    } else {
      check("staff exist in DB", false, "no staff found");
    }

    // ─── Check service fields ─────────────────────────────────────────────
    console.log("\n8. Service field mapping (including category):");
    if (fullData.services.length > 0) {
      const s = fullData.services[0];
      check("service.localId present", !!s.localId);
      check("service.name present", !!s.name);
      check("service.category present", s.category !== undefined, `category=${s.category}`);
      check("service.locationIds present", s.locationIds !== undefined);
    } else {
      check("services exist in DB", false, "no services found");
    }

    // ─── Summary ──────────────────────────────────────────────────────────
    console.log(`\n${"─".repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed === 0) {
      console.log("✅ All data sync checks passed — DB→App data flow is correct");
    } else {
      console.log(`❌ ${failed} check(s) failed — data sync issues detected`);
    }

  } finally {
    await conn.end();
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
