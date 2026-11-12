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
    const [{buildTownIsland}, {townClockAt}, {placeTownAnimals}, {enclosuresIn, launchEnclosures}] = await Promise.all([
        import("@/ark-scene/islands/town/render/index"),
        import("@/ark-scene/islands/town/people"),
        import("@/ark-scene/islands/town/placement"),
        import("@/ark-scene/islands/town/areas")
    ]);
    const open = enclosuresIn(options.animals);
    const town = buildTownIsland({tier: options.tier, zooOpen: open.length ? open : launchEnclosures()});
    let openKey = (open.length ? open : launchEnclosures()).join(",");
    let towned = new Map<string, TownPlace>();
    const def = ARK_ISLANDS.town;
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
        home: {x: def.home.target[0], z: def.home.target[2], radius: 205, radiusTall: 230},
        worldRadius: def.half * 0.95,
        maxDistance: 560,
        dispose: town.dispose
    };
}
