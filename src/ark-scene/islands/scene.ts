/**
 * Part C: another island hosted by the Ark's scene (`mountArk` with `island`), in place of the wild island's own
 * world: its ground, scenery and chunks (Part B's streamer draws them), its placement of the animals that live there,
 * its camera's reach. The animals themselves go through the scene's one pipeline (models, rigs, the behaviour
 * schedule, the motion pass), exactly as on the wild island. One island is loaded at a time (`archipelago.ts`).
 */

import type {Group} from "three";
import type {Placement} from "@/ark-scene/placement";
import type {ArkAnimal} from "@/ark-scene/types";
import type {ChunkGrid, ChunkSpan} from "@/ark-scene/streaming/chunks";
import type {TownPlace} from "@/ark-scene/islands/town/placement";
import type {ArkWorldSampler} from "@/ark-scene/world-sampler";
import {ARK_ISLANDS} from "@/ark-scene/islands";

export type ArkIslandScene = {
    id: "town";
    root: Group;
    /** The ground's height (never below the sea's 0 for walkers: the scene clamps as on the wild island). */
    heightAt: (x: number, z: number) => number;
    grid: ChunkGrid;
    spans: ChunkSpan[];
    content: Uint8Array;
    /** Part B's streamer: which chunks are drawn (null: all). */
    setDrawn: (drawn: ((chunk: number) => boolean) | null) => void;
    /** Every frame: the world's clock (epoch ms), for the people implied and the zoo's day. */
    update: (epochMs: number) => void;
    setShadows: (on: boolean) => void;
    setTier: (tier: "high" | "medium" | "low") => void;
    /** Every animal's place on this island (the snapshot is this island's slice). */
    place: (animals: ArkAnimal[]) => Map<string, Placement>;
    /** The town's facts for a placed animal (its area, home, enclosure and range). */
    townPlace: (id: string) => TownPlace | undefined;
    /** The behaviour world (`islands/town/sampler.ts`), installed while this island is loaded (`installWorldSampler`). */
    sampler: () => ArkWorldSampler;
    /** On the behaviour schedule (not one kept still at a window, behind the glass or in a tank). */
    scheduled: (id: string) => boolean;
    /** The most its home range may reach (m): its garden, paddock or enclosure; null: its kind's own. */
    rangeOf: (id: string) => number | null;
    /** A kept animal (house, farm, zoo): its home is never moved away from prey (it takes no part in the wild ecology). */
    kept: (id: string) => boolean;
    /** A zoo animal's hard bound: the pose pulled back inside its enclosure's mask. */
    bound: (id: string, pose: {x: number; z: number}) => void;
    /** The view the page opens on: its target and the radius it fits in view. */
    home: {x: number; z: number; radius: number; radiusTall: number};
    /** The camera's target is kept within this of the middle. */
    worldRadius: number;
    /** The camera's furthest. */
    maxDistance: number;
    dispose: () => void;
};

/** Builds the town for the scene (its modules on demand, so the wild island's page does not carry them). */
export async function loadTownScene(options: {tier: "high" | "medium" | "low"; animals: readonly ArkAnimal[]; offsetHours?: number}): Promise<ArkIslandScene> {
    const [{buildTownIsland}, {townClockAt}, {placeTownAnimals}, {enclosuresIn, launchEnclosures}, {townWorldSampler}, {inPoly, centroid}] = await Promise.all([
        import("@/ark-scene/islands/town/render/index"),
        import("@/ark-scene/islands/town/people"),
        import("@/ark-scene/islands/town/placement"),
        import("@/ark-scene/islands/town/areas"),
        import("@/ark-scene/islands/town/sampler"),
        import("@/ark-scene/islands/town/geom")
    ]);
    const open = enclosuresIn(options.animals);
    const town = buildTownIsland({tier: options.tier, zooOpen: open.length ? open : launchEnclosures()});
    let openKey = (open.length ? open : launchEnclosures()).join(",");
    let towned = new Map<string, TownPlace>();
    let sampler: {key: string; sampler: ArkWorldSampler} | null = null;
    const def = ARK_ISLANDS.town;
    const STILL_WHERE = new Set(["window", "indoor", "pool"]);
    return {
        id: "town",
        root: town.root,
        heightAt: town.heightAt,
        grid: town.grid,
        spans: town.spans,
        content: town.content,
        setDrawn: town.setDrawn,
        update: (epochMs) => town.update(townClockAt(epochMs, options.offsetHours ?? 0)),
        setShadows: town.setShadows,
        setTier: town.setTier,
        place: (animals) => {
            const placed = placeTownAnimals(animals);
            // The zoo's open enclosures follow the snapshot (an arrival opening the next plot).
            const key = placed.open.join(",");
            if (key !== openKey) {
                openKey = key;
                town.setZooOpen(placed.open);
            }
            towned = placed.town;
            return placed.places;
        },
        townPlace: (id) => towned.get(id),
        sampler: () => {
            if (!sampler || sampler.key !== openKey) sampler = {key: openKey, sampler: townWorldSampler(openKey ? openKey.split(",") : [])};
            return sampler.sampler;
        },
        scheduled: (id) => {
            const info = towned.get(id);
            return Boolean(info) && !info!.still && !STILL_WHERE.has(info!.where);
        },
        rangeOf: (id) => {
            const info = towned.get(id);
            return info ? Math.max(info.range, 0.6) * 1.5 : null;
        },
        kept: (id) => {
            const area = towned.get(id)?.area;
            return area === "house" || area === "farm" || area === "zoo";
        },
        bound: (id, pose) => {
            const mask = towned.get(id)?.enclosure?.mask;
            if (!mask || inPoly(mask, pose.x, pose.z)) return;
            const c = centroid(mask);
            let lo = 0;
            let hi = 1;
            for (let k = 0; k < 8; k++) {
                const t = (lo + hi) / 2;
                if (inPoly(mask, c.x + (pose.x - c.x) * t, c.z + (pose.z - c.z) * t)) lo = t;
                else hi = t;
            }
            pose.x = c.x + (pose.x - c.x) * lo;
            pose.z = c.z + (pose.z - c.z) * lo;
        },
        home: {x: def.home.target[0], z: def.home.target[2], radius: 205, radiusTall: 230},
        worldRadius: def.half * 0.95,
        maxDistance: 560,
        dispose: town.dispose
    };
}
