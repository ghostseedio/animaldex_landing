/**
 * The zoo enclosures' habitats (graphics pass 2, lane ZOO; the owner, 2026-11-16: "the gorilla enclosure looks
 * unbelievably basic - check the other enclosures too"). Each enclosure is dressed as a modern zoo builds its exhibit:
 * rounded rockwork with ledges, climbing frames of logs and ropes, a pool, shelters, varied ground (grass, bark, sand,
 * leaf litter) and planting, themed by what the enclosure holds (forest for the great apes, desert rock for the
 * reptiles, night forest, savanna kopje for the big cats, grassland and waterhole for the savanna, meadow for the
 * hoofstock).
 *
 * The rule that keeps the residents right: nothing that stands on the ground (a rock, a post, a pool, a plant taller
 * than a tuft) is put within reach of a resident's spot (`zooSpotsOf`: where each resident is placed; an indoor one is
 * held there), so no animal stands inside a rock or a climbing frame's post. Things over a standing gorilla's head (the
 * frame's beams and decks, a hammock) may pass over a spot. `ark-zoo-habitat.test.ts` checks it on every open enclosure.
 *
 * Everything goes into the meshes the enclosure already draws into (merged, vertex coloured): no new draw calls.
 */

import {hashText, rng, toLocal, type Box, type Pt} from "@/ark-scene/islands/town/geom";
import {at, Geo, tone, type Frame, type V3} from "@/ark-scene/islands/town/render/kit";
import {strut} from "@/ark-scene/islands/town/render/zoo-barriers";
import {dressSafari} from "@/ark-scene/islands/town/render/safari-habitat";
import type {SafariHabitat} from "@/ark-scene/islands/town/safari";
import type {ZooAnnexTheme} from "@/ark-scene/islands/town/zoo-homes";
import {wetlandLagoon} from "@/ark-scene/islands/town/areas";
import {DOME, DOME_CLIFF, DOME_FEEDERS, DOME_LAGOON, DOME_SNAGS, DOME_TREES, domePerches, lagoonNorm, onCliff, onDomeWay} from "@/ark-scene/islands/town/dome";

type RGB = [number, number, number];

/**
 * How far a ground item keeps from a resident's spot, past its own radius (m): a gorilla's half length and a step. A
 * hall of small residents (reptiles, insects, the nocturnal house's) passes its own, smaller.
 */
export const HABITAT_CLEARANCE = 1.0;
/** Over this height (m above the floor) a beam, deck or rope may pass over a resident's spot. */
export const HABITAT_HEADROOM = 2.9;

/** One ground item's footprint, for the clearance check (local x, z of the hall or plot, radius). */
export type Footprint = {x: number; z: number; r: number; what: string};

/**
 * p3 (solid): a solid thing as drawn, in the world frame (the town's), for the colliders (`islands/town/solids.ts`):
 * each rock of an outcrop or a pool's rim, a log's axis, a post, a climbing tree's trunk, a shelter's or a rack's box,
 * a mound. `base` and `top`: its foot and its top (m).
 */
export type PlotSolid =
    | {kind: "rock" | "log" | "post" | "trunk" | "mound" | "pond" | "hay" | "trough" | "shelter"; shape: "circle"; x: number; z: number; r: number; base: number; top: number}
    | {kind: "rock" | "log" | "post" | "trunk" | "mound" | "pond" | "hay" | "trough" | "shelter"; shape: "box"; x: number; z: number; hw: number; hd: number; rot: number; base: number; top: number}
    | {kind: "rock" | "log" | "post" | "trunk" | "mound" | "pond" | "hay" | "trough" | "shelter"; shape: "segment"; ax: number; az: number; bx: number; bz: number; r: number; base: number; top: number};

/**
 * A plot to dress: its box (local +z is its front, toward the visitors), the floor's height at a local point, and the
 * residents' spots in its local frame. Every ground item asks `free` first and records its footprint.
 */
export class Plot {
    readonly spots: Pt[];
    readonly footprints: Footprint[] = [];
    /** p3 (solid): what it drew that a body cannot pass through (`PlotSolid`). */
    readonly solids: PlotSolid[] = [];
    readonly fr: Frame;
    constructor(readonly box: Box, readonly floorAt: (lx: number, lz: number) => number, worldSpots: readonly Pt[], readonly seed: number, readonly clearance = HABITAT_CLEARANCE) {
        this.spots = worldSpots.map((p) => toLocal(box, p.x, p.z));
        this.fr = {x: box.x, y: 0, z: box.z, rot: box.rot};
    }
    /** Whether a ground item of radius `r` at (lx, lz) is clear of every spot and inside the plot. */
    free(lx: number, lz: number, r: number, edge = 0.3): boolean {
        // (`edge` may be negative: rockwork set into a wall.)
        if (Math.abs(lx) > this.box.w / 2 - r - edge || Math.abs(lz) > this.box.d / 2 - r - edge) return false;
        return this.spots.every((s) => Math.hypot(s.x - lx, s.z - lz) >= r + this.clearance);
    }
    /** Takes a footprint if it is free (and returns whether it was). */
    take(lx: number, lz: number, r: number, what: string, edge = 0.3): boolean {
        if (!this.free(lx, lz, r, edge)) return false;
        this.footprints.push({x: lx, z: lz, r, what});
        return true;
    }
    /** A world point at a local one, `ly` over the floor there. */
    p(lx: number, lz: number, ly = 0): V3 {
        const q = at(this.fr, lx, 0, lz);
        return [q[0], this.floorAt(lx, lz) + ly, q[2]];
    }
    /** The first free place for an item of radius `r` among `tries` jittered candidates near (lx, lz). */
    near(lx: number, lz: number, r: number, what: string, spread = 1.5, tries = 14, edge = 0.3): Pt | null {
        const q = rng(hashText(`${this.seed}:${what}:${lx.toFixed(2)}:${lz.toFixed(2)}`));
        for (let i = 0; i < tries; i++) {
            const k = i === 0 ? 0 : spread * (0.4 + (i / tries) * 1.2);
            const a = q() * Math.PI * 2;
            const x = lx + Math.cos(a) * k;
            const z = lz + Math.sin(a) * k;
            if (this.take(x, z, r, what, edge)) return {x, z};
        }
        return null;
    }
}

/** A triangle seen from both sides (a leaf, a blade of grass: the interior material draws front faces only). */
function both(geo: Geo, a: V3, b: V3, c: V3, colour: RGB) {
    geo.tri(a, b, c, colour);
    geo.tri(a, c, b, colour);
}

const BARK = tone("#5e4632");
const LOG = tone("#6f5236");
const ROPE = tone("#c8b58a");

/** Rockwork: a rounded outcrop of 3 to 5 boulders set into each other and into the ground, the biggest in the middle. */
export function outcrop(geo: Geo, plot: Plot, lx: number, lz: number, size: number, colour: RGB, seed: number) {
    const r = rng(seed);
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
        const big = i === 0;
        const a = r() * Math.PI * 2;
        const off = big ? 0 : size * (0.45 + r() * 0.35);
        const x = lx + Math.cos(a) * off;
        const z = lz + Math.sin(a) * off;
        const s = size * (big ? 1 : 0.45 + r() * 0.3);
        const p = plot.p(x, z, 0);
        const k = 0.9 + r() * 0.2;
        const sx = s * (0.9 + r() * 0.3);
        const sy = s * (big ? 0.75 + r() * 0.3 : 0.55 + r() * 0.3);
        const sz = s * (0.85 + r() * 0.3);
        const turn = r() * 6.28;
        geo.rock(p[0], p[1] - s * 0.18, p[2], sx, sy, sz, turn, [colour[0] * k, colour[1] * k, colour[2] * k], hashText(`${seed}:${i}`));
        plot.solids.push({kind: "rock", shape: "box", x: p[0], z: p[2], hw: sx * 0.85, hd: sz * 0.85, rot: turn, base: p[1] - s * 0.18, top: p[1] - s * 0.18 + sy});
    }
}

/** A flat-topped basking ledge: a wide low boulder. */
export function ledge(geo: Geo, plot: Plot, lx: number, lz: number, size: number, colour: RGB, seed: number) {
    const p = plot.p(lx, lz, 0);
    geo.rock(p[0], p[1] - size * 0.1, p[2], size * 1.3, size * 0.38, size, (seed % 628) / 100, colour, seed);
    plot.solids.push({kind: "rock", shape: "box", x: p[0], z: p[2], hw: size * 1.3 * 0.85, hd: size * 0.85, rot: (seed % 628) / 100, base: p[1] - size * 0.1, top: p[1] + size * 0.28});
}

/** An irregular flat patch of ground cover (grass, bark, sand, leaf litter) `lift` over the floor. */
export function patch(geo: Geo, plot: Plot, lx: number, lz: number, radius: number, colour: RGB, seed: number, lift = 0.012) {
    const r = rng(seed);
    const n = 14;
    const radii = Array.from({length: n}, () => radius * (0.7 + r() * 0.45));
    const centre = plot.p(lx, lz, lift);
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        const x0 = lx + Math.cos(a0) * radii[i];
        const z0 = lz + Math.sin(a0) * radii[i];
        const x1 = lx + Math.cos(a1) * radii[(i + 1) % n];
        const z1 = lz + Math.sin(a1) * radii[(i + 1) % n];
        const k = 0.94 + r() * 0.1;
        both(geo, centre, plot.p(x1, z1, lift), plot.p(x0, z0, lift), [colour[0] * k, colour[1] * k, colour[2] * k]);
    }
}

/** A clump of grass: thin blades fanned out from a point. */
export function tuft(geo: Geo, plot: Plot, lx: number, lz: number, height: number, colour: RGB, seed: number, blades = 7) {
    const r = rng(seed);
    const base = plot.p(lx, lz, 0);
    for (let i = 0; i < blades; i++) {
        const a = r() * Math.PI * 2;
        const lean = 0.15 + r() * 0.35;
        const h = height * (0.6 + r() * 0.5);
        const w = 0.035 + r() * 0.03;
        const cx = Math.cos(a + Math.PI / 2) * w;
        const cz = Math.sin(a + Math.PI / 2) * w;
        const tip: V3 = [base[0] + Math.cos(a) * h * lean, base[1] + h, base[2] + Math.sin(a) * h * lean];
        const k = 0.85 + r() * 0.3;
        both(geo, [base[0] - cx, base[1], base[2] - cz], [base[0] + cx, base[1], base[2] + cz], tip, [colour[0] * k, colour[1] * k, colour[2] * k]);
    }
}

/** A broad-leaved plant (a fern, a ginger, a young banana): long leaves arching out of a crown. */
export function fern(geo: Geo, plot: Plot, lx: number, lz: number, size: number, colour: RGB, seed: number, leaves = 9, stem = 0) {
    const r = rng(seed);
    const base = plot.p(lx, lz, 0);
    if (stem > 0) geo.cylinder({x: base[0], y: base[1], z: base[2], rot: 0}, 0, 0, 0, 0.09, 0.07, stem, tone("#6a7a3a"), 6);
    const top = base[1] + stem;
    for (let i = 0; i < leaves; i++) {
        const a = (i / leaves) * Math.PI * 2 + r() * 0.5;
        const len = size * (0.7 + r() * 0.5);
        const width = len * 0.11;
        const ux = Math.cos(a);
        const uz = Math.sin(a);
        const px = -uz * width;
        const pz = ux * width;
        // Two segments: up and out, then out and down (an arching leaf).
        const p0: V3 = [base[0], top + 0.05, base[2]];
        const p1: V3 = [base[0] + ux * len * 0.5, top + len * (0.45 + r() * 0.2), base[2] + uz * len * 0.5];
        const p2: V3 = [base[0] + ux * len, top + len * (0.2 + r() * 0.15), base[2] + uz * len];
        const k = 0.8 + r() * 0.35;
        const c: RGB = [colour[0] * k, colour[1] * k, colour[2] * k];
        // (Two triangles a leaf, each seen from both sides; never a degenerate one: a zero normal shades NaN.)
        const left: V3 = [p1[0] - px, p1[1], p1[2] - pz];
        const right: V3 = [p1[0] + px, p1[1], p1[2] + pz];
        both(geo, p0, left, right, c);
        both(geo, left, p2, right, [c[0] * 1.08, c[1] * 1.08, c[2] * 1.08]);
    }
}

/** A rope hanging between two points with a sag (a chain of thin tubes). */
export function rope(geo: Geo, a: V3, b: V3, sag: number, size = 0.05, colour: RGB = ROPE) {
    const n = 6;
    let prev = a;
    for (let i = 1; i <= n; i++) {
        const t = i / n;
        const p: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + (b[2] - a[2]) * t];
        strut(geo, prev, p, size, colour);
        prev = p;
    }
}

/** A log lying on the ground from (lx0, lz0) to (lx1, lz1), its radius `radius`. */
export function log(geo: Geo, plot: Plot, lx0: number, lz0: number, lx1: number, lz1: number, radius: number, colour: RGB = LOG) {
    const a = plot.p(lx0, lz0, radius * 0.85);
    const b = plot.p(lx1, lz1, radius * 0.85);
    plot.solids.push({kind: "log", shape: "segment", ax: a[0], az: a[2], bx: b[0], bz: b[2], r: radius, base: Math.min(a[1], b[1]) - radius, top: Math.max(a[1], b[1]) + radius});
    const sides = 7;
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const l = Math.hypot(dx, dz) || 1;
    const sx = -dz / l;
    const sz = dx / l;
    const ring = (p: V3, k: number) => Array.from({length: sides}, (_, i) => {
        const t = (i / sides) * Math.PI * 2;
        return [p[0] + sx * Math.cos(t) * radius * k, p[1] + Math.sin(t) * radius * k, p[2] + sz * Math.cos(t) * radius * k] as V3;
    });
    const r0 = ring(a, 1);
    const r1 = ring(b, 0.85);
    for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        const k = 0.8 + 0.25 * Math.max(0, Math.sin(((i + 0.5) / sides) * Math.PI * 2));
        geo.quad(r0[j], r0[i], r1[i], r1[j], [colour[0] * k, colour[1] * k, colour[2] * k]);
    }
    // The cut ends, paler.
    const end = tone("#b89a6a");
    for (let i = 1; i < sides - 1; i++) {
        geo.tri(r0[0], r0[i], r0[i + 1], end);
        geo.tri(r1[0], r1[i + 1], r1[i], end);
    }
}

/** A climbing log standing at a point, `height` tall, leaning a little (a stripped trunk). */
export function pole(geo: Geo, plot: Plot, lx: number, lz: number, height: number, radius: number, seed: number) {
    const r = rng(seed);
    const p = plot.p(lx, lz, -0.1);
    const lean = 0.1 + r() * 0.15;
    const a = r() * 6.28;
    strut(geo, p, [p[0] + Math.cos(a) * lean, p[1] + height, p[2] + Math.sin(a) * lean], radius * 2, BARK);
    plot.solids.push({kind: "post", shape: "circle", x: p[0], z: p[2], r: radius + 0.04, base: p[1], top: p[1] + height});
    return [p[0] + Math.cos(a) * lean, p[1] + height, p[2] + Math.sin(a) * lean] as V3;
}

/** A dead tree for climbing and perching: a trunk and a few climbing limbs. */
export function climbingTree(geo: Geo, plot: Plot, lx: number, lz: number, height: number, seed: number) {
    const r = rng(seed);
    const base = plot.p(lx, lz, -0.1);
    const top: V3 = [base[0] + (r() - 0.5) * 0.4, base[1] + height, base[2] + (r() - 0.5) * 0.4];
    strut(geo, base, [base[0], base[1] + height * 0.5, base[2]], 0.5, BARK);
    // (Its trunk and the root flares round its foot: 0.75 m out, low.)
    plot.solids.push({kind: "trunk", shape: "circle", x: base[0], z: base[2], r: 0.45, base: base[1], top: base[1] + height});
    strut(geo, [base[0], base[1] + height * 0.45, base[2]], top, 0.34, BARK);
    // Root flares.
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + r();
        strut(geo, [base[0], base[1] + 0.6, base[2]], [base[0] + Math.cos(a) * 0.75, base[1] + 0.05, base[2] + Math.sin(a) * 0.75], 0.22, BARK);
    }
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + r() * 0.8;
        const y = height * (0.45 + i * 0.13);
        const from: V3 = [base[0], base[1] + y, base[2]];
        const reach = height * (0.32 - i * 0.04);
        strut(geo, from, [from[0] + Math.cos(a) * reach, from[1] + reach * 0.6, from[2] + Math.sin(a) * reach], 0.18 - i * 0.025, BARK);
    }
}

/** A deck (a platform on posts or on a frame), `size` square, at `y` over the floor. */
export function deck(geo: Geo, plot: Plot, lx: number, lz: number, w: number, d: number, y: number, turn = 0) {
    const fr: Frame = {x: 0, y: 0, z: 0, rot: plot.fr.rot + turn};
    const p = plot.p(lx, lz, y);
    fr.x = p[0];
    fr.y = p[1];
    fr.z = p[2];
    const planks = Math.max(3, Math.round(w / 0.25));
    for (let i = 0; i < planks; i++) geo.box(fr, -w / 2 + (w * (i + 0.5)) / planks, 0, 0, (w / planks) * 0.9, 0.08, d, tone(i % 2 ? "#8a6a48" : "#7d5f40"));
}

/**
 * A climbing frame of logs and ropes along a line of posts (local points): each post a stripped log, beams at two
 * heights between neighbours, a deck between some, ropes hanging and swagged between the beams. Posts that would stand
 * on a resident's spot are dropped; the beams run only between posts that stand.
 */
export function climbingFrame(geo: Geo, plot: Plot, posts: Pt[], height: number, seed: number) {
    const r = rng(seed);
    const stood: Array<{top: V3; at: Pt} | null> = posts.map((q, i) => (plot.take(q.x, q.z, 0.3, "post") ? {at: q, top: pole(geo, plot, q.x, q.z, height, 0.14, hashText(`${seed}p${i}`))} : null));
    const lower = height * 0.55;
    for (let i = 1; i < stood.length; i++) {
        const a = stood[i - 1];
        const b = stood[i];
        if (!a || !b) continue;
        const a1 = plot.p(a.at.x, a.at.z, lower);
        const b1 = plot.p(b.at.x, b.at.z, lower);
        strut(geo, a1, b1, 0.2, LOG);
        strut(geo, [a.top[0], a.top[1] - 0.3, a.top[2]], [b.top[0], b.top[1] - 0.3, b.top[2]], 0.18, LOG);
        // A diagonal log, a rope swag on the high beam, ropes hanging from it.
        strut(geo, a1, [b.top[0], b.top[1] - 0.3, b.top[2]], 0.14, BARK);
        rope(geo, [a.top[0], a.top[1] - 0.4, a.top[2]], [b.top[0], b.top[1] - 0.4, b.top[2]], 0.9, 0.06);
        for (let k = 1; k <= 2; k++) {
            const t = k / 3;
            const hang: V3 = [a.top[0] + (b.top[0] - a.top[0]) * t, a.top[1] - 0.3 + (b.top[1] - a.top[1]) * t, a.top[2] + (b.top[2] - a.top[2]) * t];
            const lo = HABITAT_HEADROOM - 0.3 + r() * 0.8;
            const floor = plot.floorAt(a.at.x + (b.at.x - a.at.x) * t, a.at.z + (b.at.z - a.at.z) * t);
            strut(geo, hang, [hang[0] + (r() - 0.5) * 0.2, floor + lo, hang[2] + (r() - 0.5) * 0.2], 0.05, ROPE);
        }
        if (i % 2 === 1) {
            // A deck on the lower beams, between the two posts and a hand deep.
            const mx = (a.at.x + b.at.x) / 2;
            const mz = (a.at.z + b.at.z) / 2;
            const turn = Math.atan2(-(b.at.z - a.at.z), b.at.x - a.at.x);
            deck(geo, plot, mx, mz, Math.hypot(b.at.x - a.at.x, b.at.z - a.at.z) * 0.9, 1.6, lower + 0.1, turn);
        }
    }
}

/** A pool: its water (a flat irregular disc into `water`) a little under a rim of rounded stones. */
export function pool(geo: Geo, water: Geo, plot: Plot, lx: number, lz: number, radius: number, seed: number, rimColour: RGB, waterColour: RGB, level = 0.08) {
    const r = rng(seed);
    const n = 16;
    const radii = Array.from({length: n}, () => radius * (0.8 + r() * 0.3));
    // (Water and its rim of stones: drunk at from its edge, never walked through.)
    const mid = plot.p(lx, lz, 0);
    plot.solids.push({kind: "pond", shape: "circle", x: mid[0], z: mid[2], r: radius * 1.1 + 0.25, base: mid[1] - 0.5, top: mid[1] + level + 0.35});
    // The bed (dark) just under the water, the water, then the rim stones on its edge.
    const bed = tone("#3a4a40");
    const centre = plot.p(lx, lz, level - 0.05);
    const wc = plot.p(lx, lz, level);
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const a0 = (i / n) * Math.PI * 2;
        const a1 = (j / n) * Math.PI * 2;
        const x0 = lx + Math.cos(a0) * radii[i];
        const z0 = lz + Math.sin(a0) * radii[i];
        const x1 = lx + Math.cos(a1) * radii[j];
        const z1 = lz + Math.sin(a1) * radii[j];
        both(geo, centre, plot.p(x1, z1, level - 0.05), plot.p(x0, z0, level - 0.05), bed);
        water.tri(wc, plot.p(x1, z1, level), plot.p(x0, z0, level), waterColour);
        if (i % 2 === 0) {
            const p = plot.p(x0, z0, 0);
            const s = 0.28 + r() * 0.22;
            geo.rock(p[0], p[1] - s * 0.2, p[2], s * 1.3, s * 0.7, s, r() * 6.28, rimColour, hashText(`${seed}rim${i}`));
        }
    }
}

/** A keepers' shelter (a den): timber walls on three sides, open front, a mono-pitch roof, planted on top for forest themes. */
export function shelter(geo: Geo, plot: Plot, lx: number, lz: number, w: number, d: number, h: number, wall: RGB, roof: RGB, turn = 0, green = false) {
    const p = plot.p(lx, lz, -0.1);
    const fr: Frame = {x: p[0], y: p[1], z: p[2], rot: plot.fr.rot + turn};
    // (Open at the front, but a body stands in its shade at the opening, not inside its walls: the whole box.)
    plot.solids.push({kind: "shelter", shape: "box", x: p[0], z: p[2], hw: w / 2, hd: d / 2, rot: fr.rot, base: p[1], top: p[1] + h});
    geo.box(fr, 0, 0, -d / 2 + 0.08, w, h + 0.1, 0.16, wall);
    for (const sx of [-1, 1]) geo.box(fr, sx * (w / 2 - 0.08), 0, 0, 0.16, h + 0.1, d, wall);
    // The roof: sloping down to the back, overhanging.
    const a = at(fr, -w / 2 - 0.3, h + 0.5, d / 2 + 0.4);
    const b = at(fr, w / 2 + 0.3, h + 0.5, d / 2 + 0.4);
    const c = at(fr, w / 2 + 0.3, h - 0.1, -d / 2 - 0.3);
    const e = at(fr, -w / 2 - 0.3, h - 0.1, -d / 2 - 0.3);
    geo.quad(a, b, c, e, roof);
    geo.quad(e, c, b, a, [roof[0] * 0.7, roof[1] * 0.7, roof[2] * 0.7]);
    if (green) {
        const m = at(fr, 0, h + 0.3, 0);
        geo.bush(m[0], m[1] + 0.15, m[2], w * 0.42, 0.35, d * 0.42, tone("#4f7a3a"), hashText(`${lx}:${lz}:roof`));
    }
}

/** A columnar cactus with an arm or two (the reptile house's desert). */
export function cactus(geo: Geo, plot: Plot, lx: number, lz: number, height: number, seed: number) {
    const r = rng(seed);
    const c = tone("#5a8a4a");
    const base = plot.p(lx, lz, -0.05);
    geo.cylinder({x: base[0], y: base[1], z: base[2], rot: 0}, 0, 0, 0, 0.16, 0.13, height, c, 8);
    plot.solids.push({kind: "post", shape: "circle", x: base[0], z: base[2], r: 0.2, base: base[1], top: base[1] + height});
    for (let i = 0; i < 2; i++) {
        if (r() < 0.3) continue;
        const a = r() * 6.28;
        const y = base[1] + height * (0.35 + r() * 0.25);
        const out: V3 = [base[0] + Math.cos(a) * 0.4, y + 0.1, base[2] + Math.sin(a) * 0.4];
        strut(geo, [base[0], y, base[2]], out, 0.16, c);
        geo.cylinder({x: out[0], y: out[1] - 0.08, z: out[2], rot: 0}, 0, 0, 0, 0.09, 0.08, height * 0.35, c, 6);
    }
}

/** A flowering plant: a leafy crown and a few flower heads (the insect house's garden). */
export function flowers(geo: Geo, plot: Plot, lx: number, lz: number, size: number, colour: RGB, seed: number) {
    fern(geo, plot, lx, lz, size, tone("#4f8a3a"), seed, 7);
    const r = rng(seed + 1);
    for (let i = 0; i < 5; i++) {
        const a = r() * 6.28;
        const p = plot.p(lx + Math.cos(a) * size * 0.4, lz + Math.sin(a) * size * 0.4, size * (0.45 + r() * 0.3));
        geo.blob(p[0], p[1], p[2], 0.09, 0.07, 0.09, colour, hashText(`${seed}fl${i}`), 0);
    }
}

/** A termite mound: a ribbed earth spire with buttresses (the savanna's). */
export function termiteMound(geo: Geo, plot: Plot, lx: number, lz: number, height: number, seed: number) {
    const r = rng(seed);
    const c = tone("#a9763e");
    const base = plot.p(lx, lz, -0.1);
    plot.solids.push({kind: "mound", shape: "circle", x: base[0], z: base[2], r: height * 0.45, base: base[1], top: base[1] + height});
    geo.cylinder({x: base[0], y: base[1], z: base[2], rot: r() * 6}, 0, 0, 0, height * 0.42, 0.08, height, c, 9);
    geo.blob(base[0], base[1] + 0.1, base[2], height * 0.5, height * 0.25, height * 0.5, [c[0] * 0.95, c[1] * 0.95, c[2] * 0.95], seed, 1);
    for (let i = 0; i < 3; i++) {
        const a = r() * 6.28;
        const h = height * (0.4 + r() * 0.35);
        geo.cylinder({x: base[0] + Math.cos(a) * height * 0.22, y: base[1], z: base[2] + Math.sin(a) * height * 0.22, rot: a}, 0, 0, 0, height * 0.16, 0.04, h, [c[0] * 0.92, c[1] * 0.92, c[2] * 0.92], 6);
    }
}

/** A hay rack: a timber feeder on legs with a hay load, under a little roof (the grazers'). */
export function hayRack(geo: Geo, plot: Plot, lx: number, lz: number, turn: number) {
    const p = plot.p(lx, lz, 0);
    const fr: Frame = {x: p[0], y: p[1], z: p[2], rot: plot.fr.rot + turn};
    plot.solids.push({kind: "hay", shape: "box", x: p[0], z: p[2], hw: 0.9, hd: 0.42, rot: fr.rot, base: p[1], top: p[1] + 2.1});
    const wood = tone("#7a5a3e");
    for (const [x, z] of [[-0.8, -0.35], [0.8, -0.35], [0.8, 0.35], [-0.8, 0.35]] as const) geo.box(fr, x, -0.1, z, 0.1, 1.9, 0.1, wood);
    geo.box(fr, 0, 0.7, 0, 1.7, 0.5, 0.75, tone("#c9b26a"));
    for (const z of [-0.36, 0.36]) for (let x = -0.75; x <= 0.76; x += 0.25) geo.box(fr, x, 0.6, z, 0.04, 0.7, 0.04, wood);
    geo.gable(fr, 0, 1.8, 0, 1.9, 1.0, 0.35, 0.12, tone("#5a4a3a"), wood);
}

/**
 * An outdoor enclosure's habitat (p2, lane ZOO), by type, onto the zoo chunk's solid mesh and the zoo's fresh water:
 * the big cats' kopje (a rock outcrop with ledges, a dead tree with a deck, tall grass, a waterhole, a thatched shade),
 * the savanna's grassland (a waterhole, termite mounds, a kopje, grass, logs), the hoofstock's meadow (a pond, hay
 * racks, grass, shrubs and logs), the children's farm (hay racks, a trough, grass), the small mammals' (logs, rocks,
 * burrow mounds, grass), the bears' and wolves' forest floor (a den, logs, ferns, grass). Ground items keep clear of
 * the residents' spots. Returns the plot (its footprints), or null for a type it does not dress.
 */
export function dressPaddock(e: {id: string; type: string; slot: {at: Box; seed: number; safari?: SafariHabitat; annex?: ZooAnnexTheme}; pool: Pt[] | null}, spots: readonly Pt[], solid: Geo, water: Geo, heightAt: (x: number, z: number) => number, cover: Geo | null = null): Plot | null {
    // p4 (safari): a safari area is dressed as its habitat (`safari-habitat.ts`).
    if (e.slot.safari) return dressSafari(e, spots, solid, heightAt, cover);
    const s = e.slot.at;
    const fr: Frame = {x: s.x, y: 0, z: s.z, rot: s.rot};
    const floorAt = (lx: number, lz: number) => {
        const q = at(fr, lx, 0, lz);
        return heightAt(q[0], q[2]);
    };
    const plot = new Plot(s, floorAt, spots, e.slot.seed);
    // (The enclosure's own pool, where it has one, is taken: nothing is put in it.)
    if (e.pool) {
        const local = e.pool.map((q) => toLocal(s, q.x, q.z));
        const cx = local.reduce((t, q) => t + q.x, 0) / local.length;
        const cz = local.reduce((t, q) => t + q.z, 0) / local.length;
        const rr = Math.max(...local.map((q) => Math.hypot(q.x - cx, q.z - cz)));
        plot.footprints.push({x: cx, z: cz, r: rr, what: "own_pool"});
    }
    // (And the keepers' shed at the back and the feeding hatch, drawn by `scenery.ts` enclosure: kept clear too.)
    plot.footprints.push({x: s.w / 2 - 4, z: -s.d / 2 + 2.2, r: Math.min(6, s.w * 0.3) / 2 + 0.6, what: "keeper"}, {x: -s.w / 2 + 2, z: -s.d / 2 + 1.2, r: 1.0, what: "keeper"});
    // (An aviary's perching tree, `scenery.ts` deadTree.)
    if (e.type === "aviaries") plot.footprints.push({x: -s.w / 4, z: -s.d / 6, r: 1.6, what: "keeper"});
    const fixed = plot.footprints.slice();
    const clearOfPool = (lx: number, lz: number, r: number) => fixed.every((f) => Math.hypot(f.x - lx, f.z - lz) >= f.r + r + 0.4);
    // (Nor on another item: a log across the waterhole.)
    const clearOfOthers = (lx: number, lz: number, rad: number) => plot.footprints.every((f) => Math.hypot(f.x - lx, f.z - lz) >= (f.r + rad) * 0.8);
    const r = rng(e.slot.seed + 53);
    const W = s.w / 2;
    const D = s.d / 2;
    const at2 = (lx: number, lz: number, rad: number, what: string, spread = 2.5, tries = 18) => {
        const q = rng(hashText(`${e.id}:${what}:${lx.toFixed(1)}:${lz.toFixed(1)}`));
        for (let i = 0; i < tries; i++) {
            const k = i === 0 ? 0 : spread * (0.3 + (i / tries) * 1.4);
            const a = q() * 6.28;
            const x = lx + Math.cos(a) * k;
            const z = lz + Math.sin(a) * k;
            if (clearOfPool(x, z, rad) && clearOfOthers(x, z, rad) && plot.take(x, z, rad, what, 0.5)) return {x, z};
        }
        // Else the nearest free place on a 1 m grid over the plot.
        let best: Pt | null = null;
        let bestD = Infinity;
        for (let x = -W + rad + 0.5; x <= W - rad - 0.5; x += 1) {
            for (let z = -D + rad + 0.5; z <= D - rad - 0.5; z += 1) {
                const d = Math.hypot(x - lx, z - lz);
                if (d < bestD && clearOfPool(x, z, rad) && plot.free(x, z, rad, 0.5) && clearOfOthers(x, z, rad)) {
                    best = {x, z};
                    bestD = d;
                }
            }
        }
        if (best && plot.take(best.x, best.z, rad, what, 0.5)) return best;
        return null;
    };
    const grass = (n: number, colours: string[], height: number) => {
        for (let k = 0; k < n; k++) {
            const lx = (r() - 0.5) * (s.w - 1.2);
            const lz = (r() - 0.5) * (s.d - 1.2);
            if (!clearOfPool(lx, lz, 0.2)) continue;
            tuft(solid, plot, lx, lz, height * (0.6 + r() * 0.6), tone(colours[k % colours.length]), hashText(`${e.id}u${k}`), 9);
        }
    };
    const patches = (n: number, colours: string[], size: number) => {
        for (let k = 0; k < n; k++) {
            const lx = (r() - 0.5) * (s.w - 2);
            const lz = (r() - 0.5) * (s.d - 2);
            if (!clearOfPool(lx, lz, size)) continue;
            const radius = size * (0.6 + r() * 0.8);
            ground(lx, lz, radius, tone(colours[k % colours.length]), hashText(`${e.id}p${k}`), 0.12 + (k % 3) * 0.006);
        }
    };
    // p3 (zoofix): a patch of ground cover is ground: drawn 12 cm up (over the enclosure's paving, 6 cm), its triangles go
    // into `cover` too, the walk surfaces the residents stand on (`drawn-ground.ts`); the owner, 2026-11-17: "still seeing
    // camel and ostrich sunk into the ground in the zoo": their hooves and toes were 6 cm under the patches.
    const ground = (lx: number, lz: number, radius: number, colour: RGB, seed: number, lift: number) => {
        patch(solid, plot, lx, lz, radius, colour, seed, lift);
        if (cover) patch(cover, plot, lx, lz, radius, colour, seed, lift);
    };
    const logs = (n: number, colour = "#6f5236") => {
        for (let k = 0; k < n; k++) {
            const q = at2((r() - 0.5) * s.w * 0.7, (r() - 0.5) * s.d * 0.7, 1.3, "log", 4);
            if (!q) continue;
            const a = r() * 3.14;
            const half = 1.0 + r() * 0.5;
            log(solid, plot, q.x - Math.cos(a) * half, q.z - Math.sin(a) * half, q.x + Math.cos(a) * half, q.z + Math.sin(a) * half, 0.22 + r() * 0.1, tone(colour));
        }
    };
    const rocks = (n: number, size: number, colour: string, spread = 0.7) => {
        for (let k = 0; k < n; k++) {
            const q = at2((r() - 0.5) * s.w * spread, (r() - 0.5) * s.d * spread, size * 0.8, "rockwork", 4);
            if (q) outcrop(solid, plot, q.x, q.z, size * (0.7 + r() * 0.5), tone(colour), hashText(`${e.id}r${k}`));
        }
    };
    const waterhole = (lx: number, lz: number, radius: number, rim: string) => {
        const q = at2(lx, lz, radius + 0.3, "pool", 5, 30);
        if (!q) return;
        ground(q.x, q.z, radius + 1.4, tone("#8a7454"), hashText(`${e.id}mud`), 0.14);
        pool(solid, water, plot, q.x, q.z, radius, hashText(`${e.id}wh`), tone(rim), tone("#4f7f78"), 0.2);
    };
    const shrubs = (n: number, colour: string) => {
        for (let k = 0; k < n; k++) {
            const side = k % 4;
            const lx = side === 0 ? -W + 1 : side === 1 ? W - 1 : (r() - 0.5) * s.w * 0.9;
            const lz = side === 2 ? -D + 1 : side === 3 ? (r() - 0.5) * s.d * 0.5 : (r() - 0.5) * s.d * 0.9;
            const q = at2(lx, lz, 0.8, "plant", 1.5);
            if (q) solid.bush(...plot.p(q.x, q.z, 0.38), 0.8 + r() * 0.4, 0.7 + r() * 0.3, 0.8 + r() * 0.4, tone(colour), hashText(`${e.id}b${k}`));
        }
    };
    // p5 (zoospace): the zoo's new homes (`zoo-homes.ts`), each dressed as its kind's exhibit.
    switch (e.slot.annex) {
        case "dome": {
            // The free-flight dome's inside (`dome.ts`; its building, paths, boardwalk and lagoon are the town's,
            // `render/dome.ts`): a rain-forest floor of leaf litter and moss, ferns, shrubs and grass off the paths; reeds
            // round the lagoon and the flamingos' nest mounds on its bank; the cliff of rockwork along the west side with
            // its waterfall into the lagoon and its nest ledges; snags with perching limbs to 14 m; the feeding stations.
            const floor = heightAt(DOME.x, DOME.z);
            const X = (lx: number) => s.x + lx;
            const Z = (lz: number) => s.z + lz;
            const okAt = (lx: number, lz: number, rad: number) => Math.hypot(lx, lz) < DOME.r - 2 - rad && !onDomeWay(X(lx), Z(lz), rad + 0.3) && !onCliff(X(lx), Z(lz), rad + 0.6) && lagoonNorm(X(lx), Z(lz)) > 1.1 + rad / 12;
            const disc = (reach = DOME.r - 2.5, from = 0): [number, number] => {
                const a = r() * Math.PI * 2;
                const rho = Math.sqrt(from * from + r() * (reach * reach - from * from));
                return [Math.cos(a) * rho, Math.sin(a) * rho];
            };
            // (Kept clear: the trees' trunks, the snags, the feeding stations.)
            for (const t of DOME_TREES) plot.footprints.push({x: t.x - s.x, z: t.z - s.z, r: 1.1, what: "keeper"});
            // The floor.
            for (let k = 0; k < 110; k++) {
                const [lx, lz] = disc();
                if (!okAt(lx, lz, 1.2)) continue;
                ground(lx, lz, 1.8 + r() * 1.9, tone(["#4d4630", "#465230", "#585038", "#4c5c34", "#443f2c"][k % 5]), hashText(`${e.id}floor${k}`), 0.12 + (k % 3) * 0.006);
            }
            // The lagoon's banks: moss and mud to the water, reeds in clumps at its edge, nest mounds on the south bank.
            for (let k = 0; k < 40; k++) {
                const a = (k / 40) * Math.PI * 2;
                const c = Math.cos(DOME_LAGOON.rot);
                const sn = Math.sin(DOME_LAGOON.rot);
                const on = (scale: number): [number, number] => {
                    const ex = Math.cos(a) * DOME_LAGOON.rx * scale;
                    const ez = Math.sin(a) * DOME_LAGOON.rz * scale;
                    return [DOME_LAGOON.x + ex * c - ez * sn - s.x, DOME_LAGOON.z + ex * sn + ez * c - s.z];
                };
                const [bx, bz] = on(1.28);
                if (!onCliff(X(bx), Z(bz), 1.5) && !onDomeWay(X(bx), Z(bz), 0.2)) ground(bx, bz, 2.1, tone(k % 3 ? "#4f6a34" : "#6a5a3c"), hashText(`${e.id}bank${k}`), 0.125 + (k % 2) * 0.006);
                const [rx, rz] = on(1.05 + r() * 0.05);
                if (onCliff(X(rx), Z(rz), 2.5) || onDomeWay(X(rx), Z(rz), 0.5) || k % 5 === 4) continue;
                for (let j = 0; j < 3; j++) tuft(solid, plot, rx + (r() - 0.5) * 0.6, rz + (r() - 0.5) * 0.6, 1.0 + r() * 0.9, tone((k + j) % 3 ? "#6f8a3a" : "#94963f"), hashText(`${e.id}reed${k}.${j}`), 11);
            }
            for (let k = 0; k < 7; k++) {
                const q = at2(DOME_LAGOON.x - s.x + 6 + k * 1.5, DOME_LAGOON.z - s.z + 12.5 - k * 0.4, 0.45, "burrow", 2.5);
                if (!q || !okAt(q.x, q.z, 0.3)) continue;
                const pt = plot.p(q.x, q.z, -0.05);
                solid.cylinder({x: pt[0], y: pt[1], z: pt[2], rot: 0}, 0, 0, 0, 0.42, 0.26, 0.32, tone("#8a7454"), 9);
                solid.cylinder({x: pt[0], y: pt[1] + 0.3, z: pt[2], rot: 0}, 0, 0, 0, 0.22, 0.24, 0.02, tone("#6f5d42"), 9, true);
            }
            // The cliff: boulders in three tiers stepping back and up from its face, lower again against the drum.
            const C = DOME_CLIFF;
            const tiers: Array<{rho: number; base: number; tall: number; along: number; deep: number}> = [
                {rho: C.inner + 1.5, base: -0.4, tall: 3.6, along: 3.6, deep: 2.9},
                {rho: C.inner + 2.9, base: 2.4, tall: 3.6, along: 3.4, deep: 2.6},
                {rho: C.inner + 4.0, base: 5.2, tall: 3.2, along: 3.2, deep: 2.4},
                {rho: C.inner + 5.9, base: -0.4, tall: 5.6, along: 3.6, deep: 2.2}
            ];
            tiers.forEach((tier, t) => {
                const n = 10;
                for (let k = 0; k < n; k++) {
                    const a = C.a0 + ((C.a1 - C.a0) * (k + 0.5 + (t % 2) * 0.25)) / n;
                    // (The fall's notch in the top tier.)
                    if (t === 2 && Math.abs(a - C.fall) < 0.06) continue;
                    const rho = tier.rho + (r() - 0.5) * 0.5;
                    const x = DOME.x + Math.cos(a) * rho;
                    const z = DOME.z + Math.sin(a) * rho;
                    const k2 = 0.88 + r() * 0.2;
                    const colour = tone(["#74705e", "#7d7664", "#6a6756", "#737a5c"][(k + t * 3) % 4]);
                    const tall = tier.tall * (0.9 + r() * 0.2);
                    solid.rock(x, floor + tier.base, z, tier.along * (0.95 + r() * 0.25), tall, tier.deep * (0.95 + r() * 0.2), -a + Math.PI / 2 + (r() - 0.5) * 0.3, [colour[0] * k2, colour[1] * k2, colour[2] * k2], hashText(`${e.id}cliff${t}.${k}`));
                    if (t === 0 || t === 3) plot.solids.push({kind: "rock", shape: "box", x, z, hw: tier.along * 0.6, hd: tier.deep * 0.6, rot: -a + Math.PI / 2, base: floor - 0.4, top: floor + (t === 0 ? 8.4 : 5.4)});
                    // Ferns and moss on the tiers' tops.
                    if (t !== 1 || k % 2) {
                        const size = (k + t) % 2 ? 0.9 : 1.4;
                        solid.bush(x + (r() - 0.5) * 1.2, floor + tier.base + tall + size * 0.2, z + (r() - 0.5) * 1.2, size, size * 0.55, size, tone(["#3f7a34", "#4f8a3a", "#2f6a30"][(k + t) % 3]), hashText(`${e.id}cb${t}.${k}`));
                    }
                }
            });
            plot.footprints.push({x: Math.cos((C.a0 + C.a1) / 2) * (C.inner + 3.5), z: Math.sin((C.a0 + C.a1) / 2) * (C.inner + 3.5), r: 4.5, what: "rockwork"});
            // The waterfall: from the notch down the face to the lagoon's end, in narrow ribbons of white water side by
            // side (each its own shade and reach, thrown a little clear of the rock), foam and spray at its foot.
            {
                const at3 = (rho: number, y: number): V3 => [DOME.x + Math.cos(C.fall) * rho, floor + y, DOME.z + Math.sin(C.fall) * rho];
                const sx = -Math.sin(C.fall);
                const sz = Math.cos(C.fall);
                const shades = ["#d9ecf2", "#c2dde8", "#eaf5f8", "#b7d5e2", "#dcedf3", "#c9e2ec", "#e6f2f6"];
                for (let k = 0; k < 7; k++) {
                    const off = (k - 3) * 0.42 + (r() - 0.5) * 0.12;
                    const w = 0.3 + r() * 0.16;
                    const throwOut = 0.25 + r() * 0.5;
                    const line: V3[] = [at3(C.inner + 3.3, 7.25), at3(C.inner + 1.5 - throwOut * 0.3, 6.75 + r() * 0.15), at3(C.inner + 0.4 - throwOut, 3.6 + r() * 0.5), at3(C.inner - 0.7 - throwOut, 0.0)];
                    const side = (p: V3, q: number): V3 => [p[0] + sx * (off + q * w), p[1], p[2] + sz * (off + q * w)];
                    const colour = tone(shades[k]);
                    for (let i = 1; i < line.length; i++) {
                        solid.quad(side(line[i - 1], -0.5), side(line[i - 1], 0.5), side(line[i], 0.5), side(line[i], -0.5), colour);
                        solid.quad(side(line[i], -0.5), side(line[i], 0.5), side(line[i - 1], 0.5), side(line[i - 1], -0.5), colour);
                    }
                }
                const foot = at3(C.inner - 1.3, 0.05);
                for (let k = 0; k < 9; k++) solid.blob(foot[0] + (r() - 0.5) * 3.2, foot[1] - 0.04, foot[2] + (r() - 0.5) * 3.2, 0.6 + r() * 0.6, 0.1 + r() * 0.06, 0.6 + r() * 0.6, tone(k % 2 ? "#dfeef2" : "#c9e0e8"), hashText(`${e.id}foam${k}`), 1);
            }
            // The perches: the snags (a stripped trunk and its limbs, a perch at each limb's tip and at its top), the
            // cliff's nest ledges (a slab, a nest of sticks on every other one), the feeding stations (a post and a tray).
            DOME_SNAGS.forEach((snag, i) => {
                const lx = snag.x - s.x;
                const lz = snag.z - s.z;
                plot.footprints.push({x: lx, z: lz, r: 0.8, what: "tree"});
                const foot = plot.p(lx, lz, -0.3);
                const half: V3 = [snag.x, floor + snag.height * 0.55, snag.z];
                strut(solid, foot, half, 0.3 + snag.height * 0.022, BARK);
                strut(solid, half, [snag.x, floor + snag.height, snag.z], 0.2 + snag.height * 0.012, BARK);
                plot.solids.push({kind: "trunk", shape: "circle", x: snag.x, z: snag.z, r: 0.4, base: foot[1], top: floor + snag.height});
                for (let k = 0; k < 4; k++) {
                    const a = (k / 4) * Math.PI * 2 + i;
                    strut(solid, [snag.x, foot[1] + 0.9, snag.z], [snag.x + Math.cos(a) * 0.8, foot[1] + 0.25, snag.z + Math.sin(a) * 0.8], 0.2, BARK);
                }
                snag.limbs.forEach((l) => {
                    const from: V3 = [snag.x, floor + l.y - 0.25, snag.z];
                    const tip: V3 = [snag.x + Math.cos(l.a) * l.reach, floor + l.y + l.reach * 0.45 - 0.07, snag.z + Math.sin(l.a) * l.reach];
                    strut(solid, from, tip, 0.14, BARK);
                    const mid: V3 = [(from[0] + tip[0] * 2) / 3, (from[1] + tip[1] * 2) / 3, (from[2] + tip[2] * 2) / 3];
                    strut(solid, mid, [mid[0] + Math.cos(l.a + 1) * 0.7, mid[1] + 0.45, mid[2] + Math.sin(l.a + 1) * 0.7], 0.07, BARK);
                });
            });
            for (const perch of domePerches()) {
                if (perch.kind !== "ledge") continue;
                const turn = -Math.atan2(perch.z - DOME.z, perch.x - DOME.x) + Math.PI / 2;
                const fr: Frame = {x: perch.x, y: floor + perch.y - 0.16, z: perch.z, rot: turn};
                solid.box(fr, 0, 0, 0, 1.5, 0.16, 1.1, tone("#8f8676"));
                if (perch.y > 5) solid.cylinder({x: perch.x, y: floor + perch.y, z: perch.z, rot: 0}, 0.3, 0, 0, 0.34, 0.26, 0.14, tone("#6a5236"), 8);
            }
            DOME_FEEDERS.forEach((feeder, i) => {
                const lx = feeder.x - s.x;
                const lz = feeder.z - s.z;
                plot.footprints.push({x: lx, z: lz, r: 0.6, what: "tree"});
                const foot = plot.p(lx, lz, -0.2);
                solid.cylinder({x: feeder.x, y: foot[1], z: feeder.z, rot: 0}, 0, 0, 0, 0.08, 0.07, floor + 1.2 - foot[1], tone("#6a5038"), 6);
                solid.box({x: feeder.x, y: floor + 1.17, z: feeder.z, rot: i * 0.7}, 0, 0, 0, 0.95, 0.06, 0.95, tone("#8a6a48"));
                plot.solids.push({kind: "post", shape: "circle", x: feeder.x, z: feeder.z, r: 0.5, base: foot[1], top: floor + 1.3});
                const fruit = ["#e8862e", "#d8442e", "#e8c83a", "#7fae3a"];
                for (let k = 0; k < 5; k++) solid.blob(feeder.x + (r() - 0.5) * 0.6, floor + 1.29, feeder.z + (r() - 0.5) * 0.6, 0.09, 0.08, 0.09, tone(fruit[(i + k) % 4]), hashText(`${e.id}fruit${i}.${k}`), 0);
            });
            // Logs and rocks on the floor, shrubs towards the drum, ferns and grass everywhere off the paths.
            for (let k = 0; k < 9; k++) {
                const [lx, lz] = disc();
                if (!okAt(lx, lz, 1.5)) continue;
                const q = at2(lx, lz, 1.3, "log", 2, 8);
                if (!q || !okAt(q.x, q.z, 1.4)) continue;
                const a = r() * 3.14;
                const len = 1.0 + r() * 0.7;
                log(solid, plot, q.x - Math.cos(a) * len, q.z - Math.sin(a) * len, q.x + Math.cos(a) * len, q.z + Math.sin(a) * len, 0.22 + r() * 0.12, tone(k % 2 ? "#5a4630" : "#4f5a34"));
            }
            for (let k = 0; k < 7; k++) {
                const [lx, lz] = disc();
                if (!okAt(lx, lz, 1.4)) continue;
                const q = at2(lx, lz, 1.0, "rockwork", 2, 8);
                if (q && okAt(q.x, q.z, 1.2)) outcrop(solid, plot, q.x, q.z, 0.8 + r() * 0.5, tone("#7d7566"), hashText(`${e.id}rock${k}`));
            }
            for (let k = 0; k < 70; k++) {
                const [lx, lz] = disc(DOME.r - 2.6, k % 3 ? 22 : 0);
                if (!okAt(lx, lz, 0.9) || !plot.take(lx, lz, 0.8, "plant", 0.5)) continue;
                const p = plot.p(lx, lz, 0);
                const size = 0.8 + r() * 0.7;
                solid.bush(p[0], p[1] + size * 0.55, p[2], size * 1.15, size * 0.9, size * 1.15, tone(["#2f6a30", "#3f7a34", "#356a3a", "#4f8a3a"][k % 4]), hashText(`${e.id}bush${k}`));
            }
            for (let k = 0; k < 170; k++) {
                const [lx, lz] = disc();
                if (!okAt(lx, lz, 0.5) || !plot.free(lx, lz, 0.4, 0.5)) continue;
                fern(solid, plot, lx, lz, 0.7 + r() * 0.7, tone(["#3f7a34", "#4f8a3a", "#356a3a"][k % 3]), hashText(`${e.id}fern${k}`), 9, k % 7 === 0 ? 0.5 + r() * 0.8 : 0);
            }
            for (let k = 0; k < 360; k++) {
                const [lx, lz] = disc();
                if (!okAt(lx, lz, 0.2)) continue;
                tuft(solid, plot, lx, lz, 0.3 + r() * 0.45, tone(["#5f8a3a", "#6f9a44", "#4f7a34"][k % 3]), hashText(`${e.id}g${k}`), 8);
            }
            return plot;
        }
        case "wetland": {
            // A walk-through lagoon: the big lagoon and a pond (`areas.ts` wetlandLagoon, kept free of the residents'
            // spots), mud flats round them, reed beds, the flamingos' nest mounds, a log or two, shrubs along the netting.
            for (const w of wetlandLagoon(s)) {
                if (!plot.take(w.x, w.z, w.r, "pool", 0.5)) continue;
                ground(w.x, w.z, w.r + 2.2, tone("#7d6a4a"), hashText(`${e.id}mud${w.x.toFixed(0)}`), 0.13);
                ground(w.x + w.r * 0.3, w.z - w.r * 0.2, w.r + 1.2, tone("#8a7656"), hashText(`${e.id}mud2${w.x.toFixed(0)}`), 0.135);
                ground(w.x, w.z, w.r + 0.7, tone("#5f7a3a"), hashText(`${e.id}shallows${w.x.toFixed(0)}`), 0.14);
                pool(solid, water, plot, w.x, w.z, w.r, hashText(`${e.id}lagoon${w.x.toFixed(0)}`), tone("#7d7464"), tone("#5f8f86"), 0.2);
                // Reeds in clumps round its edge (tall blades, on the bank).
                // (Beds of three stems a clump round the water, on the shallows' green.)
                const n = Math.round(w.r * 4.5);
                for (let k = 0; k < n; k++) {
                    const a = (k / n) * Math.PI * 2 + r() * 0.3;
                    const rr = w.r * (1.0 + r() * 0.14);
                    const q = at2(w.x + Math.cos(a) * rr, w.z + Math.sin(a) * rr, 0.35, "plant", 0.6, 6);
                    if (!q) continue;
                    for (let j = 0; j < 3; j++) tuft(solid, plot, q.x + (r() - 0.5) * 0.5, q.z + (r() - 0.5) * 0.5, 1.0 + r() * 0.8, tone((k + j) % 3 ? "#6f8a3a" : "#94963f"), hashText(`${e.id}reed${k}.${j}${w.x.toFixed(0)}`), 11);
                }
            }
            for (let k = 0; k < 5; k++) {
                const q = at2((r() - 0.5) * s.w * 0.7, (r() - 0.5) * s.d * 0.7, 0.45, "burrow", 4);
                if (!q) continue;
                // A flamingo's nest: a truncated mud cone with a dished top.
                const pt = plot.p(q.x, q.z, -0.05);
                solid.cylinder({x: pt[0], y: pt[1], z: pt[2], rot: 0}, 0, 0, 0, 0.42, 0.26, 0.32, tone("#8a7454"), 9);
                solid.cylinder({x: pt[0], y: pt[1] + 0.3, z: pt[2], rot: 0}, 0, 0, 0, 0.22, 0.24, 0.02, tone("#6f5d42"), 9, true);
            }
            patches(18, ["#6f8a42", "#7d9a4a", "#6a8a3e", "#5f7a3a"], 3.2);
            logs(3, "#6a5236");
            shrubs(16, "#3f7a34");
            grass(420, ["#6f9a44", "#86a84e", "#7a8a3e", "#9aa050"], 0.6);
            return plot;
        }
        case "waders": {
            // The storks' and pelicans' flight: a long shallow pool, reeds, a nest platform of sticks on a pole.
            const q = at2(0, -D * 0.25, Math.min(W - 1, 1.9), "pool", 4, 30);
            if (q) {
                ground(q.x, q.z, Math.min(W - 0.6, 2.4), tone("#7d6a4a"), hashText(`${e.id}mud`), 0.13);
                pool(solid, water, plot, q.x, q.z, Math.min(W - 1, 1.9), hashText(`${e.id}pool`), tone("#7d7464"), tone("#5f8f86"), 0.2);
            }
            const nest = at2(0, D * 0.3, 0.3, "post", 3);
            if (nest) {
                const top = pole(solid, plot, nest.x, nest.z, 3.0, 0.1, hashText(`${e.id}nest`));
                solid.cylinder({x: top[0], y: top[1] - 0.1, z: top[2], rot: 0}, 0, 0, 0, 0.75, 0.6, 0.35, tone("#6a5236"), 9);
            }
            for (let k = 0; k < 8; k++) {
                const t = at2((r() - 0.5) * s.w * 0.6, (r() - 0.5) * s.d * 0.85, 0.35, "plant", 2);
                if (t) tuft(solid, plot, t.x, t.z, 1.0 + r() * 0.6, tone("#7a8a3e"), hashText(`${e.id}reed${k}`), 11);
            }
            patches(5, ["#6f8a42", "#8a7656"], 1.6);
            grass(70, ["#6f9a44", "#86a84e"], 0.5);
            return plot;
        }
        case "vultures": {
            // A rocky ledge country: a cliff of rockwork at the back with ledges, boulders, a flat feeding rock, sand.
            patches(6, ["#b39a6a", "#a08a5e", "#8f8a5a"], 1.8);
            const k1 = at2(0, -D * 0.62, 1.6, "rockwork", 3, 30);
            if (k1) {
                outcrop(solid, plot, k1.x, k1.z, 2.4, tone("#9a8a72"), hashText(`${e.id}cliff`));
                ledge(solid, plot, k1.x + 1.2, k1.z + 1.0, 1.0, tone("#a8987e"), hashText(`${e.id}l1`));
            }
            rocks(3, 1.0, "#968670", 0.6);
            const slab = at2(0, D * 0.2, 0.9, "rockwork", 3);
            if (slab) ledge(solid, plot, slab.x, slab.z, 0.9, tone("#b0a088"), hashText(`${e.id}slab`));
            logs(2, "#7a6248");
            grass(60, ["#b0a050", "#9aa050"], 0.5);
            return plot;
        }
        case "raptors":
        case "owls": {
            // A long flight: perching poles down its length (the falconer's blocks and bow perches), a stump, logs,
            // gravel and grass for the hawks; leaf litter, ferns and a nest box on a post for the owls.
            const owls = e.slot.annex === "owls";
            patches(5, owls ? ["#5a4a32", "#4f5a32", "#6a5a3a"] : ["#a09478", "#8a8a5a", "#9a8a6a"], 1.2);
            for (let k = 0; k < 3; k++) {
                const q = at2((k % 2 ? 0.3 : -0.3) * s.w, -D * 0.7 + (k * s.d * 0.7) / 2, 0.25, "post", 2);
                if (q) pole(solid, plot, q.x, q.z, 1.6 + r() * 0.9, 0.08, hashText(`${e.id}perch${k}`));
            }
            const box = owls ? at2(0, -D * 0.4, 0.25, "post", 3) : null;
            if (box) {
                const top = pole(solid, plot, box.x, box.z, 2.6, 0.08, hashText(`${e.id}box`));
                const bf: Frame = {x: top[0], y: top[1], z: top[2], rot: s.rot};
                solid.box(bf, 0, 0, 0, 0.5, 0.6, 0.5, tone("#7a5a3e"));
                solid.box(bf, 0, 0.6, 0, 0.62, 0.06, 0.62, tone("#5a4a3a"));
                solid.cylinder({x: top[0], y: top[1] + 0.32, z: top[2], rot: 0}, 0, 0, 0, 0.09, 0.09, 0.02, tone("#1e1a16"), 8);
            }
            logs(1, owls ? "#5e4632" : "#6f5236");
            if (owls) {
                for (let k = 0; k < 6; k++) {
                    const q = at2((k % 2 ? 1 : -1) * (W - 0.7), (r() - 0.5) * s.d * 0.85, 0.45, "plant", 2);
                    if (q) fern(solid, plot, q.x, q.z, 0.8 + r() * 0.4, tone("#3f7a34"), hashText(`${e.id}f${k}`), 9);
                }
            } else rocks(1, 0.8, "#968670", 0.5);
            grass(owls ? 40 : 60, owls ? ["#5f7a3a", "#4f6a34"] : ["#9aa050", "#b0a050", "#86a84e"], 0.4);
            return plot;
        }
        case "tortoises": {
            // A dry paddock: sand and earth, a heated shelter (the keepers' shed), a mud wallow, rocks to climb, cactus and
            // tussock grass, hay scattered by the shelter.
            patches(8, ["#c9b083", "#b39a6a", "#a08a5e"], 1.4);
            const wallow = at2(0, D * 0.25, 1.0, "pool", 3, 20);
            if (wallow) {
                ground(wallow.x, wallow.z, 1.5, tone("#7d6a4a"), hashText(`${e.id}mud`), 0.13);
                pool(solid, water, plot, wallow.x, wallow.z, 0.95, hashText(`${e.id}wallow`), tone("#867d70"), tone("#6f7a5a"), 0.12);
            }
            rocks(2, 0.8, "#a8987e", 0.6);
            for (let k = 0; k < 3; k++) {
                const q = at2((r() - 0.5) * s.w * 0.6, (r() - 0.5) * s.d * 0.7, 0.25, "post", 3);
                if (q) cactus(solid, plot, q.x, q.z, 0.9 + r() * 0.6, hashText(`${e.id}c${k}`));
            }
            for (let k = 0; k < 4; k++) {
                const q = at2((r() - 0.5) * s.w * 0.5, -D * 0.5 + r() * 2, 0.35, "hay", 2);
                if (q) {
                    const p = plot.p(q.x, q.z, 0.02);
                    solid.blob(p[0], p[1], p[2], 0.4, 0.08, 0.3, tone("#c9b26a"), hashText(`${e.id}hay${k}`), 0);
                }
            }
            grass(50, ["#b0a050", "#c8b060"], 0.35);
            return plot;
        }
        case "walkabout": {
            // The walk-through: grass and gum-tree scrub, a pond for the capybaras, a hay rack, logs, a burrow mound.
            patches(8, ["#7a9a48", "#8a8a52", "#a08a5e"], 1.8);
            waterhole(0, D * 0.15, 1.6, "#867d70");
            const q = at2(0, -D * 0.5, 1.1, "hay", 3);
            if (q) hayRack(solid, plot, q.x, q.z, Math.PI / 2);
            logs(2);
            shrubs(6, "#5f7a3a");
            grass(140, ["#8a9a48", "#a0a050", "#6f9a44"], 0.55);
            return plot;
        }
        case "carnivores": {
            // A cat's or a marten's run: a climbing tree with a deck, a log, a hollow log den, tall grass.
            patches(4, ["#7a6a4a", "#6f8a42"], 1.2);
            const t = at2(0, -D * 0.3, 0.5, "tree", 2, 24);
            if (t) {
                climbingTree(solid, plot, t.x, t.z, 3.6, hashText(`${e.id}ct`));
                deck(solid, plot, t.x, t.z + 0.1, 1.4, 1.2, 2.4);
            }
            logs(2);
            for (let k = 0; k < 3; k++) {
                const f = at2((r() - 0.5) * s.w * 0.6, (r() - 0.5) * s.d * 0.8, 0.4, "plant", 2);
                if (f) fern(solid, plot, f.x, f.z, 0.8, tone("#4f7a34"), hashText(`${e.id}f${k}`), 9);
            }
            grass(70, ["#8a9a48", "#a0a050"], 0.7);
            return plot;
        }
        default:
            break;
    }
    switch (e.type) {
        case "big_cats": {
            patches(8, ["#c2a46a", "#a99a5a", "#8f8a52"], 2.2);
            // The kopje at the back: a big outcrop with ledges to lie on, a smaller one beside it.
            const k1 = at2(-W * 0.45, -D * 0.55, 1.7, "rockwork", 4, 30);
            if (k1) {
                outcrop(solid, plot, k1.x, k1.z, 2.6, tone("#9a8a72"), hashText(`${e.id}kop`));
                ledge(solid, plot, k1.x + 1.8, k1.z + 1.2, 1.1, tone("#a8987e"), hashText(`${e.id}kl`));
            }
            rocks(2, 1.4, "#968670", 0.6);
            const t = at2(W * 0.4, -D * 0.4, 0.9, "tree", 4, 24);
            if (t) {
                climbingTree(solid, plot, t.x, t.z, 4.2, hashText(`${e.id}ct`));
                deck(solid, plot, t.x, t.z + 0.1, 2.0, 1.6, 2.6);
            }
            const sh = at2(W * 0.55, D * 0.1, 1.9, "shelter", 3);
            if (sh) shelter(solid, plot, sh.x, sh.z, 3.2, 2.4, 2.0, tone("#7a6248"), tone("#c2a45a"), 0);
            waterhole(-W * 0.1, D * 0.35, 1.6, "#9a8a72");
            logs(2);
            grass(160, ["#c8b060", "#b0a050", "#d8c070"], 0.8);
            return plot;
        }
        case "savanna_paddocks": {
            patches(10, ["#b8a060", "#9a9a58", "#c8b080"], 3.2);
            waterhole(W * 0.25, D * 0.2, 2.2, "#9a8a72");
            for (let k = 0; k < 3; k++) {
                const q = at2((r() - 0.5) * s.w * 0.7, (r() - 0.5) * s.d * 0.7, 1.0, "mound", 5);
                if (q) termiteMound(solid, plot, q.x, q.z, 1.6 + r() * 1.2, hashText(`${e.id}tm${k}`));
            }
            const k1 = at2(-W * 0.5, -D * 0.5, 1.7, "rockwork", 5, 30);
            if (k1) outcrop(solid, plot, k1.x, k1.z, 2.4, tone("#9a8a72"), hashText(`${e.id}kop`));
            logs(3, "#8a7458");
            shrubs(6, "#6f7a3a");
            grass(260, ["#c8b060", "#b0a050", "#9aa050"], 1.0);
            return plot;
        }
        case "hoofstock_paddocks": {
            patches(10, ["#6f8a42", "#7a9a48", "#8a8a52"], 3);
            waterhole(-W * 0.3, D * 0.2, 1.7, "#867d70");
            for (let k = 0; k < 2; k++) {
                const q = at2((k ? 1 : -1) * W * 0.4, -D * 0.45, 1.1, "hay", 3);
                if (q) hayRack(solid, plot, q.x, q.z, r() * 0.5);
            }
            rocks(2, 1.1, "#8f877a");
            shrubs(8, "#4f7a3a");
            logs(2);
            grass(160, ["#6f9a44", "#86a84e", "#5f8a3a"], 0.55);
            return plot;
        }
        case "childrens_farm": {
            patches(8, ["#7a9a48", "#8a7a52"], 2);
            const q = at2(W * 0.2, -D * 0.3, 1.1, "hay", 3);
            if (q) hayRack(solid, plot, q.x, q.z, 0);
            const tr = at2(-W * 0.3, -D * 0.2, 0.9, "trough", 3);
            if (tr) {
                const p = plot.p(tr.x, tr.z, 0);
                const tf: Frame = {x: p[0], y: p[1], z: p[2], rot: s.rot};
                plot.solids.push({kind: "trough", shape: "box", x: p[0], z: p[2], hw: 0.8, hd: 0.3, rot: s.rot, base: p[1], top: p[1] + 0.5});
                solid.box(tf, 0, 0, 0, 1.6, 0.5, 0.6, tone("#6a6a66"));
                solid.box(tf, 0, 0.42, 0, 1.4, 0.06, 0.45, tone("#4f7f88"));
            }
            for (let k = 0; k < 4; k++) {
                const b = at2((r() - 0.5) * s.w * 0.7, (r() - 0.5) * s.d * 0.6, 0.6, "hay", 3);
                if (b) solid.cylinder({x: plot.p(b.x, b.z)[0], y: plot.p(b.x, b.z)[1], z: plot.p(b.x, b.z)[2], rot: r()}, 0, -0.02, 0, 0.5, 0.5, 0.7, tone("#c9b26a"), 10);
                if (b) plot.solids.push({kind: "hay", shape: "circle", x: plot.p(b.x, b.z)[0], z: plot.p(b.x, b.z)[2], r: 0.5, base: plot.p(b.x, b.z)[1], top: plot.p(b.x, b.z)[1] + 0.7});
            }
            grass(120, ["#6f9a44", "#86a84e"], 0.4);
            return plot;
        }
        case "small_mammals": {
            patches(6, ["#8a7454", "#6f8a42", "#a08a6a"], 1.4);
            rocks(3, 0.8, "#8f877a", 0.8);
            logs(2);
            for (let k = 0; k < 3; k++) {
                const q = at2((r() - 0.5) * s.w * 0.7, (r() - 0.5) * s.d * 0.7, 0.5, "burrow", 3);
                if (q) {
                    const p = plot.p(q.x, q.z, -0.15);
                    solid.blob(p[0], p[1], p[2], 0.55, 0.3, 0.5, tone("#8a6a48"), hashText(`${e.id}bur${k}`), 1);
                    const h = plot.p(q.x + 0.35, q.z, 0.02);
                    solid.cylinder({x: h[0], y: h[1], z: h[2], rot: 0}, 0, 0, 0, 0.13, 0.13, 0.02, tone("#2a2018"), 8);
                }
            }
            grass(70, ["#6f9a44", "#86a84e"], 0.4);
            return plot;
        }
        case "bears_wolves": {
            patches(8, ["#5a6a3a", "#6a5a3a", "#4f6a34"], 2.2);
            const den = at2(-W * 0.4, -D * 0.6, 1.8, "shelter", 3);
            if (den) {
                outcrop(solid, plot, den.x, den.z - 0.6, 2.0, tone("#857a6a"), hashText(`${e.id}den`));
                shelter(solid, plot, den.x, den.z + 0.6, 2.4, 1.8, 1.5, tone("#5e4632"), tone("#4a4440"), 0, true);
            }
            logs(3);
            for (let k = 0; k < 6; k++) {
                const q = at2((r() - 0.5) * s.w * 0.85, (r() - 0.5) * s.d * 0.85, 0.5, "plant", 3);
                if (q) fern(solid, plot, q.x, q.z, 0.9 + r() * 0.4, tone("#3f7a34"), hashText(`${e.id}f${k}`), 9);
            }
            grass(140, ["#6f8a44", "#5f7a3a", "#86984e"], 0.5);
            return plot;
        }
        case "aviaries": {
            // A planted flight: a shallow pool for the waders, shrubs and ferns round the netting, grass, perching logs.
            patches(6, ["#5f7d3a", "#7a6a4a", "#6f8a42"], 1.8);
            waterhole(W * 0.25, D * 0.25, 1.8, "#867d70");
            shrubs(10, "#3f7a34");
            for (let k = 0; k < 6; k++) {
                const q = at2((k % 2 ? 1 : -1) * (W - 1.2), (r() - 0.5) * s.d * 0.8, 0.5, "plant", 2);
                if (q) fern(solid, plot, q.x, q.z, 1.0 + r() * 0.6, tone("#4f8a3a"), hashText(`${e.id}f${k}`), 9, r() < 0.4 ? 0.8 : 0);
            }
            logs(2);
            grass(90, ["#6f9a44", "#86a84e", "#5f8a3a"], 0.45);
            return plot;
        }
        default:
            return null;
    }
}

/** A Geo that keeps nothing and does no geometry work (the dressing's footprints alone). */
class SinkGeo extends Geo {
    override tri() {}
    override triShaded() {}
    override rock() {}
    override blob() {}
    override bush() {}
}

/**
 * What stands on an enclosure's ground and how tall (m), by its footprint's `what`: the residents walk round them (the
 * town's colliders, `colliders.ts`), so none stands inside a rock, a termite mound, a log or a hay rack while it wanders
 * (p3 zoofix: the owner's "ostrich sunk into the ground": it stood in a termite mound). Plants and pools are soft
 * (paths go round, a body may brush in); the keepers' own corner and the enclosure's own pool are not here.
 */
export const HABITAT_ITEMS: Readonly<Record<string, {kind: "rock" | "log" | "hay" | "post" | "shrub" | "pond"; height: number; soft?: boolean}>> = {
    rockwork: {kind: "rock", height: 2.6},
    mound: {kind: "rock", height: 2.9},
    tree: {kind: "post", height: 4.4},
    shelter: {kind: "rock", height: 2.6},
    log: {kind: "log", height: 0.6},
    hay: {kind: "hay", height: 2.0},
    trough: {kind: "hay", height: 0.6},
    burrow: {kind: "rock", height: 0.3, soft: true},
    plant: {kind: "shrub", height: 1.3, soft: true},
    pool: {kind: "pond", height: 0.4, soft: true}
};

export type HabitatItem = {id: string; what: string; x: number; z: number; r: number};

/**
 * The ground items an outdoor enclosure's dressing puts down (town frame), exactly where `dressPaddock` draws them (the
 * same run, drawing nothing).
 */
export function paddockItems(e: {id: string; type: string; slot: {at: Box; seed: number; safari?: SafariHabitat; annex?: ZooAnnexTheme}; pool: Pt[] | null}, spots: readonly Pt[]): HabitatItem[] {
    const plot = dressPaddock(e, spots, new SinkGeo(), new SinkGeo(), () => 0);
    if (!plot) return [];
    const s = e.slot.at;
    return plot.footprints.flatMap((f, i) => {
        if (!HABITAT_ITEMS[f.what]) return [];
        const q = at({x: s.x, y: 0, z: s.z, rot: s.rot}, f.x, 0, f.z);
        return [{id: `${e.id}/${f.what}-${i}`, what: f.what, x: q[0], z: q[2], r: f.r}];
    });
}
