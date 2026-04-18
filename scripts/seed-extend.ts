/**
 * Lime Of Time - Seed Extension Script
 * Extends existing seeded data to full demo dataset:
 * - Upgrades business owner to Unlimited (adminOverride)
 * - Adds 5th location
 * - Adds 42 more services (total 50)
 * - Adds 50 more clients (total 250)
 * - Adds 200 products
 * - Adds 25 gift cards
 * - Adds 10 discounts
 * - Adds ~1092 more appointments (total ~2000)
 *
 * Run: npx tsx scripts/seed-extend.ts
 */
import "../scripts/load-env.js";
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";

const DB_URL = process.env.DATABASE_URL!;
if (!DB_URL) throw new Error("DATABASE_URL not set");

const uid = () => randomUUID().replace(/-/g, "").slice(0, 24);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const pickN = <T>(arr: T[], n: number): T[] => [...arr].sort(() => 0.5 - Math.random()).slice(0, n);
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pad2 = (n: number) => String(n).padStart(2, "0");
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function daysFromNow(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function randomPastDate(minD: number, maxD: number) { return daysAgo(rand(minD, maxD)); }
function randomFutureDate(minD: number, maxD: number) { return daysFromNow(rand(minD, maxD)); }

const COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9','#F0B27A','#82E0AA','#F1948A','#AED6F1','#A9DFBF'];
const TIME_SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'];

const EXTRA_SERVICES = [
  {name:"Women's Haircut & Style",cat:'Hair',dur:60,price:75},{name:'Full Color',cat:'Hair',dur:120,price:145},{name:'Highlights',cat:'Hair',dur:150,price:185},{name:'Balayage',cat:'Hair',dur:180,price:220},{name:'Keratin Treatment',cat:'Hair',dur:180,price:250},{name:'Deep Conditioning',cat:'Hair',dur:30,price:40},{name:'Scalp Treatment',cat:'Hair',dur:45,price:65},{name:'Brazilian Blowout',cat:'Hair',dur:120,price:200},{name:'Hair Extensions Consultation',cat:'Hair',dur:30,price:0},{name:'Updo / Special Occasion',cat:'Hair',dur:90,price:120},
  {name:'Gel Manicure',cat:'Nails',dur:45,price:45},{name:'Classic Pedicure',cat:'Nails',dur:45,price:40},{name:'Gel Pedicure',cat:'Nails',dur:60,price:55},{name:'Acrylic Full Set',cat:'Nails',dur:90,price:65},{name:'Acrylic Fill',cat:'Nails',dur:60,price:45},{name:'Nail Art (per nail)',cat:'Nails',dur:30,price:5},{name:'Mani-Pedi Combo',cat:'Nails',dur:90,price:65},
  {name:'Classic Facial',cat:'Skin',dur:60,price:85},{name:'Anti-Aging Facial',cat:'Skin',dur:75,price:110},{name:'Acne Treatment Facial',cat:'Skin',dur:60,price:95},{name:'Microdermabrasion',cat:'Skin',dur:60,price:120},{name:'Chemical Peel',cat:'Skin',dur:45,price:100},{name:'LED Light Therapy',cat:'Skin',dur:30,price:60},{name:'Hydrafacial',cat:'Skin',dur:60,price:150},{name:'Dermaplaning',cat:'Skin',dur:45,price:90},
  {name:'Deep Tissue Massage 60 min',cat:'Massage',dur:60,price:105},{name:'Hot Stone Massage',cat:'Massage',dur:90,price:130},{name:'Prenatal Massage',cat:'Massage',dur:60,price:95},{name:'Sports Massage',cat:'Massage',dur:60,price:100},{name:'Couples Massage',cat:'Massage',dur:90,price:200},
  {name:'Classic Lash Extensions',cat:'Lashes & Brows',dur:120,price:150},{name:'Volume Lash Extensions',cat:'Lashes & Brows',dur:150,price:185},{name:'Lash Fill',cat:'Lashes & Brows',dur:60,price:75},{name:'Brow Lamination',cat:'Lashes & Brows',dur:45,price:65},{name:'Brow Tint & Shape',cat:'Lashes & Brows',dur:30,price:40},
  {name:'Full Leg Wax',cat:'Waxing',dur:60,price:70},{name:'Bikini Wax',cat:'Waxing',dur:30,price:45},{name:'Brazilian Wax',cat:'Waxing',dur:45,price:65},{name:'Underarm Wax',cat:'Waxing',dur:15,price:20},{name:'Facial Wax',cat:'Waxing',dur:20,price:25},
  {name:'Bridal Makeup',cat:'Makeup',dur:90,price:175},{name:'Special Event Makeup',cat:'Makeup',dur:60,price:95},{name:'Makeup Lesson',cat:'Makeup',dur:60,price:85},
  {name:'Body Wrap',cat:'Body',dur:90,price:120},{name:'Body Scrub',cat:'Body',dur:60,price:85},{name:'Spray Tan',cat:'Body',dur:30,price:50},
];

const FIRST_NAMES = ['Emma','Olivia','Ava','Isabella','Sophia','Mia','Charlotte','Amelia','Harper','Evelyn','Abigail','Emily','Elizabeth','Mila','Ella','Avery','Sofia','Camila','Aria','Scarlett','Victoria','Madison','Luna','Grace','Chloe','Penelope','Layla','Riley','Zoey','Nora','Lily','Eleanor','Hannah','Lillian','Addison','Aubrey','Ellie','Stella','Natalie','Zoe','Leah','Hazel','Violet','Aurora','Savannah','Audrey','Brooklyn','Bella','Claire','Skylar'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores'];

const BRANDS = ['Redken','Olaplex','Kerastase','Paul Mitchell','Wella','Matrix','Loreal','Schwarzkopf','Aveda','Bumble and Bumble','OPI','Essie','CND','Gelish','Sally Hansen','Dermalogica','Skinceuticals','Obagi','Jan Marini','Murad','Elemis','Bioderma','La Roche-Posay','Cetaphil','Neutrogena'];
const PRODUCT_NAMES = ['Color Care Shampoo','Moisture Boost Conditioner','Bond Repair Treatment','Heat Protectant Spray','Classic Red Nail Polish','Strengthening Base Coat','Gentle Foaming Cleanser','Daily Hydrating Moisturizer','Vitamin C Brightening Serum','SPF 50 Daily Sunscreen','Shea Butter Body Lotion','Relaxing Lavender Oil','Volume Lift Shampoo','Deep Moisture Conditioner','Keratin Mask','Texturizing Spray','Nude Blush Nail Polish','Cuticle Oil','Micellar Cleansing Water','Anti-Aging Day Cream','Hyaluronic Acid Serum','Tinted SPF 30','Firming Body Cream','Energizing Peppermint Oil','Repair Shampoo','Hydrating Conditioner','Hydrating Hair Mask','Strong Hold Gel','Coral Sunset Nail Polish','Nail Hardener','Exfoliating Gel Cleanser','Brightening Moisturizer','Retinol Night Serum','Mineral Sunscreen SPF 50','Hydrating Body Oil','Warming Ginger Oil','Scalp Detox Shampoo','Strengthening Conditioner','Protein Treatment','Flexible Hold Mousse','Berry Crush Nail Polish','Ridge Filler','Hydrating Milk Cleanser','Sensitive Skin Moisturizer','Niacinamide Pore Serum','Invisible SPF 30 Fluid','Sensitive Skin Body Lotion','Neutral Carrier Oil','Clarifying Shampoo','Detangling Conditioner','Scalp Serum','Shine Serum','Midnight Black Nail Polish','Top Coat Gel','Charcoal Deep Cleanse','Rich Night Cream','Peptide Firming Serum','Sport SPF 50','Brightening Body Lotion','Argan Oil Treatment','Volumizing Spray','Anti-Frizz Cream','Lavender Dream Nail Polish','Nail Repair Serum','Brightening Cleanser','Oil-Free Moisturizer','AHA BHA Exfoliating Serum','Ocean Blue Nail Polish','Rose Gold Nail Polish','Champagne Toast Nail Polish','Emerald City Nail Polish','Split End Repair','Curl Defining Cream','Lash Serum','Cuticle Remover Gel','Nail Strengthener','Pore Minimizing Toner','Eye Cream','Lip Treatment','Hand Cream','Foot Cream','Exfoliating Scrub','Clay Mask','Sheet Mask','Micellar Toner','Essence Serum','Eye Serum','Neck Cream','BB Cream SPF 30','CC Cream SPF 40','Primer Serum','Setting Spray','Makeup Remover','Cleansing Balm','Facial Mist','Sleeping Mask','Peel Off Mask','Charcoal Mask','Gold Mask','Vitamin E Oil','Rosehip Oil','Jojoba Oil','Coconut Hair Oil','Biotin Shampoo','Collagen Conditioner'];

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  console.log('Connected to DB');

  // Get existing data
  const [ownerRows] = await conn.query('SELECT id FROM business_owners LIMIT 1') as any;
  const ownerId = ownerRows[0].id;
  console.log('Business owner ID:', ownerId);

  const [svcRows] = await conn.query('SELECT localId FROM services WHERE businessOwnerId = ?', [ownerId]) as any;
  const existingSvcLocalIds: string[] = svcRows.map((r: any) => r.localId);
  console.log('Existing services:', existingSvcLocalIds.length);

  const [locRows] = await conn.query('SELECT localId FROM locations WHERE businessOwnerId = ?', [ownerId]) as any;
  const existingLocIds: string[] = locRows.map((r: any) => r.localId);
  console.log('Existing locations:', existingLocIds.length);

  const [clientRows] = await conn.query('SELECT localId FROM clients WHERE businessOwnerId = ?', [ownerId]) as any;
  const existingClientIds: string[] = clientRows.map((r: any) => r.localId);
  console.log('Existing clients:', existingClientIds.length);

  // 1. Upgrade business owner to Unlimited
  const trialEnd = new Date(); trialEnd.setFullYear(trialEnd.getFullYear() + 10);
  await conn.query(
    `UPDATE business_owners SET subscriptionPlan='enterprise', subscriptionStatus='active', subscriptionPeriod='yearly', adminOverride=1, adminOverrideNote='Demo account - Unlimited plan granted by admin', trialEndsAt=?, zelleHandle='LimeOfTime', cashAppHandle='$LimeOfTime', venmoHandle='@LimeOfTime', paymentNotes='We accept Cash, Zelle, Venmo, and Card payments.', instagramHandle='@limeoftimespa', facebookHandle='LimeOfTimeSpa', tiktokHandle='@limeoftimespa', autoCompleteEnabled=1, autoCompleteDelayMinutes=30, description='Pittsburgh''s premier beauty studio — hair, nails, skin, massage, lashes & more. Where luxury meets affordability.', website='https://lime-of-time.com', ownerName='Murodjon Azimov', email='muradjanazimov@gmail.com' WHERE id=?`,
    [trialEnd, ownerId]
  );
  console.log('✓ Business owner upgraded to Unlimited');

  // 2. Add 5th location
  const loc5Id = uid();
  const WH = JSON.stringify({ monday:{open:'09:00',close:'18:00',enabled:true}, tuesday:{open:'09:00',close:'18:00',enabled:true}, wednesday:{open:'09:00',close:'18:00',enabled:true}, thursday:{open:'09:00',close:'20:00',enabled:true}, friday:{open:'09:00',close:'20:00',enabled:true}, saturday:{open:'10:00',close:'17:00',enabled:true}, sunday:{open:'11:00',close:'16:00',enabled:false} });
  await conn.query(
    `INSERT INTO locations (businessOwnerId, localId, name, address, city, state, zipCode, phone, email, isDefault, active, workingHours, temporarilyClosed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [ownerId, loc5Id, 'South Hills Retreat', '1500 Washington Road', 'Pittsburgh', 'PA', '15228', '+14125551004', 'southhills@limeoftimespa.com', 0, 1, WH, 0]
  );
  const allLocIds = [...existingLocIds, loc5Id];
  console.log('✓ 5th location added');

  // 3. Add extra services
  const allSvcLocalIds = [...existingSvcLocalIds];
  for (const svc of EXTRA_SERVICES) {
    const localId = uid();
    await conn.query(
      `INSERT INTO services (businessOwnerId, localId, name, duration, price, color, category, description) VALUES (?,?,?,?,?,?,?,?)`,
      [ownerId, localId, svc.name, svc.dur, svc.price, pick(COLORS), svc.cat, `Professional ${svc.name} service at Lime Of Time Beauty Studio.`]
    );
    allSvcLocalIds.push(localId);
  }
  console.log(`✓ Added ${EXTRA_SERVICES.length} more services (total: ${allSvcLocalIds.length})`);

  // 4. Add 50 more clients
  const allClientIds = [...existingClientIds];
  for (let i = 0; i < 50; i++) {
    const fn = pick(FIRST_NAMES), ln = pick(LAST_NAMES);
    const ac = pick(['412','724','878','814','610']);
    const phone = `${ac}${rand(1000000, 9999999)}`;
    const localId = uid();
    await conn.query(
      `INSERT INTO clients (businessOwnerId, localId, name, phone, email) VALUES (?,?,?,?,?)`,
      [ownerId, localId, `${fn} ${ln}`, phone, `${fn.toLowerCase()}.${ln.toLowerCase()}${rand(1,99)}@gmail.com`]
    );
    allClientIds.push(localId);
  }
  console.log(`✓ Added 50 more clients (total: ${allClientIds.length})`);

  // 5. Add 200 products
  for (let i = 0; i < 200; i++) {
    const brand = pick(BRANDS);
    const pname = pick(PRODUCT_NAMES);
    const price = (rand(1200, 15000) / 100).toFixed(2);
    await conn.query(
      `INSERT INTO products (businessOwnerId, localId, name, price, description, available, brand) VALUES (?,?,?,?,?,?,?)`,
      [ownerId, uid(), `${brand} ${pname}`, price, `Professional ${pname.toLowerCase()} by ${brand}. ${pick(['Salon exclusive.','Best seller.','New formula.','Staff favorite.'])}`, rand(0,10)>1?1:0, brand]
    );
    if ((i+1) % 50 === 0) process.stdout.write(`\r  Products: ${i+1}/200`);
  }
  console.log('\n✓ 200 products added');

  // 6. Add 25 gift cards
  const GIFT_MSGS = ["Happy Birthday! Enjoy your pampering session!","Congratulations on your promotion!","Thank you for being an amazing friend!","Happy Mother's Day - you deserve this!","Happy Anniversary! Enjoy some relaxation.","You deserve a treat - enjoy your spa day!","Happy Holidays from all of us!","Thank you for everything you do!","Enjoy your special day!","Wishing you a wonderful birthday!"];
  const RECIP_NAMES = ['Sarah Johnson','Emily Davis','Jessica Wilson','Amanda Taylor','Michelle Brown','Ashley Martinez','Brittany Anderson','Stephanie Thomas','Jennifer Garcia','Rachel Lee','Megan Harris','Lauren Clark','Tiffany Robinson','Danielle Walker','Nicole Turner'];
  for (let i = 0; i < 25; i++) {
    const code = `LIME${rand(10000, 99999)}`;
    const redeemed = rand(0,2) === 0 ? 1 : 0;
    const expiresDate = new Date(); expiresDate.setFullYear(expiresDate.getFullYear() + 1);
    const expiresAt = `${expiresDate.getFullYear()}-${pad2(expiresDate.getMonth()+1)}-${pad2(expiresDate.getDate())}`;
    const redeemedAt = redeemed ? new Date(Date.now() - rand(1,30) * 86400000).toISOString().slice(0,19).replace('T',' ') : null;
    const svcLocalId = pick(allSvcLocalIds);
    await conn.query(
      `INSERT INTO gift_cards (businessOwnerId, localId, code, serviceLocalId, recipientName, recipientPhone, message, redeemed, redeemedAt, expiresAt) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [ownerId, uid(), code, svcLocalId, pick(RECIP_NAMES), `412${rand(1000000,9999999)}`, pick(GIFT_MSGS), redeemed, redeemedAt, expiresAt]
    );
  }
  console.log('✓ 25 gift cards added');

  // 7. Add 10 discounts
  const DISC_DEFS = [
    {name:'New Client Welcome',pct:20,start:'09:00',end:'18:00',days:['monday','tuesday','wednesday','thursday','friday'],active:1,maxUses:50},
    {name:'Happy Hour Special',pct:15,start:'14:00',end:'16:00',days:['monday','tuesday','wednesday'],active:1,maxUses:null},
    {name:'Weekend Warrior',pct:10,start:'10:00',end:'17:00',days:['saturday','sunday'],active:1,maxUses:null},
    {name:'Senior Discount',pct:15,start:'09:00',end:'17:00',days:['monday','tuesday','wednesday','thursday','friday'],active:1,maxUses:null},
    {name:'Birthday Month Special',pct:25,start:'09:00',end:'20:00',days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],active:1,maxUses:null},
    {name:'Spring Refresh Sale',pct:20,start:'09:00',end:'20:00',days:['monday','tuesday','wednesday','thursday','friday','saturday'],active:1,maxUses:30},
    {name:'Loyalty Reward - 5th Visit',pct:30,start:'09:00',end:'20:00',days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],active:1,maxUses:null},
    {name:'Student Discount',pct:10,start:'09:00',end:'17:00',days:['monday','tuesday','wednesday','thursday','friday'],active:1,maxUses:null},
    {name:'Holiday Flash Sale',pct:35,start:'09:00',end:'20:00',days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],active:0,maxUses:20},
    {name:'Refer a Friend',pct:15,start:'09:00',end:'20:00',days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],active:1,maxUses:null},
  ];
  for (const d of DISC_DEFS) {
    const svcIds = JSON.stringify(pickN(allSvcLocalIds, rand(8, 25)));
    await conn.query(
      `INSERT INTO discounts (businessOwnerId, localId, name, percentage, startTime, endTime, daysOfWeek, serviceIds, active, maxUses) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [ownerId, uid(), d.name, d.pct, d.start, d.end, JSON.stringify(d.days), svcIds, d.active, d.maxUses]
    );
  }
  console.log('✓ 10 discounts added');

  // 8. Add ~1100 more appointments (to reach ~2000 total)
  console.log('Adding ~1100 more appointments...');
  const DISC_NAMES = ['New Client Welcome','Happy Hour Special','Loyalty Reward','Birthday Special','Refer a Friend'];
  const PAY_METHODS = ['cash','zelle','venmo','cashapp','cash','cash','zelle'];
  const CANCEL_REASONS = ['Client request','No show','Staff unavailable','Emergency','Rescheduled','Weather'];
  const APPT_NOTES = ['Client requested extra time','First time client','VIP - extra attention','Patch test done','Special occasion - birthday','Referred by friend'];

  for (let i = 0; i < 1100; i++) {
    const svcId = pick(allSvcLocalIds);
    const clientId = pick(allClientIds);
    const locId = pick(allLocIds);
    const isFuture = i >= 1000;
    let dateStr: string, status: string, paymentStatus: string, paymentMethod: string | null;

    if (isFuture) {
      dateStr = randomFutureDate(1, 14);
      status = pick(['confirmed','confirmed','confirmed','pending','pending']);
      paymentStatus = 'unpaid'; paymentMethod = null;
    } else {
      dateStr = i < 500 ? randomPastDate(180, 365) : randomPastDate(1, 179);
      const r = rand(0, 99);
      if (r < 55) { status = 'completed'; paymentStatus = 'paid'; }
      else if (r < 70) { status = 'completed'; paymentStatus = 'unpaid'; }
      else if (r < 80) { status = 'cancelled'; paymentStatus = 'unpaid'; }
      else if (r < 88) { status = 'confirmed'; paymentStatus = 'paid'; }
      else { status = 'pending'; paymentStatus = 'unpaid'; }
      paymentMethod = paymentStatus === 'paid' ? pick(PAY_METHODS) : null;
    }

    const discPct = rand(0, 10) === 0 ? pick([10, 15, 20, 25]) : null;
    // Get service price from existing services (use a rough estimate)
    const basePrice = rand(20, 200);
    const totalPrice = (basePrice * (1 - (discPct ?? 0) / 100)).toFixed(2);
    const notes = rand(0, 8) === 0 ? pick(APPT_NOTES) : null;
    const cancelReason = status === 'cancelled' ? pick(CANCEL_REASONS) : null;
    const payConfNum = (paymentMethod === 'zelle' || paymentMethod === 'venmo' || paymentMethod === 'cashapp') ? `TXN${rand(100000, 999999)}` : null;
    const payConfAt = paymentStatus === 'paid' ? new Date(Date.now() - rand(0, 30) * 86400000).toISOString().slice(0,19).replace('T',' ') : null;

    await conn.query(
      `INSERT INTO appointments (businessOwnerId, localId, serviceLocalId, clientLocalId, date, time, duration, status, notes, totalPrice, discountPercent, discountAmount, discountName, locationId, cancellationReason, paymentMethod, paymentStatus, paymentConfirmationNumber, paymentConfirmedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [ownerId, uid(), svcId, clientId, dateStr, pick(TIME_SLOTS), rand(30, 120), status, notes, totalPrice, discPct, discPct ? (basePrice * discPct / 100).toFixed(2) : null, discPct ? pick(DISC_NAMES) : null, locId, cancelReason, paymentMethod, paymentStatus, payConfNum, payConfAt]
    );

    if ((i+1) % 100 === 0) process.stdout.write(`\r  Appointments: ${i+1}/1100`);
  }
  console.log('\n✓ 1100 more appointments added');

  // Final counts
  const [apptCount] = await conn.query('SELECT COUNT(*) as cnt FROM appointments WHERE businessOwnerId = ?', [ownerId]) as any;
  const [clientCount] = await conn.query('SELECT COUNT(*) as cnt FROM clients WHERE businessOwnerId = ?', [ownerId]) as any;
  const [svcCount] = await conn.query('SELECT COUNT(*) as cnt FROM services WHERE businessOwnerId = ?', [ownerId]) as any;
  const [prodCount] = await conn.query('SELECT COUNT(*) as cnt FROM products WHERE businessOwnerId = ?', [ownerId]) as any;
  const [giftCount] = await conn.query('SELECT COUNT(*) as cnt FROM gift_cards WHERE businessOwnerId = ?', [ownerId]) as any;
  const [discCount] = await conn.query('SELECT COUNT(*) as cnt FROM discounts WHERE businessOwnerId = ?', [ownerId]) as any;
  const [locCount] = await conn.query('SELECT COUNT(*) as cnt FROM locations WHERE businessOwnerId = ?', [ownerId]) as any;

  console.log('\n✅ Seed extension complete!');
  console.log(`   Business Owner ID : ${ownerId}`);
  console.log(`   Phone             : 4124827733`);
  console.log(`   Plan              : enterprise (adminOverride = Unlimited)`);
  console.log(`   Locations         : ${locCount[0].cnt}`);
  console.log(`   Services          : ${svcCount[0].cnt}`);
  console.log(`   Clients           : ${clientCount[0].cnt}`);
  console.log(`   Products          : ${prodCount[0].cnt}`);
  console.log(`   Gift Cards        : ${giftCount[0].cnt}`);
  console.log(`   Discounts         : ${discCount[0].cnt}`);
  console.log(`   Appointments      : ${apptCount[0].cnt}`);

  await conn.end();
  process.exit(0);
}

main().catch(e => {
  console.error('\n❌ Seed extension failed:', e.message);
  console.error(e.stack);
  process.exit(1);
});
