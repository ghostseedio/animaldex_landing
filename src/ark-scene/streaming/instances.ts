/**
 * A static instanced mesh (the decor's plants, the forest fill, the grass) drawn by chunk (Part B,
 * docs/ark/streaming.md): its instances' matrices and per-instance attributes are kept as built, and the GPU buffer
 * holds only the instances in chunks drawn now, in their original order. A tier's share stays what it was: the
 * first `limit` instances (`setLimit`, the grass count and the forest fill's share are prefixes of the built list).
 *
 * When every chunk holding one of the first `limit` is drawn, the buffer is the built list's prefix, byte for byte:
 * the mesh is exactly what it was before chunking.
 */

import type {InstancedBufferAttribute, InstancedMesh} from "three";
import {chunkOf, type ChunkGrid} from "@/ark-scene/streaming/chunks";

type Kept = {attribute: InstancedBufferAttribute; source: Float32Array; size: number};

export class ChunkedInstances {
    /** Each instance's chunk, in the built order. */
    private readonly chunks: Uint16Array;
    private readonly matrices: Float32Array;
    private readonly kept: Kept[] = [];
    private limit: number;
    private drawn: ((chunk: number) => boolean) | null = null;
    /** The buffer holds the built prefix now (nothing compacted). */
    private identity = true;
    /** Called before the buffer is rewritten (the scene's folded trees put their matrices back first). */
    beforeWrite: ((mesh: InstancedMesh) => void) | null = null;
    /** Instances drawn after the last write. */
    shown: number;

    constructor(readonly mesh: InstancedMesh, grid: ChunkGrid, total: number, limit = total, attributeNames: string[] = []) {
        this.matrices = (mesh.instanceMatrix.array as Float32Array).slice(0, total * 16);
        this.chunks = new Uint16Array(total);
        for (let i = 0; i < total; i++) this.chunks[i] = chunkOf(grid, this.matrices[i * 16 + 12], this.matrices[i * 16 + 14]);
        const colour = mesh.instanceColor as InstancedBufferAttribute | null;
        if (colour) this.kept.push({attribute: colour, source: (colour.array as Float32Array).slice(0, total * 3), size: 3});
        for (const name of attributeNames) {
            const attribute = mesh.geometry.getAttribute(name) as InstancedBufferAttribute | undefined;
            if (!attribute) continue;
            this.kept.push({attribute, source: (attribute.array as Float32Array).slice(0, total * attribute.itemSize), size: attribute.itemSize});
        }
        this.limit = Math.min(limit, total);
        this.shown = this.limit;
    }

    get total(): number {
        return this.chunks.length;
    }

    /** The tier's share: the first `count` of the built list. */
    setLimit(count: number) {
        const next = Math.min(Math.max(Math.round(count), 0), this.total);
        if (next === this.limit) return;
        this.limit = next;
        this.write();
    }

    /** Which chunks are drawn (null: all). */
    setDrawn(drawn: ((chunk: number) => boolean) | null) {
        this.drawn = drawn;
        this.write();
    }

    /** Whether every chunk holding one of the first `limit` is drawn. */
    private allDrawn(): boolean {
        if (!this.drawn) return true;
        const seen = new Set<number>();
        for (let i = 0; i < this.limit; i++) {
            const chunk = this.chunks[i];
            if (seen.has(chunk)) continue;
            seen.add(chunk);
            if (!this.drawn(chunk)) return false;
        }
        return true;
    }

    private write() {
        const mesh = this.mesh;
        if (this.allDrawn()) {
            if (!this.identity) {
                this.beforeWrite?.(mesh);
                (mesh.instanceMatrix.array as Float32Array).set(this.matrices);
                for (const kept of this.kept) (kept.attribute.array as Float32Array).set(kept.source);
                this.flag(this.total);
                this.identity = true;
                // The bounds as built (over every instance), so culling is what it was.
                this.show(this.total);
                mesh.computeBoundingSphere();
            }
            this.show(this.limit);
            return;
        }
        this.beforeWrite?.(mesh);
        const matrix = mesh.instanceMatrix.array as Float32Array;
        let n = 0;
        for (let i = 0; i < this.limit; i++) {
            if (!this.drawn!(this.chunks[i])) continue;
            if (n !== i) {
                matrix.set(this.matrices.subarray(i * 16, i * 16 + 16), n * 16);
                for (const kept of this.kept) (kept.attribute.array as Float32Array).set(kept.source.subarray(i * kept.size, i * kept.size + kept.size), n * kept.size);
            } else if (!this.identity) {
                matrix.set(this.matrices.subarray(i * 16, i * 16 + 16), n * 16);
                for (const kept of this.kept) (kept.attribute.array as Float32Array).set(kept.source.subarray(i * kept.size, i * kept.size + kept.size), n * kept.size);
            }
            n++;
        }
        this.identity = false;
        this.flag(n);
        this.show(n);
        if (n > 0) mesh.computeBoundingSphere();
    }

    private show(count: number) {
        this.shown = count;
        this.mesh.count = count;
    }

    private flag(count: number) {
        const mesh = this.mesh;
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(0, Math.max(count, 1) * 16);
        mesh.instanceMatrix.needsUpdate = true;
        for (const kept of this.kept) {
            kept.attribute.clearUpdateRanges();
            kept.attribute.addUpdateRange(0, Math.max(count, 1) * kept.size);
            kept.attribute.needsUpdate = true;
        }
    }

    /** How many of the first `limit` stand in each chunk (for the streamer's content map). */
    perChunk(into: Uint32Array) {
        for (let i = 0; i < this.limit; i++) into[this.chunks[i]]++;
    }
}
