import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

// ─── Business Owner Router ───────────────────────────────────────────

const businessRouter = router({
  /** Check if a business owner exists by phone number */
  checkByPhone: publicProcedure
    .input(z.object({ phone: z.string().min(1) }))
    .query(async ({ input }) => {
      const owner = await db.getBusinessOwnerByPhone(input.phone);
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
      const id = await db.createBusinessOwner({
        phone: input.phone,
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
        customSlug: z.string().optional(),
        businessHoursEndDate: z.string().nullable().optional(),
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
        dbId: z.number(),
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
      const { dbId, businessOwnerId, ...data } = input;
      await db.updateService(dbId, businessOwnerId, data);
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
      })
    )
    .mutation(async ({ input }) => {
      const { localId, businessOwnerId, ...data } = input;
      const dbData: any = { ...data };
      if (data.totalPrice != null) dbData.totalPrice = String(data.totalPrice);
      if (data.discountAmount != null) dbData.discountAmount = String(data.discountAmount);
      if (data.giftUsedAmount != null) dbData.giftUsedAmount = String(data.giftUsedAmount);
      await db.updateAppointment(localId, businessOwnerId, dbData);
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
});

export type AppRouter = typeof appRouter;
