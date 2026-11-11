/**
 * One behaviour state per animal (visual only): what it is doing now.
 *
 * The scene's animation (asleep or awake, in the air or on its spot), where
 * it is drawn, the tap card's state line and what follow mode follows are
 * all read from this one state, so nothing plays an animation that
 * disagrees with what the card says. The state comes from the hour the
 * scene is lit for and the species' stored activity, never from the viewer:
 * selecting or following an animal shows what it is doing, it never changes
 * it (a hawk in the air stays in the air when tapped; the camera goes up to
 * it).
 *
 * Pure, so the same hour gives every viewer the same state, and the test can
 * hold the animation and the card to it (`lib/ark-behaviour-state.test.ts`).
 *
 * An air-breather in the water (a whale, a dolphin, a turtle, a seal) comes
 * up to breathe on its breath cycle (`sea-depth.ts` `breathAt`, from the clock
 * and its id, slower asleep): while it does, its state is "breathing" (asleep,
 * it stays "asleep" with `breathing` set), and its pose rises to the surface.
 */

import {isAwake, type ArkActivity} from "@/lib/ark-daylight";
import {breathAt} from "@/ark-scene/sea-depth";

export type ArkBehaviourKind = "asleep" | "flying" | "awake" | "breathing";

export type ArkBehaviourState = {
    kind: ArkBehaviourKind;
    /** Asleep: still, the head lowered (and a flyer down at its roost). */
    asleep: boolean;
    /** Up in the air, on its circle (a bird of the air, awake). */
    airborne: boolean;
    /** Up at the surface for air (an air-breather in the water), awake or asleep. */
    breathing: boolean;
};

export type ArkBehaviourInput = {
    /** The species' stored activity (none known: awake by day). */
    activity: ArkActivity | null | undefined;
    /** The sun's elevation the scene is lit for (degrees). */
    elevation: number;
    /** A bird of the air over land (`flyers.ts`): it flies while awake. */
    flyer: boolean;
    /** Acting out a server event (a replay's act): wide awake, on the act's own path. */
    acting?: boolean;
    /** The chat's visiting animal: always awake, at the jetty. */
    visitor?: boolean;
    /** Reduced motion: nothing flies; an awake flyer waits on its spot. */
    reducedMotion?: boolean;
    /** An air-breather in the water: its seed (`sea-depth.ts` `depthSeed`) and the shared clock (seconds), for its breath cycle. */
    breather?: {seed: number; clock: number} | null;
    /** Held off the water by the depth classifier (a frigatebird over the open sea): in the air asleep too, reduced motion or not. */
    aloftAlways?: boolean;
};

const ASLEEP: ArkBehaviourState = Object.freeze({kind: "asleep", asleep: true, airborne: false, breathing: false});
const ASLEEP_ALOFT: ArkBehaviourState = Object.freeze({kind: "asleep", asleep: true, airborne: true, breathing: false});
const ASLEEP_BREATHING: ArkBehaviourState = Object.freeze({kind: "asleep", asleep: true, airborne: false, breathing: true});
const FLYING: ArkBehaviourState = Object.freeze({kind: "flying", asleep: false, airborne: true, breathing: false});
const AWAKE: ArkBehaviourState = Object.freeze({kind: "awake", asleep: false, airborne: false, breathing: false});
const BREATHING: ArkBehaviourState = Object.freeze({kind: "breathing", asleep: false, airborne: false, breathing: true});

/** The state (one shared object per kind, so it can be worked out every frame for free). */
export function behaviourState(input: ArkBehaviourInput): ArkBehaviourState {
    const awake = Boolean(input.acting || input.visitor) || isAwake(input.activity ?? null, input.elevation);
    // Up for air on its breath cycle (not in an act, nor the visitor, nor with motion reduced).
    const breather = input.breather && !input.acting && !input.visitor && !input.reducedMotion ? input.breather : null;
    const breathing = breather ? breathAt(breather.seed, breather.clock, !awake) > 0 : false;
    if (input.aloftAlways && !input.acting && !input.visitor) return awake ? FLYING : ASLEEP_ALOFT;
    if (!awake) return breathing ? ASLEEP_BREATHING : ASLEEP;
    if (breathing) return BREATHING;
    return input.flyer && !input.acting && !input.visitor && !input.reducedMotion ? FLYING : AWAKE;
}

/** What the animation eases to for a state: `rest` 1 asleep, `air` 1 aloft. Nothing else (no selection, no follow) goes in. */
export function animationTargets(state: ArkBehaviourState): {rest: 0 | 1; air: 0 | 1} {
    return {rest: state.asleep ? 1 : 0, air: state.airborne ? 1 : 0};
}

/** What the tap card says of a state: "Asleep now" or nothing. */
export function cardSaysAsleep(state: ArkBehaviourState | null | undefined): boolean {
    return Boolean(state?.asleep);
}

export function sameBehaviour(a: ArkBehaviourState | null | undefined, b: ArkBehaviourState | null | undefined): boolean {
    return a?.kind === b?.kind;
}
