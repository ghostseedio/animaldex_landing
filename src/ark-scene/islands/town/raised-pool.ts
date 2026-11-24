/**
 * p3 (solid): an enclosure's raised pool as a solid (`solids.ts`, `colliders.ts`, `placement.ts`). Its own module: the
 * placement reads it without the habitats' drawing code that `solids.ts` brings.
 */

import {centroid} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import type {ZooEnclosure} from "@/ark-scene/islands/town/areas";
import type {TownSolid} from "@/ark-scene/islands/town/solids";

/**
 * The raised pool an enclosure has (`render/scenery.ts` enclosure: penguins and seals, bears and wolves, small mammals,
 * primates): its rim of rockwork standing on the ground round its water, as one box over the rim's outside, from under
 * the ground to just under its water (`RAISED_POOL_WATER` over the highest ground at its corners). A walker is kept out
 * of it (the seat audit, #115's CI: a black giant squirrel slept and drank inside small_mammals-3's pool, its body in the
 * pool's bed); its own swimmers float on its water, above the box's top, which `collide/colliders.ts` spansCollider
 * passes over. Null where none is drawn (a safari area's waters are in the ground, the dome's lagoon is cut into it).
 */
export function raisedPool(e: Pick<ZooEnclosure, "id" | "pool" | "slot">): (TownSolid & {shape: "box"}) | null {
    if (!e.pool || e.slot.safari || e.slot.annex === "dome" || e.pool.length !== 4) return null;
    const [p0, p1, , p3] = e.pool;
    let ground = -Infinity;
    for (const q of e.pool) ground = Math.max(ground, townHeight(q.x, q.z));
    const c = centroid(e.pool);
    const pw = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    const pd = Math.hypot(p3.x - p0.x, p3.z - p0.z);
    // (The rim as drawn: the long walls along its width, `pw + 0.7` long and 0.35 thick at its ends; the side walls 0.35
    // thick along its depth.)
    return {id: `zoo:${e.id}:pool`, kind: "pond", shape: "box", x: c.x, z: c.z, hw: pw / 2 + 0.35, hd: pd / 2 + 0.175, rot: e.slot.at.rot, base: ground - 0.6, top: ground + RAISED_POOL_WATER - 0.05, gap: 0};
}

/** A raised pool's water over the highest ground at its corners (m): `render/scenery.ts` enclosure, `placement.ts`. */
export const RAISED_POOL_WATER = 0.45;


/** The signed distance from a point to a raised pool's footprint (m, negative inside): `solids.ts` solidDistance's box. */
export function raisedPoolDistance(pool: TownSolid & {shape: "box"}, x: number, z: number): number {
    const c = Math.cos(pool.rot);
    const n = Math.sin(pool.rot);
    const dx = x - pool.x;
    const dz = z - pool.z;
    const qx = Math.abs(dx * c + dz * n) - pool.hw;
    const qz = Math.abs(-dx * n + dz * c) - pool.hd;
    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}
