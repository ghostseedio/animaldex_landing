/**
 * The asset lane's trees in the scene (graphics pass, batch 3): every decor
 * and forest-fill tree drawn as its library tree (`tree-assets.ts` picks
 * which), instanced per tree and detail level: the full tree near the
 * camera, lighter ones further out, the crossed card on the horizon. The
 * levels are re-sorted a few times a second as the camera moves; each
 * tier pulls the distances in.
 *
 * Wind from the assets' own weights (COLOR_1: trunk a little, branches more,
 * leaves most, each leaf fluttering on its own phase), stronger in wind and
 * storms (`ARK_WIND`).
 *
 * A tree whose crown reaches over the camera is drawn apart (batch 4), with
 * the near-camera fade (`near-fade.ts`): its trunk and limbs dissolve beside
 * the lens instead of cutting a dark shard across the picture. Only those few
 * trees carry the fade's cut-out, so the rest keep the early depth test.
 */

import {Color, DoubleSide, FrontSide, Group, InstancedMesh, Matrix4, MeshDepthMaterial, MeshStandardMaterial, Quaternion, RGBADepthPacking, Vector3, type BufferGeometry, type Mesh} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {readNowOrLater} from "@/ark-scene/model-files";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {ARK_TIME, ARK_WIND, NOISE_GLSL} from "@/ark-scene/glsl";
import {ARK_NEAR_FADE, ARK_NEAR_FADE_CLIP, ARK_NEAR_FADE_PARS, NEAR_FADE_MAX} from "@/ark-scene/near-fade";
import {ASSETS, ASSET_BASE, TREE_CLOSE, assetTreePlacement, treeLodDistance} from "@/ark-scene/tree-assets";
import {LEAF_CELLS, LEAF_CUT, leafAtlasTexture, leafCellUniform, releaseLeafAtlas} from "@/ark-scene/leaf-atlas";
// The least share of the woods' fill every tier draws (batch 6), shared with the attach points (decision 33).
import {WOODS_FILL} from "@/ark-scene/tree-pick";
import {forestFill, worldDecor} from "@/ark-scene/decor";
import {arkWorld, sampleGround, zoneAt} from "@/ark-scene/world";
import {inPool} from "@/ark-scene/islands/wild/falls";

const LEVELS = ["lod0", "lod1", "lod2", "card"] as const;
type Level = typeof LEVELS[number];

type Instance = {x: number; y: number; z: number; scale: number; height: number; radius: number; matrix: Matrix4; tint: Color; fill: boolean; rank: number; woods: boolean; /** p5 (humans): in a logging stand (`setOverride`). */ ov?: boolean};

/**
 * p5 (humans): logging and replanting (`forestry/forest-trees.ts`). `covers` marks the trees a stand holds (asked once
 * per tree when set); `matrix` answers a marked tree's drawn matrix now (`radius` is its crown's): `instance` as built, `into` written (felled,
 * falling, a sapling), or null (not drawn: hauled away). `moving` asks for a re-sort every frame (a tree mid-fall).
 */
export type TreeOverride = {
    covers: (tree: {x: number; y: number; z: number; height: number; radius: number; matrix: Matrix4}) => boolean;
    matrix: (tree: {x: number; y: number; z: number; scale: number; height: number; radius: number; matrix: Matrix4}, into: Matrix4) => Matrix4 | null;
    moving: () => boolean;
    /** The override's own state changed (a tree fell, a sapling grew a step): re-sort once. */
    changed: () => boolean;
};


/** The least reach of the lod2 → card hand-over (the medium tier's), see `update`. */
const CARD_REACH_MIN = 0.45;

/**
 * On the high tier of the bigger island, a rainforest emergent keeps its crown (lod2) until it is this many times its
 * height away: about 40 px tall on a 900 px view (graphics pass 2026-11-14). Its far card is not a picture of its
 * crown (a few flat fronds, darker than the crown's leaves), so at the library's hand-over (a tree 100 to 150 px tall
 * there) the rainforest changed shape and colour tree by tree as the camera came in, and the default view showed both
 * kinds side by side. Only the emergents (two assets: every asset held is a draw call a pass), and only the high
 * tier: the medium and low tiers keep the library's hand-over (their triangles and calls are counted:
 * docs/ark/perf-audit-mobile-2026-11.md).
 */
const CROWN_HOLD_HEIGHTS = 33;

/**
 * Pass 3 (lane TREES): a leaf's picture in the atlas (`leaf-atlas.ts`), from the corner code in its vertex colour's alpha
 * (trees.py `tex_code`: cell * 16 + cu + 3 * cv; 255 none). xy: the atlas position, z: 1 on a leaf picture, 0 elsewhere.
 */
const LEAF_TEX_VERTEX = `
{
    float arkCode = floor(color.a * 255.0 + 0.5);
    float arkCell = floor(arkCode / 16.0);
    float arkCorner = arkCode - arkCell * 16.0;
    float arkCv = floor(arkCorner / 3.0);
    vec4 arkRect = arkLeafCells[int(min(arkCell, ${LEAF_CELLS.length - 1}.0))];
    vArkLeafTex = vec3(arkRect.xy + vec2(arkCorner - arkCv * 3.0, arkCv) * 0.5 * arkRect.zw, arkCode < 254.5 ? 1.0 : 0.0);
}`;
const LEAF_TEX_PARS_VERTEX = `
uniform vec4 arkLeafCells[${LEAF_CELLS.length}];
varying vec3 vArkLeafTex;`;
const LEAF_UNIFORMS = () => ({arkLeafAtlas: {value: leafAtlasTexture()}, arkLeafCells: {value: leafCellUniform()}});

/**
 * The shadow of a tree with leaf pictures (pass 3): the default shadow pass draws every card whole (a square shadow per
 * leaf mass); this one cuts it as the picture does.
 */
export function leafDepthMaterial(): MeshDepthMaterial {
    const material = new MeshDepthMaterial({depthPacking: RGBADepthPacking});
    material.customProgramCacheKey = () => "ark-asset-tree-depth-p3";
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, LEAF_UNIFORMS());
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
attribute vec4 color;${LEAF_TEX_PARS_VERTEX}`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>${LEAF_TEX_VERTEX}`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
uniform sampler2D arkLeafAtlas;
varying vec3 vArkLeafTex;`)
            .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
if (vArkLeafTex.z > 0.5 && texture2D(arkLeafAtlas, vArkLeafTex.xy).a < ${LEAF_CUT.toFixed(2)}) discard;`);
    };
    return material;
}

let sharedDepth: MeshDepthMaterial | null = null;
/** One shadow material for every tree mesh (wild and town); no picture (code 255): drawn whole, as before. */
export function treeShadowMaterial(): MeshDepthMaterial {
    return (sharedDepth ??= leafDepthMaterial());
}

/** The trees' material; `near` adds the near-camera fade (only for the trees drawn round the camera). Also the town's. */
export function windMaterial(doubleSided: boolean, near = false, conifer = false): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.85, metalness: 0, side: doubleSided ? DoubleSide : FrontSide});
    material.customProgramCacheKey = () => `ark-asset-tree-p3-${doubleSided ? 2 : 1}${near ? "-near" : ""}${conifer ? "-conifer" : ""}`;
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, LEAF_UNIFORMS());
        shader.uniforms.arkTime = ARK_TIME;
        shader.uniforms.arkWind = ARK_WIND;
        shader.uniforms.arkNearFade = ARK_NEAR_FADE;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
attribute vec4 color_1;
varying float vArkLeafy;
varying vec3 vArkLocal;
uniform float arkTime;
uniform vec2 arkWind;${LEAF_TEX_PARS_VERTEX}`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>
{
    vec3 root = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float gust = length(arkWind);
    vec2 along = arkWind / max(gust, 1e-3);
    float phase = color_1.y * 6.2831853;
    // Whole cycles in the shared clock's 600 s window (runtime lane; tree-assets.ts treeSway must use the same numbers).
    float wave = sin(arkTime * 1.24617 + phase + root.x * 0.19 + root.z * 0.15) + 0.4 * sin(arkTime * 2.59705 + phase * 1.7 + root.x * 0.4);
    // Trunk a little, branches more, leaves most (the asset's sway weight), bending more the higher it is.
    float bend = color_1.x * (0.25 + 0.06 * max(transformed.y, 0.0));
    transformed.xz += along * (0.35 + 0.65 * wave) * bend * 0.09 * gust;
    float leaf = color_1.w * 6.2831853;
    // (Graphics pass 1, lane VEG: the owner, "trees seem to flicker zoomed out". Every leaf shook on its own phase at
    // about 7 Hz, even in still air: far away a leaf is a pixel or two, so the shaking turned each crown into a field of
    // pixels changing every frame. The flutter now fades out from 25 m to 70 m from the camera, where it cannot be
    // seen as movement, only as sparkle; the sway of the whole tree stays.)
    #ifdef USE_INSTANCING
    vec3 arkSeenFrom = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
    #else
    vec3 arkSeenFrom = (modelMatrix * vec4(position, 1.0)).xyz;
    #endif
    float arkNearLeaf = 1.0 - smoothstep(25.0, 70.0, distance(arkSeenFrom, cameraPosition));
    transformed += vec3(sin(arkTime * 7.1 + leaf), 0.6 * sin(arkTime * 6.30413 + leaf * 1.3), cos(arkTime * 6.70206 + leaf)) * color_1.z * 0.025 * (0.4 + gust) * arkNearLeaf;
    // Leaves flutter (broadleaf 0.36 and up, the conifers' boughs from about 0.05); wood does not (0).
    vArkLeafy = smoothstep(0.02, 0.1, color_1.z);
    vArkLocal = position;
}
#ifdef USE_COLOR_ALPHA
${LEAF_TEX_VERTEX}
#else
vArkLeafTex = vec3(0.0);
#endif`);
        // Leaves are single sheets: lit from the side the light comes, never black on the back.
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
varying float vArkLeafy;
varying vec3 vArkLocal;
varying vec3 vArkLeafTex;
uniform sampler2D arkLeafAtlas;
float arkBarkRelief = 0.0;
// Pass 3: the leaf picture under this fragment (its alpha cut), and whether it is one (then always leaf, never bark).
vec4 arkLeafTexel = vec4(0.5, 0.5, 0.5, 1.0);
float arkTexd = 0.0;
float arkLeafyF = 0.0;
${NOISE_GLSL}`)
            .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
arkTexd = step(0.5, vArkLeafTex.z);
arkLeafTexel = texture2D(arkLeafAtlas, vArkLeafTex.xy);
if (arkTexd > 0.5 && arkLeafTexel.a < ${LEAF_CUT.toFixed(2)}) discard;
arkLeafyF = max(vArkLeafy, arkTexd);`)
            // Bark (batch 4): the assets' bark is dark and flat, so in shade a trunk read as a black cut-out. A little
            // lighter, with a grain of furrows running up the wood.
            .replace("#include <color_fragment>", `#include <color_fragment>
// Pass 3: the code rode in the colour's alpha; every tree is opaque. The picture shades each leaf (0.5: as it is).
diffuseColor.a = 1.0;
diffuseColor.rgb *= mix(1.0, arkLeafTexel.r * 2.0, arkTexd);
{
    float arkWood = 1.0 - arkLeafyF;
    float arkGrain = arkNoise(vec2(atan(vArkLocal.z, vArkLocal.x) * 5.0, vArkLocal.y * 1.6)) * 0.6 + arkNoise(vArkLocal.xz * 9.0 + vArkLocal.y * 2.0) * 0.4;
    // Only dark bark is lifted (pale birch and emergent bark stays as it is, or far forests turn to white sticks).
    float arkLift = mix(1.55, 1.0, smoothstep(0.05, 0.14, dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))));
    diffuseColor.rgb *= mix(1.0, arkLift * (0.78 + 0.44 * arkGrain), arkWood);
    // p2 (town2): bark at every viewing distance (the owner: "tree trunks too render bad quality - no texture on them";
    // the grain above is a soft mottle, and the close-up bark below only within 3 m of the lens). Dark bark: furrows
    // running up the trunk between raised plates, cracks across them, read in colour and, within ~30 m, as relief on
    // the shading normal. Pale bark (birch): dark lenticels across the trunk, and darker, rougher bark at the foot.
    // Faded out with distance (by 120 m), where it would only shimmer. Seamless round the trunk (the angle's wrap blended).
    {
        float around = atan(vArkLocal.z, vArkLocal.x);
        float wrap = smoothstep(-1.5707963, -3.1415927, around);
        vec2 plates = vec2(around * 11.0, vArkLocal.y * 1.25);
        vec2 platesW = vec2((around + 6.2831853) * 11.0, vArkLocal.y * 1.25);
        float furrow = mix(arkNoise(plates), arkNoise(platesW), wrap);
        float fineN = mix(arkNoise(plates * vec2(2.7, 3.4) + 7.1), arkNoise(platesW * vec2(2.7, 3.4) + 7.1), wrap);
        float crack = smoothstep(0.78, 0.92, mix(arkNoise(vec2(around * 4.0, vArkLocal.y * 9.0)), arkNoise(vec2((around + 6.2831853) * 4.0, vArkLocal.y * 9.0)), wrap));
        float ridge = smoothstep(0.28, 0.72, furrow * 0.72 + fineN * 0.28);
        float pale = smoothstep(0.05, 0.14, dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)));
        float lenticel = smoothstep(0.66, 0.8, mix(arkNoise(vec2(around * 7.0, vArkLocal.y * 16.0)), arkNoise(vec2((around + 6.2831853) * 7.0, vArkLocal.y * 16.0)), wrap));
        float foot = 1.0 - smoothstep(0.3, 1.6, vArkLocal.y);
        float seen = arkWood * (1.0 - smoothstep(45.0, 120.0, length(vViewPosition)));
        float darkBark = (0.42 + 0.82 * ridge) * (1.0 - crack * 0.5);
        float paleBark = (1.0 - lenticel * 0.5) * mix(1.0, 0.45 + 0.4 * ridge, foot);
        diffuseColor.rgb *= mix(1.0, mix(darkBark, paleBark, pale), seen);
        arkBarkRelief = (mix(ridge - crack * 0.6, foot * ridge - lenticel * 0.3, pale)) * arkWood * (1.0 - smoothstep(14.0, 32.0, length(vViewPosition)));
    }
    // Moss on the roots and the trunk's foot (batch 5), in patches.
    float arkMoss = arkWood * (1.0 - smoothstep(0.25, 1.1, vArkLocal.y)) * smoothstep(0.4, 0.68, arkNoise(vArkLocal.xz * 7.0 + vArkLocal.y * 4.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.075, 0.115, 0.03) * (0.8 + 0.4 * arkGrain), arkMoss * 0.75);
${conifer ? `    // Conifer needles (batch 6): the assets' deep teal read as heavy dark shapes near the camera. A natural, warmer,
    // less saturated green.
    vec3 arkNeedle = diffuseColor.rgb;
    float arkGrey = dot(arkNeedle, vec3(0.3, 0.59, 0.11));
    arkNeedle = mix(vec3(arkGrey), arkNeedle, 0.55) * vec3(1.22, 1.1, 0.68);
    diffuseColor.rgb = mix(diffuseColor.rgb, arkNeedle * 1.35, arkLeafyF);` : ""}
}`)
            .replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
#ifdef DOUBLE_SIDED
normal *= faceDirection;
nonPerturbedNormal *= faceDirection;
#endif`)
            // p2 (town2): the bark's relief (set with its colour above, in uniform control flow) as a bump on the
            // shading normal: three's surface-gradient method, as the close-up bark below.
            .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
{
    vec3 rdx = dFdx(-vViewPosition);
    vec3 rdy = dFdy(-vViewPosition);
    vec3 q1 = cross(rdy, normal);
    vec3 q2 = cross(normal, rdx);
    float qdet = dot(rdx, q1);
    vec3 qgrad = sign(qdet) * (dFdx(arkBarkRelief) * q1 + dFdy(arkBarkRelief) * q2) * 0.03;
    normal = normalize(abs(qdet) * normal - qgrad);
}
{
    // Pass 3: each leaf's fold, curl and veins from its picture (three's perturbNormal2Arb, the frame from the screen
    // derivatives of the atlas position: a mirrored card turns its frame with it).
    vec3 lq0 = dFdx(-vViewPosition);
    vec3 lq1 = dFdy(-vViewPosition);
    vec2 lst0 = dFdx(vArkLeafTex.xy);
    vec2 lst1 = dFdy(vArkLeafTex.xy);
    vec3 lq1p = cross(lq1, normal);
    vec3 lq0p = cross(normal, lq0);
    vec3 lT = lq1p * lst0.x + lq0p * lst1.x;
    vec3 lB = lq1p * lst0.y + lq0p * lst1.y;
    float ldet = max(dot(lT, lT), dot(lB, lB));
    float lscale = ldet == 0.0 ? 0.0 : inversesqrt(ldet);
    vec2 lxy = (arkLeafTexel.gb * 2.0 - 1.0) * 0.9;
    vec3 lmap = vec3(lxy, sqrt(max(0.0, 1.0 - dot(lxy, lxy))));
    vec3 lbent = normalize(mat3(lT * lscale, lB * lscale, normal) * lmap);
    normal = normalize(mix(normal, lbent, arkTexd * step(1e-8, ldet)));
}`)
            // Seen from below a crown is not black (batch 4): leaves are thin, so the sky's light comes through them
            // (most where they face the ground) and the sun glows through from behind; bark in shade keeps the sky's
            // bounce. Both come from the scene's own sky and sun lights, so they dim with the hour.
            .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
{
    vec3 arkUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    // The side of the leaf the camera sees: light from beyond it comes through.
    vec3 arkSeen = dot(normal, vViewPosition) < 0.0 ? -normal : normal;
    float arkDown = clamp(-dot(arkSeen, arkUp), 0.0, 1.0);
    // The light from the sky overhead: the sky light, plus the image-based light from straight up (most of it).
    vec3 arkSky = vec3(0.0);
    #if NUM_HEMI_LIGHTS > 0
    arkSky = hemisphereLights[0].skyColor;
    #endif
    #if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
    arkSky += getIBLIrradiance(arkUp);
    #endif
    vec3 arkThrough = vec3(0.0);
    #if NUM_DIR_LIGHTS > 0
    arkThrough = directionalLights[0].color * clamp(dot(-arkSeen, directionalLights[0].direction), 0.0, 1.0) * 0.25;
    #endif
    reflectedLight.indirectDiffuse += BRDF_Lambert(material.diffuseColor) * (arkSky * ((0.2 + 0.55 * arkDown) * arkLeafyF + 0.18 * (1.0 - arkLeafyF)) + arkThrough * arkLeafyF);
    ${conifer ? `// Needles are many and fine: more of the sky comes through a conifer's mass, most near the camera, where it read
    // as one dark shape (batch 6).
    float arkNear = 1.0 - smoothstep(6.0, 22.0, length(vViewPosition));
    reflectedLight.indirectDiffuse += BRDF_Lambert(material.diffuseColor) * arkSky * vec3(0.95, 1.0, 0.78) * arkLeafyF * (0.3 + 0.6 * arkDown) * (0.55 + 0.45 * arkNear);` : ""}
}`);
        if (near) {
            shader.fragmentShader = shader.fragmentShader
                .replace("#include <common>", `#include <common>${ARK_NEAR_FADE_PARS}`)
                // After the noise helpers (inserted after <common> above).
                .replace("#include <uv_pars_fragment>", `#include <uv_pars_fragment>
// Close-range bark (batch 6): furrows along the trunk in its own coordinates, a few cracks across, lichen flecks.
float arkBarkHeight(vec3 q) {
    float around = atan(q.z, q.x);
    float furrows = arkNoise(vec2(around * 26.0, q.y * 3.2));
    float fine = arkNoise(vec2(around * 70.0, q.y * 11.0));
    float cracks = smoothstep(0.82, 0.95, arkNoise(vec2(around * 9.0, q.y * 14.0)));
    return furrows * 0.7 + fine * 0.3 - cracks * 0.5;
}
float arkBarkNear = 0.0;
float arkBarkH = 0.0;`)
                .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>${ARK_NEAR_FADE_CLIP}`)
                // Taken here, in uniform control flow, for the bump's screen derivatives below.
                .replace("#include <color_fragment>", `{
    arkBarkNear = (1.0 - arkLeafyF) * (1.0 - smoothstep(1.2, 3.2, length(vViewPosition)));
    arkBarkH = arkBarkHeight(vArkLocal);
}
#include <color_fragment>`)
                .replace("#include <lights_fragment_begin>", `{
    // The bark's relief as a bump on the shading normal (three's surface-gradient method), only close up.
    vec3 bdx = dFdx(-vViewPosition);
    vec3 bdy = dFdy(-vViewPosition);
    vec3 r1 = cross(bdy, normal);
    vec3 r2 = cross(normal, bdx);
    float det = dot(bdx, r1);
    vec3 grad = sign(det) * (dFdx(arkBarkH) * r1 + dFdy(arkBarkH) * r2) * 0.035;
    normal = normalize(mix(normal, normalize(abs(det) * normal - grad), arkBarkNear));
}
#include <lights_fragment_begin>`);
            // The bark's colour close up: darker in the furrows, lighter on the ridges, a few grey-green lichen flecks.
            shader.fragmentShader = shader.fragmentShader.replace("    diffuseColor.rgb *= mix(1.0, arkLift * (0.78 + 0.44 * arkGrain), arkWood);", `    diffuseColor.rgb *= mix(1.0, arkLift * (0.78 + 0.44 * arkGrain), arkWood);
    {
        float lichen = smoothstep(0.84, 0.93, arkNoise(vArkLocal.xz * 95.0 + vArkLocal.y * 60.0)) * smoothstep(0.4, 0.7, arkNoise(vArkLocal.xz * 6.0 + vArkLocal.y * 3.0));
        vec3 bark = diffuseColor.rgb * (0.62 + 0.62 * clamp(arkBarkH, 0.0, 1.0));
        bark = mix(bark, vec3(0.3, 0.34, 0.25), lichen * 0.35);
        diffuseColor.rgb = mix(diffuseColor.rgb, bark, arkBarkNear);
    }`);
        }
    };
    return material;
}

export class AssetTrees {
    readonly group = new Group();
    /** Ready once every needed tree is loaded (the procedural trees stand in until then). */
    ready = false;
    private readonly byAsset = new Map<string, {instances: Instance[]; meshes: Partial<Record<Level, InstancedMesh>>; near?: InstancedMesh; distances: [number, number, number]; crown: number; height: number; conifer: boolean; /** Its far card is not a picture of its crown (`CROWN_HOLD_HEIGHTS`). */ holdCrown: boolean}>();
    private readonly materials = {double: windMaterial(true), front: windMaterial(false), nearDouble: windMaterial(true, true), nearFront: windMaterial(false, true)};
    /** Pines and spruces (batch 6): their own shading of the needles. */
    private readonly coniferMaterials = {double: windMaterial(true, false, true), front: windMaterial(false, false, true), nearDouble: windMaterial(true, true, true), nearFront: windMaterial(false, true, true)};
    private reach = 1;
    private fill = 1;
    private lastAt = new Vector3(Infinity, 0, 0);
    private framesSince = 0;
    private shadows = true;
    // p5 (humans): logging stands' trees (`setOverride`).
    private override: TreeOverride | null = null;
    private readonly overMatrix = new Matrix4();

    constructor(base = ASSET_BASE) {
        const position = new Vector3();
        const rotation = new Quaternion();
        const scale = new Vector3();
        const up = new Vector3(0, 1, 0);
        const add = (item: {kind: string; x: number; y: number; z: number; scale: number; rotation: number}, fill: boolean, rank: number) => {
            // Where the tree stands, shared with the attach points (none on bare rock faces high on the mountain).
            const asset = assetTreePlacement(item as never);
            if (!asset) return;
            // p4 (waterfall): the trees standing in the falls' plunge pool are left undrawn (the pine that hid it); the
            // scenery list, its attach points and colliders keep them, so nothing the map or the server reads changes.
            if (arkWorld() === "v2" && inPool(item.x, item.z, 0.8)) return;
            let entry = this.byAsset.get(asset.id);
            if (!entry) {
                const info = ASSETS[asset.id];
                entry = {instances: [], meshes: {}, distances: info.lod_distances, crown: info.crown_radius, height: info.height, conifer: info.kind === "pine" || info.kind === "spruce", holdCrown: info.kind === "emergent"};
                this.byAsset.set(asset.id, entry);
            }
            const matrix = new Matrix4().compose(position.set(asset.x, asset.y, asset.z), rotation.setFromAxisAngle(up, asset.rotation), scale.setScalar(asset.scale));
            const frac = (value: number) => value - Math.floor(value);
            const shade = 0.9 + 0.2 * frac(item.x * 7.13 + item.z * 3.71);
            const zone = fill ? zoneAt(sampleGround(item.x, item.z)) : null;
            entry.instances.push({x: item.x, y: item.y, z: item.z, scale: asset.scale, height: asset.height, radius: asset.radius, matrix, tint: new Color(shade, shade * (0.97 + 0.06 * frac(item.z * 5.3)), shade), fill, rank, woods: zone === "rainforest" || zone === "woodland"});
        };
        worldDecor().forEach((item) => add(item, false, 0));
        forestFill().forEach((item) => add(item, true, item.rank));
        void this.load(base.replace(/\/+$/, ""));
    }

    private async load(base: string) {
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        const jobs: Array<Promise<void>> = [];
        this.byAsset.forEach((entry, id) => {
            const info = ASSETS[id];
            for (const lod of info.lods) {
                // (A file that only failed to arrive is read again in the background: the kind was missing at this
                // level's distances for the whole visit.)
                jobs.push(readNowOrLater(`tree ${lod.file}`, () => loader.loadAsync(`${base}/${lod.file}`), (gltf, late) => {
                    let geometry: BufferGeometry | null = null;
                    gltf.scene.traverse((object) => {
                        if (!geometry && (object as Mesh).isMesh) geometry = (object as Mesh).geometry as BufferGeometry;
                    });
                    if (!geometry) return;
                    const set = entry.conifer ? this.coniferMaterials : this.materials;
                    const mesh = new InstancedMesh(geometry, lod.doubleSided ? set.double : set.front, entry.instances.length);
                    mesh.count = 0;
                    mesh.frustumCulled = false;
                    mesh.castShadow = lod.level !== "card" && this.shadows;
                    // p3 (trees): the shadow cut as the leaf pictures are.
                    if (lod.level !== "card") mesh.customDepthMaterial = treeShadowMaterial();
                    mesh.receiveShadow = true;
                    mesh.userData.kind = "asset-tree";
                    mesh.name = `asset-tree:${id}:${lod.level}`;
                    entry.meshes[lod.level] = mesh;
                    this.group.add(mesh);
                    if (lod.level === "lod0") {
                        // The same full tree for the few round the camera, with the near fade.
                        const near = new InstancedMesh(geometry, lod.doubleSided ? set.nearDouble : set.nearFront, entry.instances.length);
                        near.count = 0;
                        near.visible = false;
                        near.frustumCulled = false;
                        near.castShadow = this.shadows;
                        near.customDepthMaterial = treeShadowMaterial();
                        near.receiveShadow = true;
                        near.userData.kind = "asset-tree";
                        entry.near = near;
                        this.group.add(near);
                    }
                    if (late) this.lastAt.set(Infinity, 0, 0);
                }));
            }
        });
        await Promise.all(jobs);
        this.ready = true;
        this.lastAt.set(Infinity, 0, 0);
    }

    /** The tier: how far each level reaches (1 high, 0.7 medium, 0.5 low) and the forest fill's share. */
    setTier(reach: number, fill: number, shadows: boolean) {
        this.reach = reach;
        this.fill = fill;
        this.shadows = shadows;
        this.byAsset.forEach((entry) => {
            for (const level of LEVELS) {
                const mesh = entry.meshes[level];
                if (mesh) mesh.castShadow = shadows && level !== "card";
            }
            if (entry.near) entry.near.castShadow = shadows;
        });
        this.lastAt.set(Infinity, 0, 0);
    }

    /** Part B (docs/ark/streaming.md): whether a point's chunk is drawn (null: everywhere). */
    private drawnAt: ((x: number, z: number) => boolean) | null = null;
    setDrawn(drawn: ((x: number, z: number) => boolean) | null) {
        this.drawnAt = drawn;
        this.lastAt.set(Infinity, 0, 0);
    }

    /** p5 (humans): the logging stands' trees drawn by `override` (null: every tree as built). */
    setOverride(override: TreeOverride | null) {
        this.override = override;
        this.byAsset.forEach((entry) => {
            for (const instance of entry.instances) instance.ov = override ? override.covers(instance) : false;
        });
        this.lastAt.set(Infinity, 0, 0);
    }

    /** Re-sort the levels when the camera has moved (or every half second). */
    update(camera: Vector3) {
        if (!this.ready) return;
        this.framesSince++;
        const forced = this.override !== null && (this.override.moving() || this.override.changed()); // p5 (humans)
        if (!forced && camera.distanceToSquared(this.lastAt) < 2.25 && this.framesSince < 30) return;
        this.framesSince = 0;
        this.lastAt.copy(camera);
        // A tree is "near" when the camera is inside (or within reach of) its crown's cylinder: drawn with the fade.
        // The margin covers the 1.5 m the camera may move before the next re-sort.
        const margin = NEAR_FADE_MAX + 1.6;
        this.byAsset.forEach((entry) => {
            const counts: Record<Level, number> = {lod0: 0, lod1: 0, lod2: 0, card: 0};
            let nearCount = 0;
            const [d0, d1] = entry.distances.map((d) => d * this.reach);
            // The crown's far level (lod2) reaches at least as far as on the medium tier (batch 6: on the low tier the
            // crossed cards took over from about 110 m, and from the island view the woods stood as bare trunks with small
            // tufts); the full levels keep the tier's reach.
            const d2 = entry.distances[2] * Math.max(this.reach, CARD_REACH_MIN);
            const hold = entry.holdCrown && this.reach >= 1 && arkWorld() === "v2" ? CROWN_HOLD_HEIGHTS : 0;
            for (const instance of entry.instances) {
                if (instance.fill && instance.rank > (instance.woods ? Math.max(this.fill, WOODS_FILL) : this.fill)) continue;
                if (this.drawnAt && !this.drawnAt(instance.x, instance.z)) continue;
                // p5 (humans): a logging stand's tree: felled, falling, hauled away or a sapling.
                const matrix = instance.ov && this.override ? this.override.matrix(instance, this.overMatrix) : instance.matrix;
                if (!matrix) continue;
                // A tree's levels hand over further for a bigger tree (decision 34: trees at their real heights, twice
                // the library's and more), by the square root of its size: a 40 m emergent keeps its detail further, and
                // each asset's trees stay in few levels (each level in use is a draw call).
                const size = Math.sqrt(Math.max(instance.scale, 1));
                if (entry.near) {
                    const across = Math.hypot(instance.x - camera.x, instance.z - camera.z);
                    const above = camera.y - instance.y;
                    if (across < entry.crown * instance.scale + margin && above < entry.height * instance.scale + margin && above > -margin) {
                        entry.near.setMatrixAt(nearCount, matrix);
                        entry.near.setColorAt(nearCount, instance.tint);
                        nearCount++;
                        continue;
                    }
                }
                const away = Math.hypot(instance.x - camera.x, instance.y - camera.y, instance.z - camera.z);
                const d = away / size;
                // Right beside the tree (up in its crown, a close-up on one of its leaves): full detail, the level its attach points are on.
                const close = d >= d0 && treeLodDistance(instance, camera) < TREE_CLOSE;
                let level: Level = d < d0 || close ? "lod0" : d < d1 ? "lod1" : d < d2 || away < instance.height * hold ? "lod2" : "card";
                // A level that failed to load falls to the next one that did.
                let index = LEVELS.indexOf(level);
                while (index < LEVELS.length - 1 && !entry.meshes[LEVELS[index]]) index++;
                level = LEVELS[index];
                const mesh = entry.meshes[level];
                if (!mesh) continue;
                mesh.setMatrixAt(counts[level], matrix);
                mesh.setColorAt(counts[level], instance.tint);
                counts[level]++;
            }
            for (const level of LEVELS) {
                const mesh = entry.meshes[level];
                if (!mesh) continue;
                mesh.count = counts[level];
                mesh.visible = counts[level] > 0;
                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            }
            if (entry.near) {
                entry.near.count = nearCount;
                entry.near.visible = nearCount > 0;
                entry.near.instanceMatrix.needsUpdate = true;
                if (entry.near.instanceColor) entry.near.instanceColor.needsUpdate = true;
            }
        });
    }

    dispose() {
        this.byAsset.forEach((entry) => {
            for (const level of LEVELS) {
                const mesh = entry.meshes[level];
                if (!mesh) continue;
                mesh.geometry.dispose();
                mesh.dispose();
            }
            // Shares lod0's geometry (disposed above).
            entry.near?.dispose();
        });
        Object.values(this.materials).forEach((material) => material.dispose());
        Object.values(this.coniferMaterials).forEach((material) => material.dispose());
        sharedDepth?.dispose();
        sharedDepth = null;
        releaseLeafAtlas();
    }
}
