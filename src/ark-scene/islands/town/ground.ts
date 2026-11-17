/**
 * The town island's ground (docs/ark/town-island.md): its height and what covers it, pure functions of (x, z) in
 * metres, the same on every device. The town core is flat at `TOWN_LEVEL` so streets and buildings sit true; the
 * park, the zoo and the farmland roll a little; the farmland rises to a low hill in the north; the coast falls to a
 * beach in the south-east and a grassy shore elsewhere; the canal, the millpond, the farm pond and the harbour basin
 * are cut into it (their walls and quays are meshes, `render/water.ts`).
 */

import {bounds, corners, inBox, inPoly, polylineDistance, polylineWithin, type Box, type Poly} from "@/ark-scene/islands/town/geom";
import {CANAL, CANAL_LEVEL, CANAL_WIDTH, HARBOUR_BASIN, inland, MILLPOND, TOWN_LEVEL, townPlan, type GreenKind, type TownPlan} from "@/ark-scene/islands/town/plan";
import {clipStreets, type ClipStreet} from "@/ark-scene/islands/town/street-clip";
import {inSafari, safariDitch, safariWaterNorm, SAFARI_AREAS, SAFARI_WATERS, type SafariWater} from "@/ark-scene/islands/town/safari";

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
    | "water"
    // p4 (safari): the plains' dry grass, the desert's sand and scrub, the waterholes' mud.
    | "savanna"
    | "desert"
    | "mud";

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
/** p2 (land): the millpond's bowl (m, in its ellipse's own measure: 1 at the water's edge): the bank reaches this far out, the ground at the rim just over the water, the reeds' shelf, the bed (over the sea's 0). */
export const MILLPOND_BANK = 1.35;
const MILLPOND_RIM = CANAL_LEVEL + 0.1;
const MILLPOND_SHELF = CANAL_LEVEL - 0.35;
const MILLPOND_BED = 0.2;
const CANAL_BED = CANAL_LEVEL - 1.7;

let gradedStreets: ClipStreet[] | null = null;

/**
 * How much a point is on a street's graded bed (graphics pass 1): 1 on the street and its pavements and half a metre
 * round them, easing to 0 four metres beyond. A street is laid on level ground, not on the park's or the zoo's rolls.
 */
export function streetGrade(x: number, z: number): number {
    gradedStreets ??= clipStreets(townPlan().streets);
    let grade = 0;
    for (const c of gradedStreets) {
        if (x < c.box.x0 - 5 || x > c.box.x1 + 5 || z < c.box.z0 - 5 || z > c.box.z1 + 5) continue;
        const reach = Math.max(c.band, c.half);
        grade = Math.max(grade, smoothstep(reach + 4.5, reach + 0.5, polylineDistance(c.street.line, x, z)));
        if (grade >= 1) break;
    }
    return grade;
}

/**
 * How much the ground rolls here: 0 in the town, 1 in the zoo, the park and the farmland; 0 on a street's bed.
 * (Graphics pass 1: the zoo's and the park's edges were hard, so the ground stepped up to 0.4 m at an invisible line,
 * and the park's ran along the mill lane: the grass stood up through the middle of the road, the owner's "random glitch
 * patch in the road". Each edge now eases over a few metres, and the streets are graded.)
 */
export function roughness(x: number, z: number, grade = streetGrade(x, z)): number {
    const zoo = smoothstep(-52, -60, x) * smoothstep(22, 14, z);
    const park = 0.8 * smoothstep(1.0, 0.9, Math.hypot((x - MILLPOND.x) / 52, (z - MILLPOND.z) / 34));
    const farm = smoothstep(-108, -122, z);
    const west = 0.6 * smoothstep(-166, -174, x);
    return Math.max(zoo, park, farm, west) * (1 - grade);
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

/**
 * A building's floor as it is drawn (`render/buildings.ts` buildingFrame): the highest ground under its corners and its
 * middle, plus 0.15 m. Its roof, eaves and ledges stand on this, so a spot on them takes its height from here too (lane
 * town birds: the roof spots took the ground at the middle, and 27 perches sat sunk 5 cm or more into a sloping
 * street's roofs).
 */
export function townBuildingFloor(b: Box): number {
    let high = townHeight(b.x, b.z);
    for (const c of corners(b)) high = Math.max(high, townHeight(c.x, c.z));
    return high + 0.15;
}

export function sampleTownGround(x: number, z: number): TownGroundSample {
    const inl = inland(x, z);
    const grade = streetGrade(x, z);
    const rough = roughness(x, z, grade);
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
        // p4 (safari): past the old square (237.6 m) the floor goes on down into the strait's deep water, as the sea's
        // floor did there before the square grew; far enough off any coast that no shore steepens.
        const past = Math.max(Math.abs(x), Math.abs(z)) - 237.6;
        if (past > 0) height -= smoothstep(0, 12, past) * smoothstep(20, 45, -inl) * 30;
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
    // (p2 (land), the owner's "the sides and water of the pond are layered above the ground so there's a gap": the bowl
    // fell to 0.3 m at the water's edge, under the water's 1.15 m, and its bed to −0.35 m, under the sea's level, so the
    // water's sheet stood on air at its rim with the sea's plane showing through below it. The bank now comes down to
    // just over the water at the rim (the sheet's edge tucked under it), a shallow shelf for the reeds, then the bed,
    // which stays above the sea's level.)
    const pond = Math.hypot((x - MILLPOND.x) / MILLPOND.rx, (z - MILLPOND.z) / MILLPOND.rz);
    if (pond < MILLPOND_BANK) {
        if (pond >= 1) {
            height = height + (MILLPOND_RIM - height) * smoothstep(MILLPOND_BANK, 1, pond);
            surface = "bank";
        } else {
            height = MILLPOND_RIM - (MILLPOND_RIM - MILLPOND_SHELF) * smoothstep(1, 0.86, pond) - (MILLPOND_SHELF - MILLPOND_BED) * smoothstep(0.86, 0.5, pond);
            surface = height < CANAL_LEVEL ? "water" : "bank";
        }
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
    // p4 (safari): the habitats' ground, their ha-ha ditches and their waterholes cut level with the ground.
    if (inl > 0 && inSafari(x, z)) {
        const s = safariGround(x, z, height, surface, inl, rough);
        height = s.height;
        surface = s.surface;
    }
    return {height, surface, inland: inl, rough};
}

/** p4 (safari): a pool's or waterhole's water level (m): the land at its middle, a hand under it. */
const safariLevels = new Map<SafariWater, number>();
export function safariWaterLevel(w: SafariWater): number {
    let level = safariLevels.get(w);
    if (level === undefined) safariLevels.set(w, (level = landHeight(w.x, w.z, roughness(w.x, w.z)) - 0.12));
    return level;
}

/** How far a waterhole's bank reaches (in its own measure), and where its mud ends. */
const SAFARI_BANK = 1.45;
const SAFARI_MUD = 1.22;

function safariGround(x: number, z: number, height: number, surface: TownSurface, inl: number, rough: number): {height: number; surface: TownSurface} {
    let h = height;
    let s = surface;
    if (s !== "sea" && s !== "water" && s !== "sand") {
        for (const a of SAFARI_AREAS) {
            if (!inBox(a.at, x, z, 2.5)) continue;
            s = a.habitat === "desert" ? "desert" : a.habitat === "forest" || a.habitat === "tigers" ? "meadow" : a.habitat === "wetland" || a.habitat === "river" ? "meadow" : "savanna";
            break;
        }
    }
    // The ha-ha: a ditch inside the herbivores' sides (grass in its floor), so the road looks over open ground.
    const ditch = safariDitch(x, z);
    if (ditch > 0) {
        h -= 0.9 * ditch * (1 - streetGrade(x, z));
        if (ditch > 0.55 && s !== "desert") s = "bank";
    }
    for (const w of SAFARI_WATERS) {
        const n = safariWaterNorm(w, x, z);
        if (n >= SAFARI_BANK) continue;
        const level = safariWaterLevel(w);
        const rim = level + 0.12;
        if (n >= 1) {
            h = h + (rim - h) * smoothstep(SAFARI_BANK, 1, n);
            if (n < SAFARI_MUD) s = "mud";
        } else {
            h = rim - 0.3 * smoothstep(1, 0.82, n) - (w.depth - 0.18) * smoothstep(0.82, 0.25, n);
            s = h < level ? "water" : "mud";
        }
    }
    void inl;
    void rough;
    return {height: h, surface: s};
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
export const TOWN_SURFACES: readonly TownSurface[] = ["sea", "sand", "shore", "grass", "lawn", "park", "meadow", "wood", "field", "orchard", "paddock", "farmyard", "zoo", "allotment", "churchyard", "square", "bank", "water", "savanna", "desert", "mud"];

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
            // p2 (town2): mown grass paths between the raised beds (`render/scenery.ts` allotmentBeds), a little trodden.
            return [0, 0, 0, 0, 0.6, 0.2, 0, 0];
        case "square":
            return [1, 0, 0, 0, 0, 0, 0, 0];
        case "bank":
            return [0, 0, 0.8, 0, 0, 0, 0, 0];
        case "water":
            return [0, 0, 0.6, 0, 0, 0, 1, 0];
        // p4 (safari): dry grass over bare soil, game trails trodden in it; sand with a little soil; wet mud.
        case "savanna":
            return [0.1, 0.04, 0, 0, 0, 0.14, 0, 0];
        case "desert":
            return [0.3, 0.8, 0, 0, 0, 0.15, 0, 0];
        case "mud":
            return [0, 0, 1, 0, 0, 0, 0, 0];
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
