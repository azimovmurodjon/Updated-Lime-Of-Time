import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read .env manually
const envPath = resolve(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
}

const liveSecret = envVars['STRIPE_SECRET_KEY'];
const livePub = envVars['STRIPE_PUBLISHABLE_KEY'];

console.log('Live secret key prefix:', liveSecret?.substring(0, 12));
console.log('Live publishable key prefix:', livePub?.substring(0, 12));
