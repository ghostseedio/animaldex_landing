/**
 * The bigger wild island's scenery through the motion pass (P3, docs/ark/wild-island.md §8,
 * `src/ark-scene/islands/wild/decor-v2.ts`): with the world switch on v2 the decor, the fill, the grass, the floor,
 * the mounds and L6's mountain rocks are the wild island's, and L6's spacing and rocks, L3's attach points and L5's
 * colliders follow from them. With v1 (the default) every one of them is today's, byte for byte.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {arkWorld, setArkWorld, zoneAt, sampleGround} from "@/ark-scene/world";
import {setNoHamlet} from "@/ark-scene/no-hamlet";
import {forestFill, grassTufts, worldDecor} from "@/ark-scene/decor";
import {floorObstacles, floorPlacements} from "@/ark-scene/floor-assets";
import {drawnRocks} from "@/ark-scene/map/rocks";
import {allMountainRocks, mountainRocks} from "@/ark-scene/rock-layout";
import {allMounds, savannaMounds} from "@/ark-scene/mounds";
import {computeScenery} from "@/ark-scene/runtime/prebuild-scenery";
import {applyArkPrebuild} from "@/ark-scene/runtime/prebuild";
import {microDecor} from "@/ark-scene/micro-decor";
import {rockAssetFor} from "@/ark-scene/rock-assets";
import {assetTreePlacement, treeAssetFor} from "@/ark-scene/tree-pick";
import {treeBody, treesClash} from "@/ark-scene/tree-spacing";
import {sceneryProblems} from "@/ark-scene/scenery-check";
import {allAttachPoints} from "@/ark-scene/sampler";
import {colliderSetFor} from "@/ark-scene/collide/colliders";
import {wildScenery} from "@/ark-scene/islands/wild/scenery";
import {WILD_HALF} from "@/ark-scene/islands/wild/frame";

const hash = (value: unknown) => createHash("sha1").update(JSON.stringify(value)).digest("hex");

/** Everything the motion pass reads from the decor, hashed. */
function sources() {
    const decor = worldDecor();
    const fill = forestFill();
    return {
        decor: hash(decor),
        fill: hash(fill),
        grass: hash(grassTufts(22000)),
        micro: hash(microDecor()),
        floor: hash(floorPlacements()),
        rocks: hash(drawnRocks()),
        mountain: hash(allMountainRocks()),
        mounds: hash(allMounds()),
        rockAssets: hash(decor.map((item) => rockAssetFor(item))),
        treeAssets: hash([...decor, ...fill].map((item) => treeAssetFor(item))),
        attach: hash(allAttachPoints()),
        colliders: hash(colliderSetFor(null).list)
    };
}

const TREE_KINDS = new Set(["broadleaf", "rainforest", "conifer", "acacia", "palm"]);

test("v1 stays today's: the world switched to v2 and back gives every decor source byte for byte", () => {
    assert.equal(arkWorld(), "v1");
    const before = sources();
    setArkWorld("v2");
    assert.notEqual(hash(worldDecor()), before.decor);
    setArkWorld("v1");
    setNoHamlet(false);
    assert.deepEqual(sources(), before);
});

test("v2: the decor is the wild island's: its trees at their assets and real heights, kept apart as drawn (L6's spacing)", () => {
    setArkWorld("v2");
    try {
        const decor = worldDecor();
        const fill = forestFill();
        const canopy = wildScenery().filter((item) => item.storey === "canopy").length;
        const trees = decor.filter((item) => TREE_KINDS.has(item.kind));
        // Most of the generator's canopy stands (the rest in the animals' clearings, on a micro corner, or crowded out).
        assert.ok(trees.length > canopy * 0.8, `${trees.length} of ${canopy} canopy trees`);
        assert.ok(fill.length > 150 && fill.every((item, i) => i === 0 || fill[i - 1].rank <= item.rank), "the understorey as the ranked fill");
        for (const item of [...trees, ...fill]) {
            // Each carries its asset (the generator's pick), drawn at its own scale, standing where the renderer stands it.
            assert.ok(item.asset, `${item.kind} at ${item.x.toFixed(1)},${item.z.toFixed(1)} has no asset`);
            assert.deepEqual(treeAssetFor(item), {id: item.asset, scale: item.scale});
            assert.ok(assetTreePlacement(item), `${item.asset} not drawn`);
        }
        // The emergents tower (40–60 m), the rest at their real heights.
        const tallest = Math.max(...trees.map((item) => assetTreePlacement(item)!.height));
        assert.ok(tallest > 35, `the tallest tree is ${tallest.toFixed(1)} m`);
        // No two drawn trees (or shrubs) grow inside each other (tree-spacing.ts: trunks, a trunk in a crown, fused crowns).
        const bodies = [...decor, ...fill].map((item) => treeBody(item)).filter((body): body is NonNullable<typeof body> => Boolean(body));
        const clashes: string[] = [];
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                if (Math.hypot(bodies[i].cx - bodies[j].cx, bodies[i].cz - bodies[j].cz) > bodies[i].reach + bodies[j].reach + 1) continue;
                const clash = treesClash(bodies[i], bodies[j]);
                if (clash) clashes.push(`${clash.kind} ${bodies[i].asset ?? bodies[i].kind}@${bodies[i].x.toFixed(1)},${bodies[i].z.toFixed(1)}`);
            }
        }
        assert.deepEqual(clashes.slice(0, 5), [], `${clashes.length} clashes`);
        // Nothing of a garden: the island has no buildings and no Home.
        assert.deepEqual(decor.filter((item) => ["barn", "hay", "fence", "orchard", "cottage", "pond", "lamp"].includes(item.kind)).map((item) => item.kind), []);
        assert.equal(microDecor().filter((item) => item.zone === "farm_garden").length, 0);
        // The decor covers the whole island, not today's square.
        assert.ok(decor.some((item) => Math.abs(item.x) > 140 || Math.abs(item.z) > 140) && decor.every((item) => Math.abs(item.x) < WILD_HALF && Math.abs(item.z) < WILD_HALF));
    } finally {
        setArkWorld("v1");
        setNoHamlet(false);
    }
});

test("v2: no prop floats or stands in another (scenery-check.ts): rocks sat into their slopes, logs, trunks, mounds, crags", () => {
    setArkWorld("v2");
    try {
        const {floating, intersections, solids} = sceneryProblems();
        assert.ok(solids > 2000, `${solids} solids`);
        assert.deepEqual(floating.slice(0, 5), []);
        assert.deepEqual(intersections.slice(0, 5), []);
    } finally {
        setArkWorld("v1");
        setNoHamlet(false);
    }
});

test("v2: the rocks, the colliders and the grass come from the wild island's scenery", () => {
    setArkWorld("v2");
    try {
        const decor = worldDecor();
        const fill = forestFill();
        const rocks = drawnRocks();
        const decorRocks = decor.filter((item) => item.kind === "rock");
        // drawnRocks: every decor rock as L6 draws it, and L6's mountain (crags, boulders, the solid scree) over v2's peaks.
        assert.equal(rocks.filter((rock) => rock.source === "decor").length, decorRocks.filter((item) => rockAssetFor(item)).length);
        assert.ok(rocks.filter((rock) => rock.source === "crag").length > 40, "crags on the mountain");
        assert.ok(decorRocks.some((item) => rockAssetFor(item)!.id.startsWith("gen-")), "the mountain's decor rocks are L6's angular ones");
        assert.ok(allMountainRocks().some((piece) => piece.y > 30), "crags above today's ceiling (v2's snow line is 52 m)");
        // L5's colliders: a trunk for every decor and fill tree as drawn, a box for every drawn rock, the floor's logs.
        const list = colliderSetFor(null).list;
        const count = (kind: string) => list.filter((c) => c.kind === kind).length;
        assert.equal(count("rock"), rocks.length);
        assert.equal(count("log"), floorObstacles().length);
        assert.equal(count("trunk"), [...decor, ...fill].filter((item) => TREE_KINDS.has(item.kind) || item.kind === "canopy").length);
        for (const kind of ["building", "fence", "hay", "pond", "post"]) assert.equal(count(kind), 0, `a ${kind} collider`);
        // The termite mounds are the generator's (and the termites' own while aboard).
        assert.ok(allMounds().length >= wildScenery().filter((item) => item.kind === "mound").length);
        // The floor: the woods' litter and logs, and the generator's ferns, flowers, sedge and grass clumps.
        const floor = floorPlacements();
        assert.ok(floor.some((p) => p.id.startsWith("fern-")) && floor.some((p) => p.id.startsWith("log-")) && floor.some((p) => p.id.startsWith("grass-meadow")));
        // Grass tufts over the island's land: the meadows, the savanna, never in the fresh water.
        const tufts = grassTufts(5000);
        assert.equal(tufts.length, 5000);
        assert.ok(tufts.some((t) => Math.abs(t.x) > 140 || Math.abs(t.z) > 140), "grass beyond today's island");
        for (const t of tufts.slice(0, 500)) assert.ok(((sampleGround(t.x, t.z) as unknown as {fresh: number}).fresh ?? 0) < 0.5, `a tuft in the water at ${t.x.toFixed(1)},${t.z.toFixed(1)}`);
        assert.ok(tufts.filter((t) => t.zone === "grassland").length > tufts.filter((t) => t.zone === "rainforest").length);
    } finally {
        setArkWorld("v1");
        setNoHamlet(false);
    }
});

test("v2: the attach points are the wild island's trees', rocks', logs' and ground's (floors about 15% under the counts)", () => {
    setArkWorld("v2");
    try {
        const points = allAttachPoints();
        const byTag: Record<string, number> = {};
        for (const point of points) byTag[point.tag] = (byTag[point.tag] ?? 0) + 1;
        // (2026-11-12, P3: 20,948 points: leaf 4,896, bark 2,484, branch 3,312, limb 2,882, canopy_hang 1,561, rock_face
        // 1,388, log 1,898, leaf_litter 900, ledge 406, pond_surface 24; floors about 15% under, as decision 131's.)
        assert.ok(points.length > 17800, `${points.length} points`);
        const floors: Record<string, number> = {leaf: 4160, bark: 2110, branch: 2815, limb: 2450, canopy_hang: 1325, rock_face: 1180, log: 1610, leaf_litter: 765, ledge: 345, pond_surface: 20};
        for (const [tag, floor] of Object.entries(floors)) assert.ok((byTag[tag] ?? 0) > floor, `${tag}: ${byTag[tag] ?? 0} (floor ${floor})`);
        // Nothing built: no walls, eaves, lamps, fence posts or roofs.
        for (const tag of ["house_wall", "house_eave", "porch_light", "lamp", "fence_post", "roof_edge"]) assert.ok(!byTag[tag], `a ${tag} point`);
        // Limbs for the large climbers on the wild forests' trees, each with the load it holds.
        const limbs = points.filter((point) => point.tag === "limb");
        const forest = limbs.filter((point) => point.zone === "rainforest" || point.zone === "woodland");
        assert.ok(forest.length > 1000 && new Set(forest.map((point) => point.host)).size > 120, `${forest.length} limbs in the forests`);
        assert.ok(limbs.every((point) => (point.load ?? 0) > 0 && (point.radius ?? 0) >= 0.03));
        // The lake's lily-pad points on its own surface (6 m), over its water.
        for (const point of points.filter((p) => p.tag === "pond_surface")) {
            const ground = sampleGround(point.position.x, point.position.z) as unknown as {height: number; freshLevel: number | null};
            assert.ok(ground.freshLevel !== null && Math.abs(point.position.y - ground.freshLevel - 0.02) < 1e-6 && ground.freshLevel - ground.height >= 0.4, point.id);
        }
        // The rock faces are on v2's rocks (every host a decor rock).
        const decor = worldDecor();
        for (const point of points.filter((p) => p.tag === "rock_face")) assert.equal(decor[Number(point.host.slice(5))].kind, "rock", point.id);
        // The ground's points spread over the island's land, in its zones.
        const ground = points.filter((p) => p.tag === "leaf_litter" || p.tag === "burrow" || p.tag === "worm_hole");
        assert.ok(ground.some((p) => Math.abs(p.position.x) > 120 || Math.abs(p.position.z) > 120));
        assert.ok(ground.every((p) => zoneAt(sampleGround(p.position.x, p.position.z)) === p.zone));
    } finally {
        setArkWorld("v1");
        setNoHamlet(false);
    }
});

test("v2: the scenery worker lays the mountain's rocks and the savanna's mounds too, and the mount takes them as primed (no main-thread build)", () => {
    setArkWorld("v2");
    try {
        const scenery = computeScenery(500, "low");
        assert.ok(scenery.mountain && scenery.mounds, "the v2 prebuild carries the mountain and the mounds");
        // What the worker posts is a structured clone: the mount's modules take the copy and build nothing themselves.
        const copy = structuredClone({mountain: scenery.mountain, mounds: scenery.mounds, decor: scenery.decor, fill: scenery.fill, rocks: scenery.rocks, trees: scenery.trees});
        assert.deepEqual(copy.mountain, mountainRocks());
        assert.deepEqual(copy.mounds, savannaMounds());
        assert.deepEqual(copy.rocks, worldDecor().map((item) => rockAssetFor(item)));
        assert.deepEqual(copy.trees, {decor: worldDecor().map((item) => assetTreePlacement(item)), fill: forestFill().map((item) => assetTreePlacement(item))});
        applyArkPrebuild({...copy, grass: scenery.grass}, null);
        assert.equal(mountainRocks(), copy.mountain);
        assert.equal(savannaMounds(), copy.mounds);
        // Each decor rock's placement is the worker's, shared by every reader (no seating on the main thread).
        assert.equal(worldDecor(), copy.decor);
        copy.decor.forEach((item, i) => assert.equal(rockAssetFor(item), copy.rocks![i]));
        // And each tree's (no seating on the main thread either).
        assert.equal(forestFill(), copy.fill);
        copy.decor.forEach((item, i) => assert.equal(assetTreePlacement(item), copy.trees!.decor[i]));
        copy.fill.forEach((item, i) => assert.equal(assetTreePlacement(item), copy.trees!.fill[i]));
    } finally {
        setArkWorld("v1");
        setNoHamlet(false);
    }
    // Today's world: the prebuild is as it was (no mountain, no mounds in it).
    const today = computeScenery(500, "low");
    assert.equal(today.mountain, undefined);
    assert.equal(today.mounds, undefined);
});
