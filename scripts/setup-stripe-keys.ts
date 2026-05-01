import { getDb } from '../server/db';
import { platformConfig } from '../drizzle/schema';
import { eq, or } from 'drizzle-orm';

const LIVE_SECRET_KEY = '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';
const LIVE_PUBLISHABLE_KEY = 'pk_live_51REIGbG6LQX4qfeVElasCwiOtt4TXnBma2c5B66NqOjTepqZjqRhZEr6afGagShHrbTyT4cD3vEDN6rUPCsP0Y4b003eHvwtuz';
const TEST_SECRET_KEY = 'sk_test_51REIGbG6LQX4qfeV'; // prefix only for lookup
const TEST_PUBLISHABLE_KEY = 'pk_test_51REIGbG6LQX4qfeV'; // prefix only for lookup

async function upsertKey(db: any, key: string, value: string, description: string) {
  // Check if exists
  const existing = await db.select().from(platformConfig).where(eq(platformConfig.configKey, key));
  if (existing.length > 0) {
    await db.update(platformConfig)
      .set({ configValue: value, description, isSensitive: true })
      .where(eq(platformConfig.configKey, key));
    console.log(`Updated: ${key} = ${value.substring(0, 20)}...`);
  } else {
    await db.insert(platformConfig).values({
      configKey: key,
      configValue: value,
      isSensitive: true,
      description,
    });
    console.log(`Inserted: ${key} = ${value.substring(0, 20)}...`);
  }
}

async function main() {
  const db = await getDb();
  if (!db) { console.error('no db'); process.exit(1); }

  // First, get the current test keys from DB (rows 5 & 6 have the test keys)
  const currentRows = await db.select().from(platformConfig)
    .where(or(
      eq(platformConfig.configKey, 'STRIPE_SECRET_KEY'),
      eq(platformConfig.configKey, 'STRIPE_PUBLISHABLE_KEY')
    ));

  let currentTestSecret = '';
  let currentTestPub = '';
  for (const row of currentRows) {
    if (row.configKey === 'STRIPE_SECRET_KEY') currentTestSecret = row.configValue ?? '';
    if (row.configKey === 'STRIPE_PUBLISHABLE_KEY') currentTestPub = row.configValue ?? '';
  }

  console.log('Current active keys:');
  console.log('  STRIPE_SECRET_KEY:', currentTestSecret.substring(0, 20) + '...');
  console.log('  STRIPE_PUBLISHABLE_KEY:', currentTestPub.substring(0, 20) + '...');

  // Store test keys separately (if they start with sk_test / pk_test)
  if (currentTestSecret.startsWith('sk_test_')) {
    await upsertKey(db, 'STRIPE_TEST_SECRET_KEY', currentTestSecret, 'Stripe test mode secret key');
  }
  if (currentTestPub.startsWith('pk_test_')) {
    await upsertKey(db, 'STRIPE_TEST_PUBLISHABLE_KEY', currentTestPub, 'Stripe test mode publishable key');
  }

  // Store live keys separately
  await upsertKey(db, 'STRIPE_LIVE_SECRET_KEY', LIVE_SECRET_KEY, 'Stripe live mode secret key');
  await upsertKey(db, 'STRIPE_LIVE_PUBLISHABLE_KEY', LIVE_PUBLISHABLE_KEY, 'Stripe live mode publishable key');

  // Update the active keys (rows 5 & 6) to live mode
  await db.update(platformConfig)
    .set({ configValue: LIVE_SECRET_KEY, description: 'Active Stripe secret key (currently: live mode)' })
    .where(eq(platformConfig.configKey, 'STRIPE_SECRET_KEY'));
  console.log('Updated STRIPE_SECRET_KEY → live mode');

  await db.update(platformConfig)
    .set({ configValue: LIVE_PUBLISHABLE_KEY, description: 'Active Stripe publishable key (currently: live mode)' })
    .where(eq(platformConfig.configKey, 'STRIPE_PUBLISHABLE_KEY'));
  console.log('Updated STRIPE_PUBLISHABLE_KEY → live mode');

  // Final verification
  console.log('\nFinal state:');
  const allStripe = await db.select().from(platformConfig)
    .where(or(
      eq(platformConfig.configKey, 'STRIPE_SECRET_KEY'),
      eq(platformConfig.configKey, 'STRIPE_PUBLISHABLE_KEY'),
      eq(platformConfig.configKey, 'STRIPE_LIVE_SECRET_KEY'),
      eq(platformConfig.configKey, 'STRIPE_LIVE_PUBLISHABLE_KEY'),
      eq(platformConfig.configKey, 'STRIPE_TEST_SECRET_KEY'),
      eq(platformConfig.configKey, 'STRIPE_TEST_PUBLISHABLE_KEY')
    ));
  for (const row of allStripe) {
    console.log(`  [${row.id}] ${row.configKey}: ${(row.configValue ?? '').substring(0, 20)}...`);
  }

  process.exit(0);
}
main().catch(console.error);
