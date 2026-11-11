/**
 * Where the props attach: the graphics lane's scenery interface
 * (`src/ark-scene/sampler.ts`, docs/ark/graphics-interface.md: `surfaceAt`,
 * `place(name)`, `attachPoints(query)`), plus the few places a home needs
 * that the interface does not have yet, worked out here from the same
 * scenery until it does:
 *
 * - `fork`: where a decor tree's trunk meets its crown (a songbird's cup, a
 *   heron's platform);
 * - `hollow`: a hole in a broad trunk, on its side toward the opening camera
 *   (a hole-nester's nest, a wild bees' comb);
 * - `ledge`: steep ground on the sea cliffs, the mountain and the ice (a
 *   cliff nester's nest);
 * - `cave`: the mountain's cave mouth (the cave and its bat roost).
 *
 * These are asked of the graphics lane as attach tags / a named place
 * (`fork`, `hollow`, `ledge`, `cave`); when they land, `extraPoints` and
 * `CAVE_SITE` go and the props read them from the interface.
 */

import {attachPoints as sceneryPoints, place, surfaceAt, type AttachPoint, type AttachTag, type PlaceName} from "@/ark-scene/sampler";
import {worldDecor, type DecorItem} from "@/ark-scene/decor";
import type {ArkZone} from "@/ark-scene/types";
import {trunkOf} from "@/ark-scene/vegetation";
import {hashString, sampleGround, seeded, zoneAt} from "@/ark-scene/world";

export type PropsTag = AttachTag | "fork" | "hollow" | "ledge";

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

const zoneOf = (x: number, z: number) => zoneAt(sampleGround(x, z)) as ArkZone;

/** Forks and hollows of the decor trees (drawn at every tier, unlike the forest fill). */
function treeExtras(item: DecorItem, index: number, out: PropsPoint[]) {
    const trunk = trunkOf(item.kind, item.variant)
        ?? (item.kind === "acacia" ? {height: 2.6, radius: 0.13, lean: 0.5, clear: 2.45} : item.kind === "conifer" ? null : null);
    if (!trunk || item.kind === "cactus") return;
    const host = `decor${index}`;
    const zone = zoneOf(item.x, item.z);
    const s = item.scale;
    const c = Math.cos(item.rotation);
    const sn = Math.sin(item.rotation);
    // Local (x along the lean, z) turned into the world (three's rotation about y).
    const world = (lx: number, ly: number, lz: number) => ({x: item.x + (lx * c + lz * sn) * s, y: item.y - 0.08 + ly * s, z: item.z + (-lx * sn + lz * c) * s});
    const lean = (y: number) => trunk.lean * (y / trunk.height) ** 2;
    const forkY = Math.max(trunk.clear - 0.05, trunk.height * 0.55);
    const fork = world(lean(forkY), forkY, 0);
    out.push({id: `fork:${host}:0`, tag: "fork", ...fork, normal: {x: 0, y: 1, z: 0}, yaw: item.rotation, zone, host});
    if (item.kind === "orchard" || trunk.radius * s < 0.16) return;
    // The hollow faces the opening camera (+z in the world), a little to one side per tree.
    const y = trunk.clear * 0.58;
    const r = trunk.radius * (1 - 0.45 * (y / trunk.height));
    const worldAngle = ((index % 5) - 2) * 0.22;
    const wx = Math.sin(worldAngle);
    const wz = Math.cos(worldAngle);
    // Back into the tree's own frame for the radius and the lean.
    const lx = wx * c - wz * sn;
    const lz = wx * sn + wz * c;
    const at = world(lean(y) + lx * r, y, lz * r);
    out.push({id: `hollow:${host}:0`, tag: "hollow", ...at, normal: {x: wx, y: 0, z: wz}, yaw: 0, zone, host});
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
    worldDecor().forEach((item, index) => {
        if (item.kind === "broadleaf" || item.kind === "rainforest" || item.kind === "orchard" || item.kind === "acacia") treeExtras(item, index, list);
    });
    ledges(list);
    extras = list;
    return list;
}

/** Points of a tag (or tags), nearest a spot first, within `radius`; deterministic. */
export function propsPoints(tag: PropsTag | PropsTag[], near?: {x: number; z: number; radius: number}, zone?: ArkZone): PropsPoint[] {
    const tags = new Set(Array.isArray(tag) ? tag : [tag]);
    const scenery = Array.from(tags).filter((t): t is AttachTag => t !== "fork" && t !== "hollow" && t !== "ledge");
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
 * The cave's mouth on the mountain (asked of the graphics lane as the named
 * place `cave`): a steep rise on the mountain's west flank, above the
 * grass line, with nothing of the forest fill within 3.6 m of the mouth.
 * Found by a search over the mountain (rise ≥ 4.5 m over the 5 m behind,
 * at least 14 m up; `ark-props.test` checks it still holds), kept here so
 * startup does no search. The forest fill grows all over the mountain since
 * graphics batch 1, so the graphics lane is asked for a `cave` place kept
 * clear of the fill.
 */
export const CAVE_SITE = {x: -28.5, z: -46.5};

export function caveSite(): {x: number; y: number; z: number; /** The way out of the mouth (radians about y, three's: local +z → (sin, cos)). */ facing: number} {
    const {x, z} = CAVE_SITE;
    const e = 1;
    const gx = (sampleGround(x + e, z).height - sampleGround(x - e, z).height) / 2;
    const gz = (sampleGround(x, z + e).height - sampleGround(x, z - e).height) / 2;
    // Out of the mouth: downhill.
    return {x, y: sampleGround(x, z).height, z, facing: Math.atan2(-gx, -gz)};
}

/** A small, stable random for a prop, from its name and an index. */
export function propRandom(name: string, index = 0): () => number {
    return seeded((hashString(name) + index * 7919) >>> 0);
}
