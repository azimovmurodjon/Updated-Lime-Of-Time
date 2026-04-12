import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load env
try { require('./scripts/load-env.js'); } catch(e) {}

const mysql = await import('mysql2/promise');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.log('No DATABASE_URL set');
  process.exit(0);
}

const conn = await mysql.default.createConnection(dbUrl);
const [rows] = await conn.execute('SELECT localId, name, address, city, state, zipCode, temporarilyClosed, reopenOn FROM locations LIMIT 20');
console.log('Locations in DB:');
console.log(JSON.stringify(rows, null, 2));

const [owners] = await conn.execute('SELECT id, businessName, phone FROM business_owners LIMIT 5');
console.log('\nBusiness owners:');
console.log(JSON.stringify(owners, null, 2));

await conn.end();
