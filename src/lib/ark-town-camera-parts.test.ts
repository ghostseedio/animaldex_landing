import assert from "node:assert/strict";
import test from "node:test";
import {Vector3} from "three";
import {CAMERA_RANGE, CameraObstacles, collideCamera, inside} from "@/ark-scene/runtime/camera";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {buildingCameraBoxes, buildingParts, cameraBuildings, drawnParts, mergeParts, PART_OUT, townBuildingCamera} from "@/ark-scene/islands/town/render/building-parts";
import type {Building} from "@/ark-scene/islands/town/plan";

/** Where `p` (town coordinates) is in `b`'s frame: x along its front, z out of it. */
function local(b: Building, p: {x: number; z: number}): {x: number; z: number} {
    const dx = p.x - b.at.x;
    const dz = p.z - b.at.z;
    const c = Math.cos(b.at.rot);
    const s = Math.sin(b.at.rot);
    return {x: dx * c + dz * s, z: -dx * s + dz * c};
}

function world(b: Building, lx: number, lz: number): {x: number; z: number} {
    const c = Math.cos(b.at.rot);
    const s = Math.sin(b.at.rot);
    return {x: b.at.x + lx * c - lz * s, z: b.at.z + lx * s + lz * c};
}

/** Inside one of the boxes (building frame), by more than `by` on every side. */
function insideAny(boxes: number[][], b: Building, p: {x: number; y: number; z: number}, by = 0.01): number[] | null {
    const q = local(b, p);
    for (const k of boxes) if (q.x > k[0] + by && q.x < k[1] - by && p.y > k[2] + by && p.y < k[3] - by && q.z > k[4] + by && q.z < k[5] - by) return k;
    return null;
}

/** How far `p` is from the box (building frame), 0 inside. */
function gap(k: number[], b: Building, p: {x: number; y: number; z: number}): number {
    const q = local(b, p);
    const out = (v: number, low: number, high: number) => Math.max(low - v, 0, v - high);
    return Math.hypot(out(q.x, k[0], k[1]), out(p.y, k[2], k[3]), out(q.z, k[4], k[5]));
}

/** The first of the boxes (building frame, shrunk by 2 cm) the line from `p` to `q` passes through, away from its ends. */
function hides(boxes: number[][], b: Building, p: {x: number; y: number; z: number}, q: {x: number; y: number; z: number}): number[] | null {
    const a = local(b, p);
    const c = local(b, q);
    for (const k of boxes) {
        let t0 = 0.02;
        let t1 = 0.98;
        let out = false;
        for (const [from, to, low, high] of [[a.x, c.x, k[0] + 0.02, k[1] - 0.02], [p.y, q.y, k[2] + 0.02, k[3] - 0.02], [a.z, c.z, k[4] + 0.02, k[5] - 0.02]] as const) {
            const d = to - from;
            if (Math.abs(d) < 1e-9) {
                if (from <= low || from >= high) out = true;
                continue;
            }
            const u0 = Math.min((low - from) / d, (high - from) / d);
            const u1 = Math.max((low - from) / d, (high - from) / d);
            t0 = Math.max(t0, u0);
            t1 = Math.min(t1, u1);
        }
        if (!out && t0 < t1) return k;
    }
    return null;
}

/**
 * A user orbiting a point just off each face of `b` (past its farthest part on that side: a cat on the lawn by a bay)
 * at the nearest the controls allow (`CAMERA_RANGE.near`), low and lower, round a whole turn in steps, the controls
 * and the scene's collision every frame as the page has them (OrbitControls keeps the radius at least the minimum
 * from where the eye is; `collideCamera` then moves it). After each step, held still for half a second (a glide
 * through a wall is the design: the view comes through toward its target), the eye must be inside nothing drawn.
 * Returns the places where it was (empty when none).
 */
function orbitInto(b: Building, obstacles: CameraObstacles): string[] {
    const drawn = drawnParts(b);
    const bad: string[] = [];
    const reach = (side: number) => {
        // How far the drawing reaches out of the face on that side (0 front +z, 1 right +x, 2 back -z, 3 left -x).
        let far = side % 2 === 0 ? b.at.d / 2 : b.at.w / 2;
        for (const k of drawn) far = Math.max(far, side === 0 ? k[5] : side === 1 ? k[1] : side === 2 ? -k[4] : -k[0]);
        return far;
    };
    for (let side = 0; side < 4; side++) {
        const out = reach(side) + 1.0;
        const along = side % 2 === 0 ? b.at.w : b.at.d;
        for (const t of along > 8 ? [-0.3, 0, 0.3] : [0]) {
            const u = t * along;
            const [lx, lz] = side === 0 ? [u, out] : side === 1 ? [out, u] : side === 2 ? [u, -out] : [-out, u];
            const at = world(b, lx, lz);
            const target = new Vector3(at.x, townHeight(at.x, at.z) + 0.5, at.z);
            // (Not a point inside a building: this one's drawing, or a neighbour's box, a semi-detached half.)
            if (insideAny(drawn, b, target, 0) || obstacles.near(target.x, target.z).some((o) => inside(o, target, 0.05))) continue;
            for (const polar of [1.0, 1.36]) {
                // From straight out, round a whole turn in 24 steps.
                const face = Math.atan2(at.x - b.at.x, at.z - b.at.z);
                const eye = new Vector3(target.x + Math.sin(polar) * Math.sin(face) * CAMERA_RANGE.near, target.y + Math.cos(polar) * CAMERA_RANGE.near, target.z + Math.sin(polar) * Math.cos(face) * CAMERA_RANGE.near);
                // The controls' minimum: `index.ts` fitCloseUp eases it back up to the usual 4 m; after the collision it
                // is held at the eye's distance when the eye came nearer (through a building toward its target).
                let minDistance: number = CAMERA_RANGE.near;
                for (let step = 1; step <= 24; step++) {
                    for (let frame = 0; frame < 31; frame++) {
                        // OrbitControls: the offset's angles (turned on the first frame of a step), its radius at least the minimum.
                        const off = eye.clone().sub(target);
                        const radius = Math.max(off.length(), minDistance);
                        const theta = Math.atan2(off.x, off.z) + (frame === 0 ? (Math.PI * 2) / 24 : 0);
                        const phi = Math.min(Math.max(Math.acos(Math.min(Math.max(off.y / (off.length() || 1), -1), 1)), 0.12), 1.36);
                        eye.set(target.x + radius * Math.sin(phi) * Math.sin(theta), target.y + radius * Math.cos(phi), target.z + radius * Math.sin(phi) * Math.cos(theta));
                        // (`index.ts` frame: controls.update, then fitCloseUp eases the minimum, then the collision.)
                        minDistance += (CAMERA_RANGE.near - minDistance) * 0.05;
                        const clearance = Math.min(Math.max(eye.distanceTo(target) * 0.25, 0.03), 1.2);
                        collideCamera(obstacles, eye, target, {dt: 1 / 60, diving: false, clearance, closeUp: false, ground: townHeight});
                        const held = eye.distanceTo(target);
                        if (held < minDistance) minDistance = Math.max(held, 1);
                    }
                    const hit = insideAny(drawn, b, eye);
                    // And what it looks at in sight: the line to it through none of this building's drawn parts.
                    // (A part within 2 m of the eye: one it was pushed against, as `camera.ts` liftForSight. Further off,
                    // a building between the view and its target hides it as anything would.)
                    const hidden = !hit && hides(drawn.filter((k) => gap(k, b, eye) < 2), b, eye, target);
                    if (hidden) bad.push(`${b.id} side ${side} polar ${polar} step ${step}: the target hidden from ${eye.x.toFixed(2)},${eye.y.toFixed(2)},${eye.z.toFixed(2)} by part ${hidden.map((v) => v.toFixed(2)).join(",")}`);
                    if (hit) bad.push(`${b.id} side ${side} polar ${polar} step ${step}: eye ${eye.x.toFixed(2)},${eye.y.toFixed(2)},${eye.z.toFixed(2)} in part ${hit.map((v) => v.toFixed(2)).join(",")}`);
                }
            }
        }
    }
    return bad;
}

test("parts stacked storey on storey become one box, and a part on a bigger one is dropped", () => {
    const slab = (y: number) => [-3, 3, y, y + 0.3, 5, 7.9];
    const merged = mergeParts([slab(0), slab(3), slab(6), [-2.9, 2.9, 6.3, 7.3, 7.7, 7.8], [-0.05, 0.05, 1, 2, 7.6, 7.8]]);
    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0].slice(2, 4), [0, 7.3]);
    // Two parts apart on the plan stay two.
    assert.equal(mergeParts([[-3, -1, 0, 2, 5, 6], [1, 3, 0, 2, 5, 6]]).length, 2);
});

test("a home's bay window and front step are among its parts", () => {
    const homes = cameraBuildings().filter((b) => b.kind === "house" || b.kind === "terrace");
    // (A bay: 2 to 2.3 m wide, 0.8 to 0.9 m out of the front, a storey high; with its little roof and sills, a little more.)
    const bays = homes.flatMap((b) => buildingParts(b).map((p) => ({b, p})).filter(({p}) => p.hx * 2 >= 1.9 && p.hx * 2 <= 2.7 && p.hz * 2 >= 0.7 && p.hz * 2 <= 1.3 && p.y1 - p.y0 > 1.5));
    assert.ok(bays.length > 10, `bays: ${bays.length}`);
    for (const {b, p} of bays) assert.ok(local(b, p).z > b.at.d / 2, `${b.id}: the bay is out of the front`);
});

test("every part reaches out of its footprint, and none is drawn that the parts miss", () => {
    for (const b of cameraBuildings()) {
        const parts = buildingParts(b);
        const boxes = parts.map((p) => {
            const m = local(b, p);
            return [m.x - p.hx, m.x + p.hx, p.y0, p.y1, m.z - p.hz, m.z + p.hz];
        });
        for (const k of drawnParts(b)) {
            if (k[0] >= -b.at.w / 2 - PART_OUT && k[1] <= b.at.w / 2 + PART_OUT && k[4] >= -b.at.d / 2 - PART_OUT && k[5] <= b.at.d / 2 + PART_OUT) continue;
            const E = PART_OUT + 1e-6;
            assert.ok(boxes.some((q) => k[0] >= q[0] - E && k[1] <= q[1] + E && k[2] >= q[2] - E && k[3] <= q[3] + E && k[4] >= q[4] - E && k[5] <= q[5] + E), `${b.id}: a drawn part ${k.map((v) => v.toFixed(2))} is in no camera part`);
        }
    }
});

test("for every building, a user's eye orbiting at the minimum distance comes to rest inside nothing drawn, its target in sight", () => {
    const obstacles = new CameraObstacles([], buildingCameraBoxes({x: 0, z: 0}, townHeight, townBuildingCamera()));
    const bad = cameraBuildings().flatMap((b) => orbitInto(b, obstacles));
    assert.deepEqual(bad.slice(0, 12), [], `${bad.length} resting eyes inside a building's drawing`);
});
