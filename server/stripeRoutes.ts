/**
 * Stripe subscription routes
 * - POST /api/stripe/create-checkout  → create a Stripe Checkout session
 * - POST /api/stripe/webhook          → handle Stripe webhook events
 * - GET  /api/stripe/success          → success redirect page
 * - GET  /api/stripe/cancel           → cancel redirect page
 */
import express, { Express, Request, Response } from "express";
import Stripe from "stripe";
import { getDb } from "./db";
import { businessOwners } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { sendSubscriptionConfirmationEmail } from "./email";
import { getPlatformConfig, getPublicPlans } from "./subscription";
// Keys are read from DB (Admin Panel) at request time
// When STRIPE_TEST_MODE=true, test keys are used exclusively
async function getStripeSecretKey(): Promise<string> {
  const testMode = await getPlatformConfig("STRIPE_TEST_MODE").catch(() => "");
  if (testMode === "true") {
    const testKey = await getPlatformConfig("STRIPE_TEST_SECRET_KEY").catch(() => "");
    return testKey || process.env.STRIPE_TEST_SECRET_KEY || "";
  }
  const dbKey = await getPlatformConfig("STRIPE_SECRET_KEY").catch(() => "");
  return dbKey || process.env.STRIPE_SECRET_KEY || "";
}
async function getStripeWebhookSecret(): Promise<string> {
  const testMode = await getPlatformConfig("STRIPE_TEST_MODE").catch(() => "");
  if (testMode === "true") {
    const testSecret = await getPlatformConfig("STRIPE_TEST_WEBHOOK_SECRET").catch(() => "");
    return testSecret || process.env.STRIPE_TEST_WEBHOOK_SECRET || "";
  }
  const dbSecret = await getPlatformConfig("STRIPE_WEBHOOK_SECRET").catch(() => "");
  return dbSecret || process.env.STRIPE_WEBHOOK_SECRET || "";
}
async function getStripePublishableKey(): Promise<string> {
  const testMode = await getPlatformConfig("STRIPE_TEST_MODE").catch(() => "");
  if (testMode === "true") {
    const testKey = await getPlatformConfig("STRIPE_TEST_PUBLISHABLE_KEY").catch(() => "");
    return testKey || process.env.STRIPE_TEST_PUBLISHABLE_KEY || "";
  }
  const dbKey = await getPlatformConfig("STRIPE_PUBLISHABLE_KEY").catch(() => "");
  return dbKey || process.env.STRIPE_PUBLISHABLE_KEY || "";
}

// Fallback prices in cents (used only if DB is unavailable)
const FALLBACK_PRICES: Record<string, { monthly: number; yearly: number; name: string }> = {
  solo:       { monthly: 0,     yearly: 0,     name: "Solo (Free)" },
  growth:     { monthly: 1900,  yearly: 19000, name: "Growth" },
  studio:     { monthly: 3900,  yearly: 39000, name: "Studio" },
  enterprise: { monthly: 6900,  yearly: 69000, name: "Enterprise" },
};

/** Read plan price from DB (Admin Panel), falling back to hardcoded values.
 * Returns EFFECTIVE prices (after any admin-set discount).
 */
async function getPlanPrice(planKey: string): Promise<{ monthly: number; yearly: number; name: string; discountPercent: number; discountLabel: string | null } | null> {
  try {
    const plans = await getPublicPlans();
    const plan = plans.find((p) => p.planKey === planKey);
    if (plan) {
      const monthly = parseFloat(plan.monthlyPrice as unknown as string);
      const yearly = parseFloat(plan.yearlyPrice as unknown as string);
      // Auto-expire discount if discountExpiresAt has passed
      const expiresAt = (plan as any).discountExpiresAt;
      const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
      const discPct = isExpired ? 0 : ((plan as any).discountPercent ?? 0);
      const discLabel = isExpired ? null : ((plan as any).discountLabel ?? null);
      // Apply discount to get effective price
      const effectiveMonthly = discPct > 0 ? monthly * (1 - discPct / 100) : monthly;
      const effectiveYearly = discPct > 0 ? yearly * (1 - discPct / 100) : yearly;
      return {
        monthly: Math.round(effectiveMonthly * 100),  // cents
        yearly: Math.round(effectiveYearly * 100),    // cents
        name: plan.displayName,
        discountPercent: discPct,
        discountLabel: discLabel,
      };
    }
  } catch (e) {
    console.warn("[Stripe] Could not read plan price from DB, using fallback", e);
  }
  const fb = FALLBACK_PRICES[planKey];
  return fb ? { ...fb, discountPercent: 0, discountLabel: null } : null;
}

async function getStripeAsync(): Promise<Stripe | null> {
  const key = await getStripeSecretKey();
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" as any });
}

export function registerStripeRoutes(app: Express): void {
  /**
   * POST /api/stripe/create-checkout
   * Body: { businessOwnerId, planKey, period: "monthly"|"yearly", successUrl, cancelUrl }
   */
  app.post("/api/stripe/create-checkout", async (req: Request, res: Response) => {
    const stripe = await getStripeAsync();
    if (!stripe) {
      res.status(500).json({ error: "Stripe not configured" });
      return;
    }

    const { businessOwnerId, planKey, period, successUrl, cancelUrl } = req.body as {
      businessOwnerId: number;
      planKey: string;
      period: "monthly" | "yearly";
      successUrl: string;
      cancelUrl: string;
    };

    if (!businessOwnerId || !planKey || !period) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const planInfo = await getPlanPrice(planKey);
    if (!planInfo) {
      res.status(400).json({ error: "Invalid plan key" });
      return;
    }

    // Solo plan is free — no checkout needed
    if (planKey === "solo") {
      // Just activate the free plan directly
      const db = await getDb();
      if (db) {
        await db.update(businessOwners)
          .set({
            subscriptionPlan: "solo",
            subscriptionStatus: "active",
            subscriptionPeriod: period,
          })
          .where(eq(businessOwners.id, businessOwnerId));
      }
      res.json({ url: null, free: true, activated: true });
      return;
    }

    const priceAmount = period === "monthly" ? planInfo.monthly : planInfo.yearly;
    const interval = period === "monthly" ? "month" : "year";

    try {
      // Get or create Stripe customer
      const db = await getDb();
      let stripeCustomerId: string | undefined;

      if (db) {
        const rows = await db.select().from(businessOwners).where(eq(businessOwners.id, businessOwnerId)).limit(1);
        const owner = rows[0];
        if (owner?.stripeCustomerId) {
          stripeCustomerId = owner.stripeCustomerId;
        } else {
          // Create new customer
          const customer = await stripe.customers.create({
            metadata: { businessOwnerId: String(businessOwnerId) },
            email: owner?.email ?? undefined,
          });
          stripeCustomerId = customer.id;
          await db.update(businessOwners)
            .set({ stripeCustomerId: customer.id })
            .where(eq(businessOwners.id, businessOwnerId));
        }
      }

      // Build product name — include discount label if applicable
      const productName = planInfo.discountPercent > 0
        ? `${planInfo.name} Plan (${period}) — ${planInfo.discountLabel ?? planInfo.discountPercent + '% off'}`
        : `${planInfo.name} Plan (${period})`;

      // Create a price on the fly with the effective (post-discount) amount
      const price = await stripe.prices.create({
        unit_amount: priceAmount,  // already discounted in getPlanPrice()
        currency: "usd",
        recurring: { interval },
        product_data: {
          name: productName,
        },
      });

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: stripeCustomerId,
        line_items: [{ price: price.id, quantity: 1 }],
        success_url: successUrl || `${req.headers.origin}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}&boid=${businessOwnerId}`,
        cancel_url: cancelUrl || `${req.headers.origin}/api/stripe/cancel?boid=${businessOwnerId}`,
        metadata: {
          businessOwnerId: String(businessOwnerId),
          planKey,
          period,
        },
        subscription_data: {
          metadata: {
            businessOwnerId: String(businessOwnerId),
            planKey,
            period,
          },
        },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (err) {
      console.error("[Stripe] create-checkout error:", err);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  /**
   * POST /api/stripe/webhook
   * Handles Stripe webhook events to activate subscriptions
   */
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    const stripe = await getStripeAsync();
    if (!stripe) {
      res.status(500).send("Stripe not configured");
      return;
    }

    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;

    const webhookSecret = await getStripeWebhookSecret();
    try {
      if (webhookSecret && sig) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        // In test mode without webhook secret, parse directly
        event = JSON.parse(req.body.toString()) as Stripe.Event;
      }
    } catch (err) {
      console.error("[Stripe] Webhook signature verification failed:", err);
      res.status(400).send("Webhook signature verification failed");
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).send("DB not available");
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const businessOwnerId = parseInt(session.metadata?.businessOwnerId ?? "0");
          const planKey = session.metadata?.planKey as "solo" | "growth" | "studio" | "enterprise";
          const period = session.metadata?.period as "monthly" | "yearly";
          const subscriptionId = session.subscription as string;

          if (businessOwnerId && planKey) {
            // Fetch subscription to get current period end
            let periodEnd: number | null = null;
            if (subscriptionId) {
              try {
                const sub = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
                // Use billing_cycle_anchor as the next renewal reference
                periodEnd = (sub as Stripe.Subscription).billing_cycle_anchor ?? null;
              } catch {}
            }
            await db.update(businessOwners)
              .set({
                subscriptionPlan: planKey,
                subscriptionStatus: "active",
                subscriptionPeriod: period ?? "monthly",
                stripeSubscriptionId: subscriptionId ?? null,
                stripeCurrentPeriodEnd: periodEnd,
              })
              .where(eq(businessOwners.id, businessOwnerId));
            console.log(`[Stripe] Activated ${planKey} plan for business ${businessOwnerId}`);

            // Send subscription confirmation email to business owner
            const ownerRows = await db.select().from(businessOwners)
              .where(eq(businessOwners.id, businessOwnerId)).limit(1);
            const owner = ownerRows[0];
            if (owner?.email) {
              // Use DB prices (already discounted) for the email
              const dbPriceInfo = await getPlanPrice(planKey).catch(() => null);
              const planName = dbPriceInfo?.name ?? FALLBACK_PRICES[planKey]?.name ?? planKey;
              const billingPeriod = (period ?? "monthly") === "yearly" ? "yearly" : "monthly";
              const amount = billingPeriod === "yearly"
                ? (dbPriceInfo?.yearly ?? FALLBACK_PRICES[planKey]?.yearly ?? 0) / 100
                : (dbPriceInfo?.monthly ?? FALLBACK_PRICES[planKey]?.monthly ?? 0) / 100;
              // Calculate next renewal date
              const nextRenewal = new Date();
              if (billingPeriod === "yearly") {
                nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
              } else {
                nextRenewal.setMonth(nextRenewal.getMonth() + 1);
              }
              sendSubscriptionConfirmationEmail(
                owner.email,
                owner.businessName,
                {
                  planName,
                  planKey,
                  billingPeriod,
                  amount,
                  nextRenewalDate: nextRenewal.toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric"
                  }),
                  ownerName: owner.ownerName ?? owner.businessName,
                }
              ).catch((e) => console.error("[Email] Subscription confirmation failed:", e));
            }
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const businessOwnerId = parseInt(subscription.metadata?.businessOwnerId ?? "0");
          if (businessOwnerId) {
            await db.update(businessOwners)
              .set({
                subscriptionPlan: "solo",
                subscriptionStatus: "free",
                stripeSubscriptionId: null,
              })
              .where(eq(businessOwners.id, businessOwnerId));
            console.log(`[Stripe] Subscription cancelled for business ${businessOwnerId}`);
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null };
          const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
          if (subId) {
            const rows = await db.select().from(businessOwners)
              .where(eq(businessOwners.stripeSubscriptionId, subId)).limit(1);
            if (rows[0]) {
              await db.update(businessOwners)
                .set({ subscriptionStatus: "expired" })
                .where(eq(businessOwners.id, rows[0].id));
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error("[Stripe] Webhook handler error:", err);
    }

    res.json({ received: true });
  });

  /**
   * GET /api/stripe/success
   * Called after successful Stripe Checkout — shows a success page
   */
  app.get("/api/stripe/success", async (req: Request, res: Response) => {
    const { session_id, boid } = req.query as { session_id?: string; boid?: string };
    const stripe = await getStripeAsync();

    // Try to activate subscription from session if webhook hasn't fired yet
    if (stripe && session_id && boid) {
      try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        const businessOwnerId = parseInt(boid);
        const planKey = session.metadata?.planKey as "solo" | "growth" | "studio" | "enterprise";
        const period = session.metadata?.period as "monthly" | "yearly";
        const subscriptionId = session.subscription as string;

        if (planKey && businessOwnerId) {
          const db = await getDb();
          if (db) {
            // Only update if not already active (avoid duplicate email from webhook)
            const existingRows = await db.select().from(businessOwners)
              .where(eq(businessOwners.id, businessOwnerId)).limit(1);
            const existing = existingRows[0];
            const alreadyActive = existing?.subscriptionPlan === planKey && existing?.subscriptionStatus === "active";
            if (!alreadyActive) {
              // Fetch subscription to get current period end
              let periodEndSuccess: number | null = null;
              if (subscriptionId) {
                try {
                  const sub = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
                  // Use billing_cycle_anchor as the next renewal reference
                  periodEndSuccess = (sub as Stripe.Subscription).billing_cycle_anchor ?? null;
                } catch {}
              }
              await db.update(businessOwners)
                .set({
                  subscriptionPlan: planKey,
                  subscriptionStatus: "active",
                  subscriptionPeriod: period ?? "monthly",
                  stripeSubscriptionId: subscriptionId ?? null,
                  stripeCurrentPeriodEnd: periodEndSuccess,
                })
                .where(eq(businessOwners.id, businessOwnerId));
              // Send confirmation email (webhook may not have fired yet)
              if (existing?.email) {
                // Use DB prices (already discounted) for the email
                const dbPriceInfoSuccess = await getPlanPrice(planKey).catch(() => null);
                const planName = dbPriceInfoSuccess?.name ?? FALLBACK_PRICES[planKey]?.name ?? planKey;
                const billingPeriod = (period ?? "monthly") === "yearly" ? "yearly" : "monthly";
                const amount = billingPeriod === "yearly"
                  ? (dbPriceInfoSuccess?.yearly ?? FALLBACK_PRICES[planKey]?.yearly ?? 0) / 100
                  : (dbPriceInfoSuccess?.monthly ?? FALLBACK_PRICES[planKey]?.monthly ?? 0) / 100;
                const nextRenewal = new Date();
                if (billingPeriod === "yearly") {
                  nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
                } else {
                  nextRenewal.setMonth(nextRenewal.getMonth() + 1);
                }
                sendSubscriptionConfirmationEmail(
                  existing.email,
                  existing.businessName,
                  {
                    planName,
                    planKey,
                    billingPeriod,
                    amount,
                    nextRenewalDate: nextRenewal.toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric"
                    }),
                    ownerName: existing.ownerName ?? existing.businessName,
                  }
                ).catch((e) => console.error("[Email] Success page email failed:", e));
              }
            }
          }
        }
      } catch (err) {
        console.error("[Stripe] Success page activation error:", err);
      }
    }

    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Subscription Activated</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #1A3A28; color: white; min-height: 100vh;
           display: flex; align-items: center; justify-content: center; }
    .card { background: rgba(255,255,255,0.1); border-radius: 24px; padding: 48px 32px;
            text-align: center; max-width: 380px; width: 90%; backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.15); }
    .icon { font-size: 64px; margin-bottom: 24px; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 12px; }
    p { font-size: 16px; color: rgba(255,255,255,0.75); line-height: 1.5; margin-bottom: 32px; }
    .btn { display: inline-block; background: #8FBF6A; color: #1A3A28; font-weight: 700;
           font-size: 16px; padding: 14px 32px; border-radius: 50px; text-decoration: none;
           cursor: pointer; border: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🎉</div>
    <h1>You're all set!</h1>
    <p>Your subscription is now active. Return to the Lime Of Time app to start managing your business.</p>
    <p style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:24px;">You can close this window and return to the app.</p>
    <button class="btn" onclick="window.close()">Close & Return to App</button>
  </div>
  <script>
    // Auto-close after 3 seconds if possible
    setTimeout(() => { try { window.close(); } catch(e) {} }, 3000);
  </script>
</body>
</html>`);
  });

  /**
   * POST /api/stripe/create-portal
   * Body: { businessOwnerId, returnUrl }
   * Creates a Stripe Customer Portal session and returns the URL
   */
  app.post("/api/stripe/create-portal", async (req: Request, res: Response) => {
    const stripe = await getStripeAsync();
    if (!stripe) {
      res.status(500).json({ error: "Stripe not configured" });
      return;
    }
    const { businessOwnerId, returnUrl } = req.body as { businessOwnerId: number; returnUrl: string };
    if (!businessOwnerId) {
      res.status(400).json({ error: "Missing businessOwnerId" });
      return;
    }
    try {
      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "DB not available" });
        return;
      }
      const rows = await db.select().from(businessOwners).where(eq(businessOwners.id, businessOwnerId)).limit(1);
      const owner = rows[0];
      if (!owner?.stripeCustomerId) {
        res.status(400).json({ error: "No Stripe customer found. Please subscribe first." });
        return;
      }
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: owner.stripeCustomerId,
        return_url: returnUrl || "https://lime-of-time.com",
      });
      res.json({ url: portalSession.url });
    } catch (err) {
      console.error("[Stripe] create-portal error:", err);
      res.status(500).json({ error: "Failed to create billing portal session" });
    }
  });

  /**
   * GET /api/stripe/cancel
   * Called when user cancels Stripe Checkout
   */
  app.get("/api/stripe/cancel", (_req: Request, res: Response) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Checkout Cancelled</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #1A3A28; color: white; min-height: 100vh;
           display: flex; align-items: center; justify-content: center; }
    .card { background: rgba(255,255,255,0.1); border-radius: 24px; padding: 48px 32px;
            text-align: center; max-width: 380px; width: 90%; backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.15); }
    .icon { font-size: 64px; margin-bottom: 24px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
    p { font-size: 15px; color: rgba(255,255,255,0.75); line-height: 1.5; margin-bottom: 24px; }
    .btn { display: inline-block; background: rgba(255,255,255,0.15); color: white; font-weight: 600;
           font-size: 15px; padding: 12px 28px; border-radius: 50px; text-decoration: none;
           cursor: pointer; border: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">↩️</div>
    <h1>Checkout Cancelled</h1>
    <p>No charge was made. You can return to the app and choose a plan whenever you're ready.</p>
    <button class="btn" onclick="window.close()">Close Window</button>
  </div>
</body>
</html>`);
  });
}
