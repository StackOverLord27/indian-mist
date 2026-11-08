import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDb } from "./helpers/mongo";
import { fakeRedis } from "./helpers/redis";
import { razorpayState } from "./helpers/razorpay";
import { adminCall } from "./helpers/admin";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());
vi.mock("razorpay", async () => (await import("./helpers/razorpay")).razorpayModuleMock());

import { UnmatchedPayment } from "@/models/unmatched-payment.model";
import { Blog } from "@/models/blog.model";
import { BlogCategory } from "@/models/blog-category.model";
import { finalizeOrder } from "@/lib/finalize-order";
import * as unmatchedList from "@/app/api/admin/unmatched-payments/route";
import * as unmatchedResolve from "@/app/api/admin/unmatched-payments/[id]/route";
import * as blogCategories from "@/app/api/admin/blogs/categories/route";

setupTestDb();

const oid = () => new mongoose.Types.ObjectId();
const resolve = (id: string, role = "admin") => adminCall(unmatchedResolve.PATCH as never, { method: "PATCH", role }, { id });
const list = async () => (await adminCall(unmatchedList.GET as never, { method: "GET" })).json();
const seed = (n: string) => UnmatchedPayment.create({ razorpayOrderId: `order_${n}`, razorpayPaymentId: `pay_${n}`, amount: 499, source: "webhook" });

beforeEach(() => {
  fakeRedis.reset();
  razorpayState.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("marking an unmatched payment resolved", () => {
  it("removes it from the dashboard list and count, and records that it was done by hand", async () => {
    const a = await seed("a");
    await seed("b");
    expect((await list()).count).toBe(2);

    const res = await resolve(String(a._id));
    expect(res.status).toBe(200);
    const after = await list();
    expect(after.count).toBe(1);
    expect(after.payments.map((p: { razorpayPaymentId: string }) => p.razorpayPaymentId)).toEqual(["pay_b"]);
    expect(await UnmatchedPayment.findById(a._id).lean()).toMatchObject({ resolvedManually: true });
    expect((await UnmatchedPayment.findById(a._id).lean())!.resolvedAt).toBeInstanceOf(Date);
  });

  it("is safe to repeat; unknown and invalid ids; only admins", async () => {
    const a = await seed("c");
    expect((await resolve(String(a._id))).status).toBe(200);
    const firstTime = (await UnmatchedPayment.findById(a._id).lean())!.resolvedAt;
    const again = await resolve(String(a._id));
    expect(again.status).toBe(200);
    expect((await again.json()).message).toBe("Already resolved");
    expect((await UnmatchedPayment.findById(a._id).lean())!.resolvedAt).toEqual(firstTime); // not touched again

    expect((await resolve(String(oid()))).status).toBe(404);
    expect((await resolve("nope")).status).toBe(400);
    const b = await seed("d");
    expect((await resolve(String(b._id), "user")).status).toBe(403);
    expect((await list()).count).toBe(1);
  });

  it("a later retry of the same payment (the webhook) does not bring it back", async () => {
    const pending = await finalizeOrder({ razorpayOrderId: "order_retry", razorpayPaymentId: "pay_retry", userId: String(oid()), source: "webhook", paidAmountPaise: 49900 });
    expect(pending.ok).toBe(false); // no pending order: saved as unmatched
    const row = (await UnmatchedPayment.findOne({ razorpayOrderId: "order_retry" }).lean())!;
    await resolve(String(row._id));
    expect((await list()).count).toBe(0);

    await finalizeOrder({ razorpayOrderId: "order_retry", razorpayPaymentId: "pay_retry", userId: String(oid()), source: "webhook", paidAmountPaise: 49900 });
    const after = (await UnmatchedPayment.findOne({ razorpayOrderId: "order_retry" }).lean())!;
    expect(after.seen).toBe(2); // seen again, still resolved
    expect(after.resolvedAt).toBeInstanceOf(Date);
    expect((await list()).count).toBe(0);
  });
});

describe("blog categories have no built-in suggestions", () => {
  const get = async () => (await (await adminCall(blogCategories.GET as never, { method: "GET" })).json()).categories as string[];
  const post = (name: string) => adminCall(blogCategories.POST as never, { method: "POST", json: { name } });

  it("is empty until the owner creates one or uses one on a post", async () => {
    expect(await get()).toEqual([]);
  });

  it("lists exactly the saved categories and the ones already on posts", async () => {
    await post("Field Notes");
    await Blog.collection.insertOne({ title: "T", slug: "t", category: "Gear", content: "x", excerpt: "x", author: "A", isPublished: true, createdAt: new Date(), updatedAt: new Date() });
    expect(new Set(await get())).toEqual(new Set(["Field Notes", "Gear"]));
    expect(await BlogCategory.countDocuments()).toBe(1);
  });

  it("the old built-in wording is gone from the code", async () => {
    const fs = await import("node:fs");
    for (const file of ["src/app/api/admin/blogs/categories/route.ts", "src/components/admin/BlogCategorySelect.tsx"]) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/Trail Stories|Gear Guides|Sustainability|Brand Updates|Tips & Tricks/);
    }
  });
});
