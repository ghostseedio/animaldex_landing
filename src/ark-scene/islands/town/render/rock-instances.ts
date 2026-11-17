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

import {BatchedMesh, BufferAttribute, BufferGeometry, Color, Material, Matrix4, Quaternion, Vector3} from "three";
import {cachedRock, ROCK_VARIANTS} from "@/ark-scene/rock-shapes";

/** x, y, z, sx, sy, sz, turn, r, g, b, variant, detail: one boulder as `kit.ts` rock takes it (its base at y). */
export const ROCK_STRIDE = 12;
/** p4 (townfix): added to a boulder's detail, the crag's shape instead (the big rockwork, `kit.ts` rock). */
export const CRAG = 4;

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
    // p4 (townfix): a detail past `CRAG` is the wild island's bedded crag (stepped strata, split by joints) at its detail
    // less CRAG: the zoo's big rockwork (`kit.ts` rock), no longer a smooth boulder blown up to a kopje.
    // (The crag at detail 1 whatever the boulder's: 320 faces, a habitat boulder's own count; its detail 2 is 1,280.)
    const m = detail >= CRAG ? cachedRock("crag", v, 1, true) : cachedRock("boulder", v, detail, true);
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

/**
 * p4 (townfix; the coordinator, 2026-11-17: "the big rockwork boulders behind enclosures still read as smooth blobs:
 * give them strata, cracks and the rock shader detail"): over a town-weathered rock material (`townWeather`, which
 * gives the world position and normal, batching included), the stone's beds in bands of tone along the world's height
 * (warped, so they dip and pinch), a dark seam at each bed's parting and vertical joints splitting the steep faces, a
 * fine grain, the tops a little paler with dust. Procedural (no texture, no memory).
 */
export function strataRock<M extends Material>(material: M): M {
    const previous = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey;
    const defaultKey = previousKey === Material.prototype.customProgramCacheKey;
    material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
{
    vec3 sw = vTownWorld;
    vec3 sn = normalize(vTownNormal);
    float steep = 1.0 - smoothstep(0.55, 0.9, abs(sn.y));
    float warp = townNoise(sw.xz * 0.31) * 1.3 + townNoise(sw.xz * 1.9) * 0.18;
    float bedY = sw.y * 2.3 + warp + dot(sw.xz, vec2(0.21, 0.13)) + townNoise(sw.xz * 4.1 + sw.y) * 0.12;
    float bed = floor(bedY);
    float f = fract(bedY);
    float tone = 0.76 + 0.4 * townHash(vec2(bed, 3.7));
    float seam = (smoothstep(0.9, 0.97, f) + (1.0 - smoothstep(0.0, 0.035, f)) * 0.6) * (0.55 + 0.45 * townNoise(vec2(u * 2.7, bed)));
    float under = smoothstep(0.55, 0.95, f) * 0.25;
    vec2 across = normalize(vec2(-sn.z, sn.x) + vec2(1e-4));
    float u = dot(sw.xz, across);
    float joint = (1.0 - smoothstep(0.0, 0.022, abs(townNoise(vec2(u * 1.3, bed * 0.37 + sw.y * 0.4)) - 0.5) - 0.006)) * step(0.35, townHash(vec2(floor(u * 0.9), bed)));
    float grain = 0.92 + 0.16 * townNoise(sw.xz * 9.0 + sw.y * 7.0);
    vec3 stone = diffuseColor.rgb * tone * grain;
    stone *= 1.0 - (0.7 * min(seam, 1.0) + under) * steep;
    stone *= 1.0 - 0.7 * joint * steep;
    stone = mix(stone, stone * 1.14 + 0.01, smoothstep(0.65, 0.92, sn.y));
    diffuseColor.rgb = stone;
}`
        );
    };
    material.customProgramCacheKey = () => `${defaultKey ? previous.toString() : previousKey.call(material)}|strata-rock-1`;
    material.needsUpdate = true;
    return material;
}
