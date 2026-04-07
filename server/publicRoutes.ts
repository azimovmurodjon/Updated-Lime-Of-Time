import { Express, Request, Response } from "express";
import * as db from "./db";

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
  customSchedule: any[]
): string[] {
  const d = new Date(date + "T00:00:00");
  const dayIndex = d.getDay();
  const dayName = DAYS_OF_WEEK[dayIndex];

  // Check custom schedule override
  const customDay = customSchedule.find((cs: any) => cs.date === date);
  let startMin: number, endMin: number;

  if (customDay) {
    if (!customDay.isOpen) return [];
    startMin = timeToMinutes(customDay.startTime || "09:00");
    endMin = timeToMinutes(customDay.endTime || "17:00");
  } else {
    const wh = workingHours?.[dayName];
    if (!wh || !wh.enabled) return [];
    startMin = timeToMinutes(wh.start || "09:00");
    endMin = timeToMinutes(wh.end || "17:00");
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
      const slots = generateAvailableSlots(
        date,
        duration,
        owner.workingHours,
        appts,
        30,
        schedule
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
      const svc = svcList.find((s) => s.localId === card.serviceLocalId);
      res.json({
        code: card.code,
        redeemed: card.redeemed,
        expiresAt: card.expiresAt,
        recipientName: card.recipientName,
        message: card.message,
        serviceName: svc?.name || "Service",
        servicePrice: svc?.price || "0",
        serviceDuration: svc?.duration || 60,
        businessName: owner?.businessName || "Business",
        businessSlug: owner?.businessName.toLowerCase().replace(/\s+/g, "-") || "",
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

      const { clientName, clientPhone, clientEmail, serviceLocalId, date, time, duration, notes, giftCode } = req.body;

      if (!clientName || !serviceLocalId || !date || !time) {
        res.status(400).json({ error: "Missing required fields: clientName, serviceLocalId, date, time" });
        return;
      }

      // Check if client already exists by phone
      let clientLocalId: string;
      const strippedPhone = (clientPhone || "").replace(/\D/g, "");
      if (strippedPhone) {
        const existingClient = await db.getClientByPhone(strippedPhone, owner.id);
        if (existingClient) {
          clientLocalId = existingClient.localId;
        } else {
          clientLocalId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          await db.createClient({
            businessOwnerId: owner.id,
            localId: clientLocalId,
            name: clientName,
            phone: strippedPhone,
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
          phone: clientPhone || null,
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

      const slots = generateAvailableSlots(date, dur, owner.workingHours, appts, 30, schedule);
      if (!slots.includes(time)) {
        res.status(400).json({ error: "Selected time slot is no longer available" });
        return;
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
        notes: notes || null,
      });

      // Redeem gift card if provided
      if (giftCode) {
        const card = await db.getGiftCardByCode(giftCode, owner.id);
        if (card && !card.redeemed) {
          await db.updateGiftCard(card.localId, owner.id, {
            redeemed: true,
            redeemedAt: new Date(),
          });
        }
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

      // Find or create client
      let clientLocalId: string;
      const strippedPhone = (clientPhone || "").replace(/\D/g, "");
      if (strippedPhone) {
        const existingClient = await db.getClientByPhone(strippedPhone, owner.id);
        if (existingClient) {
          clientLocalId = existingClient.localId;
        } else {
          clientLocalId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          await db.createClient({
            businessOwnerId: owner.id,
            localId: clientLocalId,
            name: clientName,
            phone: strippedPhone,
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

    <!-- Step 2: Select Date & Time -->
    <div id="step-2" class="card" style="display:none">
      <h2>Select Date & Time</h2>
      <div id="dateGrid" class="date-grid"></div>
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

    <!-- Step 3: Confirm -->
    <div id="step-3" class="card" style="display:none">
      <h2>Confirm Booking</h2>
      <div id="confirmDetails"></div>
      <div class="input-group" style="margin-top:12px;">
        <label>Notes (optional)</label>
        <textarea id="bookingNotes" placeholder="Any special requests..."></textarea>
      </div>
      <div id="bookError" class="error-msg" style="display:none"></div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-secondary" onclick="goToStep(2)" style="flex:1">Back</button>
        <button class="btn btn-primary" onclick="submitBooking()" id="btnSubmit" style="flex:1">Confirm Booking</button>
      </div>
    </div>

    <!-- Step 4: Success -->
    <div id="step-4" class="card" style="display:none;text-align:center;">
      <div class="success-icon">✓</div>
      <h2 style="font-size:20px;margin-bottom:8px;">Booking Submitted!</h2>
      <p style="color:#666;font-size:14px;margin-bottom:16px;">Your appointment request has been sent to ${escHtml(owner.businessName)}. They will confirm your booking shortly.</p>
      <div id="successDetails" style="text-align:left;margin-bottom:16px;"></div>
      <button class="btn btn-primary" onclick="location.reload()">Book Another</button>
    </div>
  </div>

  <script>
    const SLUG = "${slug}";
    const API = window.location.origin + "/api/public/business/" + SLUG;
    let services = [];
    let discounts = [];
    let selectedService = null;
    let selectedDate = null;
    let selectedTime = null;
    let appliedGift = null;
    let currentStep = 0;

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

    // Load discounts
    async function loadDiscounts() {
      try {
        const res = await fetch(API + "/discounts");
        discounts = await res.json();
      } catch(e) { discounts = []; }
    }

    function renderServices() {
      const list = document.getElementById("serviceList");
      if (services.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No services available</div>';
        return;
      }
      list.innerHTML = services.map(s => {
        const dur = s.duration >= 60 ? (s.duration / 60) + " hr" + (s.duration > 60 ? "s" : "") : s.duration + " min";
        return '<div class="service-item" id="svc-' + s.localId + '" onclick="selectService(\\'' + s.localId + '\\')">' +
          '<div class="service-dot" style="background:' + s.color + '"></div>' +
          '<div class="service-info"><div class="service-name">' + escHtml(s.name) + '</div>' +
          '<div class="service-meta">' + dur + '</div></div>' +
          '<div class="service-price">$' + parseFloat(s.price).toFixed(2) + '</div></div>';
      }).join("");
    }

    function selectService(id) {
      selectedService = services.find(s => s.localId === id);
      document.querySelectorAll(".service-item").forEach(el => el.classList.remove("selected"));
      document.getElementById("svc-" + id).classList.add("selected");
      document.getElementById("btnToDate").disabled = false;
      // If gift card applied, auto-select its service
    }

    function goToStep(step) {
      // Validate
      if (step === 1 && currentStep === 0) {
        const name = document.getElementById("clientName").value.trim();
        if (!name) { alert("Please enter your name"); return; }
      }
      if (step === 2 && !selectedService) { alert("Please select a service"); return; }
      if (step === 3 && (!selectedDate || !selectedTime)) { alert("Please select a date and time"); return; }

      // Hide all steps
      for (let i = 0; i <= 4; i++) {
        const el = document.getElementById("step-" + i);
        if (el) el.style.display = "none";
      }
      document.getElementById("step-" + step).style.display = "block";
      currentStep = step;

      // Update dots
      for (let i = 0; i < 4; i++) {
        const dot = document.getElementById("dot-" + i);
        dot.className = "step-dot" + (i < step ? " done" : i === step ? " active" : "");
      }

      if (step === 2) renderDates();
      if (step === 3) renderConfirmation();

      // Scroll to top
      window.scrollTo(0, 0);
    }

    function renderDates() {
      const grid = document.getElementById("dateGrid");
      const today = new Date();
      const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      let html = "";
      for (let i = 0; i < 28; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const ds = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
        const isSelected = ds === selectedDate;
        html += '<div class="date-cell' + (isSelected ? " selected" : "") + '" onclick="selectDate(\\'' + ds + '\\')" data-date="' + ds + '">' +
          '<span class="day-name">' + days[d.getDay()] + '</span>' +
          '<span class="day-num">' + d.getDate() + '</span></div>';
      }
      grid.innerHTML = html;
      if (selectedDate) loadSlots(selectedDate);
    }

    async function selectDate(date) {
      selectedDate = date;
      selectedTime = null;
      document.getElementById("btnToConfirm").disabled = true;
      document.querySelectorAll(".date-cell").forEach(el => {
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
        const dur = selectedService ? selectedService.duration : 60;
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
          return '<div class="time-slot" onclick="selectTime(\\'' + t + '\\')" data-time="' + t + '">' + label + '</div>';
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
        info.innerHTML = '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px;font-size:13px;">' +
          '🎉 <strong>' + match.name + '</strong> — ' + match.percentage + '% off! ' +
          '<span style="text-decoration:line-through;color:#999;">$' + orig.toFixed(2) + '</span> → ' +
          '<strong style="color:#2d5a27;">$' + disc.toFixed(2) + '</strong></div>';
        info.style.display = "block";
      } else {
        info.style.display = "none";
      }
    }

    function renderConfirmation() {
      const details = document.getElementById("confirmDetails");
      const d = new Date(selectedDate + "T12:00:00");
      const dateStr = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      const h = parseInt(selectedTime.split(":")[0]);
      const m = selectedTime.split(":")[1];
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const timeStr = h12 + ":" + m + " " + ampm;
      const dur = selectedService.duration;
      const endMin = parseInt(selectedTime.split(":")[0]) * 60 + parseInt(selectedTime.split(":")[1]) + dur;
      const endH = Math.floor(endMin / 60);
      const endM = endMin % 60;
      const endAmpm = endH >= 12 ? "PM" : "AM";
      const endH12 = endH === 0 ? 12 : endH > 12 ? endH - 12 : endH;
      const endStr = endH12 + ":" + String(endM).padStart(2,"0") + " " + endAmpm;

      let priceHtml = "$" + parseFloat(selectedService.price).toFixed(2);
      if (appliedGift) {
        priceHtml = '<span style="text-decoration:line-through;color:#999;">$' + parseFloat(selectedService.price).toFixed(2) + '</span> <strong style="color:#2d5a27;">FREE (Gift Card)</strong>';
      }

      details.innerHTML =
        '<div class="confirm-row"><span class="confirm-label">Service</span><span class="confirm-value">' + escHtml(selectedService.name) + '</span></div>' +
        '<div class="confirm-row"><span class="confirm-label">Date</span><span class="confirm-value">' + dateStr + '</span></div>' +
        '<div class="confirm-row"><span class="confirm-label">Time</span><span class="confirm-value">' + timeStr + ' - ' + endStr + '</span></div>' +
        '<div class="confirm-row"><span class="confirm-label">Duration</span><span class="confirm-value">' + dur + ' min</span></div>' +
        '<div class="confirm-row"><span class="confirm-label">Price</span><span class="confirm-value">' + priceHtml + '</span></div>' +
        '<div class="confirm-row"><span class="confirm-label">Name</span><span class="confirm-value">' + escHtml(document.getElementById("clientName").value) + '</span></div>';
    }

    async function submitBooking() {
      const btn = document.getElementById("btnSubmit");
      const errEl = document.getElementById("bookError");
      btn.disabled = true;
      btn.textContent = "Submitting...";
      errEl.style.display = "none";

      try {
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
            duration: selectedService.duration,
            notes: document.getElementById("bookingNotes").value.trim(),
            giftCode: appliedGift ? document.getElementById("giftCode").value.trim() : null,
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
        // Show success
        for (let i = 0; i <= 3; i++) document.getElementById("step-" + i).style.display = "none";
        document.getElementById("step-indicator").style.display = "none";
        document.getElementById("step-4").style.display = "block";
        document.getElementById("successDetails").innerHTML = document.getElementById("confirmDetails").innerHTML;
        window.scrollTo(0, 0);
      } catch(e) {
        errEl.textContent = "Network error. Please try again.";
        errEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Confirm Booking";
      }
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
        if (data.redeemed) {
          msg.innerHTML = '<span style="color:#dc2626;">This gift card has already been redeemed</span>';
          appliedGift = null;
          return;
        }
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          msg.innerHTML = '<span style="color:#dc2626;">This gift card has expired</span>';
          appliedGift = null;
          return;
        }
        msg.innerHTML = '<span style="color:#2d5a27;">✓ Gift card applied! Free ' + escHtml(data.serviceName) + '</span>';
        appliedGift = data;
        // Auto-select the service
        const svc = services.find(s => s.localId === data.serviceLocalId || s.name === data.serviceName);
        if (svc) selectService(svc.localId);
      } catch(e) {
        msg.innerHTML = '<span style="color:#dc2626;">Failed to verify gift code</span>';
        appliedGift = null;
      }
    }

    function escHtml(str) {
      if (!str) return "";
      return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }

    // Init
    loadServices();
    loadDiscounts();
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
      <div id="giftCode" style="font-size:18px;font-weight:700;letter-spacing:2px;color:#4a8c3f;background:#f0f7ef;padding:12px;border-radius:10px;margin-bottom:12px;"></div>
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
        document.getElementById("giftService").textContent = data.serviceName + " (" + data.serviceDuration + " min)";
        document.getElementById("giftValue").textContent = "Value: $" + parseFloat(data.servicePrice).toFixed(2);
        document.getElementById("giftCode").textContent = data.code;

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

        if (data.redeemed) {
          document.getElementById("giftStatus").innerHTML = '<div style="color:#dc2626;font-weight:600;">This gift card has already been redeemed</div>';
        } else {
          document.getElementById("giftStatus").innerHTML = '<div style="color:#2d5a27;font-weight:600;">✓ Valid — Ready to use!</div>';
          const link = document.getElementById("bookLink");
          link.href = window.location.origin + "/api/book/" + data.businessSlug;
          link.style.display = "block";
        }
      } catch(e) {
        document.getElementById("loading").style.display = "none";
        document.getElementById("giftError").style.display = "block";
      }
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
