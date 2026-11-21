/**
 * ARK-POSE: the lying gate (`locomotion/pose-gate.ts`), the mammals' neck gate (`locomotion/neck-gate.ts`), the posed
 * lie's solved turn out (`lie-pose.ts` solveSplay) and the posed sit's shapes (`sit-sleep-pose.ts` SIT_SHAPES), on the
 * real rigs' skeletons (src/ark-scene/locomotion/fixtures/, each with a sample of its mesh) and on a made neck (a tube
 * of skin over a chest, a neck and a head bone). The published rigs' own numbers are the scan's
 * (`scripts/ark-pose-census.mts`).
 */

import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {DataUtils, Matrix4} from "three";
import {buildLocoRig, type RawSkeleton} from "@/ark-scene/locomotion/skeleton";
import {LIE_SPLAY, LiePose, lieShaped} from "@/ark-scene/locomotion/lie-pose";
import {END_GAP, RUMP_HEIGHT, measureLying} from "@/ark-scene/locomotion/pose-gate";
import {
    CLIP_LOOK_SHARES,
    MAMMAL_LOOK,
    NECK_STRETCH_MAX,
    clipLookShare,
    fitMammalLook,
    lookOnRow,
    mammalLookClass,
    neckRegion,
    neckStretch,
    restRow,
    worstLook
} from "@/ark-scene/locomotion/neck-gate";
import {SIT_SHAPES, SitSleepPose, posedSitRows} from "@/ark-scene/locomotion/sit-sleep-pose";
import {rigLookShare} from "@/ark-scene/rig-player";

const FIXTURES = path.join(process.cwd(), "src/ark-scene/locomotion/fixtures");
const raws = readdirSync(FIXTURES)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(FIXTURES, f), "utf8")) as RawSkeleton);
const groundOf = (raw: RawSkeleton) => {
    let low = Infinity;
    for (let i = 1; i < raw.positions.length; i += 3) low = Math.min(low, raw.positions[i]);
    return low;
};

test("standing is not lying: the rest pose fails the gate at the rump", () => {
    for (const raw of raws) {
        const rig = buildLocoRig(raw);
        if (!lieShaped(rig)) continue;
        const m = measureLying(rig, raw, restRow(rig), groundOf(raw));
        assert.ok(Math.abs(m.rump - 1) < 1e-6 && Math.abs(m.shoulder - 1) < 1e-6, `${raw.slug}: its hips at their standing height`);
        assert.equal(m.ok, false);
        assert.match(m.reason ?? "", /rump at 100%/);
    }
});

test("a lying pose lifted off the ground fails at its ends; pitched nose down, at the rump against the shoulder", () => {
    const raw = raws.find((r) => r.slug === "red-deer")!;
    const rig = buildLocoRig(raw);
    const ground = groundOf(raw);
    const row = new LiePose(rig, raw).row(1, new Float32Array(rig.bones.length * 12));
    const lying = measureLying(rig, raw, row, ground);
    assert.ok(lying.rump < RUMP_HEIGHT && lying.shoulder < RUMP_HEIGHT, "the deer's hips come down");
    assert.ok(lying.rearGap <= END_GAP && lying.frontGap <= END_GAP, "both halves on the ground");
    // The same pose a tenth of its height up: both halves in the air.
    const up = row.slice();
    for (let b = 0; b < rig.bones.length; b++) up[b * 12 + 7] += rig.height * 0.1;
    const floating = measureLying(rig, raw, up, ground);
    assert.equal(floating.ok, false);
    assert.ok(floating.rearGap > END_GAP);
    // The standing pose with only the front let down (a bow): the rump stays up.
    const world = rig.bones.map((bone) => bone.restWorld.clone());
    const tilt = new Matrix4().makeRotationX(0.5);
    const bow = new Float32Array(rig.bones.length * 12);
    world.forEach((m, b) => {
        const e = new Matrix4().multiplyMatrices(tilt, m).multiply(rig.bones[b].restWorld.clone().invert()).elements;
        bow.set([e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]], b * 12);
    });
    assert.equal(measureLying(rig, raw, bow, ground).ok, false);
});

test("the legs' solved turn out never leaves a rig lying higher than the one fixed turn did", () => {
    for (const raw of raws) {
        const rig = buildLocoRig(raw);
        if (!lieShaped(rig)) continue;
        const ground = groundOf(raw);
        const per = rig.bones.length * 12;
        const solved = new LiePose(rig, raw);
        const fixed = new LiePose(rig, raw, undefined, false);
        assert.deepEqual(fixed.splay, rig.legs.map((leg) => LIE_SPLAY[leg.end === "fore" ? 0 : 1]));
        const a = measureLying(rig, raw, solved.row(1, new Float32Array(per)), ground);
        const b = measureLying(rig, raw, fixed.row(1, new Float32Array(per)), ground);
        assert.ok(a.rump <= b.rump + 0.02, `${raw.slug}: rump ${a.rump.toFixed(3)} solved, ${b.rump.toFixed(3)} fixed`);
        // Each pair turned out alike.
        for (const end of ["fore", "hind"]) assert.equal(new Set(rig.legs.flatMap((leg, li) => (leg.end === end ? [solved.splay[li]] : []))).size, 1);
    }
});

// A made neck: a tube along +z from the chest (z 0) through the neck (z 0.2) to the head (z 0.4 to 0.6), eight
// vertices a ring; the skin goes from one bone to the next over `blend` either side of each joint.
function tube(blend: number, radius = 0.08, plan = "quadruped") {
    const bones = ["hips", "chest", "neck", "head", "leg0L_upper", "leg0L_lower", "leg0L_foot", "leg0R_upper", "leg0R_lower", "leg0R_foot", "leg1L_upper", "leg1L_lower", "leg1L_foot", "leg1R_upper", "leg1R_lower", "leg1R_foot"];
    const at: Record<string, [number, number, number]> = {hips: [0, 0, -0.6], chest: [0, 0, 0], neck: [0, 0, 0.2], head: [0, 0, 0.4]};
    for (const [n, z] of [[0, 0], [1, -0.6]] as const) {
        for (const [side, x] of [["L", 0.1], ["R", -0.1]] as const) {
            at[`leg${n}${side}_upper`] = [x, 0, z];
            at[`leg${n}${side}_lower`] = [x, -0.2, z];
            at[`leg${n}${side}_foot`] = [x, -0.4, z];
        }
    }
    const parents = bones.map((name) => (name === "hips" ? null : name === "chest" ? "hips" : name === "neck" ? "chest" : name === "head" ? "neck" : name.endsWith("_upper") ? (name.startsWith("leg0") ? "chest" : "hips") : name.endsWith("_lower") ? name.replace("_lower", "_upper") : name.replace("_foot", "_lower")));
    const rest = bones.map((name) => Array.from(new Matrix4().makeTranslation(...at[name]).elements));
    const positions: number[] = [];
    const joints: number[] = [];
    const weights: number[] = [];
    const index: number[] = [];
    const rings = 25;
    const ramp = (z: number, joint: number) => Math.min(Math.max((z - joint) / (2 * blend) + 0.5, 0), 1);
    for (let r = 0; r < rings; r++) {
        const z = -0.6 + (1.2 * r) / (rings - 1);
        const toNeck = ramp(z, 0.2);
        const toHead = ramp(z, 0.4);
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            // (Its lowest point at the feet's level, so the mesh's ground is theirs.)
            positions.push(Math.cos(a) * radius, Math.sin(a) * radius + (r === 0 && k === 6 ? -0.32 : 0), z);
            joints.push(z < -0.3 ? 0 : 1, 2, 3, 0);
            weights.push(1 - toNeck, toNeck * (1 - toHead), toNeck * toHead, 0);
            if (r + 1 < rings) {
                const i = r * 8 + k;
                const j = r * 8 + ((k + 1) % 8);
                index.push(i, j, i + 8, j, j + 8, i + 8);
            }
        }
    }
    const raw: RawSkeleton = {slug: "tube", plan, pose: null, bones, parents, rest, positions, joints, weights};
    const rig = buildLocoRig(raw);
    const chain = {neck: bones.indexOf("neck"), head: bones.indexOf("head"), neckPivot: at.neck, headPivot: at.head};
    return {raw, rig, index, chain};
}

test("the look on a row: at rest the bones turn about their own joints, the head riding the neck", () => {
    const {rig, chain} = tube(0.05);
    const bones = rig.bones.length;
    const row = lookOnRow(restRow(rig), bones, chain, 0.5, Math.PI / 2, 0, new Float32Array(bones * 12));
    const point = (bone: number, p: [number, number, number]) => [0, 1, 2].map((r) => row[bone * 12 + r * 4] * p[0] + row[bone * 12 + r * 4 + 1] * p[1] + row[bone * 12 + r * 4 + 2] * p[2] + row[bone * 12 + r * 4 + 3]);
    // The neck's own joint stays; the head's joint swings 45 degrees to its left (+x) about the neck's.
    assert.ok(Math.hypot(...point(chain.neck, [0, 0, 0.2]).map((v, i) => v - [0, 0, 0.2][i])) < 1e-6);
    const joint = point(chain.head, [0, 0, 0.4]);
    assert.ok(Math.abs(joint[0] - 0.2 * Math.SQRT1_2) < 1e-6 && Math.abs(joint[2] - (0.2 + 0.2 * Math.SQRT1_2)) < 1e-6);
    // A point ahead of the head's joint ends 90 degrees round: straight out to its left of it.
    const nose = point(chain.head, [0, 0, 0.6]);
    assert.ok(Math.abs(nose[0] - joint[0] - 0.2) < 1e-6 && Math.abs(nose[2] - joint[2]) < 1e-6);
    // The chest and the legs are not turned.
    assert.deepEqual(Array.from(row.subarray(12, 24)), Array.from(restRow(rig).subarray(12, 24)));
});

test("a neck's stretch: none at rest, more the further it turns and the narrower its skin's blend", () => {
    const wide = tube(0.1);
    const narrow = tube(0.01);
    for (const t of [wide, narrow]) {
        const region = neckRegion(t.rig, t.raw, t.index)!;
        assert.ok(region.rest.length > 100);
        assert.ok(Math.abs(neckStretch(region, t.raw, restRow(t.rig)).max - 1) < 1e-5);
    }
    const at = (t: ReturnType<typeof tube>, yaw: number) => worstLook(neckRegion(t.rig, t.raw, t.index)!, t.raw, restRow(t.rig), t.rig.bones.length, t.chain, 0.45, {yaw, up: 0, down: 0}).p99;
    assert.ok(at(wide, 70) > at(wide, 30) && at(wide, 30) > 1);
    assert.ok(at(narrow, 70) > at(wide, 70), "a hard seam stretches further than a soft one");
});

test("a mammal's look: its class's caps when its neck takes them, lowered until it does when it does not", () => {
    assert.equal(mammalLookClass("primate", ["idle"]), "primate");
    assert.equal(mammalLookClass("quadruped", ["idle", "graze"]), "grazer");
    assert.equal(mammalLookClass("quadruped", ["idle", "browse"]), "grazer");
    assert.equal(mammalLookClass("quadruped", ["idle", "strike"]), "quadruped");
    assert.equal(mammalLookClass("flying_bird", ["idle"]), null);
    assert.deepEqual([MAMMAL_LOOK.primate.yaw, MAMMAL_LOOK.grazer.yaw, MAMMAL_LOOK.quadruped.yaw], [80, 60, 70]);
    const was = {caps: {yaw: 70, up: 30, down: 45}, neckShare: 0.45};
    const soft = tube(0.1);
    const fine = fitMammalLook(neckRegion(soft.rig, soft.raw, soft.index)!, soft.raw, soft.rig, soft.chain, "quadruped", was);
    assert.ok(fine.ok && fine.scale === 1 && fine.caps.yaw === 70, "a soft neck keeps the class's caps");
    assert.ok(fine.after <= fine.before + 1e-6 && fine.after <= NECK_STRETCH_MAX);
    const hard = tube(0.004, 0.14);
    const region = neckRegion(hard.rig, hard.raw, hard.index)!;
    const cut = fitMammalLook(region, hard.raw, hard.rig, hard.chain, "quadruped", was);
    assert.ok(cut.before > NECK_STRETCH_MAX, `a hard seam stretches ${cut.before.toFixed(2)} at 70 degrees`);
    assert.ok(cut.scale < 1 && cut.caps.yaw < 70, "its cap comes down");
    assert.ok(cut.after < cut.before);
    if (cut.ok) assert.ok(worstLook(region, hard.raw, restRow(hard.rig), hard.rig.bones.length, hard.chain, cut.neckShare, cut.caps).p99 <= NECK_STRETCH_MAX + 1e-3);
});

test("a clip's share of the look: all of it at rest, less on a pose that turns the head already", () => {
    const t = tube(0.03);
    const region = neckRegion(t.rig, t.raw, t.index)!;
    const bones = t.rig.bones.length;
    const fit = fitMammalLook(region, t.raw, t.rig, t.chain, "quadruped", {caps: {yaw: 70, up: 30, down: 45}, neckShare: 0.45});
    assert.equal(clipLookShare(region, t.raw, restRow(t.rig), bones, t.chain, fit.neckShare, fit.caps).share, fit.ok ? 1 : clipLookShare(region, t.raw, restRow(t.rig), bones, t.chain, fit.neckShare, fit.caps).share);
    // A pose with the head already turned as far as the look goes: the look on top would double it.
    const turned = lookOnRow(restRow(t.rig), bones, t.chain, fit.neckShare, (fit.caps.yaw * Math.PI) / 180, 0, new Float32Array(bones * 12));
    const held = clipLookShare(region, t.raw, turned, bones, t.chain, fit.neckShare, fit.caps);
    assert.ok(CLIP_LOOK_SHARES.includes(held.share));
    assert.ok(held.share < 1, `the turned pose takes ${held.share} of the look`);
    assert.ok(held.withLook <= Math.max(NECK_STRETCH_MAX, held.alone * 1.03) + 1e-6);
    // The scene's weight: the playing clip's share, the last clip's mixed in as it fades.
    const model = {clips: {idle: {}, sleep: {lookShare: 0}, groom: {lookShare: 0.3}}} as unknown as Parameters<typeof rigLookShare>[0];
    const play = (name: string) => ({name, phase: 0}) as unknown as NonNullable<Parameters<typeof rigLookShare>[1]>["now"];
    assert.equal(rigLookShare(model, null), 1);
    assert.equal(rigLookShare(model, {now: play("idle"), from: null, fade: 1}), 1);
    assert.equal(rigLookShare(model, {now: play("sleep"), from: null, fade: 1}), 0);
    assert.ok(Math.abs(rigLookShare(model, {now: play("sleep"), from: play("idle"), fade: 0.25}) - 0.75) < 1e-9);
    assert.ok(Math.abs(rigLookShare(model, {now: play("groom"), from: play("sleep"), fade: 1}) - 0.3) < 1e-9);
});

test("the posed sit's shapes: ARK-SLEEP's first, each next one bends the neck less; a rig keeps the first its neck takes", () => {
    assert.deepEqual(SIT_SHAPES[0], {back: 58, neck: 1, face: 70});
    for (const shape of SIT_SHAPES.slice(1)) assert.ok(shape.neck <= 0.25 && shape.face !== null && shape.face < 70 && shape.face > 0, "the neck a quarter or none, the face still down");
    const raw = raws.find((r) => r.slug === "chimpanzee")! as RawSkeleton & {positions: number[]; joints: number[]; weights: number[]};
    const rig = buildLocoRig(raw);
    // Every shape sits: on the ground, the back up.
    for (const shape of SIT_SHAPES) {
        const sit = new SitSleepPose(rig, raw, shape);
        assert.ok(sit.check.ok, JSON.stringify(shape));
        assert.ok((sit.check.up ?? 0) > 0.5, `${JSON.stringify(shape)}: the shoulders over the hips`);
    }
    // Without the mesh's triangles (no measure): the first shape, as before.
    const per = rig.bones.length * 12;
    const plain = posedSitRows(rig, raw, new Uint16Array(per * 2), rig.bones.length, DataUtils.toHalfFloat);
    assert.equal(plain.check.shape, undefined);
    // With them, on a made primate whose neck's skin is a hard seam: the first shape tears it, and it keeps a later one.
    const made = tube(0.01, 0.1, "primate");
    const madePer = made.rig.bones.length * 12;
    const fitted = posedSitRows(made.rig, made.raw, new Uint16Array(madePer * 2), made.rig.bones.length, DataUtils.toHalfFloat, made.index);
    assert.ok(fitted.data && fitted.check.shape, JSON.stringify(fitted.check));
    assert.ok(fitted.check.stretchFull! > NECK_STRETCH_MAX, `the full bow stretches the seam ${fitted.check.stretchFull!.toFixed(2)}`);
    assert.ok(fitted.check.stretch! < fitted.check.stretchFull!);
    assert.notEqual(fitted.check.shape, SIT_SHAPES[0]);
    assert.ok(SIT_SHAPES.some((shape) => shape === fitted.check.shape));
});
