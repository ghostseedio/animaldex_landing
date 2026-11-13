/**
 * Waterbirds and swimmers (lane MA3, the movement audit of 2026-11-13, docs/ark/movement-audit-2026-11-13.md): its CI
 * candidates, on the v2 wild island (what islands mode shows) with the spawn validator's animals (every catalogue
 * species, two each).
 *
 * - No swimmer without a band: every species that swims has one while it is in the water (`sea-depth.ts` swimDepth),
 *   so the rig player never walks or runs it on the surface (the owner's coot ran on the lake).
 * - Ground and water birds rarely fly (the audit's coot took off 27 times an hour, a peafowl 34): every bird that walks
 *   or swims first is aloft at most 2% of an island day, and takes off at most 3 times an awake hour; the coot spends
 *   at least 60% of the day on the water and leaves it by swimming, not flying.
 *
 * Counted from the schedule's trips over one whole island day (1,080 slots), not sampled: an air leg is a take-off
 * (and a follower's flight at its leader's side, while its leader is up), its seconds the time aloft.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {behaviourProfile, freeBodyLengthsPerSecond} from "@/ark-scene/behaviour-profile";
import * as sched from "@/ark-scene/behaviour-schedule";
import {wireRecipes} from "@/ark-scene/behaviour-recipes";
import {eats} from "@/ark-scene/food-links";
import {modelBase} from "@/ark-scene/grounding/base";
import {mapHabitatAt, onSchedule, scheduleRoost} from "@/ark-scene/map/place";
import {validatorAnimals} from "@/ark-scene/map/validate";
import {placeAnimals} from "@/ark-scene/placement";
import {inDepthBand, onBehaviourSchedule} from "@/ark-scene/schedule-water";
import {swimDepth} from "@/ark-scene/sea-depth";
import {arkBody} from "@/ark-scene/stats";
import {freshLevelAt, freshWaterAt} from "@/ark-scene/water-level";
import {heightAt, setArkWorld, ZONE_SITES} from "@/ark-scene/world";
import {worldSampler} from "@/ark-scene/world-sampler";
import {recordMotionMetric} from "@/lib/ark-motion-metrics";

// (The v2 wild island, what islands mode shows: every module follows the switch, `onArkWorld`.)
setArkWorld("v2");

type ScheduleAnimal = sched.ScheduleAnimal;
type Trip = sched.Trip;
type Profile = ReturnType<typeof behaviourProfile>;

const animals = validatorAnimals();
const swims = (p: Profile) => p.move === "swim" || p.moves.includes("swim");

test("waterbirds: every species that swims has a band while it is in the water (no swimmer runs on the surface)", () => {
    const missing = new Set<string>();
    let swimmers = 0;
    for (const a of animals) {
        if (!swims(behaviourProfile(a.model_slug)) || !onBehaviourSchedule(a.model_slug)) continue;
        swimmers++;
        if (!swimDepth(a.model_slug, a.zone)) missing.add(a.model_slug);
    }
    recordMotionMetric("ma3", "swimmers_without_band", missing.size);
    assert.ok(swimmers > 300, `${swimmers} swimmers looked at`);
    assert.equal(missing.size, 0, `swimmers with no band: ${Array.from(missing).join(", ")}`);
    // (A heron wades: no band, it stands on the bed in the shallows.)
    assert.equal(swimDepth("grey-heron", "wetland"), null);
    assert.equal(swimDepth("eurasian-coot", "river_lake")?.kind, "coot");
});

// The scene's wiring, as the time budget and the grounding audit wire it: groups, spaced homes, threats, recipes.
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
const world = sched.scheduleWorld(worldSampler());
const places = placeAnimals(animals);
type Subject = {slug: string; id: string; activity: (typeof animals)[number]["activity"]; zone: string; length: number; profile: Profile; animal: ScheduleAnimal; rank: number; leaderId: string | null};
const subjects: Subject[] = animals.flatMap((a) => {
    const place = places.get(a.id)!;
    if (!onSchedule(place, a.model_slug) || !onBehaviourSchedule(a.model_slug)) return [];
    const length = arkBody(a, modelBase(a.model_slug)?.plan ?? null).display;
    const animal = sched.withLazyRoost({id: a.id, zone: a.zone, home: {x: place.x, y: place.ground, z: place.z}, length, sea: ZONE_SITES[a.zone]?.kind === "sea"}, () => scheduleRoost(place, a.zone));
    return [{slug: a.model_slug, id: a.id, activity: a.activity, zone: a.zone, length, profile: behaviourProfile(a.model_slug), animal, rank: Math.max(place.rank ?? 1, 1), leaderId: place.leader && place.leader !== a.id ? place.leader : null}];
});
{
    const byId = new Map(subjects.map((s) => [s.id, s]));
    const sizes = new Map<Subject, number>();
    for (const s of subjects) {
        const leader = s.leaderId ? byId.get(s.leaderId) : undefined;
        if (leader) sizes.set(leader, (sizes.get(leader) ?? 1) + 1);
    }
    for (const s of subjects) {
        const leader = s.leaderId ? byId.get(s.leaderId) : undefined;
        s.animal.group = leader && leader.slug === s.slug && GROUPED.has(s.profile.social) ? {leader: leader.animal, profile: leader.profile, activity: leader.activity, rank: s.rank, size: sizes.get(leader) ?? 2} : null;
        s.animal.young = false;
    }
    const nav = world.nav;
    const radius = new Map(subjects.map((s) => [s.id, sched.rangeReach(s.profile, s.animal) + (sizes.has(s) ? sched.groupSpread(s.length, sizes.get(s)!) : 0)]));
    const spaced = sched.spaceHomes(
        subjects.filter((s) => !s.animal.group).map((s) => ({id: s.id, slug: s.slug, home: {x: s.animal.home.x, z: s.animal.home.z}, length: s.length, walkable: (x: number, z: number) => (s.profile.move === "swim" || s.profile.seabed ? nav.swimmable(x, z, 0.5) : s.profile.move === "fly" ? heightAt(x, z) > 0.05 && mapHabitatAt({model_slug: s.slug, zone: s.zone as never}, x, z, 5) : nav.walkable(x, z) && mapHabitatAt({model_slug: s.slug, zone: s.zone as never}, x, z, 5))})),
        eats,
        (id) => radius.get(id) ?? 3
    );
    for (const s of subjects) {
        const moved = spaced.get(s.id);
        if (!moved) continue;
        s.animal.home = {x: moved.home.x, y: Math.max(heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
        s.animal.range = moved.range === null ? null : sizes.has(s) ? moved.range / 2 : moved.range;
        s.animal.prey = moved.prey;
    }
    for (const s of subjects) {
        const lead = s.animal.group?.leader;
        if (lead && spaced.has(lead.id)) {
            s.animal.home = {...lead.home};
            s.animal.range = lead.range;
        }
    }
    const list = subjects.map((s) => ({slug: s.slug, animal: s.animal, profile: s.profile, activity: s.activity}));
    sched.wireThreats(list, eats);
    sched.forgetSchedules();
    wireRecipes(list);
}

const DAY = Date.UTC(2026, 10, 12) / 1000;
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
/** Its island day from its trips: seconds aloft, take-offs, awake seconds, and (sampled every 20 s) seconds in the water. */
function dayOf(s: Subject): {aloft: number; takeoffs: number; awake: number; water: number; sampled: number; flownFromWater: number; walkedOut: number} {
    const out = {aloft: 0, takeoffs: 0, awake: 0, water: 0, sampled: 0, flownFromWater: 0, walkedOut: 0};
    const band = swimDepth(s.slug, s.zone);
    const inWater = (at: {x: number; y: number; z: number; aloft: boolean}) => {
        const ground = heightAt(at.x, at.z);
        const fresh = freshWaterAt(at.x, at.z) >= 0.5 && freshLevelAt(at.x, at.z) > ground + 0.02;
        return !at.aloft && (inDepthBand(band, at, ground) || ground < 0 || fresh);
    };
    let previous: Trip | null = null;
    let wasWater: boolean | null = null;
    for (let slot = 0; slot < 1080; slot++) {
        const trip: Trip = sched.tripAt(world, s.profile, s.animal, DAY + slot * sched.SLOT_SECONDS + 1, hoursAt, s.activity, previous);
        previous = trip;
        if (trip.doing !== "sleep") out.awake += trip.end - trip.start;
        let t = trip.start;
        for (const leg of trip.legs) {
            if (leg.mode === "air") {
                out.takeoffs++;
                out.aloft += leg.seconds;
            } else if (leg.mode === "shadow") {
                // (A follower flies at its leader's side while its leader is up.)
                let up = false;
                for (let at = t; at < t + leg.seconds; at += 5) {
                    const pose = sched.poseOnTrip(world, trip, at);
                    if (pose.aloft && !up) out.takeoffs++;
                    if (pose.aloft) out.aloft += 5;
                    up = pose.aloft;
                }
            }
            t += leg.seconds;
        }
        for (let at = trip.start; at < trip.end; at += 20) {
            const pose = sched.poseOnTrip(world, trip, at);
            const water = inWater(pose);
            out.sampled++;
            if (water) out.water++;
            if (wasWater && pose.aloft) out.flownFromWater++;
            if (wasWater && !water && !pose.aloft) out.walkedOut++;
            if (!pose.aloft) wasWater = water;
        }
    }
    return out;
}

/** The birds that walk or swim first and can fly (a coot, a duck, a goose, a swan, a peafowl, a pigeon, a hen). */
const groundBirds = Array.from(new Set(subjects.filter((s) => modelBase(s.slug)?.plan === "bird" && (s.profile.move === "walk" || s.profile.move === "swim") && s.profile.moves.includes("fly")).map((s) => s.slug)));

test("waterbirds: birds that walk or swim first are aloft at most 2% of the day and take off at most 3 times an awake hour", () => {
    const over: string[] = [];
    let worstAir = 0;
    let worstTakeoffs = 0;
    for (const slug of groundBirds) {
        let aloft = 0;
        let takeoffs = 0;
        let awake = 0;
        const own = subjects.filter((s) => s.slug === slug);
        for (const s of own) {
            const day = dayOf(s);
            aloft += day.aloft;
            takeoffs += day.takeoffs;
            awake += day.awake;
        }
        const air = aloft / (own.length * 86400);
        const perHour = takeoffs / Math.max(awake / 3600, 1e-6);
        worstAir = Math.max(worstAir, air);
        worstTakeoffs = Math.max(worstTakeoffs, perHour);
        if (air > AIR_MOST || perHour > TAKEOFFS_MOST) over.push(`${slug} ${(air * 100).toFixed(1)}% ${perHour.toFixed(1)}/h`);
    }
    recordMotionMetric("ma3", "ground_birds_air_share_worst", worstAir);
    recordMotionMetric("ma3", "ground_birds_takeoffs_worst", worstTakeoffs, "per awake hour");
    assert.ok(groundBirds.length > 100, `${groundBirds.length} birds that walk or swim first`);
    assert.deepEqual(over, [], `over ${(AIR_MOST * 100).toFixed(0)}% aloft or ${TAKEOFFS_MOST} take-offs an awake hour`);
});
const AIR_MOST = 0.02;
const TAKEOFFS_MOST = 3;

test("waterbirds: the coot lives on the water (at least 60% of the day) and leaves it by swimming to the bank, not by flying", () => {
    const own = subjects.filter((s) => s.slug === "eurasian-coot");
    assert.ok(own.length > 0);
    let water = 0;
    let sampled = 0;
    let flown = 0;
    for (const s of own) {
        const day = dayOf(s);
        water += day.water;
        sampled += day.sampled;
        flown += day.flownFromWater;
    }
    recordMotionMetric("ma3", "coot_water_share", water / sampled);
    assert.ok(water / sampled >= 0.6, `the coot is on the water ${((100 * water) / sampled).toFixed(0)}% of the day`);
    // (Off the water it flies to other water now and then: never more than a few times a day.)
    assert.ok(flown <= 6 * own.length, `the coot flew off the water ${flown} times`);
});

test("waterbirds: swans, geese and ducks never perch in trees (a heavy body takes only a limb that suits all of it)", () => {
    for (const slug of ["mute-swan", "black-swan", "canada-goose", "greylag-goose", "mallard", "great-crested-grebe", "eurasian-coot"]) {
        const p = behaviourProfile(slug);
        assert.ok(!p.interactions.includes("perch_branch") && !p.weights.perch, `${slug} perches`);
    }
    // The tree ducks do (their text says so).
    for (const slug of ["wood-duck", "mandarin-duck", "muscovy-duck", "black-bellied-whistling-duck"]) assert.ok(behaviourProfile(slug).interactions.includes("perch_branch"), `${slug} does not perch`);
    // A 1.5 m swan on a limb that half suits it: no; a sparrow on it: yes.
    const limb = {size: [0.2, 1.1] as [number, number], hidden: false, tag: "branch" as const};
    assert.equal(sched.perchSuits(limb, 1.5), false);
    assert.equal(sched.perchSuits(limb, 0.15), true);
    assert.equal(sched.perchSuits({...limb, hidden: true}, 0.8), false);
});

// Lane MA3 water 2 (decisions 281, 284, 287): the goose's hops on the v2 lake, wetland ducks placed ashore, goal caps of
// 0.25 m, a swimmer's pace held to its walk clip's, cranes in trees.

test("water 2: a goose on the v2 lake where the upper river's falls run into it swims, never hopping onto a 'raised' water spot", () => {
    // (The real snapshot's goose: its home by the falls, the river's level there 8.8 m a metre off the lake's 6. Its water
    // spots read the river's level and `topAt` the lake's, so its swims were "raised" and flown, 62 hops of 1-10 m a day at
    // a fifth of its cruise.)
    const profile = behaviourProfile("canada-goose");
    const home = {x: -74.9, z: -32.6};
    const animal = sched.withLazyRoost({id: "water2-goose", zone: "river_lake", home: {x: home.x, y: Math.max(heightAt(home.x, home.z), 0), z: home.z}, length: 0.83, sea: false, range: 9}, () => null);
    const top = (p: {x: number; z: number}) => Math.max(world.sampler.heightAt(p.x, p.z), world.sampler.waterSurface ? world.sampler.waterSurface(p.x, p.z) : 0);
    let swims = 0;
    const hops: string[] = [];
    let previous: Trip | null = null;
    for (let slot = 0; slot < 540; slot++) {
        const trip: Trip = sched.tripAt(world, profile, animal, DAY + slot * sched.SLOT_SECONDS + 1, hoursAt, null, previous);
        previous = trip;
        for (const leg of trip.legs) {
            if (leg.mode === "water") swims++;
            if (leg.mode !== "air" || leg.length > 12) continue;
            if ([leg.from, leg.to].some((p) => p.point === null && world.sampler.heightAt(p.x, p.z) < p.y - 0.05 && p.y > top(p) + 0.4)) hops.push(`${leg.length.toFixed(1)} m`);
        }
    }
    assert.ok(swims > 20, `${swims} swims`);
    assert.deepEqual(hops, [], "hops onto or off a water spot above the water");
});

test("water 2: the wetland's ducks live on its water (placed on its bank, not 20-50 m up its grassland); the tree ducks keep their trees", () => {
    for (const slug of ["mottled-duck", "wandering-whistling-duck"]) {
        const own = subjects.filter((s) => s.slug === slug);
        assert.ok(own.length > 0, slug);
        let water = 0;
        let sampled = 0;
        for (const s of own) {
            const day = dayOf(s);
            water += day.water;
            sampled += day.sampled;
            let near = Infinity;
            for (const r of [2, 4, 6, 8]) if (near === Infinity && world.nav.nearest(s.animal.home.x, s.animal.home.z, "swim", 0.3, r)) near = r;
            assert.ok(near <= 8, `${slug} placed ${near === Infinity ? "over 8" : near} m from its water`);
        }
        assert.ok(water / sampled >= 0.6, `${slug} on the water ${((100 * water) / sampled).toFixed(0)}% of the day`);
    }
    // (The Australian wood duck perches in its trees and grazes ashore: placed in them, as its text says.)
    assert.ok(behaviourProfile("australian-wood-duck").interactions.includes("perch_branch"));
});

test("water 2: a floater's goal cap leaves room to go about (1.5 m, three lengths); anything else keeps its own", () => {
    const duck = behaviourProfile("mallard");
    const swan = behaviourProfile("mute-swan");
    assert.equal(sched.rangeCap(duck, {range: 0.25, length: 0.5}), 1.5);
    assert.ok(Math.abs(sched.rangeCap(swan, {range: 0.5, length: 1.2}) - 3.6) < 1e-9);
    assert.equal(sched.rangeCap(duck, {range: 9, length: 0.5}), 9);
    assert.equal(sched.rangeCap(duck, {range: null, length: 0.5}), Infinity);
    assert.equal(sched.rangeCap(behaviourProfile("red-fox"), {range: 0.5, length: 0.9}), 0.5);
    assert.equal(sched.rangeCap(behaviourProfile("common-pipistrelle"), {range: 0.25, length: 0.05}), 0.25);
    const floats = (p: Profile) => p.move === "swim" && p.moves.includes("fly") && !p.breathes;
    const tight = subjects.filter((s) => {
        if (!floats(s.profile)) return false;
        const own = sched.rangeCap(s.profile, s.animal);
        const lead = s.animal.group ? sched.rangeCap(s.animal.group.profile, s.animal.group.leader) / 2 : Infinity;
        return Math.min(own, lead) < 0.75;
    });
    assert.deepEqual(tight.map((s) => s.slug).slice(0, 5), [], `${tight.length} floaters with every goal inside 0.75 m`);
});

test("water 2: a floater paddles at its own pace, not its walk clip's (a coot 0.15 m/s): a coot 0.4 m/s and up, a swan 1.2 at most; a fish as it was", () => {
    const pace = (slug: string, length: number) => sched.swimSpeedOf(behaviourProfile(slug), length);
    assert.ok(pace("eurasian-coot", 0.32) >= 0.4, `coot ${pace("eurasian-coot", 0.32).toFixed(2)} m/s`);
    assert.ok(pace("mute-swan", 1.21) <= 1.2, `swan ${pace("mute-swan", 1.21).toFixed(2)} m/s`);
    assert.ok(pace("mallard", 0.57) >= 0.5 && pace("mallard", 0.57) <= 0.8, `mallard ${pace("mallard", 0.57).toFixed(2)} m/s`);
    const fish = behaviourProfile("atlantic-cod");
    assert.ok(Math.abs(sched.swimSpeedOf(fish, 0.8) - freeBodyLengthsPerSecond(fish) * 0.8 * 1.4) < 1e-9, "a fish as before");
});

test("water 2: cranes roost on the ground or in the reeds, never up a tree; the crowned cranes perch in trees (their text)", () => {
    const cranes = subjects.filter((s) => /-crane$|^brolga$/.test(s.slug));
    assert.ok(cranes.length >= 10, `${cranes.length} cranes`);
    for (const s of cranes) {
        const roost = sched.roostOf(world, s.profile, s.animal);
        const up = roost.y - Math.max(heightAt(roost.x, roost.z), world.sampler.waterSurface ? world.sampler.waterSurface(roost.x, roost.z) : 0);
        if (s.slug === "grey-crowned-crane") assert.equal(s.profile.roost, "tree");
        else assert.ok(up < 0.5, `${s.slug} roosts ${up.toFixed(1)} m up`);
    }
});
