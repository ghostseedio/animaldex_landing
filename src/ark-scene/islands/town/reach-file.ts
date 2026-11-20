/**
 * The town's reach file as data (AnimalDex decision 416; AnimalDex docs/ark/town-reach.md): the mask (`reach-mask.ts`), the wildlife
 * spots (`areas.ts`), each species' niche, and the contract's cases (the scene's own pick against the server's,
 * `positions/town-reach.ts`). Pure given the positions atlas (its species list). `scripts/ark-town-reach.mts` writes the file from
 * this; `src/lib/ark-town-reach.test.ts` checks the file on disk is what this makes.
 */

import type {ArkAnimal, ArkZone} from "@/ark-scene/types";
import {townAreas} from "@/ark-scene/islands/town/areas";
import {HIGH_WHERE, inTownWater, placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {inTownSolid} from "@/ark-scene/islands/town/tanks";
import {TOWN_HABITATS_BY_ZONE, urbanNiche} from "@/ark-scene/islands/town/niche";
import {SEA_ZONES, TOWN_WETLAND, townWetlandOf} from "@/ark-scene/islands/town/wetland";
import {behaviourProfile, hasBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {arkBody} from "@/ark-scene/stats";
import {BAR, CLIMB, DECK, SMALL, townReachMask, type TownReachMask} from "@/ark-scene/islands/town/reach-mask";
import {decodeTownReach, townHome} from "@/ark-scene/positions/town-reach";

/** The part of the positions atlas this reads: the zones and each species' row (its zone is the row's second number). */
export type ReachAtlasLike = {zones: string[]; islands: {wild: {species: Record<string, number[]>}}};

export type TownReachFile = {
    file: Record<string, unknown>;
    text: string;
    mask: TownReachMask;
    /** [x dm, z dm, where, place, flags] per wildlife spot (the file's own rows). */
    spots: number[][];
    /** How many of the sampled (species, zone, slot) the file's pick is the scene's, and the ones where it is not. */
    verified: number;
    misses: string[];
};

/** The slots sampled for the contract (the server's slots run past a thousand). */
const SLOTS = [0, 1, 2, 5, 17, 60, 143, 294, 1209, 1488, 2999];

/** The mask's bytes, run-length coded: a value, then its run as a varint (7 bits at a time, low first), base64. */
export function rle(data: Uint8Array): string {
    const bytes: number[] = [];
    for (let i = 0; i < data.length; ) {
        let j = i;
        while (j < data.length && data[j] === data[i]) j++;
        bytes.push(data[i]);
        let run = j - i;
        while (run >= 128) {
            bytes.push((run % 128) | 128);
            run = Math.floor(run / 128);
        }
        bytes.push(run);
        i = j;
    }
    return Buffer.from(bytes).toString("base64");
}

export function townReachFile(atlas: ReachAtlasLike, cell = 1): TownReachFile {
    const mask = townReachMask(cell);

    // The wildlife spots (the scene's `byWhere`: garden and urban wildlife, in `townAreas()`'s order).
    const wheres: string[] = [];
    const whereIndex = new Map<string, number>();
    const whereOf = (w: string): number => {
        let i = whereIndex.get(w);
        if (i === undefined) {
            i = wheres.length;
            wheres.push(w);
            whereIndex.set(w, i);
        }
        return i;
    };
    const places: string[] = [];
    const placeIndex = new Map<string, number>();
    const placeOf = (p: string): number => {
        let i = placeIndex.get(p);
        if (i === undefined) {
            i = places.length;
            places.push(p);
            placeIndex.set(p, i);
        }
        return i;
    };
    const spots: number[][] = [];
    for (const s of townAreas().spots) {
        if (s.area !== "garden_wildlife" && s.area !== "urban_wildlife") continue;
        const ground = HIGH_WHERE.has(s.where) || !inTownSolid(s.x, s.z, 0.3);
        const flags = (s.sizes.includes("small") ? 1 : 0) | (s.sizes.includes("medium") ? 2 : 0) | (s.sizes.includes("large") ? 4 : 0) | (ground ? 8 : 0) | (inTownWater(s) ? 16 : 0);
        spots.push([Math.round(s.x * 10), Math.round(s.z * 10), whereOf(s.where), placeOf(s.place), flags]);
    }

    // Niches: the habitats of a zone, the pond, and each species' own. (The first niche is the park: the scene's fallback.)
    const niches: number[][] = [[whereOf("park")]];
    const nicheIndex = new Map<string, number>([[JSON.stringify([whereIndex.get("park")]), 0]]);
    const nicheOf = (list: readonly string[]): number => {
        const ids = list.map(whereOf);
        const key = JSON.stringify(ids);
        let i = nicheIndex.get(key);
        if (i === undefined) {
            i = niches.length;
            niches.push(ids);
            nicheIndex.set(key, i);
        }
        return i;
    };
    const zoneNiche: Record<string, number[]> = {};
    for (const [zone, list] of Object.entries(TOWN_HABITATS_BY_ZONE)) zoneNiche[zone] = list.map(whereOf);
    const wetland = TOWN_WETLAND.map(whereOf);

    // Kinds: every species of the positions atlas.
    const slugs = Object.keys(atlas.islands.wild.species).sort();
    const kinds: Record<string, number[]> = {};
    const zoneOf: Record<string, string> = {};
    const sizeOf = (length: number) => (length < 0.35 ? 0 : length < 1.5 ? 1 : 2);
    for (const slug of slugs) {
        zoneOf[slug] = atlas.zones[atlas.islands.wild.species[slug][1]];
        // (The niche that does not depend on the zone: the species' own rule, else the zone's table.)
        const own = urbanNiche(slug, "~");
        const niche = own.length === 1 && own[0] === "park" ? -1 : nicheOf(own);
        // (Whether it lives at the pond: `townWetlandOf` depends on the species and, for the sea's zones only, the zone.)
        const wet = townWetlandOf(slug, "farm_garden");
        const profile = hasBehaviourProfile(slug) ? behaviourProfile(slug) : null;
        // The scene's `flies` (behaviour-schedule): its main way of moving is flight or one of its ways is (a crow walks and flies).
        const flies = !!profile && (profile.move === "fly" || profile.moves.includes("fly"));
        // Climbs walls: it climbs or clings, or crawls along any surface (spiders, snails, geckos).
        const climbs = !!profile && (profile.move === "climb" || profile.move === "cling" || profile.moves.includes("climb") || profile.moves.includes("cling") || profile.surface !== null);
        kinds[slug] = [niche, sizeOf(arkBody({model_slug: slug} as never).metres), wet ? (wet.swims ? 2 : 1) : 0, (flies ? 1 : 0) | (climbs ? 2 : 0)];
    }

    const file: Record<string, unknown> = {
        v: 1,
        about: "The town's reach file (AnimalDex decision 416, docs/ark/town-reach.md): the connectivity mask of the town's own layout, the spots its wildlife stands on and each species' niche. Generated by animaldex_landing scripts/ark-town-reach.mts from islands/town/ (reach-mask.ts, reach-file.ts, areas.ts, placement.ts); read by positions/reach.ts and town-reach.ts (AnimalDex _shared/ark-positions, pinned copies in the web). Never edit by hand.",
        mask: {x0: mask.x0, z0: mask.z0, cell: mask.cell, nx: mask.nx, nz: mask.nz, flags: {bar: BAR, small: SMALL, climb: CLIMB, deck: DECK}, enc: "rle", data: rle(mask.data)},
        wheres,
        places,
        spots,
        niches,
        zoneNiche,
        wetland,
        seaZones: [...SEA_ZONES].sort(),
        kinds
    };

    // The contract: the scene's own pick against the file's, for sampled species, zones and slots.
    const decoded = decodeTownReach(JSON.parse(JSON.stringify({...file, cases: []})));
    const sample = slugs.filter((_, i) => i % 7 === 0);
    const animals: ArkAnimal[] = [];
    for (const slug of sample) {
        for (const slot of SLOTS) {
            animals.push({id: `reach-${slug}-${slot}`, species_profile_id: `reach-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone: zoneOf[slug] as ArkZone, arrived_at: "2026-01-01T00:00:00Z", brought_by: {label: "reach", named: false}, mine: false, slot, slot_rank: 0, area: null, enclosure: null} as unknown as ArkAnimal);
        }
    }
    const cases: Array<[string, string, number, number]> = [];
    const misses: string[] = [];
    let verified = 0;
    for (let at = 0; at < animals.length; at += 200) {
        const part = animals.slice(at, at + 200);
        const placed = placeTownAnimals(part);
        for (const a of part) {
            const info = placed.town.get(a.id)!;
            const home = townHome(decoded, a.model_slug, a.zone, a.slot as number);
            if (!home) misses.push(`${a.model_slug} ${a.zone} ${a.slot}: no home (scene: ${info.where} ${info.place})`);
            else if (home.place !== info.place || home.where !== info.where) misses.push(`${a.model_slug} ${a.zone} ${a.slot}: file ${home.where} ${home.place}, scene ${info.where} ${info.place}`);
            else {
                verified++;
                // (Every eighth is written to the file: the contract the server's test checks.)
                if (verified % 8 === 0) cases.push([a.model_slug, a.zone, a.slot as number, home.spot]);
            }
        }
    }
    file.cases = cases;
    return {file, text: JSON.stringify(file) + "\n", mask, spots, verified, misses};
}
