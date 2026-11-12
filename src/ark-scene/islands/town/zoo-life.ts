/**
 * The zoo's day (brief Part C: "zoo animals ... have feeding times and enrichment visuals"; islands plan §5): when each
 * enclosure is fed, what is put down, and what enrichment it has out. Scene only, pure functions of the island clock
 * and the enclosure (the same for every viewer and the livestream; the director can plan its shots on them).
 *
 * - **Feeding times** (`zoo-types.ts` `feeding`, island hours): each lasts `FEED_HOURS`. Penguins and seals 11:00 and
 *   15:00, primates 10:00 and 14:00, big cats 16:00 (a fast day each Ark week: Sunday), the aquarium 13:00, birds in
 *   the morning, the reptile house once a week (Wednesday) for its snakes and crocodiles.
 * - **During a feeding** the keepers' hatch is open and the food is down at the station, eaten away over the window;
 *   the residents' behaviour schedule takes them to the station (their home for those slots: `feedingHome`), so they
 *   gather, eat and disperse on the same schedule and motion pass as always. No keeper is drawn.
 * - **Enrichment** (`ZooEnclosure.enrichment`): props in each open enclosure, drawn always (`render/zoo-life.ts`); a
 *   few are refreshed each morning (an ice block melting through the day, scattered feed).
 */

import type {TownClock} from "@/ark-scene/islands/town/people";
import type {ZooEnclosure} from "@/ark-scene/islands/town/areas";
import type {ZooEnclosureType} from "@/ark-scene/islands/town/zoo-types";
import {ZOO_TYPES} from "@/ark-scene/islands/town/zoo-types";

/** How long a feeding lasts (island hours). */
export const FEED_HOURS = 0.5;
/** The weekday (Sunday 0) a weekly feeding happens (the reptile house's snakes and crocodiles). */
export const WEEKLY_FEED_DAY = 3;
/** The big cats' fast day (Sunday). */
export const FAST_DAY = 0;

export type ZooFood = "fish" | "hay" | "meat" | "fruit" | "seed" | "insects" | "pellets";

/** What the keepers put down for each type. */
export const ZOO_FOOD: Record<ZooEnclosureType, ZooFood> = {
    aviaries: "seed",
    aquarium: "fish",
    reptile_house: "meat",
    savanna_paddocks: "hay",
    childrens_farm: "pellets",
    small_mammals: "insects",
    primate_house: "fruit",
    hoofstock_paddocks: "hay",
    nocturnal_house: "insects",
    bears_wolves: "meat",
    insect_house: "fruit",
    penguin_seal_pools: "fish",
    big_cats: "meat"
};

export type ZooFeeding = {type: ZooEnclosureType; food: ZooFood; /** 0 the moment it starts, 1 eaten. */ eaten: number; start: number; end: number};

function weekdayOf(day: number): number {
    return ((day % 7) + 7) % 7;
}

/** The enclosure type's feeding now (on the island clock), or null. */
export function zooFeedingAt(type: ZooEnclosureType, clock: TownClock): ZooFeeding | null {
    const spec = ZOO_TYPES[type];
    const weekday = weekdayOf(clock.day);
    if (spec.weekly && weekday !== WEEKLY_FEED_DAY) return null;
    if (type === "big_cats" && weekday === FAST_DAY) return null;
    for (const start of spec.feeding) {
        if (clock.hours >= start && clock.hours < start + FEED_HOURS) return {type, food: ZOO_FOOD[type], eaten: (clock.hours - start) / FEED_HOURS, start, end: start + FEED_HOURS};
    }
    return null;
}

/** Whether an enclosure is being fed at an epoch time (ms) with this island clock. */
export function zooFeedingAtMs(type: ZooEnclosureType, epochMs: number, clockAt: (ms: number) => TownClock): ZooFeeding | null {
    return zooFeedingAt(type, clockAt(epochMs));
}

/** Where a resident goes while its enclosure is fed: the feeding station (its home for those slots), gathered close. */
export function feedingHome(enclosure: ZooEnclosure, ground: (x: number, z: number) => number): {x: number; y: number; z: number; range: number} {
    const {x, z} = enclosure.feeding;
    // (A crowd round the hatch: the bigger the enclosure, the wider it may gather.)
    const range = Math.min(Math.max(Math.min(enclosure.slot.at.w, enclosure.slot.at.d) * 0.18, 2), 5);
    return {x, y: ground(x, z), z, range};
}

/** An ice block put out each morning melts through the day: its size (0–1) at an hour. */
export function iceLeft(hours: number): number {
    if (hours < 9) return 0;
    return Math.max(0, 1 - (hours - 9) / 8);
}
