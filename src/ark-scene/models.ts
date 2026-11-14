/**
 * The "ark" model set (contract section 3): per species a `near.glb`
 * (~3,000 triangles) and a `far.glb` (~600), meshopt-compressed with
 * quantised attributes and a 512² WebP skin, and an `ark.json` with the
 * extent and the talking model's `behaviour`. Read with three's GLTFLoader
 * and MeshoptDecoder.
 *
 * `<base>/manifest.json` → `{models: {slug: version}}`, files at
 * `<base>/<slug>/<version>.near.glb | .far.glb | .ark.json`. A species not
 * in it, or whose files are not there or are not a model, is drawn as the
 * neutral placeholder figure (`placeholder.ts`, owner decision A13): never a
 * broken model.
 *
 * A file that only failed to arrive (the network, a busy bucket) is never
 * answered with the placeholder: it is asked for again after a wait that
 * grows, as long as the scene still wants it, and until then the animal is
 * drawn as it was (its icon, or its far model). The manifest likewise: read
 * again until it is in, the animals their icons meanwhile, not one clay
 * figure for every species for the rest of the visit.
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
import {parseArkPack, type ArkPack} from "@/ark-scene/streaming/pack";
import {arkExtent, finalStatus, ModelFileError, retrySeconds, worthAskingAgain} from "@/ark-scene/model-files";

/** One file of a tier's far-model pack: its path beside the manifest and the kinds in it. */
export type ArkPackPart = {file: string; kinds: string[]};

export type ArkManifest = {
    models: Record<string, string>;
    /** Development only: species served from the full talking model instead. */
    fallback?: Record<string, string>;
    /**
     * Part B (docs/ark/streaming.md §6): the far-model pack per tier (`streaming/pack.ts`): its file (beside the
     * manifest) and the kinds in it. A kind in the pack at the manifest's version loads from it; anything else as before.
     */
    packs?: Record<string, ArkPackPart | ArkPackPart[]>;
    /** Part B: the far files carry their `ark.json` inside (`<version>.far-ark.glb`, `extras.ark`): one request a model. */
    far_ark?: boolean;
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
    /** Levels that failed to arrive: how many times in a row, and when they may be asked for again (`performance.now()`). */
    private readonly retries = new Map<string, {count: number; until: number}>();
    /** Levels whose file is not there or is not a model (never asked for again). */
    private readonly lost = new Set<string>();
    /** A near level that arrived before its far one: handed over right after it (the far file carries the body plan and the size). */
    private readonly parked = new Map<string, {level: ModelLevel; apply: () => void}>();
    /** Called whenever a level finishes loading. */
    onLoad: (slug: string) => void = () => undefined;
    /**
     * The species the reader asked to see (selected and flown to): its levels load before everything else in the queue,
     * past the gate and past the files already loading, so its model is in by the time the camera arrives.
     */
    urgent: string | null = null;
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
    /** How many at the head of `staged` are the chosen species' (handed over first, in their own order). */
    private urgentStaged = 0;
    /** GPU bytes per loaded level (`runtime/memory.ts`'s estimate). */
    private readonly levelBytes = new Map<string, {geometry: number; texture: number; at: number}>();
    /** Part B: the tier whose far-model pack the starting view reads (set once, before the first far model is asked for). */
    private packTierName: string | null = null;
    /** The pack's parts (the starting view's first kinds, then the rest), fetched one after another; by kind. */
    private packParts: Map<string, Promise<ArkPack | null>> | null = null;
    /** Network requests made (the manifest, the pack, every model file): the measurement page reads it. */
    requests = 0;
    /** Kinds whose far model came from the pack, and from single files. */
    packHits = 0;
    fileHits = 0;
    /** The far models in the order first asked for (the first 600): the pack builder's list of the starting view's kinds. */
    readonly farOrder: string[] = [];

    constructor(private readonly base: string, private concurrency = 3) {
        this.loader = new GLTFLoader();
        this.loader.setMeshoptDecoder(MeshoptDecoder);
        this.manifestReady = this.readManifest();
    }

    /**
     * The manifest, read until it is in. A read that fails (the network, the bucket) is tried again after a wait that
     * grows: an empty manifest would draw every species as the placeholder figure for the whole visit, where a moment
     * later the models are there. Until it is in nothing is drawn as a model (the animals are their icons).
     */
    private async readManifest(): Promise<ArkManifest | null> {
        for (let failures = 0; !this.disposed; ) {
            this.requests++;
            try {
                const response = await fetch(`${this.base.replace(/\/+$/, "")}/manifest.json`, {signal: this.abort.signal});
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const raw: unknown = await response.json();
                const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
                if (!row?.models || typeof row.models !== "object") throw new Error("no models");
                const models = row.models as Record<string, string>;
                const fallback = row.fallback && typeof row.fallback === "object" ? row.fallback as Record<string, string> : undefined;
                const packs = row.packs && typeof row.packs === "object" ? row.packs as ArkManifest["packs"] : undefined;
                this.manifest = {models, fallback, packs, far_ark: row.far_ark === true};
                this.startPack();
                this.pump();
                return this.manifest;
            } catch (error) {
                if (this.disposed) return null;
                failures++;
                console.warn("[ark] model manifest", error instanceof Error ? error.message : error, `(asked again in ${retrySeconds(failures)} s)`);
                await new Promise((resolve) => setTimeout(resolve, retrySeconds(failures) * 1000));
            }
        }
        return null;
    }

    ready(): Promise<ArkManifest | null> {
        return this.manifestReady;
    }

    /**
     * Part B: the tier whose far-model pack to read (the first one set wins: a tier dropped later reads the single files
     * for what the pack did not hold, as before). Fetched as soon as the manifest is in.
     */
    set packTier(tier: string | null) {
        if (this.packTierName || !tier) return;
        this.packTierName = tier;
        this.startPack();
    }

    get packTier(): string | null {
        return this.packTierName;
    }

    private startPack() {
        if (this.packParts || !this.manifest || !this.packTierName) return;
        const entry = this.manifest.packs?.[this.packTierName];
        const parts = (Array.isArray(entry) ? entry : entry ? [entry] : []).filter((part) => part?.file && Array.isArray(part.kinds));
        if (!parts.length) return;
        this.packParts = new Map();
        // In order, each after the one before: the first part (the kinds the starting view asks for first) has the
        // connection to itself.
        let before: Promise<unknown> = Promise.resolve();
        for (const part of parts) {
            const fetched: Promise<ArkPack | null> = before.then(() => {
                if (this.disposed) return null;
                this.requests++;
                return fetch(`${this.base.replace(/\/+$/, "")}/${part.file}`, {signal: this.abort.signal})
                    .then((response) => (response.ok ? response.arrayBuffer() : null))
                    .then((buffer) => (buffer ? parseArkPack(buffer) : null))
                    .catch((error) => {
                        if (!this.disposed) console.warn("[ark] pack", error instanceof Error ? error.message : error);
                        return null;
                    });
            });
            before = fetched;
            for (const slug of part.kinds) if (!this.packParts.has(slug)) this.packParts.set(slug, fetched);
        }
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
            // (A near level waiting for this far one goes with it: asked for again, far first, when it is wanted.)
            if (item.level === "far") this.unpark(item.slug);
            dropped++;
        }
        return dropped;
    }

    /** Let go of a near level waiting for its far one (the far one is no longer on its way). */
    private unpark(slug: string) {
        const waiting = this.parked.get(slug);
        if (!waiting) return;
        this.parked.delete(slug);
        disposeLevel(waiting.level);
        this.requested.get(slug)?.delete("near");
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
            this.urgentStaged = Math.max(this.urgentStaged - 1, 0);
            this.staged.shift()!();
            ran();
        }
    }

    /** Every loaded level's GPU bytes, for the budget (`runtime/budgets.ts`), and when it came in (s, `performance.now()`). */
    levels(): Array<{slug: string; level: Wanted; geometry: number; texture: number; at: number}> {
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
        // (With no far file of its own the near mesh is drawn at every distance, sharing its skin: it stays.)
        if (this.lost.has(`${slug}\u0000far`)) return false;
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
        // (One that failed to arrive waits its turn before it is asked for again.)
        const failed = this.retries.get(`${slug}\u0000${level}`);
        if (failed && performance.now() < failed.until) return;
        if (this.gate && slug !== this.urgent && !this.gate(slug, level)) return;
        asked.add(level);
        if (level === "far" && this.farOrder.length < 600) this.farOrder.push(slug);
        this.requested.set(slug, asked);
        this.queue.push({slug, level});
        this.pump();
    }

    private pump() {
        if (!this.manifest || this.disposed) return;
        while (this.queue.length) {
            // The one the reader asked to see first (its far level, then its near one), past the files already loading
            // (two more at once at most); then the runtime's order (nearest in view first), else the order asked; ties
            // keep the order asked.
            let pick = -1;
            const urgent = this.urgent;
            if (urgent !== null) {
                pick = this.queue.findIndex((item) => item.slug === urgent && item.level === "far");
                if (pick < 0) pick = this.queue.findIndex((item) => item.slug === urgent);
            }
            if (pick < 0 ? this.active >= this.concurrency : this.active >= this.concurrency + 2) break;
            if (pick < 0) {
                pick = 0;
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
            }
            const next = this.queue.splice(pick, 1)[0];
            if (!this.has(next.slug)) continue;
            this.active++;
            this.load(next.slug, next.level)
                .then(() => {
                    this.retries.delete(`${next.slug}\u0000${next.level}`);
                })
                .catch((error) => {
                    if (!this.disposed) this.failed(next.slug, next.level, error);
                })
                .finally(() => {
                    this.active--;
                    this.pump();
                });
        }
    }

    /**
     * A level that did not load. One that only failed to arrive (the network, the bucket busy) is asked for again when
     * the scene next wants it, after a wait that grows (`retrySeconds`): until then the animal is drawn as it was (its
     * icon, or its far model), never as the placeholder. One whose file is not there or is not a model is not asked for
     * again: the other level stands in for it, and only a species with neither is the placeholder figure (A13).
     */
    private failed(slug: string, level: Wanted, error: unknown) {
        const key = `${slug}\u0000${level}`;
        const final = !worthAskingAgain(error);
        console.warn(`[ark] ${slug} ${level}`, error instanceof Error ? error.message : error, final ? "" : "(asked again later)");
        if (!final) {
            const count = (this.retries.get(key)?.count ?? 0) + 1;
            this.retries.set(key, {count, until: performance.now() + retrySeconds(count) * 1000});
            this.requested.get(slug)?.delete(level);
            if (level === "far") this.unpark(slug);
            return;
        }
        this.lost.add(key);
        const model = this.models.get(slug);
        if (level === "near") {
            // (Its far level stands in close up; with no far level either, nothing of it can be drawn.)
            if (!model?.far && this.lost.has(`${slug}\u0000far`)) this.placeholder(slug);
            return;
        }
        const waiting = this.parked.get(slug);
        if (waiting) {
            // Its near level is in hand: drawn from that at every distance.
            this.parked.delete(slug);
            waiting.apply();
        } else if (model?.near) this.standIn(model);
        else if (this.lost.has(`${slug}\u0000near`)) this.placeholder(slug);
        else this.request(slug, "near");
    }

    /** No far file: the near mesh at every distance (its own copy: each level's instances carry their own attributes). */
    private standIn(model: SpeciesModel) {
        if (model.far || !model.near) return;
        model.far = {...model.near, geometry: model.near.geometry.clone()};
        this.onLoad(model.slug);
    }

    private url(slug: string, file: string): string {
        return `${this.base.replace(/\/+$/, "")}/${encodeURIComponent(slug)}/${file}`;
    }

    private async loadGltf(url: string, edge = 0): Promise<ModelLevel & {ark?: unknown}> {
        this.requests++;
        // (Fetched here, not by the loader: an answer that says the file is not there is told from one that never came.)
        const response = await fetch(url, {signal: this.abort.signal});
        if (!response.ok) throw new ModelFileError(`HTTP ${response.status}`, finalStatus(response.status));
        const buffer = await response.arrayBuffer();
        try {
            const gltf = await this.loader.parseAsync(buffer, "");
            return await this.levelFrom(gltf as unknown as {scene: import("three").Group; userData?: Record<string, unknown>}, edge);
        } catch (error) {
            throw new ModelFileError(error instanceof Error ? error.message : String(error), true);
        }
    }

    /** A species' `ark.json`; null when the bucket has none or it does not parse. Throws when it only failed to arrive. */
    private async readArkJson(url: string): Promise<unknown> {
        const response = await fetch(url, {signal: this.abort.signal});
        if (!response.ok) {
            if (finalStatus(response.status)) return null;
            throw new ModelFileError(`ark.json HTTP ${response.status}`, false);
        }
        const text = await response.text();
        try {
            return JSON.parse(text) as unknown;
        } catch {
            return null;
        }
    }

    /** A level from a parsed glTF (a file, or a pack's entry); `ark` is the file's own `ark.json` when it carries one. */
    private async levelFrom(gltf: {scene: import("three").Group; userData?: Record<string, unknown>}, edge: number): Promise<ModelLevel & {ark?: unknown}> {
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
        return {geometry, map, triangles: triangles(geometry), facing, ark: gltf.userData?.ark};
    }

    /** Part B: a kind's far model from the pack, or null (not in it, another version, or the pack failed). */
    private async fromPack(slug: string, version: string, edge: number): Promise<(ModelLevel & {ark?: unknown}) | null> {
        const part = this.packParts?.get(slug);
        if (!part) return null;
        const pack = await part;
        const glb = pack?.glb(slug, version);
        if (!glb) return null;
        const gltf = await this.loader.parseAsync(glb, "");
        return this.levelFrom(gltf as unknown as {scene: import("three").Group; userData?: Record<string, unknown>}, edge);
    }

    /**
     * `extent`: the model's own size from its `ark.json` (`arkExtent`), the same whichever level is in hand. Without
     * it the size is measured on that level's mesh, and the far mesh has lost its thin parts (an insect's legs and
     * feelers, a butterfly's tails): measured on it (the far level nearly always lands first), 57 of the 951 species
     * aboard were drawn more than 10% too large at both levels, a daddy-long-legs 1.6 times, and true to size only on
     * the visits where the near file happened to land first (2026-11-14).
     */
    private remember(slug: string, behaviour: TalkingBehaviour | null, level: ModelLevel, extent: {x: number; y: number; z: number} | null = null): SpeciesModel {
        let model = this.models.get(slug);
        if (!model) {
            const box = level.geometry.boundingBox!;
            const size = extent ?? {x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z};
            model = {
                slug,
                near: null,
                far: null,
                behaviour,
                minY: box.min.y,
                height: size.y,
                length: Math.max(size.z, 0.05),
                bodyLength: Math.max(bodyAxisExtent(slug, behaviour?.plan, size), 0.05),
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
                // Part B: from the starting view's pack; else one file with its ark.json inside; else the two files.
                const edge = this.fit?.far ?? 0;
                let far = await this.fromPack(slug, version, edge);
                let json: unknown = far?.ark ?? null;
                if (far) this.packHits++;
                else {
                    this.fileHits++;
                    if (this.manifest?.far_ark) {
                        far = await this.loadGltf(this.url(slug, `${version}.far-ark.glb`), edge);
                        json = far.ark ?? null;
                    } else {
                        this.requests++;
                        // (Both or neither: an `ark.json` that only failed to arrive fails the level, which is asked for
                        // again; taken as "none", the species had no body plan and no size of its own for the whole visit.)
                        const [level, file] = await Promise.all([
                            this.loadGltf(this.url(slug, `${version}.far.glb`), edge).then((value) => ({value, error: null}), (error: unknown) => ({value: null, error})),
                            this.readArkJson(this.url(slug, `${version}.ark.json`)).then((value) => ({value, error: null}), (error: unknown) => ({value: null, error}))
                        ]);
                        if (!level.value || file.error) {
                            if (level.value) disposeLevel(level.value);
                            throw level.error ?? file.error;
                        }
                        far = level.value;
                        json = file.value;
                    }
                }
                const loaded: ModelLevel = far;
                if (this.disposed) return disposeLevel(loaded);
                const behaviour = (json && typeof json === "object" ? (json as {behaviour?: TalkingBehaviour}).behaviour : null) ?? null;
                const extent = arkExtent(json);
                this.hand(() => {
                    const far = loaded;
                    if (far.map) this.upload?.(far.map);
                    this.remember(slug, behaviour, far, extent).far = far;
                    this.count(slug, "far", far);
                    this.onLoad(slug);
                    // Its near level, in before it: now.
                    const waiting = this.parked.get(slug);
                    if (waiting) {
                        this.parked.delete(slug);
                        waiting.apply();
                    }
                }, slug);
            } else {
                const near = await this.loadGltf(this.url(slug, `${version}.near.glb`), this.fit?.near ?? 0);
                if (this.disposed) return disposeLevel(near);
                const apply = () => {
                    if (near.map) this.upload?.(near.map);
                    // Asked again after it was let go: the newest copy wins, the older one goes.
                    const model = this.remember(slug, this.models.get(slug)?.behaviour ?? null, near);
                    if (model.near && model.near !== near) disposeLevel(model.near);
                    model.near = near;
                    this.count(slug, "near", near);
                    // (No far file: this mesh at every distance.)
                    if (!model.far && this.lost.has(`${slug}\u0000far`)) this.standIn(model);
                    this.onLoad(slug);
                };
                // The far level first, always: its file carries the species' body plan and the model's size (`ark.json`),
                // which the scene reads when it first draws the species. A near level that arrives before it (the two load
                // side by side, and the far one is two files) waits for it; before, the species then had no body plan for
                // the whole visit (no plan's motion, its size measured along the wrong axis).
                if (this.models.get(slug)?.far || this.lost.has(`${slug}\u0000far`)) this.hand(apply, slug);
                else if (!this.requested.get(slug)?.has("far")) {
                    // (Its far level is no longer on its way, dropped from the queue while this loaded: not kept waiting
                    // for it, unseen and outside the budget; asked for again, far first, when it is wanted.)
                    disposeLevel(near);
                    this.requested.get(slug)?.delete("near");
                } else {
                    const older = this.parked.get(slug);
                    if (older) disposeLevel(older.level);
                    this.parked.set(slug, {level: near, apply: () => this.hand(apply, slug)});
                }
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

    /**
     * A finished level: to the scene now, or (paced) when `drain` has time for it, in the order they finished; the
     * chosen species' (`urgent`) ahead of the others waiting (on a slow phone a few are handed over a frame, and the
     * one the reader flew to waited its turn behind the whole opening view's).
     */
    private hand(apply: () => void, slug?: string) {
        if (this.disposed) return;
        if (!this.paced) {
            apply();
            return;
        }
        const staged = () => {
            if (!this.disposed) apply();
        };
        if (slug !== undefined && slug === this.urgent) this.staged.splice(this.urgentStaged++, 0, staged);
        else this.staged.push(staged);
    }

    private count(slug: string, level: Wanted, model: ModelLevel) {
        this.levelBytes.set(`${slug}\u0000${level}`, {geometry: geometryBytes(model.geometry), texture: model.map ? textureBytes(model.map) : 0, at: performance.now() / 1000});
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
        this.urgentStaged = 0;
        this.levelBytes.clear();
        this.parked.forEach((waiting) => disposeLevel(waiting.level));
        this.parked.clear();
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
