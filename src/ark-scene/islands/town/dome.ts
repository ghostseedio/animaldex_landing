/**
 * p5 (zoospace): the free-flight dome (the owner, 2026-11-17: "add more land area to the town island and add a giant
 * dome for big aviary and we can move some birds from the smaller aviaries to the big aviaries"). A geodesic steel and
 * mesh dome 66 m across and 27 m high on its own lobe of land west of the zoo, at the end of the zoo's middle path
 * (`plan.ts` DOME_LOBE, buildDome): a walk-through path and a raised boardwalk, a lagoon cut into the ground (still
 * water, the town's fresh water), a rain-forest cliff with a waterfall into it, tall trees and palms, snags with
 * perches at many heights, nest ledges on the cliff, feeding stations. Its birds by the homes rule (`zoo-homes.ts`):
 * the waterbirds on its lagoon and banks, the big free flyers in its canopy, the big ground birds on its floor, the
 * mountain and shore kinds on its cliff; no bird hunter and no carrion eater.
 *
 * Geometry only (no three.js): the plan, the ground, the spots, the perches, the flight bound and the renderer
 * (`render/dome.ts`) all read it.
 */
import type {Box, Poly, Pt} from "@/ark-scene/islands/town/geom";

export const DOME_ID = "zoo_dome-1";

/** The dome: its middle, its radius at the ground, its drum wall's height and the cap's rise over it (m). */
export const DOME = {x: -228, z: -88, r: 33, drum: 3.2, rise: 24};

/** The lobe of new land it stands on (as `plan.ts` SAFARI_LOBE): about 0.75 ha west of the zoo's west path. */
export const DOME_LOBE = {x: -231, z: -88, a: 56, b: 52, power: 2.6};

/** Its whole footprint with its lobby and banks (quick rejection). */
export const DOME_BOUNDS = {x0: DOME.x - DOME.r - 2, x1: DOME.x + DOME.r + 10, z0: DOME.z - DOME.r - 2, z1: DOME.z + DOME.r + 2};

export function inDome(x: number, z: number): boolean {
    return x >= DOME_BOUNDS.x0 && x <= DOME_BOUNDS.x1 && z >= DOME_BOUNDS.z0 && z <= DOME_BOUNDS.z1;
}

/** The cap's sphere: its radius, from the chord (the dome's radius) and the rise. */
const CAP_R = (DOME.r * DOME.r + DOME.rise * DOME.rise) / (2 * DOME.rise);

/** The shell's height over the dome's floor at `rho` m from its middle (the drum's top at the rim, 27.2 m at the crown). */
export function domeShell(rho: number): number {
    const q = Math.min(Math.max(rho, 0), DOME.r);
    return DOME.drum + DOME.rise - CAP_R + Math.sqrt(CAP_R * CAP_R - q * q);
}

/** The enclosure's plot: the square round the dome (its residents are kept to the circle: `domeKeep`). */
export const DOME_PLOT: Box = {x: DOME.x, z: DOME.z, w: DOME.r * 2 - 1.6, d: DOME.r * 2 - 1.6, rot: 0};

/** The double-door lobby on the east side, at the end of the zoo's middle path: outer door, a netted lobby, inner door. */
export const DOME_LOBBY: Box = {x: DOME.x + DOME.r + 2.6, z: DOME.z, w: 6.4, d: 5, rot: 0};

/** The walk from the zoo's west path to the lobby's outer door. */
export const DOME_WALK: Poly = [{x: -182, z: -88}, {x: DOME.x + DOME.r + 6, z: DOME.z}];

const at = (lx: number, lz: number): Pt => ({x: DOME.x + lx, z: DOME.z + lz});

/** The lagoon (a `SafariWater`: cut into the ground by `ground.ts`, its sheet the town's fresh water). */
export const DOME_LAGOON = {x: DOME.x - 7, z: DOME.z + 9, rx: 16, rz: 8.5, rot: 0.5, depth: 0.9};

/** In the lagoon's own measure (1 at its edge). */
export function lagoonNorm(x: number, z: number): number {
    const w = DOME_LAGOON;
    const dx = x - w.x;
    const dz = z - w.z;
    const c = Math.cos(w.rot);
    const s = Math.sin(w.rot);
    return Math.hypot((dx * c + dz * s) / w.rx, (-dx * s + dz * c) / w.rz);
}

/**
 * The rain-forest cliff along the west side, inside the shell: an arc of rockwork from `a0` to `a1` (bearings from the
 * dome's middle, radians; west is π), its face `inner` m from the middle and its back against the drum, `height` m
 * tall, the waterfall at bearing `fall` dropping into the lagoon's west end.
 */
export const DOME_CLIFF = {a0: 2.5, a1: 3.75, inner: 23.5, outer: 30.5, height: 9, fall: 2.98};

/** Whether (x, z) is on the cliff's footprint (with `margin` m round it). */
export function onCliff(x: number, z: number, margin = 0): boolean {
    const dx = x - DOME.x;
    const dz = z - DOME.z;
    const rho = Math.hypot(dx, dz);
    if (rho < DOME_CLIFF.inner - margin) return false;
    let a = Math.atan2(dz, dx);
    if (a < 0) a += Math.PI * 2;
    const pad = margin / Math.max(rho, 1);
    return a > DOME_CLIFF.a0 - pad && a < DOME_CLIFF.a1 + pad;
}

/** The visitors' path on the ground (from the inner door; two branches) and the raised boardwalk over the lagoon's end. */
export const DOME_PATHS: Poly[] = [
    [at(31, 0), at(20, 0), at(10, -9), at(-3, -14), at(-15, -12)],
    [at(20, 0), at(13, 5)]
];
export const DOME_BOARDWALK: Poly = [at(13, 5), at(6, 13), at(-2, 21), at(-13, 23)];
export const DOME_BOARDWALK_HEIGHT = 1.5;
export const DOME_PATH_WIDTH = 2.6;

/** The trees inside (leaf-atlas kinds, `trees.ts`): each under the shell where it stands, clear of the lagoon and paths. */
export const DOME_TREES: Array<{kind: "plane" | "oak" | "lime" | "palm" | "willow"; x: number; z: number; height: number}> = [
    {kind: "plane", ...at(3, -3), height: 17},
    {kind: "plane", ...at(-10, -4), height: 15},
    {kind: "oak", ...at(14, -17), height: 12.5},
    {kind: "oak", ...at(20, 12), height: 11.5},
    {kind: "lime", ...at(-3, -22), height: 12},
    {kind: "palm", ...at(24, -9), height: 9.5},
    {kind: "palm", ...at(7, -26), height: 9},
    {kind: "palm", ...at(-19.5, 16.5), height: 8},
    {kind: "palm", ...at(26, 5), height: 8.5},
    {kind: "palm", ...at(-17, -19), height: 9},
    {kind: "willow", ...at(13, 22), height: 9},
    {kind: "palm", ...at(3, 25.5), height: 8}
];

/** A snag (a dead tree stood for perching): its foot, its height, its limbs (bearing, height up the trunk, reach). */
export type DomeSnag = {x: number; z: number; height: number; limbs: Array<{a: number; y: number; reach: number}>};
export const DOME_SNAGS: DomeSnag[] = [
    {...at(10, 0), height: 14, limbs: [{a: 0.4, y: 4, reach: 2.6}, {a: 2.5, y: 6.5, reach: 2.4}, {a: 4.4, y: 9, reach: 2.2}, {a: 1.2, y: 11, reach: 1.8}, {a: 5.6, y: 12.6, reach: 1.4}]},
    {...at(-6, -19), height: 11, limbs: [{a: 1.0, y: 3.2, reach: 2.4}, {a: 3.3, y: 5.5, reach: 2.2}, {a: 5.2, y: 7.8, reach: 2}, {a: 2.1, y: 9.6, reach: 1.6}]},
    {...at(18, -7), height: 8, limbs: [{a: 0.2, y: 2.6, reach: 2}, {a: 2.2, y: 4.4, reach: 1.9}, {a: 4.5, y: 6.2, reach: 1.6}]},
    {...at(-18, 21), height: 7, limbs: [{a: 5.4, y: 2.4, reach: 2}, {a: 0.9, y: 4, reach: 1.8}, {a: 3.4, y: 5.6, reach: 1.5}]},
    {...at(9.5, 18.5), height: 6, limbs: [{a: 4.2, y: 2.2, reach: 1.8}, {a: 0.3, y: 3.6, reach: 1.7}, {a: 2.4, y: 5, reach: 1.3}]},
    {...at(-16, -6), height: 5, limbs: [{a: 0.6, y: 1.8, reach: 1.6}, {a: 5.0, y: 3.2, reach: 1.5}]}
];

/** The feeding stations: a post with a tray (fruit and seed), on the forest floor by the paths. */
export const DOME_FEEDERS: Pt[] = [at(13, -2), at(2, -9.5), at(-11, -16), at(17, 8.5), at(-10, 26)];

/** A perch a bird stands on: a snag's limb tip, a nest ledge on the cliff, a feeding tray (y over the dome's floor). */
export type DomePerch = {id: string; kind: "limb" | "ledge" | "tray"; x: number; y: number; z: number};

export function domePerches(): DomePerch[] {
    const out: DomePerch[] = [];
    DOME_SNAGS.forEach((s, i) => {
        s.limbs.forEach((l, k) => out.push({id: `snag${i}:${k}`, kind: "limb", x: s.x + Math.cos(l.a) * l.reach, y: l.y + l.reach * 0.45, z: s.z + Math.sin(l.a) * l.reach}));
        out.push({id: `snag${i}:top`, kind: "limb", x: s.x, y: s.height, z: s.z});
    });
    // The cliff's nest ledges: two rows along its face.
    const n = 7;
    for (let k = 0; k < n; k++) {
        const a = DOME_CLIFF.a0 + ((DOME_CLIFF.a1 - DOME_CLIFF.a0) * (k + 0.5)) / n;
        if (Math.abs(a - DOME_CLIFF.fall) < 0.09) continue;
        // (The lower row on the first tier's top, the upper on the second's: `zoo-habitat.ts`.)
        const rho = DOME_CLIFF.inner + (k % 2 ? 2.3 : 0.9);
        out.push({id: `ledge${k}`, kind: "ledge", x: DOME.x + Math.cos(a) * rho, y: k % 2 ? 6.2 : 3.4, z: DOME.z + Math.sin(a) * rho});
    }
    DOME_FEEDERS.forEach((f, i) => out.push({id: `tray${i}`, kind: "tray", x: f.x, y: 1.25, z: f.z}));
    return out;
}

function nearLine(line: Poly, x: number, z: number, within: number): boolean {
    for (let i = 1; i < line.length; i++) {
        const a = line[i - 1];
        const b = line[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const t = Math.min(Math.max(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0), 1);
        if (Math.hypot(x - a.x - dx * t, z - a.z - dz * t) < within) return true;
    }
    return false;
}

/** On a visitors' way (a path or under the boardwalk), with `margin` m beside it. */
export function onDomeWay(x: number, z: number, margin = 0): boolean {
    return DOME_PATHS.some((p) => nearLine(p, x, z, DOME_PATH_WIDTH / 2 + margin)) || nearLine(DOME_BOARDWALK, x, z, DOME_PATH_WIDTH / 2 + margin);
}

export type DomeZone = "pool" | "lagoon" | "cliff" | "canopy" | "floor";

/** Which of the dome's zones a ground point is in: the water, its banks, the cliff's foot, under the trees and snags, the open floor. */
export function domeZoneAt(x: number, z: number): DomeZone {
    const n = lagoonNorm(x, z);
    if (n < 1) return "pool";
    if (n < 1.75) return "lagoon";
    if (onCliff(x, z, 6)) return "cliff";
    const wooded = DOME_TREES.some((t) => Math.hypot(t.x - x, t.z - z) < 6) || DOME_SNAGS.some((s) => Math.hypot(s.x - x, s.z - z) < 5.5);
    return wooded ? "canopy" : "floor";
}

/**
 * The residents' spots: a jittered grid 2.6 m apart over the dome's floor (the same for everyone), inside the circle
 * (2.5 m in from the drum), off the paths, the cliff, the trunks, the lobby's door; on the water only its middle (the
 * swimmers'), never its edge's shallows.
 */
export function domeSpots(seed: number): Pt[] {
    const out: Pt[] = [];
    const step = 2.6;
    let k = seed >>> 0;
    const next = () => {
        k = (Math.imul(k, 1664525) + 1013904223) >>> 0;
        return k / 4294967296;
    };
    for (let lx = -DOME.r; lx <= DOME.r; lx += step) {
        for (let lz = -DOME.r; lz <= DOME.r; lz += step) {
            const x = DOME.x + lx + (next() - 0.5) * step * 0.6;
            const z = DOME.z + lz + (next() - 0.5) * step * 0.6;
            if (Math.hypot(x - DOME.x, z - DOME.z) > DOME.r - 3.2) continue;
            if (onDomeWay(x, z, 0.9) || onCliff(x, z, 1.4)) continue;
            if (DOME_TREES.some((t) => Math.hypot(t.x - x, t.z - z) < 1.6) || DOME_SNAGS.some((s) => Math.hypot(s.x - x, s.z - z) < 1.3) || DOME_FEEDERS.some((f) => Math.hypot(f.x - x, f.z - z) < 1.1)) continue;
            const n = lagoonNorm(x, z);
            if (n > 0.72 && n < 1.12) continue;
            out.push({x, z});
        }
    }
    return out;
}

/**
 * The flight bound: a body (its base at `y` m over the dome's floor, `tall` m high, `half` m its half length) kept
 * inside the dome's volume. Returns the point pulled in: `rho` at most where the shell is `tall` + a hand over `y`, and
 * `y` at most the shell there less its height. `x`, `z` the town's frame.
 */
export function domeKeep(x: number, z: number, y: number, tall: number, half: number): {x: number; z: number; y: number} {
    const dx = x - DOME.x;
    const dz = z - DOME.z;
    let rho = Math.hypot(dx, dz);
    const clear = 0.35;
    // (Never past the drum's inside, less its half length.)
    const reach = Math.max(DOME.r - 1.2 - half, 1);
    let ny = Math.min(y, DOME.drum + DOME.rise - tall - clear);
    if (rho > reach) rho = reach;
    // (Under the shell where its far end is: lowered first, then drawn in if it is still over it.)
    const roof = domeShell(Math.min(rho + half, DOME.r)) - tall - clear;
    if (ny > roof) ny = Math.max(roof, 0);
    const k = Math.hypot(dx, dz) > 1e-6 ? rho / Math.hypot(dx, dz) : 1;
    return {x: DOME.x + dx * k, z: DOME.z + dz * k, y: ny};
}

/** A swimmer's point kept on the lagoon's open water (inside `most` of its measure), drawn in towards its middle. */
export function intoLagoon(x: number, z: number, most = 0.78): {x: number; z: number} {
    const n = lagoonNorm(x, z);
    if (n <= most) return {x, z};
    const k = most / n;
    return {x: DOME_LAGOON.x + (x - DOME_LAGOON.x) * k, z: DOME_LAGOON.z + (z - DOME_LAGOON.z) * k};
}

/** The waterbirds that live on the water (a stored water role: ducks, grebes, coots, swans): the lagoon's swimmers. */
export const DOME_FLOATERS: ReadonlySet<string> = new Set(["dabbler", "diver", "coot", "grebe", "swan"]);
