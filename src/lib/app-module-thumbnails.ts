const STORAGE_BASE = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals";
const STORAGE_RENDER_BASE = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/render/image/public/animals";

/** Matches iOS `optimizedPublicStorageImageURL` for module art. */
export function getOptimizedModuleImageUrl(path: string, maxPixelLength = 640, quality = 78) {
    const params = new URLSearchParams({
        width: String(maxPixelLength),
        height: String(maxPixelLength),
        quality: String(quality),
        resize: "cover"
    });

    return `${STORAGE_RENDER_BASE}/${path}?${params.toString()}`;
}

/** Public module art used across web profile shortcuts and arena surfaces (matches iOS `TrainModuleImagery`). */
export const APP_MODULE_THUMBNAILS = {
    dailyCompanion: getOptimizedModuleImageUrl("batfish-journal-thumbnail.webp"),
    wildProfile: getOptimizedModuleImageUrl("lion-identity-thumbnail.webp"),
    packs: getOptimizedModuleImageUrl("create-a-pack-2-thumbnail.webp"),
    missions: getOptimizedModuleImageUrl("animaldex-missions-thumbnail.webp"),
    sets: getOptimizedModuleImageUrl("sets-thumbnail.webp"),
    collection: getOptimizedModuleImageUrl("animaldex-catalog-thumbnail.webp"),
    matchupsHero: getOptimizedModuleImageUrl("mantis-shrimp.webp", 960, 82)
} as const;

export type ArenaModuleAccent = "neon" | "violet" | "orange" | "cyan";

export const ARENA_MODULE_ACCENTS: Record<
    "dailyCompanion" | "wildProfile" | "packs" | "missions" | "sets",
    ArenaModuleAccent
> = {
    dailyCompanion: "neon",
    wildProfile: "violet",
    packs: "orange",
    missions: "neon",
    sets: "neon"
};

export function arenaAccentOverlayClass(accent: ArenaModuleAccent) {
    switch (accent) {
        case "violet":
            return "bg-violet-400/25";
        case "orange":
            return "bg-orange-400/25";
        case "cyan":
            return "bg-cyan-400/25";
        default:
            return "bg-primary-400/25";
    }
}

export function arenaAccentTextClass(accent: ArenaModuleAccent) {
    switch (accent) {
        case "violet":
            return "text-violet-300";
        case "orange":
            return "text-orange-300";
        case "cyan":
            return "text-cyan-300";
        default:
            return "text-primary-200";
    }
}
