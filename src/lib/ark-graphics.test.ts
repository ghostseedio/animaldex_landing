import assert from "node:assert/strict";
import test from "node:test";
import {goldenClearance, goldenEye, goldenView, type GoldenPlace, type GoldenWorld} from "@/ark-scene/golden-shots";
import {goldenObstacles} from "@/ark-scene/golden-world";
import {nearFadeEnd, NEAR_FADE_MAX} from "@/ark-scene/near-fade";
import {rockAssetFor, rockAssetInfo} from "@/ark-scene/rock-assets";
import {attachPoints} from "@/ark-scene/sampler";
import {CROPS, cropAt, cropsGrowAt, fieldAt, fieldCentre, fieldHash, fieldKeepOuts, HEADLAND, snapToRow} from "@/ark-scene/fields";
import {grassTufts, worldDecor} from "@/ark-scene/decor";
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
    // A bee on a flower 1.1 m away, a caterpillar on a leaf at 0.55 m, an ant on bark at 0.12 m: the fade ends well
    // before the subject, at every distance (no floor that would reach past a very close subject).
    for (const distance of [0.05, 0.12, 0.3, 0.55, 0.8, 0.9, 1.1, 1.2, 2, 4]) assert.ok(nearFadeEnd(distance) < distance * 0.5, `close-up at ${distance} m`);
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

test("graphics: Home's fields: every crop grows somewhere, plants sit on the painted rows, the yard and clearing stay grass", () => {
    const farm = ZONE_SITES.farm_garden;
    const seen = new Map<string, number>();
    for (let x = farm.x - 40; x <= farm.x + 40; x += 1.3) {
        for (let z = farm.z - 30; z <= farm.z + 30; z += 1.3) seen.set(fieldAt(x, z).crop, (seen.get(fieldAt(x, z).crop) ?? 0) + 1);
    }
    for (const crop of CROPS) assert.ok((seen.get(crop) ?? 0) > 0, `${crop} grows somewhere`);
    // The same field gives the same crop and rows every time (no per-viewer randomness).
    assert.deepEqual(fieldAt(20.3, 41.7), fieldAt(20.3, 41.7));
    assert.equal(fieldHash(3, -2), fieldHash(3, -2));
    let planted = 0;
    for (let x = farm.x - 40; x <= farm.x + 40; x += 0.37) {
        for (let z = farm.z - 30; z <= farm.z + 30; z += 0.41) {
            const plant = snapToRow(x, z);
            if (!plant) continue;
            planted++;
            const at = fieldAt(plant.x, plant.z);
            assert.equal(at.crop, plant.crop);
            assert.ok(Math.abs(at.row - Math.round(at.row)) < 1e-6, "on a row's middle");
            assert.ok(at.edge >= HEADLAND, "not on the headland");
            // Fields are crop or grass whole, decided at their middle: never a field whose middle is in a keep-out.
            const middle = fieldCentre(at.cell);
            for (const out of fieldKeepOuts()) assert.ok(Math.hypot(middle.x - out.x, middle.z - out.z) >= out.r, "not in the yard, the clearing, the barn or the orchard");
        }
    }
    assert.ok(planted > 1000, `${planted} plants`);
    assert.equal(cropAt(farm.x, farm.z), null, "the animals' clearing is grass");
    assert.equal(cropAt(COTTAGE.x, COTTAGE.z), null, "the cottage's yard is grass");
});

test("graphics: every decor rock is drawn as an asset rock in its place, and its rock faces sit on that rock, looking out", () => {
    const rocks = worldDecor().filter((item) => item.kind === "rock");
    assert.ok(rocks.length > 100);
    const points = attachPoints({tag: "rock_face"});
    for (const [i, item] of worldDecor().entries()) {
        if (item.kind !== "rock") continue;
        const placed = rockAssetFor(item);
        assert.ok(placed, "every rock has an asset");
        assert.equal(placed!.x, item.x);
        assert.equal(placed!.z, item.z);
        const b = rockAssetInfo(placed!.id).bounds;
        const reach = Math.hypot(b.max[0] - b.min[0], b.max[2] - b.min[2]) * placed!.scale / 2 + 0.05;
        // The same four ids per rock as before (other lanes attach by id).
        const mine = points.filter((point) => point.id.startsWith(`rock_face:decor${i}:`));
        assert.equal(mine.length, 4, `rock ${i} keeps 4 rock faces`);
        for (const point of mine) {
            const d = {x: point.position.x - placed!.x, y: point.position.y - placed!.y, z: point.position.z - placed!.z};
            assert.ok(Math.hypot(d.x, d.z) <= reach, "on the rock, not beside it");
            assert.ok(d.y >= b.min[1] * placed!.scale - 0.05 && d.y <= b.max[1] * placed!.scale + 0.05, "within the rock's height");
            assert.ok(point.position.y >= heightAt(point.position.x, point.position.z) - 0.05 || point.hostKind !== "rock", "not buried in the ground");
        }
    }
});

test("graphics: meadow grass keeps out of the standing crops (it grows on the margins and the pasture)", () => {
    const tufts = grassTufts(60000);
    assert.ok(tufts.length > 1000);
    assert.equal(tufts.filter((tuft) => cropsGrowAt(tuft.x, tuft.z)).length, 0);
    // The margins still have grass: tufts in Home's zone, off the crops.
    assert.ok(tufts.some((tuft) => tuft.zone === "farm_garden"));
});
