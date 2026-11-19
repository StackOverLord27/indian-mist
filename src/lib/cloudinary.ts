import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import { getCloudinaryConfig } from "@/lib/env";

/*
 * Cloudinary access for every upload and delete in the app.
 *
 * Credentials are applied once, by whichever function runs first (upload OR delete), so deleting
 * works on a cold server instance that has never uploaded anything. They are read on first use
 * rather than at import time so `next build` does not need Cloudinary credentials; a missing
 * variable throws an error naming it.
 */
let configured = false;
function ensureConfigured() {
  if (configured) return;
  cloudinary.config({ ...getCloudinaryConfig(), secure: true });
  configured = true;
}

export const uploadImage = async (
  buffer: Buffer,
  options?: { folder?: string; public_id?: string }
): Promise<{ url: string; publicId: string }> => {
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options?.folder || "indian-mist",
        public_id: options?.public_id,
        // Stored image is capped at 2000px (never upscaled) and compressed
        transformation: [{ width: 2000, height: 2000, crop: "limit", quality: "auto" }],
      },
      (error, result) => {
        if (result) {
          resolve({ url: result.secure_url, publicId: result.public_id });
        } else {
          console.error("[cloudinary:upload] failed:", error);
          reject(error ?? new Error("Cloudinary upload failed"));
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

export type DeleteResult = {
  publicId: string;
  ok: boolean;
  /** Cloudinary's answer: "ok", "not found", or "skipped" for a blank id */
  result?: string;
  error?: string;
};

/**
 * Deletes one file and also purges its copy on the CDN (`invalidate`), so the old URL stops
 * working instead of being served from cache for days.
 *
 * Never throws: callers run this after the database no longer points at the file, and a
 * cleanup problem must not turn a saved change into an error. The result says what happened
 * and failures are logged with the "[cloudinary:delete]" prefix. A file that is already gone
 * counts as success.
 */
export async function deleteImage(publicId: string): Promise<DeleteResult> {
  if (!publicId || !publicId.trim()) return { publicId, ok: true, result: "skipped" };
  try {
    ensureConfigured();
    const response = (await cloudinary.uploader.destroy(publicId, { invalidate: true })) as { result?: string };
    const ok = response.result === "ok" || response.result === "not found";
    if (!ok) console.error(`[cloudinary:delete] unexpected answer for ${publicId}: ${response.result}`);
    return { publicId, ok, result: response.result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
    console.error(`[cloudinary:delete] failed for ${publicId}: ${message}`);
    return { publicId, ok: false, error: message };
  }
}

/**
 * Deletes several files (duplicates and blanks ignored). `failed` lists the ids that could not
 * be deleted so the caller can report or retry them.
 */
export async function deleteManyImages(publicIds: string[]): Promise<{ results: DeleteResult[]; failed: string[] }> {
  const unique = [...new Set(publicIds.filter((id) => id && id.trim()))];
  const results = await Promise.all(unique.map(deleteImage));
  const failed = results.filter((r) => !r.ok).map((r) => r.publicId);
  if (failed.length) console.error(`[cloudinary:delete] ${failed.length} file(s) left behind, remove manually: ${failed.join(", ")}`);
  return { results, failed };
}

export default cloudinary;
