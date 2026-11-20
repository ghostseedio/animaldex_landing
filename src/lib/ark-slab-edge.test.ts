/**
 * The pavement slab's edge face (ark-world-2; the owner, 2026-11-21: "the pavement slab floats 16 cm over the verge with no edge
 * face"): the slab is a flat strip draped 16 cm over the ground; from the grass a viewer saw under it. `slabEdge` (render/streets.ts)
 * draws a face in the slab's own material from its top down to the verge, turned away from the road, and a cap at each end a
 * junction cut.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {Geo} from "@/ark-scene/islands/town/render/kit";
import {EDGE_SINK, PAVEMENT_LIFT, slabEdge} from "@/ark-scene/islands/town/render/streets";
import {readTag, SURF} from "@/ark-scene/islands/town/render/surface-tags";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {buildScenery, streetHeight} from "@/ark-scene/islands/town/render/scenery";

const LINE = [{x: 0, z: 0}, {x: 10, z: 0}, {x: 20, z: 0}];

function normalOf(geo: Geo, t: number): [number, number, number] {
    return [geo.nor[t * 9], geo.nor[t * 9 + 1], geo.nor[t * 9 + 2]];
}

test("a slab's edge face stands from its top to the verge, in the slab's material, looking away from the road on either side", () => {
    for (const side of [-1, 1]) {
        const geo = new Geo();
        // (Travelling along +x the left, +offset, is +z.)
        slabEdge(geo, LINE, side * 3.8, () => 0, {inner: side * 3.16, capStart: false, capEnd: false, alongZ: false});
        assert.equal(geo.triangles, 40, "two triangles a metre");
        let lo = Infinity;
        let hi = -Infinity;
        for (let t = 0; t < geo.triangles; t++) {
            const n = normalOf(geo, t);
            assert.ok(n[2] * side > 0.999 && Math.abs(n[1]) < 1e-6, `face ${t} looks ${n.map((v) => v.toFixed(2))} not away from the road`);
            assert.equal(readTag(geo.extra[t * 3]).surface, SURF.slabs);
        }
        for (let i = 0; i < geo.pos.length; i += 3) {
            lo = Math.min(lo, geo.pos[i + 1]);
            hi = Math.max(hi, geo.pos[i + 1]);
            assert.ok(Math.abs(geo.pos[i + 2] - side * 3.8) < 1e-9, "on the slab's edge line");
        }
        assert.ok(Math.abs(hi - PAVEMENT_LIFT) < 1e-9 && Math.abs(lo + EDGE_SINK) < 1e-9, `from ${lo} to ${hi}`);
    }
});

test("the caps at a cut end look out along the line (back at its start, on along it at its end), across the slab's width", () => {
    for (const side of [-1, 1]) {
        const geo = new Geo();
        slabEdge(geo, LINE, side * 3.8, () => 0, {inner: side * 3.16, capStart: true, capEnd: true, alongZ: false});
        assert.equal(geo.triangles, 44, "the edge's 40 and two caps of two");
        // The first 40 are the edge; then the start cap, then the end cap.
        for (const [t, want] of [[40, -1], [41, -1], [42, 1], [43, 1]] as const) {
            const n = normalOf(geo, t);
            assert.ok(n[0] * want > 0.999, `cap ${t} looks ${n.map((v) => v.toFixed(2))}, wanted along x by ${want}`);
        }
        // Across the slab: its z from the inner offset to the outer.
        const zs = new Set<string>();
        for (let t = 40; t < 44; t++) for (let v = 0; v < 3; v++) zs.add(geo.pos[(t * 3 + v) * 3 + 2].toFixed(3));
        assert.deepEqual(Array.from(zs).sort(), [(side * 3.16).toFixed(3), (side * 3.8).toFixed(3)].sort());
    }
});

test("over the whole town every slab's edge face is true to the ground: its top 16 cm over it, its foot 3 cm under it, standing upright", () => {
    const out = buildScenery(townPlan());
    let faces = 0;
    for (const chunk of out.chunks.values()) {
        const g = chunk.decal;
        for (let t = 0; t < g.triangles; t++) {
            if (readTag(g.extra[t * 3]).surface !== SURF.slabs || Math.abs(g.nor[t * 9 + 1]) > 0.1) continue;
            faces++;
            for (let v = 0; v < 3; v++) {
                const x = g.pos[(t * 3 + v) * 3];
                const y = g.pos[(t * 3 + v) * 3 + 1];
                const z = g.pos[(t * 3 + v) * 3 + 2];
                const over = y - streetHeight(x, z);
                assert.ok(Math.abs(over - PAVEMENT_LIFT) < 1e-6 || Math.abs(over + EDGE_SINK) < 1e-6, `a corner ${over.toFixed(3)} m over the ground at ${x.toFixed(1)}, ${z.toFixed(1)}`);
            }
        }
    }
    // About 3.7 km of slab edge before the junctions cut it, two triangles a metre.
    assert.ok(faces > 4000 && faces < 9000, `${faces} edge triangles`);
});
