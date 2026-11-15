import assert from "node:assert/strict";
import test from "node:test";
import {arkAnimalsBefore, arkChange} from "@/lib/ark-landing-changes";

test("a change only from real numbers, toned by meaning", () => {
    assert.equal(arkChange(10, null, "good"), null);
    assert.equal(arkChange(10, 10, "good"), null);
    assert.deepEqual(arkChange(110, 100, "good"), {direction: "up", tone: "good", percent: 10, delta: 10});
    assert.deepEqual(arkChange(90, 100, "good"), {direction: "down", tone: "bad", percent: -10, delta: -10});
    assert.deepEqual(arkChange(2, 1, "bad"), {direction: "up", tone: "bad", percent: 100, delta: 1});
    assert.equal(arkChange(5, 3, "neutral")?.tone, "neutral");
    assert.equal(arkChange(3, 0, "good")?.percent, null);
});

test("animals 24 hours ago from the log", () => {
    assert.equal(arkAnimalsBefore(3300, {arrivals: 10, births: 20, deaths: 5}), 3275);
    assert.equal(arkAnimalsBefore(3300, null), null);
});
