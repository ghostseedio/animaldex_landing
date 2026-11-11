import assert from "node:assert/strict";
import test from "node:test";
import {Atlas, CELL, LazyTerrain, WATER_KIND} from "@/ark-live/terrain";
import {ISLANDS} from "@/ark-live/islands";
import {worldSampler} from "@/ark-scene/world-sampler";
import {defaultHomePlots} from "@/ark-scene/props/home-layout";
import {LAKE, ZONE_SITES} from "@/ark-scene/world";

/**
 * The atlas contract (design §4.4): the server's baked cells and the page's lazily worked-out cells agree on ≥ 99.9 %
 * of today's island, so the server never corrects a pose the page thought was fine. (The whole island is
 * baked here; a band of it is compared cell by cell; `ark-live/bake-atlas.mts --check` compares every cell.)
 */
test("atlas: the server's baked cells and the page's agree, and survive storage byte for byte", () => {
    const sampler = worldSampler();
    const pens = {plots: defaultHomePlots()};
    const half = ISLANDS.wild.half;
    // The whole island is baked; a 264 × 40 m band through its middle (sea, beach, the lake, the farm, forests) is
    // compared cell by cell with the page's view.
    const band = {j0: half - 20, j1: half + 20};
    const lazy = new LazyTerrain("wild", half, sampler, pens);
    let same = 0;
    let total = 0;
    const baked = Atlas.bake("wild", half, sampler, pens);
    for (let j = band.j0; j < band.j1; j++) {
        for (let i = 0; i < baked.n; i++) {
            const x = -half + i + 0.5;
            const z = -half + j + 0.5;
            const a = baked.cell(x, z)!;
            const b = lazy.cell(x, z)!;
            total++;
            if (a.flags === b.flags && a.zone === b.zone && a.water === b.water && Math.abs(a.depth - b.depth) < 0.011 && Math.abs(a.height - b.height) < 0.001 && a.pen === b.pen && Math.abs(a.climbTop - b.climbTop) < 0.11) same++;
        }
    }
    assert.ok(same / total >= 0.999, `agreement ${(100 * same / total).toFixed(3)} % of ${total}`);
    const back = Atlas.fromBytes(baked.toBytes());
    assert.equal(back.version, sampler.version);
    assert.deepEqual(back.cell(LAKE.x, LAKE.z), baked.cell(LAKE.x, LAKE.z));
    assert.deepEqual(back.cell(10.5, 20.5), baked.cell(10.5, 20.5));
    // What the island has where it should.
    assert.equal(baked.cell(LAKE.x, LAKE.z)!.water, WATER_KIND.FRESH, "the lake is fresh");
    const sea = ZONE_SITES.open_ocean;
    assert.equal(baked.cell(sea.x, sea.z)!.water, WATER_KIND.SALT, "the open water is salt");
    const meadow = ZONE_SITES.grassland;
    assert.ok(baked.cell(meadow.x, meadow.z)!.flags & CELL.WALK, "the grassland's site is walkable");
    let blocked = 0;
    let climbable = 0;
    let farm = 0;
    for (let k = 0; k < baked.flags.length; k++) {
        if (baked.flags[k] & CELL.BLOCKED) blocked++;
        if (baked.flags[k] & CELL.CLIMB) climbable++;
        if (baked.pen[k] >= 100) farm++;
    }
    assert.ok(blocked > 500, `trunks, rocks and walls: ${blocked}`);
    assert.ok(climbable > 200, `climbable cells: ${climbable}`);
    assert.ok(farm > 50, `the smallholding's yard and paddock: ${farm}`);
});
