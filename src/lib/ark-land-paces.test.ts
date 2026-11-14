/**
 * How land animals go about on foot (behaviours pass 2026-11, lane B4; docs/ark/behaviour-pass-2026-11/land.md):
 * natural walking and covering-ground paces (`locomotion/paces.ts`, written into `behaviours.json` by
 * `scripts/ark-walk-pace.mts`), a walk's shape in time (getting going, stopping, a burst mover's bursts and stops) and
 * a walked way's shape on the ground (`behaviour-nav.ts` naturalWay).
 *
 * The numbers the audit found wrong are recorded as `b4` motion metrics when `ARK_MOTION_METRICS_DIR` is set
 * (`scripts/ark-motion-ci.mts`, `tests/ark-motion/metrics.json`).
 */

import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {Matrix4, Quaternion, Vector3} from "three";
import table from "@/ark-scene/behaviours.json";
import {behaviourProfile, bodyLengthsPerSecond, runFactor} from "@/ark-scene/behaviour-profile";
import {naturalWay, pathLength, type NavPoint} from "@/ark-scene/behaviour-nav";
import {modelBase} from "@/ark-scene/grounding/base";
import {sprintPace} from "@/ark-scene/locomotion/flee";
import {G, gaitFor, gaitLadder} from "@/ark-scene/locomotion/gaits";
import {LocoLayer, newLocoAnimal} from "@/ark-scene/locomotion/layer";
import {leggedDriver} from "@/ark-scene/locomotion/legged";
import {gaitRhythm, groundProgress, naturalPaces, rampedShare, slowMover, standTurnRate, startTime, stopTime} from "@/ark-scene/locomotion/paces";
import {newSitState, sitLife, sitLook, SIT_LOOK_YAW} from "@/ark-scene/locomotion/sitting";
import {buildLocoRig, type RawSkeleton} from "@/ark-scene/locomotion/skeleton";
import type {LocoInput, LocoRig} from "@/ark-scene/locomotion/types";
import {arkBody} from "@/ark-scene/stats";
import {recordMotionMetric} from "@/lib/ark-motion-metrics";

const FIXTURES = path.join(process.cwd(), "src/ark-scene/locomotion/fixtures");
const rigs: LocoRig[] = readdirSync(FIXTURES)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => buildLocoRig(JSON.parse(readFileSync(path.join(FIXTURES, f), "utf8")) as RawSkeleton));
const lengthOf = (slug: string, plan?: string | null) => arkBody({model_slug: slug} as Parameters<typeof arkBody>[0], plan).display;

/** Gaits that are a walk (feet always on the ground), by ladder. */
const WALKS = new Set(["walk", "ds_walk", "biped_walk", "waddle", "sprawl", "wave", "stand"]);
/** The walk the schedule gives a species (m/s) and the gait the legged driver draws at it on this rig. */
function drawnAt(rig: LocoRig, speed: number): {froude: number; gait: string} {
    const L = lengthOf(rig.slug, rig.plan);
    const scale = L / Math.max(rig.length, rig.height);
    const froude = (speed * speed) / (G * rig.gaitLength * scale);
    return {froude, gait: gaitFor(gaitLadder(rig), froude, null)};
}

test("B4 metric: every golden species' everyday walk is drawn as a walk, and its long ways as its covering-ground gait", () => {
    const wrong: string[] = [];
    const froudes: number[] = [];
    const runs: Record<string, string> = {};
    for (const rig of rigs) {
        const profile = behaviourProfile(rig.slug, rig.plan);
        const L = lengthOf(rig.slug, rig.plan);
        const rhythm = gaitRhythm(rig.slug, modelBase(rig.slug)?.plan, L);
        // (A burst mover's walk is bursts: its gait is its bursts', below.)
        if (rhythm.share < 1 || rig.plan === "insect" || rig.plan === "arachnid" || rig.plan === "crustacean") continue;
        const walk = bodyLengthsPerSecond(profile) * L;
        const at = drawnAt(rig, walk);
        froudes.push(at.froude);
        // (A leaping frog hops at every pace; an elephant's walk and amble are both walks.)
        if (!WALKS.has(at.gait) && at.gait !== "hop" && at.gait !== "amble") wrong.push(`${rig.slug}: walks at ${walk.toFixed(2)} m/s, Fr ${at.froude.toFixed(2)}, drawn as ${at.gait}`);
        if (runFactor(profile) > 1.3) runs[rig.slug] = drawnAt(rig, walk * runFactor(profile)).gait;
    }
    recordMotionMetric("b4", "golden_walks_drawn_as_a_run", wrong.length);
    recordMotionMetric("b4", "golden_walk_froude_max", Math.max(...froudes));
    assert.deepEqual(wrong, []);
    // Long ways: hoofed, dogs and cats trot; a giraffe and a bear pace; an elephant ambles (never an aerial phase); a
    // chimpanzee half-bounds; a komodo dragon runs sprawling; an ostrich runs.
    assert.equal(runs["plains-zebra"], "trot");
    assert.equal(runs["red-deer"], "trot");
    assert.equal(runs["african-lion"], "trot");
    assert.equal(runs["domestic-dog"], "trot");
    assert.equal(runs.giraffe, "pace");
    assert.equal(runs["brown-bear"], "pace");
    assert.equal(runs["african-bush-elephant"], "amble");
    assert.equal(runs.chimpanzee, "half_bound");
    assert.equal(runs["komodo-dragon"], "sprawl_run");
    assert.equal(runs.ostrich, "biped_run");
});

test("B4 metric: walking speeds are the animals' own (m/s at true size), within their top speeds", () => {
    const speed = (slug: string) => bodyLengthsPerSecond(behaviourProfile(slug)) * lengthOf(slug);
    // The real animals' everyday walks: an elephant about 1.2 m/s, a giraffe 1.3, a horse 1.4 to 1.8, a zebra 1.1, a lion
    // 1.1, a giant tortoise 0.08, an ostrich 1.1, a chicken 0.5. (Before: 3.4, 5.1, 3.2, 2.7, 2.1, 0.85, 3.3, 0.53.)
    const band: Record<string, [number, number]> = {
        "african-bush-elephant": [0.9, 1.5],
        giraffe: [1.0, 1.7],
        "domestic-horse": [0.9, 1.8],
        "plains-zebra": [0.8, 1.5],
        "african-lion": [0.8, 1.4],
        "brown-bear": [0.6, 1.3],
        "aldabra-giant-tortoise": [0.05, 0.16],
        ostrich: [0.8, 1.5],
        "domestic-chicken": [0.3, 0.7],
        "komodo-dragon": [0.3, 0.9],
        "burmese-python": [0.1, 0.4]
    };
    for (const [slug, [lo, hi]] of Object.entries(band)) assert.ok(speed(slug) >= lo && speed(slug) <= hi, `${slug} walks at ${speed(slug).toFixed(3)} m/s (${lo} to ${hi})`);
    // Over the whole table: no steady mammal walks faster than a giraffe's stride takes it, no turtle faster than a
    // giant tortoise's best, and nothing walks at more than 0.6 of its top speed.
    let mammal = 0;
    let turtle = 0;
    let overTop = 0;
    const rows = (table as {species: Record<string, string>}).species;
    for (const slug of Object.keys(rows)) {
        const profile = behaviourProfile(slug);
        if (!profile.walkPace) continue;
        const plan = modelBase(slug)?.plan ?? null;
        const L = lengthOf(slug);
        const v = profile.walkPace * L;
        if (plan === "mammal" && gaitRhythm(slug, plan, L).share === 1) mammal = Math.max(mammal, v);
        if (plan === "turtle" && L > 0.03) turtle = Math.max(turtle, v);
        const rigPlan = plan === "mammal" ? "quadruped" : plan === "turtle" ? "turtle" : plan === "reptile" ? "lizard" : null;
        // (Not the golden tortoise beetle, a beetle the model library files under turtles.)
        if (rigPlan && L > 0.03 && gaitRhythm(slug, plan, L).share === 1 && v > 0.62 * sprintPace({plan: rigPlan, slug, length: L, speedStat: profile.speed})) overTop++;
    }
    recordMotionMetric("b4", "walk_fastest_steady_mammal", mammal, "m/s");
    recordMotionMetric("b4", "walk_fastest_turtle", turtle, "m/s");
    recordMotionMetric("b4", "walk_over_top_species", overTop);
    assert.ok(mammal <= 1.7, `the fastest-walking steady mammal: ${mammal.toFixed(2)} m/s`);
    assert.ok(turtle <= 0.16, `the fastest-walking turtle: ${turtle.toFixed(3)} m/s`);
    assert.equal(overTop, 0);
});

test("natural paces: by Froude number on the leg, by gait family, slow movers slow, a burst mover's walk its bursts' mean", () => {
    const body = (slug: string, plan: string, length: number, hip: number, reach = hip) => ({slug, plan, length, hip, reach, speedStat: 50});
    const horse = naturalPaces(body("domestic-horse", "quadruped", 2.4, 0.82))!;
    const elephant = naturalPaces(body("african-bush-elephant", "quadruped", 5.1, 1.48))!;
    const mouse = naturalPaces(body("house-mouse", "quadruped", 0.15, 0.031), gaitRhythm("house-mouse", "mammal", 0.15))!;
    // (Bigger animals walk faster in metres, slower in body lengths.)
    assert.ok(elephant.walk > horse.walk * 0.9 && elephant.walk / 5.1 < horse.walk / 2.4);
    assert.ok(mouse.walk / 0.15 > horse.walk / 2.4, "a mouse covers more body lengths a second than a horse");
    // (An elephant's fast gait stays under the Froude number where the others trot.)
    assert.ok((elephant.run! * elephant.run!) / (G * 1.48) < 0.5);
    assert.ok((horse.run! * horse.run!) / (G * 0.82) > 0.8);
    assert.equal(naturalPaces(body("aldabra-giant-tortoise", "turtle", 1.2, 0.35))!.run, null);
    assert.ok(slowMover("brown-throated-sloth") && slowMover("veiled-chameleon") && !slowMover("green-iguana"));
    assert.ok(naturalPaces(body("veiled-chameleon", "lizard", 0.42, 0.13))!.walk < 0.05);
    // Rigs that keep their clips' paces.
    assert.equal(naturalPaces(body("black-ant", "insect", 0.009, 0.002)), null);
    assert.equal(naturalPaces(body("american-bullfrog", "amphibian", 0.18, 0.04)), null);
    assert.equal(naturalPaces(body("harbor-seal", "quadruped", 1.5, 0.3)), null);
    // Rhythm: who moves in bursts.
    assert.ok(gaitRhythm("house-mouse", "mammal", 0.09).share < 1);
    assert.ok(gaitRhythm("european-rabbit", "mammal", 0.34).share < 1);
    assert.ok(gaitRhythm("red-kangaroo", "mammal", 1.9).share < 1);
    assert.ok(gaitRhythm("common-wall-lizard", "reptile", 0.18).share < 1);
    assert.equal(gaitRhythm("komodo-dragon", "reptile", 2.6).share, 1);
    assert.equal(gaitRhythm("plains-zebra", "mammal", 2.3).share, 1);
    assert.equal(gaitRhythm("african-bush-elephant", "mammal", 6).share, 1);
    assert.equal(gaitRhythm("eurasian-otter", "mammal", 0.9).share, 1);
    assert.ok(gaitRhythm("carolina-wolf-spider", "arthropod", 0.03).share < 1);
    assert.equal(gaitRhythm("black-ant", "arthropod", 0.009).share, 1);
    // Turning where it stands: an elephant slower than a horse, nothing slower than 0.9 rad/s.
    assert.ok(standTurnRate(6) < standTurnRate(2.4) && standTurnRate(2.4) < standTurnRate(0.1));
    assert.ok(standTurnRate(30) >= 0.9);
});

test("B4 metric: a walking leg gets going and slows to its stop; a burst mover's is bursts with stops between", () => {
    // A steady leg of 10 s for a 2 m animal.
    const shape = {start: startTime(2, false), stop: stopTime(2, false)};
    assert.ok(shape.start > 0.3 && shape.start < 1.2 && shape.stop > 0.2);
    const T = 10;
    let last = 0;
    let peak = 0;
    for (let t = 0; t <= T + 1e-9; t += 0.05) {
        const at = groundProgress(t, T, shape);
        assert.ok(at.share >= last - 1e-9, "never backwards");
        peak = Math.max(peak, at.rate);
        last = at.share;
    }
    assert.ok(Math.abs(last - 1) < 1e-6, "it ends at its goal");
    // Its speed a tenth of a second in, over its speed on the way (1 before: at full speed from its first frame).
    const early = groundProgress(0.1, T, shape).rate / peak;
    const late = groundProgress(T - 0.1, T, shape).rate / peak;
    recordMotionMetric("b4", "start_speed_share_after_a_tenth_of_a_second", early);
    recordMotionMetric("b4", "stop_speed_share_a_tenth_of_a_second_before", late);
    assert.ok(early < 0.25 && late < 0.3, `start ${early.toFixed(2)}, stop ${late.toFixed(2)}`);
    // (Its pace on the way is its mean over the time it was given, less its speeding up and slowing: the schedule
    // lengthens the leg by half of both, so its pace on the way is its own.)
    assert.ok(Math.abs(peak - T / (T - (shape.start + shape.stop) / 2)) < 1e-6);
    // No shape: as before, one speed.
    assert.ok(Math.abs(groundProgress(2.5, 10, null).share - 0.25) < 1e-9);
    // A burst mover: about its share of the time moving, at least one stop, the same ends, pure.
    const rhythm = gaitRhythm("house-mouse", "mammal", 0.09);
    const bursty = {start: startTime(0.09, false), stop: stopTime(0.09, false), rhythm: {...rhythm, seed: 0.37}};
    let moving = 0;
    let stops = 0;
    let was = true;
    last = 0;
    const n = 2000;
    for (let i = 0; i <= n; i++) {
        const at = groundProgress((i / n) * 12, 12, bursty);
        assert.ok(at.share >= last - 1e-9);
        last = at.share;
        if (at.moving) moving++;
        if (was && !at.moving && i < n) stops++;
        was = at.moving;
    }
    assert.ok(Math.abs(last - 1) < 1e-6);
    assert.ok(stops >= 2, `${stops} stops`);
    assert.ok(Math.abs(moving / n - rhythm.share) < 0.08, `moving ${(moving / n).toFixed(2)} of the time (${rhythm.share})`);
    recordMotionMetric("b4", "burst_mover_share_moving", moving / n);
    assert.deepEqual({...groundProgress(3.3, 12, bursty)}, {...groundProgress(3.3, 12, bursty)});
    // A step eases too.
    assert.equal(rampedShare(0, 0.25), 0);
    assert.ok(Math.abs(rampedShare(1, 0.25) - 1) < 1e-9 && Math.abs(rampedShare(0.5, 0.25) - 0.5) < 1e-9 && rampedShare(0.1, 0.25) < 0.05);
});

test("B4 metric: a walked way has no sharp corner on the move and no ruler line across the open, where there is room", () => {
    const open = {wayClear: () => true};
    const shut = {wayClear: () => false};
    const opts = {radius: 0.3, maxSlope: 0.9, turn: 1.5, bow: 0.8, bowFrom: 4};
    const sharpest = (way: NavPoint[]) => {
        let worst = 0;
        for (let i = 1; i + 1 < way.length; i++) {
            const a = Math.atan2(way[i].x - way[i - 1].x, way[i].z - way[i - 1].z);
            const b = Math.atan2(way[i + 1].x - way[i].x, way[i + 1].z - way[i].z);
            worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))));
        }
        return worst;
    };
    // A right-angle corner: rounded into steps of under 30 degrees, the same ends, a little shorter.
    const corner: NavPoint[] = [{x: 0, z: 0}, {x: 0, z: 10}, {x: 10, z: 10}];
    const round = naturalWay(open, corner, opts);
    assert.deepEqual(round[0], corner[0]);
    assert.deepEqual(round[round.length - 1], corner[2]);
    assert.ok(sharpest(round) < 0.55, `sharpest turn ${sharpest(round).toFixed(2)} rad`);
    assert.ok(pathLength(round) < pathLength(corner) && pathLength(round) > pathLength(corner) - 2);
    recordMotionMetric("b4", "right_angle_corner_sharpest_turn", sharpest(round), "rad");
    // No room: the grid's own way.
    assert.deepEqual(naturalWay(shut, corner, opts), corner);
    // A long straight run: bowed to one side by a few hundredths of its length; a short one, or no room: left straight.
    const line: NavPoint[] = [{x: 0, z: 0}, {x: 0, z: 20}];
    const bowed = naturalWay(open, line, opts);
    const off = Math.max(...bowed.map((p) => Math.abs(p.x)));
    assert.ok(bowed.length > 4 && off > 0.4 && off < 2, `bowed ${off.toFixed(2)} m`);
    assert.ok(pathLength(bowed) / 20 < 1.03);
    assert.deepEqual(bowed[0], line[0]);
    assert.deepEqual(bowed[bowed.length - 1], line[1]);
    assert.equal(Math.sign(naturalWay(open, line, {...opts, bow: -0.8})[3].x), -Math.sign(bowed[3].x));
    assert.deepEqual(naturalWay(shut, line, opts), line);
    assert.deepEqual(naturalWay(open, [{x: 0, z: 0}, {x: 0, z: 2}], opts), [{x: 0, z: 0}, {x: 0, z: 2}]);
});

test("B4 metric: a sitting rig at rest looks about and breathes (never a statue); with no clip to move by it hops, never slides", () => {
    // A sitting rig: the chimpanzee's skeleton under the contract's sitting pose (the fixtures hold no sitter).
    const raw = JSON.parse(readFileSync(path.join(FIXTURES, "chimpanzee.json"), "utf8")) as RawSkeleton;
    const rig = buildLocoRig({...raw, pose: "sitting (test)"});
    assert.ok(rig.sitting && rig.head >= 0);
    const scale = 0.5 / Math.max(rig.length, rig.height);
    const run = (speed: number, clip: string) => {
        const state = newSitState();
        const world = rig.bones.map((b) => b.restWorld.clone());
        const instance = new Matrix4();
        const yaws: number[] = [];
        let lift = 0;
        for (let f = 0; f <= 30 * 40; f++) {
            const t = f / 30;
            instance.compose(new Vector3(0, 0, speed * t), new Quaternion(), new Vector3(scale, scale, scale));
            rig.bones.forEach((b, i) => world[i].copy(b.restWorld));
            const input: LocoInput = {instance, scale, yaw: 0, dt: 1 / 30, clock: 5000 + t, seed: 0.37, ground: () => ({height: 0, nx: 0, ny: 1, nz: 0}), grounded: true, clipNow: clip, clipFrom: null, clipPhase: 0};
            sitLife(rig, input, world, state);
            // The head's turn from its rest (radians about the upright): its bone's turn, applied to the way it faces.
            const turn = new Matrix4().extractRotation(world[rig.head]).multiply(new Matrix4().extractRotation(rig.bones[rig.head].restWorld).invert());
            const now = new Vector3(0, 0, 1).transformDirection(turn);
            yaws.push(Math.atan2(now.x, now.z));
            lift = Math.max(lift, new Vector3().setFromMatrixPosition(world[rig.hips]).y - new Vector3().setFromMatrixPosition(rig.bones[rig.hips].restWorld).y);
        }
        return {yaws, lift};
    };
    const rest = run(0, "idle");
    const swing = Math.max(...rest.yaws) - Math.min(...rest.yaws);
    // Looks held: the share of the time the head is turning slowly or not at all.
    let held = 0;
    for (let i = 1; i < rest.yaws.length; i++) if (Math.abs(rest.yaws[i] - rest.yaws[i - 1]) * 30 < 0.15) held++;
    recordMotionMetric("b4", "sitting_rig_head_swing_at_rest", swing, "rad");
    assert.ok(swing > 0.3 && swing < 2 * SIT_LOOK_YAW + 0.2, `its head swings ${swing.toFixed(2)} rad over 40 s`);
    assert.ok(held / rest.yaws.length > 0.7, "it holds its looks");
    assert.equal(rest.lift, 0);
    assert.deepEqual(run(0, "idle").yaws, rest.yaws);
    assert.deepEqual(sitLook(1234.5, 0.2), sitLook(1234.5, 0.2));
    // Another clip plays its own head; moving on its idle (a sitter with no bound) it hops.
    assert.ok(Math.max(...run(0, "graze").yaws.map(Math.abs)) < 1e-6);
    const moving = run(0.3, "idle");
    recordMotionMetric("b4", "sitting_rig_hop_lift_share_of_height", moving.lift / rig.height);
    assert.ok(moving.lift > 0.04 * rig.height, `it rises ${(moving.lift / rig.height).toFixed(3)} of its height as it goes`);
});

test("B4 metric: standing, a legged animal looks about by kind (looks turned to and held), not one slow sway for all", () => {
    /** The head's swing (rad about the upright) and the share of the time it is held nearly still, standing 60 s. */
    const standing = (slug: string) => {
        const rig = rigs.find((r) => r.slug === slug)!;
        const scale = lengthOf(slug, rig.plan) / Math.max(rig.length, rig.height);
        const state = leggedDriver.init(rig);
        const world = rig.bones.map((b) => b.restWorld.clone());
        const instance = new Matrix4().compose(new Vector3(0, -rig.minY * scale, 0), new Quaternion(), new Vector3(scale, scale, scale));
        const yaws: number[] = [];
        for (let f = 0; f <= 30 * 60; f++) {
            rig.bones.forEach((b, i) => world[i].copy(b.restWorld));
            const input: LocoInput = {instance, scale, yaw: 0, dt: 1 / 30, clock: 9000 + f / 30, seed: 0.61, ground: () => ({height: 0, nx: 0, ny: 1, nz: 0}), grounded: true, clipNow: "idle", clipFrom: null, clipPhase: 0};
            leggedDriver.pose(rig, input, world, state);
            const turn = new Matrix4().extractRotation(world[rig.head]).multiply(new Matrix4().extractRotation(rig.bones[rig.head].restWorld).invert());
            const now = new Vector3(0, 0, 1).transformDirection(turn);
            yaws.push(Math.atan2(now.x, now.z));
        }
        let held = 0;
        for (let i = 1; i < yaws.length; i++) if (Math.abs(yaws[i] - yaws[i - 1]) * 30 < 0.15) held++;
        return {swing: Math.max(...yaws) - Math.min(...yaws), held: held / yaws.length};
    };
    const zebra = standing("plains-zebra");
    const lion = standing("african-lion");
    const hen = standing("domestic-chicken");
    recordMotionMetric("b4", "standing_grazer_head_swing", zebra.swing, "rad");
    // (Before: about 0.19 rad for every kind, never held.)
    assert.ok(zebra.swing > 0.35 && zebra.swing < 1.1, `a zebra's head swings ${zebra.swing.toFixed(2)} rad`);
    assert.ok(lion.swing < zebra.swing, `a lion's less (${lion.swing.toFixed(2)})`);
    assert.ok(hen.swing > 0.4, `a hen's ${hen.swing.toFixed(2)}`);
    assert.ok(zebra.held > 0.6 && hen.held > 0.5, `held ${zebra.held.toFixed(2)} / ${hen.held.toFixed(2)} of the time`);
});

test("B4 metric: on the ground a bird's wings keep the clip's own pose under the legged driver (a v7 rig's clips shrink its flight wings away)", () => {
    // A v7 bird rig (the v3 set, all 635 of them with wings and an idle) rests with its flight wings out at full size;
    // its idle and walk shrink the wing's shoulder bone to 0.01 so only the folded wings modelled on the body show. The
    // legged driver poses from the rest pose, so through the layer the flight wings hung open to the grass (a flamingo
    // "a red skirt to the ground", the graphics pass 2026-11-14). The mallard's skeleton, with a clip frame made so.
    const rig = rigs.find((r) => r.slug === "mallard")!;
    assert.ok(rig.wings.left.length === 3 && rig.wings.right.length === 3);
    const n = rig.bones.length;
    /** A half float (the bone texture's format). */
    const half = (v: number) => {
        const f = new Float32Array([v]);
        const x = new Uint32Array(f.buffer)[0];
        const sign = (x >> 16) & 0x8000;
        const exp = ((x >> 23) & 0xff) - 127 + 15;
        if (exp <= 0) return sign;
        return sign | (exp << 10) | ((x >> 13) & 0x3ff);
    };
    // Two rows, the same frame: every bone at rest, but each wing's shoulder (and so its forearm and hand) shrunk to
    // `fold` about the shoulder's own place.
    const frame = (fold: number) => {
        const data = new Uint16Array(n * 12 * 2);
        const winged = new Map<number, number>();
        for (const chain of [rig.wings.left, rig.wings.right]) for (const b of chain) winged.set(b, chain[0]);
        for (let row = 0; row < 2; row++) for (let b = 0; b < n; b++) {
            const o = (row * n + b) * 12;
            const root = winged.get(b);
            const k = root === undefined ? 1 : fold;
            const pivot = root === undefined ? new Vector3() : new Vector3().setFromMatrixPosition(rig.bones[root].restWorld);
            // skin = T(pivot) · S(k) · T(−pivot): x' = k·x + (1 − k)·pivot.
            const m = [k, 0, 0, (1 - k) * pivot.x, 0, k, 0, (1 - k) * pivot.y, 0, 0, k, (1 - k) * pivot.z];
            m.forEach((v, i) => (data[o + i] = half(v)));
        }
        return data;
    };
    /** The wing bones' size in the layer's live row (the skin matrix's first column's length; the worst of the six). */
    const through = (fold: number, clip: string, grounded: boolean) => {
        const layer = new LocoLayer(rig, frame(fold));
        const animal = newLocoAnimal();
        const scale = 0.58 / Math.max(rig.length, rig.height);
        const instance = new Matrix4();
        for (let f = 0; f < 60; f++) {
            instance.compose(new Vector3(0, -rig.minY * scale, clip === "walk" ? f * 0.004 : 0), new Quaternion(), new Vector3(scale, scale, scale));
            layer.pose(animal, {instance, scale, yaw: 0, dt: 1 / 60, clock: 300 + f / 60, seed: 0.3, ground: () => ({height: 0, nx: 0, ny: 1, nz: 0}), grounded, clipNow: clip, clipFrom: null, clipPhase: 0}, [0, 1, 0.5], null, 0, 0);
        }
        let most = 0;
        for (const b of [...rig.wings.left, ...rig.wings.right]) most = Math.max(most, Math.hypot(layer.live.data[b * 12], layer.live.data[b * 12 + 4], layer.live.data[b * 12 + 8]));
        return {size: most, driver: animal.driver};
    };
    const idle = through(0.01, "idle", true);
    const walk = through(0.01, "walk", true);
    assert.equal(idle.driver, "legged");
    assert.equal(walk.driver, "legged");
    recordMotionMetric("b4", "grounded_bird_wing_size_under_the_legged_driver", Math.max(idle.size, walk.size));
    // (Before: 1, the rest pose's full flight wings.)
    assert.ok(idle.size < 0.02 && walk.size < 0.02, `the flight wings' size on the ground: idle ${idle.size.toFixed(3)}, walk ${walk.size.toFixed(3)} (the clip's 0.01)`);
    // A clip that leaves them at full size keeps them so (the driver adds nothing of its own to the wings).
    assert.ok(Math.abs(through(1, "idle", true).size - 1) < 0.01);
});
