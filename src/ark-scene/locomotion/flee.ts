/**
 * Fast movement and flight from danger (lane L1, for L7's chases and the reactive layer's flee): top speeds by size
 * and body plan, and flee paths (straight, zigzag, darting) as pure functions of time, the same for every viewer.
 * The legged driver then picks the gait from the speed (gallop, bound, a lizard's sprawling run, an insect's tripod).
 *
 * Speeds: Hirt et al. 2017 (Nature Ecology & Evolution, "A general scaling law reveals why the largest animals are
 * not the fastest"): v_max = 25.5 · M^0.26 · (1 − e^(−22·M^−0.6)) km/h for running animals, M in kg; the mass from
 * body length by the catalogue's own allometry (L = 0.33 · M^(1/3)); the species' speed stat moves it ±30%.
 */

import type {BodyPlan} from "@/ark-scene/locomotion/types";
import {G} from "@/ark-scene/locomotion/gaits";

export type PaceInput = {plan: BodyPlan | string | null; slug?: string; length: number; speedStat?: number | null};

/** A body's mass (kg) from its length (m): the catalogue's allometry, inverted. */
export const massFromLength = (length: number) => Math.pow(Math.max(length, 0.002) / 0.33, 3);

/** Hip height as a share of body length, by plan (when no rig is loaded). */
export function hipShare(plan: string | null | undefined): number {
    switch (plan) {
        case "quadruped":
            return 0.55;
        case "primate":
            return 0.5;
        case "walking_bird":
        case "flying_bird":
            return 0.35;
        case "flightless_bird":
            return 0.6;
        case "lizard":
        case "amphibian":
            return 0.14;
        case "turtle":
            return 0.18;
        case "insect":
        case "arachnid":
        case "crustacean":
            return 0.3;
        default:
            return 0.4;
    }
}

/** Top running speed (m/s) for a body: the allometric law, by plan, moved by the speed stat. */
export function sprintPace(input: PaceInput): number {
    const L = Math.max(input.length, 0.002);
    const stat = Math.min(Math.max(input.speedStat ?? 50, 0), 100);
    const statK = 0.7 + 0.6 * (stat / 100);
    const M = massFromLength(L);
    const hirt = (25.5 * Math.pow(M, 0.26) * (1 - Math.exp(-22 * Math.pow(M, -0.6)))) / 3.6;
    switch (input.plan) {
        case "insect":
        case "arachnid":
            return Math.min(18 * L * statK, 1.2);
        case "crustacean":
            return Math.min(8 * L * statK, 1.5);
        case "lizard":
            return Math.min(hirt * 0.55 * statK, 25 * L);
        case "amphibian":
            return Math.min(hirt * 0.35 * statK, 12 * L);
        case "turtle":
            return Math.min(0.6 * L * statK, 0.5);
        case "walking_bird":
        case "flying_bird":
            // On foot (a flyer takes off instead): a quick run.
            return Math.min(hirt * 0.5 * statK, 10 * L);
        default:
            return hirt * statK;
    }
}

/** A short burst (a pounce, a dart): faster than it can hold, for about a second. */
export const burstPace = (input: PaceInput) => sprintPace(input) * 1.08;

/** A held flee (a herd running off, not yet chased hard): about two thirds of the sprint. */
export const fleePace = (input: PaceInput) => sprintPace(input) * 0.65;

/** The Froude number a speed is at for this body (what the gait engine reads), and so its gait's class. */
export function froudeAt(input: PaceInput, speed: number): number {
    const hip = Math.max(input.length * hipShare(input.plan as string), 0.003);
    return (speed * speed) / (G * hip);
}

/** How long it takes to reach its top speed (s): small animals in a few strides, big ones over a second or two. */
export const accelTime = (length: number) => Math.min(Math.max(0.25 + 0.45 * Math.sqrt(Math.max(length, 0.01)), 0.25), 2.2);

export type FleeStyle = "straight" | "zigzag" | "dart";

/** The flee style a body uses: small prey dart, mid-size prey zigzag (hares, gazelles), big animals run straight. */
export function fleeStyle(input: PaceInput): FleeStyle {
    if (input.plan === "insect" || input.plan === "arachnid" || input.plan === "amphibian" || input.plan === "lizard") return "dart";
    if (input.length < 0.35) return "dart";
    if (input.length < 2.2) return "zigzag";
    return "straight";
}

export type FleeInput = {
    from: {x: number; z: number};
    /** Where the danger is (it runs away from it). */
    threat: {x: number; z: number};
    /** Shared clock (s) at which it starts, and its own seed in [0, 1). */
    start: number;
    seed: number;
    pace: PaceInput;
    style?: FleeStyle;
    /** Top speed (m/s; default its sprint). */
    speed?: number;
    /** It stops after this long (s; default 6). */
    seconds?: number;
};

export type FleePoint = {x: number; z: number; yaw: number; speed: number; moving: boolean};

const hash = (a: number, b: number) => {
    const s = Math.sin(a * 91.7 + b * 157.3) * 43758.5453;
    return s - Math.floor(s);
};

/**
 * Where a fleeing animal is at `clock`: a pure function of the inputs (the same for every viewer). It accelerates
 * away from the threat; a zigzag cuts left and right (25-45 degrees) every 0.5-1.1 s scaled by size; a dart runs
 * bursts with sharp cuts (60-110 degrees) and short freezes; it slows into tight cuts and stops at the end.
 * Integrated in 1/30 s steps from the start (a few hundred steps at most).
 */
export function fleeAt(input: FleeInput, clock: number): FleePoint {
    const style = input.style ?? fleeStyle(input.pace);
    const top = input.speed ?? sprintPace(input.pace);
    const L = Math.max(input.pace.length, 0.01);
    const seconds = input.seconds ?? 6;
    const tau = accelTime(L) / 3;
    const turnRate = Math.min(Math.max(7 / Math.sqrt(L), 2), 14);
    const away = Math.atan2(input.from.x - input.threat.x, input.from.z - input.threat.z);
    const segment = style === "dart" ? 0.35 + 0.35 * Math.sqrt(L) : 0.5 + 0.6 * Math.sqrt(Math.min(L, 2));
    let x = input.from.x;
    let z = input.from.z;
    let yaw = away;
    let v = 0;
    const t = Math.min(Math.max(clock - input.start, 0), seconds + 2);
    const h = 1 / 30;
    let moving = false;
    for (let s = 0; s < t; s += h) {
        const step = Math.min(h, t - s);
        const k = Math.floor(s / segment);
        const r = hash(k, input.seed * 977);
        let want = away;
        let paused = false;
        if (style === "zigzag" && k > 0) want = away + (k % 2 ? 1 : -1) * (0.44 + 0.35 * r);
        if (style === "dart" && k > 0) {
            want = away + (r - 0.5) * 2 * (1.05 + 0.85 * hash(k, 3.1));
            paused = hash(k, input.seed * 13 + 7) < 0.3 && (s % segment) < segment * 0.45;
        }
        const ending = s > seconds;
        let d = want - yaw;
        d = d - Math.round(d / (Math.PI * 2)) * Math.PI * 2;
        yaw += Math.sign(d) * Math.min(Math.abs(d), turnRate * step);
        // Slows into a cut (the sharper, the slower), stops at the end or a freeze.
        const cut = Math.min(Math.abs(d) / 1.2, 1);
        const target = paused || ending ? 0 : top * (1 - 0.45 * cut);
        v += (target - v) * Math.min(step / tau, 1);
        x += Math.sin(yaw) * v * step;
        z += Math.cos(yaw) * v * step;
        moving = v > 0.05 * top;
    }
    return {x, z, yaw, speed: v, moving};
}

/**
 * Progress along a leg of `seconds` with a speed-up and a slow-down of `ramp` seconds each (the shape a walk or run
 * leg should have rather than starting and stopping at full speed): the share of the distance covered at time `t`.
 * Pure; for the schedule's legs (behaviour-schedule.ts) when its owner adopts it.
 */
export function rampedProgress(t: number, seconds: number, ramp: number): number {
    const T = Math.max(seconds, 1e-6);
    const r = Math.min(Math.max(ramp, 0), T / 2);
    const u = Math.min(Math.max(t, 0), T);
    if (r <= 1e-6) return u / T;
    const vPeak = 1 / (T - r);
    if (u < r) return (0.5 * vPeak * u * u) / r;
    if (u > T - r) {
        const w = T - u;
        return 1 - (0.5 * vPeak * w * w) / r;
    }
    return 0.5 * vPeak * r + vPeak * (u - r);
}
