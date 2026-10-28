import {test} from "node:test";
import assert from "node:assert/strict";
import {autoShareTargets, autoTikTokOptions, duePlatforms, isUploading, MAX_AUTO_ATTEMPTS, pickNextAutoShare} from "./social/auto-share-plan";
import type {ShareCopy} from "./social/share-copy";
import type {SocialPostRow} from "./social/types";

const now = Date.parse("2026-10-20T12:00:00Z");
const recent = new Date(now - 60_000).toISOString();
const old = new Date(now - 2 * 3600_000).toISOString();

function post(overrides: Partial<SocialPostRow>): SocialPostRow {
    return {
        id: Math.random().toString(36).slice(2), platform: "youtube", media_path: "a.mp4", media_kind: "story_video",
        species_profile_id: null, species_name: null, page_slug: null, capture_id: null, caption: "", title: null,
        mode: "post", status: "published", external_id: null, external_url: null, error: null, options: null,
        created_at: recent, updated_at: recent, ...overrides
    };
}

test("a published, live or draft-published share counts as done; failures retry up to the cap", () => {
    const posts = [
        post({platform: "youtube"}),
        post({platform: "tiktok", mode: "draft"}),
        post({platform: "x", status: "processing"}),
        post({platform: "instagram", status: "failed"}),
        ...Array.from({length: MAX_AUTO_ATTEMPTS}, () => post({platform: "facebook", status: "failed"}))
    ];
    assert.deepEqual(duePlatforms("a.mp4", posts, ["youtube", "tiktok", "instagram", "facebook", "x"], now), ["instagram"]);
});

test("a stale processing row no longer blocks its platform", () => {
    assert.deepEqual(duePlatforms("a.mp4", [post({status: "processing", updated_at: old})], ["youtube"], now), ["youtube"]);
});

test("the oldest video with a due platform goes first", () => {
    const videos = [{mediaPath: "new.mp4", createdAt: "2026-10-19"}, {mediaPath: "a.mp4", createdAt: "2026-10-01"}, {mediaPath: "mid.mp4", createdAt: "2026-10-10"}];
    const next = pickNextAutoShare(videos, [post({platform: "youtube"}), post({platform: "x"})], ["youtube", "x"], now);
    assert.equal(next?.video.mediaPath, "mid.mp4");
    assert.deepEqual(next?.platforms, ["youtube", "x"]);
    assert.equal(pickNextAutoShare([videos[1]], [post({platform: "youtube"})], ["youtube"], now), null);
});

test("an upload in this server blocks the next run; a TikTok post waiting in Zernio does not", () => {
    assert.ok(isUploading(post({status: "processing"}), now));
    assert.ok(isUploading(post({status: "queued", platform: "tiktok", options: {zernio: {postId: "", scheduledFor: null, timezone: null}}}), now));
    assert.ok(!isUploading(post({status: "queued", platform: "tiktok", options: {zernio: {postId: "z1", scheduledFor: null, timezone: null}}}), now));
    assert.ok(!isUploading(post({status: "processing", platform: "tiktok", options: {zernio: {postId: "z1", scheduledFor: null, timezone: null}}}), now));
    assert.ok(!isUploading(post({status: "processing", updated_at: old}), now));
});

test("TikTok auto options: everyone, every allowed interaction, AI label, consent", () => {
    const options = autoTikTokOptions({
        privacyLevels: [{value: "PUBLIC_TO_EVERYONE", label: "Everyone"}],
        interactions: {allowComment: true, allowDuet: false, allowStitch: true}
    });
    assert.deepEqual(options, {privacyLevel: "PUBLIC_TO_EVERYONE", allowComment: true, allowDuet: false, allowStitch: true, brandOrganic: false, brandContent: false, madeWithAi: true, previewConfirmed: true});
    assert.equal(autoTikTokOptions({privacyLevels: [{value: "SELF_ONLY", label: "Only me"}], interactions: {allowComment: true, allowDuet: true, allowStitch: true}}), null);
});

test("targets take each platform's field and drop copy over its limit", () => {
    const copy: ShareCopy = {
        youtube: {title: "T", description: "YT desc"},
        tiktok: {caption: "TT"},
        instagram: {caption: "x".repeat(3000)},
        facebook: {caption: "FB"},
        x: {text: "X text"}
    };
    const {targets, tooLong} = autoShareTargets(copy, ["youtube", "tiktok", "instagram", "facebook", "x"]);
    assert.deepEqual(targets, [{platform: "youtube", caption: "YT desc", title: "T"}, {platform: "tiktok", caption: "TT", title: null}, {platform: "facebook", caption: "FB", title: null}, {platform: "x", caption: "X text", title: null}]);
    assert.deepEqual(tooLong, ["instagram"]);
});
