/**
 * Stamina and exposure (design §5.2): computed on the server only, sent to the controller at 2 Hz.
 *
 * Stamina E (0–1) drains by `base(mode) × (1 + 2 (1 − S))` a second and comes back at rest (1 %/s at S = 1, 0.3 %/s at
 * S = 0.3, none at S ≤ 0.15). Exposure X (0–1) rises by `(0.6 − S) / 600` a second while S < 0.6 and falls by 1/600 a
 * second in suitable habitat.
 *
 *   E < 60 %   breathing faster, head lower (body language only)
 *   E < 35 %   exhausted: no running, the walk cap × 0.6
 *   E < 15 %   distressed: it stops for 3 s in every 10 s
 *   E = 0      it lies down for 20 s
 *   X > 0.3    uncomfortable (shivering, panting, a fish gasping)
 *   X > 0.6    distressed: stamina drains twice as fast
 *   X > 0.9    in danger: control ends, it heads home as an NPC (no death during control, D6)
 *
 * Pure.
 */

import type {Clip, Mode} from "@/ark-live/protocol";

export const DRAIN_PER_S = {
    idle: 0,
    glide: 0.0005,
    walk: 0.001,
    swim: 0.0015,
    climb: 0.004,
    burrow: 0.005,
    run: 0.006,
    flap: 0.008,
    paddle: 0.015,
    sprint: 0.02
} as const;
export type DrainKind = keyof typeof DRAIN_PER_S;

export const EXPOSURE_WINDOW_S = 600;
export const LIE_DOWN_S = 20;
export const DISTRESS_PERIOD_S = 10;
export const DISTRESS_STOP_S = 3;
export const WAKE_STAMINA = 0.5;

export type Meters = {
    stamina: number;
    exposure: number;
    /** Server seconds until which it lies exhausted (E reached 0), or 0. */
    lyingUntil: number;
};

export function freshMeters(asleep = false): Meters {
    return {stamina: asleep ? WAKE_STAMINA : 1, exposure: 0, lyingUntil: 0};
}

/** What the animal is spending energy on now. */
export function drainKind(mode: Mode, clip: Clip, speed: number, caps: {walk: number; run: number}): DrainKind {
    if (speed < 0.05 && clip !== "flap" && clip !== "hover") return mode === "air" ? (clip === "glide" || clip === "soar" ? "glide" : "flap") : "idle";
    switch (mode) {
        case "air":
        case "strait":
            return clip === "glide" || clip === "soar" || clip === "plunge" ? "glide" : "flap";
        case "swim":
            return "swim";
        case "paddle":
            return "paddle";
        case "climb":
            return "climb";
        case "burrow":
            return "burrow";
        default:
            if (clip === "sprint") return "sprint";
            if (clip === "run" || (caps.run > 0 && speed > caps.walk * 1.15)) return "run";
            return "walk";
    }
}

export function regenPerS(s: number): number {
    if (s <= 0.15) return 0;
    if (s < 0.3) return ((s - 0.15) / 0.15) * 0.003;
    return 0.003 + ((Math.min(s, 1) - 0.3) / 0.7) * 0.007;
}

/** One step of the meters (`nowS`: server seconds). */
export function stepMeters(m: Meters, input: {kind: DrainKind; s: number; dt: number; nowS: number; talking?: boolean}): Meters {
    const {kind, s, dt, nowS} = input;
    let stamina = m.stamina;
    if (input.talking || kind === "idle") {
        stamina += regenPerS(s) * dt;
    } else {
        const exposureFactor = m.exposure > 0.6 ? 2 : 1;
        stamina -= DRAIN_PER_S[kind] * (1 + 2 * (1 - s)) * exposureFactor * dt;
    }
    stamina = Math.min(Math.max(stamina, 0), 1);
    let exposure = m.exposure;
    exposure += s < 0.6 ? ((0.6 - s) * dt) / EXPOSURE_WINDOW_S : -dt / EXPOSURE_WINDOW_S;
    exposure = Math.min(Math.max(exposure, 0), 1);
    let lyingUntil = m.lyingUntil;
    if (stamina <= 0 && lyingUntil <= nowS) lyingUntil = nowS + LIE_DOWN_S;
    if (lyingUntil > nowS) stamina = Math.max(stamina, 0);
    // Lying down restores a little, so it can get up.
    if (lyingUntil > nowS) stamina = Math.min(1, stamina + regenPerS(Math.max(s, 0.3)) * dt);
    return {stamina, exposure, lyingUntil: lyingUntil > nowS ? lyingUntil : 0};
}

export type Signals = {
    breathless: boolean;
    exhausted: boolean;
    distressed: boolean;
    /** Held still now: lying exhausted, or a distressed stop. */
    held: boolean;
    lying: boolean;
    uncomfortable: boolean;
    distressedByPlace: boolean;
    inDanger: boolean;
    noRun: boolean;
    /** A factor on its walk cap. */
    walkFactor: number;
};

/** What the meters mean now (`nowS`: server seconds; the distress stops run on the server's clock). */
export function signals(m: Meters, nowS: number): Signals {
    const lying = m.lyingUntil > nowS;
    const distressed = m.stamina < 0.15;
    const stop = distressed && ((nowS % DISTRESS_PERIOD_S) + DISTRESS_PERIOD_S) % DISTRESS_PERIOD_S < DISTRESS_STOP_S;
    const exhausted = m.stamina < 0.35;
    return {
        breathless: m.stamina < 0.6,
        exhausted,
        distressed,
        held: lying || stop,
        lying,
        uncomfortable: m.exposure > 0.3,
        distressedByPlace: m.exposure > 0.6,
        inDanger: m.exposure > 0.9,
        noRun: exhausted,
        walkFactor: exhausted ? 0.6 : 1
    };
}
