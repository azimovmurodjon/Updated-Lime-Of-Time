/**
 * One-time migration script: add payment method columns to business_owners table.
 * Run with: npx tsx scripts/add-payment-columns.ts
 */
import "./load-env.js";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection(url!);
  const alterStatements = [
    "ALTER TABLE `business_owners` ADD COLUMN IF NOT EXISTS `zelleHandle` varchar(255) NULL",
    "ALTER TABLE `business_owners` ADD COLUMN IF NOT EXISTS `cashAppHandle` varchar(255) NULL",
    "ALTER TABLE `business_owners` ADD COLUMN IF NOT EXISTS `venmoHandle` varchar(255) NULL",
    "ALTER TABLE `business_owners` ADD COLUMN IF NOT EXISTS `paymentNotes` text NULL",
  ];

  for (const sql of alterStatements) {
    try {
      await conn.execute(sql);
      console.log("✓", sql.substring(0, 80));
    } catch (err: any) {
      if (err.code === "ER_DUP_FIELDNAME") {
        console.log("⚠ Column already exists, skipping:", sql.substring(0, 80));
      } else {
        console.error("✗ Error:", err.message);
      }
    }
  }

  await conn.end();
  console.log("Done.");
}

main().catch(console.error);
