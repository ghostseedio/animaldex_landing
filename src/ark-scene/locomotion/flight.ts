/**
 * Flight (motion pass lane L2): how a bird, a bat or a flying insect beats its wings, glides, soars, banks, takes off
 * and lands, from its size and its family's flight style (`styles.ts`). Pure functions of the shared clock, the
 * animal's seed and what its path does; the only state is `FlightMemory` (per viewer, visual only: a beat phase and
 * the last mode, so a flap bout ends on a whole beat). Positions stay the schedule's: this adds the attitude (pitch,
 * the bank), a small heave in time with the beat, and which clip plays at what phase.
 *
 * The numbers, and where they come from:
 * - Wing-beat rate by size: birds f = 3.87 m^-0.33 (Pennycuick 1996, cruising birds), with a family factor (heavy
 *   wings beat faster: auks 1.9, ducks 1.35; broad slow wings slower: owls 0.75, herons 0.8). Mass from length by a
 *   bird allometry m = 4 L^2.9 (kg, m). Hummingbirds f = 1.32 m^-0.6. Bats f = 3.3 m^-0.31 (m = 37 L^3). Insects
 *   their order's rate (Dudley 2000), butterflies f = 1.5 L^-0.5.
 * - Shown at most `FLAP_DISPLAY_HZ` (10 Hz: six frames a beat at 60 fps); a faster beat is shown at that rate with a
 *   smaller stroke (a whir), never aliased into a slow-motion flap.
 * - The downstroke takes 58% of a beat in cruising flight (55% climbing): the power stroke is the slower, fuller one,
 *   the upstroke quicker, the hand flexed (`upstrokeFold`, for the rig driver).
 * - The body heaves up on the downstroke: about 2% of the length in cruise, up to 6% climbing or flaring.
 * - The bank of a coordinated turn: tan φ = v ω / g (v the speed, ω the turn rate), at most 60° (birds) or 45°.
 * - Cruise speed U = 11.5 m^0.13 m/s for birds (Alerstam 2007: speed ∝ m^0.13); a burst 1.7-1.9 times that; a stoop
 *   to 3.5 times (capped at 90 m/s, the peregrine's); bats 7 m^0.1; insects by kind.
 *
 * The flap clip of the rig set (`rig_ark.py`): one beat per loop, phase 0 = the wings at the top, 0-0.5 the
 * downstroke, a cosine stroke. `strokeToClipPhase` maps a beat (with its downstroke share and stroke size) onto it.
 */

import {decodeFlight, locoStyle, type FlightStyle, type FlightStyleRow, type FlyerKind} from "@/ark-scene/locomotion/styles";

export const G = 9.81;
/** The fastest wing beat shown (Hz). */
export const FLAP_DISPLAY_HZ = 10;
/** The smallest stroke a fast beat is shown with (share of the clip's full stroke). */
export const MIN_STROKE = 0.35;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const frac = (v: number) => v - Math.floor(v);
const smooth = (v: number) => {
    const c = clamp(v, 0, 1);
    return c * c * (3 - 2 * c);
};
/** A seeded number in [0, 1) for an animal and a count (the same for every viewer). */
export function seeded(seed: number, n: number): number {
    const x = Math.sin(seed * 12.9898 * 1000 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

// MARK: Size

/** A bird's mass (kg) from its length (m, bill to tail): m = 4 L^2.9 (fits mallard, sparrow, eagle, swan within 2x). */
export function birdMass(lengthM: number): number {
    return 4 * Math.max(lengthM, 0.02) ** 2.9;
}
/** A bat's mass (kg) from its head-body length (m): m = 37 L^3. */
export function batMass(lengthM: number): number {
    return 37 * Math.max(lengthM, 0.02) ** 3;
}
/** A flyer's mass (kg) by kind; an insect's from a density allometry (30 L^3). */
export function flyerMass(kind: FlyerKind, lengthM: number): number {
    return kind === "bird" ? birdMass(lengthM) : kind === "bat" ? batMass(lengthM) : 30 * Math.max(lengthM, 0.002) ** 3;
}

/** The true wing-beat rate (Hz) of a flyer of this kind, style and length. */
export function wingbeatHz(row: Pick<FlightStyleRow, "kind" | "style" | "factor" | "insectHz">, lengthM: number): number {
    const L = Math.max(lengthM, 0.005);
    if (row.kind === "insect") {
        if (row.style === "flutter") return clamp(1.5 * L ** -0.5, 3, 16);
        return row.insectHz ?? 120;
    }
    if (row.kind === "bat") return clamp(3.3 * batMass(L) ** -0.31, 2, 20);
    const m = birdMass(L);
    if (row.style === "hover") return clamp(1.32 * m ** -0.6, 12, 80);
    return clamp(3.87 * m ** -0.33 * (row.factor || 1), 1.2, 30);
}

/** What is shown for a true rate: at most `FLAP_DISPLAY_HZ`, the stroke shrunk as √(shown/true) for a faster beat. */
export function displayBeat(trueHz: number): {hz: number; stroke: number} {
    if (trueHz <= FLAP_DISPLAY_HZ) return {hz: trueHz, stroke: 1};
    return {hz: FLAP_DISPLAY_HZ, stroke: clamp(Math.sqrt(FLAP_DISPLAY_HZ / trueHz), MIN_STROKE, 1)};
}

// MARK: The spec

export type FlightSpec = {
    style: FlightStyle;
    kind: FlyerKind;
    stoops: boolean;
    lengthM: number;
    massKg: number;
    trueHz: number;
    /** The rate shown and the stroke it is shown with. */
    hz: number;
    stroke: number;
    /** The downstroke's share of a beat in cruising flight. */
    downstroke: number;
    /** How far the hand flexes on the upstroke (0-1, the driver's fold). */
    fold: number;
    /** The body's heave a beat (share of its length, half the rise and fall), in cruise. */
    heave: number;
    /** Share of level flight spent gliding (flap-gliders, soarers). */
    glideShare: number;
    /** Steepest bank (radians). */
    bankMax: number;
    /** Paces (m/s). */
    cruise: number;
    burst: number;
    dive: number;
};

/** Cruise, burst and dive speeds (m/s) for a flyer (L7's chases read these). */
export function flightPaces(kind: FlyerKind, style: FlightStyle, lengthM: number, stoops = false): {cruise: number; burst: number; dive: number} {
    const L = Math.max(lengthM, 0.005);
    if (kind === "insect") {
        const cruise = style === "flutter" ? 2.5 : style === "hover" ? 5 : 4;
        return {cruise, burst: cruise * 1.8, dive: cruise * 2};
    }
    if (kind === "bat") {
        const cruise = 7 * batMass(L) ** 0.1;
        return {cruise, burst: cruise * 1.7, dive: cruise * 2};
    }
    const m = birdMass(L);
    const cruise = clamp(11.5 * m ** 0.13, 4, 22);
    const burst = cruise * (m < 0.1 ? 1.9 : 1.7);
    const dive = stoops ? Math.min(cruise * 3.5, 90) : cruise * 2;
    return {cruise, burst, dive};
}

/** A flyer's spec from its styles row and its true length (m). Null when it does not fly. */
export function flightSpecOf(row: FlightStyleRow | null, lengthM: number): FlightSpec | null {
    if (!row) return null;
    const trueHz = wingbeatHz(row, lengthM);
    const shown = displayBeat(trueHz);
    const big = smooth((lengthM - 0.25) / 0.75);
    const insect = row.kind === "insect";
    const glideShare =
        row.style === "soar" ? 0.85 : row.style === "flap_glide" ? clamp(0.25 + 0.3 * big, 0.2, 0.6) : row.style === "flutter" ? (lengthM > 0.06 ? 0.3 : 0.1) : row.style === "flap_bound" ? 0.35 : 0;
    // The hand's flex on the upstroke: strong in small birds' and bats' slow flight, little in big soarers'.
    const fold = insect ? 0 : row.kind === "bat" ? 1 : row.style === "soar" ? 0.6 : row.style === "hover" ? 0 : 0.95 - 0.3 * big;
    return {
        style: row.style,
        kind: row.kind,
        stoops: row.stoops,
        lengthM,
        massKg: flyerMass(row.kind, lengthM),
        trueHz,
        hz: shown.hz,
        stroke: shown.stroke,
        downstroke: insect ? 0.5 : row.kind === "bat" ? 0.55 : 0.58,
        fold,
        heave: row.style === "flutter" ? 0.25 : insect ? 0.04 : 0.02,
        glideShare,
        bankMax: insect ? 0.8 : 1.05,
        ...flightPaces(row.kind, row.style, lengthM, row.stoops)
    };
}

/** A species' flight spec (its styles row, else its plan's default). */
export function flightSpec(slug: string, lengthM: number, plan?: string | null): FlightSpec | null {
    return flightSpecOf(locoStyle(slug, plan).flight, lengthM);
}

export {decodeFlight};

// MARK: The beat

/**
 * The flap clip's phase for a beat (0-1, 0 = wings up, the downstroke first): the downstroke over `downstroke` of the
 * beat, the upstroke over the rest, each a half cosine stroke; `stroke` < 1 keeps the wings nearer the middle (a
 * whir). The clip is a cosine stroke itself (top at 0, bottom at 0.5), so the stroke position is mapped back through it.
 */
export function strokeToClipPhase(beat: number, downstroke: number, stroke = 1): number {
    const b = frac(beat);
    const d = clamp(downstroke, 0.2, 0.8);
    const down = b < d;
    // The stroke position: +1 at the top, -1 at the bottom.
    const s = down ? Math.cos((Math.PI * b) / d) : -Math.cos((Math.PI * (b - d)) / (1 - d));
    const q = Math.acos(clamp(s * clamp(stroke, 0, 1), -1, 1)) / (2 * Math.PI);
    return down ? q : 1 - q;
}

/** How far the hand is flexed (0-1) at a point of the beat: 0 through the downstroke, a smooth bump on the upstroke. */
export function upstrokeFold(beat: number, downstroke: number): number {
    const b = frac(beat);
    if (b < downstroke) return 0;
    const u = (b - downstroke) / (1 - downstroke);
    return Math.sin(Math.PI * u) ** 1.5;
}

/** The body's heave through a beat (-1 low, +1 high): it rises through the downstroke and sinks on the upstroke. */
export function beatHeave(beat: number, downstroke: number): number {
    const b = frac(beat);
    const s = b < downstroke ? Math.cos((Math.PI * b) / downstroke) : -Math.cos((Math.PI * (b - downstroke)) / (1 - downstroke));
    // Lowest at the top of the stroke (about to push), highest at the bottom.
    return -s;
}

// MARK: Banking

/** The bank of a coordinated turn (radians, + left wing down for a left turn): tan φ = v ω / g, within ±max. */
export function bankAngle(speed: number, turnRate: number, max = 1.05): number {
    return clamp(Math.atan((speed * turnRate) / G), -max, max);
}

/** The bank the flight clips themselves carry (`bank_l` left wing down 25°). */
export const CLIP_BANK = (25 * Math.PI) / 180;

// MARK: The rhythm of level flight

export type FlightMode = "flap" | "glide" | "bound" | "soar" | "hover";

/**
 * Level flight's rhythm on the shared clock (the same for every viewer): flap-bounders flap a few beats then close
 * their wings and fall in a bound; flap-gliders flap a bout then glide; soarers glide; continuous flappers flap. The
 * cycle's length and the bout's beats are the animal's own (seeded). `lift` (m) is the bounding flight's rise and fall
 * about its path (up through the flaps, down through the bound).
 */
export function flightRhythm(spec: FlightSpec, clock: number, seed: number): {mode: FlightMode; lift: number; cycle: number; at: number} {
    const hz = spec.hz;
    if (spec.style === "flap_bound") {
        const beats = 3 + Math.floor(seeded(seed, 1) * 3);
        const flap = beats / hz;
        const bound = clamp(0.25 + 0.6 * spec.lengthM, 0.25, 0.55);
        const cycle = flap + bound;
        const at = frac((clock + seed * 13.7) / cycle) * cycle;
        const amp = Math.min(1.2 * spec.lengthM, 0.35);
        // Up through the flaps, a ballistic arc down through the bound: continuous at both ends.
        const lift = at < flap ? amp * (0.5 - 0.5 * Math.cos((Math.PI * at) / flap)) : amp * (0.5 + 0.5 * Math.cos((Math.PI * (at - flap)) / bound));
        return {mode: at < flap ? "flap" : "bound", lift, cycle, at};
    }
    if (spec.style === "flap_glide" || spec.style === "flutter") {
        const beats = spec.style === "flutter" ? 4 + Math.floor(seeded(seed, 2) * 4) : 3 + Math.floor(seeded(seed, 2) * 4 + 3 * (1 - spec.glideShare));
        const flap = beats / hz;
        const glide = (flap * spec.glideShare) / Math.max(1 - spec.glideShare, 0.05);
        const cycle = flap + glide;
        const at = frac((clock + seed * 17.3) / cycle) * cycle;
        return {mode: at < flap ? "flap" : "glide", lift: 0, cycle, at};
    }
    if (spec.style === "soar") return {mode: "soar", lift: 0, cycle: 1, at: 0};
    return {mode: "flap", lift: 0, cycle: 1, at: 0};
}

/**
 * A soarer's small wing adjustments (radians): the roll and pitch it trims by as it rides the air, a few degrees on
 * slow incommensurate waves (closed form: the same for every viewer).
 */
export function soarTrim(clock: number, seed: number): {roll: number; pitch: number} {
    const a = clock * 0.9 + seed * 40;
    return {roll: 0.05 * Math.sin(a) + 0.03 * Math.sin(a * 2.37 + 1.3), pitch: 0.025 * Math.sin(a * 1.61 + 0.7)};
}

/**
 * Darting (swallows and swifts hawking insects, bats, dragonflies, a fleeing small bird): quick changes of heading and
 * height on incommensurate waves (closed form). Returns a heading offset (radians), the extra bank that goes with it,
 * and a sideways and vertical offset (m) from the path.
 */
export function dartPose(clock: number, seed: number, spec: Pick<FlightSpec, "kind" | "style" | "lengthM" | "cruise">, strength = 1): {yaw: number; roll: number; side: number; up: number} {
    const quick = spec.kind === "insect" ? 2.2 : spec.kind === "bat" ? 1.6 : 1.1;
    const a = clock * quick + seed * 31;
    const yaw = strength * (0.35 * Math.sin(a * 1.3) + 0.2 * Math.sin(a * 2.9 + 1.1));
    const yawRate = strength * quick * (0.35 * 1.3 * Math.cos(a * 1.3) + 0.2 * 2.9 * Math.cos(a * 2.9 + 1.1));
    const reach = Math.max(spec.lengthM * 6, 0.3) * strength;
    return {
        yaw,
        roll: bankAngle(spec.cruise, yawRate, spec.kind === "insect" ? 0.8 : 1.05),
        side: reach * (0.6 * Math.sin(a * 0.7 + 2) + 0.4 * Math.sin(a * 1.9)),
        up: reach * 0.4 * (Math.sin(a * 1.1 + 0.4) + 0.5 * Math.sin(a * 3.1))
    };
}

// MARK: Stoops and dives

/**
 * A stoop (a raptor's dive) or a plunge-dive, through u = 0-1 of it: the roll-in (wings half folded, nose going
 * down), the stoop (wings closed, the plunge clip, nose down steeply), the pull-out and flare (wings open, braking
 * flaps, nose up). Pitch in the scene's sense (+ nose down, radians); `fold` 0 open to 1 closed; `clip` the rig
 * clip to show; `pace` the share of the dive speed now.
 */
export function stoopPose(u: number): {clip: "glide" | "plunge" | "flap"; pitch: number; fold: number; pace: number; rate: number} {
    const t = clamp(u, 0, 1);
    if (t < 0.15) {
        const k = smooth(t / 0.15);
        return {clip: "glide", pitch: 0.2 + 0.7 * k, fold: 0.5 * k, pace: 0.4 + 0.3 * k, rate: 1};
    }
    if (t < 0.8) {
        const k = smooth((t - 0.15) / 0.65);
        return {clip: "plunge", pitch: 0.9 + 0.35 * Math.sin(Math.PI * k), fold: 1, pace: 0.7 + 0.3 * k, rate: 1};
    }
    const k = smooth((t - 0.8) / 0.2);
    // The pull-out: the nose comes up through level to a flare, the wings open and beat to brake.
    return {clip: "flap", pitch: 0.9 - 1.5 * k, fold: 1 - k, pace: 1 - 0.7 * k, rate: 1.3};
}

// MARK: The rig frame

/** Per animal, per viewer (visual only): its beat and how it is flying now. */
export type FlightMemory = {beat: number; mode: FlightMode; wasClip: string | null; takeoffAt: number; flare: number; landPhase: number};

export function newFlightMemory(): FlightMemory {
    return {beat: 0, mode: "flap", wasClip: null, takeoffAt: -1e9, flare: 0, landPhase: 0};
}

/**
 * When the landing should start: coming down and within the landing clip's own reach of the ground (its `rise_h`
 * times the body's drawn height), so the clip's touch-down meets the ground rather than playing out after it.
 */
export function landingNow(agl: number, climb: number, landHeight: number): boolean {
    return climb < -0.02 && agl < Math.max(landHeight, 0.05) && agl > -0.05;
}

export type FlightRigInput = {
    spec: FlightSpec;
    /** Whether the rig has a playable clip of that name, and that clip's own beat rate (flap_hz) where it has one. */
    has: (name: string) => boolean;
    clipHz: (name: string) => number | null;
    /** The clip playing now and its phase. */
    current: string | null;
    phase: number;
    /** The path: its climb (radians, + up), turn rate (rad/s, + left), speed (m/s) and height over the ground (m). */
    climb: number;
    turn: number;
    speed: number;
    agl: number;
    /** The schedule's beat ("glide" on a glide leg) and whether it soars. */
    beat?: string | null;
    soaring?: boolean;
    /** A one-shot the rig player is in (take-off or landing), and how far through it is. */
    oneShot?: "takeoff" | "land" | null;
    /** A recipe's dive (`plunge`) and an act's state (`ActPose.state`: fly at burst, plunge, flee). */
    actState?: string | null;
    clock: number;
    seed: number;
    dt: number;
    /** No playable flap (`flight_fallback_open`): an open-wing clip is held. */
    open?: boolean;
    /** Its length as drawn (m), when the scene draws it at another size than its true one: the heave and the flare height scale with it. */
    drawnLength?: number;
    /** The landing clip's reach over the ground (m: its `rise_h` times the drawn height), for timing the touch-down. */
    landHeight?: number;
};

export type FlightRigFrame = {
    /** The clip, and how it plays: by `phase` set each frame ("sync") or at `rate` times its own pace ("time"). */
    clip: string;
    mode: "sync" | "time";
    phase: number;
    rate: number;
    /** The body's attitude (radians; pitch + nose down, roll + right wing down as the scene's euler has it). */
    pitch: number;
    roll: number;
    /** The heave (m, up) and the flight path's bounding lift (m). */
    heave: number;
    /** The hand's flex now (0-1), for the wing driver. */
    fold: number;
    /** The beat (0-1) and the flight mode, for the debug overlay and the metrics. */
    beat: number;
    flightMode: FlightMode | "takeoff" | "land" | "flare" | "dive";
    /** The bank (radians, + left) the frame flies with. */
    bank: number;
    /** The rate shown (Hz) when flapping. */
    hz: number;
};

/** How hard it beats in each phase of a flight (multiplies the cruise rate). */
export const BEAT_EFFORT = {takeoff: 1.35, climb: 1.15, cruise: 1, descend: 0.9, flare: 1.3, burst: 1.25} as const;

/**
 * A flyer's rig this frame in the air: which clip and phase (the flap's phase from its own beat, warped so the
 * downstroke is the slower full stroke), its pitch, roll and heave. The rig player's state machine still decides when
 * the take-off and the landing play (`oneShot`); this decides how.
 */
export function flightRigFrame(input: FlightRigInput, memory: FlightMemory): FlightRigFrame {
    const {spec, has} = input;
    const dt = Math.max(input.dt, 0);
    const levelBank = bankAngle(input.speed, input.turn, spec.bankMax);
    const out: FlightRigFrame = {clip: "flap", mode: "sync", phase: 0, rate: 1, pitch: -0.6 * input.climb, roll: -levelBank, heave: 0, fold: 0, beat: memory.beat, flightMode: "flap", bank: levelBank, hz: spec.hz};
    // A take-off: the spring and the first beat from the clip (played quicker: a snap), then hard flaps take over.
    if (input.oneShot === "takeoff") {
        memory.takeoffAt = input.clock;
        if (input.phase < 0.42 || !has("flap")) {
            Object.assign(out, {clip: "takeoff", mode: "time", rate: 1.5, flightMode: "takeoff", roll: 0, bank: 0});
            memory.beat = 0;
            memory.wasClip = "takeoff";
            return out;
        }
    }
    if (input.oneShot === "land") {
        // The touch-down: the clip's phase follows the height left (legs reaching down as the ground comes up), never
        // going back, and finishes in time once down (the wings folding away).
        if (memory.wasClip !== "land") memory.landPhase = input.phase;
        const reach = Math.max(input.landHeight ?? 0, 0.05);
        const byHeight = input.landHeight ? 1 - Math.min(Math.max(input.agl, 0) / reach, 1) : 0;
        const byTime = memory.landPhase + dt * (input.agl <= 0.02 ? 1.6 : 0.5);
        memory.landPhase = Math.min(Math.max(byHeight * 0.8, byTime), 1);
        Object.assign(out, {clip: "land", mode: "sync", phase: memory.landPhase, flightMode: "land", pitch: 0, roll: 0, bank: 0});
        memory.wasClip = "land";
        return out;
    }
    // A dive from the air (the recipe's plunge, a stoop): streamlined, wings closed.
    if ((input.actState === "plunge" || input.actState === "dive") && has("plunge")) {
        Object.assign(out, {clip: "plunge", mode: "time", rate: 1, flightMode: "dive", fold: 1, roll: 0, bank: 0});
        memory.wasClip = "plunge";
        return out;
    }
    if (input.open || !has("flap")) {
        // No flap of its own: open wings held (never the closed rest pose), banked by the instance. An insect's wings
        // are beaten on them by the wing driver (`l2-drivers.ts`) on the shared clock; its body heaves in time.
        const clip = input.soaring && has("soar") ? "soar" : (["glide", "soar", "bank_l", "bank_r", "hover"].find((n) => has(n)) ?? (has("takeoff") ? "takeoff" : "glide"));
        Object.assign(out, {clip, mode: clip === "takeoff" ? "sync" : "time", phase: clip === "takeoff" ? 1 : 0, flightMode: "glide"});
        if (spec.kind === "insect") {
            const beat = frac(input.clock * spec.hz + input.seed * 7);
            out.beat = beat;
            out.heave = spec.heave * (input.drawnLength ?? spec.lengthM) * beatHeave(beat, spec.downstroke);
            out.flightMode = "flap";
        }
        return out;
    }
    // Effort: a hard climb out of a take-off, a climb, cruise, a descent; a flare near the ground on the way down.
    const sinceTakeoff = input.clock - memory.takeoffAt;
    const descending = input.climb < -0.06;
    const drawn = input.drawnLength ?? spec.lengthM;
    const flareHeight = Math.max(1.2, drawn * 3);
    const wantFlare = descending && input.agl < flareHeight && input.agl > 0.02 ? 1 : 0;
    memory.flare += (wantFlare - memory.flare) * Math.min(dt * 6, 1);
    const burst = input.actState === "fly" || input.actState === "flee" || input.actState === "chase";
    let effort: number = sinceTakeoff < 1.6 ? BEAT_EFFORT.takeoff : input.climb > 0.08 ? BEAT_EFFORT.climb : descending ? BEAT_EFFORT.descend : BEAT_EFFORT.cruise;
    if (burst) effort = Math.max(effort, BEAT_EFFORT.burst);
    effort += (BEAT_EFFORT.flare - effort) * memory.flare;
    // Hanging still: the hover (hummingbirds, kestrels, hoverflies), when it has one.
    const bodyLengthsPerSecond = input.speed / Math.max(drawn, 0.01);
    if (has("hover") && bodyLengthsPerSecond < (memory.mode === "hover" ? 0.6 : 0.35)) {
        memory.mode = "hover";
        memory.beat = frac(memory.beat + dt * spec.hz);
        const clipHz = input.clipHz("hover") ?? spec.hz;
        Object.assign(out, {clip: "hover", mode: "time", rate: spec.hz / Math.max(clipHz, 0.5), flightMode: "hover", beat: memory.beat, pitch: 0, roll: -levelBank * 0.3});
        memory.wasClip = "hover";
        return out;
    }
    // Which mode: a climb or a hard start flaps; a long glide leg or a steep descent glides; level flight follows the
    // species' rhythm.
    const rhythm = flightRhythm(spec, input.clock, input.seed);
    let mode: FlightMode;
    if (memory.flare > 0.3 || sinceTakeoff < 1.6 || burst) mode = "flap";
    else if (input.climb > 0.12) mode = spec.style === "flap_bound" && rhythm.mode === "bound" ? "bound" : "flap";
    else if ((input.beat === "glide" || input.climb < -0.12) && spec.style !== "continuous" && spec.style !== "whir" && spec.style !== "bat") mode = spec.style === "soar" || input.soaring ? "soar" : "glide";
    // (A continuous flapper sets its wings on a steep way down, well above the ground: a duck gliding in.)
    else if (spec.style === "continuous" && input.climb < -0.2 && input.agl > flareHeight * 1.5) mode = "glide";
    else if (spec.style === "continuous" || spec.style === "bat" || spec.style === "whir") mode = "flap";
    else mode = rhythm.mode;
    // A flap bout ends on a whole beat (wings back up), never mid-stroke.
    if (memory.mode === "flap" && mode !== "flap" && memory.beat > 0.08 && memory.beat < 0.92) mode = "flap";
    if (mode === "flap" && memory.mode !== "flap") memory.beat = 0;
    memory.mode = mode;
    const hz = spec.hz * effort;
    out.hz = hz;
    if (mode === "flap") {
        memory.beat = frac(memory.beat + dt * hz);
        const down = input.climb > 0.08 || sinceTakeoff < 1.6 ? spec.downstroke - 0.03 : spec.downstroke;
        out.clip = "flap";
        out.mode = "sync";
        out.phase = strokeToClipPhase(memory.beat, down, spec.stroke);
        out.beat = memory.beat;
        out.fold = spec.fold * upstrokeFold(memory.beat, down) * (1 - 0.6 * memory.flare);
        const heaveShare = spec.heave * (1 + 1.5 * Math.max(effort - 1, 0) / 0.35);
        out.heave = heaveShare * drawn * beatHeave(memory.beat, down);
        out.flightMode = memory.flare > 0.3 ? "flare" : "flap";
    } else if (mode === "bound") {
        // Wings closed against the body (the plunge clip, levelled, wings in), falling in its bound.
        out.clip = has("plunge") ? "plunge" : "glide";
        out.mode = "time";
        out.flightMode = "bound";
        out.fold = 1;
    } else {
        // A glide or a soar: the bank clip on the turn's side once it banks past 12°, its own trim on top.
        const steep = Math.abs(levelBank) > 0.21;
        const side = levelBank > 0 ? "bank_l" : "bank_r";
        const soar = mode === "soar" && has("soar");
        out.clip = steep && has(side) ? side : soar ? "soar" : has("glide") ? "glide" : has("soar") ? "soar" : "flap";
        out.mode = "time";
        out.flightMode = mode;
        if (out.clip === side) out.roll = -(levelBank - Math.sign(levelBank) * CLIP_BANK);
        if (mode === "soar" || spec.style === "soar") {
            const trim = soarTrim(input.clock, input.seed);
            out.roll += trim.roll;
            out.pitch += trim.pitch;
        }
        if (out.clip === "flap") {
            // Nothing to glide with: wings held level (the flap's mid-downstroke).
            out.mode = "sync";
            out.phase = 0.25;
        }
    }
    // The bounding flight's own rise and fall about its path.
    if (spec.style === "flap_bound" && Math.abs(input.climb) < 0.15 && memory.flare < 0.3 && sinceTakeoff > 1.6) out.heave += (rhythm.lift - Math.min(1.2 * spec.lengthM, 0.35) * 0.5) * (drawn / Math.max(spec.lengthM, 0.01));
    // The flare: the body pitched up to brake, wings spread; the bank levels out.
    out.pitch += (-0.55 - out.pitch) * memory.flare;
    out.roll *= 1 - memory.flare;
    memory.wasClip = out.clip;
    return out;
}
