/**
 * The canal's bridges as built (the owner, 2026-11-17: "the canal bridge looks so bad and glitchy, fix it"). Each
 * street that crosses the canal (the High Street, Mill Lane, Harbour Road, and Church Walk's footbridge) crosses on a
 * humpbacked masonry bridge: the street rises in one smooth curve from bank to bank (`bridgeHeight`, used by the street
 * surfaces, the lamps and furniture, the cars and, through the drawn street surfaces, every walker) and comes down to
 * the street's own ground at both ends, so there is no step and no gap. Under it a segmental arch springs from the
 * canal's walls over the water (`archAt`). Pure: the plan's streets and the canal's line only; `render/scenery.ts`
 * draws the masonry from these numbers.
 *
 * It replaces a flat deck at the bank's level whose canal coping (18 cm over the bank) stood through the road surface
 * (6 cm over it) as a pale bar across each bridge, with single-sided arch faces you could see the sky through.
 */

import {TOWN_STREETS, CANAL, CANAL_LEVEL, CANAL_WIDTH, TOWN_LEVEL, type Street} from "@/ark-scene/islands/town/plan";
import type {Poly} from "@/ark-scene/islands/town/geom";

export type CanalBridge = {
    street: string;
    /** Where the street's line crosses the canal's. */
    x: number;
    z: number;
    /** Along the street (unit), and the canal's own direction there (unit). */
    dx: number;
    dz: number;
    /** The street's band from its line: half its width plus its pavement (m); the parapets stand outside it. */
    band: number;
    /** How far along the street the hump reaches either side of the crossing (m), and how high its crown is (m). */
    reach: number;
    rise: number;
    /** Half the arch's span along the street (m): to the canal walls' faces, wider where the street crosses askew. */
    spanHalf: number;
    /** Half the length along the street where the canal's walls and coping are under the deck (m). */
    bankHalf: number;
    /** The arch's springing (m, at the canal walls' faces) and its crown's soffit. */
    springY: number;
    crownY: number;
    foot: boolean;
};

/** The parapet: its thickness (m), its height over the walking surface, the coping's overhang either side. */
export const PARAPET = {thick: 0.42, high: 1.0, coping: 0.14, overhang: 0.07};
/** The arch ring's depth (m: the voussoirs' length, intrados to extrados) and the deck's depth over the crown. */
export const ARCH_RING = 0.46;
const DECK_OVER_CROWN = 0.16;
/** The street's surface lift over the ground it is laid on (the pavements' lift is the highest, 16 cm). */
const SURFACE_TOP = 0.16;

const ROAD = {reach: 10.5, rise: 0.48};
const FOOT = {reach: 7.5, rise: 0.62};

function crossings(street: Street, canal: Poly): Array<{x: number; z: number; dx: number; dz: number; cx: number; cz: number}> {
    const out: Array<{x: number; z: number; dx: number; dz: number; cx: number; cz: number}> = [];
    for (let i = 1; i < street.line.length; i++) {
        const a = street.line[i - 1];
        const b = street.line[i];
        for (let k = 1; k < canal.length; k++) {
            const c = canal[k - 1];
            const d = canal[k];
            const rx = b.x - a.x;
            const rz = b.z - a.z;
            const sx = d.x - c.x;
            const sz = d.z - c.z;
            const den = rx * sz - rz * sx;
            if (Math.abs(den) < 1e-9) continue;
            const t = ((c.x - a.x) * sz - (c.z - a.z) * sx) / den;
            const u = ((c.x - a.x) * rz - (c.z - a.z) * rx) / den;
            if (t < 0 || t > 1 || u < 0 || u > 1) continue;
            const rl = Math.hypot(rx, rz);
            const sl = Math.hypot(sx, sz);
            out.push({x: a.x + rx * t, z: a.z + rz * t, dx: rx / rl, dz: rz / rl, cx: sx / sl, cz: sz / sl});
        }
    }
    return out;
}

let cached: CanalBridge[] | null = null;

/** Every bridge over the canal (the streets the old flat decks were drawn for: not the zoo's paths, tracks, lanes or the quay). */
export function canalBridges(streets: readonly Street[] = TOWN_STREETS): CanalBridge[] {
    if (cached && streets === TOWN_STREETS) return cached;
    const out: CanalBridge[] = [];
    for (const s of streets) {
        if (s.kind === "zoo_path" || s.kind === "track" || s.kind === "lane" || s.kind === "quay") continue;
        for (const c of crossings(s, CANAL)) {
            const foot = s.kind === "path";
            const shape = foot ? FOOT : ROAD;
            // (The street crossing askew meets the canal's walls further along it: 1 / sin of the angle between them.)
            const sin = Math.max(0.5, Math.abs(c.dx * c.cz - c.dz * c.cx));
            const spanHalf = (CANAL_WIDTH / 2 - 0.15) / sin;
            const deckTop = TOWN_LEVEL + shape.rise;
            const crownY = deckTop - ARCH_RING - DECK_OVER_CROWN;
            out.push({street: s.id, x: c.x, z: c.z, dx: c.dx, dz: c.dz, band: s.width / 2 + s.pavement, reach: shape.reach, rise: shape.rise, spanHalf, bankHalf: (CANAL_WIDTH / 2 + 0.55) / sin + 0.25, springY: CANAL_LEVEL + 0.3, crownY, foot});
        }
    }
    if (streets === TOWN_STREETS) cached = out;
    return out;
}

/** A point in a bridge's frame: `v` along the street from the crossing, `u` across it (+: the street's left). */
export function bridgeLocal(b: CanalBridge, x: number, z: number): {u: number; v: number} {
    const ox = x - b.x;
    const oz = z - b.z;
    return {v: ox * b.dx + oz * b.dz, u: -ox * b.dz + oz * b.dx};
}

/** The hump's lift over the bank's level at `v` along the street (m): a raised cosine, flat at the crown and both ends. */
export function humpLift(b: CanalBridge, v: number): number {
    const t = Math.min(Math.abs(v) / b.reach, 1);
    return b.rise * (1 + Math.cos(Math.PI * t)) * 0.5;
}

/** How much the bank's level (rather than the ground) holds the deck at `v`: 1 over the canal and its walls, 0 at the ends. */
function holdLevel(b: CanalBridge, v: number): number {
    const a = Math.abs(v);
    if (a <= b.bankHalf) return 1;
    const t = Math.min((a - b.bankHalf) / (b.reach - b.bankHalf), 1);
    return 1 - t * t * (3 - 2 * t);
}

/** The bridge under a point, if the point is on one's deck (its street band and parapets, along its reach). */
export function bridgeAt(x: number, z: number): {bridge: CanalBridge; u: number; v: number} | null {
    for (const b of canalBridges()) {
        const ox = x - b.x;
        const oz = z - b.z;
        if (Math.abs(ox) > b.reach + 4 || Math.abs(oz) > b.reach + 4) continue;
        const {u, v} = bridgeLocal(b, x, z);
        if (Math.abs(v) < b.reach && Math.abs(u) < b.band + PARAPET.thick + 0.3) return {bridge: b, u, v};
    }
    return null;
}

/**
 * The ground a street is laid on over a bridge (m; its surfaces add their own lift: the road 6 cm, pavements 16 cm):
 * the bank's level plus the hump over the canal, easing back to the street's own ground (`ground`) at either end.
 * Null off the bridges.
 */
export function bridgeHeight(x: number, z: number, ground: (x: number, z: number) => number): number | null {
    const on = bridgeAt(x, z);
    if (!on) return null;
    const {bridge, v} = on;
    const hold = holdLevel(bridge, v);
    const base = hold >= 1 ? TOWN_LEVEL : TOWN_LEVEL * hold + ground(x, z) * (1 - hold);
    return base + humpLift(bridge, v);
}

/** The arch's soffit (intrados) at `v` along the street (m), or null past its springings: a segment of a circle. */
export function archAt(b: CanalBridge, v: number): number | null {
    const c = b.spanHalf;
    if (Math.abs(v) > c) return null;
    const rise = b.crownY - b.springY;
    const r = (c * c + rise * rise) / (2 * rise);
    return b.crownY - r + Math.sqrt(Math.max(r * r - v * v, 0));
}

/** The arch circle's centre height and radius (the voussoirs' joints point at its centre). */
export function archCircle(b: CanalBridge): {cy: number; r: number} {
    const c = b.spanHalf;
    const rise = b.crownY - b.springY;
    const r = (c * c + rise * rise) / (2 * rise);
    return {cy: b.crownY - r, r};
}

/** The deck's walking surface at the parapet's foot (m, for drawing the parapet): the bridge's own surface top. */
export function parapetFoot(b: CanalBridge, v: number, ground: (x: number, z: number) => number, side: 1 | -1): number {
    const u = side * (b.band + PARAPET.thick / 2);
    const x = b.x + b.dx * v - b.dz * u;
    const z = b.z + b.dz * v + b.dx * u;
    const hold = holdLevel(b, v);
    const base = hold >= 1 ? TOWN_LEVEL : TOWN_LEVEL * hold + ground(x, z) * (1 - hold);
    return base + humpLift(b, v) + SURFACE_TOP;
}
