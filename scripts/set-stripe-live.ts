import { getDb } from '../server/db';
import { platformConfig } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const LIVE_PUBLISHABLE_KEY = 'pk_live_51REIGbG6LQX4qfeVElasCwiOtt4TXnBma2c5B66NqOjTepqZjqRhZEr6afGagShHrbTyT4cD3vEDN6rUPCsP0Y4b003eHvwtuz';
// Secret key to be set once provided
const LIVE_SECRET_KEY = ''; // will be set separately

async function main() {
  const db = await getDb();
  if (!db) { console.error('no db'); process.exit(1); }

  // Update publishable key (row 5)
  await db.update(platformConfig)
    .set({ configValue: LIVE_PUBLISHABLE_KEY })
    .where(eq(platformConfig.configKey, 'STRIPE_PUBLISHABLE_KEY'));
  console.log('Updated STRIPE_PUBLISHABLE_KEY to live mode');

  // Verify
  const rows = await db.select().from(platformConfig)
    .where(eq(platformConfig.configKey, 'STRIPE_PUBLISHABLE_KEY'));
  for (const row of rows) {
    console.log(`  [${row.id}] ${row.configKey}: ${(row.configValue ?? '').substring(0, 20)}...`);
  }

  process.exit(0);
}
main().catch(console.error);
