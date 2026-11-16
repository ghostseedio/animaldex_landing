/**
 * The zoo's rocks as instances (p3, lane ZOOFIX: the phone's heap). Pass 2's habitats (rockwork, kopjes, ledges, the
 * waterholes' rim stones, the halls' backdrops) put ~520 boulders of 320 faces each into the zoo's merged meshes: 167,000
 * of its 280,000 triangles, every one copied out per vertex (position, normal, colour) in the worker's arrays, the
 * page's batches and the GPU's buffers, and the steady heap rose ~75 MB. Each boulder is the kit's own (`kit.ts` rock: the
 * wild island's fractured boulder, `rock-shapes.ts`, worn and shaded smooth from its own normals, tinted per corner by
 * its own weathering), so they are drawn here as instances of one batched mesh: the same picture, one copy of each shape, one draw call.
 *
 * The barriers' rockwork (pass 1, detail 1) goes the same way. A Geo given `rocks` (an array) records its boulders there (`ROCK_STRIDE` numbers each) instead of drawing them.
 */

import {BatchedMesh, BufferAttribute, BufferGeometry, Color, Matrix4, Quaternion, Vector3, type Material} from "three";
import {cachedRock, ROCK_VARIANTS} from "@/ark-scene/rock-shapes";

/** x, y, z, sx, sy, sz, turn, r, g, b, variant, detail: one boulder as `kit.ts` rock takes it (its base at y). */
export const ROCK_STRIDE = 12;

const shapes = new Map<number, BufferGeometry>();

/**
 * One boulder shape (worn, at its detail: 2 the habitats', 1 the barriers' rockwork) at unit size: its half width and half depth 1, its height 1, its base at 0, so an
 * instance's scale is the kit's (sx, sy, sz); normals and corner tints as the kit draws them (the tint's share of the
 * shape's mean colour, the instance's colour times it).
 */
export function rockShape(variant: number, detail = 2): BufferGeometry {
    const v = variant % ROCK_VARIANTS.boulder;
    const key = v * 8 + detail;
    const found = shapes.get(key);
    if (found) return found;
    const m = cachedRock("boulder", v, detail, true);
    const [x0, , z0] = m.bounds.min;
    const [x1, y1, z1] = m.bounds.max;
    const kx = 2 / (x1 - x0);
    const ky = 1 / y1;
    const kz = 2 / (z1 - z0);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const count = m.positions.length / 3;
    const mean = [0, 0, 0];
    for (let i = 0; i < m.colors.length; i++) mean[i % 3] += m.colors[i];
    for (let k = 0; k < 3; k++) mean[k] = mean[k] / (m.colors.length / 3) || 1;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (m.positions[i * 3] - mx) * kx;
        positions[i * 3 + 1] = m.positions[i * 3 + 1] * ky;
        positions[i * 3 + 2] = (m.positions[i * 3 + 2] - mz) * kz;
        // (A normal under a stretch: divided by it; the instance's own stretch is three's to undo.)
        const nx = m.normals[i * 3] / kx;
        const ny = m.normals[i * 3 + 1] / ky;
        const nz = m.normals[i * 3 + 2] / kz;
        const l = Math.hypot(nx, ny, nz) || 1;
        normals[i * 3] = nx / l;
        normals[i * 3 + 1] = ny / l;
        normals[i * 3 + 2] = nz / l;
        for (let k = 0; k < 3; k++) colours[i * 3 + k] = Math.min(Math.max(m.colors[i * 3 + k] / mean[k], 0.4), 1.5);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    geometry.setAttribute("color", new BufferAttribute(colours, 3));
    geometry.setIndex(new BufferAttribute(count > 65535 ? new Uint32Array(m.index) : new Uint16Array(m.index), 1));
    geometry.computeBoundingSphere();
    shapes.set(key, geometry);
    return geometry;
}

/**
 * The records' boulders as one batched mesh (three's `BatchedMesh`: one draw call, its shapes added once, each boulder an
 * instance with its own matrix and colour, culled one by one). Its shapes are copied in: dispose the mesh, not them.
 */
export class RockInstances {
    readonly meshes: BatchedMesh[] = [];
    private readonly ids: number[] = [];
    private readonly groups: number[] = [];
    private readonly shown: Uint8Array;

    /** `groupOf`: each boulder's group (a town chunk) for `setShown`. */
    constructor(records: ArrayLike<number>, material: Material, name: string, options: {castShadow: boolean; groupOf?: (x: number, z: number) => number} = {castShadow: true}) {
        const n = Math.floor(records.length / ROCK_STRIDE);
        const keyOf = (i: number) => (Math.round(records[i * ROCK_STRIDE + 10]) % ROCK_VARIANTS.boulder) * 8 + Math.round(records[i * ROCK_STRIDE + 11]);
        const keys = Array.from(new Set(Array.from({length: n}, (_, i) => keyOf(i)))).sort((a, b) => a - b);
        const geometries = keys.map((k) => rockShape(Math.floor(k / 8), k % 8));
        const vertices = geometries.reduce((t, g) => t + g.getAttribute("position").count, 0);
        const indices = geometries.reduce((t, g) => t + (g.index?.count ?? 0), 0);
        const mesh = new BatchedMesh(Math.max(n, 1), Math.max(vertices, 1), Math.max(indices, 1), material);
        mesh.name = name;
        mesh.castShadow = options.castShadow;
        mesh.receiveShadow = true;
        const geometryOf = new Map(keys.map((k, i) => [k, mesh.addGeometry(geometries[i])]));
        const position = new Vector3();
        const scale = new Vector3();
        const turn = new Quaternion();
        const up = new Vector3(0, 1, 0);
        const colour = new Color();
        const matrix = new Matrix4();
        for (let i = 0; i < n; i++) {
            const o = i * ROCK_STRIDE;
            const id = mesh.addInstance(geometryOf.get(keyOf(i))!);
            // (The kit turns a local point by `turn` as x' = x cos − z sin: three's turn about +y by −turn.)
            turn.setFromAxisAngle(up, -records[o + 6]);
            mesh.setMatrixAt(id, matrix.compose(position.set(records[o], records[o + 1], records[o + 2]), turn, scale.set(records[o + 3], records[o + 4], records[o + 5])));
            mesh.setColorAt(id, colour.setRGB(records[o + 7], records[o + 8], records[o + 9]));
            this.ids.push(id);
            this.groups.push(options.groupOf ? options.groupOf(records[o], records[o + 2]) : 0);
        }
        mesh.computeBoundingSphere();
        if (n) this.meshes.push(mesh);
        else mesh.dispose();
        this.shown = new Uint8Array(n).fill(1);
    }

    /** Hides the boulders of the groups not shown (a chunk the streamer does not draw), as their chunk's batches are. */
    setShown(shown: ((group: number) => boolean) | null) {
        const mesh = this.meshes[0];
        if (!mesh) return;
        for (let i = 0; i < this.ids.length; i++) {
            const on = !shown || shown(this.groups[i]) ? 1 : 0;
            if (this.shown[i] === on) continue;
            this.shown[i] = on;
            mesh.setVisibleAt(this.ids[i], on === 1);
        }
    }

    get count(): number {
        return this.ids.length;
    }

    dispose() {
        for (const mesh of this.meshes) {
            mesh.removeFromParent();
            mesh.dispose();
        }
    }
}
