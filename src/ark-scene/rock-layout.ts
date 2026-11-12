/**
 * Where the mountain's rock shows (scenery lane, the motion 100x pass; the owner: "mountain rocks look like
 * rectangles"), replacing the stacked-box strata (`props/areas.ts`, before):
 *
 * - crags: bedded rock standing out of the steep ground in bands that follow the contours, as rock bands do, each
 *   turned along its contour, tilted most of the way to the slope and sunk until no edge of its base shows;
 * - scree: a fan of broken stones below each crag, downhill, finer near the crag and coarser toward the toe (big
 *   blocks roll furthest), each lying on the slope, part buried;
 * - boulders: blocks fallen and come to rest on the lower slopes, sunk into the ground on their uphill side.
 *
 * Kept off every tree's trunk, off the decor's rocks, out of the mountain animals' clearing, off the river and below
 * the snow (high ones dusted). Pure and deterministic (the terrain, the decor and a seed): `props/areas.ts` draws
 * these and `map/rocks.ts` lists the solid ones as the obstacles the animals walk round (L5) and the validator checks.
 */

import {forestFill, worldDecor} from "@/ark-scene/decor";
import {cachedRock, orient, ROCK_DETAIL, ROCK_VARIANTS, tiltedBox, type RockStyle} from "@/ark-scene/rock-shapes";
import {allMounds, moundFoot} from "@/ark-scene/mounds";
import {snowCover} from "@/ark-scene/snow";
import {treeBody} from "@/ark-scene/tree-spacing";
import {fbm, heightAt, riverDistance, sampleGround, seeded, smoothstep, ZONE_SITES, zoneAt} from "@/ark-scene/world";

/** A rock as placed: its shape, where its base's middle is, its turn about up, its tilt (up vector) and size. */
export type RockPiece = {
    role: "crag" | "boulder" | "scree";
    style: RockStyle;
    variant: number;
    x: number;
    y: number;
    z: number;
    yaw: number;
    up: [number, number, number];
    scale: number;
    /** 0.9…1.1: a little lighter or darker than its kind. */
    shade: number;
    /** Above the snow's usual edge: dusted. */
    dusted: boolean;
    /** Across its footprint (m): 0.3 and more is solid to an animal. */
    across: number;
};

/** Crags stand below this (m); above `DUST_FROM` their tops are dusted (rock through the high snow, as on a real peak). */
export const CRAG_CEILING = 38;
export const DUST_FROM = 20;
/** Smaller than this across (m), a stone is walked over: not an obstacle. */
export const SOLID_ACROSS = 0.3;

const STEP = 1.2;

function normalAt(x: number, z: number): [number, number, number] {
    const dx = (heightAt(x + STEP, z) - heightAt(x - STEP, z)) / (2 * STEP);
    const dz = (heightAt(x, z + STEP) - heightAt(x, z - STEP)) / (2 * STEP);
    const l = Math.hypot(dx, 1, dz);
    return [-dx / l, 1 / l, -dz / l];
}

/** The rock's footprint corners and middle, its base's points in the world for an origin at height 0. */
function baseRing(style: RockStyle, variant: number, scale: number, rotate: (x: number, y: number, z: number) => [number, number, number]): Array<[number, number, number]> {
    const b = cachedRock(style, variant, ROCK_DETAIL[style][0]).bounds;
    const points: Array<[number, number, number]> = [];
    for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        // An ellipse inside the bounds: the base's real outline is about that (a cut ellipsoid).
        const x = (Math.cos(a) * 0.5 + 0.5) * (b.max[0] - b.min[0]) * 0.92 + b.min[0] * 0.92;
        const z = (Math.sin(a) * 0.5 + 0.5) * (b.max[2] - b.min[2]) * 0.92 + b.min[2] * 0.92;
        points.push(rotate(x * scale, 0, z * scale));
    }
    points.push(rotate(((b.min[0] + b.max[0]) / 2) * scale, 0, ((b.min[2] + b.max[2]) / 2) * scale));
    return points;
}

/** How far to lower the origin (from the ground at x, z) so every point of the base is under the ground by `margin`. */
function sinkFor(x: number, z: number, ring: Array<[number, number, number]>, margin: number): number {
    const ground = heightAt(x, z);
    let need = 0;
    for (const [dx, dy, dz] of ring) need = Math.max(need, ground + dy - heightAt(x + dx, z + dz) + margin);
    return need;
}

type Obstacle = {x: number; z: number; r: number};

class Grid {
    private readonly cells = new Map<string, Obstacle[]>();
    constructor(private readonly size: number) {}
    add(o: Obstacle) {
        const i0 = Math.floor((o.x - o.r) / this.size);
        const i1 = Math.floor((o.x + o.r) / this.size);
        const j0 = Math.floor((o.z - o.r) / this.size);
        const j1 = Math.floor((o.z + o.r) / this.size);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
            const key = `${i},${j}`;
            const list = this.cells.get(key);
            if (list) list.push(o);
            else this.cells.set(key, [o]);
        }
    }
    /** Whether a circle reaches any obstacle: every cell the circle covers (an obstacle is listed in each cell it covers). */
    hits(x: number, z: number, r: number): boolean {
        for (let i = Math.floor((x - r) / this.size); i <= Math.floor((x + r) / this.size); i++) {
            for (let j = Math.floor((z - r) / this.size); j <= Math.floor((z + r) / this.size); j++) {
                for (const o of this.cells.get(`${i},${j}`) ?? []) if (Math.hypot(o.x - x, o.z - z) < o.r + r) return true;
            }
        }
        return false;
    }
}

let cached: {crags: RockPiece[]; boulders: RockPiece[]; scree: RockPiece[]} | null = null;

/** The mountain's crags, boulders and scree. */
export function mountainRocks(): {crags: RockPiece[]; boulders: RockPiece[]; scree: RockPiece[]} {
    if (cached) return cached;
    const random = seeded(20261112);
    // What the rocks keep off: trunks (with a hand's width), the decor's own rocks, each other.
    const trunks = new Grid(4);
    for (const item of [...worldDecor(), ...forestFill()]) {
        const body = treeBody(item);
        if (body && !body.low) trunks.add({x: body.x, z: body.z, r: body.trunk + 0.25});
    }
    const decorRocks = new Grid(4);
    for (const item of worldDecor()) if (item.kind === "rock") decorRocks.add({x: item.x, z: item.z, r: 0.9 * item.scale});
    // The termite mounds keep their ground too.
    for (const mound of allMounds()) decorRocks.add({x: mound.x, z: mound.z, r: moundFoot(mound)});
    const placed = new Grid(6);
    const site = ZONE_SITES.mountains;
    const clearOf = (x: number, z: number, r: number) => !trunks.hits(x, z, r) && !decorRocks.hits(x, z, r) && !placed.hits(x, z, r) && Math.hypot(x - site.x, z - site.z) > site.clearing + 2 + r && riverDistance(x, z) > 4 + r;

    const crags: RockPiece[] = [];
    const boulders: RockPiece[] = [];
    const scree: RockPiece[] = [];
    const across = (style: RockStyle, variant: number, scale: number) => {
        const b = cachedRock(style, variant, ROCK_DETAIL[style][0]).bounds;
        return Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) * scale;
    };
    const lay = (role: RockPiece["role"], style: RockStyle, variant: number, x: number, z: number, yaw: number, up: [number, number, number], scale: number, bury: number, shade: number, dusted: boolean): RockPiece => {
        const ring = baseRing(style, variant, scale, orient(up, yaw));
        const height = cachedRock(style, variant, ROCK_DETAIL[style][0]).bounds.max[1] * scale;
        const y = heightAt(x, z) - sinkFor(x, z, ring, 0.04) - bury * height;
        return {role, style, variant, x, y, z, yaw, up, scale, shade, dusted, across: across(style, variant, scale)};
    };

    // Crags: a jittered grid over the mountain, in bands along the contours.
    const CELL = 3.5;
    for (let gx = -132; gx < 132; gx += CELL) {
        for (let gz = -132; gz < 132; gz += CELL) {
            const x = gx + random() * CELL;
            const z = gz + random() * CELL;
            const roll = random();
            const sizeRoll = random();
            const variant = Math.floor(random() * ROCK_VARIANTS.crag);
            const jitter = random() - 0.5;
            const shadeRoll = random();
            const sample = sampleGround(x, z);
            if (sample.land < 0.92 || sample.height < 3 || sample.height > CRAG_CEILING) continue;
            if (zoneAt(sample) !== "mountains") continue;
            const n = normalAt(x, z);
            const slope = 1 - n[1];
            if (n[1] > 0.92 || n[1] < 0.3) continue;
            // Through the snow only high up (dusted): never a bare crag in a snowfield low down.
            if (sample.height < DUST_FROM && snowCover(sample.height, slope, 0, 0.35).sure > 0.02) continue;
            // Bands along the contours (a wavering height), broken into reaches; more where the ground is steeper.
            const band = 0.5 + 0.5 * Math.sin(sample.height * 0.62 + 5 * fbm(x * 0.045 + 3, z * 0.045 - 8));
            const reach = smoothstep(0.3, 0.6, fbm(x * 0.07 - 11, z * 0.07 + 4));
            const want = smoothstep(0.3, 0.75, band) * (0.35 + 0.65 * reach) * smoothstep(0.05, 0.3, slope);
            if (roll > want) continue;
            // As big as the spot allows: a tree's trunk or another rock near, and the crag is a smaller one.
            // Bigger where the ground is steeper (the rock the slope is made of shows most there).
            const full = (1.2 + 1.8 * sizeRoll * sizeRoll) * (0.85 + 0.6 * smoothstep(0.2, 0.6, slope));
            // Its reach: the furthest its blocks go from its middle (a crag of four blocks is wider than one).
            const b = cachedRock("crag", variant, ROCK_DETAIL.crag[0]).bounds;
            const extent = Math.hypot(Math.max(-b.min[0], b.max[0]), Math.max(-b.min[2], b.max[2]));
            const scale = [1, 0.75, 0.55].map((f) => full * f).find((size) => clearOf(x, z, extent * size));
            if (scale === undefined) continue;
            const r = extent * scale;
            // Along the contour: the crag's long side (its x) across the slope.
            const fall = Math.hypot(n[0], n[2]) || 1;
            const contour = [-n[2] / fall, n[0] / fall];
            const yaw = Math.atan2(-contour[1], contour[0]) + jitter * 0.5;
            const up: [number, number, number] = (() => {
                const u = [n[0] * 0.6, 0.4 + n[1] * 0.6, n[2] * 0.6];
                const l = Math.hypot(u[0], u[1], u[2]);
                return [u[0] / l, u[1] / l, u[2] / l];
            })();
            const dusted = sample.height > DUST_FROM && snowCover(sample.height, slope, 0, 0.35).mean > 0.1;
            const crag = lay("crag", "crag", variant, x, z, yaw, up, scale, 0.18, 0.92 + 0.16 * shadeRoll, dusted);
            // On ground so steep that sinking its whole base buries it: no crag (the terrain's own rock shows there).
            if (shows(crag) < 0.4) continue;
            crags.push(crag);
            placed.add({x, z, r: r * 0.8});
            // Its scree, fanned downhill from its foot.
            const down = [n[0] / fall, n[2] / fall];
            const side = [-down[1], down[0]];
            const fan = 3 + 2.6 * scale;
            const stones = Math.round(26 + 22 * scale);
            const start = 1.1 * scale;
            for (let k = 0; k < stones; k++) {
                const t = Math.pow(random(), 0.75);
                const lateral = (random() - 0.5) * (1.6 * scale + t * fan * 0.9);
                const sizeR = random();
                const sv = random();
                const yawR = random() * Math.PI * 2;
                const toneR = random();
                const d = start + t * fan;
                const px = x + down[0] * d + side[0] * lateral;
                const pz = z + down[1] * d + side[1] * lateral;
                const g = sampleGround(px, pz);
                if (g.land < 0.9 || g.height < 0.5 || g.height > CRAG_CEILING) continue;
                const gn = normalAt(px, pz);
                if (gn[1] < 0.6 || snowCover(g.height, 1 - gn[1], 0, 0.35).sure > 0.02) continue;
                // Mostly fine stuff, a few blocks; coarser toward the toe.
                const size = (0.14 + 0.55 * sizeR * sizeR * sizeR) * (0.75 + 0.7 * t);
                const big = size > 0.5;
                const style: RockStyle = big ? "boulder" : "scree";
                const v = Math.floor(sv * ROCK_VARIANTS[style]);
                const stoneScale = big ? size / 1.6 : size;
                const rr = Math.max(across(style, v, stoneScale) * 0.5, 0.05);
                if (trunks.hits(px, pz, rr) || decorRocks.hits(px, pz, rr) || (big && placed.hits(px, pz, rr))) continue;
                // Not under the crag itself.
                if (Math.hypot(px - x, pz - z) < r * 0.55) continue;
                const piece = lay(big ? "boulder" : "scree", style, v, px, pz, yawR, gn, stoneScale, 0.3, 0.9 + 0.2 * toneR, false);
                (big ? boulders : scree).push(piece);
                if (big) placed.add({x: px, z: pz, r: rr});
            }
        }
    }

    // Boulders fallen on the lower slopes (and the mountain's foot), sunk on their uphill side.
    const boulderRandom = seeded(20261113);
    for (let gx = -132; gx < 132; gx += 4) {
        for (let gz = -132; gz < 132; gz += 4) {
            const x = gx + boulderRandom() * 4;
            const z = gz + boulderRandom() * 4;
            const roll = boulderRandom();
            const sizeRoll = boulderRandom();
            const variant = Math.floor(boulderRandom() * ROCK_VARIANTS.boulder);
            const yaw = boulderRandom() * Math.PI * 2;
            const shadeRoll = boulderRandom();
            const sample = sampleGround(x, z);
            if (sample.land < 0.92 || sample.height < 1.5 || sample.height > CRAG_CEILING) continue;
            if (zoneAt(sample) !== "mountains") continue;
            const n = normalAt(x, z);
            if (n[1] < 0.62 || snowCover(sample.height, 1 - n[1], 0, 0.35).sure > 0.02) continue;
            const want = 0.1 * smoothstep(0.45, 0.7, fbm(x * 0.06 + 21, z * 0.06 - 2));
            if (roll > want) continue;
            const scale = 0.35 + 0.65 * sizeRoll * sizeRoll;
            const rr = across("boulder", variant, scale) * 0.6;
            if (!clearOf(x, z, rr)) continue;
            // Resting on the slope: tilted part of the way to it, sunk a fifth.
            const up: [number, number, number] = (() => {
                const u = [n[0] * 0.5, 0.5 + n[1] * 0.5, n[2] * 0.5];
                const l = Math.hypot(u[0], u[1], u[2]);
                return [u[0] / l, u[1] / l, u[2] / l];
            })();
            boulders.push(lay("boulder", "boulder", variant, x, z, yaw, up, scale, 0.2, 0.9 + 0.2 * shadeRoll, false));
            placed.add({x, z, r: rr});
        }
    }
    cached = {crags, boulders, scree};
    return cached;
}

/** How much of a piece stands out of the ground over its middle, as a share of its height. */
function shows(piece: RockPiece): number {
    const b = cachedRock(piece.style, piece.variant, ROCK_DETAIL[piece.style][0]).bounds;
    const [x, y, z] = piecePoint(piece, (b.min[0] + b.max[0]) / 2, b.max[1], (b.min[2] + b.max[2]) / 2);
    return (y - heightAt(x, z)) / (b.max[1] * piece.scale);
}

/** Every rock piece (crags, boulders, scree). */
export function allMountainRocks(): RockPiece[] {
    const {crags, boulders, scree} = mountainRocks();
    return [...crags, ...boulders, ...scree];
}

/**
 * A piece's box in its own turned frame, as `map/rocks.ts` keeps rocks (the turn's axes on the ground; the tilt folded
 * into the box): half-extents along its x and z, its foot and top.
 */
export function pieceBox(piece: RockPiece): {hx0: number; hx1: number; hz0: number; hz1: number; y0: number; y1: number} {
    return tiltedBox(cachedRock(piece.style, piece.variant, ROCK_DETAIL[piece.style][0]).bounds, piece.scale, piece.up, piece.yaw, piece.y);
}

/** A rock-space point of the piece in the world (the renderer's matrix, by hand). */
export function piecePoint(piece: RockPiece, x: number, y: number, z: number): [number, number, number] {
    const [dx, dy, dz] = orient(piece.up, piece.yaw)(x * piece.scale, y * piece.scale, z * piece.scale);
    return [piece.x + dx, piece.y + dy, piece.z + dz];
}
