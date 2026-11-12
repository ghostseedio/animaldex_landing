import assert from "node:assert/strict";
import test from "node:test";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {arkHappeningsSince, arkPopulationSeries, arkSeriesTimes} from "@/lib/ark-population-series";

function animal(id: string, species: string, slug: string): ArkAnimal {
    return {id, species_profile_id: species, name: slug, scientific_name: null, model_slug: slug, zone: "grassland", arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "Voyager 1", named: false}, mine: false};
}

// Now: three dragons (one born at 12:00) and one deer; a second deer was eaten at 18:00.
const SNAPSHOT: ArkSnapshot = {
    voyage: {slug: "first", name: "The first Ark", started_at: "2026-11-10T00:00:00Z"},
    counts: {animals: 4, species: 2, founders: 2},
    zones: [],
    animals: [animal("d1", "s-dragon", "komodo-dragon"), animal("d2", "s-dragon", "komodo-dragon"), animal("d3", "s-dragon", "komodo-dragon"), animal("r1", "s-deer", "rusa-deer")],
    as_of: "2026-11-11T00:00:00Z"
};

const EVENTS = {
    events: [
        {id: 1, at: "2026-11-10T06:00:00Z", kind: "arrival", animal: {id: "d2", species_profile_id: "s-dragon", model_slug: "komodo-dragon"}},
        {id: 2, at: "2026-11-10T12:00:00Z", kind: "birth", animal: {id: "d3", species_profile_id: "s-dragon", model_slug: "komodo-dragon"}},
        {id: 3, at: "2026-11-10T18:00:00Z", kind: "meal", animal: {id: "d1"}, other: {id: "r2", species_profile_id: "s-deer", model_slug: "rusa-deer"}},
        {id: 4, at: "2026-11-10T18:00:00Z", kind: "eaten", animal: {id: "r2", species_profile_id: "s-deer", model_slug: "rusa-deer"}},
        {id: 5, at: "2026-11-10T20:00:00Z", kind: "fed", animal: {id: "r1"}}
    ]
};

test("counts are worked back from now through the log", () => {
    const times = ["2026-11-10T00:00:00Z", "2026-11-10T09:00:00Z", "2026-11-10T15:00:00Z", "2026-11-10T21:00:00Z"];
    const series = arkPopulationSeries(SNAPSHOT, EVENTS, {times, top: 2});
    assert.deepEqual(series.species.map((row) => row.key), ["s-dragon", "s-deer"]);
    // Dragons: 1 before the arrival, 2 after it, 3 after the birth. Deer: 2 until one was eaten, then 1.
    assert.deepEqual(series.counts[0], [1, 2, 3, 3]);
    assert.deepEqual(series.counts[1], [2, 2, 2, 1]);
    assert.deepEqual(series.total, [3, 4, 5, 4]);
    // A meal and its eaten row are one departure; "fed" changes nothing.
    assert.deepEqual(series.happenings.meals, [0, 0, 0, 1]);
    assert.deepEqual(series.happenings.deaths, [0, 0, 0, 1]);
    assert.deepEqual(series.happenings.births, [0, 0, 1, 0]);
    assert.deepEqual(series.happenings.arrivals, [0, 1, 0, 0]);
});

test("an animal the log names but the read does not hold, and that never left, changes nothing", () => {
    const series = arkPopulationSeries(SNAPSHOT, {events: [{id: 9, at: "2026-11-10T06:00:00Z", kind: "arrival", animal: {id: "x9", species_profile_id: "s-dragon"}}]}, {times: ["2026-11-10T00:00:00Z"], top: 1});
    assert.deepEqual(series.total, [4]);
    assert.deepEqual(series.counts[0], [3]);
});

test("the window's moments and the last day's happenings", () => {
    assert.deepEqual(arkSeriesTimes(0, 100, 3), [0, 50, 100]);
    assert.deepEqual(arkHappeningsSince(EVENTS, Date.parse("2026-11-10T10:00:00Z")), {arrivals: 0, births: 1, meals: 1, deaths: 1});
});
