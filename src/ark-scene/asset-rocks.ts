/**
 * The asset lane's rocks in the scene (graphics pass, batch 5): every decor
 * rock drawn as its library rock (`rock-assets.ts` picks which and places it),
 * instanced per rock and detail level, re-sorted as the camera moves. The
 * procedural rocks stand in until these load. Batch 6: the same instancing
 * draws the forest floor set (`floor-assets.ts`: litter, twigs, cones, logs).
 *
 * The material keeps the assets' own colours (moss, barnacles, weathering)
 * and adds the place: a fine rock grain from the ground's CC0 rock texture,
 * lichen on the dry upper faces, a dark glossy band where the sea wets them
 * and a pale salt line above it.
 */

import {BufferAttribute, BufferGeometry, Color, DoubleSide, FrontSide, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Mesh} from "three";
import type {RockMesh} from "@/ark-scene/rock-shapes";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {ARK_ENV, NOISE_GLSL} from "@/ark-scene/glsl";
import {ARK_GROUND_TEXTURES} from "@/ark-scene/ground-textures";
import {ASSET_BASE} from "@/ark-scene/tree-assets";
import {generatedRockFile, rockAssetFor, rockAssetInfo} from "@/ark-scene/rock-assets";
import {cachedRock} from "@/ark-scene/rock-shapes";
import {floorAssetInfo, floorPlacements} from "@/ark-scene/floor-assets";
import {worldDecor} from "@/ark-scene/decor";

const LEVELS = ["lod0", "lod1", "lod2"] as const;
type Level = typeof LEVELS[number];
type Instance = {x: number; y: number; z: number; matrix: Matrix4; tint: Color};

/** Rock above this height (m) carries a dusting of snow on its upward faces, full by `ROCK_DUST_FULL` (the high crags). */
export const ROCK_DUST_FROM = 20;
export const ROCK_DUST_FULL = 27;

/**
 * The rocks' material, shared by the asset rocks and the island's own rocks (`rock-shapes.ts`): one material for every
 * rock, so a crag high in the snow and a boulder by the sea draw in the same batches. High up, snow lies on the upward
 * faces by height (`ROCK_DUST_FROM`), in drifts that follow the rock's own grain.
 */
export function rockMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.9, metalness: 0});
    const uniforms = {groundAlbedo: ARK_GROUND_TEXTURES.albedo, groundReady: ARK_GROUND_TEXTURES.ready, envSeaLevel: ARK_ENV.seaLevel, envWetness: ARK_ENV.wetness};
    material.customProgramCacheKey = () => "ark-asset-rock-2";
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vRockW;\nvarying vec3 vRockN;")
            .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
#ifdef USE_INSTANCING
vRockW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
vRockN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
#else
vRockW = (modelMatrix * vec4(transformed, 1.0)).xyz;
vRockN = normalize(mat3(modelMatrix) * objectNormal);
#endif`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
varying vec3 vRockW;
varying vec3 vRockN;
uniform highp sampler2DArray groundAlbedo;
uniform float groundReady;
uniform float envSeaLevel;
uniform float envWetness;
${NOISE_GLSL}
float rockWet = 0.0;`)
            .replace("#include <color_fragment>", `#include <color_fragment>
{
    vec3 w = vRockW;
    vec3 n = normalize(vRockN);
    // The assets' stone reads near black in the scene's light: lifted toward a weathered grey.
    vec3 c = diffuseColor.rgb * 1.45 + 0.012;
    // A fine grain (the ground's rock texture, three ways, greyed) over the asset's own colours.
    if (groundReady > 0.5) {
        vec3 k = pow(abs(n), vec3(4.0));
        k /= (k.x + k.y + k.z);
        float s = 0.9;
        vec3 t = texture(groundAlbedo, vec3(w.zy * s, 5.0)).rgb * k.x + texture(groundAlbedo, vec3(w.xz * s, 5.0)).rgb * k.y + texture(groundAlbedo, vec3(w.xy * s, 5.0)).rgb * k.z;
        c *= mix(1.0, dot(t / vec3(0.227, 0.144, 0.08), vec3(0.3333)), 0.45);
    }
    float h = w.y - envSeaLevel;
    // Lichen on the dry faces that look up or out: grey-green crusts and a few orange ones, in patches.
    float dry = smoothstep(0.7, 1.4, h);
    float lichen = smoothstep(0.55, 0.72, arkFbm(w.xz * 2.3 + w.y * 1.7)) * smoothstep(-0.1, 0.5, n.y) * dry;
    float orange = step(0.78, arkNoise(w.xz * 0.9 + w.y));
    c = mix(c, mix(vec3(0.42, 0.44, 0.33), vec3(0.62, 0.33, 0.1), orange) * (0.8 + 0.3 * arkNoise(w.xz * 9.0)), lichen * 0.55);
    // The sea's mark: dark and wet up to the swash, a pale salt line above it.
    float wet = 1.0 - smoothstep(0.15, 0.6, h);
    c *= mix(1.0, 0.66, wet);
    c = mix(c, c * 1.3 + 0.03, smoothstep(0.55, 0.62, h) * (1.0 - smoothstep(0.62, 0.8, h)) * 0.55);
    rockWet = max(wet, envWetness * 0.7);
    c *= mix(1.0, 0.72, envWetness * (1.0 - wet));
    // High up, snow lying on the ledges and tops, in drifts that follow the rock's own grain.
    // Only the flatter tops and ledges hold it, in patches; the faces stay rock (a dusted crag, not a white one).
    float snowy = smoothstep(${ROCK_DUST_FROM.toFixed(1)}, ${ROCK_DUST_FULL.toFixed(1)}, w.y) * smoothstep(0.68, 0.92, n.y) * smoothstep(0.42, 0.62, arkFbm(w.xz * 1.7 + w.y * 0.6));
    c = mix(c, vec3(0.86, 0.88, 0.9), clamp(snowy * 0.9, 0.0, 0.9));
    diffuseColor.rgb = c;
}`)
            .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.28, rockWet);`);
    };
    return material;
}

/** A rock made in code (`rock-shapes.ts`) as three.js geometry: position, normal, colour. */
export function rockGeometry(mesh: RockMesh): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(mesh.positions, 3));
    geometry.setAttribute("normal", new BufferAttribute(mesh.normals, 3));
    geometry.setAttribute("color", new BufferAttribute(mesh.colors, 3));
    geometry.setIndex(new BufferAttribute(mesh.index, 1));
    geometry.computeBoundingSphere();
    return geometry;
}

type AssetInfo = {lod_distances: [number, number, number]; lods: Array<{level: string; file: string; doubleSided: boolean}>};
export type AssetPlacement = {id: string; x: number; y: number; z: number; yaw: number; scale: number; up?: [number, number, number]; shade?: number};

/**
 * Library assets placed many times: instanced per asset and detail level (lod0, lod1, lod2), re-sorted as the camera
 * moves, culled against the view by the bounds of what each level draws. Far levels cast no shadow.
 */
export class AssetInstances {
    readonly group = new Group();
    /** Ready once every needed asset is loaded. */
    ready = false;
    private readonly byAsset = new Map<string, {instances: Instance[]; meshes: Partial<Record<Level, InstancedMesh>>; distances: [number, number, number]; info: AssetInfo}>();
    private reach = 1;
    private shadows = true;
    private lastAt = new Vector3(Infinity, 0, 0);
    private framesSince = 0;

    constructor(placements: AssetPlacement[], infoFor: (id: string) => AssetInfo, private readonly materials: {front: MeshStandardMaterial; double: MeshStandardMaterial}, base = ASSET_BASE, private readonly kind = "asset") {
        const rotation = new Quaternion();
        const turn = new Quaternion();
        const yAxis = new Vector3(0, 1, 0);
        const upVector = new Vector3();
        const at = new Vector3();
        const size = new Vector3();
        for (const placed of placements) {
            let entry = this.byAsset.get(placed.id);
            if (!entry) {
                const info = infoFor(placed.id);
                entry = {instances: [], meshes: {}, distances: info.lod_distances, info};
                this.byAsset.set(placed.id, entry);
            }
            if (placed.up) rotation.setFromUnitVectors(yAxis, upVector.set(placed.up[0], placed.up[1], placed.up[2])).multiply(turn.setFromAxisAngle(yAxis, placed.yaw));
            else rotation.setFromAxisAngle(yAxis, placed.yaw);
            const matrix = new Matrix4().compose(at.set(placed.x, placed.y, placed.z), rotation, size.setScalar(placed.scale));
            const shade = placed.shade ?? 1;
            entry.instances.push({x: placed.x, y: placed.y, z: placed.z, matrix, tint: new Color(shade, shade, shade)});
        }
        void this.load(base.replace(/\/+$/, ""));
    }

    private async load(base: string) {
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        const jobs: Array<Promise<void>> = [];
        this.byAsset.forEach((entry) => {
            for (const lod of entry.info.lods) {
                const level = lod.level as Level;
                if (!LEVELS.includes(level)) continue;
                // A rock made here (rock-assets.ts "gen:…"): its mesh is built, not loaded.
                const made = generatedRockFile(lod.file);
                const source: Promise<BufferGeometry | null> = made
                    ? Promise.resolve(rockGeometry(cachedRock(made.style, made.variant, made.detail)))
                    : loader.loadAsync(`${base}/${lod.file}`).then((gltf) => {
                          let found: BufferGeometry | null = null;
                          gltf.scene.traverse((object) => {
                              if (!found && (object as Mesh).isMesh) found = (object as Mesh).geometry as BufferGeometry;
                          });
                          return found;
                      });
                jobs.push(source.then((geometry) => {
                    if (!geometry) return;
                    const mesh = new InstancedMesh(geometry, lod.doubleSided ? this.materials.double : this.materials.front, entry.instances.length);
                    mesh.count = 0;
                    // Culled against the view by the bounds of the instances drawn at this level (set in update).
                    mesh.frustumCulled = true;
                    mesh.castShadow = this.shadows && level !== "lod2";
                    mesh.receiveShadow = true;
                    mesh.userData.kind = this.kind;
                    entry.meshes[level] = mesh;
                    this.group.add(mesh);
                }).catch(() => {}));
            }
        });
        await Promise.all(jobs);
        // Only take over when every asset can be drawn (a missing set keeps what stood in).
        let complete = true;
        this.byAsset.forEach((entry) => {
            if (!LEVELS.some((level) => entry.meshes[level])) complete = false;
        });
        this.ready = complete && this.byAsset.size > 0;
        this.lastAt.set(Infinity, 0, 0);
    }

    /** The tier: how far each level reaches and whether the near levels cast shadows. */
    setTier(reach: number, shadows: boolean) {
        this.reach = reach;
        this.shadows = shadows;
        this.byAsset.forEach((entry) => {
            for (const level of LEVELS) {
                const mesh = entry.meshes[level];
                // Far levels' shadows fall outside the shadow map's reach anyway.
                if (mesh) mesh.castShadow = shadows && level !== "lod2";
            }
        });
        this.lastAt.set(Infinity, 0, 0);
    }

    /** Re-sort the levels when the camera has moved (or every half second). */
    update(camera: Vector3) {
        if (!this.ready) return;
        this.framesSince++;
        if (camera.distanceToSquared(this.lastAt) < 2.25 && this.framesSince < 30) return;
        this.framesSince = 0;
        this.lastAt.copy(camera);
        this.byAsset.forEach((entry) => {
            const counts: Record<Level, number> = {lod0: 0, lod1: 0, lod2: 0};
            // Full detail a little further than the asset asks on the lower tiers, never below lod2 far away.
            const [d0, d1] = entry.distances.map((d) => d * Math.max(this.reach, 0.5));
            for (const instance of entry.instances) {
                const d = Math.hypot(instance.x - camera.x, instance.y - camera.y, instance.z - camera.z);
                let index = d < d0 ? 0 : d < d1 ? 1 : 2;
                while (index < LEVELS.length - 1 && !entry.meshes[LEVELS[index]]) index++;
                while (index > 0 && !entry.meshes[LEVELS[index]]) index--;
                const mesh = entry.meshes[LEVELS[index]];
                if (!mesh) continue;
                mesh.setMatrixAt(counts[LEVELS[index]], instance.matrix);
                mesh.setColorAt(counts[LEVELS[index]], instance.tint);
                counts[LEVELS[index]]++;
            }
            for (const level of LEVELS) {
                const mesh = entry.meshes[level];
                if (!mesh) continue;
                mesh.count = counts[level];
                mesh.visible = counts[level] > 0;
                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
                if (mesh.visible) mesh.computeBoundingSphere();
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
        });
        this.materials.front.dispose();
        if (this.materials.double !== this.materials.front) this.materials.double.dispose();
    }
}

/** Every decor rock as its asset rock (batch 5). */
export class AssetRocks extends AssetInstances {
    constructor(base = ASSET_BASE) {
        const placements: AssetPlacement[] = [];
        const frac = (value: number) => value - Math.floor(value);
        for (const item of worldDecor()) {
            const placed = rockAssetFor(item);
            if (!placed) continue;
            placements.push({...placed, shade: 0.92 + 0.16 * frac(item.x * 5.17 + item.z * 2.93)});
        }
        const material = rockMaterial();
        super(placements, rockAssetInfo, {front: material, double: material}, base, "asset-rock");
    }
}

/** The forest floor's litter, logs, twigs and cones (batch 6): the assets' own colours, a little darker in the shade of the woods. */
function floorMaterial(doubleSided: boolean): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.95, metalness: 0, side: doubleSided ? DoubleSide : FrontSide});
    material.customProgramCacheKey = () => `ark-asset-floor-${doubleSided ? 2 : 1}`;
    return material;
}

export class AssetFloor extends AssetInstances {
    constructor(base = ASSET_BASE) {
        const frac = (value: number) => value - Math.floor(value);
        const placements = floorPlacements().map((p) => ({...p, shade: 0.9 + 0.2 * frac(p.x * 3.7 + p.z * 1.9)}));
        super(placements, floorAssetInfo, {front: floorMaterial(false), double: floorMaterial(true)}, base, "asset-floor");
    }
}
