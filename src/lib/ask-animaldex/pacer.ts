/**
 * How the animal's reply is typed out: at its own pace, a word at a time.
 *
 * Port of `AnimalReplyPacer.nextStep` in the iOS app
 * (`AnimalChatPresence.swift`). The network delivers tokens in bursts; the
 * reader sees words appear at the animal's `typing_cps` (from the persona
 * frame), with a breath after each sentence and a longer one between
 * paragraphs, so a slow animal reads slow and a quick one quick.
 *
 * The rules, all from the app:
 *   - never a half word: a word appears only once whatever follows it has
 *     arrived (or the reply is complete);
 *   - a card or drawing (a ``` fence) appears whole, once its closing fence
 *     has arrived;
 *   - `instant` (a click on the reply, Stop, reduced motion, a screen reader)
 *     shows everything received at once.
 *
 * One addition for the web, where markdown renders as it is revealed: a bold
 * phrase appears whole, so `**` is never shown waiting for its other half.
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
};

/** Where the next step ends, and how long to wait after it, in seconds. */
export type AskPacerStep = {next: number; pause: number};

/** Pace when no persona frame has arrived: the app's `AnimalChatPersona.standard`. */
export const ASK_PACER_DEFAULT = {typingCps: 13.5, pace: "measured" as AskPacerPace};

/** How long to look again while waiting for more of the reply. */
export const ASK_PACER_WAIT_SECONDS = 0.06;

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

export function askPacerStep(input: AskPacerInput): AskPacerStep {
    const {target, shown, sourceDone} = input;
    if (input.instant) return {next: target.length, pause: 0};

    let index = shown;
    while (index < target.length && isSpace(target[index])) index += 1;

    // A card or drawing appears whole once its closing fence has arrived.
    if (target.startsWith("```", index)) {
        const close = closingFence(target, index + 3);
        if (close !== null) return {next: close, pause: 0.3};
        return sourceDone ? {next: target.length, pause: 0} : {next: shown, pause: 0.08};
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
    let pause = chunk.length / Math.max(input.typingCps, 6);
    const last = lastNonSpace(chunk);
    if (last && SENTENCE_END.includes(last)) {
        pause += 0.34 * scale;
    } else if (last && CLAUSE_END.includes(last)) {
        pause += 0.12 * scale;
    }
    if (index + 1 < target.length && target[index] === "\n" && target[index + 1] === "\n") {
        pause += 0.3 * scale;
    }
    return {next: index, pause: Math.min(pause, 1.4)};
}

/**
 * Runs the steps to the end without waiting, for tests and for a quick look
 * at how long a reply takes to type out at a given pace.
 */
export function askPacerTimeline(target: string, options: {typingCps: number; pace: AskPacerPace}): AskPacerStep[] {
    const steps: AskPacerStep[] = [];
    let shown = 0;
    while (shown < target.length) {
        const step = askPacerStep({target, shown, sourceDone: true, instant: false, ...options});
        if (step.next <= shown) break;
        steps.push(step);
        shown = step.next;
    }
    return steps;
}
