// Find business owner with phone 4124827733 and clear their Stripe connect data
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/home/ubuntu/manus-scheduler/.env' });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  // Find the business owner
  const [rows] = await conn.execute(
    "SELECT id, businessName, phone, email, stripeConnectAccountId, stripeConnectEnabled, stripeConnectOnboardingComplete, stripeCustomerId FROM businessOwners WHERE phone LIKE ?",
    ['%4124827733%']
  );
  
  console.log('Found business owners:', JSON.stringify(rows, null, 2));
  
  if (rows.length > 0) {
    const owner = rows[0];
    console.log(`\nClearing Stripe connect data for business #${owner.id} (${owner.businessName})...`);
    
    // Clear Stripe connect data so they can reconnect fresh
    await conn.execute(
      "UPDATE businessOwners SET stripeConnectAccountId = NULL, stripeConnectEnabled = 0, stripeConnectOnboardingComplete = 0 WHERE id = ?",
      [owner.id]
    );
    
    console.log('✅ Stripe connect data cleared successfully!');
    console.log('The business owner can now reconnect their Stripe account from scratch.');
  } else {
    console.log('No business owner found with phone 4124827733');
    
    // Show all business owners for reference
    const [all] = await conn.execute(
      "SELECT id, businessName, phone, email FROM businessOwners LIMIT 20"
    );
    console.log('\nAll business owners:', JSON.stringify(all, null, 2));
  }
  
  await conn.end();
}

main().catch(console.error);
