/**
 * Animal Trials, ported from the iOS source of truth (`AnimalDex/Models/AnimalTrial.swift`).
 *
 * What an animal's survival strategy teaches you to DO, once.
 *
 * Frequency is the CHARACTER of the task, never its length: LOW is patient,
 * MID is ordinary productive effort, HIGH is a burst. Every Trial is one
 * action, and missing one costs nothing.
 *
 * Since AnimalDex 3.2 (docs/your-step/SPEC.md) a Trial is one way to get a
 * step: "Make this my step" makes it the step with the animal, which finishes
 * it in conversation ("I did it"). No timer, no random start, no grader on the
 * web; this module reads the Trials for the rows that offer them and for the
 * history of Trials done the old way.
 */

import {parseTrialStoryboard, type TrialStoryboard} from "@/lib/trial-motion/storyboard";

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
    /**
     * The Trial Loop (`motion_storyboard`, the view's last column): a short
     * drawing of what to do. Null until authored, and for anything the renderer
     * could not draw; a null storyboard shows the Trial exactly as before.
     */
    motionStoryboard: TrialStoryboard | null;
    /**
     * The loop's captions in the page language, pre-translated, when they were
     * translated from exactly this storyboard's captions. Null shows the
     * storyboard's own (English) captions. Filled by the routes, never decoded.
     */
    motionCaptions: string[] | null;
};

/**
 * Mirrors MAX_TRIAL_PROOF_SUBMISSIONS in `verify-animal-trial-proof`: a Trial
 * run the old way (3.1 and older apps) that used every check is history.
 */
const MAX_PROOF_ATTEMPTS = 6;

export function trialId(trial: AnimalTrial) {
    return `${trial.speciesProfileId}:${trial.frequency}`;
}

// MARK: - Frequency vocabulary

/** LOW is calm, MID is active, HIGH is volatile. */
export function frequencyAccent(frequency: AnimalTrialFrequency) {
    switch (frequency) {
        case "LOW": return "#E84D57";
        case "MID": return "#FAC233";
        case "HIGH": return "#5CDBFF";
    }
}

/** LOW, then MID, then HIGH: calm to volatile. */
const FREQUENCY_ORDER: Record<AnimalTrialFrequency, number> = {LOW: 0, MID: 1, HIGH: 2};

export function sortTrials(trials: AnimalTrial[]) {
    return [...trials].sort((a, b) => (FREQUENCY_ORDER[a.frequency] ?? 9) - (FREQUENCY_ORDER[b.frequency] ?? 9));
}

// MARK: - Derived state

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

/** Started the old way and still possible to finish there (3.1 and older apps). */
function isInProgress(trial: AnimalTrial) {
    switch (trial.status) {
        case "pending_activation":
            return true;
        case "active":
        case "proof_submitted":
            return trial.proofAttemptCount < MAX_PROOF_ATTEMPTS;
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
            return trial.proofAttemptCount >= MAX_PROOF_ATTEMPTS;
        default:
            return false;
    }
}

function failureSummary(trial: AnimalTrial) {
    switch (trial.status) {
        case "expired": return "Window closed";
        case "abandoned": return "Left unfinished";
        case "active":
        case "proof_submitted": return "Evidence not accepted";
        default: return "Not completed";
    }
}

/** XP shown before completion. Mirrors REWARD_XP in the verify function. */
export function rewardXP(trial: AnimalTrial) {
    if (trial.rewardXPAwarded > 0) return trial.rewardXPAwarded;
    return trial.rewardClass === "xp_small" ? 5 : 10;
}

/**
 * The card shows what to DO, cut to one breath. Mirrors `AnimalTrialCard.preview`:
 * 120 characters, broken at the last space when that leaves most of the line.
 */
const WHAT_TO_DO_CHARACTER_LIMIT = 120;

export function instructionsPreview(text: string) {
    const trimmed = text.trim();
    if (trimmed.length <= WHAT_TO_DO_CHARACTER_LIMIT) return trimmed;
    let head = trimmed.slice(0, WHAT_TO_DO_CHARACTER_LIMIT);
    const lastSpace = head.lastIndexOf(" ");
    if (lastSpace > 70) head = head.slice(0, lastSpace);
    return `${head}…`;
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
        bestUseCases: list(row?.best_use_cases),
        motionStoryboard: parseTrialStoryboard(row?.motion_storyboard),
        motionCaptions: null
    };
}

// MARK: - History (Trials taken)

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

/** "Completed 3 Oct 2026", or the failure in two words. */
export function trialHistoryStatusLine(trial: AnimalTrial) {
    if (isComplete(trial)) {
        return trial.completedAt
            ? `Completed ${new Date(trial.completedAt).toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric"})}`
            : "Completed";
    }
    return failureSummary(trial);
}
