import { describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDb } from "./helpers/mongo";
import { FakeRedis } from "./helpers/redis";
import { cloudinaryModuleMock, cloudinaryCalls } from "./helpers/cloudinary";
import { getRazorpayTestKeys } from "./helpers/razorpay";

setupTestDb();

describe("test tooling", () => {
  it("connects to an isolated local Mongo replica set", async () => {
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    expect(hello.setName).toBe("rs0");
    expect(mongoose.connection.host).toMatch(/127\.0\.0\.1|localhost/);
    await mongoose.connection.db!.collection("t").insertOne({ a: 1 });
    expect(await mongoose.connection.db!.collection("t").countDocuments()).toBe(1);
  });

  it("cleans collections between tests", async () => {
    expect(await mongoose.connection.db!.collection("t").countDocuments()).toBe(0);
  });

  it("fake redis honours TTL, multi-del, incr and getdel", async () => {
    const r = new FakeRedis();
    await r.set("a", { x: 1 }, { ex: 10 });
    expect(await r.get("a")).toEqual({ x: 1 });
    r.advance(11_000);
    expect(await r.get("a")).toBeNull();
    await r.set("b", 1); await r.set("c", 2);
    expect(await r.del("b", "c", "zz")).toBe(2);
    expect(await r.incr("n")).toBe(1);
    expect(await r.getdel("n")).toBe(1);
    expect(await r.get("n")).toBeNull();
  });

  it("cloudinary mock records uploads and destroys", async () => {
    cloudinaryCalls.reset();
    const { v2 } = cloudinaryModuleMock();
    await v2.uploader.destroy("x/y");
    expect(cloudinaryCalls.destroys).toEqual(["x/y"]);
  });

  it("razorpay helper refuses non rzp_test_ keys", () => {
    const prev = process.env.RAZORPAY_KEY_ID;
    process.env.RAZORPAY_KEY_ID = "rzp_live_abc";
    expect(() => getRazorpayTestKeys()).toThrow(/rzp_test_/);
    process.env.RAZORPAY_KEY_ID = prev;
    vi.restoreAllMocks();
  });
});
