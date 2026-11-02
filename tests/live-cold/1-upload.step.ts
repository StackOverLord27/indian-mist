import { describe, expect, it } from "vitest";
import cloudinary, { uploadImage } from "@/lib/cloudinary";
import { saveState, TEST_FOLDER } from "./state";

// Real PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");

describe("step 1: upload (process 1)", () => {
  it("uploads one image to the test folder through the app's own module", async () => {
    const { url, publicId } = await uploadImage(PNG, { folder: TEST_FOLDER });
    expect(publicId.startsWith(`${TEST_FOLDER}/`)).toBe(true); // refuse to continue anywhere else
    expect((await cloudinary.api.resource(publicId)).public_id).toBe(publicId);
    const live = await fetch(url);
    expect(live.status).toBe(200);
    saveState({ publicId, url });
    console.log(`[step1] uploaded ${publicId}`);
  });
});
