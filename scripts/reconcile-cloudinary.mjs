#!/usr/bin/env node
/**
 * Finds Cloudinary files under indian-mist/ that no document in the database points at (left
 * behind by abandoned uploads, crashes, or edits made before the asset clean-up existed).
 *
 *   node scripts/reconcile-cloudinary.mjs                 DRY RUN: only lists them (default)
 *   node scripts/reconcile-cloudinary.mjs --min-age-hours=48
 *   node scripts/reconcile-cloudinary.mjs --delete --confirm=<cloud>/<database>
 *
 * Deleting needs --confirm with the exact "<cloud name>/<database name>" this run is using, so
 * pointing the script at the wrong database (which would make every file look unused) cannot
 * delete anything by accident. It also refuses to delete when the database references no
 * images at all. Read-only unless --delete is given. Reads .env if the variables are not set.
 * Never prints secrets.
 */
import { createRequire } from "node:module";
import { collectReferencedIds, findOrphans, deleteRefusal, COLLECTIONS, ASSET_PREFIX } from "./reconcile-cloudinary-lib.mjs";

const require = createRequire(import.meta.url);
const mongoose = require("mongoose");
const { v2: cloudinary } = require("cloudinary");

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const value = (name) => flag(name)?.split("=").slice(1).join("=");

if (!process.env.MONGODB_URI) {
  try { process.loadEnvFile(".env"); } catch { /* use the environment as is */ }
}
const need = (name) => {
  if (!process.env[name]?.trim()) { console.error(`Missing environment variable ${name}`); process.exit(2); }
  return process.env[name].trim();
};
const uri = need("MONGODB_URI");
cloudinary.config({ cloud_name: need("CLOUDINARY_CLOUD_NAME"), api_key: need("CLOUDINARY_API_KEY"), api_secret: need("CLOUDINARY_API_SECRET"), secure: true });

const minAgeHours = Number(value("min-age-hours") ?? 24);
if (!Number.isFinite(minAgeHours) || minAgeHours < 0) { console.error("--min-age-hours must be a number"); process.exit(2); }
const doDelete = !!flag("delete");

await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;
const label = `${process.env.CLOUDINARY_CLOUD_NAME.trim()}/${db.databaseName}`;
console.log(`Cloudinary cloud / database: ${label}`);
console.log(doDelete ? "MODE: DELETE" : "MODE: dry run (nothing is deleted)");

const documents = [];
for (const name of COLLECTIONS) documents.push(...(await db.collection(name).find({}).toArray()));
const referenced = collectReferencedIds(documents);
console.log(`Documents scanned: ${documents.length}; images they reference: ${referenced.size}`);

const resources = [];
let cursor;
do {
  const page = await cloudinary.api.resources({ type: "upload", prefix: ASSET_PREFIX, max_results: 500, next_cursor: cursor });
  resources.push(...page.resources);
  cursor = page.next_cursor;
} while (cursor);
console.log(`Files in Cloudinary under ${ASSET_PREFIX}: ${resources.length}`);

const missing = [...referenced].filter((id) => id.startsWith(ASSET_PREFIX) && !resources.some((r) => r.public_id === id));
const { orphans, tooNew } = findOrphans(resources, referenced, { minAgeHours });
const bytes = orphans.reduce((n, r) => n + (r.bytes ?? 0), 0);

console.log(`\nUnused files (older than ${minAgeHours} h): ${orphans.length} (${(bytes / 1024).toFixed(0)} KB)`);
for (const r of orphans) console.log(`  ${r.public_id}  ${new Date(r.created_at).toISOString().slice(0, 10)}  ${r.bytes ?? "?"} B`);
console.log(`Unused but newer than ${minAgeHours} h (left alone, may be an unsaved upload): ${tooNew.length}`);
if (missing.length) {
  console.log(`\nWarning: ${missing.length} image(s) referenced by documents do not exist in Cloudinary (broken images on the site):`);
  for (const id of missing.slice(0, 50)) console.log(`  ${id}`);
}

if (doDelete && orphans.length) {
  const refusal = deleteRefusal({ label, confirm: value("confirm"), referencedCount: referenced.size });
  if (refusal) {
    console.error(`\n${refusal}`);
    process.exit(3);
  }
  let deleted = 0;
  const failed = [];
  for (const r of orphans) {
    const res = await cloudinary.uploader.destroy(r.public_id, { invalidate: true });
    if (res.result === "ok" || res.result === "not found") deleted++; else failed.push(r.public_id);
  }
  console.log(`\nDeleted ${deleted} file(s).${failed.length ? ` Failed: ${failed.join(", ")}` : ""}`);
} else if (doDelete) {
  console.log("\nNothing to delete.");
} else if (orphans.length) {
  console.log(`\nDry run only. To delete these: node scripts/reconcile-cloudinary.mjs --delete --confirm=${label}`);
}
await mongoose.disconnect();
