/**
 * Fused Powers: what a Fusion teaches a card, and the two steps that switch its
 * stat boost on. Same spec as iOS and Android, so the copy below is word for
 * word what they show.
 *
 * A Fusion adds a learned Power to the receiving card with its boost OFF. The
 * player then passes that Power's own Training (`submit_fused_training`) and
 * proves it once — the fused Trial or Apply It Your Way, through the
 * `fused-power` edge function. Approval earns it: boost on, +10 XP and a few
 * Credits. The server owns every one of those decisions; this module only
 * reads what `get_capture_fused_powers` says.
 *
 * Fused Powers keep this loop in 3.2 until it is redone as steps
 * (docs/your-step/SPEC.md, section 6), minus the locks: a missed Training or
 * a refused proof can be tried again straight away.
 */

import {POWER_APPLICATION_LIMITS, powerRefusalMessage} from "@/lib/animal-powers";
import {type SpeciesTraining, type SpeciesTrainingQuestion, trainingRewardLine} from "@/lib/species-training";

// MARK: - Copy (identical on iOS, Android and web)

export const FUSED_COPY = {
    title: "Fused Powers",
    boostOn: "Boost on",
    boostLocked: "Boost locked",
    training: "Training",
    trial: "Trial",
    earned: "Earned",
    preparing: "Writing this Power's lesson check…",
    doTheTrial: "Do the Trial",
    applyItYourWay: "Apply It Your Way",
    earnedLine: "Power earned · Boost on",
    finishSentence: "Train it, then prove it. Its boost switches on when it's earned.",
    repeatLine: "Each fused Power brings its own Training and Trial, so the loop starts again.",
    fusionResultLine: "Its boost switches on after its Training and Trial.",
    notReady: "This Power isn't ready yet. Try again in a minute.",
    trainingRequired: "Pass this Power's lesson check first.",
    continue: "Continue"
} as const;

export const taughtByLine = (teacher: string) => `Taught by ${teacher}`;
export const bringsLine = (receiver: string, part: string) => `${receiver} brings: ${part}`;
export const teachesLine = (teacher: string, part: string) => `${teacher} teaches: ${part}`;
export const whenEarnedLine = (amount: number, stat: string) => `+${amount} ${stat} when earned`;

/** "intelligence" → "Intelligence", "pack_coordination" → "Pack Coordination". */
export function statDisplayName(stat: string) {
    return stat
        .replace(/[_-]+/g, " ")
        .trim()
        .split(/\s+/)
        .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
        .join(" ");
}

// MARK: - Model

export type FusedStage = "preparing" | "training" | "proving" | "earned";
export type FusedContentStatus = "missing" | "generating" | "ready" | "failed";

export type FusedBoost = {
    primaryStat: string | null;
    primary: number;
    secondaryStat: string | null;
    secondary: number;
};

export type FusedPowerContent = {
    motto: string | null;
    lesson: string | null;
    expression: string | null;
    receiverPart: string | null;
    teacherPart: string | null;
    example: string | null;
};

export type FusedTraining = {
    completed: boolean;
    rewardXP: number;
    questions: SpeciesTrainingQuestion[];
};

export type FusedTrial = {
    title: string;
    instructions: string;
    proofPrompt: string;
    successCriteria: string[];
    estimatedMinutes: number | null;
};

/** One item of `get_capture_fused_powers`. */
export type FusedPower = {
    id: string;
    captureId: string;
    name: string;
    expression: string | null;
    receiverPrincipleName: string | null;
    teacherPrincipleName: string | null;
    teacherSpeciesProfileId: string | null;
    teacherName: string;
    createdAt: string | null;
    boost: FusedBoost;
    earned: boolean;
    earnedVia: string | null;
    earnedAt: string | null;
    stage: FusedStage;
    contentStatus: FusedContentStatus;
    power: FusedPowerContent | null;
    training: FusedTraining | null;
    trial: FusedTrial | null;
    reward: {xp: number; credits: number};
    /** The reviewer's last reason, shown under the routes. */
    attempts: {lastReason: string | null};
};

/** `submit` on the `fused-power` edge function. */
export type FusedSubmitVerdict = "approved" | "needs_more" | "rejected";

export type FusedSubmitResult = {
    verdict: FusedSubmitVerdict;
    reason: string;
    earned: boolean;
    rewardXP: number;
    rewardCredits: number;
    rejectionsRemaining: number;
};

// MARK: - Decoding

function num(value: unknown, fallback = 0) {
    const parsed = typeof value === "number" ? value : Number(value);
    return value != null && value !== "" && Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** A jsonb payload can arrive as an object or, through some paths, as text. */
function parsed(payload: unknown): unknown {
    if (typeof payload !== "string") return payload;
    try {
        return JSON.parse(payload);
    } catch {
        return null;
    }
}

function object(payload: unknown): Record<string, any> | null {
    const value = parsed(payload);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
}

const STAGES: FusedStage[] = ["preparing", "training", "proving", "earned"];
const CONTENT_STATUSES: FusedContentStatus[] = ["missing", "generating", "ready", "failed"];

/**
 * The server's stage, or — for a row that somehow lacks one — the same rule the
 * RPC applies: earned, else not written yet, else Training owed, else proof owed.
 */
export function fusedStage(row: {stage?: unknown; earned: boolean; contentStatus: FusedContentStatus; trainingCompleted: boolean}): FusedStage {
    if (row.earned) return "earned";
    if (typeof row.stage === "string" && (STAGES as string[]).includes(row.stage)) return row.stage as FusedStage;
    if (row.contentStatus !== "ready") return "preparing";
    return row.trainingCompleted ? "proving" : "training";
}

function decodeQuestions(raw: unknown): SpeciesTrainingQuestion[] {
    return (Array.isArray(raw) ? raw : [])
        .map((entry: unknown, position: number) => {
            const row = object(entry);
            const prompt = text(row?.prompt);
            const choices = row && Array.isArray(row.choices) ? row.choices.map((choice: unknown) => String(choice ?? "")) : [];
            return prompt && choices.length >= 2 ? {index: num(row?.index, position), prompt, choices} : null;
        })
        .filter((question): question is SpeciesTrainingQuestion => question !== null)
        .sort((left, right) => left.index - right.index);
}

/** Null when the item names no learned Power. */
export function decodeFusedPower(raw: unknown): FusedPower | null {
    const row = object(raw);
    const id = text(row?.id);
    const name = text(row?.name);
    if (!row || !id || !name) return null;

    const boost = object(row.boost);
    const powerRow = object(row.power);
    const trainingRow = object(row.training);
    const trialRow = object(row.trial);
    const rewardRow = object(row.reward);
    const attemptsRow = object(row.attempts);
    const contentStatus = (CONTENT_STATUSES as string[]).includes(String(row.content_status))
        ? row.content_status as FusedContentStatus
        : "missing";
    const earned = row.earned === true;
    const training: FusedTraining | null = trainingRow ? {
        completed: trainingRow.completed === true,
        rewardXP: num(trainingRow.reward_xp, 10),
        questions: decodeQuestions(trainingRow.questions)
    } : null;
    const trialTitle = text(trialRow?.title);

    return {
        id,
        captureId: text(row.capture_id) ?? "",
        name,
        expression: text(row.expression),
        receiverPrincipleName: text(row.receiver_principle_name),
        teacherPrincipleName: text(row.teacher_principle_name),
        teacherSpeciesProfileId: text(row.teacher_species_profile_id),
        teacherName: text(row.teacher_name) ?? "Another animal",
        createdAt: text(row.created_at),
        boost: {
            primaryStat: text(boost?.primary_stat),
            primary: num(boost?.primary),
            secondaryStat: text(boost?.secondary_stat),
            secondary: num(boost?.secondary)
        },
        earned,
        earnedVia: text(row.earned_via),
        earnedAt: text(row.earned_at),
        stage: fusedStage({stage: row.stage, earned, contentStatus, trainingCompleted: Boolean(training?.completed)}),
        contentStatus,
        power: powerRow ? {
            motto: text(powerRow.motto),
            lesson: text(powerRow.lesson),
            expression: text(powerRow.expression),
            receiverPart: text(powerRow.receiver_part),
            teacherPart: text(powerRow.teacher_part),
            example: text(powerRow.example)
        } : null,
        training,
        trial: trialRow && trialTitle ? {
            title: trialTitle,
            instructions: text(trialRow.instructions) ?? "",
            proofPrompt: text(trialRow.proof_prompt) ?? "",
            successCriteria: Array.isArray(trialRow.success_criteria)
                ? trialRow.success_criteria.map((criterion: unknown) => String(criterion ?? "").trim()).filter(Boolean)
                : [],
            estimatedMinutes: trialRow.estimated_minutes == null ? null : num(trialRow.estimated_minutes)
        } : null,
        reward: {xp: num(rewardRow?.xp, 10), credits: Math.max(0, num(rewardRow?.credits))},
        // `training_locked` / `proof_locked` are always false since 3.2 and are not read.
        attempts: {lastReason: text(attemptsRow?.last_reason)}
    };
}

/** The whole RPC result, newest first as the server orders it. */
export function decodeFusedPowers(payload: unknown): FusedPower[] {
    const value = parsed(payload);
    return (Array.isArray(value) ? value : [])
        .map(decodeFusedPower)
        .filter((item): item is FusedPower => item !== null);
}

const VERDICTS: FusedSubmitVerdict[] = ["approved", "needs_more", "rejected"];

export function decodeFusedSubmitResult(payload: unknown): FusedSubmitResult | null {
    const row = object(payload);
    if (!row || row.ok !== true) return null;
    const verdict = String(row.verdict ?? "");
    return {
        verdict: (VERDICTS as string[]).includes(verdict) ? verdict as FusedSubmitVerdict : "needs_more",
        reason: text(row.reason) ?? "",
        earned: row.earned === true,
        rewardXP: num(row.reward_xp),
        rewardCredits: num(row.reward_credits),
        rejectionsRemaining: num(row.rejections_remaining, POWER_APPLICATION_LIMITS.maxRejections)
    };
}

/** `prepare`'s answer; anything unrecognised is treated as still preparing. */
export function decodePrepareStage(payload: unknown): "ready" | "preparing" | "unavailable" | "earned" {
    const stage = String(object(payload)?.stage ?? "");
    return stage === "ready" || stage === "unavailable" || stage === "earned" ? stage : "preparing";
}

// MARK: - Presentation

/** "+1 Intelligence", one per non-zero boost. */
export function boostChips(boost: FusedBoost): string[] {
    const chips: string[] = [];
    if (boost.primaryStat && boost.primary > 0) chips.push(`+${boost.primary} ${statDisplayName(boost.primaryStat)}`);
    if (boost.secondaryStat && boost.secondary > 0) chips.push(`+${boost.secondary} ${statDisplayName(boost.secondaryStat)}`);
    return chips;
}

export function boostStateText(earned: boolean) {
    return earned ? FUSED_COPY.boostOn : FUSED_COPY.boostLocked;
}

export type FusedStepState = "done" | "current" | "upcoming";

/** The mini stepper: Training → Trial → Earned. Preparing counts as Training. */
export function fusedSteps(stage: FusedStage): Array<{label: string; state: FusedStepState}> {
    const position = stage === "earned" ? 3 : stage === "proving" ? 1 : 0;
    return [FUSED_COPY.training, FUSED_COPY.trial, FUSED_COPY.earned].map((label, index) => ({
        label,
        state: index < position || stage === "earned" ? "done" : index === position ? "current" : "upcoming"
    }));
}

/** "+10 XP" on the Training stage. */
export function fusedTrainingRewardLine(item: FusedPower) {
    return trainingRewardLine(item.training?.rewardXP ?? 10, 0);
}

/** "+10 XP · +3 Credits · Boost on" on the proving stage. */
export function fusedProvingRewardLine(item: FusedPower) {
    return [trainingRewardLine(item.reward.xp, item.reward.credits), FUSED_COPY.boostOn].filter(Boolean).join(" · ");
}

/** "~15 min". */
export function estimatedMinutesLine(minutes: number | null) {
    return minutes && minutes > 0 ? `~${minutes} min` : null;
}

/**
 * Call `prepare` once per visit, and only when nobody is writing the content:
 * a 'generating' row is already being written and only needs polling.
 */
export function needsPrepare(item: FusedPower) {
    return item.stage === "preparing" && (item.contentStatus === "missing" || item.contentStatus === "failed");
}

/** Re-read every 5 s, for up to 2 minutes, while any row is still preparing. */
export const FUSED_POLL_INTERVAL_MS = 5_000;
export const FUSED_POLL_LIMIT_MS = 120_000;

/** The anchor each row carries, to scroll back to its lesson. */
export const fusedPowerAnchor = (id: string) => `fused-power-${id}`;

/**
 * The fused quiz in the shape the shared Training quiz reads. The species id is
 * unused: the fused quiz submits through its own route.
 */
export function fusedTrainingForQuiz(item: FusedPower): SpeciesTraining | null {
    if (!item.training || !item.training.questions.length) return null;
    return {
        speciesProfileId: "",
        available: true,
        completed: item.training.completed,
        unlocked: true,
        rewardXP: item.training.rewardXP,
        rewardCredits: 0,
        contentVersion: null,
        questions: item.training.questions
    };
}

// MARK: - Refusals

/** What to show for a `fused-power` or `submit_fused_training` refusal. Never a raw code. */
export function fusedRefusalMessage(code: string, serverMessage?: string | null) {
    if (/training_required/i.test(code)) return FUSED_COPY.trainingRequired;
    if (/fused_power_not_ready|fused_training_not_ready|preparing_failed/i.test(code)) return FUSED_COPY.notReady;
    if (/fused_power_not_found/i.test(code)) return "This Power is no longer on this card.";
    if (/answers_mismatch/i.test(code)) return "Those answers did not match the questions. Try again.";
    if (/not_authenticated|unauthorized/i.test(code)) return "Sign in to finish this Power.";
    return powerRefusalMessage(code, serverMessage);
}
