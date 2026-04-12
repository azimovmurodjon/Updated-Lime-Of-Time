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
      res.json(filteredServices.map((s) => ({
        localId: s.localId,
        name: s.name,
        duration: s.duration,
        price: s.price,
        color: s.color,
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
        res.json({ date, slots: [] });
        return;
      }
      const allAppts = await db.getAppointmentsByOwner(owner.id);
      const allSchedule = await db.getCustomScheduleByOwner(owner.id);
      const mode = (owner.scheduleMode as "weekly" | "custom") || "weekly";
      const buffer = (owner as any).bufferTime || 0;
      // Filter appointments and custom schedule to the selected location when provided
      const appts = locationLocalId
        ? allAppts.filter((a: any) => a.locationId === locationLocalId)
        : allAppts;
      const schedule = locationLocalId
        ? allSchedule.filter((cs: any) => cs.locationId === locationLocalId || cs.locationId == null)
        : allSchedule;
      // Determine effective working hours: staff > location > global (most specific wins)
      let effectiveWorkingHours = owner.workingHours;
      if (locationLocalId) {
        const locs = await db.getLocationsByOwner(owner.id);
        const loc = locs.find((l: any) => l.localId === locationLocalId);
        if (loc && loc.workingHours) {
          const locWh = typeof loc.workingHours === 'object' ? loc.workingHours : JSON.parse(loc.workingHours as string);
          effectiveWorkingHours = locWh;
        }
      }
      if (staffLocalId) {
        const staffList = await db.getStaffByOwner(owner.id);
        const staff = staffList.find((s: any) => s.localId === staffLocalId);
        if (staff && staff.workingHours) {
          const staffWh = typeof staff.workingHours === 'object' ? staff.workingHours : JSON.parse(staff.workingHours as string);
          effectiveWorkingHours = staffWh;
        }
      }
      const slots = generateAvailableSlots(
        date,
        duration,
        effectiveWorkingHours,
        appts,
        30,
        schedule,
        mode,
        buffer
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
      const weeklyDays: Record<string, boolean> = {};
      DAYS_OF_WEEK.forEach((day) => {
        const entry = wh[day] || wh[day.toLowerCase()];
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
          bookLocationAddress = loc.address || undefined;
          if (loc.workingHours) {
            const locWh = typeof loc.workingHours === 'object' ? loc.workingHours : JSON.parse(loc.workingHours as string);
            if (locWh && Object.keys(locWh).length > 0) bookWorkingHours = locWh;
          }
        }
      }

      const bookMode = (owner.scheduleMode as "weekly" | "custom") || "weekly";
      const bookBuffer = (owner as any).bufferTime || 0;
      const slots = generateAvailableSlots(date, dur, bookWorkingHours, bookAppts, 30, bookSchedule, bookMode, bookBuffer);
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
      try {
        const extrasLabel = extras.length > 0 ? ` + ${extras.length} extra` : "";
        const phoneLabel = clientPhone ? ` | 📞 ${clientPhone}` : "";
        const priceLabel = finalTotal > 0 ? ` | $${finalTotal.toFixed(2)}` : "";
        await notifyOwner({
          title: `📅 New Booking Request — ${owner.businessName}`,
          content: `${clientName}${phoneLabel} requested ${svc?.name ?? "a service"}${extrasLabel}\nDate: ${date} at ${time} (${dur} min)${priceLabel}\nTap to review and confirm.`,
        });
      } catch (pushErr) {
        console.warn("[Public API] Failed to send push notification:", pushErr);
      }

      res.json({
        success: true,
        appointmentId: appointmentLocalId,
        manageUrl: `/api/manage/${req.params.slug}/${appointmentLocalId}`,
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
      try {
        const svcList = await db.getServicesByOwner(owner.id);
        const svc = svcList.find((s) => s.localId === appt.serviceLocalId);
        await notifyOwner({
          title: `❌ Appointment Cancelled — ${owner.businessName}`,
          content: `${client?.name || "A client"} cancelled their ${svc?.name || "appointment"}\nDate: ${appt.date} at ${appt.time} (${appt.duration} min)\nTap to view your calendar.`,
        });
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
      const schedule = await db.getCustomScheduleByOwner(owner.id);
      const mode = (owner.scheduleMode as "weekly" | "custom") || "weekly";
      const bufferVal = (owner as any).bufferTime || 0;
      // Exclude current appointment from conflict check
      const otherAppts = appts.filter((a: any) => a.localId !== appointmentId);
      const slots = generateAvailableSlots(newDate, appt.duration, owner.workingHours, otherAppts, 30, schedule, mode, bufferVal);
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
      try {
        const svcList = await db.getServicesByOwner(owner.id);
        const svc = svcList.find((s) => s.localId === appt.serviceLocalId);
        await notifyOwner({
          title: `🔄 Appointment Rescheduled — ${owner.businessName}`,
          content: `${client?.name || "A client"} rescheduled their ${svc?.name || "appointment"}\nNew date: ${newDate} at ${newTime}\nTap to review and confirm.`,
        });
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
      try {
        const svcList = await db.getServicesByOwner(owner.id);
        const svc = svcList.find((s) => s.localId === serviceLocalId);
        await notifyOwner({
          title: `⏳ New Waitlist Entry — ${owner.businessName}`,
          content: `${clientName} joined the waitlist for ${svc?.name || "a service"}\nPreferred date: ${preferredDate}\nTap to view waitlist.`,
        });
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
      const client = clientList.find((c) => c.localId === appt.clientLocalId);
      res.send(manageAppointmentPage(req.params.slug, owner, appt, client || null));
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
      res.send(bookingPage(req.params.slug, owner, locationId));
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
      res.send(bookingPage(req.params.slug, owner, req.params.locationId));
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
        padding: 24px 0 16px;
      }
      .header .biz-logo {
        width: 64px; height: 64px;
        border-radius: 16px;
        object-fit: cover;
        margin-bottom: 8px;
        border: 2px solid var(--border);
      }
      .header h1 {
        font-size: 22px;
        font-weight: 700;
        color: var(--accent-dark);
        margin-bottom: 4px;
      }
      .header .subtitle {
        font-size: 12px;
        color: var(--text-muted);
      }
      .card {
        background: var(--bg-card);
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 16px;
        border: 1px solid var(--border);
        box-shadow: 0 1px 3px var(--shadow);
      }
      .card h2 {
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
        margin-bottom: 12px;
      }
      .biz-info { display: flex; flex-direction: column; gap: 6px; }
      .biz-info-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }
      .biz-info-row a { color: var(--accent); text-decoration: underline; }
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
      .btn-primary { background: var(--accent); color: #fff; }
      .btn-primary:disabled { background: var(--btn-disabled); cursor: not-allowed; }
      .btn-secondary { background: var(--accent-bg); color: var(--accent-dark); }
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
      .service-list { display: flex; flex-direction: column; gap: 8px; }
      .service-item {
        display: flex;
        align-items: center;
        padding: 14px;
        border: 2px solid var(--border);
        border-radius: 12px;
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s;
      }
      .service-item:hover { background: var(--bg-card-hover); }
      .service-item.selected { border-color: var(--accent); background: var(--accent-bg-light); }
      .service-dot {
        width: 12px; height: 12px;
        border-radius: 50%;
        margin-right: 12px;
        flex-shrink: 0;
      }
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
        border-radius: 10px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        border: 2px solid transparent;
        transition: all 0.15s;
      }
      .date-cell:hover:not(.disabled) { background: var(--accent-bg-light); }
      .date-cell.selected { border-color: var(--accent); background: var(--bg-selected); color: var(--accent-dark); }
      .date-cell.disabled { opacity: 0.3; cursor: not-allowed; }
      .date-cell .day-name { font-size: 10px; color: var(--text-hint); font-weight: 400; }
      .date-cell .day-num { font-size: 15px; }
      .time-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .time-slot {
        padding: 10px;
        text-align: center;
        border: 2px solid var(--border);
        border-radius: 10px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.15s;
      }
      .time-slot:hover { background: var(--accent-bg-light); }
      .time-slot.selected { border-color: var(--accent); background: var(--bg-selected); color: var(--accent-dark); }
      .confirm-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #f0f0f0;
        font-size: 14px;
      }
      .confirm-row:last-child { border-bottom: none; }
      .confirm-label { color: var(--text-muted); }
      .confirm-value { font-weight: 600; color: var(--text); }
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
      .step-dot.active { background: var(--accent); }
      .step-dot.done { background: #8cc084; }
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
      .cal-day.today { font-weight:700; color:var(--accent); }
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

function bookingPage(slug: string, owner: any, preselectedLocationId?: string | null): string {
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
  <link rel="canonical" href="https://manussched-dw4mhfnu.manus.space/api/book/${escHtml(owner.businessName.toLowerCase().replace(/\s+/g, '-'))}">
  ${baseStyles()}
</head>
<body>
  <div class="container" id="app">
    <div class="header" role="banner">
      ${owner.logoUrl ? `<img src="${escHtml(owner.logoUrl)}" alt="${escHtml(owner.businessName)} logo" class="biz-logo">` : ''}
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
      <div style="font-size:16px;font-weight:700;color:var(--text);">${escHtml(owner.businessName)}</div>
      ${owner.address ? `<div class="biz-info-row"><span>📍</span><a href="https://maps.google.com/?q=${encodeURIComponent(owner.address)}" target="_blank">${escHtml(owner.address)}</a></div>` : ""}
      ${owner.phone ? `<div class="biz-info-row"><span>📞</span><span>${escHtml(formatPhoneNumber(owner.phone))}</span></div>` : ""}
      ${owner.email ? `<div class="biz-info-row"><span>✉️</span><span>${escHtml(owner.email)}</span></div>` : ""}
      ${owner.description ? `<div style="font-size:13px;color:var(--text-muted);margin-top:6px;">${escHtml(owner.description)}</div>` : ""}
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
      <div id="locationSelector" style="display:none;"></div>
      <h2>Select a Service</h2>
      <div id="serviceList" class="service-list">
        <div class="skeleton skeleton-block"></div>
        <div class="skeleton skeleton-block"></div>
        <div class="skeleton skeleton-block"></div>
      </div>
      <div id="staffSection" style="display:none;margin-top:20px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:10px;">Choose a Staff Member <span style="font-size:12px;color:#888;font-weight:400;">(optional)</span></h3>
        <div id="staffList" class="service-list"></div>
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
        <div id="noSlots" style="display:none;text-align:center;color:#888;padding:20px;font-size:14px;">No available time slots for this date.<br><button class="btn btn-secondary" style="margin-top:12px;width:auto;display:inline-block;padding:10px 20px;font-size:13px;" onclick="joinWaitlist()">Join Waitlist</button></div>
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
    let services = [];
    let products = [];
    let discounts = [];
    let staffMembers = [];
    let locations = [];
    let customDays = {};
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
      } catch(e) { customDays = {}; }
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

    function renderLocationSelector() {
      if (locations.length <= 1) return;
      var container = document.getElementById('locationSelector');
      if (!container) return;
      container.style.display = 'block';
      var html = '<div style="margin-bottom:16px;"><h3 style="font-size:16px;font-weight:600;margin-bottom:8px;">Select Location</h3>';
      locations.forEach(function(loc) {
        var isSelected = selectedLocation === loc.localId;
        var border = isSelected ? '#4CAF50' : '#e0e0e0';
        var bg = isSelected ? '#E8F5E9' : '#fff';
        html += '<div onclick="selectLocation(&apos;' + loc.localId + '&apos;)" style="padding:12px;border:2px solid ' + border + ';border-radius:10px;margin-bottom:8px;cursor:pointer;background:' + bg + ';transition:all 0.2s;">';
        html += '<div style="font-weight:600;font-size:14px;">' + escText(loc.name) + '</div>';
        if (loc.address) html += '<div style="font-size:12px;color:#666;margin-top:2px;">' + escText(loc.address) + '</div>';
        if (loc.phone) html += '<div style="font-size:12px;color:#666;">' + escText(loc.phone) + '</div>';
        html += '</div>';
      });
      html += '</div>';
      container.innerHTML = html;
    }

    function selectLocation(locId) {
      selectedLocation = locId;
      slotCache = {}; // Clear cache when location changes
      renderLocationSelector();
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
      if (selectedLocation) {
        const loc = locations.find(l => l.localId === selectedLocation);
        if (loc && loc.workingHours) {
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

    function renderServices() {
      const list = document.getElementById("serviceList");
      if (services.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No services available</div>';
        return;
      }
      // Group by category
      const catMap = {};
      services.forEach(s => {
        const cat = (s.category || '').trim() || 'General';
        if (!catMap[cat]) catMap[cat] = [];
        catMap[cat].push(s);
      });
      const cats = Object.keys(catMap).sort((a, b) => {
        if (a === 'General') return 1;
        if (b === 'General') return -1;
        return a.localeCompare(b);
      });
      const hasMultiCat = cats.length > 1;
      let html = '';
      cats.forEach(cat => {
        if (hasMultiCat) {
          html += '<div style="display:flex;align-items:center;gap:6px;margin:12px 0 6px;">' +
            '<div style="width:6px;height:6px;border-radius:50%;background:var(--accent)"></div>' +
            '<span style="font-size:13px;font-weight:700;color:#333;">' + esc(cat) + '</span>' +
            '<span style="font-size:12px;color:#888;">(' + catMap[cat].length + ')</span></div>';
        }
        catMap[cat].forEach(s => {
          const dur = s.duration >= 60 ? (s.duration / 60) + " hr" + (s.duration > 60 ? "s" : "") : s.duration + " min";
          html += '<div class="service-item" id="svc-' + s.localId + '" onclick="selectService(&apos;' + s.localId + '&apos;)" style="' + (hasMultiCat ? 'margin-left:4px;' : '') + '">'+
            '<div class="service-dot" style="background:' + (s.color||'#4a8c3f') + '"></div>'+
            '<div class="service-info"><div class="service-name">' + esc(s.name) + '</div>'+
            '<div class="service-meta">' + dur + '</div></div>'+
            '<div class="service-price">$' + parseFloat(s.price).toFixed(2) + '</div></div>';
        });
      });
      list.innerHTML = html;
    }

    function selectService(id) {
      selectedService = services.find(s => s.localId === id);
      selectedStaff = null;
      document.querySelectorAll("#serviceList .service-item").forEach(el => el.classList.remove("selected"));
      const el = document.getElementById("svc-" + id);
      if (el) el.classList.add("selected");
      document.getElementById("btnToDate").disabled = false;
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
        '<div class="service-dot" style="background:#888"></div>' +
        '<div class="service-info"><div class="service-name">Any Available</div>' +
        '<div class="service-meta">First available staff member</div></div></div>';
      eligible.forEach(s => {
        html += '<div class="service-item" id="staff-' + s.localId + '" onclick="selectStaff(&apos;' + s.localId + '&apos;)">' +
          '<div class="service-dot" style="background:' + (s.color || '#6366f1') + '"></div>' +
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

    function renderAddServiceList() {
      const el = document.getElementById("addServiceList");
      const cartSvcIds = cart.filter(c => c.type === 'service').map(c => c.id);
      const available = services.filter(s => s.localId !== selectedService.localId && !cartSvcIds.includes(s.localId));
      if (available.length === 0) {
        el.innerHTML = '<div style="text-align:center;color:#888;padding:16px;font-size:13px;">No additional services available</div>';
        return;
      }
      // Group by category
      const catMap = {};
      available.forEach(s => {
        const cat = (s.category || '').trim() || 'General';
        if (!catMap[cat]) catMap[cat] = [];
        catMap[cat].push(s);
      });
      const cats = Object.keys(catMap).sort((a, b) => {
        if (a === 'General') return 1;
        if (b === 'General') return -1;
        return a.localeCompare(b);
      });
      const hasMultiCat = cats.length > 1;
      let html = '';
      cats.forEach(cat => {
        if (hasMultiCat) {
          html += '<div style="display:flex;align-items:center;gap:6px;margin:10px 0 4px;"><span style="font-size:12px;font-weight:700;color:#555;">' + esc(cat) + '</span></div>';
        }
        catMap[cat].forEach(s => {
          const dur = s.duration >= 60 ? (s.duration / 60) + " hr" : s.duration + " min";
          html += '<div class="service-item" onclick="addServiceToCart(&apos;' + s.localId + '&apos;)">' +
            '<div class="service-dot" style="background:' + (s.color||'#4a8c3f') + '"></div>' +
            '<div class="service-info"><div class="service-name">' + esc(s.name) + '</div><div class="service-meta">' + dur + '</div></div>' +
            '<div class="service-price">+ $' + parseFloat(s.price).toFixed(2) + '</div></div>';
        });
      });
      el.innerHTML = html;
    }

    function renderAddProductList() {
      const el = document.getElementById("addProductList");
      const cartProdIds = cart.filter(c => c.type === 'product').map(c => c.id);
      const available = products.filter(p => !cartProdIds.includes(p.localId));
      if (available.length === 0) {
        el.innerHTML = '<div style="text-align:center;color:#888;padding:16px;font-size:13px;">No products available</div>';
        return;
      }
      // Group by brand
      const brandMap = {};
      available.forEach(p => {
        const brand = (p.brand || '').trim() || 'Other';
        if (!brandMap[brand]) brandMap[brand] = [];
        brandMap[brand].push(p);
      });
      const brands = Object.keys(brandMap).sort((a, b) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
      });
      const hasMultiBrand = brands.length > 1;
      let html = '';
      brands.forEach(brand => {
        if (hasMultiBrand) {
          html += '<div style="display:flex;align-items:center;gap:6px;margin:10px 0 4px;"><span style="font-size:12px;font-weight:700;color:#555;">' + esc(brand) + '</span></div>';
        }
        brandMap[brand].forEach(p => {
          html += '<div class="product-item" onclick="addProductToCart(&apos;' + p.localId + '&apos;)">' +
            '<div style="flex:1;"><div style="font-size:15px;font-weight:600;">' + esc(p.name) + '</div>' +
            (p.description ? '<div style="font-size:12px;color:#888;margin-top:2px;">' + esc(p.description) + '</div>' : '') +
            (hasMultiBrand ? '' : (p.brand ? '<div style="font-size:11px;color:#888;margin-top:1px;">' + esc(p.brand) + '</div>' : '')) + '</div>' +
            '<div style="font-size:15px;font-weight:700;color:#2d5a27;">+ $' + parseFloat(p.price).toFixed(2) + '</div></div>';
        });
      });
      el.innerHTML = html;
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
          const locLabel = loc.address ? esc(loc.name) + ' — ' + esc(loc.address) : esc(loc.name);
          locationHtml = '<div class="confirm-row"><span class="confirm-label">Location</span><span class="confirm-value">📍 ' + locLabel + '</span></div>';
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
          const locLabelR = locR.address ? esc(locR.name) + ' — ' + esc(locR.address) : esc(locR.name);
          html += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:#666;">Location</span><span style="font-weight:600;">📍 ' + locLabelR + '</span></div>';
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
      // Use preselected location for initial data load if available
      loadServices(selectedLocation);
      loadWorkingDays(selectedLocation);
    });
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


function manageAppointmentPage(slug: string, owner: any, appt: any, client: any): string {
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
        const res = await fetch(API_BASE + '/api/public/business/' + SLUG + '/slots?date=' + date + '&duration=${appt.duration || 60}');
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
