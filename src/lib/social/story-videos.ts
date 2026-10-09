import {STORY_MEDIA_ENDPOINT, type StoryMediaIndexRow, type StoryMediaItem, toAnimalPageSlug} from "@/lib/species-story-media";

// Every finished story video (narrated, with audio) the public
// species-story-media endpoint will serve, for /admin/story-videos. The raw
// silent clips (hook, trial_scene) are ingredients, not posts, so they are
// left out. Read fresh (no data cache): the admin wants what is servable right
// now, and the endpoint re-checks capture visibility.

export type AdminStoryVideo = {
    /** `?path=` value of the stable URL: the durable id of the file. */
    mediaPath: string;
    kind: StoryMediaItem["kind"];
    locale: string | null;
    stableUrl: string;
    signedUrl: string | null;
    durationSeconds: number | null;
    hasAudio: boolean;
    /** Narration text and opening headline (story_video only; either may be null). */
    script: string | null;
    videoHook: string | null;
    captureId: string | null;
    createdAt: string;
    speciesProfileId: string;
    speciesName: string;
    pageSlug: string;
};

const ADMIN_VIDEO_KINDS = new Set(["story_video"]);

export function mediaPathOf(stableUrl: string) {
    try {
        return new URL(stableUrl).searchParams.get("path");
    } catch {
        return null;
    }
}

async function getJson(query: string) {
    const response = await fetch(`${STORY_MEDIA_ENDPOINT}?${query}`, {cache: "no-store", signal: AbortSignal.timeout(20_000)});
    if (!response.ok) throw new Error(`species-story-media ${query} returned ${response.status}`);
    return response.json();
}

async function videosForSpecies(row: StoryMediaIndexRow & {species_profile_id: string}): Promise<AdminStoryVideo[]> {
    const body = await getJson(`species_profile_id=${encodeURIComponent(row.species_profile_id)}`) as {
        species?: {name?: string};
        items?: StoryMediaItem[];
    };
    const pageSlug = row.page_slug?.trim() || toAnimalPageSlug(row);
    return (body.items ?? []).flatMap((item) => {
        const mediaPath = mediaPathOf(item.stable_url);
        if (!mediaPath || item.media_type !== "video" || !ADMIN_VIDEO_KINDS.has(item.kind)) return [];
        return [{
            mediaPath,
            kind: item.kind,
            locale: item.locale ?? null,
            stableUrl: item.stable_url,
            signedUrl: item.signed_url,
            durationSeconds: item.duration_seconds,
            hasAudio: item.kind === "story_video",
            script: typeof item.script === "string" && item.script.trim() ? item.script.trim() : null,
            videoHook: typeof item.hook === "string" && item.hook.trim() ? item.hook.trim() : null,
            captureId: item.capture_id,
            createdAt: item.created_at,
            speciesProfileId: row.species_profile_id,
            speciesName: body.species?.name ?? pageSlug,
            pageSlug
        }];
    });
}

/** Newest first. */
export async function listAdminStoryVideos(): Promise<AdminStoryVideo[]> {
    type IndexRow = StoryMediaIndexRow & {species_profile_id?: string; counts?: Record<string, number>};
    const index = await getJson("index=1") as {species?: IndexRow[]};
    // Only species whose index counts show a finished video need a second call.
    const rows = (index.species ?? []).filter((row): row is IndexRow & {species_profile_id: string} =>
        Boolean(row.species_profile_id) && (row.counts?.story_video ?? 1) > 0);
    const results = await Promise.allSettled(rows.map(videosForSpecies));
    return results
        .flatMap((result) => result.status === "fulfilled" ? result.value : [])
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** One video, re-read at share time: confirms it is still served and gives a fresh signed URL. */
export async function findAdminStoryVideo(speciesProfileId: string, mediaPath: string) {
    const videos = await videosForSpecies({species_profile_id: speciesProfileId, landing_page_slug: null, animaldex_number: null, normalized_identity_key: null});
    return videos.find((video) => video.mediaPath === mediaPath) ?? null;
}
