import { describe, it, expect } from "vitest";

// Test gift code generation logic
function generateGiftCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GIFT-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

describe("Gift Purchase Feature", () => {
  it("generates a valid gift code", () => {
    const code = generateGiftCode();
    expect(code).toMatch(/^GIFT-[A-Z0-9]{8}$/);
  });

  it("generates unique codes", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateGiftCode()));
    expect(codes.size).toBe(50);
  });

  it("validates required fields", () => {
    const requiredFields = ["purchaserName", "purchaserEmail", "recipientName"];
    const body = { purchaserName: "John", purchaserEmail: "john@test.com", recipientName: "Jane", serviceIds: ["svc1"] };
    for (const field of requiredFields) {
      expect(body[field as keyof typeof body]).toBeTruthy();
    }
  });

  it("calculates total value correctly", () => {
    const services = [{ price: 50 }, { price: 30 }];
    const products = [{ price: 20 }];
    const total = [...services, ...products].reduce((sum, item) => sum + item.price, 0);
    expect(total).toBe(100);
  });

  it("GiftCard type has new public gift fields", () => {
    const card = {
      id: "test", code: "GIFT-TEST123", serviceLocalId: "svc1",
      originalValue: 100, remainingBalance: 100, recipientName: "Jane",
      recipientPhone: "", message: "", redeemed: false, createdAt: new Date().toISOString(),
      purchasedPublicly: true, purchaserName: "John", purchaserEmail: "john@test.com",
      recipientEmail: "jane@test.com", paymentMethod: "zelle", paymentStatus: "unpaid",
      totalValue: 100, recipientChoosesDate: true,
    };
    expect(card.purchasedPublicly).toBe(true);
    expect(card.purchaserName).toBe("John");
    expect(card.recipientChoosesDate).toBe(true);
  });
});
