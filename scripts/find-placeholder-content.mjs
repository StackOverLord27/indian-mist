#!/usr/bin/env node
/**
 * READ-ONLY. Lists saved content (site settings, About page, legal pages, products' shipping
 * text) that still matches the placeholder wording the code used to ship as defaults, so the owner
 * can review it in the admin. Writes nothing, changes nothing, prints no secrets.
 *
 *   node scripts/find-placeholder-content.mjs        (uses MONGODB_URI, or .env if it is not set)
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const mongoose = require("mongoose");

if (!process.env.MONGODB_URI) { try { process.loadEnvFile(".env"); } catch { /* handled below */ } }
if (!process.env.MONGODB_URI) { console.error("Set MONGODB_URI (or have it in .env)."); process.exit(1); }

// Phrases the code used to insert on its own. A match means "check this is really what you want to say".
const PLACEHOLDERS = [
  "Summer 2026 Collection", "Born from the forest", "made for the wild", "Slow-made forest gear", "Eco materials",
  "Certified Organic", "GOTS", "OUR ROOTS", "We make things the forest would", "Indian Mist began with the simple belief",
  "Organic cotton", "Natural dyes", "Zero plastic", "Fair trade", "1 tree per order", "Planted with care", "Sustainable materials",
  "Low-impact goods", "Easy returns", "Simple exchanges", "Ethically sourced", "Traceable makers", "Our commitment",
  "gentler", "12k+", "Trees planted", "Recycled packaging", "Plastic used", "Revenue donated", "Native saplings",
  "123 Forest Lane", "98765 43210", "hello@indianmist.com", "Mon-Fri, 9:00 AM - 6:00 PM", "Mon–Fri, 9:00 AM – 6:00 PM",
  "We would love to hear from you", "Forest & Eco", "slower materials", "The wild has a way", "A Love for the Wild",
  "Look Closer", "Born from a fascination", "3-5 business days", "1-2 business days", "5-7 business days",
  "Free returns within 30 days", "Carbon-neutral",
];

const hits = [];
function walk(value, path, source) {
  if (typeof value === "string") {
    const match = PLACEHOLDERS.find((p) => value.toLowerCase().includes(p.toLowerCase()));
    if (match) hits.push({ source, path, match, preview: value.length > 70 ? `${value.slice(0, 67)}...` : value });
  } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`, source));
  else if (value && typeof value === "object" && !(value instanceof Date) && typeof value.toHexString !== "function") {
    for (const [k, v] of Object.entries(value)) if (k !== "_id") walk(v, path ? `${path}.${k}` : k, source);
  }
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;
console.log(`Read-only scan of database "${db.databaseName}"\n`);

for (const [collection, label] of [["sitesettings", "Site settings"], ["aboutpages", "About page"], ["legalpages", "Legal pages"]]) {
  const docs = await db.collection(collection).find({}).toArray().catch(() => []);
  if (collection === "legalpages") {
    for (const d of docs) console.log(`Legal page "${d.slug}": saved, ${String(d.content ?? "").length} characters of text`);
    for (const slug of ["privacy-policy", "terms-and-conditions"]) if (!docs.some((d) => d.slug === slug)) console.log(`Legal page "${slug}": NOT SAVED (the website shows the code's generic default text)`);
  }
  docs.forEach((d) => walk(d, "", label));
}
// product shipping text defaults
const shipping = await db.collection("products").countDocuments({ $or: [{ "shippingInfo.standard": /3-5 business days/ }, { "shippingInfo.express": /1-2 business days/ }] });
const productCount = await db.collection("products").estimatedDocumentCount();
console.log(`Products whose shipping text is the old default (3-5 / 1-2 business days): ${shipping} of ${productCount}`);

console.log(hits.length ? `\n${hits.length} saved value(s) match placeholder wording:\n` : "\nNo saved site/About text matches the placeholder wording.");
for (const h of hits) console.log(`- [${h.source}] ${h.path}  =  "${h.preview}"   (matches "${h.match}")`);
await mongoose.disconnect();
