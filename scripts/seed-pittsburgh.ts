/**
 * Pittsburgh Downtown Businesses Seed Script
 *
 * Creates 10 realistic Pittsburgh-area businesses, each with:
 *  - 2 locations (Downtown + neighborhood)
 *  - 5 staff members
 *  - 10 services
 *  - 10 products
 *  - 3 discounts
 *  - Professional logo photos (Unsplash)
 *
 * Run: npx tsx scripts/seed-pittsburgh.ts
 */
import "../scripts/load-env.js";
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";

const DB_URL = process.env.DATABASE_URL!;
if (!DB_URL) throw new Error("DATABASE_URL not set");

const uid = () => randomUUID().replace(/-/g, "").slice(0, 24);
const pad2 = (n: number) => String(n).padStart(2, "0");

// ─── 10 Pittsburgh Businesses ────────────────────────────────────────────────

const BUSINESSES = [
  {
    businessName: "Steel City Cuts",
    ownerName: "Marcus Thompson",
    phone: "4125550101",
    email: "marcus@steelcitycuts.com",
    description: "Premium barbershop in the heart of Pittsburgh. Expert fades, beard trims, and classic cuts since 2015.",
    businessCategory: "Barber",
    // Downtown Pittsburgh
    lat: "40.4406",
    lng: "-79.9959",
    logoUrl: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=400&fit=crop",
    locations: [
      { name: "Downtown", address: "429 Forbes Ave", city: "Pittsburgh", state: "PA", zipCode: "15219", phone: "(412) 555-0101" },
      { name: "Strip District", address: "2100 Penn Ave", city: "Pittsburgh", state: "PA", zipCode: "15222", phone: "(412) 555-0102" },
    ],
    staff: [
      { name: "Marcus Thompson", role: "Master Barber", color: "#1A1A2E" },
      { name: "Darius Williams", role: "Senior Barber", color: "#16213E" },
      { name: "Jamal Carter", role: "Barber", color: "#0F3460" },
      { name: "Tyrese Brown", role: "Barber", color: "#533483" },
      { name: "Kevin Mitchell", role: "Junior Barber", color: "#E94560" },
    ],
    services: [
      { name: "Classic Haircut", duration: 30, price: "35.00", color: "#1A1A2E", category: "Barber" },
      { name: "Fade & Style", duration: 45, price: "45.00", color: "#16213E", category: "Barber" },
      { name: "Beard Trim", duration: 20, price: "20.00", color: "#0F3460", category: "Barber" },
      { name: "Hot Towel Shave", duration: 30, price: "40.00", color: "#533483", category: "Barber" },
      { name: "Haircut + Beard", duration: 50, price: "55.00", color: "#E94560", category: "Barber" },
      { name: "Kids Cut (12 & under)", duration: 25, price: "25.00", color: "#1A1A2E", category: "Barber" },
      { name: "Line Up", duration: 15, price: "15.00", color: "#16213E", category: "Barber" },
      { name: "Scalp Treatment", duration: 20, price: "25.00", color: "#0F3460", category: "Barber" },
      { name: "Eyebrow Shaping", duration: 15, price: "12.00", color: "#533483", category: "Barber" },
      { name: "Full Grooming Package", duration: 75, price: "85.00", color: "#E94560", category: "Barber" },
    ],
    products: [
      { name: "Pomade (2oz)", price: "18.00", brand: "Suavecito", description: "Medium hold pomade" },
      { name: "Beard Oil", price: "22.00", brand: "Beardbrand", description: "Conditioning beard oil" },
      { name: "Shaving Cream", price: "15.00", brand: "Proraso", description: "Classic shaving cream" },
      { name: "Hair Clippers", price: "65.00", brand: "Wahl", description: "Professional grade clippers" },
      { name: "Aftershave Balm", price: "20.00", brand: "Nivea Men", description: "Soothing aftershave" },
      { name: "Styling Gel", price: "12.00", brand: "Got2b", description: "Strong hold gel" },
      { name: "Beard Balm", price: "24.00", brand: "Honest Amish", description: "Leave-in conditioner" },
      { name: "Razor Set", price: "35.00", brand: "Merkur", description: "Safety razor starter set" },
      { name: "Hair Tonic", price: "28.00", brand: "American Crew", description: "Classic hair tonic" },
      { name: "Barber Cape", price: "30.00", brand: "Fromm", description: "Professional barber cape" },
    ],
    discounts: [
      { name: "Happy Hour", percentage: 15, startTime: "14:00", endTime: "16:00" },
      { name: "Senior Discount", percentage: 20, startTime: "09:00", endTime: "12:00" },
      { name: "Student Special", percentage: 10, startTime: "10:00", endTime: "18:00" },
    ],
  },
  {
    businessName: "Luxe Nail Lounge",
    ownerName: "Jennifer Park",
    phone: "4125550201",
    email: "jennifer@luxenaillounge.com",
    description: "Upscale nail salon offering gel, acrylic, and natural nail services. Walk-ins welcome.",
    businessCategory: "Nails",
    lat: "40.4416",
    lng: "-79.9989",
    logoUrl: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=400&fit=crop",
    locations: [
      { name: "Downtown", address: "600 Smithfield St", city: "Pittsburgh", state: "PA", zipCode: "15222", phone: "(412) 555-0201" },
      { name: "Shadyside", address: "5530 Walnut St", city: "Pittsburgh", state: "PA", zipCode: "15232", phone: "(412) 555-0202" },
    ],
    staff: [
      { name: "Jennifer Park", role: "Lead Nail Tech", color: "#FF6B9D" },
      { name: "Mia Nguyen", role: "Senior Nail Tech", color: "#C44569" },
      { name: "Lily Chen", role: "Nail Technician", color: "#F8A5C2" },
      { name: "Sofia Reyes", role: "Nail Technician", color: "#E84393" },
      { name: "Tina Brooks", role: "Junior Nail Tech", color: "#FD79A8" },
    ],
    services: [
      { name: "Classic Manicure", duration: 30, price: "28.00", color: "#FF6B9D", category: "Nails" },
      { name: "Gel Manicure", duration: 45, price: "45.00", color: "#C44569", category: "Nails" },
      { name: "Acrylic Full Set", duration: 75, price: "65.00", color: "#F8A5C2", category: "Nails" },
      { name: "Acrylic Fill", duration: 45, price: "40.00", color: "#E84393", category: "Nails" },
      { name: "Classic Pedicure", duration: 45, price: "38.00", color: "#FD79A8", category: "Nails" },
      { name: "Spa Pedicure", duration: 60, price: "55.00", color: "#FF6B9D", category: "Nails" },
      { name: "Gel Pedicure", duration: 60, price: "60.00", color: "#C44569", category: "Nails" },
      { name: "Nail Art (per nail)", duration: 10, price: "5.00", color: "#F8A5C2", category: "Nails" },
      { name: "Mani + Pedi Combo", duration: 90, price: "75.00", color: "#E84393", category: "Nails" },
      { name: "Dip Powder Manicure", duration: 60, price: "55.00", color: "#FD79A8", category: "Nails" },
    ],
    products: [
      { name: "OPI Nail Polish", price: "12.00", brand: "OPI", description: "Long-lasting nail color" },
      { name: "Cuticle Oil", price: "10.00", brand: "CND", description: "Nourishing cuticle treatment" },
      { name: "Nail Strengthener", price: "14.00", brand: "Essie", description: "Fortifying base coat" },
      { name: "Gel Top Coat", price: "18.00", brand: "Gelish", description: "High-shine gel top coat" },
      { name: "Nail File Set", price: "8.00", brand: "Revlon", description: "Professional nail files" },
      { name: "Hand Cream", price: "16.00", brand: "L'Occitane", description: "Shea butter hand cream" },
      { name: "Foot Scrub", price: "20.00", brand: "Burt's Bees", description: "Exfoliating foot scrub" },
      { name: "Nail Glue", price: "6.00", brand: "Kiss", description: "Professional nail adhesive" },
      { name: "Acrylic Powder", price: "25.00", brand: "Young Nails", description: "Professional acrylic powder" },
      { name: "UV Lamp", price: "45.00", brand: "MelodySusie", description: "36W UV/LED nail lamp" },
    ],
    discounts: [
      { name: "Mani-Pedi Monday", percentage: 20, startTime: "10:00", endTime: "14:00" },
      { name: "Loyalty Reward", percentage: 15, startTime: "09:00", endTime: "20:00" },
      { name: "Birthday Month", percentage: 25, startTime: "09:00", endTime: "20:00" },
    ],
  },
  {
    businessName: "Glow Skin Studio",
    ownerName: "Rachel Kim",
    phone: "4125550301",
    email: "rachel@glowskinstudio.com",
    description: "Medical-grade facials, chemical peels, and advanced skincare treatments by licensed estheticians.",
    businessCategory: "Skin",
    lat: "40.4430",
    lng: "-79.9940",
    logoUrl: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=400&fit=crop",
    locations: [
      { name: "Cultural District", address: "711 Penn Ave", city: "Pittsburgh", state: "PA", zipCode: "15222", phone: "(412) 555-0301" },
      { name: "Squirrel Hill", address: "2114 Murray Ave", city: "Pittsburgh", state: "PA", zipCode: "15217", phone: "(412) 555-0302" },
    ],
    staff: [
      { name: "Rachel Kim", role: "Lead Esthetician", color: "#A29BFE" },
      { name: "Priya Patel", role: "Senior Esthetician", color: "#6C5CE7" },
      { name: "Emma Walsh", role: "Esthetician", color: "#FD79A8" },
      { name: "Olivia Grant", role: "Esthetician", color: "#FDCB6E" },
      { name: "Natalie Scott", role: "Junior Esthetician", color: "#00CEC9" },
    ],
    services: [
      { name: "Classic Facial", duration: 60, price: "85.00", color: "#A29BFE", category: "Skin" },
      { name: "Deep Cleansing Facial", duration: 75, price: "105.00", color: "#6C5CE7", category: "Skin" },
      { name: "Chemical Peel", duration: 45, price: "120.00", color: "#FD79A8", category: "Skin" },
      { name: "Microdermabrasion", duration: 60, price: "130.00", color: "#FDCB6E", category: "Skin" },
      { name: "HydraFacial", duration: 60, price: "150.00", color: "#00CEC9", category: "Skin" },
      { name: "LED Light Therapy", duration: 30, price: "65.00", color: "#A29BFE", category: "Skin" },
      { name: "Dermaplaning", duration: 45, price: "#95.00", color: "#6C5CE7", category: "Skin" },
      { name: "Acne Treatment Facial", duration: 60, price: "95.00", color: "#FD79A8", category: "Skin" },
      { name: "Anti-Aging Facial", duration: 75, price: "125.00", color: "#FDCB6E", category: "Skin" },
      { name: "Eye Treatment", duration: 30, price: "55.00", color: "#00CEC9", category: "Skin" },
    ],
    products: [
      { name: "Vitamin C Serum", price: "65.00", brand: "SkinCeuticals", description: "Antioxidant serum" },
      { name: "SPF 50 Sunscreen", price: "35.00", brand: "EltaMD", description: "Broad spectrum UV protection" },
      { name: "Retinol Cream", price: "55.00", brand: "RoC", description: "Anti-aging retinol treatment" },
      { name: "Hyaluronic Acid", price: "45.00", brand: "The Ordinary", description: "Deep hydration serum" },
      { name: "Niacinamide Serum", price: "30.00", brand: "Paula's Choice", description: "Pore minimizing serum" },
      { name: "Cleansing Balm", price: "28.00", brand: "Clinique", description: "Gentle makeup remover" },
      { name: "Toner", price: "22.00", brand: "Tatcha", description: "Balancing facial toner" },
      { name: "Eye Cream", price: "48.00", brand: "Kiehl's", description: "Firming eye cream" },
      { name: "Sheet Mask Set (5pk)", price: "25.00", brand: "Dr. Jart", description: "Hydrating sheet masks" },
      { name: "Jade Roller", price: "32.00", brand: "Mount Lai", description: "Facial massage roller" },
    ],
    discounts: [
      { name: "First Visit Special", percentage: 20, startTime: "09:00", endTime: "20:00" },
      { name: "Weekday Glow", percentage: 15, startTime: "10:00", endTime: "15:00" },
      { name: "Package Deal", percentage: 10, startTime: "09:00", endTime: "20:00" },
    ],
  },
  {
    businessName: "Serenity Massage & Spa",
    ownerName: "Carlos Rivera",
    phone: "4125550401",
    email: "carlos@serenitymassage.com",
    description: "Full-service massage and spa in Pittsburgh. Swedish, deep tissue, hot stone, and couples massage.",
    businessCategory: "Massage",
    lat: "40.4395",
    lng: "-79.9975",
    logoUrl: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=400&fit=crop",
    locations: [
      { name: "Downtown", address: "330 Fourth Ave", city: "Pittsburgh", state: "PA", zipCode: "15222", phone: "(412) 555-0401" },
      { name: "Oakland", address: "3600 Forbes Ave", city: "Pittsburgh", state: "PA", zipCode: "15213", phone: "(412) 555-0402" },
    ],
    staff: [
      { name: "Carlos Rivera", role: "Lead Massage Therapist", color: "#00B894" },
      { name: "Aisha Johnson", role: "Senior Massage Therapist", color: "#00CEC9" },
      { name: "Tyler Brooks", role: "Massage Therapist", color: "#55EFC4" },
      { name: "Hannah Lee", role: "Massage Therapist", color: "#81ECEC" },
      { name: "Derrick Moore", role: "Spa Therapist", color: "#74B9FF" },
    ],
    services: [
      { name: "Swedish Massage (60 min)", duration: 60, price: "90.00", color: "#00B894", category: "Massage" },
      { name: "Swedish Massage (90 min)", duration: 90, price: "130.00", color: "#00CEC9", category: "Massage" },
      { name: "Deep Tissue (60 min)", duration: 60, price: "100.00", color: "#55EFC4", category: "Massage" },
      { name: "Deep Tissue (90 min)", duration: 90, price: "145.00", color: "#81ECEC", category: "Massage" },
      { name: "Hot Stone Massage", duration: 75, price: "120.00", color: "#74B9FF", category: "Massage" },
      { name: "Couples Massage", duration: 60, price: "180.00", color: "#00B894", category: "Massage" },
      { name: "Prenatal Massage", duration: 60, price: "#95.00", color: "#00CEC9", category: "Massage" },
      { name: "Sports Massage", duration: 60, price: "105.00", color: "#55EFC4", category: "Massage" },
      { name: "Reflexology", duration: 45, price: "75.00", color: "#81ECEC", category: "Massage" },
      { name: "Aromatherapy Add-On", duration: 15, price: "25.00", color: "#74B9FF", category: "Massage" },
    ],
    products: [
      { name: "Massage Oil (8oz)", price: "28.00", brand: "Biotone", description: "Professional massage oil" },
      { name: "Lavender Essential Oil", price: "18.00", brand: "doTERRA", description: "Pure lavender oil" },
      { name: "Hot Stone Set", price: "55.00", brand: "InSPAration", description: "Basalt massage stones" },
      { name: "Foam Roller", price: "30.00", brand: "TriggerPoint", description: "Deep tissue foam roller" },
      { name: "Epsom Salt (5lb)", price: "15.00", brand: "Dr Teal's", description: "Relaxing bath soak" },
      { name: "Muscle Rub Cream", price: "22.00", brand: "Biofreeze", description: "Pain relief cream" },
      { name: "Aromatherapy Diffuser", price: "45.00", brand: "URPOWER", description: "Ultrasonic diffuser" },
      { name: "Massage Candle", price: "35.00", brand: "Kama Sutra", description: "Warming massage candle" },
      { name: "Neck Pillow", price: "40.00", brand: "Tempur-Pedic", description: "Ergonomic neck support" },
      { name: "Relaxation Tea Set", price: "20.00", brand: "Yogi Tea", description: "Herbal relaxation teas" },
    ],
    discounts: [
      { name: "Midweek Zen", percentage: 20, startTime: "10:00", endTime: "15:00" },
      { name: "Early Bird", percentage: 15, startTime: "09:00", endTime: "11:00" },
      { name: "Couples Special", percentage: 10, startTime: "14:00", endTime: "20:00" },
    ],
  },
  {
    businessName: "Aria Hair Collective",
    ownerName: "Sofia Martinez",
    phone: "4125550501",
    email: "sofia@ariahaircollective.com",
    description: "Boutique hair salon specializing in color, balayage, and precision cuts. Aveda concept salon.",
    businessCategory: "Hair",
    lat: "40.4450",
    lng: "-79.9920",
    logoUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=400&fit=crop",
    locations: [
      { name: "North Shore", address: "1 Federal St", city: "Pittsburgh", state: "PA", zipCode: "15212", phone: "(412) 555-0501" },
      { name: "Lawrenceville", address: "4418 Butler St", city: "Pittsburgh", state: "PA", zipCode: "15201", phone: "(412) 555-0502" },
    ],
    staff: [
      { name: "Sofia Martinez", role: "Master Colorist", color: "#6D214F" },
      { name: "James Wilson", role: "Senior Stylist", color: "#B33771" },
      { name: "Emily Chen", role: "Colorist", color: "#FD7272" },
      { name: "Zoe Adams", role: "Stylist", color: "#EAB543" },
      { name: "Chloe Bennett", role: "Junior Stylist", color: "#58B19F" },
    ],
    services: [
      { name: "Women's Haircut", duration: 45, price: "65.00", color: "#6D214F", category: "Hair" },
      { name: "Men's Haircut", duration: 30, price: "45.00", color: "#B33771", category: "Hair" },
      { name: "Blowout", duration: 45, price: "55.00", color: "#FD7272", category: "Hair" },
      { name: "Balayage", duration: 180, price: "220.00", color: "#EAB543", category: "Hair" },
      { name: "Full Color", duration: 120, price: "#155.00", color: "#58B19F", category: "Hair" },
      { name: "Highlights", duration: 150, price: "175.00", color: "#6D214F", category: "Hair" },
      { name: "Gloss Treatment", duration: 30, price: "55.00", color: "#B33771", category: "Hair" },
      { name: "Keratin Treatment", duration: 120, price: "250.00", color: "#FD7272", category: "Hair" },
      { name: "Deep Conditioning", duration: 30, price: "45.00", color: "#EAB543", category: "Hair" },
      { name: "Cut + Color", duration: 150, price: "195.00", color: "#58B19F", category: "Hair" },
    ],
    products: [
      { name: "Aveda Shampoo", price: "28.00", brand: "Aveda", description: "Color-safe shampoo" },
      { name: "Aveda Conditioner", price: "30.00", brand: "Aveda", description: "Moisturizing conditioner" },
      { name: "Hair Mask", price: "35.00", brand: "Olaplex", description: "Bond-building hair mask" },
      { name: "Heat Protectant Spray", price: "22.00", brand: "Kenra", description: "Thermal protection spray" },
      { name: "Dry Shampoo", price: "18.00", brand: "Batiste", description: "Volumizing dry shampoo" },
      { name: "Hair Serum", price: "32.00", brand: "Moroccanoil", description: "Argan oil hair serum" },
      { name: "Texturizing Spray", price: "24.00", brand: "R+Co", description: "Beach wave spray" },
      { name: "Color Protect Spray", price: "26.00", brand: "Redken", description: "Color protection spray" },
      { name: "Boar Bristle Brush", price: "45.00", brand: "Mason Pearson", description: "Professional hair brush" },
      { name: "Silk Pillowcase", price: "38.00", brand: "Slip", description: "Anti-frizz silk pillowcase" },
    ],
    discounts: [
      { name: "Color Tuesday", percentage: 15, startTime: "10:00", endTime: "16:00" },
      { name: "Referral Reward", percentage: 20, startTime: "09:00", endTime: "20:00" },
      { name: "New Client Welcome", percentage: 10, startTime: "09:00", endTime: "20:00" },
    ],
  },
  {
    businessName: "Iron City Fitness",
    ownerName: "David Nguyen",
    phone: "4125550601",
    email: "david@ironcityfitness.com",
    description: "Personal training and group fitness studio. Strength, HIIT, yoga, and nutrition coaching.",
    businessCategory: "Fitness",
    lat: "40.4380",
    lng: "-80.0000",
    logoUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop",
    locations: [
      { name: "Downtown", address: "200 First Ave", city: "Pittsburgh", state: "PA", zipCode: "15222", phone: "(412) 555-0601" },
      { name: "South Side", address: "1800 E Carson St", city: "Pittsburgh", state: "PA", zipCode: "15203", phone: "(412) 555-0602" },
    ],
    staff: [
      { name: "David Nguyen", role: "Head Trainer", color: "#2C3E50" },
      { name: "Marcus Hill", role: "Strength Coach", color: "#E74C3C" },
      { name: "Jasmine Ford", role: "Yoga Instructor", color: "#3498DB" },
      { name: "Ryan Cooper", role: "HIIT Trainer", color: "#2ECC71" },
      { name: "Alicia Torres", role: "Nutrition Coach", color: "#F39C12" },
    ],
    services: [
      { name: "Personal Training (60 min)", duration: 60, price: "85.00", color: "#2C3E50", category: "Fitness" },
      { name: "Personal Training (30 min)", duration: 30, price: "50.00", color: "#E74C3C", category: "Fitness" },
      { name: "Group HIIT Class", duration: 45, price: "25.00", color: "#3498DB", category: "Fitness" },
      { name: "Yoga Session", duration: 60, price: "30.00", color: "#2ECC71", category: "Fitness" },
      { name: "Strength & Conditioning", duration: 60, price: "90.00", color: "#F39C12", category: "Fitness" },
      { name: "Nutrition Consultation", duration: 60, price: "75.00", color: "#2C3E50", category: "Fitness" },
      { name: "Body Composition Analysis", duration: 30, price: "45.00", color: "#E74C3C", category: "Fitness" },
      { name: "Flexibility & Mobility", duration: 45, price: "55.00", color: "#3498DB", category: "Fitness" },
      { name: "Boxing Fitness", duration: 60, price: "70.00", color: "#2ECC71", category: "Fitness" },
      { name: "Monthly Training Package", duration: 60, price: "320.00", color: "#F39C12", category: "Fitness" },
    ],
    products: [
      { name: "Whey Protein (2lb)", price: "45.00", brand: "Optimum Nutrition", description: "Gold standard whey" },
      { name: "Pre-Workout", price: "35.00", brand: "C4", description: "Energy & focus blend" },
      { name: "Resistance Bands Set", price: "28.00", brand: "WODFitters", description: "5-band set" },
      { name: "Gym Gloves", price: "22.00", brand: "Harbinger", description: "Padded workout gloves" },
      { name: "Shaker Bottle", price: "15.00", brand: "BlenderBottle", description: "28oz shaker cup" },
      { name: "Foam Roller", price: "30.00", brand: "TriggerPoint", description: "Grid foam roller" },
      { name: "Jump Rope", price: "18.00", brand: "Crossrope", description: "Speed jump rope" },
      { name: "Yoga Mat", price: "55.00", brand: "Manduka", description: "Pro yoga mat" },
      { name: "BCAAs (30 servings)", price: "32.00", brand: "Xtend", description: "Amino acid supplement" },
      { name: "Gym Bag", price: "65.00", brand: "Under Armour", description: "Undeniable duffle bag" },
    ],
    discounts: [
      { name: "Morning Grind", percentage: 20, startTime: "06:00", endTime: "09:00" },
      { name: "New Year New You", percentage: 25, startTime: "09:00", endTime: "20:00" },
      { name: "Student Athlete", percentage: 15, startTime: "10:00", endTime: "18:00" },
    ],
  },
  {
    businessName: "Zen Spa & Wellness",
    ownerName: "Mei Lin",
    phone: "4125550701",
    email: "mei@zenspawellness.com",
    description: "Holistic spa offering traditional Asian therapies, reflexology, and full-body wellness treatments.",
    businessCategory: "Spa",
    lat: "40.4460",
    lng: "-79.9930",
    logoUrl: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&h=400&fit=crop",
    locations: [
      { name: "Cultural District", address: "803 Liberty Ave", city: "Pittsburgh", state: "PA", zipCode: "15222", phone: "(412) 555-0701" },
      { name: "Mount Lebanon", address: "700 Washington Rd", city: "Pittsburgh", state: "PA", zipCode: "15228", phone: "(412) 555-0702" },
    ],
    staff: [
      { name: "Mei Lin", role: "Spa Director", color: "#6F1E51" },
      { name: "Yuki Tanaka", role: "Senior Therapist", color: "#1289A7" },
      { name: "Soo-Jin Park", role: "Reflexologist", color: "#C4E538" },
      { name: "Ling Zhang", role: "Wellness Therapist", color: "#F79F1F" },
      { name: "Hana Kim", role: "Therapist", color: "#A3CB38" },
    ],
    services: [
      { name: "Traditional Thai Massage", duration: 90, price: "120.00", color: "#6F1E51", category: "Spa" },
      { name: "Shiatsu Massage", duration: 60, price: "95.00", color: "#1289A7", category: "Spa" },
      { name: "Foot Reflexology", duration: 45, price: "70.00", color: "#C4E538", category: "Spa" },
      { name: "Body Scrub", duration: 60, price: "85.00", color: "#F79F1F", category: "Spa" },
      { name: "Herbal Body Wrap", duration: 75, price: "110.00", color: "#A3CB38", category: "Spa" },
      { name: "Gua Sha Facial", duration: 60, price: "#90.00", color: "#6F1E51", category: "Spa" },
      { name: "Cupping Therapy", duration: 45, price: "75.00", color: "#1289A7", category: "Spa" },
      { name: "Acupressure", duration: 60, price: "85.00", color: "#C4E538", category: "Spa" },
      { name: "Himalayan Salt Scrub", duration: 60, price: "95.00", color: "#F79F1F", category: "Spa" },
      { name: "Full Day Spa Package", duration: 240, price: "350.00", color: "#A3CB38", category: "Spa" },
    ],
    products: [
      { name: "Bamboo Massage Sticks", price: "35.00", brand: "Zen Spa", description: "Bamboo therapy tools" },
      { name: "Green Tea Face Mask", price: "22.00", brand: "Origins", description: "Purifying clay mask" },
      { name: "Gua Sha Stone", price: "28.00", brand: "Herbivore", description: "Rose quartz gua sha" },
      { name: "Jade Face Roller", price: "32.00", brand: "Mount Lai", description: "Jade facial roller" },
      { name: "Aromatherapy Candle", price: "38.00", brand: "Voluspa", description: "Bamboo & green tea" },
      { name: "Matcha Body Lotion", price: "30.00", brand: "Fresh", description: "Hydrating body lotion" },
      { name: "Herbal Tea Collection", price: "25.00", brand: "Harney & Sons", description: "Asian wellness teas" },
      { name: "Silk Eye Mask", price: "20.00", brand: "Slip", description: "Blackout sleep mask" },
      { name: "Himalayan Salt Lamp", price: "45.00", brand: "WBM", description: "Natural salt lamp" },
      { name: "Meditation Cushion", price: "55.00", brand: "Gaiam", description: "Zafu meditation cushion" },
    ],
    discounts: [
      { name: "Zen Monday", percentage: 20, startTime: "10:00", endTime: "16:00" },
      { name: "Couples Retreat", percentage: 15, startTime: "12:00", endTime: "20:00" },
      { name: "Wellness Wednesday", percentage: 10, startTime: "09:00", endTime: "20:00" },
    ],
  },
  {
    businessName: "Ink & Soul Tattoo",
    ownerName: "Alex Rivera",
    phone: "4125550801",
    email: "alex@inkandsoul.com",
    description: "Custom tattoo and piercing studio. Fine line, traditional, watercolor, and portrait specialists.",
    businessCategory: "Tattoo",
    lat: "40.4370",
    lng: "-79.9950",
    logoUrl: "https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=400&h=400&fit=crop",
    locations: [
      { name: "South Side", address: "1711 E Carson St", city: "Pittsburgh", state: "PA", zipCode: "15203", phone: "(412) 555-0801" },
      { name: "Lawrenceville", address: "3600 Butler St", city: "Pittsburgh", state: "PA", zipCode: "15201", phone: "(412) 555-0802" },
    ],
    staff: [
      { name: "Alex Rivera", role: "Lead Artist", color: "#2D3436" },
      { name: "Zara Blackwood", role: "Fine Line Specialist", color: "#636E72" },
      { name: "Kai Nakamura", role: "Traditional Artist", color: "#B2BEC3" },
      { name: "Raven Stone", role: "Watercolor Artist", color: "#DFE6E9" },
      { name: "Leo Vance", role: "Piercing Specialist", color: "#74B9FF" },
    ],
    services: [
      { name: "Small Tattoo (< 2in)", duration: 60, price: "100.00", color: "#2D3436", category: "Tattoo" },
      { name: "Medium Tattoo (2-4in)", duration: 120, price: "200.00", color: "#636E72", category: "Tattoo" },
      { name: "Large Tattoo (4-6in)", duration: 180, price: "350.00", color: "#B2BEC3", category: "Tattoo" },
      { name: "Full Sleeve Consult", duration: 60, price: "50.00", color: "#DFE6E9", category: "Tattoo" },
      { name: "Cover-Up Tattoo", duration: 180, price: "400.00", color: "#74B9FF", category: "Tattoo" },
      { name: "Fine Line Tattoo", duration: 90, price: "175.00", color: "#2D3436", category: "Tattoo" },
      { name: "Watercolor Tattoo", duration: 120, price: "250.00", color: "#636E72", category: "Tattoo" },
      { name: "Ear Piercing", duration: 20, price: "45.00", color: "#B2BEC3", category: "Tattoo" },
      { name: "Nose Piercing", duration: 20, price: "50.00", color: "#DFE6E9", category: "Tattoo" },
      { name: "Touch-Up Session", duration: 60, price: "75.00", color: "#74B9FF", category: "Tattoo" },
    ],
    products: [
      { name: "Tattoo Aftercare Lotion", price: "18.00", brand: "Hustle Butter", description: "Vegan tattoo balm" },
      { name: "Saniderm Bandage (5pk)", price: "25.00", brand: "Saniderm", description: "Tattoo healing bandage" },
      { name: "Tattoo Sunscreen", price: "20.00", brand: "Tattoo Goo", description: "SPF 30 tattoo protector" },
      { name: "Piercing Aftercare Spray", price: "15.00", brand: "NeilMed", description: "Saline wound wash" },
      { name: "Tattoo Stencil Paper", price: "22.00", brand: "Spirit", description: "Transfer paper set" },
      { name: "Numbing Cream", price: "35.00", brand: "EMLA", description: "Topical anesthetic" },
      { name: "Tattoo Ink Set", price: "85.00", brand: "Intenze", description: "Professional ink set" },
      { name: "Piercing Jewelry Set", price: "45.00", brand: "Implant Grade", description: "Titanium jewelry" },
      { name: "Tattoo Healing Balm", price: "22.00", brand: "After Inked", description: "Moisturizing aftercare" },
      { name: "Flash Art Print", price: "30.00", brand: "Ink & Soul", description: "Limited edition print" },
    ],
    discounts: [
      { name: "Walk-In Wednesday", percentage: 15, startTime: "12:00", endTime: "18:00" },
      { name: "First Tattoo", percentage: 10, startTime: "10:00", endTime: "20:00" },
      { name: "Referral Ink", percentage: 20, startTime: "10:00", endTime: "20:00" },
    ],
  },
  {
    businessName: "Bright Smile Dental",
    ownerName: "Dr. Sarah Chen",
    phone: "4125550901",
    email: "sarah@brightsmile.com",
    description: "Modern dental practice offering cosmetic, preventive, and restorative dentistry in downtown Pittsburgh.",
    businessCategory: "Dental",
    lat: "40.4420",
    lng: "-79.9960",
    logoUrl: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=400&h=400&fit=crop",
    locations: [
      { name: "Downtown", address: "One PPG Place, Suite 300", city: "Pittsburgh", state: "PA", zipCode: "15222", phone: "(412) 555-0901" },
      { name: "Cranberry Township", address: "1000 Town Center Dr", city: "Cranberry Township", state: "PA", zipCode: "16066", phone: "(412) 555-0902" },
    ],
    staff: [
      { name: "Dr. Sarah Chen", role: "Lead Dentist", color: "#0984E3" },
      { name: "Dr. Michael Ross", role: "Cosmetic Dentist", color: "#00CEC9" },
      { name: "Lisa Hoffman", role: "Dental Hygienist", color: "#55EFC4" },
      { name: "Tom Bradley", role: "Dental Hygienist", color: "#74B9FF" },
      { name: "Amy Walsh", role: "Dental Assistant", color: "#A29BFE" },
    ],
    services: [
      { name: "Teeth Cleaning", duration: 60, price: "120.00", color: "#0984E3", category: "Dental" },
      { name: "Teeth Whitening", duration: 60, price: "350.00", color: "#00CEC9", category: "Dental" },
      { name: "Dental Exam & X-Rays", duration: 60, price: "150.00", color: "#55EFC4", category: "Dental" },
      { name: "Composite Filling", duration: 60, price: "200.00", color: "#74B9FF", category: "Dental" },
      { name: "Porcelain Veneer (per tooth)", duration: 90, price: "1200.00", color: "#A29BFE", category: "Dental" },
      { name: "Dental Crown", duration: 90, price: "1500.00", color: "#0984E3", category: "Dental" },
      { name: "Invisalign Consultation", duration: 45, price: "75.00", color: "#00CEC9", category: "Dental" },
      { name: "Emergency Dental Visit", duration: 60, price: "175.00", color: "#55EFC4", category: "Dental" },
      { name: "Tooth Extraction", duration: 45, price: "250.00", color: "#74B9FF", category: "Dental" },
      { name: "Night Guard", duration: 30, price: "400.00", color: "#A29BFE", category: "Dental" },
    ],
    products: [
      { name: "Electric Toothbrush", price: "75.00", brand: "Oral-B", description: "Pro 1000 rechargeable" },
      { name: "Whitening Toothpaste", price: "12.00", brand: "Sensodyne", description: "Pronamel whitening" },
      { name: "Water Flosser", price: "65.00", brand: "Waterpik", description: "Cordless water flosser" },
      { name: "Whitening Strips", price: "45.00", brand: "Crest 3D", description: "Professional effects" },
      { name: "Tongue Scraper", price: "8.00", brand: "DenTek", description: "Stainless steel scraper" },
      { name: "Mouthwash", price: "10.00", brand: "Listerine", description: "Total care mouthwash" },
      { name: "Dental Floss (6pk)", price: "15.00", brand: "GUM", description: "Expanding dental floss" },
      { name: "Tooth Sensitivity Gel", price: "18.00", brand: "Sensodyne", description: "Rapid relief gel" },
      { name: "Charcoal Toothpaste", price: "14.00", brand: "Hello", description: "Activated charcoal" },
      { name: "Retainer Case", price: "12.00", brand: "Bright Smile", description: "Ventilated retainer case" },
    ],
    discounts: [
      { name: "New Patient Special", percentage: 20, startTime: "09:00", endTime: "17:00" },
      { name: "Senior Care", percentage: 15, startTime: "09:00", endTime: "15:00" },
      { name: "Family Plan", percentage: 10, startTime: "09:00", endTime: "17:00" },
    ],
  },
  {
    businessName: "Pittsburgh Wellness Center",
    ownerName: "Dr. Omar Hassan",
    phone: "4125551001",
    email: "omar@pittsburghwellness.com",
    description: "Integrative health center offering chiropractic, acupuncture, and holistic wellness services.",
    businessCategory: "Medical",
    lat: "40.4400",
    lng: "-79.9945",
    logoUrl: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=400&fit=crop",
    locations: [
      { name: "Downtown", address: "525 William Penn Pl", city: "Pittsburgh", state: "PA", zipCode: "15219", phone: "(412) 555-1001" },
      { name: "Bethel Park", address: "3000 Library Rd", city: "Bethel Park", state: "PA", zipCode: "15102", phone: "(412) 555-1002" },
    ],
    staff: [
      { name: "Dr. Omar Hassan", role: "Chiropractor", color: "#2ECC71" },
      { name: "Dr. Lin Wei", role: "Acupuncturist", color: "#27AE60" },
      { name: "Nurse Tanya Simmons", role: "Wellness Coach", color: "#1ABC9C" },
      { name: "Dr. Raj Patel", role: "Naturopath", color: "#16A085" },
      { name: "Maria Gonzalez", role: "Massage Therapist", color: "#2980B9" },
    ],
    services: [
      { name: "Chiropractic Adjustment", duration: 30, price: "85.00", color: "#2ECC71", category: "Medical" },
      { name: "Acupuncture Session", duration: 60, price: "110.00", color: "#27AE60", category: "Medical" },
      { name: "Wellness Consultation", duration: 60, price: "95.00", color: "#1ABC9C", category: "Medical" },
      { name: "Naturopathic Visit", duration: 60, price: "120.00", color: "#16A085", category: "Medical" },
      { name: "Therapeutic Massage", duration: 60, price: "95.00", color: "#2980B9", category: "Medical" },
      { name: "Cupping Therapy", duration: 45, price: "75.00", color: "#2ECC71", category: "Medical" },
      { name: "Nutrition Counseling", duration: 60, price: "85.00", color: "#27AE60", category: "Medical" },
      { name: "Spinal Decompression", duration: 30, price: "65.00", color: "#1ABC9C", category: "Medical" },
      { name: "Dry Needling", duration: 45, price: "90.00", color: "#16A085", category: "Medical" },
      { name: "Wellness Package (5 visits)", duration: 60, price: "380.00", color: "#2980B9", category: "Medical" },
    ],
    products: [
      { name: "Omega-3 Fish Oil", price: "28.00", brand: "Nordic Naturals", description: "High potency omega-3" },
      { name: "Magnesium Glycinate", price: "25.00", brand: "Pure Encapsulations", description: "Muscle relaxation" },
      { name: "Probiotic (30 caps)", price: "35.00", brand: "Garden of Life", description: "50 billion CFU" },
      { name: "Turmeric Curcumin", price: "22.00", brand: "Thorne", description: "Anti-inflammatory" },
      { name: "Vitamin D3 (5000 IU)", price: "18.00", brand: "NOW Foods", description: "Immune support" },
      { name: "Collagen Peptides", price: "40.00", brand: "Vital Proteins", description: "Joint & skin support" },
      { name: "Acupressure Mat", price: "55.00", brand: "Nayoya", description: "Wellness acupressure mat" },
      { name: "TENS Unit", price: "65.00", brand: "iReliev", description: "Pain relief device" },
      { name: "Posture Corrector", price: "30.00", brand: "Upright", description: "Smart posture trainer" },
      { name: "Ice/Heat Pack", price: "20.00", brand: "TheraPearl", description: "Reusable therapy pack" },
    ],
    discounts: [
      { name: "New Patient Offer", percentage: 25, startTime: "09:00", endTime: "17:00" },
      { name: "Wellness Wednesday", percentage: 15, startTime: "09:00", endTime: "17:00" },
      { name: "Senior Wellness", percentage: 20, startTime: "09:00", endTime: "15:00" },
    ],
  },
];

// ─── Working Hours Template ───────────────────────────────────────────────────

const DEFAULT_WH = JSON.stringify({
  Monday:    { enabled: true,  start: "09:00", end: "18:00" },
  Tuesday:   { enabled: true,  start: "09:00", end: "18:00" },
  Wednesday: { enabled: true,  start: "09:00", end: "18:00" },
  Thursday:  { enabled: true,  start: "09:00", end: "20:00" },
  Friday:    { enabled: true,  start: "09:00", end: "20:00" },
  Saturday:  { enabled: true,  start: "10:00", end: "17:00" },
  Sunday:    { enabled: false, start: "10:00", end: "15:00" },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  console.log("✅ Connected to DB");

  let totalOwners = 0;
  let totalLocations = 0;
  let totalStaff = 0;
  let totalServices = 0;
  let totalProducts = 0;
  let totalDiscounts = 0;

  for (const biz of BUSINESSES) {
    // ── 1. Create business owner ─────────────────────────────────────────────
    const slug = biz.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const [ownerResult] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO business_owners
         (phone, businessName, ownerName, email, description, businessLogoUri,
          defaultDuration, notificationsEnabled, themeMode, temporaryClosed,
          scheduleMode, workingHours, bufferTime, slotInterval,
          autoCompleteEnabled, autoCompleteDelayMinutes, onboardingComplete,
          businessCategory, lat, lng, clientPortalVisible, customSlug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        biz.phone,
        biz.businessName,
        biz.ownerName,
        biz.email,
        biz.description,
        biz.logoUrl,
        30,
        true,
        "system",
        false,
        "weekly",
        DEFAULT_WH,
        0,
        0,
        true,
        5,
        true,
        biz.businessCategory,
        biz.lat,
        biz.lng,
        true,
        slug,
      ]
    );
    const ownerId = ownerResult.insertId;
    totalOwners++;
    console.log(`  ✅ Created business: ${biz.businessName} (id=${ownerId})`);

    // ── 2. Create 10 services ────────────────────────────────────────────────
    const serviceLocalIds: string[] = [];
    for (const svc of biz.services) {
      const localId = uid();
      serviceLocalIds.push(localId);
      // Fix any price values that accidentally have # prefix
      const cleanPrice = String(svc.price).replace("#", "");
      await conn.execute(
        `INSERT INTO services (businessOwnerId, localId, name, duration, price, color, category)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ownerId, localId, svc.name, svc.duration, cleanPrice, svc.color, svc.category]
      );
    }
    totalServices += biz.services.length;

    // ── 3. Create 2 locations ────────────────────────────────────────────────
    const locationLocalIds: string[] = [];
    for (let i = 0; i < biz.locations.length; i++) {
      const loc = biz.locations[i];
      const localId = uid();
      locationLocalIds.push(localId);
      await conn.execute(
        `INSERT INTO locations
           (businessOwnerId, localId, name, address, city, state, zipCode, phone, isDefault, active, workingHours)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ownerId, localId, loc.name, loc.address, loc.city, loc.state,
          loc.zipCode, loc.phone, i === 0 ? 1 : 0, 1, DEFAULT_WH,
        ]
      );
    }
    totalLocations += biz.locations.length;

    // ── 4. Create 5 staff members ────────────────────────────────────────────
    for (const s of biz.staff) {
      const localId = uid();
      const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
      const wh: Record<string, { enabled: boolean; start: string; end: string }> = {};
      days.forEach((d) => {
        wh[d] = { enabled: d !== "Sunday", start: "09:00", end: "18:00" };
      });
      // Assign to all locations, all services
      await conn.execute(
        `INSERT INTO staff_members
           (businessOwnerId, localId, name, phone, role, color, serviceIds, locationIds, workingHours, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ownerId, localId, s.name,
          `(412) 555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          s.role, s.color,
          JSON.stringify(serviceLocalIds),
          JSON.stringify(locationLocalIds),
          JSON.stringify(wh),
          1,
        ]
      );
    }
    totalStaff += biz.staff.length;

    // ── 5. Create 10 products ────────────────────────────────────────────────
    for (const p of biz.products) {
      const localId = uid();
      await conn.execute(
        `INSERT INTO products (businessOwnerId, localId, name, price, description, brand, available)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ownerId, localId, p.name, p.price, p.description, p.brand, 1]
      );
    }
    totalProducts += biz.products.length;

    // ── 6. Create 3 discounts ────────────────────────────────────────────────
    for (const d of biz.discounts) {
      const localId = uid();
      await conn.execute(
        `INSERT INTO discounts
           (businessOwnerId, localId, name, percentage, startTime, endTime, active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ownerId, localId, d.name, d.percentage, d.startTime, d.endTime, 1]
      );
    }
    totalDiscounts += biz.discounts.length;
  }

  await conn.end();

  console.log("\n🎉 Pittsburgh seed complete!");
  console.log(`   Businesses:  ${totalOwners}`);
  console.log(`   Locations:   ${totalLocations}`);
  console.log(`   Staff:       ${totalStaff}`);
  console.log(`   Services:    ${totalServices}`);
  console.log(`   Products:    ${totalProducts}`);
  console.log(`   Discounts:   ${totalDiscounts}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
