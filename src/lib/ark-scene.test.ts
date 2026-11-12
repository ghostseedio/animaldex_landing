import assert from "node:assert/strict";
import test from "node:test";
import fixture from "@/ark-scene/fixtures/snapshot.json";
import early from "@/ark-scene/fixtures/snapshot-early.json";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {placeAnimals} from "@/ark-scene/placement";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {ARK_ZONES, type ArkSnapshot} from "@/ark-scene/types";
import type {Placement} from "@/ark-scene/placement";
import {arkBody} from "@/ark-scene/stats";
import {mapPoints} from "@/ark-scene/map/place";

/**
 * Apart: on the ground 0.9 m between any two; a small animal on its
 * attach point (a gecko on a wall, a beetle on a trunk) with its body clear
 * of anyone's (centres further apart than their half-lengths), in 3D.
 */
function apart(p: Placement, q: Placement, lengthP: number, lengthQ: number): boolean {
    // (A perched bird or lizard is on its attach point like a micro animal: its body clear of the others in 3D.)
    if (!p.micro && !q.micro && !p.perch && !q.perch) return Math.hypot(p.x - q.x, p.z - q.z) > 0.9;
    // A small one on its attach point: their bodies do not overlap (centres at least their half-lengths apart; at true size three
    // 0.3 m puffins on one ledge stand a body apart, touching, which is a colony, not an overlap).
    return Math.hypot(p.x - q.x, p.ground - q.ground, p.z - q.z) > Math.max((lengthP + lengthQ) / 2, 0.02) - 1e-6;
}

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

test("every animal stands on its map tag's ground (the Ark map, B3), apart from the others", () => {
    const places = placeAnimals(full.animals);
    const sampler = mapPoints().sampler;
    for (const animal of full.animals) {
        const place = places.get(animal.id)!;
        assert.ok(place.map, `${animal.name} on the map`);
        // (A perched animal stands for its attach point's tags, which the validator checks.)
        if (place.map!.held || place.canopy || place.micro || place.perch) continue;
        const ground = sampler.ground(place.x, place.z);
        assert.ok(ground.tags.includes(place.map!.tag!), `${animal.name} on ${place.map!.tag}`);
        // At sea in the sea, on land on land.
        if (place.sea) assert.equal(ground.water, "sea", `${animal.name} at sea`);
        if (!place.water) assert.ok(ground.water === null || place.ground > 0.2, `${animal.name} on dry ground`);
    }
    for (let i = 0; i < full.animals.length; i++) {
        for (let j = i + 1; j < full.animals.length; j++) {
            const a = full.animals[i];
            const b = full.animals[j];
            assert.ok(apart(places.get(a.id)!, places.get(b.id)!, arkBody(a).metres, arkBody(b).metres), `${a.model_slug} and ${b.model_slug} in one spot`);
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
            assert.ok(apart(p, q, arkBody(a).metres, arkBody(b).metres), `${a.model_slug} ${a.slot}/${a.slot_rank} and ${b.model_slug} ${b.slot}/${b.slot_rank} in one spot`);
        }
    }
});
