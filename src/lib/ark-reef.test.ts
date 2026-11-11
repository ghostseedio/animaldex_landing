import assert from "node:assert/strict";
import test from "node:test";
import {CORAL_MIN_DEPTH, REEF_KINDS, reefCloseupSpot, reefGrowth, reefLandmarks, seaBedAt} from "@/ark-scene/reef";
import {FISH_KINDS, FISH_LOOKS, SEA_CLOCK_PERIOD, fishPosition, fishSchoolAt, fishSchools, fishSchoolsNear, fleeFrom, schoolFish, schoolTime, seaClockSeconds, type FishChaser} from "@/ark-scene/fish-schools";
import {ZONE_SITES, heightAt} from "@/ark-scene/world";

const EPOCH = 1_794_355_200; // 2026-11-11 00:00 UTC

test("reef: nothing stony in the beach's clear shallows, every kind grows, the same reef twice", () => {
    const items = reefGrowth();
    const stony = items.filter((item) => item.kind !== "seagrass" && item.kind !== "kelp");
    assert.ok(stony.length > 400, `corals and sponges: ${stony.length}`);
    for (const item of stony) assert.ok(item.depth >= CORAL_MIN_DEPTH, `${item.kind} at ${item.depth.toFixed(2)} m`);
    const beach = ZONE_SITES.seashore;
    assert.equal(stony.filter((item) => Math.hypot(item.x - beach.x, item.z - beach.z) < 45 && item.depth < 3).length, 0, "no coral near the beach's shallows");
    for (const kind of REEF_KINDS) assert.ok(items.some((item) => item.kind === kind), `${kind} grows somewhere`);
    // Deterministic: the module caches, so check the placement against a fresh sample of the bed.
    for (const item of items.slice(0, 40)) assert.equal(seaBedAt(item.x, item.z).height.toFixed(4), item.y.toFixed(4));
});

test("reef: by depth and substrate", () => {
    const items = reefGrowth();
    for (const item of items) {
        if (item.kind === "kelp") {
            assert.equal(item.substrate, "rock");
            assert.ok(item.depth >= 2.2 && item.depth <= 9);
        } else if (item.kind === "seagrass") {
            assert.equal(item.substrate, "sand");
            assert.ok(item.depth >= 1.2 && item.depth <= 3.5);
        } else if (item.kind === "branching" || item.kind === "table") {
            assert.notEqual(item.substrate, "sand");
        }
    }
    // Sea fans and barrel sponges are deep-water growth; branching corals are mostly on the flat and the crest.
    const deep = (kind: string) => items.filter((item) => item.kind === kind).reduce((sum, item) => sum + item.depth, 0) / Math.max(items.filter((item) => item.kind === kind).length, 1);
    assert.ok(deep("fan") > deep("branching") + 1, `fans ${deep("fan").toFixed(1)} m vs branching ${deep("branching").toFixed(1)} m`);
    assert.ok(deep("barrel_sponge") > 4.5);
});

test("reef: landmarks and the close-up spot are under water on the reef", () => {
    const marks = reefLandmarks();
    assert.ok(marks.heads.length >= 4);
    for (const head of marks.heads) assert.ok(head.top < -0.5 && head.top > head.y);
    assert.ok(marks.cleaning.top < -0.5);
    const spot = reefCloseupSpot();
    assert.ok(spot.y < -2 && spot.y > -9);
    assert.ok(Math.hypot(spot.x - ZONE_SITES.coral_reef.x, spot.z - ZONE_SITES.coral_reef.z) < 30);
});

test("fish: schools are decorative and deterministic from the clock", () => {
    const schools = fishSchools();
    assert.ok(schools.length >= 8);
    assert.equal(new Set(schools.map((school) => school.id)).size, schools.length);
    for (const school of schools) assert.ok((FISH_KINDS as readonly string[]).includes(school.kind) && FISH_LOOKS[school.kind]);
    const a = fishSchoolsNear(ZONE_SITES.coral_reef, 60, EPOCH + 123.4);
    const b = fishSchoolsNear(ZONE_SITES.coral_reef, 60, EPOCH + 123.4);
    assert.deepEqual(a, b);
    assert.ok(a.length >= 5, `schools near the reef: ${a.length}`);
    // Sorted by distance, all within the radius.
    for (const school of a) assert.ok(Math.hypot(school.centre.x - ZONE_SITES.coral_reef.x, school.centre.z - ZONE_SITES.coral_reef.z) <= 60);
});

test("fish: under the surface, over the bed, and smooth over time (no jumps, even across clock slots)", () => {
    for (const school of fishSchools()) {
        let last: {x: number; y: number; z: number} | null = null;
        for (let k = 0; k < 900; k++) {
            const epoch = EPOCH + k * 0.5;
            const now = fishSchoolAt(school, epoch);
            assert.ok(now.centre.y < -0.3, `${school.id} centre ${now.centre.y.toFixed(2)}`);
            assert.ok(now.centre.y > heightAt(now.centre.x, now.centre.z) + 0.15, `${school.id} over the bed at ${k}`);
            if (last) assert.ok(Math.hypot(now.centre.x - last.x, now.centre.y - last.y, now.centre.z - last.z) < 1.2, `${school.id} jumped at ${k}`);
            last = now.centre;
        }
        // A fish moves smoothly frame to frame.
        const t = schoolTime(school, EPOCH + 777);
        const p = fishPosition(school, 0, t, {x: 0, y: 0, z: 0});
        const q = fishPosition(school, 0, t + 1 / 60, {x: 0, y: 0, z: 0});
        assert.ok(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < 0.2, `${school.id} fish step`);
        assert.equal(schoolFish(school, EPOCH).length, school.count);
    }
});

test("fish: bait schools ball up some of the time, and the shaders' sea clock wraps", () => {
    const bait = fishSchools().filter((school) => school.mill > 0);
    assert.ok(bait.length >= 2);
    for (const school of bait) {
        let milling = 0;
        for (let k = 0; k < 400; k++) if (fishSchoolAt(school, EPOCH + k * 10).mode === "mill") milling++;
        assert.ok(milling > 10 && milling < 300, `${school.id} milled ${milling}/400`);
    }
    assert.equal(seaClockSeconds(EPOCH), EPOCH % SEA_CLOCK_PERIOD);
    assert.ok(seaClockSeconds(-1) > 0);
});

test("fish: chasers split a school round them, it flees and rejoins behind (closed form, never folding over)", () => {
    const flee = (p: {x: number; y: number; z: number}, chasers: FishChaser[]) => {
        const offset = {x: 0, y: 0, z: 0};
        const velocity = {x: 0, y: 0, z: 0};
        const fright = fleeFrom(p, chasers, offset, velocity);
        return {at: {x: p.x + offset.x, y: p.y + offset.y, z: p.z + offset.z}, offset, velocity, fright};
    };
    const seal: FishChaser = {x: 0, y: -3, z: 0, r: 4};
    const reach = seal.r + 0.6;
    // No chasers, or out of reach: the shared motion untouched.
    assert.deepEqual(flee({x: 1, y: -3, z: 0}, []).offset, {x: 0, y: 0, z: 0});
    assert.equal(flee({x: reach + 0.01, y: -3, z: 0}, [seal]).fright, 0);
    // Along a ray out from the seal: pushed away, a hole of half the reach, the order kept (no fish passes another).
    let last = -Infinity;
    for (let d = 0.01; d < reach; d += 0.05) {
        const moved = flee({x: d, y: -3, z: 0}, [seal]);
        assert.ok(moved.at.x >= d, `pushed away at ${d.toFixed(2)}`);
        assert.ok(moved.at.x >= 0.5 * reach - 0.05, `outside the hole at ${d.toFixed(2)}`);
        assert.ok(moved.at.x >= last - 1e-9, `order kept at ${d.toFixed(2)}`);
        assert.ok(moved.velocity.x > 0, "points away");
        last = moved.at.x;
    }
    // Smooth at the edge of its reach (nothing jumps as a hunter comes into range).
    assert.ok(flee({x: reach - 0.01, y: -3, z: 0}, [seal]).offset.x < 0.001);
    // Rejoin: as the seal swims on through and away, the fish's offset falls back to nothing.
    const fish = {x: 0.5, y: -3, z: 0.3};
    const offsets: number[] = [];
    for (let k = 0; k <= 40; k++) {
        const passing: FishChaser = {x: -8 + k * 0.5, y: -3, z: 0, r: 4};
        const o = flee(fish, [passing]).offset;
        offsets.push(Math.hypot(o.x, o.y, o.z));
    }
    assert.equal(offsets[0], 0);
    assert.ok(Math.max(...offsets) > 1.5, "split wide as it passes");
    assert.equal(offsets[offsets.length - 1], 0, "back in its place behind");
    for (let k = 1; k < offsets.length; k++) assert.ok(Math.abs(offsets[k] - offsets[k - 1]) < 0.6, "no jump frame to frame");
    // Deterministic.
    assert.deepEqual(flee({x: 1, y: -2.5, z: 0.4}, [seal]), flee({x: 1, y: -2.5, z: 0.4}, [seal]));
});

test("reef: near and far are a function of the camera's place now, never of the frames before (the visual CI renders twice)", async () => {
    const {Vector3} = await import("three");
    const {buildReef} = await import("@/ark-scene/reef-render");
    const reef = ZONE_SITES.coral_reef;
    const at = new Vector3(reef.x + 4.3, -1.6, reef.z + 7.9);
    const draw = (path: Array<[number, number, number]>) => {
        const view = buildReef();
        for (const [x, y, z] of path) view.update(new Vector3(x, y, z));
        view.update(at);
        const out = view.meshes.map((mesh) => ({kind: mesh.userData.kind as string, count: mesh.count, matrices: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16))}));
        view.dispose();
        return out;
    };
    // One camera drifting in by a few millimetres a frame (a settling view), one jumping straight there from far off.
    const drift: Array<[number, number, number]> = [];
    for (let k = 0; k < 90; k++) drift.push([at.x + 0.9 * 0.93 ** k, at.y + 0.6 * 0.93 ** k, at.z - 0.4 * 0.93 ** k]);
    const a = draw(drift);
    const b = draw([[0, 20, 0], [reef.x + 30, -2, reef.z]]);
    assert.deepEqual(a, b);
    assert.ok(a.some((mesh) => mesh.count > 0));
});
