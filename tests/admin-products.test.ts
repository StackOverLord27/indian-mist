import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDb } from "./helpers/mongo";
import { cloudinaryCalls } from "./helpers/cloudinary";
import { adminCall, formOf, pngFile } from "./helpers/admin";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("cloudinary", async () => (await import("./helpers/cloudinary")).cloudinaryModuleMock());

import { Product } from "@/models/product.model";
import * as products from "@/app/api/admin/products/route";
import * as productById from "@/app/api/admin/products/[id]/route";
import { buildProductFormData, type ProductFormValues } from "@/lib/admin-api/product-form-data";

setupTestDb();

const img = (publicId: string, isPrimary = false) => ({ url: `https://res.cloudinary.com/test-cloud/image/upload/${publicId}.jpg`, publicId, alt: "", isPrimary });

async function makeProduct(slug: string, ids: string[], extra: Record<string, unknown> = {}) {
  return Product.create({
    name: slug, slug, description: "A fine product", category: "tees", price: 100,
    images: ids.map((id, i) => img(id, i === 0)),
    categoryCoverImage: img(ids[0]).url,
    ...extra,
  });
}
const publicIds = async (id: string) => (await Product.findById(id))!.images.map((i) => i.publicId);

const values: ProductFormValues = {
  name: "Olive Tee", category: "tees", price: 499, description: "Soft organic cotton tee", isFeatured: false,
  trackInventory: false, stockQuantity: 0, features: [""], tags: "", materials: [""], careInstructions: [{ text: "", icon: "droplets" }],
};
const noImages = { newFiles: [], removedImageIds: [], imageOrder: [], coverImageId: "" };

beforeEach(() => {
  cloudinaryCalls.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("product update: image lifecycle", () => {
  it("deletes only images that belong to the product, and only after the product is saved", async () => {
    const a = await makeProduct("a", ["p/a1", "p/a2", "p/a3"]);
    await makeProduct("other", ["p/other1"]);

    const seenAtDelete: string[][] = [];
    cloudinaryCalls.onDestroy = async () => { seenAtDelete.push(await publicIds(String(a._id))); };

    const form = buildProductFormData(values, { ...noImages, removedImageIds: ["p/a1", "p/other1", "p/nonexistent"] });
    const res = await adminCall(productById.PUT, { method: "PUT", form }, { id: String(a._id) });
    expect(res.status).toBe(200);

    expect(cloudinaryCalls.destroys).toEqual(["p/a1"]); // not the other product's image, not the unknown id
    expect(await publicIds(String(a._id))).toEqual(["p/a2", "p/a3"]);
    // at the moment the file was deleted, the database already no longer referenced it
    expect(seenAtDelete).toEqual([["p/a2", "p/a3"]]);
    expect(cloudinaryCalls.destroyOptions[0]).toMatchObject({ invalidate: true });
    expect(await publicIds(String((await Product.findOne({ slug: "other" }))!._id))).toEqual(["p/other1"]);
  });

  it("when the save fails, new uploads are deleted and every old image is kept", async () => {
    const p = await makeProduct("p", ["p/1", "p/2"]);
    vi.spyOn(Product.prototype, "save").mockRejectedValueOnce(new Error("db down"));

    const form = buildProductFormData(values, { ...noImages, newFiles: [pngFile(), pngFile("b.png")], removedImageIds: ["p/1"] });
    const res = await adminCall(productById.PUT, { method: "PUT", form }, { id: String(p._id) });
    expect(res.status).toBe(500);

    expect(cloudinaryCalls.uploads).toHaveLength(2);
    expect(cloudinaryCalls.destroys.sort()).toEqual(cloudinaryCalls.uploads.map((u) => u.publicId).sort());
    expect(cloudinaryCalls.destroys).not.toContain("p/1"); // the image being removed was NOT touched
    expect(await publicIds(String(p._id))).toEqual(["p/1", "p/2"]);
  });

  it("refuses to leave a product without images, before touching Cloudinary", async () => {
    const p = await makeProduct("p", ["p/1", "p/2"]);
    const form = buildProductFormData(values, { ...noImages, removedImageIds: ["p/1", "p/2"] });
    const res = await adminCall(productById.PUT, { method: "PUT", form }, { id: String(p._id) });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/at least one image/i);
    expect(cloudinaryCalls.uploads).toHaveLength(0);
    expect(cloudinaryCalls.destroys).toHaveLength(0);
    expect(await publicIds(String(p._id))).toEqual(["p/1", "p/2"]);
  });

  it("removing every image is fine when a new one is added in the same request", async () => {
    const p = await makeProduct("p", ["p/1"]);
    const form = buildProductFormData(values, { ...noImages, newFiles: [pngFile()], removedImageIds: ["p/1"] });
    const res = await adminCall(productById.PUT, { method: "PUT", form }, { id: String(p._id) });
    expect(res.status).toBe(200);
    const ids = await publicIds(String(p._id));
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe("p/1");
    expect(cloudinaryCalls.destroys).toEqual(["p/1"]);
    const saved = (await Product.findById(p._id))!;
    expect(saved.images[0].isPrimary).toBe(true);
  });

  it("validates fields before uploading anything", async () => {
    const p = await makeProduct("p", ["p/1"]);
    const form = buildProductFormData({ ...values, price: -5 }, { ...noImages, newFiles: [pngFile()] });
    const res = await adminCall(productById.PUT, { method: "PUT", form }, { id: String(p._id) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("Validation failed");
    expect(body.errors.price).toBeTruthy();
    expect(cloudinaryCalls.uploads).toHaveLength(0);
  });

  it("a bad file is rejected before anything is uploaded", async () => {
    const p = await makeProduct("p", ["p/1"]);
    const text = new File(["not an image"], "x.png", { type: "image/png" });
    const form = buildProductFormData(values, { ...noImages, newFiles: [pngFile(), text] });
    const res = await adminCall(productById.PUT, { method: "PUT", form }, { id: String(p._id) });
    expect(res.status).toBe(400);
    expect(cloudinaryCalls.uploads).toHaveLength(0);
  });

  it("a failed upload in the middle deletes the ones already uploaded and keeps the old images", async () => {
    const p = await makeProduct("p", ["p/1"]);
    cloudinaryCalls.failUploadNumber = 2;
    const form = buildProductFormData(values, { ...noImages, newFiles: [pngFile(), pngFile("b.png"), pngFile("c.png")], removedImageIds: ["p/1"] });
    const res = await adminCall(productById.PUT, { method: "PUT", form }, { id: String(p._id) });
    expect(res.status).toBe(500);
    expect(cloudinaryCalls.uploads).toHaveLength(1);
    expect(cloudinaryCalls.destroys).toEqual([cloudinaryCalls.uploads[0].publicId]);
    expect(await publicIds(String(p._id))).toEqual(["p/1"]);
  });

  it("a Cloudinary delete failure after the save does not fail the save", async () => {
    const p = await makeProduct("p", ["p/1", "p/2"]);
    cloudinaryCalls.failDestroyIds.add("p/1");
    const form = buildProductFormData(values, { ...noImages, removedImageIds: ["p/1"] });
    const res = await adminCall(productById.PUT, { method: "PUT", form }, { id: String(p._id) });
    expect(res.status).toBe(200);
    expect(await publicIds(String(p._id))).toEqual(["p/2"]);
  });

  it("order, primary image and category cover follow the form (the field names match)", async () => {
    const p = await makeProduct("p", ["p/1", "p/2", "p/3"]);
    const form = buildProductFormData(values, { ...noImages, imageOrder: ["p/3", "p/1", "p/2"], coverImageId: "p/2" });
    const res = await adminCall(productById.PUT, { method: "PUT", form }, { id: String(p._id) });
    expect(res.status).toBe(200);
    const saved = (await Product.findById(p._id))!;
    expect(saved.images.map((i) => i.publicId)).toEqual(["p/3", "p/1", "p/2"]);
    expect(saved.images.map((i) => i.isPrimary)).toEqual([true, false, false]);
    expect(saved.categoryCoverImage).toBe(img("p/2").url);
  });

  it("removing the image used as category cover moves the cover to the primary image", async () => {
    const p = await makeProduct("p", ["p/1", "p/2"]); // cover = p/1
    const form = buildProductFormData(values, { ...noImages, removedImageIds: ["p/1"], imageOrder: ["p/2"] });
    const res = await adminCall(productById.PUT, { method: "PUT", form }, { id: String(p._id) });
    expect(res.status).toBe(200);
    const saved = (await Product.findById(p._id))!;
    expect(saved.categoryCoverImage).toBe(img("p/2").url);
    expect(saved.images[0].isPrimary).toBe(true);
  });

  it("ignores ids in imageOrder/primary/cover that are not on the product", async () => {
    const p = await makeProduct("p", ["p/1", "p/2"]);
    const form = buildProductFormData(values, { ...noImages, imageOrder: ["x/9", "p/2", "p/1"], coverImageId: "x/9" });
    const res = await adminCall(productById.PUT, { method: "PUT", form }, { id: String(p._id) });
    expect(res.status).toBe(200);
    const saved = (await Product.findById(p._id))!;
    expect(saved.images.map((i) => i.publicId)).toEqual(["p/2", "p/1"]);
    expect(saved.categoryCoverImage).toBe(img("p/1").url); // unchanged
  });

  it("clears the badge and the original price when the form clears them", async () => {
    const p = await makeProduct("p", ["p/1"], { badge: "Sale", originalPrice: 900 });
    const form = buildProductFormData({ ...values, badge: "", originalPrice: 0 }, noImages);
    expect((await adminCall(productById.PUT, { method: "PUT", form }, { id: String(p._id) })).status).toBe(200);
    const saved = (await Product.findById(p._id))!;
    expect(saved.badge).toBe("");
    expect(saved.originalPrice).toBeUndefined();
  });

  it("keeps size stock, colour group and the slug behaviours", async () => {
    const p = await makeProduct("old-slug", ["p/1"]);
    const form = buildProductFormData(
      { ...values, name: "Renamed Tee", sizes: ["S", "M"], trackInventory: true, sizeStock: { S: 3, M: 4 }, colorName: "Olive", colorHex: "#556b2f" },
      noImages,
    );
    expect((await adminCall(productById.PUT, { method: "PUT", form }, { id: String(p._id) })).status).toBe(200);
    const saved = (await Product.findById(p._id))!;
    expect(saved.slug).toBe("old-slug"); // slug left alone on edit
    expect(saved.sizeStock!.map((s) => [s.size, s.quantity])).toEqual([["S", 3], ["M", 4]]);
    expect(saved.stockQuantity).toBe(7);
    expect(saved.colorGroup).toBe("renamed-tee"); // a colour with no group joins the group named after the product
  });

  it("rejects broken JSON fields instead of silently resetting them, and bad ids", async () => {
    const p = await makeProduct("p", ["p/1"]);
    const form = buildProductFormData(values, noImages);
    form.set("sizes", "{not json");
    const res = await adminCall(productById.PUT, { method: "PUT", form }, { id: String(p._id) });
    expect(res.status).toBe(400);
    expect((await adminCall(productById.PUT, { method: "PUT", form: buildProductFormData(values, noImages) }, { id: "nope" })).status).toBe(404);
    const removeJunk = buildProductFormData(values, noImages);
    removeJunk.set("removedImageIds", '{"a":1}');
    expect((await adminCall(productById.PUT, { method: "PUT", form: removeJunk }, { id: String(p._id) })).status).toBe(400);
  });
});

describe("product create", () => {
  const files = (n: number) => Array.from({ length: n }, (_, i) => pngFile(`f${i}.png`));

  it("creates with the form's real request shape", async () => {
    const form = buildProductFormData(values, { ...noImages, newFiles: files(2) });
    const res = await adminCall(products.POST, { form });
    expect(res.status).toBe(201);
    const product = (await res.json()).product;
    expect(product.slug).toBe("olive-tee");
    expect(product.images).toHaveLength(2);
    expect(product.images[0].isPrimary).toBe(true);
    expect(product.categoryCoverImage).toBe(product.images[0].url);
    expect(cloudinaryCalls.destroys).toHaveLength(0);
  });

  it("validates before uploading anything", async () => {
    const res = await adminCall(products.POST, { form: buildProductFormData({ ...values, name: "", price: 0 }, { ...noImages, newFiles: files(2) }) });
    expect(res.status).toBe(400);
    expect(cloudinaryCalls.uploads).toHaveLength(0);
    expect(await Product.countDocuments()).toBe(0);
  });

  it("needs at least one image", async () => {
    const res = await adminCall(products.POST, { form: buildProductFormData(values, noImages) });
    expect(res.status).toBe(400);
    expect(await Product.countDocuments()).toBe(0);
  });

  it("deletes the uploads again when saving fails", async () => {
    vi.spyOn(Product, "create").mockRejectedValueOnce(new Error("db down") as never);
    const res = await adminCall(products.POST, { form: buildProductFormData(values, { ...noImages, newFiles: files(3) }) });
    expect(res.status).toBe(500);
    expect(cloudinaryCalls.uploads).toHaveLength(3);
    expect(cloudinaryCalls.destroys.sort()).toEqual(cloudinaryCalls.uploads.map((u) => u.publicId).sort());
    expect(await Product.countDocuments()).toBe(0);
  });

  it("retries with the next free slug when two admins pick the same one, without deleting the uploads", async () => {
    const real = Product.create.bind(Product);
    const spy = vi.spyOn(Product, "create");
    spy.mockImplementationOnce((async () => {
      throw Object.assign(new Error("E11000"), { code: 11000, keyPattern: { slug: 1 } });
    }) as never);
    spy.mockImplementation(real as never);
    const res = await adminCall(products.POST, { form: buildProductFormData(values, { ...noImages, newFiles: files(1) }) });
    expect(res.status).toBe(201);
    expect(cloudinaryCalls.destroys).toHaveLength(0);
    expect(await Product.countDocuments()).toBe(1);
  });

  it("two creates with the same name get different slugs", async () => {
    await adminCall(products.POST, { form: buildProductFormData(values, { ...noImages, newFiles: files(1) }) });
    const second = await adminCall(products.POST, { form: buildProductFormData(values, { ...noImages, newFiles: files(1) }) });
    expect(second.status).toBe(201);
    expect((await second.json()).product.slug).toBe("olive-tee-2");
  });
});

describe("product delete", () => {
  it("removes the document first, then its images", async () => {
    const p = await makeProduct("p", ["p/1", "p/2"]);
    const docExistsAtDelete: boolean[] = [];
    cloudinaryCalls.onDestroy = async () => { docExistsAtDelete.push(!!(await Product.findById(p._id))); };
    const res = await adminCall(productById.DELETE, { method: "DELETE" }, { id: String(p._id) });
    expect(res.status).toBe(200);
    expect(docExistsAtDelete).toEqual([false, false]);
    expect(cloudinaryCalls.destroys.sort()).toEqual(["p/1", "p/2"]);
  });

  it("keeps the images when the document delete fails", async () => {
    const p = await makeProduct("p", ["p/1"]);
    vi.spyOn(Product.prototype, "deleteOne").mockRejectedValueOnce(new Error("db down") as never);
    const res = await adminCall(productById.DELETE, { method: "DELETE" }, { id: String(p._id) });
    expect(res.status).toBe(500);
    expect(cloudinaryCalls.destroys).toHaveLength(0);
    expect(await Product.countDocuments()).toBe(1);
  });
});

describe("bad requests are 400s with a readable message", () => {
  it("a body that is not a form", async () => {
    const res = await adminCall(products.POST, { rawBody: "{}", contentType: "application/json" });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBeTruthy();
  });

  it("non-admins are refused", async () => {
    const res = await adminCall(products.POST, { form: formOf({ name: "x" }), role: "user" });
    expect(res.status).toBe(403);
  });
});
