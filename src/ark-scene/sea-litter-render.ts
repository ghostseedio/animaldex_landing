/**
 * The sea bed's small things, drawn (3.3 batch, lane E; rules in `sea-litter.ts`): one instanced mesh of a squashed,
 * faceted pebble (20 triangles) fitted per instance into a shell, a pebble or a piece of broken coral (one draw call;
 * 1,600 instances on the high tier, 700 on the medium, none on the low). Filled again only when the camera moves into
 * another 4 m cell; no allocation per frame. Owned by `SeaLookView`: built on the first dive, let go after surfacing.
 */

import {Color, Euler, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Camera, type Object3D} from "three";
import type {QualityTier} from "@/ark-scene/post";
import {LITTER_CELL, LITTER_COUNT, LITTER_REACH, litterInCell} from "@/ark-scene/sea-litter";

export class SeaLitterView {
    private readonly mesh: InstancedMesh | null;
    private cell = "";
    private readonly matrix = new Matrix4();
    private readonly position = new Vector3();
    private readonly scale = new Vector3();
    private readonly quaternion = new Quaternion();
    private readonly euler = new Euler();
    private readonly colour = new Color();

    constructor(private readonly parent: Object3D, tier: QualityTier) {
        const count = LITTER_COUNT[tier];
        this.mesh = null;
        if (!count) return;
        const geometry = new IcosahedronGeometry(1, 0);
        // (Its base on y = 0: it lies on the bed, a little into it.)
        geometry.translate(0, 0.7, 0);
        this.mesh = new InstancedMesh(geometry, new MeshStandardMaterial({roughness: 0.9, metalness: 0, flatShading: true}), count);
        this.mesh.count = 0;
        this.mesh.name = "sea-litter";
        this.mesh.frustumCulled = false;
        parent.add(this.mesh);
    }

    step(visible: boolean, camera: Camera): void {
        const mesh = this.mesh;
        if (!mesh) return;
        mesh.visible = visible;
        if (!visible) return;
        const ci = Math.floor(camera.position.x / LITTER_CELL);
        const cj = Math.floor(camera.position.z / LITTER_CELL);
        const key = `${ci},${cj}`;
        if (key === this.cell) return;
        this.cell = key;
        const reach = Math.ceil(LITTER_REACH / LITTER_CELL);
        let n = 0;
        const capacity = mesh.instanceMatrix.count;
        // Nearest cells first (rings outward), so a full mesh drops the far ones.
        for (let ring = 0; ring <= reach && n < capacity; ring++) {
            for (let di = -ring; di <= ring && n < capacity; di++) {
                for (let dj = -ring; dj <= ring && n < capacity; dj++) {
                    if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
                    for (const item of litterInCell(ci + di, cj + dj)) {
                        if (n >= capacity) break;
                        this.position.set(item.x, item.y - item.sy * 0.25, item.z);
                        this.quaternion.setFromEuler(this.euler.set(item.tilt, item.yaw, item.tilt * 0.6));
                        this.matrix.compose(this.position, this.quaternion, this.scale.set(item.sx, item.sy, item.sz));
                        mesh.setMatrixAt(n, this.matrix);
                        mesh.setColorAt(n, this.colour.setRGB(item.r, item.g, item.b, "srgb"));
                        n++;
                    }
                }
            }
        }
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    dispose(): void {
        if (!this.mesh) return;
        this.parent.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as MeshStandardMaterial).dispose();
        this.mesh.dispose();
    }
}
