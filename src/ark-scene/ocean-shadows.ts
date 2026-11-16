/**
 * The open ocean's animals seen from above (graphics pass 2, lane OCEAN): a whale cruising four metres down is a dark
 * shape in the water from a boat or a cliff, not nothing. The sea's surface is opaque over the open ocean (its alpha
 * comes from the floor's depth, 110 m there), so an animal under it was not seen at all from above. Each open-ocean
 * animal (`open-ocean.ts`) draws a soft dark shape of its own outline on the water over it: as long and as wide as its
 * body (its model's own proportions, `collide/bodies.ts`), along its heading, darkest when it is just under the surface
 * and gone by `SHADE_GONE` m down. From under the sea it is not drawn (the animal itself is seen there).
 *
 * And a whale's blow: a cetacean up at the surface on its breath (`sea-depth.ts`, its schedule's breathe trip) sends up
 * a plume of mist from its head, rising and spreading as it breathes out (`blowPlume`), then gone.
 *
 * Two instanced meshes (two draw calls, transparent, after the sea's surface): 80 triangles a shape, 24 a plume; at
 * most `SHADE_MOST` animals; written once a frame from the poses the scene worked out. Visual only.
 */

import {BufferAttribute, BufferGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshLambertMaterial, Quaternion, Vector3, type Object3D} from "three";
import {ARK_ENV} from "@/ark-scene/glsl";

/** The most open-ocean animals shaded at once. */
export const SHADE_MOST = 64;
/** The depth (m, of the top of its body under the surface) by which its shape is gone. */
export const SHADE_GONE = 7;
/** Its shape's darkness just under the surface (alpha). */
export const SHADE_MOST_ALPHA = 0.8;

/** How dark an animal's shape is with the top of its body `topDepth` m under the surface (0…SHADE_MOST_ALPHA). */
export function shadeAlpha(topDepth: number): number {
    const t = Math.min(Math.max((topDepth - 0.2) / (SHADE_GONE - 0.2), 0), 1);
    return SHADE_MOST_ALPHA * (1 - t) * (1 - t);
}

/**
 * A cetacean's blow at `breath` (0 down in its band … 1 at the surface, `sea-depth.ts`): 0 until it is up, then the
 * plume's height as a share of its full height, rising quickly as it breathes out.
 */
export function blowPlume(breath: number): number {
    const t = Math.min(Math.max((breath - 0.75) / 0.25, 0), 1);
    return t * t * (3 - 2 * t);
}

/** A plume, 1 m tall from its foot at y = 0, 1 m wide at its top: three crossed fans, white, its alpha fading upward. */
export function plumeGeometry(): BufferGeometry {
    const pos: number[] = [];
    const col: number[] = [];
    for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const p = (u: number, y: number): [number, number, number] => [c * u, y, s * u];
        // (Narrow at the blowhole, wide and faint at its top; both faces.)
        const quads: Array<[[number, number, number], number]> = [[p(-0.06, 0), 0.75], [p(0.06, 0), 0.75], [p(0.36, 0.7), 0.4], [p(-0.36, 0.7), 0.4]];
        const top: Array<[[number, number, number], number]> = [[p(-0.36, 0.7), 0.4], [p(0.36, 0.7), 0.4], [p(0.5, 1), 0], [p(-0.5, 1), 0]];
        for (const q of [quads, top]) {
            for (const order of [[0, 1, 2, 0, 2, 3], [0, 2, 1, 0, 3, 2]]) {
                for (const i of order) {
                    pos.push(...q[i][0]);
                    col.push(0.96, 0.97, 0.98, q[i][1]);
                }
            }
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(col), 4));
    // (Normals too: the scene's passes read every drawn mesh's normals; without them it drew solid black.)
    geometry.setAttribute("normal", new BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geometry.computeBoundingSphere();
    return geometry;
}

/** A unit outline (1 m long along +z, 1 m wide), soft: a plateau to 60% out, clear at its rim; its head end a little fuller. */
export function shadeGeometry(): BufferGeometry {
    const pos: number[] = [];
    const col: number[] = [];
    const n = 16;
    const ring = (a: number, r: number): [number, number] => {
        // (Fuller toward the head, +z; finer toward the tail.)
        const z = Math.sin(a) * 0.5 * r;
        const taper = z >= 0 ? 1 : 1 - 0.45 * (-z / 0.5);
        return [Math.cos(a) * 0.5 * r * taper, z];
    };
    const push = (p: [number, number], alpha: number) => {
        pos.push(p[0], 0, p[1]);
        col.push(0, 0.03, 0.06, alpha);
    };
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        // (Wound to face up, +y: centre, a1, a0 in the xz plane seen from above.)
        push([0, 0], 1);
        push(ring(a1, 0.6), 0.85);
        push(ring(a0, 0.6), 0.85);
        push(ring(a0, 0.6), 0.85);
        push(ring(a1, 0.6), 0.85);
        push(ring(a1, 1), 0);
        push(ring(a0, 0.6), 0.85);
        push(ring(a1, 1), 0);
        push(ring(a0, 1), 0);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(col), 4));
    // (Normals too: the scene's passes read every drawn mesh's normals; without them it drew solid black.)
    geometry.setAttribute("normal", new BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geometry.computeBoundingSphere();
    return geometry;
}

export class OceanShadows {
    private readonly mesh: InstancedMesh;
    private readonly blows: InstancedMesh;
    private blowCount = 0;
    private readonly fade: InstancedBufferAttribute;
    private readonly matrix = new Matrix4();
    private readonly position = new Vector3();
    private readonly scale = new Vector3();
    private readonly quaternion = new Quaternion();
    private readonly up = new Vector3(0, 1, 0);
    private count = 0;

    constructor(parent: Object3D) {
        const geometry = shadeGeometry();
        this.fade = new InstancedBufferAttribute(new Float32Array(SHADE_MOST), 1);
        geometry.setAttribute("aFade", this.fade);
        const material = new MeshLambertMaterial({vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1});
        material.onBeforeCompile = (shader) => {
            shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float aFade;\nvarying float vFade;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvFade = aFade;");
            shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vFade;").replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= vFade;");
        };
        material.customProgramCacheKey = () => "ark-ocean-shadows";
        this.mesh = new InstancedMesh(geometry, material, SHADE_MOST);
        this.mesh.name = "ocean-shadows";
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        // (After the sea's surface, renderOrder 2; before the wakes, 3.)
        this.mesh.renderOrder = 2.5;
        parent.add(this.mesh);
        this.blows = new InstancedMesh(plumeGeometry(), new MeshLambertMaterial({vertexColors: true, emissive: 0x6a7076, transparent: true, depthWrite: false}), 8);
        this.blows.name = "ocean-blows";
        this.blows.count = 0;
        this.blows.frustumCulled = false;
        this.blows.renderOrder = 3;
        parent.add(this.blows);
    }

    begin(): void {
        this.count = 0;
        this.blowCount = 0;
    }

    /** A cetacean's blow from its head at (x, z), `length` m long, `breath` up into its breath (0…1). */
    blow(x: number, z: number, length: number, breath: number): void {
        const plume = blowPlume(breath);
        if (plume <= 0.02 || this.blowCount >= this.blows.instanceMatrix.count) return;
        const height = Math.min(Math.max(length * 0.3, 1.2), 8) * plume;
        this.quaternion.identity();
        this.matrix.compose(this.position.set(x, ARK_ENV.seaLevel.value + 0.1, z), this.quaternion, this.scale.set(height * 0.55, height, height * 0.55));
        this.blows.setMatrixAt(this.blowCount++, this.matrix);
    }

    /** An open-ocean animal at (x, z), heading `yaw`, `length` × `width` m, the top of its body at `top` (m, world). */
    add(x: number, z: number, yaw: number, length: number, width: number, top: number): void {
        if (this.count >= SHADE_MOST) return;
        const alpha = shadeAlpha(ARK_ENV.seaLevel.value - top);
        if (alpha <= 0.005) return;
        this.quaternion.setFromAxisAngle(this.up, yaw);
        this.matrix.compose(this.position.set(x, ARK_ENV.seaLevel.value + 0.03, z), this.quaternion, this.scale.set(Math.max(width, 0.3), 1, Math.max(length, 0.5)));
        this.mesh.setMatrixAt(this.count, this.matrix);
        this.fade.setX(this.count, alpha);
        this.count++;
    }

    /** Done for this frame: drawn unless the camera is under the sea. */
    end(underwater: boolean): void {
        this.blows.count = this.blowCount;
        this.blows.visible = !underwater && this.blowCount > 0;
        if (this.blowCount) this.blows.instanceMatrix.needsUpdate = true;
        this.mesh.count = this.count;
        this.mesh.visible = !underwater && this.count > 0;
        if (!this.count) return;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.fade.needsUpdate = true;
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as MeshLambertMaterial).dispose();
        this.mesh.removeFromParent();
        this.blows.geometry.dispose();
        (this.blows.material as MeshLambertMaterial).dispose();
        this.blows.removeFromParent();
    }
}
