import {test} from "node:test";
import assert from "node:assert/strict";
import {ARRIVAL_WAIT_SECONDS, entranceShowing, waitForArrival, type ArrivalClock} from "@/ark-scene/arrival-wait";

const run = (entry: ArrivalClock, from: number, to: number, shownFrom: number, dt = 1 / 30) => {
    for (let t = from; t <= to + 1e-9; t += dt) waitForArrival(entry, t, t >= shownFrom);
};

test("an arrival whose model is still loading starts its entrance (ring) when it is first drawn", () => {
    const entry: ArrivalClock = {arrivedAt: 10};
    // Model loads 4 s after it came aboard.
    run(entry, 10, 14.5, 14);
    assert.ok(entry.arrivedAt !== null);
    // Its entrance started within a frame of it being drawn, not at 10.
    assert.ok(Math.abs(entry.arrivedAt - 14) < 0.05, `started at ${entry.arrivedAt}`);
    // So half a second after it showed, the ring (2.6 s) is still early, not long over.
    assert.ok(14.5 - entry.arrivedAt < 0.6);
});

test("an arrival drawn at once keeps its start", () => {
    const entry: ArrivalClock = {arrivedAt: 10};
    run(entry, 10, 12, 0);
    assert.equal(entry.arrivedAt, 10);
});

test("once started it is never held again (a level's mesh loading midway)", () => {
    const entry: ArrivalClock = {arrivedAt: 10};
    run(entry, 10, 10.5, 0);
    for (let t = 10.5; t < 11.5; t += 1 / 30) waitForArrival(entry, t, false);
    assert.equal(entry.arrivedAt, 10);
});

test("one never drawn within the wait comes in with no entrance", () => {
    const entry: ArrivalClock = {arrivedAt: 10};
    run(entry, 10, 10 + ARRIVAL_WAIT_SECONDS + 1, Infinity);
    assert.equal(entry.arrivedAt, null);
    // Drawn later: no ring then.
    waitForArrival(entry, 10 + ARRIVAL_WAIT_SECONDS + 2, true);
    assert.equal(entry.arrivedAt, null);
});

test("a new arrival on the same animal is waited on afresh", () => {
    const entry: ArrivalClock = {arrivedAt: 10};
    run(entry, 10, 11, 0);
    entry.arrivedAt = 50; // a replay's arrival
    run(entry, 50, 52, 51.5);
    assert.ok(entry.arrivedAt !== null && Math.abs(entry.arrivedAt - 51.5) < 0.05);
});

test("no ring while it waits: the entrance shows only once its body has been drawn", () => {
    const entry: ArrivalClock = {arrivedAt: 10};
    for (let t = 10; t < 13; t += 1 / 30) {
        waitForArrival(entry, t, false);
        assert.equal(entranceShowing(entry), false, `ring at ${t.toFixed(2)} with no body`);
    }
    waitForArrival(entry, 13, true);
    assert.equal(entranceShowing(entry), true);
});
