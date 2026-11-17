/**
 * The giant waterfall on the wild island (p4 WATERFALL, `src/ark-scene/islands/wild/falls.ts`): drawn over the island's
 * ground without changing it, the water in front of the rock all the way down, the pool held by its rim and spilling to
 * the river's spring, the cliff solid to walkers and the falls heard. By rule over the whole shape, on the v2 world.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {setArkWorld} from "@/ark-scene/world";

setArkWorld("v2");

const load = async () => {
    const falls = await import("@/ark-scene/islands/wild/falls");
    const {wildHeight, sampleWildGround, underWater} = await import("@/ark-scene/islands/wild/ground");
    const {RIVER_UPPER} = await import("@/ark-scene/islands/wild/fields");
    return {...falls, wildHeight, sampleWildGround, underWater, RIVER_UPPER};
};

test("falls: the cliff's skin grows out of the slope: its seams under the ground, nothing hanging deep under it", async () => {
    const F = await load();
    const skin = F.cliffSkin();
    assert.ok(skin.cols > 40 && skin.rows > 60, `${skin.cols} × ${skin.rows}`);
    let deepest = Infinity;
    let tallest = -Infinity;
    for (let r = 0; r < skin.rows; r++) {
        for (let c = 0; c < skin.cols; c++) {
            const i = r * skin.cols + c;
            const x = skin.positions[i * 3];
            const y = skin.positions[i * 3 + 1];
            const z = skin.positions[i * 3 + 2];
            assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z), `vertex ${i}`);
            const over = y - F.fallsGround(x, z);
            deepest = Math.min(deepest, over);
            tallest = Math.max(tallest, y);
            // Its seams (the foot, the top, the two sides) are at or under the ground: no edge stands in the air.
            if (r === 0 || r === skin.rows - 1 || c === 0 || c === skin.cols - 1) assert.ok(over < 0.05, `a seam stands ${over.toFixed(2)} m over the ground at ${x.toFixed(1)}, ${z.toFixed(1)}`);
        }
    }
    // Where its relief dips under the slope the ground shows through (an outcrop's edge); never a deep hole.
    assert.ok(deepest > -2.5, `the skin sinks ${deepest.toFixed(2)} m under the ground`);
    // A giant: the face stands 30 m and more over the pool.
    assert.ok(tallest - F.POOL.level > 30, `the cliff stands ${(tallest - F.POOL.level).toFixed(1)} m over the pool`);
    assert.ok(F.FALLS_LIP - F.POOL.level > 30, `the drop is ${(F.FALLS_LIP - F.POOL.level).toFixed(1)} m`);
});

test("falls: the water is in front of the rock and over the ground all the way down, and lands in the pool", async () => {
    const F = await load();
    const skin = F.cliffSkin();
    // The rock's front, per height band, under the sheet's width.
    for (let j = 0; j <= 40; j++) {
        const v = 0.1 + (j / 40) * 0.9;
        for (const u01 of [0, 0.25, 0.5, 0.75, 1]) {
            const p = F.curtainPoint(u01, v);
            // (Its last two metres are in the pool's foam and the apron's boulders.)
            if (p.y < F.POOL.level + 2) continue;
            for (let i = 0; i < skin.cols * skin.rows; i++) {
                const x = skin.positions[i * 3];
                const y = skin.positions[i * 3 + 1];
                const z = skin.positions[i * 3 + 2];
                if (Math.abs(x - p.x) > 0.3 || Math.abs(y - p.y) > 0.3) continue;
                assert.ok(p.z > z + 0.1, `the sheet at v ${v.toFixed(2)}, across ${u01} (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) is ${(p.z - z).toFixed(2)} m in front of the rock`);
            }
            assert.ok(p.y > F.fallsGround(p.x, p.z) - 0.05, `the sheet at v ${v.toFixed(2)} is under the ground`);
        }
    }
    const foot = F.curtainPoint(0.5, 1);
    assert.ok(Math.abs(foot.y - F.POOL.level) < 1e-6);
    for (const u01 of [0.1, 0.5, 0.9]) {
        const p = F.curtainPoint(u01, 1);
        assert.ok(F.inPool(p.x, p.z, 0.4) || F.fallsGround(p.x, p.z) > F.POOL.level, `the sheet's foot at ${u01} lands on the pool or its apron`);
    }
});

test("falls: the pool's water stands over its bed, is held by its rim, and spills down to the river's spring", async () => {
    const F = await load();
    const strike = F.impact();
    assert.ok(F.fallsGround(strike.x, strike.z) < F.POOL.level, "water stands where the sheet strikes");
    const stones = F.rimStones();
    // Round the rim: wherever the ground is lower than the water, a stone holds it (or the spill's gap is there).
    for (let k = 0; k < 120; k++) {
        const a = (k / 120) * Math.PI * 2;
        const x = F.POOL.x + Math.cos(a) * F.POOL.rx;
        const z = F.POOL.z + Math.sin(a) * F.POOL.rz;
        if (F.fallsGround(x, z) >= F.POOL.level - 0.02) continue;
        const held = stones.some((s) => Math.hypot(s.x - x, s.z - z) < s.r * 1.3) || Math.hypot(x - F.OUTFLOW[0].x, z - F.OUTFLOW[0].z) < 1.2;
        assert.ok(held, `the pool's rim at ${x.toFixed(1)}, ${z.toFixed(1)} holds no water`);
    }
    // The spill runs downhill to the upper river's first point, its water a hand over the ground.
    const path = F.outflowPath();
    for (let i = 1; i < path.length; i++) assert.ok(path[i].y <= path[i - 1].y + 1e-6, `the spill climbs at ${i}`);
    const last = path[path.length - 1];
    assert.ok(Math.hypot(last.x - F.RIVER_UPPER[0].x, last.z - F.RIVER_UPPER[0].z) < 0.01, "it ends at the river's spring");
    // The spring itself is real fresh water (the river the swimmers, drinkers and fishers already use).
    const spring = F.sampleWildGround(F.RIVER_UPPER[0].x, F.RIVER_UPPER[0].z);
    assert.equal(F.underWater(spring), "fresh");
});

test("falls: the pool and the cliff keep clear of every tree trunk and of the river", async () => {
    const F = await load();
    const {worldDecor} = await import("@/ark-scene/decor");
    for (const item of worldDecor()) {
        if (Math.hypot(item.x - F.POOL.x, item.z - F.POOL.z) > 30) continue;
        if (["broadleaf", "rainforest", "conifer", "acacia", "palm", "orchard", "canopy", "cactus"].includes(item.kind)) {
            assert.ok(!F.inPool(item.x, item.z, 0.2), `a tree stands in the pool at ${item.x.toFixed(1)}, ${item.z.toFixed(1)}`);
        }
    }
    for (const b of F.fallsBlocks()) {
        for (let x = b.x0; x <= b.x1; x += 0.5) {
            for (let z = b.z0; z <= b.z1; z += 0.5) assert.notEqual(F.underWater(F.sampleWildGround(x, z)), "fresh", `the cliff's mass over the river at ${x}, ${z}`);
        }
    }
});

test("falls: the cliff is solid to walkers and the pool kept as drawn water; the falls are heard", async () => {
    const F = await load();
    const {colliderSetFor, resetColliders} = await import("@/ark-scene/collide/colliders");
    resetColliders();
    const set = colliderSetFor(null);
    const cliffs = set.list.filter((c) => c.kind === "cliff");
    assert.ok(cliffs.length >= 8, `${cliffs.length} cliff slices`);
    // Inside the face at mid-height: solid. On the flat south of the pool: clear.
    const inside = {x: F.FALLS_X, z: -90};
    assert.ok(set.blocked(inside.x, inside.z, 0.3, F.wildHeight(inside.x, inside.z), 1), "a walker inside the cliff's mass is blocked");
    assert.ok(set.blocked(F.POOL.x, F.POOL.z, 0.2, F.POOL.level - 0.3, 0.6), "the pool is kept");
    const fallsOnly = new Set(["cliff"] as const);
    assert.ok(!set.deepest(F.FALLS_X, -78, 0.3, F.wildHeight(F.FALLS_X, -78), 1, fallsOnly), "the flat by the spring is clear of the cliff");
    assert.ok(set.deepest(F.FALLS_X - 6, -90, 0.3, F.wildHeight(F.FALLS_X - 6, -90), 1, fallsOnly), "the face beside the water is solid");
    const {waterNear} = await import("@/ark-scene/liveliness-scene");
    const distance = (near: unknown) => (typeof near === "number" ? near : (near as {distance: number} | null)?.distance ?? Infinity);
    const near = waterNear(F.POOL.x, F.POOL.z + 6, 0);
    assert.ok(distance(near.waterfall) < 10, `the falls heard from the pool's side: ${JSON.stringify(near.waterfall)}`);
    const far = waterNear(60, 80, 0);
    assert.ok(Number.isFinite(distance(far.waterfall)) && distance(far.waterfall) > 100);
});
