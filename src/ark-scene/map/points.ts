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
import {ZONE_SITES} from "@/ark-scene/world";

export type SpawnPoint = {tag: MapTag; zone: ArkZone; x: number; z: number; y: number; water: "sea" | "fresh" | null; depth: number; /** Half the distance to the nearest other point of its partition (m): room for its cluster. */ room: number};

type Cell = {x: number; z: number; zone: ArkZone; tags: readonly MapTag[]; wet: boolean};

const GRID = 2;

export class MapPoints {
    readonly sampler: ArkMapSampler;
    private cells: Cell[] | null = null;
    private byTag = new Map<string, Map<ArkZone, SpawnPoint[]>>();
    private cellsByTag = new Map<string, Cell[]>();
    private attachTags = new Map<AttachPoint, MapTag[]>();
    private attachLists = new Map<string, AttachPoint[]>();

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
                if (ground.tags.length) cells.push({x, z, zone: ground.zone, tags: ground.tags, wet: ground.water !== null});
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
            list = this.grid().filter((cell) => cell.wet === wet && cell.tags.includes(tag));
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
        const memo = `${tag}${wet ? "~w" : ""}`;
        const known = this.byTag.get(memo);
        if (known) return known;
        const want: Array<[ArkZone, number]> = [];
        for (const [key, count] of Object.entries(launchPoints()[tag] ?? {})) {
            const water = key.endsWith("~w");
            if (water === wet) want.push([key.replace("~w", "") as ArkZone, count]);
        }
        const candidates = this.cellsWith(tag, wet);
        const taken = new Set<Cell>();
        const out = new Map<ArkZone, SpawnPoint[]>();
        const zones = want.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        // A tag nobody spawns at (a roost, a fallback): a few points anyway, so a lookup never comes back empty-handed.
        if (!zones.length) zones.push(["farm_garden", 3]);
        for (const [zone, count] of zones) {
            let pool = candidates.filter((cell) => cell.zone === zone && !taken.has(cell));
            if (!pool.length) pool = candidates.filter((cell) => !taken.has(cell));
            for (const cell of spread(pool, count)) {
                taken.add(cell);
                const ground = this.sampler.ground(cell.x, cell.z);
                const point: SpawnPoint = {tag, zone: cell.zone, x: cell.x, z: cell.z, y: ground.height, water: ground.water, depth: ground.depth, room: 0};
                const list = out.get(cell.zone) ?? [];
                list.push(point);
                out.set(cell.zone, list);
            }
        }
        for (const list of Array.from(out.values())) {
            for (const point of list) {
                let nearest = Infinity;
                for (const other of list) if (other !== point) nearest = Math.min(nearest, Math.hypot(other.x - point.x, other.z - point.z));
                point.room = Number.isFinite(nearest) ? Math.min(nearest / 2, 8) : 6;
            }
        }
        this.byTag.set(memo, out);
        return out;
    }

    /** The partition a zone's animal of this tag uses: its own zone's, else the nearest zone's that has some. */
    partitionFor(tag: MapTag, wet: boolean, zone: ArkZone): SpawnPoint[] {
        const partitions = this.partitions(tag, wet);
        const own = partitions.get(zone);
        if (own?.length) return own;
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
        return best;
    }

    /** Every launch point (for the report, the contact sheets and the tests). */
    all(): SpawnPoint[] {
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
    attachFor(tag: MapTag, length: number, zone: ArkZone): AttachPoint[] {
        const key = `${tag}|${length.toFixed(3)}|${zone}`;
        let list = this.attachLists.get(key);
        if (!list) {
            const fitting = this.sampler.attachPoints().filter((point) => attachFits(point, length) && this.tagsOf(point).includes(tag));
            const own = fitting.filter((point) => point.zone === zone);
            list = own.length ? own : fitting;
            this.attachLists.set(key, list);
        }
        return list;
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
 * a level (how many clusters already round that point). Keys are unique per
 * cluster (zone and slot), and this map is one-to-one, so no two clusters
 * ever take the same (point, level). A size coprime with 6 is used so one
 * zone's slots go round every point before any doubles up.
 */
export function pointIndex(key: number, size: number): {index: number; level: number} {
    let usable = Math.max(size, 1);
    while (usable > 1 && (usable % 2 === 0 || usable % 3 === 0)) usable--;
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
