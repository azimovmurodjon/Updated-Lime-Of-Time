/**
 * Tests for the "Book This Package" navigation fix:
 * - Step 0 Continue button skips to Step 2 (Select Client) when packageId is pre-selected
 * - selectedServices is initialized synchronously from packageId in useState (no useEffect race)
 * - The useEffect still exists as a fallback for dynamic package changes
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const bookingSrc = readFileSync(join(ROOT, "app/calendar-booking.tsx"), "utf8");

describe("Book This Package — Step 0 Continue navigation fix", () => {
  it("should skip to Step 2 when packageId param is set and services are pre-selected", () => {
    // The Continue button should call setStep(2) when params.packageId is truthy
    expect(bookingSrc).toContain("if (params.packageId && selectedServices.length > 0)");
    expect(bookingSrc).toContain("setStep(2)");
  });

  it("should still go to Step 1 when no package is pre-selected", () => {
    // The else branch should still call setStep(1)
    const continueBlock = bookingSrc.slice(bookingSrc.indexOf("If a package is pre-selected"));
    expect(continueBlock.slice(0, 500)).toContain("setStep(1)");
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
    // Should NOT have 'if (!pkg) return []; ... return [];' as the only return
    // Instead it should have a populated return after finding the package
    expect(initBlock.slice(0, 700)).toContain("return [{");
  });

  it("should still have the useEffect as a fallback for dynamic packageId changes", () => {
    // The useEffect that handles params.packageId should still exist
    expect(bookingSrc).toContain("Pre-populate selectedServices when a packageId param is passed");
    expect(bookingSrc).toContain("}, [params.packageId]);");
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
});
