/**
 * The "ark" model set (contract section 3): per species a `near.glb`
 * (~3,000 triangles) and a `far.glb` (~600), meshopt-compressed with
 * quantised attributes and a 512² WebP skin, and an `ark.json` with the
 * extent and the talking model's `behaviour`. Read with three's GLTFLoader
 * and MeshoptDecoder.
 *
 * `<base>/manifest.json` → `{models: {slug: version}}`, files at
 * `<base>/<slug>/<version>.near.glb | .far.glb | .ark.json`. A species not
 * in it, or whose files fail to load, is drawn as the neutral placeholder
 * figure (`placeholder.ts`, owner decision A13): never a broken model.
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
import {placeholderGeometry} from "@/ark-scene/placeholder";
import {fittedSize} from "@/ark-scene/runtime/budgets";
import {geometryBytes, textureBytes} from "@/ark-scene/runtime/memory";

export type ArkManifest = {
    models: Record<string, string>;
    /** Development only: species served from the full talking model instead. */
    fallback?: Record<string, string>;
};

/**
 * `facing`: degrees about up the file turns the mesh by (a `facing` node,
 * `extras.ark_facing`): the 14 birds modelled facing another way are turned
 * in the file itself, so a rig (`rig-player.ts`) made from the turned mesh
 * matches it.
 */
export type ModelLevel = {geometry: BufferGeometry; map: Texture | null; triangles: number; facing?: number};

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
    /** The neutral figure standing in for a species with no model (A13). */
    placeholder?: boolean;
    /** Degrees about up the model's file turns its mesh (`ModelLevel.facing`), 0 for most. */
    facing: number;
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
    /**
     * Runtime (`runtime/load.ts`): which queued level loads next (lower first); null keeps the order asked.
     * `fit`: the longest skin edge per level after loading (`runtime/budgets.ts`); null keeps the file's.
     * `paced`: finished levels wait in `staged` until `drain` hands them to the scene a few per frame.
     */
    priority: ((slug: string, level: Wanted) => number) | null = null;
    /** Runtime: whether a level may be asked for now (a near level let go over the budget waits until it is wanted close). */
    gate: ((slug: string, level: Wanted) => boolean) | null = null;
    fit: {near: number; far: number} | null = null;
    paced = false;
    /** Runtime: put a skin on the GPU as its level is handed over (inside `drain`'s budget), not in the next frame's draw. */
    upload: ((map: Texture) => void) | null = null;
    private readonly staged: Array<() => void> = [];
    /** GPU bytes per loaded level (`runtime/memory.ts`'s estimate). */
    private readonly levelBytes = new Map<string, {geometry: number; texture: number}>();

    constructor(private readonly base: string, private concurrency = 3) {
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

    /**
     * Whether a species can be drawn: once the manifest is in, every one can
     * (a species it doesn't list gets the placeholder figure).
     */
    has(_slug: string): boolean {
        return Boolean(this.manifest);
    }

    /** Whether the model set lists this species (false: the placeholder stands in). */
    listed(slug: string): boolean {
        return Boolean(this.manifest && (this.manifest.models[slug] || this.manifest.fallback?.[slug]));
    }

    /** How many species are drawn as the placeholder. */
    get placeholderCount(): number {
        let n = 0;
        this.models.forEach((model) => {
            if (model.placeholder) n++;
        });
        return n;
    }

    get(slug: string): SpeciesModel | undefined {
        return this.models.get(slug);
    }

    get loadedCount(): number {
        return this.models.size;
    }

    /** Still loading or waiting to load something (the recorder waits for this before a shot). */
    get busy(): boolean {
        return !this.manifest || this.active > 0 || this.queue.length > 0 || this.staged.length > 0;
    }

    /** Runtime: drop queued (not yet started) levels the scene no longer wants; asked again when it does. */
    prune(keep: (slug: string, level: Wanted) => boolean): number {
        let dropped = 0;
        for (let i = this.queue.length - 1; i >= 0; i--) {
            const item = this.queue[i];
            if (keep(item.slug, item.level)) continue;
            this.queue.splice(i, 1);
            this.requested.get(item.slug)?.delete(item.level);
            dropped++;
        }
        return dropped;
    }

    /** Runtime: how many files load at once (more on a desktop's connection, fewer on a phone's). */
    setConcurrency(count: number) {
        this.concurrency = Math.max(1, Math.round(count));
        this.pump();
    }

    /** Levels asked for and not yet handed to the scene (the quiet loading bar's count). */
    get pending(): number {
        return this.active + this.queue.length + this.staged.length;
    }

    /**
     * Hand finished levels to the scene while `allows()` says the frame has time (paced mode); `upload` puts a skin
     * on the GPU now, inside that budget, instead of at the first frame it is drawn in.
     */
    drain(allows: () => boolean, ran: () => void) {
        while (this.staged.length && allows()) {
            this.staged.shift()!();
            ran();
        }
    }

    /** Every loaded level's GPU bytes, for the budget (`runtime/budgets.ts`). */
    levels(): Array<{slug: string; level: Wanted; geometry: number; texture: number}> {
        return Array.from(this.levelBytes.entries()).map(([key, bytes]) => {
            const [slug, level] = key.split("\u0000") as [string, Wanted];
            return {slug, level, ...bytes};
        });
    }

    /**
     * Let a species' near level go (over the memory budget): its far level stands in until it is asked for again.
     * Never the far level, never a fallback or placeholder (one mesh is both levels).
     */
    evict(slug: string, level: "near"): boolean {
        const model = this.models.get(slug);
        if (!model?.near || model.placeholder || !this.levelBytes.has(`${slug}\u0000${level}`) || model.near.geometry === model.far?.geometry) return false;
        disposeLevel(model.near);
        model.near = null;
        this.levelBytes.delete(`${slug}\u0000${level}`);
        this.requested.get(slug)?.delete(level);
        return true;
    }

    /** Ask for a level; the far one comes first, and both come at once from a fallback. */
    request(slug: string, level: Wanted) {
        if (level === "near") this.request(slug, "far");
        const asked = this.requested.get(slug) ?? new Set<Wanted>();
        if (asked.has(level)) return;
        if (this.gate && !this.gate(slug, level)) return;
        asked.add(level);
        this.requested.set(slug, asked);
        this.queue.push({slug, level});
        this.pump();
    }

    private pump() {
        if (!this.manifest || this.disposed) return;
        while (this.active < this.concurrency && this.queue.length) {
            // The runtime's order (nearest in view first), else the order asked; ties keep the order asked.
            let pick = 0;
            if (this.priority) {
                let best = Infinity;
                for (let i = 0; i < this.queue.length; i++) {
                    const rank = this.priority(this.queue[i].slug, this.queue[i].level);
                    if (rank < best) {
                        best = rank;
                        pick = i;
                    }
                }
            }
            const next = this.queue.splice(pick, 1)[0];
            if (!this.has(next.slug)) continue;
            this.active++;
            this.load(next.slug, next.level)
                .catch((error) => {
                    if (this.disposed) return;
                    console.warn(`[ark] ${next.slug} ${next.level}`, error instanceof Error ? error.message : error);
                    // Files that don't load: the placeholder, never a broken model (or nothing).
                    if (!this.models.get(next.slug)?.far) this.placeholder(next.slug);
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

    private async loadGltf(url: string, edge = 0): Promise<ModelLevel> {
        const gltf = await this.loader.loadAsync(url);
        gltf.scene.updateMatrixWorld(true);
        let found: Mesh | null = null;
        let facing = 0;
        gltf.scene.traverse((object) => {
            if (!found && (object as Mesh).isMesh) found = object as Mesh;
            const turned = Number((object.userData as {ark_facing?: unknown} | undefined)?.ark_facing);
            if (Number.isFinite(turned) && turned) facing = turned;
        });
        const mesh = found as Mesh | null;
        if (!mesh) throw new Error("no mesh");
        const geometry = plainGeometry(mesh.geometry, mesh.matrixWorld);
        const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial;
        const map = material?.map ?? null;
        mesh.geometry.dispose();
        material?.dispose();
        if (map && edge > 0) await fitTexture(map, edge);
        return {geometry, map, triangles: triangles(geometry), facing};
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
                bodyLength: Math.max(bodyAxisExtent(slug, behaviour?.plan, {x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z}), 0.05),
                facing: level.facing ?? 0
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
                    this.loadGltf(this.url(slug, `${version}.far.glb`), this.fit?.far ?? 0),
                    fetch(this.url(slug, `${version}.ark.json`), {signal: this.abort.signal}).then((response) => (response.ok ? response.json() : null)).catch(() => null)
                ]);
                if (this.disposed) return disposeLevel(far);
                const behaviour = (json && typeof json === "object" ? (json as {behaviour?: TalkingBehaviour}).behaviour : null) ?? null;
                this.hand(() => {
                    if (far.map) this.upload?.(far.map);
                    this.remember(slug, behaviour, far).far = far;
                    this.count(slug, "far", far);
                    this.onLoad(slug);
                });
            } else {
                const near = await this.loadGltf(this.url(slug, `${version}.near.glb`), this.fit?.near ?? 0);
                if (this.disposed) return disposeLevel(near);
                this.hand(() => {
                    if (near.map) this.upload?.(near.map);
                    // Asked again after it was let go: the newest copy wins, the older one goes.
                    const model = this.remember(slug, this.models.get(slug)?.behaviour ?? null, near);
                    if (model.near && model.near !== near) disposeLevel(model.near);
                    model.near = near;
                    this.count(slug, "near", near);
                    this.onLoad(slug);
                });
            }
            return;
        }
        if (this.models.get(slug)) return;
        if (!this.manifest?.fallback?.[slug]) {
            this.placeholder(slug);
            return;
        }
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
        // A copy for the near level (each level's instances set their own attribute on the geometry).
        model.near = {...whole, geometry: merged.clone()};
        this.onLoad(slug);
    }

    /** A finished level: to the scene now, or (paced) when `drain` has time for it. */
    private hand(apply: () => void) {
        if (this.disposed) return;
        if (this.paced) this.staged.push(() => {
            if (!this.disposed) apply();
        });
        else apply();
    }

    private count(slug: string, level: Wanted, model: ModelLevel) {
        this.levelBytes.set(`${slug}\u0000${level}`, {geometry: geometryBytes(model.geometry), texture: model.map ? textureBytes(model.map) : 0});
    }

    /** The neutral figure for a species with no model (its own copy: each species has its own instances). */
    private placeholder(slug: string) {
        if (this.disposed) return;
        const geometry = placeholderGeometry();
        const level: ModelLevel = {geometry, map: null, triangles: triangles(geometry)};
        const known = this.models.get(slug);
        if (known) {
            known.far ??= level;
            known.near ??= {...level, geometry: geometry.clone()};
            this.onLoad(slug);
            return;
        }
        const model = this.remember(slug, null, level);
        model.placeholder = true;
        model.far = level;
        // Its own copy for the near level: each level's instances carry their own attribute on the geometry.
        model.near = {...level, geometry: geometry.clone()};
        this.onLoad(slug);
    }

    dispose() {
        this.disposed = true;
        this.abort.abort();
        this.staged.length = 0;
        this.levelBytes.clear();
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

/**
 * Fit a skin to `edge` pixels on its longest side before it reaches the GPU (runtime budgets): off the main thread
 * where the browser can resize an ImageBitmap, else through a canvas. Leaves it as it was if anything fails.
 */
async function fitTexture(map: Texture, edge: number): Promise<void> {
    const image = map.image as (ImageBitmap | HTMLImageElement | HTMLCanvasElement) & {close?: () => void} | undefined;
    const width = image?.width ?? 0;
    const height = image?.height ?? 0;
    if (!image || !width || !height) return;
    const size = fittedSize(width, height, edge);
    if (size.width === width && size.height === height) return;
    let next: ImageBitmap | HTMLCanvasElement | null = null;
    if (typeof createImageBitmap === "function") {
        try {
            next = await createImageBitmap(image, {resizeWidth: size.width, resizeHeight: size.height, resizeQuality: "high", premultiplyAlpha: "none", colorSpaceConversion: "none"});
        } catch {
            next = null;
        }
    }
    if (!next && typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const context = canvas.getContext("2d");
        if (context) {
            context.imageSmoothingQuality = "high";
            context.drawImage(image, 0, 0, size.width, size.height);
            next = canvas;
        }
    }
    if (!next) return;
    if (typeof image.close === "function") image.close();
    map.image = next;
    map.needsUpdate = true;
}
