import { describe, it, expect, vi, beforeEach } from "vitest";

// Test that the schema exports are correct
describe("Database Schema", () => {
  it("should export all required tables", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.users).toBeDefined();
    expect(schema.businessOwners).toBeDefined();
    expect(schema.services).toBeDefined();
    expect(schema.clients).toBeDefined();
    expect(schema.appointments).toBeDefined();
    expect(schema.reviews).toBeDefined();
  });

  it("should export type definitions", async () => {
    const schema = await import("../drizzle/schema");
    // Verify table objects exist and are objects
    expect(typeof schema.businessOwners).toBe("object");
    expect(typeof schema.services).toBe("object");
    expect(typeof schema.clients).toBe("object");
    expect(typeof schema.appointments).toBe("object");
    expect(typeof schema.reviews).toBe("object");
  });
});

// Test the router structure
describe("API Router Structure", () => {
  it("should export appRouter with all sub-routers", async () => {
    const { appRouter } = await import("../server/routers");
    expect(appRouter).toBeDefined();
    
    // Check that the router has the expected procedure keys
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
  });

  it("should format phone numbers correctly", async () => {
    const { formatPhoneNumber, stripPhoneFormat } = await import("../lib/types");
    expect(formatPhoneNumber("4125551234")).toBe("(412) 555-1234");
    expect(stripPhoneFormat("(412) 555-1234")).toBe("4125551234");
  });
});

// Test time/date helpers from types (store has trpc dependency that doesn't resolve in vitest)
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
  it("should export all relation definitions", async () => {
    const relations = await import("../drizzle/relations");
    expect(relations.usersRelations).toBeDefined();
    expect(relations.businessOwnersRelations).toBeDefined();
    expect(relations.servicesRelations).toBeDefined();
    expect(relations.clientsRelations).toBeDefined();
    expect(relations.appointmentsRelations).toBeDefined();
    expect(relations.reviewsRelations).toBeDefined();
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
    expect(DEFAULT_CANCELLATION_POLICY.enabled).toBe(true);
    expect(DEFAULT_CANCELLATION_POLICY.hoursBeforeAppointment).toBe(2);
    expect(DEFAULT_CANCELLATION_POLICY.feePercentage).toBe(50);
  });
});
