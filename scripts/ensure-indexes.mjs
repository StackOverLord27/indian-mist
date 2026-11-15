#!/usr/bin/env node
/**
 * Compares the indexes each model DECLARES with the indexes the live database HAS.
 *
 *   npm run ensure:indexes                                  read-only report (default)
 *   npm run ensure:indexes -- --apply                       repair; asks you to type the database name
 *   npm run ensure:indexes -- --apply --confirm=<database>  same, without the question (scripts)
 *
 * Why it exists: Mongoose cannot replace an index that already exists under the same name with other
 * options, and it only emits an event when that fails. The live "orders" collection had a PLAIN
 * razorpayOrderId_1 index, so the unique one the model declares was never built.
 *
 * --apply, for every difference: (1) for an index that must be UNIQUE it first looks for values the
 * index would reject; if there are any it prints them and changes NOTHING, (2) drops the wrong
 * index, (3) builds the declared one (and puts the old one back if that fails). Missing indexes are
 * built. It never deletes or edits documents. Extra indexes are listed and left alone. Without
 * --apply nothing is written. The database is the MONGODB_URI of the environment (or .env); the
 * password is never printed.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { compareIndexes, findDuplicates, needsUniqueness, isLocalUri, hostsOf, confirmationOk } from "./ensure-indexes-lib.mjs";

const require = createRequire(import.meta.url);
const mongoose = require("mongoose");
// Loading the models must NOT make Mongoose build their indexes (or create collections) in the
// background: the report has to be read-only, and --apply is the only thing allowed to write.
mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const confirmArg = args.find((a) => a.startsWith("--confirm="))?.slice("--confirm=".length);

if (!process.env.MONGODB_URI) {
  try { process.loadEnvFile(".env"); } catch { /* use the environment as is */ }
}
const uri = process.env.MONGODB_URI?.trim();
if (!uri) { console.error("Missing environment variable MONGODB_URI"); process.exit(2); }

const local = isLocalUri(uri);
await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;
console.log(`Database: ${db.databaseName}   host: ${hostsOf(uri).join(",")}   (${local ? "local" : "NOT local"})`);
console.log(apply ? "MODE: apply (changes indexes only, never documents)" : "MODE: report only (nothing is written)");

// Load every model definition
const modelsDir = path.resolve(import.meta.dirname, "../src/models");
const models = new Map();
for (const file of fs.readdirSync(modelsDir).filter((f) => f.endsWith(".model.ts"))) {
  const mod = await import(pathToFileURL(path.join(modelsDir, file)).href);
  for (const value of Object.values(mod)) {
    if (value && typeof value === "function" && value.schema?.indexes && value.modelName) models.set(value.modelName, value);
  }
}

const plans = [];
for (const [name, model] of [...models].sort(([a], [b]) => a.localeCompare(b))) {
  const collection = db.collection(model.collection.name);
  const live = await collection.indexes().catch((e) => (e.codeName === "NamespaceNotFound" ? [] : Promise.reject(e)));
  const result = compareIndexes(model.schema.indexes(), live);
  plans.push({ name, collection, ...result });
}

let problems = 0;
for (const p of plans) {
  if (!p.missing.length && !p.different.length) { console.log(`ok       ${p.name} (${p.collection.collectionName})${p.extra.length ? `  [extra indexes: ${p.extra.map((e) => e.name).join(", ")}]` : ""}`); continue; }
  console.log(`DIFFERS  ${p.name} (${p.collection.collectionName})`);
  for (const m of p.missing) { problems++; console.log(`  missing  ${m.name}${m.unique ? "  (UNIQUE)" : ""}`); }
  for (const d of p.different) {
    problems++;
    const important = d.declared.unique && !d.live.unique ? "  <-- must be UNIQUE but is not" : "";
    console.log(`  wrong    ${d.live.name}${important}`);
    for (const line of d.differences) console.log(`             ${line}`);
  }
  if (p.extra.length) console.log(`  extra (left alone): ${p.extra.map((e) => e.name).join(", ")}`);
}
console.log(problems ? `\n${problems} difference(s) found.${apply ? "" : " Run with --apply to repair (it asks for the database name)."}` : "\nAll declared indexes exist with the declared options.");

if (!apply || !problems) { await mongoose.disconnect(); process.exit(0); }

// ── Apply ─────────────────────────────────────────────────────────────────────
let typed = confirmArg;
if (typed === undefined) {
  if (!process.stdin.isTTY) { console.error("\nREFUSING: --apply needs the database name typed in, or --confirm=<database>."); process.exit(2); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  typed = await rl.question(`\nType the database name (${db.databaseName}) to continue: `);
  rl.close();
}
if (!confirmationOk(typed, db.databaseName)) {
  console.error(`\nREFUSING: the confirmation does not match the database name "${db.databaseName}". Nothing was changed.${local ? "" : " (This is not a local database.)"}`);
  process.exit(2);
}

// 1. Look for duplicates BEFORE touching anything
let refused = false;
for (const p of plans) {
  for (const target of [...p.missing, ...p.different.map((d) => d.declared)]) {
    if (!needsUniqueness(target)) continue;
    const dupes = await findDuplicates(p.collection, target);
    if (!dupes.length) continue;
    refused = true;
    console.error(`\nREFUSING: ${p.collection.collectionName}.${target.name} must be unique but these values already exist more than once (showing up to ${dupes.length}):`);
    for (const d of dupes) console.error(`  ${JSON.stringify(d.value)}  x${d.count}  documents: ${d.ids.join(", ")}`);
  }
}
if (refused) {
  console.error("\nNothing was changed. Resolve the duplicates by hand (this script never deletes documents), then run it again.");
  process.exit(3);
}

// 2. Repair
let failed = false;
for (const p of plans) {
  for (const d of p.different) {
    const { declared, live } = d;
    try {
      await p.collection.dropIndex(live.name);
      console.log(`dropped  ${p.collection.collectionName}.${live.name}`);
    } catch (e) { failed = true; console.error(`could not drop ${live.name}: ${e.message}`); continue; }
    try {
      await create(p.collection, declared);
      console.log(`built    ${p.collection.collectionName}.${declared.name}`);
    } catch (e) {
      failed = true;
      console.error(`could not build ${declared.name}: ${e.message}. Putting back the previous index.`);
      await create(p.collection, live).catch((e2) => console.error(`ALSO could not restore ${live.name}: ${e2.message}`));
    }
  }
  for (const m of p.missing) {
    try { await create(p.collection, m); console.log(`built    ${p.collection.collectionName}.${m.name}`); }
    catch (e) { failed = true; console.error(`could not build ${m.name}: ${e.message}`); }
  }
}
await mongoose.disconnect();
process.exit(failed ? 1 : 0);

function create(collection, def) {
  const { key, name, unique, sparse, expireAfterSeconds, partialFilterExpression } = def;
  return collection.createIndex(key, { name, ...(unique && { unique }), ...(sparse && { sparse }), ...(expireAfterSeconds !== undefined && { expireAfterSeconds }), ...(partialFilterExpression && { partialFilterExpression }) });
}
