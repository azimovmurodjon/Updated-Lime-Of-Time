import { createConnection } from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
const OWNER_ID = 660001;

async function main() {
  const conn = await createConnection(DB_URL);
  
  // Check gift card balances
  console.log('=== Gift Card Details ===');
  const [gcs] = await conn.execute(
    'SELECT code, message, expiresAt FROM gift_cards WHERE businessOwnerId = ?',
    [OWNER_ID]
  );
  gcs.forEach(g => console.log(`  ${g.code}: msg="${g.message?.substring(0,100)}" expires=${g.expiresAt}`));
  
  // Check gift card original values via the API
  const gc2 = await fetch('http://localhost:3000/api/public/gift/LIME-GIFT-002').then(r => r.json());
  console.log('\nLIME-GIFT-002 API response:');
  console.log('  originalValue:', gc2.originalValue);
  console.log('  remainingBalance:', gc2.remainingBalance);
  console.log('  redeemed:', gc2.redeemed);
  
  // Check extraItems
  console.log('\n=== Appointments with extraItems ===');
  const [appts] = await conn.execute(
    'SELECT localId, extraItems FROM appointments WHERE businessOwnerId = ? AND extraItems IS NOT NULL',
    [OWNER_ID]
  );
  appts.forEach(a => {
    console.log(`  ${a.localId}: extraItems type=${typeof a.extraItems}, value="${String(a.extraItems).substring(0,150)}"`);
    try {
      const parsed = JSON.parse(a.extraItems);
      console.log(`    -> parsed OK: ${JSON.stringify(parsed).substring(0,100)}`);
    } catch(e) {
      console.log(`    -> PARSE ERROR: ${e.message}`);
    }
  });
  
  // Check booking page HTML for address
  console.log('\n=== Booking Page Address Check ===');
  const res = await fetch('http://localhost:3000/api/book/d-xjxndn');
  const html = await res.text();
  
  // Find the biz-address-row content
  const addrMatch = html.match(/id="biz-address-row"[^>]*>([^<]*)</);
  console.log('  biz-address-row content:', addrMatch ? `"${addrMatch[1]}"` : 'not found');
  
  // Check for location names
  console.log('  "Downtown Studio" in HTML:', html.includes('Downtown Studio'));
  console.log('  "100 Main St" in HTML:', html.includes('100 Main St'));
  console.log('  "Pittsburgh" in HTML:', html.includes('Pittsburgh'));
  
  // Find what IS in the address area
  const bizAddrSection = html.match(/biz-address-row[\s\S]{0,200}/);
  if (bizAddrSection) {
    console.log('\n  Address section context:');
    console.log(' ', bizAddrSection[0].substring(0, 300));
  }
  
  await conn.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
