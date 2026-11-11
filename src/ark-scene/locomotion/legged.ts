/**
 * The legged driver (lane L1): gaits with planted feet for every rig with legs, on the ground.
 *
 * - **Feet.** Each foot is down for its gait's duty factor and swings for the rest, at its gait's phase offset. A
 *   planted foot is locked where it landed (world space) until it lifts, so it cannot slide; a swinging foot arcs to
 *   where its hip will be over it at mid-stance (predicted from the body's velocity), and lands on the ground there
 *   (its height and slope from the ground query). Standing, feet step only when the body has moved or turned away
 *   from them (turning by stepping), one at a time, plus a fidget step now and then.
 * - **Stride.** Cadence = speed / stride, stride from the hip height and the speed (`gaits.ts`): the root moves at
 *   exactly the speed the feet push it, so feet don't slide whatever the pace.
 * - **IK.** Two-bone IK per leg to its target; the foot turned to the ground's slope (and its toe tipped in the
 *   swing); the body lowered when a foot can't reach (a step down, a slope).
 * - **Body.** Crouch, bob and sway in time with the feet, the rock and spine flex of gallops and bounds, a lizard's
 *   S-bend, hips and shoulders rolling with the stride, the body following the slope (fore and hind), leaning into
 *   turns and accelerations; standing, a slow weight shift.
 * - **Head.** Stabilised against the body's rock (predators and birds most); hoofed animals nod with their
 *   forelegs; head-bobbing birds hold their head still in the air, then thrust it forward.
 * - **Secondary.** Tails on springs (lag, overshoot), driven by turns, sway, bob and speed.
 */

import {Matrix4, Quaternion, Vector3} from "three";
import {G, GAITS, gaitFor, gaitLadder, headBobs, legOffset, strideFor, type GaitLadder} from "@/ark-scene/locomotion/gaits";
import {restPole, solveLeg} from "@/ark-scene/locomotion/ik";
import {newChain, newSpring, stepChain, stepSpring, type Spring, type SpringChain} from "@/ark-scene/locomotion/secondary";
import {rotateAbout, rotateSubtree, translateSubtree} from "@/ark-scene/locomotion/skeleton";
import type {FootTarget, GaitName, GaitState, LocoDriver, LocoInput, LocoRig} from "@/ark-scene/locomotion/types";

/** Clips during which the legged driver walks the animal itself (its own gaits) or stands it (its own idle). */
export const GAIT_CLIPS: ReadonlySet<string> = new Set(["walk", "run", "hop", "idle"]);

type Foot = {
    planted: boolean;
    /** Where it is planted (world), or where its swing is now. */
    at: Vector3;
    /** Its swing: from where, its progress then (0..1) at lift-off, and a stand step's own clock. */
    from: Vector3;
    w0: number;
    w: number;
    free: boolean;
    freeDur: number;
    /** A stand step's landing spot (world), fixed when it lifts. */
    to: Vector3;
    ground: number;
    nx: number;
    ny: number;
    nz: number;
};

export type LeggedState = {
    started: boolean;
    last: Vector3;
    lastYaw: number;
    vel: Vector3;
    speed: number;
    accel: number;
    turn: number;
    moving: boolean;
    gait: GaitName;
    ladder: GaitLadder;
    phase: number;
    offsets: number[];
    cadence: number;
    stride: number;
    duty: number;
    froude: number;
    feet: Foot[];
    poles: Vector3[];
    tail: SpringChain;
    bob: Spring;
    drop: Spring;
    lean: Spring;
    tilt: Spring;
    slopePitch: Spring;
    slopeLift: Spring;
    crouch: Spring;
    neckLag: Spring;
    fidgetSlot: number;
    /** Weight of the moving body motion (0 standing, 1 in a gait), eased. */
    motion: number;
    clock: number;
    /** Last frame's feet (world) and whether planted, for the metrics. */
    feetOut: FootTarget[];
};

const tmpV = new Vector3();
const tmpV2 = new Vector3();
const tmpQ = new Quaternion();
const tmpQ2 = new Quaternion();
const tmpM = new Matrix4();
const inv = new Matrix4();
const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const pivot = new Vector3();
const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, a), b);
const frac = (x: number) => x - Math.floor(x);
const smooth = (x: number) => {
    const c = clamp(x, 0, 1);
    return c * c * (3 - 2 * c);
};
const wrapHalf = (x: number) => x - Math.round(x);
/** A deterministic hash in [0, 1). */
export function hash01(a: number, b: number): number {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function initState(rig: LocoRig): LeggedState {
    return {
        started: false,
        last: new Vector3(),
        lastYaw: 0,
        vel: new Vector3(),
        speed: 0,
        accel: 0,
        turn: 0,
        moving: false,
        gait: "stand",
        ladder: gaitLadder(rig),
        phase: 0,
        offsets: rig.legs.map(() => 0),
        cadence: 0,
        stride: 0,
        duty: 1,
        froude: 0,
        feet: rig.legs.map(() => ({planted: true, at: new Vector3(), from: new Vector3(), w0: 0, w: 0, free: false, freeDur: 0.2, to: new Vector3(), ground: 0, nx: 0, ny: 1, nz: 0})),
        poles: rig.legs.map((leg) => new Vector3(...restPole(rig, leg))),
        tail: newChain(rig.tail.length),
        bob: newSpring(),
        drop: newSpring(),
        lean: newSpring(),
        tilt: newSpring(),
        slopePitch: newSpring(),
        slopeLift: newSpring(),
        crouch: newSpring(),
        neckLag: newSpring(),
        fidgetSlot: -1,
        motion: 0,
        clock: 0,
        feetOut: []
    };
}

/** Where a leg's foot rests under the body now (world): its rest contact through the instance, on the ground. */
function neutral(rig: LocoRig, legIndex: number, input: LocoInput, out: Vector3): Vector3 {
    const c = rig.legs[legIndex].contact;
    return out.set(c[0], c[1], c[2]).applyMatrix4(input.instance);
}

/** A stand step's time (s): quick for small legs, about half a second for an elephant's. */
const stepTime = (hip: number) => clamp(0.16 + 0.3 * Math.sqrt(hip), 0.14, 0.6);

/** Predators keep their head steadiest; birds too; grazers less. */
const STEADY = /(cat\b|cat$|-cat|lion|tiger|leopard|cheetah|jaguar|puma|cougar|lynx|caracal|serval|ocelot|bobcat|wolf|fox|dog|jackal|coyote|dingo|hyena|bear|weasel|stoat|mink|marten|otter|komodo|monitor|crocodile|alligator|caiman)/;
const NODDERS = /(horse|zebra|donkey|ass\b|pony|deer|elk|moose|caribou|reindeer|giraffe|camel|cattle|cow|bison|buffalo|yak|goat|sheep|antelope|gazelle|wildebeest|gnu|eland|kudu|oryx|elephant|rhino|tapir|llama|alpaca)/;

function headSteadiness(rig: LocoRig): number {
    if (rig.plan === "flying_bird" || rig.plan === "walking_bird" || rig.plan === "flightless_bird") return 0.9;
    if (STEADY.test(rig.slug)) return 0.9;
    if (rig.plan === "insect" || rig.plan === "arachnid" || rig.plan === "crustacean") return 0.3;
    return 0.6;
}

const worldPos = (m: Matrix4, out: Vector3) => out.setFromMatrixPosition(m);

/** The legged driver. */
export const leggedDriver: LocoDriver = {
    name: "legged",
    takes(rig, input) {
        return input.grounded && rig.legs.length >= 2 && !rig.sitting && rig.legHeight > 0 && GAIT_CLIPS.has(input.clipNow);
    },
    init: initState,
    base: () => "rest",
    pose(rig, input, world, raw) {
        return poseLegged(rig, input, world, raw as LeggedState);
    }
};

/**
 * Pose a legged animal for this frame (world: mesh-space bone transforms from the rest pose, changed in place).
 */
export function poseLegged(rig: LocoRig, input: LocoInput, world: Matrix4[], s: LeggedState): GaitState {
    const dt = clamp(input.dt, 0, 0.1);
    const scale = Math.max(input.scale, 1e-6);
    const hipM = rig.legHeight * scale;
    const lengthM = Math.max(rig.length * scale, 1e-4);
    const here = tmpV.setFromMatrixPosition(input.instance);
    inv.copy(input.instance).invert();
    // Velocity (world, horizontal), eased; a jump (a new spot, an act's cut) puts the feet back under the body.
    const jumped = !s.started || here.distanceTo(s.last) > Math.max(lengthM * 4, 2);
    if (jumped) {
        s.started = true;
        s.vel.set(0, 0, 0);
        s.speed = 0;
        s.phase = input.seed * 7;
        rig.legs.forEach((_, i) => {
            const f = s.feet[i];
            neutral(rig, i, input, f.at);
            const g = input.ground(f.at.x, f.at.z);
            f.at.y = g.height;
            f.ground = g.height;
            f.nx = g.nx;
            f.ny = g.ny;
            f.nz = g.nz;
            f.planted = true;
            f.free = false;
        });
    } else if (dt > 0) {
        const vx = (here.x - s.last.x) / dt;
        const vz = (here.z - s.last.z) / dt;
        const k = Math.min(dt * 8, 1);
        const before = s.speed;
        s.vel.x += (vx - s.vel.x) * k;
        s.vel.z += (vz - s.vel.z) * k;
        s.speed = Math.hypot(s.vel.x, s.vel.z);
        s.accel += ((s.speed - before) / dt - s.accel) * Math.min(dt * 4, 1);
        const dyaw = wrapHalf((input.yaw - s.lastYaw) / (Math.PI * 2)) * Math.PI * 2;
        s.turn += (dyaw / dt - s.turn) * Math.min(dt * 5, 1);
    }
    s.last.copy(here);
    s.lastYaw = input.yaw;
    s.clock = input.clock;

    // Gait and its stride.
    const speed = s.speed;
    s.moving = s.moving ? speed > 0.06 * hipM + 0.004 : speed > 0.12 * hipM + 0.008;
    s.froude = (speed * speed) / (G * Math.max(hipM, 1e-3));
    const gait: GaitName = s.moving ? gaitFor(s.ladder, s.froude, s.gait === "stand" ? null : s.gait) : "stand";
    s.gait = gait;
    const spec = GAITS[gait] ?? GAITS.walk;
    s.motion += ((s.moving ? 1 : 0) - s.motion) * Math.min(dt * 5, 1);
    if (s.moving) {
        const st = strideFor(speed, hipM, spec);
        s.stride = st.stride;
        s.cadence = st.cadence;
        s.duty = st.duty;
        s.phase += s.cadence * dt;
        // Footfall offsets ease to the new gait's (the shortest way round the cycle), over about a third of a second.
        rig.legs.forEach((leg, i) => {
            const target = legOffset(gait, leg, rig.legs);
            s.offsets[i] = frac(s.offsets[i] + wrapHalf(target - s.offsets[i]) * Math.min(dt * 3, 1));
        });
    }

    // Feet.
    const swingH = spec.swing * hipM;
    const tStep = stepTime(hipM);
    const feetOut: FootTarget[] = [];
    const freeCount = () => s.feet.filter((f) => f.free).length;
    const nStand = neutral;
    for (let i = 0; i < rig.legs.length; i++) {
        const f = s.feet[i];
        const leg = rig.legs[i];
        const home = nStand(rig, i, input, tmpV2);
        if (s.moving && !f.free) {
            const u = frac(s.phase + s.offsets[i]);
            const stance = u < s.duty;
            if (stance && !f.planted) {
                // Lands: where its swing has brought it, on the ground.
                land(f, input);
            } else if (!stance && f.planted) {
                f.planted = false;
                f.from.copy(f.at);
                f.w0 = clamp((u - s.duty) / Math.max(1 - s.duty, 1e-3), 0, 0.95);
            }
            if (!f.planted) {
                const w = clamp(((u - s.duty) / Math.max(1 - s.duty, 1e-3) - f.w0) / Math.max(1 - f.w0, 1e-3), 0, 1);
                f.w = w;
                // Where the hip will be over it at mid-stance: the body moves on for the rest of the swing and half the stance.
                const cycle = s.cadence > 1e-6 ? 1 / s.cadence : 0;
                const ahead = (1 - w) * (1 - s.duty) * cycle + (s.duty * cycle) / 2;
                const tx = home.x + s.vel.x * ahead;
                const tz = home.z + s.vel.z * ahead;
                swingTo(f, tx, tz, w, swingH, input);
            }
        } else {
            if (f.free) {
                f.w = clamp(f.w + dt / f.freeDur, 0, 1);
                swingTo(f, f.to.x, f.to.z, f.w, Math.max(swingH, 0.08 * hipM), input);
                if (f.w >= 1) {
                    land(f, input);
                    f.free = false;
                }
            } else if (!f.planted) {
                // Stopping mid-swing: the swing finishes as a step to under the hip.
                f.free = true;
                f.from.copy(f.at);
                f.to.set(home.x, 0, home.z);
                f.w = 0;
                f.freeDur = tStep * 0.7;
            }
        }
        feetOut.push({key: leg.key, x: f.at.x, y: f.at.y, z: f.at.z, planted: f.planted && !f.free, ground: f.ground});
    }
    if (!s.moving) {
        // Turning or drifting while standing: the foot furthest from under its hip steps, one at a time (two for six
        // or more legs), so the body turns by stepping rather than on the spot.
        const most = rig.legs.length >= 6 ? 2 : 1;
        if (freeCount() < most) {
            let worst = -1;
            let worstD = 0.22 * hipM;
            for (let i = 0; i < rig.legs.length; i++) {
                const f = s.feet[i];
                if (f.free || !f.planted) continue;
                // Not two neighbours at once (the same pair, or the same side's next leg).
                const busy = s.feet.some((g, j) => g.free && (rig.legs[j].pair === rig.legs[i].pair || (rig.legs[j].side === rig.legs[i].side && Math.abs(rig.legs[j].pair - rig.legs[i].pair) === 1)));
                if (busy) continue;
                const home = nStand(rig, i, input, tmpV2);
                const d = Math.hypot(f.at.x - home.x, f.at.z - home.z);
                if (d > worstD) {
                    worstD = d;
                    worst = i;
                }
            }
            // A fidget now and then (the same moment for every viewer: from the clock and the animal's seed).
            const period = 7 + 9 * hash01(input.seed * 13, 1);
            const slot = Math.floor((input.clock + input.seed * 97) / period);
            if (worst < 0 && slot !== s.fidgetSlot) {
                if (s.fidgetSlot >= 0 && hash01(slot, input.seed * 31) < 0.55) worst = Math.floor(hash01(slot, input.seed * 53) * rig.legs.length) % rig.legs.length;
                s.fidgetSlot = slot;
            }
            if (worst >= 0) {
                const f = s.feet[worst];
                const home = nStand(rig, worst, input, tmpV2);
                const a = hash01(s.fidgetSlot, worst + input.seed) * Math.PI * 2;
                const nudge = worstD > 0.22 * hipM ? 0 : 0.04 * hipM;
                f.free = true;
                f.planted = false;
                f.from.copy(f.at);
                f.to.set(home.x + Math.cos(a) * nudge, 0, home.z + Math.sin(a) * nudge);
                f.w = 0;
                f.freeDur = tStep;
            }
        }
    }
    s.feetOut = feetOut;

    // Body: everything below is in mesh space (the instance's frame).
    const motion = s.motion;
    const legH = rig.legHeight;
    // The ground fore and hind (world), for the body's slope.
    const fore = rig.legs.filter((l) => l.end === "fore");
    const hind = rig.legs.filter((l) => l.end === "hind");
    const groundUnder = (legs: typeof rig.legs) => {
        if (!legs.length) return null;
        let y = 0;
        for (const l of legs) {
            const p = tmpV2.set(l.contact[0], l.contact[1], l.contact[2]).applyMatrix4(input.instance);
            y += input.ground(p.x, p.z).height;
        }
        return y / legs.length;
    };
    const baseY = tmpV2.set(0, rig.minY, 0).applyMatrix4(input.instance).y;
    const hindY = groundUnder(hind.length ? hind : rig.legs) ?? baseY;
    const foreY = groundUnder(fore) ?? hindY;
    const span = fore.length && hind.length ? Math.max(fore[0].hip[2] - hind[0].hip[2], 1e-3) : 0;
    const quad = span > 0;
    // Bodies follow the slope most of the way (in mesh units, relative to where the instance stands).
    const liftWant = (((quad ? hindY : (hindY + foreY) / 2) - baseY) / scale) * 0.92;
    const pitchWant = quad ? clamp(Math.atan2(((hindY - foreY) / scale) * 0.85, span), -0.45, 0.45) : 0;
    const lift = stepSpring(s.slopeLift, liftWant, dt, 6, 0.9);
    const slopePitch = stepSpring(s.slopePitch, pitchWant, dt, 4, 0.9);
    // Crouch, bob and sway with the gait.
    const crouch = stepSpring(s.crouch, spec.crouch * legH, dt, 3, 1);
    let bobRaw = 0;
    let planted = 0;
    let sinSum = 0;
    if (s.moving) {
        for (let i = 0; i < rig.legs.length; i++) {
            const u = frac(s.phase + s.offsets[i]);
            if (u < s.duty) {
                planted++;
                sinSum += Math.sin((Math.PI * u) / s.duty);
            }
        }
        const mean = planted ? sinSum / planted : 0;
        // Walks vault over the planted legs (highest mid-stance); runs bounce (lowest mid-stance, up in the air).
        bobRaw = spec.bob > 0 ? spec.bob * legH * (mean - 0.6) * 2 : planted ? -spec.bob * legH * (0.5 - mean) * 2 : -spec.bob * legH;
    }
    const bob = stepSpring(s.bob, bobRaw * motion, dt, 9, 0.75);
    const cyc = Math.PI * 2 * s.phase;
    const leftHind = rig.legs.findIndex((l) => l.side > 0 && l.end === "hind");
    const refOffset = leftHind >= 0 ? s.offsets[leftHind] : 0;
    const swayPhase = cyc + Math.PI * 2 * (refOffset - (s.duty / 2));
    // Standing: a slow weight shift (its own period and phase).
    const idleT = input.clock / (5.5 + 3 * hash01(input.seed * 7, 3)) + input.seed;
    const idleSway = (1 - motion) * 0.012 * legH * Math.sin(Math.PI * 2 * idleT);
    const sway = motion * spec.sway * legH * Math.cos(swayPhase) + idleSway;
    const roll = motion * -spec.roll * Math.cos(swayPhase) - (1 - motion) * 0.012 * Math.sin(Math.PI * 2 * idleT);
    // Leaning into turns and accelerations.
    const turnLean = -clamp(Math.atan((speed * s.turn) / G) * (rig.legs.length === 2 ? 0.8 : 0.55), -0.35, 0.35);
    const lean = stepSpring(s.lean, turnLean, dt, 3, 0.8);
    const accLean = stepSpring(s.tilt, clamp(Math.atan(s.accel / G) * 0.45, -0.2, 0.2), dt, 3, 0.8);
    const rock = motion * spec.pitch * Math.sin(cyc - Math.PI / 2);
    const flex = motion * spec.flex * Math.sin(cyc);
    const bend = motion * spec.bend * Math.sin(cyc + Math.PI * 2 * refOffset);
    const hipsYaw = bend * 0.5;
    const chestYaw = -bend + clamp(0.12 * s.turn, -0.25, 0.25) * Math.min(speed / Math.max(hipM, 0.05), 1);

    // The whole body: lift (slope, crouch, bob, sway), then pitch (slope, rock, acceleration), roll and yaw at the hips.
    const hips = rig.hips >= 0 ? rig.hips : 0;
    translateSubtree(rig, world, hips, sway, lift - crouch + bob, 0);
    pivot.setFromMatrixPosition(world[hips]);
    tmpQ.setFromAxisAngle(X, slopePitch + rock + accLean);
    tmpQ2.setFromAxisAngle(Z, roll + lean);
    tmpQ.premultiply(tmpQ2);
    tmpQ2.setFromAxisAngle(Y, hipsYaw);
    tmpQ.premultiply(tmpQ2);
    rotateSubtree(rig, world, hips, tmpQ, pivot);
    // The front body: spine flex (gallops, bounds) and the S-bend, the front leading into a turn.
    if (rig.chest >= 0) {
        pivot.setFromMatrixPosition(world[rig.chest]);
        tmpQ.setFromAxisAngle(X, flex);
        tmpQ2.setFromAxisAngle(Y, chestYaw);
        tmpQ.premultiply(tmpQ2);
        rotateSubtree(rig, world, rig.chest, tmpQ, pivot);
    }
    // The head: steadied against the body's rock and roll; a nod with the forelegs (hoofed); a bird's head-bob.
    const steady = headSteadiness(rig);
    if (rig.neck >= 0 || rig.head >= 0) {
        const neck = rig.neck >= 0 ? rig.neck : rig.head;
        pivot.setFromMatrixPosition(world[neck]);
        const nodAmp = NODDERS.test(rig.slug) && (gait === "walk" || gait === "amble") ? 0.05 : 0;
        const nod = motion * nodAmp * Math.sin(2 * cyc + Math.PI * 2 * refOffset);
        // Long necks lag a little behind the body's bob.
        const lag = stepSpring(s.neckLag, -bob / Math.max(legH, 1e-4) * 0.6, dt, 2.5, 0.4);
        let thrust = 0;
        if (headBobs(rig.slug, rig.plan) && s.moving && rig.head >= 0 && rig.neck >= 0) {
            // Hold the head still in the air for 60% of each step, then thrust it forward.
            const neckLen = worldPos(world[rig.head], tmpV2).distanceTo(pivot);
            const step = frac(2 * s.phase);
            const reach = (0.3 * s.stride) / scale;
            const offset = step < 0.6 ? reach / 2 - reach * (step / 0.6) : -reach / 2 + reach * smooth((step - 0.6) / 0.4);
            thrust = clamp(Math.asin(clamp(offset / Math.max(neckLen, 1e-4), -0.6, 0.6)), -0.6, 0.6) * motion;
        }
        // (The neck carries the body's pitch: slope + rock + lean at the hips, flex at the chest. The head keeps the slope.)
        const neckPitch = -steady * (rock + flex + 0.5 * accLean) + nod + lag * (1 - steady) + thrust;
        tmpQ.setFromAxisAngle(X, neckPitch);
        tmpQ2.setFromAxisAngle(Z, -steady * (roll + lean) * 0.8);
        tmpQ.premultiply(tmpQ2);
        tmpQ2.setFromAxisAngle(Y, clamp(0.1 * s.turn, -0.3, 0.3) - steady * hipsYaw - steady * 0.5 * chestYaw);
        tmpQ.premultiply(tmpQ2);
        rotateSubtree(rig, world, neck, tmpQ, pivot);
        if (rig.head >= 0 && rig.neck >= 0 && thrust !== 0) {
            // The head itself stays level while the neck swings it.
            pivot.setFromMatrixPosition(world[rig.head]);
            tmpQ.setFromAxisAngle(X, -thrust);
            rotateSubtree(rig, world, rig.head, tmpQ, pivot);
        }
    }
    // The tail on springs: swings out of a turn, sways against the hips, rides up at speed.
    if (rig.tail.length) {
        const tailHz = clamp(1.6 / Math.sqrt(Math.max(lengthM, 0.15)), 0.8, 4);
        const yawDrive = clamp(0.3 * s.turn, -0.7, 0.7) - 2.2 * hipsYaw - 1.5 * sway / Math.max(legH, 1e-4) * 0.1;
        const pitchDrive = clamp(0.25 * Math.min(s.froude, 2), 0, 0.5) * motion - (bob / Math.max(legH, 1e-4)) * 2;
        const out = {yaw: [] as number[], pitch: [] as number[]};
        stepChain(s.tail, yawDrive, pitchDrive, dt, tailHz, 0.3, out);
        for (let k = 0; k < rig.tail.length; k++) {
            const b = rig.tail[k];
            pivot.setFromMatrixPosition(world[b]);
            tmpQ.setFromAxisAngle(Y, out.yaw[k]);
            tmpQ2.setFromAxisAngle(X, out.pitch[k]);
            tmpQ.multiply(tmpQ2);
            rotateSubtree(rig, world, b, tmpQ, pivot);
        }
    }

    // Legs: the body lowers if a planted foot can't be reached (a step down), then IK.
    const targets = rig.legs.map((leg, i) => {
        const f = s.feet[i];
        return new Vector3(f.at.x, f.at.y, f.at.z).applyMatrix4(inv);
    });
    let deficit = 0;
    rig.legs.forEach((leg, i) => {
        if (!s.feet[i].planted) return;
        const hip = worldPos(world[leg.upper], tmpV2);
        const ankleT = tmpV.copy(targets[i]).add(footOffset(leg));
        const reach = (leg.upperLength + leg.lowerLength) * 0.97;
        const d = hip.distanceTo(ankleT);
        if (d > reach) deficit = Math.max(deficit, Math.sqrt(Math.max(d * d - (hip.x - ankleT.x) ** 2 - (hip.z - ankleT.z) ** 2, 0)) - Math.sqrt(Math.max(reach * reach - (hip.x - ankleT.x) ** 2 - (hip.z - ankleT.z) ** 2, 0)));
    });
    const drop = stepSpring(s.drop, Math.min(deficit, 0.3 * legH), dt, 10, 1);
    if (drop > 1e-6) translateSubtree(rig, world, hips, 0, -drop, 0);
    const bodyTurn = tmpQ.setFromRotationMatrix(tmpM.extractRotation(world[hips])).multiply(tmpQ2.setFromRotationMatrix(tmpM.extractRotation(rig.bones[hips].restWorld)).invert());
    for (let i = 0; i < rig.legs.length; i++) {
        const leg = rig.legs[i];
        const f = s.feet[i];
        // The foot turned to the ground (mesh-space normal), its toe tipped down in the swing.
        const n = tmpV2.set(f.nx, f.ny, f.nz).transformDirection(inv);
        const align = new Quaternion().setFromUnitVectors(Y, n).slerp(new Quaternion(), 0.3);
        if (!f.planted) align.multiply(new Quaternion().setFromAxisAngle(X, 0.5 * Math.sin(Math.PI * f.w)));
        const off = new Vector3(leg.contact[0] - leg.ankle[0], leg.contact[1] - leg.ankle[1], leg.contact[2] - leg.ankle[2]).applyQuaternion(align);
        const ankleTarget = targets[i].clone().sub(off);
        const pole = s.poles[i].clone().applyQuaternion(bodyTurn);
        solveLeg(leg, world, ankleTarget, pole);
        // Foot: its rest turn, aligned to the ground, at the ankle IK put it at.
        const at = worldPos(world[leg.foot], new Vector3());
        const restRot = new Quaternion().setFromRotationMatrix(tmpM.extractRotation(rig.bones[leg.foot].restWorld));
        world[leg.foot].makeRotationFromQuaternion(align.multiply(restRot)).setPosition(at);
    }
    return {
        gait,
        phase: s.phase,
        cadence: s.cadence,
        stride: s.stride,
        duty: s.duty,
        speed,
        accel: s.accel,
        turn: s.turn,
        froude: s.froude,
        feet: feetOut
    };
}

/** The ankle above its contact at rest (mesh units). */
function footOffset(leg: LocoRig["legs"][number]): Vector3 {
    return new Vector3(leg.ankle[0] - leg.contact[0], leg.ankle[1] - leg.contact[1], leg.ankle[2] - leg.contact[2]);
}

function land(f: Foot, input: LocoInput) {
    const g = input.ground(f.at.x, f.at.z);
    f.at.y = g.height;
    f.ground = g.height;
    f.nx = g.nx;
    f.ny = g.ny;
    f.nz = g.nz;
    f.planted = true;
    f.w = 0;
}

/** A swing's point: from where it lifted to its landing, eased, arcing over the higher of the two grounds. */
function swingTo(f: Foot, tx: number, tz: number, w: number, height: number, input: LocoInput) {
    const e = smooth(w);
    const g = input.ground(tx, tz);
    const x = f.from.x + (tx - f.from.x) * e;
    const z = f.from.z + (tz - f.from.z) * e;
    const base = f.from.y + (g.height - f.from.y) * e;
    // Clear the ground under the foot on its way (a rock, a step up).
    const under = input.ground(x, z).height;
    f.at.set(x, Math.max(base, under) + height * Math.sin(Math.PI * clamp(w, 0, 1)), z);
    f.ground = under;
    f.nx = g.nx;
    f.ny = g.ny;
    f.nz = g.nz;
}
