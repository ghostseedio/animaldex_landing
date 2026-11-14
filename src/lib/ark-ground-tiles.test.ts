import assert from "node:assert/strict";
import test from "node:test";
import {MeshBasicMaterial, type Mesh} from "three";
import {chunkCount, chunkGridFor, STATE_IN, STATE_MAP, STATE_OUT} from "@/ark-scene/streaming/chunks";
import {GroundTiles} from "@/ark-scene/streaming/ground-tiles";
import type {GroundArrays} from "@/ark-scene/terrain";

/** A flat ground of `segments` × `segments` squares, 4 chunks a side. */
function ground(segments = 32) {
    const size = segments + 1;
    const count = size * size;
    const arrays = {
        size,
        positions: new Float32Array(count * 3),
        normals: new Float32Array(count * 3),
        uvs: new Float32Array(count * 2),
        index: new Uint32Array(0),
        colors: new Float32Array(count * 3),
        layers: new Float32Array(count * 4),
        layers2: new Float32Array(count * 4),
        rock: new Float32Array(count * 3),
        depth: new Uint8Array(0)
    } as GroundArrays;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) arrays.positions.set([c - segments / 2, 0, r - segments / 2], (r * size + c) * 3);
    const grid = chunkGridFor(segments / 2, segments, 8);
    return {arrays, grid, tiles: new GroundTiles(arrays, grid, new MeshBasicMaterial(), segments)};
}
const vertices = (mesh: Mesh) => mesh.geometry.getAttribute("position")?.count ?? 0;

test("ground tiles: a recording builds every tile coming in at once; a live view two a frame, nearest first, the rest as the map meanwhile", () => {
    const {grid, tiles} = ground();
    const meshes = tiles.group.children as Mesh[];
    const n = chunkCount(grid);
    assert.equal(meshes.length, n);
    const fullCount = vertices(meshes[0]);
    const all = (state: number) => new Uint8Array(n).fill(state);
    // Out, their geometry let go; then all back in.
    tiles.apply(all(STATE_OUT), 0);
    tiles.release(100);
    assert.ok(meshes.every((mesh) => !mesh.visible && vertices(mesh) === 0));
    tiles.apply(all(STATE_IN), 100);
    assert.ok(meshes.every((mesh) => mesh.visible && vertices(mesh) === fullCount), "all at once (spread 0)");

    // The same in a live view.
    tiles.apply(all(STATE_OUT), 200);
    tiles.release(300);
    tiles.spread = 2;
    tiles.apply(all(STATE_IN), 300);
    const coarse = vertices(meshes[0]);
    assert.ok(coarse > 0 && coarse < fullCount / 2, "drawn as the map first: no hole in the ground");
    assert.ok(meshes.every((mesh) => mesh.visible && vertices(mesh) === coarse));
    // What the camera looks at: the far corner's tile. It and its nearest neighbour come first.
    const focus = {x: grid.originX + grid.size * (grid.columns - 0.5), z: grid.originZ + grid.size * (grid.rows - 0.5)};
    tiles.release(300.016, focus);
    const fullNow = () => meshes.map((mesh, i) => (vertices(mesh) === fullCount ? i : -1)).filter((i) => i >= 0);
    assert.equal(fullNow().length, 2);
    assert.ok(fullNow().includes(n - 1), `the tile looked at first: ${fullNow()}`);
    for (let frame = 2; frame <= n / 2; frame++) tiles.release(300 + frame * 0.016, focus);
    assert.equal(fullNow().length, n, "all in full after n / 2 frames");
    // The same triangles as the recording's: nothing waits, and a still-wanted coarse level is not let go under a waiting tile.
    tiles.apply(all(STATE_MAP), 400);
    tiles.apply(all(STATE_IN), 401);
    assert.ok(meshes.every((mesh) => vertices(mesh) === fullCount), "kept levels come back at once");
    // A tile that left again before its turn is not built.
    tiles.apply(all(STATE_OUT), 500);
    tiles.release(600);
    tiles.apply(all(STATE_IN), 600);
    const states = all(STATE_IN);
    states[0] = STATE_MAP;
    tiles.apply(states, 600.1);
    for (let frame = 1; frame <= n; frame++) tiles.release(600.1 + frame * 0.016, focus);
    assert.equal(vertices(meshes[0]), coarse);
    assert.equal(fullNow().length, n - 1);
    // Long after, a waiting tile's map level is still there to draw (never the empty stand-in).
    tiles.apply(all(STATE_OUT), 700);
    tiles.release(800);
    tiles.apply(all(STATE_IN), 800);
    tiles.spread = 1;
    tiles.release(900, focus);
    assert.ok(meshes.every((mesh) => vertices(mesh) > 0));
});
