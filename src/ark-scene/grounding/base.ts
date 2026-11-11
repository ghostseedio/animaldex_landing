/**
 * Each model's true base, from its own mesh (`scripts/ark-grounding-bases.mjs` → `model-base.json`; motion 100x
 * pass, lane L3). All in the model's own units, so they scale with the size it is drawn at (true sizing changes the
 * scale, never these).
 *
 * - `base`: the height its weight rests on (its feet; a snake's or a fish's belly; a perched-pose bird's toes, its
 *   tail hanging lower), per level: the near and far meshes are cut separately, so each stands on its own base and a
 *   level swap never moves it up or down. The scene used the bounding box's floor of whichever level loaded first.
 * - `footprint`: where its contacts are at that base (x across, z along): what stands on a slope.
 * - `feet` (rigged species): the lowest grip-bone point at rest (`sole`), how far each grip bone's pivot is above its
 *   sole (`drop`: `map/grip.ts` puts pivots on a branch, so without it a percher sank its toes into the wood), and per
 *   clip how far the lowest sole moves from rest across the clip (mean, lowest, highest).
 *
 * A model the file does not list (a new one before the script runs again) keeps its bounding box: `base` falls back
 * to the `minY` the caller passes.
 */

import data from "@/ark-scene/grounding/model-base.json";

type Row = [number, number, number, number, number, number, number, number, number, number, number, number, string];
/** [the rig set measured, sole, mean grip drop, {standing clip: mean sole offset}] */
type RigRow = [number, number, number, Record<string, number>?];

const MODELS = (data as unknown as {models: Record<string, Row>}).models;
const RIGS = (data as unknown as {rigs: Record<string, RigRow>}).rigs;

export type ModelLevelName = "near" | "far";

export type Footprint = {x0: number; x1: number; z0: number; z1: number};

export type ModelBase = {
    near: {base: number; minY: number};
    far: {base: number; minY: number};
    footprint: Footprint;
    /** Its contacts surround its middle (false: no clear support; the base is the lowest point). */
    clear: boolean;
    /** The near mesh's size (x across, y up, z along), model units. */
    size: {x: number; y: number; z: number};
    /** The talking model's body plan (`ark.json` behaviour.plan), when the script read it. */
    plan: string | null;
};

const cache = new Map<string, ModelBase | null>();

/** The model's bases and footprint, or null when the file does not list it. */
export function modelBase(slug: string): ModelBase | null {
    let found = cache.get(slug);
    if (found !== undefined) return found;
    const row = MODELS[slug];
    found = row
        ? {
              near: {base: row[0], minY: row[1]},
              far: {base: row[2], minY: row[3]},
              footprint: {x0: row[4], x1: row[5], z0: row[6], z1: row[7]},
              clear: row[8] === 1,
              size: {x: row[9], y: row[10], z: row[11]},
              plan: row[12] ? row[12] : null
          }
        : null;
    cache.set(slug, found);
    return found;
}

/**
 * The height (model units) that goes on the surface: the level's true base, or `minY` (the loaded mesh's own
 * bounding box) for a model the file does not list. A rig's mesh is the near mesh.
 */
export function levelBase(slug: string, level: ModelLevelName | "rig", minY: number): number {
    const found = modelBase(slug);
    if (!found) return minY;
    return level === "far" ? found.far.base : found.near.base;
}

/** How far its lowest point hangs below its base (model units, ≥ 0): a tail, a wingtip, a belly. */
export function hangBelow(slug: string, level: ModelLevelName): number {
    const found = modelBase(slug);
    if (!found) return 0;
    const own = level === "far" ? found.far : found.near;
    return Math.max(own.base - own.minY, 0);
}

export type RigFeet = {
    /** The lowest grip-bone point at rest (model units): the sole. */
    sole: number;
    /** Its grip bones' pivots' mean height over their own soles at rest (model units). */
    drop: number;
    /** Per standing clip: the lowest sole's mean offset from rest across its frames (model units), where it is half a percent or more. */
    clips: Record<string, number>;
    /** The rig set measured (2 or 1): a rig from another set is not this one. */
    set: number;
};

const feetCache = new Map<string, RigFeet | null>();

/** A rigged species' feet, or null (no rig measured, or no grip bones). */
export function rigFeet(slug: string): RigFeet | null {
    let found = feetCache.get(slug);
    if (found !== undefined) return found;
    const row = RIGS[slug];
    found = row ? {set: row[0], sole: row[1], drop: row[2], clips: row[3] ?? {}} : null;
    feetCache.set(slug, found);
    return found;
}

/** The average pivot-to-sole drop of a rig's grip bones (model units), 0 when unknown. */
export function meanDrop(slug: string): number {
    // (A rig whose grip pivots sit below their own lowest points, a tortoise's stubby feet, keeps its pivots: 0.)
    return Math.max(rigFeet(slug)?.drop ?? 0, 0);
}

/**
 * Standing clips (the feet carry it): a clip whose lowest sole sits off its rest height on average stands its body
 * that much too high or low; the scene takes the mean off (model units). Others (lying, flying, swimming, a hop's
 * air time, a take-off) are carried by their own paths and poses: 0.
 */
const STANDING = new Set(["idle", "walk", "run", "trot", "gallop", "graze", "browse", "scan", "call", "display", "groom", "dig", "strike", "fight", "clash", "shake_off", "perch", "stalk", "sniff", "drink"]);
export function clipStandOffset(slug: string, clip: string | null | undefined): number {
    if (!clip || !STANDING.has(clip)) return 0;
    // (Only a real offset, half a percent of the body, is listed: the rest is the clip's own bob.)
    return rigFeet(slug)?.clips[clip] ?? 0;
}

/** The models the file lists (for the audit and the tests). */
export function groundedSlugs(): string[] {
    return Object.keys(MODELS);
}
