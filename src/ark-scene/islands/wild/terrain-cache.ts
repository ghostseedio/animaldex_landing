/**
 * The wild island's ground on a grid, sampled once (lazily) and read back by bilinear lookup: the slope for the
 * scenery and the map, without re-sampling the fields at every question. Pure: the same grid on every device.
 */

import {sampleWildGround} from "@/ark-scene/islands/wild/ground";
import {WILD_HALF} from "@/ark-scene/islands/wild/frame";

const STEP = 2;
const SIZE = Math.round((WILD_HALF * 2) / STEP) + 1;
let heights: Float32Array | null = null;

function grid(): Float32Array {
    if (heights) return heights;
    const out = new Float32Array(SIZE * SIZE);
    for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) out[row * SIZE + col] = sampleWildGround(-WILD_HALF + col * STEP, -WILD_HALF + row * STEP).height;
    }
    heights = out;
    return out;
}

/** The ground's height from the 2 m grid (bilinear). */
export function gridHeight(x: number, z: number): number {
    const h = grid();
    const fx = Math.min(Math.max((x + WILD_HALF) / STEP, 0), SIZE - 1.001);
    const fz = Math.min(Math.max((z + WILD_HALF) / STEP, 0), SIZE - 1.001);
    const c = Math.floor(fx);
    const r = Math.floor(fz);
    const tx = fx - c;
    const tz = fz - r;
    const a = h[r * SIZE + c];
    const b = h[r * SIZE + c + 1];
    const d = h[(r + 1) * SIZE + c];
    const e = h[(r + 1) * SIZE + c + 1];
    return a + (b - a) * tx + (d - a) * tz + (a - b - d + e) * tx * tz;
}

/** The ground's slope (rise over run) from the 2 m grid. */
export function gridSlope(x: number, z: number): number {
    const e = STEP;
    return Math.hypot(gridHeight(x + e, z) - gridHeight(x - e, z), gridHeight(x, z + e) - gridHeight(x, z - e)) / (2 * e);
}
