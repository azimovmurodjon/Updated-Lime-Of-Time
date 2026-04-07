import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  businessOwners,
  InsertBusinessOwner,
  BusinessOwner,
  services,
  InsertService,
  clients,
  InsertClient,
  appointments,
  InsertAppointment,
  reviews,
  InsertReview,
  discounts,
  InsertDiscount,
  giftCards,
  InsertGiftCard,
  customSchedule,
  InsertCustomSchedule,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Business Owners ─────────────────────────────────────────────────

export async function getBusinessOwnerByPhone(phone: string): Promise<BusinessOwner | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(businessOwners)
    .where(eq(businessOwners.phone, phone))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getBusinessOwnerById(id: number): Promise<BusinessOwner | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(businessOwners)
    .where(eq(businessOwners.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBusinessOwner(data: InsertBusinessOwner): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(businessOwners).values(data);
  return result.insertId;
}

export async function updateBusinessOwner(
  id: number,
  data: Partial<InsertBusinessOwner>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(businessOwners).set(data).where(eq(businessOwners.id, id));
}

export async function deleteBusinessOwner(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete all related data first
  await db.delete(reviews).where(eq(reviews.businessOwnerId, id));
  await db.delete(appointments).where(eq(appointments.businessOwnerId, id));
  await db.delete(clients).where(eq(clients.businessOwnerId, id));
  await db.delete(services).where(eq(services.businessOwnerId, id));
  await db.delete(discounts).where(eq(discounts.businessOwnerId, id));
  await db.delete(giftCards).where(eq(giftCards.businessOwnerId, id));
  await db.delete(customSchedule).where(eq(customSchedule.businessOwnerId, id));
  await db.delete(businessOwners).where(eq(businessOwners.id, id));
}

export async function getBusinessOwnerBySlug(slug: string): Promise<BusinessOwner | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  // Get all business owners and match by slug (business name lowercased, spaces to hyphens)
  const result = await db.select().from(businessOwners);
  return result.find((owner) => {
    const ownerSlug = owner.businessName.toLowerCase().replace(/\s+/g, "-");
    return ownerSlug === slug.toLowerCase();
  });
}

// ─── Services ────────────────────────────────────────────────────────

export async function getServicesByOwner(businessOwnerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(services).where(eq(services.businessOwnerId, businessOwnerId));
}

export async function createService(data: InsertService): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(services).values(data);
  return result.insertId;
}

export async function updateService(
  id: number,
  businessOwnerId: number,
  data: Partial<InsertService>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(services)
    .set(data)
    .where(and(eq(services.id, id), eq(services.businessOwnerId, businessOwnerId)));
}

export async function deleteService(localId: string, businessOwnerId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(services)
    .where(and(eq(services.localId, localId), eq(services.businessOwnerId, businessOwnerId)));
}

export async function getServiceByLocalId(localId: string, businessOwnerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(services)
    .where(and(eq(services.localId, localId), eq(services.businessOwnerId, businessOwnerId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Clients ─────────────────────────────────────────────────────────

export async function getClientsByOwner(businessOwnerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients).where(eq(clients.businessOwnerId, businessOwnerId));
}

export async function createClient(data: InsertClient): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(clients).values(data);
  return result.insertId;
}

export async function updateClient(
  localId: string,
  businessOwnerId: number,
  data: Partial<InsertClient>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(clients)
    .set(data)
    .where(and(eq(clients.localId, localId), eq(clients.businessOwnerId, businessOwnerId)));
}

export async function deleteClient(localId: string, businessOwnerId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related reviews and appointments first
  await db
    .delete(reviews)
    .where(
      and(eq(reviews.clientLocalId, localId), eq(reviews.businessOwnerId, businessOwnerId))
    );
  await db
    .delete(appointments)
    .where(
      and(
        eq(appointments.clientLocalId, localId),
        eq(appointments.businessOwnerId, businessOwnerId)
      )
    );
  await db
    .delete(clients)
    .where(and(eq(clients.localId, localId), eq(clients.businessOwnerId, businessOwnerId)));
}

export async function getClientByPhone(phone: string, businessOwnerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(clients)
    .where(and(eq(clients.phone, phone), eq(clients.businessOwnerId, businessOwnerId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Appointments ────────────────────────────────────────────────────

export async function getAppointmentsByOwner(businessOwnerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(appointments)
    .where(eq(appointments.businessOwnerId, businessOwnerId));
}

export async function createAppointment(data: InsertAppointment): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(appointments).values(data);
  return result.insertId;
}

export async function updateAppointment(
  localId: string,
  businessOwnerId: number,
  data: Partial<InsertAppointment>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(appointments)
    .set(data)
    .where(
      and(
        eq(appointments.localId, localId),
        eq(appointments.businessOwnerId, businessOwnerId)
      )
    );
}

export async function deleteAppointment(
  localId: string,
  businessOwnerId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(appointments)
    .where(
      and(
        eq(appointments.localId, localId),
        eq(appointments.businessOwnerId, businessOwnerId)
      )
    );
}

// ─── Reviews ─────────────────────────────────────────────────────────

export async function getReviewsByOwner(businessOwnerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews).where(eq(reviews.businessOwnerId, businessOwnerId));
}

export async function createReview(data: InsertReview): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(reviews).values(data);
  return result.insertId;
}

export async function deleteReview(
  localId: string,
  businessOwnerId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(reviews)
    .where(
      and(eq(reviews.localId, localId), eq(reviews.businessOwnerId, businessOwnerId))
    );
}

// ─── Discounts ──────────────────────────────────────────────────────

export async function getDiscountsByOwner(businessOwnerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(discounts).where(eq(discounts.businessOwnerId, businessOwnerId));
}

export async function createDiscount(data: InsertDiscount): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(discounts).values(data);
  return result.insertId;
}

export async function updateDiscount(
  localId: string,
  businessOwnerId: number,
  data: Partial<InsertDiscount>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(discounts)
    .set(data)
    .where(and(eq(discounts.localId, localId), eq(discounts.businessOwnerId, businessOwnerId)));
}

export async function deleteDiscount(localId: string, businessOwnerId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(discounts)
    .where(and(eq(discounts.localId, localId), eq(discounts.businessOwnerId, businessOwnerId)));
}

// ─── Gift Cards ─────────────────────────────────────────────────────

export async function getGiftCardsByOwner(businessOwnerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(giftCards).where(eq(giftCards.businessOwnerId, businessOwnerId));
}

export async function createGiftCard(data: InsertGiftCard): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(giftCards).values(data);
  return result.insertId;
}

export async function updateGiftCard(
  localId: string,
  businessOwnerId: number,
  data: Partial<InsertGiftCard>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(giftCards)
    .set(data)
    .where(and(eq(giftCards.localId, localId), eq(giftCards.businessOwnerId, businessOwnerId)));
}

export async function deleteGiftCard(localId: string, businessOwnerId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(giftCards)
    .where(and(eq(giftCards.localId, localId), eq(giftCards.businessOwnerId, businessOwnerId)));
}

export async function getGiftCardByCode(code: string, businessOwnerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(giftCards)
    .where(and(eq(giftCards.code, code), eq(giftCards.businessOwnerId, businessOwnerId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Custom Schedule ────────────────────────────────────────────────

export async function getCustomScheduleByOwner(businessOwnerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customSchedule).where(eq(customSchedule.businessOwnerId, businessOwnerId));
}

export async function upsertCustomScheduleDay(
  businessOwnerId: number,
  date: string,
  isOpen: boolean,
  startTime?: string,
  endTime?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check if entry exists
  const existing = await db
    .select()
    .from(customSchedule)
    .where(and(eq(customSchedule.businessOwnerId, businessOwnerId), eq(customSchedule.date, date)))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(customSchedule)
      .set({ isOpen, startTime: startTime ?? null, endTime: endTime ?? null })
      .where(and(eq(customSchedule.businessOwnerId, businessOwnerId), eq(customSchedule.date, date)));
  } else {
    await db.insert(customSchedule).values({
      businessOwnerId,
      date,
      isOpen,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
    });
  }
}

export async function deleteCustomScheduleDay(
  businessOwnerId: number,
  date: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(customSchedule)
    .where(and(eq(customSchedule.businessOwnerId, businessOwnerId), eq(customSchedule.date, date)));
}

// ─── Bootstrap: Load all data for a business owner ───────────────────

export async function getFullBusinessData(businessOwnerId: number) {
  const [owner, svcList, clientList, apptList, reviewList, discountList, giftCardList, scheduleList] = await Promise.all([
    getBusinessOwnerById(businessOwnerId),
    getServicesByOwner(businessOwnerId),
    getClientsByOwner(businessOwnerId),
    getAppointmentsByOwner(businessOwnerId),
    getReviewsByOwner(businessOwnerId),
    getDiscountsByOwner(businessOwnerId),
    getGiftCardsByOwner(businessOwnerId),
    getCustomScheduleByOwner(businessOwnerId),
  ]);
  return {
    owner,
    services: svcList,
    clients: clientList,
    appointments: apptList,
    reviews: reviewList,
    discounts: discountList,
    giftCards: giftCardList,
    customSchedule: scheduleList,
  };
}
