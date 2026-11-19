import { describe, expect, it } from "vitest";
import { uploadImage, deleteImage } from "@/lib/cloudinary";
import cloudinary from "@/lib/cloudinary";

// Real Cloudinary through the app's own helpers. Only touches
// `indian-mist-test/` and deletes what it uploads.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");

describe("cloudinary (live)", () => {
  it("uploads then deletes via the app helpers", async () => {
    const { url, publicId } = await uploadImage(PNG, { folder: "indian-mist-test" });
    try {
      expect(url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
      expect(publicId.startsWith("indian-mist-test/")).toBe(true);
      expect((await cloudinary.api.resource(publicId)).public_id).toBe(publicId);
    } finally {
      await deleteImage(publicId);
    }
    await expect(cloudinary.api.resource(publicId)).rejects.toMatchObject({ error: { http_code: 404 } });
  });
});
