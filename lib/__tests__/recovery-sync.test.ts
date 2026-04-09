import { describe, it, expect } from "vitest";

/**
 * Tests for the recovery sync logic that ensures public booking links
 * connect to the database even when the initial onboarding DB save fails.
 *
 * The recovery sync in store.tsx detects when:
 * 1. onboardingComplete === true (business was set up)
 * 2. No businessOwnerId is stored (DB save failed during onboarding)
 * 3. A valid business name exists locally
 *
 * When detected, it creates the business in the DB and pushes all local data.
 */

describe("Recovery Sync - Slug Derivation", () => {
  // The slug derivation must be consistent between the app and the server
  const deriveSlug = (businessName: string) =>
    businessName.toLowerCase().replace(/\s+/g, "-");

  it("should derive consistent slugs from business names", () => {
    expect(deriveSlug("Lime Of Time")).toBe("lime-of-time");
    expect(deriveSlug("Jane's Salon")).toBe("jane's-salon");
    expect(deriveSlug("Best  Barber  Shop")).toBe("best-barber-shop");
    expect(deriveSlug("UPPERCASE BUSINESS")).toBe("uppercase-business");
  });

  it("should match server-side slug derivation", () => {
    // Server-side: owner.businessName.toLowerCase().replace(/\s+/g, "-")
    // App-side: state.settings.businessName.replace(/\s+/g, "-").toLowerCase()
    const businessName = "Lime Of Time";
    const serverSlug = businessName.toLowerCase().replace(/\s+/g, "-");
    const appSlug = businessName.replace(/\s+/g, "-").toLowerCase();
    expect(serverSlug).toBe(appSlug);
  });

  it("should handle edge cases in slug derivation", () => {
    expect(deriveSlug("A")).toBe("a");
    expect(deriveSlug("Already-Hyphenated")).toBe("already-hyphenated");
    expect(deriveSlug("  Leading Trailing  ")).toBe("-leading-trailing-");
  });
});

describe("Recovery Sync - Condition Detection", () => {
  it("should detect local-only business needing recovery", () => {
    const storedOwnerId: string | null = null;
    const settings = {
      onboardingComplete: true,
      businessName: "Lime Of Time",
    };

    const needsRecovery =
      !storedOwnerId &&
      settings.onboardingComplete &&
      settings.businessName &&
      settings.businessName !== "My Business";

    expect(needsRecovery).toBe(true);
  });

  it("should NOT trigger recovery when businessOwnerId exists", () => {
    const storedOwnerId: string | null = "42";
    const settings = {
      onboardingComplete: true,
      businessName: "Lime Of Time",
    };

    const needsRecovery =
      !storedOwnerId &&
      settings.onboardingComplete &&
      settings.businessName &&
      settings.businessName !== "My Business";

    expect(needsRecovery).toBe(false);
  });

  it("should NOT trigger recovery when onboarding is incomplete", () => {
    const storedOwnerId: string | null = null;
    const settings = {
      onboardingComplete: false,
      businessName: "Lime Of Time",
    };

    const needsRecovery =
      !storedOwnerId &&
      settings.onboardingComplete &&
      settings.businessName &&
      settings.businessName !== "My Business";

    expect(needsRecovery).toBe(false);
  });

  it("should NOT trigger recovery for default business name", () => {
    const storedOwnerId: string | null = null;
    const settings = {
      onboardingComplete: true,
      businessName: "My Business",
    };

    const needsRecovery =
      !storedOwnerId &&
      settings.onboardingComplete &&
      settings.businessName &&
      settings.businessName !== "My Business";

    expect(needsRecovery).toBe(false);
  });

  it("should NOT trigger recovery for empty business name", () => {
    const storedOwnerId: string | null = null;
    const settings = {
      onboardingComplete: true,
      businessName: "",
    };

    const needsRecovery =
      !storedOwnerId &&
      settings.onboardingComplete &&
      settings.businessName &&
      settings.businessName !== "My Business";

    // Empty string is falsy in JS, so needsRecovery evaluates to "" (falsy)
    expect(needsRecovery).toBeFalsy();
  });
});

describe("Recovery Sync - Phone Normalization", () => {
  it("should strip non-digit characters for DB phone field", () => {
    const normalize = (phone: string) => phone.replace(/\D/g, "") || "0000000000";
    expect(normalize("(412) 482-0000")).toBe("4124820000");
    expect(normalize("+1 (555) 123-4567")).toBe("15551234567");
    expect(normalize("5551234567")).toBe("5551234567");
    expect(normalize("")).toBe("0000000000");
  });
});

describe("Recovery Sync - Gift Card Data Encoding", () => {
  it("should encode extended gift card data in message field", () => {
    const gc = {
      id: "gc-1",
      code: "GIFT123",
      serviceLocalId: "svc-1",
      serviceIds: ["svc-1", "svc-2"],
      productIds: ["prod-1"],
      originalValue: 100,
      remainingBalance: 75,
      message: "Happy Birthday!",
    };

    const giftDataBlock = `\n---GIFT_DATA---\n${JSON.stringify({
      serviceIds: gc.serviceIds,
      productIds: gc.productIds,
      originalValue: gc.originalValue,
      remainingBalance: gc.remainingBalance,
    })}`;
    const msgWithData = (gc.message || "") + giftDataBlock;

    expect(msgWithData).toContain("Happy Birthday!");
    expect(msgWithData).toContain("---GIFT_DATA---");
    expect(msgWithData).toContain('"originalValue":100');
    expect(msgWithData).toContain('"remainingBalance":75');

    // Verify it can be decoded back
    const dataIdx = msgWithData.indexOf("\n---GIFT_DATA---\n");
    expect(dataIdx).toBeGreaterThan(-1);
    const jsonStr = msgWithData.slice(dataIdx + "\n---GIFT_DATA---\n".length);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.serviceIds).toEqual(["svc-1", "svc-2"]);
    expect(parsed.productIds).toEqual(["prod-1"]);
    expect(parsed.originalValue).toBe(100);
    expect(parsed.remainingBalance).toBe(75);
  });
});

describe("Recovery Sync - Data Push Shapes", () => {
  it("should transform local service to DB create shape", () => {
    const localService = {
      id: "svc-abc",
      name: "Haircut",
      duration: 30,
      price: 25.5,
      color: "#4CAF50",
      createdAt: new Date().toISOString(),
    };

    const dbShape = {
      businessOwnerId: 1,
      localId: localService.id,
      name: localService.name,
      duration: localService.duration,
      price: String(localService.price),
      color: localService.color,
    };

    expect(dbShape.localId).toBe("svc-abc");
    expect(dbShape.price).toBe("25.5");
    expect(typeof dbShape.price).toBe("string");
    expect(dbShape.businessOwnerId).toBe(1);
  });

  it("should transform local client to DB create shape", () => {
    const localClient = {
      id: "cl-xyz",
      name: "John Doe",
      phone: "(555) 123-4567",
      email: "john@example.com",
      notes: "Regular customer",
      createdAt: new Date().toISOString(),
    };

    const dbShape = {
      businessOwnerId: 1,
      localId: localClient.id,
      name: localClient.name,
      phone: localClient.phone || undefined,
      email: localClient.email || undefined,
      notes: localClient.notes || undefined,
    };

    expect(dbShape.localId).toBe("cl-xyz");
    expect(dbShape.phone).toBe("(555) 123-4567");
    expect(dbShape.businessOwnerId).toBe(1);
  });

  it("should transform local appointment to DB create shape", () => {
    const localAppt = {
      id: "appt-1",
      serviceId: "svc-1",
      clientId: "cl-1",
      date: "2026-04-10",
      time: "09:00",
      duration: 60,
      status: "confirmed" as const,
      notes: "First visit",
      createdAt: new Date().toISOString(),
    };

    const dbShape = {
      businessOwnerId: 1,
      localId: localAppt.id,
      serviceLocalId: localAppt.serviceId,
      clientLocalId: localAppt.clientId,
      date: localAppt.date,
      time: localAppt.time,
      duration: localAppt.duration,
      status: localAppt.status,
      notes: localAppt.notes || undefined,
    };

    expect(dbShape.serviceLocalId).toBe("svc-1");
    expect(dbShape.clientLocalId).toBe("cl-1");
    expect(dbShape.status).toBe("confirmed");
  });

  it("should transform local product to DB create shape", () => {
    const localProduct = {
      id: "prod-1",
      name: "Shampoo",
      price: 12.99,
      description: "Premium shampoo",
      available: true,
      createdAt: new Date().toISOString(),
    };

    const dbShape = {
      businessOwnerId: 1,
      localId: localProduct.id,
      name: localProduct.name,
      price: String(localProduct.price),
      description: localProduct.description || undefined,
      available: localProduct.available,
    };

    expect(dbShape.price).toBe("12.99");
    expect(dbShape.available).toBe(true);
  });
});
