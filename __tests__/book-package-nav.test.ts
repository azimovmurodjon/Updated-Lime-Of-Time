/**
 * Tests for the "Book This Package" navigation fix:
 * - When packageId param is present, calendar-booking starts at Step 8 (multi-session scheduler)
 *   directly, skipping Step 0 (date/time picker) and Step 1 (service selection)
 * - selectedServices is initialized synchronously from packageId in useState (no useEffect race)
 * - The useEffect still exists as a fallback for dynamic package changes
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const bookingSrc = readFileSync(join(ROOT, "app/calendar-booking.tsx"), "utf8");

describe("Book This Package — initial step fix", () => {
  it("should start at Step 8 when packageId param is set", () => {
    // The useState initializer should return 8 when params.packageId is truthy
    expect(bookingSrc).toContain("if (params.packageId) return 8;");
  });

  it("should exclude packageId bookings from showDateTimePicker", () => {
    // showDateTimePicker must be false when packageId is present (no Step 0 for packages)
    expect(bookingSrc).toContain("const showDateTimePicker = !params.time && !params.packageId;");
  });

  it("should still go to Step 0 when no package and no time param", () => {
    // The else branch should still call showDateTimePicker ? 0 : 1
    const stepBlock = bookingSrc.slice(bookingSrc.indexOf("if (params.packageId) return 8;"));
    expect(stepBlock.slice(0, 200)).toContain("showDateTimePicker ? 0 : 1");
  });

  it("should still go to Step 1 when no package but time is pre-selected", () => {
    // When time is provided (calendar tap), showDateTimePicker=false → step starts at 1
    expect(bookingSrc).toContain("showDateTimePicker ? 0 : 1");
  });

  it("should initialize selectedServices synchronously from packageId in useState", () => {
    // The useState initializer should build the CartItem from state.packages
    const initBlock = bookingSrc.slice(bookingSrc.indexOf("synchronous init so it's ready before first render"));
    expect(initBlock.slice(0, 900)).toContain("state.packages");
    expect(initBlock.slice(0, 900)).toContain('type: "package" as const');
    expect(initBlock.slice(0, 900)).toContain("packageServiceIds: pkg.serviceIds");
  });

  it("should not return empty array when pkgId is found in state.packages", () => {
    // The initializer should return the populated CartItem, not []
    const initBlock = bookingSrc.slice(bookingSrc.indexOf("synchronous init so it's ready before first render"));
    expect(initBlock.slice(0, 700)).toContain("return [{");
  });

  it("should still have the useEffect as a fallback for dynamic packageId changes", () => {
    // The useEffect that handles params.packageId should still exist
    expect(bookingSrc).toContain("Pre-populate selectedServices when a packageId param is passed");
    expect(bookingSrc).toContain("}, [params.packageId]);");
  });

  it("should go back to package-browser when Back is tapped on Step 8 session 0", () => {
    // When launched from Package Browser, Back on Step 8 session 0 should call router.back()
    expect(bookingSrc).toContain("} else if (params.packageId) {");
    expect(bookingSrc).toContain("// Launched directly from Package Browser — go back to it");
    expect(bookingSrc).toContain("router.back();");
  });
});

describe("Package Browser — handleBookPackage navigation", () => {
  const browserSrc = readFileSync(join(ROOT, "app/package-browser.tsx"), "utf8");

  it("should navigate to /calendar-booking with packageId param", () => {
    expect(browserSrc).toContain('pathname: "/calendar-booking"');
    expect(browserSrc).toContain("packageId: pkg.id");
  });

  it("should pass locationId param if available", () => {
    // locationId is in the navParams object built before the pathname call
    const handleBlock = browserSrc.slice(browserSrc.indexOf("handleBookPackage"));
    expect(handleBlock.slice(0, 600)).toContain("locationId");
  });

  it("should dismiss the detail sheet before navigating", () => {
    // setDetailPackage(null) should be called before router.push
    const handleBlock = browserSrc.slice(browserSrc.indexOf("handleBookPackage"));
    expect(handleBlock.slice(0, 100)).toContain("setDetailPackage(null)");
  });

  it("should use router.replace when fromCalendarBooking param is set", () => {
    // When opened from within calendar-booking Step 1 banner, use replace to keep stack clean
    expect(browserSrc).toContain('params.fromCalendarBooking === "1"');
    expect(browserSrc).toContain('router.replace(');
  });
});
