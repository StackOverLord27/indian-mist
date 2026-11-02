import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./helpers/mongo";
import { cloudinaryCalls } from "./helpers/cloudinary";
import { adminCall } from "./helpers/admin";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("cloudinary", async () => (await import("./helpers/cloudinary")).cloudinaryModuleMock());

import Settings from "@/models/settings.model";
import Carousel from "@/models/carousel.model";
import * as settingsRoute from "@/app/api/admin/settings/route";
import { settingsForSection, SETTINGS_SECTIONS, type SettingsSection } from "@/lib/admin-api/settings";
import type { SiteSettings } from "@/types/admin";

setupTestDb();

const put = (json: unknown) => adminCall(settingsRoute.PUT, { method: "PUT", json });
const stored = async () => (await Settings.findOne().lean())!;
const url = (id: string) => `https://res.cloudinary.com/test-cloud/image/upload/v1/${id}.jpg`;

beforeEach(() => {
  cloudinaryCalls.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

/** What each admin page holds after loading GET /api/admin/settings, including the fields the server added. */
const fullDocument = (): SiteSettings & Record<string, unknown> => ({
  _id: "64b000000000000000000001",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  __v: 0,
  sizeChart: { url: "https://res.cloudinary.com/x/size.jpg", publicId: "indian-mist/size-chart/s" },
  tagline: "Born wild",
  contactEmail: "hello@shop.test",
  footerNote: "Made with care",
  metaTitle: "Shop",
  metaDescription: "A shop",
  socialLinks: { instagram: "https://instagram.com/shop", facebook: "", twitter: "", youtube: "" },
  heroSettings: { subtitle: "Hello", titleLine1: "A", titleLine2: "B", theme: "forest", ecoBadge: { text: "100%", subtext: "Eco", isVisible: true } },
  brandStorySettings: { subtitle: "ROOTS", description: "Story", tags: "a, b", buttonText: "Read", buttonLink: "/about", imageUrl: "", imagePublicId: "" },
  trustStripSettings: { items: [{ icon: "Leaf", title: "Free shipping", subtitle: "Above 999" }] },
  ecoCommitmentSettings: { subtitle: "Commit", titleLine1: "X", titleLine2: "Y", items: [{ icon: "Recycle", number: "1", label: "L", description: "D" }] },
  pricingSettings: { shippingCost: 99, freeShippingThreshold: 999, gstRate: 0, showPricesInclusiveOfGst: false, promoCodes: [] },
  contactPageSettings: { title: "Contact", email: "hello@shop.test", faqs: [{ question: "Q?", answer: "A." }] },
});

describe("validation", () => {
  it("rejects bad input with the field named, and saves nothing", async () => {
    const res = await put({
      pricingSettings: { shippingCost: -5, promoCodes: [{ code: "SAVE", discountType: "PERCENTAGE", discountValue: 150 }] },
      contactPageSettings: { email: "not-an-email", faqs: [{ question: "", answer: "x" }] },
      socialLinks: { instagram: "javascript:alert(1)" },
      heroSettings: { theme: "neon", primaryButtonLink: "//evil.example" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("Validation failed");
    expect(Object.keys(body.errors)).toEqual(expect.arrayContaining([
      "pricingSettings.shippingCost",
      "pricingSettings.promoCodes.0.discountValue",
      "contactPageSettings.email",
      "contactPageSettings.faqs.0.question",
      "socialLinks.instagram",
      "heroSettings.theme",
      "heroSettings.primaryButtonLink",
    ]));
    expect(await Settings.countDocuments()).toBe(0);
  });

  it("rejects a body that is not an object, broken JSON, and an empty update", async () => {
    expect((await put([1, 2])).status).toBe(400);
    expect((await put("text")).status).toBe(400);
    expect((await adminCall(settingsRoute.PUT, { method: "PUT", rawBody: "{oops" })).status).toBe(400);
    expect((await put({ unknown: 1 })).status).toBe(400);
  });

  it("non-admins cannot save", async () => {
    expect((await adminCall(settingsRoute.PUT, { method: "PUT", json: { tagline: "x" }, role: "user" })).status).toBe(403);
  });

  it("bounds numbers and lengths", async () => {
    expect((await put({ pricingSettings: { gstRate: 101 } })).status).toBe(400);
    expect((await put({ pricingSettings: { freeShippingThreshold: Infinity as unknown as number } })).status).toBe(400);
    expect((await put({ metaTitle: "x".repeat(201) })).status).toBe(400);
    expect((await put({ trustStripSettings: { items: Array.from({ length: 13 }, () => ({ title: "t" })) } })).status).toBe(400);
  });
});

describe("what is saved", () => {
  it("only validated data: unknown keys, _id, timestamps, __v and sizeChart are ignored", async () => {
    await Settings.create({ sizeChart: { url: "https://x/y.jpg", publicId: "keep/me" } });
    const res = await put({
      tagline: "New",
      evil: "<script>",
      _id: "64b000000000000000000099",
      createdAt: "2000-01-01",
      __v: 9,
      sizeChart: { url: "https://attacker/x.jpg", publicId: "steal/this" },
      heroSettings: { subtitle: "Hi", notInSchema: true },
    });
    expect(res.status).toBe(200);
    const doc = (await stored()) as Record<string, unknown> & { sizeChart: { publicId: string }; heroSettings: Record<string, unknown> };
    expect(doc.tagline).toBe("New");
    expect(doc.evil).toBeUndefined();
    expect(doc.sizeChart.publicId).toBe("keep/me");
    expect(doc.heroSettings.notInSchema).toBeUndefined();
    expect(String(doc._id)).not.toBe("64b000000000000000000099");
  });

  it("a partial update does not erase other sections or other fields of the same section", async () => {
    await put(fullDocument());
    const before = await stored();

    const res = await put({ heroSettings: { ecoBadge: { text: "99%" } }, pricingSettings: { shippingCost: 149 } });
    expect(res.status).toBe(200);
    const after = await stored();

    expect(after.heroSettings!.ecoBadge!.text).toBe("99%");
    expect(after.heroSettings!.ecoBadge!.subtext).toBe("Eco"); // sibling field kept
    expect(after.heroSettings!.titleLine1).toBe("A");
    expect(after.pricingSettings!.shippingCost).toBe(149);
    expect(after.pricingSettings!.freeShippingThreshold).toBe(999);
    // untouched sections are identical
    for (const key of ["tagline", "contactPageSettings", "brandStorySettings", "trustStripSettings", "ecoCommitmentSettings", "socialLinks"] as const) {
      expect(JSON.parse(JSON.stringify(after[key])), key).toEqual(JSON.parse(JSON.stringify(before[key])));
    }
  });

  it("headings are stored exactly as typed, including the trailing space the homepage relies on", async () => {
    expect((await put({ brandStorySettings: { titleLine1: "We make things the forest would ", titleLine2: "keep." } })).status).toBe(200);
    expect((await stored()).brandStorySettings!.titleLine1).toBe("We make things the forest would ");
    expect((await put({ contactPageSettings: { faqs: [{ question: "   ", answer: "x" }] } })).status).toBe(400);
  });

  it("promo codes are trimmed, upper-cased, unique, and keep their defaults", async () => {
    const ok = await put({ pricingSettings: { promoCodes: [{ code: "  save10 ", discountType: "PERCENTAGE", discountValue: 10 }, { code: "FLAT50", discountType: "FIXED", discountValue: 50, maxUses: 5 }] } });
    expect(ok.status).toBe(200);
    const promos = (await stored()).pricingSettings!.promoCodes!;
    expect(promos.map((p: { code: string }) => p.code)).toEqual(["SAVE10", "FLAT50"]);
    expect(promos[0]).toMatchObject({ isActive: true, minOrderValue: 0, maxUses: 0, maxUsesPerUser: 1 });
    expect(promos[1].maxUses).toBe(5);

    const dup = await put({ pricingSettings: { promoCodes: [{ code: "SAVE10", discountType: "FIXED", discountValue: 1 }, { code: "save10", discountType: "FIXED", discountValue: 2 }] } });
    expect(dup.status).toBe(400);
    expect(Object.keys((await dup.json()).errors)).toContain("pricingSettings.promoCodes.1.code");
    expect((await stored()).pricingSettings!.promoCodes).toHaveLength(2); // unchanged

    expect((await put({ pricingSettings: { promoCodes: [{ code: "bad code!", discountType: "FIXED", discountValue: 1 }] } })).status).toBe(400);
    expect((await put({ pricingSettings: { promoCodes: [{ code: "OK", discountType: "FIXED", discountValue: 1, expiresAt: "not a date" }] } })).status).toBe(400);
  });
});

describe("each admin page saves only the sections it owns", () => {
  const sections = Object.keys(SETTINGS_SECTIONS) as SettingsSection[];

  it("the sections are disjoint", () => {
    const all = sections.flatMap((s) => [...SETTINGS_SECTIONS[s]]);
    expect(new Set(all).size).toBe(all.length);
  });

  it.each(sections)("saving the %s page (with the whole document loaded, as the page has it) changes nothing outside its sections", async (section) => {
    const doc = fullDocument();
    await put(doc); // the owner configured everything
    const before = JSON.parse(JSON.stringify(await stored()));

    // The page edits something in its own sections, then sends what the page sends.
    const edited = structuredClone(doc);
    if (section === "general") edited.tagline = "Edited tagline";
    if (section === "homepage") edited.heroSettings!.titleLine1 = "Edited";
    if (section === "contact") edited.contactPageSettings!.title = "Edited";
    if (section === "pricing") edited.pricingSettings!.shippingCost = 123;
    const payload = settingsForSection(edited, section);
    expect(Object.keys(payload).sort()).toEqual([...SETTINGS_SECTIONS[section]].sort());

    // Meanwhile another admin page changed other sections after this one loaded:
    await put({ pricingSettings: { shippingCost: 55 }, metaTitle: "Changed elsewhere", contactPageSettings: { title: "Elsewhere" } });
    const elsewhere = JSON.parse(JSON.stringify(await stored()));

    expect((await put(payload)).status).toBe(200);
    const after = JSON.parse(JSON.stringify(await stored()));

    const owned = new Set<string>(SETTINGS_SECTIONS[section]);
    for (const key of Object.keys(after)) {
      if (owned.has(key) || ["updatedAt", "__v"].includes(key)) continue;
      expect(after[key], `${section} page must not touch ${key}`).toEqual(elsewhere[key]);
    }
    expect(before._id).toBe(after._id);
  });
});

describe("homepage brand story image", () => {
  const withBrand = (imageUrl: string, imagePublicId?: string) => ({
    brandStorySettings: { subtitle: "ROOTS", imageUrl, ...(imagePublicId !== undefined && { imagePublicId }) },
  });

  it("replacing the image deletes the old file after the save", async () => {
    await put(withBrand(url("indian-mist/brand-story/one"), "indian-mist/brand-story/one"));
    cloudinaryCalls.onDestroy = async () => {
      expect((await stored()).brandStorySettings!.imagePublicId).toBe("indian-mist/brand-story/two");
    };
    expect((await put(withBrand(url("indian-mist/brand-story/two"), "indian-mist/brand-story/two"))).status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual(["indian-mist/brand-story/one"]);
  });

  it("removing the image deletes the file", async () => {
    await put(withBrand(url("indian-mist/brand-story/one"), "indian-mist/brand-story/one"));
    expect((await put(withBrand("", ""))).status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual(["indian-mist/brand-story/one"]);
    expect((await stored()).brandStorySettings!.imageUrl).toBe("");
  });

  it("saving other homepage fields leaves the image alone", async () => {
    await put(withBrand(url("indian-mist/brand-story/one"), "indian-mist/brand-story/one"));
    const res = await put({ brandStorySettings: { subtitle: "NEW" } });
    expect(res.status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual([]);
    expect((await stored()).brandStorySettings!.imagePublicId).toBe("indian-mist/brand-story/one");
  });

  it("old documents that stored only the URL: the id is worked out from our own URL", async () => {
    await Settings.create({ brandStorySettings: { imageUrl: url("indian-mist/brand-story/legacy") } }); // no publicId
    expect((await put(withBrand(url("indian-mist/brand-story/new"), "indian-mist/brand-story/new"))).status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual(["indian-mist/brand-story/legacy"]);
  });

  it("old documents with a URL we cannot map to our Cloudinary are left alone, without errors", async () => {
    for (const legacy of ["https://images.unsplash.com/photo-1.jpg", "https://res.cloudinary.com/other-cloud/image/upload/v1/indian-mist/x.jpg", "https://res.cloudinary.com/test-cloud/image/upload/v1/not-ours/x.jpg"]) {
      await Settings.deleteMany({});
      await Settings.create({ brandStorySettings: { imageUrl: legacy } });
      expect((await put(withBrand("", ""))).status).toBe(200);
    }
    expect(cloudinaryCalls.destroys).toEqual([]);
  });

  it("a page that only sends the new URL still gets its id recorded", async () => {
    expect((await put(withBrand(url("indian-mist/brand-story/only-url")))).status).toBe(200);
    expect((await stored()).brandStorySettings!.imagePublicId).toBe("indian-mist/brand-story/only-url");
  });

  it("never deletes an old file that something else still uses", async () => {
    await put(withBrand(url("indian-mist/brand-story/shared"), "indian-mist/brand-story/shared"));
    await Carousel.create({ url: url("indian-mist/brand-story/shared"), publicId: "indian-mist/brand-story/shared" });
    expect((await put(withBrand("", ""))).status).toBe(200);
    expect(cloudinaryCalls.destroys).toEqual([]);
  });

  it("a Cloudinary failure after the save does not fail the save", async () => {
    await put(withBrand(url("indian-mist/brand-story/one"), "indian-mist/brand-story/one"));
    cloudinaryCalls.failNextDestroy = true;
    expect((await put(withBrand("", ""))).status).toBe(200);
    expect((await stored()).brandStorySettings!.imageUrl).toBe("");
  });

  it("only web addresses are accepted for the image", async () => {
    expect((await put(withBrand("javascript:alert(1)", ""))).status).toBe(400);
  });
});
