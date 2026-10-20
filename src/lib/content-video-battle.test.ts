import assert from "node:assert/strict";
import test from "node:test";
import {BATTLE_NEGATIVE_PROMPT, BATTLE_SYSTEM_PROMPT, buildBattleUserPrompt, normalizeBattlePlan} from "./content-video/formats";
import {battleHitOffsets, buildAss, buildTimeline, type VideoSource} from "./content-video/plan";
import {battleFxFilters, soundEffectsFor} from "./content-video/render";

const share = {youtube: {title: "Bongo vs Indri", description: "d"}, tiktok: {caption: "t"}, instagram: {caption: "i"}, facebook: {caption: "f"}, x: {text: "x"}};

const source: VideoSource = {
    type: "comparison",
    format: "battle",
    slug: "bongo-vs-indri",
    title: "Bongo vs Indri",
    description: "",
    url: "https://animaldex.app/comparisons/bongo-vs-indri",
    tags: [],
    text: "",
    images: [],
    battle: {
        a: {name: "Bongo", slug: "bongo", image: 1},
        b: {name: "Indri", slug: "indri", image: 2},
        stats: [{label: "Weight", a: "300 kg", b: "7 kg", advantage: "a"}, {label: "Speed", a: "50 km/h", b: "20 km/h", advantage: "a"}],
        scenarios: [],
        verdict: "The bongo wins on the ground.",
        winner: "a",
        powers: {a: {name: "Broken Outline", basis: "Bold white stripes break up the bongo's outline in forest light."}, b: null}
    }
};

const beat = (power: string, attacker: "a" | "b") => ({
    narration: "The bongo lowers its horns and charges!",
    attacker,
    power,
    shot: "Low tracking shot, the bongo mid-gallop, dust exploding, the indri leaping sideways, eyes wide.",
    motion_prompt: "Fast tracking shot: the bongo charges headlong and the indri springs away, ears flat."
});

const model = {
    title: "Bongo vs Indri: Who Actually Wins?",
    hook_text: "50X HEAVIER",
    intro_narration: "This lemur is outweighed fifty to one.",
    stats: [],
    arena: "a misty rainforest arena at dusk",
    look_a: "a large chestnut antelope with white stripes and spiral horns",
    look_b: "a black-and-white lemur with a stubby tail",
    beats: [beat("HORN CHARGE", "a"), beat("LEAP ATTACK!", "b"), beat("BODY SLAM", "a"), beat("BROKEN OUTLINE", "a"), beat("HORN CHARGE", "b")],
    winner: "b",
    cta_narration: "Team Bongo or Team Indri?",
    cta_text: "Who wins?",
    music_mood: "intense",
    share
};

test("battles are five power shots, each drawn mid-action with its fx, attacker and move callout", () => {
    const plan = normalizeBattlePlan(model, source);
    assert.ok(plan);
    const fights = plan.scenes.slice(1);
    assert.deepEqual(fights.map((scene) => scene.fx), ["charge", "clash", "clash", "clash", "finish"]);
    assert.deepEqual(fights.map((scene) => scene.attacker), ["left", "right", "left", "left", "left"]);
    assert.deepEqual(plan.hud?.fightScenes, [1, 2, 3, 4, 5]);
    for (const scene of fights) {
        assert.equal(scene.chain, undefined);
        assert.match(scene.keyframePrompt ?? "", /mid-gallop/);
        // Both looks ride in every keyframe, so the animals match from shot to shot.
        assert.match(scene.keyframePrompt ?? "", /spiral horns.*stubby tail/);
        assert.doesNotMatch(scene.motionPrompt, /no blood/i);
    }
    assert.equal(fights[0].move, "Bongo used HORN CHARGE!");
    assert.equal(fights[1].move, "Indri used LEAP ATTACK!");
    assert.equal(fights[3].move, "Bongo used BROKEN OUTLINE!");
    // The page's winner beats the model's, and the finish is always the winner's move.
    assert.equal(fights[4].overlay, "WINNER: Bongo");
    assert.equal(fights[4].move, "Bongo used HORN CHARGE!");
    assert.equal(plan.hud?.winner, "left");
});

test("a battle without shots or looks is rejected or defaulted, never half-built", () => {
    assert.equal(normalizeBattlePlan({...model, beats: model.beats.slice(0, 4)}, source), null);
    const plan = normalizeBattlePlan({...model, look_a: "", look_b: ""}, source);
    assert.match(plan?.scenes[1].keyframePrompt ?? "", /an adult Bongo/);
});

test("the director asks for action and faces, and keeps the bloodless rules in the negative prompt", () => {
    assert.match(BATTLE_SYSTEM_PROMPT, /ONE big, clear, physical move/);
    assert.match(BATTLE_SYSTEM_PROMPT, /THE STORY IS THE POWERS/);
    assert.match(BATTLE_SYSTEM_PROMPT, /exactly 5 shots/);
    assert.match(BATTLE_SYSTEM_PROMPT, /bared teeth/);
    assert.doesNotMatch(BATTLE_SYSTEM_PROMPT, /stare each other down/);
    assert.match(BATTLE_NEGATIVE_PROMPT, /blood, wounds, gore/);
    assert.match(BATTLE_NEGATIVE_PROMPT, /motionless/);
});

test("the director gets each fighter's AnimalDex Power, or is told to pick from biology", () => {
    const prompt = buildBattleUserPrompt(source);
    assert.match(prompt, /ANIMALDEX POWER of the Bongo \(animal A\): "Broken Outline"\. Bold white stripes/);
    assert.match(prompt, /The Indri has no AnimalDex Power/);
});

test("hits line up across picture, sound and health bars", () => {
    const plan = normalizeBattlePlan(model, source)!;
    const timeline = buildTimeline(plan, [3, 2.5, 2.5, 2.5, 2.5, 2.5], 2);
    const clash = timeline[2];
    assert.equal(clash.fx, "clash");
    const hits = battleHitOffsets("clash", clash.duration).map((offset) => Math.round((clash.start + offset) * 100) / 100);
    assert.equal(hits.length, 2);
    const {impacts} = soundEffectsFor(timeline);
    for (const at of hits) assert.ok(impacts.some((impact) => Math.abs(impact - at) < 0.02), `impact at ${at}`);
    const ass = buildAss({timeline, spokenSeconds: [3, 2.5, 2.5, 2.5, 2.5, 2.5, 2], endUrl: "ANIMALDEX.APP", hud: plan.hud});
    assert.match(ass, /Style: Move,/);
    assert.match(ass, /BONGO\{\\c&H[0-9A-F]+&\} USED HORN CHARGE!/);
    const bars = ass.split("\n").filter((line) => line.includes("HudBar") && line.includes("\\1c&HFFFFFF&"));
    const [left, right] = bars;
    // The indri's counter (2 hits) dents the winning bongo's bar, which never drops below ~40%...
    assert.equal(left.match(/\\1c&HFFFFFF&/g)?.length, 2);
    assert.match(left, /\\fscx86\\1c&HFFFFFF&.*\\fscx72\\1c&HFFFFFF&/);
    assert.doesNotMatch(left, /\\fscx0\\1c/);
    // ...while the indri takes the other 5 hits, worn down to ~18%, then knocked out (red).
    assert.equal(right.match(/\\1c&HFFFFFF&/g)?.length, 5);
    assert.match(right, /\\fscx18\\1c&HFFFFFF&/);
    assert.match(right, /\\fscx0\\1c&H/);
});

test("the fight edit punches in, shakes and flashes on each hit", () => {
    const clash = battleFxFilters("clash", 5);
    assert.match(clash[0], /^zoompan=z='1\.06\+0\.24\*max\(0,1-abs\(on-4\)\/7\)/);
    assert.match(clash[0], /sin\(on\*2\.3\)/);
    assert.equal(clash.filter((filter) => filter.startsWith("drawbox")).length, 4);
    const charge = battleFxFilters("charge", 5);
    assert.equal(charge.length, 1);
    assert.match(charge[0], /\(on\/150-0\.5\)\*70/);
});
