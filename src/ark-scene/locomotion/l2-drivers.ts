/**
 * Lane L2's drivers for the locomotion layer (L1's `layer.ts`; motion pass decision 32): rigged animals near the
 * camera, posed on the CPU each frame.
 *
 * - `flightDriver` (birds, bats, flying insects in the air): on the flap clip the hand and forearm flex on the
 *   upstroke (the published flap has none: its span is the same both ways); a rig with no flap of its own (71 flying
 *   insects hold an open glide) gets its wings beaten about the body's long axis, a butterfly's slow flutter or an
 *   insect's whir; in a bank the head stays level with the horizon (birds steady their heads); the tail fans and
 *   dips in a flare.
 * - `chainDriver` (legless and whale chain rigs: slither, swim): the chain bent to the swimming mode's or the legless
 *   mode's wave (`swim.ts`, `legless.ts`), by the distance moved: no slip on land, the tail beat following speed in
 *   the water; a sidewinder's lifting wave; a snake's head held along its way.
 *
 * Both start from the baked frame or the rest pose and change the mesh-space bone transforms in place (L1's
 * `rotateSubtree` keeps children with their parents). Their state is per viewer and visual only.
 */

import {Matrix4, Quaternion, Vector3} from "three";
import {rotateSubtree, translateSubtree} from "@/ark-scene/locomotion/skeleton";
import type {GaitState, LocoDriver, LocoInput, LocoRig} from "@/ark-scene/locomotion/types";
import {flightSpecOf, strokeToClipPhase, upstrokeFold, type FlightSpec} from "@/ark-scene/locomotion/flight";
import {leglessCycles, leglessMode, leglessPoint, leglessShape, newLeglessMemory, type LeglessMemory} from "@/ark-scene/locomotion/legless";
import {locoStyle} from "@/ark-scene/locomotion/styles";
import {newSwimMemory, SWIM, swimCycles, swimEnvelope, swimGain, tailBeatHz, type SwimMemory} from "@/ark-scene/locomotion/swim";

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const frac = (v: number) => v - Math.floor(v);

const vA = new Vector3();
const vB = new Vector3();
const vC = new Vector3();
const vD = new Vector3();
const vAxis = new Vector3();
const qTmp = new Quaternion();
const mTmp = new Matrix4();
const FORWARD = new Vector3(0, 0, 1);

/** Where the instance moved since last frame (world metres), tracked in a driver's state. */
type Track = {x: number; y: number; z: number; has: boolean; speed: number; yaw: number; turn: number};
const newTrack = (): Track => ({x: 0, y: 0, z: 0, has: false, speed: 0, yaw: 0, turn: 0});
function stepTrack(track: Track, input: LocoInput): number {
    const e = input.instance.elements;
    const x = e[12], y = e[13], z = e[14];
    let moved = 0;
    if (track.has) {
        moved = Math.hypot(x - track.x, y - track.y, z - track.z);
        if (moved > 5) moved = 0;
        const dt = Math.max(input.dt, 1e-4);
        track.speed += (moved / dt - track.speed) * Math.min(input.dt * 4, 1);
        let dyaw = input.yaw - track.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        track.turn += (dyaw / dt - track.turn) * Math.min(input.dt * 4, 1);
    }
    track.x = x;
    track.y = y;
    track.z = z;
    track.yaw = input.yaw;
    track.has = true;
    return moved;
}

const pos = (m: Matrix4, out: Vector3) => out.setFromMatrixPosition(m);

// MARK: Flight

/**
 * Species whose rig has no flap of its own (`flight_fallback_open`: it holds an open glide), noted by the scene's
 * flight frame (`l2-scene.ts` l2FlightFrame) when it flies: the driver beats their wings itself.
 */
export const OPEN_WING_RIGS = new Set<string>();

export const FLIGHT_DRIVER_CLIPS: ReadonlySet<string> = new Set(["flap", "glide", "soar", "bank_l", "bank_r", "hover", "takeoff", "land", "plunge"]);

type FlightState = {spec: FlightSpec | null; length: number; track: Track; stroke: number};

/** The hand's and the forearm's flex at full fold (radians). */
export const WRIST_FOLD = 1.2;
export const ELBOW_FOLD = 0.45;
/** A synthesized beat's stroke (radians each way about the long axis): a butterfly's, a whirring insect's. */
export const FLUTTER_STROKE = 0.75;
export const WHIR_STROKE = 0.45;

/**
 * Flex one wing (shoulder, forearm, hand) back in its own plane by `fold` (0-1): the hand about the wrist, the
 * forearm about the elbow, each swinging its tip toward the tail.
 */
export function foldWing(rig: LocoRig, world: Matrix4[], wing: readonly number[], fold: number): void {
    if (wing.length < 3 || fold <= 1e-4) return;
    const [shoulder, forearm, hand] = wing;
    for (const [bone, from, angle] of [[forearm, shoulder, ELBOW_FOLD], [hand, forearm, WRIST_FOLD]] as const) {
        const pivot = pos(world[bone], vA);
        const span = vB.subVectors(pivot, pos(world[from], vC));
        // A bone pivot on top of its parent's (cards hinged at one point): use the wing's reach from the shoulder.
        if (span.lengthSq() < 1e-10) span.subVectors(pivot, pos(world[shoulder], vC));
        if (span.lengthSq() < 1e-10) continue;
        vAxis.crossVectors(FORWARD, span.normalize());
        if (vAxis.lengthSq() < 1e-8) continue;
        qTmp.setFromAxisAngle(vAxis.normalize(), angle * fold);
        rotateSubtree(rig, world, bone, qTmp, pivot);
    }
}

/** How far the legs swing back under the tail in level flight (radians at the hip), on top of the clip's own tuck. */
export const LEG_TUCK = 0.6;
const LATERAL = new Vector3(1, 0, 0);

/**
 * Legs drawn back under the tail in level flight (birds trail their feet; the clips' tuck leaves a duck's feet hanging
 * under its belly): each leg swung back about its hip.
 */
export function tuckLegs(rig: LocoRig, world: Matrix4[], amount: number): void {
    if (amount <= 1e-4) return;
    qTmp.setFromAxisAngle(LATERAL, LEG_TUCK * amount);
    for (const leg of rig.legs) rotateSubtree(rig, world, leg.upper, qTmp, pos(world[leg.upper], vA));
}

/** Beat one wing about the body's long axis at its shoulder (+ up), for a rig with no flap of its own. */
export function beatWing(rig: LocoRig, world: Matrix4[], wing: readonly number[], side: 1 | -1, angle: number): void {
    if (!wing.length || Math.abs(angle) < 1e-5) return;
    qTmp.setFromAxisAngle(FORWARD, side * angle);
    rotateSubtree(rig, world, wing[0], qTmp, pos(world[wing[0]], vA));
}

export const flightDriver: LocoDriver = {
    name: "l2-flight",
    takes(rig, input) {
        return (globalThis as {__arkL2?: boolean}).__arkL2 !== false && !input.grounded && rig.wings.left.length >= 1 && rig.wings.right.length >= 1 && FLIGHT_DRIVER_CLIPS.has(input.clipNow);
    },
    init(): FlightState {
        return {spec: null, length: 0, track: newTrack(), stroke: 0};
    },
    pose(rig, input, world, raw): GaitState | null {
        const state = raw as FlightState;
        stepTrack(state.track, input);
        const length = rig.length * input.scale;
        if (!state.spec || Math.abs(state.length - length) > 1e-4) {
            state.spec = flightSpecOf(locoStyle(rig.slug, rig.plan).flight, length);
            state.length = length;
        }
        const spec = state.spec;
        if (!spec) return null;
        const clip = input.clipNow;
        let beat = 0;
        let mode = clip;
        if (clip === "flap") {
            // The clip's phase is the stroke (0 top, 0.5 bottom): the upstroke is its second half.
            const q = frac(input.clipPhase);
            beat = q;
            const fold = q < 0.5 ? 0 : upstrokeFold(0.5 + (q - 0.5), 0.5);
            const gain = spec.fold;
            foldWing(rig, world, rig.wings.left, fold * gain);
            foldWing(rig, world, rig.wings.right, fold * gain);
        } else if ((clip === "glide" || clip === "bank_l" || clip === "bank_r" || clip === "soar") && spec.kind === "insect" && OPEN_WING_RIGS.has(rig.slug)) {
            // An insect holding open wings (no flap of its own): its wings beat on the shared clock (the same beat the
            // scene's heave uses: `flightRigFrame` for an open-winged flyer), a butterfly's slow flutter, the rest a whir.
            beat = frac(input.clock * spec.hz + input.seed * 7);
            const amp = (spec.style === "flutter" ? FLUTTER_STROKE : WHIR_STROKE) * spec.stroke;
            const q = strokeToClipPhase(beat, spec.downstroke);
            const angle = amp * Math.cos(2 * Math.PI * q);
            beatWing(rig, world, rig.wings.left, 1, angle);
            beatWing(rig, world, rig.wings.right, -1, angle);
            mode = spec.style === "flutter" ? "flutter" : "whir";
        }
        // Feet back under the tail in the air (not in a take-off, a landing or a dive: legs push off, reach down, or stay in).
        if (spec.kind !== "insect" && (clip === "flap" || clip === "glide" || clip === "soar" || clip === "bank_l" || clip === "bank_r")) tuckLegs(rig, world, 1);
        // The head level with the horizon in a bank (birds and bats), up to 70% of the roll.
        if (spec.kind !== "insect") {
            const steady = rig.neck >= 0 ? rig.neck : rig.head;
            if (steady >= 0) {
                // World up in mesh space (the instance's rotation undone).
                mTmp.copy(input.instance).invert();
                const up = vD.set(0, 1, 0).transformDirection(mTmp);
                const roll = Math.atan2(-up.x, up.y);
                if (Math.abs(roll) > 0.02) {
                    qTmp.setFromAxisAngle(FORWARD, 0.7 * clamp(roll, -1.2, 1.2));
                    rotateSubtree(rig, world, steady, qTmp, pos(world[steady], vA));
                }
            }
        }
        return {gait: mode, phase: beat, cadence: spec.hz, stride: spec.hz > 0 ? state.track.speed / spec.hz : 0, duty: spec.downstroke, speed: state.track.speed, accel: 0, turn: state.track.turn, froude: 0, feet: []};
    }
};

// MARK: Chains

export const CHAIN_DRIVER_CLIPS: ReadonlySet<string> = new Set(["slither", "swim"]);

type ChainState = {track: Track; swim: SwimMemory | null; legless: LeglessMemory | null; rest: Vector3[]; targets: Vector3[]; front: number; run: number};

/**
 * Bend a chain to targets (mesh space, one per chain bone): from the front, each segment turned to point at its
 * next target, everything behind riding along (lengths kept).
 */
export function bendChain(rig: LocoRig, world: Matrix4[], chain: readonly number[], targets: readonly Vector3[]): void {
    if (chain.length < 2) return;
    // The front of the chain to its own target first.
    const first = pos(world[chain[0]], vA);
    translateSubtree(rig, world, chain[0], targets[0].x - first.x, targets[0].y - first.y, targets[0].z - first.z);
    for (let k = 0; k < chain.length - 1; k++) {
        const here = pos(world[chain[k]], vA);
        const now = vB.subVectors(pos(world[chain[k + 1]], vC), here);
        const want = vD.subVectors(targets[k + 1], here);
        if (now.lengthSq() < 1e-12 || want.lengthSq() < 1e-12) continue;
        qTmp.setFromUnitVectors(now.normalize(), want.normalize());
        rotateSubtree(rig, world, chain[k], qTmp, here);
    }
}

/**
 * Chain targets laid along a sinusoidal track x(z) = amp · sin 2π(cycles − (front − z) / wavelength) (mesh space,
 * the front at `front`), each chain point at its own rest distance behind the front measured along the curve (so
 * the body keeps its length and every point follows the same track).
 */
export function laidOnTrack(rest: readonly Vector3[], front: number, amp: number, wavelength: number, cycles: number, out: Vector3[]): void {
    const lam = Math.max(wavelength, 1e-4);
    const trackX = (z: number) => amp * Math.sin(2 * Math.PI * (cycles - (front - z) / lam));
    const step = lam / 48;
    let z = front;
    let x = trackX(z);
    let walked = 0;
    for (let k = 0; k < rest.length; k++) {
        const want = front - rest[k].z;
        while (walked < want - 1e-9) {
            const nz = z - step;
            const nx = trackX(nz);
            const seg = Math.hypot(nz - z, nx - x);
            if (walked + seg >= want) {
                const t = (want - walked) / seg;
                z += (nz - z) * t;
                x += (nx - x) * t;
                walked = want;
                break;
            }
            walked += seg;
            z = nz;
            x = nx;
        }
        out[k].set(x + rest[k].x, rest[k].y, z);
    }
}

export const chainDriver: LocoDriver = {
    name: "l2-chain",
    takes(rig, input) {
        if ((globalThis as {__arkL2?: boolean}).__arkL2 === false || rig.chain.length < 3 || !CHAIN_DRIVER_CLIPS.has(input.clipNow)) return false;
        const style = locoStyle(rig.slug, rig.plan);
        return Boolean(style.swim || style.legless);
    },
    base() {
        return "rest";
    },
    init(rig): ChainState {
        const rest = rig.chain.map((b) => new Vector3().setFromMatrixPosition(rig.bones[b].restWorld));
        const front = rest[0].z;
        const run = Math.max(front - rest[rest.length - 1].z, 1e-3) / 0.9;
        return {track: newTrack(), swim: null, legless: null, rest, targets: rest.map((p) => p.clone()), front, run};
    },
    pose(rig, input, world, raw): GaitState | null {
        const state = raw as ChainState;
        const moved = stepTrack(state.track, input);
        const style = locoStyle(rig.slug, rig.plan);
        const length = Math.max(rig.length * input.scale, 0.01);
        const L = state.run;
        // (Reused each frame: no allocation while posing.)
        const targets = state.targets;
        state.rest.forEach((p, k) => targets[k].copy(p));
        let gait = "undulate";
        let phase = 0;
        let cadence = 0;
        let stride = 0;
        // In the water (below the surface over it): an eel or a sea snake playing its slither swims its eel's wave.
        const e = input.instance.elements;
        const under = input.ground(e[12], e[14]);
        const surface = under.water ?? (under.height < 0 ? 0 : null);
        const wet = surface !== null && e[13] < surface - 0.02;
        if ((input.clipNow === "swim" || wet) && style.swim) {
            const swim = (state.swim ??= newSwimMemory(input.seed));
            swimCycles(swim, style.swim, moved, input.dt, length);
            const p = SWIM[style.swim];
            const gain = swimGain(swim.speed, style.swim, length);
            state.rest.forEach((r, k) => {
                const s = clamp((state.front - r.z) / L, 0, 1);
                const bend = p.tip * gain * swimEnvelope(style.swim!, s) * Math.sin(2 * Math.PI * (swim.cycles - s * p.waves)) * L;
                if (p.axis === "y") targets[k].y += bend;
                else targets[k].x += bend;
            });
            gait = style.swim;
            phase = swim.cycles;
            cadence = tailBeatHz(swim.speed, style.swim);
            stride = p.stride * length;
        } else if (style.legless) {
            const crawl = (state.legless ??= newLeglessMemory(input.seed));
            leglessCycles(crawl, style.legless, moved, input.dt, length);
            const now = leglessMode(style.legless, crawl.speed);
            const shape = leglessShape(style.legless, now.blend);
            const still = clamp(crawl.speed / 0.05, 0, 1);
            if (shape.across === 0 && shape.side > 0) {
                // Lateral undulation: the body laid along its own track (an S-curve fixed on the ground), each point at
                // its own distance along the body behind the front: no slip.
                laidOnTrack(state.rest, state.front, shape.side * L * (0.55 + 0.45 * still), L / shape.waves, crawl.cycles, targets);
                state.rest.forEach((r, k) => {
                    const s = clamp((state.front - r.z) / L, 0, 1);
                    const at = leglessPoint(shape, s, crawl.cycles);
                    targets[k].y += at.lift * L * still;
                });
            } else {
                state.rest.forEach((r, k) => {
                    const s = clamp((state.front - r.z) / L, 0, 1);
                    const at = leglessPoint(shape, s, crawl.cycles);
                    targets[k].x += at.side * L * (0.55 + 0.45 * still);
                    targets[k].y += at.lift * L * still;
                    targets[k].z += at.stretch * L * 0.15;
                });
            }
            gait = now.mode;
            phase = crawl.cycles;
            cadence = (crawl.speed / Math.max(shape.advance, 1e-3));
            stride = shape.advance * length;
        } else return null;
        bendChain(rig, world, rig.chain, targets);
        // The head held along the way (a snake's head swings less than its neck), back toward the body's axis.
        if (rig.head >= 0 && rig.chain.length >= 2) {
            const a = pos(world[rig.chain[0]], vA);
            const b = pos(world[rig.chain[1]], vB);
            const dir = vC.subVectors(a, b);
            const off = Math.atan2(dir.x, dir.z);
            if (Math.abs(off) > 1e-3) {
                qTmp.setFromAxisAngle(vD.set(0, 1, 0), -0.6 * off);
                rotateSubtree(rig, world, rig.head, qTmp, pos(world[rig.head], vA));
            }
        }
        return {gait, phase, cadence, stride, duty: 1, speed: state.track.speed, accel: 0, turn: state.track.turn, froude: 0, feet: []};
    }
};
