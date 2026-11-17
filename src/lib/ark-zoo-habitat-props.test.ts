/**
 * The enclosures' props drawn to a realistic standard (the owner, 2026-11-17: "the elephant enclosure has objects in
 * it like tree trunks and mini pond and bushes etc. that all look so bad and cheap graphics, not detailed"). The logs,
 * dead trees, bushes, ferns and reeds are the asset library's (`render/zoo-plantings.ts`), each inside its enclosure;
 * the elephants have a big dead tree to rub on; a waterhole is flush with the ground (no raised disc); a termite mound
 * is one smooth eroded body. Where things stand and their colliders are `ark-zoo-grounding` / `ark-solid-props`'.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {Geo} from "@/ark-scene/islands/town/render/kit";
import {Plot, pool, termiteMound} from "@/ark-scene/islands/town/render/zoo-habitat";
import {zooHabitatPlantings} from "@/ark-scene/islands/town/render/zoo-plantings";
import {launchEnclosures, zooLayout} from "@/ark-scene/islands/town/areas";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {ASSETS} from "@/ark-scene/tree-pick";
import {inPoly, polyEdgeDistance} from "@/ark-scene/islands/town/geom";

test("every enclosure's library plantings are real assets inside it; the elephants have a big dead tree", () => {
    const plan = townPlan();
    for (const open of [launchEnclosures(), plan.zoo.slots.map((s) => s.id)]) {
        const layout = zooLayout(open, plan);
        const plantings = zooHabitatPlantings(layout.enclosures);
        assert.ok(plantings.length > 60, `${plantings.length} plantings`);
        for (const p of plantings) {
            assert.ok(ASSETS[p.asset], `no asset ${p.asset}`);
            assert.ok(Number.isFinite(p.y) && p.scale > 0.1 && p.scale < 4, `${p.asset} scale ${p.scale}`);
            const inside = layout.enclosures.some((e) => inPoly(e.mask, p.x, p.z) || polyEdgeDistance(e.mask, p.x, p.z) < 1.5);
            assert.ok(inside, `${p.asset} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)} outside every enclosure`);
        }
        for (const kind of ["log-", "bush-", "fern-", "snag-a"]) assert.ok(plantings.some((p) => p.asset.startsWith(kind)), `no ${kind}`);
    }
});

test("a waterhole is flush: its water and bank a hand over the ground, nothing raised", () => {
    const solid = new Geo();
    const water = new Geo();
    const bankGeo = new Geo();
    const plot = new Plot({x: 0, z: 0, w: 20, d: 20, rot: 0}, () => 0, [], 7);
    pool(solid, water, plot, 0, 0, 2.2, 99, [0.5, 0.5, 0.5], [0.3, 0.5, 0.5], 0.2, bankGeo);
    let high = -Infinity;
    for (let i = 1; i < water.pos.length; i += 3) high = Math.max(high, water.pos[i]);
    assert.ok(high <= 0.16, `water at ${high.toFixed(2)} m`);
    let bank = -Infinity;
    // (The bank as walked on, `cover`: the same surface as drawn; the half-sunk stones stand on it.)
    for (let i = 1; i < bankGeo.pos.length; i += 3) bank = Math.max(bank, bankGeo.pos[i]);
    assert.ok(bank <= 0.17, `bank at ${bank.toFixed(2)} m`);
    // The collider as before.
    assert.equal(plot.solids.length, 1);
    assert.ok(Math.abs(plot.solids[0].r - (2.2 * 1.1 + 0.25)) < 1e-9);
});

test("a termite mound: one smooth body, under 1,000 triangles, normals facing out", () => {
    const geo = new Geo();
    const plot = new Plot({x: 0, z: 0, w: 20, d: 20, rot: 0}, () => 0, [], 3);
    termiteMound(geo, plot, 0, 0, 2.4, 12345);
    assert.ok(geo.triangles > 300 && geo.triangles < 1000, `${geo.triangles} triangles`);
    let out = 0;
    let total = 0;
    for (let i = 0; i < geo.nor.length; i += 3) {
        total++;
        if (geo.nor[i] * geo.pos[i] + geo.nor[i + 2] * geo.pos[i + 2] >= -1e-6) out++;
    }
    assert.ok(out / total > 0.9, `${out} of ${total} normals out`);
});
