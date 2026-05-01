import "./load-env.js";
import mysql from "mysql2/promise";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    await conn.execute(
      "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS discountMonths INT NOT NULL DEFAULT 0"
    );
    console.log("✅ discountMonths column added successfully");
  } catch (e: any) {
    if (e.code === "ER_DUP_FIELDNAME") {
      console.log("✅ discountMonths column already exists");
    } else {
      console.error("❌ Error:", e.message);
    }
  } finally {
    await conn.end();
  }
}
main();
