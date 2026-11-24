/**
 * Near-camera react and flee (pass C, problem 6): each camera stop counts once, so one big flock at one stop cannot
 * decide the figure (`src/lib/ark-audit/camera-hunts.ts`).
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import {cameraHuntShares, huntCounts, HUNT_MOVING_MPS, type StopHunts} from "./ark-audit/camera-hunts";

const stop = (encounters: number, reacted: number, fled: number, hunter = "h", prey = "p"): StopHunts => ({hunter, prey, encounters, reacted, fled});

test("camera hunts: the mean of each stop's share, not the pooled rows", () => {
    // Two stops: 10 prey all flee; 90 prey, 9 flee. Pooled 19 of 100; per stop (100% + 10%) / 2.
    const r = cameraHuntShares([stop(10, 10, 10), stop(90, 90, 9)]);
    assert.equal(r.fleePct, 55);
    assert.equal(r.pooledFleePct, 19);
    assert.equal(r.reactPct, 100);
    assert.equal(r.stopsWithHunts, 2);
});

test("camera hunts: one big flock moves the figure by its one stop's weight only", () => {
    const seven = [stop(34, 33, 12), stop(38, 35, 24), stop(6, 6, 2), stop(11, 11, 3), stop(8, 0, 0), stop(23, 22, 19), stop(8, 6, 6)];
    const small = cameraHuntShares([...seven, stop(111, 106, 69)]);
    const crowd = cameraHuntShares([...seven, stop(216, 188, 61)]);
    // (The real 11-24 pair: pooled flee 56.5 -> 36.9 for one stop's swap; per stop it moves by that stop's eighth.)
    assert.ok(small.pooledFleePct! - crowd.pooledFleePct! > 15);
    assert.ok(Math.abs(small.fleePct! - crowd.fleePct!) < 5);
});

test("camera hunts: stops with no hunter near are left out; none at all is null", () => {
    assert.equal(cameraHuntShares([stop(0, 0, 0), stop(4, 2, 1)]).fleePct, 25);
    assert.equal(cameraHuntShares([stop(0, 0, 0), stop(4, 2, 1)]).stopsWithHunts, 1);
    const none = cameraHuntShares([stop(0, 0, 0)]);
    assert.equal(none.reactPct, null);
    assert.equal(none.fleePct, null);
});

test("camera hunts: a row is a hunter moving within sight, or still and close for the prey's size (fixed values)", () => {
    // (A still Boelen's python 18-25 m from a jackdaw: no row; the same python on the move: a row.)
    assert.equal(huntCounts(23, 0, 0.33), false);
    assert.equal(huntCounts(23, 0.3, 0.33), true);
    // (Beyond the sight radius never; within it, a still hunter by the prey's size class: 8, 15, 25 m.)
    assert.equal(huntCounts(26, 2, 1), false);
    assert.equal(huntCounts(7.9, 0, 0.1), true);
    assert.equal(huntCounts(8.1, 0, 0.1), false);
    assert.equal(huntCounts(14, 0, 1), true);
    assert.equal(huntCounts(16, 0, 1), false);
    assert.equal(huntCounts(24, 0, 2), true);
    // (The threshold itself: standing drift is not moving.)
    assert.equal(huntCounts(20, HUNT_MOVING_MPS, 0.5), false);
});
