/**
 * The town island's ground (docs/ark/town-island.md): its height and what covers it, pure functions of (x, z) in
 * metres, the same on every device. The town core is flat at `TOWN_LEVEL` so streets and buildings sit true; the
 * park, the zoo and the farmland roll a little; the farmland rises to a low hill in the north; the coast falls to a
 * beach in the south-east and a grassy shore elsewhere; the canal, the millpond, the farm pond and the harbour basin
 * are cut into it (their walls and quays are meshes, `render/water.ts`).
 */

import {bounds, inBox, inPoly, polylineDistance, polylineWithin, type Poly} from "@/ark-scene/islands/town/geom";
import {CANAL, CANAL_LEVEL, CANAL_WIDTH, HARBOUR_BASIN, inland, MILLPOND, TOWN_LEVEL, townPlan, type GreenKind, type TownPlan} from "@/ark-scene/islands/town/plan";

export type TownSurface =
    | "sea"
    | "sand"
    | "shore"
    | "grass"
    | "lawn"
    | "park"
    | "meadow"
    | "wood"
    | "field"
    | "orchard"
    | "paddock"
    | "farmyard"
    | "zoo"
    | "allotment"
    | "churchyard"
    | "square"
    | "bank"
    | "water";

export type TownGroundSample = {height: number; surface: TownSurface; inland: number; /** 0 in the flat town, 1 where the ground rolls. */ rough: number};

// MARK: - Noise (the same value noise as the wild island's, own seed)

function hash2(x: number, z: number): number {
    let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + 0x2f6b;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number): number {
    return t * t * (3 - 2 * t);
}

export function noise(x: number, z: number): number {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const fx = smooth(x - xi);
    const fz = smooth(z - zi);
    const a = hash2(xi, zi);
    const b = hash2(xi + 1, zi);
    const c = hash2(xi, zi + 1);
    const d = hash2(xi + 1, zi + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

export function fbm(x: number, z: number): number {
    let sum = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let i = 0; i < 4; i++) {
        sum += amplitude * noise(x * frequency + i * 17.3, z * frequency - i * 9.1);
        frequency *= 2.03;
        amplitude *= 0.5;
    }
    return sum / 0.9375;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}

// MARK: - A grid index of the plan's areas

const CELL = 16;

type Indexed = {kind: GreenKind | "garden" | "drive" | "slot" | "savanna" | "farm"; poly: Poly; priority: number};

type GroundIndex = {cells: Map<number, Indexed[]>; streets: TownPlan["streets"]};

let index: GroundIndex | null = null;

function cellKey(cx: number, cz: number): number {
    return (cx + 512) * 1024 + (cz + 512);
}

function groundIndex(): GroundIndex {
    if (index) return index;
    const plan = townPlan();
    const cells = new Map<number, Indexed[]>();
    const add = (item: Indexed) => {
        const b = bounds(item.poly);
        for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++) {
            for (let cz = Math.floor(b.z0 / CELL); cz <= Math.floor(b.z1 / CELL); cz++) {
                const key = cellKey(cx, cz);
                const list = cells.get(key) ?? [];
                list.push(item);
                cells.set(key, list);
            }
        }
    };
    const priority: Partial<Record<Indexed["kind"], number>> = {zoo_lawn: 0, park: 1, wood: 2, beach: 2, churchyard: 3, wild_corner: 3, allotments: 4, green: 5, field: 5, orchard: 5, paddock: 6, farmyard: 7, verge: 8, garden: 6, slot: 6, savanna: 7, farm: 4};
    for (const g of plan.greens) add({kind: g.kind, poly: g.poly, priority: priority[g.kind] ?? 3});
    for (const p of plan.parcels) {
        for (const part of [p.front, p.back]) if (part) add({kind: "garden", poly: cornersOf(part), priority: 6});
    }
    for (const f of plan.farms) add({kind: "farm", poly: cornersOf(f.at), priority: 4});
    for (const s of plan.zoo.slots) add({kind: s.type === "savanna_paddocks" || s.type === "hoofstock_paddocks" ? "savanna" : "slot", poly: cornersOf(s.at), priority: s.type === "savanna_paddocks" ? 7 : 6});
    cells.forEach((list) => list.sort((a, b) => b.priority - a.priority));
    index = {cells, streets: plan.streets};
    return index;
}

function cornersOf(b: {x: number; z: number; w: number; d: number; rot: number}): Poly {
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    const out: Poly = [];
    for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = (lx * b.w) / 2;
        const z = (lz * b.d) / 2;
        out.push({x: b.x + x * c - z * s, z: b.z + x * s + z * c});
    }
    return out;
}

/** The plan's area under a point (the highest priority one), or null for open ground. */
export function areaAt(x: number, z: number): Indexed["kind"] | null {
    const list = groundIndex().cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return null;
    for (const item of list) if (inPoly(item.poly, x, z)) return item.kind;
    return null;
}

/** Distance (m) to the nearest street's carriageway edge plus pavement (0 or less: on it). */
export function streetEdgeDistance(x: number, z: number): number {
    let best = Infinity;
    for (const s of groundIndex().streets) {
        const d = polylineDistance(s.line, x, z) - s.width / 2 - s.pavement;
        if (d < best) best = d;
    }
    return best;
}

// MARK: - Height

const SEA_FLOOR = -16;
const BASIN_FLOOR = -3.6;
const CANAL_BED = CANAL_LEVEL - 1.7;

/** How much the ground rolls here: 0 in the town, 1 in the zoo, the park and the farmland. */
export function roughness(x: number, z: number): number {
    const zoo = x < -56 && z < 18 ? 1 : 0;
    const park = Math.hypot((x - MILLPOND.x) / 52, (z - MILLPOND.z) / 34) < 1 ? 0.8 : 0;
    const farm = smoothstep(-108, -122, z);
    const west = x < -170 ? 0.6 : 0;
    return Math.max(zoo, park, farm, west);
}

/** The base land height before the cuts (m). */
function landHeight(x: number, z: number, rough: number): number {
    const hill = smoothstep(-112, -182, z) * 5.5 * (1 - smoothstep(-40, -110, x) * 0.4);
    const roll = (fbm(x * 0.022 + 7.3, z * 0.022 - 3.1) - 0.5) * 2.2 * rough;
    return TOWN_LEVEL + hill + roll;
}

export function townHeight(x: number, z: number): number {
    return sampleTownGround(x, z).height;
}

export function sampleTownGround(x: number, z: number): TownGroundSample {
    const inl = inland(x, z);
    const rough = roughness(x, z);
    // The shore: a beach in the south-east, a grassy bank elsewhere; the sea floor shelving out.
    const beach = smoothstep(40, 72, x) * smoothstep(92, 118, z);
    const land = landHeight(x, z, rough);
    const shoreWidth = 9 + 17 * beach;
    let height: number;
    if (inl >= 0) {
        const t = smoothstep(0, shoreWidth, inl);
        height = 0.25 + (land - 0.25) * t;
    } else {
        height = Math.max(0.25 + inl * (0.3 - 0.18 * beach) - Math.max(-inl - 24, 0) * 0.35, SEA_FLOOR) + (fbm(x * 0.05, z * 0.05) - 0.5) * 0.8;
    }
    let surface: TownSurface = inl < -0.5 ? "sea" : inl < 3 + 23 * beach ? (beach > 0.5 ? "sand" : "shore") : "grass";

    // The harbour basin, under its quay walls.
    if (inBox(HARBOUR_BASIN, x, z, 0)) {
        height = BASIN_FLOOR + (fbm(x * 0.1, z * 0.1) - 0.5) * 0.6;
        surface = "water";
    } else if (inBox(HARBOUR_BASIN, x, z, 1.2)) {
        height = Math.min(height, TOWN_LEVEL);
    }
    // The canal: a walled channel (the walls are meshes); the towpaths stay at the town's level.
    // (Most of the grid is far from it: `polylineWithin` answers by the canal's bounds alone.)
    if (polylineWithin(CANAL, x, z, CANAL_WIDTH / 2 + 0.55)) {
        const distance = polylineDistance(CANAL, x, z);
        const t = smoothstep(CANAL_WIDTH / 2 + 0.55, CANAL_WIDTH / 2 - 0.2, distance);
        height = height + (CANAL_BED - height) * t;
        if (distance < CANAL_WIDTH / 2) surface = "water";
    }
    // The millpond: a natural bowl with soft banks.
    const pond = Math.hypot((x - MILLPOND.x) / MILLPOND.rx, (z - MILLPOND.z) / MILLPOND.rz);
    if (pond < 1.35) {
        const t = smoothstep(1.35, 0.85, pond);
        height = height + (CANAL_LEVEL - 1.5 - height) * t;
        if (pond < 1) surface = "water";
        else surface = "bank";
    }
    const plan = townPlan();
    for (const w of plan.waters) {
        if (w.kind !== "farm_pond") continue;
        const b = bounds(w.poly);
        if (x < b.x0 - 4 || x > b.x1 + 4 || z < b.z0 - 4 || z > b.z1 + 4) continue;
        const cx = (b.x0 + b.x1) / 2;
        const cz = (b.z0 + b.z1) / 2;
        const r = Math.hypot((x - cx) / ((b.x1 - b.x0) / 2), (z - cz) / ((b.z1 - b.z0) / 2));
        if (r < 1.5) {
            const level = landHeight(cx, cz, roughness(cx, cz)) - 0.45;
            const t = smoothstep(1.5, 0.8, r);
            height = height + (level - w.depth - height) * t;
            surface = r < 1 ? "water" : "bank";
        }
    }
    if (surface === "grass" || surface === "shore" || surface === "sand") {
        const kind = areaAt(x, z);
        if (kind) surface = SURFACE_OF[kind] ?? surface;
    }
    return {height, surface, inland: inl, rough};
}

const SURFACE_OF: Partial<Record<Indexed["kind"], TownSurface>> = {
    park: "park",
    churchyard: "churchyard",
    allotments: "allotment",
    wood: "wood",
    wild_corner: "meadow",
    green: "lawn",
    orchard: "orchard",
    field: "field",
    paddock: "paddock",
    farmyard: "farmyard",
    zoo_lawn: "zoo",
    beach: "sand",
    verge: "square",
    garden: "lawn",
    slot: "zoo",
    savanna: "farmyard",
    farm: "meadow"
};

/** The floor of a building standing on a footprint: the highest ground under its corners (plinths cover the rest). */
export function floorUnder(corners: Array<{x: number; z: number}>): number {
    let high = -Infinity;
    for (const c of corners) high = Math.max(high, townHeight(c.x, c.z));
    return high;
}

// MARK: - What the ground is made of, for its textures (lane GA)

/** Every surface, in a fixed order (the ground grid's per-vertex index). */
export const TOWN_SURFACES: readonly TownSurface[] = ["sea", "sand", "shore", "grass", "lawn", "park", "meadow", "wood", "field", "orchard", "paddock", "farmyard", "zoo", "allotment", "churchyard", "square", "bank", "water"];

/**
 * What a surface shows of the ground's texture layers (`render/surfaces.ts`): soil, sand, mud, leaf litter (the rest
 * is grass), then mown lawn, trodden wear, and a bed under water. 0–1 each.
 */
export function surfaceWeights(surface: TownSurface): [number, number, number, number, number, number, number, number] {
    switch (surface) {
        case "sea":
            return [0, 1, 0, 0, 0, 0, 1, 0];
        case "sand":
            return [0, 1, 0, 0, 0, 0, 0, 0];
        case "shore":
            return [0, 0.35, 0, 0, 0, 0, 0, 0];
        case "lawn":
        case "park":
        case "zoo":
            return [0, 0, 0, 0, 1, 0, 0, 0];
        case "churchyard":
            return [0, 0, 0, 0, 0.6, 0, 0, 0];
        case "wood":
            return [0, 0, 0, 1, 0, 0, 0, 0];
        case "field":
            return [0.7, 0, 0, 0, 0, 0, 0, 0];
        case "orchard":
            return [0, 0, 0, 0, 0, 0.2, 0, 0];
        case "paddock":
            return [0, 0, 0, 0, 0, 0.7, 0, 0];
        case "farmyard":
            return [1, 0, 0.35, 0, 0, 0, 0, 0];
        case "allotment":
            return [0.8, 0, 0, 0, 0, 0, 0, 0];
        case "square":
            return [1, 0, 0, 0, 0, 0, 0, 0];
        case "bank":
            return [0, 0, 0.8, 0, 0, 0, 0, 0];
        case "water":
            return [0, 0, 0.6, 0, 0, 0, 1, 0];
        default:
            return [0, 0, 0, 0, 0, 0, 0, 0];
    }
}

/**
 * The ground grid's weights, 8 bytes a vertex (0–255), from each vertex's surface (its index in `TOWN_SURFACES`),
 * softened over its neighbours (a 3 × 3 box): the shader breaks the softened edge with noise, so a boundary reads as
 * a ragged natural line, never as the grid's 1.1 m steps.
 */
export function townSurfaceWeights(size: number, surfaceIndex: Uint8Array): Uint8Array {
    const table = TOWN_SURFACES.map((s) => surfaceWeights(s));
    const out = new Uint8Array(size * size * 8);
    // A separable box, one channel at a time (two size² scratch rows, not a float copy of the whole grid ×8).
    const across = new Float32Array(size * size);
    const fallback = table[3];
    for (let k = 0; k < 8; k++) {
        for (let row = 0; row < size; row++) {
            for (let column = 0; column < size; column++) {
                let sum = 0;
                let n = 0;
                for (let dc = -1; dc <= 1; dc++) {
                    const c = column + dc;
                    if (c < 0 || c >= size) continue;
                    sum += (table[surfaceIndex[row * size + c]] ?? fallback)[k];
                    n++;
                }
                across[row * size + column] = sum / n;
            }
        }
        for (let row = 0; row < size; row++) {
            for (let column = 0; column < size; column++) {
                let sum = 0;
                let n = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    const r = row + dr;
                    if (r < 0 || r >= size) continue;
                    sum += across[r * size + column];
                    n++;
                }
                out[(row * size + column) * 8 + k] = Math.round((sum / n) * 255);
            }
        }
    }
    return out;
}
