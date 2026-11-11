/**
 * Ambient fish schools (graphics pass, batch 4): decoration, NOT catalogue
 * animals. They are never counted, never selectable, never in the stats or
 * the snapshot, and nothing in the Ark's ecology reads them.
 *
 * Boids-like to look at, but closed-form: every fish's place is a pure
 * function of the shared clock (epoch seconds) and its school's id, so every
 * viewer and the livestream see the same fish in the same place, with no
 * simulation state and no per-viewer randomness.
 *
 * - A school follows a closed loop through water deep enough for it (seeded
 *   waypoints round its home, checked against the sea bed), at a pace that
 *   breathes. Its fish hold seeded slots in an ellipsoid round the leader's
 *   point and take their own place ON the loop (`u` metres ahead or behind),
 *   so the school bends round curves the way a real one does. Each fish
 *   wanders a little round its slot (alignment, cohesion and separation by
 *   construction: slots are spread evenly, the wander is under half a slot).
 * - Bait schools mill: on seeded slots of the clock the school slows and
 *   its fish circle a torus (a bait ball), then stream out again. The loop's
 *   pace accounts for the time spent milling in closed form, so it never jumps.
 * - Hovering reef fish (damselfish, anthias) stay over their coral head,
 *   facing into the surge, each darting round its own spot.
 *
 * `fishSchoolsNear(pos, radius)` is the API other lanes use (a predator
 * chasing a bait ball, a bird or seal fishing): school centres and radii now.
 * `fish-render.ts` draws them.
 */

import {ZONE_SITES, coastRadius, hashString, heightAt, seeded} from "@/ark-scene/world";
import {coastCliff, reefLandmarks} from "@/ark-scene/reef";

// MARK: - The shared sea clock

let pinnedClock: {epoch: number; at: number} | null = null;

/** Development (golden shots): run the sea's clock from this epoch second, or (null) follow the real clock again. */
export function pinSeaClock(epochSeconds: number | null): void {
    pinnedClock = epochSeconds === null || !Number.isFinite(epochSeconds) ? null : {epoch: epochSeconds, at: nowMs()};
}

function nowMs(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** The sea's clock: epoch seconds, the same for every viewer (or the pinned clock). */
export function seaEpochSeconds(): number {
    return pinnedClock ? pinnedClock.epoch + (nowMs() - pinnedClock.at) / 1000 : Date.now() / 1000;
}

/**
 * The shaders' sea clock wraps every `SEA_CLOCK_PERIOD` seconds (float precision). Every frequency the shaders use
 * makes a whole number of cycles in a period, so the wrap is seamless.
 */
export const SEA_CLOCK_PERIOD = 600;
export function seaClockSeconds(epochSeconds: number): number {
    const t = epochSeconds % SEA_CLOCK_PERIOD;
    return t < 0 ? t + SEA_CLOCK_PERIOD : t;
}

// MARK: - Kinds (looks)

export const FISH_KINDS = ["blue_damsel", "orange_anthias", "yellow_tang", "striped_grunt", "silver_baitfish", "silver_jack", "kelp_perch", "sand_fry"] as const;
export type FishKind = typeof FISH_KINDS[number];

export type FishLook = {
    /** Body length (m). */
    length: number;
    /** Body height and width as a share of the length. */
    height: number;
    width: number;
    back: string;
    belly: string;
    fin: string;
    /** Bars across the body (count, colour), or none. */
    bars?: {count: number; colour: string};
    /** A stripe along the body. */
    stripe?: string;
    /** Silvery fish flash as they turn. */
    metal: number;
    /** Forked tail (true) or round. */
    forked: boolean;
    /** Tail beats a second when cruising. */
    beat: number;
};

/** Decorative looks: generic reef and coast fish, not catalogue species. */
export const FISH_LOOKS: Record<FishKind, FishLook> = {
    blue_damsel: {length: 0.075, height: 0.42, width: 0.16, back: "#2f6f9a", belly: "#8fc6c9", fin: "#3d8fb0", metal: 0.15, forked: true, beat: 4.2},
    orange_anthias: {length: 0.085, height: 0.36, width: 0.15, back: "#d8643a", belly: "#f0a070", fin: "#e0503a", stripe: "#c84a8a", metal: 0.1, forked: true, beat: 4},
    yellow_tang: {length: 0.18, height: 0.62, width: 0.12, back: "#e8c22e", belly: "#f0d24a", fin: "#e0b020", metal: 0.05, forked: false, beat: 2.4},
    striped_grunt: {length: 0.24, height: 0.34, width: 0.17, back: "#6f7f8f", belly: "#d8d0b0", fin: "#c8a63a", stripe: "#d8b43a", metal: 0.25, forked: true, beat: 2},
    silver_baitfish: {length: 0.13, height: 0.22, width: 0.13, back: "#3a5f78", belly: "#dfe7ea", fin: "#9fb4bf", metal: 0.75, forked: true, beat: 4.8},
    silver_jack: {length: 0.42, height: 0.36, width: 0.13, back: "#4f6f80", belly: "#d6dee0", fin: "#c8b04a", metal: 0.6, forked: true, beat: 2.2},
    kelp_perch: {length: 0.2, height: 0.36, width: 0.16, back: "#6a5a32", belly: "#b8a878", fin: "#7a6a3a", bars: {count: 3, colour: "#4a3e24"}, metal: 0.2, forked: false, beat: 2.2},
    sand_fry: {length: 0.05, height: 0.22, width: 0.14, back: "#9a9a7a", belly: "#e8e4d4", fin: "#c8c4b0", metal: 0.55, forked: true, beat: 5.5}
};

// MARK: - Schools

export type FishStyle = "school" | "roam" | "hover";
export type FishHabitat = "reef" | "reef_edge" | "open_water" | "kelp" | "shallows";

export type FishSchool = {
    /** Stable: `fish:<habitat>:<n>`. */
    id: string;
    kind: FishKind;
    habitat: FishHabitat;
    style: FishStyle;
    count: number;
    /** Where it lives (x, z) and how far it ranges round there (m). */
    home: {x: number; z: number};
    range: number;
    /** Keep this much water above it, and this far over the bed (m). */
    minDepth: number;
    clearance: number;
    /** The school's half-size (m): along its heading, across, up. */
    size: {along: number; across: number; up: number};
    /** Cruising pace (m/s) along its loop. */
    speed: number;
    /** Bait schools: the share of the clock's slots spent milling (a bait ball). */
    mill: number;
    /** Seeded offset into the clock. */
    offset: number;
    /** Hovering schools: the height their middle keeps (m), just over their coral head. */
    level?: number;
};

/** The ambient schools, placed once from the world's sites (deterministic). */
let schoolsCache: FishSchool[] | null = null;

export function fishSchools(): FishSchool[] {
    if (schoolsCache) return schoolsCache;
    const reef = ZONE_SITES.coral_reef;
    const ocean = ZONE_SITES.open_ocean;
    const marks = reefLandmarks();
    const list: FishSchool[] = [];
    const add = (school: Omit<FishSchool, "id" | "offset">) => {
        const n = list.filter((other) => other.habitat === school.habitat).length;
        const id = `fish:${school.habitat}:${n}`;
        // A moving school's home must be water it fits in: else move it out to sea until it does.
        let home = school.home;
        for (let k = 0; k < 40 && school.style !== "hover" && !fits(school, home.x, home.z); k++) home = outward(home, 1);
        list.push({...school, home, id, offset: (hashString(id) % 100000) / 7});
    };
    // Damselfish and anthias hovering over the biggest coral heads.
    const over = (top: number, up: number, minDepth: number) => Math.min(top + 0.3 + up * 0.6, -minDepth - up);
    // Heads deep enough for a school to hover over them.
    marks.heads.filter((head) => head.top < -1.7).slice(0, 5).forEach((head, i) => {
        const anthias = i % 2 === 1;
        const size = {along: 1.1, across: 1.1, up: 0.55};
        add({kind: anthias ? "orange_anthias" : "blue_damsel", habitat: "reef", style: "hover", count: anthias ? 34 : 46, home: {x: head.x, z: head.z}, range: 0.8, minDepth: 0.7, clearance: 0.3, size, speed: 0, mill: 0, level: over(head.top, size.up, 0.7)});
    });
    // Beside the cleaning station (on its seaward side): a loose aggregation of grunts, waiting their turn.
    {
        const size = {along: 1.8, across: 1.4, up: 0.45};
        const home = outward(marks.cleaning, 2.6);
        add({kind: "striped_grunt", habitat: "reef", style: "hover", count: 16, home, range: 1.2, minDepth: 0.9, clearance: 0.4, size, speed: 0, mill: 0, level: Math.min(heightAt(home.x, home.z) + 0.55 + size.up, -0.9 - size.up)});
    }
    // Tangs grazing their way round the reef.
    add({kind: "yellow_tang", habitat: "reef", style: "roam", count: 18, home: {x: reef.x, z: reef.z}, range: 13, minDepth: 0.8, clearance: 0.7, size: {along: 1.6, across: 1.3, up: 0.4}, speed: 0.32, mill: 0});
    add({kind: "yellow_tang", habitat: "reef", style: "roam", count: 12, home: outward(reef, 7), range: 9, minDepth: 0.8, clearance: 0.7, size: {along: 1.3, across: 1.1, up: 0.35}, speed: 0.28, mill: 0});
    // Bait schools off the reef's seaward edge and in the open water: tight, fast, milling into bait balls.
    add({kind: "silver_baitfish", habitat: "reef_edge", style: "school", count: 150, home: outward(reef, 15), range: 11, minDepth: 1.4, clearance: 1.6, size: {along: 2.6, across: 1.5, up: 0.9}, speed: 0.75, mill: 0.35});
    add({kind: "silver_baitfish", habitat: "open_water", style: "school", count: 190, home: {x: ocean.x, z: ocean.z}, range: 14, minDepth: 1.6, clearance: 2, size: {along: 3, across: 1.8, up: 1.1}, speed: 0.85, mill: 0.4});
    // A few jacks patrolling past the bait.
    add({kind: "silver_jack", habitat: "open_water", style: "roam", count: 9, home: outward({x: ocean.x, z: ocean.z}, -4), range: 16, minDepth: 1.5, clearance: 1.4, size: {along: 2.4, across: 1.4, up: 0.6}, speed: 0.9, mill: 0});
    // Fry in the beach's shallows (they show from above, through the clear water).
    const beach = ZONE_SITES.seashore;
    add({kind: "sand_fry", habitat: "shallows", style: "school", count: 60, home: outward(beach, 9), range: 5, minDepth: 0.45, clearance: 0.25, size: {along: 0.8, across: 0.55, up: 0.18}, speed: 0.3, mill: 0.25});
    // Perch in the kelp: one school in each of the biggest stands off the cliff coasts.
    for (const spot of kelpSpots(3)) {
        add({kind: "kelp_perch", habitat: "kelp", style: "roam", count: 22, home: spot, range: 6, minDepth: 1.2, clearance: 1, size: {along: 1.8, across: 1.4, up: 0.8}, speed: 0.35, mill: 0});
    }
    schoolsCache = list;
    return list;
}

/** A point moved `metres` further out to sea (negative: inshore) along its bearing from the island's middle. */
function outward(point: {x: number; z: number}, metres: number): {x: number; z: number} {
    const r = Math.hypot(point.x, point.z) || 1;
    return {x: point.x + (point.x / r) * metres, z: point.z + (point.z / r) * metres};
}

/** Homes for the kelp schools: the cliff coasts' water 9–13 m out, the bearings spread round the island. */
function kelpSpots(count: number): Array<{x: number; z: number}> {
    const spots: Array<{x: number; z: number; theta: number}> = [];
    for (let k = 0; k < 160 && spots.length < count; k++) {
        // Golden-angle bearings: spread round the island, the same every time.
        const theta = ((k * 2.399963) % (Math.PI * 2)) - Math.PI;
        if (coastCliff(theta) < 0.45) continue;
        if (spots.some((spot) => Math.abs(Math.atan2(Math.sin(spot.theta - theta), Math.cos(spot.theta - theta))) < 0.6)) continue;
        const r = coastRadius(theta) + 11;
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;
        if (heightAt(x, z) > -3.5) continue;
        spots.push({x, z, theta});
    }
    return spots.map(({x, z}) => ({x, z}));
}

// MARK: - The loop

type Loop = {
    /** Points every STEP metres round the loop (closed): x, y (the school's middle), z. */
    points: Float64Array;
    /** The sea bed under each point. */
    beds: Float64Array;
    length: number;
    /** The milling pattern and its running total of milled seconds (closed form; see `milled`). */
    pattern: boolean[];
    cumulative: number[];
};

const STEP = 0.25;
const SLOT = 50;
const RAMP = 6;
const PATTERN = 32;
/** Milling, the loop's pace drops to this share. */
const MILL_PACE = 0.15;

const loops = new Map<string, Loop>();

function bedAt(x: number, z: number): number {
    return heightAt(x, z);
}

/** The water a school can be in at a point: deep enough for its size above the bed and under the surface. */
function fits(school: Pick<FishSchool, "minDepth" | "clearance" | "size">, x: number, z: number): boolean {
    const bed = bedAt(x, z);
    return -bed >= school.minDepth + school.clearance + school.size.up * 2;
}

/** The school's middle height over a bed point: as deep as it fits, held off the bed. */
function middleY(school: FishSchool, bed: number): number {
    const top = -school.minDepth - school.size.up;
    const low = bed + school.clearance + school.size.up;
    // In deep water, ride in the upper middle of the column (bait near the light), never deeper than 6 m.
    const want = Math.max(low, Math.min(top, Math.max(bed * 0.45, -6)));
    return Math.min(want, top);
}

function loopOf(school: FishSchool): Loop {
    let loop = loops.get(school.id);
    if (loop) return loop;
    const random = seeded(hashString(`${school.id}#loop`));
    // Waypoints round the home, each pulled in toward it until the water fits.
    const count = school.style === "hover" ? 5 : 7;
    const way: Array<{x: number; z: number}> = [];
    const spin = random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
        const angle = spin + (i / count) * Math.PI * 2 + (random() - 0.5) * 0.5;
        let reach = school.range * (0.55 + 0.45 * random());
        let x = school.home.x + Math.cos(angle) * reach;
        let z = school.home.z + Math.sin(angle) * reach;
        for (let k = 0; k < 8 && !fits(school, x, z); k++) {
            reach *= 0.7;
            x = school.home.x + Math.cos(angle) * reach;
            z = school.home.z + Math.sin(angle) * reach;
        }
        way.push({x, z});
    }
    // A closed Catmull-Rom spline through them, sampled densely, then walked at even steps.
    const dense: Array<{x: number; z: number}> = [];
    for (let i = 0; i < count; i++) {
        const p0 = way[(i - 1 + count) % count];
        const p1 = way[i];
        const p2 = way[(i + 1) % count];
        const p3 = way[(i + 2) % count];
        for (let k = 0; k < 40; k++) {
            const t = k / 40;
            const t2 = t * t;
            const t3 = t2 * t;
            dense.push({
                x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
                z: 0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
            });
        }
    }
    let total = 0;
    for (let i = 0; i < dense.length; i++) {
        const a = dense[i];
        const b = dense[(i + 1) % dense.length];
        total += Math.hypot(b.x - a.x, b.z - a.z);
    }
    const n = Math.max(Math.round(total / STEP), 8);
    const points = new Float64Array(n * 3);
    let segment = 0;
    let along = 0;
    let segmentLength = Math.hypot(dense[1].x - dense[0].x, dense[1].z - dense[0].z);
    for (let i = 0; i < n; i++) {
        const want = (i / n) * total;
        while (along + segmentLength < want && segment < dense.length - 1) {
            along += segmentLength;
            segment++;
            const a = dense[segment];
            const b = dense[(segment + 1) % dense.length];
            segmentLength = Math.hypot(b.x - a.x, b.z - a.z);
        }
        const a = dense[segment];
        const b = dense[(segment + 1) % dense.length];
        const k = segmentLength > 1e-6 ? (want - along) / segmentLength : 0;
        points[i * 3] = a.x + (b.x - a.x) * k;
        points[i * 3 + 2] = a.z + (b.z - a.z) * k;
    }
    // Rounded off (three passes of a ±1.5 m average): no kinks where a waypoint was pulled in, so the school swings
    // round its turns instead of snapping.
    {
        const span = Math.max(Math.round(1.5 / STEP), 1);
        const tmp = new Float64Array(n * 2);
        for (let pass = 0; pass < 3; pass++) {
            for (let i = 0; i < n; i++) {
                let sx = 0;
                let sz = 0;
                for (let k = -span; k <= span; k++) {
                    const j = (i + k + n) % n;
                    sx += points[j * 3];
                    sz += points[j * 3 + 2];
                }
                tmp[i * 2] = sx / (2 * span + 1);
                tmp[i * 2 + 1] = sz / (2 * span + 1);
            }
            for (let i = 0; i < n; i++) {
                points[i * 3] = tmp[i * 2];
                points[i * 3 + 2] = tmp[i * 2 + 1];
            }
        }
    }
    // Heights: the school's middle over the bed, smoothed along the loop so it glides over the reef's knolls.
    const raw = new Float64Array(n);
    const beds = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        beds[i] = bedAt(points[i * 3], points[i * 3 + 2]);
        raw[i] = middleY(school, beds[i]);
    }
    const window = Math.max(Math.round(3 / STEP), 1);
    for (let i = 0; i < n; i++) {
        let sum = 0;
        let highest = -Infinity;
        for (let k = -window; k <= window; k++) {
            const value = raw[(i + k + n) % n];
            sum += value;
            highest = Math.max(highest, value);
        }
        // Never below what this point needs (a knoll under it), never above the surface limit.
        points[i * 3 + 1] = Math.max(sum / (2 * window + 1), raw[i] - 0.05, Math.min(highest - 0.6, raw[i]));
    }
    // The milling pattern: which of PATTERN slots mill (at least one when the school mills at all).
    const pattern: boolean[] = [];
    const millRandom = seeded(hashString(`${school.id}#mill`));
    for (let i = 0; i < PATTERN; i++) pattern.push(millRandom() < school.mill);
    if (school.mill > 0 && !pattern.some(Boolean)) pattern[Math.floor(millRandom() * PATTERN)] = true;
    const cumulative = [0];
    for (let i = 0; i < PATTERN; i++) cumulative.push(cumulative[i] + slotMilled(pattern, i, SLOT));
    loop = {points, beds, length: Math.max(total, 1e-3), pattern, cumulative};
    loops.set(school.id, loop);
    return loop;
}

const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** ∫0^u ease. */
const easeArea = (u: number) => {
    const v = Math.min(Math.max(u, 0), 1);
    return v * v * v - (v * v * v * v) / 2;
};

/** How much the school mills at `tau` seconds into pattern slot `k` (0…1). */
function millAt(pattern: boolean[], k: number, tau: number): number {
    const index = ((k % PATTERN) + PATTERN) % PATTERN;
    if (!pattern[index]) return 0;
    const before = pattern[(index - 1 + PATTERN) % PATTERN];
    const after = pattern[(index + 1) % PATTERN];
    return (before ? 1 : ease(tau / RAMP)) * (after ? 1 : ease((SLOT - tau) / RAMP));
}

/** Seconds milled from the start of slot `index` to `tau` into it (closed form of ∫ millAt). */
function slotMilled(pattern: boolean[], index: number, tau: number): number {
    const i = ((index % PATTERN) + PATTERN) % PATTERN;
    if (!pattern[i]) return 0;
    const before = pattern[(i - 1 + PATTERN) % PATTERN];
    const after = pattern[(i + 1) % PATTERN];
    const a = Math.min(tau, RAMP);
    let total = before ? a : RAMP * easeArea(a / RAMP);
    total += Math.max(0, Math.min(tau, SLOT - RAMP) - RAMP);
    if (tau > SLOT - RAMP) total += after ? tau - (SLOT - RAMP) : RAMP * (easeArea(1) - easeArea((SLOT - tau) / RAMP));
    return total;
}

/** Seconds spent milling up to `t` (school-local seconds). */
function milled(loop: Loop, t: number): number {
    const slot = Math.floor(t / SLOT);
    const cycles = Math.floor(slot / PATTERN);
    const index = slot - cycles * PATTERN;
    return cycles * loop.cumulative[PATTERN] + loop.cumulative[index] + slotMilled(loop.pattern, index, t - slot * SLOT);
}

/** The school's own clock: epoch seconds from a fixed origin, offset per school (keeps the numbers small). */
const ORIGIN = 1_790_000_000;
function localTime(school: FishSchool, epochSeconds: number): number {
    return epochSeconds - ORIGIN + school.offset;
}

/** Distance along the loop at `t` (local seconds): the pace breathes, and drops while it mills. */
function distanceAlong(school: FishSchool, loop: Loop, t: number): number {
    if (school.speed <= 0) return 0;
    const w = (Math.PI * 2) / 37;
    const s = school.speed * (t + (0.22 / w) * Math.sin(w * t)) - (1 - MILL_PACE) * school.speed * milled(loop, t);
    const wrapped = s % loop.length;
    return wrapped < 0 ? wrapped + loop.length : wrapped;
}

/** A point on the loop at distance `s` (wrapped), linearly between its samples. */
function loopPoint(loop: Loop, s: number, out: {x: number; y: number; z: number}): {x: number; y: number; z: number} {
    const n = loop.points.length / 3;
    let f = (s / loop.length) * n;
    f = ((f % n) + n) % n;
    const i = Math.floor(f);
    const k = f - i;
    const j = (i + 1) % n;
    const p = loop.points;
    out.x = p[i * 3] + (p[j * 3] - p[i * 3]) * k;
    out.y = p[i * 3 + 1] + (p[j * 3 + 1] - p[i * 3 + 1]) * k;
    out.z = p[i * 3 + 2] + (p[j * 3 + 2] - p[i * 3 + 2]) * k;
    return out;
}

// MARK: - The API

export type Vec3 = {x: number; y: number; z: number};

/** A school as it is now. */
export type FishSchoolNow = {
    id: string;
    kind: FishKind;
    habitat: FishHabitat;
    style: FishStyle;
    /** The middle of the school (m, world). */
    centre: Vec3;
    /** About how far its fish reach from the middle (m). */
    radius: number;
    /** Where it is heading (unit, horizontal), and how fast (m/s). */
    heading: Vec3;
    speed: number;
    count: number;
    /** "mill": balled up (a bait ball: what a predator chases); "cruise": streaming along; "hover": over its coral head. */
    mode: "cruise" | "mill" | "hover";
    /** 0…1 how far into a bait ball it is (milling eases in and out over a few seconds). */
    milling: number;
};

function hoverCentre(school: FishSchool, t: number, out: Vec3): Vec3 {
    // A slow, small drift round the home over its coral head.
    const a = t * 0.05;
    const x = school.home.x + Math.sin(a) * school.range * 0.5;
    const z = school.home.z + Math.sin(a * 1.37 + 1.1) * school.range * 0.5;
    out.x = x;
    out.z = z;
    out.y = school.level ?? middleY(school, bedAt(school.home.x, school.home.z));
    return out;
}

const scratch = {a: {x: 0, y: 0, z: 0}, b: {x: 0, y: 0, z: 0}};

/** One school now (epoch seconds; default: the sea's clock). */
export function fishSchoolAt(school: FishSchool, epochSeconds: number = seaEpochSeconds()): FishSchoolNow {
    const t = localTime(school, epochSeconds);
    const reach = Math.max(school.size.along, school.size.across, school.size.up);
    if (school.style === "hover") {
        const centre = hoverCentre(school, t, {x: 0, y: 0, z: 0});
        const surge = surgeDirection(centre);
        return {id: school.id, kind: school.kind, habitat: school.habitat, style: school.style, centre, radius: reach, heading: {x: surge.x, y: 0, z: surge.z}, speed: 0, count: school.count, mode: "hover", milling: 0};
    }
    const loop = loopOf(school);
    const s = distanceAlong(school, loop, t);
    const centre = loopPoint(loop, s, {x: 0, y: 0, z: 0});
    const ahead = loopPoint(loop, s + 0.5, scratch.a);
    const dx = ahead.x - centre.x;
    const dz = ahead.z - centre.z;
    const l = Math.hypot(dx, dz) || 1;
    const slot = Math.floor(t / SLOT);
    const milling = millAt(loop.pattern, slot, t - slot * SLOT);
    const pace = school.speed * (1 + 0.22 * Math.cos((Math.PI * 2 / 37) * t)) * (1 - (1 - MILL_PACE) * milling);
    return {
        id: school.id,
        kind: school.kind,
        habitat: school.habitat,
        style: school.style,
        centre,
        radius: reach * (1 - 0.25 * milling) + 0.4,
        heading: {x: dx / l, y: 0, z: dz / l},
        speed: pace,
        count: school.count,
        mode: milling > 0.5 ? "mill" : "cruise",
        milling
    };
}

/**
 * The schools whose middle is within `radius` of `pos` (y ignored when not given), nearest first, as they are at
 * `epochSeconds` (default: the sea's clock, the same for every viewer). Pure and cheap: no fish, only the schools.
 */
export function fishSchoolsNear(pos: {x: number; y?: number; z: number}, radius: number, epochSeconds: number = seaEpochSeconds()): FishSchoolNow[] {
    const found: Array<FishSchoolNow & {distance: number}> = [];
    for (const school of fishSchools()) {
        // Cheap reject on the home's reach first.
        if (Math.hypot(school.home.x - pos.x, school.home.z - pos.z) > radius + school.range + 4) continue;
        const now = fishSchoolAt(school, epochSeconds);
        const distance = Math.hypot(now.centre.x - pos.x, typeof pos.y === "number" ? now.centre.y - pos.y : 0, now.centre.z - pos.z);
        if (distance <= radius) found.push({...now, distance});
    }
    found.sort((a, b) => a.distance - b.distance);
    return found.map(({distance: _distance, ...school}) => school);
}

/** The surge's direction at a point: onshore-offshore (out from the island's middle). */
export function surgeDirection(point: {x: number; z: number}): {x: number; z: number} {
    const r = Math.hypot(point.x, point.z) || 1;
    return {x: point.x / r, z: point.z / r};
}

// MARK: - The fish

/** Each fish's seeded slot in its school: evenly spread in a unit ball (Fibonacci shells), plus its own phases. */
type Slot = {u: number; v: number; w: number; phase: number; wander: number; rate: number; ring: number; ringUp: number; ringAngle: number; /** cos and sin of the phase (its dart's direction). */ cos: number; sin: number};
const slotsCache = new Map<string, Slot[]>();

export function schoolSlots(school: FishSchool): Slot[] {
    let slots = slotsCache.get(school.id);
    if (slots) return slots;
    const random = seeded(hashString(`${school.id}#slots`));
    slots = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < school.count; i++) {
        const r = Math.cbrt((i + 0.5) / school.count);
        const y = 1 - (2 * ((i * 0.618034) % 1));
        const ring = Math.sqrt(Math.max(1 - y * y, 0));
        const angle = i * golden;
        const phase = random() * Math.PI * 2;
        slots.push({
            cos: Math.cos(phase),
            sin: Math.sin(phase),
            u: Math.cos(angle) * ring * r,
            v: Math.sin(angle) * ring * r,
            w: y * r,
            phase,
            wander: 0.6 + 0.8 * random(),
            rate: 0.7 + 0.6 * random(),
            ring: 0.45 + 0.55 * Math.sqrt(random()),
            ringUp: (random() * 2 - 1) * 0.75,
            ringAngle: random() * Math.PI * 2
        });
    }
    slotsCache.set(school.id, slots);
    return slots;
}

/** A school's per-frame state at `t` (local seconds): computed once, then every fish is placed from it. */
export type SchoolFrame = {
    school: FishSchool;
    t: number;
    slots: Slot[];
    spacing: number;
    /** Moving schools: the loop, the leader's distance along it, its pace (m/s), how much it mills. */
    loop: Loop | null;
    s: number;
    pace: number;
    milling: number;
    /** How fast the milling is easing in or out (per second, of the eased share). */
    millingRate: number;
    /** The middle now (the leader's point, or the hover spot), and how fast that moves. */
    centre: Vec3;
    centreVelocity: Vec3;
    omegaScale: number;
};

export function schoolFrame(school: FishSchool, t: number, into?: SchoolFrame): SchoolFrame {
    const frame = into ?? {school, t, slots: [], spacing: 0, loop: null, s: 0, pace: 0, milling: 0, millingRate: 0, centre: {x: 0, y: 0, z: 0}, centreVelocity: {x: 0, y: 0, z: 0}, omegaScale: 0};
    frame.school = school;
    frame.t = t;
    frame.slots = schoolSlots(school);
    frame.spacing = Math.cbrt((8 * school.size.along * school.size.across * school.size.up) / Math.max(school.count, 1));
    const look = FISH_LOOKS[school.kind];
    frame.omegaScale = look.length * look.beat * 1.6;
    if (school.style === "hover") {
        frame.loop = null;
        hoverCentre(school, t, frame.centre);
        const a = t * 0.05;
        frame.centreVelocity.x = Math.cos(a) * 0.05 * school.range * 0.5;
        frame.centreVelocity.y = 0;
        frame.centreVelocity.z = Math.cos(a * 1.37 + 1.1) * 0.05 * 1.37 * school.range * 0.5;
        return frame;
    }
    const loop = loopOf(school);
    frame.loop = loop;
    frame.s = distanceAlong(school, loop, t);
    const slot = Math.floor(t / SLOT);
    frame.milling = school.mill > 0 ? millAt(loop.pattern, slot, t - slot * SLOT) : 0;
    frame.millingRate = 0;
    if (school.mill > 0) {
        const at = (u: number) => {
            const k = Math.floor(u / SLOT);
            return ease(millAt(loop.pattern, k, u - k * SLOT));
        };
        frame.millingRate = (at(t + 0.05) - at(t - 0.05)) / 0.1;
    }
    frame.pace = school.speed * (1 + 0.22 * Math.cos((Math.PI * 2 / 37) * t)) * (1 - (1 - MILL_PACE) * frame.milling);
    loopPoint(loop, frame.s, frame.centre);
    const ahead = loopPoint(loop, frame.s + 0.4, place.b);
    frame.centreVelocity.x = ((ahead.x - frame.centre.x) / 0.4) * frame.pace;
    frame.centreVelocity.y = ((ahead.y - frame.centre.y) / 0.4) * frame.pace;
    frame.centreVelocity.z = ((ahead.z - frame.centre.z) / 0.4) * frame.pace;
    return frame;
}

/** The bed under a point of the loop (from the loop's own samples). */
function loopBed(loop: Loop, s: number): number {
    const n = loop.beds.length;
    const f = (((s / loop.length) * n) % n + n) % n;
    const i = Math.floor(f);
    const k = f - i;
    return loop.beds[i] + (loop.beds[(i + 1) % n] - loop.beds[i]) * k;
}

const place = {a: {x: 0, y: 0, z: 0}, b: {x: 0, y: 0, z: 0}};

/**
 * Where fish `i` is in a prepared frame, into `out`; and (when `velocity` is given) how it is moving (m/s), worked
 * out in the same pass from the same closed forms (the renderer points each fish along it).
 */
export function placeFish(frame: SchoolFrame, i: number, out: Vec3, velocity?: Vec3): Vec3 {
    const school = frame.school;
    const t = frame.t;
    const slot = frame.slots[i];
    const wiggle = frame.spacing * 0.28 * slot.wander;
    const ax = t * 0.9 * slot.rate + slot.phase;
    const ay = t * 0.7 * slot.rate + slot.phase * 1.7;
    const az = t * 1.1 * slot.rate + slot.phase * 2.3;
    const wx = Math.sin(ax) * wiggle;
    const wy = Math.sin(ay) * wiggle * 0.6;
    const wz = Math.sin(az) * wiggle;
    const size = school.size;
    if (!frame.loop) {
        const centre = frame.centre;
        // Darting round its own spot over the head: a quick little run now and then.
        const da = t * 0.23 * slot.rate + slot.phase * 3.1;
        const sd = Math.sin(da);
        const s2 = sd > 0 ? sd * sd : 0;
        const dart = s2 * s2 * s2 * 0.35 * size.along;
        out.x = centre.x + slot.u * size.along + wx * 1.6 + slot.cos * dart;
        out.y = centre.y + Math.abs(slot.w) * size.up * 1.4 - size.up * 0.4 + wy;
        out.z = centre.z + slot.v * size.across + wz * 1.6 + slot.sin * dart;
        if (velocity) {
            // d/dt of sin⁶: 6 sin⁵ cos · the rate.
            const dartRate = sd > 0 ? 6 * s2 * s2 * sd * Math.cos(da) * 0.23 * slot.rate * 0.35 * size.along : 0;
            velocity.x = frame.centreVelocity.x + Math.cos(ax) * wiggle * 0.9 * slot.rate * 1.6 + slot.cos * dartRate;
            velocity.y = Math.cos(ay) * wiggle * 0.6 * 0.7 * slot.rate;
            velocity.z = frame.centreVelocity.z + Math.cos(az) * wiggle * 1.1 * slot.rate * 1.6 + slot.sin * dartRate;
        }
        return out;
    }
    const loop = frame.loop;
    // Streaming: its own place on the loop (ahead or behind the leader's point), out to the side, up or down.
    const along = slot.u * size.along;
    const here = loopPoint(loop, frame.s + along, place.a);
    const ahead = loopPoint(loop, frame.s + along + 0.4, place.b);
    let hx = ahead.x - here.x;
    let hz = ahead.z - here.z;
    const rise = (ahead.y - here.y) / 0.4;
    const hl = Math.hypot(hx, hz) || 1;
    hx /= hl;
    hz /= hl;
    let x = here.x - hz * slot.v * size.across + wx;
    let y = here.y + slot.w * size.up + wy;
    let z = here.z + hx * slot.v * size.across + wz;
    // Roaming grazers dip to the bed now and then, each on its own beat.
    let dipRate = 0;
    if (school.style === "roam") {
        const dipAngle = t * 0.13 * slot.rate + slot.phase;
        const sd = Math.sin(dipAngle);
        const room = Math.max(here.y - school.clearance - loopBed(loop, frame.s + along) - 0.25, 0) * 0.8;
        if (sd > 0) {
            y -= sd * sd * sd * sd * room;
            dipRate = 4 * sd * sd * sd * Math.cos(dipAngle) * 0.13 * slot.rate * room;
        }
    }
    let vx = 0;
    let vy = 0;
    let vz = 0;
    if (velocity) {
        vx = hx * frame.pace + Math.cos(ax) * wiggle * 0.9 * slot.rate;
        vy = rise * frame.pace + Math.cos(ay) * wiggle * 0.42 * slot.rate - dipRate;
        vz = hz * frame.pace + Math.cos(az) * wiggle * 1.1 * slot.rate;
    }
    if (frame.milling > 0) {
        // Balled up: round the leader's point on a torus, all one way, faster on the inside.
        const centre = frame.centre;
        const radius = Math.max(size.across, size.up * 1.4) * 1.05 * slot.ring;
        const omega = frame.omegaScale / Math.max(radius, 0.2);
        const angle = slot.ringAngle + omega * t;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const mx = centre.x + ca * radius + wx * 0.5;
        const my = centre.y + slot.ringUp * size.up * 1.3 + wy * 0.5;
        const mz = centre.z + sa * radius + wz * 0.5;
        const k = ease(frame.milling);
        if (velocity) {
            const tx = frame.centreVelocity.x - sa * omega * radius;
            const tz = frame.centreVelocity.z + ca * omega * radius;
            // Plus the drift between the two formations while it eases in or out.
            vx += (tx - vx) * k + (mx - x) * frame.millingRate;
            vy += (frame.centreVelocity.y - vy) * k + (my - y) * frame.millingRate;
            vz += (tz - vz) * k + (mz - z) * frame.millingRate;
        }
        x += (mx - x) * k;
        y += (my - y) * k;
        z += (mz - z) * k;
    }
    out.x = x;
    out.y = y < -0.25 ? y : -0.25;
    out.z = z;
    if (velocity) {
        velocity.x = vx;
        velocity.y = vy;
        velocity.z = vz;
    }
    return out;
}

/** Where fish `i` of a school is at `t` (local seconds), into `out`. Pure. */
export function fishPosition(school: FishSchool, i: number, t: number, out: Vec3): Vec3 {
    return placeFish(schoolFrame(school, t), i, out);
}

// MARK: - Chasers (a hunter through a school)

/** A hunter the fish get out of the way of: where it is and its reach (m), e.g. the recipes lane's `recipeScene.chasers`. */
export type FishChaser = {x: number; y: number; z: number; r: number};

/**
 * How a fish at `p` gets out of the chasers' way: a closed-form offset from where the shared motion put it (no state,
 * the same for everyone who sees the same chasers), added into `offset`, and a flee velocity (m/s) into `flee` to
 * point it away. Inside a chaser's reach (r + 0.6 m) each fish is pushed straight out from it, by half the reach at
 * the middle down to nothing at the edge, (1 − d/reach)² — so the school opens round the hunter (a hole of half its
 * reach), never folds over itself (a fish nearer the hunter always stays nearer), and closes up again behind it as it
 * passes: split, flee, rejoin. Mostly sideways (the push up and down is 0.6 of it). Returns how frightened (0…1).
 */
export function fleeFrom(p: Vec3, chasers: readonly FishChaser[], offset: Vec3, flee: Vec3): number {
    let fright = 0;
    for (const c of chasers) {
        const reach = c.r + 0.6;
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const dz = p.z - c.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= reach * reach) continue;
        const d = Math.sqrt(d2);
        // Dead centre: away along +x (any fixed way; it is measure zero).
        const ux = d > 1e-5 ? dx / d : 1;
        const uy = d > 1e-5 ? dy / d : 0;
        const uz = d > 1e-5 ? dz / d : 0;
        const left = 1 - d / reach;
        const push = 0.5 * reach * left * left;
        offset.x += ux * push;
        offset.y += uy * push * 0.6;
        offset.z += uz * push;
        flee.x += ux * 2.4 * left;
        flee.y += uy * 1.2 * left;
        flee.z += uz * 2.4 * left;
        fright = Math.max(fright, left);
    }
    return fright;
}

/** Every fish of a school at `epochSeconds`, positions only (for later lanes: a predator picking a fish to lunge at). */
export function schoolFish(school: FishSchool, epochSeconds: number = seaEpochSeconds()): Vec3[] {
    const frame = schoolFrame(school, localTime(school, epochSeconds));
    return frame.slots.map((_, i) => placeFish(frame, i, {x: 0, y: 0, z: 0}));
}

/** The school's local time (for the renderer, which calls `fishPosition` directly). */
export function schoolTime(school: FishSchool, epochSeconds: number): number {
    return localTime(school, epochSeconds);
}
