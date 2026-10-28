/**
 * Hears one thing said: resolves once they stop talking for a moment, or
 * with null if nothing is said for a while. The web counterpart of the iOS
 * `AnimalCallListener`, over the Web Speech API (Chrome, Edge and Safari
 * have it; Firefox does not, and there the call is not offered).
 *
 * The same rules as iOS: a pause after a finished sentence ends the turn
 * (1.3 s), a pause mid-sentence is thinking (2.4 s); if the microphone still
 * hears them when it runs out, it waits up to about a second more; tapping
 * the microphone sends what was heard now; muting drops it.
 *
 * Where the browser's recognizer can listen to a given track it hears the
 * call's own echo-cancelled microphone, as on iOS, so the animal can be
 * talked over; elsewhere it uses its own.
 */

import {
    CALL_NOTHING_SAID_TIMEOUT_MS,
    CALL_STILL_TALKING_DECIBELS,
    callPauseAfter
} from "@/lib/ask-animaldex/call-events";
import type {CallMicrophone} from "@/components/ask-animaldex/voice-call/call-audio";

type RecognitionResult = {isFinal: boolean; 0: {transcript: string}; length: number};
type RecognitionEvent = {resultIndex: number; results: {length: number; [index: number]: RecognitionResult}};
type Recognition = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    processLocally?: boolean;
    phrases?: unknown[];
    onresult: ((event: RecognitionEvent) => void) | null;
    onerror: ((event: {error: string}) => void) | null;
    onend: (() => void) | null;
    start: (track?: MediaStreamTrack) => void;
    stop: () => void;
    abort: () => void;
};
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor};
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Whether this browser can hold a call: speech recognition, a microphone and Web Audio. */
export function browserCanCall(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as unknown as {AudioContext?: unknown; webkitAudioContext?: unknown};
    return Boolean(recognitionConstructor() && typeof navigator.mediaDevices?.getUserMedia === "function" && (w.AudioContext || w.webkitAudioContext));
}

/** The recognizer can be handed a track (the newer Web Speech API, which also has on-device recognition). */
function takesATrack(recognition: Recognition): boolean {
    return "processLocally" in recognition;
}

/** Errors that will not clear by listening again. */
const FATAL = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported", "network"]);

export class CallListenError extends Error {}

export class CallListener {
    /** Names it should expect to hear (the animal's). */
    hints: string[] = [];
    private recognition: Recognition | null = null;
    private finishing = false;
    private dropping = false;
    private silence: ReturnType<typeof setTimeout> | null = null;
    private resolve: ((said: string | null) => void) | null = null;
    private reject: ((error: Error) => void) | null = null;
    private transcript = "";
    /** What earlier recognition sessions of this turn heard (the browser ends one now and then). */
    private carried = "";
    private punctuates = false;

    constructor(private readonly microphone: CallMicrophone) {}

    /** The recognizer hears the call's echo-cancelled microphone, so the animal cannot hear itself. */
    get cancelsEcho(): boolean {
        const Recognition = recognitionConstructor();
        if (!Recognition || !this.microphone.cancelsEcho || !this.microphone.track) return false;
        try {
            return takesATrack(new Recognition());
        } catch {
            return false;
        }
    }

    /** How loud they are now, in dBFS. */
    decibels(): number {
        return this.microphone.decibels();
    }

    /** They tapped to say they are done: send what was heard now. */
    finishNow() {
        this.finish();
    }

    /** Drop this turn without sending it (muted mid-sentence). */
    cancelTurn() {
        this.transcript = "";
        this.dropping = true;
        this.finish();
    }

    listen(language: string, onPartial: (heard: string) => void): Promise<string | null> {
        this.stop();
        this.finishing = false;
        this.dropping = false;
        this.transcript = "";
        this.carried = "";
        return new Promise<string | null>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            this.arm(CALL_NOTHING_SAID_TIMEOUT_MS);
            this.session(language, onPartial);
        });
    }

    private session(language: string, onPartial: (heard: string) => void) {
        const Recognition = recognitionConstructor();
        if (!Recognition) {
            this.fail(new CallListenError("unavailable"));
            return;
        }
        const recognition = new Recognition();
        recognition.lang = language;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        // Told the animal's name, where the browser lets it be.
        const Phrase = (window as unknown as {SpeechRecognitionPhrase?: new (phrase: string, boost: number) => unknown}).SpeechRecognitionPhrase;
        if (Phrase && "phrases" in recognition && this.hints.length > 0) {
            try {
                recognition.phrases = this.hints.map((hint) => new Phrase(hint, 5));
            } catch {
                // Not on this recognizer; the name is still usually heard.
            }
        }
        const carried = this.carried;
        recognition.onresult = (event) => {
            let text = "";
            let settled = true;
            for (let index = 0; index < event.results.length; index++) {
                const result = event.results[index];
                text += result[0]?.transcript ?? "";
                settled = result.isFinal;
            }
            const heard = `${carried} ${text}`.replace(/\s+/g, " ").trim();
            if (/[.?!…,]/.test(text)) this.punctuates = true;
            if (heard && heard !== this.transcript) {
                this.transcript = heard;
                onPartial(heard);
                this.arm(callPauseAfter(heard, {settled, punctuates: this.punctuates}), true);
            }
        };
        recognition.onerror = (event) => {
            if (FATAL.has(event.error)) this.fail(new CallListenError(event.error));
        };
        recognition.onend = () => {
            if (this.recognition !== recognition) return;
            this.recognition = null;
            if (this.finishing) return;
            // The browser ended it (a long silence, its own limit): listen on.
            this.carried = this.transcript;
            this.session(language, onPartial);
        };
        this.recognition = recognition;
        const track = this.microphone.track;
        const useTrack = Boolean(track && this.microphone.cancelsEcho && takesATrack(recognition));
        const begin = (attempt: number) => {
            if (this.recognition !== recognition || this.finishing) return;
            try {
                if (useTrack && attempt === 0) recognition.start(track as MediaStreamTrack);
                else recognition.start();
            } catch (error) {
                // The last session may still be letting go of the microphone.
                if (attempt < 2) {
                    setTimeout(() => begin(attempt + 1), 200);
                    return;
                }
                this.recognition = null;
                this.fail(error instanceof Error ? error : new CallListenError("start"));
            }
        };
        begin(0);
    }

    stop() {
        if (this.silence) clearTimeout(this.silence);
        this.silence = null;
        const recognition = this.recognition;
        this.recognition = null;
        if (recognition) {
            recognition.onresult = null;
            recognition.onerror = null;
            recognition.onend = null;
            try {
                recognition.abort();
            } catch {
                // Already over.
            }
        }
    }

    private arm(delay: number, untilQuiet = false) {
        if (this.finishing) return;
        if (this.silence) clearTimeout(this.silence);
        let extra = 0;
        const wait = () => {
            // At most about a second more: a noisy room is never quiet.
            if (untilQuiet && extra < 8 && this.decibels() > CALL_STILL_TALKING_DECIBELS) {
                extra += 1;
                this.silence = setTimeout(wait, 150);
                return;
            }
            this.finish();
        };
        this.silence = setTimeout(wait, delay);
    }

    private finish() {
        if (this.finishing) return;
        this.finishing = true;
        const said = this.dropping ? "" : this.transcript.trim();
        this.stop();
        const resolve = this.resolve;
        this.resolve = null;
        this.reject = null;
        resolve?.(said ? said : null);
    }

    private fail(error: Error) {
        if (this.finishing) return;
        this.finishing = true;
        this.stop();
        const reject = this.reject;
        this.resolve = null;
        this.reject = null;
        reject?.(error);
    }
}
