/**
 * The companion loop with the owner (AnimalDex 20261028120000; owner,
 * 2026-10-28: "capture animal - talk to it - work through personal problems
 * together"): what the animal is helping them with in their life (its focus),
 * the step it set on it, and what it did in one reply — a step of theirs it
 * saw them complete, or another of their animals it sent them to.
 *
 * The animal picks all of it in conversation; the site only shows it. Port of
 * iOS `AnimalCompanionLoop`, `AnimalCompanionEvent` and
 * `AnimalChatCompanionUpdate`. Pure, so the drawer, the thread store and the
 * tests share one decoder; a malformed field is dropped, never the answer.
 *
 * 3.2 (docs/your-step/SPEC.md, section 4): the loop carries the open step as
 * the server holds it (`companion.open_step`), so the chat's step card is
 * keyed off server state, never off reply text; `trial_set` carries the new
 * step's id and `trial_done` the XP it paid.
 *
 * 3.2 Debates (SPEC section 6): when the animal offered a debate in its own
 * words and the offer was allowed, `debate_offer` carries the problem it heard
 * and the owner's animals it named; the chat's quick replies and setup band
 * come from it, never from the hidden marker in the reply.
 */

import {decodeAnimalStep, stepFrequency, stepUuid, type AnimalStep, type StepFrequency} from "@/lib/your-step";
import {decodeDebateOffer, type DebateOffer} from "@/lib/debates";

export type AskCompanionLoop = {
    focus: string | null;
    /** The open step's words, for the places that only show it. */
    openTrial: string | null;
    /** The open step itself: its id, whether it is accepted, the Trial it came from. Null without an id. */
    openStep: AnimalStep | null;
    yourTrialsDone: number;
};

export type AskCompanionStepDone = {
    /** The step's id (`trial_done.id`), when the server sent it: its card in the thread then says it is done. */
    id?: string;
    step: string;
    powerEarned: boolean;
    /** The progression XP the step paid (`your_step:<id>`, +5, at most one a day per animal); 0 when none. */
    xp: number;
};

/** The step the animal set in this reply: the card goes under it. */
export type AskCompanionStepSet = {
    id: string | null;
    step: string;
    /** A Trial picked from this reply's Trials (its loop shows with the step); absent for a step the animal set. */
    trialFrequency?: StepFrequency;
};

export type AskCompanionReferral = {
    id: string | null;
    speciesProfileId: string;
    captureId: string | null;
    animal: string;
    nickname: string | null;
};

/** What the animal did in one reply, kept with that reply. */
export type AskCompanionEvent = {
    stepDone?: AskCompanionStepDone;
    stepSet?: AskCompanionStepSet;
    referral?: AskCompanionReferral;
    /** The animal offered a debate in this reply, and it was allowed: [Yes, compare] [Not now] under it. */
    debateOffer?: DebateOffer;
};

/** `done.companion`: the loop now, and what changed in this reply. */
export type AskCompanionUpdate = {
    loop: AskCompanionLoop;
    event: AskCompanionEvent;
};

export const EMPTY_COMPANION_LOOP: AskCompanionLoop = {focus: null, openTrial: null, openStep: null, yourTrialsDone: 0};

/** Word for word with iOS. The step's own words are the companion words' `journey`. */
export const COMPANION_COPY = {
    workingOn: "Working on: {focus}",
    notThisAnyMore: "Not this any more",
    talkTo: "Talk to {name}",
    talkToHint: "It already knows what you talked about."
} as const;

function object(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

const uuid = stepUuid;

function count(value: unknown): number {
    const parsed = typeof value === "number" ? value : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function stepDoneFrom(raw: unknown): AskCompanionStepDone | null {
    const row = object(raw);
    const step = text(row?.step);
    if (!row || !step) return null;
    // `power_waits_for_training` is always false since 3.2 (kept for old apps).
    const id = uuid(row.id);
    return {...(id ? {id} : {}), step, powerEarned: row.power_earned === true, xp: count(row.xp ?? row.xp_awarded)};
}

function stepSetFrom(raw: unknown): AskCompanionStepSet | null {
    const row = object(raw);
    const step = text(row?.step);
    return row && step ? {id: uuid(row.id), step} : null;
}

function referralFrom(raw: unknown): AskCompanionReferral | null {
    const row = object(raw);
    const speciesProfileId = uuid(row?.species_profile_id);
    const animal = text(row?.animal);
    if (!row || !speciesProfileId || !animal) return null;
    return {
        id: uuid(row.id),
        speciesProfileId,
        captureId: uuid(row.capture_id),
        animal,
        nickname: text(row.nickname)
    };
}

/** Decodes `done.companion`. Null when it is absent or not an object. */
export function parseCompanionUpdate(raw: unknown): AskCompanionUpdate | null {
    const row = object(raw);
    if (!row) return null;
    const stepDone = stepDoneFrom(row.trial_done);
    const stepSet = stepSetFrom(row.trial_set);
    const referral = referralFrom(row.referral);
    const debateOffer = decodeDebateOffer(row.debate_offer);
    const openStep = decodeAnimalStep(row.open_step);
    return {
        loop: {
            focus: text(row.focus),
            openTrial: openStep?.step ?? text(row.open_trial),
            openStep,
            yourTrialsDone: count(row.your_trials_done)
        },
        event: {
            ...(stepDone ? {stepDone} : {}),
            ...(stepSet ? {stepSet} : {}),
            ...(referral ? {referral} : {}),
            ...(debateOffer ? {debateOffer} : {})
        }
    };
}

/**
 * `animal_companion_focus_v1`: the loop as it stands, before any turn. Its
 * focus and step are objects there (`{id, focus, since}`, and the step
 * object `{id, step, set_at, accepted_at, trial_frequency, has_report}`).
 */
export function parseCompanionFocus(raw: unknown): AskCompanionLoop | null {
    const row = object(raw);
    if (!row) return null;
    const openStep = decodeAnimalStep(row.open_trial);
    return {
        focus: text(object(row.focus)?.focus),
        openTrial: openStep?.step ?? text(object(row.open_trial)?.step),
        openStep,
        yourTrialsDone: count(row.your_trials_done)
    };
}

/** The loop as the companion route answered it (already decoded once), read back tolerantly. */
export function normalizeCompanionLoop(raw: unknown): AskCompanionLoop | null {
    const row = object(raw);
    if (!row) return null;
    const step = object(row.openStep);
    const openStep = step
        ? decodeAnimalStep({
            id: step.id,
            step: step.step,
            set_at: step.setAt,
            accepted_at: step.acceptedAt,
            trial_frequency: step.trialFrequency,
            has_report: step.hasReport
        })
        : null;
    return {
        focus: text(row.focus),
        openTrial: openStep?.step ?? text(row.openTrial),
        openStep,
        yourTrialsDone: count(row.yourTrialsDone)
    };
}

export function isEmptyCompanionEvent(event: AskCompanionEvent | null | undefined): boolean {
    return !event || (!event.stepDone && !event.stepSet && !event.referral && !event.debateOffer);
}

/** The stored form, read back tolerantly: a thread saved by an older build has none. */
export function normalizeCompanionEvent(raw: unknown): AskCompanionEvent | null {
    const row = object(raw);
    if (!row) return null;
    const stepDoneRow = object(row.stepDone);
    const stepDoneId = uuid(stepDoneRow?.id);
    const stepDone = stepDoneRow && text(stepDoneRow.step)
        ? {...(stepDoneId ? {id: stepDoneId} : {}), step: text(stepDoneRow.step) as string, powerEarned: stepDoneRow.powerEarned === true, xp: count(stepDoneRow.xp)}
        : null;
    const stepSetRow = object(row.stepSet);
    const stepSetFrequency = stepFrequency(stepSetRow?.trialFrequency);
    const stepSet = stepSetRow && text(stepSetRow.step)
        ? {id: uuid(stepSetRow.id), step: text(stepSetRow.step) as string, ...(stepSetFrequency ? {trialFrequency: stepSetFrequency} : {})}
        : null;
    const referralRow = object(row.referral);
    const referralSpecies = uuid(referralRow?.speciesProfileId);
    const referralAnimal = text(referralRow?.animal);
    const referral = referralRow && referralSpecies && referralAnimal
        ? {
            id: uuid(referralRow.id),
            speciesProfileId: referralSpecies,
            captureId: uuid(referralRow.captureId),
            animal: referralAnimal,
            nickname: text(referralRow.nickname)
        }
        : null;
    const debateOffer = decodeDebateOffer(row.debateOffer);
    const event: AskCompanionEvent = {
        ...(stepDone ? {stepDone} : {}),
        ...(stepSet ? {stepSet} : {}),
        ...(referral ? {referral} : {}),
        ...(debateOffer ? {debateOffer} : {})
    };
    return isEmptyCompanionEvent(event) ? null : event;
}

/**
 * "Leo the African Lion", or the animal alone when it has no name of its own
 * (iOS `AnimalCompanionNaming`). `template` is that in the reader's language
 * ("{nickname} sang {animal}").
 */
export function companionDisplayName(
    nickname: string | null | undefined,
    animal: string,
    template = "{nickname} the {animal}"
): string {
    const trimmed = nickname?.trim() ?? "";
    if (!trimmed || trimmed.toLowerCase() === animal.trim().toLowerCase()) return animal;
    return template.replace("{nickname}", trimmed).replace("{animal}", animal);
}

/** Where "Talk to …" goes: that capture's card, which opens its chat on the referral. */
export function referralCapturePath(referral: AskCompanionReferral): string | null {
    if (!referral.captureId) return null;
    const query = referral.id ? `?referral=${encodeURIComponent(referral.id)}` : "";
    return `/app/capture/${referral.captureId}${query}`;
}

/** A `?referral=` value worth sending: a uuid, or nothing. */
export function resolveReferralId(raw: unknown): string | null {
    return uuid(raw);
}
