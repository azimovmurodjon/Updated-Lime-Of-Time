import { getDb } from '../server/db';
import { platformConfig } from '../drizzle/schema';
import { or, eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) {
    console.error('DB not available');
    process.exit(1);
  }
  
  const rows = await db.select().from(platformConfig)
    .where(or(
      eq(platformConfig.configKey, 'STRIPE_SECRET_KEY'),
      eq(platformConfig.configKey, 'STRIPE_PUBLISHABLE_KEY')
    ));
  
  console.log('Current DB Stripe keys:');
  for (const row of rows) {
    const prefix = (row.configValue ?? '').substring(0, 15);
    console.log(`  [${row.id}] ${row.configKey}: ${prefix}...`);
  }
  
  process.exit(0);
}

main().catch(console.error);
