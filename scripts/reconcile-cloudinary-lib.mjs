// Pure helpers for scripts/reconcile-cloudinary.mjs (kept separate so they can be unit tested).

export const ASSET_PREFIX = "indian-mist/";

// Collections that can point at Cloudinary files (names as stored by the Mongoose models).
export const COLLECTIONS = ["products", "categories", "blogs", "carousels", "aboutpage", "sitesettings"];

const URL_RE = /^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(?:v\d+\/)?(.+)\.[A-Za-z0-9]+$/;

/** The Cloudinary public id inside one of our image URLs, or null. */
export function publicIdFromUrl(url) {
  const match = typeof url === "string" ? url.match(URL_RE) : null;
  if (!match) return null;
  try {
    return decodeURIComponent(match[2]);
  } catch {
    return null;
  }
}

/**
 * Every public id any document points at, found generically: fields named *publicId, and any
 * string that is a Cloudinary image URL (so documents that stored only a URL still protect
 * their file). New image fields added later are covered without changing this.
 */
export function collectReferencedIds(documents) {
  const ids = new Set();
  const walk = (value, key = "") => {
    if (typeof value === "string") {
      if (/publicid$/i.test(key) && value) ids.add(value);
      const fromUrl = publicIdFromUrl(value);
      if (fromUrl) ids.add(fromUrl);
    } else if (Array.isArray(value)) {
      for (const item of value) walk(item, key);
    } else if (value && typeof value === "object" && !(value instanceof Date) && typeof value.toHexString !== "function") {
      for (const [k, v] of Object.entries(value)) walk(v, k);
    }
  };
  for (const doc of documents) walk(doc);
  return ids;
}

/**
 * Files in Cloudinary that no document references.
 * Files younger than `minAgeHours` are never reported: an admin may have uploaded them a moment
 * ago and not saved yet.
 */
export function findOrphans(resources, referenced, { now = Date.now(), minAgeHours = 24 } = {}) {
  const cutoff = now - minAgeHours * 3600 * 1000;
  const orphans = [];
  const tooNew = [];
  for (const r of resources) {
    if (!r.public_id.startsWith(ASSET_PREFIX)) continue; // never touch anything outside the app's folder
    if (referenced.has(r.public_id)) continue;
    (new Date(r.created_at).getTime() > cutoff ? tooNew : orphans).push(r);
  }
  return { orphans, tooNew };
}

/**
 * Whether a delete run may go ahead. Returns null when allowed, otherwise the reason it is refused.
 * `label` is "<cloud name>/<database name>" of this run; the person must type it back.
 */
export function deleteRefusal({ label, confirm, referencedCount }) {
  if (confirm !== label) {
    return `Refusing to delete: pass --confirm=${label} to confirm this cloud and database are the right ones.`;
  }
  if (referencedCount === 0) {
    return "Refusing to delete: this database references no images at all, so it is probably the wrong database.";
  }
  return null;
}
