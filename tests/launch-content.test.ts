import { describe, expect, it, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { setupTestDb } from "./helpers/mongo";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(), notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("next/font/google", () => ({ Merriweather: () => ({ variable: "v1", className: "c1" }), Montserrat: () => ({ variable: "v2", className: "c2" }) }));
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());

import { Product } from "@/models/product.model";
import { Collection } from "@/models/collection.model";
import { Blog } from "@/models/blog.model";
import SiteSettings from "@/models/settings.model";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { getSiteUrl, EnvError } from "@/lib/env";
import { pageMetadata, productJsonLd, productInStock, jsonLdString, summarise, NOINDEX } from "@/lib/seo";
import { generateMetadata as productMetadata } from "@/app/products/[slug]/page";
import { generateMetadata as blogMetadata } from "@/app/blogs/[slug]/page";
import { generateMetadata as rootMetadata } from "@/app/layout";
import { TrustStrip } from "@/components/home/TrustStrip";
import { EcoCommitmentSection } from "@/components/home/EcoCommitmentSection";
import { BrandStorySection } from "@/components/home/BrandStorySection";
import { HeroSection } from "@/components/home/HeroSection";
import { resolveAbout, ABOUT_DEFAULTS } from "@/lib/about-content";
import { SettingsSchema } from "@/schemas/admin";
import { metadata as signinMeta } from "@/app/signin/layout";
import { metadata as signupMeta } from "@/app/signup/layout";
import { metadata as forgotMeta } from "@/app/forgot-password/layout";
import { metadata as cartMeta } from "@/app/cart/page";
import { metadata as checkoutMeta } from "@/app/checkout/page";
import { metadata as profileMeta } from "@/app/profile/page";
import { metadata as adminMeta } from "@/app/admin/layout";

setupTestDb();
afterEach(() => { vi.unstubAllEnvs(); });

let n = 0;
const product = (over: Record<string, unknown> = {}) => {
  n++;
  return Product.create({
    name: `Olive Tee ${n}`, slug: `olive-tee-${n}`, description: "<p>A soft   tee.</p>", category: "tees", price: 499.5,
    images: [{ url: `https://res.cloudinary.com/x/${n}.jpg`, publicId: `p${n}`, alt: "", isPrimary: true }], ...over,
  });
};
const render = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("site address", () => {
  it("is required in production, validated, and defaults for development", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(() => getSiteUrl()).toThrow(EnvError);
    expect(() => getSiteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");
    expect(() => getSiteUrl()).toThrow(/valid address/);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "ftp://shop.example.com");
    expect(() => getSiteUrl()).toThrow(/https/);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.example.com/some/path/");
    expect(getSiteUrl()).toBe("https://www.example.com");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});

describe("sitemap.xml and robots.txt", () => {
  it("lists static pages, every product, active collections and published posts, with full addresses", async () => {
    const a = await product(); const b = await product({ badge: "Sold Out" });
    await Collection.create([{ name: "On", slug: "on", isActive: true }, { name: "Off", slug: "off", isActive: false }]);
    await Blog.create([
      { title: "Live", slug: "live", excerpt: "e", content: "c", category: "x", author: "a", isPublished: true },
      { title: "Draft", slug: "draft", excerpt: "e", content: "c", category: "x", author: "a", isPublished: false },
    ]);
    const urls = (await sitemap()).map((e) => e.url);
    const base = "https://shop.example.test";
    for (const path of ["/", "/products", "/collections", "/blogs", "/about", "/contact", "/privacy-policy", "/terms-and-conditions"]) expect(urls).toContain(`${base}${path}`);
    expect(urls).toContain(`${base}/products/${a.slug}`);
    expect(urls).toContain(`${base}/products/${b.slug}`); // sold out is still a page worth finding
    expect(urls).toContain(`${base}/collections/on`);
    expect(urls).not.toContain(`${base}/collections/off`);
    expect(urls).toContain(`${base}/blogs/live`);
    expect(urls).not.toContain(`${base}/blogs/draft`);
    expect(urls.every((u) => u.startsWith(`${base}/`) || u === base + "/")).toBe(true);
    expect(urls.some((u) => /admin|api|cart|checkout|profile|signin|signup/.test(u))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
    const productEntry = (await sitemap()).find((e) => e.url.endsWith(a.slug))!;
    expect(productEntry.lastModified).toBeInstanceOf(Date);
  });

  it("robots.txt keeps private pages away and points at the sitemap", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.allow).toBe("/");
    for (const path of ["/admin", "/api/", "/cart", "/checkout", "/profile", "/signin", "/signup", "/forgot-password"]) expect(rules.disallow).toContain(path);
    expect(r.sitemap).toBe("https://shop.example.test/sitemap.xml");
  });
});

describe("metadata", () => {
  it("root: the shop's name only when nothing is saved (no invented tagline), title template, base address", async () => {
    const m = await rootMetadata();
    expect(m.title).toEqual({ default: "Indian Mist", template: "%s | Indian Mist" });
    expect(m.description).toBeUndefined();
    expect(String(m.metadataBase)).toBe("https://shop.example.test/");
    expect(m.openGraph).toMatchObject({ siteName: "Indian Mist", locale: "en_IN", type: "website" });
    await SiteSettings.create({ metaTitle: "Indian Mist - Outdoors", metaDescription: "Our own words" });
    const saved = await rootMetadata();
    expect((saved.title as { default: string }).default).toBe("Indian Mist - Outdoors");
    expect(saved.description).toBe("Our own words");
  });

  it("a product page: title, description, canonical, Open Graph image, no double suffix", async () => {
    const p = await product();
    const m = await productMetadata({ params: Promise.resolve({ slug: p.slug }) });
    expect(m.title).toBe(p.name); // the layout's template adds " | Indian Mist"
    expect(String(m.title)).not.toContain("Indian Mist");
    expect(m.description).toBe("A soft tee."); // tags stripped, spaces tidied
    expect(m.alternates?.canonical).toBe(`/products/${p.slug}`);
    expect(m.openGraph).toMatchObject({ type: "website", siteName: "Indian Mist", url: `/products/${p.slug}`, images: [{ url: p.images[0].url }] });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("an unknown product is noindex", async () => {
    const m = await productMetadata({ params: Promise.resolve({ slug: "nope" }) });
    expect(m.robots).toEqual(NOINDEX);
  });

  it("a blog post: article Open Graph with cover and date, canonical; a draft is not found", async () => {
    await Blog.create({ title: "Trail notes", slug: "trail-notes", excerpt: "How we pack.", content: "c", category: "x", author: "a", isPublished: true, publishedAt: new Date("2026-03-01T00:00:00Z"), coverImage: { url: "https://res.cloudinary.com/x/c.jpg", publicId: "c", alt: "" } });
    await Blog.create({ title: "Hidden", slug: "hidden", excerpt: "e", content: "c", category: "x", author: "a", isPublished: false });
    const m = await blogMetadata({ params: Promise.resolve({ slug: "trail-notes" }) });
    expect(m.title).toBe("Trail notes");
    expect(m.description).toBe("How we pack.");
    expect(m.alternates?.canonical).toBe("/blogs/trail-notes");
    expect(m.openGraph).toMatchObject({ type: "article", publishedTime: expect.stringContaining("2026-03-01"), images: [{ url: "https://res.cloudinary.com/x/c.jpg" }] });
    expect((await blogMetadata({ params: Promise.resolve({ slug: "hidden" }) })).robots).toEqual(NOINDEX);
  });

  it("private pages say noindex", () => {
    for (const m of [signinMeta, signupMeta, forgotMeta, cartMeta, checkoutMeta, profileMeta, adminMeta]) expect(m.robots).toEqual({ index: false, follow: false });
  });

  it("summarise tidies text and caps its length", () => {
    expect(summarise("<b>Hi</b>   there")).toBe("Hi there");
    expect(summarise("x".repeat(400))!.length).toBe(160);
    expect(summarise("   ")).toBeUndefined();
    expect(pageMetadata({ title: "T", path: "/t" }).twitter).toMatchObject({ card: "summary" });
  });
});

describe("Product structured data", () => {
  const base = { name: "Olive Tee", slug: "olive-tee", description: "Soft.", price: 499.5, images: ["https://x/1.jpg"], siteUrl: "https://shop.example.test" };
  it("price in INR, image, address, and availability that follows the real stock", () => {
    const inStock = productJsonLd({ ...base, inStock: true });
    expect(inStock).toMatchObject({
      "@context": "https://schema.org", "@type": "Product", name: "Olive Tee", image: ["https://x/1.jpg"], url: "https://shop.example.test/products/olive-tee",
      offers: { "@type": "Offer", priceCurrency: "INR", price: "499.50", availability: "https://schema.org/InStock" },
    });
    expect(productJsonLd({ ...base, inStock: false }).offers.availability).toBe("https://schema.org/OutOfStock");
  });
  it("availability rules", () => {
    expect(productInStock({})).toBe(true);
    expect(productInStock({ badge: "Sold Out" })).toBe(false);
    expect(productInStock({ stock: 0 })).toBe(false);
    expect(productInStock({ stock: 3 })).toBe(true);
    expect(productInStock({ stockBySize: { S: 0, M: 0 } })).toBe(false);
    expect(productInStock({ stockBySize: { S: 0, M: 2 } })).toBe(true);
  });
  it("cannot be broken out of its <script> tag", () => {
    const text = jsonLdString({ name: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("</script>");
    expect(JSON.parse(text).name).toBe("</script><script>alert(1)</script>");
  });
});

describe("empty settings: no placeholder claims anywhere", () => {
  const CLAIMS = /Summer 2026|Born from the forest|made for the wild|Slow-made|1 tree|Planted with care|Sustainable materials|Easy returns|Ethically sourced|12k|Trees planted|Recycled|Plastic|Revenue donated|gentler|Organic cotton|Natural dyes|Fair trade|OUR ROOTS|Eco materials|Certified Organic|GOTS|100%|Carbon|30 days|123 Forest|98765/i;

  it("a settings document created with nothing typed holds no invented content", async () => {
    const doc = await SiteSettings.create({});
    const plain = JSON.parse(JSON.stringify(doc.toObject()));
    expect(JSON.stringify(plain)).not.toMatch(CLAIMS);
    expect(plain.trustStripSettings.items).toEqual([]);
    expect(plain.ecoCommitmentSettings.items).toEqual([]);
    expect(plain.heroSettings.ecoBadge.text).toBe("");
    expect(plain.contactPageSettings.address).toBe("");
    expect(plain.brandStorySettings.tags).toBe("");
  });

  it("trust strip, eco section and brand story render nothing when empty", () => {
    expect(render(createElement(TrustStrip, { items: [], freeShippingThreshold: 999 }))).toBe("");
    expect(render(createElement(TrustStrip, { items: [{ icon: "Leaf", title: "", subtitle: "" }] }))).toBe("");
    expect(render(createElement(EcoCommitmentSection, { settings: undefined }))).toBe("");
    expect(render(createElement(EcoCommitmentSection, { settings: { subtitle: "x", titleLine1: "y", items: [] } }))).toBe("");
    expect(render(createElement(BrandStorySection, { image: { alt: "", fallbackClassName: "" }, settings: undefined }))).toBe("");
  });

  it("the hero shows the shop's name and nothing invented", () => {
    const html = render(createElement(HeroSection, { settings: undefined, slides: [] }));
    expect(html).not.toMatch(CLAIMS);
    expect(html).toContain("<h1");
    expect(html).toContain("Indian Mist");
    expect(html).not.toContain("<a "); // no buttons without button text
    expect(html).not.toContain("lucide-leaf"); // no eco badge
    expect(html).not.toMatch(/Eco materials/i);
  });

  it("only typed content shows; the free-shipping line comes from the real threshold", () => {
    const strip = render(createElement(TrustStrip, { items: [{ icon: "Leaf", title: "Handmade", subtitle: "In small batches" }], freeShippingThreshold: 1499 }));
    expect(strip).toContain("Handmade");
    expect(strip).toContain("Free shipping");
    expect(strip).toContain("₹1,499");
    // an owner-written shipping point is respected; no second one is added
    const own = render(createElement(TrustStrip, { items: [{ icon: "Truck", title: "Free delivery", subtitle: "Over ₹999" }], freeShippingThreshold: 1499 }));
    expect(own).not.toContain("₹1,499");
    // a hand-typed free-shipping figure is replaced by the real threshold (the live site had "Above ₹699" while checkout gives free shipping above ₹399)
    const stale = render(createElement(TrustStrip, { items: [{ icon: "Truck", title: "Free shipping", subtitle: "Above ₹699" }], freeShippingThreshold: 399 }));
    expect(stale).toContain("₹399");
    expect(stale).not.toContain("₹699");
    // the generated point never makes an empty strip appear
    expect(render(createElement(TrustStrip, { items: [], freeShippingThreshold: 1499 }))).toBe("");
    const eco = render(createElement(EcoCommitmentSection, { settings: { items: [{ icon: "TreePine", number: "7", label: "Things", description: "d" }] } }));
    expect(eco).toContain("Things");
    expect(eco).not.toContain("Our commitment");
    const hero = render(createElement(HeroSection, { settings: { titleLine1: "Hello", ecoBadge: { text: "A", subtext: "", isVisible: true } }, slides: [] }));
    expect(hero).toContain("Hello");
    expect(hero).not.toContain("Indian Mist");
  });

  it("the About page's invented copy is gone", () => {
    const about = resolveAbout(null);
    expect(JSON.stringify(about)).not.toMatch(/wild|wildlife|Look Closer|What Inspires/i);
    expect(about.values.cards).toEqual([]);
    expect(about.cta.heading).toBe("");
    expect(about.hero.headline).toBe("About Indian Mist");
    expect(ABOUT_DEFAULTS.cta.primaryButtonLabel).toBe("Shop Now"); // a structural label stays
    // what the owner wrote still shows
    const mine = resolveAbout({ hero: { eyebrow: "E", headline: "My headline", lead: "" }, drivesUs: { heading: "H", cards: [{ icon: "Leaf", title: "T", body: "B" }] }, cta: { heading: "Go", subtext: "", primaryButtonLabel: "Shop", secondaryButtonLabel: "" } } as never);
    expect(mine.hero.headline).toBe("My headline");
    expect(mine.values.cards).toHaveLength(1);
    expect(mine.cta.heading).toBe("Go");
  });
});

describe("admin editors can save empty lists", () => {
  it("the settings schema accepts empty trust-strip and eco lists and empty texts", () => {
    const parsed = SettingsSchema.safeParse({
      trustStripSettings: { items: [] },
      ecoCommitmentSettings: { subtitle: "", titleLine1: "", titleLine2: "", items: [] },
      heroSettings: { subtitle: "", ecoBadge: { text: "", subtext: "", isVisible: true } },
      brandStorySettings: { tags: "", description: "" },
      contactPageSettings: { address: "", phone: "", email: "", businessHours: "", faqs: [] },
    });
    expect(parsed.success).toBe(true);
  });
});
