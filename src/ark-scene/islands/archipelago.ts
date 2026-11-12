/**
 * Part C, moving between islands (brief "Moving between islands"; islands plan §6; decisions 26–28): **one island
 * loaded at a time**, behind the one scene handle the page already uses.
 *
 * - The page gives the whole Ark's read (`voyage_public_v2`, which carries `island` once the server's switch is on); the
 *   scene is mounted with one island's slice (`lib/ark-islands.ts` arkIslandSnapshot). With the switch off there is one
 *   island and this is `mountArk` exactly as before.
 * - **The crossing** (about 4 s): the camera turns along the bearing to the other island and climbs over the sea while
 *   the haze thickens (an overlay in the horizon's colour); fully hazed, the island is unloaded (its whole scene
 *   disposed: ground, scenery, models, the GL context) and the other one mounted; the camera comes in from over the sea
 *   the way it went and descends onto the island (its opening flight from that view). Reduced motion: a 0.6 s fade.
 *   The next island's code and scenery are asked for when the crossing starts, so the haze waits only for what is left.
 * - `select(id)` (a tap in the population panel, "My animals", `?focus=`) on an animal of the other island crosses first,
 *   then flies to it. `crossTo(island)` is the island switch.
 */

import type {ArkAnimal, ArkCameraView, ArkIsland, ArkSceneHandle, ArkSceneOptions, ArkSnapshot} from "@/ark-scene/types";
import {arkIslandOf, arkIslandSnapshot, arkTwoIslands} from "@/lib/ark-islands";
import {ARK_ISLANDS, bearingBetween} from "@/ark-scene/islands";
import type {ArkIslandScene} from "@/ark-scene/islands/scene";

export type ArkArchipelagoOptions = ArkSceneOptions & {
    /** The island to open on (decision 26 is the page's: `arkOpeningIsland`); default the wild island. */
    openOn?: ArkIsland;
    /** The island shown changed (a crossing began: `crossing` true; the new island is in: false). */
    onIsland?: (island: ArkIsland, crossing: boolean) => void;
    /** The haze's colour (the horizon's at the island's hour; default a pale sea haze). */
    hazeColour?: string;
};

export type ArkArchipelagoHandle = ArkSceneHandle & {
    /** The island loaded now. */
    island: () => ArkIsland;
    /** Whether the Ark has two islands now (the server's switch). */
    twoIslands: () => boolean;
    /** Cross to the other island (resolves once it is in view); `select` an animal there when in. */
    crossTo: (island: ArkIsland, then?: {select?: string | null; closeUp?: boolean}) => Promise<void>;
    /** Crossing now. */
    crossing: () => boolean;
};

const RISE_SECONDS = 1.7;
const ARRIVE_SECONDS = 2.4;
const FADE_SECONDS = 0.6;

/** The calls whose last value is put back on the next island's scene (the page's settings live across a crossing). */
const STICKY = new Set(["setMineOnly", "setLite", "setProps", "setReducedMotion", "setHours", "setEnvironment", "setViewInset", "setClockScale", "setSoundVolume", "setAnimalLook"]);

function ease(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Unit vector (x, z) from one island towards the other, in the archipelago frame (the islands share north). */
function towards(from: ArkIsland, to: ArkIsland): {x: number; z: number} {
    const angle = bearingBetween(from, to);
    return {x: Math.cos(angle), z: Math.sin(angle)};
}

/** The orbit azimuth whose camera looks along (x, z): the camera sits behind its target, opposite that way. */
function lookingAlong(d: {x: number; z: number}): number {
    return Math.atan2(-d.x, -d.z);
}

export function mountArchipelago(el: HTMLElement, options: ArkArchipelagoOptions): ArkArchipelagoHandle {
    let whole: ArkSnapshot = options.snapshot;
    let current: ArkIsland = arkTwoIslands(whole) ? options.openOn ?? "wild" : "wild";
    let scene: ArkSceneHandle | null = null;
    let town: ArkIslandScene | null = null;
    let crossing: Promise<void> | null = null;
    let disposed = false;
    let pendingSelect: {id: string; closeUp?: boolean} | null = null;
    let tier: "high" | "medium" | "low" = "medium";
    const sticky = new Map<string, unknown[]>();
    const reduced = () => Boolean((sticky.get("setReducedMotion")?.[0] as boolean | undefined) ?? options.reducedMotion);

    const haze = document.createElement("div");
    haze.setAttribute("aria-hidden", "true");
    Object.assign(haze.style, {position: "absolute", inset: "0", pointerEvents: "none", opacity: "0", background: options.hazeColour ?? "radial-gradient(ellipse at 50% 60%, #e9eef0 0%, #d7e0e4 55%, #c4d0d6 100%)", zIndex: "2", transition: "none"});
    if (getComputedStyle(el).position === "static") el.style.position = "relative";

    const islandOfId = (id: string): ArkIsland | null => {
        const animal = whole.animals.find((a) => a.id === id);
        return animal ? arkIslandOf(animal, arkTwoIslands(whole)) : null;
    };

    /** Mount one island's scene (the town's world first, on demand). */
    const mountIsland = async (island: ArkIsland, arrival: ArkSceneOptions["arrival"]): Promise<void> => {
        const slice = arkIslandSnapshot(whole, island);
        let world: ArkIslandScene | null = null;
        if (island === "town") {
            const {loadTownScene} = await import("@/ark-scene/islands/scene");
            world = await loadTownScene({tier, animals: slice.animals});
            if (disposed) {
                world.dispose();
                return;
            }
        }
        const {mountArk} = await import("@/ark-scene");
        // The wild island's heavy seeded work (decor, forest, grass, places) in the runtime's worker first, as the page did.
        if (island === "wild") await import("@/ark-scene/runtime/prebuild").then(({prepareArk}) => prepareArk({snapshot: slice})).catch(() => undefined);
        if (disposed) {
            world?.dispose();
            return;
        }
        town = world;
        const ready = new Promise<void>((resolve) => {
            scene = mountArk(el, {
                ...options,
                snapshot: slice,
                island: world,
                arrival,
                onReady: () => {
                    resolve();
                    options.onReady?.();
                },
                onTier: (next, lite) => {
                    tier = next;
                    options.onTier?.(next, lite);
                }
            });
        });
        // (The haze stays above the new canvas.)
        el.appendChild(haze);
        for (const [key, args] of Array.from(sticky.entries())) (scene as unknown as Record<string, (...a: unknown[]) => unknown>)[key]?.(...args);
        await ready;
        if (pendingSelect && scene) {
            const {id, closeUp} = pendingSelect;
            if (islandOfId(id) === current) {
                pendingSelect = null;
                (scene as ArkSceneHandle).select(id, closeUp);
            }
        }
    };

    const fadeTo = (to: number, seconds: number) =>
        new Promise<void>((resolve) => {
            const from = Number(haze.style.opacity) || 0;
            const start = performance.now();
            const step = () => {
                const t = Math.min((performance.now() - start) / 1000 / Math.max(seconds, 1e-3), 1);
                haze.style.opacity = String(from + (to - from) * ease(t));
                if (t < 1 && !disposed) requestAnimationFrame(step);
                else resolve();
            };
            requestAnimationFrame(step);
        });

    /** Phase 1: turn along the bearing and climb over the sea as the haze thickens. */
    const rise = (from: ArkIsland, to: ArkIsland) =>
        new Promise<void>((resolve) => {
            const s = scene;
            if (!s || reduced()) return resolve();
            const start = s.view();
            const d = towards(from, to);
            const edge = ARK_ISLANDS[from].half * 0.62;
            const end: ArkCameraView = {target: {x: d.x * edge, y: 0, z: d.z * edge}, distance: Math.max(start.distance, 260), polar: 1.18, azimuth: lookingAlong(d)};
            let az = end.azimuth;
            while (az - start.azimuth > Math.PI) az -= Math.PI * 2;
            while (az - start.azimuth < -Math.PI) az += Math.PI * 2;
            const t0 = performance.now();
            const step = () => {
                if (disposed || scene !== s) return resolve();
                const t = Math.min((performance.now() - t0) / 1000 / RISE_SECONDS, 1);
                const k = ease(t);
                s.setView({
                    target: {x: start.target.x + (end.target.x - start.target.x) * k, y: start.target.y * (1 - k), z: start.target.z + (end.target.z - start.target.z) * k},
                    distance: start.distance + (end.distance - start.distance) * k,
                    polar: start.polar + (end.polar - start.polar) * k,
                    azimuth: start.azimuth + (az - start.azimuth) * k
                });
                if (t < 1) requestAnimationFrame(step);
                else resolve();
            };
            requestAnimationFrame(step);
        });

    const crossTo = (to: ArkIsland, then?: {select?: string | null; closeUp?: boolean}): Promise<void> => {
        if (then?.select) pendingSelect = {id: then.select, closeUp: then.closeUp};
        if (disposed || !arkTwoIslands(whole)) return Promise.resolve();
        if (crossing) return crossing.then(() => (current === to ? afterCross() : crossTo(to, then)));
        if (to === current) return Promise.resolve(afterCross());
        const from = current;
        options.onIsland?.(to, true);
        crossing = (async () => {
            // The other island's code and its scenery's modules are asked for now, while the camera climbs.
            const warm = to === "town" ? import("@/ark-scene/islands/scene").then(() => import("@/ark-scene/islands/town/render/index")) : import("@/ark-scene");
            await Promise.all([rise(from, to), fadeTo(1, reduced() ? FADE_SECONDS : RISE_SECONDS * 0.95)]);
            await warm.catch(() => undefined);
            // Fully hazed: the island is unloaded, the other one mounted.
            if (scene) {
                const s = scene as ArkSceneHandle;
                scene = null;
                s.dispose();
            }
            town = null;
            current = to;
            // In from over the sea, the way the camera came: out past the coast towards where it came from, facing in.
            const back = towards(to, from);
            const edge = ARK_ISLANDS[to].half * 0.75;
            const arrival = reduced() ? null : {from: {target: {x: back.x * edge, y: 0, z: back.z * edge}, distance: 300, polar: 1.15, azimuth: lookingAlong({x: -back.x, z: -back.z})}, seconds: ARRIVE_SECONDS};
            await mountIsland(to, arrival);
            await fadeTo(0, reduced() ? FADE_SECONDS : ARRIVE_SECONDS * 0.55);
        })().finally(() => {
            crossing = null;
            if (!disposed) options.onIsland?.(current, false);
        });
        return crossing.then(() => afterCross());
    };

    /** A selection waiting for its island: made once that island is in. */
    const afterCross = () => {
        if (!pendingSelect || !scene) return;
        const {id, closeUp} = pendingSelect;
        if (islandOfId(id) !== current) return;
        pendingSelect = null;
        scene.select(id, closeUp);
    };

    void mountIsland(current, null).then(() => options.onIsland?.(current, false));

    const own: Partial<ArkArchipelagoHandle> = {
        island: () => current,
        twoIslands: () => arkTwoIslands(whole),
        crossing: () => crossing !== null,
        crossTo,
        update: (snapshot: ArkSnapshot) => {
            whole = snapshot;
            // (The switch turned on or off under the page: back to the one island, the wild one.)
            if (!arkTwoIslands(snapshot) && current !== "wild") {
                void crossTo("wild");
                return;
            }
            scene?.update(arkIslandSnapshot(snapshot, current));
        },
        select: (id: string | null, closeUp?: boolean) => {
            if (!id) {
                pendingSelect = null;
                scene?.select(null);
                return;
            }
            const there = islandOfId(id);
            if (there && there !== current) {
                void crossTo(there, {select: id, closeUp});
                return;
            }
            if (!scene || crossing) {
                pendingSelect = {id, closeUp};
                return;
            }
            scene.select(id, closeUp);
        },
        dispose: () => {
            disposed = true;
            scene?.dispose();
            scene = null;
            town = null;
            haze.remove();
        }
    };
    void town;

    return new Proxy(own as ArkArchipelagoHandle, {
        get(target, key: string | symbol) {
            if (key in target) return (target as unknown as Record<string | symbol, unknown>)[key];
            // (Not a thenable, not iterable: only the scene's own calls are forwarded.)
            if (typeof key !== "string" || key === "then") return undefined;
            return (...args: unknown[]) => {
                if (typeof key === "string" && STICKY.has(key)) sticky.set(key, args);
                const s = scene as unknown as Record<string, unknown> | null;
                const fn = s && typeof key === "string" ? s[key] : undefined;
                return typeof fn === "function" ? (fn as (...a: unknown[]) => unknown).apply(s, args) : undefined;
            };
        }
    });
}

/** The animals of the other island than the one loaded (for "My animals" and the panel's both-islands view). */
export function otherIslandAnimals(snapshot: ArkSnapshot, island: ArkIsland): ArkAnimal[] {
    const two = arkTwoIslands(snapshot);
    return two ? snapshot.animals.filter((animal) => arkIslandOf(animal, two) !== island) : [];
}
