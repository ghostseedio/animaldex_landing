/**
 * Speaks a call's reply sentence by sentence while it is still being written,
 * so the voice starts within about a second instead of after the whole reply.
 *
 * The web port of `CallVoiceStream` and `callSpeaker` in the apps' backend
 * (`_shared/animal-call-voice.ts`, `generate-applied-insight`): each sentence
 * goes to ElevenLabs' /stream/with-timestamps as raw 24 kHz 16-bit PCM,
 * several at once, and the audio comes back in order as SSE `audio` events
 * (base64), a short silence between sentences at the animal's pace. Once a
 * sentence has been voiced its words go out as a `words` event, timed in
 * seconds from the start of this answer's audio. A `call_voice` event says
 * first whether there will be a voice, and at what rate to play it. Nothing
 * is stored: a call is live.
 *
 * No `server-only`: the tests drive it with a fake ElevenLabs. It runs on the
 * Node runtime only (Buffer for base64).
 */

import {
    CALL_SAMPLE_RATE,
    pauseSeconds,
    SpokenSentences,
    spokenWords,
    type CallPace,
    type SpeechAlignment,
    type SpeechSettings
} from "@/lib/ask-animaldex/call-speech";

const CALL_OUTPUT_FORMAT = "pcm_24000";
const ELEVENLABS_TIMEOUT_MS = 20_000;

export type CallVoice = {
    voiceKey: string;
    label: string | null;
    elevenlabsVoiceId: string;
    model: string;
    settings: SpeechSettings;
    /** Playback rate on the listener's side: the speed a model that ignores it can't apply. */
    rate: number;
    pace: CallPace;
};

export type CallEventSink = (event: Record<string, unknown>) => void;

/** One sentence's audio, arriving from ElevenLabs. */
type Utterance = {
    chunks: Uint8Array[];
    /** Every character's timing, from the start of this sentence's audio. */
    alignment: SpeechAlignment;
    done: boolean;
    failed: boolean;
    wake: (() => void) | null;
};

/** Speaks sentences in order while later ones are already being voiced. */
export class CallVoiceStream {
    private queue: Utterance[] = [];
    private sentAny = false;
    /** Audio sent so far, in bytes: where the next sentence starts. */
    private sentBytes = 0;
    private aborted = false;
    private pump: Promise<void> | null = null;
    private previous = "";
    private readonly abort = new AbortController();

    constructor(
        private readonly voice: CallVoice,
        private readonly apiKey: string,
        private readonly send: CallEventSink,
        private readonly fetchImpl: typeof fetch = fetch
    ) {}

    /** True once some audio went out (the spoken reply was used). */
    get spoke(): boolean {
        return this.sentAny;
    }

    say(sentence: string): void {
        if (this.aborted || !sentence.trim()) return;
        const utterance: Utterance = {
            chunks: [],
            alignment: {characters: [], character_start_times_seconds: [], character_end_times_seconds: []},
            done: false,
            failed: false,
            wake: null
        };
        this.queue.push(utterance);
        const previous = this.previous;
        this.previous = `${previous} ${sentence}`.slice(-300);
        void this.synthesise(sentence, previous, utterance);
        this.pump ??= this.drain();
    }

    /** Resolves once every sentence said so far has been sent. */
    async finish(): Promise<void> {
        await (this.pump ?? Promise.resolve());
        // Sentences said while the last one was draining.
        if (this.queue.length > 0 && !this.aborted) {
            this.pump = this.drain();
            await this.pump;
        }
    }

    stop(): void {
        this.aborted = true;
        this.abort.abort();
        // A drain waiting on a sentence that will now never finish lets go.
        for (const utterance of this.queue) utterance.wake?.();
    }

    private async drain(): Promise<void> {
        while (this.queue.length > 0 && !this.aborted) {
            const utterance = this.queue[0];
            const startsAt = this.sentBytes / (CALL_SAMPLE_RATE * 2);
            for (;;) {
                while (utterance.chunks.length > 0) {
                    this.sendAudio(utterance.chunks.shift() as Uint8Array);
                }
                if (utterance.done || this.aborted) break;
                await new Promise<void>((resolve) => {
                    utterance.wake = resolve;
                });
                utterance.wake = null;
            }
            if (this.aborted) break;
            this.queue.shift();
            const words = utterance.alignment.characters.length > 0 ? spokenWords(utterance.alignment) : [];
            if (words.length > 0) {
                const at = (seconds: number) => Math.round((startsAt + seconds) * 1000) / 1000;
                this.send({words: words.map((word) => ({text: word.text, start: at(word.start), end: at(word.end)}))});
            }
            if (!utterance.failed && this.queue.length > 0) {
                this.sendAudio(silence(pauseSeconds(this.voice.pace)));
            }
        }
        this.pump = null;
    }

    private sendAudio(chunk: Uint8Array): void {
        this.send({audio: Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).toString("base64"), sample_rate: CALL_SAMPLE_RATE});
        this.sentBytes += chunk.length;
        this.sentAny = true;
    }

    private async synthesise(text: string, previousText: string, utterance: Utterance): Promise<void> {
        const wake = () => utterance.wake?.();
        try {
            const response = await this.fetchImpl(
                `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.voice.elevenlabsVoiceId)}/stream/with-timestamps?output_format=${CALL_OUTPUT_FORMAT}`,
                {
                    method: "POST",
                    headers: {"xi-api-key": this.apiKey, "Content-Type": "application/json", Accept: "application/json"},
                    body: JSON.stringify({
                        text,
                        model_id: this.voice.model,
                        voice_settings: {...this.voice.settings, use_speaker_boost: true},
                        ...(previousText.trim() ? {previous_text: previousText.trim()} : {})
                    }),
                    signal: eitherSignal(this.abort.signal, AbortSignal.timeout(ELEVENLABS_TIMEOUT_MS))
                }
            );
            if (!response.ok || !response.body) {
                console.warn("[ask-animaldex] call voice", response.status, (await response.text().catch(() => "")).slice(0, 200));
                utterance.failed = true;
                return;
            }
            // One JSON object a line: a piece of audio (base64 PCM) and the
            // timing of the characters it covers. About a tenth of a second of
            // audio per event; the first goes out as soon as it can.
            const target = CALL_SAMPLE_RATE * 2 / 10;
            let held: Uint8Array = new Uint8Array(0);
            let pending = "";
            const decoder = new TextDecoder();
            const reader = response.body.getReader();
            const take = (line: string) => {
                if (!line.trim()) return;
                let piece: Record<string, unknown>;
                try {
                    piece = JSON.parse(line) as Record<string, unknown>;
                } catch {
                    return;
                }
                const timing = piece.alignment as Partial<SpeechAlignment> | null | undefined;
                if (timing?.characters && timing.character_start_times_seconds && timing.character_end_times_seconds) {
                    utterance.alignment.characters.push(...timing.characters.map(String));
                    utterance.alignment.character_start_times_seconds.push(...timing.character_start_times_seconds.map(Number));
                    utterance.alignment.character_end_times_seconds.push(...timing.character_end_times_seconds.map(Number));
                }
                if (typeof piece.audio_base64 === "string" && piece.audio_base64) {
                    held = concat(held, new Uint8Array(Buffer.from(piece.audio_base64, "base64")));
                }
                const ready = held.length - (held.length % 2);
                if (ready >= (utterance.chunks.length === 0 ? target / 2 : target)) {
                    utterance.chunks.push(held.slice(0, ready));
                    held = held.slice(ready);
                    wake();
                }
            };
            for (;;) {
                const {done, value} = await reader.read();
                if (done) break;
                pending += decoder.decode(value, {stream: true});
                const lines = pending.split("\n");
                pending = lines.pop() ?? "";
                lines.forEach(take);
            }
            take(pending);
            const rest = held.length - (held.length % 2);
            if (rest > 0) utterance.chunks.push(held.slice(0, rest));
        } catch (error) {
            if (!this.aborted) console.warn("[ask-animaldex] call voice", error instanceof Error ? error.message : String(error));
            utterance.failed = utterance.chunks.length === 0;
        } finally {
            utterance.done = true;
            wake();
        }
    }
}

/** Aborts when either does (`AbortSignal.any`, which this TypeScript's DOM types predate). */
function eitherSignal(a: AbortSignal, b: AbortSignal): AbortSignal {
    if (a.aborted) return a;
    if (b.aborted) return b;
    const both = new AbortController();
    const abort = () => both.abort();
    a.addEventListener("abort", abort, {once: true});
    b.addEventListener("abort", abort, {once: true});
    return both.signal;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
    if (a.length === 0) return b;
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
}

function silence(seconds: number): Uint8Array {
    const frames = Math.round(CALL_SAMPLE_RATE * seconds);
    return new Uint8Array(frames * 2);
}

/** The voice and today's spoken reply for one call turn, looked up while the model starts. */
export type CallVoiceSetup = {
    voice: CallVoice | null;
    /** Today's spoken replies allowed this one. */
    allowed: boolean;
    allowance: Record<string, unknown> | null;
    refund: () => Promise<void>;
};

export type CallSpeaker = {
    /** More of the answer as shown. */
    hear: (text: string) => void;
    /** The answer is complete: resolves once all of it has been spoken. */
    finish: () => Promise<void>;
    stop: () => void;
};

/**
 * Speaks a call's answer sentence by sentence as it arrives. Sentences that
 * complete before the voice is ready wait for it. A `call_voice` event says
 * first whether there will be a voice, and at what rate to play it. One
 * spoken reply is taken up front and given back when nothing was heard.
 */
export function callSpeaker(
    ready: Promise<CallVoiceSetup>,
    send: CallEventSink,
    options: {apiKey: string | null; fetchImpl?: typeof fetch}
): CallSpeaker {
    const sentences = new SpokenSentences();
    const waiting: string[] = [];
    let stream: CallVoiceStream | null = null;
    let setup: CallVoiceSetup | null = null;
    let stopped = false;
    let refunded = false;
    // Nothing was heard after all: the spoken reply goes back, once.
    const refundIfSilent = async () => {
        const taken = setup;
        if (refunded || !taken?.allowed || !taken.voice || stream?.spoke) return;
        refunded = true;
        await taken.refund();
    };
    const started = ready.then((value) => {
        setup = value;
        if (stopped) {
            void refundIfSilent();
            return;
        }
        if (!value.voice || !value.allowed || !options.apiKey) {
            send({
                call_voice: {
                    available: false,
                    reason: value.voice && !value.allowed ? "speech_limit_reached" : "voice_unavailable",
                    allowance: value.allowance
                }
            });
            return;
        }
        send({
            call_voice: {available: true, rate: value.voice.rate, sample_rate: CALL_SAMPLE_RATE, label: value.voice.label}
        });
        stream = new CallVoiceStream(value.voice, options.apiKey, send, options.fetchImpl);
        for (const sentence of waiting.splice(0)) stream.say(sentence);
    });
    const say = (list: string[]) => {
        for (const sentence of list) {
            if (stream) stream.say(sentence);
            else waiting.push(sentence);
        }
    };
    return {
        hear: (text) => {
            if (!stopped) say(sentences.push(text));
        },
        finish: async () => {
            say(sentences.flush());
            await started;
            await stream?.finish();
            await refundIfSilent();
        },
        stop: () => {
            if (stopped) return;
            stopped = true;
            stream?.stop();
            // The person has gone or the answer failed: nothing heard, nothing spent.
            void started.then(refundIfSilent);
        }
    };
}
