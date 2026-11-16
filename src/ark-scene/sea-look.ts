/**
 * The sea's own look from under the surface (3.3 batch, lane E; the owner, 2026-11-16: "should feel and maybe render
 * like a whole new world"): the pure parts. Three.js-free, so the tests run in node.
 *
 * - **The water's colour and haze by depth** (`underwaterLook`): the old view was one blue-green at one density
 *   wherever the camera was. Now the shallows are bright turquoise and clear, and going down the water takes the
 *   green out and thickens: a deep, dim blue by ten metres, and on toward black far below that. Night is the same
 *   curve from a dark start.
 * - **Marine snow** (`snowPoint`): motes that sink and drift all round the camera wherever it is under the sea, a
 *   field that wraps about the camera so it never runs out. On the sea's shared clock, and every speed is a whole
 *   number of boxes per clock period, so the clock's wrap is never seen. `sea-look-render.ts` draws it (one draw
 *   call, positions worked out in the vertex shader by the same rule as here).
 *
 * Visual only: nothing here changes what happens on the Ark.
 */

import type {QualityTier} from "@/ark-scene/post";

export type UnderwaterLook = {r: number; g: number; b: number; density: number};

/** The water's colours (sRGB triples, 0…1): the shallows and the deep, by day and by night. */
const DAY_SHALLOW = [0.2, 0.56, 0.6];
const DAY_DEEP = [0.045, 0.2, 0.36];
const NIGHT_SHALLOW = [0.043, 0.133, 0.16];
const NIGHT_DEEP = [0.012, 0.045, 0.085];
/** The haze (FogExp2's density) at the surface and far down: half the view gone by about 15 m, then by about 9 m. */
export const HAZE_SHALLOW = 0.046;
export const HAZE_DEEP = 0.078;
/** The depth (m) over which the shallows' look gives way to the deep's (1 − 1/e of the way at this depth). */
export const LOOK_FALLOFF = 5;

/** Below `ABYSS_FROM` metres the colour dims on toward black: by `ABYSS_DIM` of itself, 1 − 1/e of that `ABYSS_FALLOFF` further down. */
const ABYSS_FROM = 10;
const ABYSS_FALLOFF = 30;
const ABYSS_DIM = 0.85;

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);

/** How far toward the deep's look the water is at this depth (m below the surface): 0 at the surface, toward 1 far down. */
export function deepness(depth: number): number {
    return 1 - Math.exp(-Math.max(depth, 0) / LOOK_FALLOFF);
}

/**
 * The water's colour and haze round a camera `depth` metres under the surface at this daylight (0 night … 1 day).
 * Written into `out` (no allocation: the scene asks every frame). `clarity` scales the haze (`openWaterClarity`: the
 * open ocean's blue water is clearer than the island's shelf; 1 there, as before).
 */
export function underwaterLook(depth: number, daylight: number, out: UnderwaterLook, clarity = 1): UnderwaterLook {
    const k = deepness(depth);
    const day = clamp01(daylight);
    // (Past the shelf the light itself runs out: the bigger island's sea falls away to a hundred metres.)
    const dim = 1 - ABYSS_DIM * (1 - Math.exp(-Math.max(depth - ABYSS_FROM, 0) / ABYSS_FALLOFF));
    const channel = (i: number): number => {
        const night = NIGHT_SHALLOW[i] + (NIGHT_DEEP[i] - NIGHT_SHALLOW[i]) * k;
        const lit = DAY_SHALLOW[i] + (DAY_DEEP[i] - DAY_SHALLOW[i]) * k;
        return (night + (lit - night) * day) * dim;
    };
    out.r = channel(0);
    out.g = channel(1);
    out.b = channel(2);
    out.density = (HAZE_SHALLOW + (HAZE_DEEP - HAZE_SHALLOW) * k) * clarity;
    return out;
}

/**
 * The open ocean's clarity (graphics pass 2, lane OCEAN): over a floor `floorDepth` m down. The island's shelf keeps its
 * haze (1, the look above); past it, where the floor falls away beyond 30 m, the blue water clears to OPEN_CLARITY of
 * that haze by 60 m: half the view gone by about 35 m instead of 15, so a whale cruising there is seen, as divers see
 * them in blue water. Only the haze: the colour still darkens with the camera's own depth.
 */
export const OPEN_CLARITY = 0.42;
export function openWaterClarity(floorDepth: number): number {
    const t = clamp01((floorDepth - 30) / 30);
    return 1 - (1 - OPEN_CLARITY) * t * t * (3 - 2 * t);
}

// MARK: - Marine snow

/** How many motes each tier draws (the low tier a fifth of the high one's). */
export const SNOW_COUNT: Record<QualityTier, number> = {high: 1500, medium: 800, low: 300};
/** The box the field fills about the camera (m): wide, and as tall as the haze lets it be seen. */
export const SNOW_BOX = {x: 10, y: 6, z: 10};
/** The sea's shared clock wraps at this many seconds (`fish-schools.ts` SEA_CLOCK_PERIOD): the drift is whole boxes per period. */
export const SNOW_PERIOD = 600;
/** Whole boxes drifted per period: along x, down, along z (so 600 s on, every mote is where it began). */
const SNOW_LAPS = {x: 1, y: 3, z: 1};
/** No mote is drawn nearer the surface than this (m under it): the field never pokes out of the sea. */
export const SNOW_CEILING = 0.06;

const fract = (v: number): number => v - Math.floor(v);

/** A mote's own three numbers in 0…1 (its place in the box and its phase), from its index alone. */
export function snowSeed(i: number, out: {x: number; y: number; z: number}): {x: number; y: number; z: number} {
    // (Weyl sequences on three irrationals: even cover, no clumps, no table.)
    out.x = fract(0.5 + i * 0.7548776662466927);
    out.y = fract(0.5 + i * 0.5698402909980532);
    out.z = fract(0.5 + i * 0.6180339887498949);
    return out;
}

/**
 * Where mote `i` is at clock second `t` for a camera at (cx, cy, cz): its seed's place in the box, sunk and drifted by
 * the clock (a slow sway on top), wrapped about the camera. `out.y` above `-SNOW_CEILING` means it is not drawn.
 * The vertex shader (`sea-look-render.ts`) is this same rule.
 */
export function snowPoint(i: number, t: number, cx: number, cy: number, cz: number, out: {x: number; y: number; z: number}): {x: number; y: number; z: number} {
    snowSeed(i, out);
    const phase = out.x * 6.2831853 + out.z * 4;
    const u = t / SNOW_PERIOD;
    // (The sway's rate is a whole number of turns per period too.)
    const sway = 0.12 * Math.sin(6.2831853 * 7 * u + phase);
    const x = (out.x + SNOW_LAPS.x * u) * SNOW_BOX.x + sway;
    const y = (out.y - SNOW_LAPS.y * u) * SNOW_BOX.y;
    const z = (out.z + SNOW_LAPS.z * u) * SNOW_BOX.z + 0.12 * Math.cos(6.2831853 * 5 * u + phase);
    out.x = cx + (fract((x - cx) / SNOW_BOX.x + 0.5) - 0.5) * SNOW_BOX.x;
    out.y = cy + (fract((y - cy) / SNOW_BOX.y + 0.5) - 0.5) * SNOW_BOX.y;
    out.z = cz + (fract((z - cz) / SNOW_BOX.z + 0.5) - 0.5) * SNOW_BOX.z;
    return out;
}

/** After this long above the sea (s) the look's drawn parts are let go (built again on the next dive). */
export const SEA_LOOK_LINGER = 30;
