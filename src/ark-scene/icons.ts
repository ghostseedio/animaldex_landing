/**
 * Animals seen from far: each species' icon art (the apps' `animals/<slug>.webp`)
 * with a soft shadow of its own shape, facing the camera; one draw call for
 * all of them. Only a last resort: most animals are drawn as models at every
 * distance.
 *
 * The icons are drawn into one atlas as they load. The atlas is 2048² with mipmaps (16 MB), and an icon is one 128²
 * cell of it: when one loads, only its cell is sent to the GPU (`flush`), not the whole atlas again (as it was: a
 * phone fetches a kind's icon when the kind is first drawn, so moving through the world re-sent 16 MB every time a
 * new kind came into view; 20 times in twelve zooms on the phone profile, 331 MB). Many at once (a desktop's first
 * seconds, when every kind's icon comes in) go as one whole upload, at most one every `WHOLE_EVERY_MS`.
 *
 * A token keeps a readable
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
    Vector2,
    Vector3,
    type Camera,
    type WebGLRenderer
} from "three";
import {ARK_DAYLIGHT} from "@/ark-scene/glsl";

const CELL = 128;
const PAD = 6;
/** Up to this many new icons in a frame are sent cell by cell; more, as one whole atlas. */
const CELLS_AT_ONCE = 4;
/** The whole atlas is sent at most this often (ms) while icons keep coming in. */
const WHOLE_EVERY_MS = 300;

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
    /** The cells drawn since the atlas was last sent to the GPU. */
    private dirtyCells: number[] = [];
    private wholeAt = -Infinity;
    /** One cell's pixels, for its own upload (`flush`). */
    private cellCanvas: HTMLCanvasElement | null = null;
    private cellTexture: CanvasTexture | null = null;
    private readonly cellAt = new Vector2();
    /** Whole-atlas and single-cell uploads so far (the measurement reads them). */
    readonly uploads = {whole: 0, cells: 0};
    private disposed = false;
    private readonly matrix = new Matrix4();
    private readonly view = new Vector3();
    onIconLoad: () => void = () => undefined;

    /** `renderer`: for an icon's own upload into the atlas (without it, the whole atlas each time, as before). */
    constructor(private readonly iconUrl: (slug: string) => string, atlasSize = 2048, private readonly renderer: WebGLRenderer | null = null) {
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
        image.onload = () => {
            if (this.disposed) return;
            const x = (index % this.columns) * CELL;
            const y = Math.floor(index / this.columns) * CELL;
            const inner = CELL - PAD * 2;
            const scale = Math.min(inner / image.width, inner / image.height);
            const w = image.width * scale;
            const h = image.height * scale;
            this.context.clearRect(x, y, CELL, CELL);
            this.context.drawImage(image, x + (CELL - w) / 2, y + (CELL - h) / 2, w, h);
            cell.loaded = true;
            this.atlasDirty = true;
            this.dirtyCells.push(index);
            this.onIconLoad();
        };
        image.src = this.iconUrl(slug);
    }

    /**
     * The icons drawn into the atlas since it was last sent: a few, each as its own cell (64 KB and the mipmaps made
     * again on the GPU, instead of the atlas's 16 MB); many at once, or an atlas not on the GPU yet, the whole atlas,
     * at most once every `WHOLE_EVERY_MS` (the cells wait for it).
     */
    private flush() {
        const renderer = this.renderer;
        const onGpu = renderer ? Boolean((renderer.properties.get(this.texture) as {__webglTexture?: unknown}).__webglTexture) : false;
        if (renderer && onGpu && this.dirtyCells.length <= CELLS_AT_ONCE) {
            try {
                const canvas = (this.cellCanvas ??= Object.assign(document.createElement("canvas"), {width: CELL, height: CELL}));
                const context = canvas.getContext("2d") as CanvasRenderingContext2D;
                const source = (this.cellTexture ??= new CanvasTexture(canvas));
                for (const index of this.dirtyCells) {
                    const x = (index % this.columns) * CELL;
                    const y = Math.floor(index / this.columns) * CELL;
                    context.clearRect(0, 0, CELL, CELL);
                    context.drawImage(this.canvas, x, y, CELL, CELL, 0, 0, CELL, CELL);
                    renderer.copyTextureToTexture(source, this.texture, null, this.cellAt.set(x, y));
                    this.uploads.cells++;
                }
                this.dirtyCells.length = 0;
                this.atlasDirty = false;
                return;
            } catch {
                // (A renderer that cannot: the whole atlas, below.)
            }
        }
        const now = performance.now();
        if (now - this.wholeAt < WHOLE_EVERY_MS) return;
        this.wholeAt = now;
        this.texture.needsUpdate = true;
        this.uploads.whole++;
        this.dirtyCells.length = 0;
        this.atlasDirty = false;
    }

    /** This frame's tokens; sorted far to near from the camera, marked ones last. */
    set(tokens: TokenInstance[], camera: Camera) {
        if (this.atlasDirty) this.flush();
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
        this.cellTexture?.dispose();
        this.mesh.dispose();
    }
}
