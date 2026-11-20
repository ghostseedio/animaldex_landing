/**
 * ARK-ANIM (decision 447, the owner on batch 13): load-time fixes to a rig's skin and its lying clips, no new rig files.
 *
 * - `seatLyingRows`: a lying or sleeping clip carries its own drop, and the scene stands it at its rest height. Where the
 *   drop is short the animal lies in mid-air (a resting domestic horse, its shadow far below); where it is long the
 *   folded legs go through the ground (a sleeping elk). Each lying pose is seated by its lowest point: the lying clips of
 *   one base (`lying`, ...) move up or down together so that across their frames the lowest vertex is on the ground (the
 *   rest pose's lowest), and the ways into and out of it (`ends`, `starts`) move by the same, eased along the clip.
 * - `rigidMuzzle`: an equid's muzzle held by its neck bone (a donkey's 70%, a zebra's 65%) bends and stretches when
 *   the neck turns or drops: the head's front is the head's (its neck weight moved onto the head, eased in from the
 *   head's joint over `MUZZLE_EASE` of the head's length).
 * - `tailOffLegs`: a tail held partly by the hind legs (the pilot horse's: a tenth of the tail on a hind foot) smears and
 *   tears when the legs fold: a vertex whose nearest bone is a tail bone, or that tail bones hold by `TAIL_HOLD` or more,
 *   keeps no leg weight (moved onto its heaviest tail bone).
 */
import {DataUtils, Vector3, type Matrix4} from "three";
import type {LocoRig} from "@/ark-scene/locomotion/types";

type Skin = {positions: ArrayLike<number>; joints: {[i: number]: number; length: number}; weights: {[i: number]: number; length: number}};
type ClipRows = {row: number; rows: number; base?: string; ends?: string; starts?: string};

/** The lowest skinned vertex height of one texture row (model units). */
export function lowestOfRow(skin: Skin, data: Uint16Array, bones: number, row: number, stride = 1): number {
    const per = bones * 12;
    const o = row * per;
    const m = new Float32Array(per);
    for (let i = 0; i < per; i++) m[i] = DataUtils.fromHalfFloat(data[o + i]);
    const P = skin.positions;
    const J = skin.joints;
    const W = skin.weights;
    let low = Infinity;
    const n = P.length / 3;
    for (let v = 0; v < n; v += stride) {
        let y = 0;
        let any = 0;
        const px = P[v * 3];
        const py = P[v * 3 + 1];
        const pz = P[v * 3 + 2];
        for (let k = 0; k < 4; k++) {
            const w = W[v * 4 + k];
            if (w <= 0) continue;
            const b = J[v * 4 + k] * 12;
            y += w * (m[b + 4] * px + m[b + 5] * py + m[b + 6] * pz + m[b + 7]);
            any += w;
        }
        if (any > 0.5 && y < low) low = y;
    }
    return low;
}

function shiftRow(data: Uint16Array, bones: number, row: number, dy: number): void {
    if (Math.abs(dy) < 1e-6) return;
    const o = row * bones * 12;
    for (let b = 0; b < bones; b++) {
        const i = o + b * 12 + 7;
        data[i] = DataUtils.toHalfFloat(DataUtils.fromHalfFloat(data[i]) + dy);
    }
}

/** Lying, its folded legs may sit this far into the ground (a share of its body length: 2 cm on a 2 m animal). */
export const LIE_SINK = 0.01;

/**
 * Seat each lying clip (one with a `base`) by its lowest point, in place: its belly (the lowest vertex no leg holds by
 * 0.3 or more) on the ground, unless that puts a folded leg more than `LIE_SINK` of the body into it; then as low as the
 * legs allow. The ways into and out of a base (`ends`, `starts`) move with its first clip of `LIE_FIRST`, eased along
 * them. Returns, per clip, the belly's and the lowest point's height before (model units from the rest pose's lowest;
 * negative is under the ground) and the shift it took.
 */
export function seatLyingRows(skin: Skin, restLow: number, bodyLength: number, legBones: ReadonlySet<number>, data: Uint16Array, bones: number, clips: Record<string, ClipRows>): Record<string, {belly: number; low: number; shift: number}> {
    const torso = torsoSkin(skin, legBones);
    const out: Record<string, {belly: number; low: number; shift: number}> = {};
    const done = new Map<number, number>();
    const sink = LIE_SINK * bodyLength;
    for (const [name, clip] of Object.entries(clips)) {
        if (!clip.base || done.has(clip.row)) continue;
        let low = Infinity;
        let belly = Infinity;
        for (let f = 0; f < clip.rows; f++) {
            low = Math.min(low, lowestOfRow(skin, data, bones, clip.row + f, 2));
            belly = Math.min(belly, lowestOfRow(torso, data, bones, clip.row + f, 2));
        }
        if (!Number.isFinite(low)) continue;
        if (!Number.isFinite(belly)) belly = low;
        const shift = Math.max(restLow - belly, restLow - sink - low);
        out[name] = {belly: belly - restLow, low: low - restLow, shift};
        done.set(clip.row, shift);
        for (let f = 0; f < clip.rows; f++) shiftRow(data, bones, clip.row + f, shift);
    }
    for (const c of Object.values(clips)) {
        const base = c.ends ?? c.starts;
        if (!base || c.base || done.has(c.row)) continue;
        const into = Boolean(c.ends);
        const first = LIE_FIRST.map((n) => clips[n]).find((k) => k && k.base === base && out[Object.keys(clips).find((key) => clips[key] === k)!]);
        const key = first ? Object.keys(clips).find((k) => clips[k] === first)! : Object.keys(out).find((k) => clips[k].base === base);
        if (!key) continue;
        const shift = out[key].shift;
        done.set(c.row, shift);
        for (let f = 0; f < c.rows; f++) {
            const u = c.rows > 1 ? f / (c.rows - 1) : 1;
            const e = u * u * (3 - 2 * u);
            shiftRow(data, bones, c.row + f, shift * (into ? e : 1 - e));
        }
    }
    return out;
}
/** The clip a way into or out of lying is seated with: the plain lie first. */
const LIE_FIRST = ["lie", "sleep", "rest"];

/** The skin without the legs: each vertex a leg bone holds by 0.3 or more dropped (its weights zeroed). */
function torsoSkin(skin: Skin, legBones: ReadonlySet<number>): Skin {
    const weights = Float32Array.from({length: skin.weights.length}, (_, i) => skin.weights[i]);
    const n = skin.positions.length / 3;
    for (let v = 0; v < n; v++) {
        let leg = 0;
        for (let k = 0; k < 4; k++) if (legBones.has(skin.joints[v * 4 + k])) leg += weights[v * 4 + k];
        if (leg >= 0.3) for (let k = 0; k < 4; k++) weights[v * 4 + k] = 0;
    }
    return {positions: skin.positions, joints: skin.joints, weights};
}

const EQUID = /(^|-)(horse|donkey|zebra|ass|onager|kiang|burro|pony|mule)(-|$)/;
export function isEquid(slug: string): boolean {
    return EQUID.test(slug);
}

/** How far in front of the head's joint its neck weight is all gone (a share of the head's length to the muzzle). */
export const MUZZLE_EASE = 0.35;

/** An equid's head front onto its head bone (in place). Returns how many vertices changed. */
export function rigidMuzzle(rig: LocoRig, skin: Skin): number {
    const names = rig.bones.map((b) => b.name);
    const head = names.indexOf("head");
    if (head < 0) return 0;
    const neckish = new Set(names.flatMap((n, i) => (/^neck\d*$/.test(n) ? [i] : [])));
    if (!neckish.size) return 0;
    const parent = rig.bones[head].parent;
    const h = new Vector3().setFromMatrixPosition(rig.bones[head].restWorld as Matrix4);
    const p = parent >= 0 ? new Vector3().setFromMatrixPosition(rig.bones[parent].restWorld as Matrix4) : h.clone().add(new Vector3(0, -0.1, -0.1));
    const axis = h.clone().sub(p).normalize();
    // The head's forward: its axis laid toward +z (the model faces +z), and how far its vertices reach along it.
    const fwd = new Vector3(0, axis.y * 0.3, 1).normalize();
    const P = skin.positions;
    let reach = 0;
    const n = P.length / 3;
    const d = new Vector3();
    for (let v = 0; v < n; v++) reach = Math.max(reach, d.set(P[v * 3] - h.x, P[v * 3 + 1] - h.y, P[v * 3 + 2] - h.z).dot(fwd));
    if (reach <= 0) return 0;
    let changed = 0;
    for (let v = 0; v < n; v++) {
        const along = d.set(P[v * 3] - h.x, P[v * 3 + 1] - h.y, P[v * 3 + 2] - h.z).dot(fwd) / reach;
        if (along <= 0) continue;
        const k = Math.min(along / MUZZLE_EASE, 1);
        const keep = 1 - k * k * (3 - 2 * k);
        let moved = 0;
        let headSlot = -1;
        for (let s = 0; s < 4; s++) {
            const j = skin.joints[v * 4 + s];
            const w = skin.weights[v * 4 + s];
            if (j === head && w > 0) headSlot = s;
            if (w > 0 && neckish.has(j)) {
                moved += w * (1 - keep);
                skin.weights[v * 4 + s] = w * keep;
            }
        }
        if (moved <= 1e-6) continue;
        if (headSlot < 0) {
            let light = 0;
            for (let s = 1; s < 4; s++) if (skin.weights[v * 4 + s] < skin.weights[v * 4 + light]) light = s;
            moved += skin.weights[v * 4 + light];
            skin.joints[v * 4 + light] = head;
            skin.weights[v * 4 + light] = 0;
            headSlot = light;
        }
        skin.weights[v * 4 + headSlot] += moved;
        changed++;
    }
    return changed;
}

/** A vertex held this much by tail bones keeps no leg weight. */
export const TAIL_HOLD = 0.3;

/** The tail off the hind legs (in place). Returns how many vertices changed. */
export function tailOffLegs(rig: LocoRig, skin: Skin): number {
    const names = rig.bones.map((b) => b.name);
    const tail = new Set(names.flatMap((n, i) => (/^tail\d+$/.test(n) ? [i] : [])));
    const legs = new Set(names.flatMap((n, i) => (/^leg\d+[LR]_/.test(n) ? [i] : [])));
    if (!tail.size || !legs.size) return 0;
    const at = rig.bones.map((b) => new Vector3().setFromMatrixPosition(b.restWorld as Matrix4));
    const segments: Array<{bone: number; a: Vector3; b: Vector3}> = [];
    rig.bones.forEach((_, i) => {
        const kids = rig.bones.flatMap((c, k) => (c.parent === i ? [k] : []));
        if (!kids.length) segments.push({bone: i, a: at[i], b: at[i]});
        for (const k of kids) segments.push({bone: i, a: at[i], b: at[k]});
    });
    const P = skin.positions;
    const n = P.length / 3;
    let changed = 0;
    for (let v = 0; v < n; v++) {
        let held = 0;
        let legW = 0;
        let best = -1;
        for (let s = 0; s < 4; s++) {
            const j = skin.joints[v * 4 + s];
            const w = skin.weights[v * 4 + s];
            if (w <= 0) continue;
            if (tail.has(j)) {
                held += w;
                if (best < 0 || w > skin.weights[v * 4 + best]) best = s;
            }
            if (legs.has(j)) legW += w;
        }
        if (legW <= 0 || best < 0) continue;
        if (held < TAIL_HOLD) {
            let nearest = -1;
            let dist = Infinity;
            for (const seg of segments) {
                const abx = seg.b.x - seg.a.x, aby = seg.b.y - seg.a.y, abz = seg.b.z - seg.a.z;
                const len = abx * abx + aby * aby + abz * abz;
                const px = P[v * 3] - seg.a.x, py = P[v * 3 + 1] - seg.a.y, pz = P[v * 3 + 2] - seg.a.z;
                const t = len > 0 ? Math.min(Math.max((px * abx + py * aby + pz * abz) / len, 0), 1) : 0;
                const dd = Math.hypot(px - abx * t, py - aby * t, pz - abz * t);
                if (dd < dist) {
                    dist = dd;
                    nearest = seg.bone;
                }
            }
            if (!tail.has(nearest)) continue;
        }
        let freed = 0;
        for (let s = 0; s < 4; s++) {
            if (legs.has(skin.joints[v * 4 + s]) && skin.weights[v * 4 + s] > 0) {
                freed += skin.weights[v * 4 + s];
                skin.weights[v * 4 + s] = 0;
            }
        }
        skin.weights[v * 4 + best] += freed;
        changed++;
    }
    return changed;
}
