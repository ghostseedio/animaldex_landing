import assert from "node:assert/strict";
import test from "node:test";
import {classifyProviderReply, higgsfieldCreditFailure} from "./api-status-core";
import type {PlanScene} from "./content-video/plan";
import {REVIEW_SYSTEM_PROMPT, scriptForReview} from "./social-lab/review";
import {DEFAULT_DAILY_CAPS} from "./social/auto-share-plan";
import {fillLinks} from "./social/platform-copy";

test("Higgsfield's not_enough_credits reads as out of credit", () => {
    assert.equal(classifyProviderReply(403, 'higgsfield submit 403: "not_enough_credits"'), "no_credit");
    assert.equal(classifyProviderReply(400, "not enough credits"), "no_credit");
});

test("only the latest video with settled clips decides whether Higgsfield is out; a top-up clears it", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    const empty = {updated_at: "2026-11-06T04:54:00Z", clips: [{status: "failed", error: 'higgsfield submit 403: "not_enough_credits"'}]};
    const fine = {updated_at: "2026-11-06T10:00:00Z", clips: [{status: "completed"}, {status: "failed", error: "Timed out waiting for Higgsfield"}]};
    const footageOnly = {updated_at: "2026-11-06T11:00:00Z", clips: []};
    assert.match(higgsfieldCreditFailure([empty, footageOnly], now) ?? "", /not_enough_credits/);
    assert.equal(higgsfieldCreditFailure([empty, fine, footageOnly], now), null);
    // Older than three days: no longer evidence.
    assert.equal(higgsfieldCreditFailure([{...empty, updated_at: "2026-11-01T00:00:00Z"}], now), null);
});

const scene = (visual: PlanScene["visual"]): PlanScene => ({narration: "x", overlay: "", visual, image: 1, focusX: 0.5, motionPrompt: ""});

test("no platform gets more than two videos a day", () => {
    for (const caps of Object.values(DEFAULT_DAILY_CAPS)) assert.ok(caps.video <= 2 && caps.carousel <= 2 && caps.text <= 2);
});

test("the 5-year-old test knows a quiz hides its animal on purpose", () => {
    const images = [{index: 1, src: "", alt: "a paw", width: 1, height: 1, caption: null, license: null}];
    const quiz = (format: "guess" | "editorial") => scriptForReview({format, title: "t", hookText: "NAME IT", scenes: [scene("image")], ctaNarration: "", ctaText: "", musicMood: "curious", share: {} as never}, {title: "Guess", images}, "comment");
    assert.match(quiz("guess"), /A QUIZ: the viewer guesses the animal/);
    assert.doesNotMatch(quiz("editorial"), /A QUIZ/);
    assert.match(REVIEW_SYSTEM_PROMPT, /knows the GAME/);
});

test("a link placeholder the writer left in becomes the page link; YouTube never gets < or >", () => {
    const description = "One fly dominates.\nFull breakdown: <url>\nSubscribe @animaldexapp for more";
    assert.equal(fillLinks(description, "https://animaldex.app/comparisons/a-vs-b", "youtube"), "One fly dominates.\nFull breakdown: https://animaldex.app/comparisons/a-vs-b\nSubscribe @animaldexapp for more");
    assert.equal(fillLinks("Full guide: <pageUrl>", "https://animaldex.app/x", "facebook"), "Full guide: https://animaldex.app/x");
    assert.equal(fillLinks(description, null, "facebook"), "One fly dominates.\nSubscribe @animaldexapp for more");
    assert.equal(fillLinks("Lions <3 naps", null, "youtube"), "Lions 3 naps");
});

test("no voice: each line stays on screen as long as it takes to read, over silence the mix fills with music", async () => {
    const {readingSeconds, silentLine, wavPcm, wavSeconds} = await import("./content-video/tts");
    const {experimentBrief} = await import("./social-lab/arms");
    assert.equal(readingSeconds("It runs 60 km/h."), Math.max(1.4, 4 / 2.6 + 0.6));
    assert.equal(readingSeconds("a ".repeat(40)), 6);
    const line = silentLine("Gorilla or crocodile? One word.");
    assert.equal(line.provider, "none");
    assert.ok(Math.abs(wavSeconds(line.wav) - line.seconds) < 0.01);
    assert.equal(wavPcm(line.wav).sampleRate, 24000);
    assert.ok(wavPcm(line.wav).pcm.every((byte) => byte === 0));
    assert.match(experimentBrief({version: 2, voice: "no_voice"}), /NO VOICEOVER: nobody speaks/);
    assert.doesNotMatch(experimentBrief({version: 2, voice: "ai_voice", ending: "loop"}), /VOICE/);
});
