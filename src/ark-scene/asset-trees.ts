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
 */

import {Color, DoubleSide, FrontSide, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry, type Mesh} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {ARK_TIME, ARK_WIND} from "@/ark-scene/glsl";
import {ASSETS, ASSET_BASE, treeAssetFor} from "@/ark-scene/tree-assets";
import {forestFill, worldDecor} from "@/ark-scene/decor";
import {DECOR_SINK} from "@/ark-scene/micro-decor";
import {heightAt} from "@/ark-scene/world";

const LEVELS = ["lod0", "lod1", "lod2", "card"] as const;
type Level = typeof LEVELS[number];

type Instance = {x: number; y: number; z: number; matrix: Matrix4; tint: Color; fill: boolean; rank: number};

function windMaterial(doubleSided: boolean): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.85, metalness: 0, side: doubleSided ? DoubleSide : FrontSide});
    material.customProgramCacheKey = () => `ark-asset-tree-${doubleSided ? 2 : 1}`;
    material.onBeforeCompile = (shader) => {
        shader.uniforms.arkTime = ARK_TIME;
        shader.uniforms.arkWind = ARK_WIND;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
attribute vec4 color_1;
uniform float arkTime;
uniform vec2 arkWind;`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>
{
    vec3 root = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float gust = length(arkWind);
    vec2 along = arkWind / max(gust, 1e-3);
    float phase = color_1.y * 6.2831853;
    float wave = sin(arkTime * 1.25 + phase + root.x * 0.19 + root.z * 0.15) + 0.4 * sin(arkTime * 2.6 + phase * 1.7 + root.x * 0.4);
    // Trunk a little, branches more, leaves most (the asset's sway weight), bending more the higher it is.
    float bend = color_1.x * (0.25 + 0.06 * max(transformed.y, 0.0));
    transformed.xz += along * (0.35 + 0.65 * wave) * bend * 0.09 * gust;
    float leaf = color_1.w * 6.2831853;
    transformed += vec3(sin(arkTime * 7.1 + leaf), 0.6 * sin(arkTime * 6.3 + leaf * 1.3), cos(arkTime * 6.7 + leaf)) * color_1.z * 0.025 * (0.4 + gust);
}`);
        // Leaves are single sheets: lit from the side the light comes, never black on the back.
        shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
#ifdef DOUBLE_SIDED
normal *= faceDirection;
nonPerturbedNormal *= faceDirection;
#endif`);
    };
    return material;
}

export class AssetTrees {
    readonly group = new Group();
    /** Ready once every needed tree is loaded (the procedural trees stand in until then). */
    ready = false;
    private readonly byAsset = new Map<string, {instances: Instance[]; meshes: Partial<Record<Level, InstancedMesh>>; distances: [number, number, number]}>();
    private readonly materials = {double: windMaterial(true), front: windMaterial(false)};
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
            const asset = treeAssetFor(item as never);
            if (!asset) return;
            // Not on bare rock faces high on the mountain (from afar they read as pockmarks in the rock).
            if (item.y > 16) {
                const slope = Math.hypot(heightAt(item.x + 1.5, item.z) - heightAt(item.x - 1.5, item.z), heightAt(item.x, item.z + 1.5) - heightAt(item.x, item.z - 1.5)) / 3;
                if (slope > 0.8) return;
            }
            let entry = this.byAsset.get(asset.id);
            if (!entry) {
                const info = ASSETS[asset.id];
                entry = {instances: [], meshes: {}, distances: info.lod_distances};
                this.byAsset.set(asset.id, entry);
            }
            const matrix = new Matrix4().compose(position.set(item.x, item.y - DECOR_SINK, item.z), rotation.setFromAxisAngle(up, item.rotation), scale.setScalar(asset.scale));
            const frac = (value: number) => value - Math.floor(value);
            const shade = 0.9 + 0.2 * frac(item.x * 7.13 + item.z * 3.71);
            entry.instances.push({x: item.x, y: item.y, z: item.z, matrix, tint: new Color(shade, shade * (0.97 + 0.06 * frac(item.z * 5.3)), shade), fill, rank});
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
                    const mesh = new InstancedMesh(geometry, lod.doubleSided ? this.materials.double : this.materials.front, entry.instances.length);
                    mesh.count = 0;
                    mesh.frustumCulled = false;
                    mesh.castShadow = lod.level !== "card" && this.shadows;
                    mesh.receiveShadow = true;
                    mesh.userData.kind = "asset-tree";
                    entry.meshes[lod.level] = mesh;
                    this.group.add(mesh);
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
            const counts: Record<Level, number> = {lod0: 0, lod1: 0, lod2: 0, card: 0};
            const [d0, d1, d2] = entry.distances.map((d) => d * this.reach);
            for (const instance of entry.instances) {
                if (instance.fill && instance.rank > this.fill) continue;
                const d = Math.hypot(instance.x - camera.x, instance.y - camera.y, instance.z - camera.z);
                let level: Level = d < d0 ? "lod0" : d < d1 ? "lod1" : d < d2 ? "lod2" : "card";
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
        this.materials.double.dispose();
        this.materials.front.dispose();
    }
}
