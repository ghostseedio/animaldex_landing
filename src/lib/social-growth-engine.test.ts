import {test} from "node:test";
import assert from "node:assert/strict";
import {experimentBrief, EXPERIMENT_VERSION, HOOK_STYLES, KIND_DIMENSIONS} from "./social-lab/arms";
import {armStats, chooseExperiment, itemScores, percentile, pickArm, scoreShares, type ScoredShare} from "./social-lab/bandit";
import {fromZernioAnalytics, metricsRow, ratio, zernioAnalyticsKeys} from "./social-lab/metrics-core";
import {contentKindOf, dailyCaps, dayStartMs, pickLightKind, platformsWithRoom, postedToday} from "./social/auto-share-plan";
import {blueskyCaption, captionFits, captionForPlatform, pinterestCopy, threadsCaption, visibleLength} from "./social/platform-copy";
import type {ShareCopy} from "./social/share-copy";
import type {SocialPostRow} from "./social/types";
import {buildZernioPostBody, parseZernioAccounts, parseZernioPost, rowStateFromZernio} from "./social/zernio-core";
import {normalizeCarousel, normalizeTextPosts, textShareCopy} from "./social-content/plan";
import {contentIdFromMediaPath, contentMediaPath} from "./social-content/types";
import {buildTimeline, type VideoPlan} from "./content-video/plan";
import {normalizeBattlePlan, normalizeCreaturePlan} from "./content-video/formats";

// The growth engine's pure parts: per-platform copy for Pinterest, Threads and
// Bluesky; the daily caps; the hook lab's scoring and picking; Zernio post
// bodies; the carousel and text-post checks; and the loop / cold-open edits.

const copy: ShareCopy = {
    youtube: {title: "The Fastest Animal Doesn't Run | Top 5 Fastest Animals", description: "240 mph and no engine.\nNumber one dives.\nFull article: https://animaldex.app/tier-list/fastest\nSubscribe @animaldexapp for more.\n#AnimalDex #Shorts #Animals #Speed"},
    tiktok: {caption: "240 mph. No engine. 🦅\nWhich one would win a race?\nFollow @animaldex.app\n#AnimalDex #animals"},
    instagram: {caption: "The fastest animal on Earth doesn't run.\n\nIt falls out of the sky at 240 mph, folding its wings into a missile.\n\nFollow @animaldexapp for more.\n\n#AnimalDex #Birds #Speed"},
    facebook: {caption: "The fastest animal doesn't run.\n\nFull article: https://animaldex.app/tier-list/fastest\n\n#AnimalDex"},
    x: {text: "The fastest animal on Earth doesn't run. It dives at 240 mph. #AnimalDex"}
};

test("Threads drops the follow line and the hashtag block, keeps one tag, and fits 500", () => {
    const caption = threadsCaption(copy);
    assert.match(caption, /^The fastest animal on Earth doesn't run\./);
    assert.doesNotMatch(caption, /Follow @animaldexapp/);
    assert.equal(caption.match(/#\w+/g)?.join(" "), "#AnimalDex");
    assert.ok(visibleLength(caption) <= 500);
    const long = {...copy, instagram: {caption: "x ".repeat(400)}};
    assert.ok(visibleLength(threadsCaption(long)) <= 500);
});

test("Bluesky adds the link only when it fits 300; Pinterest keeps the title, drops the article line, tags without #Shorts", () => {
    assert.match(blueskyCaption(copy, "https://animaldex.app/tier-list/fastest"), /\n\nhttps:\/\/animaldex\.app\/tier-list\/fastest$/);
    const tight = {...copy, x: {text: "y".repeat(280)}};
    assert.equal(blueskyCaption(tight, "https://animaldex.app/a-very-long-path"), "y".repeat(280));
    const pin = pinterestCopy(copy);
    assert.equal(pin.title, copy.youtube.title);
    assert.doesNotMatch(pin.caption, /Full article|Subscribe|#Shorts/);
    assert.match(pin.caption, /#AnimalDex #Animals #Speed$/);
    assert.ok(captionFits("pinterest", pin));
    assert.deepEqual(captionForPlatform(copy, "youtube", null), {caption: copy.youtube.description, title: copy.youtube.title});
    assert.ok(!captionFits("bluesky", {caption: "z".repeat(301), title: null}));
});

const now = Date.parse("2026-10-28T05:00:00Z"); // 12:00 in Jakarta

function row(overrides: Partial<SocialPostRow>): SocialPostRow {
    return {
        id: Math.random().toString(36).slice(2), platform: "tiktok", media_path: "a.mp4", media_kind: "blog_video",
        species_profile_id: null, species_name: null, page_slug: null, capture_id: null, caption: "", title: null,
        mode: "post", status: "published", external_id: null, external_url: null, error: null, options: null,
        created_at: new Date(now - 3_600_000).toISOString(), updated_at: new Date(now).toISOString(), ...overrides
    };
}

test("the day starts at Jakarta midnight; caps count today's live posts by kind, not failures or drafts", () => {
    assert.equal(new Date(dayStartMs(now)).toISOString(), "2026-10-27T17:00:00.000Z");
    const posts = [
        row({}), row({}), row({status: "failed"}), row({mode: "draft"}),
        row({created_at: "2026-10-27T16:00:00Z"}),
        row({media_kind: "carousel", media_path: "social/x"}),
        row({platform: "x", media_kind: "text_post"})
    ];
    assert.equal(postedToday(posts, "tiktok", "video", now), 2);
    assert.equal(postedToday(posts, "tiktok", "carousel", now), 1);
    assert.equal(contentKindOf({media_kind: "text_post"}), "text");
    const caps = dailyCaps('{"tiktok":{"video":2},"x":{"text":"bad"}}');
    assert.equal(caps.tiktok.video, 2);
    assert.equal(caps.x.text, 3);
    assert.deepEqual(platformsWithRoom(["tiktok", "youtube"], "video", posts, caps, now), ["youtube"]);
    assert.deepEqual(platformsWithRoom(["youtube", "instagram"], "carousel", posts, caps, now), ["instagram"]);
    assert.equal(dailyCaps("not json").youtube.video, 6);
});

test("the light kind with more room left goes next; none when both are spent", () => {
    const caps = dailyCaps(null);
    assert.equal(pickLightKind(["x", "threads"], [], caps, now), "text");
    assert.equal(pickLightKind(["instagram", "tiktok"], [], caps, now), "carousel");
    const spent = dailyCaps('{"youtube":{"carousel":0,"text":0}}');
    assert.equal(pickLightKind(["youtube"], [], spent, now), null);
});

function share(overrides: Partial<ScoredShare> & {itemId: string}): ScoredShare {
    return {itemKind: "editorial", family: "video", platform: "tiktok", experiment: {version: EXPERIMENT_VERSION, hookStyle: "question"}, ageHours: 48, metrics: {views: 100, likes: 1, comments: 0, shares: 0, saves: 0, hold_3s: 0.3, completion: 0.02, avg_view_pct: null}, ...overrides};
}

test("scores are percentiles within platform and family; young posts are not judged", () => {
    assert.equal(percentile(5, [1, 5, 9]), 0.5);
    assert.equal(percentile(9, [1, 5, 9]), 1);
    const shares = [
        share({itemId: "a", metrics: {views: 300, likes: 1, comments: 0, shares: 0, saves: 0, hold_3s: 0.5, completion: 0.05, avg_view_pct: null}}),
        share({itemId: "b", experiment: {version: EXPERIMENT_VERSION, hookStyle: "pov"}, metrics: {views: 100, likes: 1, comments: 0, shares: 0, saves: 0, hold_3s: 0.2, completion: 0.01, avg_view_pct: null}}),
        share({itemId: "c", metrics: {views: 200, likes: 1, comments: 0, shares: 0, saves: 0, hold_3s: 0.35, completion: 0.02, avg_view_pct: null}}),
        share({itemId: "d", ageHours: 5}),
        share({itemId: "e", platform: "youtube"})
    ];
    const scored = scoreShares(shares);
    assert.deepEqual(scored.map((entry) => [entry.itemId, Math.round(entry.score * 100)]), [["a", 100], ["b", 0], ["c", 50]]);
    const items = itemScores(scored);
    const stats = armStats(items, "hookStyle", ["editorial"]);
    const question = stats.find((entry) => entry.arm === "question")!;
    assert.equal(question.items, 2);
    assert.equal(question.mean, 0.75);
    assert.equal(stats.find((entry) => entry.arm === "mystery")!.items, 0);
});

test("picking: exploration takes a random arm; otherwise the clearly better arm wins", () => {
    const stats = [{arm: "good", items: 40, mean: 0.9, alpha: 37, beta: 5}, {arm: "bad", items: 40, mean: 0.1, alpha: 5, beta: 37}];
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const picks = Array.from({length: 200}, () => pickArm(stats, random, 0));
    assert.ok(picks.filter((arm) => arm === "good").length > 190);
    assert.equal(pickArm(stats, () => 0.01, 0.15), "good");
    const experiment = chooseExperiment("editorial", [], random);
    assert.deepEqual(Object.keys(experiment).sort(), ["ending", "hookStyle", "length", "version"]);
    assert.ok(Object.hasOwn(HOOK_STYLES, experiment.hookStyle!));
    assert.deepEqual(KIND_DIMENSIONS.text, ["textFormat"]);
    assert.match(experimentBrief({version: 1, hookStyle: "pov", ending: "loop"}), /HOOK STYLE — POV[\s\S]*ENDING — No call-to-action card/);
    assert.equal(experimentBrief(null), "");
});

test("Zernio analytics map to one metrics row: hold at 1 s / 3 s from the curve, ratios held to 0–1, matched by any id", () => {
    const post = {_id: "z1", latePostId: "late1", platformPostUrl: "https://www.tiktok.com/@animaldex.app/video/7701632792580394273", analytics: {views: 286, likes: 17, shares: 1, completionRate: 0.0201, igReelsAvgWatchTime: 4750, retentionCurve: {"0": 1, "1": 0.88, "3": 0.55}}};
    const metrics = fromZernioAnalytics(post);
    assert.equal(metrics.views, 286);
    assert.equal(metrics.hold_3s, 0.55);
    assert.equal(metrics.completion, 0.0201);
    assert.equal(metrics.avg_watch_seconds, 4.75);
    assert.equal(ratio(55), 0.55);
    assert.deepEqual(zernioAnalyticsKeys(post), ["z1", "late1", "7701632792580394273"]);
    const saved = metricsRow("p1", "tiktok", "2026-10-26T05:00:00Z", metrics, new Date(now));
    assert.equal(saved.age_hours, 48);
});

test("Zernio bodies: a Pinterest pin carries board, title and link; a TikTok photo carousel strips tags from its title", () => {
    const pin = buildZernioPostBody({platform: "pinterest", accountId: "acc", content: "desc", media: [{type: "image", url: "https://x/1.jpg"}], pinterest: {boardId: "b1", title: "Title", link: "https://animaldex.app/a"}});
    assert.deepEqual(pin.platforms, [{platform: "pinterest", accountId: "acc", platformSpecificData: {boardId: "b1", title: "Title", link: "https://animaldex.app/a"}}]);
    assert.equal(pin.publishNow, true);
    const options = {privacyLevel: "PUBLIC_TO_EVERYONE", allowComment: true, allowDuet: true, allowStitch: true, brandOrganic: false, brandContent: false, madeWithAi: true, previewConfirmed: true};
    const photo = buildZernioPostBody({platform: "tiktok", accountId: "t", content: "Which one wins? #AnimalDex #animals 🦅", media: [{type: "image", url: "https://x/1.jpg"}], tiktokPhoto: {description: "Long caption", options}});
    assert.equal(photo.content, "Which one wins? 🦅");
    assert.equal((photo as {tiktokSettings?: {mediaType?: string; autoAddMusic?: boolean}}).tiktokSettings?.mediaType, "photo");
    const threads = buildZernioPostBody({platform: "threads", accountId: "th", content: "Hot take", media: []});
    assert.deepEqual(threads.platforms, [{platform: "threads", accountId: "th"}]);
    assert.ok(!("tiktokSettings" in threads));
});

test("Zernio accounts and per-platform post states", () => {
    assert.deepEqual(parseZernioAccounts({accounts: [{_id: "1", platform: "Pinterest", username: "animaldex", isActive: true}, {_id: "2", platform: "threads", needsReconnection: true}, {platform: "x"}]}), [
        {id: "1", platform: "pinterest", username: "animaldex", active: true},
        {id: "2", platform: "threads", username: null, active: false}
    ]);
    const snapshot = parseZernioPost({_id: "p", status: "failed", platforms: [{platform: "threads", status: "failed", errorMessage: "Too long"}]}, "threads")!;
    assert.deepEqual(rowStateFromZernio(snapshot, "threads"), {status: "failed", external_url: null, error: "Threads: Too long"});
});

test("a carousel reply is repaired: cover first, cta last, unknown photos dropped, bare items become text", () => {
    const slide = (layout: string, title: string, image = 0) => ({layout, kicker: "", title, body: "b", image, stat_label: "", stat_value: ""});
    const reply = {
        template: "countdown",
        slides: [slide("item", "Hook", 9), slide("item", "One", 2), slide("item", "Two"), slide("cover", "Three", 3), slide("text", "Four"), slide("item", "Ask")],
        share: copy
    };
    const result = normalizeCarousel(reply, [1, 2, 3], ["countdown"])!;
    assert.deepEqual(result.spec.slides.map((entry) => [entry.layout, entry.image]), [["cover", 1], ["item", 2], ["text", null], ["item", 3], ["text", null], ["cta", null]]);
    assert.equal(normalizeCarousel({...reply, slides: reply.slides.slice(0, 3)}, [1], ["countdown"]), null);
    assert.equal(normalizeCarousel({...reply, share: null}, [1], ["countdown"]), null);
});

test("text posts: polls need two options, links are stripped, Facebook gets the link and options", () => {
    const posts = normalizeTextPosts({posts: [
        {format: "poll", text: "Who wins?", long: "Who wins a sprint?", poll_options: ["Cheetah", "Pronghorn"]},
        {format: "poll", text: "Bad poll", long: "", poll_options: ["Only one"]},
        {format: "hot_take", text: "Hyenas out-hunt lions https://x.co/a", long: "", poll_options: []}
    ]}, ["poll", "poll", "hot_take"]);
    assert.equal(posts.length, 2);
    assert.deepEqual(posts[0].poll, ["Cheetah", "Pronghorn"]);
    assert.equal(posts[1].text, "Hyenas out-hunt lions");
    assert.equal(posts[1].poll, null);
    const shared = textShareCopy(posts[0], "https://animaldex.app/comparisons/a");
    assert.match(shared.facebook.caption, /• Cheetah\n• Pronghorn\n\nhttps:\/\/animaldex\.app\/comparisons\/a$/);
    assert.equal(shared.x.text, "Who wins?");
    assert.equal(contentIdFromMediaPath(contentMediaPath("0b1c2d3e-0000-4000-8000-000000000000")), "0b1c2d3e-0000-4000-8000-000000000000");
});

const basePlan: VideoPlan = {
    title: "t", hookText: "HOOK", ctaNarration: "Comment below.", ctaText: "Comment", musicMood: "curious", share: copy,
    scenes: [{narration: "a", overlay: "", visual: "ai_clip", image: 1, focusX: 0.5, motionPrompt: "m"}, {narration: "b", overlay: "", visual: "image", image: 1, focusX: 0.5, motionPrompt: ""}]
};

test("a looping video has no end card; the default keeps it", () => {
    assert.equal(buildTimeline(basePlan, [2, 2], 1.5).at(-1)?.kind, "end");
    const loop = buildTimeline({...basePlan, ending: "loop"}, [2, 2], 0);
    assert.equal(loop.length, 2);
    assert.equal(loop.at(-1)?.kind, "scene");
});

const fighter = (name: string, image: number) => ({name, slug: name.toLowerCase(), image});

test("a battle's cold open plays the clash first, then a short VS card, and the HUD follows the shifted fight", () => {
    const source = {
        type: "comparison" as const, format: "battle" as const, slug: "lion-vs-tiger", title: "Lion vs Tiger", description: "", url: "https://animaldex.app/comparisons/lion-vs-tiger", tags: [], text: "", images: [],
        battle: {a: fighter("Lion", 1), b: fighter("Tiger", 2), stats: [{label: "Bite", a: "650", b: "1050", advantage: "b" as const}, {label: "Weight", a: "190", b: "220", advantage: "b" as const}], scenarios: [], verdict: "", winner: "b" as const}
    };
    const beat = {narration: "Hit!", motion_prompt: "move", shot: "frame", power: "ROAR", attacker: "a"};
    const reply = {title: "t", hook_text: "THE KING LOSES", intro_narration: "Everyone says the lion wins.", stats: [], arena: "", look_a: "", look_b: "", beats: [beat, beat, beat, beat, beat], winner: "b", cta_narration: "", cta_text: "", music_mood: "intense", share: copy};
    const cold = normalizeBattlePlan(reply, source, {version: 1, opener: "cold_open"})!;
    assert.equal(cold.scenes.length, 7);
    assert.equal(cold.scenes[0].reuseClip, 4);
    assert.equal(cold.scenes[0].narration, "Everyone says the lion wins.");
    assert.equal(cold.scenes[1].visual, "card");
    assert.equal(cold.scenes[4].fx, "clash");
    assert.deepEqual(cold.hud?.fightScenes, [2, 3, 4, 5, 6]);
    const first = normalizeBattlePlan(reply, source, {version: 1, opener: "card_first"})!;
    assert.equal(first.scenes.length, 6);
    assert.equal(first.scenes[0].visual, "card");
    assert.deepEqual(first.hud?.fightScenes, [1, 2, 3, 4, 5]);
});

test("a creature's cold open shows the creature before the parents", () => {
    const source = {
        type: "hybrid" as const, format: "creature" as const, slug: "lion-shark", title: "Lion + Shark", description: "", url: "u", tags: [], text: "", images: [],
        creature: {kind: "hybrid" as const, name: "Lionshark", parents: [fighter("Lion", 1), fighter("Great White Shark", 2)] as [ReturnType<typeof fighter>, ReturnType<typeof fighter>], appearance: "", behavior: "", habitat: ""}
    };
    const reply = {title: "t", hook_text: "LION + SHARK = ?", intro_narration: "Nowhere is safe.", creature_name: "Lionshark", keyframe_prompt: "k", motion_prompt: "m", narration: "It hunts.", cta_narration: "", cta_text: "", music_mood: "wonder", share: copy};
    const plan = normalizeCreaturePlan(reply, source, {version: 1, opener: "cold_open"})!;
    assert.deepEqual(plan.scenes.map((scene) => scene.visual), ["image", "card", "ai_clip"]);
    assert.equal(plan.scenes[0].reuseClip, 2);
    assert.equal(plan.scenes[1].narration, "Lion plus Great White Shark.");
});
