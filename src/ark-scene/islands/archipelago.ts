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
import {setArkWorld} from "@/ark-scene/world";

export type ArkArchipelagoOptions = ArkSceneOptions & {
    /** Which wild island in islands mode: Part C's bigger one (`v2`, the default since its gates passed) or today's (`v1`). `?wild=` overrides. */
    wildIsland?: "v1" | "v2";
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
    /** Development: where the town's time went (the worker, the sliced build, the attach). */
    townTimings: () => Record<string, unknown> | null;
    /** Resolves once the scene is up (the wild island's first mount); the apps' embed hands its held messages over then. */
    mounted: () => Promise<void>;
};

/**
 * The bigger wild island, in islands mode: the default since its gates passed (P7). `?wild=v1` or `?wild=v2` (review)
 * wins, else the `wildIsland` setting: `v1` asks for today's island, exactly as it was.
 */
function wildIslandAsked(setting: "v1" | "v2" | undefined): boolean {
    const url = typeof location !== "undefined" ? new URLSearchParams(location.search).get("wild") : null;
    if (url === "v2" || url === "v1") return url === "v2";
    return setting !== "v1";
}

/** A flight across the strait takes about this long (`flyToIsland`). */
const CROSS_SECONDS = 3.4;

export function mountArchipelago(el: HTMLElement, options: ArkArchipelagoOptions): ArkArchipelagoHandle {
    let whole: ArkSnapshot = options.snapshot;
    const two = arkTwoIslands(whole);
    // P1 (docs/ark/wild-island.md §8): in islands mode, the bigger wild island when asked for (the `wildIsland` setting or
    // `?wild=v2` for review), chosen before the scene's modules load. Islands off: today's world, untouched.
    if (two && wildIslandAsked(options.wildIsland)) setArkWorld("v2");
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
    /** The town: its heavy work in its worker, its meshes in idle slices, then into the live scene. */
    const attachTown = async () => {
        if (attaching || attached || disposed || !two) return;
        attaching = true;
        const [{prepareTown}, {loadTownScene}, {enclosuresIn, launchEnclosures}, {townWorldOrigin}] = await Promise.all([
            import("@/ark-scene/islands/town/prebuild"),
            import("@/ark-scene/islands/scene"),
            import("@/ark-scene/islands/town/areas"),
            import("@/ark-scene/islands")
        ]);
        const townAnimals = arkIslandSnapshot(whole, "town").animals;
        const open = enclosuresIn(townAnimals);
        const origin = townWorldOrigin();
        const t0 = performance.now();
        const prepared = await prepareTown({animals: townAnimals, origin, open: open.length ? open : launchEnclosures()}, options.workers?.town ? {workerUrl: options.workers.town} : {});
        if (disposed) return;
        const t1 = performance.now();
        town = await loadTownScene({tier, animals: townAnimals, origin, prepared, sliceMs: 8});
        if (disposed || !scene?.attachIsland) {
            town?.dispose();
            return;
        }
        // (Its behaviour world's places and its colliders, each in an idle moment of its own, before it joins.)
        const idle = () => new Promise<void>((resolve) => ((globalThis as {requestIdleCallback?: (cb: () => void, o?: {timeout: number}) => number}).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 16)))(() => resolve(), {timeout: 120}));
        await idle();
        town.colliders();
        await idle();
        town.sampler();
        await idle();
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
        // (Development: where the town's time went: the worker, the sliced build, the one attach task.)
        timings = {prebuild: Math.round(t1 - t0), where: prepared.where, build: Math.round(t2 - t1), attach: Math.round(performance.now() - t2), attachAt: Math.round(t2), builtAt: Math.round(t1)};
    };

    const mount = async () => {
        const wild = arkIslandSnapshot(whole, "wild");
        const [{mountArk}, {prepareArk}] = await Promise.all([import("@/ark-scene"), import("@/ark-scene/runtime/prebuild")]);
        if (disposed) return;
        // The wild island's heavy seeded work (decor, forest, grass, places) in the runtime's worker first (runtime.md §7).
        await prepareArk({snapshot: wild, ...(options.workers?.scenery ? {workerUrl: options.workers.scenery} : {}), ...(options.workers?.places ? {placesWorkerUrl: options.workers.places} : {})}).catch(() => undefined);
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
