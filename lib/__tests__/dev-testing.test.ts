/**
 * Tests for dev-testing seed/cleanup logic.
 * We test the pure helper functions and seed-tag filtering logic
 * without needing to render the React component.
 */
import { describe, it, expect } from "vitest";

// ─── Replicate helpers from dev-testing.tsx ────────────────────────────────
const SEED_TAG = "__dev_seed__";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function padZ(n: number) { return String(n).padStart(2, "0"); }
function dateStr(d: Date) {
  return `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}`;
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randDate(from: Date, to: Date): Date {
  const ms = from.getTime() + Math.random() * (to.getTime() - from.getTime());
  return new Date(ms);
}
function randTime() {
  const h = randInt(8, 19);
  const m = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
  return `${padZ(h)}:${padZ(m)}`;
}

// ─── Tests ─────────────────────────────────────────────────────────────────
describe("Dev Testing – seed tag helpers", () => {
  it("uid() generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, uid));
    expect(ids.size).toBe(100);
  });

  it("dateStr() formats dates correctly", () => {
    expect(dateStr(new Date("2025-01-05T12:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("randDate() returns a date within the range", () => {
    const from = new Date("2024-01-01");
    const to = new Date("2024-12-31");
    for (let i = 0; i < 20; i++) {
      const d = randDate(from, to);
      expect(d.getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(d.getTime()).toBeLessThanOrEqual(to.getTime());
    }
  });

  it("randTime() returns HH:MM format", () => {
    for (let i = 0; i < 20; i++) {
      const t = randTime();
      expect(t).toMatch(/^\d{2}:\d{2}$/);
      const [h, m] = t.split(":").map(Number);
      expect(h).toBeGreaterThanOrEqual(8);
      expect(h).toBeLessThanOrEqual(19);
      expect([0, 15, 30, 45]).toContain(m);
    }
  });
});

describe("Dev Testing – seed tag filtering", () => {
  const seedClient = { id: "c1", name: "Test User", phone: "+13051234567", email: "t@t.com", notes: `Test ${SEED_TAG}`, birthday: "", createdAt: new Date().toISOString() };
  const realClient = { id: "c2", name: "Real User", phone: "+13059999999", email: "r@r.com", notes: "Real client notes", birthday: "", createdAt: new Date().toISOString() };

  it("correctly identifies seeded clients by SEED_TAG in notes", () => {
    const clients = [seedClient, realClient];
    const seeded = clients.filter((c) => c.notes?.includes(SEED_TAG));
    expect(seeded).toHaveLength(1);
    expect(seeded[0].id).toBe("c1");
  });

  it("does not include real clients in seeded list", () => {
    const clients = [seedClient, realClient];
    const seeded = clients.filter((c) => c.notes?.includes(SEED_TAG));
    expect(seeded.map((c) => c.id)).not.toContain("c2");
  });

  it("correctly identifies seeded reviews by SEED_TAG in comment", () => {
    const reviews = [
      { id: "r1", clientId: "c1", rating: 5, comment: `Great! ${SEED_TAG}`, createdAt: "" },
      { id: "r2", clientId: "c2", rating: 4, comment: "Loved it", createdAt: "" },
    ];
    const seeded = reviews.filter((r) => r.comment?.includes(SEED_TAG));
    expect(seeded).toHaveLength(1);
    expect(seeded[0].id).toBe("r1");
  });

  it("correctly identifies seeded promo codes by SEED_TAG in label", () => {
    const promos = [
      { id: "p1", code: "SAVE10", label: `Test Promo ${SEED_TAG}`, percentage: 10, usedCount: 0, active: true, createdAt: "" },
      { id: "p2", code: "VIP20", label: "VIP Discount", percentage: 20, usedCount: 0, active: true, createdAt: "" },
    ];
    const seeded = promos.filter((p) => p.label?.includes(SEED_TAG));
    expect(seeded).toHaveLength(1);
    expect(seeded[0].id).toBe("p1");
  });

  it("correctly identifies seeded gift cards by SEED_TAG in message", () => {
    const gifts = [
      { id: "g1", code: "GIFT1234", message: `Happy Birthday! ${SEED_TAG}`, originalValue: 50, remainingBalance: 50, redeemed: false, createdAt: "", serviceLocalId: "s1", recipientName: "Alice", recipientPhone: "+1" },
      { id: "g2", code: "GIFT5678", message: "Real gift", originalValue: 100, remainingBalance: 100, redeemed: false, createdAt: "", serviceLocalId: "s1", recipientName: "Bob", recipientPhone: "+1" },
    ];
    const seeded = gifts.filter((g) => g.message?.includes(SEED_TAG));
    expect(seeded).toHaveLength(1);
    expect(seeded[0].id).toBe("g1");
  });

  it("correctly identifies seeded discounts by SEED_TAG in name", () => {
    const discounts = [
      { id: "d1", name: `Happy Hour ${SEED_TAG}`, percentage: 15, startTime: "09:00", endTime: "17:00", daysOfWeek: [], dates: [], serviceIds: null, active: true, createdAt: "" },
      { id: "d2", name: "Weekend Special", percentage: 20, startTime: "09:00", endTime: "17:00", daysOfWeek: [], dates: [], serviceIds: null, active: true, createdAt: "" },
    ];
    const seeded = discounts.filter((d) => d.name?.includes(SEED_TAG));
    expect(seeded).toHaveLength(1);
    expect(seeded[0].id).toBe("d1");
  });

  it("correctly identifies seeded locations by SEED_TAG in name", () => {
    const locations = [
      { id: "l1", name: `Downtown Branch ${SEED_TAG}`, address: "123 Main St", phone: "+1", email: "l@l.com", isDefault: false, active: true, workingHours: null, createdAt: "" },
      { id: "l2", name: "Real Location", address: "456 Oak Ave", phone: "+1", email: "r@r.com", isDefault: true, active: true, workingHours: null, createdAt: "" },
    ];
    const seeded = locations.filter((l) => l.name?.includes(SEED_TAG));
    expect(seeded).toHaveLength(1);
    expect(seeded[0].id).toBe("l1");
  });

  it("totalSeedItems counts all seeded items correctly", () => {
    const seedClients = [seedClient];
    const seedAppointments = [{ id: "a1", notes: `${SEED_TAG}` }];
    const seedReviews = [{ id: "r1", comment: `${SEED_TAG}` }];
    const seedPromos = [{ id: "p1", label: `${SEED_TAG}` }];
    const seedGifts = [{ id: "g1", message: `${SEED_TAG}` }, { id: "g2", message: `${SEED_TAG}` }];
    const seedDiscounts: unknown[] = [];
    const seedLocations: unknown[] = [];

    const total =
      seedClients.length +
      seedAppointments.length +
      seedReviews.length +
      seedPromos.length +
      seedGifts.length +
      seedDiscounts.length +
      seedLocations.length;

    expect(total).toBe(6);
  });
});

describe("Dev Testing – phone gate", () => {
  const DEV_ADMIN_PHONE = "+13059999999";

  it("allows access with correct phone", () => {
    const input = "+13059999999";
    expect(input.replace(/\s/g, "") === DEV_ADMIN_PHONE).toBe(true);
  });

  it("denies access with wrong phone", () => {
    const input = "+13051234567";
    expect(input.replace(/\s/g, "") === DEV_ADMIN_PHONE).toBe(false);
  });

  it("strips spaces before comparison", () => {
    const input = "+1 305 999 9999";
    expect(input.replace(/\s/g, "") === DEV_ADMIN_PHONE).toBe(true);
  });
});
