/**
 * ARK-SEAT's audit probe (development only: `scripts/ark-seat-audit.mjs` calls it through `window.__arkSeatProbe`).
 *
 * It measures what the seat pass promises, without the pass's own machinery: every vertex of the animal's mesh posed
 * as its shader poses it (not the hull's few), and rays (three's own `Ray.intersectTriangle`) against the triangles
 * of the scene's meshes read straight from their vertices and their instances' matrices, every one near the animal,
 * not the pass's grids. It shares only the rules: which drawn things hold which animals, and what "resting on" means
 * (`seat.ts`). A mesh the rules do not know is taken as solid, so a new kind of scenery an animal sinks into fails
 * here before anyone names it.
 */

import {Box3, DoubleSide, Matrix4, Ray, Vector3, type BufferAttribute, type BufferGeometry, type InstancedMesh, type Material, type Mesh, type Object3D} from "three";
import {HARD, ROCK, SOFT, TREE, solidClass, solidLabel} from "@/ark-scene/seat/solids";
import {posedHull, type Hull, type RigPose} from "@/ark-scene/seat/support";
import {boxOf} from "@/ark-scene/seat/trigrid";
import type {SeatKind} from "@/ark-scene/seat/seat";

/** An animal as it was drawn in the last frame (kept by the pass in development). */
export type SeatDrawn = {
    kind: SeatKind;
    level: string;
    m: number[];
    geometry: BufferGeometry;
    pose: RigPose | null;
    height: number;
    length: number;
    surface: {nx: number; ny: number; nz: number; sway?: {x: number; y: number; z: number}} | null;
    frame: number;
    near: number;
};

export type SeatMeasure = {
    kind: SeatKind;
    level: string;
    /** Its seat's gap (m): + over the surface it rests on, - in it. Null: nothing drawn to measure against (a face that is not there). */
    gap: number | null;
    /** Its lowest point's gap, and its most sunk point's. */
    low: number | null;
    on: string;
    /** Inner points of its body inside a closed solid, of how many, and whether its middle is. */
    inside: number;
    of: number;
    middle: boolean;
    insideOf: string;
    points: number;
};

const fulls = new WeakMap<BufferGeometry, Hull>();

/** Every vertex (a big mesh: every few) as a hull the pose can be put on. */
function fullHull(geometry: BufferGeometry): Hull {
    const known = fulls.get(geometry);
    if (known) return known;
    const position = geometry.getAttribute("position") as BufferAttribute;
    const stride = Math.max(1, Math.floor(position.count / 5000));
    const count = Math.ceil(position.count / stride);
    const vertices = new Uint32Array(count);
    const rest = new Float32Array(count * 3);
    const j = geometry.getAttribute("arkJoints") as BufferAttribute | undefined;
    const w = geometry.getAttribute("arkWeights") as BufferAttribute | undefined;
    const joints = j && w ? new Uint16Array(count * 4) : null;
    const weights = j && w ? new Float32Array(count * 4) : null;
    for (let i = 0; i < count; i++) {
        const v = i * stride;
        vertices[i] = v;
        rest[i * 3] = position.getX(v);
        rest[i * 3 + 1] = position.getY(v);
        rest[i * 3 + 2] = position.getZ(v);
        if (joints && weights && j && w)
            for (let k = 0; k < 4; k++) {
                joints[i * 4 + k] = j.getComponent(v, k);
                weights[i * 4 + k] = w.getComponent(v, k);
            }
    }
    const hull = {vertices, rest, joints, weights};
    fulls.set(geometry, hull);
    return hull;
}

type Target = {mesh: Mesh; cls: number; kind: string; closed: boolean};

/** A triangle near the animal being measured, in the world. */
type Tri = {a: Vector3; b: Vector3; c: Vector3; nx: number; ny: number; nz: number; target: Target};

export class SeatProbe {
    private targets: Target[] = [];
    private tris: Tri[] = [];
    private readonly ray = new Ray();
    private readonly at = new Vector3();
    private readonly world = new Matrix4();
    private readonly inverse = new Matrix4();
    private readonly box = new Box3();
    private readonly local = new Box3();

    constructor(private readonly scene: Object3D, private readonly ground: (x: number, z: number, near?: number) => number) {}

    /** Before a batch of measures: the scene's meshes as they are drawn now. */
    begin(): {meshes: number; unknown: string[]} {
        const unknown = new Set<string>();
        const targets: Target[] = [];
        const walk = (object: Object3D, shown: boolean) => {
            const visible = shown && object.visible;
            const mesh = object as Mesh;
            if (visible && mesh.isMesh && mesh.geometry?.getAttribute?.("position") && !mesh.geometry.getAttribute("arkInstance") && !mesh.geometry.getAttribute("arkRigA") && (mesh.geometry.getAttribute("position") as BufferAttribute).count >= 3) {
                const label = solidLabel(mesh);
                let cls = label === "||" ? 0 : solidClass(label);
                if (cls < 0) {
                    unknown.add(label);
                    cls = HARD;
                }
                const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material | undefined;
                if (cls > 0 && material && (!(mesh as InstancedMesh).isInstancedMesh || (mesh as InstancedMesh).count > 0)) {
                    targets.push({mesh, cls, kind: label, closed: material.side !== DoubleSide && cls !== SOFT && cls !== TREE});
                }
            }
            for (const child of object.children) walk(child, visible);
        };
        walk(this.scene, true);
        this.targets = targets;
        return {meshes: targets.length, unknown: Array.from(unknown).sort()};
    }

    end(): void {
        this.tris = [];
    }

    /**
     * Every drawn triangle that reaches into a box in the world (the animal's, with the room its rays need), read
     * straight from each mesh's own vertices and each instance's own matrix: what the rays below are cast against.
     */
    private gather(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mask: number): void {
        const tris: Tri[] = [];
        this.box.min.set(x0, y0, z0);
        this.box.max.set(x1, y1, z1);
        for (const target of this.targets) {
            if (!(target.cls & mask)) continue;
            const mesh = target.mesh as InstancedMesh;
            const geometry = mesh.geometry;
            const position = geometry.getAttribute("position") as BufferAttribute;
            const index = geometry.index;
            const first = Math.max(geometry.drawRange.start, 0);
            const count = Math.min(index ? index.count : position.count, first + (Number.isFinite(geometry.drawRange.count) ? geometry.drawRange.count : Infinity));
            for (let i = 0; i < (mesh.isInstancedMesh ? mesh.count : 1); i++) {
                if (mesh.isInstancedMesh) {
                    mesh.getMatrixAt(i, this.world);
                    this.world.premultiply(mesh.matrixWorld);
                } else this.world.copy(mesh.matrixWorld);
                // The box in the mesh's own space (its corners turned back): a triangle wholly outside it is passed over.
                this.local.copy(this.box).applyMatrix4(this.inverse.copy(this.world).invert());
                const l = this.local;
                const own = boxOf(geometry);
                if (!own || !Number.isFinite(l.min.x + l.max.x)) continue;
                if (own.max.x < l.min.x || own.min.x > l.max.x || own.max.y < l.min.y || own.min.y > l.max.y || own.max.z < l.min.z || own.min.z > l.max.z) continue;
                for (let t = first; t + 2 < count; t += 3) {
                    const ia = index ? index.getX(t) : t;
                    const ib = index ? index.getX(t + 1) : t + 1;
                    const ic = index ? index.getX(t + 2) : t + 2;
                    const ax = position.getX(ia);
                    const bx = position.getX(ib);
                    const cx = position.getX(ic);
                    if ((ax < l.min.x && bx < l.min.x && cx < l.min.x) || (ax > l.max.x && bx > l.max.x && cx > l.max.x)) continue;
                    const az = position.getZ(ia);
                    const bz = position.getZ(ib);
                    const cz = position.getZ(ic);
                    if ((az < l.min.z && bz < l.min.z && cz < l.min.z) || (az > l.max.z && bz > l.max.z && cz > l.max.z)) continue;
                    const ay = position.getY(ia);
                    const by = position.getY(ib);
                    const cy = position.getY(ic);
                    if ((ay < l.min.y && by < l.min.y && cy < l.min.y) || (ay > l.max.y && by > l.max.y && cy > l.max.y)) continue;
                    const a = new Vector3(ax, ay, az).applyMatrix4(this.world);
                    const b = new Vector3(bx, by, bz).applyMatrix4(this.world);
                    const c = new Vector3(cx, cy, cz).applyMatrix4(this.world);
                    const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
                    const length = n.length();
                    if (length < 1e-12) continue;
                    // (An instance drawn mirrored turns its faces over.)
                    const sign = this.world.determinant() < 0 ? -1 : 1;
                    tris.push({a, b, c, nx: (n.x / length) * sign, ny: (n.y / length) * sign, nz: (n.z / length) * sign, target});
                }
            }
        }
        this.tris = tris;
    }

    /** Every face a segment crosses (either face): how far along it (m), the face's normal in the world, its target. */
    private cast(x: number, y: number, z: number, dx: number, dy: number, dz: number, length: number, mask: number): Array<{d: number; nx: number; ny: number; nz: number; target: Target}> {
        this.ray.origin.set(x, y, z);
        this.ray.direction.set(dx, dy, dz);
        const out: Array<{d: number; nx: number; ny: number; nz: number; target: Target}> = [];
        for (const tri of this.tris) {
            if (!(tri.target.cls & mask)) continue;
            if (!this.ray.intersectTriangle(tri.a, tri.b, tri.c, false, this.at)) continue;
            const d = this.at.distanceTo(this.ray.origin);
            if (d > length) continue;
            out.push({d, nx: tri.nx, ny: tri.ny, nz: tri.nz, target: tri.target});
        }
        return out;
    }

    measure(drawn: SeatDrawn): SeatMeasure {
        const hull = fullHull(drawn.geometry);
        const model = new Float32Array(hull.vertices.length * 3);
        const n = posedHull(hull, drawn.pose, model);
        const e = drawn.m;
        const sway = drawn.surface?.sway;
        const world = new Float32Array(n * 3);
        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (let i = 0; i < n; i++) {
            const x = model[i * 3];
            const y = model[i * 3 + 1];
            const z = model[i * 3 + 2];
            cx += world[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12] - (sway?.x ?? 0);
            cy += world[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13] - (sway?.y ?? 0);
            cz += world[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14] - (sway?.z ?? 0);
        }
        cx /= n;
        cy /= n;
        cz /= n;
        const height = Math.max(drawn.height, 0.002);
        const length = Math.max(drawn.length, 0.002);
        const out: SeatMeasure = {kind: drawn.kind, level: drawn.level, gap: null, low: null, on: "", inside: 0, of: 0, middle: false, insideOf: "", points: 0};
        if (drawn.kind !== "stand" && drawn.kind !== "lie" && drawn.kind !== "perch" && drawn.kind !== "cling") return out;
        {
            // The scene's triangles round its body: under it down to the ground, over it as far as a rock's top is looked for.
            let x0 = Infinity;
            let y0 = Infinity;
            let z0 = Infinity;
            let x1 = -Infinity;
            let y1 = -Infinity;
            let z1 = -Infinity;
            for (let i = 0; i < n; i++) {
                x0 = Math.min(x0, world[i * 3]);
                y0 = Math.min(y0, world[i * 3 + 1]);
                z0 = Math.min(z0, world[i * 3 + 2]);
                x1 = Math.max(x1, world[i * 3]);
                y1 = Math.max(y1, world[i * 3 + 1]);
                z1 = Math.max(z1, world[i * 3 + 2]);
            }
            const pad = drawn.kind === "cling" ? Math.max(0.3, 1.6 * height) + 1 : 0.02;
            const under = Math.min(y0, this.ground(cx, cz, cy), this.ground(x0, z0, cy), this.ground(x1, z1, cy), this.ground(x0, z1, cy), this.ground(x1, z0, cy)) - 0.5;
            this.gather(x0 - pad, drawn.kind === "cling" ? y0 - pad : under, z0 - pad, x1 + pad, y1 + (drawn.kind === "cling" ? pad : 12.5), z1 + pad, ROCK | HARD | TREE | SOFT);
        }
        const cling = drawn.kind === "cling" && drawn.surface !== null;
        let ax = 0;
        let ay = 1;
        let az = 0;
        if (cling && drawn.surface) {
            const l = Math.hypot(drawn.surface.nx, drawn.surface.ny, drawn.surface.nz) || 1;
            ax = drawn.surface.nx / l;
            ay = drawn.surface.ny / l;
            az = drawn.surface.nz / l;
        }
        const along = (i: number) => world[i * 3] * ax + world[i * 3 + 1] * ay + world[i * 3 + 2] * az;
        let least = Infinity;
        for (let i = 0; i < n; i++) least = Math.min(least, along(i));
        const band = Math.max(0.004, 0.05 * height);
        const lowest: number[] = [];
        for (let i = 0; i < n; i++) if (along(i) <= least + band) lowest.push(i);
        lowest.sort((a, b) => along(a) - along(b));
        const support: number[] = [];
        for (const i of lowest) {
            if (support.length >= 8) break;
            if (support.every((j) => Math.hypot(world[i * 3] - world[j * 3], world[i * 3 + 1] - world[j * 3 + 1], world[i * 3 + 2] - world[j * 3 + 2]) > 0.12 * length)) support.push(i);
        }
        const held = drawn.kind === "perch" || drawn.kind === "cling";
        // (Held on something narrow: under its middle too, as the pass has it.)
        const lift = cx * ax + cy * ay + cz * az - least;
        const points: Array<[number, number, number]> = support.map((i) => [world[i * 3], world[i * 3 + 1], world[i * 3 + 2]]);
        if (held) points.unshift([cx - ax * lift, cy - ay * lift, cz - az * lift]);
        out.points = points.length;
        const mask = held || length <= 0.08 ? ROCK | HARD | TREE | SOFT : ROCK | HARD;
        const up = Math.min(Math.max(0.75 * height, 0.03), 1);
        const gaps: number[] = [];
        let nearest = Infinity;
        for (const [x, y, z] of points) {
            if (cling) {
                const down = Math.max(0.25, 1.5 * height);
                let best: number | null = null;
                for (const hit of this.cast(x + ax * up, y + ay * up, z + az * up, -ax, -ay, -az, up + down, mask)) {
                    const facing = hit.nx * ax + hit.ny * ay + hit.nz * az;
                    if ((hit.target.closed ? facing : Math.abs(facing)) < 0.25) continue;
                    const gap = hit.d - up;
                    if (best === null || Math.abs(gap) < Math.abs(best)) {
                        best = gap;
                        if (Math.abs(gap) < nearest) {
                            nearest = Math.abs(gap);
                            out.on = hit.target.kind;
                        }
                    }
                }
                if (best === null && ay > 0.15) {
                    const g = (y - this.ground(x, z, y)) * ay;
                    if (Math.abs(g) < down) {
                        best = g;
                        if (Math.abs(g) < nearest) {
                            nearest = Math.abs(g);
                            out.on = "ground";
                        }
                    }
                }
                if (best !== null) gaps.push(best);
                continue;
            }
            const ground = this.ground(x, z, y);
            const top = y + up;
            const bottom = Math.min(y, ground) - 0.02;
            const hits = top > bottom ? this.cast(x, top, z, 0, -1, 0, top - bottom, mask) : [];
            let floor = ground;
            let floorKind = "ground";
            for (const hit of hits) {
                if (!hit.target.closed || hit.ny < 0.25) continue;
                if (top - hit.d > floor) {
                    floor = top - hit.d;
                    floorKind = hit.target.kind;
                }
            }
            let best = floor;
            let bestKind = floorKind;
            if (y >= floor - 0.012) {
                let score = Math.abs(y - floor);
                for (const hit of hits) {
                    const hy = top - hit.d;
                    if (hit.target.closed || Math.abs(hit.ny) < 0.25 || hy < floor) continue;
                    const d = hy > y ? (hy - y) * 1.5 : y - hy;
                    if (d < score) {
                        score = d;
                        best = hy;
                        bestKind = hit.target.kind;
                    }
                }
            }
            const gap = y - best;
            gaps.push(gap);
            if (Math.abs(gap) < nearest) {
                nearest = Math.abs(gap);
                out.on = bestKind;
            }
        }
        if (gaps.length) {
            gaps.sort((a, b) => a - b);
            const sink = drawn.kind === "lie" ? 0.015 : Math.max(0.015, 0.08 * height);
            out.gap = held ? gaps[0] : Math.min(gaps[Math.floor(0.25 * (gaps.length - 1))], gaps[0] + sink);
            out.low = gaps[0];
        }
        // Inside a rock or a wall: its middle, and its body drawn in by a quarter, some forty points of it.
        if (drawn.kind === "stand" || drawn.kind === "lie") {
            const reach = Math.max(0.5, 1.5 * height);
            const insideAt = (x: number, y: number, z: number): string | null => {
                let first: {d: number; ny: number; target: Target} | null = null;
                for (const hit of this.cast(x, y, z, 0, 1, 0, 12, ROCK | HARD)) if (hit.target.closed && (hit.target.cls === ROCK || hit.d <= reach) && (!first || hit.d < first.d)) first = hit;
                if (!first || first.ny <= 0.2) return null;
                const kind = first.target.kind;
                if (first.target.cls === ROCK) return kind;
                first = null;
                for (const hit of this.cast(x, y, z, 0, -1, 0, reach, ROCK | HARD)) if (hit.target.closed && (!first || hit.d < first.d)) first = hit;
                return !first || first.ny <= 0.2 ? kind : null;
            };
            const middle = insideAt(cx, cy, cz);
            if (middle) {
                out.middle = true;
                out.insideOf = middle;
            }
            const step = Math.max(1, Math.floor(n / 24));
            for (let i = 0; i < n; i += step) {
                out.of++;
                const kind = insideAt(cx + (world[i * 3] - cx) * 0.75, cy + (world[i * 3 + 1] - cy) * 0.75, cz + (world[i * 3 + 2] - cz) * 0.75);
                if (kind) {
                    out.inside++;
                    out.insideOf ||= kind;
                }
            }
        }
        return out;
    }
}
