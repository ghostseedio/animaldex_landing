/**
 * The asset lane's rocks in the scene (graphics pass, batch 5): every decor
 * rock drawn as its library rock (`rock-assets.ts` picks which and places it),
 * instanced per rock and detail level, re-sorted as the camera moves. The
 * procedural rocks stand in until these load.
 *
 * The material keeps the assets' own colours (moss, barnacles, weathering)
 * and adds the place: a fine rock grain from the ground's CC0 rock texture,
 * lichen on the dry upper faces, a dark glossy band where the sea wets them
 * and a pale salt line above it.
 */

import {Color, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry, type Mesh} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {ARK_ENV, NOISE_GLSL} from "@/ark-scene/glsl";
import {ARK_GROUND_TEXTURES} from "@/ark-scene/ground-textures";
import {ASSET_BASE} from "@/ark-scene/tree-assets";
import {rockAssetFor, rockAssetInfo} from "@/ark-scene/rock-assets";
import {worldDecor} from "@/ark-scene/decor";

const LEVELS = ["lod0", "lod1", "lod2"] as const;
type Level = typeof LEVELS[number];
type Instance = {x: number; y: number; z: number; matrix: Matrix4; tint: Color};

function rockMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.9, metalness: 0});
    const uniforms = {groundAlbedo: ARK_GROUND_TEXTURES.albedo, groundReady: ARK_GROUND_TEXTURES.ready, envSeaLevel: ARK_ENV.seaLevel, envWetness: ARK_ENV.wetness};
    material.customProgramCacheKey = () => "ark-asset-rock-1";
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vRockW;\nvarying vec3 vRockN;")
            .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
vRockW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
vRockN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);`);
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
    diffuseColor.rgb = c;
}`)
            .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.28, rockWet);`);
    };
    return material;
}

export class AssetRocks {
    readonly group = new Group();
    /** Ready once every needed rock is loaded (the procedural rocks stand in until then). */
    ready = false;
    private readonly byAsset = new Map<string, {instances: Instance[]; meshes: Partial<Record<Level, InstancedMesh>>; distances: [number, number, number]}>();
    private readonly material = rockMaterial();
    private reach = 1;
    private shadows = true;
    private lastAt = new Vector3(Infinity, 0, 0);
    private framesSince = 0;

    constructor(base = ASSET_BASE) {
        const rotation = new Quaternion();
        const up = new Vector3(0, 1, 0);
        const at = new Vector3();
        const size = new Vector3();
        for (const item of worldDecor()) {
            const placed = rockAssetFor(item);
            if (!placed) continue;
            let entry = this.byAsset.get(placed.id);
            if (!entry) {
                entry = {instances: [], meshes: {}, distances: rockAssetInfo(placed.id).lod_distances};
                this.byAsset.set(placed.id, entry);
            }
            const matrix = new Matrix4().compose(at.set(placed.x, placed.y, placed.z), rotation.setFromAxisAngle(up, placed.yaw), size.setScalar(placed.scale));
            const frac = (value: number) => value - Math.floor(value);
            const shade = 0.92 + 0.16 * frac(item.x * 5.17 + item.z * 2.93);
            entry.instances.push({x: placed.x, y: placed.y, z: placed.z, matrix, tint: new Color(shade, shade, shade)});
        }
        void this.load(base.replace(/\/+$/, ""));
    }

    private async load(base: string) {
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        const jobs: Array<Promise<void>> = [];
        this.byAsset.forEach((entry, id) => {
            for (const lod of rockAssetInfo(id).lods) {
                if (!LEVELS.includes(lod.level)) continue;
                jobs.push(loader.loadAsync(`${base}/${lod.file}`).then((gltf) => {
                    let geometry: BufferGeometry | null = null;
                    gltf.scene.traverse((object) => {
                        if (!geometry && (object as Mesh).isMesh) geometry = (object as Mesh).geometry as BufferGeometry;
                    });
                    if (!geometry) return;
                    const mesh = new InstancedMesh(geometry, this.material, entry.instances.length);
                    mesh.count = 0;
                    mesh.frustumCulled = false;
                    mesh.castShadow = this.shadows;
                    mesh.receiveShadow = true;
                    mesh.userData.kind = "asset-rock";
                    entry.meshes[lod.level] = mesh;
                    this.group.add(mesh);
                }).catch(() => {}));
            }
        });
        await Promise.all(jobs);
        // Only take over when every rock can be drawn (a missing set keeps the procedural rocks).
        let complete = true;
        this.byAsset.forEach((entry) => {
            if (!LEVELS.some((level) => entry.meshes[level])) complete = false;
        });
        this.ready = complete && this.byAsset.size > 0;
        this.lastAt.set(Infinity, 0, 0);
    }

    /** The tier: how far each level reaches (as the trees) and whether rocks cast shadows. */
    setTier(reach: number, shadows: boolean) {
        this.reach = reach;
        this.shadows = shadows;
        this.byAsset.forEach((entry) => {
            for (const level of LEVELS) {
                const mesh = entry.meshes[level];
                if (mesh) mesh.castShadow = shadows;
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
            // Rocks are cheap: full detail a little further than the asset asks, never below lod2 far away.
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
        this.material.dispose();
    }
}
