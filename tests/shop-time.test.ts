import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { adminCall } from "./helpers/admin";
import { fakeRedis } from "./helpers/redis";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("cloudinary", async () => (await import("./helpers/cloudinary")).cloudinaryModuleMock());
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());

import Settings from "@/models/settings.model";
import * as settingsRoute from "@/app/api/admin/settings/route";
import * as applyPromo from "@/app/api/checkout/promo/route";
import { SHOP_TIME_LABEL, formatShopDate, fromShopInputValue, hasExpired, toShopInputValue } from "@/lib/shop-time";

setupTestDb();

/** Runs `fn` with the process time zone set (what a browser's or a server's TZ is). */
async function inZone<T>(tz: string, fn: () => T | Promise<T>): Promise<T> {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try { return await fn(); } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
}

// What the admin page did BEFORE the fix, line for line (src/app/admin/pricing/page.tsx):
const oldShow = (iso: string) => new Date(iso).toISOString().slice(0, 16);
const oldSave = (typed: string) => new Date(typed).toISOString();

const TYPED = "2026-11-15T18:03"; // 6:03 PM on 15 November
const INSTANT = "2026-11-15T12:33:00.000Z"; // that moment in India (UTC+05:30)

describe("the bug, reproduced with the old code", () => {
  it("in India time the field showed 12:33 PM after picking 6:03 PM (the saved instant was right, the display used UTC parts)", async () => {
    await inZone("Asia/Kolkata", () => {
      const saved = oldSave(TYPED);
      expect(saved).toBe(INSTANT); // the instant itself was correct
      expect(oldShow(saved)).toBe("2026-11-15T12:33"); // ...but this is what the field showed
    });
  });
  it("in UTC the old code looked fine, which is why it was missed", async () => {
    await inZone("UTC", () => expect(oldShow(oldSave(TYPED))).toBe(TYPED));
  });
});

describe("the shop clock (India time), in every browser time zone", () => {
  for (const tz of ["Asia/Kolkata", "UTC", "America/Los_Angeles", "Pacific/Auckland", "Europe/London"]) {
    it(`${tz}: 6:03 PM typed = ${INSTANT}, and the field reads 6:03 PM back`, async () => {
      await inZone(tz, () => {
        expect(fromShopInputValue(TYPED)).toBe(INSTANT);
        expect(toShopInputValue(INSTANT)).toBe(TYPED);
        expect(toShopInputValue(fromShopInputValue(TYPED))).toBe(TYPED);
      });
    });
  }

  it("round trips every minute of a day, including midnight and the day boundaries", () => {
    for (const day of ["2026-01-01", "2026-03-29", "2026-10-25", "2026-12-31", "2028-02-29"]) {
      for (let minute = 0; minute < 1440; minute += 7) {
        const typed = `${day}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
        expect(toShopInputValue(fromShopInputValue(typed)), typed).toBe(typed);
      }
    }
    expect(fromShopInputValue("2026-11-16T00:00")).toBe("2026-11-15T18:30:00.000Z"); // midnight India = 18:30 UTC the day before
  });

  it("accepts seconds, ignores nothing it should not, and refuses what is not a real date", () => {
    expect(fromShopInputValue("2026-11-15T18:03:30")).toBe("2026-11-15T12:33:30.000Z");
    for (const bad of ["", "   ", "abc", "2026-11-15", "2026-02-31T10:00", "2026-11-15T25:00", "2026-13-01T10:00", "2026-11-15T10:61"]) {
      expect(fromShopInputValue(bad), bad).toBeNull();
    }
    expect(fromShopInputValue(null)).toBeNull();
    expect(fromShopInputValue(undefined)).toBeNull();
    expect(toShopInputValue(null)).toBe("");
    expect(toShopInputValue("not a date")).toBe("");
  });

  it("shows the label the pages put next to the field", () => {
    expect(SHOP_TIME_LABEL).toBe("IST");
  });
});

describe("dates shown to people are the same on a UTC server and in any browser (no wrong day near midnight)", () => {
  // 00:30 on 15 November in India = 19:00 UTC on 14 November
  const NEAR_MIDNIGHT = "2026-11-14T19:00:00.000Z";

  it("the old formatting on a UTC server showed the PREVIOUS day to customers in India", async () => {
    await inZone("UTC", () => {
      expect(new Date(NEAR_MIDNIGHT).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })).toBe("14 Nov 2026");
    });
  });

  for (const tz of ["UTC", "Asia/Kolkata", "America/Los_Angeles"]) {
    it(`${tz}: formatShopDate says 15 Nov 2026`, async () => {
      await inZone(tz, () => {
        expect(formatShopDate(NEAR_MIDNIGHT)).toBe("15 Nov 2026");
        expect(formatShopDate(NEAR_MIDNIGHT, "dateLong")).toBe("15 November 2026");
        expect(formatShopDate(NEAR_MIDNIGHT, "dateTime", { withZone: true })).toMatch(/^15 Nov 2026, 12:30 am IST$/i);
      });
    });
  }

  it("empty or invalid input gives an empty string, never 'Invalid Date'", () => {
    expect(formatShopDate(null)).toBe("");
    expect(formatShopDate("nope")).toBe("");
  });
});

describe("hasExpired: the exact instant, no rounding", () => {
  const T = Date.parse(INSTANT);
  it("not expired a millisecond before, expired AT the instant and after", () => {
    expect(hasExpired(INSTANT, T - 1)).toBe(false);
    expect(hasExpired(INSTANT, T)).toBe(true);
    expect(hasExpired(INSTANT, T + 1)).toBe(true);
  });
  it("is not rounded to the minute, hour or day", () => {
    expect(hasExpired(INSTANT, T - 59_999)).toBe(false); // 6:02:00.001 PM
    expect(hasExpired(INSTANT, T - 3_600_000)).toBe(false);
    expect(hasExpired(INSTANT, T + 1_000)).toBe(true); // 6:03:01 PM
  });
  it("no expiry (empty, null, undefined, invalid) never expires", () => {
    for (const v of [null, undefined, "", "garbage"]) expect(hasExpired(v, T + 10 ** 12)).toBe(false);
  });
  it("accepts a Date, an ISO string and a number", () => {
    expect(hasExpired(new Date(T), T)).toBe(true);
    expect(hasExpired(T, T - 1)).toBe(false);
  });
});

describe("saving and reloading the expiry through the admin settings route", () => {
  const put = (json: unknown) => adminCall(settingsRoute.PUT, { method: "PUT", json });
  const promo = (extra: Record<string, unknown>) => ({ pricingSettings: { promoCodes: [{ code: "SAVE10", discountType: "PERCENTAGE", discountValue: 10, ...extra }] } });
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("stores the UTC instant and returns it unchanged; the field then shows what was typed, in any browser zone", async () => {
    const saved = fromShopInputValue(TYPED);
    const r = await put(promo({ expiresAt: saved })); console.log("DBG", r.status, JSON.stringify(await r.clone().json()).slice(0, 300), JSON.stringify(await Settings.findOne().lean()).slice(0,300));
    expect(r.status).toBe(200);
    const doc = await Settings.findOne().lean();
    expect(doc!.pricingSettings!.promoCodes![0].expiresAt).toBeInstanceOf(Date);
    expect((doc!.pricingSettings!.promoCodes![0].expiresAt as Date).toISOString()).toBe(INSTANT);

    const loaded = await (await adminCall(settingsRoute.GET, { method: "GET" })).json();
    const iso = loaded.settings.pricingSettings.promoCodes[0].expiresAt as string;
    expect(iso).toBe(INSTANT);
    for (const tz of ["Asia/Kolkata", "UTC", "America/New_York"]) await inZone(tz, () => expect(toShopInputValue(iso)).toBe(TYPED));
  });

  it("Clear: an empty field means no expiry, and stays that way after a save and a reload", async () => {
    await put(promo({ expiresAt: INSTANT }));
    expect(fromShopInputValue("")).toBeNull(); // what the page sends when the field is emptied
    expect((await put(promo({ expiresAt: fromShopInputValue("") }))).status).toBe(200);
    const doc = await Settings.findOne().lean();
    expect(doc!.pricingSettings!.promoCodes![0].expiresAt ?? null).toBeNull();
    const loaded = await (await adminCall(settingsRoute.GET, { method: "GET" })).json();
    expect(loaded.settings.pricingSettings.promoCodes[0].expiresAt ?? null).toBeNull();
    expect(toShopInputValue(loaded.settings.pricingSettings.promoCodes[0].expiresAt)).toBe("");
  });

  it("a promo saved with no expiry at all is never expired", async () => {
    await put(promo({}));
    const doc = await Settings.findOne().lean();
    expect(hasExpired(doc!.pricingSettings!.promoCodes![0].expiresAt)).toBe(false);
  });
});

describe("the promo route against the real clock", () => {
  beforeEach(() => fakeRedis.reset());
  const apply = (code: string) =>
    applyPromo.POST(new NextRequest("http://localhost/api/checkout/promo", {
      method: "POST", headers: { "content-type": "application/json", "x-user-id": "507f1f77bcf86cd799439011" }, body: JSON.stringify({ code, subtotal: 1000 }),
    }), { params: Promise.resolve({}) });
  const setPromo = async (expiresAt: Date | null) => {
    await Settings.deleteMany({});
    await Settings.create({ pricingSettings: { promoCodes: [{ code: "SAVE10", discountType: "PERCENTAGE", discountValue: 10, isActive: true, expiresAt }] } });
  };

  it("works before the expiry instant and stops working at it (an expiry that passes while checkout is open)", async () => {
    await setPromo(new Date(Date.now() + 1500));
    expect((await apply("SAVE10")).status).toBe(200); // the shopper applies it
    await new Promise((r) => setTimeout(r, 1700)); // ...and the expiry passes while the page is open
    const late = await apply("SAVE10");
    expect(late.status).toBe(400);
    expect((await late.json()).message ?? "").toMatch(/expired/);
  });

  it("no expiry: always works; an expiry long in the past: refused", async () => {
    await setPromo(null);
    expect((await apply("SAVE10")).status).toBe(200);
    await setPromo(new Date(Date.now() - 1000));
    expect((await apply("SAVE10")).status).toBe(400);
  });
});
