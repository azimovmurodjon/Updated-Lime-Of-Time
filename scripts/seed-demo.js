/**
 * Lime Of Time - Full Demo Data Seed Script (Drizzle ORM version)
 */
require('./load-env.js');
const { drizzle } = require('drizzle-orm/mysql2');
const { sql } = require('drizzle-orm');
const crypto = require('crypto');

const db = drizzle(process.env.DATABASE_URL);

const uid = () => crypto.randomUUID();
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n);

function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0,10); }
function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); }
function randomPastDate(minD, maxD) { return daysAgo(rand(minD, maxD)); }
function randomFutureDate(minD, maxD) { return daysFromNow(rand(minD, maxD)); }
const TIME_SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'];

const OWNER_ID = uid();
const USER_ID = uid();
const PHONE = '+14124827733';
const NOW = new Date().toISOString().slice(0,19).replace('T',' ');

const LOCATIONS = [
  { localId: uid(), name: 'Downtown Studio', address: '134 Locust Court', city: 'Pittsburgh', state: 'PA', zipCode: '15237', phone: '+14124827733', email: 'downtown@limeoftimespa.com', isDefault: 1 },
  { localId: uid(), name: 'Shadyside Salon', address: '5520 Walnut Street', city: 'Pittsburgh', state: 'PA', zipCode: '15232', phone: '+14125551001', email: 'shadyside@limeoftimespa.com', isDefault: 0 },
  { localId: uid(), name: 'Squirrel Hill Spa', address: '2101 Murray Avenue', city: 'Pittsburgh', state: 'PA', zipCode: '15217', phone: '+14125551002', email: 'squirrelhill@limeoftimespa.com', isDefault: 0 },
  { localId: uid(), name: 'North Shore Beauty', address: '301 Federal Street', city: 'Pittsburgh', state: 'PA', zipCode: '15212', phone: '+14125551003', email: 'northshore@limeoftimespa.com', isDefault: 0 },
  { localId: uid(), name: 'South Hills Retreat', address: '1500 Washington Road', city: 'Pittsburgh', state: 'PA', zipCode: '15228', phone: '+14125551004', email: 'southhills@limeoftimespa.com', isDefault: 0 },
];

const WH = JSON.stringify({ monday:{open:'09:00',close:'18:00',enabled:true}, tuesday:{open:'09:00',close:'18:00',enabled:true}, wednesday:{open:'09:00',close:'18:00',enabled:true}, thursday:{open:'09:00',close:'20:00',enabled:true}, friday:{open:'09:00',close:'20:00',enabled:true}, saturday:{open:'10:00',close:'17:00',enabled:true}, sunday:{open:'11:00',close:'16:00',enabled:false} });

const COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9','#F0B27A','#82E0AA','#F1948A','#AED6F1','#A9DFBF'];

const SERVICES_RAW = [
  {name:"Women's Haircut & Style",cat:'Hair',dur:60,price:75},{name:"Men's Haircut",cat:'Hair',dur:30,price:35},{name:'Blowout',cat:'Hair',dur:45,price:55},{name:'Full Color',cat:'Hair',dur:120,price:145},{name:'Highlights',cat:'Hair',dur:150,price:185},{name:'Balayage',cat:'Hair',dur:180,price:220},{name:'Keratin Treatment',cat:'Hair',dur:180,price:250},{name:'Deep Conditioning',cat:'Hair',dur:30,price:40},{name:'Scalp Treatment',cat:'Hair',dur:45,price:65},{name:'Brazilian Blowout',cat:'Hair',dur:120,price:200},{name:'Hair Extensions Consultation',cat:'Hair',dur:30,price:0},{name:'Updo / Special Occasion',cat:'Hair',dur:90,price:120},
  {name:'Classic Manicure',cat:'Nails',dur:30,price:30},{name:'Gel Manicure',cat:'Nails',dur:45,price:45},{name:'Classic Pedicure',cat:'Nails',dur:45,price:40},{name:'Gel Pedicure',cat:'Nails',dur:60,price:55},{name:'Acrylic Full Set',cat:'Nails',dur:90,price:65},{name:'Acrylic Fill',cat:'Nails',dur:60,price:45},{name:'Nail Art (per nail)',cat:'Nails',dur:30,price:5},{name:'Mani-Pedi Combo',cat:'Nails',dur:90,price:65},
  {name:'Classic Facial',cat:'Skin',dur:60,price:85},{name:'Anti-Aging Facial',cat:'Skin',dur:75,price:110},{name:'Acne Treatment Facial',cat:'Skin',dur:60,price:95},{name:'Microdermabrasion',cat:'Skin',dur:60,price:120},{name:'Chemical Peel',cat:'Skin',dur:45,price:100},{name:'LED Light Therapy',cat:'Skin',dur:30,price:60},{name:'Hydrafacial',cat:'Skin',dur:60,price:150},{name:'Dermaplaning',cat:'Skin',dur:45,price:90},
  {name:'Swedish Massage 60 min',cat:'Massage',dur:60,price:90},{name:'Deep Tissue Massage 60 min',cat:'Massage',dur:60,price:105},{name:'Hot Stone Massage',cat:'Massage',dur:90,price:130},{name:'Prenatal Massage',cat:'Massage',dur:60,price:95},{name:'Sports Massage',cat:'Massage',dur:60,price:100},{name:'Couples Massage',cat:'Massage',dur:90,price:200},
  {name:'Classic Lash Extensions',cat:'Lashes & Brows',dur:120,price:150},{name:'Volume Lash Extensions',cat:'Lashes & Brows',dur:150,price:185},{name:'Lash Fill',cat:'Lashes & Brows',dur:60,price:75},{name:'Brow Lamination',cat:'Lashes & Brows',dur:45,price:65},{name:'Brow Tint & Shape',cat:'Lashes & Brows',dur:30,price:40},
  {name:'Full Leg Wax',cat:'Waxing',dur:60,price:70},{name:'Bikini Wax',cat:'Waxing',dur:30,price:45},{name:'Brazilian Wax',cat:'Waxing',dur:45,price:65},{name:'Underarm Wax',cat:'Waxing',dur:15,price:20},{name:'Facial Wax',cat:'Waxing',dur:20,price:25},
  {name:'Bridal Makeup',cat:'Makeup',dur:90,price:175},{name:'Special Event Makeup',cat:'Makeup',dur:60,price:95},{name:'Makeup Lesson',cat:'Makeup',dur:60,price:85},
  {name:'Body Wrap',cat:'Body',dur:90,price:120},{name:'Body Scrub',cat:'Body',dur:60,price:85},{name:'Spray Tan',cat:'Body',dur:30,price:50},
];

const FIRST_NAMES = ['Emma','Olivia','Ava','Isabella','Sophia','Mia','Charlotte','Amelia','Harper','Evelyn','Abigail','Emily','Elizabeth','Mila','Ella','Avery','Sofia','Camila','Aria','Scarlett','Victoria','Madison','Luna','Grace','Chloe','Penelope','Layla','Riley','Zoey','Nora','Lily','Eleanor','Hannah','Lillian','Addison','Aubrey','Ellie','Stella','Natalie','Zoe','Leah','Hazel','Violet','Aurora','Savannah','Audrey','Brooklyn','Bella','Claire','Skylar','Lucy','Paisley','Everly','Anna','Caroline','Nova','Genesis','Emilia','Kennedy','Samantha','Maya','Willow','Kinsley','Naomi','Aaliyah','Elena','Sarah','Ariana','Allison','Gabriella','Alice','Madelyn','Cora','Ruby','Eva','Serenity','Autumn','Adeline','Hailey','Gianna','Valentina','Isla','Eliana','Quinn','Nevaeh','Ivy','Sadie','Piper','Lydia','Alexa','Josephine','Emery','Julia','Delilah','Arianna','Vivian','Kaylee','Sophie','Brielle','Madeline','Liam','Noah','William','James','Oliver','Benjamin','Elijah','Lucas','Mason','Logan','Alexander','Ethan','Daniel','Jacob','Michael','Henry','Jackson','Sebastian','Aiden','Matthew','Samuel','David','Joseph','Carter','Owen','Wyatt','John','Jack','Luke','Jayden','Dylan','Grayson','Levi','Isaac','Gabriel','Julian','Mateo','Anthony','Jaxon','Lincoln','Joshua','Christopher','Andrew','Theodore','Caleb','Ryan','Asher','Nathan','Thomas','Leo','Isaiah','Charles','Josiah','Hudson','Christian','Hunter','Connor','Eli','Ezra','Aaron','Landon','Adrian','Jonathan','Nolan','Jeremiah','Easton','Elias','Colton','Cameron','Carson','Robert','Angel','Maverick','Nicholas','Dominic'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Phillips','Evans','Turner','Parker','Collins','Edwards','Stewart','Morris','Murphy','Cook','Rogers','Morgan','Peterson','Cooper','Reed','Bailey','Bell','Gomez','Kelly','Howard','Ward','Cox','Diaz','Richardson','Wood','Watson','Brooks','Bennett','Gray','James','Reyes','Hughes','Price','Myers','Long','Foster','Sanders','Ross','Morales','Powell','Sullivan','Russell','Ortiz','Jenkins','Gutierrez','Perry','Butler','Barnes','Fisher'];

const BRANDS = ['Redken','Olaplex','Kerastase','Paul Mitchell','Wella','Matrix','Loreal','Schwarzkopf','Aveda','Bumble and Bumble','OPI','Essie','CND','Gelish','Sally Hansen','Dermalogica','Skinceuticals','Obagi','Jan Marini','Murad','Elemis','Bioderma','La Roche-Posay','Cetaphil','Neutrogena'];
const PRODUCT_NAMES_LIST = ['Color Care Shampoo','Moisture Boost Conditioner','Bond Repair Treatment','Heat Protectant Spray','Classic Red Nail Polish','Strengthening Base Coat','Gentle Foaming Cleanser','Daily Hydrating Moisturizer','Vitamin C Brightening Serum','SPF 50 Daily Sunscreen','Shea Butter Body Lotion','Relaxing Lavender Oil','Volume Lift Shampoo','Deep Moisture Conditioner','Keratin Mask','Texturizing Spray','Nude Blush Nail Polish','Cuticle Oil','Micellar Cleansing Water','Anti-Aging Day Cream','Hyaluronic Acid Serum','Tinted SPF 30','Firming Body Cream','Energizing Peppermint Oil','Repair & Restore Shampoo','Hydrating Conditioner','Hydrating Hair Mask','Strong Hold Gel','Coral Sunset Nail Polish','Nail Hardener','Exfoliating Gel Cleanser','Brightening Moisturizer','Retinol Night Serum','Mineral Sunscreen SPF 50','Hydrating Body Oil','Warming Ginger Oil','Scalp Detox Shampoo','Strengthening Conditioner','Protein Treatment','Flexible Hold Mousse','Berry Crush Nail Polish','Ridge Filler','Hydrating Milk Cleanser','Sensitive Skin Moisturizer','Niacinamide Pore Serum','Invisible SPF 30 Fluid','Sensitive Skin Body Lotion','Neutral Carrier Oil','Clarifying Shampoo','Detangling Conditioner','Scalp Serum','Shine Serum','Midnight Black Nail Polish','Top Coat Gel','Charcoal Deep Cleanse','Rich Night Cream','Peptide Firming Serum','Sport SPF 50','Brightening Body Lotion','Argan Oil Treatment','Volumizing Spray','Anti-Frizz Cream','Lavender Dream Nail Polish','Nail Repair Serum','Brightening Cleanser','Oil-Free Moisturizer','AHA/BHA Exfoliating Serum','Ocean Blue Nail Polish','Rose Gold Nail Polish','Champagne Toast Nail Polish','Emerald City Nail Polish','Split End Repair','Curl Defining Cream','Brow Tint Kit','Lash Serum','Cuticle Remover Gel','Nail Strengthener','Pore Minimizing Toner','Eye Cream','Lip Treatment','Hand Cream','Foot Cream','Exfoliating Scrub','Clay Mask','Sheet Mask','Micellar Toner','Essence Serum','Eye Serum','Neck Cream','BB Cream SPF 30','CC Cream SPF 40','Primer Serum','Setting Spray','Makeup Remover','Cleansing Balm','Facial Mist','Sleeping Mask','Peel Off Mask','Charcoal Mask','Gold Mask','Vitamin E Oil','Rosehip Oil','Jojoba Oil','Coconut Hair Oil','Biotin Shampoo','Collagen Conditioner','Keratin Serum','Hair Growth Tonic'];

async function insertOne(tableName, row) {
  const cols = Object.keys(row);
  const vals = Object.values(row);
  const placeholders = cols.map(() => '?').join(', ');
  const colNames = cols.join(', ');
  await db.execute(sql.raw(`INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders})`), vals);
}

// Use raw sql with values array - drizzle execute with array
async function batchInsert(tableName, rows) {
  for (const row of rows) {
    const cols = Object.keys(row);
    const vals = Object.values(row).map(v => v === null || v === undefined ? null : v);
    // Build parameterized query using drizzle sql template
    const colStr = cols.join(', ');
    const placeholders = cols.map(() => '?').join(', ');
    await db.execute(sql.raw(`INSERT INTO \`${tableName}\` (${colStr}) VALUES (${placeholders})`), vals);
  }
}

async function main() {
  console.log('Starting seed...');

  // Test connection
  await db.execute(sql`SELECT 1`);
  console.log('DB connected.');

  // 1. User
  await db.execute(sql`INSERT INTO users (id, openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn) VALUES (${USER_ID}, ${'phone:' + PHONE}, ${'Murodjon Azimov'}, ${'muradjanazimov@gmail.com'}, ${'phone'}, ${'user'}, ${NOW}, ${NOW}, ${NOW})`);
  console.log('User created:', USER_ID);

  // 2. Business owner
  const defaultWH = JSON.stringify({ monday:{open:'09:00',close:'18:00',enabled:true}, tuesday:{open:'09:00',close:'18:00',enabled:true}, wednesday:{open:'09:00',close:'18:00',enabled:true}, thursday:{open:'09:00',close:'20:00',enabled:true}, friday:{open:'09:00',close:'20:00',enabled:true}, saturday:{open:'10:00',close:'17:00',enabled:true}, sunday:{open:'11:00',close:'16:00',enabled:false} });
  const trialEnd = new Date(); trialEnd.setFullYear(trialEnd.getFullYear() + 10);
  const trialEndStr = trialEnd.toISOString().slice(0,19).replace('T',' ');
  const notifPrefs = JSON.stringify({ smsClientOnConfirmation: true, smsClientOnReminder: true, smsClientOnCancellation: true });
  await db.execute(sql`INSERT INTO business_owners (id, userId, phone, businessName, ownerName, email, address, website, description, defaultDuration, notificationsEnabled, themeMode, temporaryClosed, workingHours, onboardingComplete, createdAt, updatedAt, scheduleMode, bufferTime, customSlug, subscriptionPlan, subscriptionStatus, subscriptionPeriod, trialEndsAt, adminOverride, adminOverrideNote, zelleHandle, cashAppHandle, venmoHandle, paymentNotes, instagramHandle, facebookHandle, tiktokHandle, autoCompleteEnabled, autoCompleteDelayMinutes, notificationPreferences) VALUES (${OWNER_ID}, ${USER_ID}, ${PHONE}, ${'Lime Of Time Beauty Studio'}, ${'Murodjon Azimov'}, ${'muradjanazimov@gmail.com'}, ${'134 Locust Court'}, ${'https://lime-of-time.com'}, ${"Pittsburgh's premier beauty studio offering hair, nails, skin, massage, and more."}, ${60}, ${1}, ${'system'}, ${0}, ${defaultWH}, ${1}, ${NOW}, ${NOW}, ${'flexible'}, ${10}, ${'lime-of-time'}, ${'unlimited'}, ${'active'}, ${'yearly'}, ${trialEndStr}, ${1}, ${'Demo account - Unlimited plan granted by admin'}, ${'LimeOfTime'}, ${'$LimeOfTime'}, ${'@LimeOfTime'}, ${'We accept Cash, Zelle, Venmo, and Card.'}, ${'@limeoftimespa'}, ${'LimeOfTimeSpa'}, ${'@limeoftimespa'}, ${1}, ${30}, ${notifPrefs})`);
  console.log('Business owner created:', OWNER_ID);

  // 3. Locations
  for (const loc of LOCATIONS) {
    await db.execute(sql`INSERT INTO locations (id, businessOwnerId, localId, name, address, phone, email, isDefault, active, workingHours, createdAt, updatedAt, city, state, zipCode, temporarilyClosed) VALUES (${uid()}, ${OWNER_ID}, ${loc.localId}, ${loc.name}, ${loc.address}, ${loc.phone}, ${loc.email}, ${loc.isDefault}, ${1}, ${WH}, ${NOW}, ${NOW}, ${loc.city}, ${loc.state}, ${loc.zipCode}, ${0})`);
  }
  console.log(`${LOCATIONS.length} locations created.`);

  // 4. Services
  const services = SERVICES_RAW.map(s => ({ ...s, id: uid(), localId: uid(), color: pick(COLORS), locationIds: JSON.stringify(LOCATIONS.map(l => l.localId)) }));
  for (const svc of services) {
    await db.execute(sql`INSERT INTO services (id, businessOwnerId, localId, name, duration, price, color, createdAt, updatedAt, category, locationIds, description) VALUES (${svc.id}, ${OWNER_ID}, ${svc.localId}, ${svc.name}, ${svc.dur}, ${svc.price}, ${svc.color}, ${NOW}, ${NOW}, ${svc.cat}, ${svc.locationIds}, ${`Professional ${svc.name} service.`})`);
  }
  console.log(`${services.length} services created.`);

  // 5. Clients (250)
  const clients = [];
  for (let i = 0; i < 250; i++) {
    const fn = pick(FIRST_NAMES), ln = pick(LAST_NAMES);
    const ac = pick(['412','724','878','814','610']);
    const phone = `${ac}${rand(1000000,9999999)}`;
    const notes = rand(0,3)===0 ? pick(['Prefers morning appointments','Sensitive skin','VIP client','Allergic to latex','Regular monthly client','Referred by Emma Smith','Loves deep tissue massage']) : null;
    const birthday = rand(0,3)===0 ? `${rand(1970,2000)}-${String(rand(1,12)).padStart(2,'0')}-${String(rand(1,28)).padStart(2,'0')}` : null;
    const c = { id: uid(), businessOwnerId: OWNER_ID, localId: uid(), name: `${fn} ${ln}`, phone, email: `${fn.toLowerCase()}.${ln.toLowerCase()}${rand(1,99)}@gmail.com`, notes, birthday };
    clients.push(c);
    await db.execute(sql`INSERT INTO clients (id, businessOwnerId, localId, name, phone, email, notes, birthday, createdAt, updatedAt) VALUES (${c.id}, ${OWNER_ID}, ${c.localId}, ${c.name}, ${c.phone}, ${c.email}, ${c.notes}, ${c.birthday}, ${NOW}, ${NOW})`);
    if ((i+1) % 50 === 0) process.stdout.write(`\rClients: ${i+1}/250`);
  }
  console.log('\n250 clients created.');

  // 6. Products (200)
  for (let i = 0; i < 200; i++) {
    const brand = pick(BRANDS);
    const pname = pick(PRODUCT_NAMES_LIST);
    const price = Math.round(rand(1200, 15000)) / 100;
    await db.execute(sql`INSERT INTO products (id, businessOwnerId, localId, name, price, description, available, createdAt, updatedAt, brand) VALUES (${uid()}, ${OWNER_ID}, ${uid()}, ${brand + ' ' + pname}, ${price}, ${`Professional ${pname.toLowerCase()} by ${brand}. ${pick(['Salon exclusive.','Best seller.','New formula.','Staff favorite.'])}`}, ${rand(0,10)>1?1:0}, ${NOW}, ${NOW}, ${brand})`);
    if ((i+1) % 50 === 0) process.stdout.write(`\rProducts: ${i+1}/200`);
  }
  console.log('\n200 products created.');

  // 7. Gift cards (25)
  const GIFT_MSGS = ['Happy Birthday! Enjoy your pampering session!','Congratulations on your promotion!','Thank you for being an amazing friend!','Happy Mother\'s Day!','Happy Anniversary! Enjoy some relaxation.','You deserve a treat!','Happy Holidays from all of us!','Thank you for everything!','Enjoy your special day!'];
  const RECIP_NAMES = ['Sarah Johnson','Emily Davis','Jessica Wilson','Amanda Taylor','Michelle Brown','Ashley Martinez','Brittany Anderson','Stephanie Thomas','Jennifer Garcia','Rachel Lee'];
  const svcLocalIds = services.map(s => s.localId);
  for (let i = 0; i < 25; i++) {
    const code = `LIME${rand(10000,99999)}`;
    const redeemed = rand(0,2)===0 ? 1 : 0;
    const expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear()+1);
    const expiresStr = expiresAt.toISOString().slice(0,19).replace('T',' ');
    const redeemedAt = redeemed ? new Date(Date.now()-rand(1,30)*86400000).toISOString().slice(0,19).replace('T',' ') : null;
    await db.execute(sql`INSERT INTO gift_cards (id, businessOwnerId, localId, code, serviceLocalId, recipientName, recipientPhone, message, redeemed, redeemedAt, expiresAt, createdAt, updatedAt) VALUES (${uid()}, ${OWNER_ID}, ${uid()}, ${code}, ${rand(0,3)===0?pick(svcLocalIds):null}, ${pick(RECIP_NAMES)}, ${'412'+rand(1000000,9999999)}, ${pick(GIFT_MSGS)}, ${redeemed}, ${redeemedAt}, ${expiresStr}, ${NOW}, ${NOW})`);
  }
  console.log('25 gift cards created.');

  // 8. Discounts (10)
  const discountDefs = [
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
  for (const d of discountDefs) {
    const svcIds = JSON.stringify(pickN(svcLocalIds, rand(8,25)));
    await db.execute(sql`INSERT INTO discounts (id, businessOwnerId, localId, name, percentage, startTime, endTime, daysOfWeek, serviceIds, active, createdAt, updatedAt, dates, maxUses) VALUES (${uid()}, ${OWNER_ID}, ${uid()}, ${d.name}, ${d.pct}, ${d.start}, ${d.end}, ${JSON.stringify(d.days)}, ${svcIds}, ${d.active}, ${NOW}, ${NOW}, ${null}, ${d.maxUses})`);
  }
  console.log('10 discounts created.');

  // 9. Appointments (2000)
  console.log('Inserting 2000 appointments...');
  const DISC_NAMES = ['New Client Welcome','Happy Hour Special','Loyalty Reward','Birthday Special','Refer a Friend'];
  const PAY_METHODS = ['cash','zelle','venmo','cashapp','cash','cash','zelle'];
  const CANCEL_REASONS = ['Client request','No show','Staff unavailable','Emergency','Rescheduled','Weather'];
  const APPT_NOTES = ['Client requested extra time','First time client','VIP - extra attention','Patch test done','Special occasion - birthday','Referred by friend'];

  for (let i = 0; i < 2000; i++) {
    const svc = pick(services);
    const client = pick(clients);
    const loc = pick(LOCATIONS);
    const isFuture = i >= 1800; // last 200 are future
    let dateStr, status, paymentStatus, paymentMethod;
    if (isFuture) {
      dateStr = randomFutureDate(1, 14);
      status = pick(['confirmed','confirmed','confirmed','pending','pending']);
      paymentStatus = 'unpaid'; paymentMethod = null;
    } else if (i < 900) {
      dateStr = randomPastDate(180, 365);
      const r = rand(0,99);
      if (r<55){status='completed';paymentStatus='paid';}
      else if(r<70){status='completed';paymentStatus='unpaid';}
      else if(r<80){status='cancelled';paymentStatus='unpaid';}
      else if(r<88){status='confirmed';paymentStatus='paid';}
      else{status='pending';paymentStatus='unpaid';}
      paymentMethod = paymentStatus==='paid' ? pick(PAY_METHODS) : null;
    } else {
      dateStr = randomPastDate(1, 179);
      const r = rand(0,99);
      if (r<55){status='completed';paymentStatus='paid';}
      else if(r<70){status='completed';paymentStatus='unpaid';}
      else if(r<80){status='cancelled';paymentStatus='unpaid';}
      else if(r<88){status='confirmed';paymentStatus='paid';}
      else{status='pending';paymentStatus='unpaid';}
      paymentMethod = paymentStatus==='paid' ? pick(PAY_METHODS) : null;
    }
    const discPct = rand(0,10)===0 ? pick([10,15,20,25]) : null;
    const totalPrice = Math.round(svc.price * (1 - (discPct||0)/100) * 100) / 100;
    const notes = rand(0,8)===0 ? pick(APPT_NOTES) : null;
    const cancelReason = status==='cancelled' ? pick(CANCEL_REASONS) : null;
    const payConfNum = (paymentMethod==='zelle'||paymentMethod==='venmo'||paymentMethod==='cashapp') ? `TXN${rand(100000,999999)}` : null;
    const payConfAt = paymentStatus==='paid' ? new Date(Date.now()-rand(0,30)*86400000).toISOString().slice(0,19).replace('T',' ') : null;
    const discName = discPct ? pick(DISC_NAMES) : null;
    const discAmt = discPct ? Math.round(svc.price * discPct/100 * 100)/100 : null;

    await db.execute(sql`INSERT INTO appointments (id, businessOwnerId, localId, serviceLocalId, clientLocalId, date, time, duration, status, notes, createdAt, updatedAt, totalPrice, extraItems, discountPercent, discountAmount, discountName, giftApplied, giftUsedAmount, staffId, locationId, cancellationReason, paymentMethod, paymentStatus, paymentConfirmationNumber, paymentConfirmedAt) VALUES (${uid()}, ${OWNER_ID}, ${uid()}, ${svc.localId}, ${client.localId}, ${dateStr}, ${pick(TIME_SLOTS)}, ${svc.dur}, ${status}, ${notes}, ${NOW}, ${NOW}, ${totalPrice}, ${null}, ${discPct}, ${discAmt}, ${discName}, ${null}, ${null}, ${null}, ${loc.localId}, ${cancelReason}, ${paymentMethod}, ${paymentStatus}, ${payConfNum}, ${payConfAt})`);

    if ((i+1) % 100 === 0) process.stdout.write(`\rAppointments: ${i+1}/2000`);
  }
  console.log('\n2000 appointments created.');
  console.log('\n✅ Seed complete!');
  console.log('Business Owner ID:', OWNER_ID);
  console.log('Phone:', PHONE, '| Plan: unlimited | Status: active');
  process.exit(0);
}

main().catch(e => { console.error('\n❌ Seed failed:', e.message); process.exit(1); });
