// The Home tab's video mode (the play button in the Discover header): every
// published animal lesson video, newest first, one per screen. Web twin of
// iOS `StoryVideoLibrary.feed` + `DiscoverLessonVideoFeedView`.
//
// Data: the app's `story-videos` edge function, `action: "feed"`, called with
// the viewer's own session (it only serves signed-in viewers, re-checks that
// each capture is public or the viewer's, and signs every URL for an hour).
// The browser pages through /api/app/lesson-videos; nothing is pre-rendered.

export const LESSON_VIDEOS_FUNCTION = "story-videos";
/** iOS `StoryVideoLibrary.feed(limit:)` default. The function caps it at 20. */
export const LESSON_VIDEO_PAGE_SIZE = 10;

export type LessonVideoOwner = {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
};

export type LessonVideo = {
    /** iOS `PublishedStoryVideo.id`: capture + narration language. */
    id: string;
    captureId: string;
    speciesProfileId: string | null;
    speciesName: string | null;
    locale: string;
    /** Signed for an hour by the edge function. */
    url: string;
    durationSeconds: number | null;
    hookLine: string | null;
    updatedAt: string;
    owner: LessonVideoOwner | null;
};

export type LessonVideoPage = {
    items: LessonVideo[];
    /** Pass back as `before` for the next page; null at the end. */
    nextBefore: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Mirrors `StoryVideoLibrary.decode`: a row without a capture id or an https URL is dropped. */
export function decodeLessonVideo(raw: unknown): LessonVideo | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const captureId = text(row.capture_id)?.toLowerCase() ?? null;
    const url = text(row.url);
    if (!captureId || !UUID.test(captureId) || !url || !url.startsWith("https://")) return null;
    const locale = text(row.locale)?.toLowerCase() ?? "en";
    const speciesProfileId = text(row.species_profile_id);
    const ownerRow = row.owner && typeof row.owner === "object" ? row.owner as Record<string, unknown> : null;
    const ownerId = text(ownerRow?.id);
    return {
        id: `${captureId}#${locale}`,
        captureId,
        speciesProfileId: speciesProfileId && UUID.test(speciesProfileId) ? speciesProfileId.toLowerCase() : null,
        speciesName: text(row.species_name),
        locale,
        url,
        durationSeconds: typeof row.duration_seconds === "number" && Number.isFinite(row.duration_seconds) ? row.duration_seconds : null,
        hookLine: text(row.hook_line),
        updatedAt: text(row.updated_at) ?? "",
        owner: ownerRow && ownerId
            ? {
                id: ownerId,
                username: text(ownerRow.username) ?? "",
                displayName: text(ownerRow.display_name) ?? "",
                avatarUrl: text(ownerRow.avatar_url)
            }
            : null
    };
}

export function decodeLessonVideoPage(payload: unknown): LessonVideoPage {
    const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const items = Array.isArray(body.items)
        ? body.items.map(decodeLessonVideo).filter((item): item is LessonVideo => item !== null)
        : [];
    const nextBefore = text(body.next_before);
    return {items, nextBefore: nextBefore && !Number.isNaN(Date.parse(nextBefore)) ? nextBefore : null};
}

/**
 * Appends a page. One video per capture: the function picks one language per
 * capture within a page, but a capture's other language can sit on the next.
 */
export function mergeLessonVideos(current: LessonVideo[], next: LessonVideo[]) {
    const known = new Set(current.map((video) => video.captureId));
    const merged = [...current];
    for (const video of next) {
        if (known.has(video.captureId)) continue;
        known.add(video.captureId);
        merged.push(video);
    }
    return merged;
}
