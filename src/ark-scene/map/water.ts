/**
 * Where a water species lives on the map (the owner's rule, 2026-11-11):
 * by its depth band (`sea-depth.ts`, `depth-bands.json`), never by a land
 * map tag. A shore seal's "rocks", a turtle's "beach" or a frog's "stones"
 * in its text say where it hauls out, not where it is placed.
 *
 * - Fresh water (the pond bands): the lake, as sea-depth places it
 *   (`waterHomeSpot`: the lake's open water, shared by every zone).
 * - The sea off a coast (a coast species, or a sea species of a land or
 *   shore zone): the sea off its zone's coast, as sea-depth places it.
 * - A sea zone's own species (the reef's, the open ocean's): a cell of its
 *   band's water in its zone, on this terrain (`ArkMapSampler`):
 *   - reef: the coral reef (the reef, the anemone, the cleaning station);
 *   - seabed: the sea floor under 7.5 m (the shallows, the seabed, the
 *     seagrass, the kelp);
 *   - deep: the deep water (7.5 m and more);
 *   - surface, upper, mid: the open water over it, its cells shared out
 *     between the three (and the deep) on a fixed pattern, so the bands
 *     never share a cell.
 *
 * Every cell is at least 1.2 m deep, so a loop about it stays in water.
 * Deterministic: a function of the terrain, the zone, the slot and the rank.
 */

import {reefLandmarks} from "@/ark-scene/reef";
import {inRock} from "@/ark-scene/map/rocks";
import {inHomeWater, waterHomeSpot, waterMotion, type DepthBand, type SpeciesDepth} from "@/ark-scene/sea-depth";
import type {ArkMapSampler} from "@/ark-scene/map/sampler";
import type {MapTag} from "@/ark-scene/map/tags";
import {ARK_ZONES, type ArkZone} from "@/ark-scene/types";
import {hashString, ZONE_SITES} from "@/ark-scene/world";

/** A band's water class on the map: the band, or for the pond bands the lake. */
export type WaterClass = "reef" | "seabed" | "deep" | "surface" | "upper" | "mid" | "lake" | "coast";

/** The map tags a band stands for, in the order a spot's tag is named by. */
export const BAND_TAGS: Record<WaterClass, readonly MapTag[]> = {
    reef: ["coral_reef", "anemone", "cleaner_station", "seagrass", "seabed", "coastal_shallows"],
    seabed: ["seabed", "coastal_shallows", "seagrass", "kelp", "coral_reef", "mudflat", "estuary"],
    deep: ["deep_water", "open_ocean", "sea_surface", "seabed"],
    surface: ["sea_surface", "open_ocean", "coastal_shallows", "seabed"],
    upper: ["open_ocean", "sea_surface", "kelp", "coastal_shallows", "seabed"],
    mid: ["open_ocean", "sea_surface", "kelp", "coastal_shallows", "seabed"],
    lake: ["lake", "pond"],
    coast: ["coastal_shallows", "seabed", "kelp", "seagrass", "coral_reef", "sea_surface", "open_ocean", "deep_water"]
};

/**
 * Room for the giants (true scale, motion pass §3; decision 35): a swimmer drawn this long or longer (a whale, a whale
 * shark) has its home in the deepest open water, on cells reserved for it, at least `BIG_SWIMMER_APART` apart; every
 * other sea cell within `BIG_SWIMMER_CLEAR` of a reserved one is left out of the other swimmers' lists. Static (the
 * terrain alone), so nobody moves when a whale arrives or leaves.
 */
export const BIG_SWIMMER = 6;
const BIG_SWIMMER_APART = 30;
const BIG_SWIMMER_CLEAR = 14;
const BIG_SWIMMER_DEPTH = 9;
const BIG_SWIMMER_CELLS = 4;
const OPEN_CLASSES: ReadonlySet<WaterClass> = new Set(["deep", "surface", "upper", "mid"]);

/** The least water (m) a cell of the sea needs for a swimmer's loop about it. */
export const WATER_MIN_DEPTH = 1.2;
const GRID = 2.5;
const LAPS: Array<[number, number]> = [[0, 0], [1.25, 0], [0, 1.25], [1.25, 1.25], [0.62, 0.62], [1.87, 0.62], [0.62, 1.87], [1.87, 1.87]];

/** The class a band's species is placed by (`home` from sea-depth: the zone's own water, the lake, or the sea off a coast). */
export function waterClassOf(depth: SpeciesDepth, zone: ArkZone): WaterClass {
    if (depth.water === "fresh") return "lake";
    if (depth.home === "coast" || ZONE_SITES[zone]?.kind !== "sea") return "coast";
    return depth.band as Exclude<DepthBand, "pond_surface" | "pond_mid" | "pond_bed">;
}

type Cell = {x: number; z: number; depth: number; zone: ArkZone};

/** The sea cell's class: reef cells first, then the floor under 7.5 m, then the open water's fixed pattern. */
function classOf(tags: readonly MapTag[], depth: number, i: number, j: number): WaterClass | null {
    if (depth < WATER_MIN_DEPTH) return null;
    if (depth <= 8 && (tags.includes("coral_reef") || tags.includes("anemone") || tags.includes("cleaner_station"))) return "reef";
    if (depth < 7.5 && tags.some((tag) => tag === "seabed" || tag === "coastal_shallows" || tag === "seagrass" || tag === "kelp")) return "seabed";
    // The open water: only the ring round the island the camera sees (its tags), never the empty sea past it.
    if (depth < 3 || !tags.some((tag) => tag === "open_ocean" || tag === "sea_surface")) return null;
    if (depth < 7.5) return (["upper", "mid", "surface"] as const)[(((i + 2 * j) % 3) + 3) % 3];
    const k = (((i + 2 * j) % 4) + 4) % 4;
    if (k === 0 && tags.includes("deep_water")) return "deep";
    return (["upper", "upper", "mid", "surface"] as const)[k];
}

/** Does this spot's water suit the class (the validator's check, and the members' around their cluster's spot)? */
export function waterSuits(sampler: ArkMapSampler, cls: WaterClass, x: number, z: number): boolean {
    if (cls === "lake") return inHomeWater("lake", x, z) && sampler.ground(x, z).water === "fresh";
    const g = sampler.ground(x, z);
    if (g.water !== "sea") return false;
    if (cls === "coast") return inHomeWater("coast", x, z);
    if (g.depth < WATER_MIN_DEPTH) return false;
    switch (cls) {
        case "reef": return g.depth <= 8 && g.tags.some((tag) => tag === "coral_reef" || tag === "anemone" || tag === "cleaner_station" || tag === "seagrass");
        case "seabed": return g.depth < 10;
        case "deep": return g.depth >= 7.5 && g.tags.includes("deep_water");
        default: return g.depth >= 3 && g.tags.some((tag) => tag === "open_ocean" || tag === "sea_surface");
    }
}

/**
 * Inside the coral the reef lane draws on the floor (`reef.ts`
 * reefLandmarks: its big coral heads and the cleaning station's), with
 * `margin` round it: a floor-walker or a hole-dweller there would be drawn
 * inside the coral (the floor under it is the sand's).
 */
export function inCoral(x: number, z: number, margin: number): boolean {
    const marks = reefLandmarks();
    if (Math.hypot(x - marks.cleaning.x, z - marks.cleaning.z) < marks.cleaning.radius + margin) return true;
    return marks.heads.some((head) => Math.hypot(x - head.x, z - head.z) < head.radius + margin);
}

/** On the floor (a crab, a star, a flatfish; an octopus or a moray in its hole): it must stand clear of the coral. */
export function onFloor(depth: SpeciesDepth): boolean {
    const motion = waterMotion(depth);
    return motion === "walk" || motion === "hole";
}

/** The tag a spot stands for: the first of its class's tags that holds there. */
export function waterTagAt(sampler: ArkMapSampler, cls: WaterClass, x: number, z: number): MapTag | null {
    const tags = sampler.ground(x, z).tags;
    return BAND_TAGS[cls].find((tag) => tags.includes(tag)) ?? tags[0] ?? null;
}

/**
 * The cells of each sea class by zone, each list in the order its zone's
 * slots take them: nearest the zone's site first, spread out (a cell at
 * least 6 m from those before it, then 4 m, then any), made once per terrain.
 */
export class WaterCells {
    private lists = new Map<string, Cell[]>();
    private cells: Map<WaterClass, Cell[]> | null = null;
    private giants: Map<ArkZone, Cell[]> | null = null;

    constructor(readonly sampler: ArkMapSampler) {}

    private build(): Map<WaterClass, Cell[]> {
        if (this.cells) return this.cells;
        const out = new Map<WaterClass, Cell[]>();
        const half = this.sampler.half;
        for (let i = Math.ceil(-half / GRID); i * GRID <= half; i++) {
            for (let j = Math.ceil(-half / GRID); j * GRID <= half; j++) {
                const x = i * GRID;
                const z = j * GRID;
                const g = this.sampler.ground(x, z);
                if (g.water !== "sea") continue;
                const cls = classOf(g.tags, g.depth, i, j);
                if (!cls) continue;
                const list = out.get(cls) ?? [];
                list.push({x, z, depth: g.depth, zone: g.zone});
                out.set(cls, list);
            }
        }
        this.cells = out;
        return out;
    }

    /**
     * The cells reserved for big swimmers, by zone: the open water's cells at least `BIG_SWIMMER_DEPTH` deep, furthest from
     * the island's middle first, `BIG_SWIMMER_APART` apart, a few a zone.
     */
    giantCells(): Map<ArkZone, Cell[]> {
        if (this.giants) return this.giants;
        const out = new Map<ArkZone, Cell[]>();
        const open: Cell[] = [];
        this.build().forEach((cells, cls) => {
            if (OPEN_CLASSES.has(cls)) for (const cell of cells) if (cell.depth >= BIG_SWIMMER_DEPTH) open.push(cell);
        });
        open.sort((a, b) => Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z) || a.x - b.x || a.z - b.z);
        const all: Cell[] = [];
        for (const cell of open) {
            const list = out.get(cell.zone) ?? [];
            if (list.length >= BIG_SWIMMER_CELLS || all.some((other) => Math.hypot(other.x - cell.x, other.z - cell.z) < BIG_SWIMMER_APART)) continue;
            list.push(cell);
            all.push(cell);
            out.set(cell.zone, list);
        }
        this.giants = out;
        return out;
    }

    /** Within the clear water about a big swimmer's reserved cell. */
    private nearGiant(x: number, z: number): boolean {
        for (const list of this.giantCells().values()) for (const cell of list) if (Math.hypot(cell.x - x, cell.z - z) < BIG_SWIMMER_CLEAR) return true;
        return false;
    }

    /** A big swimmer's cells for its zone (else the nearest zone's that has some), in slot order. */
    giantListFor(zone: ArkZone): Cell[] {
        const giants = this.giantCells();
        const own = giants.get(zone);
        if (own?.length) return own;
        const site = ZONE_SITES[zone] ?? ZONE_SITES.farm_garden;
        let best: Cell[] = [];
        let distance = Infinity;
        giants.forEach((list, other) => {
            const d = Math.hypot(ZONE_SITES[other].x - site.x, ZONE_SITES[other].z - site.z);
            if (list.length && d < distance) {
                distance = d;
                best = list;
            }
        });
        return best;
    }

    /** A class's cells for a zone (its own; else, borrowed, the zone's whose site is nearest), in slot order. */
    listFor(cls: WaterClass, zone: ArkZone): {list: Cell[]; own: boolean} {
        const all = this.build().get(cls) ?? [];
        const own = all.some((cell) => cell.zone === zone);
        let from: ArkZone = zone;
        if (!own) {
            const site = ZONE_SITES[zone] ?? ZONE_SITES.farm_garden;
            let best = Infinity;
            for (const other of ARK_ZONES) {
                if (!all.some((cell) => cell.zone === other)) continue;
                const d = Math.hypot(ZONE_SITES[other].x - site.x, ZONE_SITES[other].z - site.z);
                if (d < best) {
                    best = d;
                    from = other;
                }
            }
        }
        const key = `${cls}|${from}`;
        let list = this.lists.get(key);
        if (!list) {
            // (Clear of the big swimmers' reserved water: decision 35.)
            const pool = all.filter((cell) => cell.zone === from && !this.nearGiant(cell.x, cell.z));
            const site = ZONE_SITES[from] ?? ZONE_SITES.farm_garden;
            const byNear = [...pool].sort((a, b) => Math.hypot(a.x - site.x, a.z - site.z) - Math.hypot(b.x - site.x, b.z - site.z) || a.x - b.x || a.z - b.z);
            list = [];
            const taken = new Set<Cell>();
            for (const gap of [6, 4, 0]) {
                for (const cell of byNear) {
                    if (taken.has(cell)) continue;
                    if (gap && list.some((other) => Math.hypot(other.x - cell.x, other.z - cell.z) < gap)) continue;
                    list.push(cell);
                    taken.add(cell);
                }
            }
            this.lists.set(key, list);
        }
        return {list, own};
    }
}

/**
 * A water species' spot: its cluster's (the zone and slot's) and its rank's
 * about it, at least 1.3 body lengths apart on a hexagonal lattice in its
 * class's water. Null only when the terrain has no water of its class.
 */
export function waterSpot(cells: WaterCells, depth: SpeciesDepth, zone: ArkZone, slot: number, rank: number, length: number): {x: number; z: number; cls: WaterClass} | null {
    const cls = waterClassOf(depth, zone);
    const sampler = cells.sampler;
    if (cls === "lake" || cls === "coast") {
        // Sea-depth's own homes (the lake's open water; the sea off its zone's coast).
        const spot = waterHomeSpot(depth, zone, slot, rank, length);
        return spot ? {x: spot.x, z: spot.z, cls} : null;
    }
    // A big swimmer (a whale): its zone's reserved deep water, the rest of the sea kept clear about it (decision 35).
    const giant = length >= BIG_SWIMMER && OPEN_CLASSES.has(cls) ? cells.giantListFor(zone) : [];
    const {list, own} = giant.length ? {list: giant, own: true} : cells.listFor(cls, zone);
    if (!list.length) {
        const spot = waterHomeSpot({...depth, home: "coast"}, zone, slot, rank, length);
        return spot ? {x: spot.x, z: spot.z, cls: "coast"} : null;
    }
    // Its own zone's slots from the list's start; a borrowed zone's from its end, half a cell over (never on an own one's spot).
    const n = list.length;
    const lap = Math.floor(slot / n);
    const cell = own ? list[slot % n] : list[n - 1 - ((slot * ARK_ZONES.length + Math.max(ARK_ZONES.indexOf(zone), 0)) % n)];
    const [ox, oz] = LAPS[(own ? lap : lap + 4) % LAPS.length];
    // A floor animal clear of the reef lane's coral heads (half its body round them).
    const floor = onFloor(depth);
    // (And clear of the drawn rocks at the shore: a crab or a star is never inside one.)
    const suits = (x: number, z: number) => waterSuits(sampler, cls, x, z) && !(floor && (inCoral(x, z, length / 2) || inRock(x, z, Math.max(length / 2, 0.05))));
    let cx = cell.x + ox;
    let cz = cell.z + oz;
    if (!suits(cx, cz)) {
        cx = cell.x;
        cz = cell.z;
        // Its cell's middle in coral too: the nearest clear spot round it (within 4 m).
        for (let k = 1; k < 60 && !suits(cx, cz); k++) {
            const r = 0.5 * Math.sqrt(k);
            const tx = cell.x + Math.cos(k * 2.39996) * r;
            const tz = cell.z + Math.sin(k * 2.39996) * r;
            if (suits(tx, tz)) {
                cx = tx;
                cz = tz;
            }
        }
    }
    if (rank <= 0) return {x: cx, z: cz, cls};
    // The cluster's others: the rank-th suitable cell of a hexagonal lattice about its spot, turned by the slot.
    const gap = Math.max(1.1, 1.3 * length);
    const turn = ((hashString(`${zone}#${slot}#water`) >>> 8) % 360) / 180 * Math.PI;
    let seen = 0;
    for (let ring = 1; ring <= 12; ring++) {
        let [i, j] = [-ring, ring];
        for (const [di, dj] of [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]) {
            for (let k = 0; k < ring; k++) {
                const lx = gap * (i + j / 2);
                const lz = gap * (j * Math.sqrt(3) / 2);
                const x = cx + lx * Math.cos(turn) - lz * Math.sin(turn);
                const z = cz + lx * Math.sin(turn) + lz * Math.cos(turn);
                if (suits(x, z) && ++seen === rank) return {x, z, cls};
                i += di;
                j += dj;
            }
        }
    }
    return {x: cx, z: cz, cls};
}
