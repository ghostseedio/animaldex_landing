import assert from "node:assert/strict";
import test from "node:test";
import {ARK_HOME_COUNTS_FALLBACK, arkHomeCountsFrom} from "./ark-home-counts";

test("the home band's counts come from the public read's cached counts", () => {
    const rows = [{counts: {animals: 3219, species: 952, founders: 647}, computed_at: "2026-11-13T07:30:47.913202+00:00"}];
    assert.deepEqual(arkHomeCountsFrom(rows), {animals: 3219, bringers: 647, live: true, computedAt: "2026-11-13T07:30:47.913202+00:00"});
});

test("without a readable row the band shows the last numbers known", () => {
    assert.deepEqual(ARK_HOME_COUNTS_FALLBACK, {animals: 3225, bringers: 647, live: false, computedAt: null});
    assert.equal(arkHomeCountsFrom([]), ARK_HOME_COUNTS_FALLBACK);
    assert.equal(arkHomeCountsFrom(null), ARK_HOME_COUNTS_FALLBACK);
    assert.equal(arkHomeCountsFrom({message: "permission denied"}), ARK_HOME_COUNTS_FALLBACK);
    assert.equal(arkHomeCountsFrom([{counts: {animals: "many", founders: 3}}]), ARK_HOME_COUNTS_FALLBACK);
    assert.equal(arkHomeCountsFrom([{counts: {animals: 12}}]), ARK_HOME_COUNTS_FALLBACK, "no founders");
    // An empty Ark is not a number to show over the fallback.
    assert.equal(arkHomeCountsFrom([{counts: {animals: 0, founders: 0}}]), ARK_HOME_COUNTS_FALLBACK);
    assert.equal(arkHomeCountsFrom([{counts: {animals: -1, founders: 2}}]), ARK_HOME_COUNTS_FALLBACK);
});
