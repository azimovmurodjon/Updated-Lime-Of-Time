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
        workingHours: z.any().optional(),
        cancellationPolicy: z.any().optional(),
        phone: z.string().optional(),
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
      })
    )
    .mutation(async ({ input }) => {
      const id = await db.createAppointment(input);
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
      })
    )
    .mutation(async ({ input }) => {
      const { localId, businessOwnerId, ...data } = input;
      await db.updateAppointment(localId, businessOwnerId, data);
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
});

export type AppRouter = typeof appRouter;
