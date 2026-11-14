/**
 * Each water animal's way of life in the water (behaviours pass, lane B6 water, 2026-11-14;
 * docs/ark/behaviour-pass-2026-11/water.md): what the behaviour schedule's water legs, breaths and shore crossings
 * are shaped by. Before, every swimmer had one day: a few seconds' swim to a seeded spot, then the rest of its 80 s
 * slot hanging there on a land animal's beats, so a pilchard swam a third of its day and a tuna slept on the spot.
 *
 * - `cruiser`: never stops (tunas, mackerel, herrings, jacks, billfish, open-water sharks, mantas): it swims its
 *   whole slot along a patrol through its range (asleep it still hangs at its roost: its slow round asleep was
 *   withdrawn, water.md "Left"; the rule's `asleep` pace is kept for it).
 * - `cetacean`: whales and dolphins: the same, at a traveller's pace, up for air on its own rhythm (`breathRhythm`).
 * - `rover`: most other fish, sea turtles, manatees, squid: patrols for most of a slot, then hangs a while.
 * - `reef`: a fish of the reef or of cover: short swims about a small patch, hovering between.
 * - `bottom`: rays, flatfish, sturgeons, catfish: short glides over the bottom, lying still between.
 * - `ambush`: pike, groupers, scorpionfish, anglerfish, morays: still nearly all the time (its swims as before).
 * - `drifter`: jellyfish and comb jellies: a slow drift all slot long.
 * - `jet`, `den`: squid and cuttlefish (rovers that hover), octopus (in its den, out to forage).
 * - `seal`, `croc`, `terrapin`, `hippo`, `otter`, `beaver`, `wallower` (capybara, coypu, tapir), `dipper` (any other
 *   land animal that swims), `frog`, `aquatic` (an axolotl, a clawed frog), `seaturtle`, `skater`: the animals of the
 *   shore, for which side of the water's edge they are on and for how long (`shoreSide`).
 *
 * From `water-life.json` (`scripts/ark-water-life.mts`: stored taxonomy and text, the reason kept in
 * `data/ark/water-life.json`), else from the behaviour profile. Pure and shared: the same for every viewer.
 * Visual only.
 */

import table from "@/ark-scene/water-life.json";
import type {ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";

export type ArkWaterLife = "cruiser" | "cetacean" | "sirenian" | "rover" | "ambush" | "reef" | "bottom" | "drifter" | "jet" | "den" | "walker" | "seal" | "seaturtle" | "croc" | "terrapin" | "hippo" | "otter" | "beaver" | "wallower" | "dipper" | "frog" | "aquatic" | "skater";

const CODES: Readonly<Record<string, ArkWaterLife>> = {c: "cruiser", w: "cetacean", m: "sirenian", r: "rover", a: "ambush", f: "reef", b: "bottom", d: "drifter", j: "jet", o: "den", s: "seal", t: "seaturtle", k: "croc", p: "terrapin", h: "hippo", l: "otter", v: "beaver", u: "wallower", g: "frog", q: "aquatic"};
const ROWS = (table as unknown as {species: Record<string, string>}).species;
const known = new Map<string, ArkWaterLife | null>();

type LifeProfile = Pick<ArkBehaviourProfile, "move" | "moves" | "seabed" | "water" | "roost">;

/**
 * Its way of life in the water, or null for an animal that has none (it neither swims nor lives on the bed; a
 * waterbird keeps the waterbirds' own rules, lane MA3).
 */
export function waterLife(slug: string, profile: LifeProfile): ArkWaterLife | null {
    const hit = known.get(slug);
    if (hit !== undefined) return hit;
    const swims = profile.move === "swim" || profile.moves.includes("swim");
    const row = CODES[ROWS[slug] ?? ""] ?? null;
    let life: ArkWaterLife | null = null;
    // (A walker of the bed, a crab, a lobster, a star, whatever its family: its ground is the floor.)
    if (profile.seabed && profile.move !== "swim") life = "walker";
    // (A frog or a toad that does not swim keeps to the land: its row is for the ones at the water's edge.)
    else if (row && (swims || profile.seabed) && !(row === "seaturtle" && profile.move !== "swim")) life = row;
    else if (profile.water === "seal") life = "seal";
    else if (profile.water === "croc") life = "croc";
    else if (profile.water === "otter") life = "otter";
    else if (profile.water === "skater") life = swims ? "skater" : null;
    else if (profile.water === "amphibian") life = swims ? "frog" : null;
    // (Any other swimmer that lives in the water, a fish the table does not name, a body plan's default: a rover.)
    else if (profile.move === "swim" && (profile.water === "fish" || profile.water === "turtle" || (profile.water === null && profile.roost === "water" && !profile.moves.includes("fly") && !profile.moves.includes("walk")))) life = "rover";
    // (A land animal that also swims, a deer, a boar, a jaguar, a monitor, a water snake: in now and then.)
    else if (swims && profile.move !== "swim" && (profile.water === "mammal" || profile.water === "lizard" || profile.water === "snake")) life = "dipper";
    known.set(slug, life);
    return life;
}

// MARK: Patrols

/** How a way of life swims a slot: the share of it on the move, its pace against its cruise, how wide, whether it sleeps swimming. */
export type PatrolRule = {
    /** The share of an awake slot it swims (1: it never stops), least and most (seeded per slot). */
    share: [number, number];
    /** Its pace as a share of its kind's cruise (`locomotion/swim.ts` swimPaces). */
    pace: number;
    /** Asleep it would keep swimming at this share of its cruise (absent: it sleeps where it sleeps). Not read yet: water.md "Left". */
    asleep?: number;
    /** Its patrol's width against its everyday range (`behaviour-schedule.ts` homeRadius). */
    reach: number;
};

const PATROLS: Readonly<Partial<Record<ArkWaterLife, PatrolRule>>> = {
    cruiser: {share: [1, 1], pace: 0.8, asleep: 0.45, reach: 2.2},
    cetacean: {share: [1, 1], pace: 0.6, asleep: 0.25, reach: 2.6},
    sirenian: {share: [0.5, 0.85], pace: 0.6, reach: 1.2},
    rover: {share: [0.45, 0.85], pace: 0.45, reach: 1},
    seaturtle: {share: [0.5, 0.9], pace: 0.45, reach: 1.4},
    seal: {share: [0.6, 0.95], pace: 0.6, reach: 1.6},
    jet: {share: [0.3, 0.7], pace: 0.4, reach: 1},
    reef: {share: [0.25, 0.55], pace: 0.4, reach: 0.4},
    bottom: {share: [0.15, 0.4], pace: 0.35, reach: 0.8},
    drifter: {share: [1, 1], pace: 0.12, asleep: 0.1, reach: 0.6}
};

/** Its patrol rule, or null for one that keeps the plain swim to its goal (an ambusher, an octopus, anything of the shore). */
export function patrolRule(life: ArkWaterLife | null): PatrolRule | null {
    return (life && PATROLS[life]) ?? null;
}

// MARK: Breaths

/**
 * An air breather's rhythm at sea (seconds): `dive` under, then `blows` breaths `gap` apart, each a `rise` up, a
 * `hold` at the surface and a `fall` back. A dolphin or a porpoise rolls up every half minute, quickly; a great whale
 * blows three to five times a quarter of a minute apart and then dives for minutes; a seal at sea dives for a few
 * minutes and bottles a while; a sea turtle comes up every few minutes; a manatee every three or four.
 */
export type BreathRhythm = {dive: number; blows: number; gap: number; rise: number; hold: number; fall: number};

export function breathRhythm(life: ArkWaterLife | null, length: number, seed: number): BreathRhythm | null {
    const vary = (seed * 7.77) % 1;
    switch (life) {
        case "cetacean":
            // (Under about 4 m: the dolphins and porpoises. Over it: the whales, longer under the bigger they are.)
            if (length < 4.5) return {dive: 20 + 20 * vary, blows: 1, gap: 0, rise: 1.4, hold: 0.8, fall: 1.8};
            return {dive: Math.min(180 + 18 * length, 480) * (0.8 + 0.4 * vary), blows: 3 + Math.floor(vary * 3), gap: 14 + 4 * vary, rise: 3, hold: 2.5, fall: 3.5};
        case "seal":
            return {dive: 120 + 120 * vary, blows: 1, gap: 0, rise: 3, hold: 25 + 15 * vary, fall: 3};
        case "seaturtle":
            return {dive: 180 + 150 * vary, blows: 1, gap: 0, rise: 4, hold: 3, fall: 5};
        case "sirenian":
            return {dive: 150 + 90 * vary, blows: 1, gap: 0, rise: 4, hold: 3, fall: 5};
        default:
            return null;
    }
}

const smooth = (u: number) => u * u * (3 - 2 * u);

/** How far up into a breath it is (0 under, 1 at the surface) at `clock` seconds on its rhythm; pure in the clock and its seed. */
export function rhythmBreath(rhythm: BreathRhythm, seed: number, clock: number): number {
    const one = rhythm.rise + rhythm.hold + rhythm.fall;
    const gap = Math.max(rhythm.gap, one);
    const cycle = rhythm.dive + rhythm.blows * gap;
    const at = (((clock + seed * cycle) % cycle) + cycle) % cycle;
    if (at < rhythm.dive) return 0;
    const u = (at - rhythm.dive) % gap;
    if (u < rhythm.rise) return smooth(u / rhythm.rise);
    if (u < rhythm.rise + rhythm.hold) return 1;
    if (u < one) return smooth(1 - (u - rhythm.rise - rhythm.hold) / rhythm.fall);
    return 0;
}

// MARK: The shore

/**
 * Which side of the water's edge an animal of the shore is on at an hour of the island's day, for a bout at a time
 * (a seal hauls out for hours and goes to sea for hours; a crocodile basks on the bank through the morning and is in
 * the water the rest of the day and the night; a terrapin basks for an hour here and there while the sun is up; a
 * hippo is in the water by day and ashore to graze by night; a beaver is in the water at dusk and by night; an otter
 * fishes for an hour or so and lies up; a capybara wallows for a good part of the day; a frog is in and out at the
 * edge; a deer, a boar or a monitor that swims goes in a few times a day for ten minutes; a whirligig, a sea turtle, an
 * axolotl never leave the water). "water" or "land": the schedule keeps its goals on that side; null: no rule.
 * Pure in the hour, the world time and its id.
 */
export type ShoreSide = "water" | "land" | null;

/** A seeded 0…1 from an id and a block of time. */
function roll(id: string, block: number): number {
    let h = 2166136261;
    const text = `${id}#shore#${block}`;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return ((h >>> 0) % 10007) / 10007;
}

/** Bouts by chance: `seconds` long, in the water for `day` of them while the sun is up and `night` of them after dark. */
const BOUTS: Readonly<Partial<Record<ArkWaterLife, {seconds: number; day: number; night: number}>>> = {
    seal: {seconds: 10800, day: 0.45, night: 0.7},
    otter: {seconds: 5400, day: 0.4, night: 0.4},
    wallower: {seconds: 2400, day: 0.35, night: 0.2},
    frog: {seconds: 1800, day: 0.45, night: 0.45},
    dipper: {seconds: 600, day: 0.04, night: 0.04}
};

export function shoreSide(life: ArkWaterLife | null, id: string, hours: number, epochSeconds: number): ShoreSide {
    if (!life) return null;
    // (Its own hour: up to half an hour either side, so a colony does not turn as one.)
    const own = (((hours + (roll(id, -1) - 0.5)) % 24) + 24) % 24;
    const bouts = BOUTS[life];
    if (bouts) {
        const shifted = epochSeconds + roll(id, -2) * bouts.seconds;
        const block = Math.floor(shifted / bouts.seconds);
        // (Day or night as its bout began: a bout is never cut short by the sun.)
        const began = (((own - (shifted - block * bouts.seconds) / 3600) % 24) + 24) % 24;
        return roll(id, block) < (began >= 6 && began < 19 ? bouts.day : bouts.night) ? "water" : "land";
    }
    switch (life) {
        case "croc":
            // On the bank through the morning (and, one in three, a spell in the afternoon); in the water otherwise.
            if (own >= 7.5 && own < 11) return "land";
            if (own >= 14.5 && own < 16.5 && roll(id, Math.floor(epochSeconds / 86400)) < 0.35) return "land";
            return "water";
        case "terrapin":
            // Out on the bank or a log for an hour at a time, about two hours in five, while the sun is up; in the water otherwise.
            return own >= 8 && own < 16.5 && roll(id, Math.floor((epochSeconds + roll(id, -2) * 3600) / 3600)) < 0.4 ? "land" : "water";
        case "hippo":
            return own >= 5.5 && own < 18.5 ? "water" : "land";
        case "beaver":
            return own >= 18 || own < 6 ? "water" : "land";
        case "skater":
        case "seaturtle":
        case "aquatic":
            return "water";
        default:
            return null;
    }
}
