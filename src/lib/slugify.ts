export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** name + colour as a slug; adds -2, -3... if that slug is already taken */
export async function uniqueProductSlug(
  name: string,
  colorName: string,
  exists: (slug: string) => Promise<unknown>,
): Promise<string> {
  const base = slugify(`${name} ${colorName}`);
  let slug = base;
  for (let n = 2; await exists(slug); n++) slug = `${base}-${n}`;
  return slug;
}
