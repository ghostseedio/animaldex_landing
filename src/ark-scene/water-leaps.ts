/**
 * Leaps out of the water (lane ARK-FISH, owner 2026-11-23: "can fish that typically jump out the water, jump out the
 * water? if not - implement it"). A mullet leaping clear, a tarpon's silver jump, an eagle ray launching itself several
 * times in a row, a flyingfish gliding, a dusky dolphin's twisting leap, a spinner dolphin's spin, a Commerson's dolphin
 * rolling at the surface, a southern right whale holding its flukes up in the wind ("sailing").
 *
 * - **Only the kinds whose own stored text says so** (`water-leaps.json`: the quote and its field). A leap the text ties to
 *   a catch or to being hooked is not here: a leap never implies a meal (owner, 2026-11-23: "never imply a catch unless
 *   it's real"). Behaviour, not an event: nothing is decided, logged as a meal or changed in the bars.
 * - **No fixed timers.** A flow in the behaviour-flows grammar (`docs/ark/behaviour-flows.md`, lane ARK-FLOWS): per
 *   engine tick (the Ark day, `FLOW_TICK_SECONDS`) a seeded number of bouts round the kind's mean, each a burst of leaps,
 *   seeded by the animal's id and the tick, so every viewer sees the same leap at the same moment.
 * - **Physics.** Time in the air is a ballistic arc's: 2·√(2h/g) for its apex h. Apexes are estimates from the body's
 *   length (flagged in the table's `about`).
 *
 * Pure: no three.js. The scene (`index.ts`) lays `leapPose` over the animal's swimming pose and spreads the rings.
 */

import {hash32} from "@/lib/ark-clock";
import table from "@/ark-scene/water-leaps.json";

/** The engine's day in seconds: one Ark year in 14 real days (`flows.ts` FLOW_TICK_SECONDS, `ark-clock.ts` ARK_DAY_MS). */
export const LEAP_TICK_SECONDS = (86_400 * 14) / 365;

export type LeapStyle = "leap" | "glide" | "twist" | "spin" | "roll" | "sail" | "falls";

export type LeapSpec = {style: LeapStyle; perTick: number; burst: [number, number]; quote: string; field: string};

const SPECS = (table as unknown as {species: Record<string, [LeapStyle, number, [number, number], string, string]>}).species;

/** Its kind's leaps, or null: a kind whose text does not say it leaves the water never does. */
export function leapSpec(slug: string | null | undefined): LeapSpec | null {
    const row = slug ? SPECS[slug] : undefined;
    return row ? {style: row[0], perTick: row[1], burst: row[2], quote: row[3], field: row[4]} : null;
}

const HELD = (table as unknown as {held?: Record<string, string>}).held ?? {};

/** Its kind's leaps as the scene shows them: a kind held back (`held` in the table: not yet seen right in the pictures) is not. */
export function leapShown(slug: string | null | undefined): LeapSpec | null {
    return slug && Object.prototype.hasOwnProperty.call(HELD, slug) ? null : leapSpec(slug);
}

export function leapKinds(): string[] {
    return Object.keys(SPECS);
}

/** A step of the flow grammar (`flows.ts` FlowStep), its leap's shape in `detail`. Epoch seconds. */
export type LeapStep = {
    kind: "leap";
    from: number;
    to: number;
    pose: "air" | "moving";
    style: LeapStyle;
    /** Apex over the surface (m, true size): 0 for a roll or a sail. */
    apex: number;
    /** Seconds from `from` it breaks the surface, and from `from` it is back in. */
    out: number;
    back: number;
    /** Whole turns about its length in the air (spin, twist). */
    turns: number;
    /** A glide's run over the water (m, true size). */
    run: number;
    /**
     * A glide's tail-tap (s from `from`; 0 for none): half way along it drops to the water, the long lower lobe of its tail
     * in it, sculls and is off again on the same spread pectorals (SEA-VISIBLE).
     */
    tap: number;
    /** The first of its bout (the live log says a bout once). */
    first: boolean;
};

const G = 9.81;
/**
 * A flyingfish's glide (SEA-VISIBLE; estimates, flagged): it leaves the water at about 10 m/s and glides low, about a metre
 * over it (Davenport 1994, "How and why do flying fish fly?", Rev. Fish Biol. Fish. 4: 184-214); a glide can be stretched
 * by "taxiing", the lower lobe of the tail beating in the water while the body is held out (its stored trait: "Lower lobe
 * of the tail fin longer than the upper").
 */
export const GLIDE_SPEED = 10;
export const GLIDE_BURST = 0.3;
export const GLIDE_TAP = 0.5;
/** Up from its depth to the surface (a burst of speed), and down again after re-entry (s). */
const RISE = 1.6;
const SINK = 1.1;

function rng(...parts: Array<string | number>): () => number {
    let s = hash32(...parts) || 1;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A Poisson draw (inverse transform), capped. */
function poisson(random: () => number, mean: number, cap = 12): number {
    let n = 0;
    let p = Math.exp(-mean);
    let sum = p;
    const u = random();
    while (u > sum && n < cap) {
        n++;
        p *= mean / n;
        sum += p;
    }
    return n;
}

function airTime(apex: number): number {
    return 2 * Math.sqrt((2 * Math.max(apex, 0.05)) / G);
}

/** One leap's shape from its style and true length (m). Estimates: apexes from body length. */
function shape(style: LeapStyle, length: number, random: () => number): Omit<LeapStep, "kind" | "from" | "to" | "pose" | "style" | "first"> {
    const L = Math.max(length, 0.15);
    const jitter = 0.8 + random() * 0.4;
    switch (style) {
        case "leap":
        case "falls": {
            const apex = Math.min(Math.max(L * 0.9, 0.35), 2.5) * jitter;
            const air = airTime(apex);
            return {apex, out: RISE, back: RISE + air, turns: 0, run: 0, tap: 0};
        }
        case "twist":
        case "spin": {
            const apex = Math.min(Math.max(L * (style === "spin" ? 1.4 : 1.1), 0.8), 3) * jitter;
            const air = airTime(apex);
            return {apex, out: RISE, back: RISE + air, turns: style === "spin" ? 2 + Math.floor(random() * 3) : 0.5 + random() * 0.5, run: 0, tap: 0};
        }
        case "glide": {
            // "commonly for tens of metres": 10–40 m at about 10 m/s, low over the water (half a metre to a metre and a
            // bit), one tail-tap on the way: out, a long glide, the tap, a shorter glide on, back in.
            const run = 10 + random() * 30;
            const gliding = run / GLIDE_SPEED;
            const first = gliding * (0.55 + random() * 0.15);
            const apex = Math.min(Math.max(L * 4, 0.5), 1.2) * jitter;
            const tap = RISE + GLIDE_BURST + first;
            return {apex, out: RISE, back: tap + GLIDE_TAP + (gliding - first), turns: 0, run, tap};
        }
        case "roll": {
            // Its back breaks the surface as it turns over: no air under it.
            return {apex: 0, out: RISE, back: RISE + 1.2 + random() * 0.6, turns: 0.25 + random() * 0.25, run: 0, tap: 0};
        }
        case "sail": {
            // "for long periods": one to four minutes, flukes up.
            const hold = 60 + random() * 180;
            return {apex: 0, out: 6, back: 6 + hold, turns: 0, run: 0, tap: 0};
        }
    }
}

const memo = new Map<string, LeapStep[]>();

/** Its leaps through one engine tick, in order. Remembered (the last 400 read). */
export function leapsInTick(id: string, slug: string, length: number, tick: number): LeapStep[] {
    const spec = leapSpec(slug);
    if (!spec) return [];
    const key = `${id}|${tick}`;
    const known = memo.get(key);
    if (known) return known;
    const random = rng("water-leap", id, tick);
    const start = tick * LEAP_TICK_SECONDS;
    const bouts = poisson(random, spec.perTick);
    const starts = Array.from({length: bouts}, () => start + random() * (LEAP_TICK_SECONDS - 120)).sort((a, b) => a - b);
    const steps: LeapStep[] = [];
    let free = start;
    for (const at of starts) {
        let t = Math.max(at, free);
        const n = spec.burst[0] + Math.floor(random() * (spec.burst[1] - spec.burst[0] + 1));
        for (let i = 0; i < n; i++) {
            const s = shape(spec.style, length, random);
            // (A glide's run is eased away under water over 5 s, as it swims on hard: never a jump back.)
            const to = t + s.back + (spec.style === "glide" ? 5 : SINK);
            steps.push({kind: "leap", from: t, to, pose: s.apex > 0 ? "air" : "moving", style: spec.style, first: i === 0, ...s});
            // The next of the bout after a few strokes under water (1.5–4 s).
            t = to + 1.5 + random() * 2.5;
        }
        free = t + 20;
    }
    const inTick = steps.filter((s) => s.to <= start + LEAP_TICK_SECONDS);
    memo.set(key, inTick);
    if (memo.size > 400) memo.delete(memo.keys().next().value as string);
    return inTick;
}

/** The leap it is in at a moment (epoch s), or null. */
export function leapAt(id: string, slug: string, length: number, epoch: number): LeapStep | null {
    const tick = Math.floor(epoch / LEAP_TICK_SECONDS);
    for (const step of leapsInTick(id, slug, length, tick)) if (step.from <= epoch && epoch < step.to) return step;
    return null;
}

/** The bouts that begin in [from, to) (epoch s): the live log's lines. */
export function leapBoutsIn(id: string, slug: string, length: number, from: number, to: number): LeapStep[] {
    const out: LeapStep[] = [];
    for (let tick = Math.floor(from / LEAP_TICK_SECONDS); tick <= Math.floor(to / LEAP_TICK_SECONDS); tick++) {
        for (const step of leapsInTick(id, slug, length, tick)) if (step.first && step.from >= from && step.from < to) out.push(step);
    }
    return out;
}

export type LeapPose = {
    /** Its base (the model's foot) in world height. */
    base: number;
    /** Nose down positive (rad). */
    pitch: number;
    roll: number;
    /** Ahead along its heading (m, drawn size): a glide's run, eased away again under water. */
    ahead: number;
    /** Out of the water now (its splash rings start at `out` and `back`). */
    airborne: boolean;
    /** How far into a sail's hold (0…1): the camera and its card then frame what is out of the water. */
    hold: number;
};

/**
 * The body as drawn, for a sail: its model origin over its base, its tail's tip from the origin along its length (m), and
 * which end its tail is at (-1: -z, as the scene's swimmers face +z; +1: a model made facing the other way).
 */
export type LeapBody = {pivotUp: number; tail: number; tailAt: 1 | -1};

/**
 * Which end of a model its tail is at, from its shape: the narrower of the two bands 15–30% in from either end (a whale's
 * or a fish's tail stock against its head). Positions as x, y, z triples, z its length.
 */
export function tailEnd(positions: ArrayLike<number>): {tailAt: 1 | -1; tail: number} {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 2; i < positions.length; i += 3) {
        lo = Math.min(lo, positions[i]);
        hi = Math.max(hi, positions[i]);
    }
    const span = Math.max(hi - lo, 1e-6);
    let back = 0;
    let front = 0;
    for (let i = 0; i + 2 < positions.length; i += 3) {
        const u = (positions[i + 2] - lo) / span;
        const wide = Math.abs(positions[i]);
        if (u > 0.15 && u < 0.3) back = Math.max(back, wide);
        else if (u > 0.7 && u < 0.85) front = Math.max(front, wide);
    }
    return front < back ? {tailAt: 1, tail: Math.max(hi, 0)} : {tailAt: -1, tail: Math.max(-lo, 0)};
}

/** Up out of the water a sail holds the tail (m over the surface, its tip): the tail stock and the flukes, a quarter of its length. */
export const SAIL_TAIL_OUT = 0.26;
/** Head down, near upright (rad, nose down). */
export const SAIL_PITCH = 1.3;

/** Where a sailing body's tail tip is (relative to its x, z; world up), its pose's origin at `base + pivotUp`. */
export function sailTail(pose: {base: number; pitch: number; yaw: number}, body: LeapBody): {dx: number; dz: number; y: number} {
    const along = body.tailAt * body.tail * Math.cos(pose.pitch);
    return {dx: along * Math.sin(pose.yaw), dz: along * Math.cos(pose.yaw), y: pose.base + body.pivotUp - body.tailAt * body.tail * Math.sin(pose.pitch)};
}

/** A glide's beats (s after it breaks out), with its height over the water (a share of its apex), pitch and speed share. */
function glideBeats(step: LeapStep): Array<[number, number, number, number]> {
    const first = step.tap - step.out - GLIDE_BURST;
    const second = step.back - step.tap - GLIDE_TAP;
    const b = GLIDE_BURST;
    // [time, height share (-1: half under), pitch (nose down +), speed share]
    return [
        [0, -1, -0.55, 1],
        [b, 1, -0.12, 1],
        [b + first * 0.5, 0.85, -0.04, 0.97],
        [b + first, 0.25, -0.02, 0.92],
        // The tap: down to the water, nose up, the lower lobe in it, sculling.
        [b + first + GLIDE_TAP * 0.35, -0.35, -0.38, 0.6],
        [b + first + GLIDE_TAP, 0.15, -0.3, 0.75],
        [b + first + GLIDE_TAP + second * 0.3, 0.7, -0.06, 0.95],
        [b + first + GLIDE_TAP + second * 0.85, 0.3, 0.02, 0.9],
        // Back in: the fins folded, nose first.
        [b + first + GLIDE_TAP + second, -1, 0.45, 0.8]
    ];
}

/** A glide's height share, pitch and how far along (m, true) `t` s after it breaks out. */
function glideAt(step: LeapStep, t: number): {height: number; pitch: number; ahead: number} {
    const beats = glideBeats(step);
    let ahead = 0;
    for (let i = 1; i < beats.length; i++) {
        const [t0, h0, p0, v0] = beats[i - 1];
        const [t1, h1, p1, v1] = beats[i];
        const span = Math.max(t1 - t0, 1e-6);
        if (t <= t1 || i === beats.length - 1) {
            const k = clamp01((t - t0) / span);
            const e = ease(k);
            ahead += GLIDE_SPEED * (v0 * k + (v1 - v0) * k * k * 0.5) * span;
            return {height: lerp(h0, h1, e), pitch: lerp(p0, p1, e), ahead};
        }
        ahead += GLIDE_SPEED * (v0 + v1) * 0.5 * span;
    }
    return {height: -1, pitch: 0, ahead};
}

/** How far a glide carries it in all (m, true): where it is when back in. */
export function glideRun(step: LeapStep): number {
    return glideAt(step, step.back - step.out).ahead;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * Its pose `t` seconds into a leap, laid over where it swims (`swimBase`, its base there), at the surface `surface`,
 * drawn `height` tall and `length` long, `scale` its drawn size over its true size.
 */
export function leapPose(step: LeapStep, t: number, swimBase: number, surface: number, height: number, length: number, scale: number, body?: LeapBody): LeapPose {
    const half = surface - height * 0.5;
    const apex = step.apex * scale;
    if (step.style === "sail") {
        // Head down, near upright, the tail stock and flukes held up out of the water in the wind, the body just under:
        // in over `out` s, held, out over the sink. (SEA-VISIBLE: the drawn tail's tip a quarter of its length over the
        // surface, from where its model's origin and tail are; nothing showed with the old fixed depth.)
        const k = t < step.out ? ease(t / step.out) : t < step.back ? 1 : 1 - ease(clamp01((t - step.back) / Math.max(step.to - step.from - step.back, 0.1)));
        const sway = Math.sin(t * 0.35) * 0.05;
        // (Tail up: nose down for a model whose tail is at -z, the other way for one made facing back.)
        const pitch = (SAIL_PITCH + sway) * (body?.tailAt === 1 ? -1 : 1);
        const held = body ? surface + SAIL_TAIL_OUT * length - body.pivotUp - body.tail * Math.abs(Math.sin(pitch)) : surface - height * 0.5 - length * 0.3;
        return {base: lerp(swimBase, held, k), pitch: lerp(0, pitch, k), roll: Math.sin(t * 0.21) * 0.06 * k, ahead: 0, airborne: false, hold: k};
    }
    if (t < step.out) {
        // Up to the surface, nose up.
        const k = ease(t / step.out);
        return {base: lerp(swimBase, half, k), pitch: -0.75 * k, roll: 0, ahead: 0, airborne: false, hold: 0};
    }
    if (t < step.back) {
        const k = (t - step.out) / (step.back - step.out);
        if (step.style === "roll") {
            // Its back breaks the surface and it turns over on its side.
            const arc = Math.sin(Math.PI * k);
            return {base: half + height * 0.35 * arc, pitch: lerp(-0.4, 0.4, k), roll: Math.PI * 2 * step.turns * ease(k), ahead: 0, airborne: false, hold: 0};
        }
        if (step.style === "glide") {
            // Burst out, a long low glide on its spread pectorals, the tail-tap (down to the water, sculling, off again),
            // a shorter glide on, back in nose first (`glideBeats`).
            const g = glideAt(step, t - step.out);
            const base = g.height < 0 ? lerp(surface, half, -g.height) : surface + apex * g.height;
            return {base, pitch: g.pitch, roll: Math.sin((t - step.out) * 2.3) * 0.05, ahead: g.ahead * scale, airborne: g.height > 0, hold: 0};
        }
        // The arc: its middle along a parabola through its apex; nose up at the start, down at the end.
        const arc = 4 * k * (1 - k);
        return {base: half + (apex + height * 0.55) * arc, pitch: lerp(-0.9, 0.9, k), roll: Math.PI * 2 * step.turns * k, ahead: 0, airborne: true, hold: 0};
    }
    // Back under and down to its depth (a glide's run eased away under water).
    const k = ease(clamp01((t - step.back) / Math.max(step.to - step.from - step.back, 0.1)));
    return {base: lerp(half, swimBase, k), pitch: lerp(step.style === "roll" ? 0.4 : step.style === "glide" ? 0.45 : 0.8, 0, k), roll: 0, ahead: step.style === "glide" ? glideRun(step) * scale * (1 - k) : 0, airborne: false, hold: 0};
}

/** When its splashes come (s from `from`): breaking out and coming back in. A sail and a roll only stir the surface. */
export function leapSplashes(step: LeapStep): number[] {
    if (step.style === "sail") return [step.out];
    // (A glide's tail-tap stirs the water too: its lobe in it.)
    if (step.style === "glide" && step.tap > 0) return [step.out, step.tap + GLIDE_TAP * 0.3, step.back];
    return [step.out, step.back];
}

/** While a whale sails it keeps this share of its cruise (SPECIES-ANIM-B2). */
export const SAIL_PACE = 0.04;
/** After a sail it makes up the time it held at this share over its cruise (+30%, out of sight of the pace). */
export const SAIL_CATCH_UP = 0.3;

/**
 * How many seconds behind its own loop a sailing whale is at a moment (epoch s): its open-ocean place (`oceanFix`) is
 * read at the clock minus this, so it holds nearly still with its flukes up while it sails, then makes the time up at
 * `SAIL_CATCH_UP` over its cruise, with no jump (SPECIES-ANIM-B2, 2026-11-24: a "sailing" whale slid head down 100 to
 * 400 m along its loop at 1.6 m/s). Pure: from its own sails in this engine tick and the one before (the longest hold,
 * 246 s, is made up in 820 s, well inside a tick), the same for every viewer.
 */
export function sailDelay(id: string, slug: string, length: number, epoch: number): number {
    const spec = leapSpec(slug);
    if (!spec || spec.style !== "sail") return 0;
    const tick = Math.floor(epoch / LEAP_TICK_SECONDS);
    let delay = 0;
    let at = (tick - 1) * LEAP_TICK_SECONDS;
    for (const step of [...leapsInTick(id, slug, length, tick - 1), ...leapsInTick(id, slug, length, tick)]) {
        if (step.from >= epoch) break;
        delay = Math.max(0, delay - (step.from - at) * SAIL_CATCH_UP);
        const end = Math.min(step.to, epoch);
        delay += (end - step.from) * (1 - SAIL_PACE);
        at = end;
    }
    return Math.max(0, delay - (epoch - at) * SAIL_CATCH_UP);
}
