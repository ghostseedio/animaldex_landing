import assert from "node:assert/strict";
import test from "node:test";
import {Fog, InstancedBufferAttribute, InstancedMesh, BoxGeometry, MeshBasicMaterial, Matrix4} from "three";
import {
    chunkCount,
    chunkGridFor,
    chunkOf,
    chunkRect,
    chunkStates,
    farthestContent,
    hazeStrength,
    STATE_IN,
    STATE_MAP,
    STATE_OUT,
    tileRange,
    type ChunkSpan
} from "@/ark-scene/streaming/chunks";
import {ArkStreamer, spansFromHeights} from "@/ark-scene/streaming";
import {ARK_STREAM_TIERS, chooseTier, heapBudgetMB, MIN_RENDER_SCALE, stepRenderScale, type StreamTierName} from "@/ark-scene/streaming/tiers";
import {hazeEndDepth, hazeFog} from "@/ark-scene/streaming/haze";
import {ChunkedInstances} from "@/ark-scene/streaming/instances";
import {tileGeometry, MAP_STRIDE} from "@/ark-scene/streaming/ground-tiles";
import {groundArrays, groundGeometry, GROUND_SEGMENTS} from "@/ark-scene/terrain";
import {heightAt, TERRAIN_HALF, WORLD_RADIUS} from "@/ark-scene/world";

const grid = chunkGridFor(TERRAIN_HALF, GROUND_SEGMENTS);
const arrays = groundArrays();
const heights = new Float32Array(arrays.size * arrays.size).map((_, i) => arrays.positions[i * 3 + 1]);
const spans = spansFromHeights(grid, heights, arrays.size, 30);

test("streaming: the chunk grid is the ground's own (5 × 5 chunks of 48 segments, 52.8 m)", () => {
    assert.equal(grid.columns, 5);
    assert.equal(grid.rows, 5);
    assert.ok(Math.abs(grid.size - 52.8) < 1e-9);
    assert.equal(chunkOf(grid, -TERRAIN_HALF, -TERRAIN_HALF), 0);
    assert.equal(chunkOf(grid, TERRAIN_HALF - 0.01, TERRAIN_HALF - 0.01), 24);
    // Off the grid (a sea animal far out): the nearest edge chunk.
    assert.equal(chunkOf(grid, -900, 0), chunkOf(grid, -TERRAIN_HALF, 0));
    assert.equal(chunkOf(grid, 0, 900), chunkOf(grid, 0, TERRAIN_HALF - 1));
    for (let key = 0; key < chunkCount(grid); key++) {
        const [minX, minZ, maxX, maxZ] = chunkRect(grid, key);
        assert.equal(chunkOf(grid, (minX + maxX) / 2, (minZ + maxZ) / 2), key);
    }
});

test("streaming: the tiles cover the ground's grid, neighbours sharing their edge vertices", () => {
    const covered = new Uint8Array(GROUND_SEGMENTS * GROUND_SEGMENTS);
    for (let key = 0; key < chunkCount(grid); key++) {
        const r = tileRange(grid, key, GROUND_SEGMENTS);
        for (let row = r.row0; row < r.row1; row++) for (let column = r.col0; column < r.col1; column++) covered[row * GROUND_SEGMENTS + column]++;
    }
    assert.ok(covered.every((n) => n === 1), "every cell in exactly one tile");
});

test("streaming: the tiled ground is the whole ground (the same triangles, vertices and attributes)", () => {
    const whole = groundGeometry().geometry;
    const key = (a: ArrayLike<number>, i: number) => `${a[i * 3]},${a[i * 3 + 1]},${a[i * 3 + 2]}`;
    const triangles = (positions: ArrayLike<number>, index: ArrayLike<number>) => {
        const out: string[] = [];
        for (let t = 0; t < index.length; t += 3) out.push(`${key(positions, index[t])}|${key(positions, index[t + 1])}|${key(positions, index[t + 2])}`);
        return out;
    };
    const expected = triangles(whole.getAttribute("position").array, whole.getIndex()!.array).sort();
    const got: string[] = [];
    const attributes = ["normal", "uv", "color", "arkLayers", "arkLayers2", "arkRock"];
    const byPosition = new Map<string, number>();
    const wholePositions = whole.getAttribute("position").array;
    for (let i = 0; i < whole.getAttribute("position").count; i++) byPosition.set(key(wholePositions, i), i);
    for (let k = 0; k < chunkCount(grid); k++) {
        const tile = tileGeometry(arrays, tileRange(grid, k, GROUND_SEGMENTS), 1);
        const positions = tile.getAttribute("position").array;
        got.push(...triangles(positions, tile.getIndex()!.array));
        // Every vertex carries the whole ground's attributes for that vertex.
        for (let i = 0; i < tile.getAttribute("position").count; i++) {
            const j = byPosition.get(key(positions, i));
            assert.ok(j !== undefined, "a tile vertex is a ground vertex");
            for (const name of attributes) {
                const a = tile.getAttribute(name);
                const b = whole.getAttribute(name);
                for (let c = 0; c < a.itemSize; c++) assert.equal(a.array[i * a.itemSize + c], b.array[j! * b.itemSize + c], name);
            }
        }
    }
    assert.deepEqual(got.sort(), expected);
});

test("streaming: a map tile is every 4th vertex with a skirt, on the ground's own heights", () => {
    const tile = tileGeometry(arrays, tileRange(grid, 12, GROUND_SEGMENTS), MAP_STRIDE);
    const position = tile.getAttribute("position");
    const across = GROUND_SEGMENTS / grid.columns / MAP_STRIDE + 1;
    assert.equal(position.count, across * across + 4 * across);
    for (let i = 0; i < across * across; i++) assert.ok(Math.abs(position.getY(i) - heightAt(position.getX(i), position.getZ(i))) < 0.5);
});

test("streaming: states by distance, with hysteresis, map and out", () => {
    const flat: ChunkSpan[] = Array.from({length: chunkCount(grid)}, () => ({minY: 0, maxY: 0}));
    const eye = {x: -TERRAIN_HALF - 100, y: 0, z: 0};
    const first = chunkStates(grid, flat, {...eye, distance: 150, hysteresis: 20, map: false}, null);
    // Columns 0 (100 m off) and 1 (152.8 m off) of the middle row: in, out.
    assert.equal(first[2 * 5], STATE_IN);
    assert.equal(first[2 * 5 + 1], STATE_OUT);
    // Moved 10 m away: column 0 is 110 m off, still in; column 0 at 165 m stays in (hysteresis), at 175 m goes.
    const kept = chunkStates(grid, flat, {...eye, x: eye.x - 65, distance: 150, hysteresis: 20, map: false}, first);
    assert.equal(kept[2 * 5], STATE_IN);
    const gone = chunkStates(grid, flat, {...eye, x: eye.x - 75, distance: 150, hysteresis: 20, map: true}, kept);
    assert.equal(gone[2 * 5], STATE_MAP);
    // Never in without having been within the distance itself.
    const fresh = chunkStates(grid, flat, {...eye, x: eye.x - 65, distance: 150, hysteresis: 20, map: false}, null);
    assert.equal(fresh[2 * 5], STATE_OUT);
});

test("streaming: the haze is on only while content lies past the distance, ramped, never in the map view", () => {
    assert.equal(hazeStrength(500, 640, false), 0);
    assert.equal(hazeStrength(640, 640, false), 1);
    assert.ok(hazeStrength(630, 640, false) > 0 && hazeStrength(630, 640, false) < 1);
    assert.equal(hazeStrength(2000, 640, true), 0);
});

test("streaming: today's island lies inside the medium and high distances from every view the camera can take", () => {
    // Every chunk counts as content (the strictest test: sea animals can live in any of them).
    const content = new Uint8Array(chunkCount(grid)).fill(1);
    for (const tier of ["medium", "high"] as StreamTierName[]) {
        const t = ARK_STREAM_TIERS[tier];
        for (let tx = -WORLD_RADIUS; tx <= WORLD_RADIUS; tx += 40) {
            for (let tz = -WORLD_RADIUS; tz <= WORLD_RADIUS; tz += 40) {
                if (Math.hypot(tx, tz) > WORLD_RADIUS) continue;
                for (const distance of [4, 40, 150, 340]) {
                    for (const polar of [0.12, 0.7, 1.06, 1.36]) {
                        for (let a = 0; a < 8; a++) {
                            const azimuth = (a / 8) * Math.PI * 2;
                            const eye = {x: tx + distance * Math.sin(polar) * Math.sin(azimuth), y: Math.max(heightAt(tx, tz), 0) + distance * Math.cos(polar), z: tz + distance * Math.sin(polar) * Math.cos(azimuth)};
                            const states = chunkStates(grid, spans, {...eye, distance: t.renderDistance, hysteresis: t.hysteresis, map: distance >= 150}, null);
                            assert.ok(states.every((s) => s === STATE_IN), `${tier}: every chunk in from ${JSON.stringify(eye)}`);
                            assert.equal(hazeStrength(farthestContent(grid, spans, content, eye.x, eye.y, eye.z), t.renderDistance, distance >= 150), 0, `${tier}: no haze from ${JSON.stringify(eye)}`);
                        }
                    }
                }
            }
        }
    }
});

test("streaming: the island's home views are whole on the low tier too (desktop and phone)", () => {
    const t = ARK_STREAM_TIERS.low;
    // The scene's home views (index.ts homeView): 800×500 and 360×800.
    for (const eye of [{x: 12, y: 108.5, z: 207.4}, {x: 16, y: 156.6, z: 302.6}]) {
        const states = chunkStates(grid, spans, {...eye, distance: t.renderDistance, hysteresis: t.hysteresis, map: true}, null);
        assert.ok(states.every((s) => s === STATE_IN), JSON.stringify(eye));
    }
});

test("streaming: the tier from what the device says", () => {
    assert.equal(chooseTier({coarse: false, cores: 16, memoryGB: 8, heapLimitMB: 4096}), "high");
    // The measure script's phone: 8 cores, 4 GB, touch.
    assert.equal(chooseTier({coarse: true, cores: 8, memoryGB: 4, heapLimitMB: 512}), "medium");
    // A 2 GB phone: low whatever the cores; the app's figure counts the same.
    assert.equal(chooseTier({coarse: true, cores: 8, memoryGB: 2, heapLimitMB: null}), "low");
    assert.equal(chooseTier({coarse: false, cores: 16, memoryGB: 2, heapLimitMB: null}), "low");
    // 3 GB: low on touch, at most medium otherwise.
    assert.equal(chooseTier({coarse: true, cores: 8, memoryGB: 3, heapLimitMB: null}), "low");
    assert.equal(chooseTier({coarse: false, cores: 16, memoryGB: 3, heapLimitMB: null}), "medium");
    // iOS says nothing of its memory: six cores is medium, four is low.
    assert.equal(chooseTier({coarse: true, cores: 6, memoryGB: null, heapLimitMB: null}), "medium");
    assert.equal(chooseTier({coarse: true, cores: 4, memoryGB: null, heapLimitMB: null}), "low");
    // The heap budget is never over half the heap's own limit.
    assert.equal(heapBudgetMB(ARK_STREAM_TIERS.medium, 512), 256);
    assert.equal(heapBudgetMB(ARK_STREAM_TIERS.medium, null), ARK_STREAM_TIERS.medium.memory.heapMB);
});

test("streaming: memory pressure pulls the distance in, to a floor, then asks for a lower tier; calm lets it out", () => {
    const tier = ARK_STREAM_TIERS.medium;
    let state = {scale: 1, calmFor: 0, drop: false};
    state = stepRenderScale(state.scale, {heapMB: 600, gpuMB: 10}, tier, 0);
    assert.ok(Math.abs(state.scale - 0.85) < 1e-9);
    for (let i = 0; i < 5; i++) state = stepRenderScale(state.scale, {heapMB: 10, gpuMB: 400}, tier, 0);
    assert.equal(state.scale, MIN_RENDER_SCALE);
    assert.equal(state.drop, true);
    state = stepRenderScale(state.scale, {heapMB: 10, gpuMB: 10}, tier, 10);
    assert.equal(state.scale, MIN_RENDER_SCALE);
    state = stepRenderScale(state.scale, {heapMB: 10, gpuMB: 10}, tier, 31);
    assert.ok(state.scale > MIN_RENDER_SCALE);
});

test("streaming: the haze leaves the fog as it was while off, and pulls it in when on", () => {
    const fog = new Fog(0xffffff, 420, 1700);
    const haze = hazeFog(fog);
    assert.equal(fog.near, 420);
    assert.equal(fog.far, 1700);
    haze.set(300, 500, 0);
    assert.equal(fog.near, 420);
    assert.equal(fog.far, 1700);
    haze.set(300, 500, 1);
    assert.equal(fog.near, 300);
    assert.equal(fog.far, 500);
    // The weather sets the base (rain closes in nearer than the haze): the nearer wins.
    fog.near = 8;
    fog.far = 170;
    assert.equal(fog.near, 8);
    assert.equal(fog.far, 170);
    haze.set(300, 500, 0);
    assert.equal(fog.far, 170);
    // Easing in: never nearer than the end at full strength, continuous from the base.
    fog.near = 420;
    fog.far = 1700;
    haze.set(300, 500, 0.01);
    assert.equal(fog.far, 1700);
    // A point at the distance is past the haze's end anywhere in the picture.
    assert.ok(hazeEndDepth(640, 38, 1.6) < 640 * Math.cos((19 * Math.PI) / 180));
});

test("streaming: a chunked mesh is exactly as built while every chunk is drawn, and keeps order and prefix when not", () => {
    const n = 200;
    const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), n);
    const tint = new Float32Array(n * 3);
    const m = new Matrix4();
    for (let i = 0; i < n; i++) {
        // Spread along x across the grid: instance i in column floor(i / 40).
        m.makeTranslation(-TERRAIN_HALF + (i + 0.5) * ((TERRAIN_HALF * 2) / n), 0, 0);
        mesh.setMatrixAt(i, m);
        tint[i * 3] = i;
    }
    mesh.geometry.setAttribute("arkTint", new InstancedBufferAttribute(tint, 3));
    const built = (mesh.instanceMatrix.array as Float32Array).slice();
    const chunked = new ChunkedInstances(mesh, grid, n, n, ["arkTint"]);
    chunked.setLimit(150);
    assert.equal(mesh.count, 150);
    // Column 1 out: its instances go, the rest keep their order.
    chunked.setDrawn((chunk) => chunk % 5 !== 1);
    const kept = Array.from({length: 150}, (_, i) => i).filter((i) => Math.floor(i / 40) !== 1);
    assert.equal(mesh.count, kept.length);
    const tints = mesh.geometry.getAttribute("arkTint").array;
    kept.forEach((i, k) => assert.equal(tints[k * 3], i));
    // Every chunk drawn again: byte for byte as built, the tier's prefix.
    chunked.setDrawn(() => true);
    assert.deepEqual(mesh.instanceMatrix.array, built);
    assert.equal(mesh.count, 150);
    chunked.setDrawn(null);
    assert.equal(mesh.count, 150);
});

test("streaming: the streamer leaves everything in from the home view and hides far chunks when the distance is small", () => {
    const content = new Uint8Array(chunkCount(grid)).fill(1);
    const fog = new Fog(0xffffff, 420, 1700);
    const streamer = new ArkStreamer({grid, spans, content, tier: "medium", haze: hazeFog(fog)});
    streamer.update({x: 16, y: 156.6, z: 302.6}, 320, 38, 0.45, 0);
    assert.equal(streamer.allIn, true);
    assert.equal(fog.far, 1700);
    // A close view at the island's south-east, a 60 m distance forced: the far chunks are out and the haze comes on.
    (globalThis as {__arkRenderDistance?: number}).__arkRenderDistance = 60;
    try {
        streamer.update({x: 90, y: 12, z: 90}, 20, 38, 1.6, 1);
        for (let t = 1; t < 3; t += 0.1) streamer.update({x: 90, y: 12, z: 90}, 20, 38, 1.6, t);
        assert.equal(streamer.allIn, false);
        assert.equal(streamer.stateAt(-100, -100), STATE_OUT);
        assert.equal(streamer.stateAt(90, 90), STATE_IN);
        assert.ok(fog.far < 60, `haze whole by the distance (fog far ${fog.far})`);
    } finally {
        delete (globalThis as {__arkRenderDistance?: number}).__arkRenderDistance;
    }
});

test("streaming: the far-model pack reads back what was written, by kind and version", async () => {
    const {parseArkPack, writeArkPack} = await import("@/ark-scene/streaming/pack");
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([9, 8, 7]);
    const bytes = writeArkPack("medium", 256, [
        {slug: "red-fox", version: "abc", glb: a},
        {slug: "zebra", version: "def", glb: b}
    ]);
    const pack = parseArkPack(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    assert.equal(pack.header.tier, "medium");
    assert.equal(pack.header.far, 256);
    assert.deepEqual(new Uint8Array(pack.glb("red-fox", "abc")!), a);
    assert.deepEqual(new Uint8Array(pack.glb("zebra", "def")!), b);
    // Another version (the manifest moved on): not from the pack.
    assert.equal(pack.glb("zebra", "xyz"), null);
    assert.equal(pack.glb("lion", "abc"), null);
    assert.throws(() => parseArkPack(new ArrayBuffer(16)));
});

test("streaming: true scale past the render distance — a 25 m whale keeps its model from the map view, a 7.5 mm beetle is a marker", async () => {
    const {keepsModelBeyond, screenPixelsAt, MAP_MODEL_PIXELS} = await import("@/ark-scene/streaming/tiers");
    // A phone held upright (800 CSS px tall), the scene's 38° field of view.
    for (const tier of ["high", "medium", "low"] as StreamTierName[]) {
        const R = ARK_STREAM_TIERS[tier].renderDistance;
        // At the render distance and at three times it (a Part C island seen whole), the whale is tens of pixels long.
        assert.ok(screenPixelsAt(25, R, 800, 38) > 25, `${tier}: whale at ${R} m`);
        assert.equal(keepsModelBeyond(25, R * 3, 800, 38), true, `${tier}: whale at ${R * 3} m`);
        // A beetle is under a pixel long anywhere near the distance: its marker, never a model.
        assert.equal(keepsModelBeyond(0.0075, R, 800, 38), false);
        assert.equal(keepsModelBeyond(0.0075, 2, 800, 38), false);
    }
    // Where the beetle's own size reaches MAP_MODEL_PIXELS: about 1.5 m off (inside every distance, where L4's own rules decide).
    assert.ok(screenPixelsAt(0.0075, 1.4, 800, 38) > MAP_MODEL_PIXELS && screenPixelsAt(0.0075, 1.6, 800, 38) < MAP_MODEL_PIXELS);
});
