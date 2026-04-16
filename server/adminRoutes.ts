import { Express, Request, Response, NextFunction } from "express";
import * as db from "./db";
import { getDb } from "./db";
import {
  businessOwners,
  services,
  clients,
  appointments,
  reviews,
  discounts,
  giftCards,
  customSchedule,
  products,
  users,
  staffMembers,
  locations,
  subscriptionPlans,
  platformConfig,
} from "../drizzle/schema";
import { sql, eq } from "drizzle-orm";
import { ADMIN_LOGO_BASE64 } from "./admin-logo-data";
import { invalidatePlanCache } from "./subscription";

// ─── Admin Auth ─────────────────────────────────────────────────────
const ADMIN_USER = process.env.ADMIN_USERNAME || "Admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "Admin123$";
const SESSION_SECRET = process.env.JWT_SECRET || "admin-session-secret";

// Simple session store (in-memory, resets on server restart)
const sessions = new Map<string, { user: string; expiresAt: number }>();

function generateSessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getSessionFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/admin_session=([^;]+)/);
  return match ? match[1] : null;
}

function isAuthenticated(req: Request): boolean {
  const sessionId = getSessionFromCookie(req);
  if (!sessionId) return false;
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return false;
  }
  return true;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isAuthenticated(req)) {
    next();
  } else {
    res.redirect("/api/admin/login");
  }
}

// ─── Helper: format currency ────────────────────────────────────────
function fmtCurrency(val: number): string {
  return "$" + val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "N/A";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Register Admin Routes ──────────────────────────────────────────
export function registerAdminRoutes(app: Express): void {
  // Login page
  app.get("/api/admin/login", (_req: Request, res: Response) => {
    res.send(loginPage());
  });

  // Login POST
  app.post("/api/admin/login", (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      const sessionId = generateSessionId();
      sessions.set(sessionId, {
        user: username,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });
      res.setHeader(
        "Set-Cookie",
        `admin_session=${sessionId}; Path=/api/admin; HttpOnly; SameSite=Lax; Max-Age=86400`
      );
      res.redirect("/api/admin");
    } else {
      res.send(loginPage("Invalid username or password"));
    }
  });

  // Logout
  app.get("/api/admin/logout", (_req: Request, res: Response) => {
    const sessionId = getSessionFromCookie(_req);
    if (sessionId) sessions.delete(sessionId);
    res.setHeader(
      "Set-Cookie",
      `admin_session=; Path=/api/admin; HttpOnly; SameSite=Lax; Max-Age=0`
    );
    res.redirect("/api/admin/login");
  });

  // ── Dashboard Overview ────────────────────────────────────────────
  app.get("/api/admin", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) {
        res.status(500).send(errorPage("Database not available"));
        return;
      }

      const [allOwners] = await dbase.select({ count: sql<number>`COUNT(*)` }).from(businessOwners);
      const [allClients] = await dbase.select({ count: sql<number>`COUNT(*)` }).from(clients);
      const [allAppts] = await dbase.select({ count: sql<number>`COUNT(*)` }).from(appointments);
      const [allServices] = await dbase.select({ count: sql<number>`COUNT(*)` }).from(services);
      const [allReviews] = await dbase.select({ count: sql<number>`COUNT(*)` }).from(reviews);
      const [allGiftCards] = await dbase.select({ count: sql<number>`COUNT(*)` }).from(giftCards);
      const [allDiscounts] = await dbase.select({ count: sql<number>`COUNT(*)` }).from(discounts);
      const [allProducts] = await dbase.select({ count: sql<number>`COUNT(*)` }).from(products);
      const [allStaff] = await dbase.select({ count: sql<number>`COUNT(*)` }).from(staffMembers);
      const [allUsers] = await dbase.select({ count: sql<number>`COUNT(*)` }).from(users);
      const [allLocations] = await dbase.select({ count: sql<number>`COUNT(*)` }).from(locations);

      // Recent businesses
      const recentBusinesses = await dbase
        .select()
        .from(businessOwners)
        .orderBy(sql`${businessOwners.createdAt} DESC`)
        .limit(5);

      // Recent appointments
      const recentAppts = await dbase
        .select()
        .from(appointments)
        .orderBy(sql`${appointments.createdAt} DESC`)
        .limit(10);

      res.send(
        dashboardPage({
          totalBusinesses: allOwners.count,
          totalClients: allClients.count,
          totalAppointments: allAppts.count,
          totalServices: allServices.count,
          totalReviews: allReviews.count,
          totalGiftCards: allGiftCards.count,
          totalDiscounts: allDiscounts.count,
          totalProducts: allProducts.count,
          totalStaff: allStaff.count,
          totalUsers: allUsers.count,
          totalLocations: allLocations.count,
          recentBusinesses,
          recentAppts,
        })
      );
    } catch (err) {
      console.error("[Admin] Dashboard error:", err);
      res.status(500).send(errorPage("Failed to load dashboard"));
    }
  });

  // ── Businesses List ───────────────────────────────────────────────
  app.get("/api/admin/businesses", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const allBiz = await dbase.select().from(businessOwners).orderBy(sql`${businessOwners.createdAt} DESC`);
      res.send(businessesPage(allBiz));
    } catch (err) {
      console.error("[Admin] Businesses error:", err);
      res.status(500).send(errorPage("Failed to load businesses"));
    }
  });

  // ── Business Detail ───────────────────────────────────────────────
  app.get("/api/admin/businesses/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const fullData = await db.getFullBusinessData(id);
      if (!fullData.owner) { res.status(404).send(errorPage("Business not found")); return; }
      res.send(businessDetailPage(fullData));
    } catch (err) {
      console.error("[Admin] Business detail error:", err);
      res.status(500).send(errorPage("Failed to load business"));
    }
  });

  // ── Delete Business ───────────────────────────────────────────────
  app.post("/api/admin/businesses/:id/delete", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await db.deleteBusinessOwner(id);
      res.redirect("/api/admin/businesses");
    } catch (err) {
      console.error("[Admin] Delete business error:", err);
      res.status(500).send(errorPage("Failed to delete business"));
    }
  });

  // ── All Clients ───────────────────────────────────────────────────
  app.get("/api/admin/clients", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const allCli = await dbase.select().from(clients).orderBy(sql`${clients.createdAt} DESC`);
      const allBiz = await dbase.select().from(businessOwners);
      res.send(clientsPage(allCli, allBiz));
    } catch (err) {
      console.error("[Admin] Clients error:", err);
      res.status(500).send(errorPage("Failed to load clients"));
    }
  });

  // ── All Appointments ──────────────────────────────────────────────
  app.get("/api/admin/appointments", requireAuth, async (req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const statusFilter = (req.query.status as string) || "";
      let allAppts = await dbase.select().from(appointments).orderBy(sql`${appointments.date} DESC, ${appointments.time} DESC`);
      if (statusFilter) {
        allAppts = allAppts.filter((a) => a.status === statusFilter);
      }
      const allBiz = await dbase.select().from(businessOwners);
      const allCli = await dbase.select().from(clients);
      const allSvc = await dbase.select().from(services);
      res.send(appointmentsPage(allAppts, allBiz, allCli, allSvc, statusFilter));
    } catch (err) {
      console.error("[Admin] Appointments error:", err);
      res.status(500).send(errorPage("Failed to load appointments"));
    }
  });

  // ── DB Explorer ───────────────────────────────────────────────────
  app.get("/api/admin/db", requireAuth, async (req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const table = (req.query.table as string) || "business_owners";
      const page = parseInt((req.query.page as string) || "1");
      const limit = 50;
      const offset = (page - 1) * limit;

      const tableMap: Record<string, any> = {
        business_owners: businessOwners,
        services,
        clients,
        appointments,
        reviews,
        discounts,
        gift_cards: giftCards,
        custom_schedule: customSchedule,
        products,
        staff_members: staffMembers,
        users,
        locations,
      };

      const selectedTable = tableMap[table];
      if (!selectedTable) { res.status(400).send(errorPage("Invalid table")); return; }

      const rows = await dbase.select().from(selectedTable).limit(limit).offset(offset);
      const [countResult] = await dbase.select({ count: sql<number>`COUNT(*)` }).from(selectedTable);
      const totalRows = countResult.count;
      const totalPages = Math.ceil(totalRows / limit);

      res.send(dbExplorerPage(table, rows, page, totalPages, totalRows, Object.keys(tableMap)));
    } catch (err) {
      console.error("[Admin] DB Explorer error:", err);
      res.status(500).send(errorPage("Failed to load DB explorer"));
    }
  });

  // ── Analytics ─────────────────────────────────────────────────────
  app.get("/api/admin/analytics", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }

      // All queries use simple aggregation to avoid GROUP BY strict mode issues
      // Fetch all appointments and compute analytics in JS
      const allAppts = await dbase.select().from(appointments);
      const allBiz = await dbase.select().from(businessOwners);
      const allReviews = await dbase.select().from(reviews);

      // Appointments by status
      const statusMap: Record<string, number> = {};
      allAppts.forEach((a) => { statusMap[a.status] = (statusMap[a.status] || 0) + 1; });
      const apptsByStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

      // Appointments by month (last 12 months)
      const apptMonthMap: Record<string, number> = {};
      allAppts.forEach((a) => {
        if (a.createdAt) {
          const d = new Date(a.createdAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          apptMonthMap[key] = (apptMonthMap[key] || 0) + 1;
        }
      });
      const apptsByMonth = Object.entries(apptMonthMap)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);

      // Business growth by month
      const bizMonthMap: Record<string, number> = {};
      allBiz.forEach((b) => {
        if (b.createdAt) {
          const d = new Date(b.createdAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          bizMonthMap[key] = (bizMonthMap[key] || 0) + 1;
        }
      });
      const bizByMonth = Object.entries(bizMonthMap)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);

      // Average rating
      const avgRating = allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;

      // Top services by appointment count
      const svcMap: Record<string, number> = {};
      allAppts.forEach((a) => { svcMap[a.serviceLocalId] = (svcMap[a.serviceLocalId] || 0) + 1; });
      const topServices = Object.entries(svcMap)
        .map(([serviceLocalId, count]) => ({ serviceLocalId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      res.send(
        analyticsPage({
          apptsByStatus,
          apptsByMonth,
          bizByMonth,
          avgRating,
          topServices,
        })
      );
    } catch (err) {
      console.error("[Admin] Analytics error:", err);
      res.status(500).send(errorPage("Failed to load analytics"));
    }
  });

  // ── Staff Management ──────────────────────────────────────────────
  app.get("/api/admin/staff", requireAuth, async (req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const allStaff = await dbase.select().from(staffMembers);
      const allBiz = await dbase.select().from(businessOwners);
      const allSvc = await dbase.select().from(services);
      res.send(staffPage(allStaff, allBiz, allSvc));
    } catch (err) {
      console.error("[Admin] Staff error:", err);
      res.status(500).send(errorPage("Failed to load staff"));
    }
  });

  // ── Settings ──────────────────────────────────────────────────────
  app.get("/api/admin/settings", requireAuth, (_req: Request, res: Response) => {
    res.send(settingsPage());
  });

  // ── Individual Delete Routes ─────────────────────────────────────
  app.post("/api/admin/delete/client/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await db.deleteClientById(parseInt(req.params.id));
      res.redirect(req.headers.referer || "/api/admin/clients");
    } catch (err) {
      console.error("[Admin] Delete client error:", err);
      res.status(500).send(errorPage("Failed to delete client"));
    }
  });

  app.post("/api/admin/delete/appointment/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await db.deleteAppointmentById(parseInt(req.params.id));
      res.redirect(req.headers.referer || "/api/admin/appointments");
    } catch (err) {
      console.error("[Admin] Delete appointment error:", err);
      res.status(500).send(errorPage("Failed to delete appointment"));
    }
  });

  app.post("/api/admin/delete/service/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await db.deleteServiceById(parseInt(req.params.id));
      res.redirect(req.headers.referer || "/api/admin/businesses");
    } catch (err) {
      console.error("[Admin] Delete service error:", err);
      res.status(500).send(errorPage("Failed to delete service"));
    }
  });

  app.post("/api/admin/delete/staff/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await db.deleteStaffMemberById(parseInt(req.params.id));
      res.redirect(req.headers.referer || "/api/admin/staff");
    } catch (err) {
      console.error("[Admin] Delete staff error:", err);
      res.status(500).send(errorPage("Failed to delete staff member"));
    }
  });

  app.post("/api/admin/delete/location/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await db.deleteLocationById(parseInt(req.params.id));
      res.redirect(req.headers.referer || "/api/admin/businesses");
    } catch (err) {
      console.error("[Admin] Delete location error:", err);
      res.status(500).send(errorPage("Failed to delete location"));
    }
  });

  app.post("/api/admin/delete/discount/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await db.deleteDiscountById(parseInt(req.params.id));
      res.redirect(req.headers.referer || "/api/admin/discounts");
    } catch (err) {
      console.error("[Admin] Delete discount error:", err);
      res.status(500).send(errorPage("Failed to delete discount"));
    }
  });

  app.post("/api/admin/delete/giftcard/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await db.deleteGiftCardById(parseInt(req.params.id));
      res.redirect(req.headers.referer || "/api/admin/giftcards");
    } catch (err) {
      console.error("[Admin] Delete gift card error:", err);
      res.status(500).send(errorPage("Failed to delete gift card"));
    }
  });

  app.post("/api/admin/delete/review/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await db.deleteReviewById(parseInt(req.params.id));
      res.redirect(req.headers.referer || "/api/admin/reviews");
    } catch (err) {
      console.error("[Admin] Delete review error:", err);
      res.status(500).send(errorPage("Failed to delete review"));
    }
  });

  app.post("/api/admin/delete/product/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await db.deleteProductById(parseInt(req.params.id));
      res.redirect(req.headers.referer || "/api/admin/products");
    } catch (err) {
      console.error("[Admin] Delete product error:", err);
      res.status(500).send(errorPage("Failed to delete product"));
    }
  });

  // ── Discounts Page ────────────────────────────────────────────────
  app.get("/api/admin/discounts", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const allDisc = await dbase.select().from(discounts);
      const allBiz = await dbase.select().from(businessOwners);
      res.send(discountsPage(allDisc, allBiz));
    } catch (err) {
      console.error("[Admin] Discounts error:", err);
      res.status(500).send(errorPage("Failed to load discounts"));
    }
  });

  // ── Gift Cards Page ───────────────────────────────────────────────
  app.get("/api/admin/giftcards", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const allGC = await dbase.select().from(giftCards);
      const allBiz = await dbase.select().from(businessOwners);
      res.send(giftCardsPage(allGC, allBiz));
    } catch (err) {
      console.error("[Admin] Gift cards error:", err);
      res.status(500).send(errorPage("Failed to load gift cards"));
    }
  });

  // ── Reviews Page ──────────────────────────────────────────────────
  app.get("/api/admin/reviews", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const allRev = await dbase.select().from(reviews);
      const allBiz = await dbase.select().from(businessOwners);
      res.send(reviewsPage(allRev, allBiz));
    } catch (err) {
      console.error("[Admin] Reviews error:", err);
      res.status(500).send(errorPage("Failed to load reviews"));
    }
  });

  // ── Products Page ─────────────────────────────────────────────────
  app.get("/api/admin/products", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const allProd = await dbase.select().from(products);
      const allBiz = await dbase.select().from(businessOwners);
      res.send(productsPage(allProd, allBiz));
    } catch (err) {
      console.error("[Admin] Products error:", err);
      res.status(500).send(errorPage("Failed to load products"));
    }
  });

  // ── Locations Page ────────────────────────────────────────────────
  app.get("/api/admin/locations", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const allLoc = await dbase.select().from(locations);
      const allBiz = await dbase.select().from(businessOwners);
      res.send(locationsPage(allLoc, allBiz));
    } catch (err) {
      console.error("[Admin] Locations error:", err);
      res.status(500).send(errorPage("Failed to load locations"));
    }
  });

  // ── Subscriptions Page ────────────────────────────────────────────
  app.get("/api/admin/subscriptions", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const allBiz = await dbase.select().from(businessOwners).orderBy(sql`${businessOwners.createdAt} DESC`);
      const plans = await dbase.select().from(subscriptionPlans).orderBy(sql`${subscriptionPlans.sortOrder} ASC`);
      res.send(subscriptionsPage(allBiz, plans));
    } catch (err) {
      console.error("[Admin] Subscriptions error:", err);
      res.status(500).send(errorPage("Failed to load subscriptions"));
    }
  });

  // ── Plan Pricing Page ─────────────────────────────────────────────
  app.get("/api/admin/plans", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const plans = await dbase.select().from(subscriptionPlans).orderBy(sql`${subscriptionPlans.sortOrder} ASC`);
      res.send(plansPage(plans));
    } catch (err) {
      console.error("[Admin] Plans error:", err);
      res.status(500).send(errorPage("Failed to load plans"));
    }
  });

  // ── Update Plan ───────────────────────────────────────────────────
  app.post("/api/admin/plans/:id/update", requireAuth, async (req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const id = parseInt(req.params.id);
      const { monthlyPrice, yearlyPrice, isPublic, maxClients, maxAppointments,
              maxLocations, maxStaff, maxServices, maxProducts, smsLevel, paymentLevel } = req.body;
      await dbase.update(subscriptionPlans).set({
        monthlyPrice: (parseFloat(monthlyPrice) || 0).toString(),
        yearlyPrice: (parseFloat(yearlyPrice) || 0).toString(),
        isPublic: isPublic === "on" || isPublic === "true" || isPublic === "1",
        maxClients: parseInt(maxClients) || -1,
        maxAppointments: parseInt(maxAppointments) || -1,
        maxLocations: parseInt(maxLocations) || 1,
        maxStaff: parseInt(maxStaff) || 1,
        maxServices: parseInt(maxServices) || -1,
        maxProducts: parseInt(maxProducts) || -1,
        smsLevel: (smsLevel || "none") as "none" | "confirmations" | "full",
        paymentLevel: (paymentLevel || "basic") as "basic" | "full",
        updatedAt: new Date(),
      }).where(eq(subscriptionPlans.id, id));
      invalidatePlanCache();
      res.redirect("/api/admin/plans?saved=1");
    } catch (err) {
      console.error("[Admin] Update plan error:", err);
      res.status(500).send(errorPage("Failed to update plan"));
    }
  });

  // ── Business Override ─────────────────────────────────────────────
  app.post("/api/admin/businesses/:id/override", requireAuth, async (req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const id = parseInt(req.params.id);
      const { adminOverride, overridePlan } = req.body;
      const isOverride = adminOverride === "on" || adminOverride === "true" || adminOverride === "1";
      await dbase.update(businessOwners).set({
        adminOverride: isOverride,
        subscriptionPlan: isOverride ? (overridePlan || "unlimited") : (overridePlan || "free"),
        updatedAt: new Date(),
      } as any).where(eq(businessOwners.id, id));
      res.redirect(`/api/admin/businesses/${id}?saved=1`);
    } catch (err) {
      console.error("[Admin] Override error:", err);
      res.status(500).send(errorPage("Failed to update override"));
    }
  });

  // ── Platform Config (Twilio / Stripe) ─────────────────────────────
  app.get("/api/admin/platform-config", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const configs = await dbase.select().from(platformConfig);
      const cfgMap: Record<string, string> = {};
      configs.forEach((c: any) => { cfgMap[c.key] = c.value || ""; });
      res.send(platformConfigPage(cfgMap));
    } catch (err) {
      console.error("[Admin] Platform config error:", err);
      res.status(500).send(errorPage("Failed to load platform config"));
    }
  });

  app.post("/api/admin/platform-config", requireAuth, async (req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const keyDefs: Array<{ key: string; sensitive: boolean; desc: string }> = [
        { key: "twilio_account_sid", sensitive: true, desc: "Twilio Account SID" },
        { key: "twilio_auth_token", sensitive: true, desc: "Twilio Auth Token" },
        { key: "twilio_from_number", sensitive: false, desc: "Twilio From Phone Number" },
        { key: "twilio_test_mode", sensitive: false, desc: "Twilio Test Mode (true/false)" },
        { key: "twilio_test_otp", sensitive: false, desc: "Test OTP code (default: 123456)" },
        { key: "stripe_secret_key", sensitive: true, desc: "Stripe Secret Key" },
        { key: "stripe_publishable_key", sensitive: false, desc: "Stripe Publishable Key" },
        { key: "stripe_webhook_secret", sensitive: true, desc: "Stripe Webhook Secret" },
        { key: "stripe_test_mode", sensitive: false, desc: "Stripe Test Mode (true/false)" },
      ];
      for (const def of keyDefs) {
        const value = (req.body[def.key] || "").toString().trim();
        // Check if exists
        const existing = await dbase.select().from(platformConfig).where(eq(platformConfig.configKey, def.key)).limit(1);
        if (existing.length > 0) {
          await dbase.update(platformConfig).set({ configValue: value, updatedAt: new Date() }).where(eq(platformConfig.configKey, def.key));
        } else {
          await dbase.insert(platformConfig).values({ configKey: def.key, configValue: value, isSensitive: def.sensitive, description: def.desc });
        }
      }
      invalidatePlanCache();
      res.redirect("/api/admin/platform-config?saved=1");
    } catch (err) {
      console.error("[Admin] Platform config save error:", err);
      res.status(500).send(errorPage("Failed to save platform config"));
    }
  });
}

// ─── HTML Templates ─────────────────────────────────────────────────

function adminStyles(): string {
  return `
    <style>
      :root {
        --bg: #0f1117;
        --bg-card: #1a1d27;
        --bg-hover: #242736;
        --border: #2a2d3a;
        --text: #e4e6eb;
        --text-muted: #8b8fa3;
        --primary: #4a8c3f;
        --primary-hover: #5aa34d;
        --danger: #ef4444;
        --warning: #f59e0b;
        --success: #22c55e;
        --info: #3b82f6;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
      a { color: var(--primary); text-decoration: none; }
      a:hover { color: var(--primary-hover); text-decoration: underline; }

      .layout { display: flex; min-height: 100vh; }
      .sidebar { width: 240px; background: var(--bg-card); border-right: 1px solid var(--border); padding: 20px 0; position: fixed; top: 0; left: 0; bottom: 0; overflow-y: auto; z-index: 10; }
      .sidebar-logo { padding: 0 20px 20px; border-bottom: 1px solid var(--border); margin-bottom: 8px; }
      .sidebar-logo h1 { font-size: 18px; color: var(--primary); }
      .sidebar-logo p { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
      .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 20px; color: var(--text-muted); font-size: 14px; transition: all 0.15s; cursor: pointer; }
      .nav-item:hover { background: var(--bg-hover); color: var(--text); text-decoration: none; }
      .nav-item.active { background: var(--bg-hover); color: var(--primary); border-right: 3px solid var(--primary); }
      .nav-icon { width: 20px; text-align: center; }

      .main { flex: 1; margin-left: 240px; padding: 24px 32px; }
      .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
      .page-header h2 { font-size: 24px; font-weight: 700; }
      .breadcrumb { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }
      .breadcrumb a { color: var(--text-muted); }
      .breadcrumb a:hover { color: var(--primary); }

      .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
      .stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
      .stat-card .stat-label { font-size: 13px; color: var(--text-muted); margin-bottom: 8px; }
      .stat-card .stat-value { font-size: 28px; font-weight: 700; }
      .stat-card .stat-icon { font-size: 24px; margin-bottom: 8px; }

      .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
      .card h3 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }

      table { width: 100%; border-collapse: collapse; }
      th { text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); }
      td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid var(--border); }
      tr:hover td { background: var(--bg-hover); }

      .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
      .badge-success { background: rgba(34,197,94,0.15); color: var(--success); }
      .badge-warning { background: rgba(245,158,11,0.15); color: var(--warning); }
      .badge-danger { background: rgba(239,68,68,0.15); color: var(--danger); }
      .badge-info { background: rgba(59,130,246,0.15); color: var(--info); }
      .badge-muted { background: rgba(139,143,163,0.15); color: var(--text-muted); }

      .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
      .btn:hover { opacity: 0.9; }
      .btn-primary { background: var(--primary); color: #fff; }
      .btn-danger { background: var(--danger); color: #fff; }
      .btn-secondary { background: var(--bg-hover); color: var(--text); border: 1px solid var(--border); }
      .btn-sm { padding: 5px 10px; font-size: 12px; }

      .filter-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
      .filter-btn { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-muted); transition: all 0.15s; text-decoration: none; }
      .filter-btn:hover { border-color: var(--primary); color: var(--text); text-decoration: none; }
      .filter-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }

      .pagination { display: flex; gap: 8px; justify-content: center; margin-top: 16px; }
      .pagination a { padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border); color: var(--text-muted); font-size: 13px; }
      .pagination a:hover { border-color: var(--primary); color: var(--text); text-decoration: none; }
      .pagination a.active { background: var(--primary); color: #fff; border-color: var(--primary); }

      .detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
      .detail-item { padding: 12px 0; border-bottom: 1px solid var(--border); }
      .detail-item:last-child { border-bottom: none; }
      .detail-label { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
      .detail-value { font-size: 15px; font-weight: 500; }

      .chart-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
      .chart-bar-label { width: 100px; font-size: 13px; color: var(--text-muted); text-align: right; }
      .chart-bar-fill { height: 28px; border-radius: 6px; background: var(--primary); min-width: 4px; transition: width 0.3s; display: flex; align-items: center; padding: 0 8px; }
      .chart-bar-value { font-size: 12px; font-weight: 600; color: #fff; white-space: nowrap; }

      .empty-state { text-align: center; padding: 40px; color: var(--text-muted); }
      .empty-state .empty-icon { font-size: 48px; margin-bottom: 12px; }

      .login-container { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .login-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 40px; width: 100%; max-width: 400px; }
      .login-card h1 { text-align: center; margin-bottom: 8px; color: var(--primary); }
      .login-card p { text-align: center; color: var(--text-muted); font-size: 14px; margin-bottom: 24px; }
      .form-group { margin-bottom: 16px; }
      .form-group label { display: block; font-size: 13px; font-weight: 500; color: var(--text-muted); margin-bottom: 6px; }
      .form-group input { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); font-size: 15px; outline: none; }
      .form-group input:focus { border-color: var(--primary); }
      .error-msg { color: var(--danger); font-size: 13px; text-align: center; margin-bottom: 12px; }

      .confirm-dialog { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 100; align-items: center; justify-content: center; }
      .confirm-dialog.show { display: flex; }
      .confirm-box { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; max-width: 400px; width: 90%; }
      .confirm-box h3 { margin-bottom: 12px; }
      .confirm-box p { color: var(--text-muted); font-size: 14px; margin-bottom: 20px; }
      .confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }

      .btn-delete-sm { background: none; border: 1px solid var(--danger); color: var(--danger); padding: 3px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all .15s; }
      .btn-delete-sm:hover { background: var(--danger); color: #fff; }
      .delete-form { display: inline; }

      @media (max-width: 768px) {
        .sidebar { display: none; }
        .main { margin-left: 0; padding: 16px; }
        .stats-grid { grid-template-columns: repeat(2, 1fr); }
      }
    </style>
  `;
}

function sidebarHtml(activePage: string): string {
  const items = [
    { href: "/api/admin", icon: "📊", label: "Dashboard", key: "dashboard" },
    { href: "/api/admin/businesses", icon: "🏢", label: "Businesses", key: "businesses" },
    { href: "/api/admin/clients", icon: "👥", label: "Clients", key: "clients" },
    { href: "/api/admin/appointments", icon: "📅", label: "Appointments", key: "appointments" },
    { href: "/api/admin/staff", icon: "👤", label: "Staff", key: "staff" },
    { href: "/api/admin/locations", icon: "📍", label: "Locations", key: "locations" },
    { href: "/api/admin/discounts", icon: "🏷️", label: "Discounts", key: "discounts" },
    { href: "/api/admin/giftcards", icon: "🎁", label: "Gift Cards", key: "giftcards" },
    { href: "/api/admin/reviews", icon: "⭐", label: "Reviews", key: "reviews" },
    { href: "/api/admin/products", icon: "📦", label: "Products", key: "products" },
    { href: "/api/admin/analytics", icon: "📈", label: "Analytics", key: "analytics" },
    { href: "/api/admin/db", icon: "🗄️", label: "DB Explorer", key: "db" },
    { href: "/api/admin/subscriptions", icon: "💳", label: "Subscriptions", key: "subscriptions" },
    { href: "/api/admin/plans", icon: "📋", label: "Plan Pricing", key: "plans" },
    { href: "/api/admin/platform-config", icon: "🔧", label: "Platform Config", key: "platform-config" },
    { href: "/api/admin/settings", icon: "⚙️", label: "Settings", key: "settings" },
  ];
  return `
    <div class="sidebar">
      <div class="sidebar-logo">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="${ADMIN_LOGO_BASE64}" alt="Lime Of Time" style="width:36px;height:36px;border-radius:8px;" />
          <div>
            <h1 style="font-size:16px;">Lime Of Time</h1>
            <p style="font-size:11px;color:var(--text-muted);margin-top:2px;">Admin Dashboard</p>
          </div>
        </div>
      </div>
      ${items
        .map(
          (i) =>
            `<a href="${i.href}" class="nav-item ${activePage === i.key ? "active" : ""}">
              <span class="nav-icon">${i.icon}</span> ${i.label}
            </a>`
        )
        .join("")}
      <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid var(--border); margin-top: 20px;">
        <a href="/api/admin/logout" class="nav-item" style="color: var(--danger);">
          <span class="nav-icon">🚪</span> Logout
        </a>
      </div>
    </div>
  `;
}

function adminLayout(title: string, activePage: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Lime Of Time Admin</title>
  <meta name="robots" content="noindex, nofollow">
  ${adminStyles()}
</head>
<body>
  <div class="layout">
    ${sidebarHtml(activePage)}
    <div class="main">
      ${content}
    </div>
  </div>
</body>
</html>`;
}

// ─── Login Page ─────────────────────────────────────────────────────
function loginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login - Lime Of Time</title>
  <meta name="robots" content="noindex, nofollow">
  ${adminStyles()}
</head>
<body>
  <div class="login-container">
    <div class="login-card">
      <div style="text-align:center;margin-bottom:8px;"><img src="${ADMIN_LOGO_BASE64}" alt="Lime Of Time" style="width:64px;height:64px;border-radius:12px;" /></div>
      <h1>Lime Of Time</h1>
      <p>Admin Dashboard Login</p>
      ${error ? `<div class="error-msg">${error}</div>` : ""}
      <form method="POST" action="/api/admin/login">
        <div class="form-group">
          <label>Username</label>
          <input type="text" name="username" required autocomplete="username" placeholder="Enter username">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" required autocomplete="current-password" placeholder="Enter password">
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center; padding:12px; font-size:16px; margin-top:8px;">
          Sign In
        </button>
      </form>
    </div>
  </div>
</body>
</html>`;
}

// ─── Error Page ─────────────────────────────────────────────────────
function errorPage(message: string): string {
  return adminLayout("Error", "", `
    <div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <h3>${message}</h3>
      <p style="margin-top:8px;"><a href="/api/admin">Back to Dashboard</a></p>
    </div>
  `);
}

// ─── Dashboard Page ─────────────────────────────────────────────────
function dashboardPage(data: {
  totalBusinesses: number;
  totalClients: number;
  totalAppointments: number;
  totalServices: number;
  totalReviews: number;
  totalGiftCards: number;
  totalDiscounts: number;
  totalProducts: number;
  totalStaff: number;
  totalUsers: number;
  totalLocations: number;
  recentBusinesses: any[];
  recentAppts: any[];
}): string {
  return adminLayout("Dashboard", "dashboard", `
    <div class="page-header">
      <h2>Dashboard Overview</h2>
      <span style="font-size:13px; color:var(--text-muted);">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">🏢</div>
        <div class="stat-label">Total Businesses</div>
        <div class="stat-value">${data.totalBusinesses}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-label">Total Clients</div>
        <div class="stat-value">${data.totalClients}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📅</div>
        <div class="stat-label">Total Appointments</div>
        <div class="stat-value">${data.totalAppointments}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🛎️</div>
        <div class="stat-label">Total Services</div>
        <div class="stat-value">${data.totalServices}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📦</div>
        <div class="stat-label">Total Products</div>
        <div class="stat-value">${data.totalProducts}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⭐</div>
        <div class="stat-label">Total Reviews</div>
        <div class="stat-value">${data.totalReviews}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🎁</div>
        <div class="stat-label">Gift Cards</div>
        <div class="stat-value">${data.totalGiftCards}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🏷️</div>
        <div class="stat-label">Discounts</div>
        <div class="stat-value">${data.totalDiscounts}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👤</div>
        <div class="stat-label">Staff Members</div>
        <div class="stat-value">${data.totalStaff}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📍</div>
        <div class="stat-label">Locations</div>
        <div class="stat-value">${data.totalLocations}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔑</div>
        <div class="stat-label">Registered Users</div>
        <div class="stat-value">${data.totalUsers}</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
      <div class="card">
        <h3>Recent Businesses</h3>
        ${data.recentBusinesses.length === 0
          ? '<div class="empty-state"><p>No businesses yet</p></div>'
          : `<table>
              <thead><tr><th>Name</th><th>Phone</th><th>Created</th></tr></thead>
              <tbody>
                ${data.recentBusinesses
                  .map(
                    (b: any) =>
                      `<tr>
                        <td><a href="/api/admin/businesses/${b.id}">${b.businessName}</a></td>
                        <td>${b.phone || "N/A"}</td>
                        <td>${fmtDate(b.createdAt)}</td>
                      </tr>`
                  )
                  .join("")}
              </tbody>
            </table>`
        }
      </div>
      <div class="card">
        <h3>Recent Appointments</h3>
        ${data.recentAppts.length === 0
          ? '<div class="empty-state"><p>No appointments yet</p></div>'
          : `<table>
              <thead><tr><th>Date</th><th>Time</th><th>Status</th></tr></thead>
              <tbody>
                ${data.recentAppts
                  .map(
                    (a: any) => {
                      const badgeClass = a.status === "confirmed" ? "badge-success" : a.status === "pending" ? "badge-warning" : a.status === "cancelled" ? "badge-danger" : "badge-info";
                      return `<tr>
                        <td>${a.date}</td>
                        <td>${a.time}</td>
                        <td><span class="badge ${badgeClass}">${a.status}</span></td>
                      </tr>`;
                    }
                  )
                  .join("")}
              </tbody>
            </table>`
        }
      </div>
    </div>
  `);
}

// ─── Businesses Page ────────────────────────────────────────────────
function businessesPage(businesses: any[]): string {
  return adminLayout("Businesses", "businesses", `
    <div class="page-header">
      <h2>All Businesses</h2>
      <span class="badge badge-info">${businesses.length} total</span>
    </div>
    <style>
      .biz-cards { display:grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap:16px; }
      .biz-card { background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:20px; transition:box-shadow .2s; }
      .biz-card:hover { box-shadow:0 4px 16px rgba(0,0,0,.15); }
      .biz-card-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
      .biz-card-name { font-size:18px; font-weight:700; color:var(--text); margin:0; }
      .biz-card-name a { color:inherit; text-decoration:none; }
      .biz-card-name a:hover { color:var(--primary); }
      .biz-card-meta { display:grid; grid-template-columns:1fr 1fr; gap:8px 16px; font-size:13px; color:var(--text-muted); margin-bottom:14px; }
      .biz-card-meta .meta-label { font-weight:600; color:var(--text); font-size:12px; text-transform:uppercase; letter-spacing:.5px; }
      .biz-card-meta .meta-value { margin-top:2px; }
      .biz-card-footer { display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--border); }
      .biz-card-stats { display:flex; gap:12px; font-size:12px; color:var(--text-muted); }
      .biz-card-stats span { display:flex; align-items:center; gap:3px; }
    </style>
    ${businesses.length === 0
      ? '<div class="card"><div class="empty-state"><div class="empty-icon">🏢</div><p>No businesses registered yet</p></div></div>'
      : `<div class="biz-cards">
          ${businesses.map((b: any) => `
            <div class="biz-card">
              <div class="biz-card-header">
                <h3 class="biz-card-name"><a href="/api/admin/businesses/${b.id}">${b.businessName}</a></h3>
                ${b.temporaryClosed ? '<span class="badge badge-danger">Closed</span>' : '<span class="badge badge-success">Open</span>'}
              </div>
              <div class="biz-card-meta">
                <div><div class="meta-label">📞 Phone</div><div class="meta-value">${b.phone || "N/A"}</div></div>
                <div><div class="meta-label">✉️ Email</div><div class="meta-value">${b.email || "N/A"}</div></div>
                <div><div class="meta-label">📍 Address</div><div class="meta-value" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;">${b.address || "N/A"}</div></div>
                <div><div class="meta-label">🌐 Website</div><div class="meta-value">${b.website || "N/A"}</div></div>
                <div><div class="meta-label">📅 Schedule</div><div class="meta-value">${b.scheduleMode || "weekly"}</div></div>
                <div><div class="meta-label">🕐 Created</div><div class="meta-value">${fmtDate(b.createdAt)}</div></div>
              </div>
              <div class="biz-card-footer">
                <div class="biz-card-stats">
                  <span>ID: ${b.id}</span>
                </div>
                <a href="/api/admin/businesses/${b.id}" class="btn btn-secondary btn-sm">View Details →</a>
              </div>
            </div>
          `).join("")}
        </div>`
    }
  `);
}

// ─── Business Detail Page ───────────────────────────────────────────
function businessDetailPage(data: any): string {
  const o = data.owner;
  const slug = o.businessName.toLowerCase().replace(/\s+/g, "-");
  return adminLayout(o.businessName, "businesses", `
    <div class="breadcrumb"><a href="/api/admin/businesses">Businesses</a> / ${o.businessName}</div>
    <div class="page-header">
      <h2>${o.businessName}</h2>
      <div style="display:flex; gap:8px;">
        <a href="https://lime-of-time.com/book/${slug}" target="_blank" class="btn btn-secondary btn-sm">View Booking Page</a>
        <button onclick="document.getElementById('deleteDialog').classList.add('show')" class="btn btn-danger btn-sm">Delete Business</button>
      </div>
    </div>

    <div class="detail-grid" style="margin-bottom:24px;">
      <div class="card">
        <h3>Business Info</h3>
        <div class="detail-item"><div class="detail-label">ID</div><div class="detail-value">${o.id}</div></div>
        <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">${o.phone || "N/A"}</div></div>
        <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">${o.email || "N/A"}</div></div>
        <div class="detail-item"><div class="detail-label">Address</div><div class="detail-value">${o.address || "N/A"}</div></div>
        <div class="detail-item"><div class="detail-label">Website</div><div class="detail-value">${o.website || "N/A"}</div></div>
        <div class="detail-item"><div class="detail-label">Description</div><div class="detail-value">${o.description || "N/A"}</div></div>
        <div class="detail-item"><div class="detail-label">Schedule Mode</div><div class="detail-value">${o.scheduleMode}</div></div>
        <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${o.temporaryClosed ? '<span class="badge badge-danger">Temporarily Closed</span>' : '<span class="badge badge-success">Open</span>'}</div></div>
        <div class="detail-item"><div class="detail-label">Created</div><div class="detail-value">${fmtDate(o.createdAt)}</div></div>
      </div>
      <div class="card">
        <h3>Statistics</h3>
        <div class="detail-item"><div class="detail-label">Services</div><div class="detail-value">${data.services.length}</div></div>
        <div class="detail-item"><div class="detail-label">Clients</div><div class="detail-value">${data.clients.length}</div></div>
        <div class="detail-item"><div class="detail-label">Appointments</div><div class="detail-value">${data.appointments.length}</div></div>
        <div class="detail-item"><div class="detail-label">Reviews</div><div class="detail-value">${data.reviews.length}</div></div>
        <div class="detail-item"><div class="detail-label">Discounts</div><div class="detail-value">${data.discounts.length}</div></div>
        <div class="detail-item"><div class="detail-label">Gift Cards</div><div class="detail-value">${data.giftCards.length}</div></div>
        <div class="detail-item"><div class="detail-label">Products</div><div class="detail-value">${data.products.length}</div></div>
        <div class="detail-item"><div class="detail-label">Staff Members</div><div class="detail-value">${(data.staffMembers || []).length}</div></div>
        <div class="detail-item"><div class="detail-label">Locations</div><div class="detail-value">${(data.locations || []).length}</div></div>
      </div>
    </div>

    ${data.services.length > 0 ? `
    <div class="card">
      <h3>Services (${data.services.length})</h3>
      <table>
        <thead><tr><th>Name</th><th>Duration</th><th>Price</th><th>Color</th><th>Actions</th></tr></thead>
        <tbody>
          ${data.services.map((s: any) => `<tr><td>${s.name}</td><td>${s.duration} min</td><td>${fmtCurrency(parseFloat(s.price))}</td><td><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${s.color};vertical-align:middle;"></span> ${s.color}</td><td><form class="delete-form" method="POST" action="/api/admin/delete/service/${s.id}" onsubmit="return confirm('Delete service ${escHtml(s.name)}?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td></tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}

    ${data.clients.length > 0 ? `
    <div class="card">
      <h3>Clients (${data.clients.length})</h3>
      <table>
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          ${data.clients.map((c: any) => `<tr><td>${c.name}</td><td>${c.phone || "N/A"}</td><td>${c.email || "N/A"}</td><td>${fmtDate(c.createdAt)}</td><td><form class="delete-form" method="POST" action="/api/admin/delete/client/${c.id}" onsubmit="return confirm('Delete client ${escHtml(c.name)}?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td></tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}

    ${(data.staffMembers || []).length > 0 ? `
    <div class="card">
      <h3>Staff Members (${data.staffMembers.length})</h3>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Color</th><th>Services</th><th>Actions</th></tr></thead>
        <tbody>
          ${data.staffMembers.map((s: any) => {
            let svcNames = "All";
            try {
              const ids = JSON.parse(s.serviceIds || "[]");
              if (ids.length > 0) svcNames = ids.map((id: string) => {
                const svc = data.services.find((sv: any) => sv.localId === id);
                return svc ? svc.name : id;
              }).join(", ");
            } catch {}
            return `<tr><td style="font-weight:600;">${s.name}</td><td>${s.email || "N/A"}</td><td>${s.phone || "N/A"}</td><td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${s.color || '#4a8c3f'};vertical-align:middle;"></span></td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${svcNames}</td><td><form class="delete-form" method="POST" action="/api/admin/delete/staff/${s.id}" onsubmit="return confirm('Delete staff ${escHtml(s.name)}?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>` : ""}

    ${(data.locations || []).length > 0 ? `
    <div class="card">
      <h3>Locations (${data.locations.length})</h3>
      <table>
        <thead><tr><th>Name</th><th>Address</th><th>Phone</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${data.locations.map((loc: any) => { const statusBadge = !loc.active ? '<span class="badge badge-danger">Inactive</span>' : loc.temporarilyClosed ? '<span class="badge badge-warning">Temp. Closed</span>' : '<span class="badge badge-success">Active</span>'; return `<tr><td style="font-weight:600;">${loc.name}</td><td>${loc.address || "N/A"}</td><td>${loc.phone || "N/A"}</td><td>${loc.email || "N/A"}</td><td>${statusBadge}</td><td><form class="delete-form" method="POST" action="/api/admin/delete/location/${loc.id}" onsubmit="return confirm('Delete location ${escHtml(loc.name)}?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td></tr>`; }).join("")}
        </tbody>
      </table>
    </div>` : ""}

    ${data.appointments.length > 0 ? `
    <div class="card">
      <h3>Appointments (${data.appointments.length})</h3>
      <table>
        <thead><tr><th>Date</th><th>Time</th><th>Duration</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
        <tbody>
          ${data.appointments.map((a: any) => {
            const bc = a.status === "confirmed" ? "badge-success" : a.status === "pending" ? "badge-warning" : a.status === "cancelled" ? "badge-danger" : "badge-info";
            return `<tr><td>${a.date}</td><td>${a.time}</td><td>${a.duration} min</td><td><span class="badge ${bc}">${a.status}</span></td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.notes || ""}</td><td><form class="delete-form" method="POST" action="/api/admin/delete/appointment/${a.id}" onsubmit="return confirm('Delete this appointment?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>` : ""}

    <div id="deleteDialog" class="confirm-dialog">
      <div class="confirm-box">
        <h3>Delete Business</h3>
        <p>Are you sure you want to delete "${o.businessName}"? This will permanently remove all associated data (clients, appointments, services, reviews, etc.). This action cannot be undone.</p>
        <div class="confirm-actions">
          <button onclick="document.getElementById('deleteDialog').classList.remove('show')" class="btn btn-secondary">Cancel</button>
          <form method="POST" action="/api/admin/businesses/${o.id}/delete" style="display:inline;">
            <button type="submit" class="btn btn-danger">Delete Permanently</button>
          </form>
        </div>
      </div>
    </div>

    <!-- Subscription & Admin Override -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;margin-top:24px;">
      <h3 style="font-size:16px;font-weight:700;margin:0 0 16px;">💳 Subscription & Admin Override</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:20px;">
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Current Plan</div>
          <div style="font-size:16px;font-weight:700;color:var(--primary);">${(o.subscriptionPlan || 'solo').toUpperCase()}</div>
        </div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Status</div>
          <div style="font-size:16px;font-weight:700;">${o.subscriptionStatus || 'free'}</div>
        </div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Admin Override</div>
          <div style="font-size:16px;font-weight:700;color:${o.adminOverride ? '#059669' : '#6b7280'};">${o.adminOverride ? '✓ ACTIVE' : 'Inactive'}</div>
        </div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Trial Ends</div>
          <div style="font-size:14px;font-weight:600;">${o.trialEndsAt ? new Date(o.trialEndsAt).toLocaleDateString() : '—'}</div>
        </div>
      </div>
      ${o.adminOverride ? '<div style="background:#05996915;border:1px solid #05996940;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#059669;"><strong>⭐ Admin Override is ACTIVE.</strong> This business has full Unlimited access at no charge.</div>' : ''}
      <form method="POST" action="/api/admin/businesses/${o.id}/override">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div>
            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px;">Assign Plan</label>
            <select name="overridePlan" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;">
              <option value="solo" ${(o.subscriptionPlan || 'solo') === 'solo' ? 'selected' : ''}>Solo (Free)</option>
              <option value="growth" ${o.subscriptionPlan === 'growth' ? 'selected' : ''}>Growth ($19/mo)</option>
              <option value="studio" ${o.subscriptionPlan === 'studio' ? 'selected' : ''}>Studio ($39/mo)</option>
              <option value="enterprise" ${o.subscriptionPlan === 'enterprise' ? 'selected' : ''}>Enterprise ($69/mo)</option>
            </select>
          </div>
          <div style="display:flex;align-items:flex-end;">
            <label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer;margin-bottom:10px;">
              <input type="checkbox" name="adminOverride" value="on" ${o.adminOverride ? 'checked' : ''} style="width:18px;height:18px;" />
              <span><strong>Admin Override</strong><br/><span style="font-size:12px;color:var(--text-muted);">Grant full Unlimited access for free</span></span>
            </label>
          </div>
        </div>
        <button type="submit" style="background:var(--primary);color:white;padding:10px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">💾 Save Subscription Settings</button>
      </form>
    </div>
  `);
}

// ─── Clients Page ───────────────────────────────────────────────────
function clientsPage(allClients: any[], allBiz: any[]): string {
  const bizMap = new Map(allBiz.map((b: any) => [b.id, b.businessName]));
  return adminLayout("Clients", "clients", `
    <div class="page-header">
      <h2>All Clients</h2>
      <span class="badge badge-info">${allClients.length} total</span>
    </div>
    <div class="card">
      ${allClients.length === 0
        ? '<div class="empty-state"><div class="empty-icon">👥</div><p>No clients yet</p></div>'
        : `<table>
            <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Business</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              ${allClients.map((c: any) => `<tr>
                <td style="font-weight:500;">${c.name}</td>
                <td>${c.phone || "N/A"}</td>
                <td>${c.email || "N/A"}</td>
                <td><a href="/api/admin/businesses/${c.businessOwnerId}">${bizMap.get(c.businessOwnerId) || "Unknown"}</a></td>
                <td>${fmtDate(c.createdAt)}</td>
                <td><form class="delete-form" method="POST" action="/api/admin/delete/client/${c.id}" onsubmit="return confirm('Delete client ${escHtml(c.name)}? This will also delete their appointments and reviews.')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
              </tr>`).join("")}
            </tbody>
          </table>`
      }
    </div>
  `);
}

// ─── Appointments Page ──────────────────────────────────────────────
function appointmentsPage(allAppts: any[], allBiz: any[], allCli: any[], allSvc: any[], statusFilter: string): string {
  const bizMap = new Map(allBiz.map((b: any) => [b.id, b.businessName]));
  const cliMap = new Map(allCli.map((c: any) => [`${c.businessOwnerId}-${c.localId}`, c.name]));
  const svcMap = new Map(allSvc.map((s: any) => [`${s.businessOwnerId}-${s.localId}`, s.name]));
  const statuses = ["", "pending", "confirmed", "completed", "cancelled"];
  const statusLabels = ["All", "Pending", "Confirmed", "Completed", "Cancelled"];

  return adminLayout("Appointments", "appointments", `
    <div class="page-header">
      <h2>All Appointments</h2>
      <span class="badge badge-info">${allAppts.length} shown</span>
    </div>
    <div class="filter-bar">
      ${statuses.map((s, i) => `<a href="/api/admin/appointments${s ? "?status=" + s : ""}" class="filter-btn ${statusFilter === s ? "active" : ""}">${statusLabels[i]}</a>`).join("")}
    </div>
    <div class="card">
      ${allAppts.length === 0
        ? '<div class="empty-state"><div class="empty-icon">📅</div><p>No appointments found</p></div>'
        : `<table>
            <thead><tr><th>Date</th><th>Time</th><th>Client</th><th>Service</th><th>Business</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${allAppts.map((a: any) => {
                const bc = a.status === "confirmed" ? "badge-success" : a.status === "pending" ? "badge-warning" : a.status === "cancelled" ? "badge-danger" : "badge-info";
                return `<tr>
                  <td>${a.date}</td>
                  <td>${a.time}</td>
                  <td>${cliMap.get(`${a.businessOwnerId}-${a.clientLocalId}`) || a.clientLocalId}</td>
                  <td>${svcMap.get(`${a.businessOwnerId}-${a.serviceLocalId}`) || a.serviceLocalId}</td>
                  <td><a href="/api/admin/businesses/${a.businessOwnerId}">${bizMap.get(a.businessOwnerId) || "Unknown"}</a></td>
                  <td>${a.duration} min</td>
                  <td><span class="badge ${bc}">${a.status}</span></td>
                  <td><form class="delete-form" method="POST" action="/api/admin/delete/appointment/${a.id}" onsubmit="return confirm('Delete this appointment?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>`
      }
    </div>
  `);
}

// ─── DB Explorer Page ───────────────────────────────────────────────
function dbExplorerPage(table: string, rows: any[], page: number, totalPages: number, totalRows: number, tables: string[]): string {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return adminLayout("DB Explorer", "db", `
    <div class="page-header">
      <h2>Database Explorer</h2>
      <span class="badge badge-info">${totalRows} rows in ${table}</span>
    </div>
    <div class="filter-bar">
      ${tables.map((t) => `<a href="/api/admin/db?table=${t}" class="filter-btn ${table === t ? "active" : ""}">${t}</a>`).join("")}
    </div>
    <div class="card" style="overflow-x:auto;">
      ${rows.length === 0
        ? '<div class="empty-state"><p>No data in this table</p></div>'
        : `<table>
            <thead><tr>${columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
            <tbody>
              ${rows.map((r: any) => `<tr>${columns.map((c) => {
                let val = r[c];
                if (val === null || val === undefined) val = '<span style="color:var(--text-muted);">NULL</span>';
                else if (typeof val === "object") val = `<code style="font-size:11px;color:var(--text-muted);max-width:200px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${JSON.stringify(val)}</code>`;
                else if (typeof val === "boolean") val = val ? '<span class="badge badge-success">true</span>' : '<span class="badge badge-danger">false</span>';
                else val = String(val);
                return `<td>${val}</td>`;
              }).join("")}</tr>`).join("")}
            </tbody>
          </table>
          ${totalPages > 1 ? `
          <div class="pagination">
            ${page > 1 ? `<a href="/api/admin/db?table=${table}&page=${page - 1}">Previous</a>` : ""}
            ${Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
              const p = i + 1;
              return `<a href="/api/admin/db?table=${table}&page=${p}" class="${p === page ? "active" : ""}">${p}</a>`;
            }).join("")}
            ${page < totalPages ? `<a href="/api/admin/db?table=${table}&page=${page + 1}">Next</a>` : ""}
          </div>` : ""}`
      }
    </div>
  `);
}

// ─── Analytics Page ─────────────────────────────────────────────────
function analyticsPage(data: {
  apptsByStatus: { status: string; count: number }[];
  apptsByMonth: { month: string; count: number }[];
  bizByMonth: { month: string; count: number }[];
  avgRating: number;
  topServices: { serviceLocalId: string; count: number }[];
}): string {
  const maxApptMonth = Math.max(...data.apptsByMonth.map((m) => m.count), 1);
  const maxBizMonth = Math.max(...data.bizByMonth.map((m) => m.count), 1);

  return adminLayout("Analytics", "analytics", `
    <div class="page-header">
      <h2>Analytics</h2>
    </div>

    <div class="stats-grid">
      ${data.apptsByStatus.map((s) => {
        const bc = s.status === "confirmed" ? "badge-success" : s.status === "pending" ? "badge-warning" : s.status === "cancelled" ? "badge-danger" : "badge-info";
        return `<div class="stat-card">
          <div class="stat-label">${s.status.charAt(0).toUpperCase() + s.status.slice(1)} Appointments</div>
          <div class="stat-value"><span class="badge ${bc}" style="font-size:20px;padding:6px 14px;">${s.count}</span></div>
        </div>`;
      }).join("")}
      <div class="stat-card">
        <div class="stat-icon">⭐</div>
        <div class="stat-label">Average Rating</div>
        <div class="stat-value">${Number(data.avgRating).toFixed(1)}</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
      <div class="card">
        <h3>Appointments by Month</h3>
        ${data.apptsByMonth.length === 0
          ? '<div class="empty-state"><p>No data yet</p></div>'
          : data.apptsByMonth.map((m) => `
            <div class="chart-bar">
              <div class="chart-bar-label">${m.month}</div>
              <div class="chart-bar-fill" style="width: ${Math.max((m.count / maxApptMonth) * 100, 8)}%;">
                <span class="chart-bar-value">${m.count}</span>
              </div>
            </div>
          `).join("")}
      </div>
      <div class="card">
        <h3>Business Growth</h3>
        ${data.bizByMonth.length === 0
          ? '<div class="empty-state"><p>No data yet</p></div>'
          : data.bizByMonth.map((m) => `
            <div class="chart-bar">
              <div class="chart-bar-label">${m.month}</div>
              <div class="chart-bar-fill" style="width: ${Math.max((m.count / maxBizMonth) * 100, 8)}%;">
                <span class="chart-bar-value">${m.count}</span>
              </div>
            </div>
          `).join("")}
      </div>
    </div>

    ${data.topServices.length > 0 ? `
    <div class="card" style="margin-top:16px;">
      <h3>Top Services by Booking Count</h3>
      <table>
        <thead><tr><th>Service ID</th><th>Bookings</th></tr></thead>
        <tbody>
          ${data.topServices.map((s) => `<tr><td>${s.serviceLocalId}</td><td><span class="badge badge-success">${s.count}</span></td></tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}
  `);
}

// ─── Settings Page ──────────────────────────────────────────────────
function settingsPage(): string {
  return adminLayout("Settings", "settings", `
    <div class="page-header">
      <h2>Admin Settings</h2>
    </div>
    <div class="detail-grid">
      <div class="card">
        <h3>Admin Credentials</h3>
        <div class="detail-item">
          <div class="detail-label">Username</div>
          <div class="detail-value">${ADMIN_USER}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Password</div>
          <div class="detail-value">••••••••</div>
        </div>
        <p style="font-size:12px; color:var(--text-muted); margin-top:12px;">
          Admin credentials are configured via environment variables: <code>ADMIN_USERNAME</code> and <code>ADMIN_PASSWORD</code>.
          To change them, update the environment variables and restart the server.
        </p>
      </div>
      <div class="card">
        <h3>Server Info</h3>
        <div class="detail-item">
          <div class="detail-label">Node.js Version</div>
          <div class="detail-value">${process.version}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Environment</div>
          <div class="detail-value">${process.env.NODE_ENV || "development"}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Database</div>
          <div class="detail-value">${process.env.DATABASE_URL ? '<span class="badge badge-success">Connected</span>' : '<span class="badge badge-danger">Not configured</span>'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Server Uptime</div>
          <div class="detail-value">${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m</div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:16px;">
      <h3>Quick Links</h3>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <a href="/api/health" target="_blank" class="btn btn-secondary btn-sm">Health Check</a>
        <a href="/api/admin/db" class="btn btn-secondary btn-sm">DB Explorer</a>
        <a href="/api/admin/analytics" class="btn btn-secondary btn-sm">Analytics</a>
        <a href="/api/home" target="_blank" class="btn btn-secondary btn-sm">Public Homepage</a>
      </div>
    </div>
  `);
}

function staffPage(allStaff: any[], allBiz: any[], allSvc: any[]): string {
  const bizMap = new Map(allBiz.map((b) => [b.id, b.businessName || b.name || "Unknown"]));
  const svcMap = new Map(allSvc.map((s) => [s.localId, s.name]));

  const staffByBiz: Record<string, any[]> = {};
  allStaff.forEach((s) => {
    const bizName = bizMap.get(s.ownerId) || "Unknown Business";
    if (!staffByBiz[bizName]) staffByBiz[bizName] = [];
    staffByBiz[bizName].push(s);
  });

  let content = `
    <div class="page-header">
      <h2>Staff Management</h2>
      <span style="font-size:13px; color:var(--text-muted);">${allStaff.length} staff member${allStaff.length !== 1 ? "s" : ""} across ${Object.keys(staffByBiz).length} business${Object.keys(staffByBiz).length !== 1 ? "es" : ""}</span>
    </div>

    <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="stat-card">
        <div class="stat-icon">\ud83d\udc64</div>
        <div class="stat-label">Total Staff</div>
        <div class="stat-value">${allStaff.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">\ud83c\udfe2</div>
        <div class="stat-label">Businesses with Staff</div>
        <div class="stat-value">${Object.keys(staffByBiz).length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">\ud83d\udee0\ufe0f</div>
        <div class="stat-label">Avg Services/Staff</div>
        <div class="stat-value">${allStaff.length > 0 ? (allStaff.reduce((sum, s) => {
          try { const ids = JSON.parse(s.serviceIds || "[]"); return sum + ids.length; } catch { return sum; }
        }, 0) / allStaff.length).toFixed(1) : "0"}</div>
      </div>
    </div>
  `;

  // Staff table grouped by business
  Object.entries(staffByBiz).sort((a, b) => a[0].localeCompare(b[0])).forEach(([bizName, members]) => {
    content += `
      <div class="card" style="margin-top:16px;">
        <h3 style="margin-bottom:12px;">\ud83c\udfe2 ${escHtml(bizName)} <span style="font-size:12px;color:var(--text-muted);font-weight:400;">(${members.length} staff)</span></h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Color</th>
              <th>Services</th>
              <th>Working Days</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${members.map((s) => {
              let serviceNames = "All";
              try {
                const ids = JSON.parse(s.serviceIds || "[]");
                if (ids.length > 0) {
                  serviceNames = ids.map((id: string) => svcMap.get(id) || id).join(", ");
                }
              } catch {}

              let workingDays = "N/A";
              try {
                const wh = JSON.parse(s.workingHours || "{}");
                const days = Object.entries(wh)
                  .filter(([_, v]: [string, any]) => v && v.enabled)
                  .map(([d]) => d.charAt(0).toUpperCase() + d.slice(0, 3));
                workingDays = days.length > 0 ? days.join(", ") : "None";
              } catch {}

              const created = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "N/A";

              return `<tr>
                <td style="font-weight:600;">${escHtml(s.name)}</td>
                <td>${s.email ? escHtml(s.email) : '<span style="color:var(--text-muted);">—</span>'}</td>
                <td>${s.phone ? escHtml(s.phone) : '<span style="color:var(--text-muted);">—</span>'}</td>
                <td><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${s.color || '#4a8c3f'};vertical-align:middle;"></span> ${s.color || '#4a8c3f'}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(serviceNames)}">${escHtml(serviceNames)}</td>
                <td>${workingDays}</td>
                <td>${created}</td>
                <td><form class="delete-form" method="POST" action="/api/admin/delete/staff/${s.id}" onsubmit="return confirm('Delete staff member ${escHtml(s.name)}?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  });

  if (allStaff.length === 0) {
    content += `
      <div class="card" style="margin-top:16px;">
        <div class="empty-state">
          <p>No staff members have been added yet.</p>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">Business owners can add staff from their mobile app under Settings > Staff Management.</p>
        </div>
      </div>
    `;
  }

  return adminLayout("Staff Management", "staff", content);
}

// ─── Discounts Page ────────────────────────────────────────────────
function discountsPage(allDisc: any[], allBiz: any[]): string {
  const bizMap = new Map(allBiz.map((b: any) => [b.id, b.businessName]));
  return adminLayout("Discounts", "discounts", `
    <div class="page-header">
      <h2>All Discounts</h2>
      <span class="badge badge-info">${allDisc.length} total</span>
    </div>
    <div class="card">
      ${allDisc.length === 0
        ? '<div class="empty-state"><div class="empty-icon">🏷️</div><p>No discounts yet</p></div>'
        : `<table>
            <thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Code</th><th>Business</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>
              ${allDisc.map((d: any) => `<tr>
                <td style="font-weight:500;">${d.name || "Unnamed"}</td>
                <td>${d.type || "percent"}</td>
                <td>${d.type === "fixed" ? fmtCurrency(parseFloat(d.value || "0")) : (d.value || "0") + "%"}</td>
                <td><code>${d.code || "N/A"}</code></td>
                <td><a href="/api/admin/businesses/${d.businessOwnerId}">${bizMap.get(d.businessOwnerId) || "Unknown"}</a></td>
                <td>${d.active !== false ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}</td>
                <td><form class="delete-form" method="POST" action="/api/admin/delete/discount/${d.id}" onsubmit="return confirm('Delete this discount?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
              </tr>`).join("")}
            </tbody>
          </table>`
      }
    </div>
  `);
}

// ─── Gift Cards Page ───────────────────────────────────────────────
function giftCardsPage(allGC: any[], allBiz: any[]): string {
  const bizMap = new Map(allBiz.map((b: any) => [b.id, b.businessName]));
  return adminLayout("Gift Cards", "giftcards", `
    <div class="page-header">
      <h2>All Gift Cards</h2>
      <span class="badge badge-info">${allGC.length} total</span>
    </div>
    <div class="card">
      ${allGC.length === 0
        ? '<div class="empty-state"><div class="empty-icon">🎁</div><p>No gift cards yet</p></div>'
        : `<table>
            <thead><tr><th>Code</th><th>Amount</th><th>Balance</th><th>Business</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              ${allGC.map((g: any) => {
                const isUsed = parseFloat(g.balance || g.amount || "0") <= 0;
                return `<tr>
                  <td><code style="font-weight:600;">${g.code}</code></td>
                  <td>${fmtCurrency(parseFloat(g.amount || "0"))}</td>
                  <td>${fmtCurrency(parseFloat(g.balance || g.amount || "0"))}</td>
                  <td><a href="/api/admin/businesses/${g.businessOwnerId}">${bizMap.get(g.businessOwnerId) || "Unknown"}</a></td>
                  <td>${isUsed ? '<span class="badge badge-danger">Used</span>' : '<span class="badge badge-success">Active</span>'}</td>
                  <td>${fmtDate(g.createdAt)}</td>
                  <td><form class="delete-form" method="POST" action="/api/admin/delete/giftcard/${g.id}" onsubmit="return confirm('Delete this gift card?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>`
      }
    </div>
  `);
}

// ─── Reviews Page ──────────────────────────────────────────────────
function reviewsPage(allRev: any[], allBiz: any[]): string {
  const bizMap = new Map(allBiz.map((b: any) => [b.id, b.businessName]));
  return adminLayout("Reviews", "reviews", `
    <div class="page-header">
      <h2>All Reviews</h2>
      <span class="badge badge-info">${allRev.length} total</span>
    </div>
    <div class="card">
      ${allRev.length === 0
        ? '<div class="empty-state"><div class="empty-icon">⭐</div><p>No reviews yet</p></div>'
        : `<table>
            <thead><tr><th>Rating</th><th>Comment</th><th>Client</th><th>Business</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              ${allRev.map((r: any) => `<tr>
                <td>${"⭐".repeat(Math.min(r.rating, 5))}</td>
                <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.comment || '<span style="color:var(--text-muted);">No comment</span>'}</td>
                <td>${r.clientName || r.clientLocalId || "Anonymous"}</td>
                <td><a href="/api/admin/businesses/${r.businessOwnerId}">${bizMap.get(r.businessOwnerId) || "Unknown"}</a></td>
                <td>${fmtDate(r.createdAt)}</td>
                <td><form class="delete-form" method="POST" action="/api/admin/delete/review/${r.id}" onsubmit="return confirm('Delete this review?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
              </tr>`).join("")}
            </tbody>
          </table>`
      }
    </div>
  `);
}

// ─── Products Page ─────────────────────────────────────────────────
function productsPage(allProd: any[], allBiz: any[]): string {
  const bizMap = new Map(allBiz.map((b: any) => [b.id, b.businessName]));
  return adminLayout("Products", "products", `
    <div class="page-header">
      <h2>All Products</h2>
      <span class="badge badge-info">${allProd.length} total</span>
    </div>
    <div class="card">
      ${allProd.length === 0
        ? '<div class="empty-state"><div class="empty-icon">📦</div><p>No products yet</p></div>'
        : `<table>
            <thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Business</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              ${allProd.map((p: any) => `<tr>
                <td style="font-weight:500;">${p.name}</td>
                <td>${fmtCurrency(parseFloat(p.price || "0"))}</td>
                <td>${p.stock !== null && p.stock !== undefined ? p.stock : '<span style="color:var(--text-muted);">N/A</span>'}</td>
                <td><a href="/api/admin/businesses/${p.businessOwnerId}">${bizMap.get(p.businessOwnerId) || "Unknown"}</a></td>
                <td>${fmtDate(p.createdAt)}</td>
                <td><form class="delete-form" method="POST" action="/api/admin/delete/product/${p.id}" onsubmit="return confirm('Delete product ${escHtml(p.name)}?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
              </tr>`).join("")}
            </tbody>
          </table>`
      }
    </div>
  `);
}

// ─── Locations Page ────────────────────────────────────────────────
function locationsPage(allLoc: any[], allBiz: any[]): string {
  const bizMap = new Map(allBiz.map((b: any) => [b.id, b.businessName]));
  return adminLayout("Locations", "locations", `
    <div class="page-header">
      <h2>All Locations</h2>
      <span class="badge badge-info">${allLoc.length} total</span>
    </div>
    <div class="card">
      ${allLoc.length === 0
        ? '<div class="empty-state"><div class="empty-icon">📍</div><p>No locations yet</p></div>'
        : `<table>
            <thead><tr><th>Name</th><th>Address</th><th>Phone</th><th>Email</th><th>Business</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${allLoc.map((loc: any) => `<tr>
                <td style="font-weight:500;">${escHtml(loc.name)}</td>
                <td>${loc.address ? escHtml(loc.address) : "N/A"}</td>
                <td>${loc.phone || "N/A"}</td>
                <td>${loc.email || "N/A"}</td>
                <td><a href="/api/admin/businesses/${loc.businessOwnerId}">${bizMap.get(loc.businessOwnerId) || "Unknown"}</a></td>
                <td>${!loc.active ? '<span class="badge badge-danger">Inactive</span>' : loc.temporarilyClosed ? '<span class="badge badge-warning">Temp. Closed</span>' : '<span class="badge badge-success">Active</span>'}</td>
                <td><form class="delete-form" method="POST" action="/api/admin/delete/location/${loc.id}" onsubmit="return confirm('Delete location ${escHtml(loc.name)}?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
              </tr>`).join("")}
            </tbody>
          </table>`
      }
    </div>
  `);
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── Subscriptions Page ──────────────────────────────────────────────────────
function subscriptionsPage(businesses: any[], plans: any[]): string {
  const planMap: Record<string, string> = {};
  plans.forEach((p) => { planMap[p.planKey] = p.displayName; });

  const planBadge = (plan: string, override: boolean) => {
    const colors: Record<string, string> = {
      solo: "#6b7280", growth: "#0a7ea4", studio: "#7c3aed", enterprise: "#059669",
    };
    const color = colors[plan] || "#6b7280";
    const label = planMap[plan] || plan;
    return `<span style="background:${color}20;color:${color};padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;">${label}${override ? " ⭐" : ""}</span>`;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      free: { color: "#6b7280", label: "Free" },
      trial: { color: "#f59e0b", label: "Trial" },
      active: { color: "#059669", label: "Active" },
      expired: { color: "#ef4444", label: "Expired" },
    };
    const s = map[status] || { color: "#6b7280", label: status };
    return `<span style="background:${s.color}20;color:${s.color};padding:2px 8px;border-radius:12px;font-size:12px;">${s.label}</span>`;
  };

  const rows = businesses.map((b) => `
    <tr>
      <td><a href="/api/admin/businesses/${b.id}" style="color:var(--primary);text-decoration:none;">${escHtml(b.businessName)}</a></td>
      <td>${escHtml(b.phone || "")}</td>
      <td>${planBadge(b.subscriptionPlan || "solo", !!b.adminOverride)}</td>
      <td>${statusBadge(b.subscriptionStatus || "free")}</td>
      <td>${b.trialEndsAt ? new Date(b.trialEndsAt).toLocaleDateString() : "—"}</td>
      <td>${b.adminOverride ? '<span style="color:#059669;font-weight:600;">✓ Override</span>' : "—"}</td>
      <td><a href="/api/admin/businesses/${b.id}" style="color:var(--primary);">Manage →</a></td>
    </tr>
  `).join("");

  const planStats = plans.map((p) => {
    const count = businesses.filter((b) => (b.subscriptionPlan || "solo") === p.planKey).length;
    return `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:20px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:var(--primary);">${count}</div>
      <div style="font-size:14px;color:var(--text-muted);margin-top:4px;">${escHtml(p.displayName)}</div>
    </div>`;
  }).join("");

  return adminLayout("Subscriptions", "subscriptions", `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
      <h1 style="font-size:24px;font-weight:700;">Subscriptions</h1>
      <a href="/api/admin/plans" style="background:var(--primary);color:white;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:14px;">Manage Plans →</a>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-bottom:28px;">
      ${planStats}
    </div>
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:var(--bg-hover);">
            <th style="padding:12px 16px;text-align:left;font-size:13px;color:var(--text-muted);">Business</th>
            <th style="padding:12px 16px;text-align:left;font-size:13px;color:var(--text-muted);">Phone</th>
            <th style="padding:12px 16px;text-align:left;font-size:13px;color:var(--text-muted);">Plan</th>
            <th style="padding:12px 16px;text-align:left;font-size:13px;color:var(--text-muted);">Status</th>
            <th style="padding:12px 16px;text-align:left;font-size:13px;color:var(--text-muted);">Trial Ends</th>
            <th style="padding:12px 16px;text-align:left;font-size:13px;color:var(--text-muted);">Override</th>
            <th style="padding:12px 16px;text-align:left;font-size:13px;color:var(--text-muted);">Action</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="7" style="padding:32px;text-align:center;color:var(--text-muted);">No businesses yet</td></tr>'}</tbody>
      </table>
    </div>
  `);
}

// ─── Plans Page ──────────────────────────────────────────────────────────────
function plansPage(plans: any[]): string {
  const saved = "";
  const planCards = plans.map((p) => `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div>
          <h3 style="font-size:18px;font-weight:700;margin:0;">${escHtml(p.displayName)}</h3>
          <span style="font-size:12px;color:var(--text-muted);font-family:monospace;">${p.planKey}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          ${p.isPublic ? '<span style="background:#05996920;color:#059669;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">Public</span>' : '<span style="background:#6b728020;color:#6b7280;padding:4px 10px;border-radius:20px;font-size:12px;">Hidden</span>'}
        </div>
      </div>
      <form method="POST" action="/api/admin/plans/${p.id}/update">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Monthly Price ($)</label>
            <input name="monthlyPrice" type="number" step="0.01" min="0" value="${p.monthlyPrice || 0}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;" />
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Yearly Price ($)</label>
            <input name="yearlyPrice" type="number" step="0.01" min="0" value="${p.yearlyPrice || 0}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Max Clients (-1=∞)</label>
            <input name="maxClients" type="number" value="${p.maxClients}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;" />
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Max Appts/mo (-1=∞)</label>
            <input name="maxAppointments" type="number" value="${p.maxAppointments}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;" />
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Max Locations (-1=∞)</label>
            <input name="maxLocations" type="number" value="${p.maxLocations}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;" />
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Max Staff (-1=∞)</label>
            <input name="maxStaff" type="number" value="${p.maxStaff}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;" />
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Max Services (-1=∞)</label>
            <input name="maxServices" type="number" value="${p.maxServices}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;" />
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Max Products (-1=∞)</label>
            <input name="maxProducts" type="number" value="${p.maxProducts}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">SMS Level</label>
            <select name="smsLevel" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;">
              <option value="none" ${p.smsLevel === "none" ? "selected" : ""}>None</option>
              <option value="confirmations" ${p.smsLevel === "confirmations" ? "selected" : ""}>Confirmations Only</option>
              <option value="full" ${p.smsLevel === "full" ? "selected" : ""}>Full Automation</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Payment Level</label>
            <select name="paymentLevel" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;">
              <option value="basic" ${p.paymentLevel === "basic" ? "selected" : ""}>Basic (Cash + P2P)</option>
              <option value="full" ${p.paymentLevel === "full" ? "selected" : ""}>Full (includes Card)</option>
            </select>
          </div>
          <div style="display:flex;align-items:flex-end;gap:16px;">
            <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;margin-bottom:8px;">
              <input type="checkbox" name="isPublic" value="on" ${p.isPublic ? "checked" : ""} style="width:16px;height:16px;" />
              Visible to Public
            </label>
          </div>
        </div>
        <button type="submit" style="background:var(--primary);color:white;padding:10px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Save Changes</button>
      </form>
    </div>
  `).join("");

  return adminLayout("Plan Pricing", "plans", `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
      <h1 style="font-size:24px;font-weight:700;">Plan Pricing & Limits</h1>
      <a href="/api/admin/subscriptions" style="color:var(--primary);text-decoration:none;font-size:14px;">← View Subscribers</a>
    </div>
    <div style="background:#0a7ea420;border:1px solid #0a7ea440;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:var(--text);">
      💡 <strong>Tip:</strong> Toggle "Visible to Public" to control which plans users can sign up for. Solo and Growth are public by default. Studio and Enterprise are hidden until you are ready to launch them.
    </div>
    ${planCards}
  `);
}

// ─── Platform Config Page ────────────────────────────────────────────────────
function platformConfigPage(cfgMap: Record<string, string>): string {
  const isTwilioTestMode = cfgMap["twilio_test_mode"] === "true" || cfgMap["twilio_test_mode"] === "1";
  const isStripeTestMode = cfgMap["stripe_test_mode"] === "true" || cfgMap["stripe_test_mode"] === "1";

  const field = (key: string, label: string, desc: string, sensitive = false, placeholder = "") => {
    const val = cfgMap[key] || "";
    const displayVal = sensitive && val && val.length > 8 ? val.substring(0, 4) + "••••••••" + val.slice(-4) : val;
    return `
      <div style="margin-bottom:16px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">${label}</label>
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 6px;">${desc}</p>
        <input name="${key}" type="${sensitive ? "password" : "text"}" value="${escHtml(val)}"
          placeholder="${placeholder || label}"
          style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;box-sizing:border-box;" />
      </div>
    `;
  };

  return adminLayout("Platform Config", "platform-config", `
    <h1 style="font-size:24px;font-weight:700;margin-bottom:24px;">Platform Configuration</h1>

    <form method="POST" action="/api/admin/platform-config">
      <!-- Twilio Section -->
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <span style="font-size:24px;">📱</span>
          <div>
            <h2 style="font-size:18px;font-weight:700;margin:0;">Twilio SMS Configuration</h2>
            <p style="font-size:13px;color:var(--text-muted);margin:4px 0 0;">Used for OTP login and SMS automation</p>
          </div>
          ${isTwilioTestMode ? '<span style="background:#f59e0b20;color:#f59e0b;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-left:auto;">⚠️ TEST MODE ACTIVE</span>' : '<span style="background:#05996920;color:#059669;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-left:auto;">✓ LIVE MODE</span>'}
        </div>
        ${field("twilio_account_sid", "Account SID", "Found in your Twilio Console dashboard", true, "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")}
        ${field("twilio_auth_token", "Auth Token", "Found in your Twilio Console dashboard", true, "Your Twilio Auth Token")}
        ${field("twilio_from_number", "From Phone Number", "Your Twilio phone number in E.164 format", false, "+14155551234")}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;">
              <input type="checkbox" name="twilio_test_mode" value="true" ${isTwilioTestMode ? "checked" : ""} style="width:16px;height:16px;" />
              <span><strong>Test Mode</strong> — OTP bypassed with code below</span>
            </label>
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Test OTP Code</label>
            <input name="twilio_test_otp" type="text" value="${escHtml(cfgMap["twilio_test_otp"] || "123456")}"
              placeholder="123456"
              style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;box-sizing:border-box;" />
          </div>
        </div>
        ${isTwilioTestMode ? '<div style="background:#f59e0b15;border:1px solid #f59e0b40;border-radius:8px;padding:10px 14px;margin-top:12px;font-size:13px;color:#f59e0b;"><strong>⚠️ Test Mode is ON.</strong> All OTP codes will be bypassed with the test code above. Disable before going live.</div>' : ""}
      </div>

      <!-- Stripe Section -->
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <span style="font-size:24px;">💳</span>
          <div>
            <h2 style="font-size:18px;font-weight:700;margin:0;">Stripe Payment Configuration</h2>
            <p style="font-size:13px;color:var(--text-muted);margin:4px 0 0;">Used for subscription billing (Phase 5 — not yet active)</p>
          </div>
          ${isStripeTestMode ? '<span style="background:#f59e0b20;color:#f59e0b;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-left:auto;">⚠️ TEST MODE</span>' : '<span style="background:#6b728020;color:#6b7280;padding:4px 12px;border-radius:20px;font-size:12px;margin-left:auto;">Not Configured</span>'}
        </div>
        <div style="background:#6b728015;border:1px solid #6b728030;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:var(--text-muted);">
          ℹ️ Stripe billing is planned for Phase 5. You can enter your keys now to prepare, but they will not be used until billing is activated.
        </div>
        ${field("stripe_secret_key", "Secret Key", "From Stripe Dashboard → Developers → API Keys", true, "sk_test_...")}
        ${field("stripe_publishable_key", "Publishable Key", "From Stripe Dashboard → Developers → API Keys", false, "pk_test_...")}
        ${field("stripe_webhook_secret", "Webhook Secret", "From Stripe Dashboard → Webhooks → Signing Secret", true, "whsec_...")}
        <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;margin-top:8px;">
          <input type="checkbox" name="stripe_test_mode" value="true" ${isStripeTestMode ? "checked" : ""} style="width:16px;height:16px;" />
          <span><strong>Test Mode</strong> — Use Stripe test keys (recommended until launch)</span>
        </label>
      </div>

      <button type="submit" style="background:var(--primary);color:white;padding:12px 28px;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;width:100%;">
        💾 Save Platform Configuration
      </button>
    </form>
  `);
}
