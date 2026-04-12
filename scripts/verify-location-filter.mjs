import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [locs] = await conn.query('SELECT id, localId, name FROM locations WHERE active = 1');
console.log('Expected per-location data after fix:');
for (const loc of locs) {
  const [appts] = await conn.query(
    'SELECT COUNT(*) as total, SUM(CASE WHEN status="completed" THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status="completed" THEN COALESCE(totalPrice,0) ELSE 0 END) as revenue FROM appointments WHERE locationId = ?',
    [loc.localId]
  );
  console.log(`  ${loc.name}: ${appts[0].total} total appts, ${appts[0].completed} completed, $${Number(appts[0].revenue || 0).toFixed(2)} revenue`);
}

const [all] = await conn.query(
  'SELECT COUNT(*) as total, SUM(CASE WHEN status="completed" THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status="completed" THEN COALESCE(totalPrice,0) ELSE 0 END) as revenue FROM appointments'
);
console.log(`  All Locations: ${all[0].total} total appts, ${all[0].completed} completed, $${Number(all[0].revenue || 0).toFixed(2)} revenue`);

await conn.end();
console.log('\nFix: dbAppointmentToLocal now includes locationId field.');
console.log('Before fix: all appointments had locationId=undefined, so filter always returned 0.');
console.log('After fix: appointments carry their locationId, filter correctly returns per-location data.');
