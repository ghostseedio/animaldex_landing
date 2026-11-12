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

export type TownPrebuildRequest = {animals: ArkAnimal[]; origin: {x: number; z: number}; open: string[]};

export type TownPrebuild = {
    plan: TownPlan;
    areas: TownAreas;
    built: TownBuildData;
    placed: {places: Array<[string, Placement]>; town: Array<[string, TownPlace]>; open: string[]};
    sampler: TownSamplerData;
    colliders: Collider[];
    ms: number;
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

/** One answer from the town's worker (null on any failure or timeout). */
function ask(url: string, message: TownPrebuildRequest, timeoutMs: number): Promise<TownPrebuild | null> {
    return new Promise((resolve) => {
        let worker: Worker | null = null;
        const finish = (data: TownPrebuild | null) => {
            worker?.terminate();
            resolve(data);
        };
        try {
            worker = new Worker(url);
        } catch {
            return finish(null);
        }
        const timer = setTimeout(() => finish(null), timeoutMs);
        worker.onmessage = (event: MessageEvent<TownPrebuild | {error: string}>) => {
            clearTimeout(timer);
            finish("error" in event.data ? null : event.data);
        };
        worker.onerror = () => {
            clearTimeout(timer);
            finish(null);
        };
        worker.postMessage(message);
    });
}

export type TownPrepared = {built: TownBuildData | null; sampler: TownSamplerData | null; colliders: Collider[] | null; where: "worker" | "main"; ms: number};

/**
 * The town's heavy work in its worker, primed into the town's modules (plan, areas, the animals' places). Resolves
 * (never rejects); with no worker, nothing is primed and the town builds as before.
 */
export async function prepareTown(request: TownPrebuildRequest, options: {workerUrl?: string; timeoutMs?: number} = {}): Promise<TownPrepared> {
    const started = performance.now();
    if (typeof Worker === "undefined") return {built: null, sampler: null, colliders: null, where: "main", ms: 0};
    const answer = await ask(options.workerUrl ?? "/ark/ark-town-worker.js", request, options.timeoutMs ?? 90_000);
    if (!answer) return {built: null, sampler: null, colliders: null, where: "main", ms: Math.round(performance.now() - started)};
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
    return {built: answer.built, sampler: answer.sampler, colliders: answer.colliders, where: "worker", ms: Math.round(performance.now() - started)};
}
