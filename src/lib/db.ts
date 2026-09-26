// import mongoose from "mongoose";

// interface MongooseCache {
//   conn: typeof mongoose | null;
//   promise: Promise<typeof mongoose> | null;
// }

// declare global {
//   var _mongooseCache: MongooseCache | undefined;
// }

// if (!global._mongooseCache) {
//   global._mongooseCache = {
//     conn: null,
//     promise: null,
//   };
// }

// export default async function dbConnect(): Promise<typeof mongoose> {
//   if (global._mongooseCache?.conn) {
//     return global._mongooseCache.conn;
//   }

//   if (!global._mongooseCache?.promise) {
//     const uri = process.env.MONGODB_URI;

//     if (!uri) {
//       throw new Error("MONGODB_URI is not defined");
//     }

//     global._mongooseCache.promise = mongoose.connect(uri, {
//       bufferCommands: false,
//       maxPoolSize: 10,
//       serverSelectionTimeoutMS: 5000,
//       socketTimeoutMS: 10000,
//     });
//   }

//   try {
//     global._mongooseCache.conn = await global._mongooseCache.promise;
//     return global._mongooseCache.conn;
//   } catch (error) {
//     global._mongooseCache.promise = null;
//     console.error("MongoDB connection failed:", error);
//     throw error;
//   }
// }

// export { dbConnect as connectDB };
import mongoose from "mongoose";

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("MongoDB connected");
  } catch (error) {
    console.log("MongoDB connection failed:", error);
    throw error;
  }
};

export default connectDB;