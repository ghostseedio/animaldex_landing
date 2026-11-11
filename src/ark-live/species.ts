/**
 * What a species can do under control, and how fast (design §4.1, §4.3, §4.7), from the data the scene already ships:
 * the behaviour profiles (`behaviours.json`: move, moves, paces, altitude band), the catalogue's stats and lengths
 * (`species-stats.json`, `stats.ts` arkBody: the drawn length D), the depth bands (`depth-bands.json`), the intelligence
 * profiles (`intelligence.json`: hunters, senses) and the map's body classes (`map/body.json`).
 *
 * The same numbers on the server (the validator's caps) and the page (the controller's own caps and its prediction).
 */

import {behaviourProfile, bodyLengthsPerSecond, runFactor, type ArkBehaviourProfile, type ArkMove} from "@/ark-scene/behaviour-profile";
import {arkBody} from "@/ark-scene/stats";
import {intelProfile} from "@/ark-scene/intelligence-profile";
import {speciesDepth, type DepthBand, type WaterKind} from "@/ark-scene/sea-depth";
import bodyTable from "@/ark-scene/map/body.json";
import type {ArkZone} from "@/ark-scene/types";

/** The map's body classes: bird, bat, mammal, reptile, amphibian, fish, invertebrate; `?` unknown. */
export type BodyClass = "b" | "t" | "m" | "r" | "a" | "f" | "i" | "?";

const BODY = new Map<string, BodyClass>();
for (const [key, list] of Object.entries(bodyTable as Record<string, unknown>)) {
    if (key.length !== 1 || !Array.isArray(list)) continue;
    for (const slug of list) if (typeof slug === "string") BODY.set(slug, key as BodyClass);
}

export function bodyClassOf(slug: string): BodyClass {
    return BODY.get(slug) ?? "?";
}

/** The pace cap over a clip's own pace (`behaviour-profile.ts` PACE_CAP). */
const PACE_CAP = 1.3;
/** The scene's sprint cap (m/s). */
export const SPRINT_CAP = 8;
/** A sprint burst (s), and the token bucket's refill (1 s of sprint per 5 s). */
export const SPRINT_BURST_S = 3;
export const SPRINT_REFILL_PER_S = 1 / 5;
/** At least this long to reach the cap from a standstill (s). */
export const ACCEL_TIME_S = 0.3;
/** Non-swimming quadruped mammals may paddle this far across deep water per crossing (m). */
export const PADDLE_LIMIT_M = 15;
/** Burrowing depth (m). */
export const BURROW_DEPTH_M = 1.5;
/** Flight ceilings by cruise band (design §4.4): max(3 × cruise, 6 m), absolute 60 m. */
const CRUISE: Record<"low" | "mid" | "high", number> = {low: 1.6, mid: 6, high: 14};
export const FLIGHT_ABSOLUTE_CAP = 60;
/** The scene's walk slope limits (`behaviour-nav.ts`). */
export const MAX_SLOPE = 0.9;
export const MOUNTAIN_SLOPE = 2.4;

const OWL = /(?:^|-)owl(?:et)?(?:-|$)/;
const SEABIRD = /(?:^|-)(?:gull|tern|gannet|booby|pelican|puffin|cormorant|shag|shearwater|petrel|albatross|frigatebird|skua|osprey|fish-eagle|kingfisher|noddy|tropicbird|murre|guillemot|razorbill|auk|prion|fulmar)(?:-|$)/;
const RAPTOR = /(?:^|-)(?:eagle|hawk|falcon|kestrel|kite|buzzard|harrier|osprey|goshawk|sparrowhawk|merlin|hobby|caracara|condor|vulture)(?:-|$)/;
/**
 * Digging along under the ground is for the true burrowers (design §4.1's list): the data's secondary `burrow` mostly
 * means "lives in a burrow" (a wallaby, a babirusa, the elephant's quirk), so under control it needs the primary move or
 * one of these (DECISIONS.md #63).
 */
const FOSSORIAL = /(?:^|-)(?:mole|mole-rat|wombat|armadillo|gopher|caecilian|worm-lizard|amphisbaena|blind-snake|aardvark|badger|prairie-dog|marmot|ground-squirrel|meerkat|jerboa|kangaroo-rat|tuco-tuco|pangolin|echidna|bilby|ferret|naked-mole-rat|sand-boa|skink)(?:-|$)/;
/** Species whose data lists a move they must not have under control (design §4.1, "data quirks"). */
const MOVE_QUIRKS: Record<string, ArkMove[]> = {"african-bush-elephant": ["burrow"]};

export type FovClass = "hunter" | "owl" | "prey" | "insect";

export type Abilities = {
    slug: string;
    /** Drawn body length (m), the world's scale for this animal. */
    D: number;
    body: BodyClass;
    move: ArkMove;
    moves: ArkMove[];
    sessile: boolean;
    /** Caps in m/s (0: it can't). */
    walk: number;
    run: number;
    sprint: number;
    swim: number;
    fly: number;
    climb: number;
    burrow: number;
    wade: number;
    paddle: number;
    /** Can it stand and walk on land at all. */
    land: boolean;
    canFly: boolean;
    /** A swimmer: it swims under water under its own power. */
    canSwim: boolean;
    /** Must stay under water (fish, rays, jellies): never on land, not even in the shallows. */
    gills: boolean;
    /** Breathes air: must surface (design §4.1, `breathAt`). */
    breathes: boolean;
    canClimb: boolean;
    canBurrow: boolean;
    /** A raptor's stoop, a seabird's plunge: steep dives allowed. */
    diver: boolean;
    /** A seabird: at home over the open sea (design §12.5). */
    seabird: boolean;
    hover: boolean;
    /** Non-swimmers that may paddle a short way (quadruped mammals). */
    paddles: boolean;
    /** The deepest it may wade (m): 0.4 × D. */
    wadeDepth: number;
    altitude: "low" | "mid" | "high" | null;
    /** Flight floor above the ground and ceiling above the ground (m). */
    flightFloor: number;
    flightCeiling: number;
    /** Its depth band and water kind where it has one (`sea-depth.ts`). */
    band: DepthBand | null;
    water: WaterKind | null;
    /** Turn rate cap (rad/s). */
    turnRate: number;
    /** First person's horizontal field of view (deg), and its class. */
    fov: number;
    fovClass: FovClass;
    /** Sight range (scene metres) for the peripheral cues and the search planner. */
    sight: number;
    /** How far it can find its way home after release (m), design §3.3. */
    homingRange: number;
};

function hasMove(p: ArkBehaviourProfile, move: ArkMove): boolean {
    if (MOVE_QUIRKS[p.slug]?.includes(move)) return false;
    return p.move === move || p.moves.includes(move);
}

const cache = new Map<string, Abilities>();

/** A species' abilities (cached). */
export function abilitiesOf(slug: string): Abilities {
    const hit = cache.get(slug);
    if (hit) return hit;
    const profile = behaviourProfile(slug);
    const D = arkBody({model_slug: slug}).display;
    const body = bodyClassOf(slug);
    // (Its own row, or a diver's; never the sea zones' fallback, which would give a kestrel a depth band.)
    const depth = speciesDepth(slug, "");
    const intel = intelProfile(slug);
    const speed = profile.speed ?? 40;
    const stat = Math.min(Math.max(0.6 + (speed / 100) * 1.4, 0.4), 2.2);

    const sessile = profile.move === "sessile";
    const walks = !sessile && (hasMove(profile, "walk") || hasMove(profile, "crawl") || hasMove(profile, "slither") || hasMove(profile, "hop") || hasMove(profile, "climb"));
    const canFly = !sessile && hasMove(profile, "fly");
    const canSwim = !sessile && (hasMove(profile, "swim") || (Boolean(depth) && profile.move === "swim"));
    const gills = canSwim && !walks && !canFly && (body === "f" || (Boolean(depth) && !(depth?.breathes ?? false) && !profile.breathes));
    const breathes = canSwim && !gills;
    const canClimb = !sessile && (hasMove(profile, "climb") || profile.surface !== null);
    const canBurrow = !sessile && (profile.move === "burrow" || (hasMove(profile, "burrow") && FOSSORIAL.test(slug)));

    const walk = walks ? bodyLengthsPerSecond(profile) * D * PACE_CAP : 0;
    const rf = runFactor(profile);
    const run = walks && rf > 1 ? walk * rf : 0;
    const flee = Math.min(D * (1.5 + 4 * (speed / 100)) * Math.min(Math.max(1 / Math.sqrt(Math.max(D, 0.2)), 0.8), 2.2), SPRINT_CAP);
    const sprint = run > 0 ? Math.min(Math.max(run, flee), SPRINT_CAP) : 0;
    const swim = canSwim ? stat * D * 1.4 * PACE_CAP : 0;
    const fly = canFly ? stat * D * 4 * 1.2 * PACE_CAP : 0;
    const climb = canClimb ? Math.max(walk, stat * D * 0.6) * 0.5 : 0;
    const burrow = canBurrow ? walk * 0.25 : 0;
    const wade = walks ? walk * 0.5 : 0;
    // (Most land mammals swim short distances, est.: quadruped mammals without a swim of their own paddle 15 m.)
    const paddles = walks && !canSwim && body === "m";
    const paddle = canSwim && walks ? Math.max(walk * 0.5, swim * 0.5) : paddles ? walk * 0.5 : 0;

    const altitude = canFly ? profile.altitude ?? "mid" : null;
    const cruise = altitude ? CRUISE[altitude] : 0;
    const flightCeiling = canFly ? Math.min(Math.max(3 * cruise, 6), FLIGHT_ABSOLUTE_CAP) : 0;

    const hunter = intel.hunt.some((h) => h !== "filter" && h !== "scavenge");
    const owl = (body === "b" || body === "?") && OWL.test(slug);
    const fovClass: FovClass = owl ? "owl" : body === "i" ? "insect" : hunter ? "hunter" : "prey";
    const fov = fovClass === "owl" ? 70 : fovClass === "hunter" ? 80 : 115;

    // Turning: 4.8 rad/s under 0.5 m, falling to 1.6 rad/s at 3 m and over (est.).
    const turnRate = D <= 0.5 ? 4.8 : D >= 3 ? 1.6 : 4.8 - ((D - 0.5) / 2.5) * 3.2;

    const homeRadius = Math.min(6 + 5 * D, 26);
    const homingRange =
        canFly && (body === "b" || body === "t") ? 200 :
        body === "m" ? Math.max(60, 6 * homeRadius) :
        body === "r" || body === "a" ? 4 * homeRadius :
        body === "i" ? Math.max(10, 2 * homeRadius) :
        gills ? 400 :
        Math.max(40, 4 * homeRadius);

    const abilities: Abilities = {
        slug,
        D,
        body,
        move: profile.move,
        moves: profile.moves,
        sessile,
        walk,
        run,
        sprint,
        swim,
        fly,
        climb,
        burrow,
        wade,
        paddle,
        land: walks,
        canFly,
        canSwim,
        gills,
        breathes,
        canClimb,
        canBurrow,
        diver: canFly && (RAPTOR.test(slug) || SEABIRD.test(slug)),
        seabird: canFly && SEABIRD.test(slug),
        hover: canFly && (/hummingbird|kestrel|hoverfly|sunbird|hawk-moth|hawkmoth/.test(slug) || body === "i"),
        paddles,
        wadeDepth: 0.4 * D,
        altitude,
        flightFloor: 0.3,
        flightCeiling,
        band: depth?.band ?? null,
        water: depth?.water ?? null,
        turnRate,
        fov,
        fovClass,
        sight: intel.sight,
        homingRange
    };
    cache.set(slug, abilities);
    return abilities;
}

/** The steepest ground it walks up (rise over run): mountain animals take the slopes. */
export function maxSlopeFor(zone: ArkZone | string | null | undefined): number {
    return zone === "mountains" ? MOUNTAIN_SLOPE : MAX_SLOPE;
}

/** Whether a species can be controlled at all (D16: sessile animals are "watch as" only). */
export function controllable(slug: string): boolean {
    const a = abilitiesOf(slug);
    return !a.sessile && (a.land || a.canSwim || a.canFly);
}
