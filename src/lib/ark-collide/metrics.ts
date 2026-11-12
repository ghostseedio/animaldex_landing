/**
 * The collision metrics (motion pass L5, the owner's "animals walk through fences and rocks"): over a stretch of the
 * shared clock, every animal's pose as the scene draws it, measured against the world's solid things
 * (`collide/colliders.ts`) and against each other.
 *
 * - Pass-throughs: a body (its capsule: `collide/bodies.ts`) overlapping a fence, a building, a trunk, a rock, a log or a
 *   hay bale by more than `PASS_TOLERANCE` (a quarter of its radius, at least 3 cm: touching is not passing through),
 *   within its height span (on a rock's top, under a fence's rails is clear). By the kind of thing and by what moved it.
 * - Fence crossings: an animal on the ground that is on the other side of a fence a sample later (a step through it),
 *   checked on its finely sampled way (not the chord between samples); a climber on its climb is climbing over it.
 * - Overlaps: two bodies on the ground (or two aloft) overlapping by more than `OVERLAP_TOLERANCE` of the smaller one's
 *   radius, within each other's height. Partners on a host and a recipe's own pair (a predator reaching its prey) are
 *   not overlaps.
 */

import {bodyMeets, colliderDistance, segmentDistance, spansCollider, type Collider, type ColliderKind, type ColliderSet} from "@/ark-scene/collide/colliders";
import {maxSlopeOf, poseOnTrip, restingAtRoost, tripAt, SLOT_SECONDS} from "@/ark-scene/behaviour-schedule";
import {attachedOn, tripPhase} from "@/ark-scene/collide/attach";
import type {RecipePose} from "@/ark-scene/behaviour-recipes";
import {residentAt, type Sim, type SimAnimal} from "@/lib/ark-collide/sim";
import {allowedOverlap, inContact, overlapOf, pushOut, separateCluster, type ResolveBody} from "@/ark-scene/collide/resolve";
import {sleepStyle} from "@/ark-scene/sleep";

/** A body overlapping a solid thing by less than this is touching it, not passing through. */
export function passTolerance(radius: number): number {
    return Math.max(0.03, radius * 0.25);
}
/** Two bodies overlapping by less than this share of the smaller's radius are touching. */
export const OVERLAP_TOLERANCE = 0.25;

export type Pose = {
    x: number;
    y: number;
    z: number;
    yaw: number;
    aloft: boolean;
    moving: boolean;
    source: string;
    /** The animal its recipe pairs it with now (a predator reaching its prey): never an overlap. */
    partner?: string | null;
    /**
     * The surface points it is on (a gecko on bark, a toad in a rock's crevice, a bird on a branch) or climbing between:
     * the thing each is on is its surface, not something it passes through (a rock's box is its bounds, its face inside them).
     */
    attached?: Array<{x: number; z: number; r?: number; host?: string}> | null;
    /** Asleep at its roost (a sleeping huddle lies together). */
    asleep?: boolean;
    /** Perched up on a surface (held there by the collisions' layer). */
    fixed?: boolean;
};

/** Where it is now, as the scene draws it, and what moved it there (a leg's mode, a stay's beat, a recipe's block). */
export type PoseOf = (s: SimAnimal, epoch: number) => Pose | null;
/** Everyone's poses at one moment (the collisions' layer needs everyone at once: separation is between neighbours). */
export type PosesAt = (epoch: number, list: readonly SimAnimal[]) => Array<{s: SimAnimal; p: Pose}>;

/** The behaviour schedule's pose (its recipe episode laid over), and the hamlet residents', as the scene draws them. */
export function schedulePoseOf(sim: Sim, routed = false): PoseOf {
    return (s, epoch) => {
        if (s.place.host) return null;
        if (s.sched) {
            const trip = tripAt(sim.world, s.profile, s.sched, epoch, sim.hoursAt, s.a.activity);
            const p = poseOnTrip(sim.world, trip, epoch) as RecipePose;
            const act = p.act;
            const partner = (act as {with?: string | null} | null | undefined)?.with ?? null;
            const attached = attachedOn(trip, epoch);
            const phase = tripPhase(trip, epoch);
            const fixed = (phase === "stay" || phase === "pause") && !p.aloft && Boolean(attached) && p.y > Math.max(sim.world.sampler.heightAt(p.x, p.z), 0) + 0.3;
            // (Asleep or resting in its den, burrow, cave, crevice or tree hole: out of sight, not measured.)
            const hidden = (trip.doing === "sleep" || trip.doing === "rest" || trip.doing === "to_roost") && epoch >= trip.arrive && restingAtRoost(sim.world, s.profile, s.sched, epoch, sim.hoursAt, s.a.activity).enclosed;
            if (hidden) return null;
            return {x: p.x, y: p.y, z: p.z, yaw: p.yaw, aloft: p.aloft, moving: p.moving, source: act ? `recipe:${act.recipe}:${act.block}` : `${tripPhase(trip, epoch)}:${p.beat}`, attached, partner, asleep: trip.doing === "sleep" && epoch >= trip.arrive, fixed};
        }
        if (s.resident) {
            const at = residentAt(sim, s, epoch, routed);
            if (!at.out) return null;
            return {x: at.x, y: sim.world.sampler.heightAt(at.x, at.z), z: at.z, yaw: at.yaw, aloft: false, moving: at.moving, source: at.moving ? "hamlet:door" : "hamlet:spot"};
        }
        return null;
    };
}

/** The poses as the schedule (and the hamlet) give them, each on its own: what the scene drew before the collisions' layer. */
export function rawPosesAt(sim: Sim, routed = false): PosesAt {
    const poseOf = schedulePoseOf(sim, routed);
    return (epoch, list) => {
        const out: Array<{s: SimAnimal; p: Pose}> = [];
        for (const s of list) {
            const p = poseOf(s, epoch);
            if (p) out.push({s, p});
        }
        return out;
    };
}

const HUDDLES = new Set(["huddle", "pile", "cluster", "row"]);

/** Its body as the collisions' layer reads it. */
export function resolveBodyOf(s: SimAnimal): ResolveBody {
    return {id: s.a.id, radius: s.body.radius, half: s.body.half, height: s.body.height, group: s.place.leader ?? s.a.id, huddles: HUDDLES.has(sleepStyle(s.a.model_slug).social)};
}

/**
 * The poses with the collisions' layer on (`collide/resolve.ts`, as the scene applies it): each out of anything solid,
 * then eased off its neighbours (their poses out of anything solid, at the same moment), never into anything solid.
 */
export function resolvedPosesAt(sim: Sim, set: ColliderSet): PosesAt {
    const raw = rawPosesAt(sim, true);
    const bodies = new Map<SimAnimal, ResolveBody>();
    const bodyOf = (s: SimAnimal) => {
        let b = bodies.get(s);
        if (!b) bodies.set(s, (b = resolveBodyOf(s)));
        return b;
    };
    return (epoch, list) => {
        const base = raw(epoch, list);
        const placed = base.map(({s, p}) => {
            const out = pushOut(set, bodyOf(s), p);
            return {s, p: {...p, x: out.x, z: out.z}};
        });
        // Clusters: everyone touching (or nearly) anyone in it, transitively.
        const grid = new Map<number, number[]>();
        const cell = (v: number) => Math.floor(v / 4);
        let maxReach = 0;
        for (const {s} of placed) maxReach = Math.max(maxReach, s.body.half + s.body.radius);
        placed.forEach(({p}, i) => {
            const k = (cell(p.x) + 32768) * 65536 + cell(p.z) + 32768;
            const at = grid.get(k);
            if (at) at.push(i);
            else grid.set(k, [i]);
        });
        const parent = placed.map((_, i) => i);
        const find = (i: number): number => {
            while (parent[i] !== i) i = parent[i] = parent[parent[i]];
            return i;
        };
        placed.forEach(({s, p}, i) => {
            const body = bodyOf(s);
            const span = Math.ceil((body.half + body.radius + maxReach + 0.5) / 4);
            const cx = cell(p.x);
            const cz = cell(p.z);
            for (let di = -span; di <= span; di++) {
                for (let dj = -span; dj <= span; dj++) {
                    for (const j of grid.get((cx + di + 32768) * 65536 + cz + dj + 32768) ?? []) {
                        if (j <= i) continue;
                        if (inContact(body, p, bodyOf(placed[j].s), placed[j].p)) parent[find(j)] = find(i);
                    }
                }
            }
        });
        const clusters = new Map<number, number[]>();
        placed.forEach((_, i) => {
            const root = find(i);
            const list = clusters.get(root);
            if (list) list.push(i);
            else clusters.set(root, [i]);
        });
        const out = placed.slice();
        for (const members of Array.from(clusters.values())) {
            if (members.length < 2) continue;
            const at = separateCluster(set, members.map((i) => ({body: bodyOf(placed[i].s), pose: placed[i].p})));
            members.forEach((i, k) => {
                out[i] = {s: placed[i].s, p: {...placed[i].p, x: at[k].x, z: at[k].z}};
            });
        }
        return out;
    };
}

export type Hit = {id: string; slug: string; t: number; kind: ColliderKind; collider: string; depth: number; source: string; x: number; z: number};

export type CollideReport = {
    animals: number;
    measured: number;
    seconds: number;
    step: number;
    samples: number;
    passThrough: {animals: number; samples: number; byKind: Record<string, number>; bySource: Record<string, number>; byKindSource: Record<string, number>; bySlug: Record<string, number>; worst: Hit[]};
    fenceCrossings: {animals: number; count: number; bySource: Record<string, number>; examples: Hit[]};
    /** On ground twice as steep as its walk takes (a cliff face), not climbing, not on a surface. */
    cliffs: {animals: number; samples: number; bySource: Record<string, number>; examples: Hit[]};
    overlaps: {pairs: number; samples: number; bySource: Record<string, number>; examples: Array<{a: string; b: string; t: number; depth: number; source: string}>};
    ms: number;
};

/** Points along a body's spine (its capsule's), at most its radius apart, middle first. */
function spine(s: SimAnimal, p: Pose): Array<[number, number]> {
    const {half, radius} = s.body;
    if (half < 1e-3) return [[p.x, p.z]];
    const n = Math.min(Math.ceil(half / Math.max(radius, 0.02)), 4);
    const fx = Math.sin(p.yaw);
    const fz = Math.cos(p.yaw);
    const out: Array<[number, number]> = [[p.x, p.z]];
    for (let k = 1; k <= n; k++) {
        const d = (half * k) / n;
        out.push([p.x + fx * d, p.z + fz * d], [p.x - fx * d, p.z - fz * d]);
    }
    return out;
}

/** The deepest overlap of a body with a solid thing now (its capsule, its height span), or null. */
/** The ground's rise over run at a point: over a metre each way along x and z, the steeper (the walk grid's measure). */
function groundSlope(sim: Sim, x: number, z: number): number {
    const h = (px: number, pz: number) => sim.world.sampler.heightAt(px, pz);
    return Math.max(Math.abs(h(x + 1, z) - h(x - 1, z)), Math.abs(h(x, z + 1) - h(x, z - 1))) / 2;
}

export function bodyHit(set: ColliderSet, s: SimAnimal, p: Pose, scratch: Collider[] = []): {collider: Collider; depth: number} | null {
    const r = s.body.radius;
    let best: {collider: Collider; depth: number} | null = null;
    const on = p.attached;
    for (const [x, z] of spine(s, p)) {
        for (const c of set.near(x, z, r + 0.01, scratch)) {
            if (c.soft || !bodyMeets(c, r) || !spansCollider(c, p.y, s.body.height)) continue;
            // (Perched up in a tree: the trunk beside it is the tree it is in.)
            if (p.fixed && c.kind === "trunk") continue;
            // (What it is on, it is on: the trunk under a gecko, the rock round a toad in its crevice.)
            if (on && on.some((q) => (q.host && (c.id === `trunk:${q.host}` || c.id === `rock:${q.host}`)) || colliderDistance(c, q.x, q.z) < (q.r ?? 0.15))) continue;
            const depth = r - colliderDistance(c, x, z);
            if (depth > passTolerance(r) && (!best || depth > best.depth)) best = {collider: c, depth};
        }
    }
    return best;
}

function segmentsCross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
    const d1 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx);
    const d2 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
    const d3 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    const d4 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
    return d1 * d2 < 0 && d3 * d4 < 0;
}

const bump = (map: Record<string, number>, key: string) => (map[key] = (map[key] ?? 0) + 1);
const sourceKey = (source: string) => source.replace(/^recipe:([^:]+):.*/, "recipe:$1").replace(/:(walk|run|step|pause|scan|bite|chew|peck|graze|rest|sleep|play|stalk|climb|fly|glide|swim|drink|preen|shake|enter_water|exit_water)$/, ":$1");

/**
 * Measure `seconds` of the shared clock from `from`, every `step` seconds, for the animals `pick` keeps (all by
 * default). Overlaps are counted among everyone measured at the same moment.
 */
export function measureCollisions(sim: Sim, set: ColliderSet, posesAt: PosesAt, options: {from: number; seconds: number; step: number; pick?: (s: SimAnimal) => boolean; overlaps?: boolean; worst?: number}): CollideReport {
    const started = Date.now();
    const list = sim.animals.filter((s) => (options.pick ? options.pick(s) : true));
    const report: CollideReport = {
        animals: sim.animals.length,
        measured: 0,
        seconds: options.seconds,
        step: options.step,
        samples: 0,
        passThrough: {animals: 0, samples: 0, byKind: {}, bySource: {}, byKindSource: {}, bySlug: {}, worst: []},
        fenceCrossings: {animals: 0, count: 0, bySource: {}, examples: []},
        cliffs: {animals: 0, samples: 0, bySource: {}, examples: []},
        overlaps: {pairs: 0, samples: 0, bySource: {}, examples: []},
        ms: 0
    };
    const bodies = new Map<SimAnimal, ResolveBody>();
    const bodyOf = (s: SimAnimal) => {
        let b = bodies.get(s);
        if (!b) bodies.set(s, (b = resolveBodyOf(s)));
        return b;
    };
    const hitAnimals = new Set<string>();
    const crossAnimals = new Set<string>();
    const cliffAnimals = new Set<string>();
    const pairs = new Set<string>();
    const last = new Map<SimAnimal, Pose>();
    const scratch: Collider[] = [];
    const fences: Collider[] = [];
    const single = schedulePoseOf(sim, true);
    /** Its own pose (before the layer's easing) between two samples, a tenth of a metre's walk apart at most: does it cross the fence? */
    const crossesFinely = (c: Collider, s: SimAnimal, t0: number, t1: number, step: number): boolean => {
        if (c.shape !== "segment") return false;
        const n = Math.min(Math.max(Math.ceil(step / 0.1), 4), 60);
        let last = single(s, t0);
        for (let k = 1; k <= n; k++) {
            const p = single(s, t0 + ((t1 - t0) * k) / n);
            if (last && p && !p.aloft && !last.aloft && Math.hypot(p.x - last.x, p.z - last.z) < 1.5 && segmentsCross(last.x, last.z, p.x, p.z, c.ax, c.az, c.bx, c.bz)) return true;
            last = p;
        }
        return false;
    };
    const measured = new Set<string>();
    const worstN = options.worst ?? 40;
    const keepWorst = (hit: Hit) => {
        const worst = report.passThrough.worst;
        if (worst.length < worstN) worst.push(hit);
        else if (hit.depth > worst[worst.length - 1].depth) worst[worst.length - 1] = hit;
        else return;
        worst.sort((a, b) => b.depth - a.depth);
    };
    for (let t = options.from; t < options.from + options.seconds; t += options.step) {
        const now = posesAt(t, list);
        const seen = new Set<SimAnimal>();
        for (const {s, p} of now) {
            seen.add(s);
            measured.add(s.a.id);
            report.samples++;
            const hit = bodyHit(set, s, p, scratch);
            if (hit) {
                report.passThrough.samples++;
                hitAnimals.add(s.a.id);
                bump(report.passThrough.byKind, hit.collider.kind);
                bump(report.passThrough.bySource, sourceKey(p.source));
                bump(report.passThrough.byKindSource, `${hit.collider.kind}<${sourceKey(p.source)}`);
                bump(report.passThrough.bySlug, s.a.model_slug);
                keepWorst({id: s.a.id, slug: s.a.model_slug, t, kind: hit.collider.kind, collider: hit.collider.id, depth: Math.round(hit.depth * 1000) / 1000, source: p.source, x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100});
            }
            // On a cliff face: a walker on the ground (not climbing, not on a surface) where the ground is twice as steep
            // as its walk takes. The ground's own rise over a metre each way (the walk grid's measure), not the shading
            // normal: on the merged scenery that normal carries sub-metre detail (2026-11-12: an anoa herd asleep on
            // ground rising 0.25 in 1 read 3.3, its normal).
            if (!p.aloft && !p.attached && !p.source.startsWith("surface") && s.sched && p.y > 0.05) {
                const ground = sim.world.sampler.heightAt(p.x, p.z);
                const walker = s.profile.move !== "fly" && s.profile.move !== "swim";
                if (walker && Math.abs(p.y - ground) < 0.1 && groundSlope(sim, p.x, p.z) > maxSlopeOf(s.sched) * 2) {
                    report.cliffs.samples++;
                    cliffAnimals.add(s.a.id);
                    bump(report.cliffs.bySource, sourceKey(p.source));
                    if (report.cliffs.examples.length < 20) report.cliffs.examples.push({id: s.a.id, slug: s.a.model_slug, t, kind: "rock", collider: "cliff", depth: Math.round(groundSlope(sim, p.x, p.z) * 100) / 100, source: p.source, x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100});
                }
            }
            // A step through a fence between two samples, on the ground, not a jump between slots.
            const before = last.get(s);
            last.set(s, p);
            // (A climber on its climb goes over a fence, up its posts: climbing, which its body plan does.)
            if (!before || before.aloft || p.aloft || p.source.startsWith("surface") || before.source.startsWith("surface")) continue;
            const move = Math.hypot(p.x - before.x, p.z - before.z);
            if (move < 1e-3 || move > SLOT_SECONDS) continue;
            for (const c of set.near((p.x + before.x) / 2, (p.z + before.z) / 2, move / 2 + 0.1, fences)) {
                // (Within the fence's height on both sides: a bird coming down onto its top, or off it, goes over it.)
                // (Within 3 cm of a rail's underside is under it, the pass-throughs' own tolerance: a crocodile 0.39 m tall
                // under a paddock's rails 0.4 m up, on ground 2 cm higher than the rail's foot.)
                const tall = Math.max(s.body.height - 0.03, 0.01);
                if (c.kind !== "fence" || c.shape !== "segment" || !bodyMeets(c, s.body.radius) || !spansCollider(c, p.y, tall) || !spansCollider(c, before.y, tall)) continue;
                if (!segmentsCross(before.x, before.z, p.x, p.z, c.ax, c.az, c.bx, c.bz)) continue;
                // (Its middle within the fence's own thickness is on it: an owl perched along a fence's top, hopping on.)
                if (colliderDistance(c, p.x, p.z) <= 0 || colliderDistance(c, before.x, before.z) <= 0) continue;
                // (The chord between two samples of a run round a garden's corner cuts the corner: the run itself, finely
                // sampled, must cross the fence to count.)
                if (move > 0.5 && !crossesFinely(c, s, t - options.step, t, options.step)) continue;
                report.fenceCrossings.count++;
                crossAnimals.add(s.a.id);
                bump(report.fenceCrossings.bySource, sourceKey(p.source));
                if (report.fenceCrossings.examples.length < 20) report.fenceCrossings.examples.push({id: s.a.id, slug: s.a.model_slug, t, kind: "fence", collider: c.id, depth: 0, source: p.source, x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100});
                break;
            }
        }
        for (const s of Array.from(last.keys())) if (!seen.has(s)) last.delete(s);
        if (options.overlaps === false) continue;
        // Overlaps: a 2 m grid of everyone measured now.
        const grid = new Map<number, number[]>();
        const cellOf = (x: number) => Math.floor(x / 2);
        now.forEach(({p}, i) => {
            const k = (cellOf(p.x) + 32768) * 65536 + cellOf(p.z) + 32768;
            const at = grid.get(k);
            if (at) at.push(i);
            else grid.set(k, [i]);
        });
        let maxReach = 0;
        for (const {s} of now) maxReach = Math.max(maxReach, s.body.half + s.body.radius);
        for (let i = 0; i < now.length; i++) {
            const {s: a, p: pa} = now[i];
            const reachA = a.body.half + a.body.radius;
            const cx = cellOf(pa.x);
            const cz = cellOf(pa.z);
            const span = Math.ceil((reachA + maxReach + 0.5) / 2);
            for (let di = -span; di <= span; di++) {
                for (let dj = -span; dj <= span; dj++) {
                    for (const j of grid.get((cx + di + 32768) * 65536 + cz + dj + 32768) ?? []) {
                        if (j <= i) continue;
                        const {s: b, p: pb} = now[j];
                        const o = overlapOf(bodyOf(a), pa, bodyOf(b), pb);
                        if (o.depth <= 0) continue;
                        // (Touching, a recipe's pair, a sleeping huddle: not an overlap.)
                        const allowed = Math.max(allowedOverlap(bodyOf(a), pa, bodyOf(b), pb), OVERLAP_TOLERANCE * Math.min(a.body.radius, b.body.radius) + 0.005);
                        if (o.depth <= allowed) continue;
                        const depth = o.depth;
                        report.overlaps.samples++;
                        const key = a.a.id < b.a.id ? `${a.a.id}|${b.a.id}` : `${b.a.id}|${a.a.id}`;
                        pairs.add(key);
                        const src = `${sourceKey(pa.source)}+${sourceKey(pb.source)}`;
                        bump(report.overlaps.bySource, src);
                        if (report.overlaps.examples.length < 30) report.overlaps.examples.push({a: `${a.a.model_slug}`, b: `${b.a.model_slug}`, t, depth: Math.round(depth * 1000) / 1000, source: src});
                    }
                }
            }
        }
    }
    report.measured = measured.size;
    report.passThrough.animals = hitAnimals.size;
    report.fenceCrossings.animals = crossAnimals.size;
    report.cliffs.animals = cliffAnimals.size;
    report.overlaps.pairs = pairs.size;
    report.ms = Date.now() - started;
    return report;
}
