import assert from "node:assert/strict";
import test from "node:test";
import layersTable from "@/ark-scene/layers.json";
import {canopyPoint, speciesLayer, tunnelPoint} from "@/ark-scene/layers";
import {ARK_MOMENTS, canMoment, momentPose, MOMENT_SECONDS} from "@/ark-scene/moments";
import {placeAnimals} from "@/ark-scene/placement";
import type {ArkAnimal} from "@/ark-scene/types";
import {heightAt} from "@/ark-scene/world";

function animal(slug: string, zone: ArkAnimal["zone"], slot: number, rank = 0): ArkAnimal {
    return {id: `${slug}-${zone}-${slot}-${rank}`, species_profile_id: slug, name: slug, scientific_name: null, model_slug: slug, zone, arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "Voyager 1", named: false}, mine: false, slot, slot_rank: rank};
}

test("layers: from stored data; the canopy's climbers, perchers and hangers, the underground, the sea's layers", () => {
    assert.deepEqual([speciesLayer("spider-monkey").layer, speciesLayer("spider-monkey").mode, speciesLayer("spider-monkey").primate], ["canopy", "climb", true]);
    assert.equal(speciesLayer("brown-throated-sloth").mode, "hang");
    assert.equal(speciesLayer("siamang").mode, "leap");
    assert.equal(speciesLayer("keel-billed-toucan").mode, "perch");
    assert.equal(speciesLayer("star-nosed-mole").layer, "underground");
    assert.equal(speciesLayer("wonderpus-octopus").mode, "floor");
    assert.equal(speciesLayer("whale-shark").mode, "filter");
    assert.equal(speciesLayer("stoplight-loosejaw").layer, "deep");
    assert.equal(speciesLayer("stoplight-loosejaw").glow, true);
    // A goat that "browses low branches" stays on the ground; a species not in the table is on the ground.
    assert.equal(speciesLayer("domestic-goat").layer, "ground");
    assert.equal(speciesLayer("not-a-species").layer, "ground");
    for (const [, row] of Object.entries((layersTable as unknown as {species: Record<string, string[]>}).species)) assert.ok(row[2].length > 4);
});

test("layers: canopy animals stand on their trees' limbs, crowns and trunks, above the ground; nobody moves; a burrow is its own", () => {
    const animals = [
        animal("spider-monkey", "rainforest", 30, 0), animal("spider-monkey", "rainforest", 30, 1), animal("spider-monkey", "rainforest", 30, 2),
        animal("brown-throated-sloth", "rainforest", 31), animal("keel-billed-toucan", "rainforest", 32), animal("siamang", "rainforest", 33),
        animal("red-squirrel", "woodland", 30), animal("star-nosed-mole", "woodland", 31), animal("naked-mole-rat", "desert", 30)
    ];
    const places = placeAnimals(animals);
    for (const a of animals.slice(0, 7)) {
        const place = places.get(a.id)!;
        // In the canopy: a limb of a canopy tree, or (a small one, the map's rule) a branch, a leaf or the bark of one.
        const attach = place.micro?.attach;
        assert.ok(place.canopy || (attach && ["branch", "leaf", "bark"].includes(attach.tag)), `${a.model_slug} in the canopy`);
        assert.ok(place.ground > heightAt(place.x, place.z) + 0.5, `${a.model_slug} up its tree`);
        if (place.canopy) {
            const point = canopyPoint(a.zone, place.canopy);
            assert.deepEqual([point.x, point.y, point.z], [place.x, place.ground, place.z]);
        }
    }
    // A troop spreads over the tree's limbs: no two in one spot.
    const troop = animals.slice(0, 3).map((a) => places.get(a.id)!);
    for (let i = 0; i < troop.length; i++) for (let j = i + 1; j < troop.length; j++) assert.ok(Math.hypot(troop[i].x - troop[j].x, troop[i].ground - troop[j].ground, troop[i].z - troop[j].z) > 0.3);
    const mole = places.get(animals[7].id)!;
    assert.ok(mole.burrow);
    const chamber = tunnelPoint(mole.burrow!, 1);
    assert.ok(chamber.y < mole.burrow!.ground - 0.5, "the chamber is underground");
    const after = placeAnimals(animals.filter((_, i) => i % 2 === 0));
    after.forEach((place, id) => assert.deepEqual(place, places.get(id)));
});

test("moments: cosmetic, and each ends where it began (nobody else takes part, nothing is eaten)", () => {
    assert.ok(canMoment("seabird_dive", "atlantic-puffin", "seashore"));
    assert.ok(canMoment("whale_surface", "humpback-whale", "open_ocean"));
    assert.ok(!canMoment("whale_surface", "whale-shark", "open_ocean"), "a whale shark has no blowhole");
    assert.ok(canMoment("owl_swoop", "barn-owl", "farm_garden"));
    assert.ok(canMoment("primate_drop", "spider-monkey", "rainforest"));
    assert.ok(!canMoment("primate_drop", "keel-billed-toucan", "rainforest"));
    const from = {x: -36, y: 4.2, z: 27, yaw: 0.7};
    for (const kind of ARK_MOMENTS) {
        assert.ok(MOMENT_SECONDS[kind] >= 5 && MOMENT_SECONDS[kind] <= 9);
        const end = momentPose(kind, kind === "whale_surface" ? {...from, x: 60, z: 104, y: -2} : from, 0.999, 2);
        const start = kind === "whale_surface" ? {x: 60, y: -2, z: 104} : from;
        assert.ok(Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z) < 0.15, `${kind} ends where it began`);
    }
});
