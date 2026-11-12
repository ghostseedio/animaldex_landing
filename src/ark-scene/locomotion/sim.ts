/**
 * A headless run of the locomotion layer for the metrics (`metrics.ts`) and CI: an animal moved along a scripted
 * path (the harness standing in for the schedule) over flat ground, a slope or steps, posed every frame at 60 fps,
 * its feet measured. The "before" side (the baked clips played by distance, as the scene did) plugs in through
 * `poser`.
 */

import {Matrix4, Quaternion, Vector3} from "three";
import {G} from "@/ark-scene/locomotion/gaits";
import {leggedDriver, type LeggedState} from "@/ark-scene/locomotion/legged";
import {measureFrame, summarise, type FrameFeet, type LocoMetrics} from "@/ark-scene/locomotion/metrics";
import type {GaitState, GroundQuery, LocoInput, LocoRig} from "@/ark-scene/locomotion/types";
import {sprintPace} from "@/ark-scene/locomotion/flee";

export type Scenario = "walk" | "trot" | "run" | "accel" | "turn" | "spin" | "slope" | "steps";
export const SCENARIOS: readonly Scenario[] = ["walk", "trot", "run", "accel", "turn", "spin", "slope", "steps"];

export type PathPoint = {x: number; z: number; yaw: number; speed: number};

/** The speed (m/s) at a Froude number on a hip height (m). */
export const speedAtFroude = (froude: number, hip: number) => Math.sqrt(froude * G * hip);

/** A scenario's ground: flat; a 15-degree slope rising along +z then falling; or smooth steps of a fifth of the hip height. */
export function scenarioGround(scenario: Scenario, hip: number): GroundQuery {
    if (scenario === "slope") {
        const k = Math.tan((15 * Math.PI) / 180);
        return (x, z) => {
            const up = z < 6 ? 1 : -1;
            const h = z < 6 ? z * k : (12 - z) * k;
            const l = Math.hypot(k, 1);
            return {height: h, nx: 0, ny: 1 / l, nz: (-up * k) / l};
        };
    }
    if (scenario === "steps") {
        const step = 0.2 * hip;
        const period = Math.max(3 * hip, 0.05);
        return (x, z) => {
            const u = z / period;
            const k = u - Math.floor(u);
            const rise = k < 0.5 ? 0 : k < 0.6 ? (1 - Math.cos(((k - 0.5) / 0.1) * Math.PI)) / 2 : 1;
            const h = (Math.floor(u) + rise) * step;
            const slope = k >= 0.5 && k < 0.6 ? (step * Math.PI * Math.sin(((k - 0.5) / 0.1) * Math.PI)) / (2 * 0.1 * period) : 0;
            const l = Math.hypot(slope, 1);
            return {height: h, nx: 0, ny: 1 / l, nz: -slope / l};
        };
    }
    return () => ({height: 0, nx: 0, ny: 1, nz: 0});
}

/**
 * Where the animal is at time t (s) in a scenario: a second standing, then the run. Speeds by Froude number on its
 * hip height: walk 0.2, trot 0.9, run 3.5 (a gallop or bound where it has one).
 */
export function scenarioPath(scenario: Scenario, hip: number, length: number, t: number, top = Infinity): PathPoint {
    // (Never faster than the animal's own top speed: a tortoise doesn't gallop.)
    const walk = Math.min(speedAtFroude(0.2, hip), top * 0.3);
    const trot = Math.min(speedAtFroude(0.9, hip), top * 0.6);
    const run = Math.min(speedAtFroude(3.5, hip), top);
    const u = Math.max(t - 1, 0);
    const straight = (v: number): PathPoint => ({x: 0, z: v * u, yaw: 0, speed: t > 1 ? v : 0});
    switch (scenario) {
        case "walk":
        case "slope":
        case "steps":
            return straight(walk);
        case "trot":
            return straight(trot);
        case "run":
            return straight(run);
        case "accel": {
            // 0 to a run over 4 s, held 2 s, back to 0 over 3 s: through every gait and back.
            const up = 4, hold = 2, down = 3;
            const v = u < up ? (run * u) / up : u < up + hold ? run : Math.max(run * (1 - (u - up - hold) / down), 0);
            const w = Math.min(Math.max(u - up - hold, 0), down);
            const z = u < up ? (run * u * u) / (2 * up) : u < up + hold ? (run * up) / 2 + run * (u - up) : (run * up) / 2 + run * hold + run * (w - (w * w) / (2 * down));
            return {x: 0, z, yaw: 0, speed: v};
        }
        case "turn": {
            const r = 3 * Math.max(length, 0.02);
            const a = (walk * u) / r;
            return {x: r - r * Math.cos(a), z: r * Math.sin(a), yaw: a, speed: t > 1 ? walk : 0};
        }
        case "spin": {
            // Standing, turning half round over 3 s (from 1 s), then still.
            const k = Math.min(u / 3, 1);
            const e = k * k * (3 - 2 * k);
            return {x: 0, z: 0, yaw: Math.PI * e, speed: 0};
        }
    }
}

export type Poser = (rig: LocoRig, input: LocoInput, world: Matrix4[], moved: number) => {down: boolean[] | null; gait: GaitState | null};

/** The layer's legged driver as a poser (the "after"). */
export function leggedPoser(): Poser {
    let state: LeggedState | null = null;
    return (rig, input, world) => {
        state ??= leggedDriver.init(rig) as LeggedState;
        rig.bones.forEach((b, i) => world[i].copy(b.restWorld));
        const gait = leggedDriver.pose(rig, input, world, state);
        // Down: as the driver has it planted (its locked feet), the truth of what should not slide.
        return {down: gait ? gait.feet.map((f) => f.planted) : null, gait};
    };
}

export type SimResult = {metrics: LocoMetrics; frames: FrameFeet[]; gaits: string[]};

/**
 * Run a scenario for `seconds` at 60 fps. `scale`: metres per mesh unit (the animal's drawn size). The instance
 * stands on the ground at its middle, its mesh floor there (as the scene draws it).
 */
export function simulate(rig: LocoRig, scenario: Scenario, scale: number, poser: Poser, seconds = 9, seed = 0.37): SimResult {
    // Speeds by Froude number on the gait's own length (the hip height; a sprawling leg's reach), as the driver reads it.
    const hip = rig.gaitLength * scale;
    const length = rig.length * scale;
    const ground = scenarioGround(scenario, hip);
    const world = rig.bones.map((b) => b.restWorld.clone());
    const instance = new Matrix4();
    const q = new Quaternion();
    const frames: FrameFeet[] = [];
    const gaits: string[] = [];
    const dt = 1 / 60;
    let last: PathPoint | null = null;
    for (let f = 0; f <= seconds * 60; f++) {
        const t = f * dt;
        const p = scenarioPath(scenario, hip, length, t, sprintPace({plan: rig.plan, slug: rig.slug, length}));
        const base = ground(p.x, p.z).height;
        q.setFromAxisAngle(new Vector3(0, 1, 0), p.yaw);
        instance.compose(new Vector3(p.x, base - rig.minY * scale, p.z), q, new Vector3(scale, scale, scale));
        const moved = last ? Math.hypot(p.x - last.x, p.z - last.z) : 0;
        last = p;
        const input: LocoInput = {instance, scale, yaw: p.yaw, dt, clock: 1000 + t, seed, ground, grounded: true, clipNow: p.speed > 0 ? "walk" : "idle", clipFrom: null, clipPhase: 0};
        const {down, gait} = poser(rig, input, world, moved);
        if (gait && !gaits.includes(gait.gait)) gaits.push(gait.gait);
        frames.push(measureFrame(rig, world, instance, ground, t, p.speed, down, Math.max(0.02 * hip, 0.0015)));
    }
    return {metrics: summarise(frames, hip), frames, gaits};
}
