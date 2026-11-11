/**
 * The Ark map's launch spawn points (decision 6: about 480, by primary
 * share, at least 8 an area) and the small animals' attach points, both
 * found on whatever terrain the sampler describes (`sampler.ts`): a grid
 * over the ground, each cell with the tags that hold there, and the
 * scenery's attach points with the tags they stand for. Deterministic: the
 * same terrain gives the same points on every device.
 *
 * Points of a tag are split by the zone they are in (a partition each), so
 * a zone's animals stand on their own zone's ground first (a rainforest
 * frog by the rainforest's stream); a zone with none of that tag borrows the
 * nearest zone's partition. Partitions never share a point.
 */

import {ARK_ZONES, type ArkZone} from "@/ark-scene/types";
import {attachFits, attachPointTags, type ArkMapSampler, type AttachPoint} from "@/ark-scene/map/sampler";
import {launchPoints} from "@/ark-scene/map/species";
import {MAP_TAGS, type MapTag} from "@/ark-scene/map/tags";
import {hashString, ZONE_SITES} from "@/ark-scene/world";

export type SpawnPoint = {tag: MapTag; zone: ArkZone; x: number; z: number; y: number; water: "sea" | "fresh" | null; depth: number; /** Half the distance to the nearest other point of its partition (m): room for its cluster. */ room: number};

type Cell = {x: number; z: number; zone: ArkZone; tags: readonly MapTag[]; wet: boolean; depth: number};

const GRID = 2;
/** No two launch points (of any tags) nearer than this (m). */
const CLEAR = 3;

export class MapPoints {
    readonly sampler: ArkMapSampler;
    private cells: Cell[] | null = null;
    private byTag = new Map<string, Map<ArkZone, SpawnPoint[]>>();
    private cellsByTag = new Map<string, Cell[]>();
    private attachTags = new Map<AttachPoint, MapTag[]>();
    private attachLists = new Map<string, {list: AttachPoint[]; own: boolean}>();
    private sortedLists = new Map<SpawnPoint[], SpawnPoint[]>();
    private satelliteLists = new Map<string, Array<{x: number; z: number}>>();
    private launched = false;
    private overflowLists = new Map<string, Array<{x: number; z: number}>>();
    /** Every launch point, in the order made. */
    private launchList: SpawnPoint[] = [];

    constructor(sampler: ArkMapSampler) {
        this.sampler = sampler;
    }

    /** The ground on a grid: each cell's zone and tags. */
    private grid(): Cell[] {
        if (this.cells) return this.cells;
        const cells: Cell[] = [];
        const half = this.sampler.half;
        for (let x = -half; x <= half; x += GRID) {
            for (let z = -half; z <= half; z += GRID) {
                const ground = this.sampler.ground(x, z);
                // Never inside a trunk, a rock or a building.
                if (ground.water === null && this.sampler.blocked(x, z, 0.5)) continue;
                if (ground.tags.length) cells.push({x, z, zone: ground.zone, tags: ground.tags, wet: ground.water !== null, depth: ground.depth});
            }
        }
        this.cells = cells;
        return cells;
    }

    /** The grid's cells with this tag, in the water or on dry ground. */
    cellsWith(tag: MapTag, wet: boolean): Cell[] {
        const key = `${tag}${wet ? "~w" : ""}`;
        let list = this.cellsByTag.get(key);
        if (!list) {
            // In the water: deep enough to swim in (half a metre).
            list = this.grid().filter((cell) => cell.wet === wet && cell.tags.includes(tag) && (!wet || cell.depth >= 0.5));
            this.cellsByTag.set(key, list);
        }
        return list;
    }

    /**
     * A tag's launch points, in the water (`wet`: swimmers, floaters, the sea
     * floor's) or on dry ground (everyone else), by zone; made the first time
     * they are asked for. The counts are the generator's (`species.json`
     * `points`: zone, or `zone~w` for the water's).
     */
    partitions(tag: MapTag, wet: boolean): Map<ArkZone, SpawnPoint[]> {
        this.launch();
        const memo = `${tag}${wet ? "~w" : ""}`;
        const known = this.byTag.get(memo);
        if (known) return known;
        // A tag nobody spawns at (a roost, a fallback): a few points anyway, clear of the launch points, so a lookup never comes back empty-handed.
        const out = this.make(tag, wet, [["farm_garden", 3]]);
        this.byTag.set(memo, out);
        return out;
    }

    /**
     * Every launch point, made at once in a fixed order (the tags' order,
     * dry then wet), each clear of all the others (no two tags' points on one
     * spot), so the points never depend on which animals asked first.
     */
    private launch(): void {
        if (this.launched) return;
        this.launched = true;
        for (const tag of MAP_TAGS) {
            for (const wet of [false, true]) {
                const want: Array<[ArkZone, number]> = [];
                for (const [key, count] of Object.entries(launchPoints()[tag] ?? {})) {
                    if (key.endsWith("~w") === wet) want.push([key.replace("~w", "") as ArkZone, count]);
                }
                if (!want.length) continue;
                const out = this.make(tag, wet, want);
                this.byTag.set(`${tag}${wet ? "~w" : ""}`, out);
                for (const list of Array.from(out.values())) this.launchList.push(...list);
            }
        }
    }

    /** A tag's points for each zone's count: spread over its cells (the zone's own first), clear of every launch point made before. */
    private make(tag: MapTag, wet: boolean, want: Array<[ArkZone, number]>): Map<ArkZone, SpawnPoint[]> {
        const clear = (cell: Cell) => this.launchList.every((point) => Math.hypot(point.x - cell.x, point.z - cell.z) >= CLEAR);
        const candidates = this.cellsWith(tag, wet).filter(clear);
        const taken = new Set<Cell>();
        const out = new Map<ArkZone, SpawnPoint[]>();
        for (const [zone, count] of want.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
            let pool = candidates.filter((cell) => cell.zone === zone && !taken.has(cell));
            if (!pool.length) pool = candidates.filter((cell) => !taken.has(cell));
            for (const cell of spread(pool, count)) {
                taken.add(cell);
                const ground = this.sampler.ground(cell.x, cell.z);
                // The point is its zone's (the zone it was given to), wherever on the island the terrain had the tag.
                const point: SpawnPoint = {tag, zone, x: cell.x, z: cell.z, y: ground.height, water: ground.water, depth: ground.depth, room: 0};
                const list = out.get(zone) ?? [];
                list.push(point);
                out.set(zone, list);
            }
        }
        for (const list of Array.from(out.values())) {
            for (const point of list) {
                let nearest = Infinity;
                for (const other of list) if (other !== point) nearest = Math.min(nearest, Math.hypot(other.x - point.x, other.z - point.z));
                point.room = Number.isFinite(nearest) ? Math.min(nearest / 2, 8) : 6;
            }
        }
        return out;
    }

    /**
     * The partition a zone's animal of this tag uses: its own zone's (`own`:
     * no other zone's animal stands on it, so its slot alone picks the point),
     * else the nearest zone's that has some.
     */
    partitionFor(tag: MapTag, wet: boolean, zone: ArkZone): SpawnPoint[] {
        return this.partitionOf(tag, wet, zone).list;
    }

    partitionOf(tag: MapTag, wet: boolean, zone: ArkZone): {list: SpawnPoint[]; own: boolean} {
        const partitions = this.partitions(tag, wet);
        const own = partitions.get(zone);
        if (own?.length) return {list: own, own: true};
        const site = ZONE_SITES[zone] ?? ZONE_SITES.farm_garden;
        let best: SpawnPoint[] = [];
        let distance = Infinity;
        for (const [other, list] of Array.from(partitions.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
            const s = ZONE_SITES[other];
            const d = Math.hypot(s.x - site.x, s.z - site.z);
            if (list.length && d < distance) {
                distance = d;
                best = list;
            }
        }
        return {list: best, own: false};
    }

    /**
     * A partition's points for a kind of slot (the stats, `placement.ts`
     * slotKind): `core` its three nearest its middle, `edge` its outer
     * quarter, `plain` the rest; one list each, never sharing a point. A
     * small partition is all plain.
     */
    kindOf(list: SpawnPoint[], kind: "core" | "edge" | "cover" | "plain"): SpawnPoint[] {
        if (list.length < 12) return list;
        let sorted = this.sortedLists.get(list);
        if (!sorted) {
            const cx = list.reduce((sum, p) => sum + p.x, 0) / list.length;
            const cz = list.reduce((sum, p) => sum + p.z, 0) / list.length;
            sorted = [...list].sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz) || a.x - b.x || a.z - b.z);
            this.sortedLists.set(list, sorted);
        }
        const edgeCount = Math.floor(sorted.length / 4);
        if (kind === "core") return sorted.slice(0, 3);
        if (kind === "plain") return sorted.slice(3, sorted.length - edgeCount);
        // The edge, split: the points with something tall in front of them from the default camera are the cover's.
        const edge = sorted.slice(sorted.length - edgeCount);
        const covered = edge.filter((point) => point.water === null && Boolean(this.sampler.covered?.(point.x, point.z)));
        if (kind === "cover" && covered.length) return covered;
        const open = edge.filter((point) => !covered.includes(point));
        return open.length ? open : edge;
    }

    /** Every launch point (for the report, the contact sheets and the tests). */
    all(): SpawnPoint[] {
        this.launch();
        const out: SpawnPoint[] = [];
        for (const tag of MAP_TAGS) {
            const counts = launchPoints()[tag];
            if (!counts) continue;
            const keys = Object.keys(counts);
            if (keys.some((key) => !key.endsWith("~w"))) out.push(...Array.from(this.partitions(tag, false).values()).flat());
            if (keys.some((key) => key.endsWith("~w"))) out.push(...Array.from(this.partitions(tag, true).values()).flat());
        }
        return out;
    }

    /**
     * Where further clusters on a point stand (more clusters than points):
     * the cells of its tag and medium nearest it (of those nearer it than
     * any other launch point of the tag), each at least `spacing` from the
     * point and from one another (greedy, nearest first), so the
     * L-th cluster round a point always has a spot of its own on its own
     * ground. A function of the terrain alone.
     */
    satellites(point: SpawnPoint, wet: boolean, spacing: number, owned = true): Array<{x: number; z: number}> {
        const key = `${point.tag}|${wet}|${point.x},${point.z}|${spacing}|${owned}`;
        let list = this.satelliteLists.get(key);
        if (!list) {
            // Only the cells nearer this point than any other launch point of its tag (so two points' satellites never meet).
            // (Every launch point, of every tag, and this tag's own: a cell is one point's at most.)
            const others = [...this.launchList, ...Array.from(this.partitions(point.tag, wet).values()).flat()].filter((other) => other !== point);
            const mine = (cell: Cell) => {
                const d = Math.hypot(cell.x - point.x, cell.z - point.z);
                return others.every((other) => Math.hypot(cell.x - other.x, cell.z - other.z) > d);
            };
            const cells = this.cellsWith(point.tag, wet).map((cell) => ({cell, d: Math.hypot(cell.x - point.x, cell.z - point.z)})).filter(({cell, d}) => d >= spacing && (!owned || mine(cell))).sort((a, b) => a.d - b.d || a.cell.x - b.cell.x || a.cell.z - b.cell.z);
            list = [];
            for (const {cell} of cells) {
                if (list.length >= 80) break;
                if (list.every((other) => Math.hypot(other.x - cell.x, other.z - cell.z) >= spacing)) list.push({x: cell.x, z: cell.z});
            }
            this.satelliteLists.set(key, list);
        }
        return list;
    }

    /**
     * When every tag of a species is full: one list per tag, medium and zone
     * of the tag's cells nearest the zone's own points (or the island's
     * middle), 2.6 m apart and clear of every launch point. A zone's slot
     * picks its cell, so a zone's overflow never doubles up.
     */
    overflow(tag: MapTag, wet: boolean, zone: ArkZone): Array<{x: number; z: number}> {
        const key = `${tag}|${wet}|${zone}`;
        let list = this.overflowLists.get(key);
        if (!list) {
            this.launch();
            const own = this.partitionFor(tag, wet, zone);
            const cx = own.length ? own.reduce((sum, p) => sum + p.x, 0) / own.length : 0;
            const cz = own.length ? own.reduce((sum, p) => sum + p.z, 0) / own.length : 0;
            // Each cell is one tag's overflow only (picked from its tags by the cell alone) and, where the zone has enough, one zone's.
            const mine = (cell: Cell) => {
                const tags = cell.tags.filter((t) => launchPoints()[t]);
                return tags.length > 0 && tags[hashString(`${cell.x},${cell.z}`) % tags.length] === tag;
            };
            const free = this.cellsWith(tag, wet).filter((cell) => mine(cell) && this.launchList.every((point) => Math.hypot(point.x - cell.x, point.z - cell.z) >= 2.6));
            const territory = free.filter((cell) => cell.zone === zone);
            const cells = (territory.length >= 20 ? territory : free).map((cell) => ({cell, d: Math.hypot(cell.x - cx, cell.z - cz)})).sort((a, b) => a.d - b.d || a.cell.x - b.cell.x || a.cell.z - b.cell.z);
            list = [];
            for (const {cell} of cells) {
                if (list.length >= 400) break;
                if (list.every((other) => Math.hypot(other.x - cell.x, other.z - cell.z) >= 2.6)) list.push({x: cell.x, z: cell.z});
            }
            this.overflowLists.set(key, list);
        }
        return list;
    }

    /** The nearest cell of a tag to a point, within `reach` (for roosts); null when none is that near. */
    nearest(tag: MapTag, wet: boolean, x: number, z: number, reach: number): {x: number; z: number} | null {
        let best: Cell | null = null;
        let distance = reach;
        for (const cell of this.cellsWith(tag, wet)) {
            const d = Math.hypot(cell.x - x, cell.z - z);
            if (d < distance) {
                distance = d;
                best = cell;
            }
        }
        return best ? {x: best.x, z: best.z} : null;
    }

    /** The map tags an attach point stands for (its own and its ground's). */
    tagsOf(point: AttachPoint): MapTag[] {
        let tags = this.attachTags.get(point);
        if (!tags) {
            tags = attachPointTags(point, this.sampler.ground(point.x, point.z).tags);
            this.attachTags.set(point, tags);
        }
        return tags;
    }

    /**
     * The attach points a small animal can sit on: of its tag, fitting its
     * length, in its zone first (else any zone's). Empty when the scenery has none.
     */
    attachFor(tag: MapTag, length: number, zone: ArkZone, holes = true): AttachPoint[] {
        return this.attachOf(tag, length, zone, holes).list;
    }

    /** As `attachFor`, and whether the list is the zone's own (then its slot alone picks the point). */
    attachOf(tag: MapTag, length: number, zone: ArkZone, holes = true): {list: AttachPoint[]; own: boolean} {
        const key = `${tag}|${length.toFixed(3)}|${zone}|${holes}`;
        let found = this.attachLists.get(key);
        if (!found) {
            const fitting = this.sampler.attachPoints().filter((point) => (holes || (point.tag !== "worm_hole" && point.tag !== "burrow_entrance")) && attachFits(point, length) && this.tagsOf(point).includes(tag));
            const own = fitting.filter((point) => point.zone === zone);
            found = own.length ? {list: own, own: true} : {list: fitting, own: false};
            this.attachLists.set(key, found);
        }
        return found;
    }
}

/** `count` cells spread out over the pool: farthest-point sampling from the cell nearest its middle. */
function spread(pool: Cell[], count: number): Cell[] {
    if (!pool.length || count <= 0) return [];
    const cx = pool.reduce((sum, cell) => sum + cell.x, 0) / pool.length;
    const cz = pool.reduce((sum, cell) => sum + cell.z, 0) / pool.length;
    let first = pool[0];
    for (const cell of pool) if (Math.hypot(cell.x - cx, cell.z - cz) < Math.hypot(first.x - cx, first.z - cz)) first = cell;
    const chosen = [first];
    const distance = pool.map((cell) => Math.hypot(cell.x - first.x, cell.z - first.z));
    while (chosen.length < Math.min(count, pool.length)) {
        let best = -1;
        for (let i = 0; i < pool.length; i++) if (best < 0 || distance[i] > distance[best]) best = i;
        if (distance[best] <= 0) break;
        const next = pool[best];
        chosen.push(next);
        for (let i = 0; i < pool.length; i++) distance[i] = Math.min(distance[i], Math.hypot(pool[i].x - next.x, pool[i].z - next.z));
    }
    return chosen;
}

/**
 * Where cluster `key` of a list of `size` stands: an index into the list and
 * a level (how many clusters already round that point). On a zone's own
 * partition the key is its slot (dense from 0), else a key no own slot ever
 * is; the map is one-to-one, so no two clusters take the same (point,
 * level), and consecutive slots go round every point before any doubles up.
 */
export function pointIndex(key: number, size: number): {index: number; level: number} {
    const usable = Math.max(size, 1);
    let P = Math.max(1, Math.round(usable * 0.618));
    while (gcd(P, usable) !== 1) P++;
    return {index: (key * P) % usable, level: Math.floor(key / usable)};
}

function gcd(a: number, b: number): number {
    return b ? gcd(b, a % b) : a;
}

/** The cluster key of a zone's slot: unique over every zone and slot. */
export function clusterKey(zone: ArkZone, slot: number): number {
    return Math.max(ARK_ZONES.indexOf(zone), 0) + ARK_ZONES.length * slot;
}

/** The key on a borrowed partition (another zone's): past any slot its own zone will use, distinct per zone. */
export function borrowedKey(zone: ArkZone, slot: number): number {
    return 100000 * (Math.max(ARK_ZONES.indexOf(zone), 0) + 1) + slot;
}
