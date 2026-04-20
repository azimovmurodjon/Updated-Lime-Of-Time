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

      const serverDomain = `${req.protocol}://${req.get('host')}`;
      res.send(stripeConnectPage({
        businesses: allBiz,
        connected,
        enabled,
        pending,
        platformFee,
        isTestMode,
        serverDomain,
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

  // ── Test Fee: create a $1.00 test checkout session to verify fee flow ─
  app.post("/api/admin/stripe-connect/test-fee", async (req: Request, res: Response) => {
    if (!requireAdminAuth(req, res)) return;
    try {
      const { businessOwnerId } = req.body;
      if (!businessOwnerId) { res.status(400).json({ error: "businessOwnerId required" }); return; }
      const dbase = await getDb();
      if (!dbase) { res.status(503).json({ error: "DB unavailable" }); return; }
      const { eq } = await import("drizzle-orm");
      const rows = await dbase.select().from(businessOwners).where(eq(businessOwners.id, parseInt(businessOwnerId))).limit(1);
      const biz = rows[0];
      const accountId = (biz as any)?.stripeConnectAccountId as string | null;
      if (!accountId) { res.status(400).json({ error: "Business has no Stripe account connected" }); return; }
      const stripeKey = await getPlatformConfig("STRIPE_SECRET_KEY");
      if (!stripeKey) { res.status(503).json({ error: "Stripe not configured — set STRIPE_SECRET_KEY in Platform Config" }); return; }
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" as any });
      const rawFee = await getPlatformConfig("STRIPE_PLATFORM_FEE_PERCENT");
      const feePercent = rawFee ? parseFloat(rawFee) : 1.5;
      const amountCents = 100; // $1.00 test charge
      const feeCents = Math.round(amountCents * feePercent / 100);
      const origin = `${req.protocol}://${req.get("host")}`;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: "Platform Fee Test — $1.00", description: `Verifying ${feePercent}% fee (${feeCents}¢) flows to platform account` },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${origin}/api/admin/stripe-connect?test_fee=success`,
        cancel_url: `${origin}/api/admin/stripe-connect?test_fee=cancelled`,
        payment_intent_data: {
          application_fee_amount: feeCents,
          description: `[ADMIN TEST] Platform fee verification — ${feePercent}%`,
        },
      }, { stripeAccount: accountId });
      res.json({ ok: true, url: session.url, feeCents, feePercent, amountCents });
    } catch (err: any) {
      console.error("[Admin] Test fee error:", err);
      res.status(500).json({ error: err?.message || "Test fee failed" });
    }
  });

  // ── Fee Revenue Dashboard: list application fees by month ─────────────
  app.get("/api/admin/stripe-connect/fee-revenue", async (req: Request, res: Response) => {
    if (!requireAdminAuth(req, res)) return;
    try {
      const stripeKey = await getPlatformConfig("STRIPE_SECRET_KEY");
      if (!stripeKey) { res.status(503).json({ error: "Stripe not configured" }); return; }
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" as any });
      // Fetch up to 100 most recent application fees
      const fees = await stripe.applicationFees.list({ limit: 100 });
      // Group by month
      const byMonth: Record<string, { count: number; totalCents: number }> = {};
      for (const fee of fees.data) {
        const d = new Date(fee.created * 1000);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!byMonth[key]) byMonth[key] = { count: 0, totalCents: 0 };
        byMonth[key].count++;
        byMonth[key].totalCents += fee.amount;
      }
      const months = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([month, v]) => ({
        month,
        count: v.count,
        totalDollars: (v.totalCents / 100).toFixed(2),
      }));
      const totalAllTime = fees.data.reduce((s, f) => s + f.amount, 0);
      res.json({ ok: true, months, totalAllTimeDollars: (totalAllTime / 100).toFixed(2), hasMore: fees.has_more });
    } catch (err: any) {
      console.error("[Admin] Fee revenue error:", err);
      res.status(500).json({ error: err?.message || "Failed to fetch fee revenue" });
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
  serverDomain: string;
}): string {
  const { businesses, connected, enabled, pending, platformFee, isTestMode, serverDomain } = data;

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

    <!-- Test Fee Button -->
    <div class="card" id="testFeeCard" style="border:1px solid #7c3aed40;background:#7c3aed08;">
      <h2 style="color:#a78bfa;">🧪 Test Platform Fee Flow</h2>
      <p style="font-size:13px;color:#9ca3af;margin-bottom:14px;">Create a real $1.00 Stripe Checkout session against a connected business account to verify the <strong style="color:#e4e6eb;">${platformFee}% application fee</strong> is correctly flowing to your platform account. Use Stripe test cards (e.g. <code style="background:#2a2a3e;padding:1px 5px;border-radius:3px;color:#a5f3fc;">4242 4242 4242 4242</code>) in test mode.</p>
      ${enabled.length === 0 ? '<p style="color:#f87171;font-size:13px;">⚠️ No active Stripe accounts found. Connect at least one business first.</p>' : `
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <select id="testFeeSelect" style="background:#111827;border:1px solid #374151;color:#e4e6eb;padding:8px 12px;border-radius:8px;font-size:14px;">
          ${enabled.map((b: any) => `<option value="${b.id}">${escHtml(b.businessName || 'Unnamed')}</option>`).join('')}
        </select>
        <button onclick="runTestFee()" id="testFeeBtn" style="background:#7c3aed;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:14px;cursor:pointer;">🧪 Run Test ($1.00)</button>
        <span id="testFeeResult" style="font-size:13px;"></span>
      </div>`}
    </div>

    <!-- Fee Revenue Dashboard -->
    <div class="card" id="feeRevenueCard">
      <h2>💵 Platform Fee Revenue</h2>
      <p style="font-size:13px;color:#9ca3af;margin-bottom:14px;">Application fees collected from all connected business accounts, grouped by month. <span id="feeRevTotal" style="color:#4ade80;"></span></p>
      <div id="feeRevContent" style="font-size:13px;color:#9ca3af;">Loading...</div>
      <button onclick="loadFeeRevenue()" style="margin-top:12px;background:#1f2937;color:#9ca3af;border:1px solid #374151;padding:6px 14px;border-radius:8px;font-size:12px;cursor:pointer;">🔄 Refresh</button>
    </div>

    <!-- Webhook Setup Guide -->
    <div class="card" style="border:1px solid #f59e0b40;background:#f59e0b08;">
      <h2 style="color:#f59e0b;">⚡ Webhook Setup</h2>
      <p style="font-size:13px;color:#9ca3af;margin-bottom:14px;">Register your webhook endpoint with Stripe so card payments are confirmed automatically — even if the client closes the browser before being redirected back.</p>
      <div style="background:#1a1a2e;border-radius:8px;padding:14px;margin-bottom:14px;font-family:monospace;font-size:12px;color:#a5f3fc;word-break:break-all;">
        ${serverDomain}/api/stripe-connect/webhook
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <button onclick="registerWebhook()" id="registerWebhookBtn"
          style="background:#f59e0b;color:#1a1a2e;padding:10px 20px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">
          🔗 Register Webhook Automatically
        </button>
        <span id="webhookRegResult" style="font-size:13px;"></span>
      </div>
      <div style="font-size:12px;color:#6b7280;border-top:1px solid #f59e0b20;padding-top:12px;">
        <strong style="color:#9ca3af;">Manual option:</strong> Go to <a href="https://dashboard.stripe.com/webhooks" target="_blank" style="color:#60a5fa;">Stripe Dashboard → Webhooks</a>, add the URL above, select <code style="background:#2a2a3e;padding:1px 5px;border-radius:3px;color:#a5f3fc;">checkout.session.completed</code> event, then paste the signing secret into <a href="/api/admin/platform-config" style="color:#60a5fa;">Platform Config → STRIPE_CONNECT_WEBHOOK_SECRET</a>.
      </div>
    </div>
    <script>
    function runTestFee() {
      var btn = document.getElementById('testFeeBtn');
      var result = document.getElementById('testFeeResult');
      var select = document.getElementById('testFeeSelect');
      if (!select) return;
      btn.disabled = true;
      btn.textContent = 'Creating session...';
      result.textContent = '';
      fetch('/api/admin/stripe-connect/test-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessOwnerId: select.value })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok && d.url) {
          result.style.color = '#4ade80';
          result.innerHTML = '✅ Session created! Fee: <strong>' + d.feePercent + '% = ' + d.feeCents + '¢</strong>. <a href="' + d.url + '" target="_blank" style="color:#60a5fa;">Open Checkout →</a>';
          btn.textContent = '🧪 Run Test ($1.00)';
          btn.disabled = false;
        } else {
          result.style.color = '#f87171';
          result.textContent = '❌ ' + (d.error || 'Failed');
          btn.textContent = '🧪 Run Test ($1.00)';
          btn.disabled = false;
        }
      })
      .catch(function(e) {
        result.style.color = '#f87171';
        result.textContent = '❌ Network error: ' + e.message;
        btn.textContent = '🧪 Run Test ($1.00)';
        btn.disabled = false;
      });
    }

    function loadFeeRevenue() {
      var content = document.getElementById('feeRevContent');
      var total = document.getElementById('feeRevTotal');
      content.textContent = 'Loading...';
      fetch('/api/admin/stripe-connect/fee-revenue')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.ok) { content.innerHTML = '<span style="color:#f87171;">❌ ' + (d.error || 'Failed') + '</span>'; return; }
        total.textContent = 'All-time total: $' + d.totalAllTimeDollars + (d.hasMore ? ' (showing last 100)' : '');
        if (!d.months.length) { content.innerHTML = '<span style="color:#6b7280;">No application fees recorded yet.</span>'; return; }
        var html = '<table style="width:100%;border-collapse:collapse;">';
        html += '<thead><tr><th style="text-align:left;padding:6px 10px;font-size:11px;color:#6b7280;border-bottom:1px solid #1f2937;">Month</th><th style="text-align:right;padding:6px 10px;font-size:11px;color:#6b7280;border-bottom:1px solid #1f2937;">Transactions</th><th style="text-align:right;padding:6px 10px;font-size:11px;color:#6b7280;border-bottom:1px solid #1f2937;">Revenue</th></tr></thead><tbody>';
        d.months.forEach(function(m) {
          html += '<tr style="border-bottom:1px solid #1f2937;"><td style="padding:8px 10px;color:#e4e6eb;">' + m.month + '</td><td style="padding:8px 10px;text-align:right;color:#9ca3af;">' + m.count + '</td><td style="padding:8px 10px;text-align:right;color:#4ade80;font-weight:600;">$' + m.totalDollars + '</td></tr>';
        });
        html += '</tbody></table>';
        content.innerHTML = html;
      })
      .catch(function(e) { content.innerHTML = '<span style="color:#f87171;">❌ Network error: ' + e.message + '</span>'; });
    }

    // Auto-load fee revenue on page load
    window.addEventListener('DOMContentLoaded', function() { loadFeeRevenue(); });

    function registerWebhook() {
      var btn = document.getElementById('registerWebhookBtn');
      var result = document.getElementById('webhookRegResult');
      btn.disabled = true;
      btn.textContent = 'Registering...';
      result.textContent = '';
      fetch('/api/admin/stripe-connect/register-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverDomain: window.location.host })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) {
          result.style.color = '#4ade80';
          result.textContent = d.alreadyExists ? '✅ Already registered' : '✅ Registered! Signing secret saved automatically.';
          btn.textContent = '✅ Done';
        } else {
          result.style.color = '#f87171';
          result.textContent = '❌ ' + (d.error || 'Failed');
          btn.disabled = false;
          btn.textContent = '🔗 Register Webhook Automatically';
        }
      })
      .catch(function(e) {
        result.style.color = '#f87171';
        result.textContent = '❌ Network error: ' + e.message;
        btn.disabled = false;
        btn.textContent = '🔗 Register Webhook Automatically';
      });
    }
    </script>

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
