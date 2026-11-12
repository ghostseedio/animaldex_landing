/**
 * The behaviour lane's walk grid as the map reads it, prebuilt (phone start-up, 2026-11-11).
 *
 * Placement asks, for every walker, whether its spot is on the behaviour
 * lane's walk grid (`behaviour-nav.ts` NavGrid.walkable: dry, nothing in the
 * way, no steeper than its slope). Asking the grid itself built the whole
 * behaviour world inside the mount (its scenery sampler and the grid: about
 * 1.25 s on the phone proxy, before behaviour's own sliced build could run).
 * This is that grid's answer for every cell, at the two slopes placement asks
 * (a walker's and a mountain animal's), written by
 * `scripts/ark-map-walk-mask.mts` from the grid itself: two bits a cell,
 * read here with the grid's own cell rule. The test
 * (`src/lib/ark-map.test.ts`) holds it to the live grid cell for cell, so
 * placement's answers, and the places, are the same; when the terrain or the
 * scenery changes the test fails until the script is run again. A slope it
 * does not hold is asked of the grid itself, as before.
 */

import mask from "@/ark-scene/map/walk-mask.json";
import maskNoHamlet from "@/ark-scene/map/walk-mask-no-hamlet.json";
import maskV2 from "@/ark-scene/map/walk-mask-v2.json";
import {noHamlet} from "@/ark-scene/no-hamlet";
import {arkWorld, TERRAIN_HALF} from "@/ark-scene/world";

type MaskFile = {cell: number; size: number; half: number; version: string; slopes: Record<string, string>};
/**
 * Today's island's mask, and islands mode's (`no-hamlet.ts`: the wild island without its hamlet), each from its own world;
 * and the bigger wild island's (Part C, `world.ts` arkWorld() "v2": its 528 m square).
 */
const FILES = {hamlet: mask as MaskFile, noHamlet: maskNoHamlet as MaskFile, v2: maskV2 as MaskFile};
const fileKey = (): keyof typeof FILES => (arkWorld() === "v2" ? "v2" : noHamlet() ? "noHamlet" : "hamlet");
const fileNow = (): MaskFile => FILES[fileKey()];

const decoded = new Map<string, Uint8Array>();
let enabled = true;

/** Off: placement asks the behaviour lane's grid itself (the tests compare the two). */
export function setWalkMaskEnabled(on: boolean): void {
    enabled = on;
}

/** The base64 of a bit per cell (row-major, as NavGrid's cells), least significant bit first. */
function bits(slope: number): Uint8Array | null {
    const FILE = fileNow();
    const key = `${fileKey()}${slope}`;
    let out = decoded.get(key);
    if (out) return out;
    const text = FILE.slopes[String(slope)];
    if (!text) return null;
    const raw = typeof atob === "function" ? atob(text) : Buffer.from(text, "base64").toString("binary");
    out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    decoded.set(key, out);
    return out;
}

/** The grid's answer from the mask: walkable at this slope, or null when the mask does not hold that slope (or is off). */
export function maskWalkable(x: number, z: number, maxSlope: number): boolean | null {
    const FILE = fileNow();
    if (!enabled || FILE.half !== TERRAIN_HALF) return null;
    const cells = bits(maxSlope);
    if (!cells) return null;
    // (NavGrid.cellOf: the cell under the point, clamped to the grid.)
    const size = FILE.size;
    const i = Math.min(Math.max(Math.floor((x + TERRAIN_HALF) / FILE.cell), 0), size - 1);
    const j = Math.min(Math.max(Math.floor((z + TERRAIN_HALF) / FILE.cell), 0), size - 1);
    const k = j * size + i;
    return ((cells[k >> 3] >> (k & 7)) & 1) === 1;
}

/** Encode a grid's answers (a cell's walkability at a slope) as the mask file's base64. */
export function encodeMask(size: number, walkableAt: (k: number) => boolean): string {
    const out = new Uint8Array(Math.ceil((size * size) / 8));
    for (let k = 0; k < size * size; k++) if (walkableAt(k)) out[k >> 3] |= 1 << (k & 7);
    let raw = "";
    for (let i = 0; i < out.length; i++) raw += String.fromCharCode(out[i]);
    return typeof btoa === "function" ? btoa(raw) : Buffer.from(raw, "binary").toString("base64");
}

/** The behaviour sampler's version the mask was written from (for the test's message). */
export const WALK_MASK_VERSION = FILES.hamlet.version;
/** Islands mode's (`no-hamlet.ts`). */
export const WALK_MASK_NO_HAMLET_VERSION = FILES.noHamlet.version;
/** The bigger wild island's (Part C, v2). */
export const WALK_MASK_V2_VERSION = FILES.v2.version;
