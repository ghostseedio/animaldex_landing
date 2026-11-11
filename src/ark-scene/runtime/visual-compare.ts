/**
 * The visual-regression comparison (runtime lane, docs/ark/visual-ci.md): a golden shot against its baseline, as
 * raw RGBA. Pure, so the tests run it on numbers and `scripts/ark-visual.mts` on decoded images.
 *
 * Three measures, each with a tolerance:
 * - `changed`: the share of pixels whose largest channel difference passes `pixel` (0–255);
 * - `mean`: the mean absolute difference over all channels (0–255);
 * - `block`: the worst 1/16 × 1/16 tile's changed share (a local break: a missing house, a black shard).
 */

export type VisualTolerance = {pixel: number; changed: number; mean: number; block: number};

export const DEFAULT_TOLERANCE: VisualTolerance = {pixel: 24, changed: 0.012, mean: 2.5, block: 0.35};

export type VisualDiff = {
    width: number;
    height: number;
    changed: number;
    mean: number;
    block: number;
    /** Where the worst tile is (column, row of 16). */
    blockAt: [number, number];
    pass: boolean;
    /** Which measures failed. */
    failed: Array<"size" | "changed" | "mean" | "block">;
};

/** Compare two RGBA images of `width × height` (alpha ignored). `mask` (optional): 1 per pixel to diff, written to it. */
export function compareImages(actual: Uint8Array | Uint8ClampedArray, baseline: Uint8Array | Uint8ClampedArray, width: number, height: number, tolerance: VisualTolerance = DEFAULT_TOLERANCE, mask?: Uint8Array): VisualDiff {
    const pixels = width * height;
    if (actual.length < pixels * 4 || baseline.length < pixels * 4 || actual.length !== baseline.length) {
        return {width, height, changed: 1, mean: 255, block: 1, blockAt: [0, 0], pass: false, failed: ["size"]};
    }
    const tiles = 16;
    const tileChanged = new Float64Array(tiles * tiles);
    const tileCount = new Float64Array(tiles * tiles);
    let changed = 0;
    let sum = 0;
    for (let y = 0; y < height; y++) {
        const ty = Math.min(Math.floor((y * tiles) / height), tiles - 1);
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const dr = Math.abs(actual[i] - baseline[i]);
            const dg = Math.abs(actual[i + 1] - baseline[i + 1]);
            const db = Math.abs(actual[i + 2] - baseline[i + 2]);
            sum += dr + dg + db;
            const tile = ty * tiles + Math.min(Math.floor((x * tiles) / width), tiles - 1);
            tileCount[tile]++;
            const hit = Math.max(dr, dg, db) > tolerance.pixel;
            if (hit) {
                changed++;
                tileChanged[tile]++;
            }
            if (mask) mask[y * width + x] = hit ? 1 : 0;
        }
    }
    let block = 0;
    let blockAt: [number, number] = [0, 0];
    for (let t = 0; t < tiles * tiles; t++) {
        const share = tileCount[t] ? tileChanged[t] / tileCount[t] : 0;
        if (share > block) {
            block = share;
            blockAt = [t % tiles, Math.floor(t / tiles)];
        }
    }
    const share = changed / pixels;
    const mean = sum / (pixels * 3);
    const failed: VisualDiff["failed"] = [];
    if (share > tolerance.changed) failed.push("changed");
    if (mean > tolerance.mean) failed.push("mean");
    if (block > tolerance.block) failed.push("block");
    const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;
    return {width, height, changed: round(share, 5), mean: round(mean, 3), block: round(block, 4), blockAt, pass: failed.length === 0, failed};
}

/** A picture of the difference: the actual image dimmed to grey, changed pixels in magenta. RGBA. */
export function diffPicture(actual: Uint8Array | Uint8ClampedArray, mask: Uint8Array, width: number, height: number): Uint8Array {
    const out = new Uint8Array(width * height * 4);
    for (let p = 0; p < width * height; p++) {
        const i = p * 4;
        if (mask[p]) {
            out[i] = 255;
            out[i + 1] = 0;
            out[i + 2] = 200;
        } else {
            const grey = Math.round((actual[i] * 0.3 + actual[i + 1] * 0.59 + actual[i + 2] * 0.11) * 0.45);
            out[i] = out[i + 1] = out[i + 2] = grey;
        }
        out[i + 3] = 255;
    }
    return out;
}

/** A shot's tolerance: the defaults, then the config's, then the shot's own override. */
export function toleranceFor(id: string, config: {tolerance?: Partial<VisualTolerance>; overrides?: Record<string, Partial<VisualTolerance>>}): VisualTolerance {
    return {...DEFAULT_TOLERANCE, ...(config.tolerance ?? {}), ...(config.overrides?.[id] ?? {})};
}
