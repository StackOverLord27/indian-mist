/** "hiking-gear" -> "Hiking Gear": what to show when a category has no record (deleted or never created). */
export function humaniseSlug(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** The category's real name from a slug -> name map, with a readable fallback. */
export function categoryLabel(names: Record<string, string>, slug: string): string {
  return names[slug] || humaniseSlug(slug);
}
