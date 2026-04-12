import * as dotenv from 'dotenv';
import { createConnection } from 'mysql2/promise';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('No DATABASE_URL found');
  process.exit(1);
}

// Parse mysql URL
const url = new URL(dbUrl);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port || '3306'),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false }
});

const [locations] = await conn.execute('SELECT id, localId, name, address, city, state, zipCode, temporarilyClosed, reopenOn FROM locations');
console.log('Locations in DB:', JSON.stringify(locations, null, 2));

await conn.end();
