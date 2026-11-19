import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./helpers/mongo";
import { cloudinaryCalls } from "./helpers/cloudinary";
import { adminCall, pngFile } from "./helpers/admin";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("cloudinary", async () => (await import("./helpers/cloudinary")).cloudinaryModuleMock());

import { Product } from "@/models/product.model";
import * as products from "@/app/api/admin/products/route";
import * as productById from "@/app/api/admin/products/[id]/route";
import { buildProductFormData, type ProductFormValues } from "@/lib/admin-api/product-form-data";
import { getProductBySlug } from "@/lib/get-product";

setupTestDb();

const base: ProductFormValues = {
  name: "Trail Tee", category: "tees", price: 499, description: "Soft tee", isFeatured: false,
  trackInventory: false, stockQuantity: 0, features: [""], tags: "Bio-Washed, 100% Cotton", materials: [""], careInstructions: [{ text: "", icon: "droplets" }],
};
const noImages = { newFiles: [pngFile()], removedImageIds: [], imageOrder: [], coverImageId: "" };

beforeEach(() => {
  cloudinaryCalls.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const create = async (over: Partial<ProductFormValues> = {}) => {
  const res = await adminCall(products.POST, { form: buildProductFormData({ ...base, ...over }, noImages) });
  expect(res.status).toBe(201);
  return (await res.json()).product as { _id: string; slug: string };
};
const update = (id: string, over: Partial<ProductFormValues>) =>
  adminCall(productById.PUT, { method: "PUT", form: buildProductFormData({ ...base, ...over }, { newFiles: [], removedImageIds: [], imageOrder: [], coverImageId: "" }) }, { id });

describe("the product's second list (Ideal for / Wear it on ...)", () => {
  it("is saved with the heading the admin typed, trimmed, and shown on the storefront product", async () => {
    const p = await create({ idealForHeading: "  Wear it on ", idealFor: "treks,  birdwatching , ,road trips" });
    const saved = (await Product.findById(p._id).lean())!;
    expect(saved.idealForHeading).toBe("Wear it on");
    expect(saved.idealFor).toEqual(["treks", "birdwatching", "road trips"]);

    const storefront = (await getProductBySlug(p.slug))!;
    expect(storefront).toMatchObject({ idealForHeading: "Wear it on", idealFor: ["treks", "birdwatching", "road trips"], tags: ["Bio-Washed", "100% Cotton"] });
  });

  it("nothing is invented: without input there is no heading and no items stored", async () => {
    const p = await create();
    const saved = (await Product.findById(p._id).lean())!;
    expect(saved.idealForHeading || "").toBe("");
    expect(saved.idealFor ?? []).toEqual([]);
    const storefront = (await getProductBySlug(p.slug))!;
    expect(storefront.idealForHeading).toBe("");
    expect(storefront.idealFor).toEqual([]);
  });

  it("an update changes the heading and items, and clearing them clears them", async () => {
    const p = await create({ idealForHeading: "Ideal for", idealFor: "treks" });
    expect((await update(p._id, { idealForHeading: "Carry it on", idealFor: "day hikes, flights" })).status).toBe(200);
    expect(await Product.findById(p._id).lean()).toMatchObject({ idealForHeading: "Carry it on", idealFor: ["day hikes", "flights"] });

    expect((await update(p._id, { idealForHeading: "", idealFor: "" })).status).toBe(200);
    const cleared = (await Product.findById(p._id).lean())!;
    expect(cleared.idealForHeading).toBe("");
    expect(cleared.idealFor).toEqual([]);
  });

  it("an update that does not send the fields (an older admin tab) keeps them", async () => {
    const p = await create({ idealForHeading: "Wear it on", idealFor: "treks" });
    const form = buildProductFormData(base, { newFiles: [], removedImageIds: [], imageOrder: [], coverImageId: "" });
    form.delete("idealForHeading");
    form.delete("idealFor");
    expect((await adminCall(productById.PUT, { method: "PUT", form }, { id: p._id })).status).toBe(200);
    expect(await Product.findById(p._id).lean()).toMatchObject({ idealForHeading: "Wear it on", idealFor: ["treks"] });
  });

  it("rejects an over-long heading, item or list, and saves nothing", async () => {
    for (const over of [
      { idealForHeading: "x".repeat(41) },
      { idealFor: "y".repeat(61) },
      { idealFor: Array.from({ length: 21 }, (_, i) => `item${i}`).join(",") },
    ]) {
      const res = await adminCall(products.POST, { form: buildProductFormData({ ...base, ...over }, noImages) });
      expect(res.status, JSON.stringify(over).slice(0, 30)).toBe(400);
    }
    expect(await Product.countDocuments()).toBe(0);
    expect(cloudinaryCalls.uploads).toHaveLength(0); // validated before any upload
  });
});
