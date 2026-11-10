/**
 * The "ark" model set (contract section 3): per species a `near.glb`
 * (~3,000 triangles) and a `far.glb` (~600), meshopt-compressed with
 * quantised attributes and a 512² WebP skin, and an `ark.json` with the
 * extent and the talking model's `behaviour`. Read with three's GLTFLoader
 * and MeshoptDecoder.
 *
 * `<base>/manifest.json` → `{models: {slug: version}}`, files at
 * `<base>/<slug>/<version>.near.glb | .far.glb | .ark.json`. A species not
 * in it has no model and is drawn as its icon at every distance.
 *
 * The local development route also lists `fallback` species: those with
 * only the full talking model (`assets/<slug>.glb`, the g1 layout, read by
 * the call's own parser), so the scene is never blocked on the model build.
 * Both levels of detail are then that one mesh.
 */

import {BufferAttribute, BufferGeometry, Matrix3, Matrix4, Mesh, SRGBColorSpace, TextureLoader, type MeshStandardMaterial, type Texture} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {parseTalkingGlb} from "@/components/ask-animaldex/voice-call/talking-model-renderer";
import type {TalkingBehaviour} from "@/lib/talking-models/behaviour";
import {bodyAxisExtent} from "@/ark-scene/stats";

export type ArkManifest = {
    models: Record<string, string>;
    /** Development only: species served from the full talking model instead. */
    fallback?: Record<string, string>;
};

export type ModelLevel = {geometry: BufferGeometry; map: Texture | null; triangles: number};

export type SpeciesModel = {
    slug: string;
    near: ModelLevel | null;
    far: ModelLevel | null;
    behaviour: TalkingBehaviour | null;
    /** The model's own extent, from whichever level came first. */
    minY: number;
    height: number;
    length: number;
    /** Its extent along its body-length axis (`bodyAxisExtent`): the drawn size is measured on it. */
    bodyLength: number;
};

type Wanted = "far" | "near";

/** Plain float attributes, the node's transform baked in: quantised attributes can't take it. */
function plainGeometry(source: BufferGeometry, matrix: Matrix4): BufferGeometry {
    const geometry = new BufferGeometry();
    const normalMatrix = new Matrix3().getNormalMatrix(matrix);
    const position = source.getAttribute("position");
    const positions = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
        positions[i * 3] = position.getX(i);
        positions[i * 3 + 1] = position.getY(i);
        positions[i * 3 + 2] = position.getZ(i);
    }
    const positionAttribute = new BufferAttribute(positions, 3);
    positionAttribute.applyMatrix4(matrix);
    geometry.setAttribute("position", positionAttribute);
    const normal = source.getAttribute("normal");
    if (normal) {
        const normals = new Float32Array(normal.count * 3);
        for (let i = 0; i < normal.count; i++) {
            normals[i * 3] = normal.getX(i);
            normals[i * 3 + 1] = normal.getY(i);
            normals[i * 3 + 2] = normal.getZ(i);
        }
        const normalAttribute = new BufferAttribute(normals, 3);
        normalAttribute.applyNormalMatrix(normalMatrix);
        for (let i = 0; i < normal.count; i++) {
            const x = normals[i * 3];
            const y = normals[i * 3 + 1];
            const z = normals[i * 3 + 2];
            const length = Math.hypot(x, y, z) || 1;
            normals[i * 3] = x / length;
            normals[i * 3 + 1] = y / length;
            normals[i * 3 + 2] = z / length;
        }
        geometry.setAttribute("normal", normalAttribute);
    }
    const uv = source.getAttribute("uv");
    if (uv) {
        const uvs = new Float32Array(uv.count * 2);
        for (let i = 0; i < uv.count; i++) {
            uvs[i * 2] = uv.getX(i);
            uvs[i * 2 + 1] = uv.getY(i);
        }
        geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    }
    const index = source.getIndex();
    if (index) geometry.setIndex(new BufferAttribute(index.array.slice(0), 1));
    if (!normal) geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}

function triangles(geometry: BufferGeometry): number {
    return (geometry.getIndex()?.count ?? geometry.getAttribute("position").count) / 3;
}

export class ModelLibrary {
    private manifest: ArkManifest | null = null;
    private readonly manifestReady: Promise<ArkManifest | null>;
    private readonly loader: GLTFLoader;
    private readonly models = new Map<string, SpeciesModel>();
    private readonly requested = new Map<string, Set<Wanted>>();
    private readonly queue: Array<{slug: string; level: Wanted}> = [];
    private active = 0;
    private disposed = false;
    private readonly abort = new AbortController();
    /** Called whenever a level finishes loading. */
    onLoad: (slug: string) => void = () => undefined;

    constructor(private readonly base: string, private readonly concurrency = 3) {
        this.loader = new GLTFLoader();
        this.loader.setMeshoptDecoder(MeshoptDecoder);
        this.manifestReady = fetch(`${base.replace(/\/+$/, "")}/manifest.json`, {signal: this.abort.signal})
            .then((response) => (response.ok ? response.json() : null))
            .then((raw: unknown) => {
                const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
                const models = row?.models && typeof row.models === "object" ? row.models as Record<string, string> : {};
                const fallback = row?.fallback && typeof row.fallback === "object" ? row.fallback as Record<string, string> : undefined;
                this.manifest = {models, fallback};
                this.pump();
                return this.manifest;
            })
            .catch(() => {
                this.manifest = {models: {}};
                return this.manifest;
            });
    }

    ready(): Promise<ArkManifest | null> {
        return this.manifestReady;
    }

    /** Whether a species has any model to load (false until the manifest is in). */
    has(slug: string): boolean {
        return Boolean(this.manifest && (this.manifest.models[slug] || this.manifest.fallback?.[slug]));
    }

    get(slug: string): SpeciesModel | undefined {
        return this.models.get(slug);
    }

    get loadedCount(): number {
        return this.models.size;
    }

    /** Still loading or waiting to load something (the recorder waits for this before a shot). */
    get busy(): boolean {
        return !this.manifest || this.active > 0 || this.queue.length > 0;
    }

    /** Ask for a level; the far one comes first, and both come at once from a fallback. */
    request(slug: string, level: Wanted) {
        if (level === "near") this.request(slug, "far");
        const asked = this.requested.get(slug) ?? new Set<Wanted>();
        if (asked.has(level)) return;
        asked.add(level);
        this.requested.set(slug, asked);
        this.queue.push({slug, level});
        this.pump();
    }

    private pump() {
        if (!this.manifest || this.disposed) return;
        while (this.active < this.concurrency && this.queue.length) {
            const next = this.queue.shift()!;
            if (!this.has(next.slug)) continue;
            this.active++;
            this.load(next.slug, next.level)
                .catch((error) => {
                    if (!this.disposed) console.warn(`[ark] ${next.slug} ${next.level}`, error instanceof Error ? error.message : error);
                })
                .finally(() => {
                    this.active--;
                    this.pump();
                });
        }
    }

    private url(slug: string, file: string): string {
        return `${this.base.replace(/\/+$/, "")}/${encodeURIComponent(slug)}/${file}`;
    }

    private async loadGltf(url: string): Promise<ModelLevel> {
        const gltf = await this.loader.loadAsync(url);
        gltf.scene.updateMatrixWorld(true);
        let found: Mesh | null = null;
        gltf.scene.traverse((object) => {
            if (!found && (object as Mesh).isMesh) found = object as Mesh;
        });
        const mesh = found as Mesh | null;
        if (!mesh) throw new Error("no mesh");
        const geometry = plainGeometry(mesh.geometry, mesh.matrixWorld);
        const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial;
        const map = material?.map ?? null;
        mesh.geometry.dispose();
        material?.dispose();
        return {geometry, map, triangles: triangles(geometry)};
    }

    private remember(slug: string, behaviour: TalkingBehaviour | null, level: ModelLevel): SpeciesModel {
        let model = this.models.get(slug);
        if (!model) {
            const box = level.geometry.boundingBox!;
            model = {
                slug,
                near: null,
                far: null,
                behaviour,
                minY: box.min.y,
                height: box.max.y - box.min.y,
                length: Math.max(box.max.z - box.min.z, 0.05),
                bodyLength: Math.max(bodyAxisExtent(slug, behaviour?.plan, {x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z}), 0.05)
            };
            this.models.set(slug, model);
        }
        return model;
    }

    private async load(slug: string, level: Wanted) {
        const version = this.manifest?.models[slug];
        if (version) {
            if (level === "far") {
                const [far, json] = await Promise.all([
                    this.loadGltf(this.url(slug, `${version}.far.glb`)),
                    fetch(this.url(slug, `${version}.ark.json`), {signal: this.abort.signal}).then((response) => (response.ok ? response.json() : null)).catch(() => null)
                ]);
                if (this.disposed) return disposeLevel(far);
                const behaviour = (json && typeof json === "object" ? (json as {behaviour?: TalkingBehaviour}).behaviour : null) ?? null;
                this.remember(slug, behaviour, far).far = far;
            } else {
                const near = await this.loadGltf(this.url(slug, `${version}.near.glb`));
                if (this.disposed) return disposeLevel(near);
                this.remember(slug, this.models.get(slug)?.behaviour ?? null, near).near = near;
            }
            this.onLoad(slug);
            return;
        }
        if (!this.manifest?.fallback?.[slug] || this.models.get(slug)) return;
        // The full talking model: body and jaw as one mesh, its skin beside it.
        const [buffer, json, map] = await Promise.all([
            fetch(this.url(slug, "g1.glb"), {signal: this.abort.signal}).then((response) => {
                if (!response.ok) throw new Error(`g1 ${response.status}`);
                return response.arrayBuffer();
            }),
            fetch(this.url(slug, "g1.json"), {signal: this.abort.signal}).then((response) => (response.ok ? response.json() : null)).catch(() => null),
            new TextureLoader().setCrossOrigin("anonymous").loadAsync(this.url(slug, "g1.jpg"))
        ]);
        map.flipY = false;
        map.colorSpace = SRGBColorSpace;
        const parts = parseTalkingGlb(buffer);
        const merged = mergeGeometries([parts.body, parts.jaw].map((part) => {
            const keep = new BufferGeometry();
            for (const name of ["position", "normal", "uv"]) {
                const attribute = part.getAttribute(name);
                if (attribute) keep.setAttribute(name, attribute);
            }
            const index = part.getIndex();
            if (index) keep.setIndex(new BufferAttribute(new Uint32Array(index.array), 1));
            return keep;
        }));
        Object.values(parts).forEach((part) => part.dispose());
        if (!merged) throw new Error("merge");
        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        if (this.disposed) {
            merged.dispose();
            map.dispose();
            return;
        }
        const whole: ModelLevel = {geometry: merged, map, triangles: triangles(merged)};
        const behaviour = (json && typeof json === "object" ? (json as {behaviour?: TalkingBehaviour}).behaviour : null) ?? null;
        const model = this.remember(slug, behaviour, whole);
        model.far = whole;
        model.near = whole;
        this.onLoad(slug);
    }

    dispose() {
        this.disposed = true;
        this.abort.abort();
        const textures = new Set<Texture>();
        const geometries = new Set<BufferGeometry>();
        this.models.forEach((model) => {
            for (const level of [model.near, model.far]) {
                if (!level) continue;
                geometries.add(level.geometry);
                if (level.map) textures.add(level.map);
            }
        });
        geometries.forEach((geometry) => geometry.dispose());
        textures.forEach((texture) => texture.dispose());
        this.models.clear();
    }
}

function disposeLevel(level: ModelLevel) {
    level.geometry.dispose();
    level.map?.dispose();
}
