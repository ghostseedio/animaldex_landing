/**
 * Shaking off the water (p3, owner 2026-11-16: "animals like geese who normally shake upon getting out of the water"):
 * `water-shake.ts`, its table `water-shake.json` (scripts/ark-water-shake.mts) and the schedule's crossing
 * (`behaviour-recipes.ts` crossingPose). On the v2 wild island with the spawn validator's animals, from real trips.
 */

import assert from "node:assert/strict";
import test from "node:test";
import table from "@/ark-scene/water-shake.json";
import recipesFull from "../../data/ark/behaviour-recipes.json";
import profilesFull from "../../data/ark/behaviour-profiles.json";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import * as sched from "@/ark-scene/behaviour-schedule";
import {wireRecipes, type RecipePose} from "@/ark-scene/behaviour-recipes";
import {unpackDefence} from "@/ark-scene/defence-moves";
import {eats} from "@/ark-scene/food-links";
import {modelBase} from "@/ark-scene/grounding/base";
import {onSchedule, scheduleRoost} from "@/ark-scene/map/place";
import {validatorAnimals} from "@/ark-scene/map/validate";
import {placeAnimals} from "@/ark-scene/placement";
import {onBehaviourSchedule} from "@/ark-scene/schedule-water";
import {arkBody} from "@/ark-scene/stats";
import {setArkWorld, ZONE_SITES} from "@/ark-scene/world";
import {worldSampler} from "@/ark-scene/world-sampler";
import {bathShakeAt, SHAKE_KIND, SHAKE_NONE, shakeAt, shakePack, shakePackOf, shakeSeconds, shakeStartOf, shakeTotal, sinceOutOfWater, waterShakeOf, waterShakeSpecies} from "@/ark-scene/water-shake";

setArkWorld("v2");

const species = (table as {species: Record<string, string[]>}).species;
type Crossing = {after: string; src?: {rule?: string; default?: string}};
const crossings = new Map(Object.values((recipesFull as unknown as {species: Record<string, {slug: string; crossing?: Crossing}>}).species).map((s) => [s.slug, s.crossing ?? null]));
const profilesRaw = (profilesFull as unknown as {profiles: Array<{slug: string; water: string | null}> | Record<string, {slug: string; water: string | null}>}).profiles;
const waters = new Map((Array.isArray(profilesRaw) ? profilesRaw : Object.values(profilesRaw)).map((p) => [p.slug, p.water]));

test("water shake: the list is the rule's (waterfowl, and water-going mammals whose models shake), read from the data", () => {
    const slugs = waterShakeSpecies();
    assert.ok(slugs.length >= 50, `${slugs.length} species`);
    for (const slug of slugs) {
        const [kind, why] = species[slug];
        const crossing = crossings.get(slug);
        assert.ok(crossing, `${slug}: no crossing`);
        assert.ok(waters.get(slug), `${slug} never goes into the water`);
        if (kind === "w") assert.match(crossing.src?.rule ?? "", /family Anatidae/, `${slug} wing-flaps but is not waterfowl`);
        else {
            assert.equal(crossing.after, "shake", `${slug}: its crossing does not shake off`);
            assert.match(why, /idle\.shake [23]$/, `${slug}: its model does not shake often`);
        }
    }
    // The owner's examples, and the ones the rule leaves out.
    for (const slug of ["greylag-goose", "mallard", "mute-swan", "labrador-retriever", "european-otter", "polar-bear"]) assert.ok(waterShakeOf(slug), `${slug} missing`);
    assert.equal(waterShakeOf("greylag-goose")?.wings, true);
    assert.equal(waterShakeOf("labrador-retriever")?.wings, false);
    for (const slug of ["harbor-seal", "emperor-penguin", "nile-crocodile", "eurasian-coot", "capybara", "north-american-beaver", "hippopotamus", "domestic-dog", "brown-bear"]) assert.equal(waterShakeOf(slug), null, `${slug} should not shake off water`);
});

test("water shake: by body size, eased in and out, and the wings only for waterfowl", () => {
    assert.ok(Math.abs(shakeSeconds(0.3) - 0.6) < 0.01);
    assert.equal(shakeSeconds(2.5), 1.2);
    const goose = waterShakeOf("greylag-goose")!;
    const dog = waterShakeOf("labrador-retriever")!;
    assert.deepEqual(shakeAt(dog, 1, 0), SHAKE_NONE, "not before it has found its feet");
    assert.deepEqual(shakeAt(dog, 1, shakeTotal(dog, 1) + 0.01), SHAKE_NONE, "over after its time");
    let peak = 0;
    let wings = 0;
    for (let t = 0; t < 3; t += 0.01) {
        const d = shakeAt(dog, 1, t);
        peak = Math.max(peak, d.body);
        assert.equal(d.wings, 0, "a dog has no wings to flap");
        wings = Math.max(wings, shakeAt(goose, 0.8, t).wings);
    }
    assert.ok(peak > 0.99 && wings > 0.99, `peak ${peak} wings ${wings}`);
    // (It eases back: almost nothing just before the end.)
    assert.ok(shakeAt(dog, 1, shakeTotal(dog, 1) - 0.01).body < 0.05);
    assert.deepEqual(bathShakeAt(1, 0, 1), SHAKE_NONE);
    assert.ok(bathShakeAt(1, 0.5, 1).body > 0.99);
});

test("water shake: the shader's pack carries the kind, the swing and its phase, never a sleep's positive value", () => {
    const goose = waterShakeOf("greylag-goose")!;
    const now = shakeAt(goose, 0.8, 0.5);
    const [kind, amount] = unpackDefence(shakePack(now));
    assert.equal(kind, SHAKE_KIND.body);
    assert.ok(Math.abs(amount - now.body) < 0.01);
    const flap = shakeAt(goose, 0.8, 0.2 + shakeSeconds(0.8) + 0.5);
    assert.equal(unpackDefence(shakePack(flap))[0], SHAKE_KIND.wings);
    assert.equal(shakePack(SHAKE_NONE), 0);
    // A bath's shake for a listed species, nothing for others; a rig's own shake clip keeps the body.
    assert.ok(shakePackOf({block: "shake_off", u: 0.5}, "mallard", 0.6, false) < 0);
    assert.equal(shakePackOf({block: "shake_off", u: 0.5}, "domestic-dog", 0.6, false), 0);
    assert.equal(shakePackOf({block: "groom", u: 0.5}, "mallard", 0.6, false), 0);
    assert.equal(shakePackOf({block: "shake_off", u: 0.5}, "mallard", 0.6, true), 0);
});

test("water shake: only on a trip that climbs out of the water, on the first spot of land", () => {
    const legs = (modes: string[], pause = 3) => modes.map((mode) => ({mode, seconds: mode === "pause" ? pause : 3, beat: mode === "pause" ? "shake" : "walk"}));
    const trip = {start: 100, legs: legs(["water", "exit", "pause", "ground"])};
    assert.equal(sinceOutOfWater(trip, 105), null, "still climbing out");
    assert.equal(sinceOutOfWater(trip, 107), 1);
    assert.equal(shakeStartOf(trip), 106);
    assert.equal(sinceOutOfWater(trip, 110), null, "walking on");
    assert.equal(sinceOutOfWater({start: 100, legs: legs(["ground", "pause", "enter", "water"])}, 104), null, "a pause on the way into the water");
    assert.equal(sinceOutOfWater({start: 100, legs: legs(["ground"])}, 101), null, "a walk");
    assert.equal(shakeStartOf({start: 100, legs: legs(["ground", "pause"])}), null);
    // A stand squeezed short: the shake fitted into it, or (shorter than the least) on arrival instead.
    assert.equal(sinceOutOfWater({start: 100, legs: legs(["water", "exit", "pause", "ground"], 1)}, 106.5, 2), 1);
    assert.equal(shakeStartOf({start: 100, arrive: 109.3, legs: legs(["water", "exit", "pause", "ground"], 0.3), stay: [{at: 0, beat: "shake"}]}), 109.3);
});

// The scene's wiring for the cast that matters here (the shakers and other amphibious kinds), as the waterbirds test does.
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
const world = sched.scheduleWorld(worldSampler());
const animals = validatorAnimals();
const places = placeAnimals(animals);
type Profile = ReturnType<typeof behaviourProfile>;
type Subject = {slug: string; id: string; activity: (typeof animals)[number]["activity"]; profile: Profile; animal: sched.ScheduleAnimal};
const subjects: Subject[] = animals.flatMap((a) => {
    const place = places.get(a.id)!;
    const profile = behaviourProfile(a.model_slug);
    if (!onSchedule(place, a.model_slug) || !onBehaviourSchedule(a.model_slug) || !sched.amphibious(profile)) return [];
    const length = arkBody(a, modelBase(a.model_slug)?.plan ?? null).display;
    const animal = sched.withLazyRoost({id: a.id, zone: a.zone, home: {x: place.x, y: place.ground, z: place.z}, length, sea: ZONE_SITES[a.zone]?.kind === "sea"}, () => scheduleRoost(place, a.zone));
    return [{slug: a.model_slug, id: a.id, activity: a.activity, profile, animal}];
});
{
    const byId = new Map(subjects.map((s) => [s.id, s]));
    for (const s of subjects) {
        const place = places.get(s.id)!;
        const leader = place.leader && place.leader !== s.id ? byId.get(place.leader) : undefined;
        s.animal.group = leader && leader.slug === s.slug && GROUPED.has(s.profile.social) ? {leader: leader.animal, profile: leader.profile, activity: leader.activity, rank: Math.max(place.rank ?? 1, 1), size: 2} : null;
        s.animal.young = false;
    }
    const list = subjects.map((s) => ({slug: s.slug, animal: s.animal, profile: s.profile, activity: s.activity}));
    sched.wireThreats(list, eats);
    sched.forgetSchedules();
    wireRecipes(list);
}
const DAY = Date.UTC(2026, 10, 12) / 1000;
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
const shakingAt = (trip: sched.Trip, t: number) => (sched.poseOnTrip(world, trip, t) as RecipePose).act?.recipe === "water_shake";

test("water shake: on the real schedule, a listed species shakes right after it climbs out, and at no other time; others never do", () => {
    let shook = 0;
    let outOthers = 0;
    let looked = 0;
    const kinds = new Set<string>();
    for (const s of subjects) {
        const listed = waterShakeOf(s.slug);
        let previous: sched.Trip | null = null;
        for (let slot = 0; slot < 1080; slot++) {
            const trip: sched.Trip = sched.tripAt(world, s.profile, s.animal, DAY + slot * sched.SLOT_SECONDS + 1, hoursAt, s.activity, previous);
            previous = trip;
            const out = trip.legs.some((l) => l.mode === "exit");
            const at = shakeStartOf(trip);
            if (out && listed) {
                assert.ok(at !== null, `${s.slug} climbs out at slot ${slot} with no shake on the bank`);
                // (A trip that runs to its slot's end is cut there, and its last seconds turn it to set off: its shake with them.)
                if (at! + 3 < trip.arrive || (at === trip.arrive && at + 3 < trip.end)) assert.ok(shakingAt(trip, at! + 0.5), `${s.slug} out of the water at slot ${slot} does not shake`);
                assert.ok(!shakingAt(trip, at + shakeTotal(listed, s.animal.length) + 0.05), `${s.slug} still shaking after its time`);
                shook++;
                kinds.add(s.slug);
            } else if (out) {
                assert.ok(!shakingAt(trip, trip.arrive + 0.5), `${s.slug} shakes but is not on the list`);
                outOthers++;
            }
            // Never on the way, nor any other moment of a trip that did not just climb out.
            if (slot % 7 === 0) {
                for (const t of [trip.start + 0.5, (trip.start + trip.arrive) / 2, trip.arrive + 0.5, trip.arrive + 5, (trip.arrive + trip.end) / 2]) {
                    if (t >= trip.end) continue;
                    assert.ok(!shakingAt(trip, t) || (listed !== null && at !== null && t >= at && t < at + shakeTotal(listed!, s.animal.length)), `${s.slug} shakes at ${(t - trip.start).toFixed(1)} s of slot ${slot} (out: ${out})`);
                    looked++;
                }
            }
        }
    }
    assert.ok(shook >= 5, `${shook} climbs out by listed species (${Array.from(kinds).join(", ")})`);
    assert.ok(outOthers >= 1, `${outOthers} climbs out by others`);
    assert.ok(looked > 1000, `${looked} moments looked at`);
});

test("water shake: the same for every viewer (pure in the trip and the clock)", () => {
    const s = subjects.find((x) => waterShakeOf(x.slug));
    assert.ok(s, "a listed species aboard");
    const trips: sched.Trip[] = [];
    let previous: sched.Trip | null = null;
    for (let slot = 0; slot < 1080 && trips.length < 3; slot++) {
        const trip: sched.Trip = sched.tripAt(world, s.profile, s.animal, DAY + slot * sched.SLOT_SECONDS + 1, hoursAt, s.activity, previous);
        previous = trip;
        if (trip.legs.some((l) => l.mode === "exit")) trips.push(trip);
    }
    assert.ok(trips.length > 0, `${s.slug} never climbs out`);
    for (const trip of trips) {
        const t = shakeStartOf(trip)! + 0.6;
        const first = (sched.poseOnTrip(world, trip, t) as RecipePose).act?.shake;
        // (Another viewer: the schedules worked out afresh, the trip again from the clock alone.)
        sched.forgetSchedules();
        const again = sched.tripAt(world, s.profile, s.animal, trip.start + 1, hoursAt, s.activity);
        const second = (sched.poseOnTrip(world, again, t) as RecipePose).act?.shake;
        assert.ok(first, "shaking");
        assert.deepEqual(second, first);
        assert.equal(shakePack(second!), shakePack(first));
    }
});
