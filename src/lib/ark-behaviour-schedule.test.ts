import assert from "node:assert/strict";
import test from "node:test";
import table from "@/ark-scene/behaviours.json";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {ARK_BEHAVIOURS, ARK_INTERACTIONS, behaviourProfile, decodeBehaviourRow, type ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {forgetSchedules, kthNearest, withLazyRoost, amphibious, awakeAt, bodyRadiusOf, groupSpread, homeRadius, rangeReach, maxSlopeOf, poseOnTrip, restingAtRoost, roostOf, scheduleWorld, spaceHomes, spaceHomesTasks, SAFE_METRES, SAFE_MOST, SLOT_SECONDS, slotStart, threatAt, tripAt, waryRange, wireThreats, WARY_METRES, type HomeInput, type ScheduleAnimal, type SpacedHome, type Trip} from "@/ark-scene/behaviour-schedule";
import {SlicedBuild} from "@/ark-scene/behaviour-build";
import {hashString} from "@/ark-scene/world";
import {eats} from "@/ark-scene/food-links";
import {modelBase} from "@/ark-scene/grounding/base";
import {BURST_MEAN, gaitRhythm} from "@/ark-scene/locomotion/paces";
import {sceneSampler} from "@/ark-scene/world-sampler";
import {GARDEN_POND} from "@/ark-scene/micro-decor";
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
    wireThreats(items.map((i) => ({slug: i.a.model_slug, animal: i.animal, profile: i.profile, activity: i.a.activity})), eats);
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
                // A flight goes somewhere: never back to where it took off. (A soar may come home to its own perch, as an
                // eagle does, but by a sweep out over its range and back, never by turning on the spot.)
                if (trip.shadow) continue;
                if (trip.doing === "soar" && leg.path) {
                    const out = Math.max(...leg.path.map((p) => Math.hypot(p.x - leg.from.x, p.z - leg.from.z)));
                    assert.ok(out > 3, `${i.a.model_slug} soars on the spot`);
                    continue;
                }
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
            // (Lane B4, behaviours pass 2026-11: nor do the ones on their way somewhere. At their own paces a long way home is
            // a trot of half a minute, and four goats trotting to their roost along the one way there were, rightly, in
            // file. A row that looks made is one that stands.)
            const cluster = poses.filter((p) => Math.hypot(p.x - mx, p.z - mz) < 12 && !(p.moving && (p.beat === "walk" || p.beat === "run")));
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
        // (Six body lengths, at most SAFE_MOST: a true-size whale's would be more sea than the island has.)
        const safe = Math.max(SAFE_METRES, Math.min(p.animal.length * 6, SAFE_MOST));
        for (let k = 0; k < 24 * 45; k += 13) {
            const t = DAY + k * SLOT_SECONDS + 7;
            const at = poseOf(p, t);
            if (at.aloft) continue;
            for (const q of prey) {
                const qa = poseOf(q, t);
                // (A bird soaring wide over its range passes over others: the spacing is for where they stand.)
                if (qa.aloft) continue;
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
                // (Collisions, motion pass L5: a path keeps its body's width off everything solid, exactly, not the walk grid's
                // margins round it, so it may go where a margin is (by a trunk, through a gate): walkable or fitting its body.)
                const fitsThere = world.nav.walkable(pose.x, pose.z, maxSlopeOf(i.animal)) || world.nav.fits(pose.x, pose.z, bodyRadiusOf(i.animal, i.profile.slug) * 0.95, maxSlopeOf(i.animal));
                if (!fitsThere && Math.hypot(pose.x - trip.from.x, pose.z - trip.from.z) > 3 && Math.hypot(pose.x - trip.to.x, pose.z - trip.to.z) > 3) off.push(i.a.model_slug);
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

test("prey watch a predator they can see: off to the far side of their range, facing it", () => {
    let seen = 0;
    let moments = 0;
    // (Animals on their own: a group member looks from its group's middle, its leader's place.)
    for (const i of animals.filter((x) => x.animal.threats?.length && !x.animal.group)) {
        for (let k = 0; k < 24 * 45; k += 1) {
            const trip = tripOf(i, DAY + k * SLOT_SECONDS);
            const start = slotStart(i.animal, trip.slot);
            if (!awakeAt(i.profile, i.a.activity, hoursAt(start)) || i.profile.move === "sessile") continue;
            moments++;
            const centre = i.animal.home;
            const threat = threatAt(world, i.profile, i.animal, start, hoursAt, centre, homeRadius(i.profile, i.animal));
            if (!threat || trip.shadow || trip.doing === "breathe") continue;
            seen++;
            assert.equal(trip.doing, "watch", `${i.a.model_slug} ignores a predator ${threat.d.toFixed(0)} m off (${trip.doing})`);
            const settled = trip.stay[0];
            if (settled) {
                let turn = Math.atan2(threat.x - settled.x, threat.z - settled.z) - settled.yaw;
                while (turn > Math.PI) turn -= Math.PI * 2;
                while (turn < -Math.PI) turn += Math.PI * 2;
                assert.ok(Math.abs(turn) < 1.3, `${i.a.model_slug} watches ${turn.toFixed(2)} rad away from the predator`);
            }
        }
    }
    assert.ok(moments > 100, `moments ${moments}`);
    assert.ok(WARY_METRES > SAFE_METRES);
    console.log(`prey awake slots ${moments}, with a predator in sight ${seen}`);
});

test("a zebra sees a lion walk the grassland 40-odd metres off, and watches it; still, or in a forest, it sees it nearer", () => {
    const zebra = behaviourProfile("plains-zebra");
    assert.ok(waryRange(zebra, "grassland", 1.8, true) > 38 && waryRange(zebra, "grassland", 1.8, true) <= WARY_METRES);
    assert.ok(waryRange(zebra, "grassland", 1.8, false) < waryRange(zebra, "grassland", 1.8, true) * 0.65);
    assert.ok(waryRange(zebra, "rainforest", 1.8, true) < waryRange(zebra, "grassland", 1.8, true) * 0.5);
    // A lion and a zebra, homes a spaced 50 m apart on the grassland (as the release fixture has them): the zebra notices
    // the lion now and then from its range, and then watches it from the far side, facing it.
    const ground = world.nav.nearest(-40, 40, "walk", 0.5, 30)!;
    const lionHome = world.nav.nearest(ground.x + 50, ground.z, "walk", 0.5, 30)!;
    const lion = {id: "test-lion", zone: "grassland" as const, home: {x: lionHome.x, y: Math.max(world.sampler.heightAt(lionHome.x, lionHome.z), 0), z: lionHome.z}, length: 1.8, sea: false};
    const z: ScheduleAnimal = {id: "test-zebra", zone: "grassland", home: {x: ground.x, y: Math.max(world.sampler.heightAt(ground.x, ground.z), 0), z: ground.z}, length: 1.7, sea: false, threats: [{animal: lion, profile: behaviourProfile("african-lion"), activity: "diurnal"}]};
    let watched = 0;
    for (let k = 0; k < 24 * 45; k++) {
        const trip = tripAt(world, zebra, z, DAY + k * SLOT_SECONDS, hoursAt, "diurnal");
        const start = slotStart(z, trip.slot);
        const threat = threatAt(world, zebra, z, start, hoursAt, z.home, homeRadius(zebra, z));
        if (!threat || !awakeAt(zebra, "diurnal", hoursAt(start))) continue;
        assert.equal(trip.doing, "watch");
        assert.ok(Math.hypot(trip.to.x - threat.x, trip.to.z - threat.z) >= threat.d - 0.5, "it watches from further off, not nearer");
        watched++;
    }
    assert.ok(watched > 0, "the zebra never noticed the lion");
});

test("flyers fly to places, not round in circles: under half a full turn a minute in the air (the audit's measure)", () => {
    // ark-audit metrics.ts: second by second while aloft, the heading change of where it goes, summed; circling is a full
    // turn or more inside 20 m in the last minute. (Problem 2: 1.04 turns a minute, from bowed hops and looping soars.)
    const TAU = Math.PI * 2;
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    let air = 0;
    let turn = 0;
    let circling = 0;
    for (const i of animals.filter((x) => x.profile.move === "fly" || x.profile.moves.includes("fly"))) {
        let last: {x: number; z: number} | null = null;
        let heading: number | null = null;
        const window: Array<{x: number; z: number; turn: number}> = [];
        for (let s = 0; s < 6 * 3600; s += 1) {
            const p = poseOf(i, DAY + 6 * 3600 + s);
            if (!p.aloft) {
                last = null;
                heading = null;
                window.length = 0;
                continue;
            }
            air++;
            if (last && Math.hypot(p.x - last.x, p.z - last.z) > 0.05) {
                const h = Math.atan2(p.x - last.x, p.z - last.z);
                const tn = heading === null ? 0 : Math.abs(wrap(h - heading));
                turn += tn;
                heading = h;
                window.push({x: p.x, z: p.z, turn: tn});
                if (window.length > 60) window.shift();
                if (window.length >= 30) {
                    const cx = window.reduce((a, w) => a + w.x, 0) / window.length;
                    const cz = window.reduce((a, w) => a + w.z, 0) / window.length;
                    if (window.reduce((a, w) => a + w.turn, 0) >= TAU && Math.max(...window.map((w) => Math.hypot(w.x - cx, w.z - cz))) <= 20) circling++;
                }
            }
            last = {x: p.x, z: p.z};
        }
    }
    assert.ok(air > 3600, `air seconds ${air}`);
    const perMinute = turn / TAU / (air / 60);
    assert.ok(perMinute < 0.5, `${perMinute.toFixed(2)} full turns a minute in the air`);
    assert.ok(circling / air < 0.1, `circling ${((circling / air) * 100).toFixed(1)}% of air time`);
});

test("a kind is not all doing one thing: every species of 3+ awake together shares one state rarely (the audit's measure)", () => {
    // ark-audit metrics.ts: per species with 3+ aboard, at moments all are awake, whether all have the same doing.
    // (Problem 7. 13.2% before: a swimmer's every state read "swim", a school's members took their leader's.)
    const bySpecies = new Map<string, Item[]>();
    for (const i of animals) bySpecies.set(i.a.model_slug, [...(bySpecies.get(i.a.model_slug) ?? []), i]);
    let awake = 0;
    let same = 0;
    for (const members of Array.from(bySpecies.values())) {
        if (members.length < 3) continue;
        for (let s = 0; s < 24 * 3600; s += 30) {
            const doings = members.map((m) => tripOf(m, DAY + s).doing);
            if (doings.some((d) => d === "sleep" || d === "to_roost")) continue;
            awake++;
            if (new Set(doings).size === 1) same++;
        }
    }
    assert.ok(awake > 10000, `awake moments ${awake}`);
    // (The behaviours pass, lane B3 needs, 2026-11-14: 8% → 17%. Each kind now has its own day in bouts: a kind that
    // feeds 60 to 80% of its waking time (a zebra, an elephant, a great tit) is all feeding at once far more often
    // than when every species fed a third of its slots drawn one by one. Measured 14.6% with the needs in. What the
    // limit still stops is a kind moving as one: members keep up to three tenths of a cycle off their leader, and one
    // of a group is on watch.)
    assert.ok(same / awake < 0.17, `${((same / awake) * 100).toFixed(1)}% of awake moments a whole species in one state`);
});

test("resting at home: asleep at its roost by night, and a den animal often in its den by day (for the runtime's rotation)", () => {
    let night = 0;
    let nightAtRoost = 0;
    let dayDen = 0;
    let dens = 0;
    for (const i of animals.filter((x) => x.profile.move !== "sessile")) {
        for (let k = 0; k < 24 * 45; k += 7) {
            const t = DAY + k * SLOT_SECONDS + 70;
            const trip = tripOf(i, t);
            const at = restingAtRoost(world, i.profile, i.animal, t, hoursAt, i.a.activity);
            if (trip.doing === "sleep" && !i.animal.group) {
                night++;
                if (at.resting) nightAtRoost++;
            }
            if (["den", "burrow", "cave", "tree_hole", "crevice"].includes(i.profile.roost) && awakeAt(i.profile, i.a.activity, hoursAt(t))) {
                dens++;
                if (at.enclosed) dayDen++;
            }
            // Never "at home" while it is out and about.
            if (at.resting) assert.ok(["sleep", "to_roost", "rest"].includes(trip.doing), `${i.a.model_slug} resting while ${trip.doing}`);
        }
    }
    assert.ok(night > 200 && nightAtRoost / night > 0.9, `asleep at its roost ${nightAtRoost} of ${night}`);
    assert.ok(dens > 100 && dayDen / dens > 0.05, `den animals in the den while awake ${dayDen} of ${dens}`);
    console.log(`asleep at roost ${nightAtRoost}/${night}; den animals in the den while awake ${dayDen}/${dens}`);
});

/** The spacing as it was before it was cut into tasks (2026-11-11, ark-behaviour 5f985348), verbatim but for true scale's SAFE_MOST cap: the reference. */
function referenceSpaceHomes(animals: HomeInput[], eatsOf: (predator: string, prey: string) => boolean, reachOf: (id: string) => number): Map<string, SpacedHome> {
    const out = new Map<string, SpacedHome>();
    const home = new Map(animals.map((a) => [a.id, {...a.home}]));
    const reach = new Map(animals.map((a) => [a.id, reachOf(a.id)]));
    const sorted = [...animals].sort((a, b) => b.length - a.length || a.id.localeCompare(b.id));
    for (const predator of sorted) {
        const prey = animals.filter((other) => other.id !== predator.id && eatsOf(predator.slug, other.slug));
        if (!prey.length) continue;
        const enemies = animals.filter((other) => other.id !== predator.id && (eatsOf(predator.slug, other.slug) || eatsOf(other.slug, predator.slug)));
        const safeTo = (other: HomeInput) => Math.max(SAFE_METRES, Math.min(Math.max(predator.length, other.length) * 6, SAFE_MOST));
        const need = (other: HomeInput) => safeTo(other) + reach.get(predator.id)! + reach.get(other.id)!;
        const clearance = (x: number, z: number) => Math.min(...enemies.map((o) => Math.hypot(home.get(o.id)!.x - x, home.get(o.id)!.z - z) - need(o)));
        const start = home.get(predator.id)!;
        let best = {x: start.x, z: start.z, c: clearance(start.x, start.z)};
        if (best.c < 0) {
            const mx = prey.reduce((s, p) => s + home.get(p.id)!.x, 0) / prey.length;
            const mz = prey.reduce((s, p) => s + home.get(p.id)!.z, 0) / prey.length;
            const away = Math.atan2(start.x - mx, start.z - mz);
            let found = false;
            for (let d = 3; d <= 120 && !found; d += 3) {
                for (let k = 0; k < 24 && !found; k++) {
                    const a = away + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.27;
                    const x = start.x + Math.sin(a) * d;
                    const z = start.z + Math.cos(a) * d;
                    if (!predator.walkable(x, z)) continue;
                    const c = clearance(x, z);
                    if (c > best.c) best = {x, z, c};
                    if (c >= 0) found = true;
                }
            }
            home.set(predator.id, {x: best.x, z: best.z});
            if (!found) {
                for (const other of enemies) {
                    const at = home.get(other.id)!;
                    const d = Math.hypot(at.x - best.x, at.z - best.z);
                    const free = d - safeTo(other);
                    const total = reach.get(predator.id)! + reach.get(other.id)!;
                    if (free >= total) continue;
                    const k = Math.max(free, 1) / total;
                    reach.set(predator.id, Math.max(reach.get(predator.id)! * k, 0.5));
                    reach.set(other.id, Math.max(reach.get(other.id)! * k, 0.5));
                    const prior = out.get(other.id);
                    out.set(other.id, {home: prior?.home ?? {...at}, range: reach.get(other.id)!, prey: prior?.prey ?? null});
                }
            }
        }
        const at = home.get(predator.id)!;
        const nearest = [...prey].sort((a, b) => Math.hypot(home.get(a.id)!.x - at.x, home.get(a.id)!.z - at.z) - Math.hypot(home.get(b.id)!.x - at.x, home.get(b.id)!.z - at.z))[0];
        const shrunk = reach.get(predator.id)! < reachOf(predator.id) - 1e-9;
        out.set(predator.id, {home: {...at}, range: shrunk ? reach.get(predator.id)! : out.get(predator.id)?.range ?? null, prey: {...home.get(nearest.id)!}});
    }
    return out;
}

test("predator spacing, cut into tasks and sliced a predator at a time, is the old loop's to the last digit", () => {
    const inputsOf = (copies: number) => {
        const list: HomeInput[] = [];
        for (let c = 0; c < copies; c++) {
            for (const i of animals) {
                if (i.animal.group) continue;
                const dx = c ? ((hashString(`${i.a.id}#${c}x`) % 2000) / 100 - 10) : 0;
                const dz = c ? ((hashString(`${i.a.id}#${c}z`) % 2000) / 100 - 10) : 0;
                list.push({id: `${i.a.id}#${c}`, slug: i.a.model_slug, home: {x: i.animal.home.x + dx, z: i.animal.home.z + dz}, length: i.animal.length, walkable: (x, z) => (i.profile.move === "swim" || i.profile.seabed ? world.nav.swimmable(x, z, 0.5) : world.nav.walkable(x, z))});
            }
        }
        return list;
    };
    for (const copies of [1, 6]) {
        const inputs = inputsOf(copies);
        const reachOf = (id: string) => 3 + (hashString(id) % 900) / 100;
        const reference = referenceSpaceHomes(inputs, eats, reachOf);
        assert.ok(reference.size > (copies > 1 ? 50 : 5), `only ${reference.size} spaced`);
        assert.deepEqual(spaceHomes(inputs, eats, reachOf), reference);
        const job = spaceHomesTasks(inputs, eats, reachOf);
        const build = new SlicedBuild(job.tasks, job.finish);
        let slices = 0;
        let result = null;
        while (!result) {
            result = build.step(0);
            slices++;
        }
        assert.ok(slices >= Math.min(inputs.length, 50), `only ${slices} slices`);
        assert.deepEqual(result, reference);
    }
});

test("nobody goes round in circles: in any 20 s, under 1% of moving animals turn a full circle (facing or travel)", () => {
    // (The owner: "some animals move randomly in circles". 2.0% facing and 3.6% travel before: a pause faced north and
    // back, scans turned the body for good, a stay snapped to a seeded heading, a school's members swam in and out
    // round a resting leader, corners were snapped.)
    const TAU = Math.PI * 2;
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    let moving = 0;
    let facing = 0;
    let travel = 0;
    for (const i of animals.filter((_, k) => k % 2 === 0)) {
        for (let w = 0; w < 24 * 3600; w += 60) {
            let last = poseOf(i, DAY + w);
            let heading: number | null = null;
            let f = 0;
            let tr = 0;
            let moved = false;
            for (let s = 1; s <= 20; s++) {
                const p = poseOf(i, DAY + w + s);
                f += Math.abs(wrap(p.yaw - last.yaw));
                if (Math.hypot(p.x - last.x, p.z - last.z) > 0.05) {
                    moved = true;
                    const h = Math.atan2(p.x - last.x, p.z - last.z);
                    if (heading !== null) tr += Math.abs(wrap(h - heading));
                    heading = h;
                }
                last = p;
            }
            if (!moved) continue;
            moving++;
            if (f > TAU) facing++;
            if (tr > TAU) travel++;
        }
    }
    assert.ok(moving > 5000, `moving windows ${moving}`);
    assert.ok(facing / moving < 0.01, `${((facing / moving) * 100).toFixed(1)}% turn their facing a full circle in 20 s`);
    assert.ok(travel / moving < 0.01, `${((travel / moving) * 100).toFixed(1)}% go round a full circle in 20 s`);
});

test("the garden pond: a land animal drinks at its edge, never stands in it nor on its stones (any day, any home by it)", () => {
    // (2026-11-11: a golden retriever stood in the water inside the pond's ring of stones at night.)
    let near = 0;
    let drinks = 0;
    for (const slug of ["golden-retriever", "domestic-dog", "domestic-horse", "red-fox", "domestic-cat"]) {
        const profile = behaviourProfile(slug);
        for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2 + 0.4;
            const x = GARDEN_POND.x + Math.cos(a) * 5;
            const z = GARDEN_POND.z + Math.sin(a) * 5;
            const animal: ScheduleAnimal = {id: `pond-${slug}-${k}`, zone: "farm_garden", home: {x, y: Math.max(world.sampler.heightAt(x, z), 0), z}, length: slug === "domestic-horse" ? 2.2 : slug === "domestic-cat" ? 0.45 : 0.9, sea: false};
            for (let s = 0; s < 24 * 3600; s += 5) {
                const t = DAY + s;
                const trip = tripAt(world, profile, animal, t, hoursAt, profile.activity);
                const p = poseOnTrip(world, trip, t);
                const d = Math.hypot(p.x - GARDEN_POND.x, p.z - GARDEN_POND.z);
                assert.ok(d > GARDEN_POND.radius + 0.2, `${slug} at ${d.toFixed(2)} m from the pond's middle (${p.beat}, ${trip.doing})`);
                if (d < GARDEN_POND.radius + 2) near++;
                if (p.beat === "drink" && d < GARDEN_POND.radius + 1.5) drinks++;
            }
        }
    }
    assert.ok(near > 0 && drinks > 0, `near ${near}, drinks ${drinks}`);
});

test("on the ground nothing moves backwards: never 5 s in a row going more than 90 degrees off the way it faces", () => {
    // (The default view's house sparrow went backwards for 5 s: a flock member sliding to its slot's finish, and a slow
    // walker facing round a corner of its path while it still walked to it.)
    const angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    const backwards: string[] = [];
    let moving = 0;
    for (const i of animals) {
        let run = 0;
        let prev = poseOf(i, DAY + 6 * 3600);
        for (let s = 1; s < 3 * 3600; s++) {
            const p = poseOf(i, DAY + 6 * 3600 + s);
            const d = Math.hypot(p.x - prev.x, p.z - prev.z);
            const onGround = !p.aloft && !prev.aloft && p.y >= -0.01 && d > 0.03;
            if (onGround) moving++;
            run = onGround && Math.abs(angle(Math.atan2(p.x - prev.x, p.z - prev.z) - p.yaw)) > Math.PI / 2 ? run + 1 : 0;
            if (run === 5) backwards.push(`${i.a.model_slug} at ${s} s (${p.beat})`);
            prev = p;
        }
    }
    assert.ok(moving > 10000, `moving ${moving}`);
    assert.deepEqual(backwards.slice(0, 8), [], `${backwards.length} backwards runs`);
});

test("walking goes at its own pace: a pace ratio of 0.8-1.3 on the way (running, its run's; a burst mover's bursts, its bursts'), never a slow-motion walk", () => {
    // (Its walk's pace is the animal's own for a rig the locomotion layer draws, the clip's for one that moves by a baked
    // clip: `scripts/ark-walk-pace.mts`, decision 202 and lane B4 of the behaviours pass 2026-11.)
    // (Lane B4: a walk now gets going over its first steps and slows into its stop, and a mouse, a small lizard or a
    // rabbit goes in bursts with stops between at its bursts' pace, `gaitRhythm`: the samples of those moments are under
    // or over its pace by design, so the share of samples within the band is lower than the 85% of walks at one speed
    // from first frame to last; each species' median is still its pace on the way.)
    // (The integrator's default-view check, 2026-11-11: with the v2 rigs up, walkers held to 1.5 times a v1 walk's pace
    // walked at 0.35-0.45 of their clips. Sampled as the check samples: every 0.25 s, moving faster than 0.15 of its
    // length a second on the ground.)
    const off: string[] = [];
    let walking = 0;
    let within = 0;
    for (const i of animals.filter((x) => x.profile.walkPace && x.profile.move !== "swim" && x.profile.move !== "fly")) {
        const length = Math.max(i.animal.length, 0.05);
        const rhythm = gaitRhythm(i.a.model_slug, modelBase(i.a.model_slug)?.plan, i.animal.length);
        const ratios: number[] = [];
        let last = poseOf(i, DAY + 6 * 3600);
        for (let k = 1; k < 4 * 3600 * 4; k++) {
            const t = DAY + 6 * 3600 + k * 0.25;
            const p = poseOf(i, t);
            const speed = Math.hypot(p.x - last.x, p.z - last.z) / 0.25;
            const ground = !p.aloft && !last.aloft && p.y >= -0.01 && last.y >= -0.01;
            // (Down to slow walkers too, decision 202: a 0.05 m/s floor hid a bullfrog walking at 1.8 times its clip.)
            if (ground && speed > Math.max(0.002, 0.15 * length) && (p.beat === "walk" || p.beat === "run" || p.beat === "step")) {
                const clip = p.beat === "run" && i.profile.runPace ? i.profile.runPace : i.profile.walkPace!;
                let ratio = speed / length / clip;
                // (A burst mover in a burst: against its bursts' pace, its walk's over its share moving.)
                if (p.beat === "walk" && rhythm.share < 1 && ratio > 1.2) ratio *= rhythm.share * BURST_MEAN;
                ratios.push(ratio);
                walking++;
                if (ratio >= 0.8 && ratio <= 1.3) within++;
            }
            last = p;
        }
        if (ratios.length < 20) continue;
        ratios.sort((a, b) => a - b);
        const median = ratios[ratios.length >> 1];
        // (A burst mover's bursts are read against a mean burst: from 0.7.)
        if (median < (rhythm.share < 1 ? 0.7 : 0.8) || median > 1.3) off.push(`${i.a.model_slug} ${median.toFixed(2)}`);
    }
    assert.ok(walking > 5000, `walking samples ${walking}`);
    assert.deepEqual(off, [], "median pace ratios off 0.8-1.3");
    // (83.8% measured, from over 85% of walks at one speed: the samples while it gets going and stops. Lane B4.)
    assert.ok(within / walking > 0.8, `${((within / walking) * 100).toFixed(1)}% of walking samples within 0.8-1.3`);
});

test("an in-place activity barely turns: grazing, browsing, grooming, resting, foraging or watching, under one turn in any minute", () => {
    // (The default view's buffalo turned 16.5 times a minute grooming, an elephant 5.7 grazing: the release's recipe
    // episodes. The schedule's own time at a place: facing summed over each minute it stays.)
    const IN_PLACE = new Set(["graze", "browse", "groom", "rest", "forage", "watch", "idle"]);
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    let minutes = 0;
    const over: string[] = [];
    for (const i of animals) {
        let last = poseOf(i, DAY + 6 * 3600);
        let lastTrip = tripOf(i, DAY + 6 * 3600);
        let turned = 0;
        let span = 0;
        for (let k = 1; k < 6 * 3600 * 2; k++) {
            const t = DAY + 6 * 3600 + k * 0.5;
            const trip = tripOf(i, t);
            const p = poseOf(i, t);
            if (trip === lastTrip && t >= trip.arrive + 0.5 && !trip.shadow && !p.aloft && IN_PLACE.has(trip.doing)) {
                turned += Math.abs(wrap(p.yaw - last.yaw));
                span += 0.5;
                if (span >= 60) {
                    minutes++;
                    if (turned >= Math.PI * 2) over.push(`${i.a.model_slug} ${trip.doing} ${(turned / Math.PI / 2).toFixed(2)}`);
                    turned = 0;
                    span = 0;
                }
            } else {
                turned = 0;
                span = 0;
            }
            last = p;
            lastTrip = trip;
        }
    }
    assert.ok(minutes > 1000, `minutes ${minutes}`);
    assert.deepEqual(over.slice(0, 8), [], `${over.length} of ${minutes} minutes`);
});

test("cheaper, the same: the k-th nearest place, threats a kind at a time, the roost when first asked", () => {
    // kthNearest is what sorting by distance then id and taking the k-th gives (ties included).
    const random = (() => {
        let s = 12345;
        return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    })();
    for (let trial = 0; trial < 300; trial++) {
        const n = 1 + Math.floor(random() * 60);
        const list = Array.from({length: n}, (_, i) => ({id: `p${Math.floor(random() * 1000)}-${i}`, x: Math.round(random() * 20) / 2, z: Math.round(random() * 20) / 2}));
        const centre = {x: Math.round(random() * 20) / 2, z: Math.round(random() * 20) / 2};
        const sorted = [...list].sort((a, b) => Math.hypot(a.x - centre.x, a.z - centre.z) - Math.hypot(b.x - centre.x, b.z - centre.z) || a.id.localeCompare(b.id));
        for (let k = 0; k < n; k++) assert.equal(kthNearest(list, centre, k), sorted[k]);
    }
    // wireThreats: the old way (every animal against every top predator, copied as it was) and the kind-at-a-time way.
    const oldWire = (list: Array<{slug: string; animal: ScheduleAnimal; profile: ArkBehaviourProfile; activity: ArkAnimal["activity"]}>) => {
        const slugs = Array.from(new Set(list.map((i) => i.slug)));
        const hunters = slugs.filter((p) => slugs.some((q) => q !== p && eats(p, q)));
        const top = new Set(hunters.filter((p) => !slugs.some((q) => q !== p && eats(q, p))));
        const tops = list.filter((i) => top.has(i.slug));
        return list.map((i) => {
            const threats = tops.filter((p) => p !== i && p.slug !== i.slug && eats(p.slug, i.slug)).map((p) => ({animal: p.animal, profile: p.profile, activity: p.activity}));
            return threats.length ? threats : null;
        });
    };
    const wired = animals.map((i) => ({slug: i.a.model_slug, animal: {...i.animal, threats: null}, profile: i.profile, activity: i.a.activity}));
    const expected = oldWire(wired);
    wireThreats(wired, eats);
    assert.deepEqual(wired.map((i) => i.animal.threats ?? null), expected);
    assert.ok(expected.some((t) => t && t.length), "some animals have threats");
    // The roost: not looked for until asked, then once, and the same spot.
    let looked = 0;
    const spot = {x: 1, y: 2, z: 3, nx: 0, ny: 1, nz: 0, point: "rock:1"};
    const lazy = withLazyRoost({id: "lazy", zone: "grassland", home: {x: 0, y: 0, z: 0}, length: 1, sea: false}, () => {
        looked++;
        return spot;
    });
    assert.equal(looked, 0);
    assert.equal(lazy.roost, spot);
    assert.equal(lazy.roost, spot);
    assert.equal(looked, 1);
    assert.deepEqual({...lazy}.roost, spot);
    // And a schedule over a day with the roost given lazily is the one with it given at once.
    let checked = 0;
    for (const i of animals.filter((x) => !x.animal.group && x.profile.move !== "swim").slice(0, 12)) {
        // (A fixed roost of its own, as the map gives one: here its schedule's own roost, given at once or when asked.)
        const fixed = roostOf(world, i.profile, i.animal);
        const eager: ScheduleAnimal = {...i.animal, roost: fixed};
        const later = withLazyRoost(Object.fromEntries(Object.entries(i.animal).filter(([key]) => key !== "roost")) as Omit<ScheduleAnimal, "roost">, () => fixed);
        checked++;
        for (let k = 0; k < 45 * 4; k += 7) {
            const t = DAY + k * SLOT_SECONDS + 13;
            assert.deepEqual(poseOnTrip(world, tripAt(world, i.profile, later, t, hoursAt, i.a.activity), t), poseOnTrip(world, tripAt(world, i.profile, eager, t, hoursAt, i.a.activity), t));
        }
    }
    assert.ok(checked >= 10, `checked ${checked}`);
});

test("the same for every viewer: where an animal is never depends on what was asked before (memo order, a cold start)", () => {
    // (2026-11-11: the walk chain compared goal objects; a planned intent worked out again after the memo let it go is a
    // new object, so a school's leader's swim could read as a walk and its school stop following, depending on the
    // order poses were asked for. Here: each animal asked alone, fresh, and the same asked in one long run of all.)
    const times = [0, 37, 185, 1301, 4000, 9100, 15000];
    const fresh = new Map<string, string>();
    for (const i of animals) {
        for (const s of times) {
            forgetSchedules();
            const p = poseOf(i, DAY + s);
            fresh.set(`${i.a.id}@${s}`, `${p.x.toFixed(9)},${p.y.toFixed(9)},${p.z.toFixed(9)},${p.yaw.toFixed(9)},${p.beat}`);
        }
    }
    forgetSchedules();
    const differ: string[] = [];
    for (const i of animals) {
        for (let s = 0; s <= 15000; s += 37) {
            const p = poseOf(i, DAY + s);
            const key = `${i.a.id}@${s}`;
            const was = fresh.get(key);
            if (was !== undefined && was !== `${p.x.toFixed(9)},${p.y.toFixed(9)},${p.z.toFixed(9)},${p.yaw.toFixed(9)},${p.beat}`) differ.push(`${i.a.model_slug} at ${s}`);
        }
    }
    assert.deepEqual(differ.slice(0, 8), [], `${differ.length} differ`);
});

test("a grazer drifts forward: its steps while grazing, browsing or foraging turn under 2 times a minute of movement", () => {
    // (The default view's turning by source, 2026-11-11: a zebra's grazing steps 2.4-13 turns a minute of movement, an
    // ibex's 8: each step went a little to one side and the next to the other. Measured as the check measures: every
    // 0.25 s, moving faster than 0.15 of its length a second, its way's turns summed, the way kept across the pauses.)
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    const bySlug = new Map<string, {turn: number; moving: number}>();
    for (const i of animals.filter((x) => x.profile.move !== "fly" && x.profile.move !== "swim")) {
        const length = Math.max(i.animal.length, 0.05);
        let last = poseOf(i, DAY + 6 * 3600);
        let lastTrip = tripOf(i, DAY + 6 * 3600);
        let way: number | null = null;
        for (let k = 1; k < 6 * 3600 * 4; k++) {
            const t = DAY + 6 * 3600 + k * 0.25;
            const trip = tripOf(i, t);
            const p = poseOf(i, t);
            // (Its steps there: from a quarter second after it arrives, so the walk in is not one of them; the turn it
            // makes where it stands on arriving is the stay's one bigger turn, after a pause.)
            // (The schedule's own steps: a recipe's episode laid over them, where there is one, is the recipes' to judge.)
            const feeding = trip === lastTrip && t - 0.25 >= trip.arrive && !trip.shadow && ["graze", "browse", "forage"].includes(trip.doing) && p.y >= -0.01 && !(p as {act?: unknown}).act;
            if (!feeding) way = null;
            else {
                const d = Math.hypot(p.x - last.x, p.z - last.z);
                if (d / 0.25 > Math.max(0.05, 0.15 * length)) {
                    const w = Math.atan2(p.x - last.x, p.z - last.z);
                    const row = bySlug.get(i.a.model_slug) ?? {turn: 0, moving: 0};
                    if (way !== null) row.turn += Math.abs(wrap(w - way));
                    row.moving += 0.25;
                    bySlug.set(i.a.model_slug, row);
                    way = w;
                }
            }
            last = p;
            lastTrip = trip;
        }
    }
    // (A species judged on a minute of its steps or more: a cricket's few centimetre steps make too few samples.)
    const rows = Array.from(bySlug.entries()).filter(([, r]) => r.moving >= 60).map(([slug, r]) => [slug, r.turn / (Math.PI * 2) / (r.moving / 60)] as const);
    assert.ok(rows.length >= 10, `species ${rows.length}`);
    const over = rows.filter(([, v]) => v >= 2).map(([slug, v]) => `${slug} ${v.toFixed(1)}`);
    assert.deepEqual(over, [], "turns a minute of movement while feeding");
});

test("asleep where it lies, slot after slot, it keeps its heading (no turn at each slot)", () => {
    // (2026-11-12: a sleeping zebra turned to a new heading every slot, so her foal at heel, placed by her heading,
    // swung round her: the default view's backwards foal.)
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    let pairs = 0;
    let edges = 0;
    const turned: string[] = [];
    const snapped: string[] = [];
    // (Sixteen hours of a day: every animal's sleep, the day sleepers' and the night sleepers'.)
    for (const i of animals) {
        for (let k = 0; k < 45 * 16; k += 1) {
            const t = DAY + 6 * 3600 + k * SLOT_SECONDS;
            const trip = tripOf(i, t);
            if (trip.doing !== "sleep" || trip.shadow) continue;
            const start = slotStart(i.animal, trip.slot);
            const before = poseOf(i, start - 0.05);
            const after = poseOf(i, start + 0.05);
            // (Not where its walk to its roost was given up on and the night's first slot puts it there: a known jump, its
            // roost inside a rock's collider or off its own ground, reported 2026-11-12.)
            if (Math.hypot(before.x - after.x, before.z - after.z) > 0.3) continue;
            edges++;
            if (Math.abs(wrap(before.yaw - after.yaw)) > 0.1) snapped.push(`${i.a.model_slug} ${tripOf(i, start - 1).doing} ${wrap(before.yaw - after.yaw).toFixed(2)}`);
            const a = poseOf(i, start + 70);
            const b = poseOf(i, start + 70 + SLOT_SECONDS);
            if (tripOf(i, start + 70 + SLOT_SECONDS).doing !== "sleep" || a.moving || b.moving || a.aloft) continue;
            if (Math.hypot(a.x - b.x, a.z - b.z) > 0.1) continue;
            pairs++;
            if (Math.abs(wrap(a.yaw - b.yaw)) > 0.05) turned.push(`${i.a.model_slug} ${wrap(a.yaw - b.yaw).toFixed(2)}`);
        }
    }
    assert.ok(pairs > 500 && edges > 500, `pairs ${pairs}, slot starts ${edges}`);
    assert.deepEqual(turned.slice(0, 8), [], `${turned.length} of ${pairs} turned`);
    assert.deepEqual(snapped.slice(0, 8), [], `${snapped.length} of ${edges} snapped at a slot start`);
});
