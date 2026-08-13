const FALLBACK_SUPABASE_URL = "https://wwhsdzpczekgdlobwaej.supabase.co";

/**
 * Catalog icon artwork, stored one file per species slug in the public `animals` bucket.
 *
 * This is the illustrated AnimalDex icon used across the app — not a user capture photo.
 * Species without artwork should be left off icon surfaces rather than falling back to a
 * capture image, which would mix two very different kinds of picture.
 */
export function getSpeciesArtworkUrl(slug: string) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;

    return `${base}/storage/v1/object/public/animals/${encodeURIComponent(slug)}.webp`;
}
