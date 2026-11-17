/**
 * The zoo's residents alive, tappable and inside their fences (p4, lane ZOOLIVE; the owner, 2026-11-17, on the live Ark:
 * "why are all the animals in the elephant enclosure frozen and I can't click on them, maybe other enclosures too", and
 * "a tapir stuck in the mesh fence").
 *
 * - An enclosure in view comes out whole (`near-kept.ts` keptToBringOut): every resident on its schedule, not the 12
 *   nearest the look point with the rest standing as resting figures, and from the usual paddock view (50 to 90 m).
 * - A resident the budget still rests is a figure a tap selects (`tap-pick.ts`: a circle on screen, no ray, so the
 *   enclosure's hidden walk cover and its rocks never catch a tap).
 * - Every outdoor resident's body (half its drawn length, from its size record) keeps clear of its enclosure's fence, at its
 *   spot and through an Ark day of its schedule bounded as the scene bounds it (`islands/scene.ts` bound): before, only its
 *   middle kept inside the mask (0.4 m in from the fence), so a tapir's or an elephant's front half stood through the mesh.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type {ArkAnimal} from "@/ark-scene/types";
import {keptToBringOut, NEAR_KEPT_MAX, NEAR_KEPT_VIEW, NEAR_ZOO_MAX, NEAR_ZOO_VIEW} from "@/ark-scene/near-kept";
import {pickFigure, preferTap, type Projector} from "@/ark-scene/tap-pick";
import {keepInPen, maskBox, placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {inPoly, toLocal, type Box} from "@/ark-scene/islands/town/geom";
import {zooTypeOfSlug} from "@/ark-scene/islands/routing";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townWorldSampler} from "@/ark-scene/islands/town/sampler";
import {poseOnTrip, scheduleWorld, tripAt, withLazyRoost, type Trip} from "@/ark-scene/behaviour-schedule";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {modelBase} from "@/ark-scene/grounding/base";
import {arkBody} from "@/ark-scene/stats";
import {townDayEpochs} from "@/ark-scene/islands/town/validate-animals";
import {islandHours} from "@/lib/ark-clock";

test("an enclosure in view comes out whole, from the paddock's usual view; the gardens' nearest only close up", () => {
    // The elephants' paddock as on the live read: 24 residents over 40 m; a garden's dogs beside it.
    const paddock = Array.from({length: 24}, (_, i) => ({id: `z-${String(i).padStart(2, "0")}`, x: (i % 6) * 8, z: Math.floor(i / 6) * 8, group: "savanna_paddocks-1"}));
    const next = Array.from({length: 16}, (_, i) => ({id: `n-${String(i).padStart(2, "0")}`, x: 60 + (i % 4) * 5, z: (i >> 2) * 5, group: "savanna_paddocks-2"}));
    const dogs = Array.from({length: 20}, (_, i) => ({id: `d-${String(i).padStart(2, "0")}`, x: -30 - i, z: 0, group: null}));
    const all = [...paddock, ...next, ...dogs];
    // From 60 m out (none came out before: the nearest only within 45 m), looking at the paddock's middle.
    const far = keptToBringOut(all, 20, 12, 60);
    for (const r of paddock) assert.ok(far.includes(r.id), `${r.id} out`);
    assert.ok(!far.some((id) => id.startsWith("d-")), "no garden dog from the paddock's view");
    // The next enclosure too while the cap holds it (24 + 16 = 40), whole or not at all.
    const both = keptToBringOut(all, 50, 12, 60);
    assert.equal(both.filter((id) => id.startsWith("n-")).length, 16);
    assert.equal(both.filter((id) => id.startsWith("z-")).length, 24);
    const low = keptToBringOut(all, 20, 12, 60, 30);
    assert.equal(low.filter((id) => id.startsWith("z-")).length, 24);
    assert.equal(low.filter((id) => id.startsWith("n-")).length, 0, "an enclosure that does not fit the cap stays out whole");
    assert.ok(keptToBringOut(all, 20, 12, 60, 10).length === 10, "the first enclosure alone over the cap: its nearest");
    // Close up in a garden: its nearest, as before.
    const garden = keptToBringOut(all, -35, 0, NEAR_KEPT_VIEW - 5);
    assert.equal(garden.length, NEAR_KEPT_MAX);
    // The map's view: nobody.
    assert.equal(keptToBringOut(all, 20, 12, NEAR_ZOO_VIEW + 1).length, 0);
    assert.ok(NEAR_ZOO_MAX >= 24, "the elephants' paddock fits the cap");
});

test("a resting zoo resident's figure is what a tap selects; a screen circle, no ray through cover or rocks", () => {
    // A camera looking down -z: the projector a perspective one (500 px per unit at 1 m, centre 640, 400).
    const project: Projector = (x, y, z) => (z >= 0 ? null : {sx: 640 + (x / -z) * 500, sy: 400 - (y / -z) * 500, distance: Math.hypot(x, y, z)});
    const elephant = {members: [{id: "eleph-1"}, {id: "eleph-2"}], middles: Float32Array.from([0, 0, -40, 6, 0, -40]), length: 6, height: 3};
    const hidden = {members: [{id: "tapir-1"}], middles: Float32Array.from([Number.NaN, 0, 0]), length: 2, height: 1};
    const hit = pickFigure(640, 400, [hidden, elephant], project, 1 / 500);
    assert.equal(hit?.id, "eleph-1");
    assert.deepEqual(preferTap(null, hit), {figure: "eleph-1"});
    assert.equal(pickFigure(640 + 75, 400, [elephant], project, 1 / 500)?.id, "eleph-2");
});

/** A zoo resident (deterministic ids; the fields placement reads), in its kind's enclosure. */
function resident(i: number, slug: string, zone: string): ArkAnimal {
    const enclosure = `${zooTypeOfSlug(slug)}-1`;
    return {id: `zl-${String(i).padStart(4, "0")}-${slug}`, species_profile_id: `sp-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone: zone as ArkAnimal["zone"], arrived_at: `2026-11-${String(1 + (i % 9)).padStart(2, "0")}T10:00:00Z`, brought_by: {label: "x", named: false}, mine: false, area: "zoo", island: "town", enclosure} as ArkAnimal;
}

/** How far a body of half-length `half` at (x, z) is inside the fence (the slot's box): under 0 through it. */
function clearOfFence(fence: Box, x: number, z: number, half: number): number {
    const l = toLocal(fence, x, z);
    return Math.min(fence.w / 2 - Math.abs(l.x), fence.d / 2 - Math.abs(l.z)) - half;
}

test("every outdoor resident's body keeps clear of its enclosure's fence, at its spot and through an Ark day", () => {
    // The real kinds of the live zoo's outdoor enclosures (the tapirs and elephants of the owner's paddocks among them).
    const kinds: Array<[string, string]> = [
        ["asian-elephant", "rainforest"], ["south-american-tapir", "rainforest"], ["malayan-tapir", "rainforest"], ["giraffe", "grassland"], ["plains-zebra", "grassland"], ["southern-cassowary", "rainforest"], ["ostrich", "grassland"], ["common-warthog", "grassland"], ["scimitar-horned-oryx", "desert"],
        ["red-deer", "woodland"], ["reindeer", "polar"], ["bighorn-sheep", "mountains"], ["african-lion", "grassland"], ["bengal-tiger", "rainforest"], ["brown-bear", "woodland"], ["eurasian-wolf", "woodland"], ["spotted-hyena", "grassland"],
        ["california-sea-lion", "seashore"], ["humboldt-penguin", "seashore"], ["greater-flamingo", "wetland"], ["marabou-stork", "wetland"], ["grey-crowned-crane", "wetland"], ["water-buffalo", "farm_garden"], ["domestic-horse", "farm_garden"], ["alpaca", "farm_garden"], ["capybara", "river_lake"], ["meerkat", "desert"]
    ];
    const animals: ArkAnimal[] = [];
    let i = 0;
    for (const [slug, zone] of kinds) for (let k = 0; k < 3; k++) animals.push(resident(i++, slug, zone));
    const placed = placeTownAnimals(animals);
    const colliders = townColliderSet(placed.open, {x: 0, z: 0});
    const world = scheduleWorld(townWorldSampler(placed.open, {x: 0, z: 0}, colliders));
    const epochs = [...townDayEpochs(16), ...townDayEpochs(16, Date.UTC(2026, 10, 12, 12) / 1000)];
    const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
    let outdoor = 0;
    let poses = 0;
    let throughBefore = 0;
    const through: string[] = [];
    const enclosures = new Set<string>();
    for (const a of animals) {
        const info = placed.town.get(a.id)!;
        const place = placed.places.get(a.id)!;
        if (!info.enclosure || info.enclosure.indoor || info.still || info.tank) continue;
        assert.ok(info.enclosureMargin !== undefined, `${a.model_slug}: an outdoor resident has its fence margin`);
        outdoor++;
        enclosures.add(info.enclosure.id);
        const fence = info.enclosure.slot.at;
        const plan = modelBase(a.model_slug)?.plan ?? null;
        const half = arkBody(a, plan).display / 2;
        // (A body longer than its enclosure is wide cannot keep clear: none of the real kinds is.)
        const need = Math.min(0.1, maskBox(info.enclosure.mask).w / 2);
        const c0 = clearOfFence(fence, place.x, place.z, half);
        if (c0 < need) through.push(`${a.model_slug} spot ${c0.toFixed(2)} m`);
        const profile = behaviourProfile(a.model_slug, plan);
        const own = withLazyRoost({id: a.id, zone: a.zone, home: {x: place.x, y: place.ground, z: place.z}, length: arkBody(a, plan).display, sea: false, range: Math.max(info.range, 0.6) * 1.5}, () => null);
        let trip: Trip | null = null;
        for (const epoch of epochs) {
            if (!trip || epoch < trip.start || epoch >= trip.end) trip = tripAt(world, profile, own, epoch, hoursAt, a.activity ?? null, trip);
            const at = poseOnTrip(world, trip, epoch);
            if (at.aloft) continue;
            poses++;
            // The old bound: its middle inside the mask.
            if (inPoly(info.enclosure.mask, at.x, at.z) && clearOfFence(fence, at.x, at.z, half) < need) throughBefore++;
            // The scene's bound now (`islands/scene.ts`): its body inside, the margin in from the mask.
            const pose = {x: at.x, z: at.z};
            keepInPen(maskBox(info.enclosure.mask), info.enclosureMargin!, pose);
            const c = clearOfFence(fence, pose.x, pose.z, half);
            if (c < need) through.push(`${a.model_slug} ${trip.doing} ${c.toFixed(2)} m`);
        }
    }
    console.log(`zoo fence: ${outdoor} outdoor residents in ${enclosures.size} enclosures, ${poses} poses on the ground; through the fence before (middle in the mask) ${throughBefore}, now ${through.length}`);
    assert.ok(enclosures.size >= 6, `the outdoor enclosures: ${Array.from(enclosures).join(", ")}`);
    assert.ok(throughBefore > 0, "the old bound let bodies through the fence (the test bites)");
    assert.deepEqual(through.slice(0, 8), []);
});
