/**
 * A diver's breath on its behaviour schedule (visual only; the coordinator,
 * 2026-11-11: "a gentle rise to the surface on the way, a breath, and a
 * glide back down, mostly forward, without circling in place").
 *
 * An air-breather in the water (a turtle, a seal, a penguin, a whale) on the
 * schedule takes its breath on its breathe trip (`behaviour-schedule.ts`,
 * every third slot awake): it rises over 5 s while it swims there, breathes
 * at the surface for 3 s and glides back down over 7 s, in the last 15 s of
 * its swim, so the glide down ends as it arrives (a trip shorter than that
 * starts its breath just after it sets off, and finishes the glide holding
 * still at its spot, never turning there). Awake, that is its only breath:
 * the clock's breath cycle (`sea-depth.ts` breathAt) would take it up
 * wherever it is, often holding still or turning at its spot. Asleep it
 * keeps the cycle (twice as slow, straight up and down where it sleeps).
 *
 * Pure in the trip and the world clock, so every viewer sees the same breath.
 * The scene's band fit draws it (`fitInWater`'s breath) and the behaviour
 * state says "breathing" from the same number (`behaviour-state.ts`).
 */

import type {Trip} from "@/ark-scene/behaviour-schedule";

/** Seconds: up from its band to the surface, at the surface, and back down (smoothed at both ends). */
export const TRIP_BREATH_RISE = 5;
export const TRIP_BREATH_HOLD = 3;
export const TRIP_BREATH_GLIDE = 7;
export const TRIP_BREATH_SECONDS = TRIP_BREATH_RISE + TRIP_BREATH_HOLD + TRIP_BREATH_GLIDE;
/** Seconds after it starts to swim before a short trip's breath begins (it has turned onto its way by then). */
const SET_OFF = 1.5;

/** When its breath on this trip begins (world seconds), or null: not a breathe trip, or one with no water to swim. */
export function tripBreathStart(trip: Trip): number | null {
    if (trip.doing !== "breathe") return null;
    // Its time swimming: from its first water leg to the end of its last.
    let t = trip.start;
    let first: number | null = null;
    let last = 0;
    for (const leg of trip.legs) {
        if (leg.mode === "water") {
            if (first === null) first = t;
            last = t + leg.seconds;
        }
        t += leg.seconds;
    }
    // (No swim there, it is at its spot already: it comes up where it is, as it arrives.)
    if (first === null) return trip.to.y < 0.02 ? trip.arrive : null;
    return Math.max(Math.min(first + SET_OFF, last), last - TRIP_BREATH_SECONDS);
}

const smooth = (u: number) => u * u * (3 - 2 * u);

/** How far up into its breath it is now (0 down in its band, 1 at the surface), on its trip at `epochSeconds`. */
export function tripBreath(trip: Trip, epochSeconds: number): number {
    // A school's or pod's member swimming at its leader's side breathes with its leader.
    if (trip.shadow) {
        const lead = trip.shadow.trips.find((t) => epochSeconds >= t.start && epochSeconds < t.end);
        return lead ? tripBreath(lead, epochSeconds) : 0;
    }
    const start = tripBreathStart(trip);
    if (start === null) return 0;
    const u = epochSeconds - start;
    if (u <= 0 || u >= TRIP_BREATH_SECONDS) return 0;
    if (u < TRIP_BREATH_RISE) return smooth(u / TRIP_BREATH_RISE);
    if (u < TRIP_BREATH_RISE + TRIP_BREATH_HOLD) return 1;
    return smooth(1 - (u - TRIP_BREATH_RISE - TRIP_BREATH_HOLD) / TRIP_BREATH_GLIDE);
}
