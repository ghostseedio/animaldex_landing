/**
 * Legless bodies on land (motion pass lane L2): snakes, legless lizards, caecilians, worms, millipedes.
 *
 * - Lateral undulation (serpentine): the body follows its own track. A wave of 1.6 lengths' worth of bends runs back
 *   along the body exactly as fast as the body goes forward (no slip: a cycle carries it one wavelength), so every
 *   point traces the same S-curve on the ground (Gray 1946; Hu et al. 2009).
 * - Sidewinding (only where the stored text says: the sidewinder, the desert horned viper): the body lies across its
 *   way, about 55° to it; a sideways wave and a lifting wave a quarter beat apart, so only short sections touch the
 *   sand while the rest is carried over (Marvi et al. 2014). A cycle carries it about 0.45 body lengths.
 * - Rectilinear (heavy pythons, boas and vipers when slow; stored text for the rock python): straight, the belly's
 *   muscles ripple from head to tail, a cycle carries it a tenth of a length; faster, it undulates.
 * - Peristalsis (earthworms, leeches): waves of stretching and squeezing run back along the body.
 * - Glide (millipedes, flatworms): straight, a fine ripple of its many legs or cilia.
 *
 * All played by the distance the animal moves (`leglessCycles`), so a still snake is still and a fast one undulates
 * fast; the shader and the chain driver read `leglessShape` for one frame. Visual only.
 */

import type {LeglessMode} from "@/ark-scene/locomotion/styles";

export type LeglessParams = {
    /** Bends on the body (wavelengths). */
    waves: number;
    /** The sideways swing (share of the length) and the envelope's head share (the wave is nearly even along it). */
    side: number;
    head: number;
    /** The lifting wave (share of the length) and its lead on the sideways one (beats). */
    lift: number;
    liftLead: number;
    /** The stretch-and-squeeze wave's size (share of each part's length). */
    stretch: number;
    /** Body lengths a cycle carries it. */
    advance: number;
    /** The body's angle to its way (radians; sidewinding). */
    across: number;
};

export const LEGLESS: Readonly<Record<LeglessMode, LeglessParams>> = {
    lateral: {waves: 1.6, side: 0.09, head: 0.85, lift: 0, liftLead: 0, stretch: 0, advance: 1 / 1.6, across: 0},
    sidewind: {waves: 1.3, side: 0.12, head: 0.7, lift: 0.045, liftLead: 0.25, stretch: 0, advance: 0.45, across: 0.95},
    rectilinear: {waves: 3, side: 0, head: 1, lift: 0.008, liftLead: 0, stretch: 0.03, advance: 0.1, across: 0},
    peristaltic: {waves: 2, side: 0.01, head: 1, lift: 0.004, liftLead: 0, stretch: 0.09, advance: 0.12, across: 0},
    glide: {waves: 6, side: 0, head: 1, lift: 0.003, liftLead: 0, stretch: 0, advance: 0.35, across: 0}
};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const smooth = (v: number) => {
    const c = clamp(v, 0, 1);
    return c * c * (3 - 2 * c);
};

/**
 * The mode it moves in now: a rectilinear snake undulates once it goes faster than a quarter of a length a second
 * (blended from 0.12), so `blend` is the share of lateral undulation.
 */
export function leglessMode(mode: LeglessMode, speedBLs: number): {mode: LeglessMode; blend: number} {
    if (mode !== "rectilinear") return {mode, blend: mode === "lateral" ? 1 : 0};
    const blend = smooth((speedBLs - 0.12) / 0.13);
    return {mode: blend > 0.5 ? "lateral" : "rectilinear", blend};
}

/** One frame's wave constants for a mode and a lateral blend (rectilinear to lateral). */
export function leglessShape(mode: LeglessMode, blend = mode === "lateral" ? 1 : 0): LeglessParams {
    if (mode !== "rectilinear") return LEGLESS[mode];
    const a = LEGLESS.rectilinear;
    const b = LEGLESS.lateral;
    const k = clamp(blend, 0, 1);
    const mix = (x: number, y: number) => x + (y - x) * k;
    return {waves: mix(a.waves, b.waves), side: mix(a.side, b.side), head: mix(a.head, b.head), lift: mix(a.lift, b.lift), liftLead: 0, stretch: mix(a.stretch, b.stretch), advance: mix(a.advance, b.advance), across: 0};
}

/** Per animal, per viewer (visual only): cycles moved, its eased speed (body lengths a second). */
export type LeglessMemory = {cycles: number; speed: number};

export function newLeglessMemory(seed = 0): LeglessMemory {
    return {cycles: seed, speed: 0};
}

/** Cycles on after moving `distance` metres in `dt` seconds at length `lengthM` (by the distance: no slip). */
export function leglessCycles(memory: LeglessMemory, mode: LeglessMode, distance: number, dt: number, lengthM: number): LeglessMemory {
    const L = Math.max(lengthM, 0.01);
    const moved = Math.max(distance, 0) / L;
    if (dt > 0) memory.speed += (moved / dt - memory.speed) * Math.min(dt * 3, 1);
    const shape = leglessShape(mode, leglessMode(mode, memory.speed).blend);
    // (A jump to a new spot is no crawl: at most two cycles in a frame.)
    memory.cycles = (memory.cycles + Math.min(moved / shape.advance, 2)) % 4096;
    return memory;
}

/**
 * The body at a point s (0 head ... 1 tail, share of the length) for `cycles`: its sideways offset and lift (shares of
 * the length) and its local stretch. The wave travels back along the body one wavelength a cycle.
 */
export function leglessPoint(shape: LeglessParams, s: number, cycles: number): {side: number; lift: number; stretch: number} {
    const t = clamp(s, 0, 1);
    const env = shape.head + (1 - shape.head) * t;
    const a = 2 * Math.PI * (cycles - t * shape.waves);
    return {
        side: shape.side * env * Math.sin(a),
        lift: shape.lift * Math.max(Math.sin(a + 2 * Math.PI * shape.liftLead), 0),
        stretch: shape.stretch * Math.sin(a)
    };
}

/**
 * How much the body slips sideways against its own track (0: every point on the head's S-curve), for the CI's
 * no-slip check: the body moves forward `advance` lengths a cycle; each point's sideways offset is compared with the
 * head's when the head was where that point is now, over a cycle; the mean difference over the wave's own swing.
 */
export function leglessSlip(mode: LeglessMode, samples = 24): number {
    const shape = leglessShape(mode);
    if (shape.side <= 0 || shape.across !== 0) return 0;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < samples; i++) {
        const c = i / samples;
        for (let k = 1; k <= 8; k++) {
            const s = k / 8;
            // When the head was s lengths back along the way, it was s / advance cycles ago.
            const head = leglessPoint(shape, 0, c - s / shape.advance).side / (shape.head || 1);
            const here = leglessPoint(shape, s, c).side / (shape.head + (1 - shape.head) * s);
            sum += Math.abs(here - head);
            n++;
        }
    }
    return sum / n / shape.side;
}

/** The shader's constants for a mode (`animal-material.ts` MOTION_BODY, the legless branch). */
export function leglessUniforms(mode: LeglessMode): {motionHead: number; motionPower: number; motionWaves: number; motionTip: number; motionLift: number; motionStretch: number} {
    const p = LEGLESS[mode];
    return {motionHead: p.head, motionPower: 1, motionWaves: p.waves, motionTip: p.side, motionLift: p.lift, motionStretch: p.stretch};
}

/** A sidewinder's heading offset: its body lies across its way (radians, to the side its seed picks). */
export function sidewindYaw(seed: number): number {
    return (seed < 0.5 ? 1 : -1) * LEGLESS.sidewind.across;
}
