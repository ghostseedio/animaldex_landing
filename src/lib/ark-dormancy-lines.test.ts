import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {dormancyItems, dormancyText} from "@/ark-scene/live/dormancy-lines";
import type {ArkLiveText} from "./ark-live-log";

const english = JSON.parse(readFileSync(path.join(__dirname, "..", "data", "locales", "en.json"), "utf8")).ark as ArkLiveText;
const rows = [
    {id: 1, kind: "dormant", at: "2026-11-20T10:00:00Z", species: "Alpine Marmot", species_profile_id: "0000aaaa-0000-4000-8000-000000000001"},
    {id: 2, kind: "meal", at: "2026-11-20T10:01:00Z", species: "African Lion"},
    {id: 3, kind: "woke", at: "2026-11-21T10:00:00Z", species: "Alpine Marmot", species_profile_id: "0000aaaa-0000-4000-8000-000000000001"},
    {id: 4, kind: "dormant", at: "not a time", species: "Groundhog"}
];

test("the record's dormancy events are said once, with their own words, the kind named in the plural", () => {
    const items = dormancyItems({events: rows}, -Infinity, () => false);
    assert.deepEqual(items.map((i) => [i.say, i.animal, i.source]), [["dormant", "Alpine Marmot", "server"], ["woke", "Alpine Marmot", "server"]]);
    assert.equal(dormancyText(items[0], english, "en"), "Alpine Marmots have gone into their winter sleep");
    assert.equal(dormancyText(items[1], english, "en"), "Alpine Marmots are awake again");
    assert.equal(dormancyText({animal: "African Lion"}, english, "en"), null, "any other line keeps its own words");
    // Already said, or older than the read's start: not again.
    assert.equal(dormancyItems(rows, -Infinity, (key) => key === "event:1").length, 1);
    assert.equal(dormancyItems(rows, Date.parse("2026-11-21T00:00:00Z"), () => false).length, 1);
    assert.equal(items[0].focus.animalId, null, "a kind's line, never one animal's");
});

test("the record's escapes: the prey that got away is named first, the tap flies to it, said once", async () => {
    const {escapeItems, escapeText} = await import("@/ark-scene/live/escape-lines");
    const zebra = {id: "z1", name: "Plains Zebra", species_profile_id: "zebra", model_slug: "plains-zebra", zone: "grassland"};
    const lion = {id: "l1", name: "African Lion", species_profile_id: "lion", model_slug: "african-lion", zone: "grassland"};
    const raw = {events: [{id: 7, kind: "escaped", at: "2026-11-20T10:00:00Z", animal: zebra, other: lion}, {id: 8, kind: "meal", at: "2026-11-20T10:01:00Z", animal: lion, other: zebra}]};
    const items = escapeItems(raw, -Infinity, () => false);
    assert.equal(items.length, 1);
    assert.equal(items[0].focus.animalId, "z1");
    assert.equal(escapeText(items[0], english), "A Plains Zebra got away from an African Lion");
    assert.equal(escapeItems(raw, -Infinity, (key) => key === "event:7").length, 0);
    assert.equal(escapeText({animal: "x", other: null}, english), null);
    assert.equal(dormancyText(items[0], english, "en"), null, "not a dormancy line");
});
