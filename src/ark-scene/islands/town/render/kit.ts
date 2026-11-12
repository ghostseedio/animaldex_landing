/**
 * A geometry accumulator for the town's low-poly meshes: flat-shaded triangles with vertex colours (and one optional
 * float per vertex, e.g. a window's household for the lit-window schedule), written straight into arrays, so a
 * chunk's hundreds of buildings become one BufferGeometry without making and merging hundreds of small ones.
 */

import {BufferAttribute, BufferGeometry, Color} from "three";

export type V3 = [number, number, number];

/** A local frame on the ground: origin (x, y, z), turned `rot` about y. Local +z is the frame's front. */
export type Frame = {x: number; y: number; z: number; rot: number};

export function at(frame: Frame, lx: number, ly: number, lz: number): V3 {
    const c = Math.cos(frame.rot);
    const s = Math.sin(frame.rot);
    return [frame.x + lx * c - lz * s, frame.y + ly, frame.z + lx * s + lz * c];
}

const scratch = new Color();

export function tone(hex: string | Color, factor = 1): [number, number, number] {
    const c = typeof hex === "string" ? scratch.set(hex) : scratch.copy(hex);
    return [c.r * factor, c.g * factor, c.b * factor];
}

/**
 * A building surface's kind (lane GB), carried in the vertex colour itself so it costs no attribute: the colour is
 * rounded to 8 bits a channel and the kind (1-15) put in red's spare bits, with markers in green and blue
 * (`buildings.ts` SURFACE, decoded by its building shader). 0: a plain colour, untouched.
 */
export function encodeColourTag(colour: [number, number, number], tag: number): [number, number, number] {
    if (!tag) return colour;
    const q = (v: number) => Math.min(Math.max(Math.round(v * 255), 0), 254);
    return [(q(colour[0]) + (tag + 0.5) / 16) / 255, (q(colour[1]) + 0.5) / 255, (q(colour[2]) + 0.25) / 255];
}

export class Geo {
    readonly pos: number[] = [];
    readonly nor: number[] = [];
    readonly col: number[] = [];
    readonly extra: number[] = [];
    /** The value written to `extra` for the next triangles. */
    tag = 0;
    /** A building surface's kind for the next triangles, in their colour (`encodeColourTag`; 0: none). */
    surface = 0;

    get triangles(): number {
        return this.pos.length / 9;
    }

    tri(a: V3, b: V3, c: V3, colour: [number, number, number]) {
        const ux = b[0] - a[0];
        const uy = b[1] - a[1];
        const uz = b[2] - a[2];
        const vx = c[0] - a[0];
        const vy = c[1] - a[1];
        const vz = c[2] - a[2];
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        const length = Math.hypot(nx, ny, nz) || 1;
        nx /= length;
        ny /= length;
        nz /= length;
        const col = this.surface ? encodeColourTag(colour, this.surface) : colour;
        for (const p of [a, b, c]) {
            this.pos.push(p[0], p[1], p[2]);
            this.nor.push(nx, ny, nz);
            this.col.push(col[0], col[1], col[2]);
            this.extra.push(this.tag);
        }
    }

    /** Draws with a surface kind set (then puts it back). */
    as(surface: number, draw: () => void) {
        const before = this.surface;
        this.surface = surface;
        try {
            draw();
        } finally {
            this.surface = before;
        }
    }

    /** A quad a-b-c-d (counter-clockwise seen from its front). */
    quad(a: V3, b: V3, c: V3, d: V3, colour: [number, number, number]) {
        this.tri(a, b, c, colour);
        this.tri(a, c, d, colour);
    }

    /**
     * A box in a frame: middle (lx, lz) on the frame's floor plus `ly0`, size w × h × d, its own turn `turn`. The
     * sides are shaded a little by facing, so flat colours still read as solid. `bottom`: draw the underside too.
     */
    box(frame: Frame, lx: number, ly0: number, lz: number, w: number, h: number, d: number, colour: [number, number, number], turn = 0, options: {top?: [number, number, number]; bottom?: boolean} = {}) {
        const f: Frame = {x: 0, y: 0, z: 0, rot: 0};
        const p = at(frame, lx, ly0, lz);
        f.x = p[0];
        f.y = p[1];
        f.z = p[2];
        f.rot = frame.rot + turn;
        const hw = w / 2;
        const hd = d / 2;
        const c = [at(f, -hw, 0, -hd), at(f, hw, 0, -hd), at(f, hw, 0, hd), at(f, -hw, 0, hd)];
        const t = [at(f, -hw, h, -hd), at(f, hw, h, -hd), at(f, hw, h, hd), at(f, -hw, h, hd)];
        const side = (k: number) => [colour[0] * k, colour[1] * k, colour[2] * k] as [number, number, number];
        this.quad(c[3], c[2], t[2], t[3], side(1));
        this.quad(c[1], c[0], t[0], t[1], side(0.86));
        this.quad(c[2], c[1], t[1], t[2], side(0.93));
        this.quad(c[0], c[3], t[3], t[0], side(0.9));
        this.quad(t[3], t[2], t[1], t[0], options.top ?? side(1.06));
        if (options.bottom) this.quad(c[0], c[1], c[2], c[3], side(0.7));
    }

    /** A gable roof over a w × d footprint at height y (ridge along local x), with overhang and pitch (m of rise). */
    gable(frame: Frame, lx: number, y: number, lz: number, w: number, d: number, rise: number, overhang: number, roofColour: [number, number, number], wallColour: [number, number, number], turn = 0, thickness = 0.14, wallSurface = -1) {
        const f = this.sub(frame, lx, y, lz, turn);
        const hw = w / 2 + overhang;
        const hd = d / 2 + overhang;
        const front = [at(f, -hw, -overhang * (rise / (d / 2)), hd), at(f, hw, -overhang * (rise / (d / 2)), hd)];
        const back = [at(f, -hw, -overhang * (rise / (d / 2)), -hd), at(f, hw, -overhang * (rise / (d / 2)), -hd)];
        const ridge = [at(f, -hw, rise, 0), at(f, hw, rise, 0)];
        const shade = (k: number) => [roofColour[0] * k, roofColour[1] * k, roofColour[2] * k] as [number, number, number];
        this.quad(front[0], front[1], ridge[1], ridge[0], shade(1));
        this.quad(back[1], back[0], ridge[0], ridge[1], shade(0.84));
        // The roof's thickness at the eaves and verges.
        const down = (p: V3): V3 => [p[0], p[1] - thickness, p[2]];
        this.quad(down(front[0]), down(front[1]), front[1], front[0], shade(0.7));
        this.quad(down(back[1]), down(back[0]), back[0], back[1], shade(0.7));
        // Underside, so the roof reads from below.
        this.quad(down(ridge[0]), down(ridge[1]), down(front[1]), down(front[0]), shade(0.55));
        this.quad(down(ridge[1]), down(ridge[0]), down(back[0]), down(back[1]), shade(0.55));
        // The gable ends (walls).
        const gw = w / 2;
        const gd = d / 2;
        const wl = [at(f, -gw, 0, gd), at(f, -gw, 0, -gd), at(f, -gw, rise * (1 - 0.0), 0)];
        const wr = [at(f, gw, 0, -gd), at(f, gw, 0, gd), at(f, gw, rise, 0)];
        // (The gable ends are walls: their own surface kind when given.)
        const roofSurface = this.surface;
        if (wallSurface >= 0) this.surface = wallSurface;
        this.tri(wl[0], wl[2], wl[1], [wallColour[0] * 0.9, wallColour[1] * 0.9, wallColour[2] * 0.9]);
        this.tri(wr[0], wr[2], wr[1], [wallColour[0] * 0.93, wallColour[1] * 0.93, wallColour[2] * 0.93]);
        this.surface = roofSurface;
    }

    /** A hipped roof over a w × d footprint (ridge along x, shortened by the hips). */
    hip(frame: Frame, lx: number, y: number, lz: number, w: number, d: number, rise: number, overhang: number, roofColour: [number, number, number], turn = 0) {
        const f = this.sub(frame, lx, y, lz, turn);
        const hw = w / 2 + overhang;
        const hd = d / 2 + overhang;
        const drop = -overhang * (rise / (d / 2));
        const ridgeHalf = Math.max(hw - hd, 0.05);
        const c = [at(f, -hw, drop, -hd), at(f, hw, drop, -hd), at(f, hw, drop, hd), at(f, -hw, drop, hd)];
        const r = [at(f, -ridgeHalf, rise, 0), at(f, ridgeHalf, rise, 0)];
        const shade = (k: number) => [roofColour[0] * k, roofColour[1] * k, roofColour[2] * k] as [number, number, number];
        this.quad(c[3], c[2], r[1], r[0], shade(1));
        this.quad(c[1], c[0], r[0], r[1], shade(0.84));
        this.tri(c[2], c[1], r[1], shade(0.92));
        this.tri(c[0], c[3], r[0], shade(0.9));
        const down = (p: V3): V3 => [p[0], p[1] - 0.12, p[2]];
        this.quad(down(c[0]), down(c[1]), down(c[2]), down(c[3]), shade(0.5));
    }

    /** A pyramid (a spire, a tower's cap) on a square of side `w` at height y. */
    pyramid(frame: Frame, lx: number, y: number, lz: number, w: number, h: number, colour: [number, number, number], sides = 4) {
        const f = this.sub(frame, lx, y, lz, 0);
        const top = at(f, 0, h, 0);
        const r = w / Math.SQRT2;
        const ring: V3[] = [];
        for (let i = 0; i < sides; i++) {
            const a = Math.PI / 4 + (i / sides) * Math.PI * 2;
            ring.push(at(f, Math.cos(a) * r, 0, Math.sin(a) * r));
        }
        for (let i = 0; i < sides; i++) this.tri(ring[(i + 1) % sides], ring[i], top, [colour[0] * (0.82 + 0.06 * (i % 3)), colour[1] * (0.82 + 0.06 * (i % 3)), colour[2] * (0.82 + 0.06 * (i % 3))]);
    }

    /** A cylinder (`sides` faces) standing at (lx, y, lz), radius r0 at the bottom and r1 at the top. */
    cylinder(frame: Frame, lx: number, y: number, lz: number, r0: number, r1: number, h: number, colour: [number, number, number], sides = 8, cap = true) {
        const f = this.sub(frame, lx, y, lz, 0);
        for (let i = 0; i < sides; i++) {
            const a0 = (i / sides) * Math.PI * 2;
            const a1 = ((i + 1) / sides) * Math.PI * 2;
            const b0 = at(f, Math.cos(a0) * r0, 0, Math.sin(a0) * r0);
            const b1 = at(f, Math.cos(a1) * r0, 0, Math.sin(a1) * r0);
            const t0 = at(f, Math.cos(a0) * r1, h, Math.sin(a0) * r1);
            const t1 = at(f, Math.cos(a1) * r1, h, Math.sin(a1) * r1);
            const k = 0.82 + 0.18 * (0.5 + 0.5 * Math.cos(a0 - 0.6));
            this.quad(b1, b0, t0, t1, [colour[0] * k, colour[1] * k, colour[2] * k]);
            if (cap && r1 > 0.001) this.tri(t1, t0, at(f, 0, h, 0), [colour[0] * 1.04, colour[1] * 1.04, colour[2] * 1.04]);
        }
    }

    /** A lumpy ball (a tree's crown, a shrub): an icosahedron-ish shell, squashed by (sx, sy, sz), jittered by `seed`. */
    blob(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, colour: [number, number, number], seed: number, detail = 1) {
        const verts = icosphere(detail);
        let s = seed >>> 0;
        const rand = () => {
            s = (s + 0x6d2b79f5) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const jitter = verts.points.map(() => 0.82 + rand() * 0.3);
        const p = verts.points.map((v, i) => [cx + v[0] * sx * jitter[i], cy + v[1] * sy * jitter[i], cz + v[2] * sz * jitter[i]] as V3);
        for (const [a, b, c] of verts.faces) {
            const up = (verts.points[a][1] + verts.points[b][1] + verts.points[c][1]) / 3;
            const k = 0.72 + 0.32 * (up * 0.5 + 0.5) + (rand() - 0.5) * 0.08;
            this.tri(p[a], p[b], p[c], [colour[0] * k, colour[1] * k, colour[2] * k]);
        }
    }

    /** A flat strip along a polyline at heights from `heightAt` (+ `lift`), `width` wide (roads, paths, kerbs). */
    ribbon(line: Array<{x: number; z: number}>, width: number, heightAt: (x: number, z: number) => number, lift: number, colour: [number, number, number], step = 2, offset = 0) {
        const pts: Array<{x: number; z: number}> = [];
        for (let i = 1; i < line.length; i++) {
            const a = line[i - 1];
            const b = line[i];
            const length = Math.hypot(b.x - a.x, b.z - a.z);
            const n = Math.max(1, Math.ceil(length / step));
            for (let k = 0; k < n; k++) pts.push({x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n});
        }
        pts.push(line[line.length - 1]);
        const left: V3[] = [];
        const right: V3[] = [];
        for (let i = 0; i < pts.length; i++) {
            const a = pts[Math.max(i - 1, 0)];
            const b = pts[Math.min(i + 1, pts.length - 1)];
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const length = Math.hypot(dx, dz) || 1;
            const nx = -dz / length;
            const nz = dx / length;
            const half = width / 2;
            const lx = pts[i].x + nx * (offset + half);
            const lz = pts[i].z + nz * (offset + half);
            const rx = pts[i].x + nx * (offset - half);
            const rz = pts[i].z + nz * (offset - half);
            left.push([lx, heightAt(lx, lz) + lift, lz]);
            right.push([rx, heightAt(rx, rz) + lift, rz]);
        }
        for (let i = 1; i < pts.length; i++) this.quad(left[i - 1], left[i], right[i], right[i - 1], colour);
    }

    /** A box-shaped patch of ground draped on the terrain (a field, a garden, a paddock's sand), gridded every `step` m. */
    drape(frame: Frame, w: number, d: number, heightAt: (x: number, z: number) => number, lift: number, colour: (lx: number, lz: number) => [number, number, number], step = 2) {
        const nx = Math.max(1, Math.ceil(w / step));
        const nz = Math.max(1, Math.ceil(d / step));
        const grid: V3[] = [];
        for (let k = 0; k <= nz; k++) {
            for (let i = 0; i <= nx; i++) {
                const p = at(frame, -w / 2 + (w * i) / nx, 0, -d / 2 + (d * k) / nz);
                grid.push([p[0], heightAt(p[0], p[2]) + lift, p[2]]);
            }
        }
        for (let k = 0; k < nz; k++) {
            for (let i = 0; i < nx; i++) {
                const a = grid[k * (nx + 1) + i];
                const b = grid[k * (nx + 1) + i + 1];
                const c = grid[(k + 1) * (nx + 1) + i + 1];
                const e = grid[(k + 1) * (nx + 1) + i];
                const col = colour(-w / 2 + (w * (i + 0.5)) / nx, -d / 2 + (d * (k + 0.5)) / nz);
                this.quad(e, c, b, a, col);
            }
        }
    }

    /** Appends another (non-indexed or indexed) geometry with position, normal and colour, placed and turned about y. */
    addGeometry(geometry: BufferGeometry, x: number, y: number, z: number, turn = 0, scale = 1) {
        const flat = geometry.index ? geometry.toNonIndexed() : geometry;
        const p = flat.getAttribute("position");
        const n = flat.getAttribute("normal");
        const c = flat.getAttribute("color");
        const cos = Math.cos(turn);
        const sin = Math.sin(turn);
        for (let i = 0; i < p.count; i++) {
            const px = p.getX(i) * scale;
            const pz = p.getZ(i) * scale;
            this.pos.push(x + px * cos - pz * sin, y + p.getY(i) * scale, z + px * sin + pz * cos);
            const nx = n ? n.getX(i) : 0;
            const nz = n ? n.getZ(i) : 0;
            this.nor.push(nx * cos - nz * sin, n ? n.getY(i) : 1, nx * sin + nz * cos);
            this.col.push(c ? c.getX(i) : 1, c ? c.getY(i) : 1, c ? c.getZ(i) : 1);
            this.extra.push(this.tag);
        }
        if (flat !== geometry) flat.dispose();
    }

    sub(frame: Frame, lx: number, y: number, lz: number, turn: number): Frame {
        const p = at(frame, lx, 0, lz);
        return {x: p[0], y: frame.y + y, z: p[2], rot: frame.rot + turn};
    }

    toGeometry(withExtra = false): BufferGeometry {
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
        geometry.setAttribute("normal", new BufferAttribute(new Float32Array(this.nor), 3));
        geometry.setAttribute("color", new BufferAttribute(new Float32Array(this.col), 3));
        if (withExtra) geometry.setAttribute("aTag", new BufferAttribute(new Float32Array(this.extra), 1));
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
        return geometry;
    }
}

/** A Geo that keeps nothing (a building drawn for its windows alone, or its near detail alone). */
export class NullGeo extends Geo {
    override tri() {}
}

const spheres = new Map<number, {points: V3[]; faces: Array<[number, number, number]>}>();

/** A unit icosphere (`detail` subdivisions), cached. */
export function icosphere(detail: number): {points: V3[]; faces: Array<[number, number, number]>} {
    const cached = spheres.get(detail);
    if (cached) return cached;
    const t = (1 + Math.sqrt(5)) / 2;
    let points: V3[] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => normalise(p as V3));
    let faces: Array<[number, number, number]> = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let d = 0; d < detail; d++) {
        const mid = new Map<string, number>();
        const middle = (a: number, b: number) => {
            const key = a < b ? `${a}_${b}` : `${b}_${a}`;
            const found = mid.get(key);
            if (found !== undefined) return found;
            const p = normalise([(points[a][0] + points[b][0]) / 2, (points[a][1] + points[b][1]) / 2, (points[a][2] + points[b][2]) / 2]);
            points = [...points, p];
            mid.set(key, points.length - 1);
            return points.length - 1;
        };
        const next: Array<[number, number, number]> = [];
        for (const [a, b, c] of faces) {
            const ab = middle(a, b);
            const bc = middle(b, c);
            const ca = middle(c, a);
            next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
        }
        faces = next;
    }
    const out = {points, faces};
    spheres.set(detail, out);
    return out;
}

function normalise(p: V3): V3 {
    const l = Math.hypot(p[0], p[1], p[2]) || 1;
    return [p[0] / l, p[1] / l, p[2] / l];
}
