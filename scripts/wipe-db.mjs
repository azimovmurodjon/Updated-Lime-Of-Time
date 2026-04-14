// Wipe all data from DB tables (preserving schema)
import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("./load-env.js");
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("No DATABASE_URL"); process.exit(1); }

const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!match) { console.error("Cannot parse DATABASE_URL"); process.exit(1); }
const [, user, password, host, port, database] = match;

const conn = await mysql.createConnection({
  host, port: parseInt(port), user, password, database,
  ssl: { rejectUnauthorized: true }
});

// Tables in dependency order (children first)
const tables = [
  "reviews",
  "appointments",
  "gift_cards",
  "discounts",
  "products",
  "services",
  "clients",
  "staff_members",
  "locations",
  "custom_schedule",
  "waitlist",
  "data_deletion_requests",
  "users",
  "business_owners",
];

console.log("Wiping all tables...");
await conn.execute("SET FOREIGN_KEY_CHECKS = 0");
for (const table of tables) {
  try {
    const [result] = await conn.execute(`DELETE FROM \`${table}\``);
    console.log(`  ✓ ${table}: ${result.affectedRows} rows deleted`);
  } catch (e) {
    console.log(`  ⚠ ${table}: ${e.message}`);
  }
}
await conn.execute("SET FOREIGN_KEY_CHECKS = 1");
await conn.end();
console.log("\nDB wiped. All tables are empty.");
