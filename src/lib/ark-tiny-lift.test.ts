import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {TINY_LIFT_WITHIN, TINY_MAX_LIFT, TINY_MIN_PIXELS, easeLift, tinyLift} from "@/ark-scene/tiny-lift";

const px = (length: number, distance: number, lift: number) => (length * lift * 900) / (2 * Math.tan((38 * Math.PI) / 360) * distance);

test("a tiny animal chosen or followed is drawn at least the minimum on screen while the camera is near", () => {
    // A 2 cm dung beetle with its card open, at 3 m on a 900 px view it is about 23 px long: lifted to the minimum.
    const lift = tinyLift(true, 0.02, 0.02, 3, 900, 38);
    assert.ok(lift > 1);
    assert.ok(Math.abs(px(0.02, 3, lift) - TINY_MIN_PIXELS) < 0.5);
    // Never more than the cap.
    assert.equal(tinyLift(true, 0.004, 0.004, 4, 900, 38), TINY_MAX_LIFT);
});

test("true scale everywhere else: not watched, not tiny, close enough already, or the wide view", () => {
    assert.equal(tinyLift(false, 0.02, 0.02, 3, 900, 38), 1); // not chosen nor followed
    assert.equal(tinyLift(true, 0.08, 0.08, 3, 900, 38), 1); // a mouse-sized one: not tiny
    assert.equal(tinyLift(true, 0.02, 0.02, 0.14, 900, 38), 1); // the close-up flight's own distance: big on screen already
    assert.equal(tinyLift(true, 0.02, 0.02, TINY_LIFT_WITHIN, 900, 38), 1); // out of reach: the wide view
    assert.equal(tinyLift(true, 0.02, 0.02, 60, 900, 38), 1);
    // Eases back to true size over the last quarter of the way out.
    const edge = tinyLift(true, 0.02, 0.02, TINY_LIFT_WITHIN * 0.95, 900, 38);
    assert.ok(edge > 1 && edge < tinyLift(true, 0.02, 0.02, TINY_LIFT_WITHIN * 0.7, 900, 38));
});

test("the lift eases (no jump when the card opens or closes)", () => {
    const a = easeLift(1, 4, 0.016);
    assert.ok(a > 1 && a < 1.5);
    assert.ok(Math.abs(easeLift(1, 4, 2) - 4) < 0.001);
});

test("the scene draws the lift only for the near model of the one chosen or followed", () => {
    const scene = readFileSync("src/ark-scene/index.ts", "utf8");
    assert.match(scene, /level !== "near" \? 1 \+ \(exaggerate - 1\)[^:]*: liftTiny\(entry, candidate\.distance, now\)/);
    assert.match(scene, /const watched = \(selectedId === id \|\| followId === id\)/);
});
