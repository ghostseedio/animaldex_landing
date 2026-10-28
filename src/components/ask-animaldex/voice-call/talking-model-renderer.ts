/**
 * The animal's 3D model on a call: three.js, loaded only when a call opens.
 *
 * The web port of the iOS `AnimalTalkingModel.swift` (natural look) and the
 * call's `AnimalTalkingModelView`: the skin with twelve layers of fur over it,
 * glossy eyes that blink and a wet nose from the rig (only where they sit on
 * the skin), the jaw hung from its hinge and opened by the voice's loudness
 * with a dark mouth behind it, breathing and a slow look around, the
 * behaviour director's idle behaviours, and the body's own motion (swim,
 * flap, pulse, sway, a tail) as a vertex deformation on every layer of the
 * body. Studio light with a ground bounce, a soft shadow on an invisible
 * floor, and the same camera framing. Fingers turn it like a ball about its
 * middle (`AnimalGrip`), two twist and pinch, a double tap brings it home.
 *
 * The GLB (`export_glb.py`, format g1) holds four nodes — body, body_inner,
 * jaw, jaw_inner — in the model's own space (y up, head toward +z, 1 long),
 * no transforms and no image: the skin is the `.jpg` beside it, its v
 * already turned over for glTF.
 */

import {
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    Color,
    DataTexture,
    DirectionalLight,
    DoubleSide,
    EquirectangularReflectionMapping,
    Euler,
    Group,
    LinearFilter,
    LinearMipmapLinearFilter,
    Material,
    Mesh,
    MeshBasicMaterial,
    MeshDepthMaterial,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    Object3D,
    VSMShadowMap,
    PerspectiveCamera,
    PlaneGeometry,
    PMREMGenerator,
    Quaternion,
    RepeatWrapping,
    RGBADepthPacking,
    RGBAFormat,
    LinearToneMapping,
    Scene,
    ShadowMaterial,
    SphereGeometry,
    SRGBColorSpace,
    Texture,
    TextureLoader,
    Vector3,
    WebGLRenderer,
    Box3
} from "three";
import {
    BehaviourDirector,
    BehaviourRandom,
    motionUniforms,
    WHOLE_BODY_PLANS,
    type MotionUniforms
} from "@/lib/talking-models/behaviour";
import {ballPoint, eyeOpenness, FIELD_OF_VIEW, MouthEnvelope, remainder, TalkingFraming, TalkingOrbit} from "@/lib/talking-models/model-math";
import type {TalkingModelAsset, TalkingRig} from "@/lib/talking-models/catalog";

const FUR_SHELLS = 12;
/** No single pointer event turns it more than a little (radians). */
const MOST_PER_EVENT = 0.35;

// MARK: - Loading

type Parts = {body: BufferGeometry; body_inner: BufferGeometry; jaw: BufferGeometry; jaw_inner: BufferGeometry};
const PART_NAMES = ["body", "body_inner", "jaw", "jaw_inner"] as const;

type GltfJson = {
    nodes?: Array<{name?: string; mesh?: number}>;
    meshes?: Array<{primitives: Array<{attributes: Record<string, number>; indices?: number}>}>;
    accessors?: Array<{bufferView: number; componentType: number; count: number; type: string; byteOffset?: number}>;
    bufferViews?: Array<{byteOffset?: number; byteLength: number}>;
};

const COMPONENTS: Record<string, number> = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4};

/** The four parts of a talking model's GLB, as geometry. */
export function parseTalkingGlb(data: ArrayBuffer): Parts {
    const view = new DataView(data);
    if (view.getUint32(0, true) !== 0x46546c67) throw new Error("not a glb");
    const jsonLength = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, jsonLength))) as GltfJson;
    const binStart = 20 + jsonLength + 8;
    const accessor = (index: number) => {
        const row = json.accessors?.[index];
        const bufferView = row ? json.bufferViews?.[row.bufferView] : undefined;
        if (!row || !bufferView) throw new Error(`accessor ${index}`);
        const size = COMPONENTS[row.type] ?? 1;
        const offset = binStart + (bufferView.byteOffset ?? 0) + (row.byteOffset ?? 0);
        const bytes = data.slice(offset, offset + row.count * size * (row.componentType === 5126 || row.componentType === 5125 ? 4 : 2));
        const array = row.componentType === 5126
            ? new Float32Array(bytes)
            : row.componentType === 5125
                ? new Uint32Array(bytes)
                : new Uint16Array(bytes);
        return {array, size};
    };
    const parts: Partial<Parts> = {};
    for (const node of json.nodes ?? []) {
        const name = PART_NAMES.find((part) => part === node.name);
        if (!name || node.mesh === undefined) continue;
        const primitive = json.meshes?.[node.mesh]?.primitives[0];
        if (!primitive) continue;
        const geometry = new BufferGeometry();
        const position = accessor(primitive.attributes.POSITION);
        geometry.setAttribute("position", new BufferAttribute(position.array, position.size));
        if (primitive.attributes.NORMAL !== undefined) {
            const normal = accessor(primitive.attributes.NORMAL);
            geometry.setAttribute("normal", new BufferAttribute(normal.array, normal.size));
        }
        if (primitive.attributes.TEXCOORD_0 !== undefined) {
            const uv = accessor(primitive.attributes.TEXCOORD_0);
            geometry.setAttribute("uv", new BufferAttribute(uv.array, uv.size));
        }
        if (primitive.indices !== undefined) geometry.setIndex(new BufferAttribute(accessor(primitive.indices).array, 1));
        if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        parts[name] = geometry;
    }
    for (const name of PART_NAMES) {
        if (!parts[name]) throw new Error(`missing ${name}`);
    }
    return parts as Parts;
}

export type LoadedTalkingModel = {asset: TalkingModelAsset; parts: Parts; rig: TalkingRig; skin: Texture};

/** The model's three files. */
export async function loadTalkingModel(asset: TalkingModelAsset, signal?: AbortSignal): Promise<LoadedTalkingModel> {
    const [glb, rig, skin] = await Promise.all([
        fetch(asset.model, {signal}).then((response) => {
            if (!response.ok) throw new Error(`model ${response.status}`);
            return response.arrayBuffer();
        }),
        fetch(asset.rig, {signal}).then((response) => {
            if (!response.ok) throw new Error(`rig ${response.status}`);
            return response.json() as Promise<TalkingRig>;
        }),
        new TextureLoader().setCrossOrigin("anonymous").loadAsync(asset.texture)
    ]);
    return {asset, parts: parseTalkingGlb(glb), rig, skin};
}

// MARK: - Look

/** One value per texel, at random: where a strand of fur is, and how long (the iOS noise, texel for texel). */
function strandNoise(): DataTexture {
    const size = 256;
    let state = 0x9e3779b9;
    const pixels = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
        state = (state ^ (state << 13)) >>> 0;
        state = (state ^ (state >>> 17)) >>> 0;
        state = (state ^ (state << 5)) >>> 0;
        const value = state >>> 24;
        pixels[i * 4] = value;
        pixels[i * 4 + 1] = value;
        pixels[i * 4 + 2] = value;
        pixels[i * 4 + 3] = 255;
    }
    const texture = new DataTexture(pixels, size, size, RGBAFormat);
    // SceneKit reads a CGImage as sRGB and samples it linearised, which thins
    // the outer shells: the same here, or the fur comes out too dense and smooth.
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
}

/** A soft studio: warm light above, a darker floor below that bounces light back up under the chin. */
function studioEnvironment(): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgb(255, 245, 230)");
    gradient.addColorStop(0.45, "rgb(179, 171, 161)");
    gradient.addColorStop(0.55, "rgb(128, 117, 107)");
    gradient.addColorStop(1, "rgb(92, 82, 71)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new CanvasTexture(canvas);
    texture.mapping = EquirectangularReflectionMapping;
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

/**
 * A soft dark patch where the animal touches the ground, from the skin's own
 * lowest points seen from above, blurred: SceneKit's ambient occlusion grounds
 * the paws on iOS, which this stands in for.
 */
function contactShadow(body: BufferGeometry, footHeight: number): {mesh: Mesh; dispose: () => void} | null {
    const position = body.getAttribute("position");
    const box = body.boundingBox;
    if (!position || !box) return null;
    const reach = 0.05;
    const margin = 0.06;
    const minX = box.min.x - margin;
    const minZ = box.min.z - margin;
    const spanX = box.max.x - box.min.x + 2 * margin;
    const spanZ = box.max.z - box.min.z + 2 * margin;
    const size = 128;
    const alpha = new Float32Array(size * size);
    for (let i = 0; i < position.count; i++) {
        const above = position.getY(i) - footHeight;
        if (above > reach) continue;
        const u = Math.floor((position.getX(i) - minX) / spanX * size);
        const v = Math.floor((position.getZ(i) - minZ) / spanZ * size);
        if (u < 0 || v < 0 || u >= size || v >= size) continue;
        alpha[v * size + u] = Math.max(alpha[v * size + u], 1 - above / reach);
    }
    // Three box blurs make a Gaussian.
    const blur = (radius: number) => {
        const out = new Float32Array(alpha.length);
        for (let pass = 0; pass < 2; pass++) {
            const from = pass === 0 ? alpha : out;
            const to = pass === 0 ? out : alpha;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    let sum = 0;
                    let count = 0;
                    for (let k = -radius; k <= radius; k++) {
                        const xx = pass === 0 ? x + k : x;
                        const yy = pass === 0 ? y : y + k;
                        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
                        sum += from[yy * size + xx];
                        count++;
                    }
                    to[y * size + x] = sum / count;
                }
            }
        }
    };
    blur(4);
    blur(4);
    blur(4);
    let peak = 0;
    for (let i = 0; i < alpha.length; i++) peak = Math.max(peak, alpha[i]);
    if (peak <= 0) return null;
    const pixels = new Uint8Array(size * size * 4);
    // As an alpha map: its green channel is how dark.
    for (let i = 0; i < alpha.length; i++) {
        const value = Math.round(255 * Math.min(1, alpha[i] / peak));
        pixels[i * 4] = value;
        pixels[i * 4 + 1] = value;
        pixels[i * 4 + 2] = value;
        pixels[i * 4 + 3] = 255;
    }
    const texture = new DataTexture(pixels, size, size, RGBAFormat);
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    const material = new MeshBasicMaterial({color: 0x000000, alphaMap: texture, transparent: true, opacity: 0.55, depthWrite: false, side: DoubleSide});
    const mesh = new Mesh(new PlaneGeometry(spanX, spanZ), material);
    // Laid flat with the texture's rows along +z (so it faces down: drawn from both sides).
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(minX + spanX / 2, footHeight + 0.001, minZ + spanZ / 2);
    mesh.renderOrder = -1;
    return {
        mesh,
        dispose: () => {
            texture.dispose();
            material.dispose();
            mesh.geometry.dispose();
        }
    };
}

function srgb(r: number, g: number, b: number): Color {
    return new Color().setRGB(r, g, b, SRGBColorSpace);
}

/** The uniforms one material's shader reads; motion ones are shared by every layer. */
type LayerUniforms = Record<string, {value: unknown}>;

const MOTION_DECLARATIONS = `
uniform float motionKind;
uniform float motionAxis;
uniform float motionAmp;
uniform float motionOmega;
uniform float motionWaves;
uniform float motionStill;
uniform float motionRear;
uniform float motionSpan;
uniform float motionBottom;
uniform float motionTop;
uniform float motionMidZ;
uniform float motionClock;
uniform float motionGain;
uniform float tailBaseX;
uniform float tailBaseZ;
uniform float tailLength;
uniform float tailAngle;
`;

/** The iOS `motionBody`, in GLSL: model space is each part's own (the GLB has no transforms). */
const MOTION_BODY = `
{
    vec3 mp = transformed;
    float bodyRun = max(motionStill - motionRear, 0.001);
    float along = clamp((motionStill - mp.z) / bodyRun, 0.0, 1.0);
    float beat = motionClock * motionOmega;
    float height = clamp((mp.y - motionBottom) / max(motionTop - motionBottom, 0.001), 0.0, 1.0);
    if (motionKind > 0.5 && motionKind < 1.5) {
        float bend = motionAmp * motionGain * along * along * sin(beat - along * motionWaves * 6.28318);
        if (motionAxis < 0.5) { mp.x += bend; } else { mp.y += bend; }
    } else if (motionKind > 1.5 && motionKind < 2.5) {
        float reach = clamp((abs(mp.x) - motionSpan * 0.2) / max(motionSpan * 0.8, 0.001), 0.0, 1.0);
        mp.y += motionAmp * motionGain * motionSpan * reach * reach * sin(beat - reach * motionWaves * 6.28318);
    } else if (motionKind > 2.5 && motionKind < 3.5) {
        float squeeze = 1.0 + motionAmp * motionGain * sin(beat) * (0.3 + 0.7 * height);
        mp.x *= squeeze;
        mp.z = motionMidZ + (mp.z - motionMidZ) * squeeze;
        mp.y += motionAmp * motionGain * 0.25 * (1.0 - height) * sin(beat - 1.2) * (motionTop - motionBottom);
    } else if (motionKind > 3.5) {
        mp.x += motionAmp * motionGain * height * height * sin(beat + mp.z * 4.0);
        mp.z += motionAmp * motionGain * 0.5 * height * height * cos(beat * 0.7 + mp.x * 3.0);
    }
    if (tailLength > 0.0 && mp.z < tailBaseZ) {
        float into = clamp((tailBaseZ - mp.z) / tailLength, 0.0, 1.0);
        float swing = tailAngle * into;
        float dx = mp.x - tailBaseX;
        float dz = mp.z - tailBaseZ;
        float c = cos(swing);
        float s = sin(swing);
        mp.x = tailBaseX + dx * c - dz * s;
        mp.z = tailBaseZ + dx * s + dz * c;
    }
    transformed = mp;
}
`;

/**
 * Adds the fur shell (out along the normal, drooping, strands kept where the
 * noise reaches this layer, darker at the roots) and the body's motion, which
 * runs after it, as on iOS. Programs are shared between materials with the
 * same defines: the hook's source is the same for every one.
 */
function layerHook(uniforms: LayerUniforms) {
    return (shader: {uniforms: LayerUniforms; vertexShader: string; fragmentShader: string}) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
#ifdef USE_FUR
uniform float furOffset;
uniform float furDroop;
#endif
#ifdef USE_MOTION
${MOTION_DECLARATIONS}
#endif`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef USE_FUR
transformed += objectNormal * furOffset;
transformed.y -= furDroop;
#endif
#ifdef USE_MOTION
${MOTION_BODY}
#endif`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
#ifdef USE_FUR
uniform sampler2D furNoise;
uniform float furLayer;
#endif`)
            .replace("#include <map_fragment>", `#include <map_fragment>
#ifdef USE_FUR
if (texture2D(furNoise, vMapUv * 14.0).r < furLayer * 0.92 + 0.04) discard;
diffuseColor.rgb *= mix(0.8, 1.06, furLayer);
#endif`)
            .replace("#include <aomap_fragment>", `#include <aomap_fragment>
#ifdef USE_FUR
reflectedLight.indirectDiffuse *= mix(0.7, 1.0, furLayer);
reflectedLight.indirectSpecular *= mix(0.7, 1.0, furLayer);
#endif`);
    };
}

function shade<T extends Material>(material: T, options: {fur?: LayerUniforms; motion?: LayerUniforms | null}): T {
    const uniforms: LayerUniforms = {...(options.fur ?? {}), ...(options.motion ?? {})};
    material.defines = {...(material.defines ?? {}), ...(options.fur ? {USE_FUR: ""} : {}), ...(options.motion ? {USE_MOTION: ""} : {})};
    if (Object.keys(uniforms).length > 0) material.onBeforeCompile = layerHook(uniforms) as Material["onBeforeCompile"];
    return material;
}

// MARK: - The grip

/**
 * The animal in the viewer's hand, turned like a ball about its own middle
 * (`AnimalGrip`): one finger rolls it, two twist it, a flick spins it a
 * moment, a double tap brings it home. It stays where it was put otherwise.
 */
class Grip {
    readonly rotation = new Quaternion();
    readonly offset = new Vector3();
    private holding = false;
    private homing = false;
    private spin: {axis: Vector3; speed: number; about: Vector3} | null = null;

    static readonly fastestSpin = 12;

    hold() {
        this.holding = true;
        this.homing = false;
        this.spin = null;
    }

    /** Let go, still turning `speed` radians a second about `axis` (a flick). */
    letGo(axis = new Vector3(0, 1, 0), speed = 0, about = new Vector3()) {
        this.holding = false;
        const capped = Math.min(Math.abs(speed), Grip.fastestSpin);
        this.spin = capped > 0.3 && axis.length() > 1e-4 ? {axis: axis.clone().normalize(), speed: capped, about: about.clone()} : null;
    }

    /** Turns it by `turn` about `pivot` (scene space): the pivot stays put. */
    rotate(turn: Quaternion, pivot: Vector3) {
        this.rotation.premultiply(turn).normalize();
        this.offset.sub(pivot).applyQuaternion(turn).add(pivot);
    }

    home() {
        this.homing = true;
        this.holding = false;
        this.spin = null;
    }

    step(elapsed: number) {
        if (this.holding || elapsed <= 0) return;
        const spin = this.spin;
        if (spin) {
            this.rotate(new Quaternion().setFromAxisAngle(spin.axis, spin.speed * elapsed), spin.about);
            const speed = spin.speed * Math.exp(-4 * elapsed);
            this.spin = speed > 0.05 ? {...spin, speed} : null;
        }
        if (!this.homing) return;
        const k = 1 - Math.exp(-7 * elapsed);
        this.rotation.slerp(new Quaternion(), k);
        this.offset.multiplyScalar(1 - k);
        if (quaternionAngle(this.rotation) < 0.002 && this.offset.length() < 0.0005) {
            this.rotation.identity();
            this.offset.set(0, 0, 0);
            this.homing = false;
        }
    }

    apply(node: Object3D) {
        node.quaternion.copy(this.rotation);
        node.position.copy(this.offset);
    }
}

function quaternionAngle(q: Quaternion): number {
    return 2 * Math.acos(Math.min(1, Math.abs(q.w)));
}

// MARK: - The stage

export type TalkingStageOptions = {
    /** The voice's level now (dBFS), read every frame. */
    decibels: () => number;
};

export type TalkingStage = {
    /** Back to how it started: upright, facing as it did, the usual distance. */
    goHome: () => void;
    pointerDown: (id: number, x: number, y: number) => void;
    pointerMove: (id: number, x: number, y: number) => void;
    pointerUp: (id: number) => void;
    /** A mouse wheel or a trackpad pinch: closer or further. */
    zoom: (deltaY: number) => void;
    resize: (width: number, height: number) => void;
    dispose: () => void;
};

/**
 * Builds the scene in a canvas of its own inside `container`, compiles its
 * shaders, and starts drawing. Its own canvas: a stage made again (a new
 * animal, a remount) never inherits a context the last one let go of.
 */
export async function createTalkingStage(container: HTMLElement, loaded: LoadedTalkingModel, options: TalkingStageOptions): Promise<TalkingStage> {
    const {parts, rig, skin} = loaded;
    const renderer = new WebGLRenderer({antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance"});
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.appendChild(canvas);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    // SceneKit's HDR camera at its default white point is close to linear:
    // matched by eye against the iOS preview tool's renders.
    renderer.toneMapping = LinearToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = true;
    // Variance shadows: blurred wide and smooth, as SceneKit's deferred soft shadow is.
    renderer.shadowMap.type = VSMShadowMap;

    skin.colorSpace = SRGBColorSpace;
    skin.flipY = false;
    skin.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    skin.minFilter = LinearMipmapLinearFilter;
    skin.needsUpdate = true;

    const scene = new Scene();
    const pmrem = new PMREMGenerator(renderer);
    const environmentSource = studioEnvironment();
    const environment = pmrem.fromEquirectangular(environmentSource).texture;
    scene.environment = environment;
    scene.environmentIntensity = 1.5;

    // Held by a grip the viewer turns; the animal's own idle sway stays inside it.
    const grip = new Group();
    const root = new Group();
    grip.add(root);
    scene.add(grip);

    const behaviour = rig.behaviour ?? null;
    const motion: MotionUniforms | null = motionUniforms(behaviour);
    const motionShared: LayerUniforms | null = motion
        ? {
            ...Object.fromEntries(Object.entries(motion).map(([key, value]) => [key, {value}])),
            motionClock: {value: 0},
            motionGain: {value: 1},
            tailAngle: {value: 0}
        }
        : null;
    const wholeBody = WHOLE_BODY_PLANS.has(behaviour?.plan ?? "");
    const noise = strandNoise();
    const furLength = Number(rig.fur_length ?? 0) || 0;
    const disposables: Array<{dispose: () => void}> = [noise, environment, environmentSource, pmrem];

    const mouth = () => new MeshStandardMaterial({color: srgb(0.10, 0.02, 0.025), roughness: 0.6, metalness: 0});

    /** The skin and its fur shells over a part. */
    const skinned = (geometry: BufferGeometry, moves: boolean) => {
        const motionUniformsForPart = moves ? motionShared : null;
        const material = shade(new MeshStandardMaterial({map: skin, color: srgb(0.9, 0.9, 0.9), roughness: 0.9, metalness: 0}), {motion: motionUniformsForPart});
        const mesh = new Mesh(geometry, material);
        mesh.castShadow = true;
        if (motionUniformsForPart) {
            mesh.customDepthMaterial = shade(new MeshDepthMaterial({depthPacking: RGBADepthPacking}), {motion: motionUniformsForPart});
        }
        if (furLength > 0) {
            for (let layer = 1; layer <= FUR_SHELLS; layer++) {
                const fraction = layer / FUR_SHELLS;
                const fur = shade(new MeshStandardMaterial({map: skin, roughness: 0.85, metalness: 0}), {
                    fur: {
                        furOffset: {value: furLength * fraction},
                        furDroop: {value: furLength * 0.35 * fraction * fraction},
                        furLayer: {value: fraction},
                        furNoise: {value: noise}
                    },
                    motion: motionUniformsForPart
                });
                const shell = new Mesh(geometry, fur);
                shell.renderOrder = layer;
                mesh.add(shell);
            }
        }
        return mesh;
    };
    const inner = (geometry: BufferGeometry, moves: boolean) => new Mesh(geometry, shade(mouth(), {motion: moves ? motionShared : null}));

    const body = skinned(parts.body, true);
    root.add(body, inner(parts.body_inner, true));

    const h = new Vector3().fromArray(rig.hinge);
    const hinge = new Group();
    hinge.position.copy(h);
    root.add(hinge);
    const jaw = skinned(parts.jaw, wholeBody);
    const jawInner = inner(parts.jaw_inner, wholeBody);
    // Hung from the hinge, still drawn where it was.
    jaw.position.copy(h).negate();
    jawInner.position.copy(h).negate();
    hinge.add(jaw, jawInner);

    const cavity = new Mesh(new SphereGeometry(1, 32, 16), mouth());
    cavity.position.fromArray(rig.cavity_center);
    const cavityRadii = new Vector3().fromArray(rig.cavity_radii);
    root.add(cavity);

    // An eye or a nose whose mark missed the head would hang in the air
    // beside it: only those on the skin are drawn (the texture has painted
    // eyes either way).
    const skinPoints = parts.body.getAttribute("position");
    const onSkin = (point: Vector3, reach: number) => {
        if (!skinPoints || skinPoints.count === 0) return true;
        const reach2 = reach * reach;
        for (let i = 0; i < skinPoints.count; i++) {
            const dx = skinPoints.getX(i) - point.x;
            const dy = skinPoints.getY(i) - point.y;
            const dz = skinPoints.getZ(i) - point.z;
            if (dx * dx + dy * dy + dz * dz <= reach2) return true;
        }
        return false;
    };
    const eyeRadius = Number(rig.eye_radius ?? 0.008) || 0.008;
    const eyeMaterial = new MeshPhysicalMaterial({
        color: srgb(0.09, 0.045, 0.015),
        roughness: 0.06,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.02
    });
    const eyeGeometry = new SphereGeometry(eyeRadius, 24, 16);
    const eyes: Mesh[] = [];
    for (const position of rig.eyes ?? []) {
        if (position.length !== 3) continue;
        const at = new Vector3().fromArray(position);
        if (!onSkin(at, 2.5 * eyeRadius + 0.012)) continue;
        const eye = new Mesh(eyeGeometry, eyeMaterial);
        eye.position.copy(at);
        root.add(eye);
        eyes.push(eye);
    }
    let nose: Mesh | null = null;
    const noseScale = new Vector3(1, 1, 1);
    if (rig.nose?.length === 3 && rig.nose_radii?.length === 3) {
        const at = new Vector3().fromArray(rig.nose);
        if (onSkin(at, Math.max(...rig.nose_radii) * 2 + 0.012)) {
            nose = new Mesh(new SphereGeometry(1, 32, 16), new MeshStandardMaterial({color: srgb(0.035, 0.035, 0.035), roughness: 0.28, metalness: 0}));
            nose.position.copy(at);
            noseScale.fromArray(rig.nose_radii);
            nose.scale.copy(noseScale);
            root.add(nose);
        }
    }

    const maxOpen = Number(rig.max_open_degrees) * Math.PI / 180;
    const director = new BehaviourDirector(
        behaviour,
        {jaw: maxOpen > 0, eyes: eyes.length > 0, nose: nose !== null, tail: Boolean(behaviour?.tail)},
        BehaviourRandom.seed(loaded.asset.slug)
    );
    let voiceOpen = 0;
    let behaviourOpen = 0;
    /** A yawn opens wider than speech. */
    const applyMouth = (openness: number) => {
        const open = Math.min(Math.max(openness, 0), 1.7);
        hinge.rotation.set(open * maxOpen, 0, 0);
        // Closed, the mouth would show through the lips; it grows as the jaw drops.
        cavity.scale.set(cavityRadii.x * (0.6 + 0.4 * open), cavityRadii.y * (0.05 + 0.95 * open), cavityRadii.z);
    };
    applyMouth(0);

    // Framed from the model as it stands, before it moves.
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    const footHeight = parts.body.boundingBox?.min.y ?? box.min.y;
    const restLift = Math.min(Math.max(Number(rig.rest_lift ?? 0) || 0, 0), 0.6);
    const framing = TalkingFraming.forBox(box.min.toArray() as [number, number, number], box.max.toArray() as [number, number, number], restLift);
    const middleLocal = box.getCenter(new Vector3());
    const ballSize = box.getSize(new Vector3()).length() / 2;

    // Light: a warm key with the shadow, a soft fill beside the camera, a
    // cool-green rim from behind and above that the fur's edge catches.
    const light = (intensity: number, color: [number, number, number], pitch: number, yaw: number, shadows: boolean) => {
        const node = new DirectionalLight(srgb(...color), intensity / 1000 * Math.PI);
        // SceneKit's euler angles: yaw about y, then pitch about x; a light shines along its -z.
        const front = new Vector3(0, 0, -1).applyEuler(new Euler(pitch, yaw, 0, "YXZ"));
        node.position.set(0, 1.5, 0).addScaledVector(front, -2);
        node.target.position.copy(node.position).add(front);
        if (shadows) {
            node.castShadow = true;
            // SceneKit's soft shadow: a coarse map blurred wide (its radius 6, 16 samples).
            node.shadow.mapSize.set(512, 512);
            node.shadow.radius = 8;
            node.shadow.blurSamples = 16;
            node.shadow.bias = -0.0004;
            node.shadow.normalBias = 0.004;
            const camera = node.shadow.camera;
            camera.left = -1.2;
            camera.right = 1.2;
            camera.top = 1.2;
            camera.bottom = -1.2;
            camera.near = 0.1;
            camera.far = 6;
        }
        scene.add(node, node.target);
        return node;
    };
    light(1300, [1.0, 0.94, 0.86], -0.55, 0.65, true);
    light(450, [1.0, 0.97, 0.94], -0.1, 0.45, false);
    light(1400, [0.82, 1.0, 0.80], -0.35, Math.PI - 0.5, false);

    // Takes the animal's shadow and nothing else.
    // As far as the shadow can reach: a wider plane's far edge drew a line on the horizon.
    const floor = new Mesh(new PlaneGeometry(2.4, 2.4), new ShadowMaterial({color: 0x000000, opacity: 0.55}));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = footHeight;
    floor.receiveShadow = true;
    scene.add(floor);
    // Under the paws, moving with the animal.
    const contact = contactShadow(parts.body, footHeight);
    if (contact) {
        root.add(contact.mesh);
        disposables.push(contact);
    }

    const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.01, 20);
    const orbit = new TalkingOrbit();
    const placeCamera = () => {
        const pose = framing.pose(orbit.yaw, orbit.pitch, orbit.zoom);
        camera.position.fromArray(pose.position);
        camera.lookAt(new Vector3().fromArray(pose.target));
        camera.updateMatrixWorld();
    };
    placeCamera();

    const gripState = new Grip();
    const envelope = new MouthEnvelope();
    let width = 1;
    let height = 1;

    const setIdle = (time: number) => {
        const pose = director.pose(time, voiceOpen > 0.04);
        const sway = pose.sway;
        root.rotation.set(
            0.02 * Math.sin(time * 0.61) * sway + pose.pitch,
            0.06 * Math.sin(time * 0.29) * sway + pose.yaw,
            0.012 * Math.sin(time * 0.47) * sway + pose.roll,
            "YXZ"
        );
        root.scale.set(1, 1 + 0.008 * Math.sin(time * 1.7) + pose.stretch, 1);
        root.position.set(0, pose.lift, 0);
        const lid = Math.max(eyeOpenness(time) * pose.lid, 0.05);
        for (const eye of eyes) eye.scale.set(1, lid, 1);
        nose?.scale.copy(noseScale).multiplyScalar(pose.nose);
        behaviourOpen = pose.mouth;
        applyMouth(Math.max(voiceOpen, behaviourOpen));
        if (motionShared) {
            motionShared.motionClock.value = time % 3600;
            motionShared.tailAngle.value = pose.tail;
        }
    };

    /** The middle of the animal as it is held now, in scene space. */
    const animalMiddle = () => middleLocal.clone().applyMatrix4(root.matrixWorld);
    const project = (point: Vector3): [number, number] => {
        const v = point.clone().project(camera);
        return [(v.x + 1) / 2 * width, (1 - v.y) / 2 * height];
    };
    /** The ball the finger rolls: the animal's middle on screen and in the scene, and how big it looks. */
    const ball = () => {
        const middle = animalMiddle();
        const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const center = project(middle);
        const edge = project(middle.clone().addScaledVector(right, ballSize));
        return {center, radius: Math.max(Math.hypot(edge[0] - center[0], edge[1] - center[1]), 60), middle};
    };

    // MARK: Fingers
    const pointers = new Map<number, [number, number]>();
    let lastFinger: [number, number] | null = null;
    let lastFingerTime = 0;
    let flick = {axis: new Vector3(0, 1, 0), speed: 0};
    let pair: [[number, number], [number, number]] | null = null;
    let panning = false;
    let downAt: [number, number] | null = null;

    const pointerDown = (id: number, x: number, y: number) => {
        pointers.set(id, [x, y]);
        if (pointers.size === 1) {
            downAt = [x, y];
            panning = false;
        } else if (pointers.size === 2) {
            // Two fingers: the one-finger roll waits.
            lastFinger = null;
            panning = false;
            gripState.hold();
            const [a, b] = Array.from(pointers.values());
            pair = [a, b];
        }
    };

    const pointerMove = (id: number, x: number, y: number) => {
        if (!pointers.has(id)) return;
        pointers.set(id, [x, y]);
        if (pointers.size === 1) {
            // A drag begins once the finger has moved, as UIKit's pan does.
            if (!panning) {
                if (downAt && Math.hypot(x - downAt[0], y - downAt[1]) < 6) return;
                panning = true;
                gripState.hold();
                lastFinger = [x, y];
                lastFingerTime = performance.now() / 1000;
                flick = {axis: new Vector3(0, 1, 0), speed: 0};
                return;
            }
            const previous = lastFinger;
            if (!previous) {
                lastFinger = [x, y];
                return;
            }
            const {center, radius, middle} = ball();
            const from = new Vector3(...ballPoint(previous, center, radius));
            const to = new Vector3(...ballPoint([x, y], center, radius));
            if (from.distanceTo(to) < 1e-6) return;
            const roll = new Quaternion().setFromUnitVectors(from, to);
            const angle = quaternionAngle(roll);
            const sinHalf = Math.sqrt(Math.max(1 - roll.w * roll.w, 0));
            if (sinHalf < 1e-6) return;
            const axis = new Vector3(roll.x, roll.y, roll.z).divideScalar(sinHalf).applyQuaternion(camera.quaternion).normalize();
            const capped = Math.min(angle, MOST_PER_EVENT);
            gripState.rotate(new Quaternion().setFromAxisAngle(axis, capped), middle);
            const now = performance.now() / 1000;
            flick = {axis, speed: capped / Math.max(now - lastFingerTime, 1 / 120)};
            lastFinger = [x, y];
            lastFingerTime = now;
        } else if (pointers.size === 2 && pair) {
            const [a, b] = Array.from(pointers.values());
            const [pa, pb] = pair;
            const before = [pb[0] - pa[0], pb[1] - pa[1]];
            const after = [b[0] - a[0], b[1] - a[1]];
            // Each event's change is capped, so a touch that jumps can never fling it.
            const rawTwist = remainder(Math.atan2(after[1], after[0]) - Math.atan2(before[1], before[0]), 2 * Math.PI);
            const twist = Math.min(Math.max(rawTwist, -MOST_PER_EVENT), MOST_PER_EVENT);
            const pinch = Math.min(Math.max(Math.hypot(after[0], after[1]) / Math.max(Math.hypot(before[0], before[1]), 1), 0.8), 1.25);
            // Clockwise on screen (y down) is clockwise as the viewer sees it.
            const towardsViewer = new Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
            gripState.rotate(new Quaternion().setFromAxisAngle(towardsViewer, -twist), animalMiddle());
            orbit.twoFingers(0, 0, pinch);
            pair = [a, b];
        }
    };

    const pointerUp = (id: number) => {
        if (!pointers.has(id)) return;
        const wasTwo = pointers.size === 2;
        pointers.delete(id);
        if (wasTwo) {
            pair = null;
            lastFinger = null;
            gripState.letGo();
            orbit.release();
            // The finger still down carries on as a one-finger roll.
            panning = (pointers.size as number) === 1;
            return;
        }
        if (pointers.size === 0 && panning) {
            // Held still before lifting: it stays; moving: it spins on a moment.
            const still = performance.now() / 1000 - lastFingerTime > 0.08;
            gripState.letGo(flick.axis, still ? 0 : flick.speed, animalMiddle());
        }
        panning = false;
        lastFinger = null;
        downAt = null;
    };

    const goHome = () => {
        lastFinger = null;
        pair = null;
        orbit.home();
        gripState.home();
    };

    const zoom = (deltaY: number) => {
        const pinch = Math.min(Math.max(Math.exp(-deltaY * 0.0015), 0.8), 1.25);
        orbit.twoFingers(0, 0, pinch);
        orbit.release();
    };

    const resize = (nextWidth: number, nextHeight: number) => {
        width = Math.max(1, nextWidth);
        height = Math.max(1, nextHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    };

    // MARK: Frames
    let frame = 0;
    let last: number | null = null;
    const started = performance.now() / 1000;
    const render = () => {
        frame = requestAnimationFrame(render);
        const now = performance.now() / 1000;
        const elapsed = last === null ? 0 : now - last;
        last = now;
        voiceOpen = Math.min(Math.max(envelope.update(options.decibels(), elapsed), 0), 1);
        setIdle(now - started);
        gripState.step(Math.min(elapsed, 0.1));
        gripState.apply(grip);
        orbit.step(Math.min(elapsed, 0.1));
        placeCamera();
        renderer.render(scene, camera);
    };

    // Shaders compiled before the first frame (off the main thread where the
    // browser can), so the fade-in never stutters: on iOS the fur took ~1.5 s.
    await renderer.compileAsync(scene, camera).catch(() => renderer.compile(scene, camera));
    render();

    return {
        goHome,
        pointerDown,
        pointerMove,
        pointerUp,
        zoom,
        resize,
        dispose: () => {
            cancelAnimationFrame(frame);
            scene.traverse((node) => {
                const mesh = node as Mesh;
                if (!mesh.isMesh) return;
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                for (const material of materials) material.dispose();
                mesh.customDepthMaterial?.dispose();
            });
            for (const part of PART_NAMES) parts[part].dispose();
            eyeGeometry.dispose();
            cavity.geometry.dispose();
            nose?.geometry.dispose();
            floor.geometry.dispose();
            skin.dispose();
            for (const item of disposables) item.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            canvas.remove();
        }
    };
}
