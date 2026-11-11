/**
 * The Ark's ground and scenery as other lanes see it (graphics pass): one
 * stable interface for the map's spawn rules (`ark-map`), the behaviour
 * system (`ark-behaviour`), the props lane and the liveliness lane, so they
 * can place things on whatever terrain and scenery the graphics pass draws.
 *
 *   surfaceAt(x, z)      height, normal, what the ground is made of there, wetness, water depth
 *   place(name)          named anchor places ("beach", "house", "reef", …), never raw coordinates
 *   attachPoints(query)  seeded points on the scenery where small animals sit, cling, crawl and hide,
 *                        tagged by microhabitat (the tags of microhabitats.json and layers.json)
 *
 * Pure (no three.js scene, no DOM) and deterministic: every viewer gets the
 * same points. The graphics pass keeps these signatures stable; what it
 * changes is underneath (the terrain, the trees, the house).
 */

import {COTTAGE, FLOWER_SHAPE, GARDEN_POND, canopyTree, limbAt, microCorner, zoneLamp, LAMP} from "@/ark-scene/micro-decor";
import {forestFill, rockSurfacePoint, worldDecor, type DecorItem} from "@/ark-scene/decor";
import {BEACH_INSET, LAKE, RIVER, VISITOR_LANDING, ZONE_SITES, coastRadius, fbm, regionCentre, sampleGround, seeded, smoothstep, zoneAt, type GroundSample} from "@/ark-scene/world";
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
    /** The material with the most weight here, and all of them (summing to about 1). */
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
    const sample: GroundSample = sampleGround(x, z);
    const normal = groundNormal(x, z);
    const w = sample.weights;
    const zone = zoneAt(sample) as ArkZone;
    const slope = 1 - normal.y;
    const height = sample.height;
    const waterDepth = Math.max(environment.seaLevel - height, 0);
    const weights: Partial<Record<SurfaceKind, number>> = {};
    const put = (kind: SurfaceKind, value: number) => {
        if (value > 0.001) weights[kind] = (weights[kind] ?? 0) + value;
    };
    if (height < environment.seaLevel - 0.05) {
        const fresh = Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 1 || (sample.river < 4 && sample.inland > 4);
        put(fresh ? "lakebed" : "seabed", 1);
    } else {
        const snow = Math.max((w.polar ?? 0) * smoothstep(0.3, 1, sample.land), smoothstep(16, 25, height), environment.snow);
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
    let surface: SurfaceKind = "grass";
    let best = -1;
    for (const [kind, value] of Object.entries(weights) as Array<[SurfaceKind, number]>) {
        if (value > best) {
            best = value;
            surface = kind;
        }
    }
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
    "desert", "mountain", "mountain_peak", "cold_cove", "reef", "open_ocean"
] as const;
export type PlaceName = typeof PLACE_NAMES[number];
export type Place = {name: PlaceName; x: number; y: number; z: number; /** How far the place reaches (m). */ radius: number};

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
    }
    placeCache.set(name, result);
    return result;
}

function shoreRocks(): Array<{x: number; y: number; z: number; scale: number}> {
    return worldDecor().filter((item) => item.kind === "rock" && item.y < 0.2 && item.y > -0.9 && sampleGround(item.x, item.z).cliff < 0.25);
}

// MARK: - Attach points

/**
 * Where small animals attach. `spot` is the microhabitat tag of
 * microhabitats.json (house, lamp, bark, flowers, rocks, leaf_litter,
 * pond_surface) or layers.json's canopy/burrow; `tag` says the exact surface.
 */
export const ATTACH_TAGS = [
    "leaf", "branch", "bark", "flower_head", "rock_face", "tide_pool", "house_wall", "house_eave", "porch_light", "lamp",
    "leaf_litter", "worm_hole", "burrow", "pond_surface", "canopy_perch", "canopy_climb", "canopy_hang"
] as const;
export type AttachTag = typeof ATTACH_TAGS[number];
export type AttachSpot = "house" | "lamp" | "bark" | "flowers" | "rocks" | "leaf_litter" | "pond_surface" | "canopy" | "burrow" | "spawn";

export const TAG_SPOT: Record<AttachTag, AttachSpot> = {
    leaf: "canopy", branch: "canopy", bark: "bark", flower_head: "flowers", rock_face: "rocks", tide_pool: "rocks",
    house_wall: "house", house_eave: "house", porch_light: "lamp", lamp: "lamp", leaf_litter: "leaf_litter", worm_hole: "burrow",
    burrow: "burrow", pond_surface: "pond_surface", canopy_perch: "canopy", canopy_climb: "canopy", canopy_hang: "canopy"
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
};

const SIZE: Record<AttachTag, [number, number]> = {
    leaf: [0.004, 0.08], branch: [0.01, 0.6], bark: [0.004, 0.35], flower_head: [0.004, 0.06], rock_face: [0.004, 0.45],
    tide_pool: [0.008, 0.3], house_wall: [0.004, 0.25], house_eave: [0.004, 0.2], porch_light: [0.004, 0.12], lamp: [0.004, 0.12],
    leaf_litter: [0.004, 0.35], worm_hole: [0.02, 0.4], burrow: [0.05, 0.7], pond_surface: [0.008, 0.4],
    canopy_perch: [0.05, 0.9], canopy_climb: [0.05, 1.4], canopy_hang: [0.1, 1.2]
};

let attachCache: AttachPoint[] | null = null;

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

/** Every attach point on the island (built once, seeded). */
export function allAttachPoints(): AttachPoint[] {
    if (attachCache) return attachCache;
    const random = seeded(20261112);
    const points: AttachPoint[] = [];
    const kinds = new Map<string, string>();
    const add = (tag: AttachTag, host: string, n: number, position: Vec3, normal: Vec3, zone: ArkZone | null, yaw = random() * Math.PI * 2) => {
        const hostKind = kinds.get(host) ?? (host.startsWith("lamp") ? "lamp" : host === "garden-pond" ? "pond" : host);
        points.push({id: `${tag}:${host}:${n}`, tag, spot: TAG_SPOT[tag], position, normal: normalise(normal), yaw, size: SIZE[tag], zone, host, hostKind});
    };
    const zoneOf = (x: number, z: number) => zoneAt(sampleGround(x, z)) as ArkZone;
    const decor: DecorItem[] = worldDecor();
    const fill = forestFill();
    decor.forEach((item, i) => kinds.set(`decor${i}`, item.kind));
    fill.forEach((item, i) => kinds.set(`fill${i}`, item.kind));

    // Trees: bark on the trunk (outward), leaves round the crown (facing out and up), branches under it.
    const trees = [...decor.map((item, i) => ({item, host: `decor${i}`})), ...fill.map((item, i) => ({item, host: `fill${i}`}))].filter(({item}) => TREES.has(item.kind));
    for (const {item, host} of trees) {
        const s = item.scale;
        const zone = zoneOf(item.x, item.z);
        const trunkHeight = (item.kind === "rainforest" ? 4.6 : item.kind === "conifer" ? 1.4 : item.kind === "orchard" ? 1.3 : 2.4) * s;
        const trunkRadius = (item.kind === "rainforest" ? 0.26 : item.kind === "orchard" ? 0.12 : 0.2) * s;
        for (let k = 0; k < 3; k++) {
            const a = random() * Math.PI * 2;
            const h = (0.3 + random() * 0.6) * trunkHeight;
            const r = trunkRadius * (1 - 0.35 * h / trunkHeight);
            add("bark", host, k, {x: item.x + Math.sin(a) * r, y: item.y + h, z: item.z + Math.cos(a) * r}, {x: Math.sin(a), y: 0, z: Math.cos(a)}, zone, 0);
        }
        const crownY = item.y + trunkHeight + (item.kind === "conifer" ? 1.2 * s : 1.0 * s);
        const crownR = (item.kind === "rainforest" ? 3.0 : item.kind === "conifer" ? 1.3 : item.kind === "orchard" ? 1.3 : 2.1) * s;
        for (let k = 0; k < 6; k++) {
            const a = random() * Math.PI * 2;
            const up = 0.15 + random() * 0.7;
            const out = {x: Math.sin(a) * Math.sqrt(1 - up * up), y: up, z: Math.cos(a) * Math.sqrt(1 - up * up)};
            // Just outside the leaf cards, where a near leaf (a real leaf mesh) is put when the camera comes close.
            add("leaf", host, k, {x: item.x + out.x * crownR * 1.12, y: crownY + out.y * crownR * 0.78, z: item.z + out.z * crownR * 1.12}, {x: out.x * 0.6, y: 1, z: out.z * 0.6}, zone);
        }
        for (let k = 0; k < 2; k++) {
            const a = random() * Math.PI * 2;
            const reach = crownR * (0.4 + random() * 0.4);
            add("branch", host, k, {x: item.x + Math.sin(a) * reach, y: crownY - crownR * 0.45, z: item.z + Math.cos(a) * reach}, {x: 0, y: 1, z: 0}, zone, a);
        }
    }

    // The canopy trees' limbs: perch on top, hang below, climb the trunk (layers.json canopy).
    decor.forEach((item, i) => {
        if (item.kind !== "canopy") return;
        const tree = canopyTree(item.variant % 2);
        const zone = zoneOf(item.x, item.z);
        tree.limbs.forEach((limb, k) => {
            const at = limbAt(limb, tree.base, 0.75);
            const p = rotateY(at.x * item.scale, at.z * item.scale, item.rotation);
            const position = {x: item.x + p.x, y: item.y + at.y * item.scale, z: item.z + p.z};
            const heading = item.rotation + limb.angle;
            add("canopy_perch", `decor${i}`, k, {...position, y: position.y + at.radius * item.scale}, {x: 0, y: 1, z: 0}, zone, heading);
            add("canopy_hang", `decor${i}`, k, {...position, y: position.y - at.radius * item.scale}, {x: 0, y: -1, z: 0}, zone, heading);
        });
        for (let k = 0; k < 2; k++) {
            const a = random() * Math.PI * 2;
            add("canopy_climb", `decor${i}`, k, {x: item.x + Math.sin(a) * tree.base * item.scale, y: item.y + 1.5 * item.scale, z: item.z + Math.cos(a) * tree.base * item.scale}, {x: Math.sin(a), y: 0, z: Math.cos(a)}, zone, 0);
        }
    });

    // Flowers: the head's top, facing up.
    decor.forEach((item, i) => {
        if (item.kind !== "flower") return;
        const v = item.variant % 3;
        const top = (FLOWER_SHAPE.stem[v] + FLOWER_SHAPE.head * FLOWER_SHAPE.squash * FLOWER_SHAPE.top[v]) * item.scale;
        add("flower_head", `decor${i}`, 0, {x: item.x, y: item.y + top - 0.08, z: item.z}, {x: 0, y: 1, z: 0}, zoneOf(item.x, item.z));
    });

    // Rocks: faces round each rock (the rock shape: an ellipsoid about 0.94 × 0.53 × 0.81 of its scale, lifted 0.18);
    // the shore's low rocks also get tide pools at their feet.
    decor.forEach((item, i) => {
        if (item.kind !== "rock") return;
        const zone = zoneOf(item.x, item.z);
        const s = item.scale;
        // On the drawn surface itself (decor.ts rockSurfacePoint is the shape vegetation.ts draws).
        for (let k = 0; k < 4; k++) {
            const a = random() * Math.PI * 2;
            const up = 0.1 + random() * 0.75;
            const point = rockSurfacePoint(item, 3, Math.sin(a) * (1 - up), up, Math.cos(a) * (1 - up));
            add("rock_face", `decor${i}`, k, {x: point.x, y: point.y + 0.004, z: point.z}, {x: point.nx, y: point.ny, z: point.nz}, zone);
        }
        if (item.y < 0.4 && item.y > -0.7) {
            const a = random() * Math.PI * 2;
            const r = s * 1.1;
            const x = item.x + Math.sin(a) * r;
            const z = item.z + Math.cos(a) * r;
            add("tide_pool", `decor${i}`, 0, {x, y: Math.max(sampleGround(x, z).height, -0.3) + 0.02, z}, {x: 0, y: 1, z: 0}, zone);
        }
    });

    // The house: its four walls (outward), the eaves, the porch light.
    const c = COTTAGE;
    const walls: Array<{n: Vec3; along: Vec3; half: number; cx: number; cz: number}> = [
        {n: {x: 0, y: 0, z: 1}, along: {x: 1, y: 0, z: 0}, half: c.width / 2, cx: 0, cz: c.depth / 2},
        {n: {x: 0, y: 0, z: -1}, along: {x: 1, y: 0, z: 0}, half: c.width / 2, cx: 0, cz: -c.depth / 2},
        {n: {x: 1, y: 0, z: 0}, along: {x: 0, y: 0, z: 1}, half: c.depth / 2, cx: c.width / 2, cz: 0},
        {n: {x: -1, y: 0, z: 0}, along: {x: 0, y: 0, z: 1}, half: c.depth / 2, cx: -c.width / 2, cz: 0}
    ];
    walls.forEach((wall, w) => {
        for (let k = 0; k < 6; k++) {
            const t = (random() * 2 - 1) * wall.half * 0.85;
            const y = c.floor + 0.4 + random() * (c.wall - 0.7);
            add("house_wall", "house", w * 10 + k, {x: c.x + wall.cx + wall.along.x * t + wall.n.x * 0.01, y, z: c.z + wall.cz + wall.along.z * t + wall.n.z * 0.01}, wall.n, "farm_garden", random() * Math.PI * 2);
        }
        add("house_eave", "house", w, {x: c.x + wall.cx + wall.n.x * (c.overhang * 0.6), y: c.floor + c.wall - 0.02, z: c.z + wall.cz + wall.n.z * (c.overhang * 0.6)}, {x: 0, y: -1, z: 0}, "farm_garden");
    });
    add("porch_light", "house", 0, {x: c.x + c.light.x, y: c.floor + c.light.y + 0.1, z: c.z + c.light.z + 0.06}, {x: 0, y: 0, z: 1}, "farm_garden");
    for (const zone of ["farm_garden", "seashore", "river_lake", "wetland", "rainforest", "woodland", "grassland", "desert", "mountains", "polar"] as ArkZone[]) {
        const lamp = zoneLamp(zone);
        add("lamp", `lamp-${zone}`, 0, {x: lamp.x, y: lamp.y + LAMP.height - 0.15, z: lamp.z + LAMP.radius * 2}, {x: 0, y: 0, z: 1}, zone);
    }

    // Ponds: lily-pad points round the garden pond and the lake's margin.
    for (let k = 0; k < 8; k++) {
        const a = random() * Math.PI * 2;
        const r = GARDEN_POND.radius * Math.sqrt(random()) * 0.8;
        add("pond_surface", "garden-pond", k, {x: GARDEN_POND.x + Math.cos(a) * r, y: GARDEN_POND.y, z: GARDEN_POND.z + Math.sin(a) * r}, {x: 0, y: 1, z: 0}, "farm_garden");
    }
    for (let k = 0; k < 24; k++) {
        const a = random() * Math.PI * 2;
        const r = LAKE.r * (0.7 + random() * 0.22);
        add("pond_surface", "lake", k, {x: LAKE.x + Math.cos(a) * r, y: 0.02, z: LAKE.z + Math.sin(a) * r}, {x: 0, y: 1, z: 0}, "river_lake");
    }

    // The ground: leaf litter under the forests, worm holes in soft soil, burrow mouths in open banks.
    let tries = 0;
    let litter = 0;
    let holes = 0;
    let burrows = 0;
    while (tries++ < 40000 && (litter < 300 || holes < 200 || burrows < 120)) {
        const x = (random() * 2 - 1) * 100;
        const z = (random() * 2 - 1) * 100;
        const surface = surfaceAt(x, z);
        if (surface.waterDepth > 0 || surface.height < 0.4) continue;
        const ground = {x, y: surface.height, z};
        if (litter < 300 && (surface.weights.forest_floor ?? 0) > 0.4) add("leaf_litter", "ground", litter++, ground, surface.normal, surface.zone);
        else if (holes < 200 && ((surface.weights.grass ?? 0) > 0.5 || (surface.weights.tilled ?? 0) > 0.3) && surface.normal.y > 0.95) add("worm_hole", "ground", holes++, ground, surface.normal, surface.zone);
        else if (burrows < 120 && surface.normal.y < 0.97 && surface.normal.y > 0.8 && surface.surface !== "rock" && surface.surface !== "snow") add("burrow", "ground", burrows++, ground, surface.normal, surface.zone, Math.atan2(surface.normal.x, surface.normal.z));
    }
    attachCache = points;
    return points;
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

/** The coast's waterline radius at a bearing, for anything that follows the shore (the tide moves it by `seaLevel`). */
export function shoreRadius(theta: number): number {
    return coastRadius(theta) - BEACH_INSET + 1;
}
