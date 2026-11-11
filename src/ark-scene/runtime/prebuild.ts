/**
 * The mount's heavy, pure work done before it, in a worker (runtime lane, docs/ark/runtime.md §7): the decor, the
 * forest fill, the grass for the device's tier and the animals' places. The same seeded functions run in the worker,
 * so the results are identical (deep-equal tests: src/lib/ark-prebuild.test.ts); they are handed to the modules'
 * prime hooks (`primeDecor`, `primePlaces`), and `mountArk` then finds them done instead of spending seconds of one
 * main-thread task on them. Without workers (or if the worker fails) nothing is primed and the mount computes them
 * itself, as before.
 *
 *   await prepareArk({snapshot, workerUrl});   // then mountArk(el, {snapshot, ...})
 */

import {forestFill, grassTufts, primeDecor, worldDecor, type DecorItem, type FillItem, type GrassTuft} from "@/ark-scene/decor";
import {placeAnimals, primePlaces, type Placement} from "@/ark-scene/placement";
import {tierFor, type QualityTier} from "@/ark-scene/post";
import {GRASS_BUILD} from "@/ark-scene/runtime/budgets";
import {ARK_ZONES, type ArkAnimal, type ArkSnapshot, type ArkZone} from "@/ark-scene/types";

/** What the worker sends back. The grass is packed (56,000 small objects are slow to clone): six numbers and a zone each. */
export type ArkPrebuild = {
    decor: DecorItem[];
    fill: FillItem[];
    grass: {count: number; numbers: Float64Array; zones: Uint8Array};
    places: Array<[string, Placement]> | null;
    ms: number;
};

export type ArkPrebuildInput = {grass: number; animals: ArkAnimal[] | null};

/** The tier the scene will pick (the same rule as `mountArk`: a pinned `__arkQuality`, else the device's). */
export function arkStartTier(): QualityTier {
    const asked = (globalThis as {__arkQuality?: string}).__arkQuality;
    return asked === "high" || asked === "medium" || asked === "low" ? asked : tierFor();
}

export function packGrass(tufts: GrassTuft[], count: number): ArkPrebuild["grass"] {
    const numbers = new Float64Array(tufts.length * 6);
    const zones = new Uint8Array(tufts.length);
    tufts.forEach((tuft, i) => {
        numbers.set([tuft.x, tuft.y, tuft.z, tuft.scale, tuft.rotation, tuft.dry], i * 6);
        zones[i] = ARK_ZONES.indexOf(tuft.zone);
    });
    return {count, numbers, zones};
}

export function unpackGrass(grass: ArkPrebuild["grass"]): GrassTuft[] {
    const tufts: GrassTuft[] = new Array(grass.zones.length);
    for (let i = 0; i < grass.zones.length; i++) {
        const n = grass.numbers;
        const o = i * 6;
        tufts[i] = {x: n[o], y: n[o + 1], z: n[o + 2], scale: n[o + 3], rotation: n[o + 4], zone: ARK_ZONES[grass.zones[i]] as ArkZone, dry: n[o + 5]};
    }
    return tufts;
}

/** The work itself (in the worker; also the tests' and the fallback's). */
export function computeArkPrebuild(input: ArkPrebuildInput): ArkPrebuild {
    const started = Date.now();
    const decor = worldDecor();
    const fill = forestFill();
    const grass = packGrass(grassTufts(input.grass), input.grass);
    const places = input.animals ? Array.from(placeAnimals(input.animals).entries()) : null;
    return {decor, fill, grass, places, ms: Date.now() - started};
}

/** Hand a prebuild to the modules (the mount then uses it). `animals` must be the very array the mount is given. */
export function applyArkPrebuild(data: ArkPrebuild, animals: ArkAnimal[] | null): void {
    primeDecor({decor: data.decor, fill: data.fill, grass: {count: data.grass.count, tufts: unpackGrass(data.grass)}});
    if (animals && data.places) primePlaces(animals, new Map(data.places));
}

export type ArkPrepared = {where: "worker" | "skipped"; ms: number; workerMs?: number; error?: string};

/**
 * Do the mount's heavy work in a worker, then prime the modules. `workerUrl`: the built worker
 * (`public/ark/ark-prebuild-worker.js`, scripts/build-ark-bundle.mjs); absent, the site's own bundler's worker
 * (`new URL("./prebuild-worker.ts", import.meta.url)`). Resolves (never rejects) once primed, or at once with
 * `skipped` when there are no workers; the mount then does the work itself.
 */
export function prepareArk(options: {snapshot?: ArkSnapshot | null; workerUrl?: string; timeoutMs?: number} = {}): Promise<ArkPrepared> {
    const started = performance.now();
    const animals = options.snapshot?.animals ?? null;
    return new Promise((resolve) => {
        let worker: Worker | null = null;
        const done = (result: ArkPrepared) => {
            worker?.terminate();
            resolve(result);
        };
        try {
            if (typeof Worker === "undefined") return done({where: "skipped", ms: 0, error: "no workers"});
            worker = options.workerUrl ? new Worker(options.workerUrl) : new Worker(new URL("./prebuild-worker.ts", import.meta.url));
        } catch (error) {
            return done({where: "skipped", ms: Math.round(performance.now() - started), error: String(error)});
        }
        const timer = setTimeout(() => done({where: "skipped", ms: Math.round(performance.now() - started), error: "timeout"}), options.timeoutMs ?? 60_000);
        worker.onmessage = (event: MessageEvent<ArkPrebuild>) => {
            clearTimeout(timer);
            try {
                applyArkPrebuild(event.data, animals);
                done({where: "worker", ms: Math.round(performance.now() - started), workerMs: event.data.ms});
            } catch (error) {
                done({where: "skipped", ms: Math.round(performance.now() - started), error: String(error)});
            }
        };
        worker.onerror = (event) => {
            clearTimeout(timer);
            done({where: "skipped", ms: Math.round(performance.now() - started), error: String(event.message ?? "worker error")});
        };
        const input: ArkPrebuildInput = {grass: GRASS_BUILD[arkStartTier()], animals};
        worker.postMessage(input);
    });
}
