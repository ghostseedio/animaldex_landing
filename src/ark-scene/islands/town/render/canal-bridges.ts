/**
 * Drawing the canal's humpbacked bridges (`islands/town/canal-bridges.ts` holds their numbers; the owner, 2026-11-17:
 * "the canal bridge looks so bad and glitchy, fix it"). Each is one closed piece of masonry in the chunk's solid
 * (the building shader's brick and stone): brick spandrels and parapets that follow the deck's curve, a stone string
 * course at the deck, stone coping on the parapets, a ring of stone voussoirs with a keystone round a segmental brick
 * barrel vault over the water, and a pier with a cap at each end of each parapet, its foot below the ground. Every face
 * is wound to face out and no two faces share a plane: the voussoirs stand 5 cm proud of the spandrel, the string
 * course 8 cm, the coping overhangs 7 cm. The street's own surfaces (road, pavements, path) lie on the deck between
 * the parapets: `render/streets.ts` with `streetHeight` (scenery.ts), which follows `bridgeHeight`.
 */

import {CANAL_LEVEL} from "@/ark-scene/islands/town/plan";
import {archAt, archCircle, ARCH_RING, PARAPET, parapetFoot, type CanalBridge} from "@/ark-scene/islands/town/canal-bridges";
import {SURFACE} from "@/ark-scene/islands/town/render/buildings";
import {tone, type Geo, type V3} from "@/ark-scene/islands/town/render/kit";

const BRICK = tone("#9b5f48");
const BRICK_VAULT = tone("#7e4f3e");
const STONE = tone("#b9ae98");
const STONE_DARK = tone("#a89c86");
const COPING = tone("#cbc2ae");
/** The voussoirs' stones, each a little different, so the ring reads as cut blocks; the keystone the palest. */
const VOUSSOIR_TONES = [tone("#c3b8a2"), tone("#aa9f89"), tone("#b9ad96"), tone("#a39781")];
const KEYSTONE = tone("#d2c8b3");
/** The voussoirs (odd: a keystone at the crown), how far they and the string course stand proud (m). */
const VOUSSOIRS = 15;
const VOUSSOIR_PROUD = 0.05;
const STRING_PROUD = 0.08;
const STRING_HIGH = 0.2;
const KEY_EXTRA = 0.12;
const PIER = {side: 0.66, over: 0.3, cap: 0.16};

type Ground = (x: number, z: number) => number;

/** A point in the bridge's frame: `u` across (+ left of the street), `v` along it, `y` up. */
function P(b: CanalBridge, u: number, v: number, y: number): V3 {
    return [b.x + b.dx * v - b.dz * u, y, b.z + b.dz * v + b.dx * u];
}

/** A quad wound so its normal points along `out` (the bridge frame's u, y, v components). */
function face(geo: Geo, b: CanalBridge, a: V3, c1: V3, c2: V3, d: V3, out: [number, number, number], colour: [number, number, number]) {
    const wx = -b.dz * out[0] + b.dx * out[2];
    const wz = b.dx * out[0] + b.dz * out[2];
    const ux = c1[0] - a[0];
    const uy = c1[1] - a[1];
    const uz = c1[2] - a[2];
    const vx = c2[0] - a[0];
    const vy = c2[1] - a[1];
    const vz = c2[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx * wx + ny * out[1] + nz * wz >= 0) geo.quad(a, c1, c2, d, colour);
    else geo.quad(a, d, c2, c1, colour);
}

/** The v stations: the voussoirs' joints at the soffit across the arch, then every 0.5 m out to the ends. */
function stations(b: CanalBridge): {arch: Array<{v: number; a: number}>; outer: number[]} {
    const {r} = archCircle(b);
    const phi = Math.asin(Math.min(b.spanHalf / r, 1));
    const arch = Array.from({length: VOUSSOIRS + 1}, (_, i) => {
        const a = -phi + (2 * phi * i) / VOUSSOIRS;
        return {v: r * Math.sin(a), a};
    });
    const outer: number[] = [];
    const n = Math.max(2, Math.ceil((b.reach - b.spanHalf) / 0.5));
    for (let k = 0; k <= n; k++) outer.push(b.spanHalf + ((b.reach - b.spanHalf) * k) / n);
    return {arch, outer};
}

/** Draws one bridge's masonry into `geo` (the chunk's solid). Returns its triangle count. */
export function drawCanalBridge(geo: Geo, b: CanalBridge, ground: Ground): number {
    const before = geo.triangles;
    const {cy, r} = archCircle(b);
    const {arch, outer} = stations(b);
    const reachOut = b.band + PARAPET.thick;
    const groundAt = (u: number, v: number) => {
        const p = P(b, u, v, 0);
        return ground(p[0], p[2]);
    };
    for (const s of [-1, 1] as const) {
        const uIn = s * b.band;
        const uOut = s * reachOut;
        const foot = (v: number) => parapetFoot(b, v, ground, s);
        const top = (v: number) => foot(v) + PARAPET.high;
        const stringY = (v: number) => foot(v) - 0.12;
        const bottom = (v: number) => (Math.abs(v) < b.bankHalf ? CANAL_LEVEL - 1.8 : Math.min(groundAt(uOut, v), groundAt(uIn, v)) - 0.6);
        geo.as(SURFACE.brick, () => {
            // The spandrel and parapet's outer face: over the arch from its soffit, past it from below the bank or ground.
            for (let i = 1; i < arch.length; i++) {
                const v0 = arch[i - 1].v;
                const v1 = arch[i].v;
                face(geo, b, P(b, uOut, v0, archAt(b, v0)!), P(b, uOut, v1, archAt(b, v1)!), P(b, uOut, v1, top(v1)), P(b, uOut, v0, top(v0)), [s, 0, 0], BRICK);
            }
            for (const dir of [-1, 1]) {
                for (let k = 1; k < outer.length; k++) {
                    const v0 = dir * outer[k - 1];
                    const v1 = dir * outer[k];
                    face(geo, b, P(b, uOut, v0, bottom(v0)), P(b, uOut, v1, bottom(v1)), P(b, uOut, v1, top(v1)), P(b, uOut, v0, top(v0)), [s, 0, 0], BRICK);
                    // The parapet's inner face, from under the pavement to the coping.
                    face(geo, b, P(b, uIn, v0, foot(v0) - 0.25), P(b, uIn, v1, foot(v1) - 0.25), P(b, uIn, v1, top(v1)), P(b, uIn, v0, top(v0)), [-s, 0, 0], BRICK);
                }
            }
            for (let i = 1; i < arch.length; i++) {
                const v0 = arch[i - 1].v;
                const v1 = arch[i].v;
                face(geo, b, P(b, uIn, v0, foot(v0) - 0.25), P(b, uIn, v1, foot(v1) - 0.25), P(b, uIn, v1, top(v1)), P(b, uIn, v0, top(v0)), [-s, 0, 0], BRICK);
            }
        });
        geo.as(SURFACE.stone, () => {
            // The coping along the parapet's top, overhanging both faces; its sides and undersides.
            const all = [...outer.slice().reverse().map((v) => -v), ...arch.slice(1, -1).map((p) => p.v), ...outer];
            const cIn = uIn - s * PARAPET.overhang;
            const cOut = uOut + s * PARAPET.overhang;
            for (let k = 1; k < all.length; k++) {
                const v0 = all[k - 1];
                const v1 = all[k];
                if (v1 - v0 < 1e-4) continue;
                const t0 = top(v0);
                const t1 = top(v1);
                const h = PARAPET.coping;
                face(geo, b, P(b, cIn, v0, t0 + h), P(b, cOut, v0, t0 + h), P(b, cOut, v1, t1 + h), P(b, cIn, v1, t1 + h), [0, 1, 0], COPING);
                face(geo, b, P(b, cOut, v0, t0 - 0.01), P(b, cOut, v1, t1 - 0.01), P(b, cOut, v1, t1 + h), P(b, cOut, v0, t0 + h), [s, 0, 0], COPING);
                face(geo, b, P(b, cIn, v0, t0 - 0.01), P(b, cIn, v1, t1 - 0.01), P(b, cIn, v1, t1 + h), P(b, cIn, v0, t0 + h), [-s, 0, 0], COPING);
                face(geo, b, P(b, uOut, v0, t0 - 0.01), P(b, cOut, v0, t0 - 0.01), P(b, cOut, v1, t1 - 0.01), P(b, uOut, v1, t1 - 0.01), [0, -1, 0], STONE_DARK);
                face(geo, b, P(b, uIn, v0, t0 - 0.01), P(b, cIn, v0, t0 - 0.01), P(b, cIn, v1, t1 - 0.01), P(b, uIn, v1, t1 - 0.01), [0, -1, 0], STONE_DARK);
                // The string course at the deck's level on the outer face (stopping short of the end piers).
                if (Math.abs(v0) > b.reach - PIER.side || Math.abs(v1) > b.reach - PIER.side) continue;
                const sOut = uOut + s * STRING_PROUD;
                const y0 = stringY(v0);
                const y1 = stringY(v1);
                face(geo, b, P(b, sOut, v0, y0), P(b, sOut, v1, y1), P(b, sOut, v1, y1 + STRING_HIGH), P(b, sOut, v0, y0 + STRING_HIGH), [s, 0, 0], STONE);
                face(geo, b, P(b, uOut, v0, y0 + STRING_HIGH), P(b, sOut, v0, y0 + STRING_HIGH), P(b, sOut, v1, y1 + STRING_HIGH), P(b, uOut, v1, y1 + STRING_HIGH), [0, 1, 0], STONE);
                face(geo, b, P(b, uOut, v0, y0), P(b, sOut, v0, y0), P(b, sOut, v1, y1), P(b, uOut, v1, y1), [0, -1, 0], STONE_DARK);
            }
            for (const end of [-1, 1]) {
                const v = end * (b.reach - PIER.side);
                const y = stringY(v);
                face(geo, b, P(b, uOut, v, y), P(b, uOut + s * STRING_PROUD, v, y), P(b, uOut + s * STRING_PROUD, v, y + STRING_HIGH), P(b, uOut, v, y + STRING_HIGH), [0, 0, end], STONE_DARK);
            }
            // The voussoirs: a ring of stones round the arch, each 5 cm proud, the keystone taller.
            const uv = uOut + s * VOUSSOIR_PROUD;
            for (let i = 1; i < arch.length; i++) {
                const a0 = arch[i - 1].a;
                const a1 = arch[i].a;
                const key = i - 1 === (VOUSSOIRS - 1) / 2;
                const ring = ARCH_RING + (key ? KEY_EXTRA : 0);
                const pin = (a: number, rr: number, u: number) => P(b, u, rr * Math.sin(a), cy + rr * Math.cos(a));
                const tone2 = key ? KEYSTONE : VOUSSOIR_TONES[(i * 5) % VOUSSOIR_TONES.length];
                face(geo, b, pin(a0, r, uv), pin(a1, r, uv), pin(a1, r + ring, uv), pin(a0, r + ring, uv), [s, 0, 0], tone2);
                // Its soffit and back edges (the 5 cm it stands proud), and the keystone's sides above its neighbours.
                face(geo, b, pin(a0, r, uOut), pin(a1, r, uOut), pin(a1, r, uv), pin(a0, r, uv), [0, -1, 0], STONE_DARK);
                face(geo, b, pin(a0, r + ring, uOut), pin(a1, r + ring, uOut), pin(a1, r + ring, uv), pin(a0, r + ring, uv), [0, 1, 0], tone2);
                if (key || i === 1 || i === arch.length - 1) {
                    for (const [a, side] of [[a0, -1], [a1, 1]] as const) face(geo, b, pin(a, r, uOut), pin(a, r, uv), pin(a, r + ring, uv), pin(a, r + ring, uOut), [0, 0, side], STONE_DARK);
                }
            }
            // The end piers: square, capped, their feet below the ground.
            for (const end of [-1, 1]) {
                const v = end * (b.reach - PIER.side / 2);
                const u = s * (b.band + PIER.side / 2 - 0.02);
                const lo = Math.min(groundAt(u, v - PIER.side / 2), groundAt(u, v + PIER.side / 2)) - 0.5;
                const hi = Math.max(top(v - PIER.side / 2), top(v + PIER.side / 2)) + PIER.over;
                const c = P(b, u, v, 0);
                const turn = Math.atan2(-b.dx, b.dz);
                const frame = {x: c[0], y: lo, z: c[2], rot: turn};
                geo.box(frame, 0, 0, 0, PIER.side, hi - lo, PIER.side, STONE);
                geo.box(frame, 0, hi - lo, 0, PIER.side + 0.14, PIER.cap, PIER.side + 0.14, COPING);
                geo.pyramid(frame, 0, hi - lo + PIER.cap, 0, PIER.side * 0.7, 0.32, COPING);
            }
        });
    }
    // The barrel vault over the water, from face to face.
    geo.as(SURFACE.brick, () => {
        for (let i = 1; i < arch.length; i++) {
            const a0 = arch[i - 1].a;
            const a1 = arch[i].a;
            const pin = (a: number, u: number) => P(b, u, r * Math.sin(a), cy + r * Math.cos(a));
            const mid = (a0 + a1) / 2;
            face(geo, b, pin(a0, -reachOut), pin(a1, -reachOut), pin(a1, reachOut), pin(a0, reachOut), [0, -Math.cos(mid), -Math.sin(mid)], BRICK_VAULT);
        }
    });
    return geo.triangles - before;
}
