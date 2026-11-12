/**
 * The zoo's barriers, each enclosure type as a real zoo builds it (lane GC; docs/ark/town-island.md §13), always on
 * the plot's own boundary, which stays the hard collider (`obstacles.ts`, decision 149: zoo fences and nets have no
 * gap) and the residents' mask 0.4 m inside it (T3): what changes is only what the visitors see.
 *
 * - **Big cats:** laminated glass viewing panels along the visitors' path on a low plinth, welded mesh above and on the
 *   other sides to 4.5 m, its top cranked inwards (the overhang a leopard cannot climb past).
 * - **Bears and wolves:** a glass front on a stone plinth; rockwork walls with a mesh fence on top along the sides and
 *   back, and hot wires on stand-offs inside the mesh.
 * - **Savanna paddocks:** a dry-stone wall on the path side with a low rail on it (a ha-ha seen from the path);
 *   timber posts with tensioned cables and a mesh skirt on the other sides.
 * - **Hoofstock paddocks:** a four-rail timber post-and-rail fence with stock mesh on its lower half.
 * - **Children's farm:** a low post-and-rail fence with stock mesh, the visitors' side planted.
 * - **Small mammals:** a low brick wall with clear panels on it and an inward lip (a meerkat cannot climb glass).
 * - **Penguin and seal pools:** a glass balustrade on the front (the pool seen through it), rockwork round the rest.
 * - **Aviaries:** green steel posts and a ring beam, an arched roof frame, and fine stainless netting on the walls and
 *   roof that the eye sees through: the birds are seen inside (the net shader's wires are drawn at their real 1.5 mm
 *   on a 25 mm mesh close up, a faint veil far away, `render/index.ts` netMaterial).
 *
 * Signs are plain coloured boards with a simple pictogram shape: no text.
 *
 * Into the zoo's chunks: solids (posts, walls, rails), the net channel (mesh and netting: its `tag` 0 mesh, 1 fine
 * netting, 2 clear glass).
 */

import {corners, hashText, rng, type Box, type Pt} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import type {ZooEnclosure} from "@/ark-scene/islands/town/areas";
import {at, Geo, tone, type Frame, type V3} from "@/ark-scene/islands/town/render/kit";

type RGB = [number, number, number];
type Parts = {solid: Geo; net: Geo};

const H = (x: number, z: number) => townHeight(x, z);
const STEEL_GREEN = tone("#2f4a38");
const MESH = tone("#2a2d2f");
const NETTING = tone("#3a3f42");
const GLASS = tone("#c8dde0");
const STONE = tone("#a59c8a");
const ROCK = tone("#8f877a");
const BRICK = tone("#8c5a48");
const TIMBER = tone("#7a5a3e");
const CABLE = tone("#3a3a3a");
const COPING = tone("#c9c0ac");

/** The net channel's tags: welded mesh, fine aviary netting, clear glass. */
export const NET_MESH = 0;
export const NET_FINE = 1;
export const NET_GLASS = 2;

function shade(c: RGB, k: number): RGB {
    return [c[0] * k, c[1] * k, c[2] * k];
}

/** A vertical panel along a ground segment a→b, from `y0` to `y1` over the ground at each end (net channel, tagged). */
function panel(net: Geo, a: Pt, b: Pt, y0: number, y1: number, tag: number, colour: RGB) {
    const ga = H(a.x, a.z);
    const gb = H(b.x, b.z);
    net.tag = tag;
    net.quad([a.x, ga + y0, a.z], [b.x, gb + y0, b.z], [b.x, gb + y1, b.z], [a.x, ga + y1, a.z], colour);
    net.tag = 0;
}

/** A segment's frame at its middle (local z along it). */
function segFrame(a: Pt, b: Pt): Frame & {length: number} {
    const x = (a.x + b.x) / 2;
    const z = (a.z + b.z) / 2;
    return {x, y: H(x, z), z, rot: Math.atan2(-(b.x - a.x), b.z - a.z), length: Math.hypot(b.x - a.x, b.z - a.z)};
}

/** Posts along a segment every `spacing` m (and at its ends). */
function posts(solid: Geo, a: Pt, b: Pt, spacing: number, height: number, size: number, colour: RGB) {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.round(length / spacing));
    for (let k = 0; k <= n; k++) {
        const x = a.x + ((b.x - a.x) * k) / n;
        const z = a.z + ((b.z - a.z) * k) / n;
        solid.box({x, y: H(x, z), z, rot: Math.atan2(-(b.x - a.x), b.z - a.z)}, 0, -0.2, 0, size, height + 0.2, size, colour);
    }
}

/** A horizontal member along a segment at a height (a rail, a cable, a coping). */
function rail(solid: Geo, a: Pt, b: Pt, y: number, w: number, h: number, colour: RGB) {
    const f = segFrame(a, b);
    solid.box(f, 0, y, 0, w, h, f.length + w, colour);
}

/** A wall along a segment (`thick` across, `height` up from below the ground), coping on top. */
function wall(solid: Geo, a: Pt, b: Pt, height: number, thick: number, colour: RGB, coping = COPING) {
    const f = segFrame(a, b);
    solid.box(f, 0, -0.3, 0, thick, height + 0.3, f.length + thick, colour);
    solid.box(f, 0, height, 0, thick + 0.08, 0.08, f.length + thick + 0.08, coping);
}

/** Rockwork: a wall of lumpy boulders along a segment. */
function rockwork(solid: Geo, a: Pt, b: Pt, height: number, seed: number) {
    const f = segFrame(a, b);
    solid.box(f, 0, -0.3, 0, 0.8, height * 0.6 + 0.3, f.length + 0.6, shade(ROCK, 0.8));
    const r = rng(seed);
    for (let t = 0.5; t < f.length; t += 0.9 + r() * 0.7) {
        const p = at(f, (r() - 0.5) * 0.3, 0, -f.length / 2 + t);
        // Weathered boulders, rounder at their tops, set into each other.
        solid.blob(p[0], p[1] + height * (0.3 + r() * 0.3), p[2], 0.6 + r() * 0.35, height * (0.3 + r() * 0.2), 0.55 + r() * 0.3, shade(ROCK, 0.82 + r() * 0.3), hashText(`${seed}:${t.toFixed(1)}`), 1);
    }
}

/** Glass viewing panels along a segment between slim frames, on a plinth `plinth` high, `height` tall over the ground. */
function glazing(parts: Parts, a: Pt, b: Pt, plinth: number, height: number, frame: RGB) {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.round(length / 2.4));
    for (let k = 0; k < n; k++) {
        const p0 = {x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n};
        const p1 = {x: a.x + ((b.x - a.x) * (k + 1)) / n, z: a.z + ((b.z - a.z) * (k + 1)) / n};
        panel(parts.net, p0, p1, plinth, height, NET_GLASS, GLASS);
    }
    posts(parts.solid, a, b, length / n, height, 0.1, frame);
    rail(parts.solid, a, b, height - 0.06, 0.12, 0.12, frame);
    if (plinth > 0) wall(parts.solid, a, b, plinth, 0.4, STONE);
}

/** A welded-mesh fence: posts, top and bottom rails, the mesh; `crank`: the top bent `crank` m inwards at 45° (toward `inward`). */
function meshFence(parts: Parts, a: Pt, b: Pt, from: number, height: number, inward: Pt | null, crank = 0, colour = STEEL_GREEN, ownPosts = true) {
    if (ownPosts) posts(parts.solid, a, b, 3, height, 0.12, colour);
    else posts(parts.solid, a, b, Math.hypot(b.x - a.x, b.z - a.z) / Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 2.4)), height, 0.1, colour);
    rail(parts.solid, a, b, height - 0.05, 0.08, 0.08, colour);
    rail(parts.solid, a, b, from + 0.02, 0.06, 0.06, colour);
    panel(parts.net, a, b, from, height, NET_MESH, MESH);
    if (crank > 0 && inward) {
        // The cranked top: a sloping band of mesh over the residents' side.
        const ga = H(a.x, a.z);
        const gb = H(b.x, b.z);
        const ix = inward.x * crank * 0.7;
        const iz = inward.z * crank * 0.7;
        parts.net.tag = NET_MESH;
        parts.net.quad([a.x, ga + height, a.z], [b.x, gb + height, b.z], [b.x + ix, gb + height + crank * 0.7, b.z + iz], [a.x + ix, ga + height + crank * 0.7, a.z + iz], MESH);
        parts.net.tag = 0;
        rail(parts.solid, {x: a.x + ix, z: a.z + iz}, {x: b.x + ix, z: b.z + iz}, height + crank * 0.7, 0.07, 0.07, colour);
    }
}

/** A plain sign board by the path: a coloured panel on two posts with a simple round pictogram, no lettering. */
function sign(solid: Geo, p: Pt, rot: number, colour: RGB) {
    const f: Frame = {x: p.x, y: H(p.x, p.z), z: p.z, rot};
    for (const lx of [-0.55, 0.55]) solid.box(f, lx, 0, 0, 0.08, 1.5, 0.08, shade(TIMBER, 0.8));
    solid.box(f, 0, 0.9, 0.05, 1.3, 0.75, 0.05, colour);
    solid.box(f, 0, 0.9, 0.05, 1.36, 0.06, 0.06, shade(colour, 0.6));
    solid.cylinder({...f, rot: rot}, -0.3, 1.1, 0.085, 0.16, 0.16, 0.01, tone("#f2ecd8"), 10);
}

/**
 * The barrier round one open enclosure (house types are lane TB's: their walls are their bounds). The front (local +z)
 * is on the visitors' path.
 */
export function zooBarrier(parts: Parts, e: ZooEnclosure) {
    const s: Box = e.slot.at;
    const k = corners(s);
    // corners(): k[0] (-w/2, -d/2), k[1] (+w/2, -d/2), k[2] (+w/2, +d/2), k[3] (-w/2, +d/2) in the box's frame.
    const front: [Pt, Pt] = [k[3], k[2]];
    const others: Array<[Pt, Pt]> = [[k[2], k[1]], [k[1], k[0]], [k[0], k[3]]];
    const middle = {x: s.x, z: s.z};
    const inwardOf = (a: Pt, b: Pt) => {
        const m = {x: (a.x + b.x) / 2, z: (a.z + b.z) / 2};
        const l = Math.hypot(middle.x - m.x, middle.z - m.z) || 1;
        return {x: (middle.x - m.x) / l, z: (middle.z - m.z) / l};
    };
    const seed = e.slot.seed;
    const signAt = (lx: number) => {
        const c = Math.cos(s.rot);
        const sn = Math.sin(s.rot);
        const lz = s.d / 2 + 1.2;
        return {x: s.x + lx * c - lz * sn, z: s.z + lx * sn + lz * c};
    };
    switch (e.type) {
        case "big_cats":
            glazing(parts, front[0], front[1], 0.5, 3.0, STEEL_GREEN);
            meshFence(parts, front[0], front[1], 3.0, 4.5, inwardOf(front[0], front[1]), 1.4, STEEL_GREEN, false);
            for (const [a, b] of others) meshFence(parts, a, b, 0, 4.5, inwardOf(a, b), 1.4);
            sign(parts.solid, signAt(-s.w / 2 + 2), s.rot, tone("#c8862a"));
            break;
        case "bears_wolves":
            glazing(parts, front[0], front[1], 0.6, 2.6, STEEL_GREEN);
            for (const [a, b] of others) {
                rockwork(parts.solid, a, b, 1.8, hashText(`${seed}:${a.x.toFixed(1)}`));
                meshFence(parts, a, b, 1.6, 3.2, inwardOf(a, b), 0.8);
                // Hot wires on stand-offs, a hand inside the mesh.
                const i = inwardOf(a, b);
                for (const y of [2.1, 2.7]) rail(parts.solid, {x: a.x + i.x * 0.2, z: a.z + i.z * 0.2}, {x: b.x + i.x * 0.2, z: b.z + i.z * 0.2}, y, 0.02, 0.02, CABLE);
            }
            sign(parts.solid, signAt(-s.w / 2 + 2), s.rot, tone("#6a5a3a"));
            break;
        case "savanna_paddocks": {
            // The path side: a dry-stone wall, a low rail on it; elsewhere timber posts and tensioned cables.
            wall(parts.solid, front[0], front[1], 1.1, 0.6, shade(STONE, 0.95));
            posts(parts.solid, front[0], front[1], 3, 1.6, 0.14, TIMBER);
            rail(parts.solid, front[0], front[1], 1.5, 0.1, 0.1, TIMBER);
            for (const [a, b] of others) {
                posts(parts.solid, a, b, 3, 2.4, 0.16, TIMBER);
                rail(parts.solid, a, b, 2.3, 0.12, 0.14, TIMBER);
                for (const y of [0.9, 1.35, 1.8]) rail(parts.solid, a, b, y, 0.025, 0.025, CABLE);
                panel(parts.net, a, b, 0, 0.8, NET_MESH, MESH);
            }
            sign(parts.solid, signAt(-s.w / 2 + 3), s.rot, tone("#b8862e"));
            break;
        }
        case "hoofstock_paddocks":
        case "childrens_farm": {
            const tall = e.type === "childrens_farm" ? 1.15 : 1.6;
            const rails = e.type === "childrens_farm" ? 3 : 4;
            for (const [a, b] of [front, ...others]) {
                posts(parts.solid, a, b, 2.4, tall, 0.14, TIMBER);
                for (let i = 0; i < rails; i++) rail(parts.solid, a, b, 0.3 + (i * (tall - 0.4)) / (rails - 1), 0.05, 0.11, shade(TIMBER, 1.1));
                panel(parts.net, a, b, 0, tall * 0.55, NET_MESH, MESH);
            }
            sign(parts.solid, signAt(-s.w / 2 + 2), s.rot, tone(e.type === "childrens_farm" ? "#3a7a4a" : "#5a6a3a"));
            break;
        }
        case "small_mammals":
            for (const [a, b] of [front, ...others]) {
                wall(parts.solid, a, b, 0.6, 0.3, BRICK);
                glazing(parts, a, b, 0.6, 1.5, STEEL_GREEN);
                // The inward lip on top of the glass.
                const i = inwardOf(a, b);
                rail(parts.solid, {x: a.x + i.x * 0.15, z: a.z + i.z * 0.15}, {x: b.x + i.x * 0.15, z: b.z + i.z * 0.15}, 1.5, 0.3, 0.04, STEEL_GREEN);
            }
            sign(parts.solid, signAt(-s.w / 2 + 1.5), s.rot, tone("#8a6a3a"));
            break;
        case "penguin_seal_pools":
            glazing(parts, front[0], front[1], 0.25, 1.25, STEEL_GREEN);
            for (const [a, b] of others) rockwork(parts.solid, a, b, 1.9, hashText(`${seed}:${a.x.toFixed(1)}`));
            sign(parts.solid, signAt(-s.w / 2 + 2), s.rot, tone("#2f6a8a"));
            break;
        default:
            if (e.type === "aviaries") aviary(parts, s, seed, signAt(-s.w / 2 + 2));
    }
}

/** An aviary: green steel posts, a ring beam, an arched roof frame, fine netting on the walls and roof. */
function aviary(parts: Parts, s: Box, seed: number, signPoint: Pt) {
    const height = 6.5;
    const rise = 1.8;
    const k = corners(s);
    const f: Frame = {x: s.x, y: H(s.x, s.z), z: s.z, rot: s.rot};
    for (const [a, b] of [[k[3], k[2]], [k[2], k[1]], [k[1], k[0]], [k[0], k[3]]] as Array<[Pt, Pt]>) {
        posts(parts.solid, a, b, 3.2, height, 0.14, STEEL_GREEN);
        rail(parts.solid, a, b, height - 0.08, 0.12, 0.12, STEEL_GREEN);
        rail(parts.solid, a, b, 0.05, 0.1, 0.1, STEEL_GREEN);
        panel(parts.net, a, b, 0, height, NET_FINE, NETTING);
    }
    // The arched roof: ribs across the short side every 3 m, the netting over them, the gable ends netted.
    const n = 8;
    const arch = (u: number) => height + Math.sin(Math.PI * u) * rise;
    const ribs = Math.max(2, Math.round(s.w / 3));
    for (let i = 0; i <= ribs; i++) {
        const lx = -s.w / 2 + (s.w * i) / ribs;
        for (let j = 0; j < n; j++) {
            const z0 = -s.d / 2 + (s.d * j) / n;
            const z1 = -s.d / 2 + (s.d * (j + 1)) / n;
            const p0 = at(f, lx, arch(j / n), z0);
            const p1 = at(f, lx, arch((j + 1) / n), z1);
            parts.solid.box({x: (p0[0] + p1[0]) / 2, y: (p0[1] + p1[1]) / 2 - 0.05, z: (p0[2] + p1[2]) / 2, rot: s.rot}, 0, 0, 0, 0.09, 0.1, s.d / n + 0.05, STEEL_GREEN);
        }
    }
    parts.net.tag = NET_FINE;
    for (let j = 0; j < n; j++) {
        const z0 = -s.d / 2 + (s.d * j) / n;
        const z1 = -s.d / 2 + (s.d * (j + 1)) / n;
        const a0: V3 = at(f, -s.w / 2, arch(j / n), z0);
        const b0: V3 = at(f, s.w / 2, arch(j / n), z0);
        const a1: V3 = at(f, -s.w / 2, arch((j + 1) / n), z1);
        const b1: V3 = at(f, s.w / 2, arch((j + 1) / n), z1);
        parts.net.quad(a0, b0, b1, a1, NETTING);
        // The gable ends under the arch.
        for (const lx of [-s.w / 2, s.w / 2]) parts.net.quad(at(f, lx, height, z0), at(f, lx, height, z1), at(f, lx, arch((j + 1) / n), z1), at(f, lx, arch(j / n), z0), NETTING);
    }
    parts.net.tag = 0;
    // The keepers' double-door porch on one side, and the sign.
    const porch = at(f, s.w / 2 - 2.2, 0, s.d / 2 + 0.9);
    const pf: Frame = {x: porch[0], y: porch[1], z: porch[2], rot: s.rot};
    for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]] as const) parts.solid.box(pf, lx, 0, lz, 0.1, 2.4, 0.1, STEEL_GREEN);
    parts.solid.box(pf, 0, 2.4, 0, 1.9, 0.08, 1.9, STEEL_GREEN);
    for (const [a, b] of [[at(pf, -0.9, 0, 0.9), at(pf, 0.9, 0, 0.9)], [at(pf, 0.9, 0, 0.9), at(pf, 0.9, 0, -0.9)], [at(pf, -0.9, 0, -0.9), at(pf, -0.9, 0, 0.9)]]) panel(parts.net, {x: a[0], z: a[2]}, {x: b[0], z: b[2]}, 0, 2.4, NET_FINE, NETTING);
    void seed;
    sign(parts.solid, signPoint, s.rot, tone("#4a7a3a"));
}
