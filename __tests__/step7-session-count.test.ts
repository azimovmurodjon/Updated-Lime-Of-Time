import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const src = fs.readFileSync(
  path.join(__dirname, "../app/calendar-booking.tsx"),
  "utf-8"
);

describe("Step 7 — Package session count banner", () => {
  it("should contain the package session count banner block", () => {
    expect(src).toContain("Package session count banner");
  });

  it("should show X of Y sessions will be scheduled", () => {
    expect(src).toContain("of {totalSessions} session");
    expect(src).toContain("will be scheduled");
  });

  it("should derive totalSessions from pkg.sessions with fallback to packageSessions.length", () => {
    const bannerBlock = src.slice(src.indexOf("Package session count banner"));
    expect(bannerBlock.slice(0, 600)).toContain("pkg?.sessions ?? packageSessions.length");
  });

  it("should show the package name as subtitle in the banner", () => {
    const bannerBlock = src.slice(src.indexOf("Package session count banner"));
    expect(bannerBlock.slice(0, 1400)).toContain("pkgCartItem.name");
  });

  it("should show Complete checkmark when all sessions are scheduled", () => {
    const bannerBlock = src.slice(src.indexOf("Package session count banner"));
    expect(bannerBlock.slice(0, 800)).toContain("isComplete");
    expect(bannerBlock.slice(0, 800)).toContain("Complete");
  });

  it("should only render the banner when a package CartItem is present", () => {
    const bannerBlock = src.slice(src.indexOf("Package session count banner"));
    expect(bannerBlock.slice(0, 400)).toContain('type === "package"');
    expect(bannerBlock.slice(0, 400)).toContain("if (!pkgCartItem) return null");
  });

  it("should be placed inside the Step 7 summary card before the services header", () => {
    const summaryCardIdx = src.indexOf("Summary card \u2014 professional receipt style");
    const servicesHeaderIdx = src.indexOf("Services header \u2014 show all selected services");
    const bannerIdx = src.indexOf("Package session count banner");
    expect(bannerIdx).toBeGreaterThan(summaryCardIdx);
    expect(bannerIdx).toBeLessThan(servicesHeaderIdx);
  });
});
