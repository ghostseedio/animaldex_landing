/**
 * The v2 world (the bigger wild island) as `world.ts` serves it after `setArkWorld("v2")` (P1, docs/ark/wild-island.md
 * §Integration): the same names and shapes as today's world, from the wild island's generator. `world.ts` imports this
 * module; it imports only the generator (no map, no scene), so the cycle back to `world.ts` is through its hoisted noise
 * functions alone.
 */

import type {ArkZone} from "@/ark-scene/types";
import {sampleWildGround} from "@/ark-scene/islands/wild/ground";
import {coastRadius as coastByBearing, LAKE as WILD_LAKE, MOUTH_BEARING, RIVER_LOWER, RIVER_UPPER, riverAt} from "@/ark-scene/islands/wild/fields";
import {wildZoneSites, type WildZoneSite} from "@/ark-scene/islands/wild/zone-sites";
import {WILD_HALF, WILD_SEGMENTS} from "@/ark-scene/islands/wild/frame";

export type WorldV2 = {
    ZONE_SITES: Record<ArkZone, WildZoneSite>;
    LAKE: {x: number; z: number; r: number};
    /** The lower river, the lake's outflow to its mouth (today's RIVER runs the same way). */
    RIVER: Array<[number, number]>;
    /** The upper river, from its spring to the lake (today's world has none). */
    RIVER_UPPER: Array<[number, number]>;
    VISITOR_LANDING: {theta: number; foot: {x: number; z: number}; end: {x: number; z: number}; deckFrom: {x: number; z: number}; deckTo: {x: number; z: number}};
    TERRAIN_HALF: number;
    TERRAIN_SEGMENTS: number;
    WORLD_RADIUS: number;
    /** `world.ts` coastRadius(theta): theta is atan2(z, x). */
    coastRadius: (theta: number) => number;
    riverDistance: (x: number, z: number) => number;
};

let built: WorldV2 | null = null;

export function wildWorldV2(): WorldV2 {
    if (built) return built;
    const coast = (theta: number) => coastByBearing(theta + Math.PI / 2);
    // The visitors' landing (islands plan §2.4: no jetty on the wild island): a land animal at the foot of the southern
    // beach, a swimmer in the shallows off it. The deck's two ends are its foot (nothing to draw).
    const theta = Math.PI / 2 - 0.12;
    const at = (offset: number) => ({x: Math.cos(theta) * (coast(theta) + offset), z: Math.sin(theta) * (coast(theta) + offset)});
    const foot = at(-6.4);
    built = {
        ZONE_SITES: wildZoneSites(),
        LAKE: {x: WILD_LAKE.x, z: WILD_LAKE.z, r: WILD_LAKE.r},
        RIVER: RIVER_LOWER.map((p) => [p.x, p.z] as [number, number]),
        RIVER_UPPER: RIVER_UPPER.map((p) => [p.x, p.z] as [number, number]),
        VISITOR_LANDING: {theta, foot, end: at(7.5), deckFrom: foot, deckTo: foot},
        TERRAIN_HALF: WILD_HALF,
        TERRAIN_SEGMENTS: WILD_SEGMENTS,
        // Far enough that the whole island fits from the widest camera distance (its land reaches ~217 m).
        WORLD_RADIUS: 220,
        coastRadius: coast,
        riverDistance: (x, z) => riverAt(x, z).d
    };
    void MOUTH_BEARING;
    return built;
}

/** The v2 ground sample in `world.ts` GroundSample's shape (a superset: the wild island's own fields ride along). */
export const sampleGroundV2 = sampleWildGround;
