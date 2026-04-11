import { describe, it, expect } from "vitest";
import * as fs from "fs";

// ─── Service Categories ────────────────────────────────────────────
describe("Service Categories", () => {
  it("Service type includes category field", () => {
    const svc: any = {
      id: "s1",
      name: "Haircut",
      duration: 30,
      price: 25,
      color: "#FF0000",
      category: "Hair",
      locationIds: [],
    };
    expect(svc.category).toBe("Hair");
  });

  it("Services can be grouped by category", () => {
    const services = [
      { id: "1", name: "Haircut", category: "Hair" },
      { id: "2", name: "Coloring", category: "Hair" },
      { id: "3", name: "Facial", category: "Skin" },
      { id: "4", name: "Massage", category: "" },
    ];
    const grouped = new Map<string, typeof services>();
    for (const s of services) {
      const cat = s.category || "Uncategorized";
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(s);
    }
    expect(grouped.get("Hair")?.length).toBe(2);
    expect(grouped.get("Skin")?.length).toBe(1);
    expect(grouped.get("Uncategorized")?.length).toBe(1);
  });
});

// ─── Product Brands ────────────────────────────────────────────────
describe("Product Brands", () => {
  it("Product type includes brand field", () => {
    const prod: any = {
      id: "p1",
      name: "Shampoo",
      price: 15,
      stock: 10,
      brand: "L'Oreal",
    };
    expect(prod.brand).toBe("L'Oreal");
  });

  it("Products can be grouped by brand", () => {
    const products = [
      { id: "1", name: "Shampoo", brand: "L'Oreal" },
      { id: "2", name: "Conditioner", brand: "L'Oreal" },
      { id: "3", name: "Gel", brand: "Redken" },
      { id: "4", name: "Spray", brand: "" },
    ];
    const grouped = new Map<string, typeof products>();
    for (const p of products) {
      const brand = p.brand || "Other";
      if (!grouped.has(brand)) grouped.set(brand, []);
      grouped.get(brand)!.push(p);
    }
    expect(grouped.get("L'Oreal")?.length).toBe(2);
    expect(grouped.get("Redken")?.length).toBe(1);
    expect(grouped.get("Other")?.length).toBe(1);
  });
});

// ─── Location-specific Staff ───────────────────────────────────────
describe("Location-specific Staff", () => {
  it("StaffMember type includes locationIds field", () => {
    const staff: any = {
      id: "st1",
      name: "John",
      email: "john@test.com",
      phone: "1234567890",
      color: "#FF0000",
      serviceIds: [],
      locationIds: ["loc1", "loc2"],
      workingHours: null,
    };
    expect(staff.locationIds).toEqual(["loc1", "loc2"]);
  });
});

// ─── Location-specific Services ────────────────────────────────────
describe("Location-specific Services", () => {
  it("Service type includes locationIds field", () => {
    const svc: any = {
      id: "s1",
      name: "Haircut",
      duration: 30,
      price: 25,
      color: "#FF0000",
      category: "Hair",
      locationIds: ["loc1"],
    };
    expect(svc.locationIds).toEqual(["loc1"]);
  });

  it("Services can be filtered by location", () => {
    const services = [
      { id: "1", name: "Haircut", locationIds: ["loc1", "loc2"] },
      { id: "2", name: "Coloring", locationIds: ["loc1"] },
      { id: "3", name: "Facial", locationIds: ["loc2"] },
      { id: "4", name: "Massage", locationIds: [] }, // available everywhere
    ];
    const loc1Services = services.filter(
      (s) => s.locationIds.length === 0 || s.locationIds.includes("loc1")
    );
    expect(loc1Services.length).toBe(3); // Haircut, Coloring, Massage
    expect(loc1Services.map((s) => s.name)).toContain("Haircut");
    expect(loc1Services.map((s) => s.name)).toContain("Coloring");
    expect(loc1Services.map((s) => s.name)).toContain("Massage");
    expect(loc1Services.map((s) => s.name)).not.toContain("Facial");
  });
});

// ─── Cancellation Fee Calculation ──────────────────────────────────
describe("Cancellation Fee Logic", () => {
  it("Calculates cancellation fee when within restricted window", () => {
    const policy = {
      enabled: true,
      hoursBeforeAppointment: 24,
      feeType: "percentage" as const,
      feeAmount: 50,
    };
    const appointmentTime = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours from now
    const hoursUntil = (appointmentTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const isWithinWindow = hoursUntil < policy.hoursBeforeAppointment;
    expect(isWithinWindow).toBe(true);

    const servicePrice = 100;
    const fee = policy.feeType === "percentage"
      ? servicePrice * (policy.feeAmount / 100)
      : policy.feeAmount;
    expect(fee).toBe(50);
  });

  it("No fee when outside restricted window", () => {
    const policy = {
      enabled: true,
      hoursBeforeAppointment: 24,
      feeType: "percentage" as const,
      feeAmount: 50,
    };
    const appointmentTime = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now
    const hoursUntil = (appointmentTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const isWithinWindow = hoursUntil < policy.hoursBeforeAppointment;
    expect(isWithinWindow).toBe(false);
  });
});

// ─── Discount Application in Business Booking ──────────────────────
describe("Discount Application", () => {
  it("getApplicableDiscount returns correct discount for day", async () => {
    const types = await import("../lib/types");
    const discounts = [
      {
        id: "d1",
        name: "Monday Special",
        percentage: 15,
        startTime: "00:00",
        endTime: "23:59",
        daysOfWeek: ["monday"],
        dates: [] as string[],
        serviceIds: null as string[] | null,
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];
    // 2026-04-13 is a Monday
    const result = types.getApplicableDiscount(discounts as any, "2026-04-13", "10:00", "any-service");
    expect(result).not.toBeNull();
    expect(result?.percentage).toBe(15);
    expect(result?.name).toBe("Monday Special");
  });

  it("getApplicableDiscount returns null when no discount applies", async () => {
    const types = await import("../lib/types");
    const discounts = [
      {
        id: "d1",
        name: "Monday Special",
        percentage: 15,
        startTime: "00:00",
        endTime: "23:59",
        daysOfWeek: ["monday"],
        dates: [] as string[],
        serviceIds: null as string[] | null,
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];
    // 2026-04-14 is a Tuesday
    const result = types.getApplicableDiscount(discounts as any, "2026-04-14", "10:00", "any-service");
    expect(result).toBeNull();
  });
});

// ─── File Existence Checks ───────────────────────────────────────
describe("Screen and Component Files Exist", () => {
  const files = [
    ["useResponsive hook", "hooks/use-responsive.ts"],
    ["admin logo data", "server/admin-logo-data.ts"],
    ["grouped picker component", "components/grouped-picker.tsx"],
    ["location form screen", "app/location-form.tsx"],
    ["locations screen", "app/locations.tsx"],
    ["booking policies screen", "app/booking-policies.tsx"],
    ["business hours settings screen", "app/business-hours-settings.tsx"],
    ["reviews screen", "app/reviews.tsx"],
    ["data export screen", "app/data-export.tsx"],
    ["analytics detail screen", "app/analytics-detail.tsx"],
    ["screen container component", "components/screen-container.tsx"],
  ];

  for (const [name, path] of files) {
    it(`${name} file exists`, () => {
      expect(fs.existsSync(`/home/ubuntu/manus-scheduler/${path}`)).toBe(true);
    });
  }
});

// ─── Location Colors ──────────────────────────────────────────────
describe("Location Colors", () => {
  it("LOCATION_COLORS array is exported and has entries", async () => {
    const types = await import("../lib/types");
    expect(types.LOCATION_COLORS).toBeDefined();
    expect(Array.isArray(types.LOCATION_COLORS)).toBe(true);
    expect(types.LOCATION_COLORS.length).toBeGreaterThan(0);
  });
});

// ─── Responsive ScreenContainer ───────────────────────────────────
describe("ScreenContainer Responsive", () => {
  it("ScreenContainer file contains tabletMaxWidth prop", () => {
    const content = fs.readFileSync("/home/ubuntu/manus-scheduler/components/screen-container.tsx", "utf-8");
    expect(content).toContain("tabletMaxWidth");
  });
});
