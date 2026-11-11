/**
 * Where the props attach: the graphics lane's scenery interface
 * (`src/ark-scene/sampler.ts`, docs/ark/graphics-interface.md: `surfaceAt`,
 * `place(name)`, `attachPoints(query)`) and nothing of the props' own.
 * Nests, hollows, ant trails and webs use its `leaf`, `branch`, `bark`,
 * `tree_hollow` and `flower_head` points (on the asset trees' drawn
 * geometry), cliff nesters its `ledge` points (up is up; the way out of the
 * cliff is `forward` / `yaw`), the cave its `place("cave")` (with `facing`).
 */

import {attachPoints as sceneryPoints, place, type AttachPoint, type AttachTag, type PlaceName} from "@/ark-scene/sampler";
import type {ArkZone} from "@/ark-scene/types";
import {hashString, sampleGround, seeded} from "@/ark-scene/world";

export type PropsTag = AttachTag;

export type PropsPoint = {
    id: string;
    tag: PropsTag;
    x: number;
    y: number;
    z: number;
    /** Out of the surface (unit); a ledge's is up. */
    normal: {x: number; y: number; z: number};
    /** Along the surface, where the sampler gives it: up a trunk, along a branch, out of a cliff (a ledge's). */
    forward?: {x: number; y: number; z: number};
    /** A heading round the normal (radians). */
    yaw: number;
    zone: ArkZone | null;
    host: string;
    /** The attach lane's `open` (0…1, how much sky it sees), on tree points. */
    open?: number;
    /** A tree hollow's depth into the trunk (m). */
    depth?: number;
    /** Body lengths it suits (m). */
    size: [number, number];
};

function fromScenery(point: AttachPoint): PropsPoint {
    return {
        id: point.id,
        tag: point.tag,
        x: point.position.x,
        y: point.position.y,
        z: point.position.z,
        normal: point.normal,
        forward: point.forward,
        yaw: point.yaw,
        zone: point.zone,
        host: point.host,
        open: point.open,
        depth: point.depth,
        size: point.size
    };
}

/** Points of a tag (or tags), nearest a spot first, within `radius`; deterministic. */
export function propsPoints(tag: PropsTag | PropsTag[], near?: {x: number; z: number; radius: number}, zone?: ArkZone): PropsPoint[] {
    const list = sceneryPoints({tag: Array.isArray(tag) ? tag : [tag], near, zone}).map(fromScenery);
    if (near) list.sort((a, b) => Math.hypot(a.x - near.x, a.z - near.z) - Math.hypot(b.x - near.x, b.z - near.z) || a.id.localeCompare(b.id));
    return list;
}

export function namedPlace(name: PlaceName): {x: number; y: number; z: number; radius: number; facing?: number} {
    return place(name);
}

/** The cave (the sampler's `place("cave")`): its floor, and the way out of its mouth. */
export function caveSite(): {x: number; y: number; z: number; /** The way out of the mouth (radians about y, three's: local +z → (sin, cos)). */ facing: number} {
    const cave = place("cave");
    return {x: cave.x, y: cave.y, z: cave.z, facing: cave.facing ?? Math.atan2(-cave.x, -cave.z)};
}

export function groundAt(x: number, z: number): number {
    return sampleGround(x, z).height;
}

/** A small, stable random for a prop, from its name and an index. */
export function propRandom(name: string, index = 0): () => number {
    return seeded((hashString(name) + index * 7919) >>> 0);
}
