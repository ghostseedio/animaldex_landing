import assert from "node:assert/strict";
import test from "node:test";
import {BATTLE_NEGATIVE_PROMPT, BATTLE_SYSTEM_PROMPT, normalizeBattlePlan} from "./content-video/formats";
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
        winner: "a"
    }
};

const beat = (move: string, attacker: "a" | "b") => ({
    narration: "The bongo lowers its horns and charges!",
    attacker,
    move,
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
    beats: [beat("HORN CHARGE", "a"), beat("LEAP ATTACK!", "b"), beat("ESCAPE", "b")],
    winner: "b",
    cta_narration: "Team Bongo or Team Indri?",
    cta_text: "Who wins?",
    music_mood: "intense",
    share
};

test("battle shots are each drawn mid-action, carry their fx and Pokémon move callouts", () => {
    const plan = normalizeBattlePlan(model, source);
    assert.ok(plan);
    const fights = plan.scenes.slice(1);
    assert.deepEqual(fights.map((scene) => scene.fx), ["charge", "clash", "finish"]);
    for (const scene of fights) {
        assert.equal(scene.chain, undefined);
        assert.match(scene.keyframePrompt ?? "", /mid-gallop/);
        // Both looks ride in every keyframe, so the animals match from shot to shot.
        assert.match(scene.keyframePrompt ?? "", /spiral horns.*stubby tail/);
        assert.doesNotMatch(scene.motionPrompt, /no blood/i);
    }
    assert.equal(fights[0].move, "Bongo used HORN CHARGE!");
    assert.equal(fights[1].move, "Indri used LEAP ATTACK!");
    // The page's winner beats the model's.
    assert.equal(fights[2].overlay, "WINNER: Bongo");
    assert.equal(plan.hud?.winner, "left");
});

test("a battle without shots or looks is rejected or defaulted, never half-built", () => {
    assert.equal(normalizeBattlePlan({...model, beats: model.beats.slice(0, 2)}, source), null);
    const plan = normalizeBattlePlan({...model, look_a: "", look_b: ""}, source);
    assert.match(plan?.scenes[1].keyframePrompt ?? "", /an adult Bongo/);
});

test("the director asks for action and faces, and keeps the bloodless rules in the negative prompt", () => {
    assert.match(BATTLE_SYSTEM_PROMPT, /ONE big, clear, physical move/);
    assert.match(BATTLE_SYSTEM_PROMPT, /bared teeth/);
    assert.doesNotMatch(BATTLE_SYSTEM_PROMPT, /stare each other down/);
    assert.match(BATTLE_NEGATIVE_PROMPT, /blood, wounds, gore/);
    assert.match(BATTLE_NEGATIVE_PROMPT, /motionless/);
});

test("hits line up across picture, sound and health bars", () => {
    const plan = normalizeBattlePlan(model, source)!;
    const timeline = buildTimeline(plan, [3, 2.5, 2.5, 2.5], 2);
    const clash = timeline[2];
    assert.equal(clash.fx, "clash");
    const hits = battleHitOffsets("clash", clash.duration).map((offset) => Math.round((clash.start + offset) * 100) / 100);
    assert.equal(hits.length, 2);
    const {impacts} = soundEffectsFor(timeline);
    for (const at of hits) assert.ok(impacts.some((impact) => Math.abs(impact - at) < 0.02), `impact at ${at}`);
    const ass = buildAss({timeline, spokenSeconds: [3, 2.5, 2.5, 2.5, 2], endUrl: "ANIMALDEX.APP", hud: plan.hud});
    assert.match(ass, /Style: Move,/);
    assert.match(ass, /BONGO\{\\c&H[0-9A-F]+&\} USED HORN CHARGE!/);
    // Stepped drops with a white flash, not one smooth drain.
    assert.match(ass, /\\fscx76\\1c&HFFFFFF&/);
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
