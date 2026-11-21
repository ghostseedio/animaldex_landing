/**
 * ARK-SEAT's audit probe (development only: `scripts/ark-seat-audit.mjs` calls it through `window.__arkSeatProbe`).
 *
 * It measures what the seat pass promises, without the pass's own machinery: every vertex of the animal's mesh posed
 * as its shader poses it (not the hull's few), and three's own Raycaster against the scene's meshes as they are
 * (every instance, both faces), not the pass's grids. It shares only the rules: which drawn things hold which
 * animals, and what "resting on" means (`seat.ts`). A mesh the rules do not know is taken as solid, so a new kind of
 * scenery an animal sinks into fails here before anyone names it.
 */

import {DoubleSide, Matrix3, Matrix4, Raycaster, Vector3, type BufferAttribute, type BufferGeometry, type InstancedMesh, type Material, type Mesh, type Object3D} from "three";
import {HARD, ROCK, SOFT, TREE, solidClass, solidLabel} from "@/ark-scene/seat/solids";
import {posedHull, type Hull, type RigPose} from "@/ark-scene/seat/support";
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

type Target = {mesh: Mesh; cls: number; kind: string; closed: boolean; side: number};

export class SeatProbe {
    private targets: Target[] = [];
    private readonly ray = new Raycaster();
    private readonly origin = new Vector3();
    private readonly direction = new Vector3();
    private readonly normal = new Vector3();
    private readonly normalMatrix = new Matrix3();
    private readonly instance = new Matrix4();
    private open = false;

    constructor(private readonly scene: Object3D, private readonly ground: (x: number, z: number, near?: number) => number) {}

    /** Before a batch of measures: the scene's meshes as they are now, both faces of each open to the rays. */
    begin(): {meshes: number; unknown: string[]} {
        this.end();
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
                    targets.push({mesh, cls, kind: label, closed: material.side !== DoubleSide && cls !== SOFT && cls !== TREE, side: material.side});
                }
            }
            for (const child of object.children) walk(child, visible);
        };
        walk(this.scene, true);
        for (const target of targets) for (const material of Array.isArray(target.mesh.material) ? target.mesh.material : [target.mesh.material]) (material as Material).side = DoubleSide;
        // (An instanced mesh keeps the sphere of the instances it had when first asked: made again for those drawn now.)
        for (const target of targets) if ((target.mesh as InstancedMesh).isInstancedMesh) (target.mesh as InstancedMesh).boundingSphere = null;
        this.targets = targets;
        this.open = true;
        return {meshes: targets.length, unknown: Array.from(unknown).sort()};
    }

    /** After the batch: the materials' faces as they were (before the next frame is drawn). */
    end(): void {
        if (!this.open) return;
        for (const target of this.targets) for (const material of Array.isArray(target.mesh.material) ? target.mesh.material : [target.mesh.material]) (material as Material).side = target.side as Material["side"];
        this.open = false;
    }

    /** Every face a segment crosses: where along it (m), the face's normal's height in the world, its target. */
    private cast(x: number, y: number, z: number, dx: number, dy: number, dz: number, length: number, mask: number): Array<{d: number; nx: number; ny: number; nz: number; target: Target}> {
        this.ray.set(this.origin.set(x, y, z), this.direction.set(dx, dy, dz));
        this.ray.near = 0;
        this.ray.far = length;
        const out: Array<{d: number; nx: number; ny: number; nz: number; target: Target}> = [];
        for (const target of this.targets) {
            if (!(target.cls & mask)) continue;
            for (const hit of this.ray.intersectObject(target.mesh, false)) {
                if (!hit.face) continue;
                const mesh = target.mesh as InstancedMesh;
                if (mesh.isInstancedMesh && hit.instanceId !== undefined) {
                    mesh.getMatrixAt(hit.instanceId, this.instance);
                    this.instance.premultiply(mesh.matrixWorld);
                } else this.instance.copy(mesh.matrixWorld);
                this.normal.copy(hit.face.normal).applyMatrix3(this.normalMatrix.getNormalMatrix(this.instance)).normalize();
                out.push({d: hit.distance, nx: this.normal.x, ny: this.normal.y, nz: this.normal.z, target});
            }
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
        out.points = support.length;
        const held = drawn.kind === "perch" || drawn.kind === "cling";
        const mask = held || length <= 0.08 ? ROCK | HARD | TREE | SOFT : ROCK | HARD;
        const up = Math.min(Math.max(0.75 * height, 0.03), 1);
        const gaps: number[] = [];
        let nearest = Infinity;
        for (const i of support) {
            const x = world[i * 3];
            const y = world[i * 3 + 1];
            const z = world[i * 3 + 2];
            if (cling) {
                const down = Math.max(0.25, 1.5 * height);
                let best: number | null = null;
                for (const hit of this.cast(x + ax * up, y + ay * up, z + az * up, -ax, -ay, -az, up + down, mask)) {
                    const facing = hit.nx * ax + hit.ny * ay + hit.nz * az;
                    if ((hit.target.closed ? facing : Math.abs(facing)) < 0.25) continue;
                    const gap = up - hit.d;
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
            out.gap = Math.min(gaps[Math.floor(0.25 * (gaps.length - 1))], gaps[0] + sink);
            out.low = gaps[0];
        }
        // Inside a rock or a wall: its middle, and its body drawn in by a quarter, some forty points of it.
        if (drawn.kind === "stand" || drawn.kind === "lie") {
            const reach = Math.max(0.5, 1.5 * height);
            const insideAt = (x: number, y: number, z: number): string | null => {
                let first: {d: number; ny: number; target: Target} | null = null;
                for (const hit of this.cast(x, y, z, 0, 1, 0, reach, ROCK | HARD)) if (hit.target.closed && (!first || hit.d < first.d)) first = hit;
                if (!first || first.ny <= 0.2) return null;
                const kind = first.target.kind;
                first = null;
                for (const hit of this.cast(x, y, z, 0, -1, 0, reach, ROCK | HARD)) if (hit.target.closed && (!first || hit.d < first.d)) first = hit;
                return !first || first.ny <= 0.2 ? kind : null;
            };
            const middle = insideAt(cx, cy, cz);
            if (middle) {
                out.middle = true;
                out.insideOf = middle;
            }
            const step = Math.max(1, Math.floor(n / 40));
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
