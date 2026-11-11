import assert from "node:assert/strict";
import test from "node:test";
import table from "@/ark-scene/behaviours.json";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {ARK_BEHAVIOURS, ARK_INTERACTIONS, behaviourProfile, decodeBehaviourRow, type ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {amphibious, awakeAt, groupSpread, homeRadius, rangeReach, maxSlopeOf, poseOnTrip, roostOf, scheduleWorld, spaceHomes, SAFE_METRES, SLOT_SECONDS, tripAt, type ScheduleAnimal, type Trip} from "@/ark-scene/behaviour-schedule";
import {eats} from "@/ark-scene/food-links";
import {sceneSampler} from "@/ark-scene/world-sampler";
import {placeAnimals} from "@/ark-scene/placement";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {displayLength} from "@/ark-scene/sizes";
import type {ArkAnimal} from "@/ark-scene/types";

const world = scheduleWorld(sceneSampler());
const snapshot = decodeArkSnapshot(fixtureV2)!;
const places = placeAnimals(snapshot.animals);
const SEA = new Set(["coral_reef", "open_ocean"]);
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
type Item = {a: ArkAnimal; animal: ScheduleAnimal; profile: ArkBehaviourProfile};

/** The fixture's animals as the scene wires them: groups to their leaders, predators spaced from their prey. */
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
    // A leader's reach includes its group's spread round it.
    const radius = new Map(items.map((i) => [i.a.id, rangeReach(i.profile, i.animal) + (sizes.has(i.a.id) ? groupSpread(i.animal.length, sizes.get(i.a.id)!) : 0)]));
    const spaced = spaceHomes(
        items.filter((i) => !i.animal.group).map((i) => ({id: i.a.id, slug: i.a.model_slug, home: i.animal.home, length: i.animal.length, walkable: (x: number, z: number) => (i.profile.move === "swim" || i.profile.seabed ? world.nav.swimmable(x, z, 0.5) : world.nav.walkable(x, z))})),
        eats,
        (id) => radius.get(id) ?? 3
    );
    for (const i of items) {
        const moved = spaced.get(i.a.id);
        if (moved) {
            i.animal.home = {x: moved.home.x, y: Math.max(world.sampler.heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
            // A leader's reach is shared with its group's spread: half each.
            i.animal.range = moved.range === null ? null : sizes.has(i.a.id) ? moved.range / 2 : moved.range;
            i.animal.prey = moved.prey;
        }
    }
    // A group's members share their leader's place and range (they roost and roam round it).
    for (const i of items) {
        const lead = i.animal.group?.leader;
        if (!lead || !spaced.has(lead.id)) continue;
        i.animal.home = {...lead.home};
        i.animal.range = lead.range;
    }
    return items;
}
const animals = wire();
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
const DAY = Math.floor(Date.UTC(2026, 10, 11) / 1000);
const tripOf = (i: Item, t: number, previous?: Trip | null) => tripAt(world, i.profile, i.animal, t, hoursAt, i.a.activity, previous);
const poseOf = (i: Item, t: number) => poseOnTrip(world, tripOf(i, t), t);

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
    for (const i of animals.slice(0, 40)) {
        for (const h of [2, 7.5, 13, 19]) {
            const t = DAY + h * 3600 + 17;
            const one = tripAt(world, i.profile, i.animal, t, hoursAt, i.a.activity);
            const two = tripAt(again, i.profile, i.animal, t, hoursAt, i.a.activity);
            assert.deepEqual(one, two);
            assert.deepEqual(poseOnTrip(world, one, t), poseOnTrip(again, two, t));
        }
    }
});

test("nothing jumps: where a slot ends is where the next one starts", () => {
    let checked = 0;
    for (const i of animals.filter((_, k) => k % 3 === 0)) {
        for (let k = 0; k < 24 * 45; k += 9) {
            const end = tripOf(i, DAY + k * SLOT_SECONDS).end;
            const first = tripOf(i, end - 0.001);
            const before = poseOnTrip(world, first, end - 0.001);
            const next = tripOf(i, end);
            const after = poseOnTrip(world, next, end);
            const gap = Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z);
            assert.ok(gap < 0.3, `${i.a.model_slug} jumps ${gap.toFixed(2)} m at slot ${next.slot} (${first.doing} -> ${next.doing})`);
            assert.deepEqual(tripOf(i, end, first), next);
            checked++;
        }
    }
    assert.ok(checked > 400);
});

test("asleep means at its roost, and getting there is a visible trip", () => {
    let roosted = 0;
    let trips = 0;
    for (const i of animals) {
        if (i.profile.move === "sessile") continue;
        const roost = roostOf(world, i.profile, i.animal);
        for (let k = 0; k < 24 * 45; k += 3) {
            const probe = tripOf(i, DAY + k * SLOT_SECONDS);
            const t = probe.start + SLOT_SECONDS * 0.9;
            const trip = tripOf(i, t);
            const asleep = !awakeAt(i.profile, i.a.activity, hoursAt(trip.start));
            if (asleep) assert.ok(trip.doing === "sleep" || trip.doing === "to_roost" || trip.doing === "watch", `${i.a.model_slug} awake at slot ${k}: ${trip.doing}`);
            else assert.ok(trip.doing !== "sleep" && trip.doing !== "to_roost", `${i.a.model_slug} asleep by day at slot ${k}`);
            if (trip.doing === "sleep") {
                const pose = poseOnTrip(world, trip, t);
                assert.ok(Math.hypot(pose.x - roost.x, pose.z - roost.z) < 0.05, `${i.a.model_slug} asleep away from its roost`);
                roosted++;
            }
            if (trip.doing === "to_roost" && trip.mode !== "stay") {
                assert.ok(trip.arrive > trip.start, `${i.a.model_slug} snaps to its roost`);
                trips++;
            }
        }
    }
    assert.ok(roosted > 100 && trips > 10, `roosted ${roosted}, trips ${trips}`);
});

test("birds fly between places and land: no circles, most of the day perched or on the ground", () => {
    let aloft = 0;
    let awake = 0;
    let flights = 0;
    for (const i of animals.filter((x) => x.profile.move === "fly" && !SEA.has(x.a.zone))) {
        for (let k = 0; k < 24 * 45; k += 2) {
            const trip = tripOf(i, DAY + k * SLOT_SECONDS);
            if (trip.doing === "sleep") continue;
            for (const leg of trip.legs.filter((l) => l.mode === "air")) {
                flights++;
                // A flight goes somewhere: never back to where it took off.
                if (trip.shadow) continue;
                assert.ok(Math.hypot(leg.to.x - leg.from.x, leg.to.z - leg.from.z) + Math.abs(leg.to.y - leg.from.y) > 0.3 || leg.seconds < 1, `${i.a.model_slug} flies a loop`);
            }
            for (let s = 5; s < SLOT_SECONDS; s += 10) {
                awake++;
                if (poseOnTrip(world, trip, trip.start + s).aloft) aloft++;
            }
            // Only flocking species fly together.
            if (trip.shadow) assert.ok(["flock", "school", "swarm"].includes(i.profile.social), `${i.a.model_slug} (${i.profile.social}) follows its leader in the air`);
        }
    }
    assert.ok(flights > 20, `flights ${flights}`);
    assert.ok(aloft / awake < 0.5, `aloft ${((aloft / awake) * 100).toFixed(0)}% of the waking time`);
});

test("variety: in a group of three or more, rarely all doing the same thing", () => {
    const groups = new Map<string, Item[]>();
    for (const i of animals) {
        const key = i.animal.group ? i.animal.group.leader.id : i.a.id;
        groups.set(key, [...(groups.get(key) ?? []), i]);
    }
    let samples = 0;
    let same = 0;
    for (const members of Array.from(groups.values())) {
        if (members.length < 3) continue;
        for (let k = 0; k < 24 * 45; k += 7) {
            const t = DAY + k * SLOT_SECONDS + 13;
            const doings = members.map((m) => tripOf(m, t).doing);
            if (doings.some((d) => d === "sleep" || d === "to_roost")) continue;
            samples++;
            if (new Set(doings).size === 1) same++;
        }
    }
    assert.ok(samples > 20, `samples ${samples}`);
    assert.ok(same / samples < 0.15, `all the same ${same} of ${samples}`);
});

test("groups stay together as loose clusters, never a row", () => {
    let checked = 0;
    const groups = new Map<string, Item[]>();
    for (const i of animals) if (i.animal.group) groups.set(i.animal.group.leader.id, [...(groups.get(i.animal.group.leader.id) ?? []), i]);
    for (const [leaderId, members] of Array.from(groups.entries())) {
        const leader = animals.find((i) => i.a.id === leaderId)!;
        const all = [leader, ...members];
        if (all.length < 3) continue;
        for (let k = 0; k < 24 * 45; k += 11) {
            const t = DAY + k * SLOT_SECONDS + 31;
            const poses = all.map((m) => poseOf(m, t));
            // Together: everyone within reach of the group's middle.
            const cx = poses.reduce((s, p) => s + p.x, 0) / poses.length;
            const cz = poses.reduce((s, p) => s + p.z, 0) / poses.length;
            const spread = Math.max(...poses.map((p) => Math.hypot(p.x - cx, p.z - cz)));
            assert.ok(spread < 60, `${leader.a.model_slug} group spread ${spread.toFixed(1)} m`);
            // Not a row: the members close together (one off drinking doesn't count) are not all on one line
            // (the smaller spread across the best line through them is real).
            const mx = [...poses.map((p) => p.x)].sort((a, b) => a - b)[Math.floor(poses.length / 2)];
            const mz = [...poses.map((p) => p.z)].sort((a, b) => a - b)[Math.floor(poses.length / 2)];
            const cluster = poses.filter((p) => Math.hypot(p.x - mx, p.z - mz) < 12);
            // (Three points fall near a line by chance; a row needs four.)
            if (cluster.length < 4) continue;
            const kx = cluster.reduce((s, p) => s + p.x, 0) / cluster.length;
            const kz = cluster.reduce((s, p) => s + p.z, 0) / cluster.length;
            const xs = cluster.map((p) => p.x - kx);
            const zs = cluster.map((p) => p.z - kz);
            const sxx = xs.reduce((s, x) => s + x * x, 0);
            const szz = zs.reduce((s, z) => s + z * z, 0);
            const sxz = xs.reduce((s, x, n) => s + x * zs[n], 0);
            const tr = sxx + szz;
            const det = sxx * szz - sxz * sxz;
            const minor = tr / 2 - Math.sqrt(Math.max((tr * tr) / 4 - det, 0));
            if (tr > 0.5) {
                checked++;
                // A row is what looks made: on one line and evenly spaced along it.
                const major = tr - minor;
                const ax = sxz !== 0 ? major - szz : 1;
                const az = sxz !== 0 ? sxz : 0;
                const norm = Math.hypot(ax, az) || 1;
                const along = xs.map((x, n) => (x * ax + zs[n] * az) / norm).sort((p, q) => p - q);
                const gaps = along.slice(1).map((v, n) => v - along[n]);
                const mean = gaps.reduce((s2, g) => s2 + g, 0) / gaps.length;
                const cv = Math.sqrt(gaps.reduce((s2, g) => s2 + (g - mean) ** 2, 0) / gaps.length) / (mean || 1);
                assert.ok(minor / tr > 0.004 || cv > 0.35, `${leader.a.model_slug} group in an even row at slot ${k}`);
            }
        }
    }
    assert.ok(checked > 10, `checked ${checked}`);
});

test("predators keep a safe distance from the animals they eat", () => {
    const predators = animals.filter((p) => animals.some((q) => q !== p && eats(p.a.model_slug, q.a.model_slug)));
    assert.ok(predators.length > 0, "the fixture has predators of its prey");
    let samples = 0;
    for (const p of predators) {
        const prey = animals.filter((q) => eats(p.a.model_slug, q.a.model_slug));
        const safe = Math.max(SAFE_METRES, p.animal.length * 6);
        for (let k = 0; k < 24 * 45; k += 13) {
            const t = DAY + k * SLOT_SECONDS + 7;
            const at = poseOf(p, t);
            if (at.aloft) continue;
            for (const q of prey) {
                const qa = poseOf(q, t);
                const d = Math.hypot(at.x - qa.x, at.z - qa.z);
                assert.ok(d >= safe * 0.9, `${p.a.model_slug} within ${d.toFixed(1)} m of a ${q.a.model_slug} (safe ${safe.toFixed(0)})`);
                samples++;
            }
        }
    }
    assert.ok(samples > 50, `samples ${samples}`);
});

test("land and water: amphibious animals cross at a water's edge, sliding in and climbing out", () => {
    let crossings = 0;
    for (const i of animals.filter((x) => amphibious(x.profile) && !SEA.has(x.a.zone))) {
        for (let k = 0; k < 24 * 45; k += 1) {
            const trip = tripOf(i, DAY + k * SLOT_SECONDS);
            const enter = trip.legs.find((l) => l.mode === "enter");
            const exit = trip.legs.find((l) => l.mode === "exit");
            if (enter) {
                assert.ok(enter.from.point?.startsWith("water_edge"), `${i.a.model_slug} enters the water away from an edge`);
                crossings++;
            }
            if (exit) {
                assert.ok(exit.to.point?.startsWith("water_edge"), `${i.a.model_slug} climbs out away from an edge`);
                assert.equal(trip.stay[0]?.beat, "shake", `${i.a.model_slug} doesn't shake off`);
                crossings++;
            }
        }
    }
    assert.ok(crossings > 5, `crossings ${crossings}`);
});

test("grazers graze: head down to bite, chew, step on, and look up now and then", () => {
    const beats = new Map<string, number>();
    for (const i of animals.filter((x) => x.profile.weights.graze)) {
        for (let k = 0; k < 24 * 45; k += 3) {
            const trip = tripOf(i, DAY + k * SLOT_SECONDS);
            if (trip.doing !== "graze") continue;
            for (let s = 0; s < SLOT_SECONDS; s += 2) {
                const t = trip.start + s;
                if (t < trip.arrive) continue;
                const beat = poseOnTrip(world, trip, t).beat;
                beats.set(beat, (beats.get(beat) ?? 0) + 1);
            }
        }
    }
    for (const beat of ["bite", "chew", "step", "scan"]) assert.ok((beats.get(beat) ?? 0) > 0, `no ${beat} in ${JSON.stringify(Object.fromEntries(beats))}`);
    assert.ok((beats.get("bite") ?? 0) > (beats.get("scan") ?? 0), "mostly head down");
});

test("walkers stay on walkable ground, swimmers in the water", () => {
    let walking = 0;
    const off: string[] = [];
    for (const i of animals) {
        for (let k = 0; k < 24 * 45; k += 5) {
            const t = DAY + k * SLOT_SECONDS + 20;
            const trip = tripOf(i, t);
            const pose = poseOnTrip(world, trip, t);
            const leg = trip.legs.find((l) => l.mode === "ground");
            if (leg && pose.moving && pose.beat === "walk" && !amphibious(i.profile)) {
                walking++;
                if (!world.nav.walkable(pose.x, pose.z, maxSlopeOf(i.animal)) && Math.hypot(pose.x - trip.from.x, pose.z - trip.from.z) > 3 && Math.hypot(pose.x - trip.to.x, pose.z - trip.to.z) > 3) off.push(i.a.model_slug);
            }
            if (i.profile.move === "swim" && pose.beat === "swim" && world.sampler.heightAt(pose.x, pose.z) < 0) assert.ok(pose.y <= 0.01, `${i.a.model_slug} out of the water`);
        }
    }
    assert.ok(walking > 100 && off.length / walking < 0.03, `${off.length} of ${walking} walking samples off the grid: ${Array.from(new Set(off)).join(", ")}`);
});

test("at the shore nothing jumps: amphibious animals go in and out of the water at their own pace, second by second", () => {
    // (A route's mid-way pause from the water, and a path whose ends shared a grid cell, used to snap an animal 9-15 m.)
    let steps = 0;
    for (const i of animals.filter((x) => amphibious(x.profile))) {
        let prev = poseOf(i, DAY + 4 * 3600);
        for (let s = 1; s < 4 * 3600; s += 1) {
            const p = poseOf(i, DAY + 4 * 3600 + s);
            if (!p.aloft && !prev.aloft) {
                const step = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
                assert.ok(step < 8, `${i.a.model_slug} jumps ${step.toFixed(1)} m in a second (${prev.beat} -> ${p.beat})`);
                steps++;
            }
            prev = p;
        }
    }
    assert.ok(steps > 50000, `steps ${steps}`);
});
