/**
 * The locomotion layer for one species' rig: each frame, per rigged animal, the baked clip's frame (as the shader
 * would blend it) is the base; the first driver that takes the animal poses it (legged gaits here; flight, swim and
 * legless from lane L2); otherwise the clip plays with its feet planted on the ground (`plantClipFeet`). The result
 * goes into the species' live pose texture at the instance's row.
 *
 * Switching between a driver and the clip cross-fades over a quarter of a second, on the CPU.
 */

import {Matrix4, Quaternion, Vector3} from "three";
import {leggedDriver} from "@/ark-scene/locomotion/legged";
import {restPole, solveLeg} from "@/ark-scene/locomotion/ik";
import {createLivePose, type LivePose} from "@/ark-scene/locomotion/pose-texture";
import {boneOrder, rowToWorld, skinRow} from "@/ark-scene/locomotion/skeleton";
import type {GaitState, LocoDriver, LocoInput, LocoRig} from "@/ark-scene/locomotion/types";

// MARK: Drivers

const drivers: LocoDriver[] = [leggedDriver];

/** Add a driver (L2: flight, swim, legless). Earlier drivers are asked first; `first` puts it before the others. */
export function registerLocoDriver(driver: LocoDriver, first = true) {
    const at = drivers.findIndex((d) => d.name === driver.name);
    if (at >= 0) drivers.splice(at, 1);
    if (first) drivers.unshift(driver);
    else drivers.push(driver);
}

export function locoDrivers(): readonly LocoDriver[] {
    return drivers;
}

// MARK: The baked rows

const HALF = (() => {
    const out = new Float32Array(65536);
    for (let h = 0; h < 65536; h++) {
        const s = h & 0x8000 ? -1 : 1;
        const e = (h >> 10) & 0x1f;
        const f = h & 0x3ff;
        out[h] = e === 0 ? s * 2 ** -14 * (f / 1024) : e === 31 ? (f ? NaN : s * Infinity) : s * 2 ** (e - 15) * (1 + f / 1024);
    }
    return out;
})();

/** A clip's rows at a phase: [row, next row, how far between] (rig-player `clipRows`). */
export type ClipRows = readonly [number, number, number];

/**
 * The baked frame as the shader blends it: clip A at its rows, faded with clip B (`fromWeight` of B), into `out`
 * (per bone 12 floats). Half floats from the rig's bone data.
 */
export function bakedRow(data: Uint16Array, bones: number, a: ClipRows | null, b: ClipRows | null, fromWeight: number, out: Float32Array): void {
    const n = bones * 12;
    if (!a) {
        // The rest pose: identity rows.
        for (let i = 0; i < bones; i++) out.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], i * 12);
        return;
    }
    const wb = b ? Math.min(Math.max(fromWeight, 0), 1) : 0;
    const a0 = a[0] * n, a1 = a[1] * n, at = a[2];
    const b0 = b ? b[0] * n : 0, b1 = b ? b[1] * n : 0, bt = b ? b[2] : 0;
    for (let i = 0; i < n; i++) {
        let v = HALF[data[a0 + i]] * (1 - at) + HALF[data[a1 + i]] * at;
        if (wb > 0) v = v * (1 - wb) + (HALF[data[b0 + i]] * (1 - bt) + HALF[data[b1 + i]] * bt) * wb;
        out[i] = v;
    }
}

// MARK: Feet on the ground under a clip

/** Clips whose feet are not on the ground (or that place the body themselves): no planting. */
export const CLIP_NO_PLANT: ReadonlySet<string> = new Set([
    "leap", "takeoff", "land", "flap", "glide", "soar", "bank_l", "bank_r", "hover", "enter_water", "exit_water", "dive", "plunge", "upend", "paddle", "swim", "surface",
    "slither", "climb", "hang", "perch", "burrow", "emerge", "bound", "drop", "rise", "sleep_hang", "sleep_float", "roll", "wallow", "lie", "lie_down", "get_up", "get_up_fast",
    "side_down", "side_up", "sleep_side", "sleep_curl", "bask", "dust_bathe", "sleep"
]);

const tA = new Vector3();
const tB = new Vector3();
const tN = new Vector3();
const qBody = new Quaternion();
const qRest = new Quaternion();
const mTmp = new Matrix4();
const instInv = new Matrix4();
const footRot = new Quaternion();

/**
 * A clip on its feet on uneven ground: each foot's sole moved to the ground under it (keeping however high the clip
 * lifts it), the body lowered if one can't reach, then IK. Changes `world` (mesh space).
 */
export function plantClipFeet(rig: LocoRig, input: LocoInput, world: Matrix4[], poles: Vector3[]): void {
    if (!rig.legs.length) return;
    instInv.copy(input.instance).invert();
    const hips = rig.hips >= 0 ? rig.hips : 0;
    qBody.setFromRotationMatrix(mTmp.extractRotation(world[hips])).multiply(qRest.setFromRotationMatrix(mTmp.extractRotation(rig.bones[hips].restWorld)).invert());
    const targets: Vector3[] = [];
    let deficit = 0;
    for (const leg of rig.legs) {
        // The sole now (mesh), through the foot's bone.
        const sole = new Vector3(leg.contact[0], leg.contact[1], leg.contact[2]).applyMatrix4(mTmp.copy(rig.bones[leg.foot].restWorld).invert()).applyMatrix4(world[leg.foot]);
        const lifted = Math.max(sole.y - leg.contact[1], 0);
        const w = tA.copy(sole).applyMatrix4(input.instance);
        const g = input.ground(w.x, w.z);
        // A foot the clip (or the act's attitude) holds well off the ground stays where it is: a rearing front, a raised paw.
        if (w.y - g.height > 0.25 * rig.legHeight * input.scale) {
            targets.push(new Vector3().setFromMatrixPosition(world[leg.foot]));
            continue;
        }
        w.y = g.height + lifted * input.scale;
        const target = w.clone().applyMatrix4(instInv);
        // The ankle above the sole as the clip holds it.
        const ankle = tB.setFromMatrixPosition(world[leg.foot]);
        target.add(tN.subVectors(ankle, sole));
        targets.push(target);
        const hip = tB.setFromMatrixPosition(world[leg.upper]);
        const reach = (leg.upperLength + leg.lowerLength) * 0.97;
        const flat = Math.hypot(hip.x - target.x, hip.z - target.z);
        const need = hip.y - target.y;
        const can = Math.sqrt(Math.max(reach * reach - flat * flat, 0));
        if (need > can) deficit = Math.max(deficit, need - can);
    }
    if (deficit > 1e-6) {
        const drop = Math.min(deficit, 0.3 * rig.legHeight);
        for (const i of [hips, ...rig.below[hips]]) world[i].elements[13] -= drop;
    }
    rig.legs.forEach((leg, i) => {
        footRot.setFromRotationMatrix(mTmp.extractRotation(world[leg.foot]));
        const pole = poles[i].clone().applyQuaternion(qBody);
        solveLeg(leg, world, targets[i], pole);
        const at = tA.setFromMatrixPosition(world[leg.foot]);
        world[leg.foot].makeRotationFromQuaternion(footRot).setPosition(at);
    });
}

// MARK: The layer

const wingA = new Matrix4();
const wingB = new Matrix4();
const wingS = new Matrix4();
/** One bone's mesh-space pose in a baked row (rest pose to the frame, 3×4 per bone): skin · rest, as `rowToWorld`. */
function bakedWorldOf(rig: LocoRig, row: ArrayLike<number>, bone: number, out: Matrix4): Matrix4 {
    const o = bone * 12;
    wingS.set(row[o], row[o + 1], row[o + 2], row[o + 3], row[o + 4], row[o + 5], row[o + 6], row[o + 7], row[o + 8], row[o + 9], row[o + 10], row[o + 11], 0, 0, 0, 1);
    return out.multiplyMatrices(wingS, rig.bones[bone].restWorld);
}

/** An animal's locomotion state on its rig (kept on its rig state while it stays rigged). */
export type LocoAnimal = {
    driver: string | null;
    states: Map<string, {state: unknown; at: number}>;
    /** The driver's share against the clip, eased. */
    share: number;
    gait: GaitState | null;
};

export const newLocoAnimal = (): LocoAnimal => ({driver: null, states: new Map(), share: 0, gait: null});

export const LOCO_FADE_SECONDS = 0.25;

export class LocoLayer {
    readonly live: LivePose;
    private readonly order: number[];
    private readonly world: Matrix4[];
    private readonly world2: Matrix4[];
    private readonly baked: Float32Array;
    private readonly rowA: Float32Array;
    private readonly rowB: Float32Array;
    private readonly poles: Vector3[];
    /** Its wing bones (both sides, each with everything it carries), every parent before its children. */
    private readonly wingBones: number[];
    /** Time spent posing this frame and in total (ms), for the performance report. */
    ms = 0;
    calls = 0;

    constructor(readonly rig: LocoRig, private readonly data: Uint16Array) {
        const n = rig.bones.length;
        this.live = createLivePose(n);
        this.order = boneOrder(rig);
        this.world = rig.bones.map(() => new Matrix4());
        this.world2 = rig.bones.map(() => new Matrix4());
        this.baked = new Float32Array(n * 12);
        this.rowA = new Float32Array(n * 12);
        this.rowB = new Float32Array(n * 12);
        this.poles = rig.legs.map((leg) => new Vector3(...restPole(rig, leg)));
        const winged = new Set<number>();
        for (const root of [rig.wings.left[0], rig.wings.right[0]]) {
            if (root === undefined || root < 0) continue;
            winged.add(root);
            for (const below of rig.below[root]) winged.add(below);
        }
        this.wingBones = this.order.filter((i) => winged.has(i) && rig.bones[i].parent >= 0);
    }

    /**
     * Pose one animal into live row `row`: its clip (rows A, and B fading out by `fromWeight`) as the base, then the
     * driver that takes it. Returns its gait state (null on the clip). False row (past the texture): nothing written.
     */
    pose(animal: LocoAnimal, input: LocoInput, a: ClipRows | null, b: ClipRows | null, fromWeight: number, row: number): GaitState | null {
        if (row < 0 || row >= this.live.rows) return null;
        const started = performance.now();
        const rig = this.rig;
        bakedRow(this.data, rig.bones.length, a, b, fromWeight, this.baked);
        const taking = drivers.find((d) => d.takes(rig, input)) ?? null;
        const dt = Math.min(Math.max(input.dt, 0), 0.1);
        animal.share = Math.min(Math.max(animal.share + (taking ? dt : -dt) / LOCO_FADE_SECONDS, 0), 1);
        if (taking) animal.driver = taking.name;
        const driver = taking ?? (animal.share > 0 ? drivers.find((d) => d.name === animal.driver) ?? null : null);
        let gait: GaitState | null = null;
        const out = this.live.data;
        const offset = row * rig.bones.length * 12;
        if (driver && animal.share > 0) {
            let held = animal.states.get(driver.name);
            // Back after a while away: start afresh (feet under the body).
            if (!held || input.clock - held.at > 0.5 || input.clock < held.at) {
                held = {state: driver.init(rig), at: input.clock};
                animal.states.set(driver.name, held);
            }
            held.at = input.clock;
            const fromRest = (driver.base?.(rig, input) ?? "clip") === "rest";
            if (fromRest) rig.bones.forEach((bone, i) => this.world[i].copy(bone.restWorld));
            else rowToWorld(rig, this.baked, 0, this.world);
            gait = driver.pose(rig, input, this.world, held.state);
            // (Behaviours pass, lane B4.) A driver that poses from the rest pose (the legged gaits) knows nothing of the
            // wings: it left them as the rig rests. A v7 bird rests with its wings part open (its clips fold them), so
            // on the ground a flamingo's and a bulbul's wings hung to the grass like a tent (the graphics pass,
            // 2026-11-14). The wings keep the clip's own fold, carried on the body as the driver posed it.
            if (fromRest && a && this.wingBones.length) this.carryWings();
            skinRow(rig, this.world, this.rowA, 0);
        }
        if (animal.share < 1) {
            rowToWorld(rig, this.baked, 0, this.world2);
            if (input.grounded && !CLIP_NO_PLANT.has(input.clipNow) && (!input.clipFrom || !CLIP_NO_PLANT.has(input.clipFrom))) plantClipFeet(rig, input, this.world2, this.poles);
            skinRow(rig, this.world2, this.rowB, 0);
        }
        const s = driver ? animal.share : 0;
        const n = rig.bones.length * 12;
        if (s >= 1) out.set(this.rowA, offset);
        else if (s <= 0) out.set(this.rowB, offset);
        else for (let i = 0; i < n; i++) out[offset + i] = this.rowB[i] * (1 - s) + this.rowA[i] * s;
        this.live.texture.needsUpdate = true;
        animal.gait = gait;
        this.ms += performance.now() - started;
        this.calls++;
        return gait;
    }

    /**
     * The clip's wings on the driver's body: each wing bone (and what it carries) as the baked frame holds it against
     * its parent, on that parent as posed now. `this.baked` is the clip's frame, `this.world` the driver's pose.
     */
    private carryWings(): void {
        const rig = this.rig;
        for (const i of this.wingBones) {
            const p = rig.bones[i].parent;
            // local = bakedWorld[p]⁻¹ · bakedWorld[i]; world[i] = world[p] · local.
            wingA.copy(bakedWorldOf(rig, this.baked, p, wingB)).invert().multiply(bakedWorldOf(rig, this.baked, i, wingB));
            this.world[i].multiplyMatrices(this.world[p], wingA);
        }
    }

    dispose() {
        this.live.texture.dispose();
    }
}
