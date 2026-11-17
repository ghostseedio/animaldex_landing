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
import {Plot, pool, termiteMound, zooFloor} from "@/ark-scene/islands/town/render/zoo-habitat";
import {readTag, SURF} from "@/ark-scene/islands/town/render/surface-tags";
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
        // Dry enclosures' deadwood sun-bleached (no moss); the mossy logs only in the damp ones.
        for (const e of layout.enclosures) {
            const dry = e.type === "savanna_paddocks" || e.type === "big_cats" || e.type === "small_mammals";
            const logs = zooHabitatPlantings([e]).filter((p) => p.asset.startsWith("log-"));
            for (const p of logs) {
                if (dry) assert.ok(p.asset === "log-fresh-a" && p.tint && p.tint[2] > p.tint[0], `${e.id}: ${p.asset}`);
                else assert.equal(p.asset, "log-mossy-a", e.id);
            }
        }
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
    assert.ok(zooFloor("savanna_paddocks"));
    assert.equal(plot.solids.length, 1);
    const solid0 = plot.solids[0];
    assert.ok(solid0.shape === "circle" && Math.abs(solid0.r - (2.2 * 1.1 + 0.25)) < 1e-9);
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

test("a waterhole's bank is the textured ground: the floor's own surface and colour at its edge, mud and hoof prints at the water", () => {
    const solid = new Geo();
    const decal = new Geo();
    const plot = new Plot({x: 0, z: 0, w: 20, d: 20, rot: 0}, () => 0, [], 7);
    plot.dry = true;
    const floor = zooFloor("savanna_paddocks")!;
    const colour: [number, number, number] = [0.6, 0.45, 0.25];
    pool(solid, new Geo(), plot, 0, 0, 2.2, 99, [0.5, 0.5, 0.5], [0.3, 0.5, 0.5], 0.2, null, {decal, surface: floor.surface, floor: colour});
    const surfaces = new Set<number>();
    let edge = 0;
    for (let i = 0; i < decal.extra.length; i++) {
        surfaces.add(readTag(decal.extra[i]).surface);
        if (decal.col[i * 3] === colour[0] && decal.col[i * 3 + 1] === colour[1]) edge++;
    }
    assert.deepEqual(Array.from(surfaces).sort(), [SURF.earth, SURF.sand].sort());
    assert.ok(edge > 40, `${edge} vertices in the floor's colour`);
    // The hoof prints: small dark slots, over and above the bank's rings.
    assert.ok(decal.triangles >= 24 * 5 * 2 + 18 * 12, `${decal.triangles} decal triangles`);
});
