/**
 * Where the behaviour schedule and the sea-depth bands meet (release
 * integration, 2026-11-11). The audit found the schedule's pose winning over
 * sea-depth's for every scheduled water animal: it was drawn at the
 * schedule's own height, not in its species' band.
 *
 * The rule: the schedule says where a water animal goes (x, z, which way it
 * faces, what it is doing); the band says how deep (`sea-depth.ts`: its own
 * place in its species' band, up to the surface on its breath, fitted at its
 * drawn size). That holds whenever the schedule has it in the water: over
 * water, not in the air, at or under the surface. On land (a duck on the
 * bank, a seal on the shore) and in the air it is the schedule's.
 *
 * A species the depth classifier holds off the water (the frigatebird, which
 * sleeps on the wing; a butterfly misfiled at sea) is not put on the
 * schedule at all: the schedule would land it on the sea to rest.
 *
 * Pure and deterministic, so the scene and the tests read the same rule.
 * Visual only.
 */

import {fitInWater, heldOffWater, waterSpec, type SpeciesDepth, type WaterSpec} from "@/ark-scene/sea-depth";

/** The schedule's pose as this rule reads it: its foot height, and whether it is in the air. */
export type ScheduledFoot = {y: number; aloft: boolean};

/** Whether a scheduled animal is drawn in its depth band now: a water species the schedule has in the water (`ground` < 0 is water). */
export function inDepthBand(depth: SpeciesDepth | null | undefined, at: ScheduledFoot, ground: number): depth is SpeciesDepth {
    return Boolean(depth) && !at.aloft && ground < 0 && at.y < 0.02;
}

/** Its body in the band over the floor at `ground`: the band's spec and the base (its lowest point's height) at its drawn height. */
export function scheduledWater(depth: SpeciesDepth, ground: number, seed: number, clock: number, breath: number, modelHeight: number): {spec: WaterSpec; base: number} {
    const spec = waterSpec(depth, ground, seed, clock, breath);
    return {spec, base: fitInWater(spec, modelHeight).base};
}

/** Whether a species goes on the behaviour schedule at all (one held off the water stays in the air instead). */
export function onBehaviourSchedule(slug: string): boolean {
    return !heldOffWater(slug);
}
