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
    /** The first of its bout (the live log says a bout once). */
    first: boolean;
};

const G = 9.81;
/** Up from its depth to the surface, and down again after re-entry (s). */
const RISE = 0.7;
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
            return {apex, out: RISE, back: RISE + air, turns: 0, run: 0};
        }
        case "twist":
        case "spin": {
            const apex = Math.min(Math.max(L * (style === "spin" ? 1.4 : 1.1), 0.8), 3) * jitter;
            const air = airTime(apex);
            return {apex, out: RISE, back: RISE + air, turns: style === "spin" ? 2 + Math.floor(random() * 3) : 0.5 + random() * 0.5, run: 0};
        }
        case "glide": {
            // "commonly for tens of metres": 10–40 m at about 10 m/s, just over the water.
            const run = 10 + random() * 30;
            const air = run / 10;
            return {apex: Math.max(L * 1.5, 0.3), out: RISE, back: RISE + air, turns: 0, run};
        }
        case "roll": {
            // Its back breaks the surface as it turns over: no air under it.
            return {apex: 0, out: RISE, back: RISE + 1.2 + random() * 0.6, turns: 0.25 + random() * 0.25, run: 0};
        }
        case "sail": {
            // "for long periods": one to four minutes, flukes up.
            const hold = 60 + random() * 180;
            return {apex: 0, out: 6, back: 6 + hold, turns: 0, run: 0};
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
};

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * Its pose `t` seconds into a leap, laid over where it swims (`swimBase`, its base there), at the surface `surface`,
 * drawn `height` tall and `length` long, `scale` its drawn size over its true size.
 */
export function leapPose(step: LeapStep, t: number, swimBase: number, surface: number, height: number, length: number, scale: number): LeapPose {
    const half = surface - height * 0.5;
    const apex = step.apex * scale;
    if (step.style === "sail") {
        // Head down, flukes held up in the wind: in over `out` s, held, out over the sink.
        const k = t < step.out ? ease(t / step.out) : t < step.back ? 1 : 1 - ease(clamp01((t - step.back) / Math.max(step.to - step.from - step.back, 0.1)));
        const sway = Math.sin(t * 0.35) * 0.04;
        return {base: lerp(swimBase, surface - height * 0.5 - length * 0.42, k), pitch: lerp(0, 1.25 + sway, k), roll: 0, ahead: 0, airborne: false};
    }
    if (t < step.out) {
        // Up to the surface, nose up.
        const k = ease(t / step.out);
        return {base: lerp(swimBase, half, k), pitch: -0.75 * k, roll: 0, ahead: 0, airborne: false};
    }
    if (t < step.back) {
        const k = (t - step.out) / (step.back - step.out);
        if (step.style === "roll") {
            // Its back breaks the surface and it turns over on its side.
            const arc = Math.sin(Math.PI * k);
            return {base: half + height * 0.35 * arc, pitch: lerp(-0.4, 0.4, k), roll: Math.PI * 2 * step.turns * ease(k), ahead: 0, airborne: false};
        }
        if (step.style === "glide") {
            // Out, then level just over the water on its wings, down again at the end.
            const up = Math.min(k / 0.12, 1, (1 - k) / 0.12);
            return {base: half + (apex + height * 0.5) * ease(up), pitch: k < 0.12 ? -0.5 * (1 - k / 0.12) : k > 0.88 ? 0.4 * ((k - 0.88) / 0.12) : 0, roll: Math.sin(k * 9) * 0.06, ahead: step.run * scale * k, airborne: true};
        }
        // The arc: its middle along a parabola through its apex; nose up at the start, down at the end.
        const arc = 4 * k * (1 - k);
        return {base: half + (apex + height * 0.55) * arc, pitch: lerp(-0.9, 0.9, k), roll: Math.PI * 2 * step.turns * k, ahead: 0, airborne: true};
    }
    // Back under and down to its depth (a glide's run eased away under water).
    const k = ease(clamp01((t - step.back) / Math.max(step.to - step.from - step.back, 0.1)));
    return {base: lerp(half, swimBase, k), pitch: lerp(step.style === "roll" ? 0.4 : 0.8, 0, k), roll: 0, ahead: step.style === "glide" ? step.run * scale * (1 - k) : 0, airborne: false};
}

/** When its splashes come (s from `from`): breaking out and coming back in. A sail and a roll only stir the surface. */
export function leapSplashes(step: LeapStep): number[] {
    if (step.style === "sail") return [step.out];
    return [step.out, step.back];
}
