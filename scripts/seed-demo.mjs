/**
 * Comprehensive demo seed script for Lime Cut (businessOwnerId = 1620003)
 * Inserts: business profile update, 3 locations, 15 staff, 42 services,
 * 67 products, 237 clients, 675+ appointments, 235 reviews, 15 gift cards,
 * 6 discounts, 8 promo codes, 5 packages (stored in businessOwner JSON)
 */
import mysql from '../node_modules/mysql2/promise.js';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const BIZ_ID = 1620003;

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _uid = 1;
function uid() { return `seed-${Date.now()}-${_uid++}`; }

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function dateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function futureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function randomPastDate(maxDaysAgo = 180) {
  return dateStr(rnd(3, maxDaysAgo));
}

function randomTime() {
  const hours = rnd(9, 17);
  const mins = pick(['00', '30']);
  return `${String(hours).padStart(2,'0')}:${mins}`;
}

function randomPhone() {
  return `412${rnd(100,999)}${rnd(1000,9999)}`;
}

function randomDOB() {
  const year = rnd(1970, 2000);
  const month = String(rnd(1,12)).padStart(2,'0');
  const day = String(rnd(1,28)).padStart(2,'0');
  return `${year}-${month}-${day}`;
}

const FIRST_NAMES = ['Emma','Olivia','Ava','Isabella','Sophia','Mia','Charlotte','Amelia','Harper','Evelyn','Abigail','Emily','Elizabeth','Mila','Ella','Avery','Sofia','Camila','Aria','Scarlett','Victoria','Madison','Luna','Grace','Chloe','Penelope','Layla','Riley','Zoey','Nora','Lily','Eleanor','Hannah','Lillian','Addison','Aubrey','Ellie','Stella','Natalie','Zoe','Leah','Hazel','Violet','Aurora','Savannah','Audrey','Brooklyn','Bella','Claire','Skylar','Lucy','Paisley','Everly','Anna','Caroline','Nova','Genesis','Emilia','Kennedy','Samantha','Maya','Willow','Kinsley','Naomi','Aaliyah','Elena','Sarah','Ariana','Allison','Gabriella','Alice','Madelyn','Cora','Ruby','Eva','Serenity','Autumn','Adeline','Hailey','Gianna','Valentina','Isla','Eliana','Quinn','Nevaeh','Ivy','Sadie','Piper','Lydia','Alexa','Josephine','Emery','Julia','Delilah','Arianna','Vivian','Kaylee','Sophie','Brielle','Madeline','Peyton','Rylee','Clara','Hadley','Melanie','Mackenzie','Reagan','Adalynn','Liliana','Aubree','Jade','Katherine','Isabelle','Natalia','Raelynn','Maria','Athena','Ximena','Ariel','Leilani','Paislee','Brianna','Nadia','Mya','Lyla','Margot','Amara','Anastasia','Jasmine','Elise','Cecilia','Valeria','Aliyah','Lena','Alina','Molly','Alicia','Brooke','Jocelyn','Daniela','Stella','Paige','Harmony','Julianna','Adriana','Fiona','Tessa','Norah','Gracie','Makayla','Alana','Lyric','Remi','Journee','Zara','Sienna','Londyn','Mckenzie','Mckenna','Mariah','Maci','Elaina','Khloe','Emerson','Daisy','Ryleigh','Genevieve','Arabella','Alayna','Juliana','Emilee','Abby','Annabelle','Leila','Mikayla','Keira','Camille','Alondra','Jenna','Bethany','Presley','Madeleine','Kaitlyn','Sloane','Amiyah','Lila','Kylie','Kenzie','Lacey','Shelby','Tatum','Lexi','Emelia','Jaylen','Mila','Nyla','Amira','Amani','Nia','Destiny','Ciara','Kezia','Imani','Aisha','Fatima','Laila','Nour','Yasmin','Hana','Sana','Zainab','Rania','Dina','Lina','Mona','Nadia','Reem','Sahar','Tamara','Yara','Zara','Amal','Basma','Dalia','Farah','Ghada','Heba','Iman','Jana','Karima'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Turner','Phillips','Evans','Collins','Stewart','Morris','Morgan','Reed','Cook','Bell','Murphy','Bailey','Cooper','Richardson','Cox','Howard','Ward','Torres','Peterson','Gray','Ramirez','James','Watson','Brooks','Kelly','Sanders','Price','Bennett','Wood','Barnes','Ross','Henderson','Coleman','Jenkins','Perry','Powell','Long','Patterson','Hughes','Flores','Washington','Butler','Simmons','Foster','Gonzales','Bryant','Alexander','Russell','Griffin','Diaz','Hayes'];

const REVIEW_COMMENTS = [
  "Absolutely love this place! My hair has never looked better.",
  "Amazing service, very professional and friendly staff.",
  "Best salon in Pittsburgh! I always leave feeling great.",
  "The staff really listened to what I wanted and delivered perfectly.",
  "Highly recommend! Great atmosphere and excellent results.",
  "I've been coming here for years and they never disappoint.",
  "Wonderful experience from start to finish. Will definitely be back.",
  "Very talented team. My color came out exactly as I envisioned.",
  "Clean, modern salon with top-notch service. 10/10!",
  "The massage was incredibly relaxing. I fell asleep during the session!",
  "My nails look stunning. The nail tech is so skilled and creative.",
  "Great value for the quality of service. Definitely worth it.",
  "The staff made me feel so welcome and comfortable. Love this place!",
  "I was nervous about trying a new salon but they made it easy.",
  "Exceptional service! My skin has never felt so smooth and refreshed.",
  "The facial was divine. My skin glowed for days afterward.",
  "Such a talented team. I always get compliments after my visits.",
  "The atmosphere is so relaxing and the staff is incredibly skilled.",
  "I drove 45 minutes just to come here and it was absolutely worth it.",
  "My go-to salon for everything. They always exceed my expectations.",
  "The balayage turned out perfect. Exactly what I was looking for!",
  "Professional, punctual, and precise. Couldn't ask for more.",
  "The hot stone massage was life-changing. I'll be back every month!",
  "Love the new location! Even more spacious and beautiful.",
  "The waxing service was quick and virtually painless. Impressive!",
  "My eyebrows have never looked so defined and natural.",
  "The keratin treatment transformed my hair. So smooth and shiny!",
  "I always feel like a VIP when I come here. Outstanding service.",
  "The staff goes above and beyond every single time.",
  "Best haircut I've ever had. They really understand my hair type.",
  "The aromatherapy massage was heavenly. I was completely relaxed.",
  "My daughter and I came together for a girls' day and had a blast!",
  "The gel manicure lasted three weeks without chipping. Incredible!",
  "I love how they always remember my preferences. Personal touch!",
  "The deep tissue massage worked out all my tension. Highly recommend.",
  "Such a clean and well-maintained salon. I always feel safe here.",
  "The lash extensions look so natural. I get compliments constantly.",
  "My hair color is exactly what I wanted. The colorist is a true artist.",
  "The staff is so knowledgeable about hair care and products.",
  "I've referred all my friends here. Everyone loves it!",
];

const conn = await mysql.createConnection(DB_URL);
console.log('Connected to database');

// ─── 1. Update Business Profile ───────────────────────────────────────────────
console.log('\n[1/10] Updating business profile...');
await conn.query(`
  UPDATE business_owners SET
    businessName = 'Lime Cut & Wellness',
    phone = '4124827733',
    address = '1247 Penn Avenue, Pittsburgh, PA 15222',
    description = 'Pittsburgh''s premier full-service salon and wellness studio. We offer expert hair care, nail services, skincare, massage therapy, and more — all under one roof. Our team of 15 certified professionals is dedicated to making you look and feel your absolute best.',
    website = 'https://limecutwellness.com',
    zelleHandle = '4124827733',
    cashAppHandle = '$LimeCutWellness',
    venmoHandle = '@LimeCutWellness'
  WHERE id = ?
`, [BIZ_ID]);
console.log('  ✓ Business profile updated');

// ─── 2. Insert Locations ──────────────────────────────────────────────────────
console.log('\n[2/10] Inserting 3 locations...');
const workingHours = JSON.stringify({
  sunday:    { enabled: false, start: '09:00', end: '17:00' },
  monday:    { enabled: true,  start: '09:00', end: '19:00' },
  tuesday:   { enabled: true,  start: '09:00', end: '19:00' },
  wednesday: { enabled: true,  start: '09:00', end: '19:00' },
  thursday:  { enabled: true,  start: '09:00', end: '20:00' },
  friday:    { enabled: true,  start: '09:00', end: '20:00' },
  saturday:  { enabled: true,  start: '08:00', end: '18:00' },
});
const wh2 = JSON.stringify({
  sunday:    { enabled: true,  start: '10:00', end: '16:00' },
  monday:    { enabled: true,  start: '10:00', end: '18:00' },
  tuesday:   { enabled: true,  start: '10:00', end: '18:00' },
  wednesday: { enabled: false, start: '10:00', end: '18:00' },
  thursday:  { enabled: true,  start: '10:00', end: '19:00' },
  friday:    { enabled: true,  start: '10:00', end: '19:00' },
  saturday:  { enabled: true,  start: '09:00', end: '17:00' },
});

const LOC1 = uid(), LOC2 = uid(), LOC3 = uid();
await conn.query(`DELETE FROM locations WHERE businessOwnerId = ?`, [BIZ_ID]);
await conn.query(`
  INSERT INTO locations (businessOwnerId, localId, name, address, city, state, zipCode, phone, email, isDefault, active, workingHours) VALUES
  (?, ?, 'Penn Avenue Studio', '1247 Penn Avenue', 'Pittsburgh', 'PA', '15222', '4124827733', 'pennave@limecutwellness.com', 1, 1, ?),
  (?, ?, 'Shadyside Lounge', '5432 Walnut Street', 'Pittsburgh', 'PA', '15232', '4125551234', 'shadyside@limecutwellness.com', 0, 1, ?),
  (?, ?, 'South Side Spa', '2109 East Carson Street', 'Pittsburgh', 'PA', '15203', '4125559876', 'southside@limecutwellness.com', 0, 1, ?)
`, [BIZ_ID, LOC1, workingHours, BIZ_ID, LOC2, wh2, BIZ_ID, LOC3, workingHours]);
console.log('  ✓ 3 locations inserted');

// ─── 3. Insert Services (42) ──────────────────────────────────────────────────
console.log('\n[3/10] Inserting 42 services...');
await conn.query(`DELETE FROM services WHERE businessOwnerId = ?`, [BIZ_ID]);

const serviceData = [
  // Hair Services
  { name: 'Women\'s Haircut & Style', duration: 60, price: '65.00', color: '#22C55E', category: 'Hair' },
  { name: 'Men\'s Haircut', duration: 30, price: '35.00', color: '#22C55E', category: 'Hair' },
  { name: 'Children\'s Haircut', duration: 30, price: '25.00', color: '#22C55E', category: 'Hair' },
  { name: 'Blowout & Style', duration: 45, price: '55.00', color: '#22C55E', category: 'Hair' },
  { name: 'Updo & Special Occasion', duration: 90, price: '95.00', color: '#22C55E', category: 'Hair' },
  { name: 'Balayage', duration: 180, price: '185.00', color: '#22C55E', category: 'Hair' },
  { name: 'Full Color', duration: 120, price: '120.00', color: '#22C55E', category: 'Hair' },
  { name: 'Highlights', duration: 150, price: '155.00', color: '#22C55E', category: 'Hair' },
  { name: 'Gloss & Toner', duration: 45, price: '65.00', color: '#22C55E', category: 'Hair' },
  { name: 'Keratin Treatment', duration: 180, price: '250.00', color: '#22C55E', category: 'Hair' },
  { name: 'Deep Conditioning Treatment', duration: 30, price: '45.00', color: '#22C55E', category: 'Hair' },
  { name: 'Scalp Treatment', duration: 30, price: '40.00', color: '#22C55E', category: 'Hair' },
  // Nail Services
  { name: 'Classic Manicure', duration: 30, price: '30.00', color: '#EC4899', category: 'Nails' },
  { name: 'Gel Manicure', duration: 45, price: '45.00', color: '#EC4899', category: 'Nails' },
  { name: 'Classic Pedicure', duration: 45, price: '40.00', color: '#EC4899', category: 'Nails' },
  { name: 'Gel Pedicure', duration: 60, price: '55.00', color: '#EC4899', category: 'Nails' },
  { name: 'Mani-Pedi Combo', duration: 90, price: '75.00', color: '#EC4899', category: 'Nails' },
  { name: 'Acrylic Full Set', duration: 90, price: '65.00', color: '#EC4899', category: 'Nails' },
  { name: 'Acrylic Fill', duration: 60, price: '40.00', color: '#EC4899', category: 'Nails' },
  { name: 'Nail Art (per nail)', duration: 30, price: '20.00', color: '#EC4899', category: 'Nails' },
  // Skincare
  { name: 'Classic Facial', duration: 60, price: '85.00', color: '#06B6D4', category: 'Skincare' },
  { name: 'Anti-Aging Facial', duration: 75, price: '110.00', color: '#06B6D4', category: 'Skincare' },
  { name: 'Hydrating Facial', duration: 60, price: '95.00', color: '#06B6D4', category: 'Skincare' },
  { name: 'Acne Treatment Facial', duration: 60, price: '90.00', color: '#06B6D4', category: 'Skincare' },
  { name: 'Chemical Peel', duration: 45, price: '120.00', color: '#06B6D4', category: 'Skincare' },
  { name: 'Microdermabrasion', duration: 60, price: '130.00', color: '#06B6D4', category: 'Skincare' },
  { name: 'LED Light Therapy', duration: 30, price: '75.00', color: '#06B6D4', category: 'Skincare' },
  // Massage
  { name: 'Swedish Massage (60 min)', duration: 60, price: '90.00', color: '#8B5CF6', category: 'Massage' },
  { name: 'Swedish Massage (90 min)', duration: 90, price: '130.00', color: '#8B5CF6', category: 'Massage' },
  { name: 'Deep Tissue Massage', duration: 60, price: '100.00', color: '#8B5CF6', category: 'Massage' },
  { name: 'Hot Stone Massage', duration: 90, price: '145.00', color: '#8B5CF6', category: 'Massage' },
  { name: 'Aromatherapy Massage', duration: 60, price: '95.00', color: '#8B5CF6', category: 'Massage' },
  { name: 'Couples Massage', duration: 60, price: '175.00', color: '#8B5CF6', category: 'Massage' },
  { name: 'Prenatal Massage', duration: 60, price: '95.00', color: '#8B5CF6', category: 'Massage' },
  // Waxing & Brows
  { name: 'Eyebrow Wax & Shape', duration: 20, price: '22.00', color: '#F97316', category: 'Waxing & Brows' },
  { name: 'Lip Wax', duration: 15, price: '15.00', color: '#F97316', category: 'Waxing & Brows' },
  { name: 'Full Face Wax', duration: 30, price: '45.00', color: '#F97316', category: 'Waxing & Brows' },
  { name: 'Underarm Wax', duration: 20, price: '25.00', color: '#F97316', category: 'Waxing & Brows' },
  { name: 'Leg Wax (Full)', duration: 45, price: '65.00', color: '#F97316', category: 'Waxing & Brows' },
  { name: 'Brow Lamination', duration: 60, price: '75.00', color: '#F97316', category: 'Waxing & Brows' },
  { name: 'Lash Lift & Tint', duration: 60, price: '85.00', color: '#F97316', category: 'Waxing & Brows' },
  { name: 'Lash Extensions (Full Set)', duration: 120, price: '150.00', color: '#F97316', category: 'Waxing & Brows' },
];

const serviceIds = [];
for (const s of serviceData) {
  const id = uid();
  serviceIds.push(id);
  await conn.query(`
    INSERT INTO services (businessOwnerId, localId, name, duration, price, color, category, description, locationIds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `, [BIZ_ID, id, s.name, s.duration, s.price, s.color, s.category,
    `Professional ${s.name.toLowerCase()} service by our certified specialists.`]);
}
console.log(`  ✓ ${serviceData.length} services inserted`);

// ─── 4. Insert Staff (15) ─────────────────────────────────────────────────────
console.log('\n[4/10] Inserting 15 staff members...');
await conn.query(`DELETE FROM staff_members WHERE businessOwnerId = ?`, [BIZ_ID]);

const staffColors = ['#22C55E','#EC4899','#06B6D4','#8B5CF6','#F97316','#EF4444','#F59E0B','#10B981','#3B82F6','#A855F7','#14B8A6','#F43F5E','#84CC16','#6366F1','#FB923C'];
const staffRoles = ['Senior Stylist','Hair Colorist','Nail Technician','Esthetician','Massage Therapist','Junior Stylist','Brow Specialist','Lash Artist','Skincare Specialist','Wellness Coach'];

const staffNames = [
  { name: 'Jessica Martinez', role: 'Senior Stylist', loc: LOC1 },
  { name: 'Brittany Thompson', role: 'Hair Colorist', loc: LOC1 },
  { name: 'Ashley Johnson', role: 'Nail Technician', loc: LOC1 },
  { name: 'Samantha Davis', role: 'Esthetician', loc: LOC1 },
  { name: 'Rachel Wilson', role: 'Massage Therapist', loc: LOC1 },
  { name: 'Tiffany Brown', role: 'Senior Stylist', loc: LOC2 },
  { name: 'Nicole Garcia', role: 'Brow Specialist', loc: LOC2 },
  { name: 'Melissa Rodriguez', role: 'Nail Technician', loc: LOC2 },
  { name: 'Amanda Lee', role: 'Massage Therapist', loc: LOC2 },
  { name: 'Stephanie White', role: 'Esthetician', loc: LOC2 },
  { name: 'Kimberly Harris', role: 'Senior Stylist', loc: LOC3 },
  { name: 'Lauren Clark', role: 'Lash Artist', loc: LOC3 },
  { name: 'Crystal Lewis', role: 'Hair Colorist', loc: LOC3 },
  { name: 'Danielle Walker', role: 'Skincare Specialist', loc: LOC3 },
  { name: 'Monique Hall', role: 'Massage Therapist', loc: LOC3 },
];

const staffWH = JSON.stringify({
  sunday:    { enabled: false, start: '09:00', end: '17:00' },
  monday:    { enabled: true,  start: '09:00', end: '18:00' },
  tuesday:   { enabled: true,  start: '09:00', end: '18:00' },
  wednesday: { enabled: true,  start: '09:00', end: '18:00' },
  thursday:  { enabled: true,  start: '10:00', end: '19:00' },
  friday:    { enabled: true,  start: '10:00', end: '19:00' },
  saturday:  { enabled: true,  start: '08:00', end: '16:00' },
});

const staffIds = [];
for (let i = 0; i < staffNames.length; i++) {
  const s = staffNames[i];
  const id = uid();
  staffIds.push(id);
  const svcSubset = JSON.stringify(serviceIds.slice(0, rnd(6, 15)));
  await conn.query(`
    INSERT INTO staff_members (businessOwnerId, localId, name, phone, email, role, color, serviceIds, locationIds, workingHours, active, commissionRate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `, [BIZ_ID, id, s.name, randomPhone(), `${s.name.split(' ')[0].toLowerCase()}@limecutwellness.com`,
    s.role, staffColors[i], svcSubset, JSON.stringify([s.loc]), staffWH, rnd(35, 55)]);
}
console.log(`  ✓ ${staffNames.length} staff members inserted`);

// ─── 5. Insert Products (67) ──────────────────────────────────────────────────
console.log('\n[5/10] Inserting 67 products...');
await conn.query(`DELETE FROM products WHERE businessOwnerId = ?`, [BIZ_ID]);

const productData = [
  // Olaplex
  { name: 'Olaplex No.3 Hair Perfector', price: '30.00', brand: 'Olaplex', desc: 'At-home bond-building treatment' },
  { name: 'Olaplex No.4 Bond Maintenance Shampoo', price: '30.00', brand: 'Olaplex', desc: 'Strengthening shampoo' },
  { name: 'Olaplex No.5 Bond Maintenance Conditioner', price: '30.00', brand: 'Olaplex', desc: 'Strengthening conditioner' },
  { name: 'Olaplex No.6 Bond Smoother', price: '28.00', brand: 'Olaplex', desc: 'Leave-in smoothing treatment' },
  { name: 'Olaplex No.7 Bonding Oil', price: '30.00', brand: 'Olaplex', desc: 'Highly concentrated reparative styling oil' },
  { name: 'Olaplex No.8 Bond Intense Moisture Mask', price: '30.00', brand: 'Olaplex', desc: 'Glossing and hydrating hair mask' },
  { name: 'Olaplex No.9 Bond Protector Nourishing Serum', price: '32.00', brand: 'Olaplex', desc: 'Nourishing serum for all hair types' },
  // Redken
  { name: 'Redken All Soft Shampoo', price: '24.00', brand: 'Redken', desc: 'Moisturizing shampoo for dry hair' },
  { name: 'Redken All Soft Conditioner', price: '24.00', brand: 'Redken', desc: 'Moisturizing conditioner' },
  { name: 'Redken Color Extend Shampoo', price: '22.00', brand: 'Redken', desc: 'Protects and extends color vibrancy' },
  { name: 'Redken Extreme Strength Builder', price: '26.00', brand: 'Redken', desc: 'Strengthening mask for damaged hair' },
  { name: 'Redken Frizz Dismiss Shampoo', price: '22.00', brand: 'Redken', desc: 'Anti-frizz shampoo' },
  { name: 'Redken High Rise Volume Shampoo', price: '22.00', brand: 'Redken', desc: 'Volumizing shampoo for fine hair' },
  { name: 'Redken Pillow Proof Dry Shampoo', price: '28.00', brand: 'Redken', desc: 'Invisible dry shampoo' },
  // Moroccanoil
  { name: 'Moroccanoil Treatment Original', price: '46.00', brand: 'Moroccanoil', desc: 'Iconic argan oil hair treatment' },
  { name: 'Moroccanoil Hydrating Shampoo', price: '26.00', brand: 'Moroccanoil', desc: 'Hydrating shampoo with argan oil' },
  { name: 'Moroccanoil Hydrating Conditioner', price: '26.00', brand: 'Moroccanoil', desc: 'Hydrating conditioner with argan oil' },
  { name: 'Moroccanoil Intense Hydrating Mask', price: '38.00', brand: 'Moroccanoil', desc: 'Deep conditioning hair mask' },
  { name: 'Moroccanoil Curl Defining Cream', price: '34.00', brand: 'Moroccanoil', desc: 'Defines and enhances curls' },
  { name: 'Moroccanoil Dry Scalp Treatment', price: '44.00', brand: 'Moroccanoil', desc: 'Nourishing scalp treatment' },
  // Kerastase
  { name: 'Kérastase Nutritive Bain Satin Shampoo', price: '38.00', brand: 'Kérastase', desc: 'Nourishing shampoo for dry hair' },
  { name: 'Kérastase Resistance Bain Force Architecte', price: '40.00', brand: 'Kérastase', desc: 'Strengthening shampoo' },
  { name: 'Kérastase Chronologiste Revitalizing Serum', price: '65.00', brand: 'Kérastase', desc: 'Anti-aging hair serum' },
  { name: 'Kérastase Blond Absolu Masque', price: '52.00', brand: 'Kérastase', desc: 'Blonde hair mask' },
  { name: 'Kérastase Discipline Fluidissime Spray', price: '44.00', brand: 'Kérastase', desc: 'Anti-frizz spray' },
  // OPI Nail
  { name: 'OPI Nail Lacquer - Bubble Bath', price: '12.00', brand: 'OPI', desc: 'Classic sheer pink nail lacquer' },
  { name: 'OPI Nail Lacquer - Big Apple Red', price: '12.00', brand: 'OPI', desc: 'Classic red nail lacquer' },
  { name: 'OPI Nail Lacquer - Lincoln Park After Dark', price: '12.00', brand: 'OPI', desc: 'Deep plum nail lacquer' },
  { name: 'OPI GelColor - Funny Bunny', price: '16.00', brand: 'OPI', desc: 'Sheer white gel nail color' },
  { name: 'OPI GelColor - Malaga Wine', price: '16.00', brand: 'OPI', desc: 'Rich wine gel nail color' },
  { name: 'OPI Nail Envy Strengthener', price: '22.00', brand: 'OPI', desc: 'Nail strengthening treatment' },
  { name: 'OPI ProSpa Nail & Cuticle Oil', price: '18.00', brand: 'OPI', desc: 'Nourishing cuticle oil' },
  // Dermalogica Skincare
  { name: 'Dermalogica Daily Microfoliant', price: '62.00', brand: 'Dermalogica', desc: 'Daily enzyme powder exfoliant' },
  { name: 'Dermalogica Special Cleansing Gel', price: '44.00', brand: 'Dermalogica', desc: 'Soap-free foaming cleanser' },
  { name: 'Dermalogica Active Moist Moisturizer', price: '52.00', brand: 'Dermalogica', desc: 'Oil-free moisturizer' },
  { name: 'Dermalogica Skin Smoothing Cream', price: '62.00', brand: 'Dermalogica', desc: 'Hydrating moisturizer' },
  { name: 'Dermalogica Age Smart Dynamic Skin Recovery SPF50', price: '78.00', brand: 'Dermalogica', desc: 'Anti-aging SPF moisturizer' },
  { name: 'Dermalogica Phyto Replenish Body Oil', price: '68.00', brand: 'Dermalogica', desc: 'Nourishing body oil' },
  // Elemis Skincare
  { name: 'Elemis Pro-Collagen Marine Cream', price: '120.00', brand: 'Elemis', desc: 'Anti-aging moisturizer' },
  { name: 'Elemis Dynamic Resurfacing Facial Wash', price: '42.00', brand: 'Elemis', desc: 'Resurfacing facial cleanser' },
  { name: 'Elemis Superfood Facial Oil', price: '68.00', brand: 'Elemis', desc: 'Nourishing facial oil' },
  { name: 'Elemis Papaya Enzyme Peel', price: '58.00', brand: 'Elemis', desc: 'Enzymatic exfoliating peel' },
  // Massage & Wellness
  { name: 'Theragun Mini Massage Device', price: '199.00', brand: 'Therabody', desc: 'Portable percussive therapy device' },
  { name: 'Himalayan Salt Scrub', price: '28.00', brand: 'Spa Essentials', desc: 'Exfoliating body scrub' },
  { name: 'Lavender Essential Oil', price: '18.00', brand: 'Spa Essentials', desc: 'Pure lavender essential oil' },
  { name: 'Eucalyptus Essential Oil', price: '16.00', brand: 'Spa Essentials', desc: 'Pure eucalyptus essential oil' },
  { name: 'Peppermint Foot Cream', price: '22.00', brand: 'Spa Essentials', desc: 'Cooling and refreshing foot cream' },
  { name: 'Arnica Muscle Relief Gel', price: '24.00', brand: 'Spa Essentials', desc: 'Soothing muscle relief gel' },
  // Accessories
  { name: 'Silk Hair Scrunchie Set (3-pack)', price: '18.00', brand: 'LimeCut Brand', desc: 'Gentle silk scrunchies' },
  { name: 'Bamboo Paddle Brush', price: '28.00', brand: 'LimeCut Brand', desc: 'Eco-friendly detangling brush' },
  { name: 'Wide-Tooth Detangling Comb', price: '14.00', brand: 'LimeCut Brand', desc: 'Gentle detangling comb' },
  { name: 'Microfiber Hair Towel', price: '22.00', brand: 'LimeCut Brand', desc: 'Quick-dry microfiber hair towel' },
  { name: 'Satin Pillowcase', price: '32.00', brand: 'LimeCut Brand', desc: 'Hair and skin-friendly satin pillowcase' },
  { name: 'Shower Cap (2-pack)', price: '12.00', brand: 'LimeCut Brand', desc: 'Waterproof shower caps' },
  { name: 'Nail File Set (5-pack)', price: '10.00', brand: 'LimeCut Brand', desc: 'Professional-grade nail files' },
  { name: 'Cuticle Pusher & Nipper Set', price: '16.00', brand: 'LimeCut Brand', desc: 'Stainless steel cuticle tools' },
  { name: 'Exfoliating Loofah Mitt', price: '12.00', brand: 'Spa Essentials', desc: 'Exfoliating bath mitt' },
  { name: 'Jade Facial Roller', price: '28.00', brand: 'Spa Essentials', desc: 'Natural jade stone facial roller' },
  { name: 'Gua Sha Tool', price: '22.00', brand: 'Spa Essentials', desc: 'Rose quartz gua sha stone' },
  { name: 'Eye Mask (10-pack)', price: '18.00', brand: 'Spa Essentials', desc: 'Hydrating under-eye patches' },
  { name: 'Sheet Mask Set (5-pack)', price: '20.00', brand: 'Spa Essentials', desc: 'Assorted hydrating sheet masks' },
  { name: 'Lip Scrub', price: '14.00', brand: 'Spa Essentials', desc: 'Sugar lip exfoliant' },
  { name: 'Hand Cream (Travel Size)', price: '10.00', brand: 'Spa Essentials', desc: 'Nourishing hand cream' },
  { name: 'Body Butter - Shea & Mango', price: '24.00', brand: 'Spa Essentials', desc: 'Rich body butter' },
  { name: 'Dry Brush', price: '18.00', brand: 'Spa Essentials', desc: 'Natural bristle dry body brush' },
  { name: 'Bath Salts - Lavender & Rose', price: '22.00', brand: 'Spa Essentials', desc: 'Relaxing mineral bath salts' },
  { name: 'Candle - Eucalyptus & Mint', price: '28.00', brand: 'LimeCut Brand', desc: 'Hand-poured soy candle' },
];

const productIds = [];
for (const p of productData) {
  const id = uid();
  productIds.push(id);
  await conn.query(`
    INSERT INTO products (businessOwnerId, localId, name, price, description, brand, available)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `, [BIZ_ID, id, p.name, p.price, p.desc, p.brand]);
}
console.log(`  ✓ ${productData.length} products inserted`);

// ─── 6. Insert Clients (237) ──────────────────────────────────────────────────
console.log('\n[6/10] Inserting 237 clients...');
await conn.query(`DELETE FROM clients WHERE businessOwnerId = ?`, [BIZ_ID]);

const clientIds = [];
const usedPhones = new Set();
for (let i = 0; i < 237; i++) {
  const id = uid();
  clientIds.push(id);
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  let phone;
  do { phone = randomPhone(); } while (usedPhones.has(phone));
  usedPhones.add(phone);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rnd(1,99)}@gmail.com`;
  const notes = pick([null, null, null, 'Prefers no heat styling', 'Allergic to latex', 'Sensitive scalp', 'Prefers morning appointments', 'VIP client', 'Referred by friend', 'Regular monthly client']);
  await conn.query(`
    INSERT INTO clients (businessOwnerId, localId, name, phone, email, notes, birthday)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [BIZ_ID, id, `${firstName} ${lastName}`, phone, email, notes, randomDOB()]);
}
console.log(`  ✓ 237 clients inserted`);

// ─── 7. Insert Appointments ───────────────────────────────────────────────────
console.log('\n[7/10] Inserting appointments...');
await conn.query(`DELETE FROM appointments WHERE businessOwnerId = ?`, [BIZ_ID]);

const paymentMethods = ['zelle', 'venmo', 'cashapp', 'cash', 'card'];
const locations3 = [LOC1, LOC2, LOC3];
let apptCount = 0;

// Past completed appointments (675 spread over last 6 months)
for (let i = 0; i < 675; i++) {
  const id = uid();
  const clientId = pick(clientIds);
  const serviceId = pick(serviceIds);
  const svc = serviceData[serviceIds.indexOf(serviceId)] || serviceData[0];
  const staffId = pick(staffIds);
  const locId = pick(locations3);
  const date = randomPastDate(180);
  const time = randomTime();
  const payMethod = pick(paymentMethods);
  await conn.query(`
    INSERT INTO appointments (businessOwnerId, localId, serviceLocalId, clientLocalId, date, time, duration, status, totalPrice, staffId, locationId, paymentMethod, paymentStatus, paymentConfirmedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, 'paid', NOW())
  `, [BIZ_ID, id, serviceId, clientId, date, time, svc.duration, svc.price, staffId, locId, payMethod]);
  apptCount++;
}

// Cancelled appointments (76)
for (let i = 0; i < 76; i++) {
  const id = uid();
  const clientId = pick(clientIds);
  const serviceId = pick(serviceIds);
  const svc = serviceData[serviceIds.indexOf(serviceId)] || serviceData[0];
  const staffId = pick(staffIds);
  const locId = pick(locations3);
  const date = randomPastDate(180);
  const time = randomTime();
  await conn.query(`
    INSERT INTO appointments (businessOwnerId, localId, serviceLocalId, clientLocalId, date, time, duration, status, totalPrice, staffId, locationId, paymentMethod, paymentStatus, cancellationReason)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'cancelled', ?, ?, ?, 'unpaid', 'unpaid', ?)
  `, [BIZ_ID, id, serviceId, clientId, date, time, svc.duration, svc.price, staffId, locId,
    pick(['Client requested cancellation', 'Schedule conflict', 'Personal emergency', 'Weather', 'No reason provided'])]);
  apptCount++;
}

// Pending appointments (13)
for (let i = 0; i < 13; i++) {
  const id = uid();
  const clientId = pick(clientIds);
  const serviceId = pick(serviceIds);
  const svc = serviceData[serviceIds.indexOf(serviceId)] || serviceData[0];
  const staffId = pick(staffIds);
  const locId = pick(locations3);
  const date = futureDate(rnd(3, 14));
  const time = randomTime();
  await conn.query(`
    INSERT INTO appointments (businessOwnerId, localId, serviceLocalId, clientLocalId, date, time, duration, status, totalPrice, staffId, locationId, paymentMethod, paymentStatus)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 'unpaid', 'unpaid')
  `, [BIZ_ID, id, serviceId, clientId, date, time, svc.duration, svc.price, staffId, locId]);
  apptCount++;
}

// Confirmed upcoming appointments (next 2 days, ~20)
for (let i = 0; i < 20; i++) {
  const id = uid();
  const clientId = pick(clientIds);
  const serviceId = pick(serviceIds);
  const svc = serviceData[serviceIds.indexOf(serviceId)] || serviceData[0];
  const staffId = pick(staffIds);
  const locId = pick(locations3);
  const date = futureDate(rnd(0, 2));
  const time = randomTime();
  await conn.query(`
    INSERT INTO appointments (businessOwnerId, localId, serviceLocalId, clientLocalId, date, time, duration, status, totalPrice, staffId, locationId, paymentMethod, paymentStatus)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, 'unpaid', 'unpaid')
  `, [BIZ_ID, id, serviceId, clientId, date, time, svc.duration, svc.price, staffId, locId]);
  apptCount++;
}

// Additional confirmed future appointments (spread over next 30 days)
for (let i = 0; i < 45; i++) {
  const id = uid();
  const clientId = pick(clientIds);
  const serviceId = pick(serviceIds);
  const svc = serviceData[serviceIds.indexOf(serviceId)] || serviceData[0];
  const staffId = pick(staffIds);
  const locId = pick(locations3);
  const date = futureDate(rnd(3, 30));
  const time = randomTime();
  await conn.query(`
    INSERT INTO appointments (businessOwnerId, localId, serviceLocalId, clientLocalId, date, time, duration, status, totalPrice, staffId, locationId, paymentMethod, paymentStatus)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, 'unpaid', 'unpaid')
  `, [BIZ_ID, id, serviceId, clientId, date, time, svc.duration, svc.price, staffId, locId]);
  apptCount++;
}

console.log(`  ✓ ${apptCount} appointments inserted`);

// ─── 8. Insert Reviews (235) ──────────────────────────────────────────────────
console.log('\n[8/10] Inserting 235 reviews...');
await conn.query(`DELETE FROM reviews WHERE businessOwnerId = ?`, [BIZ_ID]);

for (let i = 0; i < 235; i++) {
  const id = uid();
  const clientId = pick(clientIds);
  const rating = pick([4, 4, 4, 5, 5, 5, 5, 5, 3, 5]);
  const comment = pick(REVIEW_COMMENTS);
  await conn.query(`
    INSERT INTO reviews (businessOwnerId, localId, clientLocalId, rating, comment)
    VALUES (?, ?, ?, ?, ?)
  `, [BIZ_ID, id, clientId, rating, comment]);
}
console.log('  ✓ 235 reviews inserted');

// ─── 9. Insert Discounts (6) ──────────────────────────────────────────────────
console.log('\n[9/10] Inserting discounts, gift cards, promo codes...');
await conn.query(`DELETE FROM discounts WHERE businessOwnerId = ?`, [BIZ_ID]);

const discountData = [
  { name: 'Happy Hour', percentage: 15, startTime: '14:00', endTime: '16:00', days: ['monday','tuesday','wednesday'] },
  { name: 'Early Bird Special', percentage: 10, startTime: '09:00', endTime: '10:30', days: ['monday','tuesday','wednesday','thursday','friday'] },
  { name: 'Weekend Warrior', percentage: 12, startTime: '10:00', endTime: '12:00', days: ['saturday','sunday'] },
  { name: 'Senior Discount', percentage: 20, startTime: '09:00', endTime: '17:00', days: ['monday','tuesday','wednesday','thursday','friday'] },
  { name: 'Student Special', percentage: 15, startTime: '12:00', endTime: '15:00', days: ['monday','tuesday','wednesday','thursday','friday'] },
  { name: 'Loyalty Reward', percentage: 25, startTime: '09:00', endTime: '20:00', days: ['monday','tuesday','wednesday','thursday','friday','saturday'] },
];

for (const d of discountData) {
  await conn.query(`
    INSERT INTO discounts (businessOwnerId, localId, name, percentage, startTime, endTime, daysOfWeek, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `, [BIZ_ID, uid(), d.name, d.percentage, d.startTime, d.endTime, JSON.stringify(d.days)]);
}

// Gift Cards (15)
await conn.query(`DELETE FROM gift_cards WHERE businessOwnerId = ?`, [BIZ_ID]);
const gcNames = ['Sarah Johnson','Emily Davis','Jessica Martinez','Amanda Wilson','Rachel Thompson','Brittany Brown','Nicole Garcia','Melissa Rodriguez','Ashley Lee','Stephanie White','Kimberly Harris','Lauren Clark','Crystal Lewis','Danielle Walker','Monique Hall'];
for (let i = 0; i < 15; i++) {
  const code = `GIFT${String(1000 + i).padStart(4,'0')}`;
  const serviceId = pick(serviceIds);
  const svc = serviceData[serviceIds.indexOf(serviceId)] || serviceData[0];
  await conn.query(`
    INSERT INTO gift_cards (businessOwnerId, localId, code, serviceLocalId, recipientName, recipientPhone, message, redeemed, expiresAt, purchaserName, paymentMethod, paymentStatus, totalValue, purchasedPublicly)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'card', 'paid', ?, 1)
  `, [BIZ_ID, uid(), code, serviceId, gcNames[i], randomPhone(),
    pick(['Happy Birthday! Enjoy your pampering session!', 'Treat yourself — you deserve it!', 'Congratulations on your special day!', 'Wishing you a relaxing and rejuvenating experience!']),
    i < 5 ? 1 : 0, // first 5 are redeemed
    futureDate(rnd(30, 365)),
    pick(['John Smith', 'Michael Johnson', 'David Williams', 'James Brown', 'Robert Davis']),
    svc.price]);
}

// Promo Codes (8)
await conn.query(`DELETE FROM promo_codes WHERE businessOwnerId = ?`, [BIZ_ID]);
const promoCodes = [
  { code: 'WELCOME20', label: 'New Client Welcome', percentage: 20, maxUses: 100, usedCount: 47 },
  { code: 'SUMMER15', label: 'Summer Special', percentage: 15, maxUses: 200, usedCount: 89 },
  { code: 'BDAY10', label: 'Birthday Discount', percentage: 10, maxUses: null, usedCount: 156 },
  { code: 'REFER25', label: 'Referral Reward', percentage: 25, maxUses: 50, usedCount: 23 },
  { code: 'FIRSTVISIT', label: 'First Visit Special', percentage: 15, maxUses: null, usedCount: 312 },
  { code: 'FALL10', label: 'Fall Promotion', percentage: 10, maxUses: 150, usedCount: 67 },
  { code: 'VIP30', label: 'VIP Member Discount', percentage: 30, maxUses: 25, usedCount: 18 },
  { code: 'FLATOFF15', label: '$15 Off Any Service', percentage: 0, flatAmount: '15.00', maxUses: 100, usedCount: 44 },
];
for (const p of promoCodes) {
  await conn.query(`
    INSERT INTO promo_codes (businessOwnerId, localId, code, label, percentage, flatAmount, maxUses, usedCount, active, expiresAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `, [BIZ_ID, uid(), p.code, p.label, p.percentage, p.flatAmount || null, p.maxUses || null, p.usedCount,
    pick([null, null, '2026-12-31', '2026-09-30'])]);
}
console.log('  ✓ 6 discounts, 15 gift cards, 8 promo codes inserted');

// ─── 10. Update packages in businessOwner JSON ────────────────────────────────
console.log('\n[10/10] Adding service packages...');
const packages = [
  {
    id: uid(), name: 'The Glow Package', description: 'Facial + Massage + Manicure — the ultimate relaxation combo',
    serviceIds: [serviceIds[20], serviceIds[27], serviceIds[12]], price: 195.00, sessions: 1, active: true, expiryDays: 90,
    createdAt: new Date().toISOString()
  },
  {
    id: uid(), name: 'Hair Transformation Bundle', description: 'Haircut + Color + Deep Conditioning Treatment',
    serviceIds: [serviceIds[0], serviceIds[6], serviceIds[10]], price: 199.00, sessions: 1, active: true, expiryDays: 60,
    createdAt: new Date().toISOString()
  },
  {
    id: uid(), name: '5-Session Massage Pass', description: 'Pre-purchase 5 Swedish massage sessions at a discounted rate',
    serviceIds: [serviceIds[27]], price: 380.00, sessions: 5, active: true, expiryDays: 365,
    createdAt: new Date().toISOString()
  },
  {
    id: uid(), name: 'Bridal Beauty Package', description: 'Updo + Makeup Prep Facial + Mani-Pedi + Lash Lift',
    serviceIds: [serviceIds[4], serviceIds[21], serviceIds[16], serviceIds[40]], price: 320.00, sessions: 1, active: true, expiryDays: 30,
    createdAt: new Date().toISOString()
  },
  {
    id: uid(), name: 'Monthly Wellness Membership', description: 'Monthly facial + massage + nail service — best value for regulars',
    serviceIds: [serviceIds[20], serviceIds[28], serviceIds[13]], price: 220.00, sessions: 1, active: true, expiryDays: 30,
    createdAt: new Date().toISOString()
  },
];

// Store packages in businessOwner's packages JSON column if it exists, otherwise skip gracefully
try {
  await conn.query(`UPDATE business_owners SET packages = ? WHERE id = ?`, [JSON.stringify(packages), BIZ_ID]);
  console.log('  ✓ 5 service packages saved');
} catch (e) {
  console.log('  ℹ packages column not found — skipping (packages stored client-side)');
}

// Final count
const [[{ clients: clientCnt }]] = await conn.query('SELECT COUNT(*) as clients FROM clients WHERE businessOwnerId = ?', [BIZ_ID]);
const [[{ services: svcCnt }]] = await conn.query('SELECT COUNT(*) as services FROM services WHERE businessOwnerId = ?', [BIZ_ID]);
const [[{ appts: apptCnt }]] = await conn.query('SELECT COUNT(*) as appts FROM appointments WHERE businessOwnerId = ?', [BIZ_ID]);
const [[{ reviews: revCnt }]] = await conn.query('SELECT COUNT(*) as reviews FROM reviews WHERE businessOwnerId = ?', [BIZ_ID]);
const [[{ products: prodCnt }]] = await conn.query('SELECT COUNT(*) as products FROM products WHERE businessOwnerId = ?', [BIZ_ID]);
const [[{ staff: staffCnt }]] = await conn.query('SELECT COUNT(*) as staff FROM staff_members WHERE businessOwnerId = ?', [BIZ_ID]);
const [[{ locs: locCnt }]] = await conn.query('SELECT COUNT(*) as locs FROM locations WHERE businessOwnerId = ?', [BIZ_ID]);

console.log('\n═══════════════════════════════════════');
console.log('  SEED COMPLETE — Summary');
console.log('═══════════════════════════════════════');
console.log(`  Clients:      ${clientCnt}`);
console.log(`  Services:     ${svcCnt}`);
console.log(`  Products:     ${prodCnt}`);
console.log(`  Staff:        ${staffCnt}`);
console.log(`  Locations:    ${locCnt}`);
console.log(`  Appointments: ${apptCnt}`);
console.log(`  Reviews:      ${revCnt}`);
console.log('═══════════════════════════════════════');

await conn.end();
