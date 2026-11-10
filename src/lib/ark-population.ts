/**
 * Who is aboard the shared Ark, species by species (the /ark population HUD
 * and the capture page's Ark band). Pure: it reads a `voyage_public_v1`
 * snapshot and nothing else.
 *
 * Two of each kind is the ideal (ark-spec "Decisions": pair calibration), so
 * every species carries its pair status against two.
 */

import {ARK_REGIONS, ZONE_REGION, type ArkAnimal, type ArkRegion, type ArkSnapshot, type ArkZone} from "@/ark-scene/types";

/** One alone, a pair, a few more than a pair, or more than the pair needs. */
export type ArkPairStatus = "single" | "pair" | "more" | "crowded";

/** From this many a species reads as crowded. */
export const ARK_CROWDED_FROM = 5;

export function arkPairStatus(count: number): ArkPairStatus {
    if (count <= 1) return "single";
    if (count === 2) return "pair";
    return count >= ARK_CROWDED_FROM ? "crowded" : "more";
}

export type ArkSpeciesRow = {
    /** The species' key: its canonical species_profile_id, or its model slug when that is missing. */
    key: string;
    speciesProfileId: string;
    slug: string;
    name: string;
    zone: ArkZone;
    region: ArkRegion;
    count: number;
    /** How many of them the reader brought. */
    mine: number;
    status: ArkPairStatus;
    /** Its animals, newest arrival first. */
    animals: ArkAnimal[];
};

export type ArkRegionGroup = {region: ArkRegion; animals: number; species: ArkSpeciesRow[]};

export type ArkPopulation = {
    regions: ArkRegionGroup[];
    species: number;
    /** Species with two or more aboard. */
    paired: number;
    /** Species with one alone. */
    single: number;
};

export function arkSpeciesKey(animal: Pick<ArkAnimal, "species_profile_id" | "model_slug">): string {
    return animal.species_profile_id || `slug:${animal.model_slug}`;
}

export function arkPopulation(snapshot: ArkSnapshot | null): ArkPopulation {
    const bySpecies = new Map<string, ArkSpeciesRow>();
    for (const animal of snapshot?.animals ?? []) {
        const key = arkSpeciesKey(animal);
        let row = bySpecies.get(key);
        if (!row) {
            row = {
                key,
                speciesProfileId: animal.species_profile_id,
                slug: animal.model_slug,
                name: animal.name,
                zone: animal.zone,
                region: ZONE_REGION[animal.zone] ?? "home",
                count: 0,
                mine: 0,
                status: "single",
                animals: []
            };
            bySpecies.set(key, row);
        }
        row.count++;
        if (animal.mine) row.mine++;
        row.animals.push(animal);
    }
    const rows = Array.from(bySpecies.values());
    for (const row of rows) {
        row.status = arkPairStatus(row.count);
        row.animals.sort((a, b) => b.arrived_at.localeCompare(a.arrived_at));
    }
    const regions = ARK_REGIONS
        .map((region) => {
            const species = rows.filter((row) => row.region === region).sort((a, b) => a.name.localeCompare(b.name));
            return {region, animals: species.reduce((sum, row) => sum + row.count, 0), species};
        })
        .filter((group) => group.species.length > 0);
    return {
        regions,
        species: rows.length,
        paired: rows.filter((row) => row.count >= 2).length,
        single: rows.filter((row) => row.count === 1).length
    };
}

/**
 * The animal a tap on a species goes to: the next one after the one already
 * selected (so tapping again walks through them), otherwise the reader's own
 * newest, otherwise the newest arrival.
 */
export function arkPickAnimal(animals: ArkAnimal[], selectedId: string | null): ArkAnimal | null {
    if (!animals.length) return null;
    const at = selectedId ? animals.findIndex((animal) => animal.id === selectedId) : -1;
    if (at >= 0) return animals[(at + 1) % animals.length];
    return animals.find((animal) => animal.mine) ?? animals[0];
}

/** A `?focus=` value: a species_profile_id or a model slug. */
export function arkFocusAnimals(snapshot: ArkSnapshot | null, focus: string | null | undefined): ArkAnimal[] {
    const wanted = focus?.trim().toLowerCase();
    if (!wanted || !snapshot) return [];
    return snapshot.animals
        .filter((animal) => animal.species_profile_id.toLowerCase() === wanted || animal.model_slug.toLowerCase() === wanted)
        .sort((a, b) => b.arrived_at.localeCompare(a.arrived_at));
}

/** One species on the Ark, for a capture of it: matched by its profile id or its slug. */
export function arkSpeciesAboard(snapshot: ArkSnapshot | null, species: {speciesProfileId?: string | null; slug?: string | null}): {count: number; mine: number; status: ArkPairStatus | null; animals: ArkAnimal[]} {
    const ids = new Set([species.speciesProfileId, species.slug].map((value) => value?.trim().toLowerCase()).filter((value): value is string => Boolean(value)));
    const animals = (snapshot?.animals ?? [])
        .filter((animal) => ids.has(animal.species_profile_id.toLowerCase()) || ids.has(animal.model_slug.toLowerCase()))
        .sort((a, b) => b.arrived_at.localeCompare(a.arrived_at));
    return {count: animals.length, mine: animals.filter((animal) => animal.mine).length, status: animals.length ? arkPairStatus(animals.length) : null, animals};
}

const SAME_PLURAL = /(sheep|deer|fish|moose|bison|buffalo|salmon|trout|cod|tuna|squid|shrimp|krill|swine|cattle|wildebeest|species|grouse|quail|elk|pike|carp|plaice|halibut)$/i;
const IRREGULAR: Record<string, string> = {mouse: "mice", louse: "lice", goose: "geese", ox: "oxen", wolf: "wolves", calf: "calves"};

/**
 * An English animal name in the plural ("Komodo Dragons", "Red Foxes",
 * "Snowy Owls", "Bighorn Sheep", "Snow Geese"): the last word only. Other
 * languages say their counts without it.
 */
export function pluralAnimalName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed || SAME_PLURAL.test(trimmed)) return trimmed;
    const [, head, last] = trimmed.match(/^(.*?)(\S+)$/) ?? ["", "", trimmed];
    const irregular = IRREGULAR[last.toLowerCase()];
    if (irregular) return `${head}${last[0] === last[0].toUpperCase() ? irregular[0].toUpperCase() + irregular.slice(1) : irregular}`;
    if (/[^aeiou]y$/i.test(trimmed)) return `${trimmed.slice(0, -1)}ies`;
    if (/(s|x|z|ch|sh)$/i.test(trimmed)) return `${trimmed}es`;
    return `${trimmed}s`;
}
