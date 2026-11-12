/**
 * Part C, the two islands on the web (islands plan §6; decisions 22, 26–28): which island each animal lives on, one
 * island's slice of the Ark's read, the island the page opens on, where an animal lives in words, and "My animals"
 * grouped across both islands. Pure: no three.js, no DOM, so the page, the scene and the tests share it.
 *
 * The server sends `island` (and `enclosure`) only while `voyage_config.islands` is on (AnimalDex
 * `ark-islands-server`, `20261117120000`). With it off the Ark is one island, today's: every helper here answers so
 * (the wild island is the whole read, the town is empty), and the page is exactly as before.
 */

import {ARK_ZONES, type ArkAnimal, type ArkIsland, type ArkIslandCounts, type ArkNestRow, type ArkSnapshot, type ArkZone} from "@/ark-scene/types";
import {ZOO_ENCLOSURE_TYPES, type ZooEnclosureType} from "@/ark-scene/islands/town/zoo-types";

export const ARK_ISLAND_IDS: readonly ArkIsland[] = ["wild", "town"];

/**
 * Two islands: the server's switch is on. Its reads say so (`voyage_public_v3`'s `islands` with a town, or any animal
 * carrying `island`); a read without either is the one-island Ark, even if it holds house and farm animals (today's
 * hamlet).
 */
export function arkTwoIslands(snapshot: Pick<ArkSnapshot, "animals" | "islands" | "island"> | null | undefined): boolean {
    if (!snapshot) return false;
    if (snapshot.islands && snapshot.islands.town > 0) return true;
    if (snapshot.island === "town") return true;
    return snapshot.animals.some((animal) => animal.island === "town" || animal.island === "wild");
}

/** The island an animal lives on: the server's `island`, else (an older row on a two-island read) a kept animal's area says the town. */
export function arkIslandOf(animal: Pick<ArkAnimal, "island" | "area">, twoIslands: boolean): ArkIsland {
    if (!twoIslands) return "wild";
    if (animal.island === "town" || animal.island === "wild") return animal.island;
    return animal.area === "house" || animal.area === "farm" || animal.area === "zoo" ? "town" : "wild";
}

/** Each island's living animals in a read (its own `islands` when it is one island's answer). */
export function arkIslandCounts(snapshot: ArkSnapshot): ArkIslandCounts {
    const two = arkTwoIslands(snapshot);
    if (snapshot.islands && snapshot.island) return snapshot.islands;
    let town = 0;
    let zoo = 0;
    for (const animal of snapshot.animals) {
        if (arkIslandOf(animal, two) !== "town") continue;
        town++;
        if (animal.area === "zoo") zoo++;
    }
    return {wild: snapshot.animals.length - town, town, zoo};
}

/**
 * One island's slice of a whole-Ark read (`voyage_public_v2` with islands on), shaped as `voyage_public_v3` answers it:
 * that island's animals in the read's order, the nests whose kind lives there, its zones and counts, and both
 * islands' counts. With the switch off the wild island is the read itself (the same object: nothing changes for the
 * one-island scene) and the town is empty.
 */
export function arkIslandSnapshot(snapshot: ArkSnapshot, island: ArkIsland): ArkSnapshot {
    const two = arkTwoIslands(snapshot);
    if (!two && island === "wild") return snapshot;
    if (snapshot.island === island && snapshot.islands) return snapshot;
    const islands = arkIslandCounts(snapshot);
    const animals = two ? snapshot.animals.filter((animal) => arkIslandOf(animal, two) === island) : [];
    const kinds = new Set(animals.map((animal) => `${animal.species_profile_id}|${animal.zone}`));
    const nests = snapshot.nests ? snapshot.nests.filter((nest: ArkNestRow) => kinds.has(`${nest.species_profile_id}|${nest.zone}`)) : undefined;
    const zones = new Map<ArkZone, number>();
    for (const animal of animals) zones.set(animal.zone, (zones.get(animal.zone) ?? 0) + 1);
    return {
        ...snapshot,
        animals,
        ...(nests ? {nests} : {}),
        zones: Array.from(zones, ([key, n]) => ({key, animals: n})).sort((a, b) => b.animals - a.animals || a.key.localeCompare(b.key)),
        counts: {
            animals: animals.length,
            species: new Set(animals.map((animal) => animal.species_profile_id)).size,
            // (The read's founders are its distinct bringers; a slice counts its own bringers' labels.)
            founders: new Set(animals.map((animal) => animal.brought_by.label).filter(Boolean)).size
        },
        island,
        islands
    };
}

/**
 * The island the page opens on (decision 26): one asked for (`?island=`), else the focused animal's, else the island
 * with most of the viewer's animals; visitors without any (and a tie) open on the wild island.
 */
export function arkOpeningIsland(snapshot: ArkSnapshot | null, options: {asked?: string | null; focus?: Pick<ArkAnimal, "island" | "area"> | null} = {}): ArkIsland {
    if (!snapshot || !arkTwoIslands(snapshot)) return "wild";
    if (options.asked === "wild" || options.asked === "town") return options.asked;
    if (options.focus) return arkIslandOf(options.focus, true);
    let town = 0;
    let wild = 0;
    for (const animal of snapshot.animals) {
        if (!animal.mine) continue;
        if (arkIslandOf(animal, true) === "town") town++;
        else wild++;
    }
    return town > wild ? "town" : "wild";
}

/** A zoo enclosure's type (`aviaries-3` → `aviaries`), or null for anything that is not one. */
export function arkEnclosureType(enclosure: string | null | undefined): ZooEnclosureType | null {
    if (!enclosure) return null;
    const at = enclosure.lastIndexOf("-");
    const type = at > 0 ? enclosure.slice(0, at) : enclosure;
    return (ZOO_ENCLOSURE_TYPES as readonly string[]).includes(type) ? (type as ZooEnclosureType) : null;
}

/** Where an animal lives, as "My animals" and the live log group it. */
export type ArkPlace =
    | {island: "wild"; kind: "zone"; zone: ArkZone; key: string}
    | {island: "town"; kind: "house" | "farm" | "wildlife"; zone: ArkZone; key: string}
    | {island: "town"; kind: "zoo"; zone: ArkZone; enclosure: ZooEnclosureType | null; key: string};

export function arkPlaceOf(animal: Pick<ArkAnimal, "island" | "area" | "zone" | "enclosure">, twoIslands: boolean): ArkPlace {
    if (arkIslandOf(animal, twoIslands) === "wild") return {island: "wild", kind: "zone", zone: animal.zone, key: `wild:${animal.zone}`};
    if (animal.area === "zoo") {
        const enclosure = arkEnclosureType(animal.enclosure);
        return {island: "town", kind: "zoo", zone: animal.zone, enclosure, key: `zoo:${enclosure ?? "zoo"}`};
    }
    const kind = animal.area === "house" ? "house" : animal.area === "farm" ? "farm" : "wildlife";
    return {island: "town", kind, zone: animal.zone, key: `town:${kind}`};
}

/** The order "My animals" lists places in: the wild island's zones as the regions run, then home, farm, town wildlife, then the zoo's types. */
function placeRank(place: ArkPlace): number {
    if (place.kind === "zone") return ARK_ZONES.indexOf(place.zone);
    if (place.kind === "house") return 100;
    if (place.kind === "farm") return 101;
    if (place.kind === "wildlife") return 102;
    return 200 + (place.enclosure ? ZOO_ENCLOSURE_TYPES.indexOf(place.enclosure) : 99);
}

export type ArkPlaceGroup = {key: string; place: ArkPlace; animals: ArkAnimal[]};

/**
 * "My animals" across both islands (islands plan §6): the viewer's animals grouped by where they live ("Wild island ·
 * Rainforest", "Town · at home", "Town · on the farm", "Zoo · Primate house"), newest first in each group. One island:
 * by zone, as before.
 */
export function arkPlaceGroups(animals: readonly ArkAnimal[], twoIslands: boolean): ArkPlaceGroup[] {
    const groups = new Map<string, ArkPlaceGroup>();
    for (const animal of animals) {
        const place = arkPlaceOf(animal, twoIslands);
        let group = groups.get(place.key);
        if (!group) groups.set(place.key, (group = {key: place.key, place, animals: []}));
        group.animals.push(animal);
    }
    for (const group of groups.values()) group.animals.sort((a, b) => b.arrived_at.localeCompare(a.arrived_at) || a.id.localeCompare(b.id));
    return Array.from(groups.values()).sort((a, b) => placeRank(a.place) - placeRank(b.place) || a.key.localeCompare(b.key));
}

/** `voyage_animal_where_v1`'s answer (`/api/ark/where/<id>`): where an animal lives, for `/ark?focus=<animal>`. */
export type ArkWhere = {id: string; status: string; island: ArkIsland; area: ArkAnimal["area"]; zone: ArkZone | null; enclosure: string | null};

export function arkWhereOf(raw: unknown): ArkWhere | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    if (typeof row.id !== "string" || !row.id) return null;
    const zone = typeof row.zone === "string" && (ARK_ZONES as readonly string[]).includes(row.zone) ? (row.zone as ArkZone) : null;
    const area = row.area === "house" || row.area === "farm" || row.area === "zoo" ? row.area : null;
    return {
        id: row.id,
        status: typeof row.status === "string" ? row.status : "present",
        island: row.island === "town" ? "town" : "wild",
        area,
        zone,
        enclosure: typeof row.enclosure === "string" && arkEnclosureType(row.enclosure) ? row.enclosure : null
    };
}

/** An animal id as the server writes it (a uuid): `?focus=` may be one, besides a species id or slug. */
export function arkLooksLikeAnimalId(value: string | null | undefined): boolean {
    return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}
