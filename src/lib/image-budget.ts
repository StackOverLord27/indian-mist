/**
 * Size rules for admin image uploads. Pure logic (no browser APIs), so it can be unit tested;
 * the browser side that applies it is in image-prepare.ts.
 *
 * Why: Vercel rejects a function request body above about 4.5 MB (413), so a form that sends
 * several photos in one request fails in production even though it works locally. Every admin
 * image therefore goes through the browser first (resized and re-encoded to fit a budget), and
 * the server refuses anything too big with a readable message.
 */

/** Vercel's request body cap. The server guard and the local proxy setting mirror it. */
export const REQUEST_LIMIT_BYTES = 4_500_000;
/** What the browser aims for in total per request: well under the cap. */
export const REQUEST_TARGET_BYTES = 4_000_000;
/** Room for the text fields of a form (product details, JSON lists) sent along with the files. */
export const REQUEST_FIELDS_ALLOWANCE = 120_000;
/** Multipart framing around each file (boundary, headers). Generous. */
export const MULTIPART_FILE_OVERHEAD = 1_000;
/** The server's limit for ONE file; above every client budget below. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type ImageProfile = {
  /** Longest side in pixels (the Cloudinary pipeline caps at 2000 anyway) */
  maxDimension: number;
  /** Target size of one file */
  budgetBytes: number;
  /** The picture is never shrunk below this longest side to meet a budget */
  minDimension: number;
  startQuality: number;
  /** The quality is never lowered below this to meet a budget */
  minQuality: number;
};

export const PROFILES = {
  /** Product, category, carousel, About, brand-story and blog images */
  standard: { maxDimension: 1800, budgetBytes: 700_000, minDimension: 1000, startQuality: 0.85, minQuality: 0.5 },
  /** The size chart is full of small text: more pixels, more quality, a bigger budget (it is sent alone) */
  sizeChart: { maxDimension: 2000, budgetBytes: 1_500_000, minDimension: 1400, startQuality: 0.92, minQuality: 0.75 },
} satisfies Record<string, ImageProfile>;

export type ProfileName = keyof typeof PROFILES;

/**
 * The size one file may be when `count` files are sent in the same request: the profile's budget,
 * or less when the request would otherwise go over the target.
 */
export function perFileBudget(profile: ImageProfile, count: number, extraBytes = REQUEST_FIELDS_ALLOWANCE): number {
  const n = Math.max(1, Math.floor(count));
  const share = Math.floor((REQUEST_TARGET_BYTES - extraBytes) / n) - MULTIPART_FILE_OVERHEAD;
  return Math.max(0, Math.min(profile.budgetBytes, share));
}

/** Size of the whole request for these file sizes. */
export function requestSize(sizes: number[], extraBytes = REQUEST_FIELDS_ALLOWANCE): number {
  return sizes.reduce((sum, s) => sum + s + MULTIPART_FILE_OVERHEAD, extraBytes);
}

/** How many of these files (taken in order) fit in one request. */
export function howManyFit(sizes: number[], extraBytes = REQUEST_FIELDS_ALLOWANCE): number {
  let used = extraBytes;
  let count = 0;
  for (const size of sizes) {
    used += size + MULTIPART_FILE_OVERHEAD;
    if (used > REQUEST_TARGET_BYTES) break;
    count++;
  }
  return count;
}

/** Scales (width, height) down so the longest side is at most `max`. Never scales up. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export type EncodeAttempt = { maxDimension: number; quality: number };

/**
 * The sequence of (size, quality) combinations to try until one fits the budget: full size at
 * falling quality first, then a smaller picture (steps of 15%) starting again from a middle
 * quality. Stops at the profile's floors.
 */
export function encodeAttempts(profile: ImageProfile, longestSide: number): EncodeAttempt[] {
  const attempts: EncodeAttempt[] = [];
  const qualities = (from: number) => {
    const list: number[] = [];
    for (let q = from; q >= profile.minQuality - 1e-9; q -= 0.08) list.push(Math.round(q * 100) / 100);
    if (list[list.length - 1] !== profile.minQuality && profile.minQuality <= from) list.push(profile.minQuality);
    return list;
  };

  let dimension = Math.min(longestSide, profile.maxDimension);
  let first = true;
  for (let step = 0; step < 8; step++) {
    const from = first ? profile.startQuality : Math.min(profile.startQuality, 0.75);
    for (const quality of qualities(from)) attempts.push({ maxDimension: Math.round(dimension), quality });
    first = false;
    const next = dimension * 0.85;
    if (next < profile.minDimension) break;
    dimension = next;
  }
  return attempts;
}

/**
 * EXIF orientation (1-8) of a JPEG, from its first bytes. 1 when there is none or the file is not
 * a JPEG. Orientation 1 means "as stored"; anything else means the photo must be rotated/flipped.
 */
export function readJpegOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return 1;
    const marker = bytes[i + 1];
    if (marker === 0xda || marker === 0xd9) return 1; // image data starts: no EXIF before it
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1 && i + 4 + 6 <= bytes.length && String.fromCharCode(...bytes.subarray(i + 4, i + 8)) === "Exif") {
      const tiff = i + 10; // after "Exif\0\0"
      if (tiff + 8 > bytes.length) return 1;
      const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
      const big = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
      if (!little && !big) return 1;
      const u16 = (o: number) => (little ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
      const u32 = (o: number) => (little ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0 : ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0);
      const ifd = tiff + u32(tiff + 4);
      if (ifd + 2 > bytes.length) return 1;
      const entries = u16(ifd);
      for (let e = 0; e < entries; e++) {
        const entry = ifd + 2 + e * 12;
        if (entry + 12 > bytes.length) return 1;
        if (u16(entry) === 0x0112) {
          const value = u16(entry + 8);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }
    i += 2 + length;
  }
  return 1;
}

/** True when a file can be uploaded exactly as it is: right type, small enough, small enough in pixels, upright. */
export function canLeaveAlone(f: { type: string; size: number; width: number; height: number; orientation: number }, profile: ImageProfile, budgetBytes: number): boolean {
  const okType = f.type === "image/jpeg" || f.type === "image/png" || f.type === "image/webp";
  return okType && f.size <= budgetBytes && Math.max(f.width, f.height) <= profile.maxDimension && f.orientation === 1;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/** The message when a group of images cannot be sent in one go. */
export function tooManyForOneSaveMessage(total: number, fit: number): string {
  if (fit <= 0) return "These images are too large to send. Try smaller photos.";
  return `These ${total} images are too large to save together. Add up to ${fit} now, save, then edit and add the rest.`;
}
