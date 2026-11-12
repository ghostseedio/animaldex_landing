/**
 * The wild island without its hamlet (decision 148, `src/ark-scene/no-hamlet.ts`): with two islands (T3's
 * `arkTwoIslands`) the wild island has no cottage, houses, barns, coops, smallholdings, fields, paddocks, fences, lamp
 * posts, hay, plots, garden pond or lanes; their ground is meadow with a few trees; nothing of them is left in the
 * colliders, the walk grid, the attach points, the map's tags or the places. With one island it is today's, unchanged.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {noHamlet, noHamletFor, setNoHamlet} from "@/ark-scene/no-hamlet";
import {forestFill, worldDecor} from "@/ark-scene/decor";
import {microDecor} from "@/ark-scene/micro-decor";
import {allAttachPoints} from "@/ark-scene/sampler";
import {colliderSetFor} from "@/ark-scene/collide/colliders";
import {cropAt, fieldsGlsl} from "@/ark-scene/fields";
import {defaultHomePlots} from "@/ark-scene/props/home-layout";
import {hamletLandAt} from "@/ark-scene/props/hamlet-land";
import {hamletPlotsFor, homePlots, reservedAt, reservedPlots} from "@/ark-scene/map/hamlet";
import {laneDistance, sampleGround, villageLaneDistance, zoneAt, HAMLET_LANES} from "@/ark-scene/world";
import {worldSampler as behaviourWorldSampler} from "@/ark-scene/world-sampler";
import {MAX_SLOPE, MOUNTAIN_SLOPE, navGrid} from "@/ark-scene/behaviour-nav";
import {maskWalkable, WALK_MASK_NO_HAMLET_VERSION} from "@/ark-scene/map/walk-mask";
import {mapPoints} from "@/ark-scene/map/place";
import {validateMap} from "@/ark-scene/map/validate";
import {treeBody} from "@/ark-scene/tree-spacing";
import {groundArrays} from "@/ark-scene/terrain";
import {arkTwoIslands} from "@/lib/ark-islands";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";

const BUILT = new Set(["barn", "hay", "fence", "orchard", "cottage", "pond", "lamp"]);
const hash = (value: unknown) => createHash("sha1").update(JSON.stringify(value, (_k, v) => (ArrayBuffer.isView(v) ? Array.from(v as unknown as ArrayLike<number>) : v))).digest("hex");
const key = (item: {kind: string; x: number; z: number; scale: number}) => `${item.kind}@${item.x.toFixed(3)},${item.z.toFixed(3)}x${item.scale.toFixed(3)}`;

/** Within the hamlet's village on today's island (its lanes' reach) or round the cottage. */
const inFormerHamlet = (x: number, z: number) => villageLaneDistance(x, z) < 26;

test("the switch follows T3's two-island read; a page override wins; flipping back gives today's world byte for byte", () => {
    const one = {animals: [{island: null, area: "house"}]} as unknown as ArkSnapshot;
    const two = {animals: [{island: "wild", area: null}]} as unknown as ArkSnapshot;
    assert.equal(noHamletFor(arkTwoIslands(one)), false, "one island (today's read, house animals included): the hamlet stands");
    assert.equal(noHamletFor(arkTwoIslands(two)), true);
    (globalThis as {__arkNoHamlet?: boolean}).__arkNoHamlet = false;
    assert.equal(noHamletFor(true), false);
    delete (globalThis as {__arkNoHamlet?: boolean}).__arkNoHamlet;

    setNoHamlet(false);
    const before = {decor: hash(worldDecor()), fill: hash(forestFill()), attach: hash(allAttachPoints()), colliders: hash(colliderSetFor(null).list), ground: hash(groundArrays("low"))};
    setNoHamlet(true);
    assert.equal(noHamlet(), true);
    assert.notEqual(hash(worldDecor()), before.decor);
    setNoHamlet(false);
    assert.deepEqual({decor: hash(worldDecor()), fill: hash(forestFill()), attach: hash(allAttachPoints()), colliders: hash(colliderSetFor(null).list), ground: hash(groundArrays("low"))}, before);
});

test("islands mode: nothing built on the wild island (decor, plots, reserved land, fields, lanes, colliders, attach points)", () => {
    setNoHamlet(false);
    assert.ok(worldDecor().some((item) => item.kind === "barn"), "today's island has its barn (the test's premise)");
    assert.equal(defaultHomePlots().length, 2);
    setNoHamlet(true);
    try {
        assert.deepEqual(worldDecor().filter((item) => BUILT.has(item.kind)).map(key), []);
        assert.deepEqual(forestFill().filter((item) => BUILT.has(item.kind)).map(key), []);
        assert.deepEqual(microDecor().filter((item) => BUILT.has(item.kind)).map((item) => item.kind), []);
        assert.deepEqual(defaultHomePlots(), []);
        assert.deepEqual(homePlots(16 * 130, 6 * 50), []);
        assert.deepEqual(reservedPlots(), []);
        assert.deepEqual(hamletPlotsFor([{area: "house"}, {area: "farm"}] as ArkAnimal[]), []);
        for (const {points} of HAMLET_LANES) {
            for (const [x, z] of points) {
                assert.equal(laneDistance(x, z), Infinity);
                assert.equal(reservedAt(x, z), false);
                assert.equal(hamletLandAt(x, z), null);
            }
        }
        // No crop anywhere on Home's fields, and the ground's shader paints no lane and no crop rows.
        for (let x = -60; x <= 110; x += 3) for (let z = -40; z <= 110; z += 3) assert.equal(cropAt(x, z), null, `a crop at ${x},${z}`);
        assert.match(fieldsGlsl(), /bool arkHamletLot\(vec2 p\) \{\s*return false;/);
        assert.doesNotMatch(fieldsGlsl(), /d = min\(d, arkSegment/);
        const kinds = new Set(colliderSetFor(null).list.map((c) => c.kind));
        for (const kind of ["building", "fence", "hay", "pond", "post"]) assert.ok(!kinds.has(kind as never), `a ${kind} collider`);
        const tags = new Set(allAttachPoints().map((p) => p.tag));
        for (const tag of ["house_wall", "house_eave", "porch_light", "lamp", "fence_post", "roof_edge"]) assert.ok(!tags.has(tag as never), `a ${tag} point`);
        // The map's ground has no homestead left.
        const sampler = mapPoints().sampler;
        for (let x = -30; x <= 100; x += 2) {
            for (let z = -30; z <= 100; z += 2) {
                const tags = sampler.ground(x, z).tags;
                for (const tag of ["house", "garden", "garden_pond", "compost", "farm_barn", "town_park"]) assert.ok(!tags.includes(tag as never), `${tag} at ${x},${z}`);
            }
        }
    } finally {
        setNoHamlet(false);
    }
});

test("islands mode: the former hamlet is meadow with a few trees and shrubs, kept apart; the rest of the island is today's", () => {
    setNoHamlet(false);
    const today = worldDecor().map(key);
    const todayFill = forestFill().map(key);
    setNoHamlet(true);
    try {
        const decor = worldDecor();
        const fill = forestFill();
        const changed = (list: string[], was: string[]) => {
            const before = new Set(was);
            return list.filter((k) => !before.has(k));
        };
        // Everything new stands where the hamlet was (or settles beside it), nothing elsewhere moves.
        const newDecor = changed(decor.map(key), today).map((k) => k.split("@")[1].split("x")[0].split(",").map(Number));
        for (const [x, z] of newDecor) assert.ok(villageLaneDistance(x, z) < 40, `a new decor item far from the hamlet at ${x},${z}`);
        const newFill = changed(fill.map(key), todayFill).map((k) => k.split("@")[1].split("x")[0].split(",").map(Number));
        for (const [x, z] of newFill) assert.ok(villageLaneDistance(x, z) < 40, `a new fill tree far from the hamlet at ${x},${z}`);
        assert.deepEqual(decor.filter((item) => item.kind === "rock").map(key), worldDecor().filter((item) => item.kind === "rock").map(key));
        // A meadow with scattered shrubs and a few trees: some more than grew between today's plots, mostly shrubs, and
        // the village's land still open (at most 0.6 as many again as stood between its plots).
        const wooded = (list: Array<{kind: string; x: number; z: number}>) => list.filter((item) => ["broadleaf", "shrub", "acacia", "conifer", "orchard"].includes(item.kind) && inFormerHamlet(item.x, item.z) && zoneAt(sampleGround(item.x, item.z)) === "farm_garden");
        const trees = wooded([...decor, ...fill]);
        setNoHamlet(false);
        const before = wooded([...worldDecor(), ...forestFill()]);
        setNoHamlet(true);
        const added = trees.length - before.length;
        const addedTrees = trees.filter((item) => item.kind !== "shrub").length - before.filter((item) => item.kind !== "shrub").length;
        assert.ok(added >= 15, `only ${added} more trees and shrubs where the hamlet stood`);
        assert.ok(added <= before.length * 0.6, `${added} more on top of ${before.length}: not a meadow`);
        assert.ok(addedTrees < added / 2, `${addedTrees} of the ${added} new are trees: mostly shrubs`);
        // Kept apart (tree-spacing.ts): no trunk inside another, no crowns fused.
        const bodies = trees.map((item) => treeBody(item)).filter((body): body is NonNullable<typeof body> => Boolean(body));
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const d = Math.hypot(bodies[i].x - bodies[j].x, bodies[i].z - bodies[j].z);
                assert.ok(d >= bodies[i].trunk + bodies[j].trunk, `two trunks in one another at ${bodies[i].x.toFixed(1)},${bodies[i].z.toFixed(1)}`);
            }
        }
    } finally {
        setNoHamlet(false);
    }
});

test("islands mode: the walk mask is the live grid's, cell for cell (scripts/ark-map-walk-mask.mts --no-hamlet)", () => {
    setNoHamlet(true);
    try {
        const sampler = behaviourWorldSampler();
        const grid = navGrid(sampler);
        const {size} = grid.cells;
        const wrong: string[] = [];
        for (const slope of [MAX_SLOPE, MOUNTAIN_SLOPE]) {
            for (let j = 0; j < size; j++) {
                for (let i = 0; i < size; i++) {
                    const x = -132 + (i + 0.5) * 2;
                    const z = -132 + (j + 0.5) * 2;
                    const masked = maskWalkable(x, z, slope);
                    if (masked === null || masked !== grid.walkable(x, z, slope)) wrong.push(`${slope} ${x},${z}`);
                }
            }
        }
        assert.deepEqual(wrong.slice(0, 5), [], `${wrong.length} cells differ (${sampler.version}; the mask is from ${WALK_MASK_NO_HAMLET_VERSION}): run npx tsx scripts/ark-map-walk-mask.mts --no-hamlet`);
        assert.doesNotMatch(sampler.version, /building|hay|fence|pond|post/);
    } finally {
        setNoHamlet(false);
    }
});

test("islands mode: the map validator passes every species (a farm or garden species' homestead reads as its wild ground)", () => {
    setNoHamlet(true);
    try {
        const {failures, placed} = validateMap();
        assert.deepEqual(failures.slice(0, 10), []);
        for (const place of placed.values()) assert.ok(!place.hamlet, "nobody placed on a plot");
    } finally {
        setNoHamlet(false);
    }
});
