import mongoose from 'mongoose';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var _mongooseCache: MongooseCache;
}

if (!global._mongooseCache) {
  global._mongooseCache = { conn: null, promise: null };
}

export default async function dbConnect(): Promise<typeof mongoose> {
  if (global._mongooseCache.conn) {
    return global._mongooseCache.conn;
  }
  if (!global._mongooseCache.promise) {
    global._mongooseCache.promise = mongoose.connect(
      process.env.MONGODB_URI!,
      {
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 10000,
      }
    );
  }
  global._mongooseCache.conn = await global._mongooseCache.promise;
  return global._mongooseCache.conn;
}

export { dbConnect as connectDB };