/**
 * Part C: the town island in the Ark's one world (decisions 141–142; the owner: "the second island should be pannable
 * from the first island, they should be visibly next to each other"). `mountArk` with `island` builds the wild island
 * as always and this island beside it, across the strait at its world origin (`islands/index.ts` townWorldOrigin): its
 * ground, scenery and people implied (the town lane's meshes, moved to the origin), its placement of the animals that
 * live there (in world coordinates), its camera views. The animals go through the scene's one pipeline (models, rigs,
 * the live budget, Part B's streaming), exactly as on the wild island.
 *
 * Everything here answers in world coordinates; the town's own modules work in its local frame (+ the origin).
 */

import type {Group} from "three";
import type {Placement} from "@/ark-scene/placement";
import type {ArkAnimal} from "@/ark-scene/types";
import type {ChunkGrid, ChunkSpan} from "@/ark-scene/streaming/chunks";
import type {TownPlace} from "@/ark-scene/islands/town/placement";
import {ARK_ISLANDS, townWorldOrigin} from "@/ark-scene/islands";

export type ArkIslandScene = {
    id: "town";
    /** Its local origin in the world frame. */
    origin: {x: number; z: number};
    /** Its meshes, already at the origin. */
    root: Group;
    /** Within its square (its ground answers there; the wild island's outside). */
    contains: (x: number, z: number) => boolean;
    /** The ground's height in the world frame (inside its square). */
    heightAt: (x: number, z: number) => number;
    /** Lives on this island (the server's `island`, else a kept area). */
    has: (animal: Pick<ArkAnimal, "island" | "area">) => boolean;
    /** Part B (its chunks in its local frame, the streamer places them at `origin`). */
    grid: ChunkGrid;
    spans: ChunkSpan[];
    content: Uint8Array;
    /** Part B's states for its chunks (STATE_IN full, STATE_MAP map style, STATE_OUT hidden); `allIn`: everything drawn. */
    applyStream: (states: Uint8Array, allIn: boolean) => void;
    /** Every frame: the world's clock (epoch ms), for the people implied and the zoo's day. */
    update: (epochMs: number) => void;
    setShadows: (on: boolean) => void;
    setTier: (tier: "high" | "medium" | "low") => void;
    /** Its animals' places in the world frame (the snapshot's animals of this island). */
    place: (animals: ArkAnimal[]) => Map<string, Placement>;
    /** The town's facts for a placed animal (its area, home, enclosure and range; local frame). */
    townPlace: (id: string) => TownPlace | undefined;
    /** A zoo animal's hard bound: a world pose pulled back inside its enclosure's mask. */
    bound: (id: string, pose: {x: number; z: number}) => void;
    /** Its whole-island view: target (world) and the radius it fits. */
    home: {x: number; z: number; radius: number; radiusTall: number};
    /** The camera's target is kept within this of its middle. */
    worldRadius: number;
    dispose: () => void;
};

/** Builds the town for the scene (its modules on demand, so a one-island page does not carry them). */
export async function loadTownScene(options: {tier: "high" | "medium" | "low"; animals: readonly ArkAnimal[]; offsetHours?: number; origin?: {x: number; z: number}}): Promise<ArkIslandScene> {
    const [{buildTownIsland}, {townClockAt}, {placeTownAnimals}, {enclosuresIn, launchEnclosures}, {inPoly, centroid}] = await Promise.all([
        import("@/ark-scene/islands/town/render/index"),
        import("@/ark-scene/islands/town/people"),
        import("@/ark-scene/islands/town/placement"),
        import("@/ark-scene/islands/town/areas"),
        import("@/ark-scene/islands/town/geom")
    ]);
    const origin = options.origin ?? townWorldOrigin();
    const def = ARK_ISLANDS.town;
    const has = (animal: Pick<ArkAnimal, "island" | "area">) => animal.island === "town" || (!animal.island && (animal.area === "house" || animal.area === "farm" || animal.area === "zoo"));
    const open = enclosuresIn(options.animals.filter(has));
    const town = buildTownIsland({tier: options.tier, zooOpen: open.length ? open : launchEnclosures()});
    town.root.position.set(origin.x, 0, origin.z);
    // One sea for the world (decision 143): the wild island's; the town's own plane would lie over it.
    const sea = town.root.getObjectByName("town:sea");
    if (sea) sea.visible = false;
    town.root.updateMatrixWorld(true);
    let openKey = (open.length ? open : launchEnclosures()).join(",");
    let towned = new Map<string, TownPlace>();
    const half = def.half;
    return {
        id: "town",
        origin,
        root: town.root,
        contains: (x, z) => Math.abs(x - origin.x) <= half && Math.abs(z - origin.z) <= half,
        heightAt: (x, z) => town.heightAt(x - origin.x, z - origin.z),
        has,
        grid: town.grid,
        spans: town.spans,
        content: town.content,
        applyStream: (states, allIn) => town.setDrawn(allIn ? null : (chunk) => states[chunk] !== 0),
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
            const world = new Map<string, Placement>();
            placed.places.forEach((p, id) => world.set(id, {...p, x: p.x + origin.x, z: p.z + origin.z}));
            return world;
        },
        townPlace: (id) => towned.get(id),
        bound: (id, pose) => {
            const mask = towned.get(id)?.enclosure?.mask;
            if (!mask) return;
            const lx = pose.x - origin.x;
            const lz = pose.z - origin.z;
            if (inPoly(mask, lx, lz)) return;
            const c = centroid(mask);
            let lo = 0;
            let hi = 1;
            for (let k = 0; k < 8; k++) {
                const t = (lo + hi) / 2;
                if (inPoly(mask, c.x + (lx - c.x) * t, c.z + (lz - c.z) * t)) lo = t;
                else hi = t;
            }
            pose.x = origin.x + c.x + (lx - c.x) * lo;
            pose.z = origin.z + c.z + (lz - c.z) * lo;
        },
        home: {x: origin.x + def.home.target[0], z: origin.z + def.home.target[2], radius: 205, radiusTall: 230},
        worldRadius: half * 0.92,
        dispose: town.dispose
    };
}
