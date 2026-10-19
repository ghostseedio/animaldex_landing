import {test} from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {
    buildTikTokPostBody,
    MAX_SCHEDULE_DAYS,
    parseTikTokAccountInfo,
    parseZernioPost,
    parseZernioWebhookEvent,
    rowStateFromZernio,
    scheduleProblem,
    TIKTOK_CAPTION_LIMIT,
    verifyZernioWebhookSignature,
    ZernioError,
    zernioErrorFromResponse
} from "./social/zernio-core";
import {goneFromZernioPatch, rateLimitRetryDelaySeconds, rowsNeedingSync, zernioPatchForRow} from "./social/zernio-sync";
import type {SocialPostRow, TikTokPostOptions} from "./social/types";

const options: TikTokPostOptions = {
    privacyLevel: "PUBLIC_TO_EVERYONE", allowComment: true, allowDuet: false, allowStitch: true,
    brandOrganic: false, brandContent: false, madeWithAi: true, previewConfirmed: true
};
const account = "acc_123";

test("a post-now body carries the video, the account, the TikTok settings and both legal confirmations", () => {
    const body = buildTikTokPostBody({videoUrl: "https://cdn.example/v.mp4", caption: "Hello", options}, account) as any;
    assert.equal(body.content, "Hello");
    assert.deepEqual(body.mediaItems, [{type: "video", url: "https://cdn.example/v.mp4"}]);
    assert.deepEqual(body.platforms, [{platform: "tiktok", accountId: account}]);
    assert.equal(body.publishNow, true);
    assert.equal(body.scheduledFor, undefined);
    assert.equal(body.tiktokSettings.privacyLevel, "PUBLIC_TO_EVERYONE");
    assert.equal(body.tiktokSettings.allowComment, true);
    assert.equal(body.tiktokSettings.allowDuet, false);
    assert.equal(body.tiktokSettings.allowStitch, true);
    assert.equal(body.tiktokSettings.commercialContentType, "none");
    assert.equal(body.tiktokSettings.videoMadeWithAi, true);
    assert.equal(body.tiktokSettings.contentPreviewConfirmed, true);
    assert.equal(body.tiktokSettings.expressConsentGiven, true);
    assert.equal(body.tiktokSettings.draft, undefined);
});

test("a scheduled body sends scheduledFor and the timezone instead of publishNow", () => {
    const body = buildTikTokPostBody({videoUrl: "https://cdn.example/v.mp4", caption: "Hi", options, scheduledFor: "2026-10-18T10:00:00+01:00", timezone: "Europe/London"}, account) as any;
    assert.equal(body.publishNow, undefined);
    assert.equal(body.scheduledFor, "2026-10-18T10:00:00+01:00");
    assert.equal(body.timezone, "Europe/London");
});

test("commercial disclosure maps to Zernio's content type, with both flags when both are on", () => {
    const type = (brandOrganic: boolean, brandContent: boolean) => (buildTikTokPostBody({videoUrl: "https://x/v.mp4", caption: "c", options: {...options, brandOrganic, brandContent}}, account) as any).tiktokSettings;
    assert.equal(type(false, false).commercialContentType, "none");
    assert.equal(type(true, false).commercialContentType, "brand_organic");
    assert.equal(type(false, true).commercialContentType, "brand_content");
    const both = type(true, true);
    assert.equal(both.commercialContentType, "brand_content");
    assert.equal(both.isBrandOrganicPost, true);
    assert.equal(both.brandPartnerPromote, true);
});

test("drafts, caption limits and metadata", () => {
    const body = buildTikTokPostBody({videoUrl: "https://x/v.mp4", caption: "a".repeat(3000), options, draft: true, metadata: {rowId: "r1"}}, account) as any;
    assert.equal(body.tiktokSettings.draft, true);
    assert.equal(body.content.length, TIKTOK_CAPTION_LIMIT);
    assert.deepEqual(body.metadata, {rowId: "r1"});
});

const post = (status: string, platform: Record<string, unknown> = {}) => ({_id: "p1", status, scheduledFor: "2026-10-18T09:00:00.000Z", platforms: [{platform: "tiktok", status: "pending", ...platform}]});

test("Zernio post states map to share-log rows", () => {
    const published = parseZernioPost(post("published", {status: "published", platformPostId: "7421", platformPostUrl: "https://www.tiktok.com/@animaldex.app/video/7421"}))!;
    assert.equal(published.postId, "p1");
    assert.equal(published.tiktok?.platformPostId, "7421");
    assert.deepEqual(rowStateFromZernio(published), {status: "published", external_url: "https://www.tiktok.com/@animaldex.app/video/7421", error: null});

    const failed = rowStateFromZernio(parseZernioPost(post("failed", {status: "failed", errorMessage: "Video too long", errorCategory: "validation"}))!);
    assert.deepEqual(failed, {status: "failed", external_url: null, error: "TikTok: Video too long"});

    assert.equal(rowStateFromZernio(parseZernioPost(post("scheduled"))!).status, "queued");
    assert.equal(rowStateFromZernio(parseZernioPost(post("publishing"))!).status, "processing");
    assert.equal(rowStateFromZernio(parseZernioPost(post("partial", {status: "failed", errorMessage: "nope"}))!).status, "failed");
    assert.equal(rowStateFromZernio(parseZernioPost(post("cancelled"))!).error, "TikTok: Cancelled in Zernio");
    assert.equal(parseZernioPost({status: "published"}), null);
    assert.equal(parseZernioPost({id: "p2", status: "draft"})?.scheduledFor, null);
});

test("Zernio error responses become explainable errors", () => {
    const auth = zernioErrorFromResponse(401, {error: "Invalid API key"});
    assert.equal(auth.kind, "auth");
    assert.equal(auth.retryable, false);

    const duplicate = zernioErrorFromResponse(409, {error: "Duplicate content", details: {existingPostId: "p9"}});
    assert.equal(duplicate.kind, "duplicate");
    assert.equal(duplicate.existingPostId, "p9");

    const limited = zernioErrorFromResponse(429, {error: "Too many requests", details: {retryAfterSeconds: 42}});
    assert.equal(limited.kind, "rate_limited");
    assert.equal(limited.retryAfterSeconds, 42);
    assert.equal(limited.retryable, true);

    const withHeader = zernioErrorFromResponse(429, {error: "Slow down"}, new Response(null, {status: 429, headers: {"retry-after": "7"}}));
    assert.equal(withHeader.retryAfterSeconds, 7);

    const video = zernioErrorFromResponse(400, {error: "Unsupported value", param: "mediaItems"});
    assert.equal(video.kind, "invalid_video");
    assert.match(video.message, /could not accept the video/);
    assert.equal(zernioErrorFromResponse(400, {error: "content is required", param: "content"}).kind, "invalid_request");

    const upstream = zernioErrorFromResponse(502, {error: "TikTok timed out"});
    assert.equal(upstream.kind, "unavailable");
    assert.equal(upstream.retryable, true);
    assert.ok(upstream instanceof ZernioError);
});

test("webhook signatures: the hex HMAC of the raw body, nothing else", () => {
    const raw = JSON.stringify({id: "evt_1", event: "post.published"});
    const good = createHmac("sha256", "whsec").update(raw).digest("hex");
    assert.equal(verifyZernioWebhookSignature(raw, good, "whsec"), true);
    assert.equal(verifyZernioWebhookSignature(raw, good.toUpperCase(), "whsec"), true);
    assert.equal(verifyZernioWebhookSignature(raw, good.replace(/^./, (c) => (c === "0" ? "1" : "0")), "whsec"), false);
    assert.equal(verifyZernioWebhookSignature(raw, good, "other"), false);
    assert.equal(verifyZernioWebhookSignature(raw, null, "whsec"), false);
    assert.equal(verifyZernioWebhookSignature(raw, "", "whsec"), false);
    assert.equal(verifyZernioWebhookSignature(raw, good, ""), false);
});

test("webhook events: post events carry the post, others are ignored", () => {
    const event = parseZernioWebhookEvent({id: "evt_1", event: "post.platform.published", timestamp: "2026-10-17T10:00:00Z", post: post("published", {status: "published", platformPostUrl: "https://t/1"})});
    assert.equal(event?.id, "evt_1");
    assert.equal(event?.post?.postId, "p1");
    assert.equal(event?.post?.tiktok?.platformPostUrl, "https://t/1");
    const other = parseZernioWebhookEvent({id: "evt_2", event: "account.disconnected", account: {}});
    assert.equal(other?.event, "account.disconnected");
    assert.equal(other?.post, null);
    assert.equal(parseZernioWebhookEvent({}), null);
    assert.equal(parseZernioWebhookEvent("nope"), null);
});

test("schedule times need an offset, a few minutes of lead and fit the upload's lifetime", () => {
    const now = Date.parse("2026-10-17T12:00:00Z");
    assert.equal(scheduleProblem(null, now), null);
    assert.equal(scheduleProblem("", now), null);
    assert.match(scheduleProblem("not a date", now) ?? "", /not a valid date/);
    assert.match(scheduleProblem("2026-10-17T13:00:00", now) ?? "", /timezone offset/);
    assert.match(scheduleProblem("2026-10-17T11:00:00Z", now) ?? "", /at least a few minutes ahead/);
    assert.match(scheduleProblem("2026-10-17T12:01:00Z", now) ?? "", /at least a few minutes ahead/);
    assert.match(scheduleProblem(new Date(now + (MAX_SCHEDULE_DAYS + 1) * 86_400_000).toISOString(), now) ?? "", /within the next 30 days/);
    assert.equal(scheduleProblem("2026-10-17T12:10:00Z", now), null);
    assert.equal(scheduleProblem("2026-10-17T14:10:00+02:00", now), null);
});

test("creator info is read defensively", () => {
    const info = parseTikTokAccountInfo({
        creator: {nickname: "animaldex.app", avatarUrl: "https://a/1.jpg", canPostMore: true},
        privacyLevels: [{value: "PUBLIC_TO_EVERYONE", label: "Everyone"}, {value: "SELF_ONLY"}, {nope: 1}],
        postingLimits: {maxVideoDurationSec: 600, interactionSettings: {allow_comment: {enabled: false}, allow_duet: {enabled: true}}},
        commercialContentTypes: [{value: "none", label: "None"}, {value: "brand_organic", label: "Your brand"}]
    }, "acc_1");
    assert.equal(info.accountId, "acc_1");
    assert.equal(info.nickname, "animaldex.app");
    assert.deepEqual(info.privacyLevels, [{value: "PUBLIC_TO_EVERYONE", label: "Everyone"}, {value: "SELF_ONLY", label: "SELF_ONLY"}]);
    assert.deepEqual(info.interactions, {allowComment: false, allowDuet: true, allowStitch: true});
    assert.equal(info.maxVideoDurationSec, 600);
    assert.equal(info.commercialContentTypes.length, 2);

    const empty = parseTikTokAccountInfo({}, "acc_2");
    assert.equal(empty.nickname, null);
    assert.equal(empty.canPostMore, true);
    assert.deepEqual(empty.privacyLevels, []);
    assert.deepEqual(empty.interactions, {allowComment: true, allowDuet: true, allowStitch: true});
    assert.equal(empty.maxVideoDurationSec, null);
});

const row = (patch: Partial<SocialPostRow>): SocialPostRow => ({
    id: "r", platform: "tiktok", media_path: "story_video/a/en.mp4", media_kind: "story_video", species_profile_id: null, species_name: null,
    page_slug: null, capture_id: null, caption: "c", title: null, mode: "post", status: "queued", external_id: null, external_url: null,
    error: null, options: null, created_at: "2026-10-17T10:00:00Z", updated_at: "2026-10-17T10:00:00Z", ...patch
});

test("only waiting TikTok rows with a Zernio post that was not checked lately are synced", () => {
    const now = Date.parse("2026-10-17T12:00:00Z");
    const zernio = (syncedAt: string | null) => ({zernio: {postId: "p1", scheduledFor: null, timezone: null, syncedAt}});
    const rows = [
        row({id: "never", options: zernio(null)}),
        row({id: "old", status: "processing", options: zernio("2026-10-17T11:59:00Z")}),
        row({id: "fresh", options: zernio("2026-10-17T11:59:50Z")}),
        row({id: "done", status: "published", external_url: "https://www.tiktok.com/@animaldex.app/video/1", options: zernio(null)}),
        // Published but TikTok has not handed over the URL yet: asked again for an hour.
        row({id: "no-url", status: "published", external_url: null, updated_at: "2026-10-17T11:50:00Z", options: zernio(null)}),
        row({id: "no-url-old", status: "published", external_url: null, updated_at: "2026-10-17T09:00:00Z", options: zernio(null)}),
        row({id: "draft-done", status: "published", mode: "draft", external_url: null, updated_at: "2026-10-17T11:50:00Z", options: zernio(null)}),
        row({id: "no-post", options: {zernio: {postId: "", scheduledFor: null, timezone: null}}}),
        row({id: "uploading", status: "processing", options: null}),
        row({id: "yt", platform: "youtube", options: null})
    ];
    assert.deepEqual(rowsNeedingSync(rows, now).map((item) => item.id), ["never", "old", "no-url"]);
});

test("a post deleted in Zernio ends the row instead of leaving it waiting", () => {
    const base = row({options: {tiktok: options, zernio: {postId: "p1", scheduledFor: "2026-10-18T09:00:00.000Z", timezone: "Europe/London"}}});
    const patch = goneFromZernioPatch(base, new Date("2026-10-17T12:00:00Z"));
    assert.equal(patch.status, "failed");
    assert.match(patch.error, /no longer exists in Zernio/);
    assert.deepEqual(patch.options.tiktok, options);
    assert.equal(patch.options.zernio?.postId, "p1");
    assert.equal(patch.options.zernio?.syncedAt, "2026-10-17T12:00:00.000Z");
});

test("a Zernio snapshot patches the row and keeps the schedule bookkeeping", () => {
    const base = row({options: {tiktok: options, zernio: {postId: "", scheduledFor: "2026-10-18T09:00:00.000Z", timezone: "Europe/London"}}});
    const when = new Date("2026-10-17T12:00:00Z");
    const patch = zernioPatchForRow(base, parseZernioPost(post("scheduled"))!, when);
    assert.equal(patch.status, "queued");
    assert.equal(patch.external_id, "p1");
    assert.deepEqual(patch.options.tiktok, options);
    assert.deepEqual(patch.options.zernio, {postId: "p1", scheduledFor: "2026-10-18T09:00:00.000Z", timezone: "Europe/London", platformPostId: null, publishedAt: null, syncedAt: "2026-10-17T12:00:00.000Z"});
    const live = zernioPatchForRow(base, parseZernioPost(post("published", {status: "published", platformPostId: "7421", platformPostUrl: "https://t/7421"}))!, when);
    assert.equal(live.status, "published");
    assert.equal(live.external_url, "https://t/7421");
    assert.equal(live.options.zernio?.platformPostId, "7421");
});

test("a rate-limited create is retried once only when the wait is short", () => {
    assert.equal(rateLimitRetryDelaySeconds(new ZernioError("slow", {kind: "rate_limited", retryAfterSeconds: 30})), 30);
    assert.equal(rateLimitRetryDelaySeconds(new ZernioError("slow", {kind: "rate_limited", retryAfterSeconds: 600})), null);
    assert.equal(rateLimitRetryDelaySeconds(new ZernioError("slow", {kind: "rate_limited"})), null);
    assert.equal(rateLimitRetryDelaySeconds(new ZernioError("down", {kind: "unavailable", retryAfterSeconds: 10})), null);
    assert.equal(rateLimitRetryDelaySeconds(new Error("x")), null);
});
