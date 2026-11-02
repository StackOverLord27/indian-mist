import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudinary", async () => (await import("./helpers/cloudinary")).cloudinaryModuleMock());

import { cloudinaryCalls } from "./helpers/cloudinary";
import { v2 as sdk } from "cloudinary";
import * as mod from "@/lib/cloudinary";

beforeEach(() => {
  cloudinaryCalls.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("cloudinary module", () => {
  // This must stay the FIRST test: it relies on the module not having been used yet in this file.
  it("deleting works on a cold instance that never uploaded: credentials are applied first", async () => {
    expect(sdk.config).not.toHaveBeenCalled();
    const result = await mod.deleteImage("indian-mist/x/1");
    expect(result).toEqual({ publicId: "indian-mist/x/1", ok: true, result: "ok" });
    expect(sdk.config).toHaveBeenCalledTimes(1);
    expect(sdk.config).toHaveBeenCalledWith(expect.objectContaining({ cloud_name: "test-cloud", api_key: "test-key", api_secret: "test-secret" }));
    expect(vi.mocked(sdk.config).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(sdk.uploader.destroy).mock.invocationCallOrder[0]);
  });

  it("credentials are applied once, shared by upload and delete", async () => {
    await mod.uploadImage(Buffer.from("x"), { folder: "indian-mist-test" });
    await mod.deleteImage("a");
    await mod.deleteManyImages(["b", "c"]);
    // the first test already applied them; nothing re-applies them (mock history is cleared between tests)
    expect(sdk.config).not.toHaveBeenCalled();
  });

  it("purges the CDN copy as well", async () => {
        await mod.deleteImage("indian-mist/x/1");
    expect(cloudinaryCalls.destroyOptions[0]).toEqual({ invalidate: true });
  });

  it("never throws: a failure is returned and logged with an identifiable prefix", async () => {
        cloudinaryCalls.failNextDestroy = true;
    const result = await mod.deleteImage("indian-mist/x/1");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/mock destroy failure/);
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).toContain("[cloudinary:delete]");
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).toContain("indian-mist/x/1");
  });

  it("a file that is already gone counts as deleted", async () => {
        vi.mocked(sdk.uploader.destroy).mockResolvedValueOnce({ result: "not found" });
    expect(await mod.deleteImage("gone")).toMatchObject({ ok: true, result: "not found" });
  });

  it("an unexpected answer is reported as a failure", async () => {
        vi.mocked(sdk.uploader.destroy).mockResolvedValueOnce({ result: "error" });
    expect((await mod.deleteImage("weird")).ok).toBe(false);
  });

  it("blank ids are skipped without calling Cloudinary", async () => {
        expect(await mod.deleteImage("")).toMatchObject({ ok: true, result: "skipped" });
    expect(await mod.deleteImage("   ")).toMatchObject({ ok: true, result: "skipped" });
    expect(cloudinaryCalls.destroys).toEqual([]);
  });

  it("deleteManyImages reports exactly which ids failed, ignores duplicates and blanks", async () => {
        cloudinaryCalls.failDestroyIds.add("bad/1");
    cloudinaryCalls.failDestroyIds.add("bad/2");
    const report = await mod.deleteManyImages(["ok/1", "bad/1", "ok/1", "", "bad/2", "ok/2"]);
    expect(report.failed.sort()).toEqual(["bad/1", "bad/2"]);
    expect(report.results).toHaveLength(4);
    expect(cloudinaryCalls.destroys.sort()).toEqual(["ok/1", "ok/2"]);
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).toMatch(/left behind.*bad\/1/);
  });

  it("a missing credential is reported by name instead of throwing (fresh copy of the module)", async () => {
    vi.resetModules();
    const fresh = await import("@/lib/cloudinary");
    vi.stubEnv("CLOUDINARY_API_SECRET", "");
    const result = await fresh.deleteImage("indian-mist/x/1");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("CLOUDINARY_API_SECRET");
    vi.unstubAllEnvs();
  });
});
