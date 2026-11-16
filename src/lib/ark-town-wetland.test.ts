/**
 * The town's millpond and wetland (pass 2, lane LAND; the owner, 2026-11-16: "the sides and water of the pond / lake in
 * the town island is layered above the ground so there's a gap - the area should be inhabitable too by ducks also and
 * maybe pond animals like frogs and fish and insects despite being in the town island"):
 * - the bank meets the water: all round the water's edge the ground is at or just over its level (the sheet's edge
 *   tucked under the bank), the bowl's bed under it and over the sea's level (the sea's plane never shows through);
 * - the town's wildlife whose stored record puts it in fresh water lives at the town's wetland (fish in the water
 *   itself), from the record only (`wetland.ts`).
 */
import assert from "node:assert/strict";
import test from "node:test";
import type {ArkAnimal} from "@/ark-scene/types";
import {sampleTownGround, townHeight} from "@/ark-scene/islands/town/ground";
import {CANAL, CANAL_LEVEL, CANAL_WIDTH, MILLPOND} from "@/ark-scene/islands/town/plan";
import {polylineDistance} from "@/ark-scene/islands/town/geom";
import {townWetlandOf} from "@/ark-scene/islands/town/wetland";
import {placeTownAnimals, type TownPlace} from "@/ark-scene/islands/town/placement";

test("the millpond's bank meets its water all round, and its bed is over the sea", () => {
    for (let k = 0; k < 360; k++) {
        const a = (k / 360) * Math.PI * 2;
        const at = (r: number) => ({x: MILLPOND.x + Math.cos(a) * MILLPOND.rx * r, z: MILLPOND.z + Math.sin(a) * MILLPOND.rz * r});
        const rim = at(1);
        // (Where the canal leaves it, the bank is the canal's walled channel.)
        if (polylineDistance(CANAL, rim.x, rim.z) < CANAL_WIDTH / 2 + 6) continue;
        const h = townHeight(rim.x, rim.z);
        assert.ok(h >= CANAL_LEVEL + 0.02 && h < CANAL_LEVEL + 0.3, `rim at ${k}°: ${h.toFixed(2)} m for water at ${CANAL_LEVEL}`);
        // Out from the rim the bank climbs, never dipping under the water again.
        for (const r of [1.05, 1.15, 1.3]) {
            const p = at(r);
            assert.ok(townHeight(p.x, p.z) >= CANAL_LEVEL, `bank at ${k}° r ${r}`);
        }
        // In from it, water over the ground, and the bed over the sea's 0.
        for (const r of [0.8, 0.5, 0.1]) {
            const p = at(r);
            const g = sampleTownGround(p.x, p.z);
            assert.ok(g.height < CANAL_LEVEL - 0.3 && g.height > 0.05, `bed at ${k}° r ${r}: ${g.height.toFixed(2)}`);
            assert.equal(g.surface, "water");
        }
    }
});

test("pond life by its stored record: fish swim, ducks and frogs at the edge, the shore's waders and land animals not", () => {
    assert.equal(townWetlandOf("koi", "farm_garden")?.swims, true);
    assert.equal(townWetlandOf("goldfish", "farm_garden")?.swims, true);
    assert.equal(townWetlandOf("mallard", "river_lake")?.swims, false);
    assert.equal(townWetlandOf("muscovy-duck", "river_lake")?.swims, false);
    assert.equal(townWetlandOf("black-crowned-night-heron", "wetland")?.swims, false);
    // (A toad whose record names no water or pond habitat stays in the gardens: only the record moves an animal.)
    assert.equal(townWetlandOf("american-toad", "farm_garden"), null);
    assert.ok(townWetlandOf("common-flangetail", "river_lake")?.why.includes("ponds"), "a dragonfly whose habitat names ponds");
    assert.equal(townWetlandOf("eurasian-oystercatcher", "seashore"), null);
    assert.equal(townWetlandOf("red-fox", "farm_garden"), null);
    assert.equal(townWetlandOf("house-sparrow", "farm_garden"), null);
});

function wild(i: number, slug: string, zone: string): ArkAnimal {
    return {id: `wet-${String(i).padStart(4, "0")}-${slug}`, species_profile_id: `sp-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone, arrived_at: `2026-10-${String(1 + (i % 28)).padStart(2, "0")}T00:00:00Z`, brought_by: {label: "x", named: false}, mine: false, area: null, island: "town", enclosure: null, slot: i % 12, slot_rank: i % 3} as unknown as ArkAnimal;
}

test("the town's pond life is placed at its wetland, a fish in the water itself", () => {
    const mix: Array<[string, string, number]> = [["koi", "farm_garden", 6], ["goldfish", "farm_garden", 6], ["japanese-rice-fish", "farm_garden", 4], ["mallard", "river_lake", 8], ["black-crowned-night-heron", "wetland", 3], ["american-toad", "farm_garden", 3], ["common-flangetail", "river_lake", 3], ["red-fox", "farm_garden", 3]];
    const animals: ArkAnimal[] = [];
    let i = 0;
    for (const [slug, zone, n] of mix) for (let k = 0; k < n; k++) animals.push(wild(i++, slug, zone));
    const placed = placeTownAnimals(animals);
    for (const a of animals) {
        const info = placed.town.get(a.id) as TownPlace;
        const p = placed.places.get(a.id)!;
        const wet = townWetlandOf(a.model_slug, a.zone);
        if (!wet) {
            assert.ok(!["millpond", "farm_pond", "canal"].includes(info.where), `${a.model_slug} at ${info.where}`);
            continue;
        }
        assert.ok(["millpond", "farm_pond", "canal"].includes(info.where), `${a.model_slug} at ${info.where}`);
        if (wet.swims) assert.ok(townHeight(p.x, p.z) < p.ground - 0.15, `${a.model_slug} in the water at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}): ground ${townHeight(p.x, p.z).toFixed(2)}, surface ${p.ground.toFixed(2)}`);
    }
});
