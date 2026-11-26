/**
 * Whether the camera is among plants, or looks at an animal through them (the camera director, `lib/ark-watch.ts`,
 * 2026-11-27). A ray test is the wrong question for leaves: a crown is leaf cards with gaps, so the line to an animal's
 * middle slips through while most of the picture is leaves (a Great Kiskadee in a town garden's apple tree). So each
 * plant (and rock) is taken as its box, a little smaller than its drawn bounds: the eye inside one, or the line from
 * the eye to the animal through one, is "among plants". The instanced sets are read straight from their instance
 * arrays (a quick distance test from each instance's middle to the line first; the box only for the few near it), so a
 * check over every plant on an island is well under a millisecond. Nothing here draws or moves anything.
 */

import {Box3, Matrix4, Vector3, type BufferGeometry, type InstancedMesh, type Mesh, type Object3D} from "three";
import {solid} from "./sight";

/** A plant's box is its drawn bounds shrunk to this share each way (a crown's outer leaves are sparse). */
const SHRINK = 0.8;
/** Smaller than this (m, its bounds' radius) is not in the way: flowers, pebbles, tufts. */
const LEAST_RADIUS = 0.25;
/** Thinner than this (m) one way is flat: a panel, not a plant. */
const FLAT = 0.15;

type PlantSet = {mesh: InstancedMesh; box: Box3; centre: Vector3; radius: number};

const LOCAL = new Matrix4();
const WORLD = new Matrix4();
const A = new Vector3();
const B = new Vector3();
const C = new Vector3();

/** The squared distance from `p` to the segment a→b. */
export function segmentDistanceSq(p: Vector3, a: Vector3, b: Vector3): number {
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const len = abx * abx + aby * aby + abz * abz;
    let t = len > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / len : 0;
    t = Math.min(Math.max(t, 0), 1);
    const dx = a.x + abx * t - p.x, dy = a.y + aby * t - p.y, dz = a.z + abz * t - p.z;
    return dx * dx + dy * dy + dz * dz;
}

/** Whether the segment a→b passes through the box (or starts inside it): the slab test. */
export function segmentCrossesBox(a: Vector3, b: Vector3, box: Box3): boolean {
    let lo = 0;
    let hi = 1;
    for (const axis of ["x", "y", "z"] as const) {
        const d = b[axis] - a[axis];
        const min = box.min[axis];
        const max = box.max[axis];
        if (Math.abs(d) < 1e-9) {
            if (a[axis] < min || a[axis] > max) return false;
            continue;
        }
        let t0 = (min - a[axis]) / d;
        let t1 = (max - a[axis]) / d;
        if (t0 > t1) [t0, t1] = [t1, t0];
        lo = Math.max(lo, t0);
        hi = Math.min(hi, t1);
        if (lo > hi) return false;
    }
    return true;
}

export class PlantBoxes {
    private sets: PlantSet[] = [];
    private gatheredAt = -Infinity;
    /** Instances looked at closely in the last check (the probes read it). */
    near = 0;

    constructor(private readonly root: Object3D) {}

    /** The instanced sets drawn solid now (again every few seconds: chunks stream in and out). */
    private gather(now: number): void {
        if (now - this.gatheredAt < 5) return;
        this.gatheredAt = now;
        const sets: PlantSet[] = [];
        const visit = (o: Object3D) => {
            if (!o.visible) return;
            const mesh = o as InstancedMesh;
            if (mesh.isInstancedMesh && mesh.count > 0 && solid(mesh as unknown as Mesh, true)) {
                const geometry = mesh.geometry as BufferGeometry;
                if (!geometry.boundingBox) geometry.computeBoundingBox();
                const box = geometry.boundingBox!.clone();
                const centre = box.getCenter(new Vector3());
                const size = box.getSize(new Vector3());
                box.min.copy(centre).addScaledVector(size, -SHRINK / 2);
                box.max.copy(centre).addScaledVector(size, SHRINK / 2);
                const radius = size.length() / 2;
                // (Flat things, a fence's panel, a sign, a wall's piece, are not leaves: the line test counts what is solid of them.)
                if (radius >= LEAST_RADIUS && Math.min(size.x, size.y, size.z) >= FLAT) sets.push({mesh, box, centre, radius});
            }
            for (const child of o.children) visit(child);
        };
        visit(this.root);
        this.sets = sets;
    }

    /**
     * How the eye stands to the plants: "inside" one, looking at `to` "through" one (short of `slack` m before it: the
     * animal's own perch), or "clear".
     */
    check(eye: Vector3, to: Vector3, slack: number, now: number): "inside" | "through" | "clear" {
        this.gather(now);
        this.near = 0;
        const span = eye.distanceTo(to);
        const end = span > slack ? C.copy(to).sub(eye).multiplyScalar((span - slack) / span).add(eye) : C.copy(eye);
        let through = false;
        for (const set of this.sets) {
            const array = set.mesh.instanceMatrix.array as ArrayLike<number>;
            const world = set.mesh.matrixWorld;
            for (let i = 0; i < set.mesh.count; i++) {
                const o = i * 16;
                // (Its middle and its reach in the world, from the matrix's own numbers: a scale is the length of a column.)
                const scale = Math.hypot(array[o], array[o + 1], array[o + 2]);
                A.set(array[o + 12], array[o + 13], array[o + 14]).applyMatrix4(world);
                const reach = (set.radius + set.centre.length()) * scale;
                if (segmentDistanceSq(A, eye, end) > reach * reach) continue;
                this.near++;
                // The line in the instance's own frame, against its box.
                LOCAL.fromArray(array as number[], o);
                WORLD.multiplyMatrices(world, LOCAL).invert();
                A.copy(eye).applyMatrix4(WORLD);
                B.copy(end).applyMatrix4(WORLD);
                if (set.box.containsPoint(A)) return "inside";
                if (!through && segmentCrossesBox(A, B, set.box)) through = true;
            }
        }
        return through ? "through" : "clear";
    }
}
