import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load env
const require = createRequire(import.meta.url);
require(join(__dirname, 'load-env.js'));

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const sql = readFileSync(join(__dirname, '../drizzle/0027_subscription_platform.sql'), 'utf8');

// Split on semicolons, skip comments and empty
const stmts = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

for (const stmt of stmts) {
  try {
    await conn.execute(stmt);
    console.log('OK:', stmt.substring(0, 80).replace(/\n/g, ' '));
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('SKIP (already exists):', stmt.substring(0, 60).replace(/\n/g, ' '));
    } else {
      console.error('ERROR:', e.message);
      console.error('STMT:', stmt.substring(0, 120));
    }
  }
}

await conn.end();
console.log('Migration complete.');
