#!/usr/bin/env -S npx tsx
/**
 * The collisions' cost (motion pass L5), headless, on a snapshot: run it on the tree before the collisions and after.
 *   - the world's build: the sampler and the walk grid (the scene builds them a slice a frame), and the colliders;
 *   - the schedule: every scheduled animal's trips over N slots (each slot's paths are worked out once);
 *   - the poses: every animal's pose at M moments, without and with the collisions' layer (push out, clusters eased).
 *
 *   npx tsx scripts/ark-collide-bench.mts --snapshot <snapshot.json> [--slots 6] [--moments 30]
 */

import {readFileSync} from "node:fs";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";

const args = process.argv.slice(2);
const opt = (name: string, fallback?: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
};
const snapshot = decodeArkSnapshot(JSON.parse(readFileSync(opt("snapshot")!, "utf8")))!;
const slots = Number(opt("slots", "6"));
const moments = Number(opt("moments", "30"));
const now = () => performance.now();

const t0 = now();
const {buildSim} = await import("@/lib/ark-collide/sim");
const sim = buildSim(snapshot.animals);
const built = now() - t0;
const nav = sim.world.nav as unknown as {colliders?: unknown; clearanceAt?: (x: number, z: number) => number; region?: (x: number, z: number, s?: number, r?: number) => number};
const t1 = now();
// (The grid's cell clearance, worked out the first time a path asks: here, at once.)
if (nav.colliders && typeof (nav as {path?: unknown}).path === "function") (sim.world.nav as unknown as {path: (a: {x: number; z: number}, b: {x: number; z: number}, k: string, d: number, n: number, s: number, r: number) => unknown}).path({x: 0, z: 0}, {x: 30, z: 30}, "walk", 0.5, 2000, 0.9, 0.3);
const clearance = now() - t1;
const {tripAt, SLOT_SECONDS} = await import("@/ark-scene/behaviour-schedule");
const start = Math.floor(Date.UTC(2026, 10, 12, 6) / 1000);
const scheduled = sim.animals.filter((s) => s.sched);
const t2 = now();
for (let k = 0; k < slots; k++) for (const s of scheduled) tripAt(sim.world, s.profile, s.sched!, start + k * SLOT_SECONDS, sim.hoursAt, s.a.activity);
const trips = now() - t2;
const metrics = await import("@/lib/ark-collide/metrics");
const {colliderSetFor} = await import("@/ark-scene/collide/colliders");
const {hamletPlotsFor} = await import("@/ark-scene/map/hamlet");
const set = colliderSetFor(hamletPlotsFor(snapshot.animals));
const raw = metrics.rawPosesAt(sim, true);
const resolved = (metrics as Record<string, unknown>).resolvedPosesAt ? metrics.resolvedPosesAt(sim, set) : null;
// (Warm the moments' trips first: the pose cost alone.)
for (let k = 0; k < moments; k++) raw(start + slots * SLOT_SECONDS - SLOT_SECONDS + k * 2, sim.animals);
const t3 = now();
let count = 0;
for (let k = 0; k < moments; k++) count += raw(start + slots * SLOT_SECONDS - SLOT_SECONDS + k * 2, sim.animals).length;
const rawMs = now() - t3;
let resolvedMs = 0;
if (resolved) {
    const t4 = now();
    for (let k = 0; k < moments; k++) resolved(start + slots * SLOT_SECONDS - SLOT_SECONDS + k * 2, sim.animals);
    resolvedMs = now() - t4;
}
const perPose = (ms: number) => (count ? (ms * 1000) / count : 0);
console.log(JSON.stringify({
    animals: snapshot.animals.length,
    scheduled: scheduled.length,
    worldBuildMs: Math.round(built),
    gridClearanceMs: Math.round(clearance),
    colliders: set.list.length,
    tripsMs: Math.round(trips),
    tripMsEach: +(trips / (slots * scheduled.length)).toFixed(3),
    poses: count,
    poseUsEach: +perPose(rawMs).toFixed(2),
    layerUsEach: resolved ? +(perPose(resolvedMs) - perPose(rawMs)).toFixed(2) : null
}, null, 1));
