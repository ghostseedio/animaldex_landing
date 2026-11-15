/**
 * Ant trails (owner, 2026-11-15: "ants should move in trails"). Visual only: nothing here changes the Ark's
 * ecology, the server's places or any read. Pure in the colony's nest, its ids and the world time, so every viewer
 * (and one who arrives late) sees the same ants on the same trail at the same moment.
 *
 * A colony is the ants of one kind the server put in one slot of a zone (its cluster: `slot`, members by `slot_rank`).
 * They share the slot's attach point (`map/place.ts`), a hole in the ground for most: that is the nest.
 *
 * - A trail-laying kind (most ants: weaver, big-headed, carpenter, ghost, fire ants) keeps one trail from the nest to a
 *   food source, seeded from the colony: on the ground, 1.5–4.5 m of gently curving path over walkable ground; on a
 *   branch or bark (an arboreal nest), along its surface. Its foragers go out in single file, each a few body lengths
 *   behind the one before (rank order), linger at the food, and come back down the other side of the same trail,
 *   some of them loaded (a seed or a bit of insect, by kind: honeydew foragers come back with nothing to see).
 * - A solitary forager (the Sahara desert ant, Cataglyphis: it lays no trail) leaves alone on a winding search that
 *   differs every trip, finds a dead insect at its end and runs straight home (its path integration).
 *
 * A trip (a colony's cycle) runs only if the colony is up for the whole of it (its kind's activity, the island clock), so
 * no ant is ever snapped home or walked asleep. Between trips, and asleep, each is at its own spot by the nest entrance.
 */

import type {AttachPoint} from "@/ark-scene/map/sampler";
import type {SurfacePoint} from "@/ark-scene/micro";
import {hashString, seeded} from "@/ark-scene/world";

export type AntForaging = "trail" | "solo";

/**
 * Trail-laying or solitary, its walking speed (m/s, a typical forager's at foraging temperature) and what a loaded
 * forager is seen carrying (with the share of trips that come back with it).
 *
 * Speeds are approximate figures from the field and lab literature: Oecophylla ~4 cm/s, Camponotus / Polyrhachis
 * ~3–5 cm/s, Pheidole ~2 cm/s, Tapinoma ~3 cm/s, Solenopsis invicta ~1.5 cm/s at 25 °C (Porter & Tschinkel 1993),
 * Cataglyphis ~0.2–0.5 m/s on hot sand (Wehner; Wahl et al. 2015). Trail use: Hölldobler & Wilson, The Ants (1990);
 * Cataglyphis forages alone, without pheromone trails, scavenging dead arthropods and returning by path integration
 * (Wehner 2003). The carry shares are a judgement from each kind's diet (honeydew is carried in the crop).
 */
export type AntSpec = {foraging: AntForaging; speed: number; carry: "insect" | "seed" | null; carryShare: number};

const ANTS: Record<string, AntSpec> = {
    "asian-weaver-ant": {foraging: "trail", speed: 0.04, carry: "insect", carryShare: 0.45},
    "big-headed-ant": {foraging: "trail", speed: 0.02, carry: "seed", carryShare: 0.55},
    "carpenter-ant": {foraging: "trail", speed: 0.04, carry: "insect", carryShare: 0.3},
    "silky-carpenter-ant": {foraging: "trail", speed: 0.035, carry: "insect", carryShare: 0.2},
    "ghost-ant": {foraging: "trail", speed: 0.03, carry: null, carryShare: 0},
    "red-imported-fire-ant": {foraging: "trail", speed: 0.015, carry: "insect", carryShare: 0.4},
    "black-ant": {foraging: "trail", speed: 0.03, carry: "insect", carryShare: 0.3},
    "red-ant": {foraging: "trail", speed: 0.02, carry: null, carryShare: 0},
    "leafcutter-ant": {foraging: "trail", speed: 0.03, carry: "seed", carryShare: 0.7},
    "red-harvester-ant": {foraging: "trail", speed: 0.03, carry: "seed", carryShare: 0.6},
    "honeypot-ant": {foraging: "trail", speed: 0.03, carry: null, carryShare: 0},
    "eciton-army-ant": {foraging: "trail", speed: 0.04, carry: "insect", carryShare: 0.5},
    "driver-ant": {foraging: "trail", speed: 0.03, carry: "insect", carryShare: 0.5},
    "sahara-desert-ant": {foraging: "solo", speed: 0.3, carry: "insect", carryShare: 1}
};

/** How an ant kind forages, or null when it is not an ant this module moves. */
export function antSpec(slug: string): AntSpec | null {
    return ANTS[slug] ?? null;
}

export function antSlugs(): string[] {
    return Object.keys(ANTS);
}

/** The ground the trail runs over: its height there, and whether an ant may walk there (not water, rock or a wall). */
export type AntGround = {heightAt: (x: number, z: number) => number; walkable: (x: number, z: number) => boolean};

type PathPoint = {x: number; y: number; z: number; s: number};

export type AntColony = {
    key: string;
    slug: string;
    spec: AntSpec;
    /** On the ground (the trail follows the terrain), or on its attach surface's plane (a branch, bark). */
    ground: boolean;
    nest: AttachPoint;
    /** The trail, nest first (null for a solitary forager: each trip has its own). */
    path: PathPoint[] | null;
    /** The trail's length (m). */
    length: number;
    /** Seconds: a trip's cycle, the time at the food, at the nest between trips, and the colony's clock offset. */
    period: number;
    atFood: number;
    offset: number;
    /** Seconds between one forager and the next in the file. */
    gap: number;
};

/** The most foragers in a file the cycle leaves room for (a cluster's size, `ARK_CLUSTER_MAX` and more). */
const FILE_ROOM = 16;
/** A ground trail's length range (m): a few metres from the nest, as a colony's trail to a nearby food source. */
const GROUND_TRAIL: [number, number] = [1.5, 4.5];
/** An arboreal trail along its branch or bark (m): the attach surface's own reach (`micro.ts` attachSurfacePoint). */
const SURFACE_TRAIL = 0.3;

const colonies = new Map<string, AntColony | null>();

/** For tests: forget the colonies worked out. */
export function forgetAntColonies(): void {
    colonies.clear();
    searches.clear();
}

/**
 * A colony's trail and clock, from its slug, its zone and slot (the server's cluster), its nest (the slot's attach
 * point) and its body length (m). Remembered per colony.
 */
export function antColony(slug: string, zone: string, slot: number, nest: AttachPoint, bodyLength: number, ground: AntGround): AntColony | null {
    const spec = antSpec(slug);
    if (!spec) return null;
    const key = `${slug}#${zone}#${slot}#${nest.id}`;
    if (colonies.has(key)) return colonies.get(key)!;
    const onGround = nest.normal[1] > 0.8 && Math.abs(nest.y - ground.heightAt(nest.x, nest.z)) < 0.15;
    const random = seeded(hashString(`ants#${key}`));
    const path = spec.foraging === "trail" ? (onGround ? groundTrail(nest, random, ground) : surfaceTrail(nest, random)) : null;
    if (spec.foraging === "trail" && !path) {
        colonies.set(key, null);
        return null;
    }
    const length = path ? path[path.length - 1].s : 0;
    const L = Math.max(bodyLength, 0.002);
    const gap = ((5 + 6 * random()) * L) / spec.speed;
    const atFood = 3 + 4 * random();
    const rest = 8 + 20 * random();
    // A solitary forager's trip: a search of ~3–5× the way home, then home (its own path each trip, `antSearch`).
    const trip = spec.foraging === "solo" ? SOLO_TRIP_SECONDS : (2 * length) / spec.speed + atFood;
    const period = Math.max(trip + rest, spec.foraging === "trail" ? trip + FILE_ROOM * gap : 0);
    const colony: AntColony = {key, slug, spec, ground: onGround, nest, path, length, period, atFood, offset: random() * period, gap};
    colonies.set(key, colony);
    return colony;
}

function terrainPoint(x: number, z: number, ground: AntGround): {x: number; y: number; z: number} {
    return {x, y: ground.heightAt(x, z), z};
}

function measure(points: Array<{x: number; y: number; z: number}>): PathPoint[] {
    const out: PathPoint[] = [];
    let s = 0;
    for (let i = 0; i < points.length; i++) {
        if (i) s += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y, points[i].z - points[i - 1].z);
        out.push({...points[i], s});
    }
    return out;
}

/** A ground trail: a gently curving, slightly meandering path from the nest to a food source, over walkable ground only. */
function groundTrail(nest: AttachPoint, random: () => number, ground: AntGround): PathPoint[] | null {
    const length = GROUND_TRAIL[0] + (GROUND_TRAIL[1] - GROUND_TRAIL[0]) * random();
    const start = random() * Math.PI * 2;
    const bend = (random() - 0.5) * 0.6;
    const wiggle = 0.03 + 0.03 * random();
    const wavePhase = random() * Math.PI * 2;
    const tries = 16;
    for (let attempt = 0; attempt < 2; attempt++) {
        const reach = attempt ? length * 0.5 : length;
        for (let k = 0; k < tries; k++) {
            const heading = start + (k * Math.PI * 2 * 7) / tries;
            const fx = Math.sin(heading);
            const fz = Math.cos(heading);
            const n = Math.max(Math.ceil(reach / 0.04), 8);
            const points: Array<{x: number; y: number; z: number}> = [];
            let ok = true;
            for (let i = 0; i <= n; i++) {
                const u = i / n;
                // A quadratic bend across the heading, and a slow meander (a trail is never a ruled line).
                const across = reach * (bend * 4 * u * (1 - u) + wiggle * Math.sin(u * Math.PI * 3 + wavePhase) * u);
                const x = nest.x + fx * reach * u + fz * across;
                const z = nest.z + fz * reach * u - fx * across;
                if (u * reach > 0.25 && !ground.walkable(x, z)) {
                    ok = false;
                    break;
                }
                points.push(terrainPoint(x, z, ground));
            }
            if (ok) return measure(points);
        }
    }
    return null;
}

/** An arboreal trail: along its branch or bark from the nest, in the attach surface's plane, a little to one side and back. */
function surfaceTrail(nest: AttachPoint, random: () => number): PathPoint[] {
    const [nx, ny, nz] = nest.normal;
    const [tx, ty, tz] = nest.tangent;
    const cx = ny * tz - nz * ty;
    const cy = nz * tx - nx * tz;
    const cz = nx * ty - ny * tx;
    const sway = (random() - 0.5) * 0.04;
    const n = 16;
    const points: Array<{x: number; y: number; z: number}> = [];
    for (let i = 0; i <= n; i++) {
        const u = (i / n) * SURFACE_TRAIL;
        const v = sway * Math.sin((i / n) * Math.PI);
        points.push({x: nest.x + tx * u + cx * v, y: nest.y + ty * u + cy * v, z: nest.z + tz * u + cz * v});
    }
    return measure(points);
}

/** Where along a measured path (m from its start): the point and the way it heads. */
function along(path: PathPoint[], s: number): {x: number; y: number; z: number; dx: number; dy: number; dz: number} {
    const total = path[path.length - 1].s;
    const t = Math.min(Math.max(s, 0), total);
    let lo = 0;
    let hi = path.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (path[mid].s <= t) lo = mid;
        else hi = mid;
    }
    const a = path[lo];
    const b = path[hi];
    const span = b.s - a.s || 1;
    const k = (t - a.s) / span;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dy, dz) || 1;
    return {x: a.x + dx * k, y: a.y + dy * k, z: a.z + dz * k, dx: dx / l, dy: dy / l, dz: dz / l};
}

// MARK: The solitary forager

/** A solitary forager's trip (s): its search, a moment at the find, the run home (at its pace, `antSearch`). */
const SOLO_TRIP_SECONDS = 90;
const searches = new Map<string, {out: PathPoint[]; home: PathPoint[]} | null>();

/**
 * A solitary forager's trip `k`: a winding search out of the nest (short straight runs and turns, never off walkable
 * ground) that ends where it finds its insect, then the straight run home. Its own each trip.
 */
export function antSearch(colony: AntColony, id: string, k: number, ground: AntGround): {out: PathPoint[]; home: PathPoint[]} | null {
    const key = `${colony.key}#${id}#${k}`;
    if (searches.has(key)) return searches.get(key)!;
    const random = seeded(hashString(`search#${key}`));
    const speed = colony.spec.speed;
    // Search time and home time share the trip (less the find): the search ~3–5 times the way home.
    const budget = SOLO_TRIP_SECONDS - colony.atFood;
    const searchShare = 0.72 + 0.1 * random();
    const searchLength = budget * searchShare * speed;
    const points: Array<{x: number; y: number; z: number}> = [terrainPoint(colony.nest.x, colony.nest.z, ground)];
    let x = colony.nest.x;
    let z = colony.nest.z;
    let heading = random() * Math.PI * 2;
    let walked = 0;
    const limit = (budget * (1 - searchShare) * speed) * 0.98;
    let guard = 0;
    while (walked < searchLength && guard++ < 400) {
        const run = 0.3 + 0.8 * random();
        heading += (random() - 0.5) * 2.1;
        const step = Math.min(run, searchLength - walked);
        const nx = x + Math.sin(heading) * step;
        const nz = z + Math.cos(heading) * step;
        // It may stray no further than it can get home from in its time left, and only over walkable ground.
        if (!ground.walkable(nx, nz) || Math.hypot(nx - colony.nest.x, nz - colony.nest.z) > limit) {
            heading += Math.PI * (0.5 + random());
            continue;
        }
        const pieces = Math.max(Math.ceil(step / 0.08), 1);
        for (let i = 1; i <= pieces; i++) points.push(terrainPoint(x + (nx - x) * (i / pieces), z + (nz - z) * (i / pieces), ground));
        x = nx;
        z = nz;
        walked += step;
    }
    if (points.length < 2) {
        searches.set(key, null);
        return null;
    }
    const out = measure(points);
    const homeSteps = Math.max(Math.ceil(Math.hypot(x - colony.nest.x, z - colony.nest.z) / 0.08), 1);
    const home: Array<{x: number; y: number; z: number}> = [];
    for (let i = 0; i <= homeSteps; i++) home.push(terrainPoint(x + (colony.nest.x - x) * (i / homeSteps), z + (colony.nest.z - z) * (i / homeSteps), ground));
    const trip = {out, home: measure(home)};
    searches.set(key, trip);
    if (searches.size > 256) searches.delete(searches.keys().next().value as string);
    return trip;
}

// MARK: Where an ant is now

export type AntPose = SurfacePoint & {
    /** At the nest, going out, at the food, or coming back. */
    leg: "nest" | "out" | "food" | "back";
    /** Coming back with something to see (a seed, a bit of insect). */
    carrying: "insect" | "seed" | null;
};

/** Its spot at the nest between trips: a few body lengths round the entrance, by its rank (its own, seeded turn). */
export function antNestSpot(colony: AntColony, id: string, rank: number, length: number, ground: AntGround): AntPose {
    const random = seeded(hashString(`nest#${colony.key}#${id}`));
    const angle = rank * 2.39996 + random() * 0.6;
    const radius = (1.5 + 1.3 * Math.sqrt(rank)) * Math.max(length, 0.002);
    const across = Math.cos(angle) * radius;
    const ahead = Math.sin(angle) * radius;
    const [nx, ny, nz] = colony.nest.normal;
    const [tx, ty, tz] = colony.nest.tangent;
    const cx = ny * tz - nz * ty;
    const cy = nz * tx - nx * tz;
    const cz = nx * ty - ny * tx;
    const x = colony.nest.x + tx * ahead + cx * across;
    const z = colony.nest.z + tz * ahead + cz * across;
    const y = colony.ground ? ground.heightAt(x, z) : colony.nest.y + ty * ahead + cy * across;
    // Facing out of the nest, turned a little its own way.
    const heading = angle + (random() - 0.5) * 1.2;
    const dx = tx * Math.sin(heading) + cx * Math.cos(heading);
    const dy = ty * Math.sin(heading) + cy * Math.cos(heading);
    const dz = tz * Math.sin(heading) + cz * Math.cos(heading);
    return pose(colony, {x, y, z, dx, dy, dz}, 0, "nest", null, ground);
}

/**
 * Where a forager is now: on its trail (out, at the food, back), or at its spot by the nest (between trips, or when the
 * colony did not go out on this trip: its kind asleep at some time in the trip). `rank` is its place in its slot (its
 * place in the file), `length` its body (m), `awake(epoch)` whether its kind is up at a world time.
 */
export function antPose(colony: AntColony, id: string, rank: number, length: number, epoch: number, awake: (epoch: number) => boolean, ground: AntGround): AntPose {
    const solo = colony.spec.foraging === "solo";
    const shift = solo ? 0 : (rank % FILE_ROOM) * colony.gap;
    const local = epoch - colony.offset - shift;
    const k = Math.floor(local / colony.period);
    const t = local - k * colony.period;
    const home = antNestSpot(colony, id, rank, length, ground);
    // The colony's trip k goes out only if the colony is up for the whole of it (its start and its last forager's end).
    const start = colony.offset + k * colony.period;
    const tripLength = (solo ? SOLO_TRIP_SECONDS : (2 * colony.length) / colony.spec.speed + colony.atFood * 1.2 + FILE_ROOM * colony.gap) + 4;
    if (!awake(start) || !awake(start + tripLength)) return home;
    const speed = colony.spec.speed;
    const loaded = colony.spec.carry && seeded(hashString(`load#${id}#${k}`))() < colony.spec.carryShare ? colony.spec.carry : null;
    let legAt: (tt: number) => AntPose | null;
    let backEnd: number;
    if (solo) {
        const trip = antSearch(colony, id, k, ground);
        if (!trip) return home;
        const outTime = trip.out[trip.out.length - 1].s / speed;
        const homeTime = trip.home[trip.home.length - 1].s / speed;
        backEnd = outTime + colony.atFood + homeTime;
        legAt = (tt) =>
            tt < outTime ? pose(colony, along(trip.out, tt * speed), 0, "out", null, ground)
            : tt < outTime + colony.atFood ? turning(colony, along(trip.out, Infinity), 0, (tt - outTime) / colony.atFood, ground)
            : tt < backEnd ? pose(colony, along(trip.home, (tt - outTime - colony.atFood) * speed), 0, "back", loaded, ground)
            : null;
    } else {
        const path = colony.path!;
        const outTime = colony.length / speed;
        // Out on one side of the trail, back on the other (both ways on the one trail, never through each other).
        const lane = Math.max(length * 0.6, 0.002);
        const linger = colony.atFood * (0.8 + 0.4 * seeded(hashString(`food#${id}#${k}`))());
        backEnd = 2 * outTime + linger;
        legAt = (tt) => {
            if (tt < outTime) return pose(colony, along(path, tt * speed), lane, "out", null, ground);
            if (tt < outTime + linger) return turning(colony, along(path, Infinity), lane, (tt - outTime) / linger, ground);
            if (tt >= backEnd) return null;
            const on = along(path, colony.length - (tt - outTime - linger) * speed);
            return pose(colony, {...on, dx: -on.dx, dy: -on.dy, dz: -on.dz}, lane, "back", loaded, ground);
        };
    }
    // From its spot by the nest onto the trail as it sets out, and back to it at the end: a few body lengths, walked at
    // its pace (the trip's clock starts once it is on the trail).
    const first = legAt(0)!;
    const outStep = Math.hypot(first.x - home.x, first.z - home.z) / speed;
    if (t < outStep) return walked(colony, home, first, t / outStep, "out", null, ground);
    const tt = t - outStep;
    const on = legAt(tt);
    if (on) return on;
    const last = legAt(backEnd - 1e-6)!;
    const homeStep = Math.hypot(last.x - home.x, last.z - home.z) / speed;
    if (tt - backEnd < homeStep) return walked(colony, last, home, (tt - backEnd) / homeStep, "back", last.carrying, ground);
    return home;
}

/** A straight step between two poses (`u` 0…1 of the way), heading the way it goes. */
function walked(colony: AntColony, from: AntPose, to: AntPose, u: number, leg: AntPose["leg"], carrying: AntPose["carrying"], ground: AntGround): AntPose {
    const x = from.x + (to.x - from.x) * u;
    const y = from.y + (to.y - from.y) * u;
    const z = from.z + (to.z - from.z) * u;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const l = Math.hypot(dx, dy, dz);
    return l > 1e-9 ? pose(colony, {x, y, z, dx: dx / l, dy: dy / l, dz: dz / l}, 0, leg, carrying, ground) : {...to, leg, carrying};
}

/** At the food: it turns round there (a U-turn from its outward lane to its homeward one), `u` 0…1 through its stay. */
function turning(colony: AntColony, end: {x: number; y: number; z: number; dx: number; dy: number; dz: number}, lane: number, u: number, ground: AntGround): AntPose {
    const k = u * u * (3 - 2 * u);
    const out = pose(colony, end, 0, "food", null, ground);
    // Its right (square to the heading and the normal), the lane's side.
    const rx = out.ty * out.nz - out.tz * out.ny;
    const ry = out.tz * out.nx - out.tx * out.nz;
    const rz = out.tx * out.ny - out.ty * out.nx;
    const a = Math.PI * k;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    // Round from out to back through its right side (the lane it came in on) to the other.
    const tx = out.tx * c + rx * sn;
    const ty = out.ty * c + ry * sn;
    const tz = out.tz * c + rz * sn;
    const side = lane * c;
    const ahead = lane * sn;
    const x = out.x + rx * side + out.tx * ahead;
    const z = out.z + rz * side + out.tz * ahead;
    const y = colony.ground ? ground.heightAt(x, z) : out.y + ry * side + out.ty * ahead;
    return {...out, x, y, z, tx, ty, tz};
}

function pose(colony: AntColony, at: {x: number; y: number; z: number; dx: number; dy: number; dz: number}, lane: number, leg: AntPose["leg"], carrying: AntPose["carrying"], ground: AntGround): AntPose {
    let nx: number;
    let ny: number;
    let nz: number;
    if (colony.ground) {
        // The terrain's normal there (a small central difference).
        const e = 0.05;
        const hx = ground.heightAt(at.x + e, at.z) - ground.heightAt(at.x - e, at.z);
        const hz = ground.heightAt(at.x, at.z + e) - ground.heightAt(at.x, at.z - e);
        const l = Math.hypot(hx, 2 * e, hz) || 1;
        nx = -hx / l;
        ny = (2 * e) / l;
        nz = -hz / l;
    } else {
        [nx, ny, nz] = colony.nest.normal;
    }
    // Heading square to the normal; the lane to its right of the way it goes.
    const dot = at.dx * nx + at.dy * ny + at.dz * nz;
    let tx = at.dx - nx * dot;
    let ty = at.dy - ny * dot;
    let tz = at.dz - nz * dot;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    const rx = ty * nz - tz * ny;
    const ry = tz * nx - tx * nz;
    const rz = tx * ny - ty * nx;
    const x = at.x + rx * lane;
    const z = at.z + rz * lane;
    const y = colony.ground ? ground.heightAt(x, z) : at.y + ry * lane;
    return {x, y, z, nx, ny, nz, tx, ty, tz, leg, carrying};
}
