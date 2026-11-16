/**
 * Animals' reflections in still water (p3, lane REFLECT). The owner, 2026-11-16: "can we have animal reflections in
 * water where it's more realistic".
 *
 * On still water only (the town's canal, millpond, farm pond, pools and harbour basin; the wild island's lake, ponds
 * and river), and near the camera only, each animal standing in, on or beside the water (or a bird flying low over it)
 * is drawn a second time, mirrored about that water's surface (`water-reflect-render.ts`: the same instanced or rigged
 * draw, the same pose and clip frame). Never on the open sea, whose waves break any mirror; never a second full-scene
 * render pass, which a phone cannot afford.
 *
 * This file is the rule, pure (no three.js): where the still water is (`stillWaterAt`), which plane an animal is
 * mirrored about (`reflectPlane`: the water under its middle, else under its head or tail end, so a deer drinking
 * from the bank is mirrored too), how strong its reflection is (`reflectStrength`), the tier's budget, and the mirror
 * itself (`mirrorY`, `reflectedOnPlane`: the shader's own arithmetic, so the tests hold it).
 */

import {arkWorld, sampleGround} from "@/ark-scene/world";
import {FRESH_LEVEL, freshFrom, freshLevelFrom, islandWaterNow} from "@/ark-scene/water-level";
import type {QualityTier} from "@/ark-scene/post";

/** The water's colour a reflection is tinted toward: the town's fresh water, the wild island's lake, the harbour's sea. */
export const REFLECT_TINT = {town: 0, wild: 1, harbour: 2} as const;
export type ReflectTint = (typeof REFLECT_TINT)[keyof typeof REFLECT_TINT];

/** Still water at a point: its surface (m) and the colour of its water. */
export type StillWater = {level: number; tint: ReflectTint};

/**
 * Per tier: how many animals are reflected at most (nearest first) and how near the camera (m). Off on the low tier
 * (and the lighter view): an extra draw per species is what that tier cannot spare.
 */
export const REFLECT_TIERS: Record<QualityTier, {count: number; within: number} | null> = {
    high: {count: 32, within: 40},
    medium: {count: 12, within: 25},
    low: null
};

/** At most this many reflected instances per species mesh (the shader's per-instance plane array). */
export const REFLECT_PER_MESH = 16;

/** How high over its water an animal's lowest point may be and still be reflected (m): a bird flying low, a deer on a bank. */
export const REFLECT_ABOVE = 7;

/**
 * The still water at a point, or null (dry land, the open sea). `seaLevel`: the sea's level now (the harbour's).
 * The town answers inside its square (`IslandWater.still`); elsewhere the wild island's fresh water (the lake, the
 * ponds, the river) at its own level (`water-level.ts`). Into `out`, so a frame allocates nothing.
 */
export function stillWaterAt(x: number, z: number, seaLevel: number, out: StillWater): StillWater | null {
    const own = islandWaterNow()?.still?.(x, z);
    if (own !== undefined) {
        if (own === null) return null;
        if (Number.isNaN(own)) {
            out.level = seaLevel;
            out.tint = REFLECT_TINT.harbour;
        } else {
            out.level = own;
            out.tint = REFLECT_TINT.town;
        }
        return out;
    }
    const sample = sampleGround(x, z);
    if (freshFrom(sample, x, z) < 0.5) return null;
    // (The bed under the surface: a drawn lake has its ground below its level; a "fresh" sample above it is a bank.)
    const level = arkWorld() === "v2" ? freshLevelFrom(sample) : FRESH_LEVEL;
    if (sample.height > level + 0.05) return null;
    out.level = level;
    out.tint = REFLECT_TINT.wild;
    return out;
}

/**
 * The plane an animal is mirrored about: the still water under its middle; else under the end of its body (`reach`
 * metres along its heading `fx, fz` either way: a deer at the bank with its muzzle in the water). Null with no still
 * water under any of them: then it has no reflection.
 */
export function reflectPlane(x: number, z: number, fx: number, fz: number, reach: number, still: (x: number, z: number) => StillWater | null): StillWater | null {
    const middle = still(x, z);
    if (middle) return middle;
    const front = still(x + fx * reach, z + fz * reach);
    if (front) return front;
    return still(x - fx * reach, z - fz * reach);
}

/**
 * How strong an animal's reflection is (0 none … 1): only with part of it above the water (`top` over the surface `h`)
 * and its lowest point within `REFLECT_ABOVE` of it, faded out toward the tier's distance and as it rises off the water.
 */
export function reflectStrength(bottom: number, top: number, h: number, distance: number, within: number): number {
    if (top <= h + 0.01 || bottom > h + REFLECT_ABOVE || distance >= within) return 0;
    const near = 1 - smooth(within * 0.7, within, distance);
    const low = 1 - smooth(REFLECT_ABOVE * 0.4, REFLECT_ABOVE, bottom - h);
    return near * low;
}

/** The mirror: a height `y` reflected about the surface `h`. */
export function mirrorY(y: number, h: number): number {
    return 2 * h - y;
}

/**
 * Where the shader draws a point of the reflection (`water-reflect-render.ts` REFLECT_VERTEX): the mirrored point
 * `m`, slid along the camera's ray onto the water's plane, so its depth is the water's (the ground of a bank above the
 * water hides it, the lake's bed under the water does not). On screen it is exactly where `m` is.
 */
export function reflectedOnPlane(camera: {x: number; y: number; z: number}, m: {x: number; y: number; z: number}, h: number): {x: number; y: number; z: number} {
    const dy = Math.min(m.y - camera.y, -1e-4);
    const t = Math.min(Math.max((h - camera.y) / dy, 0), 1);
    return {x: camera.x + (m.x - camera.x) * t, y: camera.y + (m.y - camera.y) * t, z: camera.z + (m.z - camera.z) * t};
}

function smooth(edge0: number, edge1: number, x: number): number {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}

/** One instance asking for a reflection this frame. */
export type ReflectCandidate = {source: number; index: number; distance: number; level: number; tint: ReflectTint; strength: number};

/**
 * This frame's reflections: the nearest `count` of the candidates (the tier's), at most `REFLECT_PER_MESH` per
 * source mesh. Sorts `list` in place; returns how many of its first entries are drawn.
 */
export function pickReflections(list: ReflectCandidate[], length: number, count: number, perSource: Map<number, number>): number {
    perSource.clear();
    const live = list.length === length ? list : list.slice(0, length);
    live.sort((a, b) => a.distance - b.distance);
    let kept = 0;
    for (let i = 0; i < live.length && kept < count; i++) {
        const c = live[i];
        const n = perSource.get(c.source) ?? 0;
        if (n >= REFLECT_PER_MESH) continue;
        perSource.set(c.source, n + 1);
        if (i !== kept) {
            const t = live[kept];
            live[kept] = c;
            live[i] = t;
        }
        kept++;
    }
    if (live !== list) for (let i = 0; i < live.length; i++) list[i] = live[i];
    return kept;
}
