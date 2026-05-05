/**
 * Tests for scrollable location chips with full address
 * in calendar-booking.tsx (Step 0) and calendar.tsx (Calendar tab).
 */

import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const booking = readFileSync(
  "/home/ubuntu/manus-scheduler/app/calendar-booking.tsx",
  "utf8"
);
const calendar = readFileSync(
  "/home/ubuntu/manus-scheduler/app/(tabs)/calendar.tsx",
  "utf8"
);

// ─── calendar-booking.tsx Step 0 ─────────────────────────────────────────────

describe("Step 0 location chips — horizontal scroll (calendar-booking.tsx)", () => {
  it("wraps chips in a horizontal ScrollView", () => {
    // The inner ScrollView for chips should be horizontal
    expect(booking).toContain("showsHorizontalScrollIndicator={false}");
  });

  it("uses formatFullAddress to build the address string", () => {
    expect(booking).toContain("formatFullAddress(loc.address, loc.city, loc.state, loc.zipCode)");
  });

  it("renders the full address below the location name", () => {
    expect(booking).toContain("{!!fullAddr && (");
  });

  it("address text is single-line (numberOfLines={1})", () => {
    // Both name and address lines should have numberOfLines={1}
    const addrSection = booking.slice(booking.indexOf("fullAddr && ("), booking.indexOf("fullAddr && (") + 200);
    expect(addrSection).toContain("numberOfLines={1}");
  });

  it("chip has a maxWidth to prevent overflow", () => {
    const chipSection = booking.slice(booking.indexOf("Select Location"), booking.indexOf("Select Location") + 1500);
    expect(chipSection).toContain("maxWidth: 200");
  });
});

// ─── calendar.tsx Calendar tab ────────────────────────────────────────────────

describe("Calendar tab location chips — horizontal scroll (calendar.tsx)", () => {
  it("imports formatFullAddress from lib/types", () => {
    expect(calendar).toContain("formatFullAddress,");
  });

  it("wraps location chips in a horizontal ScrollView", () => {
    const filterSection = calendar.slice(calendar.indexOf("Location Filter"), calendar.indexOf("View Switcher"));
    expect(filterSection).toContain("horizontal");
    expect(filterSection).toContain("showsHorizontalScrollIndicator={false}");
  });

  it("uses formatFullAddress for each location chip", () => {
    expect(calendar).toContain("formatFullAddress(loc.address, loc.city, loc.state, loc.zipCode)");
  });

  it("renders the full address below the location name in the Calendar tab", () => {
    const filterSection = calendar.slice(calendar.indexOf("Location Filter"), calendar.indexOf("View Switcher"));
    expect(filterSection).toContain("{!!fullAddr && (");
  });

  it("address text is single-line in the Calendar tab chips", () => {
    const filterSection = calendar.slice(calendar.indexOf("Location Filter"), calendar.indexOf("View Switcher"));
    const addrIdx = filterSection.indexOf("fullAddr && (");
    const addrBlock = filterSection.slice(addrIdx, addrIdx + 200);
    expect(addrBlock).toContain("numberOfLines={1}");
  });

  it("chip has a maxWidth in the Calendar tab", () => {
    const filterSection = calendar.slice(calendar.indexOf("Location Filter"), calendar.indexOf("View Switcher"));
    expect(filterSection).toContain("maxWidth: 200");
  });
});
