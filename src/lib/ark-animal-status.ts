/**
 * What an animal on the Ark is doing, what it is about to do, its short log and its bars (owner, 2026-11-12: "should
 * be showing all the animals logs and what its doing or goal e.g. currently looking for food or looking to build a
 * nest or resting"; "bars above animals too when clicked on to see how far they from dieing or hunger"). Decision 240.
 *
 * Pure: the scene works out the inputs (`src/ark-scene/animal-status.ts`, from the behaviour schedule the animals
 * already run) and the server's record; this names them, merges the log and does the bars' maths. The tap card on
 * /ark and the apps' embed (`ark:selected`, `ark:status`) read the same `ArkAnimalStatus`.
 *
 * - **Activity** (`ARK_ACTIVITIES`): one key per thing the schedule has an animal doing (its slot's doing and recipe,
 *   encounter hunting's forays, a zoo's feeding time), said in plain words by `ark.activity.<key>`. The schedule is a
 *   pure function of the shared clock and the animal's id, so every viewer reads the same activity at the same moment.
 * - **Goal**: what its next slots are for (the first that differs from now), or, asleep, when it wakes.
 * - **Log**: the server's record of this animal (it came aboard or was born, a meal, young, a clutch, a pair bred: only
 *   what the snapshot, its life story or the event log say) and what its schedule had it doing over its last slots.
 *   Newest first. Nothing is made up: an entry is either the server's or the schedule's.
 * - **Bars** (card truth, 2026-11-13): how fed it is over its day and its energy, both from the schedule it already runs
 *   (its eating and waking slots: visual only, the same for every viewer), the server's hungry over both; how far from
 *   dying (the server's condition: hungry, old); its age against its lifespan only when the data has a lifespan (the
 *   public reads don't send one yet, so that bar is not drawn).
 */

import type {ArkCondition} from "@/ark-scene/types";
import {fillArkWords} from "@/lib/ark-words";

// MARK: Activities

/** Everything the card says an animal is doing, in `ark.activity.<key>`. */
export const ARK_ACTIVITIES = [
    "food",
    "grazing",
    "browsing",
    "hunting",
    "waiting",
    "prowling",
    "fishing",
    "drinking",
    "resting",
    "sleeping",
    "nest",
    "eggs",
    "playing",
    "watching",
    "wary",
    "swimming",
    "basking",
    "home",
    "toWater",
    "wandering",
    "flying",
    "courting",
    "sparring",
    "grooming",
    "bathing",
    "calling",
    "digging",
    "climbing",
    "hiding",
    "breathing",
    "flowers",
    "light",
    "feeding",
    "about"
] as const;
export type ArkActivityKey = typeof ARK_ACTIVITIES[number];

/** The schedule's recipes (`recipe-templates.ts`) that say more than their doing. */
const RECIPE_ACTIVITY: Record<string, ArkActivityKey> = {
    nest_build: "nest",
    beach_nest: "nest",
    incubate_sit: "eggs",
    court_display: "courting",
    court_dance: "courting",
    strut_display: "courting",
    pushup: "courting",
    antler_clash: "sparring",
    horn_clash: "sparring",
    jaw_spar: "sparring",
    box_spar: "sparring",
    lizard_contest: "sparring",
    wrestle: "sparring",
    perch_plunge: "fishing",
    air_plunge: "fishing",
    talon_grab: "fishing",
    wade_spear: "fishing",
    bill_sweep: "fishing",
    pouch_scoop: "fishing",
    surface_dive: "fishing",
    chase_fish: "fishing",
    river_fish: "fishing",
    bat_trawl: "fishing",
    pounce: "hunting",
    hover_drop: "hunting",
    aerial_hawk: "hunting",
    hawk_insects: "hunting",
    bat_hawk: "hunting",
    dabble: "food",
    shell_tool: "food",
    stick_tool: "food",
    root_dig: "food",
    worm_pull: "food",
    probe_feed: "food",
    drum_bark: "food",
    cache_food: "food",
    groom_self: "grooming",
    preen_stretch: "grooming",
    allogroom: "grooming",
    bathe: "bathing",
    wallow: "bathing",
    dust_bathe: "bathing",
    roll: "bathing",
    call_bout: "calling",
    bask_sun: "basking",
    wing_dry: "resting",
    stretch_yawn: "resting",
    bury_sand: "hiding",
    dig_burrow: "digging",
    molehills: "digging",
    scent_mark: "wandering",
    murmuration: "flying",
    v_formation: "flying",
    mixed_follow: "wandering"
};

/** What a recipe episode is, as the card says it (null: one that says no more than its doing). */
export function arkRecipeActivity(recipe: string | null | undefined): ArkActivityKey | null {
    return recipe ? RECIPE_ACTIVITY[recipe] ?? null : null;
}

/** The schedule's doings (`behaviour-schedule.ts` ArkDoing). */
const DOING_ACTIVITY: Record<string, ArkActivityKey> = {
    sleep: "sleeping",
    to_roost: "home",
    watch: "watching",
    rest: "resting",
    idle: "resting",
    perch: "resting",
    wander: "wandering",
    crawl: "wandering",
    forage: "food",
    graze: "grazing",
    browse: "browsing",
    drink: "drinking",
    fly: "flying",
    soar: "flying",
    swim: "swimming",
    dive: "swimming",
    breathe: "breathing",
    bask: "basking",
    burrow: "digging",
    climb: "climbing",
    groom: "grooming",
    hide: "hiding",
    visit_flowers: "flowers",
    circle_light: "light",
    play: "playing"
};

export type ArkActivityInput = {
    /** Its slot's doing (the schedule), or null off the schedule. */
    doing: string | null;
    recipe?: string | null;
    /** Off the schedule: the behaviour state's (asleep, in the air, up for air). */
    asleep?: boolean;
    airborne?: boolean;
    breathing?: boolean;
    /** Walking its forays under encounter hunting (the server's next hunt has come and it is awake). */
    hunting?: boolean;
    /** A zoo animal's feeding time (its enclosure's station). */
    feeding?: boolean;
    /** Still on its way to the slot's goal. */
    travelling?: boolean;
    /** Watching a predator it saw (the shared wariness). */
    wary?: boolean;
    /** A bird or another flyer: its "grazing" (a seed-eater's, on the ground) is looking for food. */
    flyer?: boolean;
    /**
     * Its slot holds it still where it goes (`SlotPlan.still`: in the water, or up off the ground, where a stay's steps
     * never move it). A stalk there is a wait.
     */
    still?: boolean;
};

/** The one key for what it is doing: the same input, the same key, for every viewer. */
export function arkActivityKey(input: ArkActivityInput): ArkActivityKey {
    if (input.hunting) return "hunting";
    if (input.doing === null) return input.asleep ? "sleeping" : input.breathing ? "breathing" : input.airborne ? "flying" : "about";
    if (input.doing === "sleep") return "sleeping";
    if (input.feeding && input.doing !== "to_roost") return "feeding";
    if (input.wary) return "wary";
    if (input.travelling && input.doing === "drink") return "toWater";
    const byRecipe = input.recipe ? RECIPE_ACTIVITY[input.recipe] : undefined;
    // The schedule's stalk (visual only: no prey is chosen and nothing is caught; the server hunts only by encounter):
    // said as what the body does. Held still where it goes (in the water) it is waiting for prey; on the ground it
    // creeps along its range on its prey's side, on the prowl; on its way to where it waits, it is on the prowl too.
    // Never "hunting": that is the server's encounter hunt, a due predator walking its forays (`input.hunting`).
    const stalk: ArkActivityKey | undefined = input.doing === "stalk" ? (input.still && !input.travelling ? "waiting" : "prowling") : undefined;
    const key = byRecipe ?? stalk ?? DOING_ACTIVITY[input.doing] ?? "about";
    return input.flyer && (key === "grazing" || key === "browsing") ? "food" : key;
}

// MARK: The status

/** A server record's kind, as the card's log says it. */
export type ArkRecordKind = "arrived" | "born" | "hatched" | "meal" | "young" | "laid" | "mated";

/**
 * One line of an animal's own log. `record`: the server's (stamped with its Ark day); `schedule`: what its schedule had
 * it doing from that slot on (stamped with the island's clock).
 */
export type ArkStatusLogEntry = {
    id: string;
    source: "record" | "schedule";
    /** When (epoch ms): the order. */
    at: number;
    /** The record's Ark day (its stamp), or null. */
    day: number | null;
    /** The record's kind, or `activity` for the schedule's. */
    kind: ArkRecordKind | "activity";
    activity?: ArkActivityKey;
    /** How it came aboard (an arrival), when the server says. */
    via?: "capture" | "step" | null;
    /** A meal's prey, by name. */
    other?: string | null;
    /** Young in a litter, eggs in a clutch. */
    count?: number | null;
};

export type ArkBarTone = "good" | "warn" | "bad";
/** One bar: how full (0–1, full is good), its colour, and the state it says in words. */
export type ArkStatusBar = {
    value: number;
    tone: ArkBarTone;
    state: "fed" | "low" | "eating" | "hungry" | "good" | "old" | "life" | "awake" | "asleep";
    /** Energy: since when it has been awake (or asleep), epoch seconds on the shared clock. */
    since?: number;
};
export type ArkStatusBarKey = "fed" | "health" | "energy" | "age";
export type ArkStatusBars = {fed: ArkStatusBar | null; health: ArkStatusBar | null; energy: ArkStatusBar | null; age: ArkStatusBar | null};
/** The bars in the order they are drawn (over the animal) and said (the card, the apps). */
export const ARK_STATUS_BAR_KEYS: readonly ArkStatusBarKey[] = ["fed", "health", "energy", "age"];

export type ArkStatusGoal =
    /** What a later slot is for, from when (epoch seconds). */
    | {kind: "next"; activity: ArkActivityKey; at: number}
    /** Asleep: when it wakes (epoch seconds, the island's clock). */
    | {kind: "wakes"; at: number};

export type ArkAnimalStatus = {
    id: string;
    activity: ArkActivityKey | null;
    /** Since when it has been at it (epoch seconds), when the schedule knows. */
    since: number | null;
    goal: ArkStatusGoal | null;
    /** Newest first. */
    log: ArkStatusLogEntry[];
    bars: ArkStatusBars;
};

/** At most this many log lines (the card scrolls past the first few). */
export const ARK_STATUS_LOG_MAX = 8;

/**
 * The schedule's last slots and the record, newest first, at most `max` lines: the record first (its arrival or birth
 * always, then its newest lines, leaving room for at least three of the schedule's), the schedule's newest after.
 */
export function arkStatusLog(schedule: readonly ArkStatusLogEntry[], record: readonly ArkStatusLogEntry[], max = ARK_STATUS_LOG_MAX): ArkStatusLogEntry[] {
    const seen = new Set<string>();
    const once = (list: readonly ArkStatusLogEntry[]) => [...list].filter((entry) => {
        if (seen.has(entry.id) || !Number.isFinite(entry.at)) return false;
        seen.add(entry.id);
        return true;
    }).sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
    const records = once(record);
    const slots = once(schedule);
    const isOrigin = (entry: ArkStatusLogEntry) => entry.kind === "arrived" || entry.kind === "born" || entry.kind === "hatched";
    const origin = records.find(isOrigin) ?? null;
    const others = records.filter((entry) => entry !== origin).slice(0, Math.max(max - Math.min(slots.length, 3) - (origin ? 1 : 0), 0));
    const kept = [...others, ...(origin ? [origin] : [])];
    const all = [...kept, ...slots.slice(0, Math.max(max - kept.length, 0))];
    return all.sort((a, b) => b.at - a.at || (a.source === b.source ? a.id.localeCompare(b.id) : a.source === "schedule" ? -1 : 1));
}

// MARK: The record

/** A record line the page or the log noted for an animal (the life story's last meal, the event log's young). */
export type ArkRecordNote = {animalId: string; id: string; kind: ArkRecordKind; at: number; day: number | null; other?: string | null; count?: number | null; via?: "capture" | "step" | null};

/** An animal's first record line, from the snapshot: it came aboard (when), or was born (its born day). */
export function arkOriginEntry(animal: {id: string; arrived_at: string; origin?: "arrived" | "born"; born_ark_day?: number | null; source?: "capture" | "step" | null}, hatched = false): ArkStatusLogEntry {
    const born = animal.origin === "born";
    const day = typeof animal.born_ark_day === "number" && Number.isFinite(animal.born_ark_day) ? Math.floor(animal.born_ark_day) : null;
    const at = Date.parse(animal.arrived_at);
    return {id: `origin:${animal.id}`, source: "record", at: Number.isFinite(at) ? at : 0, day, kind: born ? (hatched ? "hatched" : "born") : "arrived", via: born ? null : animal.source ?? null};
}

/** The Ark day at a moment (`voyage_ark_day`: 1 Ark year = 14 real days), from the voyage's start. */
export function arkDayOf(ms: number, voyageStartMs: number | null): number | null {
    if (voyageStartMs === null || !Number.isFinite(voyageStartMs) || !Number.isFinite(ms)) return null;
    return (ms - voyageStartMs) / ((86_400_000 * 14) / 365);
}

/**
 * The server's events as record lines, per animal they are about: a meal for its eater, young for each parent (and
 * the birth for the young itself), a clutch and a pair bred for each parent. Only animals named by the event.
 */
export function arkRecordNotesFromEvents(events: ReadonlyArray<{id: string; kind: string; at: string; ark_day: number | null; animal: {id: string} | null; other: {id: string; name: string} | null; parents: string[]; from_egg: boolean; eggs: number | null; source?: "capture" | "step" | null}>): ArkRecordNote[] {
    const notes: ArkRecordNote[] = [];
    const litters = new Map<string, ArkRecordNote[]>();
    for (const event of events) {
        const at = Date.parse(event.at);
        if (!Number.isFinite(at)) continue;
        const day = typeof event.ark_day === "number" ? Math.floor(event.ark_day) : null;
        switch (event.kind) {
            case "meal":
                if (event.animal && event.other) notes.push({animalId: event.animal.id, id: `event:${event.id}`, kind: "meal", at, day, other: event.other.name});
                break;
            case "birth": {
                if (event.animal) notes.push({animalId: event.animal.id, id: `event:${event.id}`, kind: event.from_egg ? "hatched" : "born", at, day});
                // One line per litter for each parent, its young counted.
                const key = `${event.at}|${[...event.parents].sort().join(",")}|${event.from_egg ? 1 : 0}`;
                const known = litters.get(key);
                if (known) {
                    for (const note of known) note.count = (note.count ?? 1) + 1;
                    break;
                }
                const mine = event.parents.map((parent) => ({animalId: parent, id: `young:${event.id}:${parent}`, kind: "young" as const, at, day, count: 1}));
                litters.set(key, mine);
                notes.push(...mine);
                break;
            }
            case "laid":
                for (const parent of event.parents.length ? event.parents : event.animal ? [event.animal.id] : []) notes.push({animalId: parent, id: `laid:${event.id}:${parent}`, kind: "laid", at, day, count: event.eggs});
                break;
            case "mated":
                for (const parent of event.parents) notes.push({animalId: parent, id: `mated:${event.id}:${parent}`, kind: "mated", at, day});
                break;
            case "arrival":
                if (event.animal) notes.push({animalId: event.animal.id, id: `event:${event.id}`, kind: "arrived", at, day, via: event.source ?? null});
                break;
            default:
                break;
        }
    }
    return notes;
}

/** The life story's last meal (`voyage_animal_life_v1`) as a record line, its Ark day from the voyage's start. */
export function arkRecordNoteFromLife(id: string, life: {last_meal: {at: string | null; prey: string} | null} | null, voyageStartMs: number | null): ArkRecordNote | null {
    const meal = life?.last_meal;
    const at = meal?.at ? Date.parse(meal.at) : NaN;
    if (!meal || !Number.isFinite(at)) return null;
    const day = arkDayOf(at, voyageStartMs);
    return {animalId: id, id: `meal:${id}:${meal.at}`, kind: "meal", at, day: day === null ? null : Math.floor(day), other: meal.prey};
}

// MARK: The bars

export function arkBarTone(value: number): ArkBarTone {
    return value >= 0.6 ? "good" : value >= 0.3 ? "warn" : "bad";
}

export type ArkBarsInput = {
    /** The server's condition (`voyage_public_v2`): hungry, old, or well-fed; null from an older server. */
    condition: ArkCondition | null | undefined;
    /** The Ark day now (the snapshot's, moved on by the clock). */
    arkDay: number | null;
    /** How fed it is over its day (`arkFed`), when it is on its schedule. */
    fed?: ArkFed | null;
    /** Its energy over its day (`arkEnergy`), when it is on its schedule and sleeps. */
    energy?: ArkEnergy | null;
    /** Its born (or boarded) Ark day and its wild lifespan in days: the age bar only when both are known. */
    bornDay?: number | null;
    lifespanDays?: number | null;
};

/**
 * - Fed: its daily hunger over the day it is seen living (`arkFed`, from its schedule's own eating and waking), between
 *   `ARK_FED_FLOOR` and full; hungry (the server: it can starve) is nearly empty and red, whatever its day says. Off the
 *   schedule (reduced motion, a micro animal, a replay's act), no fed bar. (Not the server's meal clock: that counts the
 *   rare kills of other Ark animals, scaled rare so populations last, while its everyday food is the unmodelled
 *   background; it is no animal's hunger. A kill still shows in its log when one lands, and fills it.)
 * - Health, how far from dying: old (at least four fifths of its wild lifespan gone: the read's `old_from_life_fraction`)
 *   is a fifth, red; hungry is amber; otherwise full.
 * - Energy: its day's sleep and wake (`arkEnergy`), when it sleeps.
 * - Age: the life it has left, from its lifespan, when known.
 */
export function arkStatusBars(input: ArkBarsInput): ArkStatusBars {
    const {condition} = input;
    const energy = energyBar(input.energy ?? null);
    const day = input.fed && Number.isFinite(input.fed.value) ? input.fed : null;
    const fed: ArkStatusBar | null = condition === "hungry" ? {value: 0.12, tone: "bad", state: "hungry"} : day ? fedBar(day) : null;
    if (!condition) return {fed, health: null, energy, age: ageBar(input)};
    const health: ArkStatusBar = condition === "old" ? {value: 0.2, tone: "bad", state: "old"} : condition === "hungry" ? {value: 0.45, tone: "warn", state: "hungry"} : {value: 1, tone: "good", state: "good"};
    return {fed, health, energy, age: ageBar(input)};
}

function fedBar(fed: ArkFed): ArkStatusBar {
    const value = Math.min(Math.max(fed.value, ARK_FED_FLOOR), 1);
    return {value: round(value), tone: arkBarTone(value), state: fed.eating ? "eating" : value < 0.6 ? "low" : "fed"};
}

// MARK: Fed (its daily hunger)

/** The lowest its daily hunger takes it: amber, "getting hungry", never red and never empty (nothing starves of this). */
export const ARK_FED_FLOOR = 0.3;
/** Where the reckoning starts, the oldest of the waking slots it looks back over (it has always met a floor or a meal by now). */
const FED_START = 0.65;

/** What it eats, as its daily hunger reads it: big rare meals (prey), small rich ones (mixed), or food that is poor and slow (plants). */
export type ArkFeeder = "prey" | "mixed" | "plants";
const FEEDER: Record<string, ArkFeeder> = {meat: "prey", fish: "prey", carrion: "prey", blood: "prey", grazer: "plants", browser: "plants", algae: "plants", detritus: "plants", filter: "plants"};
export function arkFeeder(diet: string | null | undefined): ArkFeeder {
    return (diet && FEEDER[diet]) || "mixed";
}

/**
 * Per feeder at a body length of a metre, how fast it runs down while awake and not eating, per minute of the shared
 * clock: a plant-eater fastest (poor food), a predator slowest (rich food, rarely).
 */
const FED_DRAIN_PER_MINUTE: Record<ArkFeeder, number> = {plants: 0.05, mixed: 0.04, prey: 0.03};
/** Where its eating and its burning balance, over the waking hours it looks back on: it eats what it burns. */
const FED_BALANCE = 0.68;

export type ArkFedRates = {drain: number};

/**
 * Its rate from what it eats (the stored diet) and its size (its body length, m): a smaller body burns through its
 * food faster, as metabolism goes per unit of mass (Kleiber: mass to the -1/4, length to the -3/4), held to half and
 * double the metre's rate. `drain`: per second.
 */
export function arkFedRates(diet: string | null | undefined, lengthMetres: number | null | undefined): ArkFedRates {
    const length = typeof lengthMetres === "number" && lengthMetres > 0 ? lengthMetres : 1;
    const size = Math.min(Math.max(Math.pow(length, -0.75), 0.5), 2);
    return {drain: (FED_DRAIN_PER_MINUTE[arkFeeder(diet)] * size) / 60};
}

/** One slot of its schedule as its daily hunger reads it: when, and whether it is awake and eating (its card's activity). */
export type ArkFedSlot = {start: number; end: number; awake: boolean; eating: boolean};
export type ArkFed = {value: number; eating: boolean};

/**
 * How fed it is now, over its schedule's own day (`slots`: contiguous, oldest first, the last holding `epoch`): awake and
 * not eating, it runs down at its rate to `ARK_FED_FLOOR`; eating (grazing, browsing, foraging, a catch, a zoo's
 * feeding: whatever its card says is eating), it fills towards full; asleep, it holds. How fast a meal fills it is set
 * so that over the slots it looks back on it eats what it burns (`FED_BALANCE`: an animal that eats in half its waking
 * slots fills as fast as it empties, one that rarely eats fills fast when it does), so the bar moves round the middle of
 * its range with its own run of meals and idle spells, a few percent a minute either way, rather than sitting full. A
 * meal of the server's (`meals`, epoch seconds: a kill that landed) fills it. Worked from the oldest slot at
 * `FED_START`: over a couple of waking hours it has always met the floor or a meal, so where it started no longer
 * shows. A model of the day it is seen living, not a server measure: visual only, a pure function of the shared clock
 * and its schedule, the same for every viewer. Null with no slots.
 */
export function arkFed(slots: readonly ArkFedSlot[], epoch: number, rates: ArkFedRates, meals: readonly number[] = []): ArkFed | null {
    if (!slots.length || !Number.isFinite(epoch)) return null;
    let value = FED_START;
    const awake = slots.filter((slot) => slot.awake);
    const share = Math.min(Math.max(awake.length ? awake.filter((slot) => slot.eating).length / awake.length : 0, 0.05), 0.95);
    // (Balance: share * (1 - FED_BALANCE) / fill = (1 - share) * drain.)
    const fill = Math.max((share * (1 - FED_BALANCE)) / ((1 - share) * Math.max(rates.drain, 1e-6)), 1);
    const run = (slot: ArkFedSlot, seconds: number) => {
        if (!slot.awake || seconds <= 0) return;
        value = slot.eating ? 1 - (1 - value) * Math.exp(-seconds / fill) : Math.max(value - rates.drain * seconds, ARK_FED_FLOOR);
    };
    const kills = [...meals].filter((m) => Number.isFinite(m) && m <= epoch).sort((a, b) => a - b);
    let eating = false;
    for (const slot of slots) {
        if (slot.start > epoch) break;
        eating = slot.awake && slot.eating;
        let at = slot.start;
        const to = Math.min(slot.end, epoch);
        for (const kill of kills) {
            if (kill < at || kill >= to) continue;
            run(slot, kill - at);
            value = 1;
            at = kill;
        }
        run(slot, to - at);
        if (slot.end > epoch) break;
    }
    return {value: round(Math.min(Math.max(value, ARK_FED_FLOOR), 1)), eating};
}

// MARK: Energy

/** Its energy at the end of its waking hours, at the lowest: amber, tired, never red (tired is not dying). */
export const ARK_ENERGY_FLOOR = 0.3;

export type ArkEnergy = {value: number; awake: boolean; since: number};

/**
 * Its energy over its day, from its schedule's own sleep and wake (`awake`: is it awake at a moment, epoch seconds,
 * sampled every `step` seconds back from `epoch`; the scene's reads its slot's start, as the schedule does). Awake, it
 * runs down evenly, at the rate that takes its day's waking hours from full to `ARK_ENERGY_FLOOR`; asleep, it fills at
 * the rate its day's sleeping hours take to fill it, never past full. One waking spell a day ends at the floor; two (a
 * crepuscular animal's dawn and dusk) each take it half way, the sleep between filling it again. Worked over the two
 * days to now from full. `since`: when its present run of waking (or sleep) began, from `snap` (its slot's start) when
 * given. A model of the day it is seen living, not a server measure: visual only, a pure function of the shared clock
 * and its schedule, the same for every viewer. Null for one that never sleeps in a day (or is never awake).
 */
export function arkEnergy(awake: (epochSeconds: number) => boolean, epoch: number, step = 80, snap?: (epochSeconds: number) => number): ArkEnergy | null {
    if (!Number.isFinite(epoch) || !(step > 0)) return null;
    const perDay = Math.round(86_400 / step);
    const states: boolean[] = [];
    // Oldest first: the step starting at epoch - k * step, for k = 2 days … 1.
    for (let k = 2 * perDay; k >= 1; k--) states.push(awake(epoch - k * step));
    let up = 0;
    for (let i = states.length - perDay; i < states.length; i++) if (states[i]) up++;
    const down = perDay - up;
    if (!up || !down) return null;
    const drain = (1 - ARK_ENERGY_FLOOR) / up;
    const fill = (1 - ARK_ENERGY_FLOOR) / down;
    let value = 1;
    for (const on of states) value = on ? Math.max(value - drain, ARK_ENERGY_FLOOR) : Math.min(value + fill, 1);
    const now = awake(epoch);
    let first = epoch;
    for (let i = states.length - 1; i >= 0 && states[i] === now; i--) first = epoch - (states.length - i) * step;
    return {value: round(value), awake: now, since: snap ? snap(first) : first};
}

function energyBar(energy: ArkEnergy | null): ArkStatusBar | null {
    if (!energy || !Number.isFinite(energy.value)) return null;
    const value = Math.min(Math.max(energy.value, ARK_ENERGY_FLOOR), 1);
    return {value: round(value), tone: arkBarTone(value), state: energy.awake ? "awake" : "asleep", since: energy.since};
}

function ageBar(input: ArkBarsInput): ArkStatusBar | null {
    const {bornDay, lifespanDays, arkDay} = input;
    if (typeof bornDay !== "number" || typeof lifespanDays !== "number" || arkDay === null || !(lifespanDays > 0)) return null;
    const left = Math.min(Math.max(1 - (arkDay - bornDay) / lifespanDays, 0), 1);
    return {value: round(left), tone: arkBarTone(left), state: "life"};
}

function round(value: number): number {
    return Math.round(Math.min(Math.max(value, 0), 1) * 1000) / 1000;
}

// MARK: Words

/** `ark.activity` in the locale files: each activity in plain words, and the live log's lines of the schedule's moments. */
export type ArkActivityWords = Record<ArkActivityKey, string> & {
    /** The live log's tag on a line of the schedule (happening now, anywhere on the Ark), and what it means. */
    tag: string;
    tagNote: string;
    log: ArkActivityLogWords;
};
export type ArkActivityLogWords = {
    hunting: string;
    fishing: string;
    eggs: string;
    playing: string;
    toWater: string;
    home: string;
    flock: string;
    /** Any other change of what an animal is doing ("A Red Deer is drinking"), and a group's by its leader. */
    doing: string;
    group: string;
    breathing: string;
    calling: string;
    bathing: string;
    feeding: string;
};

/** `ark.card` in the locale files: the tap card's lines and bars. */
export type ArkCardWords = {
    now: string;
    next: string;
    wakes: string;
    logTitle: string;
    day: string;
    meal: string;
    youngOne: string;
    youngOther: string;
    laid: string;
    mated: string;
    fed: string;
    health: string;
    age: string;
    fedLow: string;
    healthGood: string;
    lifeLeft: string;
    /** The energy bar (card truth, 2026-11-13), and what it says: awake (or asleep) since a time on the island's clock. */
    energy: string;
    awakeSince: string;
    asleepSince: string;
};

/** English, as `en.json` has it: the embed's fallback until (or unless) its words read. */
export const ARK_ACTIVITY_ENGLISH: ArkActivityWords = {
    food: "looking for food",
    grazing: "grazing",
    browsing: "browsing on leaves",
    hunting: "hunting",
    waiting: "waiting for prey",
    prowling: "on the prowl",
    fishing: "fishing",
    drinking: "drinking",
    resting: "resting",
    sleeping: "sleeping",
    nest: "building a nest",
    eggs: "sitting on its eggs",
    playing: "playing",
    watching: "keeping watch",
    wary: "keeping clear of a predator",
    swimming: "swimming",
    basking: "basking in the sun",
    home: "heading home",
    toWater: "heading to water",
    wandering: "wandering",
    flying: "flying",
    courting: "courting",
    sparring: "sparring with a rival",
    grooming: "grooming",
    bathing: "bathing",
    calling: "calling",
    digging: "digging",
    climbing: "climbing",
    hiding: "hiding",
    breathing: "coming up for air",
    flowers: "visiting flowers",
    light: "circling a light",
    feeding: "at feeding time",
    about: "out and about",
    tag: "Now",
    tagNote: "Happening now on the Ark’s shared clock, the same for everyone. Solid lines are the Ark’s record.",
    log: {
        hunting: "{aAnimal} is hunting",
        fishing: "{aAnimal} is fishing",
        eggs: "{aAnimal} is sitting on its eggs",
        playing: "A young {animal} is playing",
        toWater: "{count} {animals} are heading to water",
        home: "{count} {animals} are heading home",
        flock: "{count} {animals} took to the air",
        doing: "{aAnimal} is {activity}",
        group: "{count} {animals} are {activity}",
        breathing: "{aAnimal} came up for air",
        calling: "{aAnimal} is calling",
        bathing: "{aAnimal} is bathing",
        feeding: "Feeding time for {aAnimal}"
    }
};

export const ARK_CARD_ENGLISH: ArkCardWords = {
    now: "Now: {activity}",
    next: "Next: {activity}",
    wakes: "Wakes about {time}",
    logTitle: "Its log",
    day: "Day {day}",
    meal: "Ate {aPrey}",
    youngOne: "Had a young one",
    youngOther: "Had {count} young",
    laid: "Laid a clutch of eggs",
    mated: "Bred with its mate",
    fed: "Fed",
    health: "Health",
    age: "Life left",
    fedLow: "Getting hungry",
    healthGood: "In good health",
    lifeLeft: "{percent} of its life left",
    energy: "Energy",
    awakeSince: "Awake since {time}",
    asleepSince: "Asleep since {time}"
};

/** The words a status needs: the activities, the card's, and the life story's and the story's few it borrows. */
export type ArkStatusWords = {
    activity: ArkActivityWords;
    card: ArkCardWords;
    /** "Came aboard with a capture" / "after a step that worked". */
    story: {capture: string; generic: string};
    /** "Born on the Ark", "Hatched on the Ark", and the condition words. */
    life: {bornAboard: string; hatchedAboard: string; well_fed: string; hungry: string; old: string};
    /** "a {animal}" / "an {animal}". */
    replay: {a: string; an: string};
};

function capitalised(text: string): string {
    return text ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}

function withArticle(name: string, words: ArkStatusWords): string {
    const an = /^[aeiou]/i.test(name) && !/^(uni|eu|one|use|usu|ura)/i.test(name);
    return fillArkWords(an ? words.replay.an : words.replay.a, {animal: name});
}

/** The island's clock (`ark-clock.ts` islandHours: UTC plus the scene's offset, 0) as the reader writes a time. */
export function arkIslandTime(epochSeconds: number, locale: string, offsetHours = 0): string {
    try {
        return new Intl.DateTimeFormat(locale, {hour: "2-digit", minute: "2-digit", timeZone: "UTC"}).format(new Date((epochSeconds + offsetHours * 3600) * 1000));
    } catch {
        const d = new Date((epochSeconds + offsetHours * 3600) * 1000);
        return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    }
}

export type ArkStatusText = {
    now: string | null;
    next: string | null;
    log: Array<{id: string; source: "record" | "schedule"; stamp: string; text: string}>;
    bars: Array<{key: ArkStatusBarKey; label: string; value: number; tone: ArkBarTone; text: string}>;
};

/** A status as the reader reads it (the card on /ark; the embed sends it with `ark:status` for the apps' cards). */
export function arkStatusText(status: ArkAnimalStatus, words: ArkStatusWords, locale: string): ArkStatusText {
    const act = (key: ArkActivityKey) => words.activity[key] ?? ARK_ACTIVITY_ENGLISH[key];
    const now = status.activity ? fillArkWords(words.card.now, {activity: act(status.activity)}) : null;
    const goal = status.goal;
    const next = !goal ? null : goal.kind === "wakes" ? fillArkWords(words.card.wakes, {time: arkIslandTime(goal.at, locale)}) : fillArkWords(words.card.next, {activity: act(goal.activity)});
    const day = (entry: ArkStatusLogEntry) => (entry.day === null ? "" : fillArkWords(words.card.day, {day: entry.day.toLocaleString(locale)}));
    const log = status.log.map((entry) => {
        if (entry.source === "schedule") return {id: entry.id, source: entry.source, stamp: arkIslandTime(entry.at / 1000, locale), text: capitalised(act(entry.activity ?? "about"))};
        let text: string;
        switch (entry.kind) {
            case "arrived":
                text = entry.via === "step" ? words.story.generic : words.story.capture;
                break;
            case "born":
                text = words.life.bornAboard;
                break;
            case "hatched":
                text = words.life.hatchedAboard;
                break;
            case "meal":
                text = fillArkWords(words.card.meal, {aPrey: withArticle(entry.other ?? "", words)});
                break;
            case "young":
                text = (entry.count ?? 1) > 1 ? fillArkWords(words.card.youngOther, {count: (entry.count ?? 1).toLocaleString(locale)}) : words.card.youngOne;
                break;
            case "laid":
                text = words.card.laid;
                break;
            case "mated":
                text = words.card.mated;
                break;
            default:
                text = "";
        }
        return {id: entry.id, source: entry.source, stamp: day(entry), text};
    });
    const bars: ArkStatusText["bars"] = [];
    const {fed, health, energy, age} = status.bars;
    const card = (key: "energy" | "awakeSince" | "asleepSince") => words.card[key] || ARK_CARD_ENGLISH[key];
    if (fed) bars.push({key: "fed", label: words.card.fed, value: fed.value, tone: fed.tone, text: fed.state === "hungry" ? words.life.hungry : fed.value < 0.6 ? words.card.fedLow : words.life.well_fed});
    if (health) bars.push({key: "health", label: words.card.health, value: health.value, tone: health.tone, text: health.state === "old" ? words.life.old : health.state === "hungry" ? words.life.hungry : words.card.healthGood});
    if (energy) bars.push({key: "energy", label: card("energy"), value: energy.value, tone: energy.tone, text: fillArkWords(card(energy.state === "asleep" ? "asleepSince" : "awakeSince"), {time: arkIslandTime(energy.since ?? 0, locale)})});
    if (age) bars.push({key: "age", label: words.card.age, value: age.value, tone: age.tone, text: fillArkWords(words.card.lifeLeft, {percent: `${Math.round(age.value * 100).toLocaleString(locale)}%`})});
    return {now, next, log: log.filter((line) => line.text), bars};
}

/** The fields that make two statuses read the same (the scene tells the page and the apps only when this changes). */
export function arkStatusSignature(status: ArkAnimalStatus | null): string {
    if (!status) return "";
    const goal = status.goal ? `${status.goal.kind}:${status.goal.kind === "next" ? status.goal.activity : ""}:${Math.round(status.goal.at / 60)}` : "";
    const bars = ARK_STATUS_BAR_KEYS.map((key) => {
        const bar = status.bars[key];
        // (The day's bars to a hundredth: they move a little every second, the card and the bars need not.)
        return bar ? `${key === "energy" || key === "fed" ? bar.value.toFixed(2) : bar.value}${bar.state === "eating" ? "+" : ""}${bar.since !== undefined ? `@${Math.round(bar.since / 60)}` : ""}` : "-";
    }).join(",");
    return `${status.id}|${status.activity}|${goal}|${bars}|${status.log.map((entry) => entry.id).join(",")}`;
}

/** The words a status borrows from elsewhere in `ark`, in English: the embed's fallback. */
const BORROWED_ENGLISH: Pick<ArkStatusWords, "story" | "life" | "replay"> = {
    story: {capture: "Came aboard with a capture", generic: "Came aboard after a step that worked"},
    life: {bornAboard: "Born on the Ark", hatchedAboard: "Hatched on the Ark", well_fed: "Well-fed", hungry: "Hungry", old: "Old"},
    replay: {a: "a {animal}", an: "an {animal}"}
};

type Loose = Record<string, unknown> | null | undefined;
function strings<T extends Record<string, string>>(english: T, given: unknown): T {
    const out = {...english} as Record<string, string>;
    const row = given && typeof given === "object" ? (given as Record<string, unknown>) : {};
    for (const key of Object.keys(english)) if (typeof row[key] === "string" && (row[key] as string).trim()) out[key] = row[key] as string;
    return out as T;
}

/** A status's words from the Ark's words as `/api/ark/words` answers them (`ark`), English key by key where one lacks. */
export function arkStatusWords(ark: Loose): ArkStatusWords {
    const activity = (ark?.activity ?? null) as Loose;
    const {log: englishLog, ...englishActivity} = ARK_ACTIVITY_ENGLISH;
    return {
        activity: {...strings(englishActivity as unknown as Record<string, string>, activity), log: strings(englishLog as unknown as Record<string, string>, activity?.log)} as unknown as ArkActivityWords,
        card: strings(ARK_CARD_ENGLISH as unknown as Record<string, string>, ark?.card) as unknown as ArkCardWords,
        story: strings(BORROWED_ENGLISH.story, ark?.story),
        life: strings(BORROWED_ENGLISH.life, ark?.life),
        replay: strings(BORROWED_ENGLISH.replay, ark?.replay)
    };
}

/** A status for the apps (`ark:selected`, `ark:status`): as the scene has it, with its lines in the reader's words. */
export function arkStatusForHost(status: ArkAnimalStatus | null | undefined, ark: Loose, locale: string): (ArkAnimalStatus & {text: ArkStatusText}) | null {
    if (!status) return null;
    return {...status, text: arkStatusText(status, arkStatusWords(ark), locale)};
}
