/**
 * The asset lane's forest floor (`public/ark/assets/v1/floor`) on the island
 * (graphics pass, batch 6): litter patches, twigs, cones and fallen logs on
 * the woods' gentle ground. Pure and deterministic (each 3 m cell from its
 * own seed), so every viewer sees the same log in the same place.
 *
 * Twigs everywhere under the trees; pine and spruce cones under the conifers;
 * logs, fresh, mossy or rotten, more rarely. (The set's litter patches are
 * not used: see DENSITY.) Never on a site's clearing (where the
 * animals stand), on steep ground or against a trunk.
 */

import manifest from "@/ark-scene/assets-manifest.json";
import {forestFill, worldDecor} from "@/ark-scene/decor";
import {sampleGround, seeded, smoothstep, TERRAIN_HALF, ZONE_SITES, zoneAt} from "@/ark-scene/world";
import type {ArkZone} from "@/ark-scene/types";

type FloorInfo = {kind: string; bounds: {min: [number, number, number]; max: [number, number, number]}; lod_distances: [number, number, number]; lods: Array<{level: "lod0" | "lod1" | "lod2"; file: string; tris: number; doubleSided: boolean}>};
const ASSETS = (manifest as unknown as {assets: Record<string, FloorInfo & {set?: string}>}).assets;

export function floorAssetInfo(id: string): FloorInfo {
    return ASSETS[id];
}

export type FloorPlacement = {id: string; x: number; y: number; z: number; yaw: number; scale: number; /** Lies along the ground's slope. */ up: [number, number, number]};

const CELL = 3;
const TREE_KINDS = new Set(["broadleaf", "rainforest", "conifer", "acacia", "palm", "orchard", "canopy"]);

/** Per m² of forest floor (at full forest weight). */
// Litter patches are left out (batch 6): their opaque base plate reads as a square rug on our ground; the procedural
// litter mats (near-detail.ts) cover the floor instead. Logs, twigs and cones are used.
const DENSITY = {litter: 0, twigs: 1 / 18, cones: 1 / 22, log: 1 / 55};

function has(id: string): boolean {
    return Boolean(ASSETS[id]);
}

let cached: FloorPlacement[] | null = null;

export function floorPlacements(): FloorPlacement[] {
    if (cached) return cached;
    const out: FloorPlacement[] = [];
    if (!has("twigs-a")) {
        cached = out;
        return out;
    }
    // Trunks to keep clear of, on a coarse grid.
    const trunks = new Map<string, Array<[number, number]>>();
    for (const item of [...worldDecor(), ...forestFill()]) {
        if (!TREE_KINDS.has(item.kind)) continue;
        const key = `${Math.floor(item.x / 4)},${Math.floor(item.z / 4)}`;
        const list = trunks.get(key) ?? [];
        list.push([item.x, item.z]);
        trunks.set(key, list);
    }
    const nearTrunk = (x: number, z: number, r: number) => {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                for (const [tx, tz] of trunks.get(`${Math.floor(x / 4) + dx},${Math.floor(z / 4) + dz}`) ?? []) if (Math.hypot(tx - x, tz - z) < r) return true;
            }
        }
        return false;
    };
    const clearings = (Object.keys(ZONE_SITES) as ArkZone[]).map((zone) => ZONE_SITES[zone]).filter((site) => site.kind === "land");
    const onClearing = (x: number, z: number, margin: number) => clearings.some((site) => Math.hypot(x - site.x, z - site.z) < site.clearing + margin);
    const cells = Math.ceil(TERRAIN_HALF / CELL);
    for (let cx = -cells; cx < cells; cx++) {
        for (let cz = -cells; cz < cells; cz++) {
            const x0 = cx * CELL;
            const z0 = cz * CELL;
            const centre = sampleGround(x0 + CELL / 2, z0 + CELL / 2);
            const w = centre.weights;
            const forest = Math.min(1, (w.woodland ?? 0) + (w.rainforest ?? 0) + (w.mountains ?? 0) * 0.5);
            if (forest < 0.35 || centre.height < 0.6 || centre.height > 20 || centre.land < 0.95) continue;
            const zone = zoneAt(centre);
            const random = seeded(((cx * 48271) ^ (cz * 69621) ^ 0x7f10) >>> 0);
            const area = CELL * CELL * smoothstep(0.35, 0.8, forest);
            const conifers = zone === "woodland" || zone === "mountains";
            const kinds: Array<{ids: string[]; per: number; clear: number; log?: boolean}> = [
                {ids: zone === "rainforest" ? ["litter-tropical-a"] : conifers && random() < 0.45 ? ["litter-conifer-a"] : ["litter-autumn-a"], per: DENSITY.litter, clear: 0.6},
                {ids: ["twigs-a", "twigs-b"], per: DENSITY.twigs, clear: 0.5},
                {ids: conifers ? ["pinecones-pine-a", "pinecones-spruce-a"] : [], per: DENSITY.cones, clear: 0.4},
                {ids: ["log-fresh-a", "log-fresh-b", "log-mossy-a", "log-mossy-b", "log-rotten-a", "log-rotten-b"], per: DENSITY.log, clear: 1.6, log: true}
            ];
            for (const kind of kinds) {
                const expected = area * kind.per;
                const count = Math.floor(expected) + (random() < expected - Math.floor(expected) ? 1 : 0);
                for (let k = 0; k < count; k++) {
                    const x = x0 + random() * CELL;
                    const z = z0 + random() * CELL;
                    const yaw = random() * Math.PI * 2;
                    const pick = random();
                    const size = random();
                    const ids = kind.ids.filter(has);
                    if (!ids.length) continue;
                    if (onClearing(x, z, kind.log ? 4 : 0.5) || nearTrunk(x, z, kind.clear)) continue;
                    const e = 0.5;
                    const hx = sampleGround(x - e, z).height - sampleGround(x + e, z).height;
                    const hz = sampleGround(x, z - e).height - sampleGround(x, z + e).height;
                    const l = Math.hypot(hx, 2 * e, hz);
                    const up: [number, number, number] = [hx / l, (2 * e) / l, hz / l];
                    // Gentle ground only (a log on a steep slope would roll; litter would hang over the edge).
                    if (up[1] < (kind.log ? 0.94 : 0.88)) continue;
                    const s = sampleGround(x, z);
                    out.push({id: ids[Math.min(Math.floor(pick * ids.length), ids.length - 1)], x, y: s.height - (kind.log ? 0.08 : 0.01), z, yaw, scale: kind.log ? 0.8 + size * 0.35 : 0.85 + size * 0.3, up});
                }
            }
        }
    }
    cached = out;
    return out;
}

/** The fallen logs as circles along their length, for the animals to keep clear of (a behaviour lane hook). */
export function floorObstacles(): Array<{x: number; z: number; radius: number}> {
    const list: Array<{x: number; z: number; radius: number}> = [];
    for (const p of floorPlacements()) {
        if (!p.id.startsWith("log-")) continue;
        const b = ASSETS[p.id].bounds;
        const half = ((b.max[0] - b.min[0]) / 2) * p.scale;
        const radius = (((b.max[1] - b.min[1]) + (b.max[2] - b.min[2])) / 4) * p.scale + 0.1;
        // The log lies along its own x: three circles along it.
        for (const t of [-0.66, 0, 0.66]) list.push({x: p.x + Math.cos(p.yaw) * half * t, z: p.z - Math.sin(p.yaw) * half * t, radius});
    }
    return list;
}
