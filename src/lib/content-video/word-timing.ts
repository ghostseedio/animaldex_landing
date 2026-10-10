// When each caption word is spoken, for the word-by-word highlight.
//
// Best: real word times from a forced aligner (ElevenLabs), matched back onto
// the script's words. Otherwise an estimate built on the recorded audio: the
// line's actual pauses are found in the waveform and the script's clause
// breaks are pinned to them, then words share each stretch of speech by how
// many syllables they take to say ("610,000" is six-hundred-ten-thousand).

export type WordTime = {word: string; start: number; end: number};
export type Span = {start: number; end: number};
export type AlignedWord = {text: string; start: number; end: number};

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function underThousand(value: number): string {
    const hundreds = Math.floor(value / 100);
    const rest = value % 100;
    const restWords = rest < 20 ? (rest ? ONES[rest] : "") : `${TENS[Math.floor(rest / 10)]} ${rest % 10 ? ONES[rest % 10] : ""}`;
    return `${hundreds ? `${ONES[hundreds]} hundred ` : ""}${restWords}`.trim();
}

/** How a number is read aloud, roughly (years as "twenty twenty-four"). */
export function numberWords(value: number): string {
    if (!Number.isFinite(value)) return "";
    if (value >= 1100 && value <= 2099 && Number.isInteger(value) && value % 100 !== 0) {
        return `${underThousand(Math.floor(value / 100))} ${underThousand(value % 100)}`;
    }
    const whole = Math.floor(Math.abs(value));
    if (whole === 0) return "zero";
    const scales: Array<[number, string]> = [[1e12, "trillion"], [1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];
    let remaining = whole;
    const parts: string[] = [];
    for (const [size, name] of scales) {
        if (remaining >= size) {
            parts.push(`${underThousand(Math.floor(remaining / size))} ${name}`);
            remaining %= size;
        }
    }
    if (remaining) parts.push(underThousand(remaining));
    const decimals = String(value).split(".")[1];
    return `${parts.join(" ")}${decimals ? ` point ${decimals.split("").map((digit) => ONES[Number(digit)]).join(" ")}` : ""}`;
}

function syllablesOfWord(word: string): number {
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!clean) return 0;
    if (clean.length <= 3) return 1;
    const groups = clean.replace(/(?:[^laeiouy]es|[^dtr]ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
    return Math.max(groups?.length ?? 1, 1);
}

/** Syllables it takes to say a script token, numbers and symbols included. */
export function spokenSyllables(token: string): number {
    const core = token.replace(/^[^\p{L}\p{N}$£€]+|[^\p{L}\p{N}%]+$/gu, "");
    if (!core) return 0;
    const number = core.replace(/[$£€,]/g, "").match(/^(\d+(?:\.\d+)?)(%|k|m|x)?$/i);
    if (number) {
        const suffix = (number[2] ?? "").toLowerCase();
        const extra = suffix === "%" ? 2 : suffix === "k" ? 2 : suffix === "m" ? 2 : suffix === "x" ? 1 : 0;
        const currency = /^[$£€]/.test(core) ? 2 : 0;
        return numberWords(Number(number[1])).split(/\s+/).reduce((sum, part) => sum + syllablesOfWord(part), 0) + extra + currency;
    }
    return core.split(/[-–]/).reduce((sum, part) => sum + syllablesOfWord(part), 0) || 1;
}

/**
 * The stretches of a 16-bit mono PCM line that are speech: 10 ms frames above
 * a level relative to the loudest, with pauses under `minGap` bridged
 * (0.16 s measured best against true word times: ~90 ms mean error).
 */
export function speechSpans(pcm: Buffer, sampleRate: number, minGap = 0.16): Span[] {
    const frame = Math.max(1, Math.round(sampleRate * 0.01));
    const samples = Math.floor(pcm.length / 2);
    const levels: number[] = [];
    for (let offset = 0; offset < samples; offset += frame) {
        let sum = 0;
        const stop = Math.min(offset + frame, samples);
        for (let index = offset; index < stop; index += 1) {
            const value = pcm.readInt16LE(index * 2);
            sum += value * value;
        }
        levels.push(Math.sqrt(sum / Math.max(stop - offset, 1)));
    }
    const peak = Math.max(...levels, 1);
    const threshold = peak * 0.06;
    const spans: Span[] = [];
    let open: number | null = null;
    levels.forEach((level, index) => {
        if (level >= threshold && open === null) open = index;
        if (level < threshold && open !== null) {
            spans.push({start: open * 0.01, end: index * 0.01});
            open = null;
        }
    });
    if (open !== null) spans.push({start: open * 0.01, end: levels.length * 0.01});
    const merged: Span[] = [];
    for (const span of spans) {
        const last = merged.at(-1);
        if (last && span.start - last.end < minGap) last.end = span.end;
        else merged.push({...span});
    }
    return merged.filter((span) => span.end - span.start >= 0.06);
}

function normalize(token: string) {
    return token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** Spreads words over [start, end] by syllables. */
function spread(words: string[], start: number, end: number): WordTime[] {
    const weights = words.map((word) => Math.max(spokenSyllables(word), 1) + 0.35);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = start;
    return words.map((word, index) => {
        const length = ((end - start) * weights[index]) / total;
        const timed = {word, start: cursor, end: cursor + length};
        cursor += length;
        return timed;
    });
}

/**
 * Maps a forced aligner's words onto the script's words in order. Aligners
 * split and spell things their own way ("610,000" may come back as one token
 * or several), so script words are matched greedily by normalised text;
 * unmatched words borrow the gap around them. Null when too little matched.
 */
export function mapAlignedWords(words: string[], aligned: AlignedWord[]): WordTime[] | null {
    if (!aligned.length) return null;
    const result: Array<WordTime | null> = words.map(() => null);
    let cursor = 0;
    let matched = 0;
    words.forEach((word, index) => {
        const target = normalize(word);
        if (!target) return;
        for (let look = cursor; look < Math.min(cursor + 6, aligned.length); look += 1) {
            let joined = "";
            for (let span = look; span < Math.min(look + 6, aligned.length); span += 1) {
                joined += normalize(aligned[span].text);
                if (joined === target) {
                    result[index] = {word, start: aligned[look].start, end: aligned[span].end};
                    cursor = span + 1;
                    matched += 1;
                    return;
                }
                if (!target.startsWith(joined)) break;
            }
        }
    });
    if (matched < words.length * 0.6) return null;
    // Fill the gaps: unmatched words share the time between their matched neighbours.
    for (let index = 0; index < words.length; index += 1) {
        if (result[index]) continue;
        let next = index;
        while (next < words.length && !result[next]) next += 1;
        const from = index > 0 ? result[index - 1]!.end : aligned[0].start;
        const to = next < words.length ? result[next]!.start : aligned.at(-1)!.end;
        spread(words.slice(index, next), from, Math.max(to, from + 0.05 * (next - index))).forEach((timed, offset) => {
            result[index + offset] = timed;
        });
        index = next - 1;
    }
    return result as WordTime[];
}

/**
 * Times a line's words (seconds from the start of the line). Uses the
 * aligner's words when they map, else pins clause breaks to the recording's
 * pauses, else spreads by syllables over the whole line.
 */
export function timeLineWords(narration: string, seconds: number, options: {aligned?: AlignedWord[] | null; spans?: Span[] | null} = {}): WordTime[] {
    const words = narration.split(/\s+/).filter(Boolean);
    if (!words.length || seconds <= 0) return [];
    const fromAligner = options.aligned ? mapAlignedWords(words, options.aligned) : null;
    if (fromAligner) return fromAligner.map((timed) => ({...timed, start: round2(timed.start), end: round2(timed.end)}));

    const spans = (options.spans ?? []).filter((span) => span.start < seconds);
    if (!spans.length) return spread(words, 0, seconds).map(rounded);

    // Clauses end at punctuation; each break should land in a real pause.
    const clauses: string[][] = [[]];
    words.forEach((word, index) => {
        clauses.at(-1)!.push(word);
        if (/[.,!?;:—–]$/.test(word) && index < words.length - 1) clauses.push([]);
    });
    const speechStart = spans[0].start;
    const speechEnd = Math.min(spans.at(-1)!.end, seconds);
    const gaps = spans.slice(1).map((span, index) => ({start: spans[index].end, end: span.start}));
    const syllables = clauses.map((clause) => clause.reduce((sum, word) => sum + Math.max(spokenSyllables(word), 1), 0));
    const totalSyllables = syllables.reduce((sum, count) => sum + count, 0);

    const bounds: Span[] = [];
    let used = 0;
    let previousEnd = speechStart;
    let elapsed = 0;
    clauses.forEach((_, index) => {
        elapsed += syllables[index];
        if (index === clauses.length - 1) {
            bounds.push({start: previousEnd, end: speechEnd});
            return;
        }
        const expected = speechStart + ((speechEnd - speechStart) * elapsed) / totalSyllables;
        // The nearest unused pause after the last one, if it is plausibly this break.
        let best = -1;
        for (let gap = used; gap < gaps.length; gap += 1) {
            const middle = (gaps[gap].start + gaps[gap].end) / 2;
            if (Math.abs(middle - expected) <= 0.7 && (best < 0 || Math.abs(middle - expected) < Math.abs((gaps[best].start + gaps[best].end) / 2 - expected))) best = gap;
        }
        if (best >= 0) {
            bounds.push({start: previousEnd, end: gaps[best].start});
            previousEnd = gaps[best].end;
            used = best + 1;
        } else {
            bounds.push({start: previousEnd, end: expected});
            previousEnd = expected;
        }
    });
    return clauses.flatMap((clause, index) => spread(clause, bounds[index].start, Math.max(bounds[index].end, bounds[index].start + 0.1))).map(rounded);
}

function round2(value: number) {
    return Math.round(value * 100) / 100;
}

function rounded(timed: WordTime): WordTime {
    return {...timed, start: round2(timed.start), end: round2(timed.end)};
}
