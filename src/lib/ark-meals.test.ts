/**
 * Realistic kills (lane ark-kills-real, 2026-11-15): the meal after the catch (`meals.ts` rules, `meal-acts.ts`
 * script), its traces and the scavengers that come.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {mealStage, type ActBody} from "@/ark-scene/acts";
import {heightAt} from "@/ark-scene/world";
import {mealOnStage, mealScript, predatorAt, preyAt, scavengeVisit, scavengerAt, type MealCatch} from "@/ark-scene/meal-acts";
import {ARK_TIME_SCALE, bodyMassKg, feedBeatAt, feedBouts, isScavenger, mealPlan, pickScavengers, scavengeSeconds, swallowsWhole, traceOf, type MealSide, type ScavengerCandidate} from "@/ark-scene/meals";

const side = (slug: string, plan: string, length: number, extra: Partial<MealSide> = {}): MealSide => ({slug, plan, length, massKg: bodyMassKg({slug, plan, flies: extra.flies}, length), ...extra});

const LION = side("african-lion", "mammal", 2.5, {diet: "meat"});
const DEER = side("red-deer", "mammal", 2.0, {diet: "grazer"});
const HERON = side("grey-heron", "bird", 0.95, {flies: true, diet: "fish"});
const TROUT = side("rainbow-trout", "fish", 0.5, {water: true});
const HAWK = side("red-tailed-hawk", "bird", 0.55, {flies: true, diet: "meat"});
const MOUSE = side("house-mouse", "mammal", 0.09);
const RABBIT = side("european-rabbit", "mammal", 0.42);
const PYTHON = side("reticulated-python", "snake", 5);
const RAT = side("brown-rat", "mammal", 0.25);
const FROG = side("common-frog", "frog", 0.08);

test("the Ark's clock compresses nature's time by about 26", () => {
    assert.ok(Math.abs(ARK_TIME_SCALE - 365 / 14) < 1e-9, `${ARK_TIME_SCALE}`);
});

test("body mass from length and build: a lion, a deer, a hawk, a heron, a mouse", () => {
    assert.ok(LION.massKg > 150 && LION.massKg < 280, `lion ${LION.massKg}`);
    assert.ok(DEER.massKg > 70 && DEER.massKg < 160, `deer ${DEER.massKg}`);
    assert.ok(HAWK.massKg > 0.3 && HAWK.massKg < 1.5, `hawk ${HAWK.massKg}`);
    assert.ok(HERON.massKg > 1 && HERON.massKg < 6, `heron ${HERON.massKg}`);
    assert.ok(MOUSE.massKg > 0.005 && MOUSE.massKg < 0.05, `mouse ${MOUSE.massKg}`);
});

test("swallowed whole or fed on, by body plan and size", () => {
    assert.equal(swallowsWhole(HERON, TROUT), true, "a heron swallows a fish");
    assert.equal(swallowsWhole(PYTHON, RAT), true, "a snake swallows whole");
    assert.equal(swallowsWhole(HAWK, MOUSE), true, "a hawk gulps a mouse");
    assert.equal(swallowsWhole(HAWK, RABBIT), false, "a hawk feeds on a rabbit");
    assert.equal(swallowsWhole(LION, DEER), false, "a lion feeds on a deer");
    assert.equal(swallowsWhole(side("red-fox", "mammal", 0.7), MOUSE), true, "a fox gulps a mouse");
});

test("meal durations: a heron's fish in seconds, a big cat's deer in minutes, a snake slowly", () => {
    const heron = mealPlan(HERON, TROUT, "h");
    const lion = mealPlan(LION, DEER, "l");
    const hawk = mealPlan(HAWK, RABBIT, "k");
    const snake = mealPlan(PYTHON, RAT, "s");
    const frog = mealPlan(side("common-toad", "frog", 0.1), side("house-fly", "arthropod", 0.01), "f");
    assert.equal(heron.style, "swallow");
    assert.ok(heron.feedSeconds >= 4 && heron.feedSeconds <= 6, `heron ${heron.feedSeconds}`);
    assert.ok(heron.naturalMinutes < 2, `heron natural ${heron.naturalMinutes}`);
    assert.equal(lion.style, "feed");
    assert.ok(lion.naturalMinutes > 40 && lion.naturalMinutes < 90, `lion natural ${lion.naturalMinutes}`);
    assert.ok(lion.feedSeconds > 90 && lion.feedSeconds < 220, `lion ${lion.feedSeconds} s on the Ark's clock`);
    assert.ok(Math.abs(lion.feedSeconds - (lion.naturalMinutes * 60) / ARK_TIME_SCALE) < 1e-6, "the Ark's clock, not clamped");
    assert.ok(hawk.naturalMinutes > 5 && hawk.naturalMinutes < 30, `hawk natural ${hawk.naturalMinutes}`);
    assert.ok(hawk.feedSeconds >= 20 && hawk.feedSeconds < lion.feedSeconds, `hawk ${hawk.feedSeconds}`);
    assert.equal(snake.style, "swallow");
    assert.ok(snake.naturalMinutes > 4 && snake.naturalMinutes < 20, `python natural ${snake.naturalMinutes}`);
    assert.ok(snake.feedSeconds > heron.feedSeconds && snake.feedSeconds < 60, `python ${snake.feedSeconds}`);
    assert.ok(frog.feedSeconds === 4, `a toad's fly ${frog.feedSeconds}`);
    // The bigger the share of itself it eats, the longer it rests; a mouthful, no rest.
    assert.ok(lion.restSeconds > hawk.restSeconds || hawk.restSeconds === 360, `${lion.restSeconds} ${hawk.restSeconds}`);
    assert.equal(mealPlan(side("red-fox", "mammal", 0.7), side("field-vole", "mammal", 0.06), "v").restSeconds, 0);
    assert.ok(lion.restSeconds <= 360 && lion.restSeconds > 120, `lion rest ${lion.restSeconds}`);
    // A drink after a big feed (not for a bird or a snake).
    assert.equal(lion.drinkSeconds, 12);
    assert.equal(heron.drinkSeconds, 0);
    assert.equal(snake.drinkSeconds, 0);
    // Deterministic.
    assert.deepEqual(mealPlan(LION, DEER, "l"), lion);
});

test("traces by rule: feathers, fur, scales or nothing; flattened ground under a big feed; fading by size", () => {
    const pigeon = side("rock-dove", "bird", 0.32, {flies: true});
    assert.equal(traceOf(HAWK, pigeon, "feed").kind, "feathers");
    assert.equal(traceOf(LION, DEER, "feed").kind, "fur");
    assert.equal(traceOf(LION, DEER, "feed").flattened, true);
    assert.equal(traceOf(HERON, TROUT, "swallow").kind, "none", "a fish taken in the water leaves nothing");
    assert.equal(traceOf(HERON, TROUT, "swallow").seconds, 0);
    assert.equal(traceOf(side("monitor", "reptile", 1.5), side("skink", "reptile", 0.3), "feed").kind, "scales");
    assert.equal(traceOf(PYTHON, FROG, "swallow").kind, "none");
    assert.equal(traceOf(HAWK, RABBIT, "feed").flattened, false, "a rabbit is too small to flatten the grass");
    const deer = traceOf(LION, DEER, "feed").seconds;
    const rabbit = traceOf(HAWK, RABBIT, "feed").seconds;
    assert.ok(deer > rabbit && deer <= (36 * 3600) / ARK_TIME_SCALE + 1e-6, `${deer} ${rabbit}`);
});

test("feeding bouts: head down 3-8 s, glances up 1-2.5 s, seeded and covering the feed", () => {
    const bouts = feedBouts("seed", 120);
    assert.deepEqual(bouts, feedBouts("seed", 120));
    assert.equal(bouts[0].from, 0);
    assert.ok(Math.abs(bouts[bouts.length - 1].to - 120) < 1e-9);
    for (let i = 0; i < bouts.length; i++) {
        const b = bouts[i];
        if (i + 1 < bouts.length) assert.ok(Math.abs(bouts[i + 1].from - b.to) < 1e-9, "no gaps");
        if (b.to === 120) continue;
        if (b.up) assert.ok(b.to - b.from >= 1 && b.to - b.from <= 2.5);
        else assert.ok(b.to - b.from >= 3 && b.to - b.from <= 8);
    }
    assert.ok(bouts.some((b) => b.up), "it looks up");
    assert.equal(feedBeatAt(bouts, 1).state, "eat");
    const up = bouts.find((b) => b.up)!;
    assert.equal(feedBeatAt(bouts, (up.from + up.to) / 2).state, "scan");
});

const body = (x: number, z: number, length: number, height: number, speedStat = 60): ActBody => ({x, z, base: 0, yaw: 0, length, height, speedStat});
const flat: Pick<MealCatch, "ground" | "clear" | "water" | "walk"> = {ground: (x, z) => Math.max(heightAt(x, z), -0.3), clear: () => true, water: null, walk: 1.2};

test("a big cat on a deer: the deer lies on its side where it fell, the cat feeds with glances up, drinks, rests nearby", () => {
    const stage = mealStage("glide", body(-14, 0, 2.5, 1.1, 70), body(0, 0, 2, 1.3, 64), {seed: "lion", meal: true});
    const at = stage.catchAt!;
    assert.ok(stage.seconds - at < 0.1, "the chase ends at the catch");
    const plan = mealPlan(LION, DEER, "lion");
    const p = stage.predator(at)!;
    const q = stage.prey(at);
    const script = mealScript(plan, {kind: "glide", predator: {...p, length: 2.5, height: 1.1}, prey: {...q, length: 2, height: 1.3}, preyInWater: false, predatorSwims: false, ...flat, water: {x: q.x + 12, z: q.z}});
    const end = script.leaves;
    // The deer: on its side from just after the catch, never fading until the carcass is left.
    const lying = preyAt(script, 1.5, q, end);
    assert.ok(Math.abs(lying.lying ?? 0) > 0.95 && !lying.hidden && lying.dim === 0 && lying.scale === 1);
    assert.ok(Math.hypot(lying.x - q.x, lying.z - q.z) < 1e-6, "where it fell");
    assert.ok(!preyAt(script, end - 1, q, end).hidden && preyAt(script, end + 3, q, end).hidden, "fades only after the meal");
    // The cat: feeding (eat), glancing up (scan) now and then, over the deer.
    const states = new Set<string>();
    for (let u = 0; u < plan.feedSeconds; u += 0.5) {
        const pose = predatorAt(script, u);
        states.add(pose.state!);
        assert.equal(pose.doing, "eating");
        assert.ok(Math.hypot(pose.x - p.x, pose.z - p.z) < 1e-6, "stays over it");
    }
    assert.deepEqual(Array.from(states).sort(), ["rest"], "a big cat feeds lying prone (its rig's lying pose), glancing up as it lies");
    const wolf = mealScript(mealPlan(side("eurasian-wolf", "mammal", 1.3), DEER, "w"), {...script.c});
    const wolfStates = new Set<string>();
    for (let u = 0; u < wolf.plan.feedSeconds; u += 0.5) wolfStates.add(predatorAt(wolf, u).state!);
    assert.deepEqual(Array.from(wolfStates).sort(), ["eat", "scan"], "a wolf stands and tears, glancing up");
    // Then a drink at the water, then a rest a few lengths off.
    assert.ok(script.drink, "water 12 m off: it drinks");
    assert.equal(predatorAt(script, script.drink!.from + 1).doing, "drinking");
    // (Owner, 2026-11-16: "drinking" only at the water. On its walk there it is heading to water.)
    if (script.drink!.from - script.drink!.walkFrom > 0.5) {
        const walking = predatorAt(script, (script.drink!.walkFrom + script.drink!.from) / 2);
        assert.equal(walking.doing, "toWater");
        assert.ok(Math.hypot(walking.x - script.drink!.at.x, walking.z - script.drink!.at.z) > 0.1, "still on its way");
    }
    for (let u = script.feedTo; u < script.drink!.to; u += 0.25) {
        const p = predatorAt(script, u);
        if (p.doing === "drinking") assert.ok(Math.hypot(p.x - script.drink!.at.x, p.z - script.drink!.at.z) < 1e-6, `drinking at the water's edge only (${u})`);
    }
    const resting = predatorAt(script, script.rest.from + 5);
    assert.equal(resting.doing, "resting");
    assert.equal(resting.state, "rest");
    // On one stage: the chase says hunting, the meal eating.
    const both = mealOnStage(stage, script, 10, end);
    assert.equal(both.predator(at * 0.5)!.meal, "hunting");
    assert.equal(both.predator(at + 2)!.meal, "eating");
    assert.ok(Math.abs(both.seconds - (at + 10)) < 1e-9);
});

test("a heron swallows a fish whole in seconds; a python takes a rat slowly, head first", () => {
    const heron = mealPlan(HERON, TROUT, "heron");
    const s = mealScript(heron, {kind: "swoop", predator: {x: 0, z: 0, base: 0.4, yaw: 0, length: 0.95, height: 0.9}, prey: {x: 0.4, z: 0.2, base: -0.1, yaw: 1, length: 0.5, height: 0.12}, preyInWater: true, predatorSwims: false, ground: (x) => (x > 3 ? 0.2 : -0.5), clear: (x) => x > 3, water: null, walk: 0.6});
    assert.ok(s.carry > 0, "carried out of the water");
    assert.ok(s.feed.x > 3, "onto dry ground");
    const q0 = {x: 0.4, z: 0.2, base: -0.1, yaw: 1, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false};
    const gone = preyAt(s, s.feedTo + 0.1, q0, s.leaves);
    assert.ok(gone.hidden, "swallowed");
    const mid = preyAt(s, s.feedFrom + heron.feedSeconds * 0.6, q0, s.leaves);
    assert.ok(mid.scale < 0.8 && !mid.hidden, "going down");
    const py = mealPlan(PYTHON, RAT, "python");
    const sp = mealScript(py, {kind: "slither", predator: {x: 0, z: 0, base: 0, yaw: 0, length: 5, height: 0.25}, prey: {x: 0, z: 2.6, base: 0, yaw: 0, length: 0.25, height: 0.1}, preyInWater: false, predatorSwims: false, ...flat});
    const scales = [0.05, 0.4, 0.8].map((k) => preyAt(sp, sp.feedFrom + py.feedSeconds * k, q0, sp.leaves).scale);
    assert.ok(scales[0] > scales[1] && scales[1] > scales[2], `${scales}`);
});

test("scavengers: carrion eaters near and awake come, the predator's own prey keep clear; seeded", () => {
    assert.ok(isScavenger({slug: "white-backed-vulture", plan: "bird", diet: "carrion", length: 0.9}));
    assert.ok(isScavenger({slug: "golden-jackal", plan: "mammal", diet: "meat", length: 0.8}));
    assert.ok(isScavenger({slug: "common-raven", plan: "bird", diet: "carrion", length: 0.6}));
    assert.ok(!isScavenger({slug: "house-fly", plan: "arthropod", diet: "carrion", length: 0.01}), "too small to see at it");
    assert.ok(!isScavenger({slug: "pacific-hagfish", plan: "fish", diet: "carrion", length: 0.5}), "not at a kill on land");
    assert.ok(!isScavenger({slug: "impala", plan: "mammal", diet: "grazer", length: 1.3}));
    const c = (id: string, slug: string, diet: string, x: number, flies = false, awake = true, plan = flies ? "bird" : "mammal"): ScavengerCandidate => ({id, slug, plan, diet, length: 0.8, flies, x, z: 0, awake});
    const list = [
        c("j1", "golden-jackal", "meat", 20),
        c("v1", "white-backed-vulture", "carrion", 70, true),
        c("v2", "hooded-vulture", "carrion", 120, true),
        c("r1", "common-raven", "carrion", 30, true, false),
        c("i1", "impala", "grazer", 5),
        c("h1", "spotted-hyena", "meat", 10)
    ];
    const picked = pickScavengers(list, {x: 0, z: 0}, {seed: "m", count: 2, predatorId: "lion", preyId: "deer", eatenBy: (slug) => slug === "golden-jackal"});
    // The vulture (carrion first), then the hyena (nearest); the jackal keeps clear of the lion, the raven is asleep,
    // the far vulture is out of reach, the impala is no scavenger.
    assert.deepEqual(picked.map((p) => p.id), ["v1", "h1"]);
    assert.ok(picked[0].delay < picked[1].delay);
    assert.deepEqual(pickScavengers(list, {x: 0, z: 0}, {seed: "m", count: 2, predatorId: "lion", preyId: "deer", eatenBy: (slug) => slug === "golden-jackal"}), picked);
    assert.deepEqual(pickScavengers(list, {x: 0, z: 0}, {seed: "m", count: 0, predatorId: "lion", preyId: "deer"}), []);
    // How many come: nothing for a mouthful, one for a rabbit, two for a deer; none to a fish taken in the water.
    assert.equal(mealPlan(LION, DEER, "x").scavengers, 2);
    assert.equal(mealPlan(HAWK, side("brown-hare", "mammal", 0.6), "x").scavengers, 1);
    assert.equal(mealPlan(HAWK, MOUSE, "x").scavengers, 0);
    assert.equal(mealPlan(HERON, TROUT, "x").scavengers, 0);
    // A visit: on its way, then feeding at the carcass's edge, facing it.
    const feed = scavengeSeconds("m", "v1");
    assert.ok(feed >= 20 && feed <= 50);
    const visit = scavengeVisit({id: "v1", seed: "m", flies: true, length: 0.9, height: 0.8, walk: 0.8, from: {x: 70, z: 0, base: 0, yaw: 0}, carcass: {x: 0, z: 0, base: 0}, carcassLength: 2, start: 100, feedSeconds: feed, ground: () => 0});
    const flying = scavengerAt(visit, (visit.start + visit.arrive) / 2);
    assert.ok(flying.base > 2 && (flying.state === "fly" || flying.state === "glide"), "flies in");
    const eating = scavengerAt(visit, visit.arrive + 1);
    assert.ok(Math.hypot(eating.x, eating.z) < 2 && eating.base === 0 && eating.state === "eat");
});

test("postures by kind: big cats lie prone to feed and lie up after; dogs stand and tear; crocs and monitors bask", async () => {
    const {mealPosture} = await import("@/ark-scene/meals");
    for (const slug of ["african-lion", "bengal-tiger", "snow-leopard", "cheetah", "jaguar", "eurasian-lynx"]) assert.deepEqual(mealPosture({slug, plan: "mammal"}), {feed: "prone", rest: "lie"}, slug);
    for (const slug of ["eurasian-wolf", "golden-jackal", "african-wild-dog", "spotted-hyena", "brown-bear", "red-fox"]) assert.deepEqual(mealPosture({slug, plan: "mammal"}), {feed: "stand", rest: "lie"}, slug);
    assert.deepEqual(mealPosture({slug: "california-sea-lion", plan: "mammal"}), {feed: "stand", rest: "lie"}, "a sea lion is no cat");
    assert.deepEqual(mealPosture({slug: "komodo-dragon", plan: "reptile"}), {feed: "stand", rest: "bask"});
    assert.deepEqual(mealPosture({slug: "american-alligator", plan: "reptile"}), {feed: "stand", rest: "bask"});
    assert.deepEqual(mealPosture({slug: "red-tailed-hawk", plan: "bird", flies: true}), {feed: "stand", rest: "stand"}, "a raptor mantles standing");
    const lion = mealPlan(LION, DEER, "p");
    const s = mealScript(lion, {kind: "glide", predator: {x: 0, z: 0, base: 0, yaw: 0, length: 2.5, height: 1.1}, prey: {x: 0, z: 1.6, base: 0, yaw: 0, length: 2, height: 1.3}, preyInWater: false, predatorSwims: false, ground: () => 0, clear: () => true, water: null, walk: 1});
    assert.equal(predatorAt(s, 5).state, "rest", "prone over its prey (its rig's lying pose)");
    assert.equal(predatorAt(s, 5).doing, "eating");
    assert.equal(predatorAt(s, s.rest.from + 2).state, "rest");
    const komodo = mealPlan(side("komodo-dragon", "reptile", 2.5), DEER, "k");
    const sk = mealScript(komodo, {...s.c});
    assert.equal(predatorAt(sk, sk.rest.from + 2).state, "bask");
});

test("a snake's prey stays in view at the jaw for the first third of the swallow, at full size", () => {
    const py = mealPlan(PYTHON, RAT, "jaw");
    const sp = mealScript(py, {kind: "slither", predator: {x: 0, z: 0, base: 0, yaw: 0, length: 5, height: 0.25}, prey: {x: 0, z: 2.6, base: 0, yaw: 0, length: 0.25, height: 0.1}, preyInWater: false, predatorSwims: false, ground: () => 0, clear: () => true, water: null, walk: 0.5, mouth: {forward: 1.2, side: 0.3, up: 0.1}});
    const q0 = {x: 0, z: 2.6, base: 0, yaw: 0, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false};
    const held = preyAt(sp, sp.feedFrom + py.feedSeconds * 0.3, q0, sp.leaves);
    assert.equal(held.scale, 1);
    assert.ok(!held.hidden);
    // At the jaw: the snake's head (its mouth, as the model says) brought up to where the prey was struck, the prey just
    // in front of it, held up off the ground (a small catch flat on its side is lost in the grass).
    const head = predatorAt(sp, sp.feedFrom + 1);
    const mouth = {x: head.x + Math.sin(head.yaw) * 1.2 + Math.cos(head.yaw) * 0.3, z: head.z + Math.cos(head.yaw) * 1.2 - Math.sin(head.yaw) * 0.3};
    assert.ok(Math.hypot(held.x - mouth.x, held.z - mouth.z) < 0.15, `${held.x} ${held.z} by ${mouth.x} ${mouth.z}`);
    assert.ok(held.base > 0 && !held.lying);
});
