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
  /** Schedule mode: weekly (recurring hours) or custom (per-day control) */
  scheduleMode: mysqlEnum("scheduleMode", ["weekly", "custom"]).default("weekly").notNull(),
  /** Working hours JSON: Record<string, { enabled: boolean, start: string, end: string }> */
  workingHours: json("workingHours"),
  /** Cancellation policy JSON: { enabled, hoursBeforeAppointment, feePercentage } */
  cancellationPolicy: json("cancellationPolicy"),
  /** Buffer time between appointments in minutes (0 = no buffer) */
  bufferTime: int("bufferTime").default(0).notNull(),
  /** Slot interval in minutes (0 = auto, match service duration capped at 30) */
  slotInterval: int("slotInterval").default(0).notNull(),
  /** Custom booking slug (overrides auto-generated slug from business name) */
  customSlug: varchar("customSlug", { length: 100 }),
  /** Business Hours end date: ISO date string YYYY-MM-DD, null = open-ended */
  businessHoursEndDate: varchar("businessHoursEndDate", { length: 10 }),
  /** Expo push notification token for sending push notifications to owner's device */
  expoPushToken: varchar("expoPushToken", { length: 255 }),
  /** Auto-complete appointments: automatically mark as completed after end time + delay */
  autoCompleteEnabled: boolean("autoCompleteEnabled").default(false).notNull(),
  /** Minutes after appointment end time to auto-complete (5, 10, 15, 30) */
  autoCompleteDelayMinutes: int("autoCompleteDelayMinutes").default(5).notNull(),
  /** Notification preferences JSON: per-event push/email toggles */
  notificationPreferences: json("notificationPreferences"),
  /** SMS message templates JSON: per-event custom message bodies */
  smsTemplates: json("smsTemplates"),
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
  /** Service category for grouping */
  category: varchar("category", { length: 100 }),
  /** Location localIds this service is available at (JSON array, null = all) */
  locationIds: json("locationIds"),
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
  /** Total price charged for the appointment (after discounts/gifts) */
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }),
  /** Extra items JSON: array of { type, id, name, price, duration } */
  extraItems: json("extraItems"),
  /** Discount percentage applied (0-100) */
  discountPercent: int("discountPercent"),
  /** Discount dollar amount */
  discountAmount: decimal("discountAmount", { precision: 10, scale: 2 }),
  /** Name of the discount applied */
  discountName: varchar("discountName", { length: 255 }),
  /** Whether a gift card was applied */
  giftApplied: boolean("giftApplied").default(false),
  /** Dollar amount used from gift card */
  giftUsedAmount: decimal("giftUsedAmount", { precision: 10, scale: 2 }),
  /** Staff member localId assigned to this appointment */
  staffId: varchar("staffId", { length: 64 }),
  /** Location localId for multi-location businesses */
  locationId: varchar("locationId", { length: 64 }),
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
  /** Which days of week this discount applies (JSON array of day names) – legacy */
  daysOfWeek: json("daysOfWeek"),
  /** Specific dates this discount applies (JSON array of YYYY-MM-DD strings) */
  dates: json("dates"),
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
  /** Optional location-scoped override (null = global override for all locations) */
  locationId: varchar("locationId", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DbCustomSchedule = typeof customSchedule.$inferSelect;
export type InsertCustomSchedule = typeof customSchedule.$inferInsert;

// ─── Products ──────────────────────────────────────────────────────
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key to business_owners */
  businessOwnerId: int("businessOwnerId").notNull(),
  /** Local client-generated ID for backward compat */
  localId: varchar("localId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  /** Product brand for grouping */
  brand: varchar("brand", { length: 128 }),
  /** Whether the product is currently available */
  available: boolean("available").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DbProduct = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─── Waitlist ──────────────────────────────────────────────────────
export const waitlist = mysqlTable("waitlist", {
  id: int("id").autoincrement().primaryKey(),
  businessOwnerId: int("businessOwnerId").notNull(),
  /** Client name */
  clientName: varchar("clientName", { length: 255 }).notNull(),
  /** Client phone */
  clientPhone: varchar("clientPhone", { length: 20 }),
  /** Client email */
  clientEmail: varchar("clientEmail", { length: 320 }),
  /** Service localId the client wants */
  serviceLocalId: varchar("serviceLocalId", { length: 64 }).notNull(),
  /** Preferred date YYYY-MM-DD */
  preferredDate: varchar("preferredDate", { length: 10 }).notNull(),
  /** Status */
  status: mysqlEnum("status", ["waiting", "notified", "booked", "expired"]).default("waiting").notNull(),
  /** Notes from the client */
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DbWaitlist = typeof waitlist.$inferSelect;
export type InsertWaitlist = typeof waitlist.$inferInsert;

// ─── Data Deletion Requests ─────────────────────────────────────────
export const dataDeletionRequests = mysqlTable("data_deletion_requests", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  requestType: mysqlEnum("request_type", ["full", "client_data", "business_data"]).default("full").notNull(),
  reason: text("reason"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "rejected"]).default("pending").notNull(),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DbDataDeletionRequest = typeof dataDeletionRequests.$inferSelect;
export type InsertDataDeletionRequest = typeof dataDeletionRequests.$inferInsert;

// ─── Staff Members ─────────────────────────────────────────────────
export const staffMembers = mysqlTable("staff_members", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key to business_owners */
  businessOwnerId: int("businessOwnerId").notNull(),
  /** Local client-generated ID for backward compat */
  localId: varchar("localId", { length: 64 }).notNull(),
  /** Staff member name */
  name: varchar("name", { length: 255 }).notNull(),
  /** Staff member phone */
  phone: varchar("phone", { length: 20 }),
  /** Staff member email */
  email: varchar("email", { length: 320 }),
  /** Role/title (e.g. "Stylist", "Therapist", "Manager") */
  role: varchar("role", { length: 100 }),
  /** Profile color for calendar display */
  color: varchar("color", { length: 20 }),
  /** Service localIds this staff member can perform (JSON array) */
  serviceIds: json("serviceIds"),
  /** Location localIds this staff member is assigned to (JSON array, null = all) */
  locationIds: json("locationIds"),
  /** Individual working hours JSON: Record<string, { enabled: boolean, start: string, end: string }> */
  workingHours: json("workingHours"),
  /** Whether the staff member is currently active */
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DbStaffMember = typeof staffMembers.$inferSelect;
export type InsertStaffMember = typeof staffMembers.$inferInsert;

// ─── Locations (Multi-Location) ─────────────────────────────────────
export const locations = mysqlTable("locations", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key to business_owners */
  businessOwnerId: int("businessOwnerId").notNull(),
  /** Local client-generated ID for backward compat */
  localId: varchar("localId", { length: 64 }).notNull(),
  /** Location name (e.g. "Main Office", "Downtown Branch") */
  name: varchar("name", { length: 255 }).notNull(),
  /** Full address */
  address: text("address"),
  /** City */
  city: varchar("city", { length: 100 }),
  /** State/Province */
  state: varchar("state", { length: 100 }),
  /** ZIP / Postal code */
  zipCode: varchar("zipCode", { length: 20 }),
  /** Phone number for this location */
  phone: varchar("phone", { length: 20 }),
  /** Email for this location */
  email: varchar("email", { length: 320 }),
  /** Whether this is the default/primary location */
  isDefault: boolean("isDefault").default(false).notNull(),
  /** Whether this location is currently active */
  active: boolean("active").default(true).notNull(),
  /** Whether this location is temporarily paused for new bookings */
  temporarilyClosed: boolean("temporarilyClosed").default(false),
  /** ISO date YYYY-MM-DD: if set, location auto-reopens on this date */
  reopenOn: varchar("reopenOn", { length: 10 }),
  /** Individual working hours JSON: Record<string, { enabled: boolean, start: string, end: string }> */
  workingHours: json("workingHours"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DbLocation = typeof locations.$inferSelect;
export type InsertLocation = typeof locations.$inferInsert;
