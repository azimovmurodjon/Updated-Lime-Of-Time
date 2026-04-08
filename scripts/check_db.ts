import * as db from "../server/db";

async function main() {
  try {
    const dbConn = await db.getDb();
    if (!dbConn) {
      console.log("DATABASE NOT CONNECTED - DATABASE_URL may not be set");
      process.exit(1);
    }
    
    // Try to get all business owners using raw SQL
    const { businessOwners } = await import("../drizzle/schema");
    const owners = await dbConn.select().from(businessOwners);
    
    if (owners.length === 0) {
      console.log("NO BUSINESS OWNERS FOUND IN DATABASE");
    } else {
      console.log(`Found ${owners.length} business owner(s):`);
      owners.forEach(o => {
        const slug = o.businessName.toLowerCase().replace(/\s+/g, "-");
        console.log(`  ID: ${o.id}, Name: "${o.businessName}", Slug: "${slug}"`);
      });
    }
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

main();
