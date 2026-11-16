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
        // (p2, town2: the island's weathered boulder, worn round and shaded smooth (`kit.ts` rock, 80 faces as the
        // blob was), not a faceted ball; set 15 cm into the ground, its top where the ball's was.)
        const mid = height * (0.3 + r() * 0.3);
        const sx = 0.6 + r() * 0.35;
        const sy = height * (0.3 + r() * 0.2);
        const sz = 0.55 + r() * 0.3;
        const tone = shade(ROCK, 0.82 + r() * 0.3);
        const id = hashText(`${seed}:${t.toFixed(1)}`);
        solid.rock(p[0], p[1] - 0.15, p[2], sx, mid + sy * 0.75 + 0.15, sz, (id % 628) / 100, tone, id, 1);
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

/**
 * A square steel tube from `a` to `b` (`size` across), any pitch: a member of a frame that follows a curve (an aviary's
 * arch rib, a purlin between two ribs, a brace). Four faces, no caps (its ends meet other members).
 */
export function strut(geo: Geo, a: V3, b: V3, size: number, colour: RGB) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const l = Math.hypot(dx, dy, dz);
    if (l < 1e-4) return;
    const ux = dx / l;
    const uy = dy / l;
    const uz = dz / l;
    // A side vector across the member (level), and the member's own up.
    let sx = -uz;
    let sz = ux;
    let sy = 0;
    const sl = Math.hypot(sx, sz);
    if (sl < 1e-4) {
        sx = 1;
        sz = 0;
    } else {
        sx /= sl;
        sz /= sl;
    }
    const vx = sy * uz - sz * uy;
    const vy = sz * ux - sx * uz;
    const vz = sx * uy - sy * ux;
    const h = size / 2;
    const ring = (p: V3): V3[] => [
        [p[0] + (sx + vx) * h, p[1] + (sy + vy) * h, p[2] + (sz + vz) * h],
        [p[0] + (-sx + vx) * h, p[1] + (-sy + vy) * h, p[2] + (-sz + vz) * h],
        [p[0] + (-sx - vx) * h, p[1] + (-sy - vy) * h, p[2] + (-sz - vz) * h],
        [p[0] + (sx - vx) * h, p[1] + (sy - vy) * h, p[2] + (sz - vz) * h]
    ];
    const r0 = ring(a);
    const r1 = ring(b);
    for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const k = i === 0 ? 1.06 : i === 2 ? 0.78 : 0.9;
        geo.quad(r0[i], r0[j], r1[j], r1[i], [colour[0] * k, colour[1] * k, colour[2] * k]);
    }
}

/** The aviary's frame, its shape for the checks (`ark-zoo-aviary.test.ts`): wall height, the roof's rise, bay spacing. */
export const AVIARY = {height: 6.5, rise: 1.8, bay: 2.9, segments: 12} as const;

/**
 * The aviary's frame as points (pure, for the drawing and the tests). A barrel-vaulted flight aviary as zoos build
 * them: green steel posts on every side at one bay spacing, a ring beam on their tops, arched ribs across the SHORT
 * span springing from the post tops of the long sides (one rib per post pair, so every rib lands on a post), purlins
 * along the vault joining the ribs, the netting on the walls and laid on the vault exactly over the ribs.
 *
 * (The owner, 2026-11-16: "the aviary roof needs fixing looks like random bars". The old roof's ribs were level boxes
 * stepped along the arch, eight separate dashes per rib with gaps between, running down the long side at their own
 * 3 m spacing that matched no post, and floating at the plot's middle ground height while the posts followed the
 * ground: from above a field of loose bars.)
 */
export function aviaryFrame(s: Box) {
    const {height, rise, bay, segments} = AVIARY;
    // Span across the short side; stations along the long side.
    const spanX = s.w <= s.d;
    const span = spanX ? s.w : s.d;
    const long = spanX ? s.d : s.w;
    const f: Frame = {x: s.x, y: 0, z: s.z, rot: s.rot};
    const ground = (u: number, v: number): V3 => {
        const p = spanX ? at(f, u, 0, v) : at(f, v, 0, u);
        return [p[0], H(p[0], p[2]), p[2]];
    };
    const lift = (p: V3, y: number): V3 => [p[0], p[1] + y, p[2]];
    const bays = Math.max(2, Math.round(long / bay));
    const spanBays = Math.max(2, Math.round(span / bay));
    const stations = Array.from({length: bays + 1}, (_, j) => -long / 2 + (long * j) / bays);
    // Each rib: from the left post's top to the right one's, the arch's rise over the straight line between them.
    const ribs = stations.map((v) => {
        const left = lift(ground(-span / 2, v), height);
        const right = lift(ground(span / 2, v), height);
        return Array.from({length: segments + 1}, (_, i) => {
            const t = i / segments;
            const p = spanX ? at(f, -span / 2 + span * t, 0, v) : at(f, v, 0, -span / 2 + span * t);
            return [p[0], left[1] + (right[1] - left[1]) * t + Math.sin(Math.PI * t) * rise, p[2]] as V3;
        });
    });
    // The posts round the walls: the long sides' at the stations, the short sides' at their own bays.
    const longSide = (u: number) => stations.map((v) => ground(u, v));
    const shortSide = (v: number) => Array.from({length: spanBays + 1}, (_, i) => ground(-span / 2 + (span * i) / spanBays, v));
    // The walls as closed runs of post feet (in order round the plot).
    const walls: V3[][] = [longSide(-span / 2), longSide(span / 2), shortSide(-long / 2), shortSide(long / 2)];
    return {spanX, span, long, ribs, walls, stations, top: (p: V3) => lift(p, height)};
}

/**
 * An aviary: a barrel-vaulted steel frame (`aviaryFrame`), fine stainless netting on the walls and over the vault, a
 * low plinth round the foot, the keepers' netted double-door porch, the sign.
 */
function aviary(parts: Parts, s: Box, seed: number, signPoint: Pt) {
    const frame = aviaryFrame(s);
    const {ribs, walls} = frame;
    const n = AVIARY.segments;
    const post = 0.14;
    // The walls: a post at every foot, the ring beam and a mid rail between their tops, a plinth, the netting per bay.
    for (const feet of walls) {
        for (let k = 0; k < feet.length; k++) {
            const g = feet[k];
            strut(parts.solid, [g[0], g[1] - 0.2, g[2]], frame.top(g), post, STEEL_GREEN);
            if (k === 0) continue;
            const a = feet[k - 1];
            const ta = frame.top(a);
            const tb = frame.top(g);
            strut(parts.solid, [ta[0], ta[1] - 0.06, ta[2]], [tb[0], tb[1] - 0.06, tb[2]], 0.13, STEEL_GREEN);
            strut(parts.solid, [a[0], a[1] + 2.4, a[2]], [g[0], g[1] + 2.4, g[2]], 0.07, STEEL_GREEN);
            // The plinth: a low concrete kerb the netting is clamped to.
            strut(parts.solid, [a[0], a[1] + 0.05, a[2]], [g[0], g[1] + 0.05, g[2]], 0.22, COPING);
            parts.net.tag = NET_FINE;
            parts.net.quad([a[0], a[1] - 0.1, a[2]], [g[0], g[1] - 0.1, g[2]], tb, ta, NETTING);
            parts.net.tag = 0;
        }
    }
    // The vault: each rib a run of tubes on the arch, purlins along it at the quarter points and the crown.
    for (const rib of ribs) for (let i = 0; i < n; i++) strut(parts.solid, rib[i], rib[i + 1], 0.12, STEEL_GREEN);
    const purlins = [Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4)];
    for (let j = 1; j < ribs.length; j++) for (const i of purlins) strut(parts.solid, ribs[j - 1][i], ribs[j][i], 0.08, STEEL_GREEN);
    // The netting laid over the vault (on the ribs, a hair above them) and the two gable ends under the end ribs.
    parts.net.tag = NET_FINE;
    const up = (p: V3): V3 => [p[0], p[1] + 0.07, p[2]];
    for (let j = 1; j < ribs.length; j++) for (let i = 0; i < n; i++) parts.net.quad(up(ribs[j - 1][i]), up(ribs[j - 1][i + 1]), up(ribs[j][i + 1]), up(ribs[j][i]), NETTING);
    for (const rib of [ribs[0], ribs[ribs.length - 1]]) {
        const a = rib[0];
        const b = rib[n];
        for (let i = 0; i < n; i++) {
            const t0 = i / n;
            const t1 = (i + 1) / n;
            const e0: V3 = [rib[i][0], a[1] + (b[1] - a[1]) * t0, rib[i][2]];
            const e1: V3 = [rib[i + 1][0], a[1] + (b[1] - a[1]) * t1, rib[i + 1][2]];
            // (The first and last pieces are triangles: their eave point is the rib's foot. No zero-area triangle.)
            if (i < n - 1) parts.net.tri(e0, e1, rib[i + 1], NETTING);
            if (i > 0) parts.net.tri(e0, rib[i + 1], rib[i], NETTING);
        }
    }
    parts.net.tag = 0;
    // The keepers' double-door porch on the front, its own small netted frame with a netted top.
    const f: Frame = {x: s.x, y: 0, z: s.z, rot: s.rot};
    const pc = at(f, s.w / 2 - 2.2, 0, s.d / 2 + 0.95);
    const pf: Frame = {x: pc[0], y: 0, z: pc[2], rot: s.rot};
    const foot = (lx: number, lz: number): V3 => {
        const p = at(pf, lx, 0, lz);
        return [p[0], H(p[0], p[2]), p[2]];
    };
    const ring = [foot(-0.9, -0.95), foot(0.9, -0.95), foot(0.9, 0.95), foot(-0.9, 0.95)];
    const roofY = Math.max(...ring.map((p) => p[1])) + 2.4;
    const topOf = (p: V3): V3 => [p[0], roofY, p[2]];
    for (const g of ring) strut(parts.solid, [g[0], g[1] - 0.2, g[2]], topOf(g), 0.1, STEEL_GREEN);
    for (let i = 0; i < 4; i++) strut(parts.solid, topOf(ring[i]), topOf(ring[(i + 1) % 4]), 0.09, STEEL_GREEN);
    parts.net.tag = NET_FINE;
    for (const [i, j] of [[1, 2], [2, 3], [3, 0]] as const) parts.net.quad([ring[i][0], ring[i][1] - 0.1, ring[i][2]], [ring[j][0], ring[j][1] - 0.1, ring[j][2]], topOf(ring[j]), topOf(ring[i]), NETTING);
    parts.net.quad(topOf(ring[0]), topOf(ring[1]), topOf(ring[2]), topOf(ring[3]), NETTING);
    parts.net.tag = 0;
    // The door in the porch's front: a frame and a kick plate.
    const d0 = foot(-0.45, 0.95);
    const d1 = foot(0.45, 0.95);
    strut(parts.solid, [d0[0], d0[1], d0[2]], [d0[0], roofY - 0.25, d0[2]], 0.06, STEEL_GREEN);
    strut(parts.solid, [d1[0], d1[1], d1[2]], [d1[0], roofY - 0.25, d1[2]], 0.06, STEEL_GREEN);
    strut(parts.solid, [d0[0], roofY - 0.25, d0[2]], [d1[0], roofY - 0.25, d1[2]], 0.06, STEEL_GREEN);
    strut(parts.solid, [d0[0], d0[1] + 0.25, d0[2]], [d1[0], d1[1] + 0.25, d1[2]], 0.4, STEEL_GREEN);
    void seed;
    sign(parts.solid, signPoint, s.rot, tone("#4a7a3a"));
}
