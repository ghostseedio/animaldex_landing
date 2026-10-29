/**
 * A voice call with an animal: you talk, it answers out loud, its 3D model's
 * mouth moving with its voice.
 *
 * The web port of the iOS `AnimalVoiceCallController`, rule for rule. Each
 * turn is an ordinary chat turn: what you say lands in the thread and the
 * animal answers through the same route, so it costs a message and a spoken
 * reply. On a call the server answers short, on a fast model, and streams
 * the voice sentence by sentence with the words, so it starts speaking about
 * a second after you stop.
 *
 *   - Silence ends a turn; a pause mid-sentence is thinking, not the end.
 *   - While the animal thinks and talks it listens for their next turn; once
 *     it has heard two words from them (not a noise) the animal stops, that
 *     reply is cancelled (what it said stays in the chat), and listening goes
 *     on as their turn. Talking over it needs echo cancellation on what the
 *     recognizer hears; without it, only a tap interrupts.
 *   - Carrying on before the animal has said anything was a pause, not the
 *     end: its reply is dropped and the rest joins what was said before.
 *   - A voice that did not stream (none offered, or it failed) is the whole
 *     reply's clip instead, from the chat's own spoken replies, as iOS's
 *     `speakWhole`; today's spoken replies used up ends the voice.
 */

import {CALL_TALKING_OVER_WORDS, callEventFrom, heardWordCount, type CallSpokenWord, type CallVoiceInfo} from "@/lib/ask-animaldex/call-events";
import {askReplyWordsOf} from "@/lib/ask-animaldex/spoken-words";
import {CallMicrophone, CallVoicePlayer} from "@/components/ask-animaldex/voice-call/call-audio";
import {CallListener} from "@/components/ask-animaldex/voice-call/call-listener";
import type {CallCopy} from "@/lib/ask-animaldex/call-copy";
import type {CallClip} from "@/lib/ask-animaldex/call-events";

export type CallPhase = "starting" | "listening" | "thinking" | "speaking" | "voiceUsedUp" | "failed";

/** How long the last turn took: from sending what they said to the animal's first sound, and to the whole answer. */
export type CallTimings = {firstSound: number | null; reply: number};

export type CallState = {
    phase: CallPhase;
    /** Why the call stopped, when it did. */
    failure: string | null;
    /** What they are saying, as it is heard. */
    heard: string;
    /** What the animal said last. */
    said: string;
    /** What the animal is saying, word by word with when each is heard. */
    spokenWords: CallSpokenWord[];
    timings: CallTimings | null;
    startedAt: number;
    /** Not listening until unmuted; the animal can still finish speaking. */
    isMuted: boolean;
};

/** Sends what they said as a chat turn; call frames go to `onEvent`; resolves with the answer's text, or null. */
export type CallAsk = (said: string, onEvent: (frame: Record<string, unknown>) => void) => Promise<string | null>;

/** The whole reply's voice as one clip (the chat's spoken reply), for a turn whose voice did not stream. */
export type CallSpeak = (reply: string, signal: AbortSignal) => Promise<CallClip>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class VoiceCallController {
    readonly voice: CallVoicePlayer;
    readonly microphone: CallMicrophone;
    private readonly listener: CallListener;
    private state: CallState = {
        phase: "starting",
        failure: null,
        heard: "",
        said: "",
        spokenWords: [],
        timings: null,
        startedAt: Date.now(),
        isMuted: false
    };
    private readonly subscribers = new Set<() => void>();
    private running = false;
    private cancelled = false;
    /** The next turn, listened for while the animal answers, so they can talk over it and lose none of their words. */
    private nextTurn: Promise<string | null> | null = null;
    /** What they said last turn, and whether they carried on before the animal said anything. */
    private lastUtterance = "";
    private carriesOn = false;
    // This turn so far.
    private turnVoice: CallVoiceInfo | null = null;
    private turnHeard = false;
    private turn: CallTimings = {firstSound: null, reply: 0};
    private talkedOver = false;
    /** The answer's text is all here (it stands in the thread whatever its voice does). */
    private replyDone = false;
    /** The whole clip being fetched, when the voice did not stream. */
    private clipRequest: AbortController | null = null;

    constructor(private readonly params: {
        context: AudioContext;
        /** BCP 47, for the recognizer. */
        language: string;
        /** Names it should expect to hear: the animal's. */
        hints: string[];
        copy: CallCopy;
        ask: CallAsk;
        /** Stops the turn in flight; what it said so far stays in the thread. */
        cancelAsk: () => void;
        /** The whole reply's clip, when its voice did not stream; without it the answer stands as text. */
        speak?: CallSpeak;
        /**
         * Development only (iOS `ANIMALDEX_CALL_SCRIPT`): these are "said"
         * instead of listening, as a headless browser cannot speak; then the
         * call waits.
         */
        script?: string[] | null;
    }) {
        this.voice = new CallVoicePlayer(params.context);
        this.microphone = new CallMicrophone(params.context);
        this.listener = new CallListener(this.microphone);
        this.listener.hints = params.hints;
    }

    subscribe = (listener: () => void) => {
        this.subscribers.add(listener);
        return () => {
            this.subscribers.delete(listener);
        };
    };

    snapshot = () => this.state;

    private set(patch: Partial<CallState>) {
        this.state = {...this.state, ...patch};
        this.subscribers.forEach((listener) => listener());
    }

    get phase(): CallPhase {
        return this.state.phase;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.cancelled = false;
        void this.params.context.resume().catch(() => undefined);
        this.set({startedAt: Date.now()});
        void this.run();
    }

    end() {
        this.cancelled = true;
        this.running = false;
        this.nextTurn = null;
        // A listen in progress gives up (with nothing), so the loop can see it has ended.
        this.listener.cancelTurn();
        this.listener.stop();
        this.clipRequest?.abort();
        this.voice.stop();
        // Hung up mid-answer: the reply stops (what it said stays in the chat) and so does its voice.
        if (this.state.phase === "thinking" || this.state.phase === "speaking") this.params.cancelAsk();
        this.microphone.stop();
        // Nothing plays until the next call wakes it (in its own click).
        void this.params.context.suspend().catch(() => undefined);
    }

    /** Tapping the animal while it talks: it stops, and it listens. */
    interrupt() {
        if (this.state.phase !== "speaking") return;
        this.voice.stop();
    }

    /** The microphone button: while they talk it sends what was said now; while the animal talks it interrupts. */
    tapMicrophone() {
        if (this.state.phase === "listening") this.listener.finishNow();
        else if (this.state.phase === "speaking") this.voice.stop();
    }

    toggleMute() {
        const isMuted = !this.state.isMuted;
        this.set({isMuted});
        // What was half said is dropped, not sent.
        if (isMuted && this.state.phase === "listening") this.listener.cancelTurn();
    }

    /** How loud whoever is talking is now (dBFS), for the waves. */
    level(): number {
        if (this.state.phase === "speaking") return this.voice.decibels();
        if (this.state.phase === "listening" && !this.state.isMuted) {
            if (this.fakingSpeech) {
                const time = performance.now() / 1000;
                return -24 + 9 * Math.sin(time * 11) * Math.sin(time * 3.1);
            }
            return this.listener.decibels();
        }
        return -120;
    }

    private fail(message: string) {
        this.set({phase: "failed", failure: message});
    }

    private async run() {
        const {copy} = this.params;
        if (this.params.script?.length && process.env.NODE_ENV !== "production") return this.runScripted(this.params.script);
        try {
            await this.microphone.start();
        } catch (error) {
            const name = error instanceof DOMException ? error.name : "";
            this.fail(name === "NotAllowedError" || name === "SecurityError" ? copy.allowMicrophone : copy.microphoneUnavailable);
            return;
        }
        if (this.cancelled) {
            this.microphone.stop();
            return;
        }
        while (!this.cancelled) {
            this.set({phase: "listening"});
            // A turn they began over the animal keeps what was heard so far.
            if (!this.nextTurn) this.set({heard: ""});
            while (this.state.isMuted && !this.cancelled) await sleep(150);
            if (this.cancelled) return;
            let utterance: string | null;
            try {
                // Already listening since the animal began (they may have talked over it): that turn goes on.
                const early = this.nextTurn;
                if (early) {
                    this.nextTurn = null;
                    const rest = await early;
                    // Carried on before the animal spoke: one message, whole.
                    utterance = this.carriesOn && rest ? `${this.lastUtterance} ${rest}` : rest;
                    this.carriesOn = false;
                } else {
                    utterance = await this.listener.listen(this.params.language, (partial) => this.set({heard: partial}));
                }
            } catch {
                if (this.cancelled) return;
                this.fail(copy.recognitionStopped);
                return;
            }
            if (this.cancelled) return;
            if (!utterance || utterance.length < 2) continue;
            this.lastUtterance = utterance;
            await this.answer(utterance);
            if (this.state.phase === "voiceUsedUp") return;
        }
    }

    /** While a scripted line is being "said", the waves move as if it were. */
    private fakingSpeech = false;

    private async runScripted(lines: string[]) {
        for (const line of lines) {
            if (this.cancelled) return;
            this.set({phase: "listening", heard: ""});
            this.fakingSpeech = true;
            for (let count = 1; count <= line.length && !this.cancelled; count += 3) {
                this.set({heard: line.slice(0, count)});
                await sleep(90);
            }
            this.set({heard: line});
            this.fakingSpeech = false;
            await sleep(700);
            if (this.cancelled) return;
            this.lastUtterance = line;
            await this.answer(line);
            if (this.state.phase === "voiceUsedUp") return;
        }
        if (!this.cancelled) this.set({phase: "listening", heard: ""});
    }

    /** Sends what they said and speaks the animal's answer as it streams in, until it ends, is interrupted, or they talk over it. */
    private async answer(utterance: string) {
        this.set({phase: "thinking", spokenWords: []});
        this.turn = {firstSound: null, reply: 0};
        this.turnVoice = null;
        this.turnHeard = false;
        this.talkedOver = false;
        this.replyDone = false;
        const sent = performance.now();
        const asking = this.params.ask(utterance, (frame) => {
            if (this.cancelled || this.talkedOver) return;
            const event = callEventFrom(frame);
            if (!event) return;
            switch (event.kind) {
                case "voice":
                    this.turnVoice = event.info;
                    if (event.info.available) this.voice.beginStream(event.info.sampleRate ?? 24_000, event.info.rate ?? 1);
                    break;
                case "words":
                    this.set({spokenWords: [...this.state.spokenWords, ...event.words]});
                    break;
                case "audio":
                    if (this.turnVoice?.available !== true) return;
                    if (!this.turnHeard) {
                        this.turnHeard = true;
                        this.turn = {...this.turn, firstSound: (performance.now() - sent) / 1000};
                        this.set({timings: this.turn, phase: "speaking"});
                    }
                    this.voice.enqueue(event.pcm);
                    break;
            }
        });
        this.listenWhileAnswering();
        const reply = await asking.catch(() => null);
        this.replyDone = true;
        // They talked over it: it has stopped, and the next listen catches up.
        if (this.talkedOver || this.cancelled) return;
        this.turn = {...this.turn, reply: (performance.now() - sent) / 1000};
        this.set({timings: this.turn});
        if (!reply) {
            this.voice.stop();
            this.set({said: this.params.copy.ellipsis});
            return;
        }
        this.set({said: askReplyWordsOf(reply).join(" ")});
        if (this.turnHeard) {
            // The rest of the voice is queued; it plays out unless interrupted.
            await this.voice.finishStream();
            return;
        }
        this.voice.stop();
        // Set by the stream's frames, after the checks above narrowed it.
        const voice = this.turnVoice as CallVoiceInfo | null;
        if (voice?.reason === "speech_limit_reached") {
            this.set({phase: "voiceUsedUp"});
            return;
        }
        // The voice did not stream (none offered, or it failed): the whole reply's clip, as iOS does.
        await this.speakWhole(reply, sent);
    }

    /**
     * The whole reply in the animal's voice, as one clip (iOS `speakWhole`),
     * its mouth following it. Still "thinking" while it is fetched; talking
     * over it or hanging up drops it. Today's spoken replies used up ends the
     * voice; any other failure leaves the answer as text and the call listens on.
     */
    private async speakWhole(reply: string, sent: number) {
        const speak = this.params.speak;
        if (!speak) return;
        const request = new AbortController();
        this.clipRequest = request;
        let clip: CallClip;
        try {
            clip = await speak(reply, request.signal);
        } catch {
            clip = {kind: "none"};
        } finally {
            if (this.clipRequest === request) this.clipRequest = null;
        }
        if (this.cancelled || this.talkedOver || request.signal.aborted) return;
        if (clip.kind === "limit") {
            this.set({phase: "voiceUsedUp"});
            return;
        }
        if (clip.kind !== "audio") return;
        this.turn = {...this.turn, firstSound: (performance.now() - sent) / 1000};
        this.set({timings: this.turn, phase: "speaking"});
        await this.voice.playClip(clip.audio);
    }

    /**
     * Listens for their next turn while the animal thinks and talks. Once the
     * recognizer has their words (a few of them, not a noise), the animal
     * stops, that reply is cancelled and this goes on as their turn. Only
     * with echo cancellation on what the recognizer hears, or it would hear
     * the animal itself.
     */
    private listenWhileAnswering() {
        if (this.state.isMuted || !this.listener.cancelsEcho || this.nextTurn) return;
        const turn = this.listener.listen(this.params.language, (partial) => {
            this.set({heard: partial});
            const phase = this.state.phase;
            if (this.talkedOver || heardWordCount(partial) < CALL_TALKING_OVER_WORDS || (phase !== "thinking" && phase !== "speaking")) return;
            // Before the animal said anything, and while its answer was still coming: a pause, not the end.
            // (An answer already whole stands in the thread, spoken or not.)
            this.carriesOn = phase === "thinking" && !this.turnHeard && !this.replyDone;
            this.talkedOver = true;
            this.clipRequest?.abort();
            this.voice.stop();
            this.params.cancelAsk();
            this.set({phase: "listening"});
        });
        this.nextTurn = turn;
        // A recognizer that fails here fails the next listen too; it is reported there.
        turn.catch(() => undefined);
    }
}
