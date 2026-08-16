import {getSupabaseUrl} from "@/lib/supabase-http";

const DEFAULT_SUPABASE_URL = "https://wwhsdzpczekgdlobwaej.supabase.co";
const SPECIES_ARTWORK_BUCKET = "animals";

function encodeStoragePath(path: string) {
    return path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

function getPublicStorageBaseUrl() {
    return getSupabaseUrl() ?? DEFAULT_SUPABASE_URL;
}

export function getSpeciesArtworkUrl(slug: string, imageFile?: string | null) {
    const artworkPath = encodeStoragePath(imageFile?.trim() || `${slug}.webp`);

    return `${getPublicStorageBaseUrl()}/storage/v1/object/public/${SPECIES_ARTWORK_BUCKET}/${artworkPath}`;
}

/**
 * Route that redirects to whatever artwork the bucket actually holds for a slug,
 * including a close relative's when the slug has no file of its own. Prefer this
 * over {@link getSpeciesArtworkUrl} wherever the exact file is not already known.
 */
export function getSpeciesArtworkRoute(slug: string, size?: number) {
    const base = `/api/species-artwork/${encodeURIComponent(slug)}`;

    return size ? `${base}?size=${Math.round(size)}` : base;
}

export function getSpeciesArtworkThumbnailUrl(slug: string, imageFile?: string | null, size = 240) {
    const artworkPath = encodeStoragePath(imageFile?.trim() || `${slug}.webp`);
    const params = new URLSearchParams({
        width: String(size),
        height: String(size),
        quality: "72",
        resize: "contain"
    });

    return `${getPublicStorageBaseUrl()}/storage/v1/render/image/public/${SPECIES_ARTWORK_BUCKET}/${artworkPath}?${params.toString()}`;
}
