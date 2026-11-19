import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { spawnSync } from "node:child_process";
import {
  compareIndexes, confirmationOk, differences, findDuplicates, hostsOf, indexName, isLocalUri, normalizeDeclared, normalizeLive,
} from "../scripts/ensure-indexes-lib.mjs";

const BASE = process.env.MONGO_TEST_URI ?? "mongodb://127.0.0.1:27018/?directConnection=true&replicaSet=rs0";
const DB = `im_idx_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const uriFor = (db: string) => BASE.replace("27018/?", `27018/${db}?`);

let conn: mongoose.Connection;
const orders = () => conn.db!.collection("orders");

beforeAll(async () => {
  conn = await mongoose.createConnection(BASE, { dbName: DB, serverSelectionTimeoutMS: 5000 }).asPromise();
});
afterAll(async () => {
  await conn.dropDatabase();
  await conn.close();
});
beforeEach(async () => {
  await conn.dropDatabase();
  await conn.db!.createCollection("orders");
  // the live database's state: a PLAIN index under the name the model's unique one needs
  await orders().createIndex({ razorpayOrderId: 1 }, { name: "razorpayOrderId_1" });
});

const run = (args: string[] = [], env: Record<string, string> = {}) => {
  const r = spawnSync(process.execPath, ["scripts/ensure-indexes.mjs", ...args], {
    cwd: process.cwd(), encoding: "utf8", timeout: 60_000,
    env: { ...process.env, MONGODB_URI: uriFor(DB), ...env },
    input: "", // no terminal: the typed-confirmation prompt is not available
  });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
};
const orderIndex = async () => (await orders().indexes()).find((i) => i.name === "razorpayOrderId_1")!;

describe("library", () => {
  it("names, normalises and compares like MongoDB does", () => {
    expect(indexName({ userId: 1, createdAt: -1 })).toBe("userId_1_createdAt_-1");
    const declared = normalizeDeclared([{ razorpayOrderId: 1 }, { unique: true, sparse: true, background: true }]);
    expect(declared).toMatchObject({ name: "razorpayOrderId_1", unique: true, sparse: true });
    const plain = normalizeLive({ v: 2, key: { razorpayOrderId: 1 }, name: "razorpayOrderId_1" });
    expect(differences(declared, plain)).toEqual(["unique: declared true, live false", "sparse: declared true, live false"]);
    expect(differences(declared, normalizeLive({ key: { razorpayOrderId: 1 }, name: "razorpayOrderId_1", unique: true, sparse: true }))).toEqual([]);
  });
  it("compareIndexes: missing, different, extra; _id_ ignored", () => {
    const declared: [Record<string, number>, Record<string, unknown>?][] = [[{ a: 1 }, { unique: true }], [{ b: 1 }], [{ c: 1 }, { expireAfterSeconds: 0 }]];
    const live = [{ key: { _id: 1 }, name: "_id_" }, { key: { a: 1 }, name: "a_1" }, { key: { c: 1 }, name: "c_1", expireAfterSeconds: 0 }, { key: { z: 1 }, name: "z_1" }];
    const r = compareIndexes(declared, live);
    expect(r.missing.map((m: { name: string }) => m.name)).toEqual(["b_1"]);
    expect(r.different.map((d: { declared: { name: string } }) => d.declared.name)).toEqual(["a_1"]);
    expect(r.extra.map((e: { name: string }) => e.name)).toEqual(["z_1"]);
  });
  it("hosts and the typed confirmation", () => {
    expect(isLocalUri("mongodb://127.0.0.1:27018/x?replicaSet=rs0")).toBe(true);
    expect(isLocalUri("mongodb://user:pa%40ss@localhost/x")).toBe(true);
    expect(isLocalUri("mongodb+srv://u:p@cluster0.abc.mongodb.net/x")).toBe(false);
    expect(isLocalUri("mongodb://127.0.0.1:1,db.example.com:2/x")).toBe(false);
    expect(hostsOf("mongodb://user:secret@db.example.com:27017/x")).toEqual(["db.example.com"]);
    expect(confirmationOk("indian_mist", "indian_mist")).toBe(true);
    expect(confirmationOk(" indian_mist \n", "indian_mist")).toBe(true);
    expect(confirmationOk("indian", "indian_mist")).toBe(false);
    expect(confirmationOk(undefined, "indian_mist")).toBe(false);
  });
  it("findDuplicates respects sparse (missing field is fine) and reports counts and ids", async () => {
    await orders().insertMany([{ razorpayOrderId: "o1" }, { razorpayOrderId: "o1" }, { razorpayOrderId: "o2" }, { note: "no id" }, { note: "no id either" }]);
    const dupes = await findDuplicates(orders(), { name: "razorpayOrderId_1", key: { razorpayOrderId: 1 }, unique: true, sparse: true });
    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({ value: { razorpayOrderId: "o1" }, count: 2 });
    expect(dupes[0].ids).toHaveLength(2);
    // without sparse, the two documents WITHOUT the field collide too (null = null)
    const strict = await findDuplicates(orders(), { name: "razorpayOrderId_1", key: { razorpayOrderId: 1 }, unique: true, sparse: false });
    expect(strict.map((d: { count: number }) => d.count).sort()).toEqual([2, 2]);
  });
});

describe("the script against a database with the conflicting plain index", () => {
  it("default run is a READ-ONLY report that names the problem", async () => {
    await orders().insertMany([{ razorpayOrderId: "a" }, { razorpayOrderId: "b" }]);
    const r = run();
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/MODE: report only/);
    expect(r.out).toMatch(/DIFFERS\s+Order \(orders\)/);
    expect(r.out).toMatch(/wrong\s+razorpayOrderId_1\s+<-- must be UNIQUE but is not/);
    expect(r.out).toMatch(/unique: declared true, live false/);
    expect(r.out).toMatch(/sparse: declared true, live false/);
    expect(r.out).not.toMatch(/dropped|built/);
    expect((await orderIndex()).unique).toBeUndefined(); // nothing changed
    expect(await orders().countDocuments()).toBe(2);
  });

  it("the report (and a refused --apply) create no collection and no index anywhere, not even through Mongoose's own background index build", async () => {
    run();
    run(["--apply"]);
    run(["--apply", "--confirm=wrong"]);
    const names = (await conn.db!.listCollections().toArray()).map((c) => c.name);
    expect(names).toEqual(["orders"]); // nothing else appeared
    expect((await orders().indexes()).map((i) => i.name).sort()).toEqual(["_id_", "razorpayOrderId_1"]);
  });

  it("--apply without the database name typed does nothing", async () => {
    const noConfirm = run(["--apply"]);
    expect(noConfirm.code).toBe(2);
    expect(noConfirm.out).toMatch(/REFUSING: --apply needs the database name/);
    const wrong = run(["--apply", "--confirm=indian_mist"]);
    expect(wrong.code).toBe(2);
    expect(wrong.out).toMatch(/does not match the database name/);
    expect((await orderIndex()).unique).toBeUndefined();
  });

  it("--apply with the right name, no duplicates: drops the plain index, builds the unique sparse one, keeps every document", async () => {
    await orders().insertMany([{ razorpayOrderId: "a" }, { razorpayOrderId: "b" }, { note: "no razorpay id" }, { note: "another without" }]);
    const r = run(["--apply", `--confirm=${DB}`]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/dropped\s+orders\.razorpayOrderId_1/);
    expect(r.out).toMatch(/built\s+orders\.razorpayOrderId_1/);
    expect(await orderIndex()).toMatchObject({ unique: true, sparse: true });
    expect(await orders().countDocuments()).toBe(4);
    // the database now refuses a second order for one Razorpay order
    await expect(orders().insertOne({ razorpayOrderId: "a" })).rejects.toMatchObject({ code: 11000 });
    // and a second run finds nothing to do
    const again = run();
    expect(again.out).toMatch(/ok\s+Order \(orders\)/);
  });

  it("--apply with duplicates present REFUSES, prints them, and changes nothing", async () => {
    await orders().insertMany([
      { razorpayOrderId: "order_dup", razorpayPaymentId: "pay_1" },
      { razorpayOrderId: "order_dup", razorpayPaymentId: "pay_1" },
      { razorpayOrderId: "order_ok" },
    ]);
    const r = run(["--apply", `--confirm=${DB}`]);
    expect(r.code).toBe(3);
    expect(r.out).toMatch(/REFUSING: orders\.razorpayOrderId_1 must be unique but these values already exist more than once/);
    expect(r.out).toMatch(/"razorpayOrderId":"order_dup"\}\s+x2\s+documents: [0-9a-f]{24}, [0-9a-f]{24}/);
    expect(r.out).not.toMatch(/order_ok/);
    expect(r.out).toMatch(/Nothing was changed/);
    expect((await orderIndex()).unique).toBeUndefined();
    expect(await orders().countDocuments()).toBe(3); // never deletes documents
    expect(r.out).not.toMatch(/dropped|built/);
  });

  it("duplicates in one collection stop the repair of the others too (all or nothing)", async () => {
    await conn.db!.createCollection("blogs");
    await orders().insertMany([{ razorpayOrderId: "x" }, { razorpayOrderId: "x" }]);
    const r = run(["--apply", `--confirm=${DB}`]);
    expect(r.code).toBe(3);
    expect(await conn.db!.collection("blogs").indexes()).toHaveLength(1); // only _id_: nothing built
  });

  it("prints no password", () => {
    const r = run([], { MONGODB_URI: uriFor(DB).replace("mongodb://", "mongodb://user:s3cretpass@") });
    expect(r.out).not.toContain("s3cretpass");
  });
});
