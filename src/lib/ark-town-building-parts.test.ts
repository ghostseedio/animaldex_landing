/**
 * SIG8: a town building is solid where it is drawn, not only inside its footprint's box. The seat audit (PR #131) found a
 * brown tabby asleep in a front garden with 8 of its 41 points inside a house's bay window: the colliders had each
 * building as its footprint only, so its bed was picked clear of that box and inside the bay (0.9 m out from the wall).
 * The bays, porch cheeks, buttresses, podiums and posts a building draws past its footprint on the ground are colliders
 * now (`islands/town/building-parts.ts`), from the drawing itself.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {partsOf, townBuildingParts} from "@/ark-scene/islands/town/building-parts";
import {buildBuilding, newBuildingChunk} from "@/ark-scene/islands/town/render/buildings";

const plan = townPlan();
const set = townColliderSet([], {x: 0, z: 0});

test("the brown tabby's bed in house-66's bay is inside a collider now (it was clear of every one)", () => {
    // (Its bed in the town's frame, from the seat audit's row; a cat lying there, 0.15 m round, from the ground up.)
    const x = 61.97;
    const z = 95.53;
    const g = townHeight(x, z);
    const footprintOnly = set.list.filter((c) => !c.id.includes(":part:"));
    assert.ok(!footprintOnly.some((c) => c.shape === "box" && c.id === "town:house-66" && Math.abs((x - c.cx) * c.cos - (z - c.cz) * c.sin) <= c.hx1 && Math.abs((x - c.cx) * c.sin + (z - c.cz) * c.cos) <= c.hz1), "the bed is outside the house's footprint");
    assert.ok(set.blocked(x, z, 0.15, g + 0.05, 0.3), "the bay holds the bed's place");
    assert.ok(partsOf(plan.buildings.find((b) => b.id === "house-66")!).some((p) => p.shape === "box" && p.hd * 2 > 0.8), "house-66's bay is a part");
});

test("every wall a building draws past its footprint near the ground is inside one of its parts", () => {
    const parts = townBuildingParts(plan);
    let checked = 0;
    for (const b of plan.buildings) {
        const chunk = newBuildingChunk();
        buildBuilding(chunk, b);
        const own = parts.filter((p) => p.building === b.id);
        const c = Math.cos(b.at.rot);
        const s = Math.sin(b.at.rot);
        const g = townHeight(b.at.x, b.at.z);
        const pos = chunk.solid.pos;
        for (let t = 0; t < pos.length; t += 9) {
            let lo = Infinity;
            let hi = -Infinity;
            let mx = 0;
            let mz = 0;
            for (let v = 0; v < 9; v += 3) {
                lo = Math.min(lo, pos[t + v + 1]);
                hi = Math.max(hi, pos[t + v + 1]);
                mx += pos[t + v] / 3;
                mz += pos[t + v + 2] / 3;
            }
            // (A side of something standing on the ground, as tall as a body, its middle well past the footprint.)
            if (lo > g + 0.3 || hi < g + 0.6) continue;
            const lx = (mx - b.at.x) * c + (mz - b.at.z) * s;
            const lz = -(mx - b.at.x) * s + (mz - b.at.z) * c;
            if (Math.max(Math.abs(lx) - b.at.w / 2, Math.abs(lz) - b.at.d / 2) < 0.35) continue;
            checked++;
            const inside = own.some((p) => {
                if (p.shape === "circle") return Math.hypot(mx - p.x, mz - p.z) <= p.r + 0.02;
                const pc = Math.cos(p.rot);
                const ps = Math.sin(p.rot);
                const u = (mx - p.x) * pc + (mz - p.z) * ps;
                const w = -(mx - p.x) * ps + (mz - p.z) * pc;
                return Math.abs(u) <= p.hw + 0.02 && Math.abs(w) <= p.hd + 0.02;
            });
            assert.ok(inside, `${b.id}: a wall drawn at ${mx.toFixed(2)}, ${mz.toFixed(2)} is in none of its parts`);
        }
    }
    assert.ok(checked > 100, `only ${checked} walls past the footprints were checked`);
});

test("the parts are colliders from the ground up, and pure in the plan", () => {
    const parts = townBuildingParts(plan);
    const kinds = new Set(parts.map((p) => p.building.replace(/[-_]?\d.*$/, "")));
    for (const kind of ["house", "terrace", "church", "tower"]) assert.ok(kinds.has(kind), `no ${kind} parts`);
    const ids = new Set(set.list.filter((c) => c.id.includes(":part:")).map((c) => c.id));
    assert.equal(ids.size, parts.length);
    for (const p of parts) assert.ok(p.base <= townHeight(p.x, p.z), `${p.building}'s part stands on the ground`);
    assert.deepEqual(townBuildingParts({...plan}), parts);
});
