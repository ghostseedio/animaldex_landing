"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";

// The signed-in half of the Listen / Play buttons: asks /api/narration for the
// AI reading of `text` (saved after the first listener) and plays it in an
// <audio> element. `start()` resolving false means "use the browser voice":
// signed out, or the AI voice is unavailable.

export type CloudNarrationState = "idle" | "loading" | "ready" | "playing" | "paused";

export function useCloudNarration({text, locale}: {text: string; locale: string}) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const urlRef = useRef<{text: string; url: string} | null>(null);
    const requestRef = useRef(0);
    const rateRef = useRef(1);
    const [signedIn, setSignedIn] = useState(false);
    const [state, setState] = useState<CloudNarrationState>("idle");
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // A cookie is only a hint; the route checks the session for real.
    useEffect(() => {
        setSignedIn(requestHasSupabaseAuthCookie(document.cookie));
    }, []);

    const audio = useCallback(() => {
        if (!audioRef.current) {
            const element = new Audio();
            element.preload = "auto";
            element.addEventListener("timeupdate", () => {
                if (element.duration > 0) setProgress(element.currentTime / element.duration);
            });
            element.addEventListener("play", () => setState("playing"));
            element.addEventListener("pause", () => {
                if (!element.ended) setState((current) => current === "playing" ? "paused" : current);
            });
            element.addEventListener("ended", () => {
                setState("idle");
                setProgress(0);
            });
            audioRef.current = element;
        }
        return audioRef.current;
    }, []);

    const stop = useCallback(() => {
        requestRef.current += 1;
        const element = audioRef.current;
        if (element) {
            element.pause();
            element.currentTime = 0;
        }
        setState("idle");
        setProgress(0);
    }, []);

    useEffect(() => () => {
        requestRef.current += 1;
        audioRef.current?.pause();
    }, []);

    // New text (another animal, another post): the old reading no longer applies.
    useEffect(() => {
        stop();
        urlRef.current = null;
    }, [stop, text]);

    const playLoaded = useCallback(async () => {
        const element = audio();
        element.playbackRate = rateRef.current;
        try {
            await element.play();
        } catch {
            // The reading took long enough that the tap no longer counts as a
            // gesture (Safari): it is loaded, so the next tap plays at once.
            setState("ready");
        }
    }, [audio]);

    /** Plays the AI reading. False: fall back to the browser voice. */
    const start = useCallback(async (): Promise<boolean> => {
        if (!signedIn || !text.trim()) return false;
        const element = audio();
        if (urlRef.current?.text === text) {
            element.currentTime = 0;
            await playLoaded();
            return true;
        }
        const request = ++requestRef.current;
        setError(null);
        setState("loading");
        try {
            const response = await fetch("/api/narration", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({text, locale})
            });
            if (request !== requestRef.current) return true;
            if (response.status === 401) {
                setSignedIn(false);
                setState("idle");
                return false;
            }
            const body = await response.json().catch(() => ({})) as {url?: string; error?: string};
            if (!response.ok || !body.url) {
                setError(body.error ?? "The AI voice is unavailable right now.");
                setState("idle");
                return false;
            }
            urlRef.current = {text, url: body.url};
            element.src = body.url;
            await playLoaded();
            return true;
        } catch {
            if (request !== requestRef.current) return true;
            setError("The AI voice is unavailable right now.");
            setState("idle");
            return false;
        }
    }, [audio, locale, playLoaded, signedIn, text]);

    const pause = useCallback(() => audioRef.current?.pause(), []);
    const resume = useCallback(() => {
        void playLoaded();
    }, [playLoaded]);
    const setRate = useCallback((rate: number) => {
        rateRef.current = rate;
        if (audioRef.current) audioRef.current.playbackRate = rate;
    }, []);

    return {signedIn, state, progress, error, start, pause, resume, stop, setRate};
}
