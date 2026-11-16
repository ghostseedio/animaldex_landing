import assert from "node:assert/strict";
import {test} from "node:test";
import {HAZE_DEEP, HAZE_SHALLOW, SNOW_BOX, SNOW_COUNT, SNOW_PERIOD, deepness, snowPoint, snowSeed, underwaterLook, type UnderwaterLook} from "@/ark-scene/sea-look";

const look = (depth: number, daylight: number): UnderwaterLook => underwaterLook(depth, daylight, {r: 0, g: 0, b: 0, density: 0});

test("the water deepens going down: dimmer, bluer, thicker", () => {
    let last = look(0, 1);
    assert.equal(last.density, HAZE_SHALLOW);
    for (const depth of [1, 2, 4, 8, 12, 20, 40, 80]) {
        const now = look(depth, 1);
        assert.ok(now.density > last.density && now.density < HAZE_DEEP, `haze at ${depth} m`);
        assert.ok(now.r < last.r && now.g < last.g && now.b < last.b, `dimmer at ${depth} m`);
        // The green goes faster than the blue (until both are gone to the deep's own blue).
        assert.ok(now.b / now.g >= last.b / last.g - 1e-9 && (depth > 20 || now.b / now.g > last.b / last.g), `bluer at ${depth} m`);
        last = now;
    }
    assert.ok(deepness(-3) === 0 && deepness(1000) <= 1);
    // Far down it is nearly black, and the shelf (to 10 m) is not dimmed by the abyss at all.
    assert.ok(look(100, 1).b < 0.08 && look(10, 1).b > 0.36);
});

test("night is darker than day at every depth, and daylight is clamped", () => {
    for (const depth of [0, 3, 10]) {
        const day = look(depth, 1);
        const night = look(depth, 0);
        assert.ok(night.r < day.r && night.g < day.g && night.b < day.b);
        assert.deepEqual(look(depth, 4), day);
        assert.deepEqual(look(depth, -2), night);
        assert.equal(day.density, night.density);
    }
});

test("marine snow: every mote stays in the box about the camera, wherever the camera is", () => {
    const out = {x: 0, y: 0, z: 0};
    for (const [cx, cy, cz] of [[0, -2, 0], [61.3, -7.5, -118.2], [-240, -0.4, 300]]) {
        for (let i = 0; i < SNOW_COUNT.high; i += 7) {
            for (const t of [0, 13.7, 299, 599.99]) {
                snowPoint(i, t, cx, cy, cz, out);
                assert.ok(Math.abs(out.x - cx) <= SNOW_BOX.x / 2 + 1e-6 && Math.abs(out.y - cy) <= SNOW_BOX.y / 2 + 1e-6 && Math.abs(out.z - cz) <= SNOW_BOX.z / 2 + 1e-6);
            }
        }
    }
});

test("marine snow: the clock's wrap is not seen, motes sink, and the field is even", () => {
    const a = {x: 0, y: 0, z: 0};
    const b = {x: 0, y: 0, z: 0};
    const near = (p: number, q: number, box: number) => Math.min(Math.abs(p - q), box - Math.abs(p - q)) < 1e-6;
    for (let i = 0; i < 200; i++) {
        snowPoint(i, 0, 3, -4, 5, a);
        snowPoint(i, SNOW_PERIOD, 3, -4, 5, b);
        assert.ok(near(a.x, b.x, SNOW_BOX.x) && near(a.y, b.y, SNOW_BOX.y) && near(a.z, b.z, SNOW_BOX.z), `mote ${i} at the wrap`);
        // A second on, it is lower (unless it wrapped to the top of the box).
        snowPoint(i, 1, 3, -4, 5, b);
        assert.ok(b.y < a.y || b.y - a.y > SNOW_BOX.y / 2);
    }
    // Even: each eighth of the seed cube holds about an eighth of the motes.
    const cells = new Array(8).fill(0);
    for (let i = 0; i < SNOW_COUNT.high; i++) {
        snowSeed(i, a);
        assert.ok(a.x >= 0 && a.x < 1 && a.y >= 0 && a.y < 1 && a.z >= 0 && a.z < 1);
        cells[(a.x < 0.5 ? 0 : 1) + (a.y < 0.5 ? 0 : 2) + (a.z < 0.5 ? 0 : 4)]++;
    }
    for (const n of cells) assert.ok(Math.abs(n - SNOW_COUNT.high / 8) < SNOW_COUNT.high * 0.03, `cell holds ${n}`);
    assert.ok(SNOW_COUNT.low < SNOW_COUNT.medium && SNOW_COUNT.medium < SNOW_COUNT.high);
});
