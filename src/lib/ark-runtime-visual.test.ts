import assert from "node:assert/strict";
import test from "node:test";
import config from "../../tests/ark-visual/config.json";
import hooks from "../../tests/ark-visual/hooks.json";
import {GOLDEN_PLACES, GOLDEN_TIMES} from "@/ark-scene/golden-shots";
import {compareImages, DEFAULT_TOLERANCE, diffPicture, toleranceFor} from "@/ark-scene/runtime/visual-compare";

function image(width: number, height: number, fill: (x: number, y: number) => [number, number, number]): Uint8Array {
    const out = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const [r, g, b] = fill(x, y);
            const i = (y * width + x) * 4;
            out[i] = r;
            out[i + 1] = g;
            out[i + 2] = b;
            out[i + 3] = 255;
        }
    }
    return out;
}

const W = 640;
const H = 400;
const scene = (x: number, y: number): [number, number, number] => [(x * 3) % 256, (y * 5) % 256, ((x + y) * 2) % 256];

test("visual compare: the same picture passes; noise under the pixel threshold passes", () => {
    const a = image(W, H, scene);
    assert.equal(compareImages(a, a, W, H).pass, true);
    // ±10 everywhere (a lossy baseline, a driver's rounding): under the pixel threshold, mean 10 over the mean's.
    const noisy = image(W, H, (x, y) => scene(x, y).map((v) => Math.min(255, v + ((x + y) % 2 ? 2 : 1))) as [number, number, number]);
    const diff = compareImages(noisy, a, W, H);
    assert.equal(diff.changed, 0);
    assert.equal(diff.pass, true, JSON.stringify(diff));
});

test("visual compare: a small moving animal passes; a broad change, a subtle shift and a local break fail", () => {
    const a = image(W, H, scene);
    // A 12 × 10 animal somewhere else: 0.05 % of the picture, an eighth of one tile.
    const moved = image(W, H, (x, y) => (x >= 45 && x < 57 && y >= 30 && y < 40 ? [255, 0, 0] : scene(x, y)));
    assert.equal(compareImages(moved, a, W, H).pass, true);
    // The light: +40 on a quarter of the picture.
    const lit = image(W, H, (x, y) => (y < H / 4 ? scene(x, y).map((v) => Math.min(255, v + 40)) as [number, number, number] : scene(x, y)));
    const broad = compareImages(lit, a, W, H);
    assert.equal(broad.pass, false);
    assert.ok(broad.failed.includes("changed"));
    // A grade: +6 everywhere, no pixel past the threshold, but the mean moves.
    const graded = image(W, H, (x, y) => scene(x, y).map((v) => Math.min(255, v + 6)) as [number, number, number]);
    const subtle = compareImages(graded, a, W, H);
    assert.deepEqual(subtle.failed, ["mean"]);
    // A hole: one tile (40 × 25 px) black, 0.4 % of the picture but the whole tile.
    const hole = image(W, H, (x, y) => (x < 40 && y < 25 ? [0, 0, 0] : scene(x, y)));
    const local = compareImages(hole, a, W, H);
    assert.ok(local.failed.includes("block"), JSON.stringify(local));
    assert.deepEqual(local.blockAt, [0, 0]);
    // Another size: a failure, never a crash.
    assert.deepEqual(compareImages(a, image(W, H - 1, scene), W, H).failed, ["size"]);
});

test("visual compare: the diff picture marks what changed; tolerances layer default < config < shot", () => {
    const a = image(W, H, scene);
    const b = image(W, H, (x, y) => (x === 5 && y === 5 ? [0, 0, 0] : scene(x, y)));
    const mask = new Uint8Array(W * H);
    compareImages(b, a, W, H, DEFAULT_TOLERANCE, mask);
    const picture = diffPicture(b, mask, W, H);
    const i = (5 * W + 5) * 4;
    assert.deepEqual(Array.from(picture.slice(i, i + 4)), [255, 0, 200, 255]);
    assert.equal(mask.reduce((sum, v) => sum + v, 0), 1);
    const tolerance = toleranceFor("desktop-reef_underwater-day", {tolerance: {mean: 3}, overrides: {"desktop-reef_underwater-day": {changed: 0.05}}});
    assert.equal(tolerance.mean, 3);
    assert.equal(tolerance.changed, 0.05);
    assert.equal(tolerance.pixel, DEFAULT_TOLERANCE.pixel);
});

test("visual CI set: every shot names a golden place, light and device; ids are unique; hooks name what they need", () => {
    const ids = new Set<string>();
    for (const shot of config.shots) {
        assert.ok((GOLDEN_PLACES as readonly string[]).includes(shot.place), shot.place);
        assert.ok(shot.time in GOLDEN_TIMES, shot.time);
        assert.ok(shot.device in config.devices, shot.device);
        const id = `${shot.device}-${shot.place}-${shot.time}`;
        assert.ok(!ids.has(id), id);
        ids.add(id);
    }
    for (const hook of hooks.hooks) {
        assert.ok(hook.requires.length > 0 && hook.command.length > 0, hook.name);
    }
});
