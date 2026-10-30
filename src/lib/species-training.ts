/**
 * The quiz on an animal's Power. Since AnimalDex 3.2 (docs/your-step/SPEC.md)
 * it is the optional **Warmup**: two or three questions on its lesson, +5 XP
 * the first time all are right, and it never blocks anything. A miss costs
 * nothing and locks nothing; it can be retaken any time, and passing is still
 * once. A fused Power's quiz keeps its own Training wording (SPEC section 6).
 *
 * The server owns every decision. `get_species_training` never sends the right
 * answers, and `submit_species_training` only says which answers were wrong on
 * a fail — never what the right one was. The explanations arrive only on a pass.
 */

// MARK: - Copy

/**
 * A fused Power's quiz (its own Training wording until it is redone as steps,
 * SPEC section 6). The animal's own quiz is the Warmup, in the companion
 * words' `journey.warmup`.
 */
export const TRAINING_COPY = {
    title: "Lesson check",
    start: "Take the lesson check",
    complete: "Lesson check passed",
    readPowerAgain: "Read the Power again",
    tryAgain: "Try again",
    continue: "Continue",
    close: "Close"
} as const;

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
 * to be available but carries no answerable question is treated as
 * unavailable, so a broken row never offers a quiz nobody can take. `locked`
 * and `proof_locked` are no longer read: since 3.2 they are always false.
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

// MARK: - The Warmup

/** The Warmup can be offered and taken now: it has questions, the animal is theirs, and it is not passed yet. */
export function trainingCanStart(training: SpeciesTraining | null | undefined) {
    return Boolean(training && training.available && training.unlocked && !training.completed && training.questions.length > 0);
}

/** Folds a submit into the read, so a pass shows at once. A miss changes nothing: it can be retaken. */
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

/** What to show for a quiz RPC refusal. Never a raw code. */
export function trainingRefusalMessage(code: string) {
    if (/species_not_unlocked/i.test(code)) return "You don't own this index yet. Capture this animal first.";
    if (/not_authenticated/i.test(code)) return "Sign in to take this animal's warmup.";
    if (/training_not_found|species_not_found/i.test(code)) return "This animal has no warmup yet.";
    if (/answers_mismatch/i.test(code)) return "Those answers did not match the questions. Try again.";
    return "Could not check your answers right now. Try again in a moment.";
}
