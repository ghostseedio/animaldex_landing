import assert from "node:assert/strict";
import test from "node:test";
import {firstPerson, horizontalFov, thirdPerson, verticalFov, type CameraWorld} from "@/ark-scene/control/camera";
import {controlRigClip} from "@/ark-scene/control/clips";
import {abilitiesOf} from "@/ark-live/species";

const flat: CameraWorld = {ground: () => 0, blocked: () => false, water: () => null};

test("first person: the field of view by species, capped by the tier, and the near plane comes in for small animals (§4.7)", () => {
    assert.equal(horizontalFov(abilitiesOf("red-fox"), "high"), 80, "a forward-eyed hunter");
    assert.equal(horizontalFov(abilitiesOf("roe-deer"), "high"), 115, "wide-eyed prey");
    assert.equal(horizontalFov(abilitiesOf("roe-deer"), "low"), 90, "the low tier's cap");
    assert.equal(horizontalFov(abilitiesOf("barn-owl"), "high"), 70, "an owl");
    const wide = verticalFov(115, 16 / 9);
    assert.ok(wide > 70 && wide <= 75, `landscape: ${wide.toFixed(1)}°`);
    assert.equal(verticalFov(115, 9 / 19.5), 75, "portrait hits the 75° vertical cap (the HUD suggests turning the phone)");
    const bee = firstPerson({x: 0, y: 0, z: 0, yaw: 0, mode: "ground"}, abilitiesOf("western-honey-bee"), {yaw: 0, pitch: 0}, 16 / 9, "high", flat);
    assert.ok(bee.near <= 0.03, `a bee's near plane ${bee.near}`);
});

test("first person: the head turns up to the rig's look limit, then holds", () => {
    const fox = abilitiesOf("red-fox");
    const cam = firstPerson({x: 0, y: 0, z: 0, yaw: 0, mode: "ground"}, fox, {yaw: Math.PI * 0.9, pitch: 0}, 1.6, "high", flat);
    const look = Math.atan2(cam.target.x - cam.eye.x, cam.target.z - cam.eye.z);
    assert.ok(Math.abs(look - (70 * Math.PI) / 180) < 1e-6, `held at 70°: ${((look * 180) / Math.PI).toFixed(1)}`);
});

test("third person: behind the animal, pulled in before an obstacle, never under ground, on the animal's side of the water", () => {
    const fox = abilitiesOf("red-fox");
    const open = thirdPerson({x: 0, y: 0, z: 0, mode: "ground"}, fox, {yaw: 0, pitch: -0.25}, flat);
    const back = Math.hypot(open.eye.x - open.target.x, open.eye.z - open.target.z);
    assert.ok(open.eye.z < 0 && back > 3, `behind it: ${back.toFixed(2)} m`);
    const walled: CameraWorld = {...flat, blocked: (_x, z) => z < -1.5};
    const tight = thirdPerson({x: 0, y: 0, z: 0, mode: "ground"}, fox, {yaw: 0, pitch: -0.25}, walled);
    assert.ok(tight.eye.z > -1.6, `pulled in before the wall: ${tight.eye.z.toFixed(2)}`);
    const hill: CameraWorld = {...flat, ground: (_x, z) => (z < 0 ? -z * 2 : 0)};
    const up = thirdPerson({x: 0, y: 0, z: 0, mode: "ground"}, fox, {yaw: 0, pitch: 0.5}, hill);
    assert.ok(up.eye.y >= hill.ground(up.eye.x, up.eye.z) + 0.3, "over the ground");
    const sea: CameraWorld = {...flat, ground: () => -5, water: () => 0};
    const fish = thirdPerson({x: 0, y: -2, z: 0, mode: "swim"}, abilitiesOf("atlantic-salmon"), {yaw: 0, pitch: -1}, sea);
    assert.ok(fish.eye.y < 0, "under the water with the fish");
});

test("clips: each control clip plays the first the rig has, gaits by distance, and the wings stay open without flight clips", () => {
    const has = (names: string[]) => (n: string) => names.includes(n);
    assert.deepEqual(controlRigClip("run", has(["walk", "run", "idle"])), {name: "run", byDistance: true});
    assert.deepEqual(controlRigClip("sprint", has(["walk", "idle"])), {name: "walk", byDistance: true});
    assert.deepEqual(controlRigClip("glide", has(["takeoff", "idle"])), {name: "takeoff", byDistance: false, hold: 1}, "open-wing fallback (D16)");
    assert.deepEqual(controlRigClip("swim", has(["swim"])), {name: "swim", byDistance: false});
    assert.equal(controlRigClip("burrow", has([])), null);
});
