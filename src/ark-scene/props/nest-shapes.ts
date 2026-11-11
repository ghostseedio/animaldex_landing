/**
 * Birds' nests built strand by strand (docs/ark/props.md): every twig, grass
 * blade, mud pellet, pebble and down tuft is its own small piece, laid in the
 * order the bird lays it. Each vertex carries `aBuild` (0…1, its build
 * order), so a nest drawn at a stage below 1 shows only what is built so far
 * (`kit.ts` propMaterial `growth`): the base first, then the walls, then the
 * lining (`nest-growth.ts`).
 *
 * Every shape is built at radius 1 (instances scale it to the species'
 * nest), stands on y = 0 (a pendant hangs from y = 0; a floating nest has
 * the water at y = 0) and faces +z (a wall nest has its back to the wall at
 * z = 0). Vertex coloured, non-indexed, pure and seeded.
 */

import {BufferAttribute, BufferGeometry, Color, IcosahedronGeometry, SphereGeometry, Vector3} from "three";
import {seeded} from "@/ark-scene/world";
import type {NestForm, NestProfile} from "@/ark-scene/props/nest-kinds";

type Palette = Color[];
const hex = (...list: string[]): Palette => list.map((value) => new Color(value));

const TWIGS = hex("#6e5640", "#5a4634", "#7b6550", "#4d3c2d", "#857463");
const WEATHERED = hex("#6b5a48", "#7d6a55", "#5b4a3a", "#8a8378", "#6f6458", "#9a9183");
const DRY_GRASS = hex("#a58f63", "#8c7a55", "#b49f71", "#9b8a62", "#7f7150");
const FRESH_GRASS = hex("#8ea158", "#9fae66", "#b8a46a", "#7f9450", "#a9a066");
const MOSS = hex("#6d7a3c", "#5e6b33", "#7b8546", "#86804e");
const DOWN = hex("#8a7f70", "#9d9182", "#7a6f62", "#a99f90", "#6f6558");
const FEATHERS = hex("#ece7dd", "#d9d2c4", "#f4f0e8");
const LEAVES = hex("#5b6b2e", "#6b7a34", "#7c6a3a", "#4d5a28");
const MUD = hex("#7a644a", "#6a5640", "#857057", "#5e4c38", "#8f7a5f");
const WEED = hex("#5d5a33", "#6f6b3d", "#4b5230", "#585e36", "#3f4529");
const REEDS = hex("#b9a77a", "#9c8b62", "#c7b88d", "#7d8a4f", "#a69565");
const PEBBLES = hex("#8f8a82", "#a19c94", "#6f6b66", "#b3aea4", "#7d7770");
const LITTER = hex("#5a4330", "#6e5236", "#4a3626", "#7c6040", "#3f2f22");
const DARK = new Color("#1d150e");

/** A builder of non-indexed, vertex-coloured triangles with a build order on each. */
class Weave {
    private readonly positions: number[] = [];
    private readonly colours: number[] = [];
    private readonly builds: number[] = [];
    private readonly normals: number[] = [];
    constructor(readonly random: () => number) {}

    pick(palette: Palette, shade = 1): Color {
        const a = palette[Math.floor(this.random() * palette.length) % palette.length];
        const b = palette[Math.floor(this.random() * palette.length) % palette.length];
        return a.clone().lerp(b, this.random()).multiplyScalar(shade * (0.84 + this.random() * 0.3));
    }

    private vertex(v: Vector3, n: Vector3, colour: Color, build: number) {
        this.positions.push(v.x, v.y, v.z);
        this.normals.push(n.x, n.y, n.z);
        this.colours.push(colour.r, colour.g, colour.b);
        this.builds.push(build);
    }

    /** A triangle; its normals are the face's unless given (a soft lump's are its own, out from its middle). */
    tri(a: Vector3, b: Vector3, c: Vector3, colour: Color, build: number, shade: [number, number, number] = [1, 1, 1], normals?: [Vector3, Vector3, Vector3]) {
        const face = normals ? null : new Vector3().subVectors(c, b).cross(new Vector3().subVectors(a, b)).normalize();
        this.vertex(a, normals?.[0] ?? face!, colour.clone().multiplyScalar(shade[0]), build);
        this.vertex(b, normals?.[1] ?? face!, colour.clone().multiplyScalar(shade[1]), build);
        this.vertex(c, normals?.[2] ?? face!, colour.clone().multiplyScalar(shade[2]), build);
    }

    /** A strand (twig, blade, reed): a three-sided tube along `points`, `width` thick, tapering a little at its ends. */
    strand(points: Vector3[], width: number, colour: Color, build: number) {
        if (points.length < 2) return;
        const rings: Vector3[][] = [];
        const up = new Vector3(0, 1, 0);
        const side = new Vector3();
        const other = new Vector3();
        const tangent = new Vector3();
        for (let i = 0; i < points.length; i++) {
            const a = points[Math.max(i - 1, 0)];
            const b = points[Math.min(i + 1, points.length - 1)];
            tangent.copy(b).sub(a).normalize();
            side.crossVectors(tangent, Math.abs(tangent.y) > 0.9 ? new Vector3(1, 0, 0) : up).normalize();
            other.crossVectors(tangent, side).normalize();
            const end = i === 0 || i === points.length - 1 ? 0.7 : 1;
            const w = width * end;
            rings.push([0, 1, 2].map((k) => {
                const angle = (k / 3) * Math.PI * 2;
                return points[i].clone().addScaledVector(side, Math.cos(angle) * w).addScaledVector(other, Math.sin(angle) * w);
            }));
        }
        for (let i = 0; i < rings.length - 1; i++) {
            // Darker underneath, lighter along its top: reads as round.
            for (let k = 0; k < 3; k++) {
                const k1 = (k + 1) % 3;
                const shade = 0.78 + 0.14 * k;
                this.tri(rings[i][k], rings[i + 1][k], rings[i + 1][k1], colour, build, [shade, shade, shade]);
                this.tri(rings[i][k], rings[i + 1][k1], rings[i][k1], colour, build, [shade, shade, shade]);
            }
        }
    }

    /** A lump (pellet, pebble, down tuft, leaf): a low-poly ball, squashed, its vertices pushed about. */
    blob(at: Vector3, radius: number, squash: [number, number, number], colour: Color, build: number, lump = 0.22, detail = 0) {
        const geometry = new IcosahedronGeometry(radius, detail);
        const position = geometry.getAttribute("position");
        const v = new Vector3();
        const corners: Vector3[] = [];
        const pushes = new Map<string, number>();
        for (let i = 0; i < position.count; i++) {
            v.set(position.getX(i), position.getY(i), position.getZ(i));
            const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
            if (!pushes.has(key)) pushes.set(key, 1 + (this.random() - 0.5) * 2 * lump);
            v.multiplyScalar(pushes.get(key)!);
            v.set(v.x * squash[0], v.y * squash[1], v.z * squash[2]).add(at);
            corners.push(v.clone());
        }
        for (let i = 0; i < corners.length; i += 3) {
            const shade = 0.82 + 0.3 * ((corners[i].y + corners[i + 1].y + corners[i + 2].y) / 3 - at.y + radius) / (2 * radius * squash[1] || 1);
            // Soft: each corner's normal points out from the lump's middle (squashed the same way), so a down tuft or a mud pellet reads round.
            const soft = [0, 1, 2].map((k) => new Vector3().subVectors(corners[i + k], at).divide(new Vector3(squash[0] * squash[0], squash[1] * squash[1], squash[2] * squash[2])).normalize()) as [Vector3, Vector3, Vector3];
            this.tri(corners[i], corners[i + 1], corners[i + 2], colour, build, [shade, shade, shade], soft);
        }
        geometry.dispose();
    }

    /** A surface of revolution through (radius, y) points: the nest's body under its strands. */
    lathe(profile: Array<[number, number]>, segments: number, colour: (index: number) => Color, build: number, wobble = 0.05) {
        const ring = (index: number, step: number) => {
            const [r, y] = profile[index];
            const a = (step / segments) * Math.PI * 2;
            const n = 1 + wobble * Math.sin(a * 3 + index * 1.7) * Math.cos(a * 5 + index);
            return new Vector3(Math.sin(a) * r * n, y, Math.cos(a) * r * n);
        };
        for (let i = 0; i < profile.length - 1; i++) {
            const c = colour(i);
            for (let s = 0; s < segments; s++) {
                const a0 = ring(i, s);
                const a1 = ring(i, s + 1);
                const b0 = ring(i + 1, s);
                const b1 = ring(i + 1, s + 1);
                this.tri(a0, b0, b1, c, build);
                this.tri(a0, b1, a1, c, build);
            }
        }
    }

    geometry(): BufferGeometry {
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(new Float32Array(this.positions), 3));
        geometry.setAttribute("color", new BufferAttribute(new Float32Array(this.colours), 3));
        geometry.setAttribute("aBuild", new BufferAttribute(new Float32Array(this.builds), 1));
        geometry.setAttribute("normal", new BufferAttribute(new Float32Array(this.normals), 3));
        return geometry;
    }
}

/** The profile's radius at height y (linear between points), for strands laid on a body. */
function radiusAt(profile: Array<[number, number]>, y: number): number {
    for (let i = 0; i < profile.length - 1; i++) {
        const [r0, y0] = profile[i];
        const [r1, y1] = profile[i + 1];
        if ((y >= y0 && y <= y1) || (y <= y0 && y >= y1)) {
            const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
            return r0 + (r1 - r0) * t;
        }
    }
    return profile[profile.length - 1][0];
}

/** An arc of a strand round the y axis at height y, radius r, from angle a over `span`, wandering a little. */
function arc(w: Weave, r: number, y: number, a: number, span: number, wander: number, steps = 5): Vector3[] {
    const points: Vector3[] = [];
    const tilt = (w.random() - 0.5) * wander * 2;
    for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const angle = a + span * t;
        const rr = r * (1 + (w.random() - 0.5) * wander);
        points.push(new Vector3(Math.sin(angle) * rr, y + tilt * (t - 0.5) + (w.random() - 0.5) * wander * 0.5, Math.cos(angle) * rr));
    }
    return points;
}

function liningPalette(lining: NestProfile["lining"]): Palette {
    switch (lining) {
        case "down":
            return DOWN;
        case "moss":
            return MOSS;
        case "mud":
            return MUD;
        case "leaves":
            return LEAVES;
        case "feathers":
            return FEATHERS;
        case "grass":
            return DRY_GRASS;
        default:
            return TWIGS;
    }
}

/** A woven cup: a songbird's in a fork, a kittiwake's on a ledge. */
function cup(w: Weave, lining: NestProfile["lining"]) {
    const outer: Array<[number, number]> = [[0, 0.02], [0.45, 0.03], [0.78, 0.18], [0.93, 0.42], [0.95, 0.62], [0.88, 0.7]];
    const inner: Array<[number, number]> = [[0.88, 0.7], [0.72, 0.62], [0.6, 0.44], [0.36, 0.31], [0, 0.28]];
    const soft = liningPalette(lining);
    w.lathe(outer, 14, () => w.pick(TWIGS, 0.62), 0.3);
    w.lathe(inner, 14, () => w.pick(soft, 0.85), 0.86);
    const materials = [TWIGS, DRY_GRASS, DRY_GRASS, MOSS];
    for (let k = 0; k < 100; k++) {
        const h = w.random() ** 0.85;
        const y = 0.04 + h * 0.62;
        w.strand(arc(w, radiusAt(outer, y) + 0.035, y, w.random() * Math.PI * 2, 0.7 + w.random() * 1.2, 0.07), 0.026 + w.random() * 0.02, w.pick(materials[k % 4]), 0.04 + 0.78 * h);
    }
    for (let k = 0; k < 26; k++) {
        const y = 0.64 + w.random() * 0.08;
        w.strand(arc(w, 0.84 + w.random() * 0.12, y, w.random() * Math.PI * 2, 0.6 + w.random(), 0.06), 0.03, w.pick(k % 3 ? DRY_GRASS : TWIGS), 0.78 + 0.08 * w.random());
    }
    // Loose twigs poking out.
    for (let k = 0; k < 14; k++) {
        const a = w.random() * Math.PI * 2;
        const y = 0.12 + w.random() * 0.5;
        const r = radiusAt(outer, y);
        const turn = (w.random() - 0.5) * 1.2;
        w.strand([new Vector3(Math.sin(a) * r * 0.85, y, Math.cos(a) * r * 0.85), new Vector3(Math.sin(a + turn * 0.3) * r * 1.15, y + 0.04, Math.cos(a + turn * 0.3) * r * 1.15), new Vector3(Math.sin(a + turn) * r * 1.45, y + (w.random() - 0.4) * 0.25, Math.cos(a + turn) * r * 1.45)], 0.022, w.pick(TWIGS), 0.1 + 0.6 * w.random());
    }
    for (let k = 0; k < 12; k++) {
        const a = w.random() * Math.PI * 2;
        const d = 0.3 + w.random() * 0.35;
        w.blob(new Vector3(Math.sin(a) * d, 0.36 + d * 0.32, Math.cos(a) * d), 0.09, [1.3, 0.45, 1], w.pick(soft), 0.9 + 0.1 * w.random(), 0.3);
    }
}

/** A stack of sticks with a shallow cup on top: a heron's, a hawk's (`deep` for an eyrie built on year after year). */
function sticks(w: Weave, lining: NestProfile["lining"], deep: boolean) {
    const h = deep ? 0.75 : 0.42;
    const outer: Array<[number, number]> = deep
        ? [[0, 0], [0.5, 0], [0.76, 0.3], [0.8, 0.6], [0.7, 0.74]]
        : [[0, 0], [0.5, 0], [0.76, 0.18], [0.74, 0.36], [0.6, 0.41]];
    const cupPart: Array<[number, number]> = deep ? [[0.7, 0.74], [0.5, 0.69], [0.26, 0.65], [0, 0.64]] : [[0.6, 0.41], [0.46, 0.37], [0.22, 0.34], [0, 0.33]];
    w.lathe(outer, 12, () => w.pick(TWIGS, 0.55), 0.32, 0.08);
    w.lathe(cupPart, 12, () => w.pick(liningPalette(lining), 0.8), 0.88, 0.04);
    const count = deep ? 300 : 170;
    for (let k = 0; k < count; k++) {
        const f = k / count;
        const y = 0.02 + f * (h - 0.04) + (w.random() - 0.5) * 0.04;
        const spread = radiusAt(outer, y) * (0.25 + w.random() * 0.45);
        const c = w.random() * Math.PI * 2;
        const cx = Math.sin(c) * spread;
        const cz = Math.cos(c) * spread;
        const a = w.random() * Math.PI;
        const length = (deep ? 1.1 : 0.9) + w.random() * (deep ? 1.0 : 0.8);
        const dx = Math.cos(a) * length / 2;
        const dz = Math.sin(a) * length / 2;
        const kink = new Vector3((w.random() - 0.5) * 0.1, (w.random() - 0.3) * 0.06, (w.random() - 0.5) * 0.1);
        const thick = (deep ? 0.016 : 0.014) + w.random() * (deep ? 0.016 : 0.012);
        if (k % 5 < 3) {
            // Laid round the wall: a chord across the heap's side, its ends a little proud.
            const at = w.random() * Math.PI * 2;
            const span = 0.5 + w.random() * 0.6;
            const r = radiusAt(outer, y) * 1.06;
            const lift = (w.random() - 0.5) * 0.1;
            w.strand([
                new Vector3(Math.sin(at) * r * 1.04, y - lift, Math.cos(at) * r * 1.04),
                new Vector3(Math.sin(at + span / 2) * r * Math.cos(span / 2) * 1.02, y + kink.y, Math.cos(at + span / 2) * r * Math.cos(span / 2) * 1.02),
                new Vector3(Math.sin(at + span) * r * 1.06, y + lift, Math.cos(at + span) * r * 1.06)
            ], thick, w.pick(WEATHERED), 0.02 + 0.84 * f);
            continue;
        }
        w.strand([new Vector3(cx - dx * 0.75, y - 0.02 + (w.random() - 0.5) * 0.04, cz - dz * 0.75), new Vector3(cx, y, cz).add(kink), new Vector3(cx + dx * 0.75, y + (w.random() - 0.5) * 0.08, cz + dz * 0.75)], thick, w.pick(WEATHERED), 0.02 + 0.84 * f);
    }
    // The lining: green sprigs (eagles bring them all season), soft grass, or nothing for a pigeon's flimsy platform.
    if (lining !== "none") {
        const soft = liningPalette(lining);
        for (let k = 0; k < (deep ? 18 : 12); k++) {
            const a = w.random() * Math.PI * 2;
            const d = w.random() * (deep ? 0.55 : 0.45);
            const y = (deep ? 0.66 : 0.35) + 0.02;
            if (lining === "leaves") w.blob(new Vector3(Math.sin(a) * d, y, Math.cos(a) * d), 0.08, [1.5, 0.35, 1], w.pick(soft), 0.9 + 0.1 * w.random(), 0.35);
            else w.strand(arc(w, d + 0.08, y, a, 0.8 + w.random(), 0.05, 4), 0.022, w.pick(soft), 0.9 + 0.1 * w.random());
        }
    }
}

/** A bowl of grass on the ground lined with down (ducks) or leaves (gamebirds). */
function downBowl(w: Weave, lining: NestProfile["lining"]) {
    const outer: Array<[number, number]> = [[0, 0], [0.6, 0], [0.95, 0.12], [0.92, 0.28], [0.75, 0.33]];
    const inner: Array<[number, number]> = [[0.75, 0.33], [0.6, 0.26], [0.3, 0.17], [0, 0.15]];
    w.lathe(outer, 14, () => w.pick(DRY_GRASS, 0.7), 0.3, 0.07);
    w.lathe(inner, 14, () => w.pick(DRY_GRASS, 0.6), 0.55, 0.05);
    for (let k = 0; k < 120; k++) {
        const h = w.random();
        const y = 0.03 + h * 0.27;
        w.strand(arc(w, radiusAt(outer, y) + 0.03, y, w.random() * Math.PI * 2, 0.8 + w.random() * 1.4, 0.08, 4), 0.014 + w.random() * 0.01, w.pick(k % 5 ? DRY_GRASS : FRESH_GRASS), 0.04 + 0.62 * h);
    }
    // Stems standing round it: the cover it is hidden in.
    for (let k = 0; k < 22; k++) {
        const a = w.random() * Math.PI * 2;
        const d = 0.9 + w.random() * 0.35;
        const tall = 0.35 + w.random() * 0.55;
        const lean = (w.random() - 0.5) * 0.4;
        const base = new Vector3(Math.sin(a) * d, 0, Math.cos(a) * d);
        w.strand([base, base.clone().add(new Vector3(Math.sin(a) * lean * 0.3, tall * 0.5, Math.cos(a) * lean * 0.3)), base.clone().add(new Vector3(Math.sin(a) * lean, tall, Math.cos(a) * lean))], 0.011, w.pick(k % 3 ? FRESH_GRASS : DRY_GRASS, 1.15), 0);
    }
    // The down (or leaves) the bird adds as it lays.
    const soft = liningPalette(lining);
    const tufts = lining === "down" ? 34 : 24;
    for (let k = 0; k < tufts; k++) {
        const a = w.random() * Math.PI * 2;
        const d = 0.2 + w.random() * 0.62;
        const y = 0.16 + d * 0.2 + w.random() * 0.03;
        // Down: soft grey-brown tufts heaped round the cup, a pale tip to each; leaves: flat and brown.
        if (lining === "down") w.blob(new Vector3(Math.sin(a) * d, y, Math.cos(a) * d), 0.075 + w.random() * 0.03, [1.25, 0.6, 1.1], w.pick(soft, 1.0 + 0.15 * w.random()), 0.72 + 0.28 * (k / tufts), 0.55, 1);
        else w.blob(new Vector3(Math.sin(a) * d, y, Math.cos(a) * d), 0.09, [1.5, 0.3, 1], w.pick(soft), 0.72 + 0.28 * (k / tufts), 0.3, 0);
    }
}

/** A hollow scraped in the ground or on a ledge: a rim of thrown soil, pebbles, a few bits of lining. */
function scrape(w: Weave, lining: NestProfile["lining"]) {
    w.lathe([[0, 0.012], [0.6, 0.018], [0.95, 0.05], [1.12, 0.012]], 16, () => w.pick(MUD, 0.75), 0.3, 0.12);
    for (let k = 0; k < 16; k++) {
        const a = w.random() * Math.PI * 2;
        const d = 0.55 + w.random() * 0.55;
        w.blob(new Vector3(Math.sin(a) * d, 0.035, Math.cos(a) * d), 0.04 + w.random() * 0.05, [1.2, 0.6, 1], w.pick(PEBBLES), 0.4 + 0.6 * (k / 16), 0.25);
    }
    if (lining === "none") return;
    const soft = liningPalette(lining);
    for (let k = 0; k < 10; k++) {
        const a = w.random() * Math.PI * 2;
        const d = 0.2 + w.random() * 0.6;
        w.strand(arc(w, d, 0.04, a, 0.6 + w.random() * 0.6, 0.06, 3), 0.018, w.pick(soft), 0.6 + 0.4 * w.random());
    }
}

/** A ring of stones heaped up: a penguin's. */
function pebbleRing(w: Weave) {
    w.lathe([[0, 0.01], [0.5, 0.02], [0.9, 0.06], [1.05, 0.0]], 14, () => w.pick(PEBBLES, 0.55), 0.2, 0.1);
    for (let k = 0; k < 60; k++) {
        const f = k / 60;
        const a = w.random() * Math.PI * 2;
        const d = 0.45 + w.random() * 0.55;
        const y = 0.04 + f * 0.12 * (1 - Math.abs(d - 0.75) * 1.5);
        w.blob(new Vector3(Math.sin(a) * d, Math.max(y, 0.03), Math.cos(a) * d), 0.07 + w.random() * 0.05, [1.15, 0.75, 1], w.pick(PEBBLES), 0.05 + 0.92 * f, 0.2);
    }
}

/** A half cup of mud pellets against a wall (−z), lined with feathers; `closed`: a martin's, shut to a hole at the top. */
function mudCup(w: Weave, closed: boolean) {
    // A quarter sphere against the wall, narrow at the bottom, widest at the top where it meets the eave
    // (a martin's is shut to the eave, a hole at its top front; a swallow's is open, feathers at its rim).
    const rows = closed ? 13 : 10;
    const top = closed ? 1.25 : 1.0;
    w.lathe([[0, 0.12], [0.45, 0.25], [0.7, 0.7], [0.75, top]], 10, () => DARK.clone(), 0.45, 0);
    for (let j = 0; j < rows; j++) {
        const t = j / (rows - 1);
        const y = 0.04 + t * (top - 0.08);
        const r = 0.2 + 0.72 * Math.sin(Math.min(t * 1.15, 1) * Math.PI / 2);
        const count = Math.max(3, Math.round(r * 14));
        for (let k = 0; k <= count; k++) {
            const a = -Math.PI / 2 + (k / count) * Math.PI + (w.random() - 0.5) * 0.1;
            // The entrance: a gap at the top front of a closed cup.
            if (closed && t > 0.72 && t < 0.97 && Math.abs(a) < 0.34) continue;
            w.blob(new Vector3(Math.sin(a) * r, y, Math.cos(a) * r * 0.95), 0.07, [1.15, 0.75, 1], w.pick(MUD), 0.04 + 0.86 * t, 0.25);
        }
    }
    if (!closed) {
        for (let k = 0; k < 8; k++) {
            const a = (w.random() - 0.5) * 2.2;
            w.blob(new Vector3(Math.sin(a) * 0.6, top - 0.02, Math.cos(a) * 0.55), 0.07, [1.4, 0.5, 0.8], w.pick(FEATHERS), 0.95, 0.4);
        }
    }
}

/** A ball of strands with a side entrance (+z): a sparrow's (grass), a wren's (moss), a magpie's (sticks). */
function ball(w: Weave, lining: NestProfile["lining"], centreZ: number, palette: Palette) {
    const centre = new Vector3(0, 0.95, centreZ);
    const entrance = new Vector3(0, 0.15, 1).normalize();
    // The dark inside, open at the entrance.
    const inside = new IcosahedronGeometry(0.8, 1);
    const position = inside.getAttribute("position");
    for (let i = 0; i < position.count; i += 3) {
        const corners = [0, 1, 2].map((k) => new Vector3(position.getX(i + k), position.getY(i + k), position.getZ(i + k)));
        const mid = corners[0].clone().add(corners[1]).add(corners[2]).normalize();
        if (mid.dot(entrance) > 0.8) continue;
        w.tri(corners[0].add(centre), corners[2].add(centre), corners[1].add(centre), w.pick(palette, 0.35), 0.4);
    }
    inside.dispose();
    for (let k = 0; k < 170; k++) {
        // A random great-circle arc on the ball, skipping the entrance.
        const axis = new Vector3(w.random() - 0.5, (w.random() - 0.5) * 0.6, w.random() - 0.5).normalize();
        const start = new Vector3(w.random() - 0.5, w.random() - 0.5, w.random() - 0.5).cross(axis).normalize();
        const span = 0.6 + w.random() * 0.9;
        const points: Vector3[] = [];
        let blocked = false;
        for (let s = 0; s <= 5; s++) {
            const p = start.clone().applyAxisAngle(axis, (s / 5) * span);
            if (p.dot(entrance) > 0.78) blocked = true;
            points.push(p.multiplyScalar(0.88 + (w.random() - 0.5) * 0.12));
        }
        if (blocked) continue;
        const height = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        w.strand(points.map((p) => p.add(centre)), 0.028 + w.random() * 0.015, w.pick(k % 6 ? palette : TWIGS), 0.04 + 0.86 * (height + 0.9) / 1.8);
    }
    // A lip of loose strands round the entrance, and the soft lining showing inside it.
    const soft = liningPalette(lining);
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const p = entrance.clone().multiplyScalar(0.92).add(new Vector3(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0)).add(centre);
        w.blob(p, 0.06, [1.2, 0.7, 1], w.pick(soft), 0.95, 0.35);
    }
}

/** A woven purse hung from a twig (y = 0), its entrance tube below: a weaver's, an oriole's. */
function pendant(w: Weave) {
    const body: Array<[number, number]> = [[0.08, 0.02], [0.45, -0.25], [0.8, -0.6], [0.88, -0.95], [0.72, -1.3], [0.35, -1.55], [0.05, -1.62]];
    w.lathe(body, 12, () => w.pick(FRESH_GRASS, 0.8), 0.35, 0.06);
    // Blades woven every way over the body, top first (the weaver's first ring is its perch).
    for (let k = 0; k < 170; k++) {
        const t = w.random();
        const y0 = -0.02 - t * 1.5;
        const a = w.random() * Math.PI * 2;
        const span = 0.5 + w.random() * 0.9;
        const drop = (w.random() - 0.5) * 0.7;
        const points: Vector3[] = [];
        for (let s2 = 0; s2 <= 5; s2++) {
            const u = s2 / 5;
            const y = Math.min(-0.02, y0 + drop * u);
            const r = radiusAt(body, y) + 0.025 + (w.random() - 0.5) * 0.03;
            points.push(new Vector3(Math.sin(a + span * u) * r, y, Math.cos(a + span * u) * r));
        }
        w.strand(points, 0.018 + w.random() * 0.01, w.pick(k % 4 ? FRESH_GRASS : DRY_GRASS), 0.12 + 0.6 * t);
    }
    // Long blades knotted round the twig above it.
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        w.strand([new Vector3(Math.sin(a) * 0.1, 0.18, Math.cos(a) * 0.1), new Vector3(Math.sin(a) * 0.12, 0.0, Math.cos(a) * 0.12), new Vector3(Math.sin(a) * 0.4, -0.3, Math.cos(a) * 0.4)], 0.026, w.pick(FRESH_GRASS), 0.02 + 0.08 * (k / 8));
    }
    // The entrance tube, hanging down at the front.
    for (let k = 0; k < 40; k++) {
        const t = w.random();
        const y = -1.25 - t * 0.75;
        const centre = new Vector3(0, y, 0.45 + t * 0.05);
        const a = w.random() * Math.PI * 2;
        const span = 1 + w.random() * 1.2;
        const points: Vector3[] = [];
        for (let s = 0; s <= 4; s++) {
            const angle = a + (s / 4) * span;
            points.push(new Vector3(centre.x + Math.sin(angle) * 0.28, y + (w.random() - 0.5) * 0.04, centre.z + Math.cos(angle) * 0.28));
        }
        w.strand(points, 0.022, w.pick(FRESH_GRASS), 0.78 + 0.22 * t);
    }
    w.lathe([[0.25, -2.0], [0.12, -2.01], [0, -2.0]], 8, () => DARK.clone(), 1.0, 0);
    // Loose ends trailing.
    for (let k = 0; k < 10; k++) {
        const a = w.random() * Math.PI * 2;
        const y = -0.4 - w.random() * 1.1;
        const r = radiusAt(body, y);
        w.strand([new Vector3(Math.sin(a) * r, y, Math.cos(a) * r), new Vector3(Math.sin(a) * (r + 0.15), y - 0.25, Math.cos(a) * (r + 0.15)), new Vector3(Math.sin(a) * (r + 0.2), y - 0.5, Math.cos(a) * (r + 0.2))], 0.016, w.pick(DRY_GRASS), 0.5 + 0.4 * w.random());
    }
}

/** A raft of wet weed at the water's edge (the water at y = 0): a grebe's, a coot's. */
function floating(w: Weave) {
    const body: Array<[number, number]> = [[0, -0.28], [0.8, -0.22], [1.0, -0.02], [0.9, 0.13], [0.6, 0.2]];
    w.lathe(body, 14, () => w.pick(WEED, 0.6), 0.25, 0.1);
    w.lathe([[0.6, 0.2], [0.35, 0.15], [0, 0.12]], 12, () => w.pick(WEED, 0.5), 0.6, 0.05);
    for (let k = 0; k < 110; k++) {
        const h = w.random();
        const y = -0.05 + h * 0.22;
        w.strand(arc(w, radiusAt(body, y) + 0.04, y, w.random() * Math.PI * 2, 0.8 + w.random() * 1.6, 0.12), 0.026 + w.random() * 0.016, w.pick(k % 5 ? WEED : FRESH_GRASS), 0.04 + 0.86 * h);
    }
}

/** A heap of reeds with a down-lined cup (swans, cranes) or a mud cone with a dip on top (flamingos, albatrosses, gannets). */
function mound(w: Weave, lining: NestProfile["lining"]) {
    if (lining === "mud") {
        const cone: Array<[number, number]> = [[0, 0], [1.0, 0], [0.75, 0.35], [0.45, 0.62], [0.36, 0.66]];
        w.lathe(cone, 16, (i) => w.pick(MUD, 0.7 + i * 0.05), 0.5, 0.05);
        w.lathe([[0.36, 0.66], [0.2, 0.6], [0, 0.58]], 12, () => w.pick(MUD, 0.55), 0.95, 0.03);
        for (let k = 0; k < 70; k++) {
            const f = k / 70;
            const y = f * 0.64;
            const a = w.random() * Math.PI * 2;
            const r = radiusAt(cone, y);
            w.blob(new Vector3(Math.sin(a) * r, y, Math.cos(a) * r), 0.1, [1.3, 0.6, 1.1], w.pick(MUD), 0.02 + 0.9 * f, 0.25);
        }
        return;
    }
    const heap: Array<[number, number]> = [[0, 0], [1.0, 0], [0.95, 0.2], [0.75, 0.45], [0.5, 0.52]];
    w.lathe(heap, 16, () => w.pick(REEDS, 0.6), 0.35, 0.08);
    w.lathe([[0.5, 0.52], [0.32, 0.46], [0, 0.43]], 12, () => w.pick(liningPalette(lining), 0.7), 0.85, 0.04);
    for (let k = 0; k < 140; k++) {
        const h = w.random();
        const y = 0.02 + h * 0.48;
        w.strand(arc(w, radiusAt(heap, y) + 0.04, y, w.random() * Math.PI * 2, 0.5 + w.random() * 0.9, 0.08, 4), 0.026 + w.random() * 0.016, w.pick(REEDS), 0.02 + 0.82 * h);
    }
    const soft = liningPalette(lining);
    for (let k = 0; k < 16; k++) {
        const a = w.random() * Math.PI * 2;
        const d = 0.2 + w.random() * 0.3;
        w.blob(new Vector3(Math.sin(a) * d, 0.47 + d * 0.1, Math.cos(a) * d), 0.08, [1.2, 0.7, 1.1], w.pick(soft), 0.85 + 0.15 * w.random(), 0.4, 1);
    }
}

/** A heap of leaf litter metres across, scratched together and turned for its warmth (megapodes). */
function litterMound(w: Weave) {
    const heap: Array<[number, number]> = [[0, 0], [1.0, 0], [0.86, 0.22], [0.55, 0.4], [0, 0.46]];
    w.lathe(heap, 18, () => w.pick(LITTER, 0.8), 0.25, 0.1);
    for (let k = 0; k < 160; k++) {
        const f = k / 160;
        const y = f * 0.44;
        const a = w.random() * Math.PI * 2;
        const r = radiusAt(heap, y) * (0.9 + w.random() * 0.15);
        w.blob(new Vector3(Math.sin(a) * r, y + 0.01, Math.cos(a) * r), 0.05 + w.random() * 0.04, [1.6, 0.25, 1.1], w.pick(k % 4 ? LITTER : LEAVES), 0.02 + 0.95 * f, 0.3);
    }
    for (let k = 0; k < 30; k++) {
        const a = w.random() * Math.PI * 2;
        const r = 0.3 + w.random() * 0.7;
        const y = radiusAt(heap, 0) * 0 + (1 - r) * 0.42;
        w.strand([new Vector3(Math.sin(a) * r, y, Math.cos(a) * r), new Vector3(Math.sin(a + 0.25) * (r + 0.2), y - 0.04, Math.cos(a + 0.25) * (r + 0.2))], 0.015, w.pick(TWIGS), 0.3 + 0.6 * w.random());
    }
}

/** The forms built here (the hole, the burrow and the barn are `shapes.ts`'s, without stages). */
export const STRAND_FORMS: NestForm[] = ["cup", "platform", "eyrie", "scrape", "down_bowl", "mud_cup", "ball", "dome", "pendant", "floating", "mound", "pebbles", "megapode"];

/** A nest's geometry at radius 1, by form, lining and seed (with `aBuild` on every vertex). */
export function nestGeometry(form: NestForm, lining: NestProfile["lining"], options: {closed?: boolean; seed?: number} = {}): BufferGeometry {
    const w = new Weave(seeded(9100 + (options.seed ?? 0) * 31 + STRAND_FORMS.indexOf(form) * 7));
    switch (form) {
        case "cup":
            cup(w, lining);
            break;
        case "platform":
            sticks(w, lining, false);
            break;
        case "eyrie":
            sticks(w, lining, true);
            break;
        case "scrape":
            scrape(w, lining);
            break;
        case "down_bowl":
            downBowl(w, lining);
            break;
        case "mud_cup":
            mudCup(w, Boolean(options.closed));
            break;
        case "ball":
            ball(w, lining, 0.45, DRY_GRASS);
            break;
        case "dome":
            ball(w, lining, 0, lining === "mud" ? WEATHERED : lining === "moss" ? MOSS : DRY_GRASS);
            break;
        case "pendant":
            pendant(w);
            break;
        case "floating":
            floating(w);
            break;
        case "mound":
            mound(w, lining);
            break;
        case "pebbles":
            pebbleRing(w);
            break;
        case "megapode":
            litterMound(w);
            break;
        default:
            break;
    }
    return w.geometry();
}

/** The far look of a big nest (an eyrie, a mound): its body only, a few dozen triangles. */
export function nestFarGeometry(form: NestForm): BufferGeometry | null {
    if (form !== "eyrie" && form !== "megapode" && form !== "mound" && form !== "platform") return null;
    const w = new Weave(seeded(9900));
    const h = form === "eyrie" ? 0.75 : form === "platform" ? 0.42 : 0.5;
    w.lathe([[0, 0], [0.7, 0], [0.95, h * 0.5], [0.7, h], [0, h * 0.9]], 8, () => w.pick(form === "megapode" ? LITTER : form === "mound" ? REEDS : WEATHERED, 0.6), 0.3, 0.1);
    return w.geometry();
}

/**
 * An egg `size` long, smooth-shaded (a faceted egg reads as a pebble), standing on y = 0, a little pointed at its
 * top; its colour is the instance's tint over a faint mottle.
 */
export function eggGeometry(size: number): BufferGeometry {
    const geometry = new SphereGeometry(size / 2, 14, 10);
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
        const y = position.getY(i) / (size / 2);
        // Narrower toward the top: an egg, not a ball.
        const narrow = 0.78 * (1 - 0.12 * Math.max(y, 0));
        position.setXYZ(i, position.getX(i) * narrow, position.getY(i) + size / 2, position.getZ(i) * narrow);
    }
    geometry.computeVertexNormals();
    const flat = geometry.toNonIndexed();
    geometry.dispose();
    flat.deleteAttribute("uv");
    const count = flat.getAttribute("position").count;
    const colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const mottle = 0.9 + 0.1 * Math.sin(i * 12.9898) * Math.sin(i * 4.1414);
        colours[i * 3] = mottle;
        colours[i * 3 + 1] = mottle;
        colours[i * 3 + 2] = mottle;
    }
    flat.setAttribute("color", new BufferAttribute(colours, 3));
    return flat;
}
