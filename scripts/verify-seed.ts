import "../scripts/load-env.js";
import {
  getBusinessOwnerByPhone,
  getLocationsByOwner,
  getServicesByOwner,
  getStaffByOwner,
  getProductsByOwner,
  getPromoCodesByOwner,
  getGiftCardsByOwner,
  getDiscountsByOwner,
} from "../server/db";

async function verify() {
  for (const phone of ["4124827733", "4124822976"]) {
    const biz = await getBusinessOwnerByPhone(phone);
    if (!biz) {
      console.log(phone + ": NOT FOUND");
      continue;
    }
    const [locs, svcs, staff, prods, promos, gifts, discs] = await Promise.all([
      getLocationsByOwner(biz.id),
      getServicesByOwner(biz.id),
      getStaffByOwner(biz.id),
      getProductsByOwner(biz.id),
      getPromoCodesByOwner(biz.id),
      getGiftCardsByOwner(biz.id),
      getDiscountsByOwner(biz.id),
    ]);
    console.log("\n" + biz.businessName + " (phone=" + phone + ", id=" + biz.id + "):");
    console.log("  Locations (" + locs.length + "):", locs.map((l) => l.name + " [" + (l.active ? "active" : "inactive") + "]").join(", "));
    console.log("  Services (" + svcs.length + "):", svcs.map((s) => s.name + " $" + s.price).join(", "));
    console.log("  Staff (" + staff.length + "):", staff.map((s) => s.name + " - " + s.role).join(", "));
    console.log("  Products (" + prods.length + "):", prods.map((p) => p.name + " $" + p.price).join(", "));
    console.log("  Promo Codes (" + promos.length + "):", promos.map((p) => p.code + " " + p.percentage + "%").join(", "));
    console.log("  Gift Cards (" + gifts.length + "):", gifts.map((g) => g.code).join(", "));
    console.log("  Discounts (" + discs.length + "):", discs.map((d) => d.name + " " + d.percentage + "%").join(", "));
    console.log("  Slug:", biz.businessSlug);
    console.log("  Category:", biz.businessCategory);
    console.log("  Subscription:", biz.subscriptionPlan, "/", biz.subscriptionStatus);
  }
  process.exit(0);
}

verify().catch((e) => { console.error(e); process.exit(1); });
