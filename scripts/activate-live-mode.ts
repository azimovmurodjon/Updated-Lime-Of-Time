/**
 * Activate LIVE mode:
 * - Set STRIPE_LIVE_WEBHOOK_SECRET = whsec_1d82u9ikRdLAl2i51LO32sErH2IK9vz6
 * - Set STRIPE_TEST_WEBHOOK_SECRET = whsec_RFNNSd9Hi8tiQAYVeMpnrn6eeKfjBItQ
 * - Set active STRIPE_WEBHOOK_SECRET = live webhook secret
 * - Set active STRIPE_SECRET_KEY = live secret key (from STRIPE_LIVE_SECRET_KEY)
 * - Set active STRIPE_PUBLISHABLE_KEY = live publishable key (from STRIPE_LIVE_PUBLISHABLE_KEY)
 * - Set STRIPE_TEST_MODE = false
 */
import "dotenv/config";
import { getDb } from "../server/db";
import { platformConfig } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const LIVE_WEBHOOK_SECRET = "whsec_1d82u9ikRdLAl2i51LO32sErH2IK9vz6";
const TEST_WEBHOOK_SECRET = "whsec_RFNNSd9Hi8tiQAYVeMpnrn6eeKfjBItQ";

async function main() {
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  // Read all current config
  const rows = await db.select().from(platformConfig);
  const cfgMap: Record<string, string> = {};
  for (const row of rows) { cfgMap[row.configKey] = row.configValue || ""; }

  console.log("\n=== Before Update ===");
  const keys = [
    "STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_TEST_MODE",
    "STRIPE_LIVE_SECRET_KEY", "STRIPE_LIVE_PUBLISHABLE_KEY", "STRIPE_LIVE_WEBHOOK_SECRET",
    "STRIPE_TEST_SECRET_KEY", "STRIPE_TEST_PUBLISHABLE_KEY", "STRIPE_TEST_WEBHOOK_SECRET",
  ];
  for (const k of keys) {
    const v = cfgMap[k] || "(not set)";
    const masked = v.length > 12 ? v.substring(0, 10) + "..." + v.slice(-4) : v;
    console.log(`  ${k}: ${masked}`);
  }

  // Upsert helper
  const upsert = async (key: string, value: string, sensitive: boolean, desc: string) => {
    const existing = await db.select().from(platformConfig).where(eq(platformConfig.configKey, key)).limit(1);
    if (existing.length > 0) {
      await db.update(platformConfig).set({ configValue: value }).where(eq(platformConfig.configKey, key));
    } else {
      await db.insert(platformConfig).values({ configKey: key, configValue: value, isSensitive: sensitive, description: desc });
    }
    const masked = value.length > 12 ? value.substring(0, 10) + "..." + value.slice(-4) : value;
    console.log(`  ✅ Set ${key} = ${masked}`);
  };

  console.log("\n=== Updating Webhook Secrets ===");
  // Store live and test webhook secrets separately
  await upsert("STRIPE_LIVE_WEBHOOK_SECRET", LIVE_WEBHOOK_SECRET, true, "Stripe Webhook Secret (Live, stored separately)");
  await upsert("STRIPE_TEST_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET, true, "Stripe Webhook Secret (Test, stored separately)");

  console.log("\n=== Activating LIVE Mode ===");
  // Get live keys from DB
  const liveSecretKey = cfgMap["STRIPE_LIVE_SECRET_KEY"] || "";
  const livePublishableKey = cfgMap["STRIPE_LIVE_PUBLISHABLE_KEY"] || "";

  if (!liveSecretKey) {
    console.error("  ❌ STRIPE_LIVE_SECRET_KEY not found in DB! Cannot activate live mode.");
    process.exit(1);
  }

  // Swap active keys to live
  await upsert("STRIPE_SECRET_KEY", liveSecretKey, true, "Stripe Secret Key (active)");
  await upsert("STRIPE_PUBLISHABLE_KEY", livePublishableKey, false, "Stripe Publishable Key (active)");
  await upsert("STRIPE_WEBHOOK_SECRET", LIVE_WEBHOOK_SECRET, true, "Stripe Webhook Secret (active)");
  await upsert("STRIPE_TEST_MODE", "false", false, "Stripe Test Mode (true/false)");

  console.log("\n=== Final State ===");
  const finalRows = await db.select().from(platformConfig);
  const finalMap: Record<string, string> = {};
  for (const row of finalRows) { finalMap[row.configKey] = row.configValue || ""; }
  for (const k of keys) {
    const v = finalMap[k] || "(not set)";
    const masked = v.length > 12 ? v.substring(0, 10) + "..." + v.slice(-4) : v;
    console.log(`  ${k}: ${masked}`);
  }

  console.log("\n✅ LIVE mode activated! All Stripe operations now use live keys.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
