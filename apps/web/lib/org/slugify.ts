/**
 * Normalize a display name into a URL-safe org slug.
 * Lowercase, alphanumeric + hyphens only, collapse repeats, max ~50 chars.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}

/**
 * `attempt === 0` → slug unchanged; thereafter `slug-2`, `slug-3`, …
 */
export function withSuffix(slug: string, attempt: number): string {
  if (attempt === 0) return slug;
  return `${slug}-${attempt + 1}`;
}
