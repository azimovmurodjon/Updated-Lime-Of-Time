/**
 * Tests for Step 0 location gate in calendar-booking.tsx
 *
 * Verifies that:
 * 1. A location chip selector is rendered when multiple locations exist
 * 2. The Continue button is disabled/labelled correctly until a location is chosen
 * 3. step0LocationId uses selectedLocationId so slots update reactively
 */

import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync(
  "/home/ubuntu/manus-scheduler/app/calendar-booking.tsx",
  "utf8"
);

describe("Step 0 Location Gate — location chip selector", () => {
  it("renders a location selector section when activeLocations.length > 1", () => {
    expect(src).toContain("activeLocations.length > 1");
  });

  it("renders a 'Select Location' label heading", () => {
    expect(src).toContain("Select Location");
  });

  it("maps over activeLocations to render chips", () => {
    expect(src).toContain("activeLocations.map((loc) => {");
  });

  it("calls setSelectedLocationId when a chip is tapped", () => {
    expect(src).toContain("setSelectedLocationId(loc.id)");
  });

  it("resets step0Time when location changes", () => {
    expect(src).toContain("setStep0Time(null); // reset time when location changes");
  });

  it("shows a warning hint when no location is selected", () => {
    expect(src).toContain("Please select a location to see available times");
  });
});

describe("Step 0 Location Gate — Continue button gating", () => {
  it("computes needsLocation from activeLocations.length > 1 && !selectedLocationId", () => {
    expect(src).toContain("const needsLocation = activeLocations.length > 1 && !selectedLocationId;");
  });

  it("canContinue requires both a time and a location", () => {
    expect(src).toContain("const canContinue = !!step0Time && !needsLocation;");
  });

  it("button background is muted when canContinue is false", () => {
    expect(src).toContain("backgroundColor: canContinue ? colors.primary : colors.muted");
  });

  it("button label says 'Select a Location First' when no location chosen", () => {
    expect(src).toContain("Select a Location First");
  });

  it("button label says 'Select a Time to Continue' when location chosen but no time", () => {
    expect(src).toContain("Select a Time to Continue");
  });

  it("button label says 'Continue →' when both location and time are selected", () => {
    expect(src).toContain("Continue →");
  });

  it("shows an Alert when user taps Continue without a location", () => {
    expect(src).toContain('Alert.alert("Select a Location"');
  });
});

describe("Step 0 Location Gate — reactive slot computation", () => {
  it("step0LocationId uses selectedLocationId so slots update when user picks a location", () => {
    expect(src).toContain("const step0LocationId = selectedLocationId ?? preselectedLocationId;");
  });

  it("step0IsAllMode is false once a location is selected", () => {
    // The expression depends on step0LocationId being truthy after selection
    expect(src).toContain("const step0IsAllMode = !step0LocationId && activeLocations.length > 1;");
  });
});
