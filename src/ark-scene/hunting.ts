/**
 * Encounter hunting in the scene (AnimalDex docs/ark/encounter-hunting.md): a due predator walks its forays.
 *
 * Under `hunting = 'encounter'` the server hunts on 15-Ark-minute steps (step k is Ark day k / 96, 34.5 real seconds):
 * a predator whose next hunt (`hunt_from_ark_day`, `voyage_hunting_v1`) has come and that is awake is at
 * `forayAt(home, id, k)` at step k, and eats a prey it finds within its detection range there. The scene draws that,
 * from the same shared position module (`positions/positions.ts`): at every step's moment the hunter is at the server's
 * waypoint (or waiting within `HUNT_STATION_AGREE` of it), so a meal's chase starts from where the server found it
 * (`acts.ts` encounterBodies, `ENCOUNTER_AGREE`).
 *
 * Between the steps it hunts the way its kind does (behaviours pass 2026-11, lane B1; docs/ark/behaviour-pass-2026-11/
 * hunt.md): `huntStyle`, by rule from its stored hunt style (`intelligence-profile.ts`), how it moves, its diet and its
 * flight style. Two families:
 *
 * - stationed: it goes from one waypoint to the next at its own pace, in bouts, and waits, looks or feeds between them
 *   (`wait`: a crocodile, a snake, a spider, a frog hold still and move on in one slow go, and stay put while the
 *   waypoints stay near; `stalk`: a cat prowls and stops to look; `forage`: a boar, a monkey, a goose nose down;
 *   `lurk`: a pike hangs in the water; `wade`: a heron stands in the shallows; `perch`: a kingfisher flies from perch to
 *   perch; `glean`: a robin flits to the next spot and pecks);
 * - on the move: a path through the waypoints at its own pace, longer than the straight line (`course`: a wolf's
 *   trot, with a stop to look at each waypoint; `cruise`: a shark; `soar`: a buzzard's circles, high; `quarter`: a
 *   hawk's low sweeps; `hawk`: a swallow's, a bat's or a dragonfly's quick loops).
 *
 * Into a hunt it leaves its schedule's place as late as its own pace allows and arrives as the hunt begins; out of one
 * it goes back at its own pace, over up to `LEAD_STEPS` steps, so it neither jumps nor sprints. Everything is a function
 * of the time, its id and what the server sent: the same for every viewer. With no hunting read (the pool,
 * development's fixtures, the visual CI) this layer is off and every animal is exactly as before.
 *
 * Its home here is the module's (the server's) spot for its slot; `spaceHomes` keeps a resting predator's home a safe
 * distance from its prey as before, and applies only while it is not hunting.
 */
import {ARK_DAY_MS, STEPS_PER_ARK_DAY, awakeAt, decodeAtlas, forayAt, forayRadius, hashString, homeOf, mediumAt, stepIndex, type Atlas, type Home, type Sheet} from "@/ark-scene/positions/positions";
import {behaviourProfile, bodyLengthsPerSecond} from "@/ark-scene/behaviour-profile";
import type {ArkBeat, ArkDoing, TripPose} from "@/ark-scene/behaviour-schedule";
import {intelProfile, type ArkHunt} from "@/ark-scene/intelligence-profile";
import {hipShare, sprintPace} from "@/ark-scene/locomotion/flee";
import {flightPaces, flightSpec} from "@/ark-scene/locomotion/flight";
import {locoStyle} from "@/ark-scene/locomotion/styles";
import {swimPaces} from "@/ark-scene/locomotion/swim";
import type {ArkAnimal} from "@/ark-scene/types";
import type {ArkHunting} from "@/lib/ark-hunting";
import pin from "@/ark-scene/positions/PIN.json";

export type HuntPose = TripPose & {doing: ArkDoing};

/**
 * The atlas (1.6 MB) as a static file (`scripts/build-ark-bundle.mjs` copies it to public/ark/), read only when the
 * Ark hunts by encounter: never in the scene's bundle. Versioned by its pinned hash, so a new atlas is never a stale one.
 */
export const POSITIONS_ATLAS_URL = `/ark/positions-atlas.json?v=${pin.sha256["atlas.json"].slice(0, 12)}`;

let atlasLoad: Promise<Atlas> | null = null;

export function loadPositionsAtlas(url = POSITIONS_ATLAS_URL): Promise<Atlas> {
    atlasLoad ??= fetch(url)
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`atlas ${response.status}`))))
        .then((raw) => decodeAtlas(raw))
        .catch((error) => {
            // (Asked again at the next hunting read.)
            atlasLoad = null;
            throw error;
        });
    return atlasLoad;
}

// MARK: How each kind hunts

export type HuntStyle = "wait" | "stalk" | "forage" | "course" | "lurk" | "cruise" | "soar" | "quarter" | "hawk" | "perch" | "wade" | "glean";

/** The styles that keep moving along a path through the waypoints (the rest go from one to the next and wait). */
const ON_THE_MOVE: ReadonlySet<HuntStyle> = new Set<HuntStyle>(["course", "cruise", "soar", "quarter", "hawk"]);

/**
 * How a species searches for prey on its forays, by rule (never species by species): its stored hunt style first, then
 * how it moves, its diet, its company and its flight style.
 *
 * In the air: a flying insect or a bat that hawks does so in quick loops (a dragonfly that also waits on a perch goes
 * perch to perch); a swallow or a swift hawks; a heron, an egret or a limpkin (a wader that eats fish or meat) stands
 * and stalks in the shallows; any other water bird (an ibis, a cormorant, a pelican, a duck) goes from spot to spot
 * and feeds there; a soaring bird that eats flesh circles high; a perch hunter and an ambusher (a kingfisher, a
 * kookaburra) go perch to perch; a bird that swoops quarters low if it is a raptor's size, else hunts from perches (a
 * shrike); every other bird (the gleaners, the seed and fruit eaters the server also counts as hunters) flits to the
 * next spot and pecks.
 * In the water: an ambusher lurks (a pike, a snakehead, an eel); a pursuer, a scavenging shark and a filter feeder
 * cruise; the rest swim from spot to spot.
 * On the ground: a pack hunter and a social flesh-eating pursuer course at a trot (a wolf, a hyena); a stalker, any
 * mammal that ambushes (a tiger prowls and lies in wait) and the other pursuers stalk; every other ambusher and a
 * sessile or clinging animal waits (a crocodile, a python, a frog, a spider, a mantis, a chameleon); the rest forage.
 */
export function huntStyle(slug: string, sheet: Sheet): HuntStyle {
    const intel = intelProfile(slug);
    const profile = behaviourProfile(slug);
    const has = (h: ArkHunt) => intel.hunt.includes(h);
    const plan = intel.plan;
    const flesh = profile.diet === "meat" || profile.diet === "fish" || profile.diet === "carrion";
    if (sheet.flies) {
        const spec = flightSpec(slug, sheet.len);
        if (spec?.kind === "insect" || plan === "flying_insect") return has("aerial_hawk") ? (has("perch_wait") ? "perch" : "hawk") : "glean";
        if (spec?.kind === "bat" || plan === "bat") return has("aerial_hawk") || profile.diet === "insects" ? "hawk" : "glean";
        if (intel.hunt[0] === "aerial_hawk") return "hawk";
        if (profile.water === "wader") return flesh ? "wade" : "glean";
        if (profile.water) return "glean";
        if (spec?.style === "soar" && (flesh || has("aerial_swoop") || has("scavenge"))) return "soar";
        if (has("perch_wait") || has("ambush")) return "perch";
        if (has("aerial_swoop")) return flesh && sheet.len >= 0.35 ? "quarter" : "perch";
        return "glean";
    }
    if (sheet.aquatic && !sheet.amphibious && sheet.move === "swim") {
        if (has("ambush") || has("perch_wait")) return "lurk";
        if (has("pursuit") || has("pack") || has("filter") || (has("scavenge") && sheet.len >= 1)) return "cruise";
        return "forage";
    }
    if (sheet.move === "sessile" || sheet.move === "cling") return "wait";
    const mammal = plan === "quadruped" || plan === "primate";
    const social = profile.social === "pack" || profile.social === "group";
    if (sheet.move !== "swim" && mammal && (has("pack") || (has("pursuit") && social && profile.diet === "meat"))) return "course";
    if (has("stalk") || (mammal && has("ambush")) || has("pursuit")) return "stalk";
    if (has("ambush") || has("perch_wait") || has("filter")) return "wait";
    // (One rule with the card, `animal-status.ts` forayActivity: a flesh-eater with no stored hunt style, a badger, a
    // seal on land, whose profile stalks, prowls; the rest forage, and their cards say their own feeding.)
    return (profile.weights.stalk ?? 0) > 0 ? "stalk" : "forage";
}

export {forayIsHunt} from "@/ark-scene/hunt-word";

/** The world a hunter moves in beyond the ground's height (the scene's; absent in a test: the sea at 0, no perches). */
export type HuntWorld = {
    /** The water's surface over a point (the sea's 0, a lake's or a river's own level). */
    water?: (x: number, z: number) => number;
    /** A perch (a branch, a post, a rock's top) within `reach` metres of a point, the nearest; null: none. */
    perch?: (x: number, z: number, reach: number) => {x: number; y: number; z: number} | null;
};

/** A step in real seconds (34.5). */
export const HUNT_STEP_SECONDS = ARK_DAY_MS / 1000 / STEPS_PER_ARK_DAY;
/**
 * A waiting hunter holds its place while the server's waypoints stay within this of it (m), and a perch hunter sits on
 * a perch this near its waypoint: inside the chase lane's `ENCOUNTER_AGREE` (5 m, `acts.ts`), with room for the
 * collisions' easing apart.
 */
export const HUNT_STATION_AGREE = 3.2;
/**
 * One that waits, and a walker too slow for its foray, keeps this near the server's waypoint (m) and no nearer: every
 * metre of it is a metre less to cover each step. Inside `ENCOUNTER_AGREE` with 0.8 m to spare (a body that the
 * collisions ease further than that from its place starts its chase at the waypoint, as any other out of agreement).
 */
export const HUNT_WAIT_AGREE = 4.2;
/**
 * One that waits, and one too slow for its foray, moves on only for this share of a step when its own pace would
 * take longer: then it hurries, up to its sprint (and past it only where the server's waypoint leaves no choice).
 */
const HURRY_SHARE = 0.3;
/** Into a hunt and out of one: over at most this many steps, at its own pace. */
export const LEAD_STEPS = 3;
const TAU = Math.PI * 2;

/** What a stationed style does: its pace against its own walk (or swim), how many bouts a leg is split into, what it does between them. */
type Stationed = {pace: number; bouts: number; pauses: ArkBeat[]; doing: ArkDoing; most: number};
const STATIONED: Partial<Record<HuntStyle, Stationed>> = {
    // (One that waits moves on in one go at its full walk or swim, so that most of each step is the wait: the server
    // moves a crocodile's or a pike's waypoint 5 to 20 m every step, as it does a wolf's.)
    wait: {pace: 1, bouts: 1, pauses: ["pause", "pause", "pause", "scan"], doing: "stalk", most: 0.7},
    lurk: {pace: 1.25, bouts: 1, pauses: ["pause"], doing: "swim", most: 0.7},
    // (A prowl is half its walk's pace, slow steps: a lion at about 1 m/s. A forager ambles.)
    stalk: {pace: 0.5, bouts: 3, pauses: ["scan", "pause", "scan"], doing: "stalk", most: 0.8},
    forage: {pace: 0.65, bouts: 4, pauses: ["bite", "chew", "scan", "bite"], doing: "forage", most: 0.8},
    wade: {pace: 0.7, bouts: 2, pauses: ["pause", "pause", "scan"], doing: "stalk", most: 0.7},
    perch: {pace: 1, bouts: 1, pauses: ["scan", "pause", "scan", "preen"], doing: "perch", most: 0.7},
    glean: {pace: 1, bouts: 2, pauses: ["peck", "peck", "scan"], doing: "forage", most: 0.8}
};

/** A style's stationed way (one on the move, boxed in for a step, goes as a stalker does on land, a forager in the water). */
const stationed = (style: HuntStyle): Stationed => STATIONED[style] ?? (style === "course" ? STATIONED.stalk! : STATIONED.forage!);

/** An animal's own body for the hunt: its style, its paces (m/s), a flyer's height, its loops' fixed axis and sense. */
export type HuntBody = {
    style: HuntStyle;
    seed: number;
    len: number;
    flyer: boolean;
    /** Lives in the water and swims (a fish, a whale). */
    swimmer: boolean;
    /** Rides on the water where its waypoint is over it (a duck, a cormorant, a crocodile, an otter). */
    floats: boolean;
    /** A bird stands in water up to this deep (m): a wader to its belly, another to its feet. */
    wade: number;
    walk: number;
    trot: number;
    sprint: number;
    swim: number;
    fly: number;
    /**
     * It keeps as near its home as the agreement allows (`station`): one that waits or lurks, and a walker whose own
     * pace cannot cover its foray's legs (half a step at its walk is under a typical leg: a tortoise, a chameleon).
     */
    pulls: boolean;
    /** A flyer flies a leg longer than this (m), and walks or hops a shorter one. */
    hop: number;
    alt: number;
    ex: number;
    ez: number;
    sense: 1 | -1;
};

function mix(a: number, b: number): number {
    let h = (a ^ Math.imul((b | 0) + 0x9e3779b9, 0x85ebca6b)) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
    h = Math.imul(h, 0x297a2d39);
    h ^= h >>> 15;
    return h >>> 0;
}
const unit = (a: number, b: number) => mix(a, b) / 4294967296;
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Progress (0–1) along a way through a share of time `u`: held still for the first `hold`, then up to speed over `rin`
 * (0: at speed from the first moment), level, and down to a stop over `rout` (0: at speed to the end).
 */
export function huntProgress(u: number, hold: number, rin: number, rout: number): number {
    const t = Math.min(Math.max((u - hold) / Math.max(1 - hold, 1e-6), 0), 1);
    const area = 1 - rin / 2 - rout / 2;
    let done: number;
    if (t < rin) done = (t * t) / (2 * rin);
    else if (t <= 1 - rout) done = rin / 2 + (t - rin);
    else done = area - ((1 - t) * (1 - t)) / (2 * Math.max(rout, 1e-6));
    return Math.min(Math.max(done / area, 0), 1);
}

/** Can it be on this medium (the module's own rule: 0 land, 1 fresh water, 2 shallow sea, 3 deep sea)? */
function allowed(sheet: Sheet, medium: number): boolean {
    if (sheet.flies) return true;
    if (medium <= 0) return !sheet.aquatic || sheet.amphibious;
    if (sheet.aquatic || sheet.amphibious) return sheet.water === "" || (medium === 1 ? sheet.water !== "salt" : sheet.water !== "fresh") || sheet.amphibious;
    return medium === 2 || medium === 1 ? sheet.len >= 1.2 : false;
}

/** An animal's body for the hunt: its style and its own paces (for the layer; the audit and the tests read it too). */
export function huntBody(animal: Pick<ArkAnimal, "id" | "model_slug">, sheet: Sheet, length: number): HuntBody {
    const slug = animal.model_slug;
    const profile = behaviourProfile(slug);
    const style = huntStyle(slug, sheet);
    const len = Math.max(length, 0.01);
    const walk = Math.max(bodyLengthsPerSecond(profile) * len, 0.004);
    const hip = Math.max(len * hipShare(intelProfile(slug).plan), 0.003);
    const spec = sheet.flies ? flightSpec(slug, len) : null;
    const cruise = spec?.cruise ?? (sheet.flies ? flightPaces("bird", "continuous", len).cruise : 0);
    const swimStyle = locoStyle(slug).swim;
    const swim = swimStyle ? swimPaces(len, swimStyle).cruise : Math.max(walk, 0.6 * len);
    const insect = spec?.kind === "insect";
    const seed = hashString(animal.id + "#hunt");
    const slow = !sheet.flies && !(sheet.aquatic && !sheet.amphibious) && walk * HUNT_STEP_SECONDS * 0.5 < forayRadius(sheet) * 0.4;
    const axis = TAU * unit(seed, 1);
    return {
        style,
        seed,
        len,
        flyer: sheet.flies,
        swimmer: sheet.aquatic && !sheet.amphibious,
        floats: sheet.aquatic || sheet.amphibious || (Boolean(profile.water) && profile.water !== "wader"),
        wade: profile.water === "wader" ? 0.35 * len : 0.03,
        walk,
        // A trot: where the gait engine leaves the walk (Froude 0.8 at its hip), never under its walk nor a slow one's run.
        trot: Math.max(walk * 1.25, Math.min(Math.sqrt(0.8 * 9.81 * hip), walk * 3)),
        sprint: Math.max(sprintPace({plan: intelProfile(slug).plan, slug, length: len, speedStat: profile.speed}), walk),
        swim,
        pulls: style === "wait" || style === "lurk" || (slow && !ON_THE_MOVE.has(style)),
        // Searching flight is slower than its cruise: a soarer circles near its least sink, a quarterer flies slowly.
        fly: cruise * (style === "soar" ? 0.6 : style === "quarter" ? 0.55 : style === "hawk" ? (insect ? 0.5 : 0.8) : 0.7),
        hop: Math.max(3, 6 * len),
        alt: style === "soar" ? Math.min(Math.max(14 + 16 * len, 16), 34) : style === "quarter" ? 2.5 + 2 * len : style === "hawk" ? (insect ? 0.8 + 8 * len : 4 + 8 * len) : 2 + 3 * len,
        ex: Math.cos(axis),
        ez: Math.sin(axis),
        sense: unit(seed, 2) < 0.5 ? -1 : 1
    };
}

// MARK: A step's plan

type Plan = {
    k: number;
    on0: boolean;
    on1: boolean;
    /** The next step it hunts at within `LEAD_STEPS` when it is not hunting now (-1: none), and the last it hunted at. */
    next: number;
    last: number;
    /** Where it is at step k and at k + 1. */
    ax: number;
    az: number;
    bx: number;
    bz: number;
    /** A perch's height at each end (NaN: on the ground or the water there). */
    ay: number;
    by: number;
    /** A flyer with nowhere to stand at that end (open water): it holds in the air over it. */
    overA: boolean;
    overB: boolean;
    /** The ground's height and the water's surface at each end, read once a step (a frame reads only the ground under it). */
    ga: number;
    gb: number;
    wa: number;
    wb: number;
    /** The ground's height at its home (a soarer holds its height over that, not over every rise it crosses). */
    gh: number;
    path: boolean;
    // Stationed: the leg's heading and the one it arrived by, its length, whether it flies it, its segments' ends
    // (shares of the step: wait, go, wait, go … wait) and its pace.
    yawIn: number;
    yawLeg: number;
    d: number;
    flown: boolean;
    wet: boolean;
    ends: number[];
    bouts: number;
    speed: number;
    // On the move: the waypoints before and after (a curve through all four), the loop's size and count, the share of
    // the step it stands at the waypoint, and its way's length against its parameter.
    px: number;
    pz: number;
    qx: number;
    qz: number;
    amp: number;
    turns: number;
    eight: boolean;
    hold: number;
    table: Float32Array | null;
    length: number;
    /** How much of it is in the hunt now (1 hunting; under 1 on its way in or out; 0 on its schedule): the last pose's. */
    w: number;
};

type State = {startedAtMs: number; from: Map<string, number>; atlas: Atlas};
type Point = {x: number; z: number};
const TABLE = 48;

export class HuntingLayer {
    private state: State | null = null;
    private homes = new Map<string, Home | null>();
    private bodies = new Map<string, HuntBody>();
    private plans = new Map<string, Plan>();
    /** A predator the last read fed (or took off the list) while it was out: it finishes its leg, then goes back. */
    private released = new Map<string, {from: number; until: number}>();
    /** One the first read found already out: it sets off from its schedule's place now. */
    private joined = new Map<string, number>();
    private scratch: Point = {x: 0, z: 0};

    /** On while the server hunts by encounter and the atlas is in. */
    get active(): boolean {
        return this.state !== null;
    }

    /**
     * The hunting read (or null: off). `startedAtMs` falls back to the snapshot's voyage start. `nowMs` (the scene's
     * clock) lets a change of plan be eased: a predator fed since the last read finishes the leg it is on and walks
     * back, and one already out when the first read comes sets off from its schedule's place, neither in one frame.
     */
    set(hunting: ArkHunting | null, atlas: Atlas | null, fallbackStartMs: number | null, nowMs?: number): void {
        const start = hunting?.startedAtMs ?? fallbackStartMs;
        if (!hunting || hunting.hunting !== "encounter" || !atlas || start === null || !Number.isFinite(start)) {
            this.state = null;
            this.plans.clear();
            this.released.clear();
            this.joined.clear();
            return;
        }
        const before = this.state;
        if (before && before.atlas !== atlas) {
            this.homes.clear();
            this.bodies.clear();
        }
        if (nowMs !== undefined && Number.isFinite(nowMs)) {
            const k = stepIndex((nowMs - start) / ARK_DAY_MS);
            const day = (k + 1) / STEPS_PER_ARK_DAY;
            this.released.forEach((held, id) => {
                if (held.until < k - LEAD_STEPS) this.released.delete(id);
            });
            this.joined.forEach((at, id) => {
                if (at < k - LEAD_STEPS) this.joined.delete(id);
            });
            if (before) {
                // (Was due by the last read and is not by this one: it has eaten, or is gone from the list.)
                before.from.forEach((from, id) => {
                    const now = hunting.predators.get(id);
                    if (from <= day && (now === undefined || now > day) && !this.released.has(id)) this.released.set(id, {from, until: k + 1});
                });
            } else {
                // (Its first hunting step a whole lead away, so that even from far off it sets out from its schedule's place.)
                hunting.predators.forEach((from, id) => {
                    if (from <= day) this.joined.set(id, k + LEAD_STEPS);
                });
            }
        }
        this.state = {startedAtMs: start, from: hunting.predators, atlas};
        this.plans.clear();
    }

    /** Animals whose home is worked out again (a new snapshot moved its slot). */
    forget(id: string): void {
        this.homes.delete(id);
        this.bodies.delete(id);
        this.plans.delete(id);
    }

    private home(animal: ArkAnimal): Home | null {
        const st = this.state!;
        let h = this.homes.get(animal.id);
        if (h !== undefined) return h;
        // (Islands mode: the atlas is the wild island's; a town animal has no home in it, so it never walks a foray across
        // the strait. The server sends it no next hunt either: the pool feeds it.)
        h = typeof animal.slot === "number" && animal.species_profile_id && animal.island !== "town"
            ? homeOf(st.atlas, {island: animal.island ?? "wild", zone: animal.zone, slug: animal.model_slug, speciesId: animal.species_profile_id, slot: animal.slot, rank: animal.slot_rank ?? 0})
            : null;
        this.homes.set(animal.id, h);
        return h;
    }

    /** Its next hunt as the scene takes it (the read's; one just fed keeps its old one to the end of its leg). */
    private due(id: string): number | undefined {
        return this.released.get(id)?.from ?? this.state!.from.get(id);
    }

    /** Is it hunting at step k: its next hunt has come and it is awake (the module's sleep, its stored activity first). */
    private on(animal: ArkAnimal, home: Home, k: number): boolean {
        const held = this.released.get(animal.id);
        if (held && k > held.until) return false;
        const from = held ? held.from : this.state!.from.get(animal.id);
        if (from === undefined) return false;
        const joined = this.joined.get(animal.id);
        if (joined !== undefined && k <= joined) return false;
        const day = k / STEPS_PER_ARK_DAY;
        return day >= from && awakeAt(animal.activity ?? home.sheet.activity ?? null, this.state!.startedAtMs, day, 0);
    }

    /**
     * True when this animal is out on its forays now (the tap card, the live log's "is hunting"): hunting at this step,
     * or setting out for the next one (once it has left its schedule's place, where the scene is drawing it now).
     */
    hunting(animal: ArkAnimal, epochSeconds: number): boolean {
        const st = this.state;
        if (!st || this.due(animal.id) === undefined) return false;
        const home = this.home(animal);
        if (!home) return false;
        const k = stepIndex((epochSeconds * 1000 - st.startedAtMs) / ARK_DAY_MS);
        if (this.on(animal, home, k)) return true;
        if (!this.on(animal, home, k + 1)) return false;
        const plan = this.plans.get(animal.id);
        return plan && plan.k === k ? plan.w > 0 : true;
    }

    /** How it hunts (`huntStyle`), or null when it has no home in the atlas (the audit, the tests). */
    styleOf(animal: ArkAnimal): HuntStyle | null {
        if (!this.state) return null;
        const home = this.home(animal);
        return home ? huntStyle(animal.model_slug, home.sheet) : null;
    }

    /** How much of it was in the hunt at its last pose (0: on its schedule; 1: hunting): for its group's companions. */
    weight(id: string): number {
        return this.plans.get(id)?.w ?? 0;
    }

    /** Where it waits at step k: the server's waypoint, or (one that waits) its waiting place for that waypoint. */
    private station(home: Home, id: string, body: HuntBody, k: number, out: Point): Point {
        const way = forayAt(this.state!.atlas, home, id, k);
        out.x = way.x;
        out.z = way.z;
        if (body.pulls) {
            // Its waiting place for this waypoint: the waypoint drawn in towards its home by the agreement's distance.
            // The waypoints go round its home, so it keeps to a far smaller round inside theirs (its home itself while
            // they are within the agreement of it), and moves less than half as far as they do.
            const dx = way.x - home.x;
            const dz = way.z - home.z;
            const far = Math.hypot(dx, dz);
            const keep = far > 1e-6 ? Math.max(far - HUNT_WAIT_AGREE * 0.99, 0) / far : 0;
            const x = home.x + dx * keep;
            const z = home.z + dz * keep;
            if (allowed(home.sheet, mediumAt(this.state!.atlas, home.island, x, z))) {
                out.x = x;
                out.z = z;
            }
        }
        return out;
    }

    private plan(animal: ArkAnimal, home: Home, body: HuntBody, k: number, world: HuntWorld | undefined, heightAt: (x: number, z: number) => number): Plan {
        const st = this.state!;
        const id = animal.id;
        const on0 = this.on(animal, home, k);
        const on1 = this.on(animal, home, k + 1);
        let next = -1;
        let last = on0 ? k : -1;
        if (!on0) {
            for (let j = k + 1; j <= k + LEAD_STEPS && next < 0; j++) if (this.on(animal, home, j)) next = j;
            for (let j = k - 1; j > k - LEAD_STEPS && last < 0; j--) if (this.on(animal, home, j)) last = j;
        }
        const plan: Plan = {k, on0, on1, next, last, ax: 0, az: 0, bx: 0, bz: 0, ay: NaN, by: NaN, overA: false, overB: false, ga: 0, gb: 0, wa: 0, wb: 0, gh: 0, path: ON_THE_MOVE.has(body.style), yawIn: 0, yawLeg: 0, d: 0, flown: false, wet: false, ends: [], bouts: 0, speed: 0, px: 0, pz: 0, qx: 0, qz: 0, amp: 0, turns: 1, eight: false, hold: 0, table: null, length: 0, w: 0};
        if (!on0 && next < 0 && last < 0) return plan;
        const p = this.scratch;
        // (Where it goes back from, or where it is bound: the one place, as both ends.)
        const ka = on0 ? k : last >= 0 && next < 0 ? last : next;
        const kb = on0 && on1 ? k + 1 : ka;
        this.station(home, id, body, ka, p);
        plan.ax = p.x;
        plan.az = p.z;
        this.station(home, id, body, kb, p);
        plan.bx = p.x;
        plan.bz = p.z;
        const perches = body.style === "perch" && body.len < 0.6 && world?.perch;
        if (perches) {
            const a = world.perch!(plan.ax, plan.az, HUNT_STATION_AGREE);
            if (a) [plan.ax, plan.ay, plan.az] = [a.x, a.y, a.z];
            const b = kb === ka ? a : world.perch!(plan.bx, plan.bz, HUNT_STATION_AGREE);
            if (b) [plan.bx, plan.by, plan.bz] = [b.x, b.y, b.z];
        }
        // A bird that comes down between flights does so where it can stand: on land, in water it can wade, or (one that
        // floats) on the water. Over deeper water it takes the nearest such place within its agreement of the waypoint;
        // with none (out over open water) it holds in the air over it.
        const deep = (x: number, z: number) => (mediumAt(st.atlas, home.island, x, z) >= 1 ? Math.max((world?.water ? world.water(x, z) : 0) - heightAt(x, z), world?.water ? 0 : 9) : 0);
        if (body.flyer && !plan.path && !body.floats) {
            const settle = (x: number, z: number, perch: number): {x: number; z: number; over: boolean} => {
                if (!Number.isNaN(perch) || deep(x, z) <= body.wade) return {x, z, over: false};
                const toHome = Math.atan2(home.x - x, home.z - z);
                for (const reach of [HUNT_STATION_AGREE / 2, HUNT_STATION_AGREE]) {
                    for (let i = 0; i < 8; i++) {
                        const a = toHome + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * (Math.PI / 4);
                        const nx = x + Math.sin(a) * reach;
                        const nz = z + Math.cos(a) * reach;
                        if (deep(nx, nz) <= body.wade) return {x: nx, z: nz, over: false};
                    }
                }
                return {x, z, over: true};
            };
            const a = settle(plan.ax, plan.az, plan.ay);
            const b = kb === ka ? a : settle(plan.bx, plan.bz, plan.by);
            [plan.ax, plan.az, plan.overA] = [a.x, a.z, a.over];
            [plan.bx, plan.bz, plan.overB] = [b.x, b.z, b.over];
        }
        plan.gh = heightAt(home.x, home.z);
        plan.ga = heightAt(plan.ax, plan.az);
        plan.gb = heightAt(plan.bx, plan.bz);
        plan.wa = world?.water ? world.water(plan.ax, plan.az) : 0;
        plan.wb = world?.water ? world.water(plan.bx, plan.bz) : 0;
        const dx = plan.bx - plan.ax;
        const dz = plan.bz - plan.az;
        plan.d = Math.hypot(dx, dz);
        this.station(home, id, body, ka - 1, p);
        const fromX = plan.ax - p.x;
        const fromZ = plan.az - p.z;
        plan.yawLeg = plan.d > 1e-3 ? Math.atan2(dx, dz) : Math.hypot(fromX, fromZ) > 1e-3 ? Math.atan2(fromX, fromZ) : TAU * unit(body.seed, 3);
        plan.yawIn = Math.hypot(fromX, fromZ) > 1e-3 ? Math.atan2(fromX, fromZ) : plan.yawLeg;
        if (!(on0 && on1)) return plan;
        const medium = (x: number, z: number) => mediumAt(st.atlas, home.island, x, z);
        if (plan.path) {
            const before = forayAt(st.atlas, home, id, k - 1);
            const after = forayAt(st.atlas, home, id, k + 2);
            plan.px = before.x;
            plan.pz = before.z;
            plan.qx = after.x;
            plan.qz = after.z;
            const pace = body.style === "course" ? body.trot : body.style === "cruise" ? body.swim * 0.8 : body.fly;
            // A courser stops at each waypoint to look and listen, then trots on.
            plan.hold = body.style === "course" ? 0.12 + 0.1 * unit(body.seed, k * 7 + 1) : 0;
            const want = pace * HUNT_STEP_SECONDS * (1 - plan.hold) * (body.style === "course" ? 0.85 : 1);
            if (body.style === "soar" || body.style === "hawk") {
                // Circles that touch the waypoint: a soarer's wide and few, a hawker's tight and many.
                const radius = body.style === "soar" ? 14 + 10 * body.len : body.fly > 4 ? 5 + 12 * body.len : 1.5 + 20 * body.len;
                plan.turns = Math.max(1, Math.round(want / (TAU * radius)));
                plan.amp = want / (TAU * plan.turns);
                plan.length = want;
            } else {
                // A long figure of eight through the waypoint: its length the way it covers at its pace.
                plan.eight = true;
                plan.turns = body.style === "quarter" ? 2 : 1;
                const reach = body.style === "quarter" ? 26 : Math.max(Math.min(home.r * 1.2, 16), 2 * body.len);
                let amp = Math.min(Math.max(want - plan.d, 0) / (2.9 * plan.turns), reach);
                // (Kept to ground, or water, it can be on: narrower until it is, else the straight way.)
                for (let tries = 0; tries < 4 && amp > 0.05 && !home.sheet.flies; tries++) {
                    plan.amp = amp;
                    let ok = true;
                    for (let i = 1; i < 12 && ok; i++) {
                        this.along(plan, body, i / 12, p);
                        ok = allowed(home.sheet, medium(p.x, p.z));
                    }
                    if (ok) break;
                    amp = tries === 2 ? 0 : amp / 2;
                }
                // (A loop narrower than its own body would be a wriggle on the spot.)
                if (amp < 1.5 * body.len) amp = 0;
                plan.amp = amp;
                const table = new Float32Array(TABLE + 1);
                let lx = plan.ax;
                let lz = plan.az;
                for (let i = 1; i <= TABLE; i++) {
                    this.along(plan, body, i / TABLE, p);
                    table[i] = table[i - 1] + Math.hypot(p.x - lx, p.z - lz);
                    lx = p.x;
                    lz = p.z;
                }
                plan.table = table;
                plan.length = table[TABLE];
            }
            // With room for its way (a wolf's ground, a shark's water) it keeps moving; boxed in (a small pond, a strip of
            // shore: under half the way its pace covers) it goes from waypoint to waypoint and waits, as a stalker does.
            if (plan.length >= want * 0.5 || home.sheet.flies) return plan;
            plan.path = false;
            plan.amp = 0;
            plan.hold = 0;
            plan.table = null;
        }
        // Stationed: wait, go (in bouts), wait.
        const traits = stationed(body.style);
        const depthA = Number.isNaN(plan.ay) ? deep(plan.ax, plan.az) : 0;
        const depthB = Number.isNaN(plan.by) ? deep(plan.bx, plan.bz) : 0;
        plan.wet = body.swimmer || (!body.flyer && depthA > 0.05 && depthB > 0.05);
        // A flyer flies a long leg, one up to or down from a perch or a place over open water, and (a perch hunter) any leg.
        plan.flown = body.flyer && plan.d > 0.05 && (plan.d > body.hop || !Number.isNaN(plan.ay) || !Number.isNaN(plan.by) || plan.overA || plan.overB || (body.style === "perch" && plan.d > 1));
        // (One that waits moves on briskly, between its walk and its trot: a crocodile's high walk, not its crawl.)
        const pace = plan.flown ? body.fly : plan.wet ? body.swim * (body.swimmer ? traits.pace * 0.8 : 0.6) : body.style === "wait" ? (body.walk + body.trot) / 2 : body.walk * traits.pace;
        // (One that keeps near its home hurries when its own pace would have it on the move for more than `HURRY_SHARE`
        // of the step: up to its sprint, or in the water twice its cruise.)
        const own = plan.d / Math.max(pace, 1e-4);
        const hurried = body.pulls && !plan.flown ? Math.max(Math.min(own, HURRY_SHARE * HUNT_STEP_SECONDS), plan.d / (plan.wet ? Math.max(body.swim * 2, pace) : Math.max(body.sprint, pace))) : own;
        const go = plan.d > 0.05 ? Math.min(Math.max(hurried, plan.flown ? 1.2 : 0.4), traits.most * HUNT_STEP_SECONDS) / HUNT_STEP_SECONDS : 0;
        plan.speed = go > 0 ? plan.d / (go * HUNT_STEP_SECONDS) : 0;
        // (A bout is two and a half body lengths at least: shorter, it would be a shuffle.)
        const bouts = go > 0 ? (plan.flown ? 1 : Math.max(1, Math.min(1 + Math.floor(unit(body.seed, k * 7 + 2) * traits.bouts), Math.floor(plan.d / (2.5 * body.len))))) : 0;
        plan.bouts = bouts;
        // The waits: one before it sets off, one between bouts, one after it arrives (the next step's first follows on).
        const weights: number[] = [];
        let sum = 0;
        for (let i = 0; i <= bouts; i++) {
            const w = (i === 0 ? 1 : i === bouts ? 0.5 : 0.6) + unit(body.seed, k * 7 + 3 + i * 13);
            weights.push(w);
            sum += w;
        }
        let at = 0;
        for (let i = 0; i <= bouts; i++) {
            at += ((1 - go) * weights[i]) / sum;
            plan.ends.push(i === bouts ? 1 : at);
            if (i < bouts) {
                at += go / bouts;
                plan.ends.push(at);
            }
        }
        return plan;
    }

    /** A point on a moving hunter's way at parameter u (0–1 through the step): the curve through its waypoints plus its loop. */
    private along(plan: Plan, body: HuntBody, u: number, out: Point): Point {
        // A Catmull-Rom curve through the waypoint before, this step's two, and the one after (it passes through each).
        const u2 = u * u;
        const u3 = u2 * u;
        const c0 = -0.5 * u3 + u2 - 0.5 * u;
        const c1 = 1.5 * u3 - 2.5 * u2 + 1;
        const c2 = -1.5 * u3 + 2 * u2 + 0.5 * u;
        const c3 = 0.5 * u3 - 0.5 * u2;
        let x = c0 * plan.px + c1 * plan.ax + c2 * plan.bx + c3 * plan.qx;
        let z = c0 * plan.pz + c1 * plan.az + c2 * plan.bz + c3 * plan.qz;
        if (plan.amp > 0) {
            if (plan.eight) {
                // (Of the whole foray's time, not the step's, so an odd count runs on unbroken.)
                const s = (plan.k + u) * plan.turns * Math.PI;
                const along = plan.amp * Math.sin(s);
                const across = plan.amp * 0.45 * Math.sin(2 * s) * body.sense;
                x += body.ex * along - body.ez * across;
                z += body.ez * along + body.ex * across;
            } else {
                const s = u * plan.turns * TAU;
                const out1 = plan.amp * (1 - Math.cos(s));
                const round = plan.amp * Math.sin(s) * body.sense;
                x += body.ex * out1 - body.ez * round;
                z += body.ez * out1 + body.ex * round;
            }
        }
        out.x = x;
        out.z = z;
        return out;
    }

    /** The parameter at a share of the way's length (the table's inverse; a circle's way is even already). */
    private paramAt(plan: Plan, share: number): number {
        const table = plan.table;
        if (!table || plan.length <= 1e-6) return share;
        const want = share * plan.length;
        let i = Math.min(Math.floor(share * TABLE), TABLE - 1);
        while (i > 0 && table[i] > want) i--;
        while (i < TABLE - 1 && table[i + 1] < want) i++;
        const span = table[i + 1] - table[i];
        return (i + (span > 1e-9 ? (want - table[i]) / span : 0)) / TABLE;
    }

    /** A flyer's height over the ground or the water as it searches (it rises and sinks a little, slowly). */
    private altitude(body: HuntBody, s: number): number {
        const swing = body.style === "hawk" ? 0.45 : body.style === "soar" ? 0.12 : 0.2;
        return body.alt * (1 + swing * Math.sin(s * (body.style === "hawk" ? 2.3 : 0.7) + TAU * unit(body.seed, 4)));
    }

    /** Hunting through this whole step: its pose at the share `u` of it. */
    private whole(plan: Plan, body: HuntBody, u: number, heightAt: (x: number, z: number) => number): HuntPose {
        if (plan.path) {
            // On the move: a stop at the waypoint (a courser), then on along its way at its pace.
            const done = huntProgress(u, plan.hold, plan.hold > 0 ? 0.06 : 0, 0);
            const at = this.paramAt(plan, done);
            const p = this.along(plan, body, at, this.scratch);
            const x = p.x;
            const z = p.z;
            const ahead = this.along(plan, body, Math.min(at + 0.004, 1), this.scratch);
            let hx = ahead.x - x;
            let hz = ahead.z - z;
            if (hx * hx + hz * hz < 1e-10) {
                const back = this.along(plan, body, Math.max(at - 0.004, 0), this.scratch);
                hx = x - back.x;
                hz = z - back.z;
            }
            const moving = u >= plan.hold && plan.length > Math.max(0.02, 0.5 * body.len);
            if (!moving && plan.length <= Math.max(0.02, 0.5 * body.len)) hx = hz = 0;
            const ground = heightAt(x, z);
            // (Over the ground, or the water's surface between its two waypoints' own.)
            const over = Math.max(ground, plan.wa + (plan.wb - plan.wa) * u);
            const y = body.flyer ? (body.style === "soar" ? Math.max(Math.max(plan.gh, 0) + this.altitude(body, plan.k + u), over + 8) : over + this.altitude(body, plan.k + u)) : body.swimmer ? Math.min(-0.2, Math.max(ground + 0.6 * body.len, ground * 0.5)) : ground;
            const beat: ArkBeat = body.flyer ? (body.style === "soar" ? "glide" : "fly") : body.swimmer ? "swim" : moving ? "walk" : "scan";
            return {x, z, y, yaw: hx * hx + hz * hz > 1e-12 ? Math.atan2(hx, hz) : plan.yawLeg, moving, aloft: body.flyer, nx: 0, ny: 1, nz: 0, beat, doing: body.flyer ? (body.style === "soar" ? "soar" : "fly") : body.swimmer ? "swim" : "stalk"};
        }
        const traits = stationed(body.style);
        // Which of its waits and bouts it is in (wait, go, wait, go … wait).
        const ends = plan.ends;
        let i = 0;
        while (i < ends.length - 1 && u >= ends[i]) i++;
        const from = i === 0 ? 0 : ends[i - 1];
        const local = (u - from) / Math.max(ends[i] - from, 1e-9);
        const going = i % 2 === 1;
        const bout = i >> 1;
        const f = plan.bouts ? (going ? (bout + huntProgress(local, 0, 0.18, 0.18)) / plan.bouts : bout / plan.bouts) : 0;
        const x = plan.ax + (plan.bx - plan.ax) * f;
        const z = plan.az + (plan.bz - plan.az) * f;
        const ground = heightAt(x, z);
        const top = plan.wa + (plan.wb - plan.wa) * f;
        let y = ground;
        let aloft = false;
        let air: HuntPose["air"];
        if (body.swimmer) y = Math.min(-0.2, Math.max(ground + 0.6 * body.len, ground * 0.5));
        else if (body.flyer) {
            // Where it rests at an end: on its perch; on the ground, or the water's surface over it (the scene stands a
            // wader on the bed and floats a duck); held in the air over open water.
            const ya = !Number.isNaN(plan.ay) ? plan.ay : Math.max(plan.ga, plan.wa) + (plan.overA ? body.alt : 0);
            const yb = !Number.isNaN(plan.by) ? plan.by : Math.max(plan.gb, plan.wb) + (plan.overB ? body.alt : 0);
            const held = !going && (bout === 0 ? plan.overA : plan.overB);
            if (plan.flown) {
                // A low arc from one place to the next, over the ground and the water between.
                const lift = Math.min(body.alt, Math.max(0.6, plan.d * 0.2)) * Math.sin(Math.PI * f);
                y = Math.max(ya + (yb - ya) * f + lift, Math.max(ground, top) + (going ? Math.min(lift, 0.3) : 0));
                aloft = going && lift > Math.max(0.05, 0.1 * body.len);
                if (going) air = {stage: f < 0.25 ? "climb" : f > 0.72 ? "descend" : "cruise", speed: plan.speed, from: ya, to: yb};
            } else y = ya + (yb - ya) * f;
            if (held) aloft = true;
        }
        // Its heading: the leg's as it goes; at its first wait it turns from the way it came, in the wait's last moments.
        let yaw = plan.yawLeg;
        if (i === 0 && plan.bouts) {
            // (At its size's rate: a frog swings round in half a second, a crocodile takes five; never longer than the wait.)
            const turn = wrap(plan.yawLeg - plan.yawIn);
            const takes = Math.min(Math.max(Math.abs(turn) / Math.min(Math.max(1.1 / Math.sqrt(body.len), 0.45), 2.6), 0.4), ends[0] * HUNT_STEP_SECONDS);
            const seconds = (ends[0] - u) * HUNT_STEP_SECONDS;
            yaw = plan.yawIn + turn * smooth(1 - seconds / Math.max(takes, 1e-3));
        } else if (!plan.bouts) yaw = plan.yawIn;
        const inWater = body.swimmer || (plan.wet && ground < top - 0.05);
        let beat: ArkBeat;
        if (going) beat = plan.flown ? "fly" : inWater ? "swim" : "walk";
        else {
            // What it does while it waits changes every several seconds (each its own order).
            const pick = traits.pauses[Math.floor(unit(body.seed, plan.k * 31 + bout * 5 + Math.floor((u * HUNT_STEP_SECONDS) / 7)) * traits.pauses.length)];
            // (In the water or up on a perch it only waits and looks; held in the air it flies on the spot.)
            const perched = body.flyer && !Number.isNaN(bout === 0 ? plan.ay : plan.by);
            beat = aloft ? "fly" : inWater || (perched && pick !== "scan" && pick !== "preen") ? "pause" : pick;
        }
        return {x, z, y, yaw, moving: going, aloft, nx: 0, ny: 1, nz: 0, beat, doing: inWater ? "swim" : aloft || (going && plan.flown) ? "fly" : traits.doing, ...(air ? {air} : {})};
    }

    /**
     * Its pose now when it hunts (or is on its way into or out of a hunt), else null (its schedule's). `schedule` is its
     * schedule's pose at this moment; `heightAt` the ground's height; `world` the water's surface and the perches.
     */
    pose(animal: ArkAnimal, epochSeconds: number, length: number, heightAt: (x: number, z: number) => number, schedule: () => HuntPose, world?: HuntWorld): HuntPose | null {
        const st = this.state;
        if (!st) return null;
        const from = this.due(animal.id);
        if (from === undefined) return null;
        const day = (epochSeconds * 1000 - st.startedAtMs) / ARK_DAY_MS;
        const k = stepIndex(day);
        // (Most predators' next hunts are days off: nothing to work out for them.)
        if (from > (k + LEAD_STEPS + 1) / STEPS_PER_ARK_DAY) return null;
        const home = this.home(animal);
        if (!home) return null;
        let body = this.bodies.get(animal.id);
        if (!body) this.bodies.set(animal.id, (body = huntBody(animal, home.sheet, length)));
        let plan = this.plans.get(animal.id);
        if (!plan || plan.k !== k) this.plans.set(animal.id, (plan = this.plan(animal, home, body, k, world, heightAt)));
        plan.w = 0;
        if (!plan.on0 && plan.next < 0 && plan.last < 0) return null;
        const u = Math.min(Math.max(day * STEPS_PER_ARK_DAY - k, 0), 1);
        if (plan.on0 && plan.on1) {
            plan.w = 1;
            return this.whole(plan, body, u, heightAt);
        }
        // Into a hunt (to its first waypoint, as the hunt begins) or out of one (back to where its schedule has it):
        // straight there at its own pace, leaving as late as that allows, over `LEAD_STEPS` steps at most.
        const sched = schedule();
        const pace = Math.max(body.flyer ? body.fly : body.swimmer ? body.swim * 0.7 : body.style === "course" ? body.trot : body.walk, 1e-4);
        const gap = Math.hypot(sched.x - plan.ax, sched.z - plan.az);
        const need = Math.min(Math.max(gap / pace, 0.5), LEAD_STEPS * HUNT_STEP_SECONDS);
        let w: number;
        let into: boolean;
        const goingIn = plan.next >= 0 ? 1 - ((plan.next - k - u) * HUNT_STEP_SECONDS) / need : 0;
        if (!plan.on0 && goingIn > 0) {
            into = true;
            w = Math.min(goingIn, 1);
        } else if (plan.last >= 0) {
            into = false;
            w = 1 - Math.min(((k + u - plan.last) * HUNT_STEP_SECONDS) / need, 1);
        } else return null;
        if (w <= 0) return null;
        plan.w = w;
        // (The place it is bound for, or leaves: as it waits there, or flies over it.)
        const there = this.whole({...plan, on0: true, on1: true, bx: plan.ax, bz: plan.az, by: plan.ay, overB: plan.overA, gb: plan.ga, wb: plan.wa, d: 0, bouts: 0, ends: [1], flown: false, path: false}, {...body, style: STATIONED[body.style] ? body.style : body.flyer ? "glean" : body.swimmer ? "lurk" : "stalk"}, 0, heightAt);
        // (A flyer on the move joins and leaves its way at the height it flies it there.)
        const aloftAt = this.altitude(body, into ? plan.next : plan.last);
        const high = !(ON_THE_MOVE.has(body.style) && body.flyer) ? there.y : body.style === "soar" ? Math.max(Math.max(plan.gh, 0) + aloftAt, Math.max(plan.ga, plan.wa) + 8) : Math.max(plan.ga, plan.wa) + aloftAt;
        const e = huntProgress(w, 0, 0.15, 0.15);
        const x = sched.x + (plan.ax - sched.x) * e;
        const z = sched.z + (plan.az - sched.z) * e;
        const dx = into ? plan.ax - x : sched.x - x;
        const dz = into ? plan.az - z : sched.z - z;
        const lift = body.flyer ? Math.min(body.alt, Math.max(0.6, gap * 0.2)) * Math.sin(Math.PI * e) : 0;
        const flying = body.flyer && gap > 0.5;
        const y = body.flyer ? Math.max(sched.y + (high - sched.y) * e + (high - sched.y > 1 ? 0 : lift), heightAt(x, z)) : body.swimmer ? there.y : heightAt(x, z);
        const wet = !body.flyer && !body.swimmer && body.floats && y < plan.wa - 0.05;
        const far = dx * dx + dz * dz > 1e-4;
        // (Its heading: the way it goes, turning in its last moments to the way it will stand there.)
        const stands = into ? there.yaw : sched.yaw;
        const settle = smooth(((into ? e : 1 - e) - 0.85) / 0.15);
        const way = far ? Math.atan2(dx, dz) : stands;
        return {
            x,
            z,
            y,
            yaw: way + wrap(stands - way) * settle,
            moving: gap > 0.05,
            aloft: flying && y - heightAt(x, z) > Math.max(0.05, 0.1 * body.len),
            nx: 0,
            ny: 1,
            nz: 0,
            beat: flying ? "fly" : body.swimmer || wet ? "swim" : "walk",
            doing: flying ? "fly" : body.swimmer || wet ? "swim" : into ? "stalk" : "wander",
            ...(flying ? {air: {stage: e < 0.25 ? "climb" : e > 0.72 ? "descend" : "cruise", speed: gap / need, from: into ? sched.y : high, to: into ? high : sched.y} as HuntPose["air"]} : {})
        };
    }

    /**
     * A group's companion beside its hunting leader (a pride, a pack, a family of otters hunt together: the server pairs
     * one hunter with one prey, and the others of its own cluster go with it in the scene). `lead` is the leader's pose
     * now, `weight` how much of it is in the hunt (`weight`), `own` the companion's own schedule pose: it keeps a place
     * behind and to one side by its rank, eased from its own place as the leader sets out and back as it returns.
     */
    beside(lead: HuntPose, weight: number, rank: number, length: number, own: HuntPose, heightAt: (x: number, z: number) => number): HuntPose {
        const gap = Math.max(length * 1.3, 0.4);
        const side = (rank % 2 === 0 ? 1 : -1) * gap * (0.7 + 0.5 * Math.floor((rank + 1) / 2));
        const back = gap * (0.8 + 0.6 * Math.floor((rank + 1) / 2));
        const tx = lead.x - Math.sin(lead.yaw) * back + Math.cos(lead.yaw) * side;
        const tz = lead.z - Math.cos(lead.yaw) * back - Math.sin(lead.yaw) * side;
        const e = smooth(weight);
        const x = own.x + (tx - own.x) * e;
        const z = own.z + (tz - own.z) * e;
        const ground = heightAt(x, z);
        return {...(e >= 0.5 ? lead : own), x, z, y: lead.aloft || own.aloft ? own.y + (lead.y - own.y) * e : ground, yaw: e >= 0.5 ? lead.yaw : own.yaw, moving: e >= 0.5 ? lead.moving : own.moving || (e > 0 && e < 1)};
    }
}

/**
 * Whether a species' cluster goes along when one of it hunts: the social flesh-eaters and foragers on foot (a pride, a
 * pack, a clan, a family of otters, a mob of meerkats, a troop), never a waiting hunter, a flyer or a swimmer.
 */
export function huntsTogether(slug: string, style: HuntStyle | null): boolean {
    if (style !== "course" && style !== "stalk" && style !== "forage") return false;
    const social = behaviourProfile(slug).social;
    return social === "pack" || social === "group" || social === "troop";
}

// MARK: A meal's chase by kind (`acts.ts`)

/**
 * How a species takes its prey in a meal's chase (`acts.ts` ChaseStyle), by rule: a pack hunter and a social
 * flesh-eating pursuer course (a wolf, a hyena, a wild dog); one with the pounce recipe pounces (`pounces`: the foxes
 * and small cats, `recipes.json`); an ambusher that is no mammal, a probing striker and a wader strike from where they
 * are (a snake, a crocodile, a frog, a chameleon, a mantis, a heron); the rest stalk and rush (the big cats).
 */
export function chaseStyleOf(slug: string, pounces: boolean): "rush" | "pounce" | "course" | "strike" {
    const intel = intelProfile(slug);
    const profile = behaviourProfile(slug);
    const has = (h: ArkHunt) => intel.hunt.includes(h);
    const mammal = intel.plan === "quadruped" || intel.plan === "primate";
    if (mammal && (has("pack") || (has("pursuit") && (profile.social === "pack" || profile.social === "group") && profile.diet === "meat"))) return "course";
    if (pounces) return "pounce";
    if (!mammal && (has("ambush") || has("perch_wait") || has("probe_strike") || profile.water === "wader")) return "strike";
    return "rush";
}

/**
 * Whether a flyer takes its prey from the air (`acts.ts` chaseKind `swoops`), and whether from a perch in a short low
 * glide (`low`) rather than a stoop from height. A bird does when its flight stoops or plunges (the raptors, the
 * kingfishers: L2's styles), when it swoops on flesh and is no water bird, or hawks on the wing; every other bird takes
 * its prey on foot or on the water. A bat or a flying insect always does. Low: a perch hunter, an ambusher, a night bird.
 */
export function swoopsOnPrey(slug: string, length: number): {swoops: boolean; low: boolean} {
    const spec = flightSpec(slug, Math.max(length, 0.01));
    if (spec && spec.kind !== "bird") return {swoops: true, low: true};
    const intel = intelProfile(slug);
    const profile = behaviourProfile(slug);
    const has = (h: ArkHunt) => intel.hunt.includes(h);
    const flesh = profile.diet === "meat" || profile.diet === "fish" || profile.diet === "carrion";
    const swoops = Boolean(spec?.stoops) || (has("aerial_swoop") && flesh && !profile.water) || has("aerial_hawk");
    return {swoops, low: has("perch_wait") || has("ambush") || profile.activity === "nocturnal"};
}
