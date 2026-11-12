/**
 * The scenery modules' objects by chunk (Part B, docs/ark/streaming.md): the props lane's homes, nests, areas and
 * effects, and anything else under a tracked root, are not drawn while their chunk is past the render distance.
 *
 * The modules turn their own objects' `visible` on and off (day and night, a nest's stage, the props switch), so the
 * render distance does not touch it: an object past the distance is moved to a layer the camera does not draw (and
 * the shadow pass, which tests the same camera's layers), and put back on its own layers when it comes in range.
 * Objects bigger than a chunk across (a merged mesh, an instanced set spread over the island) are left alone.
 *
 * Nothing is walked while every chunk is drawn in full (`apply(null)`): then every object is on its own layers.
 */

import type {Object3D} from "three";
import {Sphere} from "three";

/** The layer an object past the render distance is moved to (the camera draws layer 0 only). */
export const STREAM_LAYER = 30;
/** Objects bigger than this across (m) are not culled by chunk. */
const LARGEST = 60;
/** While culling, the trees are walked again this often (s) for objects the modules added since. */
const REWALK_SECONDS = 3;

export class StreamCull {
    private readonly roots: Object3D[] = [];
    private readonly hidden = new Map<Object3D, number>();
    private drawnAt: ((x: number, z: number) => boolean) | null = null;
    private lastWalk = -Infinity;
    private readonly sphere = new Sphere();

    track(root: Object3D) {
        if (!this.roots.includes(root)) this.roots.push(root);
        if (this.drawnAt) this.walk(this.lastWalk);
    }

    /** Which points are drawn now (null: every one, nothing culled). */
    apply(drawnAt: ((x: number, z: number) => boolean) | null) {
        this.drawnAt = drawnAt;
        if (!drawnAt) {
            this.hidden.forEach((mask, object) => {
                object.layers.mask = mask;
            });
            this.hidden.clear();
            return;
        }
        this.walk(this.lastWalk);
    }

    step(now: number) {
        if (!this.drawnAt || now - this.lastWalk < REWALK_SECONDS) return;
        this.walk(now);
    }

    get culled(): number {
        return this.hidden.size;
    }

    private walk(now: number) {
        this.lastWalk = Number.isFinite(now) ? now : 0;
        const drawnAt = this.drawnAt;
        if (!drawnAt) return;
        for (const root of this.roots) {
            root.updateMatrixWorld(true);
            root.traverse((object) => {
                const mesh = object as Object3D & {geometry?: {boundingSphere: Sphere | null; computeBoundingSphere: () => void}; isInstancedMesh?: boolean};
                if (!mesh.geometry || mesh.isInstancedMesh) return;
                if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
                const bounds = mesh.geometry.boundingSphere;
                if (!bounds) return;
                this.sphere.copy(bounds).applyMatrix4(mesh.matrixWorld);
                if (!(this.sphere.radius < LARGEST / 2)) return;
                const show = drawnAt(this.sphere.center.x, this.sphere.center.z);
                const saved = this.hidden.get(mesh);
                if (show && saved !== undefined) {
                    mesh.layers.mask = saved;
                    this.hidden.delete(mesh);
                } else if (!show && saved === undefined) {
                    this.hidden.set(mesh, mesh.layers.mask);
                    mesh.layers.set(STREAM_LAYER);
                }
            });
        }
    }
}
