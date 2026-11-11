/**
 * The mount's heavy, pure work done before it, in workers (runtime lane, docs/ark/runtime.md §7): the decor, the
 * forest fill and the grass for the device's tier (the scenery worker, ~20 KB), and a big Ark's places (the places
 * worker, only from `PLACES_IN_WORKER_FROM` animals: it carries the species data). The same seeded functions run in
 * the workers, so the results are identical (deep-equal tests: src/lib/ark-prebuild.test.ts); they are handed to
 * the modules' prime hooks (`primeDecor`, `primePlaces`) and `mountArk` finds them done. Without workers (or if one
 * fails) nothing of its part is primed and the mount computes it itself, as before.
 *
 *   await prepareArk({snapshot, workerUrl, placesWorkerUrl});   // then mountArk(el, {snapshot, ...})
 */

import {primeDecor} from "@/ark-scene/decor";
import {placeAnimals, primePlaces, type Placement} from "@/ark-scene/placement";
import {tierFor, type QualityTier} from "@/ark-scene/post";
import {GRASS_BUILD} from "@/ark-scene/runtime/budgets";
import {computeScenery, packGrass, primeGroundIfAble, unpackGrass, type ArkSceneryPrebuild} from "@/ark-scene/runtime/prebuild-scenery";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";

export {packGrass, unpackGrass};

/** From this many animals the places are worth a worker (below, ~0.1 s on the main thread). */
export const PLACES_IN_WORKER_FROM = 1000;

export type ArkPrebuild = ArkSceneryPrebuild & {places: Array<[string, Placement]> | null};
export type ArkPrebuildInput = {grass: number; animals: ArkAnimal[] | null; tier?: QualityTier};

/** The tier the scene will pick (the same rule as `mountArk`: a pinned `__arkQuality`, else the device's). */
export function arkStartTier(): QualityTier {
    const asked = (globalThis as {__arkQuality?: string}).__arkQuality;
    return asked === "high" || asked === "medium" || asked === "low" ? asked : tierFor();
}

/** All of it at once (the tests; what the two workers do between them). */
export function computeArkPrebuild(input: ArkPrebuildInput): ArkPrebuild {
    const scenery = computeScenery(input.grass, input.tier);
    return {...scenery, places: input.animals ? Array.from(placeAnimals(input.animals).entries()) : null};
}

/** Hand a prebuild to the modules (the mount then uses it). `animals` must be the very array the mount is given. */
export function applyArkPrebuild(data: Partial<ArkPrebuild>, animals: ArkAnimal[] | null): void {
    if (data.decor && data.fill && data.grass) primeDecor({decor: data.decor, fill: data.fill, grass: {count: data.grass.count, tufts: unpackGrass(data.grass)}});
    primeGroundIfAble(data.ground);
    if (animals && data.places) primePlaces(animals, new Map(data.places));
}

export type ArkPrepared = {where: "worker" | "skipped"; ms: number; workerMs?: number; places?: "worker" | "main"; error?: string};

/** One worker's answer (null on any failure or timeout). */
function ask<T>(make: () => Worker, message: unknown, timeoutMs: number): Promise<{data: T | null; error?: string}> {
    return new Promise((resolve) => {
        let worker: Worker | null = null;
        const finish = (data: T | null, error?: string) => {
            worker?.terminate();
            resolve({data, error});
        };
        try {
            worker = make();
        } catch (error) {
            return finish(null, String(error));
        }
        const timer = setTimeout(() => finish(null, "timeout"), timeoutMs);
        worker.onmessage = (event: MessageEvent<T>) => {
            clearTimeout(timer);
            finish(event.data);
        };
        worker.onerror = (event) => {
            clearTimeout(timer);
            finish(null, String(event.message ?? "worker error"));
        };
        worker.postMessage(message);
    });
}

/**
 * Do the mount's heavy work in workers, then prime the modules. `workerUrl` / `placesWorkerUrl`: the built workers
 * (`public/ark/ark-prebuild-worker.js`, `ark-prebuild-places-worker.js`, scripts/build-ark-bundle.mjs); absent, the
 * site's bundler's own (`new URL(..., import.meta.url)`). Resolves (never rejects) once primed, or with `skipped`.
 */
export async function prepareArk(options: {snapshot?: ArkSnapshot | null; workerUrl?: string; placesWorkerUrl?: string; timeoutMs?: number} = {}): Promise<ArkPrepared> {
    const started = performance.now();
    if (typeof Worker === "undefined") return {where: "skipped", ms: 0, error: "no workers"};
    const animals = options.snapshot?.animals ?? null;
    const timeout = options.timeoutMs ?? 60_000;
    const scenery = ask<ArkSceneryPrebuild>(() => (options.workerUrl ? new Worker(options.workerUrl) : new Worker(new URL("./prebuild-worker.ts", import.meta.url))), {grass: GRASS_BUILD[arkStartTier()], tier: arkStartTier()}, timeout);
    const big = Boolean(animals && animals.length >= PLACES_IN_WORKER_FROM);
    const places = big
        ? ask<{places: Array<[string, Placement]>}>(() => (options.placesWorkerUrl ? new Worker(options.placesWorkerUrl) : new Worker(new URL("./prebuild-places-worker.ts", import.meta.url))), {animals}, timeout)
        : Promise.resolve({data: null as {places: Array<[string, Placement]>} | null, error: undefined});
    const [a, b] = await Promise.all([scenery, places]);
    try {
        applyArkPrebuild({...(a.data ?? {}), places: b.data?.places ?? null}, animals);
    } catch (error) {
        return {where: "skipped", ms: Math.round(performance.now() - started), error: String(error)};
    }
    return {
        where: a.data ? "worker" : "skipped",
        ms: Math.round(performance.now() - started),
        workerMs: a.data?.ms,
        places: big && b.data ? "worker" : "main",
        error: a.error ?? b.error
    };
}
