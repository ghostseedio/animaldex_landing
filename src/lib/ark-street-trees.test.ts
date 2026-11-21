/**
 * Street trees, lamps and the pavement (ark-world-2; the owner, 2026-11-21, from the live Ark: "a street tree's trunk passes
 * through the pavement": the slab ran straight through the trunk, which showed on both sides of its edge with a dark gap where
 * it met the verge). The pavement-overlap test (`islands/town/pavement-overlap.ts`) over every tree and every street lamp.
 *
 * Counted on origin/main 07121810 (the same test, run on that tree): of its 45 street limes planted, 45 stood on the slab with no
 * pit, the trunk's foot 0.12 m in from the slab's outer edge; two hedgerow oaks stood on a lane's surface; of 77 street lamps,
 * 5 stood in a carriageway at a junction. Now:
 *
 * - every street lime stands in a tree pit (a square tray of soil in an edging) lying wholly on a drawn slab, its trunk inside
 *   the soil, its centre the pit's;
 * - no other tree's trunk stands on or across any drawn street surface (a carriageway, a kerb, a slab or a footpath);
 * - every street lamp stands wholly on a drawn walkway and clear of every pit.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {townTrees} from "@/ark-scene/islands/town/trees";
import {buildScenery} from "@/ark-scene/islands/town/render/scenery";
import {drawTreePit, PIT_EDGE_TOP, PIT_SOIL_TOP} from "@/ark-scene/islands/town/render/tree-pits";
import {clipStreets} from "@/ark-scene/islands/town/street-clip";
import {footOnPavement, LAMP_FOOT, nearPit, PIT_EDGING, pitOnSlab, pitPoints} from "@/ark-scene/islands/town/pavement-overlap";
import {polylineNearest} from "@/ark-scene/islands/town/geom";
import {Geo} from "@/ark-scene/islands/town/render/kit";

const plan = townPlan();
const clip = clipStreets(plan.streets);
const trees = townTrees(plan);
const pitOf = new Map(plan.treePits.map((p) => [p.seed, p]));

test("every street lime stands in a tree pit lying wholly on a drawn slab, its trunk inside the soil", () => {
    const limes = trees.filter((t) => pitOf.has(t.seed));
    assert.ok(limes.length >= 40, `${limes.length} street limes planted (45 before)`);
    for (const t of limes) {
        const pit = pitOf.get(t.seed)!;
        assert.ok(pitOnSlab(clip, pit), `${t.id}: the pit is not wholly on a slab`);
        assert.ok(Math.hypot(t.x - pit.x, t.z - pit.z) < 0.05, `${t.id}: off its pit's middle`);
        assert.ok(t.trunk + PIT_EDGING <= pit.half, `${t.id}: a trunk of ${t.trunk.toFixed(2)} m in a pit of half ${pit.half}`);
        // The pit's own corners are on the slab, and a walker has room beside it: the slab left either side of it is at least 0.15 m.
        for (const q of pitPoints(pit)) assert.equal(footOnPavement(clip, q.x, q.z, 0.15), "on_walkway", `${t.id}: a pit corner's neighbourhood`);
    }
    // No two pits overlap.
    for (let i = 0; i < plan.treePits.length; i++) for (let j = i + 1; j < plan.treePits.length; j++) assert.ok(Math.hypot(plan.treePits[i].x - plan.treePits[j].x, plan.treePits[i].z - plan.treePits[j].z) > 3, "two pits");
});

test("no other tree's trunk stands on or across a carriageway, a kerb, a slab or a footpath (two hedgerow oaks stood on a lane before)", () => {
    let checked = 0;
    for (const t of trees) {
        if (t.low || pitOf.has(t.seed)) continue;
        checked++;
        assert.equal(footOnPavement(clip, t.x, t.z, t.trunk), "off_pavement", `${t.id} (${t.kind}) at ${t.x.toFixed(1)}, ${t.z.toFixed(1)}`);
    }
    assert.ok(checked > 200, `${checked} trees checked`);
});

test("every street lamp stands wholly on a drawn walkway and clear of every tree pit (five stood in a carriageway before)", () => {
    const out = buildScenery(plan);
    const planted = new Set(trees.map((t) => t.seed));
    const pits = plan.treePits.filter((p) => planted.has(p.seed));
    let street = 0;
    for (const l of out.lamps) {
        const near = plan.streets.some((s) => (s.kind === "high" || s.kind === "road" || s.kind === "quay" || s.kind === "path") && polylineNearest(s.line, l.x, l.z).distance <= s.width / 2 + s.pavement + 0.6);
        if (!near) continue;
        street++;
        assert.equal(footOnPavement(clip, l.x, l.z, LAMP_FOOT), "on_walkway", `a lamp at ${l.x.toFixed(1)}, ${l.z.toFixed(1)} off its walkway`);
        assert.ok(!nearPit(pits, l.x, l.z, 0.3), `a lamp at ${l.x.toFixed(1)}, ${l.z.toFixed(1)} in a tree pit`);
    }
    assert.ok(street >= 70, `${street} street lamps (77 before)`);
});

test("a tree pit's tray: an edging a hand over the slab, soil under its top, the trunk's foot inside, about 80 triangles, nothing outside its square", () => {
    const pit = plan.treePits[0];
    const geo = new Geo();
    const slab = 3;
    drawTreePit(geo, pit, () => slab - 0.16);
    assert.ok(geo.triangles >= 50 && geo.triangles <= 120, `${geo.triangles} triangles`);
    const ux = Math.cos(pit.heading);
    const uz = Math.sin(pit.heading);
    let top = -Infinity;
    for (let i = 0; i < geo.pos.length; i += 3) {
        const x = geo.pos[i] - pit.x;
        const z = geo.pos[i + 2] - pit.z;
        const a = x * ux + z * uz;
        const b = -x * uz + z * ux;
        assert.ok(Math.abs(a) <= pit.half + 1e-6 && Math.abs(b) <= pit.half + 1e-6, "a vertex outside the pit's square");
        top = Math.max(top, geo.pos[i + 1]);
    }
    assert.ok(Math.abs(top - (slab + PIT_EDGE_TOP)) < 0.03, `the edging's top ${(top - slab).toFixed(3)} m over the slab`);
    assert.ok(PIT_SOIL_TOP < PIT_EDGE_TOP, "the soil lies under the edging's top");
    assert.ok(geo.pos.every(Number.isFinite) && geo.nor.every(Number.isFinite));
});
