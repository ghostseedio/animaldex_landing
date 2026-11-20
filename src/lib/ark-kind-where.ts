/**
 * Where a kind's animals are (owner, 2026-11-20: an axolotl alone in a zoo tank, and the population chart beside it
 * rising, because the chart counts the whole kind across the Ark: 9 axolotls, 7 in homes, 1 at the zoo, 1 wild).
 *
 * From the public read only (`voyage_public_v2`): each animal's `island`, `area` and `enclosure`. Never who brought it,
 * never a house: only the five kinds of place, and, for the zoo, whether two animals share an enclosure.
 *
 * Breeding is by place (the engine: two animals of a kind pair only in the same place: the wild island, one zoo
 * enclosure, farms, town wildlife, homes), so "this one" is said against the animals of its kind in its own place. The
 * words say "the same place" and no more, so they stay true if homes become one place each.
 *
 * Pure: no DOM. Used by /ark's graph module and the apps' embed bars.
 */

import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import type {ArkGraphWords} from "@/lib/ark-graph-words";
import {arkIslandOf, arkTwoIslands} from "@/lib/ark-islands";
import {arkSpeciesKey} from "@/lib/ark-population";
import {fillArkWords} from "@/lib/ark-words";

export type ArkKindPlace = "wild" | "homes" | "farms" | "town" | "zoo";
/** The order places are said in when their counts tie. */
const PLACES: readonly ArkKindPlace[] = ["wild", "homes", "farms", "town", "zoo"];

type Read = Pick<ArkSnapshot, "animals" | "islands" | "island">;

/** The place an animal lives in: its kept area (a home, a farm, the zoo), else the town's wildlife, else the wild. */
export function arkKindPlaceOf(animal: Pick<ArkAnimal, "island" | "area">, twoIslands: boolean): ArkKindPlace {
    if (animal.area === "house") return "homes";
    if (animal.area === "farm") return "farms";
    if (animal.area === "zoo") return "zoo";
    return arkIslandOf(animal, twoIslands) === "town" ? "town" : "wild";
}

/** What two animals must share to breed: the place, and for the zoo the enclosure. */
function unitOf(animal: Pick<ArkAnimal, "island" | "area" | "enclosure">, twoIslands: boolean): string {
    const place = arkKindPlaceOf(animal, twoIslands);
    return place === "zoo" ? `zoo:${animal.enclosure ?? ""}` : place;
}

export type ArkKindWhere = {
    /** The kind's name (its own row's in the population panel). */
    name: string;
    total: number;
    /** The places with animals of the kind, most first (a tie in the order wild, homes, farms, town wildlife, zoo). */
    places: Array<{place: ArkKindPlace; count: number}>;
    /** The tapped animal's place and how many of its kind share it (itself included); null when it is not of this kind. */
    here: {place: ArkKindPlace; count: number} | null;
};

/** A kind's animals across the whole Ark by place, and where one of them (`animalId`) stands among its own. Null: none aboard. */
export function arkKindWhere(snapshot: Read | null | undefined, key: string, animalId: string | null = null): ArkKindWhere | null {
    if (!snapshot) return null;
    const two = arkTwoIslands(snapshot);
    const kind = snapshot.animals.filter((animal) => arkSpeciesKey(animal) === key);
    if (!kind.length) return null;
    const byPlace = new Map<ArkKindPlace, number>();
    for (const animal of kind) {
        const place = arkKindPlaceOf(animal, two);
        byPlace.set(place, (byPlace.get(place) ?? 0) + 1);
    }
    const places = PLACES.filter((place) => byPlace.has(place))
        .map((place) => ({place, count: byPlace.get(place)!}))
        .sort((a, b) => b.count - a.count);
    const me = animalId ? kind.find((animal) => animal.id === animalId) : null;
    const unit = me ? unitOf(me, two) : null;
    return {
        name: kind.find((animal) => animal.kind_name)?.kind_name ?? kind.find((animal) => animal.species_profile_id === key)?.name ?? kind[0].name,
        total: kind.length,
        places,
        here: me && unit ? {place: arkKindPlaceOf(me, two), count: kind.filter((animal) => unitOf(animal, two) === unit).length} : null
    };
}

const PLACE_WORD: Record<ArkKindPlace, "placeWild" | "placeHomes" | "placeFarms" | "placeTown" | "placeZoo"> = {wild: "placeWild", homes: "placeHomes", farms: "placeFarms", town: "placeTown", zoo: "placeZoo"};
const WHERE_WORD: Record<ArkKindPlace, "whereWild" | "whereHomes" | "whereFarms" | "whereTown" | "whereZoo"> = {wild: "whereWild", homes: "whereHomes", farms: "whereFarms", town: "whereTown", zoo: "whereZoo"};

/** "9 in the whole Ark · 7 in homes · 1 at the zoo · 1 wild". */
export function arkKindWholeText(where: ArkKindWhere, words: ArkGraphWords, locale: string): string {
    const number = (value: number) => value.toLocaleString(locale);
    return [fillArkWords(words.whole, {count: number(where.total)}), ...where.places.map((one) => fillArkWords(words[PLACE_WORD[one.place]], {count: number(one.count)}))].join(" · ");
}

/** "This one: alone in its zoo enclosure" / "This one: 1 of 2 in its zoo enclosure"; null when no animal is tapped. */
export function arkKindHereText(where: ArkKindWhere, words: ArkGraphWords, locale: string): string | null {
    const here = where.here;
    if (!here) return null;
    const place = words[WHERE_WORD[here.place]];
    return here.count <= 1 ? fillArkWords(words.thisAlone, {where: place}) : fillArkWords(words.thisOneOf, {count: here.count.toLocaleString(locale), where: place});
}
