/**
 * Migrate existing Stripe keys to the new STRIPE_LIVE_* naming convention.
 * - Copies STRIPE_SECRET_KEY → STRIPE_LIVE_SECRET_KEY (if not already set)
 * - Copies STRIPE_PUBLISHABLE_KEY → STRIPE_LIVE_PUBLISHABLE_KEY (if not already set)
 * - Shows current state of all Stripe keys
 */
import "dotenv/config";
import { getDb } from "../server/db";
import { platformConfig } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  // Read all current Stripe keys
  const rows = await db.select().from(platformConfig);
  const cfgMap: Record<string, string> = {};
  for (const row of rows) {
    cfgMap[row.configKey] = row.configValue || "";
  }

  console.log("\n=== Current Stripe Keys in DB ===");
  const stripeKeys = [
    "STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET",
    "STRIPE_TEST_MODE",
    "STRIPE_LIVE_SECRET_KEY", "STRIPE_LIVE_PUBLISHABLE_KEY", "STRIPE_LIVE_WEBHOOK_SECRET",
    "STRIPE_TEST_SECRET_KEY", "STRIPE_TEST_PUBLISHABLE_KEY", "STRIPE_TEST_WEBHOOK_SECRET",
  ];
  for (const key of stripeKeys) {
    const val = cfgMap[key] || "(not set)";
    const masked = val.length > 12 ? val.substring(0, 8) + "..." + val.slice(-4) : val;
    console.log(`  ${key}: ${masked}`);
  }

  // Upsert helper
  const upsert = async (key: string, value: string, sensitive: boolean, desc: string) => {
    const existing = await db.select().from(platformConfig).where(eq(platformConfig.configKey, key)).limit(1);
    if (existing.length > 0) {
      await db.update(platformConfig).set({ configValue: value }).where(eq(platformConfig.configKey, key));
      console.log(`  ✅ Updated ${key}`);
    } else {
      await db.insert(platformConfig).values({ configKey: key, configValue: value, isSensitive: sensitive, description: desc });
      console.log(`  ✅ Inserted ${key}`);
    }
  };

  console.log("\n=== Migrating Live Keys ===");

  // Copy STRIPE_SECRET_KEY → STRIPE_LIVE_SECRET_KEY if not already set
  if (!cfgMap["STRIPE_LIVE_SECRET_KEY"] && cfgMap["STRIPE_SECRET_KEY"]) {
    await upsert("STRIPE_LIVE_SECRET_KEY", cfgMap["STRIPE_SECRET_KEY"], true, "Stripe Secret Key (Live, stored separately)");
  } else if (cfgMap["STRIPE_LIVE_SECRET_KEY"]) {
    console.log("  ℹ️  STRIPE_LIVE_SECRET_KEY already set, skipping");
  } else {
    console.log("  ⚠️  STRIPE_SECRET_KEY not found, cannot migrate");
  }

  // Copy STRIPE_PUBLISHABLE_KEY → STRIPE_LIVE_PUBLISHABLE_KEY if not already set
  if (!cfgMap["STRIPE_LIVE_PUBLISHABLE_KEY"] && cfgMap["STRIPE_PUBLISHABLE_KEY"]) {
    await upsert("STRIPE_LIVE_PUBLISHABLE_KEY", cfgMap["STRIPE_PUBLISHABLE_KEY"], false, "Stripe Publishable Key (Live, stored separately)");
  } else if (cfgMap["STRIPE_LIVE_PUBLISHABLE_KEY"]) {
    console.log("  ℹ️  STRIPE_LIVE_PUBLISHABLE_KEY already set, skipping");
  } else {
    console.log("  ⚠️  STRIPE_PUBLISHABLE_KEY not found, cannot migrate");
  }

  // Ensure STRIPE_LIVE_WEBHOOK_SECRET row exists (empty placeholder if not set)
  if (!cfgMap["STRIPE_LIVE_WEBHOOK_SECRET"]) {
    // Check if STRIPE_WEBHOOK_SECRET has a live webhook secret (starts with whsec_)
    const activeWebhook = cfgMap["STRIPE_WEBHOOK_SECRET"] || "";
    if (activeWebhook.startsWith("whsec_")) {
      await upsert("STRIPE_LIVE_WEBHOOK_SECRET", activeWebhook, true, "Stripe Webhook Secret (Live, stored separately)");
    } else {
      await upsert("STRIPE_LIVE_WEBHOOK_SECRET", "", true, "Stripe Webhook Secret (Live, stored separately)");
      console.log("  ⚠️  STRIPE_LIVE_WEBHOOK_SECRET set to empty — please add via Admin Panel → Platform Config");
    }
  } else {
    console.log("  ℹ️  STRIPE_LIVE_WEBHOOK_SECRET already set, skipping");
  }

  console.log("\n=== Final State ===");
  const finalRows = await db.select().from(platformConfig);
  const finalMap: Record<string, string> = {};
  for (const row of finalRows) { finalMap[row.configKey] = row.configValue || ""; }
  for (const key of stripeKeys) {
    const val = finalMap[key] || "(not set)";
    const masked = val.length > 12 ? val.substring(0, 8) + "..." + val.slice(-4) : val;
    console.log(`  ${key}: ${masked}`);
  }

  console.log("\n✅ Migration complete!");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
