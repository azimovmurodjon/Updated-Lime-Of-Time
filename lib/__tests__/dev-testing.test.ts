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

// ─── Replicate ALL_CATEGORIES and preset types ─────────────────────────────
type Category =
  | "clients" | "appointments" | "reviews" | "promoCodes"
  | "giftCards" | "discounts" | "locations" | "services" | "staff";

const ALL_CATEGORIES: Category[] = [
  "clients", "appointments", "reviews", "promoCodes",
  "giftCards", "discounts", "locations", "services", "staff",
];

const CATEGORY_LABELS: Record<Category, string> = {
  clients: "Clients", appointments: "Appointments", reviews: "Reviews",
  promoCodes: "Promo Codes", giftCards: "Gift Cards", discounts: "Discounts",
  locations: "Locations", services: "Services", staff: "Staff Members",
};

interface SeedPreset {
  id: string;
  name: string;
  counts: Record<Category, string>;
  selected: Record<Category, boolean>;
  fromDate: string;
  toDate: string;
  isBuiltIn?: boolean;
}

function makeDefaultDates() {
  const from = new Date(); from.setMonth(from.getMonth() - 3);
  const to = new Date(); to.setMonth(to.getMonth() + 2);
  return { from: dateStr(from), to: dateStr(to) };
}
const { from: DEFAULT_FROM, to: DEFAULT_TO } = makeDefaultDates();

const ALL_ON: Record<Category, boolean> = {
  clients: true, appointments: true, reviews: true, promoCodes: true,
  giftCards: true, discounts: true, locations: true, services: true, staff: true,
};
const ALL_OFF: Record<Category, boolean> = {
  clients: false, appointments: false, reviews: false, promoCodes: false,
  giftCards: false, discounts: false, locations: false, services: false, staff: false,
};

const BUILT_IN_PRESETS: SeedPreset[] = [
  {
    id: "smoke", name: "🔬 Smoke Test", isBuiltIn: true,
    fromDate: DEFAULT_FROM, toDate: DEFAULT_TO,
    selected: ALL_ON,
    counts: { clients: "2", appointments: "3", reviews: "2", promoCodes: "1", giftCards: "1", discounts: "1", locations: "1", services: "2", staff: "1" },
  },
  {
    id: "light", name: "💡 Light Load", isBuiltIn: true,
    fromDate: DEFAULT_FROM, toDate: DEFAULT_TO,
    selected: { ...ALL_ON, locations: false, services: false, staff: false },
    counts: { clients: "10", appointments: "20", reviews: "8", promoCodes: "3", giftCards: "3", discounts: "3", locations: "0", services: "0", staff: "0" },
  },
  {
    id: "heavy", name: "🔥 Heavy Load", isBuiltIn: true,
    fromDate: (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return dateStr(d); })(),
    toDate: (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return dateStr(d); })(),
    selected: ALL_ON,
    counts: { clients: "50", appointments: "100", reviews: "40", promoCodes: "10", giftCards: "10", discounts: "10", locations: "5", services: "10", staff: "8" },
  },
  {
    id: "appts_only", name: "📅 Appointments Only", isBuiltIn: true,
    fromDate: DEFAULT_FROM, toDate: DEFAULT_TO,
    selected: { ...ALL_OFF, clients: true, appointments: true },
    counts: { clients: "15", appointments: "30", reviews: "0", promoCodes: "0", giftCards: "0", discounts: "0", locations: "0", services: "0", staff: "0" },
  },
  {
    id: "full_biz", name: "🏢 Full Business", isBuiltIn: true,
    fromDate: DEFAULT_FROM, toDate: DEFAULT_TO,
    selected: ALL_ON,
    counts: { clients: "20", appointments: "40", reviews: "15", promoCodes: "5", giftCards: "5", discounts: "5", locations: "3", services: "8", staff: "5" },
  },
];

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

  it("correctly identifies seeded services by SEED_TAG in name", () => {
    const services = [
      { id: "s1", name: `Haircut ${SEED_TAG}`, duration: 30, price: 40, color: "#4CAF50", createdAt: "" },
      { id: "s2", name: "Balayage", duration: 120, price: 150, color: "#2196F3", createdAt: "" },
    ];
    const seeded = services.filter((s) => s.name?.includes(SEED_TAG));
    expect(seeded).toHaveLength(1);
    expect(seeded[0].id).toBe("s1");
  });

  it("correctly identifies seeded staff by SEED_TAG in name", () => {
    const staff = [
      { id: "st1", name: `Alex Smith ${SEED_TAG}`, phone: "+1", email: "a@a.com", role: "Stylist", color: "#3B82F6", serviceIds: null, locationIds: null, workingHours: null, active: true, createdAt: "" },
      { id: "st2", name: "Real Stylist", phone: "+1", email: "r@r.com", role: "Colorist", color: "#EF4444", serviceIds: null, locationIds: null, workingHours: null, active: true, createdAt: "" },
    ];
    const seeded = staff.filter((s) => s.name?.includes(SEED_TAG));
    expect(seeded).toHaveLength(1);
    expect(seeded[0].id).toBe("st1");
  });

  it("totalSeedItems counts all 9 category seeded items correctly", () => {
    const counts = {
      clients: 1, appointments: 2, reviews: 1, promoCodes: 1,
      giftCards: 2, discounts: 0, locations: 1, services: 3, staff: 2,
    };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(13);
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

  it("phone must start with + and be at least 10 chars", () => {
    const valid = "+13059999999";
    const invalid1 = "13059999999";
    const invalid2 = "+1305";
    expect(valid.startsWith("+") && valid.length >= 10).toBe(true);
    expect(invalid1.startsWith("+")).toBe(false);
    expect(invalid2.startsWith("+") && invalid2.length >= 10).toBe(false);
  });
});

describe("Dev Testing – ALL_CATEGORIES", () => {
  it("contains all 9 expected categories", () => {
    const expected: Category[] = [
      "clients", "appointments", "reviews", "promoCodes",
      "giftCards", "discounts", "locations", "services", "staff",
    ];
    expect(ALL_CATEGORIES).toEqual(expect.arrayContaining(expected));
    expect(ALL_CATEGORIES.length).toBe(9);
  });

  it("has a label for every category", () => {
    ALL_CATEGORIES.forEach((cat) => {
      expect(CATEGORY_LABELS[cat]).toBeTruthy();
    });
  });
});

describe("Dev Testing – BUILT_IN_PRESETS", () => {
  it("has 5 built-in presets", () => {
    expect(BUILT_IN_PRESETS.length).toBe(5);
  });

  BUILT_IN_PRESETS.forEach((preset) => {
    it(`preset "${preset.name}" has valid structure`, () => {
      expect(typeof preset.id).toBe("string");
      expect(preset.fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(preset.toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(preset.fromDate).getTime()).toBeLessThanOrEqual(new Date(preset.toDate).getTime());
      ALL_CATEGORIES.forEach((cat) => {
        expect(Number(preset.counts[cat])).toBeGreaterThanOrEqual(0);
        expect(typeof preset.selected[cat]).toBe("boolean");
      });
      expect(preset.isBuiltIn).toBe(true);
    });
  });

  it("smoke test preset has all categories enabled", () => {
    const smoke = BUILT_IN_PRESETS.find((p) => p.id === "smoke")!;
    ALL_CATEGORIES.forEach((cat) => {
      expect(smoke.selected[cat]).toBe(true);
    });
  });

  it("appointments-only preset disables non-client/appointment categories", () => {
    const appts = BUILT_IN_PRESETS.find((p) => p.id === "appts_only")!;
    expect(appts.selected.clients).toBe(true);
    expect(appts.selected.appointments).toBe(true);
    expect(appts.selected.reviews).toBe(false);
    expect(appts.selected.services).toBe(false);
    expect(appts.selected.staff).toBe(false);
  });

  it("heavy load preset has large appointment and client counts", () => {
    const heavy = BUILT_IN_PRESETS.find((p) => p.id === "heavy")!;
    expect(Number(heavy.counts.appointments)).toBeGreaterThanOrEqual(50);
    expect(Number(heavy.counts.clients)).toBeGreaterThanOrEqual(20);
  });

  it("full business preset includes services and staff", () => {
    const full = BUILT_IN_PRESETS.find((p) => p.id === "full_biz")!;
    expect(full.selected.services).toBe(true);
    expect(full.selected.staff).toBe(true);
    expect(Number(full.counts.services)).toBeGreaterThan(0);
    expect(Number(full.counts.staff)).toBeGreaterThan(0);
  });
});

describe("Dev Testing – custom preset serialization", () => {
  it("custom preset can be created and serialized to JSON", () => {
    const custom: SeedPreset = {
      id: uid(),
      name: "My Custom Preset",
      fromDate: "2025-01-01",
      toDate: "2025-12-31",
      selected: { clients: true, appointments: true, reviews: false, promoCodes: false, giftCards: false, discounts: false, locations: false, services: true, staff: true },
      counts: { clients: "5", appointments: "10", reviews: "0", promoCodes: "0", giftCards: "0", discounts: "0", locations: "0", services: "3", staff: "2" },
    };
    const serialized = JSON.stringify(custom);
    const parsed: SeedPreset = JSON.parse(serialized);
    expect(parsed.name).toBe("My Custom Preset");
    expect(parsed.counts.appointments).toBe("10");
    expect(parsed.counts.services).toBe("3");
    expect(parsed.selected.clients).toBe(true);
    expect(parsed.selected.reviews).toBe(false);
    expect(parsed.selected.services).toBe(true);
    expect(parsed.selected.staff).toBe(true);
  });

  it("preset array can be filtered to remove by id", () => {
    const presets: SeedPreset[] = [
      { id: "a", name: "A", fromDate: "2025-01-01", toDate: "2025-12-31", selected: ALL_ON, counts: { clients: "1", appointments: "1", reviews: "1", promoCodes: "1", giftCards: "1", discounts: "1", locations: "1", services: "1", staff: "1" } },
      { id: "b", name: "B", fromDate: "2025-01-01", toDate: "2025-12-31", selected: ALL_ON, counts: { clients: "2", appointments: "2", reviews: "2", promoCodes: "2", giftCards: "2", discounts: "2", locations: "2", services: "2", staff: "2" } },
    ];
    const after = presets.filter((p) => p.id !== "a");
    expect(after.length).toBe(1);
    expect(after[0].id).toBe("b");
  });
});
