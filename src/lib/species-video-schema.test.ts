import {strict as assert} from "node:assert";
import {test} from "node:test";
import {buildSpeciesVideoSchemas, collectSpeciesVideoUrls} from "./species-video-schema";
import type {SpeciesStoryMedia, StoryMediaItem} from "./species-story-media";

function video(partial: Partial<StoryMediaItem>): StoryMediaItem {
    return {
        kind: "story_video",
        media_type: "video",
        stable_url: "https://cdn.example/story.mp4",
        signed_url: null,
        duration_seconds: 80,
        loop: false,
        capture_id: null,
        created_at: "2026-10-01T00:00:00.000Z",
        ...partial
    };
}

const input = {
    pageUrl: "https://animaldex.app/animals/peregrine-falcon",
    speciesName: "Peregrine Falcon",
    speciesSummary: "The fastest animal on Earth.",
    fallbackThumbnailUrl: "https://animaldex.app/art.webp",
    fallbackUploadDate: "2026-09-01T00:00:00.000Z",
    publisherLogoUrl: "https://animaldex.app/images/logo.webp"
};

test("returns no schema when there is no story media", () => {
    assert.deepEqual(buildSpeciesVideoSchemas(null, input), []);
    const empty: SpeciesStoryMedia = {storyVideo: null, hook: null, trialScenes: [], stills: []};
    assert.deepEqual(buildSpeciesVideoSchemas(empty, input), []);
});

test("builds one VideoObject per video with unique anchored @id and ISO duration", () => {
    const storyMedia: SpeciesStoryMedia = {
        storyVideo: video({hook: "The Falling Sky Arrow", script: "Full narration.", duration_seconds: 80}),
        hook: video({kind: "hook", stable_url: "https://cdn.example/hook.mp4", script: null, duration_seconds: 12}),
        trialScenes: [video({kind: "trial_scene", stable_url: "https://cdn.example/trial1.mp4", duration_seconds: 6})],
        stills: [video({kind: "still", media_type: "image", stable_url: "https://cdn.example/still.webp"})]
    };

    const schemas = buildSpeciesVideoSchemas(storyMedia, input);
    assert.equal(schemas.length, 3, "story video + hook + 1 trial scene");

    const ids = schemas.map((s) => s["@id"]);
    assert.deepEqual(ids, [
        "https://animaldex.app/animals/peregrine-falcon#story-video",
        "https://animaldex.app/animals/peregrine-falcon#hook",
        "https://animaldex.app/animals/peregrine-falcon#trial-scene-1"
    ]);
    assert.equal(new Set(ids).size, ids.length, "@id values are unique");

    const story = schemas[0];
    assert.equal(story["@type"], "VideoObject");
    assert.equal(story.name, "Peregrine Falcon: The Falling Sky Arrow");
    assert.equal(story.contentUrl, "https://cdn.example/story.mp4");
    assert.equal(story.duration, "PT80S");
    assert.equal(story.transcript, "Full narration.");
    assert.deepEqual(story.thumbnailUrl, ["https://cdn.example/still.webp"]);
});

test("falls back to species summary and omits duration when unknown", () => {
    const storyMedia: SpeciesStoryMedia = {
        storyVideo: null,
        hook: video({kind: "hook", hook: null, script: null, duration_seconds: null}),
        trialScenes: [],
        stills: []
    };
    const [hook] = buildSpeciesVideoSchemas(storyMedia, input);
    assert.equal(hook.name, "Peregrine Falcon in motion");
    assert.equal(hook.description, "The fastest animal on Earth.");
    assert.equal("duration" in hook, false);
    assert.deepEqual(hook.thumbnailUrl, ["https://animaldex.app/art.webp"]);
});

test("collectSpeciesVideoUrls returns only playable video urls", () => {
    const storyMedia: SpeciesStoryMedia = {
        storyVideo: video({}),
        hook: null,
        trialScenes: [video({kind: "trial_scene", stable_url: "https://cdn.example/t.mp4"})],
        stills: [video({kind: "still", media_type: "image"})]
    };
    assert.deepEqual(collectSpeciesVideoUrls(storyMedia), [
        "https://cdn.example/story.mp4",
        "https://cdn.example/t.mp4"
    ]);
});
