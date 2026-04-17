import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
const envPath = resolve(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
}

const url = envVars.DATABASE_URL;
if (!url) { console.log('No DATABASE_URL'); process.exit(1); }

const m = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!m) { console.log('Cannot parse URL:', url); process.exit(1); }

const conn = await createConnection({ 
  host: m[3], port: parseInt(m[4]), user: m[1], password: m[2], database: m[5] 
});

// Check current value
const [rows] = await conn.execute('SELECT config_key, config_value FROM platform_config WHERE config_key = ?', ['TWILIO_TEST_MODE']);
console.log('Current TWILIO_TEST_MODE:', JSON.stringify(rows));

// Update to false
await conn.execute('UPDATE platform_config SET config_value = ? WHERE config_key = ?', ['false', 'TWILIO_TEST_MODE']);
console.log('Updated TWILIO_TEST_MODE to false');

// Verify
const [rows2] = await conn.execute('SELECT config_key, config_value FROM platform_config WHERE config_key = ?', ['TWILIO_TEST_MODE']);
console.log('After update:', JSON.stringify(rows2));

await conn.end();
