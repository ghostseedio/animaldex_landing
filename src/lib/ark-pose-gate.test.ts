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
    HEAD_STRETCH_MAX,
    MAMMAL_LOOK,
    NECK_STRETCH_MAX,
    overLimit,
    clipLookShare,
    fitMammalLook,
    lookOnRow,
    mammalLookClass,
    neckRegion,
    neckStretch,
    restRow,
    worstLook
} from "@/ark-scene/locomotion/neck-gate";
import {REST_HEAD_TURNS, SIT_FACE_DEG, SIT_FULL_BOW, SIT_HEAD_LEVEL_DEG, SIT_SHAPES, SitSleepPose, posedSitRows} from "@/ark-scene/locomotion/sit-sleep-pose";
import {capHeadYawRows, yawFromChest} from "@/ark-scene/locomotion/bird-neck";
import {rowToWorld} from "@/ark-scene/locomotion/skeleton";
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
    const soft = tube(0.1, 0.04);
    const fine = fitMammalLook(neckRegion(soft.rig, soft.raw, soft.index)!, soft.raw, soft.rig, soft.chain, "quadruped", was);
    assert.ok(fine.ok && fine.scale === 1 && fine.caps.yaw === 70, `a soft neck keeps the class's caps: ${JSON.stringify(fine)}`);
    assert.ok(fine.after <= NECK_STRETCH_MAX && fine.headAfter <= HEAD_STRETCH_MAX);
    const hard = tube(0.004, 0.14);
    const region = neckRegion(hard.rig, hard.raw, hard.index)!;
    const cut = fitMammalLook(region, hard.raw, hard.rig, hard.chain, "quadruped", was);
    assert.ok(cut.before > NECK_STRETCH_MAX, `a hard seam stretches ${cut.before.toFixed(2)} at 70 degrees`);
    assert.ok(cut.scale < 1 && cut.caps.yaw < 70, "its cap comes down");
    assert.ok(cut.after < cut.before);
    if (cut.ok) assert.ok(overLimit(worstLook(region, hard.raw, restRow(hard.rig), hard.rig.bones.length, hard.chain, cut.neckShare, cut.caps)) <= 1 + 1e-3);
    // The face counts for itself: a head whose own skin is dragged by the neck fails with the neck inside its limit.
    assert.ok(overLimit({p99: 1.4, head: 1.38}) > 1 && overLimit({p99: 1.45, head: 1.15}) < 1);
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
    assert.ok(held.share === 0 || held.withLook <= Math.max(NECK_STRETCH_MAX, held.alone * 1.03) + 1e-6);
    // The scene's weight: the playing clip's share, the last clip's mixed in as it fades.
    const model = {clips: {idle: {}, sleep: {lookShare: 0}, groom: {lookShare: 0.3}}} as unknown as Parameters<typeof rigLookShare>[0];
    const play = (name: string) => ({name, phase: 0}) as unknown as NonNullable<Parameters<typeof rigLookShare>[1]>["now"];
    assert.equal(rigLookShare(model, null), 1);
    assert.equal(rigLookShare(model, {now: play("idle"), from: null, fade: 1}), 1);
    assert.equal(rigLookShare(model, {now: play("sleep"), from: null, fade: 1}), 0);
    assert.ok(Math.abs(rigLookShare(model, {now: play("sleep"), from: play("idle"), fade: 0.25}) - 0.75) < 1e-9);
    assert.ok(Math.abs(rigLookShare(model, {now: play("groom"), from: play("sleep"), fade: 1}) - 0.3) < 1e-9);
});

test("a clip's own head turn: a row past the look's cap comes back to it, one within it is left as it is", () => {
    const {rig, chain} = tube(0.05);
    const bones = rig.bones.length;
    const per = bones * 12;
    const rows = [20, 50, 75, -75].map((deg) => lookOnRow(restRow(rig), bones, chain, 0.4, (deg * Math.PI) / 180, 0, new Float32Array(per)));
    const data = new Uint16Array(rows.length * per);
    rows.forEach((row, r) => row.forEach((v, i) => (data[r * per + i] = DataUtils.toHalfFloat(v))));
    const before = data.slice();
    const done = capHeadYawRows(rig, data, bones, 60);
    assert.equal(done.changed, 2);
    assert.ok(Math.abs(done.worstBefore - 75) < 0.5 && Math.abs(done.worstAfter - 60) < 0.5);
    assert.deepEqual(Array.from(data.subarray(0, 2 * per)), Array.from(before.subarray(0, 2 * per)), "20 and 50 degrees untouched");
    const world = rig.bones.map(() => new Matrix4());
    const yawOf = (r: number, bone: number) => {
        rowToWorld(rig, Float32Array.from(data.subarray(r * per, (r + 1) * per), (h) => DataUtils.fromHalfFloat(h)), 0, world);
        return (yawFromChest(rig, world, rig.chest, bone)! * 180) / Math.PI;
    };
    assert.ok(Math.abs(Math.abs(yawOf(2, rig.head)) - 60) < 0.5 && Math.abs(Math.abs(yawOf(3, rig.head)) - 60) < 0.5, "75 either way comes back to 60");
    assert.ok(yawOf(2, rig.head) * yawOf(3, rig.head) < 0, "each to its own side");
    // The neck keeps its share of the turn (0.4 of it).
    assert.ok(Math.abs(Math.abs(yawOf(2, rig.neck)) - 24) < 0.5);
});

test("the posed sit: the head ends level and facing ahead, its turn split between the neck and the head; a model's own head turn is taken back", () => {
    for (const shape of SIT_SHAPES) assert.ok(shape.level && shape.back === 58 && shape.face === SIT_FACE_DEG && shape.neck >= 0 && shape.neck <= 0.8, JSON.stringify(shape));
    assert.deepEqual(SIT_FULL_BOW, {back: 58, neck: 1, face: 70});
    const raw = raws.find((r) => r.slug === "chimpanzee")! as RawSkeleton & {positions: number[]; joints: number[]; weights: number[]};
    const rig = buildLocoRig(raw);
    // Every shape sits on the ground with the back up, and the head level: its face `SIT_FACE_DEG` below the horizon, straight ahead.
    for (const shape of SIT_SHAPES) {
        const sit = new SitSleepPose(rig, raw, shape);
        assert.ok(sit.check.ok, JSON.stringify(shape));
        assert.ok((sit.check.up ?? 0) > 0.5, `${JSON.stringify(shape)}: the shoulders over the hips`);
        assert.ok(Math.abs(sit.check.headPitch! + SIT_FACE_DEG) < 0.01 && Math.abs(sit.check.headYaw!) < 0.01, `${JSON.stringify(shape)}: head pitch ${sit.check.headPitch}, yaw ${sit.check.headYaw}`);
        assert.ok(Math.abs(sit.check.headPitch!) <= SIT_HEAD_LEVEL_DEG);
    }
    // ARK-SLEEP's own sit (what plays with no triangles to measure by) drops the face far below level.
    assert.ok(new SitSleepPose(rig, raw).check.headPitch! < -SIT_HEAD_LEVEL_DEG);
    const per = rig.bones.length * 12;
    const plain = posedSitRows(rig, raw, new Uint16Array(per * 2), rig.bones.length, DataUtils.toHalfFloat);
    assert.equal(plain.check.shape, undefined);
    // A model whose head was turned 40 degrees to its right and 20 up at rest: sitting, the turn is taken back.
    for (const unturn of [1, 0.5]) {
        const sit = new SitSleepPose(rig, raw, {...SIT_SHAPES[0], unturn}, {yaw: -40, pitch: 20});
        assert.ok(Math.abs(sit.check.headYaw! - -40 * (1 - unturn)) < 3, `unturn ${unturn}: yaw ${sit.check.headYaw}`);
        if (unturn === 1) assert.ok(Math.abs(sit.check.headPitch! + SIT_FACE_DEG) < 0.5, `pitch ${sit.check.headPitch}`);
    }
    // With the mesh's triangles, on a made primate: the fit says which split it keeps, and its head is level.
    const made = tube(0.01, 0.1, "primate");
    const madePer = made.rig.bones.length * 12;
    const fitted = posedSitRows(made.rig, made.raw, new Uint16Array(madePer * 2), made.rig.bones.length, DataUtils.toHalfFloat, made.index);
    assert.ok(fitted.data && fitted.check.shape, JSON.stringify(fitted.check));
    assert.ok(SIT_SHAPES.some((shape) => shape === fitted.check.shape));
    assert.ok(Math.abs(fitted.check.headPitch! + SIT_FACE_DEG) < 0.01);
    // The models in the table are primates the scene has, their turns within what a neck can take back.
    for (const [slug, turn] of Object.entries(REST_HEAD_TURNS)) assert.ok(/^[a-z0-9-]+$/.test(slug) && Math.abs(turn.yaw) <= 90 && Math.abs(turn.pitch) <= 30, slug);
});
