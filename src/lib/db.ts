import mongoose from "mongoose";
import { getMongoUri } from "@/lib/env";

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
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });
  }

  try {
    cache.conn = await cache.promise;
    return cache.conn;
  } catch (error) {
    cache.promise = null;
    console.error("MongoDB connection failed:", error);
    throw error;
  }
}

export { dbConnect as connectDB };