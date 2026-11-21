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
    private readonly lows = new WeakMap<Hull, Map<number, number>>();

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

    /** The row of a clip at which the whole posed mesh's lowest vertex is lowest (every row tried; kept per mesh and clip). */
    private lowRow(hull: Hull, pose: RigPose): number {
        const clip = pose.clip!;
        let known = this.lows.get(hull);
        if (!known) this.lows.set(hull, (known = new Map()));
        const kept = known.get(clip.row);
        if (kept !== undefined) return kept;
        const out = new Float32Array(hull.vertices.length * 3);
        const at: RigPose = {...pose, live: null, liveRow: -1, fromWeight: 0, weight: 1, t: 0, clip: null};
        let best = clip.row;
        let least = Infinity;
        for (let r = 0; r < Math.max(clip.rows, 1); r++) {
            at.row0 = at.row1 = clip.row + r;
            const n = posedHull(hull, at, out);
            let low = Infinity;
            for (let i = 0; i < n; i++) low = Math.min(low, out[i * 3 + 1]);
            if (low < least) {
                least = low;
                best = clip.row + r;
            }
        }
        known.set(clip.row, best);
        return best;
    }

    measure(drawn: SeatDrawn): SeatMeasure {
        const hull = fullHull(drawn.geometry);
        const model = new Float32Array(hull.vertices.length * 3);
        // (A still animal in a clip of its own is measured at the clip's lowest frame: its bob is its motion.)
        let pose = drawn.pose;
        if (pose && pose.clip && pose.baked) {
            const low = this.lowRow(hull, pose);
            pose = {...pose, live: null, liveRow: -1, row0: low, row1: low, t: 0, fromWeight: 0, weight: 1, clip: null};
        }
        const n = posedHull(hull, pose, model);
        const e = drawn.m;
        const sway = drawn.surface?.sway;
        const world = new Float32Array(n * 3);
        let cx = 0;
        let cy = 0;
        let cz = 0;
        let x0 = Infinity;
        let y0 = Infinity;
        let z0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        let z1 = -Infinity;
        for (let i = 0; i < n; i++) {
            const x = model[i * 3];
            const y = model[i * 3 + 1];
            const z = model[i * 3 + 2];
            const wx = (world[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12] - (sway?.x ?? 0));
            const wy = (world[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13] - (sway?.y ?? 0));
            const wz = (world[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14] - (sway?.z ?? 0));
            cx += wx;
            cy += wy;
            cz += wz;
            x0 = Math.min(x0, wx);
            y0 = Math.min(y0, wy);
            z0 = Math.min(z0, wz);
            x1 = Math.max(x1, wx);
            y1 = Math.max(y1, wy);
            z1 = Math.max(z1, wz);
        }
        cx /= n;
        cy /= n;
        cz /= n;
        const height = Math.max(drawn.height, 0.002);
        const length = Math.max(drawn.length, 0.002);
        const out: SeatMeasure = {kind: drawn.kind, level: drawn.level, gap: null, low: null, on: "", inside: 0, of: 0, middle: false, insideOf: "", points: 0};
        if (drawn.kind !== "stand" && drawn.kind !== "lie" && drawn.kind !== "perch" && drawn.kind !== "cling") return out;
        const held = drawn.kind === "perch" || drawn.kind === "cling";
        const up = Math.min(Math.max(0.75 * height, 0.03), 1);
        const mask = held || length <= 0.08 ? ROCK | HARD | TREE | SOFT : ROCK | HARD;
        // The scene's triangles round its body: under it down to the ground, over it as far as a rock's top is looked for.
        const pad = drawn.kind === "cling" ? Math.max(0.3, 1.6 * height) + 1 : 0.02;
        const under = Math.min(y0, this.ground(cx, cz, cy), this.ground(x0, z0, cy), this.ground(x1, z1, cy), this.ground(x0, z1, cy), this.ground(x1, z0, cy)) - 0.5;
        this.gather(x0 - pad, under, z0 - pad, x1 + pad, y1 + 12.5, z1 + pad, ROCK | HARD | TREE | SOFT);
        /** Its seat's gap measured along a way off the surface (up, or a face's normal): the gap, its lowest point's, what it is on. */
        const seat = (ax: number, ay: number, az: number, face: boolean): {gap: number; low: number; on: string; points: number} | null => {
            const along = (i: number) => world[i * 3] * ax + world[i * 3 + 1] * ay + world[i * 3 + 2] * az;
            let least = Infinity;
            for (let i = 0; i < n; i++) least = Math.min(least, along(i));
            const band = Math.max(0.004, 0.05 * height);
            const lowest: number[] = [];
            for (let i = 0; i < n; i++) if (along(i) <= least + band) lowest.push(i);
            lowest.sort((a, b) => along(a) - along(b));
            const points: Array<[number, number, number]> = [];
            if (held) {
                // Held: every one of its lowest vertices (some forty), its middle, and round its middle.
                const step = Math.max(1, Math.floor(lowest.length / 40));
                for (let k = 0; k < lowest.length; k += step) points.push([world[lowest[k] * 3], world[lowest[k] * 3 + 1], world[lowest[k] * 3 + 2]]);
                const lift = cx * ax + cy * ay + cz * az - least;
                const middle: [number, number, number] = [cx - ax * lift, cy - ay * lift, cz - az * lift];
                points.push(middle);
                for (const [dx, dy, dz] of [[0.18 * (x1 - x0), 0, 0], [-0.18 * (x1 - x0), 0, 0], face ? [0, 0.18 * (y1 - y0), 0] : [0, 0, 0.18 * (z1 - z0)], face ? [0, -0.18 * (y1 - y0), 0] : [0, 0, -0.18 * (z1 - z0)]]) {
                    const off = dx * ax + dy * ay + dz * az;
                    points.push([middle[0] + dx - ax * off, middle[1] + dy - ay * off, middle[2] + dz - az * off]);
                }
            } else {
                // On its feet: its lowest vertices, eight of them, apart.
                const picked: number[] = [];
                for (const i of lowest) {
                    if (picked.length >= 8) break;
                    if (picked.every((j) => Math.hypot(world[i * 3] - world[j * 3], world[i * 3 + 1] - world[j * 3 + 1], world[i * 3 + 2] - world[j * 3 + 2]) > 0.12 * length)) picked.push(i);
                }
                for (const i of picked) points.push([world[i * 3], world[i * 3 + 1], world[i * 3 + 2]]);
            }
            const gaps: number[] = [];
            let chosen: {gap: number; on: string} | null = null;
            for (const [x, y, z] of points) {
                let gap: number | null = null;
                let on = "ground";
                if (face) {
                    const down = Math.max(0.25, 1.5 * height);
                    for (const hit of this.cast(x + ax * up, y + ay * up, z + az * up, -ax, -ay, -az, up + down, mask)) {
                        const facing = hit.nx * ax + hit.ny * ay + hit.nz * az;
                        if ((hit.target.closed ? facing : Math.abs(facing)) < 0.25) continue;
                        if (gap === null || Math.abs(hit.d - up) < Math.abs(gap)) {
                            gap = hit.d - up;
                            on = hit.target.kind;
                        }
                    }
                    if (gap === null && ay > 0.15) {
                        const g = (y - this.ground(x, z, y)) * ay;
                        if (Math.abs(g) < down) gap = g;
                    }
                } else {
                    const ground = this.ground(x, z, y);
                    const top = y + (held ? 12 : up);
                    const bottom = Math.min(y, ground) - 0.02;
                    const hits = top > bottom ? this.cast(x, top, z, 0, -1, 0, top - bottom, mask) : [];
                    // The ground, and the top of anything closed within a step's reach over the point (any face met from above).
                    let floor = ground;
                    let over: {y: number; ny: number; target: Target} | null = null;
                    for (const hit of hits) {
                        const hy = top - hit.d;
                        if (!hit.target.closed) continue;
                        if (hit.ny > 0 && hy <= y + up) {
                            if (hy > floor) {
                                floor = hy;
                                on = hit.target.kind;
                            }
                        } else if (hy > y + up && (!over || hy < over.y)) over = {y: hy, ny: hit.ny, target: hit.target};
                    }
                    // (Held, with a rock's top the first closed face over the point: the point is in the rock.)
                    if (held && over && over.target.cls === ROCK && over.ny > 0.2 && over.y > floor) {
                        floor = over.y;
                        on = over.target.kind;
                    }
                    let best = floor;
                    if (y >= floor - 0.012) {
                        let score = Math.abs(y - floor);
                        for (const hit of hits) {
                            const hy = top - hit.d;
                            if (hit.target.closed || Math.abs(hit.ny) < 0.25 || hy < floor || hy > y + up) continue;
                            const d = hy > y ? (hy - y) * 1.5 : y - hy;
                            if (d < score) {
                                score = d;
                                best = hy;
                                on = hit.target.kind;
                            }
                        }
                    }
                    gap = y - best;
                }
                if (gap === null) continue;
                gaps.push(gap);
                if (!chosen || Math.abs(gap) < Math.abs(chosen.gap)) chosen = {gap, on};
            }
            if (!gaps.length || !chosen) return null;
            gaps.sort((a, b) => a - b);
            const sink = drawn.kind === "lie" ? 0.015 : Math.max(0.015, 0.08 * height);
            // (Held: the best of its contacts. On its feet: a quarter of them may be a little in.)
            let gap = held ? chosen.gap : Math.min(gaps[Math.floor(0.25 * (gaps.length - 1))], gaps[0] + sink);
            if (!face) {
                // Every part of its body against the closed things round it: some forty of its vertices, and its middle.
                const reach = Math.max(0.5, 1.5 * height);
                const clearAt = (x: number, y: number, z: number): {clear: number; kind: string} => {
                    const below = Math.max(gap, 0) + 0.02;
                    let top = -Infinity;
                    let kind = "";
                    let over: {y: number; ny: number; target: Target} | null = null;
                    for (const hit of this.cast(x, y + 12, z, 0, -1, 0, 12 + below, ROCK | HARD)) {
                        if (!hit.target.closed) continue;
                        const hy = y + 12 - hit.d;
                        if (hy <= y + up) {
                            if (hit.ny > 0 && hy > top) {
                                top = hy;
                                kind = hit.target.kind;
                            }
                        } else if (!over || hy < over.y) over = {y: hy, ny: hit.ny, target: hit.target};
                    }
                    let clear = top > -Infinity ? y - top : Infinity;
                    if (over && over.ny > 0.2) {
                        let inIt = over.target.cls === ROCK;
                        if (!inIt && over.y - y <= reach) {
                            // (Built: only with no floor or top it stands over under it.)
                            let first: {d: number; ny: number} | null = null;
                            for (const hit of this.cast(x, y, z, 0, -1, 0, reach, ROCK | HARD)) if (hit.target.closed && (!first || hit.d < first.d)) first = hit;
                            inIt = !first || first.ny <= 0.2;
                        }
                        if (inIt) {
                            clear = y - over.y;
                            kind = over.target.kind;
                        }
                    }
                    return {clear, kind};
                };
                let closed = Infinity;
                const step = Math.max(1, Math.floor(n / 40));
                for (let i = 0; i < n; i += step) {
                    const at = clearAt(world[i * 3], world[i * 3 + 1], world[i * 3 + 2]);
                    out.of++;
                    if (at.clear < -0.03) {
                        out.inside++;
                        out.insideOf ||= at.kind;
                    }
                    closed = Math.min(closed, at.clear);
                }
                const middle = clearAt(cx, cy, cz);
                if (middle.clear < -0.03) {
                    out.middle = true;
                    out.insideOf ||= middle.kind;
                }
                // (Up out of it is its seat when that is a step's height or it is held there; deeper, it is inside: counted above.)
                if (closed < gap && (held || closed >= -Math.max(up, 0.3 * height))) gap = closed;
            }
            return {gap, low: gaps[0], on: chosen.on, points: points.length};
        };
        const onFace = drawn.kind === "cling" && drawn.surface !== null;
        let found: ReturnType<typeof seat> = null;
        if (onFace && drawn.surface) {
            const l = Math.hypot(drawn.surface.nx, drawn.surface.ny, drawn.surface.nz) || 1;
            found = seat(drawn.surface.nx / l, drawn.surface.ny / l, drawn.surface.nz / l, true);
        }
        // (On a face that is not drawn: what is under it instead; in the air there too, it is not seated.)
        found ??= seat(0, 1, 0, false);
        if (found) {
            out.gap = found.gap;
            out.low = found.low;
            out.on = found.on;
            out.points = found.points;
        }
        return out;
    }
}
