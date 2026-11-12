/**
 * The streamer (Part B, docs/ark/streaming.md): which chunks of the world are drawn, from the camera's eye, the
 * tier's render and map distances and the island the camera is over; the edge haze; the render distance pulled in
 * under memory pressure. The world may hold several islands (decision 141: both islands side by side in one world),
 * each with its own chunk grid placed in the world frame by an offset (`registerIsland`).
 *
 * Per island, each chunk is `in` (full detail: within the render distance, on the island the camera is over), `map`
 * (map style: past the render distance within the map distance, or anywhere on another island) or `out` (past the map
 * distance). The parts that own chunks read it: `stateOf(chunk)` (the first island's), `stateAt(x, z)` (any island,
 * world coordinates), and each island's `apply` / `onChange` when its states move.
 *
 * Nothing here moves anything: the world is the same for every viewer, only what is drawn of it differs.
 */

import {
    chunkCount,
    chunkOf,
    chunkStates,
    DEFAULT_SPAN,
    farthestContent,
    hazeStrength,
    STATE_IN,
    STATE_MAP,
    STATE_OUT,
    type ChunkGrid,
    type ChunkSpan
} from "@/ark-scene/streaming/chunks";
import {hazeEndDepth, type ArkHaze} from "@/ark-scene/streaming/haze";
import {ARK_STREAM_TIERS, forcedMapDistance, forcedRenderDistance, MAP_VIEW_FROM, stepRenderScale, type MemoryReading, type StreamTierName} from "@/ark-scene/streaming/tiers";

export {STATE_IN, STATE_MAP, STATE_OUT} from "@/ark-scene/streaming/chunks";

/** Re-check the states when the eye has moved this far (m), or after `RECHECK_SECONDS`. */
const RECHECK_MOVE = 2;
const RECHECK_SECONDS = 0.5;
/** The memory check's period (s). */
const MEMORY_SECONDS = 2;
/** The haze eases to its target in about this long (s). */
const HAZE_SECONDS = 0.6;
/** The map view is left only this much nearer than it is entered (m). */
const MAP_VIEW_HYSTERESIS = 15;
/**
 * The island the camera's target is over: the one whose coast is nearest (distance to its middle less its land
 * reach), changing only when another's is nearer by this much (m), so a target over the middle of the strait keeps
 * the island it came from.
 */
const ACTIVE_HYSTERESIS = 30;
/** Without a land reach given, an island's is this share of its grid's half side. */
const DEFAULT_REACH_SHARE = 0.8;
/** The scene's clear-weather fog (index.ts) and how far it is pushed when the world holds several islands (decision 142). */
const CLEAR_FOG = {near: 420, far: 1700};

/** One island's chunks, as the streamer holds them (world frame = island frame + `offset`). */
export type StreamIslandSpec = {
    id: string;
    /** Where the island's own origin sits in the world frame (m). */
    offset: {x: number; z: number};
    /** Its land's reach from its own origin (m): which island the camera is over. Default 0.8 of the grid's half side. */
    reach?: number;
    /** Its grid, spans and content in its own frame. */
    grid: ChunkGrid;
    spans: ChunkSpan[];
    content: Uint8Array;
    /**
     * Its chunks' states changed: STATE_IN in full, STATE_MAP in map style (the ground, buildings and trees; no small
     * props or people; animals are the scene's markers), STATE_OUT not drawn. `allIn`: every content chunk is in
     * (draw exactly as built). Called once at registration too.
     */
    apply?: (states: Uint8Array, allIn: boolean) => void;
};

type StreamIsland = StreamIslandSpec & {states: Uint8Array; allIn: boolean};

export type StreamStats = {
    tier: StreamTierName;
    renderDistance: number;
    mapDistance: number;
    renderScale: number;
    map: boolean;
    haze: number;
    /** The island the camera is over. */
    active: string | null;
    chunks: {in: number; map: number; out: number; content: number};
    islands: Record<string, {in: number; map: number; out: number}>;
    /** The base fog's reach now (pushed out when the world holds several islands). */
    fog: {near: number; far: number};
    changes: number;
    memory: MemoryReading | null;
};

export type StreamerOptions = {
    /** The first island (its id `primaryId`, at the world's origin unless `offset`). */
    grid: ChunkGrid;
    spans: ChunkSpan[];
    /** Chunks holding something (land, plants, props, animals' places): the haze is on only while one lies beyond. */
    content: Uint8Array;
    primaryId?: string;
    offset?: {x: number; z: number};
    reach?: number;
    tier: StreamTierName;
    haze: ArkHaze | null;
    /** What the page holds now (the scene's GPU estimate, the JS heap where the browser says it). */
    memory?: () => MemoryReading;
    heapLimitMB?: number | null;
    /** Memory pressure at the smallest distance: ask the scene for a lower tier. */
    onDrop?: () => void;
    /** With two islands, the clear fog is pushed out beyond this reach (m; `arkFogReach`'s `from`; default 700). */
    fogFrom?: number;
};

export class ArkStreamer {
    /** The first island's grid, spans and content (the scene's own island). */
    readonly grid: ChunkGrid;
    readonly spans: ChunkSpan[];
    readonly content: Uint8Array;
    private readonly islands: StreamIsland[] = [];
    private readonly primary: StreamIsland;
    private active: StreamIsland | null = null;
    private tierName: StreamTierName;
    private scale = 1;
    private calmFor = 0;
    private mapView = false;
    private hazeNow = 0;
    private lastCheck = -Infinity;
    private lastMemory = -Infinity;
    private lastFrame = -Infinity;
    private readonly lastEye = {x: Infinity, y: Infinity, z: Infinity};
    private lastTarget: {x: number; z: number} | null = null;
    private changes = 0;
    private reading: MemoryReading | null = null;
    private allInNow = true;
    private fogReach = {...CLEAR_FOG};
    private readonly listeners: Array<(states: Uint8Array, allIn: boolean) => void> = [];

    constructor(private readonly options: StreamerOptions) {
        this.grid = options.grid;
        this.spans = options.spans;
        this.content = options.content;
        this.tierName = options.tier;
        this.primary = {id: options.primaryId ?? "wild", offset: options.offset ?? {x: 0, z: 0}, reach: options.reach, grid: options.grid, spans: options.spans, content: options.content, states: new Uint8Array(chunkCount(options.grid)).fill(STATE_IN), allIn: true};
        // (The first island's states reach the scene through `onChange`.)
        this.primary.apply = (states, allIn) => {
            for (const listener of this.listeners) listener(states, allIn);
        };
        this.islands.push(this.primary);
        this.active = this.primary;
    }

    /** The render distance now (m): the tier's, times the memory scale (or a development override). */
    get renderDistance(): number {
        const tier = ARK_STREAM_TIERS[this.tierName];
        return forcedRenderDistance(tier) ?? tier.renderDistance * this.scale;
    }

    /** The map distance now (m): the tier's, times the memory scale (never nearer than the render distance). */
    get mapDistance(): number {
        const tier = ARK_STREAM_TIERS[this.tierName];
        return Math.max(forcedMapDistance() ?? tier.mapDistance * this.scale, this.renderDistance);
    }

    /** Every chunk with content, on every island, is drawn in full: nothing to skip anywhere. */
    get allIn(): boolean {
        return this.allInNow;
    }

    get map(): boolean {
        return this.mapView;
    }

    /** The island the camera's target is over (its chunks go by distance; every other island is map style). */
    get activeIsland(): string | null {
        return this.active?.id ?? null;
    }

    /** The base fog's reach (the scene's clear-weather fog, pushed out while the world holds several islands). */
    get fog(): {near: number; far: number} {
        return this.fogReach;
    }

    setTier(tier: StreamTierName) {
        if (tier === this.tierName) return;
        this.tierName = tier;
        this.scale = 1;
        this.calmFor = 0;
        this.lastCheck = -Infinity;
    }

    /**
     * Another island in the world (or the same id again, replacing it): its chunks start in map style unless the
     * camera is over it, and `apply` is told at once. The base fog is pushed out so the islands read side by side.
     */
    registerIsland(spec: StreamIslandSpec) {
        this.unregisterIsland(spec.id, false);
        const island: StreamIsland = {...spec, states: new Uint8Array(chunkCount(spec.grid)).fill(STATE_MAP), allIn: false};
        if (spec.id === this.primary.id) {
            // (The scene's own island: only its place in the world and its reach move.)
            this.primary.offset = spec.offset;
            if (spec.reach !== undefined) this.primary.reach = spec.reach;
            if (spec.apply) {
                const own = spec.apply;
                this.primary.apply = (states, allIn) => {
                    own(states, allIn);
                    for (const listener of this.listeners) listener(states, allIn);
                };
            }
            this.lastCheck = -Infinity;
            this.updateFog();
            return;
        }
        this.islands.push(island);
        this.lastCheck = -Infinity;
        this.allInNow = false;
        this.updateFog();
        spec.apply?.(island.states, false);
        if (this.lastEye.x !== Infinity) this.check(this.lastEye);
    }

    unregisterIsland(id: string, recheck = true) {
        if (id === this.primary.id) return;
        const at = this.islands.findIndex((island) => island.id === id);
        if (at < 0) return;
        this.islands.splice(at, 1);
        if (this.active?.id === id) this.active = this.primary;
        this.updateFog();
        if (recheck) this.lastCheck = -Infinity;
    }

    /** The islands registered (the first is the scene's own). */
    islandIds(): string[] {
        return this.islands.map((island) => island.id);
    }

    /** Mark the chunk at a world point as holding content (an animal's home, a prop). */
    markContent(x: number, z: number) {
        const island = this.islandFor(x, z);
        island.content[chunkOf(island.grid, x - island.offset.x, z - island.offset.z)] = 1;
    }

    /** The first island's states changed (the scene's own island). */
    onChange(listener: (states: Uint8Array, allIn: boolean) => void) {
        this.listeners.push(listener);
    }

    /** The first island's chunk state. */
    stateOf(chunk: number): number {
        return this.primary.states[chunk] ?? STATE_IN;
    }

    /** An island's chunk state (STATE_OUT for an island not registered). */
    islandStateOf(id: string, chunk: number): number {
        const island = this.islands.find((candidate) => candidate.id === id);
        return island ? island.states[chunk] ?? STATE_OUT : STATE_OUT;
    }

    /** The state at a world point: the island it is on, else (the strait, the open sea) the nearest island's edge chunk. */
    stateAt(x: number, z: number): number {
        if (this.allInNow) return STATE_IN;
        const island = this.islandFor(x, z);
        return island.states[chunkOf(island.grid, x - island.offset.x, z - island.offset.z)];
    }

    /** The island a world point is on (inside its grid's square), or null (the strait, the open sea). */
    islandAt(x: number, z: number): string | null {
        for (const island of this.islands) if (insideGrid(island, x, z, 0)) return island.id;
        return null;
    }

    /** Whether a first-island chunk is drawn at all (in full, or as the map). */
    drawn(chunk: number): boolean {
        return this.primary.states[chunk] !== STATE_OUT;
    }

    private islandFor(x: number, z: number): StreamIsland {
        if (this.islands.length === 1) return this.primary;
        let best = this.primary;
        let bestDistance = Infinity;
        for (const island of this.islands) {
            const d = distanceToGrid(island, x, z);
            if (d < bestDistance) {
                bestDistance = d;
                best = island;
            }
        }
        return best;
    }

    /** The base fog pushed out (decision 142) so every island reads across the water from the others' views. */
    private updateFog() {
        let reach = 0;
        for (const a of this.islands) {
            for (const b of this.islands) {
                if (a === b) continue;
                // From a's middle to b's farthest corner.
                const [ax0, az0, ax1, az1] = gridRect(a);
                const [bx0, bz0, bx1, bz1] = gridRect(b);
                const cx = (ax0 + ax1) / 2;
                const cz = (az0 + az1) / 2;
                reach = Math.max(reach, Math.hypot(Math.max(Math.abs(bx0 - cx), Math.abs(bx1 - cx)), Math.max(Math.abs(bz0 - cz), Math.abs(bz1 - cz))));
            }
        }
        this.fogReach = arkFogReach(reach, this.options.fogFrom);
        this.options.haze?.setClear?.(this.fogReach.near, this.fogReach.far);
    }

    /**
     * Every frame: the camera's eye, its distance to what it looks at (the map view from `MAP_VIEW_FROM`), the view's
     * vertical field of view (degrees) and aspect, seconds, and what it looks at (world; the island it is over is the
     * active one). Re-checks the states when the eye has moved or now and then; eases the haze every frame.
     */
    update(eye: {x: number; y: number; z: number}, toTarget: number, fov: number, aspect: number, now: number, target?: {x: number; z: number}) {
        const dt = Number.isFinite(this.lastFrame) ? Math.min(Math.max(now - this.lastFrame, 0), 0.25) : 0;
        this.lastFrame = now;
        if (this.options.memory && now - this.lastMemory >= MEMORY_SECONDS) {
            const elapsed = Number.isFinite(this.lastMemory) ? now - this.lastMemory : 0;
            this.lastMemory = now;
            this.reading = this.options.memory();
            const stepped = stepRenderScale(this.scale, this.reading, ARK_STREAM_TIERS[this.tierName], this.calmFor + elapsed, this.options.heapLimitMB ?? null);
            if (stepped.scale !== this.scale) this.lastCheck = -Infinity;
            this.scale = stepped.scale;
            this.calmFor = stepped.calmFor;
            if (stepped.drop) this.options.onDrop?.();
        }
        if (target && this.islands.length > 1) {
            this.lastTarget = {x: target.x, z: target.z};
            const fromCoast = (island: StreamIsland) => Math.hypot(target.x - island.offset.x, target.z - island.offset.z) - landReach(island);
            let over = this.active ?? this.primary;
            for (const island of this.islands) if (fromCoast(island) < fromCoast(over) - ACTIVE_HYSTERESIS) over = island;
            if (over !== this.active) {
                this.active = over;
                this.lastCheck = -Infinity;
            }
        }
        const mapNow = this.mapView ? toTarget >= MAP_VIEW_FROM - MAP_VIEW_HYSTERESIS : toTarget >= MAP_VIEW_FROM;
        const moved = Math.hypot(eye.x - this.lastEye.x, eye.y - this.lastEye.y, eye.z - this.lastEye.z);
        if (mapNow !== this.mapView || moved >= RECHECK_MOVE || now - this.lastCheck >= RECHECK_SECONDS) {
            this.mapView = mapNow;
            this.lastCheck = now;
            this.lastEye.x = eye.x;
            this.lastEye.y = eye.y;
            this.lastEye.z = eye.z;
            this.check(eye);
        }
        // The haze: on only while something with content lies past the map distance (never nearer), eased.
        let far = 0;
        for (const island of this.islands) far = Math.max(far, farthestContent(island.grid, island.spans, island.content, eye.x - island.offset.x, eye.y, eye.z - island.offset.z));
        const distance = this.mapDistance;
        const goal = hazeStrength(far, distance, this.mapView);
        const k = dt > 0 ? Math.min(dt / HAZE_SECONDS, 1) : 1;
        this.hazeNow += (goal - this.hazeNow) * k;
        if (Math.abs(this.hazeNow - goal) < 1e-3) this.hazeNow = goal;
        const end = hazeEndDepth(distance, fov, aspect);
        this.options.haze?.set(end * ARK_STREAM_TIERS[this.tierName].hazeStart, end, this.hazeNow);
    }

    private check(eye: {x: number; y: number; z: number}) {
        const tier = ARK_STREAM_TIERS[this.tierName];
        let allInEverywhere = true;
        for (const island of this.islands) {
            const next = chunkStates(island.grid, island.spans, {x: eye.x - island.offset.x, y: eye.y, z: eye.z - island.offset.z, distance: this.renderDistance, hysteresis: tier.hysteresis, mapDistance: this.mapDistance, capMap: island !== this.active}, island.states);
            let changed = false;
            let allIn = true;
            for (let key = 0; key < next.length; key++) {
                if (next[key] !== island.states[key]) changed = true;
                if (island.content[key] && next[key] !== STATE_IN) allIn = false;
            }
            if (!allIn) allInEverywhere = false;
            const allInChanged = allIn !== island.allIn;
            island.allIn = allIn;
            if (!changed && !allInChanged) continue;
            island.states = next;
            this.changes++;
            island.apply?.(island.states, allIn);
        }
        this.allInNow = allInEverywhere;
    }

    stats(): StreamStats {
        let inCount = 0;
        let mapCount = 0;
        let outCount = 0;
        let contentCount = 0;
        const islands: StreamStats["islands"] = {};
        for (const island of this.islands) {
            const row = {in: 0, map: 0, out: 0};
            for (let key = 0; key < island.states.length; key++) {
                if (island.states[key] === STATE_IN) row.in++;
                else if (island.states[key] === STATE_MAP) row.map++;
                else row.out++;
                if (island.content[key]) contentCount++;
            }
            islands[island.id] = row;
            inCount += row.in;
            mapCount += row.map;
            outCount += row.out;
        }
        return {
            tier: this.tierName,
            renderDistance: Math.round(this.renderDistance),
            mapDistance: Math.round(this.mapDistance),
            renderScale: Math.round(this.scale * 1000) / 1000,
            map: this.mapView,
            haze: Math.round(this.hazeNow * 1000) / 1000,
            active: this.activeIsland,
            chunks: {in: inCount, map: mapCount, out: outCount, content: contentCount},
            islands,
            fog: {...this.fogReach},
            changes: this.changes,
            memory: this.reading
        };
    }
}

/**
 * The base fog's clear-weather reach for a world whose islands reach `reach` m from one island's middle to the
 * farthest corner of another (decision 142: "visibly next to each other"): today's 420 → 1700 m for one island (reach
 * 0), pushed out in proportion beyond `from` m (700: v1's two islands, the other island's near half under ~5 % fog and
 * its far half under ~25 % from the first island's views; the world's frame may push it further, decision 234: v2's
 * `islands/views.ts` fogFrom) . Pure.
 */
export function arkFogReach(reach: number, from = 700): {near: number; far: number} {
    const scale = Math.max(1, reach / from);
    return {near: Math.round(CLEAR_FOG.near * scale), far: Math.round(CLEAR_FOG.far * scale)};
}

function landReach(island: {reach?: number; grid: ChunkGrid}): number {
    return island.reach ?? ((island.grid.columns * island.grid.size) / 2) * DEFAULT_REACH_SHARE;
}

function gridRect(island: {offset: {x: number; z: number}; grid: ChunkGrid}): [number, number, number, number] {
    const g = island.grid;
    return [island.offset.x + g.originX, island.offset.z + g.originZ, island.offset.x + g.originX + g.columns * g.size, island.offset.z + g.originZ + g.rows * g.size];
}

function insideGrid(island: {offset: {x: number; z: number}; grid: ChunkGrid}, x: number, z: number, margin: number): boolean {
    const [x0, z0, x1, z1] = gridRect(island);
    return x >= x0 - margin && x <= x1 + margin && z >= z0 - margin && z <= z1 + margin;
}

function distanceToGrid(island: {offset: {x: number; z: number}; grid: ChunkGrid}, x: number, z: number): number {
    const [x0, z0, x1, z1] = gridRect(island);
    const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
    const dz = z < z0 ? z0 - z : z > z1 ? z - z1 : 0;
    return Math.hypot(dx, dz);
}


/** Spans from a square grid of ground heights (`size` vertices a side over the grid's whole extent). */
export function spansFromHeights(grid: ChunkGrid, heights: ArrayLike<number>, size: number, headroom: number): ChunkSpan[] {
    const spans: ChunkSpan[] = [];
    const n = chunkCount(grid);
    for (let key = 0; key < n; key++) spans.push({minY: Infinity, maxY: -Infinity});
    const per = grid.segments;
    for (let row = 0; row < size; row++) {
        for (let column = 0; column < size; column++) {
            const h = heights[row * size + column];
            // A vertex on a chunk's edge belongs to both sides.
            for (const r of [Math.floor(row / per), row % per === 0 ? row / per - 1 : -1]) {
                if (r < 0 || r >= grid.rows) continue;
                for (const c of [Math.floor(column / per), column % per === 0 ? column / per - 1 : -1]) {
                    if (c < 0 || c >= grid.columns) continue;
                    const span = spans[r * grid.columns + c];
                    if (h < span.minY) span.minY = h;
                    if (h > span.maxY) span.maxY = h;
                }
            }
        }
    }
    return spans.map((span) => (Number.isFinite(span.minY) ? {minY: Math.min(span.minY, 0), maxY: Math.max(span.maxY, 0) + headroom} : DEFAULT_SPAN));
}
