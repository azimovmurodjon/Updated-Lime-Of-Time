import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  decimal,
  json,
} from "drizzle-orm/mysql-core";

// ─── Users (Auth) ────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Business Owners ─────────────────────────────────────────────────
export const businessOwners = mysqlTable("business_owners", {
  id: int("id").autoincrement().primaryKey(),
  /** Links to users table for auth - nullable for phone-only signup */
  userId: int("userId"),
  /** Phone number used during onboarding (unique identifier for non-OAuth) */
  phone: varchar("phone", { length: 20 }).notNull(),
  /** Business name */
  businessName: varchar("businessName", { length: 255 }).notNull(),
  /** Owner's personal name */
  ownerName: varchar("ownerName", { length: 255 }),
  /** Business email */
  email: varchar("email", { length: 320 }),
  /** Business address */
  address: text("address"),
  /** Business website */
  website: varchar("website", { length: 500 }),
  /** Business description */
  description: text("description"),
  /** Business logo URI (S3 or local) */
  businessLogoUri: text("businessLogoUri"),
  /** Default appointment duration in minutes */
  defaultDuration: int("defaultDuration").default(60).notNull(),
  /** Notifications enabled */
  notificationsEnabled: boolean("notificationsEnabled").default(true).notNull(),
  /** Theme mode preference */
  themeMode: mysqlEnum("themeMode", ["light", "dark", "system"]).default("system").notNull(),
  /** Temporary closed flag */
  temporaryClosed: boolean("temporaryClosed").default(false).notNull(),
  /** Working hours JSON: Record<string, { enabled: boolean, start: string, end: string }> */
  workingHours: json("workingHours"),
  /** Cancellation policy JSON: { enabled, hoursBeforeAppointment, feePercentage } */
  cancellationPolicy: json("cancellationPolicy"),
  /** Onboarding completed */
  onboardingComplete: boolean("onboardingComplete").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BusinessOwner = typeof businessOwners.$inferSelect;
export type InsertBusinessOwner = typeof businessOwners.$inferInsert;

// ─── Services ────────────────────────────────────────────────────────
export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key to business_owners */
  businessOwnerId: int("businessOwnerId").notNull(),
  /** Local client-generated ID for backward compat */
  localId: varchar("localId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  duration: int("duration").notNull(), // minutes
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  color: varchar("color", { length: 20 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DbService = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

// ─── Clients ─────────────────────────────────────────────────────────
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key to business_owners */
  businessOwnerId: int("businessOwnerId").notNull(),
  /** Local client-generated ID for backward compat */
  localId: varchar("localId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DbClient = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Appointments ────────────────────────────────────────────────────
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key to business_owners */
  businessOwnerId: int("businessOwnerId").notNull(),
  /** Local client-generated ID for backward compat */
  localId: varchar("localId", { length: 64 }).notNull(),
  /** References services.localId */
  serviceLocalId: varchar("serviceLocalId", { length: 64 }).notNull(),
  /** References clients.localId */
  clientLocalId: varchar("clientLocalId", { length: 64 }).notNull(),
  /** Date in YYYY-MM-DD format */
  date: varchar("date", { length: 10 }).notNull(),
  /** Time in HH:MM format */
  time: varchar("time", { length: 5 }).notNull(),
  /** Duration in minutes */
  duration: int("duration").notNull(),
  /** Appointment status */
  status: mysqlEnum("status", ["pending", "confirmed", "completed", "cancelled"])
    .default("pending")
    .notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DbAppointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

// ─── Reviews ─────────────────────────────────────────────────────────
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key to business_owners */
  businessOwnerId: int("businessOwnerId").notNull(),
  /** Local client-generated ID for backward compat */
  localId: varchar("localId", { length: 64 }).notNull(),
  /** References clients.localId */
  clientLocalId: varchar("clientLocalId", { length: 64 }).notNull(),
  /** References appointments.localId (optional) */
  appointmentLocalId: varchar("appointmentLocalId", { length: 64 }),
  /** Rating 1-5 */
  rating: int("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DbReview = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

// ─── Discounts ──────────────────────────────────────────────────────
export const discounts = mysqlTable("discounts", {
  id: int("id").autoincrement().primaryKey(),
  businessOwnerId: int("businessOwnerId").notNull(),
  localId: varchar("localId", { length: 64 }).notNull(),
  /** Name of the discount (e.g. "Happy Hour", "Early Bird") */
  name: varchar("name", { length: 255 }).notNull(),
  /** Percentage off (0-100) */
  percentage: int("percentage").notNull(),
  /** Start time HH:MM – discount applies during this window */
  startTime: varchar("startTime", { length: 5 }).notNull(),
  /** End time HH:MM */
  endTime: varchar("endTime", { length: 5 }).notNull(),
  /** Which days of week this discount applies (JSON array of day names) */
  daysOfWeek: json("daysOfWeek"),
  /** Optional: only for specific service localIds (JSON array), null = all services */
  serviceIds: json("serviceIds"),
  /** Whether the discount is currently active */
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DbDiscount = typeof discounts.$inferSelect;
export type InsertDiscount = typeof discounts.$inferInsert;

// ─── Gift Cards ─────────────────────────────────────────────────────
export const giftCards = mysqlTable("gift_cards", {
  id: int("id").autoincrement().primaryKey(),
  businessOwnerId: int("businessOwnerId").notNull(),
  localId: varchar("localId", { length: 64 }).notNull(),
  /** Unique redemption code */
  code: varchar("code", { length: 20 }).notNull(),
  /** Service localId this gift card is for */
  serviceLocalId: varchar("serviceLocalId", { length: 64 }).notNull(),
  /** Recipient name */
  recipientName: varchar("recipientName", { length: 255 }),
  /** Recipient phone */
  recipientPhone: varchar("recipientPhone", { length: 20 }),
  /** Personal message */
  message: text("message"),
  /** Whether the gift card has been redeemed */
  redeemed: boolean("redeemed").default(false).notNull(),
  /** When it was redeemed */
  redeemedAt: timestamp("redeemedAt"),
  /** Expiry date YYYY-MM-DD */
  expiresAt: varchar("expiresAt", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DbGiftCard = typeof giftCards.$inferSelect;
export type InsertGiftCard = typeof giftCards.$inferInsert;

// ─── Custom Schedule (per-date overrides) ───────────────────────────
export const customSchedule = mysqlTable("custom_schedule", {
  id: int("id").autoincrement().primaryKey(),
  businessOwnerId: int("businessOwnerId").notNull(),
  /** Date in YYYY-MM-DD format */
  date: varchar("date", { length: 10 }).notNull(),
  /** Whether the business is open on this date */
  isOpen: boolean("isOpen").default(true).notNull(),
  /** Custom start time HH:MM (overrides weekly hours) */
  startTime: varchar("startTime", { length: 5 }),
  /** Custom end time HH:MM */
  endTime: varchar("endTime", { length: 5 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DbCustomSchedule = typeof customSchedule.$inferSelect;
export type InsertCustomSchedule = typeof customSchedule.$inferInsert;
