import assert from "node:assert/strict";
import test from "node:test";
import {Vector3} from "three";
import {worldDecor} from "@/ark-scene/decor";
import {CameraObstacles, collideCamera, dampingFor, ease, FollowSmoother, inside, obstaclesOf, penetration, sightExit, type CameraObstacle} from "@/ark-scene/runtime/camera";
import {heightAt} from "@/ark-scene/world";

const options = {dt: 1 / 60, diving: false, clearance: 1.2, closeUp: false};

test("runtime camera: the scenery's trees, rocks and buildings are obstacles; soft things are not", () => {
    const decor = worldDecor();
    const tree = decor.find((item) => item.kind === "broadleaf")!;
    const rock = decor.find((item) => item.kind === "rock")!;
    assert.equal(obstaclesOf(tree).length, 2, "a trunk and a crown");
    assert.equal(obstaclesOf(rock).length, 1);
    for (const kind of ["reed", "lily", "flower", "leaf", "shrub", "coral"] as const) {
        const item = decor.find((d) => d.kind === kind);
        if (item) assert.equal(obstaclesOf(item).length, 0, kind);
    }
    const all = CameraObstacles.forScene();
    assert.ok(all.count > decor.length / 4, `${all.count} obstacles`);
    // The forest fill's trees are obstacles only within the tier's share (what it draws).
    const fillTree = {...tree, x: 500, z: 500, rank: 0.5};
    const ranked = new CameraObstacles([fillTree]);
    const eye = () => new Vector3(500.05, tree.y + 1, 500);
    const drawn = eye();
    collideCamera(ranked, drawn, {x: 0, y: 0, z: 0}, {...options, diving: true, fill: 0.6});
    assert.ok(drawn.x > 500.3, "drawn at this tier: pushed");
    const notDrawn = eye();
    collideCamera(ranked, notDrawn, {x: 0, y: 0, z: 0}, {...options, diving: true, fill: 0.3});
    assert.equal(notDrawn.x, 500.05, "not drawn at this tier: no obstacle");
});

test("runtime camera: out of a trunk at once, sideways; out of a crown gently; ignored when the target is inside", () => {
    const trunk: CameraObstacle = {kind: "capsule", x: 0, z: 0, y0: 0, y1: 4, r: 0.3};
    const crown: CameraObstacle = {kind: "ellipsoid", x: 10, y: 5, z: 0, rx: 2, ry: 1.5, rz: 2, solid: false};
    const box: CameraObstacle = {kind: "box", x: -10, z: 0, y0: 0, y1: 3, hx: 2, hz: 1, rotation: 0.6};
    const obstacles = new CameraObstacles([], [trunk, crown, box]);
    const ground = (x: number, z: number) => Math.max(heightAt(x, z), 0);

    const eye = new Vector3(0.1, ground(0.1, 0) + 2, 0);
    collideCamera(obstacles, eye, {x: 30, y: 0, z: 30}, options);
    assert.ok(Math.hypot(eye.x, eye.z) >= 0.3 + 0.35 - 1e-6, "outside the trunk and the eye's own radius");

    const inCrown = new Vector3(10.2, 5, 0);
    const before = inCrown.clone();
    collideCamera(obstacles, inCrown, {x: 30, y: 0, z: 30}, options);
    const moved = inCrown.distanceTo(before);
    assert.ok(moved > 0 && penetration(crown, inCrown, 0.35).depth > 0, "eased: moved some of the way this frame");
    for (let i = 0; i < 60; i++) collideCamera(obstacles, inCrown, {x: 30, y: 0, z: 30}, options);
    assert.ok(penetration(crown, inCrown, 0.35).depth < 0.01, "out after a second");

    // Looking at an animal up in that crown: the crown does not push.
    const looking = new Vector3(10.2, 5, 0);
    collideCamera(obstacles, looking, {x: 10, y: 5.2, z: 0}, options);
    assert.ok(Math.abs(looking.x - 10.2) < 1e-9 && Math.abs(looking.z) < 1e-9);

    // A close-up skips the crowns but not the solid things.
    const close = new Vector3(10.2, 5, 0);
    collideCamera(obstacles, close, {x: 30, y: 0, z: 30}, {...options, closeUp: true});
    assert.ok(Math.abs(close.x - 10.2) < 1e-9);

    // A rotated box: pushed out to a face (or over the roof).
    const atBox = new Vector3(-10.3, 1.5, 0.2);
    collideCamera(obstacles, atBox, {x: 30, y: 0, z: 30}, options);
    assert.equal(inside(box, atBox, 0.3), false);
});

test("runtime camera: out of a town building toward what it looks at, to the near side of the wall", () => {
    // A house 10 x 8 m, turned, its ridge 7 m up; the view's target in the garden in front of it (local +z).
    const house: CameraObstacle = {kind: "box", x: 600, z: -250, y0: 1.6, y1: 9.6, hx: 5, hz: 4, rotation: 0.4, sight: true};
    const obstacles = new CameraObstacles([]);
    obstacles.add(house);
    assert.equal(obstacles.count, 1);
    const cos = Math.cos(0.4);
    const sin = Math.sin(0.4);
    const world = (lx: number, lz: number) => ({x: 600 + lx * cos + lz * sin, z: -250 - lx * sin + lz * cos});
    const garden = world(1, 12);
    const target = {x: garden.x, y: 2.6, z: garden.z};
    const within = world(0.5, -1);
    const eye = new Vector3(within.x, 6, within.z);
    assert.ok(inside(house, eye, 0.35), "the eye starts inside the house");
    const exit = sightExit(house as Extract<CameraObstacle, {kind: "box"}>, eye, target, 0.35);
    assert.ok(exit, "the line to the target leaves the house");
    const first = eye.clone();
    collideCamera(obstacles, eye, target, {...options, dt: 1 / 60, ground: () => 0});
    assert.ok(eye.distanceTo(first) > 0 && inside(house, eye, 0.35), "it glides: part of the way in a frame");
    for (let i = 0; i < 90; i++) collideCamera(obstacles, eye, target, {...options, dt: 1 / 60, ground: () => 0});
    assert.equal(inside(house, eye, 0.3), false, "outside after a second and a half");
    // On the garden's side of the house (local z beyond its front wall), and on the line it looked along.
    const dx = eye.x - 600;
    const dz = eye.z + 250;
    assert.ok(dx * sin + dz * cos > 4, `in front of the front wall (${(dx * sin + dz * cos).toFixed(2)})`);
    const along = new Vector3(target.x - first.x, target.y - first.y, target.z - first.z).normalize();
    const off = new Vector3(eye.x - first.x, eye.y - first.y, eye.z - first.z);
    assert.ok(off.clone().sub(along.clone().multiplyScalar(off.dot(along))).length() < 0.05, "along its line of sight");
    // Looking at something inside the house (a pet at its window): the house does not push.
    const indoors = world(0, 3.5);
    const looking = new Vector3(within.x, 6, within.z);
    collideCamera(obstacles, looking, {x: indoors.x, y: 3, z: indoors.z}, {...options, dt: 1 / 60, ground: () => 0});
    assert.ok(Math.abs(looking.x - within.x) < 1e-9 && Math.abs(looking.z - within.z) < 1e-9);
    // The target right at the wall: the near side would be closer than the eye may come, so out by the nearest face.
    const atWall = world(0.5, 4.6);
    const tight = new Vector3(within.x, 3, within.z);
    collideCamera(obstacles, tight, {x: atWall.x, y: 2.6, z: atWall.z}, {...options, dt: 1 / 60, ground: () => 0});
    assert.equal(inside(house, tight, 0.3), false, "out at once");
    // Outside the house: nothing.
    const outside = world(0, 9);
    const free = new Vector3(outside.x, 5, outside.z);
    collideCamera(obstacles, free, target, {...options, dt: 1 / 60, ground: () => 0});
    assert.ok(Math.abs(free.x - outside.x) < 1e-9 && Math.abs(free.z - outside.z) < 1e-9);
});

test("runtime camera: the eye keeps over ground rising just round it, easing up rather than jumping", () => {
    const obstacles = new CameraObstacles([]);
    // Somewhere on the island where the ground slopes: find a point whose neighbourhood rises.
    let spot: {x: number; z: number} | null = null;
    for (let x = -60; x <= 60 && !spot; x += 3) {
        for (let z = -60; z <= 60 && !spot; z += 3) {
            const here = heightAt(x, z);
            if (here > 2 && heightAt(x + 1.5, z) - here > 0.8) spot = {x, z};
        }
    }
    assert.ok(spot, "a slope on the island");
    const eye = new Vector3(spot.x, Math.max(heightAt(spot.x, spot.z), 0) + 0.2, spot.z);
    const start = eye.y;
    collideCamera(obstacles, eye, {x: spot.x, y: start, z: spot.z + 5}, {...options, clearance: 1});
    assert.ok(eye.y > start, "lifted");
    const once = eye.y - start;
    for (let i = 0; i < 120; i++) collideCamera(obstacles, eye, {x: spot.x, y: start, z: spot.z + 5}, {...options, clearance: 1});
    assert.ok(eye.y - start > once, "eased: the first frame is part of the way");
    // Diving: the scene's own rule; nothing here.
    const under = new Vector3(spot.x, -5, spot.z);
    collideCamera(obstacles, under, {x: spot.x, y: -5, z: spot.z}, {...options, diving: true});
    assert.equal(under.y, -5);
});

test("runtime camera: damping and easing are per second, not per frame", () => {
    assert.ok(Math.abs(dampingFor(1 / 60) - 0.075) < 1e-9);
    // Two 120 Hz frames damp as much as one 60 Hz frame.
    const two = 1 - (1 - dampingFor(1 / 120)) ** 2;
    assert.ok(Math.abs(two - 0.075) < 1e-9);
    assert.ok(dampingFor(1 / 30) > 0.075);
    assert.equal(ease(0, 0.1), 1, "no time: snap");
    const half = ease(1 / 60, 0.2);
    assert.ok(Math.abs(1 - (1 - half) ** 2 - ease(1 / 30, 0.2)) < 1e-9);
});

test("runtime camera: following an animal at a steady pace keeps it in the middle, without lag", () => {
    const follow = new FollowSmoother();
    const target = {x: 0, y: 0, z: 0};
    const speed = 3;
    let lagAt60 = 0;
    for (let i = 0; i <= 240; i++) {
        const t = i / 60;
        const step = follow.step(target, {x: speed * t, y: 1, z: 0}, 1 / 60);
        target.x += step.x;
        target.y += step.y;
        target.z += step.z;
        lagAt60 = speed * t - target.x;
    }
    assert.ok(Math.abs(lagAt60) < 0.08, `lag ${lagAt60}`);
    assert.ok(Math.abs(target.y - 1) < 0.05);
    // The same at 30 fps (a throttled frame rate) ends in the same place.
    const slow = new FollowSmoother();
    const other = {x: 0, y: 0, z: 0};
    for (let i = 0; i <= 120; i++) {
        const t = i / 30;
        const step = slow.step(other, {x: speed * t, y: 1, z: 0}, 1 / 30);
        other.x += step.x;
        other.y += step.y;
    }
    assert.ok(Math.abs(other.x - target.x) < 0.15, `${other.x} vs ${target.x}`);
});
