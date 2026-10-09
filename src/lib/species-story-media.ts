// Story media (narrated story videos, AI-animated captures, Trial scenes, stills) from the AnimalDex app's
// public `species-story-media` edge function. Spec:
// ~/AnimalDex/docs/handover/landing-page-story-media.md
//
// Media is an enhancement: every failure resolves to "no media" so a page never
// breaks over it. Always render `stable_url` (it 302s to a fresh signed URL);
// never re-host hooks, or a capture made private later would stay public here.

export const STORY_MEDIA_ENDPOINT = "https://wwhsdzpczekgdlobwaej.supabase.co/functions/v1/species-story-media";
export const STORY_MEDIA_REVALIDATE_SECONDS = 86_400;
const STORY_MEDIA_TIMEOUT_MS = 8_000;

export type StoryMediaKind = "story_video" | "hook" | "trial_scene" | "still";
const STORY_MEDIA_KINDS: readonly StoryMediaKind[] = ["story_video", "hook", "trial_scene", "still"];

export type StoryMediaItem = {
    kind: StoryMediaKind;
    media_type: "video" | "image";
    stable_url: string;
    signed_url: string | null;
    duration_seconds: number | null;
    loop: boolean;
    capture_id: string | null;
    created_at: string;
    /** Narration language of a story_video; null for the silent kinds. */
    locale?: string | null;
    /** story_video only: full narration (same text as the on-screen captions); may be null. */
    script?: string | null;
    /** story_video only: the bold opening headline (≤7 words); may be null. */
    hook?: string | null;
};

export type StoryMediaIndexRow = {
    species_profile_id?: string | null;
    /** Computed server-side with the same rule as toAnimalPageSlug. */
    page_slug?: string | null;
    landing_page_slug: string | null;
    animaldex_number: number | null;
    normalized_identity_key: string | null;
};

export type SpeciesStoryMedia = {
    /** The finished narrated video (has audio); leads the page over the hook. */
    storyVideo: StoryMediaItem | null;
    hook: StoryMediaItem | null;
    trialScenes: StoryMediaItem[];
    stills: StoryMediaItem[];
};

/** The /animals URL slug for a catalog row — mirrors scripts/refreshPublishedSeoSlugs.mjs. */
export function toAnimalPageSlug(row: StoryMediaIndexRow) {
    const landing = row.landing_page_slug?.trim() ?? "";
    const suffix = row.animaldex_number == null ? null : `-${row.animaldex_number}`;
    const stripped = suffix && landing.endsWith(suffix) ? landing.slice(0, -suffix.length) : landing;
    return (stripped || (row.normalized_identity_key ?? "").trim().replace(/_/g, "-"))
        .toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function fetchStoryMediaJson(query: string): Promise<unknown> {
    try {
        const response = await fetch(`${STORY_MEDIA_ENDPOINT}?${query}`, {
            next: {revalidate: STORY_MEDIA_REVALIDATE_SECONDS},
            signal: AbortSignal.timeout(STORY_MEDIA_TIMEOUT_MS)
        });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

/**
 * Page slug → endpoint query for every species with servable media, from one
 * cached `?index=1` call shared by all /animals pages, so pages without media
 * make no request. Null when the index is unavailable.
 */
async function getStoryMediaSlugMap(): Promise<Map<string, string> | null> {
    const body = await fetchStoryMediaJson("index=1") as {species?: StoryMediaIndexRow[]} | null;
    const rows = body?.species;
    if (!Array.isArray(rows)) return null;
    const map = new Map<string, string>();
    for (const row of rows) {
        if (!row) continue;
        const pageSlug = row.page_slug?.trim().toLowerCase() || toAnimalPageSlug(row);
        // The profile id is the exact key; the endpoint also matches page slugs.
        const query = row.species_profile_id
            ? `species_profile_id=${encodeURIComponent(row.species_profile_id)}`
            : `slug=${encodeURIComponent(pageSlug)}`;
        if (pageSlug && !map.has(pageSlug)) map.set(pageSlug, query);
    }
    return map;
}

function isStoryMediaItem(value: unknown): value is StoryMediaItem {
    if (!value || typeof value !== "object") return false;
    const item = value as StoryMediaItem;
    return STORY_MEDIA_KINDS.includes(item.kind)
        && (item.media_type === "video" || item.media_type === "image")
        && typeof item.stable_url === "string"
        && item.stable_url.startsWith("https://");
}

/** `locale` picks the story_video narrated in the page language, else the first one. */
export function groupStoryMedia(items: StoryMediaItem[], locale?: string): SpeciesStoryMedia | null {
    const storyVideos = items.filter((item) => item.kind === "story_video" && item.media_type === "video");
    const language = locale?.toLowerCase().split("-")[0];
    const storyVideo = storyVideos.find((item) => item.locale?.toLowerCase().split("-")[0] === language)
        ?? storyVideos[0]
        ?? null;
    const hook = items.find((item) => item.kind === "hook" && item.media_type === "video") ?? null;
    const trialScenes = items.filter((item) => item.kind === "trial_scene" && item.media_type === "video");
    const stills = items.filter((item) => item.kind === "still" && item.media_type === "image");
    return storyVideo || hook || trialScenes.length > 0 || stills.length > 0
        ? {storyVideo, hook, trialScenes, stills}
        : null;
}

/** Story media for an /animals page slug, or null when there is none (the common case). */
export async function getSpeciesStoryMedia(pageSlug: string, locale?: string): Promise<SpeciesStoryMedia | null> {
    const slugMap = await getStoryMediaSlugMap();
    const query = slugMap?.get(pageSlug.trim().toLowerCase());
    if (!query) return null;
    const body = await fetchStoryMediaJson(query) as {items?: unknown[]} | null;
    const raw = body?.items;
    const items = Array.isArray(raw) ? raw.filter(isStoryMediaItem) : [];
    return groupStoryMedia(items, locale);
}
