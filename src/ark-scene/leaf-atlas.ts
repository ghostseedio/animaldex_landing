/**
 * The trees' leaf pictures (pass 3, lane TREES; the owner, 2026-11-16: "make leaves look like real foliage up close").
 *
 * A broadleaf crown was solid polygons: fans with a jagged rim for its leaf masses, diamonds for its single leaves, so
 * from a few metres a crown read as a pile of flat green shapes. Games draw foliage as cards carrying a picture of real
 * leaves, cut out by its alpha; the library's trees now do the same (`scripts/ark-assets/trees.py`, `LEAF_TEX`): each
 * leaf mass is a card with a spray of leaves on it, each single leaf a diamond with one leaf on it.
 *
 * The pictures are drawn here, in code, at load (no download, no outside texture): one 512² atlas of seven cells, each
 * a kind of leaf (`LEAF_CELLS`, the same numbers as trees.py), every leaf with its own shade, a lighter midrib and
 * veins, a darker rim, and a slight fold (both halves tilted off the midrib) and curl in its normal:
 *
 *   R  the leaf's shade (0.5: the vertex colour as it is; the species colour stays in the vertex colour)
 *   G  the surface normal's x (across the cell), B its y (up the cell), each 0.5 + n / 2
 *   A  coverage (cut at 0.5 by the shader: `asset-trees.ts`)
 *
 * Mipmapped by hand (five levels, each cell's coverage held: a level's alpha is scaled until as many texels pass the cut
 * as at full size), so a crown far off neither thins out to sky nor shimmers; colour is averaged by coverage, so no
 * dark fringe bleeds in from the empty texels. Deterministic: the same atlas on every device.
 *
 * Which picture, and which corner of it, rides in each vertex's colour alpha (`cell * 16 + cu + 3 * cv`; 255: none):
 * see trees.py `tex_code`. Memory: 512 × 512 × 4 bytes and its levels, 1.4 MB on the GPU, once for every tree.
 */

import {DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, UnsignedByteType} from "three";

export const LEAF_ATLAS_SIZE = 512;
/** The atlas's levels (512 … 32): past 32 px a 128 px cell is 8 texels, where the trees are on their far cards. */
export const LEAF_ATLAS_LEVELS = 5;

export type LeafKind = "lobed" | "ovate" | "pinnate" | "lance" | "palmate";
/** Each cell: [x, y, w, h] in texels (y up from the atlas's first row, a leaf's stalk end), a spray or a single leaf. */
export const LEAF_CELLS: ReadonlyArray<{kind: LeafKind; spray: boolean; rect: readonly [number, number, number, number]}> = [
    {kind: "lobed", spray: true, rect: [0, 0, 256, 256]},
    {kind: "ovate", spray: true, rect: [256, 0, 256, 256]},
    {kind: "pinnate", spray: true, rect: [0, 256, 256, 256]},
    {kind: "lobed", spray: false, rect: [256, 256, 128, 128]},
    {kind: "ovate", spray: false, rect: [384, 256, 128, 128]},
    {kind: "lance", spray: false, rect: [256, 384, 128, 128]},
    {kind: "palmate", spray: false, rect: [384, 384, 128, 128]}
];

/** The cells as the shader's uniform: [u, v, w, h] per cell, in the atlas's 0..1. */
export function leafCellUniform(): number[] {
    return LEAF_CELLS.flatMap(({rect}) => rect.map((value) => value / LEAF_ATLAS_SIZE));
}

/** The atlas's alpha cut (the shader's). */
export const LEAF_CUT = 0.5;

function mulberry(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/**
 * A leaf's half-width at s (0 its stalk end, 1 its tip), as a share of its length, before the rim's teeth. Each kind's
 * real outline: an oak's rounded lobes, an ovate leaf's pointed oval (beech, birch, lime, the fruit trees), a willow's
 * and a palm leaflet's long narrow blade, an acacia leaflet's small oval.
 */
function halfWidth(kind: LeafKind, s: number): number {
    if (s <= 0 || s >= 1) return 0;
    switch (kind) {
        case "lobed": {
            const body = 0.3 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.85)), 0.75);
            return body * (0.58 + 0.42 * Math.pow(Math.abs(Math.sin(Math.PI * (4.5 * s - 0.15))), 0.55));
        }
        case "ovate":
            return 0.29 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 0.8) * (1 - 0.35 * Math.pow(s, 6));
        case "lance":
            // Drawn as wide as an ovate leaf: its diamond (a willow's or palm leaflet's, 3 to 7 times longer than wide)
            // makes it narrow.
            return 0.27 * Math.pow(Math.sin(Math.PI * s), 0.7);
        case "pinnate":
            return 0.26 * Math.pow(Math.sin(Math.PI * s), 0.6);
        case "palmate":
            return 0;
    }
}

const HALF_STEPS = 512;
const halfTables = new Map<LeafKind, Float32Array>();
/** `halfWidth` from a table (the drawing's inner loop). */
function halfWidthAt(kind: LeafKind, s: number): number {
    if (s <= 0 || s >= 1) return 0;
    let table = halfTables.get(kind);
    if (!table) {
        table = new Float32Array(HALF_STEPS + 1);
        for (let i = 0; i <= HALF_STEPS; i++) table[i] = halfWidth(kind, i / HALF_STEPS);
        halfTables.set(kind, table);
    }
    const f = s * HALF_STEPS;
    const i = Math.floor(f);
    return table[i] + (table[Math.min(i + 1, HALF_STEPS)] - table[i]) * (f - i);
}

/** A plane leaf (palmate): five pointed lobes round the stalk's end (polar about it, as a share of the length). */
function palmateRadius(angle: number): number {
    const lobes = [0, 0.8, -0.8, 1.55, -1.55];
    let r = 0.22;
    for (const lobe of lobes) {
        const d = angle - lobe;
        r = Math.max(r, (lobe === 0 ? 0.6 : Math.abs(lobe) < 1 ? 0.54 : 0.4) * Math.pow(Math.max(0, Math.cos(d * 1.7)), 1.3));
    }
    return Math.abs(angle) > 2.3 ? 0 : r;
}

type Canvas = {w: number; h: number; lum: Float32Array; nx: Float32Array; ny: Float32Array; a: Float32Array};

/**
 * Draws one leaf over what is there: stalk end at (x, y) texels, pointing along `angle` (0 = up the cell), `length`
 * texels long, shade `shade`, clipped to the cell rect (with a 2-texel margin, so no level bleeds into its neighbour).
 */
function drawLeaf(c: Canvas, rect: readonly number[], kind: LeafKind, x: number, y: number, angle: number, length: number, shade: number, teeth: number) {
    const ax = Math.sin(angle);
    const ay = Math.cos(angle);
    const reach = length * (kind === "palmate" ? 0.75 : 1.02);
    const x0 = Math.max(rect[0] + 2, Math.floor(Math.min(x, x + ax * length) - reach * 0.7));
    const x1 = Math.min(rect[0] + rect[2] - 3, Math.ceil(Math.max(x, x + ax * length) + reach * 0.7));
    const y0 = Math.max(rect[1] + 2, Math.floor(Math.min(y, y + ay * length) - reach * 0.7));
    const y1 = Math.min(rect[1] + rect[3] - 3, Math.ceil(Math.max(y, y + ay * length) + reach * 0.7));
    for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
            const dx = px + 0.5 - x;
            const dy = py + 0.5 - y;
            // In the leaf's frame: along its midrib (s, 0..1) and across (t, texels, + to its right).
            const along = dx * ax + dy * ay;
            const across = dx * ay - dy * ax;
            let edge: number;
            let s: number;
            let half: number;
            if (kind === "palmate") {
                const centre = length * 0.32;
                const ra = Math.atan2(across, along - centre);
                const dist = Math.hypot(across, along - centre);
                const r = palmateRadius(ra) * length * (1 - 0.05 * Math.abs(Math.sin(ra * teeth)));
                edge = r - dist;
                s = clamp((along + length * 0.1) / (length * 1.0));
                half = Math.max(r, 1);
            } else {
                s = along / length;
                half = halfWidthAt(kind, s) * length;
                // The rim's teeth (an oak's and an ovate leaf's fine serration; none on a narrow leaflet).
                const tooth = kind === "lance" || kind === "pinnate" ? 0 : 0.06 * half * Math.abs(((s * teeth) % 1) * 2 - 1);
                edge = half - tooth - Math.abs(across);
            }
            const cover = clamp(edge + 0.5);
            if (cover <= 0) continue;
            const i = py * c.w + px;
            const rim = clamp(1 - edge / Math.max(1.5, half * 0.35));
            const midrib = Math.abs(across) < Math.max(0.7, length * 0.012) && s > 0.02 && s < 0.92 ? 1 : 0;
            // Side veins: from the midrib out toward the tip.
            const veinPhase = (s * (kind === "lobed" ? 9 : 11) - Math.abs(across) / length * 2.2) % 1;
            const vein = kind === "lance" || kind === "pinnate" ? 0 : clamp(1 - Math.abs(veinPhase - 0.5) * 2 / 0.12) * clamp(Math.abs(across) / length * 8);
            const lum = shade * (1 - 0.2 * rim) + 0.08 * midrib + 0.05 * vein;
            // Fold: each half tilted off the midrib; curl: the tip bending down; a ridge along each vein.
            const side = across >= 0 ? 1 : -1;
            const fold = 0.32 * side * clamp(Math.abs(across) / Math.max(half, 1) * 3);
            const curl = -0.18 * (s - 0.4);
            const lnx = fold + 0.12 * vein * side;
            const lny = curl;
            // Leaf frame to the cell's: across is (ay, -ax), along is (ax, ay).
            const nx = lnx * ay + lny * ax;
            const ny = -lnx * ax + lny * ay;
            const under = c.a[i] * (1 - cover);
            c.lum[i] = c.lum[i] * under / Math.max(under + cover, 1e-6) + lum * cover / Math.max(under + cover, 1e-6);
            c.nx[i] = c.nx[i] * (1 - cover) + nx * cover;
            c.ny[i] = c.ny[i] * (1 - cover) + ny * cover;
            c.a[i] = Math.max(c.a[i], cover);
        }
    }
}

/** A twig: a tapering stroke from (x0, y0) to (x1, y1), width w0 to w1 texels, dark. */
function drawTwig(c: Canvas, rect: readonly number[], x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) {
    const lx = x1 - x0;
    const ly = y1 - y0;
    const len2 = lx * lx + ly * ly;
    const pad = Math.max(w0, w1) + 1;
    for (let py = Math.max(rect[1] + 2, Math.floor(Math.min(y0, y1) - pad)); py <= Math.min(rect[1] + rect[3] - 3, Math.ceil(Math.max(y0, y1) + pad)); py++) {
        for (let px = Math.max(rect[0] + 2, Math.floor(Math.min(x0, x1) - pad)); px <= Math.min(rect[0] + rect[2] - 3, Math.ceil(Math.max(x0, x1) + pad)); px++) {
            const t = clamp(((px + 0.5 - x0) * lx + (py + 0.5 - y0) * ly) / Math.max(len2, 1e-6));
            const d = Math.hypot(px + 0.5 - (x0 + lx * t), py + 0.5 - (y0 + ly * t));
            const cover = clamp((w0 + (w1 - w0) * t) / 2 - d + 0.5);
            if (cover <= 0) continue;
            const i = py * c.w + px;
            c.lum[i] = c.lum[i] * (1 - cover) + 0.3 * cover;
            c.nx[i] *= 1 - cover;
            c.ny[i] *= 1 - cover;
            c.a[i] = Math.max(c.a[i], cover);
        }
    }
}

/** A spray: a twig up the cell with side shoots, its leaves along them and one at each tip, and one over the middle. */
function drawSpray(c: Canvas, rect: readonly number[], kind: LeafKind, seed: number) {
    const rnd = mulberry(seed);
    const [rx, ry, rw, rh] = rect;
    const at = (u: number, v: number): [number, number] => [rx + u * rw, ry + v * rh];
    const leaves: Array<{x: number; y: number; angle: number; length: number}> = [];
    const leafLength = kind === "pinnate" ? 0.07 : kind === "lobed" ? 0.25 : 0.235;
    const twigs: Array<[number, number, number, number]> = [];
    // The main twig, from the stalk end (bottom middle) up the cell, bending a little.
    const bend = (rnd() - 0.5) * 0.12;
    twigs.push([0.5, 0.02, 0.5 + bend, 0.74]);
    // Side shoots, alternate.
    const shoots = kind === "pinnate" ? 6 : 4;
    for (let k = 0; k < shoots; k++) {
        const v = 0.14 + 0.56 * (k + 0.3 + rnd() * 0.4) / shoots;
        const side = k % 2 ? 1 : -1;
        const u = 0.5 + bend * v / 0.74;
        const spread = 0.2 + rnd() * 0.1;
        twigs.push([u, v, u + side * spread, Math.min(0.78, v + 0.1 + rnd() * 0.1)]);
    }
    for (const [u0, v0, u1, v1] of twigs) {
        const [x0, y0] = at(u0, v0);
        const [x1, y1] = at(u1, v1);
        const main = u0 === 0.5 && v0 === 0.02;
        drawTwig(c, rect, x0, y0, x1, y1, main ? 3.2 : 2, main ? 1.4 : 1);
        const dir = Math.atan2(x1 - x0, y1 - y0);
        const len = Math.hypot(x1 - x0, y1 - y0);
        // Leaves (or leaflets, in pairs) along it, alternately each side, angled forward, and one at its tip.
        const n = kind === "pinnate" ? Math.round(len / (rw * 0.032)) : main ? 4 : 3;
        for (let j = 0; j < n; j++) {
            const t = kind === "pinnate" ? (j + 0.5) / n : 0.2 + 0.7 * (j + rnd() * 0.5) / n;
            const sides = kind === "pinnate" ? [-1, 1] : [j % 2 ? 1 : -1];
            for (const side of sides) {
                leaves.push({x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, angle: dir + side * (kind === "pinnate" ? 1.15 : 0.75 + rnd() * 0.45), length: rw * leafLength * (0.8 + 0.4 * rnd()) * (kind === "pinnate" ? 1 - 0.3 * t : 1)});
            }
        }
        if (kind !== "pinnate") leaves.push({x: x1, y: y1, angle: dir + (rnd() - 0.5) * 0.3, length: rw * leafLength * (0.85 + 0.3 * rnd())});
    }
    // One leaf over the card's middle (the attach points on a leaf mass sit at its middle: always on a leaf).
    if (kind !== "pinnate") leaves.push({x: rx + rw * 0.5, y: ry + rh * 0.36, angle: (rnd() - 0.5) * 0.5, length: rw * leafLength * 1.05});
    else for (let k = 0; k < 4; k++) leaves.push({x: rx + rw * 0.5, y: ry + rh * (0.42 + 0.04 * k), angle: (k % 2 ? 1 : -1) * 1.1, length: rw * leafLength});
    // Back to front in a shuffled order, so overlaps fall naturally.
    const order = leaves.map((leaf, i) => ({leaf, key: rnd() + (i === leaves.length - 1 ? 2 : 0)})).sort((a, b) => a.key - b.key);
    for (const {leaf} of order) drawLeaf(c, rect, kind, leaf.x, leaf.y, leaf.angle, leaf.length, 0.46 + 0.18 * rnd(), kind === "lobed" ? 5 : 14);
}

/** A single leaf filling its diamond: stalk end at the bottom middle, tip at the top, widest about the middle. */
function drawSingle(c: Canvas, rect: readonly number[], kind: LeafKind) {
    const [rx, ry, rw, rh] = rect;
    const length = rh * 0.94;
    drawLeaf(c, rect, kind, rx + rw * 0.5, ry + rh * 0.03, 0, length, 0.54, kind === "lobed" ? 5 : 16);
}

export type LeafAtlas = {size: number; levels: Uint8Array[]};

/** The atlas's levels (RGBA8, 512² down to 32²). Pure and deterministic. */
export function buildLeafAtlas(): LeafAtlas {
    const size = LEAF_ATLAS_SIZE;
    const n = size * size;
    const c: Canvas = {w: size, h: size, lum: new Float32Array(n).fill(0.5), nx: new Float32Array(n), ny: new Float32Array(n), a: new Float32Array(n)};
    LEAF_CELLS.forEach((cell, index) => {
        if (cell.spray) drawSpray(c, cell.rect, cell.kind, 7919 * (index + 1));
        else drawSingle(c, cell.rect, cell.kind);
    });
    // Level 0, then each level from the one above: colour averaged by coverage, alpha averaged, then each cell's alpha
    // scaled to keep its share of texels past the cut.
    let lum = c.lum;
    let nx = c.nx;
    let ny = c.ny;
    let alpha = c.a;
    const coverage0 = LEAF_CELLS.map(({rect}) => passing(alpha, size, rect, 1));
    const levels: Uint8Array[] = [];
    for (let level = 0, s = size; level < LEAF_ATLAS_LEVELS; level++, s >>= 1) {
        if (level > 0) {
            const half = s;
            const big = s * 2;
            const nl = new Float32Array(half * half);
            const nnx = new Float32Array(half * half);
            const nny = new Float32Array(half * half);
            const na = new Float32Array(half * half);
            for (let y = 0; y < half; y++) {
                for (let x = 0; x < half; x++) {
                    let sa = 0;
                    let sl = 0;
                    let sx = 0;
                    let sy = 0;
                    const j0 = y * 2 * big + x * 2;
                    for (let q = 0; q < 4; q++) {
                        const j = j0 + (q & 1) + (q >> 1) * big;
                        const w = alpha[j] + 1e-4;
                        sa += alpha[j];
                        sl += lum[j] * w;
                        sx += nx[j] * w;
                        sy += ny[j] * w;
                    }
                    const wsum = sa + 4e-4;
                    const i = y * half + x;
                    nl[i] = sl / wsum;
                    nnx[i] = sx / wsum;
                    nny[i] = sy / wsum;
                    na[i] = sa / 4;
                }
            }
            lum = nl;
            nx = nnx;
            ny = nny;
            alpha = na;
            // Coverage held: per cell, the scale on alpha that lets as many texels past the cut as at full size.
            LEAF_CELLS.forEach(({rect}, k) => {
                const scale = rect.map((v) => v / (size / s));
                // The scale that lets the cell's k-th most opaque texel (k: its full-size share) just pass the cut.
                const values = new Float32Array(scale[2] * scale[3]);
                let n = 0;
                for (let y = scale[1]; y < scale[1] + scale[3]; y++) for (let x = scale[0]; x < scale[0] + scale[2]; x++) values[n++] = alpha[y * s + x];
                values.sort();
                const want = Math.round(coverage0[k] * n);
                const kth = want > 0 ? values[n - want] : 1;
                const k2 = Math.min(4, Math.max(0.25, kth > 0 ? LEAF_CUT / kth : 4));
                for (let y = scale[1]; y < scale[1] + scale[3]; y++) for (let x = scale[0]; x < scale[0] + scale[2]; x++) alpha[y * s + x] = Math.min(1, alpha[y * s + x] * k2);
            });
        }
        const out = new Uint8Array(s * s * 4);
        for (let i = 0; i < s * s; i++) {
            out[i * 4] = Math.round(clamp(lum[i]) * 255);
            out[i * 4 + 1] = Math.round(clamp(0.5 + nx[i] * 0.5) * 255);
            out[i * 4 + 2] = Math.round(clamp(0.5 + ny[i] * 0.5) * 255);
            out[i * 4 + 3] = Math.round(clamp(alpha[i]) * 255);
        }
        levels.push(out);
    }
    return {size, levels};
}

/** The share of a rect's texels whose alpha (times `scale`) passes the cut. */
function passing(alpha: Float32Array, width: number, rect: readonly number[], scale: number): number {
    let pass = 0;
    for (let y = rect[1]; y < rect[1] + rect[3]; y++) for (let x = rect[0]; x < rect[0] + rect[2]; x++) if (alpha[y * width + x] * scale >= LEAF_CUT) pass++;
    return pass / (rect[2] * rect[3]);
}

let texture: DataTexture | null = null;

/** The atlas as a texture (made once, shared by every tree material). */
export function leafAtlasTexture(): DataTexture {
    if (texture) return texture;
    const atlas = buildLeafAtlas();
    const t = new DataTexture(atlas.levels[0], atlas.size, atlas.size, RGBAFormat, UnsignedByteType);
    t.mipmaps = atlas.levels.map((data, level) => ({data, width: atlas.size >> level, height: atlas.size >> level})) as unknown as typeof t.mipmaps;
    t.generateMipmaps = false;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.anisotropy = 4;
    t.flipY = false;
    // Once on the GPU, the levels' bytes are let go (1.4 MB of heap): a new scene (a remount, a lost context) makes the
    // atlas again (`releaseLeafAtlas`).
    t.onUpdate = () => {
        t.mipmaps = [];
        t.image = {data: null as unknown as Uint8Array, width: atlas.size, height: atlas.size};
    };
    t.needsUpdate = true;
    texture = t;
    return t;
}

/** The scene is gone: the atlas goes with it (the next scene makes its own). */
export function releaseLeafAtlas() {
    texture?.dispose();
    texture = null;
}
