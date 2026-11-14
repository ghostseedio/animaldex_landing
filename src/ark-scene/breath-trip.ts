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
 * Lane B6 water (2026-11-14): a whale, a dolphin, a seal, a sea turtle and a
 * manatee breathe on their own rhythm instead (`water-life.ts` breathRhythm),
 * wherever their trip has them in the water: a dolphin rolls up every half
 * minute as it swims, a great whale blows a few times and dives for minutes,
 * a seal at sea dives for minutes and bottles a while. One breath in every
 * third 80 s slot was a penguin's rhythm for all of them (a breath every four
 * minutes: a dolphin's is every half minute). A pod's members come up with
 * their leader, each within a few seconds of it.
 *
 * Pure in the trip and the world clock, so every viewer sees the same breath.
 * The scene's band fit draws it (`fitInWater`'s breath) and the behaviour
 * state says "breathing" from the same number (`behaviour-state.ts`).
 */

import type {Trip} from "@/ark-scene/behaviour-schedule";
import {depthSeed} from "@/ark-scene/sea-depth";
import {breathRhythm, rhythmBreath, waterLife, type BreathRhythm} from "@/ark-scene/water-life";

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

/** Whether its trip has it in the water at a world time: on a swim, or after it, where its goal is in the water; a follower as its leader. */
export function tripInWater(trip: Trip, epochSeconds: number): boolean {
    if (trip.shadow) {
        const lead = trip.shadow.trips.find((t) => epochSeconds >= t.start && epochSeconds < t.end);
        return lead ? tripInWater(lead, epochSeconds) : false;
    }
    if (epochSeconds >= trip.arrive) return Boolean(trip.wet);
    let t = trip.start;
    for (const leg of trip.legs) {
        t += leg.seconds;
        if (epochSeconds < t) return leg.mode === "water" || (leg.mode === "pause" && Boolean(trip.wet) && trip.legs.every((l) => l.mode === "water" || l.mode === "pause"));
    }
    return Boolean(trip.wet);
}

const rhythms = new WeakMap<object, {rhythm: BreathRhythm; seed: number} | null>();

/** Its own breath rhythm (`water-life.ts`: a whale, a dolphin, a seal, a sea turtle, a manatee), with its seed; null for any other diver. */
export function tripRhythm(trip: Trip): {rhythm: BreathRhythm; seed: number} | null {
    const owner = trip.owner;
    if (!owner) return null;
    const known = rhythms.get(owner.animal);
    if (known !== undefined) return known;
    const seed = depthSeed(owner.animal.id);
    const rhythm = breathRhythm(waterLife(owner.slug, owner.profile), owner.animal.length, seed);
    const found = rhythm ? {rhythm, seed} : null;
    rhythms.set(owner.animal, found);
    return found;
}

/** How far up into its breath it is now (0 down in its band, 1 at the surface), on its trip at `epochSeconds`. */
export function tripBreath(trip: Trip, epochSeconds: number): number {
    // (Lane B6: its own rhythm, wherever it is in the water. A pod's member comes up with its leader, up to 3 s after it.)
    const own = tripRhythm(trip);
    if (own) {
        if (!tripInWater(trip, epochSeconds)) return 0;
        // (Not in a recipe's episode at its place, a seal's chase after fish: the episode has its pose, and its own way
        // up and down. On its way there it breathes as ever.)
        if (trip.recipe && epochSeconds >= trip.arrive) return 0;
        const lead = trip.shadow?.trips.find((t) => epochSeconds >= t.start && epochSeconds < t.end);
        const leader = lead ? tripRhythm(lead) : null;
        return leader ? rhythmBreath(leader.rhythm, leader.seed, epochSeconds - own.seed * 3) : rhythmBreath(own.rhythm, own.seed, epochSeconds);
    }
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
