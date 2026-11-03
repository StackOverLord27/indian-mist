import { describe, expect, it } from "vitest";
import {
  PROFILES, REQUEST_LIMIT_BYTES, REQUEST_TARGET_BYTES, REQUEST_FIELDS_ALLOWANCE, MULTIPART_FILE_OVERHEAD, MAX_IMAGE_BYTES,
  perFileBudget, requestSize, howManyFit, fitWithin, encodeAttempts, readJpegOrientation, canLeaveAlone, formatBytes, tooManyForOneSaveMessage,
} from "@/lib/image-budget";

describe("limits are consistent with each other", () => {
  it("target < Vercel's cap, and every client budget fits the server's per-file limit", () => {
    expect(REQUEST_TARGET_BYTES).toBeLessThan(REQUEST_LIMIT_BYTES);
    expect(REQUEST_LIMIT_BYTES).toBe(4_500_000);
    for (const p of Object.values(PROFILES)) {
      expect(p.budgetBytes).toBeLessThan(MAX_IMAGE_BYTES);
      expect(p.maxDimension).toBeLessThanOrEqual(2000); // the Cloudinary pipeline caps at 2000
      expect(p.minDimension).toBeLessThanOrEqual(p.maxDimension);
      expect(p.minQuality).toBeLessThanOrEqual(p.startQuality);
    }
    expect(PROFILES.sizeChart.maxDimension).toBeGreaterThan(PROFILES.standard.maxDimension);
    expect(PROFILES.sizeChart.budgetBytes).toBeGreaterThan(PROFILES.standard.budgetBytes);
    expect(PROFILES.sizeChart.minQuality).toBeGreaterThan(PROFILES.standard.minQuality);
  });
});

describe("perFileBudget", () => {
  const p = PROFILES.standard;
  it("one to five photos get the full budget", () => {
    for (const n of [1, 2, 3, 4, 5]) expect(perFileBudget(p, n)).toBe(p.budgetBytes);
  });
  it("more photos share the request: the total never goes over the target", () => {
    for (let n = 1; n <= 10; n++) {
      const each = perFileBudget(p, n);
      expect(requestSize(Array(n).fill(each))).toBeLessThanOrEqual(REQUEST_TARGET_BYTES);
    }
    expect(perFileBudget(p, 10)).toBeLessThan(perFileBudget(p, 6));
    expect(perFileBudget(p, 10)).toBeGreaterThan(300_000);
  });
  it("bad counts do not break it", () => {
    expect(perFileBudget(p, 0)).toBe(p.budgetBytes);
    expect(perFileBudget(p, -3)).toBe(p.budgetBytes);
    expect(perFileBudget(p, 2.9)).toBe(perFileBudget(p, 2));
  });
  it("a large text allowance shrinks the share; an absurd one gives 0, never negative", () => {
    expect(perFileBudget(p, 10, 1_000_000)).toBeLessThan(perFileBudget(p, 10));
    expect(perFileBudget(p, 3, 10_000_000)).toBe(0);
  });
});

describe("requestSize / howManyFit", () => {
  it("adds framing per file and the text allowance", () => {
    expect(requestSize([100, 200])).toBe(REQUEST_FIELDS_ALLOWANCE + 300 + 2 * MULTIPART_FILE_OVERHEAD);
    expect(requestSize([])).toBe(REQUEST_FIELDS_ALLOWANCE);
  });
  it("counts how many files (in order) fit in one request", () => {
    expect(howManyFit([700_000, 700_000, 700_000])).toBe(3);
    expect(howManyFit([1_800_000, 1_800_000, 1_800_000])).toBe(2);
    expect(howManyFit([3_900_000, 100])).toBe(0);
    expect(howManyFit([])).toBe(0);
  });
  it("the message says how many to add", () => {
    expect(tooManyForOneSaveMessage(8, 5)).toContain("up to 5");
    expect(tooManyForOneSaveMessage(8, 5)).toContain("8 images");
    expect(tooManyForOneSaveMessage(3, 0)).toMatch(/too large/);
  });
});

describe("fitWithin", () => {
  it("scales the longest side down and keeps the shape", () => {
    expect(fitWithin(4000, 3000, 1800)).toEqual({ width: 1800, height: 1350 });
    expect(fitWithin(3000, 4000, 1800)).toEqual({ width: 1350, height: 1800 });
  });
  it("never scales up and never gives 0", () => {
    expect(fitWithin(800, 600, 1800)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(10000, 1, 1800).height).toBe(1);
  });
});

describe("encodeAttempts", () => {
  const p = PROFILES.standard;
  it("starts at full size and the starting quality, then lowers quality, then size", () => {
    const a = encodeAttempts(p, 4000);
    expect(a[0]).toEqual({ maxDimension: 1800, quality: p.startQuality });
    const sameSize = a.filter((x) => x.maxDimension === 1800).map((x) => x.quality);
    expect(sameSize).toEqual([...sameSize].sort((x, y) => y - x));
    expect(sameSize[sameSize.length - 1]).toBe(p.minQuality);
    const dims = [...new Set(a.map((x) => x.maxDimension))];
    expect(dims).toEqual([...dims].sort((x, y) => y - x));
  });
  it("never goes below the floors", () => {
    for (const a of encodeAttempts(p, 6000)) {
      expect(a.quality).toBeGreaterThanOrEqual(p.minQuality - 1e-9);
      expect(a.maxDimension).toBeGreaterThanOrEqual(p.minDimension);
    }
    expect(encodeAttempts(p, 6000).length).toBeLessThan(40);
  });
  it("a small picture is not enlarged", () => {
    expect(new Set(encodeAttempts(p, 1200).map((x) => x.maxDimension)).has(1200)).toBe(true);
    expect(Math.max(...encodeAttempts(p, 1200).map((x) => x.maxDimension))).toBe(1200);
  });
  it("the size chart keeps more pixels and quality", () => {
    const s = PROFILES.sizeChart;
    const a = encodeAttempts(s, 3000);
    expect(a[0].maxDimension).toBe(2000);
    expect(Math.min(...a.map((x) => x.quality))).toBeGreaterThanOrEqual(0.75 - 1e-9);
    expect(Math.min(...a.map((x) => x.maxDimension))).toBeGreaterThanOrEqual(1400);
  });
});

/** A tiny JPEG header with an EXIF segment holding the given orientation. */
function jpegWithOrientation(orientation: number, order: "II" | "MM" = "II") {
  const little = order === "II";
  const u16 = (n: number) => (little ? [n & 255, n >> 8] : [n >> 8, n & 255]);
  const u32 = (n: number) => (little ? [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24] : [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255]);
  const tiff = [...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8), ...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0, ...u32(0)];
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = exif.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...exif, 0xff, 0xda, 0, 0]);
}

describe("readJpegOrientation", () => {
  it("reads the orientation in both byte orders", () => {
    for (const o of [1, 3, 6, 8]) {
      expect(readJpegOrientation(jpegWithOrientation(o, "II"))).toBe(o);
      expect(readJpegOrientation(jpegWithOrientation(o, "MM"))).toBe(o);
    }
  });
  it("gives 1 for no EXIF, junk, a non-JPEG or a truncated file", () => {
    expect(readJpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 0]))).toBe(1);
    expect(readJpegOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(1);
    expect(readJpegOrientation(new Uint8Array([]))).toBe(1);
    expect(readJpegOrientation(jpegWithOrientation(6).subarray(0, 14))).toBe(1);
    expect(readJpegOrientation(jpegWithOrientation(9))).toBe(1); // not a valid orientation
  });
});

describe("canLeaveAlone", () => {
  const p = PROFILES.standard;
  const ok = { type: "image/jpeg", size: 300_000, width: 1600, height: 1200, orientation: 1 };
  it("small, upright, within the pixel limit: untouched", () => {
    expect(canLeaveAlone(ok, p, p.budgetBytes)).toBe(true);
  });
  it("too big in bytes, in pixels, rotated, or the wrong type: must be processed", () => {
    expect(canLeaveAlone({ ...ok, size: 900_000 }, p, p.budgetBytes)).toBe(false);
    expect(canLeaveAlone({ ...ok, width: 4000 }, p, p.budgetBytes)).toBe(false);
    expect(canLeaveAlone({ ...ok, orientation: 6 }, p, p.budgetBytes)).toBe(false);
    expect(canLeaveAlone({ ...ok, type: "image/gif" }, p, p.budgetBytes)).toBe(false);
  });
  it("a tighter budget (many photos in one request) makes a file that was fine need processing", () => {
    expect(canLeaveAlone({ ...ok, size: 500_000 }, p, perFileBudget(p, 10))).toBe(false);
  });
});

describe("formatBytes", () => {
  it("is readable", () => {
    expect(formatBytes(4_700_000)).toBe("4.7 MB");
    expect(formatBytes(2_097_152)).toBe("2.1 MB");
    expect(formatBytes(512_000)).toBe("512 KB");
    expect(formatBytes(1)).toBe("1 KB");
  });
});
