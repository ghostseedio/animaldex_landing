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

export function getSpeciesArtworkUrl(slug: string) {
    const artworkPath = encodeStoragePath(`${slug}.webp`);

    return `${getPublicStorageBaseUrl()}/storage/v1/object/public/${SPECIES_ARTWORK_BUCKET}/${artworkPath}`;
}
