import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { setupTestDb } from "./helpers/mongo";
import { adminCall } from "./helpers/admin";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(), notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());

import { PUT, GET } from "@/app/api/admin/legal/[slug]/route";
import { LegalPageView } from "@/components/legal/LegalPageView";
import { getPublishedOptionalPolicies } from "@/lib/storefront-data";
import { Footer } from "@/components/home/Footer";
import sitemap from "@/app/sitemap";
import { hasLegalText, isLegalSlug, isOptionalLegalSlug, LEGAL_DEFAULTS } from "@/lib/legal-pages";

setupTestDb();
const save = (slug: string, title: string, content: string) => adminCall(PUT as never, { method: "PUT", json: { title, content } }, { slug });
const view = async (slug: "refund-policy" | "shipping-policy") => renderToStaticMarkup(await LegalPageView({ slug }));

describe("refund and shipping policy pages", () => {
  it("are known page types with no invented default text", () => {
    expect(isLegalSlug("refund-policy") && isLegalSlug("shipping-policy")).toBe(true);
    expect(isOptionalLegalSlug("refund-policy")).toBe(true);
    expect(isOptionalLegalSlug("privacy-policy")).toBe(false);
    expect(LEGAL_DEFAULTS["refund-policy"].content).toBe("");
    expect(LEGAL_DEFAULTS["shipping-policy"].content).toBe("");
    expect(hasLegalText("<p></p>")).toBe(false);
    expect(hasLegalText("<p>&nbsp; </p>")).toBe(false);
    expect(hasLegalText("<p>7 days</p>")).toBe(true);
  });

  it("do not exist on the site (404), the footer or the sitemap until text is saved", async () => {
    await expect(view("refund-policy")).rejects.toThrow("NOT_FOUND");
    await expect(view("shipping-policy")).rejects.toThrow("NOT_FOUND");
    expect(await getPublishedOptionalPolicies()).toEqual([]);
    const footer = renderToStaticMarkup(createElement(Footer, { policies: [] }));
    expect(footer).not.toMatch(/refund|shipping-policy/i);
    expect((await sitemap()).map((e) => e.url).join(" ")).not.toMatch(/refund-policy|shipping-policy/);
  });

  it("saving text publishes the page, links it in the footer and lists it in the sitemap; saving empty text takes it down", async () => {
    revalidatePath.mockClear();
    const res = await save("refund-policy", "Returns & Refunds", "<h2>Window</h2><p>Returns within 7 days.</p>");
    expect(res.status).toBe(200);
    // the page, the footer (whole layout) and the sitemap are refreshed
    const paths = revalidatePath.mock.calls.map((c) => c.join("|"));
    expect(paths).toContain("/refund-policy");
    expect(paths).toContain("/|layout");
    expect(paths).toContain("/sitemap.xml");

    const html = await view("refund-policy");
    expect(html).toContain("Returns &amp; Refunds");
    expect(html).toContain("Returns within 7 days.");
    await expect(view("shipping-policy")).rejects.toThrow("NOT_FOUND"); // the other one is unaffected

    const policies = await getPublishedOptionalPolicies();
    expect(policies).toEqual([{ slug: "refund-policy", title: "Returns & Refunds" }]);
    const footer = renderToStaticMarkup(createElement(Footer, { policies }));
    expect(footer).toContain('href="/refund-policy"');
    expect(footer).toContain("Returns &amp; Refunds");
    expect(footer).not.toContain("/shipping-policy");
    expect((await sitemap()).map((e) => e.url).some((u) => u.endsWith("/refund-policy"))).toBe(true);

    // admin can read it back
    const got = await adminCall(GET as never, { method: "GET" }, { slug: "refund-policy" });
    const body = await got.json();
    expect((body.data ?? body).page.content).toContain("7 days");

    // an emptied editor saves "<p></p>": the page is down again
    expect((await save("refund-policy", "Returns & Refunds", "<p></p>")).status).toBe(200);
    await expect(view("refund-policy")).rejects.toThrow("NOT_FOUND");
    expect(await getPublishedOptionalPolicies()).toEqual([]);
  });

  it("strips scripts from saved text, rejects unknown pages and non-admins", async () => {
    await save("shipping-policy", "Shipping", "<p>Ships in 3 days</p><script>alert(1)</script>");
    const html = await view("shipping-policy");
    expect(html).toContain("Ships in 3 days");
    expect(html).not.toContain("<script");
    expect((await save("made-up-policy", "x", "y")).status).toBe(404);
    expect((await adminCall(PUT as never, { method: "PUT", json: { title: "t", content: "c" }, role: "customer" }, { slug: "refund-policy" })).status).toBeGreaterThanOrEqual(401);
  });

  it("the original two pages still fall back to their default text", async () => {
    expect(await view("refund-policy" as never).catch(() => "down")).toBe("down");
    const privacy = renderToStaticMarkup(await LegalPageView({ slug: "privacy-policy" }));
    expect(privacy).toContain("Privacy Policy");
  });
});
