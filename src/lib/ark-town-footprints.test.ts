/**
 * No building stands on a street, a path or the canal (the owner, 2026-11-17: "fix the church, it's rendering on the
 * road"). The church's tower was drawn 3.6 m past its footprint's east end, on Park Road; a footprint check passed,
 * because only the plan's boxes were checked. So this checks what is DRAWN: every vertex of every building's geometry
 * near the ground (below 1.9 m over its floor: walls, plinths, porches, steps; not eaves or awnings overhead) against
 * every street's carriageway and every path, the pavements (a door step may stand on one) and the canal. The zoo's
 * houses, for both zoo layouts (the launch enclosures and every slot open), stand off the zoo's paths.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {Geo} from "@/ark-scene/islands/town/render/kit";
import {buildBuilding, buildingFrame, newBuildingChunk} from "@/ark-scene/islands/town/render/buildings";
import {CANAL, CANAL_WIDTH, townPlan} from "@/ark-scene/islands/town/plan";
import {acrossDistance} from "@/ark-scene/islands/town/street-clip";
import {corners, polylineWithin} from "@/ark-scene/islands/town/geom";
import {launchEnclosures, zooLayout} from "@/ark-scene/islands/town/areas";
import {zooHouseFrame, ZOO_HOUSE_TYPES} from "@/ark-scene/islands/town/tanks";

/** How far a door step may stand out onto a pavement (m): the steps are 0.65 m deep; a wall never may. */
const STEP_ON_PAVEMENT = 0.7;

function groundVertices(): Array<{id: string; x: number; z: number; y: number}> {
    const out: Array<{id: string; x: number; z: number; y: number}> = [];
    for (const b of townPlan().buildings) {
        const chunk = newBuildingChunk(null, new Geo());
        buildBuilding(chunk, b);
        const floor = buildingFrame(b.at).y;
        for (const geo of [chunk.solid, chunk.detail, chunk.glass]) {
            for (let i = 0; i < geo.pos.length; i += 3) {
                const y = geo.pos[i + 1] - floor;
                if (y < 1.9) out.push({id: b.id, x: geo.pos[i], z: geo.pos[i + 2], y});
            }
        }
    }
    return out;
}

test("no building's drawn footprint is on a carriageway, a path or the canal, nor more than a step onto a pavement", () => {
    const plan = townPlan();
    const vertices = groundVertices();
    assert.ok(vertices.length > 50000, `${vertices.length} vertices`);
    const worst = new Map<string, number>();
    for (const v of vertices) {
        for (const s of plan.streets) {
            const d = acrossDistance(s.line, v.x, v.z);
            const intoCarriageway = s.width / 2 - d;
            const intoPavement = s.width / 2 + s.pavement - d;
            const over = Math.max(intoCarriageway + 0.02, s.pavement > 0 ? intoPavement - STEP_ON_PAVEMENT : -1);
            if (over > 0) worst.set(`${v.id} on ${s.id}`, Math.max(worst.get(`${v.id} on ${s.id}`) ?? 0, over + 0.02));
        }
        if (polylineWithin(CANAL, v.x, v.z, CANAL_WIDTH / 2 + 0.3)) worst.set(`${v.id} in the canal`, 1);
    }
    const rows = Array.from(worst.entries()).map(([k, m]) => `${k} (${m.toFixed(2)} m)`);
    assert.equal(rows.length, 0, rows.join("; "));
});

test("the church: its tower and nave inside its footprint, the belfry where the plan says (the peregrines' perch)", () => {
    const church = townPlan().buildings.find((b) => b.kind === "church")!;
    const chunk = newBuildingChunk(null, new Geo());
    buildBuilding(chunk, church);
    const c = Math.cos(church.at.rot);
    const s = Math.sin(church.at.rot);
    let outside = 0;
    let towerTop = {y: -Infinity, x: 0, z: 0};
    const floor = buildingFrame(church.at).y;
    for (let i = 0; i < chunk.solid.pos.length; i += 3) {
        const dx = chunk.solid.pos[i] - church.at.x;
        const dz = chunk.solid.pos[i + 2] - church.at.z;
        const lx = dx * c + dz * s;
        const lz = -dx * s + dz * c;
        const y = chunk.solid.pos[i + 1] - floor;
        // (The north porch stands past the side wall, the west door's step 0.65 m past the end; nothing else.)
        if (y < 4.9 && Math.abs(lz) > church.at.d / 2 + STEP_ON_PAVEMENT) outside++;
        if (y > 18 && y < 24 && Math.abs(lx) > church.at.w / 2 + 0.6) outside++;
        if (y > towerTop.y) towerTop = {y, x: chunk.solid.pos[i], z: chunk.solid.pos[i + 2]};
    }
    assert.equal(outside, 0);
    // The spire over the belfry at the plan's `tall` point (areas.ts puts the belfry's perch there).
    assert.ok(Math.hypot(towerTop.x - church.tall!.x, towerTop.z - church.tall!.z) < 0.5, `spire at ${towerTop.x.toFixed(1)}, ${towerTop.z.toFixed(1)}`);
});

test("the zoo's houses stand off the zoo's paths, at launch and with every enclosure open", () => {
    const plan = townPlan();
    const paths = plan.streets.filter((s) => plan.zoo.paths.includes(s.id));
    const all = plan.zoo.slots.map((s) => s.id);
    const bad: string[] = [];
    for (const open of [launchEnclosures(), all]) {
        for (const e of zooLayout(open, plan).enclosures) {
            if (e.shared || !ZOO_HOUSE_TYPES.has(e.type)) continue;
            const box = zooHouseFrame(e).box;
            for (const p of corners(box)) for (const s of paths) if (acrossDistance(s.line, p.x, p.z) < s.width / 2) bad.push(`${e.id} on ${s.id}`);
        }
    }
    assert.equal(bad.length, 0, bad.join("; "));
});
