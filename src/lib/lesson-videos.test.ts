import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {decodeLessonVideo, decodeLessonVideoPage, mergeLessonVideos} from "@/lib/lesson-videos";

const CAPTURE = "6F1C2B9A-0D3E-4C5B-8A7F-112233445566";
const OWNER = "138bd2bc-af58-4e51-ac92-3df6161d53db";

/** One `items[]` row exactly as the `story-videos` edge function's `present()` writes it. */
function row(overrides: Record<string, unknown> = {}) {
    return {
        capture_id: CAPTURE,
        species_profile_id: "e34b2631-4c63-40b4-894a-8b925b0def8c",
        species_name: "California Sea Lion",
        locale: "en",
        url: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/sign/species-explainer-clips/a.mp4?token=x",
        duration_seconds: 41.5,
        hook_line: "The sea lion that learned to wait",
        updated_at: "2026-10-11T09:00:00.000Z",
        owner: {id: OWNER, username: "wildjade", display_name: "Jade", avatar_url: null},
        ...overrides
    };
}

test("a feed row decodes like iOS StoryVideoLibrary.decode", () => {
    const video = decodeLessonVideo(row());
    assert.ok(video);
    assert.equal(video.id, `${CAPTURE.toLowerCase()}#en`);
    assert.equal(video.captureId, CAPTURE.toLowerCase());
    assert.equal(video.speciesName, "California Sea Lion");
    assert.equal(video.durationSeconds, 41.5);
    assert.deepEqual(video.owner, {id: OWNER, username: "wildjade", displayName: "Jade", avatarUrl: null});
});

test("rows without a capture id or a playable https URL are dropped", () => {
    assert.equal(decodeLessonVideo(row({capture_id: null})), null);
    assert.equal(decodeLessonVideo(row({capture_id: "not-a-uuid"})), null);
    assert.equal(decodeLessonVideo(row({url: null})), null);
    assert.equal(decodeLessonVideo(row({url: "http://example.com/a.mp4"})), null);
    assert.equal(decodeLessonVideo(row({locale: null}))?.locale, "en");
    assert.equal(decodeLessonVideo(row({owner: null}))?.owner, null);
});

test("a page keeps next_before only when it is a date", () => {
    const page = decodeLessonVideoPage({items: [row(), {junk: true}], next_before: "2026-10-01T00:00:00Z"});
    assert.equal(page.items.length, 1);
    assert.equal(page.nextBefore, "2026-10-01T00:00:00Z");
    assert.equal(decodeLessonVideoPage({items: [], next_before: "soon"}).nextBefore, null);
    assert.deepEqual(decodeLessonVideoPage(null), {items: [], nextBefore: null});
});

test("merging pages keeps one video per capture", () => {
    const first = [decodeLessonVideo(row())!];
    const second = [
        decodeLessonVideo(row({locale: "id"}))!,
        decodeLessonVideo(row({capture_id: "00000000-0000-4000-8000-000000000002"}))!
    ];
    const merged = mergeLessonVideos(first, second);
    assert.deepEqual(merged.map((video) => video.id), [
        `${CAPTURE.toLowerCase()}#en`,
        "00000000-0000-4000-8000-000000000002#en"
    ]);
});

test("the feed is paged through the API route, never shipped in the Home payload", () => {
    const home = readFileSync("src/app/[locale]/(authenticated)/app/page.tsx", "utf8");
    assert.doesNotMatch(home, /lesson-videos|story-videos/);
    const feed = readFileSync("src/app/[locale]/(authenticated)/app/lesson-video-feed.tsx", "utf8");
    assert.match(feed, /\/api\/app\/lesson-videos/);
    assert.match(feed, /playsInline/);
    assert.doesNotMatch(feed, /rounded-(?!\[2px\])/);
});
