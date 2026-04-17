import { getDb } from "../server/db";
import { platformConfig } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) { console.error("DB not available"); process.exit(1); }

  const updates = [
    { key: "TWILIO_FROM_NUMBER", value: "+19707070774" },
    { key: "TWILIO_TEST_MODE", value: "false" },
  ];

  for (const { key, value } of updates) {
    const existing = await db.select().from(platformConfig).where(eq(platformConfig.configKey, key)).limit(1);
    if (existing.length > 0) {
      await db.update(platformConfig).set({ configValue: value, updatedAt: new Date() }).where(eq(platformConfig.configKey, key));
      console.log(`✓ Updated ${key} = ${value}`);
    } else {
      await db.insert(platformConfig).values({ configKey: key, configValue: value, isSensitive: false, description: key });
      console.log(`✓ Inserted ${key} = ${value}`);
    }
  }
  console.log("Done.");
}

run().catch(console.error).finally(() => process.exit(0));
