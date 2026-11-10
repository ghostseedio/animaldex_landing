import assert from "node:assert/strict";
import test from "node:test";
import fixture from "@/ark-scene/fixtures/snapshot.json";
import early from "@/ark-scene/fixtures/snapshot-early.json";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
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
        if (ZONE_SITES[animal.zone].kind === "shore") {
            // On the beach: dry, and still within the sand strip by the water.
            const ground = sampleGround(place.x, place.z);
            assert.ok(ground.height > 0.1 && ground.land < 0.995, `${animal.name} on the beach`);
        }
    }
    const list = Array.from(places.values());
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
            assert.ok(Math.hypot(list[i].x - list[j].x, list[i].z - list[j].z) > 0.9, "no two animals in one spot");
        }
    }
});

test("an arrival never moves the animals already aboard", () => {
    const before = placeAnimals(full.animals.slice(0, 80));
    const after = placeAnimals(full.animals);
    before.forEach((place, id) => assert.deepEqual(after.get(id), place));
});

test("a departure never moves anyone: the v2 fixture's places are the server's, decided at arrival", () => {
    const v2 = decodeArkSnapshot(fixtureV2)!;
    assert.ok(v2.animals.every((a) => typeof a.slot === "number" && typeof a.slot_rank === "number"));
    const before = placeAnimals(v2.animals);
    // Every third animal leaves (eaten, old, starved): the rest stand where they stood.
    const after = placeAnimals(v2.animals.filter((_, i) => i % 3 !== 0));
    after.forEach((place, id) => {
        const was = before.get(id)!;
        assert.deepEqual([place.x, place.z, place.yaw, place.ground], [was.x, was.z, was.yaw, was.ground], id);
    });
    // Nobody stands on a slot's own spot but its own, and a cluster's members stand apart. (Two
    // neighbouring herds may brush at their edges: their members fill the gaps between the slots.)
    const animals = v2.animals;
    for (let i = 0; i < animals.length; i++) {
        for (let j = i + 1; j < animals.length; j++) {
            const a = animals[i];
            const b = animals[j];
            const sameCluster = a.zone === b.zone && a.slot === b.slot;
            if (!sameCluster && a.slot_rank !== 0 && b.slot_rank !== 0) continue;
            const p = before.get(a.id)!;
            const q = before.get(b.id)!;
            assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > 0.9, `${a.model_slug} ${a.slot}/${a.slot_rank} and ${b.model_slug} ${b.slot}/${b.slot_rank} in one spot`);
        }
    }
});
