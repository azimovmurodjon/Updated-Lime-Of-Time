/**
 * Seed script: creates 2 test business accounts with full data
 * Run: npx tsx scripts/seed-test-businesses.ts
 *
 * Business 1: phone 4124827733 — "Glow Beauty Studio"
 * Business 2: phone 4124822976 — "Zen Wellness Spa"
 */
import "../scripts/load-env.js";
import {
  createBusinessOwner,
  createLocation,
  createStaffMember,
  createService,
  createProduct,
  createPromoCode,
  createGiftCard,
  createDiscount,
  getBusinessOwnerByPhone,
  deleteBusinessOwner,
} from "../server/db";

// ─── Helpers ────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const DEFAULT_HOURS = {
  monday:    { enabled: true,  start: "09:00", end: "18:00" },
  tuesday:   { enabled: true,  start: "09:00", end: "18:00" },
  wednesday: { enabled: true,  start: "09:00", end: "18:00" },
  thursday:  { enabled: true,  start: "09:00", end: "18:00" },
  friday:    { enabled: true,  start: "09:00", end: "18:00" },
  saturday:  { enabled: true,  start: "10:00", end: "16:00" },
  sunday:    { enabled: false, start: "10:00", end: "14:00" },
};

const EVENING_HOURS = {
  monday:    { enabled: true,  start: "12:00", end: "20:00" },
  tuesday:   { enabled: true,  start: "12:00", end: "20:00" },
  wednesday: { enabled: true,  start: "12:00", end: "20:00" },
  thursday:  { enabled: true,  start: "12:00", end: "20:00" },
  friday:    { enabled: true,  start: "12:00", end: "20:00" },
  saturday:  { enabled: true,  start: "10:00", end: "18:00" },
  sunday:    { enabled: false, start: "10:00", end: "14:00" },
};

// ─── Business 1: Glow Beauty Studio ─────────────────────────────────────────

async function seedBusiness1() {
  const phone = "4124827733";

  // Clean up existing account if any
  const existing = await getBusinessOwnerByPhone(phone);
  if (existing) {
    console.log(`  Deleting existing account for ${phone} (id=${existing.id})`);
    await deleteBusinessOwner(existing.id);
  }

  // Create business owner
  const ownerId = await createBusinessOwner({
    phone,
    businessName: "Glow Beauty Studio",
    businessCategory: "Hair",
    businessSlug: `glow-beauty-studio-${uid()}`,
    subscriptionPlan: "growth",
    subscriptionStatus: "active",
    onboardingComplete: true,
    clientPortalVisible: true,
    lat: "40.4406",
    lng: "-79.9959",
    zelleHandle: "glowbeauty@zelle.com",
    cashAppHandle: "$GlowBeauty",
  });
  console.log(`  Created business owner id=${ownerId} (Glow Beauty Studio)`);

  // Locations
  const loc1Id = uid();
  await createLocation({
    businessOwnerId: ownerId,
    localId: loc1Id,
    name: "Downtown Studio",
    address: "123 Penn Ave",
    city: "Pittsburgh",
    state: "PA",
    zipCode: "15222",
    phone: "4124827733",
    email: "downtown@glowbeauty.com",
    isDefault: true,
    active: true,
    workingHours: DEFAULT_HOURS,
    lat: "40.4406",
    lng: "-79.9959",
  });
  console.log(`  Created location: Downtown Studio`);

  const loc2Id = uid();
  await createLocation({
    businessOwnerId: ownerId,
    localId: loc2Id,
    name: "Shadyside Branch",
    address: "456 Walnut St",
    city: "Pittsburgh",
    state: "PA",
    zipCode: "15232",
    phone: "4124827744",
    email: "shadyside@glowbeauty.com",
    isDefault: false,
    active: true,
    workingHours: EVENING_HOURS,
    lat: "40.4530",
    lng: "-79.9300",
  });
  console.log(`  Created location: Shadyside Branch`);

  // Services (5)
  const svc1Id = uid();
  await createService({ businessOwnerId: ownerId, localId: svc1Id, name: "Haircut & Style", duration: 60, price: "65.00", color: "#FF6B9D", description: "Full haircut with blow-dry and style", category: "Hair" });
  const svc2Id = uid();
  await createService({ businessOwnerId: ownerId, localId: svc2Id, name: "Color Treatment", duration: 120, price: "120.00", color: "#C084FC", description: "Single-process color with toner", category: "Hair" });
  const svc3Id = uid();
  await createService({ businessOwnerId: ownerId, localId: svc3Id, name: "Highlights", duration: 150, price: "180.00", color: "#FCD34D", description: "Full or partial highlights", category: "Hair" });
  const svc4Id = uid();
  await createService({ businessOwnerId: ownerId, localId: svc4Id, name: "Keratin Treatment", duration: 180, price: "250.00", color: "#6EE7B7", description: "Smoothing keratin treatment", category: "Hair" });
  const svc5Id = uid();
  await createService({ businessOwnerId: ownerId, localId: svc5Id, name: "Scalp Treatment", duration: 45, price: "55.00", color: "#93C5FD", description: "Deep scalp massage and nourishing treatment", category: "Hair" });
  console.log(`  Created 5 services`);

  // Staff (1)
  const staffId = uid();
  await createStaffMember({
    businessOwnerId: ownerId,
    localId: staffId,
    name: "Jessica Martinez",
    phone: "4125550101",
    email: "jessica@glowbeauty.com",
    role: "Senior Stylist",
    color: "#FF6B9D",
    serviceIds: [svc1Id, svc2Id, svc3Id, svc4Id, svc5Id],
    locationIds: [loc1Id, loc2Id],
    workingHours: DEFAULT_HOURS,
    active: true,
    commissionRate: 40,
  });
  console.log(`  Created staff: Jessica Martinez`);

  // Products (2)
  await createProduct({ businessOwnerId: ownerId, localId: uid(), name: "Argan Oil Shampoo", price: "28.00", description: "Sulfate-free argan oil shampoo for color-treated hair", brand: "GlowCare", available: true });
  await createProduct({ businessOwnerId: ownerId, localId: uid(), name: "Hydrating Hair Mask", price: "35.00", description: "Deep conditioning mask for dry or damaged hair", brand: "GlowCare", available: true });
  console.log(`  Created 2 products`);

  // Promo Code
  await createPromoCode({ businessOwnerId: ownerId, localId: uid(), code: "GLOW20", label: "New Client 20% Off", percentage: 20, maxUses: 50, active: true });
  console.log(`  Created promo code: GLOW20`);

  // Gift Card
  await createGiftCard({ businessOwnerId: ownerId, localId: uid(), code: "GIFT-GLOW-001", serviceLocalId: svc1Id, recipientName: "Sarah Johnson", recipientPhone: "4125559999", message: "Enjoy your haircut!", redeemed: false, expiresAt: "2026-12-31" });
  console.log(`  Created gift card: GIFT-GLOW-001`);

  // Discount
  await createDiscount({ businessOwnerId: ownerId, localId: uid(), name: "Weekend Special", percentage: 15, startTime: "09:00", endTime: "18:00", serviceIds: [svc1Id, svc2Id], dates: ["2026-04-26", "2026-04-27", "2026-05-03", "2026-05-04"], active: true });
  console.log(`  Created discount: Weekend Special`);

  console.log(`✅ Business 1 (Glow Beauty Studio) seeded successfully\n`);
}

// ─── Business 2: Zen Wellness Spa ────────────────────────────────────────────

async function seedBusiness2() {
  const phone = "4124822976";

  // Clean up existing account if any
  const existing = await getBusinessOwnerByPhone(phone);
  if (existing) {
    console.log(`  Deleting existing account for ${phone} (id=${existing.id})`);
    await deleteBusinessOwner(existing.id);
  }

  // Create business owner
  const ownerId = await createBusinessOwner({
    phone,
    businessName: "Zen Wellness Spa",
    businessCategory: "Massage",
    businessSlug: `zen-wellness-spa-${uid()}`,
    subscriptionPlan: "growth",
    subscriptionStatus: "active",
    onboardingComplete: true,
    clientPortalVisible: true,
    lat: "40.4500",
    lng: "-80.0100",
    zelleHandle: "zenwellness@zelle.com",
    venmoHandle: "@ZenWellnessSpa",
  });
  console.log(`  Created business owner id=${ownerId} (Zen Wellness Spa)`);

  // Locations
  const loc1Id = uid();
  await createLocation({
    businessOwnerId: ownerId,
    localId: loc1Id,
    name: "Strip District",
    address: "789 Smallman St",
    city: "Pittsburgh",
    state: "PA",
    zipCode: "15222",
    phone: "4124822976",
    email: "strip@zenwellness.com",
    isDefault: true,
    active: true,
    workingHours: DEFAULT_HOURS,
    lat: "40.4500",
    lng: "-79.9850",
  });
  console.log(`  Created location: Strip District`);

  const loc2Id = uid();
  await createLocation({
    businessOwnerId: ownerId,
    localId: loc2Id,
    name: "South Side Spa",
    address: "321 East Carson St",
    city: "Pittsburgh",
    state: "PA",
    zipCode: "15203",
    phone: "4124822977",
    email: "southside@zenwellness.com",
    isDefault: false,
    active: true,
    workingHours: EVENING_HOURS,
    lat: "40.4280",
    lng: "-79.9760",
  });
  console.log(`  Created location: South Side Spa`);

  // Services (5)
  const svc1Id = uid();
  await createService({ businessOwnerId: ownerId, localId: svc1Id, name: "Swedish Massage", duration: 60, price: "90.00", color: "#4ECDC4", description: "Relaxing full-body Swedish massage", category: "Massage" });
  const svc2Id = uid();
  await createService({ businessOwnerId: ownerId, localId: svc2Id, name: "Deep Tissue Massage", duration: 90, price: "130.00", color: "#60A5FA", description: "Therapeutic deep tissue work for muscle tension", category: "Massage" });
  const svc3Id = uid();
  await createService({ businessOwnerId: ownerId, localId: svc3Id, name: "Hot Stone Massage", duration: 90, price: "150.00", color: "#F97316", description: "Heated basalt stones for deep relaxation", category: "Massage" });
  const svc4Id = uid();
  await createService({ businessOwnerId: ownerId, localId: svc4Id, name: "Facial Treatment", duration: 75, price: "110.00", color: "#F9A8D4", description: "Customized facial with cleanse, exfoliate, and mask", category: "Skin" });
  const svc5Id = uid();
  await createService({ businessOwnerId: ownerId, localId: svc5Id, name: "Couples Massage", duration: 60, price: "180.00", color: "#A78BFA", description: "Side-by-side massage for two in private suite", category: "Massage" });
  console.log(`  Created 5 services`);

  // Staff (1)
  const staffId = uid();
  await createStaffMember({
    businessOwnerId: ownerId,
    localId: staffId,
    name: "David Chen",
    phone: "4125550202",
    email: "david@zenwellness.com",
    role: "Lead Therapist",
    color: "#4ECDC4",
    serviceIds: [svc1Id, svc2Id, svc3Id, svc4Id, svc5Id],
    locationIds: [loc1Id, loc2Id],
    workingHours: DEFAULT_HOURS,
    active: true,
    commissionRate: 45,
  });
  console.log(`  Created staff: David Chen`);

  // Products (2)
  await createProduct({ businessOwnerId: ownerId, localId: uid(), name: "Lavender Body Oil", price: "42.00", description: "Pure lavender essential oil blend for post-massage relaxation", brand: "ZenEssentials", available: true });
  await createProduct({ businessOwnerId: ownerId, localId: uid(), name: "Muscle Relief Balm", price: "38.00", description: "Cooling menthol balm for sore muscles", brand: "ZenEssentials", available: true });
  console.log(`  Created 2 products`);

  // Promo Code
  await createPromoCode({ businessOwnerId: ownerId, localId: uid(), code: "ZEN15", label: "First Visit 15% Off", percentage: 15, maxUses: 100, active: true });
  console.log(`  Created promo code: ZEN15`);

  // Gift Card
  await createGiftCard({ businessOwnerId: ownerId, localId: uid(), code: "GIFT-ZEN-001", serviceLocalId: svc1Id, recipientName: "Michael Brown", recipientPhone: "4125558888", message: "Relax and enjoy!", redeemed: false, expiresAt: "2026-12-31" });
  console.log(`  Created gift card: GIFT-ZEN-001`);

  // Discount
  await createDiscount({ businessOwnerId: ownerId, localId: uid(), name: "Monday Zen Deal", percentage: 10, startTime: "12:00", endTime: "20:00", serviceIds: [svc1Id, svc2Id, svc3Id], dates: ["2026-04-28", "2026-05-05", "2026-05-12", "2026-05-19"], active: true });
  console.log(`  Created discount: Monday Zen Deal`);

  console.log(`✅ Business 2 (Zen Wellness Spa) seeded successfully\n`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding test businesses...\n");
  try {
    console.log("--- Business 1: Glow Beauty Studio (4124827733) ---");
    await seedBusiness1();
    console.log("--- Business 2: Zen Wellness Spa (4124822976) ---");
    await seedBusiness2();
    console.log("🎉 All done! Both businesses seeded successfully.");
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
  process.exit(0);
}

main();
