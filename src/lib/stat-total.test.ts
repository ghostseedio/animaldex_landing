import assert from "node:assert/strict";
import test from "node:test";
import {countsTowardStatTotal, statTotal} from "@/lib/stat-total";

test("the Total is the four skill stats; rarity is never summed", () => {
    assert.equal(statTotal({dominance: 40, speed: 30, size: 20, intelligence: 10, rarity: 90}), 100);
    assert.equal(statTotal({dominance: 25, speed: 25, size: 25, intelligence: 25, rarity: 1}), statTotal({dominance: 25, speed: 25, size: 25, intelligence: 25, rarity: 99}));
});

test("only rarity is left out of the Total", () => {
    for (const key of ["dominance", "speed", "size", "intelligence"]) assert.equal(countsTowardStatTotal(key), true);
    assert.equal(countsTowardStatTotal("rarity"), false);
});
