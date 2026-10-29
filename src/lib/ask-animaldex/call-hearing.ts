/**
 * Hearing a call turn without the browser's own recognizer (Firefox has no
 * Web Speech API): the browser decides when they have finished from the
 * echo-cancelled microphone's level, and the turn's audio is transcribed on
 * the server (`/api/ask/call-transcribe`, ElevenLabs speech to text). Pure,
 * for the tests; the browser side is `voice-call/call-server-listener.ts`.
 *
 * The turn rules are iOS's (`AnimalCallListener`), with the recognizer's
 * punctuation coming from the transcript instead of live:
 *
 *   - Someone is talking once the microphone is clearly above the room's own
 *     noise (10 dB) for 100 ms (a click is shorter); the 0.6 s before it is
 *     kept, as iOS keeps its last 0.6 s, so the first word is whole. The
 *     room's noise is the quietest the microphone has been over the last 3 s
 *     (minimum statistics): speech always dips to it between words, a fan or
 *     traffic never does, so a steady noise becomes the room within 3 s.
 *   - Half a second into a pause, what was said so far is transcribed. A
 *     pause after a finished sentence (the transcript ends . ? ! …) ends the
 *     turn at 1.3 s; a pause mid-sentence is thinking, and waits 2.4 s.
 *     Silence is measured from the level itself, so iOS's "the microphone
 *     still hears them" extension is built in.
 *   - A stretch that transcribes to no words was a noise, not talking: it is
 *     dropped and listening goes on. Nothing said for 15 s ends the listen.
 *   - Tapping sends what was said now; a turn longer than 30 s is sent then.
 *   - Over the animal's voice, someone talking has to be louder and longer
 *     (300 ms, 6 dB more), and what they say is transcribed every 0.7 s of
 *     their talking (three times an answer at most) without waiting for a
 *     pause, so the words that interrupt it are heard while they are said.
 *     Only words that are not the animal's own count (`wordsNotTheAnimals`):
 *     what echo cancellation leaves of its voice can be transcribed too.
 */

import {callPauseAfter, CALL_NOTHING_SAID_TIMEOUT_MS, heardWordCount} from "@/lib/ask-animaldex/call-events";

export const CALL_HEARING = {
    /** One level reading, and the unit of everything below. */
    frameMs: 20,
    /** What the transcription hears: 16 kHz, 16-bit, mono. */
    sampleRate: 16_000,
    /** Kept from before they began (iOS `AnimalCallAudio.keepSeconds`). */
    prerollMs: 600,
    /** Talking, not a click: this much voice, through the short dips between syllables. */
    onsetMs: 100,
    syllableGapMs: 100,
    /** Into a pause: what was said so far is transcribed. */
    probeAfterSilenceMs: 500,
    /** Sent then, however long they go on (and the route's cap). */
    maxTurnMs: 30_000,
    /** Over the animal: longer and louder before it counts as someone talking. */
    talkOverOnsetMs: 300,
    talkOverMarginDb: 6,
    /** Over the animal: transcribed after this much of their talking, without waiting for a pause. */
    talkOverProbeMs: 700,
    talkOverProbes: 3,
    /** Above the room's noise by this much, and never below the absolute floor, is someone talking. */
    aboveNoiseDb: 10,
    quietestVoiceDb: -52,
    /** The room's noise: the quietest frame over this long. */
    noiseWindowMs: 3_000,
    /** A transcription that takes longer than this has failed. */
    transcriptTimeoutMs: 10_000,
    /** Failures in a row before hearing gives up (each is retried). */
    failuresAllowed: 2
} as const;

export type HearingAction =
    /** Transcribe the turn's audio from `fromMs` to `toMs` (ms since the listen began) and hand back `id`. */
    | {kind: "transcribe"; id: number; fromMs: number; toMs: number}
    /** What they have said so far, to show. */
    | {kind: "heard"; text: string}
    /** The turn is over: what they said, or null for nothing. */
    | {kind: "finish"; text: string | null}
    /** Hearing cannot go on (transcription keeps failing). */
    | {kind: "fail"; reason: string};

type Pending = {id: number; toMs: number; requestedAt: number};
type Known = {toMs: number; text: string; hasWords: boolean};

/**
 * One listen: fed the microphone's level every 20 ms and the transcripts it
 * asked for, it says when to transcribe and when the turn is over.
 */
export class CallTurnDetector {
    /** The last 3 s of levels, for the room's noise (a quiet room until it has heard that much). */
    private readonly levels: number[] = new Array(CALL_HEARING.noiseWindowMs / CALL_HEARING.frameMs).fill(-65);
    private levelAt = 0;
    private run = 0;
    private gap = 0;
    private talking = false;
    private turnStart = -1;
    private lastVoice = -1;
    private voicedSinceProbe = 0;
    private overProbes = 0;
    private heard = "";
    private nextId = 1;
    private pending: Pending | null = null;
    private known: Known | null = null;
    private failures = 0;
    private finished = false;
    private sendNow = false;
    private animalTalking = false;
    private now = 0;

    /** Where the audio still needed starts (ms): the turn's start, or the last moment before anyone spoke. */
    get keepFromMs(): number {
        return this.turnStart >= 0 ? this.turnStart : Math.max(0, this.now - CALL_HEARING.prerollMs);
    }

    /** Someone has begun talking in this listen. */
    get hearsSomeone(): boolean {
        return this.talking || this.heard.length > 0;
    }

    get isFinished(): boolean {
        return this.finished;
    }

    /** The animal is speaking: someone talking over it must be louder and longer, and is heard sooner. */
    setAnimalTalking(on: boolean) {
        this.animalTalking = on;
    }

    /** The microphone's level for the 20 ms ending at `at` (ms since the listen began), in dBFS. */
    frame(decibels: number, at: number): HearingAction[] {
        this.now = at;
        if (this.finished) return [];
        const {frameMs} = CALL_HEARING;
        this.levels[this.levelAt] = Math.max(decibels, -90);
        this.levelAt = (this.levelAt + 1) % this.levels.length;
        const room = Math.min(Math.min(...this.levels), -30);
        const margin = this.animalTalking ? CALL_HEARING.talkOverMarginDb : 0;
        const threshold = Math.max(room + CALL_HEARING.aboveNoiseDb, CALL_HEARING.quietestVoiceDb) + margin;
        const voiced = decibels > threshold;
        if (!this.talking) {
            if (voiced) {
                this.run += frameMs;
                this.gap = 0;
            } else if (this.run > 0) {
                this.gap += frameMs;
                if (this.gap > CALL_HEARING.syllableGapMs) {
                    this.run = 0;
                    this.gap = 0;
                }
            }
            const needed = this.animalTalking ? CALL_HEARING.talkOverOnsetMs : CALL_HEARING.onsetMs;
            if (this.run >= needed) {
                this.talking = true;
                const onset = at - this.run - this.gap;
                if (this.turnStart < 0) this.turnStart = Math.max(0, onset - CALL_HEARING.prerollMs);
                this.lastVoice = at;
                this.voicedSinceProbe = this.run;
            } else {
                if (!this.heard && !this.pending && this.run === 0 && at >= CALL_NOTHING_SAID_TIMEOUT_MS) return this.finish(null);
                return this.decide();
            }
        } else if (voiced) {
            this.lastVoice = at;
            this.voicedSinceProbe += frameMs;
        }
        const actions: HearingAction[] = [];
        const silence = at - this.lastVoice;
        if (this.animalTalking && this.voicedSinceProbe >= CALL_HEARING.talkOverProbeMs && this.overProbes < CALL_HEARING.talkOverProbes && !this.pending) {
            this.overProbes += 1;
            this.voicedSinceProbe = 0;
            actions.push(this.request());
        }
        if (silence >= CALL_HEARING.probeAfterSilenceMs && !this.pending && !this.covers(this.known)) actions.push(this.request());
        if (at - this.turnStart >= CALL_HEARING.maxTurnMs && !this.sendNow) {
            this.sendNow = true;
            if (!this.pending) actions.push(this.request());
        }
        return [...actions, ...this.decide()];
    }

    /** The transcript asked for as `id`: its text, or null when it failed. */
    transcript(id: number, text: string | null): HearingAction[] {
        if (this.finished || !this.pending || this.pending.id !== id) return [];
        const asked = this.pending;
        this.pending = null;
        if (text === null) {
            this.failures += 1;
            if (this.failures > CALL_HEARING.failuresAllowed) {
                this.finished = true;
                return [{kind: "fail", reason: "transcription_failed"}];
            }
            return this.talking || this.sendNow ? [this.request(), ...this.decide()] : this.decide();
        }
        this.failures = 0;
        const said = text.replace(/\s+/g, " ").trim();
        const hasWords = heardWordCount(said) > 0;
        this.known = {toMs: asked.toMs, text: said, hasWords};
        const actions: HearingAction[] = [];
        if (hasWords && said !== this.heard) {
            this.heard = said;
            actions.push({kind: "heard", text: said});
        }
        // Sending now, and they went on after that transcript's audio: once more, to the end (never past the longest turn).
        if (this.sendNow && !this.covers(this.known) && !this.atLongest()) actions.push(this.request());
        return [...actions, ...this.decide()];
    }

    /** They tapped: what they have said, now. */
    finishNow(): HearingAction[] {
        if (this.finished) return [];
        if (!this.talking && !this.heard) return this.finish(null);
        this.sendNow = true;
        if (this.pending) return [];
        if (this.covers(this.known)) return this.decide();
        return [this.request(), ...this.decide()];
    }

    private covers(known: Known | null): boolean {
        return Boolean(known && known.toMs >= this.lastVoice);
    }

    /** The turn has reached the longest that is sent. */
    private atLongest(): boolean {
        return this.turnStart >= 0 && this.now - this.turnStart >= CALL_HEARING.maxTurnMs;
    }

    private request(): HearingAction {
        const id = this.nextId++;
        const from = Math.max(0, this.turnStart);
        const to = Math.min(this.now, from + CALL_HEARING.maxTurnMs);
        this.pending = {id, toMs: to, requestedAt: this.now};
        return {kind: "transcribe", id, fromMs: from, toMs: to};
    }

    private finish(text: string | null): HearingAction[] {
        this.finished = true;
        return [{kind: "finish", text: text && text.trim() ? text.trim() : null}];
    }

    private decide(): HearingAction[] {
        if (this.finished) return [];
        if (this.pending && this.now - this.pending.requestedAt > CALL_HEARING.transcriptTimeoutMs) {
            return this.transcript(this.pending.id, null);
        }
        if (!this.talking) return [];
        const current = this.covers(this.known);
        if (this.sendNow) return !this.pending && (current || this.atLongest()) ? this.finish(this.heard || null) : [];
        if (!current || !this.known) return [];
        if (!this.known.hasWords && !this.heard) {
            // A noise (or the animal's own voice, faintly): nothing was said. Listen on.
            this.talking = false;
            this.turnStart = -1;
            this.run = 0;
            this.gap = 0;
            this.known = null;
            return [];
        }
        const silence = this.now - this.lastVoice;
        return silence >= callPauseAfter(this.heard, {punctuates: true}) ? this.finish(this.heard) : [];
    }
}

/**
 * The microphone at the context's rate, down to 16 kHz: each output sample
 * the mean of the input it stands for (a box filter as wide as the step,
 * enough against aliasing for speech), carried across pieces.
 */
export class CallDownsampler {
    private readonly step: number;
    private position = 0;
    private sum = 0;
    private count = 0;

    constructor(inputRate: number, outputRate: number = CALL_HEARING.sampleRate) {
        this.step = inputRate / outputRate;
    }

    push(input: Float32Array): Int16Array {
        const out: number[] = [];
        for (let i = 0; i < input.length; i++) {
            this.sum += input[i];
            this.count += 1;
            this.position += 1;
            if (this.position >= this.step) {
                this.position -= this.step;
                const value = Math.max(-1, Math.min(1, this.sum / this.count));
                out.push(Math.round(value < 0 ? value * 32768 : value * 32767));
                this.sum = 0;
                this.count = 0;
            }
        }
        return Int16Array.from(out);
    }
}

/** RMS level of 16-bit samples, in dBFS. */
export function pcmDecibels(samples: Int16Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
        const value = samples[i] / 32768;
        sum += value * value;
    }
    return 10 * Math.log10(Math.max(sum / Math.max(samples.length, 1), 1e-9));
}

/** A 16-bit mono WAV file of `samples` at `sampleRate`. */
export function encodeWav(samples: Int16Array, sampleRate: number = CALL_HEARING.sampleRate): Uint8Array {
    const bytes = new Uint8Array(44 + samples.length * 2);
    const view = new DataView(bytes.buffer);
    const ascii = (at: number, text: string) => {
        for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
    };
    ascii(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    ascii(8, "WAVE");
    ascii(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    ascii(36, "data");
    view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true);
    return bytes;
}

export type WavInfo = {sampleRate: number; channels: number; bitsPerSample: number; format: number; dataBytes: number; seconds: number};

/** The format of a WAV file, from its chunks; null when it is not one. */
export function parseWav(bytes: Uint8Array): WavInfo | null {
    if (bytes.length < 44) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (at: number) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
    if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
    let at = 12;
    let fmt: Omit<WavInfo, "dataBytes" | "seconds"> | null = null;
    while (at + 8 <= bytes.length) {
        const id = tag(at);
        const size = view.getUint32(at + 4, true);
        const body = at + 8;
        if (id === "fmt " && size >= 16 && body + 16 <= bytes.length) {
            fmt = {
                format: view.getUint16(body, true),
                channels: view.getUint16(body + 2, true),
                sampleRate: view.getUint32(body + 4, true),
                bitsPerSample: view.getUint16(body + 14, true)
            };
        } else if (id === "data") {
            if (!fmt) return null;
            const dataBytes = Math.min(size, bytes.length - body);
            const bytesPerSecond = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8);
            return {...fmt, dataBytes, seconds: bytesPerSecond > 0 ? dataBytes / bytesPerSecond : 0};
        }
        at = body + size + (size % 2);
    }
    return null;
}

/** A word as compared: lower case, no accents, no punctuation. */
function wordKey(word: string): string {
    return word.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
}

/**
 * How many of the words heard over the animal are not its own: what echo
 * cancellation leaves of its voice can be transcribed too, and must not stop
 * it. Words it said in this answer do not count; any others do.
 */
export function wordsNotTheAnimals(heard: string, animalWords: string[]): number {
    const its = new Set(animalWords.map(wordKey).filter(Boolean));
    return heard.split(/\s+/).map(wordKey).filter((word) => word && !its.has(word)).length;
}
