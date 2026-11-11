/**
 * The streamer (Part B, docs/ark/streaming.md): which chunks of the world are drawn, from the camera's eye, the
 * tier's render distance and the map view; the edge haze; the render distance pulled in under memory pressure.
 * The scene's parts that own chunks (the ground's tiles, the instanced plants, the asset trees and rocks, the props,
 * the animals) read it: `stateOf(chunk)`, `stateAt(x, z)`, and `onChange` when the states move.
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
import {ARK_STREAM_TIERS, forcedRenderDistance, MAP_VIEW_FROM, stepRenderScale, type MemoryReading, type StreamTierName} from "@/ark-scene/streaming/tiers";

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

export type StreamStats = {
    tier: StreamTierName;
    renderDistance: number;
    renderScale: number;
    map: boolean;
    haze: number;
    chunks: {in: number; map: number; out: number; content: number};
    changes: number;
    memory: MemoryReading | null;
};

export type StreamerOptions = {
    grid: ChunkGrid;
    spans: ChunkSpan[];
    /** Chunks holding something (land, plants, props, animals' places): the haze is on only while one lies beyond. */
    content: Uint8Array;
    tier: StreamTierName;
    haze: ArkHaze | null;
    /** What the page holds now (the scene's GPU estimate, the JS heap where the browser says it). */
    memory?: () => MemoryReading;
    heapLimitMB?: number | null;
    /** Memory pressure at the smallest distance: ask the scene for a lower tier. */
    onDrop?: () => void;
};

export class ArkStreamer {
    readonly grid: ChunkGrid;
    readonly spans: ChunkSpan[];
    readonly content: Uint8Array;
    private states: Uint8Array;
    private tierName: StreamTierName;
    private scale = 1;
    private calmFor = 0;
    private mapView = false;
    private hazeNow = 0;
    private lastCheck = -Infinity;
    private lastMemory = -Infinity;
    private lastFrame = -Infinity;
    private readonly lastEye = {x: Infinity, y: Infinity, z: Infinity};
    private changes = 0;
    private reading: MemoryReading | null = null;
    private allInNow = true;
    private readonly listeners: Array<(states: Uint8Array) => void> = [];

    constructor(private readonly options: StreamerOptions) {
        this.grid = options.grid;
        this.spans = options.spans;
        this.content = options.content;
        this.tierName = options.tier;
        this.states = new Uint8Array(chunkCount(this.grid)).fill(STATE_IN);
    }

    /** The render distance now (m): the tier's, times the memory scale (or a development override). */
    get renderDistance(): number {
        const tier = ARK_STREAM_TIERS[this.tierName];
        return forcedRenderDistance(tier) ?? tier.renderDistance * this.scale;
    }

    /** Every chunk with content is drawn in full: nothing to skip anywhere (today's island on medium and high). */
    get allIn(): boolean {
        return this.allInNow;
    }

    get map(): boolean {
        return this.mapView;
    }

    setTier(tier: StreamTierName) {
        if (tier === this.tierName) return;
        this.tierName = tier;
        this.scale = 1;
        this.calmFor = 0;
        this.lastCheck = -Infinity;
    }

    /** Mark the chunk at a point as holding content (an animal's home, a prop). */
    markContent(x: number, z: number) {
        this.content[chunkOf(this.grid, x, z)] = 1;
    }

    onChange(listener: (states: Uint8Array) => void) {
        this.listeners.push(listener);
    }

    stateOf(chunk: number): number {
        return this.states[chunk] ?? STATE_IN;
    }

    stateAt(x: number, z: number): number {
        return this.allInNow ? STATE_IN : this.states[chunkOf(this.grid, x, z)];
    }

    /** Whether a chunk is drawn at all (in full, or as the map). */
    drawn(chunk: number): boolean {
        return this.states[chunk] !== STATE_OUT;
    }

    /**
     * Every frame: the camera's eye, its distance to what it looks at (the map view from `MAP_VIEW_FROM`), the view's
     * vertical field of view (degrees) and aspect, seconds. Re-checks the states when the eye has moved or now and
     * then; eases the haze every frame.
     */
    update(eye: {x: number; y: number; z: number}, toTarget: number, fov: number, aspect: number, now: number) {
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
        // The haze: on only while something with content lies past the distance, eased.
        const distance = this.renderDistance;
        const target = hazeStrength(farthestContent(this.grid, this.spans, this.content, eye.x, eye.y, eye.z), distance, this.mapView);
        const k = dt > 0 ? Math.min(dt / HAZE_SECONDS, 1) : 1;
        this.hazeNow += (target - this.hazeNow) * k;
        if (Math.abs(this.hazeNow - target) < 1e-3) this.hazeNow = target;
        const end = hazeEndDepth(distance, fov, aspect);
        this.options.haze?.set(end * ARK_STREAM_TIERS[this.tierName].hazeStart, end, this.hazeNow);
    }

    private check(eye: {x: number; y: number; z: number}) {
        const tier = ARK_STREAM_TIERS[this.tierName];
        const next = chunkStates(this.grid, this.spans, {x: eye.x, y: eye.y, z: eye.z, distance: this.renderDistance, hysteresis: tier.hysteresis, map: this.mapView}, this.states);
        let changed = false;
        let allIn = true;
        for (let key = 0; key < next.length; key++) {
            if (next[key] !== this.states[key]) changed = true;
            if (this.content[key] && next[key] !== STATE_IN) allIn = false;
        }
        this.allInNow = allIn;
        if (!changed) return;
        this.states = next;
        this.changes++;
        for (const listener of this.listeners) listener(this.states);
    }

    stats(): StreamStats {
        let inCount = 0;
        let mapCount = 0;
        let outCount = 0;
        let contentCount = 0;
        for (let key = 0; key < this.states.length; key++) {
            if (this.states[key] === STATE_IN) inCount++;
            else if (this.states[key] === STATE_MAP) mapCount++;
            else outCount++;
            if (this.content[key]) contentCount++;
        }
        return {
            tier: this.tierName,
            renderDistance: Math.round(this.renderDistance),
            renderScale: Math.round(this.scale * 1000) / 1000,
            map: this.mapView,
            haze: Math.round(this.hazeNow * 1000) / 1000,
            chunks: {in: inCount, map: mapCount, out: outCount, content: contentCount},
            changes: this.changes,
            memory: this.reading
        };
    }
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
