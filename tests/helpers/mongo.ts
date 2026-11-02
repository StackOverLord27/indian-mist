import { afterAll, afterEach, beforeAll } from "vitest";
import mongoose from "mongoose";

/**
 * Per-test-file isolated MongoDB database on a LOCAL real mongod
 * (podman: `indianmist-test-mongo`, single-node replica set, so transactions
 * behave like Atlas). Override the server with MONGO_TEST_URI.
 * Refuses any non-local host. Each file gets its own random database, which
 * is dropped afterwards; collections are emptied between tests.
 */
const BASE = process.env.MONGO_TEST_URI ?? "mongodb://127.0.0.1:27018/?directConnection=true&replicaSet=rs0";

function assertLocal(uri: string) {
  const host = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://")).hostname;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host) || uri.startsWith("mongodb+srv")) {
    throw new Error(`Refusing to run tests against non-local MongoDB host "${host}".`);
  }
}

export function setupTestDb() {
  assertLocal(BASE);
  const dbName = `im_test_${process.pid}_${Math.random().toString(36).slice(2, 10)}`;

  beforeAll(async () => {
    await mongoose.connect(BASE, { dbName, serverSelectionTimeoutMS: 5000 });
    // Make src/lib/db.ts reuse this connection instead of reading MONGODB_URI.
    global._mongooseCache = { conn: mongoose, promise: Promise.resolve(mongoose) };
    // Build indexes (unique constraints matter for race tests).
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  });

  afterEach(async () => {
    const cols = await mongoose.connection.db!.collections();
    await Promise.all(cols.map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    global._mongooseCache = { conn: null, promise: null };
  });

  return { dbName };
}
