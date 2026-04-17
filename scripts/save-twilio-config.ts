import { getDb } from "../server/db";
import { platformConfig } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function save() {
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  const entries = [
    { key: "TWILIO_ACCOUNT_SID", value: "AC0eb74aa2bc903683b21defa8c07e763e", sensitive: true, desc: "Twilio Account SID" },
    { key: "TWILIO_AUTH_TOKEN", value: "7d157dfaa5f33ea090bdecbf8eb68130", sensitive: true, desc: "Twilio Auth Token" },
    { key: "TWILIO_FROM_NUMBER", value: "+19707070774", sensitive: false, desc: "Twilio From Phone Number" },
    { key: "TWILIO_TEST_MODE", value: "false", sensitive: false, desc: "Twilio Test Mode" },
  ];

  for (const e of entries) {
    const existing = await db.select().from(platformConfig).where(eq(platformConfig.configKey, e.key)).limit(1);
    if (existing.length > 0) {
      await db.update(platformConfig).set({ configValue: e.value, updatedAt: new Date() }).where(eq(platformConfig.configKey, e.key));
      console.log("Updated:", e.key);
    } else {
      await db.insert(platformConfig).values({ configKey: e.key, configValue: e.value, isSensitive: e.sensitive, description: e.desc });
      console.log("Inserted:", e.key);
    }
  }
  console.log("Done!");
  process.exit(0);
}

save().catch(e => { console.error(e); process.exit(1); });
