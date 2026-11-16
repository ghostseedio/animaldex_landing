import assert from "node:assert/strict";
import {test} from "node:test";
import {BREATH_UP, BUBBLE_RISE, BubblePool, POOL_SIZE, SwimmerBubbles, VENT_BUBBLES, VENT_LIMIT, VENT_MAX_DEPTH, VENT_MIN_DEPTH, VENT_SPACING, seaVents, ventBubble, type BubblePoint} from "@/ark-scene/sea-bubbles";
import {seaBedAt} from "@/ark-scene/reef";
import {heightAt} from "@/ark-scene/world";

test("vents: on the sea bed, in 2.2–14 m of water, off the reef's framework, spaced, the same every time", () => {
    const vents = seaVents();
    assert.ok(vents.length >= 6 && vents.length <= VENT_LIMIT, `${vents.length} vents`);
    assert.equal(seaVents(), vents);
    for (let i = 0; i < vents.length; i++) {
        const vent = vents[i];
        assert.ok(vent.depth >= VENT_MIN_DEPTH && vent.depth <= VENT_MAX_DEPTH, `vent ${i} in ${vent.depth} m`);
        assert.ok(Math.abs(vent.y - heightAt(vent.x, vent.z)) < 1e-6);
        assert.notEqual(seaBedAt(vent.x, vent.z).substrate, "reef");
        for (const other of vents.slice(0, i)) assert.ok(Math.hypot(vent.x - other.x, vent.z - other.z) >= VENT_SPACING);
    }
});

test("a vent's bubbles: between the bed and the surface, rising, swelling, the clock's wrap unseen", () => {
    const out: BubblePoint = {x: 0, y: 0, z: 0, size: 0};
    const later: BubblePoint = {x: 0, y: 0, z: 0, size: 0};
    for (const vent of seaVents().slice(0, 8)) {
        let drawn = 0;
        for (let j = 0; j < VENT_BUBBLES; j++) {
            for (const t of [0, 7.3, 211.9, 599.5]) {
                ventBubble(vent, j, t, out);
                if (out.size <= 0) continue;
                drawn++;
                assert.ok(out.y > vent.y && out.y < -0.05, `bubble at ${out.y} over a bed at ${vent.y}`);
                assert.ok(Math.hypot(out.x - vent.x, out.z - vent.z) < 0.6);
                ventBubble(vent, j, t + 0.1, later);
                if (later.size > 0 && later.y > out.y) {
                    assert.ok(Math.abs(later.y - out.y - 0.1 * BUBBLE_RISE) < 1e-6);
                    assert.ok(later.size > out.size);
                }
                ventBubble(vent, j, t + 600, later);
                assert.ok(Math.abs(later.x - out.x) < 1e-6 && Math.abs(later.y - out.y) < 1e-6 && Math.abs(later.size - out.size) < 1e-9);
            }
        }
        assert.ok(drawn > VENT_BUBBLES, "most of a chain is in the water at any moment");
    }
});

test("the pool: never more than its capacity, bubbles rise and end at the surface, nothing is left", () => {
    const pool = new BubblePool(POOL_SIZE.low);
    assert.equal(pool.live, 0);
    pool.emit(1, -3, 2, 20, 0.2, 0.03);
    assert.equal(pool.live, 20);
    // Far more than it holds: the oldest are overwritten.
    for (let k = 0; k < 30; k++) pool.emit(1, -3, 2, 25, 0.2, 0.03);
    assert.equal(pool.live, POOL_SIZE.low);
    pool.emit(0, -1, 0, 100000, 0.1, 0.02);
    assert.equal(pool.live, POOL_SIZE.low);
    const positions = new Float32Array(POOL_SIZE.low * 3);
    const sizes = new Float32Array(POOL_SIZE.low);
    assert.equal(pool.write(positions, sizes, 0), POOL_SIZE.low);
    // A buffer with less room takes only what fits.
    assert.equal(pool.write(new Float32Array(30), new Float32Array(10), 4), 6);
    const before = positions[1];
    pool.step(0.05);
    pool.write(positions, sizes, 0);
    assert.ok(positions[1] > before, "it rises");
    for (let k = 0; k < 200; k++) {
        pool.step(0.05);
        const n = pool.write(positions, sizes, 0);
        for (let i = 0; i < n; i++) assert.ok(positions[i * 3 + 1] <= -0.04 + 1e-6, "never above the surface");
    }
    assert.equal(pool.live, 0);
});

test("swimmers: a burst on the dive, a small one coming up, a trail only when fast, nothing on first sight", () => {
    const pool = new BubblePool(240);
    const swimmers = new SwimmerBubbles(pool);
    // A whale holding still, then up to its breath and down again.
    swimmers.track("whale", 0, -3, 0, 0, 6, 0);
    assert.equal(pool.live, 0);
    swimmers.track("whale", 0, -3, 0, 0.2, 6, 0.016);
    assert.equal(pool.live, 0);
    swimmers.track("whale", 0, -0.5, 0, BREATH_UP + 0.1, 6, 0.032);
    const up = pool.live;
    assert.ok(up > 0 && up <= 10, `${up} coming up`);
    swimmers.track("whale", 0, -0.6, 0, BREATH_UP - 0.1, 6, 0.048);
    const dive = pool.live - up;
    assert.ok(dive > up && dive <= 26, `${dive} on the dive`);
    // A slow fish trails nothing; a fast one does; a jump after a gap does not.
    pool.clear();
    for (let f = 0; f < 120; f++) swimmers.track("slow", f * 0.005, -2, 0, 0, 0.3, f / 60);
    assert.equal(pool.live, 0);
    for (let f = 0; f < 120; f++) swimmers.track("fast", f * 0.05, -2, 0, 0, 0.5, f / 60);
    assert.ok(pool.live >= 5 && pool.live <= 20, `${pool.live} in the trail`);
    pool.clear();
    swimmers.track("fast", 500, -2, 0, 0, 0.5, 30);
    assert.equal(pool.live, 0);
    // The watch list is bounded.
    for (let i = 0; i < 1000; i++) swimmers.track(`a${i}`, 0, -1, 0, 0, 1, 100 + i);
    assert.ok(swimmers.size <= 161);
});
