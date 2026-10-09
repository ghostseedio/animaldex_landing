import {test} from "node:test";
import assert from "node:assert/strict";
import {defaultShareCaption, defaultShareTitle, fitForX, X_POST_LIMIT, xLength} from "./social/captions";
import {decryptToken, encryptToken} from "./social/token-crypto";
import {needsRefresh} from "./social/refresh-policy";
import {tiktokChunkPlan} from "./social/publishers";
import {mediaPathOf} from "./social/story-videos";
import type {SocialConnection} from "./social/types";

const pageUrl = "https://animaldex.app/animals/scimitar-horned-oryx";

test("default title fits YouTube and caption carries the page link and tags", () => {
    assert.ok(defaultShareTitle("A".repeat(200)).length <= 100);
    const caption = defaultShareCaption("Scimitar-horned Oryx", pageUrl);
    assert.ok(caption.includes(pageUrl));
    assert.ok(caption.includes("#ScimitarHornedOryx"));
});

test("X text counts links as 23 and is cut to fit, keeping the link", () => {
    assert.equal(xLength(`hi ${pageUrl}`), 3 + 23);
    const long = `${"Meet the most remarkable animal you will ever see in the wild ".repeat(8)}\n\nmore`;
    const fitted = fitForX(long, pageUrl);
    assert.ok(xLength(fitted) <= X_POST_LIMIT);
    assert.ok(fitted.includes(pageUrl));
    const short = defaultShareCaption("Cape Buffalo", pageUrl);
    assert.equal(fitForX(short, pageUrl), short);
});

test("tokens round-trip encrypted and are not stored in the clear", () => {
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "test-secret";
    const sealed = encryptToken("ya29.secret-token");
    assert.ok(!sealed.includes("secret-token"));
    assert.equal(decryptToken(sealed), "ya29.secret-token");
    assert.notEqual(encryptToken("same"), encryptToken("same"));
});

test("refresh margins: minutes for short-lived tokens, a week for Instagram", () => {
    const base: SocialConnection = {platform: "x", accountId: null, accountName: null, accessToken: "t", refreshToken: "r", expiresAt: null, scopes: null};
    const now = Date.parse("2026-10-09T00:00:00Z");
    assert.equal(needsRefresh({...base, expiresAt: new Date(now + 60 * 60_000)}, now), false);
    assert.equal(needsRefresh({...base, expiresAt: new Date(now + 2 * 60_000)}, now), true);
    assert.equal(needsRefresh({...base, platform: "instagram", expiresAt: new Date(now + 3 * 86_400_000)}, now), true);
    assert.equal(needsRefresh({...base, platform: "instagram", expiresAt: new Date(now + 30 * 86_400_000)}, now), false);
});

test("TikTok sends story-sized files whole and chunks large ones", () => {
    assert.deepEqual(tiktokChunkPlan(40 * 1024 * 1024), {chunkSize: 40 * 1024 * 1024, count: 1});
    const big = 130 * 1024 * 1024 + 123;
    const plan = tiktokChunkPlan(big);
    assert.equal(plan.chunkSize, 10 * 1024 * 1024);
    assert.equal(plan.count, 13);
    assert.ok(big - plan.chunkSize * (plan.count - 1) < 128 * 1024 * 1024);
});

test("media path is read from the stable URL", () => {
    assert.equal(mediaPathOf("https://x.supabase.co/functions/v1/species-story-media?path=story_video%2Fabc%2Fen.mp4"), "story_video/abc/en.mp4");
    assert.equal(mediaPathOf("not a url"), null);
});

import {buildTemplateCopy, groupTags, normalizeShareCopy, parseShareCopy, type SpeciesShareContext} from "./social/share-copy";

const beetle: SpeciesShareContext = {
    name: "Asiatic Rhinoceros Beetle", scientificName: "Oryctes rhinoceros", category: "Insect",
    pageUrl: "https://animaldex.app/animals/asiatic-rhinoceros-beetle",
    summary: "A heavy, horned scarab beetle. Adults bore into palms.",
    facts: ["A palm has a single growing point, so a beetle that bores deep enough to destroy it kills the whole tree.", "Short."],
    principle: "Strength In Resilience", motto: null, coreLesson: "Resilience conquers challenges.", qualities: ["resilience"],
    dreamMeaning: "It points to quiet persistence.", trial: null, biomimicry: null, script: null, videoHook: null
};

test("the brand stays out of the YouTube title and #AnimalDex is on every platform", () => {
    const copy = normalizeShareCopy({
        youtube: {title: "This beetle kills palms | AnimalDex #Shorts", description: "no tags here"},
        tiktok: {caption: "hook"}, instagram: {caption: "hook"}, facebook: {caption: "hook"}, x: {text: "hook"}
    }, beetle);
    assert.equal(copy.youtube.title, "This beetle kills palms");
    for (const text of [copy.youtube.description, copy.tiktok.caption, copy.instagram.caption, copy.facebook.caption, copy.x.text]) assert.match(text, /#AnimalDex/);
});

test("an over-long X post is trimmed to 280 with its hashtags kept", () => {
    const copy = normalizeShareCopy({
        youtube: {title: "t", description: "d"}, tiktok: {caption: "c"}, instagram: {caption: "c"}, facebook: {caption: "c"},
        x: {text: `${"word ".repeat(80)}#AnimalDex #Beetle`}
    }, beetle);
    assert.ok(xLength(copy.x.text) <= X_POST_LIMIT);
    assert.match(copy.x.text, /#AnimalDex #Beetle$/);
});

test("the template leads with the vivid fact and carries the search intents", () => {
    const copy = buildTemplateCopy(beetle);
    assert.ok(copy.tiktok.caption.startsWith("A palm has a single growing point"));
    assert.match(copy.youtube.title, /Meaning & Facts/);
    assert.doesNotMatch(copy.youtube.title, /animaldex/i);
    assert.match(copy.youtube.description, /symbolism/i);
    assert.match(copy.youtube.description, /Dreaming of an asiatic rhinoceros beetle/);
    assert.match(copy.youtube.description, /#AnimalDex #Shorts #AsiaticRhinocerosBeetle/);
    assert.match(copy.tiktok.caption, /@animaldex\.app/);
    assert.match(copy.instagram.caption, /@animaldexapp/);
    assert.equal(groupTags("Insect", beetle.name).tiktok, "#insectsoftiktok");
});

test("unusable model replies are rejected", () => {
    assert.equal(parseShareCopy("not json"), null);
    assert.equal(parseShareCopy(JSON.stringify({youtube: {title: ""}})), null);
    assert.ok(parseShareCopy("```json\n" + JSON.stringify({youtube: {title: "t", description: "d"}, tiktok: {caption: "c"}, instagram: {caption: "c"}, facebook: {caption: "c"}, x: {text: "x"}}) + "\n```"));
    assert.equal(parseShareCopy(JSON.stringify({youtube: {title: "t", description: "d"}, tiktok: {caption: "c"}, instagram: {caption: "c"}, x: {text: "x"}})), null);
});

import {pickFacebookPage} from "./social/facebook-page";

test("Facebook picks the configured Page, else the AnimalDex one, and never a Page it cannot post to", () => {
    const pages = [
        {id: "1", name: "Lenny's Page", access_token: "a", tasks: ["CREATE_CONTENT"]},
        {id: "2", name: "AnimalDex", access_token: "b", tasks: ["CREATE_CONTENT", "MANAGE"]},
        {id: "3", name: "Read only", access_token: "c", tasks: ["ANALYZE"]}
    ];
    assert.equal(pickFacebookPage(pages, "1")?.id, "1");
    assert.equal(pickFacebookPage(pages, null)?.id, "2");
    assert.equal(pickFacebookPage(pages, "3")?.id, "2");
    assert.equal(pickFacebookPage([pages[0], pages[2]], null)?.id, "1");
    assert.equal(pickFacebookPage([], null), null);
});

test("the template gives Facebook a clickable guide link", () => {
    assert.match(buildTemplateCopy(beetle).facebook.caption, /https:\/\/animaldex\.app\/animals\/asiatic-rhinoceros-beetle/);
});

import {parseTikTokCreatorInfo, readTikTokOptions, tiktokOptionsProblem} from "./social/tiktok-options";

test("TikTok posts need an explicit privacy choice that the account allows", () => {
    const allowed = ["FOLLOWER_OF_CREATOR", "SELF_ONLY"];
    assert.match(tiktokOptionsProblem(readTikTokOptions({}), allowed) ?? "", /Choose who can view/);
    assert.match(tiktokOptionsProblem(readTikTokOptions({privacyLevel: "PUBLIC_TO_EVERYONE"}), allowed) ?? "", /not available/);
    assert.equal(tiktokOptionsProblem(readTikTokOptions({privacyLevel: "SELF_ONLY"}), allowed), null);
    assert.match(tiktokOptionsProblem(readTikTokOptions({privacyLevel: "SELF_ONLY", brandContent: true}), allowed) ?? "", /Branded content cannot be private/);
});

test("TikTok interaction and disclosure settings default to off", () => {
    const options = readTikTokOptions({privacyLevel: "SELF_ONLY", allowComment: "yes"});
    assert.deepEqual(options, {privacyLevel: "SELF_ONLY", allowComment: false, allowDuet: false, allowStitch: false, brandOrganic: false, brandContent: false});
    assert.equal(readTikTokOptions(null), undefined);
});

test("creator_info is read defensively", () => {
    const info = parseTikTokCreatorInfo({creator_nickname: "animaldex.app", privacy_level_options: ["SELF_ONLY", 3], comment_disabled: true, max_video_post_duration_sec: 600});
    assert.deepEqual(info.privacyLevelOptions, ["SELF_ONLY"]);
    assert.equal(info.commentDisabled, true);
    assert.equal(info.maxVideoPostDurationSec, 600);
    assert.equal(parseTikTokCreatorInfo(undefined).nickname, null);
});
