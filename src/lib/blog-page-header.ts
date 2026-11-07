import type { BlogPageSettings } from "@/types/admin";

// The wording the /blogs header had before it became editable. It is only a render-time
// fallback for "never saved" (nothing is written to the database), and it is what the admin form
// starts with, so the owner edits instead of retyping.
export const BLOG_HEADER_DEFAULTS = {
  eyebrow: "Indian Mist Journal",
  heading: "From the Trail",
  subtitle: "Stories, guides, and notes from the Indian Mist community — exploring the outdoors responsibly.",
} as const;

// Every page needs a title: used when the heading was saved empty
export const BLOG_HEADING_WHEN_EMPTY = "Blog";

export interface ResolvedBlogHeader {
  eyebrow: string;
  heading: string;
  subtitle: string;
}

/**
 * never saved (field missing)  -> the current wording
 * saved text                   -> that text
 * saved empty / only spaces    -> "" (the line is hidden); the heading becomes "Blog"
 */
export function resolveBlogHeader(saved: BlogPageSettings | null | undefined): ResolvedBlogHeader {
  const pick = (value: unknown, fallback: string) => (typeof value === "string" ? value.trim() : fallback);
  return {
    eyebrow: pick(saved?.eyebrow, BLOG_HEADER_DEFAULTS.eyebrow),
    heading: pick(saved?.heading, BLOG_HEADER_DEFAULTS.heading) || BLOG_HEADING_WHEN_EMPTY,
    subtitle: pick(saved?.subtitle, BLOG_HEADER_DEFAULTS.subtitle),
  };
}
