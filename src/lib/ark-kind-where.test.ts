import assert from "node:assert/strict";
import test from "node:test";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {ARK_GRAPH_ENGLISH, arkGraphWords} from "@/lib/ark-graph-words";
import {arkKindHereText, arkKindPlaceOf, arkKindWhere, arkKindWholeText} from "@/lib/ark-kind-where";
import {arkStepChanges, type ArkSeries} from "@/lib/ark-population-history";

let n = 0;
function animal(extra: Partial<ArkAnimal> & {species?: string}): ArkAnimal {
    const {species = "axolotl", ...rest} = extra;
    n++;
    return {id: `a-${n}`, species_profile_id: species, name: species === "axolotl" ? "Axolotl" : species, scientific_name: null, model_slug: species, zone: "river_lake", arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "@someone", named: true}, mine: false, island: "town", ...rest} as ArkAnimal;
}
const snapshotOf = (animals: ArkAnimal[]): ArkSnapshot => ({voyage: {slug: "ark", name: "Ark", started_at: null}, counts: {animals: animals.length, species: 1, founders: 1}, zones: [], animals, as_of: null});

// The owner's axolotls (2026-11-20): 9 across the Ark, 7 in homes, 1 in a zoo tank, 1 wild, all from photos.
const homes = Array.from({length: 7}, () => animal({area: "house"}));
const zoo = animal({area: "zoo", enclosure: "reptile_house-1", zone: "river_lake"});
const wild = animal({island: "wild"});
const other = animal({species: "zebra", island: "wild"});
const ark = snapshotOf([...homes, zoo, wild, other]);

test("a kind's count by place: the whole Ark first, only the places that have any, the most first", () => {
    const where = arkKindWhere(ark, "axolotl", zoo.id)!;
    assert.equal(where.total, 9);
    assert.deepEqual(where.places, [{place: "homes", count: 7}, {place: "wild", count: 1}, {place: "zoo", count: 1}]);
    assert.equal(where.name, "Axolotl");
    assert.equal(arkKindWholeText(where, ARK_GRAPH_ENGLISH, "en"), "9 in the whole Ark · 7 in homes · 1 wild · 1 at the zoo");
    assert.equal(arkKindWhere(ark, "unknown", null), null, "none aboard, nothing said");
    assert.equal(arkKindWhere(null, "axolotl", null), null);
});

test("where the tapped animal is: alone in its enclosure, or 1 of N in the same place", () => {
    const alone = arkKindWhere(ark, "axolotl", zoo.id)!;
    assert.deepEqual(alone.here, {place: "zoo", count: 1});
    assert.equal(arkKindHereText(alone, ARK_GRAPH_ENGLISH, "en"), "This one: alone in its zoo enclosure");
    // Homes breed in one place (words say "the same place": true if homes become one each).
    const home = arkKindWhere(ark, "axolotl", homes[0].id)!;
    assert.equal(arkKindHereText(home, ARK_GRAPH_ENGLISH, "en"), "This one: 1 of 7 in homes");
    // Two in one enclosure share it; a third in another enclosure of the same type does not.
    const a = animal({area: "zoo", enclosure: "reptile_house-1"});
    const b = animal({area: "zoo", enclosure: "reptile_house-1"});
    const c = animal({area: "zoo", enclosure: "reptile_house-2"});
    const zoos = snapshotOf([a, b, c]);
    assert.deepEqual(arkKindWhere(zoos, "axolotl", a.id)!.here, {place: "zoo", count: 2});
    assert.deepEqual(arkKindWhere(zoos, "axolotl", c.id)!.here, {place: "zoo", count: 1});
    assert.equal(arkKindHereText(arkKindWhere(zoos, "axolotl", a.id)!, ARK_GRAPH_ENGLISH, "en"), "This one: 1 of 2 in its zoo enclosure");
    // An animal of another kind, or none tapped: no line.
    assert.equal(arkKindWhere(ark, "axolotl", other.id)!.here, null);
    assert.equal(arkKindHereText(arkKindWhere(ark, "axolotl", null)!, ARK_GRAPH_ENGLISH, "en"), null);
});

test("the five places: a kept area, else the town's wildlife or the wild; one island has no town", () => {
    assert.equal(arkKindPlaceOf({island: "town", area: "house"}, true), "homes");
    assert.equal(arkKindPlaceOf({island: "town", area: "farm"}, true), "farms");
    assert.equal(arkKindPlaceOf({island: "town", area: "zoo"}, true), "zoo");
    assert.equal(arkKindPlaceOf({island: "town", area: null}, true), "town");
    assert.equal(arkKindPlaceOf({island: "wild", area: null}, true), "wild");
    // One-island read (no `island` on any animal): kept animals are still homes and farms, the rest wild.
    assert.equal(arkKindPlaceOf({area: "house"}, false), "homes");
    assert.equal(arkKindPlaceOf({area: null}, false), "wild");
    // Town wildlife: its count and its words.
    const town = snapshotOf([animal({island: "town", area: null}), animal({island: "town", area: "farm"}), animal({island: "wild"})]);
    const where = arkKindWhere(town, "axolotl", null)!;
    assert.deepEqual(where.places.map((one) => one.place).sort(), ["farms", "town", "wild"]);
    assert.equal(arkKindWholeText(where, ARK_GRAPH_ENGLISH, "en"), "3 in the whole Ark · 1 wild · 1 on farms · 1 in town wildlife");
});

test("the breakdown reads no one's identity: only the five places and counts", () => {
    const text = JSON.stringify(arkKindWhere(ark, "axolotl", zoo.id));
    assert.ok(!/someone|brought|@/.test(text));
    assert.ok(!/reptile/.test(text), "not even the enclosure's name");
});

test("the words for another language, English key by key where a bundle lacks them", () => {
    const words = arkGraphWords({whole: "{count} im ganzen Ark", placeHomes: "{count} zu Hause"});
    const where = arkKindWhere(ark, "axolotl", null)!;
    assert.equal(arkKindWholeText(where, words, "en"), "9 im ganzen Ark · 7 zu Hause · 1 wild · 1 at the zoo");
});

test("a point's own changes: arrivals from photos, births and deaths of the step that ended there", () => {
    const zeros = [0, 0, 0, 0];
    const series: ArkSeries = {times: [0, 1, 2, 3], counts: [4, 4, 6, 5], arrived: [0, 0, 2, 0], born: [0, 0, 1, 0], revived: zeros, died: [0, 0, 0, 2], eaten: [0, 0, 0, 1]};
    assert.deepEqual(arkStepChanges(series, 2), [["arrived", 2], ["born", 1]]);
    assert.deepEqual(arkStepChanges(series, 3), [["died", 2], ["eaten", 1]]);
    assert.deepEqual(arkStepChanges(series, 1), []);
    assert.deepEqual(arkStepChanges(series, 9), [], "past the end: nothing");
});
