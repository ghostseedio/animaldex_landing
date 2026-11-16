/**
 * Graphics pass 2 (lane town2): the owner's glitches on the town island, by rule over the whole island.
 * - "some of the bins are rendering into the house walls": a semi's bin was put on the side its neighbour is joined
 *   on, a terrace's 1.6 m inside its own front wall, a block's bin store into the next block (96 of 260 bins).
 * - "bicycles are grouped together but appearing going into each other": the flats' rack laid three 1.75 m bikes
 *   along the wall 0.7 m apart (56 overlapping pairs).
 * - "the path on the coastline on the town island is going into the sea": the zoo's west path bowed 5 m past the
 *   waterline (its ground 1.8 m under the sea), and three roads ran off the east coast.
 * - "the allotments / strips of soil have glitch patches in them": the beds are raised boxes standing over the drawn
 *   ground everywhere under them.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {inland, townPlan} from "@/ark-scene/islands/town/plan";
import {BIN_SIZE, binSpots} from "@/ark-scene/islands/town/areas";
import {BIKE_LENGTH, BIKE_WIDTH, townBikeSpots} from "@/ark-scene/islands/town/render/vehicles";
import {boxesOverlap, headingBox} from "@/ark-scene/islands/town/doors";
import {centroid, inBox, polylineAt, polylineLength, segmentDistance, type Box} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {townTileHeight} from "@/ark-scene/islands/town/drawn-ground";
import {allotmentBedsOf} from "@/ark-scene/islands/town/render/scenery";

const plan = townPlan();

function hedgeNear(b: Box, limit: number): string | null {
    for (const h of plan.hedges) {
        for (let i = 1; i < h.line.length; i++) {
            const a = h.line[i - 1];
            const c = h.line[i];
            for (const [u, v] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0, 0]]) {
                const x = b.x + Math.cos(b.rot) * u * b.w - Math.sin(b.rot) * v * b.d;
                const z = b.z + Math.sin(b.rot) * u * b.w + Math.cos(b.rot) * v * b.d;
                if (segmentDistance(x, z, a.x, a.z, c.x, c.z) < limit) return h.id;
            }
        }
    }
    return null;
}

test("no bin stands in a building's walls or on a garden boundary, home or at the kerb", () => {
    const bins = binSpots(plan);
    assert.ok(bins.length >= 240, `${bins.length} bins`);
    const bad: string[] = [];
    for (const bin of bins) {
        for (const where of ["home", "kerb"] as const) {
            const p = bin[where];
            const fp: Box = {x: p.x, z: p.z, w: 0.62, d: 0.78, rot: bin.turn};
            for (const b of plan.buildings) if (boxesOverlap(fp, b.at, 0)) bad.push(`${bin.id} ${where} in ${b.id}`);
            const h = hedgeNear(fp, 0.1);
            if (h) bad.push(`${bin.id} ${where} on ${h}`);
        }
    }
    assert.deepEqual(bad.slice(0, 10), []);
    // (And two bins never share a spot.)
    const all = bins.flatMap((bin) => [bin.home, bin.kerb].map((q) => ({x: q.x, z: q.z, w: BIN_SIZE - 0.1, d: BIN_SIZE - 0.1, rot: bin.turn})));
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (boxesOverlap(all[i], all[j], 0)) bad.push(`bins ${i}~${j}`);
    assert.deepEqual(bad.slice(0, 10), []);
});

test("bicycles stand apart, out of walls, bins and boundaries, along or square to their wall", () => {
    const bikes = townBikeSpots(plan);
    assert.ok(bikes.length >= 60, `${bikes.length} bikes`);
    const boxes = bikes.map((b) => headingBox(b, b.turn, BIKE_LENGTH, BIKE_WIDTH));
    const bad: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) if (boxesOverlap(boxes[i], boxes[j], 0)) bad.push(`${bikes[i].id} ~ ${bikes[j].id}`);
        for (const b of plan.buildings) if (boxesOverlap(boxes[i], b.at, 0)) bad.push(`${bikes[i].id} in ${b.id}`);
        for (const bin of binSpots(plan)) for (const q of [bin.home, bin.kerb]) if (boxesOverlap(boxes[i], {x: q.x, z: q.z, w: 0.62, d: 0.78, rot: bin.turn}, 0)) bad.push(`${bikes[i].id} on bin ${bin.id}`);
        const h = hedgeNear(boxes[i], 0.05);
        if (h) bad.push(`${bikes[i].id} on ${h}`);
    }
    assert.deepEqual(bad.slice(0, 10), []);
    // The heading is three.js's: a bike by a turned building lies along (or square to) that building, never skewed.
    for (const s of bikes) {
        const owner = plan.buildings.find((b) => s.id.startsWith(`bike:${b.id}`) && (s.id.length === `bike:${b.id}`.length || s.id[`bike:${b.id}`.length] === ":"))!;
        const dir = {x: Math.sin(s.turn), z: Math.cos(s.turn)};
        const along = Math.abs(dir.x * Math.cos(owner.at.rot) + dir.z * Math.sin(owner.at.rot));
        assert.ok(along > 0.999 || along < 0.001, `${s.id} skewed to its wall (${along.toFixed(3)})`);
    }
});

test("no street or path runs into the sea: both edges 2.5 m+ inland and above the tide", () => {
    const bad: string[] = [];
    for (const s of plan.streets) {
        // (The quay is the harbour's wall: it stands in the sea by design.)
        if (s.kind === "quay") continue;
        const length = polylineLength(s.line);
        for (let a = 0; a <= length; a += 0.5) {
            const {point, dir} = polylineAt(s.line, a);
            for (const side of [-1, 1]) {
                const off = (s.width / 2 + s.pavement) * side;
                const x = point.x - dir.z * off;
                const z = point.z + dir.x * off;
                // (A bridge carries a street over the canal and the millpond's outfall.)
                if (plan.bridges.some((b) => inBox(b.at, x, z, 1))) continue;
                const i = inland(x, z);
                if (i < 2.5) bad.push(`${s.id} edge at (${x.toFixed(0)}, ${z.toFixed(0)}) ${i.toFixed(1)} m inland`);
                else if (inland(x, z) < 40 && townHeight(x, z) < 0.4) bad.push(`${s.id} edge at (${x.toFixed(0)}, ${z.toFixed(0)}) ground ${townHeight(x, z).toFixed(2)} m`);
            }
        }
    }
    assert.deepEqual(bad.slice(0, 10), []);
});

test("the allotments' beds stand over the drawn ground everywhere under them", () => {
    const greens = plan.greens.filter((g) => g.kind === "allotments");
    assert.ok(greens.length > 0);
    let beds = 0;
    for (const g of greens) {
        const c4 = g.poly;
        const w = Math.hypot(c4[1].x - c4[0].x, c4[1].z - c4[0].z);
        const d = Math.hypot(c4[3].x - c4[0].x, c4[3].z - c4[0].z);
        const centre = centroid(c4);
        const area = {x: centre.x, z: centre.z, w, d, rot: Math.atan2(c4[1].z - c4[0].z, c4[1].x - c4[0].x)};
        for (const bed of allotmentBedsOf(area, 1)) {
            beds++;
            for (let u = -0.5; u <= 0.5; u += 0.05) {
                for (let v = -0.5; v <= 0.5; v += 0.05) {
                    const x = bed.box.x + Math.cos(bed.box.rot) * u * bed.box.w - Math.sin(bed.box.rot) * v * bed.box.d;
                    const z = bed.box.z + Math.sin(bed.box.rot) * u * bed.box.w + Math.cos(bed.box.rot) * v * bed.box.d;
                    const tile = townTileHeight(x, z);
                    assert.ok(bed.top - 0.03 > tile + 0.1, `bed soil ${bed.top.toFixed(2)} under the ground ${tile.toFixed(2)} at (${x.toFixed(1)}, ${z.toFixed(1)})`);
                    assert.ok(bed.base < tile, `bed floats at (${x.toFixed(1)}, ${z.toFixed(1)})`);
                }
            }
            // Beds sit inside their area, on its land.
            assert.ok(Math.abs(bed.box.x - centre.x) < w && Math.abs(bed.box.z - centre.z) < d);
        }
    }
    assert.ok(beds >= 20, `${beds} beds`);
});
