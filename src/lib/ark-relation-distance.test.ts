import assert from "node:assert/strict";
import test from "node:test";
import {arkDistanceChipAt, arkHorizontalDistance, arkNearestLabels, formatArkDistance} from "@/lib/ark-relation-distance";

test("metres under 1000 m, rounded to the metre", () => {
    assert.equal(formatArkDistance(0), "0 m");
    assert.equal(formatArkDistance(0.4), "0 m");
    assert.equal(formatArkDistance(12.4), "12 m");
    assert.equal(formatArkDistance(12.5), "13 m");
    assert.equal(formatArkDistance(999.4), "999 m");
});

test("kilometres from 1000 m: one decimal under 10 km, whole above", () => {
    assert.equal(formatArkDistance(999.6), "1.0 km");
    assert.equal(formatArkDistance(1000), "1.0 km");
    assert.equal(formatArkDistance(1449), "1.4 km");
    assert.equal(formatArkDistance(1450), "1.4 km"); // (toFixed on 1.45 in binary)
    assert.equal(formatArkDistance(1460), "1.5 km");
    assert.equal(formatArkDistance(9940), "9.9 km");
    assert.equal(formatArkDistance(9960), "10 km");
    assert.equal(formatArkDistance(14_400), "14 km");
});

test("nothing for a distance that is not one", () => {
    assert.equal(formatArkDistance(Number.NaN), "");
    assert.equal(formatArkDistance(-1), "");
    assert.equal(formatArkDistance(Number.POSITIVE_INFINITY), "");
});

test("the distance is horizontal: height is left out (a bird over a fox, an animal on another island)", () => {
    assert.equal(arkHorizontalDistance({x: 0, z: 0}, {x: 3, z: 4}), 5);
    assert.equal(arkHorizontalDistance({x: 0, y: 0, z: 0} as {x: number; z: number}, {x: 0, y: 50, z: 0} as {x: number; z: number}), 0);
    assert.equal(arkHorizontalDistance({x: -600, z: 100}, {x: 600, z: 1700}), 2000);
});

test("the chip sits at the line's middle", () => {
    const out = {x: 0, y: 0};
    assert.equal(arkDistanceChipAt(100, 100, 300, 200, 44, 18, 11, out), true);
    assert.deepEqual(out, {x: 200, y: 150});
    assert.equal(arkDistanceChipAt(400, 50, 0, 50, 44, 18, 11, out), true);
    assert.deepEqual(out, {x: 200, y: 50});
});

test("a line too short to keep the chip off its end icons goes unlabelled", () => {
    const out = {x: -1, y: -1};
    // Horizontal: half the chip (22) + icon (11) + gap (4) = 37 needed each side; 70 px is not enough, 80 is.
    assert.equal(arkDistanceChipAt(0, 0, 70, 0, 44, 18, 11, out), false);
    assert.deepEqual(out, {x: -1, y: -1});
    assert.equal(arkDistanceChipAt(0, 0, 80, 0, 44, 18, 11, out), true);
    // Vertical: only the chip's half height counts (9 + 11 + 4 = 24 each side).
    assert.equal(arkDistanceChipAt(0, 0, 0, 50, 44, 18, 11, out), true);
    assert.equal(arkDistanceChipAt(0, 0, 0, 40, 44, 18, 11, out), false);
    // Zero length.
    assert.equal(arkDistanceChipAt(5, 5, 5, 5, 44, 18, 11, out), false);
});

test("only the nearest N lines are labelled; ties keep their order; NaN never is", () => {
    const keep = new Uint8Array(12);
    arkNearestLabels([50, 10, 30, 20, 40], 5, 3, keep);
    assert.deepEqual(Array.from(keep.subarray(0, 5)), [0, 1, 1, 1, 0]);
    arkNearestLabels([5, 5, 5, 5], 4, 2, keep);
    assert.deepEqual(Array.from(keep.subarray(0, 4)), [1, 1, 0, 0]);
    arkNearestLabels([Number.NaN, 1, 2], 3, 8, keep);
    assert.deepEqual(Array.from(keep.subarray(0, 3)), [0, 1, 1]);
    const many = Array.from({length: 12}, (_, i) => 12 - i);
    arkNearestLabels(many, 12, 8, keep);
    assert.deepEqual(Array.from(keep), [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]);
});
