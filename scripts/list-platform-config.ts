import { getDb } from '../server/db';
import { platformConfig } from '../drizzle/schema';

async function main() {
  const db = await getDb();
  if (!db) { console.error('no db'); process.exit(1); }
  const rows = await db.select().from(platformConfig);
  for (const row of rows) {
    const val = row.configValue ?? '';
    const preview = val.substring(0, 20);
    console.log(`[${row.id}] ${row.configKey}: ${preview}...`);
  }
  process.exit(0);
}
main().catch(console.error);
