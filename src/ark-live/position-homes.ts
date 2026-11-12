/**
 * `ark-live`'s home discs from the encounter lane's shared position module (`_shared/ark-positions`, its web copy
 * `src/ark-scene/positions/positions.ts` on `ark-encounter-scene`, POSITIONS_VERSION 1), typed structurally so this lane
 * does not depend on that branch until the release merges both:
 *
 *   import * as positions from "@/ark-scene/positions/positions";
 *   import atlasRaw from "@/ark-scene/positions/atlas.json";
 *   new Room({..., homeOf: positionHomes(positions, positions.decodeAtlas(atlasRaw))});
 *
 * The animal's stored record supplies the module's `HomeOverride` (its third argument), so the server, the scene and
 * the tick agree on where a released animal now lives. Without a slot (an older server) or a sheet: the zone's site.
 */

import type {Abilities} from "@/ark-live/species";
import type {AnimalFacts} from "@/ark-live/rules";
import {defaultHomeOf, type HomeLookup, type StoredState} from "@/ark-live/room";
import type {HomeDisc} from "@/ark-live/release";

type HomeRef = {island?: string | null; zone: string; slug: string; speciesId: string; slot: number; rank?: number};
type HomeOverride = {island?: string; x?: number; z?: number; r?: number};
export type PositionsModule<Atlas> = {homeOf: (atlas: Atlas, ref: HomeRef, override?: HomeOverride | null) => {x: number; z: number; r: number} | null};

export function positionHomes<Atlas>(module: PositionsModule<Atlas>, atlas: Atlas): HomeLookup {
    return (facts: AnimalFacts, a: Abilities, state: StoredState | null, ref) => {
        if (ref.slot === null || !ref.speciesId) return defaultHomeOf(facts, a, state);
        const home = module.homeOf(atlas, {island: ref.island, zone: facts.zone, slug: facts.slug, speciesId: ref.speciesId, slot: ref.slot, rank: ref.rank ?? 0}, state?.home ?? null);
        const disc: HomeDisc | null = home ? {x: home.x, z: home.z, r: home.r} : null;
        return disc ?? defaultHomeOf(facts, a, state);
    };
}
