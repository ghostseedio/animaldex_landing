/**
 * How a conversation with an animal is laid out, kept apart from the drawer
 * so it can be tested: a reply becomes a run of message bubbles, the way
 * someone texting sends one thought at a time, and the drawings it offers sit
 * beside the bubbles instead of inside them.
 *
 * Port of `AnimalChatReplyLayout` and `AnimalChatTimeline` in the iOS app
 * (`AnimalChatThreadLayout.swift`, AnimalDex bdfaccde): the one-to-one chat as
 * a messenger. Pure.
 */

import {decodeAskVisual, isAskVisualLanguage} from "@/lib/ask-animaldex/visuals";

/** One piece of an animal's reply as the thread shows it. */
export type AskReplyPiece =
    /**
     * A message bubble. `isPlain` is one paragraph of prose, drawn as text
     * that hugs its words; anything with structure (a list, a heading, a
     * table, code) is drawn by the markdown renderer at the column width.
     */
    | {kind: "bubble"; text: string; isPlain: boolean}
    /** A drawing (a fenced `animaldex-*` block), drawn on its own. */
    | {kind: "visual"; source: string};

type LineKind = "prose" | "list" | "table" | "quote" | "heading" | "code";

type Block =
    /** A run of non-blank lines (a code fence keeps its blank lines). */
    | {kind: "text"; lines: string[]}
    /** A fenced visual, whole or still arriving. */
    | {kind: "visual"; source: string; isClosed: boolean};

function kindOf(line: string): LineKind {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) return "code";
    if (trimmed.startsWith("#")) return "heading";
    if (trimmed.startsWith(">")) return "quote";
    if (trimmed.startsWith("|") && trimmed.slice(1).includes("|")) return "table";
    for (const marker of ["- ", "* ", "• ", "– ", "— "]) {
        if (trimmed.startsWith(marker)) return "list";
    }
    const digits = /^\d{1,2}/.exec(trimmed)?.[0] ?? "";
    if (digits && !/^\d{3}/.test(trimmed)) {
        const rest = trimmed.slice(digits.length);
        if (rest.startsWith(". ") || rest.startsWith(") ")) return "list";
    }
    return "prose";
}

/** Belongs to the bubble before it rather than starting its own. */
function continuesPrevious(kind: LineKind): boolean {
    return kind === "list" || kind === "table" || kind === "quote";
}

function blocksOf(raw: string): Block[] {
    const lines = raw.replace(/\r\n/g, "\n").split("\n");
    const blocks: Block[] = [];
    let current: string[] = [];
    let inCode = false;
    let visual: string[] | null = null;

    const flush = () => {
        if (current.length > 0) {
            blocks.push({kind: "text", lines: current});
            current = [];
        }
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (visual) {
            visual.push(line);
            if (trimmed.startsWith("```")) {
                blocks.push({kind: "visual", source: visual.join("\n"), isClosed: true});
                visual = null;
            }
            continue;
        }
        if (inCode) {
            current.push(line);
            if (trimmed.startsWith("```")) inCode = false;
            continue;
        }
        if (trimmed.startsWith("```")) {
            const language = trimmed.slice(3).trim().toLowerCase();
            if (isAskVisualLanguage(language)) {
                flush();
                visual = [line];
            } else {
                current.push(line);
                inCode = true;
            }
            continue;
        }
        if (!trimmed) {
            flush();
            continue;
        }
        current.push(line);
    }
    if (visual) blocks.push({kind: "visual", source: visual.join("\n"), isClosed: false});
    flush();
    return blocks;
}

function decodes(source: string): boolean {
    const lines = source.split("\n");
    const opening = lines.shift();
    if (opening === undefined) return false;
    const language = opening.trim().slice(3).trim().toLowerCase();
    if (lines.length > 0 && lines[lines.length - 1].trim().startsWith("```")) lines.pop();
    return decodeAskVisual(language, lines.join("\n")) !== null;
}

/**
 * Splits a reply into bubbles and drawings.
 *
 * Each paragraph is its own bubble. A list, table or quote stays with the
 * sentence that introduces it, and a heading keeps the paragraph under it, so
 * a thought is never split from its own points. Fenced code that is not a
 * drawing stays inside its bubble. `isComplete` is false while the reply is
 * still arriving: an unfinished drawing then stays as a placeholder; once
 * complete, a drawing that does not decode is dropped rather than leaving a
 * gap.
 */
export function askReplyPieces(raw: string, isComplete: boolean): AskReplyPiece[] {
    const pieces: AskReplyPiece[] = [];
    // Whether the last bubble holds only a heading, so the paragraph under it joins it.
    let lastBubbleIsHeadingOnly = false;

    for (const block of blocksOf(raw)) {
        if (block.kind === "visual") {
            if ((block.isClosed || isComplete) && !decodes(block.source)) continue;
            pieces.push({kind: "visual", source: block.source});
            lastBubbleIsHeadingOnly = false;
            continue;
        }
        const text = block.lines.join("\n");
        const kind = kindOf(block.lines[0]);
        const previous = pieces[pieces.length - 1];
        if (previous?.kind === "bubble" && (continuesPrevious(kind) || lastBubbleIsHeadingOnly)) {
            pieces[pieces.length - 1] = {kind: "bubble", text: `${previous.text}\n\n${text}`, isPlain: false};
            lastBubbleIsHeadingOnly = false;
            continue;
        }
        const isPlain = block.lines.every((line) => kindOf(line) === "prose");
        pieces.push({kind: "bubble", text, isPlain});
        lastBubbleIsHeadingOnly = kind === "heading" && block.lines.length === 1;
    }
    return pieces;
}

/**
 * The text of a plain bubble as one run: the markdown renderer joins a
 * paragraph's lines with spaces, and so does the bubble.
 */
export function askPlainBubbleText(bubble: string): string {
    return bubble
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join(" ");
}

// MARK: - Timeline

/** A pause this long between two messages starts a new sitting. */
export const ASK_SITTING_GAP_MS = 60 * 60 * 1000;
/** The animal's suggested replies go stale after this. */
export const ASK_SUGGESTION_FRESHNESS_MS = 12 * 60 * 60 * 1000;

function sameDay(left: Date, right: Date): boolean {
    return left.getFullYear() === right.getFullYear()
        && left.getMonth() === right.getMonth()
        && left.getDate() === right.getDate();
}

/**
 * Which messages get a time above them, the way a messenger marks a
 * conversation picked up again later. A conversation that is all one sitting
 * today shows none; otherwise every sitting is marked, including the first,
 * so no stretch of the thread is undated.
 */
export function askLabelledIndices(dates: Date[], now: Date = new Date()): Set<number> {
    const indices = new Set<number>();
    if (dates.length === 0) return indices;
    for (let index = 1; index < dates.length; index += 1) {
        if (dates[index].getTime() - dates[index - 1].getTime() >= ASK_SITTING_GAP_MS) indices.add(index);
    }
    if (indices.size > 0 || !sameDay(dates[0], now)) indices.add(0);
    return indices;
}

/**
 * "Today 14:02", "Yesterday 18:40", "Monday 09:15", "Mon 12 Oct 09:15", in the
 * reader's language. `today` and `yesterday` are the drawer's own words.
 */
export function askTimeLabel(
    date: Date,
    options: {locale: string; today: string; yesterday: string; now?: Date}
): string {
    const now = options.now ?? new Date();
    const clock = new Intl.DateTimeFormat(options.locale, {hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).format(date);
    if (sameDay(date, now)) return `${options.today} ${clock}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (sameDay(date, yesterday)) return `${options.yesterday} ${clock}`;
    const days = (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000);
    if (days < 7) {
        return `${new Intl.DateTimeFormat(options.locale, {weekday: "long"}).format(date)} ${clock}`;
    }
    const day = new Intl.DateTimeFormat(options.locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
        ...(date.getFullYear() === now.getFullYear() ? {} : {year: "numeric"})
    }).format(date);
    return `${day} ${clock}`;
}
