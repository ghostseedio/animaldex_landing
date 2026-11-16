/**
 * The town's dead wood drawn (graphics pass 2, lane town2; `deadwood.ts` places it): fallen logs bedded in the ground,
 * their bark furrowed and grey-brown with moss along the top, pale cut ends with dark rings, a broken branch stub, and
 * brackets of fungus on their sides; old stumps with a flared foot and roots, a weathered top rotting dark at the heart,
 * fungus shelves stacked up one side; and beside them patches of nettles under a bramble mound (on the foliage, so they
 * stir in the wind). ~250-400 triangles a log or stump, ~250 a patch.
 */

import {at, Geo, tone, type Frame, type V3} from "@/ark-scene/islands/town/render/kit";
import {spinX} from "@/ark-scene/islands/town/render/farm-machines";
import type {DeadwoodItem, LeafPatch} from "@/ark-scene/islands/town/deadwood";

type RGB = [number, number, number];

function mix(a: RGB, b: RGB, t: number): RGB {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function hash(a: number, b: number, seed: number): number {
    let h = (Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ Math.imul(seed + 1, 83492791)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const BARK: RGB[] = [tone("#857462"), tone("#93826b"), tone("#786a59")];
const MOSS = tone("#6f8a3c");
const WOOD = tone("#a88a62");
const ROT = tone("#4a3a2a");
const FUNGI: RGB[] = [tone("#b58a4e"), tone("#d9cfb6"), tone("#9a6a3a"), tone("#d88f3a")];

/** A bracket of fungus on a surface at (x, y, z) facing out (nx, nz): a flattened shelf, lighter on its rim. */
function bracket(geo: Geo, x: number, y: number, z: number, nx: number, nz: number, size: number, colour: RGB, seed: number) {
    geo.blob(x + nx * size * 0.45, y, z + nz * size * 0.45, size * (0.6 + Math.abs(nz) * 0.4), size * 0.22, size * (0.6 + Math.abs(nx) * 0.4), colour, seed, 0);
    geo.blob(x + nx * size * 0.75, y + size * 0.05, z + nz * size * 0.75, size * 0.35, size * 0.1, size * 0.35, mix(colour, [1, 1, 1], 0.25), seed + 1, 0);
}

export function drawDeadwood(solid: Geo, item: DeadwoodItem) {
    const seed = item.seed;
    const r = item.r;
    const pick = (k: number) => BARK[Math.floor(hash(k, 7, seed) * BARK.length)];
    if (item.kind === "log") {
        const f: Frame = {x: item.x, y: item.base + r * 0.8, z: item.z, rot: item.rot};
        const L = item.length;
        // The profile: cut ends (pale wood), a bark lip, the trunk a little uneven along its length, thinner at the top end.
        const profile: Array<[number, number]> = [[-L / 2, 0], [-L / 2, r * 0.55], [-L / 2, r * 0.9], [-L / 2 + 0.03, r]];
        for (let k = 1; k <= 4; k++) profile.push([-L / 2 + (L * k) / 5, r * (1 - k * 0.03) * (0.94 + hash(k, 3, seed) * 0.1)]);
        profile.push([L / 2 - 0.03, r * 0.86], [L / 2, r * 0.78], [L / 2, r * 0.45], [L / 2, 0]);
        const sides = 12;
        const turn = hash(1, 1, seed) * 0.5;
        // The bark smooth round (normals out from the axis), furrowed by colour: every other side darker, streaked
        // along it, moss along the top; the cut ends flat, the heart dark and rotting, the sapwood pale, a bark rim.
        const ring = (x: number, rad: number, i: number): {p: V3; n: V3} => {
            const a = turn + (i / sides) * Math.PI * 2;
            const n = at({...f, x: 0, y: 0, z: 0}, 0, Math.sin(a), Math.cos(a));
            return {p: at(f, x, Math.sin(a) * rad, Math.cos(a) * rad), n};
        };
        const barkAt = (band: number, i: number): RGB => {
            const a = turn + ((i % sides) / sides) * Math.PI * 2;
            const up = Math.sin(a);
            const b = pick(i * 5);
            const streak = 0.94 + hash(i, band, seed + 3) * 0.1;
            const furrow = i % 2 ? 0.8 : 1.05;
            const bark: RGB = [b[0] * furrow * streak, b[1] * furrow * streak, b[2] * furrow * streak];
            return up > 0.7 && hash(i, band, seed + 9) < 0.55 ? mix(bark, MOSS, 0.3 + (up - 0.7) * 1.2) : bark;
        };
        const body = profile.slice(3, profile.length - 3);
        for (let k = 0; k + 1 < body.length; k++) {
            for (let i = 0; i < sides; i++) {
                const A = ring(body[k][0], body[k][1], i);
                const B = ring(body[k + 1][0], body[k + 1][1], i);
                const C = ring(body[k + 1][0], body[k + 1][1], i + 1);
                const D = ring(body[k][0], body[k][1], i + 1);
                const ca = barkAt(k, i);
                const cd = barkAt(k, i + 1);
                solid.triShaded(A.p, B.p, C.p, A.n, B.n, C.n, ca, ca, cd);
                solid.triShaded(A.p, C.p, D.p, A.n, C.n, D.n, ca, cd, cd);
            }
        }
        // The ends: spun flat discs (rim, sapwood, heart).
        const ends: Array<Array<[number, number]>> = [profile.slice(0, 4), profile.slice(profile.length - 4)];
        ends.forEach((end, e) => spinX(solid, f, 0, 0, 0, end, sides, (band, i) => (band === (e === 0 ? 0 : 2) ? mix(ROT, WOOD, 0.3 + hash(band, i, seed) * 0.2) : band === 1 ? mix(WOOD, ROT, 0.15 + hash(band, i, seed) * 0.2) : pick(i)), turn));
        // Moss cushions on the top.
        for (let k = 0; k < 2; k++) {
            const u = (hash(k, 11, seed) - 0.5) * L * 0.6;
            const p: [number, number, number] = [f.x + Math.cos(f.rot) * u, f.y + r * 0.92, f.z + Math.sin(f.rot) * u];
            solid.blob(p[0], p[1], p[2], r * 0.7, r * 0.18, r * 0.7, MOSS, seed + k, 0);
        }
        // A broken branch stub on the bigger logs.
        if (r > 0.2) solid.cylinder(f, (hash(2, 2, seed) - 0.5) * L * 0.4, r * 0.85, (hash(3, 3, seed) - 0.5) * r * 0.6, 0.055, 0.035, 0.22 + hash(4, 4, seed) * 0.15, pick(9), 6);
        // Brackets of fungus along one side.
        const n = 2 + Math.floor(hash(5, 5, seed) * 3);
        const side = hash(6, 6, seed) < 0.5 ? 1 : -1;
        const nx = -Math.sin(f.rot) * side;
        const nz = Math.cos(f.rot) * side;
        const colour = FUNGI[Math.floor(hash(7, 7, seed) * FUNGI.length)];
        for (let k = 0; k < n; k++) {
            const u = (hash(k, 13, seed) - 0.5) * L * 0.7;
            const y = f.y + r * (hash(k, 14, seed) - 0.4) * 0.6;
            bracket(solid, f.x + Math.cos(f.rot) * u + nx * r * 0.85, y, f.z + Math.sin(f.rot) * u + nz * r * 0.85, nx, nz, 0.09 + hash(k, 15, seed) * 0.06, colour, seed + 31 * k);
        }
        return;
    }
    // A stump: a flared foot into the ground, the bole, the cut top weathered grey and rotting at the heart.
    const f: Frame = {x: item.x, y: item.base, z: item.z, rot: item.rot};
    const h = item.length;
    const bark = pick(0);
    solid.cylinder(f, 0, -0.06, 0, r * 1.3, r * 1.02, 0.16, [bark[0] * 0.9, bark[1] * 0.9, bark[2] * 0.9], 14, false);
    solid.cylinder(f, 0, 0.1, 0, r * 1.02, r * 0.96, h - 0.1, bark, 14, false);
    solid.cylinder(f, 0, h - 0.004, 0, r * 0.97, r * 0.9, 0.02, mix(WOOD, [0.55, 0.55, 0.52], 0.35), 14, true);
    solid.blob(f.x, f.y + h + 0.005, f.z, r * 0.45, 0.03, r * 0.45, ROT, seed, 0);
    // Roots running out into the ground.
    for (let k = 0; k < 4; k++) {
        const a = item.rot + (k / 4) * Math.PI * 2 + hash(k, 21, seed) * 0.6;
        const rf: Frame = {x: item.x, y: item.base - 0.02, z: item.z, rot: a};
        spinX(solid, rf, r * 0.55, -0.03, 0, [[0, 0], [0, r * 0.42], [r * 0.45, r * 0.28], [r * 0.95, 0]], 7, (_b, s) => (s < 4 ? bark : [bark[0] * 0.8, bark[1] * 0.8, bark[2] * 0.8]));
    }
    // Moss on its north side, fungus shelves stacked up the other.
    solid.blob(f.x - Math.cos(item.rot) * r * 0.85, f.y + h * 0.35, f.z - Math.sin(item.rot) * r * 0.85, r * 0.4, h * 0.3, r * 0.4, MOSS, seed + 3, 0);
    const colour = FUNGI[Math.floor(hash(7, 7, seed) * FUNGI.length)];
    const nx = Math.cos(item.rot);
    const nz = Math.sin(item.rot);
    for (let k = 0; k < 3; k++) bracket(solid, f.x + nx * r * 0.9, f.y + h * (0.25 + k * 0.22), f.z + nz * r * 0.9, nx, nz, 0.1 - k * 0.018, colour, seed + 41 * k);
}

/** Nettles beside a bramble mound by the dead wood (on the foliage, so they stir in the wind): stems with pairs of
 * drooping, pointed leaves up them, crossed at each node, and a low rounded bramble behind. */
export function drawLeafPatch(foliage: Geo, p: LeafPatch) {
    const greens: RGB[] = [tone("#4c7432"), tone("#5a843a"), tone("#45692d")];
    foliage.tag = 0.15;
    foliage.bush(p.x - p.r * 0.4, p.base + p.height * 0.2, p.z, p.r * 0.55, p.height * 0.4, p.r * 0.5, tone("#4d6e33"), p.seed);
    const stems = 8;
    for (let k = 0; k < stems; k++) {
        const a = (p.seed % 628) / 100 + k * 2.39;
        const d = p.r * (0.15 + 0.7 * hash(k, 1, p.seed));
        const x = p.x + Math.cos(a) * d;
        const z = p.z + Math.sin(a) * d;
        const tall = p.height * (0.7 + 0.35 * hash(k, 2, p.seed));
        const g = p.base;
        const green = greens[k % greens.length];
        foliage.tag = 0.45;
        foliage.tri([x - 0.006, g, z], [x + 0.006, g, z], [x, g + tall, z], green);
        foliage.tri([x, g, z - 0.006], [x, g + tall, z], [x, g, z + 0.006], green);
        const nodes = 3;
        for (let n = 0; n < nodes; n++) {
            const t = 0.35 + (0.6 * n) / nodes;
            const y = g + tall * t;
            const len = 0.17 * (1.1 - 0.5 * (n / nodes));
            const turn = a + n * (Math.PI / 2);
            for (const side of [1, -1]) {
                const ca = Math.cos(turn) * side;
                const sa = Math.sin(turn) * side;
                const tip: V3 = [x + ca * len, y - len * 0.35, z + sa * len];
                const mid: V3 = [x + ca * len * 0.45, y + 0.012, z + sa * len * 0.45];
                const left: V3 = [mid[0] - sa * len * 0.38, mid[1] - 0.012, mid[2] + ca * len * 0.38];
                const right: V3 = [mid[0] + sa * len * 0.38, mid[1] - 0.012, mid[2] - ca * len * 0.38];
                const base: V3 = [x, y, z];
                const c = [green[0] * (0.9 + 0.2 * t), green[1] * (0.9 + 0.2 * t), green[2] * (0.9 + 0.2 * t)] as RGB;
                foliage.tag = 0.5;
                foliage.tri(base, left, mid, [c[0] * 0.85, c[1] * 0.85, c[2] * 0.85]);
                foliage.tri(base, mid, right, c);
                foliage.tri(left, tip, mid, [c[0] * 1.05, c[1] * 1.05, c[2] * 1.05]);
                foliage.tri(mid, tip, right, [c[0] * 0.95, c[1] * 0.95, c[2] * 0.95]);
            }
        }
    }
    foliage.tag = 0;
}
