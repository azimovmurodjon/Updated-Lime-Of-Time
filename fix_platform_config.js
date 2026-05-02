// Migration: copy values from lowercase keys to uppercase keys in platform_config
const { createConnection } = require('mysql2/promise');
require('dotenv').config({ path: '/home/ubuntu/manus-scheduler/.env' });

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);
  
  // Map of lowercase key -> uppercase key
  const migrations = [
    ['twilio_account_sid', 'TWILIO_ACCOUNT_SID'],
    ['twilio_auth_token', 'TWILIO_AUTH_TOKEN'],
    ['twilio_from_number', 'TWILIO_FROM_NUMBER'],
    ['twilio_test_mode', 'TWILIO_TEST_MODE'],
    ['twilio_test_otp', 'TWILIO_TEST_OTP'],
    ['stripe_secret_key', 'STRIPE_SECRET_KEY'],
    ['stripe_publishable_key', 'STRIPE_PUBLISHABLE_KEY'],
    ['stripe_webhook_secret', 'STRIPE_WEBHOOK_SECRET'],
    ['stripe_test_mode', 'STRIPE_TEST_MODE'],
  ];

  for (const [lowerKey, upperKey] of migrations) {
    // Get lowercase value
    const [lowerRows] = await conn.execute('SELECT configValue FROM platform_config WHERE configKey = ?', [lowerKey]);
    if (lowerRows.length === 0 || !lowerRows[0].configValue) {
      console.log(`SKIP ${lowerKey} -> ${upperKey}: no lowercase value`);
      continue;
    }
    const lowerVal = lowerRows[0].configValue;
    
    // Get uppercase value
    const [upperRows] = await conn.execute('SELECT configValue FROM platform_config WHERE configKey = ?', [upperKey]);
    const upperVal = upperRows.length > 0 ? upperRows[0].configValue : null;
    
    if (upperVal && upperVal.trim()) {
      console.log(`SKIP ${upperKey}: already has value (${upperVal.substring(0,15)}...)`);
    } else {
      // Copy lowercase value to uppercase row
      if (upperRows.length > 0) {
        await conn.execute('UPDATE platform_config SET configValue = ? WHERE configKey = ?', [lowerVal, upperKey]);
        console.log(`UPDATED ${upperKey} with value from ${lowerKey}: ${lowerVal.substring(0,20)}...`);
      } else {
        await conn.execute('INSERT INTO platform_config (configKey, configValue, isSensitive) VALUES (?, ?, 0)', [upperKey, lowerVal]);
        console.log(`INSERTED ${upperKey} with value from ${lowerKey}: ${lowerVal.substring(0,20)}...`);
      }
    }
  }

  // Also fix TWILIO_LIVE_FROM_NUMBER and TWILIO_LIVE_ACCOUNT_SID from active keys if they're empty
  // Copy TWILIO_FROM_NUMBER -> TWILIO_LIVE_FROM_NUMBER if live is empty
  const liveMigrations = [
    ['TWILIO_ACCOUNT_SID', 'TWILIO_LIVE_ACCOUNT_SID'],
    ['TWILIO_AUTH_TOKEN', 'TWILIO_LIVE_AUTH_TOKEN'],
    ['TWILIO_VERIFY_SERVICE_SID', 'TWILIO_LIVE_VERIFY_SERVICE_SID'],
    ['TWILIO_FROM_NUMBER', 'TWILIO_LIVE_FROM_NUMBER'],
  ];
  for (const [srcKey, destKey] of liveMigrations) {
    const [srcRows] = await conn.execute('SELECT configValue FROM platform_config WHERE configKey = ?', [srcKey]);
    const [destRows] = await conn.execute('SELECT configValue FROM platform_config WHERE configKey = ?', [destKey]);
    const srcVal = srcRows.length > 0 ? srcRows[0].configValue : null;
    const destVal = destRows.length > 0 ? destRows[0].configValue : null;
    if (srcVal && srcVal.trim() && (!destVal || !destVal.trim())) {
      if (destRows.length > 0) {
        await conn.execute('UPDATE platform_config SET configValue = ? WHERE configKey = ?', [srcVal, destKey]);
        console.log(`LIVE COPY ${srcKey} -> ${destKey}: ${srcVal.substring(0,20)}`);
      }
    }
  }

  console.log('\nDone! Final state:');
  const [all] = await conn.execute('SELECT configKey, LEFT(configValue, 25) as val_preview FROM platform_config WHERE configKey LIKE "TWILIO%" OR configKey LIKE "twilio%" ORDER BY configKey');
  all.forEach(r => console.log(`  ${r.configKey}: ${r.val_preview || '(empty)'}`));
  
  await conn.end();
}

main().catch(console.error);
