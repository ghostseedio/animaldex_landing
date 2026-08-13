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
