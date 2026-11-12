/**
 * The ground in tiles, one per chunk (Part B, docs/ark/streaming.md), cut from the ground's own arrays
 * (`terrain.ts` groundArrays): a tile is the ground's vertices inside its chunk (its edges shared with the next
 * tile's), with the same attributes, the same normals and the same triangles in the same order, so the tiled ground
 * draws what the single mesh drew. Each tile is its own mesh, so it is culled to the view on its own (the main pass
 * and the shadow pass), and the streamer draws it:
 *
 * - `in`: in full (every vertex);
 * - `map` (the map view, past the render distance): every 4th vertex, with a skirt down its edges so the coarser
 *   tiles never open a crack against their neighbours;
 * - `out`: not drawn; its geometry goes from the GPU after `RELEASE_SECONDS` hidden.
 */

import {BufferAttribute, BufferGeometry, Group, Mesh, type Material} from "three";
import {chunkCount, STATE_IN, STATE_MAP, STATE_OUT, tileRange, type ChunkGrid} from "@/ark-scene/streaming/chunks";
import type {GroundArrays} from "@/ark-scene/terrain";

/** The map's level: every this many vertices. */
export const MAP_STRIDE = 4;
/** A coarse tile's skirt hangs this far below its edge (m). */
const SKIRT_DEPTH = 3;
/** A hidden tile's geometry is let go after this long (s). */
export const RELEASE_SECONDS = 6;

const ATTRIBUTES: Array<{name: string; key: keyof GroundArrays; size: number}> = [
    {name: "position", key: "positions", size: 3},
    {name: "normal", key: "normals", size: 3},
    {name: "uv", key: "uvs", size: 2},
    {name: "arkRock", key: "rock", size: 3},
    {name: "color", key: "colors", size: 3},
    {name: "arkLayers", key: "layers", size: 4},
    {name: "arkLayers2", key: "layers2", size: 4},
    // (The v2 world only: the fresh water's surface over each vertex, for the ground shader's bed. Absent on v1.)
    {name: "arkFreshLevel", key: "freshBed", size: 1}
];

/** A tile's geometry at a stride (1: every vertex), from the ground's arrays. */
export function tileGeometry(arrays: GroundArrays, range: {col0: number; col1: number; row0: number; row1: number}, stride: number): BufferGeometry {
    const size = arrays.size;
    const columns: number[] = [];
    for (let c = range.col0; c < range.col1; c += stride) columns.push(c);
    columns.push(range.col1);
    const rows: number[] = [];
    for (let r = range.row0; r < range.row1; r += stride) rows.push(r);
    rows.push(range.row1);
    const across = columns.length;
    const down = rows.length;
    const grid = across * down;
    const skirt = stride > 1 ? 2 * (across + down) : 0;
    const count = grid + skirt;
    const geometry = new BufferGeometry();
    const out: Record<string, Float32Array> = {};
    const attributes = ATTRIBUTES.filter((attribute) => arrays[attribute.key] !== undefined);
    for (const attribute of attributes) out[attribute.name] = new Float32Array(count * attribute.size);
    let v = 0;
    const copy = (source: number, extraY = 0) => {
        for (const attribute of attributes) {
            const from = arrays[attribute.key] as Float32Array;
            const to = out[attribute.name];
            for (let k = 0; k < attribute.size; k++) to[v * attribute.size + k] = from[source * attribute.size + k];
        }
        if (extraY) out.position[v * 3 + 1] -= extraY;
        return v++;
    };
    for (const r of rows) for (const c of columns) copy(r * size + c);
    // The same two triangles per cell, in the same order and winding as the whole ground's index.
    const triangles = (across - 1) * (down - 1) * 2 + (skirt ? 2 * 2 * (2 * (across - 1) + 2 * (down - 1)) : 0);
    const index = count > 65535 ? new Uint32Array(triangles * 3) : new Uint16Array(triangles * 3);
    let k = 0;
    for (let row = 0; row < down - 1; row++) {
        for (let column = 0; column < across - 1; column++) {
            const a = column + across * row;
            const b = column + across * (row + 1);
            const c = column + 1 + across * (row + 1);
            const d = column + 1 + across * row;
            index[k++] = a;
            index[k++] = b;
            index[k++] = d;
            index[k++] = b;
            index[k++] = c;
            index[k++] = d;
        }
    }
    if (skirt) {
        // Each edge's vertices again, lowered; quads both ways round (the skirt is seen from either side).
        const edge = (list: number[]) => {
            const lowered = list.map((top) => {
                const r = rows[Math.floor(top / across)];
                const c = columns[top % across];
                return copy(r * size + c, SKIRT_DEPTH);
            });
            for (let i = 0; i < list.length - 1; i++) {
                const a = list[i];
                const b = list[i + 1];
                const c = lowered[i + 1];
                const d = lowered[i];
                index[k++] = a;
                index[k++] = d;
                index[k++] = b;
                index[k++] = b;
                index[k++] = d;
                index[k++] = c;
                index[k++] = a;
                index[k++] = b;
                index[k++] = d;
                index[k++] = b;
                index[k++] = c;
                index[k++] = d;
            }
        };
        edge(Array.from({length: across}, (_, i) => i));
        edge(Array.from({length: across}, (_, i) => (down - 1) * across + i));
        edge(Array.from({length: down}, (_, i) => i * across));
        edge(Array.from({length: down}, (_, i) => i * across + across - 1));
    }
    geometry.setIndex(new BufferAttribute(index.subarray(0, k), 1));
    for (const attribute of attributes) geometry.setAttribute(attribute.name, new BufferAttribute(out[attribute.name], attribute.size));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}

/** A released tile's stand-in (nothing to draw, nothing held). */
const EMPTY = new BufferGeometry();

type Tile = {key: number; mesh: Mesh; full: BufferGeometry | null; coarse: BufferGeometry | null; state: number; changedAt: number};

export class GroundTiles {
    readonly group = new Group();
    private readonly tiles: Tile[] = [];

    constructor(private readonly arrays: GroundArrays, private readonly grid: ChunkGrid, private readonly material: Material, groundSegments: number) {
        this.group.name = "ark-ground";
        for (let key = 0; key < chunkCount(grid); key++) {
            const range = tileRange(grid, key, groundSegments);
            if (range.col1 <= range.col0 || range.row1 <= range.row0) continue;
            const full = tileGeometry(arrays, range, 1);
            const mesh = new Mesh(full, material);
            mesh.name = `ark-ground-${key}`;
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            mesh.userData.chunk = key;
            this.group.add(mesh);
            this.tiles.push({key, mesh, full, coarse: null, state: STATE_IN, changedAt: 0});
        }
    }

    /** The streamer's states: a tile drawn in full, as the map, or not; hidden ones let go after a while. */
    apply(states: ArrayLike<number>, now: number) {
        for (const tile of this.tiles) {
            const state = states[tile.key] ?? STATE_IN;
            if (state === tile.state) continue;
            tile.state = state;
            tile.changedAt = now;
            if (state === STATE_OUT) {
                tile.mesh.visible = false;
                continue;
            }
            tile.mesh.visible = true;
            const range = tileRange(this.grid, tile.key, this.arrays.size - 1);
            if (state === STATE_MAP) {
                tile.coarse ??= tileGeometry(this.arrays, range, MAP_STRIDE);
                tile.mesh.geometry = tile.coarse;
            } else {
                tile.full ??= tileGeometry(this.arrays, range, 1);
                tile.mesh.geometry = tile.full;
            }
        }
    }

    /** Let go of a level not drawn for `RELEASE_SECONDS` (a few times a second is plenty). */
    release(now: number) {
        for (const tile of this.tiles) {
            if (now - tile.changedAt <= RELEASE_SECONDS) continue;
            if (tile.state !== STATE_IN && tile.full) {
                if (tile.mesh.geometry === tile.full) tile.mesh.geometry = EMPTY;
                tile.full.dispose();
                tile.full = null;
            }
            if (tile.state !== STATE_MAP && tile.coarse) {
                if (tile.mesh.geometry === tile.coarse) tile.mesh.geometry = EMPTY;
                tile.coarse.dispose();
                tile.coarse = null;
            }
        }
    }

    /** Tiles drawn now, by level, and their geometry's bytes. */
    stats(): {full: number; map: number; hidden: number} {
        let full = 0;
        let map = 0;
        let hidden = 0;
        for (const tile of this.tiles) {
            if (tile.state === STATE_OUT) hidden++;
            else if (tile.state === STATE_MAP) map++;
            else full++;
        }
        return {full, map, hidden};
    }

    dispose() {
        for (const tile of this.tiles) {
            tile.full?.dispose();
            tile.coarse?.dispose();
        }
        this.tiles.length = 0;
    }
}
