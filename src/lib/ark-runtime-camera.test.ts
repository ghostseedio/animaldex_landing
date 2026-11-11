import assert from "node:assert/strict";
import test from "node:test";
import {Vector3} from "three";
import {worldDecor} from "@/ark-scene/decor";
import {CameraObstacles, collideCamera, dampingFor, ease, FollowSmoother, inside, obstaclesOf, penetration, type CameraObstacle} from "@/ark-scene/runtime/camera";
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
    const all = CameraObstacles.forScene(1);
    const fewer = CameraObstacles.forScene(0.3);
    assert.ok(all.count > fewer.count && fewer.count > decor.length / 4, `${all.count} vs ${fewer.count}`);
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
