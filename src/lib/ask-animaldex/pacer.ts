/**
 * How the animal's reply is typed out: at its own pace, a word at a time.
 *
 * Port of `AnimalReplyPacer.nextStep` in the iOS app
 * (`AnimalChatPresence.swift`). The network delivers tokens in bursts; the
 * reader sees words appear at the animal's `typing_cps` (from the persona
 * frame), with a breath after each sentence and a longer one between
 * paragraphs, so a slow animal reads slow and a quick one quick.
 *
 * The rules, all from the app (with its faster typing of 2026-10-23):
 *   - never a half word: a word appears only once whatever follows it has
 *     arrived (or the reply is complete);
 *   - a card or drawing (a ``` fence) appears whole, once its closing fence
 *     has arrived;
 *   - `instant` (a click on the reply, Stop, reduced motion, a screen reader)
 *     shows everything received at once.
 *
 * Additions for the web, where markdown renders as it is revealed:
 *   - a bold phrase appears whole, so `**` is never shown waiting for its
 *     other half;
 *   - a table appears whole, once the line after it (or the end of the
 *     reply) has arrived, never a cell at a time;
 *   - the pace is bounded (UX pass, DECISIONS section 6): the first words show
 *     as soon as they arrive, and the whole reply finishes revealing within
 *     `ASK_PACER_BUDGET_SECONDS` of them, each step speeding up in proportion
 *     to what is left. Past the budget, what has arrived is shown as it
 *     arrives.
 *
 * Pure: the drawer's hook owns the timer.
 */

export type AskPacerPace = "slow" | "measured" | "quick";

export type AskPacerInput = {
    /** Everything received for this reply so far. */
    target: string;
    /** How many characters of it are on screen. */
    shown: number;
    /** The network is done: `target` is the whole reply. */
    sourceDone: boolean;
    /** Show the rest now. */
    instant: boolean;
    typingCps: number;
    pace: AskPacerPace;
    /**
     * Seconds since this reply's first words were shown; absent before they
     * are. With it, the step is bounded by `budget`.
     */
    elapsed?: number;
    /** Seconds the whole reveal may take; `ASK_PACER_BUDGET_SECONDS` by default. */
    budget?: number;
};

/** Where the next step ends, and how long to wait after it, in seconds. */
export type AskPacerStep = {next: number; pause: number};

/** Pace when no persona frame has arrived: the app's `AnimalChatPersona.standard` (21 since 2026-10-23). */
export const ASK_PACER_DEFAULT = {typingCps: 21, pace: "measured" as AskPacerPace};

/** How long to look again while waiting for more of the reply. */
export const ASK_PACER_WAIT_SECONDS = 0.06;

/** A whole reply finishes revealing within this many seconds of its first words (DECISIONS section 6). */
export const ASK_PACER_BUDGET_SECONDS = 12;

const SENTENCE_END = ".!?…";
const CLAUSE_END = ",;:—–";

function isSpace(character: string | undefined): boolean {
    return character !== undefined && /\s/.test(character);
}

/** The index just past the closing fence's line, if it has arrived. */
function closingFence(target: string, start: number): number | null {
    const close = target.indexOf("```", start);
    if (close < 0) return null;
    const lineEnd = target.indexOf("\n", close + 3);
    return lineEnd < 0 ? target.length : lineEnd;
}

function lastNonSpace(text: string): string | null {
    for (let index = text.length - 1; index >= 0; index -= 1) {
        if (!isSpace(text[index])) return text[index];
    }
    return null;
}

function countBoldMarks(text: string): number {
    let count = 0;
    let index = text.indexOf("**");
    while (index >= 0) {
        count += 1;
        index = text.indexOf("**", index + 2);
    }
    return count;
}

/** The end of the word starting at `index` (the next whitespace, or the end). */
function wordEnd(target: string, index: number): number {
    let end = index;
    while (end < target.length && !isSpace(target[end])) end += 1;
    return end;
}

/** Where the table that starts at `index` ends (the end of its last row), once the line after it has arrived. */
function tableEnd(target: string, index: number, sourceDone: boolean): number | null {
    let lineStart = index;
    for (;;) {
        const lineEnd = target.indexOf("\n", lineStart);
        if (lineEnd < 0) return sourceDone ? target.length : null;
        const nextStart = lineEnd + 1;
        const rest = target.slice(nextStart);
        // The next line is not here yet (or only its indent is): it may be another row.
        if (!/\S/.test(rest) && !rest.includes("\n")) return sourceDone ? lineEnd : null;
        if (rest.startsWith("\n") || !rest.trimStart().startsWith("|")) return lineEnd;
        lineStart = nextStart;
    }
}

/** Nothing but an indent before `index` on its line. */
function atLineStart(target: string, index: number): boolean {
    const lineStart = target.lastIndexOf("\n", index - 1) + 1;
    return /^[ \t]*$/.test(target.slice(lineStart, index));
}

/**
 * The step bounded by the budget: its pause shrinks in proportion to what
 * is still to show, so the rest fits in the time left; past the budget, the
 * rest of what has arrived shows at once.
 */
function withinBudget(input: AskPacerInput, step: AskPacerStep): AskPacerStep {
    if (input.elapsed === undefined) return step;
    const budget = input.budget ?? ASK_PACER_BUDGET_SECONDS;
    const timeLeft = budget - input.elapsed;
    if (timeLeft <= 0) return {next: input.target.length, pause: 0};
    const chunk = Math.max(1, step.next - input.shown);
    const after = Math.max(0, input.target.length - step.next);
    return {next: step.next, pause: Math.min(step.pause, (chunk * timeLeft) / (chunk + after))};
}

export function askPacerStep(input: AskPacerInput): AskPacerStep {
    const {target, shown, sourceDone} = input;
    if (input.instant) return {next: target.length, pause: 0};
    // Past the budget, nothing waits on a word or a fence.
    if (input.elapsed !== undefined && input.elapsed >= (input.budget ?? ASK_PACER_BUDGET_SECONDS)) {
        return {next: target.length, pause: 0};
    }

    let index = shown;
    while (index < target.length && isSpace(target[index])) index += 1;

    // A card or drawing appears whole once its closing fence has arrived.
    if (target.startsWith("```", index)) {
        const close = closingFence(target, index + 3);
        if (close !== null) return withinBudget(input, {next: close, pause: 0.3});
        return sourceDone ? {next: target.length, pause: 0} : {next: shown, pause: 0.08};
    }

    // A table appears whole once it has ended: a block, never a cell at a time.
    if (target[index] === "|" && atLineStart(target, index)) {
        const end = tableEnd(target, index, sourceDone);
        if (end !== null) return withinBudget(input, {next: end, pause: 0.3});
        return {next: shown, pause: 0.08};
    }

    index = wordEnd(target, index);
    // The word may still be arriving: wait for what follows it.
    if (index === target.length && !sourceDone) return {next: shown, pause: ASK_PACER_WAIT_SECONDS};

    // A bold phrase opened in this word appears whole, through its closing **.
    if (countBoldMarks(target.slice(0, index)) % 2 === 1) {
        const close = target.indexOf("**", index);
        if (close < 0) {
            if (!sourceDone) return {next: shown, pause: ASK_PACER_WAIT_SECONDS};
        } else {
            const end = wordEnd(target, close + 2);
            if (end === target.length && !sourceDone) return {next: shown, pause: ASK_PACER_WAIT_SECONDS};
            index = end;
        }
    }

    const chunk = target.slice(shown, index);
    const scale = input.pace === "slow" ? 1.35 : input.pace === "quick" ? 0.75 : 1;
    // A long reply settles into reading speed after its opening, so the first
    // lines feel like talking and the reader is not kept waiting.
    const settling = shown > 520 ? 1.6 : shown > 260 ? 1.3 : 1;
    let pause = chunk.length / (Math.max(input.typingCps, 6) * settling);
    const last = lastNonSpace(chunk);
    // About half as long as before 2026-10-23 (owner: "speed up the stream").
    if (last && SENTENCE_END.includes(last)) {
        pause += 0.2 * scale;
    } else if (last && CLAUSE_END.includes(last)) {
        pause += 0.06 * scale;
    }
    if (index + 1 < target.length && target[index] === "\n" && target[index + 1] === "\n") {
        pause += 0.16 * scale;
    }
    return withinBudget(input, {next: index, pause: Math.min(pause, 0.9)});
}

/**
 * Whether the words a step just put on screen are worth a sound: some letters,
 * not a card, and whether they end a sentence. The animal's own sounds follow
 * this (the apps' `onWordShown(isFirst, endsSentence)`). Null for a step that
 * showed no word.
 */
export function askPacerWordShown(chunk: string): {endsSentence: boolean} | null {
    if (!/\p{L}/u.test(chunk) || chunk.includes("```")) return null;
    const last = lastNonSpace(chunk);
    return {endsSentence: last !== null && SENTENCE_END.includes(last)};
}

/**
 * Runs the steps to the end without waiting, for tests and for a quick look
 * at how long a reply takes to type out at a given pace.
 */
export function askPacerTimeline(target: string, options: {typingCps: number; pace: AskPacerPace; budget?: number | null}): AskPacerStep[] {
    const steps: AskPacerStep[] = [];
    let shown = 0;
    // The clock starts once the first words are on screen, as the hook runs it; `budget: null` runs unbounded.
    let elapsed: number | undefined;
    while (shown < target.length) {
        const step = askPacerStep({
            target,
            shown,
            sourceDone: true,
            instant: false,
            typingCps: options.typingCps,
            pace: options.pace,
            ...(options.budget === null ? {} : {elapsed, budget: options.budget})
        });
        if (step.next <= shown) break;
        steps.push(step);
        shown = step.next;
        elapsed = (elapsed ?? 0) + step.pause;
    }
    return steps;
}
