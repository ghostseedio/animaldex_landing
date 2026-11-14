/**
 * The town's paving textures (lane GA): six CC0 Poly Haven sets (docs/ark-credits.md), each a 512 px layer of two KTX2
 * texture arrays built by `scripts/ark-town-textures.mjs` and transcoded on the device by Basis Universal (three's
 * copy in `public/ark/basis/`) to whatever compressed format its GPU has (ASTC, ETC2, BC7/BC3):
 *
 *   town-albedo.ktx2   RGB the albedo, A the roughness (every tier)
 *   town-normal.ktx2   the normal maps (medium and high; the low tier draws the paving flat-shaded)
 *
 *   layer 0 asphalt · 1 paving slabs · 2 granite setts · 3 gravel · 4 block paving · 5 granite (kerbs, quays)
 *
 * The grass, soil, sand, mud, leaf litter and tilled soil are the wild ground's own strips (`ground-textures.ts`),
 * already loaded for the wild island: the town reads the same textures, so nothing more is downloaded for them.
 *
 * Until the files are in (or if they never are, or the device cannot transcode), the town draws its old flat colours
 * with a procedural grain (`TOWN_TEXTURES.ready` 0). The transcoded data is dropped from the JS heap once it is on the GPU.
 */

import {LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, type Texture, type WebGLRenderer} from "three";
import type {KTX2Loader} from "three/examples/jsm/loaders/KTX2Loader.js";
import {loadGroundTextures} from "@/ark-scene/ground-textures";
import {readUntilIn} from "@/ark-scene/model-files";

export const TOWN_LAYER = {asphalt: 0, slabs: 1, setts: 2, gravel: 3, blocks: 4, granite: 5} as const;
/** Each layer's real size (m), Poly Haven's measured dimensions (true scale). */
export const TOWN_LAYER_METRES = [3.0, 1.8, 2.4, 2.25, 1.81, 2.3];
/** Each layer's mean colour (linear), from the packing: the shader divides by it, so the vertex colour keeps the hue. */
export const TOWN_LAYER_MEANS: Array<[number, number, number]> = [
    [0.1069, 0.1052, 0.0926],
    [0.2269, 0.1859, 0.1405],
    [0.1976, 0.1749, 0.1266],
    [0.3842, 0.256, 0.1444],
    [0.2565, 0.2412, 0.216],
    [0.0722, 0.074, 0.0754]
];

export const TOWN_TEXTURES = {
    albedo: {value: null as Texture | null},
    normal: {value: null as Texture | null},
    /** 1 once the albedo array is on the GPU. */
    ready: {value: 0},
    /** 1 once the normal array is too (and the tier draws normals). */
    normals: {value: 0},
    /** The low tier's lighter shading: one sample a layer, no normal maps, no close-up detail, no ripples. */
    lite: {value: 0}
};

/** Where the art is: the Ark's defaults (`mountArk` `graphicsBase` / `basisBase`). */
let artBase = {graphics: "/ark/graphics", basis: "/ark/basis/"};
export function setTownArtBase(base: {graphics?: string; basis?: string}) {
    artBase = {graphics: (base.graphics ?? artBase.graphics).replace(/\/+$/, ""), basis: (base.basis ?? artBase.basis).replace(/\/?$/, "/")};
}

let loader: Promise<KTX2Loader> | null = null;
let asked = {albedo: false, normal: false};

function ktx2(renderer: WebGLRenderer): Promise<KTX2Loader> {
    if (!loader) {
        loader = import("three/examples/jsm/loaders/KTX2Loader.js").then(({KTX2Loader}) => {
            const l = new KTX2Loader().setTranscoderPath(artBase.basis).setWorkerLimit(1);
            l.detectSupport(renderer);
            return l;
        });
    }
    return loader;
}

/**
 * One of the town's arrays, read until it is in. A read that fails takes the loader with it: it keeps its transcoder's
 * own failed read for good, so the next try is made with a new one.
 */
function readArray(label: string, file: string, renderer: WebGLRenderer): Promise<Texture> {
    return readUntilIn(label, () =>
        ktx2(renderer)
            .then((l) => l.loadAsync(`${artBase.graphics}/${file}`))
            .catch((error: unknown) => {
                loader = null;
                throw error;
            })
    );
}

function prepare(texture: Texture, renderer: WebGLRenderer, anisotropy: number): Texture {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = texture.mipmaps && texture.mipmaps.length > 1 ? LinearMipmapLinearFilter : LinearFilter;
    texture.anisotropy = Math.min(anisotropy, renderer.capabilities.getMaxAnisotropy());
    // Once uploaded, the transcoded levels are not needed in the JS heap (the phone's tightest budget).
    texture.onUpdate = () => {
        for (const level of texture.mipmaps ?? []) (level as {data: unknown}).data = new Uint8Array(0);
    };
    texture.needsUpdate = true;
    return texture;
}

/**
 * Loads what the tier draws (once each): the albedo array always, the normal array unless `normals` is false. Also
 * makes sure the wild ground's strips are loading (the town's own page has no wild island to load them).
 */
export function loadTownTextures(renderer: WebGLRenderer, options: {normals: boolean; anisotropy: number}): void {
    void loadGroundTextures(artBase.graphics);
    TOWN_TEXTURES.lite.value = options.normals ? 0 : 1;
    if (!asked.albedo) {
        asked.albedo = true;
        readArray("town paving", "town-albedo.ktx2", renderer)
            .then((texture) => {
                TOWN_TEXTURES.albedo.value = prepare(texture, renderer, options.anisotropy);
                TOWN_TEXTURES.ready.value = 1;
            })
            .catch((error) => console.warn("[ark] town paving", error instanceof Error ? error.message : error));
    }
    if (options.normals && !asked.normal) {
        asked.normal = true;
        readArray("town paving normals", "town-normal.ktx2", renderer)
            .then((texture) => {
                TOWN_TEXTURES.normal.value = prepare(texture, renderer, options.anisotropy);
                TOWN_TEXTURES.normals.value = TOWN_TEXTURES.lite.value > 0.5 ? 0 : 1;
            })
            .catch((error) => console.warn("[ark] town paving normals", error instanceof Error ? error.message : error));
    }
    if (TOWN_TEXTURES.normal.value) TOWN_TEXTURES.normals.value = options.normals ? 1 : 0;
}

/** For tests and a remount: forget what was asked (the textures themselves stay shared). */
export function resetTownTextures() {
    asked = {albedo: false, normal: false};
}
