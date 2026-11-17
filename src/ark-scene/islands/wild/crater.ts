/**
 * The old volcano behind the waterfall (p5 CRATER; the owner, 2026-11-17: "the waterfall in the wild island looks like
 * it's coming from nowhere so we need a big lake at the top of the mountain … make the lake an old volcano which has
 * collected the water in it which is causing the waterfall and we can have it inhabit animals up there too").
 *
 * The high summit north-east of the falls becomes a broad extinct cone with a caldera: a broken rim (highest at its
 * back, in the north-north-east, lowest toward the falls), steep inner walls with ledges, a bench of alpine meadow and
 * reed beds round a crater lake some 60 m across (shallow shelves, a deep middle, a small island and two islets), old
 * lava flows down its south-east and east flanks. The rim is breached in the south-south-west: the lake drains through
 * that notch as an outlet stream that widens over a sill to the waterfall's lip (`falls.ts`), so the water is level or
 * falling all the way: lake ≥ outlet ≥ lip. Snowmelt rills run down the inner walls (`render/falls.ts` draws them).
 * The caldera's floor is still warm (an old volcano's ground): the snow line stands higher inside it (`craterWarmth`,
 * read by the ground shader and `snow.ts`), so its meadows and shore are green under a snowy rim.
 *
 * Pure functions of (x, z), the island's frame (x east, z south, y up, metres): the same on every device and for the
 * server's atlas. `fields.ts` reads the cone into the elevation (and widens the coast behind it); `ground.ts` cuts the
 * lake and the outlet into the height and gives their water.
 */

import {fbm, smoothstep} from "@/ark-scene/world";

/** The caldera: its middle, its lake's shore and rim crest radii before they wander (m), the lake's surface (m above the sea). */
export const CRATER = {x: -84, z: -132, shore: 30.5, rim: 44, level: 53.6};
/** The rim's crest: its mean height (m above the sea) and how much higher its back (north-north-east) stands than its front. */
const RIM_MEAN = 70;
const RIM_BACK = 13;
/** The rim is never lower than this over the lake (m), but at the breach. */
const RIM_LEAST = 6.5;
/** The cone's outer flank: how far it runs out from the rim (m). */
const FLANK = 62;
/** The inner wall's width (m): the rim's crest down to the bench. */
const WALL = 7.5;

/** The lake's island and islets: middle, radius, how far its top stands over the water (m). */
export const CRATER_ISLANDS: ReadonlyArray<{x: number; z: number; r: number; top: number}> = [
    {x: CRATER.x + 8, z: CRATER.z - 6, r: 6, top: 2.8},
    {x: CRATER.x - 13, z: CRATER.z + 7, r: 2.2, top: 1.0},
    {x: CRATER.x + 2, z: CRATER.z + 15, r: 1.8, top: 0.8}
];

/**
 * The outlet: from the lake's south-south-west shore, through the breach, widening over the sill to the falls' lip.
 * `width` is its half-width (as the river's is); the last point is the lip's line (the falls' sheet is 21 m across there).
 */
export const OUTLET: ReadonlyArray<{x: number; z: number; level: number; width: number; depth: number}> = [
    {x: -94, z: -108, level: CRATER.level, width: 2.6, depth: 0.7},
    {x: -97.6, z: -102.2, level: 53.45, width: 3.4, depth: 0.55},
    {x: -101, z: -97, level: 53.2, width: 6.5, depth: 0.4},
    {x: -101, z: -91.2, level: 52.75, width: 10.6, depth: 0.3}
];

/**
 * The falls' plunge pool (`falls.ts` POOL): real water since p5 (the first pass drew it over dry ground, and the mayflies'
 * home lay under it): a basin cut into the flat at the cliff's foot, its banks standing over it, a gap in them where it
 * spills to the river's spring.
 */
export const PLUNGE_POOL = {x: -99.6, z: -82.4, rx: 10.5, rz: 3.2, level: 24.9};
export const PLUNGE_SPILL = {x: -100.2, z: -79.3};

const TAU = Math.PI * 2;

function angleOf(x: number, z: number): number {
    return Math.atan2(z - CRATER.z, x - CRATER.x);
}

/** The lake's shore (m from the middle) at an angle: an irregular round. */
export function craterShore(a: number): number {
    return CRATER.shore + 2.4 * Math.sin(2 * a + 0.7) + 1.7 * Math.sin(3 * a - 1.1) + 1.0 * Math.sin(7 * a + 2);
}

/** The rim crest's radius at an angle. */
function rimRadius(a: number): number {
    return CRATER.rim + 1.6 * Math.sin(2 * a - 0.4) + 1.1 * Math.sin(5 * a + 1.3);
}

/** The rim crest's height at an angle (m above the sea): highest at its back, broken into towers and saddles. */
export function rimHeight(a: number): number {
    const back = Math.cos(a + 1.07);
    const broken = fbm(Math.cos(a) * 2.6 + 5.2, Math.sin(a) * 2.6 - 2.1) - 0.5;
    const towers = Math.max(0, Math.sin(9 * a + 4 * broken) - 0.55);
    return Math.max(RIM_MEAN + RIM_BACK * back + 11 * broken + 4.5 * towers, CRATER.level + RIM_LEAST);
}

export type OutletHit = {d: number; level: number; width: number; depth: number; /** 0 at the lake … 1 at the lip. */ along: number; dx: number; dz: number; /** Past its ends (m along its line beyond the lake's end or the lip): 0 beside it. */ beyond: number};

/** The nearest point of the outlet stream's line. */
export function outletAt(x: number, z: number): OutletHit {
    let best: OutletHit = {d: Infinity, level: CRATER.level, width: 2, depth: 0.5, along: 0, dx: 0, dz: 1, beyond: 0};
    let total = 0;
    for (let i = 1; i < OUTLET.length; i++) total += Math.hypot(OUTLET[i].x - OUTLET[i - 1].x, OUTLET[i].z - OUTLET[i - 1].z);
    let before = 0;
    for (let i = 1; i < OUTLET.length; i++) {
        const a = OUTLET[i - 1];
        const b = OUTLET[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const seg = Math.hypot(dx, dz);
        const raw = ((x - a.x) * dx + (z - a.z) * dz) / (seg * seg);
        const t = Math.min(Math.max(raw, 0), 1);
        const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
        if (d < best.d) {
            const beyond = i === 1 && raw < 0 ? -raw * seg : i === OUTLET.length - 1 && raw > 1 ? (raw - 1) * seg : 0;
            best = {d, level: a.level + (b.level - a.level) * t, width: a.width + (b.width - a.width) * t, depth: a.depth + (b.depth - a.depth) * t, along: (before + t * seg) / total, dx: dx / seg, dz: dz / seg, beyond};
        }
        before += seg;
    }
    return best;
}

/** How much a point is the lava flows' (0…1): two old tongues down the south-east and the east flanks, levees at their edges. */
export function lavaFlow(x: number, z: number): {flow: number; levee: number} {
    const d = Math.hypot(x - CRATER.x, z - CRATER.z);
    const a = angleOf(x, z);
    const out = d - rimRadius(a);
    if (out < -2 || out > FLANK * 0.95) return {flow: 0, levee: 0};
    let flow = 0;
    let levee = 0;
    for (const [axis, wide, reach] of [[0.92, 0.2, 0.9], [0.1, 0.16, 0.78], [2.55, 0.14, 0.6]] as const) {
        // (The tongue wanders as it runs out, and widens.)
        const centre = axis + 0.12 * Math.sin(out * 0.07 + axis * 5) + 0.25 * (fbm(out * 0.03 + axis * 3, axis) - 0.5);
        let off = a - centre;
        while (off > Math.PI) off -= TAU;
        while (off < -Math.PI) off += TAU;
        const w = wide * (0.7 + 0.6 * smoothstep(0, FLANK * 0.6, out)) * (1 + 0.3 * (fbm(out * 0.08, axis * 7 + a * 2) - 0.5));
        const q = Math.abs(off) / w;
        const along = smoothstep(-2, 6, out) * smoothstep(FLANK * reach, FLANK * reach * 0.7, out);
        flow = Math.max(flow, smoothstep(1, 0.7, q) * along);
        levee = Math.max(levee, smoothstep(1.15, 0.9, q) * smoothstep(0.55, 0.9, q) * along);
    }
    return {flow, levee};
}

export type CraterShape = {
    /** Metres from the caldera's middle, and outside the lake's shore (negative in the lake). */
    d: number;
    shore: number;
    /** Metres outside the rim's crest (negative inside it). */
    rim: number;
    /** 0…1: inside the caldera (1 from the rim's crest inward). */
    inside: number;
    /** 0…1: how much the ground is the cone's (its flanks and walls: dark basalt and scoria). */
    volcanic: number;
};

/** Far from the volcano: nothing of it. */
const NONE: CraterShape = {d: Infinity, shore: Infinity, rim: Infinity, inside: 0, volcanic: 0};

/** Where a point is on the volcano. */
export function craterAt(x: number, z: number): CraterShape {
    const d = Math.hypot(x - CRATER.x, z - CRATER.z);
    if (d > CRATER.rim + FLANK + 12) return NONE;
    const a = angleOf(x, z);
    const rim = d - rimRadius(a);
    return {d, shore: d - craterShore(a), rim, inside: smoothstep(3, -3, rim), volcanic: smoothstep(FLANK, FLANK * 0.45, rim) * (1 - 0.35 * smoothstep(-WALL, -WALL - 6, rim))};
}

/**
 * How much warmer the caldera's ground is (0…1): 1 over its floor and lake, easing to 0 at the rim's crest. The snow
 * line stands `CRATER_SNOW_LIFT` m higher where it is 1 (the ground shader and `snow.ts` read the same number).
 */
export function craterWarmth(x: number, z: number): number {
    const d = Math.hypot(x - CRATER.x, z - CRATER.z);
    return smoothstep(CRATER.rim + 1, CRATER.rim - 9, d);
}
export const CRATER_SNOW_LIFT = 16;

/** A smooth highest of two heights (k: how soft the join, m). */
function smoothMax(a: number, b: number, k: number): number {
    const h = Math.min(Math.max(0.5 + (a - b) / (2 * k), 0), 1);
    return b + (a - b) * h + k * h * (1 - h);
}

/**
 * The land's elevation with the volcano (`fields.ts` elevationOf): the cone's outer flank over the land as it was
 * (never under it), and inside the rim the caldera itself: the wall, the bench, the lake's bed with its shelves, its
 * island and islets. `inland` eases the flank to the sea as cliffs; `smooth` leaves out the broken rock (the regional
 * height the biomes read).
 */
export function volcanoElevation(x: number, z: number, land: number, inland: number, smooth = false): number {
    const d = Math.hypot(x - CRATER.x, z - CRATER.z);
    if (d > CRATER.rim + FLANK + 12) return land;
    const a = angleOf(x, z);
    const rimR = rimRadius(a);
    const crest = smooth ? Math.max(RIM_MEAN + RIM_BACK * Math.cos(a + 1.07), CRATER.level + RIM_LEAST) : rimHeight(a);
    const out = d - rimR;
    // The outer flank: concave, steeper toward the rim, gullied; old lava tongues stand a little proud of it.
    let flank = 0;
    if (out > -4) {
        // (Toward the falls the cone is cut back to a headwall: the valley's own steep face is its flank there.)
        const outlet = outletAt(x, z);
        const cut = smoothstep(36, 17, outlet.d) * smoothstep(-8, 10, out);
        const run = FLANK * (1 + 0.16 * Math.sin(3 * a + 0.4)) * (1 - 0.86 * cut);
        const t = Math.min(Math.max(out, 0) / run, 1);
        flank = crest * Math.pow(1 - t, 1.55);
        if (!smooth) {
            const gully = 1 - Math.abs(2 * fbm(Math.cos(a) * 5.5 + 3, Math.sin(a) * 5.5 - 8) - 1);
            const lava = lavaFlow(x, z);
            flank += (-3.2 * gully * gully * smoothstep(0, 0.25, t) * (1 - lava.flow) + 1.6 * lava.flow + 1.5 * lava.levee) * smoothstep(1, 0.75, t);
        }
        flank *= smoothstep(0, 26, Math.max(inland, 0));
    }
    const outer = smoothMax(land, flank, 3);
    if (out > 4) return outer;
    // Inside the rim.
    const shoreR = craterShore(a);
    const foot = Math.max(rimR - WALL, shoreR + 1.5);
    let inner: number;
    if (d >= foot) {
        // The wall: from the bench's back up to the crest, in two steps with a ledge between (cliffs with ledges).
        const back = CRATER.level + 0.45 + 0.24 * (foot - shoreR);
        const t = Math.min((d - foot) / Math.max(rimR - foot, 1), 1);
        const stepped = smooth ? t : 0.5 * smoothstep(0, 0.42, t) + 0.5 * smoothstep(0.58, 1, t) + 0.05 * Math.sin(t * 9 + a * 6);
        inner = back + (crest - back) * Math.min(Math.max(stepped, 0), 1);
    } else if (d >= shoreR) {
        // The bench: meadow rising gently from the shore to the wall's foot.
        inner = CRATER.level + 0.45 + 0.24 * (d - shoreR) + (smooth ? 0 : 0.5 * (fbm(x * 0.16 + 2, z * 0.16 - 5) - 0.5));
    } else {
        // The lake's bed: a shelf under a metre and a half of water (wider on some shores), then the deep middle.
        const q = d / shoreR;
        const shelf = 0.74 + 0.1 * Math.sin(3 * a + 1.0);
        const depth = 0.3 + 1.15 * smoothstep(1, shelf, q) + 8.8 * smoothstep(shelf - 0.06, 0.28, q);
        inner = CRATER.level - depth;
        for (const isle of CRATER_ISLANDS) {
            const r = Math.hypot(x - isle.x, z - isle.z) / isle.r;
            if (r < 1.6) inner = Math.max(inner, CRATER.level + isle.top - (isle.top + 1.6) * r * r);
        }
    }
    return outer + (inner - outer) * smoothstep(4, -2, out);
}

/**
 * Snowmelt rills down the caldera's inner walls (drawn by `render/falls.ts`: thin running water from the rim's snow to
 * the lake, the lake's visible feed): each a line of points down the wall and across the bench, a hand over the ground
 * (`height`), never climbing, ending on the lake.
 */
export function rillPaths(height: (x: number, z: number) => number): Array<Array<{x: number; y: number; z: number; width: number}>> {
    const out: Array<Array<{x: number; y: number; z: number; width: number}>> = [];
    for (const a0 of [-2.75, -2.05, -1.35, -0.62, 0.22, 2.95]) {
        const path: Array<{x: number; y: number; z: number; width: number}> = [];
        const from = rimRadius(a0) - 2.2;
        const to = craterShore(a0) - 0.6;
        const steps = Math.ceil((from - to) / 0.9);
        let last = Infinity;
        for (let k = 0; k <= steps; k++) {
            const t = k / steps;
            const d = from + (to - from) * t;
            // (It wanders a little on its way down.)
            const a = a0 + 0.035 * Math.sin(d * 0.7 + a0 * 9) * t;
            const x = CRATER.x + Math.cos(a) * d;
            const z = CRATER.z + Math.sin(a) * d;
            const y = k === steps ? CRATER.level + 0.03 : Math.max(Math.min(height(x, z) + 0.07, last), CRATER.level + 0.03);
            last = y;
            path.push({x, y, z, width: 0.2 + 0.25 * t});
        }
        out.push(path);
    }
    return out;
}

/** The old volcano's last warmth: two vents at the foot of the back wall, a wisp of steam each (`render/falls.ts`). */
export function steamVents(height: (x: number, z: number) => number): Array<{x: number; y: number; z: number}> {
    return [-1.62, -0.2].map((a) => {
        const d = rimRadius(a) - WALL - 0.8;
        const x = CRATER.x + Math.cos(a) * d;
        const z = CRATER.z + Math.sin(a) * d;
        return {x, y: height(x, z) + 0.1, z};
    });
}
