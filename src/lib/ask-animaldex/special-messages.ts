/**
 * Everything inline in the conversation (docs/your-step/INLINE.md, owner,
 * 2026-10-30): which of the animal's messages are **special** (they carry
 * something to do) and what each carries, and the Warmup as it runs in the
 * thread, a question at a time.
 *
 * A special message is the animal's own bubble with one treatment on every
 * platform (a neon edge on its left, a faint neon wash, a small uppercase
 * label with an icon) and its actions inside it. The words stay the
 * animal's; what makes it special comes from server state and the reply's
 * hidden card kinds, never from its words:
 *   - done: `companionEvent.stepDone` ("DONE TOGETHER · +5 XP"), the Power
 *     earned when `powerEarned`;
 *   - the step: the reply that set the open step (`askStepCardMessageId`);
 *   - the Warmup offer: its `training` card, while the animal has a Warmup;
 *   - the Trials: its `trial` card;
 *   - the debate offer: `companionEvent.debateOffer`, while Debates are offered.
 *
 * Pure, so the drawer and the tests share it.
 */

import {askReplyCards} from "@/lib/ask-animaldex/chat-cards";
import type {AskMessage} from "@/lib/ask-animaldex/thread";
import type {DebateNamedAnimal} from "@/lib/debates";
import type {StepFrequency} from "@/lib/your-step";
import {
    chooseTrainingAnswer,
    isTrainingQuizReady,
    startTrainingQuiz,
    trainingSubmission,
    type SpeciesTrainingResult,
    type TrainingQuizState
} from "@/lib/species-training";

export type AskSpecial =
    /** The animal saw their step done; `powerEarned` on the first one. */
    | {kind: "done"; xp: number; step: string; powerEarned: boolean}
    /** The reply set the step that is open now. */
    | {kind: "step"}
    | {kind: "warmup"}
    | {kind: "trials"; frequency: StepFrequency | null}
    | {kind: "debate"; problem: string | null; with: DebateNamedAnimal[]};

export type AskSpecialKind = AskSpecial["kind"];

/**
 * What a finished reply on the owner's chat carries, in the order it is
 * drawn: done first (it answers their report), then a step it set, then
 * the Warmup, the Trials and a debate it offered. Empty: a normal bubble.
 * Skipped or used offers (`cardsDismissed`) are gone; a done step never is.
 */
export function askReplySpecials(input: {
    message: Pick<AskMessage, "id" | "role" | "status" | "text" | "cardsDismissed" | "companionEvent">;
    /** The reply whose step is the open one (`askStepCardMessageId`). */
    stepCardMessageId: string | null;
    /** The animal has a Warmup (`training.available`). */
    warmupAvailable: boolean;
    /** The Power is earned and the server has Debates on. */
    debatesOffered: boolean;
}): AskSpecial[] {
    const {message} = input;
    if (message.role !== "assistant" || message.status !== "complete") return [];
    const specials: AskSpecial[] = [];
    const done = message.companionEvent?.stepDone;
    if (done) specials.push({kind: "done", xp: done.xp, step: done.step, powerEarned: done.powerEarned});
    if (input.stepCardMessageId && message.id === input.stepCardMessageId) specials.push({kind: "step"});
    if (message.cardsDismissed) return specials;
    for (const card of askReplyCards(message.text)) {
        if (card.kind === "training" && input.warmupAvailable) specials.push({kind: "warmup"});
        if (card.kind === "trial") specials.push({kind: "trials", frequency: card.frequency});
    }
    // The offer's quick replies come from the server's `debate_offer`, never from the hidden marker.
    const offer = message.companionEvent?.debateOffer;
    if (offer && input.debatesOffered) specials.push({kind: "debate", problem: offer.problem, with: offer.with});
    return specials;
}

/**
 * The person's own words the Power-earned message quotes: the message this
 * reply answered (their report, with its thumbnail, when they tapped "I did
 * it"). Null when the reply opens the thread.
 */
export function askEarnedQuote(
    messages: Array<Pick<AskMessage, "id" | "role" | "text" | "stepReportThumb" | "stepReportKind">>,
    messageId: string
): {text: string; thumb: string | null; kind: "photo" | "video" | null} | null {
    const index = messages.findIndex((message) => message.id === messageId);
    for (let at = index - 1; at >= 0; at -= 1) {
        const message = messages[at];
        if (message.role !== "user") continue;
        const text = message.text.trim();
        return text ? {text, thumb: message.stepReportThumb ?? null, kind: message.stepReportKind ?? null} : null;
    }
    return null;
}

// MARK: - The Warmup, in the thread

/**
 * One run of the Warmup in the thread: each question appears as the
 * animal's special message ("WARMUP · 1 OF 3") with its choices as chips; a
 * tap records the answer and the next question appears; the last one sends
 * the answers. A miss locks nothing: the offer stays, and another run can
 * start. Session-only: the result line is sent to the animal as the
 * person's own message, which the thread keeps.
 */
export type WarmupRun = {
    id: string;
    /** Drawn after this message: the newest one when it started (null: an empty thread). */
    afterMessageId: string | null;
    /** The animal's message that offered it; null from the Bond tab. */
    offerMessageId: string | null;
    quiz: TrainingQuizState;
    phase: "answering" | "submitting" | "result" | "error";
    result: SpeciesTrainingResult | null;
};

export function startWarmupRun(params: {id: string; questionCount: number; afterMessageId: string | null; offerMessageId: string | null}): WarmupRun {
    return {
        id: params.id,
        afterMessageId: params.afterMessageId,
        offerMessageId: params.offerMessageId,
        quiz: startTrainingQuiz(params.questionCount),
        phase: "answering",
        result: null
    };
}

/** How many questions are in the thread: every one answered, and the one being asked. */
export function warmupRunShownCount(run: WarmupRun): number {
    const total = run.quiz.answers.length;
    if (run.phase !== "answering") return total;
    return Math.min(total, run.quiz.answers.filter((answer) => answer !== null).length + 1);
}

/**
 * A tap on a choice of the question being asked. Earlier questions are
 * settled: a tap on one changes nothing. The last answer moves the run to
 * `submitting`; the caller sends `warmupRunSubmission`.
 */
export function answerWarmupRun(run: WarmupRun, question: number, choice: number): WarmupRun {
    if (run.phase !== "answering") return run;
    const current = warmupRunShownCount(run) - 1;
    if (question !== current || run.quiz.answers[question] !== null) return run;
    const quiz = chooseTrainingAnswer({...run.quiz, position: question}, choice);
    return {...run, quiz, phase: isTrainingQuizReady(quiz) ? "submitting" : "answering"};
}

/** `p_answers` in question order, once every question is answered. */
export function warmupRunSubmission(run: WarmupRun): number[] | null {
    return trainingSubmission(run.quiz);
}

/** The answers were marked: the result line shows, and goes to the animal. */
export function finishWarmupRun(run: WarmupRun, result: SpeciesTrainingResult): WarmupRun {
    return {...run, phase: "result", result};
}

/** The answers never reached the grader: the same ones can be sent again. */
export function failWarmupRun(run: WarmupRun): WarmupRun {
    return run.phase === "submitting" ? {...run, phase: "error"} : run;
}

export function retryWarmupRun(run: WarmupRun): WarmupRun {
    return run.phase === "error" ? {...run, phase: "submitting"} : run;
}

/** A run is under way (its offer's chips are put away until it ends). */
export function warmupRunActive(run: WarmupRun | null | undefined): boolean {
    return Boolean(run && (run.phase === "answering" || run.phase === "submitting" || run.phase === "error"));
}
