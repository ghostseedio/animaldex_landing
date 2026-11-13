import assert from "node:assert/strict";
import test from "node:test";
import {sampleWildGround, underWater, wildZoneAt} from "@/ark-scene/islands/wild/ground";
import {cliffAt, TOWN_SIDE_BEARING, bearingDiff, LAKE, RIVER_LOWER, RIVER_UPPER} from "@/ark-scene/islands/wild/fields";
import {ecotoneWidths, measureWild} from "@/ark-scene/islands/wild/summary";
import {WILD_CHUNK_COUNT, WILD_GRID, WILD_HALF, WILD_SEGMENTS, wildChunkOf} from "@/ark-scene/islands/wild/frame";
import {bigRanges, RANGE_CLEAR, WHALE_DEPTH, whaleCells} from "@/ark-scene/islands/wild/reserves";
import {wildScenery} from "@/ark-scene/islands/wild/scenery";
import {WILD_PLAN_COUNTS, wildCapacities, wildZoneSites} from "@/ark-scene/islands/wild/sites";
import {validateWild, wildSpecies} from "@/ark-scene/islands/wild/validate";
import {wildLandBounds, wildReachToward, WILD_ISLAND} from "@/ark-scene/islands/wild/index";
import {gridSlope} from "@/ark-scene/islands/wild/terrain-cache";
import {chunkGridFor} from "@/ark-scene/streaming/chunks";

/**
 * The wild island (Part C, docs/ark/wild-island.md): deterministic, about 12 ha on Part B's grid, its biomes blending
 * over 20–50 m, its coast toward the town open (decision 141), room for true-size animals (decisions 53, 54), every
 * zone's capacity past its year's count, and the spawn validator at 0 failures.
 */

test("Part B's grid: 10 × 10 chunks of 48 segments (52.8 m), the same as chunkGridFor", () => {
    assert.deepEqual(WILD_GRID, chunkGridFor(WILD_HALF, WILD_SEGMENTS));
    assert.equal(WILD_CHUNK_COUNT, 100);
    assert.ok(Math.abs(WILD_GRID.size - 52.8) < 1e-9);
    assert.equal(wildChunkOf(-WILD_HALF, -WILD_HALF), 0);
    assert.equal(wildChunkOf(WILD_HALF - 0.01, WILD_HALF - 0.01), 99);
    assert.equal(wildChunkOf(9999, 0), wildChunkOf(WILD_HALF - 0.01, 0));
});

test("the ground is a pure function of the point", () => {
    for (const [x, z] of [[0, 0], [-62, -14], [24, -190], [-150, 110], [200, 20]]) assert.deepEqual(sampleWildGround(x, z), sampleWildGround(x, z));
});

test("about 12 ha of land, every biome with its share (islands plan §2.2)", () => {
    const m = measureWild(2);
    assert.ok(m.landHa > 11 && m.landHa < 13, `land ${m.landHa} ha`);
    const want: Record<string, [number, number]> = {rainforest: [1.9, 2.9], woodland: [1.3, 2.4], grassland: [1.6, 2.7], desert: [0.8, 1.7], mountains: [1.1, 2], seashore: [0.7, 1.4], polar: [0.35, 0.7], river_lake: [0.5, 1], wetland: [0.45, 0.95]};
    for (const [zone, [lo, hi]] of Object.entries(want)) {
        const ha = m.zoneHa[zone as keyof typeof m.zoneHa];
        assert.ok(ha >= lo && ha <= hi, `${zone} ${ha} ha (want ${lo}–${hi})`);
    }
    assert.equal(m.zoneHa.farm_garden, 0, "no garden on the wild island (decision 16)");
    assert.ok(m.freshHa > 0.2, `fresh water ${m.freshHa} ha`);
    assert.ok(m.peak > 60 && m.peak < 100, `peak ${m.peak} m`);
});

test("the transitions are 15–55 m wide (10–90%), never a hard line", () => {
    const widths = ecotoneWidths(6).filter((e) => e.samples >= 20);
    assert.ok(widths.length >= 8, `${widths.length} pairs measured`);
    for (const e of widths) assert.ok(e.width >= 15 && e.width <= 55, `${e.a}↔${e.b} ${e.width} m`);
});

test("the coast toward the town is open: no cliffs within 30° of its bearing (decision 141)", () => {
    for (let d = -30; d <= 30; d += 2) {
        const b = TOWN_SIDE_BEARING + (d * Math.PI) / 180;
        const r = 190;
        assert.equal(cliffAt(b, Math.sin(b) * r, -Math.cos(b) * r), 0, `cliff at ${((b * 180) / Math.PI).toFixed(0)}°`);
        assert.ok(Math.abs(bearingDiff(b, TOWN_SIDE_BEARING)) <= (31 * Math.PI) / 180);
    }
    const reach = wildReachToward((-22.5 * Math.PI) / 180);
    assert.ok(reach > 150 && reach < 240, `reach toward the town ${reach} m`);
    const box = wildLandBounds();
    assert.ok(box.maxX - box.minX > 360 && box.maxX - box.minX < 440 && box.maxZ - box.minZ > 340 && box.maxZ - box.minZ < 420, JSON.stringify(box));
    assert.equal(WILD_ISLAND.half, WILD_HALF);
});

test("the river runs downhill from its spring to the sea, through the lake", () => {
    for (const list of [RIVER_UPPER, RIVER_LOWER]) for (let i = 1; i < list.length; i++) assert.ok(list[i].level <= list[i - 1].level, "the river never climbs");
    assert.equal(RIVER_UPPER[RIVER_UPPER.length - 1].level, LAKE.level);
    assert.equal(RIVER_LOWER[0].level, LAKE.level);
    assert.equal(RIVER_LOWER[RIVER_LOWER.length - 1].level, 0);
    // Its water stands in its bed (below its banks) along its course.
    for (const list of [RIVER_UPPER, RIVER_LOWER.slice(0, -2)]) {
        for (let i = 1; i < list.length; i++) {
            const x = (list[i - 1].x + list[i].x) / 2;
            const z = (list[i - 1].z + list[i].z) / 2;
            const s = sampleWildGround(x, z);
            assert.ok(underWater(s) === "fresh" || s.inland < 4, `fresh water at ${x.toFixed(0)},${z.toFixed(0)}`);
        }
    }
});

test("the scenery is the same every time, trees at real heights and apart", () => {
    const items = wildScenery();
    const trees = items.filter((i) => i.kind === "tree");
    assert.ok(trees.length > 400 && trees.length < 1200, `${trees.length} trees`);
    for (const t of trees) {
        assert.ok(t.height >= 3 && t.height <= 60, `${t.asset} ${t.height.toFixed(1)} m`);
        assert.ok(underWater(sampleWildGround(t.x, t.z)) === null, `${t.asset} in the water`);
    }
    // No two trunks inside each other.
    for (let i = 0; i < trees.length; i++) for (let j = i + 1; j < trees.length; j++) assert.ok(Math.hypot(trees[i].x - trees[j].x, trees[i].z - trees[j].z) > trees[i].solid + trees[j].solid, "trunks apart");
});

test("room for true-size animals: big-animal ranges open and clear, whale cells deep (decisions 53, 54)", () => {
    const ranges = bigRanges();
    assert.ok(ranges.length >= 80, `${ranges.length} ranges`);
    const solid = wildScenery().filter((i) => i.solid > 0);
    for (const r of ranges) {
        const s = sampleWildGround(r.x, r.z);
        assert.equal(underWater(s), null);
        assert.ok(gridSlope(r.x, r.z) <= 0.22 + 1e-9);
        for (const o of solid) assert.ok(Math.hypot(o.x - r.x, o.z - r.z) >= RANGE_CLEAR - 0.01 + 0 || o.solid === 0, `${o.kind} in the range at ${r.x},${r.z}`);
    }
    const whales = whaleCells();
    assert.ok(whales.length >= 8, `${whales.length} whale cells`);
    for (const w of whales) {
        assert.ok(w.depth >= WHALE_DEPTH);
        assert.ok(w.x > 100, "in the east's drop-off");
    }
});

test("each zone's site is in its zone; every zone's visible capacity is past its year's count", () => {
    const sites = wildZoneSites();
    for (const zone of ["rainforest", "woodland", "grassland", "desert", "mountains", "polar", "wetland"] as const) assert.equal(wildZoneAt(sampleWildGround(sites[zone].x, sites[zone].z)), zone);
    for (const c of wildCapacities()) assert.ok(c.visible >= Math.max(c.plan.year, c.plan.triple) * 2, `${c.zone}: ${c.visible} for ${c.plan.year}`);
    assert.equal(Object.values(WILD_PLAN_COUNTS).reduce((s, c) => s + c.today, 0), 704, "the plan's 704 wild animals");
});

test("the spawn validator: every wild species placed at its own and its zone's year slot, 0 failures", () => {
    const report = validateWild();
    assert.equal(report.species, wildSpecies().length);
    assert.ok(report.species > 2000, `${report.species} species`);
    assert.deepEqual(report.failures.slice(0, 5), []);
    assert.equal(report.failures.length, 0);
});

test("the upper river meets the lake flush (lane MA3, the river mouth): no water stands above the lake inside it, the river comes down to its level by the shore, and its banks hold it", async () => {
    const {lakeEdge, riverAt, upperRiverMouth} = await import("@/ark-scene/islands/wild/fields");
    // (It was drawn 2-4 m above the lake over its last 20 m, a raised tongue of water across the lake's south-west.)
    for (let x = LAKE.x - 40; x <= LAKE.x + 40; x += 1) {
        for (let z = LAKE.z - 40; z <= LAKE.z + 40; z += 1) {
            if (Math.hypot(x - LAKE.x, z - LAKE.z) > lakeEdge(x, z) - 1) continue;
            const s = sampleWildGround(x, z);
            assert.ok(s.freshLevel === null || s.freshLevel <= LAKE.level + 1e-9, `water at ${s.freshLevel?.toFixed(2)} m in the lake at ${x},${z}`);
        }
    }
    // Down its course to the shore, never climbing, at the lake's level there.
    const mouth = upperRiverMouth();
    assert.ok(mouth.along > 20 && mouth.drop > 1, JSON.stringify(mouth));
    let last = Infinity;
    for (let i = 1; i < RIVER_UPPER.length; i++) {
        const a = RIVER_UPPER[i - 1];
        const b = RIVER_UPPER[i];
        for (let t = 0; t <= 1; t += 0.05) {
            const level = riverAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t).level;
            assert.ok(level <= last + 1e-9, `the river climbs to ${level.toFixed(2)} m`);
            last = level;
        }
    }
    assert.equal(last, LAKE.level);
    // Its banks hold it: the drawn water (`freshWaterGeometry`, a cell's highest corner) over a dry corner by 25 cm at most.
    const {wildGroundArrays} = await import("@/ark-scene/islands/wild/render/ground");
    const g = wildGroundArrays();
    const over: string[] = [];
    for (let row = 0; row < g.size - 1; row++) {
        for (let col = 0; col < g.size - 1; col++) {
            const corners = [row * g.size + col, row * g.size + col + 1, (row + 1) * g.size + col + 1, (row + 1) * g.size + col];
            const levels = corners.map((i) => g.freshLevels[i]).filter((l) => !Number.isNaN(l));
            if (!levels.length) continue;
            const top = Math.max(...levels);
            for (const i of corners) {
                const x = g.positions[i * 3];
                const z = g.positions[i * 3 + 2];
                if (!Number.isNaN(g.freshLevels[i]) || x < -105 || x > -55 || z < -85 || z > -15) continue;
                if (top - g.positions[i * 3 + 1] > 0.25) over.push(`${x.toFixed(1)},${z.toFixed(1)}`);
            }
        }
    }
    assert.deepEqual(over, [], "water drawn over the upper river's grass");
});
