/**
 * The ground at bug scale (pass 2, lane GROUND; the owner, 2026-11-16: "can we make the ground more realistic and
 * better quality when you zoom up close too, to see bugs"). When the camera comes down to a small animal (a few metres
 * from what it looks at), the ground round that point grows what real ground has at that scale, by what it is:
 *
 * - meadow: grass as single blades of many heights, widths and leans, green with dry ones among them, a few rosettes;
 * - lawn: short, dense, even blades, rosettes of clover and plantain, moss in it here and there;
 * - woodland floor: moss cushions, twigs, leaf fragments, crumbs of soil, a few thin blades;
 * - sand: light and dark grains, broken shells, now and then a blade of dune grass;
 * - soil (the farm's mud and yards, the allotments, the fields): clods and crumbs, a few weeds;
 * - gravel (scree, the mountain's stony ground): grit and small stones.
 *
 * The ground's shader adds the finer grain under it (`bug-ground-glsl.ts`). Every blade is dark at its root (the shade
 * down in the sward), so an animal among them sits in the grass, not on a plane; blades within reach of a small
 * animal bow away and lie low (`setClear`), so a beetle in a lawn is never buried.
 *
 * Deterministic: each 0.5 m cell is filled from its own seed and what covers it, so every viewer sees the same blade in
 * the same place. Only near: nothing is drawn while the camera is further than `SHOW_WITHIN` from what it looks at (no
 * draw call at the island view); a few cells are built a frame. Tier budgets in `BUG_TIERS`.
 */

import {
    BufferAttribute,
    BufferGeometry,
    Color,
    CylinderGeometry,
    DoubleSide,
    DynamicDrawUsage,
    Group,
    IcosahedronGeometry,
    InstancedMesh,
    Matrix4,
    MeshStandardMaterial,
    Quaternion,
    Vector3
} from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {ARK_ENV, ARK_TIME, ARK_WIND} from "@/ark-scene/glsl";
import {drawnGroundHeight} from "@/ark-scene/grounding/drawn-ground";
import {arkWorld, sampleGround, seeded, zoneAt} from "@/ark-scene/world";
import {wildWaterSurface} from "@/ark-scene/islands/wild/map-v2";

export type BugSurface = "meadow" | "lawn" | "woods" | "sand" | "soil" | "gravel";
/** What covers a point at bug scale, and the drawn ground's height there; null: nothing grows (water, paving, rock). */
export type BugCover = {surface: BugSurface; height: number; /** 0 lush … 1 parched: the share of dry blades. */ dry: number};
export type BugCoverAt = (x: number, z: number) => BugCover | null;

export const BUG_KINDS = ["blade", "grit", "moss", "twig", "leaf", "rosette", "shell"] as const;
export type BugKind = typeof BUG_KINDS[number];

export type BugItem = {
    kind: BugKind;
    x: number;
    y: number;
    z: number;
    yaw: number;
    /** Lean from upright (rad), about the item's own x after the yaw. */
    lean: number;
    /** Width, height, depth (m). */
    sx: number;
    sy: number;
    sz: number;
    colour: number;
};

/** Expected items per m² of each surface (at a share of 1), and how tall its blades stand (m, min and max). */
export const BUG_DENSITY: Record<BugSurface, {per: Partial<Record<BugKind, number>>; blade: [number, number]}> = {
    meadow: {per: {blade: 1000, grit: 30, rosette: 3, twig: 1.5, moss: 0.6, leaf: 1}, blade: [0.07, 0.26]},
    lawn: {per: {blade: 1700, grit: 14, rosette: 6, moss: 1.2, leaf: 0.6}, blade: [0.03, 0.075]},
    woods: {per: {blade: 40, grit: 70, moss: 9, twig: 9, leaf: 34, rosette: 0.6}, blade: [0.05, 0.16]},
    sand: {per: {grit: 150, shell: 7, blade: 3, twig: 0.4}, blade: [0.18, 0.4]},
    soil: {per: {grit: 220, blade: 26, twig: 2, rosette: 1.2, leaf: 1}, blade: [0.04, 0.14]},
    gravel: {per: {grit: 260, blade: 6, moss: 0.8}, blade: [0.03, 0.1]}
};

/** The cell's side (m). */
export const BUG_CELL = 0.5;
/** Nothing is drawn while the camera is further than this (m) from what it looks at. */
export const SHOW_WITHIN = 7;

/**
 * Per tier: the share of each surface's density, how far round the point looked at the layer reaches (m), and the
 * instance caps per kind (the frame's worst case). The low tier keeps a small patch so a phone still sees blades
 * round a beetle; the costs are in the lane report.
 */
export const BUG_TIERS: Record<"high" | "medium" | "low", {share: number; radius: number; caps: Record<BugKind, number>}> = {
    high: {share: 1, radius: 3, caps: {blade: 22000, grit: 7000, moss: 700, twig: 700, leaf: 2400, rosette: 500, shell: 500}},
    medium: {share: 0.6, radius: 2.2, caps: {blade: 8000, grit: 2600, moss: 300, twig: 300, leaf: 900, rosette: 200, shell: 200}},
    low: {share: 0.4, radius: 1.4, caps: {blade: 2200, grit: 800, moss: 100, twig: 100, leaf: 300, rosette: 60, shell: 60}}
};

const TINTS: Record<BugKind, string[]> = {
    // Greens of living blades, then the dry ones (the last three).
    blade: ["#5d8c34", "#6b9a3a", "#4f7d2e", "#7aa043", "#86a84a", "#58823a", "#b09c5e", "#9a8a52", "#bda96c"],
    grit: ["#6e5a44", "#806a50", "#5a4a3a", "#9a8a72", "#c9b896", "#8a8478", "#6a645c", "#b0a690"],
    moss: ["#4f7a2a", "#5f8a2e", "#6e8f34", "#3f6626"],
    twig: ["#5e4a36", "#6d5841", "#4a3b2c", "#7a6a55"],
    leaf: ["#8a5a2b", "#a8742f", "#6e4a26", "#9b8a3a", "#b0612a", "#5c4426"],
    rosette: ["#4e7f30", "#5b8a38", "#3f6e2a", "#6a9440"],
    shell: ["#f1e6d3", "#e8cbb8", "#f4ede2", "#d9b8a0", "#c9c2b6"]
};

/** Which grit tones each surface takes (indices into TINTS.grit). */
const GRIT_TONES: Record<BugSurface, number[]> = {
    meadow: [0, 1, 2],
    lawn: [0, 1, 2],
    woods: [0, 2, 1],
    sand: [4, 7, 3, 6],
    soil: [0, 1, 2, 3],
    gravel: [5, 6, 3, 7, 1]
};

function cellSeed(cx: number, cz: number): number {
    return ((Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 0x6b2f) >>> 0) || 1;
}

/**
 * One cell's items: pure in the cell and the cover. Each item takes the cover of the cell corner nearest to it by a
 * dithered pick, so the edge between a lawn and a path is ragged, not a 0.5 m step.
 */
export function bugCellItems(cx: number, cz: number, coverAt: BugCoverAt, share: number): BugItem[] {
    const x0 = cx * BUG_CELL;
    const z0 = cz * BUG_CELL;
    const corners = [coverAt(x0, z0), coverAt(x0 + BUG_CELL, z0), coverAt(x0, z0 + BUG_CELL), coverAt(x0 + BUG_CELL, z0 + BUG_CELL)];
    if (corners.every((c) => !c)) return [];
    const random = seeded(cellSeed(cx, cz));
    const items: BugItem[] = [];
    const area = BUG_CELL * BUG_CELL;
    // The most a corner's surface asks of each kind; each candidate then keeps itself by its own corner's density.
    const most: Partial<Record<BugKind, number>> = {};
    for (const c of corners) {
        if (!c) continue;
        for (const kind of BUG_KINDS) most[kind] = Math.max(most[kind] ?? 0, BUG_DENSITY[c.surface].per[kind] ?? 0);
    }
    // Clumps: moss cushions and rosettes gather round one spot of the cell.
    const clumpX = random();
    const clumpZ = random();
    for (const kind of BUG_KINDS) {
        const expected = (most[kind] ?? 0) * area * share;
        if (expected <= 0) continue;
        let count = Math.floor(expected) + (random() < expected - Math.floor(expected) ? 1 : 0);
        const clump = kind === "moss";
        while (count-- > 0) {
            const u = clump ? Math.min(Math.max(clumpX + (random() - 0.5) * 0.5, 0), 0.999) : random();
            const v = clump ? Math.min(Math.max(clumpZ + (random() - 0.5) * 0.5, 0), 0.999) : random();
            const pick = random();
            const keep = random();
            const yaw = random() * Math.PI * 2;
            const a = random();
            const b = random();
            const c = random();
            // Bilinear weights of the four corners, then a dithered pick of one.
            const w = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v];
            let k = 0;
            for (let acc = w[0]; k < 3 && pick > acc; acc += w[k + 1]) k++;
            const cover = corners[k];
            if (!cover) continue;
            const density = BUG_DENSITY[cover.surface];
            if (keep * (most[kind] ?? 0) >= (density.per[kind] ?? 0)) continue;
            const x = x0 + u * BUG_CELL;
            const z = z0 + v * BUG_CELL;
            // The height: the four corners' drawn heights, bilinearly (a cell is half a mesh cell: the mesh is flat over it
            // or bends once), falling back to the picked corner's where a corner has none.
            const h = (i: number) => corners[i]?.height ?? cover.height;
            const y = h(0) * w[0] + h(1) * w[1] + h(2) * w[2] + h(3) * w[3];
            const tints = TINTS[kind];
            let item: BugItem;
            switch (kind) {
                case "blade": {
                    const [lo, hi] = density.blade;
                    const tall = lo + (hi - lo) * a * a;
                    const dry = c < cover.dry * 0.8 + 0.04;
                    item = {kind, x, y: y - 0.006, z, yaw, lean: 0.08 + b * 0.55, sx: 0.6 + b * 1.1, sy: tall, sz: tall, colour: dry ? 6 + Math.floor(a * 3) % 3 : Math.floor(c * 6) % 6};
                    break;
                }
                case "grit": {
                    const tones = GRIT_TONES[cover.surface];
                    // Mostly crumbs, now and then a stone (gravel: mostly stones).
                    const size = cover.surface === "gravel" ? 0.004 + a * a * 0.016 : cover.surface === "sand" ? 0.0015 + a * a * 0.006 : 0.002 + a * a * a * 0.014;
                    item = {kind, x, y: y - size * 0.35, z, yaw, lean: (b - 0.5) * 1.2, sx: size * (0.8 + b * 0.6), sy: size * (0.45 + c * 0.35), sz: size * (0.7 + c * 0.5), colour: tones[Math.floor(c * tones.length) % tones.length]};
                    break;
                }
                case "moss": {
                    const size = 0.018 + a * 0.04;
                    item = {kind, x, y: y - size * 0.15, z, yaw, lean: 0, sx: size * (0.8 + b * 0.5), sy: size * (0.45 + c * 0.25), sz: size * (0.8 + c * 0.5), colour: Math.floor(b * tints.length)};
                    break;
                }
                case "twig": {
                    const length = 0.03 + a * 0.09;
                    const radius = 0.0012 + b * 0.0022;
                    item = {kind, x, y: y + radius * 0.5, z, yaw, lean: (c - 0.5) * 0.12, sx: length, sy: radius, sz: radius, colour: Math.floor(c * tints.length)};
                    break;
                }
                case "leaf": {
                    const size = 0.5 + a * 0.9;
                    item = {kind, x, y: y + 0.001, z, yaw, lean: (b - 0.5) * 0.5, sx: size, sy: size, sz: size, colour: Math.floor(c * tints.length)};
                    break;
                }
                case "rosette": {
                    const size = 0.7 + a * 0.8;
                    item = {kind, x, y, z, yaw, lean: 0, sx: size, sy: size, sz: size, colour: Math.floor(c * tints.length)};
                    break;
                }
                case "shell": {
                    const size = 0.4 + a * 0.9;
                    item = {kind, x, y: y - 0.001, z, yaw, lean: (b - 0.5) * 0.6, sx: size, sy: size, sz: size, colour: Math.floor(c * tints.length)};
                    break;
                }
            }
            items.push(item);
        }
    }
    return items;
}

// MARK: - What covers the wild island's ground

/**
 * The wild island's (and v1's) cover at a point, from the same ground the shader paints: its zone, how far inland,
 * the water over it and the drawn mesh's height and slope. Steep ground (a rock face) and snow grow nothing.
 */
export function wildBugCover(x: number, z: number): BugCover | null {
    const s = sampleGround(x, z);
    if (s.land < 0.08 || s.height < 0.05) return null;
    if (arkWorld() === "v2") {
        const water = wildWaterSurface(x, z);
        if (Number.isFinite(water) && water > s.height - 0.02) return null;
    } else if (s.river < 1.2) return null;
    const e = 0.3;
    const slope = Math.hypot(drawnGroundHeight(x + e, z) - drawnGroundHeight(x - e, z), drawnGroundHeight(x, z + e) - drawnGroundHeight(x, z - e)) / (2 * e);
    if (slope > 0.75) return null;
    const height = drawnGroundHeight(x, z);
    const w = s.weights as Record<string, number | undefined>;
    const zone = zoneAt(s);
    // The beach: the seashore's sand down by the water (the shader's sand), dune grass behind it.
    const beach = (1 - Math.min(Math.max((s.land - 0.45) / 0.55, 0), 1)) * (1 - s.cliff);
    if (zone === "polar") return null;
    if (beach > 0.5 || zone === "desert") return {surface: "sand", height, dry: 0.8};
    if (zone === "mountains") return slope > 0.4 || (w.mountains ?? 0) > 0.7 ? {surface: "gravel", height, dry: 0.4} : {surface: "meadow", height, dry: 0.35};
    if (zone === "woodland" || zone === "rainforest") return {surface: "woods", height, dry: 0.2};
    if (zone === "wetland" || zone === "river_lake") return {surface: "meadow", height, dry: 0.02};
    if (zone === "farm_garden") return {surface: "lawn", height, dry: 0.1};
    // The seashore is painted sand inland too (its dunes): sand, with a blade of dune grass now and then.
    if (zone === "seashore") return {surface: "sand", height, dry: 0.45};
    // Grassland: drier as the moisture falls (v2's own field; v1 has none).
    const moisture = (s as unknown as {moisture?: number}).moisture;
    return {surface: "meadow", height, dry: moisture === undefined ? 0.3 : Math.min(Math.max(0.65 - moisture, 0.05), 0.7)};
}

// MARK: - The town's (registered by the islands scene, which loads the town's modules)

type IslandCover = {inside: (x: number, z: number) => boolean; cover: BugCoverAt};
let island: IslandCover | null = null;

/** The town's cover in the world frame and where it applies; null when the town goes. */
export function setBugIslandCover(next: IslandCover | null): void {
    island = next;
    coverVersion++;
}
let coverVersion = 0;

/** The cover at a world point: the town's where it is, the wild island's elsewhere. */
export function bugCoverAt(x: number, z: number): BugCover | null {
    if (island?.inside(x, z)) return island.cover(x, z);
    return wildBugCover(x, z);
}

// MARK: - Shapes

/** A grass blade 1 m tall and about 4 mm wide at its foot (scaled per instance): bowed forward, pointed, dark at the root. */
function bladeGeometry(): BufferGeometry {
    const SEG = 4;
    const positions: number[] = [];
    const colours: number[] = [];
    const normals: number[] = [];
    const at = (t: number, side: number): [number, number, number] => {
        const half = 0.0024 * Math.pow(1 - t, 0.7) + 0.0002;
        // Bowed forward along +z, more toward the tip; its middle a little raised (a keeled blade).
        return [side * half, t * (1 - 0.12 * t * t), 0.22 * t * t];
    };
    for (let i = 0; i < SEG; i++) {
        const t0 = i / SEG;
        const t1 = (i + 1) / SEG;
        const a = at(t0, -1);
        const b = at(t0, 1);
        const c = at(t1, -1);
        const d = at(t1, 1);
        const tone = (t: number) => 0.32 + 0.68 * Math.pow(t, 0.6);
        const quad = i === SEG - 1 ? [a, b, [0, d[1], d[2]] as [number, number, number]] : [a, b, d, a, d, c];
        const ts = i === SEG - 1 ? [t0, t0, t1] : [t0, t0, t1, t0, t1, t1];
        quad.forEach((p, k) => {
            positions.push(...p);
            const v = tone(ts[k]);
            colours.push(v, v, v);
            // Lit mostly as the sward it stands in (up), a little as its own face (toward -z, out of the bow).
            normals.push(0, 0.92, -0.39);
        });
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(colours), 3));
    return g;
}

/** Shade a geometry's vertices by a rule (white otherwise), non-indexed with normals. */
function shade(geometry: BufferGeometry, rule: (x: number, y: number, z: number) => number): BufferGeometry {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.deleteAttribute("uv");
    g.computeVertexNormals();
    const p = g.getAttribute("position");
    const colours = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) colours.fill(rule(p.getX(i), p.getY(i), p.getZ(i)), i * 3, i * 3 + 3);
    g.setAttribute("color", new BufferAttribute(colours, 3));
    return g;
}

/** A flat leaf, pointed at both ends, along +z from the origin, with a midrib's crease. */
function leafShape(length: number, width: number): BufferGeometry {
    const p: number[] = [];
    const n = 4;
    for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        const w0 = Math.sin(Math.PI * t0) * width / 2;
        const w1 = Math.sin(Math.PI * t1) * width / 2;
        const lift = (t: number) => 0.004 * Math.sin(Math.PI * t);
        // Each half: the rib a little higher than the edge.
        p.push(0, lift(t0) + 0.001, t0 * length, -w0, lift(t0), t0 * length, -w1, lift(t1), t1 * length);
        p.push(0, lift(t0) + 0.001, t0 * length, -w1, lift(t1), t1 * length, 0, lift(t1) + 0.001, t1 * length);
        p.push(0, lift(t0) + 0.001, t0 * length, w1, lift(t1), t1 * length, w0, lift(t0), t0 * length);
        p.push(0, lift(t0) + 0.001, t0 * length, 0, lift(t1) + 0.001, t1 * length, w1, lift(t1), t1 * length);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(p), 3));
    return g;
}

function shapes(): Record<BugKind, BufferGeometry> {
    const grit = new IcosahedronGeometry(0.5, 0);
    const moss = new IcosahedronGeometry(0.5, 1);
    {
        // A cushion: the lower half pressed flat, the top lumpy.
        const p = moss.getAttribute("position");
        const random = seeded(4417);
        for (let i = 0; i < p.count; i++) {
            const y = p.getY(i);
            const bump = 1 + (random() - 0.5) * 0.25;
            p.setXYZ(i, p.getX(i) * bump, Math.max(y, -0.05) * bump, p.getZ(i) * bump);
        }
    }
    const twig = new CylinderGeometry(0.85, 1, 1, 4, 1, true);
    twig.rotateZ(Math.PI / 2);
    // A side shoot near one end.
    const shoot = new CylinderGeometry(0.5, 0.7, 0.3, 3, 1, true);
    shoot.rotateZ(Math.PI / 2 - 0.6);
    shoot.translate(0.3, 0.05, 0);
    const leaf = leafShape(0.045, 0.026);
    leaf.translate(0, 0, -0.022);
    {
        // Curled: the edges up a little, as a dry leaf lies.
        const p = leaf.getAttribute("position");
        for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.abs(p.getX(i)) * 0.35);
    }
    const lobes: BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
        const l = leafShape(0.05 + (i % 2) * 0.012, 0.018);
        l.rotateX(-0.22);
        l.rotateY((i / 6) * Math.PI * 2 + (i % 2) * 0.3);
        lobes.push(l);
    }
    const shell = new BufferGeometry();
    {
        const fan: number[] = [];
        const ribs = 7;
        for (let i = 0; i < ribs; i++) {
            const a0 = Math.PI * (0.12 + (0.76 * i) / ribs);
            const a1 = Math.PI * (0.12 + (0.76 * (i + 1)) / ribs);
            const r = 0.012;
            fan.push(0, 0.0015, 0, Math.cos(a0) * r, 0.003 + 0.0008 * (i % 2), Math.sin(a0) * r, Math.cos(a1) * r, 0.003 + 0.0008 * ((i + 1) % 2), Math.sin(a1) * r);
        }
        shell.setAttribute("position", new BufferAttribute(new Float32Array(fan), 3));
    }
    return {
        blade: bladeGeometry(),
        grit: shade(grit, (_, y) => 0.75 + 0.5 * (y + 0.5)),
        moss: shade(moss, (x, y, z) => 0.55 + 0.55 * Math.max(y, 0) + 0.12 * Math.sin(x * 40 + z * 31)),
        twig: shade(mergeGeometries([twig.toNonIndexed(), shoot.toNonIndexed()].map((g) => (g.deleteAttribute("uv"), g.deleteAttribute("normal"), g)))!, (_, y) => 0.8 + 0.2 * y),
        leaf: shade(leaf, () => 1),
        rosette: shade(mergeGeometries(lobes)!, (x, _, z) => 0.7 + 4 * Math.hypot(x, z)),
        shell: shade(shell, (x, _, z) => 0.85 + 0.15 * Math.abs(Math.sin(Math.atan2(z, x) * 7)))
    };
}

// MARK: - The layer

/** How many small animals' spots the blades keep clear at once. */
export const BUG_CLEAR_MAX = 12;
const CLEAR = {value: new Float32Array(BUG_CLEAR_MAX * 4)};
const CLEAR_COUNT = {value: 0};

/**
 * The blades' material: lit as the sward they stand in, swaying a little in the wind (more at the tip), and bowed
 * down and away round each clear point (a small animal's body), so it sits among them, seen.
 */
function bladeMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.82, side: DoubleSide});
    material.customProgramCacheKey = () => "ark-bug-blades-1";
    material.onBeforeCompile = (shader) => {
        shader.uniforms.arkTime = ARK_TIME;
        shader.uniforms.arkWind = ARK_WIND;
        shader.uniforms.envWind = ARK_ENV.wind;
        shader.uniforms.bugClear = CLEAR;
        shader.uniforms.bugClearCount = CLEAR_COUNT;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
uniform float arkTime;
uniform vec2 arkWind;
uniform float envWind;
uniform vec4 bugClear[${BUG_CLEAR_MAX}];
uniform float bugClearCount;`)
            .replace("#include <project_vertex>", `#ifdef USE_INSTANCING
vec4 mvPosition;
{
    mat4 toWorld = modelMatrix * instanceMatrix;
    vec3 root = (toWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec4 w = toWorld * vec4(transformed, 1.0);
    float up = w.y - root.y;
    // The wind: each blade its own phase; whole cycles in the shared clock's 600 s window.
    float gust = 0.35 + 0.65 * envWind;
    vec2 sway = normalize(arkWind + vec2(1e-4)) * (sin(arkTime * 2.0944 + root.x * 3.1 + root.z * 2.3) * 0.6 + sin(arkTime * 3.6652 + root.z * 5.3) * 0.25);
    w.xz += sway * up * up * 2.2 * gust;
    for (int i = 0; i < ${BUG_CLEAR_MAX}; i++) {
        if (float(i) >= bugClearCount) break;
        vec4 c = bugClear[i];
        vec2 away = root.xz - c.xz;
        float d = length(away);
        float k = (1.0 - smoothstep(c.w * 0.7, c.w * 1.8, d)) * (1.0 - smoothstep(0.25, 0.6, abs(root.y - c.y)));
        if (k <= 0.0) continue;
        // Bowed down and out: the tip lies low beyond the body's edge.
        w.y = root.y + (w.y - root.y) * (1.0 - 0.75 * k);
        w.xz += away / max(d, 1e-3) * up * 0.9 * k;
    }
    mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
}
#else
#include <project_vertex>
#endif`);
        // Both faces lit alike, as the sward (no dark backs where a blade turns away).
        shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
normal = normalize(normal * faceDirection);`);
    };
    return material;
}

type ClearIn = {x: number; y: number; z: number; length: number};
const clearIn: ClearIn = {x: 0, y: 0, z: 0, length: 0};
const clearOut: Array<{x: number; y: number; z: number; radius: number; d: number}> = Array.from({length: 64}, () => ({x: 0, y: 0, z: 0, radius: 0, d: 0}));
const clearList: typeof clearOut = [];

/**
 * The clear points for the frame (no allocation): every animal `read` reports (true: drawn) whose body is within the
 * layer's reach of the point looked at, nearest that point first. Its radius: half its length and a little, at least
 * 3 cm (an ant's patch is still a patch).
 */
export function bugClearPoints<T>(items: readonly T[], read: (item: T, out: ClearIn) => boolean, target: {x: number; z: number}, reach: number): typeof clearOut {
    clearList.length = 0;
    for (const item of items) {
        if (clearList.length >= clearOut.length) break;
        if (!read(item, clearIn)) continue;
        const radius = Math.max(clearIn.length * 0.55, 0.03) + 0.02;
        const d = Math.hypot(clearIn.x - target.x, clearIn.z - target.z);
        if (d > reach + radius) continue;
        const slot = clearOut[clearList.length];
        slot.x = clearIn.x;
        slot.y = clearIn.y;
        slot.z = clearIn.z;
        slot.radius = radius;
        slot.d = d;
        clearList.push(slot);
    }
    clearList.sort((a, b) => a.d - b.d);
    return clearList;
}

export class BugGround {
    readonly group = new Group();
    private readonly meshes = new Map<BugKind, InstancedMesh>();
    private readonly cells = new Map<string, BugItem[]>();
    private readonly wanted: Array<[number, number]> = [];
    private lastKey = "";
    private tier: "high" | "medium" | "low" = "high";
    private dirty = false;
    private sinceWrite = 0;
    private currentRadius = 1;
    private version = -1;
    private readonly materials: MeshStandardMaterial[];
    private readonly matrix = new Matrix4();
    private readonly rotation = new Quaternion();
    private readonly lean = new Quaternion();
    private readonly position = new Vector3();
    private readonly size = new Vector3();
    private readonly axis = new Vector3();
    private readonly colour = new Color();
    private readonly palette: Record<BugKind, Color[]>;

    constructor(private readonly coverAt: BugCoverAt = bugCoverAt) {
        const geometry = shapes();
        const blades = bladeMaterial();
        const solid = new MeshStandardMaterial({vertexColors: true, roughness: 0.9, side: DoubleSide});
        this.materials = [blades, solid];
        this.palette = Object.fromEntries(BUG_KINDS.map((kind) => [kind, TINTS[kind].map((hex) => new Color(hex))])) as Record<BugKind, Color[]>;
        const caps = BUG_TIERS.high.caps;
        for (const kind of BUG_KINDS) {
            const mesh = new InstancedMesh(geometry[kind], kind === "blade" ? blades : solid, caps[kind]);
            mesh.instanceMatrix.setUsage(DynamicDrawUsage);
            mesh.count = 0;
            mesh.visible = false;
            mesh.frustumCulled = false;
            mesh.receiveShadow = true;
            mesh.castShadow = false;
            mesh.name = `bug-ground:${kind}`;
            this.meshes.set(kind, mesh);
            this.group.add(mesh);
        }
        this.group.name = "bug-ground";
    }

    /** The quality tier: its share, reach and caps (changing it rebuilds the cells). */
    setTier(tier: "high" | "medium" | "low") {
        if (tier === this.tier) return;
        this.tier = tier;
        this.cells.clear();
        this.lastKey = "";
    }

    /**
     * The small animals near the point looked at (world x, ground y, z, body radius m): the blades bow away round them.
     * Nearest first; past `BUG_CLEAR_MAX` they are dropped.
     */
    setClear(points: ReadonlyArray<{x: number; y: number; z: number; radius: number}>) {
        const out = CLEAR.value;
        const count = Math.min(points.length, BUG_CLEAR_MAX);
        for (let i = 0; i < count; i++) {
            out[i * 4] = points[i].x;
            out[i * 4 + 1] = points[i].y;
            out[i * 4 + 2] = points[i].z;
            out[i * 4 + 3] = points[i].radius;
        }
        CLEAR_COUNT.value = count;
    }

    /** How far round the point looked at the layer reaches now (m), for the scene's clear points. */
    get reach(): number {
        return this.currentRadius;
    }

    /** Whether it is drawn now (the camera close enough). */
    get shown(): boolean {
        return this.group.visible;
    }

    /** Call each frame with what the camera looks at and how far it is. */
    update(target: {x: number; z: number}, viewDistance: number) {
        const show = viewDistance < SHOW_WITHIN;
        this.group.visible = show;
        if (!show) return;
        if (this.version !== coverVersion) {
            this.version = coverVersion;
            this.cells.clear();
            this.lastKey = "";
        }
        const radius = this.radiusFor(viewDistance);
        const cx = Math.floor(target.x / BUG_CELL);
        const cz = Math.floor(target.z / BUG_CELL);
        const key = `${cx},${cz},${radius}`;
        if (key !== this.lastKey) {
            this.lastKey = key;
            this.currentRadius = radius;
            const reach = Math.ceil(radius / BUG_CELL);
            this.wanted.length = 0;
            for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) if (dx * dx + dz * dz <= reach * reach) this.wanted.push([cx + dx, cz + dz]);
            this.wanted.sort((a, b) => (a[0] - cx) ** 2 + (a[1] - cz) ** 2 - ((b[0] - cx) ** 2 + (b[1] - cz) ** 2));
            Array.from(this.cells.keys()).forEach((cell) => {
                const [x, z] = cell.split(",").map(Number);
                if ((x - cx) ** 2 + (z - cz) ** 2 > (reach + 3) ** 2) this.cells.delete(cell);
            });
            this.dirty = true;
        }
        // A few cells a frame (nearest first), so coming down never stalls a frame.
        let built = 0;
        let pending = false;
        const perFrame = this.tier === "high" ? 14 : this.tier === "medium" ? 9 : 6;
        for (const [x, z] of this.wanted) {
            const cell = `${x},${z}`;
            if (this.cells.has(cell)) continue;
            if (built >= perFrame) {
                pending = true;
                break;
            }
            this.cells.set(cell, bugCellItems(x, z, this.coverAt, BUG_TIERS[this.tier].share));
            this.dirty = true;
            built++;
        }
        // Rewriting the instances is the costly part: while cells are still coming in, every fourth frame only.
        this.sinceWrite++;
        if (this.dirty && (!pending || this.sinceWrite >= 4)) {
            this.sinceWrite = 0;
            this.write(cx, cz);
        }
    }

    /**
     * The patch's reach for a camera this far from its target: about the view's own distance (a beetle seen from 0.6 m
     * needs a metre of sward round it, dense; from 5 m, the tier's whole reach), in half-metre steps, never past the tier's.
     */
    private radiusFor(viewDistance: number): number {
        const tier = BUG_TIERS[this.tier].radius;
        return Math.min(tier, Math.max(1, Math.ceil(viewDistance * 1.1 * 2) / 2));
    }

    private write(cx: number, cz: number) {
        this.dirty = false;
        const {caps} = BUG_TIERS[this.tier];
        const radius = this.currentRadius;
        const reach2 = (radius / BUG_CELL + 0.5) ** 2;
        const counts: Record<BugKind, number> = {blade: 0, grit: 0, moss: 0, twig: 0, leaf: 0, rosette: 0, shell: 0};
        // Nearest cells first, so a cap trims the far edge, never the middle.
        for (const [x, z] of this.wanted) {
            if ((x - cx) ** 2 + (z - cz) ** 2 > reach2) continue;
            const items = this.cells.get(`${x},${z}`);
            if (!items) continue;
            for (const item of items) {
                const n = counts[item.kind];
                if (n >= caps[item.kind]) continue;
                const mesh = this.meshes.get(item.kind)!;
                this.rotation.setFromAxisAngle(this.axis.set(0, 1, 0), item.yaw);
                this.lean.setFromAxisAngle(this.axis.set(1, 0, 0), item.lean);
                this.rotation.multiply(this.lean);
                this.matrix.compose(this.position.set(item.x, item.y, item.z), this.rotation, this.size.set(item.sx, item.sy, item.sz));
                mesh.setMatrixAt(n, this.matrix);
                mesh.setColorAt(n, this.palette[item.kind][item.colour] ?? this.colour.set(0xffffff));
                counts[item.kind] = n + 1;
            }
        }
        this.meshes.forEach((mesh, kind) => {
            mesh.count = counts[kind];
            // No draw call for a kind with nothing in view.
            mesh.visible = counts[kind] > 0;
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        });
    }

    /** Instances drawn now, per kind (for the measure page and the tests). */
    drawn(): Record<BugKind, number> {
        const out = {} as Record<BugKind, number>;
        this.meshes.forEach((mesh, kind) => (out[kind] = this.group.visible && mesh.visible ? mesh.count : 0));
        return out;
    }

    dispose() {
        this.meshes.forEach((mesh) => {
            mesh.geometry.dispose();
            mesh.dispose();
        });
        this.materials.forEach((material) => material.dispose());
        CLEAR_COUNT.value = 0;
    }
}
