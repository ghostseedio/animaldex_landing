/**
 * A town cat up on a garden wall (`islands/town/cat-walls.ts`, gfx pass 1, the owner 2026-11-16): by rule over the whole
 * island, every wall stretch is a garden wall's coping with nothing over it; every trip leaves its schedule's resting
 * spot and comes back to it, its ground legs clear of every collider and of water, its feet on the coping while up, and
 * never in a building; and it is pure (the same trips for every viewer).
 */

import assert from "node:assert/strict";
import test from "node:test";
import base from "@/ark-scene/fixtures/snapshot-v2.json";
import {withArkIslandsFixture} from "@/ark-scene/fixtures/islands";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townWorldSampler} from "@/ark-scene/islands/town/sampler";
import {townWorldOrigin} from "@/ark-scene/islands";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {townAreas} from "@/ark-scene/islands/town/areas";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {poseOnTrip, scheduleWorld, tripAt, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {colliderDistance, spansCollider} from "@/ark-scene/collide/colliders";
import {displayLength} from "@/ark-scene/sizes";
import {segmentDistance} from "@/ark-scene/collide/colliders";
import {CAT_HEIGHT, CAT_RADIUS, WALL_CATS, WALL_SLOT, catWallsFrom, clearAt, dryAt, townWater, wallPose, wallStretches, wallTrip, WallIndex, type SchedAt, type WallHost, type WallTrip} from "@/ark-scene/islands/town/cat-walls";

const origin = townWorldOrigin();
const plan = townPlan();
const town = arkIslandSnapshot(decodeArkSnapshot(withArkIslandsFixture(base))!, "town");
const placed = placeTownAnimals(town.animals);
const set = townColliderSet(placed.open, origin);
const water = townWater(plan, placed.open);
const stretches = wallStretches(plan, origin, set, water);
const host: WallHost = {
    index: new WallIndex(stretches),
    set,
    groundAt: (x, z) => Math.max(townHeight(x - origin.x, z - origin.z), 0),
    dry: (x, z) => dryAt(water, x - origin.x, z - origin.z)
};
const walls = (id: string) => plan.hedges.filter((h) => h.kind === "wall" && h.id === id);

test("the cat that does it is the catalogue's, by its model slug", () => {
    assert.deepEqual(Array.from(WALL_CATS), ["domestic-cat"]);
});

test("every wall stretch is on a garden wall's coping, with nothing but the wall at a cat's height over it", () => {
    assert.ok(stretches.length > 100, `stretches: ${stretches.length}`);
    for (const w of stretches) {
        // (Two parcels can share a wall's id: the one whose line it is on.)
        const on = (h: (typeof plan.hedges)[number], x: number, z: number) => h.line.slice(1).some((b, i) => segmentDistance(x - origin.x, z - origin.z, h.line[i].x, h.line[i].z, b.x, b.z) < 0.01);
        const hedge = walls(w.id.split(":")[0]).find((h) => on(h, w.ax, w.az) && on(h, w.bx, w.bz));
        assert.ok(hedge, `${w.id}: on a garden wall's line`);
        const mx = (w.ax + w.bx) / 2 - origin.x;
        const mz = (w.az + w.bz) / 2 - origin.z;
        assert.ok(Math.abs(w.y - (townHeight(mx, mz) + hedge.height + 0.1)) < 0.06, `${w.id}: on the coping (${w.y.toFixed(2)})`);
        for (let s = 0; s <= w.len; s += 0.25) {
            const x = w.ax + ((w.bx - w.ax) * s) / w.len;
            const z = w.az + ((w.bz - w.az) * s) / w.len;
            for (const c of set.near(x, z, 1)) {
                if (c.soft || c.id.startsWith(`town:${hedge.id}:`)) continue;
                assert.ok(!(colliderDistance(c, x, z) < CAT_RADIUS && spansCollider(c, w.y, CAT_HEIGHT)), `${w.id} at ${s.toFixed(2)} m: ${c.id} over the top`);
            }
        }
    }
});

/** Checks one trip from start to end, every 0.1 s. */
function checkTrip(trip: WallTrip, start: SchedAt, label: string) {
    const first = wallPose(trip, trip.t0)!;
    assert.ok(Math.hypot(first.x - start.x, first.z - start.z) < 1e-6, `${label}: leaves from its spot`);
    const last = wallPose(trip, trip.t1 - 1e-3)!;
    assert.ok(Math.hypot(last.x - start.x, last.z - start.z) < 0.02, `${label}: back at its spot`);
    const wall = stretches.find((w) => w.id === trip.wall)!;
    let up = 0;
    for (let t = trip.t0; t < trip.t1; t += 0.1) {
        const p = wallPose(trip, t)!;
        // Never in a building, at any moment.
        for (const c of set.near(p.x, p.z, 0.6)) if (c.kind === "building") assert.ok(!(colliderDistance(c, p.x, p.z) < CAT_RADIUS * 0.5 && spansCollider(c, p.y, CAT_HEIGHT)), `${label} at ${(t - trip.t0).toFixed(1)} s: in ${c.id}`);
        if (!p.onWall) {
            assert.ok(host.dry(p.x, p.z), `${label}: dry ground`);
            assert.ok(clearAt(set, p.x, p.z, host.groundAt(p.x, p.z) + 0.05), `${label} at ${(t - trip.t0).toFixed(1)} s: clear on the ground`);
        } else if (p.beat !== "run") {
            // Up: its feet on the coping (on the stretch's line, at its height).
            up++;
            assert.ok(segmentDistance(p.x, p.z, wall.ax, wall.az, wall.bx, wall.bz) < 0.02 && Math.abs(p.y - wall.y) < 1e-6, `${label}: feet on the coping`);
        }
    }
    assert.ok(up > 100, `${label}: up there a while`);
}

test("over the house gardens: every trip goes from its spot onto a coping and back, clear, dry, never in a building", () => {
    const spots = townAreas().spots.filter((s) => s.area === "house" && s.where !== "indoor" && s.where !== "window");
    assert.ok(spots.length > 100, `garden spots: ${spots.length}`);
    let trips = 0;
    let dozes = 0;
    for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        const at: SchedAt = {x: s.x + origin.x, y: townHeight(s.x, s.z), z: s.z + origin.z, yaw: 0.3, moving: false, aloft: false, doing: "rest"};
        for (let slot = 1000; slot < 1006; slot++) {
            const trip = wallTrip(`cat-${i}`, slot, 0.6, () => at, host);
            if (!trip) continue;
            trips++;
            if (trip.phases.some((p) => p.kind === "doze")) dozes++;
            assert.ok(trip.t0 >= slot * WALL_SLOT && trip.t1 <= (slot + 1) * WALL_SLOT, "inside its slot");
            checkTrip(trip, at, `cat-${i} slot ${slot}`);
            assert.deepEqual(wallTrip(`cat-${i}`, slot, 0.6, () => at, host), trip, "pure: the same trip every time");
        }
    }
    assert.ok(trips > 100, `trips: ${trips}`);
    console.log(`# gardens: ${trips} trips, ${dozes} with a doze`);
    assert.ok(dozes > trips * 0.3 && dozes < trips * 0.7, "about half doze up there (the slot's hash, well mixed)");
});

test("on the real schedule: town cats go up walls from where their schedule rests them, and only then", () => {
    const world = scheduleWorld(townWorldSampler(placed.open, origin, set));
    const hours = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
    const cats = town.animals.filter((a) => a.model_slug === "domestic-cat");
    const profile = behaviourProfile("domestic-cat");
    let trips = 0;
    let tried = 0;
    // (Many of the fixture's town animals, as cats: each placed animal's spot on the schedule as a cat's would be.)
    const pool = cats.length >= 10 ? cats : town.animals.filter((a) => placed.places.get(a.id) && placed.town.get(a.id)?.area === "house");
    for (const a of pool.slice(0, 40)) {
        const info = placed.town.get(a.id);
        const p = placed.places.get(a.id);
        if (!info || !p || info.still) continue;
        const sched: ScheduleAnimal = {id: a.id, zone: a.zone, home: {x: p.x + origin.x, y: p.ground, z: p.z + origin.z}, length: displayLength(a), sea: false, range: Math.max(info.range, 0.6) * 1.5};
        const schedule = (epoch: number): SchedAt => {
            const trip = tripAt(world, profile, sched, epoch, hours);
            return {...poseOnTrip(world, trip, epoch), doing: trip.doing};
        };
        for (let slot = 2_400_000; slot < 2_400_040; slot++) {
            tried++;
            const trip = wallTrip(a.id, slot, 0.6, schedule, host);
            if (!trip) continue;
            trips++;
            const start = schedule(trip.t0);
            const end = schedule(trip.t1);
            assert.ok(!start.moving && !end.moving && Math.hypot(start.x - end.x, start.z - end.z) <= 0.25, `${a.id}: still at one spot either side`);
            checkTrip(trip, start, `${a.id} slot ${slot}`);
        }
    }
    assert.ok(tried > 200, `tried ${tried}`);
    assert.ok(trips > 0, `trips on the real schedule: ${trips} of ${tried}`);
    console.log(`# real schedule: ${trips} trips of ${tried} cat-slots`);
});

test("the scene's side keeps one trip a slot, and only for the cats", () => {
    const walled = catWallsFrom(plan, origin, set, placed.open);
    const spot = townAreas().spots.find((s) => s.area === "house" && s.where !== "indoor")!;
    const at: SchedAt = {x: spot.x + origin.x, y: townHeight(spot.x, spot.z), z: spot.z + origin.z, yaw: 0, moving: false, aloft: false, doing: "rest"};
    assert.equal(walled.pose("domestic-dog", "x", 1000 * WALL_SLOT + 100, 0.6, () => at), null);
    for (let slot = 1000; slot < 1040; slot++) {
        const trip = walled.tripAt("cat-a", slot * WALL_SLOT + WALL_SLOT - 1, 0.6, () => at);
        if (trip) assert.ok(trip.t0 <= slot * WALL_SLOT + WALL_SLOT - 1);
    }
});

test("the domestic cat's lying clips (bent from a mid-stride rest pose) are held; its standing clips play; other species untouched", async () => {
    const {rigClip} = await import("@/ark-scene/rig-clips");
    const clip = {frames: 24, seconds: 1, loop: true, pass: true};
    const clips = {idle: clip, walk: clip, run: clip, groom: clip, lie: clip, sleep: clip, sleep_curl: clip, sleep_side: clip, lie_down: clip, get_up: clip};
    const manifest = {flight: true, species: {"domestic-cat": {state: "passed", clips}, "domestic-dog": {state: "passed", clips}}};
    for (const name of ["idle", "walk", "run", "groom"]) assert.ok(rigClip(manifest, "domestic-cat", name), `cat ${name} plays`);
    for (const name of ["lie", "sleep", "sleep_curl", "sleep_side", "lie_down", "get_up"]) assert.equal(rigClip(manifest, "domestic-cat", name), null, `cat ${name} held`);
    assert.ok(rigClip(manifest, "domestic-dog", "sleep_curl"), "a dog's own clips are its own");
});
