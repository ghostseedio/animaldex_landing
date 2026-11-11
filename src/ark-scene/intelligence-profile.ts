/**
 * Each species' intelligence profile (visual only): how far it sees, hears
 * and smells, how it hunts, forages and defends itself, whether it keeps
 * watch for its group or calls alarms, its company, and how rich its
 * behaviour is (the intelligence stat). The sibling of `behaviour-profile.ts`,
 * keyed the same way (model slug), generated offline from stored data by
 * `scripts/ark-intelligence-profiles.mts` into `intelligence.json`; the full
 * profiles with the phrase that decided each field are in
 * `data/ark/intelligence-profiles.json`.
 *
 * Who can eat whom comes from the ecology's own food links (the traits
 * lane's rules by food group and by named species), so in the scene an
 * animal only reacts to one that could eat it. Nothing here decides a meal.
 *
 * A species the table lacks gets its body plan's defaults, flagged `fallback`.
 */

import table from "@/ark-scene/intelligence.json";

const TABLE = table as {hunt: string[]; forage: string[]; defence: string[]; groups: string[]; species: Record<string, string>};

export type ArkHunt = "ambush" | "pursuit" | "stalk" | "pack" | "aerial_swoop" | "aerial_hawk" | "perch_wait" | "filter" | "scavenge" | "probe_strike";
export type ArkForage = "graze" | "browse" | "dig" | "cache" | "fish" | "flower" | "tide_pool" | "glean" | "probe" | "fruit" | "seed_pick" | "filter" | "scrape";
export type ArkDefence = "flee_cover" | "flee_water" | "flee_tree" | "flee_open" | "fly_off" | "freeze" | "group" | "play_dead" | "threat" | "armour" | "chemical" | "burrow";
export type ArkMindBand = "instinct" | "practical" | "sharp" | "brilliant";
export type ArkSense = "sight" | "hearing" | "smell" | "touch";

export type ArkIntelProfile = {
    slug: string;
    /** The body plan (the rig manifest's: quadruped, flying_bird, fish…), for the head look's limits. */
    plan: string;
    /** The intelligence stat (0–100) and its band (the chat's cuts: 15 / 42 / 60). */
    stat: number;
    band: ArkMindBand;
    /** How many kinds of local behaviour it has (3 instinct … 9 brilliant). */
    repertoire: number;
    /** 0–1: investigates new things and the camera. */
    curiosity: number;
    /** 0–1: plays (the young most). */
    play: number;
    /** 0–1: how fast it learns a dangerous place (and how long it remembers). */
    learning: number;
    /** Scene metres it sees (by day, in the open), hears and smells. */
    sight: number;
    hearing: number;
    smell: number;
    /** 0–1: how much of its sight it keeps at night. */
    night: number;
    sense: ArkSense;
    hunt: ArkHunt[];
    forage: ArkForage[];
    defence: ArkDefence[];
    tools: boolean;
    solver: boolean;
    sentinel: boolean;
    alarm: boolean;
    leader: boolean;
    manyEyes: boolean;
    mixed: boolean;
    cleaner: boolean;
    /** Senses warm prey in the dark (pit vipers, pythons, boas). */
    heat: boolean;
    /** Scene metres at which it moves off from a threat (before personality). */
    flight: number;
    /** The food groups it eats and the ones it is in (indices into the table's groups), and species it eats by name. */
    eats: ReadonlySet<number>;
    in: ReadonlySet<number>;
    eatsSpecies: ReadonlySet<string>;
    defaulted: boolean;
    fallback: boolean;
};

const SENSE: Record<string, ArkSense> = {s: "sight", h: "hearing", m: "smell", t: "touch"};
const BANDS = (stat: number): ArkMindBand => (stat < 15 ? "instinct" : stat < 42 ? "practical" : stat < 60 ? "sharp" : "brilliant");
const REPERTOIRE: Record<ArkMindBand, number> = {instinct: 3, practical: 5, sharp: 7, brilliant: 9};
const EMPTY: ReadonlySet<never> = new Set();

function codes<T extends string>(list: string[], value: string): T[] {
    return value.split("").map((c) => list[parseInt(c, 36)] as T).filter(Boolean);
}
function groups(value: string): Set<number> {
    const out = new Set<number>();
    for (let i = 0; i + 1 < value.length; i += 2) out.add(parseInt(value.slice(i, i + 2), 36));
    return out;
}

export function decodeIntelRow(slug: string, row: string): ArkIntelProfile {
    const [mind, senses, hunt, forage, defence, flags, flight, eats, inGroups, prey, plan] = row.split("|");
    const [stat, curiosity, play, learning] = mind.split(",").map(Number);
    const [sight, hearing, smell, night, sense] = senses.split(",");
    return {
        slug,
        plan: plan || "other",
        stat,
        band: BANDS(stat),
        repertoire: REPERTOIRE[BANDS(stat)],
        curiosity: curiosity / 9,
        play: play / 9,
        learning: learning / 9,
        sight: Number(sight),
        hearing: Number(hearing),
        smell: Number(smell),
        night: Number(night) / 9,
        sense: SENSE[sense] ?? "sight",
        hunt: codes<ArkHunt>(TABLE.hunt, hunt),
        forage: codes<ArkForage>(TABLE.forage, forage),
        defence: codes<ArkDefence>(TABLE.defence, defence),
        tools: flags.includes("t"),
        solver: flags.includes("p"),
        sentinel: flags.includes("s"),
        alarm: flags.includes("a"),
        leader: flags.includes("l"),
        manyEyes: flags.includes("m"),
        mixed: flags.includes("x"),
        cleaner: flags.includes("c"),
        heat: flags.includes("h"),
        defaulted: flags.includes("d"),
        flight: Number(flight),
        eats: groups(eats),
        in: groups(inGroups),
        eatsSpecies: prey ? new Set(prey.split(",")) : EMPTY,
        fallback: false
    };
}

/** A body plan's defaults (a model newer than the table). */
const PLAN_SENSES: Record<string, [number, number, number, number]> = {
    quadruped: [28, 30, 26, 4],
    primate: [34, 26, 12, 6],
    flying_bird: [40, 24, 3, 3],
    walking_bird: [36, 22, 3, 3],
    flightless_bird: [44, 22, 4, 6],
    bat: [8, 40, 10, 1.5],
    lizard: [16, 8, 8, 2],
    legless: [8, 6, 14, 1.5],
    turtle: [14, 6, 10, 2],
    amphibian: [10, 10, 4, 1.5],
    fish: [12, 10, 10, 2],
    cephalopod_jelly: [16, 4, 6, 2],
    crustacean: [6, 3, 8, 0.6],
    insect: [4, 3, 6, 0.5],
    flying_insect: [10, 3, 8, 0.5],
    arachnid: [3, 4, 2, 0.5],
    other: [0, 0, 2, 0]
};
const PLAN_DEFENCE: Record<string, ArkDefence[]> = {
    flying_bird: ["fly_off"],
    bat: ["fly_off"],
    flying_insect: ["fly_off"],
    primate: ["flee_tree"],
    amphibian: ["flee_water"],
    turtle: ["armour"],
    fish: ["flee_cover"]
};

const cache = new Map<string, ArkIntelProfile>();

export function intelProfile(slug: string, plan?: string | null, stat?: number | null): ArkIntelProfile {
    const hit = cache.get(slug);
    if (hit) return hit;
    const row = TABLE.species[slug];
    let profile: ArkIntelProfile;
    if (row) profile = decodeIntelRow(slug, row);
    else {
        const s = stat ?? 32;
        const [sight, hearing, smell, flight] = PLAN_SENSES[plan ?? ""] ?? PLAN_SENSES.quadruped;
        profile = {
            slug,
            plan: plan ?? "other",
            stat: s,
            band: BANDS(s),
            repertoire: REPERTOIRE[BANDS(s)],
            curiosity: Math.min(s / 80, 1),
            play: Math.min(s / 90, 1),
            learning: Math.min(Math.max(s / 75, 0.1), 1),
            sight,
            hearing,
            smell,
            night: 0.3,
            sense: "sight",
            hunt: [],
            forage: [],
            defence: PLAN_DEFENCE[plan ?? ""] ?? ["flee_cover"],
            tools: false,
            solver: false,
            sentinel: false,
            alarm: false,
            leader: false,
            manyEyes: false,
            mixed: false,
            cleaner: false,
            heat: false,
            flight,
            eats: EMPTY,
            in: EMPTY,
            eatsSpecies: EMPTY,
            defaulted: true,
            fallback: true
        };
    }
    cache.set(slug, profile);
    return profile;
}

export function hasIntelProfile(slug: string): boolean {
    return slug in TABLE.species;
}

export function foodGroupName(index: number): string | undefined {
    return TABLE.groups[index];
}

/**
 * Whether `predator` could eat `prey` (the ecology's own food links: a food group of the prey's that the predator
 * eats, or the prey by name), with the scene's size sense: a predator never threatens what is much bigger than it,
 * unless it hunts in a pack. Sizes are the 0–100 size stat. Visual only: it decides who looks up, never a meal.
 */
export function canEat(predator: ArkIntelProfile, prey: ArkIntelProfile, predatorSize: number | null, preySize: number | null): boolean {
    if (predator.slug === prey.slug) return false;
    let linked = predator.eatsSpecies.has(prey.slug);
    if (!linked) linked = Array.from(prey.in).some((g) => predator.eats.has(g));
    if (!linked) return false;
    const a = predatorSize ?? 30;
    const b = preySize ?? 20;
    return b <= a + (predator.hunt.includes("pack") ? 18 : 6);
}
