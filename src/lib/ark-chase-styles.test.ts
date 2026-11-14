/**
 * A meal's chase by the hunter's kind (behaviours pass 2026-11, lane B1; docs/ark/behaviour-pass-2026-11/hunt.md):
 * who stoops and who takes prey on foot, a courser's long chase against a cat's rush, a striker that does not run, a
 * pounce's arc, how long it is seen eating, what a raptor carries off. `src/ark-scene/acts.ts`, `hunting.ts`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {BIRD_PREY_MOST, SWOOP_CARRY_MOST, SWOOP_PREY_MOST, chaseKind, eatSeconds, mealStage, type ActBody, type ChaseStyle, type MealStage} from "@/ark-scene/acts";
import {chaseStyleOf, swoopsOnPrey} from "@/ark-scene/hunting";
import {heightAt} from "@/ark-scene/world";

const body = (x: number, length: number, speedStat: number, base = 0): ActBody => ({x, z: 0, base, yaw: 0, length, height: length * 0.5, speedStat});

/** What a chase's hunter does: seconds stalking, running; metres stalked and run; its highest point; seconds eating; how far the prey ran. */
function measure(stage: MealStage) {
    const out = {stalk: 0, stalkM: 0, run: 0, runM: 0, eat: 0, high: -Infinity, preyM: 0, stalkTop: 0};
    const dt = 1 / 60;
    let a = stage.predator(0)!;
    let b = stage.prey(0);
    for (let t = dt; t <= stage.seconds + 1e-9; t += dt) {
        const p = stage.predator(t)!;
        const q = stage.prey(t);
        const d = Math.hypot(p.x - a.x, p.z - a.z);
        if (p.state === "stalk" || p.state === "freeze") {
            out.stalk += dt;
            out.stalkM += d;
            out.stalkTop = Math.max(out.stalkTop, d / dt);
        } else if (p.state === "eat") out.eat += dt;
        else if (t <= stage.catchAt!) {
            out.run += dt;
            out.runM += d;
        }
        // (Its feet over the ground there.)
        out.high = Math.max(out.high, p.base - Math.max(heightAt(p.x, p.z), -0.3));
        out.preyM += Math.hypot(q.x - b.x, q.z - b.z);
        a = p;
        b = q;
    }
    return out;
}

test("who stoops: only a bird that hunts from the air, and none on prey far bigger than itself", () => {
    const land = {predatorWater: false, preyWater: false};
    // As before with no rule given: any flying bird stoops.
    assert.equal(chaseKind({predatorSlug: "great-egret", predatorPlan: "bird", predatorFlies: true, ...land}), "swoop");
    // A raptor on a vole stoops; on an animal well over its own length the scene cuts away (the meal is the server's).
    assert.equal(chaseKind({predatorSlug: "common-buzzard", predatorPlan: "bird", predatorFlies: true, swoops: true, ratio: 0.3, ...land}), "swoop");
    assert.equal(chaseKind({predatorSlug: "common-buzzard", predatorPlan: "bird", predatorFlies: true, swoops: true, ratio: SWOOP_PREY_MOST + 0.1, ...land}), "cutaway");
    // A heron, a thrush, a hen take prey on foot; a duck on the water, or prey bigger than the bird, is a cut-away.
    assert.equal(chaseKind({predatorSlug: "great-egret", predatorPlan: "bird", predatorFlies: true, swoops: false, ratio: 0.2, ...land}), "glide");
    assert.equal(chaseKind({predatorSlug: "mallard", predatorPlan: "bird", predatorFlies: true, swoops: false, ratio: 0.2, predatorWater: true, preyWater: true}), "cutaway");
    assert.equal(chaseKind({predatorSlug: "european-robin", predatorPlan: "bird", predatorFlies: true, swoops: false, ratio: BIRD_PREY_MOST + 0.1, ...land}), "cutaway");
    // A penguin and the land hunters are as they were.
    assert.equal(chaseKind({predatorSlug: "king-penguin", predatorPlan: "bird", predatorFlies: false, swoops: false, predatorWater: true, preyWater: true}), "cutaway");
    assert.equal(chaseKind({predatorSlug: "african-lion", predatorPlan: "mammal", predatorFlies: false, ...land}), "glide");
    // The rule (`hunting.ts`): raptors and kingfishers from the air, a kingfisher low from its perch; herons, robins, ducks not.
    for (const [slug, swoops] of [["common-buzzard", true], ["osprey", true], ["red-tailed-hawk", true], ["common-kingfisher", true], ["great-egret", false], ["great-blue-heron", false], ["european-robin", false], ["greylag-goose", false], ["great-cormorant", false], ["great-crested-grebe", false]] as const) {
        assert.equal(swoopsOnPrey(slug, 0.5).swoops, swoops, slug);
    }
    assert.ok(swoopsOnPrey("common-kingfisher", 0.17).low && !swoopsOnPrey("osprey", 0.55).low);
});

test("how each kind takes prey: a wolf courses, a fox pounces, a crocodile, a python, a frog and a heron strike, a big cat rushes", () => {
    const styles: Array<[string, boolean, ChaseStyle]> = [
        ["eurasian-wolf", false, "course"],
        ["spotted-hyena", false, "course"],
        ["african-lion", false, "rush"],
        ["sumatran-tiger", false, "rush"],
        ["pine-marten", true, "pounce"],
        ["saltwater-crocodile", false, "strike"],
        ["reticulated-python", false, "strike"],
        ["american-bullfrog", false, "strike"],
        ["veiled-chameleon", false, "strike"],
        ["great-egret", false, "strike"]
    ];
    for (const [slug, pounces, style] of styles) assert.equal(chaseStyleOf(slug, pounces), style, slug);
});

test("a chase by style: the courser's is long, the striker never runs, the pounce goes up, the stalk is no run, a big meal is eaten longer", () => {
    const hunter = body(0, 1.4, 63);
    const deer = body(24, 1.3, 70);
    const rush = measure(mealStage("glide", hunter, deer, {seed: "rush", flee: "run", exact: true, style: "rush"}));
    const course = measure(mealStage("glide", hunter, deer, {seed: "rush", flee: "run", exact: true, style: "course"}));
    assert.ok(course.runM > rush.runM * 1.5 && course.run > rush.run + 1, `a courser runs its prey down over ${course.runM.toFixed(0)} m in ${course.run.toFixed(1)} s; a rusher's sprint is ${rush.runM.toFixed(0)} m in ${rush.run.toFixed(1)} s`);
    assert.ok(course.preyM > rush.preyM * 1.5, `the coursed prey runs further (${course.preyM.toFixed(0)} against ${rush.preyM.toFixed(0)} m)`);
    assert.ok(course.run < 12, "and it still ends in good time for the replay");
    // The stalk in from a far waypoint is never a run: at most a slinking trot, 35% of its sprint.
    const far = mealStage("glide", hunter, body(38, 1.3, 70), {seed: "far", flee: "run", exact: true, style: "rush"});
    let top = 0;
    for (let t = 0; t < far.seconds; t += 1 / 30) {
        const p = far.predator(t)!;
        if (p.state === "stalk") top = Math.max(top, p.speed ?? 0);
        if (p.state === "run") top = Math.max(top, 0);
    }
    const sprint = Math.max(...Array.from({length: 600}, (_, i) => far.predator(i / 30)?.speed ?? 0));
    assert.ok(top <= sprint * 0.36, `stalks in at ${top.toFixed(1)} m/s of a ${sprint.toFixed(1)} m/s sprint`);
    // A striker found 30 m from its prey does not cross the ground to it: it is seen near, creeps the last of the way and strikes.
    for (const kind of ["glide", "slither"] as const) {
        const croc = body(0, 3.5, 40);
        const strike = measure(mealStage(kind, croc, body(30, 1.2, 60), {seed: "strike", flee: "run", exact: true, style: "strike"}));
        assert.ok(strike.runM < 3.5 * 1.5 && strike.stalkM < 3.5 * 3, `${kind}: a strike from where it is (crept ${strike.stalkM.toFixed(1)} m, struck over ${strike.runM.toFixed(1)} m)`);
        assert.ok(strike.preyM < 2, `${kind}: its prey had no time to run (${strike.preyM.toFixed(1)} m)`);
    }
    // A pounce leaves the ground; a rush does not.
    const fox = body(0, 0.7, 60);
    const vole = body(6, 0.1, 40);
    const pounce = measure(mealStage("glide", fox, vole, {seed: "pounce", flee: "run", exact: true, style: "pounce"}));
    const flat = measure(mealStage("glide", fox, vole, {seed: "pounce", flee: "run", exact: true, style: "rush"}));
    assert.ok(pounce.high > 0.45 * 0.7 && flat.high < 0.05, `a pounce goes ${pounce.high.toFixed(2)} m up (a rush ${flat.high.toFixed(2)})`);
    // Eating: a mouthful 1.4 s, a kill its own size 2.6 s; with no style given, 1.4 s as it was.
    assert.ok(Math.abs(eatSeconds(1, 0.05) - 1.46) < 0.01 && Math.abs(eatSeconds(1, 1) - 2.6) < 1e-9 && Math.abs(eatSeconds(1, 3) - 2.6) < 1e-9);
    assert.ok(Math.abs(rush.eat - eatSeconds(1.4, 1.3)) < 0.1, `a wolf-sized hunter is seen eating a deer for ${rush.eat.toFixed(1)} s`);
    assert.ok(Math.abs(measure(mealStage("glide", hunter, deer, {seed: "rush", flee: "run", exact: true})).eat - 1.4) < 0.1);
});

test("a raptor carries off small prey and eats a big kill where it fell; a perch hunter comes in low", () => {
    const hawk = body(-10, 0.5, 80);
    const gone = (stage: MealStage) => {
        const end = stage.predator(stage.seconds)!;
        const at = stage.prey(stage.catchAt!);
        return Math.hypot(end.x - at.x, end.z - at.z) > 2 && end.base > at.base + 1.5;
    };
    assert.equal(SWOOP_CARRY_MOST, 0.5);
    assert.ok(gone(mealStage("swoop", hawk, body(0, 0.2, 50), {seed: "vole", flee: "run", low: false})), "a vole goes with it");
    const pheasant = mealStage("swoop", hawk, body(0, 0.34, 50), {seed: "bird", flee: "run", low: false});
    assert.ok(!gone(pheasant), "prey two thirds of its length is eaten on the ground");
    assert.ok(pheasant.seconds - pheasant.catchAt! >= eatSeconds(0.5, 0.34) - 0.05, "and it is seen mantling it for the meal's time");
    assert.ok(gone(mealStage("swoop", hawk, body(0, 0.34, 50), {seed: "bird", flee: "run"})), "with no rule given, as it was: carried under three quarters");
    const top = (stage: MealStage) => Math.max(...Array.from({length: 200}, (_, i) => stage.predator((i / 200) * stage.catchAt!)!.base));
    const high = top(mealStage("swoop", body(-10, 0.3, 70), body(0, 0.08, 40), {seed: "k", flee: "run", low: false}));
    const low = top(mealStage("swoop", body(-10, 0.3, 70), body(0, 0.08, 40), {seed: "k", flee: "run", low: true}));
    assert.ok(low < 5 && high > 7, `from a perch it comes in at ${low.toFixed(1)} m, a stoop from ${high.toFixed(1)} m`);
});
