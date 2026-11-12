/**
 * The town island's plan (docs/ark/town-island.md; AnimalDex docs/ark/islands-plan.md §3; decisions 16–28): the land,
 * the canal, the streets, the old town, the 120 homes with their gardens, the parks, the harbour, the 10 farms on the
 * outskirts and the zoo's enclosure slots. In real metres (x east, z south: +z faces the opening camera, as on the
 * wild island), y up from the sea's mean level.
 *
 * Everything is a pure function of this file: no randomness but seeded hashes, so every viewer, the server's atlas
 * and the nav lane see the same town. The plan is built once (`townPlan()`) and never changes with the population:
 * the town is complete from launch (decision 22), the zoo's unopened slots are landscaped until an arrival opens them
 * (decision 23).
 */

import {
    area,
    box,
    boxesOverlap,
    corners,
    ellipse,
    hashText,
    inBox,
    inPoly,
    local,
    polylineAt,
    polylineLength,
    polylineNearest,
    rng,
    smoothLine,
    sub,
    unitOf,
    type Box,
    type Poly,
    type Pt
} from "@/ark-scene/islands/town/geom";
import {ZOO_ENCLOSURE_TYPES, ZOO_TYPES, type ZooEnclosureType} from "@/ark-scene/islands/town/zoo-types";

// MARK: - The square of terrain and sea

/** Part B's chunk (`streaming/chunks.ts` CHUNK_SEGMENTS × the ground's 1.1 m): the town's square is whole chunks. */
export const TOWN_SEGMENT = 1.1;
export const TOWN_CHUNK_SEGMENTS = 48;
export const TOWN_CHUNKS = 9;
export const TOWN_SEGMENTS = TOWN_CHUNK_SEGMENTS * TOWN_CHUNKS;
/** Half the terrain square (m): 9 chunks of 52.8 m, 475.2 m across. */
export const TOWN_HALF = (TOWN_SEGMENTS * TOWN_SEGMENT) / 2;

/** The town's ground level (m above the sea's mean); the old town and the homes sit on it. */
export const TOWN_LEVEL = 2.6;
/** The canal and the millpond's water (m): held above the sea by the lock at the harbour. */
export const CANAL_LEVEL = 1.15;
export const CANAL_WIDTH = 7;
/** Each towpath beside the canal (m). */
export const TOWPATH = 3;

// MARK: - The coast

/**
 * The land's outline: a rounded square (superellipse) wider to the west, where the zoo is, with a wobble so the
 * coast never reads as drawn. `coastNorm` < 1 is land.
 */
export const COAST = {west: 200, east: 192, north: 202, south: 160, power: 3.2};

export function coastWobble(theta: number): number {
    return 0.028 * Math.sin(3 * theta + 1.3) + 0.02 * Math.sin(7 * theta - 0.4) + 0.012 * Math.sin(13 * theta + 2.1) + 0.006 * Math.sin(23 * theta + 0.7);
}

export function coastNorm(x: number, z: number): number {
    const a = x < 0 ? COAST.west : COAST.east;
    const b = z < 0 ? COAST.north : COAST.south;
    const p = COAST.power;
    const n = Math.pow(Math.pow(Math.abs(x / a), p) + Math.pow(Math.abs(z / b), p), 1 / p);
    return n - coastWobble(Math.atan2(z, x));
}

/** Metres inland (positive on land, negative at sea), near enough within ~40 m of the coast. */
export function inland(x: number, z: number): number {
    const r = Math.hypot(x, z) || 1;
    const n = coastNorm(x, z);
    return (1 - n) * (r / Math.max(n, 0.05));
}

// MARK: - Plan types

export type StreetKind = "high" | "road" | "lane" | "track" | "path" | "towpath" | "zoo_path" | "quay";
export type Street = {id: string; kind: StreetKind; line: Poly; /** Carriageway (or path) width. */ width: number; /** Pavement each side (0: none). */ pavement: number; name?: string};

export type BuildingKind =
    | "house"
    | "terrace"
    | "flats"
    | "shop"
    | "church"
    | "hall"
    | "mill"
    | "pub"
    | "harbour_office"
    | "fish_shed"
    | "lighthouse"
    | "farmhouse"
    | "barn"
    | "stable"
    | "coop"
    | "shed"
    | "zoo_house"
    | "zoo_kiosk"
    | "zoo_gate"
    | "keepers_yard"
    | "lock_house";

export type RoofKind = "gable" | "hip" | "flat" | "lean" | "glass" | "none";

export type Building = {
    id: string;
    kind: BuildingKind;
    /** The footprint: `w` along the front, `d` front to back; the front faces local +z. */
    at: Box;
    floors: number;
    /** Eaves height (m) above the ground floor. */
    eaves: number;
    roof: RoofKind;
    /** Households living here (homes only). */
    households: number;
    /** Ridge or roof top (m above the floor), for the urban birds' roof spots and the nav lane. */
    top: number;
    /** A tall building's highest ledge (peregrines): the church tower, the mill chimney, the lighthouse. */
    tall?: {x: number; z: number; y: number};
    /** For a home: its parcel id. For a zoo house: its slot. */
    parcel?: string;
    /** Shops on the ground floor, homes above (terraces on the high street and the market square). */
    shopfront?: boolean;
    /** The street it fronts (bins, cars, the front door). */
    street?: string;
    seed: number;
};

export type ParcelKind = "house" | "terrace_home" | "flats" | "farm" | "farmstead";
export type Parcel = {
    id: string;
    kind: ParcelKind;
    /** The whole parcel. */
    at: Box;
    /** The front garden (or forecourt) and the back garden (or yard, or the flats' courtyard share). */
    front: Box | null;
    back: Box | null;
    building: string;
    households: number;
    /** The street it fronts (bins go out on it, cars park on it). */
    street: string;
    /** A drive for a car (houses), local to the parcel's front garden. */
    drive: Box | null;
    seed: number;
};

export type GreenKind = "park" | "churchyard" | "allotments" | "wood" | "wild_corner" | "green" | "orchard" | "field" | "paddock" | "farmyard" | "zoo_lawn" | "beach" | "verge";
export type Green = {id: string; kind: GreenKind; poly: Poly; crop?: string};

export type WaterKind = "canal" | "millpond" | "harbour" | "farm_pond" | "fountain" | "zoo_pool" | "garden_pond";
export type Water = {id: string; kind: WaterKind; poly: Poly; level: number; depth: number};

export type FarmPlot = {id: string; kind: "smallholding" | "farmstead"; at: Box; buildings: string[]; paddock: Box; yard: Box; run: Box | null; seed: number};

export type ZooSlot = {
    id: string;
    type: ZooEnclosureType;
    /** The slot's order within its type: slot 0 opens first. */
    rank: number;
    /** The enclosure's ground: its fence (hard bounds); `w` along the path, the front (+z local) on the path. */
    at: Box;
    /** The visitors' path it fronts. */
    path: string;
    seed: number;
};

/** A spare enclosure plot: landscaped until an enclosure a type opens past its own slots is drawn on it. */
export type ZooSpare = {id: string; at: Box; path: string; seed: number};

export type Hedge = {id: string; line: Poly; height: number; kind: "hedge" | "wall" | "fence" | "railing" | "picket" | "paddock_rail" | "zoo_fence" | "net"};

export type TownPlan = {
    streets: Street[];
    buildings: Building[];
    parcels: Parcel[];
    greens: Green[];
    waters: Water[];
    farms: FarmPlot[];
    /** The zoo: each type's own slots, and the spares that take an enclosure a type opens past its own (`areas.ts` zooLayout). */
    zoo: {area: Box; slots: ZooSlot[]; spares: ZooSpare[]; plaza: Box; yard: Box; paths: string[]};
    hedges: Hedge[];
    canal: Poly;
    bridges: Array<{id: string; street: string; at: Box}>;
    square: Box;
    /** Trees placed by the plan (parks, gardens, streets, churchyard, wood, orchard, zoo planting). */
    trees: Array<{x: number; z: number; kind: TreeKind; scale: number; seed: number}>;
    /** Where the lock gates are (the canal's end at the harbour). */
    lock: Box;
    /** Boat moorings (canal and harbour): who is in on a day is `people.ts`. */
    moorings: Array<{x: number; z: number; turn: number; length: number; harbour: boolean; seed: number}>;
    /** Street furniture spots, for the people-implied props and the urban wildlife. */
    lamps: Pt[];
    drains: Pt[];
};

export type TreeKind = "oak" | "lime" | "plane" | "birch" | "willow" | "poplar" | "pine" | "yew" | "apple" | "cherry" | "acacia" | "palm" | "hedge_shrub";

// MARK: - The canal, the millpond and the harbour

/** The canal: from the millpond, south through the old town, to the lock at the harbour. */
export const CANAL: Poly = smoothLine([
    {x: 2, z: -60},
    {x: 4, z: -38},
    {x: 2, z: -6},
    {x: 5, z: 30},
    {x: 9, z: 62},
    {x: 12, z: 88},
    {x: 14, z: 102}
], 3);

export const MILLPOND = {x: -14, z: -72, rx: 24, rz: 13};
/** The harbour's basin (sea water, tidal): the canal's lock opens into its north side. */
export const HARBOUR_BASIN = box(16, 131, 66, 52);

// MARK: - Building blocks

type Ctx = {
    streets: Street[];
    buildings: Building[];
    parcels: Parcel[];
    greens: Green[];
    hedges: Hedge[];
    trees: TownPlan["trees"];
    counts: {house: number; terrace: number; flats: number};
    /** Ground that nothing else may be placed on: blocks of homes and their gardens, the square, fields. */
    keepOut: Box[];
};

const HOUSE = {w: 7.4, d: 8.6, setback: 4.2, eaves: 5.3};
/** Terraces on these streets have shops on the ground floor. */
const SHOP_STREETS = new Set(["high_street", "square_walk"]);
const TERRACE_HOME = {w: 5.1, d: 8.8, setback: 2.4, eaves: 5.4};
const FLATS = {w: 17, d: 10.5, eaves: 11.6};

function addBuilding(ctx: Ctx, building: Omit<Building, "seed">): Building {
    const full = {...building, seed: hashText(building.id)};
    ctx.buildings.push(full);
    return full;
}

/**
 * A row of detached houses along one side of a block: `side` +1 fronts the block's local +z edge, -1 its -z edge.
 * Each parcel runs from the street to the block's middle (back to back with the row behind).
 */
function houseRow(ctx: Ctx, id: string, block: Box, side: 1 | -1, street: string, count: number) {
    ctx.keepOut.push(block);
    const depth = block.d / 2;
    const pitch = block.w / count;
    for (let i = 0; i < count; i++) {
        const n = ctx.counts.house++;
        const pid = `${id}-h${i}`;
        const lx = -block.w / 2 + pitch * (i + 0.5);
        const lz = side * (block.d / 4);
        // The parcel, turned so its own +z is towards the street.
        const parcel = sub(block, lx, lz, pitch, depth, side === 1 ? 0 : Math.PI);
        const r = rng(hashText(pid));
        // Semi-detached pairs: each house against the wall it shares with its pair, its drive on the outer side.
        const pairSide = (i % 2 === 0 ? 1 : -1) * side;
        const pair = count % 2 === 0 || i < count - 1;
        const width = pair ? Math.min(6.5 + (r() - 0.5) * 0.4, pitch - 2.9) : HOUSE.w + (r() - 0.5) * 1.2;
        const deep = HOUSE.d + (r() - 0.5) * 1.0;
        const offset = pair ? pairSide * (pitch / 2 - width / 2) : (r() - 0.5) * Math.max(pitch - width - 3.2, 0);
        const frontZ = depth / 2 - HOUSE.setback;
        const house = sub(parcel, offset, frontZ - deep / 2, width, deep);
        const floors = r() < 0.12 ? 1 : 2;
        const bid = `house-${n}`;
        addBuilding(ctx, {id: bid, kind: "house", at: house, floors, eaves: floors === 1 ? 2.9 : HOUSE.eaves, roof: r() < 0.35 ? "hip" : "gable", households: 1, top: (floors === 1 ? 2.9 : HOUSE.eaves) + 2.6, parcel: pid, street});
        const front = sub(parcel, 0, depth / 2 - HOUSE.setback / 2, pitch, HOUSE.setback);
        const backDepth = depth - HOUSE.setback - deep;
        const back = sub(parcel, 0, -depth / 2 + backDepth / 2, pitch, backDepth);
        // The drive: beside the house on its wider side, from the street to the house's front.
        const driveSide = offset > 0 ? -1 : 1;
        const driveX = offset + driveSide * (width / 2 + 1.4);
        const drive = Math.abs(driveX) + 1.2 <= pitch / 2 ? sub(parcel, driveX, depth / 2 - HOUSE.setback / 2 - 0.4, 2.4, HOUSE.setback + 0.8) : null;
        ctx.parcels.push({id: pid, kind: "house", at: parcel, front, back, building: bid, households: 1, street, drive, seed: hashText(pid)});
        // The boundary between gardens (a fence) and the front wall or hedge.
        const left = local(parcel, -pitch / 2, depth / 2);
        const leftBack = local(parcel, -pitch / 2, -depth / 2);
        ctx.hedges.push({id: `${pid}-side`, line: [left, leftBack], height: 1.6, kind: "fence"});
        if (r() < 0.55) ctx.hedges.push({id: `${pid}-front`, line: [local(parcel, -pitch / 2 + 0.3, depth / 2 - 0.4), local(parcel, driveX - driveSide * 1.6 - 0.2, depth / 2 - 0.4)], height: r() < 0.5 ? 0.8 : 1.1, kind: r() < 0.5 ? "hedge" : "wall"});
        // A garden tree at the back now and then.
        if (r() < 0.5) {
            const t = local(parcel, (r() - 0.5) * (pitch - 3), -depth / 2 + 2 + r() * Math.max(backDepth - 4, 0.5));
            ctx.trees.push({x: t.x, z: t.z, kind: r() < 0.4 ? "apple" : r() < 0.5 ? "cherry" : "birch", scale: 0.7 + r() * 0.35, seed: hashText(`${pid}-tree`)});
        }
    }
    // The back line between the two rows.
    ctx.hedges.push({id: `${id}-back${side}`, line: [local(block, -block.w / 2, 0), local(block, block.w / 2, 0)], height: 1.7, kind: "fence"});
}

/** A row of terraces (4 homes each) along one side of a block, back yards to the middle. */
function terraceRow(ctx: Ctx, id: string, block: Box, side: 1 | -1, street: string, count: number) {
    ctx.keepOut.push(block);
    const depth = block.d / 2;
    const pitch = block.w / count;
    for (let i = 0; i < count; i++) {
        const n = ctx.counts.terrace++;
        const pid = `${id}-t${i}`;
        const lx = -block.w / 2 + pitch * (i + 0.5);
        const parcel = sub(block, lx, side * (block.d / 4), pitch, depth, side === 1 ? 0 : Math.PI);
        const r = rng(hashText(pid));
        const width = TERRACE_HOME.w * 4;
        const frontZ = depth / 2 - TERRACE_HOME.setback;
        const row = sub(parcel, 0, frontZ - TERRACE_HOME.d / 2, width, TERRACE_HOME.d);
        const bid = `terrace-${n}`;
        const floors = r() < 0.3 ? 3 : 2;
        const eaves = floors === 3 ? 8.1 : TERRACE_HOME.eaves;
        addBuilding(ctx, {id: bid, kind: "terrace", at: row, floors, eaves, roof: "gable", households: 4, top: eaves + 2.4, parcel: pid, street, shopfront: SHOP_STREETS.has(street)});
        const front = sub(parcel, 0, depth / 2 - TERRACE_HOME.setback / 2, width, TERRACE_HOME.setback);
        const yardDepth = depth - TERRACE_HOME.setback - TERRACE_HOME.d;
        const back = sub(parcel, 0, -depth / 2 + yardDepth / 2, width, yardDepth);
        ctx.parcels.push({id: pid, kind: "terrace_home", at: parcel, front, back, building: bid, households: 4, street, drive: null, seed: hashText(pid)});
        // Yard walls between the four homes.
        for (let k = 0; k <= 4; k++) {
            const x = -width / 2 + k * TERRACE_HOME.w;
            ctx.hedges.push({id: `${pid}-yard${k}`, line: [local(parcel, x, frontZ - TERRACE_HOME.d), local(parcel, x, -depth / 2)], height: 1.8, kind: "wall"});
        }
        ctx.hedges.push({id: `${pid}-rail`, line: [local(parcel, -width / 2, depth / 2 - 0.3), local(parcel, width / 2, depth / 2 - 0.3)], height: 0.9, kind: "railing"});
    }
    ctx.hedges.push({id: `${id}-back${side}`, line: [local(block, -block.w / 2, 0), local(block, block.w / 2, 0)], height: 1.8, kind: "wall"});
}

/** Blocks of flats round a shared courtyard garden: `count` blocks (2–4) on the courtyard's sides. */
function flatsCourt(ctx: Ctx, id: string, block: Box, streets: string[], sides: Array<"n" | "s" | "e" | "w" | "nn" | "ss" | "ee" | "ww">) {
    ctx.keepOut.push(block);
    const r = rng(hashText(id));
    sides.forEach((s, k) => {
        const n = ctx.counts.flats++;
        const bid = `flats-${n}`;
        const along = s === "n" || s === "s" ? block.w : block.d;
        // Two blocks on one side ("nn"): side by side, each in its half.
        const twin = s.length === 2;
        const half = twin ? (sides.slice(0, k).includes(s) ? 1 : -1) : 0;
        // East and west blocks stand between the north and south ones: shorter, so the corners keep a gap.
        const between = (s[0] === "e" || s[0] === "w") && sides.some((o) => o[0] === "n" || o[0] === "s");
        const room = twin ? along / 2 - 3 : between ? along - 2 * (FLATS.d + 2) - 2 : along - 11;
        const w = Math.min(FLATS.w + (r() - 0.5) * 2, room);
        const shift = half * (along / 4 + 0.5);
        const at =
            s[0] === "s" ? sub(block, shift, block.d / 2 - 2 - FLATS.d / 2, w, FLATS.d)
            : s[0] === "n" ? sub(block, shift, -block.d / 2 + 2 + FLATS.d / 2, w, FLATS.d, Math.PI)
            : s[0] === "e" ? sub(block, block.w / 2 - 2 - FLATS.d / 2, shift, w, FLATS.d, Math.PI / 2)
            : sub(block, -block.w / 2 + 2 + FLATS.d / 2, shift, w, FLATS.d, -Math.PI / 2);
        const floors = r() < 0.5 ? 4 : 3;
        const eaves = floors * 2.9;
        addBuilding(ctx, {id: bid, kind: "flats", at, floors, eaves, roof: r() < 0.6 ? "flat" : "hip", households: 8, top: eaves + 1.2, parcel: `${id}-f${k}`, street: streets[k % streets.length]});
        ctx.parcels.push({id: `${id}-f${k}`, kind: "flats", at: block, front: null, back: sub(block, 0, 0, block.w - 2 * (FLATS.d + 3), block.d - 2 * (FLATS.d + 3)), building: bid, households: 8, street: streets[k % streets.length], drive: null, seed: hashText(`${id}-f${k}`)});
    });
    ctx.greens.push({id: `${id}-court`, kind: "green", poly: corners(sub(block, 0, 0, block.w - 6, block.d - 6))});
    ctx.trees.push(...[0, 1].map((k) => {
        const t = local(block, (k - 0.5) * block.w * 0.22, (r() - 0.5) * 6);
        return {x: t.x, z: t.z, kind: (k ? "lime" : "birch") as TreeKind, scale: 0.85 + r() * 0.3, seed: hashText(`${id}-tree${k}`)};
    }));
}

// MARK: - Placing along streets and paths

type Full = Ctx & {waters: Water[]; farms: FarmPlot[]; slots: ZooSlot[]; spares: ZooSpare[]; moorings: TownPlan["moorings"]; misses: string[]};

/** Whether a box is clear: on land (`coastMargin` m in), off every street and path, off the canal and the water, off every building and slot. */
export const PLAN_DEBUG: {why: string | null} = {why: null};
function boxClear(ctx: Full, b: Box, options: {coastMargin?: number; streetMargin?: number; ignoreStreets?: string[]; allowGreens?: boolean} = {}): boolean {
    const ok = boxClearWhy(ctx, b, options);
    PLAN_DEBUG.why = ok;
    return ok === null;
}
function boxClearWhy(ctx: Full, b: Box, options: {coastMargin?: number; streetMargin?: number; ignoreStreets?: string[]; allowGreens?: boolean} = {}): string | null {
    const coastMargin = options.coastMargin ?? 4;
    const streetMargin = options.streetMargin ?? 0.4;
    const pts: Pt[] = [];
    const nx = Math.max(2, Math.ceil(b.w / 2.5));
    const nz = Math.max(2, Math.ceil(b.d / 2.5));
    // Sampled 0.3 m inside the edges: a box may touch a pavement's edge or a neighbour's wall.
    const iw = b.w - 0.6;
    const id = b.d - 0.6;
    for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) pts.push(local(b, -iw / 2 + (iw * i) / nx, -id / 2 + (id * k) / nz));
    for (const p of pts) {
        if (inland(p.x, p.z) < coastMargin) return `coast ${p.x.toFixed(0)},${p.z.toFixed(0)}`;
        if (inBox(HARBOUR_BASIN, p.x, p.z, 3)) return "harbour";
        if (polylineNearest(CANAL, p.x, p.z).distance < CANAL_WIDTH / 2 + TOWPATH + 0.5) return "canal";
        if (Math.hypot((p.x - MILLPOND.x) / (MILLPOND.rx + 4), (p.z - MILLPOND.z) / (MILLPOND.rz + 4)) < 1) return "millpond";
        for (const s of ctx.streets) {
            if (options.ignoreStreets?.includes(s.id)) continue;
            if (polylineNearest(s.line, p.x, p.z).distance < s.width / 2 + s.pavement + streetMargin) return `street ${s.id}`;
        }
        for (const w of ctx.waters) if (inPoly(w.poly, p.x, p.z)) return `water ${w.id}`;
    }
    for (const other of ctx.buildings) if (boxesOverlap(other.at, b, -0.3)) return `building ${other.id}`;
    for (const slot of ctx.slots) if (boxesOverlap(slot.at, b, -0.3)) return `slot ${slot.id}`;
    for (const spare of ctx.spares) if (boxesOverlap(spare.at, b, -0.3)) return `spare ${spare.id}`;
    for (const farm of ctx.farms) if (boxesOverlap(farm.at, b, -0.3)) return `farm ${farm.id}`;
    for (const keep of ctx.keepOut) if (boxesOverlap(keep, b, -0.3)) return `keepOut ${keep.x.toFixed(0)},${keep.z.toFixed(0)}`;
    return null;
}

/** The turn of a box whose front (local +z) faces back across the street from `side` (+1: right of the street's direction). */
function facing(dir: Pt, side: 1 | -1): number {
    return Math.atan2(-side * dir.z, -side * dir.x);
}

type AlongItem = {w: number; d: number; setback?: number; gap?: number; key: string; /** Fill as many as fit: not a miss when left out. */ optional?: boolean};

/**
 * Walks a street from `from` to `to` metres along it, placing each item on `side` with its front on the pavement's
 * edge (plus its setback), skipping ahead where an item would not be clear. Returns the boxes placed, by key.
 */
function alongStreet(ctx: Full, street: Street, side: 1 | -1, from: number, to: number, items: AlongItem[], options: Parameters<typeof boxClear>[2] = {}): Array<{item: AlongItem; at: Box}> {
    const placed: Array<{item: AlongItem; at: Box}> = [];
    let at = from;
    let index = 0;
    let lastWhy: string | null = null;
    let lastIndex = -1;
    const end = Math.min(to, polylineLength(street.line));
    while (index < items.length && at < end) {
        const item = items[index];
        if (at + item.w > end) break;
        const {point, dir} = polylineAt(street.line, at + item.w / 2);
        const nx = -dir.z * side;
        const nz = dir.x * side;
        const reach = street.width / 2 + street.pavement + (item.setback ?? 0.2) + item.d / 2;
        const b = box(point.x + nx * reach, point.z + nz * reach, item.w, item.d, facing(dir, side));
        if (boxClear(ctx, b, options)) {
            placed.push({item, at: b});
            at += item.w + (item.gap ?? 0);
            index++;
        } else {
            if (lastWhy === null || lastIndex !== index) lastWhy = PLAN_DEBUG.why;
            lastIndex = index;
            at += 1;
        }
    }
    for (let i = index; i < items.length; i++) if (!items[i].optional) ctx.misses.push(`${street.id}:${items[i].key}${i === index && lastWhy ? ` (${lastWhy})` : ""}`);
    return placed;
}

// MARK: - The plan

function road(id: string, kind: StreetKind, points: Array<[number, number]>, width: number, pavement: number, name?: string, smooth = 2): Street {
    const line = points.map(([x, z]) => ({x, z}));
    return {id, kind, line: smooth > 0 && line.length > 2 ? smoothLine(line, smooth) : line, width, pavement, name};
}

let cached: TownPlan | null = null;

export function townPlan(): TownPlan {
    if (!cached) cached = buildPlan();
    return cached;
}

/** What the plan could not place (for the validator: empty when the plan is whole). */
export function townPlanMisses(): string[] {
    townPlan();
    return lastMisses;
}
let lastMisses: string[] = [];

/**
 * The streets. Through the old town the high street crosses the canal by the market square; Mill Lane and Harbour
 * Road cross it too; a footbridge links the square to the church: four bridges. East of Park Road the streets are
 * straight (the newer town's grid), so the old streets meet it with a dog-leg at Park Road.
 */
export const TOWN_STREETS: Street[] = [
    road("high_street", "high", [[-166, 34], [-120, 33], [-76, 30], [-40, 31], [-4, 30], [24, 28], [52, 24]], 7, 2.2, "High Street"),
    road("high_street_east", "high", [[52, -1], [186, -1]], 7, 2.2, "High Street", 0),
    road("mill_lane", "road", [[-62, -38], [-30, -38], [20, -41], [52, -46]], 6, 1.8, "Mill Lane"),
    road("mill_lane_east", "road", [[52, -54.5], [188, -54.5]], 6, 1.8, "Mill Lane", 0),
    road("harbour_road", "road", [[-176, 86], [-120, 85], [-78, 84], [-40, 86], [0, 90], [30, 88], [52, 82]], 6, 1.8, "Harbour Road"),
    road("harbour_road_east", "road", [[52, 51.25], [188, 51.25]], 6, 1.8, "Harbour Road", 0),
    road("park_road", "road", [[52, -108.6], [52, 104]], 6, 1.8, "Park Road", 0),
    road("east_road", "road", [[118, -108.6], [118, 104]], 6, 1.8, "East Road", 0),
    road("west_street", "road", [[-76, 30], [-78, 84], [-80, 132]], 6, 1.8, "West Street", 0),
    road("sea_view", "road", [[-127, 33], [-127, 85], [-128, 124]], 6, 1.8, "Sea View", 0),
    road("bay_road", "road", [[52, 104], [118, 104], [180, 104]], 6, 1.8, "Bay Road", 0),
    road("square_walk", "path", [[-57, 24], [-57, -30]], 3, 0, "Market Walk", 0),
    road("church_walk", "path", [[-10, -10], [30, -12]], 3, 0, "Church Walk", 0),
    road("country_lane", "lane", [[-62, -114], [-20, -116], [24, -114], [52, -111], [186, -111]], 5, 0, "Country Lane", 1),
    road("farm_road", "lane", [[-56, -153], [0, -154], [60, -153], [124, -153]], 4.5, 0, "Farm Road", 1),
    road("farm_track_w", "track", [[-6, -116], [-6, -154]], 3.2, 0, undefined, 0),
    road("farm_track_e", "track", [[124, -111], [124, -153]], 3.2, 0, undefined, 0),
    road("quay", "quay", [[-21, 158], [-21, 101.5], [53, 101.5], [53, 158]], 4.5, 0, "The Quay", 0)
];

function buildPlan(): TownPlan {
    const ctx: Full = {streets: [], buildings: [], parcels: [], greens: [], hedges: [], trees: [], counts: {house: 0, terrace: 0, flats: 0}, waters: [], farms: [], slots: [], spares: [], moorings: [], misses: [], keepOut: []};
    ctx.streets.push(...TOWN_STREETS);
    const street = (id: string) => ctx.streets.find((s) => s.id === id)!;

    // MARK: Water: the millpond, the harbour basin, the farm pond (the canal is a line, `CANAL`).
    ctx.waters.push({id: "millpond", kind: "millpond", poly: ellipse(MILLPOND.x, MILLPOND.z, MILLPOND.rx, MILLPOND.rz, 40), level: CANAL_LEVEL, depth: 1.6});
    ctx.waters.push({id: "harbour", kind: "harbour", poly: corners(HARBOUR_BASIN), level: 0, depth: 3.5});
    ctx.waters.push({id: "farm_pond", kind: "farm_pond", poly: ellipse(161, -144, 5.5, 4, 24, 0.3), level: 0, depth: 1.1});

    // MARK: The market square and the civic buildings (kept clear of everything else).
    const square = box(-36, 12, 38, 25, 0.02);
    ctx.keepOut.push(square);
    ctx.greens.push({id: "square", kind: "verge", poly: corners(square)});
    ctx.waters.push({id: "fountain", kind: "fountain", poly: ellipse(square.x, square.z, 2.6, 2.6, 16), level: TOWN_LEVEL + 0.55, depth: 0.5});
    addBuilding(ctx, {id: "town_hall", kind: "hall", at: box(-36, -8, 20, 12, Math.PI + 0.02), floors: 2, eaves: 8, roof: "hip", households: 0, top: 13, tall: {x: -36, z: -8, y: 16}});
    // The church: the nave east–west, the tower at the west end by the canal.
    addBuilding(ctx, {id: "church", kind: "church", at: box(32, -20, 11, 24, Math.PI / 2 + 0.05), floors: 1, eaves: 9, roof: "gable", households: 0, top: 15, tall: {x: 19, z: -20.6, y: 31}});
    const churchyard: Poly = [{x: 13, z: -34}, {x: 46, z: -38}, {x: 46, z: 14}, {x: 14, z: 16}];
    ctx.greens.push({id: "churchyard", kind: "churchyard", poly: churchyard});
    ctx.keepOut.push(box(30, -11, 32, 48));
    for (let i = 0; i < 10; i++) {
        const r = rng(hashText(`churchyard-${i}`));
        const x = 16 + r() * 28;
        const z = -32 + r() * 44;
        if (Math.abs(z + 20) < 8 && x > 18) continue;
        ctx.trees.push({x, z, kind: i % 3 === 0 ? "yew" : i % 3 === 1 ? "lime" : "oak", scale: 0.9 + r() * 0.5, seed: hashText(`churchyard-${i}`)});
    }
    // The mill on the canal by the millpond (its chimney: the town's other tall perch).
    addBuilding(ctx, {id: "mill", kind: "mill", at: box(17, -64, 20, 12, -Math.PI / 2), floors: 4, eaves: 12, roof: "gable", households: 0, top: 16, tall: {x: 17, z: -76, y: 30}});
    // The harbour: the office, the fish shed, the lighthouse on the breakwater, the lock keeper's house.
    addBuilding(ctx, {id: "harbour_office", kind: "harbour_office", at: box(-30, 116, 9, 7, Math.PI / 2), floors: 2, eaves: 6, roof: "hip", households: 0, top: 9});
    addBuilding(ctx, {id: "fish_shed", kind: "fish_shed", at: box(62, 128, 18, 9, -Math.PI / 2), floors: 1, eaves: 4.5, roof: "gable", households: 0, top: 7});
    addBuilding(ctx, {id: "lighthouse", kind: "lighthouse", at: box(36, 166, 5, 5), floors: 5, eaves: 16, roof: "none", households: 0, top: 19, tall: {x: 36, z: 166, y: 18}});
    addBuilding(ctx, {id: "lock_house", kind: "lock_house", at: box(28, 96, 5.8, 5.4, Math.PI / 2), floors: 2, eaves: 5.4, roof: "gable", households: 0, top: 8});

    // MARK: Homes east of Park Road: two columns of blocks between the straight streets, four rows.
    const colA = {x0: 57, x1: 113};
    const colB = {x0: 123, x1: 179};
    const rowsEast = [
        {z0: -105.5, z1: -59.5, north: "country_lane", south: "mill_lane_east"},
        {z0: -49.5, z1: -6, north: "mill_lane_east", south: "high_street_east"},
        {z0: 4, z1: 46.25, north: "high_street_east", south: "harbour_road_east"},
        {z0: 56.25, z1: 99, north: "harbour_road_east", south: "bay_road"}
    ];
    const blockOf = (col: {x0: number; x1: number}, row: {z0: number; z1: number}) => box((col.x0 + col.x1) / 2, (row.z0 + row.z1) / 2, col.x1 - col.x0, row.z1 - row.z0);
    for (let r = 0; r < rowsEast.length; r++) {
        const row = rowsEast[r];
        for (let c = 0; c < 2; c++) {
            const col = c ? colB : colA;
            const id = `e${r + 1}${c ? "b" : "a"}`;
            const block = blockOf(col, row);
            if (r === 3 && c === 1) {
                flatsCourt(ctx, id, block, ["harbour_road_east", "harbour_road_east", "east_road", "bay_road", "bay_road", "east_road"], ["nn", "nn", "w", "ss", "ss", "e"]);
            } else if (r === 2 && c === 1) {
                terraceRow(ctx, id, block, -1, row.north, 2);
                terraceRow(ctx, id, block, 1, row.south, 2);
            } else {
                houseRow(ctx, id, block, -1, row.north, 6);
                houseRow(ctx, id, block, 1, row.south, 6);
            }
        }
    }

    // MARK: The old town: shops along the high street and Mill Lane, terraces back to back, flats round courtyards.
    const shopItems = (prefix: string, n: number): AlongItem[] => Array.from({length: n}, (_, i) => {
        const r = rng(hashText(`${prefix}-${i}`));
        return {key: `${prefix}-${i}`, w: 6 + Math.floor(r() * 4), d: 10 + Math.floor(r() * 3), setback: 0.1, gap: 0, optional: true};
    });
    const shops = (id: string, side: 1 | -1, from: number, to: number) => {
        for (const {item, at} of alongStreet(ctx, street(id), side, from, to, shopItems(`${id}${side}`, 30))) {
            const r = rng(hashText(item.key));
            const floors = r() < 0.5 ? 3 : 2;
            const kind: BuildingKind = r() < 0.1 ? "pub" : "shop";
            addBuilding(ctx, {id: `shop-${item.key}`, kind, at, floors, eaves: floors * 3.1 + 0.4, roof: "gable", households: 0, top: floors * 3.1 + 3});
        }
    };
    shops("high_street", -1, 114, 200);
    shops("mill_lane", 1, 6, 120);
    shops("mill_lane", -1, 70, 120);

    // Homes along streets: `t` a terrace of four, `f` a block of eight flats with its garden behind.
    const homesAlong = (id: string, side: 1 | -1, from: number, to: number, kinds: string, yard = 8.5) => {
        const items: AlongItem[] = kinds.split("").map((k, i) => (k === "t" ? {key: `${id}${side}-t${i}`, w: TERRACE_HOME.w * 4 + 0.6, d: TERRACE_HOME.d + yard, setback: 0.4, gap: 1.6} : {key: `${id}${side}-f${i}`, w: FLATS.w + 1, d: FLATS.d + 9, setback: 1.2, gap: 2.4}));
        for (const {item, at} of alongStreet(ctx, street(id), side, from, to, items)) {
            if (item.key.includes("-t")) terraceParcel(ctx, item.key, at, id);
            else flatsParcel(ctx, item.key, at, id);
        }
    };
    // Back-to-back terraces between the high street and Harbour Road, west of the canal.
    terraceRow(ctx, "ot1", box(-39.5, 57.5, 66, 42, 0.02), -1, "high_street", 3);
    terraceRow(ctx, "ot1", box(-39.5, 57.5, 66, 42, 0.02), 1, "harbour_road", 3);
    // The south-west: flats round courtyards either side of Sea View, homes along Harbour Road, West Street and Sea View.
    flatsCourt(ctx, "sw1", box(-151.5, 59, 41, 40), ["high_street", "sea_view", "harbour_road", "high_street"], ["n", "e", "s", "w"]);
    flatsCourt(ctx, "sw2", box(-102, 58.5, 40, 40), ["high_street", "west_street", "harbour_road", "sea_view"], ["n", "e", "s", "w"]);
    homesAlong("harbour_road", 1, 0, 92, "tt");
    flatsCourt(ctx, "sh1", box(-55, 112, 36, 40, 0.03), ["harbour_road", "west_street", "harbour_road", "harbour_road"], ["n", "w", "s", "e"]);
    homesAlong("west_street", 1, 58, 125, "t");
    homesAlong("sea_view", -1, 58, 125, "t");
    homesAlong("sea_view", 1, 58, 100, "t");
    // Terraces facing the market square from the west (Market Walk), and up Park Road by the mill.
    homesAlong("square_walk", -1, 1, 54, "tt");
    // Along the high street west of the old town, backing onto the zoo's savanna (shallower yards).
    homesAlong("high_street", -1, 2, 84, "ttt", 6.8);
    homesAlong("park_road", 1, 4, 64, "tt");
    // East of the canal: flats by the church and along the seafront on Bay Road.
    flatsCourt(ctx, "os1", box(30, 58, 34, 40, -0.02), ["high_street", "park_road", "harbour_road", "park_road"], ["n", "e", "s", "w"]);
    homesAlong("bay_road", 1, 2, 150, "fff");

    // MARK: The town park and the millpond, allotments, a small wood and a wild corner.
    const park: Poly = [{x: -50, z: -108}, {x: -4, z: -110}, {x: 6, z: -108}, {x: 8, z: -48}, {x: -20, z: -46}, {x: -50, z: -46}];
    ctx.greens.push({id: "park", kind: "park", poly: park});
    for (let i = 0; i < 30; i++) {
        const r = rng(hashText(`park-${i}`));
        const a = r() * Math.PI * 2;
        const rr = 1.3 + r() * 0.8;
        const x = MILLPOND.x + Math.cos(a) * MILLPOND.rx * rr;
        const z = MILLPOND.z + Math.sin(a) * MILLPOND.rz * rr * 1.7;
        if (x < -46 || x > 0 || z < -104 || z > -52) continue;
        ctx.trees.push({x, z, kind: i % 5 === 0 ? "willow" : i % 5 === 1 ? "plane" : i % 5 === 2 ? "oak" : i % 5 === 3 ? "lime" : "birch", scale: 0.9 + r() * 0.5, seed: hashText(`park-${i}`)});
    }
    ctx.greens.push({id: "allotments", kind: "allotments", poly: corners(box(17, -97, 16, 20))});
    ctx.greens.push({id: "wild_corner", kind: "wild_corner", poly: corners(box(-44, -96, 22, 14, 0.1))});
    ctx.greens.push({id: "beach", kind: "beach", poly: [{x: 58, z: 132}, {x: 120, z: 132}, {x: 186, z: 120}, {x: 190, z: 160}, {x: 58, z: 160}]});
    ctx.greens.push({id: "wood", kind: "wood", poly: [{x: -198, z: 22}, {x: -176, z: 22}, {x: -174, z: 84}, {x: -194, z: 84}]});
    for (let i = 0; i < 18; i++) {
        const r = rng(hashText(`wood-${i}`));
        const x = -192 + r() * 14;
        const z = 24 + r() * 56;
        if (inland(x, z) < 5) continue;
        ctx.trees.push({x, z, kind: i % 4 === 0 ? "pine" : i % 4 === 1 ? "birch" : "oak", scale: 0.85 + r() * 0.5, seed: hashText(`wood-${i}`)});
    }

    // MARK: Moorings: boats at the quay and along the canal (who is in on a day: people.ts).
    for (let i = 0; i < 8; i++) {
        const r = rng(hashText(`mooring-h${i}`));
        const east = i % 2 === 1;
        ctx.moorings.push({x: east ? 46.5 : -14.5, z: 112 + Math.floor(i / 2) * 10, turn: (r() - 0.5) * 0.08, length: 6 + r() * 4, harbour: true, seed: hashText(`mooring-h${i}`)});
    }
    for (let i = 0; i < 6; i++) {
        const along = 30 + i * 24;
        const {point, dir} = polylineAt(CANAL, along);
        const side = i % 2 ? 1 : -1;
        const nx = -dir.z * side;
        const nz = dir.x * side;
        ctx.moorings.push({x: point.x + nx * (CANAL_WIDTH / 2 - 1.3), z: point.z + nz * (CANAL_WIDTH / 2 - 1.3), turn: Math.atan2(dir.x, dir.z), length: 12 + (i % 3) * 3, harbour: false, seed: hashText(`mooring-c${i}`)});
    }

    // MARK: The farmland: ten farms in two rows (along the country lane, along the farm road), fields and an orchard.
    const farmAlong = (id: string, side: 1 | -1, from: number, keys: string[]) => {
        const items: AlongItem[] = keys.map((key) => (key.startsWith("farmstead") ? {key, w: 40, d: 30, setback: 0.6, gap: 5} : {key, w: 25, d: 25, setback: 0.6, gap: 5}));
        for (const {item, at} of alongStreet(ctx, street(id), side, from, 400, items, {coastMargin: 6})) addFarm(ctx, item.key, at);
    };
    farmAlong("country_lane", -1, 1, ["farmstead-0", "smallholding-0", "smallholding-1", "smallholding-2", "smallholding-3", "smallholding-7"]);
    farmAlong("farm_road", -1, 2, ["smallholding-4", "smallholding-5", "farmstead-1", "smallholding-6"]);
    // Fields: north of the farm road, and the north-east between the lane and the coast; an orchard among them.
    const crops = ["cereal", "pasture", "maize", "cabbage", "cereal", "tilled", "pasture", "sprouts"];
    let fieldIndex = 0;
    const field = (b: Box, crop?: string) => {
        const ok = corners(b).every((p) => inland(p.x, p.z) > 4) && boxClear(ctx, b, {coastMargin: 4});
        if (!ok) {
            ctx.misses.push(`field ${crop ?? ""} at ${b.x},${b.z} (${PLAN_DEBUG.why ?? "coast"})`);
            return;
        }
        const i = fieldIndex++;
        const kind: GreenKind = crop === "orchard" ? "orchard" : "field";
        ctx.greens.push({id: `field-${i}`, kind, poly: corners(b), crop: crop ?? crops[i % crops.length]});
        ctx.keepOut.push(b);
        const p = corners(b);
        ctx.hedges.push({id: `field-${i}-hedge`, line: [p[0], p[1], p[2], p[3], p[0]], height: 1.6, kind: "hedge"});
        if (kind === "orchard") {
            // Fruit trees in rows about 4.5 m apart.
            const columns = Math.max(2, Math.floor((b.w - 2) / 4.5) + 1);
            const rows = Math.max(2, Math.floor((b.d - 2) / 4.5) + 1);
            for (let k = 0; k < columns * rows; k++) {
                const t = local(b, -b.w / 2 + 2 + (k % columns) * ((b.w - 4) / (columns - 1)), -b.d / 2 + 2 + Math.floor(k / columns) * ((b.d - 4) / (rows - 1)));
                ctx.trees.push({x: t.x, z: t.z, kind: "apple", scale: 0.7, seed: hashText(`orchard-${k}`)});
            }
        }
    };
    // The north-east corner between the farm track, the lane and the coast: two fields and the orchard.
    field(box(160.5, -124, 15, 17, 0.02), "pasture");
    field(box(134, -152, 14, 14, 0.02), "orchard");

    // MARK: The zoo: rows of enclosures back to back between three paths, the entrance plaza by the park.
    const zooPaths: Street[] = [
        road("zoo_a", "zoo_path", [[-70, -32], [-120, -32], [-186, -32]], 5, 0, undefined, 0),
        road("zoo_b", "zoo_path", [[-70, -88], [-130, -88], [-194, -88]], 5, 0, undefined, 0),
        road("zoo_c", "zoo_path", [[-70, -144], [-120, -144], [-180, -144]], 5, 0, undefined, 0),
        road("zoo_spine", "zoo_path", [[-66, -26], [-66, -150]], 5, 0, undefined, 0),
        road("zoo_west", "zoo_path", [[-186, -32], [-193, -60], [-194, -88], [-188, -118], [-180, -144]], 4, 0, undefined, 2)
    ];
    ctx.streets.push(...zooPaths);
    const rank: Record<string, number> = {};
    const zooRow = (path: string, side: 1 | -1, depth: number, rows: Array<[ZooEnclosureType, number]>, from = 10) => {
        const items: AlongItem[] = rows.flatMap(([type, n]) => Array.from({length: n}, () => {
            const spec = ZOO_TYPES[type];
            const wanted = spec.w * spec.d;
            const w = Math.max(Math.min(wanted / depth, depth * 2.2), spec.form === "house" ? 9 : 11);
            const d = Math.min(depth, wanted / w);
            const k = (rank[type] = (rank[type] ?? -1) + 1);
            // The server's enclosure name: the type and its number from 1 (`voyage_zoo_enclosure_pick`).
            return {key: `${type}-${k + 1}`, w, d, setback: 0.4, gap: spec.form === "house" ? 0.3 : 1.4};
        }));
        for (const {item, at} of alongStreet(ctx, street(path), side, from, 400, items, {coastMargin: 5})) {
            const type = item.key.replace(/-\d+$/, "") as ZooEnclosureType;
            ctx.slots.push({id: item.key, type, rank: Number(item.key.split("-").pop()) - 1, at, path, seed: hashText(item.key)});
        }
    };
    // Walking west, side 1 is north. The launch slots of each type nearest the entrance (rank 0 first).
    zooRow("zoo_a", -1, 40.5, [["savanna_paddocks", 3]], 8);
    zooRow("zoo_a", 1, 24, [["big_cats", 2], ["bears_wolves", 3]], 8);
    zooRow("zoo_b", -1, 23, [["aquarium", 2], ["reptile_house", 3], ["insect_house", 1], ["nocturnal_house", 2]], 8);
    zooRow("zoo_b", 1, 24.5, [["hoofstock_paddocks", 3], ["small_mammals", 1]], 8);
    zooRow("zoo_c", -1, 23.5, [["primate_house", 4], ["penguin_seal_pools", 1], ["small_mammals", 1]], 8);
    zooRow("zoo_c", 1, 20, [["aviaries", 5]], 8);
    // Walking north up the spine, side 1 is east (towards the park), side -1 the 9 m strip before the rows.
    zooRow("zoo_spine", 1, 12, [["childrens_farm", 2], ["small_mammals", 1]], 14);
    zooRow("zoo_spine", -1, 8.5, [["aviaries", 1]], 12);
    // Two spare plots beside the savanna, for an enclosure a type opens past its own slots (the server opens up to 40).
    for (const {item, at} of alongStreet(ctx, street("zoo_a"), -1, 8, 400, [{key: "spare-1", w: 15, d: 24, setback: 0.4, gap: 1.4, optional: true}], {coastMargin: 5})) {
        ctx.spares.push({id: item.key, at, path: "zoo_a", seed: hashText(item.key)});
    }
    // The second on the lawn north of the aviaries, by the coast path.
    for (const candidate of [box(-100, -178, 18, 18), box(-122, -177, 18, 18), box(-90, -176, 16, 16)]) {
        if (ctx.spares.length >= 2) break;
        if (boxClear(ctx, candidate, {coastMargin: 5})) ctx.spares.push({id: `spare-${ctx.spares.length + 1}`, at: candidate, path: "zoo_c", seed: hashText(`spare-${ctx.spares.length + 1}`)});
    }
    if (ctx.spares.length < 2) ctx.misses.push("zoo: spare plots");
    ctx.greens.push({id: "zoo_lawn", kind: "zoo_lawn", poly: [{x: -200, z: -190}, {x: -54, z: -190}, {x: -54, z: 16}, {x: -200, z: 16}]});

    plant(ctx);

    lastMisses = ctx.misses;
    return {
        streets: ctx.streets,
        buildings: ctx.buildings,
        parcels: ctx.parcels,
        greens: ctx.greens,
        waters: ctx.waters,
        farms: ctx.farms,
        zoo: {area: box(-128, -87, 144, 206), slots: ctx.slots, spares: ctx.spares, plaza: box(-62, -20, 12, 14), yard: box(-184, -10, 16, 12), paths: zooPaths.map((p) => p.id)},
        hedges: ctx.hedges,
        canal: CANAL,
        bridges: [],
        square,
        trees: ctx.trees,
        lock: box(14, 100, 10, 6),
        moorings: ctx.moorings,
        lamps: [],
        drains: []
    };
}

/**
 * The planting: trees in the park, the wood, the zoo between its enclosures, along hedgerows, some streets and the
 * coast; more garden trees and front-garden shrubs. Each tree only where it is clear of buildings, streets, water,
 * fields and enclosures (a tree is a nav obstacle: its trunk).
 */
function plant(ctx: Full) {
    const clear = (x: number, z: number, r: number, options: Parameters<typeof boxClear>[2] = {}) => boxClear(ctx, box(x, z, r * 2, r * 2), {coastMargin: 3, streetMargin: 0.6, ...options});
    const add = (x: number, z: number, kind: TreeKind, scale: number, seed: string) => ctx.trees.push({x, z, kind, scale, seed: hashText(seed)});
    // The park round the millpond: a loose scatter of parkland trees.
    const park = ctx.greens.find((g) => g.id === "park");
    if (park) {
        const r = rng(hashText("park-planting"));
        for (let x = -48; x < 6; x += 8) {
            for (let z = -106; z < -48; z += 8) {
                const px = x + r() * 6;
                const pz = z + r() * 6;
                if (r() > 0.42 || !inPoly(park.poly, px, pz) || !clear(px, pz, 1.5)) continue;
                if (ctx.trees.some((t) => Math.hypot(t.x - px, t.z - pz) < 6)) continue;
                add(px, pz, (["oak", "lime", "plane", "birch", "willow"] as TreeKind[])[Math.floor(r() * 5)], 0.85 + r() * 0.4, `park-p-${x}-${z}`);
            }
        }
    }
    // The wood: dense.
    const wood = ctx.greens.find((g) => g.id === "wood");
    if (wood) {
        const r = rng(hashText("wood-planting"));
        for (let x = -198; x < -170; x += 4.5) {
            for (let z = 20; z < 86; z += 4.5) {
                const px = x + r() * 3;
                const pz = z + r() * 3;
                if (!inPoly(wood.poly, px, pz) || inland(px, pz) < 3 || r() < 0.2) continue;
                if (ctx.trees.some((t) => Math.hypot(t.x - px, t.z - pz) < 3.6)) continue;
                add(px, pz, (["oak", "birch", "pine", "oak", "lime"] as TreeKind[])[Math.floor(r() * 5)], 0.75 + r() * 0.45, `wood-p-${Math.round(x)}-${Math.round(z)}`);
            }
        }
    }
    // The zoo: trees along its paths, between the enclosures, and round its edge.
    const r = rng(hashText("zoo-planting"));
    for (const id of ["zoo_a", "zoo_b", "zoo_c", "zoo_spine", "zoo_west"]) {
        const path = ctx.streets.find((s) => s.id === id);
        if (!path) continue;
        const length = polylineLength(path.line);
        for (let a = 4; a < length; a += 7) {
            const {point, dir} = polylineAt(path.line, a);
            for (const side of [-1, 1]) {
                const off = side * (path.width / 2 + 1.6);
                const px = point.x - dir.z * off;
                const pz = point.z + dir.x * off;
                if (r() < 0.45 || !clear(px, pz, 0.9)) continue;
                add(px, pz, (["lime", "birch", "plane", "oak", "pine"] as TreeKind[])[Math.floor(r() * 5)], 0.6 + r() * 0.35, `zoo-p-${id}-${a}-${side}`);
            }
        }
    }
    for (let x = -196; x < -54; x += 7) {
        for (let z = -192; z < 16; z += 7) {
            const px = x + r() * 5;
            const pz = z + r() * 5;
            if (r() < 0.5 || !clear(px, pz, 1.4)) continue;
            if (ctx.trees.some((t) => Math.hypot(t.x - px, t.z - pz) < 5)) continue;
            add(px, pz, (["oak", "pine", "birch", "lime"] as TreeKind[])[Math.floor(r() * 4)], 0.7 + r() * 0.4, `zoo-e-${Math.round(x)}-${Math.round(z)}`);
        }
    }
    // Hedgerow trees along the farms' and fields' hedges; trees by the farmhouses.
    for (const h of ctx.hedges) {
        if (h.kind !== "hedge" || !(h.id.startsWith("field") || h.id.includes("smallholding") || h.id.includes("farmstead"))) continue;
        const length = polylineLength(h.line);
        for (let a = 6; a < length; a += 19) {
            const {point} = polylineAt(h.line, a);
            if (r() < 0.45 || ctx.trees.some((t) => Math.hypot(t.x - point.x, t.z - point.z) < 8)) continue;
            add(point.x, point.z, r() < 0.7 ? "oak" : "lime", 0.8 + r() * 0.35, `hedge-${h.id}-${a}`);
        }
    }
    // The grassy shore: a fringe of pines, oaks and shrubs, where nothing else stands.
    for (let k = 0; k < 360; k++) {
        const theta = (k / 360) * Math.PI * 2;
        const rr = 150;
        let px = Math.cos(theta) * rr;
        let pz = Math.sin(theta) * rr;
        // Walk in from far out to 9 m inland.
        for (let s = 0; s < 40; s++) {
            if (inland(px, pz) >= 9) break;
            px *= 0.985;
            pz *= 0.985;
        }
        if (r() < 0.62 || (px > 52 && pz > 100) || !clear(px, pz, 1.2, {coastMargin: 5})) continue;
        if (ctx.trees.some((t) => Math.hypot(t.x - px, t.z - pz) < 7)) continue;
        add(px, pz, r() < 0.5 ? "pine" : r() < 0.5 ? "hedge_shrub" : "oak", 0.7 + r() * 0.4, `shore-${k}`);
    }
    // Street trees on the town's wider streets (the pavement's outer edge).
    for (const id of ["high_street_east", "harbour_road_east", "mill_lane_east", "east_road", "park_road", "harbour_road", "high_street"]) {
        const s = ctx.streets.find((q) => q.id === id);
        if (!s) continue;
        const length = polylineLength(s.line);
        for (let a = 10; a < length - 6; a += 18) {
            const {point, dir} = polylineAt(s.line, a);
            const side = Math.floor(a / 18) % 2 ? 1 : -1;
            const off = side * (s.width / 2 + s.pavement - 0.55);
            const px = point.x - dir.z * off;
            const pz = point.z + dir.x * off;
            if (ctx.streets.some((o) => o.id !== s.id && polylineNearest(o.line, px, pz).distance < o.width / 2 + o.pavement + 3)) continue;
            if (polylineNearest(CANAL, px, pz).distance < CANAL_WIDTH / 2 + 6) continue;
            if (ctx.parcels.some((p) => p.drive && inBox(p.drive, px, pz, 1.5))) continue;
            if (ctx.trees.some((t) => Math.hypot(t.x - px, t.z - pz) < 7)) continue;
            add(px, pz, "lime", 0.62 + r() * 0.15, `street-${id}-${a}`);
        }
    }
    // Gardens: more back-garden trees, a shrub or two in the front gardens.
    for (const p of ctx.parcels) {
        const q = rng(p.seed + 7);
        if (p.kind === "house" && p.back && q() < 0.45) {
            const t = local(p.back, (q() - 0.5) * (p.back.w - 3), (q() - 0.5) * (p.back.d - 3));
            if (!ctx.trees.some((u) => Math.hypot(u.x - t.x, u.z - t.z) < 4)) add(t.x, t.z, q() < 0.4 ? "apple" : q() < 0.5 ? "cherry" : "birch", 0.6 + q() * 0.3, `garden-${p.id}`);
        }
        if (p.front && q() < 0.6) {
            const t = local(p.front, (q() < 0.5 ? -1 : 1) * (p.front.w / 2 - 1.1), 0);
            add(t.x, t.z, "hedge_shrub", 0.55 + q() * 0.25, `front-${p.id}`);
        }
    }
}

/** A farm on a plot placed along a lane: the farmhouse at the front, the barn behind, a coop and run, a paddock and a yard. */
function addFarm(ctx: Full, id: string, at: Box) {
    const kind = id.startsWith("farmstead") ? "farmstead" : "smallholding";
    const r = rng(hashText(id));
    const left = r() < 0.5 ? 1 : -1;
    const buildings: string[] = [];
    const house = sub(at, (kind === "farmstead" ? -12 : -6.5) * left, at.d / 2 - 5.2, kind === "farmstead" ? 10 : 7.5, kind === "farmstead" ? 8 : 7);
    addBuilding(ctx, {id: `${id}-house`, kind: "farmhouse", at: house, floors: 2, eaves: 5.2, roof: "gable", households: 0, top: 8, parcel: id});
    buildings.push(`${id}-house`);
    const barnW = kind === "farmstead" ? 14 : 10;
    const barnD = kind === "farmstead" ? 10 : 7;
    const barn = sub(at, (at.w / 2 - barnW / 2 - 1.5) * left, -at.d / 2 + barnD / 2 + 1.5, barnW, barnD);
    addBuilding(ctx, {id: `${id}-barn`, kind: "barn", at: barn, floors: 1, eaves: kind === "farmstead" ? 5 : 4, roof: "gable", households: 0, top: kind === "farmstead" ? 9 : 7, parcel: id});
    buildings.push(`${id}-barn`);
    if (kind === "farmstead") {
        addBuilding(ctx, {id: `${id}-stable`, kind: "stable", at: sub(at, -8 * left, -at.d / 2 + 4, 12, 5.5), floors: 1, eaves: 3, roof: "lean", households: 0, top: 4.5, parcel: id});
        buildings.push(`${id}-stable`);
    }
    const coop = sub(at, (at.w / 2 - 3) * left, at.d / 2 - 3.2, 2.6, 2);
    addBuilding(ctx, {id: `${id}-coop`, kind: "coop", at: coop, floors: 1, eaves: 1.4, roof: "gable", households: 0, top: 2.1, parcel: id});
    buildings.push(`${id}-coop`);
    const paddock = sub(at, -2 * left, kind === "farmstead" ? -2 : -1.5, at.w * 0.55, at.d * 0.36);
    const yard = sub(at, 2 * left, at.d / 2 - 5.2, at.w * 0.3, 6);
    const run = sub(at, (at.w / 2 - 4) * left, at.d / 2 - 8, 6, 5);
    ctx.farms.push({id, kind, at, buildings, paddock, yard, run, seed: hashText(id)});
    ctx.greens.push({id: `${id}-paddock`, kind: "paddock", poly: corners(paddock)});
    // The farm's crop patch in the back corner opposite the barn (crops by its seed).
    const crops = sub(at, -left * (at.w / 2 - at.w * 0.2 - 1), -at.d / 2 + at.d * 0.1 + 1.2, at.w * 0.4, at.d * 0.2);
    ctx.greens.push({id: `${id}-crops`, kind: "field", poly: corners(crops), crop: ["cabbage", "cereal", "sprouts", "maize", "tilled"][hashText(id) % 5]});
    ctx.greens.push({id: `${id}-yard`, kind: "farmyard", poly: corners(yard)});
    const p = corners(at);
    ctx.hedges.push({id: `${id}-hedge`, line: [p[0], p[1], p[2], p[3], p[0]], height: 1.5, kind: "hedge"});
    const q = corners(paddock);
    ctx.hedges.push({id: `${id}-rails`, line: [q[0], q[1], q[2], q[3], q[0]], height: 1.1, kind: "paddock_rail"});
    const u = corners(run);
    ctx.hedges.push({id: `${id}-run`, line: [u[0], u[1], u[2], u[3], u[0]], height: 1.2, kind: "fence"});
}

/** A block of eight flats on a parcel placed along a street: the block at the front, its garden behind. */
function flatsParcel(ctx: Ctx, pid: string, parcel: Box, street: string) {
    const n = ctx.counts.flats++;
    const r = rng(hashText(pid));
    const at = sub(parcel, 0, parcel.d / 2 - FLATS.d / 2 - 0.6, FLATS.w, FLATS.d);
    const floors = r() < 0.5 ? 4 : 3;
    const bid = `flats-${n}`;
    addBuilding(ctx, {id: bid, kind: "flats", at, floors, eaves: floors * 2.9, roof: r() < 0.6 ? "flat" : "hip", households: 8, top: floors * 2.9 + 1.2, parcel: pid, street});
    const gardenDepth = parcel.d - FLATS.d - 1.2;
    const back = sub(parcel, 0, -parcel.d / 2 + gardenDepth / 2, parcel.w, gardenDepth);
    ctx.parcels.push({id: pid, kind: "flats", at: parcel, front: null, back, building: bid, households: 8, street, drive: null, seed: hashText(pid)});
    ctx.greens.push({id: `${pid}-garden`, kind: "green", poly: corners(back)});
    const p = corners(parcel);
    ctx.hedges.push({id: `${pid}-hedge`, line: [local(parcel, -parcel.w / 2, parcel.d / 2 - FLATS.d - 1.2), p[0], p[1], local(parcel, parcel.w / 2, parcel.d / 2 - FLATS.d - 1.2)], height: 1.4, kind: "hedge"});
}

/** One terrace row on a parcel placed by `alongStreet`: four homes at the front, back yards behind. */
function terraceParcel(ctx: Ctx, pid: string, parcel: Box, street: string) {
    const n = ctx.counts.terrace++;
    const r = rng(hashText(pid));
    const width = TERRACE_HOME.w * 4;
    const frontZ = parcel.d / 2 - TERRACE_HOME.setback * 0.5;
    const row = sub(parcel, 0, frontZ - TERRACE_HOME.d / 2, width, TERRACE_HOME.d);
    const bid = `terrace-${n}`;
    const floors = r() < 0.35 ? 3 : 2;
    const eaves = floors === 3 ? 8.1 : TERRACE_HOME.eaves;
    addBuilding(ctx, {id: bid, kind: "terrace", at: row, floors, eaves, roof: "gable", households: 4, top: eaves + 2.4, parcel: pid, street, shopfront: SHOP_STREETS.has(street)});
    const yardDepth = parcel.d - TERRACE_HOME.d - TERRACE_HOME.setback * 0.5;
    const back = sub(parcel, 0, -parcel.d / 2 + yardDepth / 2, width, yardDepth);
    ctx.parcels.push({id: pid, kind: "terrace_home", at: parcel, front: null, back, building: bid, households: 4, street, drive: null, seed: hashText(pid)});
    for (let k = 0; k <= 4; k++) {
        const x = -width / 2 + k * TERRACE_HOME.w;
        ctx.hedges.push({id: `${pid}-yard${k}`, line: [local(parcel, x, frontZ - TERRACE_HOME.d), local(parcel, x, -parcel.d / 2)], height: 1.8, kind: "wall"});
    }
    ctx.hedges.push({id: `${pid}-back`, line: [local(parcel, -width / 2, -parcel.d / 2), local(parcel, width / 2, -parcel.d / 2)], height: 1.8, kind: "wall"});
}

/** Land area (m²) of the plan's island, sampled at 1 m. */
export function landArea(step = 1): number {
    let count = 0;
    for (let x = -TOWN_HALF; x < TOWN_HALF; x += step) for (let z = -TOWN_HALF; z < TOWN_HALF; z += step) if (coastNorm(x + step / 2, z + step / 2) < 1 && !inBox(HARBOUR_BASIN, x, z)) count++;
    return count * step * step;
}

export {area, boxesOverlap, corners, ellipse, polylineLength, unitOf};
export type {Box, Poly, Pt};
export const ZOO_TYPE_ORDER = ZOO_ENCLOSURE_TYPES.map((type) => ({type, ...ZOO_TYPES[type]}));
