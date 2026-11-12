/**
 * Collisions (motion pass L5): what any motion code asks before it moves an animal, so no animal walks through a
 * fence, a building, a trunk or a rock (`colliders.ts`), and the body it asks for (`bodies.ts`).
 *
 * Every answer is a pure function of the world, the hamlet's plots (the same ones the walk grid is built for:
 * `world-sampler.ts` setBehaviourHomePlots) and the arguments: the same for every viewer.
 *
 * - `collideBlocked(x, z, r)`: a body of radius r standing there overlaps something solid.
 * - `collideSegmentClear(ax, az, bx, bz, r)`: a straight run from a to b touches nothing solid.
 * - `collideClip(ax, az, bx, bz, r)`: how far along a → b it gets before it would (the furthest clear point).
 * - `bodyRadius(slug, length)`: the radius to ask with (half its drawn width).
 */

import {behaviourHomePlots} from "@/ark-scene/world-sampler";
import {colliderSetFor, unionColliders, type ColliderSet} from "@/ark-scene/collide/colliders";

export {bodyRadius, bodyShape, type BodyShape} from "@/ark-scene/collide/bodies";
export type {Collider, ColliderKind, ColliderSet} from "@/ark-scene/collide/colliders";
export {unionColliders} from "@/ark-scene/collide/colliders";

/** The colliders for the hamlet's plots now. */
export function colliders(): ColliderSet {
    return colliderSetFor(behaviourHomePlots());
}

/**
 * Part C, one world (decision 141): another island's own collider set (the town's, `islands/town/colliders.ts`, from its
 * obstacle footprints at its world origin). Every query asks both islands' sets as one (`unionColliders`): a run inside
 * one island that crosses the other's square (a flyer's long leg) meets the other's buildings too. Null: the wild island
 * alone, exactly as before.
 */
let island: {contains: (x: number, z: number) => boolean; set: ColliderSet} | null = null;
export function setIslandColliders(other: {contains: (x: number, z: number) => boolean; set: ColliderSet} | null): void {
    island = other;
}
/** Every island's colliders as one set (the wild island's alone when no other island is set). */
export function worldColliders(): ColliderSet {
    return island ? unionColliders(colliders(), island.set) : colliders();
}

/**
 * A body of radius `radius` (m) standing at (x, z) overlaps a fence, a building, a trunk, a rock, a log or a hay bale.
 * With `base` and `height` (m), only what its height span reaches into: on top of a rock or a log, or under a fence's
 * rails, it is clear.
 */
export function collideBlocked(x: number, z: number, radius: number, base?: number, height?: number): boolean {
    return worldColliders().blocked(x, z, radius, base ?? -Infinity, height ?? Infinity);
}

/** A straight run from a to b, for a body of radius `radius`, touches nothing solid. */
export function collideSegmentClear(ax: number, az: number, bx: number, bz: number, radius: number): boolean {
    return worldColliders().segmentClear(ax, az, bx, bz, radius);
}

/** How far along a → b a body of radius `radius` gets before it would touch something solid: the point and the fraction t. */
export function collideClip(ax: number, az: number, bx: number, bz: number, radius: number): {x: number; z: number; t: number} {
    const t = worldColliders().sweep(ax, az, bx, bz, radius);
    return {x: ax + (bx - ax) * t, z: az + (bz - az) * t, t};
}
