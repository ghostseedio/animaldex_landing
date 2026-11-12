/**
 * Collisions on the town island (motion pass L5 with Part C's one world, decision 141): the town's behaviour world walks
 * its animals round the town's own colliders (`islands/town/colliders.ts`), the scene's collisions layer reads the two
 * islands' sets as one, the wild island's and the town's never mix (they are apart across the strait), and over a long
 * run no scheduled town animal passes through a town building, wall, fence or zoo fence.
 */

import assert from "node:assert/strict";
import test from "node:test";
import base from "@/ark-scene/fixtures/snapshot-v2.json";
import {withArkIslandsFixture} from "@/ark-scene/fixtures/islands";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {centroid, inPoly} from "@/ark-scene/islands/town/geom";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townWorldSampler} from "@/ark-scene/islands/town/sampler";
import {townWorldOrigin} from "@/ark-scene/islands";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {poseOnTrip, scheduleWorld, tripAt, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {colliderSetFor, unionColliders, type ColliderSet} from "@/ark-scene/collide/colliders";
import {bodyShape} from "@/ark-scene/collide/bodies";
import {attachedOn, tripPhase} from "@/ark-scene/collide/attach";
import {CollideLayer} from "@/ark-scene/collide/layer";
import type {ResolvePose} from "@/ark-scene/collide/resolve";
import {collideBlocked, collideSegmentClear, setIslandColliders} from "@/ark-scene/collide";
import {displayLength} from "@/ark-scene/sizes";
import {bodyHit, type Pose} from "@/lib/ark-collide/metrics";
import type {SimAnimal} from "@/lib/ark-collide/sim";

const origin = townWorldOrigin();
const town = arkIslandSnapshot(decodeArkSnapshot(withArkIslandsFixture(base))!, "town");
const placed = placeTownAnimals(town.animals);
const townSet = townColliderSet(placed.open, origin);
const box = (set: ColliderSet) => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const c of set.list) {
        x0 = Math.min(x0, c.cx - c.reach);
        x1 = Math.max(x1, c.cx + c.reach);
        z0 = Math.min(z0, c.cz - c.reach);
        z1 = Math.max(z1, c.cz + c.reach);
    }
    return {x0, x1, z0, z1};
};

test("the islands' colliders never mix: the town's walk grid has the town's, the wild island's the wild's, and every query asks both", () => {
    const wild = colliderSetFor(null);
    const a = box(wild);
    const b = box(townSet);
    assert.ok(townSet.list.length > 50, `the town's colliders (${townSet.list.length})`);
    assert.ok(a.x1 < b.x0 || b.x1 < a.x0 || a.z1 < b.z0 || b.z1 < a.z0, `apart across the strait: wild ${JSON.stringify(a)}, town ${JSON.stringify(b)}`);
    const world = scheduleWorld(townWorldSampler(placed.open, origin, townSet));
    assert.equal(world.nav.colliders, townSet, "the town's walk grid is exact against the town's own colliders");
    // The scene's layer and the recipes' queries: both sets as one.
    const both = unionColliders(wild, townSet);
    assert.equal(unionColliders(wild, townSet), both, "one object for the same two sets");
    const building = townSet.list.find((c) => c.kind === "building")!;
    const trunk = wild.list.find((c) => c.kind === "trunk")!;
    assert.ok(both.blocked(building.cx, building.cz, 0.2) && both.blocked(trunk.cx, trunk.cz, 0.2));
    try {
        // (A run inside the wild island's side that crosses the town's square still meets its buildings.)
        setIslandColliders({contains: (x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1, set: townSet});
        assert.ok(collideBlocked(building.cx, building.cz, 0.2) && collideBlocked(trunk.cx, trunk.cz, 0.2));
        assert.ok(!collideSegmentClear(building.cx - 200, building.cz, building.cx + 200, building.cz, 0.2), "a long run across the town's square meets its building");
    } finally {
        setIslandColliders(null);
    }
});

test("a long run of the town: no town animal passes through a town building, wall, fence or zoo fence", (t) => {
    const world = scheduleWorld(townWorldSampler(placed.open, origin, townSet));
    const hours = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
    const STILL_WHERE = new Set(["window", "indoor", "pool"]);
    // As the scene schedules them (`index.ts` makeSched, `islands/scene.ts` scheduled / rangeOf).
    type Item = {s: SimAnimal; sched: ScheduleAnimal; last: {x: number; z: number; at: number} | null};
    const items: Item[] = [];
    for (const a of town.animals) {
        const info = placed.town.get(a.id);
        const p = placed.places.get(a.id);
        if (!info || !p || info.still || STILL_WHERE.has(info.where)) continue;
        const length = displayLength(a);
        const profile = behaviourProfile(a.model_slug);
        if (profile.move === "sessile") continue;
        const sched: ScheduleAnimal = {id: a.id, zone: a.zone, home: {x: p.x + origin.x, y: p.ground, z: p.z + origin.z}, length, sea: false, range: Math.max(info.range, 0.6) * 1.5};
        items.push({s: {a, place: p, profile, sched, resident: false, length, body: bodyShape(a.model_slug, length)} as SimAnimal, sched, last: null});
    }
    assert.ok(items.length > 20, `town animals on the schedule: ${items.length}`);
    const baseOf = (it: Item, epoch: number) => {
        const trip = tripAt(world, it.s.profile, it.sched, epoch, hours);
        const pose = poseOnTrip(world, trip, epoch);
        const attached = attachedOn(trip, epoch);
        const phase = tripPhase(trip, epoch);
        const fixed = !pose.aloft && pose.y > Math.max(world.sampler.heightAt(pose.x, pose.z), 0) + 0.3 && (phase === "stay" || phase === "pause") && Boolean(attached);
        return {trip, pose, attached, fixed};
    };
    // The scene's layer over the two islands' sets as one (here the town's alone: no wild animal is near it).
    const layer = new CollideLayer<Item>({
        colliders: () => townSet,
        body: (it) => ({id: it.s.a.id, radius: it.s.body.radius, half: it.s.body.half, height: it.s.body.height, group: it.s.a.id}),
        base: (it, epoch) => {
            const {pose, attached, fixed} = baseOf(it, epoch);
            return {x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, aloft: pose.aloft, asleep: pose.beat === "sleep", attached, fixed};
        },
        everyone: () => items,
        last: (it) => it.last,
        speed: () => 6
    });
    const bound = (id: string, pose: {x: number; z: number}) => {
        const mask = placed.town.get(id)?.enclosure?.mask;
        if (!mask) return;
        const lx = pose.x - origin.x;
        const lz = pose.z - origin.z;
        if (inPoly(mask, lx, lz)) return;
        const c = centroid(mask);
        let lo = 0;
        let hi = 1;
        for (let k = 0; k < 8; k++) {
            const m = (lo + hi) / 2;
            if (inPoly(mask, c.x + (lx - c.x) * m, c.z + (lz - c.z) * m)) lo = m;
            else hi = m;
        }
        pose.x = origin.x + c.x + (lx - c.x) * lo;
        pose.z = origin.z + c.z + (lz - c.z) * lo;
    };
    const from = 1_763_000_000;
    let samples = 0;
    let raw = 0;
    let hits = 0;
    const examples: string[] = [];
    // Two island hours, every 6 s.
    for (let t = from; t < from + 2 * 3600; t += 6) {
        const now = items.map((it) => ({it, ...baseOf(it, t)}));
        for (const n of now) n.it.last = {x: n.pose.x, z: n.pose.z, at: t};
        for (const {it, pose, attached, fixed} of now) {
            const input: ResolvePose = {x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, aloft: pose.aloft, asleep: pose.beat === "sleep", attached, fixed};
            const at = {...layer.apply(it, t, input)};
            // (The scene's hard bound after it: a zoo animal's enclosure mask, `islands/scene.ts` bound.)
            bound(it.s.a.id, at);
            const drawn: Pose = {x: at.x, y: pose.y, z: at.z, yaw: pose.yaw, aloft: pose.aloft, moving: pose.moving, source: "town", attached, fixed};
            samples++;
            if (bodyHit(townSet, it.s, {...drawn, x: pose.x, z: pose.z})) raw++;
            const hit = bodyHit(townSet, it.s, drawn);
            if (!hit) continue;
            hits++;
            if (examples.length < 5) examples.push(`${it.s.a.model_slug} in ${hit.collider.id} by ${hit.depth.toFixed(2)} m at ${t}`);
        }
    }
    t.diagnostic(`${items.length} town animals, ${samples} samples, ${raw} touching before the layer, ${hits} after`);
    assert.ok(samples > 20 * 1000, `samples ${samples}`);
    assert.equal(hits, 0, `town animals passing through: ${examples.join("; ")} (${hits} of ${samples} samples; ${raw} before the layer)`);
});
