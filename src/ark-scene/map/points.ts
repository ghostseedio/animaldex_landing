/**
 * The Ark map's spawn cells (B3/B4) on whatever terrain the sampler
 * describes (`sampler.ts`): a 2.5 m grid over the ground, each cell with the
 * tags that hold there, and the scenery's attach points with the tags they
 * stand for. Deterministic: the same terrain gives the same cells on every
 * device.
 *
 * - **One tag per cell.** A cell where several tags hold (grassland, soil,
 *   burrows, a flower meadow) belongs to one of them only, shared out by the
 *   launch points each tag needs in that zone (`species.json` `points`), so
 *   two tags' animals never stand on one cell.
 * - **Each zone's cells of a tag, in the order its slots take them:** the
 *   launch points first (decision 6: about 480, by primary share, spread over
 *   the tag's ground in the zone and at least 3 m from every other tag's),
 *   then the rest of the tag's cells, spread (6 m apart, then 4 m, then any).
 * - **The stats' kinds** (`placement.ts` slotKind): a dominant kind's slots
 *   at the cells nearest the partition's middle (`core`), a rare one's at its
 *   outer quarter (`edge`), behind something tall from the default camera
 *   when the cell has it (`cover`), everyone else between (`plain`).
 * - A zone with none of a tag's cells borrows the nearest zone's (its
 *   slots from the list's end, half a cell over, so never on an own one's).
 *
 * A cluster key (zone, slot) maps one-to-one onto (cell, lap): its own
 * zone's slot k takes cell k mod n, lap k div n (a lap is a fixed
 * half-cell offset), so no two clusters ever take one spot and nobody moves
 * when another arrives or leaves.
 */

import {ARK_ZONES, type ArkZone} from "@/ark-scene/types";
import {attachFits, attachPointTags, type ArkMapSampler, type AttachPoint} from "@/ark-scene/map/sampler";
import {launchPoints} from "@/ark-scene/map/species";
import {FRESH_TAGS, MAP_TAGS, SEA_TAGS, type MapTag} from "@/ark-scene/map/tags";
import {WaterCells} from "@/ark-scene/map/water";
import {ZONE_SITES} from "@/ark-scene/world";

export type SpawnPoint = {
    tag: MapTag;
    zone: ArkZone;
    x: number;
    z: number;
    y: number;
    water: "sea" | "fresh" | null;
    depth: number;
    /** One of the tag's launch points (decision 6), the first of its zone's list. */
    launch: boolean;
    /** Something tall in front of it from the default camera (a rare kind's cover). */
    covered: boolean;
    /**
     * A cell a terrain fix took from this tag since the homes were pinned (decision 303, `MapLedger`): it keeps its
     * place in the list, and a home on it moves to the nearest free cell of the tag (`pick`).
     */
    stale?: true;
};

type Cell = {x: number; z: number; zone: ArkZone; tags: readonly MapTag[]; wet: boolean; depth: number};
export type SlotKind = "core" | "edge" | "cover" | "plain";
/** A cluster's spot on a list: its cell, its lap round it, and where that is. */
export type SlotPick = {point: SpawnPoint; level: number; x: number; z: number};
/**
 * The attach points a kind can sit on, and whether they are its zone's own. `moved`: the points a terrain fix took
 * from the list since the homes were pinned (decision 303), each with where a home on it moves (`MapPoints.attachOf`).
 */
export type AttachList = {list: AttachPoint[]; own: boolean; moved?: ReadonlyMap<AttachPoint, AttachPoint>};

const GRID = 2.5;
/** A borrowed list's least size: a zone borrowing a tag takes the nearest zone's with at least this many cells. */
const BORROW_ROOM = 12;
/** No two tags' launch points nearer than this (m), where the ground allows. */
const CLEAR = 3;
/** The laps round a cell (under a cell, so never another cell's middle): an own zone's, and a borrowing zone's. */
const OWN_LAPS: Array<[number, number]> = [[0, 0], [1.25, 0], [0, 1.25], [1.25, 1.25]];
const BORROWED_LAPS: Array<[number, number]> = [[0.62, 0.62], [1.87, 0.62], [0.62, 1.87], [1.87, 1.87]];
/** A tag no species launches at in a zone (a roost, a second tag) still has a little weight there. */
const FLOOR_WEIGHT = 0.3;

const tagKey = (tag: MapTag, wet: boolean) => `${tag}${wet ? "~w" : ""}`;
/** How far a home on a cell or a point a terrain fix took away moves at most, to the nearest free one (m). */
const MOVE_REACH = 30;

export class MapPoints {
    readonly sampler: ArkMapSampler;
    /** The sea's cells by depth band and zone (`water.ts`). */
    readonly water: WaterCells;
    private cells: Cell[] | null = null;
    /** The cells the lists are made of: as they were when the homes were pinned (`MapLedger`; today's where none changed). */
    private listCells: Cell[] | null = null;
    /** Today's cells by `x,z`. */
    private cellAt = new Map<string, Cell>();
    /** Where a home on a stale cell moves (`SpawnPoint.stale`). */
    private moved = new Map<SpawnPoint, SpawnPoint>();
    private owners: Map<string, Cell[]> | null = null;
    private lists = new Map<string, Map<ArkZone, SpawnPoint[]>>();
    private kinds = new Map<SpawnPoint[], Record<SlotKind, SpawnPoint[]>>();
    private cellsByTag = new Map<string, Cell[]>();
    private attachTags = new Map<AttachPoint, MapTag[]>();
    private attachLists = new Map<string, AttachList>();
    /** The attach points the lists are made of (decision 303, `MapLedger`): as they were when the homes were pinned. */
    private listPoints: AttachPoint[] | null = null;
    /** The ones terrain fixes changed or took away (tombstones): what the lists take them as. */
    private listedAs = new Map<AttachPoint, {x: number; z: number; tags: readonly MapTag[]; clearBelow?: number; gone: boolean}>();
    private launched = false;
    /** The launch points by 8 m square, for "is any near?". */
    private launchIndex = new Map<string, SpawnPoint[]>();

    constructor(sampler: ArkMapSampler) {
        this.sampler = sampler;
        this.water = new WaterCells(sampler);
    }

    /** The ground on a grid: each cell's zone and tags (dry cells clear of trunks, rocks and buildings; water half a metre deep). */
    private grid(): Cell[] {
        if (this.cells) return this.cells;
        const cells: Cell[] = [];
        const listed: Cell[] = [];
        const was = this.sampler.ledger?.().cells;
        const half = this.sampler.half;
        const cellOf = (x: number, z: number): Cell | null => {
            const ground = this.sampler.ground(x, z);
            const wet = ground.water !== null;
            if (!ground.tags.length) return null;
            if (wet ? ground.depth < 0.5 : this.sampler.blocked(x, z, 0.5)) return null;
            // The hamlet's reserved plots are the residents' alone (`hamlet.ts`): no wild animal is ever placed there.
            if (!wet && this.sampler.reserved?.(x, z)) return null;
            return {x, z, zone: ground.zone, tags: ground.tags, wet, depth: ground.depth};
        };
        for (let i = Math.ceil(-half / GRID); i * GRID <= half; i++) {
            for (let j = Math.ceil(-half / GRID); j * GRID <= half; j++) {
                const x = i * GRID;
                const z = j * GRID;
                const cell = cellOf(x, z);
                const key = `${x},${z}`;
                if (cell) {
                    cells.push(cell);
                    this.cellAt.set(key, cell);
                }
                // (Decision 303, append-only: the lists take a cell a terrain fix changed as it was when the homes were
                // pinned, so the fix moves no home but the ones on the cells it changed.)
                const before = was?.get(key);
                if (before === undefined) {
                    if (cell) listed.push(cell);
                } else if (before) listed.push({x, z, ...before, depth: cell?.depth ?? 0});
            }
        }
        this.cells = cells;
        this.listCells = listed;
        return cells;
    }

    /** Every grid cell where a tag holds, in the water or on dry ground (for roosts and the tests), whichever tag owns it. */
    cellsWith(tag: MapTag, wet: boolean): Cell[] {
        const key = tagKey(tag, wet);
        let list = this.cellsByTag.get(key);
        if (!list) {
            list = this.grid().filter((cell) => cell.wet === wet && cell.tags.includes(tag));
            this.cellsByTag.set(key, list);
        }
        return list;
    }

    /** Which tag owns each cell: the one of its tags furthest behind its zone's share (assigned ÷ wanted), in a fixed order. */
    private owned(): Map<string, Cell[]> {
        if (this.owners) return this.owners;
        const table = launchPoints();
        const want = (tag: MapTag, wet: boolean, zone: ArkZone) => Math.max(table[tag]?.[`${zone}${wet ? "~w" : ""}`] ?? 0, FLOOR_WEIGHT);
        const given = new Map<string, number>();
        const owners = new Map<string, Cell[]>();
        // A fixed scatter of the cells (not their grid order), so each tag's share is spread over its ground.
        this.grid();
        const order = this.listCells!.map((cell, index) => ({cell, h: scatter(cell.x, cell.z), index})).sort((a, b) => a.h - b.h || a.index - b.index);
        for (const {cell} of order) {
            let best: MapTag | null = null;
            let score = Infinity;
            for (const tag of cell.tags) {
                const key = `${tagKey(tag, cell.wet)}|${cell.zone}`;
                const s = (given.get(key) ?? 0) / want(tag, cell.wet, cell.zone);
                if (s < score) {
                    score = s;
                    best = tag;
                }
            }
            if (!best) continue;
            const key = `${tagKey(best, cell.wet)}|${cell.zone}`;
            given.set(key, (given.get(key) ?? 0) + 1);
            const list = owners.get(tagKey(best, cell.wet)) ?? [];
            list.push(cell);
            owners.set(tagKey(best, cell.wet), list);
        }
        this.owners = owners;
        return owners;
    }

    private indexPoint(point: SpawnPoint) {
        const key = `${Math.floor(point.x / 8)},${Math.floor(point.z / 8)}`;
        const list = this.launchIndex.get(key) ?? [];
        list.push(point);
        this.launchIndex.set(key, list);
    }

    /** Is any launch point (but `except`) nearer than `distance` (at most 8 m)? */
    nearLaunch(x: number, z: number, distance: number, except: {x: number; z: number} | null = null): boolean {
        this.launch();
        const cx = Math.floor(x / 8);
        const cz = Math.floor(z / 8);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                for (const p of this.launchIndex.get(`${cx + dx},${cz + dz}`) ?? []) {
                    if (except && p.x === except.x && p.z === except.z) continue;
                    if (Math.hypot(p.x - x, p.z - z) < distance) return true;
                }
            }
        }
        return false;
    }

    /**
     * Every tag's lists, made at once in a fixed order (the tags' order, dry
     * then wet; a tag's zones by how many launch points they want), each
     * zone's launch points clear of those made before, so nothing depends on
     * which animals asked first.
     */
    private launch(): void {
        if (this.launched) return;
        this.launched = true;
        const owners = this.owned();
        const table = launchPoints();
        for (const tag of MAP_TAGS) {
            for (const wet of [false, true]) {
                const cells = owners.get(tagKey(tag, wet));
                if (!cells?.length) continue;
                const byZone = new Map<ArkZone, Cell[]>();
                for (const cell of cells) {
                    const list = byZone.get(cell.zone) ?? [];
                    list.push(cell);
                    byZone.set(cell.zone, list);
                }
                const zones = Array.from(byZone.keys()).map((zone) => ({zone, count: table[tag]?.[`${zone}${wet ? "~w" : ""}`] ?? 0})).sort((a, b) => b.count - a.count || a.zone.localeCompare(b.zone));
                const out = new Map<ArkZone, SpawnPoint[]>();
                for (const {zone, count} of zones) {
                    const pool = byZone.get(zone)!;
                    const clear = pool.filter((cell) => !this.nearLaunch(cell.x, cell.z, CLEAR));
                    const launchCells = spread(clear.length ? clear : pool, Math.min(Math.max(count, 1), pool.length));
                    const taken = new Set(launchCells);
                    const point = (cell: Cell, launch: boolean): SpawnPoint => {
                        const ground = this.sampler.ground(cell.x, cell.z);
                        const now = this.cellAt.get(`${cell.x},${cell.z}`);
                        const stale = !now || now.wet !== cell.wet || now.zone !== cell.zone || !now.tags.includes(tag);
                        return {tag, zone, x: cell.x, z: cell.z, y: ground.height, water: ground.water, depth: ground.depth, launch, covered: !cell.wet && Boolean(this.sampler.covered?.(cell.x, cell.z)), ...(stale ? {stale: true as const} : {})};
                    };
                    const list = launchCells.map((cell) => point(cell, true));
                    list.forEach((p) => this.indexPoint(p));
                    // The rest of the zone's cells of the tag, nearest the launch points' middle first, spread out.
                    const mx = list.reduce((s, p) => s + p.x, 0) / list.length;
                    const mz = list.reduce((s, p) => s + p.z, 0) / list.length;
                    const rest = pool.filter((cell) => !taken.has(cell)).sort((a, b) => Math.hypot(a.x - mx, a.z - mz) - Math.hypot(b.x - mx, b.z - mz) || a.x - b.x || a.z - b.z);
                    for (const gap of [6, 4, 0]) {
                        for (const cell of rest) {
                            if (taken.has(cell)) continue;
                            if (gap && list.some((p) => Math.abs(p.x - cell.x) < gap && Math.abs(p.z - cell.z) < gap && Math.hypot(p.x - cell.x, p.z - cell.z) < gap)) continue;
                            list.push(point(cell, false));
                            taken.add(cell);
                        }
                    }
                    out.set(zone, list);
                }
                this.lists.set(tagKey(tag, wet), out);
            }
        }
        // A cell a terrain fix took from its tag (decision 303): a home on it moves to the nearest cell where the tag holds
        // today, in its zone where one is near (half a cell over from that cell's own spots, `pick`). None within
        // MOVE_REACH: it stays, and the placement settles round it as on any cell.
        this.lists.forEach((zones, key) => zones.forEach((list) => list.forEach((point) => {
            if (!point.stale) return;
            let best: Cell | null = null;
            let distance = MOVE_REACH;
            for (const cell of this.cellsWith(point.tag, key.endsWith("~w"))) {
                const d = Math.hypot(cell.x - point.x, cell.z - point.z) + (cell.zone === point.zone ? 0 : MOVE_REACH / 2);
                if (d < distance) {
                    distance = d;
                    best = cell;
                }
            }
            if (!best) return;
            const ground = this.sampler.ground(best.x, best.z);
            this.moved.set(point, {tag: point.tag, zone: point.zone, x: best.x, z: best.z, y: ground.height, water: ground.water, depth: ground.depth, launch: point.launch, covered: !best.wet && Boolean(this.sampler.covered?.(best.x, best.z))});
        })));
    }

    /** Where homes moved off the cells terrain fixes took away (decision 303): each stale cell and its new one (reports, tests). */
    movedCells(): ReadonlyMap<SpawnPoint, SpawnPoint> {
        this.launch();
        return this.moved;
    }

    /** A tag's lists by zone (empty when no cell is that tag's). */
    partitions(tag: MapTag, wet: boolean): Map<ArkZone, SpawnPoint[]> {
        this.launch();
        return this.lists.get(tagKey(tag, wet)) ?? new Map();
    }

    /** The list a zone's animal of this tag uses: its own zone's (`own`), else the nearest zone's that has some. */
    partitionOf(tag: MapTag, wet: boolean, zone: ArkZone): {list: SpawnPoint[]; own: boolean; borrowers?: ArkZone[]} {
        const partitions = this.partitions(tag, wet);
        // A zone with only a stray few of a tag's cells (its edge, where another zone's ground bleeds in) borrows too: its
        // clusters would lap those few cells hundreds deep.
        const biggest = Math.max(...Array.from(partitions.values()).map((list) => list.length), 0);
        const borrows = (other: ArkZone) => (partitions.get(other)?.length ?? 0) < Math.min(BORROW_ROOM, biggest);
        const own = partitions.get(zone);
        if (own?.length && !borrows(zone)) return {list: own, own: true};
        const best = this.nearestPartition(partitions, zone);
        if (best === own) return {list: own!, own: true};
        // The zones that borrow the same list (each zone with none or a stray few of the tag's cells borrows the nearest
        // roomy zone's), in a fixed order.
        const borrowers = ARK_ZONES.filter((other) => borrows(other) && this.nearestPartition(partitions, other) === best);
        return {list: best, own: false, borrowers};
    }

    private nearestPartition(partitions: Map<ArkZone, SpawnPoint[]>, zone: ArkZone): SpawnPoint[] {
        const site = ZONE_SITES[zone] ?? ZONE_SITES.farm_garden;
        let best: SpawnPoint[] = [];
        let distance = Infinity;
        // The nearest zone's with room to share (a zone's stray few cells of a tag at its edge, a farm's tag bleeding into
        // the lake's meadow, would pile every borrower onto one cell); with none that big, the biggest.
        const roomy = Math.min(BORROW_ROOM, Math.max(...Array.from(partitions.values()).map((list) => list.length), 0));
        for (const [other, list] of Array.from(partitions.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
            const s = ZONE_SITES[other];
            const d = Math.hypot(s.x - site.x, s.z - site.z);
            if (list.length >= roomy && list.length && d < distance) {
                distance = d;
                best = list;
            }
        }
        return best;
    }

    /**
     * A list's cells for a kind of slot (the stats): `core` the inner sixth
     * by distance from its launch points' middle, `edge` the outer quarter
     * (`cover` the edge's cells with something tall in front, else the edge),
     * `plain` the rest; each in the list's own order, never sharing a cell.
     * A list under 12 cells is all plain.
     */
    kindOf(list: SpawnPoint[], kind: SlotKind): SpawnPoint[] {
        if (list.length < 12) return list;
        let split = this.kinds.get(list);
        if (!split) {
            const launch = list.filter((p) => p.launch);
            const from = launch.length >= 3 ? launch : list;
            const cx = from.reduce((sum, p) => sum + p.x, 0) / from.length;
            const cz = from.reduce((sum, p) => sum + p.z, 0) / from.length;
            const rankOf = new Map([...list].sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz) || a.x - b.x || a.z - b.z).map((p, i) => [p, i]));
            const coreTo = Math.max(3, Math.floor(list.length / 6));
            const edgeFrom = list.length - Math.floor(list.length / 4);
            const core = list.filter((p) => rankOf.get(p)! < coreTo);
            const edge = list.filter((p) => rankOf.get(p)! >= edgeFrom);
            const covered = edge.filter((p) => p.covered);
            const open = edge.filter((p) => !p.covered);
            split = {core, cover: covered.length ? covered : edge, edge: covered.length && open.length ? open : edge, plain: list.filter((p) => rankOf.get(p)! >= coreTo && rankOf.get(p)! < edgeFrom)};
            this.kinds.set(list, split);
        }
        return split[kind];
    }

    /**
     * Where cluster (zone, slot) stands on a list: an own zone's slot k on
     * cell k mod n, lap k div n; a borrowing zone's from the list's end,
     * half a cell over. One-to-one: no two clusters share a spot.
     */
    pick(list: SpawnPoint[], own: boolean, zone: ArkZone, slot: number, borrowers: readonly ArkZone[] = ARK_ZONES): SlotPick {
        const n = list.length;
        // A borrowing zone's slots interleave only with the other zones that borrow this list (not all twelve: fewer laps).
        const key = own ? slot : slot * Math.max(borrowers.length, 1) + Math.max(borrowers.indexOf(zone), 0);
        const lap = Math.floor(key / n);
        const listed = own ? list[key % n] : list[n - 1 - (key % n)];
        // (A cell a terrain fix took from the tag: the home on it moves to the nearest cell of the tag, `launch`, on the
        // other laps' spots, so never on one of that cell's own.)
        const moved = this.moved.get(listed);
        const point = moved ?? listed;
        const laps = moved ? !own : own;
        // Past four laps (more clusters than four a cell, a zone far over its ground): each further lap its own spot in the cell, on a
        // low-discrepancy sequence (R2), so nothing ever stands on another's spot, however full.
        if (lap >= 4) {
            const k = lap - 4 + (laps ? 0 : 1000);
            const ox = ((0.5 + k * 0.7548776662) % 1) * GRID;
            const oz = ((0.5 + k * 0.5698402910) % 1) * GRID;
            return {point, level: own ? lap : lap + 1, x: point.x + ox - GRID / 2, z: point.z + oz - GRID / 2};
        }
        const [ox, oz] = (laps ? OWN_LAPS : BORROWED_LAPS)[lap];
        return {point, level: own ? lap : lap + 1, x: point.x + ox, z: point.z + oz};
    }

    /** How many cells each zone owns (every tag's own list; each cell belongs to one tag): rule E's visible capacity (`capacity.ts`). */
    cellsPerZone(): Map<ArkZone, number> {
        const out = new Map<ArkZone, number>();
        this.owned().forEach((cells) => {
            for (const cell of cells) out.set(cell.zone, (out.get(cell.zone) ?? 0) + 1);
        });
        return out;
    }

    /** Every launch point (for the report, the contact sheets and the tests). */
    all(): SpawnPoint[] {
        this.launch();
        const out: SpawnPoint[] = [];
        for (const zones of Array.from(this.lists.values())) for (const list of Array.from(zones.values())) out.push(...list.filter((p) => p.launch));
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

    private seaNear = new Map<string, boolean>();

    /** Is the sea within `reach` of a spot (16 bearings, every 3 m or nearer out to the reach: a narrow inlet too)? */
    seaWithin(x0: number, z0: number, reach: number): boolean {
        // (Worked out at the half-metre grid's point, not the first caller's: the same answer whichever spot asks first.)
        const gx = Math.round(x0 * 2);
        const gz = Math.round(z0 * 2);
        const key = `${gx},${gz},${reach}`;
        const known = this.seaNear.get(key);
        if (known !== undefined) return known;
        const x = gx / 2;
        const z = gz / 2;
        let found = this.sampler.ground(x, z).water === "sea";
        const steps = Math.max(2, Math.ceil(reach / 3));
        for (let n = 1; n <= steps && !found; n++) {
            const d = (reach * n) / steps;
            for (let k = 0; k < 16 && !found; k++) if (this.sampler.ground(x + Math.cos((k / 16) * Math.PI * 2) * d, z + Math.sin((k / 16) * Math.PI * 2) * d).water === "sea") found = true;
        }
        this.seaNear.set(key, found);
        return found;
    }

    /** In the sea, or on ground its tide or its surf reaches (lower than `DEN_DRY` within `SURF_REACH` of it). */
    inSurf(x: number, z: number): boolean {
        const g = this.sampler.ground(x, z);
        if (g.water === "sea") return true;
        return g.water === null && g.height < DEN_DRY && this.seaWithin(x, z, SURF_REACH);
    }

    /** The map tags an attach point stands for (its own and its ground's). */
    /** The one tag a point's list is (of the tags it stands for, today's or `tags`, by a hash of its id: the same for every viewer). */
    ownerOf(point: AttachPoint, tags: readonly MapTag[] = this.tagsOf(point)): MapTag | null {
        if (!tags.length) return null;
        if (tags.length === 1) return tags[0];
        let h = 0x811c9dc5;
        for (let i = 0; i < point.id.length; i++) {
            h ^= point.id.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return tags[(h >>> 0) % tags.length];
    }

    tagsOf(point: AttachPoint): MapTag[] {
        let tags = this.attachTags.get(point);
        if (!tags) {
            tags = attachPointTags(point, this.sampler.ground(point.x, point.z).tags);
            this.attachTags.set(point, tags);
        }
        return tags;
    }

    /**
     * The attach points the lists are made of (decision 303, append-only scenery): today's, less the ones terrain
     * fixes added since the homes were pinned, with the ones they took away back at their old index (tombstones).
     */
    private pinnedPoints(): AttachPoint[] {
        if (this.listPoints) return this.listPoints;
        const ledger = this.sampler.ledger?.();
        const list = this.sampler.attachPoints().filter((point) => !ledger?.added.has(point.id));
        for (const point of list) {
            const was = ledger?.was.get(point.id);
            if (was) this.listedAs.set(point, {x: was.x ?? point.x, z: was.z ?? point.z, tags: was.tags ?? this.tagsOf(point), clearBelow: "clearBelow" in was ? was.clearBelow : point.clearBelow, gone: false});
        }
        for (const {index, point, tags} of ledger?.gone ?? []) {
            list.splice(index, 0, point);
            this.listedAs.set(point, {x: point.x, z: point.z, tags, clearBelow: point.clearBelow, gone: true});
        }
        this.listPoints = list;
        return list;
    }

    /** A point as the lists take it: where it was and the tags it stood for when the homes were pinned. */
    private listed(point: AttachPoint): {x: number; z: number; tags: readonly MapTag[]; clearBelow?: number; gone: boolean} {
        return this.listedAs.get(point) ?? {x: point.x, z: point.z, tags: this.tagsOf(point), clearBelow: point.clearBelow, gone: false};
    }

    /**
     * A list's points a terrain fix took from it (gone, or no longer what `holds` asks), each moved to the nearest
     * free point today (of the same kind, that `holds`, in no slot of the list), in the list's order; none within
     * MOVE_REACH: it stays.
     */
    private movesOf(list: readonly AttachPoint[], holds: (point: AttachPoint) => boolean): Map<AttachPoint, AttachPoint> | undefined {
        if (!this.listedAs.size) return undefined;
        const stale = list.filter((point) => this.listedAs.has(point) && (this.listed(point).gone || !holds(point)));
        if (!stale.length) return undefined;
        const taken = new Set<AttachPoint>(list);
        const moves = new Map<AttachPoint, AttachPoint>();
        for (const point of stale) {
            let best: AttachPoint | null = null;
            let distance = MOVE_REACH;
            for (const other of this.sampler.attachPoints()) {
                if (other.tag !== point.tag || taken.has(other)) continue;
                const d = Math.hypot(other.x - point.x, other.y - point.y, other.z - point.z);
                if (d < distance && holds(other)) {
                    distance = d;
                    best = other;
                }
            }
            if (!best) continue;
            taken.add(best);
            moves.set(point, best);
        }
        return moves;
    }

    private shoreLists = new Map<string, Array<{x: number; z: number}>>();

    /**
     * Where a diver that hauls out stands (a penguin, a seal): dry ground
     * within `SHORE_REACH` of the sea, of the shore's tags, clear of scenery
     * and of the hamlet's land; the cold cove's (its ice running down to the
     * sea, its rocky shore) or a zone's own coast. Nearest the water first.
     */
    shoreList(which: "cove" | ArkZone, centre: {x: number; z: number}): Array<{x: number; z: number}> {
        let list = this.shoreLists.get(which);
        if (list) return list;
        const sea = new Set(this.grid().filter((cell) => cell.wet && this.sampler.ground(cell.x, cell.z).water === "sea").map((cell) => `${Math.round(cell.x / GRID)},${Math.round(cell.z / GRID)}`));
        const reach = Math.ceil(SHORE_REACH / GRID);
        const tags = which === "cove" ? COVE_TAGS : COAST_TAGS;
        const near: Array<{x: number; z: number; water: number; d: number}> = [];
        for (const cell of this.grid()) {
            if (cell.wet || !cell.tags.some((tag) => tags.has(tag)) || this.sampler.reserved?.(cell.x, cell.z)) continue;
            if (which === "cove" ? Math.hypot(cell.x - centre.x, cell.z - centre.z) > COVE_RADIUS : cell.zone !== which) continue;
            const i = Math.round(cell.x / GRID);
            const j = Math.round(cell.z / GRID);
            let water = Infinity;
            for (let di = -reach; di <= reach; di++) for (let dj = -reach; dj <= reach; dj++) if (sea.has(`${i + di},${j + dj}`)) water = Math.min(water, Math.hypot(di, dj) * GRID);
            if (water > SHORE_REACH) continue;
            near.push({x: cell.x, z: cell.z, water, d: Math.hypot(cell.x - centre.x, cell.z - centre.z)});
        }
        near.sort((a, b) => a.water - b.water || a.d - b.d || a.x - b.x || a.z - b.z);
        list = near.map(({x, z}) => ({x, z}));
        this.shoreLists.set(which, list);
        return list;
    }

    private limbLists = new Map<string, AttachList>();

    /**
     * The limb points (`limb`, or `canopy_hang` for a hanger) a large climber
     * fits: its body within the point's size, a limb that holds its mass
     * (with a margin) and has room above it, or a hang point with a drop
     * below it; a body and a little apart; its zone's first.
     */
    limbsFor(tag: "limb" | "canopy_hang", length: number, mass: number, zone: ArkZone): AttachList {
        const key = `${tag}|${length.toFixed(3)}|${mass.toFixed(1)}|${zone}`;
        let found = this.limbLists.get(key);
        if (!found) {
            const holds = (point: AttachPoint, clearBelow = point.clearBelow) => {
                if (point.tag !== tag || !attachFits(point, length)) return false;
                if (tag === "limb") return (point.load ?? 0) >= mass * LOAD_MARGIN && (point.clearAbove ?? 0) >= length * 0.6;
                return (point.radius ?? 0) >= 0.03 && (clearBelow ?? 0) >= length;
            };
            // (As the limbs were when the homes were pinned, decision 303: a terrain fix moves only the homes it touches.)
            const fits = this.pinnedPoints().filter((point) => holds(point, this.listed(point).clearBelow));
            const list = thin(fits, Math.max(length * 1.2, 0.3), (point) => this.listed(point));
            const own = list.filter((point) => point.zone === zone);
            const chosen = own.length ? own : list;
            found = {list: chosen, own: own.length > 0, moved: this.movesOf(chosen, (point) => holds(point))};
            this.limbLists.set(key, found);
        }
        return found;
    }

    /**
     * The attach points a small animal can sit on: of its tag, fitting its
     * length, in its zone first (else any zone's), and whether the list is
     * the zone's own (then its slot alone picks the point). Empty when the
     * scenery has none.
     */
    attachOf(tag: MapTag, length: number, zone: ArkZone, holes = true): AttachList {
        const key = `${tag}|${length.toFixed(3)}|${zone}|${holes}`;
        let found = this.attachLists.get(key);
        if (!found) {
            // (The ground's own points, a hole or a pool, never on a launch point: a small one is never under a big one's feet.)
            const low = (point: AttachPoint) => point.tag === "worm_hole" || point.tag === "burrow_entrance" || point.tag === "tide_pool";
            // (Each point is one tag's, as each ground cell is: a point that stands for two tags, a desert shrub's top for
            // the sand and the scrub, is in one of their lists only, so two kinds' clusters never pick the same point.)
            // (A tag that owns no point its body fits takes the points that stand for it, shared: a toad by the lake.)
            // (A land kind's rock face, ledge or hole is never in the sea, its tide or its surf: a gundi on a boulder off the
            // desert's new coast, a rock hyrax's den in the surf. A shore's or the water's own kinds keep theirs.)
            const landTag = !SEA_TAGS.has(tag) && !FRESH_TAGS.has(tag) && !SURF_TAGS.has(tag);
            // (As the points were when the homes were pinned, decision 303: where they were and the tags they stood for.)
            const usableAs = (point: AttachPoint, at: {x: number; z: number; tags: readonly MapTag[]}) => (holes || (point.tag !== "worm_hole" && point.tag !== "burrow_entrance")) && attachFits(point, length) && at.tags.includes(tag) && !(low(point) && this.nearLaunch(at.x, at.z, 2.5)) && !(landTag && LOW_POINTS.has(point.tag) && this.inSurf(at.x, at.z));
            const usable = (point: AttachPoint) => usableAs(point, this.listed(point));
            const shared = this.pinnedPoints().filter(usable);
            const owned = shared.filter((point) => this.ownerOf(point, this.listed(point).tags) === tag);
            const candidates = owned.some((point) => point.zone === zone) || (owned.length && !shared.some((point) => point.zone === zone)) ? owned : shared;
            // Points a body's length and a little apart (a small rock's four faces are one place for a puffin), in a fixed order.
            const gap = Math.max(length * 1.2, 0.03);
            const fitting: AttachPoint[] = [];
            const near = new Map<string, Array<{x: number; y: number; z: number}>>();
            const cell = (x: number, z: number) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
            for (const point of candidates) {
                const at = this.listed(point);
                const [cx, cz] = [Math.floor(at.x / 2), Math.floor(at.z / 2)];
                let clear = true;
                for (let dx = -1; dx <= 1 && clear; dx++) for (let dz = -1; dz <= 1 && clear; dz++) clear = (near.get(`${cx + dx},${cz + dz}`) ?? []).every((other) => Math.hypot(other.x - at.x, other.y - point.y, other.z - at.z) >= gap);
                if (!clear) continue;
                fitting.push(point);
                const key = cell(at.x, at.z);
                near.set(key, [...(near.get(key) ?? []), {x: at.x, y: point.y, z: at.z}]);
            }
            const own = fitting.filter((point) => point.zone === zone);
            const chosen = own.length ? own : fitting;
            // (A point a terrain fix took from the list: a home on it moves to the nearest free one that is usable today.)
            found = {list: chosen, own: own.length > 0, moved: this.movesOf(chosen, (point) => usableAs(point, {x: point.x, z: point.z, tags: this.tagsOf(point)}))};
            this.attachLists.set(key, found);
        }
        return found;
    }
}

/**
 * Dry land above the sea (m over its mean): the spring tide's high water is
 * 0.35 (`ark-clock.ts` seaLevelAt, a range of 0.7) and the surf runs a
 * quarter of a metre up the shore past it. A den, or a land kind's rock face,
 * ledge or hole, is never lower than this within `SURF_REACH` of the sea.
 */
export const DEN_DRY = 0.6;
/** How far from the sea low ground is the tide's or the surf's (m). */
export const SURF_REACH = 6;
/** The shore's own tags: their kinds live in the tide and the surf (a crab's rock, a puffin's sea ledge). */
const SURF_TAGS: ReadonlySet<MapTag> = new Set<MapTag>(["rocky_shore", "sandy_beach", "sea_cliffs", "mudflat"]);
/** The points on the ground or low on a rock, where the tide and the surf reach. */
const LOW_POINTS: ReadonlySet<string> = new Set(["rock_face", "ledge", "burrow_entrance", "worm_hole"]);

/** A hauled-out diver's shore: dry ground at most this far from the sea (m). */
export const SHORE_REACH = 7;
/** How far round the cold cove's middle its shore reaches (m). */
const COVE_RADIUS = 34;
const COVE_TAGS: ReadonlySet<MapTag> = new Set<MapTag>(["snow_ice", "tundra", "rocky_shore", "sea_cliffs", "rocks_boulders"]);
const COAST_TAGS: ReadonlySet<MapTag> = new Set<MapTag>(["rocky_shore", "sandy_beach", "sea_cliffs", "rocks_boulders", "mudflat"]);

/** A body's mass a limb must hold, as a share of the limb's load (a margin for a moving, landing body). */
const LOAD_MARGIN = 1.5;

/** Keep the points at least `gap` apart (greedy, in the list's order), with a 2 m spatial hash. */
function thin(points: AttachPoint[], gap: number, at: (point: AttachPoint) => {x: number; z: number} = (point) => point): AttachPoint[] {
    const out: AttachPoint[] = [];
    const near = new Map<string, Array<{x: number; y: number; z: number}>>();
    const size = Math.max(2, gap);
    for (const point of points) {
        const {x, z} = at(point);
        const cx = Math.floor(x / size);
        const cz = Math.floor(z / size);
        let clear = true;
        for (let dx = -1; dx <= 1 && clear; dx++) for (let dz = -1; dz <= 1 && clear; dz++) clear = (near.get(`${cx + dx},${cz + dz}`) ?? []).every((other) => Math.hypot(other.x - x, other.y - point.y, other.z - z) >= gap);
        if (!clear) continue;
        out.push(point);
        const key = `${cx},${cz}`;
        const list = near.get(key) ?? [];
        list.push({x, y: point.y, z});
        near.set(key, list);
    }
    return out;
}

/** A fixed number in [0, 1) for a cell (the same on every device). */
function scatter(x: number, z: number): number {
    const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return v - Math.floor(v);
}

/** `count` cells spread evenly over the pool: farthest-point sampling from the cell nearest its middle, then relaxed. */
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
    // Farthest-point sampling picks the pool's edges first: three rounds of Lloyd's relaxation spread them through it instead.
    for (let round = 0; round < 3 && chosen.length > 1; round++) {
        const sums = chosen.map(() => ({x: 0, z: 0, n: 0}));
        for (const cell of pool) {
            let best = 0;
            let d = Infinity;
            for (let k = 0; k < chosen.length; k++) {
                const e = Math.hypot(cell.x - chosen[k].x, cell.z - chosen[k].z);
                if (e < d) {
                    d = e;
                    best = k;
                }
            }
            sums[best].x += cell.x;
            sums[best].z += cell.z;
            sums[best].n++;
        }
        const taken = new Set<Cell>();
        for (let k = 0; k < chosen.length; k++) {
            if (!sums[k].n) continue;
            const mx = sums[k].x / sums[k].n;
            const mz = sums[k].z / sums[k].n;
            let best: Cell | null = null;
            let d = Infinity;
            for (const cell of pool) {
                if (taken.has(cell)) continue;
                const e = Math.hypot(cell.x - mx, cell.z - mz);
                if (e < d) {
                    d = e;
                    best = cell;
                }
            }
            if (best) {
                chosen[k] = best;
                taken.add(best);
            }
        }
    }
    return chosen;
}

/** The cluster key of a zone's slot: unique over every zone and slot. */
export function clusterKey(zone: ArkZone, slot: number): number {
    return Math.max(ARK_ZONES.indexOf(zone), 0) + ARK_ZONES.length * slot;
}

/** The key on a borrowed list (another zone's): past any slot its own zone will use, distinct per zone. */
export function borrowedKey(zone: ArkZone, slot: number): number {
    return 100000 * (Math.max(ARK_ZONES.indexOf(zone), 0) + 1) + slot;
}

/**
 * Where key `key` of a list of `size` stands (attach points): an index into
 * the list and a level (how many keys already round that point). One-to-one,
 * and consecutive keys go round every point before any doubles up.
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
