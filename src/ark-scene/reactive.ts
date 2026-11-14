/**
 * The local reactive layer (visual only): what an animal near the camera
 * does moment to moment on top of its shared behaviour. It turns its head to
 * look round, to a sound, to another animal, to the camera; it sees or hears
 * a predator and takes it for what it is doing (the behaviours pass, lane B2,
 * 2026-11-14; flee-envelope.md §3): one lying up or going by it watches and
 * then tolerates, feeding on warily; one coming, creeping or chasing it
 * watches, calls the alarm at, and runs from when it is near, for cover, the
 * water, a tree or with its herd, and the alarm runs through the group; big
 * and armed animals stand their ground, cryptic ones hold still until
 * flushed, burrow dwellers go to ground; a predator that is not acting out a
 * server meal watches its prey, stalks it only when it is hunting, and never
 * catches anything; parents put themselves between their young and a threat; a
 * dominant animal drinks first; a sentinel keeps watch while the rest feed;
 * curious, sharp animals come to look at the camera; the young play; rain
 * sends animals to shelter; a squirrel buries a nut and comes back to it.
 *
 * Two layers. The shared layer (`behaviour-schedule.ts`) says where each
 * animal is and what it is broadly doing, from the time and its id, the same
 * for every viewer and the livestream. This layer only adds to it, for the
 * animals close to the camera, and may differ a little between viewers. It
 * never contradicts the shared layer:
 *   - an animal the shared layer has asleep stays asleep (no look, no call;
 *     any offset only eases back) unless something wakes it: asleep it
 *     perceives less (its eyes shut: sight to a few body lengths; hearing
 *     dulled; smell as awake), and a threat inside its flight distance, an
 *     alarm call it hears, its group running, or the camera coming at it
 *     close (by its species' flight distance; a still camera never) wake it
 *     with a start (`woke`, `startled`: the scene's quick get-up). Awake
 *     here, it reacts as any awake animal; calm again a while later, it goes
 *     back to sleep. The ones keeping watch (the shared layer's night watch)
 *     are awake, with all their senses;
 *   - an animal acting out a server event (an act, a moment, the visitor) is
 *     left entirely to it;
 *   - an animal in the air is left to its flight;
 *   - every offset stays inside the animal's envelope round its shared
 *     position (`reactiveEnvelope`), and eases back when the reaction ends.
 * Nothing here decides a meal, a birth or a death, and nothing reaches the
 * server: a stalking predator always stops short (`minGap`).
 *
 * Choices are utility scores: needs that rise and fall (energy, thirst,
 * hunger, safety, company, curiosity, comfort) against the hour, the weather
 * and what is around, weighted by the animal's seeded personality
 * (`animalPersonality`), its intelligence (how many kinds of behaviour it
 * has, `intelligence-profile.ts`) and a seeded, individually-timed noise, so
 * no two animals of a herd do the same thing at the same moment.
 *
 * Pure apart from the state it keeps per animal: given the same inputs and
 * the same frames it does the same thing (the tests rely on it).
 */

import {bodyMass, canTake, foodLinked, huntCompany, huntsByBuild, type ArkIntelProfile} from "@/ark-scene/intelligence-profile";
import {headLimits as headLimitsOf, lookAngles, stepHead, wrapAngle, type HeadLimits} from "@/ark-scene/head-look";
import {animalPersonality, unit, type ArkPersonality} from "@/lib/ark-clock";
import {alarmLevel} from "@/lib/ark-sound";
import {accelTime, fleePace} from "@/ark-scene/locomotion/flee";

export type Vec3 = {x: number; y: number; z: number};

// MARK: Inputs

/** What the shared layer says now (its pose and its doing). */
export type SharedPose = {
    x: number;
    y: number;
    z: number;
    yaw: number;
    moving: boolean;
    aloft: boolean;
    doing: string;
    /** The place (attach point id) its trip goes to, when it has one: a water edge, a flower, a perch. */
    spot?: string | null;
};

export type ReactiveInput = {
    id: string;
    slug: string;
    plan: string;
    /** Drawn length (m). */
    length: number;
    /** The size and dominance stats (0–100). */
    size: number | null;
    dominance: number | null;
    /** The speed stat (0–100): how fast it runs from a threat (`fleeSpeed`). Missing: the middle of the scale. */
    speed?: number | null;
    /** Its first rig set's fastest ground clip (`behaviours.json` `gait`). Not read here since the behaviours pass (`fleeSpeed`); the scene still passes it. */
    gait?: number | null;
    /**
     * Its walk and run clips' own paces (body lengths a second; `behaviours.json` `walkPace`, `runPace`): an unhurried move
     * (a look closer, a step back, a drift home) goes no faster than its walk's pace cap, the schedule's own rule.
     */
    walkPace?: number | null;
    runPace?: number | null;
    social: string;
    diet: string;
    intel: ArkIntelProfile;
    shared: SharedPose;
    /** The shared layer has it asleep. */
    asleep: boolean;
    /** Acting out a server event (an act, a moment, the visitor): the reactive layer leaves it alone. */
    acting: boolean;
    /** A young one's parent (`ark-age.ts` follow), when it keeps to one. */
    parentId?: string | null;
    /** 0–1 how much it plays (`ark-age.ts`), on top of its species'. */
    youngPlay?: number;
    /** Its head's height above its feet (m). */
    headHeight?: number;
    /** Fixed to its spot (a barnacle, a sponge, a limpet: the behaviour profile's move "sessile"): never moved. */
    sessile?: boolean;
    /** The one the viewer has selected or follows: the camera coming to it never wakes it. */
    watched?: boolean;
    /**
     * Running down its prey (a server meal's chase, `acts.ts`): a threat to everything it could eat and a fright to
     * anything smaller close by, awake or not in the shared layer, noticed at once; they scatter (`SCATTER`).
     */
    chasing?: boolean;
    /** Where it sleeps (`behaviours.json` roost): one that lives in a burrow, a den or a crevice goes to ground there first. */
    roost?: string | null;
    /**
     * Kept by people (the town island's `area`: a house pet, a farm animal, a zoo animal). Kept animals are used to
     * people (the camera never drives them off or wakes them) and to the animals they live among; a zoo animal has
     * its enclosure's fence between it and everything outside (`apart`).
     */
    kept?: "house" | "farm" | "zoo" | null;
};

export type ReactiveWeather = {rain: number; wind: number; windDirection: number; fog: number; storm: number; lightning?: number};

export type ReactiveWorld = {
    /** Seconds (world time). */
    now: number;
    dt: number;
    /** The island's hour (0–24). */
    hours: number;
    /** 0 day … 1 full night. */
    night: number;
    weather: ReactiveWeather;
    camera: Vec3 | null;
    /** 0 blocked … 1 clear: terrain and dense vegetation between two points (eye heights). */
    sight?: (from: Vec3, to: Vec3) => number;
    /** The nearest refuge of a kind within r of a point, or null. */
    refuge?: (x: number, z: number, kind: RefugeKind, r: number) => {x: number; z: number} | null;
};

export type RefugeKind = "cover" | "water" | "tree" | "shade";

// MARK: Outputs

export type ReactiveAction =
    | "off"
    | "asleep"
    | "aloft"
    | "scan"
    | "feed"
    | "drink"
    | "look_kin"
    | "approach_kin"
    | "groom"
    | "doze"
    | "watch_camera"
    | "investigate_camera"
    | "back_off_camera"
    | "play"
    | "shelter"
    | "use_tool"
    | "cache_bury"
    | "cache_return"
    | "follow_mixed"
    | "wait_turn"
    | "sentinel"
    | "alert"
    | "freeze"
    | "flee"
    | "threat_display"
    | "play_dead"
    | "shield_young"
    | "hide_behind_parent"
    | "stalk"
    | "watch_prey"
    | "recover"
    | "startle"
    | "withdraw";

export type ReactiveOut = {
    /** The offset from the shared position (m, world x and z). */
    dx: number;
    dz: number;
    /** Extra body yaw on top of the shared yaw (radians). */
    bodyYaw: number;
    /** The head's yaw and pitch relative to the body (radians), and how much of it to draw (0 none … 1). */
    headYaw: number;
    headPitch: number;
    headWeight: number;
    /** 0 standing … 1 low (freezing, sheltering, stalking). */
    crouch: number;
    action: ReactiveAction;
    /** It calls the alarm this frame (the sound scheduler's `alarm` mood starts now). */
    called: boolean;
    /** 0–1 how alarmed it is now (the sound scheduler's alarm mood while > 0.3). */
    alarmed: number;
    /** What it is looking at: an animal's id, "camera", "sound", "spot", or null (scanning). */
    looking: string | null;
    /** The shared layer has it asleep, and something woke it here (it gets up and reacts; later it lies down again). */
    woke?: boolean;
    /** Woken this last moment: a startled get-up (the scene's quick one). */
    startled?: boolean;
    /** How it is taking a predator it knows of, when it is (for the tests, the audit and the debug line): see `ReactiveResponse`. */
    response?: ReactiveResponse | null;
};

/**
 * What a prey animal makes of a predator it has noticed (flee-envelope.md §3):
 *   - `tolerate`: the predator is resting or going by at a distance; it goes on with its own business, warily (more
 *     looks up, some of them at the predator), from where it is;
 *   - `watch`: head up, standing, on the predator (it has just seen it, or it is coming);
 *   - `move_off`: a resting or passing predator a little too near: it walks away, looking back;
 *   - `bunch`: a herd animal closing up with its group while it watches;
 *   - `freeze`: a cryptic animal holding still until the predator is almost on it;
 *   - `bolt`: running; `hold`: stopped where it ran to, watching;
 *   - `ground`: one that lives in a burrow, low at its refuge;
 *   - `stand`: a big or armed animal facing the predator; `ball`: an armoured one pulled in; `dead`: playing dead;
 *   - `shield`: a parent in front of its young, or a young one behind its parent.
 */
export type ReactiveResponse = "tolerate" | "watch" | "move_off" | "bunch" | "freeze" | "bolt" | "hold" | "ground" | "stand" | "ball" | "dead" | "shield";

/** Asleep, how much of its sight it keeps (its eyes are shut: movement close by), and of its hearing. Smell is as awake. */
export const SLEEP_SIGHT = 0.12;
export const SLEEP_HEARING = 0.4;
/** How long it stays up once woken (s, plus its own seeded share), while nothing else keeps it up. */
const WOKE_SECONDS = 18;

/** Head limits per plan and species, worked out once (they never change). */
const LIMITS = new Map<string, HeadLimits>();
function headLimits(plan: string, slug: string): HeadLimits {
    const key = `${plan}|${slug}`;
    let hit = LIMITS.get(key);
    if (!hit) {
        hit = headLimitsOf(plan, slug);
        LIMITS.set(key, hit);
    }
    return hit;
}

const ZERO_OUT: ReactiveOut = Object.freeze({dx: 0, dz: 0, bodyYaw: 0, headYaw: 0, headPitch: 0, headWeight: 0, crouch: 0, action: "off", called: false, alarmed: 0, looking: null}) as ReactiveOut;

// MARK: The budget per quality tier

export type ReactiveTier = "high" | "medium" | "low" | "lite";
export type ReactiveBudget = {
    /** Only animals this close to the camera (m) get the layer. */
    radius: number;
    /** At most this many of them (the nearest). */
    agents: number;
    /** Each re-perceives once every this many frames (staggered by id). */
    perceiveEvery: number;
    /** Samples along a line of sight. */
    sightSamples: number;
    /** How far it looks for others (m): the longest sight it may use. */
    reach: number;
};
export const REACTIVE_BUDGET: Record<ReactiveTier, ReactiveBudget> = {
    high: {radius: 70, agents: 90, perceiveEvery: 2, sightSamples: 8, reach: 90},
    medium: {radius: 50, agents: 48, perceiveEvery: 3, sightSamples: 6, reach: 70},
    low: {radius: 32, agents: 20, perceiveEvery: 4, sightSamples: 4, reach: 50},
    lite: {radius: 0, agents: 0, perceiveEvery: 8, sightSamples: 0, reach: 0}
};

// MARK: The envelope

/**
 * How far the reactive layer may move an animal from its shared position (m): a small step for its own business,
 * more to get away from a predator. The behaviour lane owns the number (it can replace this function: the scene
 * passes `envelope` to the layer); it is never more than a few body lengths, and the animal always comes back.
 */
export type EnvelopeFn = (input: ReactiveInput, fleeing: boolean) => number;
export const reactiveEnvelope: EnvelopeFn = (input, fleeing) => {
    if (input.acting || input.shared.aloft || input.sessile) return 0;
    const base = Math.min(Math.max(0.8 * input.length + 0.4, 0.5), 2.5);
    if (!fleeing) return base;
    return Math.min(Math.max(3.5 * input.length + 1.5, 2), 9);
};

/** The fastest it moves on a reaction that isn't a flight (m/s): its walk's pace cap (1.2), or its run's when hurried. Unknown: no cap. */
export function paceCap(input: ReactiveInput, hurried: boolean): number {
    const walk = input.walkPace ?? null;
    if (!walk || walk <= 0) return Infinity;
    const length = Math.max(input.length, 0.01);
    const run = hurried && input.runPace && input.runPace > walk ? input.runPace : walk;
    return length * run * 1.2;
}

/**
 * How fast it runs from a threat (m/s): the locomotion lane's held flee for its body (`fleePace`: about two thirds of
 * the allometric sprint for its size and plan, moved by its speed stat), the pace the prey of a meal's chase runs at
 * (`acts.ts` `setChasePaces`), so an animal bolts the same whether a viewer's camera is by or not. A dash is short (the
 * flee reach), so never more than 8 m/s. (Before the behaviours pass it was capped by `gait`, the first rig set's
 * clip figure: a chital fled at 0.15 m/s, an alpine marmot at 0.06, an impala at 1.1.)
 */
export function fleeSpeed(input: ReactiveInput): number {
    return Math.min(Math.max(fleePace({plan: input.plan, slug: input.slug, length: input.length, speedStat: input.speed}), 0.05), 8);
}

/** What its predator is doing, as the prey reads it. */
export type Menace = "resting" | "passing" | "coming" | "stalking" | "chasing";
const MENACE_SCALE: Record<Menace, number> = {resting: 0.6, passing: 1, coming: 1.3, stalking: 1.5, chasing: 1.6};
const MENACE_RANK: Record<Menace, number> = {resting: 0, passing: 1, coming: 2, stalking: 3, chasing: 4};

/**
 * A predator's state as its prey reads it: running something down; creeping its way (the schedule's `stalk`, or the
 * local stalk at this very animal: `stalkingMe`); walking at it (heading within 40 degrees); walking by; or still
 * (lying up, sitting, grooming, drinking, on a kill).
 */
export function menaceOf(me: ReactiveInput, threat: ReactiveInput, stalkingMe = false): Menace {
    if (threat.chasing) return "chasing";
    const toMe = Math.atan2(me.shared.x - threat.shared.x, me.shared.z - threat.shared.z);
    const facing = Math.abs(wrapAngle(toMe - threat.shared.yaw));
    if (stalkingMe || (threat.shared.doing === "stalk" && facing < 1)) return "stalking";
    if (!threat.shared.moving) return "resting";
    return facing < 0.7 ? "coming" : "passing";
}

/**
 * How alarming this threat is, as a factor on the flight distance: a predator bigger than it, and what the predator is
 * doing (`menaceOf`): one chasing 1.6, one stalking it 1.5 (once seen), one walking at it 1.3, one walking by 1, one
 * lying up or standing 0.6. (Flight initiation distance grows with the predator's size and the directness and speed
 * of its approach: Stankowich & Blumstein 2005, Proc. R. Soc. B 272; prey let a resting predator much nearer than a
 * hunting one: FitzGibbon 1994 on gazelles and cheetahs.)
 */
export function threatScale(me: ReactiveInput, threat: ReactiveInput | null | undefined, menace?: Menace): number {
    if (!threat) return 1;
    const ratio = Math.max(threat.length, 0.05) / Math.max(me.length, 0.05);
    // Its own size: 1; twice its length 1.25; four times or more 1.5; half its length or less 0.75.
    const size = Math.min(Math.max(1 + 0.25 * Math.log2(ratio), 0.75), 1.5);
    const state = menace ?? menaceOf(me, threat);
    // (A predator in full chase is the most alarming of all, whatever its size.)
    return (state === "chasing" ? Math.max(size, 1) : size) * MENACE_SCALE[state];
}

/**
 * How much of its reactive offset an animal may take (0–1) without leaving its element. A land animal is never pushed
 * into the water; a water animal (one swimming or walking under the surface, or floating on it) is never pushed onto a
 * shore, nor over a floor that rises above its body (out of its depth band: `schedule-water.ts` on the release has the
 * band; the band's base is passed in as `base`). The offset halves up to three times until the end point is right, else
 * none. Pure: `isWater` and `ground` are the scene's (the sampler's water test, the terrain's height, below 0 is water).
 */
export function offsetShare(
    at: {x: number; z: number; base: number},
    dx: number,
    dz: number,
    element: "land" | "water" | "free",
    isWater: (x: number, z: number) => boolean,
    ground: (x: number, z: number) => number
): number {
    if (element === "free" || (!dx && !dz)) return 1;
    const fits = (k: number) => {
        const x = at.x + dx * k;
        const z = at.z + dz * k;
        if (element === "land") return !isWater(x, z);
        // In the water, and the floor there still under its lowest point (a hand's breadth of play for a floor walker).
        return isWater(x, z) && ground(x, z) < 0 && ground(x, z) <= at.base + 0.05;
    };
    let k = 1;
    for (let i = 0; i < 3 && !fits(k); i++) k *= 0.5;
    return fits(k) ? k : 0;
}

/** How close a stalking predator ever gets to its prey (m): never close enough to catch it. */
export function minGap(predator: ReactiveInput, prey: ReactiveInput): number {
    return Math.max(1.6 * (predator.length + prey.length), prey.intel.flight * 0.6, 1.2);
}

// MARK: Perception

export type Perceived = {
    id: string;
    how: "sight" | "hearing" | "smell";
    distance: number;
    x: number;
    z: number;
    threat: boolean;
    prey: boolean;
    /** A threat's distance over how alarming it is (`threatScale`), worked out as it is perceived: the most pressing threat is the one it answers. */
    press: number;
};

const LOUD_PLANS = new Set(["quadruped", "primate", "walking_bird", "flightless_bird"]);

/**
 * Whether `me` could perceive `other` now (sight in range, in front enough, with a clear line; or hearing; or smell
 * with the wind from it). Night shortens sight by the species' night vision; rain dulls hearing; fog shortens sight.
 */
export function perceive(me: ReactiveInput, other: ReactiveInput, world: ReactiveWorld, sentinelBoost = 1, samples = 6, clearLine?: (eye: Vec3, target: Vec3) => number, allRound = false): Perceived["how"] | null {
    const dx = other.shared.x - me.shared.x;
    const dz = other.shared.z - me.shared.z;
    const d = Math.hypot(dx, dz);
    const p = me.intel;
    const nightFactor = 1 - world.night * (1 - p.night);
    const fog = 1 - 0.6 * world.weather.fog;
    // Moving things stand out; a still one less, and one creeping up low (the schedule's `stalk`) least of all; bigger
    // ones more; a bird overhead is a silhouette on the sky.
    const creeping = other.shared.doing === "stalk" && !other.chasing;
    const conspicuous = (creeping ? 0.5 : other.shared.moving ? 1.25 : 0.7) * (0.7 + Math.min(other.length, 3) * 0.15) * (other.shared.aloft ? 1.8 : 1);
    const sightRange = p.sight * nightFactor * fog * conspicuous * sentinelBoost;
    if (d < sightRange) {
        // Prey see nearly all round; a hunter's eyes face forward.
        const hunter = p.hunt.length > 0 && !p.hunt.every((h) => h === "filter" || h === "scavenge");
        const ahead = Math.abs(wrapAngle(Math.atan2(dx, dz) - me.shared.yaw));
        const fov = hunter ? 1.6 : 2.7;
        // (The one on sentinel watch sweeps its head all round: no blind side.)
        if (allRound || ahead <= fov || d < me.length * 2) {
            const eye = {x: me.shared.x, y: me.shared.y + (me.headHeight ?? me.length * 0.5), z: me.shared.z};
            const target = {x: other.shared.x, y: other.shared.y + other.length * 0.4, z: other.shared.z};
            const line = clearLine ?? world.sight;
            const clear = line && samples > 0 ? line(eye, target) : 1;
            if (clear > 0.45) return "sight";
        }
    }
    const loud = other.shared.moving && !creeping ? (LOUD_PLANS.has(other.plan) ? 1 : 0.6) * (1 + Math.min(other.length, 3) * 0.2) : 0.25;
    const hearingRange = p.hearing * loud * (1 - 0.5 * world.weather.rain) * (1 - 0.3 * world.weather.wind);
    if (d < hearingRange) return "hearing";
    // Scent carries best on a steady breeze; a gale or a storm breaks it up (and rain washes it out).
    const scent = (0.5 + Math.min(world.weather.wind, 0.5)) * (1 - 0.6 * world.weather.storm) * (1 - 0.3 * world.weather.rain);
    if (d < p.smell * scent && d > 0.01) {
        // The wind blows from it to me: its direction (toward which it blows) points from other to me.
        const toMe = {x: -dx / d, z: -dz / d};
        const along = Math.cos(world.weather.windDirection) * toMe.x + Math.sin(world.weather.windDirection) * toMe.z;
        if (along > 0.3) return "smell";
    }
    return null;
}

// MARK: State per animal

type Needs = {energy: number; thirst: number; hunger: number; safety: number; social: number; curiosity: number; comfort: number};
type Memory = {
    /** Predators seen: where, when, how strongly remembered (grows with each sighting, by how fast it learns). */
    predators: Array<{slug: string; x: number; z: number; t: number; strength: number}>;
    /** Where something startled it (the camera too close, a thunderclap). */
    disturbances: Array<{x: number; z: number; t: number}>;
    /** Its good spots: water, food, its roost, and a cache it made. */
    spots: {water?: {x: number; z: number}; food?: {x: number; z: number}; roost?: {x: number; z: number}; cache?: {x: number; z: number; t: number}};
};

type Agent = {
    id: string;
    personality: ArkPersonality;
    offset: {x: number; z: number};
    head: {yaw: number; pitch: number};
    bodyYaw: number;
    crouch: number;
    needs: Needs;
    memory: Memory;
    /**
     * The threat it knows of (id, where it was last perceived, when), and when it first noticed it; what the predator
     * was doing when it last looked (`menace`); since when it has been watching it afresh (`watchFrom`); when it
     * settled to tolerating it and how far off it was then (`settledAt`, `settledD`); whether it has called at it.
     */
    threat: {id: string; slug: string; x: number; z: number; seen: number; noticed: number; menace: Menace; watchFrom: number; settledAt: number | null; settledD: number; called: boolean} | null;
    /** When it last had a danger on (a threat it was not tolerating, or an alarm), and how bad the scare was (0–1): how long it takes to calm. */
    dangerAt: number;
    scare: number;
    /** What it stays wary of while it goes about its business: a predator it tolerates (its id), or the spot of a scare just over (id null); until when. */
    wary: {x: number; z: number; id: string | null; until: number} | null;
    /** Its dash from a threat: when it began, where to (an offset), and when it got there (it then holds). */
    dash: {at: number; x: number; z: number; doneAt: number | null} | null;
    /** A cryptic animal flushed from its freeze (it runs, it does not sit down again in front of the same predator). */
    flushed: boolean;
    /** Its way with a predator close by, worked out once (`styleOf`). */
    style: "ball" | "flush" | "ground" | "bolt" | null;
    /** How it is taking a predator now (the output's `response`). */
    response: ReactiveResponse | null;
    /** When it last heard an alarm (and where from), and when it reacts to it. */
    heard: {x: number; z: number; tx: number; tz: number; at: number; reactAt: number; caller: string; threat: string; flight: boolean} | null;
    /** The prey it is watching or stalking. */
    prey: {id: string; x: number; z: number; seen: number} | null;
    /** The last time it reacted (alarm level counts from here) and called. */
    reactedAt: number;
    calledAt: number;
    /** Its current calm choice, until when, and its own look target. */
    choice: ReactiveAction;
    choiceUntil: number;
    lookAt: Vec3 | null;
    lookLabel: string | null;
    scanUntil: number;
    scanIndex: number;
    /** Perception result, kept between its perception frames. */
    perceived: Perceived[];
    nextPerceive: number;
    lastSeenAt: number;
    mode: ReactiveAction;
    /** On sentinel duty now (its group's turn). */
    onWatch: boolean;
    /** 0–1: how used it is to the camera (still near it a few seconds: it goes back to its business), and whether the camera is coming at it now. */
    camHab: number;
    camApproach: boolean;
    /** The camera is within its notice range now (for the moment it first notices it). */
    camNear: boolean;
    /** Asleep in the shared layer and woken here: when, until when (while it stays calm), and by what. */
    woke: {at: number; until: number; why: "threat" | "alarm" | "kin" | "camera"} | null;
    /** Its senses asleep (its profile with sight and hearing cut), made once. */
    dozing: ReactiveInput | null;
    /** Where its body is turning to (radians off the shared heading), and until when it keeps a move's facing after the move eases off. */
    bodyGoal: number;
    moveHold: number;
};

function newAgent(id: string, now: number): Agent {
    const u = (k: string) => unit(id, k);
    return {
        id,
        personality: animalPersonality(id),
        offset: {x: 0, z: 0},
        head: {yaw: 0, pitch: 0},
        bodyYaw: 0,
        crouch: 0,
        // Each starts somewhere different on its needs, so a herd is not in step.
        needs: {energy: 0.5 + 0.5 * u("energy"), thirst: 0.5 * u("thirst"), hunger: 0.6 * u("hunger"), safety: 1, social: 0.3 * u("social"), curiosity: 0.6 * u("curious"), comfort: 1},
        memory: {predators: [], disturbances: [], spots: {}},
        threat: null,
        dangerAt: -1e9,
        scare: 0,
        wary: null,
        dash: null,
        flushed: false,
        style: null,
        response: null,
        heard: null,
        prey: null,
        reactedAt: -1e9,
        calledAt: -1e9,
        choice: "scan",
        choiceUntil: now + 1 + 4 * u("first"),
        lookAt: null,
        lookLabel: null,
        scanUntil: now,
        scanIndex: Math.floor(u("scan") * 1000),
        perceived: [],
        nextPerceive: 0,
        lastSeenAt: now,
        mode: "scan",
        onWatch: false,
        camHab: 0,
        camApproach: false,
        camNear: false,
        woke: null,
        dozing: null,
        bodyGoal: 0,
        moveHold: -1e9
    };
}

// MARK: The layer

export type ReactiveStats = {agents: number; perceptions: number; sightChecks: number; ms: number; alarms: number};

/** A call: who, where it called from, where the threat it saw was, when. */
export type AlarmCall = {caller: string; slug: string; x: number; z: number; tx: number; tz: number; at: number; threat: string};

export type ReactiveOptions = {tier?: ReactiveTier; envelope?: EnvelopeFn; budget?: Partial<ReactiveBudget>};

/** An alarm call about a ground threat sends a listener running when the threat is within this many of its flight distances (a zebra lets a lion walk past 30 m off, watching). */
const ALARM_FLIGHT = 1.3;
/**
 * The deliberate back-steps: backing off from the camera, giving way at the water. They go backwards (facing what they
 * back away from), and never faster than `BACK_STEP_SPEED`. Every other move faces the way it goes.
 */
const BACK_STEPS = new Set<ReactiveAction>(["back_off_camera", "wait_turn"]);
const BACK_STEP_SPEED = 0.28;
/** The actions in which it turns its body to keep what it watches in view (a threat, its prey, the camera it watches); in any other a look is the head's alone. */
const BODY_WATCH = new Set<ReactiveAction>(["alert", "freeze", "threat_display", "shield_young", "hide_behind_parent", "play_dead", "recover", "sentinel", "stalk", "watch_prey", "watch_camera"]);
/** How much further the one on sentinel watch sees: it is looking for exactly this. */
const SENTINEL_SIGHT = 1.6;
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
/** The bodies among which a smaller hunter gives way to a bigger one (`rival`). */
const RIVAL_PLANS = new Set(["quadruped", "lizard"]);
// (`browse` was missing until the behaviours pass: a browsing deer or giraffe near the camera never fed, it looked round all the time.)
const FEEDING = new Set(["forage", "graze", "browse", "visit_flowers", "drink"]);
/** Busy with its head down or its mind elsewhere: it notices a predator later than one looking round (`attention`). */
const HEAD_DOWN = new Set<ReactiveAction>(["feed", "drink", "doze", "groom", "play", "use_tool", "cache_bury", "cache_return", "follow_mixed"]);
/** Roosts an animal goes to ground at (`styleOf`). */
const GROUND_ROOSTS = new Set(["burrow", "den", "crevice"]);
const RESTING = new Set(["rest", "idle", "groom", "bask", "perch", "hide"]);
/** The actions of an animal reacting to a threat (it counts its alarm from the first of them). */
const REACTING = new Set<ReactiveAction>(["alert", "freeze", "flee", "shield_young", "threat_display", "hide_behind_parent", "play_dead", "withdraw"]);
/**
 * Prey near a chase scatter (the motion pass's chases): each bolts off at its own seeded angle either side of straight
 * away, up to this far (rad), so a herd splits and fans out instead of running as one block.
 */
export const SCATTER = 0.85;
/** A chase frightens anything at most this many times the chaser's length away, and at least this far (m), that is not much bigger than it. */
const CHASE_FRIGHT_LENGTHS = 7;
const CHASE_FRIGHT_MIN = 8;

export class ReactiveLayer {
    private agents = new Map<string, Agent>();
    private frame = 0;
    private alarms: AlarmCall[] = [];
    /** Who could eat whom, per species pair (the food links don't change). */
    private eatsCache = new Map<string, Map<string, 0 | 1 | 2>>();
    /** Which pairs of kinds are both hunters that catch their food (`rival`). */
    private rivalCache = new Map<string, Map<string, boolean>>();
    /** Lines of sight per pair, kept half a second (the terrain doesn't move; an animal walks a step). */
    private sightCache = new Map<string, {t: number; v: number; ttl: number}>();
    private around: (x: number, z: number, r: number) => ReactiveInput[] = () => [];
    /** The camera's last place and its velocity (m/s), for "is it coming at me". */
    private camPrev: Vec3 | null = null;
    private camVel = {x: 0, z: 0};
    /** The world time of the frame being stepped. */
    private now = 0;
    budget: ReactiveBudget;
    private envelope: EnvelopeFn;
    stats: ReactiveStats = {agents: 0, perceptions: 0, sightChecks: 0, ms: 0, alarms: 0};

    constructor(options: ReactiveOptions = {}) {
        this.budget = {...REACTIVE_BUDGET[options.tier ?? "high"], ...(options.budget ?? {})};
        this.envelope = options.envelope ?? reactiveEnvelope;
    }

    /** Forget everything carried from earlier frames (the visual CI, when its clock freezes: a shot is then a function of time). */
    resetAll() {
        this.agents = new Map();
        this.frame = 0;
        this.alarms = [];
        this.sightCache = new Map();
        this.camPrev = null;
        this.camVel = {x: 0, z: 0};
    }

    setTier(tier: ReactiveTier) {
        this.budget = {...REACTIVE_BUDGET[tier]};
    }

    /** The calls made in the last few seconds (for the sound scheduler and tests). */
    recentAlarms(): readonly AlarmCall[] {
        return this.alarms;
    }

    /** Its memory, for tests and the tap card's debug line. */
    memoryOf(id: string): Memory | null {
        return this.agents.get(id)?.memory ?? null;
    }

    /**
     * One frame. `inputs` are the animals near the camera and the ones that could be seen from there (the scene
     * passes everything within the budget's radius plus its reach); only the nearest `agents` within `radius` of the
     * camera act. Returns an output for every input (the rest get none: zero).
     */
    step(inputs: ReactiveInput[], world: ReactiveWorld): Map<string, ReactiveOut> {
        const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
        this.frame++;
        this.now = world.now;
        const out = new Map<string, ReactiveOut>();
        const stats: ReactiveStats = {agents: 0, perceptions: 0, sightChecks: 0, ms: 0, alarms: 0};
        const cam = world.camera;
        if (cam && this.camPrev && world.dt > 0) {
            // Smoothed a little: a jittery orbit is not an approach. A jump faster than 25 m/s is a cut (a shot change,
            // the camera flying to a tapped animal), not a walk at anything: the velocity starts again from rest.
            const vx = (cam.x - this.camPrev.x) / world.dt;
            const vz = (cam.z - this.camPrev.z) / world.dt;
            if (Math.hypot(vx, vz) > 25) this.camVel = {x: 0, z: 0};
            else {
                const k = Math.min(world.dt * 4, 1);
                this.camVel.x += (vx - this.camVel.x) * k;
                this.camVel.z += (vz - this.camVel.z) * k;
            }
        }
        this.camPrev = cam ? {...cam} : null;
        const byId = new Map(inputs.map((i) => [i.id, i]));
        const near = cam
            ? inputs
                  .map((i) => ({i, d: Math.hypot(i.shared.x - cam.x, i.shared.z - cam.z)}))
                  .filter((c) => c.d <= this.budget.radius)
                  .sort((a, b) => a.d - b.d || (a.i.id < b.i.id ? -1 : 1))
                  .slice(0, this.budget.agents)
                  .map((c) => c.i)
            : [];
        // A coarse grid of every input (numeric keys), for "who is near me".
        const cell = 8;
        const key = (cx: number, cz: number) => (cx + 4096) * 8192 + (cz + 4096);
        const grid = new Map<number, ReactiveInput[]>();
        const cells: Array<{cx: number; cz: number; list: ReactiveInput[]}> = [];
        for (const i of inputs) {
            const cx = Math.floor(i.shared.x / cell);
            const cz = Math.floor(i.shared.z / cell);
            const k = key(cx, cz);
            const list = grid.get(k);
            if (list) list.push(i);
            else {
                const fresh = [i];
                grid.set(k, fresh);
                cells.push({cx, cz, list: fresh});
            }
        }
        const around = (x: number, z: number, r: number): ReactiveInput[] => {
            const found: ReactiveInput[] = [];
            const span = Math.ceil(r / cell);
            const cx = Math.floor(x / cell);
            const cz = Math.floor(z / cell);
            const r2 = r * r;
            const take = (list: ReactiveInput[]) => {
                for (const i of list) {
                    const dx = i.shared.x - x;
                    const dz = i.shared.z - z;
                    if (dx * dx + dz * dz <= r2) found.push(i);
                }
            };
            // A wide look (a sentinel, a bird on the sky): walk the occupied cells, not every empty one in the square.
            if ((2 * span + 1) * (2 * span + 1) > cells.length) {
                for (const c of cells) if (Math.abs(c.cx - cx) <= span && Math.abs(c.cz - cz) <= span) take(c.list);
                return found;
            }
            for (let a = -span; a <= span; a++) {
                for (let b = -span; b <= span; b++) {
                    const list = grid.get(key(cx + a, cz + b));
                    if (list) take(list);
                }
            }
            return found;
        };
        this.around = around;
        if (this.frame % 30 === 0) this.sightCache.forEach((v, k) => {
            if (world.now - v.t > 1) this.sightCache.delete(k);
        });
        // Young by parent, for shielding.
        const youngOf = new Map<string, ReactiveInput[]>();
        for (const i of inputs) if (i.parentId) youngOf.set(i.parentId, [...(youngOf.get(i.parentId) ?? []), i]);
        // Forget old calls.
        this.alarms = this.alarms.filter((a) => world.now - a.at < 6);
        const active = new Set(near.map((i) => i.id));
        // Agents that left the active set are dropped after a while (their memory with them).
        this.agents.forEach((agent, id) => {
            if (!active.has(id) && world.now - agent.lastSeenAt > 60) this.agents.delete(id);
        });

        const sight = world.sight
            ? (a: Vec3, b: Vec3) => {
                  stats.sightChecks++;
                  return world.sight!(a, b);
              }
            : undefined;
        const view: ReactiveWorld = {...world, sight};

        for (const me of near) {
            stats.agents++;
            let agent = this.agents.get(me.id);
            if (!agent) {
                agent = newAgent(me.id, world.now);
                this.agents.set(me.id, agent);
            }
            agent.lastSeenAt = world.now;
            const result = this.stepAgent(me, agent, view, around, byId, youngOf, stats);
            out.set(me.id, result);
        }
        // Ones that just left the active set ease back rather than jump.
        for (const i of inputs) {
            if (active.has(i.id)) continue;
            const agent = this.agents.get(i.id);
            if (!agent || (Math.hypot(agent.offset.x, agent.offset.z) < 1e-3 && Math.abs(agent.head.yaw) + Math.abs(agent.head.pitch) < 1e-3)) continue;
            this.relax(agent, i, Math.min(world.dt, 0.1), headLimits(i.plan, i.slug));
            agent.threat = null;
            out.set(i.id, this.output(agent, i, "off", false, 0, null, false));
        }
        stats.alarms = this.alarms.length;
        stats.ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
        this.stats = stats;
        return out;
    }

    private stepAgent(
        me: ReactiveInput,
        agent: Agent,
        world: ReactiveWorld,
        around: (x: number, z: number, r: number) => ReactiveInput[],
        byId: Map<string, ReactiveInput>,
        youngOf: Map<string, ReactiveInput[]>,
        stats: ReactiveStats
    ): ReactiveOut {
        const dt = Math.min(Math.max(world.dt, 0), 0.1);
        const limits = headLimits(me.plan, me.slug);
        // The shared layer first: acting is left alone (zero), asleep only eases back, aloft is the flight's.
        if (me.acting) {
            this.reset(agent);
            return ZERO_OUT;
        }
        if (me.shared.aloft || (me.asleep && !this.awakeHere(me, agent, world, around, byId, stats))) {
            agent.threat = null;
            agent.heard = null;
            agent.prey = null;
            agent.woke = null;
            agent.wary = null;
            agent.dash = null;
            agent.response = null;
            this.relax(agent, me, dt, limits);
            return this.output(agent, me, me.shared.aloft ? "aloft" : "asleep", false, 0, null, false);
        }
        const p = me.intel;
        const person = agent.personality;
        this.updateNeeds(agent, me, world, dt);
        this.updateCamera(me, agent, world, dt);

        // Perception, staggered by id so not everyone looks on the same frame.
        const stagger = Math.floor(unit(me.id, "perceive") * this.budget.perceiveEvery);
        if ((this.frame + stagger) % this.budget.perceiveEvery === 0 || !agent.perceived.length) {
            stats.perceptions++;
            const sentinelNow = this.onWatch(me, around, world);
            // As far as it could see anything: a big animal moving (1.7x), a bird on the sky (2.6x), the sentinel further.
            const reach = Math.min(this.budget.reach, Math.max(p.sight * 2.6 * (sentinelNow ? SENTINEL_SIGHT : 1), p.hearing * 1.6, p.smell * 1.5));
            agent.onWatch = sentinelNow;
            agent.perceived = [];
            const hunts = p.hunt.some((h) => h !== "filter" && h !== "scavenge");
            for (const other of around(me.shared.x, me.shared.z, reach)) {
                if (other.id === me.id) continue;
                // Only what matters to it is looked for: what could eat it, and (a hunter) what it could eat; and a chase
                // going on near it (`chasing`: a fright to anything smaller close by, whatever the shared layer says).
                const threat = (other.chasing ? this.threatens(other, me) || this.frightened(me, other) : !this.sleeping(other) && this.threatens(other, me)) && !(other.shared.aloft && !other.intel.hunt.includes("aerial_swoop"));
                const prey = hunts && !other.shared.aloft && this.hunts(me, other);
                if (!threat && !prey) continue;
                const pair = `${me.id}|${other.id}`;
                const line = world.sight
                    ? (eye: Vec3, target: Vec3) => {
                          const hit = this.sightCache.get(pair);
                          if (hit && world.now - hit.t < hit.ttl) return hit.v;
                          const v = world.sight!(eye, target);
                          // Each pair keeps its line its own while (0.5–1 s), so they don't all fall due on one frame.
                          this.sightCache.set(pair, {t: world.now, v, ttl: hit?.ttl ?? 0.5 + 0.5 * unit(pair, "sight-ttl")});
                          return v;
                      }
                    : undefined;
                const how = perceive(me, other, world, sentinelNow ? SENTINEL_SIGHT : 1, this.budget.sightSamples, line, sentinelNow);
                if (how) {
                    const distance = Math.hypot(other.shared.x - me.shared.x, other.shared.z - me.shared.z);
                    agent.perceived.push({id: other.id, how, distance, x: other.shared.x, z: other.shared.z, threat, prey, press: threat ? distance / threatScale(me, other, menaceOf(me, other, this.stalks(other, me))) : Infinity});
                }
            }
        }

        // Threats: of the perceived animals that could eat it (awake; a raptor in the air counts), the most pressing:
        // the nearest for what it is doing (a lion walking at it 15 m off comes before one lying up 12 m off).
        let threat: {input: ReactiveInput; seen: Perceived} | null = null;
        let pressing = Infinity;
        let prey: {input: ReactiveInput; seen: Perceived} | null = null;
        let kin: ReactiveInput[] = [];
        for (const seen of agent.perceived) {
            const other = byId.get(seen.id);
            if (!other) continue;
            if (seen.threat && seen.press < pressing && (!this.sleeping(other) || other.chasing)) {
                threat = {input: other, seen};
                pressing = seen.press;
            }
            if (seen.prey && !other.shared.aloft) {
                if (!prey || seen.distance < prey.seen.distance) prey = {input: other, seen};
            }
        }
        kin = around(me.shared.x, me.shared.z, Math.max(12, me.length * 8)).filter((o) => o.id !== me.id && o.slug === me.slug && !this.sleeping(o));

        // Memory: a predator seen is remembered there; the more it learns, the stronger and longer. (Once it has noticed
        // it: one it has not yet looked up at is not yet a place to keep away from.)
        if (threat && agent.threat && agent.threat.id === threat.input.id && world.now >= agent.threat.noticed) {
            const mem = agent.memory.predators.find((m) => m.slug === threat!.input.slug && Math.hypot(m.x - threat!.seen.x, m.z - threat!.seen.z) < 15);
            if (mem) {
                mem.x = threat.seen.x;
                mem.z = threat.seen.z;
                if (world.now - mem.t > 4) mem.strength = Math.min(mem.strength + 0.4 * p.learning + 0.1, 3);
                mem.t = world.now;
            } else agent.memory.predators.push({slug: threat.input.slug, x: threat.seen.x, z: threat.seen.z, t: world.now, strength: 0.4 + 0.4 * p.learning});
            if (agent.memory.predators.length > 6) agent.memory.predators.shift();
        }
        const remember = 25 + 90 * p.learning;
        // (Filtered only when something has expired: no new arrays every frame.)
        if (agent.memory.predators.some((m) => world.now - m.t >= remember * Math.max(m.strength, 0.5))) agent.memory.predators = agent.memory.predators.filter((m) => world.now - m.t < remember * Math.max(m.strength, 0.5));
        if (agent.memory.disturbances.some((d) => world.now - d.t >= remember)) agent.memory.disturbances = agent.memory.disturbances.filter((d) => world.now - d.t < remember);

        // Alarms heard: from its own kind and any group animal (eavesdropping), with a delay that grows with distance.
        for (const call of this.alarms) {
            if (call.caller === me.id || (agent.heard && agent.heard.at >= call.at)) continue;
            // (A call about the predator it has already settled on tells it nothing new.)
            if (agent.threat && agent.threat.settledAt !== null && call.threat === agent.threat.id) continue;
            const d = Math.hypot(call.x - me.shared.x, call.z - me.shared.z);
            const hears = d < p.hearing * 1.6 * (1 - 0.4 * world.weather.rain);
            if (!hears) continue;
            const own = call.slug === me.slug;
            if (!own && !GROUPED.has(me.social) && !p.mixed && p.alarm === false) continue;
            // Another kind's alarm only matters when what it saw could eat this one too (a lion doesn't run from the zebras' alarm at itself).
            const caused = byId.get(call.threat);
            if (!own && (!caused || caused.id === me.id || !this.threatens(caused, me))) continue;
            if (call.threat === me.id) continue;
            const delay = d * 0.09 + 0.08 + unit(me.id, "alarm", Math.floor(call.at * 10)) * 0.22 + (own ? 0 : 0.25) + Math.max(person.fleeDelay - 0.35, 0);
            // Already reacting to an earlier call: the new one carries on at once (no gap while it "hears" it again).
            const reacting = agent.heard && world.now >= agent.heard.reactAt && world.now - agent.heard.reactAt < 10;
            agent.heard = {x: call.x, z: call.z, tx: call.tx, tz: call.tz, at: call.at, reactAt: reacting ? Math.min(call.at + delay, world.now) : call.at + delay, caller: call.caller, threat: call.threat, flight: false};
        }
        // Silent spread: one of its group running from a threat sets it off too (a herd runs together), a moment later;
        // and one of its group stopped with its head up, staring at something, has it look up too (it has seen nothing
        // itself: many eyes work because each watches the others).
        if (!agent.heard || world.now - agent.heard.at > 10) {
            for (const k of kin) {
                const other = this.agents.get(k.id);
                if (!other || !other.threat) continue;
                const running = other.mode === "flee";
                const staring = !running && !agent.threat && other.threat.settledAt === null && (other.mode === "alert" || other.mode === "freeze" || other.mode === "threat_display");
                if (!running && !staring) continue;
                const d = Math.hypot(k.shared.x - me.shared.x, k.shared.z - me.shared.z);
                const at = world.now;
                const after = running ? 0.15 + d * 0.06 + unit(me.id, "follow-flight", Math.floor(at)) * 0.25 : 0.4 + d * 0.1 + unit(me.id, "follow-look", Math.floor(at)) * 1.6;
                agent.heard = {x: k.shared.x, z: k.shared.z, tx: other.threat.x, tz: other.threat.z, at, reactAt: at + after, caller: k.id, threat: other.threat.id, flight: running};
                break;
            }
        }

        // MARK: Danger
        let action: ReactiveAction = agent.choice;
        let called = false;
        let target: {x: number; z: number} = {x: 0, z: 0};
        let speed = 1.2 * Math.max(me.length, 0.3);
        let crouchWant = 0;
        let look: Vec3 | null = null;
        let lookLabel: string | null = null;
        let faceYaw: number | null = null;
        let response: ReactiveResponse | null = null;

        if (threat) {
            const menace = menaceOf(me, threat.input, this.stalks(threat.input, me));
            if (!agent.threat || agent.threat.id !== threat.input.id) {
                // Sharper (and warier, and already burnt) animals notice sooner.
                const burnt = agent.memory.predators.find((m) => m.slug === threat!.input.slug)?.strength ?? 0;
                // The one on watch is looking for exactly this: it is quickest of all.
                // (Watching already: on sentinel duty, or the shared layer has it watching a predator it saw at its slot's start.)
                const watching = agent.onWatch || me.shared.doing === "watch";
                const calm = Math.max(0.05, person.fleeDelay * (1.2 - p.learning * 0.5) * (watching ? 0.35 : 1) - 0.12 * burnt);
                // Attention: one with its head down feeding, dozing or at play sees a predator only when it next looks
                // up (its own seeded 1 to 5 s), sooner the nearer it is, later a still or a creeping one; one looking
                // round already, in a third of that; one on watch, or with the predator close, at once.
                const far = Math.min(threat.seen.distance / Math.max(p.sight, 1), 1);
                const closeBy = threat.seen.distance < Math.max(p.flight * 1.5, me.length * 3);
                // (Never so long that a predator at a walk covers more than a third of the way to it meanwhile.)
                const attention = watching || closeBy ? 0 : Math.min((HEAD_DOWN.has(agent.mode) ? 1 : 0.3) * (1 + 4 * unit(me.id, "attention", threat.input.id)) * (0.35 + 0.65 * far) * (menace === "resting" || menace === "stalking" ? 1.5 : 1), (0.35 * threat.seen.distance) / Math.max(1.1 * threat.input.length, 0.5));
                // (A chase is noticed at once: a moment for the nearest, a little more the further off.)
                const delay = threat.input.chasing ? Math.min(calm, 0.08 + threat.seen.distance * 0.02 + unit(me.id, "chase-notice") * 0.12) : calm + attention;
                agent.threat = {id: threat.input.id, slug: threat.input.slug, x: threat.seen.x, z: threat.seen.z, seen: world.now, noticed: world.now + delay, menace, watchFrom: world.now + delay, settledAt: null, settledD: 0, called: false};
                agent.flushed = false;
                agent.dash = null;
            } else {
                agent.threat.x = threat.seen.x;
                agent.threat.z = threat.seen.z;
                agent.threat.seen = world.now;
                // Worse than it was (it got up, it turned this way, it began to creep, it ran): watched afresh.
                if (MENACE_RANK[menace] > MENACE_RANK[agent.threat.menace]) {
                    agent.threat.settledAt = null;
                    if (world.now >= agent.threat.noticed) agent.threat.watchFrom = world.now;
                    agent.threat.called = false;
                }
                agent.threat.menace = menace;
            }
        } else if (agent.threat && world.now - agent.threat.seen > 3) {
            agent.threat = null;
            agent.flushed = false;
        }
        const danger = agent.threat && world.now >= agent.threat.noticed ? agent.threat : null;
        const menacing = danger ? byId.get(danger.id) ?? null : null;
        // (From where it is drawn: once it has run, the room it put between them counts.)
        const hereX = me.shared.x + agent.offset.x;
        const hereZ = me.shared.z + agent.offset.z;
        // Predators it has met before (remembered from an earlier sighting, not this one) make it go sooner.
        let prior = 0;
        for (const m of agent.memory.predators) if (m.strength > 0.85 && (!danger || m.slug !== danger.slug || m.strength > 1.25)) prior++;
        const flightBase = p.flight * person.fleeDistance * (1 + 0.25 * Math.min(prior, 2));
        const flightDistance = flightBase * threatScale(me, menacing, danger?.menace);

        // Appraisal: a predator lying up or going by, outside its flight distance, is watched for a while (longer the
        // nearer it is) and then tolerated: it goes back to its business, warily. One that gets up, turns its way,
        // creeps or comes much nearer is watched afresh.
        let tolerating = false;
        if (danger) {
            const d = Math.hypot(hereX - danger.x, hereZ - danger.z);
            const mild = danger.menace === "resting" || danger.menace === "passing";
            if (danger.settledAt !== null && (!mild || d < flightDistance * 1.05 || d < danger.settledD * 0.7)) {
                danger.settledAt = null;
                danger.watchFrom = world.now;
                danger.called = false;
            }
            // (Its watch counts from when it is clear of its flight distance: one that has just run starts it where it stops.)
            if (d <= flightDistance * 1.15 || (agent.dash && agent.dash.doneAt === null)) danger.watchFrom = world.now;
            if (danger.settledAt === null && mild && d > flightDistance * 1.15) {
                const watchFor = (3 + 5 * unit(me.id, "watch-for", danger.id)) * Math.min(Math.max((2 * flightDistance) / d, 0.5), 2.5) * (1.3 - 0.4 * p.learning);
                if (world.now - danger.watchFrom > watchFor) {
                    danger.settledAt = world.now;
                    danger.settledD = d;
                    // It chooses what to do again, now (the scare, such as it was, is over).
                    agent.choiceUntil = world.now;
                    agent.scare = 0;
                }
            }
            tolerating = danger.settledAt !== null;
            if (tolerating) {
                // (Kept up to date in place: nothing new made each frame.)
                const wary = agent.wary ?? (agent.wary = {x: 0, z: 0, id: null, until: 0});
                wary.x = danger.x;
                wary.z = danger.z;
                wary.id = danger.id;
                wary.until = world.now + 20;
            }
        }
        if (agent.wary && world.now >= agent.wary.until) agent.wary = null;
        // (What it was told about the predator it has settled on, by a call or a herd mate's stare, is old news.)
        if (tolerating && agent.heard && agent.heard.threat === danger!.id) agent.heard = null;
        const heardNow = agent.heard && world.now >= agent.heard.reactAt && world.now - agent.heard.reactAt < 10 ? agent.heard : null;

        // Parents: a young one near and a threat (or an alarm): between it and the threat.
        const young = (youngOf.get(me.id) ?? []).filter((y) => Math.hypot(y.shared.x - me.shared.x, y.shared.z - me.shared.z) < Math.max(6 * me.length, 4));
        const parent = me.parentId ? byId.get(me.parentId) ?? null : null;
        const parentOut = parent ? this.agents.get(parent.id) : undefined;

        // (A predator it tolerates is no part of what follows: an alarm about something else is answered for itself.)
        const live = tolerating ? null : danger;
        const liveMenacing = live ? menacing : null;
        const liveFlight = live ? flightDistance : flightBase;
        if (live || heardNow) {
            // (Told of it by another: where that one sees it now, while it still does; else where it was when it called.)
            const told = !live && heardNow ? this.agents.get(heardNow.caller)?.threat ?? null : null;
            const from = live ? {x: live.x, z: live.z} : told && told.id === heardNow!.threat ? {x: told.x, z: told.z} : {x: heardNow!.tx, z: heardNow!.tz};
            const dx = hereX - from.x;
            const dz = hereZ - from.z;
            const d = Math.hypot(dx, dz) || 1e-3;
            if (!REACTING.has(agent.mode)) agent.reactedAt = world.now;
            agent.dangerAt = world.now;
            // It calls the alarm once each time it takes a fresh look at a predator (a sentinel, an alarm-caller, a group
            // animal), never more than every 8 s. In a storm or a downpour it keeps low and quiet (a call would not
            // carry): it calls only at a predator already inside its flight distance. Weather itself (thunder,
            // lightning, wind) never sets off an alarm.
            const stormQuiet = world.weather.storm > 0.5 || world.weather.rain > 0.8;
            if ((p.alarm || p.sentinel) && live && !live.called && world.now - agent.calledAt > 8 && (!stormQuiet || d < liveFlight)) {
                called = true;
                live.called = true;
                agent.calledAt = world.now;
                this.alarms.push({caller: me.id, slug: me.slug, x: me.shared.x, z: me.shared.z, tx: live.x, tz: live.z, at: world.now, threat: live.id});
            }
            // It looks at the threat; on an alarm, first toward the caller, then where the caller looked.
            const heardFirst = !live && heardNow && world.now - heardNow.reactAt < 0.6;
            look = heardFirst ? {x: heardNow!.x, y: me.shared.y + me.length * 0.5, z: heardNow!.z} : {x: from.x, y: me.shared.y + me.length * 0.5, z: from.z};
            lookLabel = live ? live.id : "sound";
            const close = d < liveFlight;
            const veryClose = d < liveFlight * 0.4;
            const sinceReact = world.now - agent.reactedAt;
            const style = this.styleOf(me, agent);
            const chased = live?.menace === "chasing";
            const coming = live ? live.menace === "coming" || live.menace === "stalking" || chased : false;
            const stands = Boolean(liveMenacing && this.standsTo(me, liveMenacing));
            const walk = 1.2 * Math.max(me.length, 0.3);
            const toThreat = Math.atan2(from.x - hereX, from.z - hereZ);
            // Its dash, if it is on one: it runs to its end, then holds there.
            const dash = agent.dash;
            const dashing = Boolean(dash && dash.doneAt === null);
            // An alarm sends it running when one of its group runs, when the threat is a raptor in the air (it comes
            // fast), or when the threat is not far off; one about a threat far away on the ground only puts it on alert.
            const alarmFlight = Boolean(heardNow && !dash && (heardNow.flight || Boolean(byId.get(heardNow.threat)?.shared.aloft) || (!live && d < flightBase * ALARM_FLIGHT)));
            if (young.length && live) {
                // Shield: between the nearest young and the threat, a body length from the young.
                const y = young.sort((a, b) => Math.hypot(a.shared.x - from.x, a.shared.z - from.z) - Math.hypot(b.shared.x - from.x, b.shared.z - from.z))[0];
                const ux = from.x - y.shared.x;
                const uz = from.z - y.shared.z;
                const ul = Math.hypot(ux, uz) || 1;
                target = {x: y.shared.x + (ux / ul) * me.length * 1.1 - me.shared.x, z: y.shared.z + (uz / ul) * me.length * 1.1 - me.shared.z};
                action = p.defence.includes("threat") && veryClose ? "threat_display" : "shield_young";
                speed = 3 * Math.max(me.length, 0.4);
                faceYaw = Math.atan2(from.x - me.shared.x, from.z - me.shared.z);
                response = "shield";
                agent.scare = Math.max(agent.scare, 0.6);
            } else if (parent && parentOut && (parentOut.mode === "shield_young" || parentOut.mode === "threat_display" || parentOut.mode === "flee")) {
                // A young one: behind its parent, away from the threat.
                const ux = parent.shared.x - from.x;
                const uz = parent.shared.z - from.z;
                const ul = Math.hypot(ux, uz) || 1;
                target = {x: parent.shared.x + parentOut.offset.x + (ux / ul) * parent.length * 0.9 - me.shared.x, z: parent.shared.z + parentOut.offset.z + (uz / ul) * parent.length * 0.9 - me.shared.z};
                action = "hide_behind_parent";
                speed = 3 * Math.max(me.length, 0.3);
                crouchWant = 0.5;
                response = "shield";
                agent.scare = Math.max(agent.scare, 0.6);
            } else if (dashing) {
                // Running: to the end of its dash, getting up to speed over its first strides and easing up at the end.
                action = "flee";
                target = {x: dash!.x, z: dash!.z};
                const left = Math.hypot(dash!.x - agent.offset.x, dash!.z - agent.offset.z);
                const top = fleeSpeed(me);
                const tau = accelTime(me.length) / 3;
                speed = Math.min(top * (1 - Math.exp(-(world.now - dash!.at + 0.05) / tau)), left / 0.25 + top * 0.2);
                faceYaw = left > 0.05 ? Math.atan2(dash!.x - agent.offset.x, dash!.z - agent.offset.z) : null;
                crouchWant = p.defence.includes("flee_cover") ? 0.2 : 0;
                // Running, it looks where it runs, with a glance back at the threat now and then (its own rhythm).
                const glance = (world.now - agent.reactedAt + 2.2 * unit(me.id, "glance-back")) % 2.2 < 0.55;
                if (!glance && left > 0.05) {
                    look = {x: hereX + ((dash!.x - agent.offset.x) / left) * 4, y: me.shared.y + (me.headHeight ?? me.length * 0.5), z: hereZ + ((dash!.z - agent.offset.z) / left) * 4};
                    lookLabel = "ahead";
                }
                response = "bolt";
                if (left < Math.max(0.12, me.length * 0.1) || world.now - dash!.at > 8) dash!.doneAt = world.now;
            } else if (sinceReact < 0.35 + 0.4 * (1 - p.learning)) {
                // First it looks.
                action = "alert";
                target = {...agent.offset};
                response = "watch";
                agent.scare = Math.max(agent.scare, 0.2);
            } else if (p.defence.includes("play_dead") && veryClose && live) {
                action = "play_dead";
                target = {...agent.offset};
                crouchWant = 1;
                response = "dead";
                agent.scare = Math.max(agent.scare, 0.8);
            } else if (live && style === "ball" && close) {
                // Its armour is its defence (a tortoise, a pangolin, a snail, a barnacle): it pulls in and stays put.
                action = "withdraw";
                target = {...agent.offset};
                crouchWant = 1;
                response = "ball";
                agent.scare = Math.max(agent.scare, 0.6);
            } else if (live && stands && d < liveFlight * 1.6 && !(chased && !this.armed(me))) {
                // Big or armed (a buffalo, a boar, a porcupine, a skunk): it does not run. It faces the predator and
                // holds its ground, closing up with its herd; with the predator right on it and no bigger than it, it
                // goes at it a few steps.
                action = "threat_display";
                faceYaw = toThreat;
                response = "stand";
                agent.scare = Math.max(agent.scare, 0.45);
                const heavier = bodyMass(me.plan, me.length) >= bodyMass(liveMenacing!.plan, liveMenacing!.length);
                if (veryClose && heavier && !this.armed(me)) {
                    const step = Math.min(this.envelope(me, false), d * 0.4);
                    target = {x: agent.offset.x + Math.sin(toThreat) * step, z: agent.offset.z + Math.cos(toThreat) * step};
                    speed = fleeSpeed(me) * 0.5;
                } else if (kin.length && p.defence.includes("group")) {
                    target = this.closeUp(me, kin, 0.6);
                    speed = walk;
                } else target = {...agent.offset};
            } else if (live && style === "flush" && !me.shared.moving && !agent.flushed && !chased && d > liveFlight * (coming ? 0.7 : 0.45)) {
                // Cryptic and still (a hare in its form, a partridge, a nightjar, a frog): it holds still, low, for as
                // long as the predator is about, and goes only when it is almost on it.
                action = "freeze";
                target = {...agent.offset};
                crouchWant = 0.7;
                response = "freeze";
                agent.scare = Math.max(agent.scare, 0.4);
            } else if (alarmFlight || (live && close && (!dash || (d < liveFlight * (chased ? 0.3 : 0.6) && world.now - (dash.doneAt ?? world.now) > 0.8)))) {
                // It runs from what it sees close, from its group running, from an alarm about a raptor or a threat not
                // far off. A dash: one direction, chosen as it starts, to the edge of its flee reach. (Again, on round
                // its reach, only if the predator follows it to within 0.6 of its flight distance; from a chase going
                // by, which makes that distance long, only if the chaser is right on it: they scatter once and stand.)
                action = "flee";
                if (style === "flush") agent.flushed = true;
                const threatId = live ? live.id : heardNow!.threat;
                // From a chase it scatters: each off at its own angle either side of straight away (`SCATTER`).
                const fan = byId.get(threatId)?.chasing ? (unit(me.id, "scatter") * 2 - 1) * SCATTER : 0;
                const away = {x: (dx / d) * Math.cos(fan) + (dz / d) * Math.sin(fan), z: (dz / d) * Math.cos(fan) - (dx / d) * Math.sin(fan)};
                // From a raptor overhead it makes for cover (a burrow, a bush, a tree), not for the open with its group.
                // (A herd runs one way from a predator on foot; from a chase each goes its own: no common point then.)
                const dir = this.fleeDirection(me, agent, away, world, kin, Boolean(byId.get(threatId)?.shared.aloft), fan ? null : from);
                const reach = this.envelope(me, true);
                // (From where it stands: a second dash, the predator having followed, goes on round its reach.)
                let tx = agent.offset.x + dir.x * reach;
                let tz = agent.offset.z + dir.z * reach;
                const tl = Math.hypot(tx, tz);
                if (tl > reach) {
                    tx *= reach / tl;
                    tz *= reach / tl;
                }
                agent.dash = {at: world.now, x: tx, z: tz, doneAt: null};
                target = {x: tx, z: tz};
                speed = fleeSpeed(me) * 0.15;
                faceYaw = Math.atan2(tx - agent.offset.x, tz - agent.offset.z);
                response = "bolt";
                agent.scare = Math.max(agent.scare, chased ? 1 : 0.75);
            } else if (dash) {
                // It has run: it stops where it ran to and watches (one that lives in a burrow keeps low at its refuge),
                // and never walks back toward a predator still about.
                const ground = style === "ground";
                action = ground ? "freeze" : "alert";
                target = {x: dash.x, z: dash.z};
                speed = walk;
                crouchWant = ground ? 0.9 : 0;
                faceYaw = ground ? null : toThreat;
                response = ground ? "ground" : "hold";
            } else if (live && !coming && style !== "ball" && d < liveFlight * 1.6) {
                // A resting or passing predator a little too near: it walks off, looking back, and watches from there.
                action = "alert";
                const reach = this.envelope(me, true);
                let tx = agent.offset.x + (dx / d) * reach;
                let tz = agent.offset.z + (dz / d) * reach;
                const tl = Math.hypot(tx, tz);
                if (tl > reach) {
                    tx *= reach / tl;
                    tz *= reach / tl;
                }
                target = {x: tx, z: tz};
                speed = walk;
                response = "move_off";
                agent.scare = Math.max(agent.scare, 0.35);
            } else if (live && kin.length && p.defence.includes("group") && GROUPED.has(me.social)) {
                // A herd animal watching a predator closes up with its group.
                action = "alert";
                target = this.closeUp(me, kin, 0.65);
                speed = walk;
                response = "bunch";
                agent.scare = Math.max(agent.scare, 0.3);
            } else {
                // Watching it from a safe distance: head up, still.
                action = "alert";
                target = {...agent.offset};
                response = "watch";
                agent.scare = Math.max(agent.scare, 0.2);
            }
        } else if (!tolerating && (REACTING.has(agent.mode) || agent.mode === "recover")) {
            // It calms down: watchful a while, the longer the worse the scare was (a look at a lion going by a few
            // seconds, a run from one half a minute, a chase more), still where it ran to, looking at where the
            // predator was; then back to its business, wary for as long again.
            const calmFor = (5 + 28 * agent.scare) * (1.4 - p.learning * 0.6);
            const since = world.now - agent.dangerAt;
            const remembered = agent.memory.predators[agent.memory.predators.length - 1];
            if (since < calmFor) {
                action = "recover";
                target = {...agent.offset};
                crouchWant = this.styleOf(me, agent) === "ground" && since < calmFor * 0.5 ? 0.6 : 0;
                if (remembered) {
                    look = {x: remembered.x, y: me.shared.y + 1, z: remembered.z};
                    lookLabel = "spot";
                }
            } else {
                agent.mode = "scan";
                agent.choice = "scan";
                agent.choiceUntil = world.now;
                if (remembered && agent.scare > 0.3) agent.wary = {x: remembered.x, z: remembered.z, id: null, until: world.now + calmFor};
                agent.scare = 0;
                agent.dash = null;
            }
        }
        if (tolerating) {
            response = "tolerate";
            agent.dash = null;
        }
        agent.response = response;

        // MARK: Hunting (visual only, never a catch)
        const dangerous = REACTING.has(action) || action === "recover";
        const stalked = agent.prey;
        agent.prey = null;
        if (!dangerous && prey && agent.needs.hunger > 0.25) {
            const other = prey.input;
            const style = p.hunt;
            look = {x: other.shared.x, y: other.shared.y + other.length * 0.4, z: other.shared.z};
            lookLabel = other.id;
            // It creeps at its prey only when the shared layer has it hunting or on the move and hungry: one lying up,
            // grooming, basking or drinking only watches (a pride resting in sight of zebras is not stalking them, and
            // they can tell: `menaceOf`). Nor across a fence or within a household (`apart`).
            const doing = me.shared.doing;
            const afoot = doing === "stalk" || ((doing === "forage" || doing === "wander") && agent.needs.hunger > 0.5);
            if ((style.includes("stalk") || style.includes("pack") || style.includes("pursuit")) && afoot && !apart(me, other)) {
                action = "stalk";
                crouchWant = style.includes("stalk") ? 0.55 : 0.25;
                const ux = other.shared.x - me.shared.x;
                const uz = other.shared.z - me.shared.z;
                const ul = Math.hypot(ux, uz) || 1;
                // Pack mates fan out, each to its own side.
                const side = style.includes("pack") ? (unit(me.id, "pack-side") - 0.5) * 2 : 0;
                const reach = this.envelope(me, false);
                target = {x: (ux / ul) * reach + (-uz / ul) * side * reach * 0.6, z: (uz / ul) * reach + (ux / ul) * side * reach * 0.6};
                speed = 0.5 * Math.max(me.length, 0.3);
                faceYaw = Math.atan2(ux, uz);
                // (Its prey reads this: a predator creeping at it is `stalking`, `menaceOf`. The same object, kept up to date.)
                const mark = stalked ?? {id: other.id, x: 0, z: 0, seen: 0};
                mark.id = other.id;
                mark.x = other.shared.x;
                mark.z = other.shared.z;
                mark.seen = world.now;
                agent.prey = mark;
            } else {
                action = "watch_prey";
                target = {...agent.offset};
                crouchWant = style.includes("ambush") ? 0.4 : 0;
            }
        }

        // MARK: Calm choices (utility)
        if (!dangerous && action !== "stalk" && action !== "watch_prey") {
            if (world.now >= agent.choiceUntil) {
                const choice = this.choose(me, agent, world, kin, byId);
                agent.choice = choice;
                // Each holds its choice for its own time (seeded), so a herd's members change at different moments.
                const hold = 2.5 + 6 * unit(me.id, "hold", Math.floor(world.now / 3));
                agent.choiceUntil = world.now + hold * (choice === "sentinel" ? 3 : 1);
                agent.lookAt = null;
            }
            action = agent.choice;
            const calm = this.calmAction(me, agent, action, world, kin, byId);
            target = calm.target;
            speed = calm.speed;
            crouchWant = calm.crouch;
            look = calm.look;
            lookLabel = calm.label;
            faceYaw = calm.face;
            // Wary (a predator it tolerates in sight, or a scare just over): about half its looks round go to the
            // predator, or to where it was; nearly all of them while the shared layer has it watching that predator
            // (`doing: "watch"`: that is what its slot is for).
            const wary = agent.wary;
            // (Its own rhythm, a look of 2 to 4 s at a time: the scan's own count stands still while it looks at something.)
            if (wary && !look && (action === "scan" || action === "sentinel") && unit(me.id, "wary-look", Math.floor((world.now + 5 * unit(me.id, "wary-phase")) / (2 + 2 * unit(me.id, "wary-beat")))) < (me.shared.doing === "watch" ? 0.9 : 0.5)) {
                look = {x: wary.x, y: me.shared.y + me.length * 0.5, z: wary.z};
                lookLabel = wary.id ?? "spot";
            }
        }

        // MARK: Keep to the shared layer: inside the envelope, and never onto prey.
        // Reacting or recovering, it keeps the room it fled into (it does not walk back toward a threat still in view);
        // it eases back while it recovers, and is pulled in to its calm reach only once calm.
        // (Wary, it stays where it went to: a zebra that moved off from lions grazes there, not back beside them.)
        const reach = action === "investigate_camera" ? this.investigateReach(me) : this.envelope(me, REACTING.has(action) || action === "recover" || Boolean(agent.wary));
        const tl = Math.hypot(target.x, target.z);
        if (tl > reach) {
            target = {x: (target.x / tl) * reach, z: (target.z / tl) * reach};
        }
        // Away from a remembered predator spot (it avoids where it saw one), within the envelope.
        const fresh = agent.memory.predators.find((m) => world.now - m.t < 20 + 40 * p.learning && Math.hypot(m.x - me.shared.x, m.z - me.shared.z) < 12);
        // (Not while it reacts: an alert, freezing or withdrawn animal holds still; a fleeing one has its own way.)
        // (Nor when the shared layer has it watching a predator from the far side of its range: that is the avoiding, done once.)
        // (Nor while it is still watching where it ran to, or holding its place with a predator it tolerates in sight.)
        if (fresh && !REACTING.has(action) && action !== "recover" && !agent.wary && me.shared.doing !== "watch") {
            const ux = me.shared.x - fresh.x;
            const uz = me.shared.z - fresh.z;
            const ul = Math.hypot(ux, uz) || 1;
            const push = reach * 0.5 * Math.min(fresh.strength, 1);
            target = {x: target.x + (ux / ul) * push, z: target.z + (uz / ul) * push};
            const l2 = Math.hypot(target.x, target.z);
            if (l2 > reach) target = {x: (target.x / l2) * reach, z: (target.z / l2) * reach};
        }
        // It faces the way it goes (a full turn if need be), and turns on the spot before it sets off; only a deliberate
        // back-step goes backwards, slowly. (Before, a play hop or a flee whose way lay behind it ran it backwards.)
        const backStep = BACK_STEPS.has(action);
        if (backStep) speed = Math.min(speed, BACK_STEP_SPEED);
        // (Not past its own clips' pace: an unhurried move at its walk's cap (1.2, as the schedule), a hurried one at
        // its run's. These speeds were in metres from a 0.3 m floor: a 9 cm clawed frog investigated the camera at 1.6
        // times its walk, an alligator whose walk is 0.05 lengths a second at 2.3. A flight keeps `fleeSpeed`.)
        if (action !== "flee") speed = Math.min(speed, paceCap(me, speed > 1.5 * Math.max(me.length, 0.3)));
        const wx = target.x - agent.offset.x;
        const wz = target.z - agent.offset.z;
        const wl = Math.hypot(wx, wz);
        let moveFace: number | null = null;
        // A move starts above 0.3 m/s and, once going, carries on down to 0.15 (no flicking between moving and standing);
        // a slow walker's at half its own speed.
        const moveFrom = Math.min(world.now < agent.moveHold ? 0.15 : 0.3, speed * 0.5);
        if (!backStep && wl > 1e-4 && dt > 0 && Math.min(wl / dt, speed) > moveFrom) {
            const dir = Math.atan2(wx, wz);
            moveFace = dir;
            // More than 70 degrees off the way: it turns on the spot first (no step), then goes.
            if (Math.abs(wrapAngle(dir - (me.shared.yaw + agent.bodyYaw))) > 1.2) speed = 0;
        }
        const before = {x: agent.offset.x, z: agent.offset.z};
        this.moveOffset(agent, target, speed, dt, reach);
        if (action === "stalk" && prey) this.keepShort(me, agent, prey.input);
        // Its actual step this frame (the envelope pulling it in, keeping short of prey) decides the facing when it is a move.
        const sx = agent.offset.x - before.x;
        const sz = agent.offset.z - before.z;
        if (!backStep && dt > 0 && Math.hypot(sx, sz) / dt > moveFrom) moveFace = Math.atan2(sx, sz);
        if (moveFace !== null) agent.moveHold = world.now + 0.4;

        agent.mode = action;
        if (look) {
            agent.lookAt = look;
            agent.lookLabel = lookLabel;
        }
        const scan = !look && (action === "scan" || action === "sentinel" || action === "alert");
        this.stepLook(me, agent, look, scan, world, dt, limits, faceYaw, action, moveFace);
        agent.crouch += (crouchWant - agent.crouch) * Math.min(dt * 4, 1);
        // How alarmed it is: full while a danger is on; falling as it calms; a little while it tolerates a predator in sight.
        const calming = (5 + 28 * agent.scare) * (1.4 - p.learning * 0.6);
        const alarmed = (danger && !tolerating) || heardNow ? 1 : action === "recover" ? alarmLevel((world.now - agent.dangerAt) * 1000, calming * 1000) : 0;
        // Woken here: kept up while it reacts or recovers; calm, it goes back to sleep when its time is up.
        if (agent.woke && (REACTING.has(action) || action === "recover" || (agent.threat && !tolerating) || heardNow)) agent.woke.until = Math.max(agent.woke.until, world.now + 6);
        return this.output(agent, me, action, called, alarmed, look ? lookLabel : null, true);
    }

    /** Asleep in the shared layer and not woken here (a woken one counts as awake: a woken lion is a threat again). */
    private sleeping(other: ReactiveInput): boolean {
        return other.asleep && !this.agents.get(other.id)?.woke;
    }

    /**
     * Whether an animal the shared layer has asleep is awake here: woken before and still up, or woken now. Asleep, it
     * perceives with its eyes shut and its hearing dulled (`SLEEP_SIGHT`, `SLEEP_HEARING`; smell as awake), on its
     * own perception frames. It wakes at a threat it perceives inside its flight distance, an alarm call it hears
     * (its own kind's, or another's about something that eats it too), its group running close by, or the camera
     * coming at it (closing at 0.6–6 m/s: a walk, not a cut) inside half its flight distance (a quarter for a hunter,
     * which sleeps deeper). A still camera never
     * wakes it, nor the camera coming to the animal the viewer selected or follows (`watched`).
     */
    private awakeHere(me: ReactiveInput, agent: Agent, world: ReactiveWorld, around: (x: number, z: number, r: number) => ReactiveInput[], byId: Map<string, ReactiveInput>, stats: ReactiveStats): boolean {
        if (agent.woke && world.now < agent.woke.until) return true;
        const p = me.intel;
        const stagger = Math.floor(unit(me.id, "perceive") * this.budget.perceiveEvery);
        if ((this.frame + stagger) % this.budget.perceiveEvery !== 0) return false;
        stats.perceptions++;
        const flight = p.flight * agent.personality.fleeDistance;
        const wake = (why: "threat" | "alarm" | "kin" | "camera") => {
            agent.woke = {at: world.now, until: world.now + WOKE_SECONDS + 14 * unit(me.id, "woke", Math.floor(world.now)), why};
            // Woken by a threat: it already knows where it is (no second wait to notice it).
            agent.choice = "scan";
            agent.choiceUntil = world.now;
            return true;
        };
        // Its senses asleep.
        const dozing = (agent.dozing ??= {...me, intel: {...p, sight: Math.min(p.sight * SLEEP_SIGHT, Math.max(me.length * 4, 2)), hearing: p.hearing * SLEEP_HEARING}});
        dozing.shared = me.shared;
        const reach = Math.min(this.budget.reach, Math.max(flight * 1.5, p.smell * 1.5, 4));
        for (const other of around(me.shared.x, me.shared.z, reach)) {
            if (other.id === me.id || (other.shared.aloft && !other.intel.hunt.includes("aerial_swoop"))) continue;
            // (A chase going on close by wakes it: the noise of it; anything else only if it could eat it.)
            if (other.chasing ? !this.threatens(other, me) && !this.frightened(me, other) : this.sleeping(other) || !this.threatens(other, me)) continue;
            const d = Math.hypot(other.shared.x - me.shared.x, other.shared.z - me.shared.z);
            if (d > flight * 1.2 * (other.chasing ? 1.5 : 1)) continue;
            const how = perceive(dozing, other, world, 1, this.budget.sightSamples, world.sight);
            if (how) {
                const seen = {x: other.shared.x, z: other.shared.z};
                agent.threat = {id: other.id, slug: other.slug, x: seen.x, z: seen.z, seen: world.now, noticed: world.now, menace: menaceOf(me, other), watchFrom: world.now, settledAt: null, settledD: 0, called: false};
                return wake("threat");
            }
        }
        // An alarm call it hears through its sleep (a call is loud: its dulled hearing, a call's carry).
        for (const call of this.alarms) {
            if (call.caller === me.id || call.threat === me.id) continue;
            const d = Math.hypot(call.x - me.shared.x, call.z - me.shared.z);
            if (d > p.hearing * SLEEP_HEARING * 1.6 * (1 - 0.4 * world.weather.rain)) continue;
            const own = call.slug === me.slug;
            const caused = byId.get(call.threat);
            if (!own && (!caused || !this.threatens(caused, me) || (!GROUPED.has(me.social) && !p.mixed && p.alarm === false))) continue;
            return wake("alarm");
        }
        // Its group running past it.
        for (const k of around(me.shared.x, me.shared.z, Math.max(me.length * 6, 6))) {
            if (k.id === me.id || k.slug !== me.slug) continue;
            if (this.agents.get(k.id)?.mode === "flee") return wake("kin");
        }
        // The camera coming at it, close, at a walk or a run (a still or passing camera never wakes it, nor a cut or the
        // camera flying to an animal the viewer tapped, nor the one the viewer is looking at or following).
        const cam = world.camera;
        // (Nor a kept animal: a pet, a farm or a zoo animal sleeps on with people about.)
        if (cam && !me.watched && !me.kept) {
            const d = Math.hypot(cam.x - me.shared.x, cam.z - me.shared.z);
            const closing = d > 1e-3 ? ((me.shared.x - cam.x) * this.camVel.x + (me.shared.z - cam.z) * this.camVel.z) / d : 0;
            // (A hunter sleeps deeper than its prey: a lion wakes for the camera only at a quarter of its flight distance.)
            const hunter = p.hunt.some((h) => h !== "filter" && h !== "scavenge");
            if (closing > 0.6 && closing < 6 && d < Math.min(flight * (hunter ? 0.25 : 0.5), 14)) return wake("camera");
        }
        return false;
    }

    /** How far a curious animal comes to look at the camera: two and a half times its calm reach, within its flee reach. */
    private investigateReach(me: ReactiveInput): number {
        return Math.min(this.envelope(me, false) * 2.5, this.envelope(me, true));
    }

    /** A chase close by frightens an animal not much bigger than the chaser (it bolts though it is not the prey). */
    private frightened(me: ReactiveInput, chaser: ReactiveInput): boolean {
        if (!chaser.chasing || me.length > chaser.length * 1.5) return false;
        const d = Math.hypot(chaser.shared.x - me.shared.x, chaser.shared.z - me.shared.z);
        return d < Math.max(chaser.length * CHASE_FRIGHT_LENGTHS, CHASE_FRIGHT_MIN);
    }

    /**
     * Whether `a` eats `b`'s kind (cached per species pair): 1 by the ecology's food links, 2 by its build (a pet
     * with no links: `huntsByBuild`), 0 not.
     */
    private eats(a: ReactiveInput, b: ReactiveInput): 0 | 1 | 2 {
        let row = this.eatsCache.get(a.slug);
        if (!row) {
            row = new Map();
            this.eatsCache.set(a.slug, row);
        }
        let v = row.get(b.slug);
        if (v === undefined) {
            v = foodLinked(a.intel, b.intel) ? 1 : huntsByBuild(a.intel, a.diet, b.intel, b.diet) ? 2 : 0;
            row.set(b.slug, v);
        }
        return v;
    }

    /**
     * Whether `a` would hunt `b`: it eats its kind (`eats`) and could take a body of that size (`canTake`, this
     * individual's own size: a cub is no threat to a zebra; a pet read by its build takes only small things, a third
     * of its weight). Across a fence or within a household it only watches it (`apart`).
     */
    private hunts(a: ReactiveInput, b: ReactiveInput): boolean {
        const kind = this.eats(a, b);
        if (!kind) return false;
        if (kind === 2) return bodyMass(b.plan, b.length) <= 0.35 * bodyMass(a.plan, a.length);
        return canTake(a.plan, a.length, huntCompany(a.intel.hunt, a.social), b.plan, b.length);
    }

    /** Whether `a` is a threat to `b`: it would hunt it (`hunts`) and nothing stands between them (`apart`: a zoo's fence, the habit of a home or a farm), or it is a much bigger hunter than the hunter `b` (`rival`). */
    private threatens(a: ReactiveInput, b: ReactiveInput): boolean {
        if (apart(a, b)) return false;
        return this.hunts(a, b) || this.rival(a, b);
    }

    /**
     * A hunter gives way to a much bigger hunter (a cheetah, a leopard or a jackal to a lion, a fox to a wolf, a cat
     * to a dog): both catch their food, both walk the ground, and `a` is at least two and a half times `b`'s weight.
     * `b` treats `a` as it would a predator (it watches, moves off, runs when it is close); `a` pays `b` no mind.
     */
    private rival(a: ReactiveInput, b: ReactiveInput): boolean {
        if (!RIVAL_PLANS.has(a.plan) || !RIVAL_PLANS.has(b.plan) || a.slug === b.slug) return false;
        let row = this.rivalCache.get(a.slug);
        if (!row) this.rivalCache.set(a.slug, (row = new Map()));
        let kind = row.get(b.slug);
        if (kind === undefined) {
            const catches = (i: ReactiveInput) => (i.diet === "meat" || i.diet === "carrion") && i.intel.hunt.some((h) => h !== "filter" && h !== "scavenge");
            kind = catches(a) && catches(b);
            row.set(b.slug, kind);
        }
        return kind && bodyMass(a.plan, a.length) >= 2.5 * bodyMass(b.plan, b.length);
    }

    /** Whether `predator` is creeping up on `me` here (the local stalk: `menaceOf`'s `stalkingMe`). */
    private stalks(predator: ReactiveInput, me: ReactiveInput): boolean {
        const its = this.agents.get(predator.id);
        return Boolean(its && its.mode === "stalk" && its.prey && its.prey.id === me.id);
    }

    /**
     * Its way with a predator close by, by rule, worked out once:
     *   - `ball`: its armour is its defence (armour listed first, or armour and a speed stat under 25: tortoises,
     *     armadillos, hedgehogs, snails), or it is fixed to its spot: it pulls in and stays put;
     *   - `flush`: a cryptic animal (stored freezing or camouflage): it holds still until the predator is almost on it;
     *   - `ground`: a small animal that lives in a burrow, a den or a crevice and runs for cover: it goes to ground
     *     at its refuge and keeps low there;
     *   - `bolt`: everything else runs, stops and looks back.
     */
    private styleOf(me: ReactiveInput, agent: Agent): NonNullable<Agent["style"]> {
        if (agent.style) return agent.style;
        const p = me.intel;
        let style: NonNullable<Agent["style"]> = "bolt";
        if (me.sessile || (p.defence.includes("armour") && (p.defence[0] === "armour" || (me.speed ?? 50) < 25))) style = "ball";
        else if (p.defence.includes("freeze")) style = "flush";
        else if (GROUND_ROOSTS.has(me.roost ?? "") && me.length < 1.2 && (p.defence.includes("flee_cover") || p.defence.includes("burrow"))) style = "ground";
        return (agent.style = style);
    }

    /** Armed so that a predator thinks twice whatever its size: a chemical defence (a skunk, a toad), or quills or spines it shows (armour and a threat display: a porcupine). */
    private armed(me: ReactiveInput): boolean {
        const d = me.intel.defence;
        return d.includes("chemical") || (d.includes("armour") && d.includes("threat"));
    }

    /**
     * Whether it stands its ground against this predator instead of running: it is armed (`armed`), or it is a
     * dominant animal (the dominance stat, 60 or more) at least half the predator's weight that has a threat display
     * of its own or is very dominant (68 or more): a buffalo or a boar before a lion or a leopard, a moose before
     * wolves; not a zebra, a deer or a rabbit, whatever their stamping.
     */
    private standsTo(me: ReactiveInput, predator: ReactiveInput): boolean {
        if (this.armed(me)) return true;
        const dominance = me.dominance ?? 0;
        if (dominance < 60) return false;
        if (!(me.intel.defence.includes("threat") || dominance >= 68)) return false;
        return bodyMass(me.plan, me.length) >= 0.5 * bodyMass(predator.plan, predator.length);
    }

    /** Closing up with its group: its offset with its distance from the group's middle cut to `share` of what it is (never onto the middle: a herd tightens, it does not pile up). */
    private closeUp(me: ReactiveInput, kin: ReactiveInput[], share: number): {x: number; z: number} {
        let cx = me.shared.x;
        let cz = me.shared.z;
        for (const k of kin) {
            cx += k.shared.x;
            cz += k.shared.z;
        }
        cx /= kin.length + 1;
        cz /= kin.length + 1;
        return {x: (cx - me.shared.x) * (1 - share), z: (cz - me.shared.z) * (1 - share)};
    }

    /** A sentinel species' group has one on watch at a time, the duty rotating every 40 s (seeded by the ids and the time). */
    private onWatch(me: ReactiveInput, around: (x: number, z: number, r: number) => ReactiveInput[], world: ReactiveWorld): boolean {
        if (!me.intel.sentinel) return false;
        const group = around(me.shared.x, me.shared.z, 15).filter((o) => o.slug === me.slug && !o.asleep);
        if (group.length < 2) return false;
        const shift = Math.floor(world.now / 40);
        let best = me;
        let bestScore = unit(me.id, "watch", shift);
        for (const o of group) {
            const s = unit(o.id, "watch", shift);
            if (s < bestScore || (s === bestScore && o.id < best.id)) {
                best = o;
                bestScore = s;
            }
        }
        return best.id === me.id;
    }

    /**
     * Which way it runs (worked out once, as its dash starts): to its first stored defence's refuge within three flee
     * reaches, else straight away. One that lives in a burrow, a den or a crevice makes for cover before anything else
     * (a meerkat to its bolt-hole, not to the middle of its mob). A herd runs as one: each for a point past the middle
     * of its group on the side away from the threat (`from`), so they close up and go the same way.
     */
    private fleeDirection(me: ReactiveInput, agent: Agent, away: {x: number; z: number}, world: ReactiveWorld, kin: ReactiveInput[], aerial = false, from: {x: number; z: number} | null = null): {x: number; z: number} {
        const p = me.intel;
        const reach = this.envelope(me, true) * 3;
        const pick = (kind: RefugeKind) => (world.refuge ? world.refuge(me.shared.x, me.shared.z, kind, reach) : null);
        let goal: {x: number; z: number} | null = null;
        // Overhead danger: any cover first, its group only if there is none.
        const order = aerial ? [...p.defence.filter((d) => d !== "group"), ...p.defence.filter((d) => d === "group")] : p.defence;
        if (aerial && !p.defence.some((d) => d === "flee_cover" || d === "burrow" || d === "flee_tree")) {
            goal = pick("cover") ?? pick("tree");
        }
        if (!goal && this.styleOf(me, agent) === "ground") goal = pick("cover") ?? (agent.memory.spots.roost ? agent.memory.spots.roost : null);
        for (const d of goal ? [] : order) {
            if (d === "flee_water") goal = pick("water");
            else if (d === "flee_tree") goal = pick("tree");
            else if (d === "flee_cover" || d === "burrow") goal = pick("cover") ?? (agent.memory.spots.roost ? agent.memory.spots.roost : null);
            else if (d === "group" && kin.length) {
                let cx = me.shared.x;
                let cz = me.shared.z;
                for (const k of kin) {
                    cx += k.shared.x;
                    cz += k.shared.z;
                }
                cx /= kin.length + 1;
                cz /= kin.length + 1;
                // Past the group's middle, away from the threat as the group sees it. (From a chase, `from` null: the
                // middle itself, each coming at it from its own fanned way: they scatter.)
                const ax = from ? cx - from.x : 0;
                const az = from ? cz - from.z : 0;
                const al = Math.hypot(ax, az) || 1;
                const out = from ? this.envelope(me, true) : 0;
                goal = {x: cx + (ax / al) * out, z: cz + (az / al) * out};
            }
            if (goal) break;
        }
        if (!goal) return away;
        const gx = goal.x - me.shared.x - agent.offset.x;
        const gz = goal.z - me.shared.z - agent.offset.z;
        const gl = Math.hypot(gx, gz);
        if (gl < 0.2) return away;
        // Toward the refuge, unless that means running at the threat: then away, bent toward it.
        const toward = {x: gx / gl, z: gz / gl};
        const dot = toward.x * away.x + toward.z * away.z;
        const mix = dot < -0.2 ? 0.25 : 0.7;
        const x = away.x * (1 - mix) + toward.x * mix;
        const z = away.z * (1 - mix) + toward.z * mix;
        const l = Math.hypot(x, z) || 1;
        return {x: x / l, z: z / l};
    }

    private updateNeeds(agent: Agent, me: ReactiveInput, world: ReactiveWorld, dt: number) {
        const n = agent.needs;
        const doing = me.shared.doing;
        const resting = RESTING.has(doing);
        n.energy = clamp01(n.energy + dt * (resting ? 0.01 : me.shared.moving ? -0.006 : -0.002));
        n.thirst = doing === "drink" ? clamp01(n.thirst - dt * 0.08) : clamp01(n.thirst + dt * 0.003);
        n.hunger = FEEDING.has(doing) && doing !== "drink" ? clamp01(n.hunger - dt * 0.03) : clamp01(n.hunger + dt * 0.004);
        // Comfort: rain, a storm, the midday heat in the open.
        const heat = Math.max(0, Math.exp(-(((world.hours - 13.5) / 2.2) ** 2)) - 0.3) * (1 - world.weather.rain) * (world.night < 0.2 ? 1 : 0);
        const wet = world.weather.rain * 0.7 + world.weather.storm * 0.6;
        n.comfort = clamp01(1 - wet - heat * 0.6);
        n.curiosity = clamp01(n.curiosity + dt * 0.02 * (0.5 + me.intel.curiosity) * (agent.choice === "investigate_camera" || agent.choice === "watch_camera" ? -4 : 1));
        // (A predator it has settled to tolerating no longer keeps it on edge: its wariness does, `choose`.)
        n.safety = agent.threat && agent.threat.settledAt === null ? 0 : clamp01(n.safety + dt * 0.05);
    }

    /**
     * Getting used to the camera. Near it and the camera not coming at it, an animal habituates in its own few seconds
     * (3–7 s, half as long again for a shy one, longer for a very curious species) and goes back to its business; a camera walking at it (closing faster
     * than 0.3 m/s) renews its attention; away from it, it forgets slowly (a minute).
     */
    private updateCamera(me: ReactiveInput, agent: Agent, world: ReactiveWorld, dt: number) {
        const cam = world.camera;
        if (!cam) return;
        const d = Math.hypot(cam.x - me.shared.x, cam.z - me.shared.z);
        const closing = d > 1e-3 ? ((me.shared.x - cam.x) * this.camVel.x + (me.shared.z - cam.z) * this.camVel.z) / d : 0;
        agent.camApproach = closing > 0.3;
        const within = Math.min(me.intel.sight * 0.5, 14);
        // (A very curious species takes longer over it: a chimpanzee up to 2.5x as long as a deer.)
        const habTime = (3 + 4 * unit(me.id, "cam-hab")) * (agent.personality.boldness < -0.3 ? 1.5 : 1) * (1 + 3 * Math.max(me.intel.curiosity - 0.5, 0));
        const near = d < within;
        // The moment it first notices the camera (or the camera starts coming at it): head up and a look at it for a
        // second or two (one that pays a still camera no attention just carries on), then it decides again.
        const noticed = (near && !agent.camNear) || (near && agent.camApproach && agent.camHab > 0.5);
        if (noticed && !REACTING.has(agent.mode) && (agent.camApproach || !ignoresCamera(me))) {
            agent.choice = "watch_camera";
            agent.choiceUntil = world.now + 1 + 1.5 * unit(me.id, "cam-glance", Math.floor(world.now));
            agent.lookAt = null;
        }
        agent.camNear = near;
        // Watching it is how it gets used to it; going about its business it gets used to it more slowly.
        const attending = agent.choice === "watch_camera" || agent.choice === "investigate_camera" || agent.choice === "back_off_camera";
        if (!near) agent.camHab = Math.max(agent.camHab - dt / 60, 0);
        else if (agent.camApproach) agent.camHab = Math.max(agent.camHab - dt * 0.5, 0);
        else agent.camHab = Math.min(agent.camHab + dt / (attending ? habTime : habTime * 1.5), 1);
    }

    /** The calm choice with the best score now: needs × what it is doing × who it is, plus its own seeded noise. */
    private choose(me: ReactiveInput, agent: Agent, world: ReactiveWorld, kin: ReactiveInput[], byId: Map<string, ReactiveInput>): ReactiveAction {
        const p = me.intel;
        const n = agent.needs;
        const person = agent.personality;
        const doing = me.shared.doing;
        const scores: Array<[ReactiveAction, number]> = [];
        const noise = (k: string) => 0.35 * unit(me.id, k, Math.floor((world.now + 7 * unit(me.id, "noise-offset")) / 5));
        const add = (a: ReactiveAction, s: number, minRepertoire = 0) => {
            if (p.repertoire >= minRepertoire && s > 0) scores.push([a, s + noise(a) + (a === agent.choice ? 0.12 : 0)]);
        };
        const groupSize = kin.length + 1;
        // Vigilance: alone it looks up a lot; in a herd less ("many eyes"); a sentinel group leaves it to the sentinel.
        const sentinelGroup = p.sentinel && groupSize > 1;
        // At the edge of its group it looks up more than in the middle of it (the edge effect: Elgar 1989, Biol. Rev. 64):
        // `edge` is 0 with its group all round it, 1 with all of them to one side.
        let edge = 0;
        if (p.manyEyes && kin.length >= 2) {
            let sx = 0;
            let sz = 0;
            for (const k of kin) {
                const kx = k.shared.x - me.shared.x;
                const kz = k.shared.z - me.shared.z;
                const kl = Math.hypot(kx, kz) || 1;
                sx += kx / kl;
                sz += kz / kl;
            }
            edge = Math.min(Math.hypot(sx, sz) / kin.length, 1);
        }
        const edged = kin.length >= 2 && p.manyEyes ? 0.7 + 0.7 * edge : 1;
        // (A predator in sight that it tolerates, or a scare just over, keeps it looking up: `wary`.)
        // (While it tolerates a predator in sight its extra looks come in bouts, below: the remembered-predator and
        // wary terms here, renewed every moment the predator is seen, had a lone animal looking round 96% of the time
        // and feeding 4%: this score against feeding's is a fine balance, and 0.15 more tips it nearly every time.)
        const tolerating = Boolean(agent.wary && agent.wary.id !== null);
        const vigilance = ((0.55 + 0.4 * (1 - n.safety) + (tolerating ? 0 : (agent.memory.predators.length ? 0.3 : 0) + (agent.wary ? 0.15 : 0))) / Math.sqrt(p.manyEyes ? groupSize : 1)) * edged * (sentinelGroup ? 0.5 : 1) * (1 - person.boldness * 0.2);
        // On watch in the shared layer (a predator in sight at its slot's start, or its turn to keep watch): it looks round.
        add("scan", vigilance + (doing === "watch" ? 0.9 : 0));
        // In a group it still lifts its head in bouts of its own (seeded, a few seconds each): about one moment in six
        // in a group of five, one in nine in a dozen (alone it is the score above, about one in three), more at the
        // edge, more with a predator about, half as much where a sentinel keeps the watch. (Before the behaviours pass
        // a herd of five had a head up 4% of the time: the score above over the square root of the group lost to
        // feeding nearly always.) Individual vigilance falls with group size while the group's rises: Roberts 1996,
        // Anim. Behav. 51.
        // Alone (or of a kind that keeps no common watch) it has such bouts only while it is wary: a quarter of the time,
        // on top of its own looking round, so beside a predator it tolerates its head is up about half the time.
        const grouped = kin.length > 0 && p.manyEyes;
        if (grouped || agent.wary) {
            const share = grouped ? Math.min((0.3 / Math.pow(groupSize, 0.4)) * edged * (agent.wary ? 1.8 : 1) * (sentinelGroup ? 0.5 : 1) * (1 - person.boldness * 0.2), 0.6) : 0.25;
            if (unit(me.id, "vigil", Math.floor((world.now + 9 * unit(me.id, "vigil-phase")) / 4)) < share) add("scan", 3);
        }
        if (sentinelGroup && this.isSentinel(me, kin, world)) add("sentinel", 2);
        if (FEEDING.has(doing)) add(doing === "drink" ? "drink" : "feed", 0.6 + (doing === "drink" ? n.thirst : n.hunger));
        if (RESTING.has(doing) && n.energy < 0.6) add("doze", 0.5 + (0.6 - n.energy));
        if (kin.length) {
            add("look_kin", 0.25 + 0.3 * n.social);
            const nearest = Math.min(...kin.map((k) => Math.hypot(k.shared.x - me.shared.x, k.shared.z - me.shared.z)));
            if (nearest > me.length * 4 * person.personalSpace) add("approach_kin", 0.3 + 0.5 * n.social, 5);
        }
        if (["quadruped", "primate", "flying_bird", "walking_bird", "bat", "flightless_bird"].includes(me.plan) && RESTING.has(doing)) add("groom", 0.25 + 0.2 * (1 - n.comfort), 5);
        if (n.comfort < 0.6) add("shelter", 0.5 + (0.6 - n.comfort) * 1.6);
        const cam = world.camera;
        if (cam) {
            const d = Math.hypot(cam.x - me.shared.x, cam.z - me.shared.z);
            const within = Math.min(p.sight * 0.5, 14);
            // Some pay a still camera no attention at all (more of them the less curious the species); a camera walking
            // at it gets everyone's attention.
            const ignores = ignoresCamera(me);
            const fresh = 1 - agent.camHab;
            if (d < within && (!ignores || agent.camApproach) && fresh > 0.05) {
                const interest = n.curiosity * (0.3 + p.curiosity) * (0.6 + person.curiosity) * person.glanceRate;
                add("watch_camera", (0.2 + interest * 0.6) * fresh, 4);
                // Only a curious species' bold ones come closer to look; the rest watch from where they are.
                if (person.boldness > -0.1 && p.curiosity >= 0.6) add("investigate_camera", (0.1 + interest * 1.3 + 0.5 * p.curiosity * (p.repertoire >= 9 ? 1 : 0.5)) * (0.3 + 0.7 * fresh), 7);
                // A shy one moves off from a camera coming at it, or one too close, until it is used to it.
                // (Never a kept one: a pet, a farm or a zoo animal is used to people.)
                if (!me.kept && person.boldness < -0.3 && (agent.camApproach || d < p.flight * 0.6)) add("back_off_camera", (1 + (0.6 - person.boldness)) * (agent.camApproach ? 1 : fresh), 0);
            }
        }
        // The young play a lot; an adult only in its own bouts (a seeded 45 s window, more of them the more playful it is).
        const adultBout = unit(me.id, "play-bout", Math.floor(world.now / 45)) < p.play * 0.45;
        const play = Math.max(adultBout ? p.play * (p.repertoire >= 9 ? 1 : 0.4) : 0, me.youngPlay ?? 0);
        if (play > 0.2 && n.energy > 0.5 && (kin.length || me.youngPlay)) add("play", play * 0.9, 0);
        if (p.tools && FEEDING.has(doing) && doing !== "drink") add("use_tool", 0.7 + 0.3 * n.hunger, 7);
        if (p.forage.includes("cache") && FEEDING.has(doing) && doing !== "drink") {
            const cache = agent.memory.spots.cache;
            if (!cache) add("cache_bury", 0.9 + 0.3 * (1 - n.hunger), 0);
            else if (world.now - cache.t > 20 && Math.hypot(cache.x - me.shared.x, cache.z - me.shared.z) < this.envelope(me, false) + 2) add("cache_return", 1.1 + n.hunger, 0);
            else add("cache_bury", 0.4, 0);
        }
        if (p.mixed && FEEDING.has(doing)) add("follow_mixed", 0.7, 0);
        // A more dominant one at the same water or food spot: wait its turn (a grazing herd spread over the grass does not queue).
        if ((doing === "drink" || me.shared.spot) && this.dominantAt(me, byId)) add("wait_turn", 2.2);
        if (!scores.length) return "scan";
        scores.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
        return scores[0][0];
    }

    private isSentinel(me: ReactiveInput, kin: ReactiveInput[], world: ReactiveWorld): boolean {
        const shift = Math.floor(world.now / 40);
        const mine = unit(me.id, "watch", shift);
        return kin.every((k) => unit(k.id, "watch", shift) > mine || (unit(k.id, "watch", shift) === mine && k.id > me.id));
    }

    /** A more dominant animal (any species) doing the same thing within reach: the dominance stat, then size, then id. */
    private dominantAt(me: ReactiveInput, byId: Map<string, ReactiveInput>): ReactiveInput | null {
        let found: ReactiveInput | null = null;
        void byId;
        for (const other of this.around(me.shared.x, me.shared.z, Math.max(me.length * 2.2 + 3, 5))) {
            if (other.id === me.id || other.asleep || other.shared.doing !== me.shared.doing) continue;
            const d = Math.hypot(other.shared.x - me.shared.x, other.shared.z - me.shared.z);
            const sameSpot = me.shared.spot ? other.shared.spot === me.shared.spot : me.shared.doing === "drink";
            if (!sameSpot || d > Math.max(me.length, other.length) * 2.2) continue;
            const a = [other.dominance ?? 0, other.size ?? 0];
            const b = [me.dominance ?? 0, me.size ?? 0];
            const higher = a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : other.id < me.id;
            if (higher && (!found || d < Math.hypot(found.shared.x - me.shared.x, found.shared.z - me.shared.z))) found = other;
        }
        return found;
    }

    private calmAction(me: ReactiveInput, agent: Agent, action: ReactiveAction, world: ReactiveWorld, kin: ReactiveInput[], byId: Map<string, ReactiveInput>) {
        const reach = this.envelope(me, false);
        const walk = 0.8 * Math.max(me.length, 0.3);
        // (Its own business brings it back toward its shared place; wary, it stays where it went to.)
        const ease = agent.wary ? 1 : 0.98;
        const res = {target: {x: agent.offset.x * ease, z: agent.offset.z * ease}, speed: walk, crouch: 0, look: null as Vec3 | null, label: null as string | null, face: null as number | null};
        const ahead = (dist: number, down: number) => ({x: me.shared.x + Math.sin(me.shared.yaw) * dist, y: me.shared.y + down, z: me.shared.z + Math.cos(me.shared.yaw) * dist});
        switch (action) {
            case "feed":
            case "drink":
                // Head down to the food or the water, a little to one side now and then; up at the leaves while it browses.
                res.look = ahead(me.length * 0.9, me.shared.doing === "browse" ? me.headHeight ?? me.length * 0.6 : 0);
                res.label = "spot";
                agent.memory.spots[action === "drink" ? "water" : "food"] = {x: me.shared.x, z: me.shared.z};
                break;
            case "doze":
                res.look = ahead(me.length * 2, me.length * 0.1);
                res.crouch = 0.3;
                break;
            case "look_kin":
            case "approach_kin": {
                const k = kin.slice().sort((a, b) => unit(me.id, a.id) - unit(me.id, b.id))[0];
                if (k) {
                    res.look = {x: k.shared.x, y: k.shared.y + k.length * 0.5, z: k.shared.z};
                    res.label = k.id;
                    if (action === "approach_kin") {
                        const ux = k.shared.x - me.shared.x;
                        const uz = k.shared.z - me.shared.z;
                        const ul = Math.hypot(ux, uz) || 1;
                        res.target = {x: (ux / ul) * reach, z: (uz / ul) * reach};
                    }
                }
                break;
            }
            case "groom":
                // A turn of the head to its flank and back.
                res.look = {x: me.shared.x - Math.sin(me.shared.yaw) * me.length * 0.4 + Math.cos(me.shared.yaw) * me.length * 0.3 * Math.sin(world.now * 1.3 + unit(me.id, "groom") * 6), y: me.shared.y + me.length * 0.25, z: me.shared.z - Math.cos(me.shared.yaw) * me.length * 0.4};
                break;
            case "watch_camera":
            case "investigate_camera":
            case "back_off_camera": {
                const cam = world.camera;
                if (!cam) break;
                res.look = {x: cam.x, y: cam.y, z: cam.z};
                res.label = "camera";
                const ux = cam.x - me.shared.x;
                const uz = cam.z - me.shared.z;
                const ul = Math.hypot(ux, uz) || 1;
                if (action === "investigate_camera") {
                    // A few careful steps closer (up to a few body lengths: `investigateReach`), never right up to it.
                    const stop = Math.max(ul - Math.max(me.length * 2.5, 1.5), 0);
                    const step = Math.min(stop, this.investigateReach(me));
                    res.target = {x: (ux / ul) * step, z: (uz / ul) * step};
                    res.speed = walk * 0.6;
                    res.face = Math.atan2(ux, uz);
                } else if (action === "back_off_camera") {
                    res.target = {x: (-ux / ul) * reach, z: (-uz / ul) * reach};
                    res.speed = walk * 1.6;
                    if (!agent.memory.disturbances.some((d) => world.now - d.t < 5)) agent.memory.disturbances.push({x: cam.x, z: cam.z, t: world.now});
                }
                break;
            }
            case "play": {
                // Play in bursts, its own rhythm (seeded beats of 0.9–1.4 s): a short dash to a new spot near its own,
                // a pause, a play-bow (down at the front: drawn as a crouch) facing its playmate. It faces the way it dashes.
                const beat = 0.9 + 0.5 * unit(me.id, "play-beat");
                const n = Math.floor((world.now + 10 * unit(me.id, "play-phase")) / beat);
                const kind = unit(me.id, "play-kind", n);
                const k = kin[0];
                if (kind < 0.45) {
                    const a = unit(me.id, "play-dir", n) * Math.PI * 2;
                    const r = reach * (0.25 + 0.35 * unit(me.id, "play-r", n));
                    res.target = {x: Math.sin(a) * r, z: Math.cos(a) * r};
                    res.speed = walk * 2.5;
                } else if (kind > 0.8 && k) {
                    res.crouch = 0.7;
                    res.face = Math.atan2(k.shared.x - me.shared.x - agent.offset.x, k.shared.z - me.shared.z - agent.offset.z);
                }
                if (k) {
                    res.look = {x: k.shared.x, y: k.shared.y + k.length * 0.4, z: k.shared.z};
                    res.label = k.id;
                }
                break;
            }
            case "shelter": {
                const spot = world.refuge?.(me.shared.x, me.shared.z, "shade", reach * 4) ?? world.refuge?.(me.shared.x, me.shared.z, "cover", reach * 4) ?? null;
                if (spot) res.target = {x: spot.x - me.shared.x, z: spot.z - me.shared.z};
                res.crouch = 0.45;
                res.look = ahead(me.length * 1.5, -me.length * 0.1);
                // Back to the wind and rain.
                res.face = world.weather.windDirection + Math.PI / 2;
                break;
            }
            case "use_tool":
                // Head down and working: the strikes of a stone or a stick (its own beat).
                res.look = ahead(me.length * 0.7, me.length * 0.1 * Math.sin(world.now * 6 + unit(me.id, "tool") * 6));
                res.label = "spot";
                break;
            case "cache_bury": {
                // Off a step to a spot of its own, head down to dig; the spot is remembered.
                const a = unit(me.id, "cache-dir", Math.floor(world.now / 30)) * Math.PI * 2;
                res.target = {x: Math.sin(a) * reach * 0.8, z: Math.cos(a) * reach * 0.8};
                res.look = {x: me.shared.x + res.target.x + Math.sin(a) * me.length * 0.6, y: me.shared.y, z: me.shared.z + res.target.z + Math.cos(a) * me.length * 0.6};
                res.label = "spot";
                const there = Math.hypot(agent.offset.x - res.target.x, agent.offset.z - res.target.z) < me.length * 0.5;
                if (there && !agent.memory.spots.cache) agent.memory.spots.cache = {x: me.shared.x + agent.offset.x, z: me.shared.z + agent.offset.z, t: world.now};
                break;
            }
            case "cache_return": {
                const c = agent.memory.spots.cache;
                if (!c) {
                    agent.choiceUntil = world.now;
                    break;
                }
                res.target = {x: c.x - me.shared.x, z: c.z - me.shared.z};
                res.look = {x: c.x, y: me.shared.y, z: c.z};
                res.label = "spot";
                if (Math.hypot(me.shared.x + agent.offset.x - c.x, me.shared.z + agent.offset.z - c.z) < me.length * 0.6) {
                    // Found and eaten: the next one is buried somewhere else.
                    agent.needs.hunger = Math.max(agent.needs.hunger - 0.4, 0);
                    if (world.now - c.t > 26) agent.memory.spots.cache = undefined;
                }
                break;
            }
            case "follow_mixed": {
                // Behind a grazer of another species, picking at what it stirs up.
                let host: ReactiveInput | null = null;
                for (const o of this.around(me.shared.x, me.shared.z, 10)) {
                    if (o.slug === me.slug || o.asleep || !(o.diet === "grazer" || o.diet === "browser")) continue;
                    const d = Math.hypot(o.shared.x - me.shared.x, o.shared.z - me.shared.z);
                    if (d < 10 && (!host || d < Math.hypot(host.shared.x - me.shared.x, host.shared.z - me.shared.z))) host = o;
                }
                if (host) {
                    const bx = host.shared.x - Math.sin(host.shared.yaw) * host.length * 1.2 - me.shared.x;
                    const bz = host.shared.z - Math.cos(host.shared.yaw) * host.length * 1.2 - me.shared.z;
                    res.target = {x: bx, z: bz};
                    res.look = {x: host.shared.x, y: me.shared.y, z: host.shared.z};
                    res.label = host.id;
                }
                break;
            }
            case "wait_turn": {
                const top = this.dominantAt(me, byId);
                if (top) {
                    const ux = me.shared.x - top.shared.x;
                    const uz = me.shared.z - top.shared.z;
                    const ul = Math.hypot(ux, uz) || 1;
                    res.target = {x: (ux / ul) * reach, z: (uz / ul) * reach};
                    res.look = {x: top.shared.x, y: top.shared.y + top.length * 0.5, z: top.shared.z};
                    res.label = top.id;
                } else agent.choiceUntil = world.now;
                break;
            }
            case "sentinel":
                // Up and still, scanning wide (the scan in stepLook), a little higher than usual.
                res.crouch = -0.2;
                break;
            default:
                break;
        }
        return res;
    }

    private moveOffset(agent: Agent, target: {x: number; z: number}, speed: number, dt: number, reach: number) {
        const dx = target.x - agent.offset.x;
        const dz = target.z - agent.offset.z;
        const d = Math.hypot(dx, dz);
        const step = Math.min(d, speed * dt);
        if (d > 1e-6) {
            agent.offset.x += (dx / d) * step;
            agent.offset.z += (dz / d) * step;
        }
        const l = Math.hypot(agent.offset.x, agent.offset.z);
        if (l > reach && l > 0) {
            // Over the edge (the envelope narrowed as the flight ended): back in at the animal's walk, never a jump.
            const back = Math.max(l - Math.max(speed, 0.25) * dt, reach);
            agent.offset.x *= back / l;
            agent.offset.z *= back / l;
        }
    }

    /** A stalking predator stops short of its prey (where the prey is drawn, its own offset included). */
    private keepShort(me: ReactiveInput, agent: Agent, prey: ReactiveInput) {
        const preyOffset = this.agents.get(prey.id)?.offset ?? {x: 0, z: 0};
        const px = prey.shared.x + preyOffset.x;
        const pz = prey.shared.z + preyOffset.z;
        const mx = me.shared.x + agent.offset.x;
        const mz = me.shared.z + agent.offset.z;
        const gap = minGap(me, prey);
        const d = Math.hypot(mx - px, mz - pz);
        if (d >= gap) return;
        // Back along the line from the prey to the gap (or, if the shared layer itself has them closer, no nearer than that).
        const sharedD = Math.hypot(me.shared.x - px, me.shared.z - pz);
        const want = Math.min(gap, sharedD);
        if (d >= want) return;
        const ux = d > 1e-6 ? (mx - px) / d : 1;
        const uz = d > 1e-6 ? (mz - pz) / d : 0;
        agent.offset.x = px + ux * want - me.shared.x;
        agent.offset.z = pz + uz * want - me.shared.z;
    }

    private stepLook(me: ReactiveInput, agent: Agent, look: Vec3 | null, scan: boolean, world: ReactiveWorld, dt: number, limits: HeadLimits, faceYaw: number | null, action: ReactiveAction, moveDir: number | null = null) {
        const head = {x: me.shared.x + agent.offset.x, y: me.shared.y + (me.headHeight ?? me.length * 0.5), z: me.shared.z + agent.offset.z};
        const bodyNow = me.shared.yaw + agent.bodyYaw;
        let want: {yaw: number; pitch: number};
        if (look) want = lookAngles(head, bodyNow, look);
        else if (scan) {
            // Idle scanning: a seeded sweep of looks, each held its own time; a sentinel looks wider and higher.
            if (world.now >= agent.scanUntil) {
                agent.scanIndex++;
                agent.scanUntil = world.now + 0.8 + 2.4 * unit(me.id, "scan-hold", agent.scanIndex);
            }
            const wide = action === "sentinel" ? 1 : action === "alert" ? 0.9 : 0.7;
            want = {yaw: (unit(me.id, "scan-yaw", agent.scanIndex) * 2 - 1) * limits.yaw * wide, pitch: (unit(me.id, "scan-pitch", agent.scanIndex) - 0.35) * 0.3 + (action === "sentinel" ? 0.12 : 0)};
        } else want = {yaw: 0, pitch: action === "feed" || action === "drink" ? -limits.down : 0};
        // The body (radians off the shared heading). Moving, it faces the way it goes. A deliberate facing (a display at a
        // threat, investigating the camera) turns it there. Watching something, the head goes first and the body turns only
        // when the head can't follow (past its limit), squaring up to it, and then holds: a dead zone, so it does not hunt
        // back and forth (before, the body's share of the look was set back to nothing as soon as the head could reach,
        // so a watcher swung to and fro). A calm look (a herd mate, its own flank, a spot) is the head's alone. With
        // nothing to watch it comes back to the shared heading, and while the shared layer walks it, it keeps to it.
        const moving = moveDir !== null;
        if (moving) agent.bodyGoal = wrapAngle(moveDir! - me.shared.yaw);
        else if (world.now < agent.moveHold) {
            // A move easing off: it keeps the move's facing a moment (no flick).
        } else if (faceYaw !== null) agent.bodyGoal = wrapAngle(faceYaw - me.shared.yaw);
        else if (me.shared.moving) agent.bodyGoal = 0;
        else if (look && BODY_WATCH.has(action)) {
            if (limits.bodyAfter > 0 && Math.abs(want.yaw) > limits.yaw) agent.bodyGoal = wrapAngle(agent.bodyYaw + want.yaw);
        } else agent.bodyGoal = 0;
        // At its own pace: big animals turn slower (the behaviour lane's turn rate, 1.8 / length^0.4 rad/s, 0.7–3.5), moving twice that.
        const rate = Math.min(Math.max(1.8 / Math.pow(Math.max(me.length, 0.1), 0.4), 0.7), 3.5) * (moving || action === "flee" ? 2 : 1);
        const d = wrapAngle(agent.bodyGoal - agent.bodyYaw);
        agent.bodyYaw = wrapAngle(agent.bodyYaw + Math.sign(d) * Math.min(Math.abs(d), rate * dt, Math.abs(d) * Math.min(dt * 8, 1) + rate * dt * 0.15));
        const relative = look ? lookAngles(head, me.shared.yaw + agent.bodyYaw, look) : want;
        agent.head = stepHead(agent.head, relative, dt, limits);
    }

    /** Asleep or aloft: no reaction; the offset, the head and the body turn ease back (never a jump). */
    private relax(agent: Agent, me: ReactiveInput, dt: number, limits: HeadLimits) {
        agent.mode = me.asleep ? "asleep" : "aloft";
        const walk = Math.max(me.length, 0.3) * 0.8;
        this.moveOffset(agent, {x: 0, z: 0}, walk, dt, this.envelope(me, false));
        agent.head = stepHead(agent.head, {yaw: 0, pitch: 0}, dt, limits);
        agent.bodyYaw += -agent.bodyYaw * Math.min(dt * 2, 1);
        agent.crouch += -agent.crouch * Math.min(dt * 3, 1);
    }

    private reset(agent: Agent) {
        agent.offset = {x: 0, z: 0};
        agent.head = {yaw: 0, pitch: 0};
        agent.bodyYaw = 0;
        agent.crouch = 0;
        agent.mode = "off";
        agent.threat = null;
        agent.heard = null;
        agent.prey = null;
        agent.wary = null;
        agent.dash = null;
        agent.response = null;
        agent.scare = 0;
        agent.flushed = false;
    }

    private output(agent: Agent, me: ReactiveInput, action: ReactiveAction, called: boolean, alarmed: number, looking: string | null, awake: boolean): ReactiveOut {
        const limits = headLimits(me.plan, me.slug);
        const weight = limits.yaw > 0 ? 1 : 0;
        return {
            dx: agent.offset.x,
            dz: agent.offset.z,
            bodyYaw: agent.bodyYaw,
            headYaw: agent.head.yaw,
            headPitch: agent.head.pitch,
            headWeight: awake ? weight : weight * Math.min(Math.hypot(agent.head.yaw, agent.head.pitch) * 4, 1),
            crouch: Math.max(agent.crouch, 0),
            action,
            called,
            alarmed,
            looking,
            woke: Boolean(me.asleep && agent.woke),
            startled: Boolean(me.asleep && agent.woke && this.now - agent.woke.at < 0.6),
            response: awake ? agent.response : null
        };
    }
}

/**
 * Whether something stands between two animals so that neither is hunter or prey to the other: a zoo animal's fence
 * (and the ones it shares its enclosure with it has lived beside since it came: the aviary's buzzard and its
 * cockatiels), or habit (both are kept at homes or on farms: the yard dog, the cat and the hens know one another).
 * A hunter still watches what it would hunt across the fence or the room; it never stalks it, and the other pays it
 * no mind. Wild animals and kept ones are hunter and prey as anywhere: the garden's sparrows and the house cat, the
 * farm's hens and a fox.
 */
function apart(a: ReactiveInput, b: ReactiveInput): boolean {
    if (a.kept === "zoo" || b.kept === "zoo") return true;
    return Boolean(a.kept && b.kept);
}

/** It pays a still camera no attention at all (seeded per animal; more of them the less curious the species). */
function ignoresCamera(me: ReactiveInput): boolean {
    return unit(me.id, "ignores-camera") < 0.25 + 0.5 * (1 - me.intel.curiosity);
}

function clamp01(v: number): number {
    return Math.min(Math.max(v, 0), 1);
}
