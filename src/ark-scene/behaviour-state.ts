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
 */

import {isAwake, type ArkActivity} from "@/lib/ark-daylight";
import type {ArkDoing} from "@/ark-scene/behaviour-schedule";

export type ArkBehaviourKind = "asleep" | "flying" | "awake";

export type ArkBehaviourState = {
    kind: ArkBehaviourKind;
    /** Asleep: still, the head lowered (and a flyer down at its roost). */
    asleep: boolean;
    /** Up in the air, on its circle (a bird of the air, awake). */
    airborne: boolean;
    /** What it is doing (`behaviour-schedule.ts`), for an animal on the behaviour schedule. */
    doing?: ArkDoing;
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
    /**
     * On the behaviour schedule: what its trip says it is doing now and whether its pose is up in the air. Then
     * asleep is the schedule's sleep (the same hour rule, at its slot's start) and airborne its pose.
     */
    scheduled?: {doing: ArkDoing; aloft: boolean} | null;
};

const ASLEEP: ArkBehaviourState = Object.freeze({kind: "asleep", asleep: true, airborne: false});
const FLYING: ArkBehaviourState = Object.freeze({kind: "flying", asleep: false, airborne: true});
const AWAKE: ArkBehaviourState = Object.freeze({kind: "awake", asleep: false, airborne: false});

/** The state (one shared object per kind, so it can be worked out every frame for free). */
const SCHEDULED = new Map<string, ArkBehaviourState>();

export function behaviourState(input: ArkBehaviourInput): ArkBehaviourState {
    const plan = input.scheduled;
    if (plan && !input.acting && !input.visitor) {
        const kind: ArkBehaviourKind = plan.doing === "sleep" ? "asleep" : plan.aloft && !input.reducedMotion ? "flying" : "awake";
        const key = `${kind}:${plan.doing}`;
        let state = SCHEDULED.get(key);
        if (!state) SCHEDULED.set(key, (state = Object.freeze({kind, asleep: kind === "asleep", airborne: kind === "flying", doing: plan.doing})));
        return state;
    }
    const awake = Boolean(input.acting || input.visitor) || isAwake(input.activity ?? null, input.elevation);
    if (!awake) return ASLEEP;
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
