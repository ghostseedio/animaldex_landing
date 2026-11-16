/**
 * Where the town's streets meet, no two street surfaces lie in one plane over the same ground (the owner, 2026-11-16:
 * "roads overlap", "there's a random glitch patch in the road on the town island"). Each street used to be drawn whole:
 * a side road's asphalt ran on over the main road's at the same lift (two colours, two tiling directions: they fought
 * in the depth buffer), pavements and yellow lines ran out across the other road, and the canal's towpaths ran across
 * the high street's bridge as a band of gravel. `street-clip.ts` cuts each layer where another is laid.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {Geo} from "@/ark-scene/islands/town/render/kit";
import {streetSurfaces, PAVEMENT_LIFT, ROAD_LIFT} from "@/ark-scene/islands/town/render/streets";
import {CANAL, CANAL_WIDTH, TOWPATH, townPlan} from "@/ark-scene/islands/town/plan";
import {acrossDistance, clipStreets, cutAt, keptPieces, onAnyStreet} from "@/ark-scene/islands/town/street-clip";
import {polylineAt, polylineLength} from "@/ark-scene/islands/town/geom";

type Tri = {ax: number; az: number; bx: number; bz: number; cx: number; cz: number; y: number};

function flatTriangles(): Tri[] {
    const geo = new Geo();
    // (A flat island: every surface's height is its own lift, so two at one lift over one point are in one plane.)
    streetSurfaces(townPlan(), {chunkAt: () => ({decal: geo}), heightAt: () => 0});
    const out: Tri[] = [];
    for (let i = 0; i < geo.pos.length; i += 9) {
        const ny = geo.nor[i + 1];
        if (Math.abs(ny) < 0.5) continue; // a kerb's face
        out.push({ax: geo.pos[i], az: geo.pos[i + 2], bx: geo.pos[i + 3], bz: geo.pos[i + 5], cx: geo.pos[i + 6], cz: geo.pos[i + 8], y: (geo.pos[i + 1] + geo.pos[i + 4] + geo.pos[i + 7]) / 3});
    }
    return out;
}

/** Whether a triangle covers (x, z): `strictly` inside (a point on the edge two triangles share is in neither). */
function covers(t: Tri, x: number, z: number, strictly = false): boolean {
    const d1 = (x - t.bx) * (t.az - t.bz) - (t.ax - t.bx) * (z - t.bz);
    const d2 = (x - t.cx) * (t.bz - t.cz) - (t.bx - t.cx) * (z - t.cz);
    const d3 = (x - t.ax) * (t.cz - t.az) - (t.cx - t.ax) * (z - t.az);
    const e = strictly ? -1e-6 : 1e-9;
    const neg = d1 < -e || d2 < -e || d3 < -e;
    const pos = d1 > e || d2 > e || d3 > e;
    return !(neg && pos);
}

/** Every place two streets meet: each street's ends, and where two streets' lines come within their widths. */
function meetings(): Array<{x: number; z: number}> {
    const plan = townPlan();
    const out: Array<{x: number; z: number}> = [];
    for (const s of plan.streets) {
        for (const e of [s.line[0], s.line[s.line.length - 1]]) out.push(e);
        for (const t of plan.streets) {
            if (t === s) continue;
            const length = polylineLength(s.line);
            for (let a = 0; a <= length; a += 2) {
                const p = polylineAt(s.line, a).point;
                if (acrossDistance(t.line, p.x, p.z) < 1) out.push(p);
            }
        }
    }
    return out;
}

test("no two street surfaces share a plane where streets meet (junctions, crossings, ends)", () => {
    const tris = flatTriangles();
    const near = 14;
    const step = 0.37;
    const seen = new Set<string>();
    const clashes: string[] = [];
    let probed = 0;
    for (const m of meetings()) {
        const local = tris.filter((t) => Math.min(t.ax, t.bx, t.cx) < m.x + near && Math.max(t.ax, t.bx, t.cx) > m.x - near && Math.min(t.az, t.bz, t.cz) < m.z + near && Math.max(t.az, t.bz, t.cz) > m.z - near);
        for (let x = m.x - near + 0.113; x < m.x + near; x += step) {
            for (let z = m.z - near + 0.071; z < m.z + near; z += step) {
                const key = `${Math.round(x / step)}:${Math.round(z / step)}`;
                if (seen.has(key)) continue;
                seen.add(key);
                probed++;
                const ys = local.filter((t) => covers(t, x, z, true)).map((t) => t.y).sort((a, b) => a - b);
                for (let i = 1; i < ys.length; i++) {
                    // (1.5 mm: a zebra stripe 2 mm over a dash is drawn on purpose; two layers in one plane are 0 mm apart.)
                    if (ys[i] - ys[i - 1] < 0.0015) clashes.push(`(${x.toFixed(2)}, ${z.toFixed(2)}) at ${ys[i].toFixed(3)} m`);
                }
            }
        }
    }
    assert.ok(probed > 20000, `probed ${probed} points`);
    assert.equal(clashes.length, 0, `surfaces in one plane at ${clashes.length} points, e.g. ${clashes.slice(0, 6).join("; ")}`);
});

test("no pavement or kerb is laid on any street's carriageway, and no carriageway is missing at a junction", () => {
    const plan = townPlan();
    const clip = clipStreets(plan.streets);
    const tris = flatTriangles();
    const pavement = tris.filter((t) => Math.abs(t.y - PAVEMENT_LIFT) < 0.005);
    const asphalt = tris.filter((t) => Math.abs(t.y - ROAD_LIFT) < 0.012);
    const misses: string[] = [];
    for (const m of meetings()) {
        for (let x = m.x - 10.05; x < m.x + 10; x += 0.5) {
            for (let z = m.z - 10.05; z < m.z + 10; z += 0.5) {
                const road = clip.find((c) => acrossDistance(c.street.line, x, z) < c.half - 0.05);
                if (!road) continue;
                if (pavement.some((t) => covers(t, x, z))) misses.push(`pavement on ${road.street.id} at (${x.toFixed(1)}, ${z.toFixed(1)})`);
                if (!asphalt.some((t) => covers(t, x, z)) && ["road", "high", "lane"].includes(road.street.kind)) misses.push(`no surface on ${road.street.id} at (${x.toFixed(1)}, ${z.toFixed(1)})`);
            }
        }
    }
    assert.equal(misses.length, 0, `${misses.length}: ${misses.slice(0, 6).join("; ")}`);
    // (The rule itself: a street's own carriageway is never cut by itself.)
    assert.equal(cutAt(clip, clip[0], "carriageway", plan.streets[0].line[3].x, plan.streets[0].line[3].z), false);
});

test("the canal's towpaths stop at the streets that cross it on bridges", () => {
    const plan = townPlan();
    const clip = clipStreets(plan.streets);
    let on = 0;
    let kept = 0;
    for (const side of [-1, 1]) {
        const offset = side * (CANAL_WIDTH / 2 + 0.35 + TOWPATH / 2);
        for (const piece of keptPieces(CANAL, [offset - TOWPATH / 2, offset + TOWPATH / 2], (x, z) => onAnyStreet(clip, x, z))) {
            const length = polylineLength(piece);
            for (let a = 0.05; a < length - 0.05; a += 0.25) {
                const {point, dir} = polylineAt(piece, a);
                for (const k of [-0.45, 0, 0.45]) {
                    const o = offset + k * TOWPATH;
                    kept++;
                    if (onAnyStreet(clip, point.x - dir.z * o, point.z + dir.x * o)) on++;
                }
            }
        }
    }
    assert.ok(kept > 1000);
    assert.equal(on, 0, `${on} towpath points on a street`);
    // (And the canal is crossed: the uncut towpath did run over a street.)
    const length = polylineLength(CANAL);
    let crossed = 0;
    for (let a = 0; a < length; a += 0.5) {
        const p = polylineAt(CANAL, a);
        if (onAnyStreet(clip, p.point.x - p.dir.z * (CANAL_WIDTH / 2 + 1), p.point.z + p.dir.x * (CANAL_WIDTH / 2 + 1))) crossed++;
    }
    assert.ok(crossed > 0);
});
