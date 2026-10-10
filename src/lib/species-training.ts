/**
 * Training: a short quiz on an animal's Power, taken once per animal before its
 * Trials and Apply It Your Way open. Same spec as iOS and Android, so the copy
 * below is word for word what they show.
 *
 * The server owns every decision. `get_species_training` never sends the right
 * answers, and `submit_species_training` only says which answers were wrong on
 * a fail — never what the right one was. The explanations arrive only on a pass.
 */

// MARK: - Copy (identical on iOS, Android and web)

export const TRAINING_COPY = {
    title: "Training",
    start: "Start Training",
    complete: "Training complete",
    readPowerAgain: "Read the Power again",
    tryAgain: "Try again",
    continue: "Continue",
    lockedLine: "Complete Training to unlock",
    required: "Complete this animal's Training first."
} as const;

/** "Answer 1 quick question about this animal's Power." / "Answer 3 quick questions …" */
export function trainingIntroText(questionCount: number) {
    return questionCount === 1
        ? `Answer ${questionCount} quick question about this animal's Power.`
        : `Answer ${questionCount} quick questions about this animal's Power.`;
}

/** "Question 2 of 3", 1-based. */
export function trainingQuestionProgress(position: number, total: number) {
    return `Question ${position} of ${total}`;
}

/** "+10 XP · +1 Credit". The XP part is hidden at 0, and so is the Credit part. */
export function trainingRewardLine(rewardXP: number, rewardCredits: number) {
    const parts: string[] = [];
    if (rewardXP > 0) parts.push(`+${rewardXP} XP`);
    if (rewardCredits > 0) parts.push(`+${rewardCredits} ${rewardCredits === 1 ? "Credit" : "Credits"}`);
    return parts.join(" · ");
}

/** "1 of 3 right. Every answer has to be right." */
export function trainingFailSummary(correct: boolean[]) {
    const right = correct.filter(Boolean).length;
    return `${right} of ${correct.length} right. Every answer has to be right.`;
}

// MARK: - Model

export type SpeciesTrainingQuestion = {
    index: number;
    prompt: string;
    choices: string[];
};

/** `get_species_training`. */
export type SpeciesTraining = {
    speciesProfileId: string;
    /** False: this animal has no Training, and nothing is gated on it. */
    available: boolean;
    completed: boolean;
    /** The viewer has caught this animal; the server refuses a submit otherwise. */
    unlocked: boolean;
    rewardXP: number;
    rewardCredits: number;
    contentVersion: number | null;
    questions: SpeciesTrainingQuestion[];
};

/** `submit_species_training`. */
export type SpeciesTrainingResult = {
    passed: boolean;
    alreadyCompleted: boolean;
    /** One per question, in question order. Never the right answer. */
    correct: boolean[];
    /** Pass only, one per question. */
    explanations: string[];
    rewardXP: number;
    rewardCredits: number;
};

function num(value: unknown, fallback = 0) {
    const parsed = typeof value === "number" ? value : Number(value);
    return value != null && Number.isFinite(parsed) ? parsed : fallback;
}

function str(value: unknown) {
    return typeof value === "string" ? value : "";
}

/** A jsonb payload can arrive as an object or, through some paths, as text. */
function object(payload: unknown): Record<string, any> | null {
    if (typeof payload === "string") {
        try {
            return object(JSON.parse(payload));
        } catch {
            return null;
        }
    }
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, any> : null;
}

function decodeQuestion(raw: unknown, position: number): SpeciesTrainingQuestion | null {
    const row = object(raw);
    if (!row) return null;
    const prompt = str(row.prompt).trim();
    const choices = Array.isArray(row.choices) ? row.choices.map((choice: unknown) => String(choice ?? "")) : [];
    if (!prompt || choices.length < 2) return null;
    return {index: num(row.index, position), prompt, choices};
}

/**
 * Null when the payload is not a Training read at all. A Training that claims
 * to be available but carries no answerable question is treated as unavailable,
 * so a broken row can never lock the Trials behind a quiz nobody can take.
 */
export function decodeSpeciesTraining(payload: unknown): SpeciesTraining | null {
    const row = object(payload);
    if (!row) return null;

    const questions = (Array.isArray(row.questions) ? row.questions : [])
        .map((question: unknown, position: number) => decodeQuestion(question, position))
        .filter((question: SpeciesTrainingQuestion | null): question is SpeciesTrainingQuestion => question !== null)
        .sort((left: SpeciesTrainingQuestion, right: SpeciesTrainingQuestion) => left.index - right.index);

    const completed = row.completed === true;

    return {
        speciesProfileId: str(row.species_profile_id),
        available: row.available === true && (completed || questions.length > 0),
        completed,
        unlocked: row.unlocked === true,
        rewardXP: num(row.reward_xp),
        rewardCredits: num(row.reward_credits),
        contentVersion: row.content_version == null ? null : num(row.content_version),
        questions
    };
}

export function decodeSpeciesTrainingResult(payload: unknown): SpeciesTrainingResult | null {
    const row = object(payload);
    if (!row || typeof row.passed !== "boolean") return null;
    return {
        passed: row.passed,
        alreadyCompleted: row.already_completed === true,
        correct: Array.isArray(row.correct) ? row.correct.map((value: unknown) => value === true) : [],
        explanations: Array.isArray(row.explanations) ? row.explanations.map((value: unknown) => String(value ?? "")) : [],
        rewardXP: num(row.reward_xp),
        rewardCredits: num(row.reward_credits)
    };
}

// MARK: - Gate

/**
 * While this is true, Trials and Apply It Your Way show locked with
 * "Complete Training to unlock". An animal with no Training, or a read that has
 * not landed, gates nothing — the server is the authority and refuses with
 * `training_required` regardless.
 */
export function trainingGatesPlay(training: SpeciesTraining | null | undefined) {
    return Boolean(training && training.available && !training.completed);
}

/** The Training band shows only for an animal that has one. */
export function showsTrainingStep(training: SpeciesTraining | null | undefined) {
    return Boolean(training?.available);
}

/** Folds a passing submit into the read, so the band flips without waiting for a re-read. */
export function notingTrainingResult(training: SpeciesTraining, result: SpeciesTrainingResult): SpeciesTraining {
    return result.passed ? {...training, completed: true} : training;
}

// MARK: - Quiz state

export type TrainingQuizState = {
    /** Chosen choice index per question; null where none is chosen yet. */
    answers: Array<number | null>;
    /** The question on screen. */
    position: number;
};

export function startTrainingQuiz(questionCount: number): TrainingQuizState {
    return {answers: Array.from({length: Math.max(0, questionCount)}, () => null), position: 0};
}

/** Choosing records the answer and advances. On the last question it stays put; the caller submits. */
export function chooseTrainingAnswer(state: TrainingQuizState, choice: number): TrainingQuizState {
    if (state.position < 0 || state.position >= state.answers.length) return state;
    const answers = state.answers.slice();
    answers[state.position] = choice;
    const position = state.position + 1 < answers.length ? state.position + 1 : state.position;
    return {answers, position};
}

/** Back to the previous question, keeping its answer so it can be changed. */
export function previousTrainingQuestion(state: TrainingQuizState): TrainingQuizState {
    return state.position > 0 ? {...state, position: state.position - 1} : state;
}

/** Every question answered: time to submit. */
export function isTrainingQuizReady(state: TrainingQuizState) {
    return state.answers.length > 0 && state.answers.every((answer) => answer !== null);
}

/** `p_answers`, in question order. Null until every question is answered. */
export function trainingSubmission(state: TrainingQuizState): number[] | null {
    return isTrainingQuizReady(state) ? state.answers.map((answer) => answer as number) : null;
}

// MARK: - Refusals

export function isTrainingRequiredRefusal(error: unknown) {
    const text = typeof error === "string" ? error : error instanceof Error ? error.message : JSON.stringify(error ?? "");
    return /training_required/i.test(text);
}

/** What to show for a Training RPC refusal. Never a raw code. */
export function trainingRefusalMessage(code: string) {
    if (/training_required/i.test(code)) return TRAINING_COPY.required;
    if (/species_not_unlocked/i.test(code)) return "You don't own this index yet. Capture this animal first.";
    if (/not_authenticated/i.test(code)) return "Sign in to take this animal's Training.";
    if (/training_not_found|species_not_found/i.test(code)) return "This animal has no Training yet.";
    if (/answers_mismatch/i.test(code)) return "Those answers did not match the questions. Try again.";
    return "Could not check your answers right now. Try again in a moment.";
}
