import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";

// Read env
const envPath = "/home/ubuntu/manus-scheduler/.env";
let dbUrl = "";
try {
  const env = readFileSync(envPath, "utf8");
  const match = env.match(/DATABASE_URL=["']?([^\n"']+)/);
  if (match) dbUrl = match[1];
} catch {}

if (!dbUrl) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

const conn = await createConnection(dbUrl);
const [rows] = await conn.execute("SELECT configKey, LEFT(configValue, 30) as val, isSensitive FROM platform_config");
console.log(JSON.stringify(rows, null, 2));
await conn.end();
