/**
 * Everything inline in the conversation (docs/your-step/INLINE.md, owner,
 * 2026-10-30), as iOS `AnimalSpecialSections` and `AnimalWarmupRun` decide it:
 * which sections an animal's reply carries to do, and how the Warmup moves on
 * as messages in the thread, a question at a time.
 *
 * A special message is the animal's own bubble with one treatment on every
 * platform (a neon edge on its left, a faint neon wash, a small uppercase
 * label with an icon) and its actions inside it. The words stay the
 * animal's; what makes it special comes from server state and the reply's
 * hidden card kinds, never from its words.
 *
 * Pure, so the drawer and the tests share it.
 */

import {askReplyCards} from "@/lib/ask-animaldex/chat-cards";
import type {AskCompanionStepSet} from "@/lib/ask-animaldex/companion-loop";
import type {AskMessage, AskWarmupItem} from "@/lib/ask-animaldex/thread";
import type {DebateNamedAnimal} from "@/lib/debates";
import type {AnimalStep} from "@/lib/your-step";
import type {SpeciesTraining, SpeciesTrainingResult} from "@/lib/species-training";

// MARK: - Sections of a special message

/** One thing a reply carries to do, drawn as a section of its last bubble. */
export type AskSpecial =
    /** "DONE TOGETHER · +5 XP": the animal saw a step done; the first one earned the Power. */
    | {kind: "done"; xp: number; step: string; powerEarned: boolean}
    /** "YOUR STEP": the step this reply set (or the Trial picked from it). */
    | {kind: "step"; stepSet: AskCompanionStepSet}
    /** "{NAME}'S TRIALS": the picker. */
    | {kind: "trials"}
    /** "WARMUP": Take the warmup (+5 XP) / Skip. */
    | {kind: "warmup"}
    /** "COMPARE WITH OTHER ANIMALS": Yes, compare / Not now. */
    | {kind: "debate"; problem: string | null; with: DebateNamedAnimal[]};

export type AskSpecialKind = AskSpecial["kind"];

/**
 * The sections of a finished reply on the owner's chat, in the order they
 * read: what was done, the step it set (or else its Trials), then what it
 * offers. Empty: a normal bubble. Skip, Not now or a started debate put the
 * offers away (`cardsDismissed`); a done step and a step never go.
 */
export function askReplySpecials(input: {
    message: Pick<AskMessage, "role" | "status" | "text" | "cardsDismissed" | "companionEvent" | "warmup">;
    /** The animal has no Warmup to take (or it could not load). */
    warmupUnavailable: boolean;
    /** "Take the warmup" was tapped on this reply: its questions follow in the thread. */
    warmupStarted: boolean;
    /** The animal has no Trials (or they could not load). */
    trialsUnavailable: boolean;
    /** The Power is earned and the server has Debates on. */
    debatesOffered: boolean;
    /** The debate's setup band is open under this reply. */
    debateSetupOpenHere: boolean;
}): AskSpecial[] {
    const {message} = input;
    if (message.role !== "assistant" || message.status !== "complete" || message.warmup) return [];
    const event = message.companionEvent;
    const kinds = new Set(askReplyCards(message.text).map((card) => card.kind));
    const specials: AskSpecial[] = [];
    if (event?.stepDone) {
        specials.push({kind: "done", xp: event.stepDone.xp, step: event.stepDone.step, powerEarned: event.stepDone.powerEarned});
    }
    if (event?.stepSet) {
        specials.push({kind: "step", stepSet: event.stepSet});
    } else if (kinds.has("trial") && !message.cardsDismissed && !input.trialsUnavailable) {
        // Once a Trial is picked the reply carries that step instead.
        specials.push({kind: "trials"});
    }
    if (kinds.has("training") && !message.cardsDismissed && !input.warmupStarted && !input.warmupUnavailable) {
        specials.push({kind: "warmup"});
    }
    // The quick replies come from the server's `debate_offer`, never from the hidden marker.
    if (input.debatesOffered && !message.cardsDismissed && !input.debateSetupOpenHere && event?.debateOffer) {
        specials.push({kind: "debate", problem: event.debateOffer.problem, with: event.debateOffer.with});
    }
    return specials;
}

/**
 * Where the step a reply set stands: the open step, with its buttons
 * (`live`); finished together in this thread (`done`); dropped or replaced
 * (`closed`); or not read yet (`pending`).
 */
export type AskStepResolution = {kind: "live"; step: AnimalStep} | {kind: "done"} | {kind: "closed"} | {kind: "pending"};

export function askStepResolution(params: {
    stepSet: AskCompanionStepSet;
    openStep: AnimalStep | null;
    /** The companion loop has been read once. */
    loaded: boolean;
    /** Steps the animal saw done in this thread (`stepDone.id`). */
    doneStepIds: ReadonlySet<string>;
}): AskStepResolution {
    const {stepSet, openStep} = params;
    if (stepSet.id && params.doneStepIds.has(stepSet.id)) return {kind: "done"};
    if (openStep && (stepSet.id ? stepSet.id === openStep.id : stepSet.step === openStep.step)) return {kind: "live", step: openStep};
    return params.loaded ? {kind: "closed"} : {kind: "pending"};
}

/** The step ids the animal saw done in this thread. */
export function askDoneStepIds(messages: Array<Pick<AskMessage, "companionEvent">>): Set<string> {
    const ids = new Set<string>();
    for (const message of messages) {
        const id = message.companionEvent?.stepDone?.id;
        if (id) ids.add(id);
    }
    return ids;
}

/**
 * The person's report a Power-earned reply answered: the nearest report
 * before it (on that step, when the reply names it), whose words it quotes
 * with their photo. Null when there is none.
 */
export function askEarnedReport<T extends Pick<AskMessage, "id" | "role" | "stepReportId" | "companionEvent">>(messages: T[], messageId: string): T | null {
    const index = messages.findIndex((message) => message.id === messageId);
    if (index < 0) return null;
    const stepId = messages[index].companionEvent?.stepDone?.id ?? null;
    for (let at = index - 1; at >= 0; at -= 1) {
        const candidate = messages[at];
        if (candidate.role !== "user" || !candidate.stepReportId) continue;
        if (!stepId || candidate.stepReportId === stepId) return candidate;
    }
    return null;
}

// MARK: - The Warmup in the thread

/**
 * Question `index` of the quiz, as the message that asks it ("WARMUP · 1 OF
 * 2", the question, its choices as chips). `runId` is the reply that offered
 * it (one run per offer); the species is the one the answers go back to.
 */
export function askWarmupItem(training: SpeciesTraining, index: number, runId: string): AskWarmupItem | null {
    const question = training.questions[index];
    if (!question || !training.speciesProfileId) return null;
    return {
        runId,
        speciesProfileId: training.speciesProfileId,
        index,
        total: training.questions.length,
        prompt: question.prompt,
        choices: question.choices
    };
}

/** The run's questions as they stand in the thread, in order. */
export function askWarmupItems(messages: Array<Pick<AskMessage, "warmup">>, runId: string): AskWarmupItem[] {
    return messages
        .flatMap((message) => (message.warmup && message.warmup.runId === runId ? [message.warmup] : []))
        .sort((left, right) => left.index - right.index);
}

/** The question to ask after `item`, or null when it was the last (or that one is already asked). */
export function askWarmupNextIndex(item: AskWarmupItem, asked: AskWarmupItem[]): number | null {
    if (item.index >= item.total - 1) return null;
    const next = item.index + 1;
    return asked.some((candidate) => candidate.index === next) ? null : next;
}

/** Every question answered, in question order: what the server takes. */
export function askWarmupAnswers(items: AskWarmupItem[]): number[] | null {
    const total = items[0]?.total ?? 0;
    if (total <= 0 || items.length !== total) return null;
    const ordered = [...items].sort((left, right) => left.index - right.index);
    if (ordered.some((item, position) => item.index !== position)) return null;
    const chosen = ordered.map((item) => item.chosen);
    return chosen.every((choice): choice is number => typeof choice === "number") ? chosen : null;
}

/** A tap on a choice: kept on the question. A question already answered stays as it was. */
export function answerAskWarmupItem(item: AskWarmupItem, choice: number): AskWarmupItem {
    if (typeof item.chosen === "number" || choice < 0 || choice >= item.choices.length) return item;
    return {...item, chosen: choice};
}

/** The server's verdict, kept on each question (and the pass, with the XP it paid, on the last). */
export function applyWarmupResult(result: SpeciesTrainingResult, item: AskWarmupItem): AskWarmupItem {
    const checked: AskWarmupItem = {...item, correct: item.index < result.correct.length ? result.correct[item.index] === true : result.passed};
    if (item.index >= item.total - 1) {
        checked.passed = result.passed;
        checked.rewardXP = result.passed && !result.alreadyCompleted ? result.rewardXP : 0;
    }
    return checked;
}

/** How one choice looks on its chip: open to tap, their answer (checked or not), or another answer. */
export type AskWarmupChoiceMark = "open" | "chosen" | "right" | "wrong" | "faded";

export function askWarmupChoiceMark(item: AskWarmupItem, choice: number): AskWarmupChoiceMark {
    if (typeof item.chosen !== "number") return "open";
    if (choice !== item.chosen) return "faded";
    if (item.correct === true) return "right";
    if (item.correct === false) return "wrong";
    return "chosen";
}
