/**
 * ARK-SEAT: a geometry's triangles on a flat grid (its own x and z), so a short segment or a straight drop through it
 * tests only the triangles in the cells it crosses. One per drawn geometry, shared by every instance of it; built a
 * slice at a time (`step`) so a 130,000-triangle rock field never costs a frame, and let go when nothing asks.
 *
 * Why a grid and not a tree: nearly every question the seat pass asks is a drop (straight down in the world, close to
 * straight down in a rock's or a tree's own space) or a segment under a metre long; both cross a handful of cells.
 * It holds triangle numbers only (4 bytes a triangle and cell), never a copy of the positions.
 */

import type {BufferAttribute, BufferGeometry, InterleavedBufferAttribute} from "three";

export type GridHit = {
    /** Along the segment, 0 at its start to 1 at its end. */
    t: number;
    /** The triangle's normal in the geometry's own space (not unit length; by its winding). */
    nx: number;
    ny: number;
    nz: number;
    tri: number;
};

const EPS = 1e-9;

/** The hits handed out (reused once a cast starts on an empty list: a hit is read before the next cast). */
const pool: GridHit[] = [];
let pooled = 0;

type Box = {min: {x: number; y: number; z: number}; max: {x: number; y: number; z: number}};
const boxes = new WeakMap<BufferGeometry, Box | null>();

/**
 * A geometry's box in its own space, read from its positions here (kept): null for one with no triangle or with
 * positions that are not numbers (three's own `computeBoundingBox` reports those as an error each time).
 */
export function boxOf(geometry: BufferGeometry): Box | null {
    const known = boxes.get(geometry);
    if (known !== undefined) return known;
    const position = geometry.getAttribute("position") as BufferAttribute | undefined;
    let box: Box | null = null;
    if (geometry.boundingBox && Number.isFinite(geometry.boundingBox.min.x + geometry.boundingBox.max.x + geometry.boundingBox.min.y + geometry.boundingBox.max.y + geometry.boundingBox.min.z + geometry.boundingBox.max.z)) {
        const b = geometry.boundingBox;
        box = {min: {x: b.min.x, y: b.min.y, z: b.min.z}, max: {x: b.max.x, y: b.max.y, z: b.max.z}};
    } else if (position && position.count >= 3) {
        box = {min: {x: Infinity, y: Infinity, z: Infinity}, max: {x: -Infinity, y: -Infinity, z: -Infinity}};
        for (let v = 0; v < position.count; v++) {
            const x = position.getX(v);
            const y = position.getY(v);
            const z = position.getZ(v);
            if (x < box.min.x) box.min.x = x;
            if (y < box.min.y) box.min.y = y;
            if (z < box.min.z) box.min.z = z;
            if (x > box.max.x) box.max.x = x;
            if (y > box.max.y) box.max.y = y;
            if (z > box.max.z) box.max.z = z;
            if (x !== x || y !== y || z !== z) {
                box = null;
                break;
            }
        }
    }
    boxes.set(geometry, box);
    return box;
}

export class TriGrid {
    readonly tris: number;
    private readonly position: BufferAttribute | InterleavedBufferAttribute;
    private readonly plain: Float32Array | null;
    private readonly index: ArrayLike<number> | null;
    private readonly first: number;
    private readonly minX: number;
    private readonly minZ: number;
    private readonly nx: number;
    private readonly nz: number;
    private readonly cellX: number;
    private readonly cellZ: number;
    private starts: Uint32Array;
    private ids: Uint32Array | null = null;
    private fill: Uint32Array | null = null;
    private stage = 0;
    private cursor = 0;
    private readonly a = new Float64Array(9);

    constructor(geometry: BufferGeometry) {
        this.position = geometry.getAttribute("position") as BufferAttribute | InterleavedBufferAttribute;
        const p = this.position as BufferAttribute & {isInterleavedBufferAttribute?: boolean};
        this.plain = !p.isInterleavedBufferAttribute && p.array instanceof Float32Array && p.itemSize === 3 && !p.normalized ? p.array : null;
        this.index = geometry.index ? (geometry.index.array as ArrayLike<number>) : null;
        const total = (this.index ? this.index.length : this.position.count) / 3;
        const range = geometry.drawRange;
        this.first = Math.min(Math.max(Math.floor((range?.start ?? 0) / 3), 0), Math.floor(total));
        this.tris = Math.max(Math.min(Math.floor(total) - this.first, Number.isFinite(range?.count) ? Math.floor((range?.count ?? 0) / 3) : Infinity), 0);
        const box = boxOf(geometry) ?? {min: {x: 0, y: 0, z: 0}, max: {x: 0, y: 0, z: 0}};
        const side = Math.min(Math.max(Math.ceil(Math.sqrt(this.tris / 2)), 1), 128);
        const spanX = Math.max(box.max.x - box.min.x, 1e-6);
        const spanZ = Math.max(box.max.z - box.min.z, 1e-6);
        // (Cells near square: a long thin geometry gets more of them along its length.)
        const ratio = Math.min(Math.max(spanX / spanZ, 1 / 16), 16);
        this.nx = Math.min(Math.max(Math.round(side * Math.sqrt(ratio)), 1), 256);
        this.nz = Math.min(Math.max(Math.round(side / Math.sqrt(ratio)), 1), 256);
        this.minX = box.min.x;
        this.minZ = box.min.z;
        this.cellX = spanX / this.nx;
        this.cellZ = spanZ / this.nz;
        this.starts = new Uint32Array(this.nx * this.nz + 1);
        if (!this.tris || !boxOf(geometry)) this.stage = 2;
    }

    get ready(): boolean {
        return this.stage === 2;
    }

    /** Bytes held (the cells and the triangle numbers). */
    get bytes(): number {
        return this.starts.byteLength + (this.ids?.byteLength ?? 0) + (this.fill?.byteLength ?? 0);
    }

    private read(tri: number): Float64Array {
        const a = this.a;
        const k = (this.first + tri) * 3;
        for (let c = 0; c < 3; c++) {
            const v = this.index ? this.index[k + c] : k + c;
            if (this.plain) {
                a[c * 3] = this.plain[v * 3];
                a[c * 3 + 1] = this.plain[v * 3 + 1];
                a[c * 3 + 2] = this.plain[v * 3 + 2];
            } else {
                a[c * 3] = this.position.getX(v);
                a[c * 3 + 1] = this.position.getY(v);
                a[c * 3 + 2] = this.position.getZ(v);
            }
        }
        return a;
    }

    private cellsOf(a: Float64Array): [number, number, number, number] {
        const x0 = Math.min(a[0], a[3], a[6]);
        const x1 = Math.max(a[0], a[3], a[6]);
        const z0 = Math.min(a[2], a[5], a[8]);
        const z1 = Math.max(a[2], a[5], a[8]);
        return [this.col(x0), this.col(x1), this.row(z0), this.row(z1)];
    }

    private col(x: number): number {
        return Math.min(Math.max(Math.floor((x - this.minX) / this.cellX), 0), this.nx - 1);
    }

    private row(z: number): number {
        return Math.min(Math.max(Math.floor((z - this.minZ) / this.cellZ), 0), this.nz - 1);
    }

    /** Build on by up to `most` triangles; true once it can be asked. */
    step(most: number): boolean {
        while (most > 0 && this.stage < 2) {
            const end = Math.min(this.cursor + most, this.tris);
            most -= end - this.cursor;
            if (this.stage === 0) {
                for (let t = this.cursor; t < end; t++) {
                    const [c0, c1, r0, r1] = this.cellsOf(this.read(t));
                    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.starts[r * this.nx + c + 1]++;
                }
            } else {
                const ids = this.ids!;
                const fill = this.fill!;
                for (let t = this.cursor; t < end; t++) {
                    const [c0, c1, r0, r1] = this.cellsOf(this.read(t));
                    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) ids[fill[r * this.nx + c]++] = t;
                }
            }
            this.cursor = end;
            if (end < this.tris) break;
            this.cursor = 0;
            if (this.stage === 0) {
                for (let i = 1; i < this.starts.length; i++) this.starts[i] += this.starts[i - 1];
                this.ids = new Uint32Array(this.starts[this.starts.length - 1]);
                this.fill = this.starts.slice(0, this.starts.length - 1);
                this.stage = 1;
            } else {
                this.fill = null;
                this.stage = 2;
            }
        }
        return this.stage === 2;
    }

    /**
     * Every triangle the segment from (ox, oy, oz) to that plus (dx, dy, dz) crosses, either face, pushed onto `out`
     * (not sorted). The geometry's own space. Nothing before it is `ready`.
     */
    cast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, out: GridHit[]): void {
        if (this.stage !== 2 || !this.ids) return;
        const c0 = this.col(Math.min(ox, ox + dx));
        const c1 = this.col(Math.max(ox, ox + dx));
        const r0 = this.row(Math.min(oz, oz + dz));
        const r1 = this.row(Math.max(oz, oz + dz));
        // (Clear of the grid altogether.)
        if (Math.max(ox, ox + dx) < this.minX - 1e-6 || Math.min(ox, ox + dx) > this.minX + this.cellX * this.nx + 1e-6) return;
        if (Math.max(oz, oz + dz) < this.minZ - 1e-6 || Math.min(oz, oz + dz) > this.minZ + this.cellZ * this.nz + 1e-6) return;
        if (!out.length) pooled = 0;
        const from = out.length;
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                const k = r * this.nx + c;
                for (let i = this.starts[k]; i < this.starts[k + 1]; i++) {
                    const tri = this.ids[i];
                    const a = this.read(tri);
                    const e1x = a[3] - a[0];
                    const e1y = a[4] - a[1];
                    const e1z = a[5] - a[2];
                    const e2x = a[6] - a[0];
                    const e2y = a[7] - a[1];
                    const e2z = a[8] - a[2];
                    // Möller-Trumbore, both faces.
                    const px = dy * e2z - dz * e2y;
                    const py = dz * e2x - dx * e2z;
                    const pz = dx * e2y - dy * e2x;
                    const det = e1x * px + e1y * py + e1z * pz;
                    if (det > -EPS && det < EPS) continue;
                    const inv = 1 / det;
                    const tx = ox - a[0];
                    const ty = oy - a[1];
                    const tz = oz - a[2];
                    const u = (tx * px + ty * py + tz * pz) * inv;
                    if (u < -1e-6 || u > 1 + 1e-6) continue;
                    const qx = ty * e1z - tz * e1y;
                    const qy = tz * e1x - tx * e1z;
                    const qz = tx * e1y - ty * e1x;
                    const v = (dx * qx + dy * qy + dz * qz) * inv;
                    if (v < -1e-6 || u + v > 1 + 1e-6) continue;
                    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
                    if (t < 0 || t > 1) continue;
                    let seen = false;
                    for (let h = from; h < out.length; h++) if (out[h].tri === tri) seen = true;
                    if (seen) continue;
                    // (Kept objects: a frame's casts make no garbage.)
                    const hit = pool[pooled] ?? (pool[pooled] = {t: 0, nx: 0, ny: 0, nz: 0, tri: 0});
                    pooled++;
                    hit.t = t;
                    hit.nx = e1y * e2z - e1z * e2y;
                    hit.ny = e1z * e2x - e1x * e2z;
                    hit.nz = e1x * e2y - e1y * e2x;
                    hit.tri = tri;
                    out.push(hit);
                }
            }
        }
    }
}
