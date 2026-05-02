// Save all Stripe and Twilio credentials to the platform_config table
const mysql = require('mysql2/promise');

async function main() {
  const dbUrl = 'mysql://3AafxdxuLDwTXdt.root:64kw7R1KbHJc3SYgqz5g@gateway05.us-east-1.prod.aws.tidbcloud.com:4000/Dw4mhfnuurFcniLsqjLpWN?ssl={"rejectUnauthorized":true}';
  const conn = await mysql.createConnection(dbUrl);

  const credentials = [
    // Stripe Live
    ['STRIPE_LIVE_SECRET_KEY', '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'],
    ['STRIPE_LIVE_PUBLISHABLE_KEY', 'pk_live_51REIGbG6LQX4qfeVElasCwiOtt4TXnBma2c5B66NqOjTepqZjqRhZEr6afGagShHrbTyT4cD3vEDN6rUPCsP0Y4b003eHvwtuz'],
    ['STRIPE_LIVE_WEBHOOK_SECRET', 're_aCMbjFnQ_HvEdYL8rgrKrjEuu4hy5dBCi'],
    // Stripe Test
    ['STRIPE_TEST_SECRET_KEY', 'sk_test_51REIGbG6LQX4qfeVbBFQM3haHQQ0zInUNJTEeYJ2Bu7MiIPEbNsyX94ULB8U1KSFP4azC31u0P6puNuFDwFAfenl00jmavr4X0'],
    ['STRIPE_TEST_PUBLISHABLE_KEY', 'pk_test_51REIGbG6LQX4qfeVRXbxu8HGRslT0jbjhuQmiDZeai1QPBC0zukmY1xiXTch8bVDuNNEgH0N2TMbX7sq9ZJgFZwh00DOmiSfiB'],
    // Twilio Live
    ['TWILIO_LIVE_ACCOUNT_SID', 'AC0eb74aa2bc903683b21defa8c07e763e'],
    ['TWILIO_LIVE_AUTH_TOKEN', '7bf97543f4142ac84364fc863b6c7e4a'],
    // Twilio Test
    ['TWILIO_TEST_ACCOUNT_SID', 'VA7348fcb20a15c8ebd03d1f789d1b005b'],
    ['TWILIO_TEST_AUTH_TOKEN', '7d157dfaa5f33ea090bdecbf8eb68130'],
  ];

  for (const [key, value] of credentials) {
    await conn.execute(
      'INSERT INTO platform_config (configKey, configValue, isSensitive) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE configValue = ?',
      [key, value, value]
    );
    console.log(`Saved: ${key}`);
  }

  // Show all platform config keys
  const [rows] = await conn.execute(
    "SELECT configKey, configValue FROM platform_config ORDER BY configKey"
  );
  console.log('\nAll platform config keys:');
  for (const row of rows) {
    const val = row.configValue || '';
    const masked = val.length > 8 ? val.substring(0, 8) + '...' : val;
    console.log(`  ${row.configKey}: ${masked}`);
  }

  await conn.end();
  console.log('\nDone!');
}

main().catch(console.error);
