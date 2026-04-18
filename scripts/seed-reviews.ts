/**
 * Lime Of Time - Reviews Seed Script
 * Seeds 658 realistic client reviews linked to completed appointments
 * Run: npx tsx scripts/seed-reviews.ts
 */
import "../scripts/load-env.js";
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";

const DB_URL = process.env.DATABASE_URL!;
if (!DB_URL) throw new Error("DATABASE_URL not set");

const uid = () => randomUUID().replace(/-/g, "").slice(0, 24);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Realistic review comments by rating
const REVIEWS_5 = [
  "Absolutely amazing experience! The staff was so professional and attentive. My hair has never looked better!",
  "Best salon in Pittsburgh hands down. I've been coming here for 2 years and never disappointed.",
  "The balayage turned out exactly how I wanted. Will definitely be back!",
  "Such a relaxing atmosphere. The massage was incredible — I fell asleep halfway through!",
  "My nails look gorgeous. The gel manicure lasted over 3 weeks without chipping.",
  "Wonderful experience from start to finish. The team really listens to what you want.",
  "I've tried many salons but Lime Of Time is on another level. Highly recommend!",
  "The facial was so relaxing and my skin glowed for days afterward. 10/10!",
  "Incredibly talented stylists. My color came out perfect — exactly what I showed them.",
  "The lash extensions are stunning. I get compliments everywhere I go!",
  "Super clean, professional, and friendly. The best pedicure I've ever had.",
  "I came in feeling stressed and left feeling like a new person. Thank you!",
  "The highlights are exactly what I wanted. Natural, beautiful, and perfectly blended.",
  "Amazing service! My brows have never looked this good. I'm obsessed!",
  "The deep tissue massage worked out all my knots. I feel so much better.",
  "Loved every minute of my visit. The staff made me feel so welcome.",
  "My skin looks incredible after the HydraFacial. Worth every penny!",
  "The wax was quick, efficient, and practically painless. Impressive!",
  "Best keratin treatment I've ever had. My hair is so smooth and frizz-free!",
  "I brought my daughter for her first haircut and the stylist was so patient and sweet.",
  "The bridal makeup was absolutely perfect. I felt like a queen on my wedding day!",
  "Exceptional quality and attention to detail. My go-to salon from now on.",
  "The hot stone massage was heavenly. I was completely melted by the end.",
  "My acrylic nails look so natural and beautiful. The nail tech is incredibly talented.",
  "Great prices for the quality of service. I always leave feeling amazing.",
  "The staff remembered my preferences from last time. Such a personal touch!",
  "Incredible atmosphere and even better results. I recommend Lime Of Time to everyone.",
  "The chemical peel really transformed my skin. Smooth, bright, and glowing!",
  "I love how they always make sure you're comfortable throughout the service.",
  "The spray tan looks so natural — not orange at all! Perfect for my vacation.",
];

const REVIEWS_4 = [
  "Really great experience overall. My hair looks beautiful, just slightly different than the photo I showed.",
  "Very professional and friendly staff. The wait was a bit long but worth it.",
  "Loved my facial! My skin feels so refreshed. Will definitely come back.",
  "Great service and lovely atmosphere. The massage was very relaxing.",
  "My nails look great! Just wish the appointment ran a little more on time.",
  "Really happy with my haircut. The stylist gave great suggestions.",
  "Nice salon with skilled staff. The color is beautiful, just a shade lighter than expected.",
  "Very clean and welcoming space. The pedicure was lovely and relaxing.",
  "Good experience overall. The lash fill was done well and looks natural.",
  "Enjoyed my visit. The brow lamination looks great, just took a bit longer than expected.",
  "Really skilled nail tech. My gel mani looks perfect. Will be back for sure!",
  "Lovely experience. The deep conditioning treatment made my hair so soft.",
  "Great massage — very skilled therapist. Felt much better afterward.",
  "Happy with my highlights! They look natural and blend well with my base color.",
  "Nice place, professional staff. The waxing was quick and the results are great.",
  "Really enjoyed my appointment. The stylist was friendly and did a great job.",
  "Good facial, my skin feels much cleaner and smoother. Will try the anti-aging one next.",
  "Very happy with my blowout — lasted all weekend! Great technique.",
  "Solid service and fair pricing. My acrylic fill looks clean and neat.",
  "Enjoyed the body scrub. My skin is so soft. The room could have been a bit warmer.",
];

const REVIEWS_3 = [
  "Decent experience. The service was good but the salon was quite busy and felt a bit rushed.",
  "My haircut is okay but not exactly what I asked for. Might try a different stylist next time.",
  "The massage was relaxing but shorter than expected for the price.",
  "Nice place but parking was difficult. The service itself was fine.",
  "Average experience. The nail polish chipped after a week which was disappointing.",
  "The facial was good but I expected more extractions for the price.",
  "Service was fine, nothing extraordinary. The staff was friendly though.",
  "My color came out a bit darker than I wanted but it still looks nice.",
  "Okay experience. The salon is clean and the staff is professional.",
  "The wax was done well but I had to wait 20 minutes past my appointment time.",
];

const REVIEWS_2 = [
  "Disappointed with my visit. The color is not what I asked for and the stylist seemed distracted.",
  "The service was okay but I felt rushed. For the price I expected more attention to detail.",
  "My lash extensions started falling off after just 5 days. Expected better longevity.",
  "The massage was too light — I specifically asked for deep tissue. Won't be back.",
  "Not happy with my haircut. It's uneven and not what I showed in the photo.",
];

const REVIEWS_1 = [
  "Very disappointed. My appointment was rescheduled twice and the final result was not what I wanted at all.",
  "The color completely damaged my hair. I had to go to another salon to fix it.",
  "Worst experience I've had at a salon. The stylist was rude and dismissive.",
];

// Rating distribution: 5★ ~45%, 4★ ~30%, 3★ ~15%, 2★ ~7%, 1★ ~3%
function getWeightedRating(): number {
  const r = rand(1, 100);
  if (r <= 45) return 5;
  if (r <= 75) return 4;
  if (r <= 90) return 3;
  if (r <= 97) return 2;
  return 1;
}

function getComment(rating: number): string | null {
  // ~85% of reviews have a comment
  if (rand(1, 100) > 85) return null;
  switch (rating) {
    case 5: return pick(REVIEWS_5);
    case 4: return pick(REVIEWS_4);
    case 3: return pick(REVIEWS_3);
    case 2: return pick(REVIEWS_2);
    case 1: return pick(REVIEWS_1);
    default: return null;
  }
}

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  console.log("Connected to DB");

  // Get business owner
  const [ownerRows] = await conn.query("SELECT id FROM business_owners LIMIT 1") as any;
  const ownerId = ownerRows[0].id;
  console.log("Business owner ID:", ownerId);

  // Get completed appointments (these are the ones that can have reviews)
  const [apptRows] = await conn.query(
    `SELECT localId, clientLocalId FROM appointments 
     WHERE businessOwnerId = ? AND status = 'completed' 
     ORDER BY RAND() LIMIT 800`,
    [ownerId]
  ) as any;
  console.log(`Found ${apptRows.length} completed appointments to draw from`);

  // Get all clients for fallback
  const [clientRows] = await conn.query(
    "SELECT localId FROM clients WHERE businessOwnerId = ?",
    [ownerId]
  ) as any;
  const allClientIds: string[] = clientRows.map((r: any) => r.localId);

  // Check existing reviews
  const [existingCount] = await conn.query(
    "SELECT COUNT(*) as cnt FROM reviews WHERE businessOwnerId = ?",
    [ownerId]
  ) as any;
  console.log("Existing reviews:", existingCount[0].cnt);

  // Seed 658 reviews
  const TARGET = 658;
  let inserted = 0;
  const usedApptIds = new Set<string>();

  for (let i = 0; i < TARGET; i++) {
    let apptLocalId: string | null = null;
    let clientLocalId: string;

    // Try to link to a unique completed appointment
    const availableAppts = apptRows.filter((a: any) => !usedApptIds.has(a.localId));
    if (availableAppts.length > 0) {
      const appt = pick(availableAppts);
      apptLocalId = appt.localId;
      clientLocalId = appt.clientLocalId;
      usedApptIds.add(apptLocalId);
    } else {
      // Fallback: unlinked review from a random client
      clientLocalId = pick(allClientIds);
      apptLocalId = null;
    }

    const rating = getWeightedRating();
    const comment = getComment(rating);

    // Spread reviews over the past 12 months
    const daysBack = rand(1, 365);
    const createdAt = new Date(Date.now() - daysBack * 86400000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    await conn.query(
      `INSERT INTO reviews (businessOwnerId, localId, clientLocalId, appointmentLocalId, rating, comment, createdAt) VALUES (?,?,?,?,?,?,?)`,
      [ownerId, uid(), clientLocalId, apptLocalId, rating, comment, createdAt]
    );

    inserted++;
    if (inserted % 100 === 0) process.stdout.write(`\r  Reviews: ${inserted}/${TARGET}`);
  }

  console.log(`\n✓ ${inserted} reviews inserted`);

  // Final stats
  const [totalReviews] = await conn.query(
    "SELECT COUNT(*) as cnt FROM reviews WHERE businessOwnerId = ?",
    [ownerId]
  ) as any;
  const [avgRating] = await conn.query(
    "SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE businessOwnerId = ?",
    [ownerId]
  ) as any;
  const [ratingDist] = await conn.query(
    "SELECT rating, COUNT(*) as cnt FROM reviews WHERE businessOwnerId = ? GROUP BY rating ORDER BY rating DESC",
    [ownerId]
  ) as any;

  console.log("\n✅ Reviews seeded successfully!");
  console.log(`   Total reviews : ${totalReviews[0].cnt}`);
  console.log(`   Average rating: ${parseFloat(avgRating[0].avg).toFixed(2)} ⭐`);
  console.log("   Distribution:");
  for (const row of ratingDist) {
    const stars = "⭐".repeat(row.rating);
    console.log(`     ${stars} : ${row.cnt}`);
  }

  await conn.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("\n❌ Reviews seed failed:", e.message);
  process.exit(1);
});
