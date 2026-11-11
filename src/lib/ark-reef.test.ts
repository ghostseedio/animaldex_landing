import assert from "node:assert/strict";
import test from "node:test";
import {CORAL_MIN_DEPTH, REEF_KINDS, reefCloseupSpot, reefGrowth, reefLandmarks, seaBedAt} from "@/ark-scene/reef";
import {FISH_KINDS, FISH_LOOKS, SEA_CLOCK_PERIOD, fishPosition, fishSchoolAt, fishSchools, fishSchoolsNear, schoolFish, schoolTime, seaClockSeconds} from "@/ark-scene/fish-schools";
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
