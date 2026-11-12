/**
 * The town's prebuild (decision 153: the town is built off the page's first frame): its pure, heavy work in a worker,
 * handed back and primed into the town's modules, so the main thread only makes meshes (in idle slices, `islands/scene.ts`).
 *
 * The worker (`prebuild-worker.ts`, built as `public/ark/ark-town-worker.js` by `scripts/build-ark-bundle.mjs`) works out:
 * the plan, the placement areas, the ground's grid, the scenery with every building and the open enclosures' zoo, the
 * town animals' places, the behaviour world's raster and places, and the colliders. The geometry's arrays come back as
 * typed arrays (transferred). Without workers (or without the built file, `next dev` before `npm run build:ark`), the
 * same work runs on the main thread as before.
 */

import type {ArkAnimal} from "@/ark-scene/types";
import type {Collider} from "@/ark-scene/collide";
import type {TownPlan} from "@/ark-scene/islands/town/plan";
import type {TownAreas} from "@/ark-scene/islands/town/areas";
import type {TownBuildData} from "@/ark-scene/islands/town/render/index";
import type {TownPlace} from "@/ark-scene/islands/town/placement";
import type {Placement} from "@/ark-scene/placement";
import type {TownSamplerData} from "@/ark-scene/islands/town/sampler";

/** `hold`: the worker keeps its answer until the page sends `{type: "send"}` (`startTown`'s `collect`). */
export type TownPrebuildRequest = {animals: ArkAnimal[]; origin: {x: number; z: number}; open: string[]; hold?: boolean};

export type TownPrebuild = {
    plan: TownPlan;
    areas: TownAreas;
    built: TownBuildData;
    placed: {places: Array<[string, Placement]>; town: Array<[string, TownPlace]>; open: string[]};
    sampler: TownSamplerData;
    colliders: Collider[];
    ms: number;
    /** Each step's time in the worker (ms): plan, areas, ground, scenery, buildings, zoo, places, raster, colliders, pack. */
    steps?: Record<string, number>;
};

type GeoLike = {pos: ArrayLike<number>; nor: ArrayLike<number>; col: ArrayLike<number>; extra: ArrayLike<number>};

function isGeo(value: unknown): value is GeoLike {
    return Boolean(value && typeof value === "object" && "pos" in value && "nor" in value && "col" in value && "extra" in value);
}

/** Every Geo in the build data (scenery chunks, buildings, the zoo, the fresh water), each once. */
function geosOf(built: TownBuildData): GeoLike[] {
    const out = new Set<GeoLike>();
    const visit = (value: unknown, depth: number) => {
        if (!value || typeof value !== "object" || depth > 4) return;
        if (isGeo(value)) {
            out.add(value);
            return;
        }
        if (value instanceof Map) {
            value.forEach((v) => visit(v, depth + 1));
            return;
        }
        if (Array.isArray(value) || ArrayBuffer.isView(value)) return;
        for (const v of Object.values(value as Record<string, unknown>)) visit(v, depth + 1);
    };
    visit(built.scenery, 0);
    visit(built.perChunk, 0);
    visit(built.zoo, 0);
    return Array.from(out);
}

/** In the worker: the geometry's arrays as Float32Arrays (transferred, not copied), and the buffers to transfer. */
export function packTownBuild(built: TownBuildData): ArrayBuffer[] {
    const buffers: ArrayBuffer[] = [built.grid.heights.buffer as ArrayBuffer, built.grid.colours.buffer as ArrayBuffer];
    for (const geo of geosOf(built)) {
        const g = geo as unknown as Record<string, ArrayLike<number>>;
        for (const key of ["pos", "nor", "col", "extra"]) {
            const typed = Float32Array.from(g[key] as ArrayLike<number>);
            g[key] = typed;
            buffers.push(typed.buffer);
        }
    }
    return buffers;
}

/** On the main thread: the Geo objects given their class back (their arrays stay typed: `toGeometry` copies them). */
export function unpackTownBuild(built: TownBuildData, proto: object): void {
    for (const geo of geosOf(built)) Object.setPrototypeOf(geo, proto);
}

/**
 * The town's worker, asked now: it works at once and keeps its answer until `collect` asks for it, so nothing of the
 * town lands on the page's main thread before then (null on any failure; `timeoutMs` counts from `collect`).
 */
function ask(url: string, message: TownPrebuildRequest): {collect: (timeoutMs: number) => Promise<TownPrebuild | null>; cancel: () => void; ready: Promise<boolean>} {
    let worker: Worker | null = null;
    let settle: ((data: TownPrebuild | null) => void) | null = null;
    let early: TownPrebuild | null | undefined;
    let isReady: (done: boolean) => void = () => undefined;
    const ready = new Promise<boolean>((resolve) => (isReady = resolve));
    const finish = (data: TownPrebuild | null) => {
        worker?.terminate();
        worker = null;
        isReady(data !== null);
        if (settle) settle(data);
        else if (early === undefined) early = data;
    };
    try {
        worker = new Worker(url);
        worker.onmessage = (event: MessageEvent<TownPrebuild | {error: string} | {type: "ready"}>) => {
            if ("type" in event.data && event.data.type === "ready") return isReady(true);
            finish("error" in event.data ? null : (event.data as TownPrebuild));
        };
        worker.onerror = () => finish(null);
        worker.postMessage({...message, hold: true});
    } catch {
        finish(null);
    }
    return {
        collect: (timeoutMs) =>
            new Promise<TownPrebuild | null>((resolve) => {
                if (early !== undefined) return resolve(early);
                const timer = setTimeout(() => finish(null), timeoutMs);
                settle = (data) => {
                    clearTimeout(timer);
                    settle = null;
                    resolve(data);
                };
                worker?.postMessage({type: "send"});
            }),
        cancel: () => finish(null),
        ready
    };
}

export type TownPrepared = {
    built: TownBuildData | null;
    sampler: TownSamplerData | null;
    colliders: Collider[] | null;
    where: "worker" | "main";
    /** From asking the worker to the answer primed (ms). */
    ms: number;
    /** The worker's own time (ms) and each of its steps; how long the answer waited for `collect`, and the priming. */
    worker?: {ms: number; steps: Record<string, number>; collectedAfter: number; waited: number; prime: number};
};

/**
 * The town's worker started (`startTown`): `ready` once it has worked it out (true) or failed (false); `collect` asks
 * for its answer and primes it into the town's modules (the same promise if asked again).
 */
export type TownStart = {collect: () => Promise<TownPrepared>; cancel: () => void; ready: Promise<boolean>};

/**
 * The town's heavy work started in its worker now (decision 153: before the wild island's first frame is fine, it is
 * another thread); `collect`, after the first frame, takes its answer and primes the town's modules (plan, areas,
 * the animals' places). `collect` resolves (never rejects); with no worker, nothing is primed and the town builds as
 * before.
 */
export function startTown(request: TownPrebuildRequest, options: {workerUrl?: string; timeoutMs?: number} = {}): TownStart {
    const started = performance.now();
    if (typeof Worker === "undefined") return {collect: () => Promise.resolve({built: null, sampler: null, colliders: null, where: "main", ms: 0}), cancel: () => undefined, ready: Promise.resolve(false)};
    const asked = ask(options.workerUrl ?? "/ark/ark-town-worker.js", request);
    let collecting: Promise<TownPrepared> | null = null;
    const collect = async (): Promise<TownPrepared> => {
        const collected = performance.now();
        const answer = await asked.collect(options.timeoutMs ?? 90_000);
        if (!answer) return {built: null, sampler: null, colliders: null, where: "main", ms: Math.round(performance.now() - started)};
        const answered = performance.now();
        const [{primeTownPlan}, {primeTownAreas}, {primeTownPlacements, townPlacementKey}, {Geo}] = await Promise.all([
            import("@/ark-scene/islands/town/plan"),
            import("@/ark-scene/islands/town/areas"),
            import("@/ark-scene/islands/town/placement"),
            import("@/ark-scene/islands/town/render/kit")
        ]);
        primeTownPlan(answer.plan);
        primeTownAreas(answer.areas);
        unpackTownBuild(answer.built, Geo.prototype);
        primeTownPlacements(townPlacementKey(request.animals), {places: new Map(answer.placed.places), town: new Map(answer.placed.town), open: answer.placed.open}, request.animals);
        const done = performance.now();
        return {
            built: answer.built,
            sampler: answer.sampler,
            colliders: answer.colliders,
            where: "worker",
            ms: Math.round(done - started),
            worker: {ms: answer.ms, steps: answer.steps ?? {}, collectedAfter: Math.round(collected - started), waited: Math.round(answered - collected), prime: Math.round(done - answered)}
        };
    };
    return {cancel: asked.cancel, ready: asked.ready, collect: () => (collecting ??= collect())};
}

/** The town's heavy work in its worker, collected as soon as it is done (`startTown` then `collect`). */
export function prepareTown(request: TownPrebuildRequest, options: {workerUrl?: string; timeoutMs?: number} = {}): Promise<TownPrepared> {
    return startTown(request, options).collect();
}
