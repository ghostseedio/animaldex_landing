/**
 * The town's chunk layers in a few draw calls (town performance lane, docs/ark/perf-audit-mobile-2026-11.md §7.1 and
 * docs/ark/town-draws-2026-11.md).
 *
 * Every chunk used to draw its ground, paving, buildings, foliage, glass and window panes as meshes of its own: about
 * 220 draw calls with the whole town in view, each paying three's per-object work (~30 µs a call on the low phone
 * profile). Here each layer of a band of chunks is one `BatchedMesh` holding every chunk's geometry once (the same
 * arrays, copied in, not duplicated), one instance a chunk:
 *
 * - **the same picture**: three's own per-object culling (each chunk's bounding sphere against the frustum, the shadow
 *   camera's too) and opaque front-to-back order, but per chunk inside one multi-draw; the same material, its shader
 *   patches and program key chained (`batchedVariant`), with the batching transform replaced by the identity: every
 *   chunk is already in the town's frame, so no per-vertex texture reads are added and the batching textures are never
 *   bound or uploaded;
 * - **streaming and the near detail unchanged**: a chunk the streamer does not draw is an invisible instance; the near
 *   detail stays in the chunk's own group;
 * - **no extra memory**: the band's arrays are exactly its chunks' (16-bit indices for the ground: a band of 27 tiles is
 *   64,827 vertices), the chunks' own copies let go once batched;
 * - **uploads spread**: a band's layer is uploaded the first frame it is drawn (≤ ~3.6 MB); while the town joins, the
 *   batches are let in one at a time (`TownBatch.enabled`), never all in one frame (decision 153).
 */

import {BatchedMesh, BufferGeometry, Material, type BufferAttribute, MeshDepthMaterial, RGBADepthPacking, type BackSide, type FrontSide, type WebGLProgramParametersWithUniforms, type WebGLRenderer} from "three";
import {TOWN_CHUNK_COUNT, TOWN_GRID} from "@/ark-scene/islands/town/chunks";

/** Rows of chunks a band holds (3 bands of 27 chunks: each band's ground fits 16-bit indices). */
export const TOWN_BAND_ROWS = 3;
export const TOWN_BANDS = Math.ceil(TOWN_GRID.rows / TOWN_BAND_ROWS);

/** The band a chunk is in. */
export function townBandOf(chunk: number): number {
    return Math.floor(Math.floor(chunk / TOWN_GRID.columns) / TOWN_BAND_ROWS);
}

/** The first chunk of a band (chunks are numbered row by row, as the join reveals them). */
export function townBandStart(band: number): number {
    return band * TOWN_BAND_ROWS * TOWN_GRID.columns;
}

/** The batching transform as the identity: what `#include <batching_vertex>` declares, without its texture reads. */
const IDENTITY = "#ifdef USE_BATCHING\n\tmat4 batchingMatrix = mat4( 1.0 );\n#endif";

function identityBatching(shader: WebGLProgramParametersWithUniforms) {
    shader.vertexShader = shader.vertexShader.replace("#include <batching_vertex>", IDENTITY);
}

const variants = new WeakMap<Material, Material>();

/**
 * The material for a batch of the town's chunks: a copy of `material` (its own program, so the material's other users,
 * the near detail and the clock hands, never switch programs with it), its shader patches and program key chained, the
 * batching transform the identity. One per material.
 */
export function batchedVariant<T extends Material>(material: T): T {
    const found = variants.get(material);
    if (found) return found as T;
    const copy = material.clone() as T;
    const compile = material.onBeforeCompile;
    copy.onBeforeCompile = (shader, renderer) => {
        compile.call(material, shader, renderer);
        identityBatching(shader);
    };
    // (`customProgramCacheKey` is the material's own, or by default its `onBeforeCompile` as text.)
    copy.customProgramCacheKey = () => `${material.customProgramCacheKey()}|town-batch-identity`;
    variants.set(material, copy);
    return copy;
}

/**
 * A one-sided copy of a two-sided transparent material (its patches and key kept): its back faces' batch drawn, then its
 * front faces', as three's two passes and `runtime/two-sided.ts` draw such a mesh, with no program look-ups between.
 */
export function sidedCopy<T extends Material>(material: T, side: typeof BackSide | typeof FrontSide): T {
    const copy = material.clone() as T;
    copy.onBeforeCompile = material.onBeforeCompile;
    copy.customProgramCacheKey = material.customProgramCacheKey;
    copy.side = side;
    return copy;
}

/**
 * A copy of `material` for plain meshes (the same patches and program key, so the same program), made when called:
 * three draws opaque materials in the order they were made. The near detail's, made right after the solids' batch
 * material, so its trim is drawn after the walls it lies on (and before the glass and panes, as when they shared one).
 */
export function plainCopy<T extends Material>(material: T): T {
    const copy = material.clone() as T;
    copy.onBeforeCompile = material.onBeforeCompile;
    copy.customProgramCacheKey = material.customProgramCacheKey;
    return copy;
}

/** Lets a material's batch copy go (the town's dispose). */
export function disposeBatchedVariant(material: Material) {
    const found = variants.get(material);
    if (!found) return;
    found.dispose();
    variants.delete(material);
}

let depthMaterial: MeshDepthMaterial | null = null;

/**
 * The batches' shadow depth (three's own `MeshDepthMaterial` with RGBA packing, as its shadow map uses), the batching
 * transform the identity: the casters' batches keep a depth program of their own, never switching three's shared one.
 */
export function batchedDepthMaterial(): MeshDepthMaterial {
    if (!depthMaterial) {
        depthMaterial = new MeshDepthMaterial({depthPacking: RGBADepthPacking});
        depthMaterial.onBeforeCompile = identityBatching;
        depthMaterial.customProgramCacheKey = () => "town-batch-depth-identity";
    }
    return depthMaterial;
}

export type TownBatchPart = {chunk: number; geometry: BufferGeometry};

/** One band's layer: a BatchedMesh with one instance a chunk. */
export class TownBatch {
    readonly mesh: BatchedMesh;
    /** Its chunks, in instance order, and each one's first vertex in the batch. */
    readonly chunks: number[] = [];
    readonly vertexStart: number[] = [];
    readonly triangles: number;
    /** Let in to be drawn (the join lets the batches in one at a time); true once the town is whole. */
    enabled = true;
    private readonly instanceOf = new Map<number, number>();
    private shown = 0;

    /**
     * `parts`: each chunk's geometry for this layer (the same attributes in each; the ground's indexed). Their arrays are
     * copied in and may be let go after. `release`: the batch's own arrays let go once on the GPU (nothing reads them).
     */
    constructor(parts: readonly TownBatchPart[], material: Material, name: string, options: {castShadow: boolean; receiveShadow: boolean; release?: boolean}) {
        let vertices = 0;
        let indices = 0;
        let triangles = 0;
        for (const part of parts) {
            vertices += part.geometry.getAttribute("position").count;
            const index = part.geometry.getIndex();
            indices += index ? index.count : 0;
            triangles += (index ? index.count : part.geometry.getAttribute("position").count) / 3;
        }
        this.triangles = triangles;
        this.mesh = new BatchedMesh(Math.max(parts.length, 1), Math.max(vertices, 1), Math.max(indices, 1), batchedVariant(material));
        this.mesh.name = name;
        // three r170 asks a batch for `colorTexture` (which no batch has: its colours' texture is `_colorsTexture`) when
        // it decides whether a material needs another program, takes the answer `undefined` for "has colours now", and
        // looks the program up again on every draw of every batch: its parameters gathered, its cache key built (about
        // thirty times a frame with the town in view; 4.5% of the phone profile's main thread at the island view;
        // graphics and performance pass, 2026-11). The name it asks for, answering as it means.
        Object.defineProperty(this.mesh, "colorTexture", {configurable: true, get(this: BatchedMesh) {
            return (this as unknown as {_colorsTexture: unknown})._colorsTexture ?? null;
        }});
        this.mesh.castShadow = options.castShadow;
        this.mesh.receiveShadow = options.receiveShadow;
        this.mesh.customDepthMaterial = batchedDepthMaterial();
        // (Its chunks by instance, for probes and tests.)
        this.mesh.userData.chunks = this.chunks;
        let start = 0;
        for (const part of parts) {
            // (Each chunk's bounds come with it, so nothing reads the batch's arrays back to cull.)
            if (!part.geometry.boundingSphere) part.geometry.computeBoundingSphere();
            if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
            const geometryId = this.mesh.addGeometry(part.geometry);
            const instance = this.mesh.addInstance(geometryId);
            this.instanceOf.set(part.chunk, instance);
            this.chunks.push(part.chunk);
            this.vertexStart.push(start);
            start += part.geometry.getAttribute("position").count;
        }
        this.shown = parts.length;
        // (The first upload is the whole array anyway: no per-chunk ranges left over for the first later update.)
        const geometry = this.mesh.geometry;
        for (const attributeName of Object.keys(geometry.attributes)) (geometry.attributes[attributeName] as BufferAttribute).clearUpdateRanges();
        geometry.index?.clearUpdateRanges();
        // (The batch's bounds now, from its chunks' own: never read from its arrays later.)
        this.mesh.computeBoundingSphere();
        this.mesh.computeBoundingBox();
        if (options.release) {
            for (const attributeName of Object.keys(geometry.attributes)) (geometry.attributes[attributeName] as BufferAttribute).onUpload(releaseArray);
            geometry.index?.onUpload(releaseArray);
        }
    }

    /** Draws `other`'s geometry (the same parts, in the same order): one copy of the arrays, uploaded once for both. */
    shareGeometry(other: TownBatch) {
        if (other.mesh.geometry === this.mesh.geometry) return;
        this.mesh.geometry.dispose();
        this.mesh.geometry = other.mesh.geometry;
    }

    /** The chunk's instance in this batch (−1: not in it). */
    instance(chunk: number): number {
        return this.instanceOf.get(chunk) ?? -1;
    }

    /** Which chunks are drawn (null: all); hidden whole while not let in or with none of its chunks drawn. */
    setDrawn(drawn: ((chunk: number) => boolean) | null) {
        let shown = 0;
        this.chunks.forEach((chunk, i) => {
            const on = !drawn || drawn(chunk);
            this.mesh.setVisibleAt(i, on);
            if (on) shown++;
        });
        this.shown = shown;
        this.mesh.visible = this.enabled && shown > 0;
    }

    /** Chunks drawn now. */
    get drawnChunks(): number {
        return this.mesh.visible ? this.shown : 0;
    }

    /** The first frame the batch is drawn uploads it: `onBeforeRender` chained after the batch's own. */
    chainBeforeRender(hook: (renderer: WebGLRenderer) => void) {
        const own = this.mesh.onBeforeRender;
        this.mesh.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
            hook(renderer);
            own.call(this, renderer, scene, camera, geometry, material, group);
        };
    }

    dispose() {
        this.mesh.parent?.remove(this.mesh);
        this.mesh.dispose();
    }
}

/** The chunk's geometry offered to a band's layer, gathered until the band is complete (`TownBatches.flush`). */
export class TownBandParts {
    private readonly parts = new Map<string, TownBatchPart[]>();

    add(layer: string, chunk: number, geometry: BufferGeometry) {
        const list = this.parts.get(layer) ?? [];
        list.push({chunk, geometry});
        this.parts.set(layer, list);
    }

    take(layer: string): TownBatchPart[] {
        const list = this.parts.get(layer) ?? [];
        this.parts.delete(layer);
        return list;
    }

    get size(): number {
        return this.parts.size;
    }
}

/**
 * While the town joins (decision 153: its chunks shown three a frame), which batches are let in: the band's layers one
 * reveal step apart, from the band's first step on, so at most one batch's first upload falls in any frame. `revealed`:
 * the chunks shown so far (all: everything let in).
 */
export function townBatchEnabled(band: number, layerOrder: number, revealed: number, perStep = 3): boolean {
    if (revealed >= TOWN_CHUNK_COUNT) return true;
    return revealed >= townBandStart(band) + perStep * (layerOrder + 1);
}

/** `BufferAttribute.onUpload`: drop the CPU copy once the GPU has it (three's own pattern for static geometry). */
function releaseArray(this: {array: ArrayLike<number>}) {
    this.array = new Float32Array(0);
}
