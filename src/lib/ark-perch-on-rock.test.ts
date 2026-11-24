/**
 * A small animal's home beside a ledge or a rock face sits on that surface, never on the cliff ground beside it
 * (SPECIES-ANIM-B2, 2026-11-24). The case: a tropical house gecko homed on `ledge:ground:74` (farm garden, slot 57) stood
 * 0.26 m off it on a 2.05 slope, resting there all day (405 of the collisions' cliff samples); an elephant shrew's spot was
 * 0.3 m up a rock face its grounding held it under.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {setArkWorld} from "@/ark-scene/world";
import type {ArkAnimal} from "@/ark-scene/types";

setArkWorld("v2");

const animal = (slug: string, zone: ArkAnimal["zone"], slot: number, rank: number): ArkAnimal => ({
    id: `${slug}#${zone}#${slot}#${rank}`,
    species_profile_id: slug,
    name: slug,
    scientific_name: null,
    model_slug: slug,
    zone,
    arrived_at: "2026-11-24T00:00:00.000Z",
    slot,
    slot_rank: rank,
    brought_by: {label: "A voyager", named: false},
    mine: false,
    activity: "nocturnal",
    sociality: "solitary"
});

test("v2: the tropical house gecko on ledge:ground:74 is homed on the ledge itself", async () => {
    const {placeAnimals} = await import("@/ark-scene/placement");
    const gecko = animal("tropical-house-gecko", "farm_garden", 57, 0);
    const place = placeAnimals([gecko]).get(gecko.id)!;
    const point = place.map?.attach;
    assert.equal(point?.id, "ledge:ground:74");
    assert.ok(Math.hypot(place.x - point!.x, place.z - point!.z) < 0.01 && Math.abs(place.ground - point!.y) < 0.01, `home ${place.x.toFixed(2)},${place.z.toFixed(2)} ${place.ground.toFixed(2)}; ledge ${point!.x.toFixed(2)},${point!.z.toFixed(2)} ${point!.y.toFixed(2)}`);
});

test("v2: every small animal homed on a ledge or a rock face sits on it, never on cliff ground (geckos, lizards, shrews; 400 slots)", async () => {
    const {placeAnimals} = await import("@/ark-scene/placement");
    const {mapPoints} = await import("@/ark-scene/map/place");
    const {MAX_SLOPE, MOUNTAIN_SLOPE} = await import("@/ark-scene/behaviour-nav");
    const sampler = mapPoints().sampler;
    const animals: ArkAnimal[] = [];
    for (const [slug, zone] of [["tropical-house-gecko", "farm_garden"], ["black-and-rufous-elephant-shrew", "mountains"], ["common-wall-lizard", "mountains"], ["tropical-house-gecko", "desert"]] as const) {
        for (let slot = 0; slot < 400; slot++) animals.push(animal(slug, zone, slot, slot % 3));
    }
    let on = 0;
    let offset = 0;
    const off: string[] = [];
    // (One at a time: each a cluster of its own, as the server's slots make it.)
    for (const a of animals) {
        const place = placeAnimals([a]).get(a.id);
        const point = place?.map?.attach;
        if (!place || !point || !["ledge", "rock_face", "cliff_ledge"].includes(point.tag) || place.micro) continue;
        on++;
        if (Math.hypot(place.x - point.x, place.z - point.z) < 0.01 && Math.abs(place.ground - point.y) < 0.01) continue;
        offset++;
        // Off the point: only along a gentle ledge, on its own ground, never a steep face's or the cliff's.
        const steepest = (a.zone === "mountains" ? MOUNTAIN_SLOPE : MAX_SLOPE) * 2;
        const ledge = Math.abs(point.normal[1]) >= 0.5 && Math.abs(sampler.ground(place.x, place.z).height - place.ground) <= 0.05 && (!sampler.walkable || sampler.walkable(place.x, place.z, steepest));
        if (!ledge) off.push(`${a.id} ${point.id}`);
    }
    assert.ok(on > 50, `only ${on} homes on rocks sampled`);
    assert.deepEqual(off.slice(0, 8), [], `${off.length} of ${on} (${offset} off their point) off the rock's surface`);
});
