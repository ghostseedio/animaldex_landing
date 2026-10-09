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
        tiktok: {caption: "hook"}, instagram: {caption: "hook"}, x: {text: "hook"}
    }, beetle);
    assert.equal(copy.youtube.title, "This beetle kills palms");
    for (const text of [copy.youtube.description, copy.tiktok.caption, copy.instagram.caption, copy.x.text]) assert.match(text, /#AnimalDex/);
});

test("an over-long X post is trimmed to 280 with its hashtags kept", () => {
    const copy = normalizeShareCopy({
        youtube: {title: "t", description: "d"}, tiktok: {caption: "c"}, instagram: {caption: "c"},
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
    assert.ok(parseShareCopy("```json\n" + JSON.stringify({youtube: {title: "t", description: "d"}, tiktok: {caption: "c"}, instagram: {caption: "c"}, x: {text: "x"}}) + "\n```"));
});
