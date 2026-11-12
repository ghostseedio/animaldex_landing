/**
 * What grows and lies on the wild island (Part C; islands plan §2.2's transitions): trees at their real heights and kept
 * apart by their crowns, shrubs, ground plants, rocks, logs, reeds, lily pads, kelp, seagrass, coral heads, the cove's
 * floes and the fixtures the map's rules name (caves, termite mounds, logs). Every item is a pure function of the
 * terrain and its grid cell, so the island's scenery is the same on every device and any chunk can be built on its own
 * (Part B's "seeded per chunk": an item's neighbours are only the cells round it).
 *
 * The mix at a point follows the zone weights there, so a transition is a real mix: oaks thinning into a savanna's
 * acacias, conifers climbing to the tree line, reeds giving way to sedge and meadow.
 *
 * The heights are the scenery lane's real ones (decision 34, landing `ark-scenery` tree-pick.ts REAL_HEIGHT).
 */

import manifest from "@/ark-scene/assets-manifest.json";
import {fbm, hashString} from "@/ark-scene/world";
import {sampleWildGround, underWater, type WildGroundSample} from "@/ark-scene/islands/wild/ground";
import {gridHeight, gridSlope} from "@/ark-scene/islands/wild/terrain-cache";
import {inRange, nearWhale} from "@/ark-scene/islands/wild/reserves";
import {COVE, ICE_FRONT_Z, coveDistance} from "@/ark-scene/islands/wild/fields";
import {WILD_HALF, wildChunkOf} from "@/ark-scene/islands/wild/frame";

type AssetInfo = {kind: string; height: number; crown_radius?: number; trunk_radius?: number; bounds?: {min: [number, number, number]; max: [number, number, number]}};
const ASSETS = (manifest as unknown as {assets: Record<string, AssetInfo>}).assets;

/** Real mean heights (m) by tree kind: the scenery lane's (decision 34). */
export const REAL_HEIGHT: Record<string, number> = {oak: 18, beech: 22, birch: 16, willow: 12, apple: 5, pine: 22, spruce: 25, acacia: 8, palm: 15, mangrove: 8, emergent: 45, snag: 10};

export type WildItemKind = "tree" | "shrub" | "plant" | "grass" | "rock" | "log" | "reed" | "lily" | "kelp" | "seagrass" | "coral" | "floe" | "mound" | "cave";

export type WildItem = {
    kind: WildItemKind;
    /** The asset library's id (null: drawn by the island's own geometry: coral, floes, termite mounds). */
    asset: string | null;
    x: number;
    y: number;
    z: number;
    yaw: number;
    /** Uniform scale on the asset (its own metres), or the procedural shape's size (m). */
    scale: number;
    /** Drawn height (m). */
    height: number;
    /** Footprint: a trunk's radius, a rock's half-width (m); 0 for what an animal walks through. */
    solid: number;
    /** A tree's crown radius (m). */
    crown: number;
    /** Part B's chunk. */
    chunk: number;
    /** A colour shade (0.85…1.15). */
    shade: number;
    /** A rock's or a log's up, leaning into its slope (unit; absent: straight up). */
    up?: [number, number, number];
    /**
     * A tree's storey (P3, `decor-v2.ts`): the canopy's own trees (the motion pass's decor trees: obstacles and perches)
     * or the understorey under them (its forest fill).
     */
    storey?: "canopy" | "under";
    /**
     * A tree's order (0…1): the canopy's by its priority (0 first, as `treeStands` decides between neighbours), the
     * understorey's a hash of its place (the fill's rank: which trees a lighter tier draws).
     */
    rank?: number;
};

const frac = (v: number) => v - Math.floor(v);
function unit(x: number, z: number, salt: number): number {
    return frac(Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453);
}
function pick<T>(list: readonly T[], r: number): T {
    return list[Math.min(Math.floor(r * list.length), list.length - 1)];
}
function variant(kind: string, r: number): string {
    return pick(["a", "b", "c"].filter((v) => ASSETS[`${kind}-${v}`]).map((v) => `${kind}-${v}`), r);
}
const meanHeights = new Map<string, number>();
function meanHeight(kind: string): number {
    let m = meanHeights.get(kind);
    if (m === undefined) {
        const hs = ["a", "b", "c"].map((v) => ASSETS[`${kind}-${v}`]?.height).filter((h): h is number => h !== undefined);
        m = hs.reduce((s, h) => s + h, 0) / Math.max(hs.length, 1);
        meanHeights.set(kind, m);
    }
    return m;
}

// MARK: - Trees

/** The tree a candidate becomes, by the zone weights at its point (a weighted draw), or null. */
function treeKind(s: WildGroundSample, r: number, r2: number): {kind: string; size: number} | null {
    const w = s.weights;
    const e = s.height;
    const montane = Math.min(1, Math.max(0, (e - 13) / 12));
    // Each zone's share of the draw: its weight times how many trees it grows.
    const shares: Array<[string, number]> = [
        ["rainforest", w.rainforest * 0.62],
        ["woodland", w.woodland * 0.5],
        ["mountains", w.mountains * 0.48 * (1 - Math.min(1, Math.max(0, (e - 30) / 9)))],
        ["grassland", w.grassland * 0.035],
        ["river_lake", w.river_lake * 0.22],
        ["wetland", w.wetland * 0.06],
        ["seashore", w.seashore * (s.estuary > 0.2 ? 0.5 : s.temperature > 0.72 && s.cliff < 0.3 && s.moisture > 0.35 ? 0.07 : 0.004)],
        ["desert", w.desert * 0.008]
    ];
    const total = shares.reduce((sum, [, v]) => sum + v, 0);
    if (r >= total) return null;
    let at = r;
    let zone = shares[0][0];
    for (const [z, v] of shares) {
        if (at < v) {
            zone = z;
            break;
        }
        at -= v;
    }
    switch (zone) {
        case "rainforest":
            if (s.inland < 25 && s.temperature > 0.8 && r2 < 0.18) return {kind: "palm", size: 0.9 + 0.3 * r2};
            return r2 < 0.16 ? {kind: "emergent", size: 0.9 + 0.25 * frac(r2 * 7)} : {kind: "emergent", size: 0.55 + 0.22 * frac(r2 * 5)};
        case "woodland":
            if (montane > frac(r2 * 3)) return {kind: r2 < 0.5 ? "pine" : "spruce", size: 0.8 + 0.4 * frac(r2 * 9)};
            return {kind: r2 < 0.04 ? "snag" : r2 < 0.42 ? "oak" : r2 < 0.75 ? "beech" : "birch", size: 0.8 + 0.4 * frac(r2 * 9)};
        case "mountains":
            return {kind: r2 < 0.45 ? "pine" : r2 < 0.96 ? "spruce" : "snag", size: (0.7 + 0.35 * frac(r2 * 9)) * (1 - 0.35 * Math.min(1, Math.max(0, (e - 24) / 14)))};
        case "grassland":
            return {kind: "acacia", size: 0.75 + 0.5 * frac(r2 * 9)};
        case "river_lake":
            if (s.temperature > 0.84 && s.moisture > 0.7) return {kind: r2 < 0.6 ? "emergent" : "palm", size: 0.5 + 0.2 * frac(r2 * 9)};
            return {kind: r2 < 0.6 ? "willow" : r2 < 0.85 ? "birch" : "oak", size: 0.8 + 0.4 * frac(r2 * 9)};
        case "wetland":
            return {kind: s.estuary > 0.15 ? "mangrove" : r2 < 0.7 ? "willow" : "birch", size: 0.8 + 0.4 * frac(r2 * 9)};
        case "seashore":
            return s.estuary > 0.2 ? {kind: "mangrove", size: 0.8 + 0.4 * frac(r2 * 9)} : {kind: "palm", size: 0.85 + 0.35 * frac(r2 * 9)};
        default:
            return {kind: "acacia", size: 0.6 + 0.3 * frac(r2 * 9)};
    }
}

/** How open the woods stand (0 in a glade, 1 in the deep woods): broad open patches a few tens of metres across. */
function woodsCover(x: number, z: number): number {
    return smooth(0.6, 0.52, fbm(x * 0.026 + 41, z * 0.026 - 17));
}
function smooth(a: number, b: number, v: number): number {
    const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
    return t * t * (3 - 2 * t);
}

const TREE_GRID = 4;

type Candidate = {x: number; z: number; prio: number; item: WildItem | null};

function treeCandidate(i: number, j: number): Candidate {
    const h = hashString(`t${i},${j}`);
    const jx = ((h & 0xffff) / 0xffff - 0.5) * TREE_GRID * 0.9;
    const jz = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * TREE_GRID * 0.9;
    const x = i * TREE_GRID + jx;
    const z = j * TREE_GRID + jz;
    const prio = unit(x, z, 11);
    const out: Candidate = {x, z, prio, item: null};
    if (Math.abs(x) > WILD_HALF - 2 || Math.abs(z) > WILD_HALF - 2) return out;
    const s = sampleWildGround(x, z);
    if (s.height < 0.35 || s.inland < 3 || underWater(s) || s.ice > 0.01 || s.fresh > 0.05) return out;
    if (s.river < s.riverHit.width + 2.5) return out;
    if (gridSlope(x, z) > 0.85) return out;
    if (inRange(x, z, 2)) return out;
    const forest = s.weights.rainforest + s.weights.woodland;
    const glade = forest > 0.3 ? 0.35 + 0.65 * woodsCover(x, z) : 1;
    const t = treeKind(s, unit(x, z, 1) / glade, unit(x, z, 2));
    if (!t) return out;
    const id = variant(t.kind, unit(x, z, 3));
    const info = ASSETS[id];
    if (!info) return out;
    const real = (REAL_HEIGHT[t.kind] ?? info.height) / meanHeight(t.kind);
    const scale = Math.min(Math.max(real * t.size, 0.3), 3.2);
    const crown = (info.crown_radius ?? 2) * scale;
    out.item = {kind: "tree", asset: id, x, y: s.height - 0.15, z, yaw: unit(x, z, 4) * Math.PI * 2, scale, height: info.height * scale, solid: (info.trunk_radius ?? 0.3) * scale, crown, chunk: wildChunkOf(x, z), shade: 0.88 + 0.24 * unit(x, z, 5), storey: "canopy", rank: 1 - prio};
    return out;
}

let treeCache: Map<string, Candidate> | null = null;
function treeAt(i: number, j: number): Candidate {
    treeCache ??= new Map();
    const key = `${i},${j}`;
    let c = treeCache.get(key);
    if (!c) {
        c = treeCandidate(i, j);
        treeCache.set(key, c);
    }
    return c;
}

/**
 * How much room a tree keeps round its trunk (m): a share of its crown, as crowns interlock in a wood (a tall tree's
 * crown spreads over its neighbours'), never less than its trunk and a step.
 */
function spacingOf(tree: WildItem): number {
    return Math.max(Math.min(tree.crown * 0.42, 6.5), tree.solid + 1.2);
}

/**
 * A tree stands when no neighbour candidate with a higher priority stands within their crowns' reach (each crown's
 * three quarters: crowns may touch, trunks never crowd): a local rule, so a chunk's trees need only its cells and a
 * margin round it.
 */
function treeStands(i: number, j: number, depth = 0): boolean {
    const c = treeAt(i, j);
    if (!c.item) return false;
    const reach = Math.ceil((spacingOf(c.item) + 6.5) / TREE_GRID);
    for (let di = -reach; di <= reach; di++) {
        for (let dj = -reach; dj <= reach; dj++) {
            if (!di && !dj) continue;
            const o = treeAt(i + di, j + dj);
            if (!o.item || o.prio <= c.prio) continue;
            const apart = spacingOf(c.item) + spacingOf(o.item);
            if (Math.hypot(o.x - c.x, o.z - c.z) < apart && (depth > 2 || treeStands(i + di, j + dj, depth + 1))) return false;
        }
    }
    return true;
}

// MARK: - The understorey

/**
 * The rainforest's and the woodland's lower storey (the canopy's own trees are far apart at their real crowns): young
 * emergents and palms 10–18 m under the rainforest's canopy, birches, young beeches and snags under the woodland's, on
 * their own grid and kept clear of the canopy's trunks.
 */
const UNDER_GRID = 6;
function understorey(i: number, j: number): WildItem | null {
    const h = hashString(`u${i},${j}`);
    const x = i * UNDER_GRID + ((h & 0xffff) / 0xffff - 0.5) * UNDER_GRID * 0.85;
    const z = j * UNDER_GRID + (((h >>> 16) & 0xffff) / 0xffff - 0.5) * UNDER_GRID * 0.85;
    if (Math.abs(x) > WILD_HALF - 2 || Math.abs(z) > WILD_HALF - 2) return null;
    const s = sampleWildGround(x, z);
    if (s.height < 0.6 || s.inland < 5 || underWater(s) || s.ice > 0 || s.river < s.riverHit.width + 3 || gridSlope(x, z) > 0.8 || inRange(x, z, 2)) return null;
    const rain = s.weights.rainforest;
    const wood = s.weights.woodland * (s.height < 26 ? 1 : 0);
    const r = unit(x, z, 61);
    if (r > rain * 0.55 + wood * 0.3) return null;
    const r2 = unit(x, z, 62);
    const rainy = r < rain * 0.55;
    const kind = rainy ? (r2 < 0.7 ? "emergent" : "palm") : r2 < 0.45 ? "birch" : r2 < 0.85 ? "beech" : "snag";
    const id = variant(kind, unit(x, z, 63));
    const info = ASSETS[id];
    if (!info) return null;
    const target = rainy ? (kind === "emergent" ? 10 + 8 * unit(x, z, 64) : 9 + 5 * unit(x, z, 64)) : 9 + 6 * unit(x, z, 64);
    const scale = target / info.height;
    return {kind: "tree", asset: id, x, y: s.height - 0.15, z, yaw: unit(x, z, 65) * Math.PI * 2, scale, height: target, solid: (info.trunk_radius ?? 0.3) * scale, crown: (info.crown_radius ?? 2) * scale, chunk: wildChunkOf(x, z), shade: 0.85 + 0.2 * unit(x, z, 66), storey: "under", rank: unit(x, z, 67)};
}

// MARK: - The rest

/** One of a cell's ground items: by its zone weights and what the ground is. */
function groundItem(x: number, z: number, s: WildGroundSample, roll: number, r2: number, slope: number): Omit<WildItem, "chunk" | "shade"> | null {
    const w = s.weights;
    const water = underWater(s);
    const yaw = r2 * Math.PI * 2;
    let r = roll;
    const at = (kind: WildItemKind, asset: string, scale: number, solid = 0, y = s.height) => {
        const info = ASSETS[asset];
        return info ? {kind, asset, x, y, z, yaw, scale, height: info.height * scale, solid, crown: 0} : null;
    };
    // The sea.
    if (water === "sea") {
        const depth = -s.height;
        if (s.kelp > 0.45 && depth > 3 && depth < 13 && s.inland > -55 && r < 0.3) return at("kelp", r2 < 0.6 ? "kelp-giant-a" : "kelp-bull-a", Math.min(depth * 0.8, 9) / (r2 < 0.6 ? 6 : 3.2));
        if (s.reef > 0.3 && depth > 0.4 && depth < 7 && r < 0.42) {
            if (s.inland > -38 && depth < 4 && r < 0.12) return at("seagrass", variant("seagrass", r2), 0.9 + 0.5 * frac(r2 * 3));
            return {kind: "coral", asset: null, x, y: s.height, z, yaw, scale: 0.5 + 1.3 * frac(r2 * 7), height: 0.6, solid: 0, crown: 0};
        }
        if (depth < 3 && s.inland > -20 && s.cliff < 0.3 && s.temperature > 0.6 && r < 0.05) return at("seagrass", variant("seagrass", r2), 1);
        return null;
    }
    if (water === "fresh") {
        if (s.freshLevel !== null && s.freshLevel - s.height < 1.4 && r < 0.12 && s.riverHit.d > s.riverHit.width * 0.6) return {...at("lily", variant("lily-pads", r2), 1.2, 0, s.freshLevel + 0.01)!};
        if (s.freshLevel !== null && s.freshLevel - s.height < 0.5 && r < 0.4) return at("reed", r2 < 0.5 ? "reeds-phragmites-a" : "reeds-cattail-a", 0.9 + 0.5 * frac(r2 * 3), 0);
        return null;
    }
    if (s.ice > 0.3 || s.height < 0.15) return null;
    // The marsh: reeds thick on the wetland's low ground and along the lake's and the river's margins.
    const marsh = s.weights.wetland * (s.height < 1.5 ? 1 : 0.2) + (s.freshLevel === null && s.riverHit.d < s.riverHit.width + 2.5 && !s.riverHit.upper ? 0.5 : 0);
    if (r < 0.3 * marsh) return at("reed", r2 < 0.5 ? "reeds-phragmites-a" : "reeds-cattail-a", 0.8 + 0.5 * frac(r2 * 3), 0);
    r -= 0.3 * marsh;
    if (r < 0) return null;
    // Rocks: the mountains' boulders and scree, the coast's barnacled stones and tide pools, kopjes on the plains.
    const rocky = w.mountains * (0.06 + 0.12 * Math.min(1, slope)) + w.desert * 0.025 + w.grassland * 0.006 + w.polar * 0.05 + (s.cliff > 0.3 && s.inland < 10 ? 0.12 : 0) + w.woodland * 0.008 + w.rainforest * 0.004;
    if (r < rocky) {
        if (s.inland < 8 && s.height < 2.2) return at("rock", r2 < 0.45 ? variant("tide-pool-rock", r2 * 3) : variant("boulder-cluster-barnacle", r2 * 3), 0.9 + 0.8 * frac(r2 * 5), 0.7);
        if (w.mountains > 0.5 && slope > 0.45 && r2 < 0.5) return at("rock", variant("scree", r2 * 3), 1.4 + 1.2 * frac(r2 * 5), 0);
        const mossy = w.woodland + w.rainforest + w.river_lake > 0.5;
        const id = mossy ? (r2 < 0.5 ? "boulder-mossy-a" : "boulder-cluster-mossy-a") : r2 < 0.55 ? variant("boulder", r2 * 3) : variant("boulder-cluster", r2 * 3);
        const size = (w.mountains > 0.5 ? 1.3 + 2.2 * frac(r2 * 5) : 0.8 + 1.4 * frac(r2 * 5));
        return at("rock", id, size, 0.75 * size);
    }
    roll = r - rocky;
    // Logs in the woods.
    const forest = w.rainforest + w.woodland;
    if (forest > 0.5 && roll < 0.012) return at("log", variant(r2 < 0.4 ? "log-mossy" : r2 < 0.7 ? "log-rotten" : "log-fresh", frac(r2 * 7)), 1.6 + 1.2 * frac(r2 * 5), 0);
    roll -= 0.012;
    // Shrubs: the understorey, the savanna's and the steppe's bushes.
    const shrubby = forest * 0.07 + w.grassland * 0.025 + w.desert * 0.03 + w.mountains * 0.03 * (s.height < 42 ? 1 : 0) + w.river_lake * 0.05 + w.seashore * 0.015 * (s.cliff > 0.3 ? 0 : 1);
    if (roll < shrubby) {
        const id = w.desert + w.grassland > 0.5 ? (r2 < 0.6 ? "bush-bramble-b" : "bush-holly-b") : w.mountains > 0.4 ? "bush-blueberry-a" : pick(["bush-hazel-a", "bush-holly-a", "bush-bramble-a", "bush-holly-b"], r2);
        return at("shrub", id, (w.desert + w.grassland > 0.5 ? 0.9 : 1.2) * (0.8 + 0.6 * frac(r2 * 5)), 0.15);
    }
    roll -= shrubby;
    // Ground plants: ferns in the woods, flowers in the meadows and the alpine, sedge by the water, grass in the open.
    if (forest > 0.4 && roll < 0.1 * forest) return at("plant", pick(["fern-bracken-a", "fern-bracken-b", "fern-sword-a", "fern-sword-b", "fern-lady-a", "fern-lady-b", "moss-mat-a"], r2), 1 + 0.6 * frac(r2 * 5));
    roll -= 0.1 * forest;
    const wet = w.wetland + w.river_lake;
    if (wet > 0.3 && roll < 0.1 * wet) return at("plant", r2 < 0.75 ? variant("sedge", r2 * 3) : pick(["flower-iris-a", "flower-iris-b"], frac(r2 * 3)), 1 + 0.5 * frac(r2 * 5));
    roll -= 0.1 * wet;
    const meadow = (w.grassland + w.mountains * (s.height < 48 ? 1 : 0) + w.polar * 0.3) * (fbm(x * 0.09 + 31, z * 0.09 - 7) > 0.52 ? 1 : 0.15);
    if (roll < 0.05 * meadow) {
        const alpine = w.mountains > 0.4;
        const list = alpine ? ["flower-lupine-a", "flower-lupine-b", "flower-bluebell-a", "flower-buttercup-a", "flower-daisy-a"] : s.temperature > 0.75 ? ["flower-black-eyed-susan-a", "flower-coneflower-a", "flower-cosmos-a", "flower-poppy-a", "flower-poppy-b"] : ["flower-daisy-a", "flower-daisy-b", "flower-buttercup-b", "flower-cornflower-a", "flower-wild-rose-a", "flower-foxglove-a"];
        return at("plant", pick(list, r2), 1 + 0.4 * frac(r2 * 5));
    }
    roll -= 0.05 * meadow;
    const grassy = w.grassland * 0.34 + w.desert * 0.06 + w.mountains * 0.12 * (s.height < 46 ? 1 : 0) + w.seashore * 0.06 + w.wetland * 0.12 + w.river_lake * 0.1 + w.polar * 0.05 + forest * 0.03;
    if (roll < grassy) {
        const dry = w.desert + w.grassland * Math.max(0, 1 - s.moisture * 1.6);
        const id = dry > 0.45 ? variant("grass-dry", r2) : w.seashore > 0.4 || w.polar > 0.3 ? variant("grass-broad", r2) : variant("grass-meadow", r2);
        return at("grass", id, 1 + 0.6 * frac(r2 * 5));
    }
    return null;
}

const GROUND_GRID = 2.2;

let items: WildItem[] | null = null;
let byChunk: WildItem[][] | null = null;

/** The runtime's prebuild (`runtime/prebuild.ts`, v2): the same list, made in the scenery worker before the mount. */
export function primeWildScenery(list: WildItem[]): void {
    items = list;
    byChunk = null;
}

/** The island's whole scenery, in a fixed order (by kind, then by grid cell). */
export function wildScenery(): WildItem[] {
    if (items) return items;
    const out: WildItem[] = [];
    // Trees.
    const n = Math.floor(WILD_HALF / TREE_GRID);
    for (let j = -n; j <= n; j++) {
        for (let i = -n; i <= n; i++) {
            const c = treeAt(i, j);
            if (c.item && treeStands(i, j)) out.push(c.item);
        }
    }
    // The understorey, clear of the canopy's trunks by a few metres.
    const canopy = new Map<string, WildItem[]>();
    for (const t of out) {
        const key = `${Math.floor(t.x / 8)},${Math.floor(t.z / 8)}`;
        canopy.set(key, [...(canopy.get(key) ?? []), t]);
    }
    const u = Math.floor(WILD_HALF / UNDER_GRID);
    for (let j = -u; j <= u; j++) {
        for (let i = -u; i <= u; i++) {
            const t = understorey(i, j);
            if (!t) continue;
            const cx = Math.floor(t.x / 8);
            const cz = Math.floor(t.z / 8);
            let clear = true;
            for (let dx = -1; dx <= 1 && clear; dx++) for (let dz = -1; dz <= 1 && clear; dz++) for (const o of canopy.get(`${cx + dx},${cz + dz}`) ?? []) if (Math.hypot(o.x - t.x, o.z - t.z) < o.solid + t.solid + 3.5) clear = false;
            if (clear) out.push(t);
        }
    }
    const trunks = new Map<string, WildItem[]>();
    for (const t of out) {
        const key = `${Math.floor(t.x / 8)},${Math.floor(t.z / 8)}`;
        trunks.set(key, [...(trunks.get(key) ?? []), t]);
    }
    const nearTrunk = (x: number, z: number, r: number) => {
        const cx = Math.floor(x / 8);
        const cz = Math.floor(z / 8);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const t of trunks.get(`${cx + dx},${cz + dz}`) ?? []) if (Math.hypot(t.x - x, t.z - z) < t.solid + r) return true;
        return false;
    };
    // Ground items on a jittered 2.2 m grid.
    const g = Math.floor(WILD_HALF / GROUND_GRID);
    for (let j = -g; j <= g; j++) {
        for (let i = -g; i <= g; i++) {
            const h = hashString(`g${i},${j}`);
            const x = i * GROUND_GRID + ((h & 0xffff) / 0xffff - 0.5) * GROUND_GRID * 0.9;
            const z = j * GROUND_GRID + (((h >>> 16) & 0xffff) / 0xffff - 0.5) * GROUND_GRID * 0.9;
            if (Math.abs(x) > WILD_HALF - 1 || Math.abs(z) > WILD_HALF - 1) continue;
            const s = sampleWildGround(x, z);
            if (s.height < -14 || (s.height < 0 && s.inland < -70)) continue;
            const slope = s.height > 0.2 ? gridSlope(x, z) : 0;
            if (slope > 1.4) continue;
            const item = groundItem(x, z, s, unit(x, z, 21), unit(x, z, 22), slope);
            if (!item) continue;
            if (item.kind === "rock" && item.solid > 0 && (inRange(x, z, item.solid + 0.5) || nearTrunk(x, z, item.solid + 0.4))) continue;
            if (item.kind === "kelp" && nearWhale(x, z)) continue;
            if ((item.kind === "shrub" || item.kind === "log") && (inRange(x, z, 1) || nearTrunk(x, z, 0.8))) continue;
            if (item.kind === "plant" || item.kind === "grass" || item.kind === "shrub") item.y -= 0.03;
            if ((item.kind === "rock" || item.kind === "log") && item.asset) {
                // Sat into its slope: leaning halfway to the ground's normal, sunk by its lean over its half-width and a
                // fifth of its height, so no side stands off the ground.
                const e = 1.5;
                const gx = (gridHeight(x + e, z) - gridHeight(x - e, z)) / (2 * e);
                const gz = (gridHeight(x, z + e) - gridHeight(x, z - e)) / (2 * e);
                const n = [-gx, 1, -gz];
                const l = Math.hypot(n[0], n[1], n[2]);
                const up: [number, number, number] = [(n[0] / l) * 0.5, 0.5 + (n[1] / l) * 0.5, (n[2] / l) * 0.5];
                const ul = Math.hypot(...up);
                item.up = [up[0] / ul, up[1] / ul, up[2] / ul];
                const half = 1.5 * item.scale;
                item.y -= Math.min(slope, 1.2) * half * 0.55 + item.height * 0.18;
            }
            out.push({...item, chunk: wildChunkOf(x, z), shade: 0.88 + 0.24 * unit(x, z, 23)});
        }
    }
    // The cove's floes: flat slabs of ice on its open water.
    for (let k = 0; k < 14; k++) {
        const a = unit(k, 3, 31) * Math.PI * 2;
        const r = 0.25 + 0.7 * unit(k, 4, 32);
        const x = COVE.x + Math.cos(a) * COVE.rx * r;
        const z = Math.min(COVE.z + Math.sin(a) * COVE.rz * r, ICE_FRONT_Z - 4);
        const s = sampleWildGround(x, z);
        if (s.height > -1.2 || coveDistance(x, z) > 1.1) continue;
        out.push({kind: "floe", asset: null, x, y: 0.12, z, yaw: unit(k, 5, 33) * Math.PI * 2, scale: 2 + 3 * unit(k, 6, 34), height: 0.3, solid: 0, crown: 0, chunk: wildChunkOf(x, z), shade: 1});
    }
    // Termite mounds on the savanna, a few in the desert's edge.
    let mounds = 0;
    for (let k = 0; k < 4000 && mounds < 18; k++) {
        const x = (unit(k, 7, 41) * 2 - 1) * WILD_HALF;
        const z = (unit(k, 8, 42) * 2 - 1) * WILD_HALF;
        const s = sampleWildGround(x, z);
        if (s.weights.grassland + s.weights.desert * 0.5 < 0.6 || s.height < 0.6 || s.inland < 10 || gridSlope(x, z) > 0.2 || inRange(x, z, 2) || nearTrunk(x, z, 2)) continue;
        if (out.some((it) => it.kind === "mound" && Math.hypot(it.x - x, it.z - z) < 14)) continue;
        out.push({kind: "mound", asset: null, x, y: s.height - 0.1, z, yaw: unit(k, 9, 43) * 6.28, scale: 0.7 + 0.8 * unit(k, 10, 44), height: 2, solid: 0.6, crown: 0, chunk: wildChunkOf(x, z), shade: 1});
        mounds++;
    }
    // Cave mouths in the mountains' steep faces.
    let caves = 0;
    for (let k = 0; k < 6000 && caves < 5; k++) {
        const x = (unit(k, 11, 51) * 2 - 1) * WILD_HALF;
        const z = (unit(k, 12, 52) * 2 - 1) * WILD_HALF;
        const s = sampleWildGround(x, z);
        const slope = gridSlope(x, z);
        if (s.weights.mountains < 0.6 || s.height < 14 || s.height > 46 || slope < 0.55 || slope > 1.1) continue;
        if (out.some((it) => it.kind === "cave" && Math.hypot(it.x - x, it.z - z) < 40)) continue;
        // Facing down the slope.
        const e = 2;
        const gx = sampleWildGround(x + e, z).height - sampleWildGround(x - e, z).height;
        const gz = sampleWildGround(x, z + e).height - sampleWildGround(x, z - e).height;
        out.push({kind: "cave", asset: unit(k, 13, 53) < 0.5 ? "cave-mouth-a" : "cave-mouth-b", x, y: s.height - 0.6, z, yaw: Math.atan2(-gx, -gz), scale: 1.3, height: 6, solid: 2.5, crown: 0, chunk: wildChunkOf(x, z), shade: 1});
        caves++;
    }
    items = out;
    return out;
}

/** The scenery by Part B chunk. */
export function sceneryByChunk(): WildItem[][] {
    if (byChunk) return byChunk;
    const out: WildItem[][] = Array.from({length: 100}, () => []);
    for (const item of wildScenery()) out[item.chunk].push(item);
    byChunk = out;
    return out;
}

/** Counts by kind (for the summary and the tests). */
export function sceneryCounts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const item of wildScenery()) out[item.kind] = (out[item.kind] ?? 0) + 1;
    return out;
}

/** What blocks a body at a point: a trunk, a rock, a mound, a cave's rock (spatial index). */
export class WildObstacles {
    private cells = new Map<string, WildItem[]>();
    constructor(list: readonly WildItem[] = wildScenery()) {
        for (const item of list) {
            if (item.solid <= 0) continue;
            const key = `${Math.floor(item.x / 6)},${Math.floor(item.z / 6)}`;
            const at = this.cells.get(key) ?? [];
            at.push(item);
            this.cells.set(key, at);
        }
    }
    blocked(x: number, z: number, radius: number): boolean {
        const cx = Math.floor(x / 6);
        const cz = Math.floor(z / 6);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const it of this.cells.get(`${cx + dx},${cz + dz}`) ?? []) if (Math.hypot(it.x - x, it.z - z) < it.solid + radius) return true;
        return false;
    }
    /** Something tall stands just south of the point (in front of it from the opening camera). */
    covers(x: number, z: number, list: readonly WildItem[] = wildScenery()): boolean {
        void list;
        const cx = Math.floor(x / 6);
        const cz = Math.floor((z + 2) / 6);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const it of this.cells.get(`${cx + dx},${cz + dz}`) ?? []) if (it.height > 1.2 && it.z > z && it.z - z < 3.5 && Math.abs(it.x - x) < 1.5 + it.solid) return true;
        return false;
    }
}
