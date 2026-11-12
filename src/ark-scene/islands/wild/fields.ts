/**
 * The wild island's landforms (Part C; islands plan §2.2–§2.3, decisions 21 and 54): the coast, the polar cove, the
 * mountain spine and its summits, the river from its spring to its estuary, the lake, the wetland's basin, the sea
 * floor (the reef lagoon in the south-west, the kelp off the cold north-west shore, the deep drop-off in the east),
 * and the three climate fields the biomes are read from (`biomes.ts`): elevation, temperature and moisture.
 *
 * Pure functions of (x, z) in metres, x east, z south, y up. Nothing here reads a clock or a random number: every
 * shape is a constant or a seeded noise (`world.ts` fbm), so every device, the server's slot atlas and player control
 * see the same island.
 *
 * Bearings (`bearingOf`) are compass bearings in radians: 0 north (−z), π/2 east, π south (the opening camera's side),
 * 3π/2 west.
 */

import {fbm, noise, smoothstep} from "@/ark-scene/world";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// MARK: - Helpers

export function bearingOf(x: number, z: number): number {
    const b = Math.atan2(z, x) + Math.PI / 2;
    return b < 0 ? b + TAU : b >= TAU ? b - TAU : b;
}

/** The signed difference a − b of two bearings, in −π…π. */
export function bearingDiff(a: number, b: number): number {
    let d = (a - b) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
}

/** A smooth bump round a bearing (degrees), `width` radians to about 1/e. */
function bump(b: number, centreDeg: number, width: number): number {
    const d = bearingDiff(b, centreDeg * DEG) / width;
    return Math.exp(-d * d);
}

export function distanceToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): {d: number; t: number} {
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.min(Math.max(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0), 1);
    return {d: Math.hypot(px - ax - dx * t, pz - az - dz * t), t};
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// MARK: - The coast

/** How far the land reaches from the middle at a bearing (m), before the coast's small noise and the cove. */
export function coastRadius(b: number): number {
    return 199
        + 5.5 * Math.sin(3 * b + 0.9)
        + 3.5 * Math.sin(5 * b - 1.4)
        + 2.2 * Math.sin(9 * b + 2.6)
        + 1.2 * Math.sin(14 * b + 0.3)
        // The savanna's shoulder in the south-east, the woodland's headland in the west, the north-east's bluff.
        + 16 * bump(b, 135, 0.42)
        + 12 * bump(b, 268, 0.3)
        + 9 * bump(b, 48, 0.28)
        // The rocky headland in the north-west (the kelp's shore).
        + 9 * bump(b, 318, 0.2)
        // The beach's bay in the south, the reef lagoon's in the south-west, the desert's straight east coast.
        - 9 * bump(b, 178, 0.22)
        - 13 * bump(b, 224, 0.2)
        - 8 * bump(b, 88, 0.3);
}

/** The polar cove (decision of 2026-11-11: its ice reaches the sea): an inlet in the north shore between two massifs. */
export const COVE = {x: 22, z: -204, rx: 40, rz: 58};
/** The ice shelf: the cove's inner reach (z past this), a little above the sea, its front ragged. */
export const ICE_FRONT_Z = -168;
export const ICE_HEIGHT = 0.75;

/** The cove's ellipse distance (1 on its rim). */
export function coveDistance(x: number, z: number): number {
    return Math.hypot((x - COVE.x) / COVE.rx, (z - COVE.z) / COVE.rz);
}

/**
 * Metres inside the coast (negative at sea): the radial coast with a little noise, cut by the cove. Inside the cove the
 * ice shelf counts as land (`iceShelf`), so its animals stand on it as they did on today's cove ice.
 */
export function inlandOf(x: number, z: number): {inland: number; radial: number; cove: number} {
    const b = bearingOf(x, z);
    const radial = coastRadius(b) - Math.hypot(x, z) + 3 * (fbm(x * 0.05, z * 0.05) - 0.5);
    const c = coveDistance(x, z);
    const cove = (c - 1) * 36 + 2 * (fbm(x * 0.09 + 3, z * 0.09) - 0.5);
    return {inland: Math.min(radial, cove), radial, cove};
}

/** How much of the ice shelf a point in the cove is (0…1). */
export function iceShelf(x: number, z: number): number {
    const front = ICE_FRONT_Z - 5 * (fbm(x * 0.08 + 7, 1.3) - 0.5) - 3 * Math.sin(x * 0.21);
    return smoothstep(front - 1.2, front + 1.2, z) * (coveDistance(x, z) < 1.05 ? 1 : 0);
}

/** The beach's bearings (south and south-east) and how much of a cliff the rest of the coast is. */
export function cliffAt(b: number, x: number, z: number): number {
    const rocky = Math.min(1, 1.05 * bump(b, 312, 0.62) + 0.75 * bump(b, 32, 0.32) + 0.35 * bump(b, 262, 0.25));
    const broken = smoothstep(0.32, 0.62, noise(b * 3.1 + 4, 0.5));
    const cove = smoothstep(1.7, 1.15, coveDistance(x, z));
    return rocky * (0.35 + 0.65 * broken) * (1 - cove);
}

// MARK: - Mountains

/** The mountain spine along the north, west to east (islands plan §2.3). */
export const SPINE: ReadonlyArray<readonly [number, number]> = [[-176, -48], [-138, -80], [-96, -100], [-52, -112], [-12, -117], [30, -112], [72, -104], [114, -86], [150, -58]];
/** The crest's height between the summits (cols), at each spine vertex. */
const CREST: readonly number[] = [10, 26, 34, 40, 36, 32, 40, 30, 12];
/** The summits: horns above the crest. */
export const SUMMITS: ReadonlyArray<{x: number; z: number; h: number; r: number; name: string}> = [
    {x: -116, z: -104, h: 46, r: 44, name: "west"},
    {x: -58, z: -126, h: 70, r: 52, name: "high"},
    {x: -14, z: -134, h: 54, r: 36, name: "cove-west"},
    {x: 64, z: -124, h: 62, r: 46, name: "cove-east"},
    {x: 118, z: -98, h: 38, r: 40, name: "east"}
];

function spineDistance(x: number, z: number): {d: number; crest: number} {
    let best = Infinity;
    let crest = 0;
    for (let i = 1; i < SPINE.length; i++) {
        const {d, t} = distanceToSegment(x, z, SPINE[i - 1][0], SPINE[i - 1][1], SPINE[i][0], SPINE[i][1]);
        if (d < best) {
            best = d;
            crest = lerp(CREST[i - 1], CREST[i], t);
        }
    }
    return {d: best, crest};
}

/** The mountains' height above the lowland at a point (m), before the coast eases it down. */
function massifHeight(x: number, z: number, smooth = false): number {
    const {d, crest} = spineDistance(x, z);
    // Ridged noise: arêtes and gullies, stronger higher up (none for the regional height the biomes read).
    const rough = smooth ? 0.5 : 1 - Math.abs(2 * fbm(x * 0.03 + 3.1, z * 0.03 - 1.7) - 1);
    const width = 76 + 16 * (fbm(x * 0.011 + 8, z * 0.011) - 0.5);
    const ridge = crest * Math.pow(Math.max(0, 1 - d / width), 1.5) * (0.85 + 0.3 * rough);
    let horns = 0;
    for (const s of SUMMITS) {
        const facing = smooth ? 0.5 : 0.5 + 0.5 * Math.cos(3 * Math.atan2(z - s.z, x - s.x) + s.x * 0.37);
        const q = Math.hypot(x - s.x, z - s.z) / (s.r * (0.72 + 0.42 * facing));
        if (q < 1) horns = Math.max(horns, (s.h - crest * 0.6) * Math.pow(1 - q, 1.65) * (0.84 + 0.32 * rough));
    }
    const base = ridge + horns;
    if (smooth) return base;
    const gully = 1 - Math.abs(2 * fbm(x * 0.07 + 9, z * 0.07 - 4) - 1);
    return Math.max(0, base - 4 * gully * gully * smoothstep(8, 30, base));
}

// MARK: - Fresh water

/** The lake, in the woodland's valley below the spine; its surface (m above the sea). */
export const LAKE = {x: -62, z: -14, r: 28, level: 6};

export type RiverPoint = {x: number; z: number; level: number; width: number; depth: number};

/** The upper river: from its spring below the snowline, down the woodland's valley, into the lake. */
export const RIVER_UPPER: readonly RiverPoint[] = [
    {x: -100, z: -76, level: 21, width: 1.1, depth: 0.4},
    {x: -94, z: -62, level: 17.5, width: 1.5, depth: 0.5},
    {x: -86, z: -48, level: 13.5, width: 1.8, depth: 0.55},
    {x: -78, z: -38, level: 10, width: 2.1, depth: 0.6},
    {x: -70, z: -30, level: 7.4, width: 2.4, depth: 0.65},
    {x: -64, z: -24, level: LAKE.level, width: 2.6, depth: 0.7}
];

/** The mouth: on the south-west coast between the rainforest and the beach. */
export const MOUTH_BEARING = 204 * DEG;

/** The lower river: out of the lake, through the wetland and the floodplain, to a mangrove estuary. */
export const RIVER_LOWER: readonly RiverPoint[] = (() => {
    const mouthR = coastRadius(MOUTH_BEARING) + 12;
    const mouth = {x: Math.sin(MOUTH_BEARING) * mouthR, z: -Math.cos(MOUTH_BEARING) * mouthR};
    return [
        {x: -52, z: 8, level: LAKE.level, width: 2.8, depth: 0.8},
        {x: -46, z: 24, level: 4.6, width: 3, depth: 0.85},
        {x: -38, z: 40, level: 2.8, width: 3.3, depth: 0.9},
        {x: -30, z: 55, level: 1.35, width: 3.6, depth: 1},
        {x: -26, z: 72, level: 1.0, width: 3.8, depth: 1},
        {x: -34, z: 94, level: 0.85, width: 4, depth: 1.05},
        {x: -46, z: 116, level: 0.62, width: 4.4, depth: 1.1},
        {x: -58, z: 136, level: 0.4, width: 5, depth: 1.2},
        {x: -66, z: 152, level: 0.2, width: 6, depth: 1.3},
        {x: mouth.x * 0.94, z: mouth.z * 0.94, level: 0.05, width: 7.5, depth: 1.4},
        {x: mouth.x, z: mouth.z, level: 0, width: 9, depth: 1.6}
    ];
})();

export type RiverHit = {d: number; level: number; width: number; depth: number; along: number; upper: boolean; dx: number; dz: number};

function nearestOn(list: readonly RiverPoint[], x: number, z: number, upper: boolean, total: {length: number}): RiverHit {
    let best: RiverHit = {d: Infinity, level: 0, width: 1, depth: 0.5, along: 0, upper, dx: 0, dz: 1};
    let before = 0;
    let length = 0;
    for (let i = 1; i < list.length; i++) length += Math.hypot(list[i].x - list[i - 1].x, list[i].z - list[i - 1].z);
    total.length = length;
    for (let i = 1; i < list.length; i++) {
        const a = list[i - 1];
        const b = list[i];
        const seg = Math.hypot(b.x - a.x, b.z - a.z);
        const {d, t} = distanceToSegment(x, z, a.x, a.z, b.x, b.z);
        if (d < best.d) best = {d, level: lerp(a.level, b.level, t), width: lerp(a.width, b.width, t), depth: lerp(a.depth, b.depth, t), along: (before + t * seg) / length, upper, dx: (b.x - a.x) / seg, dz: (b.z - a.z) / seg};
        before += seg;
    }
    return best;
}

const upperLength = {length: 0};
const lowerLength = {length: 0};

/** The nearest point of the river (either reach): distance to its line, its surface there, its width and depth. */
export function riverAt(x: number, z: number): RiverHit {
    const upper = nearestOn(RIVER_UPPER, x, z, true, upperLength);
    const lower = nearestOn(RIVER_LOWER, x, z, false, lowerLength);
    return upper.d <= lower.d ? upper : lower;
}

/** How far along the whole river (0 at the spring, 1 at the mouth), for the rapids (the upper third) and the estuary. */
export function riverAlong(hit: RiverHit): number {
    const total = upperLength.length + lowerLength.length || 1;
    return hit.upper ? (hit.along * upperLength.length) / total : (upperLength.length + hit.along * lowerLength.length) / total;
}

/** The lake's shore (m from its middle), wandering. */
export function lakeEdge(x: number, z: number): number {
    return LAKE.r + 3 * (fbm(x * 0.07 + 2, z * 0.07 - 6) - 0.5) + 2 * Math.sin(Math.atan2(z - LAKE.z, x - LAKE.x) * 3 + 1);
}

/** The wetland's basin: a low floodplain round the lower river (0…1, 1 deep inside), its edge warped. */
export const WETLAND = {x: -30, z: 80, rx: 56, rz: 46, level: 0.95};
export function wetlandBasin(x: number, z: number, outer = 1.08, inner = 0.62): number {
    const wx = x + 16 * (fbm(x * 0.02 + 11, z * 0.02) - 0.5);
    const wz = z + 16 * (fbm(x * 0.02, z * 0.02 + 11) - 0.5);
    const e = Math.hypot((wx - WETLAND.x) / WETLAND.rx, (wz - WETLAND.z) / WETLAND.rz);
    return smoothstep(outer, inner, e);
}

// MARK: - The sea floor

/** The reef lagoon off the south-west coast: how much a bearing is the lagoon's. */
export function lagoonOf(b: number): number {
    return smoothstep(0.2, 0.75, bump(b, 226, 0.3));
}

/** The east's drop-off (decision 53's room for whales, past the narrow shelf). */
export function dropOffOf(b: number): number {
    return bump(b, 94, 0.44);
}

/** The kelp's cold rocky shore in the north-west. */
export function kelpOf(b: number): number {
    return bump(b, 302, 0.36);
}

/** Depth (m, positive down) of the sea floor `off` metres out from the coast. */
export function seaDepth(x: number, z: number, b: number, off: number): {depth: number; reef: number} {
    const shelf = 0.6 + 0.14 * off + 0.0026 * off * off;
    const east = dropOffOf(b);
    let depth = shelf + east * (22 * smoothstep(5, 24, off) + 52 * smoothstep(24, 72, off));
    // The lagoon: sheltered and shallow inside the reef's crest, the crest itself awash at low water, deep outside it.
    const lagoon = lagoonOf(b);
    let reef = 0;
    if (lagoon > 0) {
        const crestAt = 46 + 6 * (fbm(b * 9, 3.3) - 0.5) * 2;
        const inside = 1.1 + 2.9 * smoothstep(0, 18, off);
        const crest = 0.7 + 0.5 * fbm(x * 0.15, z * 0.15);
        const outside = 1.2 + 20 * smoothstep(crestAt + 4, crestAt + 22, off) + 0.002 * off * off;
        const reefDepth = off < crestAt - 6 ? inside : off < crestAt + 4 ? lerp(inside, crest, smoothstep(crestAt - 6, crestAt - 1, off)) : lerp(crest, outside, smoothstep(crestAt + 3, crestAt + 8, off));
        depth = lerp(depth, reefDepth, lagoon);
        reef = lagoon * smoothstep(1, 8, off) * (1 - smoothstep(crestAt + 10, crestAt + 20, off));
    }
    // The cove: cold water 3–12 m deep, deepest at its mouth.
    const c = coveDistance(x, z);
    if (c < 1.4) {
        const coveDepth = 2.5 + 8 * smoothstep(ICE_FRONT_Z, COVE.z - COVE.rz, z);
        depth = lerp(depth, Math.min(depth, coveDepth), smoothstep(1.4, 1, c));
    }
    depth += 0.7 * (fbm(x * 0.08, z * 0.08) - 0.5);
    return {depth: Math.min(Math.max(depth, 0.3), 110), reef};
}

// MARK: - Elevation, temperature, moisture

/**
 * The land's elevation before the water is cut in (m): a coastal plain rising inland, rolling hills (higher in the
 * west), the mountain spine, the wetland's flat basin, eased to the coast.
 */
export function elevationOf(x: number, z: number, inland: number, regional = false): number {
    const d = Math.max(inland, 0);
    const coastal = 0.9 + 3 * smoothstep(0, 40, d) + 3.6 * smoothstep(30, 150, d);
    const west = smoothstep(60, -130, x);
    const hillAmp = 2.5 + 9 * west * (1 - smoothstep(60, 140, z) * 0.5);
    const hills = hillAmp * smoothstep(0.34, 0.8, fbm(x * 0.012 + 40, z * 0.012 - 12));
    const massif = massifHeight(x, z, regional) * smoothstep(0, 30, d);
    let e = coastal + hills + massif;
    // The wetland lies low and flat.
    const basin = wetlandBasin(x, z);
    if (basin > 0) e = lerp(e, 0.85 + 0.6 * fbm(x * 0.06, z * 0.06), basin * 0.95);
    return e;
}

/** Temperature (about 0 icy, 1 tropical): cooler to the north and with height, coldest by the cove's ice. */
export function temperatureOf(x: number, z: number, elevation: number): number {
    const north = smoothstep(200, -210, z);
    const cove = Math.exp(-((x - COVE.x) ** 2 + (z - (COVE.z + 44)) ** 2) / (100 * 100));
    return 1.02 - 0.4 * north - elevation / 95 - 0.45 * cove + 0.06 * (fbm(x * 0.018 + 5, z * 0.018 + 3) - 0.5);
}

/**
 * Moisture (0 dry, 1 wet): the wet west and south-west (the sea wind), the rain shadow east of the spine, wetter by the
 * river, the lake and the wetland.
 */
export function moistureOf(x: number, z: number, river: RiverHit): number {
    const westEast = 0.6 - 0.44 * Math.max(-1, Math.min(1, x / 175));
    const southWest = 0.1 * smoothstep(-20, -150, x) * smoothstep(-30, 120, z);
    const shadow = 0.2 * smoothstep(-20, 90, x) * smoothstep(30, -110, z) + 0.1 * smoothstep(95, 155, x);
    const lakeNear = 0.18 * Math.exp(-Math.max(Math.hypot(x - LAKE.x, z - LAKE.z) - LAKE.r, 0) / 30);
    const riverNear = 0.2 * Math.exp(-river.d / 22) * (river.upper ? 0.6 : 1);
    const wet = 0.2 * wetlandBasin(x, z);
    return westEast + southWest - shadow + lakeNear + riverNear + wet + 0.08 * (fbm(x * 0.016 - 7, z * 0.016 + 2) - 0.5);
}
