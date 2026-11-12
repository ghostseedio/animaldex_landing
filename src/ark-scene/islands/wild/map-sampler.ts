/**
 * The Ark map's sampler (`map/sampler.ts` ArkMapSampler) over the wild island: its ground's map tags, its scenery's
 * blocking, its anchors and its attach points. The map's own machinery (`map/points.ts` MapPoints: the 2.5 m spawn
 * cells, one tag a cell, the launch points, the lists slots take) runs on it unchanged, which is how the wild island's
 * placement sites and its validator are made (`sites.ts`, `validate.ts`), and how the scene's placement will read the
 * island once it replaces today's (docs/ark/wild-island.md §8).
 *
 * The tags follow today's stub (`map/world-sampler.ts`) on the wild island's own fields; there are no house, garden or
 * farm tags (no buildings: islands plan §2.4).
 */

import manifest from "@/ark-scene/assets-manifest.json";
import {noise} from "@/ark-scene/world";
import {assetAttachRows} from "@/ark-scene/tree-assets";
import {rockAttachPoints} from "@/ark-scene/rock-assets";
import type {ArkMapSampler, AttachPoint, AttachTag, GroundSurface, MapAnchor} from "@/ark-scene/map/sampler";
import type {MapTag} from "@/ark-scene/map/tags";
import type {ArkZone} from "@/ark-scene/types";
import {sampleWildGround, underWater, wildZoneAt, type WildGroundSample} from "@/ark-scene/islands/wild/ground";
import {gridSlope} from "@/ark-scene/islands/wild/terrain-cache";
import {inRange} from "@/ark-scene/islands/wild/reserves";
import {WildObstacles, wildScenery, type WildItem} from "@/ark-scene/islands/wild/scenery";
import {LAKE, lakeEdge, WETLAND, ICE_FRONT_Z, coveDistance} from "@/ark-scene/islands/wild/fields";
import {WILD_HALF} from "@/ark-scene/islands/wild/frame";

type AssetInfo = {height: number; bounds?: {min: [number, number, number]; max: [number, number, number]}};
const ASSETS = (manifest as unknown as {assets: Record<string, AssetInfo>}).assets;

const SIZES: Record<AttachTag, {min: number; max: number}> = {
    leaf: {min: 0.001, max: 0.12}, branch: {min: 0.02, max: 0.6}, bark: {min: 0.002, max: 0.45}, flower_head: {min: 0.001, max: 0.07},
    rock_face: {min: 0.003, max: 0.6}, tide_pool: {min: 0.003, max: 0.35}, house_wall: {min: 0.002, max: 0.3}, porch_light: {min: 0.003, max: 0.1},
    house_eave: {min: 0.002, max: 0.2}, worm_hole: {min: 0.005, max: 0.35}, burrow_entrance: {min: 0.03, max: 0.6}, limb: {min: 0.15, max: 1.6},
    canopy_hang: {min: 0.05, max: 1.2}, fence_post: {min: 0.01, max: 0.5}, roof_edge: {min: 0.01, max: 0.6}, ledge: {min: 0.02, max: 1}, tree_hollow: {min: 0.02, max: 0.5}
};

function landZone(s: WildGroundSample): ArkZone {
    return wildZoneAt(s) as ArkZone;
}

class WildMapSampler implements ArkMapSampler {
    readonly id = "wild-island-1";
    readonly half = WILD_HALF - 4;
    private obstacles: WildObstacles | null = null;
    private anchorList: MapAnchor[] | null = null;
    private pointList: AttachPoint[] | null = null;
    private rockCells: Map<string, WildItem[]> | null = null;
    private building = false;

    private obs(): WildObstacles {
        this.obstacles ??= new WildObstacles(wildScenery());
        return this.obstacles;
    }

    blocked(x: number, z: number, radius: number): boolean {
        return this.obs().blocked(x, z, radius);
    }

    covered(x: number, z: number): boolean {
        return this.obs().covers(x, z);
    }

    /** The big animals' ranges (decision 54): no other animal's cell in their clear discs (`reserves.ts`). */
    reserved(x: number, z: number): boolean {
        // (A cell's laps reach 1.9 m from its middle: none may fall in a disc.)
        return inRange(x, z, 2);
    }

    walkable(x: number, z: number, maxSlope: number): boolean {
        const s = sampleWildGround(x, z);
        if (underWater(s)) return false;
        return gridSlope(x, z) <= maxSlope && !this.blocked(x, z, 0.3);
    }

    /** Beside a rock: within a couple of metres of its side. */
    private byRock(x: number, z: number): boolean {
        if (!this.rockCells) {
            this.rockCells = new Map();
            for (const item of wildScenery()) {
                if (item.kind !== "rock" && item.kind !== "cave") continue;
                const key = `${Math.floor(item.x / 4)},${Math.floor(item.z / 4)}`;
                this.rockCells.set(key, [...(this.rockCells.get(key) ?? []), item]);
            }
        }
        const cx = Math.floor(x / 4);
        const cz = Math.floor(z / 4);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const it of this.rockCells.get(`${cx + dx},${cz + dz}`) ?? []) if (Math.hypot(it.x - x, it.z - z) < Math.max(it.solid, 0.6) + 1.8) return true;
        return false;
    }

    private anchorIndex: Map<string, MapAnchor[]> | null = null;

    /** Within an anchor of this name (a spatial index by name and 8 m square). */
    private near(x: number, z: number, name: string): boolean {
        if (this.building) return false;
        if (!this.anchorIndex) {
            this.anchorIndex = new Map();
            for (const anchor of this.anchors()) {
                const key = `${anchor.name}|${Math.floor(anchor.x / 8)},${Math.floor(anchor.z / 8)}`;
                this.anchorIndex.set(key, [...(this.anchorIndex.get(key) ?? []), anchor]);
            }
        }
        const cx = Math.floor(x / 8);
        const cz = Math.floor(z / 8);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const a of this.anchorIndex.get(`${name}|${cx + dx},${cz + dz}`) ?? []) if (Math.hypot(a.x - x, a.z - z) <= a.radius) return true;
        return false;
    }

    ground(x: number, z: number): GroundSurface {
        const s = sampleWildGround(x, z);
        const w = s.weights;
        const tags: MapTag[] = [];
        const add = (...list: MapTag[]) => tags.push(...list);
        const water = underWater(s);
        let zone: ArkZone = landZone(s);
        const estuary = s.estuary > 0.25;
        if (water === "fresh") {
            const depth = (s.freshLevel ?? 0) - s.height;
            const lakeD = Math.hypot(x - LAKE.x, z - LAKE.z);
            const inLake = lakeD < lakeEdge(x, z) + 0.6;
            const inRiver = s.river < s.riverHit.width + 0.6;
            if (inLake) {
                add("lake");
                if (depth < 1.1) add("pond");
                if (lakeD > lakeEdge(x, z) - 3) add("marsh_reeds");
            }
            if (inRiver && !inLake) {
                add("stream_river");
                if (s.riverAlong < 0.3) add("waterfall_rapids");
            }
            if (!inLake && !inRiver) add("pond", "marsh_reeds");
            if (estuary) add("estuary", "mangrove");
            return {height: s.height, water: "fresh", depth, zone, tags};
        }
        if (water === "sea") {
            const depth = -s.height;
            zone = s.reef > 0.3 ? "coral_reef" : s.inland > -16 ? "seashore" : "open_ocean";
            if (s.inland > -18 && depth < 5) add("coastal_shallows");
            if (depth > 0.6 && depth < 10) add("seabed");
            if (s.reef > 0.35 && depth > 0.5 && depth < 7) add("coral_reef");
            if (depth < 3.6 && ((s.reef > 0.3 && s.inland > -40) || (s.inland > -18 && s.cliff < 0.3 && s.temperature > 0.6))) add("seagrass");
            if (s.kelp > 0.45 && depth > 2 && depth < 13 && s.inland > -55) add("kelp");
            if (s.inland < -8 && depth > 3) add("open_ocean", "attached_to_large");
            if (depth > 2.5) add("sea_surface");
            if (depth > 7.5) add("deep_water");
            if (estuary && depth < 2) add("estuary", "mudflat");
            if (depth < 1 && s.inland > -3 && s.cliff > 0.25) add("rocky_shore");
            if (this.near(x, z, "floe") || (coveDistance(x, z) < 1 && z > ICE_FRONT_Z - 5)) add("sea_ice");
            if (this.near(x, z, "anemone")) add("anemone");
            if (this.near(x, z, "cleaning_station")) add("cleaner_station");
            return {height: s.height, water: "sea", depth, zone, tags};
        }
        // Dry ground (and the ice shelf).
        const forest = w.woodland + w.rainforest;
        const top = Math.max(...Object.values(w));
        const grade = gridSlope(x, z);
        const sandy = s.land < 0.95 && s.height < 1.8 && s.cliff < 0.3 && w.polar < 0.3 && s.inland < 12;
        if (s.ice > 0.5) {
            add("sea_ice", "snow_ice", "open_sky");
            return {height: s.height, water: null, depth: 0, zone: "polar", tags};
        }
        if (w.grassland > 0.35) add("grassland", "on_grazers");
        if ((w.grassland > 0.3 || (w.mountains > 0.3 && s.height < 48) || w.polar > 0.4) && noise(x * 0.09 + 31, z * 0.09 - 7) > 0.55) add("flower_meadow");
        if (top < 0.62 && forest + w.grassland + w.desert + w.mountains > 0.7) add("scrub");
        if (w.desert > 0.3 && noise(x * 0.12 - 5, z * 0.12) > 0.55) add("scrub");
        if (forest > 0.45) add("forest_floor");
        if (forest > 0.45 && this.near(x, z, "log")) add("logs_deadwood", "carcass");
        if (!sandy && s.height < 40 && w.desert < 0.5 && w.polar < 0.4 && grade < 0.9) add("soil");
        if (s.height < 44 && w.wetland < 0.5 && grade < 0.9 && s.inland > 2) add("burrows");
        if (this.near(x, z, "termite_mound")) add("termite_ant_mounds");
        if (this.near(x, z, "dung_pat")) add("dung");
        if (grade > 0.75 && (w.mountains > 0.3 || s.height > 12)) add("cliffs");
        if (this.near(x, z, "cave")) add("caves");
        if (w.mountains > 0.35) add("mountain_alpine");
        if (s.height > 52 || w.polar > 0.5) add("snow_ice");
        if (w.polar > 0.35 && s.height < 24) add("tundra");
        if (w.desert > 0.35) add("desert_sand");
        if (sandy) add("sandy_beach");
        if (s.cliff > 0.25 && s.inland > -3 && s.inland < 6 && s.height < 3) add("rocky_shore");
        if (s.cliff > 0.35 && s.inland >= 0 && s.inland < 14 && s.height > 1) add("sea_cliffs");
        if (estuary && s.height < 1.4) add("estuary", "mangrove", "mudflat");
        if (estuary && s.height < 0.7) add("salt_lake");
        if (this.byRock(x, z)) add("rocks_boulders");
        if (s.river < s.riverHit.width + 4 && s.inland > 2) add("stream_river");
        if (s.river < s.riverHit.width + 4 && s.inland > 2 && s.riverAlong < 0.3) add("waterfall_rapids");
        if (Math.hypot(x - LAKE.x, z - LAKE.z) < lakeEdge(x, z) + 4) add("lake", "marsh_reeds");
        if (w.wetland > 0.35) add("marsh_reeds");
        if (w.wetland > 0.35 && s.height < WETLAND.level + 0.3) add("pond");
        add("open_sky");
        // A face steeper than a walker walks (behaviour's MAX_SLOPE) is a cliff, a rock face or the mountain's, never a
        // meadow, a forest floor or a shore: only the tags of steep ground hold there.
        if (grade > STEEP) return {height: s.height, water: null, depth: 0, zone, tags: tags.filter((tag) => (grade > SHEER ? SHEER_TAGS : STEEP_TAGS).has(tag))};
        return {height: s.height, water: null, depth: 0, zone, tags};
    }

    anchors(): readonly MapAnchor[] {
        if (this.anchorList) return this.anchorList;
        this.building = true;
        const list: MapAnchor[] = [];
        const at = (name: string, x: number, y: number, z: number, radius: number, tags: MapTag[]) => {
            const s = sampleWildGround(x, z);
            list.push({name, x, y, z, radius, zone: underWater(s) === "sea" ? (s.reef > 0.3 ? "coral_reef" : "open_ocean") : landZone(s), tags});
        };
        for (const item of wildScenery()) {
            if (item.kind === "tree" && item.height > 12 && item.asset && !item.asset.startsWith("palm") && !item.asset.startsWith("snag")) at("canopy_tree", item.x, item.y, item.z, 3, ["canopy", "trunks_bark", "leaves", "host_nests", "bamboo"]);
            else if (item.kind === "cave") at("cave", item.x, item.y, item.z, 3, ["caves"]);
            else if (item.kind === "floe") at("floe", item.x, 0.25, item.z, 1.5 * item.scale, ["sea_ice"]);
            else if (item.kind === "mound") at("termite_mound", item.x, item.y, item.z, 1.6, ["termite_ant_mounds"]);
            else if (item.kind === "log") at("log", item.x, item.y, item.z, 2, ["logs_deadwood", "carcass"]);
        }
        // The lagoon's anemone and cleaning station: on its sand inside the crest, the deepest spots 2–5 m.
        const lagoon = wildScenery().filter((it) => it.kind === "coral").map((it) => ({it, s: sampleWildGround(it.x, it.z)})).filter(({s}) => -s.height > 2 && -s.height < 5 && s.inland > -38);
        if (lagoon.length) {
            const a = lagoon[Math.floor(lagoon.length * 0.3)].it;
            const b = lagoon[Math.floor(lagoon.length * 0.7)].it;
            at("anemone", a.x, a.y, a.z, 1.6, ["anemone", "coral_reef"]);
            at("cleaning_station", b.x, b.y, b.z, 2, ["cleaner_station", "coral_reef"]);
        }
        // Dung pats on the savanna (none drawn: the grazers' ground), from a fixed scatter.
        for (let k = 0, found = 0; k < 3000 && found < 12; k++) {
            const x = (frac(Math.sin(k * 12.9898) * 43758.5453) * 2 - 1) * this.half;
            const z = (frac(Math.sin(k * 78.233) * 43758.5453) * 2 - 1) * this.half;
            const s = sampleWildGround(x, z);
            if (s.weights.grassland < 0.5 || s.height < 0.5 || underWater(s) || s.river < 8) continue;
            if (list.some((p) => p.name === "dung_pat" && Math.hypot(p.x - x, p.z - z) < 10)) continue;
            at("dung_pat", x, s.height, z, 1.2, ["dung"]);
            found++;
        }
        this.building = false;
        this.anchorList = list;
        return list;
    }

    attachPoints(): readonly AttachPoint[] {
        if (this.pointList) return this.pointList;
        const points: AttachPoint[] = [];
        const zoneAt = (x: number, z: number) => landZone(sampleWildGround(x, z));
        for (const item of wildScenery()) {
            if (item.kind === "tree" && item.asset) {
                // The asset tree's own points (tree-attach.json), turned and scaled as it is drawn.
                const c = Math.cos(item.yaw);
                const s = Math.sin(item.yaw);
                const turn = (x: number, y: number, z: number): [number, number, number] => [x * c + z * s, y, -x * s + z * c];
                const zone = zoneAt(item.x, item.z);
                assetAttachRows(item.asset).forEach((row, k) => {
                    const [tag, px, py, pz, nx, ny, nz, fx, fy, fz, s0, s1, , , , , , , , , radius, above, below] = row;
                    const p = turn(px * item.scale, py * item.scale, pz * item.scale);
                    const n = turn(nx, ny, nz);
                    const f = turn(fx, fy, fz);
                    const limb = tag === "limb" || tag === "canopy_hang";
                    points.push({
                        id: `${item.asset}@${item.x.toFixed(1)},${item.z.toFixed(1)}#${k}`, tag, x: item.x + p[0], y: item.y + p[1], z: item.z + p[2], normal: n, tangent: f,
                        size: {min: limb ? s0 * item.scale : Math.min(s0 * item.scale, 0.001), max: s1 * item.scale}, zone,
                        ...(limb ? {radius: radius * item.scale, clearAbove: above * item.scale, clearBelow: below * item.scale} : {})
                    });
                });
            } else if ((item.kind === "rock" || item.kind === "cave") && item.asset) {
                const zone = zoneAt(item.x, item.z);
                rockAttachPoints({id: item.asset, x: item.x, y: item.y, z: item.z, yaw: item.yaw, scale: item.scale}).forEach((point, k) => {
                    const tag = point.tag === "rock_face" || point.tag === "ledge" || point.tag === "burrow_entrance" ? (point.tag as AttachTag) : point.tag === "crevice" ? "rock_face" : null;
                    if (!tag) return;
                    // Not under the ground it is sunk into.
                    if (point.position.y < sampleWildGround(point.position.x, point.position.z).height + 0.02) return;
                    const n = point.normal;
                    const t: [number, number, number] = Math.abs(n.y) > 0.9 ? [1, 0, 0] : [0, 1, 0];
                    const d = t[0] * n.x + t[1] * n.y + t[2] * n.z;
                    const tx = t[0] - d * n.x;
                    const ty = t[1] - d * n.y;
                    const tz = t[2] - d * n.z;
                    const l = Math.hypot(tx, ty, tz) || 1;
                    points.push({id: `${item.asset}@${item.x.toFixed(1)},${item.z.toFixed(1)}#${k}`, tag, x: point.position.x, y: point.position.y, z: point.position.z, normal: [n.x, n.y, n.z], tangent: [tx / l, ty / l, tz / l], size: {min: Math.min(point.size[0], SIZES[tag].min), max: Math.max(point.size[1], SIZES[tag].max * 0.5)}, zone});
                });
                if (item.asset.startsWith("tide-pool")) points.push({id: `pool@${item.x.toFixed(1)},${item.z.toFixed(1)}`, tag: "tide_pool", x: item.x, y: item.y + item.height * 0.6, z: item.z, normal: [0, 1, 0], tangent: [1, 0, 0], size: SIZES.tide_pool, zone});
            } else if (item.kind === "shrub" || item.kind === "reed") {
                points.push({id: `${item.kind}@${item.x.toFixed(1)},${item.z.toFixed(1)}`, tag: "leaf", x: item.x, y: item.y + item.height * 0.92, z: item.z, normal: [0, 1, 0], tangent: [Math.cos(item.yaw), 0, Math.sin(item.yaw)], size: SIZES.leaf, zone: zoneAt(item.x, item.z)});
                if (item.kind === "shrub") points.push({id: `${item.kind}b@${item.x.toFixed(1)},${item.z.toFixed(1)}`, tag: "branch", x: item.x, y: item.y + item.height * 0.6, z: item.z, normal: [0, 1, 0], tangent: [Math.sin(item.yaw), 0, Math.cos(item.yaw)], size: {min: 0.002, max: 0.2}, zone: zoneAt(item.x, item.z)});
            } else if (item.kind === "plant" && item.asset?.startsWith("flower")) {
                points.push({id: `flower@${item.x.toFixed(1)},${item.z.toFixed(1)}`, tag: "flower_head", x: item.x, y: item.y + item.height, z: item.z, normal: [0, 1, 0], tangent: [Math.cos(item.yaw), 0, Math.sin(item.yaw)], size: SIZES.flower_head, zone: zoneAt(item.x, item.z)});
            } else if (item.kind === "log" && item.asset) {
                points.push({id: `log@${item.x.toFixed(1)},${item.z.toFixed(1)}`, tag: "bark", x: item.x, y: item.y + (ASSETS[item.asset]?.height ?? 0.5) * item.scale, z: item.z, normal: [0, 1, 0], tangent: [Math.cos(item.yaw), 0, -Math.sin(item.yaw)], size: SIZES.bark, zone: zoneAt(item.x, item.z)});
            }
        }
        // Worm holes and burrows in the ground that holds soil or burrows (a jittered 4 m grid).
        for (let gx = -this.half; gx < this.half; gx += 4) {
            for (let gz = -this.half; gz < this.half; gz += 4) {
                const x = gx + frac(Math.sin(gx * 12.9898 + gz * 78.233) * 43758.5453) * 3;
                const z = gz + frac(Math.sin(gx * 39.346 + gz * 11.135) * 43758.5453) * 3;
                const roll = frac(Math.sin(gx * 7.13 + gz * 3.71) * 43758.5453);
                const s = sampleWildGround(x, z);
                if (s.height < 0.08 || underWater(s) || s.ice > 0) continue;
                if (this.blocked(x, z, 0.3) || inRange(x, z)) continue;
                const ground = this.ground(x, z);
                // Worm holes in soil; burrows in the ground that holds them, and crabs' holes in the beach's sand and the
                // estuary's mud.
                if (ground.tags.includes("soil") && roll < 0.5) points.push({id: `worm${Math.round(x)},${Math.round(z)}`, tag: "worm_hole", x, y: ground.height + 0.005, z, normal: [0, 1, 0], tangent: [1, 0, 0], size: {min: 0.0001, max: SIZES.worm_hole.max}, zone: ground.zone});
                else if ((ground.tags.includes("burrows") || ground.tags.includes("mudflat") || ground.tags.includes("sandy_beach")) && roll < 0.8) points.push({id: `burrow${Math.round(x)},${Math.round(z)}`, tag: "burrow_entrance", x, y: ground.height + 0.01, z, normal: [0, 1, 0], tangent: [Math.cos(roll * 6.28), 0, Math.sin(roll * 6.28)], size: {min: 0.0001, max: SIZES.burrow_entrance.max}, zone: ground.zone});
            }
        }
        this.pointList = points;
        return points;
    }
}

const frac = (v: number) => v - Math.floor(v);

/** Steeper than this (behaviour-nav MAX_SLOPE, less a margin for the 2 m grid), only steep ground's tags hold. */
const STEEP = 0.82;
const STEEP_TAGS: ReadonlySet<MapTag> = new Set<MapTag>(["cliffs", "mountain_alpine", "sea_cliffs", "caves", "snow_ice", "open_sky"]);
/** Steeper than a mountain animal climbs (MOUNTAIN_SLOPE, less a margin): a sheer face, the flyers' sky only (its ledges are the rocks' attach points). */
const SHEER = 2.2;
const SHEER_TAGS: ReadonlySet<MapTag> = new Set<MapTag>(["open_sky"]);

let shared: WildMapSampler | null = null;

/** The wild island's map sampler (one per page). */
export function wildMapSampler(): ArkMapSampler {
    shared ??= new WildMapSampler();
    return shared;
}
