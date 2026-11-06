import assert from "node:assert/strict";
import test from "node:test";
import {GUESS_SYSTEM_PROMPT, LESSON_SYSTEM_PROMPT, normalizeGuessPlan, normalizeLessonPlan} from "./content-video/formats";
import {applyStatCards, buildAss, buildTimeline, type StatCard, type VideoSource} from "./content-video/plan";
import {pickRandomSource} from "./content-video/auto-generate-plan";
import {NOIR_GRADE} from "./content-video/render";
import {formatOfPost} from "./social-lab/format-board";

const share = {youtube: {title: "What the lion knows", description: "d"}, tiktok: {caption: "t"}, instagram: {caption: "i"}, facebook: {caption: "f"}, x: {text: "x"}};
const card: StatCard = {name: "African Lion", tier: "A", stats: {dominance: 90, speed: 60, size: 70, intelligence: 60, rarity: 40}};

const lessonSource: VideoSource = {
    type: "lesson",
    format: "lesson",
    slug: "african-lion",
    title: "What the African Lion teaches you: Pride Command",
    description: "",
    url: "https://animaldex.app/animal-powers/african-lion",
    tags: [],
    text: "",
    images: [{index: 1, src: "/api/species-artwork/african-lion", alt: "African Lion", caption: null, width: 1200, height: 900, license: null}],
    species: [{slug: "african-lion", name: "African Lion", image: 1, card}],
    lesson: {
        animal: {slug: "african-lion", name: "African Lion", image: 1},
        power: "Pride Command",
        expression: "Lead by anchoring the group, not outrunning it.",
        lesson: "Authority lasts longer when it protects the circle that gives it power.",
        motto: "Lead the circle.",
        basis: "Lions hunt and raise young within prides.",
        application: ""
    }
};

const shot = (narration: string, overlay = "") => ({narration, overlay, keyframe_prompt: "Extreme close-up of a lion's amber eye, golden rim light.", motion_prompt: "Slow push-in as the lion blinks."});

const lessonReply = {
    title: "What the Lion Knows",
    hook_text: "THE LION DOESN'T CHASE EVERYTHING",
    shots: [
        shot("The lion doesn't chase everything. It rests twenty hours a day."),
        shot("Then it moves with the pride, all at once."),
        shot("Most people chase everything. Pick the one fight.", "PICK THE ONE FIGHT"),
        shot("Protect your circle, and it carries you.", "PROTECT YOUR CIRCLE"),
        {narration: "Every animal has a lesson.", overlay: "LEAD THE CIRCLE", keyframe_prompt: "", motion_prompt: ""}
    ],
    cta_narration: "Send this to someone who needs it.",
    cta_text: "Every animal has a lesson.",
    music_mood: "noir",
    share
};

test("a lesson is five noir shots: four drawn clips, then the opening clip again so it loops", () => {
    const plan = normalizeLessonPlan(lessonReply, lessonSource, {version: 2, intent: "share", ending: "loop"})!;
    assert.equal(plan.format, "lesson");
    assert.equal(plan.theme, "noir_gold");
    assert.equal(plan.musicMood, "noir");
    assert.equal(plan.scenes.length, 5);
    assert.deepEqual(plan.scenes.map((scene) => scene.visual), ["ai_clip", "ai_clip", "ai_clip", "ai_clip", "image"]);
    assert.ok(plan.scenes.slice(0, 4).every((scene) => scene.keyframePrompt?.includes("near-black background")));
    assert.equal(plan.scenes[4].reuseClip, 0);
    // The hook line is on screen as hook_text, not repeated as the first overlay.
    assert.equal(plan.scenes[0].overlay, "");
    assert.equal(plan.scenes[3].overlay, "PROTECT YOUR CIRCLE");
    // A loop has no call-to-action card.
    assert.equal(plan.ending, "loop");
    assert.equal(plan.ctaNarration, "");
    const withCard = normalizeLessonPlan(lessonReply, lessonSource, {version: 2, intent: "share", ending: "cta_card"})!;
    assert.equal(withCard.ctaNarration, "Send this to someone who needs it.");
});

test("a lesson without drawable shots, or short of five, is rejected", () => {
    assert.equal(normalizeLessonPlan({...lessonReply, shots: lessonReply.shots.slice(0, 4)}, lessonSource), null);
    assert.equal(normalizeLessonPlan({...lessonReply, shots: [{...shot("x"), keyframe_prompt: ""}, ...lessonReply.shots.slice(1)]}, lessonSource), null);
});

test("a lesson shows no stat card: it is a quote video", () => {
    const plan = applyStatCards(normalizeLessonPlan(lessonReply, lessonSource)!, lessonSource);
    assert.ok(plan.scenes.every((scene) => !scene.statCard));
});

test("the lesson prompt holds the truth rule and the banned myths", () => {
    assert.match(LESSON_SYSTEM_PROMPT, /THE TRUTH RULE/);
    assert.match(LESSON_SYSTEM_PROMPT, /reborn/);
    assert.match(LESSON_SYSTEM_PROMPT, /sigma/);
});

const guessSource: VideoSource = {
    ...lessonSource,
    type: "guess",
    format: "guess",
    slug: "snow-leopard",
    url: "https://animaldex.app/animals/snow-leopard",
    species: [{slug: "snow-leopard", name: "Snow Leopard", image: 1, card: {...card, name: "Snow Leopard"}}],
    lesson: undefined,
    guess: {animal: {slug: "snow-leopard", name: "Snow Leopard", image: 1}, clues: ["Moves along ridgelines", "Pale grey coat with smoky rosettes", "Central Asian mountains"], facts: ["Its tail is almost as long as its body."], lookalikes: [], lesson: null}
};

const guessReply = {
    title: "Guess the Animal",
    hook_text: "NAME IT BEFORE THE REVEAL",
    shots: [
        shot("Name this animal before the reveal."),
        shot("It hunts along cliff ridges at dawn.", "CLUE 2"),
        {narration: "Its grey coat has smoky rosettes.", overlay: "CLUE 3", keyframe_prompt: "", motion_prompt: ""},
        {narration: "It's the snow leopard.", overlay: "", keyframe_prompt: "", motion_prompt: ""},
        shot("Its tail is almost as long as its body, a scarf for the cold."),
        {narration: "Next one is harder.", overlay: "NEXT ONE IS HARDER", keyframe_prompt: "", motion_prompt: ""}
    ],
    cta_narration: "",
    cta_text: "",
    music_mood: "mystery",
    share
};

test("a guess: puzzle, clues, the reveal with its stat card, the payoff, then the puzzle again", () => {
    const plan = applyStatCards(normalizeGuessPlan(guessReply, guessSource, {version: 2, intent: "comment", ending: "loop"})!, guessSource);
    assert.equal(plan.format, "guess");
    assert.equal(plan.scenes.length, 6);
    assert.equal(plan.scenes.filter((scene) => scene.visual === "ai_clip").length, 3);
    assert.equal(plan.scenes[2].reuseClip, 1);
    assert.equal(plan.scenes[5].reuseClip, 0);
    assert.equal(plan.scenes[3].overlayStyle, "winner");
    assert.equal(plan.scenes[3].overlay, "It's the: Snow Leopard");
    // Only the reveal carries the stat card, so nothing names the animal early.
    assert.deepEqual(plan.scenes.map((scene) => Boolean(scene.statCard)), [false, false, false, true, false, false]);
    assert.equal(plan.musicMood, "mystery");
});

test("a clue that names the animal is rejected", () => {
    const spoiled = {...guessReply, shots: [guessReply.shots[0], shot("This leopard hunts along cliff ridges.", "CLUE 2"), ...guessReply.shots.slice(2)]};
    assert.equal(normalizeGuessPlan(spoiled, guessSource), null);
    assert.match(GUESS_SYSTEM_PROMPT, /never names the animal/);
});

test("noir captions are gold Cinzel, centred, with no lime; house captions are unchanged", () => {
    const plan = normalizeLessonPlan(lessonReply, lessonSource, {version: 2, ending: "loop"})!;
    const timeline = buildTimeline(plan, [3, 2.5, 2.5, 3, 2], 0);
    const noir = buildAss({timeline, spokenSeconds: [3, 2.5, 2.5, 3, 2], endUrl: "ANIMALDEX.APP", theme: "noir_gold"});
    assert.match(noir, /Style: Caption,Cinzel,/);
    assert.match(noir, /Style: Hook,Cinzel,/);
    const events = noir.slice(noir.indexOf("[Events]"));
    assert.ok(!events.includes("&H0032F4A7"), "no lime in anything a noir video draws");
    assert.match(noir, /\\c&H005CB8E3&/);
    const house = buildAss({timeline, spokenSeconds: [3, 2.5, 2.5, 3, 2], endUrl: "ANIMALDEX.APP"});
    assert.match(house, /Style: Caption,Barlow Condensed ExtraBold,/);
    assert.match(NOIR_GRADE, /vignette/);
});

test("lesson and guess videos count as their own formats on the board", () => {
    assert.equal(formatOfPost({mediaKind: "blog_video", videoFormat: "lesson", sourceType: "lesson"}), "lesson");
    assert.equal(formatOfPost({mediaKind: "blog_video", videoFormat: "guess", sourceType: "guess"}), "guess");
});

test("headline animals are picked before the rest of their family", () => {
    const pages = [{slug: "moth", priority: 0}, {slug: "lion", priority: 2}, {slug: "crow", priority: 1}, {slug: "wolf", priority: 2}];
    for (let i = 0; i < 20; i += 1) {
        const pick = pickRandomSource({lesson: pages}, Math.random, ["lesson"]);
        assert.ok(pick && ["lion", "wolf"].includes(pick.page.slug));
    }
    assert.equal(pickRandomSource({blog: [{slug: "a"}]}, () => 0)?.page.slug, "a");
});

test("a birth-month carousel needs all twelve months, in order, each with its animal", async () => {
    const {MONTHS, normalizeCarousel} = await import("./social-content/plan");
    const months = MONTHS.map((month, index) => ({layout: "item", kicker: month, title: `Animal ${index + 1}`, body: "Patient until it pounces.", image: index + 1, stat_label: "", stat_value: ""}));
    const reply = (middle: typeof months) => ({
        template: "birth_month",
        slides: [
            {layout: "cover", kicker: "BIRTH MONTH", title: "YOUR BIRTH MONTH IS YOUR ANIMAL", body: "Swipe to yours", image: 1, stat_label: "", stat_value: ""},
            ...middle,
            {layout: "cta", kicker: "YOUR CALL", title: "Which month are you? Comment it.", body: "Full story on animaldex.app", image: 0, stat_label: "", stat_value: ""}
        ],
        share
    });
    const images = Array.from({length: 12}, (_, index) => index + 1);
    const carousel = normalizeCarousel(reply(months), images, ["birth_month"]);
    assert.equal(carousel?.spec.slides.length, 14);
    assert.equal(normalizeCarousel(reply(months.slice(0, 11)), images, ["birth_month"]), null);
    assert.equal(normalizeCarousel(reply([months[1], months[0], ...months.slice(2)]), images, ["birth_month"]), null);
});
