/**
 * The ground's texture sets (graphics pass, batch 1): CC0 photo textures
 * (docs/ark-credits.md) packed as two vertical strips, one 512 px layer per
 * material, read into texture arrays so the ground shader can blend any of
 * them with two samplers.
 *
 *   layer 0 grass · 1 forest floor · 2 soil · 3 sand · 4 wet sand · 5 rock · 6 mud · 7 snow · 8 tilled soil
 *
 * Until they arrive (or if they never do) the shader draws the procedural
 * ground it always had: `ARK_GROUND_TEXTURES.ready` is 0.
 */

import {DataArrayTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, UnsignedByteType} from "three";
import {fetchOk, readUntilIn} from "@/ark-scene/model-files";

export const GROUND_LAYERS = ["grass", "forest_floor", "soil", "sand", "wet_sand", "rock", "mud", "snow", "tilled"] as const;

/** Each layer's mean colour (linear), from the packing: the shader divides by it so a zone's own tint carries the texture's detail. */
export const GROUND_MEANS: Array<[number, number, number]> = [
    [151, 131, 89], [142, 112, 58], [99, 82, 62], [130, 114, 91], [108, 96, 77], [131, 105, 80], [77, 68, 55], [165, 165, 167], [88, 63, 40]
].map((rgb) => rgb.map((v) => Math.pow(v / 255, 2.2)) as [number, number, number]);

export const ARK_GROUND_TEXTURES = {
    albedo: {value: null as DataArrayTexture | null},
    normal: {value: null as DataArrayTexture | null},
    ready: {value: 0}
};

const loading = new Map<string, Promise<void>>();

async function readStrip(url: string, layers: number): Promise<{data: Uint8Array; size: number}> {
    const response = await fetchOk(url);
    const bitmap = await createImageBitmap(await response.blob());
    const size = bitmap.width;
    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(size, size * layers) : Object.assign(document.createElement("canvas"), {width: size, height: size * layers});
    const context = (canvas as HTMLCanvasElement).getContext("2d", {willReadFrequently: true}) as CanvasRenderingContext2D;
    context.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const pixels = context.getImageData(0, 0, size, size * layers).data;
    return {data: new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength), size};
}

function arrayTexture(data: Uint8Array, size: number, layers: number, srgb: boolean): DataArrayTexture {
    const texture = new DataArrayTexture(data, size, size, layers);
    texture.type = UnsignedByteType;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    texture.needsUpdate = true;
    return texture;
}

/** Load the strips from `base` (once per base); the ground shader switches to them when they are in. */
export function loadGroundTextures(base: string): Promise<void> {
    const root = base.replace(/\/+$/, "");
    let promise = loading.get(root);
    if (!promise) {
        const layers = GROUND_LAYERS.length;
        // (Each strip read until it is in: a dropped request left the procedural ground for the whole visit.)
        promise = Promise.all([readUntilIn("ground textures", () => readStrip(`${root}/ground-albedo-512.webp`, layers)), readUntilIn("ground normals", () => readStrip(`${root}/ground-normal-512.webp`, layers))])
            .then(([albedo, normal]) => {
                ARK_GROUND_TEXTURES.albedo.value = arrayTexture(albedo.data, albedo.size, layers, true);
                ARK_GROUND_TEXTURES.normal.value = arrayTexture(normal.data, normal.size, layers, false);
                ARK_GROUND_TEXTURES.ready.value = 1;
            })
            .catch(() => {
                // The procedural ground stays.
            });
        loading.set(root, promise);
    }
    return promise;
}
