/**
 * The bigger wild island's frame in the one world (P6, docs/ark/wild-island.md §8): `ARK_ISLANDS` per world, the town
 * across the strait from the v2 island, and the default views (`islands/views.ts`, the scene's homeView) on desktop
 * and the upright phone: what they frame, and what Part B's streamer draws from them on every tier.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {Fog, PerspectiveCamera, Vector3} from "three";
import {arkWorld, setArkWorld} from "@/ark-scene/world";
import {ARK_ISLANDS, bearingBetween, TOWN_REACH, townWorldOrigin, wildReachNow} from "@/ark-scene/islands";
import {viewEye, wildFrame, wildHomeView, type WildHomeView} from "@/ark-scene/islands/views";
import {ArkStreamer, spansFromHeights} from "@/ark-scene/streaming";
import {chunkCount} from "@/ark-scene/streaming/chunks";
import type {StreamTierName} from "@/ark-scene/streaming/tiers";
import {hazeFog} from "@/ark-scene/streaming/haze";

const FOV = 38;
/** The screens the views are checked on: the probe's desktop canvas, 16:10 and 16:9; upright phones' canvases (the page's own on a 390 × 844 phone is 390 × 557). */
const DESKTOP = [1.6, 1072 / 604, 16 / 9];
const PHONE = [360 / 800, 390 / 844, 390 / 700, 390 / 557];

test("frame: v1's records are today's (the town at 508.6, -210.7)", () => {
    assert.equal(arkWorld(), "v1");
    assert.deepEqual(ARK_ISLANDS.wild, {id: "wild", half: 132, chunks: 5, landHa: 2.38, archipelago: {x: 0, z: 0}, home: {target: [0, 0, 0], eye: [0, 160, 300]}});
    assert.deepEqual(ARK_ISLANDS.town.archipelago, {x: 508.6, z: -210.7});
    assert.equal(wildFrame().reach, 340);
    assert.equal(wildFrame().reachIslands, 900);
    // v1's default views as they were (the probe's 1072 × 604 canvas, with the town).
    const view = wildHomeView(1072 / 604, FOV, ARK_ISLANDS.town.archipelago);
    assert.ok(Math.abs(view.target.x - (12 + (508.6 / Math.hypot(508.6, 210.7)) * 45)) < 1e-9);
    assert.equal(view.polar, 1.15);
});

/** A view's camera (three's own projection), for what lands inside the picture. */
function cameraFor(view: WildHomeView, aspect: number): PerspectiveCamera {
    const camera = new PerspectiveCamera(FOV, aspect, 0.4, 9000);
    const eye = viewEye(view);
    camera.position.set(eye.x, eye.y, eye.z);
    camera.lookAt(view.target.x, view.target.y, view.target.z);
    camera.updateMatrixWorld(true);
    return camera;
}

/** Where a world point lands on the picture (−1…1 across and up), or null behind the camera. */
function onScreen(camera: PerspectiveCamera, x: number, y: number, z: number): {x: number; y: number} | null {
    const p = new Vector3(x, y, z).project(camera);
    return p.z < 1 ? {x: p.x, y: p.y} : null;
}

let wildCoast: Array<{x: number; z: number}> = [];

test("frame: v2's records follow the switch (half 264, 10 × 10 chunks, the town 651 m out with the strait 250 m)", async () => {
    setArkWorld("v2");
    const {wildReachToward} = await import("@/ark-scene/islands/wild/index");
    assert.deepEqual({half: ARK_ISLANDS.wild.half, chunks: ARK_ISLANDS.wild.chunks, landHa: ARK_ISLANDS.wild.landHa}, {half: 264, chunks: 10, landHa: 11.9});
    const reach = wildReachNow();
    assert.ok(Math.abs(reach - 190.5) < 0.6, `reach ${reach}`);
    const origin = townWorldOrigin();
    assert.deepEqual(ARK_ISLANDS.town.archipelago, origin);
    assert.ok(Math.abs(Math.hypot(origin.x, origin.z) - (reach + 250 + TOWN_REACH)) < 0.2);
    assert.ok(Math.abs(bearingBetween("wild", "town") - (-22.5 * Math.PI) / 180) < 1e-3);
    assert.equal(wildFrame().reach, 1000);
    assert.equal(wildFrame().reachIslands, 1000);
    // The coast every 5° (for the views below).
    wildCoast = Array.from({length: 72}, (_, k) => {
        const a = (k / 72) * Math.PI * 2;
        const r = wildReachToward(a);
        return {x: Math.cos(a) * r, z: Math.sin(a) * r};
    });
});

test("frame: v2's desktop default view holds the whole island and the town's land, the town upper right", () => {
    assert.equal(arkWorld(), "v2");
    const town = townWorldOrigin();
    for (const aspect of DESKTOP) {
        const view = wildHomeView(aspect, FOV, town);
        const camera = cameraFor(view, aspect);
        for (const p of wildCoast) {
            const s = onScreen(camera, p.x, 0, p.z);
            assert.ok(s && Math.abs(s.x) < 0.97 && Math.abs(s.y) < 0.97, `aspect ${aspect.toFixed(2)}: the coast at ${p.x.toFixed(0)}, ${p.z.toFixed(0)} → ${JSON.stringify(s)}`);
        }
        // The town's land (its middle, and its reach each way) in the picture, its middle in the upper right.
        const middle = onScreen(camera, town.x, 0, town.z)!;
        assert.ok(middle.x > 0.2 && middle.y > 0.3, `aspect ${aspect.toFixed(2)}: the town's middle at ${JSON.stringify(middle)}`);
        for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const s = onScreen(camera, town.x + dx * TOWN_REACH * 0.9, 0, town.z + dz * TOWN_REACH * 0.6);
            assert.ok(s && Math.abs(s.x) < 1 && Math.abs(s.y) < 1, `aspect ${aspect.toFixed(2)}: the town's land ${dx}, ${dz} → ${JSON.stringify(s)}`);
        }
    }
});

test("frame: v2's upright phone view looks across the strait: the island the subject in the middle, the town above it", () => {
    const town = townWorldOrigin();
    for (const aspect of PHONE) {
        const view = wildHomeView(aspect, FOV, town);
        const camera = cameraFor(view, aspect);
        // Straight across the strait: the town's middle on the picture's middle line, in its upper part.
        const middle = onScreen(camera, town.x, 0, town.z)!;
        assert.ok(Math.abs(middle.x) < 0.05 && middle.y > 0.3 && middle.y < 0.95, `aspect ${aspect.toFixed(2)}: the town at ${JSON.stringify(middle)}`);
        // The island fills the lower part: its middle below the town, and most of its coast in the picture.
        const wild = onScreen(camera, -10, 0, 0)!;
        assert.ok(wild.y < middle.y - 0.3 && Math.abs(wild.x) < 0.3, `aspect ${aspect.toFixed(2)}: the island's middle at ${JSON.stringify(wild)}`);
        const inside = wildCoast.filter((p) => {
            const s = onScreen(camera, p.x, 0, p.z);
            return s && Math.abs(s.x) <= 1 && Math.abs(s.y) <= 1;
        }).length;
        assert.ok(inside / wildCoast.length >= PHONE_COAST_SHARE, `aspect ${aspect.toFixed(2)}: ${inside}/${wildCoast.length} of the coast in the picture`);
    }
});

/** The share of the island's coast an upright phone's default view holds (it fills the width; the far tips fall outside). */
const PHONE_COAST_SHARE = 0.45;

/** Both v2 islands on Part B's streamer, as the scene registers them (the wild island's own grid and spans). */
async function twoIslands(tier: StreamTierName) {
    const {WILD_GRID} = await import("@/ark-scene/islands/wild/frame");
    const {wildGroundArrays} = await import("@/ark-scene/islands/wild/render/ground");
    const {TOWN_GRID} = await import("@/ark-scene/islands/town/chunks");
    const arrays = spansCache ?? (spansCache = (() => {
        const a = wildGroundArrays();
        const heights = new Float32Array(a.size * a.size).map((_, i) => a.positions[i * 3 + 1]);
        return spansFromHeights(WILD_GRID, heights, a.size, 30);
    })());
    const content = new Uint8Array(chunkCount(WILD_GRID)).fill(1);
    const haze = hazeFog(new Fog(0xffffff, 420, 1700));
    const streamer = new ArkStreamer({grid: WILD_GRID, spans: arrays, content, tier, haze});
    const townSpans = Array.from({length: chunkCount(TOWN_GRID)}, () => ({minY: -4, maxY: 30}));
    streamer.registerIsland({id: "wild", offset: {x: 0, z: 0}, reach: wildReachNow(), grid: WILD_GRID, spans: arrays, content});
    streamer.registerIsland({id: "town", offset: townWorldOrigin(), reach: TOWN_REACH, grid: TOWN_GRID, spans: townSpans, content: new Uint8Array(chunkCount(TOWN_GRID)).fill(1)});
    return streamer;
}
let spansCache: ReturnType<typeof spansFromHeights> | null = null;

test("frame: v2 opens on the two-island view (the town's place is known before it is built)", () => {
    for (const aspect of [...DESKTOP, ...PHONE]) assert.deepEqual(wildHomeView(aspect, FOV, null), wildHomeView(aspect, FOV, townWorldOrigin()));
});

test("frame: from v2's default views no chunk of either island is out or hazed, on every tier", async () => {
    const town = townWorldOrigin();
    for (const tier of ["high", "medium", "low"] as StreamTierName[]) {
        for (const aspect of [...DESKTOP, ...PHONE]) {
            const streamer = await twoIslands(tier);
            const view = wildHomeView(aspect, FOV, town);
            const eye = viewEye(view);
            for (let t = 0; t < 2; t += 0.1) streamer.update(eye, view.distance, FOV, aspect, t, {x: view.target.x, z: view.target.z});
            const stats = streamer.stats();
            assert.equal(stats.active, "wild", `${tier} ${aspect.toFixed(2)}`);
            assert.equal(stats.islands.wild.out, 0, `${tier} ${aspect.toFixed(2)} wild ${JSON.stringify(stats.islands.wild)}`);
            assert.equal(stats.islands.town.out, 0, `${tier} ${aspect.toFixed(2)} town ${JSON.stringify(stats.islands.town)}`);
            assert.equal(stats.haze, 0, `${tier} ${aspect.toFixed(2)}`);
        }
    }
});
