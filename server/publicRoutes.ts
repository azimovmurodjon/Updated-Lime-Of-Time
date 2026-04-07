import { Express, Request, Response } from "express";
import * as db from "./db";
import { sendBookingNotificationEmail } from "./email";
import { notifyOwner } from "./_core/notification";

// ─── Helper: Generate available time slots ──────────────────────────
const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

function generateAvailableSlots(
  date: string,
  duration: number,
  workingHours: any,
  appointments: any[],
  interval: number,
  customSchedule: any[],
  scheduleMode: "weekly" | "custom" = "weekly"
): string[] {
  const d = new Date(date + "T00:00:00");
  const dayIndex = d.getDay();
  const dayName = DAYS_OF_WEEK[dayIndex];

  const customDay = customSchedule.find((cs: any) => cs.date === date);
  let startMin: number, endMin: number;

  if (scheduleMode === "custom") {
    // Custom mode: only dates explicitly in customSchedule are available
    if (!customDay || !customDay.isOpen) return [];
    startMin = timeToMinutes(customDay.startTime || "09:00");
    endMin = timeToMinutes(customDay.endTime || "17:00");
  } else {
    // Weekly mode: use weekly hours, custom days can still override
    if (customDay) {
      if (!customDay.isOpen) return [];
      startMin = timeToMinutes(customDay.startTime || "09:00");
      endMin = timeToMinutes(customDay.endTime || "17:00");
    } else {
      const wh = workingHours?.[dayName] || workingHours?.[dayName.toLowerCase()];
      if (!wh || !wh.enabled) return [];
      startMin = timeToMinutes(wh.start || "09:00");
      endMin = timeToMinutes(wh.end || "17:00");
    }
  }

  // Get confirmed/pending appointments for this date
  const bookedSlots = appointments
    .filter((a: any) => a.date === date && (a.status === "confirmed" || a.status === "pending"))
    .map((a: any) => ({
      start: timeToMinutes(a.time),
      end: timeToMinutes(a.time) + (a.duration || 60),
    }));

  const slots: string[] = [];
  const now = new Date();
  const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let t = startMin; t + duration <= endMin; t += interval) {
    // Skip past times for today
    if (date === today && t <= currentMinutes) continue;

    // Check for conflicts
    const slotEnd = t + duration;
    const conflict = bookedSlots.some(
      (b: any) => t < b.end && slotEnd > b.start
    );
    if (!conflict) {
      slots.push(minutesToTime(t));
    }
  }
  return slots;
}

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// ─── Register Public Routes ─────────────────────────────────────────

export function registerPublicRoutes(app: Express) {
  // ── Public REST API endpoints ──────────────────────────────────────

  /** Get business info by slug */
  app.get("/api/public/business/:slug", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).json({ error: "Business not found" });
        return;
      }
      res.json({
        id: owner.id,
        businessName: owner.businessName,
        ownerName: owner.ownerName,
        email: owner.email,
        address: owner.address,
        website: owner.website,
        description: owner.description,
        phone: owner.phone,
        temporaryClosed: owner.temporaryClosed,
        workingHours: owner.workingHours,
        cancellationPolicy: owner.cancellationPolicy,
        businessLogoUri: owner.businessLogoUri,
      });
    } catch (err) {
      console.error("[Public API] Error fetching business:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Get services for a business */
  app.get("/api/public/business/:slug/services", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).json({ error: "Business not found" });
        return;
      }
      const servicesList = await db.getServicesByOwner(owner.id);
      res.json(servicesList.map((s) => ({
        localId: s.localId,
        name: s.name,
        duration: s.duration,
        price: s.price,
        color: s.color,
      })));
    } catch (err) {
      console.error("[Public API] Error fetching services:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Get available time slots for a date */
  app.get("/api/public/business/:slug/slots", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).json({ error: "Business not found" });
        return;
      }
      const date = req.query.date as string;
      const duration = parseInt(req.query.duration as string) || 60;
      if (!date) {
        res.status(400).json({ error: "date query parameter is required" });
        return;
      }
      const appts = await db.getAppointmentsByOwner(owner.id);
      const schedule = await db.getCustomScheduleByOwner(owner.id);
      const mode = (owner.scheduleMode as "weekly" | "custom") || "weekly";
      const slots = generateAvailableSlots(
        date,
        duration,
        owner.workingHours,
        appts,
        30,
        schedule,
        mode
      );
      res.json({ date, slots });
    } catch (err) {
      console.error("[Public API] Error fetching slots:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Get discounts for a business */
  app.get("/api/public/business/:slug/discounts", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).json({ error: "Business not found" });
        return;
      }
      const discountsList = await db.getDiscountsByOwner(owner.id);
      res.json(discountsList.filter((d) => d.active).map((d) => ({
        localId: d.localId,
        name: d.name,
        percentage: d.percentage,
        startTime: d.startTime,
        endTime: d.endTime,
        dates: d.dates,
        serviceIds: d.serviceIds,
      })));
    } catch (err) {
      console.error("[Public API] Error fetching discounts:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Get reviews for a business */
  app.get("/api/public/business/:slug/reviews", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).json({ error: "Business not found" });
        return;
      }
      const reviewsList = await db.getReviewsByOwner(owner.id);
      const clientsList = await db.getClientsByOwner(owner.id);
      res.json(reviewsList.map((r) => {
        const client = clientsList.find((c) => c.localId === r.clientLocalId);
        return {
          rating: r.rating,
          comment: r.comment,
          clientName: client?.name || "Anonymous",
          createdAt: r.createdAt,
        };
      }));
    } catch (err) {
      console.error("[Public API] Error fetching reviews:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Get products for a business */
  app.get("/api/public/business/:slug/products", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) { res.status(404).json({ error: "Business not found" }); return; }
      const productsList = await db.getProductsByOwner(owner.id);
      res.json(productsList.filter((p) => p.available).map((p) => ({
        localId: p.localId,
        name: p.name,
        price: p.price,
        description: p.description,
      })));
    } catch (err) {
      console.error("[Public API] Error fetching products:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Get working days info for calendar */
  app.get("/api/public/business/:slug/working-days", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) { res.status(404).json({ error: "Business not found" }); return; }
      const schedule = await db.getCustomScheduleByOwner(owner.id);
      const wh: Record<string, any> = owner.workingHours || {};
      // Build weekly working days
      const weeklyDays: Record<string, boolean> = {};
      DAYS_OF_WEEK.forEach((day) => {
        const entry = wh[day] || wh[day.toLowerCase()];
        weeklyDays[day] = !!(entry && entry.enabled);
      });
      // Custom overrides: { date: isOpen }
      const customDays: Record<string, boolean> = {};
      schedule.forEach((cs: any) => {
        customDays[cs.date] = cs.isOpen ?? true;
      });
      const scheduleMode = (owner.scheduleMode as string) || "weekly";
      res.json({ weeklyDays, customDays, scheduleMode });
    } catch (err) {
      console.error("[Public API] Error fetching working days:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Get gift card by code */
  app.get("/api/public/gift/:code", async (req: Request, res: Response) => {
    try {
      // Search across all business owners for this gift code
      const dbase = await db.getDb();
      if (!dbase) {
        res.status(500).json({ error: "Database not available" });
        return;
      }
      const { giftCards, businessOwners, services } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const cards = await dbase.select().from(giftCards).where(eq(giftCards.code, req.params.code));
      if (cards.length === 0) {
        res.status(404).json({ error: "Gift card not found" });
        return;
      }
      const card = cards[0];
      const owner = await db.getBusinessOwnerById(card.businessOwnerId);
      const svcList = await db.getServicesByOwner(card.businessOwnerId);
      const prodList = await db.getProductsByOwner(card.businessOwnerId);
      const svc = svcList.find((s) => s.localId === card.serviceLocalId);

      // Parse extended data from message field
      let serviceIds: string[] = [];
      let productIds: string[] = [];
      let originalValue = 0;
      let remainingBalance = 0;
      const rawMsg = card.message ?? "";
      const jsonMatch = rawMsg.match(/\n---GIFT_DATA---\n(.+)$/s);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          serviceIds = data.serviceIds ?? [];
          productIds = data.productIds ?? [];
          originalValue = data.originalValue ?? 0;
          remainingBalance = data.remainingBalance ?? originalValue;
        } catch {}
      }
      // If no extended data, fall back to single service
      if (serviceIds.length === 0 && card.serviceLocalId) {
        serviceIds = [card.serviceLocalId];
        if (svc) {
          originalValue = parseFloat(String(svc.price));
          remainingBalance = card.redeemed ? 0 : originalValue;
        }
      }
      const cleanMessage = rawMsg.replace(/\n---GIFT_DATA---\n.+$/s, "");

      // Build items list for the client
      const giftItems: { localId: string; name: string; price: number; type: string }[] = [];
      for (const sid of serviceIds) {
        const s = svcList.find((sv) => sv.localId === sid);
        if (s) giftItems.push({ localId: s.localId, name: s.name, price: parseFloat(String(s.price)), type: "service" });
      }
      for (const pid of productIds) {
        const p = prodList.find((pr) => pr.localId === pid);
        if (p) giftItems.push({ localId: p.localId, name: p.name, price: parseFloat(String(p.price)), type: "product" });
      }

      res.json({
        code: card.code,
        redeemed: card.redeemed,
        expiresAt: card.expiresAt,
        recipientName: card.recipientName,
        message: cleanMessage,
        serviceName: svc?.name || "Service",
        servicePrice: svc?.price || "0",
        serviceDuration: svc?.duration || 60,
        serviceLocalId: card.serviceLocalId,
        businessName: owner?.businessName || "Business",
        businessSlug: owner?.businessName.toLowerCase().replace(/\s+/g, "-") || "",
        // Balance-based gift card fields
        originalValue,
        remainingBalance,
        serviceIds,
        productIds,
        items: giftItems,
      });
    } catch (err) {
      console.error("[Public API] Error fetching gift card:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Submit a booking (create client + appointment) */
  app.post("/api/public/business/:slug/book", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).json({ error: "Business not found" });
        return;
      }
      if (owner.temporaryClosed) {
        res.status(400).json({ error: "Business is temporarily closed" });
        return;
      }

      const { clientName, clientPhone, clientEmail, serviceLocalId, date, time, duration, notes, giftCode, totalPrice, extraItems, giftApplied, giftUsedAmount } = req.body;

      if (!clientName || !serviceLocalId || !date || !time) {
        res.status(400).json({ error: "Missing required fields: clientName, serviceLocalId, date, time" });
        return;
      }

      // Normalize phone for consistent matching
      let clientLocalId: string;
      const rawDigits = (clientPhone || "").replace(/\D/g, "");
      const normalizedPhone = rawDigits.length === 11 && rawDigits.startsWith("1") ? rawDigits.slice(1) : rawDigits;
      if (normalizedPhone.length >= 10) {
        const existingClient = await db.getClientByPhone(normalizedPhone, owner.id);
        if (existingClient) {
          clientLocalId = existingClient.localId;
          // Update client name if different
          if (existingClient.name !== clientName) {
            await db.updateClient(existingClient.localId, owner.id, { name: clientName, email: clientEmail || undefined });
          }
        } else {
          clientLocalId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          await db.createClient({
            businessOwnerId: owner.id,
            localId: clientLocalId,
            name: clientName,
            phone: normalizedPhone,
            email: clientEmail || null,
            notes: "Added via web booking",
          });
        }
      } else {
        clientLocalId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await db.createClient({
          businessOwnerId: owner.id,
          localId: clientLocalId,
          name: clientName,
          phone: normalizedPhone || null,
          email: clientEmail || null,
          notes: "Added via web booking",
        });
      }

      // Verify the time slot is still available
      const appts = await db.getAppointmentsByOwner(owner.id);
      const schedule = await db.getCustomScheduleByOwner(owner.id);
      const svcList = await db.getServicesByOwner(owner.id);
      const svc = svcList.find((s) => s.localId === serviceLocalId);
      const dur = duration || svc?.duration || 60;

      const bookMode = (owner.scheduleMode as "weekly" | "custom") || "weekly";
      const slots = generateAvailableSlots(date, dur, owner.workingHours, appts, 30, schedule, bookMode);
      if (!slots.includes(time)) {
        res.status(400).json({ error: "Selected time slot is no longer available" });
        return;
      }

      // Build enriched notes with pricing details
      let enrichedNotes = notes || "";
      const svcPrice = svc ? parseFloat(String(svc.price)) : 0;
      const extras: { name: string; price: number; type: string }[] = Array.isArray(extraItems) ? extraItems : [];
      const extrasTotal = extras.reduce((s: number, e: { price: number }) => s + (e.price || 0), 0);
      const finalTotal = totalPrice != null ? parseFloat(String(totalPrice)) : svcPrice + extrasTotal;

      if (extras.length > 0 || giftApplied) {
        const pricingLines: string[] = [];
        pricingLines.push(`Service: ${svc?.name ?? "Service"} — $${svcPrice.toFixed(2)}`);
        extras.forEach((e: { name: string; price: number; type: string }) => {
          pricingLines.push(`${e.type === "product" ? "Product" : "Extra"}: ${e.name} — $${(e.price || 0).toFixed(2)}`);
        });
        if (giftApplied) {
          const giftAmt = giftUsedAmount ? parseFloat(String(giftUsedAmount)) : svcPrice;
          pricingLines.push(`Gift Card: -$${giftAmt.toFixed(2)}`);
        }
        pricingLines.push(`Total Charged: $${finalTotal.toFixed(2)}`);
        enrichedNotes = (enrichedNotes ? enrichedNotes + "\n" : "") + "--- Pricing ---\n" + pricingLines.join("\n");
      }

      // Create appointment
      const appointmentLocalId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await db.createAppointment({
        businessOwnerId: owner.id,
        localId: appointmentLocalId,
        serviceLocalId,
        clientLocalId,
        date,
        time,
        duration: dur,
        status: "pending",
        notes: enrichedNotes || null,
      });

      // Deduct from gift card balance
      if (giftCode) {
        const card = await db.getGiftCardByCode(giftCode, owner.id);
        if (card) {
          // Parse existing balance from message field (may contain GIFT_DATA block)
          let meta: any = {};
          const msgStr = card.message || "";
          const giftDataMatch = msgStr.match(/\n---GIFT_DATA---\n(.+)$/s);
          if (giftDataMatch) {
            try { meta = JSON.parse(giftDataMatch[1]); } catch (_) {}
          } else {
            try { meta = JSON.parse(msgStr); } catch (_) {}
          }
          const svcPriceNum = svc ? parseFloat(String(svc.price)) : 0;
          const currentBalance = meta.remainingBalance ?? meta.originalValue ?? svcPriceNum;
          const usedAmt = giftUsedAmount ? parseFloat(String(giftUsedAmount)) : Math.min(currentBalance, svcPrice + extrasTotal);
          const newBalance = Math.max(0, currentBalance - usedAmt);
          const fullyRedeemed = newBalance <= 0;
          meta.remainingBalance = newBalance;
          // Preserve the GIFT_DATA format: clean message + separator + JSON
          const cleanMsg = msgStr.replace(/\n---GIFT_DATA---\n.+$/s, "");
          const updatedMsg = cleanMsg + "\n---GIFT_DATA---\n" + JSON.stringify(meta);
          await db.updateGiftCard(card.localId, owner.id, {
            redeemed: fullyRedeemed,
            redeemedAt: fullyRedeemed ? new Date() : undefined,
            message: updatedMsg,
          });
        }
      }

      // Send branded email notification via Resend
      if (owner.email) {
        try {
          await sendBookingNotificationEmail(owner.email, owner.businessName, {
            clientName,
            clientPhone: clientPhone || undefined,
            serviceName: svc?.name ?? "Service",
            date,
            time,
            duration: dur,
            totalPrice: finalTotal,
            extras: extras.length > 0 ? extras : undefined,
            giftApplied: !!giftApplied,
            giftUsedAmount: giftUsedAmount ? parseFloat(String(giftUsedAmount)) : undefined,
            notes: enrichedNotes || undefined,
          });
        } catch (emailErr) {
          console.warn("[Public API] Failed to send email notification:", emailErr);
        }
      }

      // Send push notification to business owner's device
      try {
        const extrasLabel = extras.length > 0 ? ` + ${extras.length} extra item${extras.length > 1 ? "s" : ""}` : "";
        await notifyOwner({
          title: `New Booking Request`,
          content: `${clientName} requested ${svc?.name ?? "a service"}${extrasLabel} on ${date} at ${time} — $${finalTotal.toFixed(2)}`,
        });
      } catch (pushErr) {
        console.warn("[Public API] Failed to send push notification:", pushErr);
      }

      res.json({
        success: true,
        appointmentId: appointmentLocalId,
        message: "Appointment request submitted! The business will confirm your booking.",
      });
    } catch (err) {
      console.error("[Public API] Error creating booking:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Submit a review */
  app.post("/api/public/business/:slug/review", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).json({ error: "Business not found" });
        return;
      }

      const { clientName, clientPhone, rating, comment } = req.body;
      if (!clientName || !rating) {
        res.status(400).json({ error: "Missing required fields: clientName, rating" });
        return;
      }

      // Normalize phone for consistent matching
      let clientLocalId: string;
      const rawReviewDigits = (clientPhone || "").replace(/\D/g, "");
      const normalizedReviewPhone = rawReviewDigits.length === 11 && rawReviewDigits.startsWith("1") ? rawReviewDigits.slice(1) : rawReviewDigits;
      if (normalizedReviewPhone.length >= 10) {
        const existingClient = await db.getClientByPhone(normalizedReviewPhone, owner.id);
        if (existingClient) {
          clientLocalId = existingClient.localId;
          // Update client name if different
          if (existingClient.name !== clientName) {
            await db.updateClient(existingClient.localId, owner.id, { name: clientName });
          }
        } else {
          clientLocalId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          await db.createClient({
            businessOwnerId: owner.id,
            localId: clientLocalId,
            name: clientName,
            phone: normalizedReviewPhone,
          });
        }
      } else {
        clientLocalId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await db.createClient({
          businessOwnerId: owner.id,
          localId: clientLocalId,
          name: clientName,
        });
      }

      const reviewLocalId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await db.createReview({
        businessOwnerId: owner.id,
        localId: reviewLocalId,
        clientLocalId,
        rating: Math.min(5, Math.max(1, parseInt(rating))),
        comment: comment || null,
      });

      res.json({ success: true, message: "Thank you for your review!" });
    } catch (err) {
      console.error("[Public API] Error creating review:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── HTML Pages ─────────────────────────────────────────────────────

  /** Booking page */
  app.get("/api/book/:slug", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).send(notFoundPage("Business not found"));
        return;
      }
      res.send(bookingPage(req.params.slug, owner));
    } catch (err) {
      console.error("[Public] Error serving booking page:", err);
      res.status(500).send(errorPage());
    }
  });

  /** Review page */
  app.get("/api/review/:slug", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).send(notFoundPage("Business not found"));
        return;
      }
      res.send(reviewPage(req.params.slug, owner));
    } catch (err) {
      console.error("[Public] Error serving review page:", err);
      res.status(500).send(errorPage());
    }
  });

  /** Gift card page */
  app.get("/api/gift/:code", async (req: Request, res: Response) => {
    res.send(giftCardPage(req.params.code));
  });

  /** Homepage */
  app.get("/api/home", (_req: Request, res: Response) => {
    res.send(homePage());
  });
}

// ─── HTML Templates ─────────────────────────────────────────────────

function baseStyles(): string {
  return `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: #f5f7f5;
        color: #1a1a1a;
        min-height: 100vh;
      }
      .container {
        max-width: 480px;
        margin: 0 auto;
        padding: 20px 16px;
        min-height: 100vh;
      }
      .header {
        text-align: center;
        padding: 24px 0 16px;
      }
      .header h1 {
        font-size: 22px;
        font-weight: 700;
        color: #2d5a27;
        margin-bottom: 4px;
      }
      .header .subtitle {
        font-size: 12px;
        color: #8a8a8a;
      }
      .card {
        background: #fff;
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 16px;
        border: 1px solid #e8ece8;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      }
      .card h2 {
        font-size: 16px;
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 12px;
      }
      .biz-info { display: flex; flex-direction: column; gap: 6px; }
      .biz-info-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666; }
      .biz-info-row a { color: #4a8c3f; text-decoration: underline; }
      .btn {
        display: block;
        width: 100%;
        padding: 14px;
        border: none;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        transition: opacity 0.15s, transform 0.1s;
      }
      .btn:active { opacity: 0.85; transform: scale(0.98); }
      .btn-primary { background: #4a8c3f; color: #fff; }
      .btn-primary:disabled { background: #b8d4b3; cursor: not-allowed; }
      .btn-secondary { background: #e8f0e6; color: #2d5a27; }
      .input-group { margin-bottom: 14px; }
      .input-group label {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: #555;
        margin-bottom: 6px;
      }
      .input-group input, .input-group textarea {
        width: 100%;
        padding: 12px 14px;
        border: 1.5px solid #dde3dd;
        border-radius: 10px;
        font-size: 15px;
        background: #fafcfa;
        outline: none;
        transition: border-color 0.2s;
        font-family: inherit;
      }
      .input-group input:focus, .input-group textarea:focus {
        border-color: #4a8c3f;
      }
      .input-group textarea { resize: vertical; min-height: 80px; }
      .service-list { display: flex; flex-direction: column; gap: 8px; }
      .service-item {
        display: flex;
        align-items: center;
        padding: 14px;
        border: 2px solid #e8ece8;
        border-radius: 12px;
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s;
      }
      .service-item:hover { background: #f8fbf8; }
      .service-item.selected { border-color: #4a8c3f; background: #f0f7ef; }
      .service-dot {
        width: 12px; height: 12px;
        border-radius: 50%;
        margin-right: 12px;
        flex-shrink: 0;
      }
      .service-info { flex: 1; }
      .service-name { font-size: 15px; font-weight: 600; color: #1a1a1a; }
      .service-meta { font-size: 12px; color: #888; margin-top: 2px; }
      .service-price { font-size: 15px; font-weight: 700; color: #2d5a27; }
      .date-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
        margin-bottom: 16px;
      }
      .date-cell {
        aspect-ratio: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        border: 2px solid transparent;
        transition: all 0.15s;
      }
      .date-cell:hover:not(.disabled) { background: #f0f7ef; }
      .date-cell.selected { border-color: #4a8c3f; background: #e8f5e3; color: #2d5a27; }
      .date-cell.disabled { opacity: 0.3; cursor: not-allowed; }
      .date-cell .day-name { font-size: 10px; color: #999; font-weight: 400; }
      .date-cell .day-num { font-size: 15px; }
      .time-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .time-slot {
        padding: 10px;
        text-align: center;
        border: 2px solid #e8ece8;
        border-radius: 10px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.15s;
      }
      .time-slot:hover { background: #f0f7ef; }
      .time-slot.selected { border-color: #4a8c3f; background: #e8f5e3; color: #2d5a27; }
      .confirm-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #f0f0f0;
        font-size: 14px;
      }
      .confirm-row:last-child { border-bottom: none; }
      .confirm-label { color: #888; }
      .confirm-value { font-weight: 600; color: #1a1a1a; }
      .success-icon {
        width: 64px; height: 64px;
        border-radius: 50%;
        background: #e8f5e3;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        font-size: 32px;
      }
      .step-indicator {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-bottom: 20px;
      }
      .step-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #dde3dd;
        transition: background 0.2s;
      }
      .step-dot.active { background: #4a8c3f; }
      .step-dot.done { background: #8cc084; }
      .closed-banner {
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 12px;
        padding: 16px;
        text-align: center;
        color: #dc2626;
        font-weight: 500;
        margin-bottom: 16px;
      }
      .discount-badge {
        display: inline-block;
        background: #fef3c7;
        color: #92400e;
        font-size: 12px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 6px;
        margin-left: 8px;
      }
      .stars { display: flex; gap: 4px; }
      .star {
        width: 36px; height: 36px;
        cursor: pointer;
        font-size: 28px;
        transition: transform 0.1s;
      }
      .star:hover { transform: scale(1.15); }
      .review-card {
        padding: 14px;
        border-bottom: 1px solid #f0f0f0;
      }
      .review-card:last-child { border-bottom: none; }
      .review-stars { color: #f59e0b; font-size: 14px; }
      .review-name { font-weight: 600; font-size: 14px; margin-top: 4px; }
      .review-comment { font-size: 13px; color: #666; margin-top: 4px; }
      .review-date { font-size: 11px; color: #aaa; margin-top: 4px; }
      .loading { text-align: center; padding: 40px; color: #888; }
      .error-msg { color: #dc2626; font-size: 13px; margin-top: 8px; text-align: center; }
      .cal-nav { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
      .cal-nav button { background:none; border:1px solid #dde3dd; border-radius:8px; padding:6px 12px; cursor:pointer; font-size:14px; color:#2d5a27; }
      .cal-nav button:hover { background:#f0f7ef; }
      .cal-nav .cal-title { font-size:16px; font-weight:700; color:#1a1a1a; }
      .cal-weekdays { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:4px; text-align:center; }
      .cal-weekdays span { font-size:11px; color:#999; font-weight:500; padding:4px 0; }
      .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:16px; }
      .cal-day { aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:10px; cursor:pointer; font-size:14px; font-weight:500; border:2px solid transparent; transition:all 0.15s; position:relative; }
      .cal-day .avail-dot { width:5px; height:5px; border-radius:50%; background:#4a8c3f; margin-top:2px; }
      .cal-day.disabled .avail-dot { display:none; }
      .cal-day:hover:not(.disabled):not(.empty) { background:#f0f7ef; }
      .cal-day.selected { border-color:#4a8c3f; background:#e8f5e3; color:#2d5a27; font-weight:700; }
      .cal-day.disabled { opacity:0.25; cursor:not-allowed; color:#aaa; }
      .cal-day.empty { cursor:default; }
      .cal-day.today { font-weight:700; color:#4a8c3f; }
      .cart-items { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
      .cart-item { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:#f8fbf8; border-radius:10px; font-size:13px; }
      .cart-item .cart-remove { color:#dc2626; cursor:pointer; font-size:18px; padding:0 4px; }
      .cart-total { display:flex; justify-content:space-between; padding:10px 0; border-top:2px solid #e8ece8; font-size:15px; font-weight:700; }
      .product-item { display:flex; align-items:center; padding:12px; border:2px solid #e8ece8; border-radius:12px; cursor:pointer; transition:border-color 0.2s, background 0.2s; margin-bottom:6px; }
      .product-item:hover { background:#f8fbf8; }
      .product-item.selected { border-color:#4a8c3f; background:#f0f7ef; }
      .seg-control { display:flex; background:#f0f0f0; border-radius:10px; padding:3px; margin-bottom:12px; }
      .seg-btn { flex:1; text-align:center; padding:8px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.15s; color:#666; }
      .seg-btn.active { background:#fff; color:#2d5a27; box-shadow:0 1px 3px rgba(0,0,0,0.1); }
      .receipt-box { background:#fff; border:1px solid #e8ece8; border-radius:12px; padding:20px; }
      @media (max-width: 360px) {
        .time-grid { grid-template-columns: repeat(2, 1fr); }
      }
    </style>
  `;
}

function homePage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lime Of Time - Smart Scheduling</title>
  ${baseStyles()}
</head>
<body>
  <div class="container" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
    <div style="font-size:64px;margin-bottom:16px;">🍋</div>
    <h1 style="font-size:28px;color:#2d5a27;margin-bottom:8px;">Lime Of Time</h1>
    <p style="color:#666;font-size:16px;margin-bottom:32px;">Smart scheduling for your business</p>
    <p style="color:#999;font-size:14px;">Download the app on Google Play to get started.</p>
  </div>
</body>
</html>`;
}

function notFoundPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Found - Lime Of Time</title>
  ${baseStyles()}
</head>
<body>
  <div class="container" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
    <div style="font-size:48px;margin-bottom:16px;">😕</div>
    <h1 style="font-size:22px;color:#1a1a1a;margin-bottom:8px;">${message}</h1>
    <p style="color:#888;font-size:14px;">The page you're looking for doesn't exist or the business link may be incorrect.</p>
  </div>
</body>
</html>`;
}

function errorPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - Lime Of Time</title>
  ${baseStyles()}
</head>
<body>
  <div class="container" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
    <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
    <h1 style="font-size:22px;color:#1a1a1a;margin-bottom:8px;">Something went wrong</h1>
    <p style="color:#888;font-size:14px;">Please try again later.</p>
  </div>
</body>
</html>`;
}

function bookingPage(slug: string, owner: any): string {
  const wh: Record<string, any> = owner.workingHours || {};
  const whJson: Record<string, boolean> = {};
  ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].forEach(d => {
    const entry = wh[d] || wh[d.toLowerCase()];
    whJson[d] = !!(entry && entry.enabled);
  });
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Book with ${escHtml(owner.businessName)} - Lime Of Time</title>
  <meta name="description" content="Book an appointment with ${escHtml(owner.businessName)}">
  ${baseStyles()}
</head>
<body>
  <div class="container" id="app">
    <div class="header">
      <h1>Book with ${escHtml(owner.businessName)}</h1>
      <div class="subtitle">Powered by Lime Of Time</div>
    </div>

    <div id="step-indicator" class="step-indicator">
      <div class="step-dot active" id="dot-0"></div>
      <div class="step-dot" id="dot-1"></div>
      <div class="step-dot" id="dot-2"></div>
      <div class="step-dot" id="dot-3"></div>
      <div class="step-dot" id="dot-4"></div>
    </div>

    <!-- Business Info Card -->
    <div class="card biz-info" id="biz-card">
      <div style="font-size:16px;font-weight:700;color:#1a1a1a;">${escHtml(owner.businessName)}</div>
      ${owner.address ? `<div class="biz-info-row"><span>📍</span><a href="https://maps.google.com/?q=${encodeURIComponent(owner.address)}" target="_blank">${escHtml(owner.address)}</a></div>` : ""}
      ${owner.phone ? `<div class="biz-info-row"><span>📞</span><span>${escHtml(formatPhoneNumber(owner.phone))}</span></div>` : ""}
      ${owner.email ? `<div class="biz-info-row"><span>✉️</span><span>${escHtml(owner.email)}</span></div>` : ""}
      ${owner.description ? `<div style="font-size:13px;color:#888;margin-top:6px;">${escHtml(owner.description)}</div>` : ""}
    </div>

    ${owner.temporaryClosed ? `<div class="closed-banner">⚠️ This business is temporarily closed and not accepting bookings at this time.</div>` : ""}

    <!-- Step 0: Client Info -->
    <div id="step-0" class="card" ${owner.temporaryClosed ? 'style="display:none"' : ""}>
      <h2>Your Information</h2>
      <div class="input-group">
        <label>Name *</label>
        <input type="text" id="clientName" placeholder="Your full name" required>
      </div>
      <div class="input-group">
        <label>Phone Number</label>
        <input type="tel" id="clientPhone" placeholder="(000) 000-0000">
      </div>
      <div class="input-group">
        <label>Email</label>
        <input type="email" id="clientEmail" placeholder="your@email.com">
      </div>
      <div class="input-group">
        <label>Gift Code (optional)</label>
        <div style="display:flex;gap:8px;">
          <input type="text" id="giftCode" placeholder="GIFT-XXXX" style="flex:1">
          <button class="btn btn-secondary" style="width:auto;padding:12px 16px;font-size:14px;" onclick="applyGiftCode()">Apply</button>
        </div>
        <div id="giftMsg" style="font-size:12px;margin-top:4px;"></div>
      </div>
      <button class="btn btn-primary" onclick="goToStep(1)">Continue</button>
    </div>

    <!-- Step 1: Select Service -->
    <div id="step-1" class="card" style="display:none">
      <h2>Select a Service</h2>
      <div id="serviceList" class="service-list">
        <div class="loading">Loading services...</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-secondary" onclick="goToStep(0)" style="flex:1">Back</button>
        <button class="btn btn-primary" onclick="goToStep(2)" id="btnToDate" disabled style="flex:1">Continue</button>
      </div>
    </div>

    <!-- Step 2: Select Date & Time (Monthly Calendar) -->
    <div id="step-2" class="card" style="display:none">
      <h2>Select Date & Time</h2>
      <div class="cal-nav">
        <button onclick="changeMonth(-1)" id="calPrev">&larr;</button>
        <span class="cal-title" id="calTitle"></span>
        <button onclick="changeMonth(1)">&rarr;</button>
      </div>
      <div class="cal-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
      <div id="calGrid" class="cal-grid"></div>
      <div id="timeSection" style="display:none">
        <h2 style="margin-bottom:12px;">Available Times</h2>
        <div id="timeGrid" class="time-grid"></div>
        <div id="noSlots" style="display:none;text-align:center;color:#888;padding:20px;font-size:14px;">No available time slots for this date.</div>
      </div>
      <div id="discountInfo" style="display:none;margin-top:12px;"></div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-secondary" onclick="goToStep(1)" style="flex:1">Back</button>
        <button class="btn btn-primary" onclick="goToStep(3)" id="btnToConfirm" disabled style="flex:1">Continue</button>
      </div>
    </div>

    <!-- Step 3: Add More Services/Products -->
    <div id="step-3" class="card" style="display:none">
      <h2>Add More (Optional)</h2>
      <p style="font-size:13px;color:#888;margin-bottom:12px;">Add extra services or products to your booking.</p>
      <div id="cartSummary" class="cart-items"></div>
      <div class="seg-control" id="addMoreSeg">
        <div class="seg-btn active" onclick="switchAddTab('services')">Services</div>
        <div class="seg-btn" onclick="switchAddTab('products')">Products</div>
      </div>
      <div id="addServiceList" class="service-list"></div>
      <div id="addProductList" style="display:none"></div>
      <div id="cartTotal" class="cart-total" style="display:none"></div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-secondary" onclick="goToStep(2)" style="flex:1">Back</button>
        <button class="btn btn-primary" onclick="goToStep(4)" style="flex:1">Continue to Confirm</button>
      </div>
    </div>

    <!-- Step 4: Confirm -->
    <div id="step-4" class="card" style="display:none">
      <h2>Confirm Booking</h2>
      <div id="confirmDetails"></div>
      <div class="input-group" style="margin-top:12px;">
        <label>Notes (optional)</label>
        <textarea id="bookingNotes" placeholder="Any special requests..."></textarea>
      </div>
      <div style="margin-top:12px;">
        <button class="btn btn-secondary" onclick="goToStep(3)" style="width:100%;margin-bottom:8px;font-size:13px;">+ Add More Services / Products</button>
      </div>
      <div id="bookError" class="error-msg" style="display:none"></div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn btn-secondary" onclick="goToStep(2)" style="flex:1">Back</button>
        <button class="btn btn-primary" onclick="submitBooking()" id="btnSubmit" style="flex:1">Confirm Booking</button>
      </div>
    </div>

    <!-- Step 5: Success -->
    <div id="step-5" class="card" style="display:none;text-align:center;">
      <div class="success-icon">✓</div>
      <h2 style="font-size:20px;margin-bottom:8px;">Booking Submitted!</h2>
      <p style="color:#666;font-size:14px;margin-bottom:16px;">Your appointment request has been sent to ${escHtml(owner.businessName)}. They will confirm your booking shortly.</p>
      <div id="successReceipt" class="receipt-box" style="text-align:left;margin-bottom:16px;"></div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary" onclick="saveReceipt()" style="flex:1">📥 Save Receipt</button>
        <button class="btn btn-primary" onclick="location.reload()" style="flex:1">Book Another</button>
      </div>
    </div>
  </div>

  <script>
    const SLUG = "${slug}";
    const API = window.location.origin + "/api/public/business/" + SLUG;
    const WEEKLY_DAYS = ${JSON.stringify(whJson)};
    const DAYS_MAP = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    let services = [];
    let products = [];
    let discounts = [];
    let customDays = {};
    let selectedService = null;
    let selectedDate = null;
    let selectedTime = null;
    let appliedGift = null;
    let currentStep = 0;
    let calMonth, calYear;
    // Cart: extra items added via "Add More"
    let cart = []; // { type: 'service'|'product', id, name, price, duration }

    // Init calendar to current month
    const nowDate = new Date();
    calMonth = nowDate.getMonth();
    calYear = nowDate.getFullYear();

    // Format phone as user types
    document.getElementById("clientPhone").addEventListener("input", function(e) {
      let v = e.target.value.replace(/\\D/g, "");
      if (v.length > 10) v = v.slice(0, 10);
      if (v.length >= 7) e.target.value = "(" + v.slice(0,3) + ") " + v.slice(3,6) + "-" + v.slice(6);
      else if (v.length >= 4) e.target.value = "(" + v.slice(0,3) + ") " + v.slice(3);
      else if (v.length > 0) e.target.value = "(" + v;
      else e.target.value = "";
    });

    // Load services
    async function loadServices() {
      try {
        const res = await fetch(API + "/services");
        services = await res.json();
        renderServices();
      } catch(e) {
        document.getElementById("serviceList").innerHTML = '<div class="error-msg">Failed to load services</div>';
      }
    }

    // Load products
    async function loadProducts() {
      try {
        const res = await fetch(API + "/products");
        products = await res.json();
      } catch(e) { products = []; }
    }

    // Load discounts
    async function loadDiscounts() {
      try {
        const res = await fetch(API + "/discounts");
        discounts = await res.json();
      } catch(e) { discounts = []; }
    }

    // Load working days (custom overrides + schedule mode)
    var scheduleMode = "weekly";
    async function loadWorkingDays() {
      try {
        const res = await fetch(API + "/working-days");
        const data = await res.json();
        customDays = data.customDays || {};
        scheduleMode = data.scheduleMode || "weekly";
      } catch(e) { customDays = {}; }
    }

    function isWorkingDay(dateStr) {
      if (scheduleMode === "custom") {
        // Custom mode: only dates explicitly in customDays and marked open are available
        return customDays.hasOwnProperty(dateStr) && customDays[dateStr] === true;
      }
      // Weekly mode: check custom override first, then weekly schedule
      if (customDays.hasOwnProperty(dateStr)) return customDays[dateStr];
      const d = new Date(dateStr + "T12:00:00");
      const dayName = DAYS_MAP[d.getDay()];
      return WEEKLY_DAYS[dayName] || false;
    }

    function renderServices() {
      const list = document.getElementById("serviceList");
      if (services.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No services available</div>';
        return;
      }
      list.innerHTML = services.map(s => {
        const dur = s.duration >= 60 ? (s.duration / 60) + " hr" + (s.duration > 60 ? "s" : "") : s.duration + " min";
        return '<div class="service-item" id="svc-' + s.localId + '" onclick="selectService(&apos;' + s.localId + '&apos;)">'+
          '<div class="service-dot" style="background:' + (s.color||'#4a8c3f') + '"></div>'+
          '<div class="service-info"><div class="service-name">' + esc(s.name) + '</div>'+
          '<div class="service-meta">' + dur + '</div></div>'+
          '<div class="service-price">$' + parseFloat(s.price).toFixed(2) + '</div></div>';
      }).join("");
    }

    function selectService(id) {
      selectedService = services.find(s => s.localId === id);
      document.querySelectorAll("#serviceList .service-item").forEach(el => el.classList.remove("selected"));
      const el = document.getElementById("svc-" + id);
      if (el) el.classList.add("selected");
      document.getElementById("btnToDate").disabled = false;
    }

    function goToStep(step) {
      if (step === 1 && currentStep === 0) {
        const name = document.getElementById("clientName").value.trim();
        if (!name) { alert("Please enter your name"); return; }
      }
      if (step === 2 && !selectedService) { alert("Please select a service"); return; }
      if (step === 3 && (!selectedDate || !selectedTime)) { alert("Please select a date and time"); return; }

      for (let i = 0; i <= 5; i++) {
        const el = document.getElementById("step-" + i);
        if (el) el.style.display = "none";
      }
      document.getElementById("step-" + step).style.display = "block";
      currentStep = step;

      for (let i = 0; i < 5; i++) {
        const dot = document.getElementById("dot-" + i);
        if (dot) dot.className = "step-dot" + (i < step ? " done" : i === step ? " active" : "");
      }

      if (step === 2) renderCalendar();
      if (step === 3) renderAddMore();
      if (step === 4) renderConfirmation();

      window.scrollTo(0, 0);
    }

    // ── Monthly Calendar ──
    function changeMonth(delta) {
      calMonth += delta;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      if (calMonth < 0) { calMonth = 11; calYear--; }
      // Don't go before current month
      const now = new Date();
      if (calYear < now.getFullYear() || (calYear === now.getFullYear() && calMonth < now.getMonth())) {
        calMonth = now.getMonth(); calYear = now.getFullYear();
      }
      renderCalendar();
    }

    // Cache for slot availability per date
    let slotCache = {};

    function renderCalendar() {
      const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      document.getElementById("calTitle").textContent = months[calMonth] + " " + calYear;

      // Disable prev button if current month
      const now = new Date();
      document.getElementById("calPrev").disabled = (calYear === now.getFullYear() && calMonth === now.getMonth());

      const grid = document.getElementById("calGrid");
      const firstDay = new Date(calYear, calMonth, 1).getDay();
      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
      const todayStr = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0") + "-" + String(now.getDate()).padStart(2,"0");

      let html = "";
      let workingDates = [];
      // Empty cells before first day
      for (let i = 0; i < firstDay; i++) {
        html += '<div class="cal-day empty"></div>';
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const ds = calYear + "-" + String(calMonth+1).padStart(2,"0") + "-" + String(day).padStart(2,"0");
        const isPast = ds < todayStr;
        const isWorking = isWorkingDay(ds);
        const isSelected = ds === selectedDate;
        const isToday = ds === todayStr;
        // Initially disable all non-working and past days; working days start as loading
        const isDisabled = isPast || !isWorking;
        let cls = "cal-day";
        if (isDisabled) cls += " disabled";
        if (isSelected) cls += " selected";
        if (isToday && !isDisabled) cls += " today";
        // Working future days get a data-loading attribute, will be updated after slot check
        html += '<div class="' + cls + '" id="day-' + ds + '" data-date="' + ds + '"' + (!isDisabled ? ' onclick="selectDate(&apos;' + ds + '&apos;)"' : '') + '><span>' + day + '</span></div>';
        if (!isPast && isWorking) workingDates.push(ds);
      }
      grid.innerHTML = html;

      // Batch-check availability for all working days in this month
      checkDayAvailability(workingDates);

      if (selectedDate) loadSlots(selectedDate);
    }

    async function checkDayAvailability(dates) {
      const dur = getTotalDuration();
      // Fetch slots for each working day in parallel
      const promises = dates.map(async (ds) => {
        // Use cache if available
        if (slotCache[ds + '_' + dur] !== undefined) return { date: ds, count: slotCache[ds + '_' + dur] };
        try {
          const res = await fetch(API + "/slots?date=" + ds + "&duration=" + dur);
          const data = await res.json();
          const count = data.slots ? data.slots.length : 0;
          slotCache[ds + '_' + dur] = count;
          return { date: ds, count };
        } catch(e) {
          return { date: ds, count: 0 };
        }
      });
      const results = await Promise.all(promises);
      results.forEach(r => {
        const el = document.getElementById("day-" + r.date);
        if (!el) return;
        if (r.count === 0) {
          // No slots available — disable this day
          el.classList.add("disabled");
          el.style.cursor = "not-allowed";
          el.onclick = null;
          el.removeAttribute("onclick");
        } else {
          // Has slots — add green availability dot
          if (!el.querySelector(".avail-dot")) {
            const dot = document.createElement("span");
            dot.className = "avail-dot";
            el.appendChild(dot);
          }
        }
      });
    }

    async function selectDate(date) {
      selectedDate = date;
      selectedTime = null;
      document.getElementById("btnToConfirm").disabled = true;
      document.querySelectorAll(".cal-day").forEach(el => {
        el.classList.toggle("selected", el.dataset.date === date);
      });
      await loadSlots(date);
    }

    async function loadSlots(date) {
      const section = document.getElementById("timeSection");
      const grid = document.getElementById("timeGrid");
      const noSlots = document.getElementById("noSlots");
      section.style.display = "block";
      grid.innerHTML = '<div class="loading" style="grid-column:1/-1;">Loading times...</div>';
      noSlots.style.display = "none";

      try {
        const dur = getTotalDuration();
        const res = await fetch(API + "/slots?date=" + date + "&duration=" + dur);
        const data = await res.json();
        if (data.slots.length === 0) {
          grid.innerHTML = "";
          noSlots.style.display = "block";
          return;
        }
        grid.innerHTML = data.slots.map(t => {
          const h = parseInt(t.split(":")[0]);
          const m = t.split(":")[1];
          const ampm = h >= 12 ? "PM" : "AM";
          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          const label = h12 + ":" + m + " " + ampm;
         return '<div class="time-slot" onclick="selectTime(&apos;' + t + '&apos;)" data-time="' + t + '">' + label + '</div>';
        }).join("");
      } catch(e) {
        grid.innerHTML = '<div class="error-msg" style="grid-column:1/-1;">Failed to load times</div>';
      }
    }

    function selectTime(time) {
      selectedTime = time;
      document.querySelectorAll(".time-slot").forEach(el => {
        el.classList.toggle("selected", el.dataset.time === time);
      });
      document.getElementById("btnToConfirm").disabled = false;
      checkDiscount();
    }

    function checkDiscount() {
      const info = document.getElementById("discountInfo");
      if (!selectedService || !selectedTime || !selectedDate) { info.style.display = "none"; return; }
      const timeMin = parseInt(selectedTime.split(":")[0]) * 60 + parseInt(selectedTime.split(":")[1]);
      const match = discounts.find(d => {
        const start = parseInt(d.startTime.split(":")[0]) * 60 + parseInt(d.startTime.split(":")[1]);
        const end = parseInt(d.endTime.split(":")[0]) * 60 + parseInt(d.endTime.split(":")[1]);
        if (timeMin < start || timeMin >= end) return false;
        if (d.dates && d.dates.length > 0 && !d.dates.includes(selectedDate)) return false;
        if (d.serviceIds && d.serviceIds.length > 0 && !d.serviceIds.includes(selectedService.localId)) return false;
        return true;
      });
      if (match) {
        const orig = parseFloat(selectedService.price);
        const disc = orig * (1 - match.percentage / 100);
        info.innerHTML = '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px;font-size:13px;">\ud83c\udf89 <strong>' + match.name + '</strong> \u2014 ' + match.percentage + '% off! <span style="text-decoration:line-through;color:#999;">$' + orig.toFixed(2) + '</span> \u2192 <strong style="color:#2d5a27;">$' + disc.toFixed(2) + '</strong></div>';
        info.style.display = "block";
      } else {
        info.style.display = "none";
      }
    }

    // ── Add More (Step 3) ──
    function renderAddMore() {
      renderCartSummary();
      renderAddServiceList();
      renderAddProductList();
    }

    function switchAddTab(tab) {
      document.querySelectorAll("#addMoreSeg .seg-btn").forEach((el,i) => {
        el.classList.toggle("active", (tab === "services" && i === 0) || (tab === "products" && i === 1));
      });
      document.getElementById("addServiceList").style.display = tab === "services" ? "flex" : "none";
      document.getElementById("addProductList").style.display = tab === "products" ? "block" : "none";
    }

    function renderCartSummary() {
      const el = document.getElementById("cartSummary");
      // Primary service always in cart
      let items = [{type:'service', name: selectedService.name, price: parseFloat(selectedService.price), duration: selectedService.duration}];
      items = items.concat(cart);
      el.innerHTML = items.map((item, i) => {
        const priceStr = "$" + item.price.toFixed(2);
        const durStr = item.duration ? " (" + item.duration + " min)" : "";
        const removeBtn = i > 0 ? '<span class="cart-remove" onclick="removeCartItem(' + (i-1) + ')">&times;</span>' : '<span style="font-size:11px;color:#4a8c3f;font-weight:600;">PRIMARY</span>';
        return '<div class="cart-item"><span>' + esc(item.name) + durStr + '</span><span style="display:flex;align-items:center;gap:8px;"><span style="font-weight:600;">' + priceStr + '</span>' + removeBtn + '</span></div>';
      }).join("");

      // Total
      const total = items.reduce((s, it) => s + it.price, 0);
      const totalDur = items.reduce((s, it) => s + (it.duration || 0), 0);
      const totalEl = document.getElementById("cartTotal");
      totalEl.style.display = "flex";
      totalEl.innerHTML = '<span>Total' + (totalDur > 0 ? ' (' + totalDur + ' min)' : '') + '</span><span style="color:#2d5a27;">$' + total.toFixed(2) + '</span>';
    }

    function renderAddServiceList() {
      const el = document.getElementById("addServiceList");
      // Show services not already in cart (excluding primary)
      const cartSvcIds = cart.filter(c => c.type === 'service').map(c => c.id);
      const available = services.filter(s => s.localId !== selectedService.localId && !cartSvcIds.includes(s.localId));
      if (available.length === 0) {
        el.innerHTML = '<div style="text-align:center;color:#888;padding:16px;font-size:13px;">No additional services available</div>';
        return;
      }
      el.innerHTML = available.map(s => {
        const dur = s.duration >= 60 ? (s.duration / 60) + " hr" : s.duration + " min";
        return '<div class="service-item" onclick="addServiceToCart(&apos;' + s.localId + '&apos;)">' +
          '<div class="service-dot" style="background:' + (s.color||'#4a8c3f') + '"></div>' +
          '<div class="service-info"><div class="service-name">' + esc(s.name) + '</div><div class="service-meta">' + dur + '</div></div>' +
          '<div class="service-price">+ $' + parseFloat(s.price).toFixed(2) + '</div></div>';
      }).join("");
    }

    function renderAddProductList() {
      const el = document.getElementById("addProductList");
      const cartProdIds = cart.filter(c => c.type === 'product').map(c => c.id);
      const available = products.filter(p => !cartProdIds.includes(p.localId));
      if (available.length === 0) {
        el.innerHTML = '<div style="text-align:center;color:#888;padding:16px;font-size:13px;">No products available</div>';
        return;
      }
      el.innerHTML = available.map(p => {
        return '<div class="product-item" onclick="addProductToCart(&apos;' + p.localId + '&apos;)">' +
          '<div style="flex:1;"><div style="font-size:15px;font-weight:600;">' + esc(p.name) + '</div>' +
          (p.description ? '<div style="font-size:12px;color:#888;margin-top:2px;">' + esc(p.description) + '</div>' : '') + '</div>' +
          '<div style="font-size:15px;font-weight:700;color:#2d5a27;">+ $' + parseFloat(p.price).toFixed(2) + '</div></div>';
      }).join("");
    }

    function addServiceToCart(id) {
      const s = services.find(sv => sv.localId === id);
      if (!s) return;
      cart.push({ type: 'service', id: s.localId, name: s.name, price: parseFloat(s.price), duration: s.duration });
      renderAddMore();
    }

    function addProductToCart(id) {
      const p = products.find(pr => pr.localId === id);
      if (!p) return;
      cart.push({ type: 'product', id: p.localId, name: p.name, price: parseFloat(p.price), duration: 0 });
      renderAddMore();
    }

    function removeCartItem(idx) {
      cart.splice(idx, 1);
      renderAddMore();
    }

    function getTotalDuration() {
      let dur = selectedService ? selectedService.duration : 60;
      cart.forEach(c => { dur += (c.duration || 0); });
      return dur;
    }

    function getTotalPrice() {
      let total = selectedService ? parseFloat(selectedService.price) : 0;
      cart.forEach(c => { total += c.price; });
      return total;
    }

    function getChargedPrice() {
      // Gift card applies as a balance-based discount against the total
      let total = getTotalPrice();
      if (appliedGift) {
        const balance = appliedGift.remainingBalance || 0;
        total -= balance;
        if (total < 0) total = 0;
      }
      return total;
    }

    function getGiftUsedAmount() {
      // How much of the gift balance is being used for this booking
      if (!appliedGift) return 0;
      const total = getTotalPrice();
      const balance = appliedGift.remainingBalance || 0;
      return Math.min(balance, total);
    }

    // ── Confirmation (Step 4) ──
    function renderConfirmation() {
      const details = document.getElementById("confirmDetails");
      const d = new Date(selectedDate + "T12:00:00");
      const dateStr = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      const h = parseInt(selectedTime.split(":")[0]);
      const m = selectedTime.split(":")[1];
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const timeStr = h12 + ":" + m + " " + ampm;
      const totalDur = getTotalDuration();
      const endMin = h * 60 + parseInt(m) + totalDur;
      const endH = Math.floor(endMin / 60);
      const endM = endMin % 60;
      const endAmpm = endH >= 12 ? "PM" : "AM";
      const endH12 = endH === 0 ? 12 : endH > 12 ? endH - 12 : endH;
      const endStr = endH12 + ":" + String(endM).padStart(2,"0") + " " + endAmpm;

      // Build items list
      let itemsHtml = '<div class="confirm-row"><span class="confirm-label">Service</span><span class="confirm-value">' + esc(selectedService.name) + ' — $' + parseFloat(selectedService.price).toFixed(2) + '</span></div>';
      cart.forEach(c => {
        const label = c.type === 'product' ? 'Product' : 'Service';
        itemsHtml += '<div class="confirm-row"><span class="confirm-label">' + label + '</span><span class="confirm-value">' + esc(c.name) + ' — $' + c.price.toFixed(2) + '</span></div>';
      });

      let totalPrice = getTotalPrice();
      let chargedPrice = getChargedPrice();
      let giftUsed = getGiftUsedAmount();
      let priceHtml = '$' + totalPrice.toFixed(2);
      if (appliedGift) {
        if (chargedPrice > 0) {
          priceHtml = '<span style="text-decoration:line-through;color:#999;">$' + totalPrice.toFixed(2) + '</span> <span style="color:#2d5a27;">Gift -$' + giftUsed.toFixed(2) + '</span> = <strong>$' + chargedPrice.toFixed(2) + '</strong>';
        } else {
          priceHtml = '<span style="text-decoration:line-through;color:#999;">$' + totalPrice.toFixed(2) + '</span> <strong style="color:#2d5a27;">Gift Applied — Free!</strong>';
        }
      }

      details.innerHTML = itemsHtml +
        '<div class="confirm-row"><span class="confirm-label">Date</span><span class="confirm-value">' + dateStr + '</span></div>' +
        '<div class="confirm-row"><span class="confirm-label">Time</span><span class="confirm-value">' + timeStr + ' — ' + endStr + '</span></div>' +
        '<div class="confirm-row"><span class="confirm-label">Duration</span><span class="confirm-value">' + totalDur + ' min</span></div>' +
        '<div class="confirm-row" style="border-top:2px solid #e8ece8;padding-top:10px;"><span class="confirm-label" style="font-weight:700;">Total</span><span class="confirm-value">' + priceHtml + '</span></div>' +
        '<div class="confirm-row"><span class="confirm-label">Name</span><span class="confirm-value">' + esc(document.getElementById("clientName").value) + '</span></div>';
    }

    async function submitBooking() {
      const btn = document.getElementById("btnSubmit");
      const errEl = document.getElementById("bookError");
      btn.disabled = true;
      btn.textContent = "Submitting...";
      errEl.style.display = "none";

      try {
        const totalDur = getTotalDuration();
        // Build notes with extra items
        let notesText = document.getElementById("bookingNotes").value.trim();
        if (cart.length > 0) {
          const extras = cart.map(c => c.name + ' ($' + c.price.toFixed(2) + ')').join(', ');
          notesText = (notesText ? notesText + String.fromCharCode(10) : '') + 'Additional items: ' + extras;
        }

        const chargedPrice = getChargedPrice();
        const extraItems = cart.map(c => ({ name: c.name, price: c.price, type: c.type }));
        const res = await fetch(API + "/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: document.getElementById("clientName").value.trim(),
            clientPhone: document.getElementById("clientPhone").value.replace(/\\D/g, ""),
            clientEmail: document.getElementById("clientEmail").value.trim(),
            serviceLocalId: selectedService.localId,
            date: selectedDate,
            time: selectedTime,
            duration: totalDur,
            notes: notesText,
            giftCode: appliedGift ? document.getElementById("giftCode").value.trim() : null,
            totalPrice: chargedPrice,
            extraItems: extraItems,
            giftApplied: !!appliedGift,
            giftUsedAmount: appliedGift ? getGiftUsedAmount() : 0,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          errEl.textContent = data.error || "Failed to submit booking";
          errEl.style.display = "block";
          btn.disabled = false;
          btn.textContent = "Confirm Booking";
          return;
        }
        // Show success with detailed receipt
        for (let i = 0; i <= 4; i++) document.getElementById("step-" + i).style.display = "none";
        document.getElementById("step-indicator").style.display = "none";
        document.getElementById("step-5").style.display = "block";
        renderSuccessReceipt();
        window.scrollTo(0, 0);
      } catch(e) {
        errEl.textContent = "Network error. Please try again.";
        errEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Confirm Booking";
      }
    }

    function renderSuccessReceipt() {
      const d = new Date(selectedDate + "T12:00:00");
      const dateStr = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      const h = parseInt(selectedTime.split(":")[0]);
      const m = selectedTime.split(":")[1];
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const timeStr = h12 + ":" + m + " " + ampm;
      const totalDur = getTotalDuration();
      const endMin = h * 60 + parseInt(m) + totalDur;
      const endH = Math.floor(endMin / 60);
      const endM = endMin % 60;
      const endAmpm = endH >= 12 ? "PM" : "AM";
      const endH12 = endH === 0 ? 12 : endH > 12 ? endH - 12 : endH;
      const endStr = endH12 + ":" + String(endM).padStart(2,"0") + " " + endAmpm;
      const totalPrice = getTotalPrice();

      let html = '<div style="margin-bottom:12px;font-weight:700;font-size:15px;color:#2d5a27;border-bottom:2px solid #e8ece8;padding-bottom:8px;">Booking Receipt</div>';

      // Items list
      html += '<div style="margin-bottom:12px;">';
      html += '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span>\u2022 ' + esc(selectedService.name) + ' (' + selectedService.duration + ' min)</span><span style="font-weight:600;">$' + parseFloat(selectedService.price).toFixed(2) + '</span></div>';
      cart.forEach(c => {
        const durLabel = c.duration > 0 ? ' (' + c.duration + ' min)' : '';
        const typeLabel = c.type === 'product' ? ' [Product]' : '';
        html += '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span>\u2022 ' + esc(c.name) + durLabel + typeLabel + '</span><span style="font-weight:600;">$' + c.price.toFixed(2) + '</span></div>';
      });
      html += '</div>';

      // Date & Time
      html += '<div style="border-top:1px solid #e8ece8;padding-top:10px;margin-bottom:10px;">';
      html += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:#666;">Date</span><span style="font-weight:600;">' + dateStr + '</span></div>';
      html += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:#666;">Time</span><span style="font-weight:600;">' + timeStr + ' \u2014 ' + endStr + '</span></div>';
      html += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:#666;">Total Duration</span><span style="font-weight:600;">' + totalDur + ' min</span></div>';
      html += '</div>';

      // Total
      let chargedPriceR = getChargedPrice();
      let giftUsedR = getGiftUsedAmount();
      let priceDisplay = '$' + totalPrice.toFixed(2);
      if (appliedGift) {
        if (chargedPriceR > 0) {
          priceDisplay = '<span style="text-decoration:line-through;color:#999;">$' + totalPrice.toFixed(2) + '</span> Gift -$' + giftUsedR.toFixed(2) + ' = <span style="font-weight:700;">$' + chargedPriceR.toFixed(2) + '</span>';
        } else {
          priceDisplay = '<span style="text-decoration:line-through;color:#999;">$' + totalPrice.toFixed(2) + '</span> <span style="color:#2d5a27;">Gift Applied</span>';
        }
      }
      html += '<div style="border-top:2px solid #2d5a27;padding-top:10px;display:flex;justify-content:space-between;font-size:16px;font-weight:700;"><span>Total</span><span style="color:#2d5a27;">' + priceDisplay + '</span></div>';

      // Client info
      html += '<div style="border-top:1px solid #e8ece8;padding-top:10px;margin-top:10px;font-size:12px;color:#888;">';
      html += 'Client: ' + esc(document.getElementById("clientName").value);
      const phone = document.getElementById("clientPhone").value;
      if (phone) html += ' \u2022 ' + phone;
      html += '</div>';

      document.getElementById("successReceipt").innerHTML = html;
    }

    function saveReceipt() {
      const d = new Date(selectedDate + "T12:00:00");
      const dateStr = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      const h = parseInt(selectedTime.split(":")[0]);
      const m = selectedTime.split(":")[1];
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const timeStr = h12 + ":" + m + " " + ampm;
      const totalDur = getTotalDuration();
      const endMin = h * 60 + parseInt(m) + totalDur;
      const endH = Math.floor(endMin / 60);
      const endM = endMin % 60;
      const endAmpm = endH >= 12 ? "PM" : "AM";
      const endH12 = endH === 0 ? 12 : endH > 12 ? endH - 12 : endH;
      const endStr = endH12 + ":" + String(endM).padStart(2,"0") + " " + endAmpm;
      const totalPrice = getTotalPrice();

      let lines = [];
      lines.push("BOOKING RECEIPT");
      lines.push("${escHtml(owner.businessName)}");
      lines.push("=".repeat(35));
      lines.push("");
      lines.push("SERVICES & PRODUCTS:");
      lines.push("  " + selectedService.name + " (" + selectedService.duration + " min) - $" + parseFloat(selectedService.price).toFixed(2));
      cart.forEach(c => {
        const durLabel = c.duration > 0 ? " (" + c.duration + " min)" : "";
        const typeLabel = c.type === "product" ? " [Product]" : "";
        lines.push("  " + c.name + durLabel + typeLabel + " - $" + c.price.toFixed(2));
      });
      lines.push("");
      lines.push("DATE: " + dateStr);
      lines.push("TIME: " + timeStr + " - " + endStr);
      lines.push("DURATION: " + totalDur + " min");
      lines.push("-".repeat(35));
      const chargedPriceT = getChargedPrice();
      const giftUsedT = getGiftUsedAmount();
      if (appliedGift && chargedPriceT > 0) {
        lines.push("SUBTOTAL: $" + totalPrice.toFixed(2));
        lines.push("GIFT CARD: -$" + giftUsedT.toFixed(2));
        lines.push("TOTAL DUE: $" + chargedPriceT.toFixed(2));
      } else if (appliedGift) {
        lines.push("SUBTOTAL: $" + totalPrice.toFixed(2));
        lines.push("GIFT CARD: -$" + giftUsedT.toFixed(2));
        lines.push("TOTAL DUE: $0.00");
      } else {
        lines.push("TOTAL: $" + totalPrice.toFixed(2));
      }
      lines.push("");
      lines.push("Client: " + document.getElementById("clientName").value);
      const phone = document.getElementById("clientPhone").value;
      if (phone) lines.push("Phone: " + phone);
      lines.push("");
      lines.push("Thank you for your booking!");

      const blob = new Blob([lines.join(String.fromCharCode(10))], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "booking-receipt.txt";
      a.click();
      URL.revokeObjectURL(url);
    }

    async function applyGiftCode() {
      const code = document.getElementById("giftCode").value.trim();
      const msg = document.getElementById("giftMsg");
      if (!code) { msg.innerHTML = ""; return; }
      try {
        const res = await fetch(window.location.origin + "/api/public/gift/" + encodeURIComponent(code));
        if (!res.ok) {
          msg.innerHTML = '<span style="color:#dc2626;">Invalid or expired gift code</span>';
          appliedGift = null;
          return;
        }
        const data = await res.json();
        if (data.redeemed && data.remainingBalance <= 0) {
          msg.innerHTML = '<span style="color:#dc2626;">This gift card has been fully redeemed</span>';
          appliedGift = null;
          return;
        }
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          msg.innerHTML = '<span style="color:#dc2626;">This gift card has expired</span>';
          appliedGift = null;
          return;
        }
        const balance = data.remainingBalance || 0;
        if (balance <= 0) {
          msg.innerHTML = '<span style="color:#dc2626;">This gift card has no remaining balance</span>';
          appliedGift = null;
          return;
        }
        msg.innerHTML = '<span style="color:#2d5a27;">\u2713 Gift card applied! Balance: $' + balance.toFixed(2) + '</span>';
        appliedGift = data;
        // Pre-select the primary gifted service
        const svc = services.find(s => s.localId === data.serviceLocalId || s.name === data.serviceName);
        if (svc) selectService(svc.localId);
        // Pre-add gifted extra services and products to cart
        if (data.serviceIds && data.serviceIds.length > 1) {
          data.serviceIds.slice(1).forEach(sid => {
            if (!cart.find(c => c.id === sid)) {
              const s = services.find(sv => sv.localId === sid);
              if (s) cart.push({ type: 'service', id: s.localId, name: s.name, price: parseFloat(s.price), duration: s.duration });
            }
          });
        }
        if (data.productIds && data.productIds.length > 0) {
          data.productIds.forEach(pid => {
            if (!cart.find(c => c.id === pid)) {
              const p = products.find(pr => pr.localId === pid);
              if (p) cart.push({ type: 'product', id: p.localId, name: p.name, price: parseFloat(p.price), duration: 0 });
            }
          });
        }
      } catch(e) {
        msg.innerHTML = '<span style="color:#dc2626;">Failed to verify gift code</span>';
        appliedGift = null;
      }
    }

    function esc(str) {
      if (!str) return "";
      return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }
    // Alias for backward compat
    const escHtml = esc;

    // Auto-fill gift code from URL parameter (when coming from gift card page)
    function autoFillGift() {
      const params = new URLSearchParams(window.location.search);
      const giftParam = params.get("gift");
      if (giftParam) {
        const giftInput = document.getElementById("giftCode");
        if (giftInput) {
          giftInput.value = giftParam;
          // Auto-apply after services load
          setTimeout(() => applyGiftCode(), 1500);
        }
      }
    }

    // Init
    loadServices();
    loadProducts();
    loadDiscounts();
    loadWorkingDays();
    autoFillGift();
  </script>
</body>
</html>`;
}

function reviewPage(slug: string, owner: any): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Review ${escHtml(owner.businessName)} - Lime Of Time</title>
  ${baseStyles()}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escHtml(owner.businessName)}</h1>
      <div class="subtitle">Leave a Review</div>
    </div>

    <!-- Existing Reviews -->
    <div class="card" id="reviewsCard">
      <h2>Reviews</h2>
      <div id="reviewsList"><div class="loading">Loading reviews...</div></div>
    </div>

    <!-- Write Review Form -->
    <div class="card" id="reviewForm">
      <h2>Write a Review</h2>
      <div class="input-group">
        <label>Your Name *</label>
        <input type="text" id="reviewerName" placeholder="Your name">
      </div>
      <div class="input-group">
        <label>Phone (optional)</label>
        <input type="tel" id="reviewerPhone" placeholder="(000) 000-0000">
      </div>
      <div class="input-group">
        <label>Rating *</label>
        <div class="stars" id="starRating">
          <span class="star" onclick="setRating(1)" data-r="1">☆</span>
          <span class="star" onclick="setRating(2)" data-r="2">☆</span>
          <span class="star" onclick="setRating(3)" data-r="3">☆</span>
          <span class="star" onclick="setRating(4)" data-r="4">☆</span>
          <span class="star" onclick="setRating(5)" data-r="5">☆</span>
        </div>
      </div>
      <div class="input-group">
        <label>Comment</label>
        <textarea id="reviewComment" placeholder="Share your experience..."></textarea>
      </div>
      <div id="reviewError" class="error-msg" style="display:none"></div>
      <button class="btn btn-primary" onclick="submitReview()" id="btnReview">Submit Review</button>
    </div>

    <!-- Success -->
    <div class="card" id="reviewSuccess" style="display:none;text-align:center;">
      <div class="success-icon">✓</div>
      <h2 style="font-size:20px;margin-bottom:8px;">Thank You!</h2>
      <p style="color:#666;font-size:14px;">Your review has been submitted.</p>
    </div>
  </div>

  <script>
    const SLUG = "${slug}";
    const API = window.location.origin + "/api/public/business/" + SLUG;
    let rating = 0;

    // Pre-fill name and phone from URL parameters
    (function prefillFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const name = params.get("name");
      const phone = params.get("phone");
      if (name) {
        document.getElementById("reviewerName").value = decodeURIComponent(name);
      }
      if (phone) {
        let v = phone.replace(/\\D/g, "");
        if (v.length >= 10) v = v.slice(v.length - 10);
        if (v.length >= 7) document.getElementById("reviewerPhone").value = "(" + v.slice(0,3) + ") " + v.slice(3,6) + "-" + v.slice(6);
        else if (v.length >= 4) document.getElementById("reviewerPhone").value = "(" + v.slice(0,3) + ") " + v.slice(3);
        else if (v.length > 0) document.getElementById("reviewerPhone").value = "(" + v;
      }
    })();

    document.getElementById("reviewerPhone").addEventListener("input", function(e) {
      let v = e.target.value.replace(/\\D/g, "");
      if (v.length > 10) v = v.slice(0, 10);
      if (v.length >= 7) e.target.value = "(" + v.slice(0,3) + ") " + v.slice(3,6) + "-" + v.slice(6);
      else if (v.length >= 4) e.target.value = "(" + v.slice(0,3) + ") " + v.slice(3);
      else if (v.length > 0) e.target.value = "(" + v;
      else e.target.value = "";
    });

    function setRating(r) {
      rating = r;
      document.querySelectorAll(".star").forEach(s => {
        s.textContent = parseInt(s.dataset.r) <= r ? "★" : "☆";
        s.style.color = parseInt(s.dataset.r) <= r ? "#f59e0b" : "#ccc";
      });
    }

    async function loadReviews() {
      try {
        const res = await fetch(API + "/reviews");
        const reviews = await res.json();
        const list = document.getElementById("reviewsList");
        if (reviews.length === 0) {
          list.innerHTML = '<div style="text-align:center;color:#888;padding:16px;font-size:14px;">No reviews yet. Be the first!</div>';
          return;
        }
        const avg = (reviews.reduce((s,r) => s + r.rating, 0) / reviews.length).toFixed(1);
        list.innerHTML = '<div style="text-align:center;margin-bottom:12px;"><span style="font-size:28px;font-weight:700;color:#2d5a27;">' + avg + '</span>' +
          '<span style="color:#f59e0b;margin-left:8px;">' + "★".repeat(Math.round(parseFloat(avg))) + '</span>' +
          '<span style="color:#888;font-size:13px;margin-left:4px;">(' + reviews.length + ' review' + (reviews.length > 1 ? "s" : "") + ')</span></div>' +
          reviews.map(r => {
            const date = new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            return '<div class="review-card">' +
              '<div class="review-stars">' + "★".repeat(r.rating) + "☆".repeat(5 - r.rating) + '</div>' +
              '<div class="review-name">' + escHtml(r.clientName) + '</div>' +
              (r.comment ? '<div class="review-comment">' + escHtml(r.comment) + '</div>' : '') +
              '<div class="review-date">' + date + '</div></div>';
          }).join("");
      } catch(e) {
        document.getElementById("reviewsList").innerHTML = '<div class="error-msg">Failed to load reviews</div>';
      }
    }

    async function submitReview() {
      const name = document.getElementById("reviewerName").value.trim();
      const errEl = document.getElementById("reviewError");
      if (!name) { errEl.textContent = "Please enter your name"; errEl.style.display = "block"; return; }
      if (rating === 0) { errEl.textContent = "Please select a rating"; errEl.style.display = "block"; return; }

      const btn = document.getElementById("btnReview");
      btn.disabled = true;
      btn.textContent = "Submitting...";
      errEl.style.display = "none";

      try {
        const res = await fetch(API + "/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: name,
            clientPhone: document.getElementById("reviewerPhone").value.replace(/\\D/g, ""),
            rating: rating,
            comment: document.getElementById("reviewComment").value.trim(),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          errEl.textContent = data.error || "Failed to submit review";
          errEl.style.display = "block";
          btn.disabled = false;
          btn.textContent = "Submit Review";
          return;
        }
        document.getElementById("reviewForm").style.display = "none";
        document.getElementById("reviewSuccess").style.display = "block";
        loadReviews();
      } catch(e) {
        errEl.textContent = "Network error. Please try again.";
        errEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Submit Review";
      }
    }

    function escHtml(str) {
      if (!str) return "";
      return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }

    loadReviews();
  </script>
</body>
</html>`;
}

function giftCardPage(code: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Gift Card - Lime Of Time</title>
  ${baseStyles()}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎁 Gift Card</h1>
      <div class="subtitle">Powered by Lime Of Time</div>
    </div>

    <div id="loading" class="card loading">Loading gift card details...</div>

    <div id="giftDetails" class="card" style="display:none;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🎁</div>
      <div id="giftRecipient" style="font-size:14px;color:#888;margin-bottom:4px;"></div>
      <div id="giftBusiness" style="font-size:18px;font-weight:700;color:#2d5a27;margin-bottom:12px;"></div>
      <div id="giftService" style="font-size:16px;font-weight:600;margin-bottom:4px;"></div>
      <div id="giftValue" style="font-size:24px;font-weight:700;color:#2d5a27;margin-bottom:12px;"></div>
      <div id="giftMessage" style="font-size:14px;color:#666;font-style:italic;margin-bottom:12px;padding:12px;background:#f8fbf8;border-radius:10px;display:none;"></div>
      <div style="display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:12px;">
        <div id="giftCodeDisplay" style="font-size:18px;font-weight:700;letter-spacing:2px;color:#4a8c3f;background:#f0f7ef;padding:12px;border-radius:10px;flex:1;"></div>
        <button id="copyBtn" onclick="copyGiftCode()" style="background:#4a8c3f;color:#fff;border:none;border-radius:10px;padding:12px 16px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;">Copy</button>
      </div>
      <div id="giftExpiry" style="font-size:12px;color:#888;margin-bottom:16px;"></div>
      <div id="giftStatus"></div>
      <a id="bookLink" class="btn btn-primary" style="display:none;text-decoration:none;margin-top:12px;">Book Now</a>
    </div>

    <div id="giftError" class="card" style="display:none;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">😕</div>
      <h2 style="font-size:18px;margin-bottom:8px;">Gift Card Not Found</h2>
      <p style="color:#888;font-size:14px;">This gift card code is invalid or has expired.</p>
    </div>
  </div>

  <script>
    const CODE = "${escHtml(code)}";

    async function loadGift() {
      try {
        const res = await fetch(window.location.origin + "/api/public/gift/" + encodeURIComponent(CODE));
        document.getElementById("loading").style.display = "none";
        if (!res.ok) {
          document.getElementById("giftError").style.display = "block";
          return;
        }
        const data = await res.json();
        document.getElementById("giftDetails").style.display = "block";
        document.getElementById("giftBusiness").textContent = data.businessName;
        // Show all gifted items if available
        if (data.items && data.items.length > 0) {
          document.getElementById("giftService").innerHTML = data.items.map(function(it) {
            const icon = it.type === 'product' ? '📦' : '✂️';
            return icon + ' ' + it.name + ' — $' + it.price.toFixed(2);
          }).join('<br>');
        } else {
          document.getElementById("giftService").textContent = data.serviceName + " (" + data.serviceDuration + " min)";
        }
        const origVal = data.originalValue || parseFloat(data.servicePrice);
        const remBal = data.remainingBalance != null ? data.remainingBalance : origVal;
        if (remBal < origVal) {
          document.getElementById("giftValue").innerHTML = 'Original: $' + origVal.toFixed(2) + '<br><strong style="color:#2d5a27;">Balance: $' + remBal.toFixed(2) + '</strong>';
        } else {
          document.getElementById("giftValue").textContent = "Value: $" + origVal.toFixed(2);
        }
        document.getElementById("giftCodeDisplay").textContent = data.code;

        if (data.recipientName) {
          document.getElementById("giftRecipient").textContent = "For: " + data.recipientName;
        }
        if (data.message) {
          const msgEl = document.getElementById("giftMessage");
          msgEl.textContent = '"' + data.message + '"';
          msgEl.style.display = "block";
        }
        if (data.expiresAt) {
          document.getElementById("giftExpiry").textContent = "Expires: " + new Date(data.expiresAt + "T23:59:59").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        }

        if (data.redeemed && remBal <= 0) {
          document.getElementById("giftStatus").innerHTML = '<div style="color:#dc2626;font-weight:600;">This gift card has been fully redeemed</div>';
        } else if (remBal <= 0) {
          document.getElementById("giftStatus").innerHTML = '<div style="color:#dc2626;font-weight:600;">No remaining balance</div>';
        } else {
          document.getElementById("giftStatus").innerHTML = '<div style="color:#2d5a27;font-weight:600;">✓ Valid — Ready to use!</div>';
          const link = document.getElementById("bookLink");
          link.href = window.location.origin + "/api/book/" + data.businessSlug + "?gift=" + encodeURIComponent(data.code);
          link.style.display = "block";
        }
      } catch(e) {
        document.getElementById("loading").style.display = "none";
        document.getElementById("giftError").style.display = "block";
      }
    }

    function copyGiftCode() {
      const code = document.getElementById("giftCodeDisplay").textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
          const btn = document.getElementById("copyBtn");
          btn.textContent = "Copied!";
          btn.style.background = "#2d5a27";
          setTimeout(() => { btn.textContent = "Copy"; btn.style.background = "#4a8c3f"; }, 2000);
        }).catch(() => fallbackCopy(code));
      } else {
        fallbackCopy(code);
      }
    }

    function fallbackCopy(text) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      const btn = document.getElementById("copyBtn");
      btn.textContent = "Copied!";
      btn.style.background = "#2d5a27";
      setTimeout(() => { btn.textContent = "Copy"; btn.style.background = "#4a8c3f"; }, 2000);
    }

    function escHtml(str) {
      if (!str) return "";
      return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }

    loadGift();
  </script>
</body>
</html>`;
}

function escHtml(str: string): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
