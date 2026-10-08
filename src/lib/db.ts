import mongoose from "mongoose";

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
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is not defined");
    }

    cache.promise = mongoose.connect(uri, {
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