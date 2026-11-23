import {getSiteUrl} from "@/lib/site";

/**
 * The same-origin path of a species' own artwork (SEO pass 2, 2026-11-21).
 * Supabase storage answers every public object with `x-robots-tag: none`, so
 * Google Images could not index a single species picture; this path serves the
 * same bytes from animaldex.app without it (`src/app/img/species/[file]/route.ts`).
 */
export const SPECIES_IMAGE_PATH_PREFIX = "/img/species/";

/** Slugs the route accepts: the catalogue's lowercase kebab-case, nothing else. */
export const SPECIES_IMAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function speciesImagePath(slug: string): string {
    return `${SPECIES_IMAGE_PATH_PREFIX}${encodeURIComponent(slug.trim().toLowerCase())}.webp`;
}

export function speciesImageUrl(slug: string): string {
    return new URL(speciesImagePath(slug), getSiteUrl()).toString();
}

/** `red-fox.webp` → `red-fox`; anything else (another extension, a path, odd characters, over 120 characters) → null. */
export function parseSpeciesImageFile(file: string): string | null {
    const match = /^(.{1,120})\.webp$/.exec(file);
    return match && SPECIES_IMAGE_SLUG.test(match[1]) ? match[1] : null;
}
