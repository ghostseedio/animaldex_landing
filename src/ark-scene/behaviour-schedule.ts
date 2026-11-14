/**
 * The NPC-style behaviour schedule (visual only): what an animal is doing at
 * any moment, and where, as a pure function of the time and its id.
 *
 * - Time is cut into slots of `SLOT_SECONDS` of world time (epoch seconds, the
 *   same for every viewer and the livestream), offset per animal. Each slot is
 *   one goal: the animal travels from where the last slot left it to the
 *   slot's destination (a feeding spot, water, a perch, shelter, its roost, its
 *   group) by a route of its own (legs: walk, pause, fly, swim, slide into the
 *   water and climb out), then spends the rest of the slot there in beats
 *   (bite, chew, step and look up while grazing; peck and scan on the ground;
 *   preen on a perch; shake off after a swim).
 * - Asleep slots (its activity against the hour, the rule the tap card uses)
 *   are spent at its roost; the first is a visible trip there.
 * - An awake slot's goal is the animal's own seeded choice from its profile's
 *   needs (`behaviour-profile.ts`), shaped by the hour and by its personality
 *   (`ark-clock.ts`): never a timeline shared by its species.
 * - A group (herd, troop, flock, school) keeps together around its leader, but
 *   each member chooses its own goal there: some graze while one watches, some
 *   rest while others move; young play near the group. Only flocking species fly
 *   together, and even they don't always.
 * - Predators keep their home ranges a safe distance from their prey's (`spaceHomes`);
 *   they may stalk towards the edge of their range, and never catch anything.
 *
 * No per-viewer randomness: every choice is seeded by the animal's id and the
 * slot. Nothing here decides anything in the Ark (the server does that).
 */

import {bodyLengthsPerSecond, dayOf, freeBodyLengthsPerSecond, PACE_CAP, runFactor, swimPaceLength, swimSpeedOf, type ArkBehaviour, type ArkBehaviourProfile, type ArkInteraction, type ArkRoost} from "@/ark-scene/behaviour-profile";
import {alongPath, MAX_SLOPE, MOUNTAIN_SLOPE, naturalWay, navGrid, navGridBuild, pathLength, type NavGrid, type NavPoint} from "@/ark-scene/behaviour-nav";
import {modelBase} from "@/ark-scene/grounding/base";
import {gaitRhythm, groundProgress, rampedShare, standTurnRate, startTime, stopTime, type LegShape} from "@/ark-scene/locomotion/paces";
import {bodyShape} from "@/ark-scene/collide/bodies";
import {hostOf, onSurface, surfaceOf} from "@/ark-scene/collide/attach";
import {colliderDistance, type Collider} from "@/ark-scene/collide/colliders";
import {worldSampler, worldSamplerBuild, type ArkWorldSampler, type AttachPoint, type AttachTag} from "@/ark-scene/world-sampler";
import {waterLevelAt} from "@/ark-scene/water-level";
import {DEN_DRY, SURF_REACH} from "@/ark-scene/map/points";
import {topOf, waterSurfaceOf} from "@/ark-scene/behaviour-water";
import {once, SlicedBuild, type BuildTask} from "@/ark-scene/behaviour-build";
import {isAwake} from "@/lib/ark-daylight";
import {animalPersonality} from "@/lib/ark-clock";
import {hashString} from "@/ark-scene/world";
import {intelProfile} from "@/ark-scene/intelligence-profile";
import type {ArkZone, ArkThrive} from "@/ark-scene/types";
import {roostOffset, sleepSpacing, sleepStyle} from "@/ark-scene/sleep";
import {airLift, airPacesOf, airProgress, airStage, flightSpec, flightSpecOf, aloftSlots, flightWay, FLIGHT_ACCEL_MAX, FLIGHT_WAYS, G, hawkAt, planAirLeg, planSoarLeg, soarAt, soarSpecOf, stationBout, takeoffClass, THERMAL_HOURS, trackAt, type AirPaces, type AirPlan, type AirStage, type FlightWayRule, type SoarAt} from "@/ark-scene/locomotion/flight";
import {breathRhythm, patrolRule, shoreSide, waterLife} from "@/ark-scene/water-life";
import {speciesDepth} from "@/ark-scene/sea-depth";
import {patrolLength, patrolRoute} from "@/ark-scene/water-patrol";
import {locoStyle} from "@/ark-scene/locomotion/styles";
import {swimPaces} from "@/ark-scene/locomotion/swim";
import {TEMPLATES} from "@/ark-scene/recipe-templates";
import {coatOf, episodeOfTrip, episodePose, forgetRecipes, marksOf, nestSiteOf, recipeRoostTags, sexLook, sitterIntent, type RecipeCoat, MARK_SECONDS, recipeIntent, type Episode, type RecipeMark, type RecipePose, type ScheduleKit, type TripOwner} from "@/ark-scene/behaviour-recipes";

export const SLOT_SECONDS = 80;
/** The raised perches a group sleeps along in a row or a cluster (sleep lane). */
const RAISED_TAGS: AttachTag[] = ["branch", "canopy_hang", "cliff_ledge", "post", "rock_top", "tree_hollow"];
/** A night watch stands this many slots (sleep lane: about five minutes). */
export const NIGHT_WATCH_SLOTS = 4;
/** A day watch stands this many slots (lane B3 needs: about four minutes), then the next member's turn. */
export const DAY_WATCH_SLOTS = 3;

/** Each animal's slots are shifted by its own offset (from its id), so a thousand animals don't all change plans in the same frame. */
export function slotOffset(id: string): number {
    return (hashString(`${id}#slot`) % 8000) / 100;
}
export function slotStart(animal: ScheduleAnimal, slot: number): number {
    return slot * SLOT_SECONDS - slotOffset(animal.id);
}
function slotOf(animal: ScheduleAnimal, epochSeconds: number): number {
    return Math.floor((epochSeconds + slotOffset(animal.id)) / SLOT_SECONDS);
}

/** What it is doing (one state, which the animation, the tap card and follow all read). */
export type ArkDoing =
    | "sleep"
    | "to_roost"
    | "watch"
    | "rest"
    | "wander"
    | "forage"
    | "graze"
    | "browse"
    | "drink"
    | "perch"
    | "fly"
    | "soar"
    | "swim"
    | "breathe"
    | "dive"
    | "bask"
    | "burrow"
    | "climb"
    | "groom"
    | "hide"
    | "visit_flowers"
    | "circle_light"
    | "crawl"
    | "stalk"
    | "play"
    | "idle";

/** The moment-to-moment part of what it is doing (for the clips: a graze clip on "bite", a scan clip on "scan", a shake on "shake"). */
export type ArkBeat = "walk" | "run" | "fly" | "glide" | "swim" | "enter_water" | "exit_water" | "climb" | "pause" | "shake" | "bite" | "chew" | "step" | "scan" | "peck" | "drink" | "preen" | "rest" | "sleep" | "play" | "stalk";

/** How it travels a leg. */
export type TripMode = "ground" | "air" | "water" | "surface" | "stay";
type LegMode = TripMode | "enter" | "exit" | "pause" | "shadow";

export type Spot = {x: number; y: number; z: number; /** The surface's normal there (up on the ground). */ nx: number; ny: number; nz: number; point: string | null; /** The way it faces when it is left there (a slot's finish), when known. */ yaw?: number};

export type Leg = {
    /** A pause: the way it faces (the way it came; a pause from a point to itself has no direction of its own). */
    yaw?: number;
    mode: LegMode;
    from: Spot;
    to: Spot;
    /** The ground or water path (x, z) for ground and water legs; for air legs, the route's waypoints. */
    path: NavPoint[] | null;
    length: number;
    seconds: number;
    beat: ArkBeat;
    /** Air legs: cruising height above the ground. */
    cruise?: number;
    /** Air legs: the share of the leg it climbs over (0.18 if not set) and comes down over (0.22): less to clear a fence. */
    rise?: number;
    fall?: number;
    /**
     * Air legs (MA1): its flight's plan: its speed through the leg (up at its acceleration out of the take-off, its
     * cruise, down at its braking), where along the route it lifts off after a run and touches down before a ski, and
     * how far it climbs and comes down over (its `rise` and `fall` then count from those, as shares of the route).
     */
    plan?: AirPlan;
    /** A pause that is a turn on the spot before setting off (it turns over the whole pause, at TURN_RATE). */
    turn?: boolean;
    /** Ground and water legs: how far along its way it looks to face (m; 1.5 if not set). */
    look?: number;
    /**
     * Ground legs (lane B4): its shape in time (`locomotion/paces.ts` groundProgress): how long it takes to get going
     * and to stop, and a burst mover's bursts and stops. Not set: at one speed from its first moment to its last.
     */
    shape?: LegShape | null;
    /** A follower's leg: its walking pace (m/s), for the walk to its own finish at the slot's end. */
    pace?: number;
    /** A follower's leg that takes off with its leader (MA1): where it stood from its leader then, eased into its place. */
    lead0?: {x: number; y: number; z: number};
};

/** One beat of its time at its destination: from `at` seconds after it arrives, it does `beat` at (x, z) facing yaw (a step walks there). */
export type StayBeat = {at: number; beat: ArkBeat; x: number; z: number; yaw: number; /** A step's time (s): its length at its walk's own pace. */ dur?: number};

export type Trip = {
    slot: number;
    doing: ArkDoing;
    /** The main way it travels this slot ("stay" when it doesn't). */
    mode: TripMode;
    /** World seconds: the trip's start, when it arrives, when the slot ends. */
    start: number;
    arrive: number;
    end: number;
    from: Spot;
    /** Where it arrives. */
    to: Spot;
    /** Where it is when the slot ends (after the steps of its stay): where the next slot starts. */
    finish: Spot;
    /** The main ground or water path (x, z). */
    path: NavPoint[] | null;
    legs: Leg[];
    stay: StayBeat[];
    length: number;
    /** Flyers: the height band's cruising height above the ground (m). */
    cruise: number;
    /** Running rather than walking. */
    running: boolean;
    /** A flock member flying with its leader: the leader's trips over this slot, and its place beside it. */
    shadow?: {trips: Trip[]; dx: number; dy: number; dz: number} | null;
    /** A recipe this slot's goal was chosen for (`behaviour-recipes.ts`), and who the trip is (for its episodes). */
    recipe?: string | null;
    owner?: TripOwner | null;
    /** (Lane B6.) It ends the slot in the water (its goal is wet, not a rock over it): an air breather's rhythm runs there (`breath-trip.ts`). */
    wet?: boolean;
};

/** Its group, when it keeps to one: its leader (its schedule animal, profile and activity), its rank (1…), the group's size. */
export type ScheduleGroup = {leader: ScheduleAnimal; profile: ArkBehaviourProfile; activity: ArkBehaviourProfile["activity"] | null | undefined; rank: number; size: number};

export type ScheduleAnimal = {
    id: string;
    zone: ArkZone;
    /** Its home: where the server placed it (or, for a predator, moved a safe distance from its prey: `spaceHomes`). */
    home: {x: number; y: number; z: number};
    /** Drawn length (m). */
    length: number;
    /** Lives in the sea. */
    sea: boolean;
    /** Young (born on the Ark not long ago): it plays near its group. */
    young?: boolean;
    /** The most its home range may reach (predators near prey). */
    range?: number | null;
    /** For a predator: its nearest prey's home, which it may stalk towards (never past its own range). */
    prey?: {x: number; z: number} | null;
    group?: ScheduleGroup | null;
    /** The predators aboard that could eat it (top predators only: `wireThreats`); it watches one it can see. */
    threats?: ScheduleThreat[] | null;
    /**
     * How well kept it is (`thrive.ts`): the hook for energy (more active when prime, more resting when ordinary)
     * and for who claims the best places first. Not read yet: every band is scheduled the same.
     */
    thrive?: ArkThrive;
    /** A fixed roost the map gives it (its perch, or the roost its text names: `map/place.ts` scheduleRoost); it sleeps there. */
    roost?: Spot | null;
    /** A zoo's feeding time (lane B3 needs): its enclosure's station is its home for these slots, and it feeds there (`needAt`). */
    feeding?: boolean;
};

/** A predator as its prey sees it: its own schedule animal, profile and activity. */
export type ScheduleThreat = {animal: ScheduleAnimal; profile: ArkBehaviourProfile; activity: ArkBehaviourProfile["activity"] | null | undefined};

/** The hour (0–24) at a world time: the island clock, or a pinned hour. */
export type HoursAt = (epochSeconds: number) => number;

export function sunElevationAt(hours: number): number {
    return 58 * Math.sin((2 * Math.PI * (hours - 6)) / 24);
}

// MARK: Sleep and waking hours (lane B3 needs)

/**
 * Its sleeps in the 24 hours, as `[from, to, from, to...]` in hours (a `to` past 24 runs over midnight), from how long
 * its kind sleeps (`ArkDay.sleep`: a koala 20 hours, a giraffe four and a half) and when it is up (its stored
 * activity). Null: its activity's own hours by the sun (`isAwake`), as before, for every kind with no hours written.
 *
 * - By day (diurnal): one sleep about midnight; a long sleeper (a squirrel) naps at midday too; a short sleeper (an
 *   elephant, a horse, a cow: five and a half hours or less) sleeps three short bouts in the small hours and is up
 *   between them.
 * - By night: the same about noon; a long sleeper (a koala, a bat) sleeps again about midnight, so it is up at dusk
 *   and before dawn.
 * - At the day's two ends (crepuscular): a sleep through the middle of the day and one about midnight, up from before
 *   dawn into the morning and from late afternoon into the evening (twelve hours' sleep when none is written; by the
 *   sun's height alone it slept nineteen).
 * - At any hour: none when no hours are written (a dolphin, a shark); else short sleeps in the night, and with more
 *   than six hours one at midday too.
 */
function sleepWindows(profile: ArkBehaviourProfile, kind: ArkBehaviourProfile["activity"]): number[] | null {
    const written = dayOf(profile).sleep;
    const hours = written ?? (kind === "crepuscular" ? 12 : null);
    if (hours === null) return null;
    const key = `${kind}|${hours}`;
    let windows = SLEEPS.get(key);
    if (windows === undefined) {
        const nap = (centre: number, length: number) => [centre - length / 2, centre + length / 2];
        const S = Math.min(Math.max(hours, 0), 23);
        if (S <= 0) windows = [];
        else if (kind === "crepuscular") windows = [...nap(12.5, Math.min(S * 0.55, 10)), ...nap(0.5, S - Math.min(S * 0.55, 10))];
        else if (kind === "nocturnal") windows = S <= 5.5 ? [...nap(10, S / 3), ...nap(12.5, S / 3), ...nap(15, S / 3)] : S <= 13 ? nap(12, S) : [...nap(12, 13), ...nap(0.5, S - 13)];
        else if (kind === "any" && S > 6) windows = [...nap(23.5, S / 3), ...nap(3.5, S / 3), ...nap(13, S / 3)];
        else windows = S <= 5.5 || kind === "any" ? [...nap(23, S / 3), ...nap(1.5, S / 3), ...nap(4, S / 3)] : S <= 13 ? nap(0, S) : [...nap(0, 13), ...nap(13, S - 13)];
        SLEEPS.set(key, windows);
    }
    return windows;
}
const SLEEPS = new Map<string, number[]>();

export function awakeAt(profile: ArkBehaviourProfile, activity: ArkBehaviourProfile["activity"] | null | undefined, hours: number): boolean {
    const kind = activity ?? profile.activity;
    const windows = sleepWindows(profile, kind);
    if (!windows) return isAwake(kind, sunElevationAt(hours));
    const h = ((hours % 24) + 24) % 24;
    for (let i = 0; i < windows.length; i += 2) {
        const from = windows[i];
        const to = windows[i + 1];
        if ((h >= from && h < to) || (h + 24 >= from && h + 24 < to) || (h - 24 >= from && h - 24 < to)) return false;
    }
    return true;
}

/**
 * Its waking day: the hour its longest waking stretch begins and how long that is (hours), by the same rule as
 * `awakeAt`. One that never sleeps: from dawn, the whole day.
 */
export function wakingDay(profile: ArkBehaviourProfile, activity: ArkBehaviourProfile["activity"] | null | undefined): {wake: number; hours: number} {
    const kind = activity ?? profile.activity;
    const key = `${kind}|${dayOf(profile).sleep ?? ""}`;
    let day = WAKING.get(key);
    if (!day) {
        // Every three minutes round the clock: the longest run awake.
        const STEP = 0.05;
        const N = Math.round(24 / STEP);
        let best = {wake: 6, hours: 24};
        let first = -1;
        for (let i = 0; i < N; i++) if (!awakeAt(profile, activity, i * STEP)) { first = i; break; }
        if (first >= 0) {
            best = {wake: 0, hours: 0};
            let from = -1;
            for (let k = 1; k <= N; k++) {
                const i = (first + k) % N;
                const up = k < N && awakeAt(profile, activity, i * STEP);
                if (up && from < 0) from = k;
                if (!up && from >= 0) {
                    if ((k - from) * STEP > best.hours + 1e-9) best = {wake: ((first + from) % N) * STEP, hours: (k - from) * STEP};
                    from = -1;
                }
            }
            if (best.hours <= 0) best = {wake: 6, hours: 24};
        }
        day = best;
        WAKING.set(key, day);
    }
    return day;
}
const WAKING = new Map<string, {wake: number; hours: number}>();

// MARK: Seeded choices

function rng(seed: number): () => number {
    let s = seed >>> 0 || 1;
    return () => {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return ((s >>> 0) % 1_000_003) / 1_000_003;
    };
}

/** The behaviour's pull at this hour, for this animal (the profile's weight shaped by the day and its personality). */
function hourly(profile: ArkBehaviourProfile, behaviour: ArkBehaviour, weight: number, hours: number, bold: number, curious: number): number {
    const dawn = Math.exp(-(((hours - 6.5) / 1.5) ** 2));
    const dusk = Math.exp(-(((hours - 18.5) / 1.5) ** 2));
    const midday = Math.exp(-(((hours - 13) / 2) ** 2));
    const morning = Math.exp(-(((hours - 9) / 1.8) ** 2));
    const night = hours < 5 || hours > 20 ? 1 : 0;
    const busy = profile.activity === "crepuscular" || profile.twoPeaks ? 1 + 1.5 * (dawn + dusk) - (profile.siesta || profile.twoPeaks ? 0.7 * midday : 0) : 1;
    switch (behaviour) {
        case "rest":
        case "groom":
            return weight * (profile.siesta ? 1 + 2.5 * midday : 1) * (busy > 1 ? 0.6 : 1) * (1 - 0.25 * bold);
        case "forage":
        case "graze":
        case "visit_flowers":
            return weight * busy * (0.85 + 0.3 * curious);
        case "stalk":
            return weight * busy * (0.7 + 0.4 * Math.max(bold, 0));
        case "wander":
            return weight * (0.8 + 0.4 * curious + 0.2 * bold);
        case "hide":
            return weight * (1 - 0.6 * bold);
        case "bask":
            return night ? 0 : weight * (0.4 + 2 * morning);
        case "soar":
            return night ? 0 : weight * (0.3 + 1.5 * midday);
        case "circle_light":
            return night ? weight * 3 : 0;
        case "drink":
            // (Its trips to water are its day's own: `needAt`.)
            return weight;
        case "flee":
        case "flock":
            return 0;
        default:
            return weight;
    }
}

/**
 * Its own leanings (problem 7: every animal of a kind doing the same thing): each behaviour's pull times 0.65-1.35,
 * and its busy hours shifted up to 45 minutes either way, both its own for life (seeded by its id), so two of a kind
 * with the same profile still choose differently, and not all at the same dawn.
 */
function leaning(id: string, behaviour: ArkBehaviour): number {
    return 0.65 + 0.7 * ((hashString(`${id}#lean#${behaviour}`) % 1000) / 1000);
}
function chronotype(id: string): number {
    return (((hashString(`${id}#chrono`) % 1000) / 1000) - 0.5) * 1.5;
}

// MARK: Needs (lane B3, the behaviours pass of 2026-11-14)

/**
 * What a waking slot is for, before the choice among its behaviours: a feeding bout, the rest that follows it, the
 * time between (travel, a flight, a swim, whatever else it does), a trip to water, a bask on waking.
 */
export type ArkNeed = "feed" | "rest" | "free" | "drink" | "bask";

/** A cycle this long or longer (minutes) is counted from its waking, not round the clock: a lion's one hunt a night. */
const LONG_CYCLE = 240;
/** When in its waking day it goes to water (shares of its waking stretch): after its first feed, before its last light, then between. */
const DRINK_AT = [0.14, 0.84, 0.5, 0.32, 0.68];
/** Hot, open ground: a day animal there rests through the middle of the day. */
const HOT_ZONES: ReadonlySet<ArkZone> = new Set<ArkZone>(["desert", "grassland"]);

const unit = (key: string) => (hashString(key) % 100_003) / 100_003;

/**
 * The need a slot answers (visual only; the server's ecology feeds and starves, never this). Pure in the animal's id,
 * its group's leader's id, the slot's start and the island's hour then: the same for every viewer, and no slot waits
 * on another.
 *
 * Its waking time runs in feeding cycles (`ArkDay`, from its taxonomy, diet and size): a feeding bout, then the rest
 * that follows it (a ruminant lies down to chew, a lion sleeps off its meal, a hummingbird sits on its perch), then the
 * time between. So hunger leads to feeding and feeding to rest, in bouts of the length its kind keeps, where every
 * slot used to be drawn on its own (an elephant changed what it was doing 30 times an hour, fed 2.2 hours a day in
 * 80-second bouts and slept 11.5).
 * - A short cycle (a shrew's 20 minutes, a deer's two and a half hours) runs round the clock from the animal's own
 *   phase and at its own length (0.85-1.15 of its kind's), each bout 0.8-1.2 of its share; busier at dawn and dusk and
 *   resting through midday where its kind does (two peaks, a siesta, a day animal on hot open ground).
 * - A long cycle (a cat's, a crocodile's) is counted from its waking: it gets up, sets about feeding, and rests the
 *   rest of its waking stretch. One that feeds one day in several (a python) does so on its own days.
 * - A group keeps its leader's rhythm, each member up to three tenths of a cycle off it: a herd grazes and lies up
 *   more or less together, never all on the same beat.
 * - Trips to water are its day's own (`ArkDay.drinks`: one or two for most land mammals, none for a koala or a
 *   kangaroo rat), at their hours of its waking day, the whole group at once.
 * - One that basks (a lizard, a tortoise, a crocodile; a lemur) does that first on a morning's waking, before anything else.
 * - Its last 20 minutes before it sleeps it rests (at dusk a day bird preens and settles).
 */
export function needAt(profile: ArkBehaviourProfile, animal: Pick<ScheduleAnimal, "id" | "zone" | "group" | "feeding">, activity: ArkBehaviourProfile["activity"] | null | undefined, start: number, hoursAt: HoursAt): ArkNeed {
    // A zoo's feeding time: the keepers have put its food down.
    if (animal.feeding) return "feed";
    const day = dayOf(profile);
    const kind = activity ?? profile.activity;
    const hours = hoursAt(start);
    const waking = wakingDay(profile, activity);
    // Hours since its waking day began, and the epoch day that began on (its feeding days and its drinks are per day).
    const since = (((hours - waking.wake) % 24) + 24) % 24;
    // (Its waking began at the same moment whichever of the day's slots asks; a hair past the half so a waking that
    // begins exactly on it never reads as two days.)
    const dayIndex = Math.floor((start - since * 3600) / 86_400 + 0.5 + 1e-7);
    const lead = animal.group ? animal.group.leader.id : animal.id;

    // Its trips to water.
    if (day.drinks > 0 && (profile.weights.drink ?? 0) > 0) {
        const slotHours = (((hoursAt(start + SLOT_SECONDS) - hours) % 24) + 24) % 24;
        if (slotHours > 1e-6 && slotHours < 1) {
            const count = Math.min(Math.floor(day.drinks) + (unit(`${lead}#${dayIndex}#drinks`) < day.drinks - Math.floor(day.drinks) ? 1 : 0), DRINK_AT.length);
            for (let i = 0; i < count; i++) {
                const at = (DRINK_AT[i] + (unit(`${lead}#${dayIndex}#drink${i}`) - 0.5) * 0.12) * waking.hours;
                if (at >= since && at < since + slotHours) return "drink";
            }
        } else {
            // (The hour pinned, a recording's: as often, by the clock alone.)
            const period = 86_400 / day.drinks;
            const phase = unit(`${lead}#drinks`) * period;
            if (Math.floor((start + phase) / period) !== Math.floor((start + SLOT_SECONDS + phase) / period)) return "drink";
        }
    }
    const inDay = since < waking.hours;
    // A basker warms up first: the first hour or so of a waking that begins in the morning (the sun up, before noon).
    if ((profile.weights.bask ?? 0) > 0 && inDay && hours > 5.5 && hours < 11.5 && since < 1.2 + 0.8 * unit(`${animal.id}#bask`)) return "bask";
    // Winding down: its last 20 minutes up.
    if (inDay && waking.hours < 24 && since > waking.hours - 0.33) return "rest";

    const shifted = (((hours + chronotype(animal.id)) % 24) + 24) % 24;
    const dawn = Math.exp(-(((shifted - 6.5) / 1.5) ** 2));
    const dusk = Math.exp(-(((shifted - 18.5) / 1.5) ** 2));
    const midday = Math.exp(-(((shifted - 13) / 2) ** 2));
    let u: number;
    let n: number;
    let feed = day.feed;
    let rest = day.rest;
    const member = animal.group ? unit(`${animal.id}#member`) - 0.5 : 0;
    if (day.cycle >= LONG_CYCLE) {
        const cycles = Math.max(1, Math.round((waking.hours * 60) / day.cycle));
        // (It starts a twelfth of a cycle before a feeding bout: up, a stretch, a look round, then off.)
        const x = (since / waking.hours) * cycles + 11 / 12 + member * 0.1;
        n = Math.floor(x) + dayIndex * 8;
        u = x - Math.floor(x);
        if (day.every > 1) feed = (dayIndex + hashString(`${lead}#feedday`)) % day.every === 0 ? Math.min(day.feed * day.every, 0.5) : 0;
    } else {
        const length = day.cycle * 60 * (0.85 + 0.3 * unit(`${lead}#cycle`));
        const t = start + unit(`${lead}#phase`) * length + member * 0.6 * length;
        n = Math.floor(t / length);
        u = t / length - n;
        // Busier at the day's two ends, resting through its middle, where its kind is.
        if (kind === "crepuscular" || profile.twoPeaks) feed *= 0.75 + 0.6 * (dawn + dusk) - (profile.siesta || profile.twoPeaks ? 0.35 * midday : 0);
        if (profile.siesta || (kind === "diurnal" && HOT_ZONES.has(animal.zone))) {
            rest *= 1 + (profile.siesta ? 1.6 : 0.9) * midday;
            feed *= 1 - (profile.siesta ? 0.5 : 0.3) * midday;
        }
    }
    feed = Math.min(Math.max(feed * (0.8 + 0.4 * unit(`${lead}#${n}#bout`)), 0), 0.95);
    rest = Math.min(Math.max(rest, 0), 1 - feed);
    return u < feed ? "feed" : u < feed + rest ? "rest" : "free";
}

/**
 * Its feeding rhythm in waking seconds, for its card's fed bar (`animal-status.ts` scheduleFed): one whole feeding
 * cycle (over its feeding days, for one that feeds one day in several) and the gap in it between two feeding bouts.
 */
export function feedingRhythm(profile: ArkBehaviourProfile, activity: ArkBehaviourProfile["activity"] | null | undefined): {cycle: number; gap: number} {
    const day = dayOf(profile);
    const waking = wakingDay(profile, activity);
    const cycle = day.cycle >= LONG_CYCLE ? ((waking.hours * 3600) / Math.max(1, Math.round((waking.hours * 60) / day.cycle))) * day.every : day.cycle * 60;
    return {cycle, gap: Math.max(cycle * (1 - Math.min(Math.max(day.feed, 0.01), 0.95)), 300)};
}

/**
 * Rests and feeding bouts hold their ground in spells: through one spell a resting animal keeps one place and one way
 * of resting (its perch, its patch of shade, its basking rock), and a feeding one keeps to one patch (its grass, its
 * litter), stepping about in it; the next spell may be somewhere else. The spell's index at a slot's start: about 40
 * minutes of rest, 15 of feeding, each animal's own length (0.75-1.25) and phase. (Each slot still has its own goal,
 * the same one through the spell, so no slot waits on the ones before it.)
 */
function spellOf(id: string, need: ArkNeed, start: number): number {
    const length = (need === "feed" ? 900 : 2400) * (0.75 + 0.5 * unit(`${id}#spell`));
    return Math.floor((start + unit(`${id}#spell-phase`) * length) / length);
}

const FEEDS: ReadonlySet<ArkBehaviour> = new Set<ArkBehaviour>(["forage", "graze", "visit_flowers", "stalk"]);
const RESTS: ReadonlySet<ArkBehaviour> = new Set<ArkBehaviour>(["rest", "groom", "bask", "hide", "perch"]);
/**
 * How a need shares a slot among the three kinds of behaviour: in a feeding bout it feeds (one slot in thirty or so it
 * does something else), in its rest it rests, grooms, basks or sits on its perch, between them it mostly travels. The
 * shares are of the slot's whole draw, whatever the profile's weights add up to in each kind (as plain multipliers a
 * cow, whose resting weights are a quarter of its feeding ones, left its rest one slot in six). It drinks on its trips
 * to water and at no other time (as one behaviour among the rest, every land animal near water went to it 20 to 70
 * times a day).
 */
const NEED_SHARES: Record<Exclude<ArkNeed, "drink">, {feed: number; rest: number; free: number}> = {
    feed: {feed: 0.965, rest: 0.015, free: 0.02},
    rest: {feed: 0.01, rest: 0.965, free: 0.025},
    bask: {feed: 0.01, rest: 0.975, free: 0.015},
    free: {feed: 0.06, rest: 0.14, free: 0.8}
};
const kindOf = (behaviour: ArkBehaviour): "feed" | "rest" | "free" => (FEEDS.has(behaviour) ? "feed" : RESTS.has(behaviour) ? "rest" : "free");
/** Within its rest, resting itself comes first (a lion groomed a third of its rest), and a basker's first hour is its bask. */
function withinNeed(need: ArkNeed, behaviour: ArkBehaviour): number {
    if (behaviour === "rest" && need !== "bask") return 2.5;
    return need === "bask" && behaviour === "bask" ? 14 : 1;
}

function pick(profile: ArkBehaviourProfile, id: string, hoursNow: number, roll: number, bold: number, curious: number, need: ArkNeed, avoid?: ArkBehaviour | null): ArkBehaviour {
    const hours = (((hoursNow + chronotype(id)) % 24) + 24) % 24;
    // (Its trip to water: it drinks.)
    if (need === "drink" && (profile.weights.drink ?? 0) > 0) return "drink";
    const pulls = (Object.entries(profile.weights) as Array<[ArkBehaviour, number]>)
        .map(([b, w]) => [b, b === "drink" ? 0 : (b === avoid ? hourly(profile, b, w, hours, bold, curious) * 0.25 : hourly(profile, b, w, hours, bold, curious)) * leaning(id, b) * withinNeed(need, b)] as const)
        .filter(([, w]) => w > 0);
    // Each kind's pulls scaled to the need's share of the slot (a kind it has nothing of leaves its share to the others).
    const sums = {feed: 0, rest: 0, free: 0};
    for (const [b, w] of pulls) sums[kindOf(b)] += w;
    const shares = NEED_SHARES[need === "drink" ? "free" : need];
    const entries = pulls.map(([b, w]) => [b, (w / sums[kindOf(b)]) * shares[kindOf(b)]] as const);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (!total) return "rest";
    let at = roll * total;
    for (const [b, w] of entries) {
        at -= w;
        if (at <= 0) return b;
    }
    return entries[entries.length - 1][0];
}

// MARK: Places

const ROOST_TAGS: Record<ArkRoost, AttachTag[]> = {
    tree: ["branch"],
    tree_hole: ["tree_hollow", "bark", "branch"],
    cliff: ["cliff_ledge", "rock_top"],
    cave: ["cave_mouth", "rock_face"],
    crevice: ["rock_face", "rock_top"],
    rocks: ["rock_top"],
    burrow: ["burrow_entrance"],
    den: ["burrow_entrance", "cave_mouth"],
    ground_cover: ["shade"],
    reeds: ["reeds"],
    water: [],
    bottom: [],
    reef: [],
    leaf: ["leaf_litter", "branch"],
    bark: ["bark"],
    wall: ["house_wall"],
    nest: ["branch", "shade"],
    attached: [],
    open: [],
    // Hauled out where the water meets the land (seals, sea lions, the walrus, penguins).
    shore: ["water_edge", "rock_top"]
};

const INTERACTION_TAGS: Partial<Record<ArkInteraction, AttachTag[]>> = {
    drink_edge: ["water_edge"],
    bask_rock: ["rock_top", "log_top"],
    graze_grass: ["grass"],
    perch_branch: ["branch"],
    perch_rock: ["rock_top", "post", "log_top"],
    dig_soil: ["worm_hole", "burrow_entrance"],
    leaf_litter: ["leaf_litter"],
    flower: ["flower"],
    porch_light: ["porch_light"],
    cave_mouth: ["cave_mouth"],
    cliff_ledge: ["cliff_ledge"],
    tide_pool: ["tide_pool"],
    bark: ["bark"],
    wall: ["house_wall"],
    burrow_mouth: ["burrow_entrance"],
    reeds: ["reeds"],
    shade: ["shade"],
    water_surface: ["pond_surface"],
    shore: ["water_edge"]
};

/** Which places each behaviour goes to (the first of its interactions that has one near home). */
const BEHAVIOUR_PLACES: Partial<Record<ArkBehaviour, ArkInteraction[]>> = {
    drink: ["drink_edge"],
    bask: ["bask_rock", "shore"],
    graze: ["graze_grass"],
    forage: ["leaf_litter", "dig_soil", "graze_grass", "tide_pool", "flower", "bark", "wall", "water_surface"],
    perch: ["perch_branch", "perch_rock", "cliff_ledge"],
    climb: ["perch_branch", "bark"],
    burrow: ["burrow_mouth", "dig_soil"],
    hide: ["shade", "burrow_mouth", "reeds"],
    visit_flowers: ["flower"],
    circle_light: ["porch_light"],
    rest: ["shore", "shade"]
};

export type ScheduleWorld = {sampler: ArkWorldSampler; nav: NavGrid};
export function scheduleWorld(sampler: ArkWorldSampler): ScheduleWorld {
    return {sampler, nav: navGrid(sampler)};
}

/**
 * The shared schedule world (`worldSampler`'s places, then the walk grid) built a few milliseconds at a time between
 * frames (`behaviour-build.ts`): the same world, to the bit, as `scheduleWorld(worldSampler())` all at once. `step`
 * works for about its budget and returns the world once it is built; `spentMs` is the main-thread time it took.
 */
export class ScheduleWorldBuild {
    private sampler: SlicedBuild<ArkWorldSampler> | null;
    private nav: SlicedBuild<NavGrid> | null = null;
    private world: ScheduleWorld | null = null;
    /** Part C: another island's sampler (its own behaviour world in the one world, decision 141); absent: the shared one. */
    private readonly own: ArkWorldSampler | null;

    constructor(own?: ArkWorldSampler | null) {
        this.own = own ?? null;
        this.sampler = this.own ? new SlicedBuild<ArkWorldSampler>([], () => this.own!) : worldSamplerBuild();
    }
    spentMs = 0;
    slices = 0;
    /** The longest single slice (ms): the graphics lane's `allAttachPoints`, one task, sets it unless it was built already. */
    longestMs = 0;

    get done(): boolean {
        return this.world !== null;
    }

    step(budgetMs: number): ScheduleWorld | null {
        if (this.world) return this.world;
        const started = typeof performance !== "undefined" ? performance.now() : Date.now();
        const left = () => budgetMs - ((typeof performance !== "undefined" ? performance.now() : Date.now()) - started);
        this.slices++;
        if (this.sampler) {
            const sampler = this.sampler.step(budgetMs);
            if (sampler) {
                this.sampler = null;
                this.nav = navGridBuild(sampler);
            }
        }
        if (this.nav && (left() > 0 || this.nav.done)) {
            const nav = this.nav.step(Math.max(left(), 0));
            if (nav) this.world = {sampler: this.own ?? worldSampler(), nav};
        }
        const took = (typeof performance !== "undefined" ? performance.now() : Date.now()) - started;
        this.spentMs += took;
        this.longestMs = Math.max(this.longestMs, took);
        return this.world;
    }

    /** Everything left, now. */
    run(): ScheduleWorld {
        for (;;) {
            const world = this.step(Infinity);
            if (world) return world;
        }
    }
}

export {swimPaceLength, swimSpeedOf};

const FLOCKING = new Set(["flock", "school", "swarm"]);
/**
 * (Lane B6 water.) A pod: whales, dolphins and porpoises that keep company (their profile's "group", "herd" or "pack")
 * travel together as a school does, each by its leader, not each on its own round about the group's middle (six
 * spinner dolphins were 8 lengths apart, their headings every way).
 */
const pod = (profile: ArkBehaviourProfile) => profile.social !== "solitary" && profile.social !== "pair" && waterLife(profile.slug, profile) === "cetacean";

/**
 * Where a flyer lands to perch: its own kinds first (a seabird's rocks, ledges and posts, never a branch). One with no
 * perch of its own: a flyer anywhere; a bird that walks first a post or a rock top (a hen on the fence), never a branch
 * (lane MA3: a mute swan landed 6 m up in a conifer).
 */
function perchTags(profile: ArkBehaviourProfile): AttachTag[] {
    const tags: AttachTag[] = [];
    if (profile.interactions.includes("perch_branch")) tags.push("branch");
    if (profile.interactions.includes("perch_rock")) tags.push("rock_top", "post");
    if (profile.interactions.includes("cliff_ledge")) tags.push("cliff_ledge");
    return tags.length ? tags : profile.move === "fly" ? ["branch", "post", "rock_top", "cliff_ledge"] : ["post", "rock_top"];
}
const flies = (profile: ArkBehaviourProfile) => profile.move === "fly" || profile.moves.includes("fly");
const swims = (profile: ArkBehaviourProfile) => profile.move === "swim" || profile.moves.includes("swim");
const walks = (profile: ArkBehaviourProfile) => profile.move === "walk" || profile.moves.includes("walk") || profile.moves.includes("hop");

/** Lives in the water: a swimmer, or a seabed walker (crabs, lobsters, stars) whose ground is the sea floor. */
export function aquatic(profile: ArkBehaviourProfile): boolean {
    return profile.move === "swim" || profile.seabed;
}

/** Walks on land and swims (ducks, otters, frogs, crocodiles, penguins, turtles, seals): it crosses at the water's edges. */
export function amphibious(profile: ArkBehaviourProfile): boolean {
    return swims(profile) && (walks(profile) || profile.move !== "swim") && !profile.seabed;
}

/** A swimmer that floats on the surface (a duck, a swan) rather than swimming down in the water. */
export function floats(profile: ArkBehaviourProfile): boolean {
    return profile.move === "swim" ? profile.moves.includes("fly") && !profile.breathes : profile.roost === "water";
}


/** How far it can go in one slot at its own pace (ground, water; a flyer at its cruise). */
export function reachOf(profile: ArkBehaviourProfile, animal: ScheduleAnimal): number {
    // (MA1: a bird or a bat at L2's cruise for its size, `airPaces`: it used to be four times its free pace, which a rig's
    // walk clip capped. A flying insect keeps that reach: its everyday range stays by its plants, its flights' own pace is
    // its true one all the same.)
    if (profile.move === "fly") {
        const paces = airPaces(profile, animal.length);
        if (paces.kind !== "insect") return paces.cruise * SLOT_SECONDS * 0.75;
    }
    const flyer = profile.move === "fly";
    // (On foot at its walk's pace; in the air and the water at its own: the walk clip governs only walking.)
    if (profile.move === "swim") return swimSpeedOf(profile, animal.length) * SLOT_SECONDS * 0.75;
    return (flyer ? freeBodyLengthsPerSecond(profile) : bodyLengthsPerSecond(profile)) * Math.max(animal.length, 0.05) * (flyer ? 4 : 1) * SLOT_SECONDS * 0.75;
}

/**
 * A flyer's air paces at its length (MA1, `locomotion/flight.ts` airPacesOf): L2's cruise for its size and family, its
 * take-off and landing accelerations (at most half a g), its climb and glide-in angles, and whether it runs to take off
 * or skis in on the water. Pure; remembered by species and length.
 */
export function airPaces(profile: Pick<ArkBehaviourProfile, "slug">, length: number): AirPaces {
    const L = Math.max(length, 0.02);
    const key = `${profile.slug}#${L.toFixed(3)}`;
    let paces = AIR_PACES.get(key);
    if (!paces) {
        // (A species with no styles row: a continuous flapper's numbers for its size.)
        const spec = flightSpec(profile.slug, L) ?? flightSpecOf({style: "continuous", kind: "bird", factor: 1, insectHz: null, stoops: false}, L)!;
        paces = airPacesOf(spec, takeoffClass(profile.slug));
        AIR_PACES.set(key, paces);
    }
    return paces;
}
const AIR_PACES = new Map<string, AirPaces>();

/**
 * The distance (m) a flight loses to its take-off and landing against flying all of it at its cruise: its run, its
 * speeding up and its slowing down, and its ski. A flight is worth taking (averaging at least 0.6 of its cruise) once it
 * is half again as long as this.
 */
export function flightLoss(paces: AirPaces, run: number, ski: number): number {
    const V = paces.cruise;
    const lo = Math.min(run, V);
    const td = Math.min(ski, V);
    const time = lo / paces.runAccel + (V - lo) / paces.accel + (V - td) / paces.brake + td / paces.brake;
    const covered = (lo * lo) / (2 * paces.runAccel) + (V * V - lo * lo) / (2 * paces.accel) + V * V / (2 * paces.brake);
    return Math.max(V * time - covered, 0);
}
export const FLIGHT_WORTH = 1.5;
/** The shortest flight worth its take-off and its landing (m): FLIGHT_WORTH times what they lose (`flyAwaySpot`). */
function flightWorth(profile: ArkBehaviourProfile, animal: ScheduleAnimal): number {
    const paces = airPaces(profile, animal.length);
    return FLIGHT_WORTH * flightLoss(paces, paces.runGround, 0);
}

/**
 * Its home range's radius: by how it moves and its size; never more than half what it can cover in a slot (so
 * every trip in it is done in its time at its own pace), nor more than its `range` (a predator near prey).
 */
/**
 * Its range cap as its goals read it (`spaceHomes`). A bird that swims first, a duck, a goose, a swan, a coot, never under
 * ROOM_LEAST m or three of its lengths (lane MA3 water 2: where a predator's ground left no clear home both ranges shrank
 * to half a metre, a group's leader's was halved again, and a duck flock's every goal was inside 0.25 m: it never moved).
 * The spacing keeps its own; only the floater's goals get room. Anything else keeps its own (given room, a bat roosted
 * in a crown, a monitor lizard and a ribbon worm walked into the rocks).
 */
const ROOM_LEAST = 1.5;
export function rangeCap(profile: Pick<ArkBehaviourProfile, "move" | "moves" | "breathes">, animal: Pick<ScheduleAnimal, "range" | "length">): number {
    if (animal.range === null || animal.range === undefined) return Infinity;
    // (A bird that swims first: not an otter, whose water roost makes it a floater elsewhere; given room it ran into the
    // rocks of the bigger island's cliffs.)
    const floater = profile.move === "swim" && profile.moves.includes("fly") && !profile.breathes;
    return floater ? Math.max(animal.range, ROOM_LEAST, animal.length * 3) : animal.range;
}

export function homeRadius(profile: ArkBehaviourProfile, animal: ScheduleAnimal): number {
    const flyer = profile.move === "fly";
    const base = flyer ? 18 : profile.move === "swim" ? 14 : 6;
    const wanted = Math.min(Math.max(base + animal.length * 5, 3), flyer ? 40 : 26);
    // A range cap (`spaceHomes`) is the whole reach, water and roost included: its everyday range is two thirds of it.
    return Math.max(Math.min(wanted, reachOf(profile, animal) / 2, rangeCap(profile, animal) / 1.5), 0.4);
}

function spotOf(point: AttachPoint): Spot {
    return {x: point.x, y: point.y, z: point.z, nx: point.nx, ny: point.ny, nz: point.nz, point: point.id};
}

/**
 * The water's surface over a point (Part C: the world's own, `ArkWorldSampler.waterSurface`: the bigger wild island's
 * lake and river stand above the sea at their own level). Absent, as on today's island and the town: 0, the sea's,
 * where all their water's surface is; so every test below reads exactly as it did there.
 */
const surfaceY = (world: ScheduleWorld, x: number, z: number) => waterSurfaceOf(world.sampler, x, z);
/** What stands there: the ground, or the water's surface over it. */
const topAt = (world: ScheduleWorld, x: number, z: number) => topOf(world.sampler, x, z);

function groundSpot(world: ScheduleWorld, x: number, z: number): Spot {
    return {x, y: topAt(world, x, z), z, nx: 0, ny: 1, nz: 0, point: null};
}

/**
 * The water's surface where the schedule puts something on it (graphics batch 6, `water-level.ts`): the lake's and the
 * river's fixed level, the sea's mean (0; the scene's depth bands follow the tide). Read when a trip is planned, not
 * every frame (it samples the ground). Where the world has its own surface (`ArkWorldSampler.waterSurface`: the bigger
 * island, the town), that one, the surface `topAt` and `raised` read (lane MA3 water 2: on v2 the two disagreed where
 * the upper river's falls run into the lake, 8.8 m against the lake's 6 a metre off, and a goose's swims there were
 * "raised" and flown, a 1 to 10 m hop at a fifth of its cruise). Never under the ground: where no water was found, a
 * floater's water roost was the sea's 0 on dry land, and a mottled duck slept 1.7 m under its grass.
 */
const surfaceAt = (world: ScheduleWorld, x: number, z: number) => Math.max(world.sampler.waterSurface ? surfaceY(world, x, z) : waterLevelAt(x, z, 0), world.sampler.heightAt(x, z));

const raised = (world: ScheduleWorld, p: Spot) => p.y > topAt(world, p.x, p.z) + 0.4;
const wet = (world: ScheduleWorld, p: {x: number; z: number}) => world.sampler.heightAt(p.x, p.z) < surfaceY(world, p.x, p.z);

/**
 * A body this long (m) or longer is too heavy for a limb that only half suits it (lane MA3: a perch's size against the
 * body's mass, which grows as the length cubed: at 0.6 m a bird is 1-2 kg, a swan's 1.5 m is 10 kg). On a branch it
 * takes only a limb that suits its whole length, never one in a crown.
 */
export const HEAVY_PERCH_LENGTH = 0.6;
/** Whether a place suits a body this long: its size range (half again for a light body on a branch; none in a crown). */
export function perchSuits(point: Pick<AttachPoint, "size" | "hidden" | "tag">, length: number): boolean {
    if (length < point.size[0] * 0.5) return false;
    const branch = point.tag === "branch" || point.tag === "canopy_hang";
    if (branch && length >= HEAVY_PERCH_LENGTH) return !point.hidden && length <= point.size[1];
    return length <= point.size[1] * (point.hidden ? 1.05 : 1.5);
}

/** A seeded attach point of these tags within reach of a centre (and suiting its size), or null. */
function placeNear(world: ScheduleWorld, centre: {x: number; z: number}, length: number, tags: AttachTag[], radius: number, roll: number): AttachPoint | null {
    for (const tag of tags) {
        const near = world.sampler.attachPoints(tag, {x: centre.x, z: centre.z, r: radius});
        // (A place inside a tree's crown, on the bigger wild island: no body larger than its own small size; a heavy body
        // only on a limb that suits all of it: `perchSuits`.)
        const fits = near.filter((p) => perchSuits(p, length));
        // (Grounding, L3: never a tree perch that does not suit it, a pelican on a twig or a crane in a crown hidden in the
        // leaves; another goal instead.)
        const list = fits.length ? fits : near.filter((p) => p.tag !== "branch" && p.tag !== "canopy_hang");
        if (list.length) {
            // Nearer places a little more likely: by distance (then id), a seeded pick weighted to the front (each animal
            // its own). The pick is the k-th in that order, found without sorting the whole list (`kthNearest`).
            return kthNearest(list, centre, Math.floor(roll ** 1.4 * list.length));
        }
    }
    return null;
}

/**
 * The k-th of these points by distance from a centre, then by id: what sorting them all and taking the k-th gives (the
 * same distances, `Math.hypot`, and the same tie-break), by selection in linear time. (2026-11-11: a cold schedule's
 * goal searches sorted every leaf in a canopy's 40 m, the main cost of the runtime's resting query at 9,420 animals.)
 */
export function kthNearest<T extends {x: number; z: number; id: string}>(list: readonly T[], centre: {x: number; z: number}, k: number): T {
    const n = list.length;
    const d = new Float64Array(n);
    const order = new Array<number>(n);
    for (let i = 0; i < n; i++) {
        d[i] = Math.hypot(list[i].x - centre.x, list[i].z - centre.z);
        order[i] = i;
    }
    const before = (a: number, b: number) => d[a] - d[b] || list[a].id.localeCompare(list[b].id);
    let lo = 0;
    let hi = n - 1;
    const want = Math.min(Math.max(k, 0), n - 1);
    while (lo < hi) {
        // Median of three as the pivot, then a three-way split round it.
        const mid = (lo + hi) >> 1;
        const a = order[lo];
        const b = order[mid];
        const c = order[hi];
        const pivot = before(a, b) < 0 ? (before(b, c) < 0 ? b : before(a, c) < 0 ? c : a) : before(a, c) < 0 ? a : before(b, c) < 0 ? c : b;
        let lt = lo;
        let gt = hi;
        let i = lo;
        while (i <= gt) {
            const cmp = before(order[i], pivot);
            if (cmp < 0) {
                const t = order[lt];
                order[lt] = order[i];
                order[i] = t;
                lt++;
                i++;
            } else if (cmp > 0) {
                const t = order[gt];
                order[gt] = order[i];
                order[i] = t;
                gt--;
            } else i++;
        }
        if (want < lt) hi = lt - 1;
        else if (want > gt) lo = gt + 1;
        else return list[order[want]];
    }
    return list[order[want]];
}

/** How steep it walks: a mountain animal takes the slopes. */
export function maxSlopeOf(animal: ScheduleAnimal): number {
    return animal.zone === "mountains" ? MOUNTAIN_SLOPE : MAX_SLOPE;
}

/**
 * How wide it is, for its paths (collisions, motion pass L5): half its drawn width (`collide/bodies.ts`, its model's
 * own shape at its length and its sex's scale). Its paths keep this far from every fence, trunk, rock and wall.
 */
const bodies = new WeakMap<ScheduleAnimal, {radius: number; reach: number}>();
function bodyOf(animal: ScheduleAnimal, slug: string): {radius: number; reach: number} {
    let b = bodies.get(animal);
    if (!b) {
        const shape = bodyShape(slug, Math.max(animal.length, 0.05) * sexLook(animal.id, slug).scale);
        bodies.set(animal, (b = {radius: shape.radius, reach: shape.radius + shape.half}));
    }
    return b;
}
export function bodyRadiusOf(animal: ScheduleAnimal, slug: string): number {
    return bodyOf(animal, slug).radius;
}
/** How far its body reaches from its middle whichever way it turns (its capsule's half length): where it stands and turns. */
export function bodyReachOf(animal: ScheduleAnimal, slug: string): number {
    return bodyOf(animal, slug).reach;
}

/**
 * Where a climb up to a raised spot starts (collisions): the nearest ground round it its body fits at whose straight
 * climb to the spot crosses nothing but what it climbs (the spot's own tree or rock: `collide/attach.ts` hostOf),
 * searched outwards; else the nearest walkable ground. The same for the walk check and the trip.
 */
function climbFoot(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, p: Spot): Spot | null {
    const bodyR = bodyRadiusOf(animal, profile.slug);
    const host = hostOf(p.point);
    const own = (c: Collider) => (host !== null && (c.id === `trunk:${host}` || c.id === `rock:${host}`)) || colliderDistance(c, p.x, p.z) < 0.4;
    for (let ring = 1; ring <= 8; ring++) {
        const d = 0.25 + ring * 0.4;
        for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            const x = p.x + Math.sin(a) * d;
            const z = p.z + Math.cos(a) * d;
            if (world.nav.fits(x, z, bodyR, maxSlopeOf(animal)) && world.nav.runClear({x, z}, p, bodyR * 0.5, own)) return groundSpot(world, x, z);
        }
    }
    const at = world.nav.nearest(p.x, p.z, "walk", 0.5, 3, maxSlopeOf(animal), bodyR);
    return at ? groundSpot(world, at.x, at.z) : null;
}

/**
 * A perch up on a surface (a rock's top, a branch, a ledge) its body fits on (collisions): nothing solid but what it is on
 * (its rock and the rocks touching it, its tree) within its reach there. A crocodile on a small rock top beside a taller
 * rock does not; it rests at the rock's foot instead.
 */
function perchFits(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, spot: Spot): boolean {
    const solid = world.nav.colliders;
    if (!solid || !raised(world, spot)) return true;
    const surface = surfaceOf(spot);
    if (!surface) return true;
    const reach = bodyReachOf(animal, profile.slug);
    const height = Math.max(animal.length * 0.5, 0.1);
    // (Up in a tree, the trunks are its tree's: only rocks, walls and fences round a perch count.)
    for (const c of solid.near(spot.x, spot.z, reach + 0.01)) {
        if (c.soft || c.kind === "trunk" || c.y1 - 0.02 <= spot.y || c.y0 >= spot.y + height) continue;
        if ((surface.host && c.id === `rock:${surface.host}`) || colliderDistance(c, surface.x, surface.z) < (surface.r ?? 0.15)) continue;
        if (reach - colliderDistance(c, spot.x, spot.z) > Math.max(reach * 0.25, 0.03)) return false;
    }
    return true;
}

/**
 * A goal on the ground it fits at (collisions): a spot whose body would stand in a trunk, a rock, a fence or a wall (a
 * patch of grass by a barn, the shade spot of one tree in another's trunk, a wander spot by a log) moves to the nearest
 * point its body fits at whichever way it turns there (its reach), walkable, within 4 m (searched outwards, the same for
 * every caller). A spot on a surface (a branch, a rock's face, a burrow's mouth) or off the ground (raised, in the
 * water) stays where it is.
 */
function clearOfSolid(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, spot: Spot, still = false): Spot {
    const nav = world.nav;
    if (!nav.colliders || onSurface(spot.point) || raised(world, spot) || wet(world, spot)) return spot;
    // (Where it lies still, a roost: its width; where it turns, its reach.)
    const r = still ? bodyRadiusOf(animal, profile.slug) : bodyReachOf(animal, profile.slug);
    const slope = maxSlopeOf(animal);
    // (Clear of everything solid, and not on a cliff's face.)
    if (nav.fits(spot.x, spot.z, r, slope)) return spot;
    // (Rings 0.35 m apart, out to 4.2 m, at most 16 points each: the first that fits, in ring order, is the spot; each
    // animal starts its rings at its own bearing and its own offset out, so a group nudged off one trunk or one fence
    // does not line up in a row along it.)
    const seed = hashString(`${animal.id}#clear`);
    const turn = ((seed % 1000) / 1000) * Math.PI * 2;
    const out = ((Math.floor(seed / 1000) % 1000) / 1000) * 0.3;
    for (let ring = 1; ring <= 12; ring++) {
        const d = ring * 0.35 + out;
        const n = Math.min(Math.max(8, Math.round((Math.PI * 2 * d) / 0.35)), 16);
        for (let k = 0; k < n; k++) {
            const a = turn + (k / n) * Math.PI * 2;
            const x = spot.x + Math.cos(a) * d;
            const z = spot.z + Math.sin(a) * d;
            if (!nav.fits(x, z, r, slope)) continue;
            // (The way it came in, from the spot: never past a fence to its far side.)
            if (!nav.runClear({x: spot.x, z: spot.z}, {x, z}, 0.01)) continue;
            return {...spot, x, y: topAt(world, x, z), z};
        }
    }
    return spot;
}

/** A point in the water near a spot, at the depth it swims at. */
function waterSpot(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, x: number, z: number, random: () => number): Spot {
    const water = world.nav.nearest(x, z, "swim", Math.max(animal.length * 0.6, 0.4)) ?? world.nav.nearest(x, z, "swim", 0.2, 20) ?? {x, z};
    const floor = world.sampler.heightAt(water.x, water.z);
    // (On the surface: the lake's and river's fixed level, the sea's mean: the scene's depth bands follow the tide.)
    const level = surfaceAt(world, water.x, water.z);
    // (Its depth under the surface: below the sea's 0 there, under the lake's or the river's own level on the bigger island.)
    const y = floats(profile) || (!aquatic(profile) && !profile.breathes) ? level : profile.seabed ? floor : Math.max(floor + animal.length * 0.6, Math.min(level - animal.length * 0.4 - random() * Math.max(surfaceY(world, water.x, water.z) - floor - animal.length, 0), level - 0.2));
    return {x: water.x, y: Math.min(y, level), z: water.z, nx: 0, ny: 1, nz: 0, point: null};
}

/**
 * A group member's own side of its group: a point on its own bearing from the group's middle, a little over half the
 * group's spread out (bearings a golden angle apart by rank, each turned a little by its id, the same every slot).
 */
function memberSide(centre: {x: number; z: number}, animal: ScheduleAnimal, rank: number, radius: number): {x: number; z: number} {
    const bearing = rank * 2.399963 + ((hashString(`${animal.id}#side`) % 1000) / 1000 - 0.5) * 0.5;
    return {x: centre.x + Math.sin(bearing) * radius * 0.55, z: centre.z + Math.cos(bearing) * radius * 0.55};
}

/** A point to go to within a range of a centre: walkable land (or water for a swimmer). */
function rangeSpot(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, centre: {x: number; z: number}, radius: number, random: () => number): Spot {
    const r = radius * Math.sqrt(random());
    const a = random() * Math.PI * 2;
    const x = centre.x + Math.cos(a) * r;
    const z = centre.z + Math.sin(a) * r;
    if (aquatic(profile)) return waterSpot(world, profile, animal, x, z, random);
    const land = world.nav.nearest(x, z, "walk", 0.5, 12, maxSlopeOf(animal)) ?? centre;
    return groundSpot(world, land.x, land.z);
}

/**
 * A flight's goal for its own sake (MA1, and the follow-up of decision 285): about FLY_AWAY_SECONDS of flight at its
 * cruise away (at least what its take-off and its landing lose, `flightLoss`, half again; at most FLY_AWAY_MOST), a
 * bird's or a bat's commute across the island and back, not a hop: at its true speed a hop is a second or two in the air,
 * and birds that flew only hops were hardly ever up. On open ground it can stand on (or the water, for a swimmer), within
 * its range's cap, clear of the predators that eat it; nearer when the island is not that wide that way; null when no
 * such spot is found in eight bearings.
 */
function flyAwaySpot(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, centre: {x: number; z: number}, radius: number, random: () => number, water = false): Spot | null {
    const paces = airPaces(profile, animal.length);
    // (A bird or a bat: a flying insect keeps to its plants, as its range does.)
    if (paces.kind === "insect") return null;
    const worth = flightWorth(profile, animal);
    const far = Math.min(Math.max(paces.cruise * FLY_AWAY_SECONDS, worth), FLY_AWAY_MOST);
    // (Never past its range's cap: a predator kept clear of its prey's ranges stays clear, `spaceHomes`. And never down by
    // a predator that eats it: clear of each threat's whole range and a safe distance more.)
    const outer = Math.min(far * 1.15, rangeCap(profile, animal));
    // (Nothing worth the flight inside its cap: a round instead (MA1's own rule), never a flight of a few metres that
    // never gets up to its cruise. Lane MA3 water 2: a black-necked swan on its river, its range capped at 13 m, flew 9
    // to 18 m at a quarter of its cruise.)
    if (outer < Math.max(radius, 3, worth)) return null;
    const safe = Math.max(SAFE_METRES, Math.min(animal.length * 6, SAFE_MOST));
    const clear = (x: number, z: number) => !(animal.threats ?? []).some((t) => Math.hypot(x - t.animal.home.x, z - t.animal.home.z) < (t.animal.range ?? rangeReach(t.profile, t.animal)) + Math.max(safe, Math.max(SAFE_METRES, Math.min(t.animal.length * 6, SAFE_MOST))));
    const a0 = random() * Math.PI * 2;
    const r0 = Math.min(far, outer) * (0.8 + 0.2 * random());
    for (const share of [1, 0.7, 0.45]) {
        const r = Math.max(r0 * share, radius);
        if (r < worth) continue;
        for (let k = 0; k < 8; k++) {
            const a = a0 + k * (Math.PI / 4);
            const x = centre.x + Math.cos(a) * r;
            const z = centre.z + Math.sin(a) * r;
            if (!water) {
                const land = world.nav.nearest(x, z, "walk", 0.5, 12, maxSlopeOf(animal));
                // (In the open: not under a tree's crown, where it could not come down through the canopy.)
                if (land && Math.hypot(land.x - centre.x, land.z - centre.z) >= r * 0.8 && !world.sampler.blocked(land.x, land.z, 2.2) && clear(land.x, land.z)) return groundSpot(world, land.x, land.z);
            }
            // (A swimmer, a puffin or a duck, comes down on the water there as well; a waterbird only there.)
            const wet = water || swims(profile) ? world.nav.nearest(x, z, "swim", 0.5, 12) : null;
            if (wet && Math.hypot(wet.x - centre.x, wet.z - centre.z) >= r * 0.8 && clear(wet.x, wet.z)) return {x: wet.x, y: surfaceAt(world, wet.x, wet.z), z: wet.z, nx: 0, ny: 1, nz: 0, point: null};
        }
    }
    return null;
}

/** Its roost: the same place every night (seeded by its id), from its profile's roost kind; a group's members by their leader's. */
/**
 * Its roost, as its body can sleep there (collisions): on the ground clear of anything solid and off a cliff's face
 * (`clearOfSolid`), up on a perch only one its body fits on (`perchFits`), else at the perch's foot. The same spot
 * for everyone who asks (the trip there, the stay, `restingAtRoost`), worked out once per world.
 */
let roosts = new WeakMap<ScheduleWorld, WeakMap<ScheduleAnimal, Spot>>();
export function roostOf(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal): Spot {
    let byAnimal = roosts.get(world);
    if (!byAnimal) roosts.set(world, (byAnimal = new WeakMap()));
    const known = byAnimal.get(animal);
    if (known) return known;
    let spot = rawRoostOf(world, profile, animal);
    if (world.nav.colliders && !aquatic(profile)) {
        if (!perchFits(world, profile, animal, spot)) {
            const foot = world.nav.nearest(spot.x, spot.z, "walk", 0.5, 3, maxSlopeOf(animal), bodyReachOf(animal, profile.slug));
            if (foot) spot = groundSpot(world, foot.x, foot.z);
        }
        spot = clearOfSolid(world, profile, animal, spot, true);
    }
    // A roost on the ground it could never walk to: off its own stretch of ground (the walk chain kept it where it was,
    // and its sleep, a stay, jumped it there), or further than it walks in a slot (`tooFarOnFoot`). A bed on its home
    // ground instead, the same every night, and the same for everyone who asks: the way there, its sleep, a night watch,
    // `restingAtRoost`, the props lane's den (decision 202: at its natural pace an alligator jumped 21 m into its sleep).
    // (A walker that swims too, a penguin, the same: its roost on land is one it climbs out to on its own ground, by an
    // edge on it. A roost in the water it swims to.) The bed is on dry land, as a den is (`denDry`: never in the sea, its
    // tide or its surf), unless it sleeps on the shore anyway.
    if (walksGoals(profile) && !flies(profile) && !raised(world, spot)) {
        const fits = (to: Spot) => !wet(world, to) && onItsGround(world, profile, animal, {doing: "sleep", to, mode: "ground", stay: []});
        if (!wet(world, spot) && (!fits(spot) || tooFarOnFoot(world, profile, animal, spot))) {
            const dry = (to: Spot) => profile.roost === "shore" || denDry(world, to.x, to.z);
            const bedFits = (to: Spot) => dry(to) && fits(to) && !tooFarOnFoot(world, profile, animal, to);
            // (The first of a few seeded spots round its home that fits, on dry land.)
            const random = rng(hashString(`${animal.id}#bed`));
            const onLand = {...profile, move: "walk" as const, seabed: false};
            const radius = Math.min(homeRadius(profile, animal), 2);
            let bed: Spot | null = null;
            for (let k = 0; k < 8 && !bed; k++) {
                let at = rangeSpot(world, onLand, animal, animal.home, radius * (1 + k / 4), random);
                if (world.nav.colliders) at = clearOfSolid(world, onLand, animal, at, true);
                if (bedFits(at)) bed = at;
            }
            // (Else the nearest that fits on its home ground: its home itself, then rings out from it, half a metre apart,
            // to BED_REACH: a newt's home by the river's mouth gets a bed up the bank, never in the surf.)
            for (let ring = 0; ring * 0.5 <= BED_REACH && !bed; ring++) {
                const n = ring === 0 ? 1 : Math.min(Math.max(8, Math.round(Math.PI * 2 * ring)), 24);
                for (let k = 0; k < n && !bed; k++) {
                    const a = (k / n) * Math.PI * 2;
                    const x = animal.home.x + Math.cos(a) * ring * 0.5;
                    const z = animal.home.z + Math.sin(a) * ring * 0.5;
                    if (world.sampler.heightAt(x, z) < 0 || !dry({x, z} as Spot)) continue;
                    let at = groundSpot(world, x, z);
                    if (world.nav.colliders) at = clearOfSolid(world, onLand, animal, at, true);
                    if (bedFits(at)) bed = at;
                }
            }
            // (None: its roost as it was.)
            if (bed) spot = bed;
        }
    }
    byAnimal.set(animal, spot);
    return spot;
}

/** How far from its home a bed is looked for (m), when its roost is out of reach (`roostOf`). */
const BED_REACH = 16;

/**
 * Dry land for a bed, as a den's (`map/points.ts` inSurf, DEN_DRY, SURF_REACH): not in the water, and not on ground
 * lower than DEN_DRY within SURF_REACH of it, the sea's spring tide and its surf. Of any water here, not only the sea's
 * (the map tells the river's mouth from the sea its own way: five amphibians' beds by the mouth were in its surf), and
 * with a margin (a tenth of a metre up, a metre out, sampled every metre) for the walk grid's heights against the map's.
 */
function denDry(world: ScheduleWorld, x: number, z: number): boolean {
    const height = world.sampler.heightAt(x, z);
    if (height < 0) return false;
    if (height >= DEN_DRY + 0.1) return true;
    const reach = SURF_REACH + 1;
    for (let d = 1; d <= reach; d++) {
        for (let k = 0; k < 24; k++) if (world.sampler.heightAt(x + Math.cos((k / 24) * Math.PI * 2) * d, z + Math.sin((k / 24) * Math.PI * 2) * d) < 0) return false;
    }
    return true;
}

function rawRoostOf(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal): Spot {
    if (animal.roost) return animal.roost;
    const group = animal.group;
    // (A flock whose text has it sleeping together, huddled or in a row, roosts as a group too: `sleep.ts`.)
    const together = sleepStyle(profile.slug).social !== "apart";
    if (group && (!FLOCKING.has(profile.social) || together)) {
        // The group sleeps together: round its leader's roost, each a little apart; huddled, piled or a young mammal
        // against the adult, touching (`sleepSpacing`); on a raised perch in a row along it or a bat's cluster.
        const lead = roostOf(world, group.profile, group.leader);
        if (lead.point && raised(world, lead) && together) {
            // (The point's id keeps the tag it was made with, not always the schedule's: a limb is a branch.)
            const at = RAISED_TAGS.map((tag) => world.sampler.attachPoints(tag, {x: lead.x, z: lead.z, r: 0.3}).find((p) => p.id === lead.point)).find(Boolean);
            const off = roostOffset(profile.slug, group.rank, Math.max(animal.length, group.leader.length), at?.yaw ?? 0);
            if (off) return {...lead, x: lead.x + off.dx, y: lead.y + off.dy, z: lead.z + off.dz};
        }
        if (!lead.point || !raised(world, lead)) {
            const angle = group.rank * 2.39996;
            const close = sleepSpacing(profile.slug, Boolean(animal.young));
            const d = Math.max(animal.length, group.leader.length) * (close < 1 ? (animal.young && !together ? 0.5 : 0.55 * Math.sqrt(group.rank)) : 0.9 + 0.35 * Math.sqrt(group.rank));
            const x = lead.x + Math.cos(angle) * d;
            const z = lead.z + Math.sin(angle) * d;
            if (wet(world, lead)) return {...waterSpot(world, profile, animal, x, z, () => 0.5)};
            const land = world.nav.nearest(x, z, "walk", 0.5, 4, maxSlopeOf(animal)) ?? lead;
            return groundSpot(world, land.x, land.z);
        }
    }
    const seed = rng(hashString(`${animal.id}#roost`))();
    // A water animal (a fish, a crab) never roosts on a land place, whatever its profile says (a seal hauls out: it may).
    // (A hanger, a bat or a sloth, hangs under a limb first: `recipeRoostTags`.)
    const tags = aquatic(profile) && !amphibious(profile) ? [] : recipeRoostTags(profile) ?? ROOST_TAGS[profile.roost] ?? [];
    const point = tags.length ? placeNear(world, animal.home, animal.length, tags, Math.min(homeRadius(profile, animal) * 1.5, rangeCap(profile, animal)), seed) : null;
    // (A water-only animal's roost is in the water: a dry rock or a tree is no roost for a fish.)
    if (point && (!aquatic(profile) || amphibious(profile) || (wet(world, point) && point.y < surfaceY(world, point.x, point.z) + 0.02))) return spotOf(point);
    if (aquatic(profile) || profile.roost === "water" || profile.roost === "bottom" || profile.roost === "reef") {
        const water = world.nav.nearest(animal.home.x, animal.home.z, "swim", 0.4) ?? animal.home;
        const floor = world.sampler.heightAt(water.x, water.z);
        const top = surfaceY(world, water.x, water.z);
        const y = profile.roost === "water" && floats(profile) ? surfaceAt(world, water.x, water.z) : profile.seabed || profile.roost === "bottom" ? floor : Math.min(floor + Math.max((top - floor) * 0.5, 0.4), top - 0.3);
        return {x: water.x, y, z: water.z, nx: 0, ny: 1, nz: 0, point: null};
    }
    return {...groundSpot(world, animal.home.x, animal.home.z)};
}

// MARK: Groups

/** How far from its home an animal can be seen: its range, half again for water and its roost (`spaceHomes` keeps these apart). */
export function rangeReach(profile: ArkBehaviourProfile, animal: ScheduleAnimal): number {
    return homeRadius(profile, animal) * 1.5;
}

/** How far a group's members keep from their leader: wider for bigger animals and bigger groups. */
export function groupSpread(length: number, size: number): number {
    return 2.5 + 1.6 * Math.max(length, 0.3) * Math.sqrt(Math.max(size, 1));
}

/** Where its group's leader is at a moment (pure: the leader's own schedule). */
function leaderAt(world: ScheduleWorld, group: ScheduleGroup, epoch: number, hoursAt: HoursAt): TripPose {
    return basePoseOnTrip(world, tripAt(world, group.profile, group.leader, epoch, hoursAt, group.activity), epoch);
}

/** What its group's leader is set on at a moment (its intent: no route worked out). */
function leaderIntentAt(world: ScheduleWorld, group: ScheduleGroup, epoch: number, hoursAt: HoursAt): Intent {
    return intent(world, group.profile, group.leader, group.activity, slotOf(group.leader, epoch), hoursAt);
}

/**
 * The group's middle for a member's slot: the place its leader is at halfway through it (its slot's goal), not where
 * the leader's own steps there have walked it by then. (2026-11-11, five lions in a row: each member's slot is offset
 * from the leader's, so each took a different moment of the leader's forage, a line of forward steps, as its middle,
 * and the members near their middles stood along that line.)
 */
function groupCentre(world: ScheduleWorld, animal: ScheduleAnimal, slot: number, hoursAt: HoursAt): {x: number; z: number} | null {
    const group = animal.group;
    if (!group) return null;
    const trip = tripAt(world, group.profile, group.leader, slotStart(animal, slot) + SLOT_SECONDS / 2, hoursAt, group.activity);
    return {x: trip.to.x, z: trip.to.z};
}

// MARK: The slot

/** A slot's goal: what for, where (null: wherever the last slot left it), how it travels, and its time there. */
type Intent = {doing: ArkDoing; to: Spot | null; mode: TripMode; stay: Array<Omit<StayBeat, "x" | "z" | "yaw"> & {dx?: number; dz?: number; turn?: number}>; follow?: boolean; /** Its heading once there (a prey animal faces the predator it watches); else seeded. */ face?: number; recipe?: string; /** A flight round and back down where it took off (`roundRoute`). */ round?: boolean; /** A soar's slot that ends up in the air (lane B5: `stationed`); its `to` is where its soar is then. */ aloft?: boolean};

const STAY_DOINGS: ReadonlySet<ArkDoing> = new Set<ArkDoing>(["rest", "groom", "idle", "sleep", "watch"]);
/** Settled where it is: a flock does not take off after a leader that is doing one of these. */
const SETTLED: ReadonlySet<ArkDoing> = new Set<ArkDoing>(["rest", "groom", "perch", "bask", "hide", "sleep", "idle"]);

/**
 * Its beats at the destination: the grazing loop (head down to bite, chew, a step on, now and then the head up to
 * look round), pecking and scanning on the ground, preening on a perch, drinking, basking, play. Offsets are in
 * its own heading's frame (dx forward, dz to the side, in body lengths); times in seconds after it arrives.
 */
function stayBeats(doing: ArkDoing, random: () => number, after: ArkBeat | null): Intent["stay"] {
    const beats: Intent["stay"] = [];
    let t = 0;
    if (after) {
        beats.push({at: 0, beat: after});
        t = after === "shake" ? 2.6 : 0;
    }
    // About a slot's worth (a short trip leaves most of it); a long trip squeezes them (`tripFor`).
    const add = (beat: ArkBeat, seconds: number, extra: {dx?: number; dz?: number; turn?: number} = {}) => {
        if (t > 66) return;
        beats.push({at: t, beat, ...extra});
        t += seconds;
    };
    switch (doing) {
        case "graze":
        case "browse":
            for (let n = 0; n < 14; n++) {
                // Now and then, head down between bites, it turns a little where it stands (26 degrees at most):
                // the only bigger change of its way, and after a pause.
                add("bite", 3 + random() * 5, random() < 0.08 ? {turn: (random() - 0.5) * 0.9} : {});
                add("chew", 1.5 + random() * 2.5);
                if (random() < 0.28) add("scan", 2 + random() * 2.5, {turn: (random() - 0.5) * 1.6});
                // Steps straight on along the way it faces, a few degrees off at most (a grazer drifts forward along the
                // grass; 2026-11-11: a step to one side and the next to the other read as 2-13 turns a minute of movement).
                if (random() < 0.55) add("step", 1.4, {dx: doing === "browse" ? 0.3 + random() * 0.15 : 0.45 + random() * 0.3, turn: (random() - 0.5) * 0.08});
            }
            break;
        case "forage":
        case "visit_flowers":
            for (let n = 0; n < 16; n++) {
                // (As grazing: straight on, a few degrees off; now and then a turn where it stands, 26 degrees at most.)
                add("peck", 1.5 + random() * 3, random() < 0.08 ? {turn: (random() - 0.5) * 0.9} : {});
                if (random() < 0.3) add("scan", 1.5 + random() * 2, {turn: (random() - 0.5) * 1.4});
                if (random() < 0.6) add("step", 1, {dx: 0.5 + random() * 0.4, turn: (random() - 0.5) * 0.08});
            }
            break;
        case "drink":
            add("drink", 6 + random() * 8);
            add("scan", 2 + random() * 2, {turn: (random() - 0.5)});
            add("drink", 4 + random() * 6);
            add("rest", 30);
            break;
        case "watch":
            for (let n = 0; n < 10; n++) add("scan", 3 + random() * 4, {turn: (random() - 0.5) * 2.2});
            break;
        case "perch":
        case "rest":
        case "groom":
        case "bask":
        case "hide":
            for (let n = 0; n < 8; n++) {
                add(doing === "groom" || (doing === "perch" && random() < 0.4) ? "preen" : "rest", 5 + random() * 8);
                if (random() < 0.35) add("scan", 2 + random() * 2, {turn: (random() - 0.5) * 1.2});
            }
            break;
        case "play":
            // Dashes and dodges, not spins (its turns were up to 70 degrees a second: young went round in circles).
            // Dashes, and now and then a dodge (not a spin).
            for (let n = 0; n < 18; n++) add("play", 0.9 + random() * 0.8, {dx: 0.6 + random() * 0.6, dz: (random() - 0.5) * 0.2, turn: n % 3 === 2 ? (random() - 0.5) * 1 : (random() - 0.5) * 0.25});
            break;
        case "stalk":
            for (let n = 0; n < 6; n++) {
                add("stalk", 3 + random() * 3, {dx: 0.25 + random() * 0.25});
                add("pause", 2 + random() * 4);
            }
            break;
        default:
            break;
    }
    return beats;
}

/**
 * What a slot is for, and where (null: wherever the last slot left it). Pure in (id, slot, the hour). After four
 * slots in a row of staying put, the fifth goes back home (or to its group): so where a slot ends never depends on
 * more than the four slots before it, and every caller works it out the same way.
 */
function intent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
    return remember(memoOf(world, hoursAt, animal).intents, slot, () => workIntent(world, profile, animal, activity, slot, hoursAt));
}

function workIntent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
    const placed = placedIntent(world, profile, animal, activity, slot, hoursAt);
    // (One that never walks its goals, a flyer or a swimmer that stays in the water, goes as planned: its walk chain
    // would keep every goal, so it is not worked out.)
    if (!placed.to || placed.follow || !walksGoals(profile)) return placed;
    // Which goals it walks to is worked out in order through its slots (where each leaves it decides the next), from a
    // start WALK_LEAD blocks of slots back: never chained back through every slot, and the same for every caller. (The
    // lead is where two chains, a block apart, come to agree where it is.)
    const start = (Math.floor(slot / WALK_BLOCK) - WALK_LEAD) * WALK_BLOCK;
    // (Whether it walks there, as a flag: not by comparing goal objects, which a planned intent worked out again after
    // the memo let it go is not, so the answer turned on the order things were asked in, a school's leader's swim read
    // as a walk and its school no longer following. 2026-11-11.)
    const here = walkChain(world, profile, animal, activity, start, hoursAt)[slot - start];
    // (A prey animal watching a predator it cannot walk off from by a plain way watches it from where it is: still facing it.)
    return here === null ? placed : {...placed, to: here, mode: "ground", face: placed.doing === "watch" ? placed.face : undefined};
}

/**
 * (Collisions.) Whether its body can stand at a goal on dry ground: a cliff's face with nowhere near to stand
 * (`clearOfSolid` found none) is not gone to, nor started from (2026-11-12: a tenkile climbed to a shade spot on a
 * mountain's face, raised over the walk grid's ground by the slope, and rested there on ground rising 2.1 in 1 for most of
 * an hour). Surface places (a branch, a rock's top) and wet goals are their own.
 */
function standsAt(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, placed: Intent): boolean {
    const to = placed.to;
    // (A point above the walk grid's ground that is no surface, a shade spot on a steep face, is ground too.)
    if (!to || !world.nav.colliders || !walksGoals(profile) || flies(profile) || placed.mode === "air" || onSurface(to.point) || (raised(world, to) && !to.point) || wet(world, to)) return true;
    return world.nav.fits(to.x, to.z, bodyRadiusOf(animal, profile.slug), maxSlopeOf(animal));
}

/** Slots in a block of the walk chain (`walkChain`), and the blocks it runs before the block it decides. */
const WALK_BLOCK = 6;
const WALK_LEAD = 2;

/**
 * The goals it goes to over WALK_LEAD + 1 blocks of slots from `start`: each slot's planned goal if it walks there from where
 * the slot before left it (`walkable`), else where it already is (it does what it meant to there). It starts where its
 * planned goals before `start` leave it.
 */
function walkChain(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, start: number, hoursAt: HoursAt): Array<Spot | null> {
    // (Each slot's entry: null where it goes as planned; where it does not, the spot it stays at instead.)
    return remember(memoOf(world, hoursAt, animal).chains, start, () => {
        // Where it starts: its last planned goal before the chain, and where its beats there left it.
        let goal: Spot | null = null;
        let at: Spot | null = null;
        for (let back = 1; back <= LOOK_BACK && !goal; back++) {
            const earlier = placedIntent(world, profile, animal, activity, start - back, hoursAt);
            if (earlier.follow) break;
            // (Only a goal on its own stretch of ground: one it can ever walk to, and one its body can stand at.)
            if (earlier.to && onItsGround(world, profile, animal, earlier) && standsAt(world, profile, animal, earlier)) {
                goal = earlier.to;
                at = endOf(world, profile, animal, start - back, earlier, earlier.to, null);
            }
        }
        const out: Array<Spot | null> = [];
        for (let k = start; k < start + WALK_BLOCK * (WALK_LEAD + 1); k++) {
            const placed = placedIntent(world, profile, animal, activity, k, hoursAt);
            if (placed.follow) {
                goal = null;
                at = null;
                out.push(null);
                continue;
            }
            if (!placed.to) {
                out.push(null);
                continue;
            }
            const goes = walkable(world, profile, animal, placed, at);
            const to = goes ? placed.to : {...(at ?? groundSpot(world, animal.home.x, animal.home.z)), yaw: undefined};
            out.push(goes ? null : to);
            at = endOf(world, profile, animal, k, placed, to, goal);
            goal = to;
        }
        return out;
    });
}

/** Where its beats at a goal leave it, placed as `settle` places them (facing from the goal before). */
function endOf(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, slot: number, placed: Intent, to: Spot, before: Spot | null): Spot {
    return placeStay(world, profile, animal, to, arrivalYaw(animal, slot, {...placed, to}, before), placed.stay, Infinity).finish;
}

/** How many slots back its last goal is looked for (where it is now, as `finishOf` finds it). */
const LOOK_BACK = 6;

/** Its intent before the walk check: planned, and kept in the water if it lives there. */
function placedIntent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
    return remember(memoOf(world, hoursAt, animal).placed, slot, () => {
        const planned = keepToSide(world, profile, animal, activity, keepInWater(world, profile, animal, plannedIntent(world, profile, animal, activity, slot, hoursAt)), slot, hoursAt);
        // (Collisions: a ground goal its body fits at; a perch up on a rock or a tree its body fits on.)
        if (!planned.to || planned.follow || aquatic(profile)) return planned;
        // (Its roost is made clear once, by `roostOf`, the same for everyone who asks: not moved again here.)
        // (A wary watch's spot off a predator is a goal like any other: made clear too.)
        if (planned.doing === "sleep" || planned.doing === "to_roost" || (planned.doing === "watch" && planned.mode === "stay")) return planned;
        if (!perchFits(world, profile, animal, planned.to)) {
            const foot = world.nav.nearest(planned.to.x, planned.to.z, "walk", 0.5, 3, maxSlopeOf(animal), bodyReachOf(animal, profile.slug));
            if (foot) return {...planned, to: groundSpot(world, foot.x, foot.z), mode: planned.mode === "air" ? "air" : "ground"};
        }
        const to = clearOfSolid(world, profile, animal, planned.to);
        return to === planned.to ? planned : {...planned, to};
    });
}

/**
 * A walk it would not take (the map lane, 2026-11-11: a lion hemmed in among rocks turned full circles; the home-growth
 * lane: a polar bear's route stepped 8.7 m up a cliff). A goal on foot that its walk grid cannot reach from where it is,
 * or only by going well round (a path over 1.3 times the straight way and 2 m more: round a rock to a spot just behind
 * it), or by turning more than 2.2 rad on the way (a slalom through a rock field), is not gone to: it settles where it
 * is (what it meant to do, there; its next goal is another). Long ways keep their detours (to
 * water, to its roost, round a lake): only short ones are checked.
 */
function walkable(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, placed: Intent, before: Spot | null): boolean {
    const to = placed.to;
    // (Off from a predator it has seen it goes by a plain way, or watches it from where it is: `workIntent`.)
    if (!to || placed.follow || !walksGoals(profile)) return true;
    // (A sitter goes to its eggs, the props lane's nest, whatever the way: it never sits beside it. On the merged scenery
    // a boulder by the test's nest made the way a detour, and the duck settled at home: L7, 2026-11-12.)
    if (placed.recipe === "incubate_sit") return true;
    // (Collisions.) A climb up: it walks to the climb's foot first, so that walk is checked as any other: a foot it can
    // reach, by no long way round (2026-11-12: a komodo walked 91 m round to a rock's far side, at 1.6 times its pace).
    // Not a climb home to its roost (going home to sleep may wind, as below: the chains of goals agree on its roost).
    const from0 = before ?? groundSpot(world, animal.home.x, animal.home.z);
    const homeward = placed.doing === "sleep" || placed.doing === "to_roost";
    if (!homeward && placed.mode !== "stay" && !standsAt(world, profile, animal, placed)) return false;
    if (world.nav.colliders && !homeward && !flies(profile) && raised(world, to) && !raised(world, from0)) {
        const foot = climbFoot(world, profile, animal, to);
        if (!foot) return false;
        return walkable(world, profile, animal, {...placed, to: foot, mode: wet(world, foot) ? "water" : "ground"}, from0);
    }
    // A stay (asleep at its roost, a night watch) is where it already is: after a way there it did not take (a roost out
    // of reach), it stays where that left it, never a jump to the roost (decision 202: at its natural pace an alligator's
    // roost moved out of reach, and it jumped 21 m from where it had stayed into its sleep).
    if (placed.mode === "stay") return !before || Math.hypot(before.x - to.x, before.z - to.z) < Math.max(animal.length * 2, 1.5);
    if (placed.mode !== "ground" && placed.mode !== "water") return true;
    // (Going home to sleep may wind: only a roost it cannot reach at all is not gone to.)
    const home = placed.doing === "sleep" || placed.doing === "to_roost";
    let from = before ?? groundSpot(world, animal.home.x, animal.home.z);
    let goal = to;
    if (raised(world, from) || raised(world, to)) return true;
    const fromWet = wet(world, from);
    const toWet = wet(world, to);
    // (Lane MA3: a bird that walks or swims first keeps off the roads the cars drive, the town's: no walk or swim of its
    // ends on one, a duck under the Harbour Road bridge; it does what it came to do where it is. The walk-first rule had
    // the town's pigeons walk their forage out across the high street among the moving cars: the town-cars check.)
    if (flies(profile) && !home && world.sampler.roadway?.(to.x, to.z)) return false;
    if (fromWet && toWet) return true;
    if (fromWet !== toWet) {
        // Out of the water or into it (a seal, a polar bear): the walk is the part on land, from or to the edge it
        // crosses at, as its trip takes it (the home-growth lane's polar bear climbed out at a cliff's foot and walked
        // straight up it to a goal on top).
        if (!amphibious(profile)) return true;
        const edge = waterEdgeNear(world, profile, animal, toWet ? from : to) ?? waterEdgeNear(world, profile, animal, toWet ? to : from);
        if (!edge) return true;
        if (toWet) goal = edge;
        else from = edge;
    }
    // (Lane MA3: nor does it walk across one on the way, a pigeon foraging, a duck out to its bank: the land part.)
    if (flies(profile) && !home && walksOntoRoad(world, from, goal)) return false;
    // A prey animal going off from a predator it watches (the shared wariness) goes, unless its way there would turn it
    // a full circle (the default view's zebra, 47 turns a minute on 3 m): then it watches from where it is.
    const retreat = placed.face !== undefined;
    // Never off its own stretch of ground (pure in the goal: so wherever it is, it can walk to any goal it takes). A
    // retreat too, where the colliders are known: off its ground its way would end straight through a fence (2026-11-12,
    // an elephant watching a predator walked through a paddock's rails); it watches from where it is.
    if ((!retreat || world.nav.colliders) && !onItsGround(world, profile, animal, placed)) return false;
    const straight = Math.hypot(goal.x - from.x, goal.z - from.z);
    // (Lane B4: nor a way on foot from where it is longer than it walks in the slot at the most its feet allow: its goals
    // are each within its reach of home (`tooFarOnFoot`), but two of them on either side of it are twice that apart, and
    // its trip was squeezed into the slot at up to twice its pace. What it can do anywhere, feeding, wandering, resting,
    // it does where it is; a drink, a bask, a swim, its burrow, it still goes to.)
    if (!home && !retreat && ROAMING.has(placed.doing) && straight * 1.1 > 1.2 * bodyLengthsPerSecond(profile) * Math.max(animal.length, 0.05) * Math.max(runFactor(profile), 1) * (SLOT_SECONDS - 14)) return false;
    if (straight < 0.5 || straight > 25 || home) return true;
    // (The search its trip makes: `tripFor`'s ground.)
    const path = world.nav.path(from, goal, "walk", 0.5, 900, maxSlopeOf(animal), bodyRadiusOf(animal, profile.slug), onSurface(goal.point));
    const end = path[path.length - 1];
    const reached = Math.hypot(end.x - goal.x, end.z - goal.z) < 0.01;
    if (!reached) return retreat;
    // Its turns on the way (the corners' headings, summed): a slalom through a rock field turns it round as surely as a
    // loop does.
    const turnsOn = (least: number) => {
        let turning = 0;
        let heading: number | null = null;
        for (let k = 1; k < path.length; k++) {
            if (Math.hypot(path[k].x - path[k - 1].x, path[k].z - path[k - 1].z) < least) continue;
            const h = Math.atan2(path[k].x - path[k - 1].x, path[k].z - path[k - 1].z);
            if (heading !== null) turning += Math.abs(Math.atan2(Math.sin(h - heading), Math.cos(h - heading)));
            heading = h;
        }
        return turning;
    };
    if (retreat) return turnsOn(0.05) < Math.PI * 2;
    return pathLength(path) <= straight * 1.3 + 2 && turnsOn(0.3) <= 2.2;
}

/** Ways it ambles (lane B4, `tripFor`): to its next mouthful, to a place to lie or groom. */
const AMBLING: ReadonlySet<ArkDoing> = new Set<ArkDoing>(["graze", "browse", "forage", "rest", "groom", "visit_flowers"]);
/** Ways it strolls: about its range, at play, on a stalk's approach, to a place to watch from. */
const STROLLING: ReadonlySet<ArkDoing> = new Set<ArkDoing>(["wander", "play", "stalk", "watch", "idle"]);

/** What an animal does wherever it is (lane B4, `walkable`): never worth a way longer than it walks in a slot. */
const ROAMING: ReadonlySet<ArkDoing> = new Set<ArkDoing>(["wander", "forage", "graze", "browse", "rest", "groom", "play", "idle"]);

/**
 * Whether a walk from `from` to `to` goes onto a road's carriageway (`ArkWorldSampler.roadway`, the town's): its goal on
 * one, or its way stepping onto one once it is off the one it starts on (one that landed on a road walks off it). Its
 * straight way, every half metre. False where the world has no roads.
 */
function walksOntoRoad(world: ScheduleWorld, from: {x: number; z: number}, to: {x: number; z: number}): boolean {
    const roadway = world.sampler.roadway;
    if (!roadway) return false;
    if (roadway(to.x, to.z)) return true;
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.5);
    let off = !roadway(from.x, from.z);
    for (let k = 1; k < steps; k++) {
        const on = roadway(from.x + ((to.x - from.x) * k) / steps, from.z + ((to.z - from.z) * k) / steps);
        if (on && off) return true;
        if (!on) off = true;
    }
    return false;
}

/** Whether it walks to its goals (a flyer flies there; a swimmer that never leaves the water swims). */
function walksGoals(profile: ArkBehaviourProfile): boolean {
    return profile.move !== "fly" && !profile.seabed && (profile.move !== "swim" || amphibious(profile));
}

/**
 * Whether a goal is on its own stretch of walkable ground (`NavGrid.region`): the one its home is on (or, one that lives
 * in the water, the ground nearest its home). On foot it goes only there; a dry goal anywhere else (over a cliff, up
 * a mountain lake's ledge) is not gone to, nor one whose nearest edge (where it would climb out) is elsewhere. A goal
 * in the water it swims to.
 */
function onItsGround(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, placed: Intent): boolean {
    const to = placed.to;
    if (!to || placed.follow || placed.face !== undefined || raised(world, to)) return true;
    const walker = profile.move !== "fly" && !profile.seabed && (profile.move !== "swim" || amphibious(profile));
    if (!walker || (placed.mode !== "ground" && placed.mode !== "water")) return true;
    const slope = maxSlopeOf(animal);
    // (Its stretch of ground for its body: cells joined only by steps it fits through: collisions.)
    const r = bodyRadiusOf(animal, profile.slug);
    const homeSpot = groundSpot(world, animal.home.x, animal.home.z);
    let mine = wet(world, homeSpot) ? -1 : world.nav.region(homeSpot.x, homeSpot.z, slope, r);
    if (mine < 0) {
        // (A home in the water, the sea ice say, or on a blocked cell: the ground nearest it, up to 80 m off.)
        const land = world.nav.nearest(homeSpot.x, homeSpot.z, "walk", 0.5, 40, slope, r);
        if (land) mine = world.nav.region(land.x, land.z, slope, r);
    }
    // (A goal in the water it swims to, wherever it is.)
    if (mine < 0 || wet(world, to)) return true;
    if (world.nav.region(to.x, to.z, slope, r) !== mine) return false;
    // (And its path can end there: a cell round the goal its body fits in, by a clear run.)
    if (!world.nav.attachable(to.x, to.z, r, slope, onSurface(to.point))) return false;
    if (!amphibious(profile)) return true;
    // Out of the water onto it, it climbs out at the edge nearest it: that edge on its ground too.
    const edge = waterEdgeNear(world, profile, animal, to);
    return !edge || world.nav.region(edge.x, edge.z, slope, r) === mine;
}

/** In the water and under its surface: where a water-only animal may be sent. */
const underSurface = (world: ScheduleWorld, spot: Spot) => wet(world, spot) && spot.y < surfaceY(world, spot.x, spot.z) + 0.02;

/** A crawler whose species' own depth band is the bed (`sea-depth.ts`: a pond snail, a mussel) or whose water kind is: it lives in the water. */
function bedBound(profile: ArkBehaviourProfile, animal: ScheduleAnimal): boolean {
    if (profile.move !== "crawl" && profile.move !== "slither") return false;
    if (profile.moves.includes("walk") || profile.moves.includes("fly") || profile.moves.includes("climb")) return false;
    // (Or its way in the water is the bed's, `waterKindOf`: the generic bivalve, a leech, a betta filed as a crawler.)
    if (profile.water === "bed") return true;
    const depth = speciesDepth(profile.slug, animal.zone);
    return Boolean(depth) && depth!.source !== "default" && (depth!.band === "pond_bed" || depth!.band === "seabed");
}

/**
 * A water-only animal (a fish, a seabed walker: `aquatic`, not `amphibious`) is never sent onto land, nor onto a rock
 * above the surface (release integration, 2026-11-11: a reef fish slept on a shore rock, a pacu in a tree, from their
 * roost and rest tags). The scene draws it in its sea-depth band only while it is in the water. Such a goal goes to the
 * water nearest it instead (seeded by the goal, so the same goal always gives the same spot), else by its home.
 */
function keepInWater(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, planned: Intent): Intent {
    const to = planned.to;
    // (Lane B6: and one whose own depth band is the bed and that only crawls or sits, a pond snail, a mussel, a leech:
    // its profile has no bed flag in fresh water, and the Danube river snail spent its waking day on the bank.)
    const lives = (aquatic(profile) && !amphibious(profile)) || bedBound(profile, animal);
    if (!to || !lives || underSurface(world, to)) return planned;
    const random = rng(hashString(`${animal.id}#water#${Math.round(to.x * 2)}#${Math.round(to.z * 2)}`));
    const near = waterSpot(world, profile, animal, to.x, to.z, random);
    const spot = underSurface(world, near) ? near : waterSpot(world, profile, animal, animal.home.x, animal.home.z, random);
    return {...planned, to: spot, mode: planned.mode === "stay" ? "stay" : "water"};
}

/**
 * (Lane B6 water.) An animal of the shore keeps to one side of the water's edge for hours at a time (`water-life.ts`
 * shoreSide: a seal hauled out or at sea, a crocodile on the bank through the morning and in the water the rest of the
 * day, a hippo in the water by day and ashore by night, a beaver, an otter; a whirligig and a sea otter always on the
 * water). Before, each 80 s slot chose afresh, and a harbour seal crossed its shore about every ten minutes.
 *
 * A goal on its side is kept. A goal on the other side, or none (it stays where the last slot left it, which may be the
 * other side), becomes its own resting place on its side for as long as the side lasts: in the water its spot off its
 * home (seeded by its id: afloat or hanging there), on land its roost if that is dry, else the water's edge nearest
 * its home. Asleep it is at its roost as ever (a crocodile's, a hippo's and an axolotl's roost is the water, by
 * their profiles). So where it is never depends on more than this slot, like every other goal. A watch on a predator it has
 * seen and a follower keep their own; a recipe whose place is on its side is kept (a bask on the bank in a bout
 * ashore), one on the other side waits for its bout.
 */
function keepToSide(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, planned: Intent, slot: number, hoursAt: HoursAt): Intent {
    if (planned.follow || planned.face !== undefined || !swims(profile) || flies(profile)) return planned;
    const life = waterLife(profile.slug, profile);
    if (!life) return planned;
    // (Asleep it is at its roost, as every animal: a crocodile's, a hippo's and an axolotl's is in the water, a seal's
    // on its shore, by their profiles. Its side is for its waking hours.)
    if (planned.doing === "sleep" || planned.doing === "to_roost") return planned;
    // (A sea otter, which swims first, lives on the water.)
    const sideAt = (start: number) => (life === "otter" && profile.move === "swim" ? "water" : shoreSide(life, animal.id, hoursAt(start), start));
    const start = slotStart(animal, slot);
    let side = sideAt(start);
    if (!side) return planned;
    // (Ashore in good time for its sleep, where its roost is ashore: in its last four waking slots its side is the
    // land's. From its spot out in the water the way home was sometimes one it would not take, and a capybara slept
    // afloat away from its roost.)
    if (side === "water" && !awakeAt(profile, activity, hoursAt(start + 4 * SLOT_SECONDS)) && !wet(world, roostOf(world, profile, animal))) side = "land";
    const to = planned.to;
    const beats = () => stayBeats("rest", rng(hashString(`${animal.id}#side#${slot}`)), null);
    if (side === "water") {
        if (to && wet(world, to) && !raised(world, to)) return planned;
        const random = rng(hashString(`${animal.id}#side#water`));
        const near = world.nav.nearest(animal.home.x, animal.home.z, "swim", Math.max(animal.length * 0.3, 0.3), 30);
        if (!near) return planned;
        const spot = waterSpot(world, profile, animal, near.x + (random() - 0.5) * 2, near.z + (random() - 0.5) * 2, random);
        if (!wet(world, spot)) return planned;
        // (What it meant to do on the move, a forage, a wander, a hunt, it does in the water: a swim about its water,
        // its own each slot. What it meant to do lying still, it does afloat at its spot.)
        const active = (planned.doing === "forage" || planned.doing === "swim" || planned.doing === "dive" || planned.doing === "wander" || planned.doing === "stalk" || planned.doing === "graze" || planned.doing === "browse" || planned.doing === "play");
        if (active) {
            const roam = rng(hashString(`${animal.id}#side#swim#${slot}`));
            const reach = Math.max(homeRadius(profile, animal), 3);
            const out = waterSpot(world, profile, animal, spot.x + (roam() - 0.5) * 2 * reach, spot.z + (roam() - 0.5) * 2 * reach, roam);
            if (wet(world, out)) return {doing: planned.doing === "forage" || planned.doing === "dive" ? planned.doing : "swim", to: out, mode: "water", stay: stayBeats("rest", roam, null)};
        }
        return {doing: "rest", to: spot, mode: "water", stay: beats()};
    }
    // On land. The ones that lie up ashore (a seal, a crocodile, a terrapin, an otter, a beaver) have one place for it;
    // the others (a hippo, a capybara, a deer, a frog) live their own day ashore.
    const liesUp = life === "seal" || life === "croc" || life === "terrapin" || life === "otter" || life === "beaver";
    // (A crocodile or a terrapin out of the water is on its bank, whatever it meant to do ashore: never off inland to a
    // rock or its profile's crevice.)
    const banked = life === "croc" || life === "terrapin";
    // (One that lies up at its roost, a seal, an otter, a beaver, keeps what it meant to do ashore only by its roost:
    // not off across its range, over the river and back.)
    const lair = liesUp && !banked ? roostOf(world, profile, animal) : null;
    const byLair = !lair || wet(world, lair) || (to !== null && Math.hypot(to.x - lair.x, to.z - lair.z) <= Math.max(6, animal.length * 4));
    if (to && !wet(world, to) && !banked && byLair) return planned;
    if (!to && !liesUp) {
        // (Staying where it is: fine unless its last slots may have left it in the water.)
        let was = false;
        for (let back = 1; back <= 5 && !was; back++) was = sideAt(start - back * SLOT_SECONDS) === "water";
        if (!was) return planned;
    }
    if (!liesUp) {
        const land = world.nav.nearest(animal.home.x, animal.home.z, "walk", 0.5, 20, maxSlopeOf(animal));
        return land ? {doing: "wander", to: groundSpot(world, land.x, land.z), mode: "ground", stay: beats()} : planned;
    }
    let spot: Spot | null = !lair || wet(world, lair) ? null : lair;
    if (!spot) {
        const edges = world.sampler.attachPoints("water_edge", {x: animal.home.x, z: animal.home.z, r: 30});
        // (One of the three nearest dry edge points, its own for good, seeded by its id: two crocodiles of one pool do not
        // lie on one point.)
        const dry = [...edges].filter((e) => !wet(world, e)).sort((m, n) => Math.hypot(m.x - animal.home.x, m.z - animal.home.z) - Math.hypot(n.x - animal.home.x, n.z - animal.home.z) || m.id.localeCompare(n.id));
        const best = dry[hashString(`${animal.id}#bank`) % Math.max(Math.min(dry.length, 3), 1)];
        spot = best ? spotOf(best) : null;
    }
    if (!spot) return planned;
    const doing: ArkDoing = banked || planned.doing === "bask" ? "bask" : "rest";
    return {doing, to: spot, mode: "ground", stay: beats()};
}

function plannedIntent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
    // A sitter with eggs in its nest (the props lane's nests: `behaviour-recipes.ts` sitterIntent) sits on it, awake or asleep.
    const start = slotStart(animal, slot);
    const sitting = sitterIntent({world, profile, animal, start, awake: awakeAt(profile, activity, hoursAt(start)), kit: KIT});
    if (sitting) return {doing: sitting.doing as ArkDoing, to: sitting.to, mode: sitting.mode, stay: [], recipe: sitting.recipe};
    const raw = rawIntent(world, profile, animal, activity, slot, hoursAt);
    // (Decision 202: a goal on foot further than it can walk in a slot, at the most its pace cap allows, isn't taken: a
    // goat's drink round its paddock's fence, a komodo's far basking rock. It goes about its home ground instead.)
    // (Its roost is never out of reach: `roostOf`.)
    const sleepy = raw.doing === "sleep" || raw.doing === "to_roost" || raw.doing === "watch";
    // (Lane B4: a walker's swim too, whose water is further than it walks: a 17 cm legless lizard walked 31 m to a swim at
    // eight times its pace.)
    const overland = raw.mode === "ground" || raw.mode === "surface" || (raw.mode === "water" && profile.move !== "swim" && profile.move !== "fly");
    if (raw.to && !raw.follow && !sleepy && overland && tooFarOnFoot(world, profile, animal, raw.to)) {
        const centre = groupCentre(world, animal, slot, hoursAt) ?? animal.home;
        const random = rng(hashString(`${animal.id}#near#${slot}`));
        const near = rangeSpot(world, profile, animal, centre, Math.min(homeRadius(profile, animal), 2), random);
        // (Anything tied to its place, a drink, its burrow, it can't do here: it wanders its home ground.)
        // (Lane B4: what it does anywhere, it does there: it feeds, rests, grooms, or basks where it is. At their own
        // pace the tortoises' basking spots were all out of a slot's reach, and they only ever wandered.)
        const here = ROAMING.has(raw.doing) || raw.doing === "bask" ? raw.doing : "wander";
        return {doing: here, to: near, mode: "ground", stay: stayBeats(here, random, null)};
    }
    if (raw.to || raw.follow) return raw;
    for (let back = 1; back <= 4; back++) {
        const earlier = rawIntent(world, profile, animal, activity, slot - back, hoursAt);
        if (earlier.to || earlier.follow) return raw;
    }
    const centre = groupCentre(world, animal, slot, hoursAt) ?? animal.home;
    const home = rangeSpot(world, profile, animal, centre, Math.min(homeRadius(profile, animal), 2), rng(hashString(`${animal.id}#home#${slot}`)));
    return {doing: STAY_DOINGS.has(raw.doing) && raw.doing !== "sleep" ? "wander" : raw.doing, to: home, mode: aquatic(profile) ? "water" : profile.move === "fly" ? "air" : "ground", stay: raw.stay};
}

/**
 * Whether a goal on foot is further than it can walk in a slot (decision 202): its way from its home ground, at the
 * fastest its feet allow (1.2 of its walk's pace, or its run's when it runs), in all of the slot but 6 s, with room for
 * starting anywhere in its home range. Straight-line first; a way round (a fence, a lake) only when it is close.
 */
function tooFarOnFoot(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, to: Spot): boolean {
    if (profile.move === "fly") return false;
    // (Lane B4: one that swims first and walks too, a terrapin, a crocodile, a seal: a dry goal from a dry home is a walk
    // like any other. Its home range is its swim's, far wider than it walks: a pond terrapin walked 8.6 m ways at three
    // times its pace. In the water, or to it, it swims: not checked.)
    const swimsFirst = profile.move === "swim";
    if (swimsFirst && (!amphibious(profile) || wet(world, to) || wet(world, groundSpot(world, animal.home.x, animal.home.z)))) return false;
    const pace = bodyLengthsPerSecond(profile) * Math.max(animal.length, 0.05);
    const full = 1.2 * pace * Math.max(runFactor(profile), 1) * (SLOT_SECONDS - 6);
    // (Its range's radius is its swim's: room for half its walk's reach at most.)
    const most = full - (swimsFirst ? Math.min(homeRadius(profile, animal), full / 2) : homeRadius(profile, animal));
    const straight = Math.hypot(to.x - animal.home.x, to.z - animal.home.z);
    if (straight > most) return true;
    if (straight < most / 1.6) return false;
    const path = world.nav.path(groundSpot(world, animal.home.x, animal.home.z), to, "walk", 0.5, 900, maxSlopeOf(animal), bodyRadiusOf(animal, profile.slug), onSurface(to.point));
    const end = path[path.length - 1];
    if (!end || Math.hypot(end.x - to.x, end.z - to.z) > 0.5) return false;
    return pathLength(path) > most;
}

function rawIntent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
    // (Lane B5: a flyer keeps to its station and flies off it as its way of life has it: `stationed`.)
    return remember(memoOf(world, hoursAt, animal).raw, slot, () => stationed(world, profile, animal, activity, slot, hoursAt, workRawIntent(world, profile, animal, activity, slot, hoursAt)));
}

function workRawIntent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
    const start = slotStart(animal, slot);
    const hours = hoursAt(start);
    const awake = awakeAt(profile, activity, hours);
    const wasAwake = awakeAt(profile, activity, hoursAt(start - SLOT_SECONDS));
    const flyer = flies(profile);
    const random = rng(hashString(`${animal.id}#${slot}`));
    const group = animal.group;
    if (profile.move === "sessile") return {doing: awake ? "idle" : "sleep", to: {...animal.home, nx: 0, ny: 1, nz: 0, point: null}, mode: "stay", stay: []};

    // A group's watch: one member at a time (in turn, seeded by the group) keeps watch while the others do their own things,
    // by day and (for herds and troops) through the night.
    const size = group ? group.size : 0;
    // (Lane B3 needs: a turn on watch lasts `DAY_WATCH_SLOTS` slots, about four minutes, on the shared clock as the
    // night watch below; a turn of one slot took each member off its grazing every `size` slots, a herd of four's every 5 minutes.)
    const dayWindow = Math.floor((start + SLOT_SECONDS / 2) / (SLOT_SECONDS * DAY_WATCH_SLOTS));
    // (Lane B6: not in a school or a pod that never stops swimming: its watch was a slot hanging still, a mackerel in
    // twelve at any moment, a dolphin in six.)
    const watchTurn = size >= 3 && !(aquatic(profile) && (patrolRule(waterLife(profile.slug, profile))?.share[0] ?? 0) >= 1) ? (dayWindow + hashString(group!.leader.id)) % size === group!.rank : false;
    if (!awake) {
        const roost = roostOf(world, profile, animal);
        // The night watch (sleep lane): always one of the members (never the leader's turn with nobody up), standing about
        // five minutes at a time on the shared clock (each member's slots are offset, so the turn is read at the middle of
        // its slot from one window for the whole group), so the herd is never all asleep and the guard changes now and then.
        const watchWindow = Math.floor((start + SLOT_SECONDS / 2) / (SLOT_SECONDS * NIGHT_WATCH_SLOTS));
        const nightWatch = size >= 3 ? ((watchWindow + hashString(group!.leader.id)) % (size - 1)) + 1 === group!.rank : false;
        if (nightWatch && !FLOCKING.has(profile.social) && !wasAwake) return {doing: "watch", to: roost, mode: "stay", stay: stayBeats("watch", random, null)};
        const travel: TripMode = aquatic(profile) ? "water" : flyer && raised(world, roost) ? "air" : profile.surface && roost.ny < 0.7 ? "surface" : "ground";
        return {doing: wasAwake ? "to_roost" : "sleep", to: roost, mode: wasAwake ? travel : "stay", stay: []};
    }
    // Air-breathers come up to breathe every few slots, then go back down.
    // (Lane B6: a whale, a dolphin, a seal, a sea turtle or a manatee breathes on its own rhythm wherever it swims,
    // `breath-trip.ts`; the breathe trip stays the penguins' and the other divers'.)
    if (profile.breathes && profile.move === "swim" && (slot + hashString(animal.id)) % 3 === 0 && !breathRhythm(waterLife(profile.slug, profile), animal.length, 0)) {
        // (About a breath's swim away at its own pace, any way round: at true size a 14 m humpback reached a breath ±4 m
        // away in a second and floated through it. Motion pass §3.)
        // (2026-11-12, motion pass: a breath's swim and its set-off, about 16 s, so the 15 s breath is taken on the move,
        // and out in open water: a penguin on the polar shelf was sent to a "swim" cell it could walk to over the ice,
        // and came up for air standing on it; another to the cell it was in. The first of eight bearings round from its
        // own that gives open water at least most of the way out.)
        const pace = swimSpeedOf(profile, animal.length) / 1.4;
        const bearing = random() * Math.PI * 2;
        const away = Math.max(4, pace * 16 * (0.9 + 0.3 * random()));
        // (And one its body can swim to from its home water: at true size a 1.15 m emperor penguin no longer fitted the
        // polar cove's narrow leads, its swim path stopped short, and the trip turned into a walk over the shelf.)
        const bodyR = bodyRadiusOf(animal, profile.slug);
        const homeWater = world.nav.nearest(animal.home.x, animal.home.z, "swim", 0.3);
        const swimsTo = (cell: NavPoint) => {
            if (!homeWater) return true;
            const path = world.nav.path(homeWater, cell, "swim", 0.3, 600, MAX_SLOPE, bodyR);
            const end = path[path.length - 1];
            return Boolean(end) && Math.hypot(end.x - cell.x, end.z - cell.z) < 0.01;
        };
        let near: NavPoint | null = null;
        let fallback: NavPoint | null = null;
        for (let k = 0; k < 8 && !near; k++) {
            const b = bearing + (k * Math.PI) / 4;
            const cell = world.nav.nearest(animal.home.x + Math.cos(b) * away, animal.home.z + Math.sin(b) * away, "swim", 0.6);
            if (!cell) continue;
            fallback ??= cell;
            if (!world.nav.walkable(cell.x, cell.z) && Math.hypot(cell.x - animal.home.x, cell.z - animal.home.z) >= 0.6 * away && swimsTo(cell)) near = cell;
        }
        const spot = near ?? fallback ?? animal.home;
        return {doing: "breathe", to: {x: spot.x, y: surfaceAt(world, spot.x, spot.z), z: spot.z, nx: 0, ny: 1, nz: 0, point: null}, mode: "water", stay: []};
    }
    const personality = animalPersonality(animal.id);
    const centre = groupCentre(world, animal, slot, hoursAt) ?? animal.home;
    // A group member keeps within its group's spread of its leader (both capped where predator and prey were kept apart).
    const radius = group ? Math.min(homeRadius(profile, animal), groupSpread(animal.length, size), rangeCap(group.profile, group.leader) / 2) : homeRadius(profile, animal);
    const groupAnimal: ScheduleAnimal = group ? {...animal, home: {x: centre.x, y: animal.home.y, z: centre.z}} : animal;
    // Its own side of the group (a member's goals are looked for close round a point on its own bearing from the
    // leader's place, not anywhere round the place itself): four members picking spots at random round one point stood
    // in an even row once in about 650 moments (the capybaras' and lions' rows); round their own sides, a third of the
    // spread across, about once in 200,000.
    const own = group ? memberSide(centre, animal, group.rank, radius) : centre;
    // Shared wariness (visual only; flee-envelope.md §6.3.3): a predator it can see at its slot's start, awake, from the
    // predator's own schedule (the same for every viewer), sends it to the far side of its range to watch it. Near the
    // camera the local layer (`reactive.ts`) adds the look, the alarm and any dash on top. (Its own seeded stream: an
    // animal with no predator in sight chooses exactly as before.)
    const threat = threatAt(world, profile, animal, start, hoursAt, centre, radius);
    if (threat) {
        const wary = rng(hashString(`${animal.id}#wary#${slot}`));
        const away = {x: centre.x + ((centre.x - threat.x) / threat.d) * radius * 0.7, z: centre.z + ((centre.z - threat.z) / threat.d) * radius * 0.7};
        // (A member a little to its own side of the line off the predator: not all of a group's watchers on that line.)
        const spot = rangeSpot(world, profile, groupAnimal, group ? memberSide(away, animal, group.rank, radius * 0.6) : away, Math.max(radius * 0.25, 0.5), wary);
        return {doing: "watch", to: spot, mode: aquatic(profile) ? "water" : profile.move === "fly" ? "air" : "ground", stay: stayBeats("watch", wary, null), face: Math.atan2(threat.x - spot.x, threat.z - spot.z)};
    }
    if (watchTurn) {
        // At the group's edge, facing out.
        const spot = rangeSpot(world, profile, groupAnimal, own, radius * (group ? 0.3 : 0.9), random);
        return {doing: "watch", to: spot, mode: aquatic(profile) ? "water" : "ground", stay: stayBeats("watch", random, null)};
    }
    // A flocking species' member flies with its leader when its leader is in the air (most of the time, not always).
    // A school keeps together nearly always (a loose cluster round its leader).
    if (group && (FLOCKING.has(profile.social) || pod(profile)) && (flyer || aquatic(profile)) && random() < (aquatic(profile) ? 0.9 : 0.75)) {
        const lead = leaderIntentAt(world, group, start + 1, hoursAt);
        // Its place is by its leader; what it does there is its own (a school's fish feed or cruise, a flock's birds fly),
        // so a school is one shape but not one state (problem 7).
        // (Lane B3 needs: not while its leader is settled, resting on its perch through its spell: its goal is the same
        // perch slot after slot, in the air only by name, and a member "flying with it" dropped 9.6 m off its own perch.)
        // (Nor on its leader's hop of a few metres, a second or two in the air: the member was eased to its place by
        // its leader along the ground in that time, sideways to the way it faced (the backwards test's house sparrow).
        // It goes about its own choice by its group instead.)
        const hop = lead.mode === "air" && !tripAt(world, group.profile, group.leader, start + 1, hoursAt, group.activity).legs.some((leg) => leg.mode === "air" && leg.seconds >= 3);
        if ((lead.mode === "air" || (aquatic(profile) && lead.mode === "water")) && lead.to && !(lead.mode === "air" && (SETTLED.has(lead.doing) || hop))) {
            // (Lane B3 needs: a school's fish feeds through its own feeding bouts and cruises between them, each a
            // little off its leader's rhythm; drawn slot by slot, 45 in 100, it changed every slot or two.)
            const own: ArkDoing = lead.mode === "air" ? "fly" : needAt(profile, animal, activity, start, hoursAt) === "feed" ? "forage" : "swim";
            return {doing: own, to: null, mode: lead.mode, stay: [], follow: true};
        }
    }
    // Young play near their group.
    if (animal.young && group && random() < 0.45) {
        return {doing: "play", to: rangeSpot(world, profile, groupAnimal, own, Math.max(radius * (group ? 0.3 : 0.5), 1), random), mode: aquatic(profile) ? "water" : "ground", stay: stayBeats("play", random, null)};
    }
    // Its own choice; a group member is a little less likely to do just what its leader does now.
    const leaderDoing = group ? leaderIntentAt(world, group, start + 1, hoursAt).doing : null;
    // (Lane B3 needs: what the slot is for, a feeding bout, its rest, a trip to water, comes first; then its choice within it.)
    const need = needAt(profile, animal, activity, start, hoursAt);
    let behaviour = pick(profile, animal.id, hours, random(), personality.boldness, personality.curiosity, need, leaderDoing as ArkBehaviour | null);
    // (Its spell's own seeded stream, `spellOf`: where it rests or feeds is drawn from it, the same through the spell.)
    const spell = need === "rest" || need === "bask" || need === "feed" ? rng(hashString(`${animal.id}#spell#${need}#${spellOf(animal.id, need, start)}`)) : null;
    // A rest keeps one way of resting through its spell (a bird its perch: it sits, rests and preens there); what it
    // does there this slot, a rest or a groom, is the slot's own.
    let there: ArkDoing | null = null;
    if (spell && need !== "feed" && RESTS.has(behaviour)) {
        let settled = pick(profile, animal.id, hours, spell(), personality.boldness, personality.curiosity, need, null);
        if (RESTS.has(settled)) {
            // (A wading bird's rest may be standing in its shallows: `WADING`, below.)
            if (profile.move === "fly" && profile.water !== "wader" && (profile.weights.perch ?? 0) > 0 && (settled === "rest" || settled === "groom")) settled = "perch";
            there = behaviour === "rest" || behaviour === "groom" ? behaviour : (settled as ArkDoing);
            behaviour = settled;
        }
    }
    // (Where: the spell's roll through a rest or a feeding bout, the slot's own otherwise; a rest's place in its patch too.)
    // (A bird that flies first feeds from place to place as before, each slot's its own: held to one patch its flights
    // became hops of a few metres, flown at a third of its cruise; the movement audit's air-speed guard. Lane B5's.)
    const placeRandom = spell && !(need === "feed" && profile.move === "fly") ? spell : random;
    const spotRandom = spell && need !== "feed" ? spell : random;
    // A browser's grazing is at bushes and trees.
    let doing: ArkDoing = there ?? (behaviour as ArkDoing);
    if ((behaviour === "graze" || behaviour === "forage") && (profile.diet === "browser" || profile.diet === "fruit") && walks(profile) && !flyer) doing = "browse";
    else if (behaviour === "graze" || (behaviour === "forage" && profile.diet === "grazer")) doing = "graze";
    // A recipe from its stored behaviours may take this slot (a perch by the water to fish from, its nest, bare ground).
    const planned = recipeIntent({world, profile, animal, slug: profile.slug, slot, start, hours, behaviour, doing, centre, radius, kit: KIT});
    // (Lane MA3: one that walks or swims first takes a recipe up by air, a nest in a tree, only as often as it flies.)
    if (planned && !(planned.mode === "air" && !airAllowed(profile, animal, slot))) return {doing: planned.doing as ArkDoing, to: planned.to, mode: planned.mode, stay: [], recipe: planned.recipe};
    // A wading bird (a heron, an egret, a stork, an ibis) stands in the shallows to fish and to rest, its legs in the
    // water (lane MA3: the audit's herons were never in the water but for a minute's spear). Its own seeded stream.
    // (Lane B3 needs: through a spell of rest or feeding it keeps to the shallows or out of them, and to one stand in
    // them, drawn by the spell: slot by slot it changed its stand every 80 s.)
    const wadeKey = spell ? spellOf(animal.id, need, start) * 2 + (need === "feed" ? 1 : 0) : slot;
    if (profile.water === "wader" && WADING.has(behaviour) && rng(hashString(`${animal.id}#wade#${wadeKey}`))() < WADE_SHARE) {
        const shallows = shallowsNear(world, animal, centre, Math.min(Math.max(radius * 1.6, 8), 40), wadeKey);
        if (shallows) {
            const wadeRandom = rng(hashString(`${animal.id}#wade-beats#${slot}`));
            // (One that walks first, a rail, a gallinule, walks to its shallows within its walk's reach, and flies further
            // only as often as it flies: lane MA3, a water rail hopped 4-10 m to the shallows 36 times a day.)
            const way = Math.hypot(shallows.x - centre.x, shallows.z - centre.z);
            const far = profile.move === "fly" ? way > Math.max(3, animal.length * 6) : way > walkReach(profile, animal) && airAllowed(profile, animal, slot);
            return {doing: behaviour === "wander" ? "forage" : (there ?? (behaviour as ArkDoing)), to: shallows, mode: flyer && far ? "air" : "ground", stay: stayBeats(behaviour === "forage" || behaviour === "wander" ? "watch" : "rest", wadeRandom, null)};
        }
    }
    if (behaviour === "stalk" && !animal.prey) behaviour = "wander";
    if (behaviour === "stalk") {
        // Towards the edge of its own range on its prey's side, slowly, with pauses; never past its range.
        const dx = animal.prey!.x - animal.home.x;
        const dz = animal.prey!.z - animal.home.z;
        const d = Math.hypot(dx, dz) || 1;
        const reach = homeRadius(profile, animal) * (0.6 + 0.3 * random());
        const at = world.nav.nearest(animal.home.x + (dx / d) * reach, animal.home.z + (dz / d) * reach, "walk", 0.5, 6, maxSlopeOf(animal));
        // (Behaviours pass, B1: one that hunts by waiting, a crocodile, a snake, a frog, a mantis, a heron, lies in wait
        // there, still, with a look round now and then; only a stalker creeps. `waitsForPrey`.)
        if (at) return {doing: "stalk", to: groundSpot(world, at.x, at.z), mode: "ground", stay: stayBeats(waitsForPrey(profile) ? "hide" : "stalk", random, null)};
        behaviour = "wander";
    }
    const placeKinds = doing === "browse" ? (["shade", "perch_branch"] as ArkInteraction[]) : BEHAVIOUR_PLACES[behaviour];
    if (placeKinds) {
        for (const place of placeKinds) {
            // Anyone may rest in the shade; every other place is the animal's own (a seal's shore, a lizard's rock).
            if (!profile.interactions.includes(place) && !(behaviour === "rest" && place === "shade") && doing !== "browse") continue;
            const tags = INTERACTION_TAGS[place] ?? [];
            const far = place === "drink_edge" || place === "porch_light";
            const cap = Math.min(rangeCap(profile, animal), group ? rangeCap(group.profile, group.leader) / 2 : Infinity);
            // Water and lights may be a little beyond its usual ground: never more than half again its range (`rangeReach`).
            // (Lane MA3: a duck, a goose or a swan out on its water looks for its bank to rest on up to 20 m off, a slot's
            // swim at a duck's 0.3 m/s: a flock's member searched only its small share of the flock's spread, and its swim
            // reach is its walk clip's, and it never came ashore.)
            const bank = place === "shore" && aquatic(profile) && amphibious(profile) ? 20 : 0;
            const point = placeNear(world, far ? centre : own, animal.length, tags, Math.min(Math.max(far ? Math.min(45, reachOf(profile, animal) / 2, homeRadius(profile, animal) * 1.5) : radius * (group ? 0.5 : 1.4), bank), cap), placeRandom());
            if (point) {
                const up = point.y > topAt(world, point.x, point.z) + 0.5;
                // (Lane MA3: a bird that walks or swims first flies up to a perch, a branch, a ledge only as often as it flies:
                // otherwise it does what it came to do on the ground, the next of its places.)
                if (up && flyer && !airAllowed(profile, animal, slot)) continue;
                // A patch of ground (grass, shade, the water's edge, the litter, a cliff's ledge): each animal stands its own
                // place in it, so a herd spreads over the grass and a colony over its ledges instead of stacking on one
                // point or standing in the ledges' even row.
                const spread = point.tag === "grass" ? 3.2 : point.tag === "shade" || point.tag === "leaf_litter" ? 1.4 : point.tag === "cliff_ledge" ? 1.8 : point.tag === "rock_top" ? 1 : point.tag === "water_edge" ? 0.9 : 0;
                if (spread && !up) {
                    const a = spotRandom() * Math.PI * 2;
                    const r = spread * (0.25 + 0.75 * Math.sqrt(spotRandom())) * Math.max(Math.min(animal.length, 2), 0.3);
                    const x = point.x + Math.cos(a) * r;
                    const z = point.z + Math.sin(a) * r;
                    // (A bird flies to its spot on a ledge: dry ground is enough, it need not be walkable.)
                    const stands = flyer && (point.tag === "cliff_ledge" || point.tag === "rock_top") ? world.sampler.heightAt(x, z) > surfaceY(world, x, z) + 0.05 : world.nav.walkable(x, z, maxSlopeOf(animal));
                    if (stands && (point.tag !== "water_edge" || world.sampler.heightAt(x, z) > surfaceY(world, x, z) + 0.02)) {
                        return {doing, to: {...groundSpot(world, x, z), point: point.id}, mode: aquatic(profile) ? "water" : profile.surface && point.ny < 0.7 ? "surface" : flyer && (doing === "visit_flowers" || doing === "circle_light") ? "air" : "ground", stay: stayBeats(stalkStay(profile, doing), random, null)};
                    }
                }
                const mode: TripMode = profile.surface && point.ny < 0.7 ? "surface" : flyer && (up || doing === "visit_flowers" || doing === "circle_light") ? "air" : aquatic(profile) ? "water" : "ground";
                return {doing, to: spotOf(point), mode, stay: stayBeats(stalkStay(profile, doing), random, null)};
            }
        }
    }
    switch (behaviour) {
        case "fly":
        case "soar": {
            // A goal: a perch, a feeding spot on the ground, or (a floater) the water.
            const roll = random();
            // A waterbird's flights go from water to water (lane MA3: a coot or a swan never flies off its lake to a
            // tree or a field; it swims to the bank and walks out). Further across its water than its swims go.
            if (aquatic(profile) && flies(profile)) {
                // (MA1 follow-up: a flight for its own sake across its water, a swan's or a goose's commute, about
                // FLY_AWAY_SECONDS at its cruise when the water is that wide and its predators' ranges allow: `flyAwaySpot`.)
                const across = !group && behaviour === "fly" ? flyAwaySpot(world, profile, animal, own, radius, random, true) : null;
                if (across) return {doing: behaviour, to: across, mode: "air", stay: stayBeats("rest", random, null)};
                const water = waterSpot(world, profile, animal, centre.x + (random() - 0.5) * radius * 2.4, centre.z + (random() - 0.5) * radius * 2.4, random);
                // (Where its water is too small for that, or its range too tight (a predator's ground all round), a
                // round: out over the island and back down on its own water, a duck's circuit of its pond. Before,
                // it hopped a metre or two across its pond, up and down like a helicopter, and at its true take-off a
                // hop is swum instead: it never flew at all. `roundRoute`.)
                // (One that swims first with room for a hop inside its range's cap but not for a flight worth its take-off
                // flies MA1's round, at its cruise, only as often as it flies (MA3's `airAllowed`), and else swims there, as
                // its hops across mostly were (`tripFor`): as rounds every time a coot flew off its water 20 times a day.
                // With no room at all, MA1's round, as before.)
                // (Its own range, before a floater's room (`rangeCap`): with none of its own, MA1's round as before.)
                const ownRange = animal.range ?? Infinity;
                if (!group && behaviour === "fly" && profile.move !== "fly" && ownRange >= Math.max(radius, 3) && ownRange < flightWorth(profile, animal) && !airAllowed(profile, animal, slot)) return {doing: "swim", to: water, mode: "water", stay: stayBeats("rest", random, null)};
                if (!group && behaviour === "fly") return {doing: behaviour, to: water, mode: "air", stay: stayBeats("rest", random, null), round: true};
                return {doing: behaviour, to: water, mode: "air", stay: stayBeats("rest", random, null)};
            }
            // (Lane MA3: one that walks first flies across its ground and comes down on it, never up to a perch: else it
            // would fly twice, up and down again.)
            const perch = roll < 0.5 && profile.move === "fly" ? placeNear(world, own, animal.length, perchTags(profile), radius * (group ? 0.5 : 1), random()) : null;
            if (perch) return {doing: behaviour, to: spotOf(perch), mode: "air", stay: stayBeats("perch", random, null)};
            if (roll > 0.88 && floats(profile)) return {doing: behaviour, to: waterSpot(world, profile, animal, centre.x + (random() - 0.5) * radius, centre.z + (random() - 0.5) * radius, random), mode: "air", stay: stayBeats("rest", random, null)};
            // (MA1: a flight for its own sake goes somewhere worth flying to, about FLY_AWAY_SECONDS at its cruise away
            // (`flyAwaySpot`), out past its everyday range if need be. A group member keeps by its group; a soar sweeps.)
            const away = !group && behaviour === "fly" ? flyAwaySpot(world, profile, animal, own, radius, random) : null;
            if (away) return {doing: behaviour, to: away, mode: "air", stay: stayBeats("forage", random, null)};
            // (Nowhere worth flying to within its range's cap (a predator's ground all round): a round out and back down
            // by where it was, as a waterbird on a small pond flies, not a hop it would walk. A flying insect keeps to its
            // plants.)
            const round = !group && behaviour === "fly" && airPaces(profile, animal.length).kind !== "insect";
            return {doing: behaviour, to: rangeSpot(world, {...profile, move: "walk", seabed: false}, groupAnimal, own, radius * (group ? 0.3 : 1), random), mode: "air", stay: stayBeats("forage", random, null), ...(round ? {round} : {})};
        }
        case "swim":
        case "dive":
            if (swims(profile)) {
                const water = waterSpot(world, profile, animal, centre.x + (random() - 0.5) * radius * 2, centre.z + (random() - 0.5) * radius * 2, random);
                return {doing: profile.move === "swim" ? "swim" : behaviour, to: water, mode: "water", stay: stayBeats("rest", random, null)};
            }
            return {doing: "rest", to: null, mode: "stay", stay: stayBeats("rest", random, null)};
        case "wander":
        case "forage":
        case "graze":
            return {
                // (A swimmer feeding is foraging, cruising is swimming: its states stay its own, not all "swim".)
                doing: profile.move === "swim" ? (behaviour === "wander" ? "swim" : doing) : behaviour === "wander" && profile.surface ? "crawl" : doing,
                // (Lane MA3: one that walks first keeps its wanders within a walk, never a flight across its range.)
                to: rangeSpot(world, profile, groupAnimal, own, flyer && profile.move === "walk" ? Math.min(radius * (group ? 0.3 : 1), walkReach(profile, animal) * 0.8) : radius * (group ? 0.3 : 1), random),
                mode: aquatic(profile) ? "water" : flyer && profile.move === "fly" ? "air" : profile.surface ? "surface" : "ground",
                stay: stayBeats(stalkStay(profile, doing), random, null)
            };
        default: {
            // (Lane B6: one that never stops swimming, a tuna, a pilchard, a dolphin, has no rest on the spot: it swims on.)
            if (aquatic(profile) && (patrolRule(waterLife(profile.slug, profile))?.share[0] ?? 0) >= 1) {
                return {doing: "swim", to: rangeSpot(world, profile, groupAnimal, own, radius * (group ? 0.3 : 1), random), mode: "water", stay: []};
            }
            const stayDoing: ArkDoing = STAY_DOINGS.has(doing) ? doing : "rest";
            // A group member that rests keeps near its group (it walks to it first if it has drifted away).
            if (group) return {doing: stayDoing, to: rangeSpot(world, profile, groupAnimal, centre, radius * 0.6, spotRandom), mode: aquatic(profile) ? "water" : "ground", stay: stayBeats(stayDoing, random, null)};
            // A den, burrow, cave, hole or crevice animal mostly rests in it, out of sight (`restingAtRoost`: the runtime's
            // rotation hides the ones resting at home, so one out of sight is plausibly there). Its own seeded stream
            // (lane B3 needs: one draw for a whole rest spell, in or out, not in and out slot by slot).
            const resting = spell && need !== "feed";
            if ((stayDoing === "rest" || (resting && stayDoing === "groom")) && ENCLOSED_ROOSTS.has(profile.roost) && rng(hashString(resting ? `${animal.id}#den#spell#${spellOf(animal.id, need, start)}` : `${animal.id}#den#${slot}`))() < 0.6) {
                const roost = roostOf(world, profile, animal);
                const travel: TripMode = aquatic(profile) ? "water" : flyer && raised(world, roost) ? "air" : profile.surface && roost.ny < 0.7 ? "surface" : "ground";
                return {doing: "rest", to: roost, mode: travel, stay: stayBeats("rest", random, null)};
            }
            // (Lane B3 needs: a rest with no place of its kind near has its own spot through the spell, near where it
            // lives: it goes there, settles and stays; a bird with no perch that suits it sits on the ground, a fish
            // holds its station. With no goal a rest stayed wherever the last slot left it, and once four such slots
            // had gone by every slot after them went home as a wander, `plannedIntent`: a long rest never was one, and
            // an eagle with no perch "wandered" through 60% of its day.)
            // (A bird that flies first: anywhere in its range, a flight like its others; a few lengths off it was a hop
            // flown at a fifth of its cruise.)
            const airborne = flyer && profile.move === "fly";
            if (resting) return {doing: stayDoing, to: rangeSpot(world, profile, animal, own, airborne ? radius : Math.max(Math.min(radius * 0.5, animal.length * 6), 0.5), spell!), mode: aquatic(profile) ? "water" : airborne ? "air" : profile.surface ? "surface" : "ground", stay: stayBeats(stayDoing, random, null)};
            return {doing: stayDoing, to: null, mode: "stay", stay: stayBeats(stayDoing, random, null)};
        }
    }
}

const CRUISE: Record<"low" | "mid" | "high", number> = {low: 1.6, mid: 6, high: 14};

/**
 * One that hunts by waiting (behaviours pass, B1; `hunting.ts` huntStyle's wait and wade, by the same rule): a wader
 * that eats fish or meat, or an ambusher or perch hunter that is no mammal and neither stalks nor pursues. Its stalk
 * slot is a wait, not a creep.
 */
function waitsForPrey(profile: ArkBehaviourProfile): boolean {
    if (profile.water === "wader") return profile.diet === "fish" || profile.diet === "meat";
    const intel = intelProfile(profile.slug);
    const hunt = intel.hunt;
    if (intel.plan === "quadruped" || intel.plan === "primate" || hunt.includes("stalk") || hunt.includes("pursuit")) return false;
    return hunt.includes("ambush") || hunt.includes("perch_wait");
}

/** A stalk's stay wherever its slot puts it: one that hunts by waiting rests and looks round (a hide's beats), the others creep. */
const stalkStay = (profile: ArkBehaviourProfile, doing: ArkDoing): ArkDoing => (doing === "stalk" && waitsForPrey(profile) ? "hide" : doing);

/** The share of a stay step's time it gets going over, and stops over (lane B4). */
const STEP_RAMP = 0.2;

/** Whether a stay's steps (a stalk's creep, play's dashes, a step aside) move it at a spot: only on the ground, not raised, not in the water. */
function stepsMove(world: ScheduleWorld, at: Spot): boolean {
    return !raised(world, at) && !wet(world, at);
}

/** Its stay's beats placed in the world from where it arrives (steps and play move it; turns turn it). */
function placeStay(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, at: Spot, yaw0: number, beats: Intent["stay"], seconds: number): {beats: StayBeat[]; finish: Spot} {
    const out: StayBeat[] = [];
    let x = at.x;
    let z = at.z;
    let yaw = yaw0;
    const onGround = stepsMove(world, at);
    for (const beat of beats) {
        if (beat.at > seconds) break;
        // A scan is a look round with the head (its clip and the look chain: `head-look.ts`); the body stays as it stands.
        // (2026-11-11: the body's small glance with each scan, and the arrival turn, added up to over a turn a minute in
        // a grey heron's watch.)
        const glance = 0;
        if (beat.beat !== "scan") yaw += beat.turn ?? 0;
        let dur: number | undefined;
        if ((beat.dx || beat.dz) && onGround) {
            const l = Math.max(animal.length, 0.05);
            // Never further than its walk's pace covers in the step's time: a slow walker takes small steps.
            const stepTime = beat.beat === "play" ? 0.8 : beat.beat === "stalk" ? 2.5 : 1.2;
            const most = (bodyLengthsPerSecond(profile) * stepTime) / Math.max(Math.hypot(beat.dx ?? 0, beat.dz ?? 0), 1e-6);
            const k = Math.min(most, 1);
            const nx = x + (Math.sin(yaw) * (beat.dx ?? 0) + Math.cos(yaw) * (beat.dz ?? 0)) * l * k;
            const nz = z + (Math.cos(yaw) * (beat.dx ?? 0) - Math.sin(yaw) * (beat.dz ?? 0)) * l * k;
            // Only onto ground it can walk, and never out of its range (a stalker stops at the edge).
            const within = Math.hypot(nx - animal.home.x, nz - animal.home.z) <= Math.max(homeRadius(profile, animal) * 1.6, 2);
            // (And the step itself clear of everything solid for its body, and where it ends: collisions.)
            const r = bodyRadiusOf(animal, profile.slug);
            if (world.nav.fits(nx, nz, bodyReachOf(animal, profile.slug), maxSlopeOf(animal)) && within && world.nav.runClear({x, z}, {x: nx, z: nz}, r)) {
                // A step (a stalk is a creep, slow by intent) takes as long as its walk's own pace says, not a fixed
                // 1.2 s: a grazer's step at a fifth of its clip's pace played the walk in slow motion.
                // (Lane B4: a fifth longer, for its getting going and its stopping, `STEP_RAMP`: its pace between is its walk's.)
                if (beat.beat !== "stalk" && beat.beat !== "play") dur = Math.min(Math.max(Math.hypot(nx - x, nz - z) / (bodyLengthsPerSecond(profile) * l) / (1 - STEP_RAMP), 0.1), stepTime);
                x = nx;
                z = nz;
            }
        }
        out.push(dur === undefined ? {at: beat.at, beat: beat.beat, x, z, yaw: yaw + glance} : {at: beat.at, beat: beat.beat, x, z, yaw: yaw + glance, dur});
    }
    const y = onGround ? topAt(world, x, z) + (at.y - topAt(world, at.x, at.z)) : at.y;
    return {beats: out, finish: {...at, x, y: onGround ? y : at.y, z, yaw}};
}

/** A flock member's place beside its leader this slot, and its leader's trips over the slot. */
function shadowOf(world: ScheduleWorld, animal: ScheduleAnimal, slot: number, hoursAt: HoursAt): {trips: Trip[]; dx: number; dy: number; dz: number; finish: Spot} {
    const group = animal.group!;
    const start = slotStart(animal, slot);
    const end = start + SLOT_SECONDS;
    const random = rng(hashString(`${animal.id}#flock#${slot}`));
    const first = tripAt(world, group.profile, group.leader, start, hoursAt, group.activity);
    const trips = [first];
    if (first.end < end) trips.push(tripAt(world, group.profile, group.leader, first.end, hoursAt, group.activity, first));
    // A loose cluster, never a row: some ahead, some behind, above or below, each its own distance.
    const at = basePoseOnTrip(world, trips[trips.length - 1], end);
    let dx = 0;
    let dz = 0;
    const dy = (random() - 0.5) * Math.max(animal.length, 0.3) * (aquatic(group.profile) ? 2.4 : 1.6);
    // (Lane B6: a school or a pod in the water keeps closer, 0.6 of a flock's spacing: twelve pilchards were 5.5 lengths from their
    // nearest neighbour, where a school's fish are about one.)
    const spread = Math.max(animal.length, 0.3) * (1 + 0.35 * Math.sqrt(group.rank)) * (aquatic(group.profile) ? 0.6 : 1);
    // (On the ground, a place by its leader it can stand at the slot's end: else it slid to the nearest open cell over
    // the slot's last seconds, sideways or backwards, the default view's sparrow. A few seeded tries, then that.)
    // (On its own bearing from its leader, as a herd member's own side (`memberSide`), each slot a little off it, wider
    // a try at a time: a school's members at random bearings stood in an even row now and then, like the herds.)
    const bearing = group.rank * 2.399963 + ((hashString(`${animal.id}#side`) % 1000) / 1000 - 0.5) * 0.5;
    for (let attempt = 0; attempt < 6; attempt++) {
        const a = bearing + (random() - 0.5) * (0.7 + attempt * 0.6);
        const d = (0.8 + random() * 2.2) * spread;
        dx = Math.cos(a) * d;
        dz = Math.sin(a) * d;
        if (at.aloft || at.y < surfaceY(world, at.x, at.z) || world.nav.walkable(at.x + dx, at.z + dz)) break;
    }
    const fx = at.x + dx;
    const fz = at.z + dz;
    let finish: Spot;
    if (at.aloft) finish = {x: fx, y: at.y + dy, z: fz, nx: 0, ny: 1, nz: 0, point: null};
    else if (at.y < surfaceY(world, at.x, at.z) || wet(world, {x: fx, z: fz})) {
        const top = surfaceY(world, fx, fz);
        finish = {x: fx, y: Math.min(Math.max(at.y + dy, world.sampler.heightAt(fx, fz) + 0.2), at.y >= surfaceY(world, at.x, at.z) - 0.01 ? top : top - 0.15), z: fz, nx: 0, ny: 1, nz: 0, point: null};
    }
    else {
        const landed = world.nav.nearest(fx, fz, "walk", 0.5, 4) ?? {x: fx, z: fz};
        finish = groundSpot(world, landed.x, landed.z);
    }
    // (Lane B5: its leader down at its station, it comes down at its own place by it, a twig of the same tree, its own
    // side of the patch: not on the ground under its leader's perch, nor hanging in the air beside it.)
    const rule = wayRule(group.profile);
    if (rule && !at.aloft) {
        const bout = boutAt(rule, group.leader, trips[trips.length - 1].slot);
        const lead = stationOf(world, group.profile, group.leader, rule, bout);
        if (Math.hypot(at.x - lead.x, at.z - lead.z) < Math.max(3, animal.length * 16)) finish = stationOf(world, group.profile, animal, rule, bout);
    }
    return {trips, dx, dy, dz, finish};
}

/**
 * Its time at its destination, placed in the world: the beats from where it arrives, turned to a seeded heading
 * (so where it ends never depends on the way it came), and where it is when they are done.
 */
function settle(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, slot: number, now: Intent, activity: ArkBehaviourProfile["activity"] | null | undefined, hoursAt: HoursAt): {beats: StayBeat[]; finish: Spot} | null {
    if (!now.to) return null;
    // It arrives facing the way it came: from its last goal to this one (within about 10 degrees, seeded), so it doesn't
    // turn round on arriving. (Its last goal, not where its last slot ended, which would chain back through every slot;
    // with no goal in the last six slots, roughly its way out from home. Where its route came in some other way, a
    // landing after a wide soar say, it keeps the way it came in and turns to this at TURN_RATE: poseOnTrip.)
    return placeStay(world, profile, animal, now.to, arrivalYaw(animal, slot, now, lastGoal(world, profile, animal, activity, slot, hoursAt)), now.stay, Infinity);
}

/** The heading it settles to at a goal: from the goal before (within about 10 degrees, seeded), else from home. */
function arrivalYaw(animal: ScheduleAnimal, slot: number, now: Intent, before: Spot | null): number {
    const to = now.to!;
    // (Still where its last goal was, asleep at its roost slot after slot: the same heading as long as it stays, seeded by
    // the place, not the slot. 2026-11-12: a sleeping zebra turned to a new heading every slot, and its foal at heel,
    // whose place turns with hers, swung round her and slid backwards.)
    const still = before !== null && Math.hypot(to.x - before.x, to.z - before.z) <= 0.5;
    const roll = rng(hashString(still ? `${animal.id}#yaw#at#${Math.round(to.x * 2)},${Math.round(to.z * 2)}` : `${animal.id}#yaw#${slot}`))();
    const from = before && !still ? before : animal.home;
    const away = Math.hypot(to.x - from.x, to.z - from.z);
    return now.face ?? (away > 0.5 ? Math.atan2(to.x - from.x, to.z - from.z) + (roll - 0.5) * (from === before ? 0.3 : 1.2) : roll * Math.PI * 2);
}

/** Where its last slots were going (the nearest of the four before with a goal), or null. Pure in (id, slot). */
function lastGoal(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Spot | null {
    for (let back = 1; back <= LOOK_BACK; back++) {
        const earlier = intent(world, profile, animal, activity, slot - back, hoursAt);
        if (earlier.follow) return null;
        if (earlier.to) return earlier.to;
    }
    return null;
}

/** Where a slot ends, worked out the same way by every caller (from its intent alone: never from the route there). */
function finishOf(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt, depth = 0): Spot {
    const i = intent(world, profile, animal, activity, slot, hoursAt);
    if (i.follow && animal.group) return shadowOf(world, animal, slot, hoursAt).finish;
    const settled = settle(world, profile, animal, slot, i, activity, hoursAt);
    if (settled) return settled.finish;
    if (depth < 6) return finishOf(world, profile, animal, activity, slot - 1, hoursAt, depth + 1);
    return groundSpot(world, animal.home.x, animal.home.z);
}

/** The trip an animal is on at a world time (pure: the same for every viewer). */
export function tripAt(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number, hoursAt: HoursAt, activity?: ArkBehaviourProfile["activity"] | null, previous?: Trip | null): Trip {
    const slot = slotOf(animal, epochSeconds);
    return remember(memoOf(world, hoursAt, animal).trips, slot, () => {
        const now = intent(world, profile, animal, activity, slot, hoursAt);
        return tripFor(world, profile, animal, activity, slot, hoursAt, now, previous && previous.slot === slot - 1 ? previous.finish : null);
    });
}

/**
 * What it sets out to do in the slot at a world time: the slot's goal (its doing and recipe, as its trip will have
 * them), not the route there, so it costs no path. The tap card's "Now" and "Next", its own log and the live log's
 * moments read this (`animal-status.ts`). Pure, the same for every viewer; remembered with the trips.
 */
export type SlotPlan = {
    slot: number;
    start: number;
    end: number;
    doing: ArkDoing;
    recipe: string | null;
    mode: TripMode;
    follow: boolean;
    /** Watching a predator it saw (the shared wariness). */
    wary: boolean;
    /**
     * Its stay's steps cannot move it where it goes (in the water, or up off the ground: `stepsMove`), so it holds still
     * there: a stalk there is a wait (an eel or a pike lying in wait), not a creep.
     */
    still: boolean;
};
export function slotPlanAt(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number, hoursAt: HoursAt, activity?: ArkBehaviourProfile["activity"] | null): SlotPlan {
    const slot = slotOf(animal, epochSeconds);
    const plan = placedIntent(world, profile, animal, activity, slot, hoursAt);
    const start = slotStart(animal, slot);
    return {slot, start, end: start + SLOT_SECONDS, doing: plan.doing, recipe: plan.recipe ?? null, mode: plan.mode, follow: Boolean(plan.follow), wary: plan.doing === "watch" && plan.face !== undefined, still: plan.to ? !stepsMove(world, plan.to) || !plan.stay.some((beat) => beat.dx || beat.dz) : true};
}

// MARK: Memo

/**
 * Intents and trips, remembered per world, clock and animal for the last few dozen slots: a group's members, its
 * leader's flock and a predator's spacing all ask for the same leader's slot many times. Pure results, so this
 * changes nothing but the time taken. `forgetSchedules` after an animal's home, group or range changes.
 */
type Memo = {intents: Map<number, Intent>; raw: Map<number, Intent>; placed: Map<number, Intent>; chains: Map<number, Array<Spot | null>>; trips: Map<number, Trip>};
let memos = new WeakMap<ScheduleWorld, WeakMap<HoursAt, WeakMap<ScheduleAnimal, Memo>>>();
function memoOf(world: ScheduleWorld, hoursAt: HoursAt, animal: ScheduleAnimal): Memo {
    let byClock = memos.get(world);
    if (!byClock) memos.set(world, (byClock = new WeakMap()));
    let byAnimal = byClock.get(hoursAt);
    if (!byAnimal) byClock.set(hoursAt, (byAnimal = new WeakMap()));
    let memo = byAnimal.get(animal);
    if (!memo) byAnimal.set(animal, (memo = {intents: new Map(), raw: new Map(), placed: new Map(), chains: new Map(), trips: new Map()}));
    return memo;
}
function remember<T>(map: Map<number, T>, slot: number, make: () => T): T {
    const hit = map.get(slot);
    if (hit !== undefined) return hit;
    const value = make();
    map.set(slot, value);
    if (map.size > 32) {
        // Drop the slots furthest from this one.
        const far = Array.from(map.keys()).sort((a, b) => Math.abs(b - slot) - Math.abs(a - slot)).slice(0, map.size - 24);
        for (const key of far) map.delete(key);
    }
    return value;
}
/** How many times the schedules have been forgotten (`forgetSchedules`): a cache of plans made before a change is stale. */
let generation = 0;
export function scheduleGeneration(): number {
    return generation;
}
export function forgetSchedules() {
    generation++;
    memos = new WeakMap();
    roosts = new WeakMap();
    forgetRecipes();
}

function tripFor(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt, now: Intent, knownFrom: Spot | null): Trip {
    const start = slotStart(animal, slot);
    const end = start + SLOT_SECONDS;
    const from = knownFrom ?? finishOf(world, profile, animal, activity, slot - 1, hoursAt);
    const random = rng(hashString(`${animal.id}#route#${slot}`));
    // (Lane B5: its way of life's height where it sets one: a sandpiper low along the shore, a swallow low over the grass.)
    const cruise = profile.altitude ? wayHeight(profile) ?? CRUISE[profile.altitude] : 0;
    const base = {slot, doing: now.doing, start, end, from, cruise, shadow: null as Trip["shadow"], recipe: now.recipe ?? null, owner: {animal, profile, slug: profile.slug, activity, hoursAt} as TripOwner};
    // (Lane B5: a soar's slots, up into it, round its thermals and down out of it, are flown as its track has them.)
    if (now.aloft || (wayRule(profile)?.aloft && intent(world, profile, animal, activity, slot - 1, hoursAt).aloft)) {
        const soared = soarTrip(world, profile, animal, activity, slot, hoursAt, now, from, base);
        if (soared) return soared;
    }

    // A flock member with its leader in the air: catch up, then fly at its side (its own place in the flock, new each slot).
    if (now.follow && animal.group) {
        const shadow = shadowOf(world, animal, slot, hoursAt);
        const finish = shadow.finish;
        const pace = bodyLengthsPerSecond(profile) * Math.max(animal.length, 0.05);
        const leaderAt = (t: number) => basePoseOnTrip(world, shadow.trips.find((trip) => t >= trip.start && t < trip.end) ?? shadow.trips[shadow.trips.length - 1], t);
        // (MA1) A flock takes off together: when its leader's flight is still to come in the slot, it waits where it is
        // and goes up with its leader, the leader's own run, climb and speed, easing from where it stood into its place
        // by its leader (`lead0`). Its leader already up, it flies up to its place at its own paces.
        let off: number | null = null;
        if (now.mode !== "water") {
            for (const trip of shadow.trips) {
                let at = trip.start;
                for (const leg of trip.legs) {
                    // (Lane B5: its leader's first flight that goes somewhere: a hop to the next twig is its leader's own.)
                    if (leg.mode === "air" && at + leg.seconds > start && (!wayRule(profile) || leg.length > Math.max(6, animal.length * 20))) {
                        off = at;
                        break;
                    }
                    at += leg.seconds;
                }
                if (off !== null) break;
            }
        }
        if (off !== null && off >= start && off < end - 3) {
            const wait = off - start;
            const lead = leaderAt(off);
            const legs: Leg[] = [];
            if (wait > 0.05) legs.push({mode: "pause", from, to: from, path: null, length: 0, seconds: wait, beat: "pause", yaw: from.yaw ?? lead.yaw});
            legs.push({mode: "shadow", from, to: finish, path: null, length: 0, seconds: SLOT_SECONDS - wait, beat: "fly", pace, lead0: {x: from.x - lead.x, y: from.y - lead.y, z: from.z - lead.z}});
            return {...base, mode: "air", arrive: end, to: finish, finish, path: null, legs, stay: [], length: 0, running: false, shadow: {trips: shadow.trips, dx: shadow.dx, dy: shadow.dy, dz: shadow.dz}};
        }
        let catchUp = 6;
        const joinAt = (t: number): Spot => {
            const joined = shadowPoint(world, leaderAt(start + t), shadow, start + t, 0);
            return {x: joined.x, y: joined.y, z: joined.z, nx: 0, ny: 1, nz: 0, point: null};
        };
        let join = joinAt(catchUp);
        const paces = airPaces(profile, animal.length);
        if (now.mode !== "water") {
            // (MA1: its leader already up, it meets it where its leader will be once it is at speed itself: the first
            // moment, every half second from 2 s to 16 s, it can get there at its take-off's acceleration averaging at
            // least 0.6 of its cruise; else as soon as its acceleration lets it.)
            let found = false;
            for (let t = 2; t <= 16 && !found; t += 0.5) {
                const at = joinAt(t);
                const d = Math.hypot(at.x - from.x, at.z - from.z);
                if (d / t >= 0.6 * paces.cruise && t >= Math.sqrt((2 * d) / paces.accel)) {
                    catchUp = t;
                    join = at;
                    found = true;
                }
            }
            if (!found) {
                catchUp = Math.min(Math.max(Math.sqrt((2 * Math.hypot(join.x - from.x, join.z - from.z)) / paces.accel), 1.5), 16);
                join = joinAt(catchUp);
            }
        }
        const flat = Math.hypot(join.x - from.x, join.z - from.z);
        // (MA1: its leader not up in the air where it joins it (down already, or not off yet): it walks or swims there.)
        const afoot = now.mode !== "water" && !leaderAt(start + catchUp).aloft;
        const joinWet = wet(world, join);
        const legs: Leg[] = [
            now.mode === "water" || (afoot && joinWet && wet(world, from))
                ? {mode: "water", from, to: join, path: [from, join], length: flat, seconds: catchUp, beat: "swim"}
                : afoot
                  ? {mode: "ground", from, to: join, path: [from, join], length: flat, seconds: Math.max(catchUp, flat / Math.max(pace, 0.05)), beat: "walk"}
                  : {mode: "air", from, to: join, path: [from, join], length: flat, seconds: catchUp, beat: "fly", cruise: Math.max(cruise * 0.5, 1), plan: catchUpPlan(paces, flat, catchUp, Math.max(cruise * 0.5, 1))},
        ];
        legs[0].seconds = Math.min(legs[0].seconds, SLOT_SECONDS - 4);
        legs.push({mode: "shadow", from: join, to: finish, path: null, length: 0, seconds: SLOT_SECONDS - legs[0].seconds, beat: "fly", pace});
        return {...base, mode: now.mode === "water" ? "water" : "air", arrive: end, to: finish, finish, path: null, legs, stay: [], length: 0, running: false, shadow: {trips: shadow.trips, dx: shadow.dx, dy: shadow.dy, dz: shadow.dz}};
    }

    const to = now.to ?? from;
    let mode = now.mode;
    if (!now.to || (Math.hypot(to.x - from.x, to.z - from.z) < 0.05 && Math.abs(to.y - from.y) < 0.05)) mode = "stay";
    // Up off the ground at either end (a branch, a wall, a rock top): a flyer flies it, anything else climbs it.
    if ((mode === "ground" || mode === "water") && (raised(world, from) || raised(world, to))) mode = flies(profile) ? "air" : "surface";
    const pace = bodyLengthsPerSecond(profile) * Math.max(animal.length, 0.05);
    // A bird walks a few steps; further than that it flies, once the flight is worth it (MA1: a way so short its flight
    // would average under about 0.4 of its cruise, `WALK_SHARE` of what its take-off and landing lose at half a g, is
    // walked, waded or swum when it gets there that way in under WALK_INSTEAD s). A flyer's own way to a spot nearby
    // is walked or swum the same, one for its own sake too (not a soar, nor up to or down from a raised spot): a goose
    // "flew" 1 m hops across its pond, a heron 5 m hops along its shallows at a fifth of its cruise.
    const wetFrom = wet(world, from);
    const wetTo = wet(world, to);
    const shallow = (p: Spot) => !wet(world, p) || surfaceY(world, p.x, p.z) - world.sampler.heightAt(p.x, p.z) < Math.max(animal.length, 0.05) * 0.5;
    const swimsThere = swims(profile) && (wetFrom || wetTo) && (amphibious(profile) || (wetFrom && wetTo));
    const wadesThere = walks(profile) && shallow(from) && shallow(to);
    // (MA1 follow-up, decision 285: a light bird that flies first, under a kilo (it speeds up at more than half a g,
    // `flightAccelOf`), a sparrow, a fruit dove, a parrot, hop-flies its short ways as before: a few steps walked
    // (`HOP_LENGTHS` of its lengths, a metre at least) and anything further flown, below its cruise if need be, never
    // walking a way it meant to fly: walking them cost those species most of their time in the air. A flying insect
    // keeps to its plants on the wing. A heavy one, a heron, a pelican, an eagle, walks its short ways as a bird that
    // walks or swims first does: at half a g its 6 to 40 m flights averaged a fifth to a third of its cruise.)
    const insectFlyer = flies(profile) && airPaces(profile, animal.length).kind === "insect";
    const firstFlyer = flies(profile) && (insectFlyer || (profile.move === "fly" && airPaces(profile, animal.length).accel > FLIGHT_ACCEL_MAX));
    // (A round is flown: it is all flight, `roundRoute`.)
    const round = Boolean(now.round && mode === "air");
    if (flies(profile) && (mode === "ground" || (!insectFlyer && !round && mode === "air" && now.doing !== "soar" && !raised(world, from) && !raised(world, to) && (swimsThere || wadesThere)))) {
        const flatWay = Math.hypot(to.x - from.x, to.z - from.z);
        const paces = airPaces(profile, animal.length);
        const swimming = wetFrom && wetTo && swimsThere && !(wadesThere && !swims(profile));
        // (Swimming at its own swimming pace, `swimSpeedOf`, lane MA3 water 2: at its walk clip's, a coot's 0.15 m/s,
        // anything over 3 m was flown, a teal hopping 6 m across its stream.)
        const own = swimming ? swimSpeedOf(profile, animal.length) : pace;
        // (Lane B5: one that keeps a station, down on the ground or in the shallows, a sandpiper, a heron, a sparrow
        // feeding, walks its patch, AFOOT_MOST m at most, and flies a longer way.)
        const afoot = profile.move === "fly" && wayRule(profile) !== null && !raised(world, from) && !raised(world, to);
        // (Never less than MA1's own: a crane or an ibis still walks a way its flight would crawl over.)
        // (And as long as its walk takes most of a slot, not MA1's 45 s: it has nowhere else to be.)
        const walkSeconds = afoot ? SLOT_SECONDS - 12 : WALK_INSTEAD;
        const worthIt = firstFlyer ? Math.max(1, animal.length * HOP_LENGTHS) : Math.max(3, animal.length * HOP_LENGTHS, Math.min(WALK_SHARE * flightLoss(paces, wetFrom ? paces.runWater : paces.runGround, wetTo ? paces.skiWater : 0), own * walkSeconds));
        const walkMost = afoot ? Math.max(worthIt, Math.min(walkReach(profile, animal), AFOOT_MOST)) : worthIt;
        // A bird walks a few steps; further than that it flies. One that walks or swims first (a pigeon, a peafowl, a coot
        // on the bank) walks wherever its feet take it in the slot, and flies only further, and only as often as it flies
        // (lane MA3: the audit's peafowl took off 34 times an hour). A ground way becomes a flight only when both MA1's
        // rule (worth the flight) and MA3's (beyond its walk reach, a flight allowed this slot) hold.
        const ma3Flies = flatWay > (profile.move === "fly" && !afoot ? Math.max(3, animal.length * 6) : afoot ? walkMost : walkReach(profile, animal)) && airAllowed(profile, animal, slot);
        const meant = mode;
        mode = flatWay > walkMost && (mode !== "ground" || ma3Flies) ? "air" : swimming ? "water" : "ground";
        // (A short way is walked only where its feet get there by about that way, in its time; else it flies it, if it
        // meant to or may fly this slot (MA3's `airAllowed`): a fish eagle's 9 m and 14 m across an inlet were 197 m and
        // 177 m walks round it, past a mallard's water.)
        // (Lane B5: not one wading its own shallows, whose way through the water is not on the walk grid: a pelican and
        // a kite standing in the shallows hop-flew every few metres of it.)
        if (mode === "ground" && flatWay > 3 && (meant === "air" || airAllowed(profile, animal, slot)) && !(afoot && wadesThere && (wetFrom || wetTo))) {
            const onFoot = world.nav.path(from, to, "walk", 0.5, 900, maxSlopeOf(animal), bodyRadiusOf(animal, profile.slug), onSurface(to.point));
            const end = onFoot[onFoot.length - 1];
            const way = pathLength(onFoot);
            if (!end || Math.hypot(end.x - to.x, end.z - to.z) > 0.5 || way > Math.max(flatWay * 1.6, 3) || way > own * walkSeconds) mode = "air";
        }
    }

    // (0.85-1.2 of its walk's own pace: its clip plays at 0.85-1.2 its rate.)
    const speed = pace * (0.85 + 0.35 * random());
    // (Lane B4: on foot, by what the way is for: an amble between mouthfuls or to a place to lie (0.9 of that), a walk
    // about its range (0.95), a purposeful walk to water, to cover, to its roost (all of it). Every way was walked alike.)
    const walkSpeed = speed * (AMBLING.has(now.doing) ? 0.9 : STROLLING.has(now.doing) ? 0.95 : 1);
    // In the air and the water at its own pace (the walk clip's cap is for its feet).
    // (A swimmer over a metre long at true size: counted in √L, not L, or a 14 m humpback cruised at 16 m/s. Motion pass §3.)
    const freeSpeed = freeBodyLengthsPerSecond(profile) * (profile.move === "swim" ? swimPaceLength(animal.length) : Math.max(animal.length, 0.05)) * (speed / pace);
    // (In the water at its own swimming pace, not its walk clip's: `swimSpeedOf`, lane MA3 water 2.)
    const swimSpeed = swimSpeedOf(profile, animal.length) * (speed / pace);
    const legs: Leg[] = [];
    /** A walk's path; one its search gave up on (a long way round) on the same stretch of ground is searched further. */
    // (Its body's width: every run of its paths keeps clear of everything solid for it: collisions.)
    const bodyR = bodyRadiusOf(animal, profile.slug);
    const walkPath = (a: Spot, b: Spot, nodes: number): NavPoint[] => {
        const slope = maxSlopeOf(animal);
        const onto = onSurface(b.point);
        const path = world.nav.path(a, b, "walk", 0.5, nodes, slope, bodyR, onto);
        const end = path[path.length - 1];
        if (Math.hypot(end.x - b.x, end.z - b.z) < 0.01) return path;
        const region = world.nav.region(a.x, a.z, slope, bodyR);
        return region >= 0 && region === world.nav.region(b.x, b.z, slope, bodyR) ? world.nav.path(a, b, "walk", 0.5, 12000, slope, bodyR, onto) : path;
    };
    // (Lane B4: a walked way as an animal walks it, `naturalWay`: its corners rounded on about its turning radius, a
    // long straight run bowed a little to one side, seeded by the slot; each curve kept only where it is clear for its
    // body. The grid's ways were straight runs with sharp corners, four in five of them one ruler line.)
    const wayRandom = rng(hashString(`${animal.id}#way#${slot}`));
    const shaped = (path: NavPoint[]): NavPoint[] => {
        const side = wayRandom();
        const bow = (side < 0.5 ? -1 : 1) * (0.4 + 0.6 * wayRandom());
        const L = Math.max(animal.length, 0.05);
        return naturalWay(world.nav, path, {radius: bodyR, maxSlope: maxSlopeOf(animal), turn: Math.min(Math.max(1.2 * L, 0.25), 4), bow, bowFrom: Math.max(4 * L, 2.5)});
    };
    const ground = (a: Spot, b: Spot, beat: ArkBeat = "walk") => {
        let path = walkPath(a, b, 900);
        const last = path[path.length - 1];
        if (Math.hypot(last.x - b.x, last.z - b.z) > 0.01) path.push({x: b.x, z: b.z});
        else path = shaped(path);
        // A varied route: now and then a pause on the way.
        const length = Math.max(pathLength(path), Math.abs(b.y - a.y));
        if (length > 3 && random() < 0.3 && path.length >= 2) {
            const mid = alongPath(path, 0.4 + random() * 0.2);
            const midSpot = groundSpot(world, mid.x, mid.z);
            let firstPath = walkPath(a, midSpot, 400);
            // Each half ends where it is going even when the grid can't reach it (from the water, say): it used to stop
            // short and take no time at all, and the animal jumped to the pause.
            if (Math.hypot(firstPath[firstPath.length - 1].x - midSpot.x, firstPath[firstPath.length - 1].z - midSpot.z) > 0.01) firstPath.push({x: midSpot.x, z: midSpot.z});
            else firstPath = shaped(firstPath);
            let secondPath = walkPath(midSpot, b, 400);
            if (Math.hypot(secondPath[secondPath.length - 1].x - b.x, secondPath[secondPath.length - 1].z - b.z) > 0.01) secondPath.push({x: b.x, z: b.z});
            else secondPath = shaped(secondPath);
            const l1 = pathLength(firstPath);
            const l2 = Math.max(pathLength(secondPath), 0.01);
            legs.push({mode: "ground", from: a, to: midSpot, path: firstPath, length: l1, seconds: l1 / walkSpeed, beat});
            legs.push({mode: "pause", from: midSpot, to: midSpot, path: null, length: 0, seconds: 2 + random() * 4, beat: random() < 0.6 ? "scan" : "pause", yaw: alongPath(firstPath, 1).yaw});
            legs.push({mode: "ground", from: midSpot, to: b, path: secondPath, length: l2, seconds: l2 / walkSpeed, beat});
        } else legs.push({mode: "ground", from: a, to: b, path, length, seconds: length / walkSpeed, beat});
    };
    const water = (a: Spot, b: Spot) => {
        const path = world.nav.path(a, b, "swim", 0.3, 900, MAX_SLOPE, bodyR);
        const last = path[path.length - 1];
        // (Two waters no water joins, for one that walks too: it walks between them, round the fences, never swims over land.)
        if (Math.hypot(last.x - b.x, last.z - b.z) > 0.01 && world.nav.colliders && (amphibious(profile) || (walks(profile) && !aquatic(profile)))) {
            ground(a, b, "walk");
            return;
        }
        if (Math.hypot(last.x - b.x, last.z - b.z) > 0.01) path.push({x: b.x, z: b.z});
        const length = pathLength(path) + Math.abs(b.y - a.y);
        legs.push({mode: "water", from: a, to: b, path, length, seconds: length / swimSpeed, beat: "swim"});
    };
    /** The water's edge to cross at: the drinking and shore points nearest a spot. */
    const edgeNear = (p: Spot): Spot | null => waterEdgeNear(world, profile, animal, p);
    let after: ArkBeat | null = null;
    switch (mode) {
        case "ground":
        case "water": {
            const fromWet = wet(world, from);
            const toWet = wet(world, to);
            if (amphibious(profile) && fromWet !== toWet) {
                // Into the water at an edge, or out of it at one: walk to the edge, slide in (or swim to it, climb out).
                const edge = edgeNear(toWet ? from : to) ?? edgeNear(toWet ? to : from);
                if (edge) {
                    const out = {x: edge.x + Math.sin(edgeYaw(world, edge)) * Math.max(animal.length, 0.6), z: edge.z + Math.cos(edgeYaw(world, edge)) * Math.max(animal.length, 0.6)};
                    const offshore = waterSpot(world, profile, animal, out.x, out.z, () => 0.3);
                    // (A slide in or a climb out is a few body lengths, never a straight run over land to water deep enough
                    // somewhere else: 2026-11-12, a true-size crocodile "slid in" 45 m across a garden's pickets to the
                    // nearest water deep enough for it. Then it walks and swims its way instead, below.)
                    const slideReach = Math.max(4, animal.length * 3);
                    if (Math.hypot(offshore.x - edge.x, offshore.z - edge.z) > slideReach) {
                        if (toWet) {
                            ground(from, edge);
                            water(edge, to);
                        } else {
                            water(from, edge);
                            ground(edge, to);
                        }
                        break;
                    }
                    if (toWet) {
                        ground(from, edge);
                        const slide = Math.hypot(offshore.x - edge.x, offshore.z - edge.z);
                        legs.push({mode: "enter", from: edge, to: offshore, path: [edge, offshore], length: slide, seconds: Math.min(Math.max(2.2, slide / pace), SLIDE_MOST), beat: "enter_water"});
                        water(offshore, to);
                    } else {
                        water(from, offshore);
                        const climb = Math.hypot(offshore.x - edge.x, offshore.z - edge.z);
                        legs.push({mode: "exit", from: offshore, to: edge, path: [offshore, edge], length: climb, seconds: Math.min(Math.max(2.4, climb / pace), SLIDE_MOST), beat: "exit_water"});
                        ground(edge, to);
                        after = "shake";
                    }
                    break;
                }
            }
            // Over land it walks, in the water it swims: one that does both (a seal, a penguin) goes by the ground under it.
            if ((mode === "water" && !amphibious(profile)) || (fromWet && toWet)) water(from, to);
            else ground(from, to);
            break;
        }
        case "air": {
            // (MA1, movement audit problems 1 and 3: at its cruise for its size (L2), not four times a walk clip's pace;
            // up to it at its take-off's acceleration and down from it at its braking, never more than half a g; off
            // the water by a run across it (a coot, a swan), off the ground by a run when heavy (a crane, a goose), else
            // springing straight off; onto the water skiing in on its feet; climbing and gliding in at its angles.)
            const paces = airPaces(profile, animal.length);
            // (A flying insect keeps its own flutter about its plants at its free pace, as before: its range is reckoned
            // from it, and arriving sooner it sat longer where the town's cars wait. MA1 is the birds' and the bats'.)
            const insect = paces.kind === "insect" ? freeSpeed * 4 : undefined;
            const flat = Math.hypot(to.x - from.x, to.z - from.z);
            const fromWater = wet(world, from) && !raised(world, from);
            const run = fromWater ? paces.runWater : raised(world, from) ? 0 : paces.runGround;
            const ski = wet(world, to) && !raised(world, to) ? paces.skiWater : 0;
            const flits = flitLegs(world, profile, animal, paces, from, to, flat, cruise, bodyR, random, Boolean(now.recipe || now.round));
            if (flits) {
                legs.push(...flits);
            } else if (now.round && !insect) {
                legs.push(airLeg(world, paces, from, to, roundRoute(from, to, paces, random), cruise, "fly", {run, ski}, bodyR));
            } else if (now.doing === "soar") {
                // A long, gentle sweep high over its range towards where it is going, bowed out to one side (a raptor
                // riding the air), not loops round seeded points (the audit's "circling", problem 2). A trip that ends
                // where it began runs out along a seeded heading and back.
                // (2026-11-11: it glides at about half its flapping cruise, so a soar over a near goal sweeps out far
                // enough to fill its time aloft; before, every soar crawled along a few metres at under 1 m/s.)
                // (MA1: at its glide, 0.8 of its true cruise, out as far as fills about half the slot.)
                const r = Math.max(homeRadius(profile, animal) * 0.8, 6);
                const glideReach = Math.min(SOAR_REACH, (paces.glide * SLOT_SECONDS * 0.55) / 2.2);
                const route = sweepRoute(from, to, Math.max(flat, r, glideReach), random);
                legs.push(airLeg(world, paces, from, to, route, cruise * 1.2, "glide", {pace: insect ?? paces.glide, run, ski}, bodyR));
            } else {
                // Its own line: bowed a little to one side by a seeded amount (a straight flight to where it is going, not
                // a weaving one: problem 2's turns). (MA1: a twentieth of its length either way at most, 23° of turn in
                // all: at its true speed its flights are short in time, so a bow's turn counted three times over.)
                const side = (random() - 0.5) * 0.1 * flat;
                const mid = {x: (from.x + to.x) / 2 + ((to.z - from.z) / (flat || 1)) * side, z: (from.z + to.z) / 2 - ((to.x - from.x) / (flat || 1)) * side};
                legs.push(airLeg(world, paces, from, to, [from, mid, to], cruise, "fly", {pace: insect, run, ski}, bodyR));
            }
            break;
        }
        case "surface": {
            const climb = (a: Spot, b: Spot) => {
                const length = Math.hypot(b.x - a.x, b.z - a.z) + Math.abs(b.y - a.y);
                legs.push({mode: "surface", from: a, to: b, path: [a, b], length, seconds: length / (speed * 0.6), beat: "climb"});
            };
            // (Collisions: up onto a rock or a tree from the ground it first walks to its foot, round whatever is in the
            // way, and climbs from there; down, the same the other way: never a straight line through a trunk, a fence or
            // the rock itself from wherever it was.)
            const footOf = (p: Spot): Spot | null => climbFoot(world, profile, animal, p);
            const fromUp = raised(world, from);
            const toUp = raised(world, to);
            const footA = fromUp ? footOf(from) : from;
            const footB = toUp ? footOf(to) : to;
            if (world.nav.colliders && !flies(profile) && (fromUp || toUp) && footA && footB) {
                if (fromUp) climb(from, footA);
                if (Math.hypot(footB.x - footA.x, footB.z - footA.z) > 0.05) ground(footA, footB);
                if (toUp) climb(footB, to);
            } else climb(from, to);
            break;
        }
        default:
            break;
    }
    // (Lane B6 water: a swimmer whose way of life is to keep swimming goes there by a patrol through its range that
    // takes its time, most or all of the slot, at its kind's cruise: `waterPatrol`.)
    const patrol = waterPatrol(world, profile, animal, activity, slot, hoursAt, now, from, to, legs);
    if (patrol) {
        legs.length = 0;
        legs.push(patrol);
        mode = "water";
    }
    // (No further than it goes in a second and a bit, nor than a few of its lengths: a slow walker faces the way it is
    // going until it is at a corner, not round it while it still walks the other way.)
    const lookAhead = Math.min(Math.max(Math.min(animal.length * 2.5, speed * 1.2), 0.15), 1.5);
    // A walk, a swim or a flight that sets off well away from the way it faces turns on the spot first, at TURN_RATE
    // (never a spin in 0.8 s while already on its way, and never moving against the way it faces: the release's orca
    // swam backwards as it set off). Under a radian it turns into its way as it goes, never more than that off it.
    const first = legs[0];
    if (first && (first.mode === "ground" || first.mode === "water" || first.mode === "air") && first.path && from.yaw !== undefined && !now.follow) {
        const ahead = alongPath(first.path, Math.min(lookAhead / Math.max(pathLength(first.path), 0.01), 1));
        if (Math.hypot(ahead.x - from.x, ahead.z - from.z) > 0.2) {
            const turn = Math.abs(Math.atan2(Math.sin(Math.atan2(ahead.x - from.x, ahead.z - from.z) - from.yaw), Math.cos(Math.atan2(ahead.x - from.x, ahead.z - from.z) - from.yaw)));
            // (Lane B4: at its own rate for its size, `standTurnRate`, never over TURN_RATE: an elephant stepped round at 90
            // degrees a second.)
            const rate = first.mode === "ground" ? Math.min(standTurnRate(animal.length), TURN_RATE) : TURN_RATE;
            // (A patrol sets off the way it faces, `waterPatrol`: its turn is its path's.)
            if (turn > 1 && !patrol) legs.unshift({mode: "pause", from, to: from, path: null, length: 0, seconds: turn / rate, beat: "pause", yaw: Math.atan2(ahead.x - from.x, ahead.z - from.z), turn: true});
        }
    }
    // How far along its way it looks to face: a sparrow a few of its lengths, not 1.5 m (a path that doubled back
    // within that had it walking backwards to the corner, the default view's sparrow), a big walker 1.5 m.
    for (const leg of legs) if ((leg.mode === "ground" || leg.mode === "water") && leg !== patrol) leg.look = lookAhead;
    // Fitted into the slot: a long way is a run; never more than four fifths of the slot on the way.
    let travel = legs.reduce((sum, leg) => sum + leg.seconds, 0);
    // A long way is a run, at its run's own pace at most (one with no run clip walks it: slowed, never sped up).
    const runs = runFactor(profile);
    // (A way onto a rock or a wall goes on foot first: that part runs too when it is long. Decision 202: a komodo's
    // 40 m round the rocks to its basking ledge walked at twice its pace.)
    const running = (mode === "ground" || mode === "surface") && travel > SLOT_SECONDS * 0.45 && runs > 1.3;
    if (running) for (const leg of legs) if (leg.mode === "ground") {
        leg.seconds /= runs;
        leg.beat = "run";
    }
    // (Lane B4.) Each walk gets going over its first steps and slows into its stop (`startTime`, `stopTime`: a mouse in a
    // quarter of a second, an elephant in most of one; a run takes longer), its time longer by as much, so its pace on
    // the way is still its own: it used to be at full speed from its first frame and stop dead. Where it runs on from or
    // into another moving leg (out of the water, up a trunk) it keeps its pace across the join. A burst mover's walk (a
    // mouse, a small lizard, a sparrow, a plover, a rabbit, a spider: `gaitRhythm`) is bursts with stops between; its
    // pace is already its mean over both.
    {
        const rhythm = gaitRhythm(profile.slug, modelBase(profile.slug)?.plan, animal.length);
        legs.forEach((leg, i) => {
            if (leg.mode !== "ground" || !leg.path || !(leg.seconds > 0)) return;
            const run = leg.beat === "run";
            const joins = (other: Leg | undefined) => Boolean(other && other.mode !== "pause");
            const startS = joins(legs[i - 1]) ? 0 : startTime(animal.length, run);
            const stopS = joins(legs[i + 1]) ? 0 : stopTime(animal.length, run);
            const bursts = !run && rhythm.share < 1 && leg.seconds * rhythm.share >= 1.5 * rhythm.burst;
            leg.shape = {start: startS, stop: stopS, rhythm: bursts ? {share: rhythm.share, burst: rhythm.burst, seed: (hashString(`${animal.id}#rhythm#${slot}#${i}`) % 9973) / 9973} : null};
            if (!bursts) leg.seconds += (startS + stopS) / 2;
        });
    }
    travel = legs.reduce((sum, leg) => sum + leg.seconds, 0);
    // Too long for four fifths of the slot: quicker, but on foot never past its clip's pace cap (PACE_CAP: faster, its
    // feet slide; a clawed frog with no run walked at 1.37 of its walk); past that the way takes more of the slot
    // (its stay beats are fitted into what is left), and only a way longer than all but 6 s of it goes faster still.
    // (A patrol's time is its own: all of the slot for one that never stops.)
    if (travel > SLOT_SECONDS * 0.8 && !patrol) {
        let k = (SLOT_SECONDS * 0.8) / travel;
        const onFoot = legs.some((leg) => leg.mode === "ground");
        // (To 1.2 of its pace at most, a margin under the cap: the walk's own pace already varies 0.85-1.2.)
        if (onFoot) k = Math.max(k, walkSpeed / pace / Math.min(PACE_CAP, 1.2));
        if (travel * k > SLOT_SECONDS - 6) k = (SLOT_SECONDS - 6) / travel;
        for (const leg of legs) leg.seconds *= k;
        travel *= k;
    }
    // A flight sets off at its own moment in its slot (MA1 follow-up, decision 285): after a seeded share of the time the
    // slot has to spare, facing its way, not always at the slot's first second. (At its true speed a small bird's hop is
    // a second or two in the air; every one at the same point of every slot was either always or never on the behaviour
    // audit's 30 s grid: a great tit 2% of its day aloft and never once seen flying.) Not on a recipe's way out: its
    // episode keeps its own time from its arrival (a swallow's hawking on the wing lost what it waited).
    const flight = legs.find((leg) => leg.mode === "air");
    if (mode === "air" && flight && !now.follow && !now.recipe) {
        const spare = SLOT_SECONDS - 10 - travel;
        if (spare > 1) {
            const wait = spare * rng(hashString(`${animal.id}#depart#${slot}`))();
            const turned = legs[0]?.turn ? legs[0] : null;
            const next = flight.path && flight.path.length > 1 ? flight.path[1] : flight.to;
            const yaw = turned?.yaw ?? (Math.hypot(next.x - from.x, next.z - from.z) > 0.05 ? Math.atan2(next.x - from.x, next.z - from.z) : from.yaw ?? 0);
            legs.splice(turned ? 1 : 0, 0, {mode: "pause", from, to: from, path: null, length: 0, seconds: wait, beat: "pause", yaw});
            travel += wait;
        }
    }
    const settled = settle(world, profile, animal, slot, {...now, to}, activity, hoursAt) ?? {beats: [], finish: to};
    // Its beats fitted into the time left (all of them, so it ends where `finishOf` says); a shake first after a swim.
    const left = SLOT_SECONDS - travel;
    // The last beat starts at least 3 s before the slot ends, so a last step is finished by then.
    const room = Math.max(left - (after ? 2.6 : 0) - 3, 0);
    const lastAt = settled.beats.length ? settled.beats[settled.beats.length - 1].at : 0;
    const squeeze = lastAt > room && lastAt > 0 ? room / lastAt : 1;
    let beats = settled.beats.map((b) => ({...b, at: b.at * squeeze + (after ? 2.6 : 0)}));
    const finish = now.to ? settled.finish : from;
    // (With no beats after it, a shake faces the way it settles: 2026-11-12, a penguin out of the sea shook facing north
    // and snapped round at the next slot.)
    if (after) beats = [{at: 0, beat: after, x: to.x, z: to.z, yaw: settled.beats[0]?.yaw ?? finish.yaw ?? 0}, ...beats];
    const stay = {beats, finish};
    const mainLeg = legs.find((leg) => leg.mode === "ground" || leg.mode === "water") ?? null;
    return {
        ...base,
        mode: legs.length ? (mode === "stay" ? "ground" : mode) : "stay",
        wet: wet(world, to) && !raised(world, to),
        arrive: start + travel,
        to,
        finish: stay.finish,
        path: mainLeg ? mainLeg.path : null,
        legs,
        stay: stay.beats,
        length: legs.reduce((sum, leg) => sum + leg.length, 0),
        running
    };
}

/**
 * (Lane B6 water.) A swimmer's patrol for a slot, as one water leg, or null (it swims straight to its goal as before).
 *
 * For a way of life that keeps swimming (`water-life.ts` patrolRule: a tuna, a pilchard, a shark, a dolphin all slot
 * long; most other fish, a sea turtle, a seal at sea for most of a slot; a reef fish and a ray
 * for a short while about a small patch; a jellyfish drifting), in the water at both ends: from where it is to its
 * goal by a round through its range (`water-patrol.ts`), as long as its pace covers in its time. Its pace is its
 * kind's cruise for its size (`locomotion/swim.ts` swimPaces, L2's) times its way of life's share, never the old
 * dash (1.4 of its free pace): a 2 m tuna went 5 m/s for three seconds and then hung for a minute.
 *
 * Before: a few seconds' swim, then the rest of the slot at the spot on a land animal's beats (peck, step, scan): a
 * pilchard swam a third of its waking day, a perch 3%, and every fish slept on the spot.
 *
 * Not a recipe's trip, a follower's (it keeps by its leader, who patrols), a watch on a predator, a breathe trip, nor
 * a way that crosses the shore.
 */
function waterPatrol(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt, now: Intent, from: Spot, to: Spot, legs: Leg[]): Leg | null {
    if (now.follow || now.recipe || now.face !== undefined || now.doing === "breathe" || now.doing === "watch") return null;
    const life = waterLife(profile.slug, profile);
    const rule = patrolRule(life);
    if (!rule || !underSurface(world, from) || !underSurface(world, to)) return null;
    // (Only a plain swim, or a stay: nothing over land, no slide in or climb out.)
    if (legs.some((leg) => leg.mode !== "water")) return null;
    const asleep = now.doing === "sleep" || now.doing === "to_roost";
    const never = rule.share[0] >= 1;
    // (Asleep it is at its roost, as every animal: a never-stop swimmer's slow round asleep was built and withdrawn, its
    // coming-in heading is not exact enough for a round that closes on itself slot after slot. docs: water.md, Left.)
    if (asleep) return null;
    if (!legs.length && !never) return null;
    const random = rng(hashString(`${animal.id}#patrol#${slot}`));
    const share = rule.share[0] + (rule.share[1] - rule.share[0]) * random();
    const seconds = never ? SLOT_SECONDS : SLOT_SECONDS * share;
    const L = Math.max(animal.length, 0.02);
    const style = locoStyle(profile.slug).swim;
    // (One with no swimming style of its own, a seal, a sea turtle, a squid: a swimmer's cruise for its size. Its free
    // pace is held to its walk clip's cadence, and a sea lion swam at 0.1 m/s. A drifter keeps its own slow pace.)
    const cruise = style ? swimPaces(L, style).cruise : life === "drifter" ? swimSpeedOf(profile, L) * 0.7 : swimPaces(L, "subcarangiform").cruise;
    const pace = cruise * rule.pace * (0.9 + 0.2 * random());
    // (A way under four of its lengths is no round: it swims straight there.)
    if (pace * seconds < L * 4) return null;
    const centre = groupCentre(world, animal, slot, hoursAt) ?? animal.home;
    const radius = Math.min(homeRadius(profile, animal) * rule.reach * (animal.group ? 0.5 : 1), rangeCap(profile, animal));
    const need = Math.min(Math.max(L * 0.5, 0.3), 2);
    const settled = settle(world, profile, animal, slot, {...now, to}, activity, hoursAt);
    const path = patrolRoute({
        from,
        to,
        fromYaw: from.yaw ?? null,
        toYaw: never ? settled?.finish.yaw ?? null : null,
        centre,
        radius,
        // (A round comes out a little longer than asked more often than shorter, `patrolRoute`: asked for 0.85 of it.)
        length: pace * seconds * 0.85,
        body: L,
        turn: hashString(`${animal.id}#round`) % 2 ? 1 : -1,
        coarse: !never,
        random,
        wet: (x, z) => world.nav.swimmable(x, z, need)
    });
    if (!path) return null;
    const length = patrolLength(path) + Math.abs(to.y - from.y);
    // (It faces a little way along its round: what it swims in a second or so, a length and a half at most.)
    return {mode: "water", from, to, path, length, seconds, beat: "swim", look: Math.min(Math.max(Math.min(L * 1.5, (length / seconds) * 1.2), 0.15), 1.5)};
}

/**
 * The longest a slide into the water or a climb out takes (s): its clip, not its walk (the walk's capped pace had a
 * harbour seal sliding in for 52 s).
 */
const SLIDE_MOST = 5;

/**
 * How much of what a flyer does by air a bird that walks or swims first does by air (lane MA3): its appetite for flying
 * against a flyer's 0.5, squared (a flight up to a perch is two take-offs, up and down again, and each is a choice to
 * fly), so a pigeon (0.08) one in forty, a hen (0.01) none to speak of. 1 for a flyer, and for one that does not fly.
 */
export function airShare(profile: ArkBehaviourProfile): number {
    if (profile.move === "fly" || !flies(profile)) return 1;
    return Math.min((profile.weights.fly ?? 0) / 0.5, 1) ** 2;
}
/** Whether this slot may take it up by air (a perch, a raised place, a recipe in a tree): its own seeded roll against `airShare`. */
function airAllowed(profile: ArkBehaviourProfile, animal: ScheduleAnimal, slot: number): boolean {
    const share = airShare(profile);
    return share >= 1 || rng(hashString(`${animal.id}#air#${slot}`))() < share;
}

// MARK: Stations and soars (behaviours pass, lane B5 air; docs/ark/behaviour-pass-2026-11/air.md)

/**
 * A flyer's way of life on the schedule (lane B5; `locomotion/flight.ts` FLIGHT_WAYS, from `flight-ways.json`). Before,
 * every bird that flies first chose a new goal every slot and flew to it: a buzzard, a kingfisher, a heron and a parrot
 * all took off 30 to 60 times an awake hour, 2 to 4 s and 10 to 25 m at a time. Now it keeps to a station (a perch with
 * a view, a patch of ground, the shallows) for a bout of slots, and of what the schedule picks for a slot it flies off
 * for only its way's share; the rest it does where it is: sits and looks about, walks its patch, flits to the next twig.
 * A flock keeps one station (its leader's bout, each member its own place by it) and moves on together.
 */
function wayRule(profile: ArkBehaviourProfile): FlightWayRule | null {
    if (profile.move !== "fly") return null;
    const way = flightWay(profile.slug);
    const rule = way ? FLIGHT_WAYS[way] : null;
    return rule && rule.bout > 0 ? rule : null;
}
/** Its way of life's cruising height (m), where it sets one. */
function wayHeight(profile: ArkBehaviourProfile): number | null {
    if (profile.move !== "fly") return null;
    const way = flightWay(profile.slug);
    return way ? FLIGHT_WAYS[way].height ?? null : null;
}
/** (Lane B5 air's seeded share; the needs lane's `unit` above has its own modulus, and each keeps its own.) */
const airUnit = (text: string) => (hashString(text) % 1_000_003) / 1_000_003;

type Bout = {index: number; first: number; slots: number; key: ScheduleAnimal; keySlot: number; seed: number};
/** The bout a slot of its own is in: its group's leader's then (by the leader's slots), or its own. */
function boutAt(rule: FlightWayRule, animal: ScheduleAnimal, slot: number): Bout {
    const key = animal.group?.leader ?? animal;
    const keySlot = key === animal ? slot : slotOf(key, slotStart(animal, slot) + SLOT_SECONDS / 2);
    const seed = airUnit(`${key.id}#bout`);
    return {...stationBout(rule, seed, keySlot), key, keySlot, seed};
}

/** A flyer whose station is the ground or the shallows walks a way up to this long (m), and flies a longer one. */
const AFOOT_MOST = 15;
/** A soar rides this high over its home's ground at the least (m), and this far over whatever is under it (ground, rocks, crowns). */
const SOAR_FLOOR = 18;
const SOAR_CLEAR = 8;
/** The island's wind, which its thermals drift with (m/s): one wind, so a soar never jumps. */
const SOAR_WIND = {x: 0.28, z: 0.21};
/** A soar's height changes no faster than this to keep over what is under it (m/s), looked for this far ahead and behind (s). */
const SOAR_VERTICAL = 3;
const SOAR_WINDOW = 30;

/**
 * A flyer's time on the wing over a run of slots (lane B5): where it is at a world time (`at`: a soar's thermals, an
 * aerial feeder's sweeps; pure, the same for every viewer), the height its lift is counted from (`floor`: a soar's,
 * over its home's ground; none for a hawker, which keeps its lift over whatever is under it), how far it keeps over
 * what is under it, its pace (m/s), and what it shows as.
 */
type Soar = {at: (time: number) => SoarAt; floor: number; clear: number | null; pace: number; doing: ArkDoing; beat: ArkBeat};
/**
 * The time on the wing a slot is in, or null (lane B5): a bout starts, for its way's share of them, with so many slots
 * of it (`aloftSlots`): up from its station in the first, on its track in the next ones, down to its new station in the
 * last. A thermal soarer's only in the warm hours (THERMAL_HOURS); an aerial feeder's whenever it is awake. A flock is
 * up together (its leader's bout; a soar's kettle, a feeding party of swallows: `soarAt`'s and `hawkAt`'s members).
 */
function soaring(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, rule: FlightWayRule, slot: number, hoursAt: HoursAt): Soar | null {
    const aloft = rule.aloft;
    if (!aloft) return null;
    const bout = boutAt(rule, animal, slot);
    const n = aloftSlots(rule, bout.seed, bout);
    if (!n || bout.keySlot - bout.first >= n) return null;
    const t0 = slotStart(bout.key, bout.first);
    const h0 = hoursAt(t0);
    const h1 = hoursAt(t0 + n * SLOT_SECONDS);
    if (!awakeAt(profile, activity, h0) || !awakeAt(profile, activity, h1)) return null;
    if (aloft.kind === "thermal" && (h0 < THERMAL_HOURS[0] || h1 > THERMAL_HOURS[1] || h1 < h0)) return null;
    const key = bout.key;
    const paces = airPaces(profile, animal.length);
    const seed = airUnit(`${key.id}#soar`);
    const member = animal.group ? animal.group.rank : 0;
    const home = {x: key.home.x, z: key.home.z};
    if (aloft.kind === "hawk") {
        // (Low over what is under it: a swallow a metre or two to five over the grass and the water, a swift higher.)
        const low = Math.max((wayHeight(profile) ?? 4) * 0.4, animal.length * 4);
        const spec = {cruise: paces.cruise, reach: Math.min(homeRadius(profile, key), rangeCap(profile, key)), low, high: low * 3};
        const patch = openPatch(world, profile, key);
        return {at: (time) => hawkAt(seed, patch, spec, time, member), floor: -1e6, clear: null, pace: paces.cruise * 0.8, doing: "fly", beat: "fly"};
    }
    const spec = soarSpecOf(paces, aloft.span, rangeCap(profile, key), SOAR_WIND);
    return {at: (time) => soarAt(seed, home, spec, time, member), floor: topAt(world, key.home.x, key.home.z) + SOAR_FLOOR, clear: SOAR_CLEAR, pace: spec.circle, doing: "soar", beat: "glide"};
}
/**
 * Where an aerial feeder's sweeps are centred (lane B5): its home, or the most open of eight spots a sweep's length
 * round it (the least of woods' crowns over the ground under its sweeps there), within its range: a swallow feeds over
 * the grass and the water, not in the trees. Over a wood all round it keeps over the crowns (`soarHeights`). Pure;
 * remembered until the schedules are forgotten.
 */
const patches = new WeakMap<ScheduleAnimal, {generation: number; x: number; z: number}>();
function openPatch(world: ScheduleWorld, profile: ArkBehaviourProfile, key: ScheduleAnimal): {x: number; z: number} {
    const known = patches.get(key);
    if (known && known.generation === generation) return known;
    const crowns = world.sampler.canopyTop;
    let best = {x: key.home.x, z: key.home.z};
    if (crowns) {
        const sweep = Math.min(Math.max(airPaces(profile, key.length).cruise * 3.2, 6), 30);
        const out = Math.min(sweep * 1.5, rangeCap(profile, key));
        const wooded = (x: number, z: number) => {
            let sum = 0;
            for (let k = 0; k < 9; k++) {
                const px = x + (k ? Math.sin((k * Math.PI) / 4) * sweep * 0.7 : 0);
                const pz = z + (k ? Math.cos((k * Math.PI) / 4) * sweep * 0.7 : 0);
                // (Off the island's edge is not a place to feed over either, for a bird of the land.)
                sum += world.sampler.heightAt(px, pz) < surfaceY(world, px, pz) - 0.5 && !swims(profile) ? 10 : Math.max(crowns(px, pz) - topAt(world, px, pz), 0);
            }
            return sum;
        };
        let least = wooded(best.x, best.z);
        for (let k = 0; k < 8 && least > 0; k++) {
            const x = key.home.x + Math.sin((k * Math.PI) / 4) * out;
            const z = key.home.z + Math.cos((k * Math.PI) / 4) * out;
            const w = wooded(x, z);
            if (w < least - 1e-6) {
                least = w;
                best = {x, z};
            }
        }
    }
    const patch = {generation, x: best.x, z: best.z};
    patches.set(key, patch);
    return patch;
}
/** What a soar keeps over at a point: the ground or the water, the drawn rocks' tops, the woods' crowns. */
function soarFloorAt(world: ScheduleWorld, x: number, z: number): number {
    const sampler = world.sampler;
    return Math.max(topAt(world, x, z), sampler.flightFloor ? sampler.flightFloor(x, z) : -Infinity, sampler.canopyTop ? sampler.canopyTop(x, z) : -Infinity);
}
/**
 * Its heights (the scene's y) at each second from a world time on, `seconds` of them and one: its track's own (a soar's
 * floor and its lift in its thermal; a hawker's lift over what is under it), never under its clearance over what is
 * under it, eased so it rises to a ridge or a wood ahead and comes down after one at SOAR_VERTICAL at most. Pure in the
 * time (it looks SOAR_WINDOW s either way), so two slots agree where they meet.
 */
function soarHeights(world: ScheduleWorld, soar: Soar, from: number, seconds: number): Float32Array {
    const all = new Float32Array(seconds + 1 + 2 * SOAR_WINDOW);
    for (let i = 0; i < all.length; i++) {
        const at = soar.at(from - SOAR_WINDOW + i);
        // (What is under it there and through the half second either side, every sixth of a second, about 2 m of its
        // way: the crowns are known on a 2 m grid, and a tall crown's tip between two seconds' places is under it too.)
        let under = soarFloorAt(world, at.x, at.z);
        for (let k = -3; k <= 3; k++) {
            if (!k) continue;
            const near = soar.at(from - SOAR_WINDOW + i + k / 6);
            under = Math.max(under, soarFloorAt(world, near.x, near.z));
        }
        all[i] = Math.max(soar.floor + at.lift, under + (soar.clear ?? at.lift));
    }
    for (let i = 1; i < all.length; i++) all[i] = Math.max(all[i], all[i - 1] - SOAR_VERTICAL);
    for (let i = all.length - 2; i >= 0; i--) all[i] = Math.max(all[i], all[i + 1] - SOAR_VERTICAL);
    return all.subarray(SOAR_WINDOW, SOAR_WINDOW + seconds + 1);
}

/** Its station for a bout (remembered until the schedules are forgotten). */
const stations = new WeakMap<ScheduleAnimal, {generation: number; spots: Map<number, Spot>}>();
function stationOf(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, rule: FlightWayRule, bout: Bout): Spot {
    let own = stations.get(animal);
    if (!own || own.generation !== generation) stations.set(animal, (own = {generation, spots: new Map()}));
    let spot = own.spots.get(bout.index);
    if (!spot) {
        spot = workStation(world, profile, animal, rule, bout);
        if (own.spots.size > 6) own.spots.clear();
        own.spots.set(bout.index, spot);
    }
    return spot;
}
/**
 * A perch for a station: one of the perches within reach that suit its body, taken from a thinned list (no two within
 * STATION_APART m, ten of its lengths or `worth` m of each other, in a fixed order), so two bouts' stations are either the same
 * perch (it stays put) or a real move apart, never a shuffle of a metre along a branch by air. `high`: one of the
 * highest third (a soarer's perch with a view).
 */
const STATION_APART = 4;
export function stationPerch(world: ScheduleWorld, centre: {x: number; z: number}, length: number, tags: AttachTag[], radius: number, roll: number, high: boolean, worth = 0): AttachPoint | null {
    const apart = Math.max(STATION_APART, length * 10, worth);
    for (const tag of tags) {
        const near = world.sampler.attachPoints(tag, {x: centre.x, z: centre.z, r: radius}).filter((p) => perchSuits(p, length));
        if (!near.length) continue;
        const sorted = [...near].sort((a, b) => (high ? b.y - a.y : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        const kept: AttachPoint[] = [];
        for (const p of sorted) {
            if (kept.length >= 24) break;
            if (kept.every((q) => Math.hypot(p.x - q.x, p.z - q.z) >= apart)) kept.push(p);
        }
        const pool = high ? kept.slice(0, Math.max(1, Math.ceil(kept.length / 3))) : kept;
        return pool[Math.min(Math.floor(roll * pool.length), pool.length - 1)];
    }
    return null;
}
function workStation(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, rule: FlightWayRule, bout: Bout): Spot {
    const random = rng(hashString(`${animal.id}#station#${bout.index}`));
    const group = animal.group;
    if (group && bout.key !== animal) {
        // A flock's member: its own place by its leader's station (a twig of the same tree, its own side of the patch).
        const lead = stationOf(world, group.profile, bout.key, rule, boutAt(rule, bout.key, bout.keySlot));
        const spread = Math.max(groupSpread(animal.length, group.size), 2);
        if (raised(world, lead)) {
            const perch = placeNear(world, lead, animal.length, perchTags(profile), Math.max(spread, 4), random());
            if (perch) return spotOf(perch);
        }
        if (wet(world, lead)) return shallowsNear(world, animal, lead, Math.max(spread, 4), bout.index) ?? lead;
        const side = memberSide(lead, animal, group.rank, spread);
        const land = world.nav.nearest(side.x, side.z, "walk", 0.5, 6, maxSlopeOf(animal));
        return land ? groundSpot(world, land.x, land.z) : groundSpot(world, lead.x, lead.z);
    }
    const centre = animal.home;
    const radius = homeRadius(profile, animal);
    const kind = rule.station === "mixed" ? (random() < 0.5 ? "ground" : "perch") : rule.station;
    if (kind === "perch") {
        // (Its stations a flight worth its take-off and landing apart where its range has the room: a hornbill, an
        // albatross or a crane changed perch by a 10 to 20 m flight at a quarter of its cruise.)
        const perch = stationPerch(world, centre, animal.length, perchTags(profile), radius, random(), rule.aloft?.kind === "thermal", Math.min(flightWorth(profile, animal), radius * 0.8));
        if (perch) return spotOf(perch);
    }
    if (kind === "shallows") {
        const shallows = shallowsNear(world, animal, centre, Math.min(Math.max(radius * 1.6, 8), 40), bout.index);
        if (shallows) return shallows;
    }
    return rangeSpot(world, {...profile, move: "walk", seabed: false}, animal, centre, radius, random);
}

/**
 * A slot's goal as its way of life has it (lane B5): the schedule's own pick (`raw`), kept when it sleeps, goes to
 * roost, watches a predator it saw, follows its flock's leader in the air, or flies off on one of its forays; else done
 * at its station. A soar's slots are its soar's. Pure in (id, slot, the hour), as the pick is.
 */
function stationed(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt, raw: Intent): Intent {
    const rule = wayRule(profile);
    if (!rule) return raw;
    if (raw.doing === "sleep" || raw.doing === "to_roost" || raw.doing === "breathe" || raw.doing === "play") return raw;
    if (raw.doing === "watch" && raw.face !== undefined) return raw;
    const start = slotStart(animal, slot);
    // (Asleep by the hour, whatever it does: a flock's night watch stands at its roost, and the next slot sleeps there.)
    if (!awakeAt(profile, activity, hoursAt(start))) return raw;
    const local = rng(hashString(`${animal.id}#station#${slot}`));
    const soar = soaring(world, profile, animal, activity, rule, slot, hoursAt);
    if (soar && soaring(world, profile, animal, activity, rule, slot + 1, hoursAt)) {
        // Up in its soar at the slot's end: where its track is then, heading as it heads.
        const at = soar.at(start + SLOT_SECONDS);
        return {doing: soar.doing, to: {x: at.x, y: soarHeights(world, soar, start + SLOT_SECONDS, 0)[0], z: at.z, nx: 0, ny: 1, nz: 0, point: null}, mode: "air", stay: [], face: at.yaw, aloft: true};
    }
    const station = stationOf(world, profile, animal, rule, boutAt(rule, animal, slot));
    const up = raised(world, station);
    // Its soar's last slot: down to its station.
    if (soar) return {doing: soar.doing === "soar" ? "soar" : "fly", to: station, mode: "air", stay: stayBeats(up ? "perch" : "rest", local, null)};
    if (animal.group && FLOCKING.has(profile.social)) {
        // A flock's member flies with its leader when its leader moves on to its next station or flies off on a foray,
        // in its leader's slot now or the one that starts during its own (it waits and goes up with it: `tripFor`);
        // while its leader keeps to its station (a flit to the next twig, a few steps), it keeps to its own place by it.
        // (Before, it followed any flight its leader was on at its own slot's start: a hop to the next twig as much as a
        // move, and a move only when its leader happened to leave late, about two times in five.)
        const group = animal.group;
        const reach = Math.max(6, animal.length * 20);
        const leadSlot = slotOf(group.leader, start + 1);
        let goes = false;
        for (const k of [leadSlot, leadSlot + 1]) {
            // (Its leader's own trip, which its shadow needs anyway: a flight of it that goes somewhere, out or back,
            // and is on, or sets off, during this slot: else it would leave its place to wait by its leader for a flight
            // that comes after its slot. Not a soar: a kettle's members ride their own circles.)
            const trip = tripAt(world, group.profile, group.leader, slotStart(group.leader, k) + 1, hoursAt, group.activity);
            if (trip.shadow) continue;
            let at = trip.start;
            for (const leg of trip.legs) {
                if (leg.mode === "air" && !leg.plan?.soar && leg.length > reach && at < start + SLOT_SECONDS - 3 && at + leg.seconds > start) goes = true;
                at += leg.seconds;
            }
        }
        if (goes && rng(hashString(`${animal.id}#follows#${slot}`))() < FLOCK_FOLLOWS) return {doing: "fly", to: null, mode: "air", stay: [], follow: true};
    }
    // A recipe that runs from a perch (a flycatcher's sallies) runs from its station's.
    if (raw.recipe && raw.to && up && TEMPLATES[raw.recipe]?.goal === "perch") return {...raw, to: station};
    // Its other recipes (a plunge from a perch by the water, a wade and a spear, a bathe): off for one at its way's share.
    if (raw.recipe && raw.to && rng(hashString(`${animal.id}#recipe-goes#${slot}`))() < rule.recipes) return raw;
    // A foray: off for what the schedule picked, at its way's share (a commuter's higher at the day's two ends).
    const hours = hoursAt(start);
    const ends = Math.min(Math.exp(-(((hours - 6.5) / 1.5) ** 2)) + Math.exp(-(((hours - 18) / 1.5) ** 2)), 1);
    const share = rule.foray + ((rule.forayEnds ?? rule.foray) - rule.foray) * ends;
    if (raw.to && !raw.recipe && local() < share) return raw;
    // (One whose station is in the shallows, back from a recipe at the water's edge, stands a slot where that left it,
    // and wades back the next: its way back through the water is the walk grid's, by the bank, and setting off on it
    // straight out of its recipe turned it on the move.)
    if (!up && wet(world, station)) {
        const before = workRawIntent(world, profile, animal, activity, slot - 1, hoursAt);
        if (before.recipe && before.to && rng(hashString(`${animal.id}#recipe-goes#${slot - 1}`))() < rule.recipes && awakeAt(profile, activity, hoursAt(start - SLOT_SECONDS))) {
            const rests: ArkDoing = STAY_DOINGS.has(raw.doing) ? raw.doing : "watch";
            return {doing: rests, to: null, mode: "stay", stay: stayBeats(rests, local, null)};
        }
    }
    // At its station: on its perch, or a twig of it; about its patch of ground; in its shallows.
    let to = station;
    // (Its bout's first slot is its move to its new station: by air when that is further than its feet take it, so its
    // flock sees a flight to follow; else on foot or as its trip works out.)
    const bout = boutAt(rule, animal, slot);
    const moves = bout.keySlot === bout.first;
    if (moves) {
        const last = stationOf(world, profile, animal, rule, boutAt(rule, animal, slot - 1));
        if (Math.hypot(last.x - station.x, last.z - station.z) > Math.min(walkReach(profile, animal), AFOOT_MOST) || raised(world, last) || up) {
            const sits: ArkDoing = STAY_DOINGS.has(raw.doing) ? raw.doing : raw.doing === "perch" || raw.doing === "fly" ? (up ? "perch" : "rest") : "watch";
            return {doing: sits, to: station, mode: "air", stay: stayBeats(sits, local, null)};
        }
    }
    const feeding = raw.doing === "forage" || raw.doing === "graze" || raw.doing === "browse";
    // (Resting, preening or on watch it keeps one place for the bout; feeding or restless it moves about its station.)
    const still = STAY_DOINGS.has(raw.doing);
    if (up) {
        // (A bird under a kilo, which springs off at more than half a g: a macaw or a hornbill clambers, it does not
        // hop-fly a few metres at a quarter of its cruise.)
        if (!still && rule.flit > 0 && local() < rule.flit && airPaces(profile, animal.length).accel > FLIGHT_ACCEL_MAX) {
            const twig = placeNear(world, station, animal.length, perchTags(profile), Math.max(3, animal.length * 25), 0.25 + 0.75 * local());
            if (twig) to = spotOf(twig);
        }
    } else if (wet(world, station)) {
        // (In the shallows it stands where it is: its wading is its recipe's, `wade_spear`, which steps it slowly on. A
        // few metres' wade of its own went by the walk grid's way round the water's edge and turned it on the move.)
    } else if (rule.station !== "perch") {
        // (A patch four of its lengths across its radius, 1 to 6 m: every way in it is a walk, never a flight.)
        const pick = feeding ? local : rng(hashString(`${animal.id}#lies#${bout.index}`));
        const r = Math.min(Math.max(animal.length * 4, 1), 6);
        const a = pick() * Math.PI * 2;
        const d = r * Math.sqrt(pick());
        const land = world.nav.nearest(station.x + Math.cos(a) * d, station.z + Math.sin(a) * d, "walk", 0.5, 4, maxSlopeOf(animal));
        if (land) to = groundSpot(world, land.x, land.z);
    }
    const toUp = raised(world, to);
    // (What it does there: its own rest or watch; feeding, as it feeds there (from a perch or standing in the water it
    // watches for it, on the ground it pecks about); anything it would have flown for, it sits out.)
    // (Its own states kept apart, so a flock at its station is not all one thing: a flight it does not take it spends
    // looking about, a wander or a drink preening; a perch on the ground is a rest. The behaviour audit's "a whole
    // group does the same" was 16.4% with everything else a perch or a rest, 16.1% with those all a watch.)
    const doing: ArkDoing = still || feeding || raw.doing === "bask" || raw.doing === "hide" ? raw.doing : raw.doing === "perch" ? (toUp ? "perch" : "rest") : raw.doing === "fly" || raw.doing === "soar" ? "watch" : "groom";
    const beats: ArkDoing = feeding ? (toUp || wet(world, to) ? "watch" : raw.doing) : doing;
    return {doing, to, mode: toUp || up ? "air" : "ground", stay: stayBeats(beats, local, null)};
}

/**
 * A flitting bird's way to a twig nearby (lane B5): not one hop a slot but two or three, twig to twig about where it
 * is going, with a look round or a peck on each (a tit or a warbler moves every few seconds; one hop every 80 s read
 * as a bird that sat). Only for a way of life that flits every slot, from a perch to a perch within FLIT_REACH; each
 * hop straight (a hop does not bow). Null: its own flight as before.
 */
const FLIT_REACH = 8;
function flitLegs(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, paces: AirPaces, from: Spot, to: Spot, flat: number, cruise: number, bodyR: number, random: () => number, plain: boolean): Leg[] | null {
    const rule = wayRule(profile);
    if (plain || !rule || rule.flit < 1 || flat > FLIT_REACH || flat < 0.3 || !raised(world, from) || !raised(world, to)) return null;
    const stops: Spot[] = [];
    const hops = 1 + Math.floor(random() * 3);
    for (let k = 1; k < hops; k++) {
        const twig = placeNear(world, to, animal.length, perchTags(profile), Math.max(3, animal.length * 25), random());
        if (!twig) break;
        const spot = spotOf(twig);
        const before = stops[stops.length - 1] ?? from;
        if (Math.hypot(spot.x - before.x, spot.z - before.z) < 0.3 || Math.hypot(spot.x - to.x, spot.z - to.z) < 0.3 || !perchFits(world, profile, animal, spot)) continue;
        stops.push(spot);
    }
    if (!stops.length) return null;
    const legs: Leg[] = [];
    let at = from;
    const all = [...stops, to];
    for (let k = 0; k < all.length; k++) {
        const next = all[k];
        legs.push(airLeg(world, paces, at, next, [at, next], cruise, "fly", {run: 0, ski: 0}, bodyR));
        if (k < all.length - 1) {
            // (On the twig it looks about the way it came, then turns, as a small bird does, to the way it goes next.)
            const after = all[k + 1];
            const seconds = 4 + random() * 9;
            legs.push({mode: "pause", from: next, to: next, path: null, length: 0, seconds: seconds * 0.6, beat: random() < 0.5 ? "scan" : "peck", yaw: Math.atan2(next.x - at.x, next.z - at.z)});
            legs.push({mode: "pause", from: next, to: next, path: null, length: 0, seconds: seconds * 0.4, beat: "pause", yaw: Math.atan2(after.x - next.x, after.z - next.z)});
        }
        at = next;
    }
    return legs;
}

/** Heights eased along a route: never rising faster than `up` nor falling faster than `down` (slopes) between samples `step` m apart. */
function easedHeights(values: Float32Array, step: number, up: number, down: number): Float32Array {
    for (let i = 1; i < values.length; i++) values[i] = Math.max(values[i], values[i - 1] - down * step);
    for (let i = values.length - 2; i >= 0; i--) values[i] = Math.max(values[i], values[i + 1] - up * step);
    return values;
}

/**
 * A soar's slot as a trip (lane B5): all of it up in its soar (its track by time, `trackAt`); up into it from its
 * station (a wait and a turn where it sits, then out to where its track will be and on along it, climbing at its
 * climb's angle at most); or down out of it (on along its heading, round, and in to where it lands, over the crowns
 * until its last stretch). Null when there is nowhere to come down to (then the schedule's own trip).
 */
function soarTrip(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt, now: Intent, from: Spot, base: Pick<Trip, "slot" | "doing" | "start" | "end" | "from" | "cruise" | "shadow" | "recipe" | "owner">): Trip | null {
    const {start, end} = base;
    const rule = wayRule(profile);
    const paces = airPaces(profile, animal.length);
    const fromAloft = Boolean(intent(world, profile, animal, activity, slot - 1, hoursAt).aloft);
    const soar = now.aloft && rule ? soaring(world, profile, animal, activity, rule, slot, hoursAt) : null;
    if (!now.to || (now.aloft && !soar)) return null;
    const to = now.to;
    const settled = settle(world, profile, animal, slot, {...now, to}, activity, hoursAt) ?? {beats: [], finish: to};
    const random = rng(hashString(`${animal.id}#soar#${slot}`));
    if (soar && fromAloft) {
        const n = SLOT_SECONDS;
        const heights = soarHeights(world, soar, start, n);
        const track = new Float32Array((n + 1) * 3);
        for (let i = 0; i <= n; i++) {
            const at = soar.at(start + i);
            track[i * 3] = at.x;
            track[i * 3 + 1] = heights[i];
            track[i * 3 + 2] = at.z;
        }
        // (Exactly where its slots meet.)
        track.set([from.x, from.y, from.z], 0);
        track.set([to.x, to.y, to.z], n * 3);
        let length = 0;
        for (let i = 1; i <= n; i++) length += Math.hypot(track[i * 3] - track[i * 3 - 3], track[i * 3 + 2] - track[i * 3 - 1]);
        const leg: Leg = {mode: "air", from, to, path: null, length, seconds: n, beat: soar.beat, plan: {seconds: n, knots: [0, 1, 1, 1], liftoff: 0, touchdown: 1, rise: 1e-4, fall: 1e-4, height: 0, peak: length / n, soar: {from: true, to: true, track}}};
        return {...base, mode: "air", arrive: end, to, finish: settled.finish, path: null, legs: [leg], stay: [], length, running: false};
    }
    if (soar) {
        // Up into it: a wait where it sits, then out to where its track will be and on along it to the slot's end.
        const v = soar.pace;
        const legs: Leg[] = [];
        let wait = 2 + random() * 20;
        let join = start + wait + 6;
        for (let k = 0; k < 3; k++) {
            const at = soar.at(join);
            join = Math.min(Math.max(start + wait + Math.hypot(at.x - from.x, at.z - from.z) / v + v / paces.accel / 2, start + wait + 2), end - 10);
        }
        // (It meets its track where its track heads away from it, within the next quarter minute: it flies out along a
        // tangent of its circle and onto it, never straight at it and round a corner.)
        let aligned = Infinity;
        for (let t = join, k = 0; k <= 16 && t <= end - 10; t += 1, k++) {
            const at = soar.at(t);
            const off = Math.abs(Math.atan2(Math.sin(Math.atan2(at.x - from.x, at.z - from.z) - at.yaw), Math.cos(Math.atan2(at.x - from.x, at.z - from.z) - at.yaw)));
            if (off < aligned - 1e-9) {
                aligned = off;
                join = t;
            }
        }
        const first = soar.at(join);
        const out = Math.hypot(first.x - from.x, first.z - from.z);
        // (It sits until it is time to leave for there at its pace.)
        wait = Math.max(wait, join - start - out / v - v / paces.accel / 2);
        const route: NavPoint[] = [{x: from.x, z: from.z}];
        const times: number[] = [start + wait];
        // (Its way out in steps about as long as its track's, so the curve through them is even.)
        const steps = Math.max(Math.round(out / (v * 2)), 1);
        for (let k = 1; k < steps; k++) {
            route.push({x: from.x + ((first.x - from.x) * k) / steps, z: from.z + ((first.z - from.z) * k) / steps});
            times.push(start + wait + ((join - start - wait) * k) / steps);
        }
        for (let t = join; t < end - 1; t += 2) {
            const at = soar.at(t);
            route.push({x: at.x, z: at.z});
            times.push(t);
        }
        route.push({x: to.x, z: to.z});
        times.push(end);
        const heading = Math.atan2(route[1].x - from.x, route[1].z - from.z);
        if (from.yaw !== undefined) {
            const turn = Math.abs(Math.atan2(Math.sin(heading - from.yaw), Math.cos(heading - from.yaw)));
            if (turn > 1) {
                legs.push({mode: "pause", from, to: from, path: null, length: 0, seconds: turn / TURN_RATE, beat: "pause", yaw: heading, turn: true});
                wait = Math.max(wait - turn / TURN_RATE, 0.5);
            }
        }
        legs.push({mode: "pause", from, to: from, path: null, length: 0, seconds: wait, beat: "pause", yaw: heading});
        const flat = Math.max(routeLength(route), 0.01);
        // Its heights along its route: up from where it sits to its track's over its way out, then its track's own.
        const perSecond = soarHeights(world, soar, start, SLOT_SECONDS);
        const heightAtTime = (t: number) => {
            const f = Math.min(Math.max(t - start, 0), SLOT_SECONDS);
            const i = Math.min(Math.floor(f), SLOT_SECONDS - 1);
            return perSecond[i] + (perSecond[i + 1] - perSecond[i]) * (f - i);
        };
        const K = 64;
        const alt = new Float32Array(K + 1);
        const along: number[] = [0];
        for (let i = 1; i < route.length; i++) along.push(along[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z));
        const total = along[along.length - 1] || 1;
        const joined = heightAtTime(join);
        let seg = 1;
        for (let i = 0; i <= K; i++) {
            const d = (i / K) * total;
            while (seg < along.length - 1 && along[seg] < d) seg++;
            const k = (d - along[seg - 1]) / Math.max(along[seg] - along[seg - 1], 1e-6);
            const t = times[seg - 1] + (times[seg] - times[seg - 1]) * Math.min(Math.max(k, 0), 1);
            if (t < join) {
                const q = Math.min(d / Math.max(out, 1e-6), 1);
                alt[i] = from.y + (joined - from.y) * q * q * (3 - 2 * q);
            } else alt[i] = heightAtTime(t);
            // (Never steeper than it climbs; and over the ground, the rocks and the crowns on its way out.)
            alt[i] = Math.min(alt[i], from.y + d * Math.tan(paces.climb));
            // (All the way: where its track is over a wood before it has climbed to it at its angle, it climbs steeper.)
            if (i > 0 && i < K) {
                const over = alongRouteBy(route, i / K);
                alt[i] = Math.max(alt[i], soarFloorAt(world, over.x, over.z) + (t < join ? 2 : SOAR_CLEAR));
            }
        }
        alt[0] = from.y;
        alt[K] = to.y;
        easedHeights(alt, flat / K, Math.tan(0.7), Math.tan(0.7));
        alt[0] = from.y;
        alt[K] = to.y;
        const seconds = end - start - legs.reduce((sum, leg) => sum + leg.seconds, 0);
        const plan = planSoarLeg(paces, flat, {pace: v, from: false, to: true, climb: out});
        legs.push({mode: "air", from, to, path: route, length: flat, seconds, beat: soar.beat, plan: {...plan, seconds, soar: {from: false, to: true, alt}}});
        return {...base, mode: "air", arrive: end, to, finish: settled.finish, path: null, legs, stay: [], length: flat, running: false};
    }
    if (!fromAloft) return null;
    // Down out of it: on along its heading, round, and in to where it lands.
    const flat = Math.hypot(to.x - from.x, to.z - from.z);
    const heading = from.yaw ?? Math.atan2(to.x - from.x, to.z - from.z);
    const drop = Math.max(from.y - to.y, 0);
    const need = drop / Math.tan(Math.min(Math.max(paces.descent, 0.3), 0.6));
    // Its way down is a turn and a straight (lane B5): from its heading it turns at its bank's radius, towards the
    // side its landing is on, until it heads for it, then flies straight in; a turn or more extra where it needs the
    // way to come down over (a spiral down from a thermal over its own perch). Points every third of a radian round the
    // turn and as far apart along the straight: a curve through even points neither cuts a corner at over a radian a
    // second nor hooks back at its end (both seen with a lead-out and a corner).
    const R = Math.max((paces.cruise * paces.cruise) / (G * Math.tan((30 * Math.PI) / 180)), 10);
    const hx = Math.sin(heading);
    const hz = Math.cos(heading);
    const away = Math.atan2(to.x - from.x, to.z - from.z);
    const swing = Math.atan2(Math.sin(away - heading), Math.cos(away - heading));
    let side = swing >= 0 ? 1 : -1;
    // (Its turn's middle on that side, by its radius; the other side when its landing is inside that circle.)
    let ox = from.x + side * R * hz;
    let oz = from.z - side * R * hx;
    if (Math.hypot(to.x - ox, to.z - oz) < R * 1.1) {
        side = -side;
        ox = from.x + side * R * hz;
        oz = from.z - side * R * hx;
    }
    const d = Math.max(Math.hypot(to.x - ox, to.z - oz), R * 1.001);
    const bearing = Math.atan2(to.x - ox, to.z - oz);
    // (The heading it leaves its turn on: the tangent of its circle through where it lands.)
    const out = bearing + side * Math.asin(Math.min(R / d, 1));
    let turn = ((((out - heading) * side) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const straight = Math.sqrt(Math.max(d * d - R * R, 0));
    while (R * turn + straight < need && turn < Math.PI * 8) turn += Math.PI * 2;
    const route: NavPoint[] = [];
    const arcs = Math.max(Math.ceil(turn / 0.35), 1);
    for (let k = 0; k <= arcs; k++) {
        const psi = heading + side * turn * (k / arcs);
        // (On its circle heading psi it is at the middle less its radius along its heading's right-hand normal, times its side.)
        route.push({x: ox - side * R * Math.cos(psi), z: oz + side * R * Math.sin(psi)});
    }
    route[0] = {x: from.x, z: from.z};
    const off = route[route.length - 1];
    const runs = Math.max(Math.round(Math.hypot(to.x - off.x, to.z - off.z) / Math.max(R * 0.35, 4)), 1);
    for (let k = 1; k <= runs; k++) route.push(k === runs ? {x: to.x, z: to.z} : {x: off.x + ((to.x - off.x) * k) / runs, z: off.z + ((to.z - off.z) * k) / runs});
    const length = Math.max(routeLength(route), 0.01);
    const ski = wet(world, to) && !raised(world, to) ? paces.skiWater : 0;
    const plan = planSoarLeg(paces, length, {pace: paces.cruise, from: true, to: false, descend: Math.min(length * 0.5, Math.max(animal.length * 8, 15)), ski});
    // Its heights: a line down from where it is to where it lands, over the crowns and the rocks until its last stretch.
    const K = 48;
    const alt = new Float32Array(K + 1);
    for (let i = 0; i <= K; i++) {
        const at = alongRouteBy(route, i / K);
        const line = from.y + (to.y - from.y) * (i / K);
        alt[i] = i / K < 0.85 ? Math.max(line, Math.min(soarFloorAt(world, at.x, at.z) + 3, from.y)) : line;
    }
    alt[0] = from.y;
    alt[K] = to.y;
    easedHeights(alt, length / K, Math.tan(0.6), Math.tan(0.7));
    alt[0] = from.y;
    alt[K] = to.y;
    const seconds = Math.min(plan.seconds, SLOT_SECONDS - 6);
    const leg: Leg = {mode: "air", from, to, path: route, length, seconds, beat: now.doing === "soar" ? "glide" : "fly", plan: {...plan, seconds, soar: {from: true, to: false, alt}}};
    const left = SLOT_SECONDS - seconds;
    const room = Math.max(left - 3, 0);
    const lastAt = settled.beats.length ? settled.beats[settled.beats.length - 1].at : 0;
    const squeeze = lastAt > room && lastAt > 0 ? room / lastAt : 1;
    return {...base, mode: "air", arrive: start + seconds, to, finish: settled.finish, path: null, legs: [leg], stay: settled.beats.map((b) => ({...b, at: b.at * squeeze})), length, running: false};
}

/** What a wading bird does standing in the shallows, and how often a slot of it is spent there (lane MA3). */
const WADING: ReadonlySet<ArkBehaviour> = new Set<ArkBehaviour>(["forage", "rest", "wander", "groom"]);
const WADE_SHARE = 0.55;

/**
 * Shallow water near a centre where a wading bird stands (lane MA3): out from its nearest water's edges, the first
 * point at least 5 cm and at most a third of its length deep (half a metre at most: its legs), seeded per slot. Null
 * where no water's edge is near. The scene keeps it standing on the bed there (`index.ts`, no band: never on the
 * surface).
 */
function shallowsNear(world: ScheduleWorld, animal: ScheduleAnimal, centre: {x: number; z: number}, reach: number, slot: number): Spot | null {
    const edges = world.sampler.attachPoints("water_edge", {x: centre.x, z: centre.z, r: reach});
    if (!edges.length) return null;
    const deepest = Math.min(Math.max(animal.length * 0.33, 0.12), 0.5);
    const random = rng(hashString(`${animal.id}#shallows#${slot}`));
    const sorted = [...edges].sort((m, n) => Math.hypot(m.x - centre.x, m.z - centre.z) - Math.hypot(n.x - centre.x, n.z - centre.z) || m.id.localeCompare(n.id));
    const first = Math.floor(random() ** 1.4 * Math.min(sorted.length, 12));
    for (let k = 0; k < Math.min(sorted.length, 12); k++) {
        const edge = spotOf(sorted[(first + k) % Math.min(sorted.length, 12)]);
        const yaw = edgeYaw(world, edge) + (random() - 0.5) * 0.8;
        for (let d = 0.4; d <= 4; d += 0.3) {
            const x = edge.x + Math.sin(yaw) * d;
            const z = edge.z + Math.cos(yaw) * d;
            const depth = surfaceY(world, x, z) - world.sampler.heightAt(x, z);
            if (depth > deepest) break;
            if (depth >= 0.05) return {x, y: world.sampler.heightAt(x, z), z, nx: 0, ny: 1, nz: 0, point: null, yaw};
        }
    }
    return null;
}

/**
 * How far a bird that walks first walks rather than flies (m, lane MA3): as far as its walk (at most its run, never
 * past its pace cap) takes it in half a slot, the rest of the slot for what it came to do.
 */
function walkReach(profile: ArkBehaviourProfile, animal: ScheduleAnimal): number {
    const pace = bodyLengthsPerSecond(profile) * Math.max(animal.length, 0.05);
    return Math.max(3, animal.length * 6, pace * Math.min(Math.max(runFactor(profile), 1), PACE_CAP) * SLOT_SECONDS * 0.5);
}

/**
 * Where it is on its way into or out of the water now (lane MA3): the slide in ("enter") or the climb out ("exit") and
 * how far along it (0-1), from its trip's legs at a world time; null on any other leg. The rig player plays the
 * entry and exit clips by it, and the pose eases the body from standing to its float line over it.
 */
export function waterEdgeAt(trip: Trip, epochSeconds: number): {mode: "enter" | "exit"; u: number; seconds: number} | null {
    let t = trip.start;
    for (const leg of trip.legs) {
        const end = t + leg.seconds;
        if (epochSeconds < end) {
            if (epochSeconds < t || (leg.mode !== "enter" && leg.mode !== "exit")) return null;
            return {mode: leg.mode, u: leg.seconds > 0 ? Math.min(Math.max((epochSeconds - t) / leg.seconds, 0), 1) : 1, seconds: leg.seconds};
        }
        t = end;
    }
    return null;
}

/** The water's edge to cross at: the drinking and shore points nearest a spot. */
function waterEdgeNear(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, p: Spot): Spot | null {
    const near = world.sampler.attachPoints("water_edge", {x: p.x, z: p.z, r: Math.max(homeRadius(profile, animal) * 2, 12)});
    if (!near.length) return null;
    const best = [...near].sort((m, n) => Math.hypot(m.x - p.x, m.z - p.z) - Math.hypot(n.x - p.x, n.z - p.z) || m.id.localeCompare(n.id))[0];
    return spotOf(best);
}

/** Which way the water is from an edge point (its own heading faces the water). */
function edgeYaw(world: ScheduleWorld, edge: Spot): number {
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const px = edge.x + Math.sin(a) * 1.5;
        const pz = edge.z + Math.cos(a) * 1.5;
        if (world.sampler.heightAt(px, pz) < surfaceY(world, px, pz)) return a;
    }
    return 0;
}

export type TripPose = {
    x: number;
    y: number;
    z: number;
    yaw: number;
    /** Moving now (walking, flying, swimming, a grazing step). */
    moving: boolean;
    /** In the air now. */
    aloft: boolean;
    nx: number;
    ny: number;
    nz: number;
    /** The beat now (bite, chew, scan, walk, swim, enter_water…). */
    beat: ArkBeat;
    /**
     * On an air leg (MA1): its stage (a run to take off, the climb, level flight, the glide-in, a ski to a stop on the
     * water), its speed over the ground (m/s), and the heights of the surfaces it took off from and lands on (a perch,
     * a rock's top, the lake's level), for the rig's height over its landing.
     */
    air?: {stage: AirStage; speed: number; from: number; to: number};
};

/** A point along a polyline route (x, z), smoothed through its middle points (a bowed line, an arc). */
/** What a low flyer climbs over rather than through (the colliders' kinds: never a trunk, under its crown). */
const FLOWN_OVER: ReadonlySet<string> = new Set(["fence", "building", "post", "hay", "log", "rock"]);

/** A flock member taking off with its leader eases into its place by it over this long (s). */
const JOIN_SECONDS = 5;
/** How often a flock's member goes with its leader's move or foray (the rest of the time it makes its own way, or stays). */
const FLOCK_FOLLOWS = 0.9;
/** A flock member comes down to its own landing place over this long (s), down as its leader is. */
const LAND_TOGETHER = 4;
/**
 * When a flock's leader comes down from its last flight of a member's slot (lane B5), or null: its leader's last trip
 * by air over the slot that goes somewhere (more than a hop to the next twig) and ends on something, after which its
 * leader does not fly on. Remembered per slot.
 */
const FLOCK_DOWN = new WeakMap<NonNullable<Trip["shadow"]>, number | null>();
function flockDown(world: ScheduleWorld, shadow: NonNullable<Trip["shadow"]>): number | null {
    const known = FLOCK_DOWN.get(shadow);
    if (known !== undefined) return known;
    let down: number | null = null;
    for (const trip of shadow.trips) {
        if (trip.mode !== "air" || trip.shadow || trip.arrive >= trip.end - 0.5) {
            // (Up at its slot's end, a soar or its own leader's flight: not down.)
            if (trip.mode === "air" && trip.arrive >= trip.end - 0.5) down = null;
            continue;
        }
        if (Math.hypot(trip.to.x - trip.from.x, trip.to.z - trip.from.z) > Math.max(6, (trip.owner?.animal.length ?? 0.3) * 20)) down = trip.arrive;
    }
    void world;
    FLOCK_DOWN.set(shadow, down);
    return down;
}
/** A flight for its own sake: about this long at its cruise (s), and never further than FLY_AWAY_MOST (m). */
const FLY_AWAY_SECONDS = 15;
const FLY_AWAY_MOST = 220;
/** A bird walks this many of its lengths (and three metres) rather than fly them; one that flies first, a metre. */
const HOP_LENGTHS = 6;
/** A round's flight at its cruise, out and back (s). */
const ROUND_SECONDS = 36;
/** A round's bank at its far end, at most (rad: 35°, a pull of 0.7 g). */
const ROUND_BANK = (35 * Math.PI) / 180;
/**
 * A flight this high over its line (its plan's height, m) or more keeps it over the woods' crowns (decision 287): the
 * mid and high flyers' cruise (6 and 14 m), a soar's. A low one (1.6 m, a ground bird's) and a short hop fly under the
 * leaves. Under means its height there under the crowns' lowest leaves by CANOPY_UNDER (m) or more.
 */
const CANOPY_FLIGHT = 3;
const CANOPY_UNDER = 1;
/** A flight's floor is sampled along its route about this often (m), at most FLOOR_SAMPLES times (`overFloor`). */
const FLOOR_STEP = 1;
const FLOOR_SAMPLES = 320;
/** How far out a soar sweeps at most (m; MA1: at a true glide, 60 m filled a soar's time at a crawl). */
const SOAR_REACH = 140;
/** A short way a flyer walks, wades or swims rather than flies, if it gets there that way in no longer than this (s). */
const WALK_INSTEAD = 45;
/**
 * Shorter than this share of its flight's loss (`flightLoss`), a flight would average under about 0.4 of its cruise: at
 * half a g it never comes near its speed between its take-off and its landing (for a springer, a flight of length L that
 * never reaches its cruise averages √(aL)/2; 0.4 of the cruise at L = 0.64 of the loss).
 */
const WALK_SHARE = 0.65;

/**
 * A soar's sweep out over its range towards a goal: bowed out to one side through to the goal when the goal is far
 * enough, else out along a heading (towards the goal, bent a little; or seeded),
 * round in one wide U at the far end and back in to the goal: half a turn, not a loop. Towards the island's middle if
 * the far end would be off it. About 2.2 times `span` long as a U.
 */
function sweepRoute(from: Spot, to: Spot, span: number, random: () => number): NavPoint[] {
    const flat = Math.hypot(to.x - from.x, to.z - from.z);
    const side = random() < 0.5 ? -1 : 1;
    const bow = side * (0.18 + random() * 0.14) * span;
    if (flat >= span * 0.8) {
        const dir = Math.atan2(to.x - from.x, to.z - from.z);
        const ux = Math.sin(dir);
        const uz = Math.cos(dir);
        return [from, {x: from.x + ux * (flat / 3) + uz * bow, z: from.z + uz * (flat / 3) - ux * bow}, {x: from.x + ux * ((2 * flat) / 3) + uz * bow * 0.9, z: from.z + uz * ((2 * flat) / 3) - ux * bow * 0.9}, to];
    }
    let dir = flat > 0.5 ? Math.atan2(to.x - from.x, to.z - from.z) + (random() - 0.5) * 0.8 : random() * Math.PI * 2;
    if (Math.hypot(from.x + Math.sin(dir) * span, from.z + Math.cos(dir) * span) > Math.max(Math.hypot(from.x, from.z), 60)) dir = Math.atan2(-from.x, -from.z) + (random() - 0.5) * 0.8;
    const ux = Math.sin(dir);
    const uz = Math.cos(dir);
    const at = (along: number, across: number): NavPoint => ({x: from.x + ux * along + uz * across, z: from.z + uz * along - ux * across});
    return [from, at(span * 0.5, bow * 0.15), at(span * 0.9, bow * 0.45), at(span * 0.85, bow * 0.85), at(span * 0.45, bow * 0.8), to];
}

/**
 * A round (the follow-up of decision 285): out along a heading for half of ROUND_SECONDS at its cruise (FLY_AWAY_MOST at
 * most), round one wide U at the far end (banked at most ROUND_BANK at its cruise, `G·tan` of it its pull) and back in to
 * its goal by where it took off: half a turn and a little, never a loop (the audit's circling), and long enough that its
 * half turn is spread over most of a minute (at 13 s out the audit's turns a minute doubled). Towards the island's
 * middle if the far end would be off it, as a soar's sweep is.
 */
function roundRoute(from: Spot, to: Spot, paces: AirPaces, random: () => number): NavPoint[] {
    const out = Math.min(Math.max(paces.cruise * ROUND_SECONDS * 0.5, 20), FLY_AWAY_MOST);
    const r = Math.min(Math.max((paces.cruise * paces.cruise) / (G * Math.tan(ROUND_BANK)), 4), out * 0.4);
    const side = random() < 0.5 ? -1 : 1;
    let dir = random() * Math.PI * 2;
    if (Math.hypot(from.x + Math.sin(dir) * (out + r), from.z + Math.cos(dir) * (out + r)) > Math.max(Math.hypot(from.x, from.z), 60)) dir = Math.atan2(-from.x, -from.z) + (random() - 0.5) * 0.8;
    const ux = Math.sin(dir);
    const uz = Math.cos(dir);
    const at = (along: number, across: number): NavPoint => ({x: from.x + ux * along + uz * across * side, z: from.z + uz * along - ux * across * side});
    const c = Math.SQRT1_2;
    return [from, at(out * 0.5, 0), at(out, 0), at(out + r * c, r * (1 - c)), at(out + r, r), at(out + r * c, r * (1 + c)), at(out, 2 * r), at(out * 0.5, 1.8 * r), to];
}

/**
 * An air leg along a route (MA1): planned at its paces (`planAirLeg`), its run dropped when the run would cross something
 * solid or leave the surface it starts on (it springs off instead), then cleared over what it would cross low.
 */
function airLeg(world: ScheduleWorld, paces: AirPaces, from: Spot, to: Spot, route: NavPoint[], height: number, beat: ArkBeat, opts: {pace?: number; run: number; ski: number}, bodyR: number): Leg {
    const flat = Math.max(routeLength(route), 0.01);
    let run = opts.run;
    if (run > 0) {
        const metres = (run * run) / (2 * paces.runAccel);
        const onWater = wet(world, from);
        const scratch: Collider[] = [];
        for (let d = 0.5; d <= metres + 0.5 && run > 0; d += 0.5) {
            const at = alongRouteBy(route, Math.min(d / flat, 1));
            if (wet(world, at) !== onWater) run = 0;
            else if (world.nav.colliders) for (const c of world.nav.colliders.near(at.x, at.z, bodyR + 0.01, scratch)) if (!c.soft && colliderDistance(c, at.x, at.z) < bodyR) run = 0;
        }
    }
    // (Its speed along its way up or down as well: a hop up to a perch 3 m over it is 3 m of flight, not half a metre.)
    const plan = planAirLeg(paces, Math.hypot(flat, to.y - from.y), height, {pace: opts.pace, run, ski: opts.ski});
    return overSolids(world, {mode: "air", from, to, path: route, length: flat + Math.abs(to.y - from.y), seconds: plan.seconds, beat, cruise: plan.height, plan}, bodyR);
}

/**
 * How far a planned flight's line must rise along its route to keep its height over what is under it (MA1 follow-up,
 * decision 287), worked out once a leg; its height over that (`plan.height`) rides on top as before:
 * - over the ground, and the drawn rocks' tops where they stand (`flightFloor`);
 * - over the woods' crowns (`canopyTop`) wherever its line at its height would be in their leaves or over them, for a
 *   flight at CANOPY_FLIGHT or more over its line that soars, or that crosses a wood from open ground or water to open
 *   ground or water: a raptor soaring at 17 m over 25 m trees flew through their leaves. A lower one (a ground bird's,
 *   a hop), and one within a wood (from a perch in its crowns or from under them, or to one), keep to their height
 *   through it as before: a forest bird's way from tree to tree is through the trees;
 * - eased: towards a higher floor it rises at no more than its climb's slope and after one comes down at no more than
 *   its glide-in's (its plan's own angles, 50° at most), and never more than it can climb since its lift-off or come
 *   down before its touch-down. Before, the rise was the floor's own, times the take-off's and the landing's smoothsteps:
 *   a soar's height jumped where a rock's top began and fell 50 m in the last second of a glide off a ridge (80 m/s).
 * Sampled every FLOOR_STEP m (FLOOR_SAMPLES at most: 1.3 kB a leg) and read between samples.
 */
const OVER_FLOOR = new WeakMap<Leg, Float32Array>();
function overFloor(world: ScheduleWorld, leg: Leg): Float32Array {
    const known = OVER_FLOOR.get(leg);
    if (known) return known;
    const route = leg.path ?? [leg.from, leg.to];
    const plan = leg.plan!;
    const L = Math.max(routeLength(route), 0.01);
    const n = Math.min(Math.max(Math.ceil(L / FLOOR_STEP), 8), FLOOR_SAMPLES);
    const over = new Float32Array(n + 1);
    const sampler = world.sampler;
    const top = sampler.canopyTop;
    const under = (p: Spot) => (top ? top(p.x, p.z) > p.y + 0.5 : false);
    const crosses = plan.height >= CANOPY_FLIGHT && (leg.beat === "glide" || (!under(leg.from) && !under(leg.to)));
    const woods = crosses && top && sampler.canopyBase ? {top, base: sampler.canopyBase} : null;
    const span = Math.max(plan.touchdown - plan.liftoff, 1e-6);
    for (let i = 0; i <= n; i++) {
        const share = i / n;
        const at = alongRouteBy(route, share);
        // (Its line there, as `poseOnTrip` draws it.)
        const base = leg.from.y + (leg.to.y - leg.from.y) * Math.min(Math.max((share - plan.liftoff) / span, 0), 1);
        let floor = sampler.flightFloor ? Math.max(topAt(world, at.x, at.z), sampler.flightFloor(at.x, at.z)) : topAt(world, at.x, at.z);
        const crown = woods ? woods.top(at.x, at.z) : -Infinity;
        // (In the leaves or over them at its height there: over the crowns.)
        if (crown > floor && base + plan.height + Math.max(floor - base, 0) > woods!.base(at.x, at.z) - CANOPY_UNDER) floor = crown;
        over[i] = Math.max(floor - base, 0);
    }
    // (Its climb's slope from its plan: it climbs its height over `rise` of the route, the steepest part 1.5 times the
    // mean, at its climb angle (`planAirLeg`); its glide-in's the same over `fall`.)
    const steepest = Math.tan((50 * Math.PI) / 180);
    const climb = plan.height > 0.05 ? Math.min((1.5 * plan.height) / Math.max(plan.rise * L, 1e-3), steepest) : Math.tan((35 * Math.PI) / 180);
    const descent = plan.height > 0.05 ? Math.min((1.5 * plan.height) / Math.max(plan.fall * L, 1e-3), steepest) : climb;
    const ds = L / n;
    for (let i = 1; i <= n; i++) over[i] = Math.max(over[i], over[i - 1] - descent * ds);
    for (let i = n - 1; i >= 0; i--) over[i] = Math.max(over[i], over[i + 1] - climb * ds);
    for (let i = 0; i <= n; i++) {
        const share = i / n;
        over[i] = Math.min(over[i], climb * Math.max(share - plan.liftoff, 0) * L, descent * Math.max(plan.touchdown - share, 0) * L);
    }
    OVER_FLOOR.set(leg, over);
    return over;
}

/** A leg's rise over its line (`overFloor`) a share of its route along. */
function overAt(over: Float32Array, share: number): number {
    const f = Math.min(Math.max(share, 0), 1) * (over.length - 1);
    const i = Math.min(Math.floor(f), over.length - 2);
    return over[i] + (over[i + 1] - over[i]) * (f - i);
}

/**
 * A flock member's catch-up to its leader in the air (MA1): `seconds` fixed (it joins where its leader will be), up to
 * its speed at its take-off's acceleration where that is enough (else quicker), and on at it; up over a hump of `height`
 * and into its place beside its leader, never stopping.
 */
function catchUpPlan(paces: AirPaces, length: number, seconds: number, height: number): AirPlan {
    let share = 0.5;
    for (let k = 0; k < 4; k++) {
        const top = length / Math.max(seconds * (1 - share / 2), 1e-6);
        share = Math.min(Math.max(top / (paces.accel * seconds), 0.15), 1);
    }
    const peak = length / Math.max(seconds * (1 - share / 2), 1e-6);
    return {seconds, knots: [0, 0, share, 1, 1, 1], liftoff: 0, touchdown: 1, rise: 0.5, fall: 0.5, height, peak, joins: true};
}

/**
 * A flight that clears what it takes off beside or comes down behind (collisions): where its climb or its descent would
 * cross a fence, a wall, a hay bale or a rock below its top, it climbs (or comes down) over a shorter share of the leg,
 * steeply enough to pass 0.15 m over it (2026-11-12: a masked owl took off low through a garden's pickets). Its route
 * and its pace are as they were. (MA1: in its plan's shares, from its lift-off and to its touch-down.)
 */
function overSolids(world: ScheduleWorld, leg: Leg, bodyR: number): Leg {
    const solid = world.nav.colliders;
    const route = leg.path;
    const plan = leg.plan;
    if (!solid || !route || leg.mode !== "air" || !plan) return leg;
    const height = plan.height;
    if (height <= 0.2) return leg;
    const lo = plan.liftoff;
    const td = plan.touchdown;
    let rise = plan.rise;
    let fall = plan.fall;
    const n = Math.min(Math.max(Math.ceil(leg.length / 0.5), 8), 120);
    const inverse = (need: number) => {
        // (The share of the climb (0-1) that lifts it `need` of its height: smoothstep's inverse.)
        let a = 0;
        let b = 1;
        for (let k = 0; k < 14; k++) {
            const m = (a + b) / 2;
            if (m * m * (3 - 2 * m) < need) a = m;
            else b = m;
        }
        return b;
    };
    const scratch: Collider[] = [];
    for (let j = 1; j < n; j++) {
        const q = j / n;
        // (Only its climb and its descent: in between it is at its height; on its run and its ski it is on the surface.)
        if (q <= lo || q >= td || (q - lo > rise && td - q > fall)) continue;
        const at = alongRouteBy(route, q);
        let top = -Infinity;
        for (const c of solid.near(at.x, at.z, bodyR + 0.01, scratch)) {
            if (!FLOWN_OVER.has(c.kind) || c.soft || colliderDistance(c, at.x, at.z) >= bodyR) continue;
            top = Math.max(top, c.y1);
        }
        if (top === -Infinity) continue;
        const base = leg.from.y + (leg.to.y - leg.from.y) * Math.min(Math.max((q - lo) / Math.max(td - lo, 1e-6), 0), 1);
        const ground = Math.max(world.sampler.heightAt(at.x, at.z), 0);
        const need = (top + 0.15 - base) / (height + Math.max(ground - base, 0));
        if (need <= 0 || need >= 0.98) continue;
        const k = inverse(need);
        if (q <= (lo + td) / 2) rise = Math.max(Math.min(rise, (q - lo) / k), 0.01);
        else fall = Math.max(Math.min(fall, (td - q) / k), 0.01);
    }
    return rise === plan.rise && fall === plan.fall ? leg : {...leg, plan: {...plan, rise, fall}};
}

function alongRoute(route: NavPoint[], u: number): {x: number; z: number; yaw: number} {
    if (route.length === 3) {
        // A quadratic curve through the middle point.
        const [a, m, b] = route;
        const cx = 2 * m.x - (a.x + b.x) / 2;
        const cz = 2 * m.z - (a.z + b.z) / 2;
        const v = 1 - u;
        const x = v * v * a.x + 2 * v * u * cx + u * u * b.x;
        const z = v * v * a.z + 2 * v * u * cz + u * u * b.z;
        const dx = 2 * v * (cx - a.x) + 2 * u * (b.x - cx);
        const dz = 2 * v * (cz - a.z) + 2 * u * (b.z - cz);
        return {x, z, yaw: Math.atan2(dx, dz)};
    }
    if (route.length > 3) {
        // Catmull-Rom through every point.
        const n = route.length - 1;
        const f = Math.min(u * n, n - 1e-6);
        const i = Math.floor(f);
        const t = f - i;
        const p0 = route[Math.max(i - 1, 0)];
        const p1 = route[i];
        const p2 = route[i + 1];
        const p3 = route[Math.min(i + 2, n)];
        const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
        const dcr = (a: number, b: number, c: number, d: number) => 0.5 * (-a + c + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t * t);
        return {x: cr(p0.x, p1.x, p2.x, p3.x), z: cr(p0.z, p1.z, p2.z, p3.z), yaw: Math.atan2(dcr(p0.x, p1.x, p2.x, p3.x), dcr(p0.z, p1.z, p2.z, p3.z))};
    }
    const at = alongPath(route, u);
    return at;
}

/**
 * A route's curve sampled by length (MA1): the cumulative length at even steps of its parameter, so a share of its
 * length finds its point (`alongRouteBy`) and a flight's planned speed is its speed over the ground, not the curve's
 * parameter's (a sweep's Catmull-Rom spans differ in length). Remembered per route.
 */
const ROUTE_TABLES = new WeakMap<NavPoint[], Float64Array>();
function routeTable(route: NavPoint[]): Float64Array {
    let table = ROUTE_TABLES.get(route);
    if (table) return table;
    // (A step every 10 cm or so, 64 to 4096: a coarser table's straight pieces showed as small jolts in its speed.)
    const steps = Math.min(Math.max(Math.ceil(pathLength(route) / 0.1), 64), 4096);
    table = new Float64Array(steps + 1);
    let prev = alongRoute(route, 0);
    for (let i = 1; i <= steps; i++) {
        const p = alongRoute(route, i / steps);
        table[i] = table[i - 1] + Math.hypot(p.x - prev.x, p.z - prev.z);
        prev = p;
    }
    ROUTE_TABLES.set(route, table);
    return table;
}
/** A route's length along its curve (m). */
function routeLength(route: NavPoint[]): number {
    const table = routeTable(route);
    return table[table.length - 1];
}
/** The point a share of a route's length along it. */
function alongRouteBy(route: NavPoint[], share: number): {x: number; z: number; yaw: number} {
    const table = routeTable(route);
    const steps = table.length - 1;
    const total = table[steps];
    if (total <= 1e-9) return alongRoute(route, Math.min(Math.max(share, 0), 1));
    const want = Math.min(Math.max(share, 0), 1) * total;
    let a = 0;
    let b = steps;
    while (b - a > 1) {
        const m = (a + b) >> 1;
        if (table[m] <= want) a = m;
        else b = m;
    }
    const span = table[b] - table[a];
    return alongRoute(route, (a + (span > 1e-12 ? (want - table[a]) / span : 0)) / steps);
}

/**
 * A flock or school member's point beside its leader's pose: its own offset, which breathes (the cluster loosens and
 * tightens, each member on its own rhythm; `ease` 0 holds it still, for the moment it joins), above or below in the
 * water and the air, and its own small difference of heading.
 */
function shadowPoint(world: ScheduleWorld, at: TripPose, shadow: NonNullable<Trip["shadow"]>, epochSeconds: number, ease: number): {x: number; y: number; z: number; yaw: number} {
    const phase = (shadow.dx * 7.3 + shadow.dz * 3.1) % (Math.PI * 2);
    // (Slowly and a little: a quick in-and-out round a resting leader read as swimming in circles.)
    const breathe = 1 + ease * 0.08 * Math.sin(epochSeconds * 0.11 + phase);
    const inWater = at.y < surfaceY(world, at.x, at.z) - 0.01;
    const x = at.x + shadow.dx * breathe;
    const z = at.z + shadow.dz * breathe;
    const floor = world.sampler.heightAt(x, z);
    const top = surfaceY(world, x, z);
    // (Lane B5: its leader down, it is down too, on what is under its own place: beside a leader up on a perch it hung
    // in the air at its leader's height, 43% of the time a parrot spent beside its leader.)
    const y = at.aloft || inWater ? at.y + shadow.dy * (1 + ease * 0.15 * Math.sin(epochSeconds * 0.15 + phase)) : Math.max(floor, top);
    const ground = at.aloft ? -Infinity : inWater ? floor + 0.2 : Math.max(floor, top);
    const ceiling = inWater ? top - 0.1 : Infinity;
    return {x, y: Math.min(Math.max(y, ground), ceiling), z, yaw: at.yaw + ease * 0.08 * Math.sin(epochSeconds * 0.15 + phase)};
}

function legPose(world: ScheduleWorld, leg: Leg, u: number, trip: Trip, epochSeconds: number): TripPose {
    const {from, to} = leg;
    const moving = u < 1;
    const up = {nx: 0, ny: 1, nz: 0};
    switch (leg.mode) {
        case "ground":
        case "water": {
            const route = leg.path ?? [from, to];
            // (Lane B4: a walk's own shape in time, `groundProgress`: getting going, slowing to its stop, a burst mover's
            // bursts and stops. `u` from here on is the share of its way covered, not of its time.)
            const paced = leg.shape ? groundProgress(u * leg.seconds, leg.seconds, leg.shape) : null;
            const timeUp = u >= 1;
            // (Read at once: `groundProgress` hands back one reused object.)
            const stopped = paced !== null && !paced.moving;
            if (paced) u = timeUp ? 1 : paced.share;
            const at = alongPath(route, u);
            // It faces a point a metre and a half on along its way: a corner is turned through, not snapped.
            const total = pathLength(route);
            if (total > 0.01 && u < 1) {
                const ahead = alongPath(route, Math.min(u + (leg.look ?? 1.5) / total, 1), total);
                if (Math.hypot(ahead.x - at.x, ahead.z - at.z) > 0.05) at.yaw = Math.atan2(ahead.x - at.x, ahead.z - at.z);
            }
            const ground = world.sampler.heightAt(at.x, at.z);
            // (Its height over the ground, or in the water at its depth under the surface: the sea's 0, or on the bigger
            // island the lake's and the river's own level.)
            const level = (p: Spot) => {
                const h = world.sampler.heightAt(p.x, p.z);
                return h > surfaceY(world, p.x, p.z) ? p.y - h : 0;
            };
            const top = surfaceY(world, at.x, at.z);
            const base = ground > top ? ground : Math.max(Math.min(from.y + (to.y - from.y) * u, top), ground);
            const y = base + level(from) * (1 - u) + level(to) * u;
            // (Stopped between two bursts: standing, looking about.)
            if (stopped && !timeUp && u > 0 && u < 1) return {x: at.x, y, z: at.z, yaw: at.yaw, moving: false, aloft: false, ...up, beat: "pause"};
            return {x: at.x, y, z: at.z, yaw: at.yaw, moving, aloft: false, ...up, beat: leg.beat};
        }
        case "enter":
        case "exit": {
            // Down the bank into the water, or up out of it.
            const x = from.x + (to.x - from.x) * u;
            const z = from.z + (to.z - from.z) * u;
            const ground = Math.max(world.sampler.heightAt(x, z), Math.min(from.y, to.y));
            const y = Math.max(from.y + (to.y - from.y) * u, ground);
            return {x, y, z, yaw: Math.atan2(to.x - from.x, to.z - from.z), moving, aloft: false, ...up, beat: leg.beat};
        }
        case "air": {
            const route = leg.path ?? [from, to];
            const plan = leg.plan;
            if (plan?.soar?.track) {
                // (Lane B5: a soar's own track, by time: round its thermal, along its glide.)
                const at = trackAt(plan.soar.track, u);
                return {x: at.x, y: at.y, z: at.z, yaw: at.yaw, moving, aloft: true, ...up, beat: leg.beat === "glide" ? "glide" : "fly", air: {stage: "cruise", speed: at.rate / Math.max(leg.seconds, 1e-6), from: from.y, to: to.y}};
            }
            if (!plan) {
                const at = alongRoute(route, u);
                const base = from.y + (to.y - from.y) * u;
                const ground = world.sampler.flightFloor ? Math.max(topAt(world, at.x, at.z), world.sampler.flightFloor(at.x, at.z)) : topAt(world, at.x, at.z);
                const k = Math.min(Math.min(u / (leg.rise ?? 0.18), 1), Math.min((1 - u) / (leg.fall ?? 0.22), 1));
                const lift = k * k * (3 - 2 * k);
                const y = Math.max(base + ((leg.cruise ?? trip.cruise) + Math.max(ground - base, 0)) * lift, Math.min(ground, base) + 0.05 * lift);
                return {x: at.x, y, z: at.z, yaw: at.yaw, moving, aloft: moving && lift > 0.05, ...up, beat: lift > 0.9 && leg.beat === "glide" ? "glide" : "fly"};
            }
            // (MA1) Along its route by its plan's speed (speeding up out of the take-off, slowing into the landing), not
            // at one speed from its first frame to its last.
            const {share, rate} = airProgress(plan.knots, u);
            const at = alongRouteBy(route, share);
            const stage = airStage(plan, share);
            const speed = moving ? (rate * routeLength(route)) / Math.max(leg.seconds, 1e-6) : 0;
            const air = {stage, speed, from: from.y, to: to.y};
            // On its run or its ski: on the surface under it (the water's, or the ground's).
            if (stage === "run" || stage === "ski") return {x: at.x, y: topAt(world, at.x, at.z), z: at.z, yaw: at.yaw, moving, aloft: false, ...up, beat: "fly", air};
            // Its line from where it lifts off to where it touches down, a hump over it to its height (smoothsteps at its
            // climb's and its glide-in's angles), and over the ground and the rocks' tops where they stand higher.
            // (Lane B5: a soar's leg up into it has its own heights along its route, eased over what is under it already.)
            const heights = plan.soar?.alt;
            const base = heights ? overAt(heights, share) : from.y + (to.y - from.y) * Math.min(Math.max((share - plan.liftoff) / Math.max(plan.touchdown - plan.liftoff, 1e-6), 0), 1);
            // (v2: over the drawn rocks' tops too, `flightFloor`: the bigger island's mountain is rock-strewn. Its line rises
            // over the floor along its route as eased once for the leg, the woods it flies over in it: `overFloor`.)
            const ground = world.sampler.flightFloor ? Math.max(topAt(world, at.x, at.z), world.sampler.flightFloor(at.x, at.z)) : topAt(world, at.x, at.z);
            const lift = airLift(plan, share);
            const y = Math.max(base + plan.height * lift + (heights ? 0 : overAt(overFloor(world, leg), share)), Math.min(ground, base) + 0.05 * lift);
            // (Joining its leader it is up as soon as it is off the ground: its hump comes back to its line in the air.)
            // (A soar's leg is up wherever it is off what is under it: it starts or ends in the air.)
            const aloft = moving && (plan.joins || plan.soar ? y > ground + 0.05 : lift > 0.05);
            return {x: at.x, y, z: at.z, yaw: at.yaw, moving, aloft, ...up, beat: lift > 0.9 && leg.beat === "glide" ? "glide" : "fly", air};
        }
        case "surface": {
            const x = from.x + (to.x - from.x) * u;
            const z = from.z + (to.z - from.z) * u;
            const y = from.y + (to.y - from.y) * u;
            const nx = from.nx + (to.nx - from.nx) * u;
            const ny = from.ny + (to.ny - from.ny) * u;
            const nz = from.nz + (to.nz - from.nz) * u;
            const n = Math.hypot(nx, ny, nz) || 1;
            return {x, y, z, yaw: Math.atan2(to.x - from.x, to.z - from.z), moving, aloft: false, nx: nx / n, ny: ny / n, nz: nz / n, beat: "climb"};
        }
        case "shadow": {
            const shadow = trip.shadow!;
            const lead = shadow.trips.find((t) => epochSeconds >= t.start && epochSeconds < t.end) ?? shadow.trips[shadow.trips.length - 1];
            const at = basePoseOnTrip(world, lead, Math.min(epochSeconds, lead.end - 0.001));
            // Blend into its own finish over the last seconds, so the next slot starts where this one ends. On the ground
            // a blend that goes anywhere is a walk there, facing its way (turned into it over its first quarter): never
            // sliding sideways or backwards (the default view's sparrow).
            // (The walk takes as long as its walking pace says, within the last 8% of the leg: at a slower blend its
            // walk clip played in slow motion.)
            const lastPart = 1 - 0.08;
            let settleAt = lastPart;
            let walkYaw: number | null = null;
            if (u >= lastPart) {
                const blendStart = epochSeconds - (u - lastPart) * leg.seconds;
                const lead0 = shadow.trips.find((t) => blendStart >= t.start && blendStart < t.end) ?? lead;
                const p0 = shadowPoint(world, basePoseOnTrip(world, lead0, Math.min(blendStart, lead0.end - 0.001)), shadow, blendStart, 1);
                const walkDist = Math.hypot(to.x - p0.x, to.z - p0.z);
                if (!at.aloft && walkDist > 0.3) {
                    if (leg.pace) settleAt = Math.max(1 - walkDist / leg.pace / leg.seconds, lastPart);
                    if (u >= settleAt) walkYaw = Math.atan2(to.x - p0.x, to.z - p0.z);
                }
            }
            // (MA1: its leader's stage and speed in the air, landing on its own finish.)
            const air = at.air ? {...at.air, to: to.y} : undefined;
            if (u >= 1) return {x: to.x, y: to.y, z: to.z, yaw: walkYaw ?? at.yaw, moving: false, aloft: at.aloft, ...up, beat: at.beat};
            const p = shadowPoint(world, at, shadow, epochSeconds, Math.min(u / 0.08, 1));
            // (Lane B5: a flock comes down together. Over the last LAND_TOGETHER s of its leader's flight, the last of the
            // slot's, a member eases from its place by its leader to where it lands itself, and is down when its leader
            // is: before, it hung in the air beside its leader's perch until the slot's last seconds.)
            const down = flockDown(world, shadow);
            if (down !== null && epochSeconds >= down - LAND_TOGETHER) {
                const k0 = Math.min(Math.max((epochSeconds - (down - LAND_TOGETHER)) / LAND_TOGETHER, 0), 1);
                if (k0 >= 1) return {x: to.x, y: to.y, z: to.z, yaw: to.yaw ?? at.yaw, moving: false, aloft: false, ...up, beat: at.aloft ? "rest" : at.beat};
                const k = k0 * k0 * (3 - 2 * k0);
                return {x: p.x + (to.x - p.x) * k, y: p.y + (to.y - p.y) * k, z: p.z + (to.z - p.z) * k, yaw: p.yaw, moving: true, aloft: true, ...up, beat: "fly", ...(air ? {air: {...air, stage: "descend" as AirStage}} : {})};
            }
            if (leg.lead0) {
                // (Taking off with its leader: from where it stood by it into its place, over its first JOIN_SECONDS.)
                const k0 = Math.min(Math.max((u * leg.seconds) / JOIN_SECONDS, 0), 1);
                const k = k0 * k0 * (3 - 2 * k0);
                p.x = at.x + leg.lead0.x + (p.x - at.x - leg.lead0.x) * k;
                p.z = at.z + leg.lead0.z + (p.z - at.z - leg.lead0.z) * k;
                p.y = (at.aloft ? at.y + leg.lead0.y : at.y) + (p.y - (at.aloft ? at.y + leg.lead0.y : at.y)) * k;
            }

            const blend = Math.max((u - settleAt) / (1 - settleAt), 0);
            let yaw = p.yaw;
            if (walkYaw !== null) {
                const turn = Math.atan2(Math.sin(walkYaw - p.yaw), Math.cos(walkYaw - p.yaw));
                yaw = p.yaw + turn * Math.min(blend * 4, 1);
            }
            return {x: p.x + (to.x - p.x) * blend, y: p.y + (to.y - p.y) * blend, z: p.z + (to.z - p.z) * blend, yaw, moving: walkYaw !== null ? blend > 0 : at.moving, aloft: at.aloft, ...up, beat: walkYaw !== null && blend > 0 ? "walk" : at.beat, ...(air && at.moving && walkYaw === null ? {air} : {})};
        }
        case "pause":
        default:
            return {x: from.x, y: from.y, z: from.z, yaw: leg.yaw ?? (Math.atan2(to.x - from.x, to.z - from.z) || 0), moving: false, aloft: false, ...up, beat: leg.beat};
    }
}

/** How fast an animal turns where it stands (rad/s, about 90 degrees a second). */
export const TURN_RATE = 1.6;

/**
 * Where an animal on a trip is at a world time (its foot point), which way it faces, and its beat, with its recipe's
 * episode laid over (`behaviour-recipes.ts`: a fishing dive, a contest, a dust bath; `act` says which).
 */
export function poseOnTrip(world: ScheduleWorld, trip: Trip, epochSeconds: number): RecipePose {
    return episodePose(world, trip, basePoseOnTrip(world, trip, epochSeconds), epochSeconds, KIT);
}

/** The marks (holes, mounds, hollows) an animal's recent recipe episodes left, still there now (pure: its last slots' trips). */
export function recipeMarks(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number, hoursAt: HoursAt, activity?: ArkBehaviourProfile["activity"] | null): RecipeMark[] {
    const trips: Trip[] = [];
    for (let back = 0; back < Math.ceil(MARK_SECONDS / SLOT_SECONDS) + 1; back++) trips.push(tripAt(world, profile, animal, epochSeconds - back * SLOT_SECONDS, hoursAt, activity));
    return marksOf(world, trips, epochSeconds, KIT);
}

/** Its coat from its recent recipe acts (wet after a bathe or dive, muddy after a wallow, dusty after a dust bath): pure. */
export function recipeCoat(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number, hoursAt: HoursAt, activity?: ArkBehaviourProfile["activity"] | null): RecipeCoat {
    const trips: Trip[] = [];
    for (let back = 0; back < Math.ceil(1200 / SLOT_SECONDS) + 1; back++) trips.push(tripAt(world, profile, animal, epochSeconds - back * SLOT_SECONDS, hoursAt, activity));
    return coatOf(world, trips, epochSeconds, KIT);
}

/** An animal's nest site this season (for a builder, until the props lane's nests are wired), or null. */
export function recipeNest(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number): Spot | null {
    return nestSiteOf(world, profile, animal, profile.slug, KIT, epochSeconds);
}

/** A trip's recipe episode at its destination, if it has one (for the tests and the review sample). */
export function tripEpisode(world: ScheduleWorld, trip: Trip): Episode | null {
    return episodeOfTrip(world, trip, KIT);
}

/** Where an animal on a trip is at a world time without its recipe's episode (the schedule's own pose). */
export function basePoseOnTrip(world: ScheduleWorld, trip: Trip, epochSeconds: number): TripPose {
    const into = epochSeconds - trip.start;
    if (into < trip.arrive - trip.start) {
        let t = Math.max(into, 0);
        for (const leg of trip.legs) {
            if (t < leg.seconds || leg === trip.legs[trip.legs.length - 1]) {
                const pose = legPose(world, leg, leg.seconds > 0 ? Math.min(t / leg.seconds, 1) : 1, trip, epochSeconds);
                // Setting off it turns from the way it was facing to its way over 0.8 s, not in an instant; a big turn is
                // made on the spot first (a turn leg, at TURN_RATE) before it walks.
                const since = Math.max(into, 0);
                const easing = trip.legs[0]?.turn ? trip.legs[0].seconds : 0.8;
                if (since < easing && trip.from.yaw !== undefined && !trip.shadow) {
                    let turn = pose.yaw - trip.from.yaw;
                    while (turn > Math.PI) turn -= Math.PI * 2;
                    while (turn < -Math.PI) turn += Math.PI * 2;
                    return {...pose, yaw: trip.from.yaw + turn * (since / easing)};
                }
                return pose;
            }
            t -= leg.seconds;
        }
    }
    if (trip.shadow) {
        const leg = trip.legs[trip.legs.length - 1];
        return legPose(world, leg, 1, trip, epochSeconds);
    }
    // At its destination: its beats (a step walks it on).
    const since = epochSeconds - trip.arrive;
    const to = trip.to;
    const stay = trip.stay;
    const last = trip.legs[trip.legs.length - 1];
    const lastPose = last ? legPose(world, last, 1, trip, epochSeconds) : null;
    const startYaw = lastPose ? lastPose.yaw : trip.from.yaw ?? stay[0]?.yaw ?? 0;
    const up = {nx: to.nx, ny: to.ny, nz: to.nz};
    if (!stay.length) {
        // (No beats, asleep say: it turns where it lies to the heading it settles to, at TURN_RATE, so its slot ends facing
        // the way the next one starts from. 2026-11-12: it kept the way it came in all slot and snapped round at the next.)
        // (Not under a recipe, whose own steps start from the way it came in.)
        const settleYaw = trip.recipe ? startYaw : trip.finish.yaw ?? startYaw;
        let turn = settleYaw - startYaw;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        const turned = Math.min(Math.max(since / Math.max(Math.abs(turn) / TURN_RATE, 0.8), 0), 1);
        return {x: to.x, y: to.y, z: to.z, yaw: startYaw + turn * turned, moving: false, aloft: false, ...up, beat: trip.doing === "sleep" || trip.doing === "to_roost" ? "sleep" : "rest"};
    }
    let i = 0;
    while (i + 1 < stay.length && stay[i + 1].at <= since) i++;
    const beat = stay[i];
    const before = i > 0 ? stay[i - 1] : {x: to.x, z: to.z, yaw: startYaw};
    const stepSeconds = beat.dur ?? (beat.beat === "play" ? 0.8 : beat.beat === "stalk" ? 2.5 : 1.2);
    const u = Math.min(Math.max((since - beat.at) / stepSeconds, 0), 1);
    // (Lane B4: a step gets going and stops, `rampedShare`, a fifth of its time each; it was at one speed from its first
    // frame to a dead stop.)
    const stepped0 = rampedShare(u, STEP_RAMP);
    const x = before.x + (beat.x - before.x) * stepped0;
    const z = before.z + (beat.z - before.z) * stepped0;
    const onGround = Math.abs(to.y - topAt(world, to.x, to.z)) < 0.05 && !(to.y < surfaceY(world, to.x, to.z));
    const y = onGround && (x !== to.x || z !== to.z) ? topAt(world, x, z) : to.y;
    const wrapTurn = (a: number) => {
        let v = a;
        while (v > Math.PI) v -= Math.PI * 2;
        while (v < -Math.PI) v += Math.PI * 2;
        return v;
    };
    const stepped = beat.x !== before.x || beat.z !== before.z;
    const moving = u < 1 && stepped;
    let yaw: number;
    if (stepped) {
        // A step faces where it goes (it turned into it over its first quarter), and only once it has stopped does it
        // turn to the heading it settles to (over 0.6 s): never walking sideways or backwards.
        const way = Math.atan2(beat.x - before.x, beat.z - before.z);
        const into = before.yaw + wrapTurn(way - before.yaw) * Math.min(u * 4, 1);
        // (Done before the next beat begins, so nothing snaps there.)
        const room = (stay[i + 1]?.at ?? Infinity) - beat.at - stepSeconds;
        const after = Math.min(Math.max((since - beat.at - stepSeconds) / Math.min(Math.max(room, 0.15), 0.6), 0), 1);
        yaw = u < 1 ? into : way + wrapTurn(beat.yaw - way) * after;
    } else {
        // Turning where it stands (on arriving: from the way it came in, a landing kept on its line) at TURN_RATE, in
        // no less than 0.8 s, and done before the next beat begins (the recipes lane saw a 149 degree landing snap).
        const turn = wrapTurn(beat.yaw - before.yaw);
        const room = (stay[i + 1]?.at ?? Infinity) - beat.at;
        const time = Math.min(Math.max(Math.abs(turn) / TURN_RATE, 0.8), Math.max(room, 0.15));
        yaw = before.yaw + turn * Math.min(Math.max((since - beat.at) / time, 0), 1);
    }
    return {x, y: i === stay.length - 1 && u >= 1 ? trip.finish.y : y, z, yaw, moving, aloft: false, ...up, beat: beat.beat};
}

/** In the air for the whole of a behaviour, not just its trip (none now: flights are goals, they land). */
export function airborneDoing(doing: ArkDoing): boolean {
    return doing === "fly" || doing === "soar";
}

// MARK: Predators and prey

/** Roosts an animal resting in is out of sight: a den, a burrow, a cave, a tree hole, a crevice. */
const ENCLOSED_ROOSTS: ReadonlySet<ArkRoost> = new Set<ArkRoost>(["den", "burrow", "cave", "tree_hole", "crevice"]);

/**
 * Whether its schedule has it settled at its roost now (asleep there, or resting there), and whether that roost hides
 * it (`enclosed`: a den, a burrow, a cave, a tree hole, a crevice). Pure and shared: the runtime lane's `arkOutside`
 * rotation (live-budget.ts) can hide these first, so an animal out of sight is plausibly at home, the same for every
 * viewer (it never depends on a viewer's budget).
 */
export function restingAtRoost(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number, hoursAt: HoursAt, activity?: ArkBehaviourProfile["activity"] | null): {resting: boolean; enclosed: boolean} {
    const trip = tripAt(world, profile, animal, epochSeconds, hoursAt, activity);
    if (epochSeconds < trip.arrive) return {resting: false, enclosed: false};
    const settled = trip.doing === "sleep" || trip.doing === "to_roost" || trip.doing === "rest";
    if (!settled) return {resting: false, enclosed: false};
    const roost = roostOf(world, profile, animal);
    const at = poseOnTrip(world, trip, epochSeconds);
    const home = Math.hypot(at.x - roost.x, at.z - roost.z) < Math.max(animal.length * 2, 1.5) && !at.moving;
    return {resting: home, enclosed: home && ENCLOSED_ROOSTS.has(profile.roost)};
}

/** The farthest any prey animal notices a predator in the shared layer (open ground, a big prey, a big hunter on the move). */
export const WARY_METRES = 55;

/** How far one can see across each zone, against open grassland (trees, reeds and undergrowth hide a hunter). */
const OPENNESS: Partial<Record<ArkZone, number>> = {grassland: 1.15, desert: 1.15, polar: 1.15, mountains: 1, seashore: 1, open_ocean: 1, coral_reef: 0.9, river_lake: 0.9, farm_garden: 0.9, wetland: 0.8, woodland: 0.65, rainforest: 0.5};

/**
 * How far a prey animal notices a predator (scene metres), on the reactive layer's sight model
 * (flee-envelope.md §2): its own sight by how it moves (a bird's best, a fish's short) and its size, how easy the
 * hunter is to see (bigger, and moving, more), and how open its zone is. A zebra sees a lion walking across the
 * grassland about 43 m off, one lying still about 24 m; a forest hides both at half that.
 */
export function waryRange(prey: ArkBehaviourProfile, zone: ArkZone, hunterLength: number, hunterMoving: boolean): number {
    const sight = prey.move === "fly" || prey.moves.includes("fly") ? 40 : aquatic(prey) ? 12 : 30;
    const size = 0.7 + (prey.size ?? 40) / 160;
    const seen = (hunterMoving ? 1.25 : 0.7) * (0.7 + 0.15 * Math.min(Math.max(hunterLength, 0.2), 3));
    return Math.min(Math.max(sight * size * seen * (OPENNESS[zone] ?? 0.8), 4), WARY_METRES);
}

/**
 * The nearest of its predators it can see at a moment (awake, within its `waryRange` of anywhere in its range: `near`
 * and `radius`, where it is about), or null. Pure: the predator's own schedule, which never depends on its prey's
 * (and never the prey's own earlier slots: measuring from where the last slot left it would chain back through every
 * slot before it). `d` is the distance from `near`.
 */
export function threatAt(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number, hoursAt: HoursAt, near: {x: number; z: number} = animal.home, radius = 0): {x: number; z: number; d: number} | null {
    if (!animal.threats?.length) return null;
    let best: {x: number; z: number; d: number} | null = null;
    for (const threat of animal.threats) {
        const trip = tripAt(world, threat.profile, threat.animal, epochSeconds, hoursAt, threat.activity);
        if (trip.doing === "sleep" || trip.doing === "to_roost") continue;
        const at = poseOnTrip(world, trip, epochSeconds);
        const d = Math.hypot(at.x - near.x, at.z - near.z);
        if (d - radius < waryRange(profile, animal.zone, threat.animal.length, at.moving) && d > 0.01 && (!best || d < best.d)) best = {x: at.x, z: at.z, d};
    }
    return best;
}

/**
 * Each animal's predators (`ScheduleAnimal.threats`), from the food links: only top predators (ones nothing aboard
 * eats), so no schedule ever waits on one that waits on it. Call after the homes are spaced; then `forgetSchedules`.
 */
export function wireThreats(list: Array<{slug: string; animal: ScheduleAnimal; profile: ArkBehaviourProfile; activity: ArkBehaviourProfile["activity"] | null | undefined}>, eats: (predator: string, prey: string) => boolean) {
    const slugs = Array.from(new Set(list.map((i) => i.slug)));
    const hunters = slugs.filter((p) => slugs.some((q) => q !== p && eats(p, q)));
    const top = new Set(hunters.filter((p) => !slugs.some((q) => q !== p && eats(q, p))));
    const tops = list.filter((i) => top.has(i.slug));
    // (Worked out once a kind, not once an animal: who threatens an animal depends only on its kind. The same lists.)
    const ofKind = new Map<string, ScheduleThreat[] | null>();
    for (const i of list) {
        let threats = ofKind.get(i.slug);
        if (threats === undefined) {
            const found = tops.filter((p) => p.slug !== i.slug && eats(p.slug, i.slug)).map((p) => ({animal: p.animal, profile: p.profile, activity: p.activity}));
            ofKind.set(i.slug, (threats = found.length ? found : null));
        }
        i.animal.threats = threats;
    }
}

/**
 * Its fixed roost (the map's: `scheduleRoost`) worked out the first time anything asks for it, not when its schedule is
 * made: the same spot, the cost (a den's search among the rocks) moved out of the mount to its first step, which the
 * scene spreads over frames. (Runtime's phone profile, 2026-11-11: 0.87 s of the mount at 3,137 animals.)
 */
export function withLazyRoost(animal: Omit<ScheduleAnimal, "roost">, find: () => Spot | null): ScheduleAnimal {
    let roost: Spot | null | undefined;
    Object.defineProperty(animal, "roost", {
        get: () => (roost === undefined ? (roost = find()) : roost),
        set: (value: Spot | null | undefined) => {
            roost = value;
        },
        enumerable: true,
        configurable: true
    });
    return animal as ScheduleAnimal;
}

/** The least a predator is kept from an animal it eats (or that eats it), beyond both their reaches: 20 m (owner's problem 6). */
export const SAFE_METRES = 20;
/**
 * The most the body-length part of a safe distance asks (m): six body lengths was for the old drawn sizes (a 3.5 m
 * whale, 21 m); at true size a 14 m humpback would need 84 m, more sea than the island has. Motion pass §3.
 */
export const SAFE_MOST = 40;

export type HomeInput = {id: string; slug: string; home: {x: number; z: number}; length: number; walkable: (x: number, z: number) => boolean};
export type SpacedHome = {home: {x: number; z: number}; range: number | null; prey: {x: number; z: number} | null};

/**
 * Predators' home ranges kept a safe distance from their prey's (visual only; the server decides every meal).
 * `reachOf(id)` is how far an animal (a leader with its group round it) can get from its home. A predator whose reach
 * comes within the safe distance (6 body lengths, at most `SAFE_MOST` and at least `SAFE_METRES`) of the reach of an animal it eats (or of one that
 * eats it) is moved to the nearest clear walkable spot, searching outward to 120 m; where none is clear, it goes to
 * the clearest spot found and both ranges shrink until they keep the distance. Biggest predators first. Returns the
 * moved homes and range caps (prey whose range shrank are in it too, with their own home).
 */
export function spaceHomes(animals: HomeInput[], eats: (predator: string, prey: string) => boolean, reachOf: (id: string) => number): Map<string, SpacedHome> {
    const job = spaceHomesTasks(animals, eats, reachOf);
    return new SlicedBuild(job.tasks, job.finish).run();
}

/**
 * `spaceHomes` as tasks, one predator each, biggest first (`behaviour-build.ts`: about 6 ms a frame), with the same
 * result to the last digit as the loop it replaced (2026-11-11, the backfill scale: 3,140 animals took 3.4 s on a
 * phone). The same rule, worked out more cheaply:
 * - who eats whom once per pair of kinds, and each animal's prey and enemies from an index by kind (was every pair
 *   of animals, for every animal: 5 million `eats` calls at 3,140 animals);
 * - a spot's clearance (its distance to the nearest enemy's reach) from a grid of the enemies' homes, nearest cells
 *   first, stopping where no further enemy can be nearer: the same minimum;
 * - a candidate spot's walkable test (the map's habitat, a ground sample each) only when the spot could change
 *   anything: better than the best so far, or clear.
 */
export function spaceHomesTasks(animals: HomeInput[], eats: (predator: string, prey: string) => boolean, reachOf: (id: string) => number): {tasks: BuildTask[]; finish: () => Map<string, SpacedHome>} {
    const out = new Map<string, SpacedHome>();
    const home = new Map(animals.map((a) => [a.id, {...a.home}]));
    const reach = new Map(animals.map((a) => [a.id, reachOf(a.id)]));
    const sorted = [...animals].sort((a, b) => b.length - a.length || a.id.localeCompare(b.id));
    // Each kind's animals in their given order (the order the old filters kept), and who eats whom by kind.
    const order = new Map(animals.map((a, i) => [a.id, i]));
    const byKind = new Map<string, HomeInput[]>();
    for (const a of animals) {
        const list = byKind.get(a.slug);
        if (list) list.push(a);
        else byKind.set(a.slug, [a]);
    }
    const kinds = Array.from(byKind.keys());
    // Each kind's prey kinds and enemy kinds (it eats them, or they eat it), worked out once per kind.
    const preyKindsOf = new Map<string, string[]>();
    const enemyKindsOf = new Map<string, string[]>();
    const preyKinds = (p: string) => {
        let list = preyKindsOf.get(p);
        if (!list) preyKindsOf.set(p, (list = kinds.filter((k) => eats(p, k))));
        return list;
    };
    const enemyKinds = (p: string) => {
        let list = enemyKindsOf.get(p);
        if (!list) {
            const prey = new Set(preyKinds(p));
            enemyKindsOf.set(p, (list = kinds.filter((k) => prey.has(k) || eats(k, p))));
        }
        return list;
    };
    const ofKinds = (list: string[], not: HomeInput) => {
        const found: HomeInput[] = [];
        for (const kind of list) for (const a of byKind.get(kind)!) if (a.id !== not.id) found.push(a);
        return found.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    };
    const GRID = 12;
    // Each predator a task that resumes (2026-11-11: a predator's whole search, 40 rings of 24 spots, each a habitat
    // test, was one 0.44 s task on the phone): its setup, then one ring of its search a call, then its ending. The same
    // steps in the same order as all at once.
    const tasks: BuildTask[] = sorted.map((predator) => {
        let resume: (() => boolean) | null = null;
        return () => {
            if (!resume) resume = predatorSearch(predator);
            return resume();
        };
    });
    function predatorSearch(predator: HomeInput): () => boolean {
        const itsPrey = preyKinds(predator.slug);
        if (!itsPrey.length) return () => true;
        const prey = ofKinds(itsPrey, predator);
        if (!prey.length) return () => true;
        const enemies = ofKinds(enemyKinds(predator.slug), predator);
        const safeTo = (other: HomeInput) => Math.max(SAFE_METRES, Math.min(Math.max(predator.length, other.length) * 6, SAFE_MOST));
        const need = (other: HomeInput) => safeTo(other) + reach.get(predator.id)! + reach.get(other.id)!;
        // The enemies' homes in a grid (as they are now: earlier predators may have moved), and the most any needs.
        // (Each enemy as numbers: its home and what it needs do not change during this predator's search.)
        const cells = new Map<number, number[]>();
        const cellKey = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096);
        let needMax = 0;
        let minI = Infinity;
        let maxI = -Infinity;
        let minJ = Infinity;
        let maxJ = -Infinity;
        for (const o of enemies) {
            const at = home.get(o.id)!;
            const i = Math.floor(at.x / GRID);
            const j = Math.floor(at.z / GRID);
            const key = cellKey(i, j);
            const needs = need(o);
            const list = cells.get(key);
            if (list) list.push(at.x, at.z, needs);
            else cells.set(key, [at.x, at.z, needs]);
            needMax = Math.max(needMax, needs);
            minI = Math.min(minI, i);
            maxI = Math.max(maxI, i);
            minJ = Math.min(minJ, j);
            maxJ = Math.max(maxJ, j);
        }
        /**
         * min over enemies of (distance to its home − what it needs), exactly: rings of cells outward till none can be
         * less. With `above`, it may stop at the first value at or below it (returning that value): the search only asks
         * whether a spot beats the best so far.
         */
        const clearance = (x: number, z: number, above = -Infinity) => {
            let least = Infinity;
            if (!enemies.length) return least;
            const ci = Math.floor(x / GRID);
            const cj = Math.floor(z / GRID);
            const last = Math.max(ci - minI, maxI - ci, cj - minJ, maxJ - cj);
            for (let r = 0; r <= last; r++) {
                if ((r === 0 ? 0 : (r - 1) * GRID) - needMax >= least) break;
                for (let di = -r; di <= r; di++) {
                    const ring = Math.abs(di) === r;
                    for (let dj = -r; dj <= r; dj += ring ? 1 : 2 * r) {
                        const list = cells.get(cellKey(ci + di, cj + dj));
                        if (!list) continue;
                        for (let n = 0; n < list.length; n += 3) {
                            const v = Math.hypot(list[n] - x, list[n + 1] - z) - list[n + 2];
                            if (v < least) {
                                least = v;
                                if (least <= above) return least;
                            }
                        }
                    }
                }
            }
            return least;
        };
        const start = home.get(predator.id)!;
        let best = {x: start.x, z: start.z, c: clearance(start.x, start.z)};
        let found = false;
        let d = 3;
        const mx = best.c < 0 ? prey.reduce((sum, p) => sum + home.get(p.id)!.x, 0) / prey.length : 0;
        const mz = best.c < 0 ? prey.reduce((sum, p) => sum + home.get(p.id)!.z, 0) / prey.length : 0;
        const away = Math.atan2(start.x - mx, start.z - mz);
        /** One ring of its search; true once the search is over. */
        const ring = (): boolean => {
            if (d > 120 || found) return true;
            for (let k = 0; k < 24 && !found; k++) {
                const a = away + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.27;
                const x = start.x + Math.sin(a) * d;
                const z = start.z + Math.cos(a) * d;
                // (Its walkable test only where it could matter: a spot no better than the best and not clear
                // changes nothing, walkable or not.)
                const c = clearance(x, z, best.c);
                if (c <= best.c && c < 0) continue;
                if (!predator.walkable(x, z)) continue;
                if (c > best.c) best = {x, z, c};
                if (c >= 0) found = true;
            }
            d += 3;
            return d > 120 || found;
        };
        const searched = best.c < 0;
        /** After the search (if it needed one): its home, the shrinking where nowhere was clear, and its result. */
        const ending = () => {
        if (searched) {
            home.set(predator.id, {x: best.x, z: best.z});
            if (!found) {
                // Nowhere clear: both ranges shrink until they keep the distance (half a metre at least).
                for (const other of enemies) {
                    const at = home.get(other.id)!;
                    const d = Math.hypot(at.x - best.x, at.z - best.z);
                    const free = d - safeTo(other);
                    const total = reach.get(predator.id)! + reach.get(other.id)!;
                    if (free >= total) continue;
                    const k = Math.max(free, 1) / total;
                    reach.set(predator.id, Math.max(reach.get(predator.id)! * k, 0.5));
                    reach.set(other.id, Math.max(reach.get(other.id)! * k, 0.5));
                    const prior = out.get(other.id);
                    out.set(other.id, {home: prior?.home ?? {...at}, range: reach.get(other.id)!, prey: prior?.prey ?? null});
                }
            }
        }
        const at = home.get(predator.id)!;
        const nearest = [...prey].sort((a, b) => Math.hypot(home.get(a.id)!.x - at.x, home.get(a.id)!.z - at.z) - Math.hypot(home.get(b.id)!.x - at.x, home.get(b.id)!.z - at.z))[0];
        const shrunk = reach.get(predator.id)! < reachOf(predator.id) - 1e-9;
        out.set(predator.id, {home: {...at}, range: shrunk ? reach.get(predator.id)! : out.get(predator.id)?.range ?? null, prey: {...home.get(nearest.id)!}});
        };
        return () => {
            if (searched && !ring()) return false;
            ending();
            return true;
        };
    }
    return {tasks, finish: () => out};
}

/** What the recipe engine may use of the schedule (passed in, so it imports no schedule code). */
const KIT: ScheduleKit = {
    placeNear,
    spotOf,
    groundSpot,
    rangeSpot,
    waterSpot,
    roostOf,
    tripAt: (world, profile, animal, epochSeconds, hoursAt, activity) => tripAt(world, profile, animal, epochSeconds, hoursAt, activity),
    basePose: basePoseOnTrip,
    flies,
    aquatic,
    floats
};
