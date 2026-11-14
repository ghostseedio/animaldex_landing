/**
 * The map lane of the graphics pass (2026-11-14): the river's tidal reach (`water-level.ts`, the fresh water's
 * `arkTidal`), so the river's drawn surface meets the sea's at every tide.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {tidalFreshLevel, tidalReach} from "@/ark-scene/water-level";
import {arkWorld, setArkWorld} from "@/ark-scene/world";

test("map pass: the river's tidal reach follows the sea only where the river is nearly down to it", () => {
    // The lake (6 m), the wetland's pools (0.95 m) and the river above its last stretch never move with the tide.
    for (const level of [21, 6, 1.35, 0.95, 0.62, 0.4, 0.2]) {
        assert.equal(tidalReach(level), 0, `no tide at ${level} m`);
        for (const sea of [-0.35, 0, 0.35]) assert.equal(tidalFreshLevel(level, sea), level);
    }
    // Where it meets the sea (its level 0.05 m and under) it stands at the sea's level, at low and high water alike.
    for (const sea of [-0.35, -0.1, 0, 0.2, 0.35]) {
        assert.ok(Math.abs(tidalFreshLevel(0.05, sea) - sea) < 1e-9, `at the sea's level (${sea})`);
        assert.ok(Math.abs(tidalFreshLevel(0, sea) - sea) < 1e-9);
    }
    // In between it eases: never above the higher of the two levels, never below the lower, and no step along it
    // (a centimetre of river level never moves the drawn surface by more than seven: the river falls about a
    // centimetre a metre there, so its drawn slope stays under 7 cm a metre at the lowest water).
    for (const sea of [-0.35, 0, 0.35]) {
        let last = tidalFreshLevel(0.05, sea);
        for (let level = 0.05; level <= 0.5; level += 0.01) {
            const drawn = tidalFreshLevel(level, sea);
            assert.ok(drawn <= Math.max(level, sea) + 1e-9 && drawn >= Math.min(level, sea) - 1e-9, `between the two at ${level.toFixed(2)}`);
            assert.ok(Math.abs(drawn - last) < 0.07, `no step at ${level.toFixed(2)} (sea ${sea}): ${Math.abs(drawn - last).toFixed(3)}`);
            last = drawn;
        }
    }
});

test("map pass: the v2 fresh water's vertices carry the tidal weight: none on the lake, whole at the river's mouth", async () => {
    const before = arkWorld();
    setArkWorld("v2");
    try {
        const {freshWaterGeometry, wildGroundArrays} = await import("@/ark-scene/islands/wild/render/ground");
        const {LAKE} = await import("@/ark-scene/islands/wild/fields");
        const geometry = freshWaterGeometry(wildGroundArrays());
        const position = geometry.getAttribute("position");
        const tidal = geometry.getAttribute("arkTidal");
        assert.ok(tidal, "the attribute the water's vertex shader reads");
        assert.equal(tidal.count, position.count);
        let lake = 0;
        let whole = 0;
        let part = 0;
        for (let i = 0; i < position.count; i++) {
            const weight = tidal.getX(i);
            assert.ok(weight >= 0 && weight <= 1);
            assert.ok(Math.abs(weight - tidalReach(position.getY(i))) < 1e-6, "from the vertex's own level");
            if (Math.abs(position.getY(i) - LAKE.level) < 1e-3) {
                assert.equal(weight, 0, "the lake does not move with the tide");
                lake++;
            }
            if (weight > 0.99) whole++;
            else if (weight > 0) part++;
        }
        assert.ok(lake > 1000, `the lake measured (${lake} vertices)`);
        assert.ok(whole > 0, "the river's end stands at the sea's level");
        assert.ok(part > whole, `the reach above it eases (${part} eased, ${whole} whole)`);
    } finally {
        setArkWorld(before);
    }
});
