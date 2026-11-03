/**
 * Browser-side image preparation for every admin upload.
 *
 * Done with the canvas directly (no library): the work is ~100 lines, the browser already has
 * a fast native decoder/encoder, EXIF orientation is handled by the decoder, and it keeps an
 * extra dependency out of the admin bundle. This module is only imported by admin components.
 *
 * What it does to each picked file:
 *  - leaves it alone when it is already small, upright and not too many pixels;
 *  - otherwise decodes it (EXIF orientation applied), scales it so the longest side is at most
 *    the profile's limit, and re-encodes to WebP (JPEG, or PNG when it has transparency, where
 *    the browser cannot encode WebP), lowering quality and then size in steps until it is under
 *    the budget;
 *  - never returns a file above the budget: it throws ImagePrepareError with a readable message.
 */
import {
  PROFILES,
  type ImageProfile,
  type ProfileName,
  canLeaveAlone,
  encodeAttempts,
  fitWithin,
  formatBytes,
  howManyFit,
  perFileBudget,
  readJpegOrientation,
  tooManyForOneSaveMessage,
  MAX_IMAGE_BYTES,
} from "./image-budget";

export class ImagePrepareError extends Error {
  constructor(message: string, public readonly fileName?: string) {
    super(message);
    this.name = "ImagePrepareError";
  }
}

export type PrepareProgress = { index: number; total: number; name: string };

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

let webpSupported: Promise<boolean> | null = null;
function canEncodeWebp(): Promise<boolean> {
  webpSupported ??= new Promise<boolean>((resolve) => {
    const c = document.createElement("canvas");
    c.width = c.height = 2;
    c.toBlob((b) => resolve(b?.type === "image/webp"), "image/webp", 0.8);
  });
  return webpSupported;
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: File): Promise<Decoded> {
  try {
    // 'from-image' = apply the EXIF orientation, so a phone photo is upright
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    // Older browsers: decode through an <img> (modern ones apply the orientation there too)
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
    } catch {
      throw new ImagePrepareError(`"${file.name}" could not be read as an image.`, file.name);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** True when any pixel is not fully opaque (checked on a small copy). */
function hasTransparency(decoded: Decoded): boolean {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(decoded.source, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function renamed(name: string, type: string): string {
  const ext = type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg";
  return `${name.replace(/\.[^./\\]+$/, "") || "image"}.${ext}`;
}

export type PreparedImage = { file: File; originalSize: number; changed: boolean };

/** Prepares ONE file for a budget (bytes). */
export async function prepareImage(file: File, opts: { profile?: ProfileName | ImageProfile; budgetBytes?: number } = {}): Promise<PreparedImage> {
  const profile = typeof opts.profile === "object" ? opts.profile : PROFILES[opts.profile ?? "standard"];
  const budget = opts.budgetBytes ?? profile.budgetBytes;

  if (!ACCEPTED.includes(file.type)) {
    throw new ImagePrepareError(`"${file.name}" is not a JPEG, PNG or WebP image.`, file.name);
  }

  const decoded = await decode(file);
  try {
    const orientation = file.type === "image/jpeg" ? readJpegOrientation(new Uint8Array(await file.slice(0, 65536).arrayBuffer())) : 1;
    if (canLeaveAlone({ type: file.type, size: file.size, width: decoded.width, height: decoded.height, orientation }, profile, budget)) {
      return { file, originalSize: file.size, changed: false };
    }

    const webp = await canEncodeWebp();
    const transparent = file.type !== "image/jpeg" && hasTransparency(decoded);
    // WebP keeps transparency. Without WebP: PNG when transparent (it cannot be made lighter by
    // quality, only by size), otherwise JPEG.
    const type = webp ? "image/webp" : transparent ? "image/png" : "image/jpeg";
    const longest = Math.max(decoded.width, decoded.height);

    let lastDimension = 0;
    let canvas: HTMLCanvasElement | null = null;
    for (const attempt of encodeAttempts(profile, longest)) {
      if (type === "image/png" && attempt.maxDimension === lastDimension) continue; // quality means nothing for PNG
      if (attempt.maxDimension !== lastDimension || !canvas) {
        const { width, height } = fitWithin(decoded.width, decoded.height, attempt.maxDimension);
        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new ImagePrepareError("This browser cannot process images.", file.name);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(decoded.source, 0, 0, width, height);
        lastDimension = attempt.maxDimension;
      }
      const blob = await toBlob(canvas, type, attempt.quality);
      if (blob && blob.type === type && blob.size <= budget) {
        // Never make a file bigger: if the original already met the budget and the pixel limit
        // (only its orientation needed fixing) the re-encoded one is still what we want.
        return { file: new File([blob], renamed(file.name, type), { type, lastModified: Date.now() }), originalSize: file.size, changed: true };
      }
    }
    throw new ImagePrepareError(
      `"${file.name}" cannot be made small enough (limit ${formatBytes(budget)} per image). Try a smaller or simpler photo.`,
      file.name,
    );
  } finally {
    decoded.close();
  }
}

export type PrepareManyResult = { files: File[]; originalBytes: number; preparedBytes: number };

/**
 * Prepares several files that will travel in ONE request: each gets a share of the request budget.
 * Throws ImagePrepareError when one cannot be made to fit; the message says how many to add per save.
 */
export async function prepareImages(
  files: File[],
  opts: { profile?: ProfileName; sentTogether?: boolean; extraBytes?: number; onProgress?: (p: PrepareProgress) => void } = {},
): Promise<PrepareManyResult> {
  const profile = PROFILES[opts.profile ?? "standard"];
  const budget = opts.sentTogether ? perFileBudget(profile, files.length, opts.extraBytes) : profile.budgetBytes;
  const out: File[] = [];
  for (const [index, file] of files.entries()) {
    opts.onProgress?.({ index, total: files.length, name: file.name });
    try {
      out.push((await prepareImage(file, { profile, budgetBytes: budget })).file);
    } catch (error) {
      if (opts.sentTogether && files.length > 1 && error instanceof ImagePrepareError) {
        const fit = howManyFit(out.map((f) => f.size), opts.extraBytes);
        throw new ImagePrepareError(tooManyForOneSaveMessage(files.length, Math.max(fit, 1)), file.name);
      }
      throw error;
    }
  }
  const tooBig = out.find((f) => f.size > MAX_IMAGE_BYTES);
  if (tooBig) throw new ImagePrepareError(`"${tooBig.name}" is still too large after optimising.`, tooBig.name);
  return { files: out, originalBytes: files.reduce((s, f) => s + f.size, 0), preparedBytes: out.reduce((s, f) => s + f.size, 0) };
}
