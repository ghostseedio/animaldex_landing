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
 */

import {worldDecor} from "@/ark-scene/decor";
import {rockAssetFor, rockAssetInfo} from "@/ark-scene/rock-assets";
import {DECOR_SINK} from "@/ark-scene/micro-decor";

/** A drawn rock: its middle, its turn, its half-extents along its own x and z, its foot and its top (m). */
export type DrawnRock = {x: number; z: number; cos: number; sin: number; hx0: number; hx1: number; hz0: number; hz1: number; y0: number; y1: number; reach: number};

const CELL = 4;
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
            const b = rockAssetInfo(placed.id).bounds;
            const s = placed.scale;
            const hx0 = b.min[0] * s;
            const hx1 = b.max[0] * s;
            const hz0 = b.min[2] * s;
            const hz1 = b.max[2] * s;
            list.push({x: placed.x, z: placed.z, cos: Math.cos(placed.yaw), sin: Math.sin(placed.yaw), hx0, hx1, hz0, hz1, y0: placed.y + b.min[1] * s, y1: placed.y + b.max[1] * s, reach: Math.hypot(Math.max(-hx0, hx1), Math.max(-hz0, hz1))});
        } else {
            // vegetation.ts rock(): about 1.9 × 1.6 m at scale 1, about 1 m tall.
            const r = 0.9 * item.scale;
            list.push({x: item.x, z: item.z, cos: 1, sin: 0, hx0: -r, hx1: r, hz0: -r * 0.85, hz1: r * 0.85, y0: item.y - DECOR_SINK, y1: item.y - DECOR_SINK + 0.6 * item.scale, reach: r * 1.32});
        }
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
 * `base + height`) reach into a drawn rock? Without a height: any rock whose
 * footprint (widened by the radius) covers the point.
 */
export function inRock(x: number, z: number, radius: number, base = -Infinity, height = Infinity): boolean {
    for (const rock of cells().get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
        // Into the rock's own frame (three.js turns about +y by its yaw: local x = dx cos − dz sin, local z = dx sin + dz cos).
        const dx = x - rock.x;
        const dz = z - rock.z;
        const lx = dx * rock.cos - dz * rock.sin;
        const lz = dx * rock.sin + dz * rock.cos;
        if (lx < rock.hx0 - radius || lx > rock.hx1 + radius || lz < rock.hz0 - radius || lz > rock.hz1 + radius) continue;
        // (With a body's height: below the rock's foot, or standing on its top, is clear of it.)
        if (Number.isFinite(base) && (base + height <= rock.y0 || base >= rock.y1 - 0.02)) continue;
        return true;
    }
    return false;
}
