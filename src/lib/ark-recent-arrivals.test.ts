import assert from "node:assert/strict";
import test from "node:test";
import {arkRecentArrivals, recentArrivalSpeciesIds} from "./ark-recent-arrivals";

const HAWK = "7e2ffcc3-79dc-4677-87be-b2481eec26c2";
const PORCUPINE = "6ccc5e5e-a938-4d90-8bce-c887863c204a";
const RABBIT = "b1a61d2c-1e09-48df-94a4-9a7eeacdf257";

const rows = [
    {at: "2026-11-12T06:06:11Z", species_profile_id: HAWK},
    {at: "2026-11-12T06:06:11Z", species_profile_id: PORCUPINE},
    {at: "2026-11-12T06:05:00Z", species_profile_id: HAWK.toUpperCase()},
    {at: "2026-11-11T20:00:00Z", species_profile_id: "not-a-uuid"},
    {at: null, species_profile_id: RABBIT},
    {at: "2026-11-11T18:00:00Z", species_profile_id: RABBIT}
];
const names = [
    {id: HAWK, display_name: "Red-tailed Hawk", landing_page_slug: "red-tailed-hawk"},
    {id: PORCUPINE, display_name: "Malayan Porcupine", landing_page_slug: null}
];

test("each species once, the newest arrival first, at most the limit", () => {
    assert.deepEqual(recentArrivalSpeciesIds(rows), [HAWK, PORCUPINE, RABBIT]);
    assert.deepEqual(recentArrivalSpeciesIds(rows, 2), [HAWK, PORCUPINE]);
    assert.deepEqual(recentArrivalSpeciesIds([]), []);
});

test("the arrivals in words: named from the species rows, a page slug when there is one, unnamed species left out", () => {
    assert.deepEqual(arkRecentArrivals(rows, names), [
        {speciesProfileId: HAWK, name: "Red-tailed Hawk", slug: "red-tailed-hawk", at: "2026-11-12T06:06:11Z"},
        {speciesProfileId: PORCUPINE, name: "Malayan Porcupine", slug: null, at: "2026-11-12T06:06:11Z"}
    ]);
    assert.deepEqual(arkRecentArrivals(rows, names, 1).map((row) => row.name), ["Red-tailed Hawk"]);
    assert.deepEqual(arkRecentArrivals(rows, []), []);
});
