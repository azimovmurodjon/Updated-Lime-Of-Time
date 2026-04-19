import { Express, Request, Response } from "express";
import { getDb } from "./db";
import { businessOwners } from "../drizzle/schema";
import { sql } from "drizzle-orm";
import { getPlatformConfig } from "./subscription";

function requireAdminAuth(req: Request, res: Response): boolean {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/admin_session=([^;]+)/);
  if (!match) { res.redirect("/api/admin/login"); return false; }
  return true;
}

export function registerAdminStripeConnectRoutes(app: Express): void {
  // ── Stripe Connect Overview ─────────────────────────────────────────
  app.get("/api/admin/stripe-connect", async (req: Request, res: Response) => {
    if (!requireAdminAuth(req, res)) return;
    try {
      const dbase = await getDb();
      if (!dbase) { res.status(500).send("DB unavailable"); return; }

      const allBiz = await dbase.select().from(businessOwners).orderBy(sql`${businessOwners.createdAt} DESC`);
      const platformFee = await getPlatformConfig("STRIPE_PLATFORM_FEE_PERCENT") || "1.5";
      const stripeMode = await getPlatformConfig("STRIPE_TEST_MODE");
      const isTestMode = stripeMode === "true" || stripeMode === "1";

      const connected = allBiz.filter((b: any) => b.stripeConnectAccountId);
      const enabled = allBiz.filter((b: any) => b.stripeConnectEnabled);
      const pending = allBiz.filter((b: any) => b.stripeConnectAccountId && !b.stripeConnectEnabled);

      res.send(stripeConnectPage({
        businesses: allBiz,
        connected,
        enabled,
        pending,
        platformFee,
        isTestMode,
      }));
    } catch (err) {
      console.error("[Admin] Stripe Connect error:", err);
      res.status(500).send("Failed to load Stripe Connect data");
    }
  });

  // ── Update Platform Fee ─────────────────────────────────────────────
  app.post("/api/admin/stripe-connect/platform-fee", async (req: Request, res: Response) => {
    if (!requireAdminAuth(req, res)) return;
    try {
      const { fee } = req.body;
      const feeNum = parseFloat(fee);
      if (isNaN(feeNum) || feeNum < 0 || feeNum > 20) {
        res.status(400).json({ error: "Fee must be between 0 and 20%" });
        return;
      }
      const dbase = await getDb();
      if (!dbase) { res.status(500).json({ error: "DB unavailable" }); return; }
      const { platformConfig } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const existing = await dbase.select().from(platformConfig).where(eq(platformConfig.configKey, "STRIPE_PLATFORM_FEE_PERCENT"));
      if (existing.length > 0) {
        await dbase.update(platformConfig).set({ configValue: String(feeNum), updatedAt: new Date() }).where(eq(platformConfig.configKey, "STRIPE_PLATFORM_FEE_PERCENT"));
      } else {
        await dbase.insert(platformConfig).values({ configKey: "STRIPE_PLATFORM_FEE_PERCENT", configValue: String(feeNum) });
      }
      res.redirect("/api/admin/stripe-connect?saved=1");
    } catch (err) {
      console.error("[Admin] Update platform fee error:", err);
      res.status(500).json({ error: "Failed to update fee" });
    }
  });

  // ── Disconnect a business from Stripe Connect ───────────────────────
  app.post("/api/admin/stripe-connect/:id/disconnect", async (req: Request, res: Response) => {
    if (!requireAdminAuth(req, res)) return;
    try {
      const id = parseInt(req.params.id);
      const dbase = await getDb();
      if (!dbase) { res.status(500).json({ error: "DB unavailable" }); return; }
      const { eq } = await import("drizzle-orm");
      await dbase.update(businessOwners).set({
        stripeConnectAccountId: null,
        stripeConnectEnabled: false,
        stripeConnectOnboardingComplete: false,
      } as any).where(eq(businessOwners.id, id));
      res.redirect("/api/admin/stripe-connect?disconnected=1");
    } catch (err) {
      console.error("[Admin] Disconnect Stripe error:", err);
      res.status(500).json({ error: "Failed to disconnect" });
    }
  });
}

function stripeConnectPage(data: {
  businesses: any[];
  connected: any[];
  enabled: any[];
  pending: any[];
  platformFee: string;
  isTestMode: boolean;
}): string {
  const { businesses, connected, enabled, pending, platformFee, isTestMode } = data;

  const rows = businesses.map((b: any) => {
    const hasAccount = !!b.stripeConnectAccountId;
    const isEnabled = !!b.stripeConnectEnabled;
    const isComplete = !!b.stripeConnectOnboardingComplete;
    let statusBadge = `<span style="background:#374151;color:#9ca3af;padding:2px 8px;border-radius:12px;font-size:11px;">Not Connected</span>`;
    if (hasAccount && isEnabled) {
      statusBadge = `<span style="background:#14532d;color:#4ade80;padding:2px 8px;border-radius:12px;font-size:11px;">✓ Active</span>`;
    } else if (hasAccount && !isEnabled) {
      statusBadge = `<span style="background:#78350f;color:#fbbf24;padding:2px 8px;border-radius:12px;font-size:11px;">⏳ Pending</span>`;
    }
    const accountId = b.stripeConnectAccountId ? `<code style="font-size:11px;color:#9ca3af;">${b.stripeConnectAccountId}</code>` : `<span style="color:#4b5563;font-size:11px;">—</span>`;
    const disconnectBtn = hasAccount
      ? `<form method="POST" action="/api/admin/stripe-connect/${b.id}/disconnect" style="display:inline;" onsubmit="return confirm('Disconnect Stripe for ${b.businessName}?')"><button type="submit" style="background:#7f1d1d;color:#fca5a5;border:none;padding:3px 10px;border-radius:6px;font-size:11px;cursor:pointer;">Disconnect</button></form>`
      : '';
    return `<tr style="border-bottom:1px solid #1f2937;">
      <td style="padding:10px 12px;"><a href="/api/admin/businesses/${b.id}" style="color:#60a5fa;font-size:13px;">${escHtml(b.businessName || 'Unnamed')}</a></td>
      <td style="padding:10px 12px;font-size:12px;color:#9ca3af;">${escHtml(b.email || '')}</td>
      <td style="padding:10px 12px;">${statusBadge}</td>
      <td style="padding:10px 12px;">${accountId}</td>
      <td style="padding:10px 12px;">${disconnectBtn}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Stripe Connect — Admin</title>
  <style>
    :root { --bg:#0f1117;--bg-card:#1a1d27;--border:#2a2d3a;--text:#e4e6eb;--text-muted:#8b8fa3;--primary:#4a8c3f; }
    * { margin:0;padding:0;box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex; }
    .sidebar { width:220px;min-height:100vh;background:var(--bg-card);border-right:1px solid var(--border);display:flex;flex-direction:column;padding-top:16px;flex-shrink:0; }
    .sidebar-logo { padding:12px 20px 20px;font-size:18px;font-weight:700;color:var(--primary); }
    .nav-item { display:flex;align-items:center;gap:10px;padding:10px 20px;color:var(--text-muted);font-size:14px;transition:all 0.15s;cursor:pointer;text-decoration:none; }
    .nav-item:hover { background:#242736;color:var(--text); }
    .nav-item.active { background:#242736;color:var(--primary);border-right:3px solid var(--primary); }
    .nav-section { padding:12px 20px 4px;font-size:10px;font-weight:700;color:#4b5563;letter-spacing:.08em;text-transform:uppercase; }
    .main { flex:1;padding:32px;overflow-y:auto; }
    h1 { font-size:22px;font-weight:700;margin-bottom:4px; }
    .subtitle { color:var(--text-muted);font-size:14px;margin-bottom:28px; }
    .stat-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;margin-bottom:28px; }
    .stat-card { background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px; }
    .stat-value { font-size:28px;font-weight:700;margin-bottom:4px; }
    .stat-label { font-size:12px;color:var(--text-muted); }
    .card { background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px; }
    .card h2 { font-size:15px;font-weight:600;margin-bottom:16px; }
    table { width:100%;border-collapse:collapse; }
    th { text-align:left;padding:8px 12px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border); }
    input[type=number] { background:#111827;border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:8px;font-size:14px;width:100px; }
    button[type=submit] { background:var(--primary);color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:14px;cursor:pointer;margin-left:10px; }
    .badge-test { background:#1e3a5f;color:#60a5fa;padding:2px 8px;border-radius:12px;font-size:11px;margin-left:8px; }
    .badge-live { background:#14532d;color:#4ade80;padding:2px 8px;border-radius:12px;font-size:11px;margin-left:8px; }
    .alert { padding:10px 16px;border-radius:8px;font-size:13px;margin-bottom:20px; }
    .alert-success { background:#14532d;color:#4ade80;border:1px solid #166534; }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="sidebar-logo">🗓️ Admin</div>
    <a href="/api/admin" class="nav-item">📊 Dashboard</a>
    <div class="nav-section">BUSINESSES</div>
    <a href="/api/admin/businesses" class="nav-item">🏢 Businesses</a>
    <a href="/api/admin/clients" class="nav-item">👥 Clients</a>
    <a href="/api/admin/appointments" class="nav-item">📅 Appointments</a>
    <div class="nav-section">ANALYTICS</div>
    <a href="/api/admin/analytics" class="nav-item">📈 Analytics</a>
    <a href="/api/admin/financial" class="nav-item">💰 Financial</a>
    <div class="nav-section">SAAS</div>
    <a href="/api/admin/subscriptions" class="nav-item">💳 Subscriptions</a>
    <a href="/api/admin/plans" class="nav-item">📋 Plan Pricing</a>
    <a href="/api/admin/stripe-connect" class="nav-item active">💳 Stripe Connect</a>
    <div class="nav-section">SYSTEM</div>
    <a href="/api/admin/platform-config" class="nav-item">🔧 Platform Config</a>
    <a href="/api/admin/settings" class="nav-item">⚙️ Settings</a>
    <div style="margin-top:auto;padding:20px;border-top:1px solid var(--border);">
      <a href="/api/admin/logout" class="nav-item" style="color:#ef4444;">🚪 Logout</a>
    </div>
  </div>
  <div class="main">
    <h1>Stripe Connect <span class="${isTestMode ? 'badge-test' : 'badge-live'}">${isTestMode ? 'TEST MODE' : 'LIVE MODE'}</span></h1>
    <div class="subtitle">Manage business owner Stripe Connect accounts and platform fee settings.</div>

    ${data.businesses.length === 0 || (data.connected.length === 0 && data.pending.length === 0) ? '' : ''}

    <!-- Stats -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value" style="color:#4ade80;">${enabled.length}</div>
        <div class="stat-label">Active Accounts</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#fbbf24;">${pending.length}</div>
        <div class="stat-label">Pending Onboarding</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#9ca3af;">${businesses.length - connected.length}</div>
        <div class="stat-label">Not Connected</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#60a5fa;">${platformFee}%</div>
        <div class="stat-label">Platform Fee</div>
      </div>
    </div>

    <!-- Platform Fee Setting -->
    <div class="card">
      <h2>💰 Platform Application Fee</h2>
      <p style="font-size:13px;color:#9ca3af;margin-bottom:16px;">This percentage is deducted from each card payment as a platform fee. Currently set to <strong style="color:#e4e6eb;">${platformFee}%</strong>.</p>
      <form method="POST" action="/api/admin/stripe-connect/platform-fee" style="display:flex;align-items:center;gap:0;">
        <input type="number" name="fee" value="${platformFee}" min="0" max="20" step="0.1" required>
        <span style="margin:0 8px;color:#9ca3af;font-size:14px;">%</span>
        <button type="submit">Save</button>
      </form>
    </div>

    <!-- Business Accounts Table -->
    <div class="card">
      <h2>🏢 Business Connect Accounts (${businesses.length} total)</h2>
      <table>
        <thead>
          <tr>
            <th>Business</th>
            <th>Email</th>
            <th>Status</th>
            <th>Stripe Account ID</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#4b5563;">No businesses found</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- How It Works -->
    <div class="card">
      <h2>ℹ️ How Stripe Connect Works</h2>
      <div style="font-size:13px;color:#9ca3af;line-height:1.7;">
        <p style="margin-bottom:8px;">1. Business owners go to <strong style="color:#e4e6eb;">Settings → Payment Methods → Accept Card Payments</strong> in the app and tap <strong style="color:#e4e6eb;">Connect with Stripe</strong>.</p>
        <p style="margin-bottom:8px;">2. They complete Stripe Express onboarding (takes ~2 minutes). Stripe verifies their identity and bank account.</p>
        <p style="margin-bottom:8px;">3. Once approved, their status shows <strong style="color:#4ade80;">Active</strong> here and a <strong style="color:#e4e6eb;">💳 Pay by Card</strong> option appears on their client booking page.</p>
        <p style="margin-bottom:8px;">4. When a client pays by card, Stripe charges the client, deducts the platform fee (${platformFee}%), and deposits the remainder directly to the business owner's bank account.</p>
        <p>5. Business owners can view their Stripe dashboard, payouts, and disputes from the app under Settings → Payment Methods.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escHtml(str: string): string {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
