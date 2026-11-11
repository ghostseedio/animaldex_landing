/**
 * The Ark's one world: an island on a calm sea, its seven regions laid out
 * as areas of it (contract section 4). Pure functions of (x, z) in metres,
 * y up; +z faces the opening camera (south), so the sea and the coast are in
 * front, the mountains and the ice behind.
 *
 *            polar     mountains
 *     woodland            grassland
 *   rainforest   lake  wetland    desert
 *        reef   coast   home
 *                   open ocean
 *
 * Everything is deterministic: the same world on every device, so a
 * position derived here (`placement.ts`) is the same for every viewer.
 */

import type {ArkRegion, ArkZone} from "@/ark-scene/types";
import {REGION_ZONES} from "@/ark-scene/types";

// MARK: - Noise

function hash2(x: number, z: number): number {
    let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number): number {
    return t * t * (3 - 2 * t);
}

/** Value noise in 0…1. */
export function noise(x: number, z: number): number {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const fx = smooth(x - xi);
    const fz = smooth(z - zi);
    const a = hash2(xi, zi);
    const b = hash2(xi + 1, zi);
    const c = hash2(xi, zi + 1);
    const d = hash2(xi + 1, zi + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Four octaves, 0…1. */
export function fbm(x: number, z: number): number {
    let sum = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let i = 0; i < 4; i++) {
        sum += amplitude * noise(x * frequency + i * 17.3, z * frequency - i * 9.1);
        frequency *= 2.03;
        amplitude *= 0.5;
    }
    return sum / 0.9375;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}

/** A seeded generator (mulberry32), for decor and for anything placed from a hash. */
export function seeded(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** FNV-1a of a string, for ids. */
export function hashString(value: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

// MARK: - Shape

/** How far the land reaches from the middle, at this bearing (radians, 0 = +x). */
export function coastRadius(theta: number): number {
    return 78
        + 5.5 * Math.sin(3 * theta + 1.1)
        + 3.5 * Math.sin(5 * theta - 0.4)
        + 2 * Math.sin(9 * theta + 2.3)
        + homeLobe(theta);
}

/**
 * The home district's land (home growth, 2026-11-11; owner decision: grow the home area now, before launch, so the
 * hamlet's full cap of 16 houses and 6 smallholdings has land: `map/hamlet.ts`). Metres added to the coast at a
 * bearing: the south lobe fills the old bay in front of Home and reaches 32 m further south (the hamlet's streets
 * and the beach before them), and the east shoulder takes the east coast 30 m out (the hamlet's east end and the
 * desert, which moved onto it). Zero west of the river's mouth (the reef, the rainforest) and north of the
 * grassland's shore (the ice, the mountain).
 */
const HOME_LOBE = {south: 32, southFrom: [16, 46], southTo: [97, 119], east: 30, eastFrom: [-44, -8], eastTo: [40, 60]} as const;
export function homeLobe(theta: number): number {
    const turned = ((((theta * 180) / Math.PI) % 360) + 360) % 360;
    const degrees = turned > 180 ? turned - 360 : turned;
    const L = HOME_LOBE;
    const south = L.south * smoothstep(L.southFrom[0], L.southFrom[1], degrees) * (1 - smoothstep(L.southTo[0], L.southTo[1], degrees));
    const east = L.east * smoothstep(L.eastFrom[0], L.eastFrom[1], degrees) * (1 - smoothstep(L.eastTo[0], L.eastTo[1], degrees));
    return Math.max(south, east);
}

/** A point at this bearing, `offset` metres outside the coast (negative: inland). */
function coastPoint(theta: number, offset: number): {x: number; z: number} {
    const r = coastRadius(theta) + offset;
    return {x: Math.cos(theta) * r, z: Math.sin(theta) * r};
}

export const LAKE = {x: -4, z: -4, r: 10.5};
/** The river, from the lake out to the southern coast. */
export const RIVER: Array<[number, number]> = [[-4, -4], [-10, 12], [-19, 28], [-24, 46], [-27, 66], [-29, 92]];

export type ZoneSite = {
    x: number;
    z: number;
    /** Metres between neighbouring animals. */
    spacing: number;
    /** Land animals stand, sea animals float; the lake's sit in a ring round its shore; the coast's along the beach. */
    kind: "land" | "sea" | "ring" | "shore";
    /** For the shore: the bearing of the stretch of coast it starts from. */
    theta?: number;
    /** The open ground kept clear of trees and rocks about the site. */
    clearing: number;
};

const SOUTH = Math.PI / 2;
/** The coast's stretch of beach: south-east of the river's mouth, clear of the fields. */
const SHORE_THETA = SOUTH - 0.3;
/** Metres inside the coast line where the beach is dry: the waterline is at about 4.5. */
export const BEACH_INSET = 5.6;

/** Where each zone's animals gather. */
export const ZONE_SITES: Record<ArkZone, ZoneSite> = {
    farm_garden: {x: 8, z: 34, spacing: 2.6, kind: "land", clearing: 13},
    // On the beach itself, just above the waterline (about 4.5 m inside the coast line), facing the sea.
    seashore: {...coastPoint(SHORE_THETA, -6), spacing: 2.4, kind: "shore", clearing: 8, theta: SHORE_THETA},
    coral_reef: {...coastPoint(SOUTH + 0.62, 15), spacing: 4.2, kind: "sea", clearing: 0},
    open_ocean: {...coastPoint(SOUTH - 0.5, 30), spacing: 7, kind: "sea", clearing: 0},
    river_lake: {x: LAKE.x, z: LAKE.z, spacing: 2.6, kind: "ring", clearing: LAKE.r + 6},
    wetland: {x: 20, z: 10, spacing: 2.6, kind: "land", clearing: 9},
    rainforest: {x: -46, z: 18, spacing: 2.8, kind: "land", clearing: 11},
    woodland: {x: -40, z: -26, spacing: 2.8, kind: "land", clearing: 11},
    // Home growth: the grassland's animals gather further north and west (the hamlet's farms are where they stood),
    // and the desert moved onto the new east shore (Home took its old ground).
    grassland: {x: 25, z: -27, spacing: 3, kind: "land", clearing: 14},
    desert: {x: 103, z: -6, spacing: 2.8, kind: "land", clearing: 12},
    mountains: {x: -8, z: -46, spacing: 2.8, kind: "land", clearing: 11},
    polar: {...coastPoint(-Math.PI / 2 + 0.55, -13), spacing: 2.8, kind: "land", clearing: 11}
};

const LAND_ZONES = ["farm_garden", "seashore", "river_lake", "wetland", "rainforest", "woodland", "grassland", "desert", "mountains", "polar"] as const;
type LandZone = typeof LAND_ZONES[number];

/** Where the land zones' areas are centred (the lake's is its eastern shore, so the water itself stays the lake's). */
const ZONE_CENTRES: Record<LandZone, {x: number; z: number}> = {
    farm_garden: {x: 6, z: 36},
    seashore: coastPoint(SHORE_THETA, -3),
    river_lake: {x: LAKE.x - 4, z: LAKE.z - 2},
    wetland: {x: 22, z: 12},
    rainforest: {x: -48, z: 20},
    woodland: {x: -42, z: -26},
    grassland: {x: 42, z: -16},
    desert: {x: 105, z: -4},
    mountains: {x: -10, z: -50},
    polar: {x: ZONE_SITES.polar.x + 4, z: ZONE_SITES.polar.z - 4}
};

/**
 * Zones whose area reaches round more than one centre (the nearest counts). Home growth: Home's district spreads over
 * the new south lobe and east along the coast to the desert, round the hamlet's streets.
 */
const MORE_CENTRES: Partial<Record<LandZone, Array<{x: number; z: number}>>> = {
    farm_garden: [{x: 30, z: 72}, {x: 8, z: 86}, {x: 48, z: 56}, {x: 52, z: 34}, {x: 56, z: 20}, {x: 34, z: 26}, {x: 60, z: 4}]
};

/**
 * The visitors' landing (the chat's animal shown in the Ark before one is
 * aboard): a small jetty on the beach a little along from the Coast's
 * animals. A land animal stands at its foot; a swimmer waits off its end.
 */
export const VISITOR_LANDING = (() => {
    const theta = SHORE_THETA + 0.3;
    return {theta, foot: coastPoint(theta, -(BEACH_INSET + 0.8)), end: coastPoint(theta, 7.5), deckFrom: coastPoint(theta, -3.5), deckTo: coastPoint(theta, 6)};
})();

/** A region's middle, for its label and for flying to it. */
export function regionCentre(region: ArkRegion): {x: number; z: number; radius: number} {
    const sites = REGION_ZONES[region].map((zone) => ZONE_SITES[zone]);
    const x = sites.reduce((sum, site) => sum + site.x, 0) / sites.length;
    const z = sites.reduce((sum, site) => sum + site.z, 0) / sites.length;
    const spread = Math.max(...sites.map((site) => Math.hypot(site.x - x, site.z - z)));
    if (region === "ocean") {
        // Its two sites sit either side of the coast's middle: the label belongs out at sea.
        const out = (coastRadius(Math.atan2(z, x)) + 16) / Math.hypot(x, z);
        return {x: x * out, z: z * out, radius: spread + 16};
    }
    return {x, z, radius: spread + 16};
}

/**
 * Where a region's name is drawn: over its own ground. The lake's open
 * water for Fresh water (its animals ring the shore), the beach for the
 * Coast, just off the coast for the Ocean, the middle of the land zones' areas for
 * the rest. The scene then nudges each name clear of the tokens on screen.
 */
export function regionLabelAnchor(region: ArkRegion): {x: number; z: number} {
    switch (region) {
        case "ocean": {
            // Just off the southern coast, between the reef and the open water.
            const theta = Math.atan2(ZONE_SITES.coral_reef.z + ZONE_SITES.open_ocean.z, ZONE_SITES.coral_reef.x + ZONE_SITES.open_ocean.x);
            return coastPoint(theta, 9);
        }
        case "coast":
            return coastPoint(SHORE_THETA, -BEACH_INSET);
        case "fresh_water":
            // Over the lake's open water, inside the ring of animals on its shore.
            return {x: LAKE.x, z: LAKE.z};
        case "home":
            return {x: ZONE_CENTRES.farm_garden.x - 4, z: ZONE_CENTRES.farm_garden.z + 8};
        default: {
            const zones = REGION_ZONES[region] as readonly LandZone[];
            return {
                x: zones.reduce((sum, zone) => sum + ZONE_CENTRES[zone].x, 0) / zones.length,
                z: zones.reduce((sum, zone) => sum + ZONE_CENTRES[zone].z, 0) / zones.length
            };
        }
    }
}

// MARK: - Sampling

export type GroundSample = {
    height: number;
    /** Land zones' weights at the point, summing to 1. */
    weights: Record<LandZone, number>;
    /** 1 inland, 0 at the waterline and out to sea. */
    land: number;
    /** How far inside the coast (negative at sea). */
    inland: number;
    /** Metres to the river's line. */
    river: number;
    /** 0…1 how close to the coral reef (for the sea floor's colour). */
    reef: number;
    /** 0…1 how much of a sea cliff this stretch of coast is. */
    cliff: number;
};

function distanceToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.min(Math.max(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0), 1);
    return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

export function riverDistance(x: number, z: number): number {
    let best = Infinity;
    for (let i = 1; i < RIVER.length; i++) {
        best = Math.min(best, distanceToSegment(x, z, RIVER[i - 1][0], RIVER[i - 1][1], RIVER[i][0], RIVER[i][1]));
    }
    return best;
}

/**
 * The hamlet's lanes (home growth, 2026-11-11): earth lanes the plots front onto. `map/hamlet.ts` plans the reserved
 * plots along them, `terrain.ts` paints them, and the fields keep their crops off the village round them (`fields.ts`).
 * Polylines of (x, z); the first is the village street past today's cottage.
 */
export type HamletLane = {
    /** A street (cottages front onto it) or a farm track (the smallholdings' yards and paddocks open onto it). */
    kind: "street" | "track";
    points: Array<[number, number]>;
    /** A street with smallholdings on one side (1: right of its way, -1: left) and cottages on the other. */
    farmSide?: 1 | -1;
};
export const HAMLET_LANES: HamletLane[] = [
    // The village street: past the cottage's gate, then east between the two rows of the east end.
    {kind: "street", points: [[-21, 63], [-8, 63.5], [4, 62.8], [16, 62.5], [30, 62], [59, 47.5], [88, 33], [100, 27]]},
    // Shore lane: down past the old orchard's ground to the beach, then west along it to the river's mouth.
    {kind: "street", points: [[26, 61.9], [25, 80], [24, 95], [8, 98], [-6, 98.5], [-20, 97.5]]},
    // The upper street, 38 m behind the village street (back gardens meet between them), the farms on its north side.
    {kind: "street", points: [[24, 22.5], [71, -1], [83, -7], [95, -13]]},
    // A farm track north to the grassland's edge.
    {kind: "track", points: [[71, -1], [73, -14], [76, -30]]}
];
/** A lane's width (m), its verges not counted. */
export const LANE_WIDTH = 3.2;
/** How far from a lane the village's plots reach (a lane, a house's depth and a margin): Home's own trees keep out. */
export const VILLAGE_REACH = 26;

/** The lanes' bounding box, grown by the village's reach and its blend (a quick test before `laneDistance`). */
const VILLAGE_BOX = (() => {
    const xs = HAMLET_LANES.flatMap((lane) => lane.points.map((p) => p[0]));
    const zs = HAMLET_LANES.flatMap((lane) => lane.points.map((p) => p[1]));
    const pad = VILLAGE_REACH + 8;
    return xs.length ? {x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, z0: Math.min(...zs) - pad, z1: Math.max(...zs) + pad} : {x0: 0, x1: 0, z0: 0, z1: 0};
})();

/** Metres to the nearest lane's middle line. */
export function laneDistance(x: number, z: number): number {
    let best = Infinity;
    for (const {points} of HAMLET_LANES) {
        for (let i = 1; i < points.length; i++) best = Math.min(best, distanceToSegment(x, z, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]));
    }
    return best;
}

/** Rolling hills (graphics pass, batch 2): broad rises 0…1, for the forests and the grassland. */
function hills(x: number, z: number): number {
    return smoothstep(0.32, 0.82, fbm(x * 0.017 + 40, z * 0.017 - 12));
}

/** How each land zone shapes its ground. */
function zoneHeight(zone: LandZone, x: number, z: number): number {
    const n = fbm(x * 0.045, z * 0.045);
    switch (zone) {
        case "farm_garden":
            return 0.9 + 0.5 * n;
        case "seashore":
            return 0.6 + 0.6 * n;
        case "river_lake":
            return 0.7 + 0.6 * n;
        case "wetland":
            return 0.12 + 0.9 * (fbm(x * 0.09, z * 0.09) - 0.5);
        case "rainforest":
            return 1.4 + 2.4 * n + 7.5 * hills(x, z);
        case "woodland":
            return 1.6 + 3 * n + 9 * hills(x, z);
        case "grassland":
            return 1 + 1.6 * n + 4.5 * hills(x, z);
        case "desert": {
            const dune = Math.abs(Math.sin((x * 0.75 + z * 0.62) * 0.22 + 3 * fbm(x * 0.03, z * 0.03)));
            return 1.1 + 1.6 * dune * dune + 0.6 * n;
        }
        case "mountains": {
            // Ridged: three octaves of folded noise, sharp crests and gullies, highest at the back.
            let ridge = 0;
            let amplitude = 1;
            let frequency = 0.026;
            for (let i = 0; i < 3; i++) {
                const r = 1 - Math.abs(2 * fbm(x * frequency + 3.1 + i * 7, z * frequency - 1.7 - i * 3) - 1);
                ridge += r * r * amplitude;
                amplitude *= 0.42;
                frequency *= 2.15;
            }
            ridge /= 1.6;
            const back = smoothstep(-25, -75, z);
            // Graphics pass, batch 2: a massif along an east-west spine (not a lone cone), its crest broken into
            // peaks and cols, ridges running down from it and gullies cut between them, deeper higher up.
            const spine = distanceToSegment(x, z, -44, -66, 16, -61);
            const massif = Math.pow(smoothstep(48, 0, spine), 1.3);
            const peaks = 1 - Math.abs(2 * fbm(x * 0.021 + 1.3, z * 0.021 + 2.1) - 1);
            const gully = 1 - Math.abs(2 * fbm(x * 0.075 + 9, z * 0.075 - 4) - 1);
            const base = 2.5 + (13 * massif + 17 * ridge * (0.35 + 0.65 * massif) + 6 * peaks * massif) * (0.45 + 0.75 * back) + 2 * n;
            return base - 3.4 * gully * gully * smoothstep(6, 24, base);
        }
        case "polar":
            return 1.8 + 2.2 * n;
    }
}

const SOFTNESS = 5.5;

const siteBases = new Map<LandZone, number>();
function siteBase(zone: LandZone): number {
    let base = siteBases.get(zone);
    if (base === undefined) {
        const site = ZONE_SITES[zone];
        base = Math.max(Math.min(zoneHeight(zone, site.x, site.z), zone === "mountains" ? 9 : 4), 0.5);
        siteBases.set(zone, base);
    }
    return base;
}

export function sampleGround(x: number, z: number): GroundSample {
    const theta = Math.atan2(z, x);
    const r = Math.hypot(x, z);
    const inland = coastRadius(theta) - r + 3 * (fbm(x * 0.06, z * 0.06) - 0.5);

    // Zone weights: nearest centre wins, blended over a few metres, the edges warped so they never run straight.
    const wx = x + 14 * (fbm(x * 0.02 + 5, z * 0.02) - 0.5);
    const wz = z + 14 * (fbm(x * 0.02, z * 0.02 + 5) - 0.5);
    const distances = LAND_ZONES.map((zone) => {
        const d = Math.hypot(wx - ZONE_CENTRES[zone].x, wz - ZONE_CENTRES[zone].z);
        const more = MORE_CENTRES[zone];
        return more ? Math.min(d, ...more.map((c) => Math.hypot(wx - c.x, wz - c.z))) : d;
    });
    const nearest = Math.min(...distances);
    const raw = distances.map((d) => Math.exp(-(d - nearest) / SOFTNESS));
    const total = raw.reduce((sum, w) => sum + w, 0);
    const weights = Object.fromEntries(LAND_ZONES.map((zone, i) => [zone, raw[i] / total])) as Record<LandZone, number>;

    let height = 0;
    for (const zone of LAND_ZONES) {
        if (weights[zone] > 0.002) height += weights[zone] * zoneHeight(zone, x, z);
    }
    // The mountain's foothills and second peaks (graphics pass, batch 3): the massif reaches past the mountain zone into
    // its neighbours, so from far it reads as a broad, many-peaked range, not a lone spike.
    {
        const spine = distanceToSegment(x, z, -46, -66, 6, -62);
        const inlandHere = coastRadius(Math.atan2(z, x)) - Math.hypot(x, z);
        const reach = Math.pow(smoothstep(46, 0, spine), 1.6) * smoothstep(0, 14, inlandHere);
        if (reach > 0) {
            const rough = 1 - Math.abs(2 * fbm(x * 0.05 + 21, z * 0.05 - 8) - 1);
            // Flanking summits nearly as high as the main one: a range, many-peaked against the sky. Graphics batch 5:
            // sharp horns (a cusp at the top, roughened) rather than domes, with deep cols between them, so the skyline
            // breaks into separate peaks seen from the valley.
            // Each horn has three arêtes (it reaches further along them) between steeper faces, turned its own way.
            const horn = (cx: number, cz: number, r: number, h: number) => {
                const facing = 0.5 + 0.5 * Math.cos(3 * Math.atan2(z - cz, x - cx) + cx * 0.37);
                const d = Math.hypot(x - cx, z - cz) / (r * (0.74 + 0.4 * facing));
                return d < 1 ? h * (1 - d) ** 1.7 * (0.82 + 0.36 * rough) : 0;
            };
            const notch = (cx: number, cz: number, r: number, h: number) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));
            const peaks = horn(-19, -68, 12, 11) + horn(-36, -67, 14, 15) + horn(3, -63, 13, 12) + horn(-25, -76, 9, 6) - notch(-8, -65, 6, 9) - notch(-28, -66, 5, 7);
            height += (1 - (weights.mountains ?? 0) * 0.7) * reach * (5 + 4 * rough) + peaks * smoothstep(0, 18, inlandHere);
        }
    }
    // The river runs in a valley (graphics pass): the land falls toward it over 16 m either side.
    {
        const along = riverDistance(x, z);
        const inlandHere = coastRadius(Math.atan2(z, x)) - Math.hypot(x, z);
        height -= 1.6 * smoothstep(16, 4, along) * smoothstep(2, 12, inlandHere) * Math.max(height - 0.6, 0) / Math.max(height, 0.6);
    }
    // Each site's clearing is gentle ground, so the animals stand on a meadow and not a cliff.
    for (const zone of LAND_ZONES) {
        const site = ZONE_SITES[zone];
        if (site.kind !== "land") continue;
        const d = Math.hypot(x - site.x, z - site.z);
        if (d > site.clearing + 8) continue;
        const flat = 0.85 * smoothstep(site.clearing + 8, site.clearing * 0.45, d);
        height += (siteBase(zone) + 0.4 * (fbm(x * 0.1, z * 0.1) - 0.5) - height) * flat;
    }

    // The hamlet's village (home growth) lies on gentle ground: within reach of its lanes the land eases toward a
    // low, softly rolling base (the farm's own), so its cottages and smallholdings stand level.
    if (x > VILLAGE_BOX.x0 && x < VILLAGE_BOX.x1 && z > VILLAGE_BOX.z0 && z < VILLAGE_BOX.z1) {
        const lane = laneDistance(x, z);
        if (lane < VILLAGE_REACH + 8) {
            // (Only the open ground the hamlet stands on: the ice, the mountain and the forests keep their shape.)
            const wild = (weights.polar ?? 0) + (weights.mountains ?? 0) + (weights.rainforest ?? 0) + (weights.woodland ?? 0);
            const flat = 0.9 * smoothstep(VILLAGE_REACH + 8, VILLAGE_REACH - 2, lane) * Math.max(0, 1 - 2 * wild);
            height += (1.1 + 0.5 * fbm(x * 0.045, z * 0.045) - height) * flat;
        }
    }

    // The coast: land eases down to the beach, then the sea floor falls away.
    const land = smoothstep(0, 9, inland);
    const reefSite = ZONE_SITES.coral_reef;
    const reef = smoothstep(30, 8, Math.hypot(x - reefSite.x, z - reefSite.z));
    const seaFloor = -1.1 - Math.min(Math.max(-inland, 0) * 0.32, 9) * (1 - 0.75 * reef) + 0.5 * (fbm(x * 0.08, z * 0.08) - 0.5);
    // Cliffs where the forest, the mountains and the ice meet the sea: the land stops short and drops.
    const sheltered = (weights.seashore ?? 0) + (weights.farm_garden ?? 0) + (weights.river_lake ?? 0) + (weights.wetland ?? 0);
    const cliff = smoothstep(0.5, 0.68, noise(theta * 2.6 + 4, 0.5)) * Math.max(0, 1 - sheltered * 2.5) * smoothstep(12, 22, riverDistance(x, z));
    const reach = 8 - 6 * cliff;
    height = inland > -1 ? seaFloor + (height + 2.6 * cliff * smoothstep(0, 3, inland) - seaFloor) * smoothstep(-1, reach, inland) : seaFloor;

    // The lake and its river.
    const lakeEdge = LAKE.r + 2.2 * (fbm(x * 0.12, z * 0.12) - 0.5);
    const lakeDistance = Math.hypot(x - LAKE.x, z - LAKE.z);
    if (lakeDistance < lakeEdge + 4) {
        const depth = -2.4 * (1 - Math.min(lakeDistance / lakeEdge, 1) ** 2) - 0.25;
        height = height + (depth - height) * smoothstep(lakeEdge + 4, lakeEdge - 1, lakeDistance);
    }
    const river = riverDistance(x, z);
    if (river < 6 && inland > -6) {
        const width = 2 + 1.2 * smoothstep(-4, 90, z);
        // A U-shaped bed, deepest in the middle, with a low bank (graphics pass).
        const bed = -1.1 - 0.6 * (1 - Math.min(river / Math.max(width, 0.1), 1) ** 2);
        height = height + (bed - height) * smoothstep(width + 2.2, width * 0.55, river);
    }

    return {height, weights, land, inland, river, reef, cliff};
}

export function heightAt(x: number, z: number): number {
    return sampleGround(x, z).height;
}

/** The land zone with the most weight at a point. */
export function zoneAt(sample: GroundSample): LandZone {
    let best: LandZone = "grassland";
    let weight = -1;
    for (const zone of LAND_ZONES) {
        if (sample.weights[zone] > weight) {
            weight = sample.weights[zone];
            best = zone;
        }
    }
    return best;
}

export const WATER_LEVEL = 0;
/** The terrain mesh's half-width; the sea plane reaches far beyond it. */
export const TERRAIN_HALF = 132;
/** Far enough that the whole world fits from the widest camera distance. */
export const WORLD_RADIUS = 120;
