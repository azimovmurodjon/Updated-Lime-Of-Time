/**
 * Demo seed script for Lime Of Time
 * Creates: 1 business owner (phone 4124827733), 4 locations, 200 clients,
 * 12 staff members, 8 services, ~1000 appointments (last month + next 2 weeks)
 *
 * Run: npx tsx scripts/seed-demo.ts
 */
import "../scripts/load-env.js";
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";

const DB_URL = process.env.DATABASE_URL!;
if (!DB_URL) throw new Error("DATABASE_URL not set");

// ─── helpers ────────────────────────────────────────────────────────────────
const uid = () => randomUUID().replace(/-/g, "").slice(0, 24);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pad2 = (n: number) => String(n).padStart(2, "0");

function dateStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function timeStr(h: number, m: number) {
  return `${pad2(h)}:${pad2(m)}`;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ─── data pools ─────────────────────────────────────────────────────────────
const FIRST_NAMES = [
  "James","Mary","John","Patricia","Robert","Jennifer","Michael","Linda","William","Barbara",
  "David","Elizabeth","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Charles","Karen",
  "Christopher","Lisa","Daniel","Nancy","Matthew","Betty","Anthony","Margaret","Mark","Sandra",
  "Donald","Ashley","Steven","Dorothy","Paul","Kimberly","Andrew","Emily","Joshua","Donna",
  "Kenneth","Michelle","Kevin","Carol","Brian","Amanda","George","Melissa","Timothy","Deborah",
  "Ronald","Stephanie","Edward","Rebecca","Jason","Sharon","Jeffrey","Laura","Ryan","Cynthia",
  "Jacob","Kathleen","Gary","Amy","Nicholas","Angela","Eric","Shirley","Jonathan","Anna",
  "Stephen","Brenda","Larry","Pamela","Justin","Emma","Scott","Nicole","Brandon","Helen",
  "Benjamin","Samantha","Samuel","Katherine","Raymond","Christine","Gregory","Debra","Frank","Rachel",
  "Alexander","Carolyn","Patrick","Janet","Jack","Catherine","Dennis","Maria","Jerry","Heather",
  "Tyler","Diane","Aaron","Julie","Jose","Joyce","Adam","Victoria","Nathan","Ruth",
  "Henry","Lauren","Zachary","Kelly","Douglas","Christina","Peter","Joan","Kyle","Evelyn",
  "Noah","Judith","Ethan","Megan","Jeremy","Cheryl","Christian","Andrea","Walter","Hannah",
  "Keith","Martha","Austin","Jacqueline","Roger","Frances","Terry","Gloria","Sean","Ann",
  "Gerald","Teresa","Carl","Kathryn","Harold","Sara","Dylan","Janice","Arthur","Jean",
  "Lawrence","Alice","Jordan","Julia","Jesse","Joyce","Bryan","Grace","Billy","Denise",
  "Joe","Amber","Bruce","Marilyn","Gabriel","Beverly","Logan","Danielle","Albert","Theresa",
  "Willie","Sophia","Alan","Marie","Juan","Diana","Wayne","Brittany","Roy","Natalie",
  "Ralph","Isabella","Randy","Kayla","Eugene","Alexis","Vincent","Tiffany","Russell","Abigail",
];
const LAST_NAMES = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
  "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
  "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
  "Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
  "Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts",
  "Gomez","Phillips","Evans","Turner","Diaz","Parker","Cruz","Edwards","Collins","Reyes",
  "Stewart","Morris","Morales","Murphy","Cook","Rogers","Gutierrez","Ortiz","Morgan","Cooper",
  "Peterson","Bailey","Reed","Kelly","Howard","Ramos","Kim","Cox","Ward","Richardson",
  "Watson","Brooks","Chavez","Wood","James","Bennett","Gray","Mendoza","Ruiz","Hughes",
  "Price","Alvarez","Castillo","Sanders","Patel","Myers","Long","Ross","Foster","Jimenez",
];

const SERVICES = [
  { localId: uid(), name: "Haircut", duration: 30, price: "35.00", color: "#4CAF50", category: "Hair" },
  { localId: uid(), name: "Hair Color", duration: 90, price: "120.00", color: "#9C27B0", category: "Hair" },
  { localId: uid(), name: "Blowout", duration: 45, price: "55.00", color: "#2196F3", category: "Hair" },
  { localId: uid(), name: "Manicure", duration: 30, price: "30.00", color: "#E91E63", category: "Nails" },
  { localId: uid(), name: "Pedicure", duration: 45, price: "45.00", color: "#FF5722", category: "Nails" },
  { localId: uid(), name: "Facial", duration: 60, price: "80.00", color: "#00BCD4", category: "Skin" },
  { localId: uid(), name: "Massage", duration: 60, price: "90.00", color: "#FF9800", category: "Body" },
  { localId: uid(), name: "Waxing", duration: 30, price: "40.00", color: "#795548", category: "Body" },
];

const LOCATIONS_DATA = [
  {
    localId: uid(),
    name: "Main",
    address: "134 Locust Ct",
    city: "Pittsburgh",
    state: "PA",
    zipCode: "15237",
    phone: "(412) 482-7733",
    isDefault: true,
    workingHours: {
      Monday:    { enabled: true,  start: "09:00", end: "18:00" },
      Tuesday:   { enabled: true,  start: "09:00", end: "18:00" },
      Wednesday: { enabled: true,  start: "09:00", end: "18:00" },
      Thursday:  { enabled: true,  start: "09:00", end: "20:00" },
      Friday:    { enabled: true,  start: "09:00", end: "20:00" },
      Saturday:  { enabled: true,  start: "10:00", end: "17:00" },
      Sunday:    { enabled: false, start: "10:00", end: "15:00" },
    },
  },
  {
    localId: uid(),
    name: "Downtown",
    address: "500 Grant St, Suite 200",
    city: "Pittsburgh",
    state: "PA",
    zipCode: "15219",
    phone: "(412) 555-0101",
    isDefault: false,
    workingHours: {
      Monday:    { enabled: true,  start: "08:00", end: "17:00" },
      Tuesday:   { enabled: true,  start: "08:00", end: "17:00" },
      Wednesday: { enabled: true,  start: "08:00", end: "17:00" },
      Thursday:  { enabled: true,  start: "08:00", end: "17:00" },
      Friday:    { enabled: true,  start: "08:00", end: "16:00" },
      Saturday:  { enabled: false, start: "09:00", end: "14:00" },
      Sunday:    { enabled: false, start: "09:00", end: "14:00" },
    },
  },
  {
    localId: uid(),
    name: "Shadyside",
    address: "5520 Walnut St",
    city: "Pittsburgh",
    state: "PA",
    zipCode: "15232",
    phone: "(412) 555-0202",
    isDefault: false,
    workingHours: {
      Monday:    { enabled: false, start: "10:00", end: "19:00" },
      Tuesday:   { enabled: true,  start: "10:00", end: "19:00" },
      Wednesday: { enabled: true,  start: "10:00", end: "19:00" },
      Thursday:  { enabled: true,  start: "10:00", end: "19:00" },
      Friday:    { enabled: true,  start: "10:00", end: "19:00" },
      Saturday:  { enabled: true,  start: "09:00", end: "18:00" },
      Sunday:    { enabled: true,  start: "11:00", end: "16:00" },
    },
  },
  {
    localId: uid(),
    name: "South Side",
    address: "1800 E Carson St",
    city: "Pittsburgh",
    state: "PA",
    zipCode: "15203",
    phone: "(412) 555-0303",
    isDefault: false,
    workingHours: {
      Monday:    { enabled: true,  start: "11:00", end: "20:00" },
      Tuesday:   { enabled: true,  start: "11:00", end: "20:00" },
      Wednesday: { enabled: true,  start: "11:00", end: "20:00" },
      Thursday:  { enabled: true,  start: "11:00", end: "21:00" },
      Friday:    { enabled: true,  start: "11:00", end: "21:00" },
      Saturday:  { enabled: true,  start: "10:00", end: "20:00" },
      Sunday:    { enabled: true,  start: "12:00", end: "18:00" },
    },
  },
];

const STAFF_DATA = [
  { name: "Sofia Martinez",   role: "Senior Stylist",   color: "#E91E63", phone: "(412) 555-1001" },
  { name: "James Wilson",     role: "Hair Colorist",    color: "#9C27B0", phone: "(412) 555-1002" },
  { name: "Aisha Johnson",    role: "Nail Technician",  color: "#FF5722", phone: "(412) 555-1003" },
  { name: "Carlos Rivera",    role: "Massage Therapist",color: "#FF9800", phone: "(412) 555-1004" },
  { name: "Emily Chen",       role: "Esthetician",      color: "#00BCD4", phone: "(412) 555-1005" },
  { name: "Marcus Thompson",  role: "Barber",           color: "#4CAF50", phone: "(412) 555-1006" },
  { name: "Rachel Kim",       role: "Nail Technician",  color: "#F44336", phone: "(412) 555-1007" },
  { name: "David Nguyen",     role: "Stylist",          color: "#2196F3", phone: "(412) 555-1008" },
  { name: "Priya Patel",      role: "Esthetician",      color: "#795548", phone: "(412) 555-1009" },
  { name: "Tyler Brooks",     role: "Massage Therapist",color: "#607D8B", phone: "(412) 555-1010" },
  { name: "Natalie Scott",    role: "Senior Stylist",   color: "#8BC34A", phone: "(412) 555-1011" },
  { name: "Omar Hassan",      role: "Barber",           color: "#FFC107", phone: "(412) 555-1012" },
];

const APPT_STATUSES = ["confirmed", "confirmed", "confirmed", "completed", "completed", "cancelled", "pending"] as const;
const PAST_STATUSES = ["completed", "completed", "completed", "cancelled"] as const;
const FUTURE_STATUSES = ["confirmed", "confirmed", "pending"] as const;

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  const conn = await mysql.createConnection(DB_URL);
  console.log("Connected to DB");

  // ── 1. Clear existing demo data (keep users table) ──────────────────────
  console.log("Clearing existing data...");
  await conn.execute("SET FOREIGN_KEY_CHECKS = 0");
  for (const tbl of [
    "appointments","clients","services","staff_members","locations",
    "custom_schedule","business_owners",
  ]) {
    await conn.execute(`DELETE FROM \`${tbl}\``);
  }
  await conn.execute("SET FOREIGN_KEY_CHECKS = 1");
  console.log("Cleared.");

  // ── 2. Create business owner ─────────────────────────────────────────────
  const [ownerResult] = await conn.execute<mysql.ResultSetHeader>(
    `INSERT INTO business_owners
       (phone, businessName, ownerName, email, address, defaultDuration, notificationsEnabled,
        themeMode, temporaryClosed, scheduleMode, workingHours, bufferTime, slotInterval,
        autoCompleteEnabled, autoCompleteDelayMinutes, onboardingComplete)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "4124827733",
      "Lime Of Time",
      "Murodjon Azimov",
      "owner@lime-of-time.com",
      "134 Locust Ct, Pittsburgh, PA 15237",
      30,
      true,
      "system",
      false,
      "weekly",
      JSON.stringify({
        Monday:    { enabled: true,  start: "09:00", end: "18:00" },
        Tuesday:   { enabled: true,  start: "09:00", end: "18:00" },
        Wednesday: { enabled: true,  start: "09:00", end: "18:00" },
        Thursday:  { enabled: true,  start: "09:00", end: "20:00" },
        Friday:    { enabled: true,  start: "09:00", end: "20:00" },
        Saturday:  { enabled: true,  start: "10:00", end: "17:00" },
        Sunday:    { enabled: false, start: "10:00", end: "15:00" },
      }),
      0,
      0,
      true,
      5,
      true,
    ]
  );
  const ownerId = ownerResult.insertId;
  console.log(`Created business owner id=${ownerId}`);

  // ── 3. Create services ───────────────────────────────────────────────────
  for (const svc of SERVICES) {
    await conn.execute(
      `INSERT INTO services (businessOwnerId, localId, name, duration, price, color, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ownerId, svc.localId, svc.name, svc.duration, svc.price, svc.color, svc.category]
    );
  }
  console.log(`Created ${SERVICES.length} services`);

  // ── 4. Create locations ──────────────────────────────────────────────────
  const locationLocalIds: string[] = [];
  for (const loc of LOCATIONS_DATA) {
    await conn.execute(
      `INSERT INTO locations
         (businessOwnerId, localId, name, address, city, state, zipCode, phone, isDefault, active, workingHours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId, loc.localId, loc.name, loc.address, loc.city, loc.state,
        loc.zipCode, loc.phone, loc.isDefault ? 1 : 0, 1,
        JSON.stringify(loc.workingHours),
      ]
    );
    locationLocalIds.push(loc.localId);
  }
  console.log(`Created ${LOCATIONS_DATA.length} locations`);

  // ── 5. Create staff members ──────────────────────────────────────────────
  const staffLocalIds: string[] = [];
  const serviceLocalIds = SERVICES.map((s) => s.localId);
  for (let i = 0; i < STAFF_DATA.length; i++) {
    const s = STAFF_DATA[i];
    const localId = uid();
    staffLocalIds.push(localId);
    // Assign each staff to 1-3 locations
    const numLocs = rand(1, 3);
    const assignedLocs: string[] = [];
    const shuffled = [...locationLocalIds].sort(() => Math.random() - 0.5);
    for (let j = 0; j < numLocs; j++) assignedLocs.push(shuffled[j]);
    // Assign 3-6 services
    const numSvcs = rand(3, 6);
    const assignedSvcs = [...serviceLocalIds].sort(() => Math.random() - 0.5).slice(0, numSvcs);
    const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    const wh: Record<string, { enabled: boolean; start: string; end: string }> = {};
    days.forEach((d) => {
      const enabled = Math.random() > 0.2;
      wh[d] = { enabled, start: "09:00", end: "18:00" };
    });
    await conn.execute(
      `INSERT INTO staff_members
         (businessOwnerId, localId, name, phone, role, color, serviceIds, locationIds, workingHours, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId, localId, s.name, s.phone, s.role, s.color,
        JSON.stringify(assignedSvcs),
        JSON.stringify(assignedLocs),
        JSON.stringify(wh),
        1,
      ]
    );
  }
  console.log(`Created ${STAFF_DATA.length} staff members`);

  // ── 6. Create 200 clients ────────────────────────────────────────────────
  const clientLocalIds: string[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < 200; i++) {
    let fullName: string;
    do {
      fullName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    } while (usedNames.has(fullName));
    usedNames.add(fullName);
    const localId = uid();
    clientLocalIds.push(localId);
    const areaCode = pick(["412","724","878","814"]);
    const phone = `(${areaCode}) ${rand(200,999)}-${rand(1000,9999)}`;
    const emailFirst = fullName.split(" ")[0].toLowerCase();
    const emailLast = fullName.split(" ")[1].toLowerCase();
    const email = `${emailFirst}.${emailLast}${rand(10,99)}@${pick(["gmail.com","yahoo.com","outlook.com","icloud.com"])}`;
    await conn.execute(
      `INSERT INTO clients (businessOwnerId, localId, name, phone, email)
       VALUES (?, ?, ?, ?, ?)`,
      [ownerId, localId, fullName, phone, email]
    );
  }
  console.log(`Created 200 clients`);

  // ── 7. Create ~1000 appointments ─────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Date range: 35 days ago to 14 days ahead
  const startDate = addDays(today, -35);
  const endDate = addDays(today, 14);

  // Working time slots: 9:00 to 19:00, every 30 min
  const timeSlots: string[] = [];
  for (let h = 9; h < 19; h++) {
    for (const m of [0, 30]) {
      timeSlots.push(timeStr(h, m));
    }
  }

  let apptCount = 0;
  const apptLocalIds = new Set<string>();

  // Spread appointments across the date range
  // ~20 appointments per day on average = ~1000 total over 50 days
  let d = new Date(startDate);
  while (d <= endDate) {
    const ds = dateStr(d);
    const isPast = d < today;
    const isToday = ds === dateStr(today);
    const numAppts = rand(12, 28); // varied per day

    // Pick a random subset of time slots for this day
    const shuffledSlots = [...timeSlots].sort(() => Math.random() - 0.5).slice(0, numAppts);

    for (const slot of shuffledSlots) {
      const svc = pick(SERVICES);
      const clientId = pick(clientLocalIds);
      const locationId = pick(locationLocalIds);
      const staffId = pick(staffLocalIds);
      let status: string;
      if (isPast) {
        status = pick(PAST_STATUSES);
      } else if (isToday) {
        status = pick(APPT_STATUSES);
      } else {
        status = pick(FUTURE_STATUSES);
      }
      const price = (parseFloat(svc.price) * (0.9 + Math.random() * 0.2)).toFixed(2);
      let localId: string;
      do { localId = uid(); } while (apptLocalIds.has(localId));
      apptLocalIds.add(localId);

      await conn.execute(
        `INSERT INTO appointments
           (businessOwnerId, localId, serviceLocalId, clientLocalId, date, time, duration, status, totalPrice, locationId, staffId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ownerId, localId, svc.localId, clientId, ds, slot, svc.duration, status, price, locationId, staffId]
      );
      apptCount++;
    }
    d = addDays(d, 1);
  }
  console.log(`Created ${apptCount} appointments`);

  await conn.end();
  console.log("Done! Seed complete.");
  console.log(`Summary:
  - Business owner ID: ${ownerId}
  - Phone: 4124827733
  - Services: ${SERVICES.length}
  - Locations: ${LOCATIONS_DATA.length}
  - Staff: ${STAFF_DATA.length}
  - Clients: 200
  - Appointments: ${apptCount}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
