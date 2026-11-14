/**
 * Animals seen from far: each species' icon art (the apps' `animals/<slug>.webp`)
 * with a soft shadow of its own shape, facing the camera; one draw call for
 * all of them. Only a last resort: most animals are drawn as models at every
 * distance.
 *
 * The icons are drawn into one atlas as they load. A token keeps a readable
 * size on screen however far away it is (between MIN_PIXELS and MAX_PIXELS),
 * stands on its animal's spot, and is sorted back to front each frame so
 * the soft edges overlap cleanly.
 */

import {
    CanvasTexture,
    Color,
    DynamicDrawUsage,
    InstancedBufferAttribute,
    InstancedMesh,
    LinearFilter,
    LinearMipmapLinearFilter,
    Matrix4,
    PlaneGeometry,
    ShaderMaterial,
    SRGBColorSpace,
    UniformsLib,
    UniformsUtils,
    Vector3,
    type Camera
} from "three";
import {fetchOk, readUntilIn} from "@/ark-scene/model-files";
import {ARK_DAYLIGHT} from "@/ark-scene/glsl";

const CELL = 128;
const PAD = 6;

export type TokenInstance = {
    slug: string;
    x: number;
    /** The ground (or water) the token stands on. */
    y: number;
    z: number;
    /** Size in metres when close enough for that to be bigger than MIN_PIXELS. */
    size: number;
    dim: number;
    /** 0 none, 1 the viewer's own, 2 selected. */
    ring: number;
    /** 0…1, an entrance's progress. */
    grow: number;
};

const VERTEX = `
#include <common>
#include <fog_pars_vertex>
attribute vec4 tokenCell;
attribute vec4 tokenState;
uniform float worldPerPixel;
uniform float minPixels;
uniform float maxPixels;
varying vec2 vUv;
varying vec4 vCell;
varying vec4 vState;
void main() {
    vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float size = length(instanceMatrix[0].xyz);
    float perPixel = worldPerPixel * max(-centre.z, 0.001);
    size = clamp(size, minPixels * perPixel, maxPixels * perPixel) * tokenState.w;
    vec4 mvPosition = centre;
    mvPosition.xy += (position.xy + vec2(0.0, 0.5)) * size;
    gl_Position = projectionMatrix * mvPosition;
    vUv = uv;
    vCell = tokenCell;
    vState = tokenState;
    #include <fog_vertex>
}
`;

const FRAGMENT = `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D atlas;
uniform vec3 backdrop;
uniform vec3 edge;
uniform vec3 mineRing;
uniform vec3 selectedRing;
uniform vec3 dimTint;
varying vec2 vUv;
varying vec4 vCell;
varying vec4 vState;
uniform float daylight;
vec4 cellSample(vec2 at, float bias) {
    if (at.x <= 0.0 || at.x >= 1.0 || at.y <= 0.0 || at.y >= 1.0) return vec4(0.0);
    return texture2D(atlas, vCell.xy + at * vCell.zw, bias);
}
void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float aa = fwidth(r) * 1.2;
    vec2 at = p / 0.9 + 0.5;
    vec4 icon = vCell.z > 0.0 ? cellSample(at, 0.0) : vec4(0.0);
    // A soft shadow from the icon's own shape, cast a little down.
    float shadow = vCell.z > 0.0 ? cellSample(at + vec2(0.0, 0.07), 2.5).a * 0.42 : (1.0 - smoothstep(0.1, 0.35, r)) * 0.5;
    vec3 colour = icon.rgb;
    float alpha = icon.a + shadow * (1.0 - icon.a);
    colour = mix(vec3(0.05, 0.05, 0.04), colour, icon.a / max(alpha, 0.001));
    // The viewer's own, or the selected one: a thin ring of light about it.
    if (vState.y > 0.5) {
        float ring = smoothstep(0.86 - aa, 0.9, r) * (1.0 - smoothstep(0.94, 0.98 + aa, r));
        vec3 ringColour = vState.y > 1.5 ? selectedRing : mineRing;
        colour = mix(colour, ringColour, ring);
        alpha = max(alpha, ring);
    }
    float grey = dot(colour, vec3(0.299, 0.587, 0.114));
    colour = mix(colour, mix(vec3(grey), dimTint, 0.5), vState.x * 0.7);
    // Dimmer at night, as everything lit is.
    colour *= mix(0.5, 1.0, daylight);
    alpha *= 1.0 - 0.5 * vState.x;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(colour, alpha);
    #include <colorspace_fragment>
    #include <fog_fragment>
}
`;

export class IconTokens {
    readonly mesh: InstancedMesh;
    private readonly material: ShaderMaterial;
    private readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D;
    private readonly texture: CanvasTexture;
    private readonly cells = new Map<string, {index: number; loaded: boolean}>();
    private readonly columns: number;
    private capacity = 0;
    private cellAttribute!: InstancedBufferAttribute;
    private stateAttribute!: InstancedBufferAttribute;
    private atlasDirty = false;
    private disposed = false;
    private readonly matrix = new Matrix4();
    private readonly view = new Vector3();
    onIconLoad: () => void = () => undefined;

    /**
     * `fallbackUrl`: drawn for a species whose icon fails to load (no art in the bucket: the generic figure, as the
     * page's own cards show). Without it such a token stayed a bare shadow for good.
     */
    constructor(private readonly iconUrl: (slug: string) => string, atlasSize = 2048, private readonly fallbackUrl: string | null = null) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = atlasSize;
        this.canvas.height = atlasSize;
        this.context = this.canvas.getContext("2d") as CanvasRenderingContext2D;
        this.columns = Math.floor(atlasSize / CELL);
        this.texture = new CanvasTexture(this.canvas);
        this.texture.colorSpace = SRGBColorSpace;
        this.texture.minFilter = LinearMipmapLinearFilter;
        this.texture.magFilter = LinearFilter;
        this.texture.flipY = false;
        this.material = new ShaderMaterial({
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            uniforms: UniformsUtils.merge([
                UniformsLib.fog,
                {
                    atlas: {value: null},
                    worldPerPixel: {value: 0.01},
                    minPixels: {value: 30},
                    maxPixels: {value: 64},
                    backdrop: {value: new Color("#f6f1e7")},
                    edge: {value: new Color("#d8cdb9")},
                    mineRing: {value: new Color("#a7f432")},
                    selectedRing: {value: new Color("#ffffff")},
                    dimTint: {value: new Color("#ecdcc4")}
                }
            ]),
            transparent: true,
            depthWrite: false,
            fog: true
        });
        this.material.uniforms.atlas.value = this.texture;
        this.material.uniforms.daylight = ARK_DAYLIGHT;
        this.mesh = new InstancedMesh(new PlaneGeometry(1, 1), this.material, 1);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 5;
        this.mesh.count = 0;
        this.grow(64);
    }

    private grow(capacity: number) {
        this.capacity = capacity;
        const geometry = this.mesh.geometry;
        this.cellAttribute = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        this.stateAttribute = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        this.cellAttribute.setUsage(DynamicDrawUsage);
        this.stateAttribute.setUsage(DynamicDrawUsage);
        geometry.setAttribute("tokenCell", this.cellAttribute);
        geometry.setAttribute("tokenState", this.stateAttribute);
        const matrices = new InstancedBufferAttribute(new Float32Array(capacity * 16), 16);
        matrices.setUsage(DynamicDrawUsage);
        this.mesh.instanceMatrix = matrices;
    }

    /** The screen's scale: world units per CSS pixel at one unit from the camera. */
    setViewport(fovDegrees: number, heightPixels: number, compact: boolean) {
        this.material.uniforms.worldPerPixel.value = 2 * Math.tan(fovDegrees * Math.PI / 360) / Math.max(heightPixels, 1);
        this.material.uniforms.minPixels.value = compact ? 22 : 24;
        this.material.uniforms.maxPixels.value = compact ? 40 : 46;
    }

    /** The token's size on screen at this distance, in CSS pixels (for picking). */
    pixelSize(sizeMetres: number, distance: number): number {
        const perPixel = this.material.uniforms.worldPerPixel.value * Math.max(distance, 0.001);
        return Math.min(Math.max(sizeMetres / perPixel, this.material.uniforms.minPixels.value), this.material.uniforms.maxPixels.value);
    }

    /** Whether a species' icon is in the atlas (one that failed to load never is). */
    loaded(slug: string): boolean {
        return this.cells.get(slug)?.loaded === true;
    }

    /** Starts loading a species' icon into the atlas. */
    ensure(slug: string) {
        if (this.cells.has(slug) || this.disposed) return;
        const index = this.cells.size;
        if (index >= this.columns * this.columns) return;
        const cell = {index, loaded: false};
        this.cells.set(slug, cell);
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.decoding = "async";
        const url = this.iconUrl(slug);
        // No art for this species (143 of the 951 aboard, 2026-11-14: the bucket answers 400), or it did not arrive: the
        // fallback figure in its cell at once. Which of the two it was is then asked of the bucket itself (a picture's
        // failure does not say): art that only failed to arrive is read until it is in and drawn over the figure;
        // before, a phone changing networks left the figure there for the whole visit.
        let fellBack = false;
        image.onerror = () => {
            const fallback = this.fallbackUrl;
            if (this.disposed || !fallback || fellBack) return;
            fellBack = true;
            image.src = fallback;
            if (!url || url === fallback || /^data:/.test(url)) return;
            void readUntilIn(`icon ${slug}`, () => fetchOk(url), () => !this.disposed)
                .then(() => {
                    if (!this.disposed) image.src = url;
                })
                .catch(() => undefined);
        };
        image.onload = () => {
            if (this.disposed) return;
            const x = (index % this.columns) * CELL;
            const y = Math.floor(index / this.columns) * CELL;
            const inner = CELL - PAD * 2;
            // (An SVG with no size of its own, the fallback figure, reports none in some browsers: square.)
            const iw = image.width || inner;
            const ih = image.height || inner;
            const scale = Math.min(inner / iw, inner / ih);
            const w = iw * scale;
            const h = ih * scale;
            this.context.clearRect(x, y, CELL, CELL);
            this.context.drawImage(image, x + (CELL - w) / 2, y + (CELL - h) / 2, w, h);
            cell.loaded = true;
            this.atlasDirty = true;
            this.onIconLoad();
        };
        // (No address: a host that knows this species has no art, the embed with the server's `noIcon`. The figure,
        // without asking the bucket for a file it does not hold.)
        image.src = url || this.fallbackUrl || "";
    }

    /** This frame's tokens; sorted far to near from the camera, marked ones last. */
    set(tokens: TokenInstance[], camera: Camera) {
        if (this.atlasDirty) {
            this.texture.needsUpdate = true;
            this.atlasDirty = false;
        }
        if (tokens.length > this.capacity) this.grow(Math.max(tokens.length, this.capacity * 2));
        const sorted = tokens
            .map((token) => {
                this.view.set(token.x, token.y, token.z).applyMatrix4(camera.matrixWorldInverse);
                return {token, depth: this.view.z};
            })
            // Far to near, and the marked ones (the viewer's own, the selected) over the rest.
            .sort((a, b) => (a.token.ring > 0 ? 1 : 0) - (b.token.ring > 0 ? 1 : 0) || a.depth - b.depth);
        const atlasSize = this.canvas.width;
        sorted.forEach(({token}, i) => {
            const cell = this.cells.get(token.slug);
            this.matrix.makeScale(token.size, token.size, token.size).setPosition(token.x, token.y, token.z);
            this.mesh.setMatrixAt(i, this.matrix);
            if (cell?.loaded) {
                const x = (cell.index % this.columns) * CELL;
                const y = Math.floor(cell.index / this.columns) * CELL;
                // Rows run down the canvas and the texture isn't flipped: v grows downward, so the icon's top is v0.
                this.cellAttribute.setXYZW(i, x / atlasSize, (y + CELL) / atlasSize, CELL / atlasSize, -CELL / atlasSize);
            } else {
                this.cellAttribute.setXYZW(i, 0, 0, 0, 0);
            }
            this.stateAttribute.setXYZW(i, token.dim, token.ring, 0, token.grow);
        });
        this.mesh.count = sorted.length;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.cellAttribute.needsUpdate = true;
        this.stateAttribute.needsUpdate = true;
        this.mesh.visible = sorted.length > 0;
    }

    dispose() {
        this.disposed = true;
        this.mesh.geometry.dispose();
        this.material.dispose();
        this.texture.dispose();
        this.mesh.dispose();
    }
}
