/**
 * A town cat up on a garden wall (the owner, 2026-11-16: "they like to climb on top of walls and walk along them"): from
 * where its schedule has it resting, it walks to the foot of a nearby garden wall, jumps up onto the coping, walks along
 * the top, sits there watching, jumps down on the side it came from and walks back to the same spot.
 *
 * Grounded in the species' own stored text (the catalogue, `docs/ark/signature-behaviours.json`, Domestic Cat, "watches
 * from elevated perches": "Cats frequently observe their surroundings from elevated perches or hidden vantage points,
 * taking in information without immediate action."), log line "{aAnimal} is watching everything from a high perch".
 *
 * Shared, never viewer-local: which cat goes up when, which wall, how far and how long are pure in its id and the shared
 * clock (`hashText` units per 12-minute slot), the walls from the town plan, the checks from the town's colliders; the
 * episode starts and ends at its schedule's own resting spot (it only ever borrows a stretch of time in which the schedule
 * has it still at one place), so the shared schedule is untouched either side.
 *
 * Where it may go, by rule (unit-tested over the whole island, `cat-walls.test.ts`):
 * - only on a garden wall's coping (`plan.ts` hedges of kind "wall", drawn by `render/scenery.ts` as brick 0.3 m wide
 *   with a 0.38 m coping, its top `h + 0.1` over the ground at each ≤6 m piece's middle), never a fence board or a hedge;
 * - only where nothing else stands over the top within a cat's reach (a house the wall runs into, a tree's trunk, a shed):
 *   the stretch stops short of it;
 * - its ground legs (to the wall's foot and back) and both feet spots are clear of every collider and of water.
 */

import type {ColliderSet} from "@/ark-scene/collide/colliders";
import {colliderDistance, spansCollider} from "@/ark-scene/collide/colliders";
import {hashText, inPoly, type Poly} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {townObstacles} from "@/ark-scene/islands/town/obstacles";
import {townPlan, type TownPlan} from "@/ark-scene/islands/town/plan";

/** The species that do it (by model slug): those whose catalogue row says they watch from high perches and live in gardens. */
export const WALL_CATS: ReadonlySet<string> = new Set(["domestic-cat"]);
/** The catalogue's log line for it (Domestic Cat, "watches from elevated perches"). */
export const WALL_LINE = "{aAnimal} is watching everything from a high perch";

/** One slot of shared time (s): in each, a cat goes up a wall at most once. */
export const WALL_SLOT = 720;
/** The share of slots in which a cat that can (its schedule still near a wall) does. */
export const WALL_SHARE = 0.6;
/** Moments in a slot it may leave from (the first at which its schedule has it awake and still near a wall). */
export const WALL_TRIES = 4;
/** How far from its resting spot the wall's foot may be (m). */
export const WALL_REACH = 8;
/** The cat's feet spot beside the wall (m out from the wall's middle line): past the 0.19 m coping's edge. */
export const FOOT_OUT = 0.5;
/** A cat's room: its radius and its height over its feet (m), for "nothing else over the top" and "a clear ground leg". */
export const CAT_RADIUS = 0.16;
export const CAT_HEIGHT = 0.35;
/** The coping's top over the brick (m): `render/scenery.ts` boundary, case "wall". */
const COPING = 0.1;
/** Drawn wall pieces are at most this long (m), each flat at its middle's ground (`render/scenery.ts`). */
const PIECE = 6;

/** A straight walkable stretch of a wall's top, in the world frame: from a to b, its feet height `y`, a unit normal. */
export type WallStretch = {id: string; ax: number; az: number; bx: number; bz: number; y: number; nx: number; nz: number; len: number};

/** Whether a body stands clear at (x, z) with its feet at y (no solid collider meets it), `skip`: a collider id prefix ignored. */
export function clearAt(set: ColliderSet, x: number, z: number, y: number, height = CAT_HEIGHT, radius = CAT_RADIUS, skip?: string): boolean {
    for (const c of set.near(x, z, radius + 0.5)) {
        if (c.soft) continue;
        if (skip && c.id.startsWith(skip)) continue;
        if (colliderDistance(c, x, z) >= radius) continue;
        if (spansCollider(c, y, height)) return false;
    }
    return true;
}

/** The town's water in its own frame: pools and ponds (the sea: ground under 0.05 m). */
export function townWater(plan: TownPlan, open?: readonly string[]): Poly[] {
    const out: Poly[] = [];
    for (const o of townObstacles(plan, open)) if (o.kind === "water") out.push(o.poly);
    return out;
}

/** Whether a town-frame point is dry land (not in a pool or pond, not the sea). */
export function dryAt(water: readonly Poly[], x: number, z: number): boolean {
    if (townHeight(x, z) < 0.05) return false;
    for (const poly of water) if (inPoly(poly, x, z)) return false;
    return true;
}

/**
 * Every wall's walkable stretches (world frame): each drawn piece's top, sampled every 0.2 m; a sample is walkable when
 * nothing but the wall itself stands over the top there within a cat's reach (and the ground beside it is land); runs of
 * walkable samples 1.5 m or longer are kept. Pure in the plan, the origin and the colliders.
 */
export function wallStretches(plan: TownPlan, origin: {x: number; z: number}, set: ColliderSet, water: readonly Poly[] = townWater(plan)): WallStretch[] {
    const out: WallStretch[] = [];
    for (const h of plan.hedges) {
        if (h.kind !== "wall") continue;
        for (let i = 1; i < h.line.length; i++) {
            const a = h.line[i - 1];
            const b = h.line[i];
            const length = Math.hypot(b.x - a.x, b.z - a.z);
            if (length < 1.5) continue;
            const ux = (b.x - a.x) / length;
            const uz = (b.z - a.z) / length;
            const n = Math.max(1, Math.ceil(length / PIECE));
            const seg = length / n;
            for (let k = 0; k < n; k++) {
                const mx = a.x + ux * seg * (k + 0.5);
                const mz = a.z + uz * seg * (k + 0.5);
                const y = townHeight(mx, mz) + h.height + COPING;
                let run: number | null = null;
                const flush = (end: number) => {
                    if (run !== null && end - run >= 1.5) {
                        const s0 = seg * k + run;
                        const s1 = seg * k + end;
                        out.push({id: `${h.id}:${i}:${k}:${Math.round(run * 10)}:${out.length}`, ax: a.x + ux * s0 + origin.x, az: a.z + uz * s0 + origin.z, bx: a.x + ux * s1 + origin.x, bz: a.z + uz * s1 + origin.z, y, nx: -uz, nz: ux, len: s1 - s0});
                    }
                    run = null;
                };
                // (Samples from 0.25 m inside each piece's ends: a cat never stands on a step between two pieces.)
                for (let s = 0.25; s <= seg - 0.25 + 1e-6; s += 0.2) {
                    const x = a.x + ux * (seg * k + s);
                    const z = a.z + uz * (seg * k + s);
                    const ok = clearAt(set, x + origin.x, z + origin.z, y, CAT_HEIGHT, CAT_RADIUS, `town:${h.id}:`) && (dryAt(water, x - uz * FOOT_OUT, z + ux * FOOT_OUT) || dryAt(water, x + uz * FOOT_OUT, z - ux * FOOT_OUT));
                    if (ok && run === null) run = s;
                    if (!ok) flush(s - 0.2);
                }
                flush(seg - 0.25);
            }
        }
    }
    return out;
}

/** The stretches by an 8 m grid cell (world frame), for "the walls near here". */
export class WallIndex {
    private readonly cells = new Map<string, WallStretch[]>();
    constructor(readonly list: readonly WallStretch[]) {
        for (const w of list) {
            const x0 = Math.floor((Math.min(w.ax, w.bx) - WALL_REACH) / 8);
            const x1 = Math.floor((Math.max(w.ax, w.bx) + WALL_REACH) / 8);
            const z0 = Math.floor((Math.min(w.az, w.bz) - WALL_REACH) / 8);
            const z1 = Math.floor((Math.max(w.az, w.bz) + WALL_REACH) / 8);
            for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
                const key = `${i},${j}`;
                const at = this.cells.get(key);
                if (at) at.push(w);
                else this.cells.set(key, [w]);
            }
        }
    }
    near(x: number, z: number): readonly WallStretch[] {
        return this.cells.get(`${Math.floor(x / 8)},${Math.floor(z / 8)}`) ?? [];
    }
}

/** Where the schedule has it (the trip's pose, as the scene's shared base reads it). */
export type SchedAt = {x: number; y: number; z: number; yaw: number; moving: boolean; aloft: boolean; doing: string};

/** The schedule states it may leave for a wall from (and must be back in, at the same spot). */
const FROM: ReadonlySet<string> = new Set(["rest", "watch", "wander", "forage", "perch", "groom"]);

type Phase = {t: number; kind: "walk" | "turn" | "crouch" | "jump" | "sit"; x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; yaw0: number; yaw1: number; up: boolean};

/** One cat's trip up a wall: its start (s, shared clock), its end, and its phases (each from the previous one's end). */
export type WallTrip = {id: string; wall: string; t0: number; t1: number; phases: Phase[]};

const unitOf = (key: string) => hashText(key) / 4294967296;
const headingTo = (x0: number, z0: number, x1: number, z1: number) => Math.atan2(x1 - x0, z1 - z0);

/** Whether the straight ground leg from a to b is clear (every 0.2 m, its feet on the ground) and on dry land. */
export function clearLeg(set: ColliderSet, groundAt: (x: number, z: number) => number, dry: (x: number, z: number) => boolean, ax: number, az: number, bx: number, bz: number): boolean {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / 0.2));
    for (let i = 0; i <= n; i++) {
        const x = ax + ((bx - ax) * i) / n;
        const z = az + ((bz - az) * i) / n;
        if (!dry(x, z)) return false;
        if (!clearAt(set, x, z, groundAt(x, z) + 0.05)) return false;
    }
    return true;
}

export type WallHost = {
    index: WallIndex;
    set: ColliderSet;
    /** Ground height (world frame). */
    groundAt: (x: number, z: number) => number;
    /** Dry land (world frame). */
    dry: (x: number, z: number) => boolean;
};

/**
 * A cat's trip up a wall in shared slot `slot`, or null: none this slot (its hash), its schedule not still at one spot
 * over the whole trip's span, or no wall it can reach from there by a clear way. `pace`: its walk (m/s).
 */
export function wallTrip(id: string, slot: number, pace: number, schedule: (epoch: number) => SchedAt, host: WallHost): WallTrip | null {
    if (unitOf(`${id}:wall:${slot}`) >= WALL_SHARE) return null;
    // (Up to WALL_TRIES moments a slot, each in its own quarter: the first that works. A trip is under 2 minutes.)
    const span = (WALL_SLOT - 160) / WALL_TRIES;
    for (let k = 0; k < WALL_TRIES; k++) {
        const trip = tripFrom(id, slot, slot * WALL_SLOT + 20 + span * k + unitOf(`${id}:wall-at:${slot}:${k}`) * (span - 20), pace, schedule, host);
        if (trip) return trip;
    }
    return null;
}

function tripFrom(id: string, slot: number, t0: number, pace: number, schedule: (epoch: number) => SchedAt, host: WallHost): WallTrip | null {
    const s = schedule(t0);
    if (s.moving || s.aloft || !FROM.has(s.doing)) return null;
    const candidates = host.index.near(s.x, s.z).slice().sort((p, q) => unitOf(`${id}:${slot}:${p.id}`) - unitOf(`${id}:${slot}:${q.id}`));
    for (const w of candidates) {
        const ux = (w.bx - w.ax) / w.len;
        const uz = (w.bz - w.az) / w.len;
        // The nearest point of the stretch, 0.4 m in from its ends.
        const along = Math.min(Math.max((s.x - w.ax) * ux + (s.z - w.az) * uz, 0.4), w.len - 0.4);
        if (w.len - 0.8 < 1) continue;
        const px = w.ax + ux * along;
        const pz = w.az + uz * along;
        const side = (s.x - px) * w.nx + (s.z - pz) * w.nz >= 0 ? 1 : -1;
        const fx = px + w.nx * FOOT_OUT * side;
        const fz = pz + w.nz * FOOT_OUT * side;
        if (Math.hypot(fx - s.x, fz - s.z) > WALL_REACH) continue;
        // (Its own spot is on that side of the wall, not across it.)
        if (((s.x - px) * w.nx + (s.z - pz) * w.nz) * side < FOOT_OUT - 0.05) continue;
        if (w.y - host.groundAt(fx, fz) > 2.2 || w.y - host.groundAt(fx, fz) < 0.5) continue;
        if (!clearLeg(host.set, host.groundAt, host.dry, s.x, s.z, fx, fz)) continue;
        // Along the top: 1.2 to 4 m, the way its hash says (the other way when that end is too near).
        let dir = unitOf(`${id}:wall-dir:${slot}`) < 0.5 ? 1 : -1;
        const want = 1.2 + unitOf(`${id}:wall-len:${slot}`) * 2.8;
        let room = dir > 0 ? w.len - 0.4 - along : along - 0.4;
        if (room < 1.2) {
            dir = -dir;
            room = dir > 0 ? w.len - 0.4 - along : along - 0.4;
        }
        if (room < 1.2) continue;
        const go = Math.min(want, room);
        const qx = px + ux * go * dir;
        const qz = pz + uz * go * dir;
        const gx = qx + w.nx * FOOT_OUT * side;
        const gz = qz + w.nz * FOOT_OUT * side;
        if (!clearLeg(host.set, host.groundAt, host.dry, gx, gz, s.x, s.z)) continue;
        // The phases, timed from t0.
        const sitFor = 18 + unitOf(`${id}:wall-sit:${slot}`) * 30;
        const g = (x: number, z: number) => host.groundAt(x, z);
        const facing = headingTo(fx, fz, px, pz);
        const alongYaw = headingTo(px, pz, qx, qz);
        const downYaw = headingTo(qx, qz, gx, gz);
        const legIn = headingTo(s.x, s.z, fx, fz);
        const legOut = headingTo(gx, gz, s.x, s.z);
        const spec: Array<Omit<Phase, "t"> & {d: number}> = [
            {kind: "turn", d: 0.6, x0: s.x, y0: s.y, z0: s.z, x1: s.x, y1: s.y, z1: s.z, yaw0: s.yaw, yaw1: legIn, up: false},
            {kind: "walk", d: Math.hypot(fx - s.x, fz - s.z) / pace, x0: s.x, y0: s.y, z0: s.z, x1: fx, y1: g(fx, fz), z1: fz, yaw0: legIn, yaw1: legIn, up: false},
            {kind: "crouch", d: 1.1, x0: fx, y0: g(fx, fz), z0: fz, x1: fx, y1: g(fx, fz), z1: fz, yaw0: legIn, yaw1: facing, up: false},
            {kind: "jump", d: 0.5, x0: fx, y0: g(fx, fz), z0: fz, x1: px, y1: w.y, z1: pz, yaw0: facing, yaw1: facing, up: true},
            {kind: "turn", d: 0.6, x0: px, y0: w.y, z0: pz, x1: px, y1: w.y, z1: pz, yaw0: facing, yaw1: alongYaw, up: true},
            {kind: "walk", d: go / (pace * 0.7), x0: px, y0: w.y, z0: pz, x1: qx, y1: w.y, z1: qz, yaw0: alongYaw, yaw1: alongYaw, up: true},
            {kind: "sit", d: sitFor, x0: qx, y0: w.y, z0: qz, x1: qx, y1: w.y, z1: qz, yaw0: alongYaw, yaw1: alongYaw, up: true},
            {kind: "turn", d: 0.7, x0: qx, y0: w.y, z0: qz, x1: qx, y1: w.y, z1: qz, yaw0: alongYaw, yaw1: downYaw, up: true},
            {kind: "jump", d: 0.45, x0: qx, y0: w.y, z0: qz, x1: gx, y1: g(gx, gz), z1: gz, yaw0: downYaw, yaw1: downYaw, up: true},
            {kind: "turn", d: 0.5, x0: gx, y0: g(gx, gz), z0: gz, x1: gx, y1: g(gx, gz), z1: gz, yaw0: downYaw, yaw1: legOut, up: false},
            {kind: "walk", d: Math.hypot(s.x - gx, s.z - gz) / pace, x0: gx, y0: g(gx, gz), z0: gz, x1: s.x, y1: s.y, z1: s.z, yaw0: legOut, yaw1: legOut, up: false}
        ];
        let t = t0;
        const phases: Phase[] = [];
        for (const p of spec) {
            const {d, ...rest} = p;
            phases.push({...rest, t});
            t += d;
        }
        const t1 = t + 0.7;
        const e = schedule(t1);
        // (Back where it left, still: the schedule's own pose either side, untouched.)
        if (e.moving || e.aloft || !FROM.has(e.doing) || Math.hypot(e.x - s.x, e.z - s.z) > 0.25) return null;
        phases.push({kind: "turn", t, x0: s.x, y0: s.y, z0: s.z, x1: s.x, y1: s.y, z1: s.z, yaw0: legOut, yaw1: e.yaw, up: false});
        return {id, wall: w.id, t0, t1, phases};
    }
    return null;
}

/** Its pose on the trip now: the shared pose's fields, `onWall` while it is off the ground (held there by the collisions). */
export type WallPose = {x: number; y: number; z: number; yaw: number; moving: boolean; aloft: false; doing: "wander" | "watch" | "perch"; beat: "walk" | "run" | "scan" | "pause"; nx: number; ny: number; nz: number; onWall: boolean};

const smooth = (k: number) => k * k * (3 - 2 * k);
const turnLerp = (a: number, b: number, k: number) => {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * k;
};

/** The pose at `epoch` on a trip (null outside it). Pure. */
export function wallPose(trip: WallTrip, epoch: number): WallPose | null {
    if (epoch < trip.t0 || epoch >= trip.t1) return null;
    let i = trip.phases.length - 1;
    while (i > 0 && trip.phases[i].t > epoch) i--;
    const p = trip.phases[i];
    const end = i + 1 < trip.phases.length ? trip.phases[i + 1].t : trip.t1;
    const k = end > p.t ? Math.min(Math.max((epoch - p.t) / (end - p.t), 0), 1) : 1;
    let x = p.x0 + (p.x1 - p.x0) * k;
    let z = p.z0 + (p.z1 - p.z0) * k;
    let y = p.y0 + (p.y1 - p.y0) * k;
    let yaw = p.yaw0;
    if (p.kind === "turn" || p.kind === "crouch") yaw = turnLerp(p.yaw0, p.yaw1, smooth(Math.min(k * 1.6, 1)));
    if (p.kind === "jump") {
        // A leap's arc: up and over the coping's edge going up (its top 0.18 m over the higher end), a drop going down.
        const e = smooth(k);
        x = p.x0 + (p.x1 - p.x0) * e;
        z = p.z0 + (p.z1 - p.z0) * e;
        const lift = p.y1 > p.y0 ? 0.18 : 0.08;
        y = p.y0 + (p.y1 - p.y0) * (p.y1 > p.y0 ? Math.sin((k * Math.PI) / 2) : k * k) + lift * 4 * k * (1 - k);
    }
    const moving = p.kind === "walk" || p.kind === "jump";
    const beat = p.kind === "walk" ? "walk" : p.kind === "jump" ? "run" : p.kind === "sit" ? "scan" : "pause";
    const doing = p.kind === "sit" ? "perch" : moving ? "wander" : "watch";
    return {x, y, z, yaw, moving, aloft: false, doing, beat, nx: 0, ny: 1, nz: 0, onWall: p.up};
}

/** Whether a trip is on the wall top (sitting there) at `epoch`: the live log's "watching from a high perch". */
export function onWallTop(trip: WallTrip | null, epoch: number): boolean {
    if (!trip || epoch < trip.t0 || epoch >= trip.t1) return false;
    const sit = trip.phases.find((p) => p.kind === "sit");
    if (!sit) return false;
    const next = trip.phases[trip.phases.indexOf(sit) + 1];
    return epoch >= sit.t && epoch < (next ? next.t : trip.t1);
}

/**
 * The scene's side: each town cat's trip for the slot now (worked out once a slot, kept), and its pose when on one.
 */
export class CatWalls {
    private readonly memo = new Map<string, {slot: number; trip: WallTrip | null}>();
    constructor(private readonly host: WallHost) {}
    /** The trip `id` is on at `epoch` (its slot's, when that slot has one), or null. */
    tripAt(id: string, epoch: number, pace: number, schedule: (epoch: number) => SchedAt): WallTrip | null {
        const slot = Math.floor(epoch / WALL_SLOT);
        let memo = this.memo.get(id);
        if (!memo || memo.slot !== slot) {
            memo = {slot, trip: wallTrip(id, slot, pace, schedule, this.host)};
            this.memo.set(id, memo);
        }
        return memo.trip && epoch >= memo.trip.t0 && epoch < memo.trip.t1 ? memo.trip : null;
    }
    pose(slug: string, id: string, epoch: number, pace: number, schedule: (epoch: number) => SchedAt): WallPose | null {
        if (!WALL_CATS.has(slug)) return null;
        const trip = this.tripAt(id, epoch, pace, schedule);
        return trip ? wallPose(trip, epoch) : null;
    }
}

/** The town's cat walls at its world origin, from its plan and colliders (the scene's, once the town's world is in). */
export function townCatWalls(origin: {x: number; z: number}, set: ColliderSet, open?: readonly string[], plan: TownPlan = townPlan()): CatWalls {
    return catWallsFrom(plan, origin, set, open);
}

export function catWallsFrom(plan: TownPlan, origin: {x: number; z: number}, set: ColliderSet, open?: readonly string[]): CatWalls {
    const water = townWater(plan, open);
    const host: WallHost = {
        index: new WallIndex(wallStretches(plan, origin, set, water)),
        set,
        groundAt: (x, z) => Math.max(townHeight(x - origin.x, z - origin.z), 0),
        dry: (x, z) => dryAt(water, x - origin.x, z - origin.z)
    };
    return new CatWalls(host);
}
