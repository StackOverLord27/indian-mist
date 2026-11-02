import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import { getCloudinaryConfig } from "@/lib/env";

export const uploadImage = async (
  buffer: Buffer,
  options?: { folder?: string; public_id?: string }
): Promise<{ url: string; publicId: string }> => {
  // Throws, naming the missing variable, if Cloudinary is not configured
  cloudinary.config(getCloudinaryConfig());

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
          console.error('[Cloudinary Upload Error]', error);
          reject(error);
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.warn("[Cloudinary] Delete failed:", publicId, error);
  }
}

export async function deleteManyImages(publicIds: string[]): Promise<void> {
  await Promise.all(publicIds.map(deleteImage));
}

export default cloudinary;
