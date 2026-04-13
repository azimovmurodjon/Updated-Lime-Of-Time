import { describe, it, expect } from "vitest";

// Test that the schema exports are correct
describe("Database Schema", () => {
  it("should export all required tables including new ones", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.users).toBeDefined();
    expect(schema.businessOwners).toBeDefined();
    expect(schema.services).toBeDefined();
    expect(schema.clients).toBeDefined();
    expect(schema.appointments).toBeDefined();
    expect(schema.reviews).toBeDefined();
    expect(schema.discounts).toBeDefined();
    expect(schema.giftCards).toBeDefined();
    expect(schema.customSchedule).toBeDefined();
  });

  it("should export type definitions for all tables", async () => {
    const schema = await import("../drizzle/schema");
    expect(typeof schema.businessOwners).toBe("object");
    expect(typeof schema.services).toBe("object");
    expect(typeof schema.clients).toBe("object");
    expect(typeof schema.appointments).toBe("object");
    expect(typeof schema.reviews).toBe("object");
    expect(typeof schema.discounts).toBe("object");
    expect(typeof schema.giftCards).toBe("object");
    expect(typeof schema.customSchedule).toBe("object");
  });
});

// Test the router structure
describe("API Router Structure", () => {
  it("should export appRouter with all sub-routers", async () => {
    const { appRouter } = await import("../server/routers");
    expect(appRouter).toBeDefined();
    const procedures = appRouter._def.procedures;
    expect(procedures).toBeDefined();
  });
});

// Test the types
describe("Frontend Types", () => {
  it("should export all required types and helpers", async () => {
    const types = await import("../lib/types");
    expect(types.DEFAULT_WORKING_HOURS).toBeDefined();
    expect(types.DEFAULT_CANCELLATION_POLICY).toBeDefined();
    expect(types.DEFAULT_BUSINESS_PROFILE).toBeDefined();
    expect(types.formatPhoneNumber).toBeDefined();
    expect(types.stripPhoneFormat).toBeDefined();
    expect(types.generateAvailableSlots).toBeDefined();
    expect(types.getApplicableDiscount).toBeDefined();
    expect(types.generateGiftCardCode).toBeDefined();
  });

  it("should format phone numbers correctly", async () => {
    const { formatPhoneNumber, stripPhoneFormat } = await import("../lib/types");
    expect(formatPhoneNumber("4125551234")).toBe("(412) 555-1234");
    expect(stripPhoneFormat("(412) 555-1234")).toBe("4125551234");
  });
});

// Test time/date helpers from types
describe("Time and Date Helpers", () => {
  it("should convert time to minutes and back", async () => {
    const { timeToMinutes, minutesToTime } = await import("../lib/types");
    expect(timeToMinutes("09:00")).toBe(540);
    expect(timeToMinutes("13:30")).toBe(810);
    expect(minutesToTime(540)).toBe("09:00");
    expect(minutesToTime(810)).toBe("13:30");
  });

  it("should detect overlapping time slots", async () => {
    const { timeSlotsOverlap } = await import("../lib/types");
    expect(timeSlotsOverlap("09:00", 60, "09:30", 60)).toBe(true);
    expect(timeSlotsOverlap("09:00", 60, "10:00", 60)).toBe(false);
    expect(timeSlotsOverlap("09:00", 60, "08:30", 60)).toBe(true);
  });

  it("should format date for long display", async () => {
    const { formatDateLong } = await import("../lib/types");
    const result = formatDateLong("2026-04-06");
    expect(result).toContain("April");
    expect(result).toContain("6");
    expect(result).toContain("2026");
  });

  it("should format time for display", async () => {
    const { formatTimeDisplay } = await import("../lib/types");
    expect(formatTimeDisplay("09:00")).toBe("9:00 AM");
    expect(formatTimeDisplay("13:30")).toBe("1:30 PM");
    expect(formatTimeDisplay("00:00")).toBe("12:00 AM");
  });
});

// Test the relations
describe("Database Relations", () => {
  it("should export all relation definitions including new ones", async () => {
    const relations = await import("../drizzle/relations");
    expect(relations.usersRelations).toBeDefined();
    expect(relations.businessOwnersRelations).toBeDefined();
    expect(relations.servicesRelations).toBeDefined();
    expect(relations.clientsRelations).toBeDefined();
    expect(relations.appointmentsRelations).toBeDefined();
    expect(relations.reviewsRelations).toBeDefined();
    expect(relations.discountsRelations).toBeDefined();
    expect(relations.giftCardsRelations).toBeDefined();
    expect(relations.customScheduleRelations).toBeDefined();
  });
});

// Test business data flow logic
describe("Business Data Flow", () => {
  it("should have correct default working hours", async () => {
    const { DEFAULT_WORKING_HOURS } = await import("../lib/types");
    expect(DEFAULT_WORKING_HOURS.monday.enabled).toBe(true);
    expect(DEFAULT_WORKING_HOURS.saturday.enabled).toBe(false);
    expect(DEFAULT_WORKING_HOURS.sunday.enabled).toBe(false);
    expect(DEFAULT_WORKING_HOURS.monday.start).toBe("09:00");
    expect(DEFAULT_WORKING_HOURS.monday.end).toBe("17:00");
  });

  it("should have correct default cancellation policy", async () => {
    const { DEFAULT_CANCELLATION_POLICY } = await import("../lib/types");
    // Cancellation fee is disabled by default — owner must explicitly opt in
    expect(DEFAULT_CANCELLATION_POLICY.enabled).toBe(false);
    expect(DEFAULT_CANCELLATION_POLICY.hoursBeforeAppointment).toBe(2);
    expect(DEFAULT_CANCELLATION_POLICY.feePercentage).toBe(50);
  });
});

// Test discount logic
describe("Discount Logic", () => {
  it("should find applicable discount by day and time", async () => {
    const { getApplicableDiscount } = await import("../lib/types");
    const discounts: any[] = [
      {
        id: "d1",
        name: "Happy Hour",
        percentage: 20,
        startTime: "14:00",
        endTime: "16:00",
        daysOfWeek: ["monday", "tuesday"],
        serviceIds: null,
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    // Monday at 15:00 should match
    const result = getApplicableDiscount(discounts, "2026-04-06", "15:00", "any-service");
    expect(result).toBeDefined();
    expect(result?.percentage).toBe(20);
  });

  it("should return null when no discount matches", async () => {
    const { getApplicableDiscount } = await import("../lib/types");
    const discounts: any[] = [
      {
        id: "d1",
        name: "Happy Hour",
        percentage: 20,
        startTime: "14:00",
        endTime: "16:00",
        daysOfWeek: ["monday"],
        serviceIds: null,
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    // Tuesday at 10:00 should not match (wrong day)
    const result = getApplicableDiscount(discounts, "2026-04-07", "10:00", "any-service");
    expect(result).toBeNull();
  });

  it("should filter by serviceId when specified", async () => {
    const { getApplicableDiscount } = await import("../lib/types");
    const discounts: any[] = [
      {
        id: "d1",
        name: "Service Specific",
        percentage: 15,
        startTime: "09:00",
        endTime: "17:00",
        daysOfWeek: ["monday"],
        serviceIds: ["svc1"],
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    // Monday at 10:00 for svc1 should match
    const match = getApplicableDiscount(discounts, "2026-04-06", "10:00", "svc1");
    expect(match).toBeDefined();
    // Monday at 10:00 for svc2 should not match
    const noMatch = getApplicableDiscount(discounts, "2026-04-06", "10:00", "svc2");
    expect(noMatch).toBeNull();
  });
});

// Test gift code generation
describe("Gift Card Logic", () => {
  it("should generate unique gift codes", async () => {
    const { generateGiftCardCode } = await import("../lib/types");
    const code1 = generateGiftCardCode();
    const code2 = generateGiftCardCode();
    expect(code1.startsWith("GIFT-")).toBe(true);
    expect(code2.startsWith("GIFT-")).toBe(true);
    expect(code1.length).toBeGreaterThanOrEqual(8);
    expect(code2.length).toBeGreaterThanOrEqual(8);
    expect(code1).not.toBe(code2);
  });

  it("should generate alphanumeric codes", async () => {
    const { generateGiftCardCode } = await import("../lib/types");
    const code = generateGiftCardCode();
    expect(code).toMatch(/^GIFT-[A-Z0-9]+$/);
  });
});

// Test custom schedule integration with slot generation
describe("Custom Schedule Slot Generation", () => {
  it("should return no slots when custom schedule marks day as closed", async () => {
    const { generateAvailableSlots, DEFAULT_WORKING_HOURS } = await import("../lib/types");
    const customSchedule = [{ date: "2026-04-06", isOpen: false }];
    const slots = generateAvailableSlots(
      "2026-04-06",
      60,
      DEFAULT_WORKING_HOURS,
      [],
      30,
      customSchedule
    );
    expect(slots).toHaveLength(0);
  });

  it("should use custom hours when custom schedule provides them", async () => {
    const { generateAvailableSlots, DEFAULT_WORKING_HOURS } = await import("../lib/types");
    // Use a future date to avoid past-date filtering
    const futureDate = "2026-12-07";
    const customSchedule = [{ date: futureDate, isOpen: true, startTime: "10:00", endTime: "12:00" }];
    const slots = generateAvailableSlots(
      futureDate,
      60,
      DEFAULT_WORKING_HOURS,
      [],
      30,
      customSchedule
    );
    // Should have slots from 10:00 to 11:00 (60 min duration, so last slot at 11:00 ends at 12:00)
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toBe("10:00");
    // All slots should be within 10:00-12:00
    slots.forEach((s: string) => {
      expect(s >= "10:00").toBe(true);
    });
  });

  it("should fall back to weekly hours when no custom override exists", async () => {
    const { generateAvailableSlots, DEFAULT_WORKING_HOURS } = await import("../lib/types");
    // Use a future Monday (2026-04-20 is the next Monday after Apr 13)
    const slots = generateAvailableSlots(
      "2026-04-20",
      60,
      DEFAULT_WORKING_HOURS,
      [],
      30,
      [] // no custom schedule
    );
    // Monday is enabled by default (9-17), so should have slots
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toBe("09:00");
  });
});
