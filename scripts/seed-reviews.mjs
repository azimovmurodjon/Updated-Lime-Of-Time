import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("./load-env.js");
const mysql = require("mysql2/promise");

const OWNER_ID = 840001;

const COMMENTS_BY_RATING = {
  5: [
    "Absolutely amazing experience! Will definitely come back.",
    "Best service I've ever had. Highly recommend!",
    "Exceeded all my expectations. Five stars all the way!",
    "Incredible attention to detail. My favorite place.",
    "Professional, friendly, and talented. Love it here!",
    "Always leave feeling like a million bucks. Thank you!",
    "The staff is so welcoming and the results are perfect.",
    "Outstanding quality. Worth every penny.",
    "I've been coming here for years and it never disappoints.",
    "Top-notch service from start to finish. Truly exceptional.",
    "My go-to place. Never going anywhere else!",
    "Fantastic experience every single time.",
    "So happy with the results. Exactly what I wanted.",
    "The team here is incredibly skilled and professional.",
    "Wonderful atmosphere and amazing service. 10/10!",
    "Couldn't be happier. This place is the best!",
    "Always a pleasure. The staff really cares about you.",
    "Perfect from beginning to end. Highly recommended!",
    "I love this place so much. The results speak for themselves.",
    "Exceptional service and a relaxing environment.",
  ],
  4: [
    "Really great experience overall. Just a tiny wait but worth it.",
    "Very happy with the results. Will come back for sure.",
    "Great service and friendly staff. Highly recommend.",
    "Loved it! Just a small scheduling hiccup but overall excellent.",
    "Very professional and skilled. Almost perfect!",
    "Great quality and good value. Will return.",
    "Really enjoyed my visit. The staff was very attentive.",
    "Excellent work! Minor room for improvement but very satisfied.",
    "Wonderful experience. The team is very talented.",
    "Very pleased with the outcome. Will definitely book again.",
    "Good service and a nice atmosphere. Happy customer!",
    "Great job overall. A few small things could be better.",
    "Very satisfied with my visit. Professional and friendly.",
    "Loved the experience. Just a slight wait time.",
    "Really good service. The staff is knowledgeable and kind.",
  ],
  3: [
    "Decent experience. Some things could be improved.",
    "Average service. Not bad but not exceptional either.",
    "It was okay. Expected a bit more based on the reviews.",
    "The service was fine but the wait was longer than expected.",
    "Mixed feelings. Some parts were great, others not so much.",
    "Okay experience. Might give it another try.",
    "Not bad but there's room for improvement.",
    "The quality was decent but the experience felt rushed.",
    "It was alright. I've had better elsewhere.",
    "Satisfactory but nothing that really stood out.",
  ],
  2: [
    "Disappointed with the results. Expected better.",
    "The service was below my expectations.",
    "Not great. Had some issues that weren't addressed.",
    "Wouldn't rush back. The quality wasn't up to par.",
    "Felt like my concerns weren't taken seriously.",
    "The experience was underwhelming. Needs improvement.",
    "Not what I was hoping for. Will try elsewhere next time.",
  ],
  1: [
    "Very unhappy with my experience. Will not return.",
    "The service was poor and the staff seemed uninterested.",
    "Completely disappointed. Not worth the price.",
    "Had a terrible experience. Would not recommend.",
    "The worst service I've had. Very unprofessional.",
  ],
};

// Rating distribution: 5★ ~40%, 4★ ~35%, 3★ ~15%, 2★ ~7%, 1★ ~3%
const RATING_POOL = [
  ...Array(40).fill(5),
  ...Array(35).fill(4),
  ...Array(15).fill(3),
  ...Array(7).fill(2),
  ...Array(3).fill(1),
];

function randomRating() {
  return RATING_POOL[Math.floor(Math.random() * RATING_POOL.length)];
}

function randomComment(rating) {
  const pool = COMMENTS_BY_RATING[rating];
  // 80% chance of leaving a comment
  if (Math.random() < 0.8) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}

function randomDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d.toISOString().replace("T", " ").substring(0, 19);
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("Connected to DB");

  // Get all clients for this owner
  const [clients] = await conn.execute(
    "SELECT localId FROM clients WHERE businessOwnerId = ? LIMIT 500",
    [OWNER_ID]
  );
  console.log(`Found ${clients.length} clients`);

  if (clients.length === 0) {
    console.error("No clients found. Run seed-bulk.mjs first.");
    await conn.end();
    return;
  }

  // Get existing review count
  const [[{ count: existingCount }]] = await conn.execute(
    "SELECT COUNT(*) as count FROM reviews WHERE businessOwnerId = ?",
    [OWNER_ID]
  );
  console.log(`Existing reviews: ${existingCount}`);

  const TARGET = 1200;
  const toInsert = Math.max(0, TARGET - existingCount);
  console.log(`Inserting ${toInsert} new reviews...`);

  if (toInsert === 0) {
    console.log("Already have enough reviews!");
    await conn.end();
    return;
  }

  const BATCH_SIZE = 100;
  let inserted = 0;
  let localIdCounter = existingCount + 1;

  while (inserted < toInsert) {
    const batch = [];
    const batchSize = Math.min(BATCH_SIZE, toInsert - inserted);

    for (let i = 0; i < batchSize; i++) {
      const client = clients[Math.floor(Math.random() * clients.length)];
      const rating = randomRating();
      const comment = randomComment(rating);
      const createdAt = randomDate(365); // within last year
      const localId = `review-seed-${localIdCounter++}`;

      batch.push([
        OWNER_ID,
        localId,
        client.localId,
        null, // appointmentLocalId
        rating,
        comment,
        createdAt,
        createdAt,
      ]);
    }

    await conn.query(
      `INSERT INTO reviews (businessOwnerId, localId, clientLocalId, appointmentLocalId, rating, comment, createdAt, updatedAt)
       VALUES ?`,
      [batch]
    );

    inserted += batchSize;
    console.log(`  Inserted ${inserted}/${toInsert}...`);
  }

  const [[{ count: finalCount }]] = await conn.execute(
    "SELECT COUNT(*) as count FROM reviews WHERE businessOwnerId = ?",
    [OWNER_ID]
  );
  console.log(`\nDone! Total reviews: ${finalCount}`);
  await conn.end();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
