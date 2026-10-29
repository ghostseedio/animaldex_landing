/**
 * Hears one thing said without the browser's own recognizer: Firefox, which
 * has no Web Speech API, and (only while the animal talks) browsers whose
 * recognizer cannot be handed the call's echo-cancelled microphone.
 *
 * The call's microphone (echo cancellation on, so the animal's voice is
 * taken out of it) goes on as 16 kHz PCM; `CallTurnDetector` finds where they
 * begin and stop with iOS's pause rules and says when to transcribe; each
 * stretch goes to `/api/ask/call-transcribe` (ElevenLabs, a signed-in reader
 * only), and what comes back is what was heard. Over the animal, only words
 * that are not its own count (`wordsNotTheAnimals`), and what may be its
 * voice is not shown as theirs.
 */

import {
    CALL_HEARING,
    CallTurnDetector,
    encodeWav,
    pcmDecibels,
    wordsNotTheAnimals,
    type HearingAction
} from "@/lib/ask-animaldex/call-hearing";
import type {CallMicrophone} from "@/components/ask-animaldex/voice-call/call-audio";
import {CallListenError, type CallHearing} from "@/components/ask-animaldex/voice-call/call-listener";

/** One stretch of the turn transcribed: what was said, a failure to retry, or a refusal that will not clear. */
export type CallTranscription = {kind: "text"; text: string} | {kind: "failed"} | {kind: "fatal"; reason: string};
export type CallTranscribe = (wav: Uint8Array, language: string, signal: AbortSignal) => Promise<CallTranscription>;

/** Refusals that the next turn would meet too: not signed in, calls off, the route's format, the key missing, the rate. */
const FATAL_STATUSES = new Set([401, 403, 404, 413, 415, 429, 503]);

/** The web route, as the call uses it. */
export const transcribeOnServer: CallTranscribe = async (wav, language, signal) => {
    try {
        const response = await fetch(`/api/ask/call-transcribe?language=${encodeURIComponent(language)}`, {
            method: "POST",
            headers: {"Content-Type": "audio/wav"},
            body: wav,
            signal
        });
        const payload = await response.json().catch(() => null) as {ok?: boolean; text?: unknown; error?: unknown} | null;
        if (FATAL_STATUSES.has(response.status)) return {kind: "fatal", reason: typeof payload?.error === "string" ? payload.error : String(response.status)};
        if (!response.ok || payload?.ok !== true || typeof payload.text !== "string") return {kind: "failed"};
        return {kind: "text", text: payload.text};
    } catch {
        return {kind: "failed"};
    }
};

export class CallServerListener implements CallHearing {
    /** Names it should expect to hear (kept for the interface; the server's model hears names well). */
    hints: string[] = [];
    readonly mayHearTheAnimal = true;
    private detector: CallTurnDetector | null = null;
    private frames: Int16Array[] = [];
    /** Which frame of the listen `frames[0]` is. */
    private firstFrame = 0;
    private frameCount = 0;
    private language = "en";
    private dropping = false;
    private animalTalking = false;
    private request: AbortController | null = null;
    private onPartial: ((heard: string) => void) | null = null;
    private resolve: ((said: string | null) => void) | null = null;
    private reject: ((error: Error) => void) | null = null;

    constructor(private readonly microphone: CallMicrophone, private readonly transcribe: CallTranscribe) {}

    get hearsSomeone(): boolean {
        return this.detector?.hearsSomeone ?? false;
    }

    /** Over the animal, its own words do not count. */
    wordsOverAnimal(heard: string, animalWords: string[]): number {
        return wordsNotTheAnimals(heard, animalWords);
    }

    setAnimalTalking(on: boolean) {
        this.animalTalking = on;
        this.detector?.setAnimalTalking(on);
    }

    listen(language: string, onPartial: (heard: string) => void): Promise<string | null> {
        this.stop();
        const detector = new CallTurnDetector();
        detector.setAnimalTalking(this.animalTalking);
        this.detector = detector;
        this.frames = [];
        this.firstFrame = 0;
        this.frameCount = 0;
        this.dropping = false;
        this.language = language;
        this.onPartial = onPartial;
        return new Promise<string | null>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            this.microphone.listenPcm((frame) => this.take(detector, frame)).catch(() => this.fail(new CallListenError("audio-capture")));
        });
    }

    /** They tapped: what they have said, now. */
    finishNow() {
        if (this.detector) this.apply(this.detector, this.detector.finishNow());
    }

    /** Dropped without sending (muted mid-sentence, or the browser's own recognizer takes the next turn). */
    cancelTurn() {
        this.dropping = true;
        this.complete(null);
    }

    stop() {
        void this.microphone.listenPcm(null);
        this.request?.abort();
        this.request = null;
        this.detector = null;
        this.frames = [];
    }

    private take(detector: CallTurnDetector, frame: Int16Array) {
        if (this.detector !== detector) return;
        this.frames.push(frame);
        this.frameCount += 1;
        this.apply(detector, detector.frame(pcmDecibels(frame), this.frameCount * CALL_HEARING.frameMs));
        if (this.detector !== detector) return;
        // Only what a transcription can still need: the turn so far, or the moment before anyone spoke.
        const keepFrom = Math.floor(detector.keepFromMs / CALL_HEARING.frameMs);
        const drop = Math.min(Math.max(keepFrom - this.firstFrame, 0), this.frames.length);
        if (drop > 0) {
            this.frames.splice(0, drop);
            this.firstFrame += drop;
        }
    }

    private apply(detector: CallTurnDetector, actions: HearingAction[]) {
        for (const action of actions) {
            if (this.detector !== detector) return;
            switch (action.kind) {
                case "transcribe":
                    this.send(detector, action);
                    break;
                case "heard":
                    if (!this.dropping) this.onPartial?.(action.text);
                    break;
                case "finish":
                    this.complete(action.text);
                    break;
                case "fail":
                    this.fail(new CallListenError(action.reason));
                    break;
            }
        }
    }

    private send(detector: CallTurnDetector, ask: Extract<HearingAction, {kind: "transcribe"}>) {
        const from = Math.max(Math.floor(ask.fromMs / CALL_HEARING.frameMs) - this.firstFrame, 0);
        const to = Math.min(Math.ceil(ask.toMs / CALL_HEARING.frameMs) - this.firstFrame, this.frames.length);
        const pieces = this.frames.slice(from, Math.max(from, to));
        const samples = new Int16Array(pieces.reduce((sum, piece) => sum + piece.length, 0));
        let at = 0;
        for (const piece of pieces) {
            samples.set(piece, at);
            at += piece.length;
        }
        // One at a time: a newer stretch replaces any still out.
        this.request?.abort();
        const request = new AbortController();
        this.request = request;
        void this.transcribe(encodeWav(samples), this.language, request.signal).then((result) => {
            if (this.request === request) this.request = null;
            if (request.signal.aborted || this.detector !== detector) return;
            if (result.kind === "fatal") {
                this.fail(new CallListenError(result.reason));
                return;
            }
            this.apply(detector, detector.transcript(ask.id, result.kind === "text" ? result.text : null));
        });
    }

    private complete(said: string | null) {
        const resolve = this.resolve;
        this.resolve = null;
        this.reject = null;
        const text = this.dropping ? null : said;
        this.stop();
        resolve?.(text && text.trim() ? text.trim() : null);
    }

    private fail(error: Error) {
        const reject = this.reject;
        this.resolve = null;
        this.reject = null;
        this.stop();
        reject?.(error);
    }
}
