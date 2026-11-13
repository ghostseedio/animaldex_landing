/**
 * Land gaits that are not a gait of legs (movement audit lane MA4, findings 10 and 11; docs/ark/movement-audit-2026-11-13.md),
 * drivers for the locomotion layer (`layer.ts`), registered with lane L2's (`l2-scene.ts`):
 *
 * - `galumphDriver`: true seals (Phocidae, `landGait` "galumph") on land. A seal cannot turn its hind flippers forward,
 *   so it humps along on its belly: the chest rises and reaches forward, lands, then the back arches up and draws the
 *   hips after it, a wave from the chest back; the fore flippers reach and pull, the hind flippers are held up off the
 *   ground behind. One hump a fifth of the body long (Tarasoff et al. 1972 on the harp seal; field footage of harbour
 *   and grey seals), so the hump rate follows the speed. Sea lions, fur seals and the walrus walk on their flippers:
 *   the legged gaits (`gaits.ts`).
 * - `saltationDriver`: frogs and toads (`landGait` "leap" and "hop") on land: a real hop, not a gait cycle. The frog sits,
 *   then pushes off with its hind legs, flies a ballistic arc with its hind legs trailing straight back and its arms
 *   reaching, lands on its arms and gathers its legs back under it, and sits again (Nauwelaerts and Aerts 2006 on
 *   frog landing; Astley and Roberts 2012 on the jump). The schedule moves its place smoothly; the frog stays put
 *   between hops and jumps to where its place will be as it lands, so the body trails its place by up to a hop and
 *   catches it up at each landing (at rest it settles onto it with a last short hop forward). Leapers (true and tree
 *   frogs) hop about two body lengths at 32 degrees; walker-hoppers (toads) under one at 22 degrees, and walk with the
 *   legged gaits when slow.
 *
 * Both are visual only (the schedule's positions are untouched) and start from the rest pose. Their state is per viewer
 * and converges the same way for every viewer.
 */

import {Matrix4, Quaternion, Vector3} from "three";
import {G, landGait} from "@/ark-scene/locomotion/gaits";
import {restPole, solveLeg} from "@/ark-scene/locomotion/ik";
import {leggedDriver, type LeggedState} from "@/ark-scene/locomotion/legged";
import {rotateSubtree, translateSubtree} from "@/ark-scene/locomotion/skeleton";
import type {GaitState, LocoDriver, LocoInput, LocoRig} from "@/ark-scene/locomotion/types";

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const frac = (v: number) => v - Math.floor(v);
const smooth = (v: number) => {
    const c = clamp(v, 0, 1);
    return c * c * (3 - 2 * c);
};
const wrapPi = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;

const X = new Vector3(1, 0, 0);
const UP = new Vector3(0, 1, 0);
const vA = new Vector3();
const vB = new Vector3();
const vC = new Vector3();
const qA = new Quaternion();
const mA = new Matrix4();

/** Clips during which these drivers draw the animal (as the legged driver's: a walk, a run, a hop, standing). */
export const LAND_DRIVER_CLIPS: ReadonlySet<string> = new Set(["walk", "run", "hop", "idle"]);

/** The development switch lane L2's hooks share (`globalThis.__arkL2Motion = false`: the scene as before). */
const l2Off = () => (globalThis as {__arkL2Motion?: boolean}).__arkL2Motion === false;

// MARK: Galumph

/** A hump's advance, as a share of the body's length; the most humps a second (past it the humps get longer). */
export const GALUMPH_STRIDE = 0.2;
export const GALUMPH_MAX_HZ = 2;
/** The back's hump at its top (the chest raised off the hips, a share of the body's length), the chest's lift as it reaches (radians). */
export const GALUMPH_ARCH = 0.09;
export const GALUMPH_LIFT = 0.22;
/** The hind flippers' webs held up behind off the ground (radians at the ankle), the fore flippers' reach and pull. */
export const GALUMPH_HIND_UP = 0.8;
export const GALUMPH_FORE_SWING = 0.35;

export type GalumphState = {has: boolean; x: number; z: number; speed: number; turn: number; yaw: number; cycles: number; motion: number};

/**
 * The galumph's body wave at a point of its cycle (0..1, a hump each cycle) and how much it moves (0 still, 1 on its
 * way): the arch (1 at the top of the hump: the hips just drawn up behind the chest), the chest's lift (it rises and
 * reaches in the first half), the fore flippers' swing (+ back) and the body's surge along its way (shares of the
 * stride: it lunges ahead of its place, then waits for the hips).
 */
export function galumphWave(cycle: number, motion: number): {arch: number; lift: number; fore: number; surge: number} {
    const u = frac(cycle);
    // The back arches as the hips are drawn up (second half) and flattens as the chest reaches (first half).
    const arch = 0.5 + 0.5 * Math.cos(2 * Math.PI * u);
    const lift = u < 0.5 ? Math.sin(2 * Math.PI * u) : 0;
    // (Back at the top of the arch, pulling; furthest forward as the chest comes down.)
    const fore = Math.cos(2 * Math.PI * u);
    // (Ahead of its place while the chest lunges, behind it as the hips catch up; no mean offset.)
    const surge = -Math.cos(2 * Math.PI * u) * 0.12;
    return {arch: arch * motion, lift: lift * motion, fore: fore * motion, surge: surge * motion};
}

export const galumphDriver: LocoDriver = {
    name: "galumph",
    takes(rig, input) {
        return !l2Off() && input.grounded && rig.legs.length === 4 && rig.hips >= 0 && rig.chest >= 0 && LAND_DRIVER_CLIPS.has(input.clipNow) && input.clipNow !== "idle" && landGait(rig.slug) === "galumph";
    },
    base() {
        return "rest";
    },
    init(): GalumphState {
        return {has: false, x: 0, z: 0, speed: 0, turn: 0, yaw: 0, cycles: 0, motion: 0};
    },
    pose(rig, input, world, raw): GaitState {
        const s = raw as GalumphState;
        const dt = clamp(input.dt, 0, 0.1);
        const e = input.instance.elements;
        const scale = Math.max(input.scale, 1e-6);
        const lengthM = Math.max(rig.length * scale, 1e-3);
        let moved = 0;
        if (s.has) {
            moved = Math.hypot(e[12] - s.x, e[14] - s.z);
            if (moved > 4 * lengthM) moved = 0;
            if (dt > 0) {
                s.speed += (moved / dt - s.speed) * Math.min(dt * 5, 1);
                s.turn += (wrapPi(input.yaw - s.yaw) / dt - s.turn) * Math.min(dt * 5, 1);
            }
        } else s.cycles = input.seed * 3;
        s.has = true;
        s.x = e[12];
        s.z = e[14];
        s.yaw = input.yaw;
        const moving = s.speed > 0.03 * lengthM;
        s.motion += ((moving ? 1 : 0) - s.motion) * Math.min(dt * 4, 1);
        // The hump: a fifth of its length a hump, at most two a second (faster, the humps grow).
        const stride = Math.max(GALUMPH_STRIDE * lengthM, s.speed / GALUMPH_MAX_HZ);
        s.cycles += moved / stride;
        const w = galumphWave(s.cycles, s.motion);
        poseGalumph(rig, world, w);
        return {gait: "galumph", phase: s.cycles, cadence: s.speed / stride, stride, duty: 0.5, speed: s.speed, accel: 0, turn: s.turn, froude: (s.speed * s.speed) / (G * Math.max(rig.legHeight * scale, 1e-3)), feet: []};
    }
};

/** The galumph's pose on the rest pose (mesh space, in place). */
export function poseGalumph(rig: LocoRig, world: Matrix4[], w: {arch: number; lift: number; fore: number; surge: number}): void {
    const fore = rig.legs.filter((l) => l.end === "fore");
    const hind = rig.legs.filter((l) => l.end === "hind");
    const hips = rig.hips;
    const chest = rig.chest;
    const chestZ = vA.setFromMatrixPosition(rig.bones[chest].restWorld).z;
    const rearZ = hind.length ? hind.reduce((a, l) => a + l.hip[2], 0) / hind.length : vB.setFromMatrixPosition(rig.bones[hips].restWorld).z;
    const frontZ = Math.max(fore.length ? fore.reduce((a, l) => a + l.contact[2], 0) / fore.length : rig.length * 0.3, chestZ + 0.05 * rig.length);
    const floor = rig.minY;
    // The belly's contacts (rest mesh): under the hips, carried by the hips; under the fore flippers, by the chest.
    const rear = (out: Vector3) => carried(rig, world, hips, 0, floor, rearZ, out);
    const front = (out: Vector3) => carried(rig, world, chest, 0, floor, frontZ, out);
    // The hind flippers' webs lifted off the ground behind (turned at the ankle: the rigs skin the rear belly to the hind
    // legs' upper and lower bones, so turned at the hip or knee the belly would lift or sink with them), a little
    // higher at the hump's top.
    for (const leg of hind) rotateSubtree(rig, world, leg.foot, qA.setFromAxisAngle(X, GALUMPH_HIND_UP + 0.15 * w.arch), vB.set(leg.ankle[0], leg.ankle[1], leg.ankle[2]));
    // The fore flippers swing forward (about the upright, so the belly by the shoulder is not pushed into the ground) as
    // the chest reaches, and pull back as the hips come up.
    for (const leg of fore) rotateSubtree(rig, world, leg.upper, qA.setFromAxisAngle(UP, leg.side * GALUMPH_FORE_SWING * w.fore), vB.set(leg.hip[0], leg.hip[1], leg.hip[2]));
    // The surge along its way (mesh units).
    const surgeZ = w.surge * GALUMPH_STRIDE * rig.length;
    translateSubtree(rig, world, hips, 0, 0, surgeZ);
    // The arch: the chest raised off the hips (the skin between them humps up, the hips stay down) and gathered back
    // toward them, then tipped nose-down about itself until the front is back on the ground.
    const arch = GALUMPH_ARCH * w.arch * rig.length;
    if (arch > 1e-6) {
        translateSubtree(rig, world, chest, 0, arch, -0.35 * arch);
        const pivot = vC.setFromMatrixPosition(world[chest]);
        const f = front(vB);
        const dy = f.y - pivot.y;
        const dz = f.z - pivot.z;
        // (The nose-down turn that puts the front contact back at the floor: dy cos δ − dz sin δ = floor − pivot.)
        let lo = 0;
        let hi = 1.2;
        for (let k = 0; k < 18; k++) {
            const mid = (lo + hi) / 2;
            if (pivot.y + dy * Math.cos(mid) - dz * Math.sin(mid) > floor) lo = mid;
            else hi = mid;
        }
        rotateSubtree(rig, world, chest, qA.setFromAxisAngle(X, (lo + hi) / 2), pivot);
    }
    // The chest's lift as it reaches (nose up about the chest), the head held on toward its way.
    const gamma = GALUMPH_LIFT * w.lift;
    if (gamma > 1e-4) {
        rotateSubtree(rig, world, chest, qA.setFromAxisAngle(X, -gamma), vC.setFromMatrixPosition(world[chest]));
        const neck = rig.neck >= 0 ? rig.neck : rig.head;
        if (neck >= 0) rotateSubtree(rig, world, neck, qA.setFromAxisAngle(X, 0.55 * gamma), vC.setFromMatrixPosition(world[neck]));
    }
    // On the ground: the lower of its two contacts at the floor (never floating, never sunk).
    const low = Math.min(rear(vB).y, front(vC).y);
    if (Math.abs(low - floor) > 1e-6) translateSubtree(rig, world, hips, 0, floor - low, 0);
}

/** Where a rest point (mesh) carried by a bone is now. */
function carried(rig: LocoRig, world: readonly Matrix4[], bone: number, x: number, y: number, z: number, out: Vector3): Vector3 {
    return out.set(x, y, z).applyMatrix4(mA.copy(rig.bones[bone].restWorld).invert()).applyMatrix4(world[bone]);
}

// MARK: Saltation

export type HopClass = "leap" | "hop";

/** A class's hop: its natural length (body lengths), its launch angle, how long it sits at least between hops (s, at 10 cm). */
export const HOPS: Record<HopClass, {lengths: number; angle: number; sit: number; push: number; land: number}> = {
    leap: {lengths: 2.2, angle: (32 * Math.PI) / 180, sit: 0.18, push: 0.09, land: 0.22},
    hop: {lengths: 0.9, angle: (22 * Math.PI) / 180, sit: 0.1, push: 0.07, land: 0.15}
};
/** A walker-hopper (a toad) walks below this pace (body lengths a second) and hops above it (hysteresis below). */
export const TOAD_HOP_PACE = 1.0;

type Phase = "sit" | "push" | "air" | "land";
type HopFoot = {x: number; y: number; z: number};

export type SaltationState = {
    started: boolean;
    /** Where the body is (world) and which way it faces, and the place the schedule has it at. */
    bx: number;
    bz: number;
    bodyYaw: number;
    rx: number;
    rz: number;
    vx: number;
    vz: number;
    still: number;
    clock: number;
    phase: Phase;
    t: number;
    hops: number;
    /** This hop: from, to (world), its yaw, the take-off's end and the touch-down point, its times. */
    hop: {fx: number; fz: number; tx: number; tz: number; yaw: number; yaw0: number; push: number; air: number; land: number; dPush: number; dLand: number; apex: number; length: number};
    /** The feet planted (world): sitting, all four; landing, the arms first. */
    feet: HopFoot[];
    /** A toad walking (the legged gaits), or hopping. */
    walking: boolean;
    legged: LeggedState | null;
};

export function hopClassOf(slug: string): HopClass | null {
    const g = landGait(slug);
    return g === "leap" || g === "hop" ? g : null;
}

/** A hop's timing for its length (m) and class: the push, a ballistic flight at its angle, the landing (s). */
export function hopTiming(cls: HopClass, lengthM: number, distance: number): {push: number; air: number; land: number; dPush: number; dLand: number; apex: number} {
    const k = HOPS[cls];
    const size = Math.sqrt(clamp(lengthM / 0.1, 0.2, 9));
    const dPush = Math.min(0.12 * distance, 0.35 * lengthM);
    const dLand = Math.min(0.1 * distance, 0.25 * lengthM);
    const flight = Math.max(distance - dPush - dLand, 0.2 * distance);
    // Ballistic: v_h = D / T and v_up = g T / 2, so tan θ = g T² / 2D.
    const air = Math.sqrt((2 * flight * Math.tan(k.angle)) / G);
    return {push: clamp(k.push * size, 0.04, 0.2), air: Math.max(air, 0.05), land: clamp(k.land * size, 0.08, 0.45), dPush, dLand, apex: (flight * Math.tan(k.angle)) / 4};
}

const newHop = () => ({fx: 0, fz: 0, tx: 0, tz: 0, yaw: 0, yaw0: 0, push: 0, air: 0, land: 0, dPush: 0, dLand: 0, apex: 0, length: 0});

export const saltationDriver: LocoDriver = {
    name: "saltation",
    takes(rig, input) {
        return !l2Off() && input.grounded && rig.legs.length === 4 && rig.hips >= 0 && !rig.sitting && rig.legHeight > 0 && LAND_DRIVER_CLIPS.has(input.clipNow) && hopClassOf(rig.slug) !== null;
    },
    base() {
        return "rest";
    },
    init(rig): SaltationState {
        return {started: false, bx: 0, bz: 0, bodyYaw: 0, rx: 0, rz: 0, vx: 0, vz: 0, still: 0, clock: 0, phase: "sit", t: 0, hops: 0, hop: newHop(), feet: rig.legs.map(() => ({x: 0, y: 0, z: 0})), walking: false, legged: null};
    },
    pose(rig, input, world, raw): GaitState {
        return poseSaltation(rig, input, world, raw as SaltationState);
    }
};

/** Where each foot sits under the body (world) with the body at (x, z) facing `yaw`: its rest contact, on the ground. */
function sitFeet(rig: LocoRig, input: LocoInput, s: SaltationState, x: number, z: number, yaw: number): void {
    const scale = input.scale;
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    rig.legs.forEach((leg, i) => {
        const lx = leg.contact[0] * scale;
        const lz = leg.contact[2] * scale;
        const fx = x + lx * c + lz * sn;
        const fz = z - lx * sn + lz * c;
        s.feet[i] = {x: fx, y: input.ground(fx, fz).height, z: fz};
    });
}

/**
 * Pose a frog or toad for this frame (world: the rest pose, mesh space, changed in place). The body is drawn where
 * its own hops have brought it (`s.bx`, `s.bz`), which leapfrogs the schedule's place (the instance).
 */
export function poseSaltation(rig: LocoRig, input: LocoInput, world: Matrix4[], s: SaltationState): GaitState {
    const cls = hopClassOf(rig.slug) ?? "hop";
    const k = HOPS[cls];
    const dt = clamp(input.dt, 0, 0.1);
    const scale = Math.max(input.scale, 1e-6);
    const lengthM = Math.max(rig.length * scale, 1e-3);
    const e = input.instance.elements;
    const rx = e[12];
    const rz = e[14];
    // A jump (a new spot, a cut, the clock going back): the body on its place, sitting.
    if (!s.started || Math.hypot(rx - s.bx, rz - s.bz) > 6 * lengthM + 1 || input.clock < s.clock - 0.01) {
        s.started = true;
        s.bx = rx;
        s.bz = rz;
        s.bodyYaw = input.yaw;
        s.vx = 0;
        s.vz = 0;
        s.phase = "sit";
        s.t = 0;
        s.still = 0;
        sitFeet(rig, input, s, rx, rz, input.yaw);
    } else if (dt > 0) {
        // (Lightly eased: a stop is seen at once, so it never hops on past its place.)
        const kv = Math.min(dt * 20, 1);
        s.vx += ((rx - s.rx) / dt - s.vx) * kv;
        s.vz += ((rz - s.rz) / dt - s.vz) * kv;
    }
    s.rx = rx;
    s.rz = rz;
    s.clock = input.clock;
    const speed = Math.hypot(s.vx, s.vz);
    const moving = speed > 0.05 * lengthM;
    s.still = moving ? 0 : s.still + dt;

    // A toad walks when slow (the legged gaits), hops when faster; it changes over only sitting on its place.
    if (cls === "hop") {
        const pace = speed / lengthM;
        if (s.walking && pace > TOAD_HOP_PACE) {
            s.walking = false;
            s.phase = "sit";
            s.t = k.sit;
            s.bx = rx;
            s.bz = rz;
            s.bodyYaw = input.yaw;
            sitFeet(rig, input, s, rx, rz, input.yaw);
        } else if (!s.walking && s.phase === "sit" && pace < 0.75 * TOAD_HOP_PACE && Math.hypot(rx - s.bx, rz - s.bz) < 0.3 * lengthM && s.still === 0) {
            s.walking = true;
            s.legged = null;
        }
        if (s.walking) {
            s.bx = rx;
            s.bz = rz;
            s.bodyYaw = input.yaw;
            s.legged ??= leggedDriver.init(rig) as LeggedState;
            return leggedDriver.pose(rig, input, world, s.legged)!;
        }
    }

    // The hop's own clock.
    s.t += dt;
    if (s.phase === "sit") {
        const offX = rx - s.bx;
        const offZ = rz - s.bz;
        const lag = Math.hypot(offX, offZ);
        const natural = k.lengths * lengthM;
        let go: {tx: number; tz: number} | null = null;
        if (moving && s.t >= k.sit) {
            // Off once its place, by the time it lands, is a natural hop away: it lands on its place.
            const guess = hopTiming(cls, lengthM, natural);
            const ahead = guess.push + guess.air + guess.land * 0.5;
            const px = rx + s.vx * ahead;
            const pz = rz + s.vz * ahead;
            if (Math.hypot(px - s.bx, pz - s.bz) >= natural) go = {tx: px, tz: pz};
        } else if (!moving && lag > 0.25 * lengthM) {
            // Settling: one short hop onto its place, once it has stopped.
            if (s.still > 0.35 && s.t >= k.sit) go = {tx: rx, tz: rz};
        } else if (!moving) {
            // Close enough: it shuffles onto its place and round to its heading (a slow turn, the feet re-set under it).
            const kk = Math.min(dt * 1.5, 1);
            s.bx += offX * kk;
            s.bz += offZ * kk;
            const turn = wrapPi(input.yaw - s.bodyYaw);
            s.bodyYaw += Math.sign(turn) * Math.min(Math.abs(turn), 1.2 * dt);
            if (Math.abs(turn) > 0.02 || lag > 1e-4) sitFeet(rig, input, s, s.bx, s.bz, s.bodyYaw);
        }
        if (go) {
            let dx = go.tx - s.bx;
            let dz = go.tz - s.bz;
            let d = Math.hypot(dx, dz);
            // (No longer than three natural hops: a frog left far behind catches up over several.)
            const most = 3 * natural;
            if (d > most) {
                dx *= most / d;
                dz *= most / d;
                d = most;
            }
            const t = hopTiming(cls, lengthM, d);
            s.hop = {fx: s.bx, fz: s.bz, tx: s.bx + dx, tz: s.bz + dz, yaw: Math.atan2(dx, dz), yaw0: s.bodyYaw, ...t, length: d};
            // (A hop straight back would turn it about first: it faces its hop.)
            s.phase = "push";
            s.t = 0;
            s.hops++;
        }
    }
    const h = s.hop;
    if (s.phase === "push" && s.t >= h.push) {
        s.phase = "air";
        s.t -= h.push;
    }
    if (s.phase === "air" && s.t >= h.air) {
        s.phase = "land";
        s.t -= h.air;
        // The arms touch down where they reach (planted), the legs still trailing.
        const yaw = h.yaw;
        const c = Math.cos(yaw);
        const sn = Math.sin(yaw);
        const tdx = h.tx - (h.tx - h.fx) / Math.max(h.length, 1e-6) * h.dLand;
        const tdz = h.tz - (h.tz - h.fz) / Math.max(h.length, 1e-6) * h.dLand;
        rig.legs.forEach((leg, i) => {
            if (leg.end !== "fore") return;
            const lx = leg.contact[0] * scale;
            const lz = (leg.contact[2] + 0.1 * rig.length) * scale;
            const fx = tdx + lx * c + lz * sn;
            const fz = tdz - lx * sn + lz * c;
            s.feet[i] = {x: fx, y: input.ground(fx, fz).height, z: fz};
        });
    }
    if (s.phase === "land" && s.t >= h.land) {
        s.phase = "sit";
        s.t = 0;
        s.bx = h.tx;
        s.bz = h.tz;
        s.bodyYaw = h.yaw;
        sitFeet(rig, input, s, s.bx, s.bz, s.bodyYaw);
    }

    // Where the body is now (world), its height over its sitting height, its pitch (+ nose up) and its legs' stage.
    let bx = s.bx;
    let bz = s.bz;
    let yaw = s.bodyYaw;
    let rise = 0;
    let pitch = 0;
    let trail = 0;
    let reach = 0;
    const dirX = (h.tx - h.fx) / Math.max(h.length, 1e-6);
    const dirZ = (h.tz - h.fz) / Math.max(h.length, 1e-6);
    const groundAt = (x: number, z: number) => input.ground(x, z).height;
    const legH = rig.legHeight * scale;
    if (s.phase === "push") {
        const u = smooth(s.t / h.push);
        bx = h.fx + dirX * h.dPush * u;
        bz = h.fz + dirZ * h.dPush * u;
        yaw = h.yaw0 + wrapPi(h.yaw - h.yaw0) * smooth(s.t / (0.6 * h.push));
        rise = 0.35 * legH * u;
        pitch = 0.32 * u;
        trail = 0.6 * u;
        reach = 0.5 * u;
    } else if (s.phase === "air") {
        const u = clamp(s.t / h.air, 0, 1);
        const flight = Math.max(h.length - h.dPush - h.dLand, 0);
        bx = h.fx + dirX * (h.dPush + flight * u);
        bz = h.fz + dirZ * (h.dPush + flight * u);
        yaw = h.yaw;
        // A ballistic arc between the take-off's height and the touch-down's (over each end's ground).
        const g0 = groundAt(h.fx, h.fz);
        const g1 = groundAt(h.tx, h.tz);
        rise = (g0 - groundAt(bx, bz)) * (1 - u) + (g1 - groundAt(bx, bz)) * u + 0.35 * legH * (1 - u) + 0.15 * legH * u + 4 * h.apex * u * (1 - u);
        pitch = 0.32 - 0.52 * u;
        trail = 0.6 + 0.4 * smooth(u / 0.3);
        reach = 0.5 + 0.5 * u;
    } else if (s.phase === "land") {
        const u = smooth(s.t / h.land);
        bx = h.tx - dirX * h.dLand * (1 - u);
        bz = h.tz - dirZ * h.dLand * (1 - u);
        yaw = h.yaw;
        rise = 0.15 * legH * (1 - u) - 0.06 * legH * Math.sin(Math.PI * u);
        pitch = -0.2 * (1 - u);
        // (The legs swing in under it early in the landing: they are gathered before the body settles.)
        trail = 1 - smooth(s.t / (0.7 * h.land));
        reach = 1 - u;
    }

    // The body frame: the rest pose moved from the instance's place to the body's (mesh units), turned by its own heading
    // against the instance's, pitched about its hips (pushing) or its middle (flying, landing).
    const c = Math.cos(input.yaw);
    const sn = Math.sin(input.yaw);
    const wx = bx - rx;
    const wz = bz - rz;
    const mx = (wx * c - wz * sn) / scale;
    const mz = (wx * sn + wz * c) / scale;
    const lift = (groundAt(bx, bz) - groundAt(rx, rz) + rise) / scale;
    const hipsZ = rig.legs.filter((l) => l.end === "hind").reduce((a, l, _, all) => a + l.hip[2] / all.length, 0);
    const pivotZ = s.phase === "push" ? hipsZ : 0;
    const frame = new Matrix4().makeTranslation(mx, lift, mz)
        .multiply(mA.makeRotationY(wrapPi(yaw - input.yaw)))
        .multiply(new Matrix4().makeTranslation(0, rig.minY, pivotZ))
        .multiply(new Matrix4().makeRotationX(-pitch))
        .multiply(new Matrix4().makeTranslation(0, -rig.minY, -pivotZ));
    for (const m of world) m.premultiply(frame);
    const bodyTurn = new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(frame));

    // The legs: planted feet (world) by IK; in the air, the legs trail straight back and the arms reach.
    const inv = new Matrix4().copy(input.instance).invert();
    rig.legs.forEach((leg, i) => {
        const pole = new Vector3(...restPole(rig, leg)).applyQuaternion(bodyTurn);
        const hip = vA.setFromMatrixPosition(world[leg.upper]);
        // (Trailing, a hind leg is out nearly straight; an arm reaches a little bent.)
        const legLen = (leg.upperLength + leg.lowerLength) * (leg.end === "hind" ? 0.99 : 0.9);
        const ankleUp = leg.ankle[1] - leg.contact[1];
        const plantedNow = s.phase === "sit" || (leg.end === "hind" ? s.phase === "push" : s.phase === "land");
        let target: Vector3;
        if (plantedNow) {
            const f = s.feet[i];
            // (Pushing, the body rises off its planted hind feet and the legs straighten behind it.)
            target = new Vector3(f.x, f.y, f.z).applyMatrix4(inv);
            target.y += ankleUp;
        } else {
            // Flying, the hind legs out straight behind and the arms down and ahead; landing, the legs gathered back in
            // under it onto where they will sit (the body's sitting pose, as `trail` falls to 0).
            const back = leg.end === "hind" ? trail : 0;
            const ahead = leg.end === "fore" ? reach : 0;
            const sit = vB.set(leg.ankle[0], leg.ankle[1], leg.ankle[2]).applyMatrix4(frame);
            // (Behind and a little below the body line, so that pitched nose-down to land they still trail level, not over the back.)
            const dir = leg.end === "hind" ? new Vector3(leg.side * 0.2, -0.45, -1).normalize() : new Vector3(leg.side * 0.1, -0.8, 0.6).normalize();
            dir.applyQuaternion(bodyTurn);
            const out = hip.clone().addScaledVector(dir, legLen);
            target = sit.clone().lerp(out, leg.end === "hind" ? back : ahead);
        }
        solveLeg(leg, world, target, pole);
    });
    const hz = s.phase === "sit" ? 0 : 1 / Math.max(h.push + h.air + h.land, 1e-3);
    return {gait: s.phase === "sit" ? "sit" : cls, phase: s.hops, cadence: hz, stride: h.length, duty: 0, speed, accel: 0, turn: 0, froude: (speed * speed) / (G * Math.max(legH, 1e-3)), feet: s.feet.map((f, i) => ({key: rig.legs[i].key, x: f.x, y: f.y, z: f.z, planted: s.phase === "sit", ground: f.y}))};
}

