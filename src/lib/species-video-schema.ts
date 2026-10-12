// Schema.org VideoObject builders for the story videos on /animals/[slug].
//
// The species page already fetches each animal's story media (a narrated story
// video, a silent "hook" loop, and Trial scene loops) but emitted no video
// structured data, so Google could not index them as videos. Each video here
// gets a stable, unique `@id` anchored to the species page URL — the same
// "one addressable item per clip" idea as the Discover feed's `/p/<id>` posts —
// so Video rich results and Google's video index can find each one.

import type {SpeciesStoryMedia, StoryMediaItem} from "@/lib/species-story-media";

export type SpeciesVideoSchemaInput = {
    /** Absolute canonical URL of the species page the videos live on. */
    pageUrl: string;
    speciesName: string;
    /** One-line species summary, used when a clip has no narration of its own. */
    speciesSummary: string;
    /** Absolute poster/thumbnail URL fallback (species artwork). */
    fallbackThumbnailUrl: string;
    /** Page publish date, used when a clip carries no `created_at`. */
    fallbackUploadDate: string;
    /** Absolute URL of the AnimalDex publisher logo. */
    publisherLogoUrl: string;
};

type VideoScene = {
    item: StoryMediaItem;
    /** URL-fragment id that makes each clip individually addressable. */
    anchor: string;
    name: string;
    description: string;
    /** Narration/caption text, surfaced to search as a transcript. */
    transcript?: string;
};

/** `92.4` → `PT92S`. Returns null for missing/invalid durations. */
function toIso8601Duration(seconds: number | null | undefined): string | null {
    if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
    return `PT${Math.round(seconds)}S`;
}

function firstThumbnail(storyMedia: SpeciesStoryMedia, fallback: string): string {
    return storyMedia.stills[0]?.stable_url || fallback;
}

/**
 * Collects every playable story video for a species into a flat list of scenes,
 * each with a unique anchor, a descriptive name and the best available text.
 */
function collectScenes(storyMedia: SpeciesStoryMedia, input: SpeciesVideoSchemaInput): VideoScene[] {
    const scenes: VideoScene[] = [];

    if (storyMedia.storyVideo) {
        const headline = storyMedia.storyVideo.hook?.trim();
        scenes.push({
            item: storyMedia.storyVideo,
            anchor: "story-video",
            name: headline ? `${input.speciesName}: ${headline}` : `${input.speciesName} — story`,
            description: storyMedia.storyVideo.script?.trim() || input.speciesSummary,
            transcript: storyMedia.storyVideo.script?.trim() || undefined
        });
    }

    if (storyMedia.hook) {
        const headline = storyMedia.hook.hook?.trim();
        scenes.push({
            item: storyMedia.hook,
            anchor: "hook",
            name: headline ? `${input.speciesName}: ${headline}` : `${input.speciesName} in motion`,
            description: storyMedia.hook.script?.trim() || input.speciesSummary
        });
    }

    storyMedia.trialScenes.forEach((item, index) => {
        scenes.push({
            item,
            anchor: `trial-scene-${index + 1}`,
            name: `${input.speciesName} — Trial scene ${index + 1}`,
            description: item.script?.trim() || `${input.speciesName} Trial scene from AnimalDex.`
        });
    });

    return scenes;
}

/**
 * Builds one schema.org VideoObject per story video, or `[]` when the species
 * has no playable video media (the page then emits no video schema at all).
 */
export function buildSpeciesVideoSchemas(
    storyMedia: SpeciesStoryMedia | null | undefined,
    input: SpeciesVideoSchemaInput
): Record<string, unknown>[] {
    if (!storyMedia) return [];

    const thumbnailUrl = firstThumbnail(storyMedia, input.fallbackThumbnailUrl);
    const publisher = {
        "@type": "Organization",
        name: "AnimalDex",
        logo: {"@type": "ImageObject", url: input.publisherLogoUrl}
    };

    return collectScenes(storyMedia, input)
        .filter((scene) => scene.item.media_type === "video" && Boolean(scene.item.stable_url))
        .map((scene) => {
            const duration = toIso8601Duration(scene.item.duration_seconds);
            return {
                "@context": "https://schema.org",
                "@type": "VideoObject",
                "@id": `${input.pageUrl}#${scene.anchor}`,
                name: scene.name,
                description: scene.description,
                thumbnailUrl: [thumbnailUrl],
                uploadDate: scene.item.created_at || input.fallbackUploadDate,
                contentUrl: scene.item.stable_url,
                ...(duration ? {duration} : {}),
                ...(scene.transcript ? {transcript: scene.transcript} : {}),
                isFamilyFriendly: true,
                inLanguage: scene.item.locale || "en",
                publisher,
                mainEntityOfPage: input.pageUrl
            };
        });
}

/** The raw video URLs for a species, for `openGraph.videos` in page metadata. */
export function collectSpeciesVideoUrls(storyMedia: SpeciesStoryMedia | null | undefined): string[] {
    if (!storyMedia) return [];
    const items = [storyMedia.storyVideo, storyMedia.hook, ...storyMedia.trialScenes];
    return items
        .filter((item): item is StoryMediaItem => Boolean(item && item.media_type === "video" && item.stable_url))
        .map((item) => item.stable_url);
}
