/**
 * People implied, never shown (islands plan §3.3): the town's lit windows, parked cars, bins out on collection
 * morning, washing on the line on dry days, the market's stalls, boats in and out, the lighthouse's lantern. Each is a
 * pure function of the island clock (the hour, the day) and ids, so every viewer sees the same town at the same
 * moment, and a recording on a pinned clock is the same every run. No people meshes, no voices.
 */

import {hashText} from "@/ark-scene/islands/town/geom";

/** The island's clock: the hour (0–24) and the day (a whole number; the weekday is `day % 7`, 0 = Sunday). */
export type TownClock = {hours: number; day: number};

const HOUR_MS = 3_600_000;

/** The island clock at epoch milliseconds (UTC plus a fixed offset, as `ark-clock.ts` `islandHours`). */
export function townClockAt(ms: number, offsetHours = 0): TownClock {
    const total = ms / HOUR_MS + offsetHours;
    const day = Math.floor(total / 24);
    // 1970-01-01 was a Thursday: day 0 is weekday 4.
    return {hours: ((total % 24) + 24) % 24, day: day + 4};
}

export function weekday(clock: TownClock): number {
    return ((clock.day % 7) + 7) % 7;
}

/** A number in [0, 1) from parts (stable across devices). */
export function chance(...parts: Array<string | number>): number {
    return hashText(parts.join("|")) / 4294967296;
}

/** Whether it is dark enough for lights (the scene's sun curve: up ~6:00–18:00, twilight an hour either side). */
export function darkness(hours: number): number {
    const fromDusk = Math.min(Math.max((hours - 18) / 1.2, 0), 1);
    const toDawn = Math.min(Math.max((6.4 - hours) / 1.2, 0), 1);
    return hours >= 12 ? fromDusk : toDawn;
}

function within(hours: number, from: number, to: number): boolean {
    return from <= to ? hours >= from && hours < to : hours >= from || hours < to;
}

export type LitWindow = {building: string; owner: "home" | "shop" | "pub" | "civic" | "church" | "farm" | "zoo" | "mill" | "harbour"; household: number; floor: number; seed: number};

/**
 * How lit a window is (0–1) at this moment. Homes: a household's evening runs from its own time after dusk to its own
 * bedtime (a few late ones past midnight), downstairs first, bedrooms later; dark mornings before work; now and then
 * a household is away for the day. Shops light their displays in opening hours and a few in the evening; the pub
 * until late; the church on Sunday and for evensong; the farms early and in the evening; the lighthouse all night.
 */
export function windowLit(w: LitWindow, clock: TownClock): number {
    const h = clock.hours;
    const day = weekday(clock);
    const dark = darkness(h);
    const r = chance(w.building, w.household, w.seed);
    switch (w.owner) {
        case "home": {
            if (chance(w.building, w.household, clock.day, "away") < 0.07) return 0;
            const household = chance(w.building, w.household, "rhythm");
            const evening = 17.2 + household * 1.6 + r * 0.6;
            const bed = 22 + household * 1.8 + (chance(w.building, w.household, clock.day, "late") < 0.08 ? 2.5 : 0);
            const morning = 5.8 + household * 1.4;
            const leave = morning + 1.2 + r * 0.5;
            const room = w.floor === 0 ? 0 : 1;
            const used = r < (room ? 0.55 : 0.85);
            if (!used) return 0;
            const evenOn = room ? within(h, Math.max(evening + 2.5, 20.5), bed % 24) : within(h, evening, (bed - 0.4) % 24);
            const mornOn = within(h, morning, leave) && (room ? r < 0.3 : r < 0.7);
            return (evenOn || mornOn) && dark > 0.15 ? 1 : (evenOn || mornOn) && dark > 0 ? 0.5 : 0;
        }
        case "shop":
            if (day === 0) return 0;
            return within(h, 8, 18) ? 0.7 : within(h, 18, 21) && r < 0.4 ? 0.5 * Math.max(dark, 0.3) : 0;
        case "pub":
            return within(h, 11, 23.3) ? 0.9 : 0;
        case "civic":
            return day >= 1 && day <= 5 && within(h, 8.5, 17.5) ? 0.6 : 0;
        case "church":
            return (day === 0 && within(h, 9.5, 12)) || within(h, 17.5, 19) ? 0.85 : 0;
        case "farm":
            return (within(h, 5, 7.5) || within(h, 17, 22)) && r < 0.8 ? 1 : 0;
        case "mill":
            return day >= 1 && day <= 5 && within(h, 7.5, 18.5) && r < 0.6 ? 0.6 : 0;
        case "harbour":
            // The lighthouse's lantern (floor 4) all night; the office in working hours.
            if (w.floor === 4) return dark > 0.05 ? 1 : 0;
            return within(h, 6, 17) && r < 0.7 ? 0.6 : 0;
        case "zoo":
            return within(h, 9, 18) ? 0.6 : 0;
        default:
            return 0;
    }
}

/** A car spot: a drive or a stretch of kerb. */
export type CarSpot = {id: string; kind: "drive" | "kerb" | "farm" | "harbour"; x: number; z: number; turn: number};

/**
 * Whether a car stands in a spot now, and its colour index. Drives are full at night and emptier on weekday working
 * hours (people at work); kerbs are busier in the evening; which kerb spots are taken changes from day to day.
 */
export function carAt(spot: CarSpot, clock: TownClock): {parked: boolean; colour: number} {
    const day = weekday(clock);
    const h = clock.hours;
    const workday = day >= 1 && day <= 5;
    const working = workday && within(h, 8.4 + chance(spot.id, "go") * 0.8, 17.2 + chance(spot.id, "back") * 1.2);
    let p: number;
    if (spot.kind === "drive") p = working ? 0.32 : 0.82;
    else if (spot.kind === "kerb") p = working ? 0.28 : within(h, 18, 8) ? 0.55 : 0.4;
    else if (spot.kind === "farm") p = 0.7;
    else p = within(h, 6, 18) ? 0.6 : 0.2;
    // The day decides which spots are taken (kerbs and harbour), the hour-band only how many.
    const band = working ? "w" : "h";
    const roll = spot.kind === "drive" || spot.kind === "farm" ? chance(spot.id, clock.day, band) : chance(spot.id, clock.day);
    const colour = Math.floor(chance(spot.id, spot.kind === "kerb" ? clock.day : Math.floor(clock.day / 30), "colour") * CAR_COLOURS.length);
    return {parked: roll < p, colour};
}

export const CAR_COLOURS = ["#c8cbd0", "#2b2f36", "#8a1f22", "#f1f1ee", "#2c4a7a", "#6b6f74", "#3c5a40", "#b9a27a", "#a33b1f", "#1d2b44"];

/** Collection day per street (0–6), from its id. */
export function collectionDay(street: string): number {
    return 1 + (hashText(street) % 5);
}

/**
 * Bins out at the kerb from the evening before collection (19:00) until late morning of the day (11:00), when most
 * are taken back; a few stay out till evening.
 */
export function binsOut(street: string, home: string, clock: TownClock): boolean {
    const day = weekday(clock);
    const collect = collectionDay(street);
    const before = (collect + 6) % 7;
    const late = chance(home, clock.day, "late bins") < 0.18;
    if (day === before && clock.hours >= 19 + chance(home, "out") * 2.5) return true;
    if (day === collect && clock.hours < (late ? 18.5 : 10.5 + chance(home, "in") * 1.5)) return true;
    return false;
}

/** A dry day (washing out, windows open): by the day. */
export function dryDay(clock: TownClock): boolean {
    return chance("dry", clock.day) < 0.62;
}

/** Washing on a household's line: dry days, 9:00–17:00, about a third of households. */
export function washingOut(home: string, clock: TownClock): boolean {
    return dryDay(clock) && clock.hours >= 8.5 + chance(home, clock.day, "w") && clock.hours < 16.5 + chance(home, "in") && chance(home, clock.day, "wash") < 0.34;
}

/** Market day on the square: Saturdays and Wednesdays, 7:00–16:00. */
export function marketDay(clock: TownClock): boolean {
    const day = weekday(clock);
    return (day === 6 || day === 3) && clock.hours >= 7 && clock.hours < 16;
}

/** A boat at its mooring: canal boats come and go by the day; harbour boats are out fishing early on weekdays. */
export function boatIn(id: string, harbour: boolean, clock: TownClock): boolean {
    if (!harbour) return chance(id, Math.floor(clock.day / 3)) < 0.7;
    const day = weekday(clock);
    const fishing = day >= 1 && day <= 6 && clock.hours >= 4.5 + chance(id, "out") * 1.5 && clock.hours < 13 + chance(id, "in") * 3;
    return !(fishing && chance(id, clock.day) < 0.75);
}

/** The church clock's hands (radians, from 12 o'clock, clockwise as seen from the front). */
export function clockHands(clock: TownClock): {hour: number; minute: number} {
    const minutes = clock.hours * 60;
    return {hour: ((minutes / 720) % 1) * Math.PI * 2, minute: ((minutes / 60) % 1) * Math.PI * 2};
}

/** Street lamps: on from dusk to dawn. */
export function lampsOn(clock: TownClock): number {
    return darkness(clock.hours) > 0.25 ? 1 : 0;
}
