/**
 * Movement audit lane MA1 (docs/ark/movement-audit-2026-11-13.md problems 1 and 3): birds fly their air legs at their
 * cruise for their size, speed up out of a take-off and slow into a landing at no more than half a g, climb and glide in
 * at their angles, run across the water or the ground to take off when heavy, ski in on the water, and the rig's take-off
 * and landing clips play where they should (never a landing through the next flight).
 *
 * The audit's CI candidates, on the fixture Ark's flyers through a day: air speed ÷ L2 cruise (median over species
 * ≥ 0.6, none under 0.35), take-off and landing acceleration ≤ 0.5 g, the climb out of a take-off ≤ 35° for birds over
 * 1 kg, never climbing at touch-down, and no landing clip while it climbs or flies level (through clock jumps).
 */
// (First: the bigger wild island, v2, what islands mode shows, before anything samples the world. On today's small
// island the fixture's flyers have ranges a third of the size.)
import "@/lib/ark-world-v2-first";
import assert from "node:assert/strict";
import test from "node:test";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {behaviourProfile, type ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {airPaces, FLIGHT_WORTH, flightLoss, groupSpread, homeRadius, poseOnTrip, rangeReach, scheduleWorld, SLOT_SECONDS, spaceHomes, tripAt, wireThreats, type ScheduleAnimal, type Trip, type TripPose} from "@/ark-scene/behaviour-schedule";
import {eats} from "@/ark-scene/food-links";
import {airPacesOf, airProgress, clipBakeOf, clipRise, FLIGHT_ACCEL_MAX, flightGate, flightRigFrame, flightSpec, landingNow, legTuck, newFlightMemory, planAirLeg, strokeToClipPhase, takeoffClass, type AirStage, type FlightMemory, type FlightSpec} from "@/ark-scene/locomotion/flight";
import {locoStyleSlugs} from "@/ark-scene/locomotion/styles";
import {recordMotionMetric} from "@/lib/ark-motion-metrics";
import {placeAnimals} from "@/ark-scene/placement";
import {displayLength} from "@/ark-scene/sizes";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkAnimal} from "@/ark-scene/types";
import {arkWorld} from "@/ark-scene/world";
import {worldSampler} from "@/ark-scene/world-sampler";

const DEG = Math.PI / 180;
const world = scheduleWorld(worldSampler());
test("MA1: measured on the bigger wild island (v2)", () => assert.equal(arkWorld(), "v2"));
const snapshot = decodeArkSnapshot(fixtureV2)!;
const places = placeAnimals(snapshot.animals);
const SEA = new Set(["coral_reef", "open_ocean"]);
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
type Item = {a: ArkAnimal; animal: ScheduleAnimal; profile: ArkBehaviourProfile};

/** The fixture's animals wired as the scene wires them (as `ark-behaviour-schedule.test.ts`). */
function wire(): Item[] {
    const items: Item[] = snapshot.animals.map((a) => {
        const p = places.get(a.id)!;
        return {a, profile: behaviourProfile(a.model_slug), animal: {id: a.id, zone: a.zone, home: {x: p.x, y: p.ground, z: p.z}, length: displayLength(a), sea: SEA.has(a.zone)}};
    });
    const byId = new Map(items.map((i) => [i.a.id, i]));
    const sizes = new Map<string, number>();
    for (const i of items) {
        const lead = places.get(i.a.id)!.leader;
        if (lead && lead !== i.a.id) sizes.set(lead, (sizes.get(lead) ?? 1) + 1);
    }
    for (const i of items) {
        const place = places.get(i.a.id)!;
        const leader = place.leader && place.leader !== i.a.id ? byId.get(place.leader) : null;
        if (leader && leader.a.model_slug === i.a.model_slug && GROUPED.has(i.profile.social)) i.animal.group = {leader: leader.animal, profile: leader.profile, activity: leader.a.activity, rank: Math.max(place.rank ?? 1, 1), size: sizes.get(leader.a.id) ?? 2};
    }
    const radius = new Map(items.map((i) => [i.a.id, rangeReach(i.profile, i.animal) + (sizes.has(i.a.id) ? groupSpread(i.animal.length, sizes.get(i.a.id)!) : 0)]));
    const spaced = spaceHomes(
        items.filter((i) => !i.animal.group).map((i) => ({id: i.a.id, slug: i.a.model_slug, home: i.animal.home, length: i.animal.length, walkable: (x: number, z: number) => (i.profile.move === "swim" || i.profile.seabed ? world.nav.swimmable(x, z, 0.5) : world.nav.walkable(x, z))})),
        eats,
        (id) => radius.get(id) ?? 3
    );
    for (const i of items) {
        const moved = spaced.get(i.a.id);
        if (!moved) continue;
        i.animal.home = {x: moved.home.x, y: Math.max(world.sampler.heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
        i.animal.range = moved.range === null ? null : sizes.has(i.a.id) ? moved.range / 2 : moved.range;
        i.animal.prey = moved.prey;
    }
    for (const i of items) {
        const lead = i.animal.group?.leader;
        if (!lead || !spaced.has(lead.id)) continue;
        i.animal.home = {...lead.home};
        i.animal.range = lead.range;
    }
    wireThreats(items.map((i) => ({slug: i.a.model_slug, animal: i.animal, profile: i.profile, activity: i.a.activity})), eats);
    return items;
}
const animals = wire();
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
const DAY = Math.floor(Date.UTC(2026, 10, 11) / 1000);
const tripOf = (i: Item, t: number) => tripAt(world, i.profile, i.animal, t, hoursAt, i.a.activity);
const flyers = animals.filter((i) => (i.profile.move === "fly" || i.profile.moves.includes("fly")) && !SEA.has(i.a.zone));

/** Every air leg the fixture's flyers fly through a day (every other slot), with its trip and its start. */
type Flight = {i: Item; trip: Trip; start: number; leg: Trip["legs"][number]};
const flights: Flight[] = (() => {
    const out: Flight[] = [];
    for (const i of flyers) {
        for (let k = 0; k < 24 * 45; k += 2) {
            const trip = tripOf(i, DAY + k * SLOT_SECONDS + 1);
            if (trip.doing === "sleep") continue;
            let at = trip.start;
            for (const leg of trip.legs) {
                if (leg.mode === "air" && leg.seconds > 0) out.push({i, trip, start: at, leg});
                at += leg.seconds;
            }
        }
    }
    return out;
})();

// MARK: The planner

test("MA1: a planned flight starts and ends at rest, covers its route, and never speeds up or slows harder than half a g", () => {
    let checked = 0;
    const slugs = locoStyleSlugs().filter((slug, k) => k % 7 === 0 && flightSpec(slug, 0.3));
    for (const slug of slugs) {
        for (const lengthM of [0.12, 0.4, 1.1]) {
            const spec = flightSpec(slug, lengthM)!;
            const paces = airPacesOf(spec, takeoffClass(slug));
            for (const L of [2, 9, 35, 140]) {
                for (const [run, ski] of [[0, 0], [paces.runWater, paces.skiWater], [paces.runGround, 0]]) {
                    const plan = planAirLeg(paces, L, 6, {run, ski});
                    const n = 4000;
                    let last = 0;
                    let worst = 0;
                    for (let k = 0; k <= n; k++) {
                        const {rate} = airProgress(plan.knots, k / n);
                        const v = (rate * L) / plan.seconds;
                        if (k > 0) worst = Math.max(worst, Math.abs(v - last) / (plan.seconds / n));
                        last = v;
                    }
                    assert.ok(worst <= FLIGHT_ACCEL_MAX * 1.001, `${slug} ${lengthM} m over ${L} m: ${(worst / 9.81).toFixed(2)} g`);
                    assert.ok(Math.abs(airProgress(plan.knots, 1).share - 1) < 1e-9 && airProgress(plan.knots, 0).share === 0);
                    assert.ok(airProgress(plan.knots, 0).rate === 0 && airProgress(plan.knots, 1 - 1e-9).rate * L / plan.seconds < 0.05, `${slug} stops`);
                    assert.ok(plan.peak <= paces.cruise + 1e-9);
                    checked++;
                }
            }
        }
    }
    assert.ok(checked > 1000, `${checked}`);
});

test("MA1: heavy birds run to take off (a swan across the water, a crane on the ground), waterbirds ski in, a duck and a sparrow spring off", () => {
    const paces = (slug: string, L: number) => airPacesOf(flightSpec(slug, L)!, takeoffClass(slug));
    const runOf = (slug: string, L: number, water: boolean) => {
        const p = paces(slug, L);
        const plan = planAirLeg(p, 200, 6, {run: water ? p.runWater : p.runGround, ski: water ? p.skiWater : 0});
        return {run: plan.liftoff * 200, ski: (1 - plan.touchdown) * 200};
    };
    const swan = runOf("mute-swan", 1.5, true);
    assert.ok(swan.run > 12 && swan.run < 35, `swan's run ${swan.run.toFixed(1)} m`);
    assert.ok(swan.ski > 1.5, `swan's ski ${swan.ski.toFixed(1)} m`);
    const coot = runOf("eurasian-coot", 0.33, true);
    assert.ok(coot.run > 2 && coot.run < 10, `coot's patter ${coot.run.toFixed(1)} m`);
    assert.equal(runOf("eurasian-coot", 0.33, false).run, 0, "a coot springs off the ground");
    assert.ok(runOf("grey-crowned-crane", 1.0, false).run > 3, "a crane runs off the ground");
    assert.equal(runOf("mallard", 0.58, true).run, 0, "a dabbling duck springs off the water");
    assert.ok(runOf("mallard", 0.58, true).ski > 0.3, "a mallard skis in");
    assert.equal(runOf("house-sparrow", 0.15, false).run, 0);
    // The climb out of a take-off: about 45° for a sparrow, 35° or less for anything over a kilo (the audit's swan: 78°).
    for (const slug of locoStyleSlugs()) {
        const spec = flightSpec(slug, 0.3);
        if (!spec || spec.kind !== "bird") continue;
        for (const L of [0.3, 0.6, 1.0, 1.6]) {
            const s = flightSpec(slug, L)!;
            const p = airPacesOf(s, takeoffClass(slug));
            assert.ok(p.climb <= 45 * DEG + 1e-9 && p.climb >= 14 * DEG - 1e-9);
            if (s.massKg > 1) assert.ok(p.climb <= 35 * DEG, `${slug} at ${L} m (${s.massKg.toFixed(1)} kg) climbs at ${(p.climb / DEG).toFixed(0)}°`);
            assert.ok(p.accel <= FLIGHT_ACCEL_MAX && p.brake <= FLIGHT_ACCEL_MAX && p.runAccel <= FLIGHT_ACCEL_MAX);
        }
    }
    const sparrow = paces("house-sparrow", 0.15);
    assert.ok(sparrow.climb >= 40 * DEG);
});

// MARK: On the schedule

test("MA1 metric: air legs fly at their cruise: air speed ÷ L2 cruise median over species ≥ 0.6, none under 0.35", () => {
    const bySpecies = new Map<string, number[]>();
    for (const f of flights) {
        const cruise = airPaces(f.i.profile, f.i.animal.length).cruise;
        const list = bySpecies.get(f.i.a.model_slug) ?? [];
        list.push(f.leg.length / f.leg.seconds / cruise);
        bySpecies.set(f.i.a.model_slug, list);
    }
    const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
    const rows = Array.from(bySpecies, ([slug, list]) => ({slug, ratio: median(list)})).sort((a, b) => a.ratio - b.ratio);
    assert.ok(rows.length >= 6, `${rows.length} flying species`);
    const overall = median(rows.map((r) => r.ratio));
    recordMotionMetric("ma1", "air_speed_ratio_median", overall);
    recordMotionMetric("ma1", "air_speed_ratio_min", rows[0].ratio);
    console.log(`air speed ÷ cruise: median ${overall.toFixed(2)}; ${rows.map((r) => `${r.slug} ${r.ratio.toFixed(2)}`).join(", ")}`);
    assert.ok(overall >= 0.6, `median ${overall.toFixed(2)} (the audit's before: 0.20)`);
    assert.ok(rows[0].ratio >= 0.35, `slowest ${rows[0].slug} ${rows[0].ratio.toFixed(2)}`);
});

/** Its horizontal speed (m/s) and height over a stretch of a leg, sampled at 60 Hz. */
function sampled(f: Flight, from: number, to: number): Array<{t: number; x: number; z: number; y: number; pose: TripPose}> {
    const out = [];
    for (let t = from; t <= to + 1e-9; t += 1 / 60) {
        const pose = poseOnTrip(world, f.trip, f.start + Math.min(Math.max(t, 0), f.leg.seconds - 1e-6));
        out.push({t, x: pose.x, z: pose.z, y: pose.y, pose});
    }
    return out;
}

test("MA1 metric: take-off and landing horizontal acceleration ≤ 0.5 g (it was 0 to cruise in one frame and a dead stop)", () => {
    let checked = 0;
    let worst = 0;
    let at = "";
    for (const f of flights.filter((_, k) => k % 3 === 0)) {
        if (f.trip.shadow || f.trip.recipe) continue;
        const span = Math.min(2.5, f.leg.seconds / 2);
        for (const [a, b] of [[0, span], [f.leg.seconds - span, f.leg.seconds]]) {
            const s = sampled(f, a, b);
            const v = s.slice(1).map((p, k) => Math.hypot(p.x - s[k].x, p.z - s[k].z) * 60);
            for (let k = 3; k < v.length - 3; k++) {
                // (Over a tenth of a second.)
                const acc = Math.abs(v[k + 3] - v[k - 3]) * 10;
                if (acc > worst) {
                    worst = acc;
                    at = `${f.i.a.model_slug} ${f.trip.doing} ${f.leg.length.toFixed(1)} m at ${s[k].t.toFixed(2)} of ${f.leg.seconds.toFixed(2)} s`;
                }
            }
            checked++;
        }
    }
    assert.ok(checked > 200, `${checked}`);
    recordMotionMetric("ma1", "takeoff_landing_accel_g", worst / 9.81, "g");
    console.log(`take-off and landing acceleration: worst ${(worst / 9.81).toFixed(3)} g over ${checked} ends (${at})`);
    assert.ok(worst <= FLIGHT_ACCEL_MAX * 1.08, `${(worst / 9.81).toFixed(2)} g (${at})`);
});

test("MA1 metric: never climbing as it touches down; a bird over 1 kg climbs out of a take-off at 35° or less", () => {
    let landings = 0;
    let climbs = 0;
    for (const f of flights.filter((_, k) => k % 2 === 0)) {
        if (f.trip.shadow || f.trip.recipe) continue;
        const end = sampled(f, f.leg.seconds - 2 / 60, f.leg.seconds - 1e-4);
        const a = end[0];
        const b = end[end.length - 1];
        const vy = (b.y - a.y) * 30;
        // It comes to rest on its perch, its rock or the water (the audit's swan: 4.75 m/s to nothing in a frame, still
        // climbing 0.9 m/s); up to a perch it swoops up and stops with its speed; level or downhill it never climbs.
        const speed = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) * 30;
        assert.ok(speed <= (f.leg.plan!.touchdown < 1 ? 0.7 : 0.8), `${f.i.a.model_slug} touches down at ${speed.toFixed(2)} m/s (${f.trip.doing})`);
        if (f.leg.to.y <= f.leg.from.y + 0.3) assert.ok(vy <= 0.02, `${f.i.a.model_slug} ${vy.toFixed(2)} m/s up at touch-down (${f.trip.doing})`);
        landings++;
        const plan = f.leg.plan!;
        const mass = flightSpec(f.i.a.model_slug, f.i.animal.length)?.massKg ?? 0;
        const L = f.leg.length - Math.abs(f.leg.to.y - f.leg.from.y);
        const paces = airPaces(f.i.profile, f.i.animal.length);
        // (Not one steepened to clear a fence or a rock it takes off beside: `overSolids`, the collisions lane's.)
        const cleared = plan.rise < (1.5 * plan.height) / Math.tan(paces.climb) / L - 1e-6;
        if (mass > 1 && Math.abs(f.leg.to.y - f.leg.from.y) < 0.3 && plan.height > 0.5 && !cleared) {
            // Its own climb (its hump over its line): the steepest slope of a smoothstep is 1.5 times its mean.
            const steepest = Math.atan((1.5 * plan.height) / (plan.rise * L));
            assert.ok(steepest <= 35.5 * DEG, `${f.i.a.model_slug} climbs at ${(steepest / DEG).toFixed(0)}°`);
            climbs++;
        }
    }
    assert.ok(landings > 200 && climbs > 5, `${landings} landings, ${climbs} climbs`);
});

test("MA1: a flight is worth taking: a walker walks or swims a short way; its own flight goes somewhere worth flying to", () => {
    let walkers = 0;
    let own = 0;
    let far = 0;
    for (const f of flights) {
        if (f.trip.shadow || f.trip.recipe || f.trip.doing === "soar") continue;
        const {from, to} = f.leg;
        const flat = Math.hypot(to.x - from.x, to.z - from.z);
        const raised = (p: typeof from) => p.y > Math.max(world.sampler.heightAt(p.x, p.z), 0) + 0.4;
        if (raised(from) || raised(to) || to.point) continue;
        const paces = airPaces(f.i.profile, f.i.animal.length);
        const worth = FLIGHT_WORTH * flightLoss(paces, paces.runGround, 0);
        // Between two spots on the ground, never a hop it would walk (its walk takes under 20 s, or the flight is not worth it).
        const walker = f.i.profile.move === "walk" || f.i.profile.moves.includes("walk");
        const wetAt = (p: {x: number; z: number}) => world.sampler.heightAt(p.x, p.z) < (world.sampler.waterSurface?.(p.x, p.z) ?? 0);
        if (walker && f.trip.doing !== "fly" && !wetAt(from) && !wetAt(to)) {
            assert.ok(flat > Math.max(3, f.i.animal.length * 6) - 1e-6, `${f.i.a.model_slug} flies ${flat.toFixed(1)} m (${f.trip.doing})`);
            walkers++;
        }
        // Its own flight (not a group member's) to a spot on the ground: out past most of the take-off's and the landing's cost.
        // (Not a floater's flight to the water near it: its water goals are the water lane's, MA3.)
        // (Not one whose range is capped by its prey, nor one that keeps clear of predators: those stay near.)
        if (f.trip.doing === "fly" && !f.i.animal.group && !f.i.animal.range && !f.i.animal.threats?.length && !wetAt(to) && worth > homeRadius(f.i.profile, f.i.animal) * 0.8) {
            const fromHome = Math.hypot(to.x - f.i.animal.home.x, to.z - f.i.animal.home.z);
            if (fromHome >= Math.min(worth, 90 * 0.9) * 0.75) far++;
            own++;
        }
    }
    // (Most of them: where four bearings find no open ground clear of its predators, it flies somewhere nearer.)
    assert.ok(own > 5 && far >= own * 0.75, `${far} of ${own} flights of its own go far enough (${walkers} walkers' flights)`);
});

// MARK: The rig

const spec = (slug: string, L: number) => flightSpec(slug, L)!;

/** A rig player in miniature: the gate, the flight frame, its clips' phases. */
type Sim = {flying: boolean; now: string | null; phase: number; air: number; memory: FlightMemory; climb: number; last: {x: number; y: number; z: number} | null};
function simStep(sim: Sim, s: FlightSpec, pose: TripPose, dt: number, clock: number): {clip: string | null; stage: AirStage | null} {
    const airLeg = pose.moving && (pose.beat === "fly" || pose.beat === "glide");
    const inAir = pose.aloft || airLeg;
    const stage = airLeg ? pose.air?.stage ?? null : null;
    if (sim.last) {
        const flat = Math.hypot(pose.x - sim.last.x, pose.z - sim.last.z);
        if (flat < 3) sim.climb += ((flat > 1e-5 ? Math.atan2(pose.y - sim.last.y, flat) : 0) - sim.climb) * Math.min(dt * 4, 1);
    }
    sim.last = {x: pose.x, y: pose.y, z: pose.z};
    const rising = pose.aloft || (airLeg && (stage ? stage === "run" || stage === "climb" : sim.climb > -0.01));
    const agl = pose.air ? pose.y - pose.air.to : pose.y;
    const landHeight = 1.2 * s.lengthM * 0.6;
    const landing = (!pose.aloft && (stage ? stage === "descend" || stage === "ski" : sim.climb < -0.01)) || !inAir || landingNow(agl, sim.climb, landHeight);
    const gate = flightGate({flies: true, flying: sim.flying, inAir, rising, landing, air: sim.air, now: sim.now, phase: sim.phase, stage, hasTakeoff: true, hasLand: true});
    if (gate.play === "takeoff" || gate.play === "land") {
        sim.now = gate.play;
        sim.phase = 0;
    }
    const leave = gate.play === "flight";
    sim.flying = gate.flying;
    if (sim.flying) {
        const oneShot = !leave && (sim.now === "takeoff" || sim.now === "land") && sim.phase < 1 ? (sim.now as "takeoff" | "land") : null;
        const frame = flightRigFrame({spec: s, has: () => true, clipHz: () => 5, current: sim.now, phase: sim.phase, climb: sim.climb, turn: 0, speed: pose.air?.speed ?? 0, agl, landHeight, drawnHeight: s.lengthM * 0.6, stage, oneShot, clock, seed: 0.3, dt}, sim.memory);
        if (frame.clip !== sim.now) {
            sim.now = frame.clip;
            sim.phase = frame.mode === "sync" ? frame.phase : 0;
        } else sim.phase = frame.mode === "sync" ? frame.phase : sim.phase + dt * frame.rate;
    } else if (sim.now !== "land" || sim.phase >= 1) {
        sim.now = "idle";
        sim.phase = 0;
    }
    sim.air += ((pose.aloft ? 1 : 0) - sim.air) * Math.min(dt * 6, 1);
    return {clip: sim.now, stage: sim.flying ? stage : null};
}

test("MA1: a landing left from an earlier flight (drawn as a token meanwhile, a clock jump) never plays through the next one", () => {
    // The audit's coot (rec3 `coot-takeoff`): its rig state stood at land 0.907, flying, while it was drawn as a token;
    // back near, already up and climbing, the landing played on.
    const gate = flightGate({flies: true, flying: true, inAir: true, rising: true, landing: false, air: 1, now: "land", phase: 0.907, stage: "climb", hasTakeoff: true, hasLand: true});
    assert.deepEqual(gate, {flying: true, play: "flight", landed: false});
    // Finished, it comes back up in the air: it flies (no take-off clip in mid-air, and not the finished landing).
    const back = flightGate({flies: true, flying: false, inAir: true, rising: true, landing: false, air: 1, now: "land", phase: 1, stage: "cruise", hasTakeoff: true, hasLand: true});
    assert.equal(back.flying, true);
    assert.equal(back.play, "flight");
    // A run across the water takes off flapping, not springing.
    assert.equal(flightGate({flies: true, flying: false, inAir: true, rising: true, landing: false, air: 0, now: "idle", phase: 0, stage: "run", hasTakeoff: true, hasLand: true}).play, null);
    // A stale climb (it was coming down before) never lands it on its run.
    assert.equal(flightGate({flies: true, flying: true, inAir: true, rising: true, landing: true, air: 0, now: "flap", phase: 0.3, stage: "run", hasTakeoff: true, hasLand: true}).play, null);
});

test("MA1 metric: no landing clip while it runs, climbs or flies level, through clock jumps (the fixture's flyers)", () => {
    let frames = 0;
    let flown = 0;
    let landed = 0;
    for (const i of flyers) {
        const s = flightSpec(i.a.model_slug, i.animal.length);
        if (!s) continue;
        const sim: Sim = {flying: false, now: "idle", phase: 0, air: 0, memory: newFlightMemory(), climb: 0, last: null};
        const legs = flights.filter((f) => f.i === i && !f.trip.recipe).slice(0, 6);
        for (const f of legs) {
            // A jump to a moment before it sets off (the rig's state kept from wherever it was).
            sim.last = null;
            const dt = 1 / 30;
            for (let t = f.start - 1; t < f.start + f.leg.seconds + 1.5; t += dt) {
                const pose = poseOnTrip(world, f.trip, t);
                const {clip, stage} = simStep(sim, s, pose, dt, t);
                frames++;
                if (stage === "run" || stage === "climb" || stage === "cruise") assert.notEqual(clip, "land", `${i.a.model_slug} lands while it ${stage}s at ${(t - f.start).toFixed(2)} s of ${f.leg.seconds.toFixed(1)}`);
                if (sim.flying) flown++;
            }
            if (!sim.flying) landed++;
            // And sometimes a jump into the middle of the next flight, its state stale.
            sim.flying = true;
            sim.now = "land";
            sim.phase = 0.9;
        }
    }
    recordMotionMetric("ma1", "land_clip_in_flight_frames", 0);
    assert.ok(frames > 5000 && flown > 1000 && landed > 20, `${frames} frames, ${flown} flying, ${landed} landed`);
});

test("MA1: the take-off spring plays whole (its own pace) and its rise and the landing's fall are taken back off; legs tuck in the air", () => {
    const swan = spec("mute-swan", 1.5);
    const memory = newFlightMemory();
    const input = {spec: swan, has: () => true, clipHz: () => 2.5, current: "takeoff", climb: 0.3, turn: 0, speed: 3, agl: 0.5, clock: 10, seed: 0.2, dt: 1 / 60, drawnHeight: 1};
    const early = flightRigFrame({...input, phase: 0.5, oneShot: "takeoff"}, memory);
    assert.equal(early.clip, "takeoff");
    assert.equal(early.rate, 1);
    assert.ok(Math.abs(early.heave + clipRise("takeoff", 0.5)) < 1e-9);
    assert.equal(flightRigFrame({...input, phase: 0.9, oneShot: "takeoff"}, memory).clip, "takeoff", "a swan's whole take-off");
    const sparrow = spec("house-sparrow", 0.15);
    assert.equal(flightRigFrame({...input, spec: sparrow, phase: 0.6, oneShot: "takeoff"}, newFlightMemory()).clip, "flap", "a sparrow beats its own wings after the spring");
    // The clips' root rise, taken back off: none at the take-off's start or the landing's end.
    assert.equal(clipRise("takeoff", 0), 0);
    assert.equal(clipRise("land", 1), 0);
    assert.ok(clipRise("land", 0) > 0.7);
    // Legs: hanging on a run, coming up through the take-off, tucked in flight, reaching down to land.
    assert.equal(legTuck("flap", 0.3, "run"), 0);
    assert.equal(legTuck("takeoff", 0.2, "climb"), 0);
    assert.equal(legTuck("takeoff", 0.8, "climb"), 1);
    assert.equal(legTuck("flap", 0.3, "cruise"), 1);
    assert.equal(legTuck("land", 0.6, "descend"), 0);
    assert.ok(legTuck("land", 0.1, "descend") > 0.8);
    // On a ski the landing holds its touch-down (feet planing), finishing once it stops.
    const land = newFlightMemory();
    const ski = flightRigFrame({...input, current: "land", phase: 0.5, agl: 0, oneShot: "land", stage: "ski"}, land);
    assert.ok(ski.phase >= 0.78 && ski.phase <= 0.8);
    let phase = ski.phase;
    for (let k = 0; k < 30; k++) phase = flightRigFrame({...input, current: "land", phase, agl: 0, oneShot: "land", stage: null}, land).phase;
    assert.equal(phase, 1);
});

// MARK: v7 rigs (MA2's v3 birds, decision 278)

test("MA1/v7: a v7 file's flight clips bake their own beat, fold and tuck; v2 files play exactly as before", () => {
    // The rig code decides: v2's `v5+v6` bakes nothing of ours, v3's `v7+v6` does.
    assert.equal(clipBakeOf("v5+v6", {downstroke: 0.55, tuck: 1}), null);
    assert.equal(clipBakeOf(null, {tuck: 1}), null);
    const flap = clipBakeOf("v7+v6", {downstroke: 0.6, tuck: 0.45})!;
    assert.deepEqual(flap, {downstroke: 0.6, tuck: 0.45, liftoff: null, touchdown: null, riseH: null});
    // The beat onto the flap: v2's symmetric cosine as before (no clip downstroke given)...
    const v2 = (beat: number, down: number, stroke: number) => {
        const b = beat - Math.floor(beat);
        const s = b < down ? Math.cos((Math.PI * b) / down) : -Math.cos((Math.PI * (b - down)) / (1 - down));
        const q = Math.acos(Math.min(Math.max(s * stroke, -1), 1)) / (2 * Math.PI);
        return b < down ? q : 1 - q;
    };
    for (let k = 0; k < 200; k++) {
        const beat = k / 200 + 0.0013;
        for (const [down, stroke] of [[0.58, 1], [0.55, 0.6]]) assert.ok(Math.abs(strokeToClipPhase(beat, down, stroke) - v2(beat, down, stroke)) < 1e-12);
        // ...and through a v7 flap's own downstroke: the same stroke position on the clip's own curve, and the beat itself
        // when the bird's downstroke is the clip's.
        for (const [down, stroke, clip] of [[0.58, 1, 0.55], [0.55, 0.6, 0.6], [0.6, 1, 0.6]]) {
            const p = strokeToClipPhase(beat, down, stroke, clip);
            const want = (beat < down ? Math.cos((Math.PI * beat) / down) : -Math.cos((Math.PI * (beat - down)) / (1 - down))) * stroke;
            const got = p < clip ? Math.cos((Math.PI * p) / clip) : -Math.cos((Math.PI * (p - clip)) / (1 - clip));
            assert.ok(Math.abs(got - want) < 1e-9, `stroke ${got} vs ${want}`);
            if (down === clip && stroke === 1) assert.ok(Math.abs(p - beat) < 1e-9);
            assert.equal(p < clip, beat < down, "the downstroke stays the downstroke");
        }
    }
    // Legs: v2 as before; on a v7 flight clip only what the clip leaves; none through a v7 take-off or landing.
    for (const [clip, phase] of [["flap", 0.3], ["glide", 0], ["takeoff", 0.8], ["takeoff", 0.2], ["land", 0.1], ["land", 0.9]] as const) {
        assert.equal(legTuck(clip, phase, "cruise", null), legTuck(clip, phase, "cruise"));
        if (clip === "takeoff" || clip === "land") assert.equal(legTuck(clip, phase, "climb", clipBakeOf("v7", {tuck: 1, liftoff: 0.25, touchdown: 0.75})), 0);
    }
    assert.equal(legTuck("flap", 0.3, "cruise", clipBakeOf("v7", {tuck: 1})), 0);
    assert.ok(Math.abs(legTuck("flap", 0.3, "cruise", clipBakeOf("v7", {tuck: 0.45})) - 0.55) < 1e-12);
    assert.ok(Math.abs(legTuck("glide", 0, "cruise", clipBakeOf("v7", {tuck: 0.25})) - 0.75) < 1e-12);
    assert.equal(legTuck("flap", 0.3, "run", clipBakeOf("v7", {tuck: 0.25})), 0);
    // The clips' root rise: v2's numbers; a v7 file's own lift-off, touch-down and rise where it gives them.
    for (const p of [0, 0.3, 0.6, 1]) {
        assert.equal(clipRise("takeoff", p, null), clipRise("takeoff", p));
        assert.equal(clipRise("takeoff", p, clipBakeOf("v7", {liftoff: 0.25, rise_h: 1.2})), clipRise("takeoff", p));
        assert.equal(clipRise("land", p, clipBakeOf("v7", {touchdown: 0.75, rise_h: 1.2})), clipRise("land", p));
    }
    assert.ok(clipRise("takeoff", 0.5, clipBakeOf("v7", {liftoff: 0.4, rise_h: 1})) < clipRise("takeoff", 0.5));
    // The flight frame: the flap's phase through the clip's own downstroke on v7, as before on v2.
    const s = spec("mute-swan", 1.5);
    const base = {spec: s, has: () => true, clipHz: () => 2.5, current: "flap", phase: 0, climb: 0, turn: 0, speed: 12, agl: 30, clock: 20, seed: 0.2, dt: 1 / 60};
    const a = newFlightMemory();
    const b = newFlightMemory();
    let maxDiff = 0;
    for (let k = 0; k < 120; k++) {
        const f2 = flightRigFrame({...base, clock: 20 + k / 60}, a);
        const f7 = flightRigFrame({...base, clock: 20 + k / 60, bake: (name) => (name === "flap" ? clipBakeOf("v7+v6", {downstroke: 0.6, tuck: 1}) : null)}, b);
        assert.equal(f2.clip, f7.clip);
        if (f2.clip === "flap") maxDiff = Math.max(maxDiff, Math.abs(f2.phase - f7.phase));
        assert.ok(f7.clip !== "flap" || f7.phase < 0.6 === f2.phase < 0.5, "a downstroke on both");
    }
    assert.ok(maxDiff > 0.01, "v7's phases are its own");
});
