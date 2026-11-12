/**
 * Part C, the two islands on the page (decisions 141-142; the owner: "the second island should be pannable from the
 * first island, they should be visibly next to each other"): **one world with both islands in it**. The town stands
 * across a 250 m strait from the wild island (`islands/index.ts` townWorldOrigin); the camera pans, zooms and flies freely
 * across both; the island switch, `?focus=` and "My animals" are camera flights. Part B's streaming draws the island the
 * view is over in full and the other in map style.
 *
 * This wraps `mountArk` for the page: with the server's `islands` switch off (one island) it is `mountArk` exactly as
 * before; with it on, the town's world is built first (`islands/scene.ts`), then the one scene with both islands' animals.
 */

import type {ArkIsland, ArkSceneHandle, ArkSceneOptions, ArkSnapshot} from "@/ark-scene/types";
import {arkIslandOf, arkIslandSnapshot, arkTwoIslands} from "@/lib/ark-islands";
import type {ArkIslandScene} from "@/ark-scene/islands/scene";
import type {TownPrepared, TownStart} from "@/ark-scene/islands/town/prebuild";

export type ArkArchipelagoOptions = ArkSceneOptions & {
    /** The island to open on (decision 26 is the page's: `arkOpeningIsland`); default the wild island. */
    openOn?: ArkIsland;
    /** The island the view is over (the switch's state); `crossing` while a flight between them is under way. */
    onIsland?: (island: ArkIsland, crossing: boolean) => void;
    /**
     * Where the prebuild workers are (the apps' embed: `./ark-prebuild-worker.js`…, beside `embed.html`); default the
     * site's `/ark/…` files.
     */
    workers?: {scenery?: string; places?: string; town?: string};
};

export type ArkArchipelagoHandle = ArkSceneHandle & {
    /** The island the view is over now. */
    island: () => ArkIsland;
    /** Whether the Ark has two islands now (the server's switch). */
    twoIslands: () => boolean;
    /** Fly to an island's whole view (then `select` an animal there, if asked). */
    crossTo: (island: ArkIsland, then?: {select?: string | null; closeUp?: boolean}) => Promise<void>;
    /** A flight between the islands under way. */
    crossing: () => boolean;
    /** The town is in the one world (decision 153: built after the wild island's first frame); true with one island. */
    attached: () => boolean;
    /**
     * Where the town's time went (the worker and each of its steps, the sliced build, the attach), ms from the page's
     * start; also marked as `ark:town:joined` (performance.mark, its detail) for a production build's measurements.
     */
    townTimings: () => Record<string, unknown> | null;
    /** Resolves once the scene is up (the wild island's first mount); the apps' embed hands its held messages over then. */
    mounted: () => Promise<void>;
};

/** The town's last idle waits (ms at most), as its build's (`islands/scene.ts` TOWN_IDLE_TIMEOUT_MS; not imported: that module loads on demand). */
const TOWN_IDLE_TIMEOUT_MS = 34;

/** A flight across the strait takes about this long (`flyToIsland`). */
const CROSS_SECONDS = 3.4;

export function mountArchipelago(el: HTMLElement, options: ArkArchipelagoOptions): ArkArchipelagoHandle {
    let whole: ArkSnapshot = options.snapshot;
    const two = arkTwoIslands(whole);
    let near: ArkIsland = two ? options.openOn ?? "wild" : "wild";
    let scene: ArkSceneHandle | null = null;
    let town: ArkIslandScene | null = null;
    let disposed = false;
    let flying = false;
    let pendingSelect: {id: string; closeUp?: boolean} | null = null;
    /** All the town's animals in the scene (they join a few hundred at a time after the attach). */
    let joined = false;
    const pending: Array<[string, unknown[]]> = [];
    const tierGuess = (): "high" | "medium" | "low" => (window.matchMedia?.("(pointer: coarse)").matches ? "low" : "medium");

    /** The town in the one world yet (decision 153: it is built after the wild island's first frame). */
    let attached = false;
    let timings: Record<string, unknown> | null = null;
    let attaching = false;
    let tier: "high" | "medium" | "low" = tierGuess();
    /**
     * The town's worker, started with the wild island's prebuild (it is another thread). Its answer is held in the
     * worker until the main thread is free for it: while it only waits for the wild island's workers, else after the
     * first frame (`makeTown`).
     */
    let townWork: Promise<{start: TownStart; animals: ArkSnapshot["animals"]; origin: {x: number; z: number}; at: number}> | null = null;
    const startTownWork = () =>
        (townWork ??= Promise.all([import("@/ark-scene/islands/town/prebuild"), import("@/ark-scene/islands/town/areas"), import("@/ark-scene/islands")]).then(([{startTown}, {enclosuresIn, launchEnclosures}, {townWorldOrigin}]) => {
            const animals = arkIslandSnapshot(whole, "town").animals;
            const open = enclosuresIn(animals);
            const origin = townWorldOrigin();
            const at = performance.now();
            const start = startTown({animals, origin, open: open.length ? open : launchEnclosures()}, options.workers?.town ? {workerUrl: options.workers.town} : {});
            return {start, animals, origin, at};
        }));
    /**
     * The town's meshes, made from its worker's answer in idle slices of about 8 ms (`loadTownScene`): while the wild
     * island's own workers run when the answer is in by then (the main thread only waits for them), else after the
     * first frame. It joins the live scene only after the first frame (`attachTown`). Its tier is set again then.
     */
    let townMade: Promise<{built: ArkIslandScene; prepared: TownPrepared; t0: number; t1: number; tLoaded: number; tDone: number; collidersMs: number; samplerMs: number} | null> | null = null;
    /** The wild island's first frame drawn (the town's slices then go between tasks, not idle moments). */
    let firstFrame = false;
    let firstFrameDrawn: () => void = () => undefined;
    const firstFrameSeen = new Promise<void>((resolve) => (firstFrameDrawn = resolve));
    /** When the wild island's prebuild was done (ms from the page's start). */
    let wildPreparedAt = 0;
    /** An idle moment, or about two frames at most. */
    const idle = () => new Promise<void>((resolve) => ((globalThis as {requestIdleCallback?: (cb: () => void, o?: {timeout: number}) => number}).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 16)))(() => resolve(), {timeout: TOWN_IDLE_TIMEOUT_MS}));
    const makeTown = () =>
        (townMade ??= (async () => {
            const [{loadTownScene, nextTask}, work] = await Promise.all([import("@/ark-scene/islands/scene"), startTownWork()]);
            const prepared = await work.start.collect();
            // (Without the worker's answer the town is all worked out on the main thread: never before the first frame.)
            if (prepared.where !== "worker" && !firstFrame) await firstFrameSeen;
            if (disposed) return null;
            const t1 = performance.now();
            // (Before the live scene draws, its idle moments; after, between its tasks: idle moments are rare then.)
            const between = firstFrame ? "task" : "idle";
            const pause = firstFrame ? nextTask : idle;
            const built = await loadTownScene({tier, animals: work.animals, origin: work.origin, prepared, sliceMs: 8, between});
            const tLoaded = performance.now();
            // (Its colliders and its behaviour world's places, each in a slice of its own.)
            await pause();
            let tc = performance.now();
            if (!disposed) built.colliders();
            const collidersMs = performance.now() - tc;
            await pause();
            tc = performance.now();
            if (!disposed) built.sampler();
            const samplerMs = performance.now() - tc;
            if (disposed) {
                built.dispose();
                return null;
            }
            return {built, prepared, t0: work.at, t1, tLoaded, tDone: performance.now(), collidersMs, samplerMs};
        })());
    /** The town into the live scene after the wild island's first frame (made by then, or made now), in a task of its own. */
    const attachTown = async () => {
        if (attaching || attached || disposed || !two) return;
        attaching = true;
        firstFrame = true;
        firstFrameDrawn();
        const ready = performance.now();
        const made = await makeTown();
        if (!made) return;
        const {prepared, t0, t1, tLoaded, tDone, collidersMs, samplerMs} = made;
        town = made.built;
        if (disposed || !scene?.attachIsland) {
            town?.dispose();
            return;
        }
        // (Then the attach, a task of its own right after the first frame's (`nextTask`): an idle wait here ran about 1.2 s
        // late on the phone profile, the live scene's frames leaving no idle moments.)
        const tMade = performance.now();
        await (await import("@/ark-scene/islands/scene")).nextTask();
        if (disposed || !scene?.attachIsland) {
            town.dispose();
            return;
        }
        const t2 = performance.now();
        scene.attachIsland(town, whole, () => {
            joined = true;
            // (A focus link to a town animal, waiting until it is in the scene.)
            if (pendingSelect && scene) {
                const {id, closeUp} = pendingSelect;
                pendingSelect = null;
                scene.select(id, closeUp);
            }
        });
        attached = true;
        // (Where the town's time went: the worker and its steps, the sliced build, the one attach task.)
        const t3 = performance.now();
        timings = {
            prebuild: Math.round(t1 - t0),
            where: prepared.where,
            worker: prepared.worker ?? null,
            // (From the answer to the made town: its meshes, colliders and behaviour world.)
            build: Math.round(tDone - t1),
            load: town.buildStats ?? null,
            loadWall: Math.round(tLoaded - t1),
            // (From the first frame: waiting for the made town, if it was not made by then; then the wait for the attach.)
            afterFirstFrame: {waitedForMeshes: Math.round(tMade - ready), toAttach: Math.round(t2 - tMade)},
            colliders: Math.round(collidersMs),
            sampler: Math.round(samplerMs),
            attach: Math.round(t3 - t2),
            askedAt: Math.round(t0),
            builtAt: Math.round(t1),
            meshesAt: Math.round(tLoaded),
            wildPreparedAt: Math.round(wildPreparedAt),
            firstFrameAt: Math.round(ready),
            attachAt: Math.round(t2),
            joinedAt: Math.round(t3)
        };
        try {
            performance.mark("ark:town:joined", {detail: timings});
        } catch {
            // (No User Timing detail here: the timings stay on the handle.)
        }
    };

    const mount = async () => {
        const wild = arkIslandSnapshot(whole, "wild");
        const [{mountArk}, {prepareArk}] = await Promise.all([import("@/ark-scene"), import("@/ark-scene/runtime/prebuild")]);
        if (disposed) return;
        // The town's worker starts now, beside the wild island's prebuild. Its answer is held in the worker; taken now
        // if it is ready while the main thread only waits for the wild island's workers, else after the first frame.
        let wildPrepared = false;
        if (two) {
            void startTownWork().then((work) =>
                work.start.ready.then((done) => {
                    if (done && !wildPrepared && !disposed) void makeTown();
                })
            );
        }
        // The wild island's heavy seeded work (decor, forest, grass, places) in the runtime's worker first (runtime.md §7).
        await prepareArk({snapshot: wild, ...(options.workers?.scenery ? {workerUrl: options.workers.scenery} : {}), ...(options.workers?.places ? {placesWorkerUrl: options.workers.places} : {})}).catch(() => undefined);
        wildPrepared = true;
        wildPreparedAt = performance.now();
        if (disposed) return;
        // The wild island draws its first frame exactly as with one island; the town comes when it is built (decision 153).
        scene = mountArk(el, {
            ...options,
            snapshot: two ? wild : whole,
            island: null,
            wildAnimals: two ? wild.animals : null,
            openIsland: near,
            onIslandNear: (island) => {
                near = island;
                options.onIsland?.(island, flying);
            },
            onTier: (next, lite) => {
                tier = next;
                options.onTier?.(next, lite);
            },
            onReady: () => {
                options.onReady?.();
                void attachTown();
            }
        });
        for (const [key, args] of pending.splice(0)) (scene as unknown as Record<string, (...a: unknown[]) => unknown>)[key]?.(...args);
        if (pendingSelect) {
            const {id, closeUp} = pendingSelect;
            pendingSelect = null;
            // (Through `select`: a town animal stays chosen until the town is in.)
            own.select!(id, closeUp);
        }
    };
    const mounted = mount().then(() => options.onIsland?.(near, false));

    const crossTo = (to: ArkIsland, then?: {select?: string | null; closeUp?: boolean}): Promise<void> => {
        if (disposed || !two) return Promise.resolve();
        if (then?.select) {
            // A selection flies there itself (the scene's own flight to the animal, across the strait if need be).
            own.select!(then.select, then.closeUp);
            return Promise.resolve();
        }
        if (!scene?.flyToIsland) return Promise.resolve();
        flying = true;
        near = to;
        options.onIsland?.(to, true);
        scene.flyToIsland(to);
        return new Promise((resolve) =>
            setTimeout(() => {
                flying = false;
                options.onIsland?.(near, false);
                resolve();
            }, CROSS_SECONDS * 1000)
        );
    };

    const own: Partial<ArkArchipelagoHandle> = {
        island: () => near,
        twoIslands: () => two,
        crossing: () => flying,
        attached: () => !two || attached,
        townTimings: () => timings,
        mounted: () => mounted.then(() => undefined),
        crossTo,
        update: (snapshot: ArkSnapshot) => {
            // (The server's switch turning on or off under an open page: kept as mounted until the next visit.)
            if (arkTwoIslands(snapshot) !== two) return;
            whole = snapshot;
            // (Until the town is in, the scene holds the wild island's animals only.)
            scene?.update(two && !attached ? arkIslandSnapshot(snapshot, "wild") : snapshot);
        },
        select: (id: string | null, closeUp?: boolean) => {
            const animal = id ? whole.animals.find((a) => a.id === id) : null;
            // (A town animal before the town is in: chosen now, flown to once it is.)
            if (!scene || (two && !joined && animal && arkIslandOf(animal, true) === "town")) {
                pendingSelect = id ? {id, closeUp} : null;
                return;
            }
            scene.select(id, closeUp);
        },
        dispose: () => {
            disposed = true;
            // (A town worker still at work is stopped.)
            void townWork?.then((work) => work.start.cancel());
            scene?.dispose();
            scene = null;
            town = null;
        }
    };
    void town;

    return new Proxy(own as ArkArchipelagoHandle, {
        get(target, key: string | symbol) {
            if (key in target) return (target as unknown as Record<string | symbol, unknown>)[key];
            // (Not a thenable, not iterable: only the scene's own calls are forwarded; before the scene is up they wait.)
            if (typeof key !== "string" || key === "then") return undefined;
            return (...args: unknown[]) => {
                if (!scene) {
                    pending.push([key, args]);
                    return undefined;
                }
                const fn = (scene as unknown as Record<string, unknown>)[key];
                return typeof fn === "function" ? (fn as (...a: unknown[]) => unknown).apply(scene, args) : undefined;
            };
        }
    });
}
