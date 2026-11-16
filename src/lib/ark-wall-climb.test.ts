/**
 * Lizards climbing walls flat on the wall (the owner, 2026-11-16, on the live Ark: "can you check lizards that climb up
 * walls, they're not climbing flat on the wall instead they're angled like they're walking on the ground not the
 * wall"). `wall-climb.ts`: the town's wall places carry the wall's normal, on the wall's face; a climb between the
 * ground and a wall goes along the ground to the wall's foot and up the wall itself, belly to it, head first both ways.
 *
 * The pure orientation (the body's up from the surface's normal, its heading laid onto the surface, never inside the
 * wall), the town's wall places, and the town's own geckos over a day of the shared schedule.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {CORNER, STEEP_NY, WALL_FACE, WALL_SKIN, wallClimb, wallClimbAt, wallHeading, wallNormal, wallPlaceSuits, type ClimbEnd} from "@/ark-scene/wall-climb";
import {scheduleSurface} from "@/ark-scene/grounding/stand";
import {townSamplerData, townWorldSampler} from "@/ark-scene/islands/town/sampler";
import {townAreas} from "@/ark-scene/islands/town/areas";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {toLocal} from "@/ark-scene/islands/town/geom";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {poseOnTrip, scheduleWorld, tripAt, withLazyRoost, type Trip} from "@/ark-scene/behaviour-schedule";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {scheduledPerch} from "@/ark-scene/grounding/hook";
import {islandHours} from "@/lib/ark-clock";

const dot = (a: {x: number; y: number; z: number}, b: {x: number; y: number; z: number}) => a.x * b.x + a.y * b.y + a.z * b.z;

// A wall facing +x (its face at x = 0), a spot 2.4 m up it on its skin, and ground 1.5 m out from it.
const WALL: ClimbEnd = {x: WALL_SKIN, y: 2.4, z: 0, nx: 1, ny: 0, nz: 0};
const GROUND: ClimbEnd = {x: 1.5, y: 0, z: 0.4, nx: 0, ny: 1, nz: 0};

test("a climb is a wall climb only between the ground and a steep surface (a wall, a trunk), not a branch or flat to flat", () => {
    assert.equal(wallClimb(GROUND, WALL), true);
    assert.equal(wallClimb(WALL, GROUND), true);
    assert.equal(wallClimb(GROUND, {...GROUND, x: 3} as ClimbEnd), false);
    // A branch's top (nearly up) or a rock's sloping face is climbed as before.
    assert.equal(wallClimb(GROUND, {...WALL, nx: 0.6, ny: 0.8} as ClimbEnd), false);
    assert.equal(wallClimb(GROUND, {...WALL, nx: 0.92, ny: 0.4} as ClimbEnd), false);
});

test("up a wall: along the ground to its foot, then straight up it with its belly to it (the normal its up), its feet never inside it", () => {
    let wasOnWall = false;
    for (let k = 0; k <= 400; k++) {
        const u = k / 400;
        const p = wallClimbAt(GROUND, WALL, u, 0);
        // Its up is a unit normal, between the ground's up and the wall's out, never into the wall.
        assert.ok(Math.abs(Math.hypot(p.nx, p.ny, p.nz) - 1) < 1e-9);
        assert.ok(p.nx >= -1e-9 && p.ny >= -1e-9, `u ${u}: normal into the wall or the ground`);
        // Never inside the wall (its face at x = 0): its contact point is out of the face by the skin or more.
        assert.ok(p.x >= WALL_SKIN - 1e-9, `u ${u}: ${p.x} inside the wall`);
        // Never under the ground.
        assert.ok(p.y >= -1e-9);
        // Once on the wall, it stays on it: the wall's own normal, at the spot's place along the wall.
        if (p.onWall) {
            wasOnWall = true;
            assert.ok(p.nx > 0.86, `u ${u}: on the wall but leaning off it (${p.nx})`);
            assert.ok(Math.abs(p.x - WALL.x) < 1e-9 && Math.abs(p.z - WALL.z) < 1e-9);
        } else assert.ok(!wasOnWall, `u ${u}: off the wall again`);
        assert.equal(p.down, false);
    }
    const start = wallClimbAt(GROUND, WALL, 0, 0);
    const end = wallClimbAt(GROUND, WALL, 1, 0);
    assert.deepEqual([start.x, start.y, start.z, start.ny], [GROUND.x, GROUND.y, GROUND.z, 1]);
    assert.ok(Math.abs(end.y - WALL.y) < 1e-9 && Math.abs(end.nx - 1) < 1e-9);
    // On the ground part it faces the wall (−x here).
    assert.ok(Math.sin(start.yaw) < -0.9);
    // The corner's turn is short: the body is level until CORNER before the wall's foot.
    const footShare = Math.hypot(GROUND.x - WALL.x, GROUND.z - WALL.z) / (Math.hypot(GROUND.x - WALL.x, GROUND.z - WALL.z) + WALL.y);
    const beforeCorner = wallClimbAt(GROUND, WALL, footShare - (CORNER + 0.01) / (Math.hypot(GROUND.x - WALL.x, GROUND.z - WALL.z) + WALL.y), 0);
    assert.ok(beforeCorner.ny > 0.999);
});

test("down a wall: the same path backwards, head first", () => {
    for (let k = 0; k <= 50; k++) {
        const u = k / 50;
        const up = wallClimbAt(GROUND, WALL, 1 - u, 0);
        const down = wallClimbAt(WALL, GROUND, u, 0);
        assert.ok(Math.abs(up.x - down.x) < 1e-9 && Math.abs(up.y - down.y) < 1e-9 && Math.abs(up.z - down.z) < 1e-9);
        assert.ok(Math.abs(up.nx - down.nx) < 1e-9 && Math.abs(up.ny - down.ny) < 1e-9);
        assert.equal(down.down, true);
    }
    // On the ground it walks away from the wall (+x here).
    assert.ok(Math.sin(wallClimbAt(WALL, GROUND, 1, 0).yaw) > 0.9);
});

test("the drawn body on a wall: its up the wall's normal, its heading laid onto the wall (up it, or down it head first)", () => {
    const n = {x: 0.6, y: 0, z: -0.8};
    const climbing = scheduleSurface({x: 0, y: 2, z: 0, yaw: 1.2, nx: n.x, ny: n.y, nz: n.z});
    assert.deepEqual([climbing.nx, climbing.ny, climbing.nz].map((v) => Math.round(v * 1e9) / 1e9), [0.6, 0, -0.8]);
    assert.ok(climbing.ty > 0.999, "heads up the wall");
    const descending = scheduleSurface({x: 0, y: 2, z: 0, yaw: 1.2, nx: n.x, ny: n.y, nz: n.z}, wallHeading(true));
    assert.ok(descending.ty < -0.999, "heads down the wall");
    // Mid-corner (the normal half way to the wall): the heading still lies on the surface, never into it.
    for (let k = 0; k <= 20; k++) {
        const p = wallClimbAt(GROUND, WALL, 0.2 + (k / 20) * 0.3, 0);
        const frame = scheduleSurface({x: p.x, y: p.y, z: p.z, yaw: p.yaw, nx: p.nx, ny: p.ny, nz: p.nz});
        const t = {x: frame.tx, y: frame.ty, z: frame.tz};
        assert.ok(Math.abs(dot(t, {x: frame.nx, y: frame.ny, z: frame.nz})) < 1e-9);
        assert.ok(Math.abs(Math.hypot(t.x, t.y, t.z) - 1) < 1e-9);
        // Toward the wall or up it, never away from it.
        assert.ok(t.x <= 1e-9);
    }
});

test("the town's wall places (a lamp-lit wall, under the eaves) are on their building's face, the wall's normal out of it; every other place is up", () => {
    const plan = townPlan();
    const byId = new Map(plan.buildings.map((b) => [b.id, b]));
    const spots = townAreas().spots;
    const walls = spots.filter((s) => s.wall);
    assert.ok(walls.length > 100, `${walls.length} wall places`);
    for (const s of walls) {
        const b = byId.get(s.place)!;
        const w = s.wall!;
        assert.ok(Math.abs(Math.hypot(w.nx, w.nz) - 1) < 1e-9);
        // On the face: the local point is the wall's skin out of the front or back wall, and the normal points out there.
        const l = toLocal(b.at, w.x, w.z);
        assert.ok(Math.abs(Math.abs(l.z) - (b.at.d / 2 + WALL_SKIN)) < 1e-6, `${s.where} on ${b.id}: ${l.z} not on the face`);
        assert.ok(Math.abs(l.x) <= b.at.w / 2);
        const out = toLocal({...b.at, x: 0, z: 0}, w.nx, w.nz);
        assert.ok(Math.abs(out.z - Math.sign(l.z)) < 1e-9, `${s.where} on ${b.id}: normal not out of its wall`);
        // Under the roof's line (on the wall, not on the roof).
        assert.ok(w.y < s.y + 1e-9);
    }
    const {points} = townSamplerData([]);
    let onWalls = 0;
    for (const p of points) {
        const wallPlace = p.id.startsWith("town:lamp_wall:") || p.id.endsWith(WALL_FACE);
        if (wallPlace) {
            onWalls++;
            assert.ok(Math.abs(p.ny) < STEEP_NY && Math.abs(Math.hypot(p.nx, p.ny, p.nz) - 1) < 1e-9, `${p.id}: not a wall's normal`);
        } else if (!p.id.startsWith("town:tree:")) assert.deepEqual([p.nx, p.ny, p.nz], [0, 1, 0], `${p.id}: moved off up`);
    }
    assert.ok(onWalls > 300, `${onWalls} wall points`);
});

test("the town's geckos over a day: whenever one is up off the ground it is drawn on the wall's surface (belly to it), never upright in the air", () => {
    const open: string[] = [];
    const world = scheduleWorld(townWorldSampler(open, {x: 0, z: 0}, townColliderSet(open, {x: 0, z: 0})));
    const lamps = townAreas().spots.filter((s) => s.where === "lamp_wall");
    const profile = behaviourProfile("common-house-gecko", "reptile");
    const start = Date.UTC(2026, 10, 16) / 1000;
    let up = 0;
    let onWall = 0;
    const bad: string[] = [];
    const homes = [lamps[3], lamps[40], lamps[90]];
    for (let k = 0; k < homes.length; k++) {
        const spot = homes[k];
        const animal = withLazyRoost({id: `wall-gecko-${k}`, zone: "farm_garden", home: {x: spot.x, y: spot.y, z: spot.z}, length: 0.11, sea: false, range: 2.25}, () => null);
        let trip: Trip | null = null;
        for (let e = start; e < start + 86400; e += 30) {
            if (!trip || e < trip.start || e >= trip.end) trip = tripAt(world, profile, animal, e, (x: number) => islandHours(x * 1000, 0), null, trip);
            const at = poseOnTrip(world, trip, e);
            if (at.aloft || at.y < townHeight(at.x, at.z) + 0.1) continue;
            up++;
            const frame = scheduledPerch(at, trip.to, e >= trip.arrive && !at.moving, 0, {x: 0, y: 0}, townHeight);
            if (!frame) {
                bad.push(`${animal.id} ${new Date(e * 1000).toISOString()} ${at.y.toFixed(2)} m up with no surface`);
                continue;
            }
            if (Math.abs(frame.ny) < STEEP_NY) onWall++;
        }
    }
    assert.deepEqual(bad.slice(0, 5), []);
    assert.ok(onWall > 0 && onWall === up, `${onWall} of ${up} raised moments on a wall`);
});

test("an eave's two places: the roof's for a flyer (its goals as they were), the wall's face under it for a climber", () => {
    const roof = {id: "town:eave:7:house_wall", tag: "house_wall", ny: 1};
    const face = {id: `town:eave:7:house_wall${WALL_FACE}`, tag: "house_wall", ny: 0};
    assert.deepEqual([wallPlaceSuits(roof, false), wallPlaceSuits(face, false)], [true, false]);
    assert.deepEqual([wallPlaceSuits(roof, true), wallPlaceSuits(face, true)], [false, true]);
    // Every other place suits both: a lamp-lit wall, the wild island's walls, a branch.
    for (const p of [{id: "town:lamp_wall:3:house_wall", tag: "house_wall", ny: 0}, {id: "house_wall:house:21", tag: "house_wall", ny: 0}, {id: "town:tree:4:limb0", tag: "branch", ny: 1}]) {
        assert.ok(wallPlaceSuits(p, true) && wallPlaceSuits(p, false));
    }
});

test("wallNormal: the outward normal of a building's local +z wall", () => {
    for (const rot of [0, 0.7, Math.PI / 2, 2.5, -1]) {
        const n = wallNormal(rot);
        const back = toLocal({x: 0, z: 0, w: 1, d: 1, rot}, n.x, n.z);
        assert.ok(Math.abs(back.x) < 1e-9 && Math.abs(back.z - 1) < 1e-9);
    }
});
