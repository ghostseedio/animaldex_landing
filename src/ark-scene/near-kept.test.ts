import assert from "node:assert/strict";
import test from "node:test";
import {nearestKept, nearKeptDue, NEAR_KEPT_MAX, NEAR_KEPT_MOVE, NEAR_KEPT_WITHIN, sameIds} from "@/ark-scene/near-kept";

test("the nearest kept animals within reach, nearest first, at most the cap", () => {
    const garden = Array.from({length: 30}, (_, i) => ({id: `dog-${String(i).padStart(2, "0")}`, x: i, z: 0}));
    const ids = nearestKept(garden, 0, 0);
    assert.equal(ids.length, NEAR_KEPT_MAX);
    assert.deepEqual(ids.slice(0, 3), ["dog-00", "dog-01", "dog-02"]);
    // None past the reach.
    assert.ok(nearestKept(garden, -NEAR_KEPT_WITHIN - 0.5, 0).length === 0);
    // A tie is broken by id, so every viewer looking at one point picks the same.
    assert.deepEqual(nearestKept([{id: "b", x: 1, z: 0}, {id: "a", x: -1, z: 0}], 0, 0), ["a", "b"]);
});

test("chosen again only once the look point has moved, and the same set is no change", () => {
    assert.equal(nearKeptDue(null, 0, 0), true);
    assert.equal(nearKeptDue({x: 0, z: 0}, NEAR_KEPT_MOVE - 0.1, 0), false);
    assert.equal(nearKeptDue({x: 0, z: 0}, NEAR_KEPT_MOVE, 0), true);
    assert.equal(sameIds(["a", "b"], ["b", "a"]), true);
    assert.equal(sameIds(["a", "b"], ["a", "c"]), false);
    assert.equal(sameIds([], ["a"]), false);
});
