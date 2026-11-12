/**
 * The asset lane's forest floor (`public/ark/assets/v1/floor`) on the island
 * (graphics pass, batch 6): litter patches, twigs, cones and fallen logs on
 * the woods' gentle ground. Pure and deterministic (each 3 m cell from its
 * own seed), so every viewer sees the same log in the same place.
 *
 * Litter patches under the trees, by the nearest one: autumn leaves under
 * broadleaves, needles under conifers, tropical leaves in the rainforest
 * (batch 6, once the asset lane rebuilt them without a base plate); twigs
 * everywhere under the trees; pine and spruce cones under the conifers; logs,
 * fresh, mossy or rotten, more rarely. Never on a site's clearing (where the
 * animals stand), on steep ground or against a trunk.
 */

import {onHamletSwitch} from "@/ark-scene/no-hamlet";
import manifest from "@/ark-scene/assets-manifest.json";
import {forestFill, worldDecor} from "@/ark-scene/decor";
import {inRock} from "@/ark-scene/map/rocks";
import {treeBody, type TreeBody} from "@/ark-scene/tree-spacing";
import {arkWorld, onArkWorld, sampleGround, seeded, smoothstep, TERRAIN_HALF, ZONE_SITES, zoneAt} from "@/ark-scene/world";
import {wildFloorPlants} from "@/ark-scene/islands/wild/decor-v2";
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
const DENSITY = {litter: 1 / 10, twigs: 1 / 18, cones: 1 / 22, log: 1 / 55};

function has(id: string): boolean {
    return Boolean(ASSETS[id]);
}

let cached: FloorPlacement[] | null = null;
// Islands mode flips (`no-hamlet.ts`), or the world does (`world.ts`): built from the other world's scenery.
onHamletSwitch(() => {
    cached = null;
});
onArkWorld(() => {
    cached = null;
});

/** Runtime prebuild hook (runtime/prebuild.ts): the same list, placed in the scenery worker before the mount. */
export function primeFloorPlacements(items: FloorPlacement[]): void {
    cached = items;
}

export function floorPlacements(): FloorPlacement[] {
    if (cached) return cached;
    const out: FloorPlacement[] = [];
    if (!has("twigs-a")) {
        cached = out;
        return out;
    }
    // Trunks to keep clear of (and the litter's tree), on a coarse grid.
    const trunks = new Map<string, Array<[number, number, string]>>();
    for (const item of [...worldDecor(), ...forestFill()]) {
        if (!TREE_KINDS.has(item.kind)) continue;
        const key = `${Math.floor(item.x / 4)},${Math.floor(item.z / 4)}`;
        const list = trunks.get(key) ?? [];
        list.push([item.x, item.z, item.kind]);
        trunks.set(key, list);
    }
    // The trunks as drawn (scenery lane): their real radii, for the logs.
    const bodies = new Map<string, TreeBody[]>();
    for (const item of [...worldDecor(), ...forestFill()]) {
        const body = treeBody(item);
        if (!body || body.low) continue;
        const key = `${Math.floor(body.x / 4)},${Math.floor(body.z / 4)}`;
        const list = bodies.get(key) ?? [];
        list.push(body);
        bodies.set(key, list);
    }
    const nearTrunkBody = (x: number, z: number, r: number) => {
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
            for (const body of bodies.get(`${Math.floor(x / 4) + dx},${Math.floor(z / 4) + dz}`) ?? []) if (Math.hypot(body.x - x, body.z - z) < body.trunk + r) return true;
        }
        return false;
    };
    const nearTrunk = (x: number, z: number, r: number) => {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                for (const [tx, tz] of trunks.get(`${Math.floor(x / 4) + dx},${Math.floor(z / 4) + dz}`) ?? []) if (Math.hypot(tx - x, tz - z) < r) return true;
            }
        }
        return false;
    };
    /** The nearest tree's kind within 5 m (litter lies under trees), or null in the open. */
    const treeOver = (x: number, z: number): string | null => {
        let best: string | null = null;
        let bestD = 5;
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                for (const [tx, tz, kind] of trunks.get(`${Math.floor(x / 4) + dx},${Math.floor(z / 4) + dz}`) ?? []) {
                    const d = Math.hypot(tx - x, tz - z);
                    if (d < bestD) {
                        bestD = d;
                        best = kind;
                    }
                }
            }
        }
        return best;
    };
    const litterFor = (x: number, z: number): string[] => {
        const kind = treeOver(x, z);
        if (!kind) return [];
        return kind === "conifer" ? ["litter-conifer-a"] : kind === "rainforest" ? ["litter-tropical-a"] : ["litter-autumn-a"];
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
            const kinds: Array<{ids: string[] | null; per: number; clear: number; log?: boolean}> = [
                // null: chosen per patch by the tree over it.
                {ids: null, per: DENSITY.litter, clear: 0.6},
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
                    const ids = (kind.ids ?? litterFor(x, z)).filter(has);
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
                    const id = ids[Math.min(Math.floor(pick * ids.length), ids.length - 1)];
                    const scale = kind.log ? 0.8 + size * 0.35 : 0.85 + size * 0.3;
                    let y = s.height - (kind.log ? 0.08 : 0.01);
                    if (kind.log) {
                        // A log is long (scenery lane, the props check): none of its length through a trunk (at the tree's
                        // real size) or a rock as drawn, and both its ends in the ground on curved ground.
                        const b = ASSETS[id].bounds;
                        const along = (t: number) => ({x: x + Math.cos(yaw) * t * scale, z: z - Math.sin(yaw) * t * scale});
                        const length = [b.min[0], b.min[0] / 2, 0, b.max[0] / 2, b.max[0]];
                        if (length.some((t) => {
                            const p = along(t);
                            return nearTrunkBody(p.x, p.z, 0.45) || inRock(p.x, p.z, 0.3);
                        })) continue;
                        for (const t of [b.min[0] * 0.9, b.max[0] * 0.9]) {
                            const p = along(t);
                            // The end's underside on the tilted log: its height along the slope from the middle.
                            const rise = -(up[0] * Math.cos(yaw) - up[2] * Math.sin(yaw)) / up[1] * t * scale;
                            y = Math.min(y, sampleGround(p.x, p.z).height - rise - b.min[1] * scale - 0.04);
                        }
                    }
                    out.push({id, x, y, z, yaw, scale, up});
                }
            }
        }
    }
    // The bigger wild island (P3): its generator's ferns, flowers, sedge, moss and grass clumps too, off the trunks,
    // rocks and these logs (`islands/wild/decor-v2.ts`). The floor's own logs, twigs, cones and litter are the woods'.
    if (arkWorld() === "v2") out.push(...wildFloorPlants(worldDecor(), forestFill(), out.filter((p) => p.id.startsWith("log-"))));
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
