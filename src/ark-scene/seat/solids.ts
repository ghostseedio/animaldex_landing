/**
 * ARK-SEAT: one index of every solid thing the scene draws that an animal can stand on, perch on or be inside: the
 * rocks (every island's sets), the trees' wood and leaves, logs and stumps, roofs, walls, fences, floors' furniture,
 * floor plants and flower heads, nests, mounds. It is read from the scene itself (the meshes drawn now, each instance
 * as placed), not from any one set's own list, so a new kind of scenery is in it the day it is drawn.
 *
 * The terrain is not here: the scene has it as a function (`standGround`, the drawn triangles of the ground, a town
 * floor), which the seat pass asks beside this.
 *
 * A question is a segment in the world (a drop under a foot, a short reach to a trunk): the meshes whose instances'
 * boxes it crosses, each one's triangles through its grid (`trigrid.ts`), the hits back in the world with the face's
 * normal. Grids are built a slice a frame (`step`); a segment through one not built yet says so (`cast` false) and the
 * asker waits a frame, keeping what it had.
 */

import {Matrix4, type BufferGeometry, type InstancedMesh, type Material, type Mesh, type Object3D} from "three";
import {boxOf, TriGrid, type GridHit} from "@/ark-scene/seat/trigrid";

/** What a drawn thing is to an animal on it. */
export const ROCK = 1; // rock: anything stands on it, nothing is inside it
export const HARD = 2; // built or fallen: a roof, a wall, a fence, a log, a mound
export const TREE = 4; // a tree as drawn: its trunk, limbs and leaves (what is held in a tree, and the smallest)
export const SOFT = 8; // leaves, flower heads, floor plants, nests (what rests on a plant, and the smallest)
export const ALL = ROCK | HARD | TREE | SOFT;

export type SolidHit = {t: number; x: number; y: number; z: number; nx: number; ny: number; nz: number; cls: number; kind: string; double: boolean};

/** A drawn instance near a body: its solid, its triangles, and the world's way into its own space (a matrix's elements). */
export type Near = {solid: {cls: number; kind: string; double: boolean; boxes: Float32Array}; grid: TriGrid; e: Float64Array; /** Where its box is in its solid's `boxes` (min x y z, max x y z). */ o: number};

/** Never a surface: water, sky, weather, marks, glass, decals, grass blades, people, traffic, light. */
const SKIP = /water|\bsea\b|:sea|ocean|sky|rain|fog|cloud|mist|glow|glass|decal|\bnet\b|shadow|web|wake|blows|light|panes|probe|bug-ground|bug-climb|human|vehicle|cars:|traffic:|recipes|trails|tracks|-runs|casts|:ants|vent|pools|:cover|washing|sawdust|slash|tvs|towels|parasol|christmas|clock-hands|effects|ark-ground|reef|fish-|kelp|seagrass|mud|puddle|snow|drift|icicle|tussock|:card|cave|lily|falls-pool|chunk-batches\|ground|^ground\||\|ground\|/i;
const ROCKS = /asset-rock|^rock\||rocks|pebbles|falls-cliff|falls-rim|boulder|crag|:stone/i;
const TREES = /asset-tree|town:trees|^broadleaf\||^rainforest\||^conifer\||^acacia\||^palm\||^orchard\||^cactus\|/i;
const WOOD = /log|stump|snag|roots|forest-limbs|log-pile/i;
const SOFTS = /zoo-life|asset-floor|^shrub\||^reed\||^flower\||^leaf\||^canopy\||foliage|wildflowers|cabbages|ferns|bush|fern|:weed|:leaf|:flower|:litter|nest|chrysalis|cocoon|bee-hollow/i;
const HARDS = /buildings|solid|shell|inside|outdoor|bars|bins|boats|narrowboats|stalls|troughs|coops|mound|safari-trucks|warren|:den|lair|forest-tools/i;

/** The class of a drawn mesh by its kind, its name and its parent's (0: not a surface; -1: a mesh this does not know). */
export function solidClass(label: string): number {
    if (SKIP.test(label)) return 0;
    if (WOOD.test(label)) return HARD;
    if (ROCKS.test(label)) return ROCK;
    if (/bush|fern|reeds|lily/i.test(label)) return SOFT;
    if (TREES.test(label)) return TREE;
    if (SOFTS.test(label)) return SOFT;
    if (HARDS.test(label)) return HARD;
    return -1;
}

export function solidLabel(mesh: Object3D): string {
    return `${String(mesh.userData?.kind ?? "")}|${mesh.name || ""}|${mesh.parent?.name || ""}`;
}

type Solid = {
    mesh: Mesh;
    instanced: InstancedMesh | null;
    cls: number;
    kind: string;
    geometry: BufferGeometry;
    double: boolean;
    /** The instance matrices' version and count the boxes were made from; -1: to make. */
    version: number;
    count: number;
    stamp: number;
    boxes: Float32Array;
    box: Float64Array;
    shown: boolean;
    /** Drawn now (it and every parent visible, and still in the scene), as read at `drawnFrame`. */
    drawn: boolean;
    drawnFrame: number;
    /** Nothing to stand on (no triangles, or positions that are not numbers). */
    dead: boolean;
    /** Many instances: their numbers by 16 m cell (an instance over many cells is in `wide`), and each one's last query. */
    cells: Map<number, number[]> | null;
    wide: number[];
    asked: Uint32Array;
    /** How often its instances moved lately (counted down as the meshes are read again). */
    changes: number;
};

/** Instances a solid has before they are kept by cell, and the cell's side (m). */
const CELLS_FROM = 48;
const CELL = 16;
const cellKey = (cx: number, cz: number) => (cx + 4096) * 8192 + (cz + 4096);

type Held = {grid: TriGrid; used: number};

const m = new Matrix4();
const inv = new Matrix4();
const inst = new Matrix4();

export class DrawnSolids {
    private solids: Solid[] = [];
    private gathered = -1e9;
    private readonly grids = new Map<BufferGeometry, Held>();
    private readonly pending: TriGrid[] = [];
    private readonly scratch: GridHit[] = [];
    private readonly pool: Array<{solid: Solid; grid: TriGrid; e: Float64Array; o: number}> = [];
    private pooled = 0;
    private query = 0;
    private stamp = 0;
    private restless = false;
    private told = 0;
    /** Goes up when what is drawn changes (a mesh shown, hidden, its instances moved): seats made before are made again. */
    version = 0;
    private readonly hitPool: SolidHit[] = [];
    private hitsOut = 0;
    private readonly unknown = new Set<string>();
    private frame = 0;
    /** The audit and the tests: grids built at once, nothing ever waits. */
    force = false;
    /** Counters for the budget (`stats`). */
    casts = 0;
    refreshed = 0;

    constructor(private readonly scene: Object3D) {}

    /** The frame's start: the meshes read again twice a second (sets load, levels swap), old grids let go. */
    begin(frame: number): void {
        this.frame = frame;
        if (frame - this.gathered >= 30 || frame < this.gathered) this.gather();
        // (Things that move all the time, a level's list rebuilt as the camera goes: their changes are told a third of a
        // second apart, and the last of them always.)
        if (this.restless && frame - this.told >= 20) {
            this.restless = false;
            this.told = frame;
            this.version++;
        }
    }

    /** Read the scene's meshes again now. */
    gather(): void {
        this.gathered = this.frame;
        const before = new Map(this.solids.map((s) => [s.mesh, s]));
        const next: Solid[] = [];
        const walk = (object: Object3D, shown: boolean) => {
            const visible = shown && object.visible;
            const mesh = object as Mesh;
            if (mesh.isMesh && mesh.geometry?.getAttribute?.("position") && !mesh.geometry.getAttribute("arkInstance") && !mesh.geometry.getAttribute("arkRigA")) {
                const label = solidLabel(mesh);
                const cls = label === "||" ? 0 : solidClass(label);
                if (cls < 0) this.unknown.add(label);
                if (cls > 0) {
                    const known = before.get(mesh);
                    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material | undefined;
                    const solid: Solid = known && known.geometry === mesh.geometry ? known : {mesh, instanced: (mesh as InstancedMesh).isInstancedMesh ? (mesh as InstancedMesh) : null, cls, kind: label, geometry: mesh.geometry, double: false, version: -1, count: -1, stamp: NaN, boxes: new Float32Array(0), box: new Float64Array(6), shown: visible, drawn: visible, drawnFrame: this.frame, dead: false, cells: null, wide: [], asked: new Uint32Array(0), changes: 0};
                    solid.shown = visible;
                    if (solid.changes > 0 && this.frame % 4 === 0) solid.changes--;
                    // (Thin: a leaf, a card, a sheet, met from either side. A rock is a lump whatever its material's sides
                    // (the dens' boulders are drawn two-sided); a built thing drawn two-sided is taken as sheets.)
                    solid.double = cls === SOFT || cls === TREE || (cls === HARD && (material?.side ?? 0) === 2);
                    next.push(solid);
                }
            }
            // (An animal's own parts, a person's figure: nothing under them is scenery.)
            for (const child of object.children) walk(child, visible);
        };
        walk(this.scene, true);
        // (What is drawn changed: a mesh come or gone, shown or hidden. Every seat is worked out again.)
        let stamp = next.length;
        for (const solid of next) stamp = (stamp * 31 + solid.mesh.id * (solid.shown && solid.mesh.visible ? 2 : 1)) | 0;
        if (stamp !== this.stamp) {
            this.stamp = stamp;
            this.version++;
        }
        this.solids = next;
        // Grids nothing has asked for in ten seconds go (a rock field left behind).
        this.grids.forEach((held, geometry) => {
            if (this.frame - held.used > 600 && !this.force) this.grids.delete(geometry);
        });
    }

    /** Build waiting grids on, for about `ms`. */
    step(ms: number): void {
        if (!this.pending.length) return;
        const until = performance.now() + ms;
        while (this.pending.length) {
            const grid = this.pending[0];
            if (grid.step(600)) this.pending.shift();
            if (performance.now() >= until) break;
        }
    }

    private gridOf(geometry: BufferGeometry): TriGrid | null {
        let held = this.grids.get(geometry);
        if (!held) {
            held = {grid: new TriGrid(geometry), used: this.frame};
            this.grids.set(geometry, held);
            if (this.force) held.grid.step(Infinity);
            else if (!held.grid.ready) {
                // (A small one is cheaper built now than waited for.)
                if (held.grid.tris <= 400) held.grid.step(Infinity);
                else this.pending.push(held.grid);
            }
        }
        held.used = this.frame;
        return held.grid.ready ? held.grid : null;
    }

    /** A solid's instances' boxes in the world, made again when its matrices changed. */
    private refresh(solid: Solid): void {
        const mesh = solid.mesh;
        const was = solid.count;
        const count = solid.instanced ? solid.instanced.count : 1;
        const version = solid.instanced ? solid.instanced.instanceMatrix.version : 0;
        const w = mesh.matrixWorld.elements;
        const stamp = w[12] + w[13] * 3 + w[14] * 7 + w[0] * 11 + w[5] * 13 + w[10] * 17;
        if (solid.version === version && solid.count === count && solid.stamp === stamp) return;
        const first = solid.version === -1;
        solid.version = version;
        solid.count = count;
        solid.stamp = stamp;
        this.refreshed++;
        const b = boxOf(solid.geometry);
        if (!b) {
            solid.dead = true;
            solid.count = 0;
            return;
        }
        const cx = (b.min.x + b.max.x) / 2;
        const cy = (b.min.y + b.max.y) / 2;
        const cz = (b.min.z + b.max.z) / 2;
        const ex = (b.max.x - b.min.x) / 2;
        const ey = (b.max.y - b.min.y) / 2;
        const ez = (b.max.z - b.min.z) / 2;
        let changed = count !== was;
        if (solid.boxes.length < count * 6) {
            solid.boxes = new Float32Array(Math.max(count, 1) * 6);
            changed = true;
        }
        const box = solid.box;
        box[0] = box[1] = box[2] = Infinity;
        box[3] = box[4] = box[5] = -Infinity;
        for (let i = 0; i < count; i++) {
            if (solid.instanced) {
                solid.instanced.getMatrixAt(i, inst);
                m.multiplyMatrices(mesh.matrixWorld, inst);
            } else m.copy(mesh.matrixWorld);
            const e = m.elements;
            const x = e[0] * cx + e[4] * cy + e[8] * cz + e[12];
            const y = e[1] * cx + e[5] * cy + e[9] * cz + e[13];
            const z = e[2] * cx + e[6] * cy + e[10] * cz + e[14];
            const rx = Math.abs(e[0]) * ex + Math.abs(e[4]) * ey + Math.abs(e[8]) * ez;
            const ry = Math.abs(e[1]) * ex + Math.abs(e[5]) * ey + Math.abs(e[9]) * ez;
            const rz = Math.abs(e[2]) * ex + Math.abs(e[6]) * ey + Math.abs(e[10]) * ez;
            const o = i * 6;
            // (Written again as it was, a level's list rebuilt the same each frame, is no change.)
            if (!changed && (Math.abs(solid.boxes[o] - (x - rx)) > 1e-3 || Math.abs(solid.boxes[o + 1] - (y - ry)) > 1e-3 || Math.abs(solid.boxes[o + 2] - (z - rz)) > 1e-3 || Math.abs(solid.boxes[o + 3] - (x + rx)) > 1e-3 || Math.abs(solid.boxes[o + 4] - (y + ry)) > 1e-3 || Math.abs(solid.boxes[o + 5] - (z + rz)) > 1e-3)) changed = true;
            solid.boxes[o] = x - rx;
            solid.boxes[o + 1] = y - ry;
            solid.boxes[o + 2] = z - rz;
            solid.boxes[o + 3] = x + rx;
            solid.boxes[o + 4] = y + ry;
            solid.boxes[o + 5] = z + rz;
            if (x - rx < box[0]) box[0] = x - rx;
            if (y - ry < box[1]) box[1] = y - ry;
            if (z - rz < box[2]) box[2] = z - rz;
            if (x + rx > box[3]) box[3] = x + rx;
            if (y + ry > box[4]) box[4] = y + ry;
            if (z + rz > box[5]) box[5] = z + rz;
        }
        if (!changed && !first) return;
        // Its instances moved (a tree's nearer level taking its place): the seats round it are made again. One that
        // moves all the time (a boat on the swell) does not ask that of everyone each frame.
        if (!first) {
            if (++solid.changes <= 3) this.version++;
            else this.restless = true;
        }
        solid.cells = null;
        solid.wide.length = 0;
        if (count >= CELLS_FROM) {
            const cells = (solid.cells = new Map<number, number[]>());
            if (solid.asked.length < count) solid.asked = new Uint32Array(count);
            for (let i = 0; i < count; i++) {
                const o = i * 6;
                const c0 = Math.floor(solid.boxes[o] / CELL);
                const c1 = Math.floor(solid.boxes[o + 3] / CELL);
                const r0 = Math.floor(solid.boxes[o + 2] / CELL);
                const r1 = Math.floor(solid.boxes[o + 5] / CELL);
                if (!Number.isFinite(c0 + c1 + r0 + r1) || (c1 - c0 + 1) * (r1 - r0 + 1) > 16) {
                    solid.wide.push(i);
                    continue;
                }
                for (let c = c0; c <= c1; c++)
                    for (let r = r0; r <= r1; r++) {
                        const key = cellKey(c, r);
                        const list = cells.get(key);
                        if (list) list.push(i);
                        else cells.set(key, [i]);
                    }
            }
        }
    }

    /**
     * The drawn solids' instances (classes in `mask`) whose boxes meet a box in the world, onto `out`, each with its
     * way into its own space: what a body's casts are then made against (`castIn`). False when one of them is still
     * being read (it is left out: ask again next frame).
     */
    collect(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mask: number, out: Near[]): boolean {
        let whole = true;
        for (const solid of this.solids) {
            if (!(solid.cls & mask) || solid.dead || !this.drawnNow(solid)) continue;
            this.refresh(solid);
            const box = solid.box;
            if (x1 < box[0] || x0 > box[3] || y1 < box[1] || y0 > box[4] || z1 < box[2] || z0 > box[5]) continue;
            if (solid.cells) {
                // (Many instances: only those in the cells the box is over.)
                const stamp = ++this.query;
                const c0 = Math.floor(x0 / CELL);
                const c1 = Math.floor(x1 / CELL);
                const r0 = Math.floor(z0 / CELL);
                const r1 = Math.floor(z1 / CELL);
                for (const i of solid.wide) if (!this.take(solid, i, x0, y0, z0, x1, y1, z1, out)) whole = false;
                for (let c = c0; c <= c1; c++)
                    for (let r = r0; r <= r1; r++) {
                        const list = solid.cells.get(cellKey(c, r));
                        if (!list) continue;
                        for (const i of list) {
                            if (solid.asked[i] === stamp) continue;
                            solid.asked[i] = stamp;
                            if (!this.take(solid, i, x0, y0, z0, x1, y1, z1, out)) whole = false;
                        }
                    }
            } else for (let i = 0; i < solid.count; i++) if (!this.take(solid, i, x0, y0, z0, x1, y1, z1, out)) whole = false;
        }
        return whole;
    }

    /**
     * Whether a solid is drawn now: it and every parent visible, and still in the scene. Read again each frame, not as
     * the meshes were last read: a level's mesh is shown the frame the camera brings its instances to it (the asset
     * rocks' and trees' `update`, after the seats' frame has begun), and its instances leave the level they were on at
     * once. Read as gathered, a rock or a tree come nearer was in no level for the seats for up to 30 frames (half a
     * second; seconds at a few frames a second): a pipit on its rock's face with nothing under it, a locust "inside" the
     * rock its seat could not see (WILD-PERCH).
     */
    private drawnNow(solid: Solid): boolean {
        if (solid.drawnFrame === this.frame) return solid.drawn;
        let on = true;
        let object: Object3D | null = solid.mesh;
        for (; object && object !== this.scene; object = object.parent) if (!object.visible) on = false;
        if (object !== this.scene || !this.scene.visible) on = false;
        // (Shown since it was last read: the seats round it are made again, as for instances that moved.)
        if (on && !solid.drawn) {
            if (++solid.changes <= 3) this.version++;
            else this.restless = true;
        }
        solid.drawn = on;
        solid.drawnFrame = this.frame;
        return on;
    }

    /** One instance into the list if its box meets the box asked (false: its triangles are still being read). */
    private take(solid: Solid, i: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, out: Near[]): boolean {
        const boxes = solid.boxes;
        const o = i * 6;
        if (x1 < boxes[o] || x0 > boxes[o + 3] || y1 < boxes[o + 1] || y0 > boxes[o + 4] || z1 < boxes[o + 2] || z0 > boxes[o + 5]) return true;
        const grid = this.gridOf(solid.geometry);
        if (!grid) return false;
        if (solid.instanced) {
            solid.instanced.getMatrixAt(i, inst);
            m.multiplyMatrices(solid.mesh.matrixWorld, inst);
        } else m.copy(solid.mesh.matrixWorld);
        inv.copy(m).invert();
        const near = this.pool[this.pooled] ?? (this.pool[this.pooled] = {solid, grid, e: new Float64Array(16), o: 0});
        this.pooled++;
        near.solid = solid;
        near.grid = grid;
        near.o = o;
        near.e.set(inv.elements);
        out.push(near);
        return true;
    }

    /** Hand the `collect` lists' entries back (once a body's casts are done). */
    release(): void {
        this.pooled = 0;
    }

    /**
     * Every face of the collected instances that the segment from (ox, oy, oz) to that plus (dx, dy, dz) crosses, onto
     * `out` (not sorted; either face, the normal as the face is wound).
     */
    castIn(list: Near[], ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, out: SolidHit[]): void {
        this.casts++;
        // (The hits are kept objects, reused once a cast starts on an empty list: read them before the next cast.)
        if (!out.length) this.hitsOut = 0;
        for (const near of list) {
            const e = near.e;
            const lx = e[0] * ox + e[4] * oy + e[8] * oz + e[12];
            const ly = e[1] * ox + e[5] * oy + e[9] * oz + e[13];
            const lz = e[2] * ox + e[6] * oy + e[10] * oz + e[14];
            const ldx = e[0] * dx + e[4] * dy + e[8] * dz;
            const ldy = e[1] * dx + e[5] * dy + e[9] * dz;
            const ldz = e[2] * dx + e[6] * dy + e[10] * dz;
            const hits = this.scratch;
            hits.length = 0;
            near.grid.cast(lx, ly, lz, ldx, ldy, ldz, hits);
            for (const hit of hits) {
                // The normal in the world: by the inverse's transpose.
                let nx = e[0] * hit.nx + e[1] * hit.ny + e[2] * hit.nz;
                let ny = e[4] * hit.nx + e[5] * hit.ny + e[6] * hit.nz;
                let nz = e[8] * hit.nx + e[9] * hit.ny + e[10] * hit.nz;
                const l = Math.hypot(nx, ny, nz) || 1;
                nx /= l;
                ny /= l;
                nz /= l;
                const kept = this.hitPool[this.hitsOut] ?? (this.hitPool[this.hitsOut] = {t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, cls: 0, kind: "", double: false});
                this.hitsOut++;
                kept.t = hit.t;
                kept.x = ox + dx * hit.t;
                kept.y = oy + dy * hit.t;
                kept.z = oz + dz * hit.t;
                kept.nx = nx;
                kept.ny = ny;
                kept.nz = nz;
                kept.cls = near.solid.cls;
                kept.kind = near.solid.kind;
                kept.double = near.solid.double;
                out.push(kept);
            }
        }
    }

    /** One segment against everything drawn (the tests, a one-off question): `collect` and `castIn` in one. */
    cast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, mask: number, out: SolidHit[]): boolean {
        const list: Near[] = [];
        const kept = this.pooled;
        const whole = this.collect(Math.min(ox, ox + dx), Math.min(oy, oy + dy), Math.min(oz, oz + dz), Math.max(ox, ox + dx), Math.max(oy, oy + dy), Math.max(oz, oz + dz), mask, list);
        this.castIn(list, ox, oy, oz, dx, dy, dz, out);
        this.pooled = kept;
        return whole;
    }

    /** For the audit and the budget: what it holds. */
    stats(): {solids: number; grids: number; pending: number; bytes: number; casts: number; refreshed: number; unknown: string[]} {
        let bytes = 0;
        this.grids.forEach((held) => (bytes += held.grid.bytes));
        for (const solid of this.solids) bytes += solid.boxes.byteLength;
        return {solids: this.solids.length, grids: this.grids.size, pending: this.pending.length, bytes, casts: this.casts, refreshed: this.refreshed, unknown: Array.from(this.unknown).sort()};
    }
}
