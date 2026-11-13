import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {Euler, Matrix4, Quaternion, Vector3} from "three";
import {buildLocoRig, restInverses, rowToWorld, type RawSkeleton} from "@/ark-scene/locomotion/skeleton";
import type {LocoInput, LocoRig} from "@/ark-scene/locomotion/types";
import {chainDriver, flightDriver, OPEN_WING_RIGS} from "@/ark-scene/locomotion/l2-drivers";
import {LEGLESS} from "@/ark-scene/locomotion/legless";
import {MOTION_L2_THRESHOLDS} from "@/lib/ark-motion-l2-thresholds";

// Lane L2's drivers on real rigs from the v2 set (fixtures: scripts/ark-l2-rig-fixtures.mts): the upstroke fold the
// published flap lacks, the head level in a bank, an open-winged insect's beat, no slip on a snake rig, a whale's
// flukes. Thresholds: src/lib/ark-motion-l2-thresholds.ts.

type Fixture = RawSkeleton & {clips: Record<string, {seconds: number; flap_hz?: number; rows: number[][]}>};
const fixture = (slug: string): Fixture => JSON.parse(fs.readFileSync(path.join(__dirname, "__fixtures__/ark-l2", `${slug}.json`), "utf8"));
const rigOf = (f: Fixture): LocoRig => buildLocoRig(f);

/** The clip's world poses at a phase (rows interpolated as the shader blends them). */
function clipWorld(rig: LocoRig, f: Fixture, clip: string, phase: number): Matrix4[] {
    const rows = f.clips[clip].rows;
    const frames = rows.length - 1;
    const at = (((phase % 1) + 1) % 1) * frames;
    const i = Math.floor(at);
    const t = at - i;
    const a = rows[i];
    const b = rows[Math.min(i + 1, frames)];
    const row = a.map((v, k) => v * (1 - t) + b[k] * t);
    const world = rig.bones.map(() => new Matrix4());
    rowToWorld(rig, row, 0, world);
    return world;
}

/** The skinned positions of the vertices whose strongest bone is one of `bones`. */
function skinned(rig: LocoRig, f: Fixture, world: Matrix4[], bones: number[]): Vector3[] {
    const inv = restInverses(rig);
    const skin = world.map((m, b) => new Matrix4().multiplyMatrices(m, inv[b]));
    const out: Vector3[] = [];
    const n = f.positions.length / 3;
    for (let i = 0; i < n; i++) {
        let best = -1;
        let bw = -1;
        for (let k = 0; k < 4; k++) if (f.weights[i * 4 + k] > bw) (bw = f.weights[i * 4 + k]), (best = f.joints[i * 4 + k]);
        if (!bones.includes(best)) continue;
        const v = new Vector3(f.positions[i * 3], f.positions[i * 3 + 1], f.positions[i * 3 + 2]);
        const acc = new Vector3();
        for (let k = 0; k < 4; k++) {
            const w = f.weights[i * 4 + k];
            if (w > 0) acc.addScaledVector(v.clone().applyMatrix4(skin[f.joints[i * 4 + k]]), w);
        }
        out.push(acc);
    }
    return out;
}

const input = (over: Partial<LocoInput>): LocoInput => ({
    instance: new Matrix4(),
    scale: 1,
    yaw: 0,
    dt: 1 / 60,
    clock: 10,
    seed: 0.3,
    ground: () => ({height: 0, nx: 0, ny: 1, nz: 0}),
    grounded: false,
    clipNow: "flap",
    clipFrom: null,
    clipPhase: 0,
    ...over
});

const span = (points: Vector3[]) => points.reduce((m, p) => Math.max(m, Math.abs(p.x)), 0);

test("L2 metric (rigs): the hand and forearm flex on the upstroke (the published flap has the same span both ways)", () => {
    for (const slug of ["mallard", "golden-eagle"]) {
        const f = fixture(slug);
        const rig = rigOf(f);
        const hand = [rig.bones.findIndex((b) => b.name === "wingL_hand")];
        const before = (q: number) => span(skinned(rig, f, clipWorld(rig, f, "flap", q), hand));
        const after = (q: number) => {
            const world = clipWorld(rig, f, "flap", q);
            flightDriver.pose(rig, input({clipNow: "flap", clipPhase: q}), world, flightDriver.init(rig));
            return span(skinned(rig, f, world, hand));
        };
        const ratioBefore = before(0.75) / before(0.25);
        const ratioAfter = after(0.75) / after(0.25);
        assert.ok(Math.abs(ratioBefore - 1) < 0.02, `${slug}: the published flap's span ratio up/down ${ratioBefore.toFixed(3)}`);
        assert.ok(ratioAfter < MOTION_L2_THRESHOLDS.upstrokeSpanRatioMax, `${slug}: upstroke/downstroke span ${ratioAfter.toFixed(3)}`);
        assert.ok(Math.abs(after(0.25) - before(0.25)) < 1e-6, `${slug}: the downstroke is the clip's own, full span`);
    }
});

test("L2 metric (rigs): the head stays level with the horizon in a bank", () => {
    const f = fixture("golden-eagle");
    const rig = rigOf(f);
    const roll = 0.5;
    const instance = new Matrix4().makeRotationFromEuler(new Euler(0, 0, roll));
    // The head's roll in the world: how far its left (+x at rest) dips below or rises above the horizon.
    const headUp = (world: Matrix4[]) => {
        const m = new Matrix4().multiplyMatrices(instance, new Matrix4().multiplyMatrices(world[rig.head], restInverses(rig)[rig.head]));
        const left = new Vector3(1, 0, 0).transformDirection(m);
        return Math.abs(Math.asin(Math.min(Math.max(left.y, -1), 1)));
    };
    const world = clipWorld(rig, f, "glide", 0.3);
    const tiltBefore = headUp(world);
    flightDriver.pose(rig, input({clipNow: "glide", instance}), world, flightDriver.init(rig));
    const tiltAfter = headUp(world);
    assert.ok(tiltBefore > roll * 0.8, `before ${tiltBefore}`);
    assert.ok(tiltAfter < tiltBefore * 0.45, `the head's tilt ${tiltBefore.toFixed(3)} -> ${tiltAfter.toFixed(3)}`);
});

test("L2 metric (rigs): an insect holding open wings (no flap of its own) has them beaten", () => {
    const f = fixture("monarch-butterfly");
    const rig = rigOf(f);
    OPEN_WING_RIGS.add("monarch-butterfly");
    const hand = [rig.bones.findIndex((b) => b.name === "wingL_hand")];
    const tipHeight = (clock: number) => {
        const world = clipWorld(rig, f, "glide", 0);
        flightDriver.pose(rig, input({clipNow: "glide", clock, seed: 0}), world, flightDriver.init(rig));
        const pts = skinned(rig, f, world, hand);
        return pts.reduce((s, p) => s + p.y, 0) / pts.length;
    };
    const heights: number[] = [];
    for (let t = 0; t < 1; t += 0.02) heights.push(tipHeight(t));
    const range = Math.max(...heights) - Math.min(...heights);
    assert.ok(range > MOTION_L2_THRESHOLDS.insectStrokeMin, `wing tip rises and falls ${range.toFixed(3)} model units`);
});

/** A chain rig driven forward along +z at `speed` (model units a second) for `seconds`: each chain bone's world path. */
function crawl(slug: string, clip: "slither" | "swim", speed: number, seconds: number) {
    const f = fixture(slug);
    const rig = rigOf(f);
    const state = chainDriver.init(rig);
    const paths: Array<Array<{x: number; y: number; z: number}>> = rig.chain.map(() => []);
    const dt = 1 / 60;
    let ms = 0;
    for (let t = 0; t < seconds; t += dt) {
        const instance = new Matrix4().makeTranslation(0, 0, speed * t);
        const world = rig.bones.map((b) => b.restWorld.clone());
        const started = performance.now();
        chainDriver.pose(rig, input({instance, clipNow: clip, clipPhase: 0, dt, clock: t, grounded: true}), world, state);
        ms += performance.now() - started;
        rig.chain.forEach((b, k) => {
            const p = new Vector3().setFromMatrixPosition(world[b]);
            paths[k].push({x: p.x, y: p.y, z: p.z + speed * t});
        });
    }
    return {rig, paths, msPerPose: ms / Math.round(seconds / dt)};
}

test("L2 metric (rigs): a snake's chain follows its own track (no slip), and costs little", () => {
    const speed = 0.3;
    const {paths, msPerPose} = crawl("eastern-green-mamba", "slither", speed, 8);
    // Each chain point's sideways offset where it is now against the front's when the front was there.
    const head = paths[0];
    const lateralAt = (z: number) => {
        for (let i = 1; i < head.length; i++) if (head[i].z >= z) {
            const a = head[i - 1];
            const b = head[i];
            const t = (z - a.z) / Math.max(b.z - a.z, 1e-9);
            return a.x + (b.x - a.x) * t;
        }
        return null;
    };
    let sum = 0;
    let n = 0;
    let swing = 0;
    for (let k = 2; k < paths.length; k++) {
        for (let i = Math.floor(paths[k].length / 2); i < paths[k].length; i++) {
            const p = paths[k][i];
            const was = lateralAt(p.z);
            if (was === null) continue;
            sum += Math.abs(p.x - was);
            n++;
            swing = Math.max(swing, Math.abs(p.x));
        }
    }
    const slip = sum / n / Math.max(swing, 1e-6);
    assert.ok(swing > LEGLESS.lateral.side * 0.5, `it undulates (${swing.toFixed(3)})`);
    assert.ok(slip < MOTION_L2_THRESHOLDS.rigSlipMax, `slip ${slip.toFixed(3)} of the swing`);
    assert.ok(msPerPose < MOTION_L2_THRESHOLDS.poseMsMax, `${msPerPose.toFixed(4)} ms a pose`);
});

test("L2 metric (rigs): a sidewinder lifts part of its body; a whale beats its flukes up and down, faster when faster", () => {
    const side = crawl("sidewinder", "slither", 0.3, 4);
    const lifts = side.paths.map((p) => Math.max(...p.slice(60).map((q) => q.y)) - Math.min(...p.slice(60).map((q) => q.y)));
    assert.ok(Math.max(...lifts) > 0.01, `lift ${Math.max(...lifts).toFixed(3)}`);
    const whale = (speed: number) => {
        const out = crawl("blue-whale", "swim", speed, 6);
        const tail = out.paths[out.paths.length - 1].slice(120);
        const ys = tail.map((p) => p.y);
        const xs = tail.map((p) => p.x);
        let crossings = 0;
        const mid = (Math.max(...ys) + Math.min(...ys)) / 2;
        for (let i = 1; i < ys.length; i++) if ((ys[i - 1] - mid) * (ys[i] - mid) < 0) crossings++;
        return {up: Math.max(...ys) - Math.min(...ys), side: Math.max(...xs) - Math.min(...xs), crossings};
    };
    const slow = whale(0.15);
    const fast = whale(0.45);
    assert.ok(slow.up > 0.05 && slow.up > slow.side * 3, `flukes up and down ${slow.up.toFixed(3)}, sideways ${slow.side.toFixed(3)}`);
    assert.ok(fast.crossings > slow.crossings * 1.8, `beats ${slow.crossings} -> ${fast.crossings}`);
});

test("MA1/v7: on a v7 flap (MA2's v3 birds) the driver adds no upstroke fold of its own: the clip bakes it; v2 as before", () => {
    const f = fixture("mallard");
    const rig = rigOf(f);
    const hand = [rig.bones.findIndex((b) => b.name === "wingL_hand")];
    const v7 = {downstroke: 0.55, tuck: 1, liftoff: null, touchdown: null, riseH: null};
    for (const q of [0.6, 0.75, 0.9]) {
        const bare = span(skinned(rig, f, clipWorld(rig, f, "flap", q), hand));
        const world7 = clipWorld(rig, f, "flap", q);
        flightDriver.pose(rig, input({clipNow: "flap", clipPhase: q, clipBake: v7}), world7, flightDriver.init(rig));
        const world2 = clipWorld(rig, f, "flap", q);
        flightDriver.pose(rig, input({clipNow: "flap", clipPhase: q}), world2, flightDriver.init(rig));
        assert.ok(Math.abs(span(skinned(rig, f, world7, hand)) - bare) < 1e-6, `v7 at ${q}: the clip's own hand`);
        assert.ok(span(skinned(rig, f, world2, hand)) < bare - 1e-4, `v2 at ${q}: the driver's fold, as before`);
    }
});
