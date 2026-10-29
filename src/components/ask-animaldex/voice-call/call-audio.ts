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
 * which word is being said. A whole clip (the reply's voice when it did not
 * stream) is decoded and measured the same way before it plays, as iOS
 * measures its clip: a player's own meter smooths too much for a mouth.
 */

import {StreamingTimeStretch} from "@/lib/ask-animaldex/call-time-stretch";
import {loudness} from "@/lib/ask-animaldex/call-events";
import {CALL_HEARING, CallDownsampler} from "@/lib/ask-animaldex/call-hearing";

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

/**
 * Hands on what the microphone hears, unchanged, a block at a time (2048
 * samples at the context's rate), off the main thread.
 */
const TAP_WORKLET = `
class AnimalDexCallTap extends AudioWorkletProcessor {
    constructor() {
        super();
        this.block = new Float32Array(2048);
        this.filled = 0;
    }
    process(inputs) {
        const input = inputs[0] && inputs[0][0];
        if (input) {
            let at = 0;
            while (at < input.length) {
                const take = Math.min(input.length - at, this.block.length - this.filled);
                this.block.set(input.subarray(at, at + take), this.filled);
                this.filled += take;
                at += take;
                if (this.filled === this.block.length) {
                    this.port.postMessage(this.block.slice(0));
                    this.filled = 0;
                }
            }
        }
        return true;
    }
}
registerProcessor("animaldex-call-tap", AnimalDexCallTap);
`;

const tapModules = new WeakMap<BaseAudioContext, Promise<void>>();

/** The microphone for the whole call. */
export class CallMicrophone {
    private stream: MediaStream | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private analyser: AnalyserNode | null = null;
    private readonly samples = new Float32Array(1024);
    /** The 16 kHz tap, for a recognizer on the server: made once, on first use. */
    private tap: {node: AudioNode; silent: GainNode} | null = null;
    private tapping: Promise<void> | null = null;
    private pcmSink: ((frame: Int16Array) => void) | null = null;
    private downsampler: CallDownsampler | null = null;
    private pcmFrame = new Int16Array(CALL_HEARING.sampleRate * CALL_HEARING.frameMs / 1000);
    private pcmFilled = 0;
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

    /**
     * From now on hands `sink` what the microphone hears as 16 kHz 16-bit
     * mono, 20 ms at a time (null: to no one). The same echo-cancelled
     * microphone the call already holds.
     */
    async listenPcm(sink: ((frame: Int16Array) => void) | null): Promise<void> {
        this.pcmSink = sink;
        this.pcmFilled = 0;
        if (!sink) return;
        this.downsampler = new CallDownsampler(this.context.sampleRate);
        if (this.tap) return;
        this.tapping ??= this.makeTap().finally(() => {
            this.tapping = null;
        });
        await this.tapping;
    }

    private async makeTap() {
        const source = this.source;
        if (!source) throw new Error("microphone_off");
        const silent = this.context.createGain();
        silent.gain.value = 0;
        // Pulled through a silent output, as the browser only runs nodes that lead somewhere.
        silent.connect(this.context.destination);
        let node: AudioNode;
        if (typeof AudioWorkletNode !== "undefined" && this.context.audioWorklet) {
            let loading = tapModules.get(this.context);
            if (!loading) {
                const url = URL.createObjectURL(new Blob([TAP_WORKLET], {type: "application/javascript"}));
                loading = this.context.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
                tapModules.set(this.context, loading);
            }
            await loading;
            const worklet = new AudioWorkletNode(this.context, "animaldex-call-tap", {numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: "explicit"});
            worklet.port.onmessage = (event: MessageEvent<Float32Array>) => this.takePcm(event.data);
            node = worklet;
        } else {
            // Older browsers: the deprecated processor, on the main thread.
            const processor = this.context.createScriptProcessor(2048, 1, 1);
            processor.onaudioprocess = (event) => this.takePcm(new Float32Array(event.inputBuffer.getChannelData(0)));
            node = processor;
        }
        if (this.source !== source) {
            silent.disconnect();
            return;
        }
        source.connect(node);
        node.connect(silent);
        this.tap = {node, silent};
    }

    private takePcm(block: Float32Array) {
        const sink = this.pcmSink;
        const downsampler = this.downsampler;
        if (!sink || !downsampler) return;
        const samples = downsampler.push(block);
        for (let i = 0; i < samples.length; i++) {
            this.pcmFrame[this.pcmFilled++] = samples[i];
            if (this.pcmFilled === this.pcmFrame.length) {
                sink(this.pcmFrame);
                this.pcmFrame = new Int16Array(this.pcmFrame.length);
                this.pcmFilled = 0;
            }
        }
    }

    stop() {
        this.pcmSink = null;
        if (this.tap) {
            const node = this.tap.node as AudioNode & {port?: MessagePort; onaudioprocess?: unknown};
            if (node.port) node.port.onmessage = null;
            if ("onaudioprocess" in node) node.onaudioprocess = null;
            node.disconnect();
            this.tap.silent.disconnect();
            this.tap = null;
        }
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
    /** A whole clip playing: when it started, its loudness every 10 ms, and how to say it is over. */
    private clip: {source: AudioBufferSourceNode; output: GainNode; start: number; levels: number[]; done: () => void} | null = null;
    /** Bumped by every stop, so a clip still decoding when the animal was stopped never plays. */
    private stops = 0;
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

    /**
     * Plays a whole clip (an encoded file, as the speech route returns it)
     * and resolves once it has been heard, or was stopped. False when it
     * could not be decoded or played.
     */
    async playClip(encoded: ArrayBuffer): Promise<boolean> {
        this.stop();
        const stops = this.stops;
        let buffer: AudioBuffer;
        try {
            buffer = await this.context.decodeAudioData(encoded.slice(0));
        } catch {
            return false;
        }
        if (stops !== this.stops) return true;
        void this.context.resume().catch(() => undefined);
        const samples = buffer.getChannelData(0);
        const levels = loudness(samples, Math.max(1, Math.round(buffer.sampleRate * CallVoicePlayer.levelStep)));
        const output = this.context.createGain();
        output.connect(this.context.destination);
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(output);
        return new Promise<boolean>((resolve) => {
            const start = this.context.currentTime + 0.03;
            const done = () => {
                if (this.clip?.source !== source) return;
                this.clip = null;
                source.onended = null;
                source.disconnect();
                output.disconnect();
                resolve(true);
            };
            this.clip = {source, output, start, levels, done};
            source.onended = done;
            try {
                source.start(start);
            } catch {
                this.clip = null;
                output.disconnect();
                resolve(false);
            }
        });
    }

    stop() {
        this.stops += 1;
        const clip = this.clip;
        if (clip) {
            try {
                clip.source.stop();
            } catch {
                // Never started or already over.
            }
            clip.done();
        }
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
        if (this.clip) {
            const index = Math.floor((this.heardNow() - this.clip.start) / CallVoicePlayer.levelStep);
            return index >= 0 ? this.clip.levels[index] ?? SILENT : SILENT;
        }
        if (!this.output) return SILENT;
        const now = this.heardNow();
        const piece = this.pieceAt(now);
        if (!piece) return SILENT;
        const index = Math.floor((now - piece.start) / CallVoicePlayer.levelStep);
        return piece.levels[index] ?? SILENT;
    }

    /** How far into the answer's audio is being heard now, in seconds; null when nothing streamed is playing (a whole clip has no words timed, as on iOS). */
    heardSeconds(): number | null {
        if (!this.output) return null;
        const now = this.heardNow();
        const piece = this.pieceAt(now);
        if (!piece) return null;
        return piece.at + Math.min(now - piece.start, piece.duration) * this.rate;
    }
}
