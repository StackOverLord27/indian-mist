import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./helpers/mongo";
import { adminCall } from "./helpers/admin";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("cloudinary", async () => (await import("./helpers/cloudinary")).cloudinaryModuleMock());

import { revalidatePath } from "next/cache";
import Settings from "@/models/settings.model";
import * as settingsRoute from "@/app/api/admin/settings/route";
import { SettingsSchema } from "@/schemas/admin";
import { SETTINGS_SECTIONS } from "@/lib/admin-api/settings";
import { BLOG_HEADER_DEFAULTS, resolveBlogHeader } from "@/lib/blog-page-header";

setupTestDb();

const put = (json: unknown) => adminCall(settingsRoute.PUT, { method: "PUT", json });
const stored = async () => JSON.parse(JSON.stringify((await Settings.findOne().lean())!));

beforeEach(() => vi.mocked(revalidatePath).mockClear());

describe("blog page header: owned section and schema", () => {
  it("is its own section, listed once, and no other page owns blogPageSettings", () => {
    expect(SETTINGS_SECTIONS.blogs).toEqual(["blogPageSettings"]);
    const owners = Object.entries(SETTINGS_SECTIONS).filter(([, keys]) => (keys as readonly string[]).includes("blogPageSettings"));
    expect(owners.map(([name]) => name)).toEqual(["blogs"]);
  });

  it("accepts the three texts, rejects over-long ones, and drops unknown keys", () => {
    expect(SettingsSchema.safeParse({ blogPageSettings: { eyebrow: "a", heading: "b", subtitle: "c" } }).success).toBe(true);
    expect(SettingsSchema.safeParse({ blogPageSettings: { eyebrow: "x".repeat(101) } }).success).toBe(false);
    expect(SettingsSchema.safeParse({ blogPageSettings: { heading: "x".repeat(201) } }).success).toBe(false);
    expect(SettingsSchema.safeParse({ blogPageSettings: { subtitle: "x".repeat(501) } }).success).toBe(false);
    const parsed = SettingsSchema.parse({ blogPageSettings: { heading: "H", evil: 1 } });
    expect(parsed.blogPageSettings).toEqual({ heading: "H" });
  });
});

describe("blog page header: the three states", () => {
  it("never saved: the document has no blogPageSettings, even after other pages created it; the page shows the current wording", async () => {
    // another page's save creates the settings document (upsert)
    expect((await put({ tagline: "Hello" })).status).toBe(200);
    const doc = await stored();
    expect(doc.blogPageSettings).toBeUndefined();
    expect(resolveBlogHeader(doc.blogPageSettings)).toEqual({ ...BLOG_HEADER_DEFAULTS });
    expect(resolveBlogHeader(null)).toEqual({ ...BLOG_HEADER_DEFAULTS });
  });

  it("saving one field leaves the others 'never saved' (they keep the current wording)", async () => {
    expect((await put({ blogPageSettings: { heading: "Field Notes" } })).status).toBe(200);
    const doc = await stored();
    expect(doc.blogPageSettings).toEqual({ heading: "Field Notes" });
    expect(resolveBlogHeader(doc.blogPageSettings)).toEqual({ ...BLOG_HEADER_DEFAULTS, heading: "Field Notes" });
  });

  it("saved text is shown exactly (trimmed)", async () => {
    expect((await put({ blogPageSettings: { eyebrow: "Our journal", heading: "Trail Notes", subtitle: "Short and sweet." } })).status).toBe(200);
    expect(resolveBlogHeader((await stored()).blogPageSettings)).toEqual({ eyebrow: "Our journal", heading: "Trail Notes", subtitle: "Short and sweet." });
  });

  it("saved empty hides the line; an empty heading falls back to 'Blog'", async () => {
    expect((await put({ blogPageSettings: { eyebrow: "", heading: "", subtitle: "" } })).status).toBe(200);
    const doc = await stored();
    expect(doc.blogPageSettings).toEqual({ eyebrow: "", heading: "", subtitle: "" });
    expect(resolveBlogHeader(doc.blogPageSettings)).toEqual({ eyebrow: "", heading: "Blog", subtitle: "" });
    expect(resolveBlogHeader({ eyebrow: "   ", heading: "  ", subtitle: " " })).toEqual({ eyebrow: "", heading: "Blog", subtitle: "" });
  });

  it("a later save from another page does not reset the saved-empty state", async () => {
    await put({ blogPageSettings: { eyebrow: "", heading: "Mine", subtitle: "" } });
    await put({ tagline: "Other page" });
    expect((await stored()).blogPageSettings).toEqual({ eyebrow: "", heading: "Mine", subtitle: "" });
  });
});

describe("blog page header: saving refreshes the storefront", () => {
  it("revalidates the whole storefront on save, and not on a rejected save", async () => {
    expect((await put({ blogPageSettings: { heading: "x".repeat(300) } })).status).toBe(400);
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    expect((await put({ blogPageSettings: { heading: "Fine" } })).status).toBe(200);
    expect(vi.mocked(revalidatePath).mock.calls).toEqual([["/", "layout"]]);
  });
});
