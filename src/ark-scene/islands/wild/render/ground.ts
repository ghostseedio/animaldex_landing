/**
 * The wild island's ground as the Ark's ground arrays (`terrain.ts` GroundArrays, the same layout and attributes), so
 * the Ark's own ground material and water draw it: its 481 × 481 vertices at 1.1 m (Part B's grid), colours from the
 * zone palettes blended by the zone weights, the material's layers (sand, mud, snow; forest floor, open ground, wet
 * bank, cliff; scree, massif, fresh water) and the water's depth map (depth, reef, fresh, the river's flow).
 *
 * Plain typed arrays and three's Color as math only: it can be built in a worker. Pure.
 */

import {BufferAttribute, BufferGeometry, Color} from "three";
import {ZONE_PALETTES} from "@/ark-scene/palettes";
import {fbm, smoothstep} from "@/ark-scene/world";
import type {GroundArrays} from "@/ark-scene/terrain";
import {sampleWildGround, type WildGroundSample} from "@/ark-scene/islands/wild/ground";
import {LAKE, lakeEdge} from "@/ark-scene/islands/wild/fields";
import {WILD_HALF, WILD_SEGMENTS} from "@/ark-scene/islands/wild/frame";

function srgb(hex: string): Color {
    return new Color(hex).convertSRGBToLinear();
}

/** The snow line on the wild island's taller mountains (the Ark ground material's own is 27 m, for today's peaks). */
export const WILD_SNOW_LINE = 52;
/** Its lake's water colour (linear): a clearer, lighter teal than today's small lake (seen from above it read as ink). */
export const WILD_LAKE_COLOUR = new Color(0.16, 0.42, 0.36);

/** The lake's and the river's water: the ground's quads with fresh water over them, at each vertex's own level. */
export function freshWaterGeometry(ground: GroundArrays & {freshLevels: Float32Array}): BufferGeometry {
    const size = ground.size;
    const positions: number[] = [];
    for (let row = 0; row < size - 1; row++) {
        for (let column = 0; column < size - 1; column++) {
            const corners = [row * size + column, row * size + column + 1, (row + 1) * size + column + 1, (row + 1) * size + column];
            const levels = corners.map((i) => ground.freshLevels[i]);
            if (levels.every((l) => Number.isNaN(l))) continue;
            const top = Math.max(...levels.filter((l) => !Number.isNaN(l)));
            const at = corners.map((i, k) => [ground.positions[i * 3], Number.isNaN(levels[k]) ? top : levels[k], ground.positions[i * 3 + 2]]);
            positions.push(...at[0], ...at[3], ...at[1], ...at[3], ...at[2], ...at[1]);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    return geometry;
}

export type WildGround = GroundArrays & {
    /** Each vertex's fresh-water surface (NaN where there is none), for the lake's and the river's water. */
    freshLevels: Float32Array;
};

export function wildGroundArrays(): WildGround {
    const segments = WILD_SEGMENTS;
    const size = segments + 1;
    const count = size * size;
    const half = WILD_HALF;
    const segment = (half * 2) / segments;
    const positions = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    for (let row = 0; row < size; row++) {
        for (let column = 0; column < size; column++) {
            const i = row * size + column;
            positions[i * 3] = column * segment - half;
            positions[i * 3 + 2] = row * segment - half;
            uvs[i * 2] = column / segments;
            uvs[i * 2 + 1] = 1 - row / segments;
        }
    }
    const index = new Uint32Array(segments * segments * 6);
    let k = 0;
    for (let row = 0; row < segments; row++) {
        for (let column = 0; column < segments; column++) {
            const a = column + size * row;
            const b = column + size * (row + 1);
            const c = column + 1 + size * (row + 1);
            const d = column + 1 + size * row;
            index[k++] = a;
            index[k++] = b;
            index[k++] = d;
            index[k++] = b;
            index[k++] = c;
            index[k++] = d;
        }
    }
    const colors = new Float32Array(count * 3);
    const layers = new Float32Array(count * 4);
    const layers2 = new Float32Array(count * 4);
    const rock = new Float32Array(count * 3);
    const depth = new Uint8Array(count * 4);
    const heights = new Float32Array(count);
    const freshLevels = new Float32Array(count);
    const samples: WildGroundSample[] = new Array(count);
    const palettes = Object.fromEntries(Object.entries(ZONE_PALETTES).map(([zone, p]) => [zone, [srgb(p.ground[0]), srgb(p.ground[1])]])) as Record<string, [Color, Color]>;
    const sand = srgb(ZONE_PALETTES.seashore.ground[0]);
    const warmSand = srgb("#d0a868");
    const reefFloor = srgb(ZONE_PALETTES.coral_reef.ground[0]);
    const seaFloor = srgb(ZONE_PALETTES.open_ocean.ground[0]);
    const alpine = srgb("#8a8f62");
    const tundra = srgb("#9d9c78");
    const savannaGreen = srgb("#8f9a50");
    const straw = srgb("#b9aa68");
    const duneSand = srgb("#e2c48e");
    const color = new Color();
    const mix = new Color();
    const tone = new Color();

    for (let i = 0; i < count; i++) {
        const x = positions[i * 3];
        const z = positions[i * 3 + 2];
        const s = sampleWildGround(x, z);
        samples[i] = s;
        positions[i * 3 + 1] = s.height;
        heights[i] = s.height;
        freshLevels[i] = s.freshLevel ?? Number.NaN;
        const w = s.weights;
        color.setRGB(0, 0, 0);
        for (const [zone, weight] of Object.entries(w)) {
            if (weight < 0.004 || zone === "farm_garden") continue;
            const [a, b] = palettes[zone];
            mix.copy(a).lerp(b, fbm(x * 0.07 + 11, z * 0.07 - 3));
            color.r += mix.r * weight;
            color.g += mix.g * weight;
            color.b += mix.b * weight;
        }
        // The savanna: straw where it is dry, greener where it is wetter (beside the woods and the river); the desert's sand.
        color.lerp(straw, w.grassland * 0.6);
        color.lerp(savannaGreen, w.grassland * smoothstep(0.28, 0.58, s.moisture) * 0.6);
        color.lerp(duneSand, w.desert * 0.65);
        // The mountains' alpine meadows green above the tree line, the cove's tundra olive.
        color.lerp(alpine, w.mountains * smoothstep(26, 40, s.height) * (1 - smoothstep(44, 52, s.height)) * 0.45);
        color.lerp(tundra, w.polar * (1 - s.ice) * 0.4);
        const beach = (1 - smoothstep(0.45, 1, s.land)) * (1 - w.polar) * (1 - s.cliff);
        tone.copy(sand).lerp(warmSand, Math.min(w.grassland + w.desert + s.temperature * 0.3, 1) * 0.8);
        color.lerp(tone, beach * 0.85);
        if (s.height < 0) color.lerp(mix.copy(seaFloor).lerp(reefFloor, s.reef), smoothstep(0.2, 3, -s.height));
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        // The tundra holds snow in patches (and in the coldest hollows), the ice shelf is all snow.
        const patches = smoothstep(0.5, 0.7, fbm(x * 0.06 + 3, z * 0.06 - 9));
        const snow = Math.max(w.polar * smoothstep(0.3, 1, s.land) * smoothstep(0.24, 0.08, s.temperature) * (0.4 + 0.6 * patches), s.ice);
        layers[i * 4] = Math.min(1, beach + w.desert * 1.1 + w.seashore * 0.6 * (1 - s.cliff) + (s.height < 0 ? s.reef : 0));
        layers[i * 4 + 1] = Math.min(1, w.wetland * smoothstep(0.2, 1, s.land) * (1 - beach) + s.estuary * (1 - smoothstep(0.4, 1.6, s.height)) * 0.8);
        layers[i * 4 + 2] = 0;
        layers[i * 4 + 3] = snow;
        const land = smoothstep(0.3, 1, s.land);
        layers2[i * 4] = (w.rainforest + w.woodland + w.mountains * 0.35 * (1 - smoothstep(34, 44, s.height))) * land * (1 - snow);
        layers2[i * 4 + 1] = (w.grassland + w.desert * 0.2 + w.mountains * 0.3) * land;
        const lakeBank = smoothstep(lakeEdge(x, z) + 5, lakeEdge(x, z) + 0.5, Math.hypot(x - LAKE.x, z - LAKE.z));
        layers2[i * 4 + 2] = Math.max(lakeBank, smoothstep(s.riverHit.width + 4, s.riverHit.width + 0.5, s.river) * (s.inland > 3 ? 1 : 0), w.wetland * 0.6) * (1 - snow);
        layers2[i * 4 + 3] = s.cliff;
        rock[i * 3 + 1] = Math.min(1, w.mountains * smoothstep(14, 30, s.height) + smoothstep(34, 48, s.height)) * (1 - w.polar * (1 - smoothstep(20, 30, s.height)));
        rock[i * 3 + 2] = s.fresh;
        // The water's depth map: depth (r, /12), reef (g), fresh (b), the river's flow (a: 0.5…1, its way downstream).
        const at = i * 4;
        const water = s.freshLevel !== null && s.fresh > 0.02 ? Math.max(s.freshLevel - s.height, 0) : Math.max(-s.height, 0);
        depth[at] = Math.min(255, Math.round((water / 12) * 255));
        depth[at + 1] = Math.round(s.reef * 255);
        depth[at + 2] = Math.round(s.fresh * 255);
        const inLake = Math.hypot(x - LAKE.x, z - LAKE.z) < lakeEdge(x, z) + 2;
        if (s.fresh > 0.02 && !inLake && s.river < s.riverHit.width + 1.5) {
            let angle = Math.atan2(s.riverHit.dz, s.riverHit.dx);
            if (angle < 0) angle += Math.PI * 2;
            // (The water decodes 0.5…1 as a flow; the river runs south, so its angle is in 0…π.)
            depth[at + 3] = angle <= Math.PI ? Math.round((0.5 + angle / (Math.PI * 2)) * 255) : 0;
        }
    }
    // Scree at the foot of the steep faces, and ambient occlusion from the ground's own shape.
    for (let row = 0; row < size; row++) {
        for (let column = 0; column < size; column++) {
            const i = row * size + column;
            const l = heights[row * size + Math.max(column - 1, 0)];
            const r = heights[row * size + Math.min(column + 1, size - 1)];
            const u = heights[Math.max(row - 1, 0) * size + column];
            const d = heights[Math.min(row + 1, size - 1) * size + column];
            const slope = Math.hypot(r - l, d - u) / (2 * segment);
            rock[i * 3] = smoothstep(0.55, 1.05, slope) * Math.min(1, samples[i].weights.mountains * 1.5 + samples[i].cliff) * (1 - layers[i * 4 + 3]);
            let sum = 0;
            let n = 0;
            for (let dr = -3; dr <= 3; dr += 3) {
                for (let dc = -3; dc <= 3; dc += 3) {
                    const rr = row + dr;
                    const cc = column + dc;
                    if (rr < 0 || cc < 0 || rr >= size || cc >= size || (!dr && !dc)) continue;
                    sum += heights[rr * size + cc];
                    n++;
                }
            }
            const ao = 1 - Math.min(Math.max(sum / n - heights[i], 0) * 0.16, 0.38);
            colors[i * 3] *= ao;
            colors[i * 3 + 1] *= ao;
            colors[i * 3 + 2] *= ao;
        }
    }
    const normals = new Float32Array(count * 3);
    for (let t = 0; t < index.length; t += 3) {
        const vA = index[t] * 3;
        const vB = index[t + 1] * 3;
        const vC = index[t + 2] * 3;
        const cbx = positions[vC] - positions[vB];
        const cby = positions[vC + 1] - positions[vB + 1];
        const cbz = positions[vC + 2] - positions[vB + 2];
        const abx = positions[vA] - positions[vB];
        const aby = positions[vA + 1] - positions[vB + 1];
        const abz = positions[vA + 2] - positions[vB + 2];
        const nx = cby * abz - cbz * aby;
        const ny = cbz * abx - cbx * abz;
        const nz = cbx * aby - cby * abx;
        for (const v of [vA, vB, vC]) {
            normals[v] += nx;
            normals[v + 1] += ny;
            normals[v + 2] += nz;
        }
    }
    for (let i = 0; i < count; i++) {
        const l = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]) || 1;
        normals[i * 3] /= l;
        normals[i * 3 + 1] /= l;
        normals[i * 3 + 2] /= l;
    }
    return {size, positions, normals, uvs, index, colors, layers, layers2, rock, depth, freshLevels};
}
