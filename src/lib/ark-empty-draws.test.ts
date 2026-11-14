import assert from "node:assert/strict";
import test from "node:test";
import {BufferGeometry, Float32BufferAttribute, InstancedMesh, Mesh, MeshBasicMaterial, Points, PointsMaterial} from "three";
import {emptyDraw, skipEmptyDraws} from "@/ark-scene/runtime/empty-draws";

// No draw call with nothing to draw (the Android web view's `RENDER WARNING: Render count or primcount is 0.`).

const triangles = (count: number) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(count * 9), 3));
    return geometry;
};

test("empty draws: an empty draw range, no instance, nothing visible in a batch, an empty group", () => {
    const sparks = triangles(300);
    const points = new Points(sparks, new PointsMaterial());
    assert.equal(emptyDraw(sparks, points, null), false, "the whole of it");
    sparks.setDrawRange(0, 0);
    assert.equal(emptyDraw(sparks, points, null), true, "the recipes' sparks with none alive");
    sparks.setDrawRange(0, 12);
    assert.equal(emptyDraw(sparks, points, null), false);
    sparks.setDrawRange(900, 12);
    assert.equal(emptyDraw(sparks, points, null), true, "a range past the end");

    const indexed = triangles(4);
    indexed.setIndex([0, 1, 2, 3, 4, 5]);
    assert.equal(emptyDraw(indexed, new Mesh(indexed), null), false);
    assert.equal(emptyDraw(indexed, new Mesh(indexed), {start: 0, count: 0}), true, "a material group of nothing");
    assert.equal(emptyDraw(indexed, new Mesh(indexed), {start: 3, count: 3}), false);
    indexed.setIndex([]);
    assert.equal(emptyDraw(indexed, new Mesh(indexed), null), true, "no index entries");

    const herd = new InstancedMesh(triangles(2), new MeshBasicMaterial(), 8);
    assert.equal(emptyDraw(herd.geometry, herd, null), false);
    herd.count = 0;
    assert.equal(emptyDraw(herd.geometry, herd, null), true, "no instance");

    assert.equal(emptyDraw(triangles(2), {isBatchedMesh: true, _multiDrawCount: 0}, null), true, "nothing visible in the batch");
    assert.equal(emptyDraw(triangles(2), {isBatchedMesh: true, _multiDrawCount: 3}, null), false);
    assert.equal(emptyDraw(new BufferGeometry(), new Mesh(), null), false, "no positions at all: three's own early return, left to it");
    assert.equal(emptyDraw(null, null), false);
});

test("empty draws: the renderer's draw is left out, the others go through as they were", () => {
    const calls: unknown[][] = [];
    const renderer = {
        renderBufferDirect(...args: unknown[]) {
            assert.equal(this, renderer, "called as the renderer's own");
            calls.push(args);
        }
    };
    const skipped = skipEmptyDraws(renderer);
    const full = triangles(2);
    const empty = triangles(2);
    empty.setDrawRange(0, 0);
    const draw = renderer.renderBufferDirect as (...args: unknown[]) => void;
    draw.call(renderer, "camera", "scene", full, "material", new Mesh(full), null);
    draw.call(renderer, "camera", "scene", empty, "material", new Mesh(empty), null);
    draw.call(renderer, "camera", null, full, "depth", new Mesh(full), null);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].slice(0, 2), ["camera", "scene"]);
    assert.equal(skipped(), 1);
    // Wrapped again by another (the shader hold): both still apply.
    const inner = renderer.renderBufferDirect as (...args: unknown[]) => void;
    let seen = 0;
    renderer.renderBufferDirect = function (this: unknown, ...args: unknown[]) {
        seen++;
        inner.apply(this, args);
    };
    (renderer.renderBufferDirect as (...args: unknown[]) => void).call(renderer, "camera", "scene", empty, "material", new Mesh(empty), null);
    assert.equal(seen, 1);
    assert.equal(calls.length, 2);
    assert.equal(skipped(), 2);
});
