/**
 * The stub sampler (`sampler.ts`) over today's world: `world.ts`'s ground,
 * `decor.ts`'s trees, rocks and reeds, `micro-decor.ts`'s cottage, flowers,
 * leaves and lamps, and the canopy trees. The graphics lane replaces it with
 * its own (its terrain, its attach points); nothing else in the map changes.
 *
 * It draws nothing. Where a tag needs a fixture the scenery does not have
 * yet (the anemone, the cleaning station, caves, floes, termite mounds, dung
 * pats, logs, a compost heap), it names an anchor at a place the ground
 * suits; the graphics lane draws them (and may move them: the map follows).
 */

import {DecorObstacles, worldDecor, type DecorItem} from "@/ark-scene/decor";
import {canopyTrees} from "@/ark-scene/layers";
import {canopyTree, COTTAGE, DECOR_SINK, FLOWER_SHAPE, GARDEN_POND, LAMP, LEAF_LIFT, limbAt, microDecor, zoneLamp, MICRO_ZONES} from "@/ark-scene/micro-decor";
import {porchLight, surfacePoint, type MicroPlace} from "@/ark-scene/micro";
import {trunkOf} from "@/ark-scene/vegetation";
import {ARK_ZONES, type ArkZone} from "@/ark-scene/types";
import {arkWorld, coastRadius, hashString, LAKE, noise, onArkWorld, RIVER, riverDistance, sampleGround, seeded, TERRAIN_HALF, ZONE_SITES, zoneAt, type GroundSample} from "@/ark-scene/world";
import {wildMapSampler} from "@/ark-scene/islands/wild/map-sampler";
import type {ArkMapSampler, AttachPoint, AttachTag, GroundSurface, MapAnchor} from "@/ark-scene/map/sampler";
import {navGrid} from "@/ark-scene/behaviour-nav";
import {maskWalkable} from "@/ark-scene/map/walk-mask";
import {allAttachPoints} from "@/ark-scene/sampler";
import {SCENERY_TAG, sceneryMapPoint} from "@/ark-scene/map/scenery-points";
import {reservedAt, reservedNear} from "@/ark-scene/map/hamlet";
import {noHamlet, onHamletSwitch} from "@/ark-scene/no-hamlet";
import {inRock} from "@/ark-scene/map/rocks";
import {worldSampler as behaviourSampler} from "@/ark-scene/world-sampler";
import type {MapTag} from "@/ark-scene/map/tags";

const SIZES: Record<AttachTag, {min: number; max: number}> = {
    leaf: {min: 0.001, max: 0.12},
    branch: {min: 0.02, max: 0.6},
    bark: {min: 0.002, max: 0.45},
    flower_head: {min: 0.001, max: 0.07},
    rock_face: {min: 0.003, max: 0.6},
    tide_pool: {min: 0.003, max: 0.35},
    house_wall: {min: 0.002, max: 0.3},
    porch_light: {min: 0.003, max: 0.1},
    house_eave: {min: 0.002, max: 0.2},
    worm_hole: {min: 0.005, max: 0.35},
    burrow_entrance: {min: 0.03, max: 0.6},
    // (The stub draws none of these: the scenery interface's own sizes come with its points.)
    limb: {min: 0.15, max: 1.6},
    canopy_hang: {min: 0.05, max: 1.2},
    fence_post: {min: 0.01, max: 0.5},
    roof_edge: {min: 0.01, max: 0.6},
    ledge: {min: 0.02, max: 1},
    tree_hollow: {min: 0.02, max: 0.5}
};

function slope(x: number, z: number): number {
    const e = 0.8;
    const dx = sampleGround(x + e, z).height - sampleGround(x - e, z).height;
    const dz = sampleGround(x, z + e).height - sampleGround(x, z - e).height;
    return Math.hypot(dx, dz) / (2 * e);
}

/** How far along the river a point is (0 at the lake's outflow, 1 at its mouth). */
function riverAlong(x: number, z: number): number {
    let best = Infinity;
    let along = 0;
    let total = 0;
    const lengths: number[] = [];
    for (let i = 1; i < RIVER.length; i++) {
        const length = Math.hypot(RIVER[i][0] - RIVER[i - 1][0], RIVER[i][1] - RIVER[i - 1][1]);
        lengths.push(length);
        total += length;
    }
    let before = 0;
    for (let i = 1; i < RIVER.length; i++) {
        const [ax, az] = RIVER[i - 1];
        const [bx, bz] = RIVER[i];
        const dx = bx - ax;
        const dz = bz - az;
        const t = Math.min(Math.max(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0), 1);
        const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
        if (d < best) {
            best = d;
            along = (before + t * lengths[i - 1]) / total;
        }
        before += lengths[i - 1];
    }
    return along;
}

const MOUTH = RIVER[RIVER.length - 1];

function landZone(sample: GroundSample): ArkZone {
    return zoneAt(sample) as ArkZone;
}

class WorldSampler implements ArkMapSampler {
    readonly id = "world-stub-1";
    readonly half = TERRAIN_HALF - 4;
    private anchorList: MapAnchor[] | null = null;
    private pointList: AttachPoint[] | null = null;
    private coastCliff = new Map<number, number>();
    private building = false;
    private obstacles: DecorObstacles | null = null;
    private rocks: Map<string, DecorItem[]> | null = null;

    blocked(x: number, z: number, radius: number): boolean {
        this.obstacles ??= new DecorObstacles(worldDecor());
        // The trees, buildings and props as before; the rocks as they are drawn now (asset rocks: `rocks.ts`).
        return this.obstacles.blocked(x, z, radius) || inRock(x, z, radius);
    }

    covered(x: number, z: number): boolean {
        this.obstacles ??= new DecorObstacles(worldDecor());
        return this.obstacles.covers(x, z);
    }

    /** The hamlet's reserved plots (`hamlet.ts` reservedAt). */
    reserved(x: number, z: number): boolean {
        return reservedAt(x, z);
    }

    /**
     * The behaviour lane's walk grid (`behaviour-nav.ts`, from the graphics lane's scenery): where its walkers can walk.
     * From its prebuilt mask (`walk-mask.ts`, held to the grid by the map test), so placement never builds the behaviour
     * world at mount; a slope the mask does not hold asks the grid itself.
     */
    walkable(x: number, z: number, maxSlope: number): boolean {
        return maskWalkable(x, z, maxSlope) ?? navGrid(behaviourSampler()).walkable(x, z, maxSlope);
    }

    /** Beside a rock (a boulder, a stone): within a couple of metres of its side. */
    private byRock(x: number, z: number): boolean {
        if (!this.rocks) {
            this.rocks = new Map();
            for (const item of worldDecor()) {
                if (item.kind !== "rock" || item.scale < 0.5) continue;
                const key = `${Math.floor(item.x / 4)},${Math.floor(item.z / 4)}`;
                const list = this.rocks.get(key) ?? [];
                list.push(item);
                this.rocks.set(key, list);
            }
        }
        const cx = Math.floor(x / 4);
        const cz = Math.floor(z / 4);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                for (const item of this.rocks.get(`${cx + dx},${cz + dz}`) ?? []) if (Math.hypot(item.x - x, item.z - z) < 0.9 * item.scale + 1.8) return true;
            }
        }
        return false;
    }

    /** How much of a cliff the coast is at this bearing (for kelp and tide pools offshore of it). */
    private cliffAt(theta: number): number {
        const key = Math.round(theta * 40);
        let cliff = this.coastCliff.get(key);
        if (cliff === undefined) {
            const t = key / 40;
            const r = coastRadius(t) - 3;
            cliff = sampleGround(Math.cos(t) * r, Math.sin(t) * r).cliff;
            this.coastCliff.set(key, cliff);
        }
        return cliff;
    }

    private near(x: number, z: number, name: string): MapAnchor | null {
        if (this.building) return null;
        for (const anchor of this.anchors()) if (anchor.name === name && Math.hypot(anchor.x - x, anchor.z - z) <= anchor.radius) return anchor;
        return null;
    }

    ground(x: number, z: number): GroundSurface {
        const s = sampleGround(x, z);
        const w = s.weights;
        const tags: MapTag[] = [];
        const add = (...list: MapTag[]) => tags.push(...list);
        const lakeDistance = Math.hypot(x - LAKE.x, z - LAKE.z);
        const riverWidth = 2 + 1.2 * Math.min(Math.max((z + 4) / 94, 0), 1);
        const inLake = lakeDistance < LAKE.r + 0.6 && s.height < 0.02;
        const inGardenPond = !noHamlet() && Math.hypot(x - GARDEN_POND.x, z - GARDEN_POND.z) < GARDEN_POND.radius * 0.85;
        const inRiver = s.river < riverWidth + 0.6 && s.height < 0.02 && s.inland > -2;
        const mouth = Math.hypot(x - MOUTH[0], z - MOUTH[1]);
        const estuary = s.river < 11 && s.inland < 16 && s.inland > -10 && mouth < 40;
        const height = s.height;
        let water: GroundSurface["water"] = null;
        let zone: ArkZone = landZone(s);
        if (inGardenPond) {
            // The garden pond's water stands above the ground round it.
            return {height: GARDEN_POND.y - 0.5, water: "fresh", depth: 0.5, zone: "farm_garden", tags: ["garden_pond", "pond"]};
        }
        if (inLake || inRiver || (height < 0 && (w.wetland ?? 0) > 0.35 && s.inland > 4)) {
            water = "fresh";
            if (inLake) add("lake");
            // The lake's shallow margin is a pond's water too (lily pads, newts, pond snails).
            if (inLake && height > -1.1) add("pond");
            if (inRiver) {
                add("stream_river");
                if (riverAlong(x, z) < 0.3) add("waterfall_rapids");
            }
            if (!inLake && !inRiver) add("pond", "marsh_reeds");
            if (inLake && lakeDistance > LAKE.r - 2.5) add("marsh_reeds");
            if (estuary) add("estuary", "mangrove");
        } else if (height < 0) {
            water = "sea";
            const depth = -height;
            zone = s.reef > 0.3 ? "coral_reef" : s.inland > -16 ? "seashore" : "open_ocean";
            if (s.inland > -18 && depth < 5) add("coastal_shallows");
            if (depth > 0.6 && depth < 10) add("seabed");
            if (s.reef > 0.35 && depth > 0.5 && depth < 7) add("coral_reef");
            if (depth < 3.5 && s.inland > -18 && ((s.reef > 0.12 && s.reef < 0.55) || (w.seashore ?? 0) > 0.4)) add("seagrass");
            const theta = Math.atan2(z, x);
            if (depth > 2 && depth < 9 && s.inland > -22 && this.cliffAt(theta) > 0.3) add("kelp");
            // The open water is the ring round the island the camera sees (out to 36 m off the coast).
            const ring = s.inland > -36;
            if (ring && s.inland < -8 && depth > 3) add("open_ocean", "attached_to_large");
            if (ring && depth > 2.5) add("sea_surface");
            if (ring && depth > 7.5) add("deep_water");
            if (estuary && depth < 2) add("estuary", "mudflat");
            if (depth < 1 && s.inland > -3 && this.cliffAt(theta) > 0.25) add("rocky_shore");
            if (this.near(x, z, "floe")) add("sea_ice");
            if (this.near(x, z, "anemone")) add("anemone");
            if (this.near(x, z, "cleaning_station")) add("cleaner_station");
        } else {
            // Dry ground.
            const forest = (w.woodland ?? 0) + (w.rainforest ?? 0);
            const top = Math.max(...Object.values(w));
            // The slope only where the ground can be steep (the mountain, high ground, cliffs): elsewhere it is gentle.
            const grade = height > 3 || (w.mountains ?? 0) > 0.2 || s.cliff > 0.2 ? slope(x, z) : 0;
            const sandy = s.land < 0.95 && height < 1.8 && s.cliff < 0.3 && (w.polar ?? 0) < 0.3 && s.inland < 12;
            const farm = (w.farm_garden ?? 0) > 0.35;
            const cottage = Math.hypot(x - COTTAGE.x, z - COTTAGE.z);
            if ((w.grassland ?? 0) > 0.35) add("grassland", "on_grazers");
            if (((w.grassland ?? 0) > 0.3 || farm || ((w.mountains ?? 0) > 0.3 && height < 12)) && noise(x * 0.09 + 31, z * 0.09 - 7) > 0.55) add("flower_meadow");
            if (top < 0.62 && forest + (w.grassland ?? 0) + (w.desert ?? 0) + (w.mountains ?? 0) > 0.7) add("scrub");
            if ((w.desert ?? 0) > 0.3 && noise(x * 0.12 - 5, z * 0.12) > 0.62) add("scrub");
            if (forest > 0.45) add("forest_floor");
            if (forest > 0.45 && this.near(x, z, "log")) add("logs_deadwood", "carcass");
            if (!sandy && height < 16 && (w.desert ?? 0) < 0.5 && (w.polar ?? 0) < 0.4 && grade < 0.9) add("soil");
            if (height < 20 && (w.wetland ?? 0) < 0.5 && grade < 0.9 && s.inland > 2) add("burrows");
            if (this.near(x, z, "termite_mound")) add("termite_ant_mounds");
            if (this.near(x, z, "dung_pat")) add("dung");
            if (grade > 0.75 && ((w.mountains ?? 0) > 0.3 || height > 6)) add("cliffs");
            if (this.near(x, z, "cave")) add("caves");
            if ((w.mountains ?? 0) > 0.35) add("mountain_alpine");
            if (height > 16 || (w.polar ?? 0) > 0.5) add("snow_ice");
            if ((w.polar ?? 0) > 0.35 && height < 12) add("tundra");
            if ((w.desert ?? 0) > 0.35) add("desert_sand");
            if (sandy) add("sandy_beach");
            if (s.cliff > 0.25 && s.inland > -3 && s.inland < 6 && height < 3) add("rocky_shore");
            if (s.cliff > 0.35 && s.inland >= 0 && s.inland < 12 && height > 1) add("sea_cliffs");
            if (estuary && height < 1.2) add("estuary", "mangrove", "mudflat");
            if (estuary && height < 0.6) add("salt_lake");
            if (this.byRock(x, z)) add("rocks_boulders");
            if (s.river < riverWidth + 3.5 && s.inland > 2) add("stream_river");
            if (s.river < riverWidth + 3.5 && s.inland > 2 && riverAlong(x, z) < 0.3) add("waterfall_rapids");
            if (lakeDistance < LAKE.r + 3) add("lake", "marsh_reeds");
            if ((w.wetland ?? 0) > 0.35) add("marsh_reeds");
            if ((w.wetland ?? 0) > 0.35 && height < 0.35) add("pond");
            if (noHamlet()) {
                // Islands mode (`no-hamlet.ts`): nothing built; Home's district is meadow and grassland, no homestead.
                if (farm) add("grassland");
            } else {
                if (Math.hypot(x - GARDEN_POND.x, z - GARDEN_POND.z) < GARDEN_POND.radius + 0.6) add("garden_pond");
                // The house and the ground round it (its walls, its porch, the yard where the pets are).
                if (Math.abs(x - COTTAGE.x) < COTTAGE.width / 2 + 4.5 && Math.abs(z - COTTAGE.z) < COTTAGE.depth / 2 + COTTAGE.porch.depth + 4.5) add("house");
                if (farm && cottage < 16) add("garden");
                if (this.near(x, z, "compost")) add("compost");
                if (farm) add("farm_barn", "on_hosts");
                if (farm && cottage >= 10) add("town_park");
            }
            add("open_sky");
        }
        return {height, water, depth: Math.max(-height, 0), zone, tags};
    }

    anchors(): readonly MapAnchor[] {
        if (this.anchorList) return this.anchorList;
        this.building = true;
        const list: MapAnchor[] = [];
        const at = (name: string, x: number, z: number, radius: number, tags: MapTag[]) => {
            const s = sampleGround(x, z);
            list.push({name, x, y: Math.max(s.height, name === "floe" ? 0.25 : s.height), z, radius, zone: s.height < 0 ? (s.reef > 0.3 ? "coral_reef" : "open_ocean") : landZone(s), tags});
        };
        // The canopy trees (`micro-decor.ts`): branches, leaves and bark.
        const seen = new Set<DecorItem>();
        for (const zone of ARK_ZONES) {
            for (const host of canopyTrees(zone)) {
                if (seen.has(host.item)) continue;
                seen.add(host.item);
                list.push({name: "canopy_tree", x: host.item.x, y: host.item.y, z: host.item.z, radius: 3, zone: host.zone, tags: ["canopy", "trunks_bark", "leaves", "host_nests", "bamboo"]});
            }
        }
        // (Islands mode, `no-hamlet.ts`: no cottage, garden pond or compost heap.)
        if (!noHamlet()) {
            list.push({name: "cottage", x: COTTAGE.x, y: COTTAGE.floor, z: COTTAGE.z, radius: 4, zone: "farm_garden", tags: ["house"]});
            list.push({name: "garden_pond", x: GARDEN_POND.x, y: GARDEN_POND.y, z: GARDEN_POND.z, radius: GARDEN_POND.radius, zone: "farm_garden", tags: ["garden_pond", "pond"]});
        }
        // Fixtures the scenery does not draw yet: placed where the ground suits, from a fixed seed.
        const search = (name: string, count: number, radius: number, tags: MapTag[], seed: number, ok: (s: GroundSample, x: number, z: number) => boolean) => {
            const random = seeded(seed);
            let found = 0;
            for (let i = 0; i < 6000 && found < count; i++) {
                const x = (random() * 2 - 1) * this.half;
                const z = (random() * 2 - 1) * this.half;
                const s = sampleGround(x, z);
                // (Never on the hamlet's reserved plots: hamlet.ts.)
                if (!ok(s, x, z) || reservedAt(x, z)) continue;
                if (list.some((anchor) => anchor.name === name && Math.hypot(anchor.x - x, anchor.z - z) < radius * 6)) continue;
                at(name, x, z, radius, tags);
                found++;
            }
        };
        const reef = ZONE_SITES.coral_reef;
        at("anemone", reef.x - 3, reef.z - 2, 1.6, ["anemone", "coral_reef"]);
        at("cleaning_station", reef.x + 4, reef.z + 3, 2, ["cleaner_station", "coral_reef"]);
        search("cave", 3, 2.5, ["caves"], 4101, (s, x, z) => (s.weights.mountains ?? 0) > 0.45 && s.height > 4 && s.height < 14 && slope(x, z) > 0.8);
        search("floe", 5, 3, ["sea_ice"], 4102, (s) => s.height < -1.5 && s.inland > -22 && (s.weights.polar ?? 0) > 0.3);
        search("termite_mound", 4, 1.6, ["termite_ant_mounds"], 4103, (s, x, z) => ((s.weights.grassland ?? 0) > 0.5 || (s.weights.desert ?? 0) > 0.5) && s.height > 0.4 && riverDistance(x, z) > 6);
        search("dung_pat", 6, 1.2, ["dung"], 4104, (s, x, z) => ((s.weights.grassland ?? 0) > 0.5 || (s.weights.farm_garden ?? 0) > 0.5) && s.height > 0.4 && riverDistance(x, z) > 5);
        search("log", 8, 2, ["logs_deadwood", "carcass"], 4105, (s) => (s.weights.woodland ?? 0) + (s.weights.rainforest ?? 0) > 0.55 && s.height > 0.5);
        if (!noHamlet()) at("compost", COTTAGE.x - 6, COTTAGE.z - 5, 1.4, ["compost", "garden"]);
        this.building = false;
        this.anchorList = list;
        return list;
    }

    attachPoints(): readonly AttachPoint[] {
        if (this.pointList) return this.pointList;
        const points: AttachPoint[] = [];
        const push = (tag: AttachTag, key: string, x: number, y: number, z: number, normal: [number, number, number], tangent: [number, number, number], zone?: ArkZone) => {
            // Nothing on or by the hamlet's reserved plots (hamlet.ts): its residents' alone (a cluster spreads round its point).
            if (reservedNear(x, z, 1.2)) return;
            points.push({id: `${tag}:${key}`, tag, x, y, z, normal, tangent, size: SIZES[tag], zone: zone ?? landZone(sampleGround(x, z))});
        };
        // The graphics lane's attach points (`sampler.ts`, docs/ark/graphics-interface.md): leaves round every tree's crown,
        // branches under it, bark on the trunks, the canopy trees' limbs (on top: branches; the trunk: bark), flower heads,
        // rock faces on the drawn rock, tide pools, the cottage's walls and eaves, the porch light and the lamps, the leaf
        // litter, worm holes and burrows. Their ids and normals as they are, a heading from their yaw, and their largest body
        // (any smaller one fits: a 2 mm spider on a wall).
        for (const point of allAttachPoints()) {
            if (!SCENERY_TAG[point.tag]) continue;
            // Nothing on or by the hamlet's reserved plots (their fences and gardens come and go with the plots: hamlet.ts).
            if (reservedNear(point.position.x, point.position.z, 1.2)) continue;
            const mapped = sceneryMapPoint(point, (x, z) => landZone(sampleGround(x, z)));
            if (mapped) points.push(mapped);
        }
        // What the scenery interface does not offer yet: the reeds' and shrubs' tops (a reed warbler's, a dragonfly's perch).
        const decor = worldDecor();
        decor.forEach((item, i) => {
            if ((item.kind === "reed" || item.kind === "shrub") && i % 2 === 0) {
                const top = item.y - DECOR_SINK + (item.kind === "reed" ? 1.1 : 0.7) * item.scale;
                push("leaf", `${item.kind}${i}`, item.x, top, item.z, [0, 1, 0], [Math.cos(item.rotation), 0, Math.sin(item.rotation)]);
            }
        });
        // The micro corners' props (`micro-decor.ts`, drawn by micro-scene): their flower heads and fallen leaves.
        for (const [i, item] of Array.from(microDecor().entries())) {
            if (item.kind === "flower") {
                const stem = FLOWER_SHAPE.stem[item.variant % 3] * item.scale;
                const y = item.y - DECOR_SINK + stem + FLOWER_SHAPE.head * FLOWER_SHAPE.top[item.variant % 3] * item.scale;
                push("flower_head", `flower${i}`, item.x, y, item.z, [0, 1, 0], [Math.cos(item.rotation), 0, Math.sin(item.rotation)], item.zone);
            } else if (item.kind === "leaf" && i % 2 === 0) {
                push("leaf", `litter${i}`, item.x, item.y + LEAF_LIFT + 0.004, item.z, [0, 1, 0], [Math.cos(item.rotation), 0, Math.sin(item.rotation)], item.zone);
            }
        }
        // Worm holes and burrow entrances in the ground that holds soil or burrows (a jittered grid).
        const random = seeded(7707);
        for (let gx = -this.half; gx < this.half; gx += 4) {
            for (let gz = -this.half; gz < this.half; gz += 4) {
                const x = gx + random() * 3;
                const z = gz + random() * 3;
                const roll = random();
                const s = sampleGround(x, z);
                if (s.height < 0.3 || s.land < 0.8) continue;
                const ground = this.ground(x, z);
                const blocked = decor.some((item) => item.kind !== "leaf" && item.kind !== "flower" && Math.abs(item.x - x) < 1.2 && Math.abs(item.z - z) < 1.2);
                if (blocked) continue;
                if (inRock(x, z, 0.2)) continue;
                if (ground.tags.includes("soil") && roll < 0.5) push("worm_hole", `worm${Math.round(x)},${Math.round(z)}`, x, ground.height + 0.005, z, [0, 1, 0], [1, 0, 0], ground.zone);
                else if (ground.tags.includes("burrows") && roll < 0.8) push("burrow_entrance", `burrow${Math.round(x)},${Math.round(z)}`, x, ground.height + 0.01, z, [0, 1, 0], [Math.cos(roll * 6.28), 0, Math.sin(roll * 6.28)], ground.zone);
            }
        }
        this.pointList = points;
        return points;
    }
}

let shared: WorldSampler | null = null;
// Islands mode flips (`no-hamlet.ts`): the map's sampler is the other world's.
onHamletSwitch(() => {
    shared = null;
});
onArkWorld(() => {
    shared = null;
});

/** The stub sampler over today's world (one per page); on the v2 world (Part C, P4), the bigger wild island's own. */
export function worldSampler(): ArkMapSampler {
    if (arkWorld() === "v2") return wildMapSampler();
    shared ??= new WorldSampler();
    return shared;
}
