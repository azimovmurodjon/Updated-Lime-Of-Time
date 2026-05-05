/**
 * Tests for three package-related features:
 * 1. Package completion detection in bookings.tsx
 * 2. Session re-scheduling preserves packageGroupId in appointment-detail.tsx
 * 3. Calendar teal dot indicators for package session days in calendar.tsx
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..");

const bookings = readFileSync(join(root, "app/(tabs)/bookings.tsx"), "utf-8");
const apptDetail = readFileSync(join(root, "app/appointment-detail.tsx"), "utf-8");
const calendar = readFileSync(join(root, "app/(tabs)/calendar.tsx"), "utf-8");
const types = readFileSync(join(root, "lib/types.ts"), "utf-8");

// ─── Feature 1: Package completion modal ─────────────────────────────────────

describe("Package Completion Modal (bookings.tsx)", () => {
  it("declares showPkgCompleteModal state", () => {
    expect(bookings).toContain("showPkgCompleteModal");
  });

  it("declares pkgCompleteInfo state with name, sessions, totalValue shape", () => {
    expect(bookings).toContain("pkgCompleteInfo");
    expect(bookings).toContain("name: string");
    expect(bookings).toContain("sessions: number");
    expect(bookings).toContain("totalValue: number");
  });

  it("uses a ref to prevent showing the same package completion twice", () => {
    expect(bookings).toContain("shownPkgCompleteRef");
    expect(bookings).toContain("useRef<Set<string>>");
  });

  it("detects completion when non-cancelled sessions >= sessionTotal", () => {
    expect(bookings).toContain("nonCancelled.length >= total");
  });

  it("renders the Package Complete modal with a 🎉 emoji and Awesome button", () => {
    expect(bookings).toContain("Package Complete!");
    expect(bookings).toContain("Awesome!");
  });

  it("shows total package value in the modal", () => {
    expect(bookings).toContain("Total package value:");
  });

  it("modal is triggered by showPkgCompleteModal state", () => {
    expect(bookings).toContain("visible={showPkgCompleteModal}");
  });
});

// ─── Feature 2: Session re-scheduling preserves packageGroupId ────────────────

describe("Session Re-scheduling (appointment-detail.tsx)", () => {
  it("explicitly preserves packageGroupId in the reschedule update object", () => {
    expect(apptDetail).toContain("packageGroupId: appointment!.packageGroupId");
  });

  it("explicitly preserves packageName in the reschedule update object", () => {
    expect(apptDetail).toContain("packageName: appointment!.packageName");
  });

  it("explicitly preserves sessionIndex in the reschedule update object", () => {
    expect(apptDetail).toContain("sessionIndex: appointment!.sessionIndex");
  });

  it("explicitly preserves sessionTotal in the reschedule update object", () => {
    expect(apptDetail).toContain("sessionTotal: appointment!.sessionTotal");
  });

  it("reschedule update still includes date and time fields", () => {
    expect(apptDetail).toContain("date: reschedDate");
    expect(apptDetail).toContain("time: reschedTime");
  });
});

// ─── Feature 3: Calendar teal dot indicators ─────────────────────────────────

describe("Calendar Teal Package Dot (calendar.tsx)", () => {
  it("computes pkgSessionDates useMemo from locationAppointments", () => {
    expect(calendar).toContain("pkgSessionDates");
    expect(calendar).toContain("const dates = new Set<string>()");
    expect(calendar).toContain("if (a.packageGroupId) dates.add(a.date)");
  });

  it("renders a teal dot (#0891b2) for days with package sessions", () => {
    expect(calendar).toContain("pkgSessionDates.has(dateStr)");
    expect(calendar).toContain("'#0891b2'");
  });

  it("shows teal dot even when no other status dots exist for that day", () => {
    // The fallback branch renders a dot when statuses is empty but pkgSessionDates has the date
    const hasFallback = calendar.includes("(!statuses || statuses.size === 0) && pkgSessionDates.has(dateStr)");
    expect(hasFallback).toBe(true);
  });

  it("pkgSessionDates depends on locationAppointments in its dependency array", () => {
    expect(calendar).toContain("}, [locationAppointments]);");
  });
});

// ─── Feature 4: Progress bar in banner ──────────────────────────────────────

describe("Package Banner Progress Bar (bookings.tsx)", () => {
  it("computes booked count from non-cancelled sessions", () => {
    expect(bookings).toContain("a.status !== 'cancelled'");
  });

  it("renders a progress bar track and fill", () => {
    expect(bookings).toContain("pct * 100");
  });

  it("shows X/Y session count in the banner header", () => {
    expect(bookings).toContain("{booked}/{total}");
  });

  it("shows 'All sessions booked' when complete", () => {
    expect(bookings).toContain("All sessions booked ✓");
  });

  it("shows remaining count when not complete", () => {
    expect(bookings).toContain("remaining`");
  });
});

// ─── Feature 5: View Package shortcut in completion modal ────────────────────

describe("View Package Shortcut in Completion Modal (bookings.tsx)", () => {
  it("has a 'View Package Sessions' button", () => {
    expect(bookings).toContain("View Package Sessions");
  });

  it("sets packageGroupFilter from pkgCompleteInfo.groupId on press", () => {
    expect(bookings).toContain("setPackageGroupFilter(pkgCompleteInfo.groupId)");
  });

  it("pkgCompleteInfo type includes groupId field", () => {
    expect(bookings).toContain("groupId: string");
  });

  it("passes groupId when setting pkgCompleteInfo", () => {
    expect(bookings).toContain("groupId });");
  });
});

// ─── Feature 6: Package session legend in calendar ───────────────────────────

describe("Package Session Legend in Calendar Month View (calendar.tsx)", () => {
  it("renders a teal legend dot for Package session", () => {
    expect(calendar).toContain("Package session");
  });

  it("uses the correct teal color in the legend", () => {
    // The legend line has the color and label on the same line; search a window around the label
    const idx = calendar.lastIndexOf("Package session"); // last occurrence = legend (not comment)
    const legendLine = calendar.slice(Math.max(0, idx - 150), idx + 50);
    expect(legendLine).toContain("'#0891b2'");
  });
});

// ─── Shared: lib/types.ts has package fields on Appointment ──────────────────

describe("Appointment type has package session fields (lib/types.ts)", () => {
  it("has packageGroupId field", () => {
    expect(types).toContain("packageGroupId?: string");
  });

  it("has packageName field", () => {
    expect(types).toContain("packageName?: string");
  });

  it("has sessionIndex field", () => {
    expect(types).toContain("sessionIndex?: number");
  });

  it("has sessionTotal field", () => {
    expect(types).toContain("sessionTotal?: number");
  });
});
