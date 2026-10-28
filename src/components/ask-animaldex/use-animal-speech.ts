"use client";

/**
 * Plays a reply in the animal's voice: one at a time, cached per reply for the
 * page (the server caches the audio itself, so a replay is free), with the
 * word being said lit as it goes.
 *
 * The web counterpart of `AnimalChatSpeechPlayer` in the iOS app (AnimalDex
 * 0e5f2f1e, 7c7d6b72, 46ace4ce). A reply that has just arrived speaks by
 * itself while the header's speaker is on; that stops for the rest of the chat
 * once today's spoken replies are used (said once) or after two failures in a
 * row, rather than failing (or nagging) under every reply. A reply nobody
 * asked to hear never gets an error under it.
 */

import {useCallback, useEffect, useRef, useState} from "react";
import {askReplyWordsOf, askEstimatedSpokenWords, askMatchSpokenWords, askSpokenIndex, parseAskSpokenWords, type AskSpokenWord} from "@/lib/ask-animaldex/spoken-words";

/** The header's speaker: replies speak by themselves while it is on (the apps' autoplay key). */
export const ASK_VOICE_AUTOPLAY_KEY = "animaldex:ask:voice-autoplay";

/** Today's spoken replies: free accounts get a few, Pro more. Replaying a clip is free. */
export type AskSpeechAllowance = {remaining: number; limit: number; isPro: boolean};

export type AskSpeechPhase =
    | {kind: "idle"}
    | {kind: "loading"; messageId: string}
    | {kind: "playing"; messageId: string};

/** Why a reply's voice could not play, said under that reply. */
export type AskSpeechNotice = {messageId: string; kind: "limit" | "failed"; offersPro: boolean};

/** Which word of which reply the animal is saying, among the reply's words on screen. */
export type AskSpokenCursor = {messageId: string; word: number} | null;

type Clip = {src: string; words: AskSpokenWord[] | null};

type Timing = {messageId: string; shown: string[]; spoken: AskSpokenWord[]; toShown: Array<number | null>};

function allowanceFrom(raw: unknown): AskSpeechAllowance | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const remaining = Number(row.remaining);
    const limit = Number(row.limit);
    if (!Number.isFinite(remaining) || !Number.isFinite(limit)) return null;
    return {remaining: Math.max(0, remaining), limit: Math.max(0, limit), isPro: row.is_pro === true};
}

function readAutoplay(): boolean {
    try {
        return window.localStorage.getItem(ASK_VOICE_AUTOPLAY_KEY) !== "off";
    } catch {
        return true;
    }
}

/** A breath of silence: played once inside a click, so a later reply may speak by itself (Safari). */
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export function useAnimalSpeech(params: {
    /** A signed-in reader in the animal's own thread: the voice is per account. */
    available: boolean;
    captureId: string | null;
    speciesProfileId: string | null;
}) {
    const {available, captureId, speciesProfileId} = params;
    const [phase, setPhase] = useState<AskSpeechPhase>({kind: "idle"});
    const [allowance, setAllowance] = useState<AskSpeechAllowance | null>(null);
    const [notice, setNotice] = useState<AskSpeechNotice | null>(null);
    const [cursor, setCursor] = useState<AskSpokenCursor>(null);
    const [automaticPaused, setAutomaticPaused] = useState(false);
    const [autoplay, setAutoplayState] = useState(true);
    useEffect(() => setAutoplayState(readAutoplay()), []);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const unlockedRef = useRef(false);
    const clipsRef = useRef(new Map<string, Clip>());
    const blobsRef = useRef<string[]>([]);
    const timingRef = useRef<Timing | null>(null);
    const clockRef = useRef<number | null>(null);
    const requestRef = useRef<AbortController | null>(null);
    const phaseRef = useRef<AskSpeechPhase>({kind: "idle"});
    const failuresRef = useRef(0);
    const pausedRef = useRef(false);

    const setPhaseBoth = (next: AskSpeechPhase) => {
        phaseRef.current = next;
        setPhase(next);
    };

    const audio = useCallback(() => {
        if (!audioRef.current) {
            const element = new Audio();
            element.preload = "auto";
            audioRef.current = element;
        }
        return audioRef.current;
    }, []);

    const stopClock = () => {
        if (clockRef.current !== null) cancelAnimationFrame(clockRef.current);
        clockRef.current = null;
    };

    const stop = useCallback(() => {
        requestRef.current?.abort();
        requestRef.current = null;
        stopClock();
        timingRef.current = null;
        setCursor(null);
        const element = audioRef.current;
        if (element) {
            element.onended = null;
            element.onerror = null;
            element.pause();
        }
        if (phaseRef.current.kind !== "idle") setPhaseBoth({kind: "idle"});
    }, []);

    // Closing the chat (the drawer unmounts) silences it.
    useEffect(() => () => {
        stop();
        blobsRef.current.forEach((url) => URL.revokeObjectURL(url));
        blobsRef.current = [];
    }, [stop]);

    // Today's spoken replies, so a free account sees what is left before it asks.
    useEffect(() => {
        if (!available) return;
        let cancelled = false;
        void fetch("/api/ask/speech", {method: "GET"})
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: {allowance?: unknown} | null) => {
                const fetched = allowanceFrom(payload?.allowance);
                if (!cancelled && fetched) setAllowance(fetched);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [available]);

    /**
     * Follows the voice and moves the cursor when the word changes, so only
     * the spoken reply redraws. A clip without word times gets them spread
     * over its length once that is known.
     */
    const startClock = useCallback((messageId: string) => {
        stopClock();
        const tick = () => {
            const element = audioRef.current;
            const timing = timingRef.current;
            if (!element || !timing || timing.messageId !== messageId || phaseRef.current.kind !== "playing") return;
            if (timing.spoken.length === 0 && Number.isFinite(element.duration) && element.duration > 0) {
                timing.spoken = askEstimatedSpokenWords(timing.shown, element.duration);
                timing.toShown = timing.spoken.map((_, index) => index);
            }
            const spokenIndex = askSpokenIndex(element.currentTime, timing.spoken);
            const shownIndex = spokenIndex === null ? null : timing.toShown[spokenIndex] ?? null;
            setCursor((current) => {
                if (shownIndex === null) return current === null ? current : null;
                return current && current.messageId === messageId && current.word === shownIndex ? current : {messageId, word: shownIndex};
            });
            clockRef.current = requestAnimationFrame(tick);
        };
        clockRef.current = requestAnimationFrame(tick);
    }, []);

    const play = useCallback(async (messageId: string, clip: Clip, text: string): Promise<boolean> => {
        const shown = askReplyWordsOf(text);
        const spoken = clip.words ?? [];
        timingRef.current = {messageId, shown, spoken, toShown: askMatchSpokenWords(spoken.map((word) => word.text), shown)};
        const element = audio();
        element.onended = () => stop();
        element.onerror = () => stop();
        element.src = clip.src;
        try {
            await element.play();
        } catch {
            if (phaseRef.current.kind === "loading" && phaseRef.current.messageId === messageId) setPhaseBoth({kind: "idle"});
            timingRef.current = null;
            return false;
        }
        if (phaseRef.current.kind !== "loading" || phaseRef.current.messageId !== messageId) {
            element.pause();
            return false;
        }
        setPhaseBoth({kind: "playing", messageId});
        startClock(messageId);
        return true;
    }, [audio, startClock, stop]);

    const start = useCallback(async (messageId: string, text: string, automatic: boolean) => {
        stop();
        setNotice(null);
        setPhaseBoth({kind: "loading", messageId});
        const cached = clipsRef.current.get(messageId);
        if (cached) {
            await play(messageId, cached, text);
            return;
        }
        const controller = new AbortController();
        requestRef.current = controller;
        const fail = () => {
            if (phaseRef.current.kind === "loading" && phaseRef.current.messageId === messageId) setPhaseBoth({kind: "idle"});
            if (automatic) {
                failuresRef.current += 1;
                if (failuresRef.current >= 2) {
                    pausedRef.current = true;
                    setAutomaticPaused(true);
                }
                return;
            }
            setNotice({messageId, kind: "failed", offersPro: false});
        };
        try {
            const response = await fetch("/api/ask/speech", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                signal: controller.signal,
                body: JSON.stringify({text, captureId, speciesProfileId})
            });
            const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
            if (controller.signal.aborted) return;
            const fetched = allowanceFrom(payload.allowance);
            if (fetched) setAllowance(fetched);
            if (payload.reason === "speech_limit_reached") {
                setPhaseBoth({kind: "idle"});
                // Said once; the next replies just stay quiet.
                if (automatic) {
                    pausedRef.current = true;
                    setAutomaticPaused(true);
                }
                setNotice({messageId, kind: "limit", offersPro: !(fetched?.isPro ?? false)});
                return;
            }
            let src: string | null = null;
            if (response.ok && typeof payload.url === "string") {
                src = payload.url;
            } else if (response.ok && typeof payload.audio === "string") {
                const bytes = Uint8Array.from(atob(payload.audio), (character) => character.charCodeAt(0));
                src = URL.createObjectURL(new Blob([bytes], {type: "audio/mpeg"}));
                blobsRef.current.push(src);
            }
            if (!src) {
                fail();
                return;
            }
            const clip = {src, words: parseAskSpokenWords(payload.words)};
            clipsRef.current.set(messageId, clip);
            failuresRef.current = 0;
            if (!(await play(messageId, clip, text)) && automatic) fail();
        } catch {
            if (controller.signal.aborted) return;
            fail();
        } finally {
            if (requestRef.current === controller) requestRef.current = null;
        }
    }, [captureId, speciesProfileId, play, stop]);

    const isActive = useCallback((messageId: string) => (
        (phase.kind === "loading" || phase.kind === "playing") && phase.messageId === messageId
    ), [phase]);

    /** The voice icon or "Hear it": plays this reply, or stops it when it is the one speaking. */
    const toggle = useCallback((messageId: string, text: string) => {
        const current = phaseRef.current;
        if (current.kind !== "idle" && current.messageId === messageId) {
            stop();
            return;
        }
        void start(messageId, text, false);
    }, [start, stop]);

    /** A reply that has just arrived speaks by itself, replacing whatever the animal was still saying. */
    const speakAutomatically = useCallback((messageId: string, text: string) => {
        if (!available || !autoplay || pausedRef.current) return;
        const current = phaseRef.current;
        if (current.kind !== "idle" && current.messageId === messageId) return;
        void start(messageId, text, true);
    }, [available, autoplay, start]);

    /**
     * Called inside the reader's own click or key press (sending a message):
     * a browser that only lets a page play sound it was asked for then lets
     * the next reply speak by itself.
     */
    const prime = useCallback(() => {
        if (!available || unlockedRef.current || phaseRef.current.kind !== "idle") return;
        unlockedRef.current = true;
        const element = audio();
        element.src = SILENCE;
        void element.play().then(() => element.pause()).catch(() => {
            unlockedRef.current = false;
        });
    }, [available, audio]);

    const setAutoplay = useCallback((on: boolean) => {
        setAutoplayState(on);
        try {
            window.localStorage.setItem(ASK_VOICE_AUTOPLAY_KEY, on ? "on" : "off");
        } catch {
            // For this page, then.
        }
        if (!on) stop();
    }, [stop]);

    return {
        phase,
        isPlaying: phase.kind === "playing",
        isActive,
        allowance,
        notice,
        dismissNotice: useCallback(() => setNotice(null), []),
        cursor,
        autoplay,
        setAutoplay,
        automaticPaused,
        toggle,
        speakAutomatically,
        prime,
        stop
    };
}
