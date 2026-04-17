import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { sendAppointmentConfirmationEmail } from "./email";
import {
  getPlatformConfig,
  getPublicPlans,
  getBusinessSubscriptionInfo,
  isSmsAllowed,
} from "./subscription";

// ─── Business Owner Router ───────────────────────────────────────────

const businessRouter = router({
  /** Check if a business owner exists by phone number */
  checkByPhone: publicProcedure
    .input(z.object({ phone: z.string().min(1) }))
    .query(async ({ input }) => {
      // Normalize to 10-digit format so formatting differences don't cause lookup misses
      const normalized = db.normalizePhone(input.phone);
      const owner = await db.getBusinessOwnerByPhone(normalized);
      return owner ?? null;
    }),

  /** Check if a business owner exists by email (used for social login matching) */
  checkByEmail: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const owner = await db.getBusinessOwnerByEmail(input.email.toLowerCase());
      return owner ?? null;
    }),

  /** Get business owner by ID */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const owner = await db.getBusinessOwnerById(input.id);
      return owner ?? null;
    }),

  /** Create a new business owner (onboarding) */
  create: publicProcedure
    .input(
      z.object({
        phone: z.string().min(1),
        businessName: z.string().min(1),
        ownerName: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        website: z.string().optional(),
        description: z.string().optional(),
        workingHours: z.any().optional(),
        cancellationPolicy: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Always store phone in normalized 10-digit format for consistent lookup
      const normalizedPhone = db.normalizePhone(input.phone);
      const id = await db.createBusinessOwner({
        phone: normalizedPhone,
        businessName: input.businessName,
        ownerName: input.ownerName ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        website: input.website ?? null,
        description: input.description ?? null,
        workingHours: input.workingHours ?? null,
        cancellationPolicy: input.cancellationPolicy ?? null,
        onboardingComplete: true,
      });
      const owner = await db.getBusinessOwnerById(id);
      return owner!;
    }),

  /** Update business owner settings */
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        businessName: z.string().optional(),
        ownerName: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        website: z.string().optional(),
        description: z.string().optional(),
        businessLogoUri: z.string().optional(),
        defaultDuration: z.number().optional(),
        notificationsEnabled: z.boolean().optional(),
        themeMode: z.enum(["light", "dark", "system"]).optional(),
        temporaryClosed: z.boolean().optional(),
        scheduleMode: z.enum(["weekly", "custom"]).optional(),
        workingHours: z.any().optional(),
        cancellationPolicy: z.any().optional(),
        phone: z.string().optional(),
        bufferTime: z.number().optional(),
        slotInterval: z.number().optional(),
        customSlug: z.string().optional(),
        businessHoursEndDate: z.string().nullable().optional(),
        expoPushToken: z.string().nullable().optional(),
        autoCompleteEnabled: z.boolean().optional(),
        autoCompleteDelayMinutes: z.number().optional(),
        notificationPreferences: z.any().optional(),
        smsTemplates: z.any().optional(),
        // Payment methods
        zelleHandle: z.string().optional(),
        cashAppHandle: z.string().optional(),
        venmoHandle: z.string().optional(),
        paymentNotes: z.string().optional(),
        instagramHandle: z.string().optional(),
        facebookHandle: z.string().optional(),
        tiktokHandle: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateBusinessOwner(id, data);
      return db.getBusinessOwnerById(id);
    }),

  /** Delete business and all related data */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteBusinessOwner(input.id);
      return { success: true };
    }),

  /** Get all data for a business owner (bootstrap) */
  getFullData: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getFullBusinessData(input.id);
    }),
});

// ─── Services Router ─────────────────────────────────────────────────

const servicesRouter = router({
  list: publicProcedure
    .input(z.object({ businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      return db.getServicesByOwner(input.businessOwnerId);
    }),

  create: publicProcedure
    .input(
      z.object({
        businessOwnerId: z.number(),
        localId: z.string(),
        name: z.string().min(1),
        duration: z.number().min(1),
        price: z.string(),
        color: z.string(),
        category: z.string().optional(),
        locationIds: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await db.createService(input);
      return { id, localId: input.localId };
    }),

  update: publicProcedure
    .input(
      z.object({
        localId: z.string(),
        businessOwnerId: z.number(),
        name: z.string().optional(),
        duration: z.number().optional(),
        price: z.string().optional(),
        color: z.string().optional(),
        category: z.string().optional(),
        locationIds: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { localId, businessOwnerId, ...data } = input;
      const svc = await db.getServiceByLocalId(localId, businessOwnerId);
      if (!svc) throw new Error(`Service not found: ${localId}`);
      await db.updateService(svc.id, businessOwnerId, data);
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ localId: z.string(), businessOwnerId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteService(input.localId, input.businessOwnerId);
      return { success: true };
    }),
});

// ─── Clients Router ──────────────────────────────────────────────────

const clientsRouter = router({
  list: publicProcedure
    .input(z.object({ businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      return db.getClientsByOwner(input.businessOwnerId);
    }),

  create: publicProcedure
    .input(
      z.object({
        businessOwnerId: z.number(),
        localId: z.string(),
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await db.createClient(input);
      return { id, localId: input.localId };
    }),

  update: publicProcedure
    .input(
      z.object({
        localId: z.string(),
        businessOwnerId: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { localId, businessOwnerId, ...data } = input;
      await db.updateClient(localId, businessOwnerId, data);
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ localId: z.string(), businessOwnerId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteClient(input.localId, input.businessOwnerId);
      return { success: true };
    }),

  findByPhone: publicProcedure
    .input(z.object({ phone: z.string(), businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      const client = await db.getClientByPhone(input.phone, input.businessOwnerId);
      return client ?? null;
    }),
});

// ─── Appointments Router ─────────────────────────────────────────────

const appointmentsRouter = router({
  list: publicProcedure
    .input(z.object({ businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      return db.getAppointmentsByOwner(input.businessOwnerId);
    }),

  create: publicProcedure
    .input(
      z.object({
        businessOwnerId: z.number(),
        localId: z.string(),
        serviceLocalId: z.string(),
        clientLocalId: z.string(),
        date: z.string(),
        time: z.string(),
        duration: z.number(),
        status: z.enum(["pending", "confirmed", "completed", "cancelled"]).default("pending"),
        notes: z.string().optional(),
        totalPrice: z.number().optional(),
        extraItems: z.any().optional(),
        discountPercent: z.number().optional(),
        discountAmount: z.number().optional(),
        discountName: z.string().optional(),
        giftApplied: z.boolean().optional(),
        giftUsedAmount: z.number().optional(),
        staffId: z.string().optional(),
        locationId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Convert numeric fields to string for decimal DB columns
      const dbInput: any = { ...input };
      if (input.totalPrice != null) dbInput.totalPrice = String(input.totalPrice);
      if (input.discountAmount != null) dbInput.discountAmount = String(input.discountAmount);
      if (input.giftUsedAmount != null) dbInput.giftUsedAmount = String(input.giftUsedAmount);
      if (input.extraItems) dbInput.extraItems = input.extraItems;
      const id = await db.createAppointment(dbInput);
      return { id, localId: input.localId };
    }),

  update: publicProcedure
    .input(
      z.object({
        localId: z.string(),
        businessOwnerId: z.number(),
        status: z.enum(["pending", "confirmed", "completed", "cancelled"]).optional(),
        date: z.string().optional(),
        time: z.string().optional(),
        duration: z.number().optional(),
        notes: z.string().optional(),
        totalPrice: z.number().optional(),
        extraItems: z.any().optional(),
        discountPercent: z.number().optional(),
        discountAmount: z.number().optional(),
        discountName: z.string().optional(),
        giftApplied: z.boolean().optional(),
        giftUsedAmount: z.number().optional(),
        staffId: z.string().optional(),
        locationId: z.string().optional(),
        cancellationReason: z.string().optional(),
        paymentMethod: z.string().optional(),
        paymentStatus: z.enum(["unpaid", "pending_cash", "paid"]).optional(),
        paymentConfirmationNumber: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { localId, businessOwnerId, ...data } = input;
      const dbData: any = { ...data };
      if (data.totalPrice != null) dbData.totalPrice = String(data.totalPrice);
      if (data.discountAmount != null) dbData.discountAmount = String(data.discountAmount);
      if (data.giftUsedAmount != null) dbData.giftUsedAmount = String(data.giftUsedAmount);
      await db.updateAppointment(localId, businessOwnerId, dbData);

      // Send confirmation email to client when appointment is accepted (status → confirmed)
      if (data.status === "confirmed") {
        try {
          const [owner, enrichedAppt] = await Promise.all([
            db.getBusinessOwnerById(businessOwnerId),
            db.getEnrichedAppointment(localId, businessOwnerId),
          ]);
          if (owner && enrichedAppt) {
            // Only send if owner has emailClientOnConfirmation preference enabled (default true)
            const prefs = (owner as any).notificationPreferences ?? {};
            const emailEnabled = prefs.emailClientOnConfirmation !== false;
            if (emailEnabled && enrichedAppt.clientEmail && enrichedAppt.clientEmail.includes("@")) {
              await sendAppointmentConfirmationEmail(owner.businessName, {
                clientName: enrichedAppt.clientName ?? "Valued Client",
                clientEmail: enrichedAppt.clientEmail,
                serviceName: enrichedAppt.serviceName ?? "Service",
                date: enrichedAppt.date,
                time: enrichedAppt.time,
                duration: enrichedAppt.duration ?? 60,
                totalPrice: enrichedAppt.totalPrice ? Number(enrichedAppt.totalPrice) : undefined,
                locationName: enrichedAppt.locationName ?? undefined,
                locationAddress: enrichedAppt.locationAddress ?? undefined,
                locationCity: enrichedAppt.locationCity ?? undefined,
                locationState: enrichedAppt.locationState ?? undefined,
                locationZip: enrichedAppt.locationZip ?? undefined,
                locationPhone: enrichedAppt.locationPhone ?? undefined,
                businessPhone: owner.phone ?? undefined,
                businessAddress: owner.address ?? undefined,
                customSlug: (owner as any).customSlug ?? undefined,
                locationId: enrichedAppt.locationId ?? undefined,
              });
            }
          }
        } catch (emailErr) {
          console.error("[Email] Failed to send confirmation email:", emailErr);
        }
      }

      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ localId: z.string(), businessOwnerId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteAppointment(input.localId, input.businessOwnerId);
      return { success: true };
    }),
});

// ─── Reviews Router ──────────────────────────────────────────────────

const reviewsRouter = router({
  list: publicProcedure
    .input(z.object({ businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      return db.getReviewsByOwner(input.businessOwnerId);
    }),

  create: publicProcedure
    .input(
      z.object({
        businessOwnerId: z.number(),
        localId: z.string(),
        clientLocalId: z.string(),
        appointmentLocalId: z.string().optional(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await db.createReview(input);
      return { id, localId: input.localId };
    }),

  delete: publicProcedure
    .input(z.object({ localId: z.string(), businessOwnerId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteReview(input.localId, input.businessOwnerId);
      return { success: true };
    }),
});

// ─── Discounts Router ────────────────────────────────────────────────

const discountsRouter = router({
  list: publicProcedure
    .input(z.object({ businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      return db.getDiscountsByOwner(input.businessOwnerId);
    }),

  create: publicProcedure
    .input(
      z.object({
        businessOwnerId: z.number(),
        localId: z.string(),
        name: z.string().min(1),
        percentage: z.number().min(1).max(100),
        startTime: z.string(),
        endTime: z.string(),
        daysOfWeek: z.array(z.string()).optional(),
        dates: z.array(z.string()).optional(),
        serviceIds: z.array(z.string()).nullable().optional(),
        active: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const id = await db.createDiscount({
        ...input,
        daysOfWeek: input.daysOfWeek ?? [],
        dates: input.dates ?? [],
        serviceIds: input.serviceIds ?? null,
      });
      return { id, localId: input.localId };
    }),

  update: publicProcedure
    .input(
      z.object({
        localId: z.string(),
        businessOwnerId: z.number(),
        name: z.string().optional(),
        percentage: z.number().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        daysOfWeek: z.array(z.string()).optional(),
        dates: z.array(z.string()).optional(),
        serviceIds: z.array(z.string()).nullable().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { localId, businessOwnerId, ...data } = input;
      await db.updateDiscount(localId, businessOwnerId, data);
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ localId: z.string(), businessOwnerId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteDiscount(input.localId, input.businessOwnerId);
      return { success: true };
    }),
});

// ─── Gift Cards Router ────────────────────────────────────────────────

const giftCardsRouter = router({
  list: publicProcedure
    .input(z.object({ businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      return db.getGiftCardsByOwner(input.businessOwnerId);
    }),

  create: publicProcedure
    .input(
      z.object({
        businessOwnerId: z.number(),
        localId: z.string(),
        code: z.string(),
        serviceLocalId: z.string(),
        recipientName: z.string().optional(),
        recipientPhone: z.string().optional(),
        message: z.string().optional(),
        expiresAt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await db.createGiftCard(input);
      return { id, localId: input.localId };
    }),

  update: publicProcedure
    .input(
      z.object({
        localId: z.string(),
        businessOwnerId: z.number(),
        redeemed: z.boolean().optional(),
        redeemedAt: z.string().optional(),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { localId, businessOwnerId, ...data } = input;
      const updateData: any = { ...data };
      if (data.redeemedAt) updateData.redeemedAt = new Date(data.redeemedAt);
      await db.updateGiftCard(localId, businessOwnerId, updateData);
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ localId: z.string(), businessOwnerId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteGiftCard(input.localId, input.businessOwnerId);
      return { success: true };
    }),

  findByCode: publicProcedure
    .input(z.object({ code: z.string(), businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      const card = await db.getGiftCardByCode(input.code, input.businessOwnerId);
      return card ?? null;
    }),
});

// ─── Custom Schedule Router ───────────────────────────────────────────

const customScheduleRouter = router({
  list: publicProcedure
    .input(z.object({ businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      return db.getCustomScheduleByOwner(input.businessOwnerId);
    }),

  upsert: publicProcedure
    .input(
      z.object({
        businessOwnerId: z.number(),
        date: z.string(),
        isOpen: z.boolean(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        /** When provided, this override applies only to this location */
        locationId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db.upsertCustomScheduleDay(
        input.businessOwnerId,
        input.date,
        input.isOpen,
        input.startTime,
        input.endTime,
        input.locationId
      );
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ businessOwnerId: z.number(), date: z.string(), locationId: z.string().optional() }))
    .mutation(async ({ input }) => {
      await db.deleteCustomScheduleDay(input.businessOwnerId, input.date, input.locationId);
      return { success: true };
    }),
});

// ─── Products Router ────────────────────────────────────────────────

const productsRouter = router({
  list: publicProcedure
    .input(z.object({ businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      return db.getProductsByOwner(input.businessOwnerId);
    }),

  create: publicProcedure
    .input(
      z.object({
        businessOwnerId: z.number(),
        localId: z.string(),
        name: z.string().min(1),
        price: z.string(),
        description: z.string().optional(),
        brand: z.string().optional(),
        available: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const id = await db.createProduct(input);
      return { id, localId: input.localId };
    }),

  update: publicProcedure
    .input(
      z.object({
        localId: z.string(),
        businessOwnerId: z.number(),
        name: z.string().optional(),
        price: z.string().optional(),
        description: z.string().optional(),
        brand: z.string().optional(),
        available: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { localId, businessOwnerId, ...data } = input;
      await db.updateProduct(localId, businessOwnerId, data);
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ localId: z.string(), businessOwnerId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteProduct(input.localId, input.businessOwnerId);
      return { success: true };
    }),
});

// ─── Staff Router ─────────────────────────────────────────────────────

const staffRouter = router({
  list: publicProcedure
    .input(z.object({ businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      return db.getStaffByOwner(input.businessOwnerId);
    }),

  create: publicProcedure
    .input(
      z.object({
        businessOwnerId: z.number(),
        localId: z.string(),
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().optional(),
        role: z.string().optional(),
        color: z.string().optional(),
        serviceIds: z.any().optional(),
        locationIds: z.any().optional(),
        workingHours: z.any().optional(),
        active: z.boolean().default(true),
        photoUri: z.string().optional().nullable(),
        commissionRate: z.number().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await db.createStaffMember(input);
      return { id, localId: input.localId };
    }),

  update: publicProcedure
    .input(
      z.object({
        localId: z.string(),
        businessOwnerId: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        role: z.string().optional(),
        color: z.string().optional(),
        serviceIds: z.any().optional(),
        locationIds: z.any().optional(),
        workingHours: z.any().optional(),
        active: z.boolean().optional(),
        photoUri: z.string().optional().nullable(),
        commissionRate: z.number().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const { localId, businessOwnerId, ...data } = input;
      await db.updateStaffMember(localId, businessOwnerId, data);
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ localId: z.string(), businessOwnerId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteStaffMember(input.localId, input.businessOwnerId);
      return { success: true };
    }),
});

// ─── Locations Router ─────────────────────────────────────────────────

const locationsRouter = router({
  list: publicProcedure
    .input(z.object({ businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      return db.getLocationsByOwner(input.businessOwnerId);
    }),

  create: publicProcedure
    .input(
      z.object({
        businessOwnerId: z.number(),
        localId: z.string(),
        name: z.string().min(1),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        isDefault: z.boolean().default(false),
        active: z.boolean().default(true),
        temporarilyClosed: z.boolean().optional(),
        reopenOn: z.string().optional().nullable(),
        workingHours: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await db.createLocation(input);
      return { id, localId: input.localId };
    }),

  update: publicProcedure
    .input(
      z.object({
        localId: z.string(),
        businessOwnerId: z.number(),
        name: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        isDefault: z.boolean().optional(),
        active: z.boolean().optional(),
        temporarilyClosed: z.boolean().optional(),
        reopenOn: z.string().optional().nullable(),
        workingHours: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { localId, businessOwnerId, ...rawData } = input;
      // Strip undefined values so Drizzle does NOT overwrite existing DB columns with NULL
      const data = Object.fromEntries(
        Object.entries(rawData).filter(([, v]) => v !== undefined)
      ) as typeof rawData;
      await db.updateLocation(localId, businessOwnerId, data);
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ localId: z.string(), businessOwnerId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteLocation(input.localId, input.businessOwnerId);
      return { success: true };
    }),
});

// ─── Twilio SMS Router ─────────────────────────────────────────────────────

const twilioRouter = router({
  /**
   * Send an SMS via the platform Twilio account.
   * Credentials are read server-side from platform_config.
   * The smsAction is checked against the business's subscription plan.
   */
  sendSms: publicProcedure
    .input(
      z.object({
        businessOwnerId: z.number(),
        toNumber: z.string(),
        body: z.string(),
        smsAction: z.enum(["confirmation", "reminder", "rebooking", "birthday"]).default("confirmation"),
        // Legacy fields kept for backward compat but ignored (server uses platform_config)
        accountSid: z.string().optional(),
        authToken: z.string().optional(),
        fromNumber: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { businessOwnerId, toNumber, body, smsAction } = input;

      // 1. Check subscription plan allows this SMS action
      const allowed = await isSmsAllowed(businessOwnerId, smsAction);
      if (!allowed) {
        throw new Error(`Your current plan does not include ${smsAction} SMS. Please upgrade your subscription.`);
      }

      // 2. Read Twilio credentials from platform_config (admin-managed)
      const accountSid = await getPlatformConfig("TWILIO_ACCOUNT_SID");
      const authToken = await getPlatformConfig("TWILIO_AUTH_TOKEN");
      const fromNumber = await getPlatformConfig("TWILIO_FROM_NUMBER");

      if (!accountSid || !authToken || !fromNumber) {
        throw new Error("SMS is not configured on this platform. Please contact support.");
      }

      // 3. Check test mode
      const testMode = await getPlatformConfig("TWILIO_TEST_MODE");
      if (testMode === "true") {
        console.log(`[SMS TEST MODE] To: ${toNumber} | Body: ${body}`);
        return { success: true, sid: "test-mode", testMode: true };
      }

      // 4. Send via Twilio
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const params = new URLSearchParams();
      params.append("From", fromNumber);
      params.append("To", toNumber);
      params.append("Body", body);
      const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const data = await response.json() as any;
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to send SMS via Twilio");
      }
      return { success: true, sid: data.sid as string, testMode: false };
    }),
});

// ─── OTP Router ─────────────────────────────────────────────────────
// In-memory OTP store (phone → { code, expiresAt })
// For production scale, replace with Redis or DB table
const otpStore = new Map<string, { code: string; expiresAt: number }>();

async function sendOtpViaTwilio(toNumber: string, code: string): Promise<boolean> {
  const accountSid = await getPlatformConfig("TWILIO_ACCOUNT_SID");
  const authToken = await getPlatformConfig("TWILIO_AUTH_TOKEN");
  const fromNumber = await getPlatformConfig("TWILIO_FROM_NUMBER");
  if (!accountSid || !authToken || !fromNumber) return false;
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams();
    params.append("From", fromNumber);
    params.append("To", toNumber);
    params.append("Body", `Your Lime of Time verification code is: ${code}. Valid for 10 minutes.`);
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const otpRouter = router({
  /** Send OTP to a phone number. Uses Twilio if configured, otherwise test mode (123456). */
  send: publicProcedure
    .input(z.object({ phone: z.string().min(7) }))
    .mutation(async ({ input }) => {
      const testMode = (await getPlatformConfig("TWILIO_TEST_MODE")) === "true";
      const code = testMode ? "123456" : String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
      otpStore.set(input.phone, { code, expiresAt });
      if (!testMode) {
        const sent = await sendOtpViaTwilio(input.phone, code);
        if (!sent) {
          // Fall back to test mode silently if Twilio fails
          otpStore.set(input.phone, { code: "123456", expiresAt });
        }
      }
      return { success: true, testMode };
    }),
  /** Verify OTP for a phone number. */
  verify: publicProcedure
    .input(z.object({ phone: z.string().min(7), code: z.string().length(6) }))
    .mutation(async ({ input }) => {
      const testMode = (await getPlatformConfig("TWILIO_TEST_MODE")) === "true";
      // In test mode, always accept 123456
      if (testMode && input.code === "123456") {
        otpStore.delete(input.phone);
        return { success: true };
      }
      const entry = otpStore.get(input.phone);
      if (!entry) {
        return { success: false, error: "No OTP found. Please request a new code." };
      }
      if (Date.now() > entry.expiresAt) {
        otpStore.delete(input.phone);
        return { success: false, error: "Code expired. Please request a new code." };
      }
      if (entry.code !== input.code) {
        return { success: false, error: "Incorrect code. Please try again." };
      }
      otpStore.delete(input.phone);
      return { success: true };
    }),
});

// ─── Subscription Router ────────────────────────────────────────────

const subscriptionRouter = router({
  /** Get the current business owner's subscription info (plan, usage, trial) */
  getMyPlan: publicProcedure
    .input(z.object({ businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      const info = await getBusinessSubscriptionInfo(input.businessOwnerId);
      return info ?? null;
    }),

  /** Get all publicly-visible plans (for plan selection screen) */
  getPublicPlans: publicProcedure
    .query(async () => {
      const plans = await getPublicPlans();
      return plans.map((p) => ({
        planKey: p.planKey,
        displayName: p.displayName,
        monthlyPrice: parseFloat(p.monthlyPrice as unknown as string),
        yearlyPrice: parseFloat(p.yearlyPrice as unknown as string),
        maxClients: p.maxClients,
        maxAppointments: p.maxAppointments,
        maxLocations: p.maxLocations,
        maxStaff: p.maxStaff,
        maxServices: p.maxServices,
        maxProducts: p.maxProducts,
        smsLevel: p.smsLevel,
        paymentLevel: p.paymentLevel,
        sortOrder: p.sortOrder,
      }));
    }),
});


// ─── Promo Codes Router ───────────────────────────────────────────────
const promoCodesRouter = router({
  list: publicProcedure
    .input(z.object({ businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      return db.getPromoCodesByOwner(input.businessOwnerId);
    }),

  create: publicProcedure
    .input(
      z.object({
        businessOwnerId: z.number(),
        localId: z.string(),
        code: z.string().min(1),
        label: z.string().min(1),
        percentage: z.number().min(0).max(100).default(0),
        flatAmount: z.string().nullable().optional(),
        maxUses: z.number().nullable().optional(),
        expiresAt: z.string().nullable().optional(),
        active: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const id = await db.createPromoCode(input);
      return { id, localId: input.localId };
    }),

  update: publicProcedure
    .input(
      z.object({
        localId: z.string(),
        businessOwnerId: z.number(),
        code: z.string().optional(),
        label: z.string().optional(),
        percentage: z.number().min(0).max(100).optional(),
        flatAmount: z.string().nullable().optional(),
        maxUses: z.number().nullable().optional(),
        expiresAt: z.string().nullable().optional(),
        active: z.boolean().optional(),
        usedCount: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { localId, businessOwnerId, ...data } = input;
      await db.updatePromoCode(localId, businessOwnerId, data);
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ localId: z.string(), businessOwnerId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deletePromoCode(input.localId, input.businessOwnerId);
      return { success: true };
    }),

  findByCode: publicProcedure
    .input(z.object({ code: z.string(), businessOwnerId: z.number() }))
    .query(async ({ input }) => {
      const promo = await db.getPromoCodeByCode(input.code.toUpperCase(), input.businessOwnerId);
      return promo ?? null;
    }),
});

// ─── Root Router ─────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  business: businessRouter,
  services: servicesRouter,
  clients: clientsRouter,
  appointments: appointmentsRouter,
  reviews: reviewsRouter,
  discounts: discountsRouter,
  giftCards: giftCardsRouter,
  customSchedule: customScheduleRouter,
  products: productsRouter,
  staff: staffRouter,
  locations: locationsRouter,
  twilio: twilioRouter,
  otp: otpRouter,
  subscription: subscriptionRouter,
  promoCodes: promoCodesRouter,
});

export type AppRouter = typeof appRouter;
