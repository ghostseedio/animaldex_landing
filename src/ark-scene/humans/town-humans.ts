/**
 * The town's people (owner 2026-11-17: humans "will live in houses (you can maybe look inside the windows and see them
 * watching tv or something), sitting on benches, inside the moving cars, the speedboats, on the beaches … sunbathing";
 * AnimalDex decision 378). One person per human the record has aboard (the snapshot's `human` animals: one per real
 * human capture), never a crowd beyond that. Each is a generic figure (`figures.ts` humanLook from its id): no photo,
 * no face, no name.
 *
 * Their day is a pure function of the island clock (`people.ts` townClockAt: UTC plus the island's offset) and their
 * id, so every viewer sees the same person in the same place at the same moment:
 * - asleep from their own bedtime (22:00–00:30) to their own waking (6:10–7:50);
 * - workers (60%) away on weekdays from after breakfast to 17:00–18:30 (not drawn: at work);
 * - the rest of the day in 90-minute blocks, home for some, out for the others; who is out in a block goes, in the
 *   order of a hash of (id, day, block), to the speedboats' helms (8:00–19:00), the moving cars' wheels, the benches'
 *   seats, then the beach (10:00–18:00: lying in the sun, or walking the sand), any left over away about the town;
 * - evenings at home: dinner at the table (18:30–19:30), then the TV or the table until bed.
 * At home a person is drawn only in a room the homes lane's see-into rooms give (`HumanRoomHost`); with none, the home
 * stays implied by its lit windows, as before.
 *
 * Everything here is in the town's frame (x east, z south), except the boats' helms, which are the world's.
 */

import {humanLook, humanUnit, sitRootY, BASE_HEIGHT, COVER_PAST_FEET, COVER_REACH, SLEEP_HEIGHT_MAX, SLEEP_REACH, SLEEP_REACH_MAX, SLEEP_SINK, WALK_PACE, type HumanInstance, type HumanLook, type HumanPoseKind} from "@/ark-scene/humans/figures";
import {darkness, townClockAt, weekday, type TownClock} from "@/ark-scene/islands/town/people";
import {sampleTownGround, townHeight} from "@/ark-scene/islands/town/ground";
import {MILLPOND, townPlan, type TownPlan} from "@/ark-scene/islands/town/plan";
import {inBox, inPoly, local, segmentDistance, type Pt} from "@/ark-scene/islands/town/geom";
import {solidDistance, townSolids} from "@/ark-scene/islands/town/solids";
import {PARK_BENCH_RING} from "@/ark-scene/islands/town/render/scenery";
import {BOAT_ROUTES, boatFix} from "@/ark-scene/ocean-traffic";
import {PavementWalks, type PaveKind} from "@/ark-scene/humans/pavements"; // p5 (humans, pavements)
import {heelPose, type DogWalks, type HeelPose} from "@/ark-scene/humans/dog-walks"; // p5 (humans, dogs)
import {bridgeHeight} from "@/ark-scene/islands/town/canal-bridges"; // p5 (humans, pavements)
import {PAVEMENT_LIFT, ROAD_LIFT} from "@/ark-scene/islands/town/render/streets"; // p5 (humans, pavements)
import {carried, childScale, isGrown, parentNow, togetherNow, type HumanBond, type HumanBonds, type HumanChild, type Together} from "@/ark-scene/humans/couples"; // p5 (humans, couples)

/** The Homo sapiens species profile (AnimalDex 2fabfa9a…, #2068) and the stray "Human" profile without a name. */
export const HUMAN_SPECIES_IDS: readonly string[] = ["2fabfa9a-6ec9-4d71-8cf2-1933edaef6d2", "0fd32bd2-669f-489d-8a1b-8e917aa5117d"];

/** Whether a snapshot animal is a human (by its species, its model slug or its scientific name). */
export function isHumanAnimal(a: {species_profile_id?: string | null; model_slug?: string | null; scientific_name?: string | null}): boolean {
    return HUMAN_SPECIES_IDS.indexOf(a.species_profile_id ?? "") >= 0 || a.model_slug === "human" || /^homo\s+sapiens/i.test(a.scientific_name ?? "");
}

/**
 * A human chosen by id from the page (the species list's "Human" row, search, `?focus=`), not by a tap on a figure:
 * the human aboard (null: not a human, so the scene's own entries), with where the camera looks at them if they are
 * drawn now (`out`: `TownHumans.out`), else null (indoors, asleep or at work: the card still opens, over the town).
 * Humans are never scene entries, so before this a chosen human found nothing and the card closed (live, 2026-11-18).
 */
export type ChosenHuman<A> = {human: A; at: {x: number; y: number; z: number; /** Humans visible: seen from this way (yaw), through their room's open front. */ face?: number} | null};
export function chosenHuman<A extends {id: string}>(id: string | null, aboard: readonly A[], out: ReadonlyArray<{id: string; x: number; y: number; z: number; face?: number; what?: string}>, outdoorsFirst = false): ChosenHuman<A> | null {
    if (!id) return null;
    const asked = aboard.find((a) => a.id === id);
    if (!asked) return null;
    let human = asked;
    let drawn = out.find((h) => h.id === id);
    // Humans visible (owner, 2026-11-18): at night a chosen human is one of the few out under the lamps, where one is.
    const outdoors = (h: {what?: string; face?: number}) => h.face === undefined && h.what !== "home" && h.what !== "sleep" && h.what !== "car" && h.what !== "boat";
    if (outdoorsFirst && !(drawn && outdoors(drawn))) {
        const pool = out.filter((h) => outdoors(h) && aboard.some((a) => a.id === h.id));
        if (pool.length) {
            drawn = pool.slice().sort((a, b) => humanUnit(`${id}|${a.id}`) - humanUnit(`${id}|${b.id}`))[0];
            human = aboard.find((a) => a.id === drawn!.id)!;
        }
    }
    if (!drawn) {
        // Humans visible (owner, 2026-11-18: "it just zooms out"): the one asked for is not drawn now (at work, away, or
        // not yet in): another real person who is, the same one for every viewer at this moment (by a hash on the id
        // asked), still or at home before one in a car or a boat; their card, so the card is who is seen. Null only
        // when no one is drawn.
        const still = out.filter((h) => !("what" in h) || (h.what !== "car" && h.what !== "boat"));
        const pool = (still.length ? still : out).filter((h) => aboard.some((a) => a.id === h.id));
        if (pool.length) {
            drawn = pool.slice().sort((a, b) => humanUnit(`${id}|${a.id}`) - humanUnit(`${id}|${b.id}`))[0];
            human = aboard.find((a) => a.id === drawn!.id)!;
        }
    }
    if (!drawn) return {human, at: null};
    return {human, at: drawn.face === undefined ? {x: drawn.x, y: drawn.y + 1, z: drawn.z} : {x: drawn.x, y: drawn.y + 0.6, z: drawn.z, face: drawn.face}};
}

/** The spot halfway between two (the yaw of the first). */
function midpoint(a: Spot, b: Spot): Spot {
    return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, yaw: a.yaw};
}

export type Spot = {x: number; y: number; z: number; /** Facing (three's yaw: forward (sin, cos)). */ yaw: number};

/**
 * Humans polish (2026-11-18): a sleeper lies straight on the back along the bed, the head on the pillow, the covers to
 * the waist. The body's feet are the root and it lies back from them, so its root is the head's spot moved from the head
 * toward the foot (`bed.yaw`, from the head to the foot) by the head's reach (`SLEEP_REACH`, a share of the height),
 * kept off the footboard (`SLEEP_REACH_MAX`: the taller are a little further on the pillow, drawn no taller than
 * `SLEEP_HEIGHT_MAX` so the head stays off the headboard), and a little into the mattress (`SLEEP_SINK`: lying in the
 * bed, not on its covers). `scale`: the sleeper's growth factor.
 */
export function sleeperRoot(bed: Spot, look: {height: number}): {x: number; y: number; z: number; scale: number} {
    const scale = Math.min(1, SLEEP_HEIGHT_MAX / look.height);
    const reach = Math.min(SLEEP_REACH * look.height * scale, SLEEP_REACH_MAX);
    return {x: bed.x + Math.sin(bed.yaw) * reach, y: bed.y - SLEEP_SINK, z: bed.z + Math.cos(bed.yaw) * reach, scale};
}

/** A room people live in (the homes lane's see-into rooms): its floor's height and its furniture's spots, town frame. */
export type HumanRoom = {
    id: string;
    /** The room's floor (m). */
    floor: number;
    /** The sofa's seats facing the TV (the seat's top, where a sitter sits). */
    seats: Spot[];
    /** The TV (its screen's middle and which way it faces), or null. */
    tv: Spot | null;
    /** Chairs at the table (the seat's top), facing the table. */
    chairs: Spot[];
    /** Where people sleep: where the head rests (on the pillow, at the mattress's top); `yaw` from the head to the foot (humans polish: the body lies from there toward the foot, `sleeperRoot`). */
    beds: Spot[];
    /** Humans visible: the way out through the room's open front (yaw): the way a person indoors is seen from. */
    front?: number;
    /** Humans polish: the duvet's colour (linear, 0–1): a sleeper's cover is the bed's. */
    duvet?: [number, number, number];
};

/** Who gives the rooms (wired after the homes / rural lanes merge: their `home-rooms.ts` rooms and furniture). */
export interface HumanRoomHost {
    rooms(): readonly HumanRoom[];
}

/** Ten benches' seats: the park's round the millpond and the square's (two sitters each). */
export type Seat = Spot & {bench: string};

/** How far a sunbather's spot keeps from every beach walk's line (m). */
export const SUN_CLEAR = 1.6;
export type TownHumanSites = {seats: Seat[]; beach: Pt[]; walks: Array<[Pt, Pt]>; /** Quality pass: the shallows off the beach (ankle to knee deep at mid tide), where some paddle. */ shallows: Pt[]};

/** Humans polish: a sleeper's cover (world frame), drawn by `sleep-covers.ts`: its foot end on the mattress, turned to `yaw` (the way the feet point), `length` m to the chest. */
export type SleepCover = {x: number; y: number; z: number; yaw: number; length: number; colour: [number, number, number]};

/** Quality pass: a towel or a parasol on the beach (world frame), drawn by `beach-props.ts`. */
export type BeachProp = {kind: "towel" | "parasol"; x: number; y: number; z: number; yaw: number; /** The slope along it (rad). */ tilt: number; /** Its cloth's colour (0–1 sRGB). */ colour: [number, number, number]};

/** Towels' and parasols' cloths: beach colours (stripes on white). */
const BEACH_CLOTH: Array<[number, number, number]> = ["#d8443a", "#2f6fb5", "#f0b630", "#2f9a8a", "#e0708c", "#5a4aa0", "#f07a3a", "#3aa0d8", "#7ab04a"].map((v) => {
    const n = parseInt(v.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
});

let sitesMemo: {plan: TownPlan; sites: TownHumanSites} | null = null;

/** A bench's frame (the kit's: local +z its front) to its two seats (the seat's top 0.44 m up, facing its front). */
function benchSeats(id: string, x: number, z: number, rot: number, y: number, out: Seat[]) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (const lx of [-0.42, 0.42]) {
        // (The kit's frame: world = (x + lx·c − lz·s, z + lx·s + lz·c); a sitter a little forward of the back.)
        const lz = 0.02;
        out.push({bench: id, x: x + lx * c - lz * s, y: y + 0.44, z: z + lx * s + lz * c, yaw: Math.atan2(-s, c)});
    }
}

/**
 * Where the town's people go out: the benches' seats (the park's four round the millpond, `scenery.ts`
 * parkBenchSpots, and the square's three), the beach's dry sand (a 2.5 m grid of points well above the tide's reach
 * and clear of the water, on the beach's own ground), and walks along it.
 */
export function townHumanSites(plan: TownPlan = townPlan()): TownHumanSites {
    if (sitesMemo && sitesMemo.plan === plan) return sitesMemo.sites;
    const seats: Seat[] = [];
    const ground = (x: number, z: number) => townHeight(x, z);
    // The park's benches round the millpond (scenery.ts parkBenchSpots; their feet on the lower of their corners).
    [165, 70, 215, 298].forEach((deg, i) => {
        const a = (deg * Math.PI) / 180;
        const x = MILLPOND.x + Math.cos(a) * (MILLPOND.rx + PARK_BENCH_RING);
        const z = MILLPOND.z + Math.sin(a) * (MILLPOND.rz + PARK_BENCH_RING);
        const rot = Math.atan2(MILLPOND.x - x, MILLPOND.z - z);
        benchSeats(`park${i}`, x, z, rot, benchFloor(x, z, rot, ground) + 0.1, seats);
    });
    // The square's (scenery.ts square: two facing the fountain along the north side, one at the west end).
    const s = plan.square;
    for (const [k, lx, lz, turn] of [[0, -8, -s.d / 2 + 2, 0], [1, 8, -s.d / 2 + 2, 0], [2, -s.w / 2 + 2, 4, Math.PI / 2]] as const) {
        const p = local(s, lx, lz);
        const rot = s.rot + turn;
        benchSeats(`square${k}`, p.x, p.z, rot, benchFloor(p.x, p.z, rot, ground) + 0.1, seats);
    }
    // The beach: dry sand from 5 m above the waterline's reach to where the sand ends, on a 2.5 m grid.
    const beachArea = plan.greens.find((g) => g.kind === "beach");
    const beach: Pt[] = [];
    // (Clear of what stands on the sand: the fish shed, the huts, the boats pulled up, the hedges' ends.)
    const solids = townSolids([], plan);
    const clear = (x: number, z: number, margin: number) => plan.buildings.every((b) => !inBox(b.at, x, z, margin)) && solids.every((sd) => solidDistance(sd, x, z) > margin);
    if (beachArea) {
        for (let z = 110; z < 170; z += 2.5) {
            for (let x = 50; x < 200; x += 2.5) {
                if (!inPoly(beachArea.poly, x, z)) continue;
                const g = sampleTownGround(x, z);
                if (g.surface !== "sand" || g.inland < 6 || g.height < 0.9 || !clear(x, z, 1.6)) continue;
                // (Its whole towel on sand: the corners round it too.)
                let ok = true;
                for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
                    const c = sampleTownGround(x + dx, z + dz);
                    if (c.surface !== "sand" || c.inland < 5 || !inPoly(beachArea.poly, x + dx, z + dz)) ok = false;
                }
                if (ok) beach.push({x, z});
            }
        }
    }
    // Walks: along the dry sand's landward edge and along its seaward edge (a row of the grid each, end to end), the
    // sunbathers between them.
    const walks: Array<[Pt, Pt]> = [];
    const rows = Array.from(new Set(beach.map((p) => p.z))).sort((x, y) => x - y);
    const rowLine = (z: number): [Pt, Pt] | null => {
        const xs = beach.filter((p) => p.z === z).map((p) => p.x);
        if (xs.length < 6) return null;
        const line: [Pt, Pt] = [{x: Math.min(...xs), z}, {x: Math.max(...xs), z}];
        return walkOnSand(line[0], line[1], clear) ? line : null;
    };
    const landward = rows.map(rowLine).find((line) => line) ?? null;
    const seaward = rows.slice().reverse().map(rowLine).find((line) => line) ?? null;
    if (landward) walks.push(landward);
    if (seaward && landward && seaward[0].z - landward[0].z >= 7.5) walks.push(seaward);
    const lines = walks.filter(([a, b]) => walkOnSand(a, b, clear));
    // The sunbathers' spots keep clear of the walks (`SUN_CLEAR` from anywhere along a body lying feet to the sea):
    // no one walks over someone lying down.
    // Quality pass: the shallows off the beach (the sand under 0.15–0.6 m of water at mid tide, 2–10 m out), clear of
    // the boats and the jetty.
    const shallows: Pt[] = [];
    if (beach.length) {
        const xs = beach.map((p) => p.x);
        for (let z = 130; z < 200; z += 2.5) {
            for (let x = Math.min(...xs) - 10; x <= Math.max(...xs) + 10; x += 2.5) {
                const g = sampleTownGround(x, z);
                if (g.inland > -2 || g.inland < -10 || g.height > -0.15 || g.height < -0.6 || !clear(x, z, 3)) continue;
                shallows.push({x, z});
            }
        }
    }
    const sites = {seats, beach: beach.filter((p) => lines.every(([a, b]) => [0, 0.85, 1.7].every((up) => segmentDistance(p.x, p.z - up, a.x, a.z, b.x, b.z) >= SUN_CLEAR))), walks: lines, shallows};
    sitesMemo = {plan, sites};
    return sites;
}

function benchFloor(x: number, z: number, rot: number, ground: (x: number, z: number) => number): number {
    let y = ground(x, z);
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (const [lx, lz] of [[-0.85, 0.22], [0.85, 0.22], [-0.85, -0.26], [0.85, -0.26]]) y = Math.min(y, ground(x + lx * c - lz * s, z + lx * s + lz * c));
    return y;
}

/** Whether a straight walk between two points stays on dry sand (every metre). */
function walkOnSand(a: Pt, b: Pt, clear: (x: number, z: number, margin: number) => boolean): boolean {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z));
    for (let i = 0; i <= n; i++) {
        const t = n ? i / n : 0;
        const g = sampleTownGround(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
        if (g.surface !== "sand" || g.inland < 5 || !clear(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.5)) return false;
    }
    return true;
}

// MARK: - The day

export type HumanDay = "sleep" | "home" | "work" | "out";

const BLOCK_HOURS = 1.5;

/**
 * Humans visible (2026-11-18): who keeps the town's late hours, by the id (`#night`), so a few are about at any hour:
 * - "owl" (14%): to bed between 00:45 and 04:45, up from 08:18; a last walk or a sit on a lamp-lit bench before bed;
 * - "late" (6%): a late shift on weekday evenings (from 17:00–17:30 to 01:30–03:30), the walk home after it;
 * - "early" (5%): up at 03:40–04:35 for an early shift (to 13:30–14:30), the walk to work before five.
 */
export type NightKind = "usual" | "owl" | "late" | "early";

/** A person's own rhythm (pure in the id). Hours past 24 are after midnight (a bedtime of 25.5 is 01:30). */
export function rhythm(id: string) {
    const r = humanUnit(`${id}#rhythm`);
    const night = humanUnit(`${id}#night`);
    const kind: NightKind = night < 0.14 ? "owl" : night < 0.2 ? "late" : night < 0.25 ? "early" : "usual";
    const out = {wake: 6.15 + r * 1.65, bed: 22 + humanUnit(`${id}#bed`) * 2.5, worker: humanUnit(`${id}#works`) < 0.6, back: 17 + humanUnit(`${id}#back`) * 1.5, homebody: humanUnit(`${id}#home`), kind, start: 9, leave: undefined as number | undefined};
    if (kind === "owl") {
        out.bed = 24.75 + humanUnit(`${id}#bed`) * 4;
        // (Up before half past nine: a dog's morning walk is over by ten, `dog-walks.ts`.)
        out.wake = 8.3 + r * 1.0;
    } else if (kind === "late") {
        out.worker = true;
        out.start = 17 + humanUnit(`${id}#start`) * 0.5;
        out.leave = out.start - 0.25;
        out.back = 25.5 + humanUnit(`${id}#back`) * 2;
        out.bed = out.back + 0.5;
        out.wake = 10 + r * 1.5;
    } else if (kind === "early") {
        out.worker = true;
        out.wake = 3.7 + r * 0.9;
        out.leave = out.wake + 0.55;
        out.back = 13.5 + humanUnit(`${id}#back`);
        out.bed = 20.6 + humanUnit(`${id}#bed`) * 0.9;
    }
    return out;
}

/** Whether a weekday (`weekday`: 0 is Sunday) is a working day. */
const workday = (day: number) => day >= 1 && day <= 5;

/** Where a person's day has them at a moment of the island clock (pure in the clock and the id). */
export function humanDay(id: string, clock: TownClock): HumanDay {
    const h = clock.hours;
    const r = rhythm(id);
    const bed = r.bed % 24;
    const asleep = bed < 12 ? h >= bed && h < r.wake : h >= r.bed || h < r.wake;
    if (asleep) return "sleep";
    const day = weekday(clock);
    if (r.kind === "late") {
        // A weekday evening's shift, on into the small hours (the day before's, after midnight).
        if (workday(day) && h >= r.start) return "work";
        if (workday((day + 6) % 7) && h < r.back - 24) return "work";
    }
    if (h < r.wake + 1) return "home";
    if (r.worker && r.kind !== "late" && workday(day) && h < r.back) return "work";
    // Dinner at home, then the evening in.
    if (h >= 18.5) return "home";
    if (h < 9) return "home";
    const block = Math.floor(h / BLOCK_HOURS);
    return humanUnit(`${id}#${clock.day}#${block}#in`) < 0.25 + r.homebody * 0.25 ? "home" : "out";
}

/**
 * Humans visible: a night person's walk or sit now (the night's `key`: the day its evening began; `late`: hours past 24
 * after midnight), or null. An owl's last outing before bed (half the nights a walk, else a lamp-lit bench); a late
 * shift's walk to work and home. Pure in the id and the clock.
 */
export type NightOuting = {kind: "owl" | "late" | "home"; key: number; at: number; hours: number; bench: boolean};
export function nightOuting(id: string, clock: TownClock): NightOuting | null {
    const r = rhythm(id);
    if (r.kind !== "owl" && r.kind !== "late") return null;
    const after = clock.hours < 12;
    const key = after ? clock.day - 1 : clock.day;
    const hours = after ? clock.hours + 24 : clock.hours;
    if (r.kind === "owl") {
        // Out for 35–60 minutes, home 20–50 minutes before bed.
        const length = 0.6 + humanUnit(`${id}#${key}#owl#len`) * 0.4;
        const at = r.bed - 0.33 - humanUnit(`${id}#${key}#owl#at`) * 0.5 - length;
        if (hours < at || hours >= at + length) return null;
        return {kind: "owl", key, at, hours, bench: humanUnit(`${id}#${key}#owl#bench`) < 0.5};
    }
    // The late shift: a weekday evening's walk to work (leaving at `leave`) and its walk home (arriving at `back`).
    if (!workday(((key % 7) + 7) % 7)) return null;
    if (!after && r.leave !== undefined && hours >= r.leave && hours < r.start) return {kind: "late", key, at: r.leave, hours, bench: false};
    if (hours >= r.back - 0.6 && hours < r.back) return {kind: "home", key, at: r.back, hours, bench: false};
    return null;
}

/** What a person is doing out: at a boat's helm, at a car's wheel or beside its driver, on a bench, on the beach, or about the town (not drawn). */
export type OutWhat = {kind: "boat"; boat: number; seat: 0 | 1} | {kind: "car"; car: number; seat: 0 | 1} | {kind: "bench"; seat: number} | {kind: "sun"; spot: number} | {kind: "walk"; walk: number; offset: number} | {kind: "paddle"; spot: number} | {kind: "about"};

/**
 * Who is out in a block goes where (pure in the block and the people out): in the order of a hash of (id, day, block),
 * the speedboats' helms first (by day), then the cars' wheels (one for each of the town's moving cars; a few take a
 * passenger), then the benches' seats, then the beach (by day: lying in the sun or walking), the rest about the town.
 */
export function assignOut(out: readonly string[], clock: TownClock, sites: TownHumanSites, cars: number): Map<string, OutWhat> {
    const block = Math.floor(clock.hours / BLOCK_HOURS);
    const order = out.slice().sort((a, b) => humanUnit(`${a}#${clock.day}#${block}#go`) - humanUnit(`${b}#${clock.day}#${block}#go`) || (a < b ? -1 : 1));
    const result = new Map<string, OutWhat>();
    const h = clock.hours;
    const boats = h >= 8 && h < 19 ? BOAT_ROUTES.filter((r) => r.kind === "speedboat").length : 0;
    let k = 0;
    for (let b = 0; b < boats && k < order.length; b++) result.set(order[k++], {kind: "boat", boat: b, seat: 0});
    for (let c = 0; c < cars && k < order.length; c++) {
        result.set(order[k++], {kind: "car", car: c, seat: 0});
        if (humanUnit(`car#${c}#${clock.day}#${block}#pass`) < 0.3 && k < order.length) result.set(order[k++], {kind: "car", car: c, seat: 1});
    }
    // Benches: about half the seats taken at a time (a stranger leaves the other end free).
    const seats = sites.seats.length;
    const used = new Set<number>();
    const benchGoers = Math.min(Math.ceil(seats * 0.55), order.length - k);
    for (let i = 0; i < benchGoers; i++) {
        const id = order[k++];
        let s = Math.floor(humanUnit(`${id}#${clock.day}#${block}#seat`) * seats);
        while (used.has(s)) s = (s + 1) % seats;
        used.add(s);
        result.set(id, {kind: "bench", seat: s});
    }
    const sunny = h >= 10 && h < 18 && sites.beach.length > 0;
    const spots = new Set<number>();
    const wades = new Set<number>();
    while (k < order.length) {
        const id = order[k++];
        // p5 (humans, pavements): the beach takes under half of those left on a sunny day; the others are about the
        // town on foot (`pavements.ts`).
        if (!sunny || humanUnit(`${id}#${clock.day}#${block}#beach`) >= 0.45) {
            result.set(id, {kind: "about"});
            continue;
        }
        // Quality pass: some stand paddling in the shallows.
        if (humanUnit(`${id}#${clock.day}#${block}#walk`) < 0.14 && sites.shallows.length) {
            // (Two paddlers 5 m apart at least.)
            let w = Math.floor(humanUnit(`${id}#${clock.day}#${block}#wade`) * sites.shallows.length);
            let tries = 0;
            while (tries++ < sites.shallows.length && Array.from(wades).some((o) => Math.hypot(sites.shallows[o].x - sites.shallows[w].x, sites.shallows[o].z - sites.shallows[w].z) < 5)) w = (w + 7) % sites.shallows.length;
            if (tries <= sites.shallows.length) {
                wades.add(w);
                result.set(id, {kind: "paddle", spot: w});
                continue;
            }
        }
        if (humanUnit(`${id}#${clock.day}#${block}#walk`) < 0.35 && sites.walks.length) {
            result.set(id, {kind: "walk", walk: Math.floor(humanUnit(`${id}#walkline`) * sites.walks.length), offset: humanUnit(`${id}#${block}#walkoff`)});
            continue;
        }
        // A spot of sand two cells from any other sunbather (no towels overlap).
        let s = Math.floor(humanUnit(`${id}#${clock.day}#${block}#sand`) * sites.beach.length);
        let tries = 0;
        while (tries++ < sites.beach.length && Array.from(spots).some((o) => Math.hypot(sites.beach[o].x - sites.beach[s].x, sites.beach[o].z - sites.beach[s].z) < 3.5)) s = (s + 7) % sites.beach.length;
        if (tries > sites.beach.length) {
            result.set(id, {kind: "about"});
            continue;
        }
        spots.add(s);
        result.set(id, {kind: "sun", spot: s});
    }
    return result;
}

/**
 * Humans visible (owner, 2026-11-18: "we should still have a few people outside at night, just not as many"): from
 * 17:30 to 08:30, in each 20-minute slot, a few of the grown (2.5%, at least 2) step out, chosen by a hash on the
 * night and the slot: those up at home first, then any not at work (up early, can't sleep). Pure in the clock and ids.
 */
export const NIGHT_ROTA_SHARE = 0.025;
export function nightRota(ids: readonly string[], clock: TownClock, dayOf: (id: string) => HumanDay | undefined, busy: ReadonlySet<string>): string[] {
    const h = clock.hours;
    if (!(h >= 17.5 || h < 8.5)) return [];
    const key = h < 12 ? clock.day - 1 : clock.day;
    const slot = Math.floor((h < 12 ? h + 24 : h) * 3);
    const want = Math.max(2, Math.round(ids.length * NIGHT_ROTA_SHARE));
    const rank = (id: string) => humanUnit(`${id}#${key}#${slot}#rota`);
    const free = ids.filter((id) => !busy.has(id) && dayOf(id) !== "work");
    const up = free.filter((id) => dayOf(id) === "home").sort((a, b) => rank(a) - rank(b));
    const rest = free.filter((id) => dayOf(id) !== "home").sort((a, b) => rank(a) - rank(b));
    return up.concat(rest).slice(0, want);
}

// MARK: - The people drawn

/** A human of the record (`born_ark_day`, `origin`: an Ark-born child is small until grown; p5 (humans, couples)). */
export type TownHumanRecord = {id: string; origin?: string | null; born_ark_day?: number | null};

/** A moving car as the traffic gives it (`vehicles.ts` MovingCar: its middle, heading, whether it drives now). */
export type CarFix = {index: number; x: number; z: number; dx: number; dz: number; active: boolean};

export type TownHumansOptions = {
    /** The town's origin in the world (the figures are drawn in the world's frame). */
    origin: {x: number; z: number};
    /** The island clock's offset (hours). */
    offsetHours?: number;
    /** A person away now (the logging lane: at work in the wild island's forest): not drawn in the town. */
    away?: (id: string, epochMs: number) => boolean;
    /** The road's height under a car (`vehicles.ts` roadHeight). */
    roadHeight?: (x: number, z: number) => number;
    /** The sea's level now (the boats float on it). */
    seaLevel?: () => number;
    /** The open sea's boats' clock (seconds: `OceanTrafficView.step`'s), when it is not the island clock's. */
    boatSeconds?: () => number;
    /** p5 (humans, pavements): false: no one walks the pavements (the "about" people are not drawn, as before). */
    pavements?: boolean;
    /** p5 (humans, pavements): the drawn ground under a walker (town frame; `near`: about where it is), when the scene has it. */
    walkHeight?: (x: number, z: number, near: number) => number;
};

/** p5 (humans, pavements): a walker's ground (town frame): the bridge's deck or the ground, and the pavement's or the road's lift. */
export function walkGround(x: number, z: number, kind: PaveKind): number {
    return (bridgeHeight(x, z, townHeight) ?? townHeight(x, z)) + (kind === "crossing" || kind === "zebra" ? ROAD_LIFT : kind === "path" ? 0.03 : PAVEMENT_LIFT);
}

/** A seated driver's lean back (rad) so the head clears the roof: more for the tallest. */
function driverLean(look: HumanLook): number {
    return 0.3 + Math.max(0, look.height / BASE_HEIGHT - 0.9) * 1.6;
}

/**
 * A seat in a moving car (town frame): driving on the left, the driver on the right (local −x facing +z), the passenger
 * beside; the hips 0.25 m over the road (these cars' roofs are low: the driver leans back to clear it, `driverLean`).
 */
export function carSeat(car: {x: number; z: number; dx: number; dz: number}, seat: 0 | 1, road: number, scale: number): Spot {
    const yaw = Math.atan2(car.dx, car.dz);
    const lx = seat === 0 ? -0.37 : 0.37;
    const lz = 0.05;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return {x: car.x + lx * c + lz * s, y: sitRootY(road + 0.03 + 0.22, scale), z: car.z - lx * s + lz * c, yaw};
}

/** A speedboat's helm seat (world frame): x −0.32, z −0.55 on its 0.78 m deck, the seat's top 0.5 m up, facing the bow. */
export function helmSeat(fix: {x: number; z: number; yaw: number}, pace: number, sea: number, scale: number): Spot {
    const lx = -0.32;
    const lz = -0.55;
    const c = Math.cos(fix.yaw);
    const s = Math.sin(fix.yaw);
    // (The hull rides 0.12 m higher at full speed and trims bow-up 0.09 rad: the seat aft of the middle sits a little lower.)
    return {x: fix.x + lx * c + lz * s, y: sitRootY(sea + 0.12 * pace + 1.28 + lz * 0.09 * pace, scale), z: fix.z - lx * s + lz * c, yaw: fix.yaw};
}

export type DrawnHuman = HumanInstance & {id: string; what: HumanDay | OutWhat["kind"] | /* p5 (humans, pavements) */ "pavement" | /* p5 (humans, dogs) */ "dogwalk"; /** Humans visible: indoors, the way they are seen from (their room's front). */ face?: number};

/**
 * p5 (humans, dogs): a dog on its walk now (world frame): the record's own dog (`id`), where it walks at heel, and its
 * lead's hand end (the walker's hand). The scene moves that dog's own entry there (`index.ts`): never a second dog.
 */
export type WalkedDog = {id: string; walker: string; length: number; x: number; y: number; z: number; yaw: number; sniffing: boolean; speed: number; hand: {x: number; y: number; z: number}};

/**
 * The town's people now: `frame` fills `out` (reused, world frame) with everyone drawn at this moment: in a room at
 * home (only with a room host), on a bench, at a car's wheel, at a boat's helm, on the beach.
 */
export class TownHumans {
    private roster: string[] = [];
    private looks = new Map<string, HumanLook>();
    private rooms: HumanRoomHost | null = null;
    // (Worked out when first needed: with nobody aboard the town's benches, sand and solids are never read.)
    private sitesMemo: TownHumanSites | null = null;
    private get sites(): TownHumanSites {
        return this.sitesMemo ?? (this.sitesMemo = townHumanSites(this.plan));
    }
    private blockKey = "";
    private assigned = new Map<string, OutWhat>();
    private homes = new Map<string, {room: number; slot: number}>();
    private pool: DrawnHuman[] = [];
    readonly out: DrawnHuman[] = [];
    /** The TVs on now (a room's, while someone in it watches), world frame. */
    readonly tvs: Array<Spot & {room: string}> = [];
    private tvPool: Array<Spot & {room: string}> = [];
    // p5 (humans, couples): the record's couples and children (`couples.ts`); the grown (who keep the town's day) and
    // the young (who are with a parent), by the Ark day.
    private everyone: TownHumanRecord[] = [];
    private bonds: HumanBond[] = [];
    private children = new Map<string, HumanChild>();
    private born = new Map<string, number>();
    private young: string[] = [];
    private arkDay = Infinity;
    private claimedSeats = new Set<number>();
    private placed = new Map<string, DrawnHuman>();
    private beside = new Map<string, number>();
    // p5 (humans, dogs): the dog walks (`dog-walks.ts`) and the dogs out on them now.
    private dogWalks: DogWalks | null = null;
    readonly dogs: WalkedDog[] = [];
    private dogPool: WalkedDog[] = [];
    private readonly heel: HeelPose = {x: 0, z: 0, yaw: 0, sniffing: false, speed: 0};
    private inArms = new Set<string>();
    // Humans polish: the covers over those asleep now (world frame), and who is asleep in which room (one alone in a bed is moved to its middle once everyone is placed).
    readonly covers: SleepCover[] = [];
    private coverPool: SleepCover[] = [];
    private roomFill = new Map<number, number>();
    private sleepList: Array<{room: number; h: DrawnHuman; cover: SleepCover; look: HumanLook}> = [];
    private sleepCount = 0;
    private sleepTally = new Map<number, number>();
    // Quality pass: the beach's towels and parasols now (world frame), and the beach's looks (swimwear: bare arms and legs).
    readonly beach: BeachProp[] = [];
    private propPool: BeachProp[] = [];
    private beachLooks = new Map<string, HumanLook>();
    private beachLook(id: string, look: HumanLook): HumanLook {
        let b = this.beachLooks.get(id);
        if (!b || b.child !== look.child) {
            b = {...look, sleeves: 0, trousers: 0, swim: 1}; // p6 (people): swimwear on the rigged bodies
            this.beachLooks.set(id, b);
        }
        return b;
    }
    /** Humans polish: the cover over a sleeper whose feet (the root) are at (x, z) turned to `yaw`: from past the feet to their chest, on the mattress (`mattressY`). */
    private cover(x: number, z: number, yaw: number, height: number, mattressY: number, colour: [number, number, number] | undefined): SleepCover {
        const k = this.covers.length;
        const c = this.coverPool[k] ?? (this.coverPool[k] = {x: 0, y: 0, z: 0, yaw: 0, length: 0, colour: [1, 1, 1]});
        c.x = x + Math.sin(yaw) * COVER_PAST_FEET;
        c.y = mattressY - 0.02;
        c.z = z + Math.cos(yaw) * COVER_PAST_FEET;
        c.yaw = yaw;
        c.length = COVER_REACH * height + COVER_PAST_FEET;
        c.colour = colour ?? c.colour;
        this.covers.push(c);
        return c;
    }
    private prop(kind: BeachProp["kind"], x: number, y: number, z: number, yaw: number, tilt: number, colour: [number, number, number]) {
        const k = this.beach.length;
        const p = this.propPool[k] ?? (this.propPool[k] = {kind, x, y, z, yaw, tilt, colour});
        p.kind = kind;
        p.x = x;
        p.y = y;
        p.z = z;
        p.yaw = yaw;
        p.tilt = tilt;
        p.colour = colour;
        this.beach.push(p);
    }

    /** p5 (humans, pavements): who walks the pavements now (`pavements.ts`). */
    get walks(): PavementWalks | null {
        if (this.walksMemo === undefined) this.walksMemo = this.options.pavements === false ? null : new PavementWalks(this.plan);
        return this.walksMemo;
    }
    private walksMemo: PavementWalks | null | undefined;

    /**
     * (Nothing of the town is read here: the plan, the sites and the pavements are worked out when the first person is
     * aboard, so a scene with nobody aboard pays nothing at its mount, and the town's own prebuild still makes the plan.)
     */
    constructor(private readonly options: TownHumansOptions, private readonly planGiven?: TownPlan) {}

    private get plan(): TownPlan {
        return this.planGiven ?? townPlan();
    }

    /** The record's humans (one per real human capture aboard, the server's). */
    setRoster(humans: readonly TownHumanRecord[]): void {
        const all = humans.map((h) => h.id).sort();
        if (all.join(",") === this.everyone.map((h) => h.id).join(",")) return;
        this.everyone = humans.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        this.sortAges();
    }

    // p5 (humans, couples) ---------------------------------------------------------------------------------------
    /** The record's couples and children (`/api/ark/human-bonds`, decoded): partners share a home, the young are with a parent. */
    setBonds(bonds: HumanBonds): void {
        this.bonds = bonds.bonds;
        this.children = new Map(bonds.children.map((c) => [c.id, c]));
        this.sortAges();
    }

    /** The shared Ark day (a child's age): the grown and the young are sorted again when a child comes of age. */
    setArkDay(day: number | null): void {
        const next = day ?? Infinity;
        const was = this.arkDay;
        this.arkDay = next;
        if (this.young.some((id) => isGrown(this.born.get(id), "born", next)) || (was === Infinity) !== (next === Infinity)) this.sortAges();
    }

    /** Who keeps the town's day (the grown: `roster`) and who is with a parent (`young`), then everyone's home. */
    private sortAges() {
        this.born.clear();
        for (const h of this.everyone) {
            const born = this.children.get(h.id)?.born ?? (h.origin === "born" ? h.born_ark_day ?? null : null);
            if (born !== null) this.born.set(h.id, born);
        }
        const grown = (h: TownHumanRecord) => !this.born.has(h.id) || isGrown(this.born.get(h.id), "born", this.arkDay);
        this.roster = this.everyone.filter(grown).map((h) => h.id);
        this.young = this.everyone.filter((h) => !grown(h)).map((h) => h.id);
        this.looks = new Map(this.everyone.map((h) => [h.id, grown(h) ? humanLook(h.id) : {...humanLook(h.id), child: true}]));
        this.blockKey = "";
        this.assignHomes();
    }

    /** p5 (humans, dogs): who walks which dog, when and where (`dog-walks.ts`; null: nobody walks a dog). */
    setDogWalks(walks: DogWalks | null): void {
        this.dogWalks = walks;
    }

    /** The beach's walks (their two ends, town frame): where a dog walk may head for. */
    get beachWalks(): ReadonlyArray<[Pt, Pt]> {
        return this.sites.walks;
    }

    /** The grown people (who keep the town's day: the dog walkers are of them). */
    get grown(): readonly string[] {
        return this.roster;
    }

    /** The bond a grown human is in (a living partner aboard), or null. */
    private bondOf(id: string): HumanBond | null {
        for (const b of this.bonds) if ((b.a === id || b.b === id) && this.looks.has(b.a) && this.looks.has(b.b)) return b;
        return null;
    }
    // ------------------------------------------------------------------------------------------------------------

    /** Everyone aboard: the grown and the young. */
    get count(): number {
        return this.everyone.length;
    }

    setRoomHost(host: HumanRoomHost | null): void {
        this.rooms = host;
        this.assignHomes();
    }

    /** Each person's room: two to a room, by a rendezvous of the rooms on the id (stable as people come and go). */
    private assignHomes() {
        this.homes.clear();
        this.roomFill.clear();
        const rooms = this.rooms?.rooms() ?? [];
        if (!rooms.length) return;
        const fill = this.roomFill;
        fill.clear();
        const capacity = (i: number) => Math.max(1, Math.min(2, rooms[i].seats.length, Math.max(rooms[i].beds.length, 1) * 2));
        // p5 (humans, couples): a couple living together shares the host's room (the host first, the partner beside),
        // before the singles take theirs.
        const paired = new Set<string>();
        const rendezvous = (id: string, room: (i: number) => boolean) => rooms.map((r, i) => ({i, u: humanUnit(`${id}|${r.id}`)})).sort((a, b) => b.u - a.u).find((r) => room(r.i));
        for (const bond of this.bonds) {
            if (bond.stage !== "together" || !this.roster.includes(bond.a) || !this.roster.includes(bond.b)) continue;
            const host = bond.home === bond.b ? bond.b : bond.a;
            const pick = rendezvous(host, (i) => (fill.get(i) ?? 0) === 0);
            if (!pick) continue;
            fill.set(pick.i, 2);
            this.homes.set(host, {room: pick.i, slot: 0});
            this.homes.set(host === bond.a ? bond.b : bond.a, {room: pick.i, slot: 1});
            paired.add(bond.a);
            paired.add(bond.b);
        }
        for (const id of this.roster) {
            if (paired.has(id)) continue;
            const ranked = rooms.map((room, i) => ({i, u: humanUnit(`${id}|${room.id}`)})).sort((a, b) => b.u - a.u);
            const pick = ranked.find((r) => (fill.get(r.i) ?? 0) < capacity(r.i));
            if (!pick) continue;
            const slot = fill.get(pick.i) ?? 0;
            fill.set(pick.i, slot + 1);
            this.homes.set(id, {room: pick.i, slot});
        }
    }

    /** Humans visible: the rooms someone lives in (their ids), for the scene to draw them furnished. */
    homeRooms(): string[] {
        const rooms = this.rooms?.rooms() ?? [];
        const ids = new Set<string>();
        this.homes.forEach((home) => {
            const room = rooms[home.room];
            if (room) ids.add(room.id);
        });
        return Array.from(ids).sort();
    }

    lookOf(id: string): HumanLook | undefined {
        return this.looks.get(id);
    }

    /** Humans visible: whether the last frame was at night (18:00–07:00): a chosen human is then one of the few out. */
    nightNow = false;

    /** Humans visible: one of the night's few out (`nightRota`) drawn: at their door, on a bench or walking; false: not placed. */
    private stepOut(id: string, clock: TownClock, take: (id: string, look: HumanLook, what: DrawnHuman["what"], x: number, y: number, z: number, yaw: number, pose: HumanPoseKind, phase: number) => DrawnHuman, lampLit: number, epochMs: number): boolean {
        const look = this.looks.get(id)!;
        const scale = look.height / BASE_HEIGHT;
        const phase = humanUnit(`${id}#phase`) * 100;
        const ox = this.options.origin.x;
        const oz = this.options.origin.z;
        const h = clock.hours;
        const key = h < 12 ? clock.day - 1 : clock.day;
        const hours = h < 12 ? h + 24 : h;
        const slot = Math.floor(hours * 3);
        const mode = humanUnit(`${id}#${key}#${slot}#mode`);
        if (mode >= 0.7 && this.walks) {
            const fix = this.walks.night(id, "owl", key * 128 + slot, slot / 3 + 0.02, hours);
            if (fix) {
                const ground = walkGround(fix.x, fix.z, fix.kind);
                take(id, look, "pavement", ox + fix.x, this.options.walkHeight?.(fix.x, fix.z, ground) ?? ground, oz + fix.z, fix.yaw, fix.paused ? "stand" : "walk", phase).light = lampLit;
                return true;
            }
        }
        if (mode >= 0.4 && this.sites.seats.length) {
            let k = Math.floor(humanUnit(`${id}#${key}#${slot}#seat`) * this.sites.seats.length);
            for (let tries = 0; tries < this.sites.seats.length && this.claimedSeats.has(k); tries++) k = (k + 1) % this.sites.seats.length;
            if (!this.claimedSeats.has(k)) {
                this.claimedSeats.add(k);
                const seat = this.sites.seats[k];
                take(id, look, "bench", ox + seat.x, sitRootY(seat.y, scale), oz + seat.z, seat.yaw, "sit", phase).light = lampLit;
                return true;
            }
        }
        // At their own door on the pavement, turned a little to the street (a breath of air, a call, a look at the night).
        const door = this.walks?.door(id);
        if (!door) return false;
        const ground = walkGround(door.x, door.z, "pavement");
        const yaw = humanUnit(`${id}#doorway`) * Math.PI * 2 + Math.sin(epochMs / 40_000 + phase) * 0.4;
        take(id, look, "pavement", ox + door.x, this.options.walkHeight?.(door.x, door.z, ground) ?? ground, oz + door.z, yaw, "stand", phase).light = lampLit;
        return true;
    }

    /** Everyone drawn at `epochMs` (the shared clock); `cars`: the town's moving cars now (null: none drawn). */
    frame(epochMs: number, cars: readonly CarFix[] | null, carCount: number): DrawnHuman[] {
        const out = this.out;
        out.length = 0;
        this.tvs.length = 0;
        this.placed.clear();
        this.dogs.length = 0;
        this.beach.length = 0;
        this.covers.length = 0;
        this.sleepCount = 0;
        if (!this.roster.length) return out;
        const clock = townClockAt(epochMs, this.options.offsetHours ?? 0);
        const block = Math.floor(clock.hours / BLOCK_HOURS);
        const seconds = epochMs / 1000;
        const ox = this.options.origin.x;
        const oz = this.options.origin.z;
        const days = new Map<string, HumanDay>();
        const key = `${clock.day}#${block}`;
        for (const id of this.roster) days.set(id, this.options.away?.(id, epochMs) ? "work" : humanDay(id, clock));
        if (key !== this.blockKey) {
            this.blockKey = key;
            this.assigned = assignOut(this.roster.filter((id) => days.get(id) === "out"), clock, this.sites, carCount);
        }
        const rooms = this.rooms?.rooms() ?? [];
        // Indoors the room's lamp is on once it is dark out (the scene's sun and street lamps do not reach inside).
        const lamp = Math.min(1, darkness(clock.hours) * 1.4);
        // Humans visible: out after dark, a walker or a sitter is seen by the street lamps (their figure a little lit).
        const lampLit = darkness(clock.hours) * 0.45;
        let n = 0;
        const take = (id: string, look: HumanLook, what: DrawnHuman["what"], x: number, y: number, z: number, yaw: number, pose: HumanPoseKind, phase: number) => {
            const h = this.pool[n] ?? (this.pool[n] = {id, look, what, x, y, z, yaw, pose, phase});
            h.id = id;
            h.look = look;
            h.what = what;
            h.x = x;
            h.y = y;
            h.z = z;
            h.yaw = yaw;
            h.pose = pose;
            h.phase = phase;
            h.scale = 1;
            h.lean = what === "car" ? -driverLean(look) : 0;
            // (Humans visible: indoors by day the daylight through the open front, under the room's ceiling; a sleeper by the
            // bedside lamp's low light, `render/pet-homes.ts`, so they are seen at night.)
            h.light = what === "home" ? Math.max(lamp, 0.3) : what === "sleep" ? Math.max(lamp * 0.45, 0.2) : 0;
            h.tilt = 0;
            h.face = undefined;
            n++;
            out.push(h);
            this.placed.set(id, h);
            return h;
        };
        const tvOn = (room: HumanRoom) => {
            if (!room.tv || this.tvs.some((t) => t.room === room.id)) return;
            const t = this.tvPool[this.tvs.length] ?? (this.tvPool[this.tvs.length] = {room: "", x: 0, y: 0, z: 0, yaw: 0});
            t.room = room.id;
            t.x = ox + room.tv.x;
            t.y = room.tv.y;
            t.z = oz + room.tv.z;
            t.yaw = room.tv.yaw;
            this.tvs.push(t);
        };
        // p5 (humans, dogs): the dog walks first (a dog's walk is not put off for a date): the walker on the pavement,
        // each dog on the lead at heel beside them (`dogs`: the scene moves the record's own dog there).
        const walking = new Set<string>();
        if (this.dogWalks && this.walks) {
            for (const id of this.roster) {
                // (Humans visible: a late shift's dog is not walked while they work, nor in the morning while they sleep.)
                const r = rhythm(id);
                if (!this.dogWalks.dogsOf(id).length || days.get(id) === "sleep" || (r.kind === "late" && days.get(id) === "work") || this.options.away?.(id, epochMs)) continue;
                const fix = this.dogWalks.at(id, clock.hours, clock.day, r.kind === "late" ? 9.3 : r.wake);
                if (!fix) continue;
                const look = this.looks.get(id)!;
                const ground = walkGround(fix.x, fix.z, fix.kind);
                const y = this.options.walkHeight?.(fix.x, fix.z, ground) ?? ground;
                take(id, look, "dogwalk", ox + fix.x, y, oz + fix.z, fix.yaw, fix.paused ? "stand" : "walk", humanUnit(`${id}#phase`) * 100);
                walking.add(id);
                const size = look.height / BASE_HEIGHT;
                for (const {dog, side} of this.dogWalks.onLead) {
                    const at = heelPose(fix, side, this.heel);
                    const d = this.dogPool[this.dogs.length] ?? (this.dogPool[this.dogs.length] = {id: "", walker: "", length: 0, x: 0, y: 0, z: 0, yaw: 0, sniffing: false, speed: 0, hand: {x: 0, y: 0, z: 0}});
                    d.id = dog.id;
                    d.walker = id;
                    d.length = dog.length;
                    d.x = ox + at.x;
                    d.y = y;
                    d.z = oz + at.z;
                    d.yaw = at.yaw;
                    d.sniffing = at.sniffing;
                    d.speed = at.speed;
                    // The hand on the dog's side, at the hip's height.
                    const s = side % 2 ? -1 : 1;
                    d.hand.x = ox + fix.x + Math.cos(fix.yaw) * 0.25 * s * size;
                    d.hand.y = y + 0.84 * size;
                    d.hand.z = oz + fix.z - Math.sin(fix.yaw) * 0.25 * s * size;
                    this.dogs.push(d);
                }
            }
        }
        // p5 (humans, couples): what each couple does together now (`couples.ts` togetherNow), when both are free of
        // sleep and work: a walk side by side, a bench shared, dinner at one's table, the sofa at home. Those two are
        // drawn here and skipped below; a bench seat or a table they take is not also another's.
        const together = new Set<string>();
        const dinnerRooms = new Set<number>();
        this.claimedSeats.clear();
        for (const bond of this.bonds) {
            const da = days.get(bond.a);
            const db = days.get(bond.b);
            if (!da || !db || da === "sleep" || db === "sleep" || da === "work" || db === "work" || walking.has(bond.a) || walking.has(bond.b)) continue;
            const now: Together | null = togetherNow(bond, clock);
            if (!now) continue;
            const la = this.looks.get(bond.a)!;
            const lb = this.looks.get(bond.b)!;
            const pa = humanUnit(`${bond.a}#phase`) * 100;
            const pb = humanUnit(`${bond.b}#phase`) * 100;
            if (now.kind === "walk" && this.sites.walks.length) {
                // Side by side along a walk, there and back over the date (the same pace: the slower one's).
                const [a, b] = this.sites.walks[Math.min(Math.floor(now.pick * this.sites.walks.length), this.sites.walks.length - 1)];
                const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
                const t = ((seconds * 0.95) / length + now.pick) % 2;
                const back = t > 1;
                const f = back ? 2 - t : t;
                const ux = (b.x - a.x) / length, uz = (b.z - a.z) / length;
                const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f;
                const yaw = Math.atan2(ux * (back ? -1 : 1), uz * (back ? -1 : 1));
                // (0.32 m either side of the line: shoulder to shoulder, hands nearly touching.)
                take(bond.a, la, "walk", ox + x - uz * 0.32, townHeight(x - uz * 0.32, z + ux * 0.32), oz + z + ux * 0.32, yaw, "walk", pa);
                take(bond.b, lb, "walk", ox + x + uz * 0.32, townHeight(x + uz * 0.32, z - ux * 0.32), oz + z - ux * 0.32, yaw, "walk", pa + 0.5);
            } else if (now.kind === "bench") {
                // The two seats of one bench (by the pair and the day), whoever else the block had sent there.
                const benches = Array.from(new Set(this.sites.seats.map((s) => s.bench))).filter((id) => this.sites.seats.filter((s) => s.bench === id).length >= 2);
                if (!benches.length) continue;
                const bench = benches[Math.min(Math.floor(now.pick * benches.length), benches.length - 1)];
                const seats = this.sites.seats.map((s, i) => ({s, i})).filter((e) => e.s.bench === bench).slice(0, 2);
                seats.forEach((e) => this.claimedSeats.add(e.i));
                take(bond.a, la, "bench", ox + seats[0].s.x, sitRootY(seats[0].s.y, la.height / BASE_HEIGHT), oz + seats[0].s.z, seats[0].s.yaw, "sit", pa);
                take(bond.b, lb, "bench", ox + seats[1].s.x, sitRootY(seats[1].s.y, lb.height / BASE_HEIGHT), oz + seats[1].s.z, seats[1].s.yaw, "sit", pb);
            } else if (now.kind === "dinner" || now.kind === "sofa") {
                const home = this.homes.get(now.home);
                const room = home ? rooms[home.room] : undefined;
                if (!home || !room) continue;
                const spots = now.kind === "dinner" ? (room.chairs.length >= 2 ? room.chairs : room.seats) : room.seats;
                if (spots.length < 2) continue;
                if (now.kind === "dinner") dinnerRooms.add(home.room);
                else tvOn(room);
                take(bond.a, la, "home", ox + spots[0].x, sitRootY(spots[0].y, la.height / BASE_HEIGHT), oz + spots[0].z, spots[0].yaw, "sit", pa).face = room.front;
                take(bond.b, lb, "home", ox + spots[1].x, sitRootY(spots[1].y, lb.height / BASE_HEIGHT), oz + spots[1].z, spots[1].yaw, "sit", pb).face = room.front;
            } else continue;
            together.add(bond.a);
            together.add(bond.b);
        }
        // Humans visible: the night's few out (`nightRota`): by their own door under the lamps, on a lamp-lit bench, or a
        // walk round the block; lit a little by the street lamps.
        const busy = new Set<string>(Array.from(together).concat(Array.from(walking)));
        const rota = new Set(nightRota(this.roster, clock, (id) => (this.options.away?.(id, epochMs) ? "work" : days.get(id)), busy));
        this.nightNow = clock.hours >= 18 || clock.hours < 7;
        for (const id of this.roster) {
            if (together.has(id) || walking.has(id)) continue; // p5 (humans, couples), p5 (humans, dogs)
            if (rota.has(id) && this.stepOut(id, clock, take, lampLit, epochMs)) continue;
            const look = this.looks.get(id)!;
            const scale = look.height / BASE_HEIGHT;
            const day = days.get(id)!;
            const phase = humanUnit(`${id}#phase`) * 100;
            // p5 (humans, pavements): on foot along the pavements (to work and home again, an evening stroll, errands in
            // place of "about": `pavements.ts`), instead of the day's own place while the walk lasts.
            const about = day === "out" && this.assigned.get(id)?.kind === "about";
            // Humans visible: the night's people out (an owl's last walk or sit on a lamp-lit bench, a late shift's way
            // to work and home), lit a little by the street lamps.
            if (day !== "sleep" && !this.options.away?.(id, epochMs)) {
                const night = nightOuting(id, clock);
                if (night) {
                    if (night.bench && this.sites.seats.length) {
                        let k = Math.floor(humanUnit(`${id}#${night.key}#owl#seat`) * this.sites.seats.length);
                        for (let tries = 0; tries < this.sites.seats.length && this.claimedSeats.has(k); tries++) k = (k + 1) % this.sites.seats.length;
                        if (!this.claimedSeats.has(k)) {
                            this.claimedSeats.add(k);
                            const seat = this.sites.seats[k];
                            take(id, look, "bench", ox + seat.x, sitRootY(seat.y, scale), oz + seat.z, seat.yaw, "sit", phase).light = lampLit;
                            continue;
                        }
                    }
                    const fix = this.walks?.night(id, night.kind, night.key, night.at, night.hours);
                    if (fix) {
                        const ground = walkGround(fix.x, fix.z, fix.kind);
                        take(id, look, "pavement", ox + fix.x, this.options.walkHeight?.(fix.x, fix.z, ground) ?? ground, oz + fix.z, fix.yaw, fix.paused ? "stand" : "walk", phase).light = lampLit;
                        continue;
                    }
                }
            }
            if (this.walks && day !== "sleep" && (day !== "out" || about) && !this.options.away?.(id, epochMs)) {
                const fix = this.walks.at(id, clock.hours, clock.day, weekday(clock), day, about, rhythm(id));
                if (fix) {
                    const ground = walkGround(fix.x, fix.z, fix.kind);
                    take(id, look, "pavement", ox + fix.x, this.options.walkHeight?.(fix.x, fix.z, ground) ?? ground, oz + fix.z, fix.yaw, fix.paused ? "stand" : "walk", phase).light = lampLit;
                    continue;
                }
            }
            if (day === "sleep" || day === "home") {
                const home = this.homes.get(id);
                const room = home ? rooms[home.room] : undefined;
                if (!room) continue;
                if (day === "sleep") {
                    const bed = room.beds[home!.slot % Math.max(room.beds.length, 1)];
                    if (bed) {
                        const root = sleeperRoot(bed, look);
                        const sleeper = take(id, look, "sleep", ox + root.x, root.y, oz + root.z, bed.yaw, "sleep", phase);
                        sleeper.face = room.front;
                        sleeper.scale = root.scale;
                        const cover = this.cover(ox + root.x, oz + root.z, bed.yaw, look.height * root.scale, bed.y, room.duvet);
                        const k = this.sleepCount++;
                        const entry = this.sleepList[k] ?? (this.sleepList[k] = {room: 0, h: sleeper, cover, look});
                        entry.room = home!.room;
                        entry.h = sleeper;
                        entry.cover = cover;
                        entry.look = look;
                    }
                    continue;
                }
                // Dinner at the table, else the evening on the sofa in front of the TV (or at the table).
                const dinner = clock.hours >= 18.5 && clock.hours < 19.5;
                const tv = !dinner && room.tv && room.seats.length && humanUnit(`${id}#${clock.day}#tv`) < 0.7;
                // (p5 (humans, couples): a couple's dinner has this room's table: its other resident keeps to the sofa.)
                const chair = dinnerRooms.has(home!.room) ? undefined : room.chairs[home!.slot % Math.max(room.chairs.length, 1)];
                const seat = tv ? room.seats[home!.slot % room.seats.length] : chair ?? room.seats[home!.slot % Math.max(room.seats.length, 1)];
                if (seat) take(id, look, "home", ox + seat.x, sitRootY(seat.y, scale), oz + seat.z, seat.yaw, "sit", phase).face = room.front;
                if (seat && tv) tvOn(room);
                continue;
            }
            if (day === "work") continue;
            const what = this.assigned.get(id);
            if (!what) continue;
            switch (what.kind) {
                case "bench": {
                    if (this.claimedSeats.has(what.seat)) break; // p5 (humans, couples): a couple has this bench
                    const seat = this.sites.seats[what.seat];
                    take(id, look, "bench", ox + seat.x, sitRootY(seat.y, scale), oz + seat.z, seat.yaw, "sit", phase);
                    break;
                }
                case "sun": {
                    const p = this.sites.beach[what.spot];
                    // Quality pass: on a towel, facing the sea (the beach faces +z here), each a little their own way: on
                    // the back with the hands behind the head, on a side, or sitting up reading; a parasol for about half.
                    const yaw = (humanUnit(`${id}#towel`) - 0.5) * 0.6;
                    const ground = townHeight(p.x, p.z);
                    const u = humanUnit(`${id}#${clock.day}#${block}#lie`);
                    const pose: HumanPoseKind = u < 0.42 ? "sunback" : u < 0.66 ? "sunside" : "sunsit";
                    const swim = this.beachLook(id, look);
                    take(id, swim, "sun", ox + p.x, ground, oz + p.z, yaw, pose, phase);
                    const fx = Math.sin(yaw), fz = Math.cos(yaw);
                    // (Laid along the sand's slope: the head's end as high as the sand under it.)
                    const reach = 1.5 * scale;
                    const tilt = Math.atan2(townHeight(p.x - fx * reach, p.z - fz * reach) - ground, reach);
                    if (pose !== "sunsit") out[n - 1].tilt = tilt;
                    // The towel under the whole body: from the head to the feet lying, from behind the hips to the heels sitting.
                    const mid = pose === "sunsit" ? 0.3 * scale : -0.85 * scale;
                    const colour = BEACH_CLOTH[Math.floor(humanUnit(`${id}#cloth`) * BEACH_CLOTH.length)];
                    const tx = p.x + fx * mid, tz = p.z + fz * mid;
                    this.prop("towel", ox + tx, townHeight(tx, tz) + 0.012, oz + tz, yaw, pose === "sunsit" ? 0 : tilt, colour);
                    if (humanUnit(`${id}#parasol`) < 0.55) {
                        // Beside the head's end, leaning a little toward the midday sun (south: −z here is inland, so the canopy leans seaward).
                        const side = humanUnit(`${id}#side`) < 0.5 ? -1 : 1;
                        const back = pose === "sunsit" ? -0.35 : -1.3 * scale;
                        const px = p.x + fx * back + fz * 0.85 * side, pz = p.z + fz * back - fx * 0.85 * side;
                        this.prop("parasol", ox + px, townHeight(px, pz), oz + pz, yaw, 0.12, BEACH_CLOTH[Math.floor(humanUnit(`${id}#parasolcloth`) * BEACH_CLOTH.length)]);
                    }
                    break;
                }
                case "paddle": {
                    // Quality pass: standing in the shallows looking out to sea, wandering a little along the shore; a step
                    // further in or out as the tide comes and goes (never deeper than the knees).
                    const p = this.sites.shallows[what.spot];
                    const sea = this.options.seaLevel?.() ?? 0;
                    const x = p.x + Math.sin(seconds * 0.021 + phase) * 2.5;
                    let z = p.z;
                    for (let k = 0; k < 24 && sea - townHeight(x, z) > 0.45 * scale; k++) z -= 1;
                    for (let k = 0; k < 24 && sea - townHeight(x, z) < 0.12; k++) z += 1;
                    take(id, this.beachLook(id, look), "paddle", ox + x, townHeight(x, z), oz + z, (humanUnit(`${id}#wadeyaw`) - 0.5) * 1.2, "paddle", phase);
                    break;
                }
                case "walk": {
                    const [a, b] = this.sites.walks[what.walk];
                    const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
                    const pace = WALK_PACE * (0.92 + 0.16 * humanUnit(`${id}#pace`));
                    const t = ((seconds * pace) / length + what.offset) % 2;
                    const back = t > 1;
                    const f = back ? 2 - t : t;
                    const x = a.x + (b.x - a.x) * f;
                    const z = a.z + (b.z - a.z) * f;
                    const yaw = Math.atan2((b.x - a.x) * (back ? -1 : 1), (b.z - a.z) * (back ? -1 : 1));
                    take(id, look, "walk", ox + x, townHeight(x, z), oz + z, yaw, "walk", phase);
                    break;
                }
                case "car": {
                    const car = cars?.[what.car];
                    if (!car || !car.active) break;
                    const road = this.options.roadHeight?.(car.x, car.z) ?? townHeight(car.x, car.z);
                    const p = carSeat(car, what.seat, road, scale);
                    take(id, look, "car", ox + p.x, p.y, oz + p.z, p.yaw, what.seat === 0 ? "drive" : "sit", phase);
                    break;
                }
                case "boat": {
                    const route = BOAT_ROUTES.filter((r) => r.kind === "speedboat")[what.boat];
                    if (!route) break;
                    const fix = boatFix(route, this.options.boatSeconds?.() ?? seconds);
                    const p = helmSeat(fix, Math.min(fix.speed / route.speed, 1), this.options.seaLevel?.() ?? 0, scale);
                    take(id, look, "boat", p.x, p.y, p.z, p.yaw, "drive", phase);
                    break;
                }
                default:
                    break;
            }
        }
        // Humans polish: one asleep alone in a bed lies in its middle (living alone, or their partner up or out), two each on their side.
        this.sleepTally.clear();
        for (let k = 0; k < this.sleepCount; k++) this.sleepTally.set(this.sleepList[k].room, (this.sleepTally.get(this.sleepList[k].room) ?? 0) + 1);
        for (let k = 0; k < this.sleepCount; k++) {
            const e = this.sleepList[k];
            const beds = rooms[e.room]?.beds;
            if (this.sleepTally.get(e.room) !== 1 || !beds || beds.length < 2) continue;
            const mid = midpoint(beds[0], beds[1]);
            const root = sleeperRoot(mid, e.look);
            e.h.x = ox + root.x;
            e.h.z = oz + root.z;
            e.cover.x = ox + root.x + Math.sin(mid.yaw) * COVER_PAST_FEET;
            e.cover.z = oz + root.z + Math.cos(mid.yaw) * COVER_PAST_FEET;
        }
        // p5 (humans, couples): the young, each with one of its parents wherever that parent is drawn (turn and turn
        // about, `parentNow`): a babe in arms at the parent's chest, an older child beside them doing as they do.
        // Not in a car or a boat (the child is then with nobody drawn: at home with the other, unseen).
        this.beside.clear();
        this.inArms.clear();
        for (const id of this.young) {
            const child = this.children.get(id);
            const born = this.born.get(id);
            if (!child || born === undefined) continue;
            const parent = this.placed.get(parentNow(child, clock)) ?? this.placed.get(child.parents[0]) ?? this.placed.get(child.parents[1]);
            // (Humans polish: not in a bed beside a sleeping parent: the beds are two sleepers wide, and one lies in the middle.)
            if (!parent || parent.what === "car" || parent.what === "boat" || parent.what === "sleep") continue;
            const look = this.looks.get(id)!;
            const age = Math.max(this.arkDay - born, 0);
            const size = childScale(Number.isFinite(age) ? age : 0);
            const fx = Math.sin(parent.yaw), fz = Math.cos(parent.yaw);
            const phase = humanUnit(`${id}#phase`) * 100;
            const lying = parent.pose === "lie" || parent.pose === "sleep" || parent.pose === "sunback" || parent.pose === "sunside" || parent.pose === "sunsit";
            // (Brothers and sisters with the same parent: one each side, the next a step further out; one babe in arms.)
            const nth = this.beside.get(parent.id) ?? 0;
            const babe = carried(age) && !lying && !this.inArms.has(parent.id);
            if (babe) this.inArms.add(parent.id);
            else this.beside.set(parent.id, nth + 1);
            const side = (nth % 2 ? -1 : 1) * (1 + Math.floor(nth / 2));
            let h: DrawnHuman;
            if (lying) {
                h = take(id, look, parent.what, parent.x + fz * 0.55 * side, parent.y, parent.z - fx * 0.55 * side, parent.yaw, parent.pose, phase);
            } else if (babe) {
                const up = (parent.pose === "sit" ? 1.02 : 1.08) * (parent.look.height / BASE_HEIGHT);
                h = take(id, look, parent.what, parent.x + fx * 0.2, parent.y + up, parent.z + fz * 0.2, parent.yaw + Math.PI, "sit", phase);
            } else {
                const x = parent.x + fz * 0.45 * side, z = parent.z - fx * 0.45 * side;
                // (Its feet on the ground its parent's are on: a sitter's root is below the seat by their own leg.)
                const floor = parent.pose === "sit" ? parent.y + 0.86 * (parent.look.height / BASE_HEIGHT) - 0.45 : parent.y;
                h = take(id, look, parent.what, x, floor, z, parent.yaw, parent.pose === "walk" ? "walk" : "stand", phase);
            }
            h.scale = size;
            h.light = parent.light;
        }
        return out;
    }
}

export {townClockAt};
