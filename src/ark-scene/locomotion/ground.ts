/**
 * The ground the feet stand on: the terrain's height and normal (`world.ts` sampleGround, the same surface the
 * scene draws), read through a cached 25 cm grid with bilinear filtering (a terrain sample costs a few
 * microseconds; a foot asks every frame). Other lanes may replace it (`setLocoGround`): rock tops, decks,
 * a log, with the same `GroundQuery`.
 */

import {heightAt} from "@/ark-scene/world";
import type {GroundQuery, GroundSample} from "@/ark-scene/locomotion/types";

const CELL = 0.25;
const cache = new Map<number, number>();
const key = (ix: number, iz: number) => (ix + 32768) * 65536 + (iz + 32768);

function corner(ix: number, iz: number): number {
    const k = key(ix, iz);
    let h = cache.get(k);
    if (h === undefined) {
        if (cache.size > 250_000) cache.clear();
        h = heightAt(ix * CELL, iz * CELL);
        cache.set(k, h);
    }
    return h;
}

/** The terrain under a point: bilinear on the 25 cm grid, its normal from the same cell's slope. */
export function terrainGround(x: number, z: number): GroundSample {
    const fx = x / CELL;
    const fz = z / CELL;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const h00 = corner(ix, iz);
    const h10 = corner(ix + 1, iz);
    const h01 = corner(ix, iz + 1);
    const h11 = corner(ix + 1, iz + 1);
    const height = (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
    const dx = ((h10 - h00) * (1 - tz) + (h11 - h01) * tz) / CELL;
    const dz = ((h01 - h00) * (1 - tx) + (h11 - h10) * tx) / CELL;
    const l = Math.hypot(dx, 1, dz);
    return {height, nx: -dx / l, ny: 1 / l, nz: -dz / l};
}

let ground: GroundQuery = terrainGround;

/** The ground the locomotion layer plants feet on (the terrain unless another lane set one). */
export function locoGround(): GroundQuery {
    return ground;
}

/** Replace the ground (L3/L6: rock tops, decks); null restores the terrain. */
export function setLocoGround(query: GroundQuery | null) {
    ground = query ?? terrainGround;
}

/** A flat ground at a height (tests, the recordings' plinth). */
export const flatGround = (height = 0): GroundQuery => () => ({height, nx: 0, ny: 1, nz: 0});
