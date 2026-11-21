/**
 * ARK-ANIM (decision 447, the owner on batch 13: "the eared dove's neck still tears when it turns its head"). Two
 * things, on every bird rig, as it loads (no new rig files):
 *
 * 1. Its clips' head turns (a groom reaching back over the shoulder, a sleeping tuck) are capped at `BIRD_YAW_CAP_DEG`
 *    from its body (an owl's at `OWL_YAW_CAP_DEG`) and spread along the chain (`BIRD_YAW_SHARES`: chest, neck, head),
 *    where the clips put nearly all of it on the neck and the head and the skin between the chest and the neck
 *    stretched flat. Applied to each frame's rows: its yaw about the chest's up taken off the neck and the head and put
 *    back, capped and spread. A head pointing straight down (a graze, a dive) has no yaw to read and is left as it is.
 * 2. The wing's skin near the neck followed the neck and the head (the top of the near wing folded up over the neck
 *    like a flap): a vertex whose nearest bone is a wing bone, or that a wing bone holds by `WING_HOLD` or more, keeps
 *    no neck or head weight (moved onto the chest). At rest every bone is where it was, so the rest mesh is unchanged.
 */
import {DataUtils, Matrix4, Quaternion, Vector3} from "three";
import {restInverses, rotateSubtree, rowToWorld, skinRow} from "@/ark-scene/locomotion/skeleton";
import type {LocoRig} from "@/ark-scene/locomotion/types";

export const BIRD_YAW_CAP_DEG = 70;
export const OWL_YAW_CAP_DEG = 170;
/** The turn's share on the chest (with the wings), the neck and the head: most on the head, whose skin is its own. The seam
 * between the chest and the neck stretched least so (the eared dove at 70°: 3.7 against 5.9 at 25/40/35), and a chest
 * share turned the wings off the body (shards along the back), so the chest keeps none. */
export const BIRD_YAW_SHARES: readonly [number, number, number] = [0, 0.25, 0.75];
export const OWL_YAW_SHARES: readonly [number, number, number] = [0, 0.3, 0.7];
/**
 * The other split a rig may take, most on the neck (the clips' own 60/40): for 83 of the 654 bird rigs (kingfishers,
 * pelicans, the blue tit, macaws) whose head's skin reaches far down the neck, the head-heavy split tore that seam
 * further than the clips' turns had (the batch 14 scan). Each rig takes whichever split stretches its neck least at its
 * cap (`pickBirdShares`). Moving the neck's skin from the head to the neck along its length instead stretched 44 of
 * the 83 further and helped 26 (left out).
 */
export const NECK_HEAVY_SHARES: readonly [number, number, number] = [0, 0.6, 0.4];
/** A vertex held this much by wing bones keeps no neck or head weight. */
export let WING_HOLD = 0.4;
/** What is left of the neck's and the head's weight on such a vertex (a share of the vertex). */
export let WING_NECK_CAP = 0.15;
/** Scratch tuning (the sweep script). */
export function setWingRule(hold: number, cap: number): void {
    WING_HOLD = hold;
    WING_NECK_CAP = cap;
}
/** A head turned further than this from level (its forward's share in the chest's level plane) has no yaw to read. */
const LEVEL_MIN = 0.35;

const BIRD_PLANS: ReadonlySet<string> = new Set(["flying_bird", "walking_bird", "flightless_bird"]);
const OWL = /(^|-)owl(et)?$/;

export function isBirdRig(plan: string | null | undefined, bones: readonly string[]): boolean {
    return BIRD_PLANS.has(plan ?? "") && ["chest", "neck", "head"].every((name) => bones.includes(name));
}

export function birdYawLimits(slug: string): {cap: number; shares: readonly [number, number, number]} {
    return OWL.test(slug) ? {cap: OWL_YAW_CAP_DEG, shares: OWL_YAW_SHARES} : {cap: BIRD_YAW_CAP_DEG, shares: BIRD_YAW_SHARES};
}

const DEG = Math.PI / 180;
const ROT = new Matrix4();
const UP = new Vector3();
const FWD = new Vector3();
const B = new Vector3();
const C = new Vector3();
const PIVOT = new Vector3();
const Q = new Quaternion();

/** A bone's turn from rest now (world · rest⁻¹) applied to a direction. */
function turned(rig: LocoRig, world: readonly Matrix4[], bone: number, dir: Vector3, out: Vector3): Vector3 {
    ROT.multiplyMatrices(world[bone], restInverses(rig)[bone]);
    return out.copy(dir).transformDirection(ROT);
}

/** The signed yaw of a bone's forward from the chest's about the chest's up (radians), or null when it points steeply. */
export function yawFromChest(rig: LocoRig, world: readonly Matrix4[], chest: number, bone: number): number | null {
    turned(rig, world, chest, new Vector3(0, 1, 0), UP);
    turned(rig, world, chest, new Vector3(0, 0, 1), FWD);
    turned(rig, world, bone, new Vector3(0, 0, 1), B);
    B.addScaledVector(UP, -B.dot(UP));
    FWD.addScaledVector(UP, -FWD.dot(UP));
    if (B.length() < LEVEL_MIN || FWD.length() < 1e-6) return null;
    B.normalize();
    FWD.normalize();
    return Math.atan2(C.crossVectors(FWD, B).dot(UP), FWD.dot(B));
}

function turnSubtree(rig: LocoRig, world: Matrix4[], bone: number, angle: number): void {
    if (Math.abs(angle) < 1e-7) return;
    PIVOT.setFromMatrixPosition(world[bone]);
    rotateSubtree(rig, world, bone, Q.setFromAxisAngle(UP, angle), PIVOT);
}

/**
 * One frame's world poses: the head's yaw from the chest capped at `capDeg` and spread over chest, neck and head.
 * Returns the yaw it found and the one it left (degrees), or null when the head points too steeply to read.
 */
export function spreadBirdYaw(rig: LocoRig, world: Matrix4[], capDeg: number, shares: readonly [number, number, number]): {before: number; after: number} | null {
    const chest = rig.bones.findIndex((b) => b.name === "chest");
    const neck = rig.bones.findIndex((b) => b.name === "neck");
    const head = rig.bones.findIndex((b) => b.name === "head");
    if (chest < 0 || neck < 0 || head < 0) return null;
    const theta = yawFromChest(rig, world, chest, head);
    const thetaNeck = yawFromChest(rig, world, chest, neck);
    if (theta === null) return null;
    // (UP holds the chest's up from the last read; turns about it leave it where it is.)
    yawFromChest(rig, world, chest, head);
    const a = thetaNeck ?? 0;
    turnSubtree(rig, world, neck, -a);
    turnSubtree(rig, world, head, -(theta - a));
    const cap = capDeg * DEG;
    const target = Math.min(Math.max(theta, -cap), cap);
    turnSubtree(rig, world, chest, shares[0] * target);
    turnSubtree(rig, world, neck, shares[1] * target);
    turnSubtree(rig, world, head, shares[2] * target);
    return {before: theta / DEG, after: target / DEG};
}

/**
 * Every row of a bird rig's bone texture (half floats, `bones` × 12 per row) with its head yaw capped and spread, in
 * place. Returns the largest yaw it found and left (degrees).
 */
export function spreadBirdRows(rig: LocoRig, data: Uint16Array, bones: number, capDeg: number, shares: readonly [number, number, number]): {worstBefore: number; worstAfter: number} {
    const per = bones * 12;
    const rows = data.length / per;
    const row = new Float32Array(per);
    const world = rig.bones.map(() => new Matrix4());
    let worstBefore = 0;
    let worstAfter = 0;
    for (let r = 0; r < rows; r++) {
        const o = r * per;
        for (let i = 0; i < per; i++) row[i] = DataUtils.fromHalfFloat(data[o + i]);
        rowToWorld(rig, row, 0, world);
        const done = spreadBirdYaw(rig, world, capDeg, shares);
        if (!done) continue;
        worstBefore = Math.max(worstBefore, Math.abs(done.before));
        worstAfter = Math.max(worstAfter, Math.abs(done.after));
        skinRow(rig, world, row, 0);
        for (let i = 0; i < per; i++) data[o + i] = DataUtils.toHalfFloat(row[i]);
    }
    return {worstBefore, worstAfter};
}

/** Distance from a point to a segment. */
function toSegment(p: readonly number[], a: Vector3, b: Vector3): number {
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const len = abx * abx + aby * aby + abz * abz;
    const t = len > 0 ? Math.min(Math.max(((p[0] - a.x) * abx + (p[1] - a.y) * aby + (p[2] - a.z) * abz) / len, 0), 1) : 0;
    return Math.hypot(p[0] - a.x - abx * t, p[1] - a.y - aby * t, p[2] - a.z - abz * t);
}

/**
 * The wing's skin off the neck and the head (in place, on the rest mesh's `joints` and `weights`, 4 per vertex). Each
 * bone is the segments from its joint to its children's (its joint alone at a chain's end). Returns how many vertices
 * changed.
 */
export function birdWingWeights(rig: LocoRig, positions: ArrayLike<number>, joints: {[i: number]: number; length: number}, weights: {[i: number]: number; length: number}): number {
    const names = rig.bones.map((b) => b.name);
    const chest = names.indexOf("chest");
    const neckHead = new Set<number>();
    for (const name of ["neck", "head"]) {
        const i = names.indexOf(name);
        if (i < 0) continue;
        neckHead.add(i);
        for (const k of rig.below[i]) neckHead.add(k);
    }
    const wing = new Set(names.flatMap((n, i) => (/^wing/.test(n) ? [i] : [])));
    if (chest < 0 || !wing.size || !neckHead.size) return 0;
    const at = rig.bones.map((b) => new Vector3().setFromMatrixPosition(b.restWorld));
    const segments: Array<{bone: number; a: Vector3; b: Vector3}> = [];
    rig.bones.forEach((bone, i) => {
        const kids = rig.bones.flatMap((c, k) => (c.parent === i ? [k] : []));
        if (!kids.length) segments.push({bone: i, a: at[i], b: at[i]});
        for (const k of kids) segments.push({bone: i, a: at[i], b: at[k]});
    });
    let changed = 0;
    const p = [0, 0, 0];
    const n = positions.length / 3;
    for (let v = 0; v < n; v++) {
        let held = 0;
        let neckWeight = 0;
        for (let k = 0; k < 4; k++) {
            const j = joints[v * 4 + k];
            const w = weights[v * 4 + k];
            if (w <= 0) continue;
            if (wing.has(j)) held += w;
            if (neckHead.has(j)) neckWeight += w;
        }
        if (neckWeight <= 0) continue;
        let nearest = -1;
        if (held < WING_HOLD) {
            p[0] = positions[v * 3];
            p[1] = positions[v * 3 + 1];
            p[2] = positions[v * 3 + 2];
            let best = Infinity;
            for (const s of segments) {
                const d = toSegment(p, s.a, s.b);
                if (d < best) {
                    best = d;
                    nearest = s.bone;
                }
            }
        }
        if (held < WING_HOLD && !wing.has(nearest)) continue;
        // Its neck and head weight down to `WING_NECK_CAP` of it, the rest onto the chest (its slot if it has one, else
        // the first of theirs).
        const keep = Math.min(1, WING_NECK_CAP / neckWeight);
        if (keep >= 1) continue;
        let chestSlot = -1;
        for (let k = 0; k < 4; k++) if (joints[v * 4 + k] === chest && weights[v * 4 + k] > 0) chestSlot = k;
        let freed = 0;
        for (let k = 0; k < 4; k++) {
            const j = joints[v * 4 + k];
            const w = weights[v * 4 + k];
            if (w <= 0 || !neckHead.has(j)) continue;
            weights[v * 4 + k] = w * keep;
            freed += w * (1 - keep);
        }
        if (chestSlot < 0) {
            // The lightest slot becomes the chest's (its weight, if any, onto the freed share's owner too).
            let light = 0;
            for (let k = 1; k < 4; k++) if (weights[v * 4 + k] < weights[v * 4 + light]) light = k;
            freed += weights[v * 4 + light];
            joints[v * 4 + light] = chest;
            weights[v * 4 + light] = 0;
            chestSlot = light;
        }
        weights[v * 4 + chestSlot] += freed;
        changed++;
    }
    return changed;
}


/**
 * The split (`BIRD_YAW_SHARES` or `NECK_HEAVY_SHARES`, an owl's own first) that stretches this rig's neck least turned
 * to its cap either way from rest: the longest edge of the neck and head's skin over its rest length (edges under 1% of
 * the mesh's size left out). The rest mesh's `positions`, `joints`, `weights` (4 per vertex) and triangle `index`.
 */
export function pickBirdShares(rig: LocoRig, skin: {positions: ArrayLike<number>; joints: ArrayLike<number>; weights: ArrayLike<number>}, index: ArrayLike<number>, capDeg: number, first: readonly [number, number, number]): {shares: readonly [number, number, number]; stretch: number[]} {
    const names = rig.bones.map((b) => b.name);
    const neck = names.indexOf("neck");
    const head = names.indexOf("head");
    const chest = names.indexOf("chest");
    if (neck < 0 || head < 0 || chest < 0) return {shares: first, stretch: []};
    const region = new Set([neck, head, ...rig.below[neck]]);
    const P = skin.positions;
    const n = P.length / 3;
    const inR = new Uint8Array(n);
    let lo = Infinity;
    let hi = -Infinity;
    for (let v = 0; v < n; v++) {
        for (let k = 0; k < 4; k++) if (skin.weights[v * 4 + k] > 0.05 && region.has(skin.joints[v * 4 + k])) inR[v] = 1;
        lo = Math.min(lo, P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
        hi = Math.max(hi, P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    }
    const minLen = 0.01 * (hi - lo);
    const edges: number[] = [];
    for (let t = 0; t + 2 < index.length; t += 3) {
        for (const [a, b] of [[index[t], index[t + 1]], [index[t + 1], index[t + 2]], [index[t + 2], index[t]]]) {
            if (!inR[a] && !inR[b]) continue;
            if (Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]) < minLen) continue;
            edges.push(a, b);
        }
    }
    const used = Array.from(new Set(edges));
    const inv = restInverses(rig);
    const out = new Float32Array(n * 3);
    const v = new Vector3();
    const acc = new Vector3();
    const world = rig.bones.map(() => new Matrix4());
    const mats = rig.bones.map(() => new Matrix4());
    const worst = (shares: readonly [number, number, number]) => {
        let w = 1;
        for (const sign of [1, -1]) {
            rig.bones.forEach((bone, i) => world[i].copy(bone.restWorld));
            turned(rig, world, chest, v.set(0, 1, 0), UP);
            const angle = sign * capDeg * DEG;
            turnSubtree(rig, world, chest, shares[0] * angle);
            turnSubtree(rig, world, neck, shares[1] * angle);
            turnSubtree(rig, world, head, shares[2] * angle);
            world.forEach((m, i) => mats[i].multiplyMatrices(m, inv[i]));
            for (const i of used) {
                acc.set(0, 0, 0);
                for (let k = 0; k < 4; k++) {
                    const wt = skin.weights[i * 4 + k];
                    if (wt <= 0) continue;
                    v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(mats[skin.joints[i * 4 + k]]).multiplyScalar(wt);
                    acc.add(v);
                }
                out[i * 3] = acc.x;
                out[i * 3 + 1] = acc.y;
                out[i * 3 + 2] = acc.z;
            }
            for (let e = 0; e < edges.length; e += 2) {
                const a = edges[e];
                const b = edges[e + 1];
                const rest = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
                w = Math.max(w, Math.hypot(out[a * 3] - out[b * 3], out[a * 3 + 1] - out[b * 3 + 1], out[a * 3 + 2] - out[b * 3 + 2]) / rest);
            }
        }
        return w;
    };
    const options = first === NECK_HEAVY_SHARES ? [first] : [first, NECK_HEAVY_SHARES];
    const stretch = options.map(worst);
    let best = 0;
    for (let i = 1; i < options.length; i++) if (stretch[i] < stretch[best]) best = i;
    return {shares: options[best], stretch};
}
