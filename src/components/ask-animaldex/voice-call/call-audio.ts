/**
 * The call's sound: the microphone (for how loud they are) and the animal's
 * streamed voice, in one AudioContext.
 *
 * The web counterpart of the iOS `AnimalCallAudio` and
 * `AnimalCallVoicePlayer`. The microphone runs the whole call with echo
 * cancellation asked for, so it does not hear the animal; its level drives
 * the waves and tells the listener they are still talking. The voice arrives
 * as 16-bit PCM a tenth of a second at a time and is queued gaplessly as it
 * comes, at the animal's pace (`StreamingTimeStretch`). Each piece's loudness
 * (every 10 ms) is kept against when it plays, so the mouth follows what is
 * actually heard even if the stream falls behind, and the transcript knows
 * which word is being said.
 */

import {StreamingTimeStretch} from "@/lib/ask-animaldex/call-time-stretch";
import {loudness} from "@/lib/ask-animaldex/call-events";

type AudioContextConstructor = typeof AudioContext;

function audioContextConstructor(): AudioContextConstructor | null {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {AudioContext?: AudioContextConstructor; webkitAudioContext?: AudioContextConstructor};
    return w.AudioContext ?? w.webkitAudioContext ?? null;
}

let primed: AudioContext | null = null;

/**
 * Made and resumed inside the click that opens the call: browsers only let
 * sound start from a gesture, and the call screen mounts a moment after it.
 */
export function primeCallAudio(): AudioContext | null {
    if (primed && primed.state !== "closed") {
        void primed.resume().catch(() => undefined);
        return primed;
    }
    const Context = audioContextConstructor();
    if (!Context) return null;
    try {
        primed = new Context({latencyHint: "interactive"});
        void primed.resume().catch(() => undefined);
    } catch {
        primed = null;
    }
    return primed;
}

/** The context the click made, or a new one. */
export function callAudioContext(): AudioContext | null {
    return primeCallAudio();
}

const SILENT = -120;

function decibelsOf(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    return 10 * Math.log10(Math.max(sum / Math.max(samples.length, 1), 1e-9));
}

/** The microphone for the whole call. */
export class CallMicrophone {
    private stream: MediaStream | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private analyser: AnalyserNode | null = null;
    private readonly samples = new Float32Array(1024);
    /** Echo cancellation is on: the microphone does not hear the animal. */
    cancelsEcho = false;

    constructor(private readonly context: AudioContext) {}

    /** The echo-cancelled track, for a recognizer that can listen to it. */
    get track(): MediaStreamTrack | null {
        return this.stream?.getAudioTracks()[0] ?? null;
    }

    async start(): Promise<void> {
        if (this.stream) return;
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}
        });
        this.stream = stream;
        const track = stream.getAudioTracks()[0];
        this.cancelsEcho = track?.getSettings?.().echoCancellation === true;
        this.source = this.context.createMediaStreamSource(stream);
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 1024;
        // Measured, never played: it goes nowhere but the analyser.
        this.source.connect(this.analyser);
    }

    /** How loud they are now, in dBFS. */
    decibels(): number {
        if (!this.analyser) return SILENT;
        this.analyser.getFloatTimeDomainData(this.samples);
        return decibelsOf(this.samples);
    }

    stop() {
        this.source?.disconnect();
        this.analyser?.disconnect();
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
        this.source = null;
        this.analyser = null;
    }
}

type Piece = {
    /** When it starts playing, on the context's clock. */
    start: number;
    /** Where it sits in the answer's own audio, in seconds (before the pace is applied). */
    at: number;
    duration: number;
    levels: number[];
};

/** Plays the animal's streamed voice and reports how loud it is and how far in. */
export class CallVoicePlayer {
    static readonly levelStep = 0.01;

    private output: GainNode | null = null;
    private sources = new Set<AudioBufferSourceNode>();
    private pieces: Piece[] = [];
    private stretch: StreamingTimeStretch | null = null;
    private sampleRate = 24_000;
    private rate = 1;
    private scheduledEnd = 0;
    /** Output frames scheduled so far this answer. */
    private produced = 0;
    private queued = 0;
    private streamEnded = false;
    private drained: (() => void) | null = null;

    constructor(private readonly context: AudioContext) {}

    /** A streamed answer is playing. */
    get isStreaming(): boolean {
        return this.output !== null;
    }

    /** Ready for a streamed answer at this sample rate, played at `rate` (0.75–1.25, the pitch kept). */
    beginStream(sampleRate: number, rate: number) {
        this.stop();
        this.sampleRate = sampleRate > 0 ? sampleRate : 24_000;
        this.stretch = new StreamingTimeStretch(rate, this.sampleRate);
        this.rate = this.stretch.rate;
        const output = this.context.createGain();
        output.connect(this.context.destination);
        this.output = output;
        this.scheduledEnd = 0;
        this.produced = 0;
        this.queued = 0;
        this.streamEnded = false;
        this.pieces = [];
        void this.context.resume().catch(() => undefined);
    }

    /** The next piece of the voice: 16-bit mono PCM. */
    enqueue(pcm: Int16Array) {
        if (!this.output || !this.stretch) return;
        const samples = new Float32Array(pcm.length);
        for (let i = 0; i < pcm.length; i++) samples[i] = pcm[i] / 32768;
        this.schedule(this.stretch.push(samples));
    }

    private schedule(samples: Float32Array) {
        const output = this.output;
        if (!output || samples.length === 0) return;
        const buffer = this.context.createBuffer(1, samples.length, this.sampleRate);
        buffer.copyToChannel(samples, 0);
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(output);
        // With nothing queued it plays now; otherwise straight after the last piece.
        const now = this.context.currentTime;
        const start = this.queued === 0 ? Math.max(this.scheduledEnd, now + 0.03) : this.scheduledEnd;
        source.start(start);
        const duration = samples.length / this.sampleRate;
        this.scheduledEnd = start + duration;
        this.queued += 1;
        this.sources.add(source);
        this.pieces.push({
            start,
            at: this.produced / this.sampleRate * this.rate,
            duration,
            levels: loudness(samples, Math.max(1, Math.round(this.sampleRate * CallVoicePlayer.levelStep)))
        });
        this.produced += samples.length;
        source.onended = () => {
            this.sources.delete(source);
            this.queued = Math.max(0, this.queued - 1);
            if (this.queued === 0 && this.streamEnded) this.stop();
        };
    }

    /** Everything has arrived: resolves once it has all been heard (or the animal was interrupted). */
    finishStream(): Promise<void> {
        if (!this.output) return Promise.resolve();
        if (this.stretch) this.schedule(this.stretch.flush());
        this.streamEnded = true;
        if (this.queued === 0) {
            this.stop();
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.drained = resolve;
        });
    }

    stop() {
        for (const source of Array.from(this.sources)) {
            source.onended = null;
            try {
                source.stop();
            } catch {
                // Never started or already over.
            }
            source.disconnect();
        }
        this.sources.clear();
        this.output?.disconnect();
        this.output = null;
        this.stretch = null;
        this.pieces = [];
        this.queued = 0;
        const drained = this.drained;
        this.drained = null;
        drained?.();
    }

    /** The moment being heard now, on the context's clock (what is in the speakers, not what was handed over). */
    private heardNow(): number {
        const latency = (this.context as AudioContext & {outputLatency?: number}).outputLatency ?? this.context.baseLatency ?? 0;
        return this.context.currentTime - (Number.isFinite(latency) ? latency : 0);
    }

    private pieceAt(now: number): Piece | null {
        for (let index = this.pieces.length - 1; index >= 0; index--) {
            if (this.pieces[index].start <= now) return this.pieces[index];
        }
        return null;
    }

    /** The voice's level now, in dBFS; quiet when nothing plays. */
    decibels(): number {
        if (!this.output) return SILENT;
        const now = this.heardNow();
        const piece = this.pieceAt(now);
        if (!piece) return SILENT;
        const index = Math.floor((now - piece.start) / CallVoicePlayer.levelStep);
        return piece.levels[index] ?? SILENT;
    }

    /** How far into the answer's audio is being heard now, in seconds; null when nothing streamed is playing. */
    heardSeconds(): number | null {
        if (!this.output) return null;
        const now = this.heardNow();
        const piece = this.pieceAt(now);
        if (!piece) return null;
        return piece.at + Math.min(now - piece.start, piece.duration) * this.rate;
    }
}
