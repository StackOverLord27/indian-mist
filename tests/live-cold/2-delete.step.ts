import { describe, expect, it } from "vitest";
import cloudinary, { deleteImage } from "@/lib/cloudinary";
import { loadState, TEST_FOLDER } from "./state";

describe("step 2: delete on a cold instance (process 2, never uploaded)", () => {
  it("the SDK starts unconfigured, deleteImage configures it itself, and the asset is really gone", async () => {
    const { publicId, url } = loadState();
    expect(publicId.startsWith(`${TEST_FOLDER}/`)).toBe(true); // never touch anything outside the test folder

    // cold: nothing in this process has configured Cloudinary yet
    expect(cloudinary.config().api_key).toBeUndefined();
    expect(cloudinary.config().api_secret).toBeUndefined();

    const result = await deleteImage(publicId);
    expect(result).toMatchObject({ ok: true, result: "ok" });

    // really gone from Cloudinary's storage (the SDK is configured by now, by deleteImage)
    await expect(cloudinary.api.resource(publicId)).rejects.toMatchObject({ error: { http_code: 404 } });

    // and the CDN copy was purged (invalidate): the old URL stops working
    let status = 0;
    for (let i = 0; i < 10; i++) {
      status = (await fetch(`${url}?check=${Date.now()}`)).status;
      status = (await fetch(url)).status;
      if (status === 404) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    console.log(`[step2] deleted ${publicId}; CDN answer for the old URL: ${status}`);
    expect(status).toBe(404);

    // deleting again is harmless
    expect(await deleteImage(publicId)).toMatchObject({ ok: true, result: "not found" });
  });
});
