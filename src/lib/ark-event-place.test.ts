// ARK-LOG-FOOD: an event says where it happened (the read's `place`), not where its animal lives now.
import assert from "node:assert/strict";
import test from "node:test";
import {arkAnimalAtPlace, decodeArkEventPlace, decodeArkEvents} from "@/lib/ark-life";

const animal = (id: string, over: Record<string, unknown> = {}) => ({id, species_profile_id: `sp-${id}`, name: `Hare ${id}`, model_slug: "european-hare", zone: "grassland", arrived_at: "2026-11-01T00:00:00Z", origin: "arrived", generation: 0, slot: 1, slot_rank: 0, activity: null, sociality: null, status: "present", island: "town", area: "zoo", ...over});
const row = (id: number, kind: string, extra: Record<string, unknown>) => ({id, kind, at: `2026-11-23T01:0${id}:00.000000Z`, ark_day: 100 + id, species_profile_id: "sp-a", species: "Hare", ...extra});

test("place: decoded from the read, only the two known words", () => {
    assert.deepEqual(decodeArkEventPlace({island: "wild"}), {island: "wild", area: null});
    assert.deepEqual(decodeArkEventPlace({island: "town", area: "zoo"}), {island: "town", area: "zoo"});
    assert.deepEqual(decodeArkEventPlace({island: "town", area: "attic"}), {island: "town", area: null});
    assert.equal(decodeArkEventPlace({island: "moon"}), undefined);
    assert.equal(decodeArkEventPlace(null), undefined);
    assert.equal(decodeArkEventPlace([]), undefined);
});

test("a death in the wild of an animal now in the zoo's care says the wild; an older event keeps its place now", () => {
    const events = decodeArkEvents({events: [
        row(1, "death_old", {animal: animal("a"), place: {island: "wild"}}),
        row(2, "death_old", {animal: animal("b")})
    ]}, null);
    assert.deepEqual([events[0].animal?.island, events[0].animal?.area, events[0].place], ["wild", null, {island: "wild", area: null}]);
    // (No place: as before, the animal as the server sends it now.)
    assert.deepEqual([events[1].animal?.island, events[1].animal?.area, "place" in events[1]], ["town", "zoo", false]);
});

test("a meal's prey takes the place of its own eaten row; the hunter its meal's", () => {
    const events = decodeArkEvents({events: [
        row(1, "meal", {animal: animal("fox", {island: "wild", area: null}), other: animal("hare"), place: {island: "wild"}}),
        row(2, "eaten", {animal: animal("hare"), other: animal("fox", {island: "wild", area: null}), place: {island: "wild"}})
    ]}, null);
    const meal = events.find((e) => e.kind === "meal")!;
    assert.deepEqual([meal.animal?.island, meal.other?.island, meal.other?.area], ["wild", "wild", null]);
});

test("arkAnimalAtPlace: nothing changes without a place", () => {
    assert.equal(arkAnimalAtPlace(null, {island: "wild", area: null}), null);
    const decoded = decodeArkEvents({events: [row(1, "birth", {animal: animal("y")})]}, null)[0].animal;
    assert.equal(arkAnimalAtPlace(decoded, undefined), decoded);
});
