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
import {noHamlet, noHamletFor, setNoHamlet} from "@/ark-scene/no-hamlet";
import {arkTwoIslands} from "@/lib/ark-islands";
import {placeAnimals, primePlaces, primePlacesFor, type Placement} from "@/ark-scene/placement";
import {primeZoneCapacities} from "@/ark-scene/map/capacity";
import {primeReefGrowth} from "@/ark-scene/reef";
import {primeFloorPlacements} from "@/ark-scene/floor-assets";
import {primeMountainRocks} from "@/ark-scene/rock-layout";
import {primeSavannaMounds} from "@/ark-scene/mounds";
import {primeRockPlacements} from "@/ark-scene/rock-assets";
import {primeTreePlacements} from "@/ark-scene/tree-pick";
import {primeWheatStands} from "@/ark-scene/near-detail";
import type {ArkZone} from "@/ark-scene/types";
import {arkWorld} from "@/ark-scene/world";

/**
 * A prebuild worker's URL for the world in use (docs/ark/wild-island.md §Integration): a v2 world's worker is told so in
 * its URL (`?world=v2`), which `world.ts` reads as it loads, before any of the worker's modules build from the world.
 */
function forWorld(url: string): string {
    return arkWorld() === "v2" ? `${url}${url.includes("?") ? "&" : "?"}world=v2` : url;
}
import {tierFor, type QualityTier} from "@/ark-scene/post";
import {GRASS_BUILD} from "@/ark-scene/runtime/budgets";
import {computeScenery, packGrass, primeGroundIfAble, unpackGrass, type ArkSceneryPrebuild} from "@/ark-scene/runtime/prebuild-scenery";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";

export {packGrass, unpackGrass};

/** From this many animals the places go to a worker: every Ark (the map's sampler is then never built in the mount). */
export const PLACES_IN_WORKER_FROM = 0;

export type ArkPrebuild = ArkSceneryPrebuild & {places: Array<[string, Placement]> | null; capacities?: Array<[ArkZone, number]> | null};
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
    if (data.reef) primeReefGrowth(data.reef);
    if (data.floor) primeFloorPlacements(data.floor);
    if (data.wheat) primeWheatStands(data.wheat);
    // The bigger wild island (P3): its mountain's rocks and its savanna's mounds, laid in the worker.
    if (data.mountain) primeMountainRocks(data.mountain);
    if (data.mounds) primeSavannaMounds(data.mounds);
    if (data.decor && data.rocks) primeRockPlacements(data.decor, data.rocks);
    if (data.decor && data.fill && data.trees) {
        primeTreePlacements(data.decor, data.trees.decor);
        primeTreePlacements(data.fill, data.trees.fill);
    }
    if (animals && data.places) primePlaces(animals, new Map(data.places));
    if (data.capacities) primeZoneCapacities(data.capacities);
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
 * Do the mount's heavy work in workers, then prime the modules. `workerUrl` / `placesWorkerUrl`: the built workers,
 * by default the site's `/ark/ark-prebuild-worker.js` and `/ark/ark-prebuild-places-worker.js` (scripts/build-ark-bundle.mjs,
 * run by `npm run build`'s prebuild; the same files the apps' embed loads). Missing (`next dev` without
 * `npm run build:ark`): the worker fails and the mount computes as before. Resolves (never rejects).
 */
export async function prepareArk(options: {snapshot?: ArkSnapshot | null; workerUrl?: string; placesWorkerUrl?: string; timeoutMs?: number} = {}): Promise<ArkPrepared> {
    const started = performance.now();
    // Islands mode (`no-hamlet.ts`, decision 148): the wild island without its hamlet when the read has two islands
    // (T3's `arkTwoIslands`). Set here first, so what is primed is the world `mountArk` (which sets the same) builds.
    const wild = noHamletFor(arkTwoIslands(options.snapshot));
    setNoHamlet(wild);
    if (typeof Worker === "undefined") return {where: "skipped", ms: 0, error: "no workers"};
    const animals = options.snapshot?.animals ?? null;
    const timeout = options.timeoutMs ?? 60_000;
    const scenery = ask<ArkSceneryPrebuild>(() => new Worker(forWorld(options.workerUrl ?? "/ark/ark-prebuild-worker.js")), {grass: GRASS_BUILD[arkStartTier()], tier: arkStartTier(), noHamlet: wild}, timeout);
    const big = Boolean(animals && animals.length >= PLACES_IN_WORKER_FROM);
    const places = big
        ? ask<{places: Array<[string, Placement]>; capacities?: Array<[ArkZone, number]>}>(() => new Worker(forWorld(options.placesWorkerUrl ?? "/ark/ark-prebuild-places-worker.js")), {animals, noHamlet: wild}, timeout)
        : Promise.resolve({data: null as {places: Array<[string, Placement]>; capacities?: Array<[ArkZone, number]>} | null, error: undefined});
    const [a, b] = await Promise.all([scenery, places]);
    try {
        applyArkPrebuild({...(a.data ?? {}), places: b.data?.places ?? null, capacities: b.data?.capacities ?? null}, animals);
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

/**
 * A replay's departed animals (`handle.prepareReplay`): placed in the places worker and handed to `placeAnimals`
 * for that very list (same ids, same order), so `play` does not build the map's sampler on the main thread.
 */
export async function prepareGhostPlaces(animals: ArkAnimal[], placesWorkerUrl = "/ark/ark-prebuild-places-worker.js"): Promise<boolean> {
    if (typeof Worker === "undefined" || !animals.length) return false;
    const answer = await ask<{places: Array<[string, Placement]>}>(() => new Worker(forWorld(placesWorkerUrl)), {animals, noHamlet: noHamlet()}, 30_000);
    if (!answer.data) return false;
    primePlacesFor(animals, new Map(answer.data.places));
    return true;
}
