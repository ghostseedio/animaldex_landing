/**
 * Development only: the local real snapshot (`public/ark-local/real.json`, a `voyage_public_v2` answer from before
 * the move) with Part C's island fields synthesised, so the two islands can be seen and tested on the real population
 * before the server's switch-on runs. **Nothing here is the server's routing**: that is `voyage_route_v1` on capture
 * settings, which a snapshot does not carry. This uses what a snapshot does carry (each animal's `area`) and the
 * server's species-level routing columns (AnimalDex `ark-islands-server` `scripts/ark/fixtures/islands-species.json`:
 * domestic, town phrase, zoo enclosure type per look), and picks the zoo's residents per enclosure type to T1's
 * rehearsal counts (`docs/ark/islands-server.md` §2: aviaries 168, aquarium 73, …), seeded by animal id.
 *
 * The real snapshot is read in place and never written: callers keep the result in memory.
 */

import {assignEnclosures, unitOf, type RoutedAnimal} from "@/ark-scene/islands/routing";
import {ZOO_ENCLOSURE_TYPES, type ZooEnclosureType} from "@/ark-scene/islands/town/zoo-types";

type Raw = Record<string, unknown>;

/** T1's rehearsal (production, rolled back, 2026-11-12): the zoo's residents per enclosure type. */
export const T1_ZOO_RESIDENTS: Record<ZooEnclosureType, number> = {
    aviaries: 168,
    aquarium: 73,
    reptile_house: 48,
    savanna_paddocks: 38,
    childrens_farm: 38,
    small_mammals: 33,
    primate_house: 27,
    hoofstock_paddocks: 20,
    nocturnal_house: 15,
    bears_wolves: 13,
    insect_house: 11,
    penguin_seal_pools: 9,
    big_cats: 6
};
/** T1's rehearsal per destination (the plan's routing on the 3,142 aboard). */
export const T1_DESTINATIONS = {wild: 704, house: 1063, farm: 149, garden: 528, urban: 199, zoo: 499} as const;

/** The server's routing columns per look: `domestic|town_phrase|zoo_enclosure|zone` (`islands-species.json`'s `species`). */
export type SpeciesRouting = Record<string, string>;

type Route = {domestic: "p" | "l" | null; town: boolean; zoo: ZooEnclosureType | null};

function routeOf(routing: SpeciesRouting, animal: Raw): Route {
    const row = routing[String(animal.species_profile_id)] ?? routing[String(animal.kind_species_profile_id ?? "")] ?? "";
    const [d, t, z] = row.split("|");
    return {domestic: d === "p" || d === "l" ? d : null, town: t === "1", zoo: (ZOO_ENCLOSURE_TYPES as readonly string[]).includes(z) ? (z as ZooEnclosureType) : null};
}

export type SynthesisedDestinations = {wild: number; house: number; farm: number; garden: number; urban: number; zoo: number; zooByType: Partial<Record<ZooEnclosureType, number>>; enclosures: Partial<Record<ZooEnclosureType, number>>};

/**
 * A copy of a real `voyage_public_v2` answer with `island`, `area` and `enclosure` on every animal, as the server's
 * reads send them with islands on, and the destination counts it came to.
 */
export function synthesiseArkIslands(raw: unknown, routing: SpeciesRouting): {snapshot: Raw; counts: SynthesisedDestinations} {
    const body = (raw && typeof raw === "object" && "snapshot" in (raw as Raw) ? (raw as {snapshot: unknown}).snapshot : raw) as Raw;
    const animals = ((body.animals as Raw[] | undefined) ?? []).map((animal) => ({...animal}));
    const routes = new Map(animals.map((animal) => [String(animal.id), routeOf(routing, animal)]));
    const zoo = new Set<string>();
    // The zoo's residents per type: zoo captures are mostly kinds from away (the garden zone's and the town-phrase kinds
    // last), the children's farm domestic kinds; seeded by id within each preference.
    for (const type of ZOO_ENCLOSURE_TYPES) {
        const candidates = animals.filter((animal) => !animal.area && routes.get(String(animal.id))!.zoo === type && (type === "childrens_farm") === Boolean(routes.get(String(animal.id))!.domestic));
        // (Half the town-phrase kinds held back: T1's counts sit between none and all of them.)
        const local = (animal: Raw) => Number(animal.zone === "farm_garden") * 2 + Number(routes.get(String(animal.id))!.town && unitOf(`urban-synth:${animal.id}`) < 0.5);
        candidates.sort((a, b) => local(a) - local(b) || unitOf(`zoo-synth:${a.id}`) - unitOf(`zoo-synth:${b.id}`));
        for (const animal of candidates.slice(0, T1_ZOO_RESIDENTS[type])) zoo.add(String(animal.id));
    }
    const counts: SynthesisedDestinations = {wild: 0, house: 0, farm: 0, garden: 0, urban: 0, zoo: 0, zooByType: {}, enclosures: {}};
    const routed: RoutedAnimal[] = [];
    for (const animal of animals) {
        const id = String(animal.id);
        const route = routes.get(id)!;
        animal.enclosure = null;
        if (animal.area === "house" || animal.area === "farm") {
            animal.island = "town";
            counts[animal.area]++;
        } else if (zoo.has(id)) {
            animal.island = "town";
            animal.area = "zoo";
            counts.zoo++;
            counts.zooByType[route.zoo!] = (counts.zooByType[route.zoo!] ?? 0) + 1;
            routed.push({id, slug: String(animal.model_slug ?? ""), kind: String(animal.kind_species_profile_id ?? animal.species_profile_id ?? ""), arrivedAt: String(animal.arrived_at ?? ""), type: route.zoo!});
        } else if (route.domestic) {
            // Rules 5 and 6: a domestic kind captured in the wild lives with its kind.
            animal.island = "town";
            animal.area = route.domestic === "p" ? "house" : "farm";
            counts[route.domestic === "p" ? "house" : "farm"]++;
        } else if (animal.zone === "farm_garden") {
            animal.island = "town";
            animal.area = null;
            counts.garden++;
        } else if (route.town) {
            animal.island = "town";
            animal.area = null;
            counts.urban++;
        } else {
            animal.island = "wild";
            animal.area = null;
            counts.wild++;
        }
    }
    const enclosures = assignEnclosures(routed);
    for (const animal of animals) {
        const name = enclosures.get(String(animal.id));
        if (name) animal.enclosure = name;
    }
    for (const name of new Set(enclosures.values())) {
        const type = name.slice(0, name.lastIndexOf("-")) as ZooEnclosureType;
        counts.enclosures[type] = (counts.enclosures[type] ?? 0) + 1;
    }
    return {snapshot: {...body, animals}, counts};
}
