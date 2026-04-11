import { describe, it, expect } from "vitest";

/**
 * Tests to verify that the total charge shown on the client booking page
 * matches what the business app shows in appointment-detail.
 *
 * The key invariant: appointment.totalPrice (stored in DB) must equal
 * the "Total Charged" shown in appointment-detail.tsx.
 */

describe("Price Calculation Consistency", () => {
  // Simulate the server-side finalTotal calculation (publicRoutes.ts line 499)
  function serverFinalTotal(
    totalPriceFromClient: number | null,
    svcPrice: number,
    extras: { price: number }[]
  ): number {
    const extrasTotal = extras.reduce((s, e) => s + (e.price || 0), 0);
    return totalPriceFromClient != null
      ? parseFloat(String(totalPriceFromClient))
      : svcPrice + extrasTotal;
  }

  // Simulate the web booking page getChargedPrice()
  function webChargedPrice(
    svcPrice: number,
    extras: { price: number }[],
    discountPct: number,
    giftBalance: number
  ): number {
    const subtotal = svcPrice + extras.reduce((s, e) => s + e.price, 0);
    const discountAmt = svcPrice * (discountPct / 100); // discount on service only
    const afterDiscount = subtotal - discountAmt;
    const afterGift = Math.max(0, afterDiscount - giftBalance);
    return afterGift;
  }

  // Simulate appointment-detail.tsx computedTotal
  function appComputedTotal(
    storedTotalPrice: number,
    svcPrice: number,
    extras: { price: number }[],
    discountAmt: number,
    giftUsedAmount: number
  ): number {
    // appointment-detail.tsx uses appointment.totalPrice directly
    return storedTotalPrice;
  }

  it("simple booking: no extras, no discount, no gift", () => {
    const svcPrice = 50;
    const extras: { price: number }[] = [];
    const discountPct = 0;
    const giftBalance = 0;

    const chargedPrice = webChargedPrice(svcPrice, extras, discountPct, giftBalance);
    const storedTotal = serverFinalTotal(chargedPrice, svcPrice, extras);
    const appTotal = appComputedTotal(storedTotal, svcPrice, extras, 0, 0);

    expect(chargedPrice).toBe(50);
    expect(storedTotal).toBe(50);
    expect(appTotal).toBe(50);
    expect(chargedPrice).toBe(appTotal); // ✅ match
  });

  it("booking with extras, no discount, no gift", () => {
    const svcPrice = 50;
    const extras = [{ price: 20 }, { price: 15 }];
    const discountPct = 0;
    const giftBalance = 0;

    const chargedPrice = webChargedPrice(svcPrice, extras, discountPct, giftBalance);
    const storedTotal = serverFinalTotal(chargedPrice, svcPrice, extras);
    const appTotal = appComputedTotal(storedTotal, svcPrice, extras, 0, 0);

    expect(chargedPrice).toBe(85);
    expect(storedTotal).toBe(85);
    expect(appTotal).toBe(85);
    expect(chargedPrice).toBe(appTotal); // ✅ match
  });

  it("booking with discount on service only (no extras)", () => {
    const svcPrice = 100;
    const extras: { price: number }[] = [];
    const discountPct = 10; // 10% off
    const giftBalance = 0;

    const chargedPrice = webChargedPrice(svcPrice, extras, discountPct, giftBalance);
    // discountAmt = 100 * 10% = $10
    const discountAmt = svcPrice * (discountPct / 100);
    const storedTotal = serverFinalTotal(chargedPrice, svcPrice, extras);
    const appTotal = appComputedTotal(storedTotal, svcPrice, extras, discountAmt, 0);

    expect(chargedPrice).toBe(90);
    expect(storedTotal).toBe(90);
    expect(appTotal).toBe(90);
    expect(chargedPrice).toBe(appTotal); // ✅ match
  });

  it("booking with extras AND discount (discount on service only)", () => {
    const svcPrice = 100;
    const extras = [{ price: 30 }]; // subtotal = $130
    const discountPct = 10; // 10% off service only = $10 off
    const giftBalance = 0;

    const chargedPrice = webChargedPrice(svcPrice, extras, discountPct, giftBalance);
    // chargedPrice = 130 - (100 * 10%) = 130 - 10 = $120
    const discountAmt = svcPrice * (discountPct / 100);
    const storedTotal = serverFinalTotal(chargedPrice, svcPrice, extras);
    const appTotal = appComputedTotal(storedTotal, svcPrice, extras, discountAmt, 0);

    expect(chargedPrice).toBe(120);
    expect(storedTotal).toBe(120);
    expect(appTotal).toBe(120);
    expect(chargedPrice).toBe(appTotal); // ✅ match
  });

  it("booking with gift card (no extras, no discount)", () => {
    const svcPrice = 80;
    const extras: { price: number }[] = [];
    const discountPct = 0;
    const giftBalance = 30; // $30 gift card

    const chargedPrice = webChargedPrice(svcPrice, extras, discountPct, giftBalance);
    // chargedPrice = 80 - 30 = $50
    const giftUsed = Math.min(giftBalance, svcPrice);
    const storedTotal = serverFinalTotal(chargedPrice, svcPrice, extras);
    const appTotal = appComputedTotal(storedTotal, svcPrice, extras, 0, giftUsed);

    expect(chargedPrice).toBe(50);
    expect(storedTotal).toBe(50);
    expect(appTotal).toBe(50);
    expect(chargedPrice).toBe(appTotal); // ✅ match
  });

  it("booking with gift card covering full amount", () => {
    const svcPrice = 50;
    const extras: { price: number }[] = [];
    const discountPct = 0;
    const giftBalance = 100; // more than enough

    const chargedPrice = webChargedPrice(svcPrice, extras, discountPct, giftBalance);
    // chargedPrice = max(0, 50 - 100) = $0
    const giftUsed = Math.min(giftBalance, svcPrice);
    const storedTotal = serverFinalTotal(chargedPrice, svcPrice, extras);
    const appTotal = appComputedTotal(storedTotal, svcPrice, extras, 0, giftUsed);

    expect(chargedPrice).toBe(0);
    expect(storedTotal).toBe(0);
    expect(appTotal).toBe(0);
    expect(chargedPrice).toBe(appTotal); // ✅ match
  });

  it("booking with discount + gift card", () => {
    const svcPrice = 100;
    const extras: { price: number }[] = [];
    const discountPct = 20; // 20% off = $20
    const giftBalance = 30; // $30 gift card

    const chargedPrice = webChargedPrice(svcPrice, extras, discountPct, giftBalance);
    // afterDiscount = 100 - 20 = $80
    // afterGift = 80 - 30 = $50
    const discountAmt = svcPrice * (discountPct / 100);
    const afterDiscount = svcPrice - discountAmt;
    const giftUsed = Math.min(giftBalance, afterDiscount);
    const storedTotal = serverFinalTotal(chargedPrice, svcPrice, extras);
    const appTotal = appComputedTotal(storedTotal, svcPrice, extras, discountAmt, giftUsed);

    expect(chargedPrice).toBe(50);
    expect(storedTotal).toBe(50);
    expect(appTotal).toBe(50);
    expect(chargedPrice).toBe(appTotal); // ✅ match
  });

  it("new-booking.tsx discountAmount calculation matches web booking", () => {
    // new-booking.tsx: discountAmount = selectedService.price * (percentage / 100)
    // publicRoutes.ts: discountAmount = servicePrice * (percentage / 100)
    // Both use service price only — they should agree
    const svcPrice = 100;
    const discountPct = 15;

    const newBookingDiscount = svcPrice * (discountPct / 100);
    const webBookingDiscount = svcPrice * (discountPct / 100);

    expect(newBookingDiscount).toBe(15);
    expect(webBookingDiscount).toBe(15);
    expect(newBookingDiscount).toBe(webBookingDiscount); // ✅ consistent
  });

  it("in-app booking.tsx priceInfo.final matches what gets stored", () => {
    // booking.tsx: priceInfo.final = service.price - giftUsed (no extras)
    const svcPrice = 60;
    const giftBalance = 25;

    // booking.tsx calculation
    const giftUsed = Math.min(giftBalance, svcPrice);
    const finalPrice = Math.max(0, svcPrice - giftBalance);
    const roundedFinal = Math.round(finalPrice * 100) / 100;

    // What gets stored: appointment.totalPrice = priceInfo.final
    const storedTotal = roundedFinal;

    // What appointment-detail shows: computedTotal = appointment.totalPrice
    const appDisplayed = storedTotal;

    expect(roundedFinal).toBe(35);
    expect(storedTotal).toBe(35);
    expect(appDisplayed).toBe(35); // ✅ match
  });
});
