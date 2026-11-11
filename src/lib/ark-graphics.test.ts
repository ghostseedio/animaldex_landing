import assert from "node:assert/strict";
import test from "node:test";
import {goldenClearance, goldenEye, goldenView, type GoldenPlace, type GoldenWorld} from "@/ark-scene/golden-shots";
import {goldenObstacles} from "@/ark-scene/golden-world";
import {nearFadeEnd, NEAR_FADE_MAX} from "@/ark-scene/near-fade";
import {worldDecor} from "@/ark-scene/decor";
import {COTTAGE, microCorner} from "@/ark-scene/micro-decor";
import {LAKE, RIVER, ZONE_SITES, heightAt, regionCentre, sampleGround, zoneAt} from "@/ark-scene/world";

/** The golden page's world adapter (golden-entry.ts), without the scene. */
const world: GoldenWorld = {
    homeView: () => ({target: {x: 0, y: 0, z: 0}, distance: 200, polar: 0.9, azimuth: 0}),
    groundAt: (x, z) => heightAt(x, z),
    beach: () => ZONE_SITES.seashore,
    shoreRocks: () => worldDecor().filter((item) => item.kind === "rock" && item.y < 0.2 && item.y > -0.9 && sampleGround(item.x, item.z).cliff < 0.25 && Math.hypot(item.x - ZONE_SITES.seashore.x, item.z - ZONE_SITES.seashore.z) < 75 && zoneAt(sampleGround(item.x, item.z)) !== "polar").map((item) => ({x: item.x, z: item.z, scale: item.scale})),
    forestFloor: () => microCorner("woodland"),
    house: () => ({x: COTTAGE.x, z: COTTAGE.z}),
    fields: () => ZONE_SITES.farm_garden,
    lake: () => ({x: LAKE.x, z: LAKE.z}),
    river: () => RIVER.map(([x, z]) => ({x, z})),
    mountainArea: () => {
        const centre = regionCentre("high_cold");
        const site = ZONE_SITES.mountains;
        return {x: site.x, z: site.z - 6, radius: Math.max(centre.radius * 0.5, 26)};
    },
    reef: () => ZONE_SITES.coral_reef,
    forestClearing: () => ZONE_SITES.woodland,
    obstacles: () => goldenObstacles()
};

test("graphics: the near-camera fade keeps a close-up's subject and never reaches past 2.2 m", () => {
    // A bee on a flower 1.1 m away, a caterpillar on a leaf 0.9 m away: the fade ends well before the subject.
    for (const distance of [0.8, 0.9, 1.1, 1.2]) assert.ok(nearFadeEnd(distance) < distance * 0.5, `close-up at ${distance} m`);
    // The forest floor at 4.6 m and every wider view: the full 2.2 m.
    assert.ok(nearFadeEnd(4.6) > 2);
    for (const distance of [6, 30, 120, 400]) assert.equal(nearFadeEnd(distance), NEAR_FADE_MAX);
});

test("graphics: the close golden shots stand clear of trunks, limbs and walls, above the ground", () => {
    const obstacles = goldenObstacles();
    assert.ok(obstacles.length > 500, "the obstacle list reads the map's trees");
    const clearances: Partial<Record<GoldenPlace, number>> = {forest_floor: 2.4, coast_rocks: 2.4};
    for (const [place, least] of Object.entries(clearances) as Array<[GoldenPlace, number]>) {
        const {view} = goldenView(place, world);
        const gap = goldenClearance(view, obstacles);
        assert.ok(gap >= least, `${place}: ${gap.toFixed(2)} m clear, wanted ${least}`);
        const eye = goldenEye(view);
        assert.ok(eye.y > heightAt(eye.x, eye.z) + 0.8, `${place}: the camera is above the ground`);
    }
});

test("graphics: the coast shot frames a shore, not the foot of a steep bank", () => {
    const {view} = goldenView("coast_rocks", world);
    const t = view.target;
    const r = Math.hypot(t.x, t.z);
    const rise = heightAt(t.x - (t.x / r) * 8, t.z - (t.z / r) * 8) - Math.max(heightAt(t.x, t.z), 0);
    assert.ok(rise < 3, `the land rises ${rise.toFixed(1)} m in the 8 m behind the rocks`);
});
