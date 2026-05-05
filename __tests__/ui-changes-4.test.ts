/**
 * Tests for 4 UI changes:
 * 1. Packages & Bundles row removed from calendar.tsx
 * 2. Inline PACKAGES & BUNDLES section removed from calendar-booking.tsx Step 1
 * 3. Home page Book an Appointment → Calendar tab navigation
 * 4. Time slot grid: fixed-width pills (slotPillWidth), height 48, borderRadius 12
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

const calendarSrc = readFileSync(join(ROOT, "app/(tabs)/calendar.tsx"), "utf8");
const bookingSrc = readFileSync(join(ROOT, "app/calendar-booking.tsx"), "utf8");
const scheduleSrc = readFileSync(join(ROOT, "components/schedule-card.tsx"), "utf8");

// ── 1. Calendar tab: Packages & Bundles preview row removed ────────────────
describe("Calendar tab — Packages & Bundles row removed", () => {
  it("should NOT contain the activePkgs.slice preview row", () => {
    expect(calendarSrc).not.toContain("activePkgs.slice(0, 6)");
  });

  it("should NOT contain the Packages & Bundles section header text in the tab", () => {
    // The preview row had this exact label; the Package Browser screen is separate
    expect(calendarSrc).not.toContain("Packages & Bundles preview row");
  });
});

// ── 2. Booking flow Step 1: inline PACKAGES & BUNDLES section hidden ───────
describe("Calendar booking Step 1 — inline package list removed", () => {
  it("should have the inline section wrapped in {false && ...} so it never renders", () => {
    expect(bookingSrc).toContain("{false && (() => {");
  });

  it("should still contain the Book a Package banner (not removed)", () => {
    expect(bookingSrc).toContain("Book a Package");
  });
});

// ── 3. Home page Book an Appointment → Calendar tab ───────────────────────
describe("Schedule card — Book an Appointment navigates to Calendar tab", () => {
  it("should push to /(tabs)/calendar instead of /new-booking", () => {
    expect(scheduleSrc).toContain("/(tabs)/calendar");
  });

  it("should NOT push to /new-booking from the empty state button", () => {
    // The share handler still uses "Book an Appointment" as a title string — that's fine.
    // We only care that the Pressable onPress no longer calls router.push("/new-booking").
    // Check that the specific onPress line is gone.
    expect(scheduleSrc).not.toContain('router.push("/new-booking")');
  });
});

// ── 4. Time slot grid: fixed-width pills ──────────────────────────────────
describe("Calendar booking Step 0 — fixed-width time slot pills", () => {
  it("should use slotPillWidth for pill width", () => {
    expect(bookingSrc).toContain("width: slotPillWidth");
  });

  it("should set pill height to 48", () => {
    expect(bookingSrc).toContain("height: 48");
  });

  it("should use borderRadius 12 (not 50) for a professional look", () => {
    expect(bookingSrc).toContain("borderRadius: 12");
  });

  it("should compute slotPillWidth from screenWidth", () => {
    expect(bookingSrc).toContain("slotPillWidth");
    expect(bookingSrc).toContain("screenWidth");
  });

  it("should import useWindowDimensions from react-native", () => {
    expect(bookingSrc).toContain("useWindowDimensions");
  });
});
