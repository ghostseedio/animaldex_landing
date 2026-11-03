/**
 * The words of 3.2 "Your step" that depend on the step: the card's first
 * button, and what is sent to the animal as the person's own message. Kept
 * apart from `your-step.ts` so the chat's decoders import no words.
 */

import type {StepOutcome} from "@/lib/ask-animaldex/companion-loop";
import {fillWords, trialDifficulty, trialDifficultyText, type CompanionWords} from "@/lib/companion-bond";
import {stepCardState, type AnimalStep, type StepProblemCode} from "@/lib/your-step";

/**
 * The card's first button (SPEC section 5): "I've done it", and "Tell {name}
 * more" once a report is attached. Both open the report: a step needs no
 * accepting first (owner, 2026-11-03: "I'll do it" is gone).
 */
export function stepPrimaryLabel(step: Pick<AnimalStep, "acceptedAt" | "hasReport">, name: string, words: CompanionWords): string {
    switch (stepCardState(step)) {
        case "offered":
        case "accepted": return words.journey.step.didIt;
        case "reported": return fillWords(words.journey.report.more, {name});
    }
}

// MARK: - What is sent to the animal as the person's message

/** "I'll try your Easy Trial.", in the reader's words. */
export function trialPickedMessage(frequency: string | null | undefined, words: CompanionWords): string | null {
    const difficulty = trialDifficulty(frequency);
    return difficulty ? fillWords(words.journey.trial.pickedMessage, {difficulty: trialDifficultyText(difficulty, words)}) : null;
}

/** "I got 2 of 2 on your warmup." / "I got 1 of 3 on your warmup.", pass or miss ("all 2" read badly). */
export function warmupResultMessage(result: {passed: boolean; correct: boolean[]}, words: CompanionWords): string {
    return fillWords(words.journey.warmup.resultMessage, {right: result.correct.filter(Boolean).length, n: result.correct.length});
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

// MARK: - Everything inline in the conversation (docs/your-step/INLINE.md)

/** The report mode's strip above the field: "Telling Leo how your step went". */
export function stepReportStripText(name: string, words: CompanionWords): string {
    return fillWords(words.journey.report.strip, {name});
}

/**
 * The done special message's label: "Done together · +5 XP", or "Done together" when it paid nothing; when it
 * did not quite work, how it went ("Didn't work this time · +5 XP"): the attempt still counts.
 */
export function stepDoneLabel(xp: number, words: CompanionWords, outcome?: StepOutcome | null): string {
    const done = words.journey.done;
    const head = outcome === "partly" ? done.partly : outcome === "didnt_work" ? done.didntWork : done.chip;
    return xp > 0 ? `${head} · ${fillWords(done.xp, {xp})}` : head;
}

/** Under the done label when the proof showed the step: "+5 XP for your proof"; null without a bonus. */
export function stepProofBonusLine(bonus: number | null | undefined, words: CompanionWords): string | null {
    const n = Math.max(0, Math.round(bonus ?? 0));
    return n > 0 ? fillWords(words.journey.done.proofBonus, {n}) : null;
}

/** Under the Power's name on the first done step: "Leo's Power is yours · Earned in your own life". */
export function stepEarnedLine(name: string, words: CompanionWords): string {
    return `${fillWords(words.journey.earned.subtitle, {name})} · ${words.journey.earned.via}`;
}

/** A Warmup question in the thread: "Warmup · 1 of 3" (shown in capitals). */
export function warmupQuestionLabel(n: number, total: number, words: CompanionWords): string {
    return fillWords(words.journey.warmup.questionLabel, {n, total});
}

/**
 * The line at the end of the Warmup in the thread: "Warmup done · +5 XP" on
 * a first pass, "Warmup done" on a pass that paid nothing, and on a miss
 * `warmup.missed` ("Not quite. Leo will tell you how its kind sees it.").
 */
export function warmupResultLine(
    result: {passed: boolean; rewardXP: number; alreadyCompleted: boolean},
    name: string,
    words: CompanionWords
): string {
    if (!result.passed) return fillWords(words.journey.warmup.missed, {name});
    return result.rewardXP > 0 && !result.alreadyCompleted
        ? `${words.journey.warmup.passed} · ${fillWords(words.journey.done.xp, {xp: result.rewardXP})}`
        : words.journey.warmup.passed;
}
