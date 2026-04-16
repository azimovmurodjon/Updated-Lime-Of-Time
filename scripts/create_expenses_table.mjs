import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([^?]+)/);
if (!match) { console.error('Could not parse DATABASE_URL'); process.exit(1); }
const [, user, pass, host, port, db] = match;

const conn = await createConnection({ host, port: parseInt(port), user, password: pass, database: db, ssl: { rejectUnauthorized: false } });

try {
  await conn.execute(`CREATE TABLE IF NOT EXISTS admin_expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    \`date\` VARCHAR(10) NOT NULL,
    category ENUM('hosting','marketing','software','payroll','legal','other') NOT NULL DEFAULT 'other',
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    notes TEXT,
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP
  )`);
  console.log('admin_expenses table created (or already exists)');
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
} finally {
  await conn.end();
}
