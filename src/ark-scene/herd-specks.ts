/**
 * A herd's far members (A14): each a small generic figure tinted with its
 * species' colour, standing where the server placed it: a four-legged one
 * for a land animal (the placeholder's shape, about 120 triangles), a soft
 * oval for a bird or a swimmer. Two draw calls for every herd on the Ark;
 * no shadow, no motion. Seen from far a herd of a thousand reads as a herd
 * at a fraction of the models' cost.
 *
 * Both shapes fill a unit box (x and z −0.5…0.5, y 0…1), so a member's
 * matrix scales them to its own width, height and length.
 */

import {
    Color,
    DynamicDrawUsage,
    InstancedBufferAttribute,
    InstancedMesh,
    MeshStandardMaterial,
    SphereGeometry,
    type BufferGeometry,
    type Texture
} from "three";
import {placeholderGeometry} from "@/ark-scene/placeholder";

/** Scaled and moved to fill the unit box: x and z −0.5…0.5, y 0…1. */
function unitBox(geometry: BufferGeometry): BufferGeometry {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    geometry.scale(1 / Math.max(box.max.x - box.min.x, 0.001), 1 / Math.max(box.max.y - box.min.y, 0.001), 1 / Math.max(box.max.z - box.min.z, 0.001));
    geometry.deleteAttribute("color");
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}

export type SpeckShape = "four-legged" | "oval";

/** Both shapes, one instanced mesh each. */
export class HerdSpecks {
    readonly meshes: Record<SpeckShape, SpeckMesh>;

    constructor() {
        const material = new MeshStandardMaterial({roughness: 0.85, metalness: 0});
        this.meshes = {
            "four-legged": new SpeckMesh(unitBox(placeholderGeometry("low")), material),
            oval: new SpeckMesh(unitBox(new SphereGeometry(0.5, 7, 5)), material)
        };
    }

    begin() {
        this.meshes["four-legged"].begin();
        this.meshes.oval.begin();
    }

    push(shape: SpeckShape, matrices: Float32Array, offset: number, colour: Color) {
        this.meshes[shape].push(matrices, offset, colour);
    }

    end() {
        this.meshes["four-legged"].end();
        this.meshes.oval.end();
    }

    get drawn(): number {
        return this.meshes["four-legged"].drawn + this.meshes.oval.drawn;
    }

    dispose() {
        (this.meshes.oval.mesh.material as MeshStandardMaterial).dispose();
        this.meshes["four-legged"].dispose();
        this.meshes.oval.dispose();
    }
}

class SpeckMesh {
    readonly mesh: InstancedMesh;
    private capacity = 0;
    private count = 0;

    constructor(geometry: BufferGeometry, material: MeshStandardMaterial) {
        this.mesh = new InstancedMesh(geometry, material, 1);
        this.mesh.frustumCulled = false;
        this.mesh.castShadow = false;
        this.mesh.receiveShadow = false;
        this.grow(256);
        this.mesh.count = 0;
    }

    private grow(capacity: number) {
        this.capacity = capacity;
        const matrices = new InstancedBufferAttribute(new Float32Array(capacity * 16), 16);
        matrices.setUsage(DynamicDrawUsage);
        this.mesh.instanceMatrix = matrices;
        const colours = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        colours.setUsage(DynamicDrawUsage);
        this.mesh.instanceColor = colours;
    }

    /** Starts a frame's specks. */
    begin() {
        this.count = 0;
    }

    /** One speck: its matrix (16 floats at `matrices[offset]`) and colour. */
    push(matrices: Float32Array, offset: number, colour: Color) {
        if (this.count >= this.capacity) {
            const old = this.mesh.instanceMatrix.array as Float32Array;
            const oldColours = this.mesh.instanceColor!.array as Float32Array;
            this.grow(this.capacity * 2);
            (this.mesh.instanceMatrix.array as Float32Array).set(old);
            (this.mesh.instanceColor!.array as Float32Array).set(oldColours);
        }
        const target = this.mesh.instanceMatrix.array as Float32Array;
        const at = this.count * 16;
        for (let i = 0; i < 16; i++) target[at + i] = matrices[offset + i];
        const colours = this.mesh.instanceColor!.array as Float32Array;
        colours[this.count * 3] = colour.r;
        colours[this.count * 3 + 1] = colour.g;
        colours[this.count * 3 + 2] = colour.b;
        this.count++;
    }

    end() {
        this.mesh.count = this.count;
        this.mesh.visible = this.count > 0;
        if (this.count) {
            this.mesh.instanceMatrix.needsUpdate = true;
            this.mesh.instanceColor!.needsUpdate = true;
        }
    }

    get drawn(): number {
        return this.count;
    }

    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.dispose();
    }
}

/** A species' colour from its skin: the mean of a tiny copy (the placeholder's clay when there is none). */
export function textureColour(map: Texture | null, fallback = "#a8977a"): Color {
    const colour = new Color(fallback);
    const image = map?.image as CanvasImageSource | undefined;
    if (!image || typeof document === "undefined") return colour;
    try {
        const canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 8;
        const context = canvas.getContext("2d", {willReadFrequently: true});
        if (!context) return colour;
        context.drawImage(image, 0, 0, 8, 8);
        const data = context.getImageData(0, 0, 8, 8).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            n++;
        }
        if (!n) return colour;
        // The skin is sRGB; the material works in linear light.
        return new Color().setRGB(r / n / 255, g / n / 255, b / n / 255, "srgb");
    } catch {
        return colour;
    }
}
