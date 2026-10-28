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
 */

export type AskCompanionLoop = {
    focus: string | null;
    openTrial: string | null;
    yourTrialsDone: number;
};

export type AskCompanionStepDone = {
    step: string;
    powerEarned: boolean;
    powerWaitsForTraining: boolean;
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
    referral?: AskCompanionReferral;
};

/** `done.companion`: the loop now, and what changed in this reply. */
export type AskCompanionUpdate = {
    loop: AskCompanionLoop;
    event: AskCompanionEvent;
};

export const EMPTY_COMPANION_LOOP: AskCompanionLoop = {focus: null, openTrial: null, yourTrialsDone: 0};

/** Word for word with iOS. */
export const COMPANION_COPY = {
    workingOn: "Working on: {focus}",
    notThisAnyMore: "Not this any more",
    doneTogether: "Done together",
    powerEarned: "Power earned: {power}",
    powerWaitsForTraining: "Pass its lesson check to earn its Power.",
    talkTo: "Talk to {name}",
    talkToHint: "It already knows what you talked about."
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function object(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function uuid(value: unknown): string | null {
    const candidate = text(value);
    return candidate && UUID_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

function count(value: unknown): number {
    const parsed = typeof value === "number" ? value : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function stepDoneFrom(raw: unknown): AskCompanionStepDone | null {
    const row = object(raw);
    const step = text(row?.step);
    if (!row || !step) return null;
    return {
        step,
        powerEarned: row.power_earned === true,
        powerWaitsForTraining: row.power_waits_for_training === true
    };
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
    const referral = referralFrom(row.referral);
    return {
        loop: {
            focus: text(row.focus),
            openTrial: text(row.open_trial),
            yourTrialsDone: count(row.your_trials_done)
        },
        event: {
            ...(stepDone ? {stepDone} : {}),
            ...(referral ? {referral} : {})
        }
    };
}

/**
 * `animal_companion_focus_v1`: the loop as it stands, before any turn. Its
 * focus and step are objects there (`{id, focus, since}`, `{id, step, set_at}`).
 */
export function parseCompanionFocus(raw: unknown): AskCompanionLoop | null {
    const row = object(raw);
    if (!row) return null;
    return {
        focus: text(object(row.focus)?.focus),
        openTrial: text(object(row.open_trial)?.step),
        yourTrialsDone: count(row.your_trials_done)
    };
}

export function isEmptyCompanionEvent(event: AskCompanionEvent | null | undefined): boolean {
    return !event || (!event.stepDone && !event.referral);
}

/** The stored form, read back tolerantly: a thread saved by an older build has none. */
export function normalizeCompanionEvent(raw: unknown): AskCompanionEvent | null {
    const row = object(raw);
    if (!row) return null;
    const stepDoneRow = object(row.stepDone);
    const stepDone = stepDoneRow && text(stepDoneRow.step)
        ? {
            step: text(stepDoneRow.step) as string,
            powerEarned: stepDoneRow.powerEarned === true,
            powerWaitsForTraining: stepDoneRow.powerWaitsForTraining === true
        }
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
    const event: AskCompanionEvent = {...(stepDone ? {stepDone} : {}), ...(referral ? {referral} : {})};
    return isEmptyCompanionEvent(event) ? null : event;
}

/** "Leo the African Lion", or the animal alone when it has no name of its own (iOS `AnimalCompanionNaming`). */
export function companionDisplayName(nickname: string | null | undefined, animal: string): string {
    const trimmed = nickname?.trim() ?? "";
    if (!trimmed || trimmed.toLowerCase() === animal.trim().toLowerCase()) return animal;
    return `${trimmed} the ${animal}`;
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
