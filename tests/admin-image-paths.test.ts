import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDb } from "./helpers/mongo";
import { cloudinaryCalls } from "./helpers/cloudinary";
import { adminCall, formOf, pngFile } from "./helpers/admin";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("cloudinary", async () => (await import("./helpers/cloudinary")).cloudinaryModuleMock());

import { Category } from "@/models/category.model";
import { Blog } from "@/models/blog.model";
import Carousel from "@/models/carousel.model";
import About from "@/models/about.model";
import Settings from "@/models/settings.model";
import * as categories from "@/app/api/admin/categories/route";
import * as categoryById from "@/app/api/admin/categories/[id]/route";
import * as blogs from "@/app/api/admin/blogs/route";
import * as blogById from "@/app/api/admin/blogs/[id]/route";
import * as carousel from "@/app/api/admin/carousel/route";
import * as carouselById from "@/app/api/admin/carousel/[id]/route";
import * as about from "@/app/api/admin/about/route";
import * as sizeChart from "@/app/api/admin/size-chart/route";
import * as upload from "@/app/api/admin/upload/route";
import * as ordersList from "@/app/api/admin/orders/route";
import { Order } from "@/models/order.model";
import { Product } from "@/models/product.model";
import { buildBlogFormData } from "@/lib/admin-api/blog-form-data";

setupTestDb();

const url = (id: string) => `https://res.cloudinary.com/test-cloud/image/upload/${id}.jpg`;
beforeEach(() => {
  cloudinaryCalls.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

/** Records what the database looked like at the moment each file was deleted. */
function snapshotAtDelete<T>(read: () => Promise<T>) {
  const seen: T[] = [];
  cloudinaryCalls.onDestroy = async () => { seen.push(await read()); };
  return seen;
}

describe("categories", () => {
  const make = (extra: Record<string, unknown> = {}) =>
    Category.create({ name: "Tees", slug: "tees", image: { url: url("c/old"), publicId: "c/old", alt: "" }, ...extra });

  it("create: uploads, saves; a failed save deletes the upload", async () => {
    const ok = await adminCall(categories.POST, { form: formOf({ name: "Hoodies" }, { images: pngFile() }) });
    expect(ok.status).toBe(201);
    expect((await ok.json()).category.image.publicId).toBe(cloudinaryCalls.uploads[0].publicId);

    cloudinaryCalls.reset();
    vi.spyOn(Category, "create").mockRejectedValueOnce(new Error("db down") as never);
    const bad = await adminCall(categories.POST, { form: formOf({ name: "Caps" }, { images: pngFile() }) });
    expect(bad.status).toBe(500);
    expect(cloudinaryCalls.destroys).toEqual([cloudinaryCalls.uploads[0].publicId]);
  });

  it("create: validation happens before the upload", async () => {
    const res = await adminCall(categories.POST, { form: formOf({ name: "" }, { images: pngFile() }) });
    expect(res.status).toBe(400);
    expect(cloudinaryCalls.uploads).toHaveLength(0);
  });

  it("replace: deletes exactly the old image, after the save", async () => {
    const c = await make();
    const seen = snapshotAtDelete(async () => (await Category.findById(c._id))!.image?.publicId);
    const res = await adminCall(categoryById.PUT, { method: "PUT", form: formOf({ name: "Tees" }, { images: pngFile() }) }, { id: String(c._id) });
    expect(res.status).toBe(200);
    const newId = cloudinaryCalls.uploads[0].publicId;
    expect(cloudinaryCalls.destroys).toEqual(["c/old"]);
    expect(seen).toEqual([newId]); // the database already pointed at the new image
    expect((await Category.findById(c._id))!.image!.publicId).toBe(newId);
  });

  it("replace with a failing save: the new upload is deleted, the old image stays", async () => {
    const c = await make();
    vi.spyOn(Category.prototype, "save").mockRejectedValueOnce(new Error("db down"));
    const res = await adminCall(categoryById.PUT, { method: "PUT", form: formOf({ name: "Tees" }, { images: pngFile() }) }, { id: String(c._id) });
    expect(res.status).toBe(500);
    expect(cloudinaryCalls.destroys).toEqual([cloudinaryCalls.uploads[0].publicId]);
    expect((await Category.findById(c._id))!.image!.publicId).toBe("c/old");
  });

  it("remove: deletes the image only when the id is the category's own", async () => {
    const c = await make();
    const other = await adminCall(categoryById.PUT, { method: "PUT", form: formOf({ name: "Tees", removedImageId: "someone/else" }) }, { id: String(c._id) });
    expect(other.status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual([]);
    expect((await Category.findById(c._id))!.image!.publicId).toBe("c/old");

    const own = await adminCall(categoryById.PUT, { method: "PUT", form: formOf({ name: "Tees", removedImageId: "c/old" }) }, { id: String(c._id) });
    expect(own.status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual(["c/old"]);
    expect((await Category.findById(c._id))!.image?.publicId ?? "").toBe("");
  });

  it("delete: document first, then the image", async () => {
    const c = await make();
    const seen = snapshotAtDelete(async () => !!(await Category.findById(c._id)));
    expect((await adminCall(categoryById.DELETE, { method: "DELETE" }, { id: String(c._id) })).status).toBe(200);
    expect(seen).toEqual([false]);
    expect(cloudinaryCalls.destroys).toEqual(["c/old"]);
  });
});

describe("blog cover", () => {
  const values = { title: "Trail notes", excerpt: "Short", content: "<p>Body text</p>", category: "Tips", author: "Asha", isPublished: true, tagsInput: "a, b", coverFile: null as File | null, coverAlt: "" };
  const make = (extra: Record<string, unknown> = {}) =>
    Blog.create({ title: "Old", slug: "old", excerpt: "e", content: "c", category: "Tips", coverImage: { url: url("b/old"), publicId: "b/old", alt: "" }, ...extra });

  it("create with the form's real shape; failed save deletes the cover", async () => {
    const ok = await adminCall(blogs.POST, { form: buildBlogFormData({ ...values, coverFile: pngFile() }) });
    expect(ok.status).toBe(201);
    expect((await ok.json()).blog.tags).toEqual(["a", "b"]);

    cloudinaryCalls.reset();
    vi.spyOn(Blog, "create").mockRejectedValueOnce(new Error("db down") as never);
    const bad = await adminCall(blogs.POST, { form: buildBlogFormData({ ...values, title: "Other", coverFile: pngFile() }) });
    expect(bad.status).toBe(500);
    expect(cloudinaryCalls.destroys).toEqual([cloudinaryCalls.uploads[0].publicId]);
  });

  it("create: validation before upload; broken tags are a 400", async () => {
    const res = await adminCall(blogs.POST, { form: buildBlogFormData({ ...values, title: "", coverFile: pngFile() }) });
    expect(res.status).toBe(400);
    expect(cloudinaryCalls.uploads).toHaveLength(0);
    const form = buildBlogFormData(values);
    form.set("tags", "[oops");
    expect((await adminCall(blogs.POST, { form })).status).toBe(400);
  });

  it("replace: new cover uploaded, saved, then exactly the old one deleted", async () => {
    const b = await make();
    const seen = snapshotAtDelete(async () => (await Blog.findById(b._id))!.coverImage.publicId);
    const res = await adminCall(blogById.PUT, { method: "PUT", form: buildBlogFormData({ ...values, coverFile: pngFile() }) }, { id: String(b._id) });
    expect(res.status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual(["b/old"]);
    expect(seen).toEqual([cloudinaryCalls.uploads[0].publicId]);
  });

  it("remove cover (the edit page's remove button) deletes the file and clears the cover", async () => {
    const b = await make();
    const res = await adminCall(blogById.PUT, { method: "PUT", form: buildBlogFormData({ ...values, removeCover: true }) }, { id: String(b._id) });
    expect(res.status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual(["b/old"]);
    expect((await Blog.findById(b._id))!.coverImage.publicId).toBe("");
  });

  it("saving without touching the cover keeps it", async () => {
    const b = await make();
    const res = await adminCall(blogById.PUT, { method: "PUT", form: buildBlogFormData({ ...values, coverAlt: "new alt" }) }, { id: String(b._id) });
    expect(res.status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual([]);
    const saved = (await Blog.findById(b._id))!;
    expect(saved.coverImage.publicId).toBe("b/old");
    expect(saved.coverImage.alt).toBe("new alt");
  });

  it("failed save with a new cover: upload deleted, old cover kept", async () => {
    const b = await make();
    vi.spyOn(Blog.prototype, "save").mockRejectedValueOnce(new Error("db down"));
    const res = await adminCall(blogById.PUT, { method: "PUT", form: buildBlogFormData({ ...values, coverFile: pngFile() }) }, { id: String(b._id) });
    expect(res.status).toBe(500);
    expect(cloudinaryCalls.destroys).toEqual([cloudinaryCalls.uploads[0].publicId]);
    expect((await Blog.findById(b._id))!.coverImage.publicId).toBe("b/old");
  });

  it("delete: document first, then the cover", async () => {
    const b = await make();
    const seen = snapshotAtDelete(async () => !!(await Blog.findById(b._id)));
    expect((await adminCall(blogById.DELETE, { method: "DELETE" }, { id: String(b._id) })).status).toBe(200);
    expect(seen).toEqual([false]);
    expect(cloudinaryCalls.destroys).toEqual(["b/old"]);
  });
});

describe("carousel", () => {
  const make = () => Carousel.create({ url: url("car/old"), publicId: "car/old", alt: "old", order: 3 });

  it("create: upload then save; failed save deletes the upload", async () => {
    const ok = await adminCall(carousel.POST, { form: formOf({ altText: "Hero", isActive: "true" }, { image: pngFile() }) });
    expect(ok.status).toBe(201);
    expect((await ok.json()).image.alt).toBe("Hero");

    cloudinaryCalls.reset();
    vi.spyOn(Carousel, "create").mockRejectedValueOnce(new Error("db down") as never);
    const bad = await adminCall(carousel.POST, { form: formOf({ altText: "x" }, { image: pngFile() }) });
    expect(bad.status).toBe(500);
    expect(cloudinaryCalls.destroys).toEqual([cloudinaryCalls.uploads[0].publicId]);
  });

  it("update takes only alt, isActive and order, never the url or the Cloudinary id", async () => {
    const c = await make();
    const res = await adminCall(carouselById.PUT, {
      method: "PUT",
      json: { alt: "new", isActive: false, order: 7, url: "https://evil.example/x.jpg", publicId: "someone/elses", _id: "000000000000000000000001" },
    }, { id: String(c._id) });
    expect(res.status).toBe(200);
    const saved = (await Carousel.findById(c._id))!;
    expect([saved.alt, saved.isActive, saved.order]).toEqual(["new", false, 7]);
    expect(saved.publicId).toBe("car/old");
    expect(saved.url).toBe(url("car/old"));
    expect(cloudinaryCalls.destroys).toEqual([]);
  });

  it("bad values are a 400 with the field named; broken JSON too", async () => {
    const c = await make();
    const res = await adminCall(carouselById.PUT, { method: "PUT", json: { order: -4, isActive: "yes" } }, { id: String(c._id) });
    expect(res.status).toBe(400);
    expect(Object.keys((await res.json()).errors).sort()).toEqual(["isActive", "order"]);
    expect((await adminCall(carouselById.PUT, { method: "PUT", rawBody: "{oops" }, { id: String(c._id) })).status).toBe(400);
  });

  it("replace image: new upload saved first, old file deleted after; failed save keeps the old file", async () => {
    const c = await make();
    const seen = snapshotAtDelete(async () => (await Carousel.findById(c._id))!.publicId);
    const ok = await adminCall(carouselById.PUT, { method: "PUT", form: formOf({ alt: "x" }, { image: pngFile() }) }, { id: String(c._id) });
    expect(ok.status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual(["car/old"]);
    expect(seen).toEqual([cloudinaryCalls.uploads[0].publicId]);

    cloudinaryCalls.reset();
    const d = await make();
    vi.spyOn(Carousel.prototype, "save").mockRejectedValueOnce(new Error("db down"));
    const bad = await adminCall(carouselById.PUT, { method: "PUT", form: formOf({ alt: "x" }, { image: pngFile() }) }, { id: String(d._id) });
    expect(bad.status).toBe(500);
    expect(cloudinaryCalls.destroys).toEqual([cloudinaryCalls.uploads[0].publicId]);
    expect((await Carousel.findById(d._id))!.publicId).toBe("car/old");
  });

  it("delete: document first, then the file", async () => {
    const c = await make();
    const seen = snapshotAtDelete(async () => !!(await Carousel.findById(c._id)));
    expect((await adminCall(carouselById.DELETE, { method: "DELETE" }, { id: String(c._id) })).status).toBe(200);
    expect(seen).toEqual([false]);
    expect(cloudinaryCalls.destroys).toEqual(["car/old"]);
  });
});

describe("about page images", () => {
  const imageDoc = () => ({
    story: { heading: "Story", body: "<p>x</p>", image: { url: url("a/story"), publicId: "a/story", alt: "" } },
    gallery: { isVisible: true, images: [
      { url: url("a/g1"), publicId: "a/g1", alt: "" },
      { url: url("a/g2"), publicId: "a/g2", alt: "" },
      { url: url("a/g3"), publicId: "a/g3", alt: "" },
    ] },
    customSections: [{ type: "image-text-split", heading: "S", body: "b", imageUrl: url("a/sec"), imagePublicId: "a/sec", imageAlt: "", imageAlignment: "left", order: 0 }],
    teamPhoto: { url: url("a/team"), publicId: "a/team", alt: "" },
  });
  const save = (json: unknown) => adminCall(about.PUT, { method: "PUT", json });

  it("replacing the story photo, a gallery photo and a section photo deletes exactly those old files after the save", async () => {
    await About.create(imageDoc());
    const seen = snapshotAtDelete(async () => {
      const doc = (await About.findOne().lean())!;
      return [doc.story!.image!.publicId, ...doc.gallery!.images!.map((i: { publicId?: string }) => i.publicId), doc.customSections![0].imagePublicId].join(",");
    });
    const next = imageDoc();
    next.story.image = { url: url("a/story2"), publicId: "a/story2", alt: "" };
    next.gallery.images = [next.gallery.images[0], { url: url("a/g2b"), publicId: "a/g2b", alt: "" }]; // g2 replaced, g3 removed
    next.customSections[0] = { ...next.customSections[0], imageUrl: url("a/sec2"), imagePublicId: "a/sec2" };
    const { teamPhoto: _keep, ...payload } = next;
    void _keep;
    const res = await save(payload);
    expect(res.status).toBe(200);
    expect(cloudinaryCalls.destroys.sort()).toEqual(["a/g2", "a/g3", "a/sec", "a/story"]);
    // every deletion happened after the new state was saved
    expect(new Set(seen)).toEqual(new Set(["a/story2,a/g1,a/g2b,a/sec2"]));
  });

  it("removing the story photo and a whole section deletes their files; unchanged photos are kept", async () => {
    await About.create(imageDoc());
    const next = imageDoc();
    next.story.image = { url: "", publicId: "", alt: "" };
    next.customSections = [];
    const { teamPhoto: _keep, ...payload } = next;
    void _keep;
    expect((await save(payload)).status).toBe(200);
    expect(cloudinaryCalls.destroys.sort()).toEqual(["a/sec", "a/story"]);
  });

  it("a section of the page that is not sent is left alone (and its files kept)", async () => {
    await About.create(imageDoc());
    const res = await save({ hero: { headline: "Hello" } });
    expect(res.status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual([]);
    const doc = (await About.findOne().lean())!;
    expect(doc.hero!.headline).toBe("Hello");
    expect(doc.gallery!.images).toHaveLength(3);
  });

  it("saves only validated data: bad web addresses and unknown keys", async () => {
    const bad = await save({ story: { image: { url: "javascript:alert(1)" } } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).errors["story.image.url"]).toBeTruthy();
    const ok = await save({ hero: { headline: "Hi" }, evil: { x: 1 }, _id: "000000000000000000000009" });
    expect(ok.status).toBe(200);
    expect(((await About.findOne().lean()) as Record<string, unknown>).evil).toBeUndefined();
    expect((await save("not an object")).status).toBe(400);
  });

  it("legacy team photo upload: old file deleted after the save, new upload deleted when the save fails", async () => {
    await About.create(imageDoc());
    const ok = await adminCall(about.PUT, { method: "PUT", form: formOf({ teamPhotoAlt: "team" }, { image: pngFile() }) });
    expect(ok.status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual(["a/team"]);

    cloudinaryCalls.reset();
    vi.spyOn(About, "findOneAndUpdate").mockRejectedValueOnce(new Error("db down") as never);
    const bad = await adminCall(about.PUT, { method: "PUT", form: formOf({}, { image: pngFile() }) });
    expect(bad.status).toBe(500);
    expect(cloudinaryCalls.destroys).toEqual([cloudinaryCalls.uploads[0].publicId]);
  });
});

describe("size chart", () => {
  it("replace: saved first, then the old chart is deleted; failed save keeps the old one", async () => {
    await Settings.create({ sizeChart: { url: url("sc/old"), publicId: "sc/old" } });
    const seen = snapshotAtDelete(async () => (await Settings.findOne().lean())!.sizeChart!.publicId);
    const ok = await adminCall(sizeChart.PUT, { method: "PUT", form: formOf({}, { image: pngFile() }) });
    expect(ok.status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual(["sc/old"]);
    expect(seen).toEqual([cloudinaryCalls.uploads[0].publicId]);

    cloudinaryCalls.reset();
    vi.spyOn(Settings, "findOneAndUpdate").mockRejectedValueOnce(new Error("db down") as never);
    const bad = await adminCall(sizeChart.PUT, { method: "PUT", form: formOf({}, { image: pngFile() }) });
    expect(bad.status).toBe(500);
    expect(cloudinaryCalls.destroys).toEqual([cloudinaryCalls.uploads[0].publicId]);
  });

  it("delete: the database is cleared first, then the file", async () => {
    await Settings.create({ sizeChart: { url: url("sc/old"), publicId: "sc/old" } });
    const seen = snapshotAtDelete(async () => (await Settings.findOne().lean())!.sizeChart!.publicId);
    expect((await adminCall(sizeChart.DELETE, { method: "DELETE" })).status).toBe(200);
    expect(seen).toEqual([""]);
    expect(cloudinaryCalls.destroys).toEqual(["sc/old"]);
  });
});

describe("upload endpoint", () => {
  it("only known upload contexts are accepted", async () => {
    const ok = await adminCall(upload.POST, { form: formOf({ context: "about" }, { file: pngFile() }) });
    expect(ok.status).toBe(201);
    expect(cloudinaryCalls.uploads[0].options.folder).toBe("indian-mist/about");
    const bad = await adminCall(upload.POST, { form: formOf({ context: "../../escape" }, { file: pngFile() }) });
    expect(bad.status).toBe(400);
  });

  it("discard deletes an unused uploaded file, but never one that is in use or outside this app's folder", async () => {
    await Carousel.create({ url: url("indian-mist/carousel/in-use"), publicId: "indian-mist/carousel/in-use" });
    const inUse = await adminCall(upload.DELETE, { method: "DELETE", json: { publicId: "indian-mist/carousel/in-use" } });
    expect(inUse.status).toBe(409);
    const outside = await adminCall(upload.DELETE, { method: "DELETE", json: { publicId: "someone-else/photo" } });
    expect(outside.status).toBe(400);
    expect(cloudinaryCalls.destroys).toEqual([]);

    const ok = await adminCall(upload.DELETE, { method: "DELETE", json: { publicId: "indian-mist/about/unsaved" } });
    expect(ok.status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual(["indian-mist/about/unsaved"]);

    expect((await adminCall(upload.DELETE, { method: "DELETE", json: {} })).status).toBe(400);
  });
});

describe("a reference check protects images used by documents", () => {
  it("is aware of every place an image can be stored", async () => {
    const { isAssetReferenced } = await import("@/lib/image-assets");
    expect(await isAssetReferenced("x/1")).toBe(false);
    await mongoose.connection.collection("settings_probe").insertOne({});
    await Settings.create({ brandStorySettings: { imagePublicId: "x/brand" } });
    await Settings.updateOne({}, { $set: { "sizeChart.publicId": "x/chart" } });
    await About.create({ customSections: [{ imagePublicId: "x/section" }], teamPhoto: { publicId: "x/team" } });
    for (const id of ["x/brand", "x/chart", "x/section", "x/team"]) expect(await isAssetReferenced(id), id).toBe(true);
  });
});

describe("old orders", () => {
  it("each order line also carries the product's current photo, for when the photo it was placed with is gone", async () => {
    const product = await Product.create({
      name: "Tee", slug: "tee", description: "d", category: "tees", price: 100,
      images: [{ url: url("p/current"), publicId: "p/current", isPrimary: true }], colorName: "Olive", colorHex: "#556b2f",
    });
    await Order.create({
      userId: new mongoose.Types.ObjectId(), status: "PROCESSING", paymentStatus: "PAID", totalAmount: 100,
      items: [
        { productId: product._id, name: "Tee", quantity: 1, priceAtPurchase: 100, image: url("p/deleted-long-ago") },
        { productId: new mongoose.Types.ObjectId(), name: "Gone product", quantity: 1, priceAtPurchase: 5, image: url("p/also-gone") },
      ],
      customerName: "A", email: "a@b.c", phone: "9999999999",
      shippingAddress: { street: "s", city: "c", state: "st", zipCode: "123456", country: "India" },
    });
    const res = await adminCall(ordersList.GET, { method: "GET" });
    expect(res.status).toBe(200);
    const [order] = (await res.json()).orders;
    expect(order.items[0]).toMatchObject({ image: url("p/deleted-long-ago"), currentImage: url("p/current"), selectedColor: "Olive" });
    expect(order.items[1].currentImage).toBeUndefined(); // product deleted: the page falls back to the placeholder
  });
});
