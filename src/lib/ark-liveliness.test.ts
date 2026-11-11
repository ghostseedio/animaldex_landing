import assert from "node:assert/strict";
import test from "node:test";
import {weatherAt} from "@/lib/ark-clock";
import {
    aboveTide,
    backToWindYaw,
    callLift,
    coverSpot,
    heelPose,
    pickParent,
    shelterAt,
    shelterDelayMs,
    shelterKind,
    tideFit,
    WeatherFlips,
    wornPatches,
    youngTurnRate,
    yawToward
} from "@/lib/ark-liveliness";

const MIN = 60_000;

/** Rain from 10:00 to 25:00 (minutes) after the epoch, as a yes/no. */
const rainy = (ms: number) => ms >= 10 * MIN && ms < 25 * MIN;

test("weather flips: the answer, when it changed and when before, from the grid", () => {
    const flips = new WeatherFlips(rainy, 30_000, 3_600_000, 250);
    const dry = flips.stateAt(5 * MIN);
    assert.equal(dry.on, false);
    assert.equal(dry.since, -Infinity);
    const wet = flips.stateAt(12 * MIN);
    assert.equal(wet.on, true);
    assert.ok(Math.abs(wet.since - 10 * MIN) <= 250, `since ${wet.since}`);
    const after = flips.stateAt(30 * MIN);
    assert.equal(after.on, false);
    assert.ok(Math.abs(after.since - 25 * MIN) <= 250);
    assert.ok(Math.abs(after.before - 10 * MIN) <= 250);
    // Just after the change, inside one grid step.
    const just = flips.stateAt(10 * MIN + 5_000);
    assert.equal(just.on, true);
    assert.ok(Math.abs(just.since - 10 * MIN) <= 250);
});

test("weather flips: the same moments whatever was asked before (two viewers agree)", () => {
    const a = new WeatherFlips(rainy);
    const b = new WeatherFlips(rainy);
    b.stateAt(40 * MIN);
    b.stateAt(11 * MIN);
    for (const t of [9 * MIN, 10 * MIN + 1, 13 * MIN, 26 * MIN, 50 * MIN]) assert.deepEqual(a.stateAt(t), b.stateAt(t));
});

test("weather flips on the island clock's own weather: stable and fast once warm", () => {
    const start = Date.UTC(2026, 10, 1);
    const flips = new WeatherFlips((ms) => weatherAt(ms, {voyageStartMs: start}).hints.seekCover);
    const t0 = start + 6 * 3_600_000;
    const first = flips.stateAt(t0);
    const began = performance.now();
    for (let i = 0; i < 200; i++) flips.stateAt(t0 + i * 16);
    assert.ok(performance.now() - began < 50, "cached look-ups are cheap");
    assert.deepEqual(flips.stateAt(t0), first);
    if (first.since !== -Infinity) assert.equal(weatherAt(first.since + 500, {voyageStartMs: start}).hints.seekCover, first.on);
});

test("shelter: each animal goes at its own moment and walks there", () => {
    const flips = new WeatherFlips(rainy);
    const id = "zebra-1";
    const delay = shelterDelayMs(id);
    assert.ok(delay >= 4000 && delay <= 44000);
    assert.equal(shelterAt(flips, id, 10 * MIN + delay - 1000, 20_000).level, 0);
    const half = shelterAt(flips, id, 10 * MIN + delay + 10_000, 20_000);
    assert.equal(half.going, true);
    assert.equal(half.moving, true);
    assert.ok(half.level > 0.4 && half.level < 0.6, `level ${half.level}`);
    assert.equal(shelterAt(flips, id, 20 * MIN, 20_000).level, 1);
    const out = shelterAt(flips, id, 25 * MIN + delay + 5_000, 20_000);
    assert.equal(out.going, false);
    assert.ok(out.level > 0.7 && out.level < 0.8);
    assert.ok(Math.abs(out.wentIn - (10 * MIN + delay)) <= 300);
    // Different ids, different moments.
    const delays = new Set(["a", "b", "c", "d", "e", "f"].map(shelterDelayMs));
    assert.ok(delays.size >= 5);
});

test("shelter kinds: grazers hunker, roosters go home, others to a tree, wet-lovers stay out", () => {
    assert.equal(shelterKind({move: "walk", roost: "open", social: "herd", size: 70}, "mammal"), "hunker");
    assert.equal(shelterKind({move: "fly", roost: "tree", social: "flock", size: 12}, "bird"), "roost");
    assert.equal(shelterKind({move: "walk", roost: "open", social: "solitary", size: 30}, "mammal"), "cover");
    assert.equal(shelterKind({move: "hop", roost: "ground_cover", social: "solitary", size: 8}, "frog"), "none");
    assert.equal(shelterKind({move: "swim", roost: "water", social: "school", size: 20}, "fish"), "none");
    assert.equal(shelterKind({move: "walk", roost: "open", social: "pair", size: 30}, "mammal", true), "none");
    assert.equal(shelterKind(null, "mammal"), "none");
});

test("cover: one of the three nearest trunks, seeded, on its outward side", () => {
    const trunks = [
        {x: 5, z: 0, nx: 1, nz: 0, id: "t1"},
        {x: 0, z: 6, nx: 0, nz: 1, id: "t2"},
        {x: -7, z: 0, nx: -1, nz: 0, id: "t3"},
        {x: 40, z: 40, nx: 1, nz: 0, id: "far"}
    ];
    const a = coverSpot("deer-1", {x: 0, z: 0}, 1.2, trunks, 20);
    const b = coverSpot("deer-1", {x: 0, z: 0}, 1.2, [...trunks].reverse(), 20);
    assert.ok(a);
    assert.deepEqual(a, b);
    assert.ok(Math.hypot(a!.x, a!.z) < 12);
    assert.equal(coverSpot("deer-1", {x: 0, z: 0}, 1.2, trunks, 3), null);
    const spots = new Set(Array.from({length: 12}, (_, i) => JSON.stringify(coverSpot(`deer-${i}`, {x: 0, z: 0}, 1.2, trunks, 20))));
    assert.ok(spots.size >= 6, "a herd spreads over the trees");
});

test("back to the wind: facing where the wind blows", () => {
    const yaw = backToWindYaw("x", 0); // wind toward +x
    assert.ok(Math.abs(Math.sin(yaw) - 1) < 0.1, `faces +x (${yaw})`);
    assert.ok(Math.abs(yawToward(0, 1)) < 1e-9);
});

test("parent: an adult in its own cluster, the same for everyone", () => {
    const adults = [
        {id: "m2", slot: 1, zone: "grassland"},
        {id: "m1", slot: 1, zone: "grassland"},
        {id: "other", slot: 2, zone: "grassland"}
    ];
    const p = pickParent({id: "foal", slot: 1, zone: "grassland"}, adults);
    assert.ok(p === "m1" || p === "m2");
    assert.equal(pickParent({id: "foal", slot: 1, zone: "grassland"}, [...adults].reverse()), p);
    assert.equal(pickParent({id: "foal", slot: 9, zone: "grassland"}, adults) !== null, true);
    assert.equal(pickParent({id: "foal", slot: 1, zone: "desert"}, adults), null);
});

test("heel: behind its parent's shoulder, on its back when carried", () => {
    const parent = {x: 10, z: 10, yaw: 0, length: 2, height: 1.4};
    const at = heelPose("foal", parent, {distance: 0.8, carried: false}, 0, 1_000_000);
    const d = Math.hypot(at.x - 10, at.z - 10);
    assert.ok(Math.abs(d - 1.6) < 1e-6, `at heel ${d}`);
    assert.ok(at.z < 10, "behind (the parent faces +z)");
    const ride = heelPose("joey", parent, {distance: 0, carried: true}, 0, 0);
    assert.ok(ride.lift > 1);
    assert.deepEqual(heelPose("foal", parent, {distance: 0.8, carried: false}, 1, 123_456), heelPose("foal", parent, {distance: 0.8, carried: false}, 1, 123_456));
});

/** A mother that grazes on the spot and now and then walks on (straight legs, turning at her own pace), as her schedule does. */
function grazingMother(seed: number) {
    const legs: Array<{from: number; to: number; x0: number; z0: number; yaw: number; speed: number}> = [];
    let t = 0;
    let x = 0;
    let z = 0;
    let yaw = 0;
    for (let k = 0; t < 3 * 3_600_000; k++) {
        const graze = 20_000 + ((seed * 7919 + k * 104729) % 70_000);
        legs.push({from: t, to: t + graze, x0: x, z0: z, yaw, speed: 0});
        t += graze;
        yaw += (((seed * 31 + k * 17) % 9) - 4) * 0.2;
        const walk = 4_000 + ((seed * 13 + k * 7) % 9_000);
        legs.push({from: t, to: t + walk, x0: x, z0: z, yaw, speed: 0.9});
        x += Math.sin(yaw) * 0.9 * (walk / 1000);
        z += Math.cos(yaw) * 0.9 * (walk / 1000);
        t += walk;
    }
    return (ms: number) => {
        const leg = legs.find((l) => ms >= l.from && ms < l.to) ?? legs[legs.length - 1];
        const s = (Math.min(ms, leg.to) - leg.from) / 1000;
        return {x: leg.x0 + Math.sin(leg.yaw) * leg.speed * s, z: leg.z0 + Math.cos(leg.yaw) * leg.speed * s, yaw: leg.yaw};
    };
}

test("young at play: dashes, kicks and waits; no orbiting, under 1% of moving 20 s windows turning a full circle", () => {
    const TAU = Math.PI * 2;
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    let moving = 0;
    let facing = 0;
    let travel = 0;
    let dashes = 0;
    let kicks = 0;
    let maxRate = 0;
    for (let n = 0; n < 24; n++) {
        const id = `foal-${n}`;
        const mother = grazingMother(n + 1);
        const pose = (ms: number) => {
            const m = mother(ms);
            return heelPose(id, {...m, length: 2, height: 1.4}, {distance: 0.8, carried: false}, 0.9, ms, (t) => mother(t));
        };
        for (let w = 0; w < 3 * 3_600_000 - 25_000; w += 20_000) {
            let last = pose(w);
            let heading: number | null = null;
            let f = 0;
            let tr = 0;
            let moved = false;
            for (let s = 1; s <= 20; s++) {
                const p = pose(w + s * 1000);
                f += Math.abs(wrap(p.yaw - last.yaw));
                if (Math.hypot(p.x - last.x, p.z - last.z) > 0.05) {
                    moved = true;
                    const h = Math.atan2(p.x - last.x, p.z - last.z);
                    if (heading !== null) tr += Math.abs(wrap(h - heading));
                    heading = h;
                }
                if (p.moving) dashes++;
                if (p.lift > 0.01) kicks++;
                last = p;
            }
            // Its fastest turn, at a fine step.
            for (let s = 0; s < 20_000; s += 100) {
                const a = pose(w + s);
                const b = pose(w + s + 100);
                maxRate = Math.max(maxRate, Math.abs(wrap(b.yaw - a.yaw)) / 0.1);
            }
            if (!moved) continue;
            moving++;
            if (f > TAU) facing++;
            if (tr > TAU) travel++;
        }
    }
    assert.ok(moving > 1000, `moving windows ${moving}`);
    assert.ok(dashes > 50 && kicks > 50, `it plays (dash samples ${dashes}, kick samples ${kicks})`);
    assert.ok(facing / moving < 0.01, `${((facing / moving) * 100).toFixed(2)}% turn their facing a full circle in 20 s`);
    assert.ok(travel / moving < 0.01, `${((travel / moving) * 100).toFixed(2)}% go round a full circle in 20 s`);
    // A foal (1.2 m) turns at most about 2 rad/s of its own (its mother's turns on top, here 0.8 rad at the start of a leg).
    assert.ok(maxRate < youngTurnRate(1.2) * 1.05 + 0.8 / 0.1, `max turn ${maxRate.toFixed(2)} rad/s`);
});

test("young at play: a dash faces the way it goes, then it waits ahead until its mother walks up", () => {
    const id = "foal-7";
    const still = () => ({x: 0, z: 0, yaw: 0});
    // Find a dash.
    let dashAt = -1;
    for (let t = 0; t < 2_000_000 && dashAt < 0; t += 100) if (heelPose(id, {...still(), length: 2, height: 1.4}, {distance: 0.8, carried: false}, 1, t, still).moving) dashAt = t;
    assert.ok(dashAt >= 0, "a dash within half an hour");
    const a = heelPose(id, {...still(), length: 2, height: 1.4}, {distance: 0.8, carried: false}, 1, dashAt + 200, still);
    const b = heelPose(id, {...still(), length: 2, height: 1.4}, {distance: 0.8, carried: false}, 1, dashAt + 400, still);
    const way = Math.atan2(b.x - a.x, b.z - a.z);
    assert.ok(Math.abs(Math.atan2(Math.sin(way - b.yaw), Math.cos(way - b.yaw))) < 0.7, "facing roughly the way it runs");
    assert.ok(Math.abs(way) < 0.7, "ahead, not round her");
    // Her standing still: it waits ahead (facing her way) well after the dash.
    const wait = heelPose(id, {...still(), length: 2, height: 1.4}, {distance: 0.8, carried: false}, 1, dashAt + 20_000, still);
    assert.ok(wait.z > 0.5 && Math.abs(wait.yaw) < 1e-9, `ahead of her (${wait.z.toFixed(2)})`);
    // Back at heel once she has walked on 3 m, or after 80 s anyway.
    const walkedOn = (t: number) => (t > dashAt + 10_000 ? {x: 0, z: 3, yaw: 0} : still());
    const caught = heelPose(id, {x: 0, z: 3, yaw: 0, length: 2, height: 1.4}, {distance: 0.8, carried: false}, 1, dashAt + 20_000, (t) => walkedOn(t));
    assert.ok(caught.z < 3, "behind her again once she walked past");
    const later = heelPose(id, {...still(), length: 2, height: 1.4}, {distance: 0.8, carried: false}, 1, dashAt + 95_000, still);
    assert.ok(later.z < 0, "crept back to heel by itself");
});

test("tide: the column moves with the surface; the floor does not", () => {
    const fit = (spec: {floorY: number; float: boolean}, height: number) => (spec.float ? {base: -0.35 * height, middle: 0.15 * height} : {base: spec.floorY, middle: spec.floorY + height / 2});
    assert.deepEqual(tideFit({floorY: -3, float: true}, 1, 0, fit), {base: -0.35, middle: 0.15});
    const high = tideFit({floorY: -3, float: true}, 1, 0.3, fit);
    assert.ok(Math.abs(high.base - (-0.05)) < 1e-9);
    const floor = tideFit({floorY: -3, float: false}, 1, 0.3, fit);
    assert.ok(Math.abs(floor.base - -3) < 1e-9);
});

test("above the tide: off flooded ground, up the beach", () => {
    // A beach rising toward -x: height = -x * 0.1.
    const h = (x: number) => -x * 0.1;
    const dry = aboveTide(-5, 0, 0.2, h);
    assert.equal(dry.moved, false);
    const wet = aboveTide(-1, 0, 0.3, h);
    assert.equal(wet.moved, true);
    assert.ok(wet.ground >= 0.3 + 0.04 - 1e-9);
    assert.ok(wet.x < -1);
});

test("a call's lift: up fast, held, down", () => {
    assert.equal(callLift(-1, 500), 0);
    assert.equal(callLift(300, 500), 1);
    assert.ok(callLift(90, 500) > 0 && callLift(90, 500) < 1);
    assert.equal(callLift(5000, 500), 0);
});

test("worn paths: cells walked again and again, once per visit", () => {
    // Back and forth between two spots, five times.
    const route: Array<{x: number; z: number}> = [];
    for (let k = 0; k < 5; k++) for (let i = 0; i <= 10; i++) route.push({x: k % 2 ? 10 - i : i, z: 0.3});
    const standing = Array.from({length: 40}, () => ({x: 30.2, z: 30.2}));
    const worn = wornPatches([route, standing], 1.1, 4);
    assert.ok(worn.length >= 6, `${worn.length} cells`);
    assert.ok(worn.every((c) => Math.abs(c.z - 0.55) < 1e-9), "along the route only");
    assert.ok(!worn.some((c) => c.x > 25), "standing still is not a path");
    assert.deepEqual(wornPatches([[...route].reverse(), standing], 1.1, 4).map((c) => c.x).sort(), worn.map((c) => c.x).sort());
});
