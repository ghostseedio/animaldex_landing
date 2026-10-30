/**
 * The words of 3.2 "Your step" that depend on the step: the card's first
 * button, and what is sent to the animal as the person's own message. Kept
 * apart from `your-step.ts` so the chat's decoders import no words.
 */

import {fillWords, trialDifficulty, trialDifficultyText, type CompanionWords} from "@/lib/companion-bond";
import {stepCardState, type AnimalStep, type StepProblemCode} from "@/lib/your-step";

/**
 * The card's first button (SPEC section 5): "I'll do it" until accepted, then
 * "I did it", and "Tell {name}" again once a report is attached.
 */
export function stepPrimaryLabel(step: Pick<AnimalStep, "acceptedAt" | "hasReport">, name: string, words: CompanionWords): string {
    switch (stepCardState(step)) {
        case "offered": return words.journey.step.accept;
        case "accepted": return words.journey.step.didIt;
        case "reported": return fillWords(words.journey.report.send, {name});
    }
}

// MARK: - What is sent to the animal as the person's message

/** "I'll try your Easy Trial.", in the reader's words. */
export function trialPickedMessage(frequency: string | null | undefined, words: CompanionWords): string | null {
    const difficulty = trialDifficulty(frequency);
    return difficulty ? fillWords(words.journey.trial.pickedMessage, {difficulty: trialDifficultyText(difficulty, words)}) : null;
}

/** "I got all 3 on your warmup." / "I got 1 of 3 on your warmup." */
export function warmupResultMessage(result: {passed: boolean; correct: boolean[]}, words: CompanionWords): string {
    const n = result.correct.length;
    if (result.passed) return fillWords(words.journey.warmup.resultMessagePassed, {n});
    return fillWords(words.journey.warmup.resultMessageMissed, {right: result.correct.filter(Boolean).length, n});
}

/** "Two quick questions on {power}.", or "{n} quick questions …" for any other count. */
export function warmupOfferText(power: string, questionCount: number, words: CompanionWords): string {
    return questionCount === 2 || questionCount <= 0
        ? fillWords(words.journey.warmup.offer, {power})
        : fillWords(words.journey.warmup.offerCount, {n: questionCount, power});
}

/** What went wrong with a step, in calm words: never the code, never a lock. */
export function stepProblemText(code: StepProblemCode | string | null | undefined, words: CompanionWords): string {
    switch (code) {
        case "not_authenticated": return words.journey.problems.signIn;
        case "step_not_found":
        case "step_not_open": return words.journey.problems.stepGone;
        case "species_not_unlocked": return words.journey.problems.catchFirst;
        case "species_not_found":
        case "invalid_frequency":
        case "trial_not_found": return words.journey.problems.trialGone;
        case "account_too_short": return words.journey.problems.tooShort;
        case "too_many_media": return words.journey.problems.oneMedia;
        case "media_path_not_owned":
        case "media_not_supported":
        case "media_too_large":
        case "upload_failed": return words.journey.problems.mediaFailed;
        default: return words.journey.problems.generic;
    }
}
