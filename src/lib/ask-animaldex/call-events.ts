/**
 * A voice call's side of the stream, as the browser reads it: the events a
 * call turn adds to the chat's own (`call_voice`, `audio`, `words`, in the
 * edge function's shapes), the words of a reply, and the turn-taking rules.
 *
 * Mirrors the iOS client: `AnimalChatStreamFrame.singleEvent` and
 * `AnimalCallVoiceInfo` (SupabaseAppliedInsightService.swift), the spoken
 * transcript's word cursor (`AnimalCallSpokenText`), and the listener's
 * pauses (`AnimalCallListener`). Pure, for the tests.
 */

/** On a call, before the animal's voice: whether it will be heard, and how to play it. */
export type CallVoiceInfo = {
    available: boolean;
    /** `speech_limit_reached` (today's spoken replies are used) or `voice_unavailable`. */
    reason: string | null;
    /** Playback rate: the animal's pace, for voice models that can't set it. */
    rate: number | null;
    sampleRate: number | null;
    label: string | null;
};

/** When one word of the answer is heard, in seconds from the start of the answer's audio. */
export type CallSpokenWord = {text: string; start: number; end: number};

export type CallStreamEvent =
    | {kind: "voice"; info: CallVoiceInfo}
    /** The next piece of the animal's voice, 16-bit mono PCM. */
    | {kind: "audio"; pcm: Int16Array}
    /** A sentence's words, timed from the start of the answer's audio. */
    | {kind: "words"; words: CallSpokenWord[]};

function finite(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Little-endian 16-bit PCM from base64. */
export function decodePcm16(base64: string): Int16Array {
    const binary = atob(base64);
    const frames = Math.floor(binary.length / 2);
    const out = new Int16Array(frames);
    for (let i = 0; i < frames; i++) {
        const value = binary.charCodeAt(2 * i) | (binary.charCodeAt(2 * i + 1) << 8);
        out[i] = value >= 0x8000 ? value - 0x10000 : value;
    }
    return out;
}

function parseWords(raw: unknown): CallSpokenWord[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry): CallSpokenWord[] => {
        if (!entry || typeof entry !== "object") return [];
        const row = entry as Record<string, unknown>;
        const start = finite(row.start);
        const end = finite(row.end);
        return typeof row.text === "string" && row.text && start !== null && end !== null ? [{text: row.text, start, end}] : [];
    });
}

/**
 * The call reading of one stream frame, or null when it is the chat's own
 * (text, `done`, the persona) or malformed. The same precedence as iOS:
 * `done` and text first, then audio, the voice, the words.
 */
export function callEventFrom(frame: Record<string, unknown>): CallStreamEvent | null {
    if (frame.done === true) return null;
    if (typeof frame.delta === "string" && frame.delta) return null;
    if (typeof frame.audio === "string" && frame.audio) {
        let pcm: Int16Array;
        try {
            pcm = decodePcm16(frame.audio);
        } catch {
            return null;
        }
        return pcm.length > 0 ? {kind: "audio", pcm} : null;
    }
    const voice = frame.call_voice;
    if (voice && typeof voice === "object") {
        const row = voice as Record<string, unknown>;
        return {
            kind: "voice",
            info: {
                available: row.available === true,
                reason: typeof row.reason === "string" ? row.reason : null,
                rate: finite(row.rate),
                sampleRate: finite(row.sample_rate),
                label: typeof row.label === "string" ? row.label : null
            }
        };
    }
    const words = parseWords(frame.words);
    return words.length > 0 ? {kind: "words", words} : null;
}

/** Whether a frame belongs to the call (and so never to the thread). */
export function isCallFrame(frame: Record<string, unknown>): boolean {
    return callEventFrom(frame) !== null;
}

/** How many words they have said so far: a noise is not talking over the animal. */
export function heardWordCount(partial: string): number {
    return partial.split(/\s+/).filter(Boolean).length;
}

/**
 * The word being heard: the last to have started; -1 before the first
 * (`AnimalCallSpokenText.follow`).
 */
export function callSpokenIndex(words: CallSpokenWord[], seconds: number): number {
    for (let index = words.length - 1; index >= 0; index--) {
        if (words[index].start <= seconds) return index;
    }
    return -1;
}

/** Words it must hear before it stops for them (owner, 2026-10-28: it paused for background noise). */
export const CALL_TALKING_OVER_WORDS = 2;
/**
 * A breath between sentences is shorter than this; the end of a turn longer.
 * The recognizer puts a full stop at a thinking pause too, so even after one
 * it waits a moment (owner, 2026-10-28: it cut in while they were thinking).
 */
export const CALL_END_OF_TURN_SILENCE_MS = 1300;
/** A pause where the sentence isn't finished yet: they are thinking. */
export const CALL_MID_SENTENCE_SILENCE_MS = 2400;
/** Louder than this, they are still talking (a word the recognizer hasn't caught up with). */
export const CALL_STILL_TALKING_DECIBELS = -38;
export const CALL_NOTHING_SAID_TIMEOUT_MS = 15_000;

/**
 * How long a pause after this means they are done. A recognizer that
 * punctuates ends a sentence only when one is complete: without that, they
 * are mid-thought, so it waits for them (owner, 2026-10-28: the animal spoke
 * while they paused to think). One that never punctuates (Chrome's) marks
 * the same moment by settling what it heard, so a settled result counts as
 * the finished sentence there.
 */
export function callPauseAfter(heard: string, options: {settled?: boolean; punctuates?: boolean} = {}): number {
    const text = heard.trim();
    if (!text) return CALL_END_OF_TURN_SILENCE_MS;
    if (/[.?!…]$/.test(text)) return CALL_END_OF_TURN_SILENCE_MS;
    if (options.settled && !options.punctuates) return CALL_END_OF_TURN_SILENCE_MS;
    return CALL_MID_SENTENCE_SILENCE_MS;
}

/** RMS level of each window of samples, in dBFS (`AnimalCallVoicePlayer.loudness`). */
export function loudness(samples: Float32Array, window: number): number[] {
    const levels: number[] = [];
    for (let start = 0; start < samples.length; start += window) {
        const end = Math.min(start + window, samples.length);
        let sum = 0;
        for (let i = start; i < end; i++) sum += samples[i] * samples[i];
        levels.push(10 * Math.log10(Math.max(sum / (end - start), 1e-9)));
    }
    return levels;
}

/** The call's clock: 0:07, 12:30. */
export function callClock(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
