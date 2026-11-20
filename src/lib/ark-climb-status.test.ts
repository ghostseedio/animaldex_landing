/**
 * ARK-CANOPY (the owner's black rat, 2026-11-21: its card said "Resting" while it climbed its street tree): a climb on
 * a trip's way, up a trunk or a wall and down again, is said as climbing while the climb lasts (`climbSpans`); a step
 * up onto a kerb or a low rock is not.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {climbSpans} from "@/ark-scene/animal-status";
import type {Trip} from "@/ark-scene/behaviour-schedule";

const spot = (y: number) => ({x: 0, y, z: 0, nx: 0, ny: 1, nz: 0, point: null});
const leg = (mode: string, fromY: number, toY: number, seconds: number) => ({mode, from: spot(fromY), to: spot(toY), path: null, length: Math.abs(toY - fromY), seconds, beat: "walk"});

test("a trip's climbs, up a trunk and down, are its climbing spans; a step up a kerb is not", () => {
    const trip = {start: 100, legs: [leg("ground", 0, 0, 6), leg("surface", 0, 4.5, 5), leg("pause", 4.5, 4.5, 2), leg("surface", 4.5, 0, 4), leg("surface", 0, 0.15, 0.5)]} as unknown as Trip;
    assert.deepEqual(climbSpans(trip), [{from: 106, to: 111}, {from: 113, to: 117}]);
    assert.deepEqual(climbSpans({start: 0, legs: [leg("ground", 0, 0, 10)]} as unknown as Trip), []);
});
