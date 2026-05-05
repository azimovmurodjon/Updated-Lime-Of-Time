/**
 * Tests for 3 UX polish improvements:
 * 1. Calendar tab slot panel pills: height 48, borderRadius 12, fontWeight 700
 * 2. Package Browser empty state: shortcut button to /packages settings
 * 3. Step 0 header: "Booking at {location}" subtitle when location is selected
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const calendarSrc = readFileSync(join(ROOT, "app/(tabs)/calendar.tsx"), "utf8");
const pkgBrowserSrc = readFileSync(join(ROOT, "app/package-browser.tsx"), "utf8");
const bookingSrc = readFileSync(join(ROOT, "app/calendar-booking.tsx"), "utf8");

// ── 1. Calendar tab slot panel pill style ─────────────────────────────────
describe("Calendar tab slot panel — pill style consistency", () => {
  it("should use height 48 on slot pills", () => {
    const slotSection = calendarSrc.slice(calendarSrc.indexOf("Scrollable time slot chips"));
    expect(slotSection.slice(0, 2000)).toContain("height: 48");
  });

  it("should use borderRadius 12 on slot pills", () => {
    const slotSection = calendarSrc.slice(calendarSrc.indexOf("Scrollable time slot chips"));
    expect(slotSection.slice(0, 2000)).toContain("borderRadius: 12");
  });

  it("should use fontWeight 700 on slot pill text", () => {
    const slotSection = calendarSrc.slice(calendarSrc.indexOf("Scrollable time slot chips"));
    expect(slotSection.slice(0, 2000)).toContain('fontWeight: "700"');
  });

  it("should use minWidth 80 so pills have consistent minimum size", () => {
    const slotSection = calendarSrc.slice(calendarSrc.indexOf("Scrollable time slot chips"));
    expect(slotSection.slice(0, 2000)).toContain("minWidth: 80");
  });
});

// ── 2. Package Browser empty state shortcut ───────────────────────────────
describe("Package Browser — empty state shortcut button", () => {
  it("should navigate to /packages settings from the empty state", () => {
    expect(pkgBrowserSrc).toContain('router.push("/packages"');
  });

  it("should have a Go to Packages Settings button label", () => {
    expect(pkgBrowserSrc).toContain("Go to Packages Settings");
  });

  it("should have a Go Back button in the empty state", () => {
    expect(pkgBrowserSrc).toContain("Go Back");
  });

  it("should still show the No Packages Yet heading", () => {
    expect(pkgBrowserSrc).toContain("No Packages Yet");
  });
});

// ── 3. Step 0 location subtitle ───────────────────────────────────────────
describe("Calendar booking Step 0 — location subtitle", () => {
  it("should render a Booking at subtitle when step0Location is set", () => {
    expect(bookingSrc).toContain("Booking at {step0Location.name}");
  });

  it("should show the full address in the subtitle", () => {
    // The subtitle uses formatFullAddress with step0Location fields
    const subtitleBlock = bookingSrc.slice(bookingSrc.indexOf("Location subtitle"));
    expect(subtitleBlock.slice(0, 1200)).toContain("formatFullAddress");
  });

  it("should use a teal primary dot indicator before the location name", () => {
    const subtitleBlock = bookingSrc.slice(bookingSrc.indexOf("Location subtitle"));
    expect(subtitleBlock.slice(0, 400)).toContain("colors.primary");
  });

  it("should only render when step0Location is truthy (not in single-location or all-mode)", () => {
    // The block is wrapped in {step0Location && (...)}
    expect(bookingSrc).toContain("{step0Location && (");
  });
});
