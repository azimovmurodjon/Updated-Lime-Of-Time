/**
 * Renewal Push Notification Cron
 *
 * Runs every hour and sends a push notification to business owners
 * whose subscription renews in exactly 3 days (within a 1-hour window).
 *
 * This fires once per day per business owner (the 3-day window check
 * ensures it doesn't fire multiple times for the same renewal).
 */
import { getDb } from "./db";
import { businessOwners } from "../drizzle/schema";
import { and, gt, isNotNull, ne } from "drizzle-orm";
import { sendExpoPush } from "./push";

const PLAN_DISPLAY: Record<string, string> = {
  solo: "Solo",
  growth: "Growth",
  studio: "Studio",
  enterprise: "Enterprise",
};

function formatRenewalDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

async function sendRenewalNotifications() {
  const db = await getDb();
  if (!db) return;

  const now = Math.floor(Date.now() / 1000);
  // 3 days from now: window is [now + 3 days, now + 3 days + 1 hour]
  const threeDaysFromNow = now + 3 * 24 * 60 * 60;
  const windowEnd = threeDaysFromNow + 60 * 60; // 1-hour window

  try {
    // Fetch all active paid subscribers with a push token and a known period end
    const owners = await db
      .select({
        id: businessOwners.id,
        businessName: businessOwners.businessName,
        subscriptionPlan: businessOwners.subscriptionPlan,
        subscriptionStatus: businessOwners.subscriptionStatus,
        stripeCurrentPeriodEnd: businessOwners.stripeCurrentPeriodEnd,
        expoPushToken: businessOwners.expoPushToken,
      })
      .from(businessOwners)
      .where(
        and(
          isNotNull(businessOwners.expoPushToken),
          isNotNull(businessOwners.stripeCurrentPeriodEnd),
          ne(businessOwners.subscriptionStatus, "free"),
          ne(businessOwners.subscriptionPlan, "solo"),
          gt(businessOwners.stripeCurrentPeriodEnd, now),
        )
      );

    let notified = 0;
    for (const owner of owners) {
      const periodEnd = owner.stripeCurrentPeriodEnd!;
      // Only notify if renewal is within the 3-day window (±1 hour)
      if (periodEnd >= threeDaysFromNow && periodEnd < windowEnd) {
        const planName = PLAN_DISPLAY[owner.subscriptionPlan ?? ""] ?? owner.subscriptionPlan ?? "your plan";
        const renewalDate = formatRenewalDate(periodEnd);
        const sent = await sendExpoPush(owner.expoPushToken!, {
          title: "Subscription Renewing in 3 Days",
          body: `Your ${planName} plan renews on ${renewalDate}. Manage billing in Settings → Subscription.`,
          data: { type: "subscription_renewal" },
          sound: "default",
        });
        if (sent) {
          notified++;
          console.log(`[RenewalCron] Notified owner ${owner.id} (${owner.businessName}) — renews ${renewalDate}`);
        }
      }
    }

    if (notified > 0) {
      console.log(`[RenewalCron] Sent ${notified} renewal notification(s)`);
    }
  } catch (err) {
    console.error("[RenewalCron] Error sending renewal notifications:", err);
  }
}

/**
 * Start the renewal notification cron.
 * Runs every hour; checks for subscriptions renewing in 3 days.
 */
export function startRenewalNotificationCron() {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  console.log("[RenewalCron] Started — checking every hour for 3-day renewal reminders");

  // Run immediately on startup (catches any missed notifications)
  sendRenewalNotifications().catch(console.error);

  // Then run every hour
  setInterval(() => {
    sendRenewalNotifications().catch(console.error);
  }, INTERVAL_MS);
}
