/**
 * REEF-PATCHES (2026-11-24): the live reef (the v2 wild island's) is a dense main reef where it is seen from under the
 * water, with separate patch reefs and sand channels round it, not one mass. Before, one noise threshold grew a single blob ~60 m across (89% of its coral in one connected piece,
 * 61% of the reef circle covered), which from above read as a tan stain over the lagoon.
 */
// (First: the bigger wild island, v2, what islands mode shows, before anything samples the world.)
import "@/lib/ark-world-v2-first";
import assert from "node:assert/strict";
import test from "node:test";
import {CORAL_MIN_DEPTH, patchReef, reefCloseupSpot, reefCore, reefGrowth, reefLandmarks} from "@/ark-scene/reef";
import {heightAt, sampleGround, TERRAIN_HALF, ZONE_SITES} from "@/ark-scene/world";
import {coralCover, CORAL_TEXELS, linearOf} from "@/ark-scene/coral-cover";

test("REEF-PATCHES: the reef's coral heads are separate patches with sand channels between", () => {
    const site = ZONE_SITES.coral_reef;
    const heads = reefGrowth().filter((i) => i.kind !== "kelp" && i.kind !== "seagrass" && i.kind !== "encrusting" && Math.hypot(i.x - site.x, i.z - site.z) <= 34);
    assert.ok(heads.length > 600, `still a reef: ${heads.length} heads`);
    // 2 m cells over the reef's circle: which hold a head, and how they join (4-neighbours).
    const cell = 2;
    const grid = new Set<string>();
    for (const h of heads) grid.add(`${Math.floor((h.x - site.x) / cell)},${Math.floor((h.z - site.z) / cell)}`);
    let total = 0;
    for (let i = -17; i < 17; i++) for (let j = -17; j < 17; j++) if (Math.hypot((i + 0.5) * cell, (j + 0.5) * cell) <= 34) total++;
    const seen = new Set<string>();
    const sizes: number[] = [];
    for (const k of grid) {
        if (seen.has(k)) continue;
        let size = 0;
        const stack = [k];
        seen.add(k);
        while (stack.length) {
            const [a, b] = stack.pop()!.split(",").map(Number);
            size++;
            for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const q = `${a + da},${b + db}`;
                if (grid.has(q) && !seen.has(q)) {
                    seen.add(q);
                    stack.push(q);
                }
            }
        }
        sizes.push(size);
    }
    sizes.sort((a, b) => b - a);
    const cover = grid.size / total;
    assert.ok(cover > 0.4 && cover < 0.56, `about half the reef's circle is coral, the rest sand: ${cover.toFixed(2)}`);
    // The main reef (where it is seen from under the water) is one dense piece; round it, separate patches.
    assert.ok(sizes.filter((s) => s >= 3).length >= 6, `the main reef and at least 5 separate patches: ${sizes.slice(0, 10).join(",")}`);
    let inCore = 0;
    let coreCells = 0;
    for (let i = -17; i < 17; i++) {
        for (let j = -17; j < 17; j++) {
            const x = site.x + (i + 0.5) * cell;
            const z = site.z + (j + 0.5) * cell;
            if (reefCore(x, z) < 0.99 || sampleGround(x, z).height > -CORAL_MIN_DEPTH - 0.6) continue;
            coreCells++;
            if (grid.has(`${i},${j}`)) inCore++;
        }
    }
    assert.ok(coreCells > 100 && inCore / coreCells > 0.6, `the main reef is dense, as the old carpet was: ${inCore} of ${coreCells} cells`);
});

test("REEF-PATCHES: the patch field is pure, 0 off the reef, and the close-up reef keeps its heads and fish landmarks", () => {
    assert.equal(patchReef(-150, 160, 0.8), patchReef(-150, 160, 0.8));
    let on = 0;
    let off = 0;
    for (let k = 0; k < 400; k++) {
        const v = patchReef(-180 + (k % 20) * 2.1, 130 + Math.floor(k / 20) * 2.3, 0.8);
        assert.ok(v >= 0 && v <= 1);
        if (v > 0.5) on++;
        else if (v < 0.05) off++;
    }
    assert.ok(on > 60 && off > 120, `both patch and channel: ${on} on, ${off} off of 400`);
    const marks = reefLandmarks();
    assert.ok(marks.heads.length >= 5, "fish still hover over big heads");
    const spot = reefCloseupSpot();
    const near = reefGrowth().filter((i) => i.kind !== "seagrass" && i.kind !== "kelp" && Math.hypot(i.x - spot.x, i.z - spot.z) < 3);
    assert.ok(near.length >= 12, `the close-up's head has its reef round it: ${near.length}`);
});

test("REEF-PATCHES: from above (the water's cover map) the reef is separate dark patches with clear sand between", () => {
    const size = CORAL_TEXELS;
    const map = coralCover(reefGrowth(), TERRAIN_HALF, size);
    const site = ZONE_SITES.coral_reef;
    const texel = (2 * TERRAIN_HALF) / size;
    // The texels over the reef's circle the water shows as coral (the shader's threshold, 0.5) and as clear sand.
    const coral = new Set<number>();
    let clear = 0;
    let all = 0;
    for (let tz = 0; tz < size; tz++) {
        for (let tx = 0; tx < size; tx++) {
            const x = -TERRAIN_HALF + (tx + 0.5) * texel;
            const z = -TERRAIN_HALF + (tz + 0.5) * texel;
            if (Math.hypot(x - site.x, z - site.z) > 30) continue;
            all++;
            const a = map[(tz * size + tx) * 4 + 3] / 255;
            if (a > 0.5) coral.add(tz * size + tx);
            else if (a < 0.04) clear++;
        }
    }
    const seen = new Set<number>();
    const pieces: number[] = [];
    for (const k of coral) {
        if (seen.has(k)) continue;
        let n = 0;
        const stack = [k];
        seen.add(k);
        while (stack.length) {
            const c = stack.pop()!;
            n++;
            for (const d of [1, -1, size, -size]) if (coral.has(c + d) && !seen.has(c + d)) (seen.add(c + d), stack.push(c + d));
        }
        pieces.push(n);
    }
    pieces.sort((a, b) => b - a);
    assert.ok(pieces.filter((n) => n >= 4).length >= 6, `the main reef and separate patches from above: ${pieces.slice(0, 10).join(",")}`);
    assert.ok(clear / all > 0.2, `clear sand channels: ${(clear / all).toFixed(2)} of the circle`);
});

test("coral cover: the reef's own growths where they grow, their own colours, nothing over land", () => {
    const items = reefGrowth();
    const cover = coralCover(items, TERRAIN_HALF);
    assert.equal(cover.length, CORAL_TEXELS * CORAL_TEXELS * 4);
    const texel = (2 * TERRAIN_HALF) / CORAL_TEXELS;
    let covered = 0;
    for (let i = 0; i < CORAL_TEXELS * CORAL_TEXELS; i++) {
        if (!cover[i * 4 + 3]) continue;
        covered++;
        const x = -TERRAIN_HALF + ((i % CORAL_TEXELS) + 0.5) * texel;
        const z = -TERRAIN_HALF + (Math.floor(i / CORAL_TEXELS) + 0.5) * texel;
        assert.ok(heightAt(x, z) < 0.5, `cover over land at ${x.toFixed(0)}, ${z.toFixed(0)}`);
    }
    assert.ok(covered > 500, `covered texels ${covered}`);
    const own = items.map((item) => linearOf(item.color).map((c) => Math.round(Math.min(c, 1) * 255)));
    for (let c = 0; c < 3; c++) {
        const low = Math.min(...own.map((rgb) => rgb[c]));
        const high = Math.max(...own.map((rgb) => rgb[c]));
        for (let i = 0; i < CORAL_TEXELS * CORAL_TEXELS; i += 7) if (cover[i * 4 + 3]) assert.ok(cover[i * 4 + c] >= low - 1 && cover[i * 4 + c] <= high + 1);
    }
    assert.deepEqual(coralCover(items, TERRAIN_HALF), cover, "the same for every viewer");
});
