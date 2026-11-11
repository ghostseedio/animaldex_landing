/**
 * Swimming bodies (motion pass lane L2): how each kind of swimmer bends, and how fast it beats for how fast it goes.
 *
 * The wave: a lateral (or, for whales, dolphins, manatees and flatfish, up-and-down) bend that runs from the head to
 * the tail, `envelope(s) · sin 2π(phase − s · waves)` with s = 0 at the head and 1 at the tail tip. Its shape is the
 * swimming mode's (Lindsey 1978; Sfakiotakis 1999):
 * - anguilliform (eels, lampreys, sea snakes): the whole body, a wave and a bit on it;
 * - subcarangiform (most fish): the rear half;
 * - carangiform (jacks, herring): the rear third;
 * - thunniform (tuna, mako, swordfish): only the peduncle and the crescent tail;
 * - fin-driven (boxfish, puffers, seahorses) and labriform (wrasses, damsels): the body nearly still, a light tail;
 * - flatfish: lying on its side, the whole flat body ripples up and down;
 * - rajiform (stingrays): a wave runs front to back along the fin's edge; mobuliform (mantas, eagle rays): big slow
 *   flaps of the wing-like fins;
 * - cetacean and sirenian: up and down, the flukes.
 *
 * The rate: a beat carries the body a stride of 0.4 (eels) to 0.9 (tuna, dolphins) body lengths (Bainbridge 1958:
 * speed ∝ tail-beat rate; Videler 1993), so f = f_hold + speed / (stride · L). Played by the distance swum
 * (`swimCycles`), a burst beats faster by itself and a still fish only fins.
 *
 * Visual only; nothing here moves an animal.
 */

import type {SwimStyle} from "@/ark-scene/locomotion/styles";

export type SwimParams = {
    /** Bend side to side (x) or up and down (y, in the model's space). */
    axis: "x" | "y";
    /** The envelope h + (1 - h) s^p: the head's share and how fast it grows to the tail. */
    head: number;
    power: number;
    /** Wavelengths on the body (a ray's: along its fin, front to back). */
    waves: number;
    /** Body lengths a beat carries it. */
    stride: number;
    /** The tail tip's swing (share of the length, half of side to side); a ray's: of its half span. */
    tip: number;
    /** Beats a second when it holds still (fins), and the fastest beat it makes. */
    hold: number;
    maxHz: number;
    /** A ray's fins: the wave runs along the fin's edge (`wave`) or the fin flaps as a wing (`flap`). */
    fin?: "wave" | "flap";
};

export const SWIM: Readonly<Record<SwimStyle, SwimParams>> = {
    anguilliform: {axis: "x", head: 0.3, power: 1.2, waves: 1.2, stride: 0.42, tip: 0.08, hold: 0.25, maxHz: 6},
    subcarangiform: {axis: "x", head: 0.1, power: 2, waves: 0.9, stride: 0.6, tip: 0.1, hold: 0.35, maxHz: 14},
    carangiform: {axis: "x", head: 0.05, power: 2.6, waves: 0.8, stride: 0.7, tip: 0.1, hold: 0.35, maxHz: 16},
    thunniform: {axis: "x", head: 0.03, power: 4, waves: 0.65, stride: 0.85, tip: 0.09, hold: 0.3, maxHz: 12},
    ostraciiform: {axis: "x", head: 0, power: 5, waves: 0.3, stride: 0.22, tip: 0.05, hold: 0.6, maxHz: 6},
    labriform: {axis: "x", head: 0.05, power: 3, waves: 0.5, stride: 0.3, tip: 0.04, hold: 0.7, maxHz: 6},
    flatfish: {axis: "y", head: 0.25, power: 1.3, waves: 1.1, stride: 0.45, tip: 0.07, hold: 0.2, maxHz: 6},
    rajiform: {axis: "y", head: 0.1, power: 2, waves: 1.3, stride: 0.45, tip: 0.1, hold: 0.25, maxHz: 3, fin: "wave"},
    mobuliform: {axis: "y", head: 0.05, power: 2, waves: 0.35, stride: 0.9, tip: 0.32, hold: 0.15, maxHz: 1.5, fin: "flap"},
    cetacean: {axis: "y", head: 0.04, power: 3, waves: 0.6, stride: 0.85, tip: 0.1, hold: 0.08, maxHz: 3},
    sirenian: {axis: "y", head: 0.05, power: 2.5, waves: 0.55, stride: 0.55, tip: 0.08, hold: 0.06, maxHz: 1.2}
};

/** The fastest beat shown (Hz): six or more frames a beat at 60 fps. */
export const SWIM_DISPLAY_HZ = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** The wave's size along the body (0 at the head end ... 1 at the tail): h + (1 - h) s^p. */
export function swimEnvelope(style: SwimStyle, s: number): number {
    const p = SWIM[style];
    return p.head + (1 - p.head) * clamp(s, 0, 1) ** p.power;
}

/** The tail-beat rate (Hz, true) for a speed in body lengths a second. */
export function tailBeatHz(speedBLs: number, style: SwimStyle): number {
    const p = SWIM[style];
    return clamp(p.hold + Math.max(speedBLs, 0) / p.stride, p.hold, p.maxHz);
}

/**
 * Cruise and burst paces (body lengths a second and m/s) for a swimmer of this length (m) and style (L7's chases read
 * these). Cruise U = 1.1 L^0.45 m/s, at most 4 (small fish 3-4 body lengths a second, a dolphin 0.7, a blue whale
 * 0.15); tuna and mako 1.5 times that. A burst 6 times cruise for a small fish down to twice for a whale.
 */
export function swimPaces(lengthM: number, style: SwimStyle): {cruiseBLs: number; burstBLs: number; cruise: number; burst: number} {
    const L = Math.max(lengthM, 0.01);
    const fast = style === "thunniform" ? 1.5 : style === "ostraciiform" || style === "labriform" ? 0.6 : style === "sirenian" ? 0.5 : 1;
    const cruise = clamp(1.1 * L ** 0.45 * fast, 0.08, 4);
    const burst = cruise * clamp(4 * L ** -0.2, 1.8, 6);
    return {cruiseBLs: cruise / L, burstBLs: burst / L, cruise, burst};
}

/**
 * The bend at a point of the body (share of the body length), for a phase in beats: the reference the shader's GLSL
 * mirrors (`animal-material.ts` MOTION_BODY) and the tests measure.
 */
export function swimBend(style: SwimStyle, s: number, phase: number, gain = 1): number {
    const p = SWIM[style];
    return p.tip * gain * swimEnvelope(style, s) * Math.sin(2 * Math.PI * (phase - clamp(s, 0, 1) * p.waves));
}

/** Per animal, per viewer (visual only): beats swum so far. */
export type SwimMemory = {cycles: number; speed: number};

export function newSwimMemory(seed = 0): SwimMemory {
    return {cycles: seed, speed: 0};
}

/**
 * Beats on after swimming `distance` metres in `dt` seconds, at length `lengthM`: the distance over the stride, plus
 * the holding fin beat, never faster than the shown cap. The speed is eased (for the gain).
 */
export function swimCycles(memory: SwimMemory, style: SwimStyle, distance: number, dt: number, lengthM: number): SwimMemory {
    const p = SWIM[style];
    const L = Math.max(lengthM, 0.01);
    const moved = Math.max(distance, 0) / L;
    const most = SWIM_DISPLAY_HZ * dt;
    memory.cycles = (memory.cycles + Math.min(moved / p.stride + p.hold * dt, most)) % 4096;
    if (dt > 0) memory.speed += (moved / dt - memory.speed) * Math.min(dt * 3, 1);
    return memory;
}

/** The wave's size for a speed (body lengths a second): half its full swing when it holds still, full from cruise up. */
export function swimGain(speedBLs: number, style: SwimStyle, lengthM: number): number {
    const cruise = swimPaces(lengthM, style).cruiseBLs;
    return 0.45 + 0.55 * clamp(speedBLs / Math.max(cruise, 0.02), 0, 1);
}

// MARK: The body channel (`arkLook.w`)

/**
 * The near model's per-instance body channel (`arkLook.w`, motion pass decision 30): 0 is nothing (the material's own
 * clock), w ≥ 1 a wave: 1 + round(gain · 254) + phase (fraction of a beat, below 1), so one float carries both
 * exactly (a gain step of 1/254, a phase step of 1/32768 at the top). Negative w is the wing fold (flight).
 */
export function waveChannel(phase: number, gain: number): number {
    const g = Math.round(clamp(gain, 0, 1) * 254);
    const f = phase - Math.floor(phase);
    return 1 + g + Math.min(f, 0.99998);
}

/** The channel read back (the shader's `arkBodyWave`, for the tests). */
export function readWaveChannel(w: number): {phase: number; gain: number} | null {
    if (w < 1) return null;
    const whole = Math.floor(w);
    return {phase: w - whole, gain: (whole - 1) / 254};
}

/** The shader's per-style constants (the material's uniforms): envelope head and power, waves, tip, the fin mode. */
export function swimUniforms(style: SwimStyle): {motionHead: number; motionPower: number; motionWaves: number; motionTip: number; motionAxis: number; motionFin: number} {
    const p = SWIM[style];
    return {motionHead: p.head, motionPower: p.power, motionWaves: p.waves, motionTip: p.tip, motionAxis: p.axis === "y" ? 1 : 0, motionFin: p.fin === "wave" ? 1 : p.fin === "flap" ? 2 : 0};
}

/**
 * How high above its middle the wave can lift any part of an up-and-down swimmer (share of its length), so its depth
 * fit keeps the flukes under the surface (the CI's water-surface check): the tip swing for a y-axis swimmer, 0 for the
 * side-to-side ones.
 */
export function swimHeadroom(style: SwimStyle): number {
    const p = SWIM[style];
    return p.axis === "y" ? p.tip : 0;
}

/** The depth fit's clearance under the surface (m): `sea-depth.ts` SURFACE_CLEAR. */
export const SWIM_SURFACE_CLEAR = 0.08;

/**
 * The surface guard: a swimming body's base (its lowest point, m) lowered so that its top, the flukes' up-swing
 * (`swimHeadroom`, at the gain it swims with) and the tail's rise from its pitch all stay `SWIM_SURFACE_CLEAR` under
 * the surface. Not while it breathes (it comes up on purpose) nor for a floater. `height` and `length` are as drawn
 * (m); `pitch` the body's (radians); `sea` the surface's height.
 */
export function swimSurfaceGuard(base: number, height: number, length: number, style: SwimStyle, pitch: number, sea: number, gain = 1): number {
    const wave = swimHeadroom(style) * length * Math.min(Math.max(gain, 0), 1);
    const tilt = Math.abs(Math.sin(pitch)) * length * 0.5;
    const top = base + height + wave + tilt;
    const limit = sea - SWIM_SURFACE_CLEAR;
    return top > limit ? base - (top - limit) : base;
}

/** The L2 uniforms the near material takes (0 power: the talking model's own motion, as before). */
export type L2BodyUniforms = {motionHead: number; motionPower: number; motionTip: number; motionLift: number; motionStretch: number; motionFin: number; motionWavesL2: number; motionAxisL2: number};

export const L2_BODY_NONE: L2BodyUniforms = {motionHead: 0, motionPower: 0, motionTip: 0, motionLift: 0, motionStretch: 0, motionFin: 0, motionWavesL2: 0, motionAxisL2: 0};
