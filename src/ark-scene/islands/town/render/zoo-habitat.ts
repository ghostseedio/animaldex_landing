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
 * A plot to dress: its box (local +z is its front, toward the visitors), the floor's height at a local point, and the
 * residents' spots in its local frame. Every ground item asks `free` first and records its footprint.
 */
export class Plot {
    readonly spots: Pt[];
    readonly footprints: Footprint[] = [];
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
        geo.rock(p[0], p[1] - s * 0.18, p[2], s * (0.9 + r() * 0.3), s * (big ? 0.75 + r() * 0.3 : 0.55 + r() * 0.3), s * (0.85 + r() * 0.3), r() * 6.28, [colour[0] * k, colour[1] * k, colour[2] * k], hashText(`${seed}:${i}`));
    }
}

/** A flat-topped basking ledge: a wide low boulder. */
export function ledge(geo: Geo, plot: Plot, lx: number, lz: number, size: number, colour: RGB, seed: number) {
    const p = plot.p(lx, lz, 0);
    geo.rock(p[0], p[1] - size * 0.1, p[2], size * 1.3, size * 0.38, size, (seed % 628) / 100, colour, seed);
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
    return [p[0] + Math.cos(a) * lean, p[1] + height, p[2] + Math.sin(a) * lean] as V3;
}

/** A dead tree for climbing and perching: a trunk and a few climbing limbs. */
export function climbingTree(geo: Geo, plot: Plot, lx: number, lz: number, height: number, seed: number) {
    const r = rng(seed);
    const base = plot.p(lx, lz, -0.1);
    const top: V3 = [base[0] + (r() - 0.5) * 0.4, base[1] + height, base[2] + (r() - 0.5) * 0.4];
    strut(geo, base, [base[0], base[1] + height * 0.5, base[2]], 0.5, BARK);
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
