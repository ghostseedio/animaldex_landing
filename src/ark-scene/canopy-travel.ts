/**
 * Primates travelling through the canopy (the owner, 2026-11-17: "need to see monkeys swinging on the trees").
 *
 * While a tree-living primate stays up in its tree (its schedule's stay at a limb, a branch or a hang point), now and
 * then it goes out through the crowns and back, the way its kind moves (`canopy-moves.json`, from the species' own
 * stored text; else the small family table below):
 * - "brachiate" (the gibbons, the siamang, the orangutan slowly): arm over arm under the limbs, its body a pendulum
 *   under the hand that holds, letting go at the top of the swing and flying across the gap to the next hold (the
 *   lar gibbon's "lets go with both hands, flying briefly across gaps between trees before catching the next branch");
 * - "leap" (the colobus, the langurs, the sakis, the titis): along the limb's top and a long leap, a ballistic arc,
 *   onto the next tree's limb, a pause there, and on;
 * - "run" (the macaques, the capuchins, the squirrel monkeys, the lemurs, the marmosets): along the limbs on all fours,
 *   short bounds over the gaps.
 * Prehensile-tailed kinds (the howler, the capuchin, the spider monkeys) hang by the tail to feed at the far end.
 *
 * The holds are the drawn trees' own places (their limbs' tops and hang points, `tree-attach.json` on the drawn lod0
 * surface), so a hand meets wood; a route never passes through another tree's trunk. Everything here is a pure
 * function of the route (built once from the place, its neighbours and the animal's id) and the shared clock: the
 * same for every viewer. Visual only: where the animal "is" stays its schedule's spot.
 */

import moves from "@/ark-scene/canopy-moves.json";

type Vec = {x: number; y: number; z: number};

export type CanopyMode = "brachiate" | "leap" | "run";
export type CanopyKind = {mode: CanopyMode; tail: boolean; slow: boolean; why: string};

const MOVES = (moves as unknown as {species: Record<string, [CanopyMode, number, string]>}).species;

/**
 * Primates the catalogue says nothing of, by genus (their family's way of moving through trees; the field guides'
 * locomotor classes): the gibbons and spider monkeys brachiate, the orangutans too but slowly; the colobines, the
 * pitheciids and the indriids leap; the cebids, the macaques, the guenons, the lemurids and the callitrichids run and
 * bound. The great apes of the ground (chimpanzees, gorillas, bonobos) and the baboons and mandrills climb only: none.
 */
const GENUS: Record<string, CanopyMode> = {
    Hylobates: "brachiate", Symphalangus: "brachiate", Nomascus: "brachiate", Hoolock: "brachiate", Pongo: "brachiate", Ateles: "brachiate", Brachyteles: "brachiate",
    Colobus: "leap", Piliocolobus: "leap", Procolobus: "leap", Trachypithecus: "leap", Semnopithecus: "leap", Presbytis: "leap", Nasalis: "leap", Pygathrix: "leap", Rhinopithecus: "leap",
    Pithecia: "leap", Chiropotes: "leap", Cacajao: "leap", Plecturocebus: "leap", Callicebus: "leap", Propithecus: "leap", Indri: "leap", Avahi: "leap", Lepilemur: "leap", Galago: "leap",
    Macaca: "run", Cercopithecus: "run", Cebus: "run", Sapajus: "run", Saimiri: "run", Callithrix: "run", Mico: "run", Saguinus: "run", Leontopithecus: "run", Cebuella: "run", Aotus: "run",
    Varecia: "run", Lemur: "run", Eulemur: "run", Hapalemur: "run", Alouatta: "run", Lagothrix: "run"
};
/** Prehensile tails (the atelids; the capuchins' gripping tail). */
const TAIL_GENUS = new Set(["Ateles", "Brachyteles", "Alouatta", "Lagothrix", "Sapajus", "Cebus"]);

/** How a kind travels through the crowns, or null (it climbs only). */
export function canopyKindOf(slug: string, scientific?: string | null): CanopyKind | null {
    const row = MOVES[slug];
    const genus = (scientific ?? "").trim().split(/\s+/)[0] ?? "";
    if (row) return {mode: row[0], tail: row[1] === 1 || TAIL_GENUS.has(genus), slow: genus === "Pongo", why: row[2]};
    const mode = GENUS[genus];
    return mode ? {mode, tail: TAIL_GENUS.has(genus), slow: genus === "Pongo", why: `genus ${genus}`} : null;
}

// MARK: - The route

/** A hold: a limb's top (its normal up-ish) or a hang point under a limb (`under`), of a tree. */
export type Anchor = {id: string; tree: string; x: number; y: number; z: number; nx: number; ny: number; nz: number; under: boolean};
/** A trunk to keep clear of (its axis at x, z; its radius; the height it stands to). */
export type TrunkDisc = {tree: string; x: number; z: number; r: number; top: number};

export type Hop = {from: Anchor; to: Anchor; style: "swing" | "leap" | "run"; start: number; seconds: number; /** Brachiation: release and catch points of the body's centre, the arc's rise. */ rise: number};
export type CanopyRoute = {kind: CanopyKind; length: number; reach: number; hops: Hop[]; seconds: number; home: Anchor; /** When (s, after its first move) it reaches the far end and holds there a while. */ farEnd: number};

const G = 9.8;
const frac = (v: number) => v - Math.floor(v);
function unit(seed: number, k: number): number {
    return frac(Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453);
}

/** A pivot's hold: under a limb its own point; on a limb's top the limb's underside (its hand round the limb). */
export function pivotOf(a: Anchor): Vec {
    return a.under ? {x: a.x, y: a.y, z: a.z} : {x: a.x, y: a.y - 0.08, z: a.z};
}

/** The closest a segment (x, z) comes to a point (m). */
function segDistance(ax: number, az: number, bx: number, bz: number, px: number, pz: number): number {
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.min(Math.max(((px - ax) * dx + (pz - az) * dz) / l2, 0), 1) : 0;
    return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}

/** The longest gap (m) a kind crosses between holds, by its way and its size. */
export function gapOf(kind: CanopyKind, length: number): number {
    if (kind.mode === "brachiate") return kind.slow ? Math.max(1.6, length * 1.6) : Math.min(Math.max(4.5, length * 6), 8);
    if (kind.mode === "leap") return Math.min(Math.max(4, length * 7), 9);
    return Math.min(Math.max(2.2, length * 4), 4);
}

/**
 * A route out from `home` through the crowns and back: up to `most` hops, each to a hold in another tree where one is
 * in reach (else across its own crown, clear of its own trunk), outward, within its gap, never more than a rise of 0.6 of the gap (or 1.5 m) up or down, up in the crowns (three
 * metres and more over the ground), its line clear of every other trunk. Then back the same way. Null when no
 * neighbour is in reach. `seed`: the animal's and the route's own (its hash), so each animal goes its own way.
 */
export function planRoute(home: Anchor, anchors: readonly Anchor[], trunks: readonly TrunkDisc[], kind: CanopyKind, length: number, seed: number, groundAt: (x: number, z: number) => number, most = 3): CanopyRoute | null {
    const gap = gapOf(kind, length);
    const chain: Anchor[] = [home];
    const used = new Set([home.id]);
    for (let k = 0; k < most; k++) {
        const at = chain[chain.length - 1];
        const ok = anchors.filter((b) => {
            if (used.has(b.id)) return false;
            if (kind.mode === "brachiate" && !b.under && b.ny < 0.6) return false;
            // (A leaper or a runner lands on a limb's top, never under it.)
            if (kind.mode !== "brachiate" && b.under) return false;
            const d = Math.hypot(b.x - at.x, b.z - at.z);
            if (d < (b.tree === at.tree ? 1.2 : 0.8) || d > gap) return false;
            // (Within its own crown too, from limb to limb, its line clear of its own trunk: a crown alone in its layer,
            // its neighbours' crowns far over or under it, is still swung and leapt through.)
            if (b.tree === at.tree) {
                const own = trunks.find((t) => t.tree === at.tree);
                if (own && segDistance(at.x, at.z, b.x, b.z, own.x, own.z) < own.r + 0.35) return false;
            }
            if (Math.abs(b.y - at.y) > Math.max(0.6 * d, 1.5)) return false;
            if (b.y < groundAt(b.x, b.z) + 3) return false;
            // Outward: further from home than where it is (the first hop: anywhere).
            if (k > 0 && Math.hypot(b.x - home.x, b.z - home.z) <= Math.hypot(at.x - home.x, at.z - home.z) + 0.3) return false;
            // Its line clear of every trunk but the two trees' own.
            for (const t of trunks) {
                if (t.tree === at.tree || t.tree === b.tree) continue;
                if (t.top < Math.min(at.y, b.y) - 1) continue;
                if (segDistance(at.x, at.z, b.x, b.z, t.x, t.z) < t.r + 0.35) return false;
            }
            return true;
        });
        if (!ok.length) break;
        // Its own choice among them (seeded), the longer crossings a little more likely.
        // (Another tree's crown first where one is in reach.)
        const scored = ok.map((b, i) => ({b, s: unit(seed, k * 31 + i) + 0.3 * Math.hypot(b.x - at.x, b.z - at.z) / gap + (b.tree === at.tree ? 0 : 1.5)})).sort((p, q) => q.s - p.s || p.b.id.localeCompare(q.b.id));
        const next = scored[0].b;
        chain.push(next);
        used.add(next.id);
    }
    if (chain.length < 2) return null;
    const reach = Math.max(length * 0.85, 0.35);
    const hops: Hop[] = [];
    let t = 0;
    const leg = (from: Anchor, to: Anchor) => {
        const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
        const style: Hop["style"] = kind.mode === "brachiate" ? "swing" : kind.mode === "leap" && d > 1.6 ? "leap" : from.tree === to.tree ? "run" : d > 1.2 ? "leap" : "run";
        let seconds: number;
        if (style === "swing") {
            // Half a pendulum's period on its hold (slower for a heavy slow swinger), then the flight across the rest.
            const swing = Math.PI * Math.sqrt(reach / G) * (kind.slow ? 2.2 : 1);
            // (The flight: from the release at the top of its swing to the catch behind the next hold, however short.)
            const dx = to.x - from.x;
            const dz = to.z - from.z;
            const l = Math.hypot(dx, dz) || 1;
            const h = {x: dx / l, y: 0, z: dz / l};
            const r = hanging(pivotOf(from), h, SWING, reach).centre;
            const c = hanging(pivotOf(to), h, -SWING, reach).centre;
            const across = Math.hypot(c.x - r.x, c.y - r.y, c.z - r.z);
            seconds = swing + (kind.slow ? across / 0.8 : across / 4.5) + 0.05;
        } else if (style === "leap") seconds = 0.45 + d / 6;
        else seconds = 0.3 + d / 2.4;
        hops.push({from, to, style, start: t, seconds, rise: style === "leap" ? 0.25 + 0.18 * d : style === "run" ? 0.05 + 0.08 * d : 0.15 + 0.05 * d});
        t += seconds;
        // A pause at a hold between leaps and runs (a look round, a bite); a swinger keeps its momentum.
        if (style !== "swing") t += 0.8 + 1.2 * unit(seed, hops.length + 101);
    };
    for (let i = 1; i < chain.length; i++) leg(chain[i - 1], chain[i]);
    // At the far end: a while there (feeding: hanging by an arm, or by its tail), then home the same way.
    t += 3 + 3 * unit(seed, 977);
    const farEnd = t;
    for (let i = chain.length - 1; i > 0; i--) leg(chain[i], chain[i - 1]);
    return {kind, length, reach, hops, seconds: t + FROM_HOLD + TO_HOLD, home, farEnd};
}

/** The swing's half angle (rad) either side of hanging straight down. */
export const SWING = (55 * Math.PI) / 180;
/** From sitting on its hold to hanging (or setting off) and back at the end (s). */
export const FROM_HOLD = 0.8;
export const TO_HOLD = 0.9;

// MARK: - Where it is

export type CanopyPose = {
    /** The body's middle. */
    centre: Vec;
    /** Its back's way (the body's up) and its head's way (unit, square to each other). */
    up: Vec;
    forward: Vec;
    /** The hand (or the tail) holding now, at its hold; null in the air or on top of a limb. */
    hand: Vec | null;
    /** In the air between holds. */
    air: boolean;
    /** Swinging under a hold, leaping, running along, or at a hold (feeding). */
    phase: "swing" | "flight" | "leap" | "run" | "hold";
    /** The share of the excursion's ease in from its sitting pose (0 → 1) and out to it at the end (1 → 0). */
    blend: number;
};

const norm = (v: Vec): Vec => {
    const l = Math.hypot(v.x, v.y, v.z) || 1;
    return {x: v.x / l, y: v.y / l, z: v.z / l};
};
const cross = (a: Vec, b: Vec): Vec => ({x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x});
const ease = (t: number) => {
    const k = Math.min(Math.max(t, 0), 1);
    return k * k * (3 - 2 * k);
};

/** The way across (level, unit) from one hold to the next. */
function across(hop: Hop): Vec {
    const dx = hop.to.x - hop.from.x;
    const dz = hop.to.z - hop.from.z;
    const l = Math.hypot(dx, dz) || 1;
    return {x: dx / l, y: 0, z: dz / l};
}

/** Hanging from `pivot` at angle `phi` (forward along `h` positive): the body's middle, up and forward. */
function hanging(pivot: Vec, h: Vec, phi: number, reach: number): {centre: Vec; up: Vec; forward: Vec} {
    const centre = {x: pivot.x + h.x * Math.sin(phi) * reach, y: pivot.y - Math.cos(phi) * reach, z: pivot.z + h.z * Math.sin(phi) * reach};
    // Head toward the hand; its back away from the way it goes (its belly leads).
    const forward = norm({x: pivot.x - centre.x, y: pivot.y - centre.y, z: pivot.z - centre.z});
    const side = norm(cross(h, {x: 0, y: 1, z: 0}));
    const up = norm(cross(forward, side));
    return {centre, up: up.x * h.x + up.z * h.z > 0 ? {x: -up.x, y: -up.y, z: -up.z} : up, forward};
}

/** Sitting on (or hanging at) a hold: its pose there. */
function atHold(a: Anchor, h: Vec, route: CanopyRoute, tail: boolean, phi = -SWING): {centre: Vec; up: Vec; forward: Vec; hand: Vec | null} {
    if (route.kind.mode === "brachiate" || (tail && !a.under)) {
        // Hanging under it (a swinger by its arm; a prehensile tail by its tail, upside down, feeding).
        const p = pivotOf(a);
        if (tail && route.kind.mode !== "brachiate") {
            const centre = {x: p.x, y: p.y - route.reach * 0.9, z: p.z};
            return {centre, up: h, forward: {x: 0, y: -1, z: 0}, hand: p};
        }
        const hang = hanging(p, h, phi, route.reach);
        return {...hang, hand: p};
    }
    const n = norm({x: a.nx, y: a.ny, z: a.nz});
    const d = h.x * n.x + h.y * n.y + h.z * n.z;
    const forward = norm({x: h.x - d * n.x, y: h.y - d * n.y, z: h.z - d * n.z});
    const lift = route.length * 0.18;
    return {centre: {x: a.x + n.x * lift, y: a.y + n.y * lift, z: a.z + n.z * lift}, up: n, forward, hand: null};
}

/**
 * Its pose `t` seconds into its route (0 … route.seconds), or null outside it. A swinger hangs from its first hold,
 * swings, lets go and catches the next; a leaper crouches, leaps on its arc and lands; a runner runs along and bounds;
 * at the far end it holds a while; then home the same way and back up onto its hold.
 */
export function canopyPoseAt(route: CanopyRoute, t: number): CanopyPose | null {
    if (t < 0 || t > route.seconds) return null;
    const hops = route.hops;
    const first = hops[0];
    const last = hops[hops.length - 1];
    const tail = route.kind.tail;
    // Into it: from sitting on its hold to its first move.
    if (t < FROM_HOLD) {
        const h = across(first);
        const hold = atHold(first.from, h, route, false);
        return {...hold, air: false, phase: "hold", blend: ease(t / FROM_HOLD)};
    }
    const s = t - FROM_HOLD;
    const end = last.start + last.seconds;
    if (s >= end) {
        const h = across(last);
        const hold = atHold(last.to, h, route, false);
        return {...hold, air: false, phase: "hold", blend: 1 - ease((s - end) / TO_HOLD)};
    }
    let hop = hops.findIndex((p) => s < p.start + p.seconds);
    if (hop < 0) hop = hops.length - 1;
    const p = hops[hop];
    const h = across(p);
    if (s < p.start) {
        // Between hops: at the hold it came to (the far end's long hold among them).
        const prev = hops[hop - 1] ?? p;
        // (At the far end it feeds there: a prehensile tail hangs it under its hold.)
        const feeding = p.start >= route.farEnd - 1e-6 && prev.start < route.farEnd;
        if (route.kind.mode === "brachiate") {
            // A swinger hangs on there, swinging slowly through under its hand from where it caught it to where it sets
            // off back (the way it came: behind it then is ahead of it now).
            const held = prev.start + prev.seconds;
            const k = Math.min(Math.max((s - held) / Math.max(p.start - held, 1e-6), 0), 1);
            const hold = atHold(p.from, across(prev), route, false, -SWING * Math.cos(Math.PI * k));
            return {...hold, air: false, phase: "hold", blend: 1};
        }
        if (feeding && tail) {
            // Down off its hold to hang by its tail and feed, and back up onto it before it sets off home (eased).
            const held = prev.start + prev.seconds;
            const k = Math.min(Math.max((s - held) / Math.max(p.start - held, 1e-6), 0), 1);
            const w = ease(Math.min(k / 0.2, (1 - k) / 0.2, 1));
            const sit = atHold(p.from, across(prev), route, false);
            const hang = atHold(p.from, across(prev), route, true);
            const lerp = (a: Vec, b: Vec) => ({x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w, z: a.z + (b.z - a.z) * w});
            const up = norm(lerp(sit.up, hang.up));
            let forward = norm(lerp(sit.forward, hang.forward));
            const d = forward.x * up.x + forward.y * up.y + forward.z * up.z;
            forward = norm({x: forward.x - d * up.x, y: forward.y - d * up.y, z: forward.z - d * up.z});
            return {centre: lerp(sit.centre, hang.centre), up, forward, hand: w > 0.5 ? hang.hand : null, air: false, phase: "hold", blend: 1};
        }
        const hold = atHold(p.from, across(prev), route, false);
        return {...hold, air: false, phase: "hold", blend: 1};
    }
    const k = Math.min(Math.max((s - p.start) / p.seconds, 0), 1);
    if (p.style === "swing") {
        // Straight on from a catch (no pause between): its swing turns from the way it came to the way it goes next.
        const prev = hops[hop - 1];
        const from = prev && prev.style === "swing" && Math.abs(prev.start + prev.seconds - p.start) < 1e-6 ? across(prev) : h;
        return swingPose(route, p, k, h, from);
    }
    // A leap or a run along: a ballistic arc from the hold's top to the next, the body along its way, pitched to it.
    const a = atHold(p.from, h, route, false);
    const b = atHold(p.to, h, route, false);
    const crouch = p.style === "leap" ? 0.12 : 0;
    const u = crouch ? Math.min(Math.max((k - crouch) / (1 - 2 * crouch), 0), 1) : k;
    // (Crouched for the spring, and down on the next hold: sitting on it.)
    if (u <= 0) return {...a, air: false, phase: "hold", blend: 1};
    if (u >= 1) return {...b, air: false, phase: "hold", blend: 1};
    const centre = {x: a.centre.x + (b.centre.x - a.centre.x) * u, y: a.centre.y + (b.centre.y - a.centre.y) * u + 4 * p.rise * u * (1 - u), z: a.centre.z + (b.centre.z - a.centre.z) * u};
    const vy = b.centre.y - a.centre.y + 4 * p.rise * (1 - 2 * u);
    const flat = Math.hypot(b.centre.x - a.centre.x, b.centre.z - a.centre.z) || 1;
    let forward = norm({x: h.x * flat, y: vy * 0.6, z: h.z * flat});
    const side = norm(cross({x: 0, y: 1, z: 0}, forward));
    let up = norm(cross(forward, side));
    // (Off one hold's surface and onto the next one's: its back turns to each hold's normal at each end.)
    const edge = Math.min(u, 1 - u) / 0.2;
    if (edge < 1) {
        const w = 1 - ease(edge);
        const n = u < 0.5 ? a.up : b.up;
        up = norm({x: up.x + (n.x - up.x) * w, y: up.y + (n.y - up.y) * w, z: up.z + (n.z - up.z) * w});
    }
    // (A run along one tree's limbs keeps to the wood; a bound from one tree to the next is in the air, as a leap is.)
    const fd = forward.x * up.x + forward.y * up.y + forward.z * up.z;
    forward = norm({x: forward.x - fd * up.x, y: forward.y - fd * up.y, z: forward.z - fd * up.z});
    const air = u > 0 && u < 1 && (p.style === "leap" || p.from.tree !== p.to.tree);
    return {centre, up, forward, hand: null, air, phase: p.style === "leap" ? (air ? "leap" : "hold") : "run", blend: 1};
}

/** Arm over arm: on its hold from behind to ahead (a pendulum's half period), then across to the next hold's catch. */
function swingPose(route: CanopyRoute, p: Hop, k: number, h: Vec, from: Vec = h): CanopyPose {
    const reach = route.reach;
    const swing = Math.PI * Math.sqrt(reach / G) * (route.kind.slow ? 2.2 : 1);
    const share = Math.min(swing / p.seconds, 1);
    const pa = pivotOf(p.from);
    const pb = pivotOf(p.to);
    if (k <= share) {
        // A pendulum: fastest at the bottom (its angle a cosine in time), from -SWING behind to +SWING ahead.
        const phi = -SWING * Math.cos(Math.PI * (k / share));
        const w = ease(k / share);
        // (Turned about its hand: the swing's plane comes round through the angle between, even right round.)
        const a0 = Math.atan2(from.x, from.z);
        let da = Math.atan2(h.x, h.z) - a0;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        const turn = {x: Math.sin(a0 + da * w), y: 0, z: Math.cos(a0 + da * w)};
        const hang = hanging(pa, turn, phi, reach);
        return {...hang, hand: pa, air: false, phase: "swing", blend: 1};
    }
    // Let go at the top of the swing; across on a ballistic arc to where it catches the next hold from behind.
    const release = hanging(pa, h, SWING, reach);
    const caught = hanging(pb, h, -SWING, reach);
    const u = (k - share) / (1 - share);
    const centre = {x: release.centre.x + (caught.centre.x - release.centre.x) * u, y: release.centre.y + (caught.centre.y - release.centre.y) * u + 4 * p.rise * u * (1 - u), z: release.centre.z + (caught.centre.z - release.centre.z) * u};
    // Its body turns from the release's lean to the catch's across the flight.
    const w = ease(u);
    const forward = norm({x: release.forward.x + (caught.forward.x - release.forward.x) * w, y: release.forward.y + (caught.forward.y - release.forward.y) * w, z: release.forward.z + (caught.forward.z - release.forward.z) * w});
    const side = norm(cross(h, {x: 0, y: 1, z: 0}));
    let up = norm(cross(forward, side));
    if (up.x * h.x + up.z * h.z > 0) up = {x: -up.x, y: -up.y, z: -up.z};
    return {centre, up, forward, hand: null, air: true, phase: "flight", blend: 1};
}

// MARK: - When

/** Of a stay this long (s) at a hold, whether (and when, s after it arrives) its excursion runs: its id's and slot's own. */
export function excursionStart(route: CanopyRoute, seed: number, slot: number, stay: number): number | null {
    const slack = stay - route.seconds - 4;
    if (slack < 0) return null;
    const share = route.kind.mode === "run" ? 0.45 : 0.7;
    if (unit(seed, slot * 7 + 3) > share) return null;
    return 2 + slack * unit(seed, slot * 7 + 5);
}
