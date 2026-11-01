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
    | {kind: "done"; xp: number; step: string; powerEarned: boolean; /** Of `xp`, the proof bonus; absent when none. */ proofBonus?: number}
    /** "YOUR STEP": the step this reply set (or the Trial picked from it). */
    | {kind: "step"; stepSet: AskCompanionStepSet}
    /** "{NAME}'S TRIALS": the picker. */
    | {kind: "trials"}
    /** "WARMUP": Take the warmup (+5 XP) / Skip. */
    | {kind: "warmup"}
    /**
     * "START A DEBATE": Yes, start a debate / Not now. "Yes, start a debate" grows it into
     * the setup in the same section (docs/rich-chat/SPEC.md, section 2.2).
     */
    | {kind: "debate"; problem: string | null; with: DebateNamedAnimal[]}
    /** "DEBATE": the debate started from this offer, the section gone quiet in place. */
    | {kind: "debateStarted"; debateId: string};

export type AskSpecialKind = AskSpecial["kind"];

/**
 * The sections of a finished reply on the owner's chat, in the order they
 * read: what was done, the step it set (or else its Trials), then what it
 * offers. Empty: a normal bubble. Skip, Not now or a started debate put the
 * offers away (`cardsDismissed`); a done step and a step never go.
 */
export function askReplySpecials(input: {
    message: Pick<AskMessage, "role" | "status" | "text" | "cardsDismissed" | "companionEvent" | "warmup" | "debateId">;
    /** The animal has no Warmup to take (or it could not load). */
    warmupUnavailable: boolean;
    /** "Take the warmup" was tapped on this reply: its questions follow in the thread. */
    warmupStarted: boolean;
    /** The animal has no Trials (or they could not load). */
    trialsUnavailable: boolean;
    /** The Power is earned and the server has Debates on. */
    debatesOffered: boolean;
}): AskSpecial[] {
    const {message} = input;
    if (message.role !== "assistant" || message.status !== "complete" || message.warmup) return [];
    const event = message.companionEvent;
    const kinds = new Set(askReplyCards(message.text).map((card) => card.kind));
    const specials: AskSpecial[] = [];
    if (event?.stepDone) {
        const {xp, step, powerEarned, proofBonus} = event.stepDone;
        specials.push({kind: "done", xp, step, powerEarned, ...(proofBonus ? {proofBonus} : {})});
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
    // Started from here, the same section stays, quiet: "DEBATE" and who is in it.
    if (input.debatesOffered && message.debateId) {
        specials.push({kind: "debateStarted", debateId: message.debateId});
    } else if (input.debatesOffered && !message.cardsDismissed && event?.debateOffer) {
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
    /**
     * A newer message in the thread carries this same step: only that one
     * has its buttons, so one step never shows twice. False when absent.
     */
    carriedLater?: boolean;
}): AskStepResolution {
    const {stepSet, openStep} = params;
    if (stepSet.id && params.doneStepIds.has(stepSet.id)) return {kind: "done"};
    if (openStep && askSameStep(stepSet, openStep)) return params.carriedLater ? {kind: "closed"} : {kind: "live", step: openStep};
    return params.loaded ? {kind: "closed"} : {kind: "pending"};
}

/** The same step: by id when both have one, else (an older server) by its words, as iOS `StepSet.matches`. */
export function askSameStep(left: {id?: string | null; step: string}, right: {id?: string | null; step: string}): boolean {
    if (left.id && right.id) return left.id === right.id;
    return left.step.trim() === right.step.trim();
}

/** The newest finished reply in the thread that set this step (its anchor), or null: set in an earlier conversation, or cleared away. */
export function askStepCarrierId(
    messages: Array<Pick<AskMessage, "id" | "role" | "status" | "companionEvent">>,
    step: {id?: string | null; step: string} | null | undefined
): string | null {
    if (!step) return null;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        const stepSet = message.role === "assistant" && message.status === "complete" ? message.companionEvent?.stepSet : undefined;
        if (stepSet && askSameStep(stepSet, step)) return message.id;
    }
    return null;
}

// MARK: - The open step as a message of its own

/**
 * The open step lives in the conversation (owner, 2026-10-30), never pinned
 * above it. When no reply in the loaded thread carries it (it was set in an
 * earlier conversation, or the thread was cleared), the thread shows one
 * more animal message holding only its step section: no words of the
 * animal's, which come from the model alone.
 *
 * What that message shows this visit, from what it showed so far (`shown`):
 * the open step while no reply carries it; once shown it stays, resolving
 * as older step sections do (done, or dropped or replaced by a step a reply
 * set). Null: no such message. It is drawn, never stored, never history.
 */
export function askThreadStep(params: {
    shown: AskCompanionStepSet | null;
    openStep: AnimalStep | null;
    messages: Array<Pick<AskMessage, "id" | "role" | "status" | "companionEvent">>;
}): AskCompanionStepSet | null {
    const {shown, openStep, messages} = params;
    if (!openStep || askStepCarrierId(messages, openStep) !== null) return shown;
    const trialFrequency = openStep.trialFrequency ?? undefined;
    if (shown && shown.id === openStep.id && shown.step === openStep.step && shown.trialFrequency === trialFrequency) return shown;
    return {id: openStep.id, step: openStep.step, ...(trialFrequency ? {trialFrequency} : {})};
}

/**
 * Where that message goes: where the conversation picks up. After the
 * history the chat opened on (`openedAt`), before anything said this visit;
 * with no history, right after the animal's hello once it is all shown; with
 * neither, first. The number of messages above it, or null while it waits
 * for the hello, or when a reply in the thread now carries the step itself
 * (one step never shows twice). New messages arrive below it.
 */
export function askThreadStepIndex(params: {
    step: AskCompanionStepSet | null;
    messages: Array<Pick<AskMessage, "id" | "role" | "status" | "companionEvent" | "createdAt" | "isGreeting">>;
    /** When the chat opened: what was written before it is the history it opened on. */
    openedAt: number;
    /** The hello is still to come: the thread is empty and the animal is about to speak first. */
    greetingPending: boolean;
    /** The reply being typed out right now, if any. */
    revealingId: string | null;
}): number | null {
    const {step, messages} = params;
    if (!step || askStepCarrierId(messages, step) !== null) return null;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const written = Date.parse(messages[index].createdAt);
        if (Number.isFinite(written) && written < params.openedAt) return index + 1;
    }
    const hello = messages.findIndex((message) => message.isGreeting === true);
    if (hello >= 0) {
        const greeting = messages[hello];
        return greeting.status === "complete" && greeting.id !== params.revealingId ? hello + 1 : null;
    }
    return params.greetingPending ? null : 0;
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
