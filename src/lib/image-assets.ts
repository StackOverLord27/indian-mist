import { Product } from "@/models/product.model";
import { Category } from "@/models/category.model";
import { Blog } from "@/models/blog.model";
import Carousel from "@/models/carousel.model";
import About from "@/models/about.model";
import Settings from "@/models/settings.model";
import { getCloudinaryConfig } from "@/lib/env";

/** Every Cloudinary upload of this app lives under this folder (see the upload calls). */
export const ASSET_FOLDER_PREFIX = "indian-mist/";

/** True when any document in the database still points at this Cloudinary file. */
export async function isAssetReferenced(publicId: string): Promise<boolean> {
  if (!publicId) return false;
  const counts = await Promise.all([
    Product.countDocuments({ "images.publicId": publicId }),
    Category.countDocuments({ "image.publicId": publicId }),
    Blog.countDocuments({ "coverImage.publicId": publicId }),
    Carousel.countDocuments({ publicId }),
    About.countDocuments({
      $or: [
        { "story.image.publicId": publicId },
        { "gallery.images.publicId": publicId },
        { "customSections.imagePublicId": publicId },
        { "teamPhoto.publicId": publicId },
      ],
    }),
    Settings.countDocuments({
      $or: [{ "sizeChart.publicId": publicId }, { "brandStorySettings.imagePublicId": publicId }],
    }),
  ]);
  return counts.some((n) => n > 0);
}

/**
 * The Cloudinary public id behind one of OUR image URLs, or null for anything else (other
 * hosts, other accounts, folders this app does not use). Used only for old documents that
 * stored a URL without the id.
 */
export function publicIdFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  let cloudName: string;
  try {
    cloudName = getCloudinaryConfig().cloud_name;
  } catch {
    return null;
  }
  const match = url.match(/^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(?:v\d+\/)?(.+)\.[A-Za-z0-9]+$/);
  if (!match || match[1] !== cloudName) return null;
  const publicId = decodeURIComponent(match[2]);
  return publicId.startsWith(ASSET_FOLDER_PREFIX) ? publicId : null;
}
