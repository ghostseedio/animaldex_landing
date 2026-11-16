import assert from "node:assert/strict";
import {test} from "node:test";
import {heightAt, setArkWorld} from "@/ark-scene/world";
import {ARK_ISLANDS, townWorldOrigin} from "@/ark-scene/islands";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {speciesDepth} from "@/ark-scene/sea-depth";
import {loopPoint, OCEAN_LOOPS, OCEAN_VIEW_MARGIN, OCEAN_WANDER, oceanFix, roamsOpenOcean} from "@/ark-scene/open-ocean";
import {BOAT_ROUTES, boatFix} from "@/ark-scene/ocean-traffic";
import {OPEN_CLARITY, openWaterClarity, underwaterLook} from "@/ark-scene/sea-look";

setArkWorld("v2");
const origin = townWorldOrigin();
const half = ARK_ISLANDS.town.half;
const inTown = (x: number, z: number) => Math.abs(x - origin.x) <= half && Math.abs(z - origin.z) <= half;
/** The one world's ground: the town's inside its square, else the wild island's (and the open sea's floor). */
const ground = (x: number, z: number) => (inTown(x, z) ? townHeight(x - origin.x, z - origin.z) : heightAt(x, z));
/** Any land (ground above the sea) within `r` m (16 bearings, every 5 m out). */
const landWithin = (x: number, z: number, r: number) => {
    for (let d = 5; d <= r; d += 5) for (let k = 0; k < 16; k++) if (ground(x + Math.cos((k * Math.PI) / 8) * d, z + Math.sin((k * Math.PI) / 8) * d) > 0) return true;
    return false;
};
/** Inside the view's reach over the two islands and the strait (`index.ts` keepInCapsule, with the ocean's margin). */
const inView = (x: number, z: number) => {
    const l2 = origin.x * origin.x + origin.z * origin.z;
    const t = Math.min(Math.max((x * origin.x + z * origin.z) / l2, 0), 1);
    const radius = 220 + (half * 0.92 - 220) * t + OCEAN_VIEW_MARGIN;
    return Math.hypot(x - origin.x * t, z - origin.z * t) <= radius;
};

test("open ocean: every loop, at its widest and narrowest wander, is over 25 m of water with no land within 30 m, inside the view's reach", () => {
    for (const loop of OCEAN_LOOPS) {
        for (let k = 0; k < 120; k++) {
            const a = (k / 120) * Math.PI * 2;
            for (const phase of [Math.PI / 2 - 3 * a, -Math.PI / 2 - 3 * a]) {
                const p = loopPoint(loop, a, phase);
                assert.ok(ground(p.x, p.z) <= -25, `${loop.id} at ${p.x.toFixed(0)},${p.z.toFixed(0)}: floor ${ground(p.x, p.z).toFixed(1)} m`);
                assert.ok(!landWithin(p.x, p.z, 30), `${loop.id} at ${p.x.toFixed(0)},${p.z.toFixed(0)}: land within 30 m`);
                assert.ok(inView(p.x, p.z), `${loop.id} at ${p.x.toFixed(0)},${p.z.toFixed(0)}: outside the view's reach`);
            }
        }
    }
    assert.ok(OCEAN_WANDER < 0.2);
});

test("open ocean: the record decides who goes out (wild, zoned open_ocean, a swimmer, 1 m or longer); kept animals never", () => {
    const wild = (slug: string, extra: Record<string, unknown> = {}) => ({id: `a-${slug}`, model_slug: slug, zone: "open_ocean", island: "wild", ...extra});
    const depth = (slug: string) => speciesDepth(slug, "open_ocean");
    assert.equal(roamsOpenOcean(wild("sperm-whale"), depth("sperm-whale"), 16), true);
    assert.equal(roamsOpenOcean(wild("giant-oceanic-manta-ray"), depth("giant-oceanic-manta-ray"), 5), true);
    assert.equal(roamsOpenOcean(wild("bull-shark"), depth("bull-shark"), 2.4), true);
    // Small schooling fish stay off the island, where they are seen.
    assert.equal(roamsOpenOcean(wild("european-anchovy"), depth("european-anchovy"), 0.15), false);
    // A floor-walker of the open ocean stays on its floor.
    assert.equal(roamsOpenOcean(wild("american-lobster"), depth("american-lobster"), 1.1), false);
    // The zoo's and the aquarium's stay in their tanks; another zone's whale is not moved here.
    assert.equal(roamsOpenOcean(wild("whale-shark", {island: "town", area: "zoo"}), depth("whale-shark"), 12), false);
    assert.equal(roamsOpenOcean(wild("sperm-whale", {island: null, area: "zoo"}), depth("sperm-whale"), 16), false);
    assert.equal(roamsOpenOcean({...wild("green-sea-turtle"), zone: "coral_reef"}, speciesDepth("green-sea-turtle", "coral_reef"), 1.2), false);
    // Not a water species (a frigatebird zoned open_ocean): no depth row, never out at sea.
    assert.equal(roamsOpenOcean(wild("magnificent-frigatebird"), speciesDepth("magnificent-frigatebird", "open_ocean"), 1), false);
});

test("open ocean: an animal is always over deep water, never on land or inside an island, the same for every viewer", () => {
    const animals = [
        {slug: "sperm-whale", length: 16.7},
        {slug: "giant-oceanic-manta-ray", length: 5.5},
        {slug: "bull-shark", length: 2.6},
        {slug: "humpback-whale", length: 15},
        {slug: "great-white-shark", length: 5},
        {slug: "bluefin-tuna", length: 2.5},
        {slug: "orca", length: 8},
        {slug: "blue-whale", length: 26}
    ];
    const t0 = Date.UTC(2026, 10, 16, 12) / 1000;
    const loops = new Set<string>();
    for (const {slug, length} of animals) {
        for (let rank = 0; rank < 6; rank++) {
            const animal = {id: `${slug}-${rank}`, model_slug: slug, slot_rank: rank};
            for (let k = 0; k < 400; k++) {
                const t = t0 + k * 37.3;
                const fix = oceanFix(animal, length, t);
                loops.add(fix.loop);
                assert.deepEqual(oceanFix(animal, length, t), fix);
                assert.ok(ground(fix.x, fix.z) <= -20, `${slug}#${rank} at ${fix.x.toFixed(0)},${fix.z.toFixed(0)}: floor ${ground(fix.x, fix.z).toFixed(1)}`);
                assert.ok(!landWithin(fix.x, fix.z, 10), `${slug}#${rank} at ${fix.x.toFixed(0)},${fix.z.toFixed(0)}: land within 10 m`);
                // (Never inside either island's land, whatever its square: the wild island's coast is about 190 m out.)
                assert.ok(Number.isFinite(fix.yaw) && fix.speed > 0.5 && fix.speed <= 1.6);
            }
            // It moves: a minute later it is 30 m or more further on.
            const a = oceanFix(animal, length, t0);
            const b = oceanFix(animal, length, t0 + 60);
            assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 25);
        }
    }
    assert.ok(loops.size >= 3, `${loops.size} loops used`);
});

test("boats: every route is on water (2.5 m or deeper, no land within 12 m) but the ferry's landings; they move on the shared clock", () => {
    const t0 = Date.UTC(2026, 10, 16, 12) / 1000;
    const kinds = new Set<string>();
    for (const route of BOAT_ROUTES) {
        kinds.add(route.kind);
        let moved = 0;
        let prev = boatFix(route, t0);
        for (let k = 1; k < 1500; k++) {
            const fix = boatFix(route, t0 + k * 0.9);
            assert.deepEqual(boatFix(route, t0 + k * 0.9), fix);
            assert.ok(ground(fix.x, fix.z) <= -2.5, `${route.id} at ${fix.x.toFixed(0)},${fix.z.toFixed(0)}: floor ${ground(fix.x, fix.z).toFixed(2)}`);
            const landing = "line" in route && (Math.hypot(fix.x - route.line[0].x, fix.z - route.line[0].z) < 40 || Math.hypot(fix.x - route.line[route.line.length - 1].x, fix.z - route.line[route.line.length - 1].z) < 40);
            if (!landing) assert.ok(!landWithin(fix.x, fix.z, 12), `${route.id} at ${fix.x.toFixed(0)},${fix.z.toFixed(0)}: land within 12 m`);
            const step = Math.hypot(fix.x - prev.x, fix.z - prev.z);
            // (No jumps: never further in 0.9 s than its top speed takes it, with a little for the wander.)
            assert.ok(step <= route.speed * 0.9 * 1.35 + 0.05, `${route.id} jumped ${step.toFixed(1)} m`);
            moved += step;
            assert.ok(Number.isFinite(fix.yaw));
            prev = fix;
        }
        assert.ok(moved > 300, `${route.id} moved ${moved.toFixed(0)} m`);
    }
    assert.deepEqual(Array.from(kinds).sort(), ["ferry", "sailboat", "speedboat"]);
});

test("open ocean: the blue water is clearer than the shelf (the haze only), unchanged over the island's own sea", () => {
    assert.equal(openWaterClarity(0), 1);
    assert.equal(openWaterClarity(30), 1);
    assert.ok(Math.abs(openWaterClarity(60) - OPEN_CLARITY) < 1e-9 && Math.abs(openWaterClarity(110) - OPEN_CLARITY) < 1e-9);
    for (let d = 30; d < 60; d++) assert.ok(openWaterClarity(d + 1) <= openWaterClarity(d));
    const a = underwaterLook(5, 1, {r: 0, g: 0, b: 0, density: 0});
    const b = underwaterLook(5, 1, {r: 0, g: 0, b: 0, density: 0}, openWaterClarity(110));
    assert.equal(a.r, b.r);
    assert.ok(Math.abs(b.density - a.density * OPEN_CLARITY) < 1e-12);
});
