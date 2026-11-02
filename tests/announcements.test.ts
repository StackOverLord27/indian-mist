import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
let mockPath = "/";
vi.mock("next/navigation", () => ({ usePathname: () => mockPath }));

import { revalidatePath } from "next/cache";
import Announcement from "@/models/announcement.model";
import * as list from "@/app/api/admin/announcements/route";
import * as byId from "@/app/api/admin/announcements/[id]/route";
import { getAnnouncementTexts } from "@/lib/storefront-data";
import { AnnouncementBarClient } from "@/components/home/AnnouncementBarClient";

setupTestDb();

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

function call(h: Handler, method: string, json?: unknown, id = "", role = "admin") {
  const headers = new Headers({ "x-user-role": role, "x-user-id": "u1", "x-user-email": "a@b.c" });
  if (json !== undefined) headers.set("content-type", "application/json");
  const req = new NextRequest("http://localhost/api/test", {
    method,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
  });
  return h(req, { params: Promise.resolve({ id }) });
}

const layoutRevalidations = () =>
  vi.mocked(revalidatePath).mock.calls.filter(([p, t]) => p === "/" && t === "layout").length;

async function create(text: string, extra: Record<string, unknown> = {}) {
  const res = await call(list.POST, "POST", { text, ...extra });
  expect(res.status).toBe(201);
  return String((await res.json()).announcement._id);
}

beforeEach(() => {
  vi.mocked(revalidatePath).mockClear();
  mockPath = "/";
});

describe("announcements API", () => {
  it("create → update text → toggle → delete, refreshing the storefront each time", async () => {
    const id = await create("  Free shipping  ");
    expect((await Announcement.findById(id))?.text).toBe("Free shipping"); // trimmed
    expect(layoutRevalidations()).toBe(1);

    const edited = await call(byId.PUT, "PUT", { text: "Free shipping over 999" }, id);
    expect(edited.status).toBe(200);
    const doc = await Announcement.findById(id);
    expect(doc?.text).toBe("Free shipping over 999");
    expect(doc?.isActive).toBe(true); // editing the text must not touch the on/off state
    expect(layoutRevalidations()).toBe(2);

    expect((await call(byId.PATCH, "PATCH", { isActive: false }, id)).status).toBe(200);
    const off = await Announcement.findById(id);
    expect(off?.isActive).toBe(false);
    expect(off?.text).toBe("Free shipping over 999"); // toggling must not touch the text
    expect(await getAnnouncementTexts()).toEqual([]);
    expect(layoutRevalidations()).toBe(3);

    expect((await call(byId.DELETE, "DELETE", undefined, id)).status).toBe(200);
    expect(await Announcement.countDocuments()).toBe(0);
    expect(layoutRevalidations()).toBe(4);
  });

  it("lists oldest first, in the same order as the storefront bar", async () => {
    const a = await create("first");
    await new Promise((r) => setTimeout(r, 5));
    const b = await create("second");
    await new Promise((r) => setTimeout(r, 5));
    const c = await create("third");
    // Editing or toggling must not move an item
    await call(byId.PUT, "PUT", { text: "first (edited)" }, a);
    await call(byId.PATCH, "PATCH", { isActive: false }, b);

    const body = await (await call(list.GET, "GET")).json();
    expect(body.announcements.map((x: { _id: string }) => String(x._id))).toEqual([a, b, c]);
    expect(await getAnnouncementTexts()).toEqual(["first (edited)", "third"]);
  });

  it("stores only text and isActive: link fields are dropped", async () => {
    const id = await create("Plain", { link: "/shop", linkText: "Go", linkUrl: "/x", order: 5 });
    const raw = await Announcement.collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    expect(raw).not.toHaveProperty("link");
    expect(raw).not.toHaveProperty("linkText");
    expect(raw).not.toHaveProperty("linkUrl");
    expect(raw).not.toHaveProperty("order");
    await call(byId.PUT, "PUT", { text: "Plain 2", link: "/shop" }, id);
    expect(await Announcement.collection.findOne({ _id: new mongoose.Types.ObjectId(id) })).not.toHaveProperty("link");
  });

  it("rejects empty, whitespace-only, too-long and non-string text without saving or refreshing", async () => {
    const id = await create("Keep me");
    vi.mocked(revalidatePath).mockClear();

    for (const bad of ["", "   ", "x".repeat(201), 42, null]) {
      const res = await call(list.POST, "POST", { text: bad });
      expect(res.status).toBe(400);
      expect((await res.json()).message).toBe("Validation failed");
      expect((await call(byId.PUT, "PUT", { text: bad }, id)).status).toBe(400);
    }
    expect((await call(list.POST, "POST", {})).status).toBe(400);
    expect((await call(byId.PUT, "PUT", {}, id)).status).toBe(400); // nothing to update
    expect((await call(byId.PUT, "PUT", { isActive: "yes" }, id)).status).toBe(400);

    expect((await call(list.POST, "POST", { text: "x".repeat(200) })).status).toBe(201); // exactly 200 is fine
    expect((await Announcement.findById(id))?.text).toBe("Keep me");
    expect(await Announcement.countDocuments()).toBe(2);
    expect(layoutRevalidations()).toBe(1); // only the valid 200-char create
  });

  it("unknown / malformed ids are a clean 404 and change nothing", async () => {
    const missing = String(new mongoose.Types.ObjectId());
    for (const id of [missing, "not-an-id"]) {
      expect((await call(byId.PUT, "PUT", { isActive: true }, id)).status).toBe(404);
      expect((await call(byId.DELETE, "DELETE", undefined, id)).status).toBe(404);
    }
    expect(layoutRevalidations()).toBe(0);
  });

  it("the reorder route is gone and only admins can use the rest", async () => {
    await expect(import("@/app/api/admin/announcements/reorder/route" as string)).rejects.toThrow();
    expect((await call(list.POST, "POST", { text: "x" }, "", "user")).status).toBe(403);
    expect((await call(list.GET, "GET", undefined, "", "user")).status).toBe(403);
    expect(await Announcement.countDocuments()).toBe(0);
  });

  it("old documents that still hold link fields keep working", async () => {
    await Announcement.collection.insertOne({
      text: "Legacy", link: "/old", linkText: "Old", order: 3, isActive: true, createdAt: new Date(), updatedAt: new Date(),
    });
    expect(await getAnnouncementTexts()).toEqual(["Legacy"]);
    const body = await (await call(list.GET, "GET")).json();
    expect(body.announcements).toHaveLength(1);
  });
});

describe("AnnouncementBarClient", () => {
  const render = (items: string[]) => renderToStaticMarkup(createElement(AnnouncementBarClient, { displayItems: items }));

  it("renders nothing for an empty list", () => {
    expect(render([])).toBe("");
  });

  it("renders nothing on admin pages", () => {
    mockPath = "/admin/announcements";
    expect(render(["Hello"])).toBe("");
  });

  it("shows several items for both mobile (carousel) and desktop (inline list)", () => {
    const html = render(["One", "Two", "Three"]);
    for (const t of ["One", "Two", "Three"]) expect(html.match(new RegExp(t, "g"))).toHaveLength(2);
    expect(html).toContain("md:hidden");
    expect(html).toContain("hidden md:flex");
    expect(html).not.toContain("<a ");
  });

  it("is not sticky by itself (the layout wrapper handles stickiness)", () => {
    expect(render(["One"])).not.toContain("sticky");
  });
});
