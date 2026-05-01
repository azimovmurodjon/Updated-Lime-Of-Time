'use strict';
const mysql = require('mysql2/promise');

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663347678319/Dw4mhfnuurFcniLsqjLpWN/lime-of-time-logo-HH94j7Qzx8hUa5yYyAa4nE.png';
const BUSINESS_ID = 1620003;

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');

  const conn = await mysql.createConnection(dbUrl);

  const [rows] = await conn.execute('SELECT id, data FROM business_owners WHERE id = ?', [BUSINESS_ID]);
  if (rows.length === 0) {
    console.log('Business not found');
    await conn.end();
    process.exit(1);
  }

  let data = {};
  try { data = JSON.parse(rows[0].data || '{}'); } catch (e) { /* empty */ }
  data.businessLogoUri = LOGO_URL;

  await conn.execute('UPDATE business_owners SET data = ? WHERE id = ?', [JSON.stringify(data), BUSINESS_ID]);
  console.log('Logo saved to DB data field');

  const [verify] = await conn.execute('SELECT data FROM business_owners WHERE id = ?', [BUSINESS_ID]);
  const vd = JSON.parse(verify[0].data || '{}');
  console.log('Verified businessLogoUri:', vd.businessLogoUri ? 'YES - ' + vd.businessLogoUri.substring(0, 60) : 'NOT SET');

  await conn.end();
  console.log('Done!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
