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

export type ArkArchipelagoOptions = ArkSceneOptions & {
    /** The island to open on (decision 26 is the page's: `arkOpeningIsland`); default the wild island. */
    openOn?: ArkIsland;
    /** The island the view is over (the switch's state); `crossing` while a flight between them is under way. */
    onIsland?: (island: ArkIsland, crossing: boolean) => void;
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
};

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
    const pending: Array<[string, unknown[]]> = [];
    const tierGuess = (): "high" | "medium" | "low" => (window.matchMedia?.("(pointer: coarse)").matches ? "low" : "medium");

    const mount = async () => {
        const wild = arkIslandSnapshot(whole, "wild");
        if (two) {
            const {loadTownScene} = await import("@/ark-scene/islands/scene");
            town = await loadTownScene({tier: tierGuess(), animals: arkIslandSnapshot(whole, "town").animals});
            if (disposed) {
                town.dispose();
                return;
            }
        }
        const [{mountArk}, {prepareArk}] = await Promise.all([import("@/ark-scene"), import("@/ark-scene/runtime/prebuild")]);
        if (disposed) return;
        // The wild island's heavy seeded work (decor, forest, grass, places) in the runtime's worker first (runtime.md §7).
        await prepareArk({snapshot: wild}).catch(() => undefined);
        if (disposed) return;
        scene = mountArk(el, {
            ...options,
            snapshot: whole,
            island: town,
            wildAnimals: two ? wild.animals : null,
            openIsland: near,
            onIslandNear: (island) => {
                near = island;
                options.onIsland?.(island, flying);
            }
        });
        for (const [key, args] of pending.splice(0)) (scene as unknown as Record<string, (...a: unknown[]) => unknown>)[key]?.(...args);
        if (pendingSelect) {
            const {id, closeUp} = pendingSelect;
            pendingSelect = null;
            scene.select(id, closeUp);
        }
    };
    void mount().then(() => options.onIsland?.(near, false));

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
        crossTo,
        update: (snapshot: ArkSnapshot) => {
            // (The server's switch turning on or off under an open page: kept as mounted until the next visit.)
            if (arkTwoIslands(snapshot) !== two) return;
            whole = snapshot;
            scene?.update(snapshot);
        },
        select: (id: string | null, closeUp?: boolean) => {
            if (!scene) {
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
    void arkIslandOf;
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
