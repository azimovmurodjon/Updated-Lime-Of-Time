/**
 * Bulk seed script: adds clients, services, products, appointments, discounts, gift cards
 * Run: node scripts/seed-bulk.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('./load-env.js');
const mysql = require('mysql2/promise');

const OWNER_ID = 840001;

const LOCATIONS = [
  "87a51e0ad74145d6a9c514ba",
  "6b9e934eee30466e83b7f7e0",
  "48e2a7ad7e28411bb93d7a1c",
  "23aaea919cbd4b8fb8f8090d",
];
const STAFF = [
  "21b0c1ec886d4da08590c902","d1c4e421276a4217a4eff07d","e07e1500a12f4abfafd7506e",
  "d2595ed0dcb94d2fb367159b","9457c2c162934cc1a79cca08","d929c2cff42748e485ec32b5",
  "4c3ebb45564c456d91478cc4","a52ad439010447089871cda4","fe87a4a1788b4e57b9d71189",
  "b25ac42f6f574bca9f82c512","95547fb69aa84768baeed1aa","185b974b4d444d83bbea694c",
];

function uid() {
  return Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,10);
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }

// ── 200 new clients ─────────────────────────────────────────────────
const FIRST_NAMES = ["Emma","Olivia","Ava","Isabella","Sophia","Mia","Charlotte","Amelia","Harper","Evelyn",
  "Abigail","Emily","Elizabeth","Mila","Ella","Avery","Sofia","Camila","Aria","Scarlett",
  "Victoria","Madison","Luna","Grace","Chloe","Penelope","Layla","Riley","Zoey","Nora",
  "Lily","Eleanor","Hannah","Lillian","Addison","Aubrey","Ellie","Stella","Natalie","Zoe",
  "Leah","Hazel","Violet","Aurora","Savannah","Audrey","Brooklyn","Bella","Claire","Skylar",
  "Liam","Noah","William","James","Oliver","Benjamin","Elijah","Lucas","Mason","Logan",
  "Alexander","Ethan","Jacob","Michael","Daniel","Henry","Jackson","Sebastian","Aiden","Matthew",
  "Samuel","David","Joseph","Carter","Owen","Wyatt","John","Jack","Luke","Jayden",
  "Dylan","Grayson","Levi","Isaac","Gabriel","Julian","Mateo","Anthony","Jaxon","Lincoln",
  "Marcus","Adrian","Nolan","Evan","Ryder","Caleb","Hunter","Dominic","Austin","Xavier"];
const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
  "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
  "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
  "Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
  "Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts",
  "Chen","Kim","Patel","Singh","Kumar","Shah","Ali","Ahmed","Hassan","Khan",
  "Murphy","O'Brien","Walsh","Ryan","Sullivan","McCarthy","O'Connor","Kelly","Byrne","Collins"];

// ── 50 new services ──────────────────────────────────────────────────
const NEW_SERVICES = [
  // Hair
  {name:"Balayage",price:180,duration:120,category:"Hair"},
  {name:"Highlights",price:150,duration:90,category:"Hair"},
  {name:"Keratin Treatment",price:200,duration:120,category:"Hair"},
  {name:"Hair Extensions",price:250,duration:150,category:"Hair"},
  {name:"Scalp Treatment",price:65,duration:45,category:"Hair"},
  {name:"Deep Conditioning",price:55,duration:45,category:"Hair"},
  {name:"Men's Haircut",price:30,duration:30,category:"Hair"},
  {name:"Kids Haircut",price:20,duration:20,category:"Hair"},
  {name:"Bang Trim",price:15,duration:15,category:"Hair"},
  {name:"Gloss Treatment",price:75,duration:60,category:"Hair"},
  // Nails
  {name:"Gel Manicure",price:45,duration:45,category:"Nails"},
  {name:"Acrylic Full Set",price:65,duration:75,category:"Nails"},
  {name:"Nail Art",price:35,duration:30,category:"Nails"},
  {name:"Gel Pedicure",price:60,duration:60,category:"Nails"},
  {name:"Dip Powder",price:55,duration:60,category:"Nails"},
  {name:"French Manicure",price:40,duration:45,category:"Nails"},
  {name:"Nail Fill",price:35,duration:45,category:"Nails"},
  {name:"Paraffin Wax",price:25,duration:20,category:"Nails"},
  // Skin
  {name:"Chemical Peel",price:120,duration:60,category:"Skin"},
  {name:"Microdermabrasion",price:110,duration:60,category:"Skin"},
  {name:"LED Light Therapy",price:85,duration:45,category:"Skin"},
  {name:"Hydrafacial",price:150,duration:75,category:"Skin"},
  {name:"Eyebrow Shaping",price:25,duration:20,category:"Skin"},
  {name:"Eyelash Tint",price:35,duration:30,category:"Skin"},
  {name:"Dermaplaning",price:95,duration:45,category:"Skin"},
  {name:"Acne Treatment",price:90,duration:60,category:"Skin"},
  // Body
  {name:"Hot Stone Massage",price:120,duration:90,category:"Body"},
  {name:"Deep Tissue Massage",price:110,duration:60,category:"Body"},
  {name:"Swedish Massage",price:95,duration:60,category:"Body"},
  {name:"Couples Massage",price:200,duration:60,category:"Body"},
  {name:"Body Scrub",price:85,duration:60,category:"Body"},
  {name:"Body Wrap",price:95,duration:75,category:"Body"},
  {name:"Reflexology",price:70,duration:45,category:"Body"},
  {name:"Aromatherapy",price:80,duration:60,category:"Body"},
  {name:"Prenatal Massage",price:100,duration:60,category:"Body"},
  {name:"Sports Massage",price:105,duration:60,category:"Body"},
  // Waxing
  {name:"Brazilian Wax",price:65,duration:45,category:"Waxing"},
  {name:"Bikini Wax",price:40,duration:30,category:"Waxing"},
  {name:"Leg Wax",price:55,duration:45,category:"Waxing"},
  {name:"Arm Wax",price:35,duration:30,category:"Waxing"},
  {name:"Back Wax",price:50,duration:30,category:"Waxing"},
  {name:"Eyebrow Wax",price:18,duration:15,category:"Waxing"},
  {name:"Upper Lip Wax",price:12,duration:10,category:"Waxing"},
  {name:"Full Body Wax",price:180,duration:120,category:"Waxing"},
  // Makeup
  {name:"Bridal Makeup",price:200,duration:90,category:"Makeup"},
  {name:"Special Event Makeup",price:120,duration:60,category:"Makeup"},
  {name:"Lash Extensions",price:150,duration:90,category:"Makeup"},
  {name:"Lash Lift",price:85,duration:60,category:"Makeup"},
  {name:"Brow Lamination",price:75,duration:60,category:"Makeup"},
  {name:"Airbrush Makeup",price:140,duration:75,category:"Makeup"},
];

// ── 100 products ─────────────────────────────────────────────────────
const BRANDS = ["Olaplex","Redken","Kerastase","Moroccanoil","Paul Mitchell","Wella","Schwarzkopf","L'Oreal Professional",
  "Joico","Pureology","Aveda","Bumble and Bumble","Davines","Kevin Murphy","IGK","Verb","Not Your Mother's",
  "OPI","Essie","CND","Gelish","Sally Hansen","Zoya","Orly","Deborah Lippmann",
  "Dermalogica","SkinCeuticals","Obagi","Jan Marini","Revision Skincare","PCA Skin","Image Skincare",
  "Elemis","Eminence","Glo Skin Beauty","Murad","Peter Thomas Roth","Tatcha","La Mer",
  "Bioderma","CeraVe","La Roche-Posay","Neutrogena","Cetaphil","EltaMD","Supergoop"];

const PRODUCT_TEMPLATES = [
  // Hair
  {name:"Shampoo",price:[12,35],desc:"Professional cleansing shampoo"},
  {name:"Conditioner",price:[12,35],desc:"Deep moisturizing conditioner"},
  {name:"Hair Mask",price:[25,55],desc:"Intensive repair hair mask"},
  {name:"Leave-In Conditioner",price:[18,40],desc:"Lightweight leave-in treatment"},
  {name:"Hair Oil",price:[20,50],desc:"Nourishing hair oil serum"},
  {name:"Styling Cream",price:[15,30],desc:"Smoothing styling cream"},
  {name:"Dry Shampoo",price:[12,25],desc:"Volumizing dry shampoo"},
  {name:"Heat Protectant",price:[15,28],desc:"Thermal protection spray"},
  {name:"Hair Serum",price:[22,45],desc:"Frizz control serum"},
  {name:"Volumizing Mousse",price:[14,28],desc:"Lightweight volumizing mousse"},
  // Nails
  {name:"Nail Polish",price:[8,22],desc:"Long-lasting nail color"},
  {name:"Base Coat",price:[10,18],desc:"Protective nail base coat"},
  {name:"Top Coat",price:[10,18],desc:"High-shine top coat"},
  {name:"Cuticle Oil",price:[12,25],desc:"Nourishing cuticle oil"},
  {name:"Nail Strengthener",price:[15,28],desc:"Fortifying nail treatment"},
  // Skin
  {name:"Cleanser",price:[18,55],desc:"Gentle daily cleanser"},
  {name:"Toner",price:[20,45],desc:"Balancing facial toner"},
  {name:"Moisturizer",price:[25,80],desc:"Hydrating daily moisturizer"},
  {name:"Serum",price:[35,120],desc:"Active ingredient serum"},
  {name:"Eye Cream",price:[30,90],desc:"Firming eye cream"},
  {name:"SPF Sunscreen",price:[22,55],desc:"Broad spectrum SPF 50"},
  {name:"Exfoliating Scrub",price:[20,45],desc:"Gentle exfoliating scrub"},
  {name:"Face Mask",price:[18,40],desc:"Purifying face mask"},
  {name:"Retinol Cream",price:[40,95],desc:"Anti-aging retinol treatment"},
  {name:"Vitamin C Serum",price:[35,85],desc:"Brightening vitamin C serum"},
  // Body
  {name:"Body Lotion",price:[15,40],desc:"Rich body moisturizer"},
  {name:"Body Oil",price:[20,50],desc:"Luxurious body oil"},
  {name:"Body Scrub",price:[18,38],desc:"Exfoliating body scrub"},
  {name:"Massage Oil",price:[20,45],desc:"Relaxing massage oil"},
  {name:"Hand Cream",price:[12,28],desc:"Intensive hand cream"},
];

// ── Discounts ────────────────────────────────────────────────────────
const DISCOUNTS_DATA = [
  {name:"Happy Hour",percentage:15,startTime:"14:00",endTime:"16:00"},
  {name:"Early Bird",percentage:10,startTime:"08:00",endTime:"10:00"},
  {name:"Weekend Special",percentage:20,startTime:"10:00",endTime:"18:00"},
  {name:"Senior Discount",percentage:15,startTime:"09:00",endTime:"17:00"},
  {name:"Student Deal",percentage:10,startTime:"11:00",endTime:"15:00"},
];

const TIMES = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30",
  "14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"];
const STATUSES_PAST = ["completed","completed","completed","completed","completed","completed","confirmed","cancelled"];
const STATUSES_UPCOMING = ["confirmed","confirmed","confirmed","pending","confirmed","confirmed"];

function dateStr(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0,10);
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log('Connected to DB');

  // ── Fetch existing clients ─────────────────────────────────────────
  const [existingClients] = await conn.execute(
    'SELECT localId FROM clients WHERE businessOwnerId=?', [OWNER_ID]
  );
  let clientIds = existingClients.map(r => r.localId);
  console.log(`Existing clients: ${clientIds.length}`);

  // ── Add 200 new clients (already added in previous run, skip if count >= 400) ────────────────────────────────────────────
  const [clientCountCheck] = await conn.execute('SELECT COUNT(*) as cnt FROM clients WHERE businessOwnerId=?', [OWNER_ID]);
  const skipClients = clientCountCheck[0].cnt >= 400;
  console.log(skipClients ? 'Skipping clients (already 400+)' : 'Adding 200 new clients...');
  const newClientIds = [];
  const clientBatch = [];
  if (!skipClients) for (let i = 0; i < 200; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const ln = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const name = `${fn} ${ln}`;
    const areaCode = pick(["412","724","878","814","717","215","610","267","484","570"]);
    const phone = `${areaCode}${randInt(1000000,9999999)}`;
    const localId = uid();
    newClientIds.push(localId);
    clientBatch.push([OWNER_ID, localId, name, phone, `${fn.toLowerCase()}.${ln.toLowerCase()}${randInt(1,99)}@email.com`, null]);
  }
  if (clientBatch.length > 0) {
    await conn.query(
      'INSERT INTO clients (businessOwnerId, localId, name, phone, email, notes) VALUES ?',
      [clientBatch]
    );
  }
  clientIds = [...clientIds, ...newClientIds];
  console.log(`Total clients: ${clientIds.length}`);

  // ── Add 50 new services ────────────────────────────────────────────
  console.log('Adding 50 new services...');
  const [existingSvcs] = await conn.execute(
    'SELECT localId FROM services WHERE businessOwnerId=?', [OWNER_ID]
  );
  const svcIds = existingSvcs.map(r => r.localId);
  const newSvcIds = [];
  const svcBatch = [];
  for (const svc of NEW_SERVICES) {
    const localId = uid();
    newSvcIds.push({localId, price: svc.price, duration: svc.duration});
    const colors = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316'];
    const color = colors[svcBatch.length % colors.length];
    svcBatch.push([OWNER_ID, localId, svc.name, svc.duration, svc.price, svc.category, color]);
  }
  if (svcBatch.length > 0) {
    await conn.query(
      'INSERT INTO services (businessOwnerId, localId, name, duration, price, category, color) VALUES ?',
      [svcBatch]
    );
  }
  const allSvcIds = [...svcIds, ...newSvcIds.map(s => s.localId)];
  const allSvcData = [...existingSvcs.map(s => ({localId: s.localId, price: 50, duration: 45})), ...newSvcIds];
  console.log(`Total services: ${allSvcIds.length}`);

  // ── Add 100 products ───────────────────────────────────────────────
  console.log('Adding 100 products...');
  const prodBatch = [];
  const prodIds = [];
  for (let i = 0; i < 100; i++) {
    const tmpl = PRODUCT_TEMPLATES[i % PRODUCT_TEMPLATES.length];
    const brand = BRANDS[i % BRANDS.length];
    const localId = uid();
    const price = randFloat(tmpl.price[0], tmpl.price[1]);
    prodIds.push(localId);
    prodBatch.push([OWNER_ID, localId, `${brand} ${tmpl.name}`, price, tmpl.desc, brand, 1]);
  }
  await conn.query(
    'INSERT INTO products (businessOwnerId, localId, name, price, description, brand, available) VALUES ?',
    [prodBatch]
  );
  console.log(`Added ${prodBatch.length} products`);

  // ── Add ~6000 past appointments (last 180 days) ────────────────────
  console.log('Adding ~6000 past appointments...');
  const pastBatch = [];
  // ~33 appointments per day for 180 days = ~6000
  for (let day = -180; day <= -1; day++) {
    const date = dateStr(day);
    const apptCount = randInt(25, 40);
    for (let a = 0; a < apptCount; a++) {
      const svcLocalId = pick(allSvcIds);
      const svcData = allSvcData.find(s => s.localId === svcLocalId) || {price: 50, duration: 45};
      const clientLocalId = pick(clientIds);
      const time = pick(TIMES);
      const status = pick(STATUSES_PAST);
      const staffId = pick(STAFF);
      const locationId = pick(LOCATIONS);
      const price = parseFloat(svcData.price) || 50;
      const duration = svcData.duration || 45;
      const localId = uid();
      pastBatch.push([
        OWNER_ID, localId, svcLocalId, clientLocalId, date, time, duration,
        status, null, price.toFixed(2), null, null, null, null, false, null,
        staffId, locationId
      ]);
    }
    // Insert in batches of 500
    if (pastBatch.length >= 500) {
      await conn.query(
        `INSERT INTO appointments (businessOwnerId, localId, serviceLocalId, clientLocalId, date, time, duration,
          status, notes, totalPrice, extraItems, discountPercent, discountAmount, discountName, giftApplied, giftUsedAmount,
          staffId, locationId) VALUES ?`,
        [pastBatch.splice(0, 500)]
      );
      process.stdout.write('.');
    }
  }
  // Insert remaining
  if (pastBatch.length > 0) {
    await conn.query(
      `INSERT INTO appointments (businessOwnerId, localId, serviceLocalId, clientLocalId, date, time, duration,
        status, notes, totalPrice, extraItems, discountPercent, discountAmount, discountName, giftApplied, giftUsedAmount,
        staffId, locationId) VALUES ?`,
      [pastBatch]
    );
  }
  console.log('\nPast appointments done');

  // ── Add 200 upcoming appointments (next 30 days) ───────────────────
  console.log('Adding 200 upcoming appointments...');
  const upcomingBatch = [];
  for (let i = 0; i < 200; i++) {
    const day = randInt(1, 30);
    const date = dateStr(day);
    const svcLocalId = pick(allSvcIds);
    const svcData = allSvcData.find(s => s.localId === svcLocalId) || {price: 50, duration: 45};
    const clientLocalId = pick(clientIds);
    const time = pick(TIMES);
    const status = pick(STATUSES_UPCOMING);
    const staffId = pick(STAFF);
    const locationId = pick(LOCATIONS);
    const price = parseFloat(svcData.price) || 50;
    const duration = svcData.duration || 45;
    const localId = uid();
    upcomingBatch.push([
      OWNER_ID, localId, svcLocalId, clientLocalId, date, time, duration,
      status, null, price.toFixed(2), null, null, null, null, false, null,
      staffId, locationId
    ]);
  }
  await conn.query(
    `INSERT INTO appointments (businessOwnerId, localId, serviceLocalId, clientLocalId, date, time, duration,
      status, notes, totalPrice, extraItems, discountPercent, discountAmount, discountName, giftApplied, giftUsedAmount,
      staffId, locationId) VALUES ?`,
    [upcomingBatch]
  );
  console.log('Upcoming appointments done');

  // ── Add discounts ──────────────────────────────────────────────────
  console.log('Adding discounts...');
  const discBatch = [];
  for (const d of DISCOUNTS_DATA) {
    discBatch.push([OWNER_ID, uid(), d.name, d.percentage, d.startTime, d.endTime, null, null, null, 1]);
  }
  await conn.query(
    'INSERT INTO discounts (businessOwnerId, localId, name, percentage, startTime, endTime, daysOfWeek, dates, serviceIds, active) VALUES ?',
    [discBatch]
  );
  console.log(`Added ${discBatch.length} discounts`);

  // ── Add gift cards ─────────────────────────────────────────────────
  console.log('Adding gift cards...');
  const giftNames = ["Sarah","Jennifer","Michelle","Ashley","Amanda","Jessica","Stephanie","Nicole","Melissa","Lauren"];
  const giftPhones = ["4121234567","7249876543","8781112222","8143334444","7175556666"];
  const giftBatch = [];
  for (let i = 0; i < 8; i++) {
    const svcLocalId = pick(allSvcIds);
    const code = `GIFT${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const recipientName = giftNames[i % giftNames.length];
    const recipientPhone = giftPhones[i % giftPhones.length];
    const expiresAt = dateStr(randInt(30, 365));
    const balance = randFloat(50, 200);
    const msg = `Happy Birthday! Enjoy your spa day!\n---GIFT_DATA---\n${JSON.stringify({balance, originalBalance: balance, serviceIds: [svcLocalId], productIds: []})}`;
    giftBatch.push([OWNER_ID, uid(), code, svcLocalId, recipientName, recipientPhone, msg, 0, null, expiresAt]);
  }
  await conn.query(
    'INSERT INTO gift_cards (businessOwnerId, localId, code, serviceLocalId, recipientName, recipientPhone, message, redeemed, redeemedAt, expiresAt) VALUES ?',
    [giftBatch]
  );
  console.log(`Added ${giftBatch.length} gift cards`);

  // ── Final counts ───────────────────────────────────────────────────
  const [fc] = await conn.execute('SELECT COUNT(*) as cnt FROM clients WHERE businessOwnerId=?', [OWNER_ID]);
  const [fa] = await conn.execute('SELECT COUNT(*) as cnt FROM appointments WHERE businessOwnerId=?', [OWNER_ID]);
  const [fs] = await conn.execute('SELECT COUNT(*) as cnt FROM services WHERE businessOwnerId=?', [OWNER_ID]);
  const [fp] = await conn.execute('SELECT COUNT(*) as cnt FROM products WHERE businessOwnerId=?', [OWNER_ID]);
  const [fd] = await conn.execute('SELECT COUNT(*) as cnt FROM discounts WHERE businessOwnerId=?', [OWNER_ID]);
  const [fg] = await conn.execute('SELECT COUNT(*) as cnt FROM gift_cards WHERE businessOwnerId=?', [OWNER_ID]);
  console.log('\n=== Final Counts ===');
  console.log(`Clients: ${fc[0].cnt}`);
  console.log(`Appointments: ${fa[0].cnt}`);
  console.log(`Services: ${fs[0].cnt}`);
  console.log(`Products: ${fp[0].cnt}`);
  console.log(`Discounts: ${fd[0].cnt}`);
  console.log(`Gift Cards: ${fg[0].cnt}`);

  await conn.end();
  console.log('Done!');
}

main().catch(err => { console.error(err); process.exit(1); });
