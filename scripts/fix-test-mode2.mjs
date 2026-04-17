import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.log('No DATABASE_URL'); process.exit(1); }

const conn = await createConnection(url);

// Check current value
const [rows] = await conn.execute('SELECT configKey, configValue FROM platform_config WHERE configKey = ?', ['TWILIO_TEST_MODE']);
console.log('Current TWILIO_TEST_MODE:', JSON.stringify(rows));

// Update to false
const [result] = await conn.execute('UPDATE platform_config SET configValue = ? WHERE configKey = ?', ['false', 'TWILIO_TEST_MODE']);
console.log('Update result:', JSON.stringify(result));

// Verify
const [rows2] = await conn.execute('SELECT configKey, configValue FROM platform_config WHERE configKey = ?', ['TWILIO_TEST_MODE']);
console.log('After update:', JSON.stringify(rows2));

await conn.end();
