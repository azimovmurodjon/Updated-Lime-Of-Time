import mysql from 'mysql2/promise';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
require(join(__dirname, 'load-env.js'));

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Run each statement individually
const stmts = [
  // 1. Add subscription columns to business_owners
  `ALTER TABLE \`business_owners\`
    ADD COLUMN \`subscriptionPlan\` ENUM('solo','growth','studio','enterprise') NOT NULL DEFAULT 'solo',
    ADD COLUMN \`subscriptionStatus\` ENUM('trial','active','expired','free') NOT NULL DEFAULT 'free',
    ADD COLUMN \`subscriptionPeriod\` ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
    ADD COLUMN \`trialEndsAt\` TIMESTAMP NULL,
    ADD COLUMN \`stripeCustomerId\` VARCHAR(255) NULL,
    ADD COLUMN \`stripeSubscriptionId\` VARCHAR(255) NULL,
    ADD COLUMN \`adminOverride\` BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN \`adminOverrideNote\` TEXT NULL`,

  // 2. Create subscription_plans table
  `CREATE TABLE IF NOT EXISTS \`subscription_plans\` (
    \`id\` INT AUTO_INCREMENT PRIMARY KEY,
    \`planKey\` ENUM('solo','growth','studio','enterprise') NOT NULL UNIQUE,
    \`displayName\` VARCHAR(100) NOT NULL,
    \`monthlyPrice\` DECIMAL(10,2) NOT NULL DEFAULT 0,
    \`yearlyPrice\` DECIMAL(10,2) NOT NULL DEFAULT 0,
    \`maxClients\` INT NOT NULL DEFAULT -1,
    \`maxAppointments\` INT NOT NULL DEFAULT -1,
    \`maxLocations\` INT NOT NULL DEFAULT -1,
    \`maxStaff\` INT NOT NULL DEFAULT -1,
    \`maxServices\` INT NOT NULL DEFAULT -1,
    \`maxProducts\` INT NOT NULL DEFAULT -1,
    \`smsLevel\` ENUM('none','confirmations','full') NOT NULL DEFAULT 'none',
    \`paymentLevel\` ENUM('basic','full') NOT NULL DEFAULT 'basic',
    \`isPublic\` BOOLEAN NOT NULL DEFAULT FALSE,
    \`sortOrder\` INT NOT NULL DEFAULT 0,
    \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // 3. Create platform_config table
  `CREATE TABLE IF NOT EXISTS \`platform_config\` (
    \`id\` INT AUTO_INCREMENT PRIMARY KEY,
    \`configKey\` VARCHAR(100) NOT NULL UNIQUE,
    \`configValue\` TEXT NULL,
    \`isSensitive\` BOOLEAN NOT NULL DEFAULT FALSE,
    \`description\` TEXT NULL,
    \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // 4. Seed subscription plans
  `INSERT INTO \`subscription_plans\` (\`planKey\`, \`displayName\`, \`monthlyPrice\`, \`yearlyPrice\`, \`maxClients\`, \`maxAppointments\`, \`maxLocations\`, \`maxStaff\`, \`maxServices\`, \`maxProducts\`, \`smsLevel\`, \`paymentLevel\`, \`isPublic\`, \`sortOrder\`) VALUES
    ('solo',       'Solo',       0.00,   0.00,  20,  50, 1,   1,   5,   5,   'none',          'basic', TRUE,  1),
    ('growth',     'Growth',     19.00, 190.00, 100, -1, 1,   2,   20,  20,  'confirmations', 'basic', TRUE,  2),
    ('studio',     'Studio',     39.00, 390.00, -1,  -1, 3,   10,  -1,  -1,  'full',          'full',  FALSE, 3),
    ('enterprise', 'Enterprise', 69.00, 690.00, -1,  -1, 10,  100, -1,  -1,  'full',          'full',  FALSE, 4)
  ON DUPLICATE KEY UPDATE
    \`displayName\`     = VALUES(\`displayName\`),
    \`monthlyPrice\`    = VALUES(\`monthlyPrice\`),
    \`yearlyPrice\`     = VALUES(\`yearlyPrice\`),
    \`maxClients\`      = VALUES(\`maxClients\`),
    \`maxAppointments\` = VALUES(\`maxAppointments\`),
    \`maxLocations\`    = VALUES(\`maxLocations\`),
    \`maxStaff\`        = VALUES(\`maxStaff\`),
    \`maxServices\`     = VALUES(\`maxServices\`),
    \`maxProducts\`     = VALUES(\`maxProducts\`),
    \`smsLevel\`        = VALUES(\`smsLevel\`),
    \`paymentLevel\`    = VALUES(\`paymentLevel\`),
    \`isPublic\`        = VALUES(\`isPublic\`),
    \`sortOrder\`       = VALUES(\`sortOrder\`)`,

  // 5. Seed platform config keys
  `INSERT INTO \`platform_config\` (\`configKey\`, \`configValue\`, \`isSensitive\`, \`description\`) VALUES
    ('TWILIO_ACCOUNT_SID',    NULL,   TRUE,  'Twilio Account SID from console.twilio.com'),
    ('TWILIO_AUTH_TOKEN',     NULL,   TRUE,  'Twilio Auth Token from console.twilio.com'),
    ('TWILIO_FROM_NUMBER',    NULL,   FALSE, 'Twilio phone number in E.164 format e.g. +14125551234'),
    ('TWILIO_TEST_MODE',      'true', FALSE, 'When true, OTP is always 123456 (disable before going live)'),
    ('STRIPE_PUBLISHABLE_KEY', NULL,  FALSE, 'Stripe publishable key (pk_test_... or pk_live_...)'),
    ('STRIPE_SECRET_KEY',     NULL,   TRUE,  'Stripe secret key (sk_test_... or sk_live_...)'),
    ('STRIPE_WEBHOOK_SECRET', NULL,   TRUE,  'Stripe webhook signing secret (whsec_...)')
  ON DUPLICATE KEY UPDATE \`description\` = VALUES(\`description\`)`,
];

for (let i = 0; i < stmts.length; i++) {
  try {
    await conn.execute(stmts[i]);
    console.log(`[${i+1}/${stmts.length}] OK`);
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log(`[${i+1}/${stmts.length}] SKIP (already exists): ${e.code}`);
    } else {
      console.error(`[${i+1}/${stmts.length}] ERROR: ${e.message} (${e.code})`);
    }
  }
}

await conn.end();
console.log('\nMigration complete.');
