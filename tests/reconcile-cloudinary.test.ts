import { describe, expect, it } from "vitest";
import { collectReferencedIds, findOrphans, publicIdFromUrl, deleteRefusal } from "../scripts/reconcile-cloudinary-lib.mjs";

const url = (id: string) => `https://res.cloudinary.com/some-cloud/image/upload/v123/${id}.jpg`;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600 * 1000).toISOString();
const asset = (public_id: string, ageHours: number) => ({ public_id, created_at: hoursAgo(ageHours), bytes: 100 });

describe("collecting references", () => {
  it("finds *publicId fields anywhere, in nested objects and arrays", () => {
    const ids = collectReferencedIds([
      { images: [{ publicId: "indian-mist/products/a" }, { publicId: "indian-mist/products/b" }] },
      { image: { publicId: "indian-mist/categories/c" } },
      { story: { image: { publicId: "indian-mist/about/d" } }, customSections: [{ imagePublicId: "indian-mist/about/e" }] },
      { brandStorySettings: { imagePublicId: "indian-mist/brand-story/f" } },
    ]);
    expect([...ids].sort()).toEqual(["indian-mist/about/d", "indian-mist/about/e", "indian-mist/brand-story/f", "indian-mist/categories/c", "indian-mist/products/a", "indian-mist/products/b"]);
  });

  it("a document that stored only a Cloudinary URL still protects its file", () => {
    const ids = collectReferencedIds([{ brandStorySettings: { imageUrl: url("indian-mist/brand-story/legacy") } }, { categoryCoverImage: url("indian-mist/products/cover") }]);
    expect(ids.has("indian-mist/brand-story/legacy")).toBe(true);
    expect(ids.has("indian-mist/products/cover")).toBe(true);
  });

  it("ignores dates, ids and other values", () => {
    expect(collectReferencedIds([{ createdAt: new Date(), n: 3, ok: true, nothing: null, text: "hello" }]).size).toBe(0);
    expect(publicIdFromUrl("https://example.com/x.jpg")).toBeNull();
  });
});

describe("finding unused files", () => {
  const referenced = new Set(["indian-mist/products/used"]);

  it("reports old unreferenced files only", () => {
    const { orphans, tooNew } = findOrphans(
      [asset("indian-mist/products/used", 500), asset("indian-mist/products/old-unused", 500), asset("indian-mist/about/just-uploaded", 2)],
      referenced,
      { now: NOW, minAgeHours: 24 },
    );
    expect(orphans.map((r: { public_id: string }) => r.public_id)).toEqual(["indian-mist/products/old-unused"]);
    expect(tooNew.map((r: { public_id: string }) => r.public_id)).toEqual(["indian-mist/about/just-uploaded"]);
  });

  it("never reports anything outside the app's folder", () => {
    const { orphans, tooNew } = findOrphans([asset("someone-else/photo", 999), asset("indian-mist-test/x", 999)], referenced, { now: NOW });
    expect(orphans).toEqual([]);
    expect(tooNew).toEqual([]);
  });

  it("the minimum age is adjustable", () => {
    const resources = [asset("indian-mist/x/1", 30)];
    expect(findOrphans(resources, referenced, { now: NOW, minAgeHours: 48 }).orphans).toHaveLength(0);
    expect(findOrphans(resources, referenced, { now: NOW, minAgeHours: 24 }).orphans).toHaveLength(1);
  });
});

describe("delete safety", () => {
  const label = "my-cloud/IndianMist";

  it("refuses without the exact cloud/database confirmation", () => {
    expect(deleteRefusal({ label, confirm: undefined, referencedCount: 30 })).toMatch(/--confirm=my-cloud\/IndianMist/);
    expect(deleteRefusal({ label, confirm: "my-cloud/other-db", referencedCount: 30 })).toMatch(/Refusing/);
  });

  it("refuses when the database references no images (the wrong database would make every file look unused)", () => {
    expect(deleteRefusal({ label, confirm: label, referencedCount: 0 })).toMatch(/wrong database/);
  });

  it("allows a confirmed run on a database that references images", () => {
    expect(deleteRefusal({ label, confirm: label, referencedCount: 3 })).toBeNull();
  });
});
