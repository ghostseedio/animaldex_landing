/**
 * Where the props attach: the graphics lane's scenery interface
 * (`src/ark-scene/sampler.ts`, docs/ark/graphics-interface.md: `surfaceAt`,
 * `place(name)`, `attachPoints(query)`), plus the few places a home needs
 * that the interface does not have yet, worked out here from the same
 * scenery until it does:
 *
 * - `ledge`: steep ground on the sea cliffs, the mountain and the ice (a
 *   cliff nester's nest);
 * - `cave`: the mountain's cave mouth (the cave and its bat roost).
 *
 * Trees are the graphics lane's alone: nests, hollows, ant trails and webs
 * use its `branch`, `leaf`, `bark` and `flower_head` points (the attach lane
 * puts those on the asset trees' drawn geometry), never offsets of our own.
 * These two are asked of the graphics lane as an attach tag and a named
 * place (`ledge`, `cave`); when they land, `extraPoints` and `CAVE_SITE` go.
 */

import {attachPoints as sceneryPoints, place, surfaceAt, type AttachPoint, type AttachTag, type PlaceName} from "@/ark-scene/sampler";
import type {ArkZone} from "@/ark-scene/types";
import {hashString, sampleGround, seeded, zoneAt} from "@/ark-scene/world";

export type PropsTag = AttachTag | "ledge";

export type PropsPoint = {
    id: string;
    tag: PropsTag;
    x: number;
    y: number;
    z: number;
    /** Out of the surface (unit). */
    normal: {x: number; y: number; z: number};
    /** A heading round the normal (radians). */
    yaw: number;
    zone: ArkZone | null;
    host: string;
};

function fromScenery(point: AttachPoint): PropsPoint {
    return {id: point.id, tag: point.tag, x: point.position.x, y: point.position.y, z: point.position.z, normal: point.normal, yaw: point.yaw, zone: point.zone, host: point.host};
}


/** Ledges: steep ground facing out on the sea cliffs, the mountain and the ice. */
function ledges(out: PropsPoint[]) {
    const random = seeded(880011);
    let found = 0;
    for (let i = 0; i < 2600 && found < 90; i++) {
        const x = (random() * 2 - 1) * 110;
        const z = (random() * 2 - 1) * 110;
        const s = sampleGround(x, z);
        if (s.height < 1.2) continue;
        const zone = zoneAt(s) as ArkZone;
        const surface = surfaceAt(x, z);
        const steep = 1 - surface.normal.y;
        const cliffy = s.cliff > 0.45 && s.inland < 12;
        if (!(cliffy || (zone === "mountains" && steep > 0.18) || (zone === "polar" && steep > 0.1))) continue;
        const flat = Math.hypot(surface.normal.x, surface.normal.z) || 1;
        out.push({id: `ledge:ground:${found}`, tag: "ledge", x, y: s.height, z, normal: {x: surface.normal.x / flat, y: 0, z: surface.normal.z / flat}, yaw: Math.atan2(surface.normal.x, surface.normal.z), zone: cliffy ? (zone === "polar" ? "polar" : "seashore") : zone, host: "ground"});
        found++;
    }
}

let extras: PropsPoint[] | null = null;

function extraPoints(): PropsPoint[] {
    if (extras) return extras;
    const list: PropsPoint[] = [];
    ledges(list);
    extras = list;
    return list;
}

/** Points of a tag (or tags), nearest a spot first, within `radius`; deterministic. */
export function propsPoints(tag: PropsTag | PropsTag[], near?: {x: number; z: number; radius: number}, zone?: ArkZone): PropsPoint[] {
    const tags = new Set(Array.isArray(tag) ? tag : [tag]);
    const scenery = Array.from(tags).filter((t): t is AttachTag => t !== "ledge");
    const list = [
        ...(scenery.length ? sceneryPoints({tag: scenery, near, zone}).map(fromScenery) : []),
        ...extraPoints().filter((point) => tags.has(point.tag) && (!zone || point.zone === zone) && (!near || Math.hypot(point.x - near.x, point.z - near.z) <= near.radius))
    ];
    if (near) list.sort((a, b) => Math.hypot(a.x - near.x, a.z - near.z) - Math.hypot(b.x - near.x, b.z - near.z) || a.id.localeCompare(b.id));
    return list;
}

export function namedPlace(name: PlaceName): {x: number; y: number; z: number; radius: number} {
    return place(name);
}

export function groundAt(x: number, z: number): number {
    return sampleGround(x, z).height;
}

/**
 * The cave (asked of the graphics lane as the named place `cave`): a rock
 * outcrop standing on flat open ground in the cold, at the ice's edge below
 * the mountain, its mouth toward the island's middle. Since graphics batch 1
 * the forest fill covers the mountain, and a cave cut into a slope shows the
 * terrain inside it (the terrain cannot be holed from here), so the chamber
 * sits in an outcrop on flat ground instead: found by a search (ground within
 * 0.3 m over 4.5 m round it, nothing of the decor or the fill within 6.5 m;
 * `ark-props.test` checks it still holds), kept here so startup does no search.
 */
export const CAVE_SITE = {x: 45.5, z: -45.5};

export function caveSite(): {x: number; y: number; z: number; /** The way out of the mouth (radians about y, three's: local +z → (sin, cos)). */ facing: number} {
    const {x, z} = CAVE_SITE;
    let floor = -Infinity;
    for (let a = 0; a < 12; a++) for (const r of [0, 2.5, 4.5]) floor = Math.max(floor, sampleGround(x + Math.cos(a * 0.5236) * r, z + Math.sin(a * 0.5236) * r).height);
    return {x, y: floor + 0.04, z, facing: Math.atan2(-x, -z)};
}

/** A small, stable random for a prop, from its name and an index. */
export function propRandom(name: string, index = 0): () => number {
    return seeded((hashString(name) + index * 7919) >>> 0);
}
