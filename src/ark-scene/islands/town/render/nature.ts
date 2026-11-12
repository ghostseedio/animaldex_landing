/**
 * The town's growing things and farm things in code (lane GC; docs/ark/town-island.md §13): leafy hedges and
 * hedgerows, flower beds, standing crops, and the farms' bales, troughs, hay shelters and gates. All of it merges into
 * each Part B chunk's meshes (the hedges, beds and crops into the chunk's `foliage` mesh, which sways a little in the
 * wind and carries a leaf grain; the farm things into its solids), so the whole town's planting is one draw call a chunk.
 *
 * - **Hedges.** A clipped garden hedge is a lumpy, rounded-topped mass of leaves (beech, privet, hawthorn), its sides
 *   bulging and its top dipping a little, lighter where the sun reaches; a field hedgerow is taller, shaggy, with
 *   clumps standing proud along its top. Their lines are the plan's own, so the colliders (decision 149: a 0.3 m gap at
 *   the foot) match what is drawn; a gate stands in the hedge where a field's gate is (`farm.ts`).
 * - **Flower beds:** round beds round the park's bandstand, a bed along each front garden's house wall, planters at the
 *   zoo's gate: low plants with flower heads in a few colours a bed (no species named: no Ark animal lives in them).
 * - **Crops:** cereal and maize stand in rows with a ragged top; cabbages and sprouts as rows of round heads; tilled
 *   soil and pasture stay flat (the ground's own texture, lane GA).
 * - **Reeds and lily pads** at the millpond and the farm pond are the asset library's (`townPlantings`, instanced by
 *   `render/assets.ts`).
 */

import {DoubleSide, MeshStandardMaterial} from "three";
import {ARK_TIME, ARK_WIND} from "@/ark-scene/glsl";
import {hashText, inPoly, local, polylineLength, rng, type Box, type Poly, type Pt} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {MILLPOND, type TownPlan} from "@/ark-scene/islands/town/plan";
import {at, Geo, tone, type Frame, type V3} from "@/ark-scene/islands/town/render/kit";
import {townWeather} from "@/ark-scene/islands/town/render/materials";
import type {FarmGate, FarmProp} from "@/ark-scene/islands/town/farm";
import type {TownAssetPlacement} from "@/ark-scene/islands/town/render/assets";

type RGB = [number, number, number];
const H = (x: number, z: number) => townHeight(x, z);

function hash3(x: number, y: number, z: number): number {
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return h - Math.floor(h);
}

/** Smooth value noise in 3D (for the hedges' bulges), deterministic. */
function noise3(x: number, y: number, z: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const fx = x - xi;
    const fy = y - yi;
    const fz = z - zi;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const w = fz * fz * (3 - 2 * fz);
    const c = (a: number, b: number, d: number) => hash3(xi + a, yi + b, zi + d);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v), lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

function shade(colour: RGB, k: number): RGB {
    return [colour[0] * k, colour[1] * k, colour[2] * k];
}

// MARK: - The foliage material

/**
 * The chunk's foliage (hedges, beds, crops): vertex colour, a leaf grain in world space (dark gaps between leaf
 * clusters, lit leaf tips), a sway by the vertex's weight (`aTag`: 0 at the foot, 1 at a hedgerow's top) on the shared
 * clock and wind, and the town's weather kit (rain darkens and glosses it, cloud shade, the lamps).
 */
export function foliageMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.82, metalness: 0, side: DoubleSide});
    material.customProgramCacheKey = () => "town-foliage-1";
    material.onBeforeCompile = (shader) => {
        shader.uniforms.gcTime = ARK_TIME;
        shader.uniforms.gcWind = ARK_WIND;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
attribute float aTag;
uniform float gcTime;
uniform vec2 gcWind;
varying vec3 vGcLeaf;`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>
{
    vec4 gcWorld = modelMatrix * vec4(transformed, 1.0);
    float gcGust = length(gcWind);
    float gcWave = sin(gcTime * 1.9 + gcWorld.x * 0.45 + gcWorld.z * 0.31) * 0.6 + sin(gcTime * 4.3 + gcWorld.x * 1.7) * 0.4;
    transformed.xz += gcWind / max(gcGust, 1e-3) * gcWave * aTag * 0.035 * (0.3 + gcGust);
    vGcLeaf = gcWorld.xyz;
}`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
varying vec3 vGcLeaf;
float gcHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float gcNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(gcHash(i), gcHash(i + vec3(1, 0, 0)), f.x), mix(gcHash(i + vec3(0, 1, 0)), gcHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(gcHash(i + vec3(0, 0, 1)), gcHash(i + vec3(1, 0, 1)), f.x), mix(gcHash(i + vec3(0, 1, 1)), gcHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`)
            .replace("#include <color_fragment>", `#include <color_fragment>
{
    // Leaf clusters about 12 cm across, gaps between them darker; a coarser mottling of light and shade.
    float gcLeaves = gcNoise(vGcLeaf * 8.5) * 0.65 + gcNoise(vGcLeaf * 23.0) * 0.35;
    float gcMottle = gcNoise(vGcLeaf * 1.3);
    diffuseColor.rgb *= mix(0.55, 1.22, smoothstep(0.18, 0.78, gcLeaves)) * (0.88 + 0.24 * gcMottle);
}`);
    };
    return townWeather(material, {soak: 0.3, wetRoughness: 0.4});
}

// MARK: - Hedges

const HEDGE_GREENS: RGB[] = [tone("#3f6c2f"), tone("#456f2c"), tone("#3a6234"), tone("#4d7431")];

/**
 * A hedge along a line: a lumpy rounded-topped mass `height` tall. `hedgerow`: a field's (wider, taller, shaggy, its
 * top in clumps); else a garden's (clipped). `gaps`: gates (middle and half width) where it is left open.
 */
export function hedgeAlong(geo: Geo, line: Poly, height: number, seed: number, hedgerow: boolean, gaps: ReadonlyArray<{x: number; z: number; half: number}> = []) {
    const width = hedgerow ? 1.5 : 0.85;
    const step = hedgerow ? 0.8 : 0.6;
    const base = HEDGE_GREENS[seed % HEDGE_GREENS.length];
    // The cross-section (across, up) as a share of the half width and the height: straight sides, a rounded top.
    const profile: Array<[number, number]> = [[-1, -0.05], [-1.04, 0.3], [-1.02, 0.62], [-0.9, 0.86], [-0.55, 0.98], [0, 1.02], [0.55, 0.98], [0.9, 0.86], [1.02, 0.62], [1.04, 0.3], [1, -0.05]];
    const r = rng(seed);
    for (let i = 1; i < line.length; i++) {
        const a = line[i - 1];
        const b = line[i];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        if (length < 0.2) continue;
        const dx = (b.x - a.x) / length;
        const dz = (b.z - a.z) / length;
        const nx = -dz;
        const nz = dx;
        const n = Math.max(1, Math.ceil(length / step));
        const rings: V3[][] = [];
        const tops: number[] = [];
        const open: boolean[] = [];
        for (let k = 0; k <= n; k++) {
            const t = (k / n) * length;
            const cx = a.x + dx * t;
            const cz = a.z + dz * t;
            open.push(gaps.some((g) => Math.hypot(cx - g.x, cz - g.z) < g.half));
            const ground = H(cx, cz);
            // The top dips and rises along the hedge (a clipped one barely).
            const swell = noise3(cx * 0.35, 0, cz * 0.35);
            const top = height * (hedgerow ? 0.85 + 0.35 * swell : 0.95 + 0.08 * swell);
            tops.push(top);
            const ring: V3[] = profile.map(([u, v]) => {
                const bulge = noise3(cx * 1.3 + u * 2, v * 2.2, cz * 1.3) - 0.5;
                const half = (width / 2) * (1 + bulge * (hedgerow ? 0.38 : 0.16));
                const up = Math.max(v, 0) * top + (v < 0 ? v : 0) + (v > 0.8 ? bulge * (hedgerow ? 0.35 : 0.08) : 0);
                return [cx + nx * u * half, ground + up, cz + nz * u * half];
            });
            rings.push(ring);
        }
        for (let k = 1; k <= n; k++) {
            if (open[k] || open[k - 1]) continue;
            const r0 = rings[k - 1];
            const r1 = rings[k];
            for (let j = 1; j < profile.length; j++) {
                const v = (profile[j][1] + profile[j - 1][1]) / 2;
                const light = 0.72 + 0.4 * Math.max(v, 0) + (r() - 0.5) * 0.1;
                geo.tag = Math.max(v, 0) * (hedgerow ? 1 : 0.35);
                geo.quad(r0[j - 1], r1[j - 1], r1[j], r0[j], shade(base, light));
            }
        }
        // End caps where the hedge stops (its line's ends and a gate's posts).
        for (let k = 0; k <= n; k++) {
            const end = (k === 0 && i === 1) || (k === n && i === line.length - 1) || (open[k] !== (k > 0 ? open[k - 1] : open[k]));
            if (!end) continue;
            const ring = rings[k];
            const mid: V3 = [(ring[0][0] + ring[ring.length - 1][0]) / 2, ring[0][1] + tops[k] * 0.45, (ring[0][2] + ring[ring.length - 1][2]) / 2];
            geo.tag = 0.2;
            for (let j = 1; j < ring.length; j++) geo.tri(mid, ring[j - 1], ring[j], shade(base, 0.68));
        }
        // A hedgerow's clumps standing proud along its top (hawthorn, blackthorn, field maple).
        if (hedgerow) {
            for (let t = r() * 1.5; t < length; t += 1.2 + r() * 1.6) {
                const cx = a.x + dx * t + nx * (r() - 0.5) * width * 0.4;
                const cz = a.z + dz * t + nz * (r() - 0.5) * width * 0.4;
                if (gaps.some((g) => Math.hypot(cx - g.x, cz - g.z) < g.half + 1)) continue;
                const top = H(cx, cz) + height * (0.8 + 0.25 * noise3(cx * 0.35, 0, cz * 0.35));
                geo.tag = 1;
                geo.blob(cx, top, cz, 0.55 + r() * 0.35, 0.45 + r() * 0.35, 0.55 + r() * 0.35, shade(base, 0.95 + r() * 0.2), hashText(`${seed}:${t.toFixed(1)}`), 0);
            }
        }
    }
    geo.tag = 0;
}

// MARK: - Flower beds

const FLOWERS: RGB[][] = [
    [tone("#c8323c"), tone("#e8e0d0"), tone("#d9a520")],
    [tone("#8a5ab8"), tone("#f0eadc"), tone("#e07ab0")],
    [tone("#e8b020"), tone("#d0602a"), tone("#f2e8c8")],
    [tone("#5a74c8"), tone("#f0d040"), tone("#e8e4dc")],
    [tone("#d84a6a"), tone("#f4c0cc"), tone("#ffffff")]
];
const STEM = tone("#4a7a30");
const SOIL = tone("#4a3a2c");

/** A bed of low flowering plants on a patch (`frame`'s middle, w × d, its own turn, `frame.y` over the ground: a planter's): soil and plants about 25 cm apart. */
export function flowerBed(foliage: Geo, decal: Geo, frame: Frame, w: number, d: number, seed: number, round = false, soilTag = 0) {
    const r = rng(seed);
    const palette = FLOWERS[seed % FLOWERS.length];
    const before = decal.tag;
    decal.tag = soilTag;
    if (round) {
        const n = 14;
        const c: V3 = [frame.x, H(frame.x, frame.z) + frame.y + 0.07, frame.z];
        for (let i = 0; i < n; i++) {
            const a0 = (i / n) * Math.PI * 2;
            const a1 = ((i + 1) / n) * Math.PI * 2;
            const p0: V3 = [frame.x + Math.cos(a0) * w / 2, 0, frame.z + Math.sin(a0) * d / 2];
            const p1: V3 = [frame.x + Math.cos(a1) * w / 2, 0, frame.z + Math.sin(a1) * d / 2];
            p0[1] = H(p0[0], p0[2]) + frame.y + 0.07;
            p1[1] = H(p1[0], p1[2]) + frame.y + 0.07;
            decal.tri(c, p1, p0, SOIL);
        }
    } else {
        decal.drape(frame, w, d, (x, z) => H(x, z) + frame.y, 0.07, () => SOIL, 1);
    }
    decal.tag = before;
    const spacing = 0.26;
    for (let lx = -w / 2 + spacing / 2; lx < w / 2; lx += spacing) {
        for (let lz = -d / 2 + spacing / 2; lz < d / 2; lz += spacing) {
            if (round && (lx * lx) / ((w / 2) * (w / 2)) + (lz * lz) / ((d / 2) * (d / 2)) > 0.85) continue;
            const p = at(frame, lx + (r() - 0.5) * 0.12, 0, lz + (r() - 0.5) * 0.12);
            const g = H(p[0], p[2]) + frame.y + 0.06;
            const tall = 0.22 + r() * 0.22;
            const turn = r() * Math.PI;
            const cx = Math.cos(turn) * 0.09;
            const cz = Math.sin(turn) * 0.09;
            // Two crossed leafy blades, then the flower head as a small upturned diamond.
            foliage.tag = 0;
            foliage.tri([p[0] - cx, g, p[2] - cz], [p[0] + cx, g, p[2] + cz], [p[0], g + tall, p[2]], STEM);
            foliage.tri([p[0] + cz, g, p[2] - cx], [p[0] - cz, g, p[2] + cx], [p[0], g + tall * 0.9, p[2]], shade(STEM, 0.85));
            const head = palette[Math.floor(r() * palette.length)];
            const s = 0.06 + r() * 0.04;
            const top: V3 = [p[0], g + tall + 0.02, p[2]];
            foliage.tag = 0.6;
            foliage.quad([top[0] - s, top[1], top[2]], [top[0], top[1] - 0.01, top[2] + s], [top[0] + s, top[1], top[2]], [top[0], top[1] + 0.02, top[2] - s], head);
        }
    }
    foliage.tag = 0;
}

// MARK: - Crops

/** Rows of a standing crop over a field (box `f`, w × d, rows along its x): cereal, maize, cabbages, sprouts. */
export function cropRows(geo: Geo, field: Box, crop: string, seed: number) {
    const r = rng(seed);
    const look: Record<string, {spacing: number; height: number; colour: RGB; head?: RGB; heads?: number}> = {
        cereal: {spacing: 0.35, height: 0.85, colour: tone("#c4ad62"), head: tone("#d9c27a")},
        maize: {spacing: 0.75, height: 2.1, colour: tone("#5a8a34"), head: tone("#c8b45a")},
        cabbage: {spacing: 0.6, height: 0.35, colour: tone("#7ea25a"), heads: 0.55},
        sprouts: {spacing: 0.55, height: 0.75, colour: tone("#5f8a44"), heads: 0.5}
    };
    const c = look[crop];
    if (!c) return;
    const frame: Frame = {x: field.x, y: 0, z: field.z, rot: field.rot};
    for (let lz = -field.d / 2 + c.spacing; lz < field.d / 2 - c.spacing / 2; lz += c.spacing) {
        if (c.heads) {
            // A row of round heads (cabbages; sprouts on their stalks).
            for (let lx = -field.w / 2 + 0.6; lx < field.w / 2 - 0.4; lx += c.heads) {
                const p = at(frame, lx + (r() - 0.5) * 0.08, 0, lz + (r() - 0.5) * 0.08);
                const g = H(p[0], p[2]);
                geo.tag = 0.2;
                geo.blob(p[0], g + c.height * 0.6, p[2], 0.24 + r() * 0.06, c.height * 0.55, 0.24 + r() * 0.06, shade(c.colour, 0.9 + r() * 0.2), hashText(`${seed}:${lx.toFixed(1)}:${lz.toFixed(1)}`), 0);
            }
            continue;
        }
        // A standing row: a ragged-topped wall of stems, lit on top, the heads (ears, tassels) a lighter band.
        const n = Math.max(2, Math.ceil(field.w / 0.5));
        let prev: {foot: V3; top: V3; head: V3} | null = null;
        for (let k = 0; k <= n; k++) {
            const lx = -field.w / 2 + 0.4 + ((field.w - 0.8) * k) / n;
            const p = at(frame, lx, 0, lz);
            const g = H(p[0], p[2]);
            const tall = c.height * (0.88 + 0.24 * noise3(p[0] * 1.7, 0, p[2] * 1.7));
            const cur = {foot: [p[0], g, p[2]] as V3, top: [p[0], g + tall * 0.82, p[2]] as V3, head: [p[0], g + tall, p[2]] as V3};
            if (prev) {
                geo.tag = 0.5;
                geo.quad(prev.foot, cur.foot, cur.top, prev.top, shade(c.colour, 0.78 + r() * 0.12));
                geo.tag = 1;
                geo.quad(prev.top, cur.top, cur.head, prev.head, shade(c.head ?? c.colour, 0.95 + r() * 0.12));
            }
            prev = cur;
        }
    }
    geo.tag = 0;
}

// MARK: - Farm things

const STRAW = tone("#d2b464");
const WRAP = tone("#2c3a2a");
const GALV = tone("#9aa0a2");
const TIMBER = tone("#8a6a48");
const STEEL = tone("#5a6066");
const ROOF_TIN = tone("#7a3a2e");

/** A cylinder lying along the frame's local x (a round bale), `r` radius, `len` long, its middle at (lx, ly, lz). */
function lyingCylinder(geo: Geo, f: Frame, lx: number, ly: number, lz: number, r: number, len: number, side: RGB, end: RGB, sides = 10) {
    const ring = (x: number) => Array.from({length: sides}, (_, i) => {
        const a = (i / sides) * Math.PI * 2;
        return at(f, lx + x, ly + Math.sin(a) * r, lz + Math.cos(a) * r);
    });
    const a = ring(-len / 2);
    const b = ring(len / 2);
    for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        const k = 0.75 + 0.3 * (Math.sin((i / sides) * Math.PI * 2) * 0.5 + 0.5);
        geo.quad(a[i], b[i], b[j], a[j], shade(side, k));
    }
    const ca = at(f, lx - len / 2, ly, lz);
    const cb = at(f, lx + len / 2, ly, lz);
    for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        geo.tri(ca, a[j], a[i], shade(end, 0.92));
        geo.tri(cb, b[i], b[j], end);
    }
}

/** The farms' bales, troughs and hay shelters (`farm.ts` positions) into a chunk's solids. */
export function farmProp(geo: Geo, p: FarmProp) {
    const g = H(p.at.x, p.at.z);
    const f: Frame = {x: p.at.x, y: g, z: p.at.z, rot: p.at.rot};
    const r = rng(p.seed);
    switch (p.kind) {
        case "round_bales": {
            // Three round bales on their sides (1.2 m across, 1.2 m long), wrapped or straw; two more on top at a farmstead.
            const wrapped = r() < 0.5;
            for (let i = 0; i < 3; i++) lyingCylinder(geo, {...f, rot: f.rot + Math.PI / 2}, 0, 0.6, -1.3 + i * 1.3, 0.6, 1.2, wrapped ? WRAP : STRAW, wrapped ? shade(WRAP, 1.2) : shade(STRAW, 1.08));
            if (p.top > 2) for (let i = 0; i < 2; i++) lyingCylinder(geo, {...f, rot: f.rot + Math.PI / 2}, 0, 1.68, -0.65 + i * 1.3, 0.6, 1.2, wrapped ? WRAP : STRAW, wrapped ? shade(WRAP, 1.2) : shade(STRAW, 1.08));
            break;
        }
        case "square_bales": {
            // Small square bales (0.9 × 0.45 × 0.35 m) stacked in courses, each course turned.
            const courses = Math.round(p.top / 0.45);
            for (let c = 0; c < courses; c++) {
                for (let i = 0; i < (c % 2 ? 2 : 3); i++) {
                    const lx = (c % 2 ? -0.45 + i * 0.9 : -0.9 + i * 0.9) * (p.at.w / 2.7);
                    geo.box(f, lx, c * 0.45, 0, 0.88, 0.44, p.at.d - 0.05, shade(STRAW, 0.9 + r() * 0.15));
                }
            }
            break;
        }
        case "trough": {
            // A galvanised trough on legs, the water dark inside it.
            geo.box(f, 0, 0.1, 0, p.at.w, 0.5, p.at.d, GALV);
            geo.box(f, 0, 0.56, 0, p.at.w - 0.1, 0.02, p.at.d - 0.1, tone("#2a3a3c"));
            for (const lx of [-p.at.w / 2 + 0.15, p.at.w / 2 - 0.15]) geo.box(f, lx, 0, 0, 0.08, 0.12, p.at.d * 0.9, STEEL);
            break;
        }
        case "hay_shelter": {
            // A Dutch barn: steel stanchions, a curved tin roof, open sides, round bales stacked under it.
            const w = p.at.w;
            const d = p.at.d;
            for (const lx of [-w / 2, -w / 6, w / 6, w / 2]) for (const lz of [-d / 2, d / 2]) geo.box(f, lx, 0, lz, 0.18, 4.4, 0.18, STEEL);
            const n = 8;
            for (let i = 0; i < n; i++) {
                const a0 = Math.PI * (i / n);
                const a1 = Math.PI * ((i + 1) / n);
                const z0 = -Math.cos(a0) * (d / 2 + 0.3);
                const z1 = -Math.cos(a1) * (d / 2 + 0.3);
                const y0 = 4.4 + Math.sin(a0) * 0.9;
                const y1 = 4.4 + Math.sin(a1) * 0.9;
                const k = 0.82 + 0.25 * Math.sin((a0 + a1) / 2);
                geo.quad(at(f, -w / 2 - 0.3, y0, z0), at(f, w / 2 + 0.3, y0, z0), at(f, w / 2 + 0.3, y1, z1), at(f, -w / 2 - 0.3, y1, z1), shade(ROOF_TIN, k));
                geo.quad(at(f, -w / 2 - 0.3, y1 - 0.05, z1), at(f, w / 2 + 0.3, y1 - 0.05, z1), at(f, w / 2 + 0.3, y0 - 0.05, z0), at(f, -w / 2 - 0.3, y0 - 0.05, z0), shade(ROOF_TIN, 0.5));
            }
            for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) lyingCylinder(geo, f, -w / 2 + 0.9 + i * 1.5, 0.6 + row * 1.15, -d / 4 + row * 0.6, 0.6, 1.2, STRAW, shade(STRAW, 1.08));
            break;
        }
    }
}

/** A five-bar timber gate (hung between two posts) across a gap of `width` m in a fence or hedge. */
export function fiveBarGate(geo: Geo, gate: FarmGate) {
    const g = H(gate.x, gate.z);
    // The gate's frame: its local x along the line it stands in.
    const f: Frame = {x: gate.x, y: g, z: gate.z, rot: gate.rot};
    const w = gate.width;
    for (const lx of [-w / 2 - 0.12, w / 2 + 0.12]) geo.box(f, lx, -0.2, 0, 0.2, 1.55, 0.2, shade(TIMBER, 0.85));
    for (let i = 0; i < 5; i++) geo.box(f, 0, 0.22 + i * 0.25, 0, w - 0.1, 0.09, 0.05, TIMBER);
    // The heel and head stiles, and the diagonal brace.
    for (const lx of [-w / 2 + 0.06, w / 2 - 0.06]) geo.box(f, lx, 0.15, 0, 0.1, 1.15, 0.07, TIMBER);
    const a = at(f, -w / 2 + 0.1, 0.25, 0.04);
    const b = at(f, w / 2 - 0.4, 1.2, 0.04);
    const bc = at(f, w / 2 - 0.4, 1.2, -0.04);
    const ac = at(f, -w / 2 + 0.1, 0.25, -0.04);
    const up: V3 = [0, 0.09, 0];
    const add = (p: V3, q: V3): V3 => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
    geo.quad(a, b, add(b, up), add(a, up), TIMBER);
    geo.quad(bc, ac, add(ac, up), add(bc, up), TIMBER);
}

// MARK: - Reeds and lily pads

/**
 * The millpond's and the farm pond's reeds (common reed and reedmace in clumps along the shallow margins, open where
 * the banks are mown by the paths) and the millpond's lily pads, as the asset library's plants.
 */
export function townPlantings(plan: TownPlan): TownAssetPlacement[] {
    const out: TownAssetPlacement[] = [];
    const r = rng(hashText("town-plantings"));
    // The millpond: an ellipse; the margin is where the bank meets the water.
    const pond = MILLPOND;
    const level = plan.waters.find((w) => w.kind === "millpond")?.level ?? 1.15;
    for (let k = 0; k < 120; k++) {
        const a = (k / 120) * Math.PI * 2;
        // Reeds on about half the margin, in runs (open where the park's lawns come down to the water).
        if (noise3(Math.cos(a) * 3, 0, Math.sin(a) * 3) < 0.5) continue;
        for (let j = 0; j < 2; j++) {
            const rr = 0.94 + r() * 0.1;
            const x = pond.x + Math.cos(a + (r() - 0.5) * 0.04) * pond.rx * rr;
            const z = pond.z + Math.sin(a + (r() - 0.5) * 0.04) * pond.rz * rr;
            const y = Math.max(H(x, z), level - 0.6);
            out.push({asset: r() < 0.6 ? "reeds-phragmites-a" : "reeds-cattail-a", x, y, z, rotation: r() * Math.PI * 2, scale: 0.8 + r() * 0.45, shade: 0.9 + r() * 0.15, cull: 140});
        }
    }
    // Lily pads in the millpond's quieter half (the north-west), clear of the margin's reeds.
    for (let k = 0; k < 26; k++) {
        const a = Math.PI * (0.9 + r() * 0.9);
        const rr = 0.35 + r() * 0.5;
        const x = pond.x + Math.cos(a) * pond.rx * rr;
        const z = pond.z + Math.sin(a) * pond.rz * rr;
        out.push({asset: r() < 0.5 ? "lily-pads-a" : "lily-pads-b", x, y: level + 0.01, z, rotation: r() * Math.PI * 2, scale: 1.4 + r() * 1.2, cull: 120});
    }
    // The farm pond: reeds round its edge.
    for (const w of plan.waters) {
        if (w.kind !== "farm_pond") continue;
        const length = polylineLength([...w.poly, w.poly[0]]);
        const rp = rng(hashText(w.id));
        const water = Math.min(...w.poly.map((p) => H(p.x, p.z))) - 0.25;
        for (let t = 0; t < length; t += 1.1) {
            if (rp() < 0.35) continue;
            const p = pointAlong([...w.poly, w.poly[0]], t);
            const c = centroidOf(w.poly);
            const x = p.x + (c.x - p.x) * 0.08;
            const z = p.z + (c.z - p.z) * 0.08;
            if (!inPoly(w.poly, x, z)) continue;
            out.push({asset: rp() < 0.5 ? "reeds-cattail-a" : "reeds-phragmites-a", x, y: Math.max(H(x, z), water - 0.5), z, rotation: rp() * Math.PI * 2, scale: 0.75 + rp() * 0.4, cull: 140});
        }
    }
    return out;
}

function pointAlong(line: Poly, t: number): Pt {
    let walked = 0;
    for (let i = 1; i < line.length; i++) {
        const l = Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z);
        if (walked + l >= t) {
            const f = (t - walked) / Math.max(l, 1e-6);
            return {x: line[i - 1].x + (line[i].x - line[i - 1].x) * f, z: line[i - 1].z + (line[i].z - line[i - 1].z) * f};
        }
        walked += l;
    }
    return line[line.length - 1];
}

function centroidOf(poly: Poly): Pt {
    return {x: poly.reduce((s, p) => s + p.x, 0) / poly.length, z: poly.reduce((s, p) => s + p.z, 0) / poly.length};
}

/** A point on a box's edge facing a world point (for beds against a house wall). */
export function edgeToward(b: Box, x: number, z: number, inset: number): {at: Pt; turn: number} {
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    const lz = -(x - b.x) * s + (z - b.z) * c;
    const side = lz >= 0 ? 1 : -1;
    return {at: local(b, 0, side * (b.d / 2 - inset)), turn: 0};
}
