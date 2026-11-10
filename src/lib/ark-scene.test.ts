import assert from "node:assert/strict";
import test from "node:test";
import fixture from "@/ark-scene/fixtures/snapshot.json";
import early from "@/ark-scene/fixtures/snapshot-early.json";
import {placeAnimals} from "@/ark-scene/placement";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {ARK_ZONES, type ArkSnapshot} from "@/ark-scene/types";
import {sampleGround, ZONE_SITES} from "@/ark-scene/world";

const full = decodeArkSnapshot(fixture)!;

test("the fixtures decode whole and cover every zone", () => {
    assert.equal(full.animals.length, 120);
    assert.equal(full.counts.species, 41);
    assert.deepEqual(new Set(full.animals.map((a) => a.zone)), new Set(ARK_ZONES));
    const beginning = decodeArkSnapshot(early)!;
    assert.deepEqual(beginning.animals.map((a) => a.model_slug).sort(), ["komodo-dragon", "red-tailed-hawk"]);
    assert.ok(beginning.animals.every((a) => !a.brought_by.named && /^Voyager \d+$/.test(a.brought_by.label)));
});

test("a malformed animal is dropped, an unknown zone goes Home, never the whole Ark", () => {
    const raw = JSON.parse(JSON.stringify(early)) as ArkSnapshot & {animals: unknown[]};
    raw.animals.push({id: "x"}, {...raw.animals[0], id: "y", zone: "moon"});
    const decoded = decodeArkSnapshot(raw)!;
    assert.equal(decoded.animals.length, 3);
    assert.equal(decoded.animals.find((a) => a.id === "y")?.zone, "farm_garden");
    assert.equal(decodeArkSnapshot(null), null);
});

test("every animal stands on its zone's kind of ground, apart from the others", () => {
    const places = placeAnimals(full.animals);
    for (const animal of full.animals) {
        const place = places.get(animal.id)!;
        const height = sampleGround(place.x, place.z).height;
        if (ZONE_SITES[animal.zone].kind === "sea") assert.ok(height < -1.2, `${animal.name} at sea`);
        if (ZONE_SITES[animal.zone].kind === "land") assert.ok(height > 0.25, `${animal.name} on land`);
    }
    const list = [...places.values()];
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
            assert.ok(Math.hypot(list[i].x - list[j].x, list[i].z - list[j].z) > 0.9, "no two animals in one spot");
        }
    }
});

test("an arrival never moves the animals already aboard", () => {
    const before = placeAnimals(full.animals.slice(0, 80));
    const after = placeAnimals(full.animals);
    for (const [id, place] of before) assert.deepEqual(after.get(id), place);
});
