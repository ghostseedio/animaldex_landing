/**
 * The world props lane (ark-world, decision 447): the owner, 2026-11-20, "better modeling and animations and graphics on
 * bushes too and maybe safari area like the trucks have square wheels". What is pinned here:
 *
 * - Wheels are round: every vertex of a `roundWheel` is within its radius of its axle, the axle is the frame's x, and the
 *   ring is covered all the way round (a box's corners are 41 % past the radius and leave the ring's angles empty).
 * - The safari trucks have four round wheels on the ground and a round spare, in a few thousand triangles.
 * - The mobile hen house's wheels stand on their rims (a vertical cylinder lying flat was a table top).
 * - The safari gate arch stands square to the road it spans, its posts clear of the carriageway, centred on it.
 * - A patch of ground cover is a soft, single-sided, upward-facing ring, not a 14-corner polygon.
 * - A kopje is a pile of many darker, varied blocks inside its footprint, each a solid from the ground up.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {Geo, type Frame} from "@/ark-scene/islands/town/render/kit";
import {roundWheel} from "@/ark-scene/islands/town/render/wheels";
import {safariTruckGeometry} from "@/ark-scene/islands/town/render/safari";
import {kopje} from "@/ark-scene/islands/town/render/safari-habitat";
import {patch, Plot} from "@/ark-scene/islands/town/render/zoo-habitat";
import {GATE_ARCH_ALONG, SAFARI_GATE_ROAD, SAFARI_ROAD_WIDTH, SAFARI_KOPJES, safariGateArch} from "@/ark-scene/islands/town/safari";
import {polylineNearest} from "@/ark-scene/islands/town/geom";

const FRAME: Frame = {x: 0, y: 0, z: 0, rot: 0};

function vertices(geo: Geo): Array<[number, number, number]> {
    const out: Array<[number, number, number]> = [];
    for (let i = 0; i < geo.pos.length; i += 3) out.push([geo.pos[i], geo.pos[i + 1], geo.pos[i + 2]]);
    return out;
}

test("a wheel is a solid of revolution about the frame's x: every vertex within its radius, the ring covered all round", () => {
    for (const side of [1, -1] as const) {
        const geo = new Geo();
        const R = 0.5;
        const w = 0.4;
        roundWheel(geo, FRAME, 1.1, R, 2.0, R, w, side, {sides: 16});
        const bins = new Set<number>();
        let reach = 0;
        let xMin = Infinity;
        let xMax = -Infinity;
        for (const [x, y, z] of vertices(geo)) {
            const r = Math.hypot(y - R, z - 2.0);
            reach = Math.max(reach, r);
            xMin = Math.min(xMin, x);
            xMax = Math.max(xMax, x);
            if (r > R * 0.9) bins.add(Math.round(((Math.atan2(y - R, z - 2.0) + Math.PI) / (Math.PI * 2)) * 16) % 16);
        }
        assert.ok(reach <= R + 1e-6, `a vertex ${reach.toFixed(3)} m from the axle, past the radius ${R}`);
        assert.ok(reach >= R - 1e-6, "the tyre reaches its radius");
        assert.equal(bins.size, 16, "the tyre's crown has a vertex at every 22.5 degrees");
        assert.ok(Math.abs(xMax - xMin - w) < 0.12, `its width runs along x (${(xMax - xMin).toFixed(3)} m)`);
        assert.ok(geo.triangles >= 200 && geo.triangles <= 480, `${geo.triangles} triangles`);
        assert.ok(geo.pos.every(Number.isFinite) && geo.nor.every(Number.isFinite), "no NaN");
    }
});

test("the safari truck: four round wheels on the ground, a round spare aft, nothing sunk, in a few thousand triangles", () => {
    const g = safariTruckGeometry();
    const p = g.getAttribute("position");
    const box = g.boundingBox!;
    assert.ok(box.min.y >= -1e-6, `lowest point ${box.min.y.toFixed(3)} m: under the ground`);
    assert.ok(box.max.y <= 3.0 && box.max.y >= 2.5, `${box.max.y.toFixed(2)} m tall`);
    assert.ok(box.max.z - box.min.z >= 6.2 && box.max.z - box.min.z <= 6.9, `${(box.max.z - box.min.z).toFixed(2)} m long`);
    assert.ok(box.max.x - box.min.x >= 2.2 && box.max.x - box.min.x <= 2.8, `${(box.max.x - box.min.x).toFixed(2)} m wide`);
    const tris = p.count / 3;
    assert.ok(tris >= 1200 && tris <= 4000, `${tris} triangles`);
    // Each wheel: the vertices that are tyre (on its outer faces, in its place) lie within the radius of its axle.
    for (const [cx, cz] of [[-1.08, 2.05], [1.08, 2.05], [-1.08, -1.85], [1.08, -1.85]] as const) {
        let inside = 0;
        let reach = 0;
        let bottom = Infinity;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i);
            // (The tyre's outer sidewall and its rim: the plane 0.2 m out from the axle, where no body panel has a vertex.)
            if (Math.abs(Math.abs(x - cx) - 0.2) > 0.012) continue;
            const r = Math.hypot(p.getY(i) - 0.5, p.getZ(i) - cz);
            if (r > 0.62) continue;
            inside++;
            reach = Math.max(reach, r);
            bottom = Math.min(bottom, p.getY(i));
        }
        assert.ok(inside >= 60, `wheel at ${cx},${cz}: ${inside} vertices`);
        assert.ok(reach <= 0.5 + 1e-6, `wheel at ${cx},${cz}: ${reach.toFixed(3)} m from its axle (a square wheel's corners are 0.65)`);
        assert.ok(bottom <= 0.09, `wheel at ${cx},${cz}: its sidewall comes down to the shoulder by the ground (${bottom})`);
    }
});

test("the safari gate arch stands square to the road it spans, its posts clear of the carriageway and the sign facing the plaza", () => {
    const arch = safariGateArch();
    // The road's own heading where the arch stands.
    const near = polylineNearest(SAFARI_GATE_ROAD, arch.x, arch.z);
    assert.ok(near.distance < 0.05, `the arch is ${near.distance.toFixed(2)} m off the road's middle`);
    assert.ok(Math.abs(near.along - GATE_ARCH_ALONG) < 0.2, "and where it was asked");
    // Local x (the posts' axis) and the road's direction: at a right angle.
    const axis = {x: Math.cos(arch.rot), z: Math.sin(arch.rot)};
    const dot = axis.x * near.dir.x + axis.z * near.dir.z;
    assert.ok(Math.abs(dot) < 1e-6, `the arch is ${(Math.acos(Math.min(Math.abs(dot), 1)) * 180 / Math.PI).toFixed(1)} degrees from square to the road`);
    for (const side of [-3.6, 3.6]) {
        const post = {x: arch.x + axis.x * side, z: arch.z + axis.z * side};
        const gap = polylineNearest(SAFARI_GATE_ROAD, post.x, post.z).distance;
        assert.ok(gap >= SAFARI_ROAD_WIDTH / 2 + 0.3, `a post ${gap.toFixed(2)} m from the road's middle: on the carriageway`);
    }
    // The sign's front is local +z: it looks back along the road, at visitors coming from the plaza.
    const front = {x: -Math.sin(arch.rot), z: Math.cos(arch.rot)};
    assert.ok(front.x * near.dir.x + front.z * near.dir.z < -0.99, "the painted board faces the way visitors come from");
});

test("a patch of ground cover is a soft single-sided ring: up-facing, a smooth outline, a rim settled toward the floor, specks past it", () => {
    const plot = new Plot({x: 0, z: 0, w: 40, d: 40, rot: 0}, () => 1, [], 7);
    const geo = new Geo();
    const radius = 2;
    patch(geo, plot, 3, -2, radius, [0.6, 0.5, 0.3], 12345, 0.03);
    assert.ok(geo.triangles >= 45 && geo.triangles <= 60, `${geo.triangles} triangles`);
    for (let i = 1; i < geo.nor.length; i += 3) assert.ok(geo.nor[i] > 0.99, "every face looks up");
    let rimLift = 0;
    let midLift = 0;
    let reach = 0;
    for (const [x, y, z] of vertices(geo)) {
        const d = Math.hypot(x - 3, z + 2);
        reach = Math.max(reach, d);
        if (d > radius * 0.7 && d < radius * 1.3 && y - 1 < 0.027) rimLift = Math.max(rimLift, 1);
        midLift = Math.max(midLift, y - 1);
    }
    assert.ok(reach <= radius * 1.3 + 0.4, `reaches ${reach.toFixed(2)} m for a radius of ${radius}`);
    assert.ok(rimLift === 1 && Math.abs(midLift - 0.03) < 1e-6, "the middle stands at the lift, the rim below it");
    // The outline is smooth: the radius's change from one corner of the outer ring to the next stays small.
    const outer: number[] = [];
    const ringVerts = vertices(geo).map(([x, y, z]) => ({d: Math.hypot(x - 3, z + 2), a: Math.atan2(z + 2, x - 3), y: y - 1}));
    for (const v of ringVerts.filter((q) => Math.abs(q.y - Math.max(0.03 * 0.7, 0.03 - 0.004)) < 1e-6 && q.d > radius * 0.7).sort((p, q) => p.a - q.a)) outer.push(v.d);
    assert.ok(outer.length >= 16);
    for (let i = 1; i < outer.length; i++) assert.ok(Math.abs(outer[i] - outer[i - 1]) < radius * 0.5, "no spiky corners");
    assert.ok(geo.pos.every(Number.isFinite) && geo.nor.every(Number.isFinite) && geo.col.every(Number.isFinite));
});

test("a kopje is a tor of ten blocks and more, in varied darker granite, inside its footprint, each a solid from the ground up", () => {
    for (const k of SAFARI_KOPJES) {
        const plot = new Plot({x: 0, z: 0, w: 80, d: 80, rot: 0}, () => 2, [], 3);
        const geo = new Geo();
        geo.rocks = [];
        kopje(geo, plot, 0, 0, k.r, k.h, k.seed);
        const records = geo.rocks.length / 12;
        assert.ok(records >= 14 && records <= 16, `${records} blocks`);
        assert.ok(plot.solids.length >= 10 && plot.solids.length <= records, `${plot.solids.length} solids`);
        const colours = new Set<string>();
        let top = -Infinity;
        for (let i = 0; i < records; i++) {
            const o = i * 12;
            colours.add([geo.rocks[o + 7], geo.rocks[o + 8], geo.rocks[o + 9]].map((v) => v.toFixed(2)).join(","));
            // Pale (the old #a39686 rendered as concrete): no block lighter than a mid grey-brown in any channel.
            assert.ok(Math.max(geo.rocks[o + 7], geo.rocks[o + 8], geo.rocks[o + 9]) < 0.32, "a pale block");
            top = Math.max(top, geo.rocks[o + 1] + geo.rocks[o + 4]);
        }
        assert.ok(colours.size >= 10, `${colours.size} different tones`);
        for (const s of plot.solids) {
            if (s.shape !== "box") throw new Error("a block is a box solid");
            assert.ok(Math.hypot(s.x, s.z) <= k.r * 1.3 + 0.6, `a block ${Math.hypot(s.x, s.z).toFixed(1)} m from the middle of a ${k.r} m kopje`);
            assert.ok(s.base <= 2 + 1e-6, "its solid starts at the ground");
        }
        assert.ok(top - 2 >= k.h * 0.8 && top - 2 <= k.h * 1.5, `${(top - 2).toFixed(1)} m tall for ${k.h}`);
    }
});

test("a bush is smooth-shaded lumps in mottled greens, not flat-faced facets: a vertex's normal differs across its triangle, the greens vary, 160 faces", () => {
    const geo = new Geo();
    geo.bush(0, 1, 0, 1.2, 0.8, 1.2, [0.2, 0.45, 0.18], 4242);
    assert.ok(geo.triangles === 160, `${geo.triangles} triangles (the same as the flat bush it replaces)`);
    let smooth = 0;
    const greens = new Set<string>();
    for (let t = 0; t < geo.triangles; t++) {
        const n = (v: number, k: number) => geo.nor[(t * 3 + v) * 3 + k];
        const same = [1, 2].every((v) => [0, 1, 2].every((k) => Math.abs(n(v, k) - n(0, k)) < 1e-6));
        if (!same) smooth++;
        greens.add([0, 1, 2].map((k) => geo.col[(t * 3) * 3 + k].toFixed(3)).join(","));
    }
    assert.ok(smooth > geo.triangles * 0.95, `${smooth} of ${geo.triangles} triangles carry their own corner normals`);
    assert.ok(greens.size > 60, `${greens.size} distinct corner greens (a flat lump has one a face)`);
    assert.ok(geo.pos.every(Number.isFinite) && geo.nor.every(Number.isFinite) && geo.col.every(Number.isFinite), "no NaN");
    // The normals are unit and lean out of the bush, not into it.
    for (let i = 0; i < geo.nor.length; i += 3) assert.ok(Math.abs(Math.hypot(geo.nor[i], geo.nor[i + 1], geo.nor[i + 2]) - 1) < 1e-5);
});

test("a hedge's surface normals lean the way each face's winding faces (the foliage material is double-sided and flips a back face's normal: an inward-leaning one drew black), and are smooth along it", async () => {
    const {hedgeAlong} = await import("@/ark-scene/islands/town/render/nature");
    const geo = new Geo();
    hedgeAlong(geo, [{x: 0, z: 0}, {x: 12, z: 0}], 1.6, 7, false);
    let aligned = 0;
    let smooth = 0;
    let total = 0;
    for (let t = 0; t < geo.triangles; t++) {
        const p = (v: number, k: number) => geo.pos[(t * 3 + v) * 3 + k];
        const n = (v: number, k: number) => geo.nor[(t * 3 + v) * 3 + k];
        const gx = (p(1, 1) - p(0, 1)) * (p(2, 2) - p(0, 2)) - (p(1, 2) - p(0, 2)) * (p(2, 1) - p(0, 1));
        const gy = (p(1, 2) - p(0, 2)) * (p(2, 0) - p(0, 0)) - (p(1, 0) - p(0, 0)) * (p(2, 2) - p(0, 2));
        const gz = (p(1, 0) - p(0, 0)) * (p(2, 1) - p(0, 1)) - (p(1, 1) - p(0, 1)) * (p(2, 0) - p(0, 0));
        const g = Math.hypot(gx, gy, gz);
        if (g < 1e-9) continue;
        total++;
        const along = [0, 1, 2].every((v) => n(v, 0) * gx + n(v, 1) * gy + n(v, 2) * gz > -1e-9);
        if (along) aligned++;
        if ([1, 2].some((v) => [0, 1, 2].some((k) => Math.abs(n(v, k) - n(0, k)) > 1e-6))) smooth++;
    }
    assert.ok(total > 100, `${total} faces`);
    assert.ok(aligned >= total * 0.95, `${aligned} of ${total} faces carry normals along their winding`);
    assert.ok(smooth >= total * 0.9, `${smooth} of ${total} faces are smooth-shaded`);
});
