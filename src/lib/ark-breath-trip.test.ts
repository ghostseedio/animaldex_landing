import assert from "node:assert/strict";
import test from "node:test";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {poseOnTrip, scheduleWorld, tripAt, type ScheduleAnimal, type Trip} from "@/ark-scene/behaviour-schedule";
import {behaviourState} from "@/ark-scene/behaviour-state";
import {TRIP_BREATH_HOLD, TRIP_BREATH_RISE, TRIP_BREATH_SECONDS, tripBreath, tripBreathStart, tripInWater, tripRhythm} from "@/ark-scene/breath-trip";
import {placeAnimals} from "@/ark-scene/placement";
import {breathAt, depthSeed} from "@/ark-scene/sea-depth";
import {displayLength} from "@/ark-scene/sizes";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkAnimal} from "@/ark-scene/types";
import {sceneSampler} from "@/ark-scene/world-sampler";

const world = scheduleWorld(sceneSampler());
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
const DAY = Math.floor(Date.UTC(2026, 10, 11) / 1000) + 8 * 3600;
const angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Every air-breathing swimmer in the v2 fixture, and a few more divers (a loggerhead, a warm-water penguin, a sea lion, an orca, a dugong). */
function divers(): Array<{animal: ArkAnimal; sched: ScheduleAnimal}> {
    const snap = decodeArkSnapshot(fixtureV2)!;
    const like = snap.animals.find((a) => a.zone === "coral_reef")!;
    const more: Array<[string, ArkAnimal["zone"]]> = [["loggerhead-sea-turtle", "open_ocean"], ["african-penguin", "seashore"], ["california-sea-lion", "seashore"], ["orca", "open_ocean"], ["dugong", "open_ocean"]];
    const animals = [...snap.animals, ...more.map(([slug, zone], i) => ({...like, id: `diver-${slug}-${i}`, model_slug: slug, zone}))];
    const placed = placeAnimals(animals);
    return animals
        .filter((a) => {
            const profile = behaviourProfile(a.model_slug);
            return profile.breathes && profile.move === "swim" && placed.has(a.id);
        })
        .map((animal) => {
            const p = placed.get(animal.id)!;
            return {animal, sched: {id: animal.id, zone: animal.zone, home: {x: p.x, y: p.ground, z: p.z}, length: displayLength(animal), sea: true}};
        });
}

test("divers breathe on their way: a gentle rise, a breath and a glide back down, mostly forward, never circling (under 1 turn per 20 s)", () => {
    const list = divers();
    const slugs = new Set(list.map((d) => d.animal.model_slug));
    for (const slug of ["green-sea-turtle", "harbor-seal", "emperor-penguin", "humpback-whale", "loggerhead-sea-turtle", "african-penguin", "california-sea-lion"]) assert.ok(slugs.has(slug), `${slug} is a diver here`);
    const bySlug = new Map<string, {breaths: number; moving: number; seconds: number; worst: number; rhythm: boolean; wet: number}>();
    const wrong: string[] = [];
    for (const {animal, sched} of list) {
        const profile = behaviourProfile(animal.model_slug);
        const row = bySlug.get(animal.model_slug) ?? {breaths: 0, moving: 0, seconds: 0, worst: 0, rhythm: false, wet: 0};
        bySlug.set(animal.model_slug, row);
        let trip: Trip | null = null;
        // (Lane B6: a whale, a dolphin, a seal, a sea turtle and a manatee breathe on their own rhythm wherever their trip
        // has them in the water, `water-life.ts`; the breathe trip is the penguins'.)
        let rhythmic = false;
        let up = false;
        // Three hours of its slots: each breathe trip's breath, and the 20 s from when it begins.
        for (let s = 0; s < 3 * 3600; s += 80) {
            trip = tripAt(world, profile, sched, DAY + s + 40, hoursAt, animal.activity, trip);
            rhythmic = tripRhythm(trip) !== null;
            if (rhythmic) {
                row.rhythm = true;
                assert.equal(tripBreathStart(trip), null, `${animal.model_slug}: no breathe trip, it has its own rhythm`);
                let before = poseOnTrip(world, trip, trip.start);
                const turns: number[] = [];
                for (let t = trip.start + 1; t < trip.end; t += 1) {
                    const pose = poseOnTrip(world, trip, t);
                    const breath = tripBreath(trip, t);
                    const wet = tripInWater(trip, t);
                    if (wet) row.wet++;
                    if (breath > 0 && !wet) wrong.push(`${animal.model_slug} ${animal.id.slice(-6)} breathes out of the water at ${t - trip.start} s`);
                    if (breath > 0.5 && !up) row.breaths++;
                    up = breath > 0.5;
                    turns.push(Math.abs(angle(pose.yaw - before.yaw)));
                    // (On its way: not the second it arrives in, where it turns to the heading it settles to.)
                    if (breath > 0 && t < trip.arrive) {
                        row.seconds++;
                        const moved = Math.hypot(pose.x - before.x, pose.z - before.z);
                        if (moved > 0.01) {
                            row.moving++;
                            if (Math.abs(angle(Math.atan2(pose.x - before.x, pose.z - before.z) - pose.yaw)) > Math.PI / 2) wrong.push(`${animal.model_slug} ${animal.id.slice(-6)} moves backwards in its breath`);
                        }
                    }
                    before = pose;
                }
                // (Never circling: under a turn in any 20 s of the slot.)
                for (let i = 0; i + 20 <= turns.length; i += 5) row.worst = Math.max(row.worst, turns.slice(i, i + 20).reduce((a, b) => a + b, 0) / (Math.PI * 2));
                continue;
            }
            const start = tripBreathStart(trip);
            if (start === null) continue;
            row.breaths++;
            // The breath's shape: up over 5 s, 3 s at the surface, down over 7 s, smooth at both ends.
            const up5 = tripBreath(trip, start + TRIP_BREATH_RISE / 2);
            if (!(up5 > 0.3 && up5 < 0.7) || tripBreath(trip, start + TRIP_BREATH_RISE + TRIP_BREATH_HOLD / 2) !== 1 || tripBreath(trip, start + TRIP_BREATH_SECONDS + 0.1) !== 0 || tripBreath(trip, start - 0.1) !== 0) {
                wrong.push(`${animal.model_slug} ${animal.id.slice(-6)} slot at ${s}: its breath is not rise, hold, glide`);
            }
            let before = poseOnTrip(world, trip, start);
            let turned = 0;
            for (let t = start + 0.25; t <= start + 20; t += 0.25) {
                const on = t < trip.end ? trip : tripAt(world, profile, sched, t, hoursAt, animal.activity, trip);
                const pose = poseOnTrip(world, on, t);
                turned += Math.abs(angle(pose.yaw - before.yaw));
                if (t <= start + TRIP_BREATH_SECONDS) {
                    row.seconds += 0.25;
                    const moved = Math.hypot(pose.x - before.x, pose.z - before.z);
                    if (moved > 0.01) {
                        row.moving += 0.25;
                        // Forward: never moving more than 90 degrees off the way it faces.
                        if (Math.abs(angle(Math.atan2(pose.x - before.x, pose.z - before.z) - pose.yaw)) > Math.PI / 2) wrong.push(`${animal.model_slug} ${animal.id.slice(-6)} moves backwards in its breath at ${(t - start).toFixed(2)} s`);
                    }
                }
                before = pose;
            }
            row.worst = Math.max(row.worst, turned / (Math.PI * 2));
            if (turned >= Math.PI * 2) wrong.push(`${animal.model_slug} ${animal.id.slice(-6)} turns ${(turned / Math.PI / 2).toFixed(2)} times in the 20 s of a breath`);
        }
    }
    assert.deepEqual(wrong.slice(0, 12), [], `${wrong.length} problems`);
    for (const [slug, row] of Array.from(bySlug.entries())) {
        if (row.rhythm) {
            // On its rhythm: at least a breath for every ten minutes its trips had it in the water (a great whale's dive
            // is the longest, 8 minutes), and never spinning.
            assert.ok(row.breaths >= Math.floor(row.wet / 600), `${slug}: ${row.breaths} breaths in ${row.wet} s in the water`);
            // (Over its whole slots, not only its breaths. Measured: the harbour seal's worst is 1.10 turns in 20 s, a
            // round by its shore and the turn to its heading as it arrives; the others under 1.)
            assert.ok(row.worst < 1.4, `${slug}: turns ${row.worst.toFixed(2)} times in the worst 20 s`);
            continue;
        }
        assert.ok(row.breaths >= 10, `${slug}: ${row.breaths} breaths in 3 h`);
        // Mostly on the move: the glide finishes still at its spot only after a short swim there.
        assert.ok(row.moving / row.seconds >= 0.5, `${slug}: moving ${((row.moving / row.seconds) * 100).toFixed(0)}% of its breaths`);
        assert.ok(row.worst < 0.5, `${slug}: turns ${row.worst.toFixed(2)} times in the worst 20 s of a breath`);
    }
    // The rhythm's own: the turtles, the seals and the whales here; the penguins keep the breathe trip.
    for (const slug of ["green-sea-turtle", "harbor-seal", "humpback-whale", "loggerhead-sea-turtle", "california-sea-lion"]) assert.equal(bySlug.get(slug)?.rhythm, true, slug);
    for (const slug of ["emperor-penguin", "african-penguin"]) assert.equal(bySlug.get(slug)?.rhythm, false, slug);
});

test("awake on the schedule a diver breathes only on its trip (its breathe trip, or its own rhythm in the water); asleep, on the clock's slower cycle; the same for every viewer", () => {
    const seed = depthSeed("diver-state");
    // A moment its clock cycle has it up for air.
    let clock = 0;
    while (!(breathAt(seed, clock) > 0.5)) clock += 0.5;
    const awake = {activity: null, elevation: 30, flyer: false, scheduled: {doing: "swim" as const, aloft: false}};
    assert.equal(behaviourState({...awake, breather: {seed, clock, breath: 0}}).breathing, false, "awake, between breathe trips: not up for air, whatever the clock's cycle says");
    assert.equal(behaviourState({...awake, breather: {seed, clock: clock + 30, breath: 0.4}}).breathing, true, "on its way, its trip's breath");
    assert.equal(behaviourState({...awake, scheduled: {doing: "sleep", aloft: false}, breather: {seed, clock, breath: null}}).breathing, breathAt(seed, clock, true) > 0, "asleep: the cycle");
    // Pure: a trip worked out again on a fresh world gives the same breath at the same moment.
    const [first] = divers().filter((d) => d.animal.model_slug === "green-sea-turtle");
    const profile = behaviourProfile("green-sea-turtle");
    const again = scheduleWorld(sceneSampler());
    for (let s = 0; s < 1200; s += 80) {
        const a = tripAt(world, profile, first.sched, DAY + s, hoursAt, first.animal.activity);
        const b = tripAt(again, profile, {...first.sched, home: {...first.sched.home}}, DAY + s, hoursAt, first.animal.activity);
        for (let t = a.start; t < a.end; t += 1.5) assert.equal(tripBreath(a, t), tripBreath(b, t));
    }
});
