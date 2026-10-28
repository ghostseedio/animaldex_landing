/**
 * Lights up the word the animal is saying.
 *
 * The server speaks a reply without its drawings and markdown
 * (`animal-chat-speech`, ElevenLabs /with-timestamps), and says when each word
 * is said. Each spoken word is matched, in order, to the word it is on screen;
 * a clip spoken before the server timed its words gets times spread over the
 * clip instead.
 *
 * Port of `AnimalChatSpokenWords` in the iOS app (AnimalDex 46ace4ce), with
 * its tests. Pure.
 */

import {askInlinePlainText, askMarkdownPlainText} from "@/lib/ask-animaldex/markdown";
import {askPlainBubbleText, askReplyPieces, type AskReplyPiece} from "@/lib/ask-animaldex/thread-layout";

/** When one word of a spoken reply is said, in seconds from the start of the clip. */
export type AskSpokenWord = {text: string; start: number; end: number};

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * The words of a text, in order, as [start, end) offsets: runs of non-space
 * characters that hold a letter or a digit (a lone dash is not a word).
 */
export function askWordRanges(text: string): Array<[number, number]> {
    const ranges: Array<[number, number]> = [];
    let start = -1;
    const close = (end: number) => {
        if (start >= 0 && LETTER_OR_DIGIT.test(text.slice(start, end))) ranges.push([start, end]);
        start = -1;
    };
    for (let index = 0; index < text.length; index += 1) {
        if (/\s/.test(text[index])) close(index);
        else if (start < 0) start = index;
    }
    close(text.length);
    return ranges;
}

export function askWords(text: string): string[] {
    return askWordRanges(text).map(([start, end]) => text.slice(start, end));
}

/**
 * What a bubble shows as plain characters: the same text the bubble is drawn
 * from, so word N here is word N on screen.
 */
export function askShownBubbleText(text: string, isPlain: boolean): string {
    return isPlain ? askInlinePlainText(askPlainBubbleText(text)) : askMarkdownPlainText(text);
}

/**
 * Every word of a reply in thread order, and where each piece's words start
 * in that list (one entry per piece; drawings are not spoken and hold none).
 */
export function askReplyWords(pieces: AskReplyPiece[]): {words: string[]; pieceStarts: number[]} {
    const words: string[] = [];
    const pieceStarts: number[] = [];
    for (const piece of pieces) {
        pieceStarts.push(words.length);
        if (piece.kind === "bubble") words.push(...askWords(askShownBubbleText(piece.text, piece.isPlain)));
    }
    return {words, pieceStarts};
}

/** Every word of a whole reply as the thread shows it. */
export function askReplyWordsOf(raw: string): string[] {
    return askReplyWords(askReplyPieces(raw, true)).words;
}

function key(word: string): string {
    return word
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .split("")
        .filter((character) => LETTER_OR_DIGIT.test(character))
        .join("");
}

/**
 * Each spoken word's place among the words on screen, matched in order on
 * letters and digits alone ("who's" = "Who’s"). A spoken word with nothing
 * close ahead (a symbol read out) lights nothing, and matching carries on
 * after it.
 */
export function askMatchSpokenWords(spoken: string[], shown: string[]): Array<number | null> {
    const shownKeys = shown.map(key);
    let next = 0;
    return spoken.map((word) => {
        const wanted = key(word);
        if (!wanted) return null;
        for (let probe = next; probe < Math.min(shownKeys.length, next + 6); probe += 1) {
            if (shownKeys[probe] === wanted) {
                next = probe + 1;
                return probe;
            }
        }
        return null;
    });
}

/**
 * The spoken word at `time`: the last one to have started, held through the
 * short silences between words. Null before the first word and once the last
 * has been said.
 */
export function askSpokenIndex(time: number, words: AskSpokenWord[]): number | null {
    if (words.length === 0 || time < words[0].start) return null;
    let low = 0;
    let high = words.length - 1;
    while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        if (words[mid].start <= time) low = mid;
        else high = mid - 1;
    }
    if (low === words.length - 1 && time > words[low].end + 0.35) return null;
    return low;
}

/**
 * Times for a clip without its own: the words spread over the clip by length,
 * with a beat after a sentence and a shorter one after a comma.
 */
export function askEstimatedSpokenWords(shown: string[], duration: number): AskSpokenWord[] {
    if (!(duration > 0) || shown.length === 0) return [];
    const weights = shown.map((word) => {
        const last = word[word.length - 1] ?? " ";
        const beat = ".!?…".includes(last) ? 4 : ",;:—".includes(last) ? 1.5 : 0;
        return word.length + 1 + beat;
    });
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let time = 0;
    return shown.map((text, index) => {
        const length = (duration * weights[index]) / total;
        const word = {text, start: time, end: time + length * 0.85};
        time += length;
        return word;
    });
}

/** The server's `words`, tolerantly: anything malformed is dropped, and so is an out-of-order list. */
export function parseAskSpokenWords(raw: unknown): AskSpokenWord[] | null {
    if (!Array.isArray(raw)) return null;
    const words = raw.flatMap((item): AskSpokenWord[] => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : null;
        const start = Number(row?.start);
        const end = Number(row?.end);
        if (typeof row?.text !== "string" || !Number.isFinite(start) || !Number.isFinite(end)) return [];
        return [{text: row.text, start, end}];
    });
    return words.length > 0 ? words : null;
}
