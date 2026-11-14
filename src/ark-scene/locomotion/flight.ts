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
import takeoffTable from "@/ark-scene/locomotion/takeoff.json";
import waysTable from "@/ark-scene/locomotion/flight-ways.json";

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
    /** The family's wing-beat factor (over 1: heavy wings for its size, the auks, ducks, grebes and rails). */
    factor: number;
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
        factor: row.factor || 1,
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

// MARK: Flights on the schedule (movement audit lane MA1)

/**
 * The hardest a bird of a kilo or more speeds up out of a take-off or slows into a landing (m/s², horizontal): half a g
 * (the audit's limit for the big birds).
 */
export const FLIGHT_ACCEL_MAX = 0.5 * G;

/**
 * The hardest a flyer of this mass speeds up out of a take-off (m/s²): half a g at a kilo, more for smaller ones as power
 * over weight grows (∝ m^-1/3: about 2 g for a sparrow, 1 g for a pigeon, the small birds' several-g bursts held to
 * 2.5 g), a third of a g for a swan (MA1 follow-up, decision 285: at half a g for everyone a sparrow walked every way under
 * 6 m and real small birds hop-fly them). Braking the same with a floor of 0.4 g (wings spread, tail fanned).
 */
export function flightAccelOf(massKg: number): {accel: number; brake: number} {
    const k = 0.5 * Math.max(massKg, 1e-4) ** (-1 / 3);
    return {accel: G * clamp(k, 0.3, 2.5), brake: G * clamp(k, 0.4, 2.5)};
}

/** How it gets off the ground (`takeoff.json`, by family): see `scripts/ark-flight-takeoff.mts`. */
export type TakeoffClass = "w" | "wg" | "g" | "a" | "h";
const TAKEOFF = (takeoffTable as {species: Record<string, string>}).species;
export function takeoffClass(slug: string): TakeoffClass | null {
    const c = TAKEOFF[slug];
    return c === "w" || c === "wg" || c === "g" || c === "a" || c === "h" ? c : null;
}

/** A flyer's paces on the schedule's air legs: the speeds, how hard it speeds up and slows, how steeply it climbs and comes down, and whether it runs to take off or skis in to land. */
export type AirPaces = {
    kind: FlyerKind;
    /** Level flight (m/s): L2's cruise. */
    cruise: number;
    /** A soar's glide (m/s). */
    glide: number;
    /** Speeding up out of a take-off, slowing into a landing (m/s², `flightAccelOf`: at most half a g from a kilo up). */
    accel: number;
    brake: number;
    /** Its steepest climb out of a take-off and its glide-in (radians). */
    climb: number;
    descent: number;
    /** Its lift-off speed after a run across the water or along the ground (m/s); 0: it springs straight off. */
    runWater: number;
    runGround: number;
    /** Its run's acceleration (m/s²: the feet slap the water, less than the wings alone give). */
    runAccel: number;
    /** Touch-down speed on the water (m/s): it skis in on its feet to a stop; 0: it stops in the air. */
    skiWater: number;
};

/**
 * A flyer's air paces from its spec and its take-off class. Acceleration by mass (`flightAccelOf`: 2 g for a sparrow,
 * half a g at a kilo, a third of a g for a swan); a run's at most 0.3 g (its feet slap the water or the ground). The
 * climb out of a take-off 45° for a small bird, about 20° for a swan, flatter for heavy wings (the family's beat factor);
 * the glide-in about four fifths of that. A run to lift off at half its cruise; a ski in from a third of it.
 */
export function airPacesOf(spec: FlightSpec, cls: TakeoffClass | null): AirPaces {
    const m = spec.massKg;
    const insect = spec.kind === "insect";
    const {accel, brake} = flightAccelOf(m);
    const deg = Math.PI / 180;
    const climb = insect ? 60 * deg : spec.kind === "bat" ? 40 * deg : clamp((45 - 12 * Math.log10(Math.max(m, 1e-4) / 0.1)) / Math.max(spec.factor, 1) ** 0.7, 14, 45) * deg;
    const descent = insect ? 45 * deg : clamp(climb * 0.8, 10 * deg, 35 * deg);
    const water = spec.kind === "bird" && (cls === "w" || cls === "wg" || (cls === "a" && m >= 1));
    const ground = spec.kind === "bird" && (cls === "g" || cls === "wg" || (cls === "a" && m >= 3) || (cls === "h" && m >= 4));
    const ski = spec.kind === "bird" && (cls === "w" || cls === "wg" || cls === "a");
    return {
        kind: spec.kind,
        cruise: spec.cruise,
        glide: spec.cruise * 0.8,
        accel,
        brake,
        climb,
        descent,
        runWater: water ? 0.5 * spec.cruise : 0,
        runGround: ground ? 0.45 * spec.cruise : 0,
        runAccel: Math.min(accel * 0.6, 0.3 * G),
        skiWater: ski ? spec.cruise / 3 : 0
    };
}

/** Its run, climb, cruise, descent and ski on an air leg (for the rig: a run patters, a ski lands). */
export type AirStage = "run" | "climb" | "cruise" | "descend" | "ski";

/**
 * An air leg's plan: how long it takes, its speed through the leg (piecewise linear: up at its acceleration, level at
 * its cruise, down at its braking), where along its route it lifts off and touches down, how far it climbs and comes
 * down over, and how high it goes. Shares of the route are by its length; the speed is kept as shares of its peak, so
 * a leg the trip later fits into less time keeps its shape.
 */
export type AirPlan = {
    seconds: number;
    /** [u, s, u, s, ...]: time shares and the speed then as a share of the peak, from (0, 0) to (1, 0). */
    knots: number[];
    /** Route shares: the run on the surface before lift-off; where it touches down (then it skis to a stop). */
    liftoff: number;
    touchdown: number;
    /** Route shares it climbs over (from lift-off) and comes down over (to touch-down). */
    rise: number;
    fall: number;
    /** Its height over the line between its ends (m): lower for a hop too short to climb to its band. */
    height: number;
    /** Its top speed (m/s). */
    peak: number;
    /** It ends in the air, joining its flock's leader (no landing). */
    joins?: boolean;
    /**
     * A leg of a soar (lane B5, `soarAt`): whether it starts and ends up in the air, its heights along its route at
     * even shares of it (m, the scene's y) in place of the line between its ends, and, for a leg that is all soaring,
     * its track itself: [x, y, z] at even times through the leg, read between them (`trackAt`), so its speed is the
     * track's own (slower round a thermal, faster on the glide to the next). `lead` is where its track was a step before
     * its first point and is a step after its last ([x, y, z] twice): its curve's ends then head and move as the track
     * does through them, so two slots of one soar meet at one heading and one speed.
     */
    soar?: {from: boolean; to: boolean; alt?: Float32Array; track?: Float32Array; lead?: Float32Array};
};

/**
 * Plan an air leg of `length` metres (the route's, level) at up to `pace` m/s: a run first when `run` is set (m/s, the
 * lift-off speed), a ski at the end when `ski` is set (m/s, the touch-down speed); a leg too short to reach its pace
 * peaks lower, one too short for its run or ski springs off and stops in the air. `height` is the band it climbs to.
 */
export function planAirLeg(paces: AirPaces, length: number, height: number, opts: {pace?: number; run?: number; ski?: number} = {}): AirPlan {
    const L = Math.max(length, 0.01);
    const a = paces.accel;
    const b = paces.brake;
    const ar = paces.runAccel;
    let V = opts.pace ?? paces.cruise;
    let lo = Math.min(opts.run ?? 0, V);
    let td = Math.min(opts.ski ?? 0, V);
    const fits = (v: number, l: number, t: number) => l * l / (2 * ar) + (v * v - l * l) / (2 * a) + (v * v - t * t) / (2 * b) + t * t / (2 * b) <= L;
    if (!fits(V, lo, td)) {
        // Peak lower: (V² - lo²)/2a + (V² - td²)/2b = L - lo²/2ar - td²/2b.
        const room = L - (lo * lo) / (2 * ar) - (td * td) / (2 * b);
        const v2 = (room + (lo * lo) / (2 * a) + (td * td) / (2 * b)) / (1 / (2 * a) + 1 / (2 * b));
        if (room > 0 && v2 >= Math.max(lo, td) ** 2 * 1.2) V = Math.sqrt(v2);
        else {
            // Too short to run or to ski: it springs off and stops in the air.
            lo = 0;
            td = 0;
            V = Math.min(V, Math.sqrt(L / (1 / (2 * a) + 1 / (2 * b))));
        }
    }
    const dRun = (lo * lo) / (2 * ar);
    const dUp = (V * V - lo * lo) / (2 * a);
    const dDown = (V * V - td * td) / (2 * b);
    const dSki = (td * td) / (2 * b);
    const dLevel = Math.max(L - dRun - dUp - dDown - dSki, 0);
    const t = [lo / ar, (V - lo) / a, dLevel / Math.max(V, 1e-6), (V - td) / b, td / b];
    const seconds = Math.max(t.reduce((s, x) => s + x, 0), 0.05);
    const speeds = [lo, V, V, td, 0];
    const knots = [0, 0];
    let at = 0;
    for (let i = 0; i < 5; i++) {
        if (t[i] <= 1e-6) continue;
        at += t[i];
        knots.push(Math.min(at / seconds, 1), speeds[i] / Math.max(V, 1e-6));
    }
    if (knots[knots.length - 2] < 1) knots.push(1, 0);
    const liftoff = dRun / L;
    const touchdown = 1 - dSki / L;
    // Climb and come down by its angles, each a smoothstep (its steepest slope 1.5 times the mean: so 1.5 h / tan γ).
    const air = Math.max((touchdown - liftoff) * L, 0.01);
    const per = 1.5 / Math.tan(paces.climb) + 1.5 / Math.tan(paces.descent);
    const h = Math.min(Math.max(height, 0), air / per);
    return {seconds, knots, liftoff, touchdown, rise: Math.max((1.5 * h) / Math.tan(paces.climb) / L, 1e-4), fall: Math.max((1.5 * h) / Math.tan(paces.descent) / L, 1e-4), height: h, peak: V};
}

/** Where along the route (share of its length) a plan is at time share u, and its speed then (shares of the route a time share). */
export function airProgress(knots: readonly number[], u: number): {share: number; rate: number} {
    const x = clamp(u, 0, 1);
    let total = 0;
    let done = 0;
    let rate = 0;
    for (let i = 2; i < knots.length; i += 2) {
        const u0 = knots[i - 2];
        const s0 = knots[i - 1];
        const u1 = knots[i];
        const s1 = knots[i + 1];
        const w = u1 - u0;
        if (w <= 0) continue;
        total += ((s0 + s1) / 2) * w;
        if (x >= u1) done += ((s0 + s1) / 2) * w;
        else if (x >= u0) {
            const sx = s0 + ((s1 - s0) * (x - u0)) / w;
            done += ((s0 + sx) / 2) * (x - u0);
            rate = sx;
        }
    }
    return {share: total > 0 ? Math.min(done / total, 1) : x, rate: total > 0 ? rate / total : 1};
}

/** The stage of a plan at a route share: on the surface before lift-off or after touch-down, else climbing, level or coming down. */
export function airStage(plan: Pick<AirPlan, "liftoff" | "touchdown" | "rise" | "fall" | "joins" | "soar">, share: number): AirStage {
    if (plan.joins) return share < 0.5 ? "climb" : "cruise";
    // (A soar's leg: up already where it starts in the air, never coming down where it ends in it.)
    if (plan.soar) {
        if (!plan.soar.from && share < plan.liftoff + plan.rise) return share < plan.liftoff ? "run" : "climb";
        if (!plan.soar.to && share > plan.touchdown) return "ski";
        return !plan.soar.to && share > plan.touchdown - plan.fall ? "descend" : "cruise";
    }
    if (share < plan.liftoff) return "run";
    if (share > plan.touchdown) return "ski";
    const up = (share - plan.liftoff) / plan.rise;
    const down = (plan.touchdown - share) / plan.fall;
    if (up < 1 && up <= down) return "climb";
    if (down < 1) return "descend";
    return "cruise";
}

/** Its height over its line at a route share (0 on the surface, 1 at its band): smoothsteps up from lift-off and down to touch-down. */
export function airLift(plan: Pick<AirPlan, "liftoff" | "touchdown" | "rise" | "fall" | "soar">, share: number): number {
    if (plan.soar) {
        // (A soar's leg: at its height wherever it is in the air at that end.)
        const up = plan.soar.from ? 1 : share <= plan.liftoff ? 0 : Math.min((share - plan.liftoff) / plan.rise, 1);
        const down = plan.soar.to ? 1 : share >= plan.touchdown ? 0 : Math.min((plan.touchdown - share) / plan.fall, 1);
        const k = Math.min(up, down);
        return k * k * (3 - 2 * k);
    }
    if (share <= plan.liftoff || share >= plan.touchdown) return 0;
    const k = Math.min((share - plan.liftoff) / plan.rise, (plan.touchdown - share) / plan.fall, 1);
    return k * k * (3 - 2 * k);
}

// MARK: A hop from A to B (for the hunt lane's forays)

/** A flyer part of the way through a hop: where it is, how it heads, its speed over the ground and its stage. */
export type HopAt = {x: number; y: number; z: number; yaw: number; speed: number; stage: AirStage; aloft: boolean};
/**
 * A short flight from one spot to another as the schedule's air legs fly them (lane B5, for `hunting.ts`: its forays
 * flew plain arcs at the cruise): up to its pace at its take-off's acceleration, level, down at its braking (a hop too
 * short to reach its pace peaks lower), climbing and coming down at its own angles over the line between the two
 * spots, to `height` over it at most (lower on a short hop). Pure: `seconds` is how long it takes, `at(t)` where it is
 * t seconds in. No run and no ski: a hunter leaves a perch or the ground standing. The route is the straight line; it
 * does not look at what is under it (the caller's spots are its own).
 */
export function flightHop(paces: AirPaces, from: {x: number; y: number; z: number}, to: {x: number; y: number; z: number}, height: number, pace?: number): {seconds: number; plan: AirPlan; at: (seconds: number) => HopAt} {
    const flat = Math.hypot(to.x - from.x, to.z - from.z);
    const plan = planAirLeg(paces, Math.max(Math.hypot(flat, to.y - from.y), 0.01), height, {pace});
    const yaw = flat > 1e-6 ? Math.atan2(to.x - from.x, to.z - from.z) : 0;
    const length = Math.max(Math.hypot(flat, to.y - from.y), 0.01);
    return {
        seconds: plan.seconds,
        plan,
        at: (seconds: number) => {
            const u = clamp(seconds / plan.seconds, 0, 1);
            const {share, rate} = airProgress(plan.knots, u);
            const lift = airLift(plan, share);
            return {
                x: from.x + (to.x - from.x) * share,
                y: from.y + (to.y - from.y) * share + plan.height * lift,
                z: from.z + (to.z - from.z) * share,
                yaw,
                speed: u < 1 ? (rate * length) / plan.seconds : 0,
                stage: airStage(plan, share),
                aloft: u > 0 && u < 1 && lift > 0.05
            };
        }
    };
}

// MARK: Ways of life in the air (behaviours pass, lane B5 air)

/**
 * How a flyer lives in the air (`flight-ways.json`, by family and how it hunts: `scripts/ark-flight-ways.mts`): what
 * sets how often it takes off and why. Only animals that fly first have one.
 */
export type FlightWay = "soar" | "vulture" | "stork" | "perch" | "aerial" | "swift" | "flit" | "tree" | "ground" | "commute" | "wader" | "shore" | "patrol" | "hover" | "flower" | "dragon" | "bug";
const WAYS = (waysTable as {species: Record<string, string>}).species;
export function flightWay(slug: string): FlightWay | null {
    const way = WAYS[slug];
    return way && way in FLIGHT_WAYS ? (way as FlightWay) : null;
}

/**
 * A way of life's rule on the schedule (`behaviour-schedule.ts` stations). A flyer keeps to a station, a perch with a
 * view, a patch of ground, the shallows, for about `bout` slots of the schedule (80 s each), and of what the schedule
 * picks for a slot it flies off for only a `foray` share (and comes back the next); the rest it does at its station:
 * it sits, walks about it, or flits to a twig a few lengths off. A thermal soarer's bouts in the warm hours start,
 * for a `soar.share` of them, with a soar of `soar.slots` slots. `bout` 0: no stations, the schedule as it picks.
 *
 * The shares are set from the real birds' rates (flights an hour awake = 45 / bout + about 70 x foray, and its flits):
 * - a buzzard or an eagle sits for most of an hour between flights (Tubbs 1974; Watson 2010: under 3 flights an hour
 *   perch-hunting) and soars 10 to 20 minutes at a time once the air is warm;
 * - a vulture is on the wing most of the warm hours (Pennycuick 1972: griffons aloft 6 to 7 hours a day);
 * - a kingfisher, a bee-eater, a shrike or an owl changes its perch every quarter of an hour or so, and dives or
 *   sallies from it (its recipe's flights are its own);
 * - a heron stands or stalks for half an hour and more between flights; a sandpiper's flock runs, and flies along
 *   the shore every ten minutes or so;
 * - a tit or a warbler moves every few seconds, twig to twig in one tree or bush, and crosses to the next every few
 *   minutes (Gibb 1954: tits change trees every 2 to 5 minutes);
 * - a parrot clambers in its feeding tree for a quarter of an hour, and commutes at the day's two ends;
 * - a gull or a tern loafs and patrols by turns;
 * - a swallow or a martin feeds on the wing for ten minutes and more at a time and rests on a wire or a twig between
 *   (Turner 2006: most of the day in flight when feeding young); a swift comes down only to its roost.
 */
export type FlightWayRule = {
    bout: number;
    foray: number;
    /** Its foray share at the day's two ends (a commuter's flights between its roost and its feeding trees). */
    forayEnds?: number;
    /**
     * The share of the schedule's recipe picks it goes off for (a kingfisher's plunge from a perch by the water, a
     * heron's wade and spear, a bathe, a nest to build): its own ways of feeding and living are most of why it flies,
     * so more than a plain foray. A recipe that runs from a perch runs from its station's and is not counted here.
     */
    recipes: number;
    /** Its station: a perch, the ground, the shallows, or by turns the ground and a perch ("mixed"). */
    station: "perch" | "ground" | "shallows" | "mixed";
    /** The share of its slots at a perch it flits to another twig nearby (1: every slot; a parrot clambering, now and then). */
    flit: number;
    /**
     * Its time on the wing: the share of its bouts that start with it, and how long (slots). "thermal": soaring in the
     * warm hours, `span` m of height to ride (`soarAt`). "hawk": feeding on the wing in long sweeps whenever it is awake
     * (`hawkAt`).
     */
    aloft?: {kind: "thermal" | "hawk"; share: number; slots: [number, number]; span: number};
    /** Its cruising height over the ground (m) where its way sets it, else its altitude band's. */
    height?: number;
};
export const FLIGHT_WAYS: Record<FlightWay, FlightWayRule> = {
    soar: {bout: 30, foray: 0.025, recipes: 0.12, station: "perch", flit: 0, aloft: {kind: "thermal", share: 0.55, slots: [8, 16], span: 36}},
    vulture: {bout: 36, foray: 0.015, recipes: 0.12, station: "perch", flit: 0, aloft: {kind: "thermal", share: 0.9, slots: [24, 36], span: 50}},
    stork: {bout: 24, foray: 0.02, recipes: 0.5, station: "shallows", flit: 0, aloft: {kind: "thermal", share: 0.3, slots: [10, 18], span: 40}},
    perch: {bout: 12, foray: 0.07, recipes: 0.35, station: "perch", flit: 0},
    aerial: {bout: 14, foray: 0.25, recipes: 0.5, station: "perch", flit: 0, height: 4, aloft: {kind: "hawk", share: 0.9, slots: [8, 13], span: 0}},
    swift: {bout: 30, foray: 0.25, recipes: 0.5, station: "perch", flit: 0, height: 6, aloft: {kind: "hawk", share: 1, slots: [60, 60], span: 0}},
    flit: {bout: 4, foray: 0.12, recipes: 0.4, station: "perch", flit: 1},
    tree: {bout: 5, foray: 0.05, recipes: 0.5, station: "perch", flit: 0.6},
    ground: {bout: 4, foray: 0.1, recipes: 0.4, station: "mixed", flit: 0.3},
    commute: {bout: 10, foray: 0.03, recipes: 0.3, forayEnds: 0.22, station: "perch", flit: 0.2},
    wader: {bout: 24, foray: 0.02, recipes: 0.6, station: "shallows", flit: 0, height: 5},
    shore: {bout: 8, foray: 0.06, recipes: 0.6, station: "ground", flit: 0, height: 2.5},
    patrol: {bout: 10, foray: 0.1, recipes: 0.4, station: "perch", flit: 0},
    hover: {bout: 6, foray: 0.12, recipes: 0.5, station: "perch", flit: 0.2},
    flower: {bout: 0, foray: 1, recipes: 1, station: "perch", flit: 0},
    dragon: {bout: 0, foray: 1, recipes: 1, station: "perch", flit: 0},
    bug: {bout: 0, foray: 1, recipes: 1, station: "perch", flit: 0}
};

/**
 * The bout a slot is in (pure in the rule, a seed and the slot): bouts of the rule's length, 0.7 to 1.3 of it by the
 * seed (the animal's own, for life), offset by it. `first` is its first slot; `index` counts bouts.
 */
export function stationBout(rule: Pick<FlightWayRule, "bout">, seed: number, slot: number): {index: number; first: number; slots: number} {
    const slots = Math.max(2, Math.round(rule.bout * (0.7 + 0.6 * seeded(seed, 11))));
    const off = Math.floor(seeded(seed, 12) * slots);
    const index = Math.floor((slot + off) / slots);
    return {index, first: index * slots - off, slots};
}

/** How many slots of a bout its time on the wing takes when it has one (pure; the hour is the schedule's to check): 0 for none. */
export function aloftSlots(rule: Pick<FlightWayRule, "aloft">, seed: number, bout: {index: number; slots: number}): number {
    if (!rule.aloft) return 0;
    if (seeded(seed, 31 + (bout.index % 100000) * 3) >= rule.aloft.share) return 0;
    const [lo, hi] = rule.aloft.slots;
    return Math.min(Math.max(Math.round(lo + (hi - lo) * seeded(seed, 32 + (bout.index % 100000) * 3)), 2), bout.slots);
}

/** The hours thermals rise in (island hours): from mid-morning, once the ground has warmed, to late afternoon. */
export const THERMAL_HOURS: [number, number] = [10, 16.5];

/**
 * A soar's numbers (thermal soaring, Pennycuick 1972, 1998; Shamoun-Baranes 2003): it circles at its glide's pace,
 * banked about 24 degrees (a buzzard's circle 15 to 20 m across its radius, a vulture's 25, a pelican's 40), climbing
 * slowly; then glides at its cruise to the next thermal, sinking. `reach` is how far from its home a thermal forms;
 * `span` how high it rides over its soar's floor; `wind` what the thermals drift with (m/s).
 */
export type SoarSpec = {circle: number; glide: number; radius: number; reach: number; span: number; climb: number; sink: number; wind: {x: number; z: number}; ease?: number};
export const SOAR_BANK = (24 * Math.PI) / 180;
/**
 * (`ease`, m/s²: how fast its pace changes between its circle's and its glide's: half of what its mass allows at a
 * take-off or a landing, since its track is read through a point a second and the curve through them changes pace up
 * to twice as fast as the points do; an eighth of a g when its paces do not say. It left a thermal and joined the next
 * at a step: a pelican from 15.5 to 11 m/s in a second, over its cap.)
 */
export function soarSpecOf(paces: Pick<AirPaces, "cruise" | "glide"> & Partial<Pick<AirPaces, "accel" | "brake">>, span: number, cap: number, wind: {x: number; z: number}): SoarSpec {
    const circle = paces.glide;
    const radius = clamp((circle * circle) / (G * Math.tan(SOAR_BANK)), 12, 45);
    return {circle, glide: paces.cruise, radius, reach: clamp(cap - radius, radius * 2, 110), span, climb: 0.4, sink: 1.2, wind, ease: 0.5 * Math.min(paces.accel ?? 0.25 * G, paces.brake ?? 0.25 * G)};
}

/** Where a soar is at a moment: its place, its height over its soar's floor (m), its heading, and whether it circles. */
export type SoarAt = {x: number; z: number; lift: number; yaw: number; circling: boolean; thermal: number};

/**
 * Where a soar is at a world time (pure in its seed, its home, its numbers and the time; the same for every viewer, and
 * with no memory: any moment is worked out on its own). Time is cut into thermals of one length (130 to 190 s, the
 * seed's own); each forms within reach of its home and drifts with the wind while it lasts. It joins a thermal's circle
 * on the tangent it came in by, circles its own way round, rising, leaves on the tangent that points at the next thermal,
 * and glides there in a line at its cruise, sinking, to arrive as that one starts. Never a loop about one fixed spot:
 * the circle is wide (its bank's), it climbs, and it drifts (the old failure, small tight circles over an animal's own
 * spot, is the behaviour audit's "circling" still). `member` (a flock's member, 1 up; 0 its leader or one alone)
 * rides the same thermals part of a turn behind, on its own radius and at its own height, as the birds of a kettle do,
 * strung round the circle: none flies at another's side. Thermals keep to the island: one that would form further from
 * the middle than its home is (and 60 m) forms towards the middle instead.
 */
export function soarAt(seed: number, home: {x: number; z: number}, spec: SoarSpec, time: number, member = 0): SoarAt {
    const P = 130 + 60 * seeded(seed, 9);
    const own = seed + member * 0.37;
    // (A member behind its leader by its own share of a turn of the circle, 0.12 to 0.88 of one, a golden step apart by
    // rank: never a whole turn behind, which is at its leader's side.)
    const t = time - (member ? ((Math.PI * 2 * spec.radius) / spec.circle) * (0.12 + 0.76 * frac(member * 0.381966)) : 0);
    const j = Math.floor(t / P);
    const centre = (k: number) => {
        // (Each about a third of the way round its home from the last, so two in a row are never on top of each other.)
        const a0 = seeded(seed, 40) * Math.PI * 2 + k * 2.399963 + (seeded(seed, 40 + (k % 100000) * 5) - 0.5) * 0.8;
        const d = spec.reach * (0.4 + 0.6 * Math.sqrt(seeded(seed, 41 + (k % 100000) * 5)));
        let x = home.x + Math.sin(a0) * d;
        let z = home.z + Math.cos(a0) * d;
        if (Math.hypot(x, z) > Math.max(Math.hypot(home.x, home.z), 60)) {
            const a = Math.atan2(-home.x, -home.z) + (seeded(seed, 42 + (k % 100000) * 5) - 0.5) * 1.2;
            x = home.x + Math.sin(a) * d;
            z = home.z + Math.cos(a) * d;
        }
        // (One way round for life: a bird has its side.)
        return {x, z, dir: seeded(seed, 43) < 0.5 ? 1 : -1};
    };
    const rhoOf = (k: number) => spec.radius * (member ? 0.8 + 0.4 * seeded(own, 5 + (((k % 1000) + 1000) % 1000)) : 1);
    /**
     * Thermal k's way out: how long its glide to the next takes, and the glide's heading: the line that leaves its
     * circle and joins the next one's on a tangent of both, each the way round it turns (for two circles a distance D
     * apart turning the same way, the line between their middles turned by asin((r' - r) / D); turning opposite ways,
     * the crossing tangent, by asin((r' + r) / D)).
     */
    const rate = spec.ease ?? 0.125 * G;
    const leave = (k: number, c: {x: number; z: number; dir: number}, n: {x: number; z: number; dir: number}) => {
        const lean = n.dir * rhoOf(k + 1) - c.dir * rhoOf(k);
        let glide = P * 0.15;
        let ux = 0;
        let uz = 1;
        for (let pass = 0; pass < 2; pass++) {
            const dx = n.x - (c.x + spec.wind.x * (P - glide));
            const dz = n.z - (c.z + spec.wind.z * (P - glide));
            const far = Math.hypot(dx, dz) || 1;
            // (u at angle a in (x, z) with its left normal (-uz, ux): the middles' line turned by asin(lean / D).)
            const a = Math.atan2(dz, dx) + Math.asin(clamp(lean / far, -0.95, 0.95));
            ux = Math.cos(a);
            uz = Math.sin(a);
            // (At its glide's pace however short the way: a second and a half at the least stood it nearly still in the
            // air where two thermals' circles all but touch, 3 m in 1.5 s for a pelican that glides at 15 m/s. And the
            // time it takes to speed up from its circle's pace and slow to the next one's, or all of a short way at its
            // circle's pace.)
            const way = Math.sqrt(Math.max(far * far - lean * lean, 0));
            glide = clamp(way / spec.glide + Math.min((spec.glide - spec.circle) ** 2 / (rate * spec.glide), way / spec.circle - way / spec.glide), 0.05, P * 0.45);
        }
        return {ux, uz, glide};
    };
    const before = centre(j - 1);
    const c = centre(j);
    const next = centre(j + 1);
    const cameIn = leave(j - 1, before, c);
    const goesOut = leave(j, c, next);
    const s = j * P;
    const e = s + P - goesOut.glide;
    const rho = rhoOf(j);
    // (On the circle at angle a from +z towards +x it is at (sin a, cos a) and heads dir x (cos a, -sin a).)
    const into = Math.atan2(-c.dir * cameIn.uz, c.dir * cameIn.ux);
    const out = Math.atan2(-c.dir * goesOut.uz, c.dir * goesOut.ux);
    // It turns at about its pace's rate, a little quicker or slower so that it comes round to its way out as it leaves.
    // (Every member the same number of turns in a thermal, its leader's: one on a smaller circle never laps it.)
    // (The angle it turns through in a thermal that it enters heading `from` and leaves heading `to` over `seconds`.)
    const turnOf = (from: number, to: number, dir: number, seconds: number) => {
        const part = ((((to - from) * dir) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        return part + Math.PI * 2 * Math.max(Math.round(((spec.circle / spec.radius) * seconds - part) / (Math.PI * 2)), 1);
    };
    const turned = turnOf(into, out, c.dir, e - s);
    const low = spec.span * (0.15 + 0.3 * seeded(seed, 44 + (j % 100000) * 5)) * (member ? 0.6 + 0.8 * seeded(own, 6) : 1);
    const high = spec.span * (0.7 + 0.3 * seeded(seed, 45 + (j % 100000) * 5)) * (member ? 0.75 + 0.25 * seeded(own, 7) : 1);
    if (t < e) {
        const k = (t - s) / (e - s);
        const a = into + c.dir * turned * k;
        return {x: c.x + spec.wind.x * (t - s) + Math.sin(a) * rho, z: c.z + spec.wind.z * (t - s) + Math.cos(a) * rho, lift: low + (high - low) * k, yaw: Math.atan2(c.dir * Math.cos(a), -c.dir * Math.sin(a)), circling: true, thermal: j};
    }
    const ex = c.x + spec.wind.x * (e - s) + Math.sin(out) * rho;
    const ez = c.z + spec.wind.z * (e - s) + Math.cos(out) * rho;
    const rhoNext = rhoOf(j + 1);
    const intoNext = Math.atan2(-next.dir * goesOut.uz, next.dir * goesOut.ux);
    const nx = next.x + Math.sin(intoNext) * rhoNext;
    const nz = next.z + Math.cos(intoNext) * rhoNext;
    const lowNext = spec.span * (0.15 + 0.3 * seeded(seed, 44 + ((j + 1) % 100000) * 5)) * (member ? 0.6 + 0.8 * seeded(own, 6) : 1);
    // Along its glide it eases from its circle's pace up to its glide's and down to the next circle's (each at `rate`,
    // the level pace between them the one that brings it there as that thermal starts), not at one pace from end to end.
    const T = Math.max(s + P - e, 1e-6);
    const D = Math.hypot(nx - ex, nz - ez);
    const afterNext = leave(j + 1, next, centre(j + 2));
    // (Each circle's pace over the ground along the glide's line: round its circle, and its thermal's drift.)
    const drift = (spec.wind.x * (nx - ex) + spec.wind.z * (nz - ez)) / Math.max(D, 1e-6);
    const vFrom = (rho * turned) / Math.max(e - s, 1e-6) + drift;
    const vTo = (rhoNext * turnOf(intoNext, Math.atan2(-next.dir * afterNext.uz, next.dir * afterNext.ux), next.dir, P - afterNext.glide)) / Math.max(P - afterNext.glide, 1e-6) + drift;
    const level = D / T;
    const r0 = Math.min(Math.abs(level - vFrom) / rate, T / 2);
    const r1 = Math.min(Math.abs(level - vTo) / rate, T / 2);
    const V = (D - (vFrom * r0) / 2 - (vTo * r1) / 2) / Math.max(T - r0 / 2 - r1 / 2, 1e-6);
    const tau = clamp(t - e, 0, T);
    const gone = tau < r0 ? vFrom * tau + ((V - vFrom) * tau * tau) / (2 * r0) : tau <= T - r1 ? ((vFrom + V) / 2) * r0 + V * (tau - r0) : D - (vTo * (T - tau) + ((V - vTo) * (T - tau) * (T - tau)) / (2 * Math.max(r1, 1e-6)));
    const k = D > 1e-6 ? clamp(gone / D, 0, 1) : tau / T;
    return {x: ex + (nx - ex) * k, z: ez + (nz - ez) * k, lift: high + (lowNext - high) * k, yaw: Math.atan2(nx - ex, nz - ez), circling: false, thermal: j};
}

/**
 * Where an aerial feeder is at a world time as it hawks (pure, no memory, the same for every viewer): long sweeps to
 * and fro over a patch, a figure of eight that turns one way and then the other (never a circle), quickest through its
 * middle and slowest round its ends; the eight's axis swings slowly round, its size breathes, and the patch's middle
 * wanders about its home. `lift` is its height over what is under it (m): low, with dips. `member` (a flock's member)
 * sweeps the same patch out of step with its leader. (A swallow's passes over a field or a pond are 20 to 60 m; a
 * bat's beat is the same shape, smaller.)
 */
export function hawkAt(seed: number, home: {x: number; z: number}, spec: {cruise: number; reach: number; low: number; high: number}, time: number, member = 0): SoarAt {
    const own = seed + member * 0.37;
    const p = (n: number) => seeded(own, n) * Math.PI * 2;
    const A0 = clamp(spec.cruise * 3.2, 6, 30);
    const at = (t: number) => {
        const A = A0 * (1 + 0.1 * Math.sin(t * 0.013 + p(1)));
        const B = A * 0.8;
        // (Its pace through the middle a little over its cruise, round the ends about half of it.)
        const theta = ((spec.cruise * 1.05) / Math.hypot(A0, A0 * 0.8)) * t + p(2);
        const axis = seeded(seed, 3) * Math.PI * 2 + 0.015 * t + (member ? p(4) * 0.2 : 0);
        const cx = home.x + spec.reach * 0.6 * Math.sin(t * 0.0041 + seeded(seed, 5) * 6.28);
        const cz = home.z + spec.reach * 0.6 * Math.cos(t * 0.0033 + seeded(seed, 6) * 6.28);
        const along = A * Math.sin(theta);
        const across = (B / 2) * Math.sin(2 * theta);
        return {x: cx + Math.sin(axis) * along + Math.cos(axis) * across, z: cz + Math.cos(axis) * along - Math.sin(axis) * across};
    };
    const here = at(time);
    const ahead = at(time + 0.1);
    const mid = (spec.low + spec.high) / 2;
    const lift = mid + ((spec.high - spec.low) / 2) * (0.7 * Math.sin(time * 0.31 + p(7)) + 0.3 * Math.sin(time * 0.83 + p(8)));
    return {x: here.x, z: here.z, lift, yaw: Math.atan2(ahead.x - here.x, ahead.z - here.z), circling: false, thermal: 0};
}

/**
 * A point of a track of [x, y, z] at even times, a share u of the way through it (a Catmull-Rom through its points), and
 * its heading and speed (per unit of u). `lead`: the track's point a step before its first and a step after its last
 * ([x, y, z] twice). Without it the curve's ends are its own end points twice, which halves its speed there and heads
 * it along its first and last chords: a soar's slots met at half pace and a quarter of a radian apart, every 80 s.
 */
export function trackAt(track: Float32Array, u: number, lead?: Float32Array | null): {x: number; y: number; z: number; yaw: number; rate: number} {
    const n = track.length / 3 - 1;
    const f = clamp(u, 0, 1) * n;
    const i = Math.min(Math.floor(f), n - 1);
    const t = f - i;
    const at = (k: number, c: number) => (lead && k < 0 ? lead[c] : lead && k > n ? lead[3 + c] : track[clamp(k, 0, n) * 3 + c]);
    const cr = (c: number) => {
        const a = at(i - 1, c);
        const b = at(i, c);
        const d = at(i + 1, c);
        const e = at(i + 2, c);
        return 0.5 * (2 * b + (-a + d) * t + (2 * a - 5 * b + 4 * d - e) * t * t + (-a + 3 * b - 3 * d + e) * t * t * t);
    };
    const dcr = (c: number) => {
        const a = at(i - 1, c);
        const b = at(i, c);
        const d = at(i + 1, c);
        const e = at(i + 2, c);
        return 0.5 * (-a + d + 2 * (2 * a - 5 * b + 4 * d - e) * t + 3 * (-a + 3 * b - 3 * d + e) * t * t);
    };
    const dx = dcr(0);
    const dz = dcr(2);
    return {x: cr(0), y: cr(1), z: cr(2), yaw: Math.atan2(dx, dz), rate: Math.hypot(dx, dz) * n};
}

/**
 * A soar's leg that takes off into it or comes down out of it (pure): up to its pace at its take-off's acceleration
 * when it starts on a perch or the ground, level, and down from it at its braking when it lands. An end up in the air
 * is at the soar's own speed there (`enter` where it starts, `leave` where it ends; its pace when not given) and eases
 * between that and its level pace at the same rates: it never steps. `seconds`: the time it has (it must be where its
 * soar is as its slot ends): its level pace is then the one that takes exactly that long at those rates, where the
 * leg used to be planned at its pace and squeezed into its slot, speeds and take-off with it (1.3 times a kite's cap).
 * It climbs over `climb` metres of its route from where it starts and comes down to land over its last `descend`
 * metres (for the rig's stages: its heights are its own).
 */
export function planSoarLeg(paces: AirPaces, length: number, opts: {pace: number; from: boolean; to: boolean; climb?: number; descend?: number; ski?: number; seconds?: number; enter?: number; leave?: number}): AirPlan {
    const L = Math.max(length, 0.01);
    const a = paces.accel;
    const b = paces.brake;
    const v0 = opts.from ? Math.max(opts.enter ?? opts.pace, 0) : 0;
    const v1 = opts.to ? Math.max(opts.leave ?? opts.pace, 0) : null;
    // The leg at a level pace V: from its speed at the start to V, level, to its speed at the end (and a ski to rest).
    // (The room it has left for level flight falls as V rises past both ends' speeds: what fits is every pace up to one.)
    const shape = (V: number, ski: number) => {
        const td = Math.min(ski, V);
        const end = v1 ?? td;
        const r0 = V >= v0 ? a : b;
        const r2 = V >= end ? b : a;
        const t = [Math.abs(V - v0) / r0, 0, Math.abs(V - end) / r2, v1 === null ? td / b : 0];
        const level = L - Math.abs(V * V - v0 * v0) / (2 * r0) - Math.abs(V * V - end * end) / (2 * r2) - (v1 === null ? (td * td) / (2 * b) : 0);
        t[1] = Math.max(level, 0) / Math.max(V, 1e-6);
        return {t, level, td, end, seconds: t[0] + t[1] + t[2] + t[3]};
    };
    let V = opts.pace;
    let ski = v1 === null ? Math.min(opts.ski ?? 0, V) : 0;
    if (shape(V, ski).level < 0) {
        // Too short to reach its pace: no ski, and the fastest it has the room for.
        ski = 0;
        let lo = 0;
        let hi = V;
        for (let k = 0; k < 50; k++) {
            const mid = (lo + hi) / 2;
            if (shape(mid, ski).level >= 0) lo = mid;
            else hi = mid;
        }
        V = Math.max(lo, 1e-3);
    }
    if (opts.seconds !== undefined && opts.seconds > 0) {
        // The level pace that takes the time it has (the quicker, the sooner there): from a third of its pace to 1.6
        // times its cruise, and never more than it has the room to reach.
        let lo = Math.min(opts.pace / 3, V);
        let hi = Math.max(paces.cruise * 1.6, opts.pace);
        const slowest = shape(lo, ski);
        if (slowest.level >= 0) {
            for (let k = 0; k < 60 && slowest.seconds > opts.seconds; k++) {
                const mid = (lo + hi) / 2;
                const at = shape(mid, ski);
                if (at.level >= 0 && at.seconds > opts.seconds) lo = mid;
                else hi = mid;
            }
            V = lo;
        }
    }
    const {t, td, end} = shape(V, ski);
    const seconds = Math.max(t[0] + t[1] + t[2] + t[3], 0.05);
    const speeds = [V, V, end, 0];
    const top = Math.max(V, 1e-6);
    const knots = [0, v0 / top];
    let at = 0;
    for (let i = 0; i < 4; i++) {
        if (t[i] <= 1e-6) continue;
        at += t[i];
        knots.push(Math.min(at / seconds, 1), speeds[i] / top);
    }
    if (knots[knots.length - 2] < 1) knots.push(1, v1 === null ? 0 : end / top);
    const dSki = v1 === null ? (td * td) / (2 * b) : 0;
    return {seconds, knots, liftoff: 0, touchdown: 1 - dSki / L, rise: clamp((opts.climb ?? 0) / L, 1e-4, 0.9), fall: clamp((opts.descend ?? 0) / L, 1e-4, 0.9), height: 0, peak: V, soar: {from: opts.from, to: opts.to}};
}

// MARK: The beat

/**
 * The flap clip's phase for a beat (0-1, 0 = wings up, the downstroke first): the downstroke over `downstroke` of the
 * beat, the upstroke over the rest, each a half cosine stroke; `stroke` < 1 keeps the wings nearer the middle (a
 * whir). The clip is a cosine stroke itself (top at 0, bottom at 0.5), so the stroke position is mapped back through it.
 */
export function strokeToClipPhase(beat: number, downstroke: number, stroke = 1, clipDownstroke?: number | null): number {
    const b = frac(beat);
    const d = clamp(downstroke, 0.2, 0.8);
    const down = b < d;
    // The stroke position: +1 at the top, -1 at the bottom.
    const s = down ? Math.cos((Math.PI * b) / d) : -Math.cos((Math.PI * (b - d)) / (1 - d));
    const a = Math.acos(clamp(s * clamp(stroke, 0, 1), -1, 1)) / Math.PI;
    // A v7 flap (rig code v7, MA2's v3 birds) bakes its own beat: its downstroke over `clipDownstroke` of the clip, the
    // stroke position cos(π p / c) on p < c, then −cos(π (p − c) / (1 − c)): mapped back through that, not v2's cosine.
    if (clipDownstroke !== undefined && clipDownstroke !== null && Number.isFinite(clipDownstroke)) {
        const c = clamp(clipDownstroke, 0.2, 0.8);
        return down ? a * c : c + (1 - a) * (1 - c);
    }
    const q = a / 2;
    return down ? q : 1 - q;
}

/**
 * What a rig's own flight clip already bakes (MA2's v3 birds, rig code v7: `docs/ark/rig-v2-manifest.md` section 9), so
 * L2's drivers do not add it a second time: the flap's downstroke share, how far the clip itself tucks the legs (1, 0.7,
 * 0.45 or 0.25), the take-off's lift-off and the landing's touch-down (clip phases), its rise (mesh heights). Null for a
 * v2 file: everything plays as before.
 */
export type ClipBake = {downstroke: number | null; tuck: number | null; liftoff: number | null; touchdown: number | null; riseH: number | null};
export function clipBakeOf(code: string | null | undefined, clip: {downstroke?: number; tuck?: number; liftoff?: number; touchdown?: number; rise_h?: number} | null | undefined): ClipBake | null {
    if (!clip || typeof code !== "string" || !code.startsWith("v7")) return null;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {downstroke: num(clip.downstroke), tuck: num(clip.tuck), liftoff: num(clip.liftoff), touchdown: num(clip.touchdown), riseH: num(clip.rise_h)};
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

// MARK: A flyer drawn without a rig

/** The most a flyer drawn without a rig is pitched in the air (radians, either way: 14 degrees). */
export const UNRIGGED_PITCH_MOST = 0.25;
/**
 * The body's pitch of a flyer drawn without a rig, its standing mesh carried along its flight (lane B5; the scene's
 * sense, + nose down): level through level flight, nose up on its run and its climb out of a take-off, a little
 * nose down on its glide-in. Never past UNRIGGED_PITCH_MOST. (It was 0.95 rad nose down for the whole of every flight,
 * the first scene's "glide": a standing mesh tipped on its head, most plainly a flamingo's. A rigged flyer's attitude
 * is its rig's: `flightRigFrame`.) The scene eases towards it, so a change of stage is not a snap.
 */
export function unriggedFlightPitch(stage: AirStage | null): number {
    const want = stage === "run" || stage === "climb" ? -0.2 : stage === "descend" || stage === "ski" ? 0.1 : 0;
    return clamp(want, -UNRIGGED_PITCH_MOST, UNRIGGED_PITCH_MOST);
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

/**
 * The take-off and landing clips' own rise (`rig_ark.py`: the root lifts 1.2 H·(v − 0.25)^1.5 once the push-off is
 * done, v the clip's progress; the landing is the take-off reversed), in drawn heights. The schedule's pose already
 * carries the body up and down (MA1), so the rig takes this back off and only the limbs come from the clip: no double
 * rise, no drop when the take-off hands over to the flap.
 */
export function clipRise(clip: "takeoff" | "land", phase: number, bake?: ClipBake | null): number {
    const v = clip === "takeoff" ? clamp(phase, 0, 1) : 1 - clamp(phase, 0, 1);
    // (v7 publishes its lift-off, touch-down and rise: v2's are 0.25, 0.75 and 1.2.)
    const off = clip === "takeoff" ? bake?.liftoff ?? 0.25 : 1 - (bake?.touchdown ?? 0.75);
    return (bake?.riseH ?? 1.2) * Math.max(v - off, 0) ** 1.5;
}

/**
 * How far its legs are drawn back under the tail (0-1, L2's `tuckLegs`; MA1: the baked flap leaves them hanging): not
 * on a run across the water or a ski onto it (the feet patter and plane), coming up through the take-off once the
 * push-off is done, all of flight, and letting down through the first half of the landing to reach for the ground.
 */
export function legTuck(clip: string, phase: number, stage: AirStage | null, bake?: ClipBake | null): number {
    if (stage === "run" || stage === "ski") return 0;
    // (A v7 clip tucks its own legs: only what it leaves, `1 − tuck`, in flight; none through its take-off and landing,
    // whose feet are planted before lift-off and after touch-down and tucked by the clip in between.)
    if (bake && (clip === "takeoff" || clip === "land")) return 0;
    const left = bake ? 1 - clamp(bake.tuck ?? 0, 0, 1) : 1;
    if (clip === "takeoff") return smooth((phase - 0.35) / 0.35);
    if (clip === "land") return 1 - smooth(phase / 0.45);
    return clip === "flap" || clip === "glide" || clip === "soar" || clip === "bank_l" || clip === "bank_r" ? left : 0;
}

/**
 * The rig player's flying state, frame by frame (MA1: out of `index.ts` rigFor so it can be tested): when it starts
 * flying and plays its take-off, when the landing plays, and when it is down. `stage` is its air leg's (the schedule's
 * pose), when it is on one.
 * - A take-off plays leaving the ground, unless it comes into view already up, or it is on a run across the water or
 *   the ground (it flaps from its first step: the spring is the jump of a bird that leaves standing).
 * - The landing plays when the scene says it is coming down (`landing`), never on a run, a climb or level flight.
 * - A landing clip left from a flight cut short (a clock jump, a new leg) is dropped the moment its pose climbs or flies
 *   level again: it never plays on through the next flight (the audit's coot, rec3 `coot-takeoff`).
 * `play`: a one-shot to start from its first frame; "flight": leave the one-shot for whatever the flight frame picks.
 */
export type FlightGateInput = {
    flies: boolean;
    flying: boolean;
    inAir: boolean;
    rising: boolean;
    landing: boolean;
    /** How far its state's air has eased in (0-1). */
    air: number;
    now: string | null;
    phase: number;
    stage: AirStage | null;
    hasTakeoff: boolean;
    hasLand: boolean;
};
export function flightGate(g: FlightGateInput): {flying: boolean; play: "takeoff" | "land" | "flight" | null; landed: boolean} {
    let flying = g.flying;
    let now = g.now;
    let phase = g.phase;
    let play: "takeoff" | "land" | "flight" | null = null;
    const climbing = g.stage === "run" || g.stage === "climb" || g.stage === "cruise";
    if (g.flies && !flying && g.inAir && g.rising) {
        flying = true;
        if (g.air < 0.35 && g.hasTakeoff && g.stage !== "run") play = "takeoff";
        else if (now === "land" || now === "takeoff") play = "flight";
    } else if (flying && (!g.flies || (!g.inAir && g.air <= 0.001)) && now !== "land") flying = false;
    if (play === "takeoff") {
        now = "takeoff";
        phase = 0;
    }
    if (flying && now === "land" && climbing) {
        play = "flight";
        now = null;
    }
    const landing = g.landing && (g.stage === null || !climbing);
    if (flying && landing && !(now === "takeoff" && phase < 1) && now !== "land" && g.hasLand) {
        play = "land";
        now = "land";
        phase = 0;
    }
    if (flying && now === "land" && phase >= 1) return {flying: false, play, landed: true};
    return {flying, play, landed: false};
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
    /** Its height as drawn (m): the take-off's and the landing's own rise are taken back off (`clipRise`). */
    drawnHeight?: number;
    /** Its air leg's stage on the schedule (MA1), when it is on one: a run patters at full effort, a ski holds the touch-down. */
    stage?: AirStage | null;
    /** What the rig's own clip bakes (`clipBakeOf`: a v7 file), or null (v2). */
    bake?: (name: string) => ClipBake | null;
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
    const height = input.drawnHeight ?? 0;
    // A take-off: the crouch, the spring and the first beats from the clip at its own pace, then hard flaps take over.
    // (MA1: it was cut at 0.42 played half as fast again, 0.3 s. Now the whole spring; and for a bird whose wings beat
    // slower than about 4.5 a second, the clip's own two beats too. The clip's rise is taken back off: the schedule lifts it.)
    if (input.oneShot === "takeoff") {
        memory.takeoffAt = input.clock;
        if (input.phase < (spec.trueHz <= 4.5 ? 1 : 0.55) || !has("flap")) {
            Object.assign(out, {clip: "takeoff", mode: "time", rate: 1, flightMode: "takeoff", roll: 0, bank: 0, heave: -clipRise("takeoff", input.phase, input.bake?.("takeoff")) * height});
            memory.beat = 0;
            memory.wasClip = "takeoff";
            return out;
        }
    }
    if (input.oneShot === "land") {
        // The touch-down: the clip's phase follows the height left (legs reaching down as the ground comes up), never
        // going back, and finishes in time once down (the wings folding away).
        // (MA1: on an air leg it touches down (0.8) only on its landing's surface, and holds there skiing across the
        // water; the clip's own fall is taken back off, the schedule brings it down.)
        if (memory.wasClip !== "land") memory.landPhase = input.phase;
        const reach = Math.max(input.landHeight ?? 0, 0.05);
        const byHeight = input.landHeight ? 1 - Math.min(Math.max(input.agl, 0) / reach, 1) : 0;
        // (On an air leg, down once on its landing's surface and nearly stopped: it brakes its last metre or two on its
        // feet with its wings up, not running; up to a perch from below, not before it is there.)
        const down = input.agl <= 0.02 && (!input.stage || (input.agl >= -0.05 && input.speed < Math.max((input.drawnLength ?? spec.lengthM) * 1.5, 0.4)));
        // (The clip's own touch-down a little in: v2's 0.75, so 0.8; a v7 file publishes it.)
        const bake = input.bake?.("land") ?? null;
        const touch = (bake?.touchdown ?? 0.75) + 0.05;
        let phase = Math.min(Math.max(byHeight * touch, memory.landPhase + dt * (down ? 1.6 : 0.5)), 1);
        if (input.stage === "ski") phase = Math.min(Math.max(memory.landPhase, touch - 0.02), touch);
        else if (input.stage && !down) phase = Math.min(phase, touch);
        memory.landPhase = phase;
        // (The flare's nose-up eases out into the clip's own attitude.)
        Object.assign(out, {clip: "land", mode: "sync", phase, flightMode: "land", pitch: -0.55 * memory.flare * (1 - smooth(phase / touch)), roll: 0, bank: 0, heave: -clipRise("land", phase, bake) * height});
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
    // (MA1: a run across the water or the ground is the take-off: hard flaps from its first step.)
    if (input.stage === "run") memory.takeoffAt = input.clock;
    const sinceTakeoff = input.clock - memory.takeoffAt;
    const descending = input.climb < -0.06;
    const drawn = input.drawnLength ?? spec.lengthM;
    const flareHeight = Math.max(1.2, drawn * 3);
    // (MA1: on an air leg only on its glide-in, over the surface it lands on: never over a dip mid-flight.)
    const wantFlare = descending && input.agl < flareHeight && input.agl > 0.02 && (!input.stage || input.stage === "descend") ? 1 : 0;
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
        out.phase = strokeToClipPhase(memory.beat, down, spec.stroke, input.bake?.("flap")?.downstroke);
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
