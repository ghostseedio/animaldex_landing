/**
 * The reef read from above (SEA-SURFACE, 2026-11-24; the survey: from a wide view the reef's corals were past their far
 * reach, `reef-render.ts` REACH, 45–80 m, so the reef read as a band of sand). The corals, sponges, kelp and seagrass
 * `reef.ts` grows are splatted once into a small colour map over the island's square (their own colours, their own
 * places: the same reef as is drawn close by), and the sea's water shader (`terrain.ts`) shows it through the shallow
 * water, absorbed with depth (red first), at any distance. Nothing new is drawn: no instance, no draw call, one texture
 * read in the water's fragment shader.
 *
 * Pure (no three.js): the tests run it in node.
 *
 * REEF-PATCHES (2026-11-24): PR 138 dropped this map because over the old reef layout (one coral mass) it read as a
 * muddy tan stain. Over the patch reefs (`reef.ts` patchReef) it reads as separate heads with sand channels between;
 * the encrusting cover between the heads shows little (CORAL_FOOT), the softening is one texel, and the water shader
 * darkens each head and rings it with a pale grazing halo.
 */

import type {ReefItem, ReefKind} from "@/ark-scene/reef";

/** The map's side (texels): about 1 m a texel over the v2 island's 528 m square (1 MB). */
export const CORAL_TEXELS = 512;

/** How wide each kind covers the bed for its scale (m, radius at scale 1), and how much it shows (0…1) from above. */
export const CORAL_FOOT: Record<ReefKind, [number, number]> = {
    branching: [0.8, 1],
    table: [1.1, 1],
    brain: [0.7, 1],
    massive: [0.9, 1],
    encrusting: [0.8, 0.12],
    fan: [0.45, 0.7],
    anemone: [0.3, 0.8],
    barrel_sponge: [0.45, 0.8],
    tube_sponge: [0.3, 0.7],
    ball_sponge: [0.3, 0.7],
    kelp: [0.5, 0.5],
    seagrass: [0.5, 0.3]
};

/** The softening's reach (texels each way). */
const BLUR = 1;

/** A box blur of `channels`-wide values along rows (`step` 1) or columns (`step` size), in place. */
function boxBlur(values: Float32Array, size: number, step: number, channels: number, reach: number): void {
    const line = new Float32Array(size * channels);
    const across = step === 1 ? size : 1;
    for (let l = 0; l < size; l++) {
        const start = l * across;
        for (let i = 0; i < size; i++) for (let c = 0; c < channels; c++) line[i * channels + c] = values[(start + i * step) * channels + c];
        for (let i = 0; i < size; i++) {
            const from = Math.max(i - reach, 0);
            const to = Math.min(i + reach, size - 1);
            for (let c = 0; c < channels; c++) {
                let sum = 0;
                for (let j = from; j <= to; j++) sum += line[j * channels + c];
                values[(start + i * step) * channels + c] = sum / (2 * reach + 1);
            }
        }
    }
}

/** How full a texel's cover is for its splatted share (1: covered). */
const FULL = 0.8;

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** A `#rrggbb` colour in linear RGB (the water shader mixes in linear). */
export function linearOf(hex: string): [number, number, number] {
    const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
    if (!Number.isFinite(n)) return [0.5, 0.5, 0.5];
    return [linear(((n >> 16) & 255) / 255), linear(((n >> 8) & 255) / 255), linear((n & 255) / 255)];
}

/**
 * The cover map: RGBA bytes, `size`², over the square [−half, half]² (x along the rows, z down the columns, as the water
 * depth map). RGB the colour of the growth with the biggest share of the texel (linear, ×255), A how covered (0…255).
 * Under water only.
 */
export function coralCover(items: readonly ReefItem[], half: number, size = CORAL_TEXELS): Uint8Array {
    const texel = (2 * half) / size;
    // (Per texel: the cover splatted, and the colour of the one growth with the biggest share of it: a mosaic of the
    // reef's own colours, a red fan's patch beside an olive boulder's, not one averaged tan over the whole lagoon.)
    const cover = new Float32Array(size * size);
    const best = new Float32Array(size * size);
    const colour = new Float32Array(size * size * 3);
    for (const item of items) {
        if (item.depth <= 0) continue;
        const [foot, shows] = CORAL_FOOT[item.kind];
        const radius = Math.max(foot * item.scale, 0.15);
        const [r, g, b] = linearOf(item.color);
        const area = Math.PI * radius * radius;
        // (Its share of each texel it covers: a disc splatted over the texels under its square, at least one texel.)
        const x0 = Math.floor((item.x - radius + half) / texel);
        const x1 = Math.floor((item.x + radius + half) / texel);
        const z0 = Math.floor((item.z - radius + half) / texel);
        const z1 = Math.floor((item.z + radius + half) / texel);
        const cells = (x1 - x0 + 1) * (z1 - z0 + 1);
        const each = ((area / (texel * texel)) * shows) / cells;
        for (let tz = Math.max(z0, 0); tz <= Math.min(z1, size - 1); tz++) {
            for (let tx = Math.max(x0, 0); tx <= Math.min(x1, size - 1); tx++) {
                const at = tz * size + tx;
                cover[at] += each;
                if (each > best[at]) {
                    best[at] = each;
                    colour[at * 3] = r;
                    colour[at * 3 + 1] = g;
                    colour[at * 3 + 2] = b;
                }
            }
        }
    }
    // (Softened over a few metres, colour weighted by cover: patches with soft edges from above, not texel squares.)
    const alpha = new Float32Array(size * size);
    const tint = new Float32Array(size * size * 3);
    for (let i = 0; i < size * size; i++) {
        const a = Math.min(cover[i] / FULL, 1);
        alpha[i] = a;
        for (let c = 0; c < 3; c++) tint[i * 3 + c] = colour[i * 3 + c] * a;
    }
    for (const along of [1, size]) {
        boxBlur(alpha, size, along, 1, BLUR);
        boxBlur(tint, size, along, 3, BLUR);
    }
    const out = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
        const a = alpha[i];
        if (a <= 0.004) continue;
        for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(Math.min(tint[i * 3 + c] / a, 1) * 255);
        out[i * 4 + 3] = Math.round(Math.min(a, 1) * 255);
    }
    return out;
}
