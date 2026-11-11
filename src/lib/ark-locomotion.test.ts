/**
 * The locomotion layer (lane L1; docs/ark/locomotion.md): its gaits and its quality metrics with thresholds, on the
 * skeletons of 20 real rigs (src/ark-scene/locomotion/fixtures/, written by scripts/ark-loco-metrics.mts --fixtures).
 *
 * The metrics are measured from where the feet really are (the posed bones through the instance): foot sliding
 * (planted-foot drift per step), stride/speed mismatch, planted foot height over the ground, joint limits.
 */

import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {Matrix4, Vector3} from "three";
import {buildLocoRig, type RawSkeleton} from "@/ark-scene/locomotion/skeleton";
import {GAITS, gaitFor, gaitLadder, legOffset, strideFor} from "@/ark-scene/locomotion/gaits";
import {restPole, solveLeg} from "@/ark-scene/locomotion/ik";
import {leggedPoser, simulate, type Scenario} from "@/ark-scene/locomotion/sim";
import {newSpring, stepSpring} from "@/ark-scene/locomotion/secondary";
import {fleeAt, rampedProgress, sprintPace} from "@/ark-scene/locomotion/flee";
import {bakedRow} from "@/ark-scene/locomotion/layer";
import type {LocoRig} from "@/ark-scene/locomotion/types";

const FIXTURES = path.join(process.cwd(), "src/ark-scene/locomotion/fixtures");
/** True lengths (m) of the golden species (the scale they are measured at). */
const LENGTHS: Record<string, number> = {
    "red-deer": 2.0, "plains-zebra": 2.3, "african-lion": 2.2, cheetah: 1.3, "domestic-dog": 0.9, "african-bush-elephant": 6.0, giraffe: 4.5, "brown-bear": 2.2,
    "house-mouse": 0.085, chimpanzee: 0.9, ostrich: 2.1, "domestic-chicken": 0.45, mallard: 0.58, "emperor-penguin": 1.15, "komodo-dragon": 2.6,
    "aldabra-giant-tortoise": 1.2, "american-bullfrog": 0.18, "black-ant": 0.009, "carolina-wolf-spider": 0.035, "coconut-crab": 0.4
};
const rigs: Array<{rig: LocoRig; scale: number}> = readdirSync(FIXTURES)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
        const rig = buildLocoRig(JSON.parse(readFileSync(path.join(FIXTURES, f), "utf8")) as RawSkeleton);
        return {rig, scale: (LENGTHS[rig.slug] ?? 1) / Math.max(rig.length, rig.height)};
    });

/** Animals whose legs are big enough to see a foot slide: their thresholds are strict. Insects, spiders and crabs (legs of a few mm, fitted short by the rigger) are held to looser ones. */
const visible = (rig: LocoRig, scale: number) => rig.gaitLength * scale >= 0.03 && rig.plan !== "insect" && rig.plan !== "arachnid" && rig.plan !== "crustacean";

type Limits = {slideShare: number; stride: number; height: number; joints: number};
const STRICT: Record<string, Limits> = {
    walk: {slideShare: 0.02, stride: 0.12, height: 0.015, joints: 0.02},
    run: {slideShare: 0.025, stride: 0.12, height: 0.025, joints: 0.04},
    spin: {slideShare: 0.02, stride: 1, height: 0.015, joints: 0.02},
    slope: {slideShare: 0.06, stride: 0.12, height: 0.025, joints: 0.03}
};
const LOOSE: Limits = {slideShare: 3, stride: 0.6, height: 0.6, joints: 0.5};

test("locomotion fixtures: 20 real skeletons, every body plan with legs", () => {
    assert.equal(rigs.length, 20);
    const plans = new Set(rigs.map((r) => r.rig.plan));
    for (const plan of ["quadruped", "primate", "flightless_bird", "walking_bird", "flying_bird", "lizard", "turtle", "amphibian", "insect", "arachnid", "crustacean"]) assert.ok(plans.has(plan as LocoRig["plan"]), plan);
    for (const {rig} of rigs) {
        assert.ok(rig.legs.length >= 2, `${rig.slug} legs`);
        assert.ok(rig.legHeight > 0, `${rig.slug} leg height`);
        for (const leg of rig.legs) assert.ok(leg.contact[1] <= leg.ankle[1] + 1e-6, `${rig.slug} ${leg.key}: sole below the ankle`);
    }
});

for (const scenario of ["walk", "run", "spin", "slope"] as Scenario[]) {
    test(`locomotion metrics (${scenario}): planted feet don't slide, strides match the speed, soles on the ground, joints within limits`, () => {
        const failures: string[] = [];
        for (const {rig, scale} of rigs) {
            const {metrics: m} = simulate(rig, scenario, scale, leggedPoser(), 7);
            const hip = rig.gaitLength * scale;
            const lim = visible(rig, scale) ? STRICT[scenario] : LOOSE;
            if (m.slideShare > lim.slideShare) failures.push(`${rig.slug}: slide ${m.slideMeanMm} mm (${m.slideShare} of the hip)`);
            if (scenario !== "spin" && m.strideMismatch > lim.stride) failures.push(`${rig.slug}: stride/speed ${m.strideMismatch}`);
            if (m.footHeightMm / 1000 > lim.height * hip + 0.0005) failures.push(`${rig.slug}: foot height ${m.footHeightMm} mm`);
            if (m.jointViolations > lim.joints) failures.push(`${rig.slug}: joint limits ${m.jointViolations}`);
        }
        assert.deepEqual(failures, []);
    });
}

test("gaits: footfall orders (walk lateral sequence, trot diagonals, pace laterals, bound by pairs, insect tripod)", () => {
    const deer = rigs.find((r) => r.rig.slug === "red-deer")!.rig;
    const off = (gait: string, end: string, side: number) => legOffset(gait, deer.legs.find((l) => l.end === end && l.side === side)!, deer.legs);
    // Walk: LH, LF a quarter later, RH half, RF three quarters.
    assert.deepEqual([off("walk", "hind", 1), off("walk", "fore", 1), off("walk", "hind", -1), off("walk", "fore", -1)], [0, 0.25, 0.5, 0.75]);
    assert.equal(off("trot", "hind", 1), off("trot", "fore", -1));
    assert.equal(off("trot", "hind", -1), off("trot", "fore", 1));
    assert.ok(Math.abs(off("pace", "hind", 1) - off("pace", "fore", 1)) < 0.1);
    assert.equal(off("bound", "hind", 1), off("bound", "hind", -1));
    const ant = rigs.find((r) => r.rig.slug === "black-ant")!.rig;
    const tri = ant.legs.map((leg) => legOffset("tripod", leg, ant.legs));
    // Two groups of three, half a cycle apart; each group has both sides.
    assert.equal(tri.filter((o) => o === 0).length, 3);
    assert.equal(tri.filter((o) => o === 0.5).length, 3);
});

test("gaits: the ladder changes with speed (Froude), with hysteresis; strides lengthen and cadence = speed / stride", () => {
    const deer = rigs.find((r) => r.rig.slug === "red-deer")!.rig;
    const ladder = gaitLadder(deer);
    assert.deepEqual(ladder.map(([g]) => g), ["walk", "trot", "canter", "gallop"]);
    assert.equal(gaitFor(ladder, 0.2, null), "walk");
    assert.equal(gaitFor(ladder, 0.8, null), "trot");
    assert.equal(gaitFor(ladder, 3, null), "gallop");
    // Going down, a trot holds a little below its start.
    assert.equal(gaitFor(ladder, 0.45, "trot"), "trot");
    assert.equal(gaitFor(ladder, 0.3, "trot"), "walk");
    const lion = gaitLadder(rigs.find((r) => r.rig.slug === "african-lion")!.rig).map(([g]) => g);
    assert.ok(lion.includes("rotary"), "a cat gallops rotary");
    assert.ok(gaitLadder(rigs.find((r) => r.rig.slug === "giraffe")!.rig).some(([g]) => g === "pace"), "a giraffe paces");
    assert.ok(!gaitLadder(rigs.find((r) => r.rig.slug === "african-bush-elephant")!.rig).some(([g]) => g === "gallop" || g === "rotary"), "an elephant never gallops");
    const slow = strideFor(1, 1, GAITS.walk);
    const fast = strideFor(2, 1, GAITS.walk);
    assert.ok(fast.stride > slow.stride);
    assert.ok(Math.abs(fast.stride * fast.cadence - 2) < 1e-9);
    // A bigger animal at the same speed: longer, slower strides.
    const big = strideFor(1.5, 1.6, GAITS.walk);
    const small = strideFor(1.5, 0.5, GAITS.trot);
    assert.ok(big.cadence < small.cadence);
});

test("leg IK reaches a reachable target and keeps the knee bending its own way", () => {
    for (const {rig} of rigs) {
        for (const leg of rig.legs) {
            const world = rig.bones.map((b) => b.restWorld.clone());
            const hip = new Vector3(...leg.hip);
            const ankle = new Vector3(...leg.ankle);
            const target = hip.clone().lerp(ankle, 0.9).add(new Vector3(0, 0, 0.1 * (leg.upperLength + leg.lowerLength)));
            const pole = new Vector3(...restPole(rig, leg));
            const solved = solveLeg(leg, world, target, pole);
            assert.ok(solved.miss < 1e-4 * Math.max(rig.length, 1) + 1e-4, `${rig.slug} ${leg.key} miss ${solved.miss}`);
        }
    }
});

test("springs: the same motion at 30, 60 and 144 fps (deterministic, frame-rate independent)", () => {
    const run = (fps: number) => {
        const s = newSpring();
        for (let t = 0; t < 2; t += 1 / fps) stepSpring(s, t < 0.5 ? 1 : 0, 1 / fps, 2, 0.3);
        return s.x;
    };
    assert.ok(Math.abs(run(30) - run(60)) < 0.02);
    assert.ok(Math.abs(run(144) - run(60)) < 0.02);
});

test("flee paths: pure (same clock, same place), away from the threat, zigzag cuts, a top speed by size", () => {
    const input = {from: {x: 0, z: 0}, threat: {x: 0, z: -5}, start: 100, seed: 0.3, pace: {plan: "quadruped", length: 1.2, speedStat: 70}, style: "zigzag" as const};
    const a = fleeAt(input, 103);
    const b = fleeAt(input, 103);
    assert.deepEqual(a, b);
    assert.ok(a.z > 2, "ran away from the threat");
    const yaws = [101.5, 102.5, 103.5, 104.5].map((t) => fleeAt(input, t).yaw);
    assert.ok(Math.max(...yaws) - Math.min(...yaws) > 0.4, "it cuts left and right");
    assert.ok(sprintPace({plan: "quadruped", length: 1.3, speedStat: 95}) > sprintPace({plan: "quadruped", length: 1.3, speedStat: 40}));
    assert.ok(sprintPace({plan: "quadruped", length: 2, speedStat: 50}) > sprintPace({plan: "quadruped", length: 0.1, speedStat: 50}));
    assert.ok(sprintPace({plan: "insect", length: 0.01}) < 0.5);
    assert.equal(rampedProgress(0, 10, 2), 0);
    assert.ok(Math.abs(rampedProgress(10, 10, 2) - 1) < 1e-9);
    assert.ok(Math.abs(rampedProgress(5, 10, 2) - 0.5) < 1e-9);
});

test("baked rows: a clip's frame blends like the shader, and no clip is the rest pose", () => {
    const bones = 2;
    const data = new Uint16Array(bones * 12 * 2);
    // Row 0: identity, row 1: translated by 1 on x (half floats: 1.0 = 0x3c00).
    for (let row = 0; row < 2; row++) for (let b = 0; b < bones; b++) {
        const o = row * bones * 12 + b * 12;
        data[o] = data[o + 5] = data[o + 10] = 0x3c00;
        if (row === 1) data[o + 3] = 0x3c00;
    }
    const out = new Float32Array(bones * 12);
    bakedRow(data, bones, [0, 1, 0.5], null, 0, out);
    assert.equal(out[3], 0.5);
    bakedRow(data, bones, null, null, 0, out);
    assert.equal(out[3], 0);
    assert.equal(out[0], 1);
    void Matrix4;
});
