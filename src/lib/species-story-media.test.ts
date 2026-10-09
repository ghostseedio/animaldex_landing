import {test} from "node:test";
import assert from "node:assert/strict";
import {groupStoryMedia, toAnimalPageSlug, type StoryMediaItem} from "./species-story-media";

function item(kind: StoryMediaItem["kind"], media_type: StoryMediaItem["media_type"], n = 0): StoryMediaItem {
    return {
        kind,
        media_type,
        stable_url: `https://example.test/${kind}-${n}`,
        signed_url: null,
        duration_seconds: media_type === "video" ? 5 : null,
        loop: kind === "trial_scene",
        capture_id: null,
        created_at: "2026-10-09T00:00:00Z"
    };
}

test("page slug drops the animaldex-number suffix, like refreshPublishedSeoSlugs", () => {
    assert.equal(toAnimalPageSlug({landing_page_slug: "lioness-1864", animaldex_number: 1864, normalized_identity_key: "lioness"}), "lioness");
    assert.equal(toAnimalPageSlug({landing_page_slug: "domestic-dog", animaldex_number: 12, normalized_identity_key: "domestic_dog"}), "domestic-dog");
    // A trailing number that is not this species' number is part of the slug.
    assert.equal(toAnimalPageSlug({landing_page_slug: "area-51-frog", animaldex_number: 7, normalized_identity_key: null}), "area-51-frog");
});

test("page slug falls back to the identity key when the landing slug is empty", () => {
    assert.equal(toAnimalPageSlug({landing_page_slug: " ", animaldex_number: 3, normalized_identity_key: "red_fox"}), "red-fox");
});

test("no usable media groups to null so the page renders nothing", () => {
    assert.equal(groupStoryMedia([]), null);
    assert.equal(groupStoryMedia([item("hook", "image")]), null);
});

test("hook leads, newest first; scenes and stills keep their order", () => {
    const media = groupStoryMedia([item("still", "image", 1), item("hook", "video", 1), item("hook", "video", 2), item("trial_scene", "video", 1), item("still", "image", 2)]);
    assert.equal(media?.hook?.stable_url, "https://example.test/hook-1");
    assert.deepEqual(media?.trialScenes.map((scene) => scene.stable_url), ["https://example.test/trial_scene-1"]);
    assert.deepEqual(media?.stills.map((still) => still.stable_url), ["https://example.test/still-1", "https://example.test/still-2"]);
});

test("story_video leads, narrated in the page language when there is one", () => {
    const en = {...item("story_video", "video", 1), locale: "en"};
    const id = {...item("story_video", "video", 2), locale: "id"};
    assert.equal(groupStoryMedia([en, id, item("hook", "video")], "id")?.storyVideo?.stable_url, id.stable_url);
    assert.equal(groupStoryMedia([en, id], "fr")?.storyVideo?.stable_url, en.stable_url);
    assert.equal(groupStoryMedia([item("hook", "video")], "en")?.storyVideo, null);
    assert.ok(groupStoryMedia([en]));
});
