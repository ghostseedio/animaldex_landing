/**
 * The reef drawn (graphics pass, batch 4): every kind of `reef.ts` as real
 * shapes, built here in code, instanced per kind and shape with a near and a
 * far version. Near the camera: branching staghorn and bushy corals, table
 * corals, brain corals with their meanders, boulder corals with polyps, sea
 * fans with an open lattice, sea whips, anemones with swaying tentacles,
 * barrel, tube and ball sponges, kelp with its blades, seagrass blades. Further
 * out: the same silhouettes in a few triangles. Past the far reach: nothing.
 *
 * Motion: one shared surge (onshore and back, a swell period of 8 s, with a
 * second wave over it), stronger in wind and storms, fading with depth; kelp
 * bends in a wave that travels up its stipes, anemone tentacles and fan tips
 * move most. It runs in the vertex shader on the sea's clock (epoch seconds,
 * the same for every viewer, `fish-schools.ts`); every frequency makes whole
 * cycles in the clock's 600 s wrap.
 *
 * Colour: each instance's real colour (`reef.ts`), shaded in the shape; tips
 * and rims keep colours of their own. Under water the light that reaches it is
 * absorbed with depth, red first, as on the sea floor (`terrain.ts`), and the
 * sun's caustics play on what faces up.
 */

import {
    BufferAttribute,
    BufferGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    DoubleSide,
    FrontSide,
    IcosahedronGeometry,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    MeshStandardMaterial,
    Quaternion,
    SphereGeometry,
    Vector3,
    type Material
} from "three";
import {mergeGeometries, mergeVertices} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {ARK_ENV, ARK_TIME, NOISE_GLSL} from "@/ark-scene/glsl";
import {ARK_CAUSTICS} from "@/ark-scene/terrain";
import {KELP_HEIGHTS, REEF_HEIGHT, REEF_KINDS, REEF_VARIANTS, reefGrowth, type ReefItem, type ReefKind} from "@/ark-scene/reef";
import {SEA_CLOCK_PERIOD, seaClockSeconds, seaEpochSeconds} from "@/ark-scene/fish-schools";
import {seeded} from "@/ark-scene/world";

// MARK: - The shared sea clock (uniform)

/** The sea's clock for the shaders: epoch seconds wrapped to `SEA_CLOCK_PERIOD` (the same for every viewer). */
export const ARK_SEA_TIME = {value: 0};

// MARK: - Building blocks

/**
 * Every part carries: its own colour (`arkColour`) and how much of it to use (`arkOwn`, 0 = the instance's colour),
 * a shade for the instance's colour (`arkShade`), how far it moves in the surge (`arkSway`, metres at scale 1) and a
 * surface pattern (`arkPattern`: 0 none, 1 brain meanders, 2 polyps, 3 fan lattice, 4 tentacle, 5 sponge pores,
 * 6 table plate, 7 kelp blade, 8 kelp stipe and float).
 */
type Paint = {
    own?: (p: Vector3, n: Vector3) => [number, number, number, number] | null;
    shade: (p: Vector3, n: Vector3) => number;
    sway: (p: Vector3) => number;
    pattern: number;
};

const ATTRS = ["position", "normal", "arkColour", "arkOwn", "arkShade", "arkSway", "arkPattern"] as const;

function part(source: BufferGeometry, paint: Paint): BufferGeometry {
    const flat = source.index ? source.toNonIndexed() : source;
    if (!flat.getAttribute("normal")) flat.computeVertexNormals();
    const position = flat.getAttribute("position");
    const normal = flat.getAttribute("normal");
    const count = position.count;
    const colour = new Float32Array(count * 3);
    const own = new Float32Array(count);
    const shade = new Float32Array(count);
    const sway = new Float32Array(count);
    const pattern = new Float32Array(count).fill(paint.pattern);
    const p = new Vector3();
    const n = new Vector3();
    for (let i = 0; i < count; i++) {
        p.set(position.getX(i), position.getY(i), position.getZ(i));
        n.set(normal.getX(i), normal.getY(i), normal.getZ(i));
        const mine = paint.own?.(p, n);
        if (mine) {
            colour[i * 3] = mine[0];
            colour[i * 3 + 1] = mine[1];
            colour[i * 3 + 2] = mine[2];
            own[i] = mine[3];
        }
        shade[i] = paint.shade(p, n);
        sway[i] = paint.sway(p);
    }
    const out = new BufferGeometry();
    out.setAttribute("position", position.clone());
    out.setAttribute("normal", normal.clone());
    out.setAttribute("arkColour", new BufferAttribute(colour, 3));
    out.setAttribute("arkOwn", new BufferAttribute(own, 1));
    out.setAttribute("arkShade", new BufferAttribute(shade, 1));
    out.setAttribute("arkSway", new BufferAttribute(sway, 1));
    out.setAttribute("arkPattern", new BufferAttribute(pattern, 1));
    return out;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
    const merged = mergeGeometries(parts);
    if (!merged) throw new Error("reef shape: parts did not merge");
    for (const name of Object.keys(merged.attributes)) if (!(ATTRS as readonly string[]).includes(name)) merged.deleteAttribute(name);
    merged.computeBoundingSphere();
    return merged;
}

const rgb = (hex: string): [number, number, number] => {
    const c = new Color(hex);
    return [c.r, c.g, c.b];
};

/** A tapered tube from `a` to `b` (radii ra → rb), `sides` round, open ended. */
function tube(a: Vector3, b: Vector3, ra: number, rb: number, sides: number, segments = 1): BufferGeometry {
    const length = a.distanceTo(b);
    const g = new CylinderGeometry(rb, ra, length, sides, segments, true);
    g.translate(0, length / 2, 0);
    const dir = b.clone().sub(a).normalize();
    g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir));
    g.translate(a.x, a.y, a.z);
    return g;
}

/** Scale a finished shape so it stands `height` tall from y = 0. */
function standTo(g: BufferGeometry, height: number): BufferGeometry {
    g.computeBoundingBox();
    const box = g.boundingBox!;
    const k = height / Math.max(box.max.y, 1e-3);
    g.scale(k, k, k);
    // The sway was authored at the unscaled size: scale it too.
    const sway = g.getAttribute("arkSway") as BufferAttribute | undefined;
    if (sway) for (let i = 0; i < sway.count; i++) sway.setX(i, sway.getX(i) * k);
    g.computeBoundingSphere();
    return g;
}

// MARK: - Shapes

/** Branching corals: v0 staghorn (long, open), v1 bushy (short, dense, knobbly). Tips paler (v0) or blue-violet (v1). */
function branching(variant: number, near: boolean): BufferGeometry {
    const random = seeded(9101 + variant);
    const parts: BufferGeometry[] = [];
    const tip = variant === 0 ? rgb("#e6dcc0") : rgb("#8d8fd0");
    const sides = near ? 4 : 3;
    const depthMax = variant === 0 ? (near ? 3 : 1) : near ? 2 : 1;
    const grow = (from: Vector3, dir: Vector3, length: number, radius: number, depth: number) => {
        const to = from.clone().addScaledVector(dir, length);
        const end = depth >= depthMax;
        const r1 = end ? radius * 0.55 : radius * 0.72;
        parts.push(part(tube(from, to, radius, r1, sides), {
            shade: (p) => 0.62 + 0.5 * Math.min(p.y / 0.8, 1),
            own: (p) => (end && p.distanceTo(to) < length * 0.45 ? [...tip, 0.85 * (1 - p.distanceTo(to) / (length * 0.45))] as [number, number, number, number] : null),
            sway: () => 0,
            pattern: 2
        }));
        if (end) {
            const cap = new ConeGeometry(r1, r1 * 1.6, sides);
            cap.translate(0, r1 * 0.8, 0);
            cap.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir));
            cap.translate(to.x, to.y, to.z);
            parts.push(part(cap, {shade: () => 1.05, own: () => [...tip, 0.9], sway: () => 0, pattern: 0}));
            return;
        }
        const kids = variant === 0 ? (random() < 0.8 ? 2 : 3) : 2 + Math.floor(random() * 2);
        for (let k = 0; k < kids; k++) {
            const spread = variant === 0 ? 0.35 + random() * 0.45 : 0.55 + random() * 0.55;
            const turn = random() * Math.PI * 2;
            // Away from the parent's line, but bent back toward the light.
            const side = new Vector3(Math.cos(turn), 0, Math.sin(turn));
            const next = dir.clone().multiplyScalar(Math.cos(spread)).addScaledVector(side, Math.sin(spread)).add(new Vector3(0, 0.25, 0)).normalize();
            const len = length * (variant === 0 ? 0.78 + random() * 0.25 : 0.62 + random() * 0.2);
            grow(to, next, len, r1, depth + 1);
        }
    };
    const stems = variant === 0 ? 4 : 7;
    for (let s = 0; s < stems; s++) {
        const angle = (s / stems) * Math.PI * 2 + random() * 0.6;
        const lean = variant === 0 ? 0.25 + random() * 0.35 : 0.35 + random() * 0.4;
        const dir = new Vector3(Math.cos(angle) * Math.sin(lean), Math.cos(lean), Math.sin(angle) * Math.sin(lean)).normalize();
        const start = new Vector3(Math.cos(angle) * 0.05, 0, Math.sin(angle) * 0.05);
        grow(start, dir, variant === 0 ? 0.26 : 0.2, variant === 0 ? 0.035 : 0.045, 0);
    }
    return standTo(merge(parts), REEF_HEIGHT.branching);
}

/** Table corals: a short stalk under a wide, thin plate, its rim a little raised; v1 has a second, smaller tier. */
function table(variant: number, near: boolean): BufferGeometry {
    const random = seeded(9201 + variant);
    const parts: BufferGeometry[] = [];
    const segments = near ? 20 : 10;
    const rings = near ? 2 : 1;
    const plate = (radius: number, y: number, thickness: number, phase: number) => {
        const outline = (a: number) => radius * (1 + 0.1 * Math.sin(3 * a + phase) + 0.06 * Math.sin(7 * a + phase * 2) + 0.04 * Math.sin(11 * a));
        const top: number[] = [];
        const bottom: number[] = [];
        const rim: number[] = [];
        const at = (a: number, k: number, lift: number) => {
            const r = outline(a) * k;
            return [Math.cos(a) * r, y + lift + 0.07 * radius * k * k, Math.sin(a) * r];
        };
        for (let s = 0; s < segments; s++) {
            const a0 = (s / segments) * Math.PI * 2;
            const a1 = ((s + 1) / segments) * Math.PI * 2;
            for (let r = 0; r < rings; r++) {
                const k0 = r / rings;
                const k1 = (r + 1) / rings;
                const p00 = at(a0, k0, thickness);
                const p01 = at(a1, k0, thickness);
                const p10 = at(a0, k1, thickness);
                const p11 = at(a1, k1, thickness);
                top.push(...p00, ...p11, ...p10, ...p00, ...p01, ...p11);
                const q00 = at(a0, k0, 0);
                const q01 = at(a1, k0, 0);
                const q10 = at(a0, k1, 0);
                const q11 = at(a1, k1, 0);
                bottom.push(...q00, ...q10, ...q11, ...q00, ...q11, ...q01);
            }
            const e0 = at(a0, 1, 0);
            const e1 = at(a1, 1, 0);
            const f0 = at(a0, 1, thickness);
            const f1 = at(a1, 1, thickness);
            rim.push(...e0, ...f0, ...f1, ...e0, ...f1, ...e1);
        }
        const make = (points: number[]) => {
            const g = new BufferGeometry();
            g.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
            g.computeVertexNormals();
            return g;
        };
        const edge = rgb("#d8cfae");
        parts.push(part(make(top), {shade: (p) => 0.9 + 0.15 * Math.min(Math.hypot(p.x, p.z) / radius, 1), own: (p) => {
            const k = Math.hypot(p.x, p.z) / radius;
            return k > 0.82 ? [...edge, (k - 0.82) * 2.6] : null;
        }, sway: () => 0, pattern: 6}));
        parts.push(part(make(bottom), {shade: () => 0.5, sway: () => 0, pattern: 2}));
        parts.push(part(make(rim), {shade: () => 0.95, own: () => [...edge, 0.45], sway: () => 0, pattern: 0}));
    };
    const stalk = tube(new Vector3(0, 0, 0), new Vector3(0.02, 0.5, 0.01), 0.11, 0.07, near ? 7 : 4);
    parts.push(part(stalk, {shade: (p) => 0.55 + 0.25 * p.y, sway: () => 0, pattern: 2}));
    plate(0.62, 0.5, 0.045, random() * 6);
    if (variant === 1) plate(0.36, 0.36, 0.035, random() * 6);
    return standTo(merge(parts), REEF_HEIGHT.table);
}

/** A dome with lobes: brain corals (v0 round, v1 long) and boulder corals. */
function dome(radius: number, height: number, lobes: number, seed: number, near: boolean, stretch = 1): BufferGeometry {
    const g = new SphereGeometry(radius, near ? 22 : 9, near ? 10 : 4, 0, Math.PI * 2, 0, Math.PI / 2 + 0.12);
    const position = g.getAttribute("position");
    const random = seeded(seed);
    const bumps = Array.from({length: 5}, () => {
        const a = random() * Math.PI * 2;
        const e = random() * 0.9;
        return new Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
    });
    const v = new Vector3();
    for (let i = 0; i < position.count; i++) {
        v.set(position.getX(i), position.getY(i), position.getZ(i));
        const dir = v.clone().normalize();
        let push = 0;
        for (const b of bumps) push += Math.max(dir.dot(b), 0) ** 4 * lobes;
        v.multiplyScalar(1 + push);
        position.setXYZ(i, v.x * stretch, Math.max(v.y, -0.04) * (height / radius), v.z / Math.sqrt(stretch));
    }
    g.deleteAttribute("normal");
    g.deleteAttribute("uv");
    const merged = mergeVertices(g);
    merged.computeVertexNormals();
    return merged;
}

function brain(variant: number, near: boolean): BufferGeometry {
    const g = dome(0.5, 0.5, 0.12, 9301 + variant, near, variant === 1 ? 1.5 : 1);
    return standTo(merge([part(g, {shade: (p, n) => 0.7 + 0.35 * Math.max(n.y, 0), sway: () => 0, pattern: 1})]), REEF_HEIGHT.brain);
}

function massive(variant: number, near: boolean): BufferGeometry {
    if (variant === 0) {
        const g = dome(0.55, 0.7, 0.32, 9401, near, 1.1);
        return standTo(merge([part(g, {shade: (p, n) => 0.68 + 0.35 * Math.max(n.y, 0), sway: () => 0, pattern: 2})]), REEF_HEIGHT.massive);
    }
    // Columns: knobbly pillars grown together (a lobe coral).
    const random = seeded(9411);
    const parts: BufferGeometry[] = [];
    const columns = near ? 6 : 4;
    for (let c = 0; c < columns; c++) {
        const angle = (c / columns) * Math.PI * 2 + random();
        const r = c === 0 ? 0 : 0.2 + random() * 0.18;
        const h = 0.45 + random() * 0.4;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const radius = 0.13 + random() * 0.05;
        parts.push(part(tube(new Vector3(x, 0, z), new Vector3(x, h, z), radius * 1.15, radius, near ? 8 : 5), {shade: (p) => 0.6 + 0.45 * (p.y / h), sway: () => 0, pattern: 2}));
        const cap = new SphereGeometry(radius, near ? 8 : 5, near ? 4 : 2, 0, Math.PI * 2, 0, Math.PI / 2);
        cap.scale(1, 0.75, 1);
        cap.translate(x, h, z);
        parts.push(part(cap, {shade: () => 1.05, sway: () => 0, pattern: 2}));
    }
    return standTo(merge(parts), REEF_HEIGHT.massive);
}

/** Sea fans (v0: a cupped fan with an open lattice, on a short stalk) and sea whips (v1: thin rods that sway). */
function fan(variant: number, near: boolean): BufferGeometry {
    const random = seeded(9501 + variant);
    if (variant === 0) {
        const parts: BufferGeometry[] = [];
        const columns = near ? 16 : 6;
        const rows = near ? 7 : 2;
        const points: number[] = [];
        const span = 1.15;
        const at = (u: number, k: number) => {
            const a = (u - 0.5) * 2 * span;
            const r = 0.06 + k * (0.92 + 0.08 * Math.cos(3 * a) + 0.05 * Math.sin(7 * a + 1));
            const x = Math.sin(a) * r;
            const y = Math.cos(a) * r * 0.95 + 0.06;
            return [x, y, 0.16 * x * x - 0.05 * y];
        };
        for (let i = 0; i < columns; i++) {
            for (let j = 0; j < rows; j++) {
                const u0 = i / columns;
                const u1 = (i + 1) / columns;
                const k0 = j / rows;
                const k1 = (j + 1) / rows;
                points.push(...at(u0, k0), ...at(u1, k0), ...at(u1, k1), ...at(u0, k0), ...at(u1, k1), ...at(u0, k1));
            }
        }
        const blade = new BufferGeometry();
        blade.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
        blade.computeVertexNormals();
        parts.push(part(blade, {shade: (p) => 0.8 + 0.25 * Math.min(p.y, 1), sway: (p) => 0.07 * Math.min(Math.hypot(p.x, p.y) / 1, 1) ** 2, pattern: near ? 3 : 0}));
        parts.push(part(tube(new Vector3(0, 0, 0), new Vector3(0, 0.1, 0), 0.035, 0.025, 5), {shade: () => 0.6, sway: () => 0, pattern: 0}));
        return standTo(merge(parts), REEF_HEIGHT.fan);
    }
    const parts: BufferGeometry[] = [];
    const rods = near ? 9 : 5;
    for (let r = 0; r < rods; r++) {
        const angle = random() * Math.PI * 2;
        const lean = 0.08 + random() * 0.35;
        const height = 0.55 + random() * 0.5;
        const base = new Vector3(Math.cos(angle) * 0.04, 0, Math.sin(angle) * 0.04);
        const segs = near ? 4 : 2;
        let from = base;
        for (let s = 0; s < segs; s++) {
            const t = (s + 1) / segs;
            const to = new Vector3(Math.cos(angle) * Math.sin(lean) * height * t * 1.2 + base.x, height * t, Math.sin(angle) * Math.sin(lean) * height * t * 1.2 + base.z);
            parts.push(part(tube(from, to, 0.016 * (1.1 - (t - 1 / segs) * 0.6), 0.016 * (1.1 - t * 0.6), near ? 5 : 3), {shade: (p) => 0.75 + 0.3 * p.y, sway: (p) => 0.11 * (p.y / height) ** 2, pattern: 0}));
            from = to;
        }
    }
    return standTo(merge(parts), REEF_HEIGHT.fan);
}

/** Anemones: a column, an oral disc and a crown of tentacles that sway on their own phases. */
function anemone(variant: number, near: boolean): BufferGeometry {
    const random = seeded(9601 + variant);
    const parts: BufferGeometry[] = [];
    const column = variant === 0 ? rgb("#b8a088") : rgb("#a8392e");
    const tipColour = variant === 0 ? rgb("#b0508a") : rgb("#e8d8b8");
    parts.push(part(tube(new Vector3(0, 0, 0), new Vector3(0, 0.1, 0), 0.13, 0.12, near ? 10 : 6), {shade: () => 0.85, own: () => [...column, 1], sway: () => 0, pattern: 0}));
    if (!near) {
        const puff = new SphereGeometry(0.2, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
        puff.scale(1, 0.9, 1);
        puff.translate(0, 0.1, 0);
        parts.push(part(puff, {shade: (p) => 0.75 + 0.5 * p.y, sway: (p) => 0.02 * (p.y / 0.3), pattern: 4}));
        return standTo(merge(parts), REEF_HEIGHT.anemone);
    }
    const count = variant === 0 ? 36 : 50;
    const length = variant === 0 ? 0.16 : 0.2;
    for (let t = 0; t < count; t++) {
        const ring = Math.sqrt((t + 0.5) / count);
        const angle = t * 2.39996 + random() * 0.2;
        const from = new Vector3(Math.cos(angle) * 0.12 * ring, 0.1, Math.sin(angle) * 0.12 * ring);
        const out = 0.25 + 0.9 * ring;
        const dir = new Vector3(Math.cos(angle) * Math.sin(out), Math.cos(out) + 0.15, Math.sin(angle) * Math.sin(out)).normalize();
        const len = length * (0.8 + 0.4 * random());
        const mid = from.clone().addScaledVector(dir, len * 0.55);
        const end = mid.clone().addScaledVector(dir.clone().add(new Vector3(0, -0.25 * ring, 0)).normalize(), len * 0.45);
        const r = variant === 0 ? 0.011 : 0.008;
        const paint: Paint = {
            shade: (p) => 0.75 + 0.5 * Math.min((p.y - 0.1) / 0.18, 1),
            own: (p) => {
                const k = p.distanceTo(from) / len;
                return k > 0.72 ? [...tipColour, Math.min((k - 0.72) * 3.2, 0.9)] : null;
            },
            sway: (p) => 0.035 * Math.min(p.distanceTo(from) / len, 1) ** 1.5,
            pattern: 4
        };
        parts.push(part(tube(from, mid, r, r * 0.9, 3), paint));
        parts.push(part(tube(mid, end, r * 0.9, r * (variant === 0 ? 1.15 : 0.4), 3), paint));
    }
    return standTo(merge(parts), REEF_HEIGHT.anemone);
}

/** A lathe round y: `profile` [r, y] pairs, with vertical ridges. */
function lathe(profile: Array<[number, number]>, sides: number, ridges: number, ridgeDepth: number): BufferGeometry {
    const points: number[] = [];
    for (let s = 0; s < sides; s++) {
        const a0 = (s / sides) * Math.PI * 2;
        const a1 = ((s + 1) / sides) * Math.PI * 2;
        const k0 = 1 + ridgeDepth * Math.cos(ridges * a0);
        const k1 = 1 + ridgeDepth * Math.cos(ridges * a1);
        for (let i = 0; i < profile.length - 1; i++) {
            const [r0, y0] = profile[i];
            const [r1, y1] = profile[i + 1];
            const p = (r: number, y: number, a: number, k: number) => [Math.cos(a) * r * k, y, Math.sin(a) * r * k];
            points.push(...p(r0, y0, a0, k0), ...p(r1, y1, a0, k0), ...p(r1, y1, a1, k1), ...p(r0, y0, a0, k0), ...p(r1, y1, a1, k1), ...p(r0, y0, a1, k1));
        }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    g.computeVertexNormals();
    return g;
}

function barrelSponge(_variant: number, near: boolean): BufferGeometry {
    const outside: Array<[number, number]> = [[0.3, 0], [0.4, 0.22], [0.44, 0.5], [0.41, 0.78], [0.38, 0.95], [0.32, 0.97]];
    const inside: Array<[number, number]> = [[0.31, 0.97], [0.27, 0.9], [0.22, 0.55], [0.12, 0.3]];
    const sides = near ? 18 : 8;
    return standTo(merge([
        part(lathe(outside, sides, 7, near ? 0.07 : 0.03), {shade: (p) => 0.62 + 0.45 * p.y, sway: () => 0, pattern: 5}),
        part(lathe(inside, sides, 7, 0.03), {shade: () => 0.35, sway: () => 0, pattern: 5})
    ]), REEF_HEIGHT.barrel_sponge);
}

function tubeSponge(variant: number, near: boolean): BufferGeometry {
    const random = seeded(9701 + variant);
    const parts: BufferGeometry[] = [];
    const tubes = variant === 0 ? 5 : 3;
    for (let t = 0; t < tubes; t++) {
        const angle = (t / tubes) * Math.PI * 2 + random() * 0.8;
        const r = t === 0 ? 0 : 0.08 + random() * 0.1;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const height = 0.45 + random() * 0.4;
        const radius = variant === 0 ? 0.05 + random() * 0.025 : 0.08 + random() * 0.03;
        const lean = (random() - 0.5) * 0.25;
        const outside: Array<[number, number]> = [[radius * 0.8, 0], [radius, height * 0.4], [radius * 1.08, height * 0.9], [radius * 1.12, height], [radius * 0.85, height]];
        const inside: Array<[number, number]> = [[radius * 0.86, height], [radius * 0.78, height * 0.85], [radius * 0.6, height * 0.2]];
        for (const [profile, shade] of (near ? [[outside, (p: Vector3) => 0.65 + 0.45 * p.y / height], [inside, () => 0.32]] : [[outside, (p: Vector3) => 0.65 + 0.45 * p.y / height]]) as Array<[Array<[number, number]>, (p: Vector3) => number]>) {
            const g = lathe(profile as Array<[number, number]>, near ? 9 : 5, 0, 0);
            g.rotateZ(lean);
            g.translate(x, 0, z);
            parts.push(part(g, {shade: shade as (p: Vector3) => number, sway: (p) => 0.012 * p.y, pattern: 5}));
        }
    }
    return standTo(merge(parts), REEF_HEIGHT.tube_sponge);
}

function ballSponge(_variant: number, near: boolean): BufferGeometry {
    let g: BufferGeometry = new IcosahedronGeometry(0.26, near ? 2 : 1);
    g.deleteAttribute("normal");
    g.deleteAttribute("uv");
    g = mergeVertices(g);
    const position = g.getAttribute("position");
    const v = new Vector3();
    for (let i = 0; i < position.count; i++) {
        v.set(position.getX(i), position.getY(i), position.getZ(i));
        const bump = 1 + 0.14 * Math.sin(v.x * 21) * Math.sin(v.z * 17 + v.y * 9);
        position.setXYZ(i, v.x * bump * 1.15, (Math.max(v.y, -0.06) * 0.8 + 0.06) * bump, v.z * bump);
    }
    g.computeVertexNormals();
    return standTo(merge([part(g, {shade: (p) => 0.65 + 0.9 * p.y, sway: () => 0, pattern: 5})]), REEF_HEIGHT.ball_sponge);
}

/**
 * Kelp: a holdfast and three or four stipes rising to near the surface, blades all along them (alternating, wavy,
 * reaching up and out), a float at each blade's foot. `KELP_HEIGHTS[variant]` tall. The far version: each stipe as
 * one broad ribbon.
 */
function kelp(variant: number, near: boolean): BufferGeometry {
    const random = seeded(9801 + variant);
    const height = KELP_HEIGHTS[variant];
    const parts: BufferGeometry[] = [];
    const stipeColour = rgb("#5a4a1e");
    const stipes = variant === 0 ? 3 : 4;
    const hold = new SphereGeometry(0.16, near ? 7 : 4, 3, 0, Math.PI * 2, 0, Math.PI / 2);
    hold.scale(1, 0.6, 1);
    parts.push(part(hold, {shade: () => 0.55, own: () => [...stipeColour, 1], sway: () => 0, pattern: 8}));
    for (let s = 0; s < stipes; s++) {
        const angle = (s / stipes) * Math.PI * 2 + random() * 0.7;
        const reach = height * (0.82 + 0.18 * random());
        const drift = 0.25 + random() * 0.4;
        // The stipe's line: up, leaning out a little, with a gentle S.
        const line = (t: number) => new Vector3(Math.cos(angle) * (0.06 + drift * t + 0.12 * Math.sin(t * 5 + s)), reach * t, Math.sin(angle) * (0.06 + drift * t + 0.12 * Math.cos(t * 4 + s)));
        const sway = (p: Vector3) => 0.55 * Math.min(p.y / height, 1) ** 1.4;
        if (!near) {
            const points: number[] = [];
            const segs = 8;
            const w = 0.16;
            const side = new Vector3(-Math.sin(angle), 0, Math.cos(angle));
            for (let k = 0; k < segs; k++) {
                const a = line(k / segs);
                const b = line((k + 1) / segs);
                const wa = w * (k === 0 ? 0.4 : 1);
                const wb = w * (k === segs - 1 ? 0.5 : 1);
                points.push(a.x - side.x * wa, a.y, a.z - side.z * wa, b.x - side.x * wb, b.y, b.z - side.z * wb, b.x + side.x * wb, b.y, b.z + side.z * wb);
                points.push(a.x - side.x * wa, a.y, a.z - side.z * wa, b.x + side.x * wb, b.y, b.z + side.z * wb, a.x + side.x * wa, a.y, a.z + side.z * wa);
            }
            const ribbon = new BufferGeometry();
            ribbon.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
            ribbon.computeVertexNormals();
            parts.push(part(ribbon, {shade: (p) => 0.7 + 0.4 * (p.y / height), sway, pattern: 7}));
            continue;
        }
        const segs = Math.max(Math.round(reach / 0.5), 5);
        for (let k = 0; k < segs; k++) {
            parts.push(part(tube(line(k / segs), line((k + 1) / segs), 0.014, 0.012, 3), {shade: () => 0.6, own: () => [...stipeColour, 1], sway, pattern: 8}));
        }
        // Blades every ~0.3 m, alternating sides, each wavy and reaching up and out.
        const blades = Math.floor(reach / 0.4);
        for (let b = 1; b < blades; b++) {
            const t = b / blades;
            const at = line(t);
            const turn = angle + (b % 2 ? 1 : -1) * (0.9 + random() * 0.6) + random() * 0.3;
            const out = new Vector3(Math.cos(turn), 0.9 + random() * 0.5, Math.sin(turn)).normalize();
            const side = new Vector3(-Math.sin(turn), 0, Math.cos(turn));
            const length = (0.32 + random() * 0.2) * (t > 0.85 ? 0.75 : 1);
            const width = 0.055 + random() * 0.025;
            const points: number[] = [];
            const steps = 3;
            for (let k = 0; k < steps; k++) {
                const u0 = k / steps;
                const u1 = (k + 1) / steps;
                const w0 = width * Math.sin(Math.PI * Math.min(u0 + 0.12, 1)) ** 0.7;
                const w1 = width * Math.sin(Math.PI * Math.min(u1 + 0.12, 1)) ** 0.7;
                const c0 = at.clone().addScaledVector(out, length * u0).add(new Vector3(0, 0.04 * Math.sin(u0 * 9 + b), 0));
                const c1 = at.clone().addScaledVector(out, length * u1).add(new Vector3(0, 0.04 * Math.sin(u1 * 9 + b), 0));
                // Ruffled edges: one edge a little up, the other down.
                const r0 = 0.012 * Math.sin(u0 * 13 + b);
                const r1 = 0.012 * Math.sin(u1 * 13 + b);
                points.push(c0.x - side.x * w0, c0.y - r0, c0.z - side.z * w0, c1.x - side.x * w1, c1.y - r1, c1.z - side.z * w1, c1.x + side.x * w1, c1.y + r1, c1.z + side.z * w1);
                points.push(c0.x - side.x * w0, c0.y - r0, c0.z - side.z * w0, c1.x + side.x * w1, c1.y + r1, c1.z + side.z * w1, c0.x + side.x * w0, c0.y + r0, c0.z + side.z * w0);
            }
            const blade = new BufferGeometry();
            blade.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
            blade.computeVertexNormals();
            parts.push(part(blade, {shade: () => 0.85 + 0.25 * random(), sway: (p) => sway(p) + 0.03, pattern: 7}));
            // The float (pneumatocyst) at its foot.
            const float = new SphereGeometry(0.022, 4, 2);
            float.translate(at.x + out.x * 0.02, at.y + 0.01, at.z + out.z * 0.02);
            parts.push(part(float, {shade: () => 0.9, own: () => [...rgb("#8a7a32"), 1], sway, pattern: 8}));
        }
    }
    return merge(parts);
}

/** Seagrass: a clump of strap blades over about 0.8 m (v0 long ribbon blades, v1 shorter and denser). */
function seagrass(variant: number, near: boolean): BufferGeometry {
    const random = seeded(9901 + variant);
    const points: number[] = [];
    const blades = near ? (variant === 0 ? 18 : 26) : variant === 0 ? 6 : 8;
    const steps = near ? 3 : 1;
    for (let b = 0; b < blades; b++) {
        const x = (random() - 0.5) * 0.8;
        const z = (random() - 0.5) * 0.8;
        const height = (variant === 0 ? 0.24 + random() * 0.22 : 0.12 + random() * 0.12) * (near ? 1 : 1.15);
        const width = (variant === 0 ? 0.011 : 0.006) * (near ? 1 : 2.4);
        const turn = random() * Math.PI;
        const lean = (random() - 0.5) * 0.5;
        const sx = Math.cos(turn) * width;
        const sz = Math.sin(turn) * width;
        const lx = Math.cos(turn + Math.PI / 2) * lean;
        const lz = Math.sin(turn + Math.PI / 2) * lean;
        for (let k = 0; k < steps; k++) {
            const t0 = k / steps;
            const t1 = (k + 1) / steps;
            const bend0 = t0 * t0 * height;
            const bend1 = t1 * t1 * height;
            const w0 = 1 - 0.3 * t0;
            const w1 = k === steps - 1 ? 0.35 : 1 - 0.3 * t1;
            const a = [x + lx * bend0, t0 * height, z + lz * bend0];
            const c = [x + lx * bend1, t1 * height, z + lz * bend1];
            points.push(a[0] - sx * w0, a[1], a[2] - sz * w0, c[0] - sx * w1, c[1], c[2] - sz * w1, c[0] + sx * w1, c[1], c[2] + sz * w1);
            points.push(a[0] - sx * w0, a[1], a[2] - sz * w0, c[0] + sx * w1, c[1], c[2] + sz * w1, a[0] + sx * w0, a[1], a[2] + sz * w0);
        }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    g.computeVertexNormals();
    // Lit as if facing up a little (thin blades read dark edge-on otherwise); the tips a little sun-bleached.
    const normal = g.getAttribute("normal");
    for (let i = 0; i < normal.count; i++) {
        const n = new Vector3(normal.getX(i), normal.getY(i), normal.getZ(i));
        n.y = Math.abs(n.y) + 0.8;
        n.normalize();
        normal.setXYZ(i, n.x, n.y, n.z);
    }
    const tipColour = rgb("#9a9a5a");
    return merge([part(g, {shade: (p) => 0.55 + 0.75 * Math.min(p.y / 0.4, 1), own: (p) => (p.y > 0.3 ? [...tipColour, Math.min((p.y - 0.3) * 4, 0.5)] : null), sway: (p) => 0.09 * Math.min(p.y / 0.4, 1) ** 1.6, pattern: 0})]);
}

const BUILDERS: Record<ReefKind, (variant: number, near: boolean) => BufferGeometry> = {
    branching,
    table,
    brain,
    massive,
    fan,
    anemone,
    barrel_sponge: barrelSponge,
    tube_sponge: tubeSponge,
    ball_sponge: ballSponge,
    kelp,
    seagrass
};

// MARK: - Material

const W = (Math.PI * 2) / SEA_CLOCK_PERIOD;

/** The reef's material: one program for every shape (front-sided or double-sided). */
function reefMaterial(doubleSided: boolean): MeshStandardMaterial {
    const material = new MeshStandardMaterial({roughness: 0.82, metalness: 0, side: doubleSided ? DoubleSide : FrontSide});
    const uniforms = {seaTime: ARK_SEA_TIME, arkTime: ARK_TIME, arkCaustics: ARK_CAUSTICS, envSeaLevel: ARK_ENV.seaLevel, envWind: ARK_ENV.wind, envStorm: ARK_ENV.storm};
    material.customProgramCacheKey = () => `ark-reef-${doubleSided ? 2 : 1}`;
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
attribute vec3 arkColour;
attribute float arkOwn;
attribute float arkShade;
attribute float arkSway;
attribute float arkPattern;
uniform float seaTime;
uniform float envSeaLevel;
uniform float envWind;
uniform float envStorm;
varying vec3 vReefColour;
varying vec3 vReefLocal;
varying vec3 vReefWorld;
varying vec3 vReefNormal;
varying float vReefPattern;`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>
vReefLocal = position;
vReefPattern = arkPattern;
#ifdef USE_INSTANCING_COLOR
vec3 reefTint = instanceColor;
#else
vec3 reefTint = vec3(1.0);
#endif
vReefColour = mix(reefTint * arkShade, arkColour, arkOwn);
{
    // The surge: onshore and back (out from the island's middle), an 8 s swell with a second wave over it; it fades
    // with depth and grows with wind and storm. Kelp bends in a wave that runs up its stipes. Every frequency makes
    // whole cycles in the sea clock's ${SEA_CLOCK_PERIOD} s wrap.
    vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec2 out2 = normalize(root.xz + vec2(0.001));
    float depth = max(envSeaLevel - root.y, 0.3);
    float swell = (0.65 + 0.5 * envWind + 1.6 * envStorm) * mix(1.0, exp(-0.11 * depth), 0.7);
    float kelpLag = step(6.5, arkPattern);
    float phase = dot(root.xz, out2) * 0.33 + root.x * 0.05 + root.z * 0.04 - transformed.y * 0.32 * kelpLag;
    float surge = sin(seaTime * ${(W * 75).toFixed(8)} + phase) + 0.35 * sin(seaTime * ${(W * 113).toFixed(8)} + phase * 1.31 + 1.7);
    float across = 0.45 * sin(seaTime * ${(W * 52).toFixed(8)} + root.z * 0.41 + root.x * 0.23 - transformed.y * 0.2);
    // Tentacles and blades on their own phases too.
    float own = step(3.5, arkPattern) * step(arkPattern, 4.5) * sin(seaTime * ${(W * 160).toFixed(8)} + dot(position, vec3(41.0, 23.0, 37.0)))
        + step(6.5, arkPattern) * step(arkPattern, 7.5) * 0.5 * sin(seaTime * ${(W * 130).toFixed(8)} + dot(position, vec3(7.0, 3.0, 5.0)));
    vec3 world = vec3(out2.x, 0.0, out2.y) * surge + vec3(-out2.y, 0.0, out2.x) * across;
    world += vec3(0.0, 0.25, 0.0) * own + vec3(out2.y, 0.0, -out2.x) * own * 0.6;
    float size2 = dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz);
    // Into the shape's own frame (the instance turns and scales it), so the push lands where it is meant to in the world.
    vec3 local = (world * mat3(instanceMatrix)) / max(size2, 1e-4);
    transformed += local * arkSway * swell * sqrt(size2);
}`)
            .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
vReefWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
vReefNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
varying vec3 vReefColour;
varying vec3 vReefLocal;
varying vec3 vReefWorld;
varying vec3 vReefNormal;
varying float vReefPattern;
uniform float arkTime;
uniform float arkCaustics;
uniform float envSeaLevel;
${NOISE_GLSL}
float reefCaustic(vec2 p, float t) {
    float c = 0.0;
    vec2 q = p * 0.85;
    for (int i = 0; i < 3; i++) {
        q += vec2(sin(q.y * 1.7 + t * 0.55 + float(i)), cos(q.x * 1.3 - t * 0.47 - float(i))) * 0.42;
        c += abs(sin(q.x + q.y));
    }
    return pow(1.0 - c / 3.0, 5.0) * 6.0;
}`)
            .replace("#include <color_fragment>", `#include <color_fragment>
{
    vec3 c = vReefColour;
    vec3 p = vReefLocal;
    float near = 1.0 - smoothstep(6.0, 22.0, distance(cameraPosition, vReefWorld));
    int kind = int(vReefPattern + 0.5);
    if (kind == 1) {
        // Brain coral: meandering ridges (the contours of a noise field), dark valleys between.
        float v = arkFbm(p.xz * 3.2 + vec2(p.y * 2.1, -p.y * 1.7)) * 7.0;
        float ridge = abs(fract(v) - 0.5) * 2.0;
        c *= mix(1.0, mix(0.5, 1.12, smoothstep(0.15, 0.55, ridge)), 0.35 + 0.65 * near);
    } else if (kind == 2) {
        // Polyps: fine pits, and broad patches of a second tone.
        float pits = smoothstep(0.55, 0.8, arkNoise(p.xz * 46.0 + p.y * 31.0));
        c *= (1.0 - 0.28 * pits * near) * (0.88 + 0.24 * arkNoise(p.xz * 4.0 + p.y * 3.0));
    } else if (kind == 3) {
        // Sea fan: an open lattice of branching veins.
        vec2 q = p.xy * 34.0 + vec2(arkNoise(p.xy * 9.0), arkNoise(p.xy * 9.0 + 5.0)) * 3.0;
        float veins = max(1.0 - abs(sin(q.x)) , 1.0 - abs(sin(q.y * 0.8 + q.x * 0.35)));
        if (veins < 0.62 * near) discard;
        c *= 0.82 + 0.25 * veins;
    } else if (kind == 5) {
        // Sponges: dark pores.
        float pore = smoothstep(0.78, 0.9, arkNoise(p.xz * 24.0 + p.y * 19.0));
        c *= (1.0 - 0.45 * pore * near) * (0.9 + 0.2 * arkNoise(p.xz * 6.0 + p.y * 5.0));
    } else if (kind == 6) {
        // Table plate: fine radial branchlets on top.
        float a = atan(p.z, p.x);
        float r = length(p.xz);
        c *= 0.86 + 0.22 * smoothstep(0.3, 0.8, arkNoise(vec2(a * 30.0, r * 26.0))) * near;
    } else if (kind == 7) {
        // Kelp blades: a darker midrib and a lighter margin.
        c *= 0.9 + 0.2 * arkNoise(p.xz * 30.0 + p.y * 8.0);
    }
    // Under water the light that reaches it is absorbed with depth, red first (as on the sea floor).
    float depthBelow = envSeaLevel - vReefWorld.y;
    if (depthBelow > 0.0) {
        c *= exp(-depthBelow * vec3(0.36, 0.1, 0.075)) * mix(1.0, 0.86, smoothstep(0.0, 2.0, depthBelow));
        // The sun's caustics on what faces up.
        float up = smoothstep(0.1, 0.8, normalize(vReefNormal).y);
        float under = smoothstep(0.05, 0.6, depthBelow) * (1.0 - smoothstep(4.0, 11.0, depthBelow));
        c += vec3(0.6, 0.9, 0.85) * min(reefCaustic(vReefWorld.xz, arkTime), 1.5) * under * up * arkCaustics * 0.1 * exp(-depthBelow * 0.15);
    }
    diffuseColor.rgb = c;
}`);
        // Thin blades and fans: lit from the side the light comes from.
        if (doubleSided) {
            shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
#ifdef DOUBLE_SIDED
normal *= faceDirection;
nonPerturbedNormal *= faceDirection;
#endif`);
        }
    };
    return material;
}

// MARK: - The meshes, near and far

/** How far each kind's near and far versions reach (m, on the high tier). */
const REACH: Record<ReefKind, [number, number]> = {
    branching: [15, 70],
    table: [15, 75],
    brain: [13, 75],
    massive: [13, 80],
    fan: [16, 70],
    anemone: [10, 45],
    barrel_sponge: [13, 70],
    tube_sponge: [12, 60],
    ball_sponge: [10, 50],
    kelp: [24, 75],
    seagrass: [14, 42]
};

const DOUBLE = new Set<ReefKind>(["fan", "kelp", "seagrass"]);
const CELL = 8;

type Group = {
    kind: ReefKind;
    near: InstancedMesh;
    far: InstancedMesh;
    nearTriangles: number;
    farTriangles: number;
    matrices: Float32Array;
    colours: Float32Array;
    positions: Float32Array;
    cells: Array<{x: number; y: number; z: number; items: number[]}>;
};

export type ReefView = {
    meshes: InstancedMesh[];
    /** Re-sort near and far round the camera (when it has moved, or every half second) and run the sea's clock. */
    update: (camera: Vector3) => void;
    /** The tier's share of the reaches (1 high, about 0.6 medium, about 0.4 low). */
    setReach: (reach: number) => void;
    readonly triangles: number;
    dispose: () => void;
};

export function buildReef(): ReefView {
    const items = reefGrowth();
    const materials = {front: reefMaterial(false), double: reefMaterial(true)};
    const groups: Group[] = [];
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const tilt = new Quaternion();
    const scale = new Vector3();
    const at = new Vector3();
    const up = new Vector3(0, 1, 0);
    const xAxis = new Vector3(1, 0, 0);
    const colour = new Color();
    for (const kind of REEF_KINDS) {
        for (let variant = 0; variant < REEF_VARIANTS[kind]; variant++) {
            const mine = items.filter((item) => item.kind === kind && item.variant === variant);
            if (!mine.length) continue;
            const material = DOUBLE.has(kind) ? materials.double : materials.front;
            const nearGeometry = BUILDERS[kind](variant, true);
            const farGeometry = BUILDERS[kind](variant, false);
            const make = (geometry: BufferGeometry, level: string) => {
                const mesh = new InstancedMesh(geometry, material, mine.length);
                mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(mine.length * 3), 3);
                mesh.count = 0;
                mesh.visible = false;
                mesh.receiveShadow = true;
                mesh.castShadow = false;
                mesh.userData.kind = `reef-${kind}-${level}`;
                // Not a pick target: decoration.
                mesh.raycast = () => {};
                return mesh;
            };
            const matrices = new Float32Array(mine.length * 16);
            const colours = new Float32Array(mine.length * 3);
            const positions = new Float32Array(mine.length * 3);
            const cellMap = new Map<string, {x: number; y: number; z: number; items: number[]}>();
            mine.forEach((item: ReefItem, i) => {
                rotation.setFromAxisAngle(up, item.rotation);
                tilt.setFromAxisAngle(xAxis, item.tilt);
                rotation.multiply(tilt);
                scale.setScalar(item.scale);
                // Sunk a little into the bed so nothing floats on a slope.
                at.set(item.x, item.y - 0.04 * item.scale, item.z);
                matrix.compose(at, rotation, scale);
                matrix.toArray(matrices, i * 16);
                colour.set(item.color);
                // A little variety per instance (from where it grows, so the same for everyone).
                const frac = (v: number) => v - Math.floor(v);
                const k = 0.9 + 0.2 * frac(item.x * 3.17 + item.z * 7.31);
                colours[i * 3] = colour.r * k;
                colours[i * 3 + 1] = colour.g * k;
                colours[i * 3 + 2] = colour.b * (0.95 + 0.1 * frac(item.z * 5.3));
                positions[i * 3] = item.x;
                positions[i * 3 + 1] = item.y;
                positions[i * 3 + 2] = item.z;
                const key = `${Math.floor(item.x / CELL)},${Math.floor(item.z / CELL)}`;
                let cell = cellMap.get(key);
                if (!cell) {
                    cell = {x: (Math.floor(item.x / CELL) + 0.5) * CELL, y: item.y, z: (Math.floor(item.z / CELL) + 0.5) * CELL, items: []};
                    cellMap.set(key, cell);
                }
                cell.items.push(i);
            });
            groups.push({
                kind,
                near: make(nearGeometry, "near"),
                far: make(farGeometry, "far"),
                nearTriangles: nearGeometry.getAttribute("position").count / 3,
                farTriangles: farGeometry.getAttribute("position").count / 3,
                matrices,
                colours,
                positions,
                cells: Array.from(cellMap.values())
            });
        }
    }

    let reach = 1;
    const last = new Vector3(Infinity, 0, 0);
    let framesSince = 0;
    let triangles = 0;
    const resort = (camera: Vector3) => {
        triangles = 0;
        for (const group of groups) {
            const [nearReach, farReach] = REACH[group.kind].map((d) => d * (group.kind === "seagrass" || group.kind === "anemone" ? reach : Math.max(reach, 0.55)));
            const nearArray = group.near.instanceMatrix.array as Float32Array;
            const farArray = group.far.instanceMatrix.array as Float32Array;
            const nearColour = group.near.instanceColor!.array as Float32Array;
            const farColour = group.far.instanceColor!.array as Float32Array;
            let nearCount = 0;
            let farCount = 0;
            const cellReach = farReach + CELL * 0.75;
            for (const cell of group.cells) {
                if (Math.hypot(cell.x - camera.x, cell.y - camera.y, cell.z - camera.z) > cellReach) continue;
                for (const i of cell.items) {
                    const d = Math.hypot(group.positions[i * 3] - camera.x, group.positions[i * 3 + 1] - camera.y, group.positions[i * 3 + 2] - camera.z);
                    if (d >= farReach) continue;
                    const isNear = d < nearReach;
                    const target = isNear ? nearArray : farArray;
                    const tint = isNear ? nearColour : farColour;
                    const slot = isNear ? nearCount++ : farCount++;
                    for (let k = 0; k < 16; k++) target[slot * 16 + k] = group.matrices[i * 16 + k];
                    tint[slot * 3] = group.colours[i * 3];
                    tint[slot * 3 + 1] = group.colours[i * 3 + 1];
                    tint[slot * 3 + 2] = group.colours[i * 3 + 2];
                }
            }
            for (const [mesh, count] of [[group.near, nearCount], [group.far, farCount]] as const) {
                mesh.count = count;
                mesh.visible = count > 0;
                mesh.instanceMatrix.needsUpdate = true;
                mesh.instanceColor!.needsUpdate = true;
                if (count > 0) mesh.computeBoundingSphere();
            }
            triangles += nearCount * group.nearTriangles + farCount * group.farTriangles;
        }
    };

    return {
        meshes: groups.flatMap((group) => [group.near, group.far]),
        update: (camera) => {
            ARK_SEA_TIME.value = seaClockSeconds(seaEpochSeconds());
            framesSince++;
            if (camera.distanceToSquared(last) < 1 && framesSince < 30) return;
            framesSince = 0;
            last.copy(camera);
            resort(camera);
        },
        setReach: (value) => {
            reach = Math.min(Math.max(value, 0.3), 1);
            last.set(Infinity, 0, 0);
        },
        get triangles() {
            return triangles;
        },
        dispose: () => {
            for (const group of groups) {
                for (const mesh of [group.near, group.far]) {
                    mesh.geometry.dispose();
                    mesh.dispose();
                }
            }
            (Object.values(materials) as Material[]).forEach((material) => material.dispose());
        }
    };
}
