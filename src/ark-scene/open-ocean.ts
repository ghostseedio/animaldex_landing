/**
 * The open ocean as a habitat (graphics pass 2, lane OCEAN; the owner, 2026-11-16: "would be good to see some speedboats
 * or activity in the big ocean too and should be able to go into the ocean also as that's where wild whales should spawn
 * and other ocean life").
 *
 * Which animals: the record decides. A wild animal (the wild island's, never a zoo's, a home's or the aquarium's) whose
 * stored zone is `open_ocean` and whose depth row (`sea-depth.ts`, from its stored text or taxonomy) makes it a swimmer
 * of the open water (not a floater, not a floor-walker, not a hole-dweller), and that is big enough to be seen out
 * there (1 m and longer: a sperm whale, a manta, a bull shark, a tuna; the anchovies and pilchards keep schooling off the
 * island, where they are seen). Nothing is invented: no animal is added, none is moved that the record did not zone.
 *
 * Where: the scene only decides where in the ocean, by rule. Each such animal cruises a loop of open water between and
 * around the two islands (`OCEAN_LOOPS`, every point of each over 25 m of water and 30 m from any land: the tests check
 * the whole loop with its wander), its loop from its species (a pod keeps together), its place along it from its
 * species, its rank (`slot_rank`) and the shared clock. Pure in (id, record, clock): every viewer sees the same whale
 * in the same water at the same moment. Its depth in the column, its breath (a cetacean up to blow) and its pitch are
 * the sea's own (`sea-depth.ts` waterSpec, breathAt), in a working column of `OCEAN_COLUMN` m: the band's share of the
 * column (an upper-water swimmer 12–32% down), so it swims 2–6 m under, not 13–35 m under 110 m of water, where no
 * one would ever see it.
 *
 * Islands mode only (the v2 world with the town across the strait): one island alone keeps today's placement.
 *
 * Pure: no three.js.
 */

import {hashString} from "@/ark-scene/world";
import {waterMotion, type SpeciesDepth} from "@/ark-scene/sea-depth";

/** A loop of open water: an ellipse about (x, z), `rx` along its own axis turned `turn` (radians, from +x toward +z), `rz` across it. */
export type OceanLoop = {id: string; x: number; z: number; rx: number; rz: number; turn: number};

/**
 * The loops, in the world frame of the islands mode (the wild island at the origin, the town across the strait at
 * `townWorldOrigin()` = (601.2, −249)). Found by a search over the composed sea floor (the wild island's ground, the
 * town's inside its square) and checked by `ark-open-ocean.test.ts`: under every point of each (with its wander) the
 * floor is 25 m down or more, and no land within 30 m.
 */
export const OCEAN_LOOPS: readonly OceanLoop[] = [
    // The strait between the islands, north to south across it.
    {id: "strait", x: 281, z: -140, rx: 50, rz: 120, turn: -0.393},
    // The strait's southern mouth, between the wild island's east coast and the open sea.
    {id: "strait_south", x: 360, z: 120, rx: 80, rz: 50, turn: 0},
    // The strait's northern mouth, west of the town. (p4 (safari): 20 m south-west and a little smaller, clear of the
    // safari park's land, `islands/town/safari.ts`; it was (290, −380), 60 × 50.) p5 (zoospace): 55 m west, clear of the
    // aviary dome's new land (`islands/town/dome.ts` DOME_LOBE, the town's west shore now near x 314); it was (270, −360).
    {id: "strait_north", x: 215, z: -360, rx: 55, rz: 45, turn: 0},
    // Off the wild island's west coast.
    {id: "west", x: -350, z: 0, rx: 50, rz: 125, turn: 0},
    // Off its south coast (the opening view's foreground sea).
    {id: "south", x: 0, z: 345, rx: 150, rz: 40, turn: 0},
    // Off its north coast.
    {id: "north", x: -30, z: -345, rx: 140, rz: 45, turn: 0}
];

/** The order species are dealt to loops: the strait twice (the water between the islands is where they are looked for). */
const LOOP_DEAL: readonly number[] = [0, 0, 1, 2, 3, 4, 5];

/** A loop's wander: its radius swells and narrows by this share, three times round. */
export const OCEAN_WANDER = 0.12;
/** The working column (m): a swimmer's band is taken as its share of this much water, however deep the floor. */
export const OCEAN_COLUMN = 18;
/** The shortest animal (true length, m) that goes out to the open ocean. */
export const OCEAN_MIN_LENGTH = 1;
/**
 * How much further than the islands' own reach the camera's view may go out over the sea (m): every loop lies inside
 * (the test checks), so a whale chosen out there is never pulled back toward an island under the camera.
 */
export const OCEAN_VIEW_MARGIN = 200;

/** What the rule reads of an animal (the snapshot's record). */
export type OceanAnimal = {id: string; model_slug: string; zone: string; island?: string | null; area?: string | null; enclosure?: string | null; slot_rank?: number | null};

/**
 * Does this animal live in the open ocean: wild, zoned `open_ocean` in its record, a swimmer of salt water by its depth
 * row, `trueLength` m or longer (`OCEAN_MIN_LENGTH`)?
 */
export function roamsOpenOcean(animal: OceanAnimal, depth: SpeciesDepth | null, trueLength: number): boolean {
    if (animal.zone !== "open_ocean" || !depth) return false;
    // (Kept animals never: a zoo's, a home's, the town's aquarium's.)
    if (animal.island === "town" || animal.area === "zoo" || animal.area === "house" || animal.area === "farm" || animal.enclosure) return false;
    if (depth.water !== "salt" || waterMotion(depth) !== "swim") return false;
    return trueLength >= OCEAN_MIN_LENGTH;
}

const unit = (key: string): number => (hashString(key) % 100000) / 100000;

/** A species' loop (its pod keeps together on it). */
export function oceanLoopOf(slug: string): OceanLoop {
    return OCEAN_LOOPS[LOOP_DEAL[Math.floor(unit(`ocean-loop#${slug}`) * LOOP_DEAL.length) % LOOP_DEAL.length]];
}

/** A cruising swimmer's speed (m/s) for its drawn length: a whale's steady 1.6 m/s, a 1 m fish's 0.7. */
export function oceanCruise(length: number): number {
    return Math.min(Math.max(0.55 + 0.07 * length, 0.7), 1.6);
}

/** A point of a loop at angle `a` (radians) with its wander, in the world frame. */
export function loopPoint(loop: OceanLoop, a: number, wanderPhase: number, wander = OCEAN_WANDER): {x: number; z: number} {
    const f = 1 + wander * Math.sin(3 * a + wanderPhase);
    const lx = Math.cos(a) * loop.rx * f;
    const lz = Math.sin(a) * loop.rz * f;
    const c = Math.cos(loop.turn);
    const s = Math.sin(loop.turn);
    return {x: loop.x + lx * c - lz * s, z: loop.z + lx * s + lz * c};
}

/** A loop's arc-length table (with its wander): the angle at each of `TABLE` equal steps of distance round it. */
type LoopTable = {length: number; angles: Float64Array};
const TABLE = 256;
const tables = new Map<string, LoopTable>();

function loopTable(loop: OceanLoop, wanderPhase: number, wander: number): LoopTable {
    const key = `${loop.id}|${loop.x}|${loop.z}|${loop.rx}|${loop.rz}|${loop.turn}|${wanderPhase.toFixed(4)}|${wander}`;
    const known = tables.get(key);
    if (known) return known;
    // (The distance round at 1024 equal steps of angle, then the angle at each equal step of distance.)
    const steps = 1024;
    const cumulative = new Float64Array(steps + 1);
    let prev = loopPoint(loop, 0, wanderPhase, wander);
    for (let i = 1; i <= steps; i++) {
        const p = loopPoint(loop, (i / steps) * Math.PI * 2, wanderPhase, wander);
        cumulative[i] = cumulative[i - 1] + Math.hypot(p.x - prev.x, p.z - prev.z);
        prev = p;
    }
    const length = cumulative[steps];
    const angles = new Float64Array(TABLE + 1);
    let j = 0;
    for (let k = 0; k <= TABLE; k++) {
        const want = (k / TABLE) * length;
        while (j < steps - 1 && cumulative[j + 1] < want) j++;
        const span = cumulative[j + 1] - cumulative[j] || 1;
        angles[k] = ((j + (want - cumulative[j]) / span) / steps) * Math.PI * 2;
    }
    const table = {length, angles};
    if (tables.size > 64) tables.clear();
    tables.set(key, table);
    return table;
}

/** A loop's length round (m), with its wander. */
export function loopLength(loop: OceanLoop, wanderPhase = 0, wander = OCEAN_WANDER): number {
    return loopTable(loop, wanderPhase, wander).length;
}

/**
 * The point `u` (0…1) of the way round a loop by distance (so a boat or an animal at a steady speed goes round at a
 * steady speed, never faster round an ellipse's ends), and its heading going round in `direction`.
 */
export function loopAt(loop: OceanLoop, u: number, direction: 1 | -1, wanderPhase: number, wander = OCEAN_WANDER): {x: number; z: number; yaw: number} {
    const {angles} = loopTable(loop, wanderPhase, wander);
    const w = ((((direction > 0 ? u : 1 - u) % 1) + 1) % 1) * TABLE;
    const k = Math.min(Math.floor(w), TABLE - 1);
    const a = angles[k] + (angles[k + 1] - angles[k]) * (w - k);
    const here = loopPoint(loop, a, wanderPhase, wander);
    const ahead = loopPoint(loop, a + direction * 0.004, wanderPhase, wander);
    return {x: here.x, z: here.z, yaw: Math.atan2(ahead.x - here.x, ahead.z - here.z)};
}

export type OceanFix = {x: number; z: number; yaw: number; speed: number; loop: string};

/**
 * Where an open-ocean animal is at `seconds` (the shared clock, epoch seconds): its species' loop, its pod's place on it
 * (from the species), its own a little behind and beside by its rank, swimming at its cruise. `yaw`: its heading
 * (forward is (sin yaw, cos yaw), as every model's). Pure.
 */
export function oceanFix(animal: Pick<OceanAnimal, "id" | "model_slug" | "slot_rank">, length: number, seconds: number): OceanFix {
    const slug = animal.model_slug;
    const loop = oceanLoopOf(slug);
    const speed = oceanCruise(length);
    const direction = unit(`ocean-dir#${slug}`) < 0.5 ? 1 : -1;
    const wanderPhase = unit(`ocean-wander#${slug}`) * Math.PI * 2;
    const round = loopLength(loop, wanderPhase);
    const lap = round / speed;
    // (The pod's leader at its species' phase; each other one about two lengths back per rank, alternating sides.)
    const rank = Math.max(0, Math.floor(animal.slot_rank ?? 0));
    const back = (rank * length * 2.2) / round;
    const {x, z, yaw} = loopAt(loop, seconds / lap + unit(`ocean-phase#${slug}`) - back, direction, wanderPhase);
    // (Beside the leader's line: a rank's side, about a length out and 8 m at most, inside the loop's checked margin.)
    const side = rank === 0 ? 0 : (rank % 2 ? 1 : -1) * Math.min(length * (0.8 + 0.4 * unit(`ocean-side#${animal.id}`)), 8);
    return {x: x + Math.cos(yaw) * side, z: z - Math.sin(yaw) * side, yaw, speed, loop: loop.id};
}
