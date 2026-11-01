/**
 * What the browser's recognizer heard, as one line (2026-11-01).
 *
 * The Web Speech API hands over a list of results, and a call or a dictation
 * may run several recognition sessions in a row (the browser ends one after a
 * silence). Gluing those pieces end to end ran words together ("doingCommon")
 * and, where a recognizer re-sends what it already said (results that each
 * hold the whole sentence so far, or a new session repeating the last one),
 * said everything twice. Each piece here is joined with a space, and a piece
 * that only repeats what is already there is not added again.
 */

function words(text: string): string[] {
    return text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

function comparable(word: string): string {
    return word.toLocaleLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
}

/** `head` begins with every word of `prefix`, ignoring case and punctuation. */
function startsWithWords(head: string[], prefix: string[]): boolean {
    if (prefix.length === 0 || prefix.length > head.length) return false;
    return prefix.every((word, index) => comparable(word) === comparable(head[index]));
}

/** `tail` ends with every word of `suffix`, ignoring case and punctuation. */
function endsWithWords(tail: string[], suffix: string[]): boolean {
    if (suffix.length === 0 || suffix.length > tail.length) return false;
    const offset = tail.length - suffix.length;
    return suffix.every((word, index) => comparable(word) === comparable(tail[offset + index]));
}

export function joinHeard(pieces: ReadonlyArray<string | null | undefined>): string {
    let heard: string[] = [];
    for (const piece of pieces) {
        const next = words(piece ?? "");
        if (next.length === 0) continue;
        if (heard.length === 0) {
            heard = next;
        } else if (startsWithWords(next, heard)) {
            // The whole sentence so far, said again with more: it replaces what was there.
            heard = next;
        } else if (!endsWithWords(heard, next)) {
            heard = [...heard, ...next];
        }
    }
    return heard.join(" ");
}

/** The transcripts of a recognition event's results, in order. */
export function resultTranscripts(results: {length: number; [index: number]: {0?: {transcript: string}}}): string[] {
    const transcripts: string[] = [];
    for (let index = 0; index < results.length; index += 1) transcripts.push(results[index]?.[0]?.transcript ?? "");
    return transcripts;
}
