"use client";

/**
 * Dictation in the message bar, ChatGPT-style (owner, 2026-11-01; DECISIONS
 * section 9): tap the mic, talk, and the words appear in the field as they
 * are recognised; tap again (or ✓) and they stay there to edit and send. It
 * never sends by itself. ✕ puts the field back as it was.
 *
 * The browser's own recognizer (the Web Speech API: Chrome, Edge, Safari)
 * where there is one, with partial results; elsewhere (Firefox) the
 * microphone is recorded and, on stop, transcribed by the call's route
 * (`/api/ask/call-transcribe`, signed-in readers only). The language is the
 * chat's. The first time, one line says why before the browser asks for the
 * microphone; a refusal leaves a quiet line, never a dialog.
 */

import {useCallback, useEffect, useRef, useState} from "react";
import {browserRecognizesSpeech} from "@/components/ask-animaldex/voice-call/call-listener";
import {CallMicrophone, callAudioContext, primeCallAudio} from "@/components/ask-animaldex/voice-call/call-audio";
import {transcribeOnServer} from "@/components/ask-animaldex/voice-call/call-server-listener";
import {CALL_HEARING, encodeWav} from "@/lib/ask-animaldex/call-hearing";
import {dictatedText} from "@/lib/ask-animaldex/dictation";
import {joinHeard, resultTranscripts} from "@/lib/ask-animaldex/heard-text";

export type DictationPhase = "idle" | "starting" | "listening" | "transcribing" | "denied" | "failed";

/** Shown once per browser, above the first microphone ask. */
const PRIMED_KEY = "animaldex:ask:dictation-primed";

type RecognitionResult = {isFinal: boolean; 0: {transcript: string}; length: number};
type Recognition = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((event: {results: {length: number; [index: number]: RecognitionResult}}) => void) | null;
    onerror: ((event: {error: string}) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
};

function recognitionConstructor(): (new () => Recognition) | null {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition};
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function wasPrimed(): boolean {
    try {
        return window.localStorage.getItem(PRIMED_KEY) === "1";
    } catch {
        return false;
    }
}

function notePrimed() {
    try {
        window.localStorage.setItem(PRIMED_KEY, "1");
    } catch {
        // Shown again next time, then.
    }
}

export function useDictation(params: {
    /** BCP 47, the chat's language. */
    language: string;
    /** A signed-in reader: without the browser's recognizer, the server can hear. */
    serverHearing: boolean;
    /** What the field holds now, and where the words go. */
    getText: () => string;
    setText: (text: string) => void;
}) {
    const [available, setAvailable] = useState(false);
    const [phase, setPhase] = useState<DictationPhase>("idle");
    const [priming, setPriming] = useState(false);
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const latest = useRef(params);
    latest.current = params;
    const recognitionRef = useRef<Recognition | null>(null);
    const microphoneRef = useRef<CallMicrophone | null>(null);
    const meterRef = useRef<{stream: MediaStream; context: AudioContext; analyser: AnalyserNode; samples: Float32Array} | null>(null);
    const framesRef = useRef<Int16Array[]>([]);
    const beforeRef = useRef("");
    const activeRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const hasMic = typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
        setAvailable(hasMic && (browserRecognizesSpeech() || params.serverHearing));
    }, [params.serverHearing]);

    const release = useCallback(() => {
        const recognition = recognitionRef.current;
        recognitionRef.current = null;
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
        microphoneRef.current?.stop();
        microphoneRef.current = null;
        const meter = meterRef.current;
        meterRef.current = null;
        if (meter) {
            meter.stream.getTracks().forEach((track) => track.stop());
            void meter.context.close().catch(() => undefined);
        }
    }, []);

    useEffect(() => () => {
        activeRef.current = false;
        abortRef.current?.abort();
        release();
    }, [release]);

    /** How loud they are now, 0–1, for the bar's level. */
    const level = useCallback((): number => {
        const meter = meterRef.current;
        let samples: Float32Array | null = null;
        if (meter) {
            meter.analyser.getFloatTimeDomainData(meter.samples);
            samples = meter.samples;
        }
        if (!samples) {
            const decibels = microphoneRef.current?.decibels() ?? -120;
            return Math.max(0, Math.min(1, (decibels + 60) / 50));
        }
        let sum = 0;
        for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
        const rms = Math.sqrt(sum / samples.length);
        const decibels = rms > 0 ? 20 * Math.log10(rms) : -120;
        return Math.max(0, Math.min(1, (decibels + 60) / 50));
    }, []);

    const listenInBrowser = useCallback((Recognition: new () => Recognition) => {
        let carried = "";
        const session = () => {
            const recognition = new Recognition();
            recognition.lang = latest.current.language;
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;
            const before = carried;
            recognition.onresult = (event) => {
                // One space between results, and nothing said twice (heard-text.ts).
                const heard = joinHeard([before, ...resultTranscripts(event.results)]);
                carried = heard;
                latest.current.setText(dictatedText(beforeRef.current, heard));
            };
            recognition.onerror = (event) => {
                if (event.error === "not-allowed" || event.error === "service-not-allowed") {
                    activeRef.current = false;
                    release();
                    setPhase("denied");
                } else if (event.error === "audio-capture" || event.error === "language-not-supported" || event.error === "network") {
                    activeRef.current = false;
                    release();
                    setPhase("failed");
                }
            };
            recognition.onend = () => {
                if (recognitionRef.current !== recognition) return;
                // The browser ends a session after a silence: while they are dictating, it listens on.
                if (activeRef.current) session();
                else recognitionRef.current = null;
            };
            recognitionRef.current = recognition;
            try {
                recognition.start();
            } catch {
                activeRef.current = false;
                release();
                setPhase("failed");
            }
        };
        session();
    }, [release]);

    const start = useCallback(async () => {
        if (activeRef.current || phase === "transcribing") return;
        const Recognition = recognitionConstructor();
        if (!Recognition && !latest.current.serverHearing) return;
        beforeRef.current = latest.current.getText();
        framesRef.current = [];
        activeRef.current = true;
        setPriming(!wasPrimed());
        setPhase("starting");
        try {
            if (Recognition) {
                // A level meter of its own; the recognizer holds the microphone itself.
                const stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}});
                const AudioContextClass = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
                if (AudioContextClass) {
                    const context = new AudioContextClass();
                    const analyser = context.createAnalyser();
                    analyser.fftSize = 1024;
                    context.createMediaStreamSource(stream).connect(analyser);
                    meterRef.current = {stream, context, analyser, samples: new Float32Array(1024)};
                } else {
                    stream.getTracks().forEach((track) => track.stop());
                }
                if (!activeRef.current) return release();
                listenInBrowser(Recognition);
            } else {
                primeCallAudio();
                const context = callAudioContext();
                if (!context) throw new Error("no_audio");
                const microphone = new CallMicrophone(context);
                await microphone.start();
                microphoneRef.current = microphone;
                await microphone.listenPcm((frame) => framesRef.current.push(frame.slice()));
                if (!activeRef.current) return release();
            }
            notePrimed();
            setPriming(false);
            setStartedAt(Date.now());
            setPhase("listening");
        } catch (error) {
            activeRef.current = false;
            release();
            const name = error instanceof DOMException ? error.name : "";
            setPhase(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed");
        }
    }, [phase, listenInBrowser, release]);

    /** ✓, or the mic again: the words stay in the field; it never sends. */
    const stop = useCallback(async () => {
        if (!activeRef.current) return;
        activeRef.current = false;
        setStartedAt(null);
        if (recognitionRef.current) {
            const recognition = recognitionRef.current;
            recognitionRef.current = null;
            recognition.onend = null;
            try {
                recognition.stop();
            } catch {
                // Already over.
            }
            // The last partial result may still arrive: let it land before letting go.
            window.setTimeout(() => {
                recognition.onresult = null;
                release();
            }, 400);
            setPhase("idle");
            return;
        }
        const frames = framesRef.current;
        framesRef.current = [];
        release();
        const length = frames.reduce((sum, frame) => sum + frame.length, 0);
        if (length < CALL_HEARING.sampleRate / 4) {
            setPhase("idle");
            return;
        }
        const samples = new Int16Array(length);
        let offset = 0;
        for (const frame of frames) {
            samples.set(frame, offset);
            offset += frame.length;
        }
        setPhase("transcribing");
        const controller = new AbortController();
        abortRef.current = controller;
        const result = await transcribeOnServer(encodeWav(samples), latest.current.language, controller.signal);
        if (controller.signal.aborted) return;
        abortRef.current = null;
        if (result.kind === "text") {
            latest.current.setText(dictatedText(beforeRef.current, result.text));
            setPhase("idle");
        } else {
            setPhase("failed");
        }
    }, [release]);

    /** ✕: nothing heard is kept; the field is as it was. */
    const cancel = useCallback(() => {
        const wasActive = activeRef.current || phase === "transcribing";
        activeRef.current = false;
        abortRef.current?.abort();
        abortRef.current = null;
        release();
        setStartedAt(null);
        setPriming(false);
        if (wasActive) latest.current.setText(beforeRef.current);
        setPhase("idle");
    }, [phase, release]);

    /** A refusal or a failure noted: back to the plain bar. */
    const dismiss = useCallback(() => setPhase("idle"), []);

    return {
        available,
        phase,
        priming,
        startedAt,
        active: phase === "starting" || phase === "listening" || phase === "transcribing",
        start,
        stop,
        cancel,
        dismiss,
        level
    };
}
