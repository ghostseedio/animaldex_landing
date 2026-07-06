const STORAGE_BASE = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals";

/** Public module art used across web profile shortcuts and arena surfaces (matches iOS `TrainModuleImagery`). */
export const APP_MODULE_THUMBNAILS = {
    dailyCompanion: `${STORAGE_BASE}/batfish-journal-thumbnail.webp`,
    wildProfile: `${STORAGE_BASE}/lion-identity-thumbnail.webp`,
    packs: `${STORAGE_BASE}/create-a-pack-2-thumbnail.webp`,
    missions: `${STORAGE_BASE}/animaldex-missions-thumbnail.webp`,
    sets: `${STORAGE_BASE}/sets-thumbnail.webp`,
    collection: `${STORAGE_BASE}/animaldex-catalog-thumbnail.webp`,
    matchupsHero: `${STORAGE_BASE}/mantis-shrimp.webp`
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
