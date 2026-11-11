import assert from "node:assert/strict";
import test from "node:test";
import table from "@/ark-scene/behaviours.json";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {ARK_BEHAVIOURS, ARK_INTERACTIONS, behaviourProfile, decodeBehaviourRow} from "@/ark-scene/behaviour-profile";
import {awakeAt, maxSlopeOf, poseOnTrip, roostOf, scheduleWorld, SLOT_SECONDS, tripAt, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {sceneSampler} from "@/ark-scene/world-sampler";
import {placeAnimals} from "@/ark-scene/placement";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {displayLength} from "@/ark-scene/sizes";

const world = scheduleWorld(sceneSampler());
const snapshot = decodeArkSnapshot(fixtureV2)!;
const places = placeAnimals(snapshot.animals);
const SEA = new Set(["coral_reef", "open_ocean"]);
const animals = snapshot.animals.map((a) => {
    const p = places.get(a.id)!;
    const animal: ScheduleAnimal = {id: a.id, zone: a.zone, home: {x: p.x, y: p.ground, z: p.z}, length: displayLength(a), sea: SEA.has(a.zone)};
    return {a, animal, profile: behaviourProfile(a.model_slug)};
});
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
const DAY = Math.floor(Date.UTC(2026, 10, 11) / 1000);

test("every profile row decodes to known behaviours and places", () => {
    const rows = (table as {species: Record<string, string>}).species;
    assert.ok(Object.keys(rows).length > 2400);
    for (const [slug, row] of Object.entries(rows)) {
        const p = decodeBehaviourRow(slug, row);
        for (const b of Object.keys(p.weights)) assert.ok((ARK_BEHAVIOURS as readonly string[]).includes(b), `${slug} ${b}`);
        for (const i of p.interactions) assert.ok((ARK_INTERACTIONS as readonly string[]).includes(i), `${slug} ${i}`);
        assert.ok(["diurnal", "nocturnal", "crepuscular", "any"].includes(p.activity));
    }
});

test("deterministic: the same time and id give the same trip, from a freshly built world too", () => {
    const again = scheduleWorld(sceneSampler());
    for (const {animal, profile, a} of animals.slice(0, 40)) {
        for (const h of [2, 7.5, 13, 19]) {
            const t = DAY + h * 3600 + 17;
            const one = tripAt(world, profile, animal, t, hoursAt, a.activity);
            const two = tripAt(again, profile, animal, t, hoursAt, a.activity);
            assert.deepEqual(one, two);
            assert.deepEqual(poseOnTrip(world, one, t), poseOnTrip(again, two, t));
        }
    }
});

test("nothing jumps: where a slot ends is where the next one starts", () => {
    let checked = 0;
    for (const {animal, profile, a} of animals.filter((_, i) => i % 3 === 0)) {
        for (let k = 0; k < 24 * 45; k += 7) {
            const end = DAY + (k + 1) * SLOT_SECONDS;
            const before = poseOnTrip(world, tripAt(world, profile, animal, end - 0.001, hoursAt, a.activity), end - 0.001);
            const after = poseOnTrip(world, tripAt(world, profile, animal, end, hoursAt, a.activity), end);
            const gap = Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z);
            assert.ok(gap < 0.25, `${a.model_slug} jumps ${gap.toFixed(2)} m at slot ${k + 1}`);
            checked++;
        }
    }
    assert.ok(checked > 1000);
});

test("asleep means at its roost, and getting there is a visible trip", () => {
    let roosted = 0;
    let trips = 0;
    for (const {animal, profile, a} of animals) {
        if (profile.move === "sessile") continue;
        const roost = roostOf(world, profile, animal);
        for (let k = 0; k < 24 * 45; k += 3) {
            const t = DAY + k * SLOT_SECONDS + SLOT_SECONDS * 0.9;
            const trip = tripAt(world, profile, animal, t, hoursAt, a.activity);
            const asleep = !awakeAt(profile, a.activity, hoursAt(trip.start));
            assert.equal(asleep, trip.doing === "sleep" || trip.doing === "to_roost", `${a.model_slug} at slot ${k}`);
            if (trip.doing === "sleep") {
                const pose = poseOnTrip(world, trip, t);
                assert.ok(Math.hypot(pose.x - roost.x, pose.z - roost.z) < 0.05, `${a.model_slug} asleep away from its roost`);
                roosted++;
            }
            if (trip.doing === "to_roost" && trip.mode !== "stay") {
                assert.ok(trip.arrive > trip.start, `${a.model_slug} snaps to its roost`);
                trips++;
            }
        }
    }
    assert.ok(roosted > 100 && trips > 10, `roosted ${roosted}, trips ${trips}`);
});

test("roosts are places in the scenery where the profile names one", () => {
    let withPlace = 0;
    let total = 0;
    for (const {animal, profile} of animals) {
        if (["water", "bottom", "reef", "attached", "open"].includes(profile.roost)) continue;
        total++;
        if (roostOf(world, profile, animal).point) withPlace++;
    }
    assert.ok(withPlace / total > 0.6, `${withPlace} of ${total} roost at an attach point`);
});

test("walkers stay on walkable ground, swimmers in the water, flyers in their height band", () => {
    const bands: Record<string, number[]> = {low: [], mid: [], high: []};
    let walking = 0;
    const off: string[] = [];
    for (const {animal, profile, a} of animals) {
        for (let k = 0; k < 24 * 45; k += 5) {
            const t = DAY + k * SLOT_SECONDS + 20;
            const trip = tripAt(world, profile, animal, t, hoursAt, a.activity);
            const pose = poseOnTrip(world, trip, t);
            if (trip.mode === "ground" && pose.moving && !profile.moves.includes("swim")) {
                walking++;
                // A start or a target beside a shrub or at the water's edge is just off the grid: only the way between counts.
                if (!world.nav.walkable(pose.x, pose.z, maxSlopeOf(animal)) && Math.hypot(pose.x - trip.from.x, pose.z - trip.from.z) > 3 && Math.hypot(pose.x - trip.to.x, pose.z - trip.to.z) > 3) off.push(a.model_slug);
            }
            if (profile.move === "swim" && trip.mode === "water" && world.sampler.heightAt(pose.x, pose.z) < 0) assert.ok(pose.y <= 0.01, `${a.model_slug} out of the water`);
            if (profile.altitude && pose.aloft && (trip.doing === "fly" || trip.doing === "soar")) bands[profile.altitude].push(pose.y - Math.max(world.sampler.heightAt(pose.x, pose.z), 0));
        }
    }
    assert.ok(walking > 200 && off.length / walking < 0.03, `${off.length} of ${walking} walking samples off the grid: ${Array.from(new Set(off)).join(", ")}`);
    const median = (v: number[]) => [...v].sort((x, y) => x - y)[Math.floor(v.length / 2)] ?? 0;
    if (bands.mid.length && bands.high.length) assert.ok(median(bands.high) > median(bands.mid), `high ${median(bands.high)} vs mid ${median(bands.mid)}`);
});
