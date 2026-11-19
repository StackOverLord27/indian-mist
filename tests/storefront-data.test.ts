import { afterEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./helpers/mongo";
import SiteSettingsModel from "@/models/settings.model";
import { Category } from "@/models/category.model";
import AnnouncementModel from "@/models/announcement.model";
import { getSiteSettings, getNavCategories, getAnnouncementTexts } from "@/lib/storefront-data";
import { getLegalPage } from "@/components/legal/LegalPageView";

setupTestDb();
afterEach(() => vi.restoreAllMocks());

describe("storefront data", () => {
  it("returns empty values (not errors) when nothing is saved yet", async () => {
    expect(await getSiteSettings()).toBeNull();
    expect(await getNavCategories()).toEqual([]);
    expect(await getAnnouncementTexts()).toEqual([]);
  });

  it("returns saved data", async () => {
    await SiteSettingsModel.create({ metaTitle: "Shop" });
    await Category.create({ name: "Tees", slug: "tees" });
    await Category.create({ name: "Hidden", slug: "hidden", isHidden: true });
    await AnnouncementModel.create({ text: "Hello" });
    await AnnouncementModel.create({ text: "Off", isActive: false });
    expect((await getSiteSettings())?.metaTitle).toBe("Shop");
    expect(await getNavCategories()).toEqual([{ name: "Tees", slug: "tees" }]);
    expect(await getAnnouncementTexts()).toEqual(["Hello"]);
  });

  // A swallowed error would let a failed ISR regeneration replace the last good page with a blank one
  it("throws when the database fails instead of returning a blank fallback", async () => {
    vi.spyOn(SiteSettingsModel, "findOne").mockImplementation((() => { throw new Error("db down"); }) as never);
    vi.spyOn(Category, "find").mockImplementation((() => { throw new Error("db down"); }) as never);
    vi.spyOn(AnnouncementModel, "find").mockImplementation((() => { throw new Error("db down"); }) as never);
    await expect(getSiteSettings()).rejects.toThrow("db down");
    await expect(getNavCategories()).rejects.toThrow("db down");
    await expect(getAnnouncementTexts()).rejects.toThrow("db down");
  });

  it("legal pages throw on database failure but fall back when no text is saved", async () => {
    expect((await getLegalPage("privacy-policy")).title).toBe("Privacy Policy");
    const LegalPage = (await import("@/models/legal-page.model")).default;
    vi.spyOn(LegalPage, "findOne").mockImplementation((() => { throw new Error("db down"); }) as never);
    await expect(getLegalPage("terms-and-conditions")).rejects.toThrow("db down");
  });
});
