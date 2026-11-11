/**
 * Release: from where the player lets go back into NPC life (design §3.3, §5.4, §12.5).
 *
 * `ark-live` works the plan out once, at release, deterministically (seeded by the animal and the release time), and
 * stores it in the animal's record; the page, the server and the tick then only evaluate it (`plan-eval.ts`).
 *
 *  0. enclosure: a zoo animal resumes its enclosure's schedule where it is (it can never be outside);
 *  1. stay: suitable habitat (S ≥ 0.6) and within its home disc plus twice its home radius;
 *  2. retrace (two islands): released within an Ark day of arriving by a crossing, and able to cross back;
 *  3. homing: home within its homing range and reachable (the same stretch of ground at its slope, the same water for
 *     a swimmer, anywhere for a flyer): a path over the walk grid at its walking pace, resting 20 s whenever its
 *     stamina would fall below 35 %;
 *  4. search: legs of up to one 80 s slot, each on the best of 8 bearings (habitat ahead, home's bearing for flyers and
 *     mammals, seeded noise); it settles where S ≥ 0.6, else after 3 Ark days at the best place it found, stranded if
 *     S < 0.3 there.
 *
 * Pure.
 */

import type {Abilities} from "@/ark-live/species";
import {CELL, type Terrain} from "@/ark-live/terrain";
import {suitability, type AnimalHome} from "@/ark-live/habitat";
import {modeIndex, type Mode} from "@/ark-live/protocol";
import {ARK_DAY_S} from "@/ark-live/session";
import {maxSlopeFor} from "@/ark-live/species";
import type {PlanLeg, ReleasePlan} from "@/ark-live/plan-eval";
import type {ArkZone} from "@/ark-scene/types";

export const SLOT_S = 80;
export const REST_BEAT_S = 20;
export const MAX_LEGS = 64;
export const SEARCH_ARK_DAYS = 3;
export const RETRACE_WINDOW_S = ARK_DAY_S;
const GRID = 2;

export type HomeDisc = {x: number; z: number; r: number};

export type ReleaseInput = {
    animalId: string;
    releasedAt: number;
    pose: {x: number; y: number; z: number; mode: Mode};
    a: Abilities;
    home: AnimalHome;
    homeDisc: HomeDisc;
    terrain: Terrain;
    stamina: number;
    enclosure: number | null;
    /** Arrived on this island by a crossing (two islands, §12.5): when, and where it came ashore. */
    crossed?: {arrivedAt: number; at: {x: number; z: number}; canCrossBack: boolean; strait: {farPoint: {x: number; z: number}; seconds: number; to: string}} | null;
};

export type ReleaseResult = {plan: ReleasePlan; zone: ArkZone | null; strandedFrom: number | null};

/**
 * The shared position module's `HomeOverride` (`_shared/ark-positions` homeOf's third argument, POSITIONS_VERSION 1):
 * what replaces the formula home once the animal is back in NPC life, so the scene, the encounter tick and the ecology
 * all continue it from where it was released. Null fields (or null) fall back to the formula.
 *
 * - stay, homing, enclosure, on its own island: null (its formula home; the homing legs bring it there);
 * - search: the disc it settled in (its own home again: null);
 * - retrace: its own island again (its formula home there);
 * - anything left on another island: that island.
 */
export type HomeOverride = {island?: string; x?: number; z?: number; r?: number};

export function homeOverrideOf(result: ReleaseResult, where: {releaseIsland: string; homeIsland: string}): HomeOverride | null {
    const plan = result.plan;
    if (plan.kind === "retrace") return plan.island && plan.island !== where.homeIsland ? {island: plan.island} : plan.island ? {island: plan.island} : null;
    if (plan.settle) return {island: where.releaseIsland, x: plan.settle.x, z: plan.settle.z, r: plan.settle.r};
    return where.releaseIsland !== where.homeIsland ? {island: where.releaseIsland} : null;
}

/** A small seeded generator (mulberry32 over a string hash). */
export function seededRandom(seed: string): () => number {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Its home radius (`behaviour-schedule.ts` homeRadius in the scene: 6 m on the ground, 14 swimming, 18 flying, + 5·length, capped). */
export function homeRadius(a: Abilities): number {
    const base = a.canFly ? 18 : a.gills || (a.canSwim && !a.land) ? 14 : 6;
    return Math.min(base + 5 * a.D, a.canFly ? 40 : 26);
}

type Travel = "walk" | "swim" | "fly" | "amphibious";

function travelOf(a: Abilities): Travel {
    if (a.canFly) return "fly";
    if (a.gills || (a.canSwim && !a.land)) return "swim";
    if (a.canSwim && a.land) return "amphibious";
    return "walk";
}

function paceOf(a: Abilities, travel: Travel, stamina: number): number {
    const tired = stamina < 0.35 ? 0.6 : 1;
    const v = travel === "fly" ? a.fly * 0.8 : travel === "swim" ? a.swim * 0.8 : Math.max(a.walk, a.paddle * 0.8, 0.05);
    return Math.max(v * tired, 0.05);
}

function passable(a: Abilities, travel: Travel, terrain: Terrain, x: number, z: number, enclosure: number | null): boolean {
    const c = terrain.cell(x, z);
    if (!c) return false;
    if (enclosure !== null && c.pen !== enclosure) return false;
    if (enclosure === null && c.pen > 0 && c.pen < 100) return false;
    switch (travel) {
        case "fly":
            return true;
        case "swim":
            return c.depth >= Math.max(0.3 * a.D, 0.2);
        case "amphibious":
            return !(c.flags & CELL.BLOCKED);
        default:
            return !(c.flags & CELL.BLOCKED) && c.depth <= a.wadeDepth + 0.05;
    }
}

/** A* over a 2 m grid; null when the goal can't be reached within `limit` metres of path. */
export function findPath(a: Abilities, travel: Travel, terrain: Terrain, from: {x: number; z: number}, to: {x: number; z: number}, zone: ArkZone, enclosure: number | null, limit: number): Array<{x: number; z: number}> | null {
    if (travel === "fly") return [from, to];
    const half = terrain.half;
    const n = Math.floor((half * 2) / GRID);
    const idx = (x: number, z: number) => {
        const i = Math.floor((x + half) / GRID);
        const j = Math.floor((z + half) / GRID);
        return i < 0 || j < 0 || i >= n || j >= n ? -1 : j * n + i;
    };
    const centre = (k: number) => ({x: -half + ((k % n) + 0.5) * GRID, z: -half + (Math.floor(k / n) + 0.5) * GRID});
    const start = idx(from.x, from.z);
    const goal = idx(to.x, to.z);
    if (start < 0 || goal < 0) return null;
    const up = maxSlopeFor(zone);
    const ok = new Map<number, boolean>();
    // A 2 m cell is open only if each 1 m cell in it is (so a 1 m wall or trunk is never stepped over).
    const open = (k: number) => {
        let v = ok.get(k);
        if (v === undefined) {
            const c = centre(k);
            v = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].every(([dx, dz]) => passable(a, travel, terrain, c.x + dx, c.z + dz, enclosure));
            ok.set(k, v);
        }
        return v;
    };
    // Binary heap of [f, k].
    const heap: Array<[number, number]> = [];
    const push = (f: number, k: number) => {
        heap.push([f, k]);
        let i = heap.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (heap[p][0] <= heap[i][0]) break;
            [heap[p], heap[i]] = [heap[i], heap[p]];
            i = p;
        }
    };
    const pop = (): [number, number] | undefined => {
        const top = heap[0];
        const last = heap.pop();
        if (heap.length && last) {
            heap[0] = last;
            let i = 0;
            for (;;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let m = i;
                if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                if (m === i) break;
                [heap[m], heap[i]] = [heap[i], heap[m]];
                i = m;
            }
        }
        return top;
    };
    const g = new Map<number, number>([[start, 0]]);
    const came = new Map<number, number>();
    const gx = to.x;
    const gz = to.z;
    push(Math.hypot(from.x - gx, from.z - gz), start);
    let expanded = 0;
    while (heap.length) {
        const [, k] = pop()!;
        if (k === goal) break;
        if (++expanded > 40_000) return null;
        const gk = g.get(k)!;
        if (gk > limit) continue;
        const c = centre(k);
        const hk = terrain.height(c.x, c.z);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const i = (k % n) + di;
            const j = Math.floor(k / n) + dj;
            if (i < 0 || j < 0 || i >= n || j >= n) continue;
            const nk = j * n + i;
            if (nk !== goal && !open(nk)) continue;
            const step = Math.hypot(di, dj) * GRID;
            if (travel === "walk" || travel === "amphibious") {
                const nc = centre(nk);
                const rise = terrain.height(nc.x, nc.z) - hk;
                if (rise / step > up) continue;
            }
            const ng = gk + step;
            if (ng < (g.get(nk) ?? Infinity)) {
                g.set(nk, ng);
                came.set(nk, k);
                const nc = centre(nk);
                push(ng + Math.hypot(nc.x - gx, nc.z - gz), nk);
            }
        }
    }
    if (!came.has(goal) && goal !== start) return null;
    const cells: number[] = [];
    for (let k: number | undefined = goal; k !== undefined && k !== start; k = came.get(k)) cells.push(k);
    cells.reverse();
    const points = [from, ...cells.map(centre)];
    points[points.length - 1] = to;
    return points;
}

/** Thin a path to at most `max` points, keeping its ends. */
function thin(points: Array<{x: number; z: number}>, max: number): Array<{x: number; z: number}> {
    if (points.length <= max) return points;
    const out: Array<{x: number; z: number}> = [];
    for (let i = 0; i < max; i++) out.push(points[Math.round((i * (points.length - 1)) / (max - 1))]);
    return out;
}

/** Legs along a path at a pace, from a start time, resting 20 s whenever stamina would dip under 35 %. */
function legsAlong(points: Array<{x: number; z: number}>, start: number, pace: number, mode: number, stamina: number, drainPerS: number, maxLegs: number): {legs: PlanLeg[]; end: number; stamina: number} {
    const legs: PlanLeg[] = [[start, points[0].x, points[0].z, mode]];
    let t = start;
    let e = stamina;
    for (let i = 1; i < points.length && legs.length < maxLegs - 1; i++) {
        const d = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
        const seconds = d / pace;
        if (e - drainPerS * seconds < 0.35 && drainPerS > 0) {
            t += REST_BEAT_S * 1000;
            legs.push([Math.round(t), points[i - 1].x, points[i - 1].z, mode]);
            e = Math.min(1, e + 0.2);
        }
        t += seconds * 1000;
        e = Math.max(0, e - drainPerS * seconds);
        legs.push([Math.round(t), points[i].x, points[i].z, mode]);
    }
    return {legs, end: t, stamina: e};
}

function round2(v: number): number {
    return Math.round(v * 100) / 100;
}

function roundLegs(legs: PlanLeg[]): PlanLeg[] {
    return legs.map(([t, x, z, m]) => [Math.round(t), round2(x), round2(z), m]);
}

export function planRelease(input: ReleaseInput): ReleaseResult {
    const {a, terrain, pose, releasedAt, home, homeDisc, enclosure} = input;
    const here = {x: pose.x, z: pose.z};
    const start: PlanLeg = [releasedAt, round2(pose.x), round2(pose.z), modeIndex(pose.mode === "air" || pose.mode === "swim" ? pose.mode : "ground")];
    if (enclosure !== null) return {plan: {kind: "enclosure", legs: [start], settle_at: null, settle: null}, zone: null, strandedFrom: null};
    const cell = terrain.cell(pose.x, pose.z);
    const s = suitability(a, home, cell).s;
    const dHome = Math.hypot(pose.x - homeDisc.x, pose.z - homeDisc.z);
    const travel = travelOf(a);
    const mode = modeIndex(travel === "fly" ? "air" : travel === "swim" ? "swim" : "ground");
    const pace = paceOf(a, travel, input.stamina);
    const drain = travel === "fly" ? 0.0005 : travel === "swim" ? 0.0015 : 0.001 * (1 + 2 * (1 - s));

    // On the island it crossed to, its home disc is on the other island: no stay and no walk home here (§12.5).
    const crossed = input.crossed;
    const away = Boolean(crossed);

    // 1. Stay.
    if (!away && s >= 0.6 && dHome <= homeDisc.r + 2 * homeRadius(a)) return {plan: {kind: "stay", legs: [start], settle_at: null, settle: null}, zone: null, strandedFrom: null};

    // 2. Retrace a crossing (two islands).
    if (crossed && crossed.canCrossBack && releasedAt - crossed.arrivedAt <= RETRACE_WINDOW_S * 1000) {
        const path = findPath(a, travel, terrain, here, crossed.at, home.zone, null, 2000) ?? [here, crossed.at];
        const along = legsAlong(thin(path, MAX_LEGS - 4), releasedAt, pace, mode, input.stamina, drain, MAX_LEGS - 3);
        const legs = along.legs;
        // Rest until rested enough to cross (the need + 10 points), then the strait leg.
        const restS = Math.max(0, (0.8 - along.stamina) / 0.007);
        let t = along.end + restS * 1000;
        legs.push([Math.round(t), crossed.at.x, crossed.at.z, mode]);
        t += crossed.strait.seconds * 1000;
        legs.push([Math.round(t), crossed.strait.farPoint.x, crossed.strait.farPoint.z, modeIndex("strait")]);
        return {plan: {kind: "retrace", legs: roundLegs(legs), settle_at: Math.round(t), settle: null, island: crossed.strait.to}, zone: null, strandedFrom: null};
    }

    // 3. Homing.
    if (!away && dHome <= a.homingRange) {
        const path = findPath(a, travel, terrain, here, {x: homeDisc.x, z: homeDisc.z}, home.zone, enclosure, a.homingRange * 3);
        if (path) {
            const {legs} = legsAlong(thin(path, MAX_LEGS - 8), releasedAt, pace, mode, input.stamina, drain, MAX_LEGS);
            return {plan: {kind: "homing", legs: roundLegs(legs), settle_at: null, settle: null}, zone: null, strandedFrom: null};
        }
    }

    // 4. Search.
    const random = seededRandom(`${input.animalId}:${releasedAt}`);
    const homeBearing = Math.atan2(homeDisc.x - pose.x, homeDisc.z - pose.z);
    const knowsTheWay = a.canFly || a.body === "m";
    const sight = Math.max(Math.min(a.sight, 60), 6);
    const legs: PlanLeg[] = [start];
    let x = pose.x;
    let z = pose.z;
    let t = releasedAt;
    let best = {x, z, s};
    let searchedS = 0;
    let dayMark = releasedAt + ARK_DAY_S * 1000;
    const endBy = releasedAt + SEARCH_ARK_DAYS * ARK_DAY_S * 1000;
    while (legs.length < MAX_LEGS - 1 && t < endBy) {
        let pick: {x: number; z: number; score: number} | null = null;
        for (let b = 0; b < 8; b++) {
            const bearing = (b / 8) * Math.PI * 2;
            const reach = pace * SLOT_S;
            // Walk out along the bearing until it is blocked.
            let ex = x;
            let ez = z;
            let sumS = 0;
            let count = 0;
            for (let d = GRID; d <= reach; d += GRID) {
                const px = x + Math.sin(bearing) * d;
                const pz = z + Math.cos(bearing) * d;
                if (!passable(a, travel, terrain, px, pz, null)) break;
                ex = px;
                ez = pz;
                if (d <= sight) {
                    sumS += suitability(a, home, terrain.cell(px, pz)).s;
                    count++;
                }
            }
            if (ex === x && ez === z) continue;
            const ahead = count ? sumS / count : 0;
            const score = ahead + (knowsTheWay ? 0.3 * Math.cos(bearing - homeBearing) : 0) + (random() - 0.5) * 0.3;
            if (!pick || score > pick.score) pick = {x: ex, z: ez, score};
        }
        if (!pick) break;
        const d = Math.hypot(pick.x - x, pick.z - z);
        t += (d / pace) * 1000;
        x = pick.x;
        z = pick.z;
        legs.push([Math.round(t), round2(x), round2(z), mode]);
        const sHere = suitability(a, home, terrain.cell(x, z)).s;
        if (sHere > best.s) best = {x, z, s: sHere};
        if (sHere >= 0.6) {
            const zone = terrain.cell(x, z)?.zone ?? null;
            const own = Math.hypot(x - homeDisc.x, z - homeDisc.z) <= homeDisc.r + homeRadius(a);
            return {
                plan: {kind: "search", legs, settle_at: Math.round(t), settle: own ? null : {x: round2(x), z: round2(z), r: round2(homeRadius(a))}},
                zone: own || zone === home.zone ? null : zone,
                strandedFrom: null
            };
        }
        // After each Ark day without finding its place, one more slot of rest.
        if (t >= dayMark) {
            t += SLOT_S * 1000;
            legs.push([Math.round(t), round2(x), round2(z), mode]);
            dayMark += ARK_DAY_S * 1000;
        }
        searchedS = t - releasedAt;
    }
    void searchedS;
    // It settles at the best place it found; stranded if that is poor (S < 0.3).
    if (best.x !== x || best.z !== z) {
        const d = Math.hypot(best.x - x, best.z - z);
        t += (d / pace) * 1000;
        legs.push([Math.round(t), round2(best.x), round2(best.z), mode]);
    }
    const settleAt = Math.round(t);
    const zone = terrain.cell(best.x, best.z)?.zone ?? null;
    return {
        plan: {kind: "search", legs, settle_at: settleAt, settle: {x: round2(best.x), z: round2(best.z), r: round2(homeRadius(a))}},
        zone: zone === home.zone ? null : zone,
        strandedFrom: best.s < 0.3 ? settleAt : null
    };
}
