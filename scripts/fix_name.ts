import { getDb } from "../server/db";
import { businessOwners } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB connection"); process.exit(1); }
  
  await db.update(businessOwners)
    .set({ businessName: "Tech Store" })
    .where(eq(businessOwners.id, 120001));
  
  const [owner] = await db.select().from(businessOwners).where(eq(businessOwners.id, 120001));
  console.log("Updated business name to:", owner.businessName);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
