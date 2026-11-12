/**
 * The rocks as they are drawn (the owner: "some animals show inside rocks";
 * graphics batch 5 draws each decor rock as one of the asset lane's rocks,
 * `rock-assets.ts` rockAssetFor, whose footprint is not the old procedural
 * rock's circle): each rock's oriented box (the asset's bounds, scaled and
 * turned as the renderer places it) from its foot to its top. The map keeps
 * every standing, resting and colony spot out of these (`world-sampler.ts`
 * blocked; `water.ts` for the sea floor's animals), and the validator fails a
 * body that reaches into one. On top of a rock (its `ledge` and `rock_face`
 * points) is fine: that is the rock's surface.
 *
 * The one source of every solid rock (scenery lane, the motion 100x pass, for the collisions lane): the decor's rocks,
 * and the mountain's crags, boulders and scree stones 0.3 m and more across (`rock-layout.ts`; smaller stones are
 * walked over), each tagged with its `source`.
 */

import {worldDecor} from "@/ark-scene/decor";
import {rockAssetFor, rockBox} from "@/ark-scene/rock-assets";
import {DECOR_SINK} from "@/ark-scene/micro-decor";
import {allMountainRocks, pieceBox, SOLID_ACROSS} from "@/ark-scene/rock-layout";

/** A drawn rock: its middle, its turn, its half-extents along its own x and z, its foot and its top (m). */
export type DrawnRock = {x: number; z: number; cos: number; sin: number; hx0: number; hx1: number; hz0: number; hz1: number; y0: number; y1: number; reach: number; /** What it is: a decor rock, or the mountain's crag, boulder or scree stone (`rock-layout.ts`). */ source?: "decor" | "crag" | "boulder" | "scree"};

/** The rock index's cell (m): each rock is listed in every cell its reach covers. */
export const ROCK_CELL = 4;
const CELL = ROCK_CELL;
let index: Map<string, DrawnRock[]> | null = null;
let list: DrawnRock[] | null = null;

/** Every decor rock as drawn (an asset rock's box; with the rock set missing, the procedural rock's footprint). */
export function drawnRocks(): DrawnRock[] {
    if (list) return list;
    list = [];
    for (const item of worldDecor()) {
        if (item.kind !== "rock") continue;
        const placed = rockAssetFor(item);
        if (placed) {
            // The asset rock's box, turned and leaned with its slope as drawn (rock-assets.ts rockBox).
            const box = rockBox(placed);
            list.push({...box, reach: Math.hypot(Math.max(-box.hx0, box.hx1), Math.max(-box.hz0, box.hz1)), source: "decor"});
        } else {
            // vegetation.ts rock(): about 1.9 × 1.6 m at scale 1, about 1 m tall.
            const r = 0.9 * item.scale;
            list.push({x: item.x, z: item.z, cos: 1, sin: 0, hx0: -r, hx1: r, hz0: -r * 0.85, hz1: r * 0.85, y0: item.y - DECOR_SINK, y1: item.y - DECOR_SINK + 0.6 * item.scale, reach: r * 1.32, source: "decor"});
        }
    }
    // The mountain's crags, boulders and the scree stones an animal walks round (rock-layout.ts).
    for (const piece of allMountainRocks()) {
        if (piece.across < SOLID_ACROSS) continue;
        const box = pieceBox(piece);
        list.push({x: piece.x, z: piece.z, cos: Math.cos(piece.yaw), sin: Math.sin(piece.yaw), ...box, reach: Math.hypot(Math.max(-box.hx0, box.hx1), Math.max(-box.hz0, box.hz1)), source: piece.role});
    }
    return list;
}

function cells(): Map<string, DrawnRock[]> {
    if (index) return index;
    index = new Map();
    for (const rock of drawnRocks()) {
        for (let i = Math.floor((rock.x - rock.reach) / CELL); i <= Math.floor((rock.x + rock.reach) / CELL); i++) {
            for (let j = Math.floor((rock.z - rock.reach) / CELL); j <= Math.floor((rock.z + rock.reach) / CELL); j++) {
                const key = `${i},${j}`;
                const at = index.get(key) ?? [];
                at.push(rock);
                index.set(key, at);
            }
        }
    }
    return index;
}

/**
 * Does a body (a vertical cylinder of `radius` round x, z, from `base` to
 * `base + height`) reach into this rock? Without a height: does the rock's
 * footprint, widened by the radius, cover the point.
 */
export function touchesRock(rock: DrawnRock, x: number, z: number, radius: number, base = -Infinity, height = Infinity): boolean {
    // Into the rock's own frame (three.js turns about +y by its yaw: local x = dx cos − dz sin, local z = dx sin + dz cos).
    const dx = x - rock.x;
    const dz = z - rock.z;
    const lx = dx * rock.cos - dz * rock.sin;
    const lz = dx * rock.sin + dz * rock.cos;
    if (lx < rock.hx0 - radius || lx > rock.hx1 + radius || lz < rock.hz0 - radius || lz > rock.hz1 + radius) return false;
    // (With a body's height: below the rock's foot, or standing on its top, is clear of it.)
    return !(Number.isFinite(base) && (base + height <= rock.y0 || base >= rock.y1 - 0.02));
}

/**
 * Does a body (a vertical cylinder of `radius` round x, z, from `base` to
 * `base + height`) reach into a drawn rock? Without a height: any rock whose
 * footprint (widened by the radius) covers the point. Every cell the body
 * covers is searched, not only the one its middle is in: a rock is listed by
 * its own reach, so a body at a cell's edge can touch a rock listed only in
 * the next cell (the behaviour lane's find, 2026-11-11).
 */
export function inRock(x: number, z: number, radius: number, base = -Infinity, height = Infinity): boolean {
    const grid = cells();
    // (The widened footprint is a box in the rock's own frame: a turned rock's corner reaches √2 times the radius.)
    const r = Math.max(radius, 0) * Math.SQRT2;
    const i0 = Math.floor((x - r) / CELL);
    const i1 = Math.floor((x + r) / CELL);
    const j0 = Math.floor((z - r) / CELL);
    const j1 = Math.floor((z + r) / CELL);
    for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
            for (const rock of grid.get(`${i},${j}`) ?? []) if (touchesRock(rock, x, z, radius, base, height)) return true;
        }
    }
    return false;
}
