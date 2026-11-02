import { describe, expect, it } from "vitest";
import cloudinary, { deleteImage, deleteManyImages } from "@/lib/cloudinary";
import { clearState, TEST_FOLDER } from "./state";

describe("step 3: clean up anything left in the test folder (process 3)", () => {
  it("removes leftovers, only inside the test folder, and leaves nothing behind", async () => {
    // deleting a file that does not exist is harmless and configures the SDK
    await deleteImage(`${TEST_FOLDER}/__does-not-exist__`);
    const left = await cloudinary.api.resources({ type: "upload", prefix: `${TEST_FOLDER}/`, max_results: 100 });
    const ids: string[] = left.resources.map((r: { public_id: string }) => r.public_id);
    expect(ids.every((id) => id.startsWith(`${TEST_FOLDER}/`))).toBe(true);
    if (ids.length) {
      const report = await deleteManyImages(ids);
      expect(report.failed).toEqual([]);
    }
    const after = await cloudinary.api.resources({ type: "upload", prefix: `${TEST_FOLDER}/`, max_results: 100 });
    expect(after.resources).toHaveLength(0);
    clearState();
    console.log(`[step3] leftovers removed: ${ids.length}`);
  });
});
