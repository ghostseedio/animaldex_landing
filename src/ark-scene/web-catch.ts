/**
 * A catch in a spider's web, acted (lane ARK-WEBS; the owner 2026-11-23: "can cobwebs actually catch flies and the
 * spiders are shown eating them like how they would in the wild", then "not just flies, insects"). Pure: a function of
 * the web's geometry, the seed and the seconds since the catch began, so every viewer sees the same.
 *
 * As a web-building spider takes its prey (Foelix, Biology of Spiders, 3rd ed. 2011, ch. 5, "Prey capture"; Robinson &
 * Robinson 1976 on Argiope's attack sequence; Eberhard 1990, Annu. Rev. Ecol. Syst. 21: 341):
 *
 *   1. the insect flies or walks into the silk and is held, struggling; the web shakes with it;
 *   2. the spider, feeling the threads from its hub (or its retreat, along the signal thread), runs out to it;
 *   3. a bite (orb weavers often wrap first and bite through the silk; cobweb spiders fling silk with their hind legs
 *      first: the drawn order is one bite, then the wrap, which reads at any distance);
 *   4. the wrap: the prey turned over and over in the spider's legs as silk is drawn from its spinnerets, until it is a
 *      white bundle;
 *   5. the bundle cut free and carried back to the hub (or the retreat) on a thread, where it feeds.
 *
 * Who uses it: only the record's catch (`hunt-acts.ts` runWeb: a `meal` the engine decided, whose hunter is a web
 * spider with its web drawn, its prey a real animal aboard). Never a catch of its own (the owner, 2026-11-23: "no fake
 * events").
 */

export type V3 = {x: number; y: number; z: number};

/** Where a catch happens on a web: its hub, the point the insect is held at, the web's face (normal) and the way in. */
export type CatchGeometry = {hub: V3; at: V3; normal: V3; /** The spider's head way at the hub (orb: down). */ rest: V3; /** The prey's length (m), for its silk bundle. */ preyLength?: number};

/** The catch's moments (s from its start). */
export type CatchTimes = {stuck: number; run: number; bite: number; wrap: number; haul: number; home: number; feedTo: number};

export const RUN_PACE = 0.35;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const smooth = (t: number) => {
    const c = clamp(t, 0, 1);
    return c * c * (3 - 2 * c);
};
const sub = (a: V3, b: V3): V3 => ({x: a.x - b.x, y: a.y - b.y, z: a.z - b.z});
const lerp3 = (a: V3, b: V3, t: number): V3 => ({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t});
const len = (a: V3) => Math.hypot(a.x, a.y, a.z);
const norm = (a: V3): V3 => {
    const l = len(a) || 1;
    return {x: a.x / l, y: a.y / l, z: a.z / l};
};
const cross = (a: V3, b: V3): V3 => ({x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x});

/** A seeded unit number for a key. */
export function unitOf(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 100000) / 100000;
}

/** The moments of a catch at this web (the run out and back at the spider's pace over the silk). */
export function catchTimes(g: CatchGeometry, seed: string, feedFor = 20): CatchTimes {
    const d = len(sub(g.at, g.hub));
    const runFor = clamp(d / RUN_PACE, 0.35, 1.4);
    const stuck = 1.1;
    const run = stuck + 1.6 + 1.2 * unitOf(`${seed}#feel`);
    const bite = run + runFor;
    const wrap = bite + 0.55;
    const haul = wrap + 2.2;
    const home = haul + runFor * 1.5;
    return {stuck, run, bite, wrap, haul, home, feedTo: home + feedFor};
}

export type CatchFrame = {
    /** The spider: its feet's point, its back's way (the web's face), its head's way. */
    spider: V3 & {nx: number; ny: number; nz: number; tx: number; ty: number; tz: number; state: "rest" | "run" | "bite" | "wrap" | "eat"};
    /** The insect: where it is, flying in or held; its struggle (0-1); hidden once it is all silk. */
    prey: V3 & {struggle: number; flying: boolean; hidden: boolean; spin: number};
    /** The silk bundle: where, and how far wrapped (0: none, 1: a white bundle). */
    bundle: (V3 & {size: number}) | null;
    /** How hard the web shakes (0-1). */
    shake: number;
    /** The phase (for the card and the tests). */
    phase: "in" | "stuck" | "run" | "bite" | "wrap" | "haul" | "feed" | "done";
};

/**
 * The catch `t` seconds in. `miss`: the insect breaks free as the spider comes (it never reaches it) and flies off.
 */
export function catchAt(g: CatchGeometry, times: CatchTimes, seed: string, t: number, miss = false): CatchFrame {
    const n = norm(g.normal);
    const side = norm(cross(n, Math.abs(n.y) > 0.9 ? {x: 1, y: 0, z: 0} : {x: 0, y: 1, z: 0}));
    const s0 = unitOf(`${seed}#in`) < 0.5 ? -1 : 1;
    // In from in front of the web or behind it, a little from the side.
    const from: V3 = {x: g.at.x + n.x * 0.45 * s0 + side.x * 0.25, y: g.at.y + 0.08 + n.y * 0.45 * s0, z: g.at.z + n.z * 0.45 * s0 + side.z * 0.25};
    const toAt = norm(sub(g.at, g.hub));
    const head = (dir: V3) => ({nx: n.x, ny: n.y, nz: n.z, tx: dir.x, ty: dir.y, tz: dir.z});
    const atHub = {...g.hub, ...head(norm(g.rest))};
    let shake = 0;
    if (t >= times.stuck && t < times.bite) shake = 0.55 + 0.45 * Math.abs(Math.sin(t * 9.3)) * (1 - 0.4 * smooth((t - times.stuck) / 2));
    else if (t >= times.bite && t < times.haul) shake = 0.25 * (1 - smooth((t - times.bite) / (times.haul - times.bite)));
    // 1. In, and held.
    if (t < times.stuck) {
        const k = smooth(t / times.stuck);
        const p = lerp3(from, g.at, k);
        return {spider: {...atHub, state: "rest"}, prey: {...p, y: p.y + Math.sin(k * Math.PI) * 0.05, struggle: 0, flying: true, hidden: false, spin: 0}, bundle: null, shake: 0, phase: "in"};
    }
    const struggle = (u: number) => 0.5 + 0.5 * Math.abs(Math.sin(u * 13.1 + unitOf(seed) * 6));
    if (t < times.run) return {spider: {...atHub, state: "rest"}, prey: {...g.at, struggle: struggle(t), flying: false, hidden: false, spin: 0}, bundle: null, shake, phase: "stuck"};
    // 2. Out along the silk.
    const reach = Math.max(len(sub(g.at, g.hub)) - 0.012, 0);
    const near = {x: g.hub.x + toAt.x * reach, y: g.hub.y + toAt.y * reach, z: g.hub.z + toAt.z * reach};
    if (miss) {
        // It breaks free as the spider comes: away, and the spider stops short and goes back.
        const k = (t - times.run) / Math.max(times.bite - times.run, 0.1);
        const out = lerp3(g.hub, near, smooth(Math.min(k, 0.7) / 0.7) * 0.7);
        const back = lerp3(out, g.hub, smooth((k - 1.2) / 1.2));
        const free = Math.max(t - (times.run + (times.bite - times.run) * 0.6), 0);
        const away = {x: g.at.x - n.x * free * 0.6 * s0 + side.x * free * 0.3, y: g.at.y + free * 0.35, z: g.at.z - n.z * free * 0.6 * s0 + side.z * free * 0.3};
        return {spider: {...(k < 1.2 ? out : back), ...head(k < 1.2 ? toAt : norm(g.rest)), state: k < 0.7 ? "run" : "rest"}, prey: {...(free > 0 ? away : g.at), struggle: free > 0 ? 0 : struggle(t), flying: free > 0, hidden: free > 3, spin: 0}, bundle: null, shake: free > 0 ? 0 : shake, phase: free > 0 ? "done" : "stuck"};
    }
    if (t < times.bite) {
        const k = smooth((t - times.run) / (times.bite - times.run));
        return {spider: {...lerp3(g.hub, near, k), ...head(toAt), state: "run"}, prey: {...g.at, struggle: struggle(t), flying: false, hidden: false, spin: 0}, bundle: null, shake, phase: "run"};
    }
    // 3. The bite.
    if (t < times.wrap) return {spider: {...near, ...head(toAt), state: "bite"}, prey: {...g.at, struggle: struggle(t) * 0.6, flying: false, hidden: false, spin: 0}, bundle: null, shake, phase: "bite"};
    // 4. The wrap: the prey turned in its legs, the silk building to a white bundle.
    if (t < times.haul) {
        const k = (t - times.wrap) / (times.haul - times.wrap);
        const a = k * Math.PI * 5;
        const r = 0.006;
        const turn = {x: side.x * Math.cos(a) + toAt.x * Math.sin(a), y: side.y * Math.cos(a) + toAt.y * Math.sin(a), z: side.z * Math.cos(a) + toAt.z * Math.sin(a)};
        return {spider: {x: near.x + turn.x * r, y: near.y + turn.y * r, z: near.z + turn.z * r, ...head(toAt), state: "wrap"}, prey: {...g.at, struggle: 0.25 * (1 - k), flying: false, hidden: k > 0.85, spin: k * Math.PI * 6}, bundle: {...g.at, size: smooth(k / 0.9)}, shake, phase: "wrap"};
    }
    // 5. Back to the hub with it, and feeding there.
    if (t < times.home) {
        const k = smooth((t - times.haul) / (times.home - times.haul));
        const p = lerp3(near, g.hub, k);
        const b = lerp3(g.at, {x: g.hub.x + toAt.x * 0.012, y: g.hub.y + toAt.y * 0.012, z: g.hub.z + toAt.z * 0.012}, k);
        return {spider: {...p, ...head({x: -toAt.x, y: -toAt.y, z: -toAt.z}), state: "run"}, prey: {...b, struggle: 0, flying: false, hidden: true, spin: 0}, bundle: {...b, size: 1}, shake: 0, phase: "haul"};
    }
    const b = {x: g.hub.x + toAt.x * 0.012, y: g.hub.y + toAt.y * 0.012, z: g.hub.z + toAt.z * 0.012};
    const eating = t < times.feedTo;
    const left = eating ? 1 : 1 - smooth((t - times.feedTo) / 3);
    return {spider: {...g.hub, ...head(toAt), state: eating ? "eat" : "rest"}, prey: {...b, struggle: 0, flying: false, hidden: true, spin: 0}, bundle: left > 0.01 ? {...b, size: left} : null, shake: 0, phase: eating ? "feed" : "done"};
}
