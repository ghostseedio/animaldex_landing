/**
 * What the scene holds on the GPU, estimated from three's own objects (runtime lane). WebGL never says how much
 * memory a page uses, so the budgets (`budgets.ts`) and the measurement page count bytes themselves: every unique
 * geometry's attributes and index, every unique texture's pixels (with mipmaps), and each instanced mesh's matrices.
 */

import type {BufferGeometry, InstancedMesh, Material, Mesh, Object3D, Texture} from "three";

/** Bytes of a geometry's attributes and index (the instance attributes too). */
export function geometryBytes(geometry: BufferGeometry): number {
    let bytes = geometry.index ? geometry.index.array.byteLength : 0;
    for (const name of Object.keys(geometry.attributes)) {
        const attribute = geometry.attributes[name] as {array?: ArrayLike<number> & {byteLength?: number}; data?: {array: {byteLength: number}}};
        bytes += attribute.array?.byteLength ?? attribute.data?.array.byteLength ?? 0;
    }
    return bytes;
}

/** Bytes per texel for three's texture types (UnsignedByte RGBA unless it says otherwise). */
function texelBytes(texture: Texture): number {
    // FloatType 1015, HalfFloatType 1016, UnsignedByteType 1009.
    const type = (texture as {type?: number}).type;
    const perChannel = type === 1015 ? 4 : type === 1016 ? 2 : 1;
    return 4 * perChannel;
}

/** A texture's GPU bytes: width × height × texel, a third more with mipmaps, six faces for a cube. */
export function textureBytes(texture: Texture): number {
    const image = texture.image as {width?: number; height?: number; data?: unknown} | Array<{width?: number; height?: number}> | null;
    const first = Array.isArray(image) ? image[0] : image;
    const width = first?.width ?? 0;
    const height = first?.height ?? 0;
    const faces = Array.isArray(image) ? image.length : 1;
    const mip = texture.generateMipmaps !== false && texture.minFilter !== 1006 && texture.minFilter !== 1003 ? 4 / 3 : 1;
    return Math.round(width * height * texelBytes(texture) * mip * faces);
}

/** Textures a material holds (its maps and any texture uniform a shader added). */
export function materialTextures(material: Material, into: Set<Texture>) {
    for (const value of Object.values(material as unknown as Record<string, unknown>)) {
        if (value && typeof value === "object" && (value as Texture).isTexture) into.add(value as Texture);
    }
    const uniforms = (material as unknown as {uniforms?: Record<string, {value: unknown}>}).uniforms;
    if (uniforms) {
        for (const uniform of Object.values(uniforms)) {
            const value = uniform?.value;
            if (value && typeof value === "object" && (value as Texture).isTexture) into.add(value as Texture);
        }
    }
}

export type SceneMemory = {geometryBytes: number; textureBytes: number; geometries: number; textures: number; instances: number};

/** Everything reachable from the scene (and the scene's environment and background). */
export function sceneMemory(root: Object3D): SceneMemory {
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    const textures = new Set<Texture>();
    let instances = 0;
    let matrixBytes = 0;
    root.traverse((object) => {
        const mesh = object as Mesh & Partial<InstancedMesh>;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
        if (mesh.isInstancedMesh && mesh.instanceMatrix) {
            instances += mesh.instanceMatrix.count;
            matrixBytes += mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0);
        }
    });
    const scene = root as Object3D & {environment?: Texture | null; background?: unknown};
    if (scene.environment?.isTexture) textures.add(scene.environment);
    if (scene.background && (scene.background as Texture).isTexture) textures.add(scene.background as Texture);
    materials.forEach((material) => materialTextures(material, textures));
    let gBytes = matrixBytes;
    geometries.forEach((geometry) => {
        gBytes += geometryBytes(geometry);
    });
    let tBytes = 0;
    textures.forEach((texture) => {
        tBytes += textureBytes(texture);
    });
    return {geometryBytes: gBytes, textureBytes: tBytes, geometries: geometries.size, textures: textures.size, instances};
}

/**
 * The JS heap's floor: the least it has been over the last `windowSeconds`, which is about what is still held after a
 * collection. The heap as read at any one moment is mostly garbage waiting to be collected (the scene makes 20 to
 * 130 MB of it a second, and a collection comes every few seconds: on the desktop's high tier the reading swung
 * between 420 and 840 MB with ~430 MB held; on the low phone profile between 330 and 530 MB with ~260 MB held), so
 * a budget judged on one reading says "over" at random. The memory check reads this instead (graphics and performance
 * pass, 2026-11). Pure: the clock and the readings are passed in.
 */
export class HeapFloor {
    private readonly at: Float64Array;
    private readonly mb: Float64Array;
    private next = 0;
    private count = 0;

    constructor(private readonly windowSeconds = 30, capacity = 256) {
        this.at = new Float64Array(capacity);
        this.mb = new Float64Array(capacity);
    }

    /** One reading (MB) at `now` (s). */
    sample(now: number, heapMB: number) {
        if (!(heapMB > 0)) return;
        this.at[this.next] = now;
        this.mb[this.next] = heapMB;
        this.next = (this.next + 1) % this.at.length;
        this.count = Math.min(this.count + 1, this.at.length);
    }

    /** The least reading of the last `windowSeconds` (MB), or null with none. */
    floor(now: number): number | null {
        let least = Infinity;
        for (let i = 0; i < this.count; i++) if (now - this.at[i] <= this.windowSeconds && this.mb[i] < least) least = this.mb[i];
        return Number.isFinite(least) ? least : null;
    }
}
