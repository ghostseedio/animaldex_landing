import assert from "node:assert/strict";
import test from "node:test";
import {applyFootage, type FootageClip, footageFor, planHasAiImagery, scanRevealSpecies} from "./content-video/footage";
import {normalizeScanPlan, SCAN_SYSTEM_PROMPT} from "./content-video/formats";
import type {PlanScene, VideoPlan, VideoSource} from "./content-video/plan";

const clip = (id: string, kind: FootageClip["kind"], species: string | null, seconds = 6): FootageClip => ({id, kind, species, label: species, seconds, path: `footage/${id}.mp4`, poster: `footage/${id}.jpg`, filmed: "2026-05"});

const library: FootageClip[] = [
    clip("animal-komodo-1", "animal", "komodo-dragon", 14),
    clip("animal-komodo-2", "animal", "komodo-dragon", 4),
    clip("scan-tortoise", "scan", "sulcata-tortoise"),
    clip("result-tortoise", "result", "sulcata-tortoise"),
    clip("animal-tortoise", "animal", "sulcata-tortoise"),
    clip("reaction-tortoise", "reaction", "sulcata-tortoise"),
    clip("scan-any", "scan", null),
    clip("result-fox", "result", "red-fox")
];

const aiScene = (extra: Partial<PlanScene> = {}): PlanScene => ({narration: "x", overlay: "", visual: "ai_clip", image: 1, focusX: 0.5, motionPrompt: "move", keyframePrompt: "draw", ...extra});
const share = {youtube: {title: "t", description: "d"}, tiktok: {caption: "t"}, instagram: {caption: "i"}, facebook: {caption: "f"}, x: {text: "x"}};
const plan = (format: VideoPlan["format"], scenes: PlanScene[]): VideoPlan => ({format, title: "t", hookText: "h", scenes, ctaNarration: "", ctaText: "", musicMood: "curious", share});

test("footage is looked up by species and kind; scan reveals need a scan or result shot", () => {
    assert.deepEqual(footageFor("komodo-dragon", ["animal"], library).map((entry) => entry.id), ["animal-komodo-1", "animal-komodo-2"]);
    assert.deepEqual(footageFor(null, ["scan"], library), []);
    const species = scanRevealSpecies(library).map((entry) => entry.species).sort();
    assert.deepEqual(species, ["red-fox", "sulcata-tortoise"]);
});

test("a lesson's drawn shots of a filmed animal become our clips, longest first; no AI clip is ordered for them", () => {
    const source = {lesson: {animal: {slug: "komodo-dragon", name: "Komodo Dragon", image: 1}, power: "", expression: "", lesson: "", motto: "", basis: "", application: ""}} as Pick<VideoSource, "lesson">;
    const lesson = applyFootage(plan("lesson", [aiScene(), aiScene(), aiScene(), aiScene(), aiScene({visual: "image", reuseClip: 0})]), source, library);
    assert.equal(lesson.scenes[0].footage?.id, "animal-komodo-1");
    assert.equal(lesson.scenes[1].footage?.id, "animal-komodo-2");
    assert.equal(lesson.scenes[0].visual, "image");
    assert.equal(lesson.scenes[0].keyframePrompt, undefined);
    // Two clips, four shots: the rest stay AI; the loop shot keeps replaying the first.
    assert.equal(lesson.scenes[2].visual, "ai_clip");
    assert.equal(lesson.scenes[4].reuseClip, 0);
});

test("a guess only gets footage after the reveal; battles keep their AI fight", () => {
    const source = {guess: {animal: {slug: "komodo-dragon", name: "Komodo Dragon", image: 1}, clues: [], facts: [], lookalikes: [], lesson: null}} as Pick<VideoSource, "guess">;
    const guess = applyFootage(plan("guess", [aiScene(), aiScene(), aiScene({visual: "image", reuseClip: 1}), aiScene({visual: "image"}), aiScene(), aiScene({visual: "image", reuseClip: 0})]), source, library);
    assert.deepEqual(guess.scenes.map((scene) => Boolean(scene.footage)), [false, false, false, false, true, false]);
    const battle = plan("battle", [aiScene({species: "komodo-dragon"})]);
    assert.equal(applyFootage(battle, {}, library), battle);
    // A ranking scene about one filmed species plays our clip.
    const ranking = applyFootage(plan("editorial", [aiScene(), aiScene({visual: "image", species: "sulcata-tortoise"})]), {}, library);
    assert.equal(ranking.scenes[1].footage?.id, "animal-tortoise");
    assert.equal(ranking.scenes[0].footage, undefined);
});

test("TikTok's AI label is off only when every shot is our footage or a real photo", () => {
    assert.equal(planHasAiImagery(plan("scan", [aiScene({visual: "image", keyframePrompt: undefined, footage: {id: "a", path: "p", seconds: 3}})])), false);
    assert.equal(planHasAiImagery(plan("scan", [aiScene()])), true);
    assert.equal(planHasAiImagery(plan("battle", [])), true);
    assert.equal(planHasAiImagery(null), true);
});

const scanSource = (clips: Partial<NonNullable<VideoSource["scan"]>["clips"]>): VideoSource => ({
    type: "scan",
    format: "scan",
    slug: "sulcata-tortoise",
    title: "I scanned a Sulcata Tortoise",
    description: "",
    url: "https://animaldex.app/animals/sulcata-tortoise",
    tags: [],
    text: "",
    images: [{index: 1, src: "/x", alt: "", caption: null, width: 1, height: 1, license: null}],
    scan: {animal: {slug: "sulcata-tortoise", name: "Sulcata Tortoise", image: 1}, clips: {scan: [], result: [], animal: [], reaction: [], ...clips}, facts: ["It digs burrows up to 3 m deep."], lesson: "Slow and steady.", power: "Endurance"}
});
const ref = (id: string) => ({id, path: `footage/${id}.mp4`, seconds: 5});
const reply = {
    title: "I scanned this",
    hook_text: "WHAT EVEN IS THIS?",
    shots: [
        {narration: "Found this guy at the zoo. What is it?", overlay: ""},
        {narration: "It's a sulcata tortoise.", overlay: ""},
        {narration: "It digs burrows deeper than you are tall.", overlay: "DIGS 3 M DEEP"},
        {narration: "Go slow, but never stop.", overlay: "NEVER STOP"},
        {narration: "What should I scan next? Comment it.", overlay: ""}
    ],
    cta_narration: "",
    cta_text: "",
    music_mood: "curious",
    share
};

test("a scan reveal plays our clips: scan, result, the animal, then a reaction", () => {
    const made = normalizeScanPlan(reply, scanSource({scan: [ref("s")], result: [ref("r")], animal: [ref("a1"), ref("a2")], reaction: [ref("re")]}))!;
    assert.equal(made.format, "scan");
    assert.deepEqual(made.scenes.map((scene) => scene.footage?.id ?? null), ["s", "r", "a1", "a2", "re"]);
    assert.equal(made.scenes[1].overlay, "It's a: Sulcata Tortoise");
    assert.equal(planHasAiImagery(made), false);
    assert.match(SCAN_SYSTEM_PROMPT, /Never name the animal here/);
});

test("a missing animal shot falls back to an AI clip of the real animal; no scan or result shot means no scan reveal", () => {
    const made = normalizeScanPlan(reply, scanSource({scan: [ref("s")], result: [ref("r")]}))!;
    assert.equal(made.scenes[2].visual, "ai_clip");
    assert.match(made.scenes[2].keyframePrompt ?? "", /Sulcata Tortoise/);
    assert.equal(made.scenes[4].reuseClip, 0);
    assert.equal(planHasAiImagery(made), true);
    assert.equal(normalizeScanPlan(reply, scanSource({animal: [ref("a1")]})), null);
});

test("a scan reveal without a clip of the scan or a reaction opens on the animal, then the result", () => {
    const made = normalizeScanPlan(reply, scanSource({result: [ref("r")], animal: [ref("a1"), ref("a2")]}))!;
    assert.deepEqual(made.scenes.map((scene) => scene.footage?.id ?? null).slice(0, 3), ["a1", "r", "a2"]);
});
