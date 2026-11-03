// `npm run seed:e2e`: reseeds the LOCAL e2e database (users + shop) so it can be explored by hand.
import { seedUsers, resetShop, closeDb } from "./db.ts";
const users = await seedUsers();
const shop = await resetShop();
console.log("Seeded users:", Object.keys(users).join(", "));
console.log("Products:", [shop.sized, shop.plain, shop.last].map((p) => p.slug).join(", "), "| promo:", shop.promoCode);
await closeDb();
