/**
 * The Ark's ground and scenery as other lanes see it (graphics pass): one
 * stable interface for the map's spawn rules (`ark-map`), the behaviour
 * system (`ark-behaviour`), the props lane and the liveliness lane, so they
 * can place things on whatever terrain and scenery the graphics pass draws.
 *
 *   surfaceAt(x, z)      height, normal, what the ground is made of there, wetness, water depth
 *   place(name)          named anchor places ("beach", "house", "reef", …), never raw coordinates
 *   attachPoints(query)  seeded points on the scenery where small animals sit, cling, crawl and hide,
 *                        tagged by microhabitat (the tags of microhabitats.json and layers.json); on the
 *                        trees they lie on the drawn leaves, bark and branches (`tree-assets.ts`)
 *   attachPointAt(point, time, wind)  where a point is now, moved by its tree's wind as the shader moves the leaf
 *
 * Pure (no three.js scene, no DOM) and deterministic: every viewer gets the
 * same points. The graphics pass keeps these signatures stable; what it
 * changes is underneath (the terrain, the trees, the house).
 */

import {COTTAGE, DECOR_SINK, FLOWER_SHAPE, GARDEN_POND, canopyTree, limbAt, microCorner, zoneLamp, LAMP} from "@/ark-scene/micro-decor";
import {IcosahedronGeometry, Quaternion, Vector3, type BufferGeometry} from "three";
import {mergeVertices} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {forestFill, rockRadius, rockSquash, worldDecor, type DecorItem, type FillItem} from "@/ark-scene/decor";
import {rockAssetFor, rockAttachPoints, rockFaceToward} from "@/ark-scene/rock-assets";
import {floorPlacements} from "@/ark-scene/floor-assets";
import {defaultHomePlots, fencePostTops as homeFencePosts, type HomePlot} from "@/ark-scene/props/home-layout";
import {snowCover} from "@/ark-scene/snow";
import {floorLogTops, treeAttachPoints, treeSway, type TreeAttach, type TreeAttachTag, type TreeWind} from "@/ark-scene/tree-assets";
import {FRESH_LEVEL, freshFrom} from "@/ark-scene/water-level";
import {BEACH_INSET, LAKE, RIVER, VISITOR_LANDING, ZONE_SITES, coastRadius, fbm, hashString, regionCentre, sampleGround, seeded, smoothstep, zoneAt, type GroundSample} from "@/ark-scene/world";
import type {ArkZone} from "@/ark-scene/types";

export type Vec3 = {x: number; y: number; z: number};

// MARK: - Surface

/** What the ground is made of: the ground shader's texture layers, plus water. */
export const SURFACE_KINDS = ["grass", "forest_floor", "soil", "sand", "wet_sand", "rock", "mud", "snow", "tilled", "seabed", "lakebed"] as const;
export type SurfaceKind = typeof SURFACE_KINDS[number];

/** The weather and tide the scene is drawn with (the island clock, `src/lib/ark-clock.ts`, sets them). */
export type ArkEnvironment = {seaLevel: number; wetness: number; snow: number; wind: number; storm: number};
export const CALM: ArkEnvironment = {seaLevel: 0, wetness: 0, snow: 0, wind: 0.35, storm: 0};

export type ArkSurface = {
    height: number;
    normal: Vec3;
    /**
     * The material with the most weight here, and all of them (summing to about 1). `snow` (since 2026-11-11, snow.ts):
     * `surface` is "snow" only where the terrain shader draws snow whatever its per-pixel noise does, and never
     * where it may not; `weights.snow` is the expected drawn cover.
     */
    surface: SurfaceKind;
    weights: Partial<Record<SurfaceKind, number>>;
    /** 0 dry … 1 soaked: the waterline, mud, banks, and the weather's own wetness (for footprints, sheen). */
    wetness: number;
    /** Metres of water over the ground (0 on dry land), at the sea level given. */
    waterDepth: number;
    zone: ArkZone;
    /** 0…1 how much a sea cliff this is. */
    cliff: number;
};

const EPS = 0.35;

export function groundNormal(x: number, z: number): Vec3 {
    const hx = sampleGround(x + EPS, z).height - sampleGround(x - EPS, z).height;
    const hz = sampleGround(x, z + EPS).height - sampleGround(x, z - EPS).height;
    const nx = -hx;
    const ny = 2 * EPS;
    const nz = -hz;
    const length = Math.hypot(nx, ny, nz);
    return {x: nx / length, y: ny / length, z: nz / length};
}

export function surfaceAt(x: number, z: number, environment: ArkEnvironment = CALM): ArkSurface {
    return surfaceFrom(sampleGround(x, z), x, z, environment);
}

/** `surfaceAt` from the ground's sample there (already taken). */
function surfaceFrom(sample: GroundSample, x: number, z: number, environment: ArkEnvironment): ArkSurface {
    const normal = groundNormal(x, z);
    const w = sample.weights;
    const zone = zoneAt(sample) as ArkZone;
    const slope = 1 - normal.y;
    const height = sample.height;
    // The lake and the river keep their own level; the sea rises and falls with the tide (batch 5: water-level.ts).
    const level = freshFrom(sample, x, z) >= 0.5 ? FRESH_LEVEL : environment.seaLevel;
    const waterDepth = Math.max(level - height, 0);
    const weights: Partial<Record<SurfaceKind, number>> = {};
    let cover = {mean: 0, sure: 0};
    const put = (kind: SurfaceKind, value: number) => {
        if (value > 0.001) weights[kind] = (weights[kind] ?? 0) + value;
    };
    if (height < level - 0.05) {
        const fresh = Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 1 || (sample.river < 4 && sample.inland > 4);
        put(fresh ? "lakebed" : "seabed", 1);
    } else {
        // Snow as the terrain shader draws it (snow.ts): the ice's own layer, and the mountain's above its snow line
        // (27 m, lower with the weather's snow cover), held on all but the steepest faces.
        cover = snowCover(height, slope, (w.polar ?? 0) * smoothstep(0.3, 1, sample.land), environment.snow);
        const snow = cover.mean;
        const rock = smoothstep(0.22, 0.42, slope) * (1 - snow);
        const beach = (1 - smoothstep(0.45, 1, sample.land)) * (1 - (w.polar ?? 0)) * (1 - sample.cliff);
        const sand = Math.min(1, beach + (w.desert ?? 0) * 0.9 + (w.seashore ?? 0) * 0.7) * (1 - rock) * (1 - snow);
        const wetSand = (1 - smoothstep(environment.seaLevel, environment.seaLevel + 0.55, height)) * sand;
        const forest = ((w.rainforest ?? 0) + (w.woodland ?? 0)) * (1 - sand) * (1 - rock) * (1 - snow);
        const mud = Math.max((w.wetland ?? 0) * 0.6, smoothstep(6.5, 2.5, sample.river) * (sample.inland > 3 ? 1 : 0)) * (1 - sand) * (1 - rock);
        const tilled = (w.farm_garden ?? 0) * smoothstep(0.6, 1, sample.land) * 0.5 * (1 - rock);
        const soil = ((w.grassland ?? 0) * 0.5 + (w.desert ?? 0) * 0.3) * smoothstep(0.6, 0.78, fbm(x * 0.11 + 5, z * 0.11)) * (1 - sand);
        put("snow", snow);
        put("rock", rock);
        put("wet_sand", wetSand);
        put("sand", sand - wetSand);
        put("forest_floor", forest * 0.7);
        put("mud", mud);
        put("tilled", tilled);
        put("soil", soil);
        const used = Object.values(weights).reduce((sum, value) => sum + (value ?? 0), 0);
        put("grass", Math.max(1 - used, 0));
    }
    // The surface is snow only where the shader draws snow whatever its noise does; never where it may not.
    let surface: SurfaceKind = "grass";
    let best = -1;
    for (const [kind, value] of Object.entries(weights) as Array<[SurfaceKind, number]>) {
        if (kind === "snow" || value <= best) continue;
        best = value;
        surface = kind;
    }
    if (cover.sure >= 0.5) surface = "snow";
    const wet = Math.max(
        1 - smoothstep(environment.seaLevel, environment.seaLevel + 0.6, height),
        (weights.mud ?? 0) * 0.8,
        environment.wetness * (surface === "sand" ? 0.6 : 1)
    );
    return {height, normal, surface, weights, wetness: Math.min(Math.max(wet, 0), 1), waterDepth, zone, cliff: sample.cliff};
}

// MARK: - Named places

export const PLACE_NAMES = [
    "island_middle", "beach", "shore_rocks", "tide_pools", "visitor_landing", "forest_floor", "rainforest", "woodland",
    "house", "house_porch_light", "garden_pond", "fields", "lake", "river_source", "river_mouth", "wetland", "grassland",
    "desert", "mountain", "mountain_peak", "cold_cove", "reef", "open_ocean",
    // Added 2026-11-11 (props lane): the cave and its bat roost.
    "cave"
] as const;
export type PlaceName = typeof PLACE_NAMES[number];
export type Place = {
    name: PlaceName;
    x: number;
    y: number;
    z: number;
    /** How far the place reaches (m). */
    radius: number;
    /** Places that face a way (the cave's mouth): the way out, radians about y (three's: local +z → (sin, cos)). */
    facing?: number;
};

/**
 * The cave: a rock outcrop on flat, open ground in the cold, at the ice's edge below the mountain, its mouth toward
 * the island's middle (the props lane builds the outcrop and the chamber). Found by the props lane's search (ground
 * within 0.3 m over 4.5 m round it, nothing of the decor or the forest fill within 6.5 m), kept fixed so nothing
 * searches at startup; `ark-attach.test` checks it still holds.
 */
export const CAVE_SITE = {x: 45.5, z: -45.5};

const placeCache = new Map<PlaceName, Place>();

function on(name: PlaceName, x: number, z: number, radius: number, y?: number): Place {
    return {name, x, y: y ?? sampleGround(x, z).height, z, radius};
}

/** A named place on the current map. The map build keeps these names; their positions follow the map. */
export function place(name: PlaceName): Place {
    const cached = placeCache.get(name);
    if (cached) return cached;
    let result: Place;
    switch (name) {
        case "island_middle":
            result = on(name, 0, 0, 90);
            break;
        case "beach":
            result = on(name, ZONE_SITES.seashore.x, ZONE_SITES.seashore.z, 14);
            break;
        case "shore_rocks":
        case "tide_pools": {
            const rocks = shoreRocks();
            const from = ZONE_SITES.seashore;
            let best = rocks[0] ?? {x: from.x, z: from.z, y: 0, scale: 1};
            let score = -Infinity;
            for (const rock of rocks) {
                const near = rocks.filter((other) => Math.hypot(other.x - rock.x, other.z - rock.z) < 7).reduce((sum, other) => sum + other.scale, 0);
                const value = near * 3 - Math.hypot(rock.x - from.x, rock.z - from.z) * 0.08;
                if (value > score) {
                    score = value;
                    best = rock;
                }
            }
            result = on(name, best.x, best.z, 7);
            break;
        }
        case "visitor_landing":
            result = on(name, VISITOR_LANDING.foot.x, VISITOR_LANDING.foot.z, 6);
            break;
        case "forest_floor": {
            const corner = microCorner("woodland");
            result = on(name, corner.x, corner.z, 6);
            break;
        }
        case "rainforest":
        case "woodland":
        case "wetland":
        case "grassland":
        case "desert":
            result = on(name, ZONE_SITES[name].x, ZONE_SITES[name].z, ZONE_SITES[name].clearing + 10);
            break;
        case "house":
            result = on(name, COTTAGE.x, COTTAGE.z, 6, COTTAGE.floor);
            break;
        case "house_porch_light":
            result = {name, x: COTTAGE.x + COTTAGE.light.x, y: COTTAGE.floor + COTTAGE.light.y, z: COTTAGE.z + COTTAGE.light.z, radius: 0.5};
            break;
        case "garden_pond":
            result = {name, x: GARDEN_POND.x, y: GARDEN_POND.y, z: GARDEN_POND.z, radius: GARDEN_POND.radius};
            break;
        case "fields":
            result = on(name, ZONE_SITES.farm_garden.x, ZONE_SITES.farm_garden.z, 18);
            break;
        case "lake":
            result = {name, x: LAKE.x, y: 0, z: LAKE.z, radius: LAKE.r};
            break;
        case "river_source":
            result = on(name, RIVER[1][0], RIVER[1][1], 5);
            break;
        case "river_mouth": {
            const [x, z] = RIVER[RIVER.length - 2];
            result = on(name, x, z, 6);
            break;
        }
        case "mountain":
            result = on(name, ZONE_SITES.mountains.x, ZONE_SITES.mountains.z, 30);
            break;
        case "mountain_peak": {
            const site = ZONE_SITES.mountains;
            let peak = {x: site.x, z: site.z, y: sampleGround(site.x, site.z).height};
            for (let x = site.x - 30; x <= site.x + 30; x += 2) {
                for (let z = site.z - 36; z <= site.z + 24; z += 2) {
                    const y = sampleGround(x, z).height;
                    if (y > peak.y) peak = {x, z, y};
                }
            }
            result = {name, x: peak.x, y: peak.y, z: peak.z, radius: 8};
            break;
        }
        case "cold_cove":
            result = on(name, ZONE_SITES.polar.x, ZONE_SITES.polar.z, 16);
            break;
        case "reef":
            result = on(name, ZONE_SITES.coral_reef.x, ZONE_SITES.coral_reef.z, 14);
            break;
        case "open_ocean": {
            const centre = regionCentre("ocean");
            result = {name, x: centre.x, y: 0, z: centre.z, radius: centre.radius};
            break;
        }
        case "cave": {
            // Its floor: a little over the highest ground round the site (as the props lane seats the outcrop).
            const {x, z} = CAVE_SITE;
            let floor = -Infinity;
            for (let a = 0; a < 12; a++) for (const r of [0, 2.5, 4.5]) floor = Math.max(floor, sampleGround(x + Math.cos(a * 0.5236) * r, z + Math.sin(a * 0.5236) * r).height);
            result = {name, x, y: floor + 0.04, z, radius: 4.5, facing: Math.atan2(-x, -z)};
            break;
        }
    }
    placeCache.set(name, result);
    return result;
}

function shoreRocks(): Array<{x: number; y: number; z: number; scale: number}> {
    const beach = ZONE_SITES.seashore;
    return worldDecor().filter((item) => item.kind === "rock" && item.y < 0.2 && item.y > -0.9 && sampleGround(item.x, item.z).cliff < 0.25
        && Math.hypot(item.x - beach.x, item.z - beach.z) < 75 && zoneAt(sampleGround(item.x, item.z)) !== "polar");
}

// MARK: - Attach points

/**
 * Where small animals attach. `spot` is the microhabitat tag of
 * microhabitats.json (house, lamp, bark, flowers, rocks, leaf_litter,
 * pond_surface) or layers.json's canopy/burrow; `tag` says the exact surface.
 */
export const ATTACH_TAGS = [
    "leaf", "branch", "bark", "flower_head", "rock_face", "tide_pool", "house_wall", "house_eave", "porch_light", "lamp",
    "leaf_litter", "worm_hole", "burrow", "pond_surface", "canopy_perch", "canopy_climb", "canopy_hang",
    // Added 2026-11-11 (props lane): cliff and rock shelves; the drawn hollows in the asset trees' trunks.
    "ledge", "tree_hollow",
    // Added 2026-11-11 (map lane): fence posts and roof edges (perches, basking spots); thick limbs for large climbers.
    "fence_post", "roof_edge", "limb",
    // Added 2026-11-11 (graphics batch 6's forest floor): the tops of fallen logs.
    "log"
] as const;
export type AttachTag = typeof ATTACH_TAGS[number];
export type AttachSpot = "house" | "lamp" | "bark" | "flowers" | "rocks" | "leaf_litter" | "pond_surface" | "canopy" | "burrow" | "spawn";

export const TAG_SPOT: Record<AttachTag, AttachSpot> = {
    leaf: "canopy", branch: "canopy", bark: "bark", flower_head: "flowers", rock_face: "rocks", tide_pool: "rocks",
    house_wall: "house", house_eave: "house", porch_light: "lamp", lamp: "lamp", leaf_litter: "leaf_litter", worm_hole: "burrow",
    burrow: "burrow", pond_surface: "pond_surface", canopy_perch: "canopy", canopy_climb: "canopy", canopy_hang: "canopy",
    ledge: "rocks", tree_hollow: "bark", fence_post: "house", roof_edge: "house", limb: "canopy", log: "bark"
};

export type AttachPoint = {
    /** Stable across viewers and sessions while the scenery is the same: `<tag>:<host>:<n>`. */
    id: string;
    tag: AttachTag;
    spot: AttachSpot;
    position: Vec3;
    /** Out of the surface (an animal's up). */
    normal: Vec3;
    /** Its heading round the normal (radians; 0 = along +z projected onto the surface). */
    yaw: number;
    /** Body lengths it suits, metres. */
    size: [number, number];
    zone: ArkZone | null;
    /** What it is on: a decor item's kind and index, the house, the ground. */
    host: string;
    /** The host's kind: a decor kind ("broadleaf", "rock", "flower"…), "house", "lamp", "pond", "lake" or "ground". */
    hostKind: string;
    /** Trees only (optional, added 2026-11-11): the asset tree it is on ("oak-a"). */
    asset?: string;
    /** Trees only: along the surface (a leaf's midrib base → tip, up the trunk, along the branch); `yaw` turns +z onto it. */
    forward?: Vec3;
    /** Trees only: 0…1, the share of sight lines within 40° of out-and-up that leave its tree unblocked (seen from outside). */
    open?: number;
    /** Tree leaves only: on a single leaf ("blade") or on the crown's leaf mass ("clump"). */
    leaf?: "blade" | "clump";
    /** Tree hollows only: how deep the hole runs into the trunk (m). */
    depth?: number;
    /** Limbs (`limb`, `canopy_perch`, `canopy_hang`): the limb's radius there (m). */
    radius?: number;
    /** `limb`: about what the limb holds there (kg; `limbLoad`). */
    load?: number;
    /** `limb`: clear room above it, to the tree's wood (m, up to 3). */
    clearAbove?: number;
    /** `limb`, `canopy_hang`: the clear drop below it, to anything of its tree or the ground (m). */
    clearBelow?: number;
    /** Trees only: how its tree's wind moves it (`attachPointAt`); points without it hold still. */
    wind?: TreeWind;
};

const SIZE: Record<AttachTag, [number, number]> = {
    leaf: [0.004, 0.08], branch: [0.01, 0.6], bark: [0.004, 0.35], flower_head: [0.004, 0.06], rock_face: [0.004, 0.45],
    tide_pool: [0.008, 0.3], house_wall: [0.004, 0.25], house_eave: [0.004, 0.2], porch_light: [0.004, 0.12], lamp: [0.004, 0.12],
    leaf_litter: [0.004, 0.35], worm_hole: [0.02, 0.4], burrow: [0.05, 0.7], pond_surface: [0.008, 0.4],
    canopy_perch: [0.05, 0.9], canopy_climb: [0.05, 1.4], canopy_hang: [0.1, 1.2],
    ledge: [0.05, 1.0], tree_hollow: [0.02, 0.35], fence_post: [0.01, 0.45], roof_edge: [0.01, 0.6], limb: [0.15, 1.6], log: [0.005, 0.8]
};

let attachCache: AttachPoint[] | null = null;

/** Forget the built points (tests and the golden page's timing only: the next call builds them again). */
export function resetAttachPoints(): void {
    attachCache = null;
    building = null;
    pending = null;
    generation++;
}

/** The home area's plots the props lane's fences stand on (null: today's cottage and barn, props/home-layout.ts). */
let homePlots: HomePlot[] | null = null;

/**
 * Give the sampler the home area's plots (the map lane's `homePlots()`; props/index.ts setHomePlots passes them on),
 * so the `fence_post` points stand on the fences the props draw there. Points already built are built again on next
 * use. Pass null for today's default (the cottage's plot and the barn's smallholding).
 */
export function setAttachHomePlots(plots: HomePlot[] | null): void {
    homePlots = plots;
    resetAttachPoints();
}

function rotateY(x: number, z: number, angle: number): {x: number; z: number} {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {x: x * c + z * s, z: -x * s + z * c};
}

function normalise(v: Vec3): Vec3 {
    const l = Math.hypot(v.x, v.y, v.z) || 1;
    return {x: v.x / l, y: v.y / l, z: v.z / l};
}

const TREES = new Set(["broadleaf", "rainforest", "orchard", "acacia", "conifer"]);

/**
 * Forest-fill trees drawn on every tier: the low tier draws the fill up to this rank (index.ts TIER_SETTINGS.low.fill).
 * Only these (and every decor tree) carry attach points, so an animal on a tree never floats where a lighter tier
 * leaves that tree out.
 */
export const EVERY_TIER_FILL = 0.3;

/** At most this many points of each kind on one tree (the asset has up to 12 leaves, 8 bark, 24 branch points). */
const TREE_CAP: Record<TreeAttachTag, number> = {leaf: 12, bark: 6, branch: 8, tree_hollow: 4, limb: 10, canopy_hang: 4};
/** A leaf bends away under anything heavier than this, however big the leaf (body length, m). */
const LEAF_MAX = 0.12;

/**
 * The heading round the normal that points an animal's +z along `forward`, in the convention the scene uses to set
 * a model on a point: quaternion = setFromUnitVectors(+y, normal) · rotationY(yaw) (three's own maths, by hand).
 */
export function yawFor(normal: Vec3, forward: Vec3): number {
    const n = normalise(normal);
    let qx: number;
    let qz: number;
    let qw = n.y + 1;
    if (qw < 1e-6) {
        // Straight down: three turns half a circle about z.
        qx = 0;
        qz = 1;
        qw = 0;
    } else {
        qx = n.z;
        qz = -n.x;
    }
    const l = Math.hypot(qx, qz, qw);
    qx /= l;
    qz /= l;
    qw /= l;
    // The inverse rotation (x, 0, z, w)⁻¹ = (-x, 0, -z, w) applied to forward: v + 2w(u × v) + 2u × (u × v), u = (-x, 0, -z).
    const ux = -qx;
    const uz = -qz;
    const v = forward;
    const cx = -uz * v.y;
    const cy = uz * v.x - ux * v.z;
    const cz = ux * v.y;
    const ccx = -uz * cy;
    const ccz = ux * cy;
    const x = v.x + 2 * qw * cx + 2 * ccx;
    const z = v.z + 2 * qw * cz + 2 * ccz;
    return Math.atan2(x, z);
}

/**
 * What a limb of this radius holds this far out from the trunk (kg): a cantilever in green wood (bending strength
 * taken as 20 MPa, half of a typical hardwood's when green), M = W × arm, W = σ π r³ / (4 arm). An estimate for
 * matching animal to limb, not engineering: a 10 cm thick limb 1 m out holds about 200 kg, a 6 cm one about 40 kg.
 */
export function limbLoad(radius: number, arm: number): number {
    return Math.round((20e6 * Math.PI * radius ** 3) / (4 * Math.max(arm, 0.5) * 9.81) * 10) / 10;
}

/** The tops of a decor fence segment's two posts (vegetation.ts `fence`: 1 m tall at ±1.2 m along it), 2 mm up. */
export function fencePostTops(item: Pick<DecorItem, "x" | "y" | "z" | "scale" | "rotation">): Vec3[] {
    const c = Math.cos(item.rotation);
    const sn = Math.sin(item.rotation);
    return [-1.2, 1.2].map((along) => ({x: item.x + c * along * item.scale, y: item.y - DECOR_SINK + 1.0 * item.scale + 0.002, z: item.z - sn * along * item.scale}));
}

/** The cottage roof's slab thickness (micro.ts ROOF_THICKNESS; `ark-attach.test` holds them together). */
const COTTAGE_ROOF_THICKNESS = 0.12;
/** The barn's roof (vegetation.ts `barn`): its eaves' height, the ridge's rise over them, half its depth. */
const BARN_ROOF = {top: 3.15, rise: 1.9, half: 2.55};

let building: Generator<void, AttachPoint[], void> | null = null;
/** Bumped by a reset: a sliced build under way when it happens hands over to a fresh one. */
let generation = 0;
let pending: Promise<AttachPoint[]> | null = null;
let slices: number[] = [];

/** Run the build to its end (from where a sliced build has got to, if one is under way). */
function finishBuild(): AttachPoint[] {
    if (attachCache) return attachCache;
    building ??= buildAttachPoints();
    for (;;) {
        const step = building.next();
        if (step.done) {
            attachCache = step.value;
            building = null;
            return step.value;
        }
    }
}

/**
 * Every attach point on the island (built once, seeded). The first call builds them at once (about 0.15 s on a
 * desktop, 0.6 s on a mid-range phone): call `prepareAttachPoints()` at mount to build them a slice a frame instead;
 * a call here while that runs finishes it at once. Either way the points are the same.
 */
export function allAttachPoints(): AttachPoint[] {
    return attachCache ?? finishBuild();
}

/**
 * Build the attach points a slice at a time (at most about `sliceMs` of work a frame), so the mount has no long task.
 * Resolves with the same list `allAttachPoints()` returns.
 */
export function prepareAttachPoints(sliceMs = 6): Promise<AttachPoint[]> {
    if (attachCache) return Promise.resolve(attachCache);
    if (pending) return pending;
    building ??= buildAttachPoints();
    slices = [];
    const next = (run: () => void) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => run()) : setTimeout(run, 0));
    const started0 = generation;
    pending = new Promise((resolve) => {
        const slice = () => {
            if (generation !== started0) {
                // Reset meanwhile (new home plots): finish with the build as it now stands.
                resolve(allAttachPoints());
                return;
            }
            if (attachCache) {
                pending = null;
                resolve(attachCache);
                return;
            }
            const started = performance.now();
            for (;;) {
                const step = building!.next();
                if (step.done) {
                    attachCache = step.value;
                    building = null;
                    slices.push(performance.now() - started);
                    pending = null;
                    resolve(step.value);
                    return;
                }
                if (performance.now() - started >= sliceMs) break;
            }
            slices.push(performance.now() - started);
            next(slice);
        };
        next(slice);
    });
    return pending;
}

/** How long each slice of the last sliced build took (ms): for the golden page's timing. */
export function attachBuildSlices(): number[] {
    return [...slices];
}

/** Every attach point on the island, built step by step (`yield` between steps, so it can be sliced). */
function* buildAttachPoints(): Generator<void, AttachPoint[], void> {
    // Each host draws from its own seeded stream (2026-11-11): a change to one part of the scenery (a rock added, the
    // fields redrawn) moves only the points on it, never those on the house or the next rock along.
    const streamOf = (host: string, salt: number) => seeded((hashString(host) + salt * 7919 + 20261112) >>> 0);
    // A point's own heading where it has none to keep: from its id, the same every build.
    const headingOf = (id: string) => (hashString(`${id}#yaw`) / 4294967296) * Math.PI * 2;
    const points: AttachPoint[] = [];
    const kinds = new Map<string, string>();
    const add = (tag: AttachTag, host: string, n: number, position: Vec3, normal: Vec3, zone: ArkZone | null, yaw = headingOf(`${tag}:${host}:${n}`)) => {
        const hostKind = kinds.get(host) ?? (host.startsWith("lamp") ? "lamp" : host === "garden-pond" ? "pond" : host);
        points.push({id: `${tag}:${host}:${n}`, tag, spot: TAG_SPOT[tag], position, normal: normalise(normal), yaw, size: SIZE[tag], zone, host, hostKind});
    };
    const zoneOf = (x: number, z: number) => zoneAt(sampleGround(x, z)) as ArkZone;
    const decor: DecorItem[] = worldDecor();
    const fill = forestFill();
    decor.forEach((item, i) => kinds.set(`decor${i}`, item.kind));
    fill.forEach((item, i) => kinds.set(`fill${i}`, item.kind));
    yield;

    // Trees: on the drawn asset trees' own leaves, bark and branches (tree-assets.ts, from attach.json moved onto the
    // lod0 surface), where the renderer stands each tree. Only trees drawn on every tier carry points.
    const trees = [
        ...decor.map((item, i) => ({item: item as DecorItem & Partial<FillItem>, host: `decor${i}`})),
        ...fill.map((item, i) => ({item: item as DecorItem & Partial<FillItem>, host: `fill${i}`}))
    ].filter(({item}) => TREES.has(item.kind) || item.kind === "palm");
    const drawnTrees: Array<{item: DecorItem & Partial<FillItem>; host: string; real: TreeAttach[]}> = [];
    for (const {item, host} of trees) {
        yield;
        if (item.rank !== undefined && item.rank > EVERY_TIER_FILL) continue;
        const real = treeAttachPoints(item);
        if (!real.length) continue;
        drawnTrees.push({item, host, real});
        const zone = zoneOf(item.x, item.z);
        // Which of the asset's points this tree keeps (seeded by the tree, so two trees of one asset differ). The
        // hollows (added later) come after, outside the draw, so the leaves, bark and branches kept stay the same.
        const pick = seeded(hashString(host) + 7919);
        const order = [
            ...real.filter((point) => point.tag === "leaf" || point.tag === "bark" || point.tag === "branch").map((point) => ({point, key: pick()})).sort((a, b) => a.key - b.key),
            ...real.filter((point) => point.tag === "tree_hollow").map((point) => ({point, key: 0}))
        ];
        const kept: Record<TreeAttachTag, number> = {leaf: 0, bark: 0, branch: 0, tree_hollow: 0, limb: 0, canopy_hang: 0};
        for (const {point} of order) {
            if (kept[point.tag]++ >= TREE_CAP[point.tag]) continue;
            const size: [number, number] = point.tag === "leaf" ? [point.size[0], Math.min(point.size[1], LEAF_MAX)] : point.size;
            const hostKind = kinds.get(host) ?? item.kind;
            points.push({
                id: `${point.tag}:${host}:${point.n}`,
                tag: point.tag,
                spot: TAG_SPOT[point.tag],
                position: point.position,
                normal: normalise(point.normal),
                yaw: yawFor(point.normal, point.forward),
                size,
                zone,
                host,
                hostKind,
                asset: point.asset,
                forward: point.forward,
                open: point.open,
                ...(point.leaf ? {leaf: point.leaf} : {}),
                ...(point.depth !== undefined ? {depth: point.depth} : {}),
                wind: point.wind
            });
        }
    }

    // The canopy trees' limbs: perch on top, hang below, climb the trunk (layers.json canopy). On the limbs and trunk
    // vegetation.ts draws (`canopyShape`, sunk DECOR_SINK as all decor is): perch 2 mm over the limb's top, hang 2 mm
    // under its underside (bats: a thick limb, nothing below it but the ground, 3 m and more down), climb on the
    // trunk's tapered bark.
    for (let i = 0; i < decor.length; i++) {
        const item = decor[i];
        if (item.kind !== "canopy") continue;
        yield;
        const tree = canopyTree(item.variant % 2);
        const zone = zoneOf(item.x, item.z);
        const foot = item.y - DECOR_SINK;
        tree.limbs.forEach((limb, k) => {
            const at = limbAt(limb, tree.base, 0.75);
            const p = rotateY(at.x * item.scale, at.z * item.scale, item.rotation);
            const position = {x: item.x + p.x, y: foot + at.y * item.scale, z: item.z + p.z};
            const heading = item.rotation + limb.angle;
            const radius = at.radius * item.scale;
            add("canopy_perch", `decor${i}`, k, {...position, y: position.y + radius + 0.002}, {x: 0, y: 1, z: 0}, zone, heading);
            points[points.length - 1].radius = radius;
            const under = position.y - radius - 0.002;
            add("canopy_hang", `decor${i}`, k, {...position, y: under}, {x: 0, y: -1, z: 0}, zone, heading);
            points[points.length - 1].radius = radius;
            points[points.length - 1].clearBelow = under - sampleGround(position.x, position.z).height;
        });
        const climb = streamOf(`decor${i}`, 1);
        for (let k = 0; k < 2; k++) {
            const a = climb() * Math.PI * 2;
            const h = 1.5 * item.scale;
            const r = (tree.base + (tree.top - tree.base) * 1.5 / tree.height) * item.scale + 0.002;
            add("canopy_climb", `decor${i}`, k, {x: item.x + Math.sin(a) * r, y: foot + h, z: item.z + Math.cos(a) * r}, {x: Math.sin(a), y: 0, z: Math.cos(a)}, zone, 0);
        }
    }

    yield;
    // Flowers: the head's top, facing up.
    decor.forEach((item, i) => {
        if (item.kind !== "flower") return;
        const v = item.variant % 3;
        const top = (FLOWER_SHAPE.stem[v] + FLOWER_SHAPE.head * FLOWER_SHAPE.squash * FLOWER_SHAPE.top[v]) * item.scale;
        add("flower_head", `decor${i}`, 0, {x: item.x, y: item.y + top - 0.08, z: item.z}, {x: 0, y: 1, z: 0}, zoneOf(item.x, item.z));
    });

    // Rocks: faces round each rock (the rock shape: an ellipsoid about 0.94 × 0.53 × 0.81 of its scale, lifted 0.18);
    // the shore's low rocks also get tide pools at their feet.
    for (let i = 0; i < decor.length; i++) {
        const item = decor[i];
        if (item.kind !== "rock") continue;
        yield;
        const zone = zoneOf(item.x, item.z);
        const s = item.scale;
        // On the drawn surface itself: the asset rock's own faces and ledges (rock-assets.ts, batch 5), else (the rock
        // set missing, so vegetation.ts draws the procedural rock) the very triangles that draws (`drawnRockPoint`).
        // Same ids and the same random draws either way.
        const asset = rockAssetFor(item);
        const used = new Set<number>();
        const random = streamOf(`decor${i}`, 2);
        for (let k = 0; k < 4; k++) {
            const a = random() * Math.PI * 2;
            const up = 0.1 + random() * 0.75;
            const face = asset ? rockFaceToward(asset, a, up, used) : null;
            if (face) {
                used.add(face.index);
                const {position, normal} = face.point;
                add("rock_face", `decor${i}`, k, {x: position.x + normal.x * 0.004, y: position.y + normal.y * 0.004, z: position.z + normal.z * 0.004}, normal, zone);
                continue;
            }
            const point = drawnRockPoint(item, Math.sin(a) * (1 - up), up, Math.cos(a) * (1 - up));
            add("rock_face", `decor${i}`, k, {x: point.x + point.nx * 0.002, y: point.y + point.ny * 0.002, z: point.z + point.nz * 0.002}, {x: point.nx, y: point.ny, z: point.nz}, zone);
        }
        if (item.y < 0.4 && item.y > -0.7) {
            const a = random() * Math.PI * 2;
            const r = s * 1.1;
            const x = item.x + Math.sin(a) * r;
            const z = item.z + Math.cos(a) * r;
            add("tide_pool", `decor${i}`, 0, {x, y: Math.max(sampleGround(x, z).height, -0.3) + 0.02, z}, {x: 0, y: 1, z: 0}, zone);
        }
    }
    yield;

    // The house: its four walls (outward), the eaves, the porch light.
    const c = COTTAGE;
    const walls: Array<{n: Vec3; along: Vec3; half: number; cx: number; cz: number}> = [
        {n: {x: 0, y: 0, z: 1}, along: {x: 1, y: 0, z: 0}, half: c.width / 2, cx: 0, cz: c.depth / 2},
        {n: {x: 0, y: 0, z: -1}, along: {x: 1, y: 0, z: 0}, half: c.width / 2, cx: 0, cz: -c.depth / 2},
        {n: {x: 1, y: 0, z: 0}, along: {x: 0, y: 0, z: 1}, half: c.depth / 2, cx: c.width / 2, cz: 0},
        {n: {x: -1, y: 0, z: 0}, along: {x: 0, y: 0, z: 1}, half: c.depth / 2, cx: -c.width / 2, cz: 0}
    ];
    const random = streamOf("house", 3);
    walls.forEach((wall, w) => {
        for (let k = 0; k < 6; k++) {
            const t = (random() * 2 - 1) * wall.half * 0.85;
            const y = c.floor + 0.4 + random() * (c.wall - 0.7);
            add("house_wall", "house", w * 10 + k, {x: c.x + wall.cx + wall.along.x * t + wall.n.x * 0.01, y, z: c.z + wall.cz + wall.along.z * t + wall.n.z * 0.01}, wall.n, "farm_garden", random() * Math.PI * 2);
        }
        // Under the drawn eave (micro-scene.ts: two roof slabs falling from the ridge, `roofHeight`, out past the walls):
        // on the long walls under the slope, 0.21 m out; on the gable ends under the verge at its peak.
        const out = c.overhang * 0.6;
        if (wall.n.z !== 0) {
            const fall = c.ridge / (c.depth / 2);
            const underside = c.floor + c.wall + c.ridge * (1 - (c.depth / 2 + out) / (c.depth / 2));
            add("house_eave", "house", w, {x: c.x + wall.cx, y: underside - 0.004, z: c.z + wall.cz + wall.n.z * out}, {x: 0, y: -1, z: -wall.n.z * fall}, "farm_garden");
        } else {
            add("house_eave", "house", w, {x: c.x + wall.cx + wall.n.x * out, y: c.floor + c.wall + c.ridge - 0.004, z: c.z}, {x: 0, y: -1, z: 0}, "farm_garden");
        }
    });
    add("porch_light", "house", 0, {x: c.x + c.light.x, y: c.floor + c.light.y + 0.1, z: c.z + c.light.z + 0.06}, {x: 0, y: 0, z: 1}, "farm_garden");
    for (const zone of ["farm_garden", "seashore", "river_lake", "wetland", "rainforest", "woodland", "grassland", "desert", "mountains", "polar"] as ArkZone[]) {
        const lamp = zoneLamp(zone);
        add("lamp", `lamp-${zone}`, 0, {x: lamp.x, y: lamp.y + LAMP.height - 0.15, z: lamp.z + LAMP.radius * 2}, {x: 0, y: 0, z: 1}, zone);
    }

    // Ponds: lily-pad points round the garden pond and the lake's margin.
    const pond = streamOf("garden-pond", 4);
    for (let k = 0; k < 8; k++) {
        const a = pond() * Math.PI * 2;
        const r = GARDEN_POND.radius * Math.sqrt(pond()) * 0.8;
        add("pond_surface", "garden-pond", k, {x: GARDEN_POND.x + Math.cos(a) * r, y: GARDEN_POND.y, z: GARDEN_POND.z + Math.sin(a) * r}, {x: 0, y: 1, z: 0}, "farm_garden");
    }
    const lake = streamOf("lake", 5);
    for (let k = 0; k < 24; k++) {
        const a = lake() * Math.PI * 2;
        const r = LAKE.r * (0.7 + lake() * 0.22);
        add("pond_surface", "lake", k, {x: LAKE.x + Math.cos(a) * r, y: 0.02, z: LAKE.z + Math.sin(a) * r}, {x: 0, y: 1, z: 0}, "river_lake");
    }

    // The ground: leaf litter under the forests, worm holes in soft soil, burrow mouths in open banks.
    let tries = 0;
    let litter = 0;
    let holes = 0;
    let burrows = 0;
    const search = streamOf("ground", 6);
    while (tries++ < 40000 && (litter < 300 || holes < 200 || burrows < 120)) {
        if (tries % 16 === 0) yield;
        const x = (search() * 2 - 1) * 100;
        const z = (search() * 2 - 1) * 100;
        // The height first (it is surfaceAt's; at calm sea level, water only lies under 0): no normal for the sea.
        const sample = sampleGround(x, z);
        if (sample.height < 0.4) continue;
        const surface = surfaceFrom(sample, x, z, CALM);
        // (The lake and the river keep their own level: water can lie over ground above 0.4 m there.)
        if (surface.waterDepth > 0) continue;
        const ground = {x, y: surface.height, z};
        if (litter < 300 && (surface.weights.forest_floor ?? 0) > 0.4) add("leaf_litter", "ground", litter++, ground, surface.normal, surface.zone);
        else if (holes < 200 && ((surface.weights.grass ?? 0) > 0.5 || (surface.weights.tilled ?? 0) > 0.3) && surface.normal.y > 0.95) add("worm_hole", "ground", holes++, ground, surface.normal, surface.zone);
        else if (burrows < 120 && surface.normal.y < 0.97 && surface.normal.y > 0.8 && surface.surface !== "rock" && surface.surface !== "snow") add("burrow", "ground", burrows++, ground, surface.normal, surface.zone, Math.atan2(surface.normal.x, surface.normal.z));
    }

    // Ledges (added 2026-11-11 for the props lane, its own search and seed, so its ids are unchanged): steep ground
    // facing out on the sea cliffs, the mountain and the ice, where a cliff nester's shelf goes. Up is up (the animal
    // stands on the shelf); `forward` and the yaw face out from the cliff.
    const ledgeRandom = seeded(880011);
    let ledges = 0;
    for (let i = 0; i < 2600 && ledges < 90; i++) {
        if (i % 16 === 0) yield;
        const x = (ledgeRandom() * 2 - 1) * 110;
        const z = (ledgeRandom() * 2 - 1) * 110;
        const sample = sampleGround(x, z);
        if (sample.height < 1.2) continue;
        const zone = zoneAt(sample) as ArkZone;
        const cliffy = sample.cliff > 0.45 && sample.inland < 12;
        // Only a cliff, the mountain or the ice can hold one: no normal needed elsewhere.
        if (!cliffy && zone !== "mountains" && zone !== "polar") continue;
        const surface = surfaceFrom(sample, x, z, CALM);
        const steep = 1 - surface.normal.y;
        if (!(cliffy || (zone === "mountains" && steep > 0.18) || (zone === "polar" && steep > 0.1))) continue;
        const flat = Math.hypot(surface.normal.x, surface.normal.z) || 1;
        const forward = {x: surface.normal.x / flat, y: 0, z: surface.normal.z / flat};
        add("ledge", "ground", ledges++, {x, y: sample.height, z}, {x: 0, y: 1, z: 0}, cliffy ? (zone === "polar" ? "polar" : "seashore") : zone, Math.atan2(forward.x, forward.z));
        points[points.length - 1].forward = forward;
    }
    // And rock shelves: the flat tops of the big rocks on the shore, the mountain and the ice (on their drawn faces).
    decor.forEach((item, i) => {
        if (item.kind !== "rock" || item.scale < 1.3) return;
        const zone = zoneOf(item.x, item.z);
        if (zone !== "mountains" && zone !== "polar" && zone !== "seashore") return;
        // The asset rock's highest flat ledge (its attach.json, on the drawn lod0 surface), else the drawn procedural top.
        const asset = rockAssetFor(item);
        const shelf = asset ? rockAttachPoints(asset).filter((p) => p.tag === "ledge" && p.normal.y >= 0.8).sort((p, q) => q.position.y - p.position.y)[0] : null;
        if (asset && !shelf) return;
        const top = shelf
            ? {x: shelf.position.x + shelf.normal.x * 0.002, y: shelf.position.y + shelf.normal.y * 0.002, z: shelf.position.z + shelf.normal.z * 0.002, nx: shelf.normal.x, ny: shelf.normal.y, nz: shelf.normal.z}
            : drawnRockPoint(item, 0, 1, 0);
        // Out of the sea at high tide, and flat enough to sit on.
        if (top.ny < 0.8 || top.y < 0.6) return;
        // Facing out to sea, or down the mountain: away from the island's middle, along the shelf.
        const normal = normalise({x: top.nx, y: top.ny, z: top.nz});
        const away = {x: Math.sin(Math.atan2(item.x, item.z)), y: 0, z: Math.cos(Math.atan2(item.x, item.z))};
        const dot = away.x * normal.x + away.z * normal.z;
        const forward = normalise({x: away.x - normal.x * dot, y: -normal.y * dot, z: away.z - normal.z * dot});
        add("ledge", `decor${i}`, 0, shelf ? {x: top.x, y: top.y, z: top.z} : {x: top.x + top.nx * 0.002, y: top.y + top.ny * 0.002, z: top.z + top.nz * 0.002}, normal, zone, yawFor(normal, forward));
        points[points.length - 1].forward = forward;
    });
    yield;

    // Fence posts (added 2026-11-11 for the map lane): the top of each post of the field fences vegetation.ts draws
    // (`fence`: posts 0.1 m square and 1 m tall at ±1.2 m, two to a 2.4 m segment; where segments meet, one post).
    // Perching birds, basking lizards. Up is up, forward along the fence.
    const posts: Vec3[] = [];
    decor.forEach((item, i) => {
        if (item.kind !== "fence") return;
        const forward = {x: Math.cos(item.rotation), y: 0, z: -Math.sin(item.rotation)};
        fencePostTops(item).forEach((top, k) => {
            if (posts.some((other) => Math.hypot(other.x - top.x, other.z - top.z) < 0.06)) return;
            posts.push(top);
            add("fence_post", `decor${i}`, k, top, {x: 0, y: 1, z: 0}, zoneOf(top.x, top.z), Math.atan2(forward.x, forward.z));
            points[points.length - 1].forward = forward;
        });
    });
    // And the fences the props lane draws on the home plots (props/home-layout.ts `fencePostTops`: the paddocks'
    // post-and-rail and the gardens' picket fences), 2 mm over each post's top: `fence_post:paddock:<n>`,
    // `fence_post:picket:<n>`.
    for (const post of homeFencePosts(homePlots ?? defaultHomePlots())) {
        add("fence_post", post.fence, post.n, {x: post.position.x, y: post.position.y + 0.002, z: post.position.z}, {x: 0, y: 1, z: 0}, zoneOf(post.position.x, post.position.z), Math.atan2(post.forward.x, post.forward.z));
        points[points.length - 1].forward = post.forward;
    }

    // Roof edges (added 2026-11-11 for the map lane): along the cottage's ridge cap and its eaves' top edges
    // (micro-scene.ts: the ridge's capping box, the roof slabs ROOF_THICKNESS thick, their outer edge 0.35 m past the
    // walls), and the barn's ridge and eaves (vegetation.ts `barn`). Up is up, forward along the edge.
    const roof = (host: string, n: number, at: Vec3, along: Vec3) => {
        add("roof_edge", host, n, at, {x: 0, y: 1, z: 0}, zoneOf(at.x, at.z), Math.atan2(along.x, along.z));
        points[points.length - 1].forward = along;
    };
    const ridgeTop = c.floor + c.wall + c.ridge + COTTAGE_ROOF_THICKNESS + 0.05 + 0.002;
    [-2.2, -1.1, 0, 1.1, 2.2].forEach((x, k) => roof("house", k, {x: c.x + x, y: ridgeTop, z: c.z}, {x: 1, y: 0, z: 0}));
    const run = c.depth / 2 + c.overhang;
    const eaveTop = c.floor + c.wall + c.ridge * (1 - run / (c.depth / 2)) + COTTAGE_ROOF_THICKNESS + 0.002;
    for (const [side, base] of [[1, 10], [-1, 20]] as const) {
        [-2.1, -0.7, 0.7, 2.1].forEach((x, k) => roof("house", base + k, {x: c.x + x, y: eaveTop, z: c.z + side * run}, {x: 1, y: 0, z: 0}));
    }
    decor.forEach((item, i) => {
        if (item.kind !== "barn") return;
        const turn = (lx: number, ly: number, lz: number): Vec3 => {
            const p = rotateY(lx * item.scale, lz * item.scale, item.rotation);
            return {x: item.x + p.x, y: item.y - DECOR_SINK + ly * item.scale + 0.002, z: item.z + p.z};
        };
        const along = {x: Math.cos(item.rotation), y: 0, z: -Math.sin(item.rotation)};
        [-2.6, -0.9, 0.9, 2.6].forEach((x, k) => roof(`decor${i}`, k, turn(x, BARN_ROOF.top + BARN_ROOF.rise, 0), along));
        for (const [side, base] of [[1, 10], [-1, 20]] as const) {
            [-2.4, 0, 2.4].forEach((x, k) => roof(`decor${i}`, base + k, turn(x, BARN_ROOF.top, side * BARN_ROOF.half), along));
        }
    });
    yield;

    // Fallen logs (graphics batch 6, floor-assets.ts, drawn on every tier): the tops of the logs the forest floor
    // draws, from the floor set's attach.json put onto the drawn lod0 bark (tree-attach.json `logs`), placed as
    // asset-rocks.ts draws them (turned to lie along the ground's slope, then about it by its yaw). Fungus beetles,
    // basking lizards, a wren. `log:floor<k>:<n>`, forward along the log.
    const yAxis = new Vector3(0, 1, 0);
    const placements = floorPlacements();
    for (let k = 0; k < placements.length; k++) {
        const placed = placements[k];
        if (!placed.id.startsWith("log-")) continue;
        const rows = floorLogTops(placed.id);
        if (!rows.length) continue;
        const turn = new Quaternion().setFromUnitVectors(yAxis, new Vector3(placed.up[0], placed.up[1], placed.up[2])).multiply(new Quaternion().setFromAxisAngle(yAxis, placed.yaw));
        const zone = zoneOf(placed.x, placed.z);
        rows.forEach((row, n) => {
            const p = new Vector3(row[0], row[1], row[2]).multiplyScalar(placed.scale).applyQuaternion(turn);
            const normal = new Vector3(row[3], row[4], row[5]).applyQuaternion(turn).normalize();
            const forward = new Vector3(row[6], row[7], row[8]).applyQuaternion(turn).normalize();
            const at = {x: placed.x + p.x, y: placed.y + p.y, z: placed.z + p.z};
            const f = {x: forward.x, y: forward.y, z: forward.z};
            add("log", `floor${k}`, n, at, {x: normal.x, y: normal.y, z: normal.z}, zone, yawFor(normal, f));
            const point = points[points.length - 1];
            point.forward = f;
            point.hostKind = "log";
            point.size = [row[9] * placed.scale, row[10] * placed.scale];
        });
        if (k % 32 === 0) yield;
    }
    yield;

    // Limbs for large climbers and hang points under them, on the asset trees every tier draws (added 2026-11-11 for
    // the map lane: sloths, orangutans and tree kangaroos had only the 16 canopy trees). From tree-attach.json: the
    // tops of thick, not too steep limbs with their radius and clear room, and the undersides with the clearest drop.
    for (const {item, host, real} of drawnTrees) {
        yield;
        const zone = zoneOf(item.x, item.z);
        const kept = {limb: 0, canopy_hang: 0};
        for (const point of real) {
            if (point.tag !== "limb" && point.tag !== "canopy_hang") continue;
            const radius = point.radius ?? 0;
            if (radius < 0.03 || kept[point.tag] >= TREE_CAP[point.tag]) continue;
            const ground = sampleGround(point.position.x, point.position.z).height;
            const root = point.wind.root;
            // How far out from the trunk: the lever the animal's weight bends the limb by.
            const arm = Math.max(Math.hypot(point.position.x - root.x, point.position.z - root.z), 0.5);
            const clearBelow = Math.min(point.clearBelow ?? 0, (point.tag === "limb" ? point.position.y - 2 * radius : point.position.y) - ground);
            if (point.tag === "canopy_hang" && clearBelow < 1.2) continue;
            kept[point.tag]++;
            points.push({
                id: `${point.tag}:${host}:${point.n}`,
                tag: point.tag,
                spot: TAG_SPOT[point.tag],
                position: point.position,
                normal: normalise(point.normal),
                yaw: yawFor(point.normal, point.forward),
                size: point.tag === "limb" ? [0.15, Math.min(1.6, 24 * radius)] : [0.02, Math.min(0.6, 12 * radius)],
                zone,
                host,
                hostKind: kinds.get(host) ?? item.kind,
                asset: point.asset,
                forward: point.forward,
                radius,
                load: limbLoad(radius, arm),
                ...(point.tag === "limb" ? {clearAbove: point.clearAbove ?? 0} : {}),
                clearBelow,
                wind: point.wind
            });
        }
    }
    return points;
}

// MARK: - The drawn rocks

const rockMeshes = new Map<number, {p: Float32Array; index: ArrayLike<number>}>();

/**
 * A rock's drawn mesh in its own frame, before the instance's scale: vegetation.ts `rock(variant)` (an icosphere of
 * detail 3, each corner pushed out to decor.ts rockRadius, then 1.1 × 0.62 × 0.95 and lifted 0.18), so a point found
 * on it lies on the flat faces actually drawn, not on the smooth shape between their corners (up to 5 cm apart).
 */
export function drawnRockMesh(variant: number): {p: Float32Array; index: ArrayLike<number>} {
    const cached = rockMeshes.get(variant);
    if (cached) return cached;
    let geometry: BufferGeometry = new IcosahedronGeometry(0.85, 3);
    geometry.deleteAttribute("normal");
    geometry.deleteAttribute("uv");
    geometry = mergeVertices(geometry);
    const position = geometry.getAttribute("position");
    const p = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
        let x = position.getX(i);
        let y = position.getY(i);
        let z = position.getZ(i);
        const l = Math.hypot(x, y, z) || 1;
        x /= l;
        y /= l;
        z /= l;
        const r = rockRadius(variant, x, y, z);
        p[i * 3] = x * r * 1.1;
        p[i * 3 + 1] = y * r * 0.62 + 0.18;
        p[i * 3 + 2] = z * r * 0.95;
    }
    const mesh = {p, index: geometry.index!.array};
    rockMeshes.set(variant, mesh);
    return mesh;
}

/** Where a ray from the rock's middle along a direction in its own frame (y up) meets its drawn faces, in the world, with the face's normal. */
export function drawnRockPoint(item: DecorItem, dx: number, dy: number, dz: number): {x: number; y: number; z: number; nx: number; ny: number; nz: number} {
    const {p, index} = drawnRockMesh(item.variant % 3);
    // In the mesh's own frame the shape is stretched 1.1 × 0.62 × 0.95 round (0, 0.18, 0).
    let rx = dx * 1.1;
    let ry = dy * 0.62;
    let rz = dz * 0.95;
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl;
    ry /= rl;
    rz /= rl;
    const ox = 0;
    const oy = 0.18;
    const oz = 0;
    let best = Infinity;
    let hit = {x: 0, y: 0.18, z: 0, nx: 0, ny: 1, nz: 0};
    for (let t = 0; t < index.length; t += 3) {
        const a = index[t] * 3;
        const b = index[t + 1] * 3;
        const c = index[t + 2] * 3;
        const e1x = p[b] - p[a];
        const e1y = p[b + 1] - p[a + 1];
        const e1z = p[b + 2] - p[a + 2];
        const e2x = p[c] - p[a];
        const e2y = p[c + 1] - p[a + 1];
        const e2z = p[c + 2] - p[a + 2];
        // Möller–Trumbore.
        const hx = ry * e2z - rz * e2y;
        const hy = rz * e2x - rx * e2z;
        const hz = rx * e2y - ry * e2x;
        const det = e1x * hx + e1y * hy + e1z * hz;
        if (Math.abs(det) < 1e-12) continue;
        const f = 1 / det;
        const sx = ox - p[a];
        const sy = oy - p[a + 1];
        const sz = oz - p[a + 2];
        const u = f * (sx * hx + sy * hy + sz * hz);
        if (u < -1e-9 || u > 1 + 1e-9) continue;
        const qx = sy * e1z - sz * e1y;
        const qy = sz * e1x - sx * e1z;
        const qz = sx * e1y - sy * e1x;
        const v = f * (rx * qx + ry * qy + rz * qz);
        if (v < -1e-9 || u + v > 1 + 1e-9) continue;
        const d = f * (e2x * qx + e2y * qy + e2z * qz);
        if (d <= 0 || d >= best) continue;
        best = d;
        // The face's normal, pointing out (away from the middle).
        let nx = e1y * e2z - e1z * e2y;
        let ny = e1z * e2x - e1x * e2z;
        let nz = e1x * e2y - e1y * e2x;
        if (nx * rx + ny * ry + nz * rz < 0) {
            nx = -nx;
            ny = -ny;
            nz = -nz;
        }
        hit = {x: ox + rx * d, y: oy + ry * d, z: oz + rz * d, nx, ny, nz};
    }
    // Into the world: the instance's scale (s, s × squash, s), its turn about y, its foot sunk as the decor is.
    const s = item.scale;
    const sy = s * rockSquash(item);
    const c = Math.cos(item.rotation);
    const sn = Math.sin(item.rotation);
    const lx = hit.x * s;
    const ly = hit.y * sy;
    const lz = hit.z * s;
    // Normals take the inverse scale.
    let nx = hit.nx / s;
    let ny = hit.ny / sy;
    let nz = hit.nz / s;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    return {x: item.x + lx * c + lz * sn, y: item.y - DECOR_SINK + ly, z: item.z - lx * sn + lz * c, nx: nx * c + nz * sn, ny, nz: -nx * sn + nz * c};
}

export type AttachQuery = {tag?: AttachTag | AttachTag[]; spot?: AttachSpot; near?: {x: number; z: number; radius: number}; size?: number; zone?: ArkZone};

/** Attach points that match: by tag or microhabitat spot, near a point, fitting a body length, in a zone. */
export function attachPoints(query: AttachQuery = {}): AttachPoint[] {
    const tags = query.tag ? new Set(Array.isArray(query.tag) ? query.tag : [query.tag]) : null;
    return allAttachPoints().filter((point) =>
        (!tags || tags.has(point.tag))
        && (!query.spot || point.spot === query.spot)
        && (!query.zone || point.zone === query.zone)
        && (query.size === undefined || (query.size >= point.size[0] && query.size <= point.size[1]))
        && (!query.near || Math.hypot(point.position.x - query.near.x, point.position.z - query.near.z) <= query.near.radius));
}

/**
 * How far its host's wind has moved an attach point (m): the tree's sway and leaf flutter, exactly as the tree shader
 * draws them, so a small animal on a leaf moves with the leaf. `time` and `wind` are the scene's own shader clock and
 * wind (`ARK_TIME.value`, `ARK_WIND.value` in glsl.ts). Zero for points on still hosts (rocks, the house, the ground).
 */
export function attachSway(point: AttachPoint, time: number, wind: {x: number; y: number}): Vec3 {
    return point.wind ? treeSway(point.wind, time, wind) : {x: 0, y: 0, z: 0};
}

/** Where an attach point is now: its position plus its host's sway (`attachSway`). */
export function attachPointAt(point: AttachPoint, time: number, wind: {x: number; y: number}): Vec3 {
    const sway = attachSway(point, time, wind);
    return {x: point.position.x + sway.x, y: point.position.y + sway.y, z: point.position.z + sway.z};
}

/** The coast's waterline radius at a bearing, for anything that follows the shore (the tide moves it by `seaLevel`). */
export function shoreRadius(theta: number): number {
    return coastRadius(theta) - BEACH_INSET + 1;
}
