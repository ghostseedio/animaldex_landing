import assert from "node:assert/strict";
import test from "node:test";
import {BufferAttribute, BufferGeometry, DataTexture} from "three";
import {ARK_BUDGETS, arkCaps, fittedSize, GRASS_BUILD, overBudget, type LevelUse} from "@/ark-scene/runtime/budgets";
import {FrameBudget, LoadPlanner} from "@/ark-scene/runtime/load";
import {geometryBytes, textureBytes} from "@/ark-scene/runtime/memory";

test("runtime load order: in view and close first, then far, then out of view, then never seen", () => {
    const planner = new LoadPlanner();
    planner.see("fox", 12, true);
    planner.see("deer", 80, true);
    planner.see("seal", 20, false);
    planner.see("deer", 30, true);
    // The nearest in view of a species counts; one out of view does not beat it.
    planner.see("fox", 4, false);
    planner.endFrame();
    const order = ["mole", "seal", "deer", "fox"].sort((a, b) => planner.priority(a, "far") - planner.priority(b, "far"));
    assert.deepEqual(order, ["fox", "deer", "seal", "mole"]);
    // A species' near level ranks just behind its far level, ahead of the next species.
    assert.ok(planner.priority("fox", "far") < planner.priority("fox", "near"));
    assert.ok(planner.priority("fox", "near") < planner.priority("deer", "far"));
    // Not seen for a while: back with the never-seen.
    for (let i = 0; i < 40; i++) planner.endFrame();
    assert.equal(planner.priority("fox", "far"), planner.priority("mole", "far"));
});

test("runtime frame budget: at least one piece of work a frame, then only while the budget lasts", () => {
    let clock = 0;
    const budget = new FrameBudget(4, () => clock);
    budget.begin();
    assert.equal(budget.allows(), true);
    clock = 10;
    assert.equal(budget.allows(), true, "nothing ran yet: one always may");
    budget.ran();
    assert.equal(budget.allows(), false);
    budget.begin();
    budget.ran();
    clock = 12;
    assert.equal(budget.allows(), true);
});

test("runtime budgets: tiers shrink, skins are fitted, the grass is built for the tier", () => {
    for (const key of ["textureMB", "geometryMB", "nearTexture", "farTexture"] as const) {
        assert.ok(ARK_BUDGETS.high[key] >= ARK_BUDGETS.medium[key] && ARK_BUDGETS.medium[key] >= ARK_BUDGETS.low[key], key);
    }
    assert.deepEqual(arkCaps("low"), {near: 40, nearSpecies: 24, models: 80}, "the lighter view's caps, as before");
    assert.deepEqual(arkCaps("high"), {near: 150, nearSpecies: 60, models: 150}, "high keeps the scene's caps");
    assert.ok(GRASS_BUILD.low >= GRASS_BUILD.medium && GRASS_BUILD.medium < GRASS_BUILD.high);
    assert.deepEqual(fittedSize(512, 512, 256), {width: 256, height: 256});
    assert.deepEqual(fittedSize(512, 256, 128), {width: 128, height: 64});
    assert.deepEqual(fittedSize(200, 100, 256), {width: 200, height: 100}, "never up");
});

test("runtime budgets: over the ceiling, the near levels drawn near least recently go first; never far, never recent", () => {
    const mb = 2 ** 20;
    const level = (slug: string, which: "near" | "far", bytes: number, lastNear: number, texture = true): LevelUse => ({slug, level: which, bytes, texture, lastNear});
    const budget = {...ARK_BUDGETS.low, textureMB: 10, geometryMB: 100};
    const levels = [
        level("fox", "near", 4 * mb, 99),
        level("fox", "far", 1 * mb, 0),
        level("deer", "near", 4 * mb, 50),
        level("seal", "near", 4 * mb, 10),
        level("seal", "far", 1 * mb, 0)
    ];
    // 14 MB of skins against 10: the seal's near (drawn near longest ago) goes, and that is enough.
    assert.deepEqual(overBudget(levels, budget, 100), [{slug: "seal", level: "near"}]);
    // Everything drawn near just now: nothing goes, even over the budget.
    assert.deepEqual(overBudget(levels.map((l) => ({...l, lastNear: 99})), budget, 100), []);
    // Under the budget: nothing.
    assert.deepEqual(overBudget(levels, {...budget, textureMB: 64}, 100), []);
});

test("runtime memory: geometry and texture bytes as the GPU holds them", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(300), 3));
    geometry.setIndex(new BufferAttribute(new Uint16Array(60), 1));
    assert.equal(geometryBytes(geometry), 1200 + 120);
    const texture = new DataTexture(new Uint8Array(256 * 256 * 4), 256, 256);
    // A DataTexture has no mipmaps by default (generateMipmaps false).
    assert.equal(textureBytes(texture), 256 * 256 * 4);
    texture.generateMipmaps = true;
    texture.minFilter = 1008;
    assert.equal(textureBytes(texture), Math.round(256 * 256 * 4 * 4 / 3));
});
