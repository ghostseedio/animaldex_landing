/**
 * Animal Trials, ported from the iOS source of truth (`AnimalDex/Models/AnimalTrial.swift`).
 *
 * What an animal's survival strategy teaches you to DO, once.
 *
 * Frequency is the CHARACTER of the task, never its length: LOW is patient,
 * MID is ordinary productive effort, HIGH is a burst that activates at a moment
 * the server picks. Every Trial is one action, and missing one costs nothing.
 */

export type AnimalTrialFrequency = "LOW" | "MID" | "HIGH";

export type AnimalTrialStatus =
    | "notStarted"
    | "pending_activation"
    | "active"
    | "proof_submitted"
    | "completed"
    | "expired"
    | "abandoned";

export type AnimalTrial = {
    speciesProfileId: string;
    frequency: AnimalTrialFrequency;
    speciesDisplayName: string;

    title: string;
    objective: string;
    instructions: string;
    animalRule: string;
    /** What the person gets out of it. The card leads with this, not the animal. */
    userBenefit: string;
    /**
     * The bridge from the Principle to this task, in the second person. The
     * detail sheet leads its "why" section with this, not with the biology.
     */
    principleLink: string;
    whyThisAnimal: string;
    principleName: string;

    proofTypes: string[];
    primaryProofType: string;
    proofPrompt: string;
    proofForbiddenContent: string[];
    successCriteria: string[];

    estimatedMinutes: number;
    /** HIGH only. LOW and MID are untimed, so this is null for them. */
    completionWindowMinutes: number | null;
    activationModel: string;
    activationWindowHours: number | null;
    difficulty: number;
    safetyTags: string[];
    rewardClass: string;
    rewardCredits: number;

    status: AnimalTrialStatus;
    activationDueAt: string | null;
    activatedAt: string | null;
    completionDeadlineAt: string | null;
    proofAttemptCount: number;
    verificationStatus: string | null;
    verificationReason: string | null;
    rewardXPAwarded: number;
    rewardCreditsAwarded: number;
    completedAt: string | null;
    /** A finished Trial is a Discover post; the row says so. */
    sharePublicly: boolean;
    /** How many people have publicly completed this Trial, excluding the viewer. */
    otherCompletionCount: number;
    /**
     * The Qualities the animal's Power carries (`best_use_cases` on the view).
     * Earning the Power puts them on the person's profile; the history row
     * shows what a finished Trial contributed.
     */
    bestUseCases: string[];
};

/**
 * Mirrors MAX_APEX_PROOF_ATTEMPTS in `_shared/apex-proof-attempts.ts`, which
 * `verify-animal-trial-proof` enforces. The client shows it so the budget is
 * visible BEFORE it is spent, instead of appearing as a refusal.
 */
export const MAX_PROOF_ATTEMPTS = 2;

export function trialId(trial: AnimalTrial) {
    return `${trial.speciesProfileId}:${trial.frequency}`;
}

// MARK: - Frequency vocabulary

export function frequencyBadge(frequency: AnimalTrialFrequency) {
    switch (frequency) {
        case "LOW": return "🔴 LOW TRIAL";
        case "MID": return "🟡 MID TRIAL";
        case "HIGH": return "⚡ HIGH TRIAL";
    }
}

/** LOW is calm, MID is active, HIGH is volatile. */
export function frequencyAccent(frequency: AnimalTrialFrequency) {
    switch (frequency) {
        case "LOW": return "#E84D57";
        case "MID": return "#FAC233";
        case "HIGH": return "#5CDBFF";
    }
}

export function frequencyCharacter(frequency: AnimalTrialFrequency) {
    switch (frequency) {
        case "LOW": return "Patient. Take your time.";
        case "MID": return "Ordinary effort. Get it done.";
        case "HIGH": return "A burst. Starts when we say.";
    }
}

/** LOW, then MID, then HIGH: calm to volatile. */
const FREQUENCY_ORDER: Record<AnimalTrialFrequency, number> = {LOW: 0, MID: 1, HIGH: 2};

export function sortTrials(trials: AnimalTrial[]) {
    return [...trials].sort((a, b) => (FREQUENCY_ORDER[a.frequency] ?? 9) - (FREQUENCY_ORDER[b.frequency] ?? 9));
}

// MARK: - Derived state

export function requiresVideo(trial: AnimalTrial) {
    return trial.primaryProofType === "video";
}

/**
 * 29 Trials are answered in words, not pictures — "Explain One Process in Ten
 * Words" submits the ten words, and the word count IS the check. They were
 * unsubmittable until this existed: the sheet only offered a camera, so the
 * server refused every attempt with `proof_type_not_allowed`.
 */
export function requiresText(trial: AnimalTrial) {
    return trial.primaryProofType === "text";
}

/**
 * Written answers have their own floor. Below this there is nothing for the
 * checker to look at, and saying so before the attempt is spent is kinder than
 * spending it. Mirrors MIN/MAX_PROOF_TEXT_CHARS in `verify-animal-trial-proof`.
 */
export const MIN_TEXT_PROOF_CHARACTERS = 25;
export const MAX_TEXT_PROOF_CHARACTERS = 1500;

/** Only HIGH runs against a clock. */
export function isTimed(trial: AnimalTrial) {
    return trial.completionWindowMinutes != null;
}

export function isRandomlyActivated(trial: AnimalTrial) {
    return trial.activationModel === "random_window";
}

export function isComplete(trial: AnimalTrial) {
    return trial.status === "completed";
}

/** The Power name, once it is actually a name. */
export function earnedPowerName(trial: AnimalTrial) {
    const trimmed = trial.principleName.trim();
    return trimmed || null;
}

/** Best-for qualities, in assignment order, with blanks and repeats removed. */
export function earnedQualities(trial: AnimalTrial) {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const raw of trial.bestUseCases) {
        const trimmed = raw.trim();
        if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
        seen.add(trimmed.toLowerCase());
        labels.push(trimmed);
    }
    return labels;
}

/**
 * Still possible to finish. A rejection with a check left is in progress.
 * Expired, abandoned, and out-of-checks rows are history, not an open list.
 */
export function isInProgress(trial: AnimalTrial) {
    switch (trial.status) {
        case "pending_activation":
            return true;
        case "active":
        case "proof_submitted":
            return hasProofAttemptsLeft(trial);
        default:
            return false;
    }
}

/**
 * Started, and the evidence never succeeded. Not-started catalog rows are not
 * failures — the person never took them.
 */
export function isFailed(trial: AnimalTrial) {
    if (isComplete(trial) || trial.status === "notStarted" || isInProgress(trial)) return false;
    switch (trial.status) {
        case "expired":
        case "abandoned":
            return true;
        case "active":
        case "proof_submitted":
            return !hasProofAttemptsLeft(trial);
        default:
            return false;
    }
}

export function failureSummary(trial: AnimalTrial) {
    switch (trial.status) {
        case "expired": return "Window closed";
        case "abandoned": return "Left unfinished";
        case "active":
        case "proof_submitted": return "Evidence not accepted";
        default: return "Not completed";
    }
}

/**
 * The row the sheet shows the moment the verifier approves, before the
 * re-read lands. An older cached row must never put the button back.
 */
export function notingApproval(trial: AnimalTrial, input: {reason: string | null; rewardXP: number}): AnimalTrial {
    return {
        ...trial,
        status: "completed",
        verificationStatus: "approved",
        verificationReason: input.reason ?? trial.verificationReason,
        rewardXPAwarded: input.rewardXP > 0 ? input.rewardXP : trial.rewardXPAwarded,
        rewardCreditsAwarded: trial.rewardCreditsAwarded > 0 ? trial.rewardCreditsAwarded : trial.rewardCredits,
        completedAt: trial.completedAt ?? new Date().toISOString()
    };
}

/**
 * A library pick is only honest evidence when the Trial is ABOUT something
 * already on the device. Everything else is a thing you just did, and must be
 * captured live.
 */
export function allowsLibraryEvidence(trial: AnimalTrial) {
    return acceptsScreenshot(trial);
}

export function acceptsScreenshot(trial: AnimalTrial) {
    return trial.proofTypes.includes("screenshot");
}

export function acceptsPhoto(trial: AnimalTrial) {
    return trial.proofTypes.includes("photo");
}

/**
 * What a still must be submitted as. A screenshot Trial's `proof_types` is
 * `["screenshot"]` only. Sending that image as `"photo"` is refused with
 * `proof_type_not_allowed` before the picture is ever looked at.
 */
export function stillProofType(trial: AnimalTrial) {
    return acceptsScreenshot(trial) && !acceptsPhoto(trial) ? "screenshot" : "photo";
}

export function remainingProofAttempts(trial: AnimalTrial) {
    return Math.max(0, MAX_PROOF_ATTEMPTS - trial.proofAttemptCount);
}

export function hasProofAttemptsLeft(trial: AnimalTrial) {
    return remainingProofAttempts(trial) > 0;
}

/**
 * The verifier looked and said no. Distinct from an error: the evidence arrived
 * and was judged.
 */
export function wasRejected(trial: AnimalTrial) {
    return trial.verificationStatus === "rejected" || trial.verificationStatus === "needs_more_context";
}

/** XP shown before completion. Mirrors REWARD_XP in the verify function. */
export function rewardXP(trial: AnimalTrial) {
    if (trial.rewardXPAwarded > 0) return trial.rewardXPAwarded;
    return trial.rewardClass === "xp_small" ? 5 : 10;
}

/** Credits shown before completion, paid alongside XP on approval. */
export function rewardCreditsDisplay(trial: AnimalTrial) {
    return trial.rewardCreditsAwarded > 0 ? trial.rewardCreditsAwarded : trial.rewardCredits;
}

/**
 * "3 others have done this" — suppressed below one so the card never advertises
 * that nobody has bothered.
 */
export function socialProofText(trial: AnimalTrial) {
    if (trial.otherCompletionCount <= 0) return null;
    return trial.otherCompletionCount === 1
        ? "1 other person has completed this"
        : `${trial.otherCompletionCount} others have completed this`;
}

export function remainingSeconds(trial: AnimalTrial, now: number = Date.now()) {
    // `isTimed` comes from the Trial DEFINITION, which is authoritative. A row
    // started before LOW/MID became untimed still carries the deadline it was
    // given, and must not be shown a countdown for it.
    if (!isTimed(trial)) return null;
    if (trial.status !== "active" && trial.status !== "proof_submitted") return null;
    if (!trial.completionDeadlineAt) return null;
    const deadline = Date.parse(trial.completionDeadlineAt);
    if (!Number.isFinite(deadline)) return null;
    return Math.max(0, (deadline - now) / 1000);
}

/** What the primary button says at this point in the lifecycle. */
export function primaryActionTitle(trial: AnimalTrial) {
    switch (trial.status) {
        case "notStarted":
            return isRandomlyActivated(trial) ? "ACTIVATE TRIAL" : "START TRIAL";
        case "pending_activation":
            return "WAITING FOR ACTIVATION";
        case "active":
        case "proof_submitted":
            if (requiresText(trial)) return "WRITE YOUR ANSWER";
            return requiresVideo(trial) ? "RECORD EVIDENCE" : "ADD EVIDENCE";
        case "completed":
            return "COMPLETED";
        case "expired":
        case "abandoned":
            return "TRY AGAIN";
    }
}

/**
 * The card shows what to DO, cut to one breath. Mirrors `AnimalTrialCard.preview`:
 * 120 characters, broken at the last space when that leaves most of the line.
 */
export const WHAT_TO_DO_CHARACTER_LIMIT = 120;

export function instructionsPreview(text: string) {
    const trimmed = text.trim();
    if (trimmed.length <= WHAT_TO_DO_CHARACTER_LIMIT) return trimmed;
    let head = trimmed.slice(0, WHAT_TO_DO_CHARACTER_LIMIT);
    const lastSpace = head.lastIndexOf(" ");
    if (lastSpace > 70) head = head.slice(0, lastSpace);
    return `${head}…`;
}

/** "2/3 complete" over the cards, once an animal has more than one Trial. */
export function trialProgress(trials: AnimalTrial[]) {
    const total = trials.length;
    const done = trials.filter(isComplete).length;
    const fraction = total ? done / total : 0;
    return {done, total, fraction, percent: Math.round(fraction * 100), label: `${done}/${total} complete`};
}

/**
 * Whether this person may start or submit a Trial for a species. A Trial is per
 * person per species: looking at someone else's public capture does not grant
 * it — the viewer has to have unlocked the animal themselves. Mirrors
 * `AnimalTrialUnlock.canAttempt` and the server's `species_not_unlocked`.
 */
export function canAttemptTrial(input: {
    ownsThisCapture: boolean;
    speciesProfileIds: Array<string | null | undefined>;
    identityKeys: Array<string | null | undefined>;
    discoveredProfileIds: Set<string>;
    discoveredIdentityKeys: Set<string>;
}) {
    if (input.ownsThisCapture) return true;
    if (input.speciesProfileIds.some((id) => id && input.discoveredProfileIds.has(id.toLowerCase()))) return true;
    return input.identityKeys.some((key) => {
        const normalized = key?.trim().toLowerCase();
        return Boolean(normalized && input.discoveredIdentityKeys.has(normalized));
    });
}

export const NOT_YET_CAPTURED_TITLE = "NOT YET CAPTURED";
export const NOT_YET_CAPTURED_NOTE = "You don't own this index yet.";

/** A start/restart refusal, with the unlock gate named plainly. */
export function trialStartErrorMessage(error: unknown, fallback: string) {
    const text = typeof error === "string" ? error : error instanceof Error ? error.message : JSON.stringify(error ?? "");
    return /species_not_unlocked/i.test(text) ? NOT_YET_CAPTURED_NOTE : fallback;
}

export function canSubmitEvidence(trial: AnimalTrial) {
    return trial.status === "active" || trial.status === "proof_submitted";
}

/**
 * Concise user-facing safety line, assembled from the Trial's own tags. Never
 * legalistic — one sentence a person will actually read.
 */
const SAFETY_NOTES: Array<[string, string]> = [
    ["soft_objects_only", "soft, lightweight things only"],
    ["nothing_breakable_nearby", "nothing breakable nearby"],
    ["skip_if_injured", "skip it if you're injured"],
    ["clear_space_required", "clear space first"],
    ["no_climbing", "no climbing"],
    ["nothing_that_latches", "nothing that latches shut"],
    ["existing_contacts_only", "people you already know only"]
];

export function safetyNote(trial: AnimalTrial) {
    const notes = SAFETY_NOTES
        .filter(([tag]) => trial.safetyTags.includes(tag))
        .map(([, note]) => note);
    return notes.length ? notes.join(" · ") : null;
}

export function countdownLabel(seconds: number) {
    const total = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

// MARK: - Verifier refusals

export type AnimalTrialVerificationResult = {
    status: string;
    reason: string;
    rewardXP: number;
    framesUsed: number;
    /**
     * True only on the completion that actually created the Animal Power. A
     * person who already earned it by applying it completes the Trial and is
     * not granted a second one.
     */
    grantedPower: boolean;
};

export function isApproved(result: AnimalTrialVerificationResult) {
    return result.status === "approved";
}

/**
 * What to actually show someone. Never a raw code, never a false promise that
 * retrying will help when it will not.
 */
export function verifierRefusalMessage(code: string, serverMessage?: string | null) {
    switch (code) {
        case "proof_attempts_exhausted":
            // Deliberately NOT the server's message. The cap is shared with Apex
            // Growth, whose copy says "a new challenge is available tomorrow" —
            // false for a Trial, which is earned once per species and frequency
            // and never refreshes.
            return "You have used both checks on this Trial. It cannot be submitted again.";
        case "trial_not_started":
            return "Start the Trial before adding evidence.";
        case "trial_not_active_yet":
            return "This Trial has not gone live yet. You will get a notification when it does.";
        case "trial_window_closed":
            return "That Trial's window closed. Start it again whenever you like — nothing was lost.";
        case "trial_not_active":
            return "This Trial is not open for evidence right now.";
        case "proof_text_required":
            return "This Trial is answered in writing. Type your answer and send it.";
        case "proof_text_too_short":
            return "Write a little more so we can see what you did.";
        case "video_frames_required":
            return "A video Trial needs a recording, not a still. Hold the shutter to record.";
        case "proof_type_not_allowed":
            return "That kind of evidence is not accepted for this Trial.";
        case "evidence_download_failed":
            return "Your evidence did not finish uploading. Try adding it again.";
        case "proof_path_not_owned":
            return "That evidence could not be verified as yours.";
        case "species_not_unlocked":
            return "Capture this animal before taking its Trials.";
        case "verification_failed":
            return "The check could not be completed. Try again in a moment.";
        case "server_configuration":
            return "Trial checking is offline right now. Nothing was lost.";
        default:
            return serverMessage || "Could not check that evidence. Try again in a moment.";
    }
}

/** False when retrying is pointless, so the UI can stop inviting it. */
const NON_RETRYABLE_CODES = [
    "proof_attempts_exhausted",
    "trial_not_started",
    "trial_not_active_yet",
    "trial_window_closed",
    "trial_not_active",
    "proof_type_not_allowed",
    "species_not_unlocked"
];

export function isRetryableRefusal(code: string) {
    return !NON_RETRYABLE_CODES.includes(code);
}

// MARK: - Row decoding

function list(value: unknown): string[] {
    return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function str(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

const STATUSES: AnimalTrialStatus[] = [
    "notStarted", "pending_activation", "active", "proof_submitted", "completed", "expired", "abandoned"
];

/** Decodes one `animal_trials_for_viewer_v1` row; null on an unknown frequency. */
export function decodeAnimalTrial(row: any): AnimalTrial | null {
    const frequency = str(row?.frequency).toUpperCase();
    if (frequency !== "LOW" && frequency !== "MID" && frequency !== "HIGH") return null;

    const status = str(row?.status);

    return {
        speciesProfileId: str(row?.species_profile_id),
        frequency,
        speciesDisplayName: str(row?.species_display_name) || "This animal",
        title: str(row?.title),
        objective: str(row?.objective),
        instructions: str(row?.instructions),
        animalRule: str(row?.animal_rule),
        userBenefit: str(row?.user_benefit),
        principleLink: str(row?.principle_link),
        whyThisAnimal: str(row?.mechanism_connection),
        principleName: str(row?.principle_name),
        proofTypes: list(row?.proof_types),
        primaryProofType: str(row?.primary_proof_type),
        proofPrompt: str(row?.proof_prompt),
        proofForbiddenContent: list(row?.proof_forbidden_content),
        successCriteria: list(row?.success_criteria),
        estimatedMinutes: num(row?.estimated_minutes),
        completionWindowMinutes: row?.completion_window_minutes == null ? null : num(row.completion_window_minutes),
        activationModel: str(row?.activation_model),
        activationWindowHours: row?.activation_window_hours == null ? null : num(row.activation_window_hours),
        difficulty: num(row?.difficulty),
        safetyTags: list(row?.safety_tags),
        rewardClass: str(row?.reward_class),
        rewardCredits: num(row?.reward_credits),
        status: (STATUSES as string[]).includes(status) ? status as AnimalTrialStatus : "notStarted",
        activationDueAt: row?.activation_due_at ?? null,
        activatedAt: row?.activated_at ?? null,
        completionDeadlineAt: row?.completion_deadline_at ?? null,
        proofAttemptCount: num(row?.proof_attempt_count),
        verificationStatus: row?.verification_status ?? null,
        verificationReason: row?.verification_reason ?? null,
        rewardXPAwarded: num(row?.reward_xp_awarded),
        rewardCreditsAwarded: num(row?.reward_credits_awarded),
        completedAt: row?.completed_at ?? null,
        sharePublicly: row?.share_publicly === true,
        otherCompletionCount: num(row?.other_completion_count),
        bestUseCases: list(row?.best_use_cases)
    };
}

// MARK: - The Play hub

export type ArenaTrialGroup = {
    /** The species profile id. */
    id: string;
    name: string;
    trials: AnimalTrial[];
    /** Not yet completed, calm to volatile. The finished ones stay in `trials` so the count can read 1/3. */
    remaining: AnimalTrial[];
    completedCount: number;
};

/**
 * Open Trials grouped by animal, as the Play tab lists them. An animal whose
 * every Trial is finished has nothing remaining and is left out; the server's
 * `arena_caught_trials_v1` already drops it, this just never shows an empty
 * group on a stale read.
 */
export function arenaTrialGroups(openTrials: AnimalTrial[]): ArenaTrialGroup[] {
    const bySpecies = new Map<string, AnimalTrial[]>();
    for (const trial of openTrials) {
        const key = trial.speciesProfileId.toLowerCase();
        bySpecies.set(key, [...(bySpecies.get(key) ?? []), trial]);
    }
    return Array.from(bySpecies.entries())
        .map(([id, trials]) => ({
            id,
            name: trials[0]?.speciesDisplayName ?? "Animal",
            trials,
            remaining: sortTrials(trials.filter((trial) => !isComplete(trial))),
            completedCount: trials.filter(isComplete).length
        }))
        .filter((group) => group.remaining.length > 0)
        .sort((left, right) => left.name.localeCompare(right.name, undefined, {sensitivity: "base"}));
}

/**
 * Keeps a Trial the person just finished over a stale server row that still
 * says otherwise, so a finished Trial never becomes submittable again on a
 * cached read.
 */
export function mergeOpenTrials(previous: AnimalTrial[], fetched: AnimalTrial[]) {
    const finishedLocally = previous.filter(isComplete);
    return fetched.map((row) => {
        const local = finishedLocally.find((item) => trialId(item) === trialId(row));
        return local && !isComplete(row) ? local : row;
    });
}

function timestamp(value: string | null) {
    const parsed = value ? Date.parse(value) : NaN;
    return Number.isFinite(parsed) ? parsed : 0;
}

/** Completed Trials, newest completion first. */
export function completedTrialHistory(history: AnimalTrial[]) {
    return history.filter(isComplete).sort((left, right) => timestamp(right.completedAt) - timestamp(left.completedAt));
}

/** Trials whose evidence never succeeded, most recent first. */
export function failedTrialHistory(history: AnimalTrial[]) {
    const when = (trial: AnimalTrial) => timestamp(trial.completedAt ?? trial.completionDeadlineAt ?? trial.activatedAt);
    return history.filter(isFailed).sort((left, right) => when(right) - when(left));
}

/**
 * A Trial the sheet just wrote, folded into both hub lists: history gains a
 * finished one at the top, and the open list keeps it so an animal still on
 * 1/3 does not lose the finished Trial from its count.
 */
export function noteTrialUpdate(lists: {openTrials: AnimalTrial[]; history: AnimalTrial[]}, updated: AnimalTrial) {
    const id = trialId(updated);
    const openTrials = lists.openTrials.filter((item) => trialId(item) !== id);
    const history = lists.history.filter((item) => trialId(item) !== id);
    return {
        openTrials: [...openTrials, updated],
        history: isComplete(updated) || isFailed(updated) ? [updated, ...history] : history
    };
}

/** "Completed 3 Oct 2026", or the failure in two words. */
export function trialHistoryStatusLine(trial: AnimalTrial) {
    if (isComplete(trial)) {
        return trial.completedAt
            ? `Completed ${new Date(trial.completedAt).toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric"})}`
            : "Completed";
    }
    return failureSummary(trial);
}
