import assert from "node:assert/strict";
import test from "node:test";
import table from "@/ark-scene/microhabitats.json";
import {COTTAGE} from "@/ark-scene/micro-decor";
import {MICRO_SPOTS, microDrawnLength, microPlace, microSpecies, surfacePoint} from "@/ark-scene/micro";
import {placeAnimals} from "@/ark-scene/placement";
import {ARK_SIZE_FLOOR} from "@/ark-scene/stats";
import type {ArkAnimal} from "@/ark-scene/types";

const rows = (table as unknown as {species: Record<string, string[]>}).species;

test("microhabitats: every row is a known spot with its reason; the owner's examples are where he put them", () => {
    for (const [slug, row] of Object.entries(rows)) {
        assert.ok((MICRO_SPOTS as readonly string[]).includes(row[0]), slug);
        assert.ok(row[1].length > 8, `${slug} keeps its reason`);
    }
    // Geckos, house spiders and ants on the cottage; moths there are moths; pets and house sparrows round it.
    for (const slug of ["mediterranean-house-gecko", "tropical-house-gecko", "common-house-gecko", "common-house-spider", "black-ant"]) assert.equal(microSpecies(slug)?.spot, "house", slug);
    assert.equal(microSpecies("clothes-house-moth")?.moth, true);
    for (const slug of ["domestic-cat", "domestic-dog", "house-sparrow", "house-mouse"]) assert.equal(microSpecies(slug)?.spot, "house", slug);
    assert.equal(microPlace("domestic-dog", "farm_garden", 3, 0, 0.8)?.surface, "around");
    assert.equal(microPlace("house-sparrow", "farm_garden", 3, 0, 0.13)?.surface, "roof");
    assert.equal(microPlace("mediterranean-house-gecko", "farm_garden", 3, 0, 0.1)?.surface, "wall");
    // A big animal is not small; the sea keeps its own.
    assert.equal(microSpecies("african-bush-elephant"), null);
    assert.equal(microSpecies("blue-whale"), null);
});

function animal(slug: string, zone: ArkAnimal["zone"], slot: number, rank = 0): ArkAnimal {
    return {id: `${slug}-${zone}-${slot}-${rank}`, species_profile_id: slug, name: slug, scientific_name: null, model_slug: slug, zone, arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "Voyager 1", named: false}, mine: false, slot, slot_rank: rank};
}

test("microhabitats: on the cottage's walls, in the plane of a wall and inside it; every slot its own point", () => {
    const halfW = COTTAGE.width / 2;
    const halfD = COTTAGE.depth / 2;
    const seen: Array<[number, number, number]> = [];
    for (let slot = 0; slot < 60; slot++) {
        const place = microPlace("mediterranean-house-gecko", "farm_garden", slot, 0, 0.1)!;
        const p = surfacePoint(place, "farm_garden");
        const lx = p.x - COTTAGE.x;
        const lz = p.z - COTTAGE.z;
        const onWall = Math.abs(Math.abs(lx) - halfW) < 0.03 || Math.abs(Math.abs(lz) - halfD) < 0.03;
        assert.ok(onWall && Math.abs(lx) <= halfW + 0.03 && Math.abs(lz) <= halfD + 0.03, `slot ${slot} on a wall`);
        assert.ok(p.y > COTTAGE.floor && p.y < COTTAGE.floor + COTTAGE.wall, `slot ${slot} between the floor and the eaves`);
        // Its back to the wall's normal, heading along the wall.
        assert.ok(Math.abs(p.nx * p.tx + p.ny * p.ty + p.nz * p.tz) < 1e-6);
        for (const q of seen) assert.ok(Math.hypot(q[0] - p.x, q[1] - p.y, q[2] - p.z) > 0.02, `slot ${slot} has its own point`);
        seen.push([p.x, p.y, p.z]);
    }
});

test("microhabitats: nobody moves when another small animal arrives or leaves", () => {
    const animals = [
        animal("mediterranean-house-gecko", "farm_garden", 40),
        animal("common-house-spider", "farm_garden", 41),
        animal("black-ant", "farm_garden", 42, 0),
        animal("black-ant", "farm_garden", 42, 1),
        animal("black-ant", "farm_garden", 42, 2),
        animal("marmalade-hoverfly", "farm_garden", 43),
        animal("green-anole", "farm_garden", 44),
        animal("yellow-spotted-millipede", "woodland", 30),
        animal("water-strider", "river_lake", 20),
        animal("common-wall-lizard", "farm_garden", 45),
        animal("domestic-cat", "farm_garden", 46)
    ];
    const before = placeAnimals(animals);
    assert.ok(animals.every((a) => before.get(a.id)?.micro), "all at a microhabitat");
    const after = placeAnimals(animals.filter((_, i) => i % 2 === 0));
    after.forEach((place, id) => assert.deepEqual(place, before.get(id)));
    const more = placeAnimals([...animals, animal("tropical-house-gecko", "farm_garden", 47), animal("house-fly", "woodland", 31)]);
    before.forEach((place, id) => assert.deepEqual(more.get(id), place));
});

test("microhabitats: true size close by, never under the minimum on screen, the usual length (and the marker) from afar", () => {
    const L = 0.005;
    const full = ARK_SIZE_FLOOR;
    let last = 0;
    for (let d = 0.05; d < 200; d *= 1.15) {
        const drawn = microDrawnLength(L, full, d, 800, 38, 16);
        assert.ok(drawn >= L && drawn <= full);
        assert.ok(drawn >= last - 1e-12, "it grows (in the world) as the camera draws back, never pops");
        last = drawn;
    }
    assert.equal(microDrawnLength(L, full, 0.1, 800, 38, 16), L);
    assert.equal(microDrawnLength(L, full, 150, 800, 38, 16), full);
});
