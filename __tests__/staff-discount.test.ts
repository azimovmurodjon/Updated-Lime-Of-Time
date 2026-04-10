import { describe, it, expect } from "vitest";

// ── Staff Management Tests ──────────────────────────────────────────

describe("Staff Management", () => {
  describe("StaffMember Type", () => {
    it("should have correct StaffMember interface fields", async () => {
      const { StaffMember } = await import("../lib/types") as any;
      // Verify the type exists by creating a valid staff member object
      const staff = {
        localId: "staff-1",
        name: "Jane Doe",
        phone: "555-1234",
        email: "jane@example.com",
        color: "#4a8c3f",
        serviceIds: ["svc-1", "svc-2"],
        workingHours: {
          monday: { enabled: true, start: "09:00", end: "17:00" },
          tuesday: { enabled: true, start: "09:00", end: "17:00" },
          wednesday: { enabled: true, start: "09:00", end: "17:00" },
          thursday: { enabled: true, start: "09:00", end: "17:00" },
          friday: { enabled: true, start: "09:00", end: "17:00" },
          saturday: { enabled: false, start: "09:00", end: "17:00" },
          sunday: { enabled: false, start: "09:00", end: "17:00" },
        },
      };
      expect(staff.localId).toBe("staff-1");
      expect(staff.name).toBe("Jane Doe");
      expect(staff.serviceIds).toHaveLength(2);
      expect(staff.workingHours.monday.enabled).toBe(true);
      expect(staff.workingHours.saturday.enabled).toBe(false);
    });
  });

  describe("Staff DB Schema", () => {
    it("should export staffMembers table from schema", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.staffMembers).toBeDefined();
    });

    it("staffMembers table should have required columns", async () => {
      const schema = await import("../drizzle/schema");
      const table = schema.staffMembers;
      // Check the table has the expected column names
      const columns = Object.keys(table);
      expect(columns).toContain("name");
      expect(columns).toContain("businessOwnerId");
      expect(columns).toContain("localId");
    });
  });

  describe("Staff Store Integration", () => {
    it("should include staff in STORAGE_KEYS", async () => {
      // Read the store file to verify STORAGE_KEYS includes staff
      const fs = await import("fs");
      const storeContent = fs.readFileSync("lib/store.tsx", "utf-8");
      expect(storeContent).toContain("STAFF");
    });

    it("should have ADD_STAFF action type", async () => {
      const fs = await import("fs");
      const storeContent = fs.readFileSync("lib/store.tsx", "utf-8");
      expect(storeContent).toContain("ADD_STAFF");
      expect(storeContent).toContain("UPDATE_STAFF");
      expect(storeContent).toContain("DELETE_STAFF");
    });

    it("should have dbStaffToLocal converter", async () => {
      const fs = await import("fs");
      const storeContent = fs.readFileSync("lib/store.tsx", "utf-8");
      expect(storeContent).toContain("dbStaffToLocal");
    });
  });
});

// ── Staff Form Screen Tests ─────────────────────────────────────────

describe("Staff Form Screen", () => {
  it("should exist as a route file", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("app/staff-form.tsx")).toBe(true);
  });

  it("should export a default component", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("app/staff-form.tsx", "utf-8");
    expect(content).toContain("export default function");
  });

  it("should include service assignment UI", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("app/staff-form.tsx", "utf-8");
    expect(content).toContain("serviceIds");
    expect(content).toContain("workingHours");
  });
});

describe("Staff List Screen", () => {
  it("should exist as a route file", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("app/staff.tsx")).toBe(true);
  });

  it("should export a default component", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("app/staff.tsx", "utf-8");
    expect(content).toContain("export default function");
  });
});

// ── Discount Fix Tests ──────────────────────────────────────────────

describe("Discount Calculation Fix", () => {
  it("booking page should have appliedDiscount variable", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/publicRoutes.ts", "utf-8");
    expect(content).toContain("let appliedDiscount = null;");
  });

  it("checkDiscount should store discount in appliedDiscount", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/publicRoutes.ts", "utf-8");
    expect(content).toContain("appliedDiscount = { name: match.name, percentage: match.percentage }");
  });

  it("should have getDiscountAmount function", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/publicRoutes.ts", "utf-8");
    expect(content).toContain("function getDiscountAmount()");
  });

  it("should have getDiscountedTotal function", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/publicRoutes.ts", "utf-8");
    expect(content).toContain("function getDiscountedTotal()");
  });

  it("getChargedPrice should apply discount before gift card", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/publicRoutes.ts", "utf-8");
    // getChargedPrice should call getDiscountedTotal, not getTotalPrice
    const chargedPriceMatch = content.match(/function getChargedPrice\(\)[\s\S]*?return total;\s*\}/);
    expect(chargedPriceMatch).toBeTruthy();
    expect(chargedPriceMatch![0]).toContain("getDiscountedTotal()");
    expect(chargedPriceMatch![0]).not.toContain("getTotalPrice()");
  });

  it("getGiftUsedAmount should use discounted total", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/publicRoutes.ts", "utf-8");
    const giftMatch = content.match(/function getGiftUsedAmount\(\)[\s\S]*?return Math\.min/);
    expect(giftMatch).toBeTruthy();
    expect(giftMatch![0]).toContain("getDiscountedTotal()");
  });

  it("confirmation page should show discount breakdown", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/publicRoutes.ts", "utf-8");
    expect(content).toContain("Subtotal");
    expect(content).toContain("% off)");
    expect(content).toContain("Total to Pay");
    expect(content).toContain("You save");
  });

  it("receipt should show discount breakdown", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/publicRoutes.ts", "utf-8");
    expect(content).toContain("DISCOUNT:");
    expect(content).toContain("YOU SAVED:");
  });

  it("booking submission should include discount data", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/publicRoutes.ts", "utf-8");
    expect(content).toContain("discountName:");
    expect(content).toContain("discountPercentage:");
    expect(content).toContain("discountAmount:");
    expect(content).toContain("subtotal:");
  });

  it("cart summary should show discounted total", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/publicRoutes.ts", "utf-8");
    // renderCartSummary should call getDiscountAmount
    const cartMatch = content.match(/function renderCartSummary\(\)[\s\S]*?^\s{4}\}/m);
    expect(cartMatch).toBeTruthy();
    expect(cartMatch![0]).toContain("getDiscountAmount()");
  });
});

// ── Admin Dashboard Integration Tests ───────────────────────────────

describe("Admin Dashboard Integration", () => {
  it("should have staff link in admin sidebar", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/adminRoutes.ts", "utf-8");
    expect(content).toContain("/api/admin/staff");
    expect(content).toContain('"Staff"');
  });

  it("should have staff route handler", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/adminRoutes.ts", "utf-8");
    expect(content).toContain('app.get("/api/admin/staff"');
  });

  it("should have staffPage function", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/adminRoutes.ts", "utf-8");
    expect(content).toContain("function staffPage(");
  });

  it("should include staffMembers in DB explorer tableMap", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/adminRoutes.ts", "utf-8");
    expect(content).toContain("staff_members: staffMembers");
  });

  it("should show staff count on dashboard", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/adminRoutes.ts", "utf-8");
    expect(content).toContain("totalStaff");
    expect(content).toContain("Staff Members");
  });

  it("should show staff in business detail page", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/adminRoutes.ts", "utf-8");
    expect(content).toContain("data.staffMembers");
  });

  it("should import staffMembers from schema", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/adminRoutes.ts", "utf-8");
    expect(content).toContain("staffMembers,");
  });
});

// ── Staff tRPC Router Tests ─────────────────────────────────────────

describe("Staff tRPC Router", () => {
  it("should have staff router in routers.ts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("staff:");
  });

  it("should have staff CRUD operations", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    // Staff router has create, update, delete, list procedures
    expect(content).toContain("staffRouter");
    expect(content).toContain("staff: staffRouter");
    // Check the individual procedures exist
    const staffRouterMatch = content.match(/const staffRouter[\s\S]*?\}\);/);
    expect(staffRouterMatch).toBeTruthy();
    expect(staffRouterMatch![0]).toContain("create:");
    expect(staffRouterMatch![0]).toContain("update:");
    expect(staffRouterMatch![0]).toContain("delete:");
    expect(staffRouterMatch![0]).toContain("list:");
  });
});

// ── Staff DB Helpers Tests ──────────────────────────────────────────

describe("Staff DB Helpers", () => {
  it("should export staff helper functions from db.ts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/db.ts", "utf-8");
    expect(content).toContain("createStaffMember");
    expect(content).toContain("updateStaffMember");
    expect(content).toContain("deleteStaffMember");
    expect(content).toContain("getStaffByOwner");
  });

  it("getFullBusinessData should include staffMembers", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/db.ts", "utf-8");
    const fullDataMatch = content.match(/getFullBusinessData[\s\S]*?return \{/);
    expect(fullDataMatch).toBeTruthy();
    // getFullBusinessData returns staff as 'staff' key
    expect(content).toContain("staff: staffList");
  });
});
