/**
 * Art-direction study renders (graphics pass, Step 1: docs/ark/graphics-step1.md).
 *
 * The SAME slice of island (a beach with rocks at the waterline, a meadow
 * rising behind it to wooded hills) built three ways, so the owner can pick a
 * direction before anything in the live scene changes:
 *
 *   toon     "Crisp storybook": faceted low-poly, cel lighting, outlines, banded water.
 *   natural  "Detailed, slightly stylised natural" (the recommended default): soft rich colour,
 *            splatted ground whose detail grows as the camera comes close, depth-tinted water with
 *            shallows and foam, mossy rocks, dense wind-blown grass, flowers and pebbles.
 *   real     "Naturalistic": photographic palette, physical sky, image-based light, ambient
 *            occlusion, high-frequency detail everywhere; the heaviest.
 *
 * Everything is procedural (no downloaded assets); the animals are the Ark's
 * own AI-made models, so each direction is judged with them in it.
 * Development only: nothing in the live scene imports this.
 */

import {
    ACESFilmicToneMapping,
    AmbientLight,
    BackSide,
    Box3,
    BufferAttribute,
    BufferGeometry,
    Color,
    CylinderGeometry,
    DataTexture,
    DirectionalLight,
    DoubleSide,
    Float32BufferAttribute,
    FogExp2,
    Group,
    HalfFloatType,
    HemisphereLight,
    IcosahedronGeometry,
    InstancedMesh,
    LinearFilter,
    Material,
    MathUtils,
    Matrix4,
    Mesh,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    MeshToonMaterial,
    NearestFilter,
    PCFSoftShadowMap,
    PerspectiveCamera,
    PlaneGeometry,
    PMREMGenerator,
    Points,
    PointsMaterial,
    Quaternion,
    RedFormat,
    RGBAFormat,
    Scene,
    ShaderMaterial,
    SphereGeometry,
    SRGBColorSpace,
    UniformsLib,
    UniformsUtils,
    UnsignedByteType,
    Vector2,
    Vector3,
    WebGLRenderer,
    WebGLRenderTarget,
    type Texture
} from "three";
import {mergeGeometries, mergeVertices} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {EffectComposer} from "three/examples/jsm/postprocessing/EffectComposer.js";
import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass.js";
import {UnrealBloomPass} from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass.js";
import {OutputPass} from "three/examples/jsm/postprocessing/OutputPass.js";
import {GTAOPass} from "three/examples/jsm/postprocessing/GTAOPass.js";
import {SMAAPass} from "three/examples/jsm/postprocessing/SMAAPass.js";
import {Sky} from "three/examples/jsm/objects/Sky.js";

export type StudyDirection = "toon" | "natural" | "real";
export const STUDY_DIRECTIONS: StudyDirection[] = ["natural", "toon", "real"];
export const STUDY_VIEWS = ["wide", "rocks", "meadow"] as const;
export type StudyView = typeof STUDY_VIEWS[number];

export type ArtStudyHandle = {
    canvas: HTMLCanvasElement;
    views: string[];
    show: (view: string, time: string) => Promise<{drawCalls: number; triangles: number; pixelRatio: number; direction: string}>;
};

// MARK: - The slice of island (shared by all three)

function hash(x: number, z: number): number {
    let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, z: number): number {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const fx = x - xi;
    const fz = z - zi;
    const u = fx * fx * (3 - 2 * fx);
    const v = fz * fz * (3 - 2 * fz);
    const a = hash(xi, zi);
    const b = hash(xi + 1, zi);
    const c = hash(xi, zi + 1);
    const d = hash(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, z: number, octaves = 4): number {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += amp * vnoise(x * f + i * 17.3, z * f - i * 9.1);
        norm += amp;
        f *= 2.03;
        amp *= 0.5;
    }
    return sum / norm;
}
function seeded(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const smoothstep = (a: number, b: number, x: number) => {
    const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return t * t * (3 - 2 * t);
};

/** The waterline: z of the shore at x (the sea is at larger z, toward the camera). */
const shoreZ = (x: number) => 6 + 3.2 * Math.sin(x * 0.07 + 0.6) + 1.6 * Math.sin(x * 0.19 + 2.0);

/** Metres inland of the waterline (negative at sea). */
const inland = (x: number, z: number) => shoreZ(x) - z;

function groundHeight(x: number, z: number): number {
    const d = inland(x, z);
    let h: number;
    if (d < 0) {
        h = Math.max(-5.5, d * 0.22) + 0.35 * (fbm(x * 0.15, z * 0.15) - 0.5);
    } else {
        const beach = d * 0.075;
        const rise = smoothstep(8, 30, d) * (1.6 + 2.2 * fbm(x * 0.03, z * 0.03));
        const hills = smoothstep(26, 70, d) * (6 + 9 * fbm(x * 0.018 + 3, z * 0.018));
        const bumps = smoothstep(7, 14, d) * 0.7 * (fbm(x * 0.09, z * 0.09) - 0.5);
        h = beach + rise + hills + bumps;
        // A soft blend across the waterline.
        h = MathUtils.lerp(Math.max(-5.5, d * 0.22), h, smoothstep(-0.5, 0.5, d));
    }
    // A knoll at the meadow's left, where three trees stand.
    h += 2.4 * Math.exp(-((x + 17) ** 2 + (z + 14) ** 2) / 140);
    return h;
}

/** The rocks: a cluster at the waterline, a few up the beach, a boulder in the meadow. */
type RockSpot = {x: number; z: number; r: number; squash: number; seed: number};
function rockSpots(): RockSpot[] {
    const random = seeded(7);
    const spots: RockSpot[] = [];
    const cluster = [[-7, 0.4, 1.7], [-4.8, -0.6, 1.2], [-9.4, -0.9, 1.05], [-6.1, -2.2, 0.8], [-3.2, 1.0, 0.6], [-10.8, 0.9, 0.55], [-8.2, 2.1, 0.75], [-2.0, -1.6, 0.45]];
    for (const [x, dz, r] of cluster) spots.push({x, z: shoreZ(x) - dz, r, squash: 0.55 + random() * 0.25, seed: Math.floor(random() * 1e6)});
    spots.push({x: 9, z: shoreZ(9) - 0.2, r: 1.1, squash: 0.6, seed: 11}, {x: 11.2, z: shoreZ(11.2) + 0.8, r: 0.7, squash: 0.6, seed: 12});
    spots.push({x: 4, z: shoreZ(4) - 12, r: 1.3, squash: 0.62, seed: 21}, {x: -14, z: shoreZ(-14) - 10.5, r: 0.8, squash: 0.6, seed: 22});
    return spots;
}

// MARK: - Shared GLSL

const NOISE_GLSL = /* glsl */ `
float st_hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float st_noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    float a = st_hash(i), b = st_hash(i + vec2(1.0, 0.0)), c = st_hash(i + vec2(0.0, 1.0)), d = st_hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float st_fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * st_noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.9375; }
float st_noise3(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
    float n = i.x + i.y * 57.0 + i.z * 113.0;
    #define H3(o) fract(sin(n + o) * 43758.5453)
    float a = mix(mix(H3(0.0), H3(1.0), u.x), mix(H3(57.0), H3(58.0), u.x), u.y);
    float b = mix(mix(H3(113.0), H3(114.0), u.x), mix(H3(170.0), H3(171.0), u.x), u.y);
    return mix(a, b, u.z);
}
float st_fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * st_noise3(p); p = p * 2.07 + 11.3; a *= 0.5; } return s / 0.9375; }
// Bump from a scalar height field, in view space (Mikkelsen's surface gradient).
vec3 st_bump(vec3 pos, vec3 n, float h) {
    vec3 dpx = dFdx(pos), dpy = dFdy(pos);
    float dhx = dFdx(h), dhy = dFdy(h);
    vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
    float det = dot(dpx, r1);
    vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
    return normalize(abs(det) * n - grad);
}
`;

// MARK: - Look per direction

type Look = {
    direction: StudyDirection;
    terrainSegments: [number, number];
    grass: number;
    flowers: number;
    pebbles: number;
    farTrees: number;
    shadowMap: number;
    rockDetail: number;
    exposure: number;
    day: Light;
    night: Light;
    water: {shallow: string; mid: string; deep: string; foam: number; bands: number; glint: number; clarity: number};
    ground: {sand: [string, string]; wet: string; grass: [string, string, string]; dirt: string; rock: [string, string]; moss: string; detail: number};
};
type Light = {sun: string; sunIntensity: number; elevation: number; azimuth: number; sky: string; ground: string; hemi: number; zenith: string; horizon: string; fog: string; fogDensity: number; stars: number};

const LOOKS: Record<StudyDirection, Look> = {
    natural: {
        direction: "natural",
        terrainSegments: [300, 220],
        grass: 26000,
        flowers: 1600,
        pebbles: 900,
        farTrees: 170,
        shadowMap: 2048,
        rockDetail: 4,
        exposure: 0.95,
        day: {sun: "#fff0d8", sunIntensity: 3.1, elevation: 38, azimuth: -55, sky: "#cfe3ff", ground: "#7a6a48", hemi: 1.15, zenith: "#5d93d6", horizon: "#d8e6ee", fog: "#cddde6", fogDensity: 0.0042, stars: 0},
        night: {sun: "#a9c2ff", sunIntensity: 0.95, elevation: 34, azimuth: 40, sky: "#2b4170", ground: "#141820", hemi: 0.55, zenith: "#0b1530", horizon: "#22355c", fog: "#1a2846", fogDensity: 0.006, stars: 1},
        water: {shallow: "#5fd0c4", mid: "#1f9bb0", deep: "#0f4f7a", foam: 1, bands: 0, glint: 1, clarity: 0.75},
        ground: {sand: ["#e9d6a6", "#d9c08a"], wet: "#a8946b", grass: ["#7fae47", "#5d9437", "#a7b85a"], dirt: "#8a6d48", rock: ["#9a958a", "#7d776c"], moss: "#6f8f3a", detail: 1}
    },
    toon: {
        direction: "toon",
        terrainSegments: [130, 96],
        grass: 3500,
        flowers: 380,
        pebbles: 0,
        farTrees: 90,
        shadowMap: 1024,
        rockDetail: 1,
        exposure: 1.0,
        day: {sun: "#fff4dc", sunIntensity: 2.6, elevation: 42, azimuth: -55, sky: "#d6eaff", ground: "#9f8a5a", hemi: 1.45, zenith: "#58a6f0", horizon: "#c8ecff", fog: "#c8ecff", fogDensity: 0.0035, stars: 0},
        night: {sun: "#9fb6ff", sunIntensity: 1.1, elevation: 36, azimuth: 40, sky: "#3a4f8a", ground: "#1b1f33", hemi: 0.8, zenith: "#101c44", horizon: "#2d4278", fog: "#23325e", fogDensity: 0.005, stars: 1},
        water: {shallow: "#7fe3d6", mid: "#2fb3c8", deep: "#1f6fb0", foam: 1, bands: 1, glint: 0.6, clarity: 0.5},
        ground: {sand: ["#f3dfa6", "#f3dfa6"], wet: "#d8bd85", grass: ["#86c34a", "#6aad3c", "#a8cf55"], dirt: "#a07a4c", rock: ["#a7a9ad", "#8d9096"], moss: "#7aa43f", detail: 0}
    },
    real: {
        direction: "real",
        terrainSegments: [380, 280],
        grass: 48000,
        flowers: 900,
        pebbles: 2400,
        farTrees: 260,
        shadowMap: 4096,
        rockDetail: 5,
        exposure: 0.62,
        day: {sun: "#fff6ea", sunIntensity: 4.2, elevation: 38, azimuth: -55, sky: "#b9cbe0", ground: "#5c5040", hemi: 0.55, zenith: "#4b78b5", horizon: "#c4d2dc", fog: "#c0cdd6", fogDensity: 0.0048, stars: 0},
        night: {sun: "#8ea8e6", sunIntensity: 0.55, elevation: 34, azimuth: 40, sky: "#1a2238", ground: "#08090c", hemi: 0.25, zenith: "#04070f", horizon: "#121a2c", fog: "#0e1422", fogDensity: 0.007, stars: 1},
        water: {shallow: "#6fb8ad", mid: "#22717f", deep: "#0b2f45", foam: 0.7, bands: 0, glint: 1.4, clarity: 0.9},
        ground: {sand: ["#cdbb95", "#b9a47c"], wet: "#7f6f55", grass: ["#6a8a3c", "#4f6f2e", "#8f9452"], dirt: "#6e5a40", rock: ["#8a8478", "#68625a"], moss: "#5a6f2e", detail: 2}
    }
};

// MARK: - Builders

/** An icosphere with shared vertices, so it can be displaced and shaded smooth (three's own is one triangle per face). */
function smoothIco(radius: number, detail: number): BufferGeometry {
    const geometry = new IcosahedronGeometry(radius, detail);
    geometry.deleteAttribute("normal");
    geometry.deleteAttribute("uv");
    return mergeVertices(geometry);
}

const toonGradient = (() => {
    const data = new Uint8Array([90, 170, 255]);
    const texture = new DataTexture(data, 3, 1, RedFormat, UnsignedByteType);
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.needsUpdate = true;
    return texture;
})();

/** Ground: one height field; the look decides how its surface is drawn. */
function buildTerrain(look: Look, uniforms: {time: {value: number}}): Mesh {
    const [sx, sz] = look.terrainSegments;
    const geometry = new PlaneGeometry(260, 200, sx, sz);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0, -60);
    const position = geometry.attributes.position as BufferAttribute;
    for (let i = 0; i < position.count; i++) position.setY(i, groundHeight(position.getX(i), position.getZ(i)));
    if (look.direction === "toon") {
        // Faceted: every triangle its own colour, read from the same splat as the others.
        const flat = geometry.toNonIndexed();
        const p = flat.attributes.position as BufferAttribute;
        flat.computeVertexNormals();
        const n = flat.attributes.normal as BufferAttribute;
        const colors = new Float32Array(p.count * 3);
        const c = new Color();
        for (let i = 0; i < p.count; i += 3) {
            const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
            const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
            const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
            const slope = 1 - n.getY(i);
            const patch = fbm(x * 0.06, z * 0.06);
            if (y < -0.05) c.set(look.ground.wet).multiplyScalar(0.92);
            else if (y < 0.55 + 0.2 * (patch - 0.5)) c.set(y < 0.12 ? look.ground.wet : look.ground.sand[0]);
            else if (slope > 0.42) c.set(look.ground.rock[0]);
            else c.set(patch > 0.62 ? look.ground.grass[2] : patch > 0.45 ? look.ground.grass[0] : look.ground.grass[1]);
            for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
        }
        flat.setAttribute("color", new Float32BufferAttribute(colors, 3));
        const mesh = new Mesh(flat, new MeshToonMaterial({vertexColors: true, gradientMap: toonGradient}));
        mesh.receiveShadow = true;
        return mesh;
    }
    geometry.computeVertexNormals();
    const g = look.ground;
    const material = new MeshStandardMaterial({color: "#ffffff", roughness: 0.92, metalness: 0});
    const detail = g.detail;
    material.onBeforeCompile = (shader) => {
        shader.uniforms.stTime = uniforms.time;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 stWorld;\nvarying vec3 stWorldNormal;")
            .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nstWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nstWorldNormal = normalize(mat3(modelMatrix) * objectNormal);");
        const col = (hex: string) => {
            const c = new Color(hex);
            return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
        };
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\nvarying vec3 stWorld;\nvarying vec3 stWorldNormal;\nuniform float stTime;\nfloat stBumpH;\n${NOISE_GLSL}`)
            .replace("#include <color_fragment>", /* glsl */ `#include <color_fragment>
{
    vec2 p = stWorld.xz;
    float y = stWorld.y;
    float viewDist = length(vViewPosition);
    float near = 1.0 - smoothstep(6.0, ${detail >= 2 ? "60.0" : "42.0"}, viewDist);
    float macro = st_fbm(p * 0.035);
    float meso = st_fbm(p * 0.32);
    float micro = st_noise(p * 5.5) * 0.6 + st_noise(p * 14.0) * 0.4;
    float slope = 1.0 - normalize(stWorldNormal).y;
    // Sand: two tones, ripples along the shore, darker and smoother where the waves reach.
    vec3 sand = mix(${col(g.sand[0])}, ${col(g.sand[1])}, smoothstep(0.3, 0.7, meso));
    float ripple = sin(p.y * 3.1 + st_noise(p * 0.6) * 5.0) * 0.5 + 0.5;
    sand *= 0.94 + 0.08 * ripple * near;
    sand *= 0.92 + 0.16 * micro * near;
    float wetLine = 0.18 + 0.05 * sin(stTime * 0.6 + p.x * 0.3);
    vec3 wet = ${col(g.wet)} * (0.92 + 0.12 * meso);
    // Grass: three greens in patches, drier on the rises, dirt where it is worn.
    vec3 grass = mix(${col(g.grass[1])}, ${col(g.grass[0])}, smoothstep(0.35, 0.65, macro));
    grass = mix(grass, ${col(g.grass[2])}, smoothstep(0.58, 0.8, st_fbm(p * 0.08 + 4.0)));
    grass *= 0.86 + 0.24 * meso;
    grass *= 0.9 + 0.2 * micro * near;
    vec3 dirt = ${col(g.dirt)} * (0.85 + 0.25 * micro);
    grass = mix(grass, dirt, smoothstep(0.66, 0.82, st_fbm(p * 0.22 + 9.0)) * 0.7);
    vec3 rock = mix(${col(g.rock[0])}, ${col(g.rock[1])}, meso) * (0.85 + 0.3 * micro);
    float grassW = smoothstep(0.5, 0.95, y + (meso - 0.5) * 0.7);
    float wetW = 1.0 - smoothstep(wetLine - 0.08, wetLine + 0.06, y);
    vec3 c = mix(sand, wet, wetW);
    c = mix(c, grass, grassW);
    c = mix(c, rock, smoothstep(0.32, 0.5, slope + (meso - 0.5) * 0.25));
    // Under the sea the bed fades to a pale, bluish sand.
    c = mix(c, c * vec3(0.75, 0.88, 0.92), 1.0 - smoothstep(-1.2, -0.1, y));
    diffuseColor.rgb = c;
    // The bump: pebbly sand, blades and clods in the grass, all fading out with distance.
    float sandBump = (micro * 0.5 + ripple * 0.5) * (1.0 - grassW);
    float grassBump = st_noise(p * 22.0) * grassW;
    stBumpH = (sandBump * 0.035 + grassBump * 0.05 + meso * 0.06) * near * ${detail >= 2 ? "1.6" : "1.0"};
}`)
            .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nnormal = st_bump(-vViewPosition, normal, stBumpH);")
            .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(0.95, 0.45, 1.0 - smoothstep(0.05, 0.3, stWorld.y));");
    };
    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
}

/** A displaced rock: the same seed and shape in every look, the surface its own. */
function rockGeometry(spot: RockSpot, detail: number, flat: boolean): BufferGeometry {
    let geometry: BufferGeometry = smoothIco(1, detail);
    const random = seeded(spot.seed);
    const ox = random() * 100;
    const oz = random() * 100;
    const p = geometry.attributes.position as BufferAttribute;
    const v = new Vector3();
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).normalize();
        const n = fbm(v.x * 1.3 + ox, v.z * 1.3 + v.y * 0.7 + oz, 4);
        const fine = flat ? 0 : (fbm(v.x * 6 + ox, v.y * 6 + v.z * 3 + oz, 3) - 0.5) * 0.12;
        // Flatter underneath and on top: a weathered stone, not a ball.
        const radius = 0.78 + 0.45 * n + fine;
        v.multiplyScalar(radius);
        v.y *= v.y > 0 ? spot.squash : 0.5;
        if (v.y > spot.squash * 0.55) v.y = spot.squash * 0.55 + (v.y - spot.squash * 0.55) * 0.4;
        p.setXYZ(i, v.x, v.y, v.z);
    }
    if (flat) geometry = geometry.toNonIndexed();
    geometry.computeVertexNormals();
    return geometry;
}

function rockMaterial(look: Look): Material {
    const g = look.ground;
    if (look.direction === "toon") return new MeshToonMaterial({color: g.rock[0], gradientMap: toonGradient});
    const material = new MeshStandardMaterial({color: "#ffffff", roughness: 0.9});
    const strength = look.direction === "real" ? 1.7 : 1.0;
    material.onBeforeCompile = (shader) => {
        const col = (hex: string) => {
            const c = new Color(hex);
            return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
        };
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 stWorld;\nvarying vec3 stWorldNormal;")
            .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nstWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nstWorldNormal = normalize(mat3(modelMatrix) * objectNormal);");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\nvarying vec3 stWorld;\nvarying vec3 stWorldNormal;\nfloat stBumpH;\n${NOISE_GLSL}`)
            .replace("#include <color_fragment>", /* glsl */ `#include <color_fragment>
{
    vec3 w = stWorld;
    vec3 n = normalize(stWorldNormal);
    float near = 1.0 - smoothstep(4.0, 40.0, length(vViewPosition));
    float strata = st_fbm3(vec3(w.x * 0.6, w.y * 3.2, w.z * 0.6));
    float grain = st_noise3(w * 9.0) * 0.5 + st_noise3(w * 23.0) * 0.5;
    vec3 c = mix(${col(g.rock[1])}, ${col(g.rock[0])}, strata);
    c *= 0.86 + 0.24 * grain * (0.4 + 0.6 * near);
    // Moss and lichen on the tops that stay dry; dark and wet near the waterline; a pale salt line above it.
    float top = smoothstep(0.45, 0.85, n.y) * smoothstep(0.35, 0.65, st_fbm3(w * 1.4)) * smoothstep(0.35, 0.9, w.y);
    c = mix(c, ${col(g.moss)} * (0.8 + 0.4 * grain), top * 0.85);
    float lichen = smoothstep(0.7, 0.9, st_noise3(w * 7.0) * st_noise3(w * 2.3 + 4.0) * 1.6) * ${look.direction === "real" ? "0.35" : "0.2"};
    c = mix(c, vec3(0.86, 0.82, 0.6), lichen * (1.0 - top));
    float wet = 1.0 - smoothstep(0.05, 0.4, w.y);
    c *= mix(1.0, 0.58, wet);
    c = mix(c, c * 1.18 + 0.03, smoothstep(0.38, 0.45, w.y) * (1.0 - smoothstep(0.45, 0.55, w.y)) * 0.6);
    diffuseColor.rgb = c;
    stBumpH = (strata * 0.12 + grain * 0.035 * near) * ${strength.toFixed(2)};
}`)
            .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nnormal = st_bump(-vViewPosition, normal, stBumpH);")
            .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(0.92, 0.35, 1.0 - smoothstep(0.05, 0.4, stWorld.y));");
    };
    return material;
}

/** An outline for the toon look: the back faces, pushed out and drawn dark. */
function outline(source: BufferGeometry, width: number): Mesh {
    const bare = new BufferGeometry();
    bare.setAttribute("position", source.attributes.position);
    if (source.index) bare.setIndex(source.index);
    const geometry = mergeVertices(bare.index ? bare.toNonIndexed() : bare, 1e-3);
    geometry.computeVertexNormals();
    const material = new ShaderMaterial({
        side: BackSide,
        uniforms: {width: {value: width}, color: {value: new Color("#2a2f3a")}},
        vertexShader: `
        uniform float width;
        void main() {
            vec3 transformed = position + normal * width;
            vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
            mv = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
            #endif
            gl_Position = projectionMatrix * mv;
        }`,
        fragmentShader: "uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }"
    });
    return new Mesh(geometry, material);
}

/** The sea: depth-tinted by the same height field, shallows, foam at the waterline, a moving surface. */
function buildWater(look: Look, uniforms: {time: {value: number}; sunDir: {value: Vector3}; sunColor: {value: Color}; zenith: {value: Color}; horizon: {value: Color}; night: {value: number}}): Mesh {
    // The depth below the surface, sampled once from the height field: 0 at the shore, 1 at 6 m.
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
            const x = -130 + (i / (size - 1)) * 260;
            const z = -60 + (j / (size - 1)) * 160;
            const depth = Math.min(Math.max(-groundHeight(x, z) / 6, 0), 1);
            const k = (j * size + i) * 4;
            data[k] = Math.round(depth * 255);
            data[k + 1] = Math.round(Math.min(Math.max(inland(x, z) * -0.1, 0), 1) * 255);
            data[k + 3] = 255;
        }
    }
    const depthTex = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
    depthTex.minFilter = LinearFilter;
    depthTex.magFilter = LinearFilter;
    depthTex.needsUpdate = true;
    const w = look.water;
    const material = new ShaderMaterial({
        transparent: true,
        fog: true,
        uniforms: UniformsUtils.merge([UniformsLib.fog, {
            depthTex: {value: depthTex},
            shallow: {value: new Color(w.shallow)},
            mid: {value: new Color(w.mid)},
            deep: {value: new Color(w.deep)},
            foamAmount: {value: w.foam},
            bands: {value: w.bands},
            glint: {value: w.glint},
            clarity: {value: w.clarity}
        }]),
        vertexShader: /* glsl */ `
        varying vec3 vWorld;
        varying vec3 vViewPosition;
        #include <fog_pars_vertex>
        void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vWorld = world.xyz;
            vec4 mvPosition = viewMatrix * world;
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
        }`,
        fragmentShader: /* glsl */ `
        uniform sampler2D depthTex;
        uniform vec3 shallow, mid, deep, sunColor, zenith, horizon;
        uniform vec3 sunDir;
        uniform float time, foamAmount, bands, glint, clarity, night;
        varying vec3 vWorld;
        varying vec3 vViewPosition;
        #include <common>
        #include <fog_pars_fragment>
        ${NOISE_GLSL}
        void main() {
            vec2 uv = vec2((vWorld.x + 130.0) / 260.0, (vWorld.z + 60.0) / 160.0);
            vec4 d = texture2D(depthTex, clamp(uv, 0.0, 1.0));
            float depth = (uv.x < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 1.0 : d.r;
            float off = d.g;
            vec3 V = normalize(cameraPosition - vWorld);
            float dist = length(vViewPosition);
            // Ripples: two drifting octaves of noise as a height, its slope the normal.
            vec2 p = vWorld.xz;
            float e = 0.08;
            float h0 = st_fbm(p * 0.35 + vec2(time * 0.05, time * 0.03)) + 0.5 * st_noise(p * 1.4 - vec2(time * 0.21, -time * 0.13));
            float hx = st_fbm((p + vec2(e, 0.0)) * 0.35 + vec2(time * 0.05, time * 0.03)) + 0.5 * st_noise((p + vec2(e, 0.0)) * 1.4 - vec2(time * 0.21, -time * 0.13));
            float hz = st_fbm((p + vec2(0.0, e)) * 0.35 + vec2(time * 0.05, time * 0.03)) + 0.5 * st_noise((p + vec2(0.0, e)) * 1.4 - vec2(time * 0.21, -time * 0.13));
            float ripple = (1.0 - bands * 0.75) * 0.9 * (1.0 - smoothstep(30.0, 160.0, dist));
            vec3 N = normalize(vec3(-(hx - h0) / e * ripple, 1.0, -(hz - h0) / e * ripple));
            // The water's own colour by depth: clear turquoise over sand, blue farther out.
            float k = smoothstep(0.0, 0.55, depth);
            vec3 body = bands > 0.5
                ? (depth < 0.08 ? shallow : depth < 0.3 ? mid : deep)
                : mix(mix(shallow, mid, smoothstep(0.0, 0.18, depth)), deep, smoothstep(0.15, 0.7, depth));
            // The sky in it, and the sun's (or moon's) glint.
            vec3 R = reflect(-V, N);
            float up = clamp(R.y, 0.0, 1.0);
            vec3 sky = mix(horizon, zenith, pow(up, 0.6));
            float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
            vec3 c = mix(body * (0.55 + 0.45 * (1.0 - night)), sky, fres * (bands > 0.5 ? 0.35 : 0.8));
            float spec = pow(max(dot(R, normalize(sunDir)), 0.0), bands > 0.5 ? 60.0 : 400.0);
            c += sunColor * spec * glint * (bands > 0.5 ? step(0.5, spec) * 1.5 : 3.0);
            // Foam: the wash at the waterline and lines that come in with the waves.
            float shore = 1.0 - smoothstep(0.0, 0.06, depth);
            float wave = sin(depth * 120.0 - time * 1.6 + st_noise(p * 0.5) * 4.0);
            float foam;
            if (bands > 0.5) foam = step(0.75, shore + 0.12 * wave) + step(0.92, wave) * (1.0 - smoothstep(0.04, 0.09, depth)) * 0.9;
            else foam = smoothstep(0.55, 1.0, shore + 0.2 * wave * shore) * (0.55 + 0.45 * st_noise(p * 3.0 + time * 0.3))
                     + smoothstep(0.8, 1.0, wave) * (1.0 - smoothstep(0.03, 0.1, depth)) * 0.5 * st_noise(p * 2.0);
            foam = clamp(foam * foamAmount, 0.0, 1.0);
            c = mix(c, vec3(0.95, 0.97, 0.97) * (1.0 - 0.75 * night), foam);
            // See-through in the shallows: the sand under it shows.
            float alpha = mix(1.0 - clarity, 1.0, smoothstep(0.0, 0.35, depth));
            alpha = max(alpha, foam);
            alpha = max(alpha, fres * 0.8);
            gl_FragColor = vec4(c, mix(alpha, 1.0, off * 0.0));
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            #include <fog_fragment>
        }`
    });
    material.uniforms.time = uniforms.time;
    material.uniforms.sunDir = uniforms.sunDir;
    material.uniforms.sunColor = uniforms.sunColor;
    material.uniforms.zenith = uniforms.zenith;
    material.uniforms.horizon = uniforms.horizon;
    material.uniforms.night = uniforms.night;
    const mesh = new Mesh(new PlaneGeometry(3000, 3000, 1, 1).rotateX(-Math.PI / 2), material);
    mesh.position.y = 0.02;
    mesh.renderOrder = 2;
    return mesh;
}

/** Grass: instanced clumps of blades, bending in the wind, coloured to the ground under them. */
function buildGrass(look: Look, uniforms: {time: {value: number}}, avoid: RockSpot[]): InstancedMesh | null {
    if (!look.grass) return null;
    const toon = look.direction === "toon";
    const blades: BufferGeometry[] = [];
    const bladeCount = toon ? 3 : 5;
    const segments = toon ? 1 : 3;
    for (let b = 0; b < bladeCount; b++) {
        const angle = (b / bladeCount) * Math.PI + (b % 2) * 0.3;
        const height = (toon ? 0.42 : look.direction === "real" ? 0.5 : 0.42) * (0.7 + 0.5 * ((b * 37) % 10) / 10);
        const width = toon ? 0.09 : look.direction === "real" ? 0.022 : 0.035;
        const lean = 0.12 * ((b * 13) % 7) / 7;
        const positions: number[] = [];
        const normals: number[] = [];
        const heights: number[] = [];
        const index: number[] = [];
        for (let s = 0; s <= segments; s++) {
            const t = s / segments;
            const w = width * (1 - t * 0.92);
            const bend = lean * t * t;
            for (const side of [-1, 1]) {
                const x = side * w;
                positions.push(Math.cos(angle) * x + Math.sin(angle) * bend + (b - 2) * 0.03, t * height, Math.sin(angle) * x - Math.cos(angle) * bend + ((b * 7) % 5 - 2) * 0.03);
                normals.push(0, 1, 0);
                heights.push(t);
            }
            if (s < segments) {
                const a = s * 2;
                index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            }
        }
        const g = new BufferGeometry();
        g.setAttribute("position", new Float32BufferAttribute(positions, 3));
        g.setAttribute("normal", new Float32BufferAttribute(normals, 3));
        g.setAttribute("bladeT", new Float32BufferAttribute(heights, 1));
        g.setIndex(index);
        blades.push(g);
    }
    const geometry = mergeGeometries(blades)!;
    const material = toon
        ? new MeshToonMaterial({color: "#ffffff", gradientMap: toonGradient, side: DoubleSide})
        : new MeshStandardMaterial({color: "#ffffff", roughness: 0.85, side: DoubleSide});
    material.onBeforeCompile = (shader) => {
        shader.uniforms.stTime = uniforms.time;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nattribute float bladeT;\nuniform float stTime;\nvarying float vBladeT;")
            .replace("#include <begin_vertex>", /* glsl */ `#include <begin_vertex>
vBladeT = bladeT;
{
    vec3 base = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float gust = sin(stTime * 1.3 + base.x * 0.21 + base.z * 0.17) * 0.5 + sin(stTime * 2.7 + base.x * 0.7) * 0.25;
    transformed.x += gust * bladeT * bladeT * 0.12;
    transformed.z += gust * bladeT * bladeT * 0.06;
}`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying float vBladeT;")
            .replace("#include <color_fragment>", `#include <color_fragment>\ndiffuseColor.rgb *= mix(${toon ? "0.85" : "0.62"}, 1.1, vBladeT);`);
    };
    const mesh = new InstancedMesh(geometry, material, look.grass);
    const random = seeded(99);
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const t = new Vector3();
    const c = new Color();
    const g = look.ground;
    let placed = 0;
    let tries = 0;
    while (placed < look.grass && tries < look.grass * 8) {
        tries++;
        // Densest near the camera's side of the meadow; thins up the hills.
        const x = -46 + random() * 92;
        const z = shoreZ(x) - 7 - random() ** 1.6 * 46;
        const y = groundHeight(x, z);
        if (y < 0.55) continue;
        const patch = fbm(x * 0.12, z * 0.12);
        if (random() > 0.35 + patch) continue;
        if (avoid.some((r) => Math.hypot(r.x - x, r.z - z) < r.r * 0.9)) continue;
        q.setFromAxisAngle(new Vector3(0, 1, 0), random() * Math.PI * 2);
        const size = 0.7 + random() * 0.7 + patch * 0.4;
        s.set(size, size * (0.8 + random() * 0.5), size);
        t.set(x, y - 0.02, z);
        m.compose(t, q, s);
        mesh.setMatrixAt(placed, m);
        const tone = fbm(x * 0.035, z * 0.035);
        c.set(tone > 0.55 ? g.grass[0] : g.grass[1]).lerp(new Color(g.grass[2]), smoothstep(0.58, 0.8, fbm(x * 0.08 + 4, z * 0.08)) * 0.8);
        c.multiplyScalar(0.85 + random() * 0.3);
        mesh.setColorAt(placed, c);
        placed++;
    }
    mesh.count = placed;
    mesh.receiveShadow = true;
    mesh.castShadow = look.direction !== "toon";
    return mesh;
}

/** Flowers: small heads on the meadow in drifts of one colour. */
function buildFlowers(look: Look): InstancedMesh | null {
    if (!look.flowers) return null;
    const toon = look.direction === "toon";
    const head = new IcosahedronGeometry(toon ? 0.08 : 0.065, toon ? 0 : 1);
    head.scale(1, 0.55, 1);
    head.translate(0, toon ? 0.32 : 0.36, 0);
    const stem = new CylinderGeometry(0.006, 0.008, toon ? 0.32 : 0.36, 3, 1);
    stem.translate(0, toon ? 0.16 : 0.18, 0);
    stem.deleteAttribute("uv");
    head.deleteAttribute("uv");
    const geometry = mergeGeometries([head.toNonIndexed(), stem.toNonIndexed()])!;
    const material = toon ? new MeshToonMaterial({color: "#ffffff", gradientMap: toonGradient}) : new MeshStandardMaterial({color: "#ffffff", roughness: 0.7});
    const mesh = new InstancedMesh(geometry, material, look.flowers);
    const random = seeded(5);
    const colors = look.direction === "real" ? ["#f2efe4", "#e7c84a", "#b48fd0", "#e7e2d5"] : ["#ffffff", "#ffd84a", "#c58ef0", "#ff8fb0", "#ff9d4a"];
    const m = new Matrix4();
    const c = new Color();
    let placed = 0;
    let tries = 0;
    while (placed < look.flowers && tries < look.flowers * 10) {
        tries++;
        const x = -40 + random() * 80;
        const z = shoreZ(x) - 9 - random() ** 1.3 * 26;
        const y = groundHeight(x, z);
        if (y < 0.7) continue;
        const drift = fbm(x * 0.09 + 30, z * 0.09);
        if (drift < 0.55) continue;
        const kind = Math.floor(vnoise(x * 0.12 + 60, z * 0.12) * colors.length * 0.999);
        const size = 0.8 + random() * 0.5;
        m.makeRotationY(random() * 6.28).scale(new Vector3(size, size * (0.8 + random() * 0.4), size)).setPosition(x, y - 0.02, z);
        mesh.setMatrixAt(placed, m);
        mesh.setColorAt(placed, c.set(colors[kind]));
        placed++;
    }
    mesh.count = placed;
    mesh.castShadow = !toon;
    return mesh;
}

/** Pebbles and shells along the wet sand and the beach. */
function buildPebbles(look: Look): InstancedMesh | null {
    if (!look.pebbles) return null;
    const material = new MeshStandardMaterial({color: "#ffffff", roughness: 0.55});
    const tones = ["#cfc6b4", "#a9a296", "#8b857b", "#e3dccb", "#b7a58a", "#f2ece0"];
    const geometry = new IcosahedronGeometry(0.06, 1);
    geometry.scale(1, 0.5, 0.8);
    const mesh = new InstancedMesh(geometry, material, look.pebbles);
    const random = seeded(3);
    const cluster = rockSpots().slice(0, 8);
    const m = new Matrix4();
    let placed = 0;
    let tries = 0;
    while (placed < look.pebbles && tries < look.pebbles * 10) {
        tries++;
        const x = -30 + random() * 60;
        const d = -1 + random() ** 1.5 * 9;
        const z = shoreZ(x) - d;
        // Thickest round the rocks, in a band at the high-water line.
        const near = Math.min(...cluster.map((r) => Math.hypot(r.x - x, r.z - z)));
        if (random() > 0.25 + 0.9 * smoothstep(7, 1.5, near) + 0.4 * smoothstep(1.5, 0.5, Math.abs(d - 2.2))) continue;
        const y = groundHeight(x, z);
        const size = 0.4 + random() ** 2 * 2.2;
        m.makeRotationY(random() * 6.28).scale(new Vector3(size, size, size)).setPosition(x, y + 0.01, z);
        mesh.setMatrixAt(placed, m);
        mesh.setColorAt(placed, new Color(tones[Math.floor(random() * tones.length)]));
        placed++;
    }
    mesh.count = placed;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

/** Trees: near ones on the knoll, far ones up the hills, the crown in the look's own shape. */
function buildTrees(look: Look, near: Array<{x: number; z: number; s: number}>, uniforms: {time: {value: number}}): Group {
    const group = new Group();
    const toon = look.direction === "toon";
    const real = look.direction === "real";
    const trunkGeometry = new CylinderGeometry(0.12, 0.22, 2.6, toon ? 5 : 8, 1);
    trunkGeometry.translate(0, 1.3, 0);
    // The crown: blobs of foliage (toon: faceted; natural: soft lumps with leaf texture; real: many smaller clumps).
    const blobs: BufferGeometry[] = [];
    const random = seeded(31);
    const clumps = toon ? 3 : real ? 14 : 7;
    for (let i = 0; i < clumps; i++) {
        const r = toon ? 1.1 - i * 0.18 : real ? 0.55 + random() * 0.35 : 0.8 + random() * 0.4;
        const g = smoothIco(r, toon ? 1 : 2);
        const p = g.attributes.position as BufferAttribute;
        const v = new Vector3();
        for (let k = 0; k < p.count; k++) {
            v.fromBufferAttribute(p, k);
            v.multiplyScalar(1 + (toon ? 0 : 0.18 * (fbm(v.x * 2 + i, v.y * 2 + v.z, 3) - 0.5)));
            p.setXYZ(k, v.x, v.y, v.z);
        }
        const a = random() * Math.PI * 2;
        const spread = toon ? 0.35 : real ? 1.1 : 0.85;
        g.translate(Math.cos(a) * spread * random(), 2.7 + (toon ? i * 0.7 : random() * 1.5), Math.sin(a) * spread * random());
        blobs.push(toon ? g.toNonIndexed() : g);
    }
    const crownGeometry = mergeGeometries(blobs)!;
    crownGeometry.computeVertexNormals();
    const leafColour = toon ? "#4fa83f" : real ? "#40592a" : "#5a8f36";
    const trunkMaterial = toon ? new MeshToonMaterial({color: "#7a5532", gradientMap: toonGradient}) : new MeshStandardMaterial({color: real ? "#4a3d30" : "#6b4f36", roughness: 0.95});
    const crownMaterial = toon ? new MeshToonMaterial({color: "#ffffff", gradientMap: toonGradient}) : new MeshStandardMaterial({color: "#ffffff", roughness: 0.8});
    if (!toon) {
        crownMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.stTime = uniforms.time;
            shader.vertexShader = shader.vertexShader
                .replace("#include <common>", "#include <common>\nvarying vec3 stLocal;\nuniform float stTime;")
                .replace("#include <begin_vertex>", "#include <begin_vertex>\nstLocal = position;\ntransformed.x += sin(stTime * 1.1 + position.y) * 0.03 * position.y * 0.3;");
            shader.fragmentShader = shader.fragmentShader
                .replace("#include <common>", `#include <common>\nvarying vec3 stLocal;\nfloat stBumpH;\n${NOISE_GLSL}`)
                .replace("#include <color_fragment>", /* glsl */ `#include <color_fragment>
{
    float leaves = st_noise3(stLocal * ${real ? "11.0" : "6.5"});
    float clump = st_fbm3(stLocal * 1.6);
    // Lighter where the crown faces up and out, darker deep inside it: a cheap stand-in for light through leaves.
    float lift = smoothstep(1.8, 5.0, stLocal.y);
    diffuseColor.rgb *= (0.62 + 0.5 * leaves) * (0.8 + 0.35 * clump) * (0.8 + 0.3 * lift);
    stBumpH = leaves * ${real ? "0.14" : "0.09"};
}`)
                .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nnormal = st_bump(-vViewPosition, normal, stBumpH);");
        };
    }
    const all = [...near.map((t) => ({...t, nearTree: true})), ...(() => {
        const list: Array<{x: number; z: number; s: number; nearTree: boolean}> = [];
        const r = seeded(77);
        let tries = 0;
        while (list.length < look.farTrees && tries < look.farTrees * 20) {
            tries++;
            const x = -120 + r() * 240;
            const d = 24 + r() * 120;
            const z = shoreZ(x) - d;
            if (fbm(x * 0.03 + 8, z * 0.03) < 0.45 - smoothstep(30, 80, d) * 0.2) continue;
            if (Math.hypot(x + 17, z + 14) < 9) continue;
            list.push({x, z, s: 0.8 + r() * 0.6, nearTree: false});
        }
        return list;
    })()];
    const trunks = new InstancedMesh(trunkGeometry, trunkMaterial, all.length);
    const crowns = new InstancedMesh(crownGeometry, crownMaterial, all.length);
    const m = new Matrix4();
    const c = new Color();
    const r = seeded(4);
    all.forEach((tree, i) => {
        const y = groundHeight(tree.x, tree.z);
        m.makeRotationY(r() * 6.28).scale(new Vector3(tree.s, tree.s * (0.9 + r() * 0.3), tree.s)).setPosition(tree.x, y - 0.1, tree.z);
        trunks.setMatrixAt(i, m);
        crowns.setMatrixAt(i, m);
        crowns.setColorAt(i, c.set(leafColour).offsetHSL((r() - 0.5) * 0.05, (r() - 0.5) * 0.1, (r() - 0.5) * 0.08));
    });
    for (const mesh of [trunks, crowns]) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    }
    if (toon) {
        const line = outline(crownGeometry, 0.05);
        const lines = new InstancedMesh(line.geometry, line.material as Material, all.length);
        for (let i = 0; i < all.length; i++) {
            crowns.getMatrixAt(i, m);
            lines.setMatrixAt(i, m);
        }
        (lines.material as ShaderMaterial).defines = {USE_INSTANCING: ""};
        group.add(lines);
    }
    return group;
}

/** The sky dome: a gradient with a soft sun (or moon) glow; stars at night. */
function buildSky(uniforms: {zenith: {value: Color}; horizon: {value: Color}; sunDir: {value: Vector3}; sunColor: {value: Color}; night: {value: number}}): Mesh {
    const material = new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        uniforms: {zenith: uniforms.zenith, horizon: uniforms.horizon, sunDir: uniforms.sunDir, sunColor: uniforms.sunColor, night: uniforms.night},
        vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }",
        fragmentShader: /* glsl */ `
        uniform vec3 zenith, horizon, sunColor, sunDir;
        uniform float night;
        varying vec3 vDir;
        void main() {
            vec3 d = normalize(vDir);
            float up = clamp(d.y, 0.0, 1.0);
            vec3 c = mix(horizon, zenith, pow(up, 0.55));
            float s = max(dot(d, normalize(sunDir)), 0.0);
            c += sunColor * (pow(s, 600.0) * (night > 0.5 ? 2.5 : 6.0) + pow(s, 12.0) * 0.18 * (1.0 - night * 0.6));
            c = mix(c, horizon * 0.9, smoothstep(0.0, -0.2, d.y));
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
        }`
    });
    const mesh = new Mesh(new SphereGeometry(1500, 32, 16), material);
    mesh.renderOrder = -10;
    mesh.frustumCulled = false;
    return mesh;
}

function buildStars(): Points {
    const random = seeded(12);
    const positions: number[] = [];
    for (let i = 0; i < 1400; i++) {
        const u = random() * Math.PI * 2;
        const y = 0.05 + random() * 0.95;
        const r = Math.sqrt(1 - y * y);
        positions.push(Math.cos(u) * r * 1400, y * 1400, Math.sin(u) * r * 1400);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const points = new Points(geometry, new PointsMaterial({color: "#dfe8ff", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false}));
    points.frustumCulled = false;
    return points;
}

// MARK: - The Ark's own animals in the slice

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";

type AnimalSpot = {slug: string; x: number; z: number; length: number; yaw: number; onRock?: boolean};
const ANIMALS: AnimalSpot[] = [
    {slug: "harbor-seal", x: -1.2, z: shoreZ(-1.2) + 0.4, length: 1.6, yaw: 2.2},
    {slug: "atlantic-puffin", x: -7, z: shoreZ(-7) - 0.4, length: 0.32, yaw: 0.6, onRock: true},
    {slug: "atlantic-puffin", x: -4.8, z: shoreZ(-4.8) + 0.6, length: 0.3, yaw: -0.4, onRock: true},
    {slug: "roe-deer", x: 1.5, z: shoreZ(1.5) - 13, length: 1.2, yaw: 0.9},
    {slug: "red-fox", x: -5, z: shoreZ(-5) - 9.5, length: 0.75, yaw: -0.5}
];

async function loadAnimals(look: Look, scene: Scene, rocks: Array<{spot: RockSpot; mesh: Mesh}>): Promise<void> {
    let manifest: {models: Record<string, string>} | null = null;
    try {
        manifest = await (await fetch(`${MODELS}/manifest.json`)).json();
    } catch {
        return;
    }
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    await Promise.all(ANIMALS.map(async (spot) => {
        const version = manifest?.models[spot.slug];
        if (!version) return;
        try {
            const gltf = await loader.loadAsync(`${MODELS}/${spot.slug}/${version}.near.glb`);
            const model = gltf.scene;
            model.updateMatrixWorld(true);
            const box = new Box3().setFromObject(model);
            const size = box.getSize(new Vector3());
            const scale = spot.length / Math.max(size.x, size.z, 0.001);
            model.scale.setScalar(scale);
            let ground = groundHeight(spot.x, spot.z);
            if (spot.onRock) {
                // On the rock's top: cast down onto it.
                const rock = rocks.reduce((a, b) => (Math.hypot(a.spot.x - spot.x, a.spot.z - spot.z) < Math.hypot(b.spot.x - spot.x, b.spot.z - spot.z) ? a : b));
                ground = rock.mesh.position.y + rock.spot.r * rock.spot.squash * 0.62;
            }
            model.position.set(spot.x, Math.max(ground, -0.25) - box.min.y * scale, spot.z);
            model.rotation.y = spot.yaw;
            model.traverse((object) => {
                const mesh = object as Mesh;
                if (!mesh.isMesh) return;
                const old = mesh.material as MeshStandardMaterial;
                const map = old.map ?? null;
                mesh.material = look.direction === "toon"
                    ? new MeshToonMaterial({map, color: map ? "#ffffff" : old.color, gradientMap: toonGradient})
                    : look.direction === "real"
                        ? new MeshPhysicalMaterial({map, color: map ? "#ffffff" : old.color, roughness: 0.75, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new Color("#ffffff")})
                        : new MeshStandardMaterial({map, color: map ? "#ffffff" : old.color, roughness: 0.82});
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            });
            scene.add(model);
            if (look.direction === "toon") {
                const meshes: Mesh[] = [];
                model.traverse((object) => {
                    if ((object as Mesh).isMesh) meshes.push(object as Mesh);
                });
                for (const mesh of meshes) mesh.add(outline(mesh.geometry as BufferGeometry, 0.012 / scale));
            }
        } catch {
            // A model that fails to load leaves its spot empty.
        }
    }));
}

// MARK: - Grade

const GradeShader = {
    uniforms: {tDiffuse: {value: null as Texture | null}, saturation: {value: 1.06}, contrast: {value: 1.04}, warmth: {value: 0.02}, vignette: {value: 0.22}, lift: {value: 0.0}},
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float saturation, contrast, warmth, vignette, lift;
    varying vec2 vUv;
    void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, saturation);
        c = (c - 0.5) * contrast + 0.5 + lift;
        c += vec3(warmth, warmth * 0.4, -warmth) * smoothstep(0.4, 1.0, l);
        c += vec3(-warmth * 0.5, 0.0, warmth * 0.7) * (1.0 - smoothstep(0.0, 0.4, l));
        vec2 d = (vUv - 0.5) * vec2(1.1, 1.0);
        c *= mix(1.0, 1.0 - vignette, smoothstep(0.35, 0.9, length(d)));
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`
};

// MARK: - Mount

const VIEWS: Record<StudyView, {target: [number, number, number]; distance: number; polar: number; azimuth: number}> = {
    wide: {target: [-3, 1.4, -4], distance: 36, polar: 1.2, azimuth: 0.42},
    rocks: {target: [-6.2, 0.55, shoreZ(-6.2) + 0.2], distance: 6.4, polar: 1.22, azimuth: 0.35},
    meadow: {target: [-2, groundHeight(-2, shoreZ(-2) - 11) + 0.4, shoreZ(-2) - 11], distance: 6, polar: 1.3, azimuth: 0.15}
};

export async function mountStudyScene(el: HTMLElement, direction: string): Promise<ArtStudyHandle> {
    const look = LOOKS[(direction as StudyDirection)] ?? LOOKS.natural;
    const toon = look.direction === "toon";
    const real = look.direction === "real";
    const coarse = matchMedia("(pointer: coarse)").matches;
    const renderer = new WebGLRenderer({antialias: true, powerPreference: "high-performance"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = look.exposure;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.info.autoReset = false;
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    el.appendChild(canvas);

    const scene = new Scene();
    const camera = new PerspectiveCamera(38, 1, 0.1, 4000);
    const uniforms = {
        time: {value: 0},
        sunDir: {value: new Vector3(0, 1, 0)},
        sunColor: {value: new Color()},
        zenith: {value: new Color()},
        horizon: {value: new Color()},
        night: {value: 0}
    };

    const sun = new DirectionalLight("#ffffff", 1);
    sun.castShadow = true;
    const mapSize = coarse ? Math.min(look.shadowMap, 2048) : look.shadowMap;
    sun.shadow.mapSize.set(mapSize, mapSize);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = toon ? 1 : 3;
    const hemi = new HemisphereLight("#ffffff", "#000000", 1);
    const ambient = new AmbientLight("#ffffff", toon ? 0.25 : 0);
    scene.add(sun, sun.target, hemi, ambient);

    const skyMesh = real ? null : buildSky(uniforms);
    if (skyMesh) scene.add(skyMesh);
    const physicalSky = real ? new Sky() : null;
    if (physicalSky) {
        physicalSky.scale.setScalar(3000);
        const u = physicalSky.material.uniforms;
        u.turbidity.value = 4;
        u.rayleigh.value = 1.4;
        u.mieCoefficient.value = 0.004;
        u.mieDirectionalG.value = 0.8;
        scene.add(physicalSky);
    }
    const stars = buildStars();
    scene.add(stars);

    const terrain = buildTerrain(look, uniforms);
    scene.add(terrain);
    const water = buildWater(look, uniforms);
    scene.add(water);

    const rockMat = rockMaterial(look);
    const rocks: Array<{spot: RockSpot; mesh: Mesh}> = [];
    for (const spot of rockSpots()) {
        const geometry = rockGeometry(spot, look.rockDetail, toon);
        const mesh = new Mesh(geometry, rockMat);
        mesh.scale.setScalar(spot.r);
        mesh.rotation.y = spot.seed % 6;
        mesh.position.set(spot.x, groundHeight(spot.x, spot.z) + spot.r * 0.12, spot.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        rocks.push({spot, mesh});
        if (toon) {
            const line = outline(geometry, 0.035);
            mesh.add(line);
        }
    }
    const spots = rockSpots();
    const grass = buildGrass(look, uniforms, spots);
    if (grass) scene.add(grass);
    const flowers = buildFlowers(look);
    if (flowers) scene.add(flowers);
    const pebbles = buildPebbles(look);
    if (pebbles) scene.add(pebbles);
    const trees = buildTrees(look, [{x: -18, z: -15, s: 1.25}, {x: -14.5, z: -17.5, s: 1.0}, {x: -20.5, z: -11.5, s: 0.85}, {x: 14, z: -20, s: 1.1}], uniforms);
    scene.add(trees);

    const fog = new FogExp2("#ffffff", 0.004);
    scene.fog = fog;

    // Image-based light for the naturalistic look: the physical sky, prefiltered.
    const pmrem = real ? new PMREMGenerator(renderer) : null;
    let envTarget: WebGLRenderTarget | null = null;

    await loadAnimals(look, scene, rocks);

    // Post.
    const size = new Vector2();
    let composer: EffectComposer | null = null;
    let grade: ShaderPass | null = null;
    let gtao: GTAOPass | null = null;
    if (!toon) {
        const target = new WebGLRenderTarget(1, 1, {type: HalfFloatType, samples: 4});
        composer = new EffectComposer(renderer, target);
        composer.addPass(new RenderPass(scene, camera));
        if (real) {
            gtao = new GTAOPass(scene, camera, 1, 1);
            gtao.blendIntensity = 0.9;
            composer.addPass(gtao);
        }
        const bloom = new UnrealBloomPass(new Vector2(1, 1), real ? 0.18 : 0.28, 0.5, real ? 0.92 : 0.86);
        composer.addPass(bloom);
        composer.addPass(new OutputPass());
        grade = new ShaderPass(GradeShader);
        if (real) {
            grade.uniforms.saturation.value = 0.92;
            grade.uniforms.contrast.value = 1.08;
            grade.uniforms.warmth.value = 0.01;
            grade.uniforms.vignette.value = 0.18;
        }
        composer.addPass(grade);
        if (real) composer.addPass(new SMAAPass(1, 1));
    }

    const resize = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(h, 1);
        camera.updateProjectionMatrix();
        renderer.getDrawingBufferSize(size);
        composer?.setSize(w, h);
        composer?.setPixelRatio(renderer.getPixelRatio());
    };
    resize();
    addEventListener("resize", resize);

    let currentTime = "day";
    const applyLight = (time: string) => {
        currentTime = time;
        const night = time === "night";
        const light = night ? look.night : look.day;
        const elevation = MathUtils.degToRad(light.elevation);
        const azimuth = MathUtils.degToRad(light.azimuth);
        const dir = new Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation) * -1);
        uniforms.sunDir.value.copy(dir);
        uniforms.sunColor.value.set(light.sun).multiplyScalar(night ? 0.6 : 1);
        uniforms.zenith.value.set(light.zenith);
        uniforms.horizon.value.set(light.horizon);
        uniforms.night.value = night ? 1 : 0;
        sun.color.set(light.sun);
        sun.intensity = light.sunIntensity;
        hemi.color.set(light.sky);
        hemi.groundColor.set(light.ground);
        hemi.intensity = light.hemi;
        ambient.color.set(night ? "#33415f" : "#ffffff");
        fog.color.set(light.fog);
        fog.density = light.fogDensity;
        stars.visible = light.stars > 0;
        if (physicalSky) {
            physicalSky.visible = !night;
            const u = physicalSky.material.uniforms;
            u.sunPosition.value.copy(dir).multiplyScalar(1000);
            if (pmrem) {
                envTarget?.dispose();
                if (!night) {
                    const envScene = new Scene();
                    const sky2 = new Sky();
                    sky2.scale.setScalar(1000);
                    for (const key of Object.keys(u)) (sky2.material.uniforms as Record<string, {value: unknown}>)[key].value = (u as Record<string, {value: unknown}>)[key].value;
                    envScene.add(sky2);
                    envTarget = pmrem.fromScene(envScene, 0.02);
                    scene.environment = envTarget.texture;
                    scene.environmentIntensity = 0.55;
                } else {
                    const envScene = new Scene();
                    envScene.background = new Color(light.horizon);
                    envTarget = pmrem.fromScene(envScene, 0.04);
                    scene.environment = envTarget.texture;
                    scene.environmentIntensity = 0.4;
                }
                scene.background = night ? new Color(light.zenith) : null;
            }
        }
        if (grade) {
            grade.uniforms.lift.value = night ? (real ? 0.0 : 0.01) : 0;
            grade.uniforms.saturation.value = night ? (real ? 0.8 : 0.95) : real ? 0.92 : 1.06;
        }
        renderer.toneMappingExposure = look.exposure * (night ? (real ? 1.3 : 1.15) : 1);
    };

    const setView = (view: StudyView) => {
        const v = VIEWS[view];
        const target = new Vector3(...v.target);
        const offset = new Vector3().setFromSphericalCoords(v.distance, v.polar, v.azimuth);
        camera.position.copy(target).add(offset);
        camera.lookAt(target);
        // Shadows fitted round what the camera looks at.
        const reach = Math.max(v.distance * 1.2, 14);
        const cam = sun.shadow.camera;
        cam.left = -reach;
        cam.right = reach;
        cam.top = reach;
        cam.bottom = -reach;
        cam.near = 1;
        cam.far = 400;
        cam.updateProjectionMatrix();
        sun.target.position.copy(target);
        sun.position.copy(target).addScaledVector(uniforms.sunDir.value, 150);
        if (skyMesh) skyMesh.position.copy(camera.position);
        stars.position.copy(camera.position);
    };

    let lastFrame = performance.now();
    let calls = 0;
    let triangles = 0;
    const frame = (now: number) => {
        requestAnimationFrame(frame);
        uniforms.time.value += Math.min((now - lastFrame) / 1000, 0.1);
        lastFrame = now;
        renderer.info.reset();
        if (composer) composer.render();
        else renderer.render(scene, camera);
        calls = renderer.info.render.calls;
        triangles = renderer.info.render.triangles;
    };
    applyLight("day");
    setView("wide");
    requestAnimationFrame(frame);

    return {
        canvas,
        views: [...STUDY_VIEWS],
        show: async (view, time) => {
            applyLight(time);
            setView((STUDY_VIEWS as readonly string[]).includes(view) ? (view as StudyView) : "wide");
            for (let i = 0; i < 40; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
            return {drawCalls: calls, triangles, pixelRatio: renderer.getPixelRatio(), direction: look.direction};
        }
    };
}

