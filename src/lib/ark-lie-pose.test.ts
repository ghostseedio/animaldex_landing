/**
 * ARK-ANIM round 3 (decision 447): the lying rest posed from the skeleton (`locomotion/lie-pose.ts`) on the real rigs'
 * skeletons (src/ark-scene/locomotion/fixtures/). The fixtures carry a sample of each mesh, so the gate's belly measure
 * (the whole mesh's underside) is checked on the published rigs by the scan (`scripts/ark-lie-scan.mts`), not here.
 */

import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {BufferAttribute, BufferGeometry, DataUtils, Matrix4, Vector3} from "three";
import {buildLocoRig, bonePointNow, type RawSkeleton} from "@/ark-scene/locomotion/skeleton";
import {LIE_FRAMES, LiePose, lieShaped} from "@/ark-scene/locomotion/lie-pose";
import {clipBase, posedLieClips, posedLieRows} from "@/ark-scene/rig-player";
import {QUADRUPED_LYING_HELD} from "@/ark-scene/rig-clips";
import {clipDrawsSleep, sleepPostureClips, sleepsOnFeet, type SleepPosture} from "@/ark-scene/sleep";

const FIXTURES = path.join(process.cwd(), "src/ark-scene/locomotion/fixtures");
const raws = readdirSync(FIXTURES)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(FIXTURES, f), "utf8")) as RawSkeleton);
const at = (m: Matrix4) => new Vector3(m.elements[12], m.elements[13], m.elements[14]);

test("only four standing legs take the posed lie: the quadrupeds, not the birds, the insects or the primates", () => {
    const shaped = raws.filter((raw) => lieShaped(buildLocoRig(raw))).map((raw) => raw.slug);
    assert.deepEqual(shaped, ["african-bush-elephant", "african-lion", "brown-bear", "cheetah", "domestic-dog", "giraffe", "house-mouse", "plains-zebra", "red-deer"]);
});

test("lying, each leg folds below its hip and the body comes down; nothing goes under the rest pose's ground", () => {
    for (const raw of raws) {
        const rig = buildLocoRig(raw);
        if (!lieShaped(rig)) continue;
        const lie = new LiePose(rig, raw);
        const world = lie.pose(1, rig.bones.map(() => new Matrix4()));
        const rest = rig.bones.map((bone) => bone.restWorld);
        assert.ok(at(world[rig.hips]).y < at(rest[rig.hips]).y - rig.height * 0.1, `${raw.slug}: the hips come down`);
        for (const leg of rig.legs) {
            const hip = at(world[leg.upper]).y + rig.height * 0.05;
            const sole = bonePointNow(rig, world, leg.foot, leg.contact, new Vector3()).y;
            assert.ok(Math.max(at(world[leg.lower]).y, at(world[leg.foot]).y, sole) <= hip, `${raw.slug} ${leg.key}: folded below its hip`);
        }
        assert.ok(lie.check.sink < 0.01, `${raw.slug}: ${(lie.check.sink * 100).toFixed(1)}% under the ground`);
    }
});

test("the way down never hops: from standing the hips go down, never up by more than a little (a foot turning under)", () => {
    const raw = raws.find((r) => r.slug === "brown-bear")!;
    const rig = buildLocoRig(raw);
    const lie = new LiePose(rig, raw);
    const ys = Array.from({length: LIE_FRAMES + 1}, (_, k) => at(lie.pose(k / LIE_FRAMES, rig.bones.map(() => new Matrix4()))[rig.hips]).y);
    assert.ok(Math.abs(ys[0] - at(rig.bones[rig.hips].restWorld).y) < 1e-6, "t 0 is the rest pose");
    for (let k = 1; k < ys.length; k++) assert.ok(ys[k] <= ys[0] + rig.height * 0.02, `step ${k}: up ${((ys[k] - ys[0]) / rig.height * 100).toFixed(1)}%`);
    assert.ok(ys[LIE_FRAMES] < ys[0] - rig.height * 0.1, "and down at the end");
});

test("a rig that passes gets lie_down, get_up, lie and sleep rows after its own; one that fails gets none", () => {
    const raw = raws.find((r) => r.slug === "brown-bear")!;
    const rig = buildLocoRig(raw);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(Float32Array.from(raw.positions), 3));
    geometry.setAttribute("arkJoints", new BufferAttribute(Uint8Array.from(raw.joints), 4));
    geometry.setAttribute("arkWeights", new BufferAttribute(Float32Array.from(raw.weights), 4));
    const bones = rig.bones.length;
    const own = 3;
    const data = new Uint16Array(own * bones * 12).fill(DataUtils.toHalfFloat(0));
    const posed = posedLieRows(rig, geometry, data, bones);
    // (The fixture's mesh is a sample: its belly reads high, so the gate holds it back.)
    if (!posed.check.ok) {
        assert.equal(posed.rows, null);
        return;
    }
    const rows = posed.rows!;
    assert.deepEqual(rows.clips.map((c) => [c.name, c.row, c.rows, c.loop]), [
        ["lie_down", own, LIE_FRAMES + 1, false],
        ["get_up", own + LIE_FRAMES + 1, LIE_FRAMES + 1, false],
        ["lie", own + 2 * (LIE_FRAMES + 1), 2, true],
        ["sleep", own + 2 * (LIE_FRAMES + 1), 2, true]
    ]);
    assert.equal(rows.data.length, (own + 2 * (LIE_FRAMES + 1) + 2) * bones * 12);
});

test("at night a posed-lie species lies down, not stands (ARK-CONTACT's stand-sleep gives way to the posed lie)", () => {
    // A four-legged rig's clips as the page holds them: its own lying clips gone (QUADRUPED_LYING_HELD), the posed lie's in.
    const own: Record<string, {name: string; base?: string}> = {idle: {name: "idle"}, walk: {name: "walk"}, sleep: {name: "sleep", base: "lying"}};
    QUADRUPED_LYING_HELD.forEach((name) => delete own[name]);
    const posed = {...own, ...Object.fromEntries(posedLieClips(3).map((c) => [c.name, c]))};
    const night = (clips: Record<string, {base?: string}>, posture: SleepPosture) => {
        const want = sleepPostureClips(posture).find((name) => clips[name]) ?? "idle";
        const sleepClipped = clipDrawsSleep(want, clipBase(clips[want]));
        const base = {slept: true, rigged: true, sleepClipped, water: false, lying: true, flat: false, legsUnder: true};
        return {want, sleepClipped, faded: sleepsOnFeet({...base, clipShare: 1}), fading: sleepsOnFeet({...base, clipShare: 0.05})};
    };
    for (const posture of ["sternal", "side", "curl", "sit"] as const) {
        const lies = night(posed, posture);
        assert.equal(lies.want, "sleep", `${posture}: the posed sleep plays`);
        assert.ok(lies.sleepClipped, `${posture}: the posed sleep draws the posture`);
        assert.equal(lies.faded, false, `${posture}: lies, not stands`);
        assert.equal(lies.fading, false, `${posture}: lies as soon as the rig shows`);
        for (const way of ["lie_down", "get_up"]) assert.ok(clipDrawsSleep(way, clipBase(posed[way])), `${way} is drawn by the rig`);
        // Without the posed lie (its lying clips held, idle plays): ARK-CONTACT's sleep on its feet.
        const stands = night(own, posture);
        assert.equal(stands.want, "idle");
        assert.equal(stands.faded, true, `${posture}: with no lying clip it sleeps on its feet`);
    }
});
