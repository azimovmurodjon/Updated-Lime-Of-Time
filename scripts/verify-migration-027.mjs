import mysql from 'mysql2/promise';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
require(join(__dirname, 'load-env.js'));

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [plans] = await conn.execute(
  "SELECT planKey, displayName, monthlyPrice, isPublic FROM subscription_plans ORDER BY sortOrder"
);
console.log("subscription_plans:", JSON.stringify(plans, null, 2));

const [cols] = await conn.execute(
  "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='business_owners' AND TABLE_SCHEMA=DATABASE() AND COLUMN_NAME IN ('subscriptionPlan','subscriptionStatus','subscriptionPeriod','trialEndsAt','adminOverride','adminOverrideNote','stripeCustomerId','stripeSubscriptionId')"
);
console.log("new business_owners columns:", cols.map(c => c.COLUMN_NAME));

const [cfg] = await conn.execute(
  "SELECT configKey, isSensitive FROM platform_config ORDER BY id"
);
console.log("platform_config keys:", cfg.map(c => c.configKey));

await conn.end();
console.log("\nVerification complete.");
