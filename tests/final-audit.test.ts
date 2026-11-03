import { describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./helpers/mongo";
import { adminCall } from "./helpers/admin";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());

import Carousel from "@/models/carousel.model";
import { BlogCategory } from "@/models/blog-category.model";
import * as carouselReorder from "@/app/api/admin/carousel/reorder/route";
import * as blogCategories from "@/app/api/admin/blogs/categories/route";
import * as csp from "@/app/api/csp-report/route";
import { maskEmail } from "@/lib/mailer";

setupTestDb();

const slide = (n: number) => Carousel.create({ url: `https://res.cloudinary.com/x/${n}.jpg`, publicId: `s${n}`, order: n });
const orderOf = async () => (await Carousel.find().sort({ order: 1 }).lean()).map((s) => s.publicId);

describe("carousel reorder", () => {
  it("renumbers the slides from the ids in the order given", async () => {
    const [a, b, c] = await Promise.all([slide(0), slide(1), slide(2)]);
    const res = await adminCall(carouselReorder.PUT as never, { method: "PUT", json: { orderedIds: [String(c._id), String(a._id), String(b._id)] } });
    expect(res.status).toBe(200);
    expect(await orderOf()).toEqual(["s2", "s0", "s1"]);
  });

  it("rejects bad input before changing anything: bad id, duplicates, empty, too many, wrong shape, non-admin", async () => {
    const a = await slide(0); const b = await slide(1);
    const bad = async (json: unknown, role?: string) => (await adminCall(carouselReorder.PUT as never, { method: "PUT", json, role })).status;
    expect(await bad({ orderedIds: [String(b._id), "not-an-id"] })).toBe(400);
    expect(await bad({ orderedIds: [String(a._id), String(a._id)] })).toBe(400);
    expect(await bad({ orderedIds: [] })).toBe(400);
    expect(await bad({ orderedIds: Array.from({ length: 101 }, () => String(a._id)) })).toBe(400);
    expect(await bad({ items: [{ id: String(a._id), order: { $gt: 1 } }] })).toBe(400);
    expect(await bad({ orderedIds: [String(b._id), String(a._id)] }, "user")).toBeGreaterThanOrEqual(401);
    expect(await orderOf()).toEqual(["s0", "s1"]); // untouched
  });
});

describe("blog categories", () => {
  const add = (name: unknown) => adminCall(blogCategories.POST as never, { method: "POST", json: { name } });

  it("adds a category once, ignoring case and treating regex characters as plain text", async () => {
    expect((await add("Field Notes (2026)")).status).toBe(201);
    expect((await add("field notes (2026)")).status).toBe(201);
    expect(await BlogCategory.countDocuments()).toBe(1);
    expect((await add(".*")).status).toBe(201); // would match everything if used as a pattern
    expect(await BlogCategory.countDocuments()).toBe(2);
  });

  it("refuses empty, over-long and non-text names with a validation message (no internals)", async () => {
    for (const name of ["", "   ", "x".repeat(61), 42, null, { $gt: "" }]) {
      const res = await add(name);
      expect(res.status).toBe(400);
      expect(JSON.stringify(await res.json())).not.toMatch(/mongo|mongoose|stack|ObjectId/i);
    }
    expect((await adminCall(blogCategories.POST as never, { method: "POST", rawBody: "{not json" })).status).toBe(400);
    expect(await BlogCategory.countDocuments()).toBe(0);
  });
});

describe("log hygiene", () => {
  it("masks e-mail addresses in the OTP mail log line", () => {
    expect(maskEmail("asha.kumar@example.com")).toBe("a***@example.com");
    expect(maskEmail("x@y.in")).toBe("x***@y.in");
  });

  it("the CSP report endpoint logs short, single-line text even for hostile reports", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const hostile = { "csp-report": { "blocked-uri": `https://evil.test/\n[fake] admin signed in\r\n${"A".repeat(3000)}`, "violated-directive": "img-src\u0000", "document-uri": "https://shop.test/" } };
    const res = await csp.POST(new Request("http://localhost/api/csp-report", { method: "POST", body: JSON.stringify(hostile) }));
    expect(res.status).toBe(204);
    const line = String(warn.mock.calls[0]?.[0] ?? "");
    expect(line).toContain("[csp]");
    expect(line).not.toMatch(/[\n\r\u0000]/);
    expect(line.length).toBeLessThan(700);
    warn.mockRestore();
  });
});
