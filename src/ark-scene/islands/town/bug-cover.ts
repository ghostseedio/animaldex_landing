/**
 * What covers the town's ground at bug scale (pass 2, lane GROUND: `bug-ground.ts`), local frame: its surface from
 * `ground.ts` (lawns, the park, the meadows, the woods and orchards, the farm's yards and fields, the sand), and nothing
 * on the paving (a street with its pavements, or any decal: the paths, drives, yards and floors have their own close-up
 * detail in `render/near.ts`), in the water or on a building's floor.
 */

import type {BugCover} from "@/ark-scene/bug-ground";
import {sampleTownGround, streetEdgeDistance, type TownSurface} from "@/ark-scene/islands/town/ground";
import {townDrawnHeight, townTileHeight} from "@/ark-scene/islands/town/drawn-ground";

const COVER: Partial<Record<TownSurface, {surface: BugCover["surface"]; dry: number}>> = {
    sand: {surface: "sand", dry: 0.8},
    shore: {surface: "meadow", dry: 0.35},
    grass: {surface: "meadow", dry: 0.2},
    meadow: {surface: "meadow", dry: 0.25},
    bank: {surface: "meadow", dry: 0.02},
    lawn: {surface: "lawn", dry: 0.05},
    park: {surface: "lawn", dry: 0.08},
    zoo: {surface: "lawn", dry: 0.12},
    churchyard: {surface: "lawn", dry: 0.06},
    paddock: {surface: "lawn", dry: 0.3},
    wood: {surface: "woods", dry: 0.2},
    orchard: {surface: "meadow", dry: 0.12},
    field: {surface: "soil", dry: 0.5},
    allotment: {surface: "soil", dry: 0.3},
    farmyard: {surface: "soil", dry: 0.6}
};

export function townBugCover(x: number, z: number): BugCover | null {
    const g = sampleTownGround(x, z);
    const cover = COVER[g.surface];
    if (!cover) return null;
    if (streetEdgeDistance(x, z) < 0.15) return null;
    const tile = townTileHeight(x, z);
    // A decal or a floor over the tile here: paving, not ground.
    if (townDrawnHeight(x, z) > tile + 0.002) return null;
    return {surface: cover.surface, height: tile, dry: cover.dry};
}
