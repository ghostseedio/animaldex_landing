/**
 * Life for the sitting rigs (behaviours pass 2026-11, lane B4): the 54 species rigged in a sitting rest pose (rabbits,
 * hares, kangaroos, wallabies, squirrels, meerkats, prairie dogs, gibbons, lemurs, lorises...). Their legs run through
 * an upright trunk and cannot step, so the legged driver never takes them: at rest they played their two-second baked
 * idle and nothing else, and the sixteen with no moving clip at all (the sitting primates) slid along sitting up.
 *
 * On top of the baked clip's frame (after its feet are put on the ground), from the shared clock and the animal's own
 * seed, so every viewer sees the same:
 *
 * - **At rest** (its idle): it looks about, a new look every few seconds, turned to quickly and held (a rabbit's and a
 *   meerkat's watchfulness: a sharp turn of the head, then still), now and then straight ahead; its chest breathes;
 *   its tail flicks now and then.
 * - **On the move with no clip to move by** (still on its idle): it hops along, the body rising and tipping forward
 *   with each hop by the distance it covers, never a slide.
 *
 * Visual only; a few dozen multiplications per sitting animal drawn.
 */

import {Quaternion, Vector3, type Matrix4} from "three";
import {newSpring, stepSpring, type Spring} from "@/ark-scene/locomotion/secondary";
import {rotateSubtree, translateSubtree} from "@/ark-scene/locomotion/skeleton";
import type {LocoInput, LocoRig} from "@/ark-scene/locomotion/types";

export type SitState = {has: boolean; x: number; z: number; speed: number; motion: number; phase: number; yaw: Spring; pitch: Spring; tail: Spring};

export const newSitState = (): SitState => ({has: false, x: 0, z: 0, speed: 0, motion: 0, phase: 0, yaw: newSpring(), pitch: newSpring(), tail: newSpring()});

/** How far it turns its head to look (radians either way), and how far up or down. */
export const SIT_LOOK_YAW = 0.55;
export const SIT_LOOK_PITCH = 0.14;
/** A hop's length (body lengths) and height (share of its height) for a sitter with no moving clip. */
export const SIT_HOP_LENGTH = 0.55;
export const SIT_HOP_HEIGHT = 0.07;

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const pivot = new Vector3();
const q = new Quaternion();
const q2 = new Quaternion();
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const hash = (a: number, b: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
};

const LOOK = {yaw: 0, pitch: 0};
/**
 * Where an animal at rest looks at a moment (radians: yaw, pitch): a new look every `period` to `period + spread`
 * seconds (its own rhythm, from its seed), about one in three straight ahead, the rest up to `yawMost` to either side
 * and `pitchMost` up or down. Pure in the clock and its seed; the result is one reused object.
 */
export function lookAbout(clock: number, seed: number, yawMost: number, pitchMost: number, period: number, spread: number): {yaw: number; pitch: number} {
    const every = period + spread * hash(seed * 17, 2);
    const slot = Math.floor((clock + seed * 53) / every);
    if (hash(slot, seed * 29) < 0.33) {
        LOOK.yaw = 0;
        LOOK.pitch = 0;
    } else {
        LOOK.yaw = (hash(slot, seed * 41) - 0.5) * 2 * yawMost;
        LOOK.pitch = (hash(slot, seed * 7) - 0.5) * 2 * pitchMost;
    }
    return LOOK;
}

/** Where a sitting rig looks at a moment: a new look every 2.4 to 6 s. */
export function sitLook(clock: number, seed: number): {yaw: number; pitch: number} {
    return lookAbout(clock, seed, SIT_LOOK_YAW, SIT_LOOK_PITCH, 2.4, 3.6);
}

/** A sitting rig's life on its clip's frame (`world`: mesh space, changed in place). */
export function sitLife(rig: LocoRig, input: LocoInput, world: Matrix4[], s: SitState): void {
    const dt = clamp(input.dt, 0, 0.1);
    const e = input.instance.elements;
    const scale = Math.max(input.scale, 1e-6);
    const lengthM = Math.max(Math.max(rig.length, rig.height) * scale, 1e-3);
    let moved = 0;
    if (s.has) {
        moved = Math.hypot(e[12] - s.x, e[14] - s.z);
        if (moved > 4 * lengthM) moved = 0;
        if (dt > 0) s.speed += (moved / dt - s.speed) * Math.min(dt * 6, 1);
    } else s.phase = input.seed * 5;
    s.has = true;
    s.x = e[12];
    s.z = e[14];
    const idle = input.clipNow === "idle";
    // Hopping along on its idle (no clip to move by): only then.
    const hopping = idle && input.grounded && s.speed > 0.08 * lengthM;
    s.motion += ((hopping ? 1 : 0) - s.motion) * Math.min(dt * 6, 1);
    if (hopping) s.phase += moved / (SIT_HOP_LENGTH * lengthM);
    const hips = rig.hips >= 0 ? rig.hips : 0;
    if (s.motion > 0.01) {
        const up = Math.abs(Math.sin(Math.PI * s.phase));
        translateSubtree(rig, world, hips, 0, SIT_HOP_HEIGHT * rig.height * up * s.motion, 0);
        // (Tipped forward as it goes, most as it pushes off.)
        pivot.setFromMatrixPosition(world[hips]);
        rotateSubtree(rig, world, hips, q.setFromAxisAngle(X, (0.1 + 0.08 * Math.cos(Math.PI * 2 * s.phase)) * s.motion), pivot);
    }
    if (!idle) {
        // (Another clip: its own head and tail. The looks ease out, so nothing snaps when it comes back.)
        stepSpring(s.yaw, 0, dt, 3, 1);
        stepSpring(s.pitch, 0, dt, 3, 1);
        return;
    }
    const still = 1 - s.motion;
    // Breathing: the chest rises and settles (quicker for a small animal).
    if (rig.chest >= 0) {
        const hz = clamp(0.5 / Math.sqrt(Math.max(lengthM, 0.05)), 0.4, 2.2);
        pivot.setFromMatrixPosition(world[rig.chest]);
        rotateSubtree(rig, world, rig.chest, q.setFromAxisAngle(X, -0.014 * Math.sin(Math.PI * 2 * (input.clock * hz + input.seed * 3))), pivot);
    }
    // Looking about: turned to quickly, then held.
    const look = sitLook(input.clock, input.seed);
    const yaw = stepSpring(s.yaw, look.yaw * still, dt, 2.6, 0.85);
    const pitch = stepSpring(s.pitch, look.pitch * still, dt, 2.6, 0.85);
    const neck = rig.neck >= 0 ? rig.neck : rig.head;
    if (neck >= 0 && (Math.abs(yaw) > 1e-4 || Math.abs(pitch) > 1e-4)) {
        // (Half at the neck, half at the head where it has both: the turn spread along it.)
        const share = rig.neck >= 0 && rig.head >= 0 ? 0.5 : 1;
        pivot.setFromMatrixPosition(world[neck]);
        q.setFromAxisAngle(Y, yaw * share);
        q.multiply(q2.setFromAxisAngle(X, pitch * share));
        rotateSubtree(rig, world, neck, q, pivot);
        if (share < 1) {
            pivot.setFromMatrixPosition(world[rig.head]);
            q.setFromAxisAngle(Y, yaw * share);
            q.multiply(q2.setFromAxisAngle(X, pitch * share));
            rotateSubtree(rig, world, rig.head, q, pivot);
        }
    }
    // A tail flick now and then.
    if (rig.tail.length) {
        const flick = 0.3 * Math.sin(input.clock * 5.5 + input.seed * 9) * Math.max(Math.sin(input.clock * 0.33 + input.seed * 13) - 0.6, 0) * 2.5;
        const swing = stepSpring(s.tail, flick * still, dt, 3, 0.6);
        if (Math.abs(swing) > 1e-4) {
            for (const bone of rig.tail) {
                pivot.setFromMatrixPosition(world[bone]);
                rotateSubtree(rig, world, bone, q.setFromAxisAngle(Y, swing / rig.tail.length), pivot);
            }
        }
    }
}
