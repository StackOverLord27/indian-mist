import mongoose from "mongoose";
import { getMongoUri } from "@/lib/env";
import { checkOrdersIndexNow } from "@/lib/db-health";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

if (!global._mongooseCache) {
  global._mongooseCache = {
    conn: null,
    promise: null,
  };
}

export default async function dbConnect(): Promise<typeof mongoose> {
  const cache = global._mongooseCache!;

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(getMongoUri(), {
      bufferCommands: false,
      // Serverless: every Vercel function instance opens its OWN pool, and many instances can be
      // alive at once during a traffic burst. The free Atlas tier allows 500 connections in total
      // for the whole cluster, so the pool per instance is kept small (a request here runs a
      // handful of queries, mostly in parallel with each other, so 5 is plenty) and idle
      // connections are closed quickly instead of lingering after the instance goes quiet.
      // Rough budget: 5 per instance x ~100 warm instances = 500, and idle ones are released.
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 30_000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });
  }

  try {
    const first = !cache.conn;
    cache.conn = await cache.promise;
    // First connection of this server instance: look once at the orders index (logs a [db] CRITICAL
    // line when it is not unique and sparse). In the background; never delays or fails a request.
    if (first && !globalThis._ordersIndexHealth) void checkOrdersIndexNow();
    return cache.conn;
  } catch (error) {
    cache.promise = null;
    console.error("MongoDB connection failed:", error);
    throw error;
  }
}

export { dbConnect as connectDB };