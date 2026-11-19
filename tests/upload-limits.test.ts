import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { cloudinaryCalls } from "./helpers/cloudinary";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("cloudinary", async () => (await import("./helpers/cloudinary")).cloudinaryModuleMock());
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());

import { Product } from "@/models/product.model";
import { Category } from "@/models/category.model";
import Carousel from "@/models/carousel.model";
import { Blog } from "@/models/blog.model";
import * as products from "@/app/api/admin/products/route";
import * as productById from "@/app/api/admin/products/[id]/route";
import * as categories from "@/app/api/admin/categories/route";
import * as categoryById from "@/app/api/admin/categories/[id]/route";
import * as carousel from "@/app/api/admin/carousel/route";
import * as carouselById from "@/app/api/admin/carousel/[id]/route";
import * as blogs from "@/app/api/admin/blogs/route";
import * as blogById from "@/app/api/admin/blogs/[id]/route";
import * as about from "@/app/api/admin/about/route";
import * as upload from "@/app/api/admin/upload/route";
import * as sizeChart from "@/app/api/admin/size-chart/route";
import { validateImageFile, assertRequestSize, ApiError } from "@/lib/api-helpers";
import { MAX_IMAGE_BYTES, REQUEST_LIMIT_BYTES } from "@/lib/image-budget";
import { getApiErrorMessage } from "@/lib/admin-error";
import { AxiosError, type AxiosResponse } from "axios";

setupTestDb();
beforeEach(() => cloudinaryCalls.reset());

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const jpeg = (bytes: number) => Buffer.concat([JPEG_HEAD, Buffer.alloc(Math.max(0, bytes - JPEG_HEAD.length), 7)]);

function formRequest(method: string, form: FormData, declaredLength?: number) {
  const headers = new Headers({ "x-user-role": "admin", "x-user-id": "u1", "x-user-email": "a@b.c" });
  if (declaredLength !== undefined) headers.set("content-length", String(declaredLength));
  return new NextRequest("http://localhost/api/test", { method, headers, body: form });
}
const call = (h: Handler, req: NextRequest, params: Record<string, string> = {}) => h(req, { params: Promise.resolve(params) });

const small = () => {
  const f = new FormData();
  f.append("name", "x");
  f.append("image", new File([jpeg(2000)], "a.jpg", { type: "image/jpeg" }));
  return f;
};

describe("validateImageFile: the per-file limit matches the client budgets", () => {
  it("accepts a file at the limit and refuses one byte over, with a readable message", () => {
    expect(validateImageFile({ mimetype: "image/jpeg", size: MAX_IMAGE_BYTES, buffer: jpeg(100) }).valid).toBe(true);
    const over = validateImageFile({ mimetype: "image/jpeg", size: MAX_IMAGE_BYTES + 1, buffer: jpeg(100) });
    expect(over.valid).toBe(false);
    expect(over.message).toMatch(/limit is 2\.1 MB/);
    expect(over.message).toMatch(/reload/i);
  });
  it("is lower than the old 10 MB, so an old browser tab sending a raw photo is refused", () => {
    expect(MAX_IMAGE_BYTES).toBeLessThan(10 * 1024 * 1024);
    expect(validateImageFile({ mimetype: "image/jpeg", size: 6 * 1024 * 1024, buffer: jpeg(100) }).valid).toBe(false);
  });
  it("still checks the real file type, not just the declared one", () => {
    expect(validateImageFile({ mimetype: "image/jpeg", size: 100, buffer: Buffer.from("not an image at all") }).valid).toBe(false);
    expect(validateImageFile({ mimetype: "image/gif", size: 100, buffer: jpeg(100) }).valid).toBe(false);
    expect(validateImageFile({ mimetype: "image/webp", size: 100, buffer: Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]) }).valid).toBe(true);
  });
});

describe("assertRequestSize", () => {
  const req = (len?: string) => new Request("http://x", { method: "POST", headers: len ? { "content-length": len } : {}, body: "a" });
  it("passes at the limit and when no length is declared; refuses above with a 413", () => {
    expect(() => assertRequestSize(req(String(REQUEST_LIMIT_BYTES)))).not.toThrow();
    expect(() => assertRequestSize(req())).not.toThrow();
    expect(() => assertRequestSize(req("abc"))).not.toThrow();
    try {
      assertRequestSize(req(String(REQUEST_LIMIT_BYTES + 1)));
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(413);
      expect((e as ApiError).message).toMatch(/too large .*4\.5 MB/);
    }
  });
});

describe("every upload route refuses an oversize body before reading it", () => {
  const tooBig = REQUEST_LIMIT_BYTES + 1_000_000;

  async function seed() {
    const product = await Product.create({ name: "P", slug: "p", description: "d", category: "tees", price: 1, images: [{ url: "https://x/a.jpg", publicId: "indian-mist/products/a", alt: "", isPrimary: true }] });
    const category = await Category.create({ name: "C", slug: "c" });
    const slide = await Carousel.create({ url: "https://x/c.jpg", publicId: "indian-mist/carousel/c" });
    const blog = await Blog.create({ title: "B", slug: "b", excerpt: "e", content: "c", category: "x", author: "a", coverImage: { url: "https://x/b.jpg", publicId: "indian-mist/blogs/b", alt: "" } });
    return { product: String(product._id), category: String(category._id), slide: String(slide._id), blog: String(blog._id) };
  }

  it("products, categories, carousel, blogs, about, upload, size chart (create and update)", async () => {
    const id = await seed();
    const cases: [string, Handler, string, Record<string, string>][] = [
      ["POST /products", products.POST, "POST", {}],
      ["PUT /products/[id]", productById.PUT, "PUT", { id: id.product }],
      ["POST /categories", categories.POST, "POST", {}],
      ["PUT /categories/[id]", categoryById.PUT, "PUT", { id: id.category }],
      ["POST /carousel", carousel.POST, "POST", {}],
      ["PUT /carousel/[id]", carouselById.PUT, "PUT", { id: id.slide }],
      ["POST /blogs", blogs.POST, "POST", {}],
      ["PUT /blogs/[id]", blogById.PUT, "PUT", { id: id.blog }],
      ["PUT /about", about.PUT, "PUT", {}],
      ["POST /upload", upload.POST, "POST", {}],
      ["PUT /size-chart", sizeChart.PUT, "PUT", {}],
    ];
    for (const [label, handler, method, params] of cases) {
      const req = formRequest(method, small(), tooBig);
      const readBody = vi.spyOn(req, "formData");
      const res = await call(handler, req, params);
      expect(res.status, label).toBe(413);
      const body = await res.json();
      expect(body.message, label).toMatch(/too large/);
      expect(body.message, label).toMatch(/4\.5 MB/);
      expect(readBody, `${label}: body was read`).not.toHaveBeenCalled();
    }
    expect(cloudinaryCalls.uploads, "nothing reached Cloudinary").toHaveLength(0);
  });

  it("a request within the limit is not blocked by the guard", async () => {
    const f = new FormData();
    f.append("file", new File([jpeg(5000)], "a.jpg", { type: "image/jpeg" }));
    const res = await call(upload.POST, formRequest("POST", f, 6000));
    expect(res.status).toBe(201); // saved: the guard let it through
  });

  it("with no declared length, the files are still checked once read", async () => {
    const f = new FormData();
    for (let i = 0; i < 3; i++) f.append("images", new File([jpeg(1_900_000)], `p${i}.jpg`, { type: "image/jpeg" }));
    f.append("name", "x");
    const res = await call(products.POST, formRequest("POST", f));
    expect(res.status).toBe(413);
    expect((await res.json()).message).toMatch(/too large together/);
  });

  it("a single file over the per-file limit is a 400 with the reason", async () => {
    const f = new FormData();
    f.append("file", new File([jpeg(MAX_IMAGE_BYTES + 5_000)], "big.jpg", { type: "image/jpeg" }));
    const res = await call(upload.POST, formRequest("POST", f, MAX_IMAGE_BYTES + 6_000));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/limit is 2\.1 MB/);
  });
});

describe("the admin sees the message", () => {
  const axiosError = (data: unknown, status: number) => new AxiosError("Request failed with status code", "ERR_BAD_REQUEST", undefined, undefined, { status, data } as AxiosResponse);
  it("our own 413 shows its message; the platform's non-JSON 413 gets a friendly one", () => {
    expect(getApiErrorMessage(axiosError({ message: "This upload is too large (6.0 MB; the limit is 4.5 MB per save). Use fewer or smaller images." }, 413))).toMatch(/too large \(6\.0 MB/);
    expect(getApiErrorMessage(axiosError("Request Entity Too Large", 413))).toBe("This upload is too large. Use fewer or smaller images and try again.");
    expect(getApiErrorMessage(axiosError("", 413))).toMatch(/too large/);
  });
});
