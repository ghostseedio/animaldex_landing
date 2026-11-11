import assert from "node:assert/strict";
import test from "node:test";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {amphibious, aquatic, poseOnTrip, scheduleWorld, SLOT_SECONDS, tripAt, type ScheduleAnimal, type Trip} from "@/ark-scene/behaviour-schedule";
import {placeAnimals} from "@/ark-scene/placement";
import {depthSeed, depthTable, heldTable, speciesDepth, SURFACE_CLEAR, waterMotion, type SpeciesDepth} from "@/ark-scene/sea-depth";
import {inDepthBand, onBehaviourSchedule, scheduledWater} from "@/ark-scene/schedule-water";
import {displayLength} from "@/ark-scene/sizes";
import {sceneSampler} from "@/ark-scene/world-sampler";
import type {ArkAnimal, ArkZone} from "@/ark-scene/types";

/**
 * The release merge bug the behaviour audit found (2026-11-11): the behaviour
 * schedule's pose won over sea-depth's water pose for every scheduled water
 * animal. Water animals must be drawn in their depth band whenever the
 * schedule has them in the water, and a water-only animal is never sent onto
 * land (a reef fish slept on a shore rock, a pacu in a tree).
 */

const world = scheduleWorld(sceneSampler());
const table = depthTable();
const SEA = new Set(["coral_reef", "open_ocean"]);
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
const DAY = Math.floor(Date.UTC(2026, 10, 11) / 1000);

/** A zone for a species' own water (as the sea-depth tests place them). */
function homeZone(depth: SpeciesDepth): ArkZone {
    if (depth.water === "fresh") return "river_lake";
    if (depth.home === "coast") return "seashore";
    return depth.band === "reef" ? "coral_reef" : "open_ocean";
}

/** Every water species on the schedule, each alone in its home zone (its slot its index among the zone's). */
const items = (() => {
    const perZone = new Map<ArkZone, number>();
    const animals: ArkAnimal[] = Object.keys(table).map((slug, index) => {
        const zone = homeZone(table[slug]);
        const slot = perZone.get(zone) ?? 0;
        perZone.set(zone, slot + 1);
        return {id: `00000000-0000-4000-c000-${String(index).padStart(12, "0")}`, species_profile_id: `water-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone, arrived_at: "2026-11-01T12:00:00Z", brought_by: {label: "Voyager 1", named: false}, mine: false, activity: null, slot, slot_rank: 0} as unknown as ArkAnimal;
    });
    const places = placeAnimals(animals);
    return animals
        .filter((a) => onBehaviourSchedule(a.model_slug) && !places.get(a.id)!.micro && !places.get(a.id)!.burrow)
        .map((a) => {
            const place = places.get(a.id)!;
            const animal: ScheduleAnimal = {id: a.id, zone: a.zone, home: {x: place.x, y: place.ground, z: place.z}, length: displayLength(a), sea: SEA.has(a.zone)};
            return {a, animal, profile: behaviourProfile(a.model_slug), depth: speciesDepth(a.model_slug, a.zone)!};
        });
})();

type Sample = {item: (typeof items)[number]; at: ReturnType<typeof poseOnTrip>; ground: number; t: number};
let sampled: Sample[] | null = null;
/** Each animal's schedule over two island days (every 9th slot, at a moment inside it), as the scene reads it (worked out once). */
function samples(): Sample[] {
    if (sampled) return sampled;
    const out: Sample[] = [];
    for (const item of items) {
        let previous: Trip | null = null;
        for (let k = 0; k < 2 * 24 * 45; k += 9) {
            const t = DAY + k * SLOT_SECONDS + 17;
            const trip: Trip = tripAt(world, item.profile, item.animal, t, hoursAt, item.a.activity, previous);
            previous = trip;
            const at = poseOnTrip(world, trip, t);
            out.push({item, at, ground: world.sampler.heightAt(at.x, at.z), t});
        }
    }
    sampled = out;
    return out;
}

test("in the water, a scheduled water animal is drawn in its depth band, not at the schedule's own height", () => {
    assert.ok(items.length > 400, `${items.length} water species on the schedule`);
    let wet = 0;
    const missed = new Map<string, number>();
    for (const {item, at, ground, t} of samples()) {
        if (at.aloft || ground >= 0) continue;
        const waterOnly = aquatic(item.profile) && !amphibious(item.profile);
        if (!inDepthBand(item.depth, at, ground)) {
            // Only an amphibious one at the edge (sliding in, climbing out, taking off) may be above the surface over water.
            if (waterOnly) missed.set(item.a.model_slug, (missed.get(item.a.model_slug) ?? 0) + 1);
            continue;
        }
        wet++;
        const height = Math.max(item.animal.length * 0.6, 0.05);
        const {spec, base} = scheduledWater(item.depth, ground, depthSeed(item.a.id), t, 0, height);
        const motion = waterMotion(item.depth);
        assert.equal(spec.motion, motion);
        // The band's body, fitted in the water at its drawn size: a floater floats at the surface, a floor-dweller is on
        // the floor (a hole-dweller a little into it), a swimmer's whole body is under the surface and above the floor.
        if (motion === "float") assert.ok(base < 0 && base > -height, `${item.a.model_slug} afloat at ${base}`);
        else if (motion === "walk") assert.ok(Math.abs(base - ground) < 1e-9, `${item.a.model_slug} not on the floor (${base}, floor ${ground})`);
        else if (motion === "hole") assert.ok(base <= ground && base > ground - height, `${item.a.model_slug} not in its hole`);
        else if (-ground > height + SURFACE_CLEAR + 0.1) assert.ok(base + height <= -SURFACE_CLEAR + 1e-6 && base >= ground, `${item.a.model_slug} out of its water (${base}, floor ${ground})`);
    }
    assert.ok(wet > 50000, `${wet} samples in the water`);
    assert.equal(missed.size, 0, `water-only animals drawn at the schedule's height over water: ${JSON.stringify(Object.fromEntries(missed))}`);
});

test("a water-only animal (a fish, a seabed walker) is never sent onto land or a rock above the surface", () => {
    let waterOnly = 0;
    const dry = new Map<string, number>();
    for (const {item, at, ground} of samples()) {
        if (!aquatic(item.profile) || amphibious(item.profile) || at.aloft) continue;
        waterOnly++;
        if (ground >= 0 || at.y > 0.02) dry.set(item.a.model_slug, (dry.get(item.a.model_slug) ?? 0) + 1);
    }
    const total = Array.from(dry.values()).reduce((sum, n) => sum + n, 0);
    assert.ok(waterOnly > 50000, `${waterOnly} samples`);
    // (Before the fix: 7% of samples on land, roosts and rest spots among them. A route along a narrow channel may cut a corner.)
    assert.ok(total / waterOnly < 0.001, `${total} of ${waterOnly} samples out of the water: ${JSON.stringify(Object.fromEntries(dry))}`);
});

test("a species held off the water never goes on the schedule (it would land on the sea to rest)", () => {
    const held = Object.keys(heldTable());
    assert.ok(held.includes("magnificent-frigatebird"));
    for (const slug of held) assert.equal(onBehaviourSchedule(slug), false, slug);
    for (const slug of ["mallard", "common-bottlenose-dolphin", "bigclaw-snapping-shrimp", "gentoo-penguin"]) assert.equal(onBehaviourSchedule(slug), true, slug);
});

test("on land or in the air the schedule's pose stands: only the water is the band's", () => {
    const duck = table["mallard"] ?? Object.values(table).find((d) => waterMotion(d) === "float")!;
    assert.equal(inDepthBand(duck, {y: 0.4, aloft: false}, 0.4), false, "on the bank");
    assert.equal(inDepthBand(duck, {y: 6, aloft: true}, -1), false, "flying over the pond");
    assert.equal(inDepthBand(duck, {y: 0, aloft: false}, -1), true, "on the pond");
    assert.equal(inDepthBand(null, {y: -1, aloft: false}, -2), false, "a land animal has no band");
});
