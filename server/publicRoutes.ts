import { Express, Request, Response } from "express";
import * as db from "./db";
import { sendBookingNotificationEmail } from "./email";
import { notifyOwner } from "./_core/notification";
import {
  notifyNewBooking,
  notifyCancellation,
  notifyReschedule,
  notifyWaitlist,
} from "./push";

// ─── Rate limiter for Manus platform notifyOwner ────────────────────────────
// Manus platform notifications have a strict rate limit per project.
// We throttle to at most 1 notification per 60 seconds globally to avoid
// "Rate Exceeded" errors when multiple bookings arrive in quick succession.
const NOTIFY_OWNER_COOLDOWN_MS = 60_000; // 60 seconds
let lastNotifyOwnerAt = 0;

async function throttledNotifyOwner(payload: Parameters<typeof notifyOwner>[0]): Promise<boolean> {
  const now = Date.now();
  if (now - lastNotifyOwnerAt < NOTIFY_OWNER_COOLDOWN_MS) {
    console.log("[Notify] Skipping Manus notification (rate limit cooldown active)");
    return false;
  }
  lastNotifyOwnerAt = now;
  try {
    return await notifyOwner(payload);
  } catch (err: any) {
    // Silently swallow rate limit errors so they don't break the booking flow
    if (err?.message?.includes("Rate") || err?.message?.includes("rate") || err?.code === "TOO_MANY_REQUESTS") {
      console.warn("[Notify] Manus notification rate limit hit, skipping.");
      return false;
    }
    throw err;
  }
}

// ─── Helper: Generate available time slots ──────────────────────────────────
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
  scheduleMode: "weekly" | "custom" = "weekly",
  bufferTime: number = 0
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
    const abbr3 = dayName.slice(0, 3);
    const wh = workingHours?.[dayName] || workingHours?.[dayName.toLowerCase()] || workingHours?.[abbr3] || workingHours?.[abbr3.toLowerCase()];
    if (customDay) {
      if (!customDay.isOpen) return [];
      if (customDay.startTime && customDay.endTime) {
        // Workday ON with explicit hours — use them regardless of weekly schedule
        startMin = timeToMinutes(customDay.startTime);
        endMin = timeToMinutes(customDay.endTime);
      } else {
        // Workday ON but no explicit hours — use weekly hours as fallback.
        // Still open even if the weekly day is normally disabled.
        startMin = timeToMinutes(wh?.start || "09:00");
        endMin = timeToMinutes(wh?.end || "17:00");
      }
    } else {
      // No custom override — use weekly working hours
      // workingHours keys may be stored as full names ("Monday"), lowercase ("monday"),
      // or 3-letter abbreviations ("Mon") — check all three forms.
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

  // Only show slots that start strictly in the future (current minute is already in progress)
  for (let t = startMin; t + duration <= endMin; t += interval) {
    // Skip past times for today
    if (date === today && t <= currentMinutes) continue;

    // Check for conflicts
    const slotEnd = t + duration;
    const conflict = bookedSlots.some(
      (b: any) => t < (b.end + bufferTime) && slotEnd > (b.start - bufferTime)
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
      const locationIdFilter = req.query.locationId as string | undefined;
      const filteredServices = locationIdFilter
        ? servicesList.filter((s) => {
            const locIds: string[] | null = Array.isArray(s.locationIds)
              ? s.locationIds
              : s.locationIds
              ? JSON.parse(s.locationIds as unknown as string)
              : null;
            // null/empty locationIds means available at all locations
            if (!locIds || locIds.length === 0) return true;
            return locIds.includes(locationIdFilter);
          })
        : servicesList;
      // Count appointments per service for "Most Popular" ranking
      const appts = await db.getAppointmentsByOwner(owner.id);
      const apptCountMap: Record<string, number> = {};
      appts.forEach((a: any) => {
        if (a.serviceLocalId) {
          apptCountMap[a.serviceLocalId] = (apptCountMap[a.serviceLocalId] || 0) + 1;
        }
      });
      res.json(filteredServices.map((s) => ({
        localId: s.localId,
        name: s.name,
        duration: s.duration,
        price: s.price,
        color: s.color,
        category: s.category || null,
        description: (s as any).description || null,
        photoUri: (s as any).photoUri || null,
        appointmentCount: apptCountMap[s.localId] || 0,
        locationIds: Array.isArray(s.locationIds)
          ? s.locationIds
          : s.locationIds
          ? JSON.parse(s.locationIds as unknown as string)
          : null,
      })));
    } catch (err) {
      console.error("[Public API] Error fetching services:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Get staff members for a business (public-facing) */
  app.get("/api/public/business/:slug/staff", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).json({ error: "Business not found" });
        return;
      }
      const staffList = await db.getStaffByOwner(owner.id);
      // Only return active staff with their name, services, and working hours
      res.json(staffList.filter((s: any) => s.active !== false).map((s: any) => ({
        localId: s.localId,
        name: s.name,
        role: s.role || "",
        color: s.color || "#6366f1",
        serviceIds: Array.isArray(s.serviceIds) ? s.serviceIds : (s.serviceIds ? JSON.parse(s.serviceIds) : []),
        locationIds: Array.isArray(s.locationIds) ? s.locationIds : (s.locationIds ? JSON.parse(s.locationIds) : null),
        workingHours: s.workingHours ? (typeof s.workingHours === 'object' ? s.workingHours : JSON.parse(s.workingHours)) : null,
      })));
    } catch (err) {
      console.error("[Public API] Error fetching staff:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Get locations for a business */
  app.get("/api/public/business/:slug/locations", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).json({ error: "Business not found" });
        return;
      }
      const locs = await db.getLocationsByOwner(owner.id);
      res.json(locs.filter((l: any) => l.active !== false).map((l: any) => {
        const parts = [l.address?.trim(), l.city?.trim(), l.state?.trim() && l.zipCode?.trim() ? `${l.state.trim()} ${l.zipCode.trim()}` : (l.state?.trim() || l.zipCode?.trim())].filter(Boolean);
        const fullAddress = parts.join(", ");
        return {
          localId: l.localId,
          name: l.name,
          address: fullAddress || l.address || "",
          phone: l.phone || "",
          email: l.email || "",
          active: l.active,
          workingHours: l.workingHours ? (typeof l.workingHours === 'object' ? l.workingHours : JSON.parse(l.workingHours)) : null,
          temporarilyClosed: l.temporarilyClosed ?? false,
          reopenOn: l.reopenOn ?? null,
        };
      }));
    } catch (err) {
      console.error("[Public API] Error fetching locations:", err);
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
      const staffLocalId = req.query.staffId as string | undefined;
      const locationLocalId = req.query.locationId as string | undefined;
      if (!date) {
        res.status(400).json({ error: "date query parameter is required" });
        return;
      }
      // Check Active Until expiry
      const endDate = (owner as any).businessHoursEndDate as string | null | undefined;
      if (endDate && date > endDate) {
        res.json({ date, slots: [], slotLocationCounts: {} });
        return;
      }
      const allAppts = await db.getAppointmentsByOwner(owner.id);
      const allSchedule = await db.getCustomScheduleByOwner(owner.id);
      const mode = (owner.scheduleMode as "weekly" | "custom") || "weekly";
      const buffer = (owner as any).bufferTime || 0;
      // Effective slot step: use configured slotInterval when non-zero, else auto (duration capped at 30)
      const configuredInterval = (owner as any).slotInterval ?? 0;
      const getStep = (dur: number) => configuredInterval > 0 ? configuredInterval : Math.min(dur, 30);

      // When a specific location is requested, use single-location logic (staff > location > global)
      if (locationLocalId) {
        const appts = allAppts.filter((a: any) => a.locationId === locationLocalId);
        const schedule = allSchedule.filter((cs: any) => cs.locationId === locationLocalId || cs.locationId == null);
        let effectiveWorkingHours = owner.workingHours;
        const locs = await db.getLocationsByOwner(owner.id);
        const loc = locs.find((l: any) => l.localId === locationLocalId);
        if (loc && loc.workingHours) {
          const locWh = typeof loc.workingHours === 'object' ? loc.workingHours : JSON.parse(loc.workingHours as string);
          effectiveWorkingHours = locWh;
        }
        if (staffLocalId) {
          const staffList = await db.getStaffByOwner(owner.id);
          const staff = staffList.find((s: any) => s.localId === staffLocalId);
          if (staff && staff.workingHours) {
            const staffWh = typeof staff.workingHours === 'object' ? staff.workingHours : JSON.parse(staff.workingHours as string);
            effectiveWorkingHours = staffWh;
          }
        }
        const slots = generateAvailableSlots(date, duration, effectiveWorkingHours, appts, getStep(duration), schedule, mode, buffer);
        // Single-location: each slot has exactly 1 location
        const slotLocationCounts: Record<string, number> = {};
        slots.forEach((s) => { slotLocationCounts[s] = 1; });
        res.json({ date, slots, slotLocationCounts });
        return;
      }

      // No location specified: compute UNION of slots across all active locations.
      // Each slot is annotated with how many locations have it available.
      const locs = await db.getLocationsByOwner(owner.id);
      const activeLocs = locs.filter((l: any) => l.active !== false && !l.temporarilyClosed);

      // If no active locations, fall back to global working hours
      if (activeLocs.length === 0) {
        let effectiveWorkingHours = owner.workingHours;
        if (staffLocalId) {
          const staffList = await db.getStaffByOwner(owner.id);
          const staff = staffList.find((s: any) => s.localId === staffLocalId);
          if (staff && staff.workingHours) {
            const staffWh = typeof staff.workingHours === 'object' ? staff.workingHours : JSON.parse(staff.workingHours as string);
            effectiveWorkingHours = staffWh;
          }
        }
        const slots = generateAvailableSlots(date, duration, effectiveWorkingHours, allAppts, getStep(duration), allSchedule, mode, buffer);
        const slotLocationCounts: Record<string, number> = {};
        slots.forEach((s) => { slotLocationCounts[s] = 1; });
        res.json({ date, slots, slotLocationCounts });
        return;
      }

      // Resolve staff working hours override (applies to all locations equally)
      let staffWorkingHours: any = null;
      if (staffLocalId) {
        const staffList = await db.getStaffByOwner(owner.id);
        const staff = staffList.find((s: any) => s.localId === staffLocalId);
        if (staff && staff.workingHours) {
          staffWorkingHours = typeof staff.workingHours === 'object' ? staff.workingHours : JSON.parse(staff.workingHours as string);
        }
      }

      // Compute per-location slot counts for the union
      const slotLocationCounts: Record<string, number> = {};
      for (const loc of activeLocs) {
        const locAppts = allAppts.filter((a: any) => a.locationId === loc.localId);
        const locSchedule = allSchedule.filter((cs: any) => cs.locationId === loc.localId || cs.locationId == null);
        let locWH = owner.workingHours;
        if (loc.workingHours) {
          const parsed = typeof loc.workingHours === 'object' ? loc.workingHours : JSON.parse(loc.workingHours as string);
          if (parsed && Object.keys(parsed).length > 0) locWH = parsed;
        }
        // Staff hours override location hours
        const effectiveWH = staffWorkingHours ?? locWH;
        const locSlots = generateAvailableSlots(date, duration, effectiveWH, locAppts, getStep(duration), locSchedule, mode, buffer);
        locSlots.forEach((s) => { slotLocationCounts[s] = (slotLocationCounts[s] ?? 0) + 1; });
      }

      // Union of all slots, sorted chronologically
      const slots = Object.keys(slotLocationCounts).sort();
      res.json({ date, slots, slotLocationCounts });
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
        brand: p.brand || null,
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
      const locationIdWd = req.query.locationId as string | undefined;
      const allScheduleWd = await db.getCustomScheduleByOwner(owner.id);
      // Use location-scoped working hours when a locationId is provided
      let wh: Record<string, any> = owner.workingHours || {};
      if (locationIdWd) {
        const locs = await db.getLocationsByOwner(owner.id);
        const loc = locs.find((l: any) => l.localId === locationIdWd);
        if (loc && loc.workingHours) {
          const locWh = typeof loc.workingHours === 'object' ? loc.workingHours : JSON.parse(loc.workingHours as string);
          if (locWh && Object.keys(locWh).length > 0) wh = locWh;
        }
      }
      // Build weekly working days
      // workingHours keys may be stored as full names ("Monday"), lowercase ("monday"),
      // or 3-letter abbreviations ("Mon") — check all three forms.
      const weeklyDays: Record<string, boolean> = {};
      DAYS_OF_WEEK.forEach((day) => {
        const abbr = day.slice(0, 3); // e.g. "Mon", "Tue"
        const entry = wh[day] || wh[day.toLowerCase()] || wh[abbr] || wh[abbr.toLowerCase()];
        weeklyDays[day] = !!(entry && entry.enabled);
      });
      // Custom overrides filtered to this location (or global overrides if no locationId)
      const scheduleForLoc = locationIdWd
        ? allScheduleWd.filter((cs: any) => cs.locationId === locationIdWd || cs.locationId == null)
        : allScheduleWd;
      const customDays: Record<string, boolean> = {};
      scheduleForLoc.forEach((cs: any) => {
        customDays[cs.date] = cs.isOpen ?? true;
      });
      const scheduleMode = (owner.scheduleMode as string) || "weekly";
      const businessHoursEndDate = (owner as any).businessHoursEndDate || null;
      res.json({ weeklyDays, customDays, scheduleMode, businessHoursEndDate });
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

      const { clientName, clientPhone, clientEmail, serviceLocalId, date, time, duration, notes, giftCode, totalPrice, extraItems, giftApplied, giftUsedAmount, discountName, discountPercentage, discountAmount, subtotal, locationId } = req.body;

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
      const allBookAppts = await db.getAppointmentsByOwner(owner.id);
      const allBookSchedule = await db.getCustomScheduleByOwner(owner.id);
      const svcList = await db.getServicesByOwner(owner.id);
      const svc = svcList.find((s) => s.localId === serviceLocalId);
      const dur = duration || svc?.duration || 60;

      // Scope appointments and custom schedule to the selected location for accurate validation
      const bookAppts = locationId
        ? allBookAppts.filter((a: any) => a.locationId === locationId)
        : allBookAppts;
      const bookSchedule = locationId
        ? allBookSchedule.filter((cs: any) => cs.locationId === locationId || cs.locationId == null)
        : allBookSchedule;

      // Use location-scoped working hours for validation
      let bookWorkingHours = owner.workingHours;
      let bookLocationName: string | undefined;
      let bookLocationAddress: string | undefined;
      if (locationId) {
        const locs = await db.getLocationsByOwner(owner.id);
        const loc = locs.find((l: any) => l.localId === locationId);
        if (loc) {
          bookLocationName = loc.name || undefined;
          // Build full address including city/state/zip
          const addrParts = [
            loc.address?.trim(),
            loc.city?.trim(),
            loc.state?.trim() && loc.zipCode?.trim() ? `${loc.state.trim()} ${loc.zipCode.trim()}` : (loc.state?.trim() || loc.zipCode?.trim()),
          ].filter(Boolean);
          bookLocationAddress = addrParts.join(", ") || loc.address || undefined;
          if (loc.workingHours) {
            const locWh = typeof loc.workingHours === 'object' ? loc.workingHours : JSON.parse(loc.workingHours as string);
            if (locWh && Object.keys(locWh).length > 0) bookWorkingHours = locWh;
          }
        }
      }

      const bookMode = (owner.scheduleMode as "weekly" | "custom") || "weekly";
      const bookBuffer = (owner as any).bufferTime || 0;
      const slots = generateAvailableSlots(date, dur, bookWorkingHours, bookAppts, Math.min(dur, 30), bookSchedule, bookMode, bookBuffer);
      if (!slots.includes(time)) {
        res.status(400).json({ error: "Selected time slot is no longer available" });
        return;
      }

      // Validate gift card balance BEFORE creating the appointment
      if (giftCode && giftApplied) {
        const gcValidate = await db.getGiftCardByCode(giftCode, owner.id);
        if (!gcValidate) {
          res.status(400).json({ error: "Gift card not found or does not belong to this business" });
          return;
        }
        // Check expiry date
        if (gcValidate.expiresAt) {
          const today = new Date().toISOString().split('T')[0];
          if (gcValidate.expiresAt < today) {
            res.status(400).json({ error: `This gift card expired on ${gcValidate.expiresAt}` });
            return;
          }
        }
        // Parse current balance from message field (GIFT_DATA block or raw JSON)
        let gcMeta: any = {};
        const gcMsgStr = gcValidate.message || "";
        const gcDataMatch = gcMsgStr.match(/\n---GIFT_DATA---\n(.+)$/s);
        if (gcDataMatch) {
          try { gcMeta = JSON.parse(gcDataMatch[1]); } catch (_) {}
        } else {
          try { gcMeta = JSON.parse(gcMsgStr); } catch (_) {}
        }
        const gcCurrentBalance = gcMeta.remainingBalance ?? gcMeta.originalValue ?? 0;
        if (gcCurrentBalance <= 0) {
          res.status(400).json({ error: "This gift card has no remaining balance" });
          return;
        }
        const gcRequestedAmt = giftUsedAmount ? parseFloat(String(giftUsedAmount)) : 0;
        if (gcRequestedAmt > gcCurrentBalance + 0.01) { // 1-cent tolerance for float rounding
          res.status(400).json({ error: `Gift card balance ($${gcCurrentBalance.toFixed(2)}) is less than the requested amount ($${gcRequestedAmt.toFixed(2)})` });
          return;
        }
      }

      // Build enriched notes with pricing details
      let enrichedNotes = notes || "";
      const svcPrice = svc ? parseFloat(String(svc.price)) : 0;
      const extras: { name: string; price: number; type: string }[] = Array.isArray(extraItems) ? extraItems : [];
      const extrasTotal = extras.reduce((s: number, e: { price: number }) => s + (e.price || 0), 0);
      const finalTotal = totalPrice != null ? parseFloat(String(totalPrice)) : svcPrice + extrasTotal;

      const hasDiscount = discountAmount && parseFloat(String(discountAmount)) > 0;
      if (extras.length > 0 || giftApplied || hasDiscount) {
        const pricingLines: string[] = [];
        pricingLines.push(`Service: ${svc?.name ?? "Service"} \u2014 $${svcPrice.toFixed(2)}`);
        extras.forEach((e: { name: string; price: number; type: string }) => {
          pricingLines.push(`${e.type === "product" ? "Product" : "Extra"}: ${e.name} \u2014 $${(e.price || 0).toFixed(2)}`);
        });
        if (hasDiscount) {
          const dName = discountName || "Discount";
          const dPct = discountPercentage ? parseInt(String(discountPercentage), 10) : 0;
          const dAmt = parseFloat(String(discountAmount));
          pricingLines.push(`Discount: ${dName} (${dPct}% off): -$${dAmt.toFixed(2)}`);
        }
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
        totalPrice: finalTotal != null ? String(finalTotal) : null,
        discountPercent: discountPercentage ? parseInt(String(discountPercentage), 10) : null,
        discountAmount: hasDiscount ? String(parseFloat(String(discountAmount))) : null,
        discountName: discountName || null,
        extraItems: extras.length > 0 ? JSON.stringify(extras) : null,
        giftApplied: !!giftApplied,
        giftUsedAmount: giftUsedAmount ? String(parseFloat(String(giftUsedAmount))) : null,
        locationId: locationId || null,
      });

      // Atomically deduct from gift card balance (prevents double-spend race conditions)
      if (giftCode) {
        const usedAmt = giftUsedAmount ? parseFloat(String(giftUsedAmount)) : (svcPrice + extrasTotal);
        const deductResult = await db.atomicDeductGiftCardBalance(giftCode, owner.id, usedAmt);
        if (!deductResult.success) {
          // Deduction failed (race condition: another request already deducted the balance)
          // The appointment was already saved — mark it with a note about the gift card issue
          console.warn(`[GiftCard] Atomic deduction failed for ${giftCode}: ${deductResult.reason}`);
          // Still allow the booking but log the discrepancy
        }
      }

      // Send branded email notification via Resend
      const ownerNotifPrefs = (owner as any).notificationPreferences ?? {};
      const emailOnNewBookingEnabled = ownerNotifPrefs.emailOnNewBooking !== false;
      if (owner.email && emailOnNewBookingEnabled) {
        try {
          await sendBookingNotificationEmail(owner.email, owner.businessName, {
            clientName,
            clientPhone: clientPhone || undefined,
            serviceName: svc?.name ?? "Service",
            date,
            time,
            duration: dur,
            totalPrice: finalTotal ?? undefined,
            extras: extras.length > 0 ? extras : undefined,
            giftApplied: !!giftApplied,
            giftUsedAmount: giftUsedAmount ? parseFloat(String(giftUsedAmount)) : undefined,
            notes: enrichedNotes || undefined,
            locationName: bookLocationName,
            locationAddress: bookLocationAddress,
          });
        } catch (emailErr) {
          console.warn("[Public API] Failed to send email notification:", emailErr);
        }
      }

      // Send push notification to business owner's device
      const pushOnNewBookingEnabled = ownerNotifPrefs.pushOnNewBooking !== false;
      if (pushOnNewBookingEnabled) try {
        const ownerPushToken = (owner as any).expoPushToken as string | null | undefined;
        if (ownerPushToken) {
          // Send Expo push notification directly to owner's device (appears as "Lime Of Time")
          await notifyNewBooking(
            ownerPushToken,
            owner.businessName,
            clientName,
            svc?.name ?? "a service",
            date,
            time,
            appointmentLocalId,
            {
              duration: dur,
              locationName: bookLocationName || undefined,
              clientPhone: clientPhone || undefined,
              notes: enrichedNotes || undefined,
            }
          );
        } else {
          // Fallback: Manus platform notification (no device token registered yet)
          const extrasLabel = extras.length > 0 ? ` + ${extras.length} extra` : "";
          const phoneLabel = clientPhone ? ` | 📞 ${formatPhoneNumber(clientPhone)}` : "";
          const priceLabel = finalTotal > 0 ? ` | $${finalTotal.toFixed(2)}` : "";
          await throttledNotifyOwner({
            title: `📅 New Booking Request — ${owner.businessName}`,
            content: `${clientName}${phoneLabel} requested ${svc?.name ?? "a service"}${extrasLabel}\nDate: ${date} at ${time} (${dur} min)${priceLabel}\nTap to review and confirm.`,
          });
        }
      } catch (pushErr) {
        console.warn("[Public API] Failed to send push notification:", pushErr);
      }

      res.json({
        success: true,
        appointmentId: appointmentLocalId,
        manageUrl: `https://lime-of-time.com/manage/${req.params.slug}/${appointmentLocalId}`,
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

  // ── Cancel / Reschedule ────────────────────────────────────────────

  /** Get appointment details for cancel/reschedule page */
  app.get("/api/public/appointment/:appointmentId", async (req: Request, res: Response) => {
    try {
      const { appointmentId } = req.params;
      const { slug } = req.query;
      if (!slug) {
        res.status(400).json({ error: "slug query parameter is required" });
        return;
      }
      const owner = await db.getBusinessOwnerBySlug(slug as string);
      if (!owner) {
        res.status(404).json({ error: "Business not found" });
        return;
      }
      const appt = await db.getAppointmentByLocalId(appointmentId, owner.id);
      if (!appt) {
        res.status(404).json({ error: "Appointment not found" });
        return;
      }
      const svcList = await db.getServicesByOwner(owner.id);
      const svc = svcList.find((s) => s.localId === appt.serviceLocalId);
      const clientList = await db.getClientsByOwner(owner.id);
      const client = clientList.find((c) => c.localId === appt.clientLocalId);
      res.json({
        localId: appt.localId,
        date: appt.date,
        time: appt.time,
        duration: appt.duration,
        status: appt.status,
        serviceName: svc?.name || "Service",
        serviceLocalId: appt.serviceLocalId,
        clientName: client?.name || "Client",
        businessName: owner.businessName,
      });
    } catch (err) {
      console.error("[Public API] Error fetching appointment:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Cancel an appointment from client side */
  app.post("/api/public/appointment/:appointmentId/cancel", async (req: Request, res: Response) => {
    try {
      const { appointmentId } = req.params;
      const { slug, clientPhone } = req.body;
      if (!slug) {
        res.status(400).json({ error: "slug is required" });
        return;
      }
      const owner = await db.getBusinessOwnerBySlug(slug);
      if (!owner) {
        res.status(404).json({ error: "Business not found" });
        return;
      }
      const appt = await db.getAppointmentByLocalId(appointmentId, owner.id);
      if (!appt) {
        res.status(404).json({ error: "Appointment not found" });
        return;
      }
      if (appt.status === "cancelled" || appt.status === "completed") {
        res.status(400).json({ error: `Appointment is already ${appt.status}` });
        return;
      }
      // Verify client identity by phone
      const clientList = await db.getClientsByOwner(owner.id);
      const client = clientList.find((c) => c.localId === appt.clientLocalId);
      const normPhone = (p: string) => {
        const d = p.replace(/\D/g, "");
        return d.length >= 10 ? d.slice(-10) : d;
      };
      // If client has a phone on record, require verification
      if (client && client.phone && client.phone.trim()) {
        if (!clientPhone || !clientPhone.trim()) {
          res.status(403).json({ error: "Please enter your phone number to verify your identity." });
          return;
        }
        if (normPhone(clientPhone) !== normPhone(client.phone)) {
          res.status(403).json({ error: "Phone number does not match. Please enter the phone number used when booking." });
          return;
        }
      }
      // If client has no phone on record, allow action without phone verification
      await db.updateAppointment(appointmentId, owner.id, { status: "cancelled" });
      // Notify business owner
      const cancelNotifPrefs = (owner as any).notificationPreferences ?? {};
      const pushOnCancellationEnabled = cancelNotifPrefs.pushOnCancellation !== false;
      if (pushOnCancellationEnabled) try {
        const svcList = await db.getServicesByOwner(owner.id);
        const svc = svcList.find((s) => s.localId === appt.serviceLocalId);
        const ownerPushToken = (owner as any).expoPushToken as string | null | undefined;
        // Resolve location name for enriched notification
        let cancelLocationName: string | undefined;
        if (appt.locationId) {
          const locs = await db.getLocationsByOwner(owner.id);
          cancelLocationName = (locs as any[]).find((l: any) => l.localId === appt.locationId)?.name;
        }
        if (ownerPushToken) {
          await notifyCancellation(
            ownerPushToken,
            owner.businessName,
            client?.name || "A client",
            svc?.name || "appointment",
            appt.date,
            appt.time,
            appointmentId,
            {
              duration: appt.duration || undefined,
              locationName: cancelLocationName,
              clientPhone: client?.phone || undefined,
            }
          );
        } else {
          await throttledNotifyOwner({
            title: `❌ Appointment Cancelled — ${owner.businessName}`,
            content: `${client?.name || "A client"} cancelled their ${svc?.name || "appointment"}\nDate: ${appt.date} at ${appt.time} (${appt.duration} min)\nTap to view your calendar.`,
          });
        }
      } catch (pushErr) {
        console.warn("[Public API] Failed to send cancellation notification:", pushErr);
      }
      // Check waitlist for this slot
      const waitlistEntries = await db.getWaitlistForDateAndService(owner.id, appt.date, appt.serviceLocalId);
      if (waitlistEntries.length > 0) {
        // Mark first waitlist entry as notified
        await db.updateWaitlistEntry(waitlistEntries[0].id, { status: "notified" });
      }
      res.json({ success: true, message: "Appointment cancelled successfully." });
    } catch (err) {
      console.error("[Public API] Error cancelling appointment:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Reschedule an appointment from client side */
  app.post("/api/public/appointment/:appointmentId/reschedule", async (req: Request, res: Response) => {
    try {
      const { appointmentId } = req.params;
      const { slug, clientPhone, newDate, newTime } = req.body;
      if (!slug || !newDate || !newTime) {
        res.status(400).json({ error: "slug, newDate, and newTime are required" });
        return;
      }
      const owner = await db.getBusinessOwnerBySlug(slug);
      if (!owner) {
        res.status(404).json({ error: "Business not found" });
        return;
      }
      const appt = await db.getAppointmentByLocalId(appointmentId, owner.id);
      if (!appt) {
        res.status(404).json({ error: "Appointment not found" });
        return;
      }
      if (appt.status === "cancelled" || appt.status === "completed") {
        res.status(400).json({ error: `Cannot reschedule a ${appt.status} appointment` });
        return;
      }
      // Only confirmed appointments can be rescheduled (pending ones must be cancelled)
      if (appt.status === "pending") {
        res.status(400).json({ error: "Pending appointments cannot be rescheduled. Please cancel and rebook, or wait for the business to confirm your appointment first." });
        return;
      }
      // Enforce 24-hour reschedule window
      const apptDateTime = new Date(`${appt.date}T${appt.time}:00`);
      const hoursUntilAppt = (apptDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilAppt <= 24) {
        res.status(400).json({ error: "Rescheduling is not available within 24 hours of the appointment time. You may still cancel the appointment." });
        return;
      }
      // Verify client identity by phone
      const clientList = await db.getClientsByOwner(owner.id);
      const client = clientList.find((c) => c.localId === appt.clientLocalId);
      const normPhone2 = (p: string) => {
        const d = p.replace(/\D/g, "");
        return d.length >= 10 ? d.slice(-10) : d;
      };
      // If client has a phone on record, require verification
      if (client && client.phone && client.phone.trim()) {
        if (!clientPhone || !clientPhone.trim()) {
          res.status(403).json({ error: "Please enter your phone number to verify your identity." });
          return;
        }
        if (normPhone2(clientPhone) !== normPhone2(client.phone)) {
          res.status(403).json({ error: "Phone number does not match. Please enter the phone number used when booking." });
          return;
        }
      }
      // Verify new slot is available
      const appts = await db.getAppointmentsByOwner(owner.id);
      const allReschedSchedule = await db.getCustomScheduleByOwner(owner.id);
      const mode = (owner.scheduleMode as "weekly" | "custom") || "weekly";
      const bufferVal = (owner as any).bufferTime || 0;
      // Use location-scoped working hours and custom schedule when appointment has a locationId
      let reschedWorkingHours = owner.workingHours;
      const reschedLocationId = (appt as any).locationId;
      const reschedSchedule = reschedLocationId
        ? allReschedSchedule.filter((cs: any) => cs.locationId === reschedLocationId || cs.locationId == null)
        : allReschedSchedule;
      if (reschedLocationId) {
        const locs = await db.getLocationsByOwner(owner.id);
        const loc = locs.find((l: any) => l.localId === reschedLocationId);
        if (loc && loc.workingHours) {
          const locWh = typeof loc.workingHours === 'object' ? loc.workingHours : JSON.parse(loc.workingHours as string);
          if (locWh && Object.keys(locWh).length > 0) reschedWorkingHours = locWh;
        }
      }
      // Exclude current appointment from conflict check
      const otherAppts = appts.filter((a: any) => a.localId !== appointmentId);
      const slots = generateAvailableSlots(newDate, appt.duration, reschedWorkingHours, otherAppts, Math.min(appt.duration, 30), reschedSchedule, mode, bufferVal);
      if (!slots.includes(newTime)) {
        res.status(400).json({ error: "Selected time slot is not available" });
        return;
      }
      await db.updateAppointment(appointmentId, owner.id, {
        date: newDate,
        time: newTime,
        status: "pending",
      });
      // Notify business owner
      const reschedNotifPrefs = (owner as any).notificationPreferences ?? {};
      const pushOnRescheduleEnabled = reschedNotifPrefs.pushOnReschedule !== false;
      if (pushOnRescheduleEnabled) try {
        const svcList = await db.getServicesByOwner(owner.id);
        const svc = svcList.find((s) => s.localId === appt.serviceLocalId);
        const ownerPushToken = (owner as any).expoPushToken as string | null | undefined;
        // Resolve location name for enriched notification
        let reschedLocationName: string | undefined;
        if (appt.locationId) {
          const locs = await db.getLocationsByOwner(owner.id);
          reschedLocationName = (locs as any[]).find((l: any) => l.localId === appt.locationId)?.name;
        }
        if (ownerPushToken) {
          await notifyReschedule(
            ownerPushToken,
            owner.businessName,
            client?.name || "A client",
            svc?.name || "appointment",
            newDate,
            newTime,
            appointmentId,
            {
              oldDate: appt.date,
              oldTime: appt.time,
              duration: appt.duration || undefined,
              locationName: reschedLocationName,
              clientPhone: client?.phone || undefined,
            }
          );
        } else {
          await throttledNotifyOwner({
            title: `🔄 Appointment Rescheduled — ${owner.businessName}`,
            content: `${client?.name || "A client"} rescheduled their ${svc?.name || "appointment"}\nNew date: ${newDate} at ${newTime}\nTap to review and confirm.`,
          });
        }
      } catch (pushErr) {
        console.warn("[Public API] Failed to send reschedule notification:", pushErr);
      }
      res.json({ success: true, message: "Appointment rescheduled successfully. The business will confirm your new time." });
    } catch (err) {
      console.error("[Public API] Error rescheduling appointment:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Waitlist ───────────────────────────────────────────────────────

  /** Join waitlist for a fully booked slot */
  app.post("/api/public/business/:slug/waitlist", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).json({ error: "Business not found" });
        return;
      }
      const { clientName, clientPhone, clientEmail, serviceLocalId, preferredDate, notes } = req.body;
      if (!clientName || !serviceLocalId || !preferredDate) {
        res.status(400).json({ error: "Missing required fields: clientName, serviceLocalId, preferredDate" });
        return;
      }
      await db.createWaitlistEntry({
        businessOwnerId: owner.id,
        clientName,
        clientPhone: clientPhone || null,
        clientEmail: clientEmail || null,
        serviceLocalId,
        preferredDate,
        notes: notes || null,
      });
      // Notify business owner
      const waitlistNotifPrefs = (owner as any).notificationPreferences ?? {};
      const pushOnWaitlistEnabled = waitlistNotifPrefs.pushOnWaitlist !== false;
      if (pushOnWaitlistEnabled) try {
        const svcList = await db.getServicesByOwner(owner.id);
        const svc = svcList.find((s) => s.localId === serviceLocalId);
        const ownerPushToken = (owner as any).expoPushToken as string | null | undefined;
        if (ownerPushToken) {
          await notifyWaitlist(
            ownerPushToken,
            owner.businessName,
            clientName,
            svc?.name || "a service",
            preferredDate,
            {
              clientPhone: clientPhone || undefined,
              notes: notes || undefined,
            }
          );
        } else {
          await throttledNotifyOwner({
            title: `⏳ New Waitlist Entry — ${owner.businessName}`,
            content: `${clientName} joined the waitlist for ${svc?.name || "a service"}\nPreferred date: ${preferredDate}\nTap to view waitlist.`,
          });
        }
      } catch (pushErr) {
        console.warn("[Public API] Failed to send waitlist notification:", pushErr);
      }
      res.json({ success: true, message: "You've been added to the waitlist! We'll notify you if a spot opens up." });
    } catch (err) {
      console.error("[Public API] Error adding to waitlist:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Get waitlist entries for admin/business owner */
  app.get("/api/public/business/:slug/waitlist", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).json({ error: "Business not found" });
        return;
      }
      const entries = await db.getWaitlistByOwner(owner.id);
      res.json(entries);
    } catch (err) {
      console.error("[Public API] Error fetching waitlist:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Manage Appointment Page (client self-service) ─────────────────

  /** Client appointment management page */
  app.get("/api/manage/:slug/:appointmentId", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).send(notFoundPage("Business not found"));
        return;
      }
      const appt = await db.getAppointmentByLocalId(req.params.appointmentId, owner.id);
      if (!appt) {
        res.status(404).send(notFoundPage("Appointment not found"));
        return;
      }
      // Load client data to auto-populate phone
      const clientList = await db.getClientsByOwner(owner.id);
      const client = clientList.find((c: any) => c.localId === appt.clientLocalId);
      // Load locations so the manage page can display which location the appointment is at
      const locationsList = await db.getLocationsByOwner(owner.id);
      res.send(manageAppointmentPage(req.params.slug, owner, appt, client || null, locationsList));
    } catch (err) {
      console.error("[Public] Error serving manage page:", err);
      res.status(500).send(errorPage());
    }
  });

  // ── HTML Pages ─────────────────────────────────────────────────────

  /** Redirect /book/:slug → /api/book/:slug so shared links work on the platform domain */
  app.get("/book/:slug", (req: Request, res: Response) => {
    const qs = req.query.location ? `?location=${encodeURIComponent(req.query.location as string)}` : "";
    res.redirect(301, `/api/book/${req.params.slug}${qs}`);
  });
  app.get("/book/:slug/:locationId", (req: Request, res: Response) => {
    res.redirect(301, `/api/book/${req.params.slug}/${req.params.locationId}`);
  });

  /** Booking page */
  app.get("/api/book/:slug", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).send(notFoundPage("Business not found"));
        return;
      }
      const locationId = (req.query.location as string) || null;
      // Pre-fetch locations to get the full address for the initial HTML render
      const locs = await db.getLocationsByOwner(owner.id);
      res.send(bookingPage(req.params.slug, owner, locationId, locs));
    } catch (err) {
      console.error("[Public] Error serving booking page:", err);
      res.status(500).send(errorPage());
    }
  });

  // Location-specific booking link: /api/book/:slug/:locationId
  app.get("/api/book/:slug/:locationId", async (req: Request, res: Response) => {
    try {
      const owner = await db.getBusinessOwnerBySlug(req.params.slug);
      if (!owner) {
        res.status(404).send(notFoundPage("Business not found"));
        return;
      }
      // Pre-fetch locations to get the full address for the initial HTML render
      const locs = await db.getLocationsByOwner(owner.id);
      res.send(bookingPage(req.params.slug, owner, req.params.locationId, locs));
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
      :root {
        --bg: #f5f7f5; --bg-card: #fff; --bg-card-hover: #f8fbf8;
        --bg-input: #fafcfa; --bg-selected: #e8f5e3; --bg-selected-hover: #f0f7ef;
        --text: #1a1a1a; --text-secondary: #666; --text-muted: #888; --text-hint: #999; --text-light: #aaa;
        --accent: #4a8c3f; --accent-dark: #2d5a27; --accent-bg: #e8f0e6; --accent-bg-light: #f0f7ef;
        --border: #e8ece8; --border-input: #dde3dd; --border-heavy: #e8ece8;
        --btn-disabled: #b8d4b3;
        --error: #dc2626; --error-bg: #fef2f2; --error-border: #fecaca;
        --discount-bg: #fef3c7; --discount-text: #92400e;
        --star: #f59e0b;
        --shadow: rgba(0,0,0,0.04);
        --skeleton-from: #e8ece8; --skeleton-to: #f5f7f5;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #0f1210; --bg-card: #1a1f1a; --bg-card-hover: #222822;
          --bg-input: #1e241e; --bg-selected: #1e3a1a; --bg-selected-hover: #243024;
          --text: #e8ece8; --text-secondary: #a8b0a8; --text-muted: #8a928a; --text-hint: #6a726a; --text-light: #5a625a;
          --accent: #5ca84f; --accent-dark: #7cc070; --accent-bg: #1e3a1a; --accent-bg-light: #243024;
          --border: #2a322a; --border-input: #3a423a; --border-heavy: #2a322a;
          --btn-disabled: #3a4a38;
          --error: #f87171; --error-bg: #2a1515; --error-border: #5a2020;
          --discount-bg: #3a3018; --discount-text: #fbbf24;
          --star: #fbbf24;
          --shadow: rgba(0,0,0,0.2);
          --skeleton-from: #2a322a; --skeleton-to: #1a1f1a;
        }
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: var(--bg);
        color: var(--text);
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
        padding: 28px 0 20px;
      }
      .header .biz-logo {
        width: 72px; height: 72px;
        border-radius: 20px;
        object-fit: cover;
        margin-bottom: 12px;
        border: 2px solid var(--border);
        box-shadow: 0 4px 16px rgba(0,0,0,0.1);
      }
      .header h1 {
        font-size: 24px;
        font-weight: 800;
        color: var(--accent-dark);
        margin-bottom: 4px;
        letter-spacing: -0.5px;
      }
      .header .subtitle {
        font-size: 12px;
        color: var(--text-muted);
        font-weight: 500;
      }
      .card {
        background: var(--bg-card);
        border-radius: 20px;
        padding: 22px;
        margin-bottom: 16px;
        border: 1px solid var(--border);
        box-shadow: 0 2px 12px var(--shadow), 0 1px 3px rgba(0,0,0,0.04);
      }
      .card h2 {
        font-size: 17px;
        font-weight: 700;
        color: var(--text);
        margin-bottom: 14px;
        letter-spacing: -0.3px;
      }
      .biz-info { display: flex; flex-direction: column; gap: 6px; }
      .biz-info-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }
      .biz-info-row a { color: var(--accent); text-decoration: underline; }
      .btn {
        display: block;
        width: 100%;
        padding: 15px;
        border: none;
        border-radius: 14px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
        letter-spacing: -0.1px;
      }
      .btn:active { opacity: 0.88; transform: scale(0.98); }
      .btn-primary {
        background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
        color: #fff;
        box-shadow: 0 4px 14px rgba(74,140,63,0.35);
      }
      .btn-primary:hover:not(:disabled) { box-shadow: 0 6px 18px rgba(74,140,63,0.45); }
      .btn-primary:disabled { background: var(--btn-disabled); cursor: not-allowed; box-shadow: none; }
      .btn-secondary {
        background: var(--accent-bg);
        color: var(--accent-dark);
        border: 1.5px solid var(--border);
      }
      .input-group { margin-bottom: 14px; }
      .input-group label {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 6px;
      }
      .input-group input, .input-group textarea {
        width: 100%;
        padding: 12px 14px;
        border: 1.5px solid var(--border-input);
        border-radius: 10px;
        font-size: 15px;
        background: var(--bg-input);
        color: var(--text);
        outline: none;
        transition: border-color 0.2s;
        font-family: inherit;
      }
      .input-group input:focus, .input-group textarea:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(74,140,63,0.15);
      }
      .input-group input::placeholder, .input-group textarea::placeholder {
        color: var(--text-hint);
      }
      .input-group textarea { resize: vertical; min-height: 80px; }
      .service-list { display: flex; flex-direction: column; gap: 12px; }
      .service-item {
        display: flex;
        align-items: center;
        padding: 14px 16px;
        border: 1.5px solid var(--border);
        border-radius: 14px;
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        background: var(--bg-card);
      }
      .service-item:hover { background: var(--bg-card-hover); border-color: var(--accent); }
      .service-item.selected { border-color: var(--accent); background: var(--accent-bg-light); box-shadow: 0 0 0 3px rgba(74,140,63,0.12); }
      .service-dot {
        width: 44px; height: 44px;
        border-radius: 10px;
        margin-right: 12px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 800;
        overflow: hidden;
      }
      .service-dot img { width:44px; height:44px; object-fit:cover; border-radius:10px; }
      .service-info { flex: 1; }
      .service-name { font-size: 15px; font-weight: 600; color: var(--text); }
      .service-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
      .service-price { font-size: 15px; font-weight: 700; color: var(--accent-dark); }
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
        border-radius: 12px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        border: 1.5px solid transparent;
        transition: all 0.15s;
      }
      .date-cell:hover:not(.disabled) { background: var(--accent-bg-light); border-color: var(--accent); }
      .date-cell.selected { border-color: var(--accent); background: var(--bg-selected); color: var(--accent-dark); font-weight: 700; box-shadow: 0 0 0 3px rgba(74,140,63,0.12); }
      .date-cell.disabled { opacity: 0.3; cursor: not-allowed; }
      .date-cell .day-name { font-size: 10px; color: var(--text-hint); font-weight: 400; }
      .date-cell .day-num { font-size: 15px; }
      .time-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .time-slot {
        padding: 11px 8px;
        text-align: center;
        border: 1.5px solid var(--border);
        border-radius: 12px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.15s;
        background: var(--bg-card);
      }
      .time-slot:hover { background: var(--accent-bg-light); border-color: var(--accent); }
      .time-slot.selected { border-color: var(--accent); background: var(--bg-selected); color: var(--accent-dark); font-weight: 700; box-shadow: 0 0 0 3px rgba(74,140,63,0.12); }
      .confirm-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid #f0f0f0;
        font-size: 14px;
      }
      .confirm-row:last-child { border-bottom: none; }
      .confirm-label { color: var(--text-muted); flex-shrink: 0; }
      .confirm-value { font-weight: 600; color: var(--text); text-align: right; }
      .success-icon {
        width: 64px; height: 64px;
        border-radius: 50%;
        background: var(--bg-selected);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        font-size: 32px;
      }
      .step-indicator {
        display: flex;
        align-items: flex-start;
        justify-content: center;
        gap: 0;
        margin-bottom: 24px;
        padding: 0 4px;
      }
      .step-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        position: relative;
      }
      .step-item:not(:last-child)::after {
        content: '';
        position: absolute;
        top: 13px;
        left: calc(50% + 14px);
        right: calc(-50% + 14px);
        height: 2px;
        background: var(--border);
        transition: background 0.3s;
        z-index: 0;
      }
      .step-item.done:not(:last-child)::after {
        background: var(--accent);
      }
      .step-dot {
        width: 26px; height: 26px;
        border-radius: 50%;
        background: var(--bg-card);
        border: 2px solid var(--border);
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700;
        color: var(--text-hint);
        transition: all 0.25s;
        position: relative; z-index: 1;
        margin-bottom: 4px;
      }
      .step-dot.active {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
        box-shadow: 0 0 0 4px rgba(74,140,63,0.15);
      }
      .step-dot.done {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }
      .step-label {
        font-size: 9px;
        font-weight: 500;
        color: var(--text-hint);
        text-align: center;
        transition: color 0.25s;
        line-height: 1.2;
        white-space: nowrap;
      }
      .step-item.active .step-label { color: var(--accent-dark); font-weight: 700; }
      .step-item.done .step-label { color: var(--accent); }
      .closed-banner {
        background: var(--error-bg);
        border: 1px solid var(--error-border);
        border-radius: 12px;
        padding: 16px;
        text-align: center;
        color: var(--error);
        font-weight: 500;
        margin-bottom: 16px;
      }
      .discount-badge {
        display: inline-block;
        background: var(--discount-bg);
        color: var(--discount-text);
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
      .review-stars { color: var(--star); font-size: 14px; }
      .review-name { font-weight: 600; font-size: 14px; margin-top: 4px; }
      .review-comment { font-size: 13px; color: #666; margin-top: 4px; }
      .review-date { font-size: 11px; color: #aaa; margin-top: 4px; }
      .loading { text-align: center; padding: 40px; color: var(--text-muted); }
      .error-msg { color: var(--error); font-size: 13px; margin-top: 8px; text-align: center; }
      /* Skeleton loading */
      .skeleton { background: linear-gradient(90deg, var(--skeleton-from) 25%, var(--skeleton-to) 50%, var(--skeleton-from) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 8px; }
      @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      .skeleton-line { height: 14px; margin-bottom: 10px; }
      .skeleton-block { height: 56px; margin-bottom: 8px; border-radius: 12px; }
      .cal-nav { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
      .cal-nav button { background:none; border:1px solid var(--border-input); border-radius:8px; padding:6px 12px; cursor:pointer; font-size:14px; color:var(--accent-dark); }
      .cal-nav button:hover { background:var(--accent-bg-light); }
      .cal-nav .cal-title { font-size:16px; font-weight:700; color:var(--text); }
      .cal-weekdays { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:4px; text-align:center; }
      .cal-weekdays span { font-size:11px; color:var(--text-hint); font-weight:500; padding:4px 0; }
      .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:16px; }
      .cal-day { aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:10px; cursor:pointer; font-size:14px; font-weight:500; border:2px solid transparent; transition:all 0.15s; position:relative; }
      .cal-day .avail-dot { width:5px; height:5px; border-radius:50%; background:var(--accent); margin-top:2px; }
      .cal-day.disabled .avail-dot { display:none; }
      .cal-day:hover:not(.disabled):not(.empty) { background:var(--accent-bg-light); }
      .cal-day.selected { border-color:var(--accent); background:var(--bg-selected); color:var(--accent-dark); font-weight:700; }
      .cal-day.disabled { opacity:0.25; cursor:not-allowed; color:var(--text-light); }
      .cal-day.empty { cursor:default; }
      .cal-day.today { font-weight:700; color:var(--accent); border-color:rgba(var(--accent-rgb,10,126,164),0.35); }
      .cal-day.today .today-label { display:block; font-size:8px; font-weight:700; color:var(--accent); line-height:1; margin-top:1px; text-transform:uppercase; letter-spacing:0.02em; }
      .cal-day:not(.today) .today-label { display:none; }
      .cal-day.temp-closed { background:rgba(239,68,68,0.1); color:#ef4444; cursor:not-allowed; text-decoration:line-through; opacity:0.85; }
      .cal-day.temp-closed:hover { background:rgba(239,68,68,0.15); }
      .loc-closed-banner { background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.4); border-radius:12px; padding:14px 16px; margin-bottom:16px; display:none; }
      .loc-closed-banner.show { display:block; }
      .loc-closed-banner .lc-title { font-size:14px; font-weight:700; color:#ef4444; margin-bottom:4px; }
      .loc-closed-banner .lc-msg { font-size:13px; color:var(--text-secondary); line-height:1.5; }
      /* Top-level location closed banner (shown before step 0) */
      #topLocClosedBanner { background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.4); border-radius:12px; padding:16px; margin-bottom:16px; display:none; text-align:center; }
      #topLocClosedBanner.show { display:block; }
      #topLocClosedBanner .lc-title { font-size:15px; font-weight:700; color:#ef4444; margin-bottom:6px; }
      #topLocClosedBanner .lc-msg { font-size:13px; color:var(--text-secondary); line-height:1.6; }
      .cart-items { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
      .cart-item { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:var(--bg-card-hover); border-radius:10px; font-size:13px; }
      .cart-item .cart-remove { color:var(--error); cursor:pointer; font-size:18px; padding:0 4px; }
      .cart-total { display:flex; justify-content:space-between; padding:10px 0; border-top:2px solid var(--border-heavy); font-size:15px; font-weight:700; }
      .product-item { display:flex; align-items:center; padding:12px; border:2px solid var(--border); border-radius:12px; cursor:pointer; transition:border-color 0.2s, background 0.2s; margin-bottom:6px; }
      .product-item:hover { background:var(--bg-card-hover); }
      .product-item.selected { border-color:var(--accent); background:var(--accent-bg-light); }
      .seg-control { display:flex; background:var(--border); border-radius:10px; padding:3px; margin-bottom:12px; }
      .seg-btn { flex:1; text-align:center; padding:8px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.15s; color:var(--text-secondary); }
      .seg-btn.active { background:var(--bg-card); color:var(--accent-dark); box-shadow:0 1px 3px var(--shadow); }
      /* Category / Brand tile grid */
      .tile-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:8px; }
      .tile-card { background:var(--bg-card); border:2px solid var(--border); border-radius:14px; padding:16px 12px; cursor:pointer; text-align:center; transition:all 0.15s; }
      .tile-card .tile-emoji { font-size:24px; margin-bottom:6px; line-height:1; }
      .tile-card:hover { border-color:var(--accent); background:var(--accent-bg-light); }
      .tile-card .tile-name { font-size:14px; font-weight:700; color:var(--text); margin-bottom:4px; }
      .tile-card .tile-count { font-size:12px; color:var(--text-muted); }
      /* Drill-down back link */
      .drill-back { display:inline-flex; align-items:center; gap:4px; color:var(--accent); font-size:13px; font-weight:600; cursor:pointer; margin-bottom:12px; }
      .drill-back:hover { opacity:0.75; }
      /* Item detail overlay */
      .detail-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:200; display:flex; align-items:flex-end; justify-content:center; }
      .detail-sheet { background:var(--bg-card); border-radius:24px 24px 0 0; padding:24px 20px 40px; max-width:480px; width:100%; max-height:85vh; overflow-y:auto; position:relative; }
      .detail-sheet .drag-handle { width:40px; height:4px; background:var(--border); border-radius:2px; margin:0 auto 20px; }
      .detail-sheet .detail-photo { width:100%; height:180px; object-fit:cover; border-radius:12px; margin-bottom:14px; }
      .detail-sheet .detail-photo-placeholder { width:100%; height:120px; background:var(--accent-bg-light); border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; margin-bottom:14px; font-size:36px; }
      .detail-sheet .detail-photo-placeholder .ph-hint { font-size:11px; color:var(--text-muted); font-weight:500; text-align:center; padding:0 12px; }
      .detail-sheet .detail-badge { display:inline-block; background:var(--accent-bg-light); color:var(--accent-dark); font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; margin-bottom:8px; }
      .detail-sheet .detail-name { font-size:20px; font-weight:800; color:var(--text); margin-bottom:6px; }
      .detail-sheet .detail-price { font-size:22px; font-weight:800; color:var(--accent-dark); margin-bottom:8px; }
      .detail-sheet .detail-meta { font-size:13px; color:var(--text-muted); margin-bottom:10px; }
      .detail-sheet .detail-desc { font-size:14px; color:var(--text-secondary); line-height:1.55; margin-bottom:18px; }
      .detail-sheet .detail-add-btn { width:100%; padding:14px; background:var(--accent); color:#fff; border:none; border-radius:14px; font-size:16px; font-weight:700; cursor:pointer; margin-bottom:10px; }
      .detail-sheet .detail-add-btn:hover { opacity:0.9; }
      .detail-sheet .detail-dismiss { width:100%; padding:10px; background:none; border:none; color:var(--text-muted); font-size:14px; cursor:pointer; }
      .detail-sheet .detail-dismiss:hover { color:var(--text); }
      .receipt-box { background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:20px; }
      /* Cookie consent banner */
      .cookie-banner { position:fixed; bottom:0; left:0; right:0; background:var(--bg-card); border-top:1px solid var(--border); padding:14px 16px; z-index:9999; box-shadow:0 -2px 10px var(--shadow); display:none; }
      .cookie-banner.show { display:flex; align-items:center; gap:12px; justify-content:center; flex-wrap:wrap; }
      .cookie-banner p { font-size:12px; color:var(--text-secondary); margin:0; flex:1; min-width:200px; }
      .cookie-banner p a { color:var(--accent); text-decoration:underline; }
      .cookie-banner button { background:var(--accent); color:#fff; border:none; border-radius:8px; padding:8px 20px; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; }
      /* Legal footer */
      .legal-footer { text-align:center; padding:20px 0 32px; font-size:11px; color:var(--text-hint); }
      .legal-footer a { color:var(--text-muted); text-decoration:underline; margin:0 6px; }
      /* Consent checkbox */
      .consent-row { display:flex; align-items:flex-start; gap:10px; margin:14px 0; font-size:12px; color:var(--text-secondary); }
      .consent-row input[type=checkbox] { margin-top:2px; width:18px; height:18px; accent-color:var(--accent); flex-shrink:0; }
      .consent-row a { color:var(--accent); text-decoration:underline; }
      /* Focus visible for accessibility */
      :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
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

function bookingPage(slug: string, owner: any, preselectedLocationId?: string | null, prefetchedLocations?: any[]): string {
  // Compute the initial full address for server-side rendering
  // Use preselected location if provided, or the only active location if there's just one
  const activeLocs = (prefetchedLocations || []).filter((l: any) => l.active !== false);
  let initialAddress = owner.address || '';
  if (preselectedLocationId) {
    const loc = activeLocs.find((l: any) => l.localId === preselectedLocationId);
    if (loc) {
      const parts = [loc.address?.trim(), loc.city?.trim(), loc.state?.trim() && loc.zipCode?.trim() ? `${loc.state.trim()} ${loc.zipCode.trim()}` : (loc.state?.trim() || loc.zipCode?.trim())].filter(Boolean);
      initialAddress = parts.join(', ') || loc.address || owner.address || '';
    }
  } else if (activeLocs.length === 1) {
    const loc = activeLocs[0];
    const parts = [loc.address?.trim(), loc.city?.trim(), loc.state?.trim() && loc.zipCode?.trim() ? `${loc.state.trim()} ${loc.zipCode.trim()}` : (loc.state?.trim() || loc.zipCode?.trim())].filter(Boolean);
    initialAddress = parts.join(', ') || loc.address || owner.address || '';
  }
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
  <meta name="description" content="Book an appointment with ${escHtml(owner.businessName)}. Schedule online with Lime Of Time.">
  <meta property="og:title" content="Book with ${escHtml(owner.businessName)} - Lime Of Time">
  <meta property="og:description" content="Book an appointment with ${escHtml(owner.businessName)}. Easy online scheduling powered by Lime Of Time.">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Lime Of Time">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Book with ${escHtml(owner.businessName)}">
  <meta name="twitter:description" content="Book an appointment with ${escHtml(owner.businessName)}. Easy online scheduling.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://lime-of-time.com/book/${escHtml(owner.businessName.toLowerCase().replace(/\s+/g, '-'))}">  
  ${baseStyles()}
</head>
<body>
  <div class="container" id="app">
    <div class="header" role="banner">
      ${owner.logoUrl ? `<img src="${escHtml(owner.logoUrl)}" alt="${escHtml(owner.businessName)} logo" class="biz-logo">` : ''}
      <h1>Book with ${escHtml(owner.businessName)}</h1>
      <div class="subtitle">Powered by Lime Of Time</div>
    </div>

    <div id="step-indicator" class="step-indicator" role="navigation" aria-label="Booking steps">
      <div class="step-item active" id="step-item-0">
        <div class="step-dot active" id="dot-0">1</div>
        <span class="step-label">Info</span>
      </div>
      <div class="step-item" id="step-item-1">
        <div class="step-dot" id="dot-1">2</div>
        <span class="step-label">Service</span>
      </div>
      <div class="step-item" id="step-item-2">
        <div class="step-dot" id="dot-2">3</div>
        <span class="step-label">Date</span>
      </div>
      <div class="step-item" id="step-item-3">
        <div class="step-dot" id="dot-3">4</div>
        <span class="step-label">Extras</span>
      </div>
      <div class="step-item" id="step-item-4">
        <div class="step-dot" id="dot-4">5</div>
        <span class="step-label">Confirm</span>
      </div>
    </div>

    <!-- Business Info Card -->
    <div class="card biz-info" id="biz-card">
      <div style="font-size:16px;font-weight:700;color:var(--text);">${escHtml(owner.businessName)}</div>
      <div id="biz-address-row">${initialAddress ? `<div class="biz-info-row"><span>📍</span><a href="https://maps.google.com/?q=${encodeURIComponent(initialAddress)}" target="_blank">${escHtml(initialAddress)}</a></div>` : ""}</div>
      ${owner.phone ? `<div class="biz-info-row"><span>📞</span><span>${escHtml(formatPhoneNumber(owner.phone))}</span></div>` : ""}
      ${owner.email ? `<div class="biz-info-row"><span>✉️</span><span>${escHtml(owner.email)}</span></div>` : ""}
      ${owner.description ? `<div style="font-size:13px;color:var(--text-muted);margin-top:6px;">${escHtml(owner.description)}</div>` : ""}
    </div>

    ${owner.temporaryClosed ? `<div class="closed-banner">⚠️ This business is temporarily closed and not accepting bookings at this time.</div>` : ""}

    <!-- Top-level location closed banner (shown when preselected location is temporarily closed) -->
    <div id="topLocClosedBanner">
      <div class="lc-title">&#9888;&#65039; Location Temporarily Closed</div>
      <div class="lc-msg" id="topLocClosedMsg">This location is temporarily closed and not accepting bookings at this time. Please check back later.</div>
    </div>

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
      <div id="locationSelector" style="display:none;"></div>
      <h2>Select a Service</h2>
      <!-- Search bar -->
      <div style="margin-bottom:12px;">
        <input id="svcSearch" type="text" placeholder="&#128269; Search services..." oninput="onSvcSearch(this.value)"
          style="width:100%;box-sizing:border-box;padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;background:var(--bg-card);color:var(--text);outline:none;">
      </div>
      <!-- Most Popular row -->
      <div id="svcPopularRow" style="display:none;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">&#11088; Most Popular</div>
        <div id="svcPopularList" style="display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none;"></div>
      </div>
      <!-- Category tiles -->
      <div id="svcCatGrid" class="tile-grid"></div>
      <!-- Service list (after drilling into a category) -->
      <div id="svcItemList" style="display:none;"></div>
      <!-- Search results -->
      <div id="svcSearchResults" style="display:none;"></div>
      <!-- Selected service summary -->
      <div id="svcSelectedSummary" style="display:none;margin-top:12px;padding:10px 14px;background:var(--accent-bg-light);border:1.5px solid var(--accent);border-radius:10px;font-size:14px;color:var(--accent);font-weight:600;"></div>
      <div id="staffSection" style="display:none;margin-top:20px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:10px;">Choose a Staff Member <span style="font-size:12px;color:#888;font-weight:400;">(optional)</span></h3>
        <div id="staffList" class="service-list"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-secondary" onclick="goToStep(0)" style="flex:1">Back</button>
        <button class="btn btn-primary" onclick="goToStep(2)" id="btnToDate" disabled style="flex:1">Continue</button>
      </div>
    </div>
    <!-- Service primary detail overlay -->
    <div id="svcDetailOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;align-items:flex-end;justify-content:center;">
      <div id="svcDetailContent" class="detail-sheet" style="background:var(--bg-card);border-radius:20px 20px 0 0;padding:24px 20px 36px;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;"></div>
    </div>

    <!-- Step 2: Select Date & Time (Monthly Calendar) -->
    <div id="step-2" class="card" style="display:none">
      <h2>Select Date & Time</h2>
      <div id="locClosedBanner" class="loc-closed-banner">
        <div class="lc-title">&#9888;&#65039; Location Temporarily Closed</div>
        <div class="lc-msg" id="locClosedMsg"></div>
      </div>
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
        <div id="noSlots" style="display:none;text-align:center;padding:20px;font-size:14px;">
          <div id="noSlotsMsg" style="color:#888;">No available time slots for this date.</div>
          <button class="btn btn-secondary" style="margin-top:12px;width:auto;display:inline-block;padding:10px 20px;font-size:13px;" onclick="joinWaitlist()">Join Waitlist</button>
        </div>
        <div id="waitlistMsg" style="display:none;text-align:center;padding:12px;margin-top:8px;border-radius:10px;font-size:13px;"></div>
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
      <!-- Search bar -->
      <div style="position:relative;margin-bottom:12px;">
        <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:15px;color:#aaa;">&#128269;</span>
        <input id="addMoreSearch" type="search" placeholder="Search..." oninput="onAddMoreSearch(this.value)" style="width:100%;box-sizing:border-box;padding:10px 12px 10px 36px;border:1.5px solid var(--border-input);border-radius:12px;font-size:14px;background:var(--bg-card);color:var(--text);outline:none;" />
      </div>
      <!-- Search results panel (shown when query is non-empty) -->
      <div id="addMoreSearchResults" style="display:none"></div>
      <!-- Services drill-down: level 0 = category tiles, level 1 = service list -->
      <div id="addServicePanel">
        <div id="addServiceCats"></div>
        <div id="addServiceList" style="display:none"></div>
      </div>
      <!-- Products drill-down: level 0 = brand tiles, level 1 = product list -->
      <div id="addProductPanel" style="display:none">
        <div id="addProductBrands"></div>
        <div id="addProductList" style="display:none"></div>
      </div>
      <div id="cartTotal" class="cart-total" style="display:none"></div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-secondary" onclick="goToStep(2)" style="flex:1">Back</button>
        <button class="btn btn-primary" onclick="goToStep(4)" style="flex:1">Continue to Confirm</button>
      </div>
    </div>
    <!-- Item detail bottom sheet (shared for services + products) -->
    <div id="itemDetailOverlay" class="detail-overlay" style="display:none" onclick="closeItemDetail(event)">
      <div class="detail-sheet" id="itemDetailSheet">
        <div class="drag-handle"></div>
        <div id="itemDetailContent"></div>
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
      <div class="consent-row">
        <input type="checkbox" id="consentCheck" aria-label="I agree to the Terms and Privacy Policy">
        <label for="consentCheck">I agree to the <a href="/api/legal/terms" target="_blank">Terms of Service</a> and <a href="/api/legal/privacy" target="_blank">Privacy Policy</a></label>
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
      <div id="paymentSection" style="display:none;margin-bottom:16px;"></div>
      <div id="manageLink" style="margin-bottom:12px;display:none;">
        <a id="manageLinkHref" href="#" style="color:var(--accent);font-size:14px;text-decoration:none;font-weight:600;">Manage or Cancel This Appointment →</a>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary" onclick="saveReceipt()" style="flex:1">📥 Save Receipt</button>
        <button class="btn btn-primary" onclick="location.reload()" style="flex:1">Book Another</button>
      </div>
    </div>
  </div>

  <!-- Legal Footer -->
  <div class="legal-footer" style="max-width:480px;margin:0 auto;">
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px;">
      <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663347678319/jHoNjHdLsUGgpFhz.png" alt="Lime Of Time" style="width:28px;height:28px;border-radius:8px;object-fit:cover;border:1px solid var(--border);">
      <span style="font-size:12px;font-weight:600;color:var(--text-muted);">Lime Of Time</span>
    </div>
    <a href="/api/legal/privacy" target="_blank">Privacy Policy</a>
    <a href="/api/legal/terms" target="_blank">Terms of Service</a>
    <a href="/api/legal/data-deletion" target="_blank">Data Deletion</a>
    <br><span style="margin-top:4px;display:inline-block;">&copy; ${new Date().getFullYear()} Lime Of Time. All rights reserved.</span>
  </div>

  <!-- Cookie Consent Banner -->
  <div class="cookie-banner" id="cookieBanner">
    <p>We use essential cookies to provide our booking service. By continuing, you agree to our <a href="/api/legal/privacy" target="_blank">Privacy Policy</a>.</p>
    <button onclick="acceptCookies()">Accept</button>
  </div>

  <script>
    // Cookie consent
    if (!localStorage.getItem('lot_cookie_consent')) {
      document.getElementById('cookieBanner').classList.add('show');
    }
    function acceptCookies() {
      localStorage.setItem('lot_cookie_consent', 'accepted');
      document.getElementById('cookieBanner').classList.remove('show');
    }

    const SLUG = "${slug}";
    const API = window.location.origin + "/api/public/business/" + SLUG;
    const WEEKLY_DAYS = ${JSON.stringify(whJson)};
    const DAYS_MAP = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const CANCEL_POLICY = ${JSON.stringify(owner.cancellationPolicy || { enabled: false, hoursBeforeAppointment: 2, feePercentage: 50 })};
    const PAYMENT_METHODS = ${JSON.stringify({ zelle: (owner as any).zelleHandle || null, cashApp: (owner as any).cashAppHandle || null, venmo: (owner as any).venmoHandle || null })};
    let services = [];
    let products = [];
    let discounts = [];
    let staffMembers = [];
    let locations = [];
    let customDays = {};
    let apiWeeklyDays = null; // weeklyDays from last loadWorkingDays() call (location-scoped)
    let selectedService = null;
    let selectedStaff = null;
    let selectedLocation = ${preselectedLocationId ? `"${preselectedLocationId}"` : 'null'};
    let selectedDate = null;
    let selectedTime = null;
    let appliedGift = null;
    let appliedDiscount = null; // { name, percentage }
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

    // Load services (optionally filtered by location)
    async function loadServices(locId) {
      try {
        const url = locId ? API + "/services?locationId=" + encodeURIComponent(locId) : API + "/services";
        const res = await fetch(url);
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

    // Load working days (custom overrides + schedule mode), optionally scoped to a location
    var scheduleMode = "weekly";
    var businessHoursEndDate = null;
    async function loadWorkingDays(locId) {
      try {
        const url = locId ? API + "/working-days?locationId=" + encodeURIComponent(locId) : API + "/working-days";
        const res = await fetch(url);
        const data = await res.json();
        customDays = data.customDays || {};
        scheduleMode = data.scheduleMode || "weekly";
        businessHoursEndDate = data.businessHoursEndDate || null;
        // Store location-scoped weekly days so calendar uses correct working hours
        apiWeeklyDays = data.weeklyDays || null;
      } catch(e) { customDays = {}; apiWeeklyDays = null; }
    }

    // Load staff members
    async function loadStaff() {
      try {
        const res = await fetch(API + "/staff");
        staffMembers = await res.json();
      } catch(e) { staffMembers = []; }
    }

    async function loadLocations() {
      try {
        const res = await fetch(API + "/locations");
        locations = await res.json();
        locations = locations.filter(l => l.active !== false);
      } catch(e) { locations = []; }
    }

    function escText(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    var Q = "'"; // single-quote helper for onclick attribute strings
    function formatPhoneNumber(phone) {
      if (!phone) return phone;
      var digits = phone.replace(/\D/g, '');
      if (digits.length === 11 && digits.charAt(0) === '1') return '+1 (' + digits.slice(1,4) + ') ' + digits.slice(4,7) + '-' + digits.slice(7);
      if (digits.length === 10) return '(' + digits.slice(0,3) + ') ' + digits.slice(3,6) + '-' + digits.slice(6);
      return phone;
    }

    function renderLocationSelector() {
      if (locations.length <= 1) return;
      var container = document.getElementById('locationSelector');
      if (!container) return;
      container.style.display = 'block';
      var html = '<div style="margin-bottom:16px;"><h3 style="font-size:16px;font-weight:600;margin-bottom:8px;">Select Location</h3>';
      locations.forEach(function(loc) {
        var isSelected = selectedLocation === loc.localId;
        var borderColor = isSelected ? 'var(--accent)' : 'var(--border)';
        var bgColor = isSelected ? 'var(--bg-selected)' : 'var(--bg-card)';
        var shadow = isSelected ? '0 0 0 3px rgba(74,140,63,0.12)' : 'none';
        // Build full address: street, city, state zip
        var fullAddr = buildFullAddress(loc.address, loc.city, loc.state, loc.zipCode);
        var mapUrl = fullAddr ? 'https://maps.google.com/?q=' + encodeURIComponent(fullAddr) : '';
        html += '<div onclick="selectLocation(&apos;' + loc.localId + '&apos;)" style="padding:14px 16px;border:1.5px solid ' + borderColor + ';border-radius:14px;margin-bottom:8px;cursor:pointer;background:' + bgColor + ';transition:all 0.2s;box-shadow:' + shadow + ';">';
        html += '<div style="font-weight:600;font-size:14px;color:var(--text);">' + escText(loc.name) + '</div>';
        if (fullAddr) {
          html += '<div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">';
          if (mapUrl) html += '<a href="' + mapUrl + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent);text-decoration:underline;font-size:12px;">' + escText(fullAddr) + '</a>';
          else html += escText(fullAddr);
          html += '</div>';
        } else if (loc.address) {
          html += '<div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">' + escText(loc.address) + '</div>';
        }
        if (loc.phone) html += '<div style="font-size:12px;color:var(--accent);margin-top:2px;font-weight:500;">' + escText(formatPhoneNumber(loc.phone)) + '</div>';
        html += '</div>';
      });
      html += '</div>';
      container.innerHTML = html;
    }

    function buildFullAddress(street, city, state, zip) {
      // Builds "123 Main St, New York NY, 10001" style address
      var parts = [];
      if (street && street.trim()) parts.push(street.trim());
      if (city && city.trim()) parts.push(city.trim());
      var stateZip = '';
      if (state && state.trim()) stateZip += state.trim();
      if (zip && zip.trim()) stateZip += (stateZip ? ' ' : '') + zip.trim();
      if (stateZip) parts.push(stateZip);
      return parts.join(', ');
    }

    function updateBizAddressCard() {
      var addrRow = document.getElementById('biz-address-row');
      if (!addrRow) return;
      var addr = '';
      // Use selectedLocation, or auto-pick the only location if there's just one
      var effectiveLoc = null;
      if (selectedLocation) {
        effectiveLoc = locations.find(function(l) { return l.localId === selectedLocation; });
      } else if (locations.length === 1) {
        effectiveLoc = locations[0];
      }
      if (effectiveLoc) {
        // Build full address: street, city, state zip
        addr = buildFullAddress(effectiveLoc.address, effectiveLoc.city, effectiveLoc.state, effectiveLoc.zipCode);
        if (!addr) addr = effectiveLoc.address || '';
      }
      if (!addr) addr = ${JSON.stringify(owner.address || '')};
      if (addr) {
        addrRow.innerHTML = '<div class="biz-info-row"><span>📍</span><a href="https://maps.google.com/?q=' + encodeURIComponent(addr) + '" target="_blank" style="color:var(--accent);text-decoration:underline;">' + escText(addr) + '</a></div>';
      } else {
        addrRow.innerHTML = '';
      }
    }

    function selectLocation(locId) {
      selectedLocation = locId;
      slotCache = {}; // Clear cache when location changes
      renderLocationSelector();
      updateBizAddressCard();
      // Check if the newly selected location is temporarily closed
      checkTopLevelLocClosed();
      // Reload services and working days scoped to this location
      loadServices(locId);
      loadWorkingDays(locId).then(() => {
        // Re-render calendar with updated working days if already on date step
        if (currentStep === 2) renderCalendar();
      });
      // If a service is already selected, re-render staff filtered by new location
      if (selectedService) {
        renderStaffForService(selectedService.localId);
      }
    }

    function getEffectiveWorkingDays() {
      // Staff hours override location hours, which override global hours
      if (selectedStaff && selectedStaff.workingHours) {
        const wh = selectedStaff.workingHours;
        const days = {};
        ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].forEach(d => {
          const entry = wh[d] || wh[d.toLowerCase()];
          days[d] = !!(entry && entry.enabled);
        });
        return days;
      }
      // Use API-fetched weeklyDays (location-scoped) if available — this is the most accurate source
      if (apiWeeklyDays) return apiWeeklyDays;
      // Fallback: derive from location's workingHours object in the locations array
      if (selectedLocation) {
        const loc = locations.find(l => l.localId === selectedLocation);
        if (loc && loc.workingHours && Object.keys(loc.workingHours).length > 0) {
          const wh = loc.workingHours;
          const days = {};
          ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].forEach(d => {
            const entry = wh[d] || wh[d.toLowerCase()];
            days[d] = !!(entry && entry.enabled);
          });
          return days;
        }
      }
      return WEEKLY_DAYS;
    }
    function isWorkingDay(dateStr) {
      // Check Active Until expiry
      if (businessHoursEndDate && dateStr > businessHoursEndDate) return false;
      if (scheduleMode === "custom") {
        // Custom mode: only dates explicitly in customDays and marked open are available
        return customDays.hasOwnProperty(dateStr) && customDays[dateStr] === true;
      }
      // Weekly mode: check custom override first, then weekly schedule
      if (customDays.hasOwnProperty(dateStr)) return customDays[dateStr];
      const d = new Date(dateStr + "T12:00:00");
      const dayName = DAYS_MAP[d.getDay()];
      return getEffectiveWorkingDays()[dayName] || false;
    }

    // ── Step 1 drill-down state ──────────────────────────────────────────
    var selectedSvcCat = null; // null = show tiles, string = show list for that cat

    function renderServices() {
      if (services.length === 0) {
        document.getElementById('svcCatGrid').innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No services available</div>';
        return;
      }
      selectedSvcCat = null;
      document.getElementById('svcItemList').style.display = 'none';
      document.getElementById('svcSearchResults').style.display = 'none';
      renderSvcPopularRow();
      renderSvcCategoryTiles();
    }

    function renderSvcPopularRow() {
      // Rank services by appointment count (use appointmentCount field if available, else random stable sort)
      var ranked = services.slice().sort(function(a, b) {
        return (b.appointmentCount || 0) - (a.appointmentCount || 0);
      });
      // Take top 5; if no counts available, take first 5 alphabetically
      var top = ranked.slice(0, 5);
      if (top.length === 0) return;
      var popularRow = document.getElementById('svcPopularRow');
      var popularList = document.getElementById('svcPopularList');
      var html = '';
      top.forEach(function(s) {
        var dur = s.duration >= 60 ? (s.duration / 60) + ' hr' + (s.duration > 60 ? 's' : '') : s.duration + ' min';
        var photoEl = s.photoUri
          ? '<img src="' + esc(s.photoUri) + '" style="width:100%;height:72px;object-fit:cover;" />'
          : '<div style="width:100%;height:72px;background:' + (s.color || '#4a8c3f') + '20;display:flex;align-items:center;justify-content:center;">' +
            '<span style="font-size:28px;font-weight:800;color:' + (s.color || '#4a8c3f') + ';opacity:0.8;">' + esc((s.name || '?')[0].toUpperCase()) + '</span></div>';
        html += '<div class="popular-card" data-svc-id="' + esc(s.localId) + '" style="' +
          'flex:0 0 auto;min-width:130px;max-width:150px;background:var(--bg-card);border:1.5px solid var(--border);' +
          'border-radius:12px;padding:0;overflow:hidden;cursor:pointer;transition:box-shadow 0.15s;">' +
          photoEl +
          '<div style="padding:8px 10px 10px;">' +
          '<div style="font-size:13px;font-weight:600;color:var(--text);line-height:1.3;margin-bottom:4px;">' + esc(s.name) + '</div>' +
          '<div style="font-size:11px;color:#888;">' + dur + '</div>' +
          '<div style="font-size:13px;font-weight:700;color:var(--accent);margin-top:6px;">$' + parseFloat(s.price).toFixed(2) + '</div>' +
          '</div></div>';
      });
      popularList.innerHTML = html;
      popularList.querySelectorAll('.popular-card[data-svc-id]').forEach(function(card) {
        card.addEventListener('click', function() {
          openSvcDetail(card.getAttribute('data-svc-id'));
        });
      });
      popularRow.style.display = 'block';
    }

    var CATEGORY_EMOJI = {
      'all': '✨', 'hair': '✂️', 'nails': '💅', 'skin': '🌿', 'body': '💆',
      'makeup': '💄', 'waxing': '🪒', 'massage': '🙌', 'facial': '🧖',
      'lashes': '👁️', 'brows': '🪸', 'tanning': '☀️', 'teeth': '🦷',
      'spa': '🛁', 'wellness': '🌸', 'fitness': '💪', 'yoga': '🧘',
      'barber': '💈', 'color': '🎨', 'coloring': '🎨', 'styling': '💇',
      'threading': '🧵', 'piercing': '💎', 'tattoo': '🖊️', 'general': '🔖'
    };
    function getCategoryEmoji(name) {
      if (!name) return '🔖';
      var key = name.toLowerCase().trim();
      if (CATEGORY_EMOJI[key]) return CATEGORY_EMOJI[key];
      for (var k in CATEGORY_EMOJI) {
        if (key.includes(k) || k.includes(key)) return CATEGORY_EMOJI[k];
      }
      return '🔖';
    }
        function renderSvcCategoryTiles() {
      var catMap = {};
      services.forEach(function(s) {
        var cat = (s.category || '').trim() || 'General';
        if (!catMap[cat]) catMap[cat] = [];
        catMap[cat].push(s);
      });
      var cats = Object.keys(catMap).sort(function(a, b) {
        if (a === 'General') return 1;
        if (b === 'General') return -1;
        return a.localeCompare(b);
      });
      var grid = document.getElementById('svcCatGrid');
      var html = '';
      // All tile
      html += '<div class="tile-card tile-all" data-svc-cat="__all__">' +
        '<div class="tile-emoji">' + getCategoryEmoji('all') + '</div>' +
        '<div class="tile-name">All</div>' +
        '<div class="tile-count">' + services.length + '</div></div>';
      cats.forEach(function(cat) {
        html += '<div class="tile-card" data-svc-cat="' + esc(cat) + '">' +
          '<div class="tile-emoji">' + getCategoryEmoji(cat) + '</div>' +
          '<div class="tile-name">' + esc(cat) + '</div>' +
          '<div class="tile-count">' + catMap[cat].length + '</div></div>';
      });
      grid.innerHTML = html;
      grid.style.display = 'grid';
      grid.querySelectorAll('.tile-card[data-svc-cat]').forEach(function(el) {
        el.addEventListener('click', function() {
          drillIntoSvcCategory(el.getAttribute('data-svc-cat'));
        });
      });
    }

    function drillIntoSvcCategory(cat) {
      selectedSvcCat = cat;
      var filtered = cat === '__all__' ? services : services.filter(function(s) {
        return ((s.category || '').trim() || 'General') === cat;
      });
      var listEl = document.getElementById('svcItemList');
      var catLabel = cat === '__all__' ? 'All Services' : cat;
      var html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">' +
        '<button onclick="resetSvcDrillDown()" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--accent);font-weight:600;padding:0;">&#8592; ' + esc(catLabel) + '</button></div>';
      html += '<div class="service-list">';
      filtered.forEach(function(s) {
        var dur = s.duration >= 60 ? (s.duration / 60) + ' hr' + (s.duration > 60 ? 's' : '') : s.duration + ' min';
        var svcThumb = s.photoUri
          ? '<div class="service-dot"><img src="' + esc(s.photoUri) + '" /></div>'
          : '<div class="service-dot" style="background:' + (s.color || '#4a8c3f') + '20;color:' + (s.color || '#4a8c3f') + ';">' + esc((s.name||'?')[0].toUpperCase()) + '</div>';
        html += '<div class="service-item" data-svc-id="' + esc(s.localId) + '">' +
          svcThumb +
          '<div class="service-info"><div class="service-name">' + esc(s.name) + '</div>' +
          '<div class="service-meta">' + dur + '</div></div>' +
          '<div class="service-price">$' + parseFloat(s.price).toFixed(2) + '</div></div>';
      });
      html += '</div>';
      listEl.innerHTML = html;
      listEl.style.display = 'block';
      document.getElementById('svcCatGrid').style.display = 'none';
      listEl.querySelectorAll('.service-item[data-svc-id]').forEach(function(item) {
        item.addEventListener('click', function() {
          openSvcDetail(item.getAttribute('data-svc-id'));
        });
      });
    }

    function resetSvcDrillDown() {
      selectedSvcCat = null;
      document.getElementById('svcItemList').style.display = 'none';
      document.getElementById('svcCatGrid').style.display = 'grid';
    }

    function openSvcDetail(id) {
      var s = services.find(function(x) { return x.localId === id; });
      if (!s) return;
      var dur = s.duration >= 60 ? (s.duration / 60) + ' hr' + (s.duration > 60 ? 's' : '') : s.duration + ' min';
      var isSelected = selectedService && selectedService.localId === id;
      var html = '';
      if (s.photoUri) html += '<img src="' + esc(s.photoUri) + '" style="width:100%;height:180px;object-fit:cover;border-radius:12px;margin-bottom:14px;">';
      html += '<div style="display:inline-block;background:var(--accent-bg-light);color:var(--accent);font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;margin-bottom:8px;">' + esc((s.category || 'General').trim() || 'General') + '</div>';
      html += '<div class="detail-name">' + esc(s.name) + '</div>';
      html += '<div class="detail-price">$' + parseFloat(s.price).toFixed(2) + '</div>';
      html += '<div class="detail-meta">' + dur + '</div>';
      if (s.description) html += '<div class="detail-desc">' + esc(s.description) + '</div>';
      if (isSelected) {
        html += '<button class="detail-add-btn" style="background:#e5f0e3;color:#2d5a27;" onclick="deselectSvc();closeSvcDetail()">&#10003; Selected &#8212; Deselect</button>';
      } else {
        html += '<button class="detail-add-btn" onclick="selectService(' + Q + id + Q + ');closeSvcDetail()">Select This Service</button>';
      }
      html += '<button class="detail-dismiss" onclick="closeSvcDetail()">Close</button>';
      document.getElementById('svcDetailContent').innerHTML = html;
      document.getElementById('svcDetailOverlay').style.display = 'flex';
    }

    function closeSvcDetail() {
      document.getElementById('svcDetailOverlay').style.display = 'none';
    }

    function deselectSvc() {
      selectedService = null;
      document.getElementById('btnToDate').disabled = true;
      document.getElementById('staffSection').style.display = 'none';
      document.getElementById('svcSelectedSummary').style.display = 'none';
    }

    function onSvcSearch(query) {
      var q = query.trim().toLowerCase();
      var resultsEl = document.getElementById('svcSearchResults');
      var catGrid = document.getElementById('svcCatGrid');
      var listEl = document.getElementById('svcItemList');
      if (!q) {
        resultsEl.style.display = 'none';
        if (selectedSvcCat) {
          listEl.style.display = 'block';
        } else {
          catGrid.style.display = 'grid';
          listEl.style.display = 'none';
        }
        return;
      }
      catGrid.style.display = 'none';
      listEl.style.display = 'none';
      var matches = services.filter(function(s) {
        return s.name.toLowerCase().includes(q) ||
          (s.category || '').toLowerCase().includes(q) ||
          (s.description || '').toLowerCase().includes(q);
      });
      if (matches.length === 0) {
        resultsEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No services found</div>';
      } else {
        var html = '<div class="service-list">';
        matches.forEach(function(s) {
          var dur = s.duration >= 60 ? (s.duration / 60) + ' hr' + (s.duration > 60 ? 's' : '') : s.duration + ' min';
          var svcThumbS = s.photoUri
            ? '<div class="service-dot"><img src="' + esc(s.photoUri) + '" /></div>'
            : '<div class="service-dot" style="background:' + (s.color || '#4a8c3f') + '20;color:' + (s.color || '#4a8c3f') + ';">' + esc((s.name||'?')[0].toUpperCase()) + '</div>';
          html += '<div class="service-item" data-svc-id="' + esc(s.localId) + '">' +
            svcThumbS +
            '<div class="service-info"><div class="service-name">' + esc(s.name) + '</div>' +
            '<div class="service-meta">' + dur + (s.category ? ' · ' + esc(s.category) : '') + '</div></div>' +
            '<div class="service-price">$' + parseFloat(s.price).toFixed(2) + '</div></div>';
        });
        html += '</div>';
        resultsEl.innerHTML = html;
        resultsEl.querySelectorAll('.service-item[data-svc-id]').forEach(function(item) {
          item.addEventListener('click', function() {
            openSvcDetail(item.getAttribute('data-svc-id'));
          });
        });
      }
      resultsEl.style.display = 'block';
    }

    function selectService(id) {
      selectedService = services.find(function(s) { return s.localId === id; });
      selectedStaff = null;
      document.getElementById('btnToDate').disabled = false;
      // Show selected service summary banner
      var summaryEl = document.getElementById('svcSelectedSummary');
      if (selectedService) {
        var dur = selectedService.duration >= 60
          ? (selectedService.duration / 60) + ' hr' + (selectedService.duration > 60 ? 's' : '')
          : selectedService.duration + ' min';
        summaryEl.innerHTML = '&#10003; ' + esc(selectedService.name) + ' &mdash; $' + parseFloat(selectedService.price).toFixed(2) + ' &middot; ' + dur;
        summaryEl.style.display = 'block';
      } else {
        summaryEl.style.display = 'none';
      }
      // Show staff selection for this service
      renderStaffForService(id);
    }

    function renderStaffForService(serviceId) {
      const section = document.getElementById("staffSection");
      const list = document.getElementById("staffList");
      // Filter staff who can perform this service AND are assigned to the selected location
      const eligible = staffMembers.filter(s => {
        // Service check: null/empty serviceIds means all services
        const canDoService = s.serviceIds.length === 0 || s.serviceIds.includes(serviceId);
        if (!canDoService) return false;
        // Location check: null locationIds means all locations
        if (!selectedLocation) return true; // no location selected, show all
        if (!s.locationIds) return true; // staff works at all locations
        return s.locationIds.includes(selectedLocation);
      });
      if (eligible.length === 0) {
        section.style.display = "none";
        return;
      }
      section.style.display = "block";
      // "Any available" option + eligible staff
      let html = '<div class="service-item selected" id="staff-any" onclick="selectStaff(null)">' +
        '<div class="service-dot" style="background:#88888820;color:#888;border-radius:50%;">?</div>' +
        '<div class="service-info"><div class="service-name">Any Available</div>' +
        '<div class="service-meta">First available staff member</div></div></div>';
      eligible.forEach(s => {
        html += '<div class="service-item" id="staff-' + s.localId + '" onclick="selectStaff(&apos;' + s.localId + '&apos;)">' +
          '<div class="service-dot" style="background:' + (s.color || '#6366f1') + '20;color:' + (s.color || '#6366f1') + ';border-radius:50%;">' + esc((s.name||'?')[0].toUpperCase()) + '</div>' +
          '<div class="service-info"><div class="service-name">' + esc(s.name) + '</div>' +
          '<div class="service-meta">' + esc(s.role || 'Staff') + '</div></div></div>';
      });
      list.innerHTML = html;
    }

    function selectStaff(id) {
      selectedStaff = id ? staffMembers.find(s => s.localId === id) : null;
      slotCache = {}; // Clear cache when staff changes
      document.querySelectorAll("#staffList .service-item").forEach(el => el.classList.remove("selected"));
      const el = document.getElementById(id ? "staff-" + id : "staff-any");
      if (el) el.classList.add("selected");
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
        const item = document.getElementById("step-item-" + i);
        if (item) item.className = "step-item" + (i < step ? " done" : i === step ? " active" : "");
      }

      if (step === 2) renderCalendar();
      if (step === 3) initAddMoreStep();
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

      // Check if selected location is temporarily closed
      const selLoc = selectedLocation ? locations.find(l => l.localId === selectedLocation) : null;
      const locTempClosed = selLoc ? !!selLoc.temporarilyClosed : false;

      // Show/hide the temporarily closed banner
      const closedBannerEl = document.getElementById("locClosedBanner");
      const closedMsgEl = document.getElementById("locClosedMsg");
      if (closedBannerEl && closedMsgEl) {
        if (locTempClosed) {
          const reopenOn = selLoc && selLoc.reopenOn ? selLoc.reopenOn : null;
          let msg = "";
          if (reopenOn) {
            const d = new Date(reopenOn + "T00:00:00");
            const formatted = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
            msg = selLoc.name + " is temporarily closed and will reopen on " + formatted + ". No new bookings are being accepted until then.";
          } else {
            msg = (selLoc ? selLoc.name : "This location") + " is temporarily closed for an indefinite period. No new bookings are being accepted at this time. Please check back later.";
          }
          closedMsgEl.textContent = msg;
          closedBannerEl.classList.add("show");
        } else {
          closedBannerEl.classList.remove("show");
        }
      }

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
        // If location is temporarily closed, all future days are red and unclickable
        if (locTempClosed && !isPast) {
          let cls = "cal-day temp-closed";
          if (isSelected) cls += " selected";
          html += '<div class="' + cls + '" id="day-' + ds + '" data-date="' + ds + '"><span>' + day + '</span></div>';
          continue;
        }
        // Initially disable all non-working and past days; working days start as loading
        const isDisabled = isPast || !isWorking;
        let cls = "cal-day";
        if (isDisabled) cls += " disabled";
        if (isSelected) cls += " selected";
        if (isToday && !isDisabled) cls += " today";
        // Working future days get a data-loading attribute, will be updated after slot check
        html += '<div class="' + cls + '" id="day-' + ds + '" data-date="' + ds + '"' + (!isDisabled ? ' onclick="selectDate(&apos;' + ds + '&apos;)"' : '') + '><span>' + day + '</span><span class="today-label">Today</span></div>';
        if (!isPast && isWorking) workingDates.push(ds);
      }
      grid.innerHTML = html;

      // Batch-check availability for all working days in this month (only if not temp closed)
      if (!locTempClosed) checkDayAvailability(workingDates);

      if (selectedDate) loadSlots(selectedDate);
    }

    function buildSlotParams(date, dur) {
      let params = "/slots?date=" + date + "&duration=" + dur;
      if (selectedStaff) params += "&staffId=" + encodeURIComponent(selectedStaff.localId);
      if (selectedLocation) params += "&locationId=" + encodeURIComponent(selectedLocation);
      return params;
    }
    async function checkDayAvailability(dates) {
      const dur = getTotalDuration();
      // Fetch slots for each working day in parallel
      const cacheKey = (ds) => ds + '_' + dur + '_' + (selectedStaff ? selectedStaff.localId : '') + '_' + (selectedLocation || '');
      const promises = dates.map(async (ds) => {
        // Use cache if available
        const key = cacheKey(ds);
        if (slotCache[key] !== undefined) return { date: ds, count: slotCache[key] };
        try {
          const res = await fetch(API + buildSlotParams(ds, dur));
          const data = await res.json();
          const count = data.slots ? data.slots.length : 0;
          slotCache[key] = count;
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

    // slotLocationCounts: map of time -> number of locations available at that time (from last loadSlots call)
    let slotLocationCounts = {};

    async function loadSlots(date) {
      const section = document.getElementById("timeSection");
      const grid = document.getElementById("timeGrid");
      const noSlots = document.getElementById("noSlots");
      section.style.display = "block";
      grid.innerHTML = '<div class="loading" style="grid-column:1/-1;">Loading times...</div>';
      noSlots.style.display = "none";

      try {
        const dur = getTotalDuration();
        const res = await fetch(API + buildSlotParams(date, dur));
        const data = await res.json();
        slotLocationCounts = data.slotLocationCounts || {};
        if (data.slots.length === 0) {
          grid.innerHTML = "";
          // Show context-aware message: today vs future date
          const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
          const noSlotsMsg = document.getElementById('noSlotsMsg');
          if (noSlotsMsg) {
            if (date === todayStr) {
              noSlotsMsg.style.color = '#d97706';
              noSlotsMsg.style.fontWeight = '600';
              noSlotsMsg.innerHTML = 'All slots for today have passed.<br><span style="font-size:12px;font-weight:400;color:#888;">Select another date to book an appointment.</span>';
            } else {
              noSlotsMsg.style.color = '#888';
              noSlotsMsg.style.fontWeight = 'normal';
              noSlotsMsg.innerHTML = 'No available time slots for this date.';
            }
          }
          noSlots.style.display = "block";
          return;
        }
        // Determine if we are in All Locations mode (no specific location selected)
        const isAllLocMode = !selectedLocation && locations.length > 1;
        grid.innerHTML = data.slots.map(t => {
          const h = parseInt(t.split(":")[0]);
          const m = t.split(":")[1];
          const ampm = h >= 12 ? "PM" : "AM";
          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          const label = h12 + ":" + m + " " + ampm;
          const locCount = slotLocationCounts[t] || 1;
          const badge = (isAllLocMode && locCount > 1)
            ? '<span style="display:block;font-size:9px;font-weight:700;color:var(--accent);margin-top:2px;">' + locCount + ' locations</span>'
            : '';
          return '<div class="time-slot" onclick="selectTime(&apos;' + t + '&apos;)" data-time="' + t + '">' + label + badge + '</div>';
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
      // All Locations mode: auto-assign location when only one location has this slot available.
      // This mirrors the owner new-booking auto-assign behavior.
      if (!selectedLocation && locations.length > 1) {
        const locCount = slotLocationCounts[time] || 1;
        if (locCount === 1) {
          // Find which single location has this slot by fetching per-location slot data
          // We can determine it from slotLocationCounts: if only 1 location has it,
          // we need to identify which one. We'll re-use the locations list and check
          // which location's working hours cover this time on the selected date.
          // For simplicity, we auto-select the first active non-closed location that
          // has this slot (the server already computed this union, so we trust it).
          // The booking POST will validate the slot against the submitted locationId.
          // We do a quick check: fetch slots for each location and find the one with this time.
          (async function() {
            const dur = getTotalDuration();
            for (const loc of locations) {
              if (loc.temporarilyClosed) continue;
              try {
                const r = await fetch(API + "/slots?date=" + selectedDate + "&duration=" + dur + "&locationId=" + encodeURIComponent(loc.localId));
                const d = await r.json();
                if (d.slots && d.slots.includes(time)) {
                  // This location has the slot — auto-select it silently
                  selectedLocation = loc.localId;
                  slotCache = {};
                  renderLocationSelector();
                  updateBizAddressCard();
                  break;
                }
              } catch(e) { /* ignore */ }
            }
          })();
        }
      }
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
        appliedDiscount = { name: match.name, percentage: match.percentage };
        const orig = parseFloat(selectedService.price);
        const disc = orig * (1 - match.percentage / 100);
        info.innerHTML = '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px;font-size:13px;">\ud83c\udf89 <strong>' + match.name + '</strong> \u2014 ' + match.percentage + '% off! <span style="text-decoration:line-through;color:#999;">$' + orig.toFixed(2) + '</span> \u2192 <strong style="color:#2d5a27;">$' + disc.toFixed(2) + '</strong></div>';
        info.style.display = "block";
      } else {
        appliedDiscount = null;
        info.style.display = "none";
      }
    }

    // ── Add More (Step 3) ──
    // ── Drill-down state ──────────────────────────────────────────────────────
    let addTab = 'services'; // 'services' | 'products'
    let selectedAddCat = null;  // null = show category tiles; string = show service list for that category
    let selectedAddBrand = null; // null = show brand tiles; string = show product list for that brand
    let addMoreSearchQuery = ''; // live search query

    function initAddMoreStep() {
      // Reset drill-down state each time step 3 is entered
      addTab = 'services';
      selectedAddCat = null;
      selectedAddBrand = null;
      addMoreSearchQuery = '';
      const searchEl = document.getElementById("addMoreSearch");
      if (searchEl) searchEl.value = '';
      document.getElementById("addMoreSearchResults").style.display = 'none';
      // Show services panel, hide products panel
      document.getElementById("addServicePanel").style.display = 'block';
      document.getElementById("addProductPanel").style.display = 'none';
      // Reset seg control
      document.querySelectorAll("#addMoreSeg .seg-btn").forEach((el,i) => {
        el.classList.toggle("active", i === 0);
      });
      renderAddMore();
    }

    function onAddMoreSearch(query) {
      addMoreSearchQuery = (query || '').trim().toLowerCase();
      const resultsEl = document.getElementById("addMoreSearchResults");
      const servicePanel = document.getElementById("addServicePanel");
      const productPanel = document.getElementById("addProductPanel");
      if (!addMoreSearchQuery) {
        resultsEl.style.display = 'none';
        // Restore normal panels
        servicePanel.style.display = addTab === 'services' ? 'block' : 'none';
        productPanel.style.display = addTab === 'products' ? 'block' : 'none';
        return;
      }
      // Hide normal drill-down panels while searching
      servicePanel.style.display = 'none';
      productPanel.style.display = 'none';
      resultsEl.style.display = 'block';

      const cartSvcIds = cart.filter(c => c.type === 'service').map(c => c.id);
      const cartProdIds = cart.filter(c => c.type === 'product').map(c => c.id);
      const matchedSvcs = services.filter(s =>
        s.localId !== selectedService.localId &&
        !cartSvcIds.includes(s.localId) &&
        (s.name || '').toLowerCase().includes(addMoreSearchQuery)
      );
      const matchedProds = products.filter(p =>
        !cartProdIds.includes(p.localId) &&
        (p.name || '').toLowerCase().includes(addMoreSearchQuery)
      );

      if (matchedSvcs.length === 0 && matchedProds.length === 0) {
        resultsEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:13px;">No results found</div>';
        return;
      }

      let html = '';
      if (matchedSvcs.length > 0) {
        html += '<div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Services</div>';
        matchedSvcs.forEach(s => {
          const dur = s.duration >= 60 ? (s.duration/60) + " hr" : s.duration + " min";
          var addThumbS = s.photoUri
            ? '<div class="service-dot"><img src="' + esc(s.photoUri) + '" /></div>'
            : '<div class="service-dot" style="background:' + (s.color||'#4a8c3f') + '20;color:' + (s.color||'#4a8c3f') + ';">' + esc((s.name||'?')[0].toUpperCase()) + '</div>';
          html += '<div class="service-item" onclick="openServiceDetail(' + JSON.stringify(s.localId) + ')">' +
            addThumbS +
            '<div class="service-info"><div class="service-name">' + esc(s.name) + '</div><div class="service-meta">' + dur + (s.category ? ' · ' + esc(s.category) : '') + '</div></div>' +
            '<div class="service-price">+ $' + parseFloat(s.price).toFixed(2) + '</div></div>';
        });
      }
      if (matchedProds.length > 0) {
        html += '<div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin:' + (matchedSvcs.length > 0 ? '12px' : '0') + ' 0 6px;">Products</div>';
        matchedProds.forEach(p => {
          html += '<div class="product-item" onclick="openProductDetail(' + JSON.stringify(p.localId) + ')">' +
            (p.photoUri ? '<img src="' + esc(p.photoUri) + '" style="width:48px;height:48px;border-radius:8px;object-fit:cover;margin-right:12px;flex-shrink:0;" />' : '') +
            '<div style="flex:1;"><div style="font-size:15px;font-weight:600;">' + esc(p.name) + '</div>' +
            (p.brand ? '<div style="font-size:12px;color:#888;margin-top:2px;">' + esc(p.brand) + '</div>' : '') + '</div>' +
            '<div style="font-size:15px;font-weight:700;color:#2d5a27;">+ $' + parseFloat(p.price).toFixed(2) + '</div></div>';
        });
      }
      resultsEl.innerHTML = html;
    }

    function renderAddMore() {
      renderCartSummary();
      if (addTab === 'services') {
        renderServiceDrillDown();
      } else {
        renderProductDrillDown();
      }
    }

    function switchAddTab(tab) {
      addTab = tab;
      document.querySelectorAll("#addMoreSeg .seg-btn").forEach((el,i) => {
        el.classList.toggle("active", (tab === "services" && i === 0) || (tab === "products" && i === 1));
      });
      document.getElementById("addServicePanel").style.display = tab === "services" ? "block" : "none";
      document.getElementById("addProductPanel").style.display = tab === "products" ? "block" : "none";
      if (tab === "services") renderServiceDrillDown();
      else renderProductDrillDown();
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

      // Total with discount
      const total = items.reduce((s, it) => s + it.price, 0);
      const totalDur = items.reduce((s, it) => s + (it.duration || 0), 0);
      const totalEl = document.getElementById("cartTotal");
      totalEl.style.display = "flex";
      const discAmt = getDiscountAmount();
      if (appliedDiscount && discAmt > 0) {
        const afterDisc = total - discAmt;
        totalEl.innerHTML = '<span>Total' + (totalDur > 0 ? ' (' + totalDur + ' min)' : '') + '</span><span><span style="text-decoration:line-through;color:#999;font-size:12px;">$' + total.toFixed(2) + '</span> <span style="color:#2d5a27;font-weight:700;">$' + afterDisc.toFixed(2) + '</span></span>';
      } else {
        totalEl.innerHTML = '<span>Total' + (totalDur > 0 ? ' (' + totalDur + ' min)' : '') + '</span><span style="color:#2d5a27;">$' + total.toFixed(2) + '</span>';
      }
    }

    // ── Services drill-down ───────────────────────────────────────────────────
    function renderServiceDrillDown() {
      const cartSvcIds = cart.filter(c => c.type === 'service').map(c => c.id);
      const available = services.filter(s => s.localId !== selectedService.localId && !cartSvcIds.includes(s.localId));

      // Build category map
      const catMap = {};
      available.forEach(s => {
        const cat = (s.category || '').trim() || 'General';
        if (!catMap[cat]) catMap[cat] = [];
        catMap[cat].push(s);
      });
      const cats = Object.keys(catMap).sort((a, b) => {
        if (a === 'General') return 1; if (b === 'General') return -1;
        return a.localeCompare(b);
      });

      const catsEl = document.getElementById("addServiceCats");
      const listEl = document.getElementById("addServiceList");

      if (available.length === 0) {
        catsEl.innerHTML = '<div style="text-align:center;color:#888;padding:16px;font-size:13px;">No additional services available</div>';
        catsEl.style.display = 'block';
        listEl.style.display = 'none';
        return;
      }

      // Only one category — skip tile level, show list directly (no need for All tile)
      if (cats.length <= 1) {
        selectedAddCat = cats[0] || 'General';
      }
      // More than one category: always show tile grid (including All tile)

      if (selectedAddCat === null) {
        // Level 0: category tiles
        listEl.style.display = 'none';
        let html = '<div class="tile-grid">';
        // "All" tile first
        html += '<div class="tile-card" onclick="drillIntoCategory(&quot;__all__&quot;)" style="border-color:var(--accent);">' +
          '<div class="tile-emoji">' + getCategoryEmoji('all') + '</div>' +
          '<div class="tile-name">All</div>' +
          '<div class="tile-count">' + available.length + ' service' + (available.length !== 1 ? 's' : '') + '</div>' +
          '</div>';
        cats.forEach(cat => {
          const count = catMap[cat].length;
          html += '<div class="tile-card" data-cat="' + esc(cat) + '">' +
            '<div class="tile-emoji">' + getCategoryEmoji(cat) + '</div>' +
            '<div class="tile-name">' + esc(cat) + '</div>' +
            '<div class="tile-count">' + count + ' service' + (count !== 1 ? 's' : '') + '</div>' +
            '</div>';
        });
        html += '</div>';
        catsEl.innerHTML = html;
        // Attach click handlers via JS — use currentTarget to avoid closure capture bug
        catsEl.querySelectorAll('.tile-card[data-cat]').forEach(function(tile) {
          tile.addEventListener('click', function(e) { drillIntoCategory(e.currentTarget.getAttribute('data-cat')); });
        });
        catsEl.style.display = 'block';
      } else {
        // Level 1: service list for selected category (or all)
        catsEl.style.display = 'none';
        const catServices = selectedAddCat === '__all__' ? available : (catMap[selectedAddCat] || []);
        const backLabel = selectedAddCat === '__all__' ? 'All Services' : selectedAddCat;
        let html = '<div class="drill-back" onclick="drillBackServices()">&#8592; ' + esc(backLabel) + '</div>';
        if (catServices.length === 0) {
          html += '<div style="text-align:center;color:#888;padding:16px;font-size:13px;">No services in this category</div>';
        } else {
          catServices.forEach(s => {
            const dur = s.duration >= 60 ? (s.duration/60) + " hr" : s.duration + " min";
            var addThumbC = s.photoUri
              ? '<div class="service-dot"><img src="' + esc(s.photoUri) + '" /></div>'
              : '<div class="service-dot" style="background:' + (s.color||'#4a8c3f') + '20;color:' + (s.color||'#4a8c3f') + ';">' + esc((s.name||'?')[0].toUpperCase()) + '</div>';
            html += '<div class="service-item" data-svc-id="' + esc(s.localId) + '">' +
              addThumbC +
              '<div class="service-info"><div class="service-name">' + esc(s.name) + '</div><div class="service-meta">' + dur + '</div></div>' +
              '<div class="service-price">+ $' + parseFloat(s.price).toFixed(2) + '</div></div>';
          });
        }
        listEl.innerHTML = html;
        // Attach click handlers for service items via data attribute
        listEl.querySelectorAll('.service-item[data-svc-id]').forEach(function(item) {
          item.addEventListener('click', function(e) { openServiceDetail(e.currentTarget.getAttribute('data-svc-id')); });
        });
        listEl.style.display = 'block';
      }
    }

    function drillIntoCategory(cat) {
      selectedAddCat = cat;
      renderServiceDrillDown();
    }

    function drillBackServices() {
      selectedAddCat = null;
      renderServiceDrillDown();
    }

    function openServiceDetail(id) {
      const s = services.find(sv => sv.localId === id);
      if (!s) return;
      const dur = s.duration >= 60 ? (s.duration/60) + " hr" : s.duration + " min";
      const inCart = cart.some(c => c.type === 'service' && c.id === id);
      let html = '';
      if (s.photoUri) {
        html += '<img class="detail-photo" src="' + esc(s.photoUri) + '" />';
      } else {
        html += '<div class="detail-photo-placeholder">✂️<span class="ph-hint">Add a photo in the app to help clients visualise this service</span></div>';
      }
      if (s.category) html += '<div class="detail-badge">' + esc(s.category) + '</div>';
      html += '<div class="detail-name">' + esc(s.name) + '</div>';
      html += '<div class="detail-price">$' + parseFloat(s.price).toFixed(2) + '</div>';
      html += '<div class="detail-meta">' + dur + '</div>';
      if (s.description) html += '<div class="detail-desc">' + esc(s.description) + '</div>';
      if (inCart) {
        html += '<button class="detail-add-btn" style="background:#e5f0e3;color:#2d5a27;" onclick="removeServiceFromCart(' + Q + id + Q + ');closeItemDetail()">✓ Added — Remove</button>';
      } else {
        html += '<button class="detail-add-btn" onclick="addServiceToCart(' + Q + id + Q + ');closeItemDetail()">Add to Booking</button>';
      }
      html += '<button class="detail-dismiss" onclick="closeItemDetail()">Close</button>';
      document.getElementById("itemDetailContent").innerHTML = html;
      document.getElementById("itemDetailOverlay").style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function removeServiceFromCart(id) {
      const idx = cart.findIndex(c => c.type === 'service' && c.id === id);
      if (idx !== -1) { cart.splice(idx, 1); renderAddMore(); }
    }

    // ── Products drill-down ───────────────────────────────────────────────────
    function renderProductDrillDown() {
      const cartProdIds = cart.filter(c => c.type === 'product').map(c => c.id);
      const available = products.filter(p => !cartProdIds.includes(p.localId));

      // Build brand map
      const brandMap = {};
      available.forEach(p => {
        const brand = (p.brand || '').trim() || 'Other';
        if (!brandMap[brand]) brandMap[brand] = [];
        brandMap[brand].push(p);
      });
      const brands = Object.keys(brandMap).sort((a, b) => {
        if (a === 'Other') return 1; if (b === 'Other') return -1;
        return a.localeCompare(b);
      });

      const brandsEl = document.getElementById("addProductBrands");
      const listEl = document.getElementById("addProductList");

      if (available.length === 0) {
        brandsEl.innerHTML = '<div style="text-align:center;color:#888;padding:16px;font-size:13px;">No products available</div>';
        brandsEl.style.display = 'block';
        listEl.style.display = 'none';
        return;
      }

      // Only one brand — skip tile level, show list directly (no need for All tile)
      if (brands.length <= 1) {
        selectedAddBrand = brands[0] || 'Other';
      }
      // More than one brand: always show tile grid (including All tile)

      if (selectedAddBrand === null) {
        // Level 0: brand tiles
        listEl.style.display = 'none';
        let html = '<div class="tile-grid">';
        // "All" tile first
        html += '<div class="tile-card" onclick="drillIntoBrand(&quot;__all__&quot;)" style="border-color:var(--accent);">' +
          '<div class="tile-name">All</div>' +
          '<div class="tile-count">' + available.length + ' product' + (available.length !== 1 ? 's' : '') + '</div>' +
          '</div>';
        brands.forEach(brand => {
          const count = brandMap[brand].length;
          html += '<div class="tile-card" data-brand="' + esc(brand) + '">' +
            '<div class="tile-name">' + esc(brand) + '</div>' +
            '<div class="tile-count">' + count + ' product' + (count !== 1 ? 's' : '') + '</div>' +
            '</div>';
        });
        html += '</div>';
        brandsEl.innerHTML = html;
        // Attach click handlers via JS — use currentTarget to avoid closure capture bug
        brandsEl.querySelectorAll('.tile-card[data-brand]').forEach(function(tile) {
          tile.addEventListener('click', function(e) { drillIntoBrand(e.currentTarget.getAttribute('data-brand')); });
        });
        brandsEl.style.display = 'block';
      } else {
        // Level 1: product list for selected brand (or all)
        brandsEl.style.display = 'none';
        const brandProducts = selectedAddBrand === '__all__' ? available : (brandMap[selectedAddBrand] || []);
        const backLabel = selectedAddBrand === '__all__' ? 'All Products' : selectedAddBrand;
        let html = brands.length > 1 || selectedAddBrand === '__all__' ? '<div class="drill-back" onclick="drillBackProducts()">&#8592; ' + esc(backLabel) + '</div>' : '';
        if (brandProducts.length === 0) {
          html += '<div style="text-align:center;color:#888;padding:16px;font-size:13px;">No products in this brand</div>';
        } else {
          brandProducts.forEach(p => {
            html += '<div class="product-item" data-prod-id="' + esc(p.localId) + '">' +
              (p.photoUri ? '<img src="' + esc(p.photoUri) + '" style="width:56px;height:56px;border-radius:10px;object-fit:cover;margin-right:12px;flex-shrink:0;" />' : '') +
              '<div style="flex:1;"><div style="font-size:15px;font-weight:600;">' + esc(p.name) + '</div>' +
              (p.description ? '<div style="font-size:12px;color:#888;margin-top:2px;">' + esc(p.description) + '</div>' : '') + '</div>' +
              '<div style="font-size:15px;font-weight:700;color:#2d5a27;">+ $' + parseFloat(p.price).toFixed(2) + '</div></div>';
          });
        }
        listEl.innerHTML = html;
        // Attach click handlers for product items via data attribute
        listEl.querySelectorAll('.product-item[data-prod-id]').forEach(function(item) {
          item.addEventListener('click', function(e) { openProductDetail(e.currentTarget.getAttribute('data-prod-id')); });
        });
        listEl.style.display = 'block';
      }
    }

    function drillIntoBrand(brand) {
      selectedAddBrand = brand;
      renderProductDrillDown();
    }

    function drillBackProducts() {
      selectedAddBrand = null;
      renderProductDrillDown();
    }

    function openProductDetail(id) {
      const p = products.find(pr => pr.localId === id);
      if (!p) return;
      const inCart = cart.some(c => c.type === 'product' && c.id === id);
      let html = '';
      if (p.photoUri) {
        html += '<img class="detail-photo" src="' + esc(p.photoUri) + '" />';
      } else {
        html += '<div class="detail-photo-placeholder">🛍️<span class="ph-hint">Add a photo in the app so clients can see this product</span></div>';
      }
      if (p.brand) html += '<div class="detail-badge">' + esc(p.brand) + '</div>';
      html += '<div class="detail-name">' + esc(p.name) + '</div>';
      html += '<div class="detail-price">$' + parseFloat(p.price).toFixed(2) + '</div>';
      if (p.description) html += '<div class="detail-desc">' + esc(p.description) + '</div>';
      if (inCart) {
        html += '<button class="detail-add-btn" style="background:#e5f0e3;color:#2d5a27;" onclick="removeProductFromCart(' + Q + id + Q + ');closeItemDetail()">✓ Added — Remove</button>';
      } else {
        html += '<button class="detail-add-btn" onclick="addProductToCart(' + Q + id + Q + ');closeItemDetail()">Add to Booking</button>';
      }
      html += '<button class="detail-dismiss" onclick="closeItemDetail()">Close</button>';
      document.getElementById("itemDetailContent").innerHTML = html;
      document.getElementById("itemDetailOverlay").style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function removeProductFromCart(id) {
      const idx = cart.findIndex(c => c.type === 'product' && c.id === id);
      if (idx !== -1) { cart.splice(idx, 1); renderAddMore(); }
    }

    function closeItemDetail(event) {
      if (event && event.target !== document.getElementById("itemDetailOverlay")) return;
      document.getElementById("itemDetailOverlay").style.display = 'none';
      document.body.style.overflow = '';
      renderAddMore();
    }

    // ── Legacy helpers still used by addServiceToCart / addProductToCart ─────
    function renderAddServiceList() { /* no-op: replaced by renderServiceDrillDown */ }
    function renderAddProductList() { /* no-op: replaced by renderProductDrillDown */ }

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

    function getDiscountAmount() {
      // Calculate discount amount based on appliedDiscount
      if (!appliedDiscount || !selectedService) return 0;
      // Discount applies to the primary service price only
      const servicePrice = parseFloat(selectedService.price);
      return servicePrice * (appliedDiscount.percentage / 100);
    }

    function getDiscountedTotal() {
      // Total after percentage discount, before gift card
      return getTotalPrice() - getDiscountAmount();
    }

    function getChargedPrice() {
      // Apply discount first, then gift card
      let total = getDiscountedTotal();
      if (appliedGift) {
        const balance = appliedGift.remainingBalance || 0;
        total -= balance;
        if (total < 0) total = 0;
      }
      return total;
    }

    function getGiftUsedAmount() {
      // How much of the gift balance is being used for this booking (after discount)
      if (!appliedGift) return 0;
      const total = getDiscountedTotal();
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

      // Staff info
      let staffHtml = '';
      if (selectedStaff) {
        staffHtml = '<div class="confirm-row"><span class="confirm-label">Staff</span><span class="confirm-value"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + (selectedStaff.color || '#6366f1') + ';margin-right:6px;"></span>' + esc(selectedStaff.name) + '</span></div>';
      }

      // Build items list
      let itemsHtml = '<div class="confirm-row"><span class="confirm-label">Service</span><span class="confirm-value">' + esc(selectedService.name) + ' — $' + parseFloat(selectedService.price).toFixed(2) + '</span></div>';
      cart.forEach(c => {
        const label = c.type === 'product' ? 'Product' : 'Service';
        itemsHtml += '<div class="confirm-row"><span class="confirm-label">' + label + '</span><span class="confirm-value">' + esc(c.name) + ' — $' + c.price.toFixed(2) + '</span></div>';
      });

      let totalPrice = getTotalPrice();
      let discountAmt = getDiscountAmount();
      let discountedTotal = getDiscountedTotal();
      let chargedPrice = getChargedPrice();
      let giftUsed = getGiftUsedAmount();

      // Build price breakdown HTML
      let breakdownHtml = '';

      // Subtotal row
      breakdownHtml += '<div class="confirm-row" style="border-top:2px solid #e8ece8;padding-top:10px;"><span class="confirm-label">Subtotal</span><span class="confirm-value">$' + totalPrice.toFixed(2) + '</span></div>';

      // Discount row (if applicable)
      if (appliedDiscount && discountAmt > 0) {
        breakdownHtml += '<div class="confirm-row"><span class="confirm-label" style="color:#b45309;">\ud83c\udf89 ' + esc(appliedDiscount.name) + ' (' + appliedDiscount.percentage + '% off)</span><span class="confirm-value" style="color:#b45309;">-$' + discountAmt.toFixed(2) + '</span></div>';
      }

      // Gift card row (if applicable)
      if (appliedGift && giftUsed > 0) {
        breakdownHtml += '<div class="confirm-row"><span class="confirm-label" style="color:#2d5a27;">\ud83c\udf81 Gift Card Applied</span><span class="confirm-value" style="color:#2d5a27;">-$' + giftUsed.toFixed(2) + '</span></div>';
      }

      // Total to pay
      let totalLabel = 'Total to Pay';
      let totalColor = '#2d5a27';
      let totalStr = '$' + chargedPrice.toFixed(2);
      if (chargedPrice === 0 && (discountAmt > 0 || giftUsed > 0)) {
        totalStr = 'FREE';
        totalLabel = 'Total';
      }
      breakdownHtml += '<div class="confirm-row" style="border-top:1px solid #e8ece8;padding-top:8px;margin-top:4px;"><span class="confirm-label" style="font-weight:700;font-size:15px;">' + totalLabel + '</span><span class="confirm-value" style="font-weight:700;font-size:15px;color:' + totalColor + ';">' + totalStr + '</span></div>';

      // Savings summary
      const totalSaved = discountAmt + giftUsed;
      if (totalSaved > 0) {
        breakdownHtml += '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px;margin-top:8px;font-size:12px;color:#166534;text-align:center;">You save <strong>$' + totalSaved.toFixed(2) + '</strong> on this booking!</div>';
      }

      // Cancellation policy notice
      let cancelHtml = '';
      if (CANCEL_POLICY && CANCEL_POLICY.enabled) {
        cancelHtml = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;margin-top:10px;font-size:12px;color:#991b1b;">' +
          '<strong>Cancellation Policy:</strong> Cancellations made less than <strong>' + CANCEL_POLICY.hoursBeforeAppointment + ' hour' + (CANCEL_POLICY.hoursBeforeAppointment !== 1 ? 's' : '') + '</strong> before the appointment may incur a <strong>' + CANCEL_POLICY.feePercentage + '% cancellation fee</strong> ($' + (chargedPrice * CANCEL_POLICY.feePercentage / 100).toFixed(2) + ').</div>';
      }

      // Location row
      let locationHtml = '';
      if (selectedLocation) {
        const loc = locations.find(l => l.localId === selectedLocation);
        if (loc) {
          const fullLocAddr = buildFullAddress(loc.address, loc.city, loc.state, loc.zipCode) || loc.address || '';
          const locLabel = fullLocAddr ? esc(loc.name) + ' — ' + esc(fullLocAddr) : esc(loc.name);
          const mapUrl = fullLocAddr ? 'https://maps.google.com/?q=' + encodeURIComponent(fullLocAddr) : '';
          const addrLink = mapUrl ? '<a href="' + mapUrl + '" target="_blank" style="color:var(--accent);text-decoration:underline;">' + locLabel + '</a>' : locLabel;
          locationHtml = '<div class="confirm-row"><span class="confirm-label">Location</span><span class="confirm-value">📍 ' + addrLink + '</span></div>';
        }
      }

      details.innerHTML = itemsHtml +
        staffHtml +
        '<div class="confirm-row"><span class="confirm-label">Date</span><span class="confirm-value">' + dateStr + '</span></div>' +
        '<div class="confirm-row"><span class="confirm-label">Time</span><span class="confirm-value">' + timeStr + ' \u2014 ' + endStr + '</span></div>' +
        '<div class="confirm-row"><span class="confirm-label">Duration</span><span class="confirm-value">' + totalDur + ' min</span></div>' +
        locationHtml +
        breakdownHtml +
        '<div class="confirm-row"><span class="confirm-label">Name</span><span class="confirm-value">' + esc(document.getElementById("clientName").value) + '</span></div>' +
        cancelHtml;
    }

    async function submitBooking() {
      const btn = document.getElementById("btnSubmit");
      const errEl = document.getElementById("bookError");
      // Check consent
      if (!document.getElementById('consentCheck').checked) {
        errEl.textContent = 'Please agree to the Terms of Service and Privacy Policy';
        errEl.style.display = 'block';
        return;
      }
      btn.disabled = true;
      btn.textContent = "Submitting...";
      errEl.style.display = "none";

      try {
        const totalDur = getTotalDuration();
        // Build notes with extra items and staff
        let notesText = document.getElementById("bookingNotes").value.trim();
        if (selectedStaff) {
          notesText = (notesText ? notesText + String.fromCharCode(10) : '') + 'Preferred staff: ' + selectedStaff.name;
        }
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
            discountName: appliedDiscount ? appliedDiscount.name : null,
            discountPercentage: appliedDiscount ? appliedDiscount.percentage : 0,
            discountAmount: getDiscountAmount(),
            subtotal: getTotalPrice(),
            locationId: selectedLocation || null,
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
        renderPaymentSection();
        // Show manage link
        if (data.manageUrl) {
          document.getElementById('manageLinkHref').href = data.manageUrl;
          document.getElementById('manageLink').style.display = 'block';
        }
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
      if (selectedStaff) {
        html += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:#666;">Staff</span><span style="font-weight:600;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + (selectedStaff.color || '#6366f1') + ';margin-right:4px;"></span>' + esc(selectedStaff.name) + '</span></div>';
      }
      if (selectedLocation) {
        const locR = locations.find(l => l.localId === selectedLocation);
        if (locR) {
          const fullLocAddrR = buildFullAddress(locR.address, locR.city, locR.state, locR.zipCode) || locR.address || '';
          const locLabelR = fullLocAddrR ? esc(locR.name) + ' — ' + esc(fullLocAddrR) : esc(locR.name);
          html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:4px 0;font-size:13px;"><span style="color:#666;flex-shrink:0;">Location</span><span style="font-weight:600;text-align:right;">📍 ' + locLabelR + '</span></div>';
        }
      }
      html += '</div>';

      // Price breakdown
      let chargedPriceR = getChargedPrice();
      let giftUsedR = getGiftUsedAmount();
      let discountAmtR = getDiscountAmount();

      html += '<div style="border-top:2px solid #2d5a27;padding-top:10px;">';
      // Subtotal
      html += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span>Subtotal</span><span>$' + totalPrice.toFixed(2) + '</span></div>';

      // Discount line
      if (appliedDiscount && discountAmtR > 0) {
        html += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#b45309;"><span>\ud83c\udf89 ' + esc(appliedDiscount.name) + ' (' + appliedDiscount.percentage + '% off)</span><span>-$' + discountAmtR.toFixed(2) + '</span></div>';
      }

      // Gift card line
      if (appliedGift && giftUsedR > 0) {
        html += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#2d5a27;"><span>\ud83c\udf81 Gift Card</span><span>-$' + giftUsedR.toFixed(2) + '</span></div>';
      }

      // Final total
      let finalStr = '$' + chargedPriceR.toFixed(2);
      if (chargedPriceR === 0 && (discountAmtR > 0 || giftUsedR > 0)) finalStr = 'FREE';
      html += '<div style="display:flex;justify-content:space-between;padding:8px 0 0;font-size:16px;font-weight:700;border-top:1px solid #e8ece8;margin-top:4px;"><span>Total to Pay</span><span style="color:#2d5a27;">' + finalStr + '</span></div>';

      // Savings badge
      const totalSavedR = discountAmtR + giftUsedR;
      if (totalSavedR > 0) {
        html += '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:6px 10px;margin-top:8px;font-size:11px;color:#166534;text-align:center;">You saved <strong>$' + totalSavedR.toFixed(2) + '</strong> on this booking!</div>';
      }
      html += '</div>';

      // Client info
      html += '<div style="border-top:1px solid #e8ece8;padding-top:10px;margin-top:10px;font-size:12px;color:#888;">';
      html += 'Client: ' + esc(document.getElementById("clientName").value);
      const phone = document.getElementById("clientPhone").value;
      if (phone) html += ' \u2022 ' + phone;
      html += '</div>';

      document.getElementById("successReceipt").innerHTML = html;
    }

    function renderPaymentSection() {
      const methods = PAYMENT_METHODS;
      const hasPayment = methods.zelle || methods.cashApp || methods.venmo;
      if (!hasPayment) return;
      const chargedPrice = getChargedPrice();
      if (chargedPrice <= 0) return; // Free booking — no payment needed
      const amountStr = '$' + chargedPrice.toFixed(2);
      // Build QR URL using Google Charts API (no API key needed)
      function qrUrl(text) {
        return 'https://chart.googleapis.com/chart?cht=qr&chs=180x180&choe=UTF-8&chl=' + encodeURIComponent(text);
      }
      // Build deep-link URLs for each payment app
      function zelleUrl(handle) {
        // Zelle doesn't have a universal deep link, show handle as QR
        return 'zelle:' + handle;
      }
      function cashAppUrl(handle) {
        const tag = handle.startsWith('$') ? handle : '$' + handle;
        return 'https://cash.app/' + encodeURIComponent(tag) + '/' + chargedPrice.toFixed(2);
      }
      function venmoUrl(handle) {
        const tag = handle.startsWith('@') ? handle.slice(1) : handle;
        return 'https://venmo.com/' + encodeURIComponent(tag) + '?txn=pay&amount=' + chargedPrice.toFixed(2) + '&note=' + encodeURIComponent('Appointment payment');
      }
      let html = '<div style="border:1.5px solid #bbf7d0;border-radius:14px;padding:16px;background:#f0fdf4;">';
      html += '<div style="font-weight:700;font-size:15px;color:#166534;margin-bottom:4px;">💳 Payment Options</div>';
      html += '<div style="font-size:13px;color:#166534;margin-bottom:14px;">Scan a QR code or tap to pay <strong>' + amountStr + '</strong></div>';
      html += '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">';
      if (methods.zelle) {
        const url = zelleUrl(methods.zelle);
        html += '<div style="flex:1;min-width:130px;max-width:160px;background:#fff;border-radius:12px;padding:12px;border:1px solid #e8ece8;text-align:center;">';
        html += '<div style="font-weight:700;font-size:13px;color:#6d28d9;margin-bottom:8px;">💜 Zelle</div>';
        html += '<img src="' + qrUrl(url) + '" alt="Zelle QR" style="width:120px;height:120px;border-radius:8px;" loading="lazy">';
        html += '<div style="font-size:11px;color:#888;margin-top:6px;word-break:break-all;">' + esc(methods.zelle) + '</div>';
        html += '</div>';
      }
      if (methods.cashApp) {
        const tag = methods.cashApp.startsWith('$') ? methods.cashApp : '$' + methods.cashApp;
        const url = cashAppUrl(methods.cashApp);
        html += '<div style="flex:1;min-width:130px;max-width:160px;background:#fff;border-radius:12px;padding:12px;border:1px solid #e8ece8;text-align:center;">';
        html += '<div style="font-weight:700;font-size:13px;color:#00d632;margin-bottom:8px;">💚 Cash App</div>';
        html += '<a href="' + url + '" target="_blank" style="display:block;">';
        html += '<img src="' + qrUrl(url) + '" alt="Cash App QR" style="width:120px;height:120px;border-radius:8px;" loading="lazy">';
        html += '</a>';
        html += '<div style="font-size:11px;color:#888;margin-top:6px;">' + esc(tag) + '</div>';
        html += '</div>';
      }
      if (methods.venmo) {
        const tag = methods.venmo.startsWith('@') ? methods.venmo : '@' + methods.venmo;
        const url = venmoUrl(methods.venmo);
        html += '<div style="flex:1;min-width:130px;max-width:160px;background:#fff;border-radius:12px;padding:12px;border:1px solid #e8ece8;text-align:center;">';
        html += '<div style="font-weight:700;font-size:13px;color:#3d95ce;margin-bottom:8px;">💙 Venmo</div>';
        html += '<a href="' + url + '" target="_blank" style="display:block;">';
        html += '<img src="' + qrUrl(url) + '" alt="Venmo QR" style="width:120px;height:120px;border-radius:8px;" loading="lazy">';
        html += '</a>';
        html += '<div style="font-size:11px;color:#888;margin-top:6px;">' + esc(tag) + '</div>';
        html += '</div>';
      }
      html += '</div>';
      html += '<div style="font-size:11px;color:#888;margin-top:10px;">Tap a QR code to open the payment app directly on your phone.</div>';
      html += '</div>';
      const el = document.getElementById('paymentSection');
      if (el) { el.innerHTML = html; el.style.display = 'block'; }
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
      const discountAmtT = getDiscountAmount();
      lines.push("SUBTOTAL: $" + totalPrice.toFixed(2));
      if (appliedDiscount && discountAmtT > 0) {
        lines.push("DISCOUNT: " + appliedDiscount.name + " (" + appliedDiscount.percentage + "% off): -$" + discountAmtT.toFixed(2));
      }
      if (appliedGift && giftUsedT > 0) {
        lines.push("GIFT CARD: -$" + giftUsedT.toFixed(2));
      }
      lines.push("TOTAL DUE: $" + chargedPriceT.toFixed(2));
      const totalSavedT = discountAmtT + giftUsedT;
      if (totalSavedT > 0) {
        lines.push("YOU SAVED: $" + totalSavedT.toFixed(2));
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

    async function joinWaitlist() {
      const name = document.getElementById("clientName").value.trim();
      const phone = document.getElementById("clientPhone").value.trim();
      const email = document.getElementById("clientEmail").value.trim();
      if (!name) { alert("Please enter your name first (Step 1)"); return; }
      if (!selectedService) { alert("Please select a service first"); return; }
      if (!selectedDate) { alert("Please select a date first"); return; }
      const msgEl = document.getElementById("waitlistMsg");
      try {
        const res = await fetch(window.location.origin + "/api/public/business/${escHtml(slug)}/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientName: name, clientPhone: phone, clientEmail: email, serviceLocalId: selectedService, preferredDate: selectedDate })
        });
        const data = await res.json();
        if (data.success) {
          msgEl.style.display = "block";
          msgEl.style.background = "var(--bg-selected)";
          msgEl.style.color = "var(--accent-dark)";
          msgEl.innerHTML = "\u2705 " + data.message;
        } else {
          msgEl.style.display = "block";
          msgEl.style.background = "var(--error-bg)";
          msgEl.style.color = "var(--error)";
          msgEl.innerHTML = data.error || "Failed to join waitlist";
        }
      } catch(e) {
        msgEl.style.display = "block";
        msgEl.style.background = "var(--error-bg)";
        msgEl.style.color = "var(--error)";
        msgEl.innerHTML = "Network error. Please try again.";
      }
    }

    // Init — load locations first; if a location is preselected, scope initial data to it
    loadLocations().then(() => {
      renderLocationSelector();
      // checkTopLevelLocClosed must run before updateBizAddressCard so it can auto-set
      // selectedLocation when there is only one location (no ?location= param in URL)
      checkTopLevelLocClosed();
      updateBizAddressCard();
      // Use preselected location for initial data load if available
      loadServices(selectedLocation);
      loadWorkingDays(selectedLocation);
    });

    function checkTopLevelLocClosed() {
      // Determine which location to check: preselected or the only one
      let locToCheck = null;
      if (selectedLocation) {
        locToCheck = locations.find(function(l) { return l.localId === selectedLocation; });
      } else if (locations.length === 1) {
        locToCheck = locations[0];
        selectedLocation = locToCheck.localId; // auto-select the only location
      }
      const banner = document.getElementById('topLocClosedBanner');
      const msgEl = document.getElementById('topLocClosedMsg');
      const step0 = document.getElementById('step-0');
      if (!banner || !msgEl) return;
      if (locToCheck && locToCheck.temporarilyClosed) {
        const reopenOn = locToCheck.reopenOn || null;
        let msg = '';
        if (reopenOn) {
          const d = new Date(reopenOn + 'T00:00:00');
          const formatted = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
          msg = locToCheck.name + ' is temporarily closed and will reopen on ' + formatted + '. No new bookings are being accepted until then.';
        } else {
          msg = (locToCheck.name || 'This location') + ' is temporarily closed for an indefinite period. No new bookings are being accepted at this time. Please check back later.';
        }
        msgEl.textContent = msg;
        banner.classList.add('show');
        // Hide step-0 so clients cannot start booking
        if (step0) step0.style.display = 'none';
      } else {
        banner.classList.remove('show');
        if (step0 && !${JSON.stringify(!!owner.temporaryClosed)}) step0.style.display = '';
      }
    }
    loadProducts();
    loadDiscounts();
    loadStaff();
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


function manageAppointmentPage(slug: string, owner: any, appt: any, client: any, locations: any[] = []): string {
  const bizName = escHtml(owner.businessName);
  const logoUri = owner.businessLogoUri || "";
  const logoTag = logoUri ? `<img src="${escHtml(logoUri)}" alt="${bizName}" class="biz-logo" />` : "";
  const apptDate = appt.date;
  const apptTime = formatTime12(appt.time);
  const statusClass = appt.status === "cancelled" ? "status-cancelled" : appt.status === "confirmed" ? "status-confirmed" : "status-pending";
  const isPending = appt.status === "pending";
  const isConfirmed = appt.status === "confirmed";
  const isCancellable = appt.status !== "cancelled" && appt.status !== "completed";
  const clientPhone = client?.phone || "";
  // Check if appointment is within 24 hours (for reschedule restriction)
  const apptDateTime = new Date(`${appt.date}T${appt.time}:00`);
  const now = new Date();
  const hoursUntil = (apptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const canReschedule = isConfirmed && hoursUntil > 24;
  const apptLocationId = appt.locationId || "";
  // Resolve the location object for display
  const apptLocation = locations.find((l: any) => l.localId === appt.locationId) ?? null;
  const apptLocationName = apptLocation?.name || "";
  const apptLocationAddr = (() => {
    if (!apptLocation) return "";
    const parts = [apptLocation.address, apptLocation.city, apptLocation.state, apptLocation.zipCode].filter(Boolean);
    return parts.join(", ");
  })();
  const apptLocationPhone = apptLocation?.phone || "";
  // Build both map URLs — JS on the page will pick the right one based on user agent
  const apptLocationMapUrlGoogle = apptLocationAddr
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(apptLocationAddr)}`
    : "";
  const apptLocationMapUrlApple = apptLocationAddr
    ? `https://maps.apple.com/?q=${encodeURIComponent(apptLocationAddr)}`
    : "";
  const apptLocationMapUrl = apptLocationMapUrlGoogle; // used as data attribute; JS selects the right one
  const apiBase = "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Manage Appointment — ${bizName}</title>
  <meta name="robots" content="noindex" />
  ${baseStyles()}
  <style>
    .appt-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 16px;
    }
    .appt-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
    .appt-row:last-child { border-bottom: none; }
    .appt-label { color: var(--text-secondary); font-size: 14px; }
    .appt-value { font-weight: 600; font-size: 14px; }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-confirmed { background: #dcfce7; color: #166534; }
    .status-cancelled { background: #fee2e2; color: #991b1b; }
    .status-completed { background: #e0e7ff; color: #3730a3; }
    .btn-cancel {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      background: var(--error);
      color: #fff;
      margin-top: 8px;
      transition: opacity 0.2s;
    }
    .btn-cancel:hover { opacity: 0.9; }
    .btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-reschedule {
      width: 100%;
      padding: 14px;
      border: 2px solid var(--accent);
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      background: transparent;
      color: var(--accent);
      margin-top: 8px;
      transition: all 0.2s;
    }
    .btn-reschedule:hover { background: var(--accent-bg); }
    .phone-input {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid var(--border-input);
      border-radius: 10px;
      font-size: 15px;
      background: var(--bg-input);
      color: var(--text);
      margin-top: 8px;
    }
    .phone-input:focus { outline: none; border-color: var(--accent); }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin: 24px 0 12px;
    }
    .msg-box {
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      margin-top: 12px;
      display: none;
    }
    .msg-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .msg-error { background: var(--error-bg); color: var(--error); border: 1px solid var(--error-border); }
    .reschedule-panel { display: none; margin-top: 16px; }
    .reschedule-panel.active { display: block; }
    .date-input {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid var(--border-input);
      border-radius: 10px;
      font-size: 15px;
      background: var(--bg-input);
      color: var(--text);
      margin-top: 8px;
    }
    .date-input:focus { outline: none; border-color: var(--accent); }
    .slot-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 12px;
    }
    .slot-btn {
      padding: 10px 4px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg-card);
      color: var(--text);
      font-size: 13px;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
    }
    .slot-btn:hover { border-color: var(--accent); background: var(--accent-bg); }
    .slot-btn.selected { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 600; }
    .slot-loading { text-align: center; color: var(--text-muted); padding: 20px; font-size: 14px; }
    .btn-confirm-reschedule {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      background: var(--accent);
      color: #fff;
      margin-top: 12px;
      transition: opacity 0.2s;
    }
    .btn-confirm-reschedule:hover { opacity: 0.9; }
    .btn-confirm-reschedule:disabled { opacity: 0.5; cursor: not-allowed; }
    @media (prefers-color-scheme: dark) {
      .status-pending { background: #3a3018; color: #fbbf24; }
      .status-confirmed { background: #1e3a1a; color: #4ade80; }
      .status-cancelled { background: #3a1818; color: #f87171; }
      .status-completed { background: #1e1e3a; color: #818cf8; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logoTag}
      <h1 style="font-size:22px;font-weight:700;">${bizName}</h1>
      <p style="color:var(--text-secondary);font-size:14px;margin-top:4px;">Manage Your Appointment</p>
    </div>

    <div class="appt-card">
      <div class="appt-row">
        <span class="appt-label">Date</span>
        <span class="appt-value">${escHtml(apptDate)}</span>
      </div>
      <div class="appt-row">
        <span class="appt-label">Time</span>
        <span class="appt-value">${apptTime}</span>
      </div>
      <div class="appt-row">
        <span class="appt-label">Duration</span>
        <span class="appt-value">${appt.duration || 60} min</span>
      </div>
      <div class="appt-row">
        <span class="appt-label">Status</span>
        <span class="status-badge ${statusClass}">${escHtml(appt.status)}</span>
      </div>
      ${apptLocationName ? `
      <div class="appt-row">
        <span class="appt-label">Location</span>
        <span class="appt-value" style="text-align:right;max-width:60%;">
          ${escHtml(apptLocationName)}
          ${apptLocationAddr ? `<br/>${apptLocationMapUrlGoogle ? `<a id="map-link" href="${escHtml(apptLocationMapUrlGoogle)}" data-google="${escHtml(apptLocationMapUrlGoogle)}" data-apple="${escHtml(apptLocationMapUrlApple)}" target="_blank" rel="noopener" style="font-size:12px;font-weight:400;color:var(--accent);text-decoration:none;">${escHtml(apptLocationAddr)} ↗</a><script>try{var ua=navigator.userAgent||'';if(/iPad|iPhone|iPod/.test(ua)&&!window.MSStream){var ml=document.getElementById('map-link');if(ml)ml.href=ml.getAttribute('data-apple');}}catch(e){}</script>` : `<span style="font-size:12px;font-weight:400;color:var(--text-secondary);">${escHtml(apptLocationAddr)}</span>`}` : ""}
          ${apptLocationPhone ? `<br/><a href="tel:${escHtml(apptLocationPhone)}" style="font-size:12px;font-weight:400;color:var(--accent);text-decoration:none;">📞 ${escHtml(apptLocationPhone)}</a>` : ""}
        </span>
      </div>` : ""}
    </div>

    ${isCancellable ? `
    <div id="action-section">
      <p class="section-title">Verify Your Identity</p>
      <input type="tel" id="phone-input" class="phone-input" placeholder="Phone number used when booking" value="${escHtml(clientPhone)}" ${clientPhone ? 'readonly style="background:var(--bg-card);opacity:0.8;"' : ''} />
      ${clientPhone ? '<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Phone auto-filled from your booking record</p>' : ''}

      ${(() => {
        const cp = owner.cancellationPolicy;
        if (cp && cp.enabled) {
          const apptDt = new Date(`${appt.date}T${appt.time}:00`);
          const nowDt = new Date();
          const hrsUntil = (apptDt.getTime() - nowDt.getTime()) / (1000 * 60 * 60);
          if (hrsUntil <= cp.hoursBeforeAppointment) {
            const svcPrice = parseFloat(appt.totalPrice || appt.price || '0');
            const fee = (svcPrice * cp.feePercentage / 100).toFixed(2);
            return `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px;color:#991b1b;"><strong>⚠️ Late Cancellation Fee:</strong> This appointment is within <strong>${cp.hoursBeforeAppointment} hour${cp.hoursBeforeAppointment !== 1 ? 's' : ''}</strong> of the scheduled time. A <strong>${cp.feePercentage}% cancellation fee ($${fee})</strong> may apply.</div>`;
          } else {
            return `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px;margin-bottom:12px;font-size:12px;color:#166534;">Free cancellation available (more than ${cp.hoursBeforeAppointment} hours before appointment).</div>`;
          }
        }
        return '';
      })()}
      <button class="btn-cancel" id="cancel-btn" onclick="cancelAppointment()">Cancel Appointment</button>

      ${isPending ? '<p style="font-size:12px;color:var(--text-secondary);margin-top:12px;text-align:center;">Your appointment is pending approval. You can cancel it, but rescheduling is available only after the business confirms your appointment.</p>' : ''}

      ${canReschedule ? `
      <button class="btn-reschedule" id="reschedule-toggle" onclick="toggleReschedule()">Request Reschedule</button>

      <div id="reschedule-panel" class="reschedule-panel">
        <p class="section-title">Pick a New Date & Time</p>
        <input type="date" id="new-date" class="date-input" min="${new Date().toISOString().split("T")[0]}" />
        <div id="slot-container"></div>
        <button class="btn-confirm-reschedule" id="confirm-reschedule-btn" onclick="confirmReschedule()" disabled>Confirm New Time</button>
      </div>
      ` : ''}

      ${isConfirmed && !canReschedule ? '<p style="font-size:12px;color:var(--error);margin-top:12px;text-align:center;">Rescheduling is not available within 24 hours of the appointment time. You may still cancel.</p>' : ''}

      <div id="msg-box" class="msg-box"></div>
    </div>
    ` : `
    <div style="text-align:center;padding:20px;color:var(--text-secondary);">
      <p>This appointment is <strong>${escHtml(appt.status)}</strong> and cannot be modified.</p>
    </div>
    `}

    <div style="text-align:center;margin-top:32px;">
      <a href="/api/book/${escHtml(slug)}" style="color:var(--accent);font-size:14px;text-decoration:none;">Book a new appointment</a>
    </div>

    <footer style="text-align:center;padding:24px 0 16px;color:var(--text-muted);font-size:12px;">
      <p>Powered by <strong>Lime of Time</strong></p>
      <div style="margin-top:8px;">
        <a href="/api/legal/privacy-policy" style="color:var(--text-muted);text-decoration:none;margin:0 8px;">Privacy</a>
        <a href="/api/legal/terms-of-service" style="color:var(--text-muted);text-decoration:none;margin:0 8px;">Terms</a>
      </div>
    </footer>
  </div>

  <script>
    const SLUG = '${slug.replace(/'/g, "\\'")}';
    const APPT_ID = '${(appt.localId || "").replace(/'/g, "\\'")}';
    const APPT_LOCATION_ID = '${apptLocationId.replace(/'/g, "\\'")}';
    const API_BASE = '${apiBase}';
    let selectedSlot = null;

    function showMsg(text, isError) {
      const box = document.getElementById('msg-box');
      box.textContent = text;
      box.className = 'msg-box ' + (isError ? 'msg-error' : 'msg-success');
      box.style.display = 'block';
    }

    async function cancelAppointment() {
      const phone = document.getElementById('phone-input').value.trim();
      if (!phone) { showMsg('Please enter your phone number to verify your identity.', true); return; }
      const btn = document.getElementById('cancel-btn');
      btn.disabled = true;
      btn.textContent = 'Cancelling...';
      try {
        const res = await fetch(API_BASE + '/api/public/appointment/' + APPT_ID + '/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: SLUG, clientPhone: phone })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showMsg(data.message || 'Appointment cancelled.', false);
          document.getElementById('action-section').innerHTML = '<div style="text-align:center;padding:20px;"><p style="color:var(--accent);font-weight:600;">Appointment Cancelled</p></div>';
        } else {
          showMsg(data.error || 'Failed to cancel.', true);
          btn.disabled = false;
          btn.textContent = 'Cancel Appointment';
        }
      } catch (e) {
        showMsg('Network error. Please try again.', true);
        btn.disabled = false;
        btn.textContent = 'Cancel Appointment';
      }
    }

    function toggleReschedule() {
      const panel = document.getElementById('reschedule-panel');
      panel.classList.toggle('active');
    }

    document.getElementById('new-date')?.addEventListener('change', async function() {
      const date = this.value;
      if (!date) return;
      const container = document.getElementById('slot-container');
      container.innerHTML = '<div class="slot-loading">Loading available times...</div>';
      selectedSlot = null;
      document.getElementById('confirm-reschedule-btn').disabled = true;
      try {
        const locParam = APPT_LOCATION_ID ? '&locationId=' + encodeURIComponent(APPT_LOCATION_ID) : '';
        const res = await fetch(API_BASE + '/api/public/business/' + SLUG + '/slots?date=' + date + '&duration=${appt.duration || 60}' + locParam);
        const data = await res.json();
        if (data.slots && data.slots.length > 0) {
          container.innerHTML = '<div class="slot-grid">' + data.slots.map(function(s) {
            var h = parseInt(s.split(':')[0]);
            var m = s.split(':')[1];
            var ampm = h >= 12 ? 'PM' : 'AM';
            var h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            return '<button class="slot-btn" data-time="' + s + '" onclick="selectSlot(this, &apos;' + s + '&apos;)">' + h12 + ':' + m + ' ' + ampm + '</button>';
          }).join('') + '</div>';
        } else {
          container.innerHTML = '<div class="slot-loading">No available times for this date.</div>';
        }
      } catch (e) {
        container.innerHTML = '<div class="slot-loading" style="color:var(--error);">Failed to load times.</div>';
      }
    });

    function selectSlot(el, time) {
      document.querySelectorAll('.slot-btn').forEach(function(b) { b.classList.remove('selected'); });
      el.classList.add('selected');
      selectedSlot = time;
      document.getElementById('confirm-reschedule-btn').disabled = false;
    }

    async function confirmReschedule() {
      if (!selectedSlot) return;
      const phone = document.getElementById('phone-input').value.trim();
      if (!phone) { showMsg('Please enter your phone number to verify your identity.', true); return; }
      const newDate = document.getElementById('new-date').value;
      const btn = document.getElementById('confirm-reschedule-btn');
      btn.disabled = true;
      btn.textContent = 'Rescheduling...';
      try {
        const res = await fetch(API_BASE + '/api/public/appointment/' + APPT_ID + '/reschedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: SLUG, clientPhone: phone, newDate: newDate, newTime: selectedSlot })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showMsg(data.message || 'Appointment rescheduled!', false);
          setTimeout(function() { location.reload(); }, 1500);
        } else {
          showMsg(data.error || 'Failed to reschedule.', true);
          btn.disabled = false;
          btn.textContent = 'Confirm New Time';
        }
      } catch (e) {
        showMsg('Network error. Please try again.', true);
        btn.disabled = false;
        btn.textContent = 'Confirm New Time';
      }
    }
  </script>
</body>
</html>`;
}
