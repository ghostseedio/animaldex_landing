/**
 * Small animals and their microhabitats (docs/ark-micro.md, the owner's
 * addendum): which spot a species lives at (`microhabitats.json`, generated
 * by `scripts/ark-microhabitats.mts` from stored text and taxonomy), and the
 * spots themselves as surfaces of the world: the cottage's walls, roof and
 * the ground round it, tree trunks, flower heads, stones, leaf litter and
 * the surface of a pond.
 *
 * A small animal's place is still the server's slot: slot k of zone Z takes
 * point `k · 12 + Z` of its spot's surfaces (a low-discrepancy sequence, so
 * the points spread out and no two slots of any zone share one), and its
 * rank in the slot a small step about that. So nobody moves when another
 * arrives or leaves, exactly as on the ground. Everything here is a pure
 * function of the world and the ids: every viewer sees the same gecko on
 * the same wall.
 */

import table from "@/ark-scene/microhabitats.json";
import {rockSquash, worldDecor, type DecorItem} from "@/ark-scene/decor";
import {assetTrunk} from "@/ark-scene/tree-assets";
import {COTTAGE, DECOR_SINK, FLOWER_SHAPE, GARDEN_POND, LAMP, LEAF_LIFT, microCorner, microDecor, zoneLamp, type MicroDecorItem} from "@/ark-scene/micro-decor";
import {ARK_ZONES, type ArkZone} from "@/ark-scene/types";
import type {AttachPoint} from "@/ark-scene/map/sampler";
import {rock, trunkOf} from "@/ark-scene/vegetation";
import {hashString, heightAt, LAKE, sampleGround, ZONE_SITES} from "@/ark-scene/world";

export const MICRO_SPOTS = ["house", "lamp", "bark", "flowers", "rocks", "leaf_litter", "pond_surface"] as const;
export type MicroSpot = typeof MICRO_SPOTS[number];

type Row = [string, string] | [string, string, string];
const TABLE = table as unknown as {small: number; species: Record<string, Row>};

/** Small: the size stat at or below this (a brown rat). */
export const MICRO_SMALL_SIZE = TABLE.small;

export type MicroSpecies = {
    spot: MicroSpot;
    /** The stored phrase (or the taxonomy) that decided it. */
    reason: string;
    /** A moth: to the porch light at night. */
    moth: boolean;
    /** Crawls on its surface. */
    clinger: boolean;
    /** Its rig passed the pipeline's checks (the clips are not in the scene yet). */
    rig: boolean;
};

const species = new Map<string, MicroSpecies | null>();

/** Where a species lives on the island, if it is small (or domestic) and its text names a spot. */
export function microSpecies(slug: string): MicroSpecies | null {
    if (species.has(slug)) return species.get(slug)!;
    const row = TABLE.species[slug];
    const out = row && (MICRO_SPOTS as readonly string[]).includes(row[0])
        ? {spot: row[0] as MicroSpot, reason: row[1], moth: (row[2] ?? "").includes("m"), clinger: (row[2] ?? "").includes("c"), rig: (row[2] ?? "").includes("r")}
        : null;
    species.set(slug, out);
    return out;
}

function flags(slug: string): string {
    return TABLE.species[slug]?.[2] ?? "";
}

// MARK: Surfaces

export type MicroSurface = "wall" | "roof" | "around" | "bark" | "flower" | "rock" | "litter" | "water" | "post" | "attach";

/**
 * A small animal's place: which surface, which host on it (a wall, a tree,
 * a flower...), where on it (`a`, `b` in 0…1) and its own offset from that
 * point (a cluster's members, in metres along and across), and the way it
 * crawls (radians, 0 = up the surface or away from the house).
 */
export type MicroPlace = {
    spot: MicroSpot;
    surface: MicroSurface;
    host: number;
    a: number;
    b: number;
    heading: number;
    offAlong: number;
    offAcross: number;
    /** On a scenery attach point (the map, `map/place.ts`): surface "attach", the point itself. */
    attach?: AttachPoint;
};

/** A point on a surface: where, the surface's normal (the way the animal's back faces) and the way it heads. */
export type SurfacePoint = {x: number; y: number; z: number; nx: number; ny: number; nz: number; tx: number; ty: number; tz: number};

const R2 = 1.324717957244746;

/** The k-th point of a 2D low-discrepancy sequence (R2): any two indices give different points. */
function r2(index: number): [number, number] {
    return [(0.5 + index / R2) % 1, (0.5 + index / (R2 * R2)) % 1];
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

// The cottage, in its own frame (x along the front, z out of it, y up from the floor).
const C = COTTAGE;
const halfW = C.width / 2;
const halfD = C.depth / 2;
/** The door, on the front wall: kept clear. */
const DOOR = {from: -0.55, to: 0.35, top: 2.05};

function cottageWorld(lx: number, ly: number, lz: number): [number, number, number] {
    const c = Math.cos(C.rotation);
    const s = Math.sin(C.rotation);
    return [C.x + lx * c + lz * s, C.floor + ly, C.z - lx * s + lz * c];
}

function cottageDirection(lx: number, ly: number, lz: number): [number, number, number] {
    const c = Math.cos(C.rotation);
    const s = Math.sin(C.rotation);
    return [lx * c + lz * s, ly, -lx * s + lz * c];
}

/** The porch light, in the world. */
export function porchLight(): {x: number; y: number; z: number} {
    const [x, y, z] = cottageWorld(C.light.x, C.light.y, C.light.z + 0.1);
    return {x, y, z};
}

/** The light a small animal's moths circle at night: the porch light at Home, its zone's lamp elsewhere. */
export function nightLight(place: MicroPlace, zone: ArkZone): {x: number; y: number; z: number; out: {x: number; z: number}} {
    // On a lamp's attach point (the map): that lamp.
    if (place.attach?.tag === "porch_light") return {x: place.attach.x, y: place.attach.y, z: place.attach.z, out: {x: 0, z: 0}};
    if (place.spot === "lamp") {
        const lamp = zoneLamp(hostZone(zone));
        return {x: lamp.x, y: lamp.y + LAMP.height + 0.05, z: lamp.z, out: {x: 0, z: 0}};
    }
    const light = porchLight();
    return {...light, out: {x: 0, z: 0.18}};
}

/** The four walls: their length along, and how to turn (along, up) into the cottage's frame. */
const WALLS = [
    {length: C.width, at: (u: number, v: number) => [-halfW + u, v, halfD] as const, normal: [0, 0, 1] as const, along: [1, 0, 0] as const},
    {length: C.depth, at: (u: number, v: number) => [halfW, v, halfD - u] as const, normal: [1, 0, 0] as const, along: [0, 0, -1] as const},
    {length: C.width, at: (u: number, v: number) => [halfW - u, v, -halfD] as const, normal: [0, 0, -1] as const, along: [-1, 0, 0] as const},
    {length: C.depth, at: (u: number, v: number) => [-halfW, v, -halfD + u] as const, normal: [-1, 0, 0] as const, along: [0, 0, 1] as const}
];
/** The wall's surface stands this far out from its plane (the boards' thickness), so nothing sinks in. */
const WALL_SKIN = 0.012;

function wallPoint(place: MicroPlace, along: number): SurfacePoint {
    // Hosts 0 and 1 are the front (most seen, with the light), then the sides and the back.
    const wall = WALLS[[0, 0, 1, 3, 2][place.host % 5]];
    const margin = 0.25;
    const top = C.wall - 0.2;
    let u = margin + place.a * (wall.length - 2 * margin);
    let v = 0.25 + place.b * (top - 0.25);
    const up = Math.cos(place.heading);
    const side = Math.sin(place.heading);
    u = clamp(u + place.offAlong * side + place.offAcross * up + along * side, margin, wall.length - margin);
    v = clamp(v + place.offAlong * up - place.offAcross * side + along * up, 0.15, top);
    if (wall === WALLS[0]) {
        // Not on the door: to the nearer side of it.
        const lx = -halfW + u;
        if (lx > DOOR.from - 0.08 && lx < DOOR.to + 0.08 && v < DOOR.top + 0.05) u = lx - DOOR.from < DOOR.to - lx ? DOOR.from - 0.1 + halfW : DOOR.to + 0.1 + halfW;
    }
    const [lx, ly, lz] = wall.at(u, v);
    const [x, y, z] = cottageWorld(lx + wall.normal[0] * WALL_SKIN, ly, lz + wall.normal[2] * WALL_SKIN);
    const [nx, ny, nz] = cottageDirection(wall.normal[0], 0, wall.normal[2]);
    const [ax, , az] = cottageDirection(wall.along[0], 0, wall.along[2]);
    return {x, y, z, nx, ny, nz, tx: ax * side, ty: up, tz: az * side};
}

/** The roof's two slopes: from the eaves (lower, overhanging) to the ridge; a bird stands upright on it. */
function roofPoint(place: MicroPlace, along: number): SurfacePoint {
    const front = place.host % 2 === 0;
    const run = halfD + C.overhang;
    const reach = halfW + C.overhang - 0.3;
    const lx = clamp(-reach + place.a * 2 * reach + place.offAlong + along, -reach, reach);
    const t = clamp(0.25 + place.b * 0.7 + place.offAcross / run, 0.1, 1);
    // From the eave (t 0) to the ridge (t 1).
    const lz = (front ? 1 : -1) * run * (1 - t);
    const ly = roofHeight(Math.abs(lz)) + ROOF_THICKNESS;
    const [x, y, z] = cottageWorld(lx, ly, lz);
    const [tx, , tz] = cottageDirection(Math.cos(place.heading) >= 0 ? 1 : -1, 0, 0);
    return {x, y, z, nx: 0, ny: 1, nz: 0, tx, ty: 0, tz};
}

export const ROOF_THICKNESS = 0.12;

/** The roof's height (above the floor) at a distance from the ridge line. */
export function roofHeight(fromRidge: number): number {
    return C.wall + C.ridge * (1 - fromRidge / halfD);
}

/**
 * On the ground round the cottage (or on the porch's deck): pets, mice,
 * frogs, facing out from the house. `a` is the way round (a 1D
 * low-discrepancy sequence, so pets the size of a dog keep metres apart),
 * `b` how far out; host 0 is the deck, for the small ones.
 */
function aroundPoint(place: MicroPlace, along: number): SurfacePoint {
    let lx: number;
    let lz: number;
    let ox: number;
    let oz: number;
    let onDeck = false;
    if (place.host === 0) {
        lx = clamp(-C.porch.width / 2 + 0.3 + place.a * (C.porch.width - 0.6) + place.offAlong + along, -C.porch.width / 2 + 0.2, C.porch.width / 2 - 0.2);
        lz = halfD + 0.35 + place.b * (C.porch.depth - 0.6) + place.offAcross;
        [ox, oz] = [0, 1];
        onDeck = true;
    } else {
        // The way round a rectangle `out` metres outside the walls (and the porch), from the front's middle.
        const out = 0.9 + place.b * 2.4 + place.offAcross;
        const front = halfD + C.porch.depth;
        const w = halfW + out;
        const d1 = front + out;
        const d0 = halfD + out;
        const sides = [w, d1 + d0, 2 * w, d1 + d0, w];
        const perimeter = sides.reduce((sum, side) => sum + side, 0);
        let t = ((place.a * perimeter + place.offAlong + along) % perimeter + perimeter) % perimeter;
        // Front (going +x), right side (going -z), back (-x), left (+z), front again.
        if (t < sides[0]) [lx, lz, ox, oz] = [t, d1, 0, 1];
        else if ((t -= sides[0]) < sides[1]) [lx, lz, ox, oz] = [w, d1 - t, 1, 0];
        else if ((t -= sides[1]) < sides[2]) [lx, lz, ox, oz] = [w - t, -d0, 0, -1];
        else if ((t -= sides[2]) < sides[3]) [lx, lz, ox, oz] = [-w, -d0 + t, -1, 0];
        else [lx, lz, ox, oz] = [-w + (t - sides[3]), d1, 0, 1];
    }
    const [x, , z] = cottageWorld(lx, 0, lz);
    const y = onDeck ? C.floor + C.porch.height : heightAt(x, z);
    const [nx, ny, nz] = onDeck ? [0, 1, 0] : groundNormal(x, z);
    const [wx, , wz] = cottageDirection(ox, 0, oz);
    const turn = place.heading * 0.35;
    return {x, y, z, nx, ny, nz, tx: wx * Math.cos(turn) - wz * Math.sin(turn), ty: 0, tz: wx * Math.sin(turn) + wz * Math.cos(turn)};
}

function groundNormal(x: number, z: number): [number, number, number] {
    const e = 0.15;
    const dx = heightAt(x + e, z) - heightAt(x - e, z);
    const dz = heightAt(x, z + e) - heightAt(x, z - e);
    const length = Math.hypot(dx, 2 * e, dz);
    return [-dx / length, 2 * e / length, -dz / length];
}

// MARK: Hosts in the world

type Tree = {item: DecorItem; trunk: NonNullable<ReturnType<typeof trunkOf>>};
type Stone = {item: DecorItem; triangles: Float32Array};
type Patch = {x: number; z: number; radius: number};
type Pool = {points: Array<{x: number; z: number}>; y: number};

const TREE_KINDS = new Set(["broadleaf", "rainforest", "orchard", "cactus"]);
const hosts = new Map<string, unknown>();

function cached<T>(key: string, make: () => T): T {
    if (!hosts.has(key)) hosts.set(key, make());
    return hosts.get(key) as T;
}

/** The zones whose corner holds this spot (the sea's have none: they borrow the Home zone's). */
function hostZone(zone: ArkZone): ArkZone {
    return ZONE_SITES[zone]?.kind === "sea" ? "farm_garden" : zone;
}

/** A zone's trees with a trunk that can be climbed: the nearest few to its corner (the tree by the cottage first at Home). */
function trees(zone: ArkZone): Tree[] {
    return cached(`trees#${zone}`, () => {
        const corner = microCorner(zone);
        const list = worldDecor()
            .filter((item) => TREE_KINDS.has(item.kind))
            .map((item) => ({item, d: Math.hypot(item.x - corner.x, item.z - corner.z)}))
            .filter(({d}) => d < 30)
            .sort((p, q) => p.d - q.d)
            .slice(0, 5)
            // The trunk as drawn: the asset library's tree where one stands in (graphics pass), else the decor shape's.
            .map(({item}) => ({item, trunk: assetTrunk(item) ?? trunkOf(item.kind, item.variant % (item.kind === "broadleaf" || item.kind === "orchard" ? 3 : item.kind === "rainforest" ? 2 : 1))!}))
            .filter((tree) => tree.trunk);
        return list.length || zone === "farm_garden" ? list : trees("farm_garden");
    });
}

function decorOf(zone: ArkZone, kind: MicroDecorItem["kind"]): MicroDecorItem[] {
    return microDecor().filter((item) => item.zone === zone && item.kind === kind);
}

/** The zone corner's stones, each as world-space triangles (for finding the top of the stone under a point). */
function stones(zone: ArkZone): Stone[] {
    return cached(`stones#${zone}`, () => {
        const all = worldDecor();
        const mine = decorOf(zone, "rock");
        return mine.map((m) => {
            const item = all.find((d) => d.kind === "rock" && d.x === m.x && d.z === m.z)!;
            // As `vegetation.ts` draws it: its shape, scaled (y a little more or less by its place in the shape's list), turned, sunk.
            const variant = item.variant % 3;
            const yScale = item.scale * rockSquash(item);
            const geometry = rock(variant);
            const position = geometry.getAttribute("position");
            const triangles = new Float32Array(position.count * 3);
            const c = Math.cos(item.rotation);
            const s = Math.sin(item.rotation);
            for (let i = 0; i < position.count; i++) {
                const lx = position.getX(i) * item.scale;
                const ly = position.getY(i) * yScale;
                const lz = position.getZ(i) * item.scale;
                triangles[i * 3] = item.x + lx * c + lz * s;
                triangles[i * 3 + 1] = item.y - DECOR_SINK + ly;
                triangles[i * 3 + 2] = item.z - lx * s + lz * c;
            }
            geometry.dispose();
            return {item, triangles};
        });
    });
}

/** The highest point of the stone straight above or below (x, z), and the face's normal there. */
function stoneTop(stone: Stone, x: number, z: number): {y: number; normal: [number, number, number]} | null {
    const t = stone.triangles;
    let best: {y: number; normal: [number, number, number]} | null = null;
    for (let i = 0; i < t.length; i += 9) {
        const ax = t[i], ay = t[i + 1], az = t[i + 2];
        const bx = t[i + 3], by = t[i + 4], bz = t[i + 5];
        const cx = t[i + 6], cy = t[i + 7], cz = t[i + 8];
        // Barycentric in the x-z plane.
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(d) < 1e-9) continue;
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
        const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        const y = l1 * ay + l2 * by + l3 * cy;
        if (best && y <= best.y) continue;
        let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
        let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        if (ny < 0) {
            nx = -nx;
            ny = -ny;
            nz = -nz;
        }
        const length = Math.hypot(nx, ny, nz) || 1;
        best = {y, normal: [nx / length, ny / length, nz / length]};
    }
    return best;
}

function patchOf(items: MicroDecorItem[]): Patch {
    const x = items.reduce((sum, item) => sum + item.x, 0) / Math.max(items.length, 1);
    const z = items.reduce((sum, item) => sum + item.z, 0) / Math.max(items.length, 1);
    const radius = Math.max(0.3, ...items.map((item) => Math.hypot(item.x - x, item.z - z)));
    return {x, z, radius};
}

/**
 * Where on the water a pond's surface dwellers sit: the lake's lily margin
 * for the fresh-water zones (the wetland's ground stays above the water
 * where its animals stand), else the garden pond by the cottage.
 */
function pool(zone: ArkZone): Pool {
    return cached(`pool#${zone}`, () => {
        if (zone === "river_lake") {
            const points: Array<{x: number; z: number}> = [];
            for (let k = 0; k < 64; k++) {
                const angle = k / 64 * Math.PI * 2;
                const r = LAKE.r - 2.4 - (k % 3) * 0.6;
                const x = LAKE.x + Math.cos(angle) * r;
                const z = LAKE.z + Math.sin(angle) * r;
                if (sampleGround(x, z).height < -0.2) points.push({x, z});
            }
            return {points, y: 0.012};
        }
        const points: Array<{x: number; z: number}> = [];
        for (let k = 0; k < 24; k++) {
            const r = GARDEN_POND.radius * 0.78 * Math.sqrt((k + 0.5) / 24);
            const a = k * 2.39996;
            points.push({x: GARDEN_POND.x + Math.cos(a) * r, z: GARDEN_POND.z + Math.sin(a) * r});
        }
        return {points, y: GARDEN_POND.y + 0.006};
    });
}

// MARK: Places and points

const SURFACE_OF: Record<MicroSpot, MicroSurface> = {house: "wall", lamp: "post", bark: "bark", flowers: "flower", rocks: "rock", leaf_litter: "litter", pond_surface: "water"};

/**
 * A small animal's place from its zone, its slot and its rank, and its
 * species (the spot). `length` is its true body length (m): a cluster's
 * members stand a few body lengths apart.
 */
export function microPlace(slug: string, zone: ArkZone, slot: number, rank: number, length: number): MicroPlace | null {
    const kind = microSpecies(slug);
    if (!kind) return null;
    const own = flags(slug);
    const surface: MicroSurface = kind.spot === "house" ? (own.includes("a") ? "around" : own.includes("o") ? "roof" : "wall") : SURFACE_OF[kind.spot];
    const zoneIndex = Math.max(ARK_ZONES.indexOf(zone), 0);
    const index = slot * ARK_ZONES.length + zoneIndex;
    const [u, v] = r2(index);
    const hash = hashString(`${zone}#${slot}#micro`);
    // How many hosts its surface has, to spread the slots over: picked by u, the rest of u is where on it.
    const count = hostCount(surface, hostZone(zone));
    let host = Math.floor(u * count);
    let a = u * count - host;
    let b = v;
    if (surface === "around") {
        // Round the cottage, the pets the size of a dog among them: the way round from the slot alone at Home (a
        // golden-ratio sequence: slots up to 20 apart stand a metre or more apart), how far out from another.
        // The deck now and then for the small ones. (Another zone's ones, bats and the like, are rare: offset by half a turn.)
        const k = zone === "farm_garden" ? slot : slot + 0.5 + zoneIndex * 0.37;
        host = length < 0.3 && slot % 3 === 0 ? 0 : 1;
        a = ((0.5 + k * 0.6180339887498949) % 1 + 1) % 1;
        b = ((0.3 + k * 0.7548776662466927) % 1 + 1) % 1;
    }
    // The way it heads: clingers mostly up or down a wall or a trunk, a little across; others any way.
    const heading = surface === "wall" || surface === "bark" ? ((hash & 1) ? 0 : Math.PI) + (((hash >>> 3) % 100) / 100 - 0.5) * 1.2 : ((hash >>> 3) % 360) / 180 * Math.PI;
    let offAlong = 0;
    let offAcross = 0;
    if (rank > 0) {
        // A cluster's members: a small spiral about the first, a few body lengths apart.
        const gap = Math.max(length * 3.2, 0.035);
        const r = gap * Math.sqrt(rank);
        const angle = rank * 2.39996;
        offAlong = Math.cos(angle) * r;
        offAcross = Math.sin(angle) * r;
    }
    return {spot: kind.spot, surface, host, a, b, heading, offAlong, offAcross};
}

/**
 * A point on a scenery attach point (the map): the point, `offAlong` and
 * `along` along its heading and `offAcross` across it, kept small on the
 * small hosts (a flower head, a leaf, a lamp) so nobody walks off them.
 */
function attachSurfacePoint(place: MicroPlace, point: AttachPoint, along: number): SurfacePoint {
    const [nx, ny, nz] = point.normal;
    let [tx, ty, tz] = point.tangent;
    const c = Math.cos(place.heading);
    const sn = Math.sin(place.heading);
    // The heading turns the tangent about the normal.
    const bx = ny * tz - nz * ty;
    const by = nz * tx - nx * tz;
    const bz = nx * ty - ny * tx;
    [tx, ty, tz] = [tx * c + bx * sn, ty * c + by * sn, tz * c + bz * sn];
    const reach = point.tag === "flower_head" || point.tag === "leaf" || point.tag === "porch_light" ? 0.025 : point.tag === "tide_pool" ? 0.4 : point.tag === "worm_hole" || point.tag === "burrow_entrance" ? 0.6 : 0.3;
    const u = clamp(place.offAlong + along, -reach, reach);
    const v = clamp(place.offAcross, -reach, reach);
    const cx = ny * tz - nz * ty;
    const cy = nz * tx - nx * tz;
    const cz = nx * ty - ny * tx;
    return {x: point.x + tx * u + cx * v, y: point.y + ty * u + cy * v, z: point.z + tz * u + cz * v, nx, ny, nz, tx, ty, tz};
}

function hostCount(surface: MicroSurface, zone: ArkZone): number {
    switch (surface) {
        case "attach":
            return 1;
        case "wall":
            return 5;
        case "roof":
            return 2;
        case "around":
            return 3;
        case "bark":
            return Math.max(trees(zone).length, 1);
        case "flower":
            return Math.max(decorOf(zone, "flower").length, 1);
        case "rock":
            return Math.max(stones(zone).length, 1);
        case "litter":
        case "water":
        case "post":
            return 1;
    }
}

/** Which zone's hosts a place uses: the house is at Home, the rest in the animal's own zone (the sea's borrow Home's). */
function zoneFor(place: MicroPlace, zone: ArkZone): ArkZone {
    if (place.spot === "house") return "farm_garden";
    if (place.spot === "flowers" && !decorOf(hostZone(zone), "flower").length) return "farm_garden";
    if (place.spot === "rocks" && !stones(hostZone(zone)).length) return "farm_garden";
    return hostZone(zone);
}

/**
 * The point on its surface where a small animal is, `along` metres from
 * its place in the way it heads (its crawl), with the surface's normal and
 * its heading.
 */
export function surfacePoint(place: MicroPlace, zone: ArkZone, along = 0): SurfacePoint {
    if (place.attach) return attachSurfacePoint(place, place.attach, along);
    const hostZoneKey = zoneFor(place, zone);
    switch (place.surface) {
        case "wall":
            return wallPoint(place, along);
        case "roof":
            return roofPoint(place, along);
        case "around":
            return aroundPoint(place, along);
        case "bark": {
            const list = trees(hostZoneKey);
            const tree = list[place.host % Math.max(list.length, 1)];
            if (!tree) return aroundPoint(place, along);
            const {item, trunk} = tree;
            const top = Math.min(trunk.clear, trunk.height - 0.1);
            const up = Math.cos(place.heading);
            const side = Math.sin(place.heading);
            const h = clamp(0.3 + place.b * (top - 0.3) + (place.offAlong + along) * up / item.scale, 0.15, top);
            const radius = trunk.radius + (trunk.top - trunk.radius) * h / trunk.height;
            // Facing the default camera mostly (the south, +z), in world terms; then into the trunk's own turn.
            const world = (place.a - 0.5) * Math.PI * 1.5 + ((place.offAcross + along * side) / item.scale) / radius;
            const local = world - item.rotation;
            // The trunk is a prism: the face under this bearing, and how far out it is there.
            const step = Math.PI * 2 / trunk.sides;
            const faceMiddle = (Math.floor(local / step) + 0.5) * step;
            const apothem = radius * Math.cos(step / 2);
            const out = apothem / Math.cos(local - faceMiddle) + 0.01 / item.scale;
            const lean = trunk.lean * (h / trunk.height) ** 2;
            const lx = Math.sin(local) * out + lean;
            const lz = Math.cos(local) * out;
            const c = Math.cos(item.rotation);
            const s = Math.sin(item.rotation);
            const x = item.x + (lx * c + lz * s) * item.scale;
            const z = item.z + (-lx * s + lz * c) * item.scale;
            const y = item.y - DECOR_SINK + h * item.scale;
            const nx = Math.sin(faceMiddle + item.rotation);
            const nz = Math.cos(faceMiddle + item.rotation);
            // Heading: up the trunk turned by `heading` toward its side.
            const ax = Math.cos(faceMiddle + item.rotation);
            const az = -Math.sin(faceMiddle + item.rotation);
            return {x, y, z, nx, ny: 0, nz, tx: ax * side, ty: up, tz: az * side};
        }
        case "flower": {
            const list = decorOf(hostZoneKey, "flower");
            const item = list[place.host % Math.max(list.length, 1)];
            if (!item) return aroundPoint(place, along);
            const headTop = FLOWER_SHAPE.stem[item.variant % 3] + FLOWER_SHAPE.head * FLOWER_SHAPE.top[item.variant % 3];
            // On the head, a little off its middle.
            const r = FLOWER_SHAPE.head * item.scale * 0.45 * place.b;
            const angle = place.a * Math.PI * 2 + along * 8;
            const x = item.x + Math.cos(angle) * r + place.offAlong * 0.3;
            const z = item.z + Math.sin(angle) * r + place.offAcross * 0.3;
            return {x, y: item.y - DECOR_SINK + headTop * item.scale, z, nx: 0, ny: 1, nz: 0, tx: Math.cos(place.heading), ty: 0, tz: Math.sin(place.heading)};
        }
        case "rock": {
            const list = stones(hostZoneKey);
            const stone = list[place.host % Math.max(list.length, 1)];
            if (!stone) return aroundPoint(place, along);
            const reach = 0.85 * 1.05 * stone.item.scale * 0.62;
            const angle = place.a * Math.PI * 2;
            const r = reach * Math.sqrt(place.b);
            const hx = Math.cos(place.heading);
            const hz = Math.sin(place.heading);
            const x = stone.item.x + Math.cos(angle) * r + hx * (place.offAlong + along) - hz * place.offAcross;
            const z = stone.item.z + Math.sin(angle) * r + hz * (place.offAlong + along) + hx * place.offAcross;
            const top = stoneTop(stone, x, z);
            if (!top) {
                const [nx, ny, nz] = groundNormal(x, z);
                return {x, y: heightAt(x, z), z, nx, ny, nz, tx: hx, ty: 0, tz: hz};
            }
            const [nx, ny, nz] = top.normal;
            // The heading, laid onto the face.
            const dot = hx * nx + hz * nz;
            const tx = hx - nx * dot;
            const ty = -ny * dot;
            const tz = hz - nz * dot;
            const length = Math.hypot(tx, ty, tz) || 1;
            return {x, y: top.y + 0.004, z, nx, ny, nz, tx: tx / length, ty: ty / length, tz: tz / length};
        }
        case "litter": {
            const patch = patchOf(decorOf(hostZoneKey, "leaf"));
            const angle = place.a * Math.PI * 2;
            const r = patch.radius * 0.85 * Math.sqrt(place.b);
            const hx = Math.cos(place.heading);
            const hz = Math.sin(place.heading);
            const x = patch.x + Math.cos(angle) * r + hx * (place.offAlong + along) - hz * place.offAcross;
            const z = patch.z + Math.sin(angle) * r + hz * (place.offAlong + along) + hx * place.offAcross;
            const [nx, ny, nz] = groundNormal(x, z);
            return {x, y: heightAt(x, z) + LEAF_LIFT + 0.006, z, nx, ny, nz, tx: hx, ty: 0, tz: hz};
        }
        case "post": {
            // On the lamp post of its zone: round it and up it, heading up.
            const lamp = zoneLamp(hostZone(zone));
            const angle = (place.a - 0.5) * Math.PI * 1.6 + (place.offAcross + along * Math.sin(place.heading)) / LAMP.radius;
            const h = clamp(0.5 + place.b * (LAMP.height - 0.9) + place.offAlong + along * Math.cos(place.heading), 0.3, LAMP.height - 0.25);
            const r = LAMP.radius + 0.006;
            return {x: lamp.x + Math.sin(angle) * r, y: lamp.y + h, z: lamp.z + Math.cos(angle) * r, nx: Math.sin(angle), ny: 0, nz: Math.cos(angle), tx: 0, ty: 1, tz: 0};
        }
        case "water": {
            const water = pool(zone === "river_lake" || zone === "wetland" ? "river_lake" : "farm_garden");
            const point = water.points[Math.floor(place.a * water.points.length) % Math.max(water.points.length, 1)] ?? {x: GARDEN_POND.x, z: GARDEN_POND.z};
            const hx = Math.cos(place.heading);
            const hz = Math.sin(place.heading);
            const spread = 0.35 * place.b;
            const x = point.x + Math.cos(place.a * 40) * spread + hx * (place.offAlong + along) - hz * place.offAcross;
            const z = point.z + Math.sin(place.a * 40) * spread + hz * (place.offAlong + along) + hx * place.offAcross;
            return {x, y: water.y, z, nx: 0, ny: 1, nz: 0, tx: hx, ty: 0, tz: hz};
        }
        case "attach":
            return place.attach ? attachSurfacePoint(place, place.attach, along) : aroundPoint(place, along);
    }
}

/**
 * How long a small animal at its microhabitat is drawn (m) with the camera
 * `distance` m away: its true length close by, never less than `minPixels`
 * across on screen as the camera draws back, and at most its usual drawn
 * length (the floor applied), where the marker takes over. Continuous in
 * the distance, so zooming never pops it.
 */
export function microDrawnLength(trueLength: number, full: number, distance: number, viewportHeight: number, fovDegrees: number, minPixels: number): number {
    const perPixel = 2 * Math.tan(fovDegrees * Math.PI / 360) * Math.max(distance, 0) / Math.max(viewportHeight, 1);
    return Math.min(Math.max(trueLength, minPixels * perPixel), Math.max(full, trueLength));
}

/** Where the camera looks from to see a small animal at a point: out along its surface's normal, a little above. */
export function viewFrom(point: SurfacePoint): {azimuth: number; polar: number} {
    const horizontal = Math.hypot(point.nx, point.nz);
    if (horizontal < 0.35) return {azimuth: 0, polar: 0.95};
    return {azimuth: Math.atan2(point.nx, point.nz), polar: 1.22};
}
