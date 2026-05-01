import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
const BUSINESS_ID = 1620003;

// Parse mysql URL
function parseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port) || 3306,
    user: u.username,
    password: u.password,
    database: u.pathname.slice(1).split('?')[0],
    ssl: { rejectUnauthorized: true },
  };
}

// CDN base
const CDN = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663347678319/Dw4mhfnuurFcniLsqjLpWN';

// Staff photo map: name fragment → CDN filename
const STAFF_PHOTOS = {
  'Jessica Martinez':  `${CDN}/staff-jessica-martinez-7K7zo4zgdC2uuPWMm9HHj9.png`,
  'Brittany Thompson': `${CDN}/staff-brittany-thompson-ZDLDbdtDKKfjTodLN6SfDP.png`,
  'Ashley Johnson':    `${CDN}/staff-ashley-johnson-Vx4WvnH8XAU966dUvzNpdZ.png`,
  'Samantha Davis':    `${CDN}/staff-samantha-davis-79kSS7fk7Xcm32hTEMpF8Z.png`,
  'Rachel Wilson':     `${CDN}/staff-rachel-wilson-ei6JawDdWJBTZukHsJjbWR.png`,
  'Tiffany Brown':     `${CDN}/staff-tiffany-brown-mkAWVSDj22FYfmHU9YdSgS.png`,
  'Nicole Garcia':     `${CDN}/staff-nicole-garcia-VkmkNRrgs36XnfKDRomktr.png`,
  'Melissa Rodriguez': `${CDN}/staff-melissa-rodriguez-hJwPiA8cswWLxjRvbD66Sv.png`,
  'Amanda Lee':        `${CDN}/staff-amanda-lee-4ZAtbZtFVod7kmDVjpMHrt.png`,
  'Stephanie White':   `${CDN}/staff-stephanie-white-MAjx7sawYiXat2qsgdVBfi.png`,
  'Kimberly Harris':   `${CDN}/staff-kimberly-harris-VbnZZtMd24xdWa4TejcJFX.png`,
  'Lauren Clark':      `${CDN}/staff-lauren-clark-kWQTfYuSB9Reekt6rCcdVn.png`,
  'Crystal Lewis':     `${CDN}/staff-crystal-lewis-FkgJgRkXosJ3S44eSNaLDT.png`,
  'Danielle Walker':   `${CDN}/staff-danielle-walker-V3G9N5gB9X4c7cb5niQj9n.png`,
  'Monique Hall':      `${CDN}/staff-monique-hall-TFgc3TLQoAsMqL3qte4ybj.png`,
};

// Service photo map: service name fragment → CDN URL
const SERVICE_PHOTOS = {
  "Women's Haircut":        `${CDN}/svc-womens-haircut-2Yqcbc4vGkM9tREVnGREZw.png`,
  "Men's Haircut":          `${CDN}/svc-mens-haircut-mwX2idMS9jVGqWW8TecpfX.png`,
  "Blowout":                `${CDN}/svc-blowout-89aVA6NrsvqqxhBHXkB3jo.png`,
  "Balayage":               `${CDN}/svc-balayage-hNWHhQp2yjPAKUQWSkyr6H.png`,
  "Full Color":             `${CDN}/svc-full-color-GmqA7THAMgJBFNGLydXW5s.png`,
  "Highlights":             `${CDN}/svc-highlights-bHMqtWCbR9BV48Q8W5qhrT.png`,
  "Keratin":                `${CDN}/svc-keratin-8ERVA9eGcARAJ6M36G5nqs.png`,
  "Deep Conditioning":      `${CDN}/svc-deep-conditioning-kdzRsnVvgfrfXt97sSB3YF.png`,
  "Manicure":               `${CDN}/svc-manicure-Ao9yfVwia9iiMYNh9poaMf.png`,
  "Pedicure":               `${CDN}/svc-pedicure-BMKdWryJGPwyWnu4fjKyDf.png`,
  "Gel Nails":              `${CDN}/svc-gel-nails-6cdV24g5XQ9DU7pGyHq5Aj.png`,
  "Acrylic":                `${CDN}/svc-acrylic-nails-2rSLmirUK7tYgnKDDcrD7o.png`,
  "Nail Art":               `${CDN}/svc-nail-art-meqHfmEJCmZPPaQCjdLmZy.png`,
  "Facial":                 `${CDN}/svc-facial-dHY4EmHxmfCzmgDsybFqFK.png`,
  "Microdermabrasion":      `${CDN}/svc-microdermabrasion-itsjtezTBo5YcVYmN4vxuZ.png`,
  "Chemical Peel":          `${CDN}/svc-chemical-peel-QafwXnj2TyEoVkZkpxrm9B.png`,
  "LED":                    `${CDN}/svc-led-therapy-d2NrG99M7DFq3NBzrbN87f.png`,
  "Swedish Massage":        `${CDN}/svc-swedish-massage-gAXWH8p6E8w6fDB8uyMKdN.png`,
  "Deep Tissue":            `${CDN}/svc-deep-tissue-GhDkJCyB8MPT3Em7qYzUkc.png`,
  "Hot Stone":              `${CDN}/svc-hot-stone-Mgof6dsxVr7gA9MbVYtCDG.png`,
  "Prenatal":               `${CDN}/svc-prenatal-massage-CTFf8PnqSGgbVyTLFfWtEY.png`,
  "Couples":                `${CDN}/svc-couples-massage-P6RTmuiL3yqwrmGuryGfZg.png`,
  "Eyebrow Wax":            `${CDN}/svc-eyebrow-wax-VuYwmb8iToXwKTFZBrG8Pn.png`,
  "Brow Tint":              `${CDN}/svc-brow-tint-2gJNkxAutHXmkAok38aRSE.png`,
  "Lash Lift":              `${CDN}/svc-lash-lift-gS7ZTmPKN53FRVjbxcEGSB.png`,
  "Lash Extension":         `${CDN}/svc-lash-extensions-KXNvsZvuGCrTnHJbTdeKsa.png`,
  "Brow Lamination":        `${CDN}/svc-brow-lamination-gD6HJWFpGh5RJgsRj6EXtC.png`,
  "Full Leg Wax":           `${CDN}/svc-full-leg-wax-JNg7KgWdNkpfw2enfuAoYA.png`,
  "Brazilian":              `${CDN}/svc-brazilian-wax-iSiSzLfKQd2kEfrB7i2H4P.png`,
  "Aromatherapy":           `${CDN}/svc-aromatherapy-KEgDuoN7agQbarYEQ6k2CW.png`,
  // Fallback for remaining services — use category-appropriate images
  "Scalp":                  `${CDN}/svc-deep-conditioning-kdzRsnVvgfrfXt97sSB3YF.png`,
  "Ombre":                  `${CDN}/svc-balayage-hNWHhQp2yjPAKUQWSkyr6H.png`,
  "Color Correction":       `${CDN}/svc-full-color-GmqA7THAMgJBFNGLydXW5s.png`,
  "Trim":                   `${CDN}/svc-womens-haircut-2Yqcbc4vGkM9tREVnGREZw.png`,
  "Updo":                   `${CDN}/svc-blowout-89aVA6NrsvqqxhBHXkB3jo.png`,
  "Gloss":                  `${CDN}/svc-highlights-bHMqtWCbR9BV48Q8W5qhrT.png`,
  "Spa Manicure":           `${CDN}/svc-manicure-Ao9yfVwia9iiMYNh9poaMf.png`,
  "Spa Pedicure":           `${CDN}/svc-pedicure-BMKdWryJGPwyWnu4fjKyDf.png`,
  "Dip Powder":             `${CDN}/svc-gel-nails-6cdV24g5XQ9DU7pGyHq5Aj.png`,
  "Hydrafacial":            `${CDN}/svc-facial-dHY4EmHxmfCzmgDsybFqFK.png`,
  "Dermaplaning":           `${CDN}/svc-microdermabrasion-itsjtezTBo5YcVYmN4vxuZ.png`,
  "Sports Massage":         `${CDN}/svc-deep-tissue-GhDkJCyB8MPT3Em7qYzUkc.png`,
  "Reflexology":            `${CDN}/svc-swedish-massage-gAXWH8p6E8w6fDB8uyMKdN.png`,
  "Underarm Wax":           `${CDN}/svc-eyebrow-wax-VuYwmb8iToXwKTFZBrG8Pn.png`,
  "Bikini Wax":             `${CDN}/svc-full-leg-wax-JNg7KgWdNkpfw2enfuAoYA.png`,
  "Back Wax":               `${CDN}/svc-full-leg-wax-JNg7KgWdNkpfw2enfuAoYA.png`,
};

async function run() {
  const conn = await mysql.createConnection(parseUrl(DB_URL));
  console.log('Connected');

  // --- Update staff photos ---
  const [staffRows] = await conn.execute(
    'SELECT id, name FROM staff_members WHERE businessOwnerId = ?',
    [BUSINESS_ID]
  );
  console.log(`Found ${staffRows.length} staff members`);
  let staffUpdated = 0;
  for (const staff of staffRows) {
    const photoUrl = STAFF_PHOTOS[staff.name];
    if (photoUrl) {
      await conn.execute(
        'UPDATE staff_members SET photoUri = ? WHERE id = ?',
        [photoUrl, staff.id]
      );
      staffUpdated++;
    }
  }
  console.log(`✓ Updated ${staffUpdated} staff photos`);

  // --- Update service photos ---
  const [serviceRows] = await conn.execute(
    'SELECT id, name FROM services WHERE businessOwnerId = ?',
    [BUSINESS_ID]
  );
  console.log(`Found ${serviceRows.length} services`);
  let svcUpdated = 0;
  for (const svc of serviceRows) {
    // Find best matching photo key
    let photoUrl = null;
    for (const [key, url] of Object.entries(SERVICE_PHOTOS)) {
      if (svc.name.toLowerCase().includes(key.toLowerCase())) {
        photoUrl = url;
        break;
      }
    }
    if (photoUrl) {
      await conn.execute(
        'UPDATE services SET photoUri = ? WHERE id = ?',
        [photoUrl, svc.id]
      );
      svcUpdated++;
    }
  }
  console.log(`✓ Updated ${svcUpdated} service photos`);

  await conn.end();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
