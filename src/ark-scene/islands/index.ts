/**
 * The Ark's islands (islands plan §6; decisions 22, 26, 28): the wild island and the town, countryside and zoo
 * island. One island is loaded at a time. This is the switch hook the islands-on-the-web lane builds the crossing on:
 * which islands there are, where they sit in the archipelago frame (used only for the crossing and the silhouette on
 * the horizon), which island an animal lives on, which island the page opens on, and `loadIsland` to build one.
 *
 * Each island keeps its own local coordinates (placement, atlas, player-control wire): the archipelago frame never
 * moves anything on an island.
 */

import type {Group} from "three";

export type ArkIslandId = "wild" | "town";

export type ArkIslandDef = {
    id: ArkIslandId;
    /** Half the island's terrain square (m), in its own frame. */
    half: number;
    /** Part B chunks across (52.8 m each). */
    chunks: number;
    /** Land (ha), measured at 1 m. */
    landHa: number;
    /** Where its origin sits in the archipelago frame (m): the wild island at the origin, the town east-north-east. */
    archipelago: {x: number; z: number};
    /** The opening view in its own frame (the camera looks north from the southern sea, as on the wild island). */
    home: {target: [number, number, number]; eye: [number, number, number]};
};

/** The strait between the islands (decision 8: the islands plan's figure): the town ~1.5 km east-north-east. */
export const ARCHIPELAGO_TOWN_BEARING = (22.5 * Math.PI) / 180;
export const ARCHIPELAGO_TOWN_DISTANCE = 1500;

export const ARK_ISLANDS: Record<ArkIslandId, ArkIslandDef> = {
    wild: {id: "wild", half: 132, chunks: 5, landHa: 2.38, archipelago: {x: 0, z: 0}, home: {target: [0, 0, 0], eye: [0, 160, 300]}},
    town: {
        id: "town",
        half: 237.6,
        chunks: 9,
        landHa: 12.4,
        archipelago: {x: Math.round(Math.cos(ARCHIPELAGO_TOWN_BEARING) * ARCHIPELAGO_TOWN_DISTANCE), z: -Math.round(Math.sin(ARCHIPELAGO_TOWN_BEARING) * ARCHIPELAGO_TOWN_DISTANCE)},
        home: {target: [10, 0, -10], eye: [40, 190, 430]}
    }
};

/** A point on an island in the archipelago frame (for the crossing's flight path and the horizon silhouette). */
export function toArchipelago(island: ArkIslandId, x: number, z: number): {x: number; z: number} {
    const o = ARK_ISLANDS[island].archipelago;
    return {x: o.x + x, z: o.z + z};
}

/** The bearing (radians, atan2(dz, dx)) from one island to the other, for the crossing's turn. */
export function bearingBetween(from: ArkIslandId, to: ArkIslandId): number {
    const a = ARK_ISLANDS[from].archipelago;
    const b = ARK_ISLANDS[to].archipelago;
    return Math.atan2(b.z - a.z, b.x - a.x);
}

/**
 * Which island an animal lives on: the server's `island` field (migration I1, `voyage_animals.island`), else from
 * its area (`zoo`, `house`, `farm` are the town's), else the wild island (today's snapshot, before the move).
 */
export function islandOfAnimal(animal: {island?: string | null; area?: string | null}): ArkIslandId {
    if (animal.island === "town" || animal.island === "wild") return animal.island;
    if (animal.area === "zoo" || animal.area === "house" || animal.area === "farm") return "town";
    return "wild";
}

/** The island the page opens on (decision 26): the one with most of the viewer's animals; visitors without any: wild. */
export function openingIsland(mine: ReadonlyArray<{island?: string | null; area?: string | null}>): ArkIslandId {
    let town = 0;
    let wild = 0;
    for (const a of mine) {
        if (islandOfAnimal(a) === "town") town++;
        else wild++;
    }
    return town > wild ? "town" : "wild";
}

/** A loaded island, as the scene holds it while it is the one shown. */
export type ArkIslandWorld = {
    id: ArkIslandId;
    root: Group;
    heightAt: (x: number, z: number) => number;
    /** Part B's grid, spans and content for this island; the streamer's answer goes to `setDrawn`. */
    grid: {originX: number; originZ: number; size: number; columns: number; rows: number; segments: number};
    spans: Array<{minY: number; maxY: number}>;
    content: Uint8Array;
    setDrawn: (drawn: ((chunk: number) => boolean) | null) => void;
    /** Every frame, the shared clock's epoch milliseconds (the island's own schedules work from it). */
    update: (epochMs: number) => void;
    setShadows: (on: boolean) => void;
    setTier: (tier: "high" | "medium" | "low") => void;
    dispose: () => void;
};

/**
 * Builds the town island (the wild island is today's scene, `index.ts`). Imported on demand so the wild island's
 * page does not carry the town's code until a crossing asks for it.
 */
export async function loadIsland(id: "town", options: {tier: "high" | "medium" | "low"; offsetHours?: number}): Promise<ArkIslandWorld> {
    const [{buildTownIsland}, {townClockAt}] = await Promise.all([import("@/ark-scene/islands/town/render/index"), import("@/ark-scene/islands/town/people")]);
    const town = buildTownIsland({tier: options.tier});
    return {
        id,
        root: town.root,
        heightAt: town.heightAt,
        grid: town.grid,
        spans: town.spans,
        content: town.content,
        setDrawn: town.setDrawn,
        update: (epochMs) => town.update(townClockAt(epochMs, options.offsetHours ?? 0)),
        setShadows: town.setShadows,
        setTier: town.setTier,
        dispose: town.dispose
    };
}
