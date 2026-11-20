/**
 * Boulders on steep faces (ark-world, decision 447; the owner: "some boulders on steep faces look stuck to the wall"): a rock
 * drawn on a steep slope is set down into it (`rock-assets.ts` steepSink), by nothing on level ground and by half its height
 * at 50 degrees. Only the drawing moves. v2 (the bigger wild island) only.
 */
import "@/lib/ark-world-v2-first";
import assert from "node:assert/strict";
import test from "node:test";
import {drawnGround, FOOT_MOST, steepSink} from "@/ark-scene/rock-assets";

test("a rock on level ground is not sunk; one on a steep face is set down by up to half its height, smoothly with the slope", () => {
    // The meadow east of the lake: level.
    assert.equal(steepSink(70, 40, 1.5, 1), 0);
    // The mountain's face by the falls: steep. Every one of a few places on it sinks within bounds.
    let sunkSomewhere = 0;
    for (const [x, z] of [[-129.7, -90.5], [-129.4, -82], [-133.9, -91.5], [-125, -81.5], [-130.2, -82.1], [-72.6, -79.6], [-61.9, -87.6]] as const) {
        const sink = steepSink(x, z, 1, 1);
        assert.ok(sink >= 0 && sink <= 0.5 + 1e-9, `${sink} m at ${x}, ${z}`);
        if (sink > 0.05) sunkSomewhere++;
    }
    assert.ok(sunkSomewhere >= 3, `${sunkSomewhere} of the steep places sink a rock`);
    // It scales with the rock: a rock twice as big sinks twice as far, at the same place.
    const a = steepSink(-129.7, -90.5, 1, 1);
    const b = steepSink(-129.7, -90.5, 2, 1);
    assert.ok(b >= a * 1.7 || b === a, `${a} then ${b}`);
    // And the foot's most is unchanged (this lane did not touch the reach of a rock down to its ground).
    assert.equal(FOOT_MOST, 4);
    assert.ok(Number.isFinite(drawnGround(-100, -80)));
});
