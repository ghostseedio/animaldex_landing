/**
 * The town's waterfowl on its waters (p3, lane ZOOFIX; the coordinator's frame: a mallard on the canal drawn standing ON
 * the water, its legs and feet showing).
 *
 * Cause: every town water is above the sea, so placement gives a swimmer its spot at the water's surface on its own
 * ground (`town/placement.ts`, `water: false`). The schedule's pose floats a duck at its float line (`index.ts`
 * fromSchedule, `inDepthBand`), but until its schedule is in (the first seconds, and after every re-plan), walked off its
 * spot, or as a far figure, the scene drew it from its place: its base at the surface, stood on the water. Now a floater
 * over water is drawn at its float line from its place too (`water-float.ts` floatOver).
 *
 * Here: real waterfowl of the town (the canal and its ponds, the farm's and the zoo's waters, as the live Ark has them),
 * placed and scheduled through an Ark day as the scene draws them: no sample has its feet over the surface.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type {ArkAnimal} from "@/ark-scene/types";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {setTownWalkSurfaces, townWaterSurface} from "@/ark-scene/islands/town/drawn-ground";
import {townDayEpochs, validateTownAnimals} from "@/ark-scene/islands/town/validate-animals";
import {floatOver} from "@/ark-scene/water-float";
import {swimDepth} from "@/ark-scene/sea-depth";
import {zooTypeOfSlug} from "@/ark-scene/islands/routing";

/** Slug, zone and area as the live Ark has its town waterfowl (`area` null: the town's own canal and ponds). */
const KINDS: Array<[string, string, string | null]> = [
    ["mallard", "river_lake", null], ["muscovy-duck", "river_lake", null], ["egyptian-goose", "river_lake", null],
    ["mallard", "river_lake", "farm"], ["domestic-duck", "farm_garden", "farm"], ["domestic-goose", "farm_garden", "farm"],
    ["mute-swan", "river_lake", "zoo"], ["black-swan", "river_lake", "zoo"], ["greylag-goose", "river_lake", "zoo"], ["cape-teal", "wetland", "zoo"],
    ["ruddy-shelduck", "river_lake", "zoo"], ["lesser-whistling-duck", "wetland", "zoo"], ["cotton-pygmy-goose", "wetland", "zoo"]
];

function bird(i: number, slug: string, zone: string, area: string | null): ArkAnimal {
    const enclosure = area === "zoo" ? `${zooTypeOfSlug(slug)}-1` : null;
    return {id: `wf-${String(i).padStart(4, "0")}-${slug}`, species_profile_id: `sp-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone: zone as ArkAnimal["zone"], arrived_at: `2026-11-${String(1 + (i % 9)).padStart(2, "0")}T10:00:00Z`, brought_by: {label: "x", named: false}, mine: false, area, island: "town", enclosure} as ArkAnimal;
}

const animals: ArkAnimal[] = [];
KINDS.forEach(([slug, zone, area], k) => {
    for (let j = 0; j < 3; j++) animals.push(bird(k * 3 + j, slug, zone, area));
});

test("the town's waterfowl placed on its waters float at their float line, not on the surface (the old rule stood them on it)", () => {
    const placed = placeTownAnimals(animals);
    let onWater = 0;
    let oldOnTop = 0;
    for (const a of animals) {
        const place = placed.places.get(a.id)!;
        const surface = townWaterSurface(place.x, place.z);
        if (surface === null || townHeight(place.x, place.z) >= surface - 0.05) continue;
        onWater++;
        // (The old rule: its base at its place's height, the surface or over it.)
        if (place.ground >= surface - 0.02) oldOnTop++;
        const float = floatOver(swimDepth(a.model_slug, a.zone), townHeight(place.x, place.z), surface, 0.4);
        assert.ok(float, `${a.id} floats`);
        assert.ok(float.base < surface - 0.4 * 0.2, `${a.id}: base ${float.base.toFixed(2)} vs surface ${surface.toFixed(2)}`);
    }
    console.log(`town waterfowl: ${animals.length} birds, ${onWater} placed on water (${oldOnTop} stood on its surface by the old rule)`);
    assert.ok(onWater >= 3, `the canal's and ponds' birds are on the water (${onWater})`);
    assert.ok(oldOnTop > 0, "the old rule stood them on the surface");
});

test("through an Ark day: no waterfowl over water ever has its feet above the surface", () => {
    const check = validateTownAnimals(animals, {epochs: townDayEpochs(24)});
    setTownWalkSurfaces(null);
    console.log(`town waterfowl through a day: ${check.samples} samples ${JSON.stringify(check.kinds)}; on the water ${check.counts.on_water}, sinks ${check.counts.sinks}`);
    assert.ok(check.kinds.water > 40, `water samples ${check.kinds.water}`);
    assert.equal(check.counts.on_water, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("on_water")).slice(0, 5)));
    assert.equal(check.counts.sinks, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("sinks")).slice(0, 5)));
});
