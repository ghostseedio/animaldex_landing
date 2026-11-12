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

import {Color, DoubleSide, FrontSide, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry, type Mesh} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {ARK_TIME, ARK_WIND, NOISE_GLSL} from "@/ark-scene/glsl";
import {ARK_NEAR_FADE, ARK_NEAR_FADE_CLIP, ARK_NEAR_FADE_PARS, NEAR_FADE_MAX} from "@/ark-scene/near-fade";
import {ASSETS, ASSET_BASE, TREE_CLOSE, assetTreePlacement, treeLodDistance} from "@/ark-scene/tree-assets";
// The least share of the woods' fill every tier draws (batch 6), shared with the attach points (decision 33).
import {WOODS_FILL} from "@/ark-scene/tree-pick";
import {forestFill, worldDecor} from "@/ark-scene/decor";
import {sampleGround, zoneAt} from "@/ark-scene/world";

const LEVELS = ["lod0", "lod1", "lod2", "card"] as const;
type Level = typeof LEVELS[number];

type Instance = {x: number; y: number; z: number; scale: number; height: number; radius: number; matrix: Matrix4; tint: Color; fill: boolean; rank: number; woods: boolean};


/** The least reach of the lod2 → card hand-over (the medium tier's), see `update`. */
const CARD_REACH_MIN = 0.45;

/** The trees' material; `near` adds the near-camera fade (only for the trees drawn round the camera). */
function windMaterial(doubleSided: boolean, near = false, conifer = false): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.85, metalness: 0, side: doubleSided ? DoubleSide : FrontSide});
    material.customProgramCacheKey = () => `ark-asset-tree-b6-${doubleSided ? 2 : 1}${near ? "-near" : ""}${conifer ? "-conifer" : ""}`;
    material.onBeforeCompile = (shader) => {
        shader.uniforms.arkTime = ARK_TIME;
        shader.uniforms.arkWind = ARK_WIND;
        shader.uniforms.arkNearFade = ARK_NEAR_FADE;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
attribute vec4 color_1;
varying float vArkLeafy;
varying vec3 vArkLocal;
uniform float arkTime;
uniform vec2 arkWind;`)
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
    transformed += vec3(sin(arkTime * 7.1 + leaf), 0.6 * sin(arkTime * 6.30413 + leaf * 1.3), cos(arkTime * 6.70206 + leaf)) * color_1.z * 0.025 * (0.4 + gust);
    // Leaves flutter (broadleaf 0.36 and up, the conifers' boughs from about 0.05); wood does not (0).
    vArkLeafy = smoothstep(0.02, 0.1, color_1.z);
    vArkLocal = position;
}`);
        // Leaves are single sheets: lit from the side the light comes, never black on the back.
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
varying float vArkLeafy;
varying vec3 vArkLocal;
${NOISE_GLSL}`)
            // Bark (batch 4): the assets' bark is dark and flat, so in shade a trunk read as a black cut-out. A little
            // lighter, with a grain of furrows running up the wood.
            .replace("#include <color_fragment>", `#include <color_fragment>
{
    float arkWood = 1.0 - vArkLeafy;
    float arkGrain = arkNoise(vec2(atan(vArkLocal.z, vArkLocal.x) * 5.0, vArkLocal.y * 1.6)) * 0.6 + arkNoise(vArkLocal.xz * 9.0 + vArkLocal.y * 2.0) * 0.4;
    // Only dark bark is lifted (pale birch and emergent bark stays as it is, or far forests turn to white sticks).
    float arkLift = mix(1.55, 1.0, smoothstep(0.05, 0.14, dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))));
    diffuseColor.rgb *= mix(1.0, arkLift * (0.78 + 0.44 * arkGrain), arkWood);
    // Moss on the roots and the trunk's foot (batch 5), in patches.
    float arkMoss = arkWood * (1.0 - smoothstep(0.25, 1.1, vArkLocal.y)) * smoothstep(0.4, 0.68, arkNoise(vArkLocal.xz * 7.0 + vArkLocal.y * 4.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.075, 0.115, 0.03) * (0.8 + 0.4 * arkGrain), arkMoss * 0.75);
${conifer ? `    // Conifer needles (batch 6): the assets' deep teal read as heavy dark shapes near the camera. A natural, warmer,
    // less saturated green.
    vec3 arkNeedle = diffuseColor.rgb;
    float arkGrey = dot(arkNeedle, vec3(0.3, 0.59, 0.11));
    arkNeedle = mix(vec3(arkGrey), arkNeedle, 0.55) * vec3(1.22, 1.1, 0.68);
    diffuseColor.rgb = mix(diffuseColor.rgb, arkNeedle * 1.35, vArkLeafy);` : ""}
}`)
            .replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
#ifdef DOUBLE_SIDED
normal *= faceDirection;
nonPerturbedNormal *= faceDirection;
#endif`)
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
    reflectedLight.indirectDiffuse += BRDF_Lambert(material.diffuseColor) * (arkSky * ((0.2 + 0.55 * arkDown) * vArkLeafy + 0.18 * (1.0 - vArkLeafy)) + arkThrough * vArkLeafy);
    ${conifer ? `// Needles are many and fine: more of the sky comes through a conifer's mass, most near the camera, where it read
    // as one dark shape (batch 6).
    float arkNear = 1.0 - smoothstep(6.0, 22.0, length(vViewPosition));
    reflectedLight.indirectDiffuse += BRDF_Lambert(material.diffuseColor) * arkSky * vec3(0.95, 1.0, 0.78) * vArkLeafy * (0.3 + 0.6 * arkDown) * (0.55 + 0.45 * arkNear);` : ""}
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
    arkBarkNear = (1.0 - vArkLeafy) * (1.0 - smoothstep(1.2, 3.2, length(vViewPosition)));
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
    private readonly byAsset = new Map<string, {instances: Instance[]; meshes: Partial<Record<Level, InstancedMesh>>; near?: InstancedMesh; distances: [number, number, number]; crown: number; height: number; conifer: boolean}>();
    private readonly materials = {double: windMaterial(true), front: windMaterial(false), nearDouble: windMaterial(true, true), nearFront: windMaterial(false, true)};
    /** Pines and spruces (batch 6): their own shading of the needles. */
    private readonly coniferMaterials = {double: windMaterial(true, false, true), front: windMaterial(false, false, true), nearDouble: windMaterial(true, true, true), nearFront: windMaterial(false, true, true)};
    private reach = 1;
    private fill = 1;
    private lastAt = new Vector3(Infinity, 0, 0);
    private framesSince = 0;
    private shadows = true;

    constructor(base = ASSET_BASE) {
        const position = new Vector3();
        const rotation = new Quaternion();
        const scale = new Vector3();
        const up = new Vector3(0, 1, 0);
        const add = (item: {kind: string; x: number; y: number; z: number; scale: number; rotation: number}, fill: boolean, rank: number) => {
            // Where the tree stands, shared with the attach points (none on bare rock faces high on the mountain).
            const asset = assetTreePlacement(item as never);
            if (!asset) return;
            let entry = this.byAsset.get(asset.id);
            if (!entry) {
                const info = ASSETS[asset.id];
                entry = {instances: [], meshes: {}, distances: info.lod_distances, crown: info.crown_radius, height: info.height, conifer: info.kind === "pine" || info.kind === "spruce"};
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
                jobs.push(loader.loadAsync(`${base}/${lod.file}`).then((gltf) => {
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
                    mesh.receiveShadow = true;
                    mesh.userData.kind = "asset-tree";
                    entry.meshes[lod.level] = mesh;
                    this.group.add(mesh);
                    if (lod.level === "lod0") {
                        // The same full tree for the few round the camera, with the near fade.
                        const near = new InstancedMesh(geometry, lod.doubleSided ? set.nearDouble : set.nearFront, entry.instances.length);
                        near.count = 0;
                        near.visible = false;
                        near.frustumCulled = false;
                        near.castShadow = this.shadows;
                        near.receiveShadow = true;
                        near.userData.kind = "asset-tree";
                        entry.near = near;
                        this.group.add(near);
                    }
                }).catch(() => {}));
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

    /** Re-sort the levels when the camera has moved (or every half second). */
    update(camera: Vector3) {
        if (!this.ready) return;
        this.framesSince++;
        if (camera.distanceToSquared(this.lastAt) < 2.25 && this.framesSince < 30) return;
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
            for (const instance of entry.instances) {
                if (instance.fill && instance.rank > (instance.woods ? Math.max(this.fill, WOODS_FILL) : this.fill)) continue;
                if (this.drawnAt && !this.drawnAt(instance.x, instance.z)) continue;
                // A tree's levels hand over further for a bigger tree (decision 34: trees at their real heights, twice
                // the library's and more), by the square root of its size: a 40 m emergent keeps its detail further, and
                // each asset's trees stay in few levels (each level in use is a draw call).
                const size = Math.sqrt(Math.max(instance.scale, 1));
                if (entry.near) {
                    const across = Math.hypot(instance.x - camera.x, instance.z - camera.z);
                    const above = camera.y - instance.y;
                    if (across < entry.crown * instance.scale + margin && above < entry.height * instance.scale + margin && above > -margin) {
                        entry.near.setMatrixAt(nearCount, instance.matrix);
                        entry.near.setColorAt(nearCount, instance.tint);
                        nearCount++;
                        continue;
                    }
                }
                const d = Math.hypot(instance.x - camera.x, instance.y - camera.y, instance.z - camera.z) / size;
                // Right beside the tree (up in its crown, a close-up on one of its leaves): full detail, the level its attach points are on.
                const close = d >= d0 && treeLodDistance(instance, camera) < TREE_CLOSE;
                let level: Level = d < d0 || close ? "lod0" : d < d1 ? "lod1" : d < d2 ? "lod2" : "card";
                // A level that failed to load falls to the next one that did.
                let index = LEVELS.indexOf(level);
                while (index < LEVELS.length - 1 && !entry.meshes[LEVELS[index]]) index++;
                level = LEVELS[index];
                const mesh = entry.meshes[level];
                if (!mesh) continue;
                mesh.setMatrixAt(counts[level], instance.matrix);
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
    }
}
