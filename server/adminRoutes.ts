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
  adminExpenses,
  adminAuditLog,
} from "../drizzle/schema";
import { sql, eq, count as drizzleCount } from "drizzle-orm";
import { ADMIN_LOGO_BASE64 } from "./admin-logo-data";
import { invalidatePlanCache, invalidateConfigCache } from "./subscription";

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

// ─── Audit Log Helper ──────────────────────────────────────────────
async function writeAuditLog(
  actor: string,
  category: string,
  action: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const dbase = await getDb();
    if (!dbase) return;
    await dbase.insert(adminAuditLog).values({
      actor,
      category,
      action,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (err) {
    console.error("[Admin] Audit log write error:", err);
  }
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

      // Plan distribution
      const planDistRows = await dbase
        .select({ plan: businessOwners.subscriptionPlan, count: sql<number>`COUNT(*)` })
        .from(businessOwners)
        .groupBy(businessOwners.subscriptionPlan);
      const planDist: Record<string, number> = { solo: 0, growth: 0, studio: 0, enterprise: 0 };
      planDistRows.forEach((r) => { const p = r.plan || 'solo'; planDist[p] = Number(r.count); });

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
          planDist,
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
  // Alias: /admin/dashboard → /admin
  app.get("/api/admin/dashboard", requireAuth, (_req: Request, res: Response) => {
    res.redirect("/api/admin");
  });

  app.get("/api/admin/appointments", requireAuth, async (req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const statusFilter = (req.query.status as string) || "";
      const bizFilter = (req.query.biz as string) || "";
      const searchQ = ((req.query.q as string) || "").toLowerCase();
      const PAGE_SIZE = 100;
      const page = Math.max(1, parseInt((req.query.page as string) || "1"));
      const offset = (page - 1) * PAGE_SIZE;

      // Build filtered query with DB-level filtering where possible
      const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'] as const;
      type ApptStatus = typeof validStatuses[number];
      const safeStatus = validStatuses.includes(statusFilter as ApptStatus) ? statusFilter as ApptStatus : null;
      const bizId = bizFilter ? parseInt(bizFilter) : null;

      let baseQuery = dbase.select().from(appointments).$dynamic();
      if (safeStatus) {
        baseQuery = baseQuery.where(eq(appointments.status, safeStatus));
      }
      if (bizId) {
        baseQuery = baseQuery.where(eq(appointments.businessOwnerId, bizId));
      }

      // Count total for pagination
      let countQuery = dbase.select({ cnt: sql<number>`COUNT(*)` }).from(appointments).$dynamic();
      if (safeStatus) countQuery = countQuery.where(eq(appointments.status, safeStatus));
      if (bizId) countQuery = countQuery.where(eq(appointments.businessOwnerId, bizId));
      const [{ cnt: totalCount }] = await countQuery;
      const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

      const allAppts = await baseQuery
        .orderBy(sql`${appointments.date} DESC, ${appointments.time} DESC`)
        .limit(PAGE_SIZE)
        .offset(offset);

      const allBiz = await dbase.select().from(businessOwners);
      const allCli = await dbase.select({ id: clients.id, name: clients.name, localId: clients.localId, businessOwnerId: clients.businessOwnerId }).from(clients);
      const allSvc = await dbase.select({ id: services.id, name: services.name, localId: services.localId, businessOwnerId: services.businessOwnerId }).from(services);
      res.send(appointmentsPage(allAppts, allBiz, allCli, allSvc, statusFilter, bizFilter, searchQ, page, totalPages, totalCount || 0));
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

      const allAppts = await dbase.select().from(appointments);
      const allBiz = await dbase.select().from(businessOwners);
      const allReviews = await dbase.select().from(reviews);
      const allPlans = await dbase.select().from(subscriptionPlans);

       // Plan price map (monthly and yearly)
      const planPriceMap: Record<string, { monthly: number; yearly: number }> = {};
      allPlans.forEach((p) => {
        planPriceMap[p.planKey] = {
          monthly: parseFloat(p.monthlyPrice as string) || 0,
          yearly: parseFloat((p as any).yearlyPrice as string) || 0,
        };
      });
      // MRR: sum of effective monthly prices for all non-free businesses
      const payingBiz = allBiz.filter((b) => b.subscriptionStatus !== 'free' && b.subscriptionStatus !== 'expired');
      const mrr = payingBiz.reduce((sum, b) => {
        const prices = planPriceMap[b.subscriptionPlan] || { monthly: 0, yearly: 0 };
        const price = b.subscriptionPeriod === 'yearly'
          ? (prices.yearly > 0 ? prices.yearly / 12 : prices.monthly)
          : prices.monthly;
        return sum + price;
      }, 0);
      const arr = mrr * 12;
      // Total revenue from completed appointments (use totalPrice field if available)
      const completedAppts = allAppts.filter((a) => a.status === 'completed');
      const totalApptRevenue = completedAppts.reduce((sum, a) => sum + (parseFloat(String((a as any).totalPrice ?? 0)) || 0), 0);;

      // Churn: businesses that expired in last 30 days (status = expired, updatedAt within 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentlyChurned = allBiz.filter((b) => {
        return b.subscriptionStatus === 'expired' && b.updatedAt && new Date(b.updatedAt) > thirtyDaysAgo;
      }).length;
      const activeLast30 = allBiz.filter((b) => b.subscriptionStatus === 'active' || b.subscriptionStatus === 'trial').length;
      const churnRate = activeLast30 + recentlyChurned > 0
        ? Math.round((recentlyChurned / (activeLast30 + recentlyChurned)) * 100)
        : 0;

      // New signups per week (last 8 weeks)
      const weekMap: Record<string, number> = {};
      for (let i = 7; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i * 7);
        const key = `W${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
        weekMap[key] = 0;
      }
      allBiz.forEach((b) => {
        if (!b.createdAt) return;
        const created = new Date(b.createdAt);
        const msAgo = Date.now() - created.getTime();
        const weeksAgo = Math.floor(msAgo / (7 * 24 * 60 * 60 * 1000));
        if (weeksAgo <= 7) {
          const d = new Date();
          d.setDate(d.getDate() - weeksAgo * 7);
          const key = `W${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
          if (weekMap[key] !== undefined) weekMap[key]++;
        }
      });
      const signupsByWeek = Object.entries(weekMap).map(([week, count]) => ({ week, count }));

      // Plan distribution
      const planDist: Record<string, number> = { solo: 0, growth: 0, studio: 0, enterprise: 0 };
      allBiz.forEach((b) => { const p = b.subscriptionPlan || 'solo'; planDist[p] = (planDist[p] || 0) + 1; });

      // Per-business revenue (appointment revenue + subscription MRR)
      const bizApptRevMap: Record<number, number> = {};
      const bizApptCountMap: Record<number, number> = {};
      completedAppts.forEach((a) => {
        bizApptRevMap[a.businessOwnerId] = (bizApptRevMap[a.businessOwnerId] || 0) + (parseFloat((a as any).totalPrice) || 0);
        bizApptCountMap[a.businessOwnerId] = (bizApptCountMap[a.businessOwnerId] || 0) + 1;
      });
      const bizRevTable = allBiz.map((b) => ({
        id: b.id,
        name: b.businessName,
        plan: b.subscriptionPlan,
        status: b.subscriptionStatus,
        revenue: bizApptRevMap[b.id] || 0,
        apptCount: bizApptCountMap[b.id] || 0,
        createdAt: b.createdAt,
      })).sort((a, b) => b.revenue - a.revenue);

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

      // Average rating
      const avgRating = allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;

      res.send(
        analyticsPage({
          mrr,
          arr,
          totalApptRevenue,
          churnRate,
          recentlyChurned,
          planDist,
          signupsByWeek,
          bizRevTable,
          apptsByStatus,
          apptsByMonth,
          avgRating,
          totalBiz: allBiz.length,
          activeBiz: activeLast30,
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
      const bizFilter = (req.query.biz as string) || "";
      const bizId = bizFilter ? parseInt(bizFilter) : null;
      let staffQuery = dbase.select().from(staffMembers).$dynamic();
      if (bizId) staffQuery = staffQuery.where(eq(staffMembers.businessOwnerId, bizId));
      const allStaff = await staffQuery.orderBy(sql`${staffMembers.name} ASC`);
      const allBiz = await dbase.select().from(businessOwners);
      const allSvc = await dbase.select().from(services);
      res.send(staffPage(allStaff, allBiz, allSvc, bizFilter));
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
  app.get("/api/admin/reviews", requireAuth, async (req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const PAGE_SIZE = 100;
      const page = Math.max(1, parseInt((req.query.page as string) || "1"));
      const offset = (page - 1) * PAGE_SIZE;
      const bizFilter = (req.query.biz as string) || "";
      const ratingFilter = (req.query.rating as string) || "";
      const bizId = bizFilter ? parseInt(bizFilter) : null;
      const ratingNum = ratingFilter ? parseInt(ratingFilter) : null;

      let countQuery = dbase.select({ cnt: sql<number>`COUNT(*)` }).from(reviews).$dynamic();
      let listQuery = dbase.select().from(reviews).$dynamic();
      if (bizId) {
        countQuery = countQuery.where(eq(reviews.businessOwnerId, bizId));
        listQuery = listQuery.where(eq(reviews.businessOwnerId, bizId));
      }
      if (ratingNum) {
        countQuery = countQuery.where(eq(reviews.rating, ratingNum));
        listQuery = listQuery.where(eq(reviews.rating, ratingNum));
      }
      const [{ cnt: totalCount }] = await countQuery;
      const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);
      const allRev = await listQuery
        .orderBy(sql`${reviews.createdAt} DESC`)
        .limit(PAGE_SIZE)
        .offset(offset);
      const allBiz = await dbase.select().from(businessOwners);
      res.send(reviewsPage(allRev, allBiz, bizFilter, ratingFilter, page, totalPages, totalCount || 0));
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
      const _planSessionId = getSessionFromCookie(req);
      const _planSession = _planSessionId ? sessions.get(_planSessionId) : null;
      const _planActor = _planSession?.user || "admin";
      await writeAuditLog(_planActor, "plan_pricing", `Updated subscription plan #${req.params.id} pricing/limits`, { planId: req.params.id, monthlyPrice, yearlyPrice, maxLocations, maxStaff, maxServices });
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
      const { adminOverride, overridePlan, overrideStatus, overridePeriod } = req.body;
      const isOverride = adminOverride === "on" || adminOverride === "true" || adminOverride === "1";
      const updateFields: Record<string, unknown> = {
        adminOverride: isOverride,
        subscriptionPlan: isOverride ? (overridePlan || "unlimited") : (overridePlan || "free"),
        updatedAt: new Date(),
      };
      if (overrideStatus) updateFields.subscriptionStatus = overrideStatus;
      if (overridePeriod) updateFields.subscriptionPeriod = overridePeriod;
      await dbase.update(businessOwners).set(updateFields as any).where(eq(businessOwners.id, id));
      const _ovSessionId = getSessionFromCookie(req);
      const _ovSession = _ovSessionId ? sessions.get(_ovSessionId) : null;
      const _ovActor = _ovSession?.user || "admin";
      await writeAuditLog(_ovActor, "subscription_override", `Updated subscription override for business #${id}`, { businessId: id, adminOverride: isOverride, overridePlan, overrideStatus, overridePeriod });
      res.redirect(`/api/admin/businesses/${id}?saved=1`);
    } catch (err) {
      console.error("[Admin] Override error:", err);
      res.status(500).send(errorPage("Failed to update override"));
    }
  });

  // ── Expense CRUD ─────────────────────────────────────────────────────
  app.post("/api/admin/financial/expenses", requireAuth, async (req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const { date, category, description, amount, notes } = req.body;
      if (!date || !description || !amount) { res.redirect("/api/admin/financial?tab=expenses&error=missing"); return; }
      await (dbase as any).insert(adminExpenses).values({ date, category: category || 'other', description, amount: parseFloat(amount), notes: notes || null });
      res.redirect("/api/admin/financial?tab=expenses&saved=1");
    } catch (err) {
      console.error("[Admin] Add expense error:", err);
      res.status(500).send(errorPage("Failed to add expense"));
    }
  });

  app.post("/api/admin/financial/expenses/:id/delete", requireAuth, async (req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const id = parseInt(req.params.id);
      await (dbase as any).delete(adminExpenses).where(eq(adminExpenses.id, id));
      res.redirect("/api/admin/financial?tab=expenses");
    } catch (err) {
      console.error("[Admin] Delete expense error:", err);
      res.status(500).send(errorPage("Failed to delete expense"));
    }
  });

  // ── CSV Export ───────────────────────────────────────────────────────
  app.get("/api/admin/financial/export/monthly", requireAuth, async (req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send("DB unavailable"); return; }
      const allAppts = await dbase.select().from(appointments);
      const now = new Date();
      const monthlyRevMap: Record<string, { rev: number; count: number }> = {};
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevMap[key] = { rev: 0, count: 0 };
      }
      allAppts.forEach((a) => {
        if (!a.createdAt) return;
        const d = new Date(a.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyRevMap[key]) {
          monthlyRevMap[key].rev += parseFloat(String((a as any).totalPrice ?? 0)) || 0;
          monthlyRevMap[key].count++;
        }
      });
      const allExpenses = await (dbase as any).select().from(adminExpenses).catch(() => [] as any[]);
      const expByMonth: Record<string, number> = {};
      allExpenses.forEach((e: any) => {
        if (!e.date) return;
        const mo = e.date.substring(0, 7);
        expByMonth[mo] = (expByMonth[mo] || 0) + (parseFloat(String(e.amount)) || 0);
      });
      let csv = 'Month,Appointment Revenue,Appointments,Expenses,Net Income\n';
      Object.entries(monthlyRevMap).sort((a, b) => a[0].localeCompare(b[0])).forEach(([month, d]) => {
        const exp = expByMonth[month] || 0;
        csv += `${month},${d.rev.toFixed(2)},${d.count},${exp.toFixed(2)},${(d.rev - exp).toFixed(2)}\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="monthly-revenue-${now.getFullYear()}.csv"`);
      res.send(csv);
    } catch (err) {
      console.error("[Admin] CSV export error:", err);
      res.status(500).send("Export failed");
    }
  });

  app.get("/api/admin/financial/export/yearly", requireAuth, async (req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send("DB unavailable"); return; }
      const allAppts = await dbase.select().from(appointments);
      const allBiz = await dbase.select().from(businessOwners);
      const allPlans = await dbase.select().from(subscriptionPlans);
      const planPriceMap: Record<string, number> = {};
      allPlans.forEach((p) => { planPriceMap[p.planKey] = parseFloat(p.monthlyPrice as string) || 0; });
      const now = new Date();
      const yearlyRevMap: Record<string, { apptRev: number; subRev: number; apptCount: number }> = {};
      for (let y = now.getFullYear() - 4; y <= now.getFullYear(); y++) yearlyRevMap[String(y)] = { apptRev: 0, subRev: 0, apptCount: 0 };
      allAppts.forEach((a) => {
        if (!a.createdAt) return;
        const yr = String(new Date(a.createdAt).getFullYear());
        if (yearlyRevMap[yr]) { yearlyRevMap[yr].apptRev += parseFloat(String((a as any).totalPrice ?? 0)) || 0; yearlyRevMap[yr].apptCount++; }
      });
      allBiz.forEach((b) => {
        if (!b.createdAt) return;
        const mp = planPriceMap[b.subscriptionPlan] || 0;
        if (mp === 0) return;
        const joinDate = new Date(b.createdAt);
        const endDate = b.subscriptionStatus === 'expired' && b.updatedAt ? new Date(b.updatedAt) : now;
        let cursor = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);
        while (cursor <= endDate) { const yr = String(cursor.getFullYear()); if (yearlyRevMap[yr]) yearlyRevMap[yr].subRev += mp; cursor.setMonth(cursor.getMonth() + 1); }
      });
      const allExpenses = await (dbase as any).select().from(adminExpenses).catch(() => [] as any[]);
      const expByYear: Record<string, number> = {};
      allExpenses.forEach((e: any) => { if (!e.date) return; const yr = e.date.substring(0, 4); expByYear[yr] = (expByYear[yr] || 0) + (parseFloat(String(e.amount)) || 0); });
      let csv = 'Year,Appointment Revenue,Subscription Revenue,Total Revenue,Appointments,Expenses,Net Income,Est. Tax (30%)\n';
      Object.entries(yearlyRevMap).sort((a, b) => a[0].localeCompare(b[0])).forEach(([year, d]) => {
        const total = d.apptRev + d.subRev;
        const exp = expByYear[year] || 0;
        const net = total - exp;
        const tax = Math.max(0, net) * 0.30;
        csv += `${year},${d.apptRev.toFixed(2)},${d.subRev.toFixed(2)},${total.toFixed(2)},${d.apptCount},${exp.toFixed(2)},${net.toFixed(2)},${tax.toFixed(2)}\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="yearly-revenue-summary.csv"`);
      res.send(csv);
    } catch (err) {
      console.error("[Admin] CSV export error:", err);
      res.status(500).send("Export failed");
    }
  });

  app.get("/api/admin/financial/export/expenses", requireAuth, async (req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send("DB unavailable"); return; }
      const year = req.query.year as string;
      const allExpenses = await (dbase as any).select().from(adminExpenses).catch(() => [] as any[]);
      const filtered = year ? allExpenses.filter((e: any) => e.date && e.date.startsWith(year)) : allExpenses;
      let csv = 'Date,Category,Description,Amount,Notes\n';
      filtered.forEach((e: any) => {
        const desc = (e.description || '').replace(/"/g, '""');
        const notes = (e.notes || '').replace(/"/g, '""');
        csv += `${e.date},${e.category},"${desc}",${parseFloat(String(e.amount)).toFixed(2)},"${notes}"\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="expenses${year ? '-' + year : ''}.csv"`);
      res.send(csv);
    } catch (err) {
      console.error("[Admin] CSV export error:", err);
      res.status(500).send("Export failed");
    }
  });

  // ── Platform Config (Twilio / Stripe) ─────────────────────────────
  app.get("/api/admin/platform-config", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }
      const configs = await dbase.select().from(platformConfig);
      const cfgMap: Record<string, string> = {};
      configs.forEach((c: any) => { cfgMap[c.configKey] = c.configValue || ""; });
      // Fetch all businesses for per-phone OTP override UI
      const bizList = await dbase
        .select({ id: businessOwners.id, businessName: businessOwners.businessName, phone: businessOwners.phone })
        .from(businessOwners)
        .orderBy(businessOwners.businessName);
      res.send(platformConfigPage(cfgMap, bizList));
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
        { key: "TWILIO_ACCOUNT_SID", sensitive: true, desc: "Twilio Account SID" },
        { key: "TWILIO_AUTH_TOKEN", sensitive: true, desc: "Twilio Auth Token" },
        { key: "TWILIO_FROM_NUMBER", sensitive: false, desc: "Twilio From Phone Number" },
        { key: "TWILIO_TEST_MODE", sensitive: false, desc: "Twilio Test Mode (true/false)" },
        { key: "TWILIO_TEST_OTP", sensitive: false, desc: "Test OTP code (default: 123456)" },
        { key: "STRIPE_SECRET_KEY", sensitive: true, desc: "Stripe Secret Key" },
        { key: "STRIPE_PUBLISHABLE_KEY", sensitive: false, desc: "Stripe Publishable Key" },
        { key: "STRIPE_WEBHOOK_SECRET", sensitive: true, desc: "Stripe Webhook Secret" },
        { key: "STRIPE_TEST_MODE", sensitive: false, desc: "Stripe Test Mode (true/false)" },
      ];
      // Checkbox fields — only present in body when checked; absent means unchecked
      const checkboxKeys = new Set(['TWILIO_TEST_MODE', 'STRIPE_TEST_MODE']);
      for (const def of keyDefs) {
        const formKey = def.key.toLowerCase();
        let value: string;
        if (checkboxKeys.has(def.key)) {
          // Checkbox: 'true' if present, 'false' if absent
          value = req.body[formKey] === 'true' ? 'true' : 'false';
        } else {
          value = (req.body[formKey] || "").toString().trim();
        }
        // Check if exists
        const existing = await dbase.select().from(platformConfig).where(eq(platformConfig.configKey, def.key)).limit(1);
        if (existing.length > 0) {
          await dbase.update(platformConfig).set({ configValue: value, updatedAt: new Date() }).where(eq(platformConfig.configKey, def.key));
        } else {
          await dbase.insert(platformConfig).values({ configKey: def.key, configValue: value, isSensitive: def.sensitive, description: def.desc });
        }
      }
      invalidatePlanCache();
      invalidateConfigCache(); // Clear config cache so new values take effect immediately
      // Get actor from session
      const _sessionId = getSessionFromCookie(req);
      const _session = _sessionId ? sessions.get(_sessionId) : null;
      const _actor = _session?.user || "admin";
      await writeAuditLog(_actor, "platform_config", "Updated platform configuration (Twilio/Stripe settings)");
      res.redirect("/api/admin/platform-config?saved=1");
    } catch (err) {
      console.error("[Admin] Platform config save error:", err);
      res.status(500).send(errorPage("Failed to save platform config"));
    }
  });

  // ── Test Twilio Connection ──────────────────────────────────────────
  app.post("/api/admin/test-twilio", requireAuth, async (req: Request, res: Response) => {
    try {
      const sid = (req.body.sid || "").toString().trim();
      const token = (req.body.token || "").toString().trim();
      if (!sid || !token) {
        res.json({ ok: false, message: "Account SID and Auth Token are required." }); return;
      }
      if (!/^AC[a-f0-9]{32}$/i.test(sid)) {
        res.json({ ok: false, message: "Invalid Account SID format (must start with AC, 34 chars)." }); return;
      }
      // Call Twilio REST API — fetch account details
      const credentials = Buffer.from(`${sid}:${token}`).toString("base64");
      const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
        headers: { Authorization: `Basic ${credentials}` },
      });
      if (twilioRes.ok) {
        const data = await twilioRes.json() as any;
        const friendlyName = data.friendly_name || sid;
        const status = data.status || "active";
        res.json({ ok: true, message: `✓ Connected — Account: "${friendlyName}" (${status})` });
      } else {
        const errData = await twilioRes.json().catch(() => ({})) as any;
        const msg = errData?.message || `HTTP ${twilioRes.status}`;
        res.json({ ok: false, message: `Connection failed: ${msg}` });
      }
    } catch (err: any) {
      res.json({ ok: false, message: `Error: ${err?.message || "Unknown error"}` });
    }
  });

  // ── Test Stripe Connection ────────────────────────────────────────────
  app.post("/api/admin/test-stripe", requireAuth, async (req: Request, res: Response) => {
    try {
      const secretKey = (req.body.secretKey || "").toString().trim();
      if (!secretKey) {
        res.json({ ok: false, message: "Stripe Secret Key is required." }); return;
      }
      if (!/^sk_(live|test)_[a-zA-Z0-9]{10,}$/.test(secretKey)) {
        res.json({ ok: false, message: "Invalid Stripe key format (must start with sk_live_ or sk_test_)." }); return;
      }
      // Call Stripe balance endpoint — lightweight and doesn't modify anything
      const stripeRes = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      if (stripeRes.ok) {
        const data = await stripeRes.json() as any;
        const isLive = secretKey.startsWith("sk_live_");
        const mode = isLive ? "Live" : "Test";
        const available = data.available?.[0];
        const balanceStr = available
          ? `Balance: ${(available.amount / 100).toFixed(2)} ${available.currency.toUpperCase()}`
          : "Balance retrieved";
        res.json({ ok: true, message: `✓ Connected (${mode} Mode) — ${balanceStr}` });
      } else {
        const errData = await stripeRes.json().catch(() => ({})) as any;
        const msg = errData?.error?.message || `HTTP ${stripeRes.status}`;
        res.json({ ok: false, message: `Connection failed: ${msg}` });
      }
    } catch (err: any) {
      res.json({ ok: false, message: `Error: ${err?.message || "Unknown error"}` });
    }
  });

    // ── Save Per-Phone OTP Overrides ───────────────────────────────────────────
  app.post("/api/admin/save-phone-otp-overrides", requireAuth, async (req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.json({ ok: false, message: "DB unavailable" }); return; }
      const overrides = req.body.overrides;
      if (typeof overrides !== "object" || overrides === null || Array.isArray(overrides)) {
        res.json({ ok: false, message: "Invalid overrides format" }); return;
      }
      // Validate: keys are phone strings, values are 4-8 digit codes
      const cleaned: Record<string, string> = {};
      for (const [phone, code] of Object.entries(overrides)) {
        const p = phone.trim();
        const c = String(code).trim();
        if (p && c && /^[0-9]{4,8}$/.test(c)) {
          cleaned[p] = c;
        }
      }
      const value = JSON.stringify(cleaned);
      // Upsert the TWILIO_PER_PHONE_OTP key
      const existing = await dbase.select().from(platformConfig).where(eq(platformConfig.configKey, "TWILIO_PER_PHONE_OTP")).limit(1);
      if (existing.length > 0) {
        await dbase.update(platformConfig).set({ configValue: value, updatedAt: new Date() }).where(eq(platformConfig.configKey, "TWILIO_PER_PHONE_OTP"));
      } else {
        await dbase.insert(platformConfig).values({ configKey: "TWILIO_PER_PHONE_OTP", configValue: value, isSensitive: false, description: "Per-phone static OTP overrides (JSON map of phone->code)" });
      }
      // Invalidate cache
      invalidatePlanCache();
      const sessionId = getSessionFromCookie(req);
      const session = sessionId ? sessions.get(sessionId) : null;
      const actor = session?.user || "admin";
      await writeAuditLog(actor, "platform_config", `Updated per-phone OTP overrides (${Object.keys(cleaned).length} entries)`);
      res.json({ ok: true, message: `Saved ${Object.keys(cleaned).length} override(s)` });
    } catch (err: any) {
      console.error("[Admin] Save phone OTP overrides error:", err);
      res.json({ ok: false, message: err?.message || "Unknown error" });
    }
  });

  // ── Audit Log ─────────────────────────────────────────────────────
  app.get("/api/admin/audit-log", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).json({ error: "DB unavailable" }); return; }
      const logs = await dbase
        .select()
        .from(adminAuditLog)
        .orderBy(sql`createdAt DESC`)
        .limit(50);
      res.json(logs);
    } catch (err) {
      console.error("[Admin] Audit log fetch error:", err);
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  // ── Financial / Revenue Analytics ────────────────────────────────────
  app.get("/api/admin/financial", requireAuth, async (_req: Request, res: Response) => {
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send(errorPage("DB unavailable")); return; }

      const allAppts = await dbase.select().from(appointments);
      const allBiz = await dbase.select().from(businessOwners);
      const allPlans = await dbase.select().from(subscriptionPlans);
      // Fetch expenses
      const allExpenses = await (dbase as any).select().from(adminExpenses).catch(() => [] as any[]);

      // Plan price map
      const planPriceMap: Record<string, { monthly: number; yearly: number }> = {};
      allPlans.forEach((p) => {
        planPriceMap[p.planKey] = {
          monthly: parseFloat(p.monthlyPrice as string) || 0,
          yearly: parseFloat((p as any).yearlyPrice as string) || 0,
        };
      });

      // Monthly appointment revenue (last 24 months)
      const monthlyRevMap: Record<string, number> = {};
      const monthlyApptCountMap: Record<string, number> = {};
      const now = new Date();
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevMap[key] = 0;
        monthlyApptCountMap[key] = 0;
      }
      allAppts.forEach((a) => {
        if (!a.createdAt) return;
        const d = new Date(a.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyRevMap[key] !== undefined) {
          monthlyRevMap[key] += parseFloat(String((a as any).totalPrice ?? 0)) || 0;
          monthlyApptCountMap[key] = (monthlyApptCountMap[key] || 0) + 1;
        }
      });

      // Yearly revenue summary (last 5 years)
      const yearlyRevMap: Record<string, { apptRev: number; subRev: number; apptCount: number }> = {};
      for (let y = now.getFullYear() - 4; y <= now.getFullYear(); y++) {
        yearlyRevMap[String(y)] = { apptRev: 0, subRev: 0, apptCount: 0 };
      }
      allAppts.forEach((a) => {
        if (!a.createdAt) return;
        const yr = String(new Date(a.createdAt).getFullYear());
        if (yearlyRevMap[yr]) {
          yearlyRevMap[yr].apptRev += parseFloat(String((a as any).totalPrice ?? 0)) || 0;
          yearlyRevMap[yr].apptCount++;
        }
      });
      // Estimate subscription revenue per year from business join date
      allBiz.forEach((b) => {
        if (!b.createdAt) return;
        const prices = planPriceMap[b.subscriptionPlan] || { monthly: 0, yearly: 0 };
        const monthlyPrice = b.subscriptionPeriod === 'yearly'
          ? (prices.yearly > 0 ? prices.yearly / 12 : prices.monthly)
          : prices.monthly;
        if (monthlyPrice === 0) return;
        const joinDate = new Date(b.createdAt);
        const endDate = b.subscriptionStatus === 'expired' && b.updatedAt ? new Date(b.updatedAt) : now;
        // Distribute monthly revenue across years
        let cursor = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);
        while (cursor <= endDate) {
          const yr = String(cursor.getFullYear());
          if (yearlyRevMap[yr]) {
            yearlyRevMap[yr].subRev += monthlyPrice;
          }
          cursor.setMonth(cursor.getMonth() + 1);
        }
      });

      // Quarterly breakdown for current year
      const currentYear = now.getFullYear();
      const quarters: Array<{ label: string; apptRev: number; subRev: number; apptCount: number }> = [
        { label: 'Q1 (Jan-Mar)', apptRev: 0, subRev: 0, apptCount: 0 },
        { label: 'Q2 (Apr-Jun)', apptRev: 0, subRev: 0, apptCount: 0 },
        { label: 'Q3 (Jul-Sep)', apptRev: 0, subRev: 0, apptCount: 0 },
        { label: 'Q4 (Oct-Dec)', apptRev: 0, subRev: 0, apptCount: 0 },
      ];
      allAppts.forEach((a) => {
        if (!a.createdAt) return;
        const d = new Date(a.createdAt);
        if (d.getFullYear() !== currentYear) return;
        const q = Math.floor(d.getMonth() / 3);
        quarters[q].apptRev += parseFloat(String((a as any).totalPrice ?? 0)) || 0;
        quarters[q].apptCount++;
      });
      // Add subscription revenue to quarters
      allBiz.forEach((b) => {
        if (!b.createdAt) return;
        const prices = planPriceMap[b.subscriptionPlan] || { monthly: 0, yearly: 0 };
        const monthlyPrice = b.subscriptionPeriod === 'yearly'
          ? (prices.yearly > 0 ? prices.yearly / 12 : prices.monthly)
          : prices.monthly;
        if (monthlyPrice === 0) return;
        const joinDate = new Date(b.createdAt);
        const endDate = b.subscriptionStatus === 'expired' && b.updatedAt ? new Date(b.updatedAt) : now;
        for (let m = 0; m < 12; m++) {
          const d = new Date(currentYear, m, 1);
          if (d >= joinDate && d <= endDate) {
            quarters[Math.floor(m / 3)].subRev += monthlyPrice;
          }
        }
      });

      // Monthly data array
      const monthlyData = Object.entries(monthlyRevMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, rev]) => ({ month, rev, apptCount: monthlyApptCountMap[month] || 0 }));

      // Yearly data array
      const yearlyData = Object.entries(yearlyRevMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([year, d]) => ({ year, apptRev: d.apptRev, subRev: d.subRev, total: d.apptRev + d.subRev, apptCount: d.apptCount }));

      // Total revenue this year
      const thisYearData = yearlyRevMap[String(currentYear)] || { apptRev: 0, subRev: 0, apptCount: 0 };
      const thisYearTotal = thisYearData.apptRev + thisYearData.subRev;

      // Tax estimates (US self-employment estimate: ~30% effective rate)
      const TAX_RATE = 0.30;
      const estimatedTax = thisYearTotal * TAX_RATE;
      const quarterlyTaxEst = estimatedTax / 4;

      // Expense totals
      const thisYearExpenses = allExpenses
        .filter((e: any) => e.date && e.date.startsWith(String(currentYear)))
        .reduce((s: number, e: any) => s + (parseFloat(String(e.amount)) || 0), 0);
      const expensesByMonth: Record<string, number> = {};
      const expensesByCategory: Record<string, number> = {};
      allExpenses.forEach((e: any) => {
        if (!e.date) return;
        const mo = e.date.substring(0, 7);
        expensesByMonth[mo] = (expensesByMonth[mo] || 0) + (parseFloat(String(e.amount)) || 0);
        expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + (parseFloat(String(e.amount)) || 0);
      });

      res.send(financialPage({
        monthlyData,
        yearlyData,
        quarters,
        thisYearTotal,
        thisYearApptRev: thisYearData.apptRev,
        thisYearSubRev: thisYearData.subRev,
        estimatedTax,
        quarterlyTaxEst,
        currentYear,
        expenses: allExpenses,
        thisYearExpenses,
        expensesByMonth,
        expensesByCategory,
      }));
    } catch (err) {
      console.error("[Admin] Financial error:", err);
      res.status(500).send(errorPage("Failed to load financial data"));
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
      .nav-section-label { padding: 14px 20px 4px; font-size: 10px; font-weight: 700; letter-spacing: 1px; color: var(--text-muted); text-transform: uppercase; opacity: 0.6; }
      .search-bar { display:flex; gap:8px; margin-bottom:16px; }
      .search-bar input { flex:1; padding:8px 14px; border:1px solid var(--border); border-radius:8px; background:var(--bg-card); color:var(--text); font-size:14px; outline:none; }
      .search-bar input:focus { border-color:var(--primary); }
      .search-bar select { padding:8px 12px; border:1px solid var(--border); border-radius:8px; background:var(--bg-card); color:var(--text); font-size:14px; outline:none; cursor:pointer; }
      .search-bar select:focus { border-color:var(--primary); }
      .biz-table-row:hover td { background:var(--bg-hover); }
      .quick-actions { display:flex; gap:6px; }
      .plan-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:5px; vertical-align:middle; }

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
      .btn-sm { display: inline-flex; align-items: center; padding: 5px 10px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-hover); color: var(--text); cursor: pointer; text-decoration: none; transition: all 0.15s; }
      .btn-sm:hover { border-color: var(--primary); color: var(--primary); text-decoration: none; }

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

function navItem(href: string, icon: string, label: string, active: boolean): string {
  return `<a href="${href}" class="nav-item ${active ? 'active' : ''}" title="${label}"><span class="nav-icon">${icon}</span> ${label}</a>`;
}

function navSection(label: string): string {
  return `<div class="nav-section-label">${label}</div>`;
}

function sidebarHtml(activePage: string): string {
  const a = activePage;
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

      ${navItem('/api/admin', '📊', 'Dashboard', a === 'dashboard')}

      ${navSection('BUSINESS MANAGEMENT')}
      ${navItem('/api/admin/businesses', '🏢', 'Businesses', a === 'businesses')}
      ${navItem('/api/admin/clients', '👥', 'Clients', a === 'clients')}
      ${navItem('/api/admin/appointments', '📅', 'Appointments', a === 'appointments')}
      ${navItem('/api/admin/staff', '👤', 'Staff', a === 'staff')}
      ${navItem('/api/admin/locations', '📍', 'Locations', a === 'locations')}

      ${navSection('CATALOG')}
      ${navItem('/api/admin/discounts', '🏷️', 'Discounts', a === 'discounts')}
      ${navItem('/api/admin/giftcards', '🎁', 'Gift Cards', a === 'giftcards')}
      ${navItem('/api/admin/reviews', '⭐', 'Reviews', a === 'reviews')}
      ${navItem('/api/admin/products', '📦', 'Products', a === 'products')}

      ${navSection('ANALYTICS')}
      ${navItem('/api/admin/analytics', '📈', 'Analytics', a === 'analytics')}
      ${navItem('/api/admin/financial', '💰', 'Financial', a === 'financial')}

      ${navSection('SAAS')}
      ${navItem('/api/admin/subscriptions', '💳', 'Subscriptions', a === 'subscriptions')}
      ${navItem('/api/admin/plans', '📋', 'Plan Pricing', a === 'plans')}

      ${navSection('SYSTEM')}
      ${navItem('/api/admin/platform-config', '🔧', 'Platform Config', a === 'platform-config')}
      ${navItem('/api/admin/settings', '⚙️', 'Settings', a === 'settings')}
      ${navItem('/api/admin/db', '🗄️', 'DB Explorer', a === 'db')}

      <div style="margin-top:auto;padding-top:20px;border-top:1px solid var(--border);margin-top:20px;">
        <a href="/api/admin/logout" class="nav-item" style="color:var(--danger);">
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
  planDist: Record<string, number>;
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

    <!-- Plan Distribution Bar -->
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <h3 style="margin:0;">Plan Distribution</h3>
        <a href="/api/admin/businesses" style="font-size:12px;color:var(--primary);text-decoration:none;">View all businesses &rarr;</a>
      </div>
      ${(() => {
        const plans = [
          { key: 'solo',       label: 'Solo',       color: '#6b7280' },
          { key: 'growth',     label: 'Growth',     color: '#0a7ea4' },
          { key: 'studio',     label: 'Studio',     color: '#7c3aed' },
          { key: 'enterprise', label: 'Enterprise', color: '#059669' },
        ];
        const total = Math.max(Object.values(data.planDist).reduce((s, v) => s + v, 0), 1);
        const chips = plans.map(p => {
          const count = data.planDist[p.key] || 0;
          const pct = ((count / total) * 100).toFixed(1);
          return `<div style="display:flex;align-items:center;gap:6px;">
            <span style="width:10px;height:10px;border-radius:50%;background:${p.color};display:inline-block;flex-shrink:0;"></span>
            <span style="font-size:13px;font-weight:600;color:${p.color};">${count}</span>
            <span style="font-size:12px;color:var(--text-muted);">${p.label}</span>
            <span style="font-size:11px;color:var(--text-muted);">(${pct}%)</span>
          </div>`;
        }).join('');
        const segments = plans.map(p => {
          const count = data.planDist[p.key] || 0;
          const pct = (count / total) * 100;
          return pct > 0 ? `<div style="flex:${pct};background:${p.color};height:100%;min-width:${pct > 0 ? '4px' : '0'};transition:flex 0.3s;"></div>` : '';
        }).join('');
        return `
          <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px;">${chips}</div>
          <div style="display:flex;height:10px;border-radius:6px;overflow:hidden;background:var(--border);">${segments}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">${total} business${total !== 1 ? 'es' : ''} total</div>
        `;
      })()}
    </div>

    <!-- Audit Log Panel -->
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h3 style="margin:0;">🔍 Recent Config Changes</h3>
        <button onclick="loadAuditLog()" id="auditRefreshBtn" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:var(--text-muted);">↻ Refresh</button>
      </div>
      <div id="auditLogContainer">
        <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">Loading...</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
          <h3 style="margin:0;">Recent Businesses</h3>
          <a href="/api/admin/businesses" style="font-size:12px;color:var(--primary);text-decoration:none;white-space:nowrap;">View all &rarr;</a>
        </div>
        ${data.recentBusinesses.length === 0
          ? '<div class="empty-state"><p>No businesses yet</p></div>'
          : `<div style="margin-bottom:10px;">
              <input
                id="dashBizSearch"
                type="text"
                placeholder="&#128269; Search by name or phone..."
                oninput="filterDashBiz()"
                style="width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg-hover);color:var(--text);outline:none;"
              />
            </div>
            <table id="dashBizTable">
              <thead><tr><th>Name</th><th>Phone</th><th>Created</th></tr></thead>
              <tbody id="dashBizTbody">
                ${data.recentBusinesses
                  .map(
                    (b: any) =>
                      `<tr class="dash-biz-row" data-name="${escHtml((b.businessName || '').toLowerCase())}" data-phone="${escHtml((b.phone || '').toLowerCase())}">
                        <td><a href="/api/admin/businesses/${b.id}">${escHtml(b.businessName)}</a></td>
                        <td>${escHtml(b.phone || 'N/A')}</td>
                        <td>${fmtDate(b.createdAt)}</td>
                      </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
            <div id="dashBizEmpty" style="display:none;padding:16px 0;text-align:center;font-size:13px;color:var(--text-muted);">No businesses match your search.</div>`
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

    <script>
    const CATEGORY_ICONS = { platform_config: '⚙️', plan_pricing: '💰', subscription_override: '🔑', expense: '💸' };
    const CATEGORY_LABELS = { platform_config: 'Platform Config', plan_pricing: 'Plan Pricing', subscription_override: 'Subscription Override', expense: 'Expense' };
    function timeAgo(dateStr) {
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diff < 60) return diff + 's ago';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return Math.floor(diff / 86400) + 'd ago';
    }
    async function loadAuditLog() {
      const container = document.getElementById('auditLogContainer');
      const btn = document.getElementById('auditRefreshBtn');
      if (btn) btn.textContent = '⏳ Loading...';
      try {
        const res = await fetch('/api/admin/audit-log');
        const logs = await res.json();
        if (!Array.isArray(logs) || logs.length === 0) {
          container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No config changes recorded yet. Changes will appear here after you save Platform Config, Plan Pricing, or Subscription Overrides.</div>';
        } else {
          container.innerHTML = '<table style="font-size:13px;"><thead><tr><th>When</th><th>Category</th><th>Action</th><th>By</th></tr></thead><tbody>' +
            logs.slice(0, 20).map(log => {
              const icon = CATEGORY_ICONS[log.category] || '📝';
              const label = CATEGORY_LABELS[log.category] || log.category;
              return '<tr>' +
                '<td style="white-space:nowrap;color:var(--text-muted);">' + timeAgo(log.createdAt) + '</td>' +
                '<td><span style="white-space:nowrap;">' + icon + ' ' + label + '</span></td>' +
                '<td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (log.action || '') + '</td>' +
                '<td style="white-space:nowrap;color:var(--text-muted);">' + (log.actor || 'admin') + '</td>' +
                '</tr>';
            }).join('') +
            '</tbody></table>';
        }
      } catch (e) {
        container.innerHTML = '<div style="color:var(--danger);padding:12px;">Failed to load audit log.</div>';
      }
      if (btn) btn.textContent = '\u21bb Refresh';
    }
    loadAuditLog();

    function filterDashBiz() {
      var q = (document.getElementById('dashBizSearch').value || '').toLowerCase();
      var rows = document.querySelectorAll('#dashBizTbody .dash-biz-row');
      var visible = 0;
      rows.forEach(function(row) {
        var name = row.getAttribute('data-name') || '';
        var phone = row.getAttribute('data-phone') || '';
        var show = !q || name.includes(q) || phone.includes(q);
        row.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      var empty = document.getElementById('dashBizEmpty');
      var table = document.getElementById('dashBizTable');
      if (empty) empty.style.display = visible === 0 ? 'block' : 'none';
      if (table) table.style.display = visible === 0 ? 'none' : '';
    }
    </script>
  `);
}

// ─── Businesses Page ───────────────────────────────────────────────
function planColor(plan: string): string {
  const colors: Record<string, string> = { solo: '#6b7280', growth: '#0a7ea4', studio: '#7c3aed', enterprise: '#059669' };
  return colors[plan] || '#6b7280';
}

function businessesPage(businesses: any[]): string {
  const planCounts: Record<string, number> = { solo: 0, growth: 0, studio: 0, enterprise: 0 };
  businesses.forEach((b) => { const p = b.subscriptionPlan || 'solo'; if (planCounts[p] !== undefined) planCounts[p]++; else planCounts[p] = 1; });
  const openCount = businesses.filter((b) => !b.temporaryClosed).length;
  const closedCount = businesses.filter((b) => b.temporaryClosed).length;
  const overrideCount = businesses.filter((b) => b.adminOverride).length;
  const trialCount = businesses.filter((b) => (b.subscriptionStatus || 'free') === 'trial').length;
  const activeCount = businesses.filter((b) => (b.subscriptionStatus || 'free') === 'active').length;

  const rows = businesses.map((b) => {
    const plan = b.subscriptionPlan || 'solo';
    const status = b.subscriptionStatus || 'free';
    const statusColor = status === 'active' ? '#059669' : status === 'trial' ? '#f59e0b' : status === 'expired' ? '#ef4444' : '#6b7280';
    const pc = planColor(plan);
    // Initials avatar from business name
    const initials = (b.businessName || '?').split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase() || '').join('');
    return `<tr class="biz-row" data-name="${escHtml((b.businessName || '').toLowerCase())}" data-phone="${escHtml((b.phone || '').toLowerCase())}" data-plan="${plan}" data-status="${status}" data-open="${b.temporaryClosed ? 'closed' : 'open'}" style="border-bottom:1px solid var(--border);">
      <td style="padding:0;width:4px;"><div style="width:4px;height:100%;min-height:64px;background:${pc};border-radius:2px 0 0 2px;"></div></td>
      <td style="padding:12px 16px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:38px;height:38px;border-radius:50%;background:${pc}22;color:${pc};font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1.5px solid ${pc}44;">${initials}</div>
          <div>
            <div style="font-weight:600;font-size:14px;"><a href="/api/admin/businesses/${b.id}" style="color:var(--text);text-decoration:none;">${escHtml(b.businessName)}</a></div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${escHtml(b.email || b.phone || '—')}</div>
          </div>
        </div>
      </td>
      <td style="padding:12px 16px;font-size:13px;color:var(--text-muted);">${escHtml(b.phone || '—')}</td>
      <td style="padding:12px 16px;"><span style="background:${pc}18;color:${pc};padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600;border:1px solid ${pc}33;">${plan.charAt(0).toUpperCase() + plan.slice(1)}${b.adminOverride ? ' ⭐' : ''}</span></td>
      <td style="padding:12px 16px;"><span style="background:${statusColor}18;color:${statusColor};padding:3px 10px;border-radius:10px;font-size:12px;font-weight:500;border:1px solid ${statusColor}33;">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
      <td style="padding:12px 16px;">${b.temporaryClosed ? '<span class="badge badge-danger" style="font-size:11px;">Closed</span>' : '<span class="badge badge-success" style="font-size:11px;">Open</span>'}</td>
      <td style="padding:12px 16px;font-size:12px;color:var(--text-muted);">${fmtDate(b.createdAt)}</td>
      <td style="padding:12px 16px;"><a href="/api/admin/businesses/${b.id}" class="btn btn-secondary btn-sm">Details →</a></td>
    </tr>`;
  }).join('');

  return adminLayout('Businesses', 'businesses', `
    <div class="page-header">
      <div>
        <h2>Businesses</h2>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${businesses.length} total &nbsp;·&nbsp; ${openCount} open &nbsp;·&nbsp; ${closedCount} closed &nbsp;·&nbsp; ${trialCount} on trial &nbsp;·&nbsp; ${activeCount} active &nbsp;·&nbsp; ${overrideCount} complimentary</div>
      </div>
    </div>

    <!-- Search + Sort + Filter bar -->
    <div class="search-bar">
      <input type="text" id="bizSearch" placeholder="🔍 Search by name or phone..." oninput="filterBiz()" style="max-width:320px;">
      <select id="bizPlanFilter" onchange="filterBiz()">
        <option value="">All Plans</option>
        <option value="solo">Solo</option>
        <option value="growth">Growth</option>
        <option value="studio">Studio</option>
        <option value="enterprise">Enterprise</option>
      </select>
      <select id="bizStatusFilter" onchange="filterBiz()">
        <option value="">All Statuses</option>
        <option value="free">Free</option>
        <option value="trial">Trial</option>
        <option value="active">Active</option>
        <option value="expired">Expired</option>
      </select>
      <select id="bizOpenFilter" onchange="filterBiz()">
        <option value="">Open &amp; Closed</option>
        <option value="open">Open Only</option>
        <option value="closed">Closed Only</option>
      </select>
      <select id="bizSort" onchange="sortBiz()">
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="name">Name A→Z</option>
        <option value="name-desc">Name Z→A</option>
      </select>
    </div>

    <!-- Plan summary chips -->
    <div class="filter-bar" style="margin-bottom:20px;">
      <span class="filter-btn" onclick="document.getElementById('bizPlanFilter').value='';filterBiz()" style="cursor:pointer;">All (${businesses.length})</span>
      <span class="filter-btn" onclick="document.getElementById('bizPlanFilter').value='solo';filterBiz()" style="cursor:pointer;"><span class="plan-dot" style="background:#6b7280;"></span>Solo (${planCounts.solo})</span>
      <span class="filter-btn" onclick="document.getElementById('bizPlanFilter').value='growth';filterBiz()" style="cursor:pointer;"><span class="plan-dot" style="background:#0a7ea4;"></span>Growth (${planCounts.growth})</span>
      <span class="filter-btn" onclick="document.getElementById('bizPlanFilter').value='studio';filterBiz()" style="cursor:pointer;"><span class="plan-dot" style="background:#7c3aed;"></span>Studio (${planCounts.studio})</span>
      <span class="filter-btn" onclick="document.getElementById('bizPlanFilter').value='enterprise';filterBiz()" style="cursor:pointer;"><span class="plan-dot" style="background:#059669;"></span>Enterprise (${planCounts.enterprise})</span>
    </div>

    <div class="card" style="padding:0;overflow:hidden;">
      <table id="bizTable">
        <thead>
          <tr style="background:var(--bg-hover);">
            <th style="padding:0;width:4px;"></th>
            <th style="padding:12px 16px;">Business</th>
            <th style="padding:12px 16px;">Phone</th>
            <th style="padding:12px 16px;">Plan</th>
            <th style="padding:12px 16px;">Status</th>
            <th style="padding:12px 16px;">Booking</th>
            <th style="padding:12px 16px;">Created</th>
            <th style="padding:12px 16px;">Action</th>
          </tr>
        </thead>
        <tbody id="bizTbody">
          ${businesses.length === 0
            ? '<tr><td colspan="8" style="padding:40px;text-align:center;color:var(--text-muted);">No businesses registered yet</td></tr>'
            : rows
          }
        </tbody>
      </table>
    </div>
    <div id="bizEmpty" style="display:none;padding:40px;text-align:center;color:var(--text-muted);">No businesses match your filters.</div>

    <script>
      function filterBiz() {
        const q = document.getElementById('bizSearch').value.toLowerCase();
        const plan = document.getElementById('bizPlanFilter').value;
        const status = document.getElementById('bizStatusFilter').value;
        const open = document.getElementById('bizOpenFilter').value;
        let visible = 0;
        document.querySelectorAll('#bizTbody .biz-row').forEach(function(row) {
          const name = row.getAttribute('data-name') || '';
          const phone = row.getAttribute('data-phone') || '';
          const rowPlan = row.getAttribute('data-plan') || '';
          const rowStatus = row.getAttribute('data-status') || '';
          const rowOpen = row.getAttribute('data-open') || '';
          const matchQ = !q || name.includes(q) || phone.includes(q);
          const matchPlan = !plan || rowPlan === plan;
          const matchStatus = !status || rowStatus === status;
          const matchOpen = !open || rowOpen === open;
          const show = matchQ && matchPlan && matchStatus && matchOpen;
          row.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        document.getElementById('bizEmpty').style.display = visible === 0 ? 'block' : 'none';
        document.getElementById('bizTable').style.display = visible === 0 ? 'none' : '';
      }
      function sortBiz() {
        const sort = document.getElementById('bizSort').value;
        const tbody = document.getElementById('bizTbody');
        const rows = Array.from(tbody.querySelectorAll('.biz-row'));
        rows.sort(function(a, b) {
          if (sort === 'name') return (a.getAttribute('data-name') || '').localeCompare(b.getAttribute('data-name') || '');
          if (sort === 'name-desc') return (b.getAttribute('data-name') || '').localeCompare(a.getAttribute('data-name') || '');
          // For date sorts, use row index as proxy (server already sorted by date)
          const ai = Array.from(tbody.children).indexOf(a);
          const bi = Array.from(tbody.children).indexOf(b);
          if (sort === 'oldest') return ai - bi; // already newest first from server, so oldest = reverse
          return 0; // newest = keep server order
        });
        if (sort === 'oldest') rows.reverse();
        rows.forEach(function(r) { tbody.appendChild(r); });
      }
    </script>
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
        <button id="saveSubBtn" type="submit" disabled style="background:var(--border);color:var(--text-muted);padding:10px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:not-allowed;transition:background 0.2s,color 0.2s;">💾 Save Subscription Settings</button>
      </form>
    </div>
    <script>
    (function() {
      var form = document.querySelector('form[action*="/override"]');
      var btn = document.getElementById('saveSubBtn');
      if (!form || !btn) return;
      var initial = {};
      form.querySelectorAll('input, select').forEach(function(el) {
        var key = el.name || el.id;
        if (!key) return;
        initial[key] = el.type === 'checkbox' ? el.checked : el.value;
      });
      function checkDirty() {
        var dirty = false;
        form.querySelectorAll('input, select').forEach(function(el) {
          var key = el.name || el.id;
          if (!key) return;
          var cur = el.type === 'checkbox' ? el.checked : el.value;
          if (cur !== initial[key]) dirty = true;
        });
        if (dirty) { btn.disabled = false; btn.style.background = 'var(--primary)'; btn.style.color = 'white'; btn.style.cursor = 'pointer'; }
        else { btn.disabled = true; btn.style.background = 'var(--border)'; btn.style.color = 'var(--text-muted)'; btn.style.cursor = 'not-allowed'; }
      }
      form.addEventListener('input', checkDirty);
      form.addEventListener('change', checkDirty);
    })();
    </script>
  `);
}

// ─── Clients Page ───────────────────────────────────────────────────
function clientsPage(allClients: any[], allBiz: any[]): string {
  const bizMap = new Map(allBiz.map((b: any) => [b.id, b.businessName]));
  const bizOptions = allBiz.map((b: any) => `<option value="${b.id}">${escHtml(b.businessName)}</option>`).join('');

  const rows = allClients.map((c: any) => `<tr class="cli-row" data-name="${escHtml((c.name || '').toLowerCase())}" data-phone="${escHtml((c.phone || '').toLowerCase())}" data-email="${escHtml((c.email || '').toLowerCase())}" data-biz="${c.businessOwnerId}">
    <td style="font-weight:500;">${escHtml(c.name)}</td>
    <td style="font-size:13px;color:var(--text-muted);">${c.phone || '—'}</td>
    <td style="font-size:13px;">${c.email || '—'}</td>
    <td><a href="/api/admin/businesses/${c.businessOwnerId}" style="color:var(--primary);">${escHtml(bizMap.get(c.businessOwnerId) || 'Unknown')}</a></td>
    <td style="font-size:12px;color:var(--text-muted);">${fmtDate(c.createdAt)}</td>
    <td><form class="delete-form" method="POST" action="/api/admin/delete/client/${c.id}" onsubmit="return confirm('Delete client ${escHtml(c.name)}? This will also delete their appointments and reviews.')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
  </tr>`).join('');

  return adminLayout('Clients', 'clients', `
    <div class="page-header">
      <div>
        <h2>Clients</h2>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${allClients.length} total across ${allBiz.length} businesses</div>
      </div>
    </div>
    <div class="search-bar">
      <input type="text" id="cliSearch" placeholder="🔍 Search by name, phone, or email..." oninput="filterCli()" style="max-width:340px;">
      <select id="cliBizFilter" onchange="filterCli()">
        <option value="">All Businesses</option>
        ${bizOptions}
      </select>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <table id="cliTable">
        <thead>
          <tr style="background:var(--bg-hover);">
            <th style="padding:12px 16px;">Name</th>
            <th style="padding:12px 16px;">Phone</th>
            <th style="padding:12px 16px;">Email</th>
            <th style="padding:12px 16px;">Business</th>
            <th style="padding:12px 16px;">Created</th>
            <th style="padding:12px 16px;">Actions</th>
          </tr>
        </thead>
        <tbody id="cliTbody">
          ${allClients.length === 0 ? '<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text-muted);">No clients yet</td></tr>' : rows}
        </tbody>
      </table>
    </div>
    <div id="cliEmpty" style="display:none;padding:40px;text-align:center;color:var(--text-muted);">No clients match your filters.</div>
    <script>
      function filterCli() {
        const q = document.getElementById('cliSearch').value.toLowerCase();
        const biz = document.getElementById('cliBizFilter').value;
        let visible = 0;
        document.querySelectorAll('#cliTbody .cli-row').forEach(function(row) {
          const name = row.getAttribute('data-name') || '';
          const phone = row.getAttribute('data-phone') || '';
          const email = row.getAttribute('data-email') || '';
          const rowBiz = row.getAttribute('data-biz') || '';
          const show = (!q || name.includes(q) || phone.includes(q) || email.includes(q)) && (!biz || rowBiz === biz);
          row.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        document.getElementById('cliEmpty').style.display = visible === 0 ? 'block' : 'none';
        document.getElementById('cliTable').style.display = visible === 0 ? 'none' : '';
      }
    </script>
  `);
}

// ─── Appointments Page ──────────────────────────────────────────────
function appointmentsPage(allAppts: any[], allBiz: any[], allCli: any[], allSvc: any[], statusFilter: string, bizFilter = "", searchQ = "", page = 1, totalPages = 1, totalCount = 0): string {
  const bizMap = new Map(allBiz.map((b: any) => [b.id, b.businessName]));
  const cliMap = new Map(allCli.map((c: any) => [`${c.businessOwnerId}-${c.localId}`, c.name]));
  const svcMap = new Map(allSvc.map((s: any) => [`${s.businessOwnerId}-${s.localId}`, s.name]));
  const statuses = ['', 'pending', 'confirmed', 'completed', 'cancelled'];
  const statusLabels = ['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'];
  const bizOptions = allBiz.map((b: any) => `<option value="${b.id}">${escHtml(b.businessName)}</option>`).join('');

  const rows = allAppts.map((a: any) => {
    const bc = a.status === 'confirmed' ? '#059669' : a.status === 'pending' ? '#f59e0b' : a.status === 'cancelled' ? '#ef4444' : '#3b82f6';
    const clientName = cliMap.get(`${a.businessOwnerId}-${a.clientLocalId}`) || a.clientLocalId;
    const svcName = svcMap.get(`${a.businessOwnerId}-${a.serviceLocalId}`) || a.serviceLocalId;
    const bizName = bizMap.get(a.businessOwnerId) || 'Unknown';
    return `<tr class="appt-row" data-status="${a.status}" data-biz="${a.businessOwnerId}" data-search="${escHtml((clientName + ' ' + svcName + ' ' + bizName).toLowerCase())}">
      <td style="font-size:13px;font-weight:600;">${a.date}</td>
      <td style="font-size:13px;color:var(--text-muted);">${a.time}</td>
      <td>${escHtml(clientName)}</td>
      <td style="font-size:13px;">${escHtml(svcName)}</td>
      <td><a href="/api/admin/businesses/${a.businessOwnerId}" style="color:var(--primary);">${escHtml(bizName)}</a></td>
      <td style="font-size:13px;color:var(--text-muted);">${a.duration} min</td>
      <td><span style="background:${bc}20;color:${bc};padding:2px 8px;border-radius:10px;font-size:12px;">${a.status}</span></td>
      <td><form class="delete-form" method="POST" action="/api/admin/delete/appointment/${a.id}" onsubmit="return confirm('Delete this appointment?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
    </tr>`;
  }).join('');

  // Build pagination URL helper
  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (bizFilter) params.set('biz', bizFilter);
    if (searchQ) params.set('q', searchQ);
    params.set('page', String(p));
    return `/api/admin/appointments?${params.toString()}`;
  };
  const paginationHtml = totalPages > 1 ? `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--border);">
      <div style="font-size:13px;color:var(--text-muted);">Page ${page} of ${totalPages} &mdash; ${totalCount} total</div>
      <div style="display:flex;gap:6px;">
        ${page > 1 ? `<a href="${buildUrl(1)}" class="btn-sm">&#8676; First</a><a href="${buildUrl(page - 1)}" class="btn-sm">&lsaquo; Prev</a>` : ''}
        ${page < totalPages ? `<a href="${buildUrl(page + 1)}" class="btn-sm">Next &rsaquo;</a><a href="${buildUrl(totalPages)}" class="btn-sm">Last &#8677;</a>` : ''}
      </div>
    </div>` : '';

  return adminLayout('Appointments', 'appointments', `
    <div class="page-header">
      <div>
        <h2>Appointments</h2>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${totalCount} total &mdash; showing page ${page} of ${totalPages}</div>
      </div>
    </div>
    <!-- Status filter chips (server-side) -->
    <div class="filter-bar">
      ${statuses.map((s, i) => {
        const params = new URLSearchParams();
        if (s) params.set('status', s);
        if (bizFilter) params.set('biz', bizFilter);
        params.set('page', '1');
        return `<a href="/api/admin/appointments?${params.toString()}" class="filter-btn ${statusFilter === s ? 'active' : ''}">${statusLabels[i]}</a>`;
      }).join('')}
    </div>
    <!-- Server-side search + business filter form -->
    <form method="GET" action="/api/admin/appointments" class="search-bar" style="margin-top:12px;">
      <input type="hidden" name="status" value="${escHtml(statusFilter)}">
      <input type="hidden" name="page" value="1">
      <input type="text" name="q" value="${escHtml(searchQ)}" placeholder="🔍 Search client, service, or business..." style="max-width:340px;">
      <select name="biz" onchange="this.form.submit()">
        <option value="">All Businesses</option>
        ${allBiz.map((b: any) => `<option value="${b.id}" ${bizFilter === String(b.id) ? 'selected' : ''}>${escHtml(b.businessName)}</option>`).join('')}
      </select>
      <button type="submit" class="btn-sm">Search</button>
      ${(searchQ || bizFilter) ? `<a href="/api/admin/appointments${statusFilter ? '?status=' + statusFilter : ''}" class="btn-sm" style="background:var(--danger);color:#fff;">Clear</a>` : ''}
    </form>
    <div class="card" style="padding:0;overflow:hidden;margin-top:12px;">
      <table id="apptTable">
        <thead>
          <tr style="background:var(--bg-hover);">
            <th style="padding:12px 16px;">Date</th>
            <th style="padding:12px 16px;">Time</th>
            <th style="padding:12px 16px;">Client</th>
            <th style="padding:12px 16px;">Service</th>
            <th style="padding:12px 16px;">Business</th>
            <th style="padding:12px 16px;">Duration</th>
            <th style="padding:12px 16px;">Status</th>
            <th style="padding:12px 16px;">Actions</th>
          </tr>
        </thead>
        <tbody id="apptTbody">
          ${allAppts.length === 0 ? '<tr><td colspan="8" style="padding:40px;text-align:center;color:var(--text-muted);">No appointments found</td></tr>' : rows}
        </tbody>
      </table>
      ${paginationHtml}
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
  mrr: number;
  arr: number;
  totalApptRevenue: number;
  churnRate: number;
  recentlyChurned: number;
  planDist: Record<string, number>;
  signupsByWeek: { week: string; count: number }[];
  bizRevTable: { id: number; name: string; plan: string; status: string; revenue: number; apptCount: number; createdAt: Date | null }[];
  apptsByStatus: { status: string; count: number }[];
  apptsByMonth: { month: string; count: number }[];
  avgRating: number;
  totalBiz: number;
  activeBiz: number;
}): string {
  const maxApptMonth = Math.max(...data.apptsByMonth.map((m) => m.count), 1);
  const maxWeek = Math.max(...data.signupsByWeek.map((w) => w.count), 1);
  const planColors: Record<string, string> = { solo: '#6b7280', growth: '#0a7ea4', studio: '#7c3aed', enterprise: '#059669' };
  const totalPlanBiz = Object.values(data.planDist).reduce((s, v) => s + v, 0) || 1;

  return adminLayout("Analytics", "analytics", `
    <div class="page-header">
      <div>
        <h2>Analytics Dashboard</h2>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">Platform-wide metrics &mdash; updated on page load</div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════
         SECTION 1 — DEVELOPER / PLATFORM REVENUE
         This is YOUR income as the developer selling this SaaS to businesses.
    ═══════════════════════════════════════════════════════════════════════ -->
    <div style="margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:14px 18px;background:linear-gradient(135deg,#05966915,#0a7ea415);border-radius:12px;border:1px solid #05966930;">
        <div style="width:4px;height-36px;min-height:36px;background:linear-gradient(180deg,#059669,#0a7ea4);border-radius:2px;"></div>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text);">&#128200; Platform Revenue &mdash; Your SaaS Income</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Money you earn from businesses subscribing to Lime Of Time</div>
        </div>
        <div style="margin-left:auto;background:#05966920;color:#059669;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;letter-spacing:0.05em;">DEVELOPER VIEW</div>
      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));">
        <div class="stat-card" style="border-left:4px solid #059669;">
          <div class="stat-icon" style="color:#059669;">$</div>
          <div class="stat-label">MRR</div>
          <div class="stat-value" style="color:#059669;">\$${data.mrr.toFixed(2)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Monthly Recurring Revenue</div>
        </div>
        <div class="stat-card" style="border-left:4px solid #0a7ea4;">
          <div class="stat-icon" style="color:#0a7ea4;">&#128200;</div>
          <div class="stat-label">ARR</div>
          <div class="stat-value" style="color:#0a7ea4;">\$${data.arr.toFixed(2)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Annual Run Rate</div>
        </div>
        <div class="stat-card" style="border-left:4px solid ${data.churnRate > 10 ? '#ef4444' : '#f59e0b'};">
          <div class="stat-icon" style="color:${data.churnRate > 10 ? '#ef4444' : '#f59e0b'};">&#128197;</div>
          <div class="stat-label">Churn Rate</div>
          <div class="stat-value" style="color:${data.churnRate > 10 ? '#ef4444' : '#f59e0b'};">${data.churnRate}%</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${data.recentlyChurned} expired last 30d</div>
        </div>
        <div class="stat-card" style="border-left:4px solid #6b7280;">
          <div class="stat-icon">&#127970;</div>
          <div class="stat-label">Total Businesses</div>
          <div class="stat-value">${data.totalBiz}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${data.activeBiz} active / trial</div>
        </div>
      </div>

      <!-- Plan Distribution (SaaS) -->
      <div class="card" style="margin-top:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:18px;">&#127381;</span>
          <h3 style="margin:0;">Subscription Plan Distribution</h3>
          <span style="font-size:12px;color:var(--text-muted);margin-left:4px;">How many businesses are on each plan</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
          ${Object.entries(data.planDist).map(([plan, count]) => {
            const pct = Math.round((count / totalPlanBiz) * 100);
            const col = planColors[plan] || '#6b7280';
            return `
              <div style="background:var(--bg-hover);border-radius:10px;padding:14px 16px;border:1px solid ${col}30;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="font-size:14px;font-weight:700;color:${col};">${plan.charAt(0).toUpperCase() + plan.slice(1)}</span>
                  <span style="font-size:22px;font-weight:800;color:${col};">${count}</span>
                </div>
                <div style="height:6px;background:var(--bg);border-radius:3px;overflow:hidden;margin-bottom:6px;">
                  <div style="height:100%;width:${pct}%;background:${col};border-radius:3px;transition:width 0.4s;"></div>
                </div>
                <div style="font-size:11px;color:var(--text-muted);">${pct}% of all businesses</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- New Signups Per Week -->
      <div class="card" style="margin-top:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:18px;">&#128101;</span>
          <h3 style="margin:0;">New Business Signups Per Week</h3>
        </div>
        ${data.signupsByWeek.length === 0
          ? '<div class="empty-state"><p>No signups yet</p></div>'
          : data.signupsByWeek.map((w) => `
            <div class="chart-bar">
              <div class="chart-bar-label" style="min-width:80px;font-size:11px;">${w.week}</div>
              <div class="chart-bar-fill" style="width:${Math.max((w.count / maxWeek) * 100, w.count > 0 ? 8 : 2)}%;background:#059669;">
                ${w.count > 0 ? `<span class="chart-bar-value">${w.count}</span>` : ''}
              </div>
            </div>
          `).join('')}
      </div>
    </div>

    <!-- Divider -->
    <div style="display:flex;align-items:center;gap:12px;margin:28px 0 20px;">
      <div style="flex:1;height:1px;background:var(--border);"></div>
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;padding:0 8px;">&#8595; Business Owner Activity</div>
      <div style="flex:1;height:1px;background:var(--border);"></div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════
         SECTION 2 — BUSINESS OWNER ACTIVITY
         Aggregated operational data from all businesses using the app.
         This is what business owners see in their own dashboards.
    ═══════════════════════════════════════════════════════════════════════ -->
    <div style="margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:14px 18px;background:linear-gradient(135deg,#7c3aed15,#f59e0b15);border-radius:12px;border:1px solid #7c3aed30;">
        <div style="width:4px;min-height:36px;background:linear-gradient(180deg,#7c3aed,#f59e0b);border-radius:2px;"></div>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text);">&#128188; Business Owner Activity &mdash; Aggregated Across All Businesses</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Revenue and appointments generated by businesses using your app</div>
        </div>
        <div style="margin-left:auto;background:#7c3aed20;color:#7c3aed;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;letter-spacing:0.05em;">BUSINESS VIEW</div>
      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));">
        <div class="stat-card" style="border-left:4px solid #7c3aed;">
          <div class="stat-icon" style="color:#7c3aed;">&#128179;</div>
          <div class="stat-label">Total Appt Revenue</div>
          <div class="stat-value" style="color:#7c3aed;">\$${data.totalApptRevenue.toFixed(2)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">From completed bookings (all businesses)</div>
        </div>
        <div class="stat-card" style="border-left:4px solid #f59e0b;">
          <div class="stat-icon" style="color:#f59e0b;">&#11088;</div>
          <div class="stat-label">Avg Rating</div>
          <div class="stat-value" style="color:#f59e0b;">${Number(data.avgRating).toFixed(1)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Across all business reviews</div>
        </div>
        <div class="stat-card" style="border-left:4px solid #3b82f6;">
          <div class="stat-icon" style="color:#3b82f6;">&#128197;</div>
          <div class="stat-label">Total Appointments</div>
          <div class="stat-value" style="color:#3b82f6;">${data.apptsByStatus.reduce((s,x) => s + x.count, 0).toLocaleString()}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">All statuses combined</div>
        </div>
      </div>

      <!-- Charts: Appointments by Month + by Status -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
        <div class="card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <span style="font-size:18px;">&#128200;</span>
            <h3 style="margin:0;">Appointments by Month</h3>
          </div>
          ${data.apptsByMonth.length === 0
            ? '<div class="empty-state"><p>No data yet</p></div>'
            : data.apptsByMonth.map((m) => `
              <div class="chart-bar">
                <div class="chart-bar-label" style="min-width:80px;font-size:11px;">${m.month}</div>
                <div class="chart-bar-fill" style="width:${Math.max((m.count / maxApptMonth) * 100, 8)}%;background:#7c3aed;">
                  <span class="chart-bar-value">${m.count}</span>
                </div>
              </div>
            `).join('')}
        </div>
        <div class="card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <span style="font-size:18px;">&#9989;</span>
            <h3 style="margin:0;">Appointments by Status</h3>
          </div>
          ${data.apptsByStatus.map((s) => {
            const col = s.status === 'confirmed' ? '#059669' : s.status === 'pending' ? '#f59e0b' : s.status === 'cancelled' ? '#ef4444' : '#3b82f6';
            const total = data.apptsByStatus.reduce((sum, x) => sum + x.count, 0) || 1;
            const pct = Math.round((s.count / total) * 100);
            return `
              <div style="margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <span style="font-size:13px;font-weight:600;color:${col};">${s.status.charAt(0).toUpperCase() + s.status.slice(1)}</span>
                  <span style="font-size:12px;color:var(--text-muted);">${s.count.toLocaleString()} (${pct}%)</span>
                </div>
                <div style="height:8px;background:var(--bg-hover);border-radius:4px;overflow:hidden;">
                  <div style="height:100%;width:${pct}%;background:${col};border-radius:4px;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Per-Business Revenue Table -->
    <div class="card" style="margin-top:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">&#128203;</span>
          <h3 style="margin:0;">Revenue by Business</h3>
          <span style="font-size:12px;color:var(--text-muted);">Appointment revenue + subscription plan per business</span>
        </div>
        <div class="search-bar" style="margin:0;">
          <input type="text" id="bizRevSearch" placeholder="&#128269; Search by name..." oninput="filterBizRev()" style="max-width:220px;">
          <select id="bizRevPlanFilter" onchange="filterBizRev()">
            <option value="">All Plans</option>
            <option value="solo">Solo</option>
            <option value="growth">Growth</option>
            <option value="studio">Studio</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select id="bizRevStatusFilter" onchange="filterBizRev()">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
            <option value="free">Free</option>
          </select>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table id="bizRevTable">
          <thead>
            <tr style="background:var(--bg-hover);">
              <th style="padding:10px 14px;">Business</th>
              <th style="padding:10px 14px;">Plan</th>
              <th style="padding:10px 14px;">Status</th>
              <th style="padding:10px 14px;text-align:right;">Appt Revenue</th>
              <th style="padding:10px 14px;text-align:right;">Completed Appts</th>
              <th style="padding:10px 14px;">Joined</th>
              <th style="padding:10px 14px;">Actions</th>
            </tr>
          </thead>
          <tbody id="bizRevTbody">
            ${data.bizRevTable.length === 0
              ? '<tr><td colspan="7" style="padding:40px;text-align:center;color:var(--text-muted);">No businesses yet</td></tr>'
              : data.bizRevTable.map((b) => {
                  const pc = planColors[b.plan] || '#6b7280';
                  const sc = b.status === 'active' ? '#059669' : b.status === 'trial' ? '#f59e0b' : b.status === 'expired' ? '#ef4444' : '#6b7280';
                  return `<tr class="biz-rev-row" data-name="${escHtml(b.name.toLowerCase())}" data-plan="${b.plan}" data-status="${b.status}">
                    <td style="font-weight:600;"><a href="/api/admin/businesses/${b.id}" style="color:var(--text);text-decoration:none;">${escHtml(b.name)}</a></td>
                    <td><span style="background:${pc}20;color:${pc};padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;">${b.plan.charAt(0).toUpperCase() + b.plan.slice(1)}</span></td>
                    <td><span style="background:${sc}20;color:${sc};padding:2px 8px;border-radius:10px;font-size:12px;">${b.status.charAt(0).toUpperCase() + b.status.slice(1)}</span></td>
                    <td style="text-align:right;font-weight:600;color:${b.revenue > 0 ? '#059669' : 'var(--text-muted)'};">\$${b.revenue.toFixed(2)}</td>
                    <td style="text-align:right;color:var(--text-muted);">${b.apptCount}</td>
                    <td style="font-size:12px;color:var(--text-muted);">${fmtDate(b.createdAt)}</td>
                    <td><a href="/api/admin/businesses/${b.id}" class="btn btn-secondary btn-sm">View &rarr;</a></td>
                  </tr>`;
                }).join('')
            }
          </tbody>
        </table>
      </div>
      <div id="bizRevEmpty" style="display:none;padding:40px;text-align:center;color:var(--text-muted);">No businesses match your filters.</div>
    </div>

    <script>
      function filterBizRev() {
        const q = document.getElementById('bizRevSearch').value.toLowerCase();
        const plan = document.getElementById('bizRevPlanFilter').value;
        const status = document.getElementById('bizRevStatusFilter').value;
        let visible = 0;
        document.querySelectorAll('#bizRevTbody .biz-rev-row').forEach(function(row) {
          const name = row.getAttribute('data-name') || '';
          const rowPlan = row.getAttribute('data-plan') || '';
          const rowStatus = row.getAttribute('data-status') || '';
          const show = (!q || name.includes(q)) && (!plan || rowPlan === plan) && (!status || rowStatus === status);
          row.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        document.getElementById('bizRevEmpty').style.display = visible === 0 ? 'block' : 'none';
        document.getElementById('bizRevTable').style.display = visible === 0 ? 'none' : '';
      }
    </script>
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

function staffPage(allStaff: any[], allBiz: any[], allSvc: any[], bizFilter = ""): string {
  const bizMap = new Map(allBiz.map((b) => [b.id, b.businessName || b.name || "Unknown"]));
  const svcMap = new Map(allSvc.map((s) => [`${s.businessOwnerId}-${s.localId}`, s.name]));

  // Count unique businesses that have staff
  const bizWithStaff = new Set(allStaff.map((s) => s.businessOwnerId)).size;

  const bizOptions = allBiz.map((b: any) => `<option value="${b.id}" ${bizFilter === String(b.id) ? 'selected' : ''}>${escHtml(bizMap.get(b.id) || 'Unknown')}</option>`).join('');

  const rows = allStaff.map((s) => {
    const bizName = bizMap.get(s.businessOwnerId) || "Unknown";
    let serviceNames = "All";
    try {
      const ids = JSON.parse(s.serviceIds || "[]") as string[];
      if (ids.length > 0) {
        serviceNames = ids.map((id) => svcMap.get(`${s.businessOwnerId}-${id}`) || id).join(", ");
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
    const activeLabel = s.active !== false
      ? '<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:10px;font-size:11px;">Active</span>'
      : '<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:10px;font-size:11px;">Inactive</span>';

    return `<tr class="staff-row"
      data-biz="${s.businessOwnerId}"
      data-name="${escHtml((s.name || '').toLowerCase())}"
      data-email="${escHtml((s.email || '').toLowerCase())}"
      data-phone="${escHtml((s.phone || '').toLowerCase())}">
      <td style="font-weight:600;">${escHtml(s.name)}</td>
      <td><a href="/api/admin/businesses/${s.businessOwnerId}" style="color:var(--primary);">${escHtml(bizName)}</a></td>
      <td>${s.email ? escHtml(s.email) : '<span style="color:var(--text-muted);">—</span>'}</td>
      <td>${s.phone ? escHtml(s.phone) : '<span style="color:var(--text-muted);">—</span>'}</td>
      <td>${s.role ? `<span style="font-size:12px;color:var(--text-muted);">${escHtml(s.role)}</span>` : '<span style="color:var(--text-muted);">—</span>'}</td>
      <td><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${s.color || '#4a8c3f'};vertical-align:middle;margin-right:4px;"></span>${s.color || '#4a8c3f'}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;" title="${escHtml(serviceNames)}">${escHtml(serviceNames)}</td>
      <td style="font-size:12px;">${workingDays}</td>
      <td>${activeLabel}</td>
      <td style="font-size:12px;color:var(--text-muted);">${created}</td>
      <td><form class="delete-form" method="POST" action="/api/admin/delete/staff/${s.id}" onsubmit="return confirm('Delete staff member ${escHtml(s.name)}?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
    </tr>`;
  }).join("");

  let content = `
    <div class="page-header">
      <div>
        <h2>Staff Management</h2>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${allStaff.length} staff member${allStaff.length !== 1 ? 's' : ''} across ${bizWithStaff} business${bizWithStaff !== 1 ? 'es' : ''}</div>
      </div>
    </div>
    <div class="search-bar">
      <input type="text" id="staffSearch" placeholder="🔍 Search by name, email, or phone..." oninput="filterStaff()" style="max-width:340px;">
      <select id="staffBizFilter" onchange="filterStaff()">
        <option value="">All Businesses</option>
        ${bizOptions}
      </select>
    </div>

    <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="stat-card">
        <div class="stat-icon">👤</div>
        <div class="stat-label">Total Staff</div>
        <div class="stat-value">${allStaff.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🏢</div>
        <div class="stat-label">Businesses with Staff</div>
        <div class="stat-value">${bizWithStaff}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🛠️</div>
        <div class="stat-label">Avg Services/Staff</div>
        <div class="stat-value">${allStaff.length > 0 ? (allStaff.reduce((sum, s) => {
          try { const ids = JSON.parse(s.serviceIds || "[]") as string[]; return sum + ids.length; } catch { return sum; }
        }, 0) / allStaff.length).toFixed(1) : "0"}</div>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden;margin-top:16px;">
      <table id="staffTable">
        <thead>
          <tr style="background:var(--bg-hover);">
            <th style="padding:12px 16px;">Name</th>
            <th style="padding:12px 16px;">Business</th>
            <th style="padding:12px 16px;">Email</th>
            <th style="padding:12px 16px;">Phone</th>
            <th style="padding:12px 16px;">Role</th>
            <th style="padding:12px 16px;">Color</th>
            <th style="padding:12px 16px;">Services</th>
            <th style="padding:12px 16px;">Working Days</th>
            <th style="padding:12px 16px;">Status</th>
            <th style="padding:12px 16px;">Created</th>
            <th style="padding:12px 16px;">Actions</th>
          </tr>
        </thead>
        <tbody id="staffTbody">
          ${allStaff.length === 0
            ? '<tr><td colspan="11" style="padding:40px;text-align:center;color:var(--text-muted);">No staff members yet</td></tr>'
            : rows}
        </tbody>
      </table>
    </div>
    <div id="staffEmpty" style="display:none;padding:40px;text-align:center;color:var(--text-muted);">No staff match your filters.</div>
  `;

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

  content += `
    <script>
      function filterStaff() {
        const q = document.getElementById('staffSearch').value.toLowerCase();
        const biz = document.getElementById('staffBizFilter').value;
        let visible = 0;
        document.querySelectorAll('#staffTbody .staff-row').forEach(function(row) {
          const rowBiz = row.getAttribute('data-biz') || '';
          const name = row.getAttribute('data-name') || '';
          const email = row.getAttribute('data-email') || '';
          const phone = row.getAttribute('data-phone') || '';
          const matchBiz = !biz || rowBiz === biz;
          const matchQ = !q || name.includes(q) || email.includes(q) || phone.includes(q);
          const show = matchBiz && matchQ;
          row.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        const emptyEl = document.getElementById('staffEmpty');
        const tableEl = document.getElementById('staffTable');
        if (emptyEl) emptyEl.style.display = visible === 0 ? 'block' : 'none';
        if (tableEl) tableEl.style.display = visible === 0 ? 'none' : '';
      }
    </script>
  `;

  return adminLayout('Staff Management', 'staff', content);
}

// ─── Discounts Page ────────────────────────────────────────────────
function discountsPage(allDisc: any[], allBiz: any[]): string {
  const bizMap = new Map(allBiz.map((b: any) => [b.id, b.businessName]));
  return adminLayout("Discounts", "discounts", `
    <div class="page-header">
      <h2>All Discounts</h2>
      <span class="badge badge-info">${allDisc.length} total</span>
    </div>
    <div class="search-bar">
      <input type="text" id="discSearch" placeholder="🔍 Search by name or code..." oninput="filterDisc()" style="max-width:300px;">
      <select id="discBizFilter" onchange="filterDisc()">
        <option value="">All Businesses</option>
        ${allBiz.map((b: any) => `<option value="${b.id}">${escHtml(b.businessName)}</option>`).join("")}
      </select>
      <select id="discStatusFilter" onchange="filterDisc()">
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>
    <div class="card">
      ${allDisc.length === 0
        ? '<div class="empty-state"><div class="empty-icon">🏷️</div><p>No discounts yet</p></div>'
        : `<table id="discTable">
            <thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Code</th><th>Business</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody id="discTbody">
              ${allDisc.map((d: any) => {
                const isActive = d.active !== false;
                return `<tr class="disc-row" data-search="${escHtml(((d.name || '') + ' ' + (d.code || '')).toLowerCase())}" data-biz="${d.businessOwnerId}" data-status="${isActive ? 'active' : 'inactive'}">
                  <td style="font-weight:500;">${d.name || "Unnamed"}</td>
                  <td>${d.type || "percent"}</td>
                  <td>${d.type === "fixed" ? fmtCurrency(parseFloat(d.value || "0")) : (d.value || "0") + "%"}</td>
                  <td><code>${d.code || "N/A"}</code></td>
                  <td><a href="/api/admin/businesses/${d.businessOwnerId}">${bizMap.get(d.businessOwnerId) || "Unknown"}</a></td>
                  <td>${isActive ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}</td>
                  <td><form class="delete-form" method="POST" action="/api/admin/delete/discount/${d.id}" onsubmit="return confirm('Delete this discount?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
          <div id="discEmpty" style="display:none;padding:40px;text-align:center;color:var(--text-muted);">No discounts match your filters.</div>`
      }
    </div>
    <script>
      function filterDisc() {
        const q = document.getElementById('discSearch').value.toLowerCase();
        const biz = document.getElementById('discBizFilter').value;
        const status = document.getElementById('discStatusFilter').value;
        let visible = 0;
        document.querySelectorAll('#discTbody .disc-row').forEach(function(row) {
          const search = row.getAttribute('data-search') || '';
          const rowBiz = row.getAttribute('data-biz') || '';
          const rowStatus = row.getAttribute('data-status') || '';
          const show = (!q || search.includes(q)) && (!biz || rowBiz === biz) && (!status || rowStatus === status);
          row.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        document.getElementById('discEmpty').style.display = visible === 0 ? 'block' : 'none';
        document.getElementById('discTable').style.display = visible === 0 ? 'none' : '';
      }
    </script>
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
    <div class="search-bar">
      <input type="text" id="gcSearch" placeholder="🔍 Search by code..." oninput="filterGC()" style="max-width:280px;">
      <select id="gcBizFilter" onchange="filterGC()">
        <option value="">All Businesses</option>
        ${allBiz.map((b: any) => `<option value="${b.id}">${escHtml(b.businessName)}</option>`).join("")}
      </select>
      <select id="gcStatusFilter" onchange="filterGC()">
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="used">Used</option>
      </select>
    </div>
    <div class="card">
      ${allGC.length === 0
        ? '<div class="empty-state"><div class="empty-icon">🎁</div><p>No gift cards yet</p></div>'
        : `<table id="gcTable">
            <thead><tr><th>Code</th><th>Amount</th><th>Balance</th><th>Business</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody id="gcTbody">
              ${allGC.map((g: any) => {
                const isUsed = parseFloat(g.balance || g.amount || "0") <= 0;
                return `<tr class="gc-row" data-search="${escHtml(g.code || '').toLowerCase()}" data-biz="${g.businessOwnerId}" data-status="${isUsed ? 'used' : 'active'}">
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
          </table>
          <div id="gcEmpty" style="display:none;padding:40px;text-align:center;color:var(--text-muted);">No gift cards match your filters.</div>`
      }
    </div>
    <script>
      function filterGC() {
        const q = document.getElementById('gcSearch').value.toLowerCase();
        const biz = document.getElementById('gcBizFilter').value;
        const status = document.getElementById('gcStatusFilter').value;
        let visible = 0;
        document.querySelectorAll('#gcTbody .gc-row').forEach(function(row) {
          const search = row.getAttribute('data-search') || '';
          const rowBiz = row.getAttribute('data-biz') || '';
          const rowStatus = row.getAttribute('data-status') || '';
          const show = (!q || search.includes(q)) && (!biz || rowBiz === biz) && (!status || rowStatus === status);
          row.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        document.getElementById('gcEmpty').style.display = visible === 0 ? 'block' : 'none';
        document.getElementById('gcTable').style.display = visible === 0 ? 'none' : '';
      }
    </script>
  `);
}

// ─── Reviews Page ──────────────────────────────────────────────────
function reviewsPage(allRev: any[], allBiz: any[], bizFilter = "", ratingFilter = "", page = 1, totalPages = 1, totalCount = 0): string {
  const bizMap = new Map(allBiz.map((b: any) => [b.id, b.businessName]));
  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    if (bizFilter) params.set('biz', bizFilter);
    if (ratingFilter) params.set('rating', ratingFilter);
    params.set('page', String(p));
    return `/api/admin/reviews?${params.toString()}`;
  };
  const paginationHtml = totalPages > 1 ? `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--border);">
      <div style="font-size:13px;color:var(--text-muted);">Page ${page} of ${totalPages} &mdash; ${totalCount} total</div>
      <div style="display:flex;gap:6px;">
        ${page > 1 ? `<a href="${buildUrl(1)}" class="btn-sm">&#8676; First</a><a href="${buildUrl(page - 1)}" class="btn-sm">&lsaquo; Prev</a>` : ''}
        ${page < totalPages ? `<a href="${buildUrl(page + 1)}" class="btn-sm">Next &rsaquo;</a><a href="${buildUrl(totalPages)}" class="btn-sm">Last &#8677;</a>` : ''}
      </div>
    </div>` : '';

  return adminLayout("Reviews", "reviews", `
    <div class="page-header">
      <h2>All Reviews</h2>
      <span class="badge badge-info">${totalCount} total &mdash; page ${page} of ${totalPages}</span>
    </div>
    <form method="GET" action="/api/admin/reviews" class="search-bar">
      <input type="hidden" name="page" value="1">
      <select name="biz" onchange="this.form.submit()">
        <option value="">All Businesses</option>
        ${allBiz.map((b: any) => `<option value="${b.id}" ${bizFilter === String(b.id) ? 'selected' : ''}>${escHtml(b.businessName)}</option>`).join("")}
      </select>
      <select name="rating" onchange="this.form.submit()">
        <option value="">All Ratings</option>
        <option value="5" ${ratingFilter === '5' ? 'selected' : ''}>⭐⭐⭐⭐⭐ 5 stars</option>
        <option value="4" ${ratingFilter === '4' ? 'selected' : ''}>⭐⭐⭐⭐ 4 stars</option>
        <option value="3" ${ratingFilter === '3' ? 'selected' : ''}>⭐⭐⭐ 3 stars</option>
        <option value="2" ${ratingFilter === '2' ? 'selected' : ''}>⭐⭐ 2 stars</option>
        <option value="1" ${ratingFilter === '1' ? 'selected' : ''}>⭐ 1 star</option>
      </select>
      ${(bizFilter || ratingFilter) ? `<a href="/api/admin/reviews" class="btn-sm" style="background:var(--danger);color:#fff;">Clear</a>` : ''}
    </form>
    <div class="card" style="padding:0;overflow:hidden;">
      ${allRev.length === 0
        ? '<div class="empty-state" style="padding:40px;"><div class="empty-icon">⭐</div><p>No reviews yet</p></div>'
        : `<table>
            <thead><tr style="background:var(--bg-hover);"><th style="padding:12px 16px;">Rating</th><th style="padding:12px 16px;">Comment</th><th style="padding:12px 16px;">Client</th><th style="padding:12px 16px;">Business</th><th style="padding:12px 16px;">Created</th><th style="padding:12px 16px;">Actions</th></tr></thead>
            <tbody>
              ${allRev.map((r: any) => `<tr>
                <td style="padding:10px 16px;">${"⭐".repeat(Math.min(r.rating, 5))}</td>
                <td style="padding:10px 16px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(r.comment || '') || '<span style="color:var(--text-muted);">No comment</span>'}</td>
                <td style="padding:10px 16px;">${escHtml(r.clientName || r.clientLocalId || "Anonymous")}</td>
                <td style="padding:10px 16px;"><a href="/api/admin/businesses/${r.businessOwnerId}" style="color:var(--primary);">${escHtml(bizMap.get(r.businessOwnerId) as string || "Unknown")}</a></td>
                <td style="padding:10px 16px;font-size:12px;color:var(--text-muted);">${fmtDate(r.createdAt)}</td>
                <td style="padding:10px 16px;"><form class="delete-form" method="POST" action="/api/admin/delete/review/${r.id}" onsubmit="return confirm('Delete this review?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
              </tr>`).join("")}
            </tbody>
          </table>
          ${paginationHtml}`
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
    <div class="search-bar">
      <input type="text" id="prodSearch" placeholder="🔍 Search by name..." oninput="filterProd()" style="max-width:280px;">
      <select id="prodBizFilter" onchange="filterProd()">
        <option value="">All Businesses</option>
        ${allBiz.map((b: any) => `<option value="${b.id}">${escHtml(b.businessName)}</option>`).join("")}
      </select>
    </div>
    <div class="card">
      ${allProd.length === 0
        ? '<div class="empty-state"><div class="empty-icon">📦</div><p>No products yet</p></div>'
        : `<table id="prodTable">
            <thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Business</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody id="prodTbody">
              ${allProd.map((p: any) => `<tr class="prod-row" data-search="${escHtml(p.name || '').toLowerCase()}" data-biz="${p.businessOwnerId}">
                <td style="font-weight:500;">${p.name}</td>
                <td>${fmtCurrency(parseFloat(p.price || "0"))}</td>
                <td>${p.stock !== null && p.stock !== undefined ? p.stock : '<span style="color:var(--text-muted);">N/A</span>'}</td>
                <td><a href="/api/admin/businesses/${p.businessOwnerId}">${bizMap.get(p.businessOwnerId) || "Unknown"}</a></td>
                <td>${fmtDate(p.createdAt)}</td>
                <td><form class="delete-form" method="POST" action="/api/admin/delete/product/${p.id}" onsubmit="return confirm('Delete product ${escHtml(p.name)}?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
              </tr>`).join("")}
            </tbody>
          </table>
          <div id="prodEmpty" style="display:none;padding:40px;text-align:center;color:var(--text-muted);">No products match your filters.</div>`
      }
    </div>
    <script>
      function filterProd() {
        const q = document.getElementById('prodSearch').value.toLowerCase();
        const biz = document.getElementById('prodBizFilter').value;
        let visible = 0;
        document.querySelectorAll('#prodTbody .prod-row').forEach(function(row) {
          const search = row.getAttribute('data-search') || '';
          const rowBiz = row.getAttribute('data-biz') || '';
          const show = (!q || search.includes(q)) && (!biz || rowBiz === biz);
          row.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        document.getElementById('prodEmpty').style.display = visible === 0 ? 'block' : 'none';
        document.getElementById('prodTable').style.display = visible === 0 ? 'none' : '';
      }
    </script>
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
    <div class="search-bar">
      <input type="text" id="locSearch" placeholder="🔍 Search by name or address..." oninput="filterLoc()" style="max-width:300px;">
      <select id="locBizFilter" onchange="filterLoc()">
        <option value="">All Businesses</option>
        ${allBiz.map((b: any) => `<option value="${b.id}">${escHtml(b.businessName)}</option>`).join("")}
      </select>
      <select id="locStatusFilter" onchange="filterLoc()">
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="closed">Temp. Closed</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>
    <div class="card">
      ${allLoc.length === 0
        ? '<div class="empty-state"><div class="empty-icon">📍</div><p>No locations yet</p></div>'
        : `<table id="locTable">
            <thead><tr><th>Name</th><th>Address</th><th>Phone</th><th>Email</th><th>Business</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="locTbody">
              ${allLoc.map((loc: any) => {
                const locStatus = !loc.active ? 'inactive' : loc.temporarilyClosed ? 'closed' : 'active';
                return `<tr class="loc-row" data-search="${escHtml(((loc.name || '') + ' ' + (loc.address || '')).toLowerCase())}" data-biz="${loc.businessOwnerId}" data-status="${locStatus}">
                  <td style="font-weight:500;">${escHtml(loc.name)}</td>
                  <td>${loc.address ? escHtml(loc.address) : "N/A"}</td>
                  <td>${loc.phone || "N/A"}</td>
                  <td>${loc.email || "N/A"}</td>
                  <td><a href="/api/admin/businesses/${loc.businessOwnerId}">${bizMap.get(loc.businessOwnerId) || "Unknown"}</a></td>
                  <td>${!loc.active ? '<span class="badge badge-danger">Inactive</span>' : loc.temporarilyClosed ? '<span class="badge badge-warning">Temp. Closed</span>' : '<span class="badge badge-success">Active</span>'}</td>
                  <td><form class="delete-form" method="POST" action="/api/admin/delete/location/${loc.id}" onsubmit="return confirm('Delete location ${escHtml(loc.name)}?')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
          <div id="locEmpty" style="display:none;padding:40px;text-align:center;color:var(--text-muted);">No locations match your filters.</div>`
      }
    </div>
    <script>
      function filterLoc() {
        const q = document.getElementById('locSearch').value.toLowerCase();
        const biz = document.getElementById('locBizFilter').value;
        const status = document.getElementById('locStatusFilter').value;
        let visible = 0;
        document.querySelectorAll('#locTbody .loc-row').forEach(function(row) {
          const search = row.getAttribute('data-search') || '';
          const rowBiz = row.getAttribute('data-biz') || '';
          const rowStatus = row.getAttribute('data-status') || '';
          const show = (!q || search.includes(q)) && (!biz || rowBiz === biz) && (!status || rowStatus === status);
          row.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        document.getElementById('locEmpty').style.display = visible === 0 ? 'block' : 'none';
        document.getElementById('locTable').style.display = visible === 0 ? 'none' : '';
      }
    </script>
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

  const planColors: Record<string, string> = { solo: '#6b7280', growth: '#0a7ea4', studio: '#7c3aed', enterprise: '#059669' };

  const planBadge = (plan: string, override: boolean) => {
    const color = planColors[plan] || '#6b7280';
    const label = planMap[plan] || plan;
    return `<span style="background:${color}20;color:${color};padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;">${label}${override ? ' ⭐' : ''}</span>`;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      free: { color: '#6b7280', label: 'Free' }, trial: { color: '#f59e0b', label: 'Trial' },
      active: { color: '#059669', label: 'Active' }, expired: { color: '#ef4444', label: 'Expired' },
    };
    const s = map[status] || { color: '#6b7280', label: status };
    return `<span style="background:${s.color}20;color:${s.color};padding:2px 8px;border-radius:12px;font-size:12px;">${s.label}</span>`;
  };

  const trialCount = businesses.filter((b) => (b.subscriptionStatus || 'free') === 'trial').length;
  const activeCount = businesses.filter((b) => (b.subscriptionStatus || 'free') === 'active').length;
  const expiredCount = businesses.filter((b) => (b.subscriptionStatus || 'free') === 'expired').length;
  const overrideCount = businesses.filter((b) => b.adminOverride).length;

  const rows = businesses.map((b) => {
    const plan = b.subscriptionPlan || 'solo';
    const status = b.subscriptionStatus || 'free';
    const trialDate = b.trialEndsAt ? new Date(b.trialEndsAt) : null;
    const trialStr = trialDate ? trialDate.toLocaleDateString() : '—';
    const daysLeft = trialDate ? Math.ceil((trialDate.getTime() - Date.now()) / 86400000) : null;
    const trialDisplay = daysLeft !== null ? `${trialStr} <span style="font-size:11px;color:${daysLeft <= 3 ? '#ef4444' : '#f59e0b'}">(${daysLeft}d left)</span>` : '—';
    return `<tr class="sub-row" data-name="${escHtml((b.businessName || '').toLowerCase())}" data-plan="${plan}" data-status="${status}" data-override="${b.adminOverride ? 'yes' : 'no'}" data-trial-ts="${trialDate ? trialDate.getTime() : 0}">
      <td style="font-weight:600;"><a href="/api/admin/businesses/${b.id}" style="color:var(--text);text-decoration:none;">${escHtml(b.businessName)}</a></td>
      <td style="font-size:13px;color:var(--text-muted);">${escHtml(b.phone || '—')}</td>
      <td>${planBadge(plan, !!b.adminOverride)}</td>
      <td>${statusBadge(status)}</td>
      <td style="font-size:13px;">${status === 'trial' ? trialDisplay : '—'}</td>
      <td>${b.adminOverride ? '<span style="color:#059669;font-weight:600;">✓ Complimentary</span>' : '<span style="color:var(--text-muted);">—</span>'}</td>
      <td><a href="/api/admin/businesses/${b.id}" class="btn btn-secondary btn-sm">Manage →</a></td>
    </tr>`;
  }).join('');

  const planStats = plans.map((p) => {
    const count = businesses.filter((b) => (b.subscriptionPlan || 'solo') === p.planKey).length;
    const color = planColors[p.planKey] || '#6b7280';
    return `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:20px;text-align:center;cursor:pointer;" onclick="document.getElementById('subPlanFilter').value='${p.planKey}';filterSubs();">
      <div style="font-size:28px;font-weight:700;color:${color};">${count}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${escHtml(p.displayName)}</div>
    </div>`;
  }).join('');

  return adminLayout('Subscriptions', 'subscriptions', `
    <div class="page-header">
      <div>
        <h2>Subscriptions</h2>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${businesses.length} businesses &nbsp;·&nbsp; ${trialCount} on trial &nbsp;·&nbsp; ${activeCount} active &nbsp;·&nbsp; ${expiredCount} expired &nbsp;·&nbsp; ${overrideCount} complimentary</div>
      </div>
      <a href="/api/admin/plans" class="btn btn-primary">Manage Plans →</a>
    </div>

    <!-- Plan stat cards (clickable to filter) -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:20px;">
      ${planStats}
    </div>

    <!-- Search + Filter bar -->
    <div class="search-bar">
      <input type="text" id="subSearch" placeholder="🔍 Search by name or phone..." oninput="filterSubs()" style="max-width:300px;">
      <select id="subPlanFilter" onchange="filterSubs()">
        <option value="">All Plans</option>
        ${plans.map((p) => `<option value="${p.planKey}">${escHtml(p.displayName)}</option>`).join('')}
      </select>
      <select id="subStatusFilter" onchange="filterSubs()">
        <option value="">All Statuses</option>
        <option value="free">Free</option>
        <option value="trial">Trial</option>
        <option value="active">Active</option>
        <option value="expired">Expired</option>
      </select>
      <select id="subOverrideFilter" onchange="filterSubs()">
        <option value="">All</option>
        <option value="yes">Complimentary Only</option>
        <option value="no">Paid Only</option>
      </select>
      <select id="subSort" onchange="sortSubs()">
        <option value="newest">Newest First</option>
        <option value="name">Name A→Z</option>
        <option value="trial-asc">Trial Expiry (Soonest)</option>
        <option value="trial-desc">Trial Expiry (Latest)</option>
      </select>
    </div>

    <div class="card" style="padding:0;overflow:hidden;">
      <table id="subTable">
        <thead>
          <tr style="background:var(--bg-hover);">
            <th style="padding:12px 16px;">Business</th>
            <th style="padding:12px 16px;">Phone</th>
            <th style="padding:12px 16px;">Plan</th>
            <th style="padding:12px 16px;">Status</th>
            <th style="padding:12px 16px;">Trial Ends</th>
            <th style="padding:12px 16px;">Override</th>
            <th style="padding:12px 16px;">Action</th>
          </tr>
        </thead>
        <tbody id="subTbody">
          ${businesses.length === 0 ? '<tr><td colspan="7" style="padding:32px;text-align:center;color:var(--text-muted);">No businesses yet</td></tr>' : rows}
        </tbody>
      </table>
    </div>
    <div id="subEmpty" style="display:none;padding:40px;text-align:center;color:var(--text-muted);">No subscriptions match your filters.</div>

    <script>
      function filterSubs() {
        const q = document.getElementById('subSearch').value.toLowerCase();
        const plan = document.getElementById('subPlanFilter').value;
        const status = document.getElementById('subStatusFilter').value;
        const override = document.getElementById('subOverrideFilter').value;
        let visible = 0;
        document.querySelectorAll('#subTbody .sub-row').forEach(function(row) {
          const name = row.getAttribute('data-name') || '';
          const rowPlan = row.getAttribute('data-plan') || '';
          const rowStatus = row.getAttribute('data-status') || '';
          const rowOverride = row.getAttribute('data-override') || '';
          const show = (!q || name.includes(q)) && (!plan || rowPlan === plan) && (!status || rowStatus === status) && (!override || rowOverride === override);
          row.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        document.getElementById('subEmpty').style.display = visible === 0 ? 'block' : 'none';
        document.getElementById('subTable').style.display = visible === 0 ? 'none' : '';
      }
      function sortSubs() {
        const sort = document.getElementById('subSort').value;
        const tbody = document.getElementById('subTbody');
        const rows = Array.from(tbody.querySelectorAll('.sub-row'));
        rows.sort(function(a, b) {
          if (sort === 'name') return (a.getAttribute('data-name') || '').localeCompare(b.getAttribute('data-name') || '');
          if (sort === 'trial-asc') return parseInt(a.getAttribute('data-trial-ts') || '0') - parseInt(b.getAttribute('data-trial-ts') || '0');
          if (sort === 'trial-desc') return parseInt(b.getAttribute('data-trial-ts') || '0') - parseInt(a.getAttribute('data-trial-ts') || '0');
          return 0;
        });
        rows.forEach(function(r) { tbody.appendChild(r); });
      }
    </script>
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
        <button type="submit" class="plan-save-btn" data-plan="${p.id}" disabled style="background:var(--border);color:var(--text-muted);padding:10px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:not-allowed;transition:background 0.2s,color 0.2s;">Save Changes</button>
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
    <script>
    (function() {
      document.querySelectorAll('.plan-save-btn').forEach(function(btn) {
        var form = btn.closest('form');
        if (!form) return;
        var initial = {};
        form.querySelectorAll('input, select, textarea').forEach(function(el) {
          var key = el.name || el.id;
          if (!key) return;
          initial[key] = el.type === 'checkbox' ? el.checked : el.value;
        });
        function checkDirty() {
          var dirty = false;
          form.querySelectorAll('input, select, textarea').forEach(function(el) {
            var key = el.name || el.id;
            if (!key) return;
            var cur = el.type === 'checkbox' ? el.checked : el.value;
            if (cur !== initial[key]) dirty = true;
          });
          if (dirty) {
            btn.disabled = false;
            btn.style.background = 'var(--primary)';
            btn.style.color = 'white';
            btn.style.cursor = 'pointer';
          } else {
            btn.disabled = true;
            btn.style.background = 'var(--border)';
            btn.style.color = 'var(--text-muted)';
            btn.style.cursor = 'not-allowed';
          }
        }
        form.addEventListener('input', checkDirty);
        form.addEventListener('change', checkDirty);
      });
    })();
    </script>
  `);
}

// ─── Platform Config Page ────────────────────────────────────────────────────
function platformConfigPage(
  cfgMap: Record<string, string>,
  bizList: Array<{ id: number; businessName: string; phone: string }> = []
): string {
  const isTwilioTestMode = cfgMap["TWILIO_TEST_MODE"] === "true" || cfgMap["TWILIO_TEST_MODE"] === "1";
  const isStripeTestMode = cfgMap["STRIPE_TEST_MODE"] === "true" || cfgMap["STRIPE_TEST_MODE"] === "1";

  const field = (key: string, label: string, desc: string, sensitive = false, placeholder = "", valueOverride?: string) => {
    const val = valueOverride !== undefined ? valueOverride : (cfgMap[key] || "");
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
        ${field("twilio_account_sid", "Account SID", "Found in your Twilio Console dashboard", true, "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", cfgMap["TWILIO_ACCOUNT_SID"] || "")}
        ${field("twilio_auth_token", "Auth Token", "Found in your Twilio Console dashboard", true, "Your Twilio Auth Token", cfgMap["TWILIO_AUTH_TOKEN"] || "")}
        ${field("twilio_from_number", "From Phone Number", "Your Twilio phone number in E.164 format", false, "+14155551234", cfgMap["TWILIO_FROM_NUMBER"] || "")}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;">
              <input type="checkbox" name="twilio_test_mode" value="true" ${(cfgMap["TWILIO_TEST_MODE"] === "true") ? "checked" : ""} style="width:16px;height:16px;" />
              <span><strong>Test Mode</strong> — OTP bypassed with code below</span>
            </label>
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Test OTP Code</label>
            <input name="twilio_test_otp" type="text" value="${escHtml(cfgMap["TWILIO_TEST_OTP"] || "123456")}"
              placeholder="123456"
              style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;box-sizing:border-box;" />
          </div>
        </div>
        ${isTwilioTestMode ? '<div style="background:#f59e0b15;border:1px solid #f59e0b40;border-radius:8px;padding:10px 14px;margin-top:12px;font-size:13px;color:#f59e0b;"><strong>⚠️ Test Mode is ON.</strong> All OTP codes will be bypassed with the test code above. Disable before going live.</div>' : ""}

        <!-- Per-Business OTP Overrides -->
        <div id="perPhoneOtpSection" style="margin-top:20px;${isTwilioTestMode ? '' : 'display:none;'}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h3 style="font-size:14px;font-weight:700;margin:0;">Per-Business Static OTP</h3>
              <p style="font-size:12px;color:var(--text-muted);margin:4px 0 0;">Select specific businesses that can log in with a fixed OTP code — no SMS sent.</p>
            </div>
            <button type="button" onclick="addPhoneOtpRow()" style="background:var(--primary);color:white;border:none;border-radius:8px;padding:6px 14px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;">+ Add Business</button>
          </div>
          <div id="phoneOtpRows" style="display:flex;flex-direction:column;gap:8px;">
            ${(() => {
              let overrides: Record<string, string> = {};
              try { overrides = JSON.parse(cfgMap["TWILIO_PER_PHONE_OTP"] || "{}"); } catch {}
              if (Object.keys(overrides).length === 0) return '<p id="noOtpRows" style="font-size:13px;color:var(--text-muted);text-align:center;padding:16px;border:1px dashed var(--border);border-radius:8px;">No per-business overrides yet. Click "+ Add Business" to add one.</p>';
              return Object.entries(overrides).map(([phone, code]) => {
                const biz = bizList.find(b => b.phone === phone || b.phone.replace(/\D/g,'').slice(-10) === phone.replace(/\D/g,'').slice(-10));
                const bizName = biz ? biz.businessName : phone;
                return `<div class="phone-otp-row" style="display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;">
                  <span style="flex:1;font-size:13px;font-weight:600;">${escHtml(bizName)}</span>
                  <span style="font-size:12px;color:var(--text-muted);margin-right:4px;">${escHtml(phone)}</span>
                  <input type="hidden" name="per_phone_otp_phone[]" value="${escHtml(phone)}" />
                  <input type="text" name="per_phone_otp_code[]" value="${escHtml(code)}" maxlength="6" placeholder="123456"
                    style="width:80px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:14px;text-align:center;font-weight:600;" />
                  <button type="button" onclick="this.closest('.phone-otp-row').remove(); checkPhoneOtpRows();" style="background:#ef444420;color:#ef4444;border:none;border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;">✕</button>
                </div>`;
              }).join('');
            })()}
          </div>
          <div style="margin-top:12px;display:flex;justify-content:flex-end;">
            <button type="button" id="savePhoneOtpBtn" onclick="savePhoneOtpOverrides()"
              style="background:var(--primary);color:white;border:none;border-radius:8px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;">
              💾 Save OTP Overrides
            </button>
            <span id="savePhoneOtpResult" style="margin-left:12px;font-size:13px;line-height:36px;"></span>
          </div>
        </div>

        <div style="margin-top:16px;display:flex;align-items:center;gap:12px;">
          <button type="button" id="testTwilioBtn" onclick="testTwilio()"
            style="background:#0a7ea4;color:white;padding:8px 18px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0;">
            🔌 Test Connection
          </button>
          <span id="twilioTestResult" style="font-size:13px;"></span>
        </div>
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
        ${field("stripe_secret_key", "Secret Key", "From Stripe Dashboard → Developers → API Keys", true, "sk_test_...", cfgMap["STRIPE_SECRET_KEY"] || "")}
        ${field("stripe_publishable_key", "Publishable Key", "From Stripe Dashboard → Developers → API Keys", false, "pk_test_...", cfgMap["STRIPE_PUBLISHABLE_KEY"] || "")}
        ${field("stripe_webhook_secret", "Webhook Secret", "From Stripe Dashboard → Webhooks → Signing Secret", true, "whsec_...", cfgMap["STRIPE_WEBHOOK_SECRET"] || "")}
        <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;margin-top:8px;">
          <input type="checkbox" name="stripe_test_mode" value="true" ${(cfgMap["STRIPE_TEST_MODE"] === "true") ? "checked" : ""} style="width:16px;height:16px;" />
          <span><strong>Test Mode</strong> — Use Stripe test keys (recommended until launch)</span>
        </label>
        <div style="margin-top:16px;display:flex;align-items:center;gap:12px;">
          <button type="button" id="testStripeBtn" onclick="testStripe()"
            style="background:#635bff;color:white;padding:8px 18px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0;">
            🔌 Test Connection
          </button>
          <span id="stripeTestResult" style="font-size:13px;"></span>
        </div>
      </div>

      <button id="savePlatformBtn" type="submit" disabled style="background:var(--border);color:var(--text-muted);padding:12px 28px;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:not-allowed;width:100%;transition:background 0.2s,color 0.2s;">
        💾 Save Platform Configuration
      </button>
    </form>

    <script>
    var form = document.querySelector('form[action="/api/admin/platform-config"]');
    (function() {
      var btn = document.getElementById('savePlatformBtn');
      if (!form || !btn) return;

      // ── Validation rules (only applied when field is non-empty) ──────────────
      var RULES = {
        twilio_account_sid: {
          test: function(v) { return new RegExp('^AC[a-f0-9]{32}$', 'i').test(v); },
          hint: 'Must start with AC and be 34 characters (e.g. ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)'
        },
        twilio_auth_token: {
          test: function(v) { return new RegExp('^[a-f0-9]{32}$', 'i').test(v); },
          hint: 'Must be exactly 32 hex characters'
        },
        twilio_from_number: {
          test: function(v) { return v.startsWith('+') && v.length >= 8 && v.length <= 16 && /^[0-9]+$/.test(v.slice(1)); },
          hint: 'Must be in E.164 format: +14155551234'
        },
        stripe_secret_key: {
          test: function(v) { return v.startsWith('sk_live_') || v.startsWith('sk_test_'); },
          hint: 'Must start with sk_live_ or sk_test_'
        },
        stripe_publishable_key: {
          test: function(v) { return v.startsWith('pk_live_') || v.startsWith('pk_test_'); },
          hint: 'Must start with pk_live_ or pk_test_'
        },
        stripe_webhook_secret: {
          test: function(v) { return v.startsWith('whsec_'); },
          hint: 'Must start with whsec_'
        }
      };

      // ── Inject error hint elements next to each validated input ──────────────
      Object.keys(RULES).forEach(function(name) {
        var input = form.querySelector('[name="' + name + '"]');
        if (!input) return;
        var hint = document.createElement('p');
        hint.id = 'hint_' + name;
        hint.style.cssText = 'font-size:12px;color:#ef4444;margin:4px 0 0;display:none;';
        hint.textContent = '⚠ ' + RULES[name].hint;
        input.parentNode.insertBefore(hint, input.nextSibling);
      });

      // ── Snapshot initial values ──────────────────────────────────────────────
      var initial = {};
      form.querySelectorAll('input, textarea, select').forEach(function(el) {
        var key = el.name || el.id;
        if (!key) return;
        initial[key] = el.type === 'checkbox' ? el.checked : el.value;
      });

      // ── Validate a single field, show/hide hint, return isValid ─────────────
      function validateField(name, value) {
        var rule = RULES[name];
        var hint = document.getElementById('hint_' + name);
        if (!rule || !hint) return true;
        var input = form.querySelector('[name="' + name + '"]');
        if (!value || value.trim() === '') {
          // Empty is allowed — clear error state
          hint.style.display = 'none';
          if (input) input.style.borderColor = 'var(--border)';
          return true;
        }
        var valid = rule.test(value.trim());
        hint.style.display = valid ? 'none' : 'block';
        if (input) input.style.borderColor = valid ? 'var(--border)' : '#ef4444';
        return valid;
      }

      // ── Check dirty + all validations, then update Save button ──────────────
      function checkForm() {
        var dirty = false;
        var allValid = true;

        form.querySelectorAll('input, textarea, select').forEach(function(el) {
          var key = el.name || el.id;
          if (!key) return;
          var cur = el.type === 'checkbox' ? el.checked : el.value;
          if (cur !== initial[key]) dirty = true;
        });

        Object.keys(RULES).forEach(function(name) {
          var input = form.querySelector('[name="' + name + '"]');
          if (!input) return;
          var valid = validateField(name, input.value);
          if (!valid) allValid = false;
        });

        var canSave = dirty && allValid;
        btn.disabled = !canSave;
        btn.style.background = canSave ? 'var(--primary)' : 'var(--border)';
        btn.style.color = canSave ? 'white' : 'var(--text-muted)';
        btn.style.cursor = canSave ? 'pointer' : 'not-allowed';
      }

      form.addEventListener('input', checkForm);
      form.addEventListener('change', checkForm);
    })();

    // ── Test Connection helpers (global scope so onclick= can call them) ────
    window.testTwilio = async function testTwilio() {
      var btn = document.getElementById('testTwilioBtn');
      var result = document.getElementById('twilioTestResult');
      var sid = form.querySelector('[name="twilio_account_sid"]').value.trim();
      var token = form.querySelector('[name="twilio_auth_token"]').value.trim();
      if (!sid || !token) {
        result.textContent = '⚠️ Enter Account SID and Auth Token first';
        result.style.color = '#f59e0b';
        return;
      }
      btn.disabled = true;
      btn.textContent = '⏳ Testing...';
      result.textContent = '';
      try {
        var res = await fetch('/api/admin/test-twilio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sid: sid, token: token })
        });
        var data = await res.json();
        if (data.ok) {
          result.textContent = '✅ ' + data.message;
          result.style.color = '#22c55e';
        } else {
          result.textContent = '❌ ' + data.message;
          result.style.color = '#ef4444';
        }
      } catch (e) {
        result.textContent = '❌ Network error';
        result.style.color = '#ef4444';
      } finally {
        btn.disabled = false;
        btn.textContent = '🔌 Test Connection';
      }
    }

    // ── Per-Business OTP Override helpers ─────────────────────────────────
    var BIZ_LIST = ${JSON.stringify(bizList.map(b => ({ id: b.id, name: b.businessName, phone: b.phone })))};

    function checkPhoneOtpRows() {
      var rows = document.querySelectorAll('.phone-otp-row');
      var noRows = document.getElementById('noOtpRows');
      if (noRows) noRows.style.display = rows.length === 0 ? 'block' : 'none';
    }

    window.addPhoneOtpRow = function addPhoneOtpRow() {
      // Build a dropdown of businesses not yet added
      var existingPhones = Array.from(document.querySelectorAll('[name="per_phone_otp_phone[]"]')).map(function(el) { return el.value; });
      var available = BIZ_LIST.filter(function(b) { return !existingPhones.includes(b.phone); });
      if (available.length === 0) {
        alert('All businesses have already been added.');
        return;
      }
      // Remove empty-state placeholder if present
      var noRows = document.getElementById('noOtpRows');
      if (noRows) noRows.remove();
      // Create a select + OTP input row
      var container = document.getElementById('phoneOtpRows');
      var row = document.createElement('div');
      row.className = 'phone-otp-row';
      row.style.cssText = 'display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;';
      var sel = document.createElement('select');
      sel.style.cssText = 'flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px;';
      available.forEach(function(b) {
        var opt = document.createElement('option');
        opt.value = b.phone;
        opt.textContent = b.name + ' (' + b.phone + ')';
        sel.appendChild(opt);
      });
      var phoneHidden = document.createElement('input');
      phoneHidden.type = 'hidden';
      phoneHidden.name = 'per_phone_otp_phone[]';
      phoneHidden.value = available[0].phone;
      sel.addEventListener('change', function() { phoneHidden.value = sel.value; });
      var codeInput = document.createElement('input');
      codeInput.type = 'text';
      codeInput.name = 'per_phone_otp_code[]';
      codeInput.value = '123456';
      codeInput.maxLength = 6;
      codeInput.placeholder = '123456';
      codeInput.style.cssText = 'width:80px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:14px;text-align:center;font-weight:600;';
      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = '\u2715';
      delBtn.style.cssText = 'background:#ef444420;color:#ef4444;border:none;border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;';
      delBtn.onclick = function() { row.remove(); checkPhoneOtpRows(); };
      row.appendChild(sel);
      row.appendChild(phoneHidden);
      row.appendChild(codeInput);
      row.appendChild(delBtn);
      container.appendChild(row);
    };

    window.savePhoneOtpOverrides = async function savePhoneOtpOverrides() {
      var btn = document.getElementById('savePhoneOtpBtn');
      var result = document.getElementById('savePhoneOtpResult');
      var phones = Array.from(document.querySelectorAll('[name="per_phone_otp_phone[]"]')).map(function(el) { return el.value.trim(); });
      var codes = Array.from(document.querySelectorAll('[name="per_phone_otp_code[]"]')).map(function(el) { return el.value.trim(); });
      var overrides = {};
      phones.forEach(function(p, i) { if (p && codes[i]) overrides[p] = codes[i]; });
      btn.disabled = true;
      btn.textContent = '⏳ Saving...';
      result.textContent = '';
      try {
        var res = await fetch('/api/admin/save-phone-otp-overrides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ overrides: overrides })
        });
        var data = await res.json();
        if (data.ok) {
          result.textContent = '✅ Saved!';
          result.style.color = '#22c55e';
        } else {
          result.textContent = '❌ ' + (data.message || 'Error saving');
          result.style.color = '#ef4444';
        }
      } catch (e) {
        result.textContent = '❌ Network error';
        result.style.color = '#ef4444';
      } finally {
        btn.disabled = false;
        btn.textContent = '💾 Save OTP Overrides';
        setTimeout(function() { result.textContent = ''; }, 4000);
      }
    };

    // Show/hide per-business OTP section when test mode checkbox changes
    var testModeChk = form ? form.querySelector('[name="twilio_test_mode"]') : null;
    if (testModeChk) {
      testModeChk.addEventListener('change', function() {
        var section = document.getElementById('perPhoneOtpSection');
        if (section) section.style.display = testModeChk.checked ? 'block' : 'none';
      });
    }

    window.testStripe = async function testStripe() {
      var btn = document.getElementById('testStripeBtn');
      var result = document.getElementById('stripeTestResult');
      var key = form.querySelector('[name="stripe_secret_key"]').value.trim();
      if (!key) {
        result.textContent = '⚠️ Enter Stripe Secret Key first';
        result.style.color = '#f59e0b';
        return;
      }
      btn.disabled = true;
      btn.textContent = '⏳ Testing...';
      result.textContent = '';
      try {
        var res = await fetch('/api/admin/test-stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secretKey: key })
        });
        var data = await res.json();
        if (data.ok) {
          result.textContent = '✅ ' + data.message;
          result.style.color = '#22c55e';
        } else {
          result.textContent = '❌ ' + data.message;
          result.style.color = '#ef4444';
        }
      } catch (e) {
        result.textContent = '❌ Network error';
        result.style.color = '#ef4444';
      } finally {
        btn.disabled = false;
        btn.textContent = '🔌 Test Connection';
      }
    }
    </script>
  `);
}

// ─── Financial Page ─────────────────────────────────────────────────
function financialPage(data: {
  monthlyData: { month: string; rev: number; apptCount: number }[];
  yearlyData: { year: string; apptRev: number; subRev: number; total: number; apptCount: number }[];
  quarters: { label: string; apptRev: number; subRev: number; apptCount: number }[];
  thisYearTotal: number;
  thisYearApptRev: number;
  thisYearSubRev: number;
  estimatedTax: number;
  quarterlyTaxEst: number;
  currentYear: number;
  expenses: any[];
  thisYearExpenses: number;
  expensesByMonth: Record<string, number>;
  expensesByCategory: Record<string, number>;
}): string {
  const fmt = (n: number) => "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fmtN = (n: number) => n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const monthLabels = JSON.stringify(data.monthlyData.map((m) => m.month));
  const monthRevVals = JSON.stringify(data.monthlyData.map((m) => parseFloat(m.rev.toFixed(2))));
  const monthApptVals = JSON.stringify(data.monthlyData.map((m) => m.apptCount));

  const yearLabels = JSON.stringify(data.yearlyData.map((y) => y.year));
  const yearApptRevVals = JSON.stringify(data.yearlyData.map((y) => parseFloat(y.apptRev.toFixed(2))));
  const yearSubRevVals = JSON.stringify(data.yearlyData.map((y) => parseFloat(y.subRev.toFixed(2))));

  const qLabels = JSON.stringify(data.quarters.map((q) => q.label));
  const qApptRevVals = JSON.stringify(data.quarters.map((q) => parseFloat(q.apptRev.toFixed(2))));
  const qSubRevVals = JSON.stringify(data.quarters.map((q) => parseFloat(q.subRev.toFixed(2))));
  const qTaxVals = JSON.stringify(data.quarters.map((q) => parseFloat(((q.apptRev + q.subRev) * 0.30).toFixed(2))));

  const printDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const netIncome = data.thisYearTotal - data.thisYearExpenses;
  const estimatedTaxOnNet = Math.max(0, netIncome) * 0.30;
  const expMonthLabels = JSON.stringify(data.monthlyData.map((m) => m.month));
  const expMonthVals = JSON.stringify(data.monthlyData.map((m) => parseFloat((data.expensesByMonth[m.month] || 0).toFixed(2))));
  const expCatLabels = JSON.stringify(Object.keys(data.expensesByCategory));
  const expCatVals = JSON.stringify(Object.values(data.expensesByCategory).map((v) => parseFloat(v.toFixed(2))));
  const expensesJson = JSON.stringify(data.expenses.map((e) => ({ id: e.id, date: e.date, category: e.category, description: e.description, amount: parseFloat(String(e.amount)), notes: e.notes || '' })));

  return adminLayout("Financial", "financial", `
    <style>
      @media print {
        .sidebar, .no-print { display: none !important; }
        .main { margin-left: 0 !important; padding: 0 !important; }
        .print-header { display: block !important; }
        .card { break-inside: avoid; border: 1px solid #ccc !important; background: #fff !important; color: #000 !important; }
        canvas { max-width: 100%; }
        body { background: #fff !important; color: #000 !important; }
        .stat-card { background: #f9f9f9 !important; border: 1px solid #ddd !important; color: #000 !important; }
        .stat-value, .stat-label { color: #000 !important; }
        th, td { color: #000 !important; border-color: #ccc !important; }
      }
      .print-header { display: none; text-align: center; margin-bottom: 24px; }
      .tab-bar { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 2px solid var(--border); padding-bottom: 0; }
      .tab-btn { padding: 10px 20px; border: none; background: none; color: var(--text-muted); font-size: 14px; font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.15s; }
      .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); }
      .tab-btn:hover { color: var(--text); }
      .tab-panel { display: none; }
      .tab-panel.active { display: block; }
      .chart-container { position: relative; height: 300px; }
      .chart-container.tall { height: 380px; }
      .tax-note { background: #f59e0b15; border: 1px solid #f59e0b40; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: var(--text-muted); margin-top: 12px; }
    </style>

    <div class="print-header">
      <h1 style="font-size:24px;font-weight:700;">Lime Of Time — Financial Report</h1>
      <p style="color:#666;margin-top:4px;">Generated on ${printDate} &nbsp;|&nbsp; Fiscal Year ${data.currentYear}</p>
    </div>

    <div class="page-header no-print">
      <div>
        <h2>Financial Analytics</h2>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">Revenue, tax estimates &amp; year-end reporting — Fiscal Year ${data.currentYear}</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="window.print()" class="btn btn-primary no-print" style="gap:6px;">🖨️ Print / Save PDF</button>
        <a href="/api/admin/analytics" class="btn btn-secondary no-print">📈 Analytics</a>
      </div>
    </div>

    <!-- KPI Row -->
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));margin-bottom:20px;">
      <div class="stat-card" style="border-left:4px solid #059669;">
        <div class="stat-icon" style="color:#059669;">💰</div>
        <div class="stat-label">Total Revenue ${data.currentYear}</div>
        <div class="stat-value" style="color:#059669;">${fmt(data.thisYearTotal)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Appt + Subscription</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #0a7ea4;">
        <div class="stat-icon" style="color:#0a7ea4;">📅</div>
        <div class="stat-label">Appointment Revenue</div>
        <div class="stat-value" style="color:#0a7ea4;">${fmt(data.thisYearApptRev)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">From completed bookings</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #7c3aed;">
        <div class="stat-icon" style="color:#7c3aed;">💳</div>
        <div class="stat-label">Subscription Revenue</div>
        <div class="stat-value" style="color:#7c3aed;">${fmt(data.thisYearSubRev)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">SaaS plan fees</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #ef4444;">
        <div class="stat-icon" style="color:#ef4444;">🏛️</div>
        <div class="stat-label">Est. Tax Liability</div>
        <div class="stat-value" style="color:#ef4444;">${fmt(data.estimatedTax)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">~30% effective rate</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #f59e0b;">
        <div class="stat-icon" style="color:#f59e0b;">📆</div>
        <div class="stat-label">Quarterly Tax Est.</div>
        <div class="stat-value" style="color:#f59e0b;">${fmt(data.quarterlyTaxEst)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Per quarter (IRS est. pay)</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #22c55e;">
        <div class="stat-icon" style="color:#22c55e;">✅</div>
        <div class="stat-label">Net After Tax Est.</div>
        <div class="stat-value" style="color:#22c55e;">${fmt(data.thisYearTotal - data.estimatedTax)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Estimated net income</div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="tab-bar no-print">
      <button class="tab-btn active" onclick="switchTab('monthly', this)">📊 Monthly Income</button>
      <button class="tab-btn" onclick="switchTab('yearly', this)">📈 Yearly Summary</button>
      <button class="tab-btn" onclick="switchTab('quarterly', this)">🗓️ Quarterly Tax</button>
      <button class="tab-btn" onclick="switchTab('expenses', this)">💸 Expenses</button>
      <button class="tab-btn" onclick="switchTab('taxprep', this)">📋 Tax Preparation</button>
    </div>

    <!-- Monthly Tab -->
    <div id="tab-monthly" class="tab-panel active">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;">Monthly Revenue (Last 24 Months)</h3>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:12px;color:var(--text-muted);">Click bars to see details</span>
            <a href="/api/admin/financial/export/monthly" class="btn btn-secondary btn-sm no-print">⬇️ CSV</a>
          </div>
        </div>
        <div class="chart-container tall">
          <canvas id="monthlyChart"></canvas>
        </div>
        <div id="monthlyDetail" style="display:none;margin-top:16px;padding:12px;background:var(--bg-hover);border-radius:8px;font-size:14px;"></div>
      </div>
      <div class="card">
        <h3>Monthly Appointment Volume</h3>
        <div class="chart-container">
          <canvas id="monthlyApptChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Yearly Tab -->
    <div id="tab-yearly" class="tab-panel">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;">Annual Revenue Breakdown (Last 5 Years)</h3>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:12px;color:var(--text-muted);">Click bars to see year details</span>
            <a href="/api/admin/financial/export/yearly" class="btn btn-secondary btn-sm no-print">⬇️ CSV</a>
          </div>
        </div>
        <div class="chart-container tall">
          <canvas id="yearlyChart"></canvas>
        </div>
        <div id="yearlyDetail" style="display:none;margin-top:16px;padding:12px;background:var(--bg-hover);border-radius:8px;font-size:14px;"></div>
      </div>
      <div class="card" style="overflow-x:auto;">
        <h3>Year-over-Year Summary</h3>
        <table>
          <thead>
            <tr style="background:var(--bg-hover);">
              <th>Year</th>
              <th style="text-align:right;">Appt Revenue</th>
              <th style="text-align:right;">Sub Revenue</th>
              <th style="text-align:right;">Total Revenue</th>
              <th style="text-align:right;">Appointments</th>
              <th style="text-align:right;">Est. Tax (30%)</th>
              <th style="text-align:right;">Est. Net</th>
            </tr>
          </thead>
          <tbody>
            ${data.yearlyData.map((y) => {
              const tax = y.total * 0.30;
              const net = y.total - tax;
              const isCurrentYear = y.year === String(data.currentYear);
              return `<tr style="${isCurrentYear ? 'background:var(--bg-hover);font-weight:600;' : ''}">
                <td>${y.year}${isCurrentYear ? ' <span style="font-size:11px;color:var(--primary);">(current)</span>' : ''}</td>
                <td style="text-align:right;color:#0a7ea4;">${fmt(y.apptRev)}</td>
                <td style="text-align:right;color:#7c3aed;">${fmt(y.subRev)}</td>
                <td style="text-align:right;color:#059669;font-weight:700;">${fmt(y.total)}</td>
                <td style="text-align:right;color:var(--text-muted);">${fmtN(y.apptCount)}</td>
                <td style="text-align:right;color:#ef4444;">${fmt(tax)}</td>
                <td style="text-align:right;color:#22c55e;">${fmt(net)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Quarterly Tab -->
    <div id="tab-quarterly" class="tab-panel">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;">Quarterly Revenue &amp; Tax Estimates — ${data.currentYear}</h3>
          <span style="font-size:12px;color:var(--text-muted);">Click bars to see quarter details</span>
        </div>
        <div class="chart-container">
          <canvas id="quarterlyChart"></canvas>
        </div>
        <div id="quarterlyDetail" style="display:none;margin-top:16px;padding:12px;background:var(--bg-hover);border-radius:8px;font-size:14px;"></div>
      </div>
      <div class="card" style="overflow-x:auto;">
        <h3>Quarterly Breakdown</h3>
        <table>
          <thead>
            <tr style="background:var(--bg-hover);">
              <th>Quarter</th>
              <th style="text-align:right;">Appt Revenue</th>
              <th style="text-align:right;">Sub Revenue</th>
              <th style="text-align:right;">Total Revenue</th>
              <th style="text-align:right;">Appointments</th>
              <th style="text-align:right;">Est. Tax (30%)</th>
              <th style="text-align:right;">IRS Due Date</th>
            </tr>
          </thead>
          <tbody>
            ${data.quarters.map((q, i) => {
              const total = q.apptRev + q.subRev;
              const tax = total * 0.30;
              const dueDates = ['Apr 15', 'Jun 16', 'Sep 15', 'Jan 15'];
              return `<tr>
                <td style="font-weight:600;">${q.label}</td>
                <td style="text-align:right;color:#0a7ea4;">${fmt(q.apptRev)}</td>
                <td style="text-align:right;color:#7c3aed;">${fmt(q.subRev)}</td>
                <td style="text-align:right;font-weight:700;color:#059669;">${fmt(total)}</td>
                <td style="text-align:right;color:var(--text-muted);">${fmtN(q.apptCount)}</td>
                <td style="text-align:right;color:#ef4444;font-weight:600;">${fmt(tax)}</td>
                <td style="text-align:right;color:var(--text-muted);font-size:12px;">${dueDates[i]}</td>
              </tr>`;
            }).join('')}
            <tr style="background:var(--bg-hover);font-weight:700;border-top:2px solid var(--border);">
              <td>TOTAL ${data.currentYear}</td>
              <td style="text-align:right;color:#0a7ea4;">${fmt(data.thisYearApptRev)}</td>
              <td style="text-align:right;color:#7c3aed;">${fmt(data.thisYearSubRev)}</td>
              <td style="text-align:right;color:#059669;">${fmt(data.thisYearTotal)}</td>
              <td style="text-align:right;color:var(--text-muted);">${fmtN(data.quarters.reduce((s, q) => s + q.apptCount, 0))}</td>
              <td style="text-align:right;color:#ef4444;">${fmt(data.estimatedTax)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <div class="tax-note">
          ⚠️ <strong>Disclaimer:</strong> Tax estimates use a flat 30% effective rate as a rough guide for US self-employment taxes. Consult a licensed CPA or tax professional for accurate tax advice.
        </div>
      </div>
    </div>

    <!-- Expenses Tab -->
    <div id="tab-expenses" class="tab-panel">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;">💸 Expenses — ${data.currentYear}</h3>
          <div style="display:flex;gap:8px;">
            <a href="/api/admin/financial/export/expenses?year=${data.currentYear}" class="btn btn-secondary btn-sm no-print">⬇️ Download CSV</a>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
          <div style="background:var(--bg-hover);border-radius:8px;padding:14px;">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Total Expenses ${data.currentYear}</div>
            <div style="font-size:24px;font-weight:700;color:#ef4444;">${fmt(data.thisYearExpenses)}</div>
          </div>
          <div style="background:var(--bg-hover);border-radius:8px;padding:14px;">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Net Income (after expenses)</div>
            <div style="font-size:24px;font-weight:700;color:#22c55e;">${fmt(netIncome)}</div>
          </div>
          <div style="background:var(--bg-hover);border-radius:8px;padding:14px;">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Est. Tax on Net Income</div>
            <div style="font-size:24px;font-weight:700;color:#f59e0b;">${fmt(estimatedTaxOnNet)}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div>
            <h4 style="margin-bottom:8px;font-size:13px;color:var(--text-muted);">Monthly Expenses</h4>
            <div class="chart-container"><canvas id="expMonthChart"></canvas></div>
          </div>
          <div>
            <h4 style="margin-bottom:8px;font-size:13px;color:var(--text-muted);">By Category</h4>
            <div class="chart-container"><canvas id="expCatChart"></canvas></div>
          </div>
        </div>
      </div>

      <!-- Add Expense Form -->
      <div class="card no-print">
        <h3 style="margin-bottom:16px;">Add Expense</h3>
        <form method="POST" action="/api/admin/financial/expenses" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:12px;align-items:end;">
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Date</label>
            <input type="date" name="date" required style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px;" />
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Category</label>
            <select name="category" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px;">
              <option value="hosting">Hosting</option>
              <option value="marketing">Marketing</option>
              <option value="software">Software</option>
              <option value="payroll">Payroll</option>
              <option value="legal">Legal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Description</label>
            <input type="text" name="description" required placeholder="e.g. AWS hosting" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px;" />
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Amount ($)</label>
            <input type="number" name="amount" step="0.01" min="0" required placeholder="0.00" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px;" />
          </div>
          <button type="submit" class="btn btn-primary" style="height:38px;white-space:nowrap;">+ Add</button>
        </form>
      </div>

      <!-- Expense List -->
      <div class="card" style="overflow-x:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;">All Expenses</h3>
          <input type="text" id="expSearch" placeholder="Search expenses..." oninput="filterExpenses()" style="padding:6px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px;width:200px;" />
        </div>
        <table id="expTable">
          <thead><tr style="background:var(--bg-hover);"><th>Date</th><th>Category</th><th>Description</th><th style="text-align:right;">Amount</th><th>Notes</th><th class="no-print">Actions</th></tr></thead>
          <tbody id="expTbody">
            ${data.expenses.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">No expenses recorded yet. Add your first expense above.</td></tr>' : data.expenses.map((e) => {
              const amt = parseFloat(String(e.amount)) || 0;
              const catColors: Record<string, string> = { hosting: '#0a7ea4', marketing: '#7c3aed', software: '#059669', payroll: '#f59e0b', legal: '#ef4444', other: '#6b7280' };
              const col = catColors[e.category] || '#6b7280';
              return `<tr class="exp-row" data-desc="${escHtml((e.description || '').toLowerCase())}" data-cat="${e.category}">
                <td style="font-size:13px;">${e.date}</td>
                <td><span style="background:${col}20;color:${col};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">${e.category}</span></td>
                <td>${escHtml(e.description || '')}</td>
                <td style="text-align:right;font-weight:600;color:#ef4444;">${fmt(amt)}</td>
                <td style="font-size:12px;color:var(--text-muted);">${escHtml(e.notes || '')}</td>
                <td class="no-print">
                  <form method="POST" action="/api/admin/financial/expenses/${e.id}/delete" style="display:inline;" onsubmit="return confirm('Delete this expense?')">
                    <button type="submit" class="btn btn-secondary btn-sm" style="color:#ef4444;">Delete</button>
                  </form>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tax Preparation Tab -->
    <div id="tab-taxprep" class="tab-panel">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="margin:0;">📋 Year-End Tax Preparation — ${data.currentYear}</h3>
          <button onclick="window.print()" class="btn btn-primary no-print" style="font-size:13px;">🖨️ Print / Save PDF</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div style="background:var(--bg-hover);border-radius:8px;padding:16px;">
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Gross Revenue</div>
            <div style="font-size:28px;font-weight:700;color:#059669;">${fmt(data.thisYearTotal)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Appointment: ${fmt(data.thisYearApptRev)} &nbsp;|&nbsp; Subscription: ${fmt(data.thisYearSubRev)}</div>
          </div>
          <div style="background:var(--bg-hover);border-radius:8px;padding:16px;">
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Estimated Tax Liability</div>
            <div style="font-size:28px;font-weight:700;color:#ef4444;">${fmt(data.estimatedTax)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Based on 30% effective rate</div>
          </div>
        </div>

        <h4 style="margin-bottom:12px;font-size:14px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Income Summary</h4>
        <table style="margin-bottom:20px;">
          <tbody>
            <tr><td style="font-weight:600;">Total Gross Revenue</td><td style="text-align:right;font-weight:700;color:#059669;">${fmt(data.thisYearTotal)}</td></tr>
            <tr><td style="padding-left:20px;color:var(--text-muted);">Appointment Revenue (service fees)</td><td style="text-align:right;">${fmt(data.thisYearApptRev)}</td></tr>
            <tr><td style="padding-left:20px;color:var(--text-muted);">Subscription Revenue (SaaS fees)</td><td style="text-align:right;">${fmt(data.thisYearSubRev)}</td></tr>
            <tr style="border-top:2px solid var(--border);"><td style="font-weight:600;">Estimated Tax Liability (30%)</td><td style="text-align:right;font-weight:700;color:#ef4444;">(${fmt(data.estimatedTax)})</td></tr>
            <tr style="background:var(--bg-hover);"><td style="font-weight:700;">Estimated Net Income</td><td style="text-align:right;font-weight:700;color:#22c55e;">${fmt(data.thisYearTotal - data.estimatedTax)}</td></tr>
          </tbody>
        </table>

        <h4 style="margin-bottom:12px;font-size:14px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Quarterly Estimated Tax Payments (IRS Form 1040-ES)</h4>
        <table style="margin-bottom:16px;">
          <thead>
            <tr style="background:var(--bg-hover);">
              <th>Period</th><th>Quarter</th><th style="text-align:right;">Revenue</th><th style="text-align:right;">Est. Tax Due</th><th>IRS Due Date</th>
            </tr>
          </thead>
          <tbody>
            ${data.quarters.map((q, i) => {
              const total = q.apptRev + q.subRev;
              const tax = total * 0.30;
              const periods = ['Jan 1 – Mar 31', 'Apr 1 – May 31', 'Jun 1 – Aug 31', 'Sep 1 – Dec 31'];
              const dueDates = [`Apr 15, ${data.currentYear}`, `Jun 16, ${data.currentYear}`, `Sep 15, ${data.currentYear}`, `Jan 15, ${data.currentYear + 1}`];
              return `<tr>
                <td style="font-size:12px;color:var(--text-muted);">${periods[i]}</td>
                <td style="font-weight:600;">${q.label}</td>
                <td style="text-align:right;">${fmt(total)}</td>
                <td style="text-align:right;font-weight:700;color:#ef4444;">${fmt(tax)}</td>
                <td style="font-size:12px;color:var(--text-muted);">${dueDates[i]}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>

        <div class="tax-note">
          ⚠️ <strong>Important Disclaimer:</strong> This report is generated automatically from platform data for reference purposes only. Revenue figures reflect appointment and subscription data recorded in the system. Tax estimates use a flat 30% effective rate as a rough approximation for US self-employment and income taxes. <strong>Always consult a licensed CPA or tax professional</strong> before filing. Actual deductible expenses, depreciation, and other factors will affect your real tax liability.
        </div>
      </div>
    </div>

    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script>
      const CHART_DEFAULTS = {
        plugins: { legend: { labels: { color: '#e4e6eb', font: { size: 12 } } }, tooltip: { backgroundColor: '#1a1d27', titleColor: '#e4e6eb', bodyColor: '#8b8fa3', borderColor: '#2a2d3a', borderWidth: 1 } },
        scales: { x: { ticks: { color: '#8b8fa3', maxRotation: 45 }, grid: { color: '#2a2d3a' } }, y: { ticks: { color: '#8b8fa3' }, grid: { color: '#2a2d3a' } } }
      };

      // Monthly Revenue Chart
      const monthlyRevData = { labels: ${monthLabels}, values: ${monthRevVals}, appts: ${monthApptVals} };
      const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
      const monthlyChart = new Chart(monthlyCtx, {
        type: 'bar',
        data: { labels: monthlyRevData.labels, datasets: [{ label: 'Revenue ($)', data: monthlyRevData.values, backgroundColor: '#4a8c3f99', borderColor: '#4a8c3f', borderWidth: 1, borderRadius: 4 }] },
        options: { ...CHART_DEFAULTS, responsive: true, maintainAspectRatio: false, onClick: (e, els) => {
          if (!els.length) return;
          const i = els[0].index;
          const d = document.getElementById('monthlyDetail');
          d.style.display = 'block';
          d.innerHTML = '<strong>' + monthlyRevData.labels[i] + '</strong> — Revenue: <strong style="color:#4a8c3f">$' + monthlyRevData.values[i].toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') + '</strong> &nbsp;|&nbsp; Appointments: <strong>' + monthlyRevData.appts[i] + '</strong>';
        }}
      });

      // Monthly Appointments Chart
      const monthlyApptCtx = document.getElementById('monthlyApptChart').getContext('2d');
      new Chart(monthlyApptCtx, {
        type: 'line',
        data: { labels: monthlyRevData.labels, datasets: [{ label: 'Appointments', data: monthlyRevData.appts, borderColor: '#0a7ea4', backgroundColor: '#0a7ea420', fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6 }] },
        options: { ...CHART_DEFAULTS, responsive: true, maintainAspectRatio: false }
      });

      // Yearly Chart
      const yearlyRevData = { labels: ${yearLabels}, apptRev: ${yearApptRevVals}, subRev: ${yearSubRevVals} };
      const yearlyCtx = document.getElementById('yearlyChart').getContext('2d');
      const yearlyChart = new Chart(yearlyCtx, {
        type: 'bar',
        data: { labels: yearlyRevData.labels, datasets: [
          { label: 'Appointment Revenue', data: yearlyRevData.apptRev, backgroundColor: '#0a7ea499', borderColor: '#0a7ea4', borderWidth: 1, borderRadius: 4 },
          { label: 'Subscription Revenue', data: yearlyRevData.subRev, backgroundColor: '#7c3aed99', borderColor: '#7c3aed', borderWidth: 1, borderRadius: 4 }
        ]},
        options: { ...CHART_DEFAULTS, responsive: true, maintainAspectRatio: false, scales: { ...CHART_DEFAULTS.scales, x: { ...CHART_DEFAULTS.scales.x, stacked: false }, y: { ...CHART_DEFAULTS.scales.y, stacked: false } }, onClick: (e, els) => {
          if (!els.length) return;
          const i = els[0].index;
          const total = yearlyRevData.apptRev[i] + yearlyRevData.subRev[i];
          const d = document.getElementById('yearlyDetail');
          d.style.display = 'block';
          d.innerHTML = '<strong>' + yearlyRevData.labels[i] + '</strong> — Appt: <strong style="color:#0a7ea4">$' + yearlyRevData.apptRev[i].toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') + '</strong> &nbsp;|&nbsp; Sub: <strong style="color:#7c3aed">$' + yearlyRevData.subRev[i].toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') + '</strong> &nbsp;|&nbsp; Total: <strong style="color:#059669">$' + total.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') + '</strong>';
        }}
      });

      // Quarterly Chart
      const qData = { labels: ${qLabels}, apptRev: ${qApptRevVals}, subRev: ${qSubRevVals}, tax: ${qTaxVals} };
      const qCtx = document.getElementById('quarterlyChart').getContext('2d');
      const quarterlyChart = new Chart(qCtx, {
        type: 'bar',
        data: { labels: qData.labels, datasets: [
          { label: 'Appt Revenue', data: qData.apptRev, backgroundColor: '#0a7ea499', borderColor: '#0a7ea4', borderWidth: 1, borderRadius: 4 },
          { label: 'Sub Revenue', data: qData.subRev, backgroundColor: '#7c3aed99', borderColor: '#7c3aed', borderWidth: 1, borderRadius: 4 },
          { label: 'Est. Tax', data: qData.tax, backgroundColor: '#ef444499', borderColor: '#ef4444', borderWidth: 1, borderRadius: 4 }
        ]},
        options: { ...CHART_DEFAULTS, responsive: true, maintainAspectRatio: false, onClick: (e, els) => {
          if (!els.length) return;
          const i = els[0].index;
          const total = qData.apptRev[i] + qData.subRev[i];
          const d = document.getElementById('quarterlyDetail');
          d.style.display = 'block';
          d.innerHTML = '<strong>' + qData.labels[i] + '</strong> — Revenue: <strong style="color:#059669">$' + total.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') + '</strong> &nbsp;|&nbsp; Est. Tax: <strong style="color:#ef4444">$' + qData.tax[i].toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') + '</strong>';
        }}
      });

      // Expense Monthly Chart
      let expMonthChart, expCatChart;
      function initExpenseCharts() {
        if (expMonthChart) return;
        const expMonthCtx = document.getElementById('expMonthChart');
        const expCatCtx = document.getElementById('expCatChart');
        if (!expMonthCtx || !expCatCtx) return;
        expMonthChart = new Chart(expMonthCtx.getContext('2d'), {
          type: 'bar',
          data: { labels: ${expMonthLabels}, datasets: [{ label: 'Expenses ($)', data: ${expMonthVals}, backgroundColor: '#ef444499', borderColor: '#ef4444', borderWidth: 1, borderRadius: 4 }] },
          options: { ...CHART_DEFAULTS, responsive: true, maintainAspectRatio: false }
        });
        expCatChart = new Chart(expCatCtx.getContext('2d'), {
          type: 'doughnut',
          data: { labels: ${expCatLabels}, datasets: [{ data: ${expCatVals}, backgroundColor: ['#0a7ea4','#7c3aed','#059669','#f59e0b','#ef4444','#6b7280'], borderWidth: 2 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#e4e6eb', font: { size: 12 } } } } }
        });
      }

      function filterExpenses() {
        const q = document.getElementById('expSearch').value.toLowerCase();
        document.querySelectorAll('#expTbody .exp-row').forEach(row => {
          const desc = row.getAttribute('data-desc') || '';
          const cat = row.getAttribute('data-cat') || '';
          row.style.display = (!q || desc.includes(q) || cat.includes(q)) ? '' : 'none';
        });
      }

      function switchTab(name, btn) {
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-' + name).classList.add('active');
        btn.classList.add('active');
        // Resize charts after tab switch
        setTimeout(() => {
          monthlyChart.resize(); yearlyChart.resize(); quarterlyChart.resize();
          if (name === 'expenses') { initExpenseCharts(); if (expMonthChart) expMonthChart.resize(); if (expCatChart) expCatChart.resize(); }
        }, 50);
      }
    </script>
  `);
}
