/**
 * Lane L2's hooks into the scene (`index.ts`): small, named calls so the scene's own file changes stay wiring.
 *
 * - `l2BodyUniforms`: a species' wave shape for the near model's shader (`animal-material.ts` MOTION_BODY): its swim
 *   style's envelope, waves and tip swing, or its legless mode's; null keeps the talking model's own motion.
 * - `l2BodyChannel`: each frame, per drawn animal, the shader's per-instance body channel (`arkLook.w`): the wave's
 *   phase by the distance it moved (no slip on land; the tail beat follows speed in the water) and its gain.
 * - `l2FlightFrame`: a flying rig's clip, phase, attitude and heave (`flight.ts` flightRigFrame) from what the scene
 *   knows this frame.
 * - `l2SwimRate`, `l2Sidewind`, `l2SurfaceGuard`: a chain rig's swim clip at the tail-beat rate, a sidewinder's body
 *   across its way, a swimmer kept under the surface.
 *
 * Visual only. The memories here are per viewer (a beat, the last position), never positions.
 */

import type {TalkingBehaviour} from "@/lib/talking-models/behaviour";
import {clipBakeOf, flightGate, flightRigFrame, flightSpecOf, landingNow, newFlightMemory, type ClipBake, type FlightGateInput, type FlightMemory, type FlightRigFrame, type FlightRigInput, type FlightSpec} from "@/ark-scene/locomotion/flight";
import {LEGLESS, leglessCycles, leglessMode, newLeglessMemory, sidewindYaw, type LeglessMemory} from "@/ark-scene/locomotion/legless";
import {locoStyle, type LocoStyle} from "@/ark-scene/locomotion/styles";
import {newSwimMemory, SWIM, swimCycles, type L2BodyUniforms, swimGain, swimSurfaceGuard, tailBeatHz, waveChannel, type SwimMemory} from "@/ark-scene/locomotion/swim";
import {chainDriver, flightDriver, OPEN_WING_RIGS} from "@/ark-scene/locomotion/l2-drivers";
import {registerLocoDriver} from "@/ark-scene/locomotion/layer";
import {galumphDriver, saltationDriver} from "@/ark-scene/locomotion/land-drivers";

// Lane L2's drivers go before L1's legged one (their `takes` never overlap it: in the air, or a chain rig's slither
// and swim). MA4's land drivers too: a true seal's galumph and a frog's or toad's hops (the legged gaits never take a
// true seal; a toad walking is drawn by the legged gaits from inside the hop driver).
registerLocoDriver(chainDriver);
registerLocoDriver(flightDriver);
registerLocoDriver(galumphDriver);
registerLocoDriver(saltationDriver);

/**
 * Lane L2 on (the default). Development only: `globalThis.__arkL2Motion = false` before mounting turns every L2 hook back to
 * what the scene did before it (the before/after recordings, `scripts/ark-l2-scenes.mjs --before`).
 */
export function l2On(): boolean {
    return (globalThis as {__arkL2Motion?: boolean}).__arkL2Motion !== false;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export type {L2BodyUniforms} from "@/ark-scene/locomotion/swim";
export {L2_BODY_NONE} from "@/ark-scene/locomotion/swim";

/**
 * A species' wave for the shader: its swim style (a water species), else its legless mode; a coiled model (its width
 * over a fifth of its length: a cobra's raised hood, an anaconda's loops) swings less. Null: no style of ours.
 */
export function l2BodyUniforms(slug: string, behaviour: TalkingBehaviour | null | undefined): L2BodyUniforms | null {
    if (!l2On()) return null;
    const kind = behaviour?.motion?.kind;
    if (kind !== "swim" && kind !== "flap") return null;
    const style = locoStyle(slug, behaviour?.plan ?? null);
    const width = behaviour?.extent ? Math.abs(behaviour.extent.max[0] - behaviour.extent.min[0]) : 0.2;
    const straight = clamp((0.4 - width) / 0.2, 0.35, 1);
    if (style.swim) {
        const p = SWIM[style.swim];
        // A ray's shape is its fins' (the flap branch); anything else bends its body.
        if (kind === "flap" && !p.fin) return null;
        return {motionHead: p.head, motionPower: p.power, motionTip: p.tip * (p.fin ? 1 : straight), motionLift: 0, motionStretch: 0, motionFin: p.fin === "wave" ? 1 : p.fin === "flap" ? 2 : 0, motionWavesL2: p.waves, motionAxisL2: p.axis === "y" ? 1 : 0};
    }
    if (style.legless && kind === "swim") {
        const p = LEGLESS[style.legless];
        return {motionHead: p.head, motionPower: 1, motionTip: p.side * straight, motionLift: p.lift, motionStretch: p.stretch, motionFin: 0, motionWavesL2: p.waves, motionAxisL2: 0};
    }
    return null;
}

/** Per animal (per viewer): its flight beat, its swim and crawl cycles, where it was last drawn. */
export type L2Motion = {
    slug: string;
    style: LocoStyle;
    flight: FlightMemory | null;
    flightSpec: FlightSpec | null;
    flightLength: number;
    swim: SwimMemory | null;
    legless: LeglessMemory | null;
    last: {x: number; y: number; z: number} | null;
};

export function newL2Motion(slug: string, plan: string | null | undefined, seed: number): L2Motion {
    const style = locoStyle(slug, plan ?? null);
    return {slug, style, flight: null, flightSpec: null, flightLength: 0, swim: style.swim ? newSwimMemory(seed) : null, legless: style.legless ? newLeglessMemory(seed) : null, last: null};
}

/**
 * The per-instance body channel this frame (`arkLook.w`; `swim.ts` waveChannel): its wave's phase on by the distance
 * it moved (true metres: `lengthM` its true length, `scale` drawn over true), its gain from its speed. 0 for a species
 * with no wave of ours. `inWater`: it swims now (a snake in the water swims its eel's wave).
 */
export function l2BodyChannel(motion: L2Motion, x: number, y: number, z: number, dt: number, drawnLength: number, inWater: boolean): number {
    if (!l2On()) return 0;
    const last = motion.last;
    let moved = last ? Math.hypot(x - last.x, y - last.y, z - last.z) : 0;
    // A jump (a new spot, a cut) is no swim.
    if (moved > Math.max(drawnLength * 4, 2)) moved = 0;
    if (last) {
        last.x = x;
        last.y = y;
        last.z = z;
    } else motion.last = {x, y, z};
    const L = Math.max(drawnLength, 0.01);
    if (motion.swim && (inWater || !motion.legless)) {
        const style = motion.style.swim!;
        swimCycles(motion.swim, style, moved, dt, L);
        return waveChannel(motion.swim.cycles, swimGain(motion.swim.speed, style, L));
    }
    if (motion.legless) {
        const mode = motion.style.legless!;
        leglessCycles(motion.legless, mode, moved, dt, L);
        // Lying still it keeps its curves (a resting snake), moving the full wave.
        const moving = clamp(motion.legless.speed / 0.05, 0, 1);
        return waveChannel(motion.legless.cycles, 0.55 + 0.45 * moving);
    }
    return 0;
}

/** A sidewinder's heading offset now (radians): across its way while it moves, straight while still. */
export function l2Sidewind(motion: L2Motion, seed: number): number {
    if (!l2On()) return 0;
    if (motion.style.legless !== "sidewind" || !motion.legless) return 0;
    const moving = clamp((motion.legless.speed - 0.03) / 0.1, 0, 1);
    return sidewindYaw(seed) * moving;
}

/** A rectilinear snake's mode now (for the debug overlay and the recordings). */
export function l2LeglessNow(motion: L2Motion): string | null {
    if (!motion.legless || !motion.style.legless) return null;
    return leglessMode(motion.style.legless, motion.legless.speed).mode;
}

/** A chain rig's swim clip rate (a whale's, a dolphin's): the tail-beat rate for its speed over the clip's own. */
export function l2SwimRate(motion: L2Motion, speedBLs: number, clipSeconds: number): number | null {
    if (!l2On()) return null;
    const style = motion.style.swim;
    if (!style) return null;
    return clamp(tailBeatHz(speedBLs, style) * clipSeconds, 0.1, 4);
}

/** The surface guard for a swimmer's base (`swim.ts` swimSurfaceGuard); unchanged for a species with no swim style. */
export function l2SurfaceGuard(motion: L2Motion, base: number, height: number, length: number, pitch: number, sea: number): number {
    if (!l2On()) return base;
    const style = motion.style.swim;
    if (!style) return base;
    return swimSurfaceGuard(base, height, length, style, pitch, sea);
}

/**
 * A flying rig's frame (`flight.ts`): the clip, its phase or rate, the attitude, the heave. Null when the species has
 * no flight style (the rig player's own `flightClip` then plays, as before).
 */
export function l2FlightFrame(motion: L2Motion, trueLength: number, input: Omit<FlightRigInput, "spec">): FlightRigFrame | null {
    if (!l2On()) return null;
    if (!motion.style.flight) return null;
    if (!motion.flightSpec || Math.abs(motion.flightLength - trueLength) > 1e-6) {
        motion.flightSpec = flightSpecOf(motion.style.flight, trueLength);
        motion.flightLength = trueLength;
    }
    if (!motion.flightSpec) return null;
    motion.flight ??= newFlightMemory();
    if (input.open || !input.has("flap")) OPEN_WING_RIGS.add(motion.slug);
    return flightRigFrame({...input, spec: motion.flightSpec}, motion.flight);
}

/** What a rig's flight clip bakes itself (`flight.ts` clipBakeOf: a v7 file), or null (v2). */
export function l2ClipBake(code: string | null, clip: Parameters<typeof clipBakeOf>[1]): ClipBake | null {
    return clipBakeOf(code, clip);
}

/** The rig player's flying state this frame (`flight.ts` flightGate, MA1): take-off, landing, down. */
export function l2FlightGate(input: FlightGateInput): ReturnType<typeof flightGate> {
    return flightGate(input);
}

/** A flying rig should start its landing now (`flight.ts` landingNow): within the clip's reach of the ground, coming down. */
export function l2LandingNow(motion: L2Motion, agl: number, climb: number, landHeight: number): boolean {
    if (!l2On() || !motion.style.flight) return false;
    return landingNow(agl, climb, landHeight);
}
