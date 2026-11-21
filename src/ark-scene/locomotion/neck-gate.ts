/**
 * ARK-POSE (the owner on batch 14, a toque macaque asleep on a limb: "look at the monkey's head here", its neck drawn
 * out long and thin and twisted back): a mammal's head and neck turns measured and capped, as ARK-ANIM did the birds'
 * (`bird-neck.ts`).
 *
 * The measure is the birds', made robust to fur: the neck's and the head's skin edges over their rest lengths, the 99th
 * percentile (`neckStretch`; edges under 3% of the mesh's size left out: a mane's strands). Three things turn a mammal's head:
 *
 * 1. the look (`animal-material.ts` RIG_SKIN: yaw and pitch on the neck and the head bones, on top of the playing
 *    clip). Its limits were the plan's (70° four-legged, 80° primate) whatever the rig's skin could take. Now per class
 *    (`MAMMAL_LOOK`: primates 80°, grazers and browsers 60°, the other four-legged 70°), split between the neck and the
 *    head by whichever share stretches the rig least, and lowered, a step at a time, on a rig whose neck stretches more
 *    than `NECK_STRETCH_MAX` at its worst allowed turn (`fitMammalLook`);
 * 2. the look on top of a posed clip. The look turns the bones in their rest frame; a primate's posed sit already bows
 *    the neck 55° and drops the face 70° (`sit-sleep-pose.ts`), and a look to the flank on top of that wrung the neck
 *    (the macaque). Each clip that holds the head away from rest gets its own share of the look
 *    (`RigClipData.lookShare` 0…1, `clipLookShare`), down to none; one that holds it 60° or more from rest takes none;
 * 3. the clips' own head turns (a groom back to the flank): capped at the class's yaw from the chest and spread along
 *    the neck (`bird-neck.ts` spreadBirdRows, with the mammal's shares).
 */
import {Matrix4, Vector3} from "three";
import type {LocoRig} from "@/ark-scene/locomotion/types";

/** The most a neck edge may stretch in the rig's worst allowed turn. */
export const NECK_STRETCH_MAX = 1.6;
/**
 * Edges shorter than this share of the mesh's size are left out of the measure: fur. The pilot lion's mane is 10,000
 * edges of strands 1 to 3% of its size, their ends on different bones: at a 70 degree look their 99th percentile reads
 * 5.5 while the 324 edges of the neck's own surface (3% and longer) read 1.34. A mesh too fine to have `MIN_EDGES` such
 * edges is measured from `MIN_EDGE_FINE` up, as the birds are.
 */
const MIN_EDGE = 0.03;
const MIN_EDGE_FINE = 0.01;
const MIN_EDGES = 150;

/** A class's look: yaw either way, pitch up, pitch down (degrees). */
export type LookCaps = {yaw: number; up: number; down: number};
export const MAMMAL_LOOK: Record<"primate" | "grazer" | "quadruped", LookCaps> = {
    primate: {yaw: 80, up: 40, down: 40},
    // (Hoofed grazers and browsers: a long neck that swings, a head that turns little on it.)
    grazer: {yaw: 60, up: 30, down: 45},
    quadruped: {yaw: 70, up: 30, down: 45}
};
/** The neck's share of the look a rig may take (the rest on the head), tried in order; the rig's own first. */
export const NECK_SHARES: readonly number[] = [0.45, 0.6, 0.3, 0.75];
/** A cap is lowered by this factor a step, down to `LOOK_FLOOR` of the class's. */
export const LOOK_STEP = 0.85;
export const LOOK_FLOOR = 0.25;

/** The look class of a mammal rig: a primate, a grazer or browser (its file has a `graze` or `browse` clip), any other four-legged; null for the rest. */
export function mammalLookClass(plan: string | null | undefined, clipNames: readonly string[]): keyof typeof MAMMAL_LOOK | null {
    if (plan === "primate") return "primate";
    if (plan !== "quadruped") return null;
    return clipNames.includes("graze") || clipNames.includes("browse") ? "grazer" : "quadruped";
}

export type NeckSkin = {positions: ArrayLike<number>; joints: ArrayLike<number>; weights: ArrayLike<number>};
/** The look chain as the measure needs it (`rig-player.ts` RigLookChain): bones, rest pivots, masks. */
export type NeckChain = {neck: number; head: number; neckPivot: readonly number[]; headPivot: readonly number[]; neckMask?: number; headMask?: number};

/** The neck's and the head's skin: its vertices, and the edges that touch them (pairs). */
export type NeckRegion = {vertices: number[]; edges: number[]; rest: Float32Array};

/** The neck and head region of a rig's skin (every vertex the neck, the head or a bone they carry holds by 5% or more), and its edges. */
export function neckRegion(rig: LocoRig, skin: NeckSkin, index: ArrayLike<number>): NeckRegion | null {
    const root = rig.neck >= 0 ? rig.neck : rig.head;
    if (root < 0) return null;
    const region = new Set([root, ...rig.below[root]]);
    if (rig.head >= 0) for (const b of [rig.head, ...rig.below[rig.head]]) region.add(b);
    const P = skin.positions;
    const n = P.length / 3;
    const inR = new Uint8Array(n);
    let lo = Infinity;
    let hi = -Infinity;
    // (A vertex a limb holds by half or more is the shoulder's or the arm's, not the neck's: an arm swung down, a
    // foreleg folded, pulls the skin at the neck's base without the neck turning at all. Its edges are left out.)
    const limbs = new Set<number>();
    for (const leg of rig.legs) for (const b of [leg.upper, ...rig.below[leg.upper]]) limbs.add(b);
    for (const b of [...rig.wings.left, ...rig.wings.right]) if (b >= 0) limbs.add(b);
    const limb = new Uint8Array(n);
    for (let v = 0; v < n; v++) {
        let held = 0;
        for (let k = 0; k < 4; k++) {
            const w = skin.weights[v * 4 + k];
            if (w > 0.05 && region.has(skin.joints[v * 4 + k])) inR[v] = 1;
            if (w > 0 && limbs.has(skin.joints[v * 4 + k])) held += w;
        }
        if (held >= 0.5) limb[v] = 1;
        lo = Math.min(lo, P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
        hi = Math.max(hi, P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    }
    let edges: number[] = [];
    let rest: number[] = [];
    for (const share of [MIN_EDGE, MIN_EDGE_FINE]) {
        const minLen = share * (hi - lo);
        edges = [];
        rest = [];
        for (let t = 0; t + 2 < index.length; t += 3) {
            for (const [a, b] of [[index[t], index[t + 1]], [index[t + 1], index[t + 2]], [index[t + 2], index[t]]]) {
                if ((!inR[a] && !inR[b]) || limb[a] || limb[b]) continue;
                const len = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
                if (len < minLen) continue;
                edges.push(a, b);
                rest.push(len);
            }
        }
        if (rest.length >= MIN_EDGES) break;
    }
    if (!edges.length) return null;
    return {vertices: Array.from(new Set(edges)), edges, rest: Float32Array.from(rest)};
}

/** T(pivot) · Ry(yaw) · Rx(pitch) · T(−pivot), as the shader's `arkTurn` (yaw + to its left, pitch + down; radians). */
function turn(pivot: readonly number[], yaw: number, pitch: number, out: Matrix4): Matrix4 {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // Ry · Rx, row-major.
    const r = [cy, sy * sp, sy * cp, 0, cp, -sp, -sy, cy * sp, cy * cp];
    const [px, py, pz] = pivot;
    return out.set(
        r[0], r[1], r[2], px - (r[0] * px + r[1] * py + r[2] * pz),
        r[3], r[4], r[5], py - (r[3] * px + r[4] * py + r[5] * pz),
        r[6], r[7], r[8], pz - (r[6] * px + r[7] * py + r[8] * pz),
        0, 0, 0, 1
    );
}

const NECK = new Matrix4();
const HEAD = new Matrix4();
const M = new Matrix4();
const bit = (mask: number | undefined, own: number, i: number) => (mask === undefined ? i === own : i < 31 && ((mask >> i) & 1) === 1);

/**
 * A bone row (floats, 3×4 per bone) with the look on it, as the shader draws it: the head's bones `m · neck · head`,
 * the neck's `m · neck` (the turns in the rest frame, before the clip's own matrix). Angles in radians.
 */
export function lookOnRow(row: ArrayLike<number>, bones: number, chain: NeckChain, neckShare: number, yaw: number, pitch: number, out: Float32Array): Float32Array {
    const share = chain.neck >= 0 ? neckShare : 0;
    turn(chain.neckPivot, yaw * share, pitch * share, NECK);
    HEAD.multiplyMatrices(NECK, turn(chain.headPivot, yaw * (1 - share), pitch * (1 - share), HEAD));
    for (let b = 0; b < bones; b++) {
        const o = b * 12;
        const look = bit(chain.headMask, chain.head, b) ? HEAD : bit(chain.neckMask, chain.neck, b) ? NECK : null;
        if (!look) {
            for (let i = 0; i < 12; i++) out[o + i] = row[o + i];
            continue;
        }
        M.set(row[o], row[o + 1], row[o + 2], row[o + 3], row[o + 4], row[o + 5], row[o + 6], row[o + 7], row[o + 8], row[o + 9], row[o + 10], row[o + 11], 0, 0, 0, 1).multiply(look);
        const e = M.elements;
        out[o] = e[0]; out[o + 1] = e[4]; out[o + 2] = e[8]; out[o + 3] = e[12];
        out[o + 4] = e[1]; out[o + 5] = e[5]; out[o + 6] = e[9]; out[o + 7] = e[13];
        out[o + 8] = e[2]; out[o + 9] = e[6]; out[o + 10] = e[10]; out[o + 11] = e[14];
    }
    return out;
}

const SCRATCH = new WeakMap<NeckRegion, Float32Array>();

/**
 * The neck's stretch under a bone row: the 99th percentile of its edges' lengths over their rest lengths (`p99`, the
 * gate's measure), and the single longest (`max`). The longest alone is not the neck: one strand of a ruff or a whisker
 * whose two ends hang on different bones reads 5 to 20 times at any turn while the neck under it is whole; one edge in
 * a hundred is a band of skin.
 */
export function neckStretch(region: NeckRegion, skin: NeckSkin, row: ArrayLike<number>): {max: number; p99: number} {
    const P = skin.positions;
    let out = SCRATCH.get(region);
    if (!out) SCRATCH.set(region, (out = new Float32Array(P.length)));
    for (const v of region.vertices) {
        const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
        let ox = 0, oy = 0, oz = 0;
        for (let k = 0; k < 4; k++) {
            const w = skin.weights[v * 4 + k];
            if (w <= 0) continue;
            const b = skin.joints[v * 4 + k] * 12;
            ox += w * (row[b] * x + row[b + 1] * y + row[b + 2] * z + row[b + 3]);
            oy += w * (row[b + 4] * x + row[b + 5] * y + row[b + 6] * z + row[b + 7]);
            oz += w * (row[b + 8] * x + row[b + 9] * y + row[b + 10] * z + row[b + 11]);
        }
        out[v * 3] = ox;
        out[v * 3 + 1] = oy;
        out[v * 3 + 2] = oz;
    }
    const n = region.rest.length;
    const ratios = new Float32Array(n);
    let max = 1;
    for (let e = 0; e < n; e++) {
        const a = region.edges[e * 2] * 3;
        const b = region.edges[e * 2 + 1] * 3;
        const r = Math.hypot(out[a] - out[b], out[a + 1] - out[b + 1], out[a + 2] - out[b + 2]) / region.rest[e];
        ratios[e] = r;
        if (r > max) max = r;
    }
    ratios.sort();
    return {max, p99: Math.max(ratios[Math.min(Math.floor(n * 0.99), n - 1)], 1)};
}

const DEG = Math.PI / 180;
const IDENTITY_ROWS = new WeakMap<LocoRig, Float32Array>();
/** The rest pose as a bone row (identity 3×4 per bone). */
export function restRow(rig: LocoRig): Float32Array {
    let row = IDENTITY_ROWS.get(rig);
    if (!row) {
        row = new Float32Array(rig.bones.length * 12);
        for (let b = 0; b < rig.bones.length; b++) row[b * 12] = row[b * 12 + 5] = row[b * 12 + 10] = 1;
        IDENTITY_ROWS.set(rig, row);
    }
    return row;
}

/**
 * The worst stretch of the look's allowed turns (its yaw cap either way, level, up and down) on a bone row: the gate's
 * measure (`p99`), and the single longest edge (`max`).
 */
export function worstLook(region: NeckRegion, skin: NeckSkin, row: ArrayLike<number>, bones: number, chain: NeckChain, neckShare: number, caps: LookCaps, scale = 1): {max: number; p99: number} {
    const out = new Float32Array(bones * 12);
    const worst = {max: 1, p99: 1};
    for (const sign of [1, -1]) {
        for (const pitch of [0, -caps.up, caps.down]) {
            const s = neckStretch(region, skin, lookOnRow(row, bones, chain, neckShare, sign * caps.yaw * scale * DEG, pitch * scale * DEG, out));
            worst.max = Math.max(worst.max, s.max);
            worst.p99 = Math.max(worst.p99, s.p99);
        }
    }
    return worst;
}

export type MammalLookFit = {
    cls: keyof typeof MAMMAL_LOOK;
    /** The caps it keeps (degrees) and the neck's share. */
    caps: LookCaps;
    neckShare: number;
    /** The neck's stretch at the class's caps with the rig's own share (before), and at what it keeps (after). */
    before: number;
    after: number;
    /** Its caps as a share of the class's (1: not lowered). */
    scale: number;
    ok: boolean;
};

/**
 * A mammal rig's look fitted to its skin: the class's caps with the neck share that stretches it least, lowered by
 * `LOOK_STEP` a step until its worst allowed turn stretches no neck edge more than `NECK_STRETCH_MAX` (never under
 * `LOOK_FLOOR` of the class's: a rig that still fails there keeps that, `ok` false). `was`: the limits and share the rig
 * came with (its entry's), for the before number.
 */
export function fitMammalLook(region: NeckRegion, skin: NeckSkin, rig: LocoRig, chain: NeckChain, cls: keyof typeof MAMMAL_LOOK, was: {caps: LookCaps; neckShare: number}): MammalLookFit {
    const bones = rig.bones.length;
    const rest = restRow(rig);
    const before = worstLook(region, skin, rest, bones, chain, was.neckShare, was.caps).p99;
    const classCaps = MAMMAL_LOOK[cls];
    const shares = chain.neck >= 0 ? [was.neckShare, ...NECK_SHARES.filter((s) => Math.abs(s - was.neckShare) > 0.01)] : [0];
    let best = {share: shares[0], scale: LOOK_FLOOR, stretch: Infinity};
    for (let scale = 1; scale >= LOOK_FLOOR - 1e-6; scale *= LOOK_STEP) {
        let pick = {share: shares[0], stretch: Infinity};
        for (const share of shares) {
            const stretch = worstLook(region, skin, rest, bones, chain, share, classCaps, scale).p99;
            if (stretch < pick.stretch - 1e-4) pick = {share, stretch};
        }
        best = {share: pick.share, scale, stretch: pick.stretch};
        if (pick.stretch <= NECK_STRETCH_MAX) break;
    }
    const round = (deg: number) => Math.round(deg * best.scale * 10) / 10;
    return {cls, caps: {yaw: round(classCaps.yaw), up: round(classCaps.up), down: round(classCaps.down)}, neckShare: best.share, before, after: best.stretch, scale: best.scale, ok: best.stretch <= NECK_STRETCH_MAX};
}

/** A clip whose head never turns this far from rest (degrees, against the chest) takes the whole look: not measured. */
export const HELD_TURN_DEG = 25;
/**
 * A clip that holds the head this far from rest (degrees, against the chest) takes no look at all: the look turns the
 * head about its rest pose's up and side, and on a head bowed onto the chest (a primate's posed sit, 110 degrees) or
 * down at the grass those are no longer its yaw and its pitch: a look to the side rolled the bowed head up and back.
 */
export const LOOK_OFF_TURN_DEG = 60;
/** On a pose that stretches the neck past `NECK_STRETCH_MAX` by itself, the look may add this much at most (a factor). */
export const CLIP_LOOK_OVER = 1.03;
/** The shares of the look a clip may take, most first. */
export const CLIP_LOOK_SHARES: readonly number[] = [1, 0.6, 0.3, 0];

/**
 * How much of the look a held pose takes on top of it (`row`: the pose's bone row): the largest share whose worst
 * allowed turn stretches the neck no more than `NECK_STRETCH_MAX`, or than the pose alone does by more than
 * `CLIP_LOOK_OVER` (a pose that already bends the neck far takes less, or none). `alone`: the pose's own stretch.
 */
export function clipLookShare(region: NeckRegion, skin: NeckSkin, row: ArrayLike<number>, bones: number, chain: NeckChain, neckShare: number, caps: LookCaps): {share: number; alone: number; withLook: number; full: number} {
    const alone = neckStretch(region, skin, row).p99;
    const limit = Math.max(NECK_STRETCH_MAX, alone * CLIP_LOOK_OVER);
    let full = 1;
    for (const share of CLIP_LOOK_SHARES) {
        const stretch = share > 0 ? worstLook(region, skin, row, bones, chain, neckShare, caps, share).p99 : alone;
        if (share === 1) full = stretch;
        if (stretch <= limit) return {share, alone, withLook: stretch, full};
    }
    return {share: 0, alone, withLook: alone, full};
}

const W = new Vector3();
const W2 = new Vector3();
/** How far a bone row has turned the head from its rest heading against the chest's (degrees, any axis): 0 at rest. */
export function headTurnDeg(rig: LocoRig, row: ArrayLike<number>): number {
    if (rig.head < 0 || rig.chest < 0) return 0;
    // (A bone's turn from rest is its row's own 3×3: the forward's image is its third column.)
    const forward = (bone: number, out: Vector3) => out.set(row[bone * 12 + 2], row[bone * 12 + 6], row[bone * 12 + 10]).normalize();
    const a = forward(rig.head, W2);
    const b = forward(rig.chest, W);
    return Math.acos(Math.min(Math.max(a.dot(b), -1), 1)) / DEG;
}
